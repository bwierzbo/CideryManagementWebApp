import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Get all batch_merge_history entries for 2024 batches in the 2024 period
  const merges = await db.execute(sql`
    SELECT bmh.id, bmh.target_batch_id, bmh.source_batch_id, bmh.source_press_run_id,
           bmh.source_juice_purchase_item_id, bmh.volume_added, bmh.merged_at, bmh.source_type,
           COALESCE(tb.custom_name, tb.name) as target_name,
           COALESCE(sb.custom_name, sb.name) as source_name
    FROM batch_merge_history bmh
    JOIN batches tb ON tb.id = bmh.target_batch_id
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    WHERE bmh.deleted_at IS NULL
      AND tb.deleted_at IS NULL
      AND tb.start_date <= '2024-12-31'::timestamptz
      AND bmh.merged_at::date <= '2024-12-31'
    ORDER BY bmh.merged_at
  `);
  
  console.log(`=== ALL batch_merge_history entries for 2024 batches (merged by 2024-12-31) ===\n`);
  let totalMergeL = 0;
  let pressMergeL = 0;
  let batchMergeL = 0;
  let juiceMergeL = 0;
  let otherMergeL = 0;
  
  for (const m of merges.rows) {
    const gal = (Number(m.volume_added) / 3.78541).toFixed(1);
    const sourceInfo = m.source_name || (m.source_press_run_id ? `press_run:${m.source_press_run_id}` : 'unknown');
    console.log(`  ${m.target_name} ← ${sourceInfo}: ${gal} gal (${m.source_type}) on ${m.merged_at}`);
    
    const vol = Number(m.volume_added);
    totalMergeL += vol;
    if (m.source_type === 'press_run') pressMergeL += vol;
    else if (m.source_type === 'batch_transfer') batchMergeL += vol;
    else if (m.source_type === 'juice_purchase') juiceMergeL += vol;
    else otherMergeL += vol;
  }
  
  console.log(`\n  Total merges: ${(totalMergeL/3.78541).toFixed(1)} gal`);
  console.log(`  - press_run merges: ${(pressMergeL/3.78541).toFixed(1)} gal (counted as SBD production)`);
  console.log(`  - batch_transfer merges: ${(batchMergeL/3.78541).toFixed(1)} gal (counted as SBD production via internalMergesInL)`);
  console.log(`  - juice_purchase merges: ${(juiceMergeL/3.78541).toFixed(1)} gal (counted as SBD production)`);
  console.log(`  - other merges: ${(otherMergeL/3.78541).toFixed(1)} gal`);
  
  // Now check: do ANY of these merges ALSO have corresponding batch_transfers entries?
  console.log(`\n=== Checking for corresponding batch_transfers ===\n`);
  for (const m of merges.rows) {
    if (m.source_batch_id) {
      const bt = await db.execute(sql`
        SELECT id, volume_transferred, transferred_at
        FROM batch_transfers
        WHERE source_batch_id = ${m.source_batch_id}
          AND destination_batch_id = ${m.target_batch_id}
          AND deleted_at IS NULL
        ORDER BY transferred_at
      `);
      if (bt.rows.length > 0) {
        console.log(`  ${m.target_name} ← ${m.source_name}: merge ${(Number(m.volume_added)/3.78541).toFixed(1)} gal`);
        for (const t of bt.rows) {
          console.log(`    Also in batch_transfers: ${(Number(t.volume_transferred)/3.78541).toFixed(1)} gal on ${t.transferred_at}`);
        }
        console.log(`    ⚠️  IN BOTH TABLES`);
      }
    }
  }
  
  // Also check: what's in batch_transfers that's NOT in batch_merge_history?
  console.log(`\n=== batch_transfers IN for 2024 batches (not in merges) ===\n`);
  const transfers = await db.execute(sql`
    SELECT bt.destination_batch_id, bt.source_batch_id, bt.volume_transferred, bt.transferred_at,
           COALESCE(tb.custom_name, tb.name) as target_name,
           COALESCE(sb.custom_name, sb.name) as source_name
    FROM batch_transfers bt
    JOIN batches tb ON tb.id = bt.destination_batch_id
    JOIN batches sb ON sb.id = bt.source_batch_id
    WHERE bt.deleted_at IS NULL
      AND tb.deleted_at IS NULL
      AND tb.start_date <= '2024-12-31'::timestamptz
      AND bt.transferred_at::date <= '2024-12-31'
    ORDER BY bt.transferred_at
  `);
  
  let totalTransferL = 0;
  for (const t of transfers.rows) {
    const gal = (Number(t.volume_transferred) / 3.78541).toFixed(1);
    console.log(`  ${t.target_name} ← ${t.source_name}: ${gal} gal on ${t.transferred_at}`);
    totalTransferL += Number(t.volume_transferred);
  }
  console.log(`  Total transfers IN: ${(totalTransferL/3.78541).toFixed(1)} gal`);
  
  console.log(`\n=== SBD ending computation ===`);
  console.log(`  My script ending: 1121.0 gal`);
  console.log(`  SBD ending would add internalMergesIn to production: +${(batchMergeL/3.78541).toFixed(1)} gal`);
  console.log(`  If these ARE also in batch_transfers, they're double-counted`);
  console.log(`  Expected SBD ending if double-counted: ${(1121 + batchMergeL/3.78541).toFixed(1)} gal`);
  console.log(`  Page shows: 1175.2 gal`);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
