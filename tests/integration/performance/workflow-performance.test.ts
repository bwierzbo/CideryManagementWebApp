/**
 * Performance testing for complex workflow operations
 * Tests performance benchmarks, scalability, and optimization for cidery workflows
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, seedTestData } from '../database/testcontainer-setup'
import * as schema from 'db/src/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

describe('Workflow Performance Integration Tests', () => {
  let db: NodePgDatabase
  let testData: {
    vendorIds: string[]
    appleVarietyIds: string[]
    vesselIds: string[]
    userIds: string[]
  }

  // Performance thresholds (adjust based on requirements)
  const PERFORMANCE_THRESHOLDS = {
    singlePurchaseMs: 100,
    largePurchaseMs: 500,
    batchCreationMs: 200,
    complexWorkflowMs: 2000,
    packageOperationMs: 300,
    inventoryUpdateMs: 50,
    concurrentOperationsMs: 3000,
    dataQueryMs: 100
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

  describe('Single Operation Performance', () => {
    it('should create purchase with items within performance threshold', async () => {
      const startTime = performance.now()

      await db.transaction(async (tx) => {
        const purchase = await tx.insert(schema.purchases).values({
          vendorId: testData.vendorIds[0],
          purchaseDate: new Date(),
          totalCost: '1000.00',
          invoiceNumber: 'PERF-SINGLE-001',
          notes: 'Single purchase performance test',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const items = await tx.insert(schema.purchaseItems).values([
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

        expect(items).toHaveLength(1)
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Single purchase operation: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.singlePurchaseMs)
    })

    it('should create batch with measurements within performance threshold', async () => {
      const startTime = performance.now()

      await db.transaction(async (tx) => {
        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'PERF-BATCH-001',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '500',
          currentVolumeL: '500',
          targetAbv: '6.5',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, testData.vesselIds[0]))

        const measurement = await tx.insert(schema.batchMeasurements).values({
          batchId: batch[0].id,
          measurementDate: new Date(),
          specificGravity: '1.050',
          abv: '0.0',
          ph: '3.5',
          temperature: '20',
          volumeL: '500',
          notes: 'Performance test measurement',
          takenBy: 'Performance Test',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        expect(measurement).toHaveLength(1)
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Batch creation with measurement: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.batchCreationMs)
    })

    it('should update inventory within performance threshold', async () => {
      // Create test inventory
      const inventoryId = await createTestInventory(1000)

      const startTime = performance.now()

      await db.transaction(async (tx) => {
        await tx.update(schema.inventory)
          .set({
            currentBottleCount: 900,
            updatedAt: new Date()
          })
          .where(eq(schema.inventory.id, inventoryId))

        await tx.insert(schema.inventoryTransactions).values({
          inventoryId: inventoryId,
          transactionType: 'sale',
          quantityChange: -100,
          transactionDate: new Date(),
          reason: 'Performance test sale',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Inventory update: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.inventoryUpdateMs)
    })
  })

  describe('Large-Scale Operation Performance', () => {
    it('should handle large purchase with many items efficiently', async () => {
      const itemCount = 100
      const startTime = performance.now()

      await db.transaction(async (tx) => {
        const purchase = await tx.insert(schema.purchases).values({
          vendorId: testData.vendorIds[0],
          purchaseDate: new Date(),
          totalCost: '50000.00',
          invoiceNumber: 'PERF-LARGE-001',
          notes: 'Large purchase performance test',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const items = Array.from({ length: itemCount }, (_, i) => ({
          purchaseId: purchase[0].id,
          appleVarietyId: testData.appleVarietyIds[i % 2],
          quantity: (100 + i).toString(),
          unit: 'kg' as const,
          pricePerUnit: (2.0 + i * 0.01).toString(),
          totalCost: ((100 + i) * (2.0 + i * 0.01)).toString(),
          quantityKg: (100 + i).toString(),
          notes: `Performance test item ${i}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }))

        const insertedItems = await tx.insert(schema.purchaseItems).values(items).returning()
        expect(insertedItems).toHaveLength(itemCount)
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Large purchase (${itemCount} items): ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.largePurchaseMs)
    })

    it('should handle packaging operation with large volume efficiently', async () => {
      // Create large batch
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'PERF-LARGE-BATCH-001',
        status: 'active',
        vesselId: testData.vesselIds[0],
        startDate: new Date(),
        initialVolumeL: '5000', // Large volume
        currentVolumeL: '5000',
        actualAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const startTime = performance.now()

      await db.transaction(async (tx) => {
        const packageData = await tx.insert(schema.packages).values({
          batchId: batch[0].id,
          packageDate: new Date(),
          volumePackagedL: '5000',
          bottleSize: '750ml',
          bottleCount: 6667, // 5000L / 0.75L per bottle
          abvAtPackaging: '6.5',
          notes: 'Large packaging performance test',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const inventory = await tx.insert(schema.inventory).values({
          packageId: packageData[0].id,
          currentBottleCount: 6667,
          reservedBottleCount: 0,
          location: 'Performance Test Warehouse',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        await tx.insert(schema.inventoryTransactions).values({
          inventoryId: inventory[0].id,
          transactionType: 'transfer',
          quantityChange: 6667,
          transactionDate: new Date(),
          reason: 'Initial large packaging',
          createdAt: new Date(),
          updatedAt: new Date()
        })

        await tx.update(schema.batches)
          .set({
            currentVolumeL: '0',
            status: 'completed',
            actualCompletionDate: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.batches.id, batch[0].id))

        expect(packageData).toHaveLength(1)
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Large packaging operation: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.packageOperationMs)
    })

    it('should handle complex multi-stage workflow efficiently', async () => {
      const startTime = performance.now()

      const result = await db.transaction(async (tx) => {
        // Stage 1: Purchase
        const purchase = await tx.insert(schema.purchases).values({
          vendorId: testData.vendorIds[0],
          purchaseDate: new Date(),
          totalCost: '3000.00',
          invoiceNumber: 'PERF-COMPLEX-001',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const purchaseItems = await tx.insert(schema.purchaseItems).values([
          {
            purchaseId: purchase[0].id,
            appleVarietyId: testData.appleVarietyIds[0],
            quantity: '1000',
            unit: 'kg',
            pricePerUnit: '2.00',
            totalCost: '2000.00',
            quantityKg: '1000',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            purchaseId: purchase[0].id,
            appleVarietyId: testData.appleVarietyIds[1],
            quantity: '500',
            unit: 'kg',
            pricePerUnit: '2.00',
            totalCost: '1000.00',
            quantityKg: '500',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]).returning()

        // Stage 2: Press
        const pressRun = await tx.insert(schema.pressRuns).values({
          runDate: new Date(),
          totalAppleProcessedKg: '1500',
          totalJuiceProducedL: '975',
          extractionRate: '0.65',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const pressItems = await tx.insert(schema.pressItems).values(
          purchaseItems.map((item, i) => ({
            pressRunId: pressRun[0].id,
            purchaseItemId: item.id,
            quantityUsedKg: item.quantityKg!,
            juiceProducedL: (parseFloat(item.quantityKg!) * 0.65).toString(),
            brixMeasured: (12.0 + i * 0.5).toString(),
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        ).returning()

        // Stage 3: Batch
        const batch = await tx.insert(schema.batches).values({
          batchNumber: 'PERF-COMPLEX-BATCH-001',
          status: 'active',
          vesselId: testData.vesselIds[0],
          startDate: new Date(),
          initialVolumeL: '975',
          currentVolumeL: '975',
          targetAbv: '6.5',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        const batchIngredients = await tx.insert(schema.batchIngredients).values(
          pressItems.map(item => ({
            batchId: batch[0].id,
            pressItemId: item.id,
            volumeUsedL: item.juiceProducedL,
            brixAtUse: item.brixMeasured,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        ).returning()

        // Stage 4: Measurements
        const measurements = await tx.insert(schema.batchMeasurements).values([
          {
            batchId: batch[0].id,
            measurementDate: new Date(),
            specificGravity: '1.050',
            abv: '0.0',
            ph: '3.5',
            notes: 'Initial measurement',
            takenBy: 'Performance Test',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            batchId: batch[0].id,
            measurementDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            specificGravity: '1.000',
            abv: '6.5',
            ph: '3.3',
            notes: 'Final measurement',
            takenBy: 'Performance Test',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]).returning()

        await tx.update(schema.vessels)
          .set({ status: 'in_use' })
          .where(eq(schema.vessels.id, testData.vesselIds[0]))

        return {
          purchase: purchase[0],
          purchaseItems,
          pressRun: pressRun[0],
          pressItems,
          batch: batch[0],
          batchIngredients,
          measurements
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Complex multi-stage workflow: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.complexWorkflowMs)

      // Verify all data was created correctly
      expect(result.purchaseItems).toHaveLength(2)
      expect(result.pressItems).toHaveLength(2)
      expect(result.batchIngredients).toHaveLength(2)
      expect(result.measurements).toHaveLength(2)
    })
  })

  describe('Concurrent Operation Performance', () => {
    it('should handle multiple concurrent purchases efficiently', async () => {
      const concurrentCount = 10
      const startTime = performance.now()

      const concurrentPurchases = Array.from({ length: concurrentCount }, (_, i) =>
        db.transaction(async (tx) => {
          const purchase = await tx.insert(schema.purchases).values({
            vendorId: testData.vendorIds[i % testData.vendorIds.length],
            purchaseDate: new Date(),
            totalCost: '1000.00',
            invoiceNumber: `PERF-CONCURRENT-${i}`,
            notes: `Concurrent purchase ${i}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning()

          const items = await tx.insert(schema.purchaseItems).values([
            {
              purchaseId: purchase[0].id,
              appleVarietyId: testData.appleVarietyIds[0],
              quantity: (100 + i * 10).toString(),
              unit: 'kg',
              pricePerUnit: '2.00',
              totalCost: (200 + i * 20).toString(),
              quantityKg: (100 + i * 10).toString(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]).returning()

          return { purchase: purchase[0], items }
        })
      )

      const results = await Promise.all(concurrentPurchases)
      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`${concurrentCount} concurrent purchases: ${duration.toFixed(2)}ms`)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentOperationsMs)
      expect(results).toHaveLength(concurrentCount)

      // Verify all purchases were created
      results.forEach((result, i) => {
        expect(result.purchase.invoiceNumber).toBe(`PERF-CONCURRENT-${i}`)
        expect(result.items).toHaveLength(1)
      })
    })

    it('should handle concurrent inventory updates efficiently', async () => {
      // Create test inventories
      const inventoryIds = await Promise.all(
        Array.from({ length: 5 }, () => createTestInventory(1000))
      )

      const concurrentUpdates = inventoryIds.flatMap(inventoryId =>
        Array.from({ length: 4 }, (_, i) => ({ inventoryId, operation: i }))
      )

      const startTime = performance.now()

      const results = await Promise.allSettled(
        concurrentUpdates.map(({ inventoryId, operation }) =>
          db.transaction(async (tx) => {
            const current = await tx.select()
              .from(schema.inventory)
              .where(eq(schema.inventory.id, inventoryId))
              .limit(1)

            const changeAmount = operation % 2 === 0 ? -10 : 5
            const newCount = current[0].currentBottleCount + changeAmount

            if (newCount < 0) {
              throw new Error('Insufficient inventory')
            }

            await tx.update(schema.inventory)
              .set({
                currentBottleCount: newCount,
                updatedAt: new Date()
              })
              .where(eq(schema.inventory.id, inventoryId))

            await tx.insert(schema.inventoryTransactions).values({
              inventoryId,
              transactionType: changeAmount > 0 ? 'transfer' : 'sale',
              quantityChange: changeAmount,
              transactionDate: new Date(),
              reason: `Concurrent operation ${operation}`,
              createdAt: new Date(),
              updatedAt: new Date()
            })

            return { inventoryId, changeAmount }
          })
        )
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')

      console.log(`Concurrent inventory updates: ${duration.toFixed(2)}ms`)
      console.log(`Successes: ${successes.length}, Failures: ${failures.length}`)

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentOperationsMs)
      expect(successes.length).toBeGreaterThan(0)

      // Verify final inventory states are consistent
      for (const inventoryId of inventoryIds) {
        const finalInventory = await db.select()
          .from(schema.inventory)
          .where(eq(schema.inventory.id, inventoryId))

        const transactions = await db.select()
          .from(schema.inventoryTransactions)
          .where(eq(schema.inventoryTransactions.inventoryId, inventoryId))

        const totalChanges = transactions.reduce((sum, tx) => sum + tx.quantityChange, 0)
        const expectedCount = 1000 + totalChanges

        expect(finalInventory[0].currentBottleCount).toBe(expectedCount)
      }
    })
  })

  describe('Query Performance', () => {
    it('should perform complex queries within performance threshold', async () => {
      // Create test data for complex queries
      await createComplexTestData()

      const startTime = performance.now()

      // Complex query: Get full production chain with costs
      const results = await db
        .select({
          batchId: schema.batches.id,
          batchNumber: schema.batches.batchNumber,
          batchStatus: schema.batches.status,
          vesselName: schema.vessels.name,
          vendorName: schema.vendors.name,
          totalAppleCost: sql<number>`sum(${schema.purchaseItems.totalCost}::decimal)`,
          totalJuiceProduced: sql<number>`sum(${schema.pressItems.juiceProducedL}::decimal)`,
          measurementCount: sql<number>`count(distinct ${schema.batchMeasurements.id})`,
          packageCount: sql<number>`count(distinct ${schema.packages.id})`,
          totalBottlesPackaged: sql<number>`sum(${schema.packages.bottleCount})`,
          currentInventory: sql<number>`sum(${schema.inventory.currentBottleCount})`,
        })
        .from(schema.batches)
        .leftJoin(schema.vessels, eq(schema.vessels.id, schema.batches.vesselId))
        .leftJoin(schema.batchIngredients, eq(schema.batchIngredients.batchId, schema.batches.id))
        .leftJoin(schema.pressItems, eq(schema.pressItems.id, schema.batchIngredients.pressItemId))
        .leftJoin(schema.purchaseItems, eq(schema.purchaseItems.id, schema.pressItems.purchaseItemId))
        .leftJoin(schema.purchases, eq(schema.purchases.id, schema.purchaseItems.purchaseId))
        .leftJoin(schema.vendors, eq(schema.vendors.id, schema.purchases.vendorId))
        .leftJoin(schema.batchMeasurements, eq(schema.batchMeasurements.batchId, schema.batches.id))
        .leftJoin(schema.packages, eq(schema.packages.batchId, schema.batches.id))
        .leftJoin(schema.inventory, eq(schema.inventory.packageId, schema.packages.id))
        .where(isNull(schema.batches.deletedAt))
        .groupBy(
          schema.batches.id,
          schema.batches.batchNumber,
          schema.batches.status,
          schema.vessels.name,
          schema.vendors.name
        )
        .orderBy(desc(schema.batches.startDate))

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Complex query performance: ${duration.toFixed(2)}ms`)
      console.log(`Query returned ${results.length} rows`)

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.dataQueryMs)
      expect(results.length).toBeGreaterThan(0)

      // Verify query results structure
      results.forEach(result => {
        expect(result.batchId).toBeDefined()
        expect(result.batchNumber).toBeDefined()
        expect(result.batchStatus).toBeDefined()
      })
    })

    it('should perform inventory aggregation queries efficiently', async () => {
      // Create multiple inventory records
      await Promise.all(
        Array.from({ length: 10 }, () => createTestInventory(Math.floor(Math.random() * 1000) + 100))
      )

      const startTime = performance.now()

      // Aggregate inventory by location and bottle size
      const inventorySummary = await db
        .select({
          location: schema.inventory.location,
          bottleSize: schema.packages.bottleSize,
          totalBottles: sql<number>`sum(${schema.inventory.currentBottleCount})`,
          totalReserved: sql<number>`sum(${schema.inventory.reservedBottleCount})`,
          totalPackages: sql<number>`count(distinct ${schema.packages.id})`,
          avgAbv: sql<number>`avg(${schema.packages.abvAtPackaging}::decimal)`,
          totalVolume: sql<number>`sum(${schema.packages.volumePackagedL}::decimal * ${schema.inventory.currentBottleCount}::decimal / ${schema.packages.bottleCount}::decimal)`,
        })
        .from(schema.inventory)
        .leftJoin(schema.packages, eq(schema.packages.id, schema.inventory.packageId))
        .where(and(isNull(schema.inventory.deletedAt), isNull(schema.packages.deletedAt)))
        .groupBy(schema.inventory.location, schema.packages.bottleSize)
        .orderBy(schema.inventory.location, schema.packages.bottleSize)

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Inventory aggregation query: ${duration.toFixed(2)}ms`)
      console.log(`Aggregation returned ${inventorySummary.length} groups`)

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.dataQueryMs)
      expect(inventorySummary.length).toBeGreaterThan(0)

      // Verify aggregation results
      inventorySummary.forEach(summary => {
        expect(summary.totalBottles).toBeGreaterThanOrEqual(0)
        expect(summary.totalPackages).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Memory and Resource Performance', () => {
    it('should handle large result sets efficiently', async () => {
      // Create many measurement records
      const batch = await db.insert(schema.batches).values({
        batchNumber: 'PERF-MEMORY-BATCH-001',
        status: 'active',
        startDate: new Date(),
        initialVolumeL: '500',
        currentVolumeL: '500',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const measurementCount = 500
      const measurements = Array.from({ length: measurementCount }, (_, i) => ({
        batchId: batch[0].id,
        measurementDate: new Date(Date.now() + i * 60000), // Every minute
        specificGravity: (1.050 - i * 0.0001).toString(),
        abv: (i * 0.01).toString(),
        ph: (3.5 - i * 0.0001).toString(),
        temperature: (20 + Math.sin(i * 0.1)).toString(),
        volumeL: (500 - i * 0.1).toString(),
        notes: `Measurement ${i}`,
        takenBy: 'Performance Test',
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      await db.insert(schema.batchMeasurements).values(measurements)

      const startTime = performance.now()

      // Query large result set
      const results = await db.select()
        .from(schema.batchMeasurements)
        .where(eq(schema.batchMeasurements.batchId, batch[0].id))
        .orderBy(desc(schema.batchMeasurements.measurementDate))

      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Large result set query (${results.length} rows): ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.dataQueryMs * 2) // Allow 2x for large sets
      expect(results).toHaveLength(measurementCount)

      // Verify memory efficiency by checking a few samples
      expect(results[0].notes).toBe(`Measurement ${measurementCount - 1}`) // Latest first
      expect(results[results.length - 1].notes).toBe('Measurement 0') // Earliest last
    })
  })

  // Helper function to create test inventory
  async function createTestInventory(bottleCount: number): Promise<string> {
    const batch = await db.insert(schema.batches).values({
      batchNumber: `PERF-BATCH-${Date.now()}-${Math.random()}`,
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
      location: 'Performance Test Warehouse',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    return inventory[0].id
  }

  // Helper function to create complex test data
  async function createComplexTestData(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      const purchase = await db.insert(schema.purchases).values({
        vendorId: testData.vendorIds[i % testData.vendorIds.length],
        purchaseDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        totalCost: ((i + 1) * 1000).toString(),
        invoiceNumber: `COMPLEX-${i}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const purchaseItem = await db.insert(schema.purchaseItems).values({
        purchaseId: purchase[0].id,
        appleVarietyId: testData.appleVarietyIds[i % testData.appleVarietyIds.length],
        quantity: ((i + 1) * 500).toString(),
        unit: 'kg',
        pricePerUnit: '2.00',
        totalCost: ((i + 1) * 1000).toString(),
        quantityKg: ((i + 1) * 500).toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const pressRun = await db.insert(schema.pressRuns).values({
        runDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        totalAppleProcessedKg: ((i + 1) * 500).toString(),
        totalJuiceProducedL: ((i + 1) * 325).toString(),
        extractionRate: '0.65',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const pressItem = await db.insert(schema.pressItems).values({
        pressRunId: pressRun[0].id,
        purchaseItemId: purchaseItem[0].id,
        quantityUsedKg: ((i + 1) * 500).toString(),
        juiceProducedL: ((i + 1) * 325).toString(),
        brixMeasured: '12.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const batch = await db.insert(schema.batches).values({
        batchNumber: `COMPLEX-BATCH-${i}`,
        status: i % 2 === 0 ? 'completed' : 'active',
        vesselId: testData.vesselIds[i % testData.vesselIds.length],
        startDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        initialVolumeL: ((i + 1) * 325).toString(),
        currentVolumeL: i % 2 === 0 ? '0' : ((i + 1) * 325).toString(),
        actualAbv: '6.5',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await db.insert(schema.batchIngredients).values({
        batchId: batch[0].id,
        pressItemId: pressItem[0].id,
        volumeUsedL: ((i + 1) * 325).toString(),
        brixAtUse: '12.5',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await db.insert(schema.batchMeasurements).values({
        batchId: batch[0].id,
        measurementDate: new Date(),
        specificGravity: '1.000',
        abv: '6.5',
        ph: '3.3',
        volumeL: ((i + 1) * 325).toString(),
        notes: `Complex test measurement ${i}`,
        takenBy: 'Complex Test',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      if (i % 2 === 0) { // Only create packages for completed batches
        const packageData = await db.insert(schema.packages).values({
          batchId: batch[0].id,
          packageDate: new Date(),
          volumePackagedL: ((i + 1) * 325).toString(),
          bottleSize: '750ml',
          bottleCount: Math.floor(((i + 1) * 325) / 0.75),
          abvAtPackaging: '6.5',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()

        await db.insert(schema.inventory).values({
          packageId: packageData[0].id,
          currentBottleCount: Math.floor(((i + 1) * 325) / 0.75),
          reservedBottleCount: 0,
          location: 'Complex Test Warehouse',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    }
  }
})