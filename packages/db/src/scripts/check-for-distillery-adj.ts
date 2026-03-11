import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Get For Distillery batch details
  const batch = await db.execute(sql`
    SELECT id, name, custom_name, product_type, initial_volume_liters, current_volume_liters,
           start_date, reconciliation_status
    FROM batches
    WHERE (name ILIKE '%distillery%' OR custom_name ILIKE '%distillery%')
      AND deleted_at IS NULL
  `);
  const batchId = batch.rows[0]?.id;
  console.log("=== For Distillery Batch ===");
  console.log(JSON.stringify(batch.rows[0], null, 2));

  // Get all adjustments on this batch
  const adjs = await db.execute(sql`
    SELECT id, batch_id, adjustment_amount, reason, adjustment_date, volume_before, volume_after
    FROM batch_volume_adjustments
    WHERE batch_id = ${batchId} AND deleted_at IS NULL
    ORDER BY adjustment_date
  `);
  console.log("\n=== Adjustments on For Distillery ===");
  for (const r of adjs.rows) {
    const amtGal = (Number(r.adjustment_amount) / 3.78541).toFixed(1);
    console.log(`  ${r.adjustment_date}: ${amtGal} gal (${r.adjustment_amount} L) - "${r.reason}"`);
    console.log(`    volume_before=${(Number(r.volume_before)/3.78541).toFixed(1)} gal, volume_after=${(Number(r.volume_after)/3.78541).toFixed(1)} gal`);
    console.log(`    adj id: ${r.id}`);
  }

  // Get all transfers on this batch
  const transfers = await db.execute(sql`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id, bt.volume_transferred, bt.transferred_at, bt.loss,
           sb.name as src_name, sb.custom_name as src_custom_name,
           db.name as dst_name, db.custom_name as dst_custom_name
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    WHERE (bt.source_batch_id = ${batchId} OR bt.destination_batch_id = ${batchId})
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `);
  console.log("\n=== Transfers involving For Distillery ===");
  for (const r of transfers.rows) {
    const volGal = (Number(r.volume_transferred) / 3.78541).toFixed(1);
    const direction = r.source_batch_id === batchId ? "OUT →" : "IN ←";
    const other = r.source_batch_id === batchId 
      ? (r.dst_custom_name || r.dst_name)
      : (r.src_custom_name || r.src_name);
    console.log(`  ${direction} ${other}: ${volGal} gal on ${r.transferred_at}`);
  }

  // Get distillation records from this batch
  const dist = await db.execute(sql`
    SELECT id, source_batch_id, source_volume_liters, sent_at, status
    FROM distillation_records
    WHERE source_batch_id = ${batchId} AND deleted_at IS NULL
    ORDER BY sent_at
  `);
  console.log("\n=== Distillation from For Distillery ===");
  for (const r of dist.rows) {
    const gal = (Number(r.source_volume_liters) / 3.78541).toFixed(1);
    console.log(`  ${gal} gal on ${r.sent_at} (status: ${r.status})`);
  }

  // Now compute: what is the TOTAL SBD ending for 2024?
  // We need to sum all batch endings reconstructed at 2024-12-31
  // Let's approximate: initial_volume + transfers_in - transfers_out - losses - packaging - distillation
  // But since SBD does this per-batch, let's just look at what the client would see
  // The key question: what total ending does SBD compute for HC batches at Dec 31, 2024?
  
  // All cider batches started by 2024-12-31
  const ciderBatches = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.initial_volume_liters,
           b.current_volume_liters, b.start_date, b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.start_date <= '2024-12-31'
      AND b.product_type = 'cider'
      AND b.reconciliation_status IN ('verified', 'pending')
    ORDER BY b.start_date
  `);
  console.log("\n=== All HC batches active in 2024 ===");
  let totalInitial = 0;
  let totalCurrent = 0;
  for (const r of ciderBatches.rows) {
    const initGal = (Number(r.initial_volume_liters) / 3.78541).toFixed(1);
    const curGal = (Number(r.current_volume_liters) / 3.78541).toFixed(1);
    console.log(`  ${r.name}: init=${initGal}, current=${curGal}, start=${r.start_date}, status=${r.reconciliation_status}`);
    totalInitial += Number(r.initial_volume_liters);
    totalCurrent += Number(r.current_volume_liters);
  }
  console.log(`  TOTAL: initial=${(totalInitial/3.78541).toFixed(1)} gal, current=${(totalCurrent/3.78541).toFixed(1)} gal`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
