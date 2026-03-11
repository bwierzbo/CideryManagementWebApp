/**
 * HC TTB Form Verification Script
 *
 * Independently queries the database for each non-loss line of the
 * Hard Cider column on TTB Form 5120.17 and compares against expected values.
 *
 * Lines checked:
 *   1  - Opening inventory (from organization_settings JSONB)
 *   2  - Production (press runs, minus quince reclassification)
 *  13  - Bottled/Packaged (bottle_runs + keg_fills)
 *  16  - Distillation (sent to DSP)
 *  24  - Change of class OUT (transfers from HC to non-HC)
 *  31  - Ending bulk inventory (current_volume_liters of eligible batches)
 */

import { db } from "..";
import { sql } from "drizzle-orm";

const LITERS_PER_GALLON = 3.78541;
function lToGal(liters: number): number {
  return liters / LITERS_PER_GALLON;
}
function fmtGal(gal: number): string {
  return gal.toFixed(1);
}
function matchLabel(actual: number, expected: number): string {
  return Math.abs(actual - expected) < 0.15 ? "MATCH" : "MISMATCH";
}

async function main() {
  console.log("=== HC TTB Form Verification ===\n");

  // ---------------------------------------------------------------
  // Line 1: Opening (from organization_settings)
  // ---------------------------------------------------------------
  const settingsResult = await db.execute(sql.raw(`
    SELECT ttb_opening_balances
    FROM organization_settings
    LIMIT 1
  `));
  const balances = (settingsResult.rows[0] as any)?.ttb_opening_balances as any;
  const line1Gal = balances?.bulk?.hardCider ?? 0;
  const expectedLine1 = 1061.0;
  console.log(`Line 1  (Opening):       ${fmtGal(line1Gal)} gal [${matchLabel(line1Gal, expectedLine1)} vs ${fmtGal(expectedLine1)}]`);

  // ---------------------------------------------------------------
  // Line 2: Production (press runs in 2025, minus quince)
  //
  // NOTE: The TTB form uses SBD-based production, which sums:
  //   a) initialVolumeLiters of new HC batches (created after 2024-12-31)
  //   b) press transfer loss (grosses up net initial to gross press yield)
  //   c) new-material merges (press_run + juice_purchase source types)
  //   d) internal merges (batch_transfer source type)
  // This differs from simply summing press_runs.total_juice_volume_liters.
  // We show both approaches for comparison.
  // ---------------------------------------------------------------

  // Approach A: Raw press run totals
  const pressResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(total_juice_volume_liters AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS run_count
    FROM press_runs
    WHERE deleted_at IS NULL
      AND status != 'cancelled'
      AND date_completed > '2024-12-31'
  `));
  const pressLiters = parseFloat((pressResult.rows[0] as any).total_liters);
  const pressCount = parseInt((pressResult.rows[0] as any).run_count, 10);
  const pressGal = lToGal(pressLiters);

  // Approach B: SBD-based production (matches actual TTB form computation)
  // Eligible batch filter (matches ttb.ts): NOT IN (duplicate, excluded) OR racking derivative OR has parent
  const ELIGIBLE_FILTER = `(
    COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    OR b.is_racking_derivative IS TRUE
    OR b.parent_batch_id IS NOT NULL
  )`;

  // B1: initialVolumeLiters of new HC batches in 2025 (non-transfer-created)
  const newBatchInitResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(b.initial_volume_liters AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS batch_count
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND b.start_date > '2024-12-31'
      AND ${ELIGIBLE_FILTER}
      AND (
        b.parent_batch_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM batch_transfers bt
          WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
          HAVING SUM(CAST(bt.volume_transferred AS NUMERIC)) >= CAST(b.initial_volume_liters AS NUMERIC) * 0.9
        )
      )
  `));
  const newBatchInitLiters = parseFloat((newBatchInitResult.rows[0] as any).total_liters);
  const newBatchCount = parseInt((newBatchInitResult.rows[0] as any).batch_count, 10);

  // B2: Press transfer loss for new batches (grosses up to gross yield)
  const pressTransferLossResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(b.transfer_loss_l AS NUMERIC)), 0) AS total_liters
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND b.start_date > '2024-12-31'
      AND ${ELIGIBLE_FILTER}
      AND b.transfer_loss_l IS NOT NULL
      AND (
        b.parent_batch_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM batch_transfers bt
          WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
          HAVING SUM(CAST(bt.volume_transferred AS NUMERIC)) >= CAST(b.initial_volume_liters AS NUMERIC) * 0.9
        )
      )
  `));
  const pressTransferLossLiters = parseFloat((pressTransferLossResult.rows[0] as any).total_liters);

  // B3: New material merges (press_run and juice_purchase sources) during 2025
  // Scoped to eligible HC batches
  const newMaterialMergeResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(bmh.volume_added AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS merge_count,
      bmh.source_type
    FROM batch_merge_history bmh
    JOIN batches b ON b.id = bmh.target_batch_id
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND ${ELIGIBLE_FILTER}
      AND bmh.source_type IN ('press_run', 'juice_purchase')
      AND bmh.merged_at > '2024-12-31'
      AND bmh.merged_at < '2026-01-01'
    GROUP BY bmh.source_type
  `));
  let newMaterialMergeLiters = 0;
  const mergeDetails: string[] = [];
  for (const row of newMaterialMergeResult.rows as any[]) {
    const vol = parseFloat(row.total_liters);
    newMaterialMergeLiters += vol;
    mergeDetails.push(`${row.source_type}: ${fmtGal(lToGal(vol))} gal (${row.merge_count} merges, ${vol.toFixed(1)} L)`);
  }

  // B4: Internal merges (batch_transfer source type) during 2025
  const internalMergeResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(bmh.volume_added AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS merge_count
    FROM batch_merge_history bmh
    JOIN batches b ON b.id = bmh.target_batch_id
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND ${ELIGIBLE_FILTER}
      AND bmh.source_type = 'batch_transfer'
      AND bmh.merged_at > '2024-12-31'
      AND bmh.merged_at < '2026-01-01'
  `));
  const internalMergeLiters = parseFloat((internalMergeResult.rows[0] as any).total_liters);
  const internalMergeCount = parseInt((internalMergeResult.rows[0] as any).merge_count, 10);

  const sbdProductionLiters = newBatchInitLiters + pressTransferLossLiters + newMaterialMergeLiters + internalMergeLiters;
  const sbdProductionGal = lToGal(sbdProductionLiters);

  const quinceGal = 10.0;
  const line2Gal = sbdProductionGal - quinceGal;
  const expectedLine2 = 5034.1;
  console.log(`Line 2  (Production):    ${fmtGal(line2Gal)} gal [${matchLabel(line2Gal, expectedLine2)} vs ${fmtGal(expectedLine2)}]`);
  console.log(`  SBD breakdown:`);
  console.log(`    New batch initials:  ${fmtGal(lToGal(newBatchInitLiters))} gal (${newBatchCount} batches, ${newBatchInitLiters.toFixed(1)} L)`);
  console.log(`    Press transfer loss: ${fmtGal(lToGal(pressTransferLossLiters))} gal (${pressTransferLossLiters.toFixed(1)} L)`);
  for (const detail of mergeDetails) {
    console.log(`    New material merge:  ${detail}`);
  }
  console.log(`    Internal merges:     ${fmtGal(lToGal(internalMergeLiters))} gal (${internalMergeCount} merges, ${internalMergeLiters.toFixed(1)} L)`);
  console.log(`    SBD subtotal:        ${fmtGal(sbdProductionGal)} gal`);
  console.log(`  - Quince subtraction:  -${fmtGal(quinceGal)} gal`);
  console.log(`  Raw press runs total:  ${fmtGal(pressGal)} gal (${pressCount} runs, ${pressLiters.toFixed(1)} L) [for reference]`);

  // ---------------------------------------------------------------
  // Line 13: Bottled/Packaged (bottle_runs + keg_fills)
  // ---------------------------------------------------------------
  // Bottle runs
  const bottleResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(br.volume_taken_liters AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS run_count
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE br.voided_at IS NULL
      AND b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND br.packaged_at >= '2025-01-01'
      AND br.packaged_at < '2026-01-01'
  `));
  const bottleLiters = parseFloat((bottleResult.rows[0] as any).total_liters);
  const bottleCount = parseInt((bottleResult.rows[0] as any).run_count, 10);
  const bottleGal = lToGal(bottleLiters);

  // Keg fills
  const kegResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(kf.volume_taken AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS fill_count
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id
    WHERE kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND kf.filled_at >= '2025-01-01'
      AND kf.filled_at < '2026-01-01'
  `));
  const kegLiters = parseFloat((kegResult.rows[0] as any).total_liters);
  const kegCount = parseInt((kegResult.rows[0] as any).fill_count, 10);
  const kegGal = lToGal(kegLiters);

  const line13Gal = bottleGal + kegGal;
  const expectedLine13 = 155.0;
  console.log(`Line 13 (Packaged):      ${fmtGal(line13Gal)} gal [${matchLabel(line13Gal, expectedLine13)} vs ${fmtGal(expectedLine13)}]`);
  console.log(`  - Bottle runs:         ${fmtGal(bottleGal)} gal (${bottleCount} runs, ${bottleLiters.toFixed(1)} L)`);
  console.log(`  - Keg fills:           ${fmtGal(kegGal)} gal (${kegCount} fills, ${kegLiters.toFixed(1)} L)`);

  // ---------------------------------------------------------------
  // Line 16: Distillation (cider sent to DSP)
  // Note: schema uses sent_at for date, source_volume_liters for volume
  // ---------------------------------------------------------------
  const distResult = await db.execute(sql.raw(`
    SELECT
      dr.id,
      dr.distillery_name,
      CAST(dr.source_volume_liters AS NUMERIC) AS vol_liters,
      b.name AS batch_name,
      b.product_type,
      dr.sent_at
    FROM distillation_records dr
    JOIN batches b ON b.id = dr.source_batch_id
    WHERE b.product_type IN ('cider', 'perry')
      AND b.deleted_at IS NULL
      AND dr.deleted_at IS NULL
      AND dr.sent_at >= '2025-01-01'
      AND dr.sent_at < '2026-01-01'
    ORDER BY dr.sent_at
  `));
  let distTotalLiters = 0;
  const distRows = distResult.rows as any[];
  for (const row of distRows) {
    distTotalLiters += parseFloat(row.vol_liters || "0");
  }
  const line16Gal = lToGal(distTotalLiters);
  const expectedLine16 = 758.2;
  console.log(`Line 16 (Distillation):  ${fmtGal(line16Gal)} gal [${matchLabel(line16Gal, expectedLine16)} vs ${fmtGal(expectedLine16)}]`);
  for (const row of distRows) {
    const volL = parseFloat(row.vol_liters || "0");
    const sentDate = new Date(row.sent_at).toISOString().slice(0, 10);
    console.log(`  - ${row.batch_name} → ${row.distillery_name}: ${fmtGal(lToGal(volL))} gal (${volL.toFixed(1)} L) sent ${sentDate}`);
  }

  // ---------------------------------------------------------------
  // Line 24: Change of class OUT
  // Source = HC, Destination = non-HC
  // ---------------------------------------------------------------
  const classOutResult = await db.execute(sql.raw(`
    SELECT
      bt.id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol_liters,
      sb.name AS source_name,
      sb.product_type AS source_type,
      db.name AS dest_name,
      db.product_type AS dest_type,
      bt.transferred_at
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id
    JOIN batches db ON db.id = bt.destination_batch_id
    WHERE sb.product_type IN ('cider', 'perry')
      AND db.product_type NOT IN ('cider', 'perry')
      AND sb.deleted_at IS NULL
      AND db.deleted_at IS NULL
      AND bt.deleted_at IS NULL
      AND bt.transferred_at >= '2025-01-01'
      AND bt.transferred_at < '2026-01-01'
    ORDER BY bt.transferred_at
  `));
  let classOutTotalLiters = 0;
  const classOutRows = classOutResult.rows as any[];
  for (const row of classOutRows) {
    classOutTotalLiters += parseFloat(row.vol_liters || "0");
  }
  const line24Gal = lToGal(classOutTotalLiters);
  const expectedLine24 = 653.3;
  console.log(`Line 24 (Class change):  ${fmtGal(line24Gal)} gal [${matchLabel(line24Gal, expectedLine24)} vs ${fmtGal(expectedLine24)}]`);
  for (const row of classOutRows) {
    const volL = parseFloat(row.vol_liters || "0");
    const xDate = new Date(row.transferred_at).toISOString().slice(0, 10);
    console.log(`  - ${row.source_name} (${row.source_type}) → ${row.dest_name} (${row.dest_type}): ${fmtGal(lToGal(volL))} gal (${volL.toFixed(1)} L) on ${xDate}`);
  }

  // ---------------------------------------------------------------
  // Line 31: Ending bulk inventory
  // ---------------------------------------------------------------
  const endingResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS batch_count
    FROM batches
    WHERE product_type IN ('cider', 'perry')
      AND deleted_at IS NULL
      AND reconciliation_status IN ('verified', 'pending')
  `));
  const endingLiters = parseFloat((endingResult.rows[0] as any).total_liters);
  const endingCount = parseInt((endingResult.rows[0] as any).batch_count, 10);
  const line31Gal = lToGal(endingLiters);
  const expectedLine31 = 4092.3;
  console.log(`Line 31 (Ending bulk):   ${fmtGal(line31Gal)} gal [${matchLabel(line31Gal, expectedLine31)} vs ${fmtGal(expectedLine31)}]`);
  console.log(`  - ${endingCount} batches, ${endingLiters.toFixed(1)} L`);

  // ---------------------------------------------------------------
  // Summary / Cross-checks
  // ---------------------------------------------------------------
  console.log("\n--- Cross-checks ---\n");

  const line12Gal = line1Gal + line2Gal;
  const expectedLine12 = 6095.1;
  console.log(`Line 12 = Line 1 + Line 2 = ${fmtGal(line1Gal)} + ${fmtGal(line2Gal)} = ${fmtGal(line12Gal)} gal [${matchLabel(line12Gal, expectedLine12)} vs ${fmtGal(expectedLine12)}]`);

  const knownRemovals = line13Gal + line16Gal + line24Gal + line31Gal;
  const lossesBalancing = line12Gal - knownRemovals;
  console.log(`\nLine 32 = Line 13 + Line 16 + Line 24 + Line 31 + Losses = ${fmtGal(line12Gal)} gal`);
  console.log(`  Known removals: ${fmtGal(line13Gal)} + ${fmtGal(line16Gal)} + ${fmtGal(line24Gal)} + ${fmtGal(line31Gal)} = ${fmtGal(knownRemovals)} gal`);
  console.log(`  Losses (balancing) = ${fmtGal(line12Gal)} - ${fmtGal(knownRemovals)} = ${fmtGal(lossesBalancing)} gal`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
