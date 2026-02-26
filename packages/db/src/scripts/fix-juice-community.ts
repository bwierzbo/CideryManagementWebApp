import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Find the Juice for Community batch
  const batch = await db.execute(sql.raw(`
    SELECT id, name, custom_name, product_type,
      round(initial_volume_liters::numeric, 2) as initial_l,
      round(current_volume_liters::numeric, 2) as current_l,
      vessel_id,
      start_date::date
    FROM batches
    WHERE (name ILIKE '%juice%community%' OR custom_name ILIKE '%juice%community%')
      AND deleted_at IS NULL
  `));

  if (batch.rows.length !== 1) {
    console.error("Expected exactly 1 Juice for Community batch, found:", batch.rows.length);
    for (const r of batch.rows) console.log(`  ${r.name} | ${r.custom_name} | ${r.product_type}`);
    process.exit(1);
  }

  const b = batch.rows[0];
  const batchId = b.id as string;
  const initialL = Number(b.initial_l);
  const currentL = Number(b.current_l);
  console.log(`Juice for Community: ${b.name} | ${b.custom_name}`);
  console.log(`  Initial: ${initialL}L | Current: ${currentL}L | Product: ${b.product_type}`);
  console.log(`  Start date: ${b.start_date} | Vessel: ${b.vessel_id}`);

  // Check existing adjustments
  const existingAdj = await db.execute(sql.raw(`
    SELECT id, adjustment_amount, reason, adjustment_type
    FROM batch_volume_adjustments
    WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `));
  if (existingAdj.rows.length > 0) {
    console.log("\n  Existing adjustments:");
    for (const a of existingAdj.rows) {
      console.log(`    ${a.adjustment_amount}L | ${a.adjustment_type} | ${a.reason}`);
    }
  }

  // Check existing operations to see what's already recorded
  const ops = await db.execute(sql.raw(`
    SELECT 'transfer_out' as op, COALESCE(SUM(volume_transferred::numeric), 0) as total
    FROM batch_transfers WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
    UNION ALL
    SELECT 'merge_out', COALESCE(SUM(volume_added::numeric), 0)
    FROM batch_merge_history WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
    UNION ALL
    SELECT 'adjustment', COALESCE(SUM(adjustment_amount::numeric), 0)
    FROM batch_volume_adjustments WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `));
  let totalRecordedOut = 0;
  for (const o of ops.rows) {
    const v = Number(o.total);
    if (v !== 0) console.log(`  ${o.op}: ${v.toFixed(2)}L`);
    if (o.op !== 'adjustment') totalRecordedOut += Math.abs(v);
  }

  // The gap = initial - recorded_outflows - current
  // For a batch that went from 520L to 0L with no recorded operations,
  // the unrecorded volume is the full initial amount minus any existing outflows
  const unrecorded = initialL - totalRecordedOut - currentL;
  console.log(`\n  Unrecorded volume: ${unrecorded.toFixed(2)}L (${(unrecorded / 3.78541).toFixed(1)} gal)`);

  if (Math.abs(unrecorded) < 0.1) {
    console.log("  Gap is already < 0.1L — no fix needed.");
    process.exit(0);
  }

  // Get a user ID for adjusted_by
  const userRow = await db.execute(sql.raw(`SELECT id FROM users LIMIT 1`));
  const userId = userRow.rows[0].id;

  // Create the volume adjustment to account for the donated juice
  const adjAmount = -unrecorded; // Negative = volume decrease
  await db.execute(sql.raw(`
    INSERT INTO batch_volume_adjustments (
      batch_id, vessel_id,
      adjustment_date, adjustment_type,
      volume_before, volume_after, adjustment_amount,
      reason, notes, adjusted_by
    ) VALUES (
      '${batchId}', ${b.vessel_id ? `'${b.vessel_id}'` : 'NULL'},
      '${b.start_date}', 'other',
      '${initialL}', '${currentL}', '${adjAmount}',
      'Juice donated to community — full batch given away, not fermented',
      'Unfermented apple juice given to community members. Volume was physically removed but not recorded as an operation. This adjustment reconciles the batch balance. 520L (137.4 gal) total.',
      '${userId}'
    )
  `));
  console.log(`  Created adjustment: ${adjAmount.toFixed(2)}L (${(adjAmount / 3.78541).toFixed(1)} gal)`);

  // Verify the gap is now zero
  const verify = await db.execute(sql.raw(`
    SELECT
      round(b.initial_volume_liters::numeric, 2) as init,
      round(b.current_volume_liters::numeric, 2) as cur,
      round(b.initial_volume_liters::numeric
        + COALESCE((SELECT SUM(adjustment_amount::numeric) FROM batch_volume_adjustments WHERE batch_id = b.id AND deleted_at IS NULL), 0)
        + COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE destination_batch_id = b.id AND deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE source_batch_id = b.id AND deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(volume_added::numeric) FROM batch_merge_history WHERE source_batch_id = b.id AND deleted_at IS NULL), 0)
      , 2) as reconstructed
    FROM batches b WHERE b.id = '${batchId}'
  `));
  const v = verify.rows[0];
  const gap = Number(v.reconstructed) - Number(v.cur);
  console.log(`\n  Verify: init=${v.init}L, reconstructed=${v.reconstructed}L, stored=${v.cur}L, gap=${gap.toFixed(2)}L`);

  if (Math.abs(gap) < 0.1) {
    console.log("  Gap closed successfully.");
  } else {
    console.log(`  WARNING: Gap still ${gap.toFixed(2)}L — may need further investigation.`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
