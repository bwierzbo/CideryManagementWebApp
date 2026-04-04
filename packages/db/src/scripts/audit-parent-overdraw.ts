import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Complete volume audit for batch 6a06ce10 ("Summer Community Blend 1" in TANK-1000-2)
 * Investigating ~190L overdraw (1000L in, ~1190L out).
 *
 * Queries EVERYTHING: transfers in/out, adjustments, racking, packaging, measurements,
 * merge history, and cross-references destination batches for double-counting.
 */

const BATCH_PREFIX = "6a06ce10";
const GAL_PER_LITER = 0.264172;
const LITERS_PER_GAL = 3.78541;

function fmtL(l: number): string {
  return `${l.toFixed(2)}L (${(l * GAL_PER_LITER).toFixed(2)} gal)`;
}

function fmtDate(d: string | null): string {
  if (!d) return "(no date)";
  return new Date(d).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function toL(val: string | number | null | undefined): number {
  return parseFloat(String(val || "0"));
}

async function main() {
  // ═══════════════════════════════════════════════════════════════════
  // 0. FIND THE BATCH
  // ═══════════════════════════════════════════════════════════════════
  console.log("═".repeat(80));
  console.log("COMPLETE VOLUME AUDIT — Batch 6a06ce10");
  console.log("═".repeat(80));

  const batchRes = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.batch_number, b.product_type,
           CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
           CAST(b.current_volume_liters AS NUMERIC) AS cur_l,
           CAST(b.initial_volume AS NUMERIC) AS init_raw,
           b.initial_volume_unit,
           CAST(b.current_volume AS NUMERIC) AS cur_raw,
           b.current_volume_unit,
           b.status, b.start_date::text, b.end_date::text,
           b.parent_batch_id, b.is_racking_derivative,
           b.reconciliation_status, b.reconciliation_notes,
           b.volume_manually_corrected, b.deleted_at,
           v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id::text LIKE '${BATCH_PREFIX}%'
  `));

  if (batchRes.rows.length === 0) {
    console.log("BATCH NOT FOUND with prefix " + BATCH_PREFIX);
    process.exit(1);
  }

  const batch = batchRes.rows[0] as any;
  const batchId = batch.id;

  console.log(`\n=== BATCH RECORD ===`);
  console.log(`  ID:               ${batchId}`);
  console.log(`  Name:             ${batch.name}`);
  console.log(`  Custom Name:      ${batch.custom_name}`);
  console.log(`  Batch Number:     ${batch.batch_number}`);
  console.log(`  Product Type:     ${batch.product_type}`);
  console.log(`  Status:           ${batch.status}`);
  console.log(`  Vessel:           ${batch.vessel_name}`);
  console.log(`  Start Date:       ${fmtDate(batch.start_date)}`);
  console.log(`  End Date:         ${fmtDate(batch.end_date)}`);
  console.log(`  Initial Volume:   ${fmtL(toL(batch.init_l))} (raw: ${batch.init_raw} ${batch.initial_volume_unit})`);
  console.log(`  Current Volume:   ${fmtL(toL(batch.cur_l))} (raw: ${batch.cur_raw} ${batch.current_volume_unit})`);
  console.log(`  Parent Batch:     ${batch.parent_batch_id || "(none)"}`);
  console.log(`  Is Racking Deriv: ${batch.is_racking_derivative}`);
  console.log(`  Recon Status:     ${batch.reconciliation_status}`);
  console.log(`  Recon Notes:      ${batch.reconciliation_notes || "(none)"}`);
  console.log(`  Vol Manually Corrected: ${batch.volume_manually_corrected}`);
  console.log(`  Deleted:          ${batch.deleted_at || "(no)"}`);

  // ═══════════════════════════════════════════════════════════════════
  // 1. ALL TRANSFERS IN
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("1. ALL TRANSFERS IN (destination_batch_id = this batch)");
  console.log("═".repeat(80));

  const xfersIn = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id,
           CAST(bt.volume_transferred AS NUMERIC) AS vol,
           bt.volume_transferred_unit,
           CAST(COALESCE(bt.loss, '0') AS NUMERIC) AS loss,
           bt.loss_unit,
           CAST(COALESCE(bt.total_volume_processed, '0') AS NUMERIC) AS total_processed,
           CAST(COALESCE(bt.remaining_volume, '0') AS NUMERIC) AS remaining,
           bt.transferred_at::text, bt.notes, bt.deleted_at,
           sb.name AS source_name, sb.batch_number AS source_batch_num,
           sv.name AS source_vessel,
           dv.name AS dest_vessel
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE bt.destination_batch_id = '${batchId}'
    ORDER BY bt.transferred_at
  `));

  let totalXferIn = 0;
  let totalXferInLoss = 0;
  for (const x of xfersIn.rows as any[]) {
    const vol = toL(x.vol);
    const loss = toL(x.loss);
    totalXferIn += vol;
    totalXferInLoss += loss;
    console.log(`  ${fmtDate(x.transferred_at)} | ${fmtL(vol)} from "${x.source_name}" (${x.source_batch_num}) in ${x.source_vessel} -> ${x.dest_vessel}`);
    console.log(`    Loss: ${fmtL(loss)} | Total processed: ${fmtL(toL(x.total_processed))} | Remaining in source: ${fmtL(toL(x.remaining))}`);
    console.log(`    Notes: ${x.notes || "(none)"} | Deleted: ${x.deleted_at || "no"} | Transfer ID: ${x.id}`);
  }
  console.log(`  TOTAL TRANSFERS IN: ${fmtL(totalXferIn)} (loss: ${fmtL(totalXferInLoss)})`);
  console.log(`  Count: ${xfersIn.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 2. ALL MERGE HISTORY IN
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("2. ALL MERGE HISTORY IN (target_batch_id = this batch)");
  console.log("═".repeat(80));

  const mergesIn = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.source_batch_id, bmh.source_press_run_id,
           bmh.source_juice_purchase_item_id, bmh.source_type,
           CAST(bmh.volume_added AS NUMERIC) AS vol_added,
           bmh.volume_added_unit,
           CAST(bmh.target_volume_before AS NUMERIC) AS vol_before,
           CAST(bmh.target_volume_after AS NUMERIC) AS vol_after,
           bmh.merged_at::text, bmh.notes, bmh.deleted_at,
           sb.name AS source_name, sb.batch_number AS source_batch_num
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    WHERE bmh.target_batch_id = '${batchId}'
    ORDER BY bmh.merged_at
  `));

  let totalMergeIn = 0;
  for (const m of mergesIn.rows as any[]) {
    const vol = toL(m.vol_added);
    totalMergeIn += vol;
    console.log(`  ${fmtDate(m.merged_at)} | +${fmtL(vol)} from ${m.source_type}: "${m.source_name || m.source_press_run_id || m.source_juice_purchase_item_id}"`);
    console.log(`    Vol before: ${fmtL(toL(m.vol_before))} -> Vol after: ${fmtL(toL(m.vol_after))}`);
    console.log(`    Notes: ${m.notes || "(none)"} | Deleted: ${m.deleted_at || "no"} | Merge ID: ${m.id}`);
  }
  console.log(`  TOTAL MERGES IN: ${fmtL(totalMergeIn)}`);
  console.log(`  Count: ${mergesIn.rows.length}`);

  // Also check merges OUT (source_batch_id = this batch)
  const mergesOut = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id,
           CAST(bmh.volume_added AS NUMERIC) AS vol_added,
           bmh.merged_at::text, bmh.deleted_at,
           tb.name AS target_name
    FROM batch_merge_history bmh
    LEFT JOIN batches tb ON tb.id = bmh.target_batch_id
    WHERE bmh.source_batch_id = '${batchId}'
    ORDER BY bmh.merged_at
  `));

  let totalMergeOut = 0;
  if ((mergesOut.rows as any[]).length > 0) {
    console.log(`\n  MERGES OUT (source_batch_id = this batch):`);
    for (const m of mergesOut.rows as any[]) {
      const vol = toL(m.vol_added);
      totalMergeOut += vol;
      console.log(`  ${fmtDate(m.merged_at)} | -${fmtL(vol)} to "${m.target_name}" | Deleted: ${m.deleted_at || "no"}`);
    }
    console.log(`  TOTAL MERGES OUT: ${fmtL(totalMergeOut)}`);
  } else {
    console.log(`  MERGES OUT: (none)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. ALL TRANSFERS OUT
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("3. ALL TRANSFERS OUT (source_batch_id = this batch)");
  console.log("═".repeat(80));

  const xfersOut = await db.execute(sql.raw(`
    SELECT bt.id, bt.destination_batch_id,
           CAST(bt.volume_transferred AS NUMERIC) AS vol,
           bt.volume_transferred_unit,
           CAST(COALESCE(bt.loss, '0') AS NUMERIC) AS loss,
           bt.loss_unit,
           CAST(COALESCE(bt.total_volume_processed, '0') AS NUMERIC) AS total_processed,
           CAST(COALESCE(bt.remaining_volume, '0') AS NUMERIC) AS remaining,
           bt.transferred_at::text, bt.notes, bt.deleted_at,
           db2.name AS dest_name, db2.batch_number AS dest_batch_num,
           db2.custom_name AS dest_custom_name,
           CAST(db2.initial_volume_liters AS NUMERIC) AS dest_init_l,
           CAST(db2.current_volume_liters AS NUMERIC) AS dest_cur_l,
           db2.status AS dest_status, db2.is_racking_derivative AS dest_is_racking,
           db2.reconciliation_status AS dest_recon,
           db2.parent_batch_id AS dest_parent,
           db2.deleted_at AS dest_deleted,
           dv.name AS dest_vessel,
           sv.name AS source_vessel
    FROM batch_transfers bt
    LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    WHERE bt.source_batch_id = '${batchId}'
    ORDER BY bt.transferred_at
  `));

  let totalXferOut = 0;
  let totalXferOutLoss = 0;
  const destBatchIds: string[] = [];

  for (const x of xfersOut.rows as any[]) {
    const vol = toL(x.vol);
    const loss = toL(x.loss);
    totalXferOut += vol;
    totalXferOutLoss += loss;
    destBatchIds.push(x.destination_batch_id);

    console.log(`  ${fmtDate(x.transferred_at)} | ${fmtL(vol)} -> "${x.dest_name}" (${x.dest_batch_num}) in ${x.dest_vessel}`);
    console.log(`    Loss: ${fmtL(loss)} | Total processed: ${fmtL(toL(x.total_processed))} | Remaining: ${fmtL(toL(x.remaining))}`);
    console.log(`    Notes: ${x.notes || "(none)"} | Deleted: ${x.deleted_at || "no"} | Transfer ID: ${x.id}`);
    console.log(`    --- Destination batch details ---`);
    console.log(`    Dest init_vol: ${fmtL(toL(x.dest_init_l))} | Dest cur_vol: ${fmtL(toL(x.dest_cur_l))}`);
    console.log(`    Dest status: ${x.dest_status} | Is racking: ${x.dest_is_racking} | Recon: ${x.dest_recon}`);
    console.log(`    Dest parent: ${x.dest_parent || "(none)"} | Dest deleted: ${x.dest_deleted || "no"}`);

    // Check if dest initial matches transfer volume
    const destInit = toL(x.dest_init_l);
    const diff = Math.abs(destInit - vol);
    if (diff > 0.5) {
      console.log(`    *** MISMATCH: Transfer vol (${fmtL(vol)}) != Dest initial (${fmtL(destInit)}) — diff: ${fmtL(diff)} ***`);
    } else {
      console.log(`    Match: Transfer vol ≈ Dest initial (diff: ${diff.toFixed(2)}L)`);
    }
  }
  console.log(`\n  TOTAL TRANSFERS OUT: ${fmtL(totalXferOut)} (loss: ${fmtL(totalXferOutLoss)})`);
  console.log(`  Count: ${xfersOut.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 4. ALL VOLUME ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("4. ALL VOLUME ADJUSTMENTS");
  console.log("═".repeat(80));

  const adjustments = await db.execute(sql.raw(`
    SELECT bva.id,
           bva.adjustment_date::text,
           bva.adjustment_type,
           CAST(bva.volume_before AS NUMERIC) AS vol_before,
           CAST(bva.volume_after AS NUMERIC) AS vol_after,
           CAST(bva.adjustment_amount AS NUMERIC) AS amount,
           bva.reason, bva.notes, bva.deleted_at,
           u.name AS adjusted_by_name, u.email AS adjusted_by_email,
           v.name AS vessel_name
    FROM batch_volume_adjustments bva
    LEFT JOIN users u ON u.id = bva.adjusted_by
    LEFT JOIN vessels v ON v.id = bva.vessel_id
    WHERE bva.batch_id = '${batchId}'
    ORDER BY bva.adjustment_date
  `));

  let totalAdjUp = 0;
  let totalAdjDown = 0;
  let totalAdjNet = 0;
  for (const a of adjustments.rows as any[]) {
    const amount = toL(a.amount);
    totalAdjNet += amount;
    if (amount > 0) totalAdjUp += amount;
    else totalAdjDown += Math.abs(amount);
    console.log(`  ${fmtDate(a.adjustment_date)} | ${amount >= 0 ? "+" : ""}${fmtL(amount)} | Type: ${a.adjustment_type}`);
    console.log(`    Before: ${fmtL(toL(a.vol_before))} -> After: ${fmtL(toL(a.vol_after))}`);
    console.log(`    Reason: ${a.reason}`);
    console.log(`    Notes: ${a.notes || "(none)"}`);
    console.log(`    By: ${a.adjusted_by_name || a.adjusted_by_email || "unknown"} | Vessel: ${a.vessel_name || "?"}`);
    console.log(`    Deleted: ${a.deleted_at || "no"} | Adj ID: ${a.id}`);
  }
  console.log(`  TOTAL ADJUSTMENTS: net=${fmtL(totalAdjNet)} (up: +${fmtL(totalAdjUp)}, down: -${fmtL(totalAdjDown)})`);
  console.log(`  Count: ${adjustments.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 5. ALL RACKING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("5. ALL RACKING OPERATIONS");
  console.log("═".repeat(80));

  const rackings = await db.execute(sql.raw(`
    SELECT bro.id,
           CAST(bro.volume_before AS NUMERIC) AS vol_before,
           bro.volume_before_unit,
           CAST(bro.volume_after AS NUMERIC) AS vol_after,
           bro.volume_after_unit,
           CAST(bro.volume_loss AS NUMERIC) AS loss,
           bro.volume_loss_unit,
           bro.racked_at::text, bro.notes, bro.deleted_at,
           sv.name AS source_vessel,
           dv.name AS dest_vessel,
           u.name AS racked_by_name
    FROM batch_racking_operations bro
    LEFT JOIN vessels sv ON sv.id = bro.source_vessel_id
    LEFT JOIN vessels dv ON dv.id = bro.destination_vessel_id
    LEFT JOIN users u ON u.id = bro.racked_by
    WHERE bro.batch_id = '${batchId}'
    ORDER BY bro.racked_at
  `));

  let totalRackLoss = 0;
  for (const r of rackings.rows as any[]) {
    const loss = toL(r.loss);
    // Convert loss to liters if needed
    const lossL = r.volume_loss_unit === "gal" ? loss * LITERS_PER_GAL : loss;
    totalRackLoss += lossL;
    console.log(`  ${fmtDate(r.racked_at)} | Loss: ${loss.toFixed(2)} ${r.volume_loss_unit} (${fmtL(lossL)})`);
    console.log(`    Before: ${toL(r.vol_before).toFixed(2)} ${r.volume_before_unit} -> After: ${toL(r.vol_after).toFixed(2)} ${r.volume_after_unit}`);
    console.log(`    ${r.source_vessel} -> ${r.dest_vessel}`);
    console.log(`    Notes: ${r.notes || "(none)"} | By: ${r.racked_by_name || "?"}`);
    console.log(`    Deleted: ${r.deleted_at || "no"} | Racking ID: ${r.id}`);
  }
  console.log(`  TOTAL RACKING LOSS: ${fmtL(totalRackLoss)}`);
  console.log(`  Count: ${rackings.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 6. ALL FILTER OPERATIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("6. ALL FILTER OPERATIONS");
  console.log("═".repeat(80));

  const filters = await db.execute(sql.raw(`
    SELECT bfo.id,
           CAST(bfo.volume_before AS NUMERIC) AS vol_before,
           CAST(bfo.volume_after AS NUMERIC) AS vol_after,
           CAST(bfo.volume_loss AS NUMERIC) AS loss,
           bfo.filter_type, bfo.filtered_at::text, bfo.notes, bfo.deleted_at,
           v.name AS vessel_name
    FROM batch_filter_operations bfo
    LEFT JOIN vessels v ON v.id = bfo.vessel_id
    WHERE bfo.batch_id = '${batchId}'
    ORDER BY bfo.filtered_at
  `));

  let totalFilterLoss = 0;
  for (const f of filters.rows as any[]) {
    const loss = toL(f.loss);
    totalFilterLoss += loss;
    console.log(`  ${fmtDate(f.filtered_at)} | Loss: ${fmtL(loss)} | Type: ${f.filter_type}`);
    console.log(`    Before: ${fmtL(toL(f.vol_before))} -> After: ${fmtL(toL(f.vol_after))}`);
    console.log(`    Notes: ${f.notes || "(none)"} | Deleted: ${f.deleted_at || "no"}`);
  }
  console.log(`  TOTAL FILTER LOSS: ${fmtL(totalFilterLoss)}`);
  console.log(`  Count: ${filters.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 7. ALL PACKAGING RUNS (bottle_runs + keg_fills)
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("7. ALL PACKAGING RUNS");
  console.log("═".repeat(80));

  const bottles = await db.execute(sql.raw(`
    SELECT br.id,
           CAST(br.volume_taken_liters AS NUMERIC) AS vol_taken_l,
           CAST(COALESCE(br.loss, '0') AS NUMERIC) AS loss,
           br.loss_unit,
           br.units_produced::int, br.package_size_ml::int,
           br.packaged_at::text AS run_date, br.voided_at, br.production_notes AS notes
    FROM bottle_runs br
    WHERE br.batch_id = '${batchId}'
    ORDER BY br.packaged_at
  `));

  let totalBottlingVol = 0;
  let totalBottlingLoss = 0;
  for (const b of bottles.rows as any[]) {
    const vol = toL(b.vol_taken_l);
    const rawLoss = toL(b.loss);
    const lossL = b.loss_unit === "gal" ? rawLoss * LITERS_PER_GAL : rawLoss;
    totalBottlingVol += vol;
    totalBottlingLoss += lossL;
    console.log(`  ${fmtDate(b.run_date)} | Vol taken: ${fmtL(vol)} | Loss: ${fmtL(lossL)} | ${b.units_produced} x ${b.package_size_ml}ml`);
    console.log(`    Notes: ${b.notes || "(none)"} | Voided: ${b.voided_at || "no"} | ID: ${b.id}`);
  }
  console.log(`  TOTAL BOTTLING: vol=${fmtL(totalBottlingVol)}, loss=${fmtL(totalBottlingLoss)}`);

  const kegs = await db.execute(sql.raw(`
    SELECT kf.id,
           CAST(kf.volume_taken AS NUMERIC) AS vol_taken,
           kf.volume_taken_unit,
           CAST(COALESCE(kf.loss, '0') AS NUMERIC) AS loss,
           kf.loss_unit,
           kf.filled_at::text AS fill_date, kf.voided_at, kf.deleted_at, kf.production_notes AS notes
    FROM keg_fills kf
    WHERE kf.batch_id = '${batchId}'
    ORDER BY kf.filled_at
  `));

  let totalKegVol = 0;
  let totalKegLoss = 0;
  for (const k of kegs.rows as any[]) {
    const rawVol = toL(k.vol_taken);
    const volL = k.volume_taken_unit === "gal" ? rawVol * LITERS_PER_GAL : rawVol;
    const rawLoss = toL(k.loss);
    const lossL = k.loss_unit === "gal" ? rawLoss * LITERS_PER_GAL : rawLoss;
    totalKegVol += volL;
    totalKegLoss += lossL;
    console.log(`  ${fmtDate(k.fill_date)} | Vol: ${fmtL(volL)} | Loss: ${fmtL(lossL)}`);
    console.log(`    Notes: ${k.notes || "(none)"} | Voided: ${k.voided_at || "no"} | Deleted: ${k.deleted_at || "no"}`);
  }
  console.log(`  TOTAL KEGGING: vol=${fmtL(totalKegVol)}, loss=${fmtL(totalKegLoss)}`);

  // ═══════════════════════════════════════════════════════════════════
  // 8. ALL MEASUREMENTS WITH VOLUME
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("8. ALL MEASUREMENTS WITH VOLUME READINGS");
  console.log("═".repeat(80));

  const measurements = await db.execute(sql.raw(`
    SELECT bm.id,
           bm.measurement_date::text,
           CAST(bm.volume AS NUMERIC) AS vol,
           bm.volume_unit,
           CAST(bm.volume_liters AS NUMERIC) AS vol_l,
           bm.specific_gravity::text AS sg,
           bm.ph::text,
           bm.is_estimated, bm.estimate_source,
           bm.notes, bm.deleted_at
    FROM batch_measurements bm
    WHERE bm.batch_id = '${batchId}'
    ORDER BY bm.measurement_date
  `));

  for (const m of measurements.rows as any[]) {
    const vol = toL(m.vol_l) || toL(m.vol);
    const volStr = vol > 0 ? fmtL(vol) : "(no volume)";
    console.log(`  ${fmtDate(m.measurement_date)} | Vol: ${volStr} | SG: ${m.sg || "-"} | pH: ${m.ph || "-"}`);
    console.log(`    Estimated: ${m.is_estimated} | Source: ${m.estimate_source || "-"} | Notes: ${m.notes || "-"}`);
    console.log(`    Deleted: ${m.deleted_at || "no"}`);
  }
  console.log(`  Count: ${measurements.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 9. DISTILLATION RECORDS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("9. DISTILLATION RECORDS");
  console.log("═".repeat(80));

  const distill = await db.execute(sql.raw(`
    SELECT id, CAST(source_volume_liters AS NUMERIC) AS vol, status,
           sent_at::text AS sent_date, received_at::text AS received_date, deleted_at
    FROM distillation_records
    WHERE source_batch_id = '${batchId}'
    ORDER BY sent_at
  `));

  let totalDistill = 0;
  for (const d of distill.rows as any[]) {
    const vol = toL(d.vol);
    totalDistill += vol;
    console.log(`  Sent: ${fmtDate(d.sent_date)} | Vol: ${fmtL(vol)} | Status: ${d.status} | Deleted: ${d.deleted_at || "no"}`);
  }
  console.log(`  TOTAL DISTILLATION: ${fmtL(totalDistill)}`);
  console.log(`  Count: ${distill.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 10. VOLUME AUDIT TRAIL (batch_volume_audit)
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("10. VOLUME AUDIT TRAIL (batch_volume_audit)");
  console.log("═".repeat(80));

  const auditTrail = await db.execute(sql.raw(`
    SELECT id, field_name, old_value, new_value,
           changed_at::text, change_source
    FROM batch_volume_audit
    WHERE batch_id = '${batchId}'
    ORDER BY changed_at
  `));

  for (const a of auditTrail.rows as any[]) {
    console.log(`  ${fmtDate(a.changed_at)} | ${a.field_name}: ${a.old_value} -> ${a.new_value} | Source: ${a.change_source}`);
  }
  console.log(`  Count: ${auditTrail.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 11. CHILD BATCHES (parent_batch_id = this batch)
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("11. CHILD BATCHES (parent_batch_id = this batch)");
  console.log("═".repeat(80));

  const children = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.batch_number,
           CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
           CAST(b.current_volume_liters AS NUMERIC) AS cur_l,
           b.status, b.is_racking_derivative, b.reconciliation_status,
           b.start_date::text, b.deleted_at,
           v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.parent_batch_id = '${batchId}'
    ORDER BY b.start_date
  `));

  let totalChildInit = 0;
  for (const c of children.rows as any[]) {
    const init = toL(c.init_l);
    totalChildInit += init;
    console.log(`  "${c.name}" (${c.batch_number}) in ${c.vessel_name}`);
    console.log(`    Init: ${fmtL(init)} | Cur: ${fmtL(toL(c.cur_l))} | Status: ${c.status}`);
    console.log(`    Racking deriv: ${c.is_racking_derivative} | Recon: ${c.reconciliation_status}`);
    console.log(`    Start: ${fmtDate(c.start_date)} | Deleted: ${c.deleted_at || "no"} | ID: ${c.id}`);
  }
  console.log(`  TOTAL CHILD INITIAL VOLUMES: ${fmtL(totalChildInit)}`);
  console.log(`  Count: ${children.rows.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // 12. DEEP DIVE: For each destination batch, check for racking/adjustments
  //     that might duplicate the transfer volume
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("12. DESTINATION BATCH DEEP DIVE — Racking & Adjustments on child batches");
  console.log("═".repeat(80));

  const allDestIds = [...new Set([...destBatchIds, ...(children.rows as any[]).map((c: any) => c.id)])];

  for (const destId of allDestIds) {
    const destBatch = await db.execute(sql.raw(`
      SELECT b.name, b.batch_number, CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
             CAST(b.current_volume_liters AS NUMERIC) AS cur_l,
             b.is_racking_derivative, b.reconciliation_status, b.deleted_at,
             v.name AS vessel_name
      FROM batches b LEFT JOIN vessels v ON v.id = b.vessel_id
      WHERE b.id = '${destId}'
    `));
    const db2 = (destBatch.rows[0] as any) || {};

    console.log(`\n  --- "${db2.name}" (${db2.batch_number}) in ${db2.vessel_name} ---`);
    console.log(`  Init: ${fmtL(toL(db2.init_l))} | Cur: ${fmtL(toL(db2.cur_l))} | Racking: ${db2.is_racking_derivative} | Recon: ${db2.reconciliation_status} | Del: ${db2.deleted_at || "no"}`);

    // Transfers IN to this dest
    const destXferIn = await db.execute(sql.raw(`
      SELECT CAST(volume_transferred AS NUMERIC) AS vol,
             CAST(COALESCE(loss, '0') AS NUMERIC) AS loss,
             transferred_at::text, source_batch_id, deleted_at
      FROM batch_transfers
      WHERE destination_batch_id = '${destId}'
      ORDER BY transferred_at
    `));
    let destXferInTotal = 0;
    for (const x of destXferIn.rows as any[]) {
      const vol = toL(x.vol);
      destXferInTotal += vol;
      const fromParent = x.source_batch_id === batchId ? " (FROM PARENT)" : "";
      console.log(`    XferIn: ${fmtL(vol)} at ${fmtDate(x.transferred_at)}${fromParent} | Del: ${x.deleted_at || "no"}`);
    }

    // Racking on this dest
    const destRack = await db.execute(sql.raw(`
      SELECT CAST(volume_loss AS NUMERIC) AS loss, volume_loss_unit,
             racked_at::text, notes, deleted_at
      FROM batch_racking_operations
      WHERE batch_id = '${destId}'
      ORDER BY racked_at
    `));
    let destRackLoss = 0;
    for (const r of destRack.rows as any[]) {
      const loss = toL(r.loss);
      const lossL = r.volume_loss_unit === "gal" ? loss * LITERS_PER_GAL : loss;
      destRackLoss += lossL;
      console.log(`    Racking loss: ${fmtL(lossL)} at ${fmtDate(r.racked_at)} | Notes: ${r.notes || "-"} | Del: ${r.deleted_at || "no"}`);
    }

    // Adjustments on this dest
    const destAdj = await db.execute(sql.raw(`
      SELECT CAST(adjustment_amount AS NUMERIC) AS amount,
             adjustment_type, adjustment_date::text, reason, notes, deleted_at
      FROM batch_volume_adjustments
      WHERE batch_id = '${destId}'
      ORDER BY adjustment_date
    `));
    let destAdjNet = 0;
    for (const a of destAdj.rows as any[]) {
      const amount = toL(a.amount);
      destAdjNet += amount;
      console.log(`    Adjustment: ${amount >= 0 ? "+" : ""}${fmtL(amount)} (${a.adjustment_type}) at ${fmtDate(a.adjustment_date)}`);
      console.log(`      Reason: ${a.reason} | Notes: ${a.notes || "-"} | Del: ${a.deleted_at || "no"}`);
    }

    console.log(`    SUMMARY: XferIn=${fmtL(destXferInTotal)}, RackLoss=${fmtL(destRackLoss)}, AdjNet=${fmtL(destAdjNet)}`);

    // Check for children without corresponding transfers (phantom)
    const hasTransferFromParent = (destXferIn.rows as any[]).some(
      (x: any) => x.source_batch_id === batchId && !x.deleted_at
    );
    if (!hasTransferFromParent && toL(db2.init_l) > 0) {
      console.log(`    *** PHANTOM: Has init volume ${fmtL(toL(db2.init_l))} but NO transfer from parent batch ***`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 13. CROSS-CHECK: Racking + Adjustment double-counting
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("13. DOUBLE-COUNTING CHECK: Racking vs Adjustments at same time");
  console.log("═".repeat(80));

  // Check on the parent batch
  const rackDates = (rackings.rows as any[]).map((r: any) => ({
    date: r.racked_at,
    loss: toL(r.loss),
    unit: r.volume_loss_unit,
    id: r.id,
  }));
  const adjRecords = (adjustments.rows as any[]).map((a: any) => ({
    date: a.adjustment_date,
    amount: toL(a.amount),
    type: a.adjustment_type,
    reason: a.reason,
    id: a.id,
  }));

  let doubleCountTotal = 0;
  console.log(`\n  ON PARENT BATCH (${batch.name}):`);
  for (const rack of rackDates) {
    for (const adj of adjRecords) {
      // Check if adjustment is within 24 hours of racking and is a sediment/loss type
      const rackTime = new Date(rack.date).getTime();
      const adjTime = new Date(adj.date).getTime();
      const hoursDiff = Math.abs(rackTime - adjTime) / (1000 * 60 * 60);
      if (hoursDiff < 24 && (adj.type === "sediment" || adj.type === "correction_down" || adj.amount < 0)) {
        const rackLossL = rack.unit === "gal" ? rack.loss * LITERS_PER_GAL : rack.loss;
        console.log(`  POSSIBLE DOUBLE-COUNT:`);
        console.log(`    Racking: ${fmtL(rackLossL)} at ${fmtDate(rack.date)} (ID: ${rack.id})`);
        console.log(`    Adjustment: ${fmtL(adj.amount)} (${adj.type}: ${adj.reason}) at ${fmtDate(adj.date)} (ID: ${adj.id})`);
        console.log(`    Time diff: ${hoursDiff.toFixed(1)} hours`);
        doubleCountTotal += Math.min(rackLossL, Math.abs(adj.amount));
      }
    }
  }

  // Check on each child batch too
  for (const destId of allDestIds) {
    const destBatch = await db.execute(sql.raw(`
      SELECT name FROM batches WHERE id = '${destId}'
    `));
    const destName = (destBatch.rows[0] as any)?.name || destId;

    const childRack = await db.execute(sql.raw(`
      SELECT CAST(volume_loss AS NUMERIC) AS loss, volume_loss_unit,
             racked_at::text, id
      FROM batch_racking_operations
      WHERE batch_id = '${destId}' AND deleted_at IS NULL
      ORDER BY racked_at
    `));
    const childAdj = await db.execute(sql.raw(`
      SELECT CAST(adjustment_amount AS NUMERIC) AS amount, adjustment_type,
             adjustment_date::text, reason, id
      FROM batch_volume_adjustments
      WHERE batch_id = '${destId}' AND deleted_at IS NULL
      ORDER BY adjustment_date
    `));

    for (const rack of childRack.rows as any[]) {
      for (const adj of childAdj.rows as any[]) {
        const rackTime = new Date(rack.racked_at).getTime();
        const adjTime = new Date(adj.adjustment_date).getTime();
        const hoursDiff = Math.abs(rackTime - adjTime) / (1000 * 60 * 60);
        if (hoursDiff < 24 && (adj.adjustment_type === "sediment" || adj.adjustment_type === "correction_down" || toL(adj.amount) < 0)) {
          const rackLoss = toL(rack.loss);
          const rackLossL = rack.volume_loss_unit === "gal" ? rackLoss * LITERS_PER_GAL : rackLoss;
          const adjAmt = toL(adj.amount);
          console.log(`\n  ON CHILD "${destName}":`);
          console.log(`    Racking: ${fmtL(rackLossL)} at ${fmtDate(rack.racked_at)} (ID: ${rack.id})`);
          console.log(`    Adjustment: ${fmtL(adjAmt)} (${adj.adjustment_type}: ${adj.reason}) at ${fmtDate(adj.adjustment_date)} (ID: ${adj.id})`);
          console.log(`    Time diff: ${hoursDiff.toFixed(1)} hours`);
          doubleCountTotal += Math.min(rackLossL, Math.abs(adjAmt));
        }
      }
    }
  }

  if (doubleCountTotal === 0) {
    console.log("  No racking+adjustment double-counts detected within 24h windows.");
  } else {
    console.log(`\n  TOTAL ESTIMATED DOUBLE-COUNTED: ${fmtL(doubleCountTotal)}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 14. CHECK FOR DUPLICATE TRANSFERS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("14. DUPLICATE TRANSFER CHECK");
  console.log("═".repeat(80));

  const dupeCheck = await db.execute(sql.raw(`
    SELECT destination_batch_id, transferred_at::text,
           CAST(volume_transferred AS NUMERIC) AS vol,
           COUNT(*) AS cnt,
           array_agg(id) AS transfer_ids,
           array_agg(deleted_at::text) AS deleted_ats
    FROM batch_transfers
    WHERE source_batch_id = '${batchId}'
    GROUP BY destination_batch_id, transferred_at, volume_transferred
    HAVING COUNT(*) > 1
  `));

  if ((dupeCheck.rows as any[]).length === 0) {
    console.log("  No duplicate transfers found (same dest + time + volume).");
  } else {
    for (const d of dupeCheck.rows as any[]) {
      console.log(`  DUPLICATE: ${d.cnt}x ${fmtL(toL(d.vol))} to ${d.destination_batch_id} at ${d.transferred_at}`);
      console.log(`    IDs: ${d.transfer_ids}`);
      console.log(`    Deleted: ${d.deleted_ats}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 15. BARREL TOP-OFF CHECK (BARREL-225-4)
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("15. BARREL TOP-OFF CHECK (looking for BARREL-225 transfers)");
  console.log("═".repeat(80));

  const barrelXfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.destination_batch_id,
           CAST(bt.volume_transferred AS NUMERIC) AS vol,
           bt.transferred_at::text, bt.notes, bt.deleted_at,
           dv.name AS dest_vessel,
           db2.name AS dest_name
    FROM batch_transfers bt
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
    WHERE bt.source_batch_id = '${batchId}'
      AND (dv.name ILIKE '%barrel%' OR dv.name ILIKE '%225%')
    ORDER BY bt.transferred_at
  `));

  if ((barrelXfers.rows as any[]).length === 0) {
    // Also check by looking at small transfers (< 225L) that could be top-offs
    console.log("  No transfers to vessels matching 'barrel' or '225' found.");
    console.log("  Checking for any small transfers that could be barrel top-offs...");
    const smallXfers = await db.execute(sql.raw(`
      SELECT bt.id, bt.destination_batch_id,
             CAST(bt.volume_transferred AS NUMERIC) AS vol,
             bt.transferred_at::text, bt.notes, bt.deleted_at,
             dv.name AS dest_vessel,
             db2.name AS dest_name
      FROM batch_transfers bt
      LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
      LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
      WHERE bt.source_batch_id = '${batchId}'
        AND CAST(bt.volume_transferred AS NUMERIC) < 250
      ORDER BY bt.transferred_at
    `));
    for (const x of smallXfers.rows as any[]) {
      console.log(`  Small transfer: ${fmtL(toL(x.vol))} -> "${x.dest_name}" in ${x.dest_vessel} at ${fmtDate(x.transferred_at)}`);
      console.log(`    Notes: ${x.notes || "(none)"} | Del: ${x.deleted_at || "no"}`);
    }
  } else {
    for (const x of barrelXfers.rows as any[]) {
      console.log(`  Barrel transfer: ${fmtL(toL(x.vol))} -> "${x.dest_name}" in ${x.dest_vessel} at ${fmtDate(x.transferred_at)}`);
      console.log(`    Notes: ${x.notes || "(none)"} | Del: ${x.deleted_at || "no"}`);
    }
  }

  // Also check merges to barrels
  const barrelMerges = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id,
           CAST(bmh.volume_added AS NUMERIC) AS vol,
           bmh.merged_at::text, bmh.notes, bmh.deleted_at,
           tb.name AS target_name,
           v.name AS vessel_name
    FROM batch_merge_history bmh
    LEFT JOIN batches tb ON tb.id = bmh.target_batch_id
    LEFT JOIN vessels v ON v.id = tb.vessel_id
    WHERE bmh.source_batch_id = '${batchId}'
      AND (v.name ILIKE '%barrel%' OR v.name ILIKE '%225%')
  `));
  if ((barrelMerges.rows as any[]).length > 0) {
    console.log(`\n  Barrel merges OUT:`);
    for (const m of barrelMerges.rows as any[]) {
      console.log(`  ${fmtL(toL(m.vol))} -> "${m.target_name}" in ${m.vessel_name} at ${fmtDate(m.merged_at)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 16. CHECK DRUM-120-3 specifically
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("16. DRUM-120-3 INVESTIGATION");
  console.log("═".repeat(80));

  const drumVessel = await db.execute(sql.raw(`
    SELECT id, name, CAST(capacity_liters AS NUMERIC) AS cap_l
    FROM vessels WHERE name ILIKE '%drum%120%' OR name ILIKE '%DRUM-120-3%'
  `));

  if ((drumVessel.rows as any[]).length > 0) {
    for (const v of drumVessel.rows as any[]) {
      console.log(`  Vessel: ${v.name} (cap: ${fmtL(toL(v.cap_l))}) ID: ${v.id}`);

      // What batches are/were in this vessel?
      const drumBatches = await db.execute(sql.raw(`
        SELECT b.id, b.name, b.batch_number,
               CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
               CAST(b.current_volume_liters AS NUMERIC) AS cur_l,
               b.status, b.parent_batch_id, b.is_racking_derivative,
               b.reconciliation_status, b.start_date::text, b.deleted_at
        FROM batches b WHERE b.vessel_id = '${v.id}'
        ORDER BY b.start_date
      `));
      for (const b of drumBatches.rows as any[]) {
        const isChild = b.parent_batch_id === batchId;
        console.log(`    Batch: "${b.name}" (${b.batch_number}) | Init: ${fmtL(toL(b.init_l))} | Cur: ${fmtL(toL(b.cur_l))}`);
        console.log(`      Status: ${b.status} | Parent: ${b.parent_batch_id || "(none)"}${isChild ? " ← CHILD OF TARGET" : ""}`);
        console.log(`      Racking: ${b.is_racking_derivative} | Recon: ${b.reconciliation_status} | Del: ${b.deleted_at || "no"}`);

        // Check transfers into this batch
        const drumXfer = await db.execute(sql.raw(`
          SELECT CAST(volume_transferred AS NUMERIC) AS vol,
                 source_batch_id, transferred_at::text, deleted_at
          FROM batch_transfers WHERE destination_batch_id = '${b.id}'
        `));
        for (const x of drumXfer.rows as any[]) {
          const fromParent = x.source_batch_id === batchId ? " (FROM TARGET BATCH)" : "";
          console.log(`      Transfer IN: ${fmtL(toL(x.vol))} from ${x.source_batch_id}${fromParent} at ${fmtDate(x.transferred_at)} | Del: ${x.deleted_at || "no"}`);
        }
        if ((drumXfer.rows as any[]).length === 0) {
          console.log(`      ** NO transfers IN — phantom batch? **`);
        }
      }
    }
  } else {
    console.log("  No vessel matching DRUM-120-3 found.");
    // Search broadly
    const drumSearch = await db.execute(sql.raw(`
      SELECT id, name FROM vessels WHERE name ILIKE '%drum%' ORDER BY name
    `));
    console.log(`  Drums found: ${(drumSearch.rows as any[]).map((v: any) => v.name).join(", ") || "(none)"}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FINAL LEDGER
  // ═══════════════════════════════════════════════════════════════════
  const initialVol = toL(batch.init_l);
  const currentVol = toL(batch.cur_l);

  // Only count non-deleted items
  const activeXfersIn = (xfersIn.rows as any[]).filter((x: any) => !x.deleted_at);
  const activeXfersOut = (xfersOut.rows as any[]).filter((x: any) => !x.deleted_at);
  const activeMergesIn = (mergesIn.rows as any[]).filter((m: any) => !m.deleted_at);
  const activeMergesOut = (mergesOut.rows as any[]).filter((m: any) => !m.deleted_at);
  const activeAdj = (adjustments.rows as any[]).filter((a: any) => !a.deleted_at);
  const activeRack = (rackings.rows as any[]).filter((r: any) => !r.deleted_at);
  const activeFilter = (filters.rows as any[]).filter((f: any) => !f.deleted_at);
  const activeBottle = (bottles.rows as any[]).filter((b: any) => !b.voided_at);
  const activeKeg = (kegs.rows as any[]).filter((k: any) => !k.voided_at && !k.deleted_at);

  const sumXferIn = activeXfersIn.reduce((s: number, x: any) => s + toL(x.vol), 0);
  const sumXferInLoss = activeXfersIn.reduce((s: number, x: any) => s + toL(x.loss), 0);
  const sumXferOut = activeXfersOut.reduce((s: number, x: any) => s + toL(x.vol), 0);
  const sumXferOutLoss = activeXfersOut.reduce((s: number, x: any) => s + toL(x.loss), 0);
  const sumMergeIn = activeMergesIn.reduce((s: number, m: any) => s + toL(m.vol_added), 0);
  const sumMergeOut = activeMergesOut.reduce((s: number, m: any) => s + toL(m.vol_added), 0);
  const sumAdjNet = activeAdj.reduce((s: number, a: any) => s + toL(a.amount), 0);
  const sumRackLoss = activeRack.reduce((s: number, r: any) => {
    const loss = toL(r.loss);
    return s + (r.volume_loss_unit === "gal" ? loss * LITERS_PER_GAL : loss);
  }, 0);
  const sumFilterLoss = activeFilter.reduce((s: number, f: any) => s + toL(f.loss), 0);
  const sumBottleVol = activeBottle.reduce((s: number, b: any) => s + toL(b.vol_taken_l), 0);
  const sumBottleLoss = activeBottle.reduce((s: number, b: any) => {
    const loss = toL(b.loss);
    return s + (b.loss_unit === "gal" ? loss * LITERS_PER_GAL : loss);
  }, 0);
  const sumKegVol = activeKeg.reduce((s: number, k: any) => {
    const vol = toL(k.vol_taken);
    return s + (k.volume_taken_unit === "gal" ? vol * LITERS_PER_GAL : vol);
  }, 0);
  const sumKegLoss = activeKeg.reduce((s: number, k: any) => {
    const loss = toL(k.loss);
    return s + (k.loss_unit === "gal" ? loss * LITERS_PER_GAL : loss);
  }, 0);

  const totalInflows = initialVol + sumXferIn + sumMergeIn;
  const totalOutflows = sumXferOut + sumXferOutLoss + sumMergeOut + sumRackLoss + sumFilterLoss + sumBottleVol + sumBottleLoss + sumKegVol + sumKegLoss + totalDistill;
  const expectedRemaining = totalInflows + sumAdjNet - totalOutflows;
  const discrepancy = currentVol - expectedRemaining;

  console.log(`\n${"═".repeat(80)}`);
  console.log("COMPLETE LEDGER");
  console.log("═".repeat(80));

  console.log(`\nINFLOWS:`);
  console.log(`  Initial volume:           ${fmtL(initialVol)}`);
  if (activeXfersIn.length > 0) {
    for (const x of activeXfersIn) {
      const xAny = x as any;
      console.log(`  Transfer in (${fmtDate(xAny.transferred_at).substring(0, 10)}): +${fmtL(toL(xAny.vol))} from "${xAny.source_name}"`);
    }
  }
  console.log(`  Transfers in total:       +${fmtL(sumXferIn)}`);
  if (activeMergesIn.length > 0) {
    for (const m of activeMergesIn) {
      const mAny = m as any;
      console.log(`  Merge in (${fmtDate(mAny.merged_at).substring(0, 10)}):    +${fmtL(toL(mAny.vol_added))} from "${mAny.source_name || mAny.source_type}"`);
    }
  }
  console.log(`  Merges in total:          +${fmtL(sumMergeIn)}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  TOTAL INFLOWS:            ${fmtL(totalInflows)}`);

  console.log(`\nOUTFLOWS:`);
  if (activeXfersOut.length > 0) {
    for (const x of activeXfersOut) {
      const xAny = x as any;
      console.log(`  Transfer out (${fmtDate(xAny.transferred_at).substring(0, 10)}): -${fmtL(toL(xAny.vol))} to "${xAny.dest_name}" [loss: ${fmtL(toL(xAny.loss))}]`);
    }
  }
  console.log(`  Transfers out total:      -${fmtL(sumXferOut)} (loss: ${fmtL(sumXferOutLoss)})`);
  console.log(`  Merges out total:         -${fmtL(sumMergeOut)}`);
  console.log(`  Racking loss total:       -${fmtL(sumRackLoss)}`);
  console.log(`  Filter loss total:        -${fmtL(sumFilterLoss)}`);
  console.log(`  Bottling total:           -${fmtL(sumBottleVol)} (loss: ${fmtL(sumBottleLoss)})`);
  console.log(`  Kegging total:            -${fmtL(sumKegVol)} (loss: ${fmtL(sumKegLoss)})`);
  console.log(`  Distillation total:       -${fmtL(totalDistill)}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  TOTAL OUTFLOWS:           ${fmtL(totalOutflows)}`);

  console.log(`\nADJUSTMENTS:`);
  if (activeAdj.length > 0) {
    for (const a of activeAdj) {
      const aAny = a as any;
      const amt = toL(aAny.amount);
      console.log(`  ${fmtDate(aAny.adjustment_date).substring(0, 10)}: ${amt >= 0 ? "+" : ""}${fmtL(amt)} (${aAny.adjustment_type}: ${aAny.reason})`);
    }
  }
  console.log(`  Net adjustments:          ${sumAdjNet >= 0 ? "+" : ""}${fmtL(sumAdjNet)}`);

  console.log(`\n${"═".repeat(80)}`);
  console.log(`BALANCE:`);
  console.log(`  Expected remaining:       ${fmtL(expectedRemaining)} (inflows + adj - outflows)`);
  console.log(`  Actual remaining:         ${fmtL(currentVol)}`);
  console.log(`  DISCREPANCY:              ${discrepancy >= 0 ? "+" : ""}${fmtL(discrepancy)}`);
  console.log(`  (Positive = more liquid than expected, Negative = less than expected)`);
  console.log("═".repeat(80));

  // ═══════════════════════════════════════════════════════════════════
  // HYPOTHESIS TESTING
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(80)}`);
  console.log("HYPOTHESIS TEST: 120L phantom batch (DRUM-120-3) + ~70L double-counted racking");
  console.log("═".repeat(80));

  // Sum up phantom children (have init vol, parent = this batch, no transfer from parent)
  let phantomTotal = 0;
  const phantomChildren: string[] = [];
  for (const c of children.rows as any[]) {
    if (c.deleted_at) continue;
    // Check if there's a transfer from parent to this child
    const xferFromParent = await db.execute(sql.raw(`
      SELECT COUNT(*) AS cnt FROM batch_transfers
      WHERE source_batch_id = '${batchId}'
        AND destination_batch_id = '${c.id}'
        AND deleted_at IS NULL
    `));
    const hasXfer = parseInt((xferFromParent.rows[0] as any).cnt) > 0;
    if (!hasXfer && toL(c.init_l) > 0) {
      phantomTotal += toL(c.init_l);
      phantomChildren.push(`"${c.name}" init=${fmtL(toL(c.init_l))}`);
    }
  }

  console.log(`\n  Phantom children (init > 0, no transfer from parent):`);
  if (phantomChildren.length > 0) {
    for (const p of phantomChildren) console.log(`    ${p}`);
    console.log(`  Total phantom volume: ${fmtL(phantomTotal)}`);
  } else {
    console.log(`    (none found)`);
  }

  console.log(`\n  Double-counted racking losses: ${fmtL(doubleCountTotal)}`);
  console.log(`  Phantom volume + double-counts: ${fmtL(phantomTotal + doubleCountTotal)}`);
  console.log(`  Actual discrepancy:             ${discrepancy >= 0 ? "+" : ""}${fmtL(discrepancy)}`);
  const remaining = Math.abs(discrepancy) - (phantomTotal + doubleCountTotal);
  console.log(`  Remaining unexplained:          ${fmtL(remaining)}`);

  if (Math.abs(phantomTotal + doubleCountTotal - Math.abs(discrepancy)) < 5) {
    console.log(`\n  ✓ HYPOTHESIS CONFIRMED: Phantom batches + double-counted racking ≈ discrepancy`);
  } else {
    console.log(`\n  ✗ HYPOTHESIS PARTIALLY EXPLAINS: ${fmtL(phantomTotal + doubleCountTotal)} of ${fmtL(Math.abs(discrepancy))} discrepancy`);
    console.log(`    ${fmtL(remaining)} remains unexplained.`);
  }

  console.log(`\n${"═".repeat(80)}`);
  console.log("AUDIT COMPLETE");
  console.log("═".repeat(80));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
