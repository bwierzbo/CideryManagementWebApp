/**
 * Recipe router (Phase 1).
 *
 * Manages the recipe template repository: list, get, create, update, archive,
 * restore, clone, and version history. Every successful save creates an
 * immutable snapshot in `recipe_versions` so historical specifications can
 * be reconstructed exactly (the "re-run the 2024 winning recipe" use case).
 *
 * RBAC: every endpoint goes through `createRbacProcedure` against the
 * `recipe` entity. The new `permission_overrides` system from task #20
 * means admins can grant `recipe:author` per-user without role changes.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import {
  db,
  recipes,
  recipeInputs,
  recipeSteps,
  recipeVersions,
  users,
} from "db";
import { router, createRbacProcedure } from "../trpc";

// ─── Enums (mirror DB CHECK constraints) ────────────────────────────────────

const PRODUCT_TYPES = [
  "juice", "cider", "perry", "wine", "cyser", "brandy", "pommeau", "other",
] as const;

const RECIPE_STATUSES = ["draft", "active", "archived"] as const;

const INPUT_KINDS = [
  "ingredient",
  "parent_batch_requirement",
  "press_run_requirement",
  "juice_purchase_requirement",
] as const;

const STEP_KINDS = [
  "pitch_yeast", "add_additive", "measurement", "rack", "filter", "transfer",
  "carbonate", "package", "pasteurize", "label", "wait", "qa_gate", "note",
] as const;

const TRIGGER_KINDS = [
  "date_offset_from_start",
  "date_offset_from_previous",
  "after_previous",
  "sg_threshold",
  "sg_terminal_confirmed",
  "manual",
] as const;

// ─── Zod schemas ────────────────────────────────────────────────────────────

const recipeInputInputSchema = z.object({
  kind: z.enum(INPUT_KINDS),
  label: z.string().min(1, "Label required").max(200),
  additiveType: z.string().max(100).nullish(),
  additiveName: z.string().max(200).nullish(),
  additiveVarietyId: z.string().uuid().nullish(),
  rateValue: z.number().nonnegative().nullish(),
  rateUnit: z.string().max(20).nullish(),
  sourceProductType: z.enum(PRODUCT_TYPES).nullish(),
  densityKgPerL: z.number().positive().nullish(),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().nullish(),
});

const recipeStepInputSchema = z.object({
  kind: z.enum(STEP_KINDS),
  sequence: z.number().int().min(0),
  label: z.string().min(1, "Label required").max(200),
  description: z.string().nullish(),
  triggerKind: z.enum(TRIGGER_KINDS).default("manual"),
  triggerData: z.record(z.string(), z.unknown()).default({}),
  actionData: z.record(z.string(), z.unknown()).default({}),
  estimatedDurationHours: z.number().nonnegative().nullish(),
  notes: z.string().nullish(),
  packagingPath: z.enum(["all", "bottle", "keg"]).default("all"),
  isOptional: z.boolean().default(false),
});

const recipeCreateSchema = z.object({
  name: z.string().min(1, "Name required").max(200),
  description: z.string().nullish(),
  productType: z.enum(PRODUCT_TYPES),
  enabledSections: z.record(z.string(), z.boolean()).default({}),
  status: z.enum(["draft", "active"]).default("draft"),
  notes: z.string().nullish(),
  isTemplate: z.boolean().default(false),
  inputs: z.array(recipeInputInputSchema).default([]),
  steps: z.array(recipeStepInputSchema).default([]),
  changeSummary: z.string().nullish(),
});

const recipeUpdateSchema = z.object({
  id: z.string().uuid(),
  // All fields optional — only what's present gets updated
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullish(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  enabledSections: z.record(z.string(), z.boolean()).optional(),
  status: z.enum(["draft", "active"]).optional(),
  notes: z.string().nullish(),
  isTemplate: z.boolean().optional(),
  // If inputs/steps are provided, they REPLACE the existing rows entirely
  // (treated as the new authoritative state). Pass undefined to leave alone.
  inputs: z.array(recipeInputInputSchema).optional(),
  steps: z.array(recipeStepInputSchema).optional(),
  changeSummary: z.string().nullish(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds the JSONB snapshot for a recipe version. Includes the recipe head
 * + all inputs + all steps as they were at the point of save. This is what
 * gets stored in `recipe_versions.snapshot` and read back when reconstructing
 * an older specification.
 */
async function buildSnapshot(recipeId: string) {
  const [head] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  const inputs = await db
    .select()
    .from(recipeInputs)
    .where(eq(recipeInputs.recipeId, recipeId))
    .orderBy(asc(recipeInputs.sortOrder));
  const steps = await db
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, recipeId))
    .orderBy(asc(recipeSteps.sequence));

  return { recipe: head, inputs, steps };
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const recipesRouter = router({
  /**
   * List recipes with filters. Excludes soft-deleted (archived) by default.
   */
  list: createRbacProcedure("list", "recipe")
    .input(
      z
        .object({
          productType: z.enum(PRODUCT_TYPES).optional(),
          status: z.enum(RECIPE_STATUSES).optional(),
          search: z.string().optional(),
          /** Filter by template flag: true → only templates, false → only non-templates. */
          isTemplate: z.boolean().optional(),
          includeArchived: z.boolean().default(false),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const opts = input ?? {
        includeArchived: false,
        limit: 50,
        offset: 0,
      };
      const conditions = [];

      if (!opts.includeArchived) {
        conditions.push(isNull(recipes.archivedAt));
      }
      if (opts.productType) {
        conditions.push(eq(recipes.productType, opts.productType));
      }
      if (opts.status) {
        conditions.push(eq(recipes.status, opts.status));
      }
      if (opts.search) {
        conditions.push(ilike(recipes.name, `%${opts.search}%`));
      }
      if (opts.isTemplate !== undefined) {
        conditions.push(eq(recipes.isTemplate, opts.isTemplate));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: recipes.id,
          name: recipes.name,
          description: recipes.description,
          productType: recipes.productType,
          status: recipes.status,
          isTemplate: recipes.isTemplate,
          currentVersion: recipes.currentVersion,
          enabledSections: recipes.enabledSections,
          createdBy: recipes.createdBy,
          createdAt: recipes.createdAt,
          updatedAt: recipes.updatedAt,
          archivedAt: recipes.archivedAt,
          createdByName: users.name,
        })
        .from(recipes)
        .leftJoin(users, eq(recipes.createdBy, users.id))
        .where(where)
        .orderBy(desc(recipes.updatedAt))
        .limit(opts.limit + 1)
        .offset(opts.offset);

      const hasMore = rows.length > opts.limit;
      return { items: rows.slice(0, opts.limit), hasMore };
    }),

  /**
   * Get a single recipe with its current inputs + steps.
   */
  get: createRbacProcedure("read", "recipe")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [head] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.id))
        .limit(1);

      if (!head) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }

      const [inputs, steps] = await Promise.all([
        db
          .select()
          .from(recipeInputs)
          .where(eq(recipeInputs.recipeId, input.id))
          .orderBy(asc(recipeInputs.sortOrder)),
        db
          .select()
          .from(recipeSteps)
          .where(eq(recipeSteps.recipeId, input.id))
          .orderBy(asc(recipeSteps.sequence)),
      ]);

      return { recipe: head, inputs, steps };
    }),

  /**
   * List version snapshots for a recipe (newest first).
   */
  listVersions: createRbacProcedure("read", "recipe")
    .input(z.object({ recipeId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await db
        .select({
          id: recipeVersions.id,
          version: recipeVersions.version,
          changeSummary: recipeVersions.changeSummary,
          createdBy: recipeVersions.createdBy,
          createdAt: recipeVersions.createdAt,
          createdByName: users.name,
        })
        .from(recipeVersions)
        .leftJoin(users, eq(recipeVersions.createdBy, users.id))
        .where(eq(recipeVersions.recipeId, input.recipeId))
        .orderBy(desc(recipeVersions.version));
    }),

  /**
   * Get the full snapshot of a specific version.
   */
  getVersion: createRbacProcedure("read", "recipe")
    .input(z.object({ recipeId: z.string().uuid(), version: z.number().int().min(1) }))
    .query(async ({ input }) => {
      const [row] = await db
        .select()
        .from(recipeVersions)
        .where(
          and(
            eq(recipeVersions.recipeId, input.recipeId),
            eq(recipeVersions.version, input.version),
          ),
        )
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe version not found" });
      }
      return row;
    }),

  /**
   * Create a new recipe (v1) with optional inputs + steps. Always creates
   * a v1 snapshot in recipe_versions.
   */
  create: createRbacProcedure("create", "recipe")
    .input(recipeCreateSchema)
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        const [head] = await tx
          .insert(recipes)
          .values({
            name: input.name,
            description: input.description ?? null,
            productType: input.productType,
            enabledSections: input.enabledSections,
            status: input.status,
            notes: input.notes ?? null,
            isTemplate: input.isTemplate,
            currentVersion: 1,
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          })
          .returning();

        if (input.inputs.length > 0) {
          await tx.insert(recipeInputs).values(
            input.inputs.map((i) => ({
              recipeId: head.id,
              kind: i.kind,
              label: i.label,
              additiveType: i.additiveType ?? null,
              additiveName: i.additiveName ?? null,
              additiveVarietyId: i.additiveVarietyId ?? null,
              rateValue: i.rateValue?.toString() ?? null,
              rateUnit: i.rateUnit ?? null,
              sourceProductType: i.sourceProductType ?? null,
              densityKgPerL: i.densityKgPerL?.toString() ?? null,
              sortOrder: i.sortOrder,
              notes: i.notes ?? null,
            })),
          );
        }

        if (input.steps.length > 0) {
          await tx.insert(recipeSteps).values(
            input.steps.map((s) => ({
              recipeId: head.id,
              kind: s.kind,
              sequence: s.sequence,
              label: s.label,
              description: s.description ?? null,
              triggerKind: s.triggerKind,
              triggerData: s.triggerData,
              actionData: s.actionData,
              estimatedDurationHours: s.estimatedDurationHours?.toString() ?? null,
              notes: s.notes ?? null,
              packagingPath: s.packagingPath,
              isOptional: s.isOptional,
            })),
          );
        }

        // v1 snapshot. We re-query inside the tx to capture the canonical
        // shape (including DB-generated fields like ids and timestamps).
        const snapshot = await buildSnapshotInTx(tx, head.id);
        await tx.insert(recipeVersions).values({
          recipeId: head.id,
          version: 1,
          snapshot,
          changeSummary: input.changeSummary ?? "Initial version",
          createdBy: ctx.user.id,
        });

        return { id: head.id, version: 1 };
      });
    }),

  /**
   * Update a recipe. If `inputs` or `steps` are provided, they REPLACE the
   * existing rows entirely (delete-then-insert). Always creates a new
   * version snapshot and increments `current_version`.
   */
  update: createRbacProcedure("update", "recipe")
    .input(recipeUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(recipes)
          .where(eq(recipes.id, input.id))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
        }

        const headPatch: Record<string, unknown> = {
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
          currentVersion: existing.currentVersion + 1,
        };
        if (input.name !== undefined)            headPatch.name = input.name;
        if (input.description !== undefined)     headPatch.description = input.description;
        if (input.productType !== undefined)     headPatch.productType = input.productType;
        if (input.enabledSections !== undefined) headPatch.enabledSections = input.enabledSections;
        if (input.status !== undefined)          headPatch.status = input.status;
        if (input.notes !== undefined)           headPatch.notes = input.notes;
        if (input.isTemplate !== undefined)      headPatch.isTemplate = input.isTemplate;

        await tx.update(recipes).set(headPatch).where(eq(recipes.id, input.id));

        // Replace inputs if provided
        if (input.inputs !== undefined) {
          await tx.delete(recipeInputs).where(eq(recipeInputs.recipeId, input.id));
          if (input.inputs.length > 0) {
            await tx.insert(recipeInputs).values(
              input.inputs.map((i) => ({
                recipeId: input.id,
                kind: i.kind,
                label: i.label,
                additiveType: i.additiveType ?? null,
                additiveName: i.additiveName ?? null,
                rateValue: i.rateValue?.toString() ?? null,
                rateUnit: i.rateUnit ?? null,
                sourceProductType: i.sourceProductType ?? null,
                densityKgPerL: i.densityKgPerL?.toString() ?? null,
                sortOrder: i.sortOrder,
                notes: i.notes ?? null,
              })),
            );
          }
        }

        // Replace steps if provided
        if (input.steps !== undefined) {
          await tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, input.id));
          if (input.steps.length > 0) {
            await tx.insert(recipeSteps).values(
              input.steps.map((s) => ({
                recipeId: input.id,
                kind: s.kind,
                sequence: s.sequence,
                label: s.label,
                description: s.description ?? null,
                triggerKind: s.triggerKind,
                triggerData: s.triggerData,
                actionData: s.actionData,
                estimatedDurationHours: s.estimatedDurationHours?.toString() ?? null,
                notes: s.notes ?? null,
                packagingPath: s.packagingPath,
                isOptional: s.isOptional,
              })),
            );
          }
        }

        // Snapshot the new state as the next version
        const newVersion = existing.currentVersion + 1;
        const snapshot = await buildSnapshotInTx(tx, input.id);
        await tx.insert(recipeVersions).values({
          recipeId: input.id,
          version: newVersion,
          snapshot,
          changeSummary: input.changeSummary ?? null,
          createdBy: ctx.user.id,
        });

        return { id: input.id, version: newVersion };
      });
    }),

  /**
   * Archive a recipe (soft delete). Status flips to 'archived' and
   * archivedAt is stamped. Recipe rows + history remain intact.
   */
  archive: createRbacProcedure("delete", "recipe")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(recipes)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(eq(recipes.id, input.id))
        .returning({ id: recipes.id });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }
      return { success: true };
    }),

  /**
   * Restore a previously-archived recipe back to draft status.
   */
  restore: createRbacProcedure("update", "recipe")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(recipes)
        .set({
          status: "draft",
          archivedAt: null,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        })
        .where(eq(recipes.id, input.id))
        .returning({ id: recipes.id });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }
      return { success: true };
    }),

  /**
   * Clone an existing recipe as a new draft. Useful for "duplicate this
   * winning recipe and tweak it" workflows. Inputs + steps are copied;
   * the clone starts at v1 with its own version history.
   */
  clone: createRbacProcedure("create", "recipe")
    .input(
      z.object({
        sourceId: z.string().uuid(),
        newName: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        const [source] = await tx
          .select()
          .from(recipes)
          .where(eq(recipes.id, input.sourceId))
          .limit(1);
        if (!source) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Source recipe not found" });
        }

        const [clone] = await tx
          .insert(recipes)
          .values({
            name: input.newName,
            description: source.description,
            productType: source.productType,
            enabledSections: source.enabledSections,
            status: "draft",
            notes: source.notes,
            currentVersion: 1,
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          })
          .returning();

        const sourceInputs = await tx
          .select()
          .from(recipeInputs)
          .where(eq(recipeInputs.recipeId, input.sourceId));
        if (sourceInputs.length > 0) {
          await tx.insert(recipeInputs).values(
            sourceInputs.map(({ id: _id, recipeId: _rid, createdAt: _c, updatedAt: _u, ...rest }) => ({
              ...rest,
              recipeId: clone.id,
            })),
          );
        }

        const sourceSteps = await tx
          .select()
          .from(recipeSteps)
          .where(eq(recipeSteps.recipeId, input.sourceId));
        if (sourceSteps.length > 0) {
          await tx.insert(recipeSteps).values(
            sourceSteps.map(({ id: _id, recipeId: _rid, createdAt: _c, updatedAt: _u, ...rest }) => ({
              ...rest,
              recipeId: clone.id,
            })),
          );
        }

        const snapshot = await buildSnapshotInTx(tx, clone.id);
        await tx.insert(recipeVersions).values({
          recipeId: clone.id,
          version: 1,
          snapshot,
          changeSummary: `Cloned from "${source.name}" v${source.currentVersion}`,
          createdBy: ctx.user.id,
        });

        return { id: clone.id };
      });
    }),
});

// Transaction-aware version of buildSnapshot. We need this because the
// transaction's row visibility is independent of the outer db pool — fetching
// via plain `db` inside a tx would miss the just-inserted rows.
async function buildSnapshotInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  recipeId: string,
) {
  const [head] = await tx.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  const inputs = await tx
    .select()
    .from(recipeInputs)
    .where(eq(recipeInputs.recipeId, recipeId))
    .orderBy(asc(recipeInputs.sortOrder));
  const steps = await tx
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, recipeId))
    .orderBy(asc(recipeSteps.sequence));

  return { recipe: head, inputs, steps };
}
