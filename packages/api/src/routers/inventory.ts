import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import {
  db,
  inventory,
  inventoryTransactions,
  packages,
  appleVarieties,
  vendors,
  auditLog,
  basefruitPurchases,
  basefruitPurchaseItems,
  baseFruitVarieties,
  additivePurchases,
  additivePurchaseItems,
  juicePurchases,
  juicePurchaseItems,
  packagingPurchases,
  packagingPurchaseItems
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
      // TODO: Temporarily show purchase items as inventory until proper inventory system is ready
      try {
        const { limit = 50, offset = 0 } = input

        // Get all purchase items as unified inventory

        // Base Fruit purchases
        const basefruitItems = await db
          .select({
            id: sql<string>`CONCAT('basefruit-', ${basefruitPurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${basefruitPurchaseItems.originalQuantity} AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`0`,
            materialType: sql<string>`'apple'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${basefruitPurchases.id},
              'vendorName', ${vendors.name},
              'varietyName', ${baseFruitVarieties.name},
              'harvestDate', ${basefruitPurchaseItems.harvestDate},
              'purchaseDate', ${basefruitPurchases.purchaseDate},
              'unit', ${basefruitPurchaseItems.originalUnit}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: basefruitPurchaseItems.notes,
            createdAt: basefruitPurchases.purchaseDate,
            updatedAt: basefruitPurchases.updatedAt
          })
          .from(basefruitPurchaseItems)
          .leftJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .leftJoin(baseFruitVarieties, eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id))
          .where(and(
            isNull(basefruitPurchaseItems.deletedAt),
            eq(basefruitPurchaseItems.isDepleted, false)
          ))

        // Additive purchases
        const additiveItems = await db
          .select({
            id: sql<string>`CONCAT('additive-', ${additivePurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${additivePurchaseItems.quantity} AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`0`,
            materialType: sql<string>`'additive'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${additivePurchases.id},
              'vendorName', ${vendors.name},
              'additiveType', ${additivePurchaseItems.additiveType},
              'brandManufacturer', ${additivePurchaseItems.brandManufacturer},
              'productName', ${additivePurchaseItems.productName},
              'unit', ${additivePurchaseItems.unit}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: additivePurchaseItems.notes,
            createdAt: additivePurchases.purchaseDate,
            updatedAt: additivePurchases.updatedAt
          })
          .from(additivePurchaseItems)
          .leftJoin(additivePurchases, eq(additivePurchaseItems.purchaseId, additivePurchases.id))
          .leftJoin(vendors, eq(additivePurchases.vendorId, vendors.id))
          .where(isNull(additivePurchaseItems.deletedAt))

        // Juice purchases
        const juiceItems = await db
          .select({
            id: sql<string>`CONCAT('juice-', ${juicePurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${juicePurchaseItems.volumeL} AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`0`,
            materialType: sql<string>`'juice'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${juicePurchases.id},
              'vendorName', ${vendors.name},
              'juiceType', ${juicePurchaseItems.juiceType},
              'varietyName', ${juicePurchaseItems.varietyName},
              'brix', ${juicePurchaseItems.brix},
              'containerType', ${juicePurchaseItems.containerType}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: juicePurchaseItems.notes,
            createdAt: juicePurchases.purchaseDate,
            updatedAt: juicePurchases.updatedAt
          })
          .from(juicePurchaseItems)
          .leftJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
          .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
          .where(isNull(juicePurchaseItems.deletedAt))

        // Packaging purchases
        const packagingItems = await db
          .select({
            id: sql<string>`CONCAT('packaging-', ${packagingPurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${packagingPurchaseItems.quantity} AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`0`,
            materialType: sql<string>`'packaging'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${packagingPurchases.id},
              'vendorName', ${vendors.name},
              'packageType', ${packagingPurchaseItems.packageType},
              'materialType', ${packagingPurchaseItems.materialType},
              'size', ${packagingPurchaseItems.size}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: packagingPurchaseItems.notes,
            createdAt: packagingPurchases.purchaseDate,
            updatedAt: packagingPurchases.updatedAt
          })
          .from(packagingPurchaseItems)
          .leftJoin(packagingPurchases, eq(packagingPurchaseItems.purchaseId, packagingPurchases.id))
          .leftJoin(vendors, eq(packagingPurchases.vendorId, vendors.id))
          .where(isNull(packagingPurchaseItems.deletedAt))

        // Combine all items and sort by creation date
        const allItems = [
          ...basefruitItems,
          ...additiveItems,
          ...juiceItems,
          ...packagingItems
        ].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })

        // Apply pagination to combined results
        const paginatedItems = allItems.slice(offset, offset + limit)
        const totalCount = allItems.length

        return {
          items: paginatedItems,
          pagination: {
            total: totalCount,
            offset,
            limit,
            hasMore: totalCount > offset + limit
          }
        }
      } catch (error) {
        console.error('Error listing inventory (purchase items):', error)
        // Fallback to empty list if there's an error
        return {
          items: [],
          pagination: {
            total: 0,
            offset: 0,
            limit: input.limit || 50,
            hasMore: false
          }
        }
      }

      // Unreachable code below - keeping commented for future reference
      // const { materialType, location, isActive, limit, offset } = input

      // let query = db
      //   .select({
      //     id: inventory.id,
      //     packageId: inventory.packageId,
      //     currentBottleCount: inventory.currentBottleCount,
      //     reservedBottleCount: inventory.reservedBottleCount,
      //     // materialType: inventory.materialType, // TODO: Re-enable after database migration
      //     metadata: inventory.metadata,
      //     location: inventory.location,
      //     notes: inventory.notes,
      //     createdAt: inventory.createdAt,
      //     updatedAt: inventory.updatedAt,
      //   })
      //   .from(inventory)

      // // Apply filters
      // const conditions = []

      // if (materialType) {
      //   conditions.push(eq(inventory.materialType, materialType))
      // }

      // if (location) {
      //   conditions.push(like(inventory.location, `%${location}%`))
      // }

      // if (isActive) {
      //   conditions.push(isNull(inventory.deletedAt))
      // }

      // if (conditions.length > 0) {
      //   query = query.where(and(...conditions))
      // }

      // const inventoryItems = await query
      //   .orderBy(desc(inventory.createdAt))
      //   .limit(limit)
      //   .offset(offset)

      // const totalCount = await db
      //   .select({ count: sql<number>`count(*)` })
      //   .from(inventory)
      //   .where(conditions.length > 0 ? and(...conditions) : undefined)

      // return {
      //   items: inventoryItems,
      //   pagination: {
      //     total: totalCount[0]?.count || 0,
      //     limit,
      //     offset,
      //     hasMore: (totalCount[0]?.count || 0) > offset + limit
      //   }
      // }
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

  // Update base fruit purchase item
  updateBaseFruitItem: createRbacProcedure('update', 'inventory')
    .input(z.object({
      id: z.string().uuid(),
      originalQuantity: z.number().min(0).optional(),
      originalUnit: z.enum(['kg', 'lb', 'L', 'gal']).optional(),
      harvestDate: z.date().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, harvestDate, originalQuantity, ...updateData } = input

      await db
        .update(basefruitPurchaseItems)
        .set({
          ...updateData,
          originalQuantity: originalQuantity?.toString(),
          harvestDate: harvestDate ? harvestDate.toISOString().split('T')[0] : null,
          updatedAt: new Date(),
        })
        .where(eq(basefruitPurchaseItems.id, id))

      // Log audit
      await db.insert(auditLog).values({
        tableName: 'basefruit_purchase_items',
        recordId: id,
        operation: 'update',
        changedBy: ctx.session?.user?.id || 'system',
        newData: updateData,
      })

      return { success: true }
    }),

  // Update additive purchase item
  updateAdditiveItem: createRbacProcedure('update', 'inventory')
    .input(z.object({
      id: z.string().uuid(),
      quantity: z.number().min(0).optional(),
      unit: z.string().optional(),
      expirationDate: z.date().optional().nullable(),
      storageRequirements: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, expirationDate, quantity, ...updateData } = input

      await db
        .update(additivePurchaseItems)
        .set({
          ...updateData,
          quantity: quantity?.toString(),
          expirationDate: expirationDate ? expirationDate.toISOString().split('T')[0] : null,
          updatedAt: new Date(),
        })
        .where(eq(additivePurchaseItems.id, id))

      // Log audit
      await db.insert(auditLog).values({
        tableName: 'additive_purchase_items',
        recordId: id,
        operation: 'update',
        changedBy: ctx.session?.user?.id || 'system',
        newData: updateData,
      })

      return { success: true }
    }),

  // Update juice purchase item
  updateJuiceItem: createRbacProcedure('update', 'inventory')
    .input(z.object({
      id: z.string().uuid(),
      volumeL: z.number().min(0).optional(),
      brix: z.number().min(0).max(100).optional().nullable(),
      containerType: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, volumeL, brix, ...updateData } = input

      await db
        .update(juicePurchaseItems)
        .set({
          ...updateData,
          volumeL: volumeL?.toString(),
          brix: brix?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(juicePurchaseItems.id, id))

      // Log audit
      await db.insert(auditLog).values({
        tableName: 'juice_purchase_items',
        recordId: id,
        operation: 'update',
        changedBy: ctx.session?.user?.id || 'system',
        newData: updateData,
      })

      return { success: true }
    }),

  // Update packaging purchase item
  updatePackagingItem: createRbacProcedure('update', 'inventory')
    .input(z.object({
      id: z.string().uuid(),
      quantity: z.number().min(0).optional(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, quantity, ...updateData } = input

      await db
        .update(packagingPurchaseItems)
        .set({
          ...updateData,
          quantity,
          updatedAt: new Date(),
        })
        .where(eq(packagingPurchaseItems.id, id))

      // Log audit
      await db.insert(auditLog).values({
        tableName: 'packaging_purchase_items',
        recordId: id,
        operation: 'update',
        changedBy: ctx.session?.user?.id || 'system',
        newData: updateData,
      })

      return { success: true }
    }),

  // Delete purchase item (soft delete using deletedAt) - accessible by admin only
  deleteItem: createRbacProcedure('delete', 'inventory')
    .input(z.object({
      id: z.string(),
      itemType: z.enum(['basefruit', 'additive', 'juice', 'packaging']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, itemType } = input
      const actualId = id.startsWith(itemType + '-') ? id.replace(itemType + '-', '') : id

      try {
        // Soft delete by setting deletedAt timestamp
        const deletedAt = new Date()

        switch (itemType) {
          case 'basefruit':
            await db
              .update(basefruitPurchaseItems)
              .set({ deletedAt })
              .where(eq(basefruitPurchaseItems.id, actualId))
            break

          case 'additive':
            await db
              .update(additivePurchaseItems)
              .set({ deletedAt })
              .where(eq(additivePurchaseItems.id, actualId))
            break

          case 'juice':
            await db
              .update(juicePurchaseItems)
              .set({ deletedAt })
              .where(eq(juicePurchaseItems.id, actualId))
            break

          case 'packaging':
            await db
              .update(packagingPurchaseItems)
              .set({ deletedAt })
              .where(eq(packagingPurchaseItems.id, actualId))
            break

          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Unsupported item type: ${itemType}`
            })
        }

        // Log audit
        await db.insert(auditLog).values({
          tableName: `${itemType}_purchase_items`,
          recordId: actualId,
          operation: 'delete',
          changedBy: ctx.session?.user?.id || 'system',
          newData: { deletedAt },
        })

        return {
          success: true,
          message: `${itemType} item deleted successfully`
        }
      } catch (error) {
        console.error('Error deleting purchase item:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete item'
        })
      }
    }),
})