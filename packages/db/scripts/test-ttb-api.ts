/**
 * Test TTB API response to debug batch details
 */

import { db } from "../src/index.js";
import { sql, and, eq, isNull } from "drizzle-orm";
import { batches, vessels } from "../src/schema.js";

async function test() {
  const reconciliationDate = "2025-01-01";
  const isInitialReconciliation = true;

  console.log("Testing TTB API queries...\n");
  console.log("Reconciliation Date:", reconciliationDate);
  console.log("Is Initial:", isInitialReconciliation);
  console.log("");

  // Test the batch detail query for initial reconciliation
  console.log("BATCH DETAIL QUERY (initial reconciliation - verified batches):");

  const batchDetailData = await db
    .select({
      id: batches.id,
      customName: batches.customName,
      batchNumber: batches.batchNumber,
      productType: batches.productType,
      volume: batches.initialVolume,
      vesselId: batches.vesselId,
      vesselName: vessels.name,
      reconciliationStatus: batches.reconciliationStatus,
    })
    .from(batches)
    .leftJoin(vessels, eq(batches.vesselId, vessels.id))
    .where(
      and(
        isNull(batches.deletedAt),
        sql`${batches.startDate} <= ${reconciliationDate}::date`,
        eq(batches.reconciliationStatus, "verified"),
        sql`NOT (${batches.batchNumber} LIKE 'LEGACY-%')`
      )
    )
    .orderBy(sql`CAST(${batches.initialVolume} AS DECIMAL) DESC`);

  console.log(`Found ${batchDetailData.length} verified batches:\n`);

  const productTypeToTaxClass = (productType: string | null): string => {
    switch (productType) {
      case 'pommeau': return 'wine16To21';
      case 'brandy': return 'appleBrandy';
      default: return 'hardCider';
    }
  };

  type BatchDetail = {
    id: string;
    name: string;
    batchNumber: string;
    vesselName: string | null;
    volumeLiters: number;
    volumeGallons: number;
    type: 'bulk' | 'packaged';
    packageInfo?: string;
  };

  const batchDetailsByTaxClass: Record<string, BatchDetail[]> = {
    hardCider: [],
    wineUnder16: [],
    wine16To21: [],
    wine21To24: [],
    sparklingWine: [],
    carbonatedWine: [],
    appleBrandy: [],
    grapeSpirits: [],
  };

  for (const batch of batchDetailData) {
    const taxClass = productTypeToTaxClass(batch.productType);
    const volumeLiters = parseFloat(batch.volume || "0");
    const volumeGallons = volumeLiters * 0.264172;

    console.log(`  ${(batch.customName || batch.batchNumber).padEnd(30)} ${(batch.productType || 'null').padEnd(10)} -> ${taxClass.padEnd(15)} ${volumeLiters.toFixed(2).padStart(8)} L = ${volumeGallons.toFixed(2).padStart(7)} gal`);

    batchDetailsByTaxClass[taxClass].push({
      id: batch.id,
      name: batch.customName || batch.batchNumber,
      batchNumber: batch.batchNumber,
      vesselName: batch.vesselName,
      volumeLiters,
      volumeGallons,
      type: 'bulk',
    });
  }

  console.log("\n\nBATCH DETAILS BY TAX CLASS:");
  for (const [taxClass, batches] of Object.entries(batchDetailsByTaxClass)) {
    if (batches.length > 0) {
      console.log(`\n  ${taxClass}: ${batches.length} batches`);
      for (const b of batches) {
        console.log(`    - ${b.name}: ${b.volumeGallons.toFixed(2)} gal (${b.vesselName || 'no vessel'})`);
      }
    }
  }

  process.exit(0);
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
