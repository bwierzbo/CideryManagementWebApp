import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  const s1id = '3e6780db-39ff-4a61-9645-a8e9505f2620';

  // Full Salish #1 record
  const batch = await db.execute(sql.raw(`
    SELECT b.*, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.id = '${s1id}'
  `));
  const b = batch.rows[0] as any;
  console.log('=== Salish 2025 #1 Full Record ===');
  for (const [k, val] of Object.entries(b)) {
    if (val !== null && val !== undefined) console.log(`  ${k}: ${val}`);
  }

  // Batch volume adjustments for Salish #1
  const adj = await db.execute(sql.raw(`
    SELECT * FROM batch_volume_adjustments
    WHERE batch_id = '${s1id}' AND deleted_at IS NULL
    ORDER BY adjustment_date
  `));
  console.log('\n=== Salish #1 Volume Adjustments ===');
  if (adj.rows.length === 0) console.log('  (none)');
  for (const r of adj.rows as any[]) {
    console.log(JSON.stringify(r, null, 2));
  }

  // Transfers INTO Salish #1
  const xfersIn = await db.execute(sql.raw(`
    SELECT bt.volume_transferred::numeric as vol, bt.transferred_at, bt.notes,
           sb.id as src_id, sb.custom_name as src_name, sb.product_type as src_type,
           COALESCE(sb.actual_abv, sb.estimated_abv)::numeric as src_abv
    FROM batch_transfers bt
    JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = '${s1id}'
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));
  console.log('\n=== Transfers INTO Salish #1 ===');
  if (xfersIn.rows.length === 0) console.log('  (none)');
  for (const r of xfersIn.rows as any[]) {
    const vol = parseFloat(r.vol);
    const abv = r.src_abv ? parseFloat(r.src_abv).toFixed(2) : 'null';
    console.log(`  ${r.src_name} [${r.src_type}, ABV=${abv}]: ${vol.toFixed(1)}L (${(vol * 0.264172).toFixed(1)}gal)`);
    if (r.notes) console.log(`    notes: ${r.notes}`);
  }

  // Also check transfers where source may be soft-deleted
  const xfersInAll = await db.execute(sql.raw(`
    SELECT bt.volume_transferred::numeric as vol, bt.transferred_at, bt.notes,
           sb.id as src_id, sb.custom_name as src_name, sb.product_type as src_type,
           sb.deleted_at as src_deleted
    FROM batch_transfers bt
    LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = '${s1id}'
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));
  console.log('\n=== ALL Transfers INTO Salish #1 (including deleted sources) ===');
  if (xfersInAll.rows.length === 0) console.log('  (none)');
  for (const r of xfersInAll.rows as any[]) {
    console.log(`  ${r.src_name || '(unknown)'}: ${parseFloat(r.vol).toFixed(1)}L, deleted=${r.src_deleted}`);
  }

  // Merges INTO Salish #1
  const mergesIn = await db.execute(sql.raw(`
    SELECT COALESCE(bmh.volume_added, 0)::numeric as vol, bmh.merged_at,
           bmh.source_abv::numeric as merge_src_abv,
           bmh.source_type,
           sb.custom_name as src_name, sb.product_type as src_type,
           COALESCE(sb.actual_abv, sb.estimated_abv)::numeric as src_abv,
           bmh.source_press_run_id, bmh.source_juice_purchase_item_id, bmh.source_batch_id
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
    WHERE bmh.target_batch_id = '${s1id}'
      AND bmh.deleted_at IS NULL
    ORDER BY bmh.merged_at
  `));
  console.log('\n=== Merges INTO Salish #1 ===');
  if (mergesIn.rows.length === 0) console.log('  (none)');
  for (const r of mergesIn.rows as any[]) {
    const vol = parseFloat(r.vol);
    const abv = r.src_abv ? parseFloat(r.src_abv).toFixed(2) : (r.merge_src_abv ? parseFloat(r.merge_src_abv).toFixed(2) : 'null');
    const srcName = r.src_name || r.source_type || `press_run=${r.source_press_run_id}`;
    console.log(`  ${srcName} [ABV=${abv}]: ${vol.toFixed(1)}L (${(vol * 0.264172).toFixed(1)}gal), date=${r.merged_at}`);
  }

  // Batch compositions
  const comps = await db.execute(sql.raw(`
    SELECT * FROM batch_compositions
    WHERE batch_id = '${s1id}'
    ORDER BY created_at
  `));
  console.log('\n=== Salish #1 Batch Compositions ===');
  if (comps.rows.length === 0) console.log('  (none)');
  for (const r of comps.rows as any[]) {
    console.log(JSON.stringify(r, null, 2));
  }

  // SOURCE BATCH DETAILS
  console.log('\n========== SOURCE BATCH DETAILS ==========');
  const sources = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.product_type, b.status,
           b.initial_volume_liters::numeric as init,
           b.current_volume_liters::numeric as cur,
           COALESCE(b.actual_abv, b.estimated_abv)::numeric as abv,
           b.reconciliation_status, b.parent_batch_id, b.created_at
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND (b.custom_name ILIKE '%Mix for Salish%'
           OR b.custom_name ILIKE '%Melrose%'
           OR b.custom_name = 'Jonathan #1')
    ORDER BY b.custom_name
  `));

  for (const r of sources.rows as any[]) {
    const abv = r.abv ? parseFloat(r.abv).toFixed(2) : 'null';
    console.log(`\n${r.custom_name} [${r.product_type}]:`);
    console.log(`  id=${r.id}`);
    console.log(`  ABV=${abv}%, init=${parseFloat(r.init).toFixed(1)}L, cur=${parseFloat(r.cur).toFixed(1)}L`);
    console.log(`  status=${r.status}, recon=${r.reconciliation_status}`);
    console.log(`  created=${r.created_at}, parentBatchId=${r.parent_batch_id}`);
  }

  // Jonathan #1 measurements
  const j1 = (sources.rows as any[]).find((r: any) => r.custom_name === 'Jonathan #1');
  if (j1) {
    const meas = await db.execute(sql.raw(`
      SELECT bm.measurement_date, bm.gravity::numeric as gravity, bm.temperature::numeric as temp,
             bm.notes, bm.measurement_type
      FROM batch_measurements bm
      WHERE bm.batch_id = '${j1.id}'
        AND bm.deleted_at IS NULL
      ORDER BY bm.measurement_date
    `));

    console.log('\n=== Jonathan #1 Measurement History ===');
    if (meas.rows.length === 0) console.log('  (none)');
    for (const r of meas.rows as any[]) {
      const grav = r.gravity ? parseFloat(r.gravity).toFixed(4) : 'null';
      console.log(`  ${r.measurement_date}: gravity=${grav}, type=${r.measurement_type || 'n/a'}`);
      if (r.notes) console.log(`    notes: ${r.notes}`);
    }

    // Jonathan #1 transfers out
    const j1Xfers = await db.execute(sql.raw(`
      SELECT bt.volume_transferred::numeric as vol, bt.transferred_at, bt.notes,
             db.custom_name as dst_name, db.product_type as dst_type
      FROM batch_transfers bt
      JOIN batches db ON bt.destination_batch_id = db.id
      WHERE bt.source_batch_id = '${j1.id}'
        AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at
    `));

    console.log('\n=== Jonathan #1 Transfers OUT ===');
    if (j1Xfers.rows.length === 0) console.log('  (none)');
    for (const r of j1Xfers.rows as any[]) {
      console.log(`  -> ${r.dst_name} [${r.dst_type}]: ${parseFloat(r.vol).toFixed(1)}L, date=${r.transferred_at}`);
      if (r.notes) console.log(`    notes: ${r.notes}`);
    }

    // Jonathan #1 volume sources
    const j1Merges = await db.execute(sql.raw(`
      SELECT COALESCE(bmh.volume_added, 0)::numeric as vol, bmh.merged_at,
             CASE
               WHEN bmh.source_press_run_id IS NOT NULL THEN 'press_run'
               WHEN bmh.source_juice_purchase_item_id IS NOT NULL THEN 'juice_purchase'
               WHEN bmh.source_batch_id IS NOT NULL THEN 'batch'
             END as source_type
      FROM batch_merge_history bmh
      WHERE bmh.target_batch_id = '${j1.id}'
        AND bmh.deleted_at IS NULL
      ORDER BY bmh.merged_at
    `));

    console.log('\n=== Jonathan #1 Volume Sources (merges in) ===');
    if (j1Merges.rows.length === 0) console.log('  (none)');
    for (const r of j1Merges.rows as any[]) {
      console.log(`  ${r.source_type}: ${parseFloat(r.vol).toFixed(1)}L, date=${r.merged_at}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
