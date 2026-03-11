import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const endDate = '2024-12-31';
  
  // Get ALL batches in the 2024 reconciliation set (started by 2024-12-31)
  const batches = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.current_volume_liters, b.start_date,
           b.parent_batch_id, b.reconciliation_status,
           COALESCE(pb.custom_name, pb.name) as parent_name
    FROM batches b
    LEFT JOIN batches pb ON pb.id = b.parent_batch_id
    WHERE b.deleted_at IS NULL
      AND b.start_date <= ${endDate}::timestamptz
      AND b.reconciliation_status IN ('verified', 'pending')
    ORDER BY b.start_date, b.name
  `);
  
  console.log(`=== ALL ${batches.rows.length} batches in 2024 set ===\n`);
  
  let totalProduction = 0;
  let totalEnding = 0;
  let batchesWithDateIssues: any[] = [];
  
  for (const batch of batches.rows) {
    const bId = batch.id as string;
    const initial = Number(batch.initial_volume_liters);
    const isChild = !!batch.parent_batch_id;
    
    // Find the actual transfer date for this batch (if transfer-derived)
    const transferDate = await db.execute(sql`
      SELECT MIN(bt.transferred_at) as first_transfer
      FROM batch_transfers bt
      WHERE bt.destination_batch_id = ${bId} AND bt.deleted_at IS NULL
    `);
    const actualTransferDate = transferDate.rows[0]?.first_transfer;
    
    // Also check merge history 
    const mergeDate = await db.execute(sql`
      SELECT MIN(bmh.merged_at) as first_merge
      FROM batch_merge_history bmh
      WHERE bmh.target_batch_id = ${bId} AND bmh.deleted_at IS NULL
    `);
    const actualMergeDate = mergeDate.rows[0]?.first_merge;
    
    // Compute ending at 2024-12-31 (same as before)
    const ops = await db.execute(sql`
      SELECT
        (SELECT COALESCE(SUM(volume_transferred::numeric), 0) FROM batch_transfers WHERE destination_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date) as t_in,
        (SELECT COALESCE(SUM(volume_transferred::numeric), 0) FROM batch_transfers WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date) as t_out,
        (SELECT COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) FROM batch_transfers WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date) as t_loss,
        (SELECT COALESCE(SUM(volume_added::numeric), 0) FROM batch_merge_history WHERE target_batch_id = ${bId} AND deleted_at IS NULL AND merged_at::date <= ${endDate}::date) as m_in,
        (SELECT COALESCE(SUM(volume_added::numeric), 0) FROM batch_merge_history WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND merged_at::date <= ${endDate}::date) as m_out,
        (SELECT COALESCE(SUM(volume_taken_liters::numeric), 0) FROM bottle_runs WHERE batch_id = ${bId} AND voided_at IS NULL AND packaged_at::date <= ${endDate}::date) as btl,
        (SELECT COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) FROM bottle_runs WHERE batch_id = ${bId} AND voided_at IS NULL AND packaged_at::date <= ${endDate}::date) as btl_loss,
        (SELECT COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END), 0) FROM keg_fills WHERE batch_id = ${bId} AND voided_at IS NULL AND deleted_at IS NULL AND filled_at::date <= ${endDate}::date) as keg,
        (SELECT COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) FROM keg_fills WHERE batch_id = ${bId} AND voided_at IS NULL AND deleted_at IS NULL AND filled_at::date <= ${endDate}::date) as keg_loss,
        (SELECT COALESCE(SUM(volume_loss::numeric), 0) FROM batch_racking_operations WHERE batch_id = ${bId} AND deleted_at IS NULL AND (notes IS NULL OR notes NOT LIKE '%Historical Record%') AND racked_at::date <= ${endDate}::date) as rack,
        (SELECT COALESCE(SUM(volume_loss::numeric), 0) FROM batch_filter_operations WHERE batch_id = ${bId} AND deleted_at IS NULL AND filtered_at::date <= ${endDate}::date) as filt,
        (SELECT COALESCE(SUM(adjustment_amount::numeric), 0) FROM batch_volume_adjustments WHERE batch_id = ${bId} AND deleted_at IS NULL AND adjustment_date::date <= ${endDate}::date) as adj,
        (SELECT COALESCE(SUM(source_volume_liters::numeric), 0) FROM distillation_records WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND status IN ('sent', 'received') AND sent_at::date <= ${endDate}::date) as dist
    `);
    
    const r = ops.rows[0];
    const ending = initial + Number(r.t_in) + Number(r.m_in) - Number(r.t_out) - Number(r.t_loss) - Number(r.m_out)
      - Number(r.btl) - Number(r.btl_loss) - Number(r.keg) - Number(r.keg_loss) - Number(r.rack) - Number(r.filt)
      + Number(r.adj) - Number(r.dist);
    
    const endingGal = ending / 3.78541;
    const initGal = initial / 3.78541;
    
    totalProduction += initial;
    totalEnding += ending;
    
    // Check if child batch has date issues
    const batchStartStr = new Date(batch.start_date as string).toISOString().split('T')[0];
    let dateIssue = '';
    
    if (isChild && initial === 0) {
      // Transfer-derived child — check if actual transfer happened after 2024
      if (actualTransferDate) {
        const transferStr = new Date(actualTransferDate as string).toISOString().split('T')[0];
        if (transferStr > endDate) {
          dateIssue = `WRONG DATE: transfer on ${transferStr}, start_date ${batchStartStr}`;
          batchesWithDateIssues.push({
            id: bId,
            name: batch.name,
            startDate: batchStartStr,
            actualDate: transferStr,
            endingGal: endingGal,
            type: 'transfer'
          });
        }
      }
      if (actualMergeDate && !dateIssue) {
        const mergeStr = new Date(actualMergeDate as string).toISOString().split('T')[0];
        if (mergeStr > endDate) {
          dateIssue = `WRONG DATE: merge on ${mergeStr}, start_date ${batchStartStr}`;
          batchesWithDateIssues.push({
            id: bId,
            name: batch.name,
            startDate: batchStartStr,
            actualDate: mergeStr,
            endingGal: endingGal,
            type: 'merge'
          });
        }
      }
    }
    
    // Only print batches with non-zero ending or date issues
    if (Math.abs(endingGal) > 0.05 || dateIssue) {
      const parentInfo = isChild ? ` [child of ${batch.parent_name}]` : '';
      const flag = dateIssue ? ` ⚠️  ${dateIssue}` : '';
      console.log(`  ${batch.name} (${batch.product_type}${parentInfo}): init=${initGal.toFixed(1)}, ending=${endingGal.toFixed(1)} gal, start=${batchStartStr}, status=${batch.reconciliation_status}${flag}`);
      
      // Show non-zero operations
      const nonZero: string[] = [];
      if (Number(r.t_in) > 0) nonZero.push(`tIn=${(Number(r.t_in)/3.78541).toFixed(1)}`);
      if (Number(r.m_in) > 0) nonZero.push(`mIn=${(Number(r.m_in)/3.78541).toFixed(1)}`);
      if (Number(r.t_out) > 0) nonZero.push(`tOut=${(Number(r.t_out)/3.78541).toFixed(1)}`);
      if (Number(r.m_out) > 0) nonZero.push(`mOut=${(Number(r.m_out)/3.78541).toFixed(1)}`);
      if (Number(r.adj) !== 0) nonZero.push(`adj=${(Number(r.adj)/3.78541).toFixed(1)}`);
      if (nonZero.length > 0) console.log(`    ops: ${nonZero.join(', ')}`);
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`  Total batches in 2024 set: ${batches.rows.length}`);
  console.log(`  Total production (sum of initials): ${(totalProduction/3.78541).toFixed(1)} gal`);
  console.log(`  Total SBD ending (my computation): ${(totalEnding/3.78541).toFixed(1)} gal`);
  console.log(`  Target: 1121.0 gal`);
  console.log(`  Gap: ${((totalEnding/3.78541) - 1121).toFixed(1)} gal`);
  
  if (batchesWithDateIssues.length > 0) {
    console.log(`\n=== BATCHES WITH WRONG DATES (${batchesWithDateIssues.length}) ===`);
    let totalWrongDateEnding = 0;
    for (const b of batchesWithDateIssues) {
      console.log(`  ${b.name}: start=${b.startDate}, actual=${b.actualDate}, ending=${b.endingGal.toFixed(1)} gal`);
      totalWrongDateEnding += b.endingGal;
    }
    console.log(`  Total ending from wrong-date batches: ${totalWrongDateEnding.toFixed(1)} gal`);
    console.log(`  After removing: ${((totalEnding/3.78541) - totalWrongDateEnding).toFixed(1)} gal`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
