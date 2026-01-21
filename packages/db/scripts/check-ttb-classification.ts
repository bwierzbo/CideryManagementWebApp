/**
 * Check TTB tax class classification for reconciliation
 */

import { db } from "../src/index.js";
import { sql } from "drizzle-orm";

async function check() {
  console.log("═".repeat(70));
  console.log("TTB TAX CLASS VERIFICATION");
  console.log("═".repeat(70));

  // 1. Check Salish batch specifically
  console.log("\n1. SALISH BATCH DETAILS:\n");

  const salish = await db.execute(sql`
    SELECT
      id,
      custom_name,
      batch_number,
      product_type,
      initial_volume,
      initial_volume_liters,
      current_volume_liters,
      status,
      reconciliation_status,
      start_date
    FROM batches
    WHERE custom_name = 'Salish'
    AND deleted_at IS NULL
    AND reconciliation_status = 'verified'
  `);

  for (const row of salish.rows) {
    const b = row as Record<string, unknown>;
    const liters = parseFloat(b.initial_volume_liters as string || b.initial_volume as string);
    const gallons = liters / 3.78541;
    console.log(`  Name: ${b.custom_name}`);
    console.log(`  Product Type: ${b.product_type}`);
    console.log(`  Initial Volume: ${liters} L (${gallons.toFixed(2)} gal)`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Reconciliation: ${b.reconciliation_status}`);
    console.log();

    if (b.product_type !== 'pommeau') {
      console.log(`  ⚠️ WARNING: product_type should be 'pommeau' for Wine 16-21% classification`);
    } else {
      console.log(`  ✅ product_type = 'pommeau' - Should be classified as Wine (16-21% ABV)`);
    }
  }

  // 2. Check all verified batches and their tax classifications
  console.log("\n" + "─".repeat(70));
  console.log("2. ALL VERIFIED BATCHES BY TAX CLASS:\n");

  const verified = await db.execute(sql`
    SELECT
      custom_name,
      product_type,
      initial_volume,
      CASE
        WHEN product_type = 'pommeau' THEN 'Wine (16-21% ABV)'
        WHEN product_type = 'brandy' THEN 'Spirits'
        ELSE 'Hard Cider (<8.5% ABV)'
      END as tax_class
    FROM batches
    WHERE deleted_at IS NULL
    AND reconciliation_status = 'verified'
    AND start_date < '2025-01-02'
    ORDER BY product_type, initial_volume DESC
  `);

  // Group by tax class
  const byClass: Record<string, { batches: any[], totalL: number, totalGal: number }> = {
    'Hard Cider (<8.5% ABV)': { batches: [], totalL: 0, totalGal: 0 },
    'Wine (16-21% ABV)': { batches: [], totalL: 0, totalGal: 0 },
    'Spirits': { batches: [], totalL: 0, totalGal: 0 }
  };

  for (const row of verified.rows) {
    const b = row as Record<string, unknown>;
    const liters = parseFloat(b.initial_volume as string);
    const gallons = liters / 3.78541;
    const taxClass = b.tax_class as string;

    if (byClass[taxClass]) {
      byClass[taxClass].batches.push({ ...b, liters, gallons });
      byClass[taxClass].totalL += liters;
      byClass[taxClass].totalGal += gallons;
    }
  }

  for (const [taxClass, data] of Object.entries(byClass)) {
    console.log(`  ${taxClass}:`);
    for (const b of data.batches) {
      console.log(`    ${(b.custom_name as string).padEnd(30)} ${b.liters.toFixed(2).padStart(8)} L  ${b.gallons.toFixed(2).padStart(8)} gal  (${b.product_type})`);
    }
    console.log(`    ${"─".repeat(60)}`);
    console.log(`    ${"SUBTOTAL".padEnd(30)} ${data.totalL.toFixed(2).padStart(8)} L  ${data.totalGal.toFixed(2).padStart(8)} gal`);
    console.log();
  }

  // 3. Summary comparison
  console.log("═".repeat(70));
  console.log("3. SUMMARY - SYSTEM vs TTB BALANCE:\n");

  const hardCiderGal = byClass['Hard Cider (<8.5% ABV)'].totalGal;
  const wineGal = byClass['Wine (16-21% ABV)'].totalGal;
  const totalGal = hardCiderGal + wineGal;

  console.log(`  Tax Class                TTB Balance    System      Difference`);
  console.log(`  ${"─".repeat(60)}`);
  console.log(`  Hard Cider (<8.5% ABV)   1061.0 gal     ${hardCiderGal.toFixed(1).padStart(7)} gal   ${(1061.0 - hardCiderGal).toFixed(1).padStart(6)} gal`);
  console.log(`  Wine (16-21% ABV)          60.0 gal     ${wineGal.toFixed(1).padStart(7)} gal   ${(60.0 - wineGal).toFixed(1).padStart(6)} gal`);
  console.log(`  ${"─".repeat(60)}`);
  console.log(`  TOTAL                    1121.0 gal     ${totalGal.toFixed(1).padStart(7)} gal   ${(1121.0 - totalGal).toFixed(1).padStart(6)} gal`);

  // 4. Analysis
  console.log("\n" + "═".repeat(70));
  console.log("4. ANALYSIS:\n");

  if (wineGal < 1) {
    console.log("  ❌ Wine (16-21% ABV) shows 0.0 gal in system");
    console.log("     Salish (225 L = ~59.4 gal) should be in this category");
    console.log("     Check if Salish has product_type = 'pommeau' and ABV >= 16%");
  }

  const expectedTotal = 4001.33 / 3.78541; // Convert our verified liters to gallons
  console.log(`\n  Expected total from verified batches: ${expectedTotal.toFixed(2)} gal`);
  console.log(`  TTB Balance total: 1121.0 gal`);
  console.log(`  System showing: ${totalGal.toFixed(2)} gal`);

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
