import { TRPCError } from '@trpc/server'
import {
  db,
  inventory,
  inventoryTransactions,
  packages,
  appleVarieties,
  vendors,
  auditLog,
  applePressRuns,
  vessels,
  vendorVarieties
} from 'db'
import { eq, and, desc, asc, like, or, isNull, inArray, gte, lte, sql } from 'drizzle-orm'
import {
  materialTypeEnum,
  type InventoryTransaction,
  type RecordTransactionInput,
  type CreateInventoryTransactionInput,
  type CreateInventoryItemInput,
  type MaterialType,
  type AppleTransaction,
  type AdditiveTransaction,
  type JuiceTransaction,
  type PackagingTransaction
} from '../types/inventory'

// Extended types for service operations
export interface InventoryCreateParams {
  materialType: MaterialType
  initialQuantity: number
  metadata: Record<string, any>
  location?: string
  notes?: string
  packageId?: string
}

export interface StockLevelCheck {
  inventoryId: string
  currentLevel: number
  minimumLevel?: number
  isLowStock: boolean
  daysUntilEmpty?: number
}

export interface TransactionSummary {
  inventoryId: string
  totalPurchases: number
  totalSales: number
  totalAdjustments: number
  totalWaste: number
  totalTransfers: number
  netQuantityChange: number
}

// Event bus for audit logging
const eventBus = {
  publish: async (event: string, data: any, userId?: string) => {
    try {
      await db.insert(auditLog).values({
        tableName: event.split('.')[0],
        recordId: data.inventoryId || data.id || '',
        operation: event.split('.')[1],
        newData: data,
        changedBy: userId || null,
      })
    } catch (error) {
      console.error('Failed to publish audit log:', error)
    }
  }
}

/**
 * Inventory Service Class
 * Handles all inventory-related business logic and operations
 */
export class InventoryService {

  /**
   * Validate material-specific transaction data
   */
  private static validateMaterialTransaction(transaction: InventoryTransaction): void {
    switch (transaction.materialType) {
      case 'apple':
        const appleTransaction = transaction as AppleTransaction
        if (!appleTransaction.appleVarietyId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Apple variety ID is required for apple transactions'
          })
        }
        if (appleTransaction.quantityKg && appleTransaction.quantityKg <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Apple quantity must be positive'
          })
        }
        if (appleTransaction.defectPercentage && (appleTransaction.defectPercentage < 0 || appleTransaction.defectPercentage > 100)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Defect percentage must be between 0 and 100'
          })
        }
        break

      case 'additive':
        const additiveTransaction = transaction as AdditiveTransaction
        if (!additiveTransaction.additiveType || !additiveTransaction.additiveName) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Additive type and name are required for additive transactions'
          })
        }
        if (additiveTransaction.quantity <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Additive quantity must be positive'
          })
        }
        if (additiveTransaction.expirationDate && additiveTransaction.expirationDate < new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Expiration date cannot be in the past'
          })
        }
        break

      case 'juice':
        const juiceTransaction = transaction as JuiceTransaction
        if (!juiceTransaction.volumeL || juiceTransaction.volumeL <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Volume is required and must be positive for juice transactions'
          })
        }
        if (juiceTransaction.brixLevel && juiceTransaction.brixLevel <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Brix level must be positive'
          })
        }
        if (juiceTransaction.phLevel && (juiceTransaction.phLevel < 0 || juiceTransaction.phLevel > 14)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'pH level must be between 0 and 14'
          })
        }
        if (juiceTransaction.varietyComposition) {
          const totalPercentage = juiceTransaction.varietyComposition.reduce((sum, comp) => sum + comp.percentage, 0)
          if (Math.abs(totalPercentage - 100) > 0.01) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Variety composition percentages must sum to 100'
            })
          }
        }
        break

      case 'packaging':
        const packagingTransaction = transaction as PackagingTransaction
        if (!packagingTransaction.packagingType || !packagingTransaction.packagingName) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Packaging type and name are required for packaging transactions'
          })
        }
        if (packagingTransaction.quantity <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Packaging quantity must be positive'
          })
        }
        break

      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid material type'
        })
    }
  }

  /**
   * Validate foreign key relationships for apple transactions
   */
  private static async validateAppleTransactionReferences(
    tx: any,
    transaction: AppleTransaction
  ): Promise<void> {
    // Validate apple variety exists
    if (transaction.appleVarietyId) {
      const variety = await tx
        .select({ id: appleVarieties.id })
        .from(appleVarieties)
        .where(and(
          eq(appleVarieties.id, transaction.appleVarietyId),
          isNull(appleVarieties.deletedAt)
        ))
        .limit(1)

      if (!variety.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Apple variety not found'
        })
      }
    }

    // Validate vendor exists if provided
    if (transaction.vendorId) {
      const vendor = await tx
        .select({ id: vendors.id })
        .from(vendors)
        .where(and(
          eq(vendors.id, transaction.vendorId),
          eq(vendors.isActive, true),
          isNull(vendors.deletedAt)
        ))
        .limit(1)

      if (!vendor.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }

      // Validate vendor-variety relationship exists
      const vendorVariety = await tx
        .select({ id: vendorVarieties.id })
        .from(vendorVarieties)
        .where(and(
          eq(vendorVarieties.vendorId, transaction.vendorId),
          eq(vendorVarieties.varietyId, transaction.appleVarietyId),
          isNull(vendorVarieties.deletedAt)
        ))
        .limit(1)

      if (!vendorVariety.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vendor does not supply this apple variety'
        })
      }
    }
  }

  /**
   * Validate foreign key references for juice transactions
   */
  private static async validateJuiceTransactionReferences(
    tx: any,
    transaction: JuiceTransaction
  ): Promise<void> {
    // Validate press run exists if provided
    if (transaction.pressRunId) {
      const pressRun = await tx
        .select({ id: applePressRuns.id, status: applePressRuns.status })
        .from(applePressRuns)
        .where(and(
          eq(applePressRuns.id, transaction.pressRunId),
          isNull(applePressRuns.deletedAt)
        ))
        .limit(1)

      if (!pressRun.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Press run not found'
        })
      }

      if (pressRun[0].status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create inventory from cancelled press run'
        })
      }
    }

    // Validate vessel exists if provided
    if (transaction.vesselId) {
      const vessel = await tx
        .select({ id: vessels.id, status: vessels.status })
        .from(vessels)
        .where(and(
          eq(vessels.id, transaction.vesselId),
          isNull(vessels.deletedAt)
        ))
        .limit(1)

      if (!vessel.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vessel not found'
        })
      }
    }

    // Validate variety composition if provided
    if (transaction.varietyComposition && transaction.varietyComposition.length > 0) {
      const varietyIds = transaction.varietyComposition.map(comp => comp.appleVarietyId)
      const varieties = await tx
        .select({ id: appleVarieties.id })
        .from(appleVarieties)
        .where(and(
          inArray(appleVarieties.id, varietyIds),
          isNull(appleVarieties.deletedAt)
        ))

      if (varieties.length !== varietyIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or more apple varieties in composition not found'
        })
      }
    }
  }

  /**
   * Check if inventory levels are sufficient for transaction
   */
  private static async validateInventoryLevels(
    tx: any,
    inventoryId: string,
    quantityChange: number
  ): Promise<{ currentLevel: number; newLevel: number }> {
    const inventoryItem = await tx
      .select({
        id: inventory.id,
        currentBottleCount: inventory.currentBottleCount,
        reservedBottleCount: inventory.reservedBottleCount
      })
      .from(inventory)
      .where(and(
        eq(inventory.id, inventoryId),
        isNull(inventory.deletedAt)
      ))
      .limit(1)

    if (!inventoryItem.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Inventory item not found'
      })
    }

    const currentLevel = inventoryItem[0].currentBottleCount
    const newLevel = currentLevel + quantityChange

    // Prevent negative inventory
    if (newLevel < 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient inventory. Current: ${currentLevel}, Requested change: ${quantityChange}`
      })
    }

    // Prevent reducing below reserved levels
    if (quantityChange < 0 && newLevel < inventoryItem[0].reservedBottleCount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot reduce inventory below reserved level. Reserved: ${inventoryItem[0].reservedBottleCount}, New level would be: ${newLevel}`
      })
    }

    return { currentLevel, newLevel }
  }

  /**
   * Create a new inventory item with material-specific validation
   */
  static async createInventoryItem(
    params: InventoryCreateParams,
    transaction: CreateInventoryTransactionInput,
    userId?: string
  ) {
    return await db.transaction(async (tx) => {
      try {
        // Validate the material-specific transaction data
        this.validateMaterialTransaction(transaction)

        // Perform material-specific reference validation
        switch (transaction.materialType) {
          case 'apple':
            await this.validateAppleTransactionReferences(tx, transaction as AppleTransaction)
            break
          case 'juice':
            await this.validateJuiceTransactionReferences(tx, transaction as JuiceTransaction)
            break
          // Additive and packaging don't have foreign key dependencies in current schema
        }

        // Generate or validate packageId - required by current schema
        let packageId = params.packageId
        if (!packageId) {
          // For raw materials, we need to work around the batch requirement
          // TODO: Implement proper raw material inventory without package constraint

          // For now, we'll check if there's a default "raw materials" batch
          // or create a placeholder package entry differently
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Package ID is required for inventory creation. Raw material inventory management needs schema updates.'
          })
        }

        // Create inventory item
        const newInventoryItem = await tx
          .insert(inventory)
          .values({
            packageId: packageId,
            currentBottleCount: params.initialQuantity,
            reservedBottleCount: 0,
            materialType: params.materialType,
            metadata: {
              ...params.metadata,
              transactionData: transaction
            },
            location: params.location,
            notes: params.notes,
          })
          .returning()

        // Create initial transaction record
        const initialTransaction = await tx
          .insert(inventoryTransactions)
          .values({
            inventoryId: newInventoryItem[0].id,
            transactionType: 'purchase',
            quantityChange: params.initialQuantity,
            transactionDate: transaction.transactionDate,
            reason: transaction.reason || 'Initial inventory creation',
            notes: transaction.notes,
          })
          .returning()

        // Publish audit events
        await eventBus.publish('inventory.created', {
          inventoryId: newInventoryItem[0].id,
          materialType: params.materialType,
          initialQuantity: params.initialQuantity,
          transactionData: transaction
        }, userId)

        await eventBus.publish('inventory.transaction', {
          inventoryId: newInventoryItem[0].id,
          transactionId: initialTransaction[0].id,
          materialType: params.materialType,
          previousCount: 0,
          newCount: params.initialQuantity,
          change: params.initialQuantity,
          transactionType: 'purchase',
        }, userId)

        return {
          success: true,
          inventoryItem: newInventoryItem[0],
          initialTransaction: initialTransaction[0],
          message: `Inventory item created successfully with initial quantity: ${params.initialQuantity}`
        }

      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error creating inventory item:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create inventory item'
        })
      }
    })
  }

  /**
   * Record a transaction for existing inventory with comprehensive validation
   */
  static async recordTransaction(
    input: RecordTransactionInput,
    userId?: string
  ) {
    return await db.transaction(async (tx) => {
      try {
        // Validate inventory levels and get current state
        const { currentLevel, newLevel } = await this.validateInventoryLevels(
          tx,
          input.inventoryId,
          input.quantityChange
        )

        // Get inventory item details for audit
        const inventoryItem = await tx
          .select()
          .from(inventory)
          .where(eq(inventory.id, input.inventoryId))
          .limit(1)

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
            currentBottleCount: newLevel,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, input.inventoryId))
          .returning()

        // Publish audit event
        await eventBus.publish('inventory.transaction', {
          inventoryId: input.inventoryId,
          transactionId: newTransaction[0].id,
          materialType: inventoryItem[0].materialType,
          previousCount: currentLevel,
          newCount: newLevel,
          change: input.quantityChange,
          transactionType: input.transactionType,
        }, userId)

        return {
          success: true,
          inventoryItem: updatedItem[0],
          transaction: newTransaction[0],
          message: `Inventory transaction recorded successfully. New count: ${newLevel}`
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
  }

  /**
   * Bulk transfer items between locations
   */
  static async bulkTransfer(
    inventoryIds: string[],
    fromLocation: string,
    toLocation: string,
    reason?: string,
    userId?: string
  ) {
    return await db.transaction(async (tx) => {
      try {
        // Validate all inventory items exist and are at the specified location
        const inventoryItems = await tx
          .select()
          .from(inventory)
          .where(and(
            inArray(inventory.id, inventoryIds),
            isNull(inventory.deletedAt),
            eq(inventory.location, fromLocation)
          ))

        if (inventoryItems.length !== inventoryIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Some inventory items not found or not at the specified location'
          })
        }

        const updatedItems = []
        const transactions = []

        // Process each item
        for (const item of inventoryItems) {
          // Create transfer transaction
          const transferTransaction = await tx
            .insert(inventoryTransactions)
            .values({
              inventoryId: item.id,
              transactionType: 'transfer',
              quantityChange: 0, // Transfers don't change quantity, just location
              transactionDate: new Date(),
              reason: reason || `Transfer from ${fromLocation} to ${toLocation}`,
              notes: `Location transfer: ${fromLocation} → ${toLocation}`,
            })
            .returning()

          // Update location
          const updatedItem = await tx
            .update(inventory)
            .set({
              location: toLocation,
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, item.id))
            .returning()

          updatedItems.push(updatedItem[0])
          transactions.push(transferTransaction[0])

          // Publish audit event
          await eventBus.publish('inventory.transferred', {
            inventoryId: item.id,
            fromLocation,
            toLocation,
            materialType: item.materialType,
          }, userId)
        }

        return {
          success: true,
          updatedItems,
          transactions,
          message: `Successfully transferred ${inventoryItems.length} items from ${fromLocation} to ${toLocation}`
        }

      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error in bulk transfer:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform bulk transfer'
        })
      }
    })
  }

  /**
   * Check stock levels and identify low stock items
   */
  static async checkStockLevels(
    materialType?: MaterialType,
    location?: string,
    minimumThreshold: number = 10
  ): Promise<StockLevelCheck[]> {
    try {
      let query = db
        .select({
          id: inventory.id,
          currentBottleCount: inventory.currentBottleCount,
          reservedBottleCount: inventory.reservedBottleCount,
          materialType: inventory.materialType,
          location: inventory.location,
          metadata: inventory.metadata
        })
        .from(inventory)
        .where(isNull(inventory.deletedAt))

      const conditions = []
      if (materialType) {
        conditions.push(eq(inventory.materialType, materialType))
      }
      if (location) {
        conditions.push(eq(inventory.location, location))
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      const inventoryItems = await query

      const stockChecks: StockLevelCheck[] = inventoryItems.map(item => {
        const availableStock = item.currentBottleCount - item.reservedBottleCount
        const isLowStock = availableStock <= minimumThreshold

        // Calculate days until empty based on recent consumption patterns
        // This would require transaction analysis - simplified for MVP
        let daysUntilEmpty: number | undefined
        if (availableStock > 0) {
          // TODO: Implement consumption rate analysis
          daysUntilEmpty = undefined
        }

        return {
          inventoryId: item.id,
          currentLevel: item.currentBottleCount,
          minimumLevel: minimumThreshold,
          isLowStock,
          daysUntilEmpty
        }
      })

      return stockChecks.filter(check => check.isLowStock)

    } catch (error) {
      console.error('Error checking stock levels:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to check stock levels'
      })
    }
  }

  /**
   * Get transaction summary for inventory items
   */
  static async getTransactionSummary(
    inventoryIds: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionSummary[]> {
    try {
      let query = db
        .select({
          inventoryId: inventoryTransactions.inventoryId,
          transactionType: inventoryTransactions.transactionType,
          quantityChange: inventoryTransactions.quantityChange,
        })
        .from(inventoryTransactions)
        .where(inArray(inventoryTransactions.inventoryId, inventoryIds))

      const conditions = []
      if (startDate) {
        conditions.push(gte(inventoryTransactions.transactionDate, startDate))
      }
      if (endDate) {
        conditions.push(lte(inventoryTransactions.transactionDate, endDate))
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      const transactions = await query

      // Group and summarize by inventory ID
      const summaryMap = new Map<string, TransactionSummary>()

      transactions.forEach(transaction => {
        if (!summaryMap.has(transaction.inventoryId)) {
          summaryMap.set(transaction.inventoryId, {
            inventoryId: transaction.inventoryId,
            totalPurchases: 0,
            totalSales: 0,
            totalAdjustments: 0,
            totalWaste: 0,
            totalTransfers: 0,
            netQuantityChange: 0
          })
        }

        const summary = summaryMap.get(transaction.inventoryId)!

        switch (transaction.transactionType) {
          case 'purchase':
            summary.totalPurchases += transaction.quantityChange
            break
          case 'sale':
            summary.totalSales += Math.abs(transaction.quantityChange)
            break
          case 'adjustment':
            summary.totalAdjustments += Math.abs(transaction.quantityChange)
            break
          case 'waste':
            summary.totalWaste += Math.abs(transaction.quantityChange)
            break
          case 'transfer':
            summary.totalTransfers += Math.abs(transaction.quantityChange)
            break
        }

        summary.netQuantityChange += transaction.quantityChange
      })

      return Array.from(summaryMap.values())

    } catch (error) {
      console.error('Error getting transaction summary:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get transaction summary'
      })
    }
  }

  /**
   * Reserve inventory for upcoming operations
   */
  static async reserveInventory(
    inventoryId: string,
    reserveQuantity: number,
    reason: string,
    userId?: string
  ) {
    return await db.transaction(async (tx) => {
      try {
        // Get current inventory state
        const inventoryItem = await tx
          .select()
          .from(inventory)
          .where(and(
            eq(inventory.id, inventoryId),
            isNull(inventory.deletedAt)
          ))
          .limit(1)

        if (!inventoryItem.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inventory item not found'
          })
        }

        const item = inventoryItem[0]
        const availableStock = item.currentBottleCount - item.reservedBottleCount

        if (reserveQuantity > availableStock) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient available stock. Available: ${availableStock}, Requested: ${reserveQuantity}`
          })
        }

        const newReservedCount = item.reservedBottleCount + reserveQuantity

        // Update reservation
        const updatedItem = await tx
          .update(inventory)
          .set({
            reservedBottleCount: newReservedCount,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, inventoryId))
          .returning()

        // Publish audit event
        await eventBus.publish('inventory.reserved', {
          inventoryId,
          reservedQuantity: reserveQuantity,
          totalReserved: newReservedCount,
          reason,
          availableAfterReservation: item.currentBottleCount - newReservedCount
        }, userId)

        return {
          success: true,
          inventoryItem: updatedItem[0],
          reservedQuantity: reserveQuantity,
          totalReserved: newReservedCount,
          availableStock: item.currentBottleCount - newReservedCount,
          message: `Successfully reserved ${reserveQuantity} units`
        }

      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error reserving inventory:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reserve inventory'
        })
      }
    })
  }

  /**
   * Release reserved inventory
   */
  static async releaseReservation(
    inventoryId: string,
    releaseQuantity: number,
    reason: string,
    userId?: string
  ) {
    return await db.transaction(async (tx) => {
      try {
        // Get current inventory state
        const inventoryItem = await tx
          .select()
          .from(inventory)
          .where(and(
            eq(inventory.id, inventoryId),
            isNull(inventory.deletedAt)
          ))
          .limit(1)

        if (!inventoryItem.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inventory item not found'
          })
        }

        const item = inventoryItem[0]

        if (releaseQuantity > item.reservedBottleCount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot release more than reserved. Reserved: ${item.reservedBottleCount}, Requested: ${releaseQuantity}`
          })
        }

        const newReservedCount = item.reservedBottleCount - releaseQuantity

        // Update reservation
        const updatedItem = await tx
          .update(inventory)
          .set({
            reservedBottleCount: newReservedCount,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, inventoryId))
          .returning()

        // Publish audit event
        await eventBus.publish('inventory.reservation_released', {
          inventoryId,
          releasedQuantity: releaseQuantity,
          totalReserved: newReservedCount,
          reason,
          availableAfterRelease: item.currentBottleCount - newReservedCount
        }, userId)

        return {
          success: true,
          inventoryItem: updatedItem[0],
          releasedQuantity: releaseQuantity,
          totalReserved: newReservedCount,
          availableStock: item.currentBottleCount - newReservedCount,
          message: `Successfully released ${releaseQuantity} units from reservation`
        }

      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error releasing reservation:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to release reservation'
        })
      }
    })
  }
}