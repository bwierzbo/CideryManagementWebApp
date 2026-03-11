import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  // Get batch info for TANK-1000-1
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.initial_volume, b.initial_volume_unit,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.status, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE v.name = 'TANK-1000-1' AND b.deleted_at IS NULL
    ORDER BY b.start_date DESC
  `));

  console.log("=== BATCHES IN TANK-1000-1 ===");
  for (const b of batches.rows) {
    console.log(b.name, "| id:", b.id);
    console.log("  initial_volume:", b.initial_volume, b.initial_volume_unit);
    console.log("  current_volume:", b.current_volume, b.current_volume_unit);
    console.log("  current_volume_liters:", b.current_volume_liters);
    console.log("  status:", b.status);
  }

  const batchId = (batches.rows[0] as any).id;

  // Get transfers involving this batch
  const transfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.transferred_at, bt.notes,
           sb.name as source_batch_name, db.name as dest_batch_name,
           sv.name as source_vessel, dv.name as dest_vessel,
           bt.remaining_batch_id
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE (bt.source_batch_id = '${batchId}' OR bt.destination_batch_id = '${batchId}')
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  console.log("\n=== TRANSFERS ===");
  for (const t of transfers.rows as any[]) {
    console.log(t.transferred_at, "|", t.source_batch_name, "(", t.source_vessel, ") ->", t.dest_batch_name, "(", t.dest_vessel, ") |", t.volume_transferred, t.volume_transferred_unit);
    console.log("  remaining_batch_id:", t.remaining_batch_id);
  }

  // Get merge history for this batch
  const merges = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.source_type, bmh.source_batch_id, bmh.volume_added, bmh.volume_added_unit,
           bmh.target_volume_before, bmh.target_volume_after, bmh.merged_at,
           sb.name as source_batch_name, bmh.notes,
           bmh.source_press_run_id, pr.press_run_name
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    LEFT JOIN press_runs pr ON pr.id = bmh.source_press_run_id
    WHERE bmh.target_batch_id = '${batchId}' AND bmh.deleted_at IS NULL
    ORDER BY bmh.merged_at
  `));

  console.log("\n=== MERGE HISTORY ===");
  for (const m of merges.rows as any[]) {
    console.log(m.merged_at, "| type:", m.source_type, "| from:", m.source_batch_name || m.press_run_name, "| vol_added:", m.volume_added, m.volume_added_unit);
    console.log("  vol_before:", m.target_volume_before, "-> vol_after:", m.target_volume_after);
  }

  // Also check IBC-1000-1
  const ibc = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.initial_volume, b.initial_volume_unit,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.status, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE v.name = 'IBC-1000-1' AND b.deleted_at IS NULL
    ORDER BY b.start_date DESC
  `));

  console.log("\n=== BATCHES IN IBC-1000-1 ===");
  for (const b of ibc.rows as any[]) {
    console.log(b.name, "| id:", b.id);
    console.log("  initial_volume:", b.initial_volume, b.initial_volume_unit);
    console.log("  current_volume:", b.current_volume, b.current_volume_unit);
    console.log("  current_volume_liters:", b.current_volume_liters);
    console.log("  status:", b.status);
  }

  if (ibc.rows.length > 0) {
    const ibcBatchId = (ibc.rows[0] as any).id;

    const ibcTransfers = await db.execute(sql.raw(`
      SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
             bt.volume_transferred, bt.volume_transferred_unit,
             bt.transferred_at, bt.notes,
             sb.name as source_batch_name, db.name as dest_batch_name,
             sv.name as source_vessel, dv.name as dest_vessel,
             bt.remaining_batch_id
      FROM batch_transfers bt
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN batches db ON db.id = bt.destination_batch_id
      LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
      WHERE (bt.source_batch_id = '${ibcBatchId}' OR bt.destination_batch_id = '${ibcBatchId}')
        AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at
    `));

    console.log("\n=== IBC-1000-1 TRANSFERS ===");
    for (const t of ibcTransfers.rows as any[]) {
      console.log(t.transferred_at, "|", t.source_batch_name, "(", t.source_vessel, ") ->", t.dest_batch_name, "(", t.dest_vessel, ") |", t.volume_transferred, t.volume_transferred_unit);
      console.log("  remaining_batch_id:", t.remaining_batch_id);
    }

    const ibcMerges = await db.execute(sql.raw(`
      SELECT bmh.id, bmh.source_type, bmh.source_batch_id, bmh.volume_added, bmh.volume_added_unit,
             bmh.target_volume_before, bmh.target_volume_after, bmh.merged_at,
             sb.name as source_batch_name, bmh.notes,
             bmh.source_press_run_id, pr.press_run_name
      FROM batch_merge_history bmh
      LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
      LEFT JOIN press_runs pr ON pr.id = bmh.source_press_run_id
      WHERE bmh.target_batch_id = '${ibcBatchId}' AND bmh.deleted_at IS NULL
      ORDER BY bmh.merged_at
    `));

    console.log("\n=== IBC-1000-1 MERGE HISTORY ===");
    for (const m of ibcMerges.rows as any[]) {
      console.log(m.merged_at, "| type:", m.source_type, "| from:", m.source_batch_name || m.press_run_name, "| vol_added:", m.volume_added, m.volume_added_unit);
      console.log("  vol_before:", m.target_volume_before, "-> vol_after:", m.target_volume_after);
    }
  }

  process.exit(0);
}

main().catch(console.error);
