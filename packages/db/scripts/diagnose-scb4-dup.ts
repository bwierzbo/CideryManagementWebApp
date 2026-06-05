import { db } from "../src/index";
import { sql } from "drizzle-orm";

// Inspect the two duplicate SCB4 -> DRUM-120-1 transfer rows and the destination
// batch (Lavender Black Currant) to determine whether the destination was
// double-credited.

const DUP_IDS = [
  "bd5e9049-54b5-4e6f-90e8-ee1ee5dffd75",
  "29c8d606-d0dc-44b2-8981-04de5e2bd3d2",
];

async function main() {
  const dups = await db.execute(sql`
    SELECT id, transferred_at, created_at, updated_at,
           volume_transferred, total_volume_processed, loss,
           source_vessel_id, destination_vessel_id,
           source_batch_id, destination_batch_id
    FROM batch_transfers
    WHERE id IN (${DUP_IDS[0]}::uuid, ${DUP_IDS[1]}::uuid)
    ORDER BY created_at ASC`);
  console.log("=== The two duplicate transfer rows (full detail) ===");
  for (const r of dups.rows as any[]) {
    console.log(JSON.stringify(r, null, 2));
  }

  // Destination batch: Lavender Black Currant (whatever destination_batch_id resolves to)
  const destBatchIds = Array.from(
    new Set((dups.rows as any[]).map((r) => r.destination_batch_id).filter(Boolean)),
  );
  for (const id of destBatchIds) {
    const bres = await db.execute(sql`
      SELECT b.id, b.name, b.custom_name, b.status,
             b.current_volume, b.current_volume_unit,
             b.initial_volume, b.initial_volume_liters, b.start_date,
             v.name AS vessel
      FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
      WHERE b.id = ${id}::uuid`);
    const b = (bres.rows as any[])[0];
    console.log(`\n=== Destination batch "${b?.custom_name || b?.name}" (${id}) in ${b?.vessel} ===`);
    console.log(`  status=${b?.status} current=${b?.current_volume}${b?.current_volume_unit} initial=${b?.initial_volume} initL=${b?.initial_volume_liters} start=${b?.start_date}`);

    const ins = await db.execute(sql`
      SELECT bt.id, bt.transferred_at, bt.volume_transferred, bt.total_volume_processed,
             sv.name AS src_vessel, sb.custom_name AS src_batch
      FROM batch_transfers bt
      LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
      LEFT JOIN batches sb ON bt.source_batch_id = sb.id
      WHERE bt.destination_batch_id = ${id}::uuid AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at ASC`);
    console.log(`  Transfers IN (${ins.rows.length}):`);
    for (const r of ins.rows as any[]) {
      console.log(`    ${r.transferred_at} ← ${r.src_vessel} (${r.src_batch})  vol=${r.volume_transferred}  id=${r.id}`);
    }

    const merges = await db.execute(sql`
      SELECT merged_at, volume_added, id FROM batch_merge_history
      WHERE target_batch_id = ${id}::uuid AND deleted_at IS NULL ORDER BY merged_at`);
    console.log(`  Merge history IN (${merges.rows.length}):`);
    for (const r of merges.rows as any[]) {
      console.log(`    ${r.merged_at}  +${r.volume_added}  id=${r.id}`);
    }

    const adjs = await db.execute(sql`
      SELECT adjustment_date, adjustment_amount, reason, id FROM batch_volume_adjustments
      WHERE batch_id = ${id}::uuid AND deleted_at IS NULL ORDER BY adjustment_date`);
    console.log(`  Adjustments (${adjs.rows.length}):`);
    for (const r of adjs.rows as any[]) {
      console.log(`    ${r.adjustment_date}  ${r.adjustment_amount}  reason=${r.reason}  id=${r.id}`);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
