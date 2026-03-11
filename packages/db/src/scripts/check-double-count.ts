import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Check for volume entries in BOTH batch_transfers and batch_merge_history for 2024 batches
  const batches = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name
    FROM batches b
    WHERE b.deleted_at IS NULL AND b.start_date <= '2024-12-31'::timestamptz
      AND b.reconciliation_status IN ('verified', 'pending')
  `);

  console.log("=== Checking for double-counted volumes ===\n");
  
  for (const batch of batches.rows) {
    const bId = batch.id as string;
    
    // Check transfers IN
    const transfersIn = await db.execute(sql`
      SELECT bt.id, bt.source_batch_id, bt.volume_transferred, bt.transferred_at,
             COALESCE(sb.custom_name, sb.name) as source_name
      FROM batch_transfers bt
      JOIN batches sb ON sb.id = bt.source_batch_id
      WHERE bt.destination_batch_id = ${bId} AND bt.deleted_at IS NULL
        AND bt.transferred_at::date <= '2024-12-31'
      ORDER BY bt.transferred_at
    `);
    
    // Check merges IN with source_type = 'batch_transfer'
    const mergesIn = await db.execute(sql`
      SELECT bmh.id, bmh.source_batch_id, bmh.volume_added, bmh.merged_at, bmh.source_type,
             COALESCE(sb.custom_name, sb.name) as source_name
      FROM batch_merge_history bmh
      LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
      WHERE bmh.target_batch_id = ${bId} AND bmh.deleted_at IS NULL
        AND bmh.merged_at::date <= '2024-12-31'
      ORDER BY bmh.merged_at
    `);
    
    if (transfersIn.rows.length > 0 || mergesIn.rows.length > 0) {
      const hasOverlap = transfersIn.rows.length > 0 && mergesIn.rows.length > 0;
      if (hasOverlap || mergesIn.rows.length > 0) {
        console.log(`${batch.name}:`);
        for (const t of transfersIn.rows) {
          console.log(`  TRANSFER IN: ${(Number(t.volume_transferred)/3.78541).toFixed(1)} gal from ${t.source_name} on ${t.transferred_at}`);
        }
        for (const m of mergesIn.rows) {
          console.log(`  MERGE IN (${m.source_type}): ${(Number(m.volume_added)/3.78541).toFixed(1)} gal from ${m.source_name || 'N/A'} on ${m.merged_at}`);
        }
        if (hasOverlap) console.log(`  ⚠️  BOTH transfers AND merges — potential double-count!`);
        console.log();
      }
    }
  }
  
  // Sum up the overlap
  console.log("=== Double-count summary ===\n");
  
  let totalDoubleCountL = 0;
  for (const batch of batches.rows) {
    const bId = batch.id as string;
    
    // SBD counts: transfersIn from batch_transfers + internalMergesIn from batch_merge_history (source_type='batch_transfer')
    const tIn = await db.execute(sql`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers WHERE destination_batch_id = ${bId} AND deleted_at IS NULL
        AND transferred_at::date <= '2024-12-31'
    `);
    const mIn = await db.execute(sql`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as total
      FROM batch_merge_history WHERE target_batch_id = ${bId} AND deleted_at IS NULL
        AND source_type = 'batch_transfer' AND merged_at::date <= '2024-12-31'
    `);
    
    const transferL = Number(tIn.rows[0].total);
    const mergeL = Number(mIn.rows[0].total);
    
    if (transferL > 0 && mergeL > 0) {
      const doubleL = Math.min(transferL, mergeL);
      totalDoubleCountL += doubleL;
      console.log(`  ${batch.name}: tIn=${(transferL/3.78541).toFixed(1)} + mIn(batch_transfer)=${(mergeL/3.78541).toFixed(1)} = double-counted ${(doubleL/3.78541).toFixed(1)} gal`);
    }
  }
  
  console.log(`\n  TOTAL double-counted: ${(totalDoubleCountL/3.78541).toFixed(1)} gal`);
  console.log(`  Page ending - my ending: 1175.2 - 1121.0 = 54.2 gal`);
  console.log(`  Match: ${Math.abs((totalDoubleCountL/3.78541) - 54.2) < 1 ? 'YES' : 'NO'}`);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
