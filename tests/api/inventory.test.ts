import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db, inventory, inventoryTransactions, baseFruitVarieties, vendors } from 'db'
import { eq, isNull } from 'drizzle-orm'
import { createTRPCCaller, type Context } from '../../packages/api/src/trpc'

// Test data constants
const TEST_VENDOR_ID = '123e4567-e89b-12d3-a456-426614174000'
const TEST_VARIETY_ID = '123e4567-e89b-12d3-a456-426614174001'
const TEST_USER_ID = 'test-user-123'

// Mock context for testing
const mockContext: Context = {
  session: {
    user: {
      id: TEST_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin'
    }
  }
}

describe('Inventory API Integration Tests', () => {
  let caller: ReturnType<typeof createTRPCCaller>

  beforeAll(async () => {
    // Create tRPC caller with mock context
    caller = createTRPCCaller(mockContext)

    // Ensure test database is clean and seeded
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  beforeEach(async () => {
    // Clean up any test data between tests
    await db.delete(inventoryTransactions).where(isNull(inventoryTransactions.deletedAt))
    await db.delete(inventory).where(isNull(inventory.deletedAt))
  })

  describe('list endpoint', () => {
    beforeEach(async () => {
      // Create test inventory items
      await createTestInventoryItems()
    })

    it('should list inventory items with pagination', async () => {
      const result = await caller.inventory.list({
        limit: 10,
        offset: 0
      })

      expect(result.items).toBeDefined()
      expect(Array.isArray(result.items)).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination.total).toBeGreaterThan(0)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.offset).toBe(0)
    })

    it('should filter by material type', async () => {
      const result = await caller.inventory.list({
        materialType: 'apple',
        limit: 50,
        offset: 0
      })

      expect(result.items.every(item => item.materialType === 'apple')).toBe(true)
    })

    it('should filter by location', async () => {
      const result = await caller.inventory.list({
        location: 'Cold Storage',
        limit: 50,
        offset: 0
      })

      expect(result.items.every(item =>
        item.location?.includes('Cold Storage')
      )).toBe(true)
    })

    it('should handle active filter', async () => {
      const result = await caller.inventory.list({
        isActive: true,
        limit: 50,
        offset: 0
      })

      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items.every(item => !item.deletedAt)).toBe(true)
    })
  })

  describe('getById endpoint', () => {
    let testInventoryId: string

    beforeEach(async () => {
      const testItem = await createTestInventoryItem()
      testInventoryId = testItem.id
    })

    it('should get inventory item by ID', async () => {
      const result = await caller.inventory.getById({
        id: testInventoryId
      })

      expect(result.item).toBeDefined()
      expect(result.item.id).toBe(testInventoryId)
      expect(result.transactions).toBeDefined()
      expect(Array.isArray(result.transactions)).toBe(true)
    })

    it('should throw error for non-existent inventory ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      await expect(
        caller.inventory.getById({ id: nonExistentId })
      ).rejects.toThrow('Inventory item not found')
    })
  })

  describe('search endpoint', () => {
    beforeEach(async () => {
      await createTestInventoryItems()
    })

    it('should search inventory items by query', async () => {
      const result = await caller.inventory.search({
        query: 'Cold Storage',
        limit: 10
      })

      expect(result.items).toBeDefined()
      expect(Array.isArray(result.items)).toBe(true)
      expect(result.count).toBeDefined()
    })

    it('should filter search by material types', async () => {
      const result = await caller.inventory.search({
        query: 'Test',
        materialTypes: ['apple'],
        limit: 10
      })

      expect(result.items.every(item => item.materialType === 'apple')).toBe(true)
    })
  })

  describe('recordTransaction endpoint', () => {
    let testInventoryId: string

    beforeEach(async () => {
      const testItem = await createTestInventoryItem()
      testInventoryId = testItem.id
    })

    it('should record a transaction successfully', async () => {
      const transactionData = {
        inventoryId: testInventoryId,
        transactionType: 'adjustment' as const,
        quantityChange: 50,
        reason: 'Test adjustment',
        notes: 'Integration test transaction'
      }

      const result = await caller.inventory.recordTransaction(transactionData)

      expect(result.success).toBe(true)
      expect(result.transaction).toBeDefined()
      expect(result.transaction.quantityChange).toBe(50)
      expect(result.transaction.reason).toBe('Test adjustment')
    })

    it('should handle negative quantity changes', async () => {
      const transactionData = {
        inventoryId: testInventoryId,
        transactionType: 'waste' as const,
        quantityChange: -25,
        reason: 'Waste adjustment',
        notes: 'Test negative adjustment'
      }

      const result = await caller.inventory.recordTransaction(transactionData)

      expect(result.success).toBe(true)
      expect(result.transaction.quantityChange).toBe(-25)
    })

    it('should validate transaction data', async () => {
      const invalidTransactionData = {
        inventoryId: testInventoryId,
        transactionType: 'invalid' as any,
        quantityChange: 0,
        reason: ''
      }

      await expect(
        caller.inventory.recordTransaction(invalidTransactionData)
      ).rejects.toThrow()
    })
  })

  describe('createInventoryItem endpoint', () => {
    it('should create new inventory item successfully', async () => {
      const itemData = {
        materialType: 'apple' as const,
        quantityChange: 200,
        transactionType: 'purchase' as const,
        reason: 'New inventory creation',
        notes: 'Test inventory item creation'
      }

      const result = await caller.inventory.createInventoryItem(itemData)

      expect(result.success).toBe(true)
      expect(result.inventoryItem).toBeDefined()
      expect(result.inventoryItem.materialType).toBe('apple')
      expect(result.inventoryItem.currentBottleCount).toBe(200)
      expect(result.transaction).toBeDefined()
    })

    it('should validate required fields', async () => {
      const invalidItemData = {
        materialType: 'apple' as const,
        quantityChange: -100, // Invalid negative for new item
        transactionType: 'purchase' as const,
        reason: 'Invalid test'
      }

      await expect(
        caller.inventory.createInventoryItem(invalidItemData)
      ).rejects.toThrow()
    })
  })

  describe('checkStockLevels endpoint', () => {
    beforeEach(async () => {
      await createTestInventoryItems()
    })

    it('should check stock levels with default threshold', async () => {
      const result = await caller.inventory.checkStockLevels({})

      expect(result.lowStockItems).toBeDefined()
      expect(Array.isArray(result.lowStockItems)).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.summary.totalItemsChecked).toBeGreaterThanOrEqual(0)
    })

    it('should filter by material type', async () => {
      const result = await caller.inventory.checkStockLevels({
        materialType: 'apple'
      })

      expect(result.lowStockItems.every(item => item.materialType === 'apple')).toBe(true)
    })

    it('should filter by location', async () => {
      const result = await caller.inventory.checkStockLevels({
        location: 'Cold Storage'
      })

      expect(result.summary).toBeDefined()
    })

    it('should respect custom minimum threshold', async () => {
      const result = await caller.inventory.checkStockLevels({
        minimumThreshold: 500
      })

      expect(result.lowStockItems.every(item =>
        item.currentBottleCount < 500
      )).toBe(true)
    })
  })

  describe('reserveInventory and releaseReservation endpoints', () => {
    let testInventoryId: string

    beforeEach(async () => {
      // Create inventory item with sufficient quantity
      const testItem = await createTestInventoryItem(1000)
      testInventoryId = testItem.id
    })

    it('should reserve inventory successfully', async () => {
      const result = await caller.inventory.reserveInventory({
        inventoryId: testInventoryId,
        reserveQuantity: 200,
        reason: 'Production planning'
      })

      expect(result.success).toBe(true)
      expect(result.inventoryItem.reservedBottleCount).toBe(200)
      expect(result.message).toContain('Reserved 200 units')
    })

    it('should release reservations successfully', async () => {
      // First reserve some inventory
      await caller.inventory.reserveInventory({
        inventoryId: testInventoryId,
        reserveQuantity: 300,
        reason: 'Production planning'
      })

      // Then release part of it
      const result = await caller.inventory.releaseReservation({
        inventoryId: testInventoryId,
        releaseQuantity: 100,
        reason: 'Production completed early'
      })

      expect(result.success).toBe(true)
      expect(result.inventoryItem.reservedBottleCount).toBe(200) // 300 - 100
      expect(result.message).toContain('Released 100 units')
    })

    it('should prevent over-reservation', async () => {
      await expect(
        caller.inventory.reserveInventory({
          inventoryId: testInventoryId,
          reserveQuantity: 2000, // More than available
          reason: 'Over-reservation test'
        })
      ).rejects.toThrow('Insufficient available inventory')
    })

    it('should prevent releasing more than reserved', async () => {
      // Reserve some inventory first
      await caller.inventory.reserveInventory({
        inventoryId: testInventoryId,
        reserveQuantity: 100,
        reason: 'Small reservation'
      })

      // Try to release more than reserved
      await expect(
        caller.inventory.releaseReservation({
          inventoryId: testInventoryId,
          releaseQuantity: 200,
          reason: 'Over-release test'
        })
      ).rejects.toThrow()
    })
  })

  describe('getTransactionHistory endpoint', () => {
    let testInventoryId: string

    beforeEach(async () => {
      const testItem = await createTestInventoryItem()
      testInventoryId = testItem.id

      // Create some transaction history
      await caller.inventory.recordTransaction({
        inventoryId: testInventoryId,
        transactionType: 'adjustment',
        quantityChange: 50,
        reason: 'Test adjustment 1'
      })

      await caller.inventory.recordTransaction({
        inventoryId: testInventoryId,
        transactionType: 'waste',
        quantityChange: -10,
        reason: 'Test waste'
      })
    })

    it('should get transaction history with pagination', async () => {
      const result = await caller.inventory.getTransactionHistory({
        inventoryId: testInventoryId,
        limit: 10,
        offset: 0
      })

      expect(result.transactions).toBeDefined()
      expect(Array.isArray(result.transactions)).toBe(true)
      expect(result.transactions.length).toBeGreaterThan(0)
      expect(result.pagination).toBeDefined()
      expect(result.pagination.total).toBeGreaterThan(0)
    })
  })

  describe('getSummaryByMaterialType endpoint', () => {
    beforeEach(async () => {
      await createTestInventoryItems()
    })

    it('should get summary by material type', async () => {
      const result = await caller.inventory.getSummaryByMaterialType()

      expect(result.summary).toBeDefined()
      expect(Array.isArray(result.summary)).toBe(true)
      expect(result.totalItems).toBeDefined()
      expect(result.totalItems).toBeGreaterThan(0)

      // Verify summary structure
      result.summary.forEach(item => {
        expect(item.materialType).toBeDefined()
        expect(item.totalItems).toBeDefined()
        expect(item.totalQuantity).toBeDefined()
      })
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle invalid inventory ID gracefully', async () => {
      const invalidId = '00000000-0000-0000-0000-000000000000'

      await expect(
        caller.inventory.reserveInventory({
          inventoryId: invalidId,
          reserveQuantity: 10,
          reason: 'Test'
        })
      ).rejects.toThrow('Inventory item not found')
    })

    it('should handle empty search results', async () => {
      const result = await caller.inventory.search({
        query: 'NonExistentSearchTerm12345',
        limit: 10
      })

      expect(result.items).toHaveLength(0)
      expect(result.count).toBe(0)
    })

    it('should handle pagination edge cases', async () => {
      const result = await caller.inventory.list({
        limit: 1000,
        offset: 999999
      })

      expect(result.items).toHaveLength(0)
      expect(result.pagination.hasMore).toBe(false)
    })
  })
})

// Helper functions for test setup
async function setupTestData() {
  // Ensure test vendor exists
  await db.insert(vendors).values({
    id: TEST_VENDOR_ID,
    name: 'Test Vendor',
    contactInfo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing()

  // Ensure test variety exists
  await db.insert(baseFruitVarieties).values({
    id: TEST_VARIETY_ID,
    name: 'Test Variety',
    description: 'Test variety for inventory tests',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing()
}

async function cleanupTestData() {
  // Clean up in reverse dependency order
  await db.delete(inventoryTransactions)
  await db.delete(inventory)
}

async function createTestInventoryItem(quantity: number = 500) {
  const inventoryItem = await db.insert(inventory).values({
    materialType: 'apple',
    currentBottleCount: quantity,
    reservedBottleCount: 0,
    metadata: {
      variety: 'Test Apple',
      vendorId: TEST_VENDOR_ID,
      quality: 'Premium'
    },
    location: 'Cold Storage A',
    notes: 'Test inventory item',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  // Create initial transaction
  await db.insert(inventoryTransactions).values({
    inventoryId: inventoryItem[0].id,
    transactionType: 'purchase',
    quantityChange: quantity,
    transactionDate: new Date(),
    reason: 'Initial test inventory',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return inventoryItem[0]
}

async function createTestInventoryItems() {
  const items = [
    {
      materialType: 'apple' as const,
      currentBottleCount: 150,
      location: 'Cold Storage A',
      metadata: { variety: 'Honeycrisp', quality: 'Premium' }
    },
    {
      materialType: 'additive' as const,
      currentBottleCount: 50,
      location: 'Ingredients Shelf',
      metadata: { type: 'Yeast', brand: 'Test Brand' }
    },
    {
      materialType: 'juice' as const,
      currentBottleCount: 800,
      location: 'Tank 2',
      metadata: { brix: 16.0, ph: 3.4 }
    },
    {
      materialType: 'packaging' as const,
      currentBottleCount: 2000,
      location: 'Packaging Warehouse',
      metadata: { type: 'Bottles', sku: 'TEST-BTL-500' }
    }
  ]

  for (const item of items) {
    await db.insert(inventory).values({
      ...item,
      reservedBottleCount: 0,
      notes: 'Test inventory item',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}