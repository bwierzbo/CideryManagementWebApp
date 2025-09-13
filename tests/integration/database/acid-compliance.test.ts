/**
 * Database transaction ACID compliance tests
 * Tests Atomicity, Consistency, Isolation, and Durability
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, seedTestData } from './testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

describe('Database ACID Compliance Tests', () => {
  let db: NodePgDatabase
  let testData: {
    vendorIds: string[]
    appleVarietyIds: string[]
    vesselIds: string[]
    userIds: string[]
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

  describe('Atomicity Tests', () => {
    it('should rollback entire transaction when any operation fails', async () => {
      const initialVendorCount = await db.select().from(schema.vendors)
      const initialPurchaseCount = await db.select().from(schema.purchases)

      // Attempt transaction that should fail and rollback completely
      await expect(async () => {
        await db.transaction(async (tx) => {
          // Success: Create vendor
          const vendor = await tx.insert(schema.vendors).values({
            name: 'Atomic Test Vendor',
            contactInfo: { email: 'atomic@test.com' },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Success: Create purchase
          const purchase = await tx.insert(schema.purchases).values({
            vendorId: vendor[0].id,
            purchaseDate: new Date(),
            totalCost: '1000.00',
            invoiceNumber: 'ATOMIC-001',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Failure: Invalid foreign key reference (should cause rollback)
          await tx.insert(schema.purchaseItems).values({
            purchaseId: purchase[0].id,
            appleVarietyId: 'non-existent-variety-id', // Invalid FK
            quantity: '100',
            unit: 'kg',
            pricePerUnit: '10.00',
            totalCost: '1000.00',
            quantityKg: '100',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow()

      // Verify no data was committed
      const finalVendorCount = await db.select().from(schema.vendors)
      const finalPurchaseCount = await db.select().from(schema.purchases)

      expect(finalVendorCount.length).toBe(initialVendorCount.length)
      expect(finalPurchaseCount.length).toBe(initialPurchaseCount.length)

      // Specifically verify our test vendor was not created
      const atomicTestVendor = await db.select()
        .from(schema.vendors)
        .where(eq(schema.vendors.name, 'Atomic Test Vendor'))

      expect(atomicTestVendor).toHaveLength(0)
    })

    it('should commit all operations when transaction succeeds', async () => {
      const initialCounts = {
        vendors: (await db.select().from(schema.vendors)).length,
        purchases: (await db.select().from(schema.purchases)).length,
        purchaseItems: (await db.select().from(schema.purchaseItems)).length
      }

      // Successful transaction
      let createdIds: { vendorId: string; purchaseId: string; itemId: string }

      await db.transaction(async (tx) => {
        const vendor = await tx.insert(schema.vendors).values({
          name: 'Successful Atomic Vendor',
          contactInfo: { email: 'success@test.com' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const purchase = await tx.insert(schema.purchases).values({
          vendorId: vendor[0].id,
          purchaseDate: new Date(),
          totalCost: '500.00',
          invoiceNumber: 'SUCCESS-001',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const item = await tx.insert(schema.purchaseItems).values({
          purchaseId: purchase[0].id,
          appleVarietyId: testData.appleVarietyIds[0], // Valid FK
          quantity: '50',
          unit: 'kg',
          pricePerUnit: '10.00',
          totalCost: '500.00',
          quantityKg: '50',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        createdIds = {
          vendorId: vendor[0].id,
          purchaseId: purchase[0].id,
          itemId: item[0].id
        }
      })

      // Verify all data was committed
      const finalCounts = {
        vendors: (await db.select().from(schema.vendors)).length,
        purchases: (await db.select().from(schema.purchases)).length,
        purchaseItems: (await db.select().from(schema.purchaseItems)).length
      }

      expect(finalCounts.vendors).toBe(initialCounts.vendors + 1)
      expect(finalCounts.purchases).toBe(initialCounts.purchases + 1)
      expect(finalCounts.purchaseItems).toBe(initialCounts.purchaseItems + 1)

      // Verify specific records exist
      const vendor = await db.select()
        .from(schema.vendors)
        .where(eq(schema.vendors.id, createdIds!.vendorId))

      const purchase = await db.select()
        .from(schema.purchases)
        .where(eq(schema.purchases.id, createdIds!.purchaseId))

      const item = await db.select()
        .from(schema.purchaseItems)
        .where(eq(schema.purchaseItems.id, createdIds!.itemId))

      expect(vendor).toHaveLength(1)
      expect(purchase).toHaveLength(1)
      expect(item).toHaveLength(1)
    })
  })

  describe('Consistency Tests', () => {
    it('should maintain referential integrity across complex operations', async () => {
      // Create a complex workflow and verify all constraints are maintained
      await db.transaction(async (tx) => {
        // Create purchase chain
        const purchase = await tx.insert(schema.purchases).values({
          vendorId: testData.vendorIds[0],
          purchaseDate: new Date(),
          totalCost: '2000.00',
          invoiceNumber: 'CONSISTENCY-001',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const purchaseItem = await tx.insert(schema.purchaseItems).values({
          purchaseId: purchase[0].id,
          appleVarietyId: testData.appleVarietyIds[0],
          quantity: '1000',
          unit: 'kg',
          pricePerUnit: '2.00',
          totalCost: '2000.00',
          quantityKg: '1000',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        // Create press run
        const pressRun = await tx.insert(schema.pressRuns).values({
          runDate: new Date(),
          totalAppleProcessedKg: '1000',
          totalJuiceProducedL: '650',
          extractionRate: '0.65',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const pressItem = await tx.insert(schema.pressItems).values({
          pressRunId: pressRun[0].id,
          purchaseItemId: purchaseItem[0].id,
          quantityUsedKg: '1000',
          juiceProducedL: '650',
          brixMeasured: '12.0',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        // Create batch
        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'CONSISTENCY-BATCH-001',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '650',
          currentVolumeL: '650',
          targetAbv: '6.0',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        // Link batch to press item
        await tx.insert(schema.batchIngredients).values({
          batchId: batch[0].id,
          pressItemId: pressItem[0].id,
          volumeUsedL: '650',
          brixAtUse: '12.0',
          createdAt: new Date(),
          updatedAt: new Date()
        })

        // Verify all foreign key relationships are valid
        const fullChain = await tx
          .select({
            vendorId: schema.vendors.id,
            vendorName: schema.vendors.name,
            purchaseId: schema.purchases.id,
            purchaseItemId: schema.purchaseItems.id,
            appleVarietyId: schema.appleVarieties.id,
            appleVarietyName: schema.appleVarieties.name,
            pressRunId: schema.pressRuns.id,
            pressItemId: schema.pressItems.id,
            batchId: schema.batches.id,
            batchNumber: schema.batches.batchNumber,
            vesselId: schema.vessels.id,
            vesselName: schema.vessels.name
          })
          .from(schema.vendors)
          .innerJoin(schema.purchases, eq(schema.purchases.vendorId, schema.vendors.id))
          .innerJoin(schema.purchaseItems, eq(schema.purchaseItems.purchaseId, schema.purchases.id))
          .innerJoin(schema.appleVarieties, eq(schema.appleVarieties.id, schema.purchaseItems.appleVarietyId))
          .innerJoin(schema.pressItems, eq(schema.pressItems.purchaseItemId, schema.purchaseItems.id))
          .innerJoin(schema.pressRuns, eq(schema.pressRuns.id, schema.pressItems.pressRunId))
          .innerJoin(schema.batchIngredients, eq(schema.batchIngredients.pressItemId, schema.pressItems.id))
          .innerJoin(schema.batches, eq(schema.batches.id, schema.batchIngredients.batchId))
          .innerJoin(schema.vessels, eq(schema.vessels.id, schema.batches.vesselId))
          .where(eq(schema.batches.id, batch[0].id))

        expect(fullChain).toHaveLength(1)
        expect(fullChain[0].batchNumber).toBe('CONSISTENCY-BATCH-001')
      })
    })

    it('should enforce check constraints and data validity', async () => {
      // Test various constraint violations
      const constraintTests = [
        {
          name: 'negative quantity',
          operation: () => db.insert(schema.purchaseItems).values({
            purchaseId: 'dummy-id',
            appleVarietyId: testData.appleVarietyIds[0],
            quantity: '-10', // Negative quantity
            unit: 'kg',
            pricePerUnit: '2.00',
            totalCost: '-20.00',
            quantityKg: '-10',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        },
        {
          name: 'invalid vessel status',
          operation: () => db.update(schema.vessels)
            .set({ status: 'invalid_status' as any }) // Invalid enum value
            .where(eq(schema.vessels.id, testData.vesselIds[0]))
        },
        {
          name: 'negative vessel capacity',
          operation: () => db.update(schema.vessels)
            .set({ capacityL: '-100' }) // Negative capacity
            .where(eq(schema.vessels.id, testData.vesselIds[0]))
        }
      ]

      for (const test of constraintTests) {
        await expect(test.operation()).rejects.toThrow()
      }
    })
  })

  describe('Isolation Tests', () => {
    it('should handle concurrent transactions with proper isolation', async () => {
      // Create initial vessel status
      await db.update(schema.vessels)
        .set({ status: 'available' })
        .where(eq(schema.vessels.id, testData.vesselIds[0]))

      // Simulate concurrent batch creation attempts on same vessel
      const batch1Promise = db.transaction(async (tx) => {
        // Check vessel availability
        const vessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, testData.vesselIds[0]))
          .limit(1)

        if (vessel[0].status !== 'available') {
          throw new Error('Vessel not available for batch 1')
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100))

        // Create batch
        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'ISOLATION-BATCH-1',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '500',
          currentVolumeL: '500',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        // Mark vessel as in use
        await tx.update(schema.vessels)
          .set({ status: 'in_use', updatedAt: new Date() })
          .where(eq(schema.vessels.id, testData.vesselIds[0]))

        return batch[0]
      })

      const batch2Promise = db.transaction(async (tx) => {
        // Check vessel availability
        const vessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, testData.vesselIds[0]))
          .limit(1)

        if (vessel[0].status !== 'available') {
          throw new Error('Vessel not available for batch 2')
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100))

        // Create batch
        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'ISOLATION-BATCH-2',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '300',
          currentVolumeL: '300',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        // Mark vessel as in use
        await tx.update(schema.vessels)
          .set({ status: 'in_use', updatedAt: new Date() })
          .where(eq(schema.vessels.id, testData.vesselIds[0]))

        return batch[0]
      })

      // Execute concurrently
      const results = await Promise.allSettled([batch1Promise, batch2Promise])

      // One should succeed, one should fail (proper isolation)
      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')

      expect(successes.length).toBe(1)
      expect(failures.length).toBe(1)

      // Verify only one batch was created
      const batches = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.vesselId, testData.vesselIds[0]))

      expect(batches.length).toBe(1)

      // Verify vessel is properly marked as in use
      const finalVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, testData.vesselIds[0]))
        .limit(1)

      expect(finalVessel[0].status).toBe('in_use')
    })

    it('should maintain read consistency during concurrent operations', async () => {
      // Create batch with initial volume
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'READ-CONSISTENCY-001',
        status: 'active',
        vesselId: testData.vesselIds[0],
        startDate: new Date(),
        initialVolumeL: '1000',
        currentVolumeL: '1000',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Concurrent read and update operations
      const readPromise = db.transaction(async (tx) => {
        const readings: number[] = []

        // Multiple reads within transaction
        for (let i = 0; i < 5; i++) {
          const batchData = await tx.select()
            .from(schema.batches)
            .where(eq(schema.batches.id, batch[0].id))
            .limit(1)

          readings.push(parseFloat(batchData[0].currentVolumeL))
          await new Promise(resolve => setTimeout(resolve, 20))
        }

        return readings
      })

      const updatePromise = db.transaction(async (tx) => {
        await new Promise(resolve => setTimeout(resolve, 50))

        await tx.update(schema.batches)
          .set({
            currentVolumeL: '800',
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        return 'updated'
      })

      const [readResults, updateResult] = await Promise.all([readPromise, updatePromise])

      // All reads within the read transaction should see consistent values
      const uniqueReadings = [...new Set(readResults)]
      expect(uniqueReadings.length).toBe(1) // Should all see the same value
      expect(uniqueReadings[0]).toBe(1000) // Should see original value

      // Verify update completed
      expect(updateResult).toBe('updated')

      // Final verification
      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      expect(parseFloat(finalBatch[0].currentVolumeL)).toBe(800)
    })
  })

  describe('Durability Tests', () => {
    it('should persist committed transactions across connection resets', async () => {
      let batchId: string

      // Create and commit transaction
      await db.transaction(async (tx) => {
        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'DURABILITY-TEST-001',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '500',
          currentVolumeL: '500',
          notes: 'Durability test batch',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        batchId = batch[0].id

        // Add measurements
        await tx.insert(schema.batchMeasurements).values({
          batchId: batch[0].id,
          measurementDate: new Date(),
          specificGravity: '1.050',
          abv: '0.0',
          ph: '3.5',
          notes: 'Initial measurement for durability test',
          takenBy: 'Test System',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      })

      // Simulate connection issues/reset by creating new database connection
      const { db: newDbConnection } = getTestDatabase()

      // Verify data persists with new connection
      const persistedBatch = await newDbConnection.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batchId))
        .limit(1)

      const persistedMeasurements = await newDbConnection.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, batchId))

      expect(persistedBatch).toHaveLength(1)
      expect(persistedBatch[0].batchNumber).toBe('DURABILITY-TEST-001')
      expect(persistedBatch[0].notes).toBe('Durability test batch')

      expect(persistedMeasurements).toHaveLength(1)
      expect(persistedMeasurements[0].notes).toBe('Initial measurement for durability test')
    })

    it('should handle system recovery after failed transactions', async () => {
      const initialBatchCount = (await db.select().from(schema.batches)).length

      // Attempt transaction that will fail
      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.batches).values({
            batchNumber: 'RECOVERY-TEST-001',
            status: 'active',
            vesselId: testData.vesselIds[0],
            startDate: new Date(),
            initialVolumeL: '500',
            currentVolumeL: '500',
            createdAt: new Date(),
            updatedAt: new Date()
          })

          // Force failure
          throw new Error('Simulated system failure')
        })
      } catch (error) {
        expect(error.message).toBe('Simulated system failure')
      }

      // Verify no data was persisted
      const postFailureBatchCount = (await db.select().from(schema.batches)).length
      expect(postFailureBatchCount).toBe(initialBatchCount)

      // Verify system can continue normal operations
      const successfulBatch = await db.insert(schema.batches).values({
        batchNumber: 'RECOVERY-SUCCESS-001',
        status: 'active',
        vesselId: testData.vesselIds[1],
        startDate: new Date(),
        initialVolumeL: '300',
        currentVolumeL: '300',
        notes: 'Post-recovery successful batch',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      expect(successfulBatch).toHaveLength(1)
      expect(successfulBatch[0].batchNumber).toBe('RECOVERY-SUCCESS-001')

      const finalBatchCount = (await db.select().from(schema.batches)).length
      expect(finalBatchCount).toBe(initialBatchCount + 1)
    })
  })

  describe('Complex Transaction Scenarios', () => {
    it('should handle nested transaction-like operations with savepoints', async () => {
      let outerBatchId: string
      let innerBatchId: string

      await db.transaction(async (tx) => {
        // Outer operation
        const outerBatch = await tx.insert(schema.batches).values({
          batchNumber: 'SAVEPOINT-OUTER-001',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '1000',
          currentVolumeL: '1000',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        outerBatchId = outerBatch[0].id

        // Inner operation that might fail
        try {
          const innerBatch = await tx.insert(schema.batches).values({
            batchNumber: 'SAVEPOINT-INNER-001',
            status: 'active',
            vesselId: testData.vesselIds[1],
            startDate: new Date(),
            initialVolumeL: '500',
            currentVolumeL: '500',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          innerBatchId = innerBatch[0].id

          // This operation will succeed
          await tx.insert(schema.batchMeasurements).values({
            batchId: innerBatch[0].id,
            measurementDate: new Date(),
            specificGravity: '1.040',
            notes: 'Inner batch measurement',
            takenBy: 'Test',
            createdAt: new Date(),
            updatedAt: new Date()
          })

        } catch (innerError) {
          // In a real scenario with savepoints, we would rollback to savepoint
          // For this test, we'll let it fail the entire transaction
          throw innerError
        }

        // Continue with outer operations
        await tx.insert(schema.batchMeasurements).values({
          batchId: outerBatch[0].id,
          measurementDate: new Date(),
          specificGravity: '1.045',
          notes: 'Outer batch measurement',
          takenBy: 'Test',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      })

      // Verify both batches and measurements were created
      const outerBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, outerBatchId))

      const innerBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, innerBatchId))

      const allMeasurements = await db.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, outerBatchId))
        .orWhere(eq(schema.batchMeasurements.batchId, innerBatchId))

      expect(outerBatch).toHaveLength(1)
      expect(innerBatch).toHaveLength(1)
      expect(allMeasurements).toHaveLength(2)
    })

    it('should maintain data integrity during high-concurrency operations', async () => {
      // Create initial inventory
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'CONCURRENCY-TEST-001',
        status: 'completed',
        startDate: new Date(),
        initialVolumeL: '0',
        currentVolumeL: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const packageData = await db.insert(schema.packages).values({
        batchId: batch[0].id,
        packageDate: new Date(),
        volumePackagedL: '750',
        bottleSize: '750ml',
        bottleCount: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const inventory = await db.insert(schema.inventory).values({
        packageId: packageData[0].id,
        currentBottleCount: 1000,
        reservedBottleCount: 0,
        location: 'Warehouse',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Simulate multiple concurrent inventory operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        return db.transaction(async (tx) => {
          const current = await tx.select()
            .from(schema.inventory)
            .where(eq(schema.inventory.id, inventory[0].id))
            .limit(1)

          const changeAmount = i % 2 === 0 ? -5 : 3 // Alternating sales and returns
          const newCount = current[0].currentBottleCount + changeAmount

          if (newCount < 0) {
            throw new Error('Insufficient inventory')
          }

          await tx.update(schema.inventory)
            .set({
              currentBottleCount: newCount,
              updatedAt: new Date()
            })
            .where(eq(schema.inventory.id, inventory[0].id))

          await tx.insert(schema.inventoryTransactions).values({
            inventoryId: inventory[0].id,
            transactionType: changeAmount > 0 ? 'transfer' : 'sale',
            quantityChange: changeAmount,
            transactionDate: new Date(),
            reason: `Concurrent operation ${i}`,
            createdAt: new Date(),
            updatedAt: new Date()
          })

          return changeAmount
        })
      })

      // Execute all operations
      const results = await Promise.allSettled(operations)

      // Some may succeed, some may fail due to race conditions
      const successes = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[]
      const failures = results.filter(r => r.status === 'rejected')

      console.log(`Concurrency test: ${successes.length} successes, ${failures.length} failures`)

      // Verify final state is consistent
      const finalInventory = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventory[0].id))
        .limit(1)

      const allTransactions = await db.select()
        .from(schema.inventoryTransactions)
        .where(eq(schema.inventoryTransactions.inventoryId, inventory[0].id))

      // The final inventory count should equal initial count plus sum of all successful changes
      const totalChanges = successes.reduce((sum, result) => sum + result.value, 0)
      const expectedFinalCount = 1000 + totalChanges

      expect(finalInventory[0].currentBottleCount).toBe(expectedFinalCount)
      expect(allTransactions.length).toBe(successes.length)

      // Verify transaction balance
      const transactionSum = allTransactions.reduce((sum, tx) => sum + tx.quantityChange, 0)
      expect(transactionSum).toBe(totalChanges)
    })
  })
})