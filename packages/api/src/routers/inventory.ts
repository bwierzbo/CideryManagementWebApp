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
import { eq, and, desc, asc, like, or, isNull, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import {
  inventoryTransactionSchema,
  recordTransactionSchema,
  createInventoryItemSchema,
  createInventoryTransactionSchema,
  inventoryListSchema,
  inventorySearchSchema,
  materialTypeEnum,
  type InventoryTransaction,
  type RecordTransactionInput,
  type CreateInventoryTransactionInput
} from '../types/inventory'
import { InventoryService } from '../services/inventory'

// Note: Helper functions moved to InventoryService for better organization and reusability

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
        .select({ count: sql<number>`count(*)` })
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
  // Uses the comprehensive service layer for enhanced validation and business logic
  recordTransaction: createRbacProcedure('create', 'inventory')
    .input(recordTransactionSchema)
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.recordTransaction(input, ctx.session?.user?.id)
    }),

  // Create new inventory item with material-specific data - accessible by both admin and operator
  createInventoryItem: createRbacProcedure('create', 'inventory')
    .input(createInventoryTransactionSchema)
    .mutation(async ({ input, ctx }) => {
      // Convert the transaction schema to service parameters
      const createParams = {
        materialType: input.materialType,
        initialQuantity: input.quantityChange,
        metadata: {
          transactionData: input
        },
        location: (input as any).storageLocation || (input as any).location,
        notes: input.notes,
      }

      return await InventoryService.createInventoryItem(
        createParams,
        input,
        ctx.session?.user?.id
      )
    }),

  // Bulk transfer items between locations - accessible by both admin and operator
  bulkTransfer: createRbacProcedure('create', 'inventory')
    .input(z.object({
      inventoryIds: z.array(z.string().uuid()).min(1, 'At least one inventory ID required'),
      fromLocation: z.string().min(1, 'From location is required'),
      toLocation: z.string().min(1, 'To location is required'),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.bulkTransfer(
        input.inventoryIds,
        input.fromLocation,
        input.toLocation,
        input.reason,
        ctx.session?.user?.id
      )
    }),

  // Check stock levels for low inventory - accessible by both admin and operator
  checkStockLevels: createRbacProcedure('list', 'inventory')
    .input(z.object({
      materialType: materialTypeEnum.optional(),
      location: z.string().optional(),
      minimumThreshold: z.number().int().positive().default(10),
    }))
    .query(async ({ input }) => {
      return await InventoryService.checkStockLevels(
        input.materialType,
        input.location,
        input.minimumThreshold
      )
    }),

  // Reserve inventory for upcoming operations - accessible by both admin and operator
  reserveInventory: createRbacProcedure('create', 'inventory')
    .input(z.object({
      inventoryId: z.string().uuid('Invalid inventory ID'),
      reserveQuantity: z.number().int().positive('Reserve quantity must be positive'),
      reason: z.string().min(1, 'Reason is required for reservations'),
    }))
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.reserveInventory(
        input.inventoryId,
        input.reserveQuantity,
        input.reason,
        ctx.session?.user?.id
      )
    }),

  // Release reserved inventory - accessible by both admin and operator
  releaseReservation: createRbacProcedure('create', 'inventory')
    .input(z.object({
      inventoryId: z.string().uuid('Invalid inventory ID'),
      releaseQuantity: z.number().int().positive('Release quantity must be positive'),
      reason: z.string().min(1, 'Reason is required for reservation releases'),
    }))
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.releaseReservation(
        input.inventoryId,
        input.releaseQuantity,
        input.reason,
        ctx.session?.user?.id
      )
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
        .select({ count: sql<number>`count(*)` })
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
          totalItems: sql<number>`count(*)`,
          totalQuantity: sql<number>`sum(${inventory.currentBottleCount})`,
        })
        .from(inventory)
        .where(isNull(inventory.deletedAt))
        .groupBy(inventory.materialType)

      return {
        summary,
        totalItems: summary.reduce((acc, item) => acc + (item.totalItems || 0), 0)
      }
    }),

  // Get transaction summary for inventory items - accessible by both admin and operator
  getTransactionSummary: createRbacProcedure('read', 'inventory')
    .input(z.object({
      inventoryIds: z.array(z.string().uuid()).min(1, 'At least one inventory ID required'),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input }) => {
      return await InventoryService.getTransactionSummary(
        input.inventoryIds,
        input.startDate,
        input.endDate
      )
    }),
})