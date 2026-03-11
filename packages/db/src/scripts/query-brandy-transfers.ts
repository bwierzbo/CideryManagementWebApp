import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Find ALL transfers from parent Apple Brandy (both active and deleted)
  const transfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.deleted_at, bt.transferred_at,
           bt.notes,
           dest.name as dest_name, dest.custom_name as dest_custom_name
    FROM batch_transfers bt
    LEFT JOIN batches dest ON dest.id = bt.destination_batch_id
    WHERE bt.source_batch_id = 'cf5b8a7b-33b4-407c-9011-1e4a2068d1da'
    ORDER BY bt.deleted_at NULLS FIRST
  `));
  console.log("All transfers from parent Apple Brandy:");
  for (const t of transfers.rows) {
    console.log(`  ${t.id} → ${t.dest_custom_name || t.dest_name} | vol=${t.volume_transferred} | deleted=${t.deleted_at || 'NO'} | date=${t.transferred_at}`);
  }

  // Also check: what's Salish#1's current state
  const salish1 = await db.execute(sql.raw(`
    SELECT id, name, custom_name, initial_volume_liters, current_volume_liters,
           parent_batch_id, product_type, actual_abv, estimated_abv
    FROM batches
    WHERE id = '3e6780db-39ff-4a61-9645-a8e9505f2620'
  `));
  console.log("\nSalish #1:", JSON.stringify(salish1.rows, null, 2));

  // Check SBD for parent by computing active transfers out
  const activeOut = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total_active_out
    FROM batch_transfers
    WHERE source_batch_id = 'cf5b8a7b-33b4-407c-9011-1e4a2068d1da'
    AND deleted_at IS NULL
  `));
  console.log("\nParent active transfers out total:", activeOut.rows[0].total_active_out);
  console.log("Parent initial:", 208.198);
  console.log("Phantom SBD:", 208.198 - Number(activeOut.rows[0].total_active_out));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
