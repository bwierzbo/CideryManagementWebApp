import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Find ALL batches with "Calvados" in name
  const calvados = await db.execute(sql`
    SELECT id, name, custom_name, product_type, initial_volume_liters, current_volume_liters,
           start_date, reconciliation_status, parent_batch_id, deleted_at
    FROM batches WHERE (name ILIKE '%calvados%' OR custom_name ILIKE '%calvados%')
    ORDER BY start_date
  `);
  console.log("=== All Calvados batches ===");
  for (const r of calvados.rows) {
    console.log(`  ${r.custom_name || r.name} (${r.product_type}): id=${r.id}, init=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)}, cur=${(Number(r.current_volume_liters)/3.78541).toFixed(1)}, start=${r.start_date}, status=${r.reconciliation_status}, deleted=${r.deleted_at ? 'YES' : 'no'}`);
  }
  
  // Find the merge target batch for the juice_purchase merges
  const mergeTargets = await db.execute(sql`
    SELECT DISTINCT bmh.target_batch_id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.reconciliation_status, b.start_date, b.deleted_at
    FROM batch_merge_history bmh
    JOIN batches b ON b.id = bmh.target_batch_id
    WHERE bmh.source_type = 'juice_purchase' AND bmh.deleted_at IS NULL
      AND bmh.merged_at::date <= '2024-12-31'
  `);
  console.log("\n=== Juice purchase merge target batch ===");
  for (const r of mergeTargets.rows) {
    console.log(`  ${r.name} (${r.product_type}): id=${r.target_batch_id}, init=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)}, status=${r.reconciliation_status}, start=${r.start_date}, deleted=${r.deleted_at ? 'YES' : 'no'}`);
  }

  // Find ALL batches with brandy product type
  const brandy = await db.execute(sql`
    SELECT id, name, custom_name, product_type, initial_volume_liters, current_volume_liters,
           start_date, reconciliation_status, deleted_at
    FROM batches WHERE product_type = 'brandy'
    ORDER BY start_date
  `);
  console.log("\n=== All brandy batches ===");
  for (const r of brandy.rows) {
    console.log(`  ${r.custom_name || r.name} (${r.product_type}): id=${r.id}, init=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)}, cur=${(Number(r.current_volume_liters)/3.78541).toFixed(1)}, status=${r.reconciliation_status}, deleted=${r.deleted_at ? 'YES' : 'no'}`);
  }
  
  // Find the "blend-2025-10-31" batch that transferred to Salish in 2024
  const weirdTransfer = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type, b.start_date,
           b.initial_volume_liters, b.reconciliation_status, b.deleted_at
    FROM batches b WHERE b.name ILIKE '%2025-10-31%'
  `);
  console.log("\n=== 'blend-2025-10-31' batch ===");
  for (const r of weirdTransfer.rows) {
    console.log(`  ${r.name}: type=${r.product_type}, start=${r.start_date}, init=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)}, status=${r.reconciliation_status}, deleted=${r.deleted_at ? 'YES' : 'no'}`);
  }
  
  // Now: for ALL batches in the 2024 set, compute a COMPREHENSIVE ending
  // including BOTH transfers AND merges
  const batches = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.start_date, b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.start_date <= '2024-12-31'::timestamptz
      AND b.reconciliation_status IN ('verified', 'pending')
    ORDER BY b.product_type, b.start_date
  `);
  
  let totalEndingByType: Record<string, {ending: number, production: number}> = {};
  
  for (const batch of batches.rows) {
    const bId = batch.id as string;
    const initial = Number(batch.initial_volume_liters);
    const pt = batch.product_type as string;
    
    if (!totalEndingByType[pt]) totalEndingByType[pt] = {ending: 0, production: 0};
    
    // ALL merges in (including juice_purchase, press_run, batch_transfer)
    const allMergesIn = await db.execute(sql`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as total, source_type
      FROM batch_merge_history WHERE target_batch_id = ${bId} AND deleted_at IS NULL
        AND merged_at::date <= '2024-12-31'
      GROUP BY source_type
    `);
    let totalMergesIn = 0;
    let pressMerges = 0;
    let juiceMerges = 0;
    let batchMerges = 0;
    for (const m of allMergesIn.rows) {
      const vol = Number(m.total);
      totalMergesIn += vol;
      if (m.source_type === 'press_run') pressMerges += vol;
      else if (m.source_type === 'juice_purchase') juiceMerges += vol;
      else if (m.source_type === 'batch_transfer') batchMerges += vol;
    }
    
    // ALL transfers in
    const tIn = await db.execute(sql`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers WHERE destination_batch_id = ${bId} AND deleted_at IS NULL
        AND transferred_at::date <= '2024-12-31'
    `);
    const tOut = await db.execute(sql`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total,
             COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) as loss_total
      FROM batch_transfers WHERE source_batch_id = ${bId} AND deleted_at IS NULL
        AND transferred_at::date <= '2024-12-31'
    `);
    const mOut = await db.execute(sql`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as total
      FROM batch_merge_history WHERE source_batch_id = ${bId} AND deleted_at IS NULL
        AND merged_at::date <= '2024-12-31'
    `);
    const adj = await db.execute(sql`
      SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as total
      FROM batch_volume_adjustments WHERE batch_id = ${bId} AND deleted_at IS NULL
        AND adjustment_date::date <= '2024-12-31'
    `);
    
    const ending = initial + totalMergesIn + Number(tIn.rows[0].total)
      - Number(tOut.rows[0].total) - Number(tOut.rows[0].loss_total)
      - Number(mOut.rows[0].total) + Number(adj.rows[0].total);
    
    // SBD production = initial (for new batches) + pressMerges + juiceMerges + batchMerges
    const sbdProduction = initial + pressMerges + juiceMerges + batchMerges;
    
    totalEndingByType[pt].ending += ending;
    totalEndingByType[pt].production += sbdProduction;
    
    if (totalMergesIn > 0.01 || (Math.abs(ending / 3.78541) > 0.05 && juiceMerges > 0)) {
      console.log(`\n  ${batch.name} (${pt}): init=${(initial/3.78541).toFixed(1)}, mergesIn=${(totalMergesIn/3.78541).toFixed(1)} [press=${(pressMerges/3.78541).toFixed(1)}, juice=${(juiceMerges/3.78541).toFixed(1)}, batch=${(batchMerges/3.78541).toFixed(1)}], tIn=${(Number(tIn.rows[0].total)/3.78541).toFixed(1)}, tOut=${(Number(tOut.rows[0].total)/3.78541).toFixed(1)}, mOut=${(Number(mOut.rows[0].total)/3.78541).toFixed(1)}, adj=${(Number(adj.rows[0].total)/3.78541).toFixed(1)}, ending=${(ending/3.78541).toFixed(1)}`);
    }
  }
  
  console.log("\n=== TOTAL BY TYPE ===");
  let grandEndingL = 0;
  let grandProductionL = 0;
  for (const [type, vals] of Object.entries(totalEndingByType)) {
    console.log(`  ${type}: production=${(vals.production/3.78541).toFixed(1)}, ending=${(vals.ending/3.78541).toFixed(1)} gal`);
    grandEndingL += vals.ending;
    grandProductionL += vals.production;
  }
  console.log(`  TOTAL: production=${(grandProductionL/3.78541).toFixed(1)}, ending=${(grandEndingL/3.78541).toFixed(1)} gal`);
  console.log(`  Page shows: production=1170.4, ending=1175.2 gal`);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
