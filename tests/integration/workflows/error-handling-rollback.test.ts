/**
 * Error handling and rollback testing for failed operations
 * Tests transaction rollbacks, error recovery, and data consistency during failures
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, seedTestData } from '../database/testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

describe('Error Handling and Rollback Integration Tests', () => {
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

  describe('Transaction Rollback Scenarios', () => {
    it('should rollback complex multi-table operations on constraint violation', async () => {
      const initialCounts = {
        purchases: (await db.select().from(schema.purchases)).length,
        purchaseItems: (await db.select().from(schema.purchaseItems)).length,
        pressRuns: (await db.select().from(schema.pressRuns)).length,
        pressItems: (await db.select().from(schema.pressItems)).length,
        batches: (await db.select().from(schema.batches)).length
      }

      // Attempt complex operation that will fail at the end
      await expect(async () => {
        await db.transaction(async (tx) => {
          // Step 1: Create purchase (success)
          const purchase = await tx.insert(schema.purchases).values({
            vendorId: testData.vendorIds[0],
            purchaseDate: new Date(),
            totalCost: '1000.00',
            invoiceNumber: 'ROLLBACK-TEST-001',
            notes: 'Transaction rollback test',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Step 2: Create purchase items (success)
          const purchaseItems = await tx.insert(schema.purchaseItems).values([
            {
              purchaseId: purchase[0].id,
              appleVarietyId: testData.appleVarietyIds[0],
              quantity: '500',
              unit: 'kg',
              pricePerUnit: '2.00',
              totalCost: '1000.00',
              quantityKg: '500',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]).returning()

          // Step 3: Create press run (success)
          const pressRun = await tx.insert(schema.pressRuns).values({
            runDate: new Date(),
            totalAppleProcessedKg: '500',
            totalJuiceProducedL: '325',
            extractionRate: '0.65',
            notes: 'Press run that will be rolled back',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Step 4: Create press items (success)
          const pressItems = await tx.insert(schema.pressItems).values({
            pressRunId: pressRun[0].id,
            purchaseItemId: purchaseItems[0].id,
            quantityUsedKg: '500',
            juiceProducedL: '325',
            brixMeasured: '12.5',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Step 5: Attempt to create batch with invalid vessel ID (failure)
          await tx.insert(schema.batches).values({
            batchNumber: 'ROLLBACK-BATCH-001',
            status: 'active',
            vesselId: 'non-existent-vessel-id', // Invalid foreign key
            startDate: new Date(),
            initialVolumeL: '325',
            currentVolumeL: '325',
            targetAbv: '6.0',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow()

      // Verify no data was committed
      const finalCounts = {
        purchases: (await db.select().from(schema.purchases)).length,
        purchaseItems: (await db.select().from(schema.purchaseItems)).length,
        pressRuns: (await db.select().from(schema.pressRuns)).length,
        pressItems: (await db.select().from(schema.pressItems)).length,
        batches: (await db.select().from(schema.batches)).length
      }

      expect(finalCounts).toEqual(initialCounts)

      // Specifically verify our test data was not created
      const rollbackPurchase = await db.select()
        .from(schema.purchases)
        .where(eq(schema.purchases.invoiceNumber, 'ROLLBACK-TEST-001'))

      expect(rollbackPurchase).toHaveLength(0)
    })

    it('should rollback vessel state changes on batch creation failure', async () => {
      const vesselId = testData.vesselIds[0]

      // Verify initial vessel state
      const initialVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, vesselId))
        .limit(1)

      expect(initialVessel[0].status).toBe('available')

      // Attempt batch creation that changes vessel state but fails
      await expect(async () => {
        await db.transaction(async (tx) => {
          // Mark vessel as in use
          await tx.update(schema.vessels)
            .set({ status: 'in_use', updatedAt: new Date() })
            .where(eq(schema.vessels.id, vesselId))

          // Create batch ingredients with invalid press item (will fail)
          const batch = await tx.insert(schema.batches).values({
            batchNumber: 'VESSEL-ROLLBACK-001',
            status: 'active',
            vesselId: vesselId,
            startDate: new Date(),
            initialVolumeL: '500',
            currentVolumeL: '500',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // This will fail due to foreign key constraint
          await tx.insert(schema.batchIngredients).values({
            batchId: batch[0].id,
            pressItemId: 'non-existent-press-item-id',
            volumeUsedL: '500',
            brixAtUse: '12.0',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow()

      // Verify vessel state was rolled back
      const finalVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, vesselId))
        .limit(1)

      expect(finalVessel[0].status).toBe('available')

      // Verify no batch was created
      const rollbackBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.batchNumber, 'VESSEL-ROLLBACK-001'))

      expect(rollbackBatch).toHaveLength(0)
    })

    it('should rollback inventory updates on packaging failure', async () => {
      // Create test batch and initial package
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'INVENTORY-ROLLBACK-001',
        status: 'active',
        startDate: new Date(),
        initialVolumeL: '750',
        currentVolumeL: '750',
        actualAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const packageData = await db.insert(schema.packages).values({
        batchId: batch[0].id,
        packageDate: new Date(),
        volumePackagedL: '750',
        bottleSize: '750ml',
        bottleCount: 1000,
        abvAtPackaging: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const inventory = await db.insert(schema.inventory).values({
        packageId: packageData[0].id,
        currentBottleCount: 1000,
        reservedBottleCount: 0,
        location: 'Test Warehouse',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const initialInventoryCount = inventory[0].currentBottleCount

      // Attempt inventory update that should fail
      await expect(async () => {
        await db.transaction(async (tx) => {
          // Update inventory count
          await tx.update(schema.inventory)
            .set({
              currentBottleCount: 800, // Sell 200 bottles
              updatedAt: new Date()
            })
            .where(eq(schema.inventory.id, inventory[0].id))

          // Create transaction record with invalid enum value (will fail)
          await tx.insert(schema.inventoryTransactions).values({
            inventoryId: inventory[0].id,
            transactionType: 'invalid_transaction_type' as any, // Invalid enum
            quantityChange: -200,
            transactionDate: new Date(),
            reason: 'Test sale that will fail',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow()

      // Verify inventory count was rolled back
      const finalInventory = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventory[0].id))
        .limit(1)

      expect(finalInventory[0].currentBottleCount).toBe(initialInventoryCount)

      // Verify no transaction record was created
      const transactions = await db.select()
        .from(schema.inventoryTransactions)
        .where(eq(schema.inventoryTransactions.inventoryId, inventory[0].id))

      expect(transactions).toHaveLength(0)
    })
  })

  describe('Cascade Failure and Recovery', () => {
    it('should handle cascade failures in production workflow', async () => {
      const initialState = {
        purchases: (await db.select().from(schema.purchases)).length,
        pressRuns: (await db.select().from(schema.pressRuns)).length,
        batches: (await db.select().from(schema.batches)).length,
        vessels: await db.select().from(schema.vessels) // Full vessel state
      }

      // Create a complex workflow that fails at multiple points
      const workflow = async () => {
        await db.transaction(async (tx) => {
          // Success: Create purchase
          const purchase = await tx.insert(schema.purchases).values({
            vendorId: testData.vendorIds[0],
            purchaseDate: new Date(),
            totalCost: '2000.00',
            invoiceNumber: 'CASCADE-FAIL-001',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Success: Create purchase item
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

          // Success: Create press run
          const pressRun = await tx.insert(schema.pressRuns).values({
            runDate: new Date(),
            totalAppleProcessedKg: '1000',
            totalJuiceProducedL: '650',
            extractionRate: '0.65',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Success: Create press item
          const pressItem = await tx.insert(schema.pressItems).values({
            pressRunId: pressRun[0].id,
            purchaseItemId: purchaseItem[0].id,
            quantityUsedKg: '1000',
            juiceProducedL: '650',
            brixMeasured: '12.5',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Success: Mark vessel as in use
          await tx.update(schema.vessels)
            .set({ status: 'in_use' })
            .where(eq(schema.vessels.id, testData.vesselIds[0]))

          // Success: Create batch
          const batch = await tx.insert(schema.batches).values({
            batchNumber: 'CASCADE-BATCH-001',
            status: 'active',
            vesselId: testData.vesselIds[0],
            startDate: new Date(),
            initialVolumeL: '650',
            currentVolumeL: '650',
            targetAbv: '6.5',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Success: Create batch ingredients
          await tx.insert(schema.batchIngredients).values({
            batchId: batch[0].id,
            pressItemId: pressItem[0].id,
            volumeUsedL: '650',
            brixAtUse: '12.5',
            createdAt: new Date(),
            updatedAt: new Date()
          })

          // Failure: Invalid measurement data (this will cause rollback)
          await tx.insert(schema.batchMeasurements).values({
            batchId: batch[0].id,
            measurementDate: new Date(),
            specificGravity: 'invalid_number', // Invalid data type
            abv: '6.0',
            ph: '3.4',
            volumeL: '650',
            notes: 'This will fail',
            takenBy: 'Test',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }

      await expect(workflow()).rejects.toThrow()

      // Verify complete rollback
      const finalState = {
        purchases: (await db.select().from(schema.purchases)).length,
        pressRuns: (await db.select().from(schema.pressRuns)).length,
        batches: (await db.select().from(schema.batches)).length,
        vessels: await db.select().from(schema.vessels)
      }

      expect(finalState.purchases).toBe(initialState.purchases)
      expect(finalState.pressRuns).toBe(initialState.pressRuns)
      expect(finalState.batches).toBe(initialState.batches)

      // Verify vessel states are unchanged
      const vesselStates = finalState.vessels.reduce((acc, vessel) => {
        acc[vessel.id] = vessel.status
        return acc
      }, {} as Record<string, string>)

      const initialVesselStates = initialState.vessels.reduce((acc, vessel) => {
        acc[vessel.id] = vessel.status
        return acc
      }, {} as Record<string, string>)

      expect(vesselStates).toEqual(initialVesselStates)
    })

    it('should handle partial success with proper cleanup', async () => {
      // Test scenario where some operations succeed before failure
      let createdPurchaseId: string

      // First transaction: Create purchase (this will succeed)
      await db.transaction(async (tx) => {
        const purchase = await tx.insert(schema.purchases).values({
          vendorId: testData.vendorIds[0],
          purchaseDate: new Date(),
          totalCost: '1000.00',
          invoiceNumber: 'PARTIAL-SUCCESS-001',
          notes: 'Purchase that will succeed',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        createdPurchaseId = purchase[0].id
      })

      // Verify purchase was created
      const createdPurchase = await db.select()
        .from(schema.purchases)
        .where(eq(schema.purchases.id, createdPurchaseId))

      expect(createdPurchase).toHaveLength(1)

      // Second transaction: Attempt to add items (this will fail)
      await expect(async () => {
        await db.transaction(async (tx) => {
          // This should succeed
          await tx.insert(schema.purchaseItems).values({
            purchaseId: createdPurchaseId,
            appleVarietyId: testData.appleVarietyIds[0],
            quantity: '500',
            unit: 'kg',
            pricePerUnit: '2.00',
            totalCost: '1000.00',
            quantityKg: '500',
            createdAt: new Date(),
            updatedAt: new Date()
          })

          // This will fail - invalid apple variety
          await tx.insert(schema.purchaseItems).values({
            purchaseId: createdPurchaseId,
            appleVarietyId: 'invalid-variety-id',
            quantity: '200',
            unit: 'kg',
            pricePerUnit: '2.50',
            totalCost: '500.00',
            quantityKg: '200',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow()

      // Verify purchase still exists but no items were added
      const finalPurchase = await db.select()
        .from(schema.purchases)
        .where(eq(schema.purchases.id, createdPurchaseId))

      const purchaseItems = await db.select()
        .from(schema.purchaseItems)
        .where(eq(schema.purchaseItems.purchaseId, createdPurchaseId))

      expect(finalPurchase).toHaveLength(1)
      expect(purchaseItems).toHaveLength(0) // No items should exist due to rollback
    })
  })

  describe('Deadlock and Concurrency Error Handling', () => {
    it('should handle deadlock scenarios gracefully', async () => {
      const inventory1Id = await createTestInventory(1000)
      const inventory2Id = await createTestInventory(1000)

      // Simulate potential deadlock scenario with concurrent transactions
      const transaction1 = db.transaction(async (tx) => {
        await new Promise(resolve => setTimeout(resolve, 50)) // Simulate processing delay

        // Update inventory 1 first
        await tx.update(schema.inventory)
          .set({ currentBottleCount: 900, updatedAt: new Date() })
          .where(eq(schema.inventory.id, inventory1Id))

        await new Promise(resolve => setTimeout(resolve, 100)) // More delay

        // Then update inventory 2
        await tx.update(schema.inventory)
          .set({ currentBottleCount: 800, updatedAt: new Date() })
          .where(eq(schema.inventory.id, inventory2Id))

        return 'transaction1-success'
      })

      const transaction2 = db.transaction(async (tx) => {
        await new Promise(resolve => setTimeout(resolve, 75)) // Different delay

        // Update inventory 2 first (opposite order from transaction1)
        await tx.update(schema.inventory)
          .set({ currentBottleCount: 850, updatedAt: new Date() })
          .where(eq(schema.inventory.id, inventory2Id))

        await new Promise(resolve => setTimeout(resolve, 100))

        // Then update inventory 1
        await tx.update(schema.inventory)
          .set({ currentBottleCount: 950, updatedAt: new Date() })
          .where(eq(schema.inventory.id, inventory1Id))

        return 'transaction2-success'
      })

      // Execute transactions concurrently
      const results = await Promise.allSettled([transaction1, transaction2])

      // At least one should succeed (PostgreSQL handles deadlocks)
      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')

      expect(successes.length).toBeGreaterThanOrEqual(1)

      // Verify final state is consistent
      const finalInventory1 = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventory1Id))

      const finalInventory2 = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventory2Id))

      // Should have valid values (either original or updated)
      expect([900, 950, 1000]).toContain(finalInventory1[0].currentBottleCount)
      expect([800, 850, 1000]).toContain(finalInventory2[0].currentBottleCount)
    })

    it('should handle constraint violations during concurrent operations', async () => {
      const vesselId = testData.vesselIds[0]

      // Ensure vessel is available
      await db.update(schema.vessels)
        .set({ status: 'available' })
        .where(eq(schema.vessels.id, vesselId))

      // Concurrent batch creation attempts on same vessel
      const batchCreation1 = db.transaction(async (tx) => {
        const vessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, vesselId))
          .limit(1)

        if (vessel[0].status !== 'available') {
          throw new Error('Vessel not available for batch 1')
        }

        await new Promise(resolve => setTimeout(resolve, 100))

        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'CONSTRAINT-BATCH-1',
          status: 'active',
          vesselId: vesselId,
          startDate: new Date(),
          initialVolumeL: '500',
          currentVolumeL: '500',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, vesselId))

        return batch[0]
      })

      const batchCreation2 = db.transaction(async (tx) => {
        const vessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, vesselId))
          .limit(1)

        if (vessel[0].status !== 'available') {
          throw new Error('Vessel not available for batch 2')
        }

        await new Promise(resolve => setTimeout(resolve, 50))

        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'CONSTRAINT-BATCH-2',
          status: 'active',
          vesselId: vesselId,
          startDate: new Date(),
          initialVolumeL: '300',
          currentVolumeL: '300',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, vesselId))

        return batch[0]
      })

      const results = await Promise.allSettled([batchCreation1, batchCreation2])

      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')

      expect(successes.length).toBe(1)
      expect(failures.length).toBe(1)

      // Verify only one batch exists
      const batches = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.vesselId, vesselId))

      expect(batches.length).toBe(1)

      // Verify vessel is in use
      const finalVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, vesselId))

      expect(finalVessel[0].status).toBe('in_use')
    })
  })

  describe('Data Integrity Recovery', () => {
    it('should recover from orphaned records after failed operations', async () => {
      // Simulate scenario where batch is created but vessel update fails
      let orphanedBatchId: string

      try {
        await db.transaction(async (tx) => {
          const batch = await tx.insert(schema.batches).values({
            batchNumber: 'ORPHANED-BATCH-001',
            status: 'active',
            vesselId: testData.vesselIds[0],
            startDate: new Date(),
            initialVolumeL: '500',
            currentVolumeL: '500',
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          orphanedBatchId = batch[0].id

          // Simulate failure before vessel update
          throw new Error('Simulated failure before vessel update')
        })
      } catch (error) {
        // Expected failure
      }

      // Verify no batch was created due to rollback
      const orphanedBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.batchNumber, 'ORPHANED-BATCH-001'))

      expect(orphanedBatch).toHaveLength(0)

      // Verify vessel state is correct
      const vessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, testData.vesselIds[0]))

      expect(vessel[0].status).toBe('available')
    })

    it('should handle foreign key constraint cascades properly', async () => {
      // Create data hierarchy that will test cascade behavior
      const purchase = await db.insert(schema.purchases).values({
        vendorId: testData.vendorIds[0],
        purchaseDate: new Date(),
        totalCost: '1000.00',
        invoiceNumber: 'CASCADE-TEST-001',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const purchaseItem = await db.insert(schema.purchaseItems).values({
        purchaseId: purchase[0].id,
        appleVarietyId: testData.appleVarietyIds[0],
        quantity: '500',
        unit: 'kg',
        pricePerUnit: '2.00',
        totalCost: '1000.00',
        quantityKg: '500',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Attempt to delete vendor (should fail due to foreign key constraint)
      await expect(async () => {
        await db.delete(schema.vendors)
          .where(eq(schema.vendors.id, testData.vendorIds[0]))
      }).rejects.toThrow()

      // Verify vendor still exists
      const vendor = await db.select()
        .from(schema.vendors)
        .where(eq(schema.vendors.id, testData.vendorIds[0]))

      expect(vendor).toHaveLength(1)

      // Verify purchase and items still exist
      const finalPurchase = await db.select()
        .from(schema.purchases)
        .where(eq(schema.purchases.id, purchase[0].id))

      const finalPurchaseItem = await db.select()
        .from(schema.purchaseItems)
        .where(eq(schema.purchaseItems.id, purchaseItem[0].id))

      expect(finalPurchase).toHaveLength(1)
      expect(finalPurchaseItem).toHaveLength(1)
    })
  })

  // Helper function to create test inventory
  async function createTestInventory(bottleCount: number): Promise<string> {
    const batch = await db.insert(schema.batches).values({
      batchNumber: `TEST-BATCH-${Date.now()}`,
      status: 'completed',
      startDate: new Date(),
      initialVolumeL: '750',
      currentVolumeL: '0',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    const packageData = await db.insert(schema.packages).values({
      batchId: batch[0].id,
      packageDate: new Date(),
      volumePackagedL: '750',
      bottleSize: '750ml',
      bottleCount: bottleCount,
      abvAtPackaging: '6.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    const inventory = await db.insert(schema.inventory).values({
      packageId: packageData[0].id,
      currentBottleCount: bottleCount,
      reservedBottleCount: 0,
      location: 'Test Warehouse',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    return inventory[0].id
  }
})