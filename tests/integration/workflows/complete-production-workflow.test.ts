/**
 * Integration tests for complete cidery production workflows
 * Tests end-to-end flow: Purchase → Press → Fermentation → Transfer → Packaging → Inventory
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, seedTestData } from '../database/testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

describe('Complete Production Workflow Integration Tests', () => {
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

  describe('Full Production Cycle: Purchase to Final Inventory', () => {
    it('should complete entire cidery production workflow with proper data tracking', async () => {
      // PHASE 1: PURCHASE AND RECEIVING
      console.log('PHASE 1: Creating purchase...')

      const purchase = await db.insert(schema.purchases).values({
        vendorId: testData.vendorIds[0],
        purchaseDate: new Date('2024-09-01'),
        totalCost: '5000.00',
        invoiceNumber: 'FULL-WORKFLOW-001',
        notes: 'Complete production workflow test',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const purchaseItems = await db.insert(schema.purchaseItems).values([
        {
          purchaseId: purchase[0].id,
          appleVarietyId: testData.appleVarietyIds[0], // Honeycrisp
          quantity: '1500',
          unit: 'kg',
          pricePerUnit: '2.50',
          totalCost: '3750.00',
          quantityKg: '1500',
          notes: 'Premium Honeycrisp apples',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          purchaseId: purchase[0].id,
          appleVarietyId: testData.appleVarietyIds[1], // Granny Smith
          quantity: '500',
          unit: 'kg',
          pricePerUnit: '2.00',
          totalCost: '1000.00',
          quantityKg: '500',
          notes: 'Granny Smith for acidity blend',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]).returning()

      // Verify purchase totals
      const purchaseTotal = purchaseItems.reduce((sum, item) => sum + parseFloat(item.totalCost), 0)
      expect(purchaseTotal).toBe(4750.00)

      // PHASE 2: PRESSING OPERATIONS
      console.log('PHASE 2: Executing press run...')

      const pressDate = new Date('2024-09-05')
      const totalAppleKg = 2000 // Using all purchased apples
      const expectedJuiceL = totalAppleKg * 0.68 // 68% extraction rate

      const pressRun = await db.insert(schema.pressRuns).values({
        runDate: pressDate,
        notes: 'Full production batch press run',
        totalAppleProcessedKg: totalAppleKg.toString(),
        totalJuiceProducedL: expectedJuiceL.toString(),
        extractionRate: '0.68',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const pressItems = await db.insert(schema.pressItems).values([
        {
          pressRunId: pressRun[0].id,
          purchaseItemId: purchaseItems[0].id, // Honeycrisp
          quantityUsedKg: '1500',
          juiceProducedL: (1500 * 0.68).toString(),
          brixMeasured: '13.2',
          notes: 'High brix Honeycrisp juice',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          pressRunId: pressRun[0].id,
          purchaseItemId: purchaseItems[1].id, // Granny Smith
          quantityUsedKg: '500',
          juiceProducedL: (500 * 0.68).toString(),
          brixMeasured: '11.8',
          notes: 'Tart Granny Smith juice',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]).returning()

      const totalJuiceProduced = pressItems.reduce((sum, item) => sum + parseFloat(item.juiceProducedL), 0)
      expect(totalJuiceProduced).toBe(expectedJuiceL)

      // PHASE 3: BATCH CREATION AND FERMENTATION
      console.log('PHASE 3: Starting fermentation batch...')

      const fermenterVesselId = testData.vesselIds[0] // Fermenter Tank 1
      const fermentationStartDate = new Date('2024-09-06')

      const batch = await db.insert(schema.batches).values({
        batchNumber: 'FULL-WF-2024-001',
        status: 'active',
        vesselId: fermenterVesselId,
        startDate: fermentationStartDate,
        targetCompletionDate: new Date('2024-10-06'),
        initialVolumeL: totalJuiceProduced.toString(),
        currentVolumeL: totalJuiceProduced.toString(),
        targetAbv: '6.8',
        notes: 'Honeycrisp-Granny blend for premium cider',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Add all press items as batch ingredients
      const batchIngredients = await db.insert(schema.batchIngredients).values(
        pressItems.map(item => ({
          batchId: batch[0].id,
          pressItemId: item.id,
          volumeUsedL: item.juiceProducedL,
          brixAtUse: item.brixMeasured,
          notes: `Added ${item.juiceProducedL}L from press item`,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      ).returning()

      // Mark fermenter as in use
      await db.update(schema.vessels)
        .set({ status: 'in_use', updatedAt: new Date() })
        .where(eq(schema.vessels.id, fermenterVesselId))

      // PHASE 4: FERMENTATION MONITORING
      console.log('PHASE 4: Adding fermentation measurements...')

      const measurements = [
        {
          date: new Date('2024-09-06'),
          sg: 1.055,
          abv: null,
          ph: 3.6,
          temp: 22,
          notes: 'Initial gravity - fermentation started'
        },
        {
          date: new Date('2024-09-13'),
          sg: 1.020,
          abv: 4.5,
          ph: 3.4,
          temp: 20,
          notes: 'Active fermentation - gravity dropping'
        },
        {
          date: new Date('2024-09-20'),
          sg: 1.002,
          abv: 6.5,
          ph: 3.3,
          temp: 18,
          notes: 'Fermentation slowing down'
        },
        {
          date: new Date('2024-09-27'),
          sg: 1.000,
          abv: 6.8,
          ph: 3.3,
          temp: 18,
          notes: 'Fermentation complete - target ABV reached'
        }
      ]

      for (const measurement of measurements) {
        await db.insert(schema.batchMeasurements).values({
          batchId: batch[0].id,
          measurementDate: measurement.date,
          specificGravity: measurement.sg.toString(),
          abv: measurement.abv?.toString(),
          ph: measurement.ph.toString(),
          temperature: measurement.temp.toString(),
          volumeL: (totalJuiceProduced * 0.98).toString(), // Account for evaporation
          notes: measurement.notes,
          takenBy: 'Workflow Test Operator',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }

      // Update batch with final ABV
      await db.update(schema.batches)
        .set({
          actualAbv: '6.8',
          currentVolumeL: (totalJuiceProduced * 0.98).toString(),
          updatedAt: new Date()
        })
        .where(eq(schema.batches.id, batch[0].id))

      // PHASE 5: TRANSFER TO CONDITIONING
      console.log('PHASE 5: Transferring to conditioning tank...')

      const conditioningVesselId = testData.vesselIds[1] // Conditioning Tank 1
      const transferDate = new Date('2024-09-28')
      const conditioningVolume = totalJuiceProduced * 0.96 // Further volume loss during transfer

      await db.transaction(async (tx) => {
        // Transfer batch to conditioning tank
        await tx.update(schema.batches)
          .set({
            vesselId: conditioningVesselId,
            currentVolumeL: conditioningVolume.toString(),
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        // Free fermenter
        await tx.update(schema.vessels)
          .set({ status: 'available', updatedAt: new Date() })
          .where(eq(schema.vessels.id, fermenterVesselId))

        // Mark conditioning tank as in use
        await tx.update(schema.vessels)
          .set({ status: 'in_use', updatedAt: new Date() })
          .where(eq(schema.vessels.id, conditioningVesselId))
      })

      // Add conditioning measurement
      await db.insert(schema.batchMeasurements).values({
        batchId: batch[0].id,
        measurementDate: transferDate,
        specificGravity: '1.000',
        abv: '6.8',
        ph: '3.2',
        temperature: '16',
        volumeL: conditioningVolume.toString(),
        notes: 'Transferred to conditioning - clear and stable',
        takenBy: 'Workflow Test Operator',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // PHASE 6: FINAL TRANSFER TO BRIGHT TANK
      console.log('PHASE 6: Final transfer to bright tank...')

      const brightTankVesselId = testData.vesselIds[2] // Bright Tank 1
      const finalTransferDate = new Date('2024-10-15')
      const finalVolume = conditioningVolume * 0.98 // Final volume loss

      await db.transaction(async (tx) => {
        await tx.update(schema.batches)
          .set({
            vesselId: brightTankVesselId,
            currentVolumeL: finalVolume.toString(),
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        await tx.update(schema.vessels)
          .set({ status: 'available', updatedAt: new Date() })
          .where(eq(schema.vessels.id, conditioningVesselId))

        await tx.update(schema.vessels)
          .set({ status: 'in_use', updatedAt: new Date() })
          .where(eq(schema.vessels.id, brightTankVesselId))
      })

      // PHASE 7: PACKAGING OPERATIONS
      console.log('PHASE 7: Packaging operations...')

      const packagingDate = new Date('2024-10-20')
      const packagingRuns = [
        {
          volume: Math.floor(finalVolume * 0.6), // 60% in 750ml bottles
          bottleSize: '750ml',
          location: 'Premium Warehouse'
        },
        {
          volume: Math.floor(finalVolume * 0.4), // 40% in 500ml bottles
          bottleSize: '500ml',
          location: 'Standard Warehouse'
        }
      ]

      const packageIds: string[] = []

      for (const [index, run] of packagingRuns.entries()) {
        const bottleCount = run.bottleSize === '750ml'
          ? Math.floor(run.volume / 0.75)
          : Math.floor(run.volume / 0.5)

        await db.transaction(async (tx) => {
          const newPackage = await tx.insert(schema.packages).values({
            batchId: batch[0].id,
            packageDate: new Date(packagingDate.getTime() + index * 24 * 60 * 60 * 1000), // Different days
            volumePackagedL: run.volume.toString(),
            bottleSize: run.bottleSize,
            bottleCount,
            abvAtPackaging: '6.8',
            notes: `Packaging run ${index + 1} - ${run.bottleSize} bottles`,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          packageIds.push(newPackage[0].id)

          const inventory = await tx.insert(schema.inventory).values({
            packageId: newPackage[0].id,
            currentBottleCount: bottleCount,
            reservedBottleCount: 0,
            location: run.location,
            notes: `Initial packaging - ${run.bottleSize} bottles`,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          await tx.insert(schema.inventoryTransactions).values({
            inventoryId: inventory[0].id,
            transactionType: 'transfer',
            quantityChange: bottleCount,
            transactionDate: packagingDate,
            reason: 'Initial packaging from production',
            notes: `Packaged ${bottleCount} x ${run.bottleSize} from batch ${batch[0].batchNumber}`,
            createdAt: new Date(),
            updatedAt: new Date()
          })

          // Update batch volume
          const currentBatch = await tx.select()
            .from(schema.batches)
            .where(eq(schema.batches.id, batch[0].id))
            .limit(1)

          const newVolume = parseFloat(currentBatch[0].currentVolumeL) - run.volume
          await tx.update(schema.batches)
            .set({
              currentVolumeL: Math.max(0, newVolume).toString(),
              updatedAt: new Date()
            })
            .where(eq(schema.batches.id, batch[0].id))
        })
      }

      // Complete batch and free vessel
      await db.transaction(async (tx) => {
        await tx.update(schema.batches)
          .set({
            status: 'completed',
            actualCompletionDate: packagingDate,
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        await tx.update(schema.vessels)
          .set({ status: 'available', updatedAt: new Date() })
          .where(eq(schema.vessels.id, brightTankVesselId))
      })

      // PHASE 8: COMPREHENSIVE VERIFICATION
      console.log('PHASE 8: Verifying complete workflow...')

      // Verify purchase data integrity
      const finalPurchase = await db.select()
        .from(schema.purchases)
        .innerJoin(schema.purchaseItems, eq(schema.purchaseItems.purchaseId, schema.purchases.id))
        .where(eq(schema.purchases.id, purchase[0].id))

      expect(finalPurchase).toHaveLength(2)

      // Verify press run data
      const finalPressRun = await db.select()
        .from(schema.pressRuns)
        .innerJoin(schema.pressItems, eq(schema.pressItems.pressRunId, schema.pressRuns.id))
        .where(eq(schema.pressRuns.id, pressRun[0].id))

      expect(finalPressRun).toHaveLength(2)

      // Verify batch completion
      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      expect(finalBatch[0].status).toBe('completed')
      expect(finalBatch[0].actualAbv).toBe('6.8')
      expect(finalBatch[0].actualCompletionDate).toBeTruthy()

      // Verify all measurements recorded
      const allMeasurements = await db.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, batch[0].id))
        .orderBy(desc(schema.batchMeasurements.measurementDate))

      expect(allMeasurements.length).toBeGreaterThanOrEqual(5) // 4 fermentation + 1 conditioning + possibly more

      // Verify packaging and inventory
      const finalPackages = await db.select()
        .from(schema.packages)
        .where(eq(schema.packages.batchId, batch[0].id))

      const finalInventory = await db.select()
        .from(schema.inventory)
        .innerJoin(schema.packages, eq(schema.packages.id, schema.inventory.packageId))
        .where(eq(schema.packages.batchId, batch[0].id))

      expect(finalPackages).toHaveLength(2)
      expect(finalInventory).toHaveLength(2)

      // Verify total bottle production
      const totalBottles = finalInventory.reduce((sum, inv) => sum + inv.inventory.currentBottleCount, 0)
      const totalPackagedVolume = finalPackages.reduce((sum, pkg) => sum + parseFloat(pkg.volumePackagedL), 0)

      expect(totalBottles).toBeGreaterThan(0)
      expect(totalPackagedVolume).toBeGreaterThan(0)
      expect(totalPackagedVolume).toBeLessThan(totalJuiceProduced) // Should be less due to evaporation

      // Verify vessel states (all should be available)
      const allVessels = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, fermenterVesselId))
        .orWhere(eq(schema.vessels.id, conditioningVesselId))
        .orWhere(eq(schema.vessels.id, brightTankVesselId))

      allVessels.forEach(vessel => {
        expect(vessel.status).toBe('available')
      })

      // Verify inventory transactions
      const allTransactions = await db.select()
        .from(schema.inventoryTransactions)
        .innerJoin(schema.inventory, eq(schema.inventory.id, schema.inventoryTransactions.inventoryId))
        .innerJoin(schema.packages, eq(schema.packages.id, schema.inventory.packageId))
        .where(eq(schema.packages.batchId, batch[0].id))

      expect(allTransactions).toHaveLength(2) // One per package

      // Calculate production efficiency
      const inputAppleKg = 2000
      const outputJuiceL = totalJuiceProduced
      const finalPackagedL = totalPackagedVolume
      const extractionRate = outputJuiceL / inputAppleKg
      const packagingEfficiency = finalPackagedL / outputJuiceL

      expect(extractionRate).toBeCloseTo(0.68, 2)
      expect(packagingEfficiency).toBeGreaterThan(0.9) // Should retain >90% through processing
      expect(packagingEfficiency).toBeLessThan(1.0)

      console.log(`Workflow completed successfully:`)
      console.log(`- Input: ${inputAppleKg}kg apples`)
      console.log(`- Juice produced: ${outputJuiceL}L (${(extractionRate * 100).toFixed(1)}% extraction)`)
      console.log(`- Final packaged: ${finalPackagedL}L (${(packagingEfficiency * 100).toFixed(1)}% efficiency)`)
      console.log(`- Total bottles: ${totalBottles}`)
      console.log(`- Final ABV: ${finalBatch[0].actualAbv}%`)
    }, 60000) // 60 second timeout for complete workflow

    it('should handle parallel production batches without interference', async () => {
      // Create two independent production workflows running in parallel
      const batch1Promise = createProductionBatch('PARALLEL-BATCH-1', testData.vendorIds[0], testData.vesselIds[0])
      const batch2Promise = createProductionBatch('PARALLEL-BATCH-2', testData.vendorIds[0], testData.vesselIds[1])

      const [batch1Result, batch2Result] = await Promise.all([batch1Promise, batch2Promise])

      // Verify both batches completed successfully
      expect(batch1Result.batch.status).toBe('active')
      expect(batch2Result.batch.status).toBe('active')
      expect(batch1Result.batch.batchNumber).toBe('PARALLEL-BATCH-1')
      expect(batch2Result.batch.batchNumber).toBe('PARALLEL-BATCH-2')

      // Verify they use different vessels
      expect(batch1Result.batch.vesselId).not.toBe(batch2Result.batch.vesselId)

      // Verify data integrity for both batches
      const batch1Measurements = await db.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, batch1Result.batch.id))

      const batch2Measurements = await db.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, batch2Result.batch.id))

      expect(batch1Measurements.length).toBeGreaterThan(0)
      expect(batch2Measurements.length).toBeGreaterThan(0)

      // Verify no cross-contamination of data
      const batch1Ingredients = await db.select()
        .from(schema.batchIngredients)
        .where(eq(schema.batchIngredients.batchId, batch1Result.batch.id))

      const batch2Ingredients = await db.select()
        .from(schema.batchIngredients)
        .where(eq(schema.batchIngredients.batchId, batch2Result.batch.id))

      expect(batch1Ingredients.length).toBeGreaterThan(0)
      expect(batch2Ingredients.length).toBeGreaterThan(0)

      // Ensure no shared ingredients between batches
      const batch1PressItemIds = batch1Ingredients.map(i => i.pressItemId)
      const batch2PressItemIds = batch2Ingredients.map(i => i.pressItemId)

      const overlap = batch1PressItemIds.filter(id => batch2PressItemIds.includes(id))
      expect(overlap).toHaveLength(0)
    })
  })

  // Helper function to create a simplified production batch
  async function createProductionBatch(batchNumber: string, vendorId: string, vesselId: string) {
    const purchase = await db.insert(schema.purchases).values({
      vendorId,
      purchaseDate: new Date(),
      totalCost: '1000.00',
      invoiceNumber: `INV-${batchNumber}`,
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

    const pressRun = await db.insert(schema.pressRuns).values({
      runDate: new Date(),
      totalAppleProcessedKg: '500',
      totalJuiceProducedL: '325',
      extractionRate: '0.65',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    const pressItem = await db.insert(schema.pressItems).values({
      pressRunId: pressRun[0].id,
      purchaseItemId: purchaseItem[0].id,
      quantityUsedKg: '500',
      juiceProducedL: '325',
      brixMeasured: '12.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    const batch = await db.insert(schema.batches).values({
      batchNumber,
      status: 'active',
      vesselId,
      startDate: new Date(),
      initialVolumeL: '325',
      currentVolumeL: '325',
      targetAbv: '6.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    await db.insert(schema.batchIngredients).values({
      batchId: batch[0].id,
      pressItemId: pressItem[0].id,
      volumeUsedL: '325',
      brixAtUse: '12.0',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await db.insert(schema.batchMeasurements).values({
      batchId: batch[0].id,
      measurementDate: new Date(),
      specificGravity: '1.045',
      abv: '0.0',
      ph: '3.5',
      volumeL: '325',
      notes: 'Initial measurement',
      takenBy: 'Test',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await db.update(schema.vessels)
      .set({ status: 'in_use' })
      .where(eq(schema.vessels.id, vesselId))

    return {
      purchase: purchase[0],
      batch: batch[0],
      pressRun: pressRun[0],
      pressItem: pressItem[0]
    }
  }
})