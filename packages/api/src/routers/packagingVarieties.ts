import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { db, packagingVarieties, vendorPackagingVarieties } from 'db'
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm'
import { packagingItemTypeSchema } from 'lib'

export const packagingVarietiesRouter = router({
  // List all packaging varieties with pagination and search
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
      sortBy: z.enum(['name', 'itemType', 'createdAt']).default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
      includeInactive: z.boolean().default(false)
    }))
    .query(async ({ input }) => {
      const { limit, offset, search, sortBy, sortOrder, includeInactive } = input

      // Build where conditions
      const whereConditions = [
        isNull(packagingVarieties.deletedAt)
      ]

      if (!includeInactive) {
        whereConditions.push(eq(packagingVarieties.isActive, true))
      }

      if (search) {
        whereConditions.push(
          sql`${packagingVarieties.name} ILIKE ${'%' + search + '%'} OR CAST(${packagingVarieties.itemType} AS TEXT) ILIKE ${'%' + search + '%'}`
        )
      }

      // Build order by
      const orderByClause = sortOrder === 'asc'
        ? asc(packagingVarieties[sortBy])
        : desc(packagingVarieties[sortBy])

      // Get varieties with pagination
      const varieties = await db
        .select()
        .from(packagingVarieties)
        .where(and(...whereConditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset)

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(packagingVarieties)
        .where(and(...whereConditions))

      const total = totalResult[0]?.count || 0

      return {
        varieties,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    }),

  // Get single packaging variety by ID
  get: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .query(async ({ input }) => {
      const { id } = input

      const variety = await db
        .select()
        .from(packagingVarieties)
        .where(and(
          eq(packagingVarieties.id, id),
          isNull(packagingVarieties.deletedAt)
        ))
        .limit(1)

      if (!variety.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Packaging variety not found'
        })
      }

      return variety[0]
    }),

  // Create new packaging variety
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, 'Name is required'),
      itemType: packagingItemTypeSchema
    }))
    .mutation(async ({ input }) => {
      const { name, itemType } = input

      // Check if variety with same name already exists
      const existing = await db
        .select()
        .from(packagingVarieties)
        .where(and(
          eq(packagingVarieties.name, name),
          isNull(packagingVarieties.deletedAt)
        ))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A packaging variety with this name already exists'
        })
      }

      const result = await db
        .insert(packagingVarieties)
        .values({
          name,
          itemType,
          isActive: true
        })
        .returning()

      return result[0]
    }),

  // Update packaging variety
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1, 'Name is required'),
      itemType: packagingItemTypeSchema,
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      const { id, name, itemType, isActive } = input

      // Check if variety exists
      const existing = await db
        .select()
        .from(packagingVarieties)
        .where(and(
          eq(packagingVarieties.id, id),
          isNull(packagingVarieties.deletedAt)
        ))
        .limit(1)

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Packaging variety not found'
        })
      }

      // Check if another variety with same name already exists
      const nameConflict = await db
        .select()
        .from(packagingVarieties)
        .where(and(
          eq(packagingVarieties.name, name),
          sql`${packagingVarieties.id} != ${id}`,
          isNull(packagingVarieties.deletedAt)
        ))
        .limit(1)

      if (nameConflict.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A packaging variety with this name already exists'
        })
      }

      const result = await db
        .update(packagingVarieties)
        .set({
          name,
          itemType,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(packagingVarieties.id, id))
        .returning()

      return result[0]
    }),

  // Delete packaging variety (soft delete)
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const { id } = input

      // Check if variety exists
      const existing = await db
        .select()
        .from(packagingVarieties)
        .where(and(
          eq(packagingVarieties.id, id),
          isNull(packagingVarieties.deletedAt)
        ))
        .limit(1)

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Packaging variety not found'
        })
      }

      // Soft delete the variety
      await db
        .update(packagingVarieties)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(packagingVarieties.id, id))

      return { message: 'Packaging variety deleted successfully' }
    }),

  // Get vendor-packaging variety links for a specific vendor
  getVendorLinks: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid()
    }))
    .query(async ({ input }) => {
      const { vendorId } = input

      const links = await db
        .select({
          id: vendorPackagingVarieties.id,
          vendorId: vendorPackagingVarieties.vendorId,
          varietyId: vendorPackagingVarieties.varietyId,
          notes: vendorPackagingVarieties.notes,
          createdAt: vendorPackagingVarieties.createdAt,
          variety: {
            id: packagingVarieties.id,
            name: packagingVarieties.name,
            itemType: packagingVarieties.itemType,
            isActive: packagingVarieties.isActive
          }
        })
        .from(vendorPackagingVarieties)
        .leftJoin(packagingVarieties, eq(vendorPackagingVarieties.varietyId, packagingVarieties.id))
        .where(and(
          eq(vendorPackagingVarieties.vendorId, vendorId),
          isNull(vendorPackagingVarieties.deletedAt),
          isNull(packagingVarieties.deletedAt)
        ))
        .orderBy(asc(packagingVarieties.name))

      return links
    }),

  // Link vendor to packaging variety
  linkVendor: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      varietyId: z.string().uuid(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const { vendorId, varietyId, notes } = input

      // Check if link already exists
      const existing = await db
        .select()
        .from(vendorPackagingVarieties)
        .where(and(
          eq(vendorPackagingVarieties.vendorId, vendorId),
          eq(vendorPackagingVarieties.varietyId, varietyId),
          isNull(vendorPackagingVarieties.deletedAt)
        ))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This vendor is already linked to this packaging variety'
        })
      }

      const result = await db
        .insert(vendorPackagingVarieties)
        .values({
          vendorId,
          varietyId,
          notes
        })
        .returning()

      return result[0]
    }),

  // Unlink vendor from packaging variety
  unlinkVendor: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      varietyId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const { vendorId, varietyId } = input

      // Soft delete the link
      await db
        .update(vendorPackagingVarieties)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(vendorPackagingVarieties.vendorId, vendorId),
          eq(vendorPackagingVarieties.varietyId, varietyId)
        ))

      return { message: 'Vendor unlinked from packaging variety successfully' }
    })
})