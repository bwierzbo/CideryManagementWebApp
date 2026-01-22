import { db } from "./client";
import { sql } from "drizzle-orm";

async function main() {
  // Find 'Community Blend #1' batch (was in TANK-1000-1)
  const batch = await db.execute(sql`
    SELECT id, custom_name, initial_volume, current_volume, status
    FROM batches
    WHERE custom_name = 'Community Blend #1'
    LIMIT 1
  `);

  if (batch.rows.length === 0) {
    console.log('Batch not found');
    process.exit(0);
  }

  const batchId = batch.rows[0].id;
  console.log('=== BATCH: Community Blend #1 (TANK-1000-1) ===');
  console.log('Initial Volume:', batch.rows[0].initial_volume, 'L');
  console.log('Current Volume:', batch.rows[0].current_volume, 'L');
  console.log('Status:', batch.rows[0].status);

  // Check batch_transfers (volume transferred to other batches)
  console.log('\n--- Transfers Out (batch_transfers) ---');
  const transfers = await db.execute(sql`
    SELECT
      bt.volume_transferred,
      bt.transferred_at,
      dest.custom_name as dest_batch,
      dest.status as dest_status
    FROM batch_transfers bt
    JOIN batches dest ON dest.id = bt.destination_batch_id
    WHERE bt.source_batch_id = ${batchId}
    ORDER BY bt.transferred_at
  `);

  if (transfers.rows.length > 0) {
    for (const row of transfers.rows) {
      console.log('  ->', row.dest_batch, ':', row.volume_transferred, 'L on', row.transferred_at, '(' + row.dest_status + ')');
    }
  } else {
    console.log('  (none found)');
  }

  // Check batch_merge_history (merged into other batches)
  console.log('\n--- Merges Out (batch_merge_history) ---');
  const merges = await db.execute(sql`
    SELECT
      bmh.volume_added,
      bmh.merged_at,
      dest.custom_name as dest_batch,
      dest.status as dest_status
    FROM batch_merge_history bmh
    JOIN batches dest ON dest.id = bmh.target_batch_id
    WHERE bmh.source_batch_id = ${batchId}
    ORDER BY bmh.merged_at
  `);

  if (merges.rows.length > 0) {
    for (const row of merges.rows) {
      console.log('  ->', row.dest_batch, ':', row.volume_added, 'L on', row.merged_at, '(' + row.dest_status + ')');
    }
  } else {
    console.log('  (none found)');
  }

  // Check packaging runs
  console.log('\n--- Packaging Runs ---');
  const packaging = await db.execute(sql`
    SELECT
      br.id,
      br.packaged_at,
      br.volume_taken_liters,
      br.loss
    FROM bottle_runs br
    WHERE br.batch_id = ${batchId}
  `);

  if (packaging.rows.length > 0) {
    for (const row of packaging.rows) {
      console.log('  Packaged:', row.volume_taken_liters, 'L on', row.packaged_at, '(loss:', row.loss, 'L)');
    }
  } else {
    console.log('  (none found)');
  }

  // Check keg fills
  console.log('\n--- Keg Fills ---');
  const kegs = await db.execute(sql`
    SELECT
      kf.filled_at,
      kf.volume_taken,
      k.keg_number
    FROM keg_fills kf
    JOIN kegs k ON k.id = kf.keg_id
    WHERE kf.batch_id = ${batchId}
      AND kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
    ORDER BY kf.filled_at
  `);

  if (kegs.rows.length > 0) {
    for (const row of kegs.rows) {
      console.log('  Filled keg', row.keg_number, ':', row.volume_taken, 'L on', row.filled_at);
    }
  } else {
    console.log('  (none found)');
  }

  // Check racking operations (movement & losses)
  console.log('\n--- Racking Operations ---');
  const rackings = await db.execute(sql`
    SELECT
      bro.racked_at,
      bro.volume_before,
      bro.volume_after,
      bro.volume_loss,
      sv.name as from_vessel,
      dv.name as to_vessel
    FROM batch_racking_operations bro
    JOIN vessels sv ON sv.id = bro.source_vessel_id
    JOIN vessels dv ON dv.id = bro.destination_vessel_id
    WHERE bro.batch_id = ${batchId}
      AND bro.notes NOT LIKE '%Historical Record%'
    ORDER BY bro.racked_at
  `);

  if (rackings.rows.length > 0) {
    for (const row of rackings.rows) {
      console.log('  ', row.racked_at, ':', row.from_vessel, '->', row.to_vessel, '| Loss:', row.volume_loss, 'L');
    }
  } else {
    console.log('  (none found)');
  }

  // Check distillation records
  console.log('\n--- Sent to Distillery ---');
  const distillation = await db.execute(sql`
    SELECT
      dr.sent_at,
      dr.source_volume,
      dr.status
    FROM distillation_records dr
    WHERE dr.source_batch_id = ${batchId}
    ORDER BY dr.sent_at
  `);

  if (distillation.rows.length > 0) {
    for (const row of distillation.rows) {
      console.log('  Sent:', row.source_volume, 'L on', row.sent_at, '(' + row.status + ')');
    }
  } else {
    console.log('  (none found)');
  }

  // Summary
  console.log('\n=== VOLUME ACCOUNTING ===');
  console.log('Initial:', batch.rows[0].initial_volume, 'L');
  console.log('Current:', batch.rows[0].current_volume, 'L');
  console.log('Accounted for:', Number(batch.rows[0].initial_volume) - Number(batch.rows[0].current_volume), 'L');

  process.exit(0);
}
main().catch(console.error);
