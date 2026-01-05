import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db, workers, activityLaborAssignments } from "db";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";

export const workersRouter = router({
  // List all workers (for dropdown in forms)
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
      }).optional(),
    )
    .query(async ({ input }) => {
      const includeInactive = input?.includeInactive ?? false;

      const whereConditions = [isNull(workers.deletedAt)];
      if (!includeInactive) {
        whereConditions.push(eq(workers.isActive, true));
      }

      const workerList = await db
        .select()
        .from(workers)
        .where(and(...whereConditions))
        .orderBy(asc(workers.sortOrder), asc(workers.name));

      return { workers: workerList };
    }),

  // Get a single worker by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [worker] = await db
        .select()
        .from(workers)
        .where(eq(workers.id, input.id))
        .limit(1);

      if (!worker) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Worker not found",
        });
      }

      return { worker };
    }),

  // Create a new worker (admin only)
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        hourlyRate: z.number().positive("Hourly rate must be positive").default(20),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        sortOrder: z.number().int().default(0),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [newWorker] = await db
        .insert(workers)
        .values({
          name: input.name,
          hourlyRate: input.hourlyRate.toString(),
          email: input.email || null,
          phone: input.phone || null,
          sortOrder: input.sortOrder,
          notes: input.notes || null,
        })
        .returning();

      return { worker: newWorker };
    }),

  // Update a worker (admin only)
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        hourlyRate: z.number().positive().optional(),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        sortOrder: z.number().int().optional(),
        notes: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      // Check if worker exists
      const [existing] = await db
        .select()
        .from(workers)
        .where(eq(workers.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Worker not found",
        });
      }

      // Build update object
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.hourlyRate !== undefined) updateData.hourlyRate = updates.hourlyRate.toString();
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      const [updated] = await db
        .update(workers)
        .set(updateData)
        .where(eq(workers.id, id))
        .returning();

      return { worker: updated };
    }),

  // Soft delete a worker (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select()
        .from(workers)
        .where(eq(workers.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Worker not found",
        });
      }

      // Soft delete - set deletedAt and isActive
      const [deleted] = await db
        .update(workers)
        .set({
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(workers.id, input.id))
        .returning();

      return { worker: deleted, success: true };
    }),

  // Restore a soft-deleted worker (admin only)
  restore: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [existing] = await db
        .select()
        .from(workers)
        .where(eq(workers.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Worker not found",
        });
      }

      const [restored] = await db
        .update(workers)
        .set({
          deletedAt: null,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(workers.id, input.id))
        .returning();

      return { worker: restored, success: true };
    }),

  // Get worker rates for a list of worker IDs (used when creating labor assignments)
  getRates: protectedProcedure
    .input(z.object({ workerIds: z.array(z.string().uuid()) }))
    .query(async ({ input }) => {
      if (input.workerIds.length === 0) {
        return { rates: {} };
      }

      const workerList = await db
        .select({
          id: workers.id,
          name: workers.name,
          hourlyRate: workers.hourlyRate,
        })
        .from(workers)
        .where(inArray(workers.id, input.workerIds));

      const rates = Object.fromEntries(
        workerList.map((w) => [w.id, {
          name: w.name,
          hourlyRate: parseFloat(w.hourlyRate ?? "20.00"),
        }])
      );

      return { rates };
    }),
});
