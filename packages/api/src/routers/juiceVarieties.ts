import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { db, juiceVarieties, vendorJuiceVarieties } from 'db'
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm'

export const juiceVarietiesRouter = router({
  // List all juice varieties with pagination and search
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
      sortBy: z.enum(['name', 'createdAt']).default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
      includeInactive: z.boolean().default(false)
    }))
    .query(async ({ input }) => {
      const { limit, offset, search, sortBy, sortOrder, includeInactive } = input

      // Build where conditions
      const whereConditions = [
        isNull(juiceVarieties.deletedAt)
      ]

      if (!includeInactive) {
        whereConditions.push(eq(juiceVarieties.isActive, true))
      }

      if (search) {
        whereConditions.push(
          sql`${juiceVarieties.name} ILIKE ${'%' + search + '%'}`
        )
      }

      // Build order by
      const orderByClause = sortOrder === 'asc'
        ? asc(juiceVarieties[sortBy])
        : desc(juiceVarieties[sortBy])

      // Get varieties with pagination
      const varieties = await db
        .select()
        .from(juiceVarieties)
        .where(and(...whereConditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset)

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(juiceVarieties)
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

  // Get single juice variety by ID
  get: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .query(async ({ input }) => {
      const { id } = input

      const variety = await db
        .select()
        .from(juiceVarieties)
        .where(and(
          eq(juiceVarieties.id, id),
          isNull(juiceVarieties.deletedAt)
        ))
        .limit(1)

      if (!variety.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Juice variety not found'
        })
      }

      return variety[0]
    }),

  // Create new juice variety
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, 'Name is required')
    }))
    .mutation(async ({ input }) => {
      const { name } = input

      // Check if variety with same name already exists
      const existing = await db
        .select()
        .from(juiceVarieties)
        .where(and(
          eq(juiceVarieties.name, name),
          isNull(juiceVarieties.deletedAt)
        ))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A juice variety with this name already exists'
        })
      }

      const result = await db
        .insert(juiceVarieties)
        .values({
          name,
          isActive: true
        })
        .returning()

      return result[0]
    }),

  // Update juice variety
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1, 'Name is required'),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      const { id, name, isActive } = input

      // Check if variety exists
      const existing = await db
        .select()
        .from(juiceVarieties)
        .where(and(
          eq(juiceVarieties.id, id),
          isNull(juiceVarieties.deletedAt)
        ))
        .limit(1)

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Juice variety not found'
        })
      }

      // Check if another variety with same name already exists
      const nameConflict = await db
        .select()
        .from(juiceVarieties)
        .where(and(
          eq(juiceVarieties.name, name),
          sql`${juiceVarieties.id} != ${id}`,
          isNull(juiceVarieties.deletedAt)
        ))
        .limit(1)

      if (nameConflict.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A juice variety with this name already exists'
        })
      }

      const result = await db
        .update(juiceVarieties)
        .set({
          name,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(juiceVarieties.id, id))
        .returning()

      return result[0]
    }),

  // Delete juice variety (soft delete)
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const { id } = input

      // Check if variety exists
      const existing = await db
        .select()
        .from(juiceVarieties)
        .where(and(
          eq(juiceVarieties.id, id),
          isNull(juiceVarieties.deletedAt)
        ))
        .limit(1)

      if (!existing.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Juice variety not found'
        })
      }

      // Soft delete the variety
      await db
        .update(juiceVarieties)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(juiceVarieties.id, id))

      return { message: 'Juice variety deleted successfully' }
    }),

  // Get vendor-juice variety links for a specific vendor
  getVendorLinks: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid()
    }))
    .query(async ({ input }) => {
      const { vendorId } = input

      const links = await db
        .select({
          id: vendorJuiceVarieties.id,
          vendorId: vendorJuiceVarieties.vendorId,
          varietyId: vendorJuiceVarieties.varietyId,
          notes: vendorJuiceVarieties.notes,
          createdAt: vendorJuiceVarieties.createdAt,
          variety: {
            id: juiceVarieties.id,
            name: juiceVarieties.name,
            isActive: juiceVarieties.isActive
          }
        })
        .from(vendorJuiceVarieties)
        .leftJoin(juiceVarieties, eq(vendorJuiceVarieties.varietyId, juiceVarieties.id))
        .where(and(
          eq(vendorJuiceVarieties.vendorId, vendorId),
          isNull(vendorJuiceVarieties.deletedAt),
          isNull(juiceVarieties.deletedAt)
        ))
        .orderBy(asc(juiceVarieties.name))

      return links
    }),

  // Link vendor to juice variety
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
        .from(vendorJuiceVarieties)
        .where(and(
          eq(vendorJuiceVarieties.vendorId, vendorId),
          eq(vendorJuiceVarieties.varietyId, varietyId),
          isNull(vendorJuiceVarieties.deletedAt)
        ))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This vendor is already linked to this juice variety'
        })
      }

      const result = await db
        .insert(vendorJuiceVarieties)
        .values({
          vendorId,
          varietyId,
          notes
        })
        .returning()

      return result[0]
    }),

  // Unlink vendor from juice variety
  unlinkVendor: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      varietyId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      const { vendorId, varietyId } = input

      // Soft delete the link
      await db
        .update(vendorJuiceVarieties)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(vendorJuiceVarieties.vendorId, vendorId),
          eq(vendorJuiceVarieties.varietyId, varietyId)
        ))

      return { message: 'Vendor unlinked from juice variety successfully' }
    })
})