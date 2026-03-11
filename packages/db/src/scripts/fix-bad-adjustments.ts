import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Investigate if fruit batch drift is caused by bottling loss detection.
 *
 * computeSystemCalculatedOnHand has smart loss detection:
 * If volumeTaken ≈ productVolume + loss (within 2L), loss is "included"
 * in volumeTaken and is NOT separately deducted.
 *
 * Our previous drift check scripts didn't implement this logic,
 * so they may have over-reported drift on batches where bottling
 * loss was included.
 */
async function main() {
  console.log("=== Bottling loss detection check for drift batches ===\n");

  // Get all non-deleted batches and compute SBD with proper bottling loss detection
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.name, COALESCE(b.custom_name, '') as cn, b.product_type,
      b.parent_batch_id,
      round(b.initial_volume_liters::numeric, 4) as initial_l,
      round(b.current_volume_liters::numeric, 4) as current_l,
      b.status, b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
    ORDER BY b.start_date
  `));

  const driftBatches: { name: string; sbd: number; current: number; drift: number; driftGal: number; id: string; bottlingLossSkipped: number }[] = [];

  for (const b of batches.rows) {
    const batchId = b.id as string;
    const initial = Number(b.initial_l);
    const current = Number(b.current_l);

    // Full SBD reconstruction with proper bottling loss detection
    const tIn = await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v FROM batch_transfers WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL`));
    const tOut = await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v, COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) as l FROM batch_transfers WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL`));
    const mIn = await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_added::numeric), 0) as v FROM batch_merge_history WHERE target_batch_id = '${batchId}' AND deleted_at IS NULL`));
    const mOut = await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_added::numeric), 0) as v FROM batch_merge_history WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL`));

    // Bottling with smart loss detection
    const bottleRuns = await db.execute(sql.raw(`
      SELECT volume_taken_liters::numeric as vol,
        CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END as loss_l,
        units_produced, package_size_ml
      FROM bottle_runs
      WHERE batch_id = '${batchId}' AND voided_at IS NULL
    `));
    let bottlingVol = 0;
    let bottlingLoss = 0;
    let bottlingLossSkipped = 0;
    for (const br of bottleRuns.rows) {
      const volumeTaken = Number(br.vol);
      const lossVal = Number(br.loss_l);
      const productVol = ((br.units_produced || 0) * (br.package_size_ml || 0)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVol + lossVal)) < 2;
      bottlingVol += volumeTaken;
      if (!lossIncluded) {
        bottlingLoss += lossVal;
      } else {
        bottlingLossSkipped += lossVal;
      }
    }

    const kegs = await db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END), 0) as v, COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) as l FROM keg_fills WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL`));
    const racks = await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_loss::numeric), 0) as v FROM batch_racking_operations WHERE batch_id = '${batchId}' AND deleted_at IS NULL AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')`));
    const filt = await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_loss::numeric), 0) as v FROM batch_filter_operations WHERE batch_id = '${batchId}'`));
    const adj = await db.execute(sql.raw(`SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as v FROM batch_volume_adjustments WHERE batch_id = '${batchId}' AND deleted_at IS NULL`));
    const dist = await db.execute(sql.raw(`SELECT COALESCE(SUM(source_volume_liters::numeric), 0) as v FROM distillation_records WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL AND status IN ('sent', 'received')`));

    const transfersIn = Number(tIn.rows[0].v);
    const isTransferCreated = b.parent_batch_id && transfersIn >= initial * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : initial;

    const sbd = effectiveInitial + Number(mIn.rows[0].v) - Number(mOut.rows[0].v) + transfersIn
      - Number(tOut.rows[0].v) - Number(tOut.rows[0].l)
      - bottlingVol - bottlingLoss
      - Number(kegs.rows[0].v) - Number(kegs.rows[0].l)
      - Number(dist.rows[0].v) + Number(adj.rows[0].v)
      - Number(racks.rows[0].v) - Number(filt.rows[0].v);

    const drift = sbd - current;
    if (Math.abs(drift) > 0.5) {
      driftBatches.push({
        name: (b.cn || b.name) as string,
        sbd, current, drift, driftGal: drift / 3.78541,
        id: batchId,
        bottlingLossSkipped,
      });
    }
  }

  driftBatches.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  if (driftBatches.length === 0) {
    console.log("No batches with drift > 0.5L! All SBD endings match current volumes.");
  } else {
    console.log(`${driftBatches.length} batches with drift > 0.5L:\n`);
    let totalDriftGal = 0;
    for (const d of driftBatches) {
      console.log(`${d.name}: SBD=${d.sbd.toFixed(2)}L, current=${d.current.toFixed(2)}L, drift=${d.drift.toFixed(2)}L (${d.driftGal.toFixed(2)} gal)${d.bottlingLossSkipped > 0 ? ` [bottleLossSkipped=${d.bottlingLossSkipped.toFixed(2)}L]` : ""}`);
      totalDriftGal += d.driftGal;
    }
    console.log(`\nTotal drift: ${totalDriftGal.toFixed(2)} gal`);
  }

  // Also check: total clamped loss (negative SBD batches)
  console.log("\n\n=== Negative SBD batches ===");
  const negativeBatches = driftBatches.filter(d => d.sbd < -0.5);
  if (negativeBatches.length === 0) {
    console.log("None!");
  } else {
    let totalClampedGal = 0;
    for (const d of negativeBatches) {
      console.log(`${d.name}: SBD=${d.sbd.toFixed(2)}L (${(d.sbd / 3.78541).toFixed(2)} gal)`);
      totalClampedGal += d.sbd / 3.78541;
    }
    console.log(`Total clamped: ${totalClampedGal.toFixed(2)} gal`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
