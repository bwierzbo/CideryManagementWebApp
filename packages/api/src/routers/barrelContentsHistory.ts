import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db, barrelContentsHistory, vessels, batches } from "db";
import { eq, asc, desc } from "drizzle-orm";

export const barrelContentsHistoryRouter = router({
  // List all contents history for a barrel (vessel)
  listByVessel: protectedProcedure
    .input(
      z.object({
        vesselId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const entries = await db
        .select({
          id: barrelContentsHistory.id,
          vesselId: barrelContentsHistory.vesselId,
          contentsType: barrelContentsHistory.contentsType,
          contentsDescription: barrelContentsHistory.contentsDescription,
          startedAt: barrelContentsHistory.startedAt,
          endedAt: barrelContentsHistory.endedAt,
          source: barrelContentsHistory.source,
          batchId: barrelContentsHistory.batchId,
          batchName: batches.name,
          tastingNotes: barrelContentsHistory.tastingNotes,
          flavorImpact: barrelContentsHistory.flavorImpact,
          sortOrder: barrelContentsHistory.sortOrder,
          createdAt: barrelContentsHistory.createdAt,
          updatedAt: barrelContentsHistory.updatedAt,
        })
        .from(barrelContentsHistory)
        .leftJoin(batches, eq(barrelContentsHistory.batchId, batches.id))
        .where(eq(barrelContentsHistory.vesselId, input.vesselId))
        .orderBy(asc(barrelContentsHistory.startedAt), asc(barrelContentsHistory.sortOrder));

      return { entries };
    }),

  // Get a single entry
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const [entry] = await db
        .select()
        .from(barrelContentsHistory)
        .where(eq(barrelContentsHistory.id, input.id))
        .limit(1);

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contents history entry not found",
        });
      }

      return { entry };
    }),

  // Create a new contents history entry (manual or pre-purchase)
  create: protectedProcedure
    .input(
      z.object({
        vesselId: z.string().uuid(),
        contentsType: z.string().min(1, "Contents type is required"),
        contentsDescription: z.string().optional(),
        startedAt: z.string(), // ISO date string
        endedAt: z.string().optional(),
        source: z.enum(["pre_purchase", "batch", "manual"]).default("manual"),
        batchId: z.string().uuid().optional(),
        tastingNotes: z.string().optional(),
        flavorImpact: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Verify vessel exists and is a barrel
      const [vessel] = await db
        .select()
        .from(vessels)
        .where(eq(vessels.id, input.vesselId))
        .limit(1);

      if (!vessel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vessel not found",
        });
      }

      if (!vessel.isBarrel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contents history can only be added to barrels",
        });
      }

      // If batchId provided, verify it exists
      if (input.batchId) {
        const [batch] = await db
          .select()
          .from(batches)
          .where(eq(batches.id, input.batchId))
          .limit(1);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }
      }

      // Calculate sort order if not provided (based on start date)
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const existingEntries = await db
          .select({ sortOrder: barrelContentsHistory.sortOrder })
          .from(barrelContentsHistory)
          .where(eq(barrelContentsHistory.vesselId, input.vesselId))
          .orderBy(desc(barrelContentsHistory.sortOrder))
          .limit(1);

        sortOrder = existingEntries.length > 0 ? (existingEntries[0].sortOrder || 0) + 1 : 0;
      }

      const [newEntry] = await db
        .insert(barrelContentsHistory)
        .values({
          vesselId: input.vesselId,
          contentsType: input.contentsType,
          contentsDescription: input.contentsDescription,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          source: input.source,
          batchId: input.batchId,
          tastingNotes: input.tastingNotes,
          flavorImpact: input.flavorImpact,
          sortOrder,
          createdBy: ctx.session?.user?.id,
        })
        .returning();

      return { entry: newEntry };
    }),

  // Update a contents history entry
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        contentsType: z.string().min(1).optional(),
        contentsDescription: z.string().optional(),
        startedAt: z.string().optional(),
        endedAt: z.string().nullable().optional(),
        tastingNotes: z.string().nullable().optional(),
        flavorImpact: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      // Get existing entry
      const [existing] = await db
        .select()
        .from(barrelContentsHistory)
        .where(eq(barrelContentsHistory.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contents history entry not found",
        });
      }

      // Build update object, handling null values
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.contentsType !== undefined) updateData.contentsType = updates.contentsType;
      if (updates.contentsDescription !== undefined) updateData.contentsDescription = updates.contentsDescription;
      if (updates.startedAt !== undefined) updateData.startedAt = updates.startedAt;
      if (updates.endedAt !== undefined) updateData.endedAt = updates.endedAt;
      if (updates.tastingNotes !== undefined) updateData.tastingNotes = updates.tastingNotes;
      if (updates.flavorImpact !== undefined) updateData.flavorImpact = updates.flavorImpact;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

      const [updated] = await db
        .update(barrelContentsHistory)
        .set(updateData)
        .where(eq(barrelContentsHistory.id, id))
        .returning();

      return { entry: updated };
    }),

  // Delete a contents history entry
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id } = input;

      // Get existing entry
      const [existing] = await db
        .select()
        .from(barrelContentsHistory)
        .where(eq(barrelContentsHistory.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contents history entry not found",
        });
      }

      await db
        .delete(barrelContentsHistory)
        .where(eq(barrelContentsHistory.id, id));

      return { success: true };
    }),

  // Helper: Record batch entering a barrel (called from batch transfer logic)
  recordBatchEntry: protectedProcedure
    .input(
      z.object({
        vesselId: z.string().uuid(),
        batchId: z.string().uuid(),
        startedAt: z.string(), // ISO date string
        contentsType: z.string().optional(), // e.g., 'cider', 'perry', 'brandy'
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Get batch info for contents type
      const [batch] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, input.batchId))
        .limit(1);

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      const contentsType = input.contentsType || batch.productType || "cider";

      const [newEntry] = await db
        .insert(barrelContentsHistory)
        .values({
          vesselId: input.vesselId,
          contentsType,
          contentsDescription: batch.name,
          startedAt: input.startedAt,
          source: "batch",
          batchId: input.batchId,
          createdBy: ctx.session?.user?.id,
        })
        .returning();

      return { entry: newEntry };
    }),

  // Helper: Record batch leaving a barrel (update end date)
  recordBatchExit: protectedProcedure
    .input(
      z.object({
        vesselId: z.string().uuid(),
        batchId: z.string().uuid(),
        endedAt: z.string(), // ISO date string
        tastingNotes: z.string().optional(),
        flavorImpact: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Find the open entry for this batch in this vessel
      const [existing] = await db
        .select()
        .from(barrelContentsHistory)
        .where(eq(barrelContentsHistory.vesselId, input.vesselId))
        .orderBy(desc(barrelContentsHistory.startedAt))
        .limit(1);

      if (!existing || existing.batchId !== input.batchId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No open contents history entry found for this batch in this barrel",
        });
      }

      if (existing.endedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This contents history entry already has an end date",
        });
      }

      const [updated] = await db
        .update(barrelContentsHistory)
        .set({
          endedAt: input.endedAt,
          tastingNotes: input.tastingNotes,
          flavorImpact: input.flavorImpact,
          updatedAt: new Date(),
        })
        .where(eq(barrelContentsHistory.id, existing.id))
        .returning();

      return { entry: updated };
    }),
});
