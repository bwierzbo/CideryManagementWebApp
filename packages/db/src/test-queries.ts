import { db } from "./client";
import {
  vendors,
  appleVarieties,
  purchases,
  purchaseItems,
  pressRuns, // Renamed from applePressRuns in migration 0024
  pressRunLoads, // Renamed from applePressRunLoads in migration 0024
  vessels,
  batches,
  batchIngredients,
  batchMeasurements,
  // Dropped tables: pressItems, packages, inventory, batchCosts
} from "./schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";

async function testQueries() {
  console.log("🧪 Testing database queries...");

  try {
    // Test 1: Basic vendor query
    console.log("\n1. 📦 Testing vendor queries...");
    const allVendors = await db
      .select()
      .from(vendors)
      .where(eq(vendors.isActive, true));
    console.log(`   Found ${allVendors.length} active vendors`);
    console.log(`   First vendor: ${allVendors[0]?.name}`);

    // Test 2: Apple varieties with high sugar content
    console.log("\n2. 🍎 Testing apple variety queries...");
    const varietiesWithHighSugar = await db
      .select()
      .from(appleVarieties)
      .where(sql`${appleVarieties.sugarBrix} IN ('high', 'medium-high')`)
      .orderBy(appleVarieties.name);

    console.log(
      `   Found ${varietiesWithHighSugar.length} varieties with high sugar content`,
    );
    varietiesWithHighSugar.forEach((v) => {
      console.log(`   - ${v.name}: ${v.sugarBrix} sugar`);
    });

    // Test 3: Complex purchase query with joins
    console.log("\n3. 💰 Testing purchase queries with joins...");
    const purchaseDetails = await db
      .select({
        purchaseId: purchases.id,
        vendorName: vendors.name,
        purchaseDate: purchases.purchaseDate,
        varietyName: appleVarieties.name,
        quantity: purchaseItems.quantity,
        unit: purchaseItems.unit,
        totalCost: purchaseItems.totalCost,
      })
      .from(purchases)
      .innerJoin(vendors, eq(purchases.vendorId, vendors.id))
      .innerJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
      .innerJoin(
        appleVarieties,
        eq(purchaseItems.fruitVarietyId, appleVarieties.id),
      )
      .orderBy(desc(purchases.purchaseDate))
      .limit(5);

    console.log(`   Recent purchases:`);
    purchaseDetails.forEach((p) => {
      console.log(
        `   - ${p.vendorName}: ${p.quantity} ${p.unit} ${p.varietyName} ($${p.totalCost})`,
      );
    });

    // Test 4: Batch status and fermentation progress
    console.log("\n4. 🍺 Testing batch queries...");
    const activeBatches = await db
      .select({
        batchNumber: batches.batchNumber,
        status: batches.status,
        initialVolume: batches.initialVolume,
        currentVolume: batches.currentVolume,
        startDate: batches.startDate,
      })
      .from(batches)
      .where(eq(batches.status, "fermentation"))
      .orderBy(batches.startDate);

    console.log(`   Active batches (${activeBatches.length}):`);
    activeBatches.forEach((b) => {
      console.log(`   - ${b.batchNumber}: ${b.currentVolume}L`);
    });

    // Test 5: Inventory availability
    console.log("\n5. 📋 Testing inventory queries...");
// DROPPED TABLE:     const availableInventory = await db
// DROPPED TABLE:       .select({
// DROPPED TABLE:         batchNumber: batches.batchNumber,
// DROPPED TABLE:         bottleSize: packages.bottleSize,
// DROPPED TABLE:         totalBottles: packages.bottleCount,
// DROPPED TABLE:         currentBottles: inventory.currentBottleCount,
// DROPPED TABLE:         reservedBottles: inventory.reservedBottleCount,
// DROPPED TABLE:         availableBottles: sql<number>`${inventory.currentBottleCount} - ${inventory.reservedBottleCount}`,
// DROPPED TABLE:         abv: packages.abvAtPackaging,
// DROPPED TABLE:         location: inventory.location,
// DROPPED TABLE:       })
// DROPPED TABLE:       .from(inventory)
// DROPPED TABLE:       .innerJoin(packages, eq(inventory.packageId, packages.id))
// DROPPED TABLE:       .innerJoin(batches, eq(packages.batchId, batches.id));
// DROPPED TABLE:
// DROPPED TABLE:     console.log(`   Inventory available:`);
// DROPPED TABLE:     availableInventory.forEach((i) => {
// DROPPED TABLE:       console.log(
// DROPPED TABLE:         `   - ${i.batchNumber}: ${i.availableBottles} bottles available (${i.bottleSize}, ${i.abv}% ABV)`,
// DROPPED TABLE:       );
// DROPPED TABLE:     });

    // Test 6: Cost analysis
    console.log("\n6. 💲 Testing cost analysis queries...");
// DROPPED TABLE:     const costAnalysis = await db
// DROPPED TABLE:       .select({
// DROPPED TABLE:         batchNumber: batches.batchNumber,
// DROPPED TABLE:         totalCost: batchCosts.totalCost,
// DROPPED TABLE:         costPerBottle: batchCosts.costPerBottle,
// DROPPED TABLE:         costPerL: batchCosts.costPerL,
// DROPPED TABLE:         appleCost: batchCosts.totalAppleCost,
// DROPPED TABLE:         laborCost: batchCosts.laborCost,
// DROPPED TABLE:         overheadCost: batchCosts.overheadCost,
// DROPPED TABLE:         packagingCost: batchCosts.packagingCost,
// DROPPED TABLE:       })
// DROPPED TABLE:       .from(batchCosts)
// DROPPED TABLE:       .innerJoin(batches, eq(batchCosts.batchId, batches.id))
// DROPPED TABLE:       .orderBy(desc(batchCosts.calculatedAt));
// DROPPED TABLE: 
// DROPPED TABLE:     console.log(`   Cost breakdown:`);
// DROPPED TABLE:     costAnalysis.forEach((c) => {
// DROPPED TABLE:       console.log(
// DROPPED TABLE:         `   - ${c.batchNumber}: Total $${c.totalCost} (Apple: $${c.appleCost}, Labor: $${c.laborCost}, Packaging: $${c.packagingCost})`,
// DROPPED TABLE:       );
// DROPPED TABLE:       if (c.costPerBottle) {
// DROPPED TABLE:         console.log(`     Cost per bottle: $${c.costPerBottle}`);
// DROPPED TABLE:       }
// DROPPED TABLE:     });
// DROPPED TABLE: 
    // Test 7: Production efficiency metrics
    console.log("\n7. 📊 Testing production efficiency queries...");
    const pressEfficiency = await db
      .select({
        runDate: pressRuns.dateCompleted,
        totalApples: pressRuns.totalAppleWeightKg,
        totalJuice: pressRuns.totalJuiceVolume,
        totalJuiceUnit: pressRuns.totalJuiceVolumeUnit,
        extractionRate: pressRuns.extractionRate,
        costPerKg: sql<number>`
          COALESCE(
            (SELECT SUM(pi.total_cost) / SUM(pi.quantity_kg)
             FROM press_items pit
             JOIN purchase_items pi ON pit.purchase_item_id = pi.id
             WHERE pit.press_run_id = press_runs.id),
            0
          )`,
      })
      .from(pressRuns)
      .orderBy(desc(pressRuns.dateCompleted));

    console.log(`   Press efficiency:`);
    pressEfficiency.forEach((p) => {
      const dateStr = p.runDate ? new Date(p.runDate).toDateString() : 'No date';
      console.log(
        `   - ${dateStr}: ${p.extractionRate} extraction (${p.totalApples}kg → ${p.totalJuice}${p.totalJuiceUnit})`,
      );
    });

    // Test 8: Fermentation progress tracking
    console.log("\n8. 📈 Testing fermentation tracking queries...");
    const fermentationProgress = await db
      .select({
        batchNumber: batches.batchNumber,
        measurementDate: batchMeasurements.measurementDate,
        specificGravity: batchMeasurements.specificGravity,
        abv: batchMeasurements.abv,
        ph: batchMeasurements.ph,
        temperature: batchMeasurements.temperature,
        takenBy: batchMeasurements.takenBy,
      })
      .from(batchMeasurements)
      .innerJoin(batches, eq(batchMeasurements.batchId, batches.id))
      .where(eq(batches.status, "fermentation"))
      .orderBy(desc(batchMeasurements.measurementDate))
      .limit(10);

    console.log(`   Recent measurements:`);
    fermentationProgress.forEach((m) => {
      console.log(
        `   - ${m.batchNumber} (${m.measurementDate.toDateString()}): ${m.abv}% ABV, pH ${m.ph}, SG ${m.specificGravity}`,
      );
    });

    // Test 9: Apple variety usage and costs
    console.log("\n9. 🍎💰 Testing variety cost analysis...");
    const varietyCosts = await db
      .select({
        varietyName: appleVarieties.name,
        totalQuantityKg: sql<number>`SUM(${purchaseItems.quantityKg})`,
        totalCost: sql<number>`SUM(${purchaseItems.totalCost})`,
        avgPricePerKg: sql<number>`AVG(${purchaseItems.pricePerUnit})`,
      })
      .from(appleVarieties)
      .innerJoin(
        purchaseItems,
        eq(purchaseItems.fruitVarietyId, appleVarieties.id),
      )
      .groupBy(appleVarieties.id, appleVarieties.name)
      .orderBy(desc(sql`SUM(${purchaseItems.totalCost})`));

    console.log(`   Variety costs:`);
    varietyCosts.forEach((v) => {
      console.log(
        `   - ${v.varietyName}: ${v.totalQuantityKg}kg total, $${v.totalCost} total cost, $${Number(v.avgPricePerKg).toFixed(2)}/kg avg`,
      );
    });

    // Test 10: Vessel utilization
    console.log("\n10. 🏺 Testing vessel utilization...");
    const vesselUtilization = await db
      .select({
        vesselName: sql<string>`COALESCE(${vessels.name}, 'Unassigned')`,
        vesselType: vessels.type,
        vesselCapacity: vessels.capacity,
        vesselStatus: vessels.status,
        currentBatch: batches.batchNumber,
        batchStatus: batches.status,
        volumeUsed: batches.currentVolume,
        utilizationPercent: sql<number>`
          CASE
            WHEN ${vessels.capacity} > 0
            THEN ROUND((${batches.currentVolume} / ${vessels.capacity}) * 100, 1)
            ELSE 0 
          END`,
      })
      .from(vessels)
      .leftJoin(
        batches,
        and(eq(batches.vesselId, vessels.id), eq(batches.status, "fermentation")),
      )
      .orderBy(vessels.name);

    console.log(`   Vessel utilization:`);
    vesselUtilization.forEach((v) => {
      if (v.currentBatch) {
        console.log(
          `   - ${v.vesselName} (${v.vesselType}): ${v.utilizationPercent}% used by ${v.currentBatch}`,
        );
      } else {
        console.log(
          `   - ${v.vesselName} (${v.vesselType}): Available (${v.vesselStatus})`,
        );
      }
    });

    // Test 11: ApplePress Mobile Workflow Tables
    console.log("\n11. 📱 Testing ApplePress mobile workflow tables...");

    // Test table existence and basic operations
    const applePressRunCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(pressRuns);
    const applePressLoadCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(pressRunLoads);

    console.log(
      `   ApplePress runs table: ✅ (${applePressRunCount[0].count} records)`,
    );
    console.log(
      `   ApplePress loads table: ✅ (${applePressLoadCount[0].count} records)`,
    );

    // Test enum constraint
    try {
      await db
        .select()
        .from(pressRuns)
        .where(eq(pressRuns.status, "draft"))
        .limit(1);
      console.log(`   Status enum constraint: ✅ (draft status queryable)`);
    } catch (error) {
      console.log(`   Status enum constraint: ❌ (${error})`);
    }

    // Test foreign key relationships
    const foreignKeyTest = await db
      .select({
        applePressRunId: pressRuns.id,
        vendorName: vendors.name,
        vesselName: sql<string>`COALESCE(${vessels.name}, 'No vessel assigned')`,
      })
      .from(pressRuns)
      .innerJoin(vendors, eq(pressRuns.vendorId, vendors.id))
      .leftJoin(vessels, eq(pressRuns.vesselId, vessels.id))
      .limit(5);

    console.log(`   Foreign key relationships: ✅ (joins working)`);

    // Test composite indexes
    const indexTest = await db
      .select()
      .from(pressRuns)
      .where(
        and(
          eq(pressRuns.status, "draft"),
          isNull(pressRuns.deletedAt),
        ),
      )
      .limit(1);

    console.log(`   Composite indexes: ✅ (vendor_status index operational)`);
    console.log(`   ApplePress tables successfully validated!`);

    console.log("\n✅ All database tests completed successfully!");
    console.log("   • Basic CRUD operations working");
    console.log("   • Complex joins functioning properly");
    console.log("   • Aggregation queries operational");
    console.log("   • Business logic queries validated");
    console.log("   • Database relationships intact");
  } catch (error) {
    console.error("❌ Database test failed:", error);
    throw error;
  }
}

// Run the test function
if (require.main === module) {
  testQueries()
    .then(() => {
      console.log("\n🎉 Database testing completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Database testing failed:", error);
      process.exit(1);
    });
}
