import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db, additiveVarieties, vendorAdditiveVarieties } from "db";
import { eq, and, isNull, desc, asc, sql } from "drizzle-orm";
import { additiveTypeSchema } from "lib";

export const additiveVarietiesRouter = router({
  // List all additive varieties with pagination and search
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        sortBy: z.enum(["name", "itemType", "createdAt"]).default("name"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
        includeInactive: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const { limit, offset, search, sortBy, sortOrder, includeInactive } =
        input;

      // Build where conditions
      const whereConditions = [isNull(additiveVarieties.deletedAt)];

      if (!includeInactive) {
        whereConditions.push(eq(additiveVarieties.isActive, true));
      }

      if (search) {
        whereConditions.push(
          sql`${additiveVarieties.name} ILIKE ${"%" + search + "%"} OR ${additiveVarieties.itemType} ILIKE ${"%" + search + "%"}`,
        );
      }

      // Build order by
      const orderByClause =
        sortOrder === "asc"
          ? asc(additiveVarieties[sortBy])
          : desc(additiveVarieties[sortBy]);

      // Get varieties with pagination
      const varieties = await db
        .select()
        .from(additiveVarieties)
        .where(and(...whereConditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(additiveVarieties)
        .where(and(...whereConditions));

      const total = totalResult[0]?.count || 0;

      return {
        varieties,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    }),

  // Get single additive variety by ID
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { id } = input;

      const variety = await db
        .select()
        .from(additiveVarieties)
        .where(
          and(
            eq(additiveVarieties.id, id),
            isNull(additiveVarieties.deletedAt),
          ),
        )
        .limit(1);

      if (!variety.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Additive variety not found",
        });
      }

      return variety[0];
    }),

  // Create new additive variety
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        itemType: additiveTypeSchema,
        labelImpact: z.boolean().default(false),
        labelImpactNotes: z.string().optional(),
        allergensVegan: z.boolean().default(false),
        allergensVeganNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const {
        name,
        itemType,
        labelImpact,
        labelImpactNotes,
        allergensVegan,
        allergensVeganNotes,
      } = input;

      // Check if variety with same name already exists
      const existing = await db
        .select()
        .from(additiveVarieties)
        .where(
          and(
            eq(additiveVarieties.name, name),
            isNull(additiveVarieties.deletedAt),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An additive variety with this name already exists",
        });
      }

      const result = await db
        .insert(additiveVarieties)
        .values({
          name,
          itemType,
          isActive: true,
          labelImpact,
          labelImpactNotes,
          allergensVegan,
          allergensVeganNotes,
        })
        .returning();

      return result[0];
    }),

  // Update additive variety
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "Name is required"),
        itemType: additiveTypeSchema,
        isActive: z.boolean().default(true),
        labelImpact: z.boolean().default(false),
        labelImpactNotes: z.string().optional(),
        allergensVegan: z.boolean().default(false),
        allergensVeganNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const {
        id,
        name,
        itemType,
        isActive,
        labelImpact,
        labelImpactNotes,
        allergensVegan,
        allergensVeganNotes,
      } = input;

      // Check if variety exists
      const existing = await db
        .select()
        .from(additiveVarieties)
        .where(
          and(
            eq(additiveVarieties.id, id),
            isNull(additiveVarieties.deletedAt),
          ),
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Additive variety not found",
        });
      }

      // Check if another variety with same name already exists
      const nameConflict = await db
        .select()
        .from(additiveVarieties)
        .where(
          and(
            eq(additiveVarieties.name, name),
            sql`${additiveVarieties.id} != ${id}`,
            isNull(additiveVarieties.deletedAt),
          ),
        )
        .limit(1);

      if (nameConflict.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An additive variety with this name already exists",
        });
      }

      const result = await db
        .update(additiveVarieties)
        .set({
          name,
          itemType,
          isActive,
          labelImpact,
          labelImpactNotes,
          allergensVegan,
          allergensVeganNotes,
          updatedAt: new Date(),
        })
        .where(eq(additiveVarieties.id, id))
        .returning();

      return result[0];
    }),

  // Delete additive variety (soft delete)
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id } = input;

      // Check if variety exists
      const existing = await db
        .select()
        .from(additiveVarieties)
        .where(
          and(
            eq(additiveVarieties.id, id),
            isNull(additiveVarieties.deletedAt),
          ),
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Additive variety not found",
        });
      }

      // Soft delete the variety
      await db
        .update(additiveVarieties)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(additiveVarieties.id, id));

      return { message: "Additive variety deleted successfully" };
    }),

  // Get vendor-additive variety links for a specific vendor
  getVendorLinks: protectedProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { vendorId } = input;

      const links = await db
        .select({
          id: vendorAdditiveVarieties.id,
          vendorId: vendorAdditiveVarieties.vendorId,
          varietyId: vendorAdditiveVarieties.varietyId,
          notes: vendorAdditiveVarieties.notes,
          createdAt: vendorAdditiveVarieties.createdAt,
          variety: {
            id: additiveVarieties.id,
            name: additiveVarieties.name,
            itemType: additiveVarieties.itemType,
            isActive: additiveVarieties.isActive,
          },
        })
        .from(vendorAdditiveVarieties)
        .leftJoin(
          additiveVarieties,
          eq(vendorAdditiveVarieties.varietyId, additiveVarieties.id),
        )
        .where(
          and(
            eq(vendorAdditiveVarieties.vendorId, vendorId),
            isNull(vendorAdditiveVarieties.deletedAt),
            isNull(additiveVarieties.deletedAt),
          ),
        )
        .orderBy(asc(additiveVarieties.name));

      return links;
    }),

  // Link vendor to additive variety
  linkVendor: protectedProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
        varietyId: z.string().uuid(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { vendorId, varietyId, notes } = input;

      // Check if link already exists (including soft-deleted ones)
      const existing = await db
        .select()
        .from(vendorAdditiveVarieties)
        .where(
          and(
            eq(vendorAdditiveVarieties.vendorId, vendorId),
            eq(vendorAdditiveVarieties.varietyId, varietyId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // If link exists but is deleted, restore it
        if (existing[0].deletedAt) {
          const result = await db
            .update(vendorAdditiveVarieties)
            .set({
              notes,
              deletedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(vendorAdditiveVarieties.id, existing[0].id))
            .returning();

          return result[0];
        } else {
          // If link exists and is active, throw error
          throw new TRPCError({
            code: "CONFLICT",
            message: "This vendor is already linked to this additive variety",
          });
        }
      }

      // Create new link if none exists
      const result = await db
        .insert(vendorAdditiveVarieties)
        .values({
          vendorId,
          varietyId,
          notes,
        })
        .returning();

      return result[0];
    }),

  // Unlink vendor from additive variety
  unlinkVendor: protectedProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
        varietyId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { vendorId, varietyId } = input;

      // Soft delete the link
      await db
        .update(vendorAdditiveVarieties)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorAdditiveVarieties.vendorId, vendorId),
            eq(vendorAdditiveVarieties.varietyId, varietyId),
          ),
        );

      return { message: "Vendor unlinked from additive variety successfully" };
    }),
});
