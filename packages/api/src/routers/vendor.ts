import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import { db, vendors, auditLog } from 'db'
import { eq, ilike, or, and, asc, desc, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// Schema for vendor creation/update
const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
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
    }).optional().default({}))
    .query(async ({ input }) => {
      const { search, limit, offset, sortBy, sortOrder, includeInactive } = input

      // Build where condition
      let whereCondition = includeInactive ? undefined : eq(vendors.isActive, true)

      if (search) {
        const searchCondition = or(
          ilike(vendors.name, `%${search}%`),
          ilike(vendors.contactEmail, `%${search}%`),
          ilike(vendors.contactPhone, `%${search}%`),
          ilike(vendors.address, `%${search}%`)
        )
        whereCondition = whereCondition
          ? and(whereCondition, searchCondition)
          : searchCondition
      }

      // Build order by
      const orderByFn = sortOrder === 'asc' ? asc : desc
      const orderByField = vendors[sortBy as keyof typeof vendors]

      // Get total count
      const totalCountResult = await db
        .select({ count: count() })
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
})