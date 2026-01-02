import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db, barrelOriginTypes } from "db";
import { eq, and, asc, sql } from "drizzle-orm";

export const barrelOriginTypesRouter = router({
  // List all barrel origin types (for dropdown)
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
      }).optional(),
    )
    .query(async ({ input }) => {
      const includeInactive = input?.includeInactive ?? false;

      const whereConditions = [];
      if (!includeInactive) {
        whereConditions.push(eq(barrelOriginTypes.isActive, true));
      }

      const types = await db
        .select()
        .from(barrelOriginTypes)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(asc(barrelOriginTypes.sortOrder), asc(barrelOriginTypes.name));

      return { types };
    }),

  // Create a new barrel origin type (admin only)
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9_]+$/, "Slug must be lowercase with underscores"),
        description: z.string().optional(),
        sortOrder: z.number().int().default(50),
      }),
    )
    .mutation(async ({ input }) => {
      // Check if slug already exists
      const existing = await db
        .select()
        .from(barrelOriginTypes)
        .where(eq(barrelOriginTypes.slug, input.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A barrel origin type with this slug already exists",
        });
      }

      const [newType] = await db
        .insert(barrelOriginTypes)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          sortOrder: input.sortOrder,
          isSystem: false,
        })
        .returning();

      return { type: newType };
    }),

  // Update a barrel origin type (admin only)
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      // Get existing type
      const [existing] = await db
        .select()
        .from(barrelOriginTypes)
        .where(eq(barrelOriginTypes.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Barrel origin type not found",
        });
      }

      const [updated] = await db
        .update(barrelOriginTypes)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(barrelOriginTypes.id, id))
        .returning();

      return { type: updated };
    }),

  // Delete a barrel origin type (admin only, non-system types only)
  delete: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id } = input;

      // Get existing type
      const [existing] = await db
        .select()
        .from(barrelOriginTypes)
        .where(eq(barrelOriginTypes.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Barrel origin type not found",
        });
      }

      if (existing.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete system barrel origin types. You can deactivate them instead.",
        });
      }

      await db
        .delete(barrelOriginTypes)
        .where(eq(barrelOriginTypes.id, id));

      return { success: true };
    }),
});
