/**
 * Recipe execution router (Phase 5, M1).
 *
 * `instantiate` turns a recipe version into a live batch with a scheduled,
 * per-step task list (the work-queue items). Two modes:
 *   - "new": create a batch seeded from the chosen source (existing cider
 *     batches to blend, a press run, or a juice lot — whatever the recipe
 *     declares), then attach the schedule.
 *   - "attach": apply the schedule to a batch that already exists.
 *
 * Steps are SNAPSHOTTED into `batch_step_tasks` at instantiation so later edits
 * to the recipe template never disrupt an in-flight batch. The bottle/keg split
 * determines which packaging-path steps are generated. Optional steps the
 * operator chose to skip are omitted. Due-dates come from `buildStepSchedule`.
 *
 * RBAC: `batch` entity (execution creates/reads batch-level work).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  batches,
  recipes,
  recipeSteps,
  batchRecipeExecutions,
  batchStepTasks,
} from "db";
import { buildStepSchedule } from "lib";
import { router, createRbacProcedure } from "../trpc";

const instantiateSchema = z
  .object({
    recipeId: z.string().uuid(),
    mode: z.enum(["new", "attach"]),
    startDate: z.coerce.date(),
    totalVolumeL: z.number().positive(),
    kegVolumeL: z.number().min(0).default(0),
    // "new" mode source selection (only the ones the recipe declares are used)
    parentBatchIds: z.array(z.string().uuid()).default([]),
    pressRunId: z.string().uuid().nullish(),
    juicePurchaseItemId: z.string().uuid().nullish(),
    newBatchName: z.string().max(200).nullish(),
    // "attach" mode
    existingBatchId: z.string().uuid().nullish(),
    // Optional steps to skip (recipe_steps.id)
    skippedStepIds: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => v.kegVolumeL <= v.totalVolumeL, {
    message: "Keg portion can't exceed total volume",
    path: ["kegVolumeL"],
  })
  .refine((v) => v.mode !== "attach" || !!v.existingBatchId, {
    message: "Pick a batch to attach to",
    path: ["existingBatchId"],
  });

export const recipeExecutionRouter = router({
  /** Instantiate a recipe into a live, scheduled batch. */
  instantiate: createRbacProcedure("create", "batch")
    .input(instantiateSchema)
    .mutation(async ({ input, ctx }) => {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, input.recipeId))
        .limit(1);
      if (!recipe) throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });

      const allSteps = await db
        .select()
        .from(recipeSteps)
        .where(eq(recipeSteps.recipeId, input.recipeId))
        .orderBy(asc(recipeSteps.sequence));

      const bottleVolumeL = Math.max(0, input.totalVolumeL - input.kegVolumeL);
      const kegVolumeL = input.kegVolumeL;

      // Which steps actually run: respect the split + skipped optional steps.
      const skipped = new Set(input.skippedStepIds);
      const runSteps = allSteps.filter((s) => {
        if (skipped.has(s.id)) return false;
        const path = s.packagingPath ?? "all";
        if (path === "bottle" && bottleVolumeL <= 0) return false;
        if (path === "keg" && kegVolumeL <= 0) return false;
        return true;
      });

      const scheduled = buildStepSchedule(
        runSteps.map((s) => ({
          triggerKind: s.triggerKind,
          triggerData: (s.triggerData ?? {}) as Record<string, unknown>,
        })),
        input.startDate,
      );

      return await db.transaction(async (tx) => {
        let batchId: string;

        if (input.mode === "attach") {
          const [existing] = await tx
            .select({ id: batches.id })
            .from(batches)
            .where(eq(batches.id, input.existingBatchId!))
            .limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
          batchId = existing.id;
        } else {
          // Create a new batch shell seeded from the chosen source. Liquid is
          // moved when the transfer step runs (M3); here we record origin/lineage.
          const year = input.startDate.getFullYear();
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(batches)
            .where(
              and(
                sql`EXTRACT(YEAR FROM ${batches.startDate}) = ${year}`,
                isNull(batches.deletedAt),
              ),
            );
          const batchNumber = `${year}-${String(Number(count) + 1).padStart(3, "0")}`;
          const name = input.newBatchName?.trim() || `${recipe.name} ${batchNumber}`;
          const status =
            input.parentBatchIds.length > 0
              ? "conditioning"
              : recipe.productType === "brandy" || recipe.productType === "pommeau"
                ? "aging"
                : "fermentation";

          const [created] = await tx
            .insert(batches)
            .values({
              name,
              batchNumber,
              vesselId: null,
              initialVolume: input.totalVolumeL.toString(),
              initialVolumeUnit: "L",
              currentVolume: input.totalVolumeL.toString(),
              currentVolumeUnit: "L",
              productType: recipe.productType,
              status,
              startDate: input.startDate,
              parentBatchId: input.parentBatchIds[0] ?? null,
              originPressRunId: input.pressRunId ?? null,
              originJuicePurchaseItemId: input.juicePurchaseItemId ?? null,
            })
            .returning({ id: batches.id });
          batchId = created.id;
        }

        // Guard: one active execution per batch (also enforced by unique index).
        const [dupe] = await tx
          .select({ id: batchRecipeExecutions.id })
          .from(batchRecipeExecutions)
          .where(eq(batchRecipeExecutions.batchId, batchId))
          .limit(1);
        if (dupe) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This batch already has a recipe attached.",
          });
        }

        const [execution] = await tx
          .insert(batchRecipeExecutions)
          .values({
            batchId,
            recipeId: recipe.id,
            recipeVersion: recipe.currentVersion,
            mode: input.mode,
            startDate: input.startDate,
            sourceRefs: {
              parentBatchIds: input.parentBatchIds,
              pressRunId: input.pressRunId ?? null,
              juicePurchaseItemId: input.juicePurchaseItemId ?? null,
            },
            bottleVolumeL: bottleVolumeL.toString(),
            kegVolumeL: kegVolumeL.toString(),
            status: "active",
            createdBy: ctx.user.id,
          })
          .returning({ id: batchRecipeExecutions.id });

        if (runSteps.length > 0) {
          await tx.insert(batchStepTasks).values(
            runSteps.map((s, i) => ({
              executionId: execution.id,
              batchId,
              sequence: i,
              kind: s.kind,
              label: s.label,
              description: s.description ?? null,
              packagingPath: s.packagingPath ?? "all",
              isOptional: s.isOptional ?? false,
              triggerKind: s.triggerKind,
              triggerData: (s.triggerData ?? {}) as Record<string, unknown>,
              actionData: (s.actionData ?? {}) as Record<string, unknown>,
              scheduledDate: scheduled[i],
              status: "pending",
              estimatedHours: s.estimatedDurationHours ?? null,
            })),
          );
        }

        return { batchId, executionId: execution.id, taskCount: runSteps.length };
      });
    }),

  /** The recipe execution + ordered task list for a batch (null if none). */
  getForBatch: createRbacProcedure("read", "batch")
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [execution] = await db
        .select()
        .from(batchRecipeExecutions)
        .where(eq(batchRecipeExecutions.batchId, input.batchId))
        .limit(1);
      if (!execution) return { execution: null, tasks: [] };

      const tasks = await db
        .select()
        .from(batchStepTasks)
        .where(eq(batchStepTasks.executionId, execution.id))
        .orderBy(asc(batchStepTasks.sequence));

      return { execution, tasks };
    }),
});
