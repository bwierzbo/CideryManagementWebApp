import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import { db, vendors, auditLog, vendorVarieties, vendorAdditiveVarieties, vendorJuiceVarieties, vendorPackagingVarieties } from 'db'
import { eq, ilike, or, and, asc, desc, sql, like, exists } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// Schema for vendor creation/update
const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactInfo: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  isActive: z.boolean().default(true),
})

const vendorUpdateSchema = vendorSchema.partial().extend({
  id: z.string().uuid(),
})

// Event bus for audit logging
const eventBus = {
  publish: async (event: string, data: any, userId?: string) => {
    try {
      await db.insert(auditLog).values({
        tableName: event.split('.')[0],
        recordId: data.vendorId || '',
        operation: event.split('.')[1],
        newData: data,
        changedBy: userId || null,
      })
    } catch (error) {
      console.error('Failed to publish audit log:', error)
    }
  }
}

export const vendorRouter = router({
  // List vendors with search and pagination - accessible by both admin and operator
  list: createRbacProcedure('list', 'vendor')
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
      sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
      includeInactive: z.boolean().default(false),
    }).default({
      limit: 50,
      offset: 0,
      sortBy: 'name',
      sortOrder: 'asc',
      includeInactive: false,
    }))
    .query(async ({ input }) => {
      const { search, limit, offset, sortBy, sortOrder, includeInactive } = input

      console.log('Vendor list query input:', { search, limit, offset, sortBy, sortOrder, includeInactive })

      // Build where conditions array
      const whereConditions = []

      if (!includeInactive) {
        whereConditions.push(eq(vendors.isActive, true))
      }

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        console.log('Applying search filter with term:', searchTerm)

        // Use ilike for case-insensitive search
        whereConditions.push(
          sql`LOWER(${vendors.name}) LIKE LOWER(${searchTerm})`
        )
      }

      const whereCondition = whereConditions.length > 0 ? and(...whereConditions) : undefined

      console.log('Where conditions array:', whereConditions)
      console.log('Final where condition:', whereCondition)

      // Build order by
      const orderByFn = sortOrder === 'asc' ? asc : desc
      let orderByField
      switch (sortBy) {
        case 'name':
          orderByField = vendors.name
          break
        case 'createdAt':
          orderByField = vendors.createdAt
          break
        case 'updatedAt':
          orderByField = vendors.updatedAt
          break
        default:
          orderByField = vendors.name
      }

      // Get total count
      const totalCountResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(vendors)
        .where(whereCondition)

      const totalCount = totalCountResult[0]?.count ?? 0

      // Get vendors with pagination
      const vendorList = await db
        .select()
        .from(vendors)
        .where(whereCondition)
        .orderBy(orderByFn(orderByField))
        .limit(limit)
        .offset(offset)

      console.log(`Query returned ${vendorList.length} vendors out of ${totalCount} total`)
      console.log('Where condition:', whereCondition)

      return {
        vendors: vendorList,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      }
    }),

  // Get vendor by ID - accessible by both admin and operator
  getById: createRbacProcedure('read', 'vendor')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const vendor = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, input.id))
        .limit(1)

      if (!vendor.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }

      return vendor[0]
    }),

  // Create vendor - admin only
  create: createRbacProcedure('create', 'vendor')
    .input(vendorSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const newVendor = await db
          .insert(vendors)
          .values({
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()

        // Publish audit log
        await eventBus.publish('vendor.created', {
          vendorId: newVendor[0].id,
          vendorName: newVendor[0].name,
          data: input,
        }, ctx.session?.user?.id)

        return {
          success: true,
          vendor: newVendor[0],
          message: `Vendor "${input.name}" created successfully`,
        }
      } catch (error) {
        console.error('Error creating vendor:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create vendor'
        })
      }
    }),

  // Update vendor - admin only
  update: createRbacProcedure('update', 'vendor')
    .input(vendorUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input

      try {
        // Check if vendor exists
        const existing = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, id))
          .limit(1)

        if (!existing.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Vendor not found'
          })
        }

        const updatedVendor = await db
          .update(vendors)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, id))
          .returning()

        // Publish audit log
        await eventBus.publish('vendor.updated', {
          vendorId: id,
          vendorName: updatedVendor[0].name,
          previousData: existing[0],
          newData: updateData,
        }, ctx.session?.user?.id)

        return {
          success: true,
          vendor: updatedVendor[0],
          message: `Vendor "${updatedVendor[0].name}" updated successfully`,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error updating vendor:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update vendor'
        })
      }
    }),

  // Delete vendor (soft delete) - admin only
  delete: createRbacProcedure('delete', 'vendor')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Check if vendor exists
        const existing = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, input.id))
          .limit(1)

        if (!existing.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Vendor not found'
          })
        }

        // Soft delete by setting isActive to false
        const deletedVendor = await db
          .update(vendors)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, input.id))
          .returning()

        // Publish audit log
        await eventBus.publish('vendor.deleted', {
          vendorId: input.id,
          vendorName: existing[0].name,
          data: existing[0],
        }, ctx.session?.user?.id)

        return {
          success: true,
          message: `Vendor "${existing[0].name}" deleted successfully`,
          vendor: deletedVendor[0],
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error deleting vendor:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete vendor'
        })
      }
    }),

  // Restore deleted vendor - admin only
  restore: createRbacProcedure('update', 'vendor')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const existing = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, input.id))
          .limit(1)

        if (!existing.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Vendor not found'
          })
        }

        if (existing[0].isActive) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Vendor is already active'
          })
        }

        const restoredVendor = await db
          .update(vendors)
          .set({
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, input.id))
          .returning()

        // Publish audit log
        await eventBus.publish('vendor.restored', {
          vendorId: input.id,
          vendorName: existing[0].name,
        }, ctx.session?.user?.id)

        return {
          success: true,
          message: `Vendor "${existing[0].name}" restored successfully`,
          vendor: restoredVendor[0],
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error restoring vendor:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to restore vendor'
        })
      }
    }),

  // List vendors by variety type - accessible by both admin and operator
  listByVarietyType: createRbacProcedure('list', 'vendor')
    .input(z.object({
      varietyType: z.enum(['baseFruit', 'additive', 'juice', 'packaging']),
      includeInactive: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const { varietyType, includeInactive } = input

      // Build base query
      let query = db
        .select({
          id: vendors.id,
          name: vendors.name,
          contactInfo: vendors.contactInfo,
          isActive: vendors.isActive,
          createdAt: vendors.createdAt,
          updatedAt: vendors.updatedAt,
        })
        .from(vendors)

      // Add variety type filter using EXISTS subqueries
      let whereConditions = []

      if (!includeInactive) {
        whereConditions.push(eq(vendors.isActive, true))
      }

      // Add variety type specific filter
      switch (varietyType) {
        case 'baseFruit':
          whereConditions.push(
            exists(
              db
                .select({ vendorId: vendorVarieties.vendorId })
                .from(vendorVarieties)
                .where(eq(vendorVarieties.vendorId, vendors.id))
            )
          )
          break
        case 'additive':
          whereConditions.push(
            exists(
              db
                .select({ vendorId: vendorAdditiveVarieties.vendorId })
                .from(vendorAdditiveVarieties)
                .where(eq(vendorAdditiveVarieties.vendorId, vendors.id))
            )
          )
          break
        case 'juice':
          whereConditions.push(
            exists(
              db
                .select({ vendorId: vendorJuiceVarieties.vendorId })
                .from(vendorJuiceVarieties)
                .where(eq(vendorJuiceVarieties.vendorId, vendors.id))
            )
          )
          break
        case 'packaging':
          whereConditions.push(
            exists(
              db
                .select({ vendorId: vendorPackagingVarieties.vendorId })
                .from(vendorPackagingVarieties)
                .where(eq(vendorPackagingVarieties.vendorId, vendors.id))
            )
          )
          break
      }

      const whereCondition = whereConditions.length > 0 ? and(...whereConditions) : undefined

      const results = await query
        .where(whereCondition)
        .orderBy(asc(vendors.name))

      return {
        vendors: results,
        total: results.length,
      }
    }),
})