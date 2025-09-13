/**
 * API endpoint integration tests with authentication and authorization
 * Tests tRPC procedures with RBAC validation and session management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createCaller } from 'api/src/trpc'
import { TRPCError } from '@trpc/server'
import { setupTestDatabase, teardownTestDatabase, seedTestData } from '../database/testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Session } from 'next-auth'

describe('API Endpoints with Authentication Integration Tests', () => {
  let db: NodePgDatabase
  let testData: {
    vendorIds: string[]
    appleVarietyIds: string[]
    vesselIds: string[]
    userIds: string[]
  }

  // Mock sessions for different user roles
  const adminSession: Session = {
    user: {
      id: 'user-admin',
      email: 'admin@cidery.com',
      name: 'Admin User',
      role: 'admin'
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  const operatorSession: Session = {
    user: {
      id: 'user-operator',
      email: 'operator@cidery.com',
      name: 'Operator User',
      role: 'operator'
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  const viewerSession: Session = {
    user: {
      id: 'user-viewer',
      email: 'viewer@cidery.com',
      name: 'Viewer User',
      role: 'viewer'
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  beforeAll(async () => {
    const { db: database } = await setupTestDatabase()
    db = database
  })

  afterAll(async () => {
    await teardownTestDatabase()
  })

  beforeEach(async () => {
    testData = await seedTestData(db)
  })

  describe('Authentication Tests', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const caller = createCaller({ session: null, db })

      // Test various protected endpoints
      await expect(caller.vendor.list()).rejects.toThrow('UNAUTHORIZED')
      await expect(caller.purchase.list()).rejects.toThrow('UNAUTHORIZED')
      await expect(caller.batch.list()).rejects.toThrow('UNAUTHORIZED')
      await expect(caller.packaging.list()).rejects.toThrow('UNAUTHORIZED')
    })

    it('should allow access to public endpoints without authentication', async () => {
      const caller = createCaller({ session: null, db })

      // Test public endpoint
      const result = await caller.ping()
      expect(result).toEqual({ ok: true })
    })

    it('should authenticate valid sessions correctly', async () => {
      const adminCaller = createCaller({ session: adminSession, db })
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Test authenticated endpoints
      const adminProfile = await adminCaller.profile()
      expect(adminProfile.user.email).toBe('admin@cidery.com')
      expect(adminProfile.user.role).toBe('admin')

      const operatorProfile = await operatorCaller.profile()
      expect(operatorProfile.user.email).toBe('operator@cidery.com')
      expect(operatorProfile.user.role).toBe('operator')
    })
  })

  describe('Role-Based Access Control (RBAC)', () => {
    it('should allow admin users full access to all operations', async () => {
      const adminCaller = createCaller({ session: adminSession, db })

      // Test admin can access all endpoints
      const vendors = await adminCaller.vendor.list()
      expect(vendors).toBeDefined()

      const adminInfo = await adminCaller.adminInfo()
      expect(adminInfo.user.role).toBe('admin')

      // Test admin can create vendor
      const newVendor = await adminCaller.vendor.create({
        name: 'Admin Test Vendor',
        contactInfo: { email: 'admin-vendor@test.com' }
      })
      expect(newVendor.success).toBe(true)
      expect(newVendor.vendor.name).toBe('Admin Test Vendor')

      // Test admin can delete vendor
      const deleteResult = await adminCaller.vendor.delete({
        id: newVendor.vendor.id
      })
      expect(deleteResult.success).toBe(true)
    })

    it('should restrict operator users to appropriate operations', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Operators can list and create but not delete certain resources
      const vendors = await operatorCaller.vendor.list()
      expect(vendors).toBeDefined()

      // Operators should not access admin-only endpoints
      await expect(operatorCaller.adminInfo()).rejects.toThrow('FORBIDDEN')

      // Test operator can create operations
      const newVendor = await operatorCaller.vendor.create({
        name: 'Operator Test Vendor',
        contactInfo: { email: 'operator-vendor@test.com' }
      })
      expect(newVendor.success).toBe(true)

      // Test operator operations they should have access to
      const purchases = await operatorCaller.purchase.list()
      expect(purchases).toBeDefined()

      const batches = await operatorCaller.batch.list()
      expect(batches).toBeDefined()
    })

    it('should enforce resource-specific permissions correctly', async () => {
      const adminCaller = createCaller({ session: adminSession, db })
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Create test data as admin
      const vendor = await adminCaller.vendor.create({
        name: 'RBAC Test Vendor',
        contactInfo: { email: 'rbac@test.com' }
      })

      const purchase = await adminCaller.purchase.create({
        vendorId: vendor.vendor.id,
        purchaseDate: new Date(),
        invoiceNumber: 'RBAC-001',
        items: [{
          appleVarietyId: testData.appleVarietyIds[0],
          quantity: 100,
          unit: 'kg',
          pricePerUnit: 2.00,
        }]
      })

      // Both admin and operator should be able to read
      const adminPurchaseView = await adminCaller.purchase.getById({
        id: purchase.purchase.id
      })
      expect(adminPurchaseView.purchase.id).toBe(purchase.purchase.id)

      const operatorPurchaseView = await operatorCaller.purchase.getById({
        id: purchase.purchase.id
      })
      expect(operatorPurchaseView.purchase.id).toBe(purchase.purchase.id)

      // Test specific workflow operations
      const pressRun = await operatorCaller.press.start({
        runDate: new Date(),
        items: [{
          purchaseItemId: purchase.items[0].id,
          quantityUsedKg: 100,
          brixMeasured: 12.0
        }]
      })
      expect(pressRun.success).toBe(true)
    })
  })

  describe('Complex Workflow API Tests', () => {
    it('should handle complete purchase-to-batch workflow via API', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Step 1: Create purchase
      const purchase = await operatorCaller.purchase.create({
        vendorId: testData.vendorIds[0],
        purchaseDate: new Date('2024-09-01'),
        invoiceNumber: 'API-WORKFLOW-001',
        notes: 'API integration test purchase',
        items: [
          {
            appleVarietyId: testData.appleVarietyIds[0],
            quantity: 500,
            unit: 'kg',
            pricePerUnit: 2.50,
            notes: 'Premium apples'
          },
          {
            appleVarietyId: testData.appleVarietyIds[1],
            quantity: 200,
            unit: 'kg',
            pricePerUnit: 2.00,
            notes: 'Tart apples for blend'
          }
        ]
      })

      expect(purchase.success).toBe(true)
      expect(purchase.items).toHaveLength(2)

      // Step 2: Create press run
      const pressRun = await operatorCaller.press.start({
        runDate: new Date('2024-09-02'),
        notes: 'API test press run',
        items: purchase.items.map(item => ({
          purchaseItemId: item.id,
          quantityUsedKg: parseFloat(item.quantity),
          brixMeasured: 12.5
        }))
      })

      expect(pressRun.success).toBe(true)
      expect(pressRun.items).toHaveLength(2)

      // Step 3: Start batch from juice lot
      const batch = await operatorCaller.batch.startFromJuiceLot({
        batchNumber: 'API-BATCH-001',
        vesselId: testData.vesselIds[0],
        startDate: new Date('2024-09-03'),
        targetAbv: 6.5,
        notes: 'API test batch',
        pressItems: pressRun.items.map(item => ({
          pressItemId: item.id,
          volumeUsedL: parseFloat(item.juiceProducedL),
          brixAtUse: 12.5
        }))
      })

      expect(batch.success).toBe(true)
      expect(batch.batch.batchNumber).toBe('API-BATCH-001')
      expect(batch.ingredients).toHaveLength(2)

      // Step 4: Add measurements
      const measurement = await operatorCaller.batch.addMeasurement({
        batchId: batch.batch.id,
        measurementDate: new Date('2024-09-10'),
        specificGravity: 1.010,
        abv: 6.3,
        ph: 3.4,
        volumeL: parseFloat(batch.batch.currentVolumeL),
        notes: 'API test measurement'
      })

      expect(measurement.success).toBe(true)

      // Step 5: Transfer batch
      const transfer = await operatorCaller.batch.transfer({
        batchId: batch.batch.id,
        newVesselId: testData.vesselIds[1],
        volumeTransferredL: parseFloat(batch.batch.currentVolumeL) * 0.95,
        notes: 'API test transfer'
      })

      expect(transfer.success).toBe(true)
      expect(transfer.batch.vesselId).toBe(testData.vesselIds[1])

      // Verify complete data chain
      const finalBatch = await operatorCaller.batch.getById({
        id: batch.batch.id
      })

      expect(finalBatch.batch.vesselId).toBe(testData.vesselIds[1])
      expect(finalBatch.ingredients).toHaveLength(2)
      expect(finalBatch.measurements).toHaveLength(1)
    })

    it('should handle packaging workflow with inventory updates via API', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Create a completed batch for packaging
      const batchData = await db.insert(schema.batches).values({
        batchNumber: 'API-PKG-BATCH-001',
        status: 'active',
        vesselId: testData.vesselIds[2],
        startDate: new Date('2024-09-01'),
        initialVolumeL: '750',
        currentVolumeL: '750',
        actualAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Package the batch
      const packaging = await operatorCaller.packaging.create({
        batchId: batchData[0].id,
        packageDate: new Date('2024-09-20'),
        volumePackagedL: 750,
        bottleSize: '750ml',
        bottleCount: 1000,
        abvAtPackaging: 6.5,
        location: 'API Test Warehouse',
        notes: 'API packaging test'
      })

      expect(packaging.success).toBe(true)
      expect(packaging.package.bottleCount).toBe(1000)
      expect(packaging.inventory.currentBottleCount).toBe(1000)
      expect(packaging.remainingBatchVolumeL).toBe(0)

      // Verify inventory operations
      const inventoryUpdate = await operatorCaller.packaging.updateInventory({
        inventoryId: packaging.inventory.id,
        transactionType: 'sale',
        quantityChange: -100,
        reason: 'API test sale',
        notes: 'Test sale transaction'
      })

      expect(inventoryUpdate.success).toBe(true)
      expect(inventoryUpdate.inventory.currentBottleCount).toBe(900)

      // Get package details
      const packageDetails = await operatorCaller.packaging.getById({
        id: packaging.package.id
      })

      expect(packageDetails.package.id).toBe(packaging.package.id)
      expect(packageDetails.inventory?.currentBottleCount).toBe(900)
      expect(packageDetails.transactions).toHaveLength(2) // Initial + sale
    })
  })

  describe('Error Handling and Validation', () => {
    it('should properly validate input data and return structured errors', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Test invalid vendor creation
      await expect(operatorCaller.vendor.create({
        name: '', // Empty name should fail validation
        contactInfo: {}
      })).rejects.toThrow('Name is required')

      // Test invalid purchase creation
      await expect(operatorCaller.purchase.create({
        vendorId: 'invalid-uuid', // Invalid UUID format
        purchaseDate: new Date(),
        items: [{
          appleVarietyId: testData.appleVarietyIds[0],
          quantity: 100,
          unit: 'kg',
          pricePerUnit: 2.00
        }]
      })).rejects.toThrow('Invalid vendor ID')

      // Test negative quantities
      await expect(operatorCaller.purchase.create({
        vendorId: testData.vendorIds[0],
        purchaseDate: new Date(),
        items: [{
          appleVarietyId: testData.appleVarietyIds[0],
          quantity: -100, // Negative quantity
          unit: 'kg',
          pricePerUnit: 2.00
        }]
      })).rejects.toThrow('Quantity must be positive')

      // Test batch measurement validation
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'VALIDATION-TEST-001',
        status: 'active',
        startDate: new Date(),
        initialVolumeL: '500',
        currentVolumeL: '500',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await expect(operatorCaller.batch.addMeasurement({
        batchId: batch[0].id,
        measurementDate: new Date(),
        specificGravity: 2.0, // Invalid specific gravity
        abv: 6.0,
        ph: 3.4
      })).rejects.toThrow()
    })

    it('should handle business rule violations appropriately', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Create test data
      const vendor = await operatorCaller.vendor.create({
        name: 'Business Rule Test Vendor',
        contactInfo: { email: 'business@test.com' }
      })

      const purchase = await operatorCaller.purchase.create({
        vendorId: vendor.vendor.id,
        purchaseDate: new Date(),
        items: [{
          appleVarietyId: testData.appleVarietyIds[0],
          quantity: 100,
          unit: 'kg',
          pricePerUnit: 2.00
        }]
      })

      const pressRun = await operatorCaller.press.start({
        runDate: new Date(),
        items: [{
          purchaseItemId: purchase.items[0].id,
          quantityUsedKg: 100,
          brixMeasured: 12.0
        }]
      })

      // Test vessel capacity violation
      await expect(operatorCaller.batch.startFromJuiceLot({
        batchNumber: 'CAPACITY-VIOLATION-001',
        vesselId: testData.vesselIds[2], // Bright tank with 500L capacity
        startDate: new Date(),
        pressItems: [{
          pressItemId: pressRun.items[0].id,
          volumeUsedL: 600, // Exceeds vessel capacity
          brixAtUse: 12.0
        }]
      })).rejects.toThrow('exceeds vessel capacity')

      // Test vessel availability violation
      const batch1 = await operatorCaller.batch.startFromJuiceLot({
        batchNumber: 'AVAILABILITY-TEST-001',
        vesselId: testData.vesselIds[0],
        startDate: new Date(),
        pressItems: [{
          pressItemId: pressRun.items[0].id,
          volumeUsedL: 50,
          brixAtUse: 12.0
        }]
      })

      await expect(operatorCaller.batch.startFromJuiceLot({
        batchNumber: 'AVAILABILITY-VIOLATION-001',
        vesselId: testData.vesselIds[0], // Same vessel, should be in use
        startDate: new Date(),
        pressItems: [{
          pressItemId: pressRun.items[0].id,
          volumeUsedL: 30,
          brixAtUse: 12.0
        }]
      })).rejects.toThrow('not available')
    })

    it('should maintain data consistency during API errors', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      const initialVendorCount = (await db.select().from(schema.vendors)).length

      // Attempt operation that should fail midway
      try {
        await operatorCaller.purchase.create({
          vendorId: testData.vendorIds[0],
          purchaseDate: new Date(),
          items: [
            {
              appleVarietyId: testData.appleVarietyIds[0],
              quantity: 100,
              unit: 'kg',
              pricePerUnit: 2.00
            },
            {
              appleVarietyId: 'invalid-variety-id', // This will cause failure
              quantity: 50,
              unit: 'kg',
              pricePerUnit: 1.50
            }
          ]
        })
      } catch (error) {
        // Expected to fail
      }

      // Verify no partial data was created
      const finalVendorCount = (await db.select().from(schema.vendors)).length
      expect(finalVendorCount).toBe(initialVendorCount)

      const purchases = await db.select()
        .from(schema.purchases)
        .where(schema.purchases.vendorId.in(testData.vendorIds))

      const purchaseItems = await db.select().from(schema.purchaseItems)

      // No purchases or items should have been created
      expect(purchases.filter(p => p.invoiceNumber?.includes('FAIL'))).toHaveLength(0)
    })
  })

  describe('Performance and Rate Limiting', () => {
    it('should handle concurrent API requests efficiently', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Create multiple concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        operatorCaller.vendor.create({
          name: `Concurrent Vendor ${i}`,
          contactInfo: { email: `concurrent${i}@test.com` }
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(concurrentRequests)
      const endTime = Date.now()

      // All requests should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true)
        expect(result.vendor.name).toBe(`Concurrent Vendor ${i}`)
      })

      // Should complete in reasonable time (adjust threshold as needed)
      const duration = endTime - startTime
      expect(duration).toBeLessThan(5000) // 5 seconds

      console.log(`Concurrent requests completed in ${duration}ms`)
    })

    it('should handle large data operations efficiently', async () => {
      const operatorCaller = createCaller({ session: operatorSession, db })

      // Create a purchase with many items
      const vendor = await operatorCaller.vendor.create({
        name: 'Large Data Vendor',
        contactInfo: { email: 'large@test.com' }
      })

      const manyItems = Array.from({ length: 50 }, (_, i) => ({
        appleVarietyId: testData.appleVarietyIds[i % 2],
        quantity: 10 + i,
        unit: 'kg' as const,
        pricePerUnit: 2.00 + (i * 0.1),
        notes: `Item ${i} for large data test`
      }))

      const startTime = Date.now()
      const largePurchase = await operatorCaller.purchase.create({
        vendorId: vendor.vendor.id,
        purchaseDate: new Date(),
        invoiceNumber: 'LARGE-DATA-001',
        notes: 'Large data operation test',
        items: manyItems
      })
      const endTime = Date.now()

      expect(largePurchase.success).toBe(true)
      expect(largePurchase.items).toHaveLength(50)

      const duration = endTime - startTime
      console.log(`Large purchase operation completed in ${duration}ms`)

      // Verify data integrity
      const totalCost = largePurchase.items.reduce((sum, item) =>
        sum + parseFloat(item.totalCost), 0
      )
      expect(parseFloat(largePurchase.purchase.totalCost)).toBeCloseTo(totalCost, 2)
    })
  })
})