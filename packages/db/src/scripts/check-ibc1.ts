import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  // 1. Find vessel IBC-1000-1
  console.log("=== VESSEL: IBC-1000-1 ===");
  const vesselRows = await db.execute(sql.raw(`
    SELECT id, name, status, capacity, capacity_unit, location, deleted_at
    FROM vessels
    WHERE name = 'IBC-1000-1'
    ORDER BY deleted_at NULLS FIRST
  `));
  for (const v of vesselRows.rows as any[]) {
    console.log(v);
  }
  // Use the active (non-deleted) vessel
  const activeVessel = (vesselRows.rows as any[]).find(v => !v.deleted_at);
  const deletedVessel = (vesselRows.rows as any[]).find(v => v.deleted_at);
  const vesselId = activeVessel?.id;
  const deletedVesselId = deletedVessel?.id;
  console.log(`\nActive vessel ID: ${vesselId}`);
  console.log(`Deleted vessel ID: ${deletedVesselId}`);
  if (!vesselId) {
    console.log("Active vessel not found!");
    process.exit(1);
  }

  // 2. All batches assigned to this vessel (including completed/deleted)
  console.log("\n=== ALL BATCHES ON THIS VESSEL ===");
  const batchRows = await db.execute(sql.raw(`
    SELECT id, name, custom_name, batch_number, status,
           current_volume, current_volume_unit, current_volume_liters,
           initial_volume, initial_volume_unit,
           vessel_id, start_date, end_date, deleted_at,
           created_at, updated_at
    FROM batches
    WHERE vessel_id = '${vesselId}'
    ORDER BY created_at DESC
  `));
  for (const b of batchRows.rows as any[]) {
    console.log(`\n  Batch: ${b.name} (${b.custom_name || 'no custom name'})`);
    console.log(`    ID: ${b.id}`);
    console.log(`    Status: ${b.status}`);
    console.log(`    Current Volume: ${b.current_volume} ${b.current_volume_unit} (liters: ${b.current_volume_liters})`);
    console.log(`    Initial Volume: ${b.initial_volume} ${b.initial_volume_unit}`);
    console.log(`    Deleted At: ${b.deleted_at}`);
    console.log(`    Start: ${b.start_date}, End: ${b.end_date}`);
    console.log(`    Updated At: ${b.updated_at}`);
  }

  // 3. Transfers FROM this vessel
  console.log("\n=== TRANSFERS FROM IBC-1000-1 (as source) ===");
  const transfersOut = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.loss, bt.remaining_volume, bt.remaining_volume_unit,
           bt.total_volume_processed,
           bt.transferred_at, bt.deleted_at,
           sb.name as source_batch_name, sb.status as source_batch_status,
           db2.name as dest_batch_name,
           dv.name as dest_vessel_name
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE bt.source_vessel_id = '${vesselId}'
    ORDER BY bt.transferred_at DESC
  `));
  for (const t of transfersOut.rows as any[]) {
    console.log(`\n  Transfer: ${t.id}`);
    console.log(`    From batch: ${t.source_batch_name} (${t.source_batch_status})`);
    console.log(`    To: ${t.dest_batch_name} in ${t.dest_vessel_name}`);
    console.log(`    Volume: ${t.volume_transferred} ${t.volume_transferred_unit}`);
    console.log(`    Loss: ${t.loss}`);
    console.log(`    Remaining: ${t.remaining_volume} ${t.remaining_volume_unit}`);
    console.log(`    Total Processed: ${t.total_volume_processed}`);
    console.log(`    Date: ${t.transferred_at}`);
    console.log(`    Deleted: ${t.deleted_at}`);
  }

  // 4. Transfers TO this vessel
  console.log("\n=== TRANSFERS TO IBC-1000-1 (as destination) ===");
  const transfersIn = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.transferred_at, bt.deleted_at,
           sb.name as source_batch_name,
           sv.name as source_vessel_name,
           db2.name as dest_batch_name
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    WHERE bt.destination_vessel_id = '${vesselId}'
    ORDER BY bt.transferred_at DESC
  `));
  for (const t of transfersIn.rows as any[]) {
    console.log(`\n  Transfer: ${t.id}`);
    console.log(`    From: ${t.source_batch_name} in ${t.source_vessel_name}`);
    console.log(`    To batch: ${t.dest_batch_name}`);
    console.log(`    Volume: ${t.volume_transferred} ${t.volume_transferred_unit}`);
    console.log(`    Date: ${t.transferred_at}`);
    console.log(`    Deleted: ${t.deleted_at}`);
  }

  // 4b. Transfers from/to the DELETED vessel
  if (deletedVesselId) {
    console.log("\n=== TRANSFERS FROM DELETED IBC-1000-1 (as source) ===");
    const delTransOut = await db.execute(sql.raw(`
      SELECT bt.id, bt.volume_transferred, bt.transferred_at, bt.deleted_at,
             sb.name as source_batch_name, db2.name as dest_batch_name
      FROM batch_transfers bt
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
      WHERE bt.source_vessel_id = '${deletedVesselId}'
      ORDER BY bt.transferred_at DESC
    `));
    for (const t of delTransOut.rows as any[]) {
      console.log(`  ${t.source_batch_name} -> ${t.dest_batch_name}: ${t.volume_transferred}L, date=${t.transferred_at}, deleted=${t.deleted_at}`);
    }
    if (delTransOut.rows.length === 0) console.log("  (none)");

    console.log("\n=== TRANSFERS TO DELETED IBC-1000-1 (as destination) ===");
    const delTransIn = await db.execute(sql.raw(`
      SELECT bt.id, bt.volume_transferred, bt.transferred_at, bt.deleted_at,
             sb.name as source_batch_name, db2.name as dest_batch_name
      FROM batch_transfers bt
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
      WHERE bt.destination_vessel_id = '${deletedVesselId}'
      ORDER BY bt.transferred_at DESC
    `));
    for (const t of delTransIn.rows as any[]) {
      console.log(`  ${t.source_batch_name} -> ${t.dest_batch_name}: ${t.volume_transferred}L, date=${t.transferred_at}, deleted=${t.deleted_at}`);
    }
    if (delTransIn.rows.length === 0) console.log("  (none)");

    console.log("\n=== BATCHES ON DELETED IBC-1000-1 ===");
    const delBatches = await db.execute(sql.raw(`
      SELECT id, name, custom_name, status, current_volume, current_volume_unit,
             current_volume_liters, deleted_at
      FROM batches
      WHERE vessel_id = '${deletedVesselId}'
      ORDER BY created_at DESC
    `));
    for (const b of delBatches.rows as any[]) {
      console.log(`  ${b.name} (${b.custom_name}): status=${b.status}, vol=${b.current_volume}${b.current_volume_unit}, liters=${b.current_volume_liters}, deleted=${b.deleted_at}`);
    }
    if (delBatches.rows.length === 0) console.log("  (none)");
  }

  // 5. Press runs pointing to this vessel (both active and deleted)
  console.log("\n=== PRESS RUNS POINTING TO IBC-1000-1 ===");
  const pressRunRows = await db.execute(sql.raw(`
    SELECT id, press_run_name, status, total_juice_volume, total_juice_volume_unit,
           vessel_id, date_completed, deleted_at
    FROM press_runs
    WHERE vessel_id = '${vesselId}' OR vessel_id = '${deletedVesselId || 'none'}'
    ORDER BY created_at DESC
  `));
  for (const p of pressRunRows.rows as any[]) {
    console.log(p);
  }

  // 6. Simulate the liquidMap query for this vessel
  console.log("\n=== LIQUIDMAP SIMULATION ===");
  const liquidMapResult = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.status,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.deleted_at
    FROM batches b
    WHERE b.vessel_id = '${vesselId}'
      AND b.deleted_at IS NULL
      AND NOT (b.status = 'completed' AND COALESCE(b.current_volume_liters, 0) <= 0.01)
    ORDER BY
      CASE WHEN b.status != 'completed' THEN 0 ELSE 1 END,
      b.current_volume_liters DESC NULLS LAST,
      b.created_at DESC
    LIMIT 1
  `));
  console.log("Batch selected by liquidMap logic:");
  for (const b of liquidMapResult.rows as any[]) {
    console.log(`  ${b.name} (${b.custom_name}): status=${b.status}, volume=${b.current_volume} ${b.current_volume_unit}, liters=${b.current_volume_liters}`);
  }
  if (liquidMapResult.rows.length === 0) {
    console.log("  (none - vessel would show empty)");
  }

  // 7. Merge history for batches on this vessel
  console.log("\n=== MERGE HISTORY FOR BATCHES ON THIS VESSEL ===");
  const batchIds = (batchRows.rows as any[]).map(b => `'${b.id}'`).join(',');
  if (batchIds) {
    const mergeRows = await db.execute(sql.raw(`
      SELECT bmh.id, bmh.target_batch_id, bmh.source_batch_id,
             bmh.volume_added, bmh.deleted_at,
             tb.name as target_name, sb.name as source_name
      FROM batch_merge_history bmh
      LEFT JOIN batches tb ON tb.id = bmh.target_batch_id
      LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
      WHERE bmh.target_batch_id IN (${batchIds})
         OR bmh.source_batch_id IN (${batchIds})
      ORDER BY bmh.created_at DESC
    `));
    for (const m of mergeRows.rows as any[]) {
      console.log(`  Merge: ${m.source_name} -> ${m.target_name}, volume=${m.volume_added}, deleted=${m.deleted_at}`);
    }
    if (mergeRows.rows.length === 0) {
      console.log("  (none)");
    }
  }

  // 7b. Exact liquidMap join simulation (full query as the code runs it)
  console.log("\n=== EXACT LIQUIDMAP JOIN FOR ACTIVE VESSEL ===");
  const exactLiquidMap = await db.execute(sql.raw(`
    SELECT v.id as vessel_id, v.name as vessel_name, v.status as vessel_status,
           v.capacity, v.capacity_unit,
           b.id as batch_id, b.name as batch_name, b.status as batch_status,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.custom_name, b.deleted_at as batch_deleted_at,
           pr.id as press_run_id, pr.total_juice_volume, pr.total_juice_volume_unit, pr.status as pr_status
    FROM vessels v
    LEFT JOIN batches b ON b.vessel_id = v.id
      AND b.deleted_at IS NULL
      AND b.id = (
        SELECT b2.id FROM batches b2
        WHERE b2.vessel_id = v.id
          AND b2.deleted_at IS NULL
          AND NOT (b2.status = 'completed' AND COALESCE(b2.current_volume_liters, 0) <= 0.01)
        ORDER BY
          CASE WHEN b2.status != 'completed' THEN 0 ELSE 1 END,
          b2.current_volume_liters DESC NULLS LAST,
          b2.created_at DESC
        LIMIT 1
      )
    LEFT JOIN press_runs pr ON pr.vessel_id = v.id
      AND pr.deleted_at IS NULL
      AND pr.status = 'completed'
      AND pr.id = (
        SELECT pr2.id FROM press_runs pr2
        WHERE pr2.vessel_id = v.id
          AND pr2.deleted_at IS NULL
          AND pr2.status = 'completed'
        ORDER BY pr2.date_completed DESC NULLS LAST, pr2.created_at DESC
        LIMIT 1
      )
    WHERE v.id = '${vesselId}'
      AND v.deleted_at IS NULL
  `));
  for (const r of exactLiquidMap.rows as any[]) {
    console.log(`  Vessel: ${r.vessel_name} (status=${r.vessel_status})`);
    console.log(`  Batch: ${r.batch_name || '(none)'} status=${r.batch_status || 'N/A'} vol=${r.current_volume || 0} ${r.current_volume_unit || ''} liters=${r.current_volume_liters || 0}`);
    console.log(`  Press Run: ${r.press_run_id || '(none)'} vol=${r.total_juice_volume || 0} ${r.total_juice_volume_unit || ''} status=${r.pr_status || 'N/A'}`);
  }

  // 8. Volume adjustments
  console.log("\n=== VOLUME ADJUSTMENTS FOR BATCHES ON THIS VESSEL ===");
  if (batchIds) {
    const adjRows = await db.execute(sql.raw(`
      SELECT ba.id, ba.batch_id, ba.previous_volume, ba.new_volume,
             ba.reason, ba.created_at, ba.deleted_at,
             b.name as batch_name
      FROM batch_volume_adjustments ba
      LEFT JOIN batches b ON b.id = ba.batch_id
      WHERE ba.batch_id IN (${batchIds})
      ORDER BY ba.created_at DESC
    `));
    for (const a of adjRows.rows as any[]) {
      console.log(`  Adjustment on ${a.batch_name}: ${a.previous_volume} -> ${a.new_volume} (${a.reason}), deleted=${a.deleted_at}`);
    }
    if (adjRows.rows.length === 0) {
      console.log("  (none)");
    }
  }

  process.exit(0);
}

main().catch(console.error);
