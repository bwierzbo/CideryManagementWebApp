/**
 * Integration tests for packaging operations with inventory updates
 * Tests packaging runs, inventory creation, transaction tracking, and COGS calculations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, isNull, sum, sql } from 'drizzle-orm'
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, seedTestData } from '../database/testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

describe('Packaging Workflow Integration Tests', () => {
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

  describe('Complete Packaging Operations', () => {
    it('should successfully package batch with inventory creation and tracking', async () => {
      // Step 1: Set up complete production chain
      const purchase = await db.insert(schema.purchases).values({
        vendorId: testData.vendorIds[0],
        purchaseDate: new Date('2024-09-01'),
        totalCost: '2000.00',
        invoiceNumber: 'PKG-001',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const purchaseItem = await db.insert(schema.purchaseItems).values({
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

      const pressRun = await db.insert(schema.pressRuns).values({
        runDate: new Date('2024-09-02'),
        totalAppleProcessedKg: '1000',
        totalJuiceProducedL: '650', // 65% extraction
        extractionRate: '0.65',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const pressItem = await db.insert(schema.pressItems).values({
        pressRunId: pressRun[0].id,
        purchaseItemId: purchaseItem[0].id,
        quantityUsedKg: '1000',
        juiceProducedL: '650',
        brixMeasured: '12.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const batch = await db.insert(schema.batches).values({
        batchNumber: 'PKG-BATCH-001',
        status: 'active',
        vesselId: testData.vesselIds[2], // Bright tank for packaging
        startDate: new Date('2024-09-03'),
        initialVolumeL: '650',
        currentVolumeL: '620', // Some evaporation during fermentation
        targetAbv: '6.5',
        actualAbv: '6.3',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await db.insert(schema.batchIngredients).values({
        batchId: batch[0].id,
        pressItemId: pressItem[0].id,
        volumeUsedL: '650',
        brixAtUse: '12.5',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Add final measurements
      await db.insert(schema.batchMeasurements).values({
        batchId: batch[0].id,
        measurementDate: new Date('2024-09-20'),
        specificGravity: '1.000',
        abv: '6.3',
        ph: '3.3',
        volumeL: '620',
        notes: 'Ready for packaging',
        takenBy: 'Operator',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Step 2: Execute packaging operation
      const packageDate = new Date('2024-09-21')
      const volumeToPackage = 600 // Leave 20L for losses
      const bottleSize = '750ml'
      const bottleCount = 800 // 600L / 0.75L per bottle
      const abvAtPackaging = 6.3
      const packagingLocation = 'Warehouse A'

      let packageId: string
      let inventoryId: string

      await db.transaction(async (tx) => {
        // Verify batch has enough volume
        const currentBatch = await tx.select()
          .from(schema.batches)
          .where(eq(schema.batches.id, batch[0].id))
          .limit(1)

        expect(parseFloat(currentBatch[0].currentVolumeL)).toBeGreaterThanOrEqual(volumeToPackage)

        // Create package record
        const newPackage = await tx.insert(schema.packages).values({
          batchId: batch[0].id,
          packageDate,
          volumePackagedL: volumeToPackage.toString(),
          bottleSize,
          bottleCount,
          abvAtPackaging: abvAtPackaging.toString(),
          notes: 'Integration test packaging',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        packageId = newPackage[0].id

        // Create initial inventory
        const newInventory = await tx.insert(schema.inventory).values({
          packageId,
          currentBottleCount: bottleCount,
          reservedBottleCount: 0,
          location: packagingLocation,
          notes: `Packaged from ${currentBatch[0].batchNumber}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        inventoryId = newInventory[0].id

        // Create initial inventory transaction
        await tx.insert(schema.inventoryTransactions).values({
          inventoryId,
          transactionType: 'transfer',
          quantityChange: bottleCount,
          transactionDate: packageDate,
          reason: 'Initial packaging',
          notes: `Packaged ${bottleCount} bottles from batch ${currentBatch[0].batchNumber}`,
          createdAt: new Date(),
          updatedAt: new Date()
        })

        // Update batch volume
        const remainingVolume = parseFloat(currentBatch[0].currentVolumeL) - volumeToPackage
        await tx.update(schema.batches)
          .set({
            currentVolumeL: remainingVolume.toString(),
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        // If fully packaged, mark batch as completed and free vessel
        if (remainingVolume <= 1) { // Allow for minimal rounding
          await tx.update(schema.batches)
            .set({
              status: 'completed',
              actualCompletionDate: packageDate,
              updatedAt: new Date()
            })
            .where(eq(schema.batches.id, batch[0].id))

          await tx.update(schema.vessels)
            .set({
              status: 'available',
              updatedAt: new Date()
            })
            .where(eq(schema.vessels.id, testData.vesselIds[2]))
        }
      })

      // Step 3: Verify packaging results
      const finalPackage = await db.select()
        .from(schema.packages)
        .where(eq(schema.packages.id, packageId))
        .limit(1)

      const finalInventory = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventoryId))
        .limit(1)

      const inventoryTransactions = await db.select()
        .from(schema.inventoryTransactions)
        .where(eq(schema.inventoryTransactions.inventoryId, inventoryId))

      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const finalVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, testData.vesselIds[2]))
        .limit(1)

      // Assertions
      expect(finalPackage[0].volumePackagedL).toBe('600')
      expect(finalPackage[0].bottleCount).toBe(800)
      expect(finalPackage[0].bottleSize).toBe('750ml')
      expect(finalPackage[0].abvAtPackaging).toBe('6.3')

      expect(finalInventory[0].currentBottleCount).toBe(800)
      expect(finalInventory[0].reservedBottleCount).toBe(0)
      expect(finalInventory[0].location).toBe('Warehouse A')

      expect(inventoryTransactions).toHaveLength(1)
      expect(inventoryTransactions[0].transactionType).toBe('transfer')
      expect(inventoryTransactions[0].quantityChange).toBe(800)
      expect(inventoryTransactions[0].reason).toBe('Initial packaging')

      expect(finalBatch[0].currentVolumeL).toBe('20')
      expect(finalBatch[0].status).toBe('active') // Still has some volume left
      expect(finalVessel[0].status).toBe('in_use') // Vessel still in use
    })

    it('should complete batch and free vessel when fully packaged', async () => {
      // Create a smaller batch that will be fully packaged
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'PKG-COMPLETE-001',
        status: 'active',
        vesselId: testData.vesselIds[2],
        startDate: new Date('2024-09-01'),
        initialVolumeL: '375', // Exactly 500 bottles at 750ml
        currentVolumeL: '375',
        actualAbv: '6.0',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await db.update(schema.vessels)
        .set({ status: 'in_use' })
        .where(eq(schema.vessels.id, testData.vesselIds[2]))

      // Package the entire batch
      await db.transaction(async (tx) => {
        const packageDate = new Date()
        const volumeToPackage = 375
        const bottleCount = 500

        const newPackage = await tx.insert(schema.packages).values({
          batchId: batch[0].id,
          packageDate,
          volumePackagedL: volumeToPackage.toString(),
          bottleSize: '750ml',
          bottleCount,
          abvAtPackaging: '6.0',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        await tx.insert(schema.inventory).values({
          packageId: newPackage[0].id,
          currentBottleCount: bottleCount,
          reservedBottleCount: 0,
          location: 'Warehouse B',
          createdAt: new Date(),
          updatedAt: new Date()
        })

        // Update batch - fully packaged
        await tx.update(schema.batches)
          .set({
            currentVolumeL: '0',
            status: 'completed',
            actualCompletionDate: packageDate,
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        // Free the vessel
        await tx.update(schema.vessels)
          .set({
            status: 'available',
            updatedAt: new Date()
          })
          .where(eq(schema.vessels.id, testData.vesselIds[2]))
      })

      // Verify completion
      const completedBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      const freedVessel = await db.select()
        .from(schema.vessels)
        .where(eq(schema.vessels.id, testData.vesselIds[2]))
        .limit(1)

      expect(completedBatch[0].status).toBe('completed')
      expect(completedBatch[0].currentVolumeL).toBe('0')
      expect(completedBatch[0].actualCompletionDate).toBeTruthy()
      expect(freedVessel[0].status).toBe('available')
    })
  })

  describe('Inventory Management Operations', () => {
    it('should handle inventory adjustments with proper transaction tracking', async () => {
      // Create package and inventory
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'INV-ADJ-001',
        status: 'completed',
        startDate: new Date('2024-09-01'),
        initialVolumeL: '750',
        currentVolumeL: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const packageData = await db.insert(schema.packages).values({
        batchId: batch[0].id,
        packageDate: new Date('2024-09-10'),
        volumePackagedL: '750',
        bottleSize: '750ml',
        bottleCount: 1000,
        abvAtPackaging: '6.0',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const inventory = await db.insert(schema.inventory).values({
        packageId: packageData[0].id,
        currentBottleCount: 1000,
        reservedBottleCount: 0,
        location: 'Warehouse A',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Initial transaction
      await db.insert(schema.inventoryTransactions).values({
        inventoryId: inventory[0].id,
        transactionType: 'transfer',
        quantityChange: 1000,
        transactionDate: new Date('2024-09-10'),
        reason: 'Initial packaging',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Perform various inventory operations
      const operations = [
        { type: 'sale', change: -100, reason: 'Direct sales', expectedCount: 900 },
        { type: 'adjustment', change: -5, reason: 'Breakage during handling', expectedCount: 895 },
        { type: 'transfer', change: 50, reason: 'Returns from distributor', expectedCount: 945 },
        { type: 'waste', change: -10, reason: 'Quality control disposal', expectedCount: 935 }
      ]

      for (const op of operations) {
        await db.transaction(async (tx) => {
          const currentInventory = await tx.select()
            .from(schema.inventory)
            .where(eq(schema.inventory.id, inventory[0].id))
            .limit(1)

          const newCount = currentInventory[0].currentBottleCount + op.change

          if (newCount < 0) {
            throw new Error('Insufficient inventory')
          }

          await tx.update(schema.inventory)
            .set({
              currentBottleCount: newCount,
              updatedAt: new Date()
            })
            .where(eq(schema.inventory.id, inventory[0].id))

          await tx.insert(schema.inventoryTransactions)
            .values({
              inventoryId: inventory[0].id,
              transactionType: op.type as any,
              quantityChange: op.change,
              transactionDate: new Date(),
              reason: op.reason,
              createdAt: new Date(),
              updatedAt: new Date()
            })
        })

        // Verify after each operation
        const updatedInventory = await db.select()
          .from(schema.inventory)
          .where(eq(schema.inventory.id, inventory[0].id))
          .limit(1)

        expect(updatedInventory[0].currentBottleCount).toBe(op.expectedCount)
      }

      // Verify all transactions recorded
      const allTransactions = await db.select()
        .from(schema.inventoryTransactions)
        .where(eq(schema.inventoryTransactions.inventoryId, inventory[0].id))

      expect(allTransactions).toHaveLength(5) // Initial + 4 operations

      // Verify transaction balance
      const totalChange = allTransactions.reduce((sum, tx) => sum + tx.quantityChange, 0)
      expect(totalChange).toBe(935) // Final inventory count
    })

    it('should prevent negative inventory with proper error handling', async () => {
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'INV-NEG-001',
        status: 'completed',
        startDate: new Date(),
        initialVolumeL: '375',
        currentVolumeL: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const packageData = await db.insert(schema.packages).values({
        batchId: batch[0].id,
        packageDate: new Date(),
        volumePackagedL: '375',
        bottleSize: '750ml',
        bottleCount: 500,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const inventory = await db.insert(schema.inventory).values({
        packageId: packageData[0].id,
        currentBottleCount: 100, // Low stock
        reservedBottleCount: 0,
        location: 'Warehouse',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Attempt to sell more than available
      await expect(async () => {
        await db.transaction(async (tx) => {
          const currentInventory = await tx.select()
            .from(schema.inventory)
            .where(eq(schema.inventory.id, inventory[0].id))
            .limit(1)

          const attemptedSale = 150
          const newCount = currentInventory[0].currentBottleCount - attemptedSale

          if (newCount < 0) {
            throw new Error(`Insufficient inventory: attempted ${attemptedSale}, available ${currentInventory[0].currentBottleCount}`)
          }

          await tx.update(schema.inventory)
            .set({ currentBottleCount: newCount })
            .where(eq(schema.inventory.id, inventory[0].id))
        })
      }).rejects.toThrow('Insufficient inventory')

      // Verify inventory unchanged
      const unchangedInventory = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventory[0].id))
        .limit(1)

      expect(unchangedInventory[0].currentBottleCount).toBe(100)
    })
  })

  describe('Multi-Package Batch Operations', () => {
    it('should handle multiple packaging runs from same batch', async () => {
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'MULTI-PKG-001',
        status: 'active',
        vesselId: testData.vesselIds[2],
        startDate: new Date('2024-09-01'),
        initialVolumeL: '1000',
        currentVolumeL: '1000',
        actualAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const packagingRuns = [
        { volume: 375, bottles: 500, size: '750ml', location: 'Warehouse A' },
        { volume: 300, bottles: 600, size: '500ml', location: 'Warehouse B' },
        { volume: 300, bottles: 400, size: '750ml', location: 'Warehouse A' }
      ]

      const packageIds: string[] = []

      for (const [index, run] of packagingRuns.entries()) {
        await db.transaction(async (tx) => {
          const currentBatch = await tx.select()
            .from(schema.batches)
            .where(eq(schema.batches.id, batch[0].id))
            .limit(1)

          expect(parseFloat(currentBatch[0].currentVolumeL)).toBeGreaterThanOrEqual(run.volume)

          const newPackage = await tx.insert(schema.packages).values({
            batchId: batch[0].id,
            packageDate: new Date(`2024-09-${15 + index}`),
            volumePackagedL: run.volume.toString(),
            bottleSize: run.size,
            bottleCount: run.bottles,
            abvAtPackaging: '6.5',
            notes: `Packaging run ${index + 1}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          packageIds.push(newPackage[0].id)

          await tx.insert(schema.inventory).values({
            packageId: newPackage[0].id,
            currentBottleCount: run.bottles,
            reservedBottleCount: 0,
            location: run.location,
            createdAt: new Date(),
            updatedAt: new Date()
          })

          const remainingVolume = parseFloat(currentBatch[0].currentVolumeL) - run.volume
          await tx.update(schema.batches)
            .set({
              currentVolumeL: remainingVolume.toString(),
              updatedAt: new Date()
            })
            .where(eq(schema.batches.id, batch[0].id))
        })
      }

      // Verify all packages created
      const allPackages = await db.select()
        .from(schema.packages)
        .where(eq(schema.packages.batchId, batch[0].id))

      const allInventory = await db.select()
        .from(schema.inventory)
        .innerJoin(schema.packages, eq(schema.packages.id, schema.inventory.packageId))
        .where(eq(schema.packages.batchId, batch[0].id))

      const finalBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      expect(allPackages).toHaveLength(3)
      expect(allInventory).toHaveLength(3)

      // Verify volume tracking
      const totalPackaged = allPackages.reduce((sum, pkg) => sum + parseFloat(pkg.volumePackagedL), 0)
      expect(totalPackaged).toBe(975) // 375 + 300 + 300
      expect(parseFloat(finalBatch[0].currentVolumeL)).toBe(25) // 1000 - 975

      // Verify inventory by location
      const warehouseA = allInventory.filter(inv => inv.inventory.location === 'Warehouse A')
      const warehouseB = allInventory.filter(inv => inv.inventory.location === 'Warehouse B')

      expect(warehouseA).toHaveLength(2)
      expect(warehouseB).toHaveLength(1)

      const warehouseABottles = warehouseA.reduce((sum, inv) => sum + inv.inventory.currentBottleCount, 0)
      const warehouseBBottles = warehouseB.reduce((sum, inv) => sum + inv.inventory.currentBottleCount, 0)

      expect(warehouseABottles).toBe(900) // 500 + 400
      expect(warehouseBBottles).toBe(600)
    })
  })

  describe('Packaging Validation and Error Handling', () => {
    it('should validate bottle count against volume calculations', async () => {
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'PKG-VALIDATION-001',
        status: 'active',
        startDate: new Date(),
        initialVolumeL: '750',
        currentVolumeL: '750',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Invalid packaging: volume doesn't match bottle count
      await expect(async () => {
        await db.transaction(async (tx) => {
          const volumeToPackage = 375 // 375L
          const bottleCount = 100 // Would be 3.75L per bottle - unrealistic
          const bottleSize = '750ml'

          const expectedVolumePerBottle = volumeToPackage / bottleCount
          if (expectedVolumePerBottle > 2.0 || expectedVolumePerBottle < 0.1) {
            throw new Error(`Invalid bottle volume calculation: ${expectedVolumePerBottle}L per bottle`)
          }

          // Should not execute
          await tx.insert(schema.packages).values({
            batchId: batch[0].id,
            packageDate: new Date(),
            volumePackagedL: volumeToPackage.toString(),
            bottleSize,
            bottleCount,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow('Invalid bottle volume calculation')

      // Verify no package was created
      const packages = await db.select()
        .from(schema.packages)
        .where(eq(schema.packages.batchId, batch[0].id))

      expect(packages).toHaveLength(0)
    })

    it('should handle packaging rollback on inventory creation failure', async () => {
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'PKG-ROLLBACK-001',
        status: 'active',
        startDate: new Date(),
        initialVolumeL: '375',
        currentVolumeL: '375',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Simulate failure during inventory creation
      await expect(async () => {
        await db.transaction(async (tx) => {
          const newPackage = await tx.insert(schema.packages).values({
            batchId: batch[0].id,
            packageDate: new Date(),
            volumePackagedL: '375',
            bottleSize: '750ml',
            bottleCount: 500,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          // Simulate inventory creation failure
          throw new Error('Simulated inventory creation failure')

          // This should not execute due to rollback
          await tx.insert(schema.inventory).values({
            packageId: newPackage[0].id,
            currentBottleCount: 500,
            reservedBottleCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      }).rejects.toThrow('Simulated inventory creation failure')

      // Verify no package or inventory was created
      const packages = await db.select()
        .from(schema.packages)
        .where(eq(schema.packages.batchId, batch[0].id))

      const inventories = await db.select().from(schema.inventory)

      expect(packages).toHaveLength(0)
      expect(inventories).toHaveLength(0)

      // Verify batch unchanged
      const unchangedBatch = await db.select()
        .from(schema.batches)
        .where(eq(schema.batches.id, batch[0].id))
        .limit(1)

      expect(unchangedBatch[0].currentVolumeL).toBe('375')
      expect(unchangedBatch[0].status).toBe('active')
    })
  })
})