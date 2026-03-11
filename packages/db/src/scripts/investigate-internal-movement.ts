import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Break down the 146.8 gal "Internal Movement (net)" into its components.
 * Find which transfers/merges don't cancel and why.
 */

const START = "2025-01-01";
const END = "2025-12-31";
const L_PER_GAL = 3.78541;

async function main() {
  console.log("=== Internal Movement Breakdown ===\n");

  // Get the eligible batch IDs (same logic as computeReconciliationFromBatches)
  const eligible = await db.execute(sql`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
           b.is_racking_derivative, b.parent_batch_id,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           b.start_date
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND (
        COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative IS TRUE
        OR b.parent_batch_id IS NOT NULL
      )
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= ${END}::date
  `);
  const eligibleIds = new Set((eligible.rows as any[]).map(r => r.id));
  console.log(`Eligible batches in SBD: ${eligibleIds.size}\n`);

  // 1. All transfers IN to eligible batches during period
  const tIn = await db.execute(sql`
    SELECT t.id, t.source_batch_id, t.destination_batch_id,
           CAST(t.volume_transferred AS TEXT) as vol,
           CAST(COALESCE(t.loss, 0) AS TEXT) as loss,
           t.transferred_at,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           db2.custom_name as dst_name, db2.batch_number as dst_batch
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
    WHERE t.destination_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= ${START}::date
      AND t.transferred_at < (${END}::date + interval '1 day')
    ORDER BY t.transferred_at
  `);

  // 2. All transfers OUT from eligible batches during period
  const tOut = await db.execute(sql`
    SELECT t.id, t.source_batch_id, t.destination_batch_id,
           CAST(t.volume_transferred AS TEXT) as vol,
           CAST(COALESCE(t.loss, 0) AS TEXT) as loss,
           t.transferred_at,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           db2.custom_name as dst_name, db2.batch_number as dst_batch
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
    WHERE t.source_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= ${START}::date
      AND t.transferred_at < (${END}::date + interval '1 day')
    ORDER BY t.transferred_at
  `);

  // 3. Batch-to-batch merges IN (source_type = 'batch_transfer')
  const mIn = await db.execute(sql`
    SELECT bmh.id, bmh.source_batch_id, bmh.target_batch_id,
           CAST(bmh.volume_added AS TEXT) as vol,
           bmh.merged_at, bmh.source_type,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           tb.custom_name as tgt_name, tb.batch_number as tgt_batch
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
    LEFT JOIN batches tb ON bmh.target_batch_id = tb.id
    WHERE bmh.target_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND bmh.deleted_at IS NULL
      AND bmh.source_type = 'batch_transfer'
      AND bmh.merged_at >= ${START}::date
      AND bmh.merged_at < (${END}::date + interval '1 day')
    ORDER BY bmh.merged_at
  `);

  // 4. All merges OUT from eligible batches
  const mOut = await db.execute(sql`
    SELECT bmh.id, bmh.source_batch_id, bmh.target_batch_id,
           CAST(bmh.volume_added AS TEXT) as vol,
           CAST(bmh.volume_added AS TEXT) as vol_out,
           bmh.merged_at, bmh.source_type,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           tb.custom_name as tgt_name, tb.batch_number as tgt_batch
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
    LEFT JOIN batches tb ON bmh.target_batch_id = tb.id
    WHERE bmh.source_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND bmh.deleted_at IS NULL
      AND bmh.merged_at >= ${START}::date
      AND bmh.merged_at < (${END}::date + interval '1 day')
    ORDER BY bmh.merged_at
  `);

  // Analyze transfers
  const tInRows = tIn.rows as any[];
  const tOutRows = tOut.rows as any[];
  let totalTInL = 0, totalTOutL = 0;

  console.log("=== TRANSFERS IN (to eligible batches) ===");
  const tInUnmatched: any[] = [];
  for (const t of tInRows) {
    const vol = parseFloat(t.vol);
    totalTInL += vol;
    const srcInEligible = eligibleIds.has(t.source_batch_id);
    if (!srcInEligible) {
      tInUnmatched.push(t);
    }
  }
  console.log(`Total transfers IN: ${tInRows.length} transfers, ${(totalTInL / L_PER_GAL).toFixed(1)} gal (${totalTInL.toFixed(1)}L)`);

  console.log(`\nTransfers IN from OUTSIDE eligible set (${tInUnmatched.length}):`);
  let unmatchedInL = 0;
  for (const t of tInUnmatched) {
    const vol = parseFloat(t.vol);
    unmatchedInL += vol;
    console.log(`  ${t.src_name || t.src_batch || 'NULL'} → ${t.dst_name || t.dst_batch} | ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal) | ${t.transferred_at}`);
  }
  console.log(`  Unmatched IN total: ${unmatchedInL.toFixed(1)}L (${(unmatchedInL / L_PER_GAL).toFixed(1)} gal)`);

  console.log("\n=== TRANSFERS OUT (from eligible batches) ===");
  const tOutUnmatched: any[] = [];
  for (const t of tOutRows) {
    const vol = parseFloat(t.vol);
    totalTOutL += vol;
    const dstInEligible = eligibleIds.has(t.destination_batch_id);
    if (!dstInEligible) {
      tOutUnmatched.push(t);
    }
  }
  console.log(`Total transfers OUT: ${tOutRows.length} transfers, ${(totalTOutL / L_PER_GAL).toFixed(1)} gal (${totalTOutL.toFixed(1)}L)`);

  console.log(`\nTransfers OUT to OUTSIDE eligible set (${tOutUnmatched.length}):`);
  let unmatchedOutL = 0;
  for (const t of tOutUnmatched) {
    const vol = parseFloat(t.vol);
    unmatchedOutL += vol;
    console.log(`  ${t.src_name || t.src_batch} → ${t.dst_name || t.dst_batch || 'NULL/deleted'} | ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal) | ${t.transferred_at}`);
  }
  console.log(`  Unmatched OUT total: ${unmatchedOutL.toFixed(1)}L (${(unmatchedOutL / L_PER_GAL).toFixed(1)} gal)`);

  // Analyze merges
  const mInRows = mIn.rows as any[];
  const mOutRows = mOut.rows as any[];
  let totalMInL = 0, totalMOutL = 0;

  console.log("\n=== BATCH-TO-BATCH MERGES IN ===");
  for (const m of mInRows) {
    const vol = parseFloat(m.vol);
    totalMInL += vol;
    const srcInEligible = m.source_batch_id ? eligibleIds.has(m.source_batch_id) : false;
    const marker = srcInEligible ? "" : " [SOURCE OUTSIDE SET]";
    console.log(`  ${m.src_name || m.src_batch || 'N/A'} → ${m.tgt_name || m.tgt_batch} | ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal)${marker}`);
  }
  console.log(`Total batch-to-batch merges IN: ${(totalMInL / L_PER_GAL).toFixed(1)} gal (${totalMInL.toFixed(1)}L)`);

  console.log("\n=== MERGES OUT ===");
  for (const m of mOutRows) {
    const vol = parseFloat(m.vol_out || m.vol);
    totalMOutL += vol;
    const tgtInEligible = m.target_batch_id ? eligibleIds.has(m.target_batch_id) : false;
    const marker = tgtInEligible ? "" : " [TARGET OUTSIDE SET]";
    console.log(`  ${m.src_name || m.src_batch} → ${m.tgt_name || m.tgt_batch || 'N/A'} | ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal) | type=${m.source_type}${marker}`);
  }
  console.log(`Total merges OUT: ${(totalMOutL / L_PER_GAL).toFixed(1)} gal (${totalMOutL.toFixed(1)}L)`);

  // Summary
  const netTransfersL = totalTInL - totalTOutL;
  const netMergesL = totalMInL - totalMOutL;
  const netInternalL = netTransfersL + netMergesL;

  console.log("\n\n=== SUMMARY ===");
  console.log(`Transfers: IN ${(totalTInL / L_PER_GAL).toFixed(1)} - OUT ${(totalTOutL / L_PER_GAL).toFixed(1)} = net ${(netTransfersL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`Merges:    IN ${(totalMInL / L_PER_GAL).toFixed(1)} - OUT ${(totalMOutL / L_PER_GAL).toFixed(1)} = net ${(netMergesL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`Total net internal: ${(netInternalL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`\nAsymmetry from transfers: IN unmatched ${(unmatchedInL / L_PER_GAL).toFixed(1)} gal, OUT unmatched ${(unmatchedOutL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`Net transfer asymmetry: ${((unmatchedInL - unmatchedOutL) / L_PER_GAL).toFixed(1)} gal`);

  // Also show: transfers where source started DURING the period (new batch transferring = production, not internal)
  console.log("\n\n=== TRANSFERS WHERE SOURCE IS A NEW 2025 BATCH ===");
  console.log("(These represent freshly produced cider being moved to another vessel — arguably production, not internal)");
  for (const t of tInRows) {
    // Find if source batch started in 2025
    const srcBatch = (eligible.rows as any[]).find(b => b.id === t.source_batch_id);
    if (srcBatch) {
      const startDate = srcBatch.start_date?.toISOString?.().slice(0, 10) || String(srcBatch.start_date);
      if (startDate >= START) {
        const vol = parseFloat(t.vol);
        const isTransferDerived = srcBatch.parent_batch_id && parseFloat(srcBatch.init_vol) === 0;
        console.log(`  ${t.src_name || t.src_batch} → ${t.dst_name || t.dst_batch} | ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal) | src started ${startDate} | transferDerived=${!!isTransferDerived}`);
      }
    }
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
