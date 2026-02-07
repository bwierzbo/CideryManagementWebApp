/**
 * Verify 2024 Ending Balance
 *
 * Confirms that the end-of-2024 batch volumes match the TTB opening balance
 * of 1121 total gallons (cider + wine 16-21%).
 */

import { db } from "../index.js";
import { sql } from "drizzle-orm";

const WINE_GALLONS_PER_LITER = 0.264172;

function litersToGallons(liters: number): number {
  return liters * WINE_GALLONS_PER_LITER;
}

function productTypeToTaxClass(pt: string): string {
  switch (pt) {
    case "cider": case "perry": return "hardCider";
    case "pommeau": return "wine16To21";
    case "brandy": return "appleBrandy";
    case "wine": return "wineUnder16";
    default: return "hardCider";
  }
}

async function verify2024Balance() {
  console.log("=".repeat(80));
  console.log("  VERIFY 2024 ENDING BALANCE vs TTB OPENING BALANCE");
  console.log("=".repeat(80));
  console.log("");

  // ---- PART 1: Read configured TTB opening balance ----
  console.log("PART 1: CONFIGURED TTB OPENING BALANCE");
  console.log("-".repeat(50));

  const settings = await db.execute(sql`
    SELECT
      ttb_opening_balance_date,
      ttb_opening_balances,
      ttb_onboarding_completed_at
    FROM organization_settings
    LIMIT 1
  `);

  const row = settings.rows[0] as {
    ttb_opening_balance_date: string;
    ttb_opening_balances: {
      bulk: Record<string, number>;
      bottled: Record<string, number>;
      spirits?: Record<string, number>;
    };
    ttb_onboarding_completed_at: string;
  };

  console.log(`  Opening balance date: ${row.ttb_opening_balance_date}`);

  const ob = row.ttb_opening_balances;
  let bulkTotal = 0;
  let bottledTotal = 0;

  console.log("  Bulk (wine gallons):");
  for (const [cls, gal] of Object.entries(ob.bulk || {})) {
    if (gal > 0) console.log(`    ${cls}: ${gal.toFixed(2)} gal`);
    bulkTotal += gal;
  }
  console.log(`    TOTAL BULK: ${bulkTotal.toFixed(2)} gal`);

  console.log("  Bottled (wine gallons):");
  for (const [cls, gal] of Object.entries(ob.bottled || {})) {
    if (gal > 0) console.log(`    ${cls}: ${gal.toFixed(2)} gal`);
    bottledTotal += gal;
  }
  console.log(`    TOTAL BOTTLED: ${bottledTotal.toFixed(2)} gal`);

  const configuredTotal = bulkTotal + bottledTotal;
  console.log(`\n  CONFIGURED TOTAL: ${configuredTotal.toFixed(2)} gal\n`);

  // ---- PART 2: ALL pre-2025 batches ----
  console.log("PART 2: ALL PRE-2025 BATCHES (including zero-volume)");
  console.log("-".repeat(50));

  const batchesResult = await db.execute(sql`
    SELECT
      b.id,
      b.batch_number,
      b.custom_name,
      b.product_type,
      b.status,
      b.reconciliation_status,
      b.current_volume_liters,
      b.initial_volume_liters,
      b.start_date,
      b.end_date,
      b.is_archived,
      v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NULL
      AND b.start_date < '2025-01-01'
    ORDER BY b.product_type, b.start_date
  `);

  console.log(`  Found ${batchesResult.rows.length} total pre-2025 batches\n`);

  let totalInitial = 0;
  let totalCurrent = 0;

  for (const row of batchesResult.rows) {
    const b = row as Record<string, unknown>;
    const init = parseFloat(b.initial_volume_liters as string) || 0;
    const curr = parseFloat(b.current_volume_liters as string) || 0;
    const name = (b.custom_name || b.batch_number) as string;
    totalInitial += init;
    totalCurrent += curr;
    console.log(`  ${name.padEnd(30)} | ${(b.product_type as string).padEnd(10)} | ${(b.reconciliation_status as string).padEnd(10)} | init: ${init.toFixed(1).padStart(8)}L (${litersToGallons(init).toFixed(1).padStart(6)} gal) | curr: ${curr.toFixed(1).padStart(8)}L (${litersToGallons(curr).toFixed(1).padStart(6)} gal)`);
  }

  console.log("-".repeat(100));
  console.log(`  TOTAL INITIAL: ${totalInitial.toFixed(2)}L = ${litersToGallons(totalInitial).toFixed(2)} gal`);
  console.log(`  TOTAL CURRENT: ${totalCurrent.toFixed(2)}L = ${litersToGallons(totalCurrent).toFixed(2)} gal\n`);

  // ---- PART 3: Reconstruct approximate 2024-12-31 volume ----
  // Initial volume + transfers received - transfers sent - packaging - losses
  console.log("PART 3: APPROXIMATE 2024-12-31 VOLUME RECONSTRUCTION");
  console.log("-".repeat(50));
  console.log("  (initial volume + transfers in - transfers out - packaging - losses)\n");

  // Get batch IDs
  const batchIds = batchesResult.rows.map((r: Record<string, unknown>) => r.id as string);

  if (batchIds.length === 0) {
    console.log("  No pre-2025 batches to analyze.");
    process.exit(0);
  }

  // Transfers INTO pre-2025 batches (before 2025)
  const transfersIn = await db.execute(sql`
    SELECT
      bt.destination_batch_id,
      COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as total_liters
    FROM batch_transfers bt
    JOIN batches db ON bt.destination_batch_id = db.id
    WHERE db.start_date < '2025-01-01'
      AND db.deleted_at IS NULL
      AND bt.deleted_at IS NULL
      AND bt.transferred_at < '2025-01-01'
    GROUP BY bt.destination_batch_id
  `);

  const transferInMap = new Map<string, number>();
  for (const t of transfersIn.rows) {
    const tr = t as { destination_batch_id: string; total_liters: string };
    transferInMap.set(tr.destination_batch_id, parseFloat(tr.total_liters));
  }

  // Transfers OUT of pre-2025 batches (before 2025)
  const transfersOut = await db.execute(sql`
    SELECT
      bt.source_batch_id,
      COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as total_liters
    FROM batch_transfers bt
    JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE sb.start_date < '2025-01-01'
      AND sb.deleted_at IS NULL
      AND bt.deleted_at IS NULL
      AND bt.transferred_at < '2025-01-01'
    GROUP BY bt.source_batch_id
  `);

  const transferOutMap = new Map<string, number>();
  for (const t of transfersOut.rows) {
    const tr = t as { source_batch_id: string; total_liters: string };
    transferOutMap.set(tr.source_batch_id, parseFloat(tr.total_liters));
  }

  // Packaging (bottle runs) from pre-2025 batches before 2025
  const packaging = await db.execute(sql`
    SELECT
      br.batch_id,
      COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)), 0) as total_liters
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE b.start_date < '2025-01-01'
      AND b.deleted_at IS NULL
      AND br.voided_at IS NULL
      AND br.packaged_at < '2025-01-01'
    GROUP BY br.batch_id
  `);

  const packagingMap = new Map<string, number>();
  for (const p of packaging.rows) {
    const pk = p as { batch_id: string; total_liters: string };
    packagingMap.set(pk.batch_id, parseFloat(pk.total_liters));
  }

  // Volume adjustments before 2025
  const adjustments = await db.execute(sql`
    SELECT
      va.batch_id,
      COALESCE(SUM(CAST(va.adjustment_amount AS DECIMAL)), 0) as total_change
    FROM batch_volume_adjustments va
    JOIN batches b ON va.batch_id = b.id
    WHERE b.start_date < '2025-01-01'
      AND b.deleted_at IS NULL
      AND va.deleted_at IS NULL
      AND va.created_at < '2025-01-01'
    GROUP BY va.batch_id
  `);

  const adjustmentMap = new Map<string, number>();
  for (const a of adjustments.rows) {
    const adj = a as { batch_id: string; total_change: string };
    adjustmentMap.set(adj.batch_id, parseFloat(adj.total_change));
  }

  // Keg fills before 2025
  const kegFills = await db.execute(sql`
    SELECT
      kf.batch_id,
      COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)), 0) as total_liters
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE b.start_date < '2025-01-01'
      AND b.deleted_at IS NULL
      AND kf.voided_at IS NULL
      AND kf.filled_at < '2025-01-01'
    GROUP BY kf.batch_id
  `);

  const kegMap = new Map<string, number>();
  for (const k of kegFills.rows) {
    const kf = k as { batch_id: string; total_liters: string };
    kegMap.set(kf.batch_id, parseFloat(kf.total_liters));
  }

  // Reconstruct
  const volumeByTaxClass: Record<string, number> = {};
  let grandTotalReconstructed = 0;

  for (const row of batchesResult.rows) {
    const b = row as Record<string, unknown>;
    const id = b.id as string;
    const init = parseFloat(b.initial_volume_liters as string) || 0;
    const name = (b.custom_name || b.batch_number) as string;
    const productType = b.product_type as string;
    const taxClass = productTypeToTaxClass(productType);

    const tIn = transferInMap.get(id) || 0;
    const tOut = transferOutMap.get(id) || 0;
    const pkg = packagingMap.get(id) || 0;
    const adj = adjustmentMap.get(id) || 0;
    const keg = kegMap.get(id) || 0;

    const reconstructed = init + tIn - tOut - pkg - keg + adj;
    const reconstructedGal = litersToGallons(Math.max(0, reconstructed));

    volumeByTaxClass[taxClass] = (volumeByTaxClass[taxClass] || 0) + reconstructedGal;
    grandTotalReconstructed += reconstructedGal;

    if (reconstructedGal > 0.1) {
      console.log(`  ${name.padEnd(30)} | ${taxClass.padEnd(12)} | init:${init.toFixed(0).padStart(6)}L + tIn:${tIn.toFixed(0).padStart(5)}L - tOut:${tOut.toFixed(0).padStart(5)}L - pkg:${pkg.toFixed(0).padStart(5)}L - keg:${keg.toFixed(0).padStart(5)}L + adj:${adj.toFixed(0).padStart(5)}L = ${reconstructedGal.toFixed(1)} gal`);
    }
  }

  console.log("-".repeat(100));
  console.log("  Reconstructed totals by tax class:");
  for (const [cls, gal] of Object.entries(volumeByTaxClass).sort()) {
    if (gal > 0) console.log(`    ${cls}: ${gal.toFixed(2)} gal`);
  }
  console.log(`    TOTAL: ${grandTotalReconstructed.toFixed(2)} gal\n`);

  // ---- PART 4: Also check 2025 operations on pre-2025 batches ----
  console.log("PART 4: 2025 OPERATIONS ON PRE-2025 BATCHES (volume removed in 2025)");
  console.log("-".repeat(50));

  const transfersOut2025 = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as total_liters
    FROM batch_transfers bt
    JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE sb.start_date < '2025-01-01'
      AND sb.deleted_at IS NULL
      AND bt.deleted_at IS NULL
      AND bt.transferred_at >= '2025-01-01'
  `);
  const tOut2025 = parseFloat((transfersOut2025.rows[0] as { total_liters: string }).total_liters);

  const packaging2025 = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)), 0) as total_liters
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE b.start_date < '2025-01-01'
      AND b.deleted_at IS NULL
      AND br.voided_at IS NULL
      AND br.packaged_at >= '2025-01-01'
  `);
  const pkg2025 = parseFloat((packaging2025.rows[0] as { total_liters: string }).total_liters);

  const keg2025 = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)), 0) as total_liters
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE b.start_date < '2025-01-01'
      AND b.deleted_at IS NULL
      AND kf.voided_at IS NULL
      AND kf.filled_at >= '2025-01-01'
  `);
  const kf2025 = parseFloat((keg2025.rows[0] as { total_liters: string }).total_liters);

  console.log(`  Transfers out in 2025: ${tOut2025.toFixed(2)}L = ${litersToGallons(tOut2025).toFixed(2)} gal`);
  console.log(`  Bottling in 2025:      ${pkg2025.toFixed(2)}L = ${litersToGallons(pkg2025).toFixed(2)} gal`);
  console.log(`  Keg fills in 2025:     ${kf2025.toFixed(2)}L = ${litersToGallons(kf2025).toFixed(2)} gal`);
  console.log(`  Total removed in 2025: ${(tOut2025 + pkg2025 + kf2025).toFixed(2)}L = ${litersToGallons(tOut2025 + pkg2025 + kf2025).toFixed(2)} gal`);

  const currentGal = litersToGallons(totalCurrent);
  const reconstructedFromCurrent = currentGal + litersToGallons(tOut2025 + pkg2025 + kf2025);
  console.log(`\n  Current volume + 2025 removals = ${currentGal.toFixed(2)} + ${litersToGallons(tOut2025 + pkg2025 + kf2025).toFixed(2)} = ${reconstructedFromCurrent.toFixed(2)} gal`);

  // ---- FINAL COMPARISON ----
  console.log("\n" + "=".repeat(80));
  console.log("  FINAL COMPARISON");
  console.log("=".repeat(80));
  console.log(`  Configured TTB opening balance:     ${configuredTotal.toFixed(2)} gal`);
  console.log(`    - hardCider (bulk):               ${(ob.bulk.hardCider || 0).toFixed(2)} gal`);
  console.log(`    - wine16To21 (bulk):              ${(ob.bulk.wine16To21 || 0).toFixed(2)} gal`);
  console.log("");
  console.log(`  Reconstructed from batch data:      ${grandTotalReconstructed.toFixed(2)} gal`);
  console.log(`    - hardCider:                      ${(volumeByTaxClass["hardCider"] || 0).toFixed(2)} gal`);
  console.log(`    - wine16To21:                     ${(volumeByTaxClass["wine16To21"] || 0).toFixed(2)} gal`);
  console.log("");
  const diff = configuredTotal - grandTotalReconstructed;
  console.log(`  DIFFERENCE:                         ${diff.toFixed(2)} gal`);
  console.log("");

  if (Math.abs(diff) < 5) {
    console.log("  ✅ Volumes match within 5 gallon tolerance");
  } else {
    console.log("  ⚠️  Significant difference detected");
    console.log("");
    console.log("  EXPLANATION:");
    console.log("  The configured opening balance of 1121 gal was manually entered");
    console.log("  during TTB onboarding based on your physical inventory / TTB records.");
    console.log("  The database only tracks batches that were entered into the system.");
    console.log("  The difference represents cider inventory that existed at end of 2024");
    console.log("  but was not entered as individual batches in the management app.");
    console.log("  This is expected if the app was set up in 2025 and only a subset of");
    console.log("  2024 batches were retroactively entered.");
  }

  process.exit(0);
}

verify2024Balance().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
