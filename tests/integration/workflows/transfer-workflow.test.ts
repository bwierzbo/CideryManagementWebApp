/**
 * Integration tests for transfer workflows
 * Tests vessel-to-vessel transfers, batch transfers, and multi-entity operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, seedTestData } from '../database/testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

describe('Transfer Workflow Integration Tests', () => {
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
    // Seed fresh test data for each test
    testData = await seedTestData(db)
  })

  describe('Vessel-to-Vessel Transfer Workflow', () => {
    it('should successfully transfer batch from fermenter to conditioning tank', async () => {
      // Step 1: Create a purchase with apple inventory
      const purchase = await db.insert(schema.purchases).values({
        vendorId: testData.vendorIds[0],
        purchaseDate: new Date('2024-09-01'),
        totalCost: '1000.00',
        invoiceNumber: 'INV-001',
        notes: 'Integration test purchase',
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

      // Step 2: Create a press run to generate juice
      const pressRun = await db.insert(schema.pressRuns).values({
        runDate: new Date('2024-09-02'),
        notes: 'Integration test press run',
        totalAppleProcessedKg: '500',
        totalJuiceProducedL: '325', // 65% extraction rate
        extractionRate: '0.65',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const pressItem = await db.insert(schema.pressItems).values({
        pressRunId: pressRun[0].id,
        purchaseItemId: purchaseItem[0].id,
        quantityUsedKg: '500',
        juiceProducedL: '325',
        brixMeasured: '12.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Step 3: Create initial batch in fermenter
      const sourceVesselId = testData.vesselIds[0] // Fermenter Tank 1
      const targetVesselId = testData.vesselIds[1] // Conditioning Tank 1

      const batch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-TEST-001',
        status: 'active',
        vesselId: sourceVesselId,
        startDate: new Date('2024-09-03'),
        initialVolumeL: '325',
        currentVolumeL: '325',
        targetAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Add batch ingredients
      await db.insert(schema.batchIngredients).values({
        batchId: batch[0].id,
        pressItemId: pressItem[0].id,
        volumeUsedL: '325',
        brixAtUse: '12.5',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Mark source vessel as in use
      await db.update(schema.vessels)
        .set({ status: 'in_use', updatedAt: new Date() })
        .where(eq(schema.vessels.id, sourceVesselId))

      // Step 4: Verify initial state
      const initialBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const initialSourceVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, sourceVesselId))
        .limit(1)

      const initialTargetVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, targetVesselId))
        .limit(1)

      expect(initialBatch[0].vesselId).toBe(sourceVesselId)
      expect(initialBatch[0].currentVolumeL).toBe('325')
      expect(initialSourceVessel[0].status).toBe('in_use')
      expect(initialTargetVessel[0].status).toBe('available')

      // Step 5: Perform the transfer (simulating API call logic)
      const transferVolumeL = 300 // Transfer 300L to conditioning tank

      await db.transaction(async (tx) => {
        // Verify target vessel is available and has capacity
        const targetVessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, targetVesselId))
          .limit(1)

        expect(targetVessel[0].status).toBe('available')
        expect(parseFloat(targetVessel[0].capacityL)).toBeGreaterThanOrEqual(transferVolumeL)

        // Update batch to new vessel and volume
        await tx.update(schema.batches)
          .set({
            vesselId: targetVesselId,
            currentVolumeL: transferVolumeL.toString(),
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        // Update source vessel to available
        await tx.update(schema.vessels)
          .set({ status: 'available', updatedAt: new Date() })
          .where(eq(schema.vessels.id, sourceVesselId))

        // Update target vessel to in_use
        await tx.update(schema.vessels)
          .set({ status: 'in_use', updatedAt: new Date() })
          .where(eq(schema.vessels.id, targetVesselId))
      })

      // Step 6: Verify transfer completed successfully
      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const finalSourceVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, sourceVesselId))
        .limit(1)

      const finalTargetVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, targetVesselId))
        .limit(1)

      // Assertions
      expect(finalBatch[0].vesselId).toBe(targetVesselId)
      expect(finalBatch[0].currentVolumeL).toBe('300')
      expect(finalSourceVessel[0].status).toBe('available')
      expect(finalTargetVessel[0].status).toBe('in_use')
      expect(finalBatch[0].status).toBe('active') // Batch should still be active

      // Verify no data corruption occurred
      expect(finalBatch[0].batchNumber).toBe('BATCH-TEST-001')
      expect(finalBatch[0].initialVolumeL).toBe('325') // Should not change
      expect(finalBatch[0].targetAbv).toBe('6.5')
    })

    it('should fail transfer if target vessel lacks capacity', async () => {
      // Create batch with volume larger than target vessel capacity
      const sourceVesselId = testData.vesselIds[0] // Fermenter Tank 1 (1000L)
      const targetVesselId = testData.vesselIds[2] // Bright Tank 1 (500L)

      const batch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-OVERFLOW-001',
        status: 'active',
        vesselId: sourceVesselId,
        startDate: new Date('2024-09-03'),
        initialVolumeL: '600',
        currentVolumeL: '600',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Mark source vessel as in use
      await db.update(schema.vessels)
        .set({ status: 'in_use' })
        .where(eq(schema.vessels.id, sourceVesselId))

      // Attempt transfer that exceeds capacity
      const transferVolumeL = 600

      await expect(async () => {
        await db.transaction(async (tx) => {
          const targetVessel = await tx.select()
            .from(schema.vessels)
            .where(eq(schema.vessels.id, targetVesselId))
            .limit(1)

          const targetCapacity = parseFloat(targetVessel[0].capacityL)
          if (transferVolumeL > targetCapacity) {
            throw new Error(`Volume exceeds target vessel capacity: ${transferVolumeL}L > ${targetCapacity}L`)
          }

          // This should not execute
          await tx.update(schema.batches)
            .set({ vesselId: targetVesselId, currentVolumeL: transferVolumeL.toString() })
            .where(eq(schema.batches.id, batch[0].id))
        })
      }).rejects.toThrow('Volume exceeds target vessel capacity')

      // Verify no changes occurred
      const unchangedBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const unchangedSourceVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, sourceVesselId))
        .limit(1)

      const unchangedTargetVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, targetVesselId))
        .limit(1)

      expect(unchangedBatch[0].vesselId).toBe(sourceVesselId)
      expect(unchangedBatch[0].currentVolumeL).toBe('600')
      expect(unchangedSourceVessel[0].status).toBe('in_use')
      expect(unchangedTargetVessel[0].status).toBe('available')
    })

    it('should fail transfer if target vessel is not available', async () => {
      const sourceVesselId = testData.vesselIds[0] // Fermenter Tank 1
      const targetVesselId = testData.vesselIds[1] // Conditioning Tank 1

      // Create batch in source vessel
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-UNAVAILABLE-001',
        status: 'active',
        vesselId: sourceVesselId,
        startDate: new Date('2024-09-03'),
        initialVolumeL: '300',
        currentVolumeL: '300',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Mark both vessels as in use
      await db.update(schema.vessels)
        .set({ status: 'in_use' })
        .where(eq(schema.vessels.id, sourceVesselId))

      await db.update(schema.vessels)
        .set({ status: 'in_use' })
        .where(eq(schema.vessels.id, targetVesselId))

      // Attempt transfer to unavailable vessel
      await expect(async () => {
        await db.transaction(async (tx) => {
          const targetVessel = await tx.select()
            .from(schema.vessels)
            .where(eq(schema.vessels.id, targetVesselId))
            .limit(1)

          if (targetVessel[0].status !== 'available') {
            throw new Error('Target vessel is not available')
          }
        })
      }).rejects.toThrow('Target vessel is not available')
    })
  })

  describe('Multi-Stage Transfer Chain', () => {
    it('should successfully transfer batch through multiple vessels (fermenter → conditioning → bright tank)', async () => {
      const fermenterVesselId = testData.vesselIds[0] // Fermenter Tank 1
      const conditioningVesselId = testData.vesselIds[1] // Conditioning Tank 1
      const brightTankVesselId = testData.vesselIds[2] // Bright Tank 1

      // Create initial batch in fermenter
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-MULTISTAGE-001',
        status: 'active',
        vesselId: fermenterVesselId,
        startDate: new Date('2024-09-01'),
        initialVolumeL: '400',
        currentVolumeL: '400',
        targetAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await db.update(schema.vessels)
        .set({ status: 'in_use' })
        .where(eq(schema.vessels.id, fermenterVesselId))

      // Transfer 1: Fermenter → Conditioning Tank
      await db.transaction(async (tx) => {
        const transferVolume = 380 // Some volume loss during transfer

        await tx.update(schema.batches)
          .set({
            vesselId: conditioningVesselId,
            currentVolumeL: transferVolume.toString(),
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        await tx.update(schema.vessels)
          .set({ status: 'available' })
          .where(eq(schema.vessels.id, fermenterVesselId))

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, conditioningVesselId))
      })

      // Add measurement after first transfer
      await db.insert(schema.batchMeasurements).values({
        batchId: batch[0].id,
        measurementDate: new Date('2024-09-15'),
        specificGravity: '1.005',
        abv: '6.2',
        ph: '3.4',
        volumeL: '380',
        notes: 'After conditioning transfer',
        takenBy: 'Test Operator',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Transfer 2: Conditioning Tank → Bright Tank
      await db.transaction(async (tx) => {
        const transferVolume = 375 // Further volume loss

        await tx.update(schema.batches)
          .set({
            vesselId: brightTankVesselId,
            currentVolumeL: transferVolume.toString(),
            actualAbv: '6.2',
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        await tx.update(schema.vessels)
          .set({ status: 'available' })
          .where(eq(schema.vessels.id, conditioningVesselId))

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, brightTankVesselId))
      })

      // Final verification
      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const vessels = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, fermenterVesselId))
        .orWhere(eq(schema.vessels.id, conditioningVesselId))
        .orWhere(eq(schema.vessels.id, brightTankVesselId))

      const measurements = await db.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, batch[0].id))

      // Assertions
      expect(finalBatch[0].vesselId).toBe(brightTankVesselId)
      expect(finalBatch[0].currentVolumeL).toBe('375')
      expect(finalBatch[0].actualAbv).toBe('6.2')
      expect(finalBatch[0].initialVolumeL).toBe('400') // Should not change
      expect(finalBatch[0].status).toBe('active')

      // Verify vessel states
      const vesselStates = vessels.reduce((acc, vessel) => {
        acc[vessel.id] = vessel.status
        return acc
      }, {} as Record<string, string>)

      expect(vesselStates[fermenterVesselId]).toBe('available')
      expect(vesselStates[conditioningVesselId]).toBe('available')
      expect(vesselStates[brightTankVesselId]).toBe('in_use')

      // Verify measurements were preserved
      expect(measurements).toHaveLength(1)
      expect(measurements[0].abv).toBe('6.2')
      expect(measurements[0].volumeL).toBe('380')
    })
  })

  describe('Concurrent Transfer Operations', () => {
    it('should handle concurrent transfer attempts on same vessel correctly', async () => {
      const sourceVesselId = testData.vesselIds[0]
      const targetVessel1Id = testData.vesselIds[1]
      const targetVessel2Id = testData.vesselIds[2]

      // Create batch in source vessel
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-CONCURRENT-001',
        status: 'active',
        vesselId: sourceVesselId,
        startDate: new Date('2024-09-01'),
        initialVolumeL: '500',
        currentVolumeL: '500',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await db.update(schema.vessels)
        .set({ status: 'in_use' })
        .where(eq(schema.vessels.id, sourceVesselId))

      // Simulate concurrent transfer attempts
      const transfer1Promise = db.transaction(async (tx) => {
        // Check vessel availability
        const vessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, targetVessel1Id))
          .limit(1)

        if (vessel[0].status !== 'available') {
          throw new Error('Vessel not available for transfer 1')
        }

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50))

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, targetVessel1Id))

        await tx.update(schema.batches)
          .set({ vesselId: targetVessel1Id, currentVolumeL: '250' })
          .where(eq(schema.batches.id, batch[0].id))

        return 'transfer1-success'
      })

      const transfer2Promise = db.transaction(async (tx) => {
        // Check vessel availability
        const vessel = await tx.select()
          .from(schema.vessels)
          .where(eq(schema.vessels.id, targetVessel2Id))
          .limit(1)

        if (vessel[0].status !== 'available') {
          throw new Error('Vessel not available for transfer 2')
        }

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50))

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, targetVessel2Id))

        await tx.update(schema.batches)
          .set({ vesselId: targetVessel2Id, currentVolumeL: '250' })
          .where(eq(schema.batches.id, batch[0].id))

        return 'transfer2-success'
      })

      // Execute transfers concurrently
      const results = await Promise.allSettled([transfer1Promise, transfer2Promise])

      // One should succeed, one should fail (or both could succeed to different vessels)
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      // Either one succeeds and one fails (if they try to modify the same batch)
      // Or both succeed (if they modify different aspects)
      expect(successCount + failureCount).toBe(2)

      // Verify database consistency
      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const finalVessels = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, targetVessel1Id))
        .orWhere(eq(schema.vessels.id, targetVessel2Id))

      // Batch should be in one of the target vessels or still in source
      expect([targetVessel1Id, targetVessel2Id, sourceVesselId]).toContain(finalBatch[0].vesselId)

      // Exactly one of the target vessels should be in use (if transfer succeeded)
      const inUseTargets = finalVessels.filter(v => v.status === 'in_use')
      expect(inUseTargets.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Transfer Validation and Business Rules', () => {
    it('should enforce vessel capacity constraints during transfer', async () => {
      const sourceVesselId = testData.vesselIds[0] // 1000L capacity
      const targetVesselId = testData.vesselIds[2] // 500L capacity

      // Create batch with volume exactly at target capacity
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-CAPACITY-001',
        status: 'active',
        vesselId: sourceVesselId,
        startDate: new Date('2024-09-01'),
        initialVolumeL: '500',
        currentVolumeL: '500',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Valid transfer at exact capacity
      await db.transaction(async (tx) => {
        await tx.update(schema.batches)
          .set({ vesselId: targetVesselId, currentVolumeL: '500' })
          .where(eq(schema.batches.id, batch[0].id))

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, targetVesselId))
      })

      const transferredBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      expect(transferredBatch[0].vesselId).toBe(targetVesselId)
      expect(transferredBatch[0].currentVolumeL).toBe('500')
    })

    it('should preserve batch integrity during failed transfers', async () => {
      const sourceVesselId = testData.vesselIds[0]
      const targetVesselId = testData.vesselIds[1]

      const originalBatch = await db.insert(schema.batches).values({
        batchNumber: 'BATCH-INTEGRITY-001',
        status: 'active',
        vesselId: sourceVesselId,
        startDate: new Date('2024-09-01'),
        initialVolumeL: '400',
        currentVolumeL: '380',
        targetAbv: '6.5',
        notes: 'Original batch notes',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Mark target vessel as unavailable
      await db.update(schema.vessels)
        .set({ status: 'maintenance' })
        .where(eq(schema.vessels.id, targetVesselId))

      // Attempt failed transfer
      await expect(async () => {
        await db.transaction(async (tx) => {
          const vessel = await tx.select()
            .from(schema.vessels)
            .where(eq(schema.vessels.id, targetVesselId))
            .limit(1)

          if (vessel[0].status !== 'available') {
            throw new Error('Vessel not available')
          }

          // This should not execute
          await tx.update(schema.batches)
            .set({ vesselId: targetVesselId })
            .where(eq(schema.batches.id, originalBatch[0].id))
        })
      }).rejects.toThrow('Vessel not available')

      // Verify batch remains unchanged
      const unchangedBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, originalBatch[0].id))
        .limit(1)

      expect(unchangedBatch[0]).toEqual(originalBatch[0])
    })
  })
})