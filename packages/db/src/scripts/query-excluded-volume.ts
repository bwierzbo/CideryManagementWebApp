import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  const batches = await db.execute(sql.raw(`
    WITH transfers_in AS (
      SELECT bt.destination_batch_id as batch_id,
             COALESCE(SUM(bt.volume_transferred::numeric), 0) as total_in
      FROM batch_transfers bt
      WHERE bt.deleted_at IS NULL
      GROUP BY bt.destination_batch_id
    ),
    transfers_out AS (
      SELECT bt.source_batch_id as batch_id,
             COALESCE(SUM(bt.volume_transferred::numeric), 0) as total_out
      FROM batch_transfers bt
      WHERE bt.deleted_at IS NULL
      GROUP BY bt.source_batch_id
    ),
    bottle_out AS (
      SELECT br.batch_id,
             COALESCE(SUM(br.volume_taken_liters::numeric), 0) as total_bottled
      FROM bottle_runs br
      WHERE br.voided_at IS NULL
      GROUP BY br.batch_id
    ),
    keg_out AS (
      SELECT kf.batch_id,
             COALESCE(SUM(
               CASE WHEN kf.volume_taken_unit = 'gal' 
                    THEN kf.volume_taken::numeric * 3.78541 
                    ELSE kf.volume_taken::numeric END
             ), 0) as total_kegged
      FROM keg_fills kf
      WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL
      GROUP BY kf.batch_id
    ),
    distill AS (
      SELECT dr.source_batch_id as batch_id,
             COALESCE(SUM(dr.source_volume_liters::numeric), 0) as total_distilled
      FROM distillation_records dr
      WHERE dr.deleted_at IS NULL
      GROUP BY dr.source_batch_id
    )
    SELECT b.id, b.custom_name, b.product_type, b.reconciliation_status,
           b.initial_volume_liters::numeric as initial_vol,
           b.current_volume_liters::numeric as current_vol,
           b.status,
           COALESCE(ti.total_in, 0) as transfers_in,
           COALESCE(tout.total_out, 0) as transfers_out,
           COALESCE(bo.total_bottled, 0) as bottled,
           COALESCE(ko.total_kegged, 0) as kegged,
           COALESCE(d.total_distilled, 0) as distilled
    FROM batches b
    LEFT JOIN transfers_in ti ON ti.batch_id = b.id
    LEFT JOIN transfers_out tout ON tout.batch_id = b.id
    LEFT JOIN bottle_out bo ON bo.batch_id = b.id
    LEFT JOIN keg_out ko ON ko.batch_id = b.id
    LEFT JOIN distill d ON d.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.reconciliation_status IN ('duplicate', 'excluded')
    ORDER BY b.product_type, b.reconciliation_status, b.custom_name
  `));

  console.log('=== EXCLUDED/DUPLICATE BATCHES — Volume Not in Ending Balance ===\n');

  const taxClassMap: Record<string, string> = {
    'cider': 'hardCider', 'perry': 'hardCider',
    'wine': 'wineUnder16', 'pommeau': 'wine16To21',
    'brandy': 'appleBrandy', 'juice': 'juice'
  };

  const byClass: Record<string, { 
    currentVol: number; 
    initialVol: number;
    totalIn: number;
    totalRemoved: number;
    batchCount: number;
  }> = {};

  for (const r of batches.rows as any[]) {
    const initial = parseFloat(r.initial_vol);
    const current = parseFloat(r.current_vol);
    const xferIn = parseFloat(r.transfers_in);
    const xferOut = parseFloat(r.transfers_out);
    const bottled = parseFloat(r.bottled);
    const kegged = parseFloat(r.kegged);
    const distilled = parseFloat(r.distilled);
    const type = r.product_type as string;
    const tc = taxClassMap[type] || 'unknown';

    if (!byClass[tc]) {
      byClass[tc] = { currentVol: 0, initialVol: 0, totalIn: 0, totalRemoved: 0, batchCount: 0 };
    }
    byClass[tc].currentVol += current;
    byClass[tc].initialVol += initial;
    byClass[tc].totalIn += initial + xferIn;
    byClass[tc].totalRemoved += xferOut + bottled + kegged + distilled;
    byClass[tc].batchCount += 1;

    console.log(`${r.custom_name} [${type}, ${r.reconciliation_status}]:`);
    console.log(`  init=${initial.toFixed(1)}L, xferIn=${xferIn.toFixed(1)}L, xferOut=${xferOut.toFixed(1)}L`);
    console.log(`  bottled=${bottled.toFixed(1)}L, kegged=${kegged.toFixed(1)}L, distilled=${distilled.toFixed(1)}L`);
    console.log(`  current=${current.toFixed(1)}L (${(current * 0.264172).toFixed(1)}gal) — this volume is NOT in Line 31`);
    console.log();
  }

  console.log('\n========== SUMMARY: Volume in Excluded/Duplicate Batches ==========\n');
  console.log('These batches have current_volume that is NOT counted in Line 31 (ending).');
  console.log('But their production (initial) and packaging (bottled/kegged) may be in other lines.\n');

  for (const [tc, data] of Object.entries(byClass)) {
    console.log(`${tc}:`);
    console.log(`  Current volume (not in ending): ${data.currentVol.toFixed(1)}L (${(data.currentVol * 0.264172).toFixed(1)} gal)`);
    console.log(`  Initial volume: ${data.initialVol.toFixed(1)}L (${(data.initialVol * 0.264172).toFixed(1)} gal)`);
    console.log(`  Total volume in: ${data.totalIn.toFixed(1)}L (${(data.totalIn * 0.264172).toFixed(1)} gal)`);
    console.log(`  Total volume removed: ${data.totalRemoved.toFixed(1)}L (${(data.totalRemoved * 0.264172).toFixed(1)} gal)`);
    console.log(`  Batch count: ${data.batchCount}`);
    console.log();
  }

  // Also check: how much of the production figure comes from excluded/duplicate batches?
  const exclDupIds = (batches.rows as any[]).map(r => `'${r.id}'`).join(',');
  
  if (exclDupIds) {
    const pressToExcl = await db.execute(sql.raw(`
      SELECT b.custom_name, b.product_type, b.reconciliation_status,
             COALESCE(SUM(COALESCE(bmh.volume_added, 0)::numeric), 0) as merged_vol
      FROM batch_merge_history bmh
      JOIN batches b ON bmh.target_batch_id = b.id
      WHERE bmh.deleted_at IS NULL
        AND bmh.target_batch_id IN (${exclDupIds})
        AND (bmh.source_press_run_id IS NOT NULL OR bmh.source_juice_purchase_item_id IS NOT NULL)
      GROUP BY b.id, b.custom_name, b.product_type, b.reconciliation_status
      ORDER BY b.product_type, b.custom_name
    `));

    console.log('\n=== Press run / juice purchase production going to excluded/duplicate batches ===');
    for (const r of pressToExcl.rows as any[]) {
      const vol = parseFloat(r.merged_vol);
      console.log(`  ${r.custom_name} [${r.product_type}, ${r.reconciliation_status}]: ${vol.toFixed(1)}L (${(vol * 0.264172).toFixed(1)} gal) from press/juice`);
    }
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
