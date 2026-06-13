/**
 * Production planning router (Phase 4).
 *
 * Manages production plans (named scenarios) and the planned batches inside
 * them, and computes the per-period inventory requirements by summing every
 * planned batch's bill-of-materials.
 *
 * A planned batch = recipe × target volume × period × bottle/keg split. The
 * requirements query loads each referenced recipe's current inputs + steps,
 * runs `computeRecipeBOM` per batch, and folds them with `aggregateRecipeBOMs`.
 *
 * RBAC: the `plan` entity (reserved in the RBAC matrix for batch
 * plans/scheduling). Read for viewers, write for operators/admins.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  productionPlans,
  plannedBatches,
  recipes,
  recipeInputs,
  recipeSteps,
  users,
} from "db";
import {
  computeRecipeBOM,
  aggregateRecipeBOMs,
  recipeRowsToBomInput,
  type PlannedBatchBom,
} from "lib/src/recipes/bom";
import { router, createRbacProcedure } from "../trpc";

// The app is single-org; settings.ts uses the same default org id.
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// ─── Input schemas ──────────────────────────────────────────────────────────

const plannedBatchInputSchema = z.object({
  recipeId: z.string().uuid(),
  label: z.string().max(200).nullish(),
  targetVolumeL: z.number().positive("Target volume must be greater than 0"),
  bottleVolumeL: z.number().nonnegative().nullish(),
  kegVolumeL: z.number().nonnegative().nullish(),
  period: z.string().min(1, "Period is required").max(20),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().nullish(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Decimal → number, treating null/undefined as undefined (so BOM fallbacks apply). */
function num(value: string | null | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const planningRouter = router({
  /**
   * List production plans (scenarios) for the org, newest first, with a count
   * of how many batches each contains. Excludes soft-deleted plans.
   */
  listPlans: createRbacProcedure("list", "plan").query(async () => {
    const rows = await db
      .select({
        id: productionPlans.id,
        name: productionPlans.name,
        year: productionPlans.year,
        isOperational: productionPlans.isOperational,
        notes: productionPlans.notes,
        createdAt: productionPlans.createdAt,
        updatedAt: productionPlans.updatedAt,
        createdByName: users.name,
        batchCount: sql<number>`count(${plannedBatches.id})::int`,
      })
      .from(productionPlans)
      .leftJoin(users, eq(productionPlans.createdBy, users.id))
      .leftJoin(plannedBatches, eq(plannedBatches.planId, productionPlans.id))
      .where(
        and(
          eq(productionPlans.organizationId, DEFAULT_ORG_ID),
          isNull(productionPlans.deletedAt),
        ),
      )
      .groupBy(productionPlans.id, users.name)
      .orderBy(desc(productionPlans.isOperational), desc(productionPlans.updatedAt));

    return { items: rows };
  }),

  /**
   * Get a single plan with its planned batches (each joined to its recipe's
   * name + product type for display).
   */
  getPlan: createRbacProcedure("read", "plan")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [plan] = await db
        .select()
        .from(productionPlans)
        .where(
          and(
            eq(productionPlans.id, input.id),
            isNull(productionPlans.deletedAt),
          ),
        )
        .limit(1);

      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }

      const batches = await db
        .select({
          id: plannedBatches.id,
          recipeId: plannedBatches.recipeId,
          label: plannedBatches.label,
          targetVolumeL: plannedBatches.targetVolumeL,
          bottleVolumeL: plannedBatches.bottleVolumeL,
          kegVolumeL: plannedBatches.kegVolumeL,
          period: plannedBatches.period,
          sortOrder: plannedBatches.sortOrder,
          notes: plannedBatches.notes,
          recipeName: recipes.name,
          recipeProductType: recipes.productType,
          recipeArchivedAt: recipes.archivedAt,
        })
        .from(plannedBatches)
        .innerJoin(recipes, eq(plannedBatches.recipeId, recipes.id))
        .where(eq(plannedBatches.planId, input.id))
        .orderBy(asc(plannedBatches.sortOrder), asc(plannedBatches.period));

      return { plan, batches };
    }),

  /** Create a new (empty) plan. */
  createPlan: createRbacProcedure("create", "plan")
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(200),
        year: z.number().int().min(2000).max(2100).nullish(),
        notes: z.string().nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [created] = await db
        .insert(productionPlans)
        .values({
          organizationId: DEFAULT_ORG_ID,
          name: input.name,
          year: input.year ?? null,
          notes: input.notes ?? null,
          createdBy: ctx.session.user.id,
          updatedBy: ctx.session.user.id,
        })
        .returning();
      return created;
    }),

  /** Update a plan's name/year/notes. */
  updatePlan: createRbacProcedure("update", "plan")
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        year: z.number().int().min(2000).max(2100).nullish(),
        notes: z.string().nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const [updated] = await db
        .update(productionPlans)
        .set({
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.year !== undefined ? { year: rest.year } : {}),
          ...(rest.notes !== undefined ? { notes: rest.notes } : {}),
          updatedBy: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .where(
          and(eq(productionPlans.id, id), isNull(productionPlans.deletedAt)),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }
      return updated;
    }),

  /**
   * Mark a plan operational. Exactly one plan per org is operational at a
   * time, so this clears the flag on every other plan first.
   */
  setOperational: createRbacProcedure("update", "plan")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        await tx
          .update(productionPlans)
          .set({ isOperational: false, updatedAt: new Date() })
          .where(
            and(
              eq(productionPlans.organizationId, DEFAULT_ORG_ID),
              eq(productionPlans.isOperational, true),
            ),
          );

        const [updated] = await tx
          .update(productionPlans)
          .set({
            isOperational: true,
            updatedBy: ctx.session.user.id,
            updatedAt: new Date(),
          })
          .where(
            and(eq(productionPlans.id, input.id), isNull(productionPlans.deletedAt)),
          )
          .returning();
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
        }
        return updated;
      });
    }),

  /** Soft-delete a plan (its planned batches cascade on hard delete; soft delete just hides it). */
  deletePlan: createRbacProcedure("delete", "plan")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .update(productionPlans)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(productionPlans.id, input.id), isNull(productionPlans.deletedAt)),
        )
        .returning({ id: productionPlans.id });
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }
      return { success: true };
    }),

  /** Add a planned batch to a plan. */
  addBatch: createRbacProcedure("update", "plan")
    .input(
      plannedBatchInputSchema.extend({ planId: z.string().uuid() }),
    )
    .mutation(async ({ input }) => {
      const { planId, ...batch } = input;

      const [plan] = await db
        .select({ id: productionPlans.id })
        .from(productionPlans)
        .where(
          and(eq(productionPlans.id, planId), isNull(productionPlans.deletedAt)),
        )
        .limit(1);
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }

      const [created] = await db
        .insert(plannedBatches)
        .values({
          planId,
          recipeId: batch.recipeId,
          label: batch.label ?? null,
          targetVolumeL: String(batch.targetVolumeL),
          bottleVolumeL: batch.bottleVolumeL != null ? String(batch.bottleVolumeL) : null,
          kegVolumeL: batch.kegVolumeL != null ? String(batch.kegVolumeL) : null,
          period: batch.period,
          sortOrder: batch.sortOrder,
          notes: batch.notes ?? null,
        })
        .returning();
      return created;
    }),

  /** Update a planned batch. */
  updateBatch: createRbacProcedure("update", "plan")
    .input(
      plannedBatchInputSchema.partial().extend({ id: z.string().uuid() }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const [updated] = await db
        .update(plannedBatches)
        .set({
          ...(rest.recipeId !== undefined ? { recipeId: rest.recipeId } : {}),
          ...(rest.label !== undefined ? { label: rest.label ?? null } : {}),
          ...(rest.targetVolumeL !== undefined ? { targetVolumeL: String(rest.targetVolumeL) } : {}),
          ...(rest.bottleVolumeL !== undefined ? { bottleVolumeL: rest.bottleVolumeL != null ? String(rest.bottleVolumeL) : null } : {}),
          ...(rest.kegVolumeL !== undefined ? { kegVolumeL: rest.kegVolumeL != null ? String(rest.kegVolumeL) : null } : {}),
          ...(rest.period !== undefined ? { period: rest.period } : {}),
          ...(rest.sortOrder !== undefined ? { sortOrder: rest.sortOrder } : {}),
          ...(rest.notes !== undefined ? { notes: rest.notes ?? null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(plannedBatches.id, id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Planned batch not found" });
      }
      return updated;
    }),

  /** Remove a planned batch. */
  removeBatch: createRbacProcedure("update", "plan")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .delete(plannedBatches)
        .where(eq(plannedBatches.id, input.id))
        .returning({ id: plannedBatches.id });
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Planned batch not found" });
      }
      return { success: true };
    }),

  /**
   * Compute per-period inventory requirements for a plan: sum every planned
   * batch's bill-of-materials, grouped by period and variety. Gross
   * requirements only — on-hand comparison / shortfalls come in the buy-list
   * step. Recipes are read at their CURRENT spec.
   */
  getRequirements: createRbacProcedure("read", "plan")
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ input }) => {
      const batches = await db
        .select({
          recipeId: plannedBatches.recipeId,
          label: plannedBatches.label,
          targetVolumeL: plannedBatches.targetVolumeL,
          bottleVolumeL: plannedBatches.bottleVolumeL,
          kegVolumeL: plannedBatches.kegVolumeL,
          period: plannedBatches.period,
          recipeName: recipes.name,
        })
        .from(plannedBatches)
        .innerJoin(recipes, eq(plannedBatches.recipeId, recipes.id))
        .where(eq(plannedBatches.planId, input.planId));

      if (batches.length === 0) {
        return { requirements: [], warnings: [], batchCount: 0 };
      }

      // Load the current inputs + steps for every referenced recipe in two
      // queries, then index by recipeId.
      const recipeIds = Array.from(new Set(batches.map((b) => b.recipeId)));
      const [allInputs, allSteps] = await Promise.all([
        db
          .select()
          .from(recipeInputs)
          .where(inArray(recipeInputs.recipeId, recipeIds))
          .orderBy(asc(recipeInputs.sortOrder)),
        db
          .select()
          .from(recipeSteps)
          .where(inArray(recipeSteps.recipeId, recipeIds))
          .orderBy(asc(recipeSteps.sequence)),
      ]);

      const inputsByRecipe = new Map<string, typeof allInputs>();
      for (const row of allInputs) {
        const list = inputsByRecipe.get(row.recipeId) ?? [];
        list.push(row);
        inputsByRecipe.set(row.recipeId, list);
      }
      const stepsByRecipe = new Map<string, typeof allSteps>();
      for (const row of allSteps) {
        const list = stepsByRecipe.get(row.recipeId) ?? [];
        list.push(row);
        stepsByRecipe.set(row.recipeId, list);
      }

      const perBatch: PlannedBatchBom[] = [];
      const warnings: string[] = [];
      for (const b of batches) {
        const bom = computeRecipeBOM(
          recipeRowsToBomInput(
            inputsByRecipe.get(b.recipeId) ?? [],
            stepsByRecipe.get(b.recipeId) ?? [],
            {
              targetVolumeL: Number(b.targetVolumeL),
              bottleL: num(b.bottleVolumeL),
              kegL: num(b.kegVolumeL),
            },
          ),
        );
        // Prefix BOM warnings with the batch so the UI can attribute them.
        const who = b.label || b.recipeName;
        for (const w of bom.warnings) warnings.push(`${who} (${b.period}): ${w}`);
        perBatch.push({ period: b.period, bom });
      }

      return {
        requirements: aggregateRecipeBOMs(perBatch),
        warnings,
        batchCount: batches.length,
      };
    }),
});
