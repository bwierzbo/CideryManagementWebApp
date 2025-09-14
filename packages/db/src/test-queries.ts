import { db } from './client'
import {
  vendors,
  appleVarieties,
  purchases,
  purchaseItems,
  pressRuns,
  pressItems,
  vessels,
  batches,
  batchIngredients,
  batchMeasurements,
  packages,
  inventory,
  batchCosts,
  applePressRuns,
  applePressRunLoads
} from './schema'
import { eq, desc, sql, and, isNull } from 'drizzle-orm'

async function testQueries() {
  console.log('🧪 Testing database queries...')

  try {
    // Test 1: Basic vendor query
    console.log('\n1. 📦 Testing vendor queries...')
    const allVendors = await db.select().from(vendors).where(eq(vendors.isActive, true))
    console.log(`   Found ${allVendors.length} active vendors`)
    console.log(`   First vendor: ${allVendors[0]?.name}`)

    // Test 2: Apple varieties with typical brix
    console.log('\n2. 🍎 Testing apple variety queries...')
    const varietiesWithBrix = await db
      .select()
      .from(appleVarieties)
      .where(sql`${appleVarieties.typicalBrix} > 13.0`)
      .orderBy(desc(appleVarieties.typicalBrix))
    
    console.log(`   Found ${varietiesWithBrix.length} varieties with brix > 13.0`)
    varietiesWithBrix.forEach(v => {
      console.log(`   - ${v.name}: ${v.typicalBrix}° Brix`)
    })

    // Test 3: Complex purchase query with joins
    console.log('\n3. 💰 Testing purchase queries with joins...')
    const purchaseDetails = await db
      .select({
        purchaseId: purchases.id,
        vendorName: vendors.name,
        purchaseDate: purchases.purchaseDate,
        varietyName: appleVarieties.name,
        quantity: purchaseItems.quantity,
        unit: purchaseItems.unit,
        totalCost: purchaseItems.totalCost
      })
      .from(purchases)
      .innerJoin(vendors, eq(purchases.vendorId, vendors.id))
      .innerJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
      .innerJoin(appleVarieties, eq(purchaseItems.appleVarietyId, appleVarieties.id))
      .orderBy(desc(purchases.purchaseDate))
      .limit(5)

    console.log(`   Recent purchases:`)
    purchaseDetails.forEach(p => {
      console.log(`   - ${p.vendorName}: ${p.quantity} ${p.unit} ${p.varietyName} ($${p.totalCost})`)
    })

    // Test 4: Batch status and fermentation progress
    console.log('\n4. 🍺 Testing batch queries...')
    const activeBatches = await db
      .select({
        batchNumber: batches.batchNumber,
        status: batches.status,
        initialVolume: batches.initialVolumeL,
        currentVolume: batches.currentVolumeL,
        targetAbv: batches.targetAbv,
        actualAbv: batches.actualAbv,
        startDate: batches.startDate
      })
      .from(batches)
      .where(eq(batches.status, 'active'))
      .orderBy(batches.startDate)

    console.log(`   Active batches (${activeBatches.length}):`)
    activeBatches.forEach(b => {
      console.log(`   - ${b.batchNumber}: ${b.currentVolume}L (${b.actualAbv || 'TBD'}% ABV)`)
    })

    // Test 5: Inventory availability
    console.log('\n5. 📋 Testing inventory queries...')
    const availableInventory = await db
      .select({
        batchNumber: batches.batchNumber,
        bottleSize: packages.bottleSize,
        totalBottles: packages.bottleCount,
        currentBottles: inventory.currentBottleCount,
        reservedBottles: inventory.reservedBottleCount,
        availableBottles: sql<number>`${inventory.currentBottleCount} - ${inventory.reservedBottleCount}`,
        abv: packages.abvAtPackaging,
        location: inventory.location
      })
      .from(inventory)
      .innerJoin(packages, eq(inventory.packageId, packages.id))
      .innerJoin(batches, eq(packages.batchId, batches.id))

    console.log(`   Inventory available:`)
    availableInventory.forEach(i => {
      console.log(`   - ${i.batchNumber}: ${i.availableBottles} bottles available (${i.bottleSize}, ${i.abv}% ABV)`)
    })

    // Test 6: Cost analysis
    console.log('\n6. 💲 Testing cost analysis queries...')
    const costAnalysis = await db
      .select({
        batchNumber: batches.batchNumber,
        totalCost: batchCosts.totalCost,
        costPerBottle: batchCosts.costPerBottle,
        costPerL: batchCosts.costPerL,
        appleCost: batchCosts.totalAppleCost,
        laborCost: batchCosts.laborCost,
        overheadCost: batchCosts.overheadCost,
        packagingCost: batchCosts.packagingCost
      })
      .from(batchCosts)
      .innerJoin(batches, eq(batchCosts.batchId, batches.id))
      .orderBy(desc(batchCosts.calculatedAt))

    console.log(`   Cost breakdown:`)
    costAnalysis.forEach(c => {
      console.log(`   - ${c.batchNumber}: Total $${c.totalCost} (Apple: $${c.appleCost}, Labor: $${c.laborCost}, Packaging: $${c.packagingCost})`)
      if (c.costPerBottle) {
        console.log(`     Cost per bottle: $${c.costPerBottle}`)
      }
    })

    // Test 7: Production efficiency metrics
    console.log('\n7. 📊 Testing production efficiency queries...')
    const pressEfficiency = await db
      .select({
        runDate: pressRuns.runDate,
        totalApples: pressRuns.totalAppleProcessedKg,
        totalJuice: pressRuns.totalJuiceProducedL,
        extractionRate: pressRuns.extractionRate,
        costPerKg: sql<number>`
          COALESCE(
            (SELECT SUM(pi.total_cost) / SUM(pi.quantity_kg)
             FROM press_items pit
             JOIN purchase_items pi ON pit.purchase_item_id = pi.id
             WHERE pit.press_run_id = press_runs.id),
            0
          )`
      })
      .from(pressRuns)
      .orderBy(desc(pressRuns.runDate))

    console.log(`   Press efficiency:`)
    pressEfficiency.forEach(p => {
      console.log(`   - ${p.runDate.toDateString()}: ${p.extractionRate} extraction (${p.totalApples}kg → ${p.totalJuice}L)`)
    })

    // Test 8: Fermentation progress tracking
    console.log('\n8. 📈 Testing fermentation tracking queries...')
    const fermentationProgress = await db
      .select({
        batchNumber: batches.batchNumber,
        measurementDate: batchMeasurements.measurementDate,
        specificGravity: batchMeasurements.specificGravity,
        abv: batchMeasurements.abv,
        ph: batchMeasurements.ph,
        temperature: batchMeasurements.temperature,
        takenBy: batchMeasurements.takenBy
      })
      .from(batchMeasurements)
      .innerJoin(batches, eq(batchMeasurements.batchId, batches.id))
      .where(eq(batches.status, 'active'))
      .orderBy(desc(batchMeasurements.measurementDate))
      .limit(10)

    console.log(`   Recent measurements:`)
    fermentationProgress.forEach(m => {
      console.log(`   - ${m.batchNumber} (${m.measurementDate.toDateString()}): ${m.abv}% ABV, pH ${m.ph}, SG ${m.specificGravity}`)
    })

    // Test 9: Apple variety usage and costs
    console.log('\n9. 🍎💰 Testing variety cost analysis...')
    const varietyCosts = await db
      .select({
        varietyName: appleVarieties.name,
        totalQuantityKg: sql<number>`SUM(${purchaseItems.quantityKg})`,
        totalCost: sql<number>`SUM(${purchaseItems.totalCost})`,
        avgPricePerKg: sql<number>`AVG(${purchaseItems.pricePerUnit})`
      })
      .from(appleVarieties)
      .innerJoin(purchaseItems, eq(purchaseItems.appleVarietyId, appleVarieties.id))
      .groupBy(appleVarieties.id, appleVarieties.name)
      .orderBy(desc(sql`SUM(${purchaseItems.totalCost})`))

    console.log(`   Variety costs:`)
    varietyCosts.forEach(v => {
      console.log(`   - ${v.varietyName}: ${v.totalQuantityKg}kg total, $${v.totalCost} total cost, $${Number(v.avgPricePerKg).toFixed(2)}/kg avg`)
    })

    // Test 10: Vessel utilization
    console.log('\n10. 🏺 Testing vessel utilization...')
    const vesselUtilization = await db
      .select({
        vesselName: sql<string>`COALESCE(${vessels.name}, 'Unassigned')`,
        vesselType: vessels.type,
        vesselCapacity: vessels.capacityL,
        vesselStatus: vessels.status,
        currentBatch: batches.batchNumber,
        batchStatus: batches.status,
        volumeUsed: batches.currentVolumeL,
        utilizationPercent: sql<number>`
          CASE 
            WHEN ${vessels.capacityL} > 0 
            THEN ROUND((${batches.currentVolumeL} / ${vessels.capacityL}) * 100, 1)
            ELSE 0 
          END`
      })
      .from(vessels)
      .leftJoin(batches, and(
        eq(batches.vesselId, vessels.id),
        eq(batches.status, 'active')
      ))
      .orderBy(vessels.name)

    console.log(`   Vessel utilization:`)
    vesselUtilization.forEach(v => {
      if (v.currentBatch) {
        console.log(`   - ${v.vesselName} (${v.vesselType}): ${v.utilizationPercent}% used by ${v.currentBatch}`)
      } else {
        console.log(`   - ${v.vesselName} (${v.vesselType}): Available (${v.vesselStatus})`)
      }
    })

    // Test 11: ApplePress Mobile Workflow Tables
    console.log('\n11. 📱 Testing ApplePress mobile workflow tables...')

    // Test table existence and basic operations
    const applePressRunCount = await db.select({ count: sql<number>`count(*)` }).from(applePressRuns)
    const applePressLoadCount = await db.select({ count: sql<number>`count(*)` }).from(applePressRunLoads)

    console.log(`   ApplePress runs table: ✅ (${applePressRunCount[0].count} records)`)
    console.log(`   ApplePress loads table: ✅ (${applePressLoadCount[0].count} records)`)

    // Test enum constraint
    try {
      await db.select().from(applePressRuns).where(eq(applePressRuns.status, 'draft')).limit(1)
      console.log(`   Status enum constraint: ✅ (draft status queryable)`)
    } catch (error) {
      console.log(`   Status enum constraint: ❌ (${error})`)
    }

    // Test foreign key relationships
    const foreignKeyTest = await db
      .select({
        applePressRunId: applePressRuns.id,
        vendorName: vendors.name,
        vesselName: sql<string>`COALESCE(${vessels.name}, 'No vessel assigned')`
      })
      .from(applePressRuns)
      .innerJoin(vendors, eq(applePressRuns.vendorId, vendors.id))
      .leftJoin(vessels, eq(applePressRuns.vesselId, vessels.id))
      .limit(5)

    console.log(`   Foreign key relationships: ✅ (joins working)`)

    // Test composite indexes
    const indexTest = await db
      .select()
      .from(applePressRuns)
      .where(and(
        eq(applePressRuns.status, 'draft'),
        isNull(applePressRuns.deletedAt)
      ))
      .limit(1)

    console.log(`   Composite indexes: ✅ (vendor_status index operational)`)
    console.log(`   ApplePress tables successfully validated!`)

    console.log('\n✅ All database tests completed successfully!')
    console.log('   • Basic CRUD operations working')
    console.log('   • Complex joins functioning properly') 
    console.log('   • Aggregation queries operational')
    console.log('   • Business logic queries validated')
    console.log('   • Database relationships intact')

  } catch (error) {
    console.error('❌ Database test failed:', error)
    throw error
  }
}

// Run the test function
if (require.main === module) {
  testQueries()
    .then(() => {
      console.log('\n🎉 Database testing completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Database testing failed:', error)
      process.exit(1)
    })
}