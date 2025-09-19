import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import {
  db,
  inventory,
  inventoryTransactions,
  packages,
  appleVarieties,
  vendors,
  auditLog
} from 'db'
import { eq, and, desc, asc, like, or, isNull, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import {
  inventoryTransactionSchema,
  recordTransactionSchema,
  createInventoryItemSchema,
  inventoryListSchema,
  inventorySearchSchema,
  materialTypeEnum,
  type InventoryTransaction,
  type RecordTransactionInput
} from '../types/inventory'

// Event bus for audit logging
const eventBus = {
  publish: async (event: string, data: any, userId?: string) => {
    try {
      await db.insert(auditLog).values({
        tableName: event.split('.')[0],
        recordId: data.inventoryId || '',
        operation: event.split('.')[1],
        newData: data,
        changedBy: userId || null,
      })
    } catch (error) {
      console.error('Failed to publish audit log:', error)
    }
  }
}

// Helper function to validate material-specific transaction data
const validateTransactionData = (transaction: InventoryTransaction): void => {
  switch (transaction.materialType) {
    case 'apple':
      if (!transaction.appleVarietyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Apple variety ID is required for apple transactions'
        })
      }
      break
    case 'additive':
      if (!transaction.additiveType || !transaction.additiveName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Additive type and name are required for additive transactions'
        })
      }
      break
    case 'juice':
      if (!transaction.volumeL) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Volume is required for juice transactions'
        })
      }
      break
    case 'packaging':
      if (!transaction.packagingType || !transaction.packagingName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Packaging type and name are required for packaging transactions'
        })
      }
      break
  }
}

export const inventoryRouter = router({
  // List inventory items - accessible by both admin and operator
  list: createRbacProcedure('list', 'inventory')
    .input(inventoryListSchema)
    .query(async ({ input }) => {
      const { materialType, location, isActive, limit, offset } = input

      let query = db
        .select({
          id: inventory.id,
          packageId: inventory.packageId,
          currentBottleCount: inventory.currentBottleCount,
          reservedBottleCount: inventory.reservedBottleCount,
          materialType: inventory.materialType,
          metadata: inventory.metadata,
          location: inventory.location,
          notes: inventory.notes,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        })
        .from(inventory)

      // Apply filters
      const conditions = []

      if (materialType) {
        conditions.push(eq(inventory.materialType, materialType))
      }

      if (location) {
        conditions.push(like(inventory.location, `%${location}%`))
      }

      if (isActive) {
        conditions.push(isNull(inventory.deletedAt))
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      const inventoryItems = await query
        .orderBy(desc(inventory.createdAt))
        .limit(limit)
        .offset(offset)

      const totalCount = await db
        .select({ count: count() })
        .from(inventory)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      return {
        items: inventoryItems,
        pagination: {
          total: totalCount[0]?.count || 0,
          limit,
          offset,
          hasMore: (totalCount[0]?.count || 0) > offset + limit
        }
      }
    }),

  // Get inventory item by ID - accessible by both admin and operator
  getById: createRbacProcedure('read', 'inventory')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const inventoryItem = await db
        .select()
        .from(inventory)
        .where(and(
          eq(inventory.id, input.id),
          isNull(inventory.deletedAt)
        ))
        .limit(1)

      if (!inventoryItem.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory item not found'
        })
      }

      // Get transaction history
      const transactions = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.inventoryId, input.id))
        .orderBy(desc(inventoryTransactions.transactionDate))

      return {
        item: inventoryItem[0],
        transactions
      }
    }),

  // Search inventory items - accessible by both admin and operator
  search: createRbacProcedure('list', 'inventory')
    .input(inventorySearchSchema)
    .query(async ({ input }) => {
      const { query, materialTypes, limit } = input

      let searchQuery = db
        .select()
        .from(inventory)
        .where(
          and(
            or(
              like(inventory.notes, `%${query}%`),
              like(inventory.location, `%${query}%`)
            ),
            isNull(inventory.deletedAt),
            materialTypes?.length ?
              or(...materialTypes.map(type => eq(inventory.materialType, type))) :
              undefined
          )
        )
        .orderBy(desc(inventory.updatedAt))
        .limit(limit)

      const results = await searchQuery

      return {
        items: results,
        count: results.length
      }
    }),

  // Record inventory transaction - accessible by both admin and operator
  // Note: This endpoint only records transactions for existing inventory items
  // Creating new inventory items should be done through dedicated material-specific endpoints
  recordTransaction: createRbacProcedure('create', 'inventory')
    .input(z.object({
      inventoryId: z.string().uuid('Invalid inventory ID'),
      transactionType: z.enum(['purchase', 'transfer', 'adjustment', 'sale', 'waste']),
      quantityChange: z.number().int('Quantity change must be an integer'),
      transactionDate: z.date().default(() => new Date()),
      reason: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        try {
          // Validate the inventory item exists
          const existingItem = await tx
            .select()
            .from(inventory)
            .where(and(
              eq(inventory.id, input.inventoryId),
              isNull(inventory.deletedAt)
            ))
            .limit(1)

          if (!existingItem.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Inventory item not found'
            })
          }

          // Check if transaction would result in negative inventory
          const newCount = existingItem[0].currentBottleCount + input.quantityChange
          if (newCount < 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Transaction would result in negative inventory. Current: ${existingItem[0].currentBottleCount}, Change: ${input.quantityChange}`
            })
          }

          // Create the transaction record
          const newTransaction = await tx
            .insert(inventoryTransactions)
            .values({
              inventoryId: input.inventoryId,
              transactionType: input.transactionType,
              quantityChange: input.quantityChange,
              transactionDate: input.transactionDate,
              reason: input.reason,
              notes: input.notes,
            })
            .returning()

          // Update inventory count
          const updatedItem = await tx
            .update(inventory)
            .set({
              currentBottleCount: newCount,
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, input.inventoryId))
            .returning()

          // Publish audit event
          await eventBus.publish('inventory.transaction', {
            inventoryId: input.inventoryId,
            transactionId: newTransaction[0].id,
            materialType: existingItem[0].materialType,
            previousCount: existingItem[0].currentBottleCount,
            newCount: newCount,
            change: input.quantityChange,
            transactionType: input.transactionType,
          }, ctx.session?.user?.id)

          return {
            success: true,
            inventoryItem: updatedItem[0],
            transaction: newTransaction[0],
            message: `Inventory transaction recorded successfully. New count: ${newCount}`
          }

        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error recording inventory transaction:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to record inventory transaction'
          })
        }
      })
    }),

  // Get transaction history for an inventory item - accessible by both admin and operator
  getTransactionHistory: createRbacProcedure('read', 'inventory')
    .input(z.object({
      inventoryId: z.string().uuid(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ input }) => {
      const { inventoryId, limit, offset } = input

      const transactions = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.inventoryId, inventoryId))
        .orderBy(desc(inventoryTransactions.transactionDate))
        .limit(limit)
        .offset(offset)

      const totalCount = await db
        .select({ count: count() })
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.inventoryId, inventoryId))

      return {
        transactions,
        pagination: {
          total: totalCount[0]?.count || 0,
          limit,
          offset,
          hasMore: (totalCount[0]?.count || 0) > offset + limit
        }
      }
    }),

  // Get inventory summary by material type - accessible by both admin and operator
  getSummaryByMaterialType: createRbacProcedure('list', 'inventory')
    .query(async () => {
      const summary = await db
        .select({
          materialType: inventory.materialType,
          totalItems: count(),
          totalQuantity: count(inventory.currentBottleCount),
        })
        .from(inventory)
        .where(isNull(inventory.deletedAt))
        .groupBy(inventory.materialType)

      return {
        summary,
        totalItems: summary.reduce((acc, item) => acc + (item.totalItems || 0), 0)
      }
    }),
})