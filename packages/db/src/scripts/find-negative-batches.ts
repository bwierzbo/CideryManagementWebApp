import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const RECONCILIATION_DATE = '2025-12-31';
const END_DATE = `'${RECONCILIATION_DATE}'::date + INTERVAL '1 day'`;

async function findNegativeBatches() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  console.log('Connected.\n');

  // Get all eligible batches (same filter as computeSystemCalculatedOnHand)
  const batchRows = await client.query(`
    SELECT id, name, initial_volume_liters, parent_batch_id, current_volume_liters, product_type
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND start_date <= '${RECONCILIATION_DATE}'::date
    ORDER BY name
  `);

  const batchIds = batchRows.rows.map(b => b.id);
  if (batchIds.length === 0) {
    console.log('No eligible batches found.');
    client.release(); await pool.end(); return;
  }

  const idList = batchIds.map(id => `'${id}'`).join(',');

  // Transfers OUT
  const tOut = await client.query(`
    SELECT source_batch_id, volume_transferred, loss
    FROM batch_transfers
    WHERE source_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND transferred_at < ${END_DATE}
  `);

  // Transfers IN
  const tIn = await client.query(`
    SELECT destination_batch_id, volume_transferred
    FROM batch_transfers
    WHERE destination_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND transferred_at < ${END_DATE}
  `);

  // Merges IN
  const mIn = await client.query(`
    SELECT target_batch_id, volume_added
    FROM batch_merge_history
    WHERE target_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND merged_at < ${END_DATE}
  `);

  // Merges OUT
  const mOut = await client.query(`
    SELECT source_batch_id, volume_added AS volume_merged_out
    FROM batch_merge_history
    WHERE source_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND merged_at < ${END_DATE}
  `);

  // Bottle runs
  const bottles = await client.query(`
    SELECT batch_id, volume_taken_liters, loss, units_produced, package_size_ml
    FROM bottle_runs
    WHERE batch_id IN (${idList})
      AND voided_at IS NULL
      AND packaged_at < ${END_DATE}
  `);

  // Keg fills
  const kegs = await client.query(`
    SELECT batch_id, volume_taken, loss
    FROM keg_fills
    WHERE batch_id IN (${idList})
      AND voided_at IS NULL
      AND deleted_at IS NULL
      AND filled_at < ${END_DATE}
  `);

  // Distillation
  const dist = await client.query(`
    SELECT source_batch_id, source_volume_liters
    FROM distillation_records
    WHERE source_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND status IN ('sent', 'received')
      AND sent_at < ${END_DATE}
  `);

  // Volume adjustments
  const adjs = await client.query(`
    SELECT batch_id, adjustment_amount
    FROM batch_volume_adjustments
    WHERE batch_id IN (${idList})
      AND deleted_at IS NULL
      AND adjustment_date < ${END_DATE}
  `);

  // Racking losses
  const racks = await client.query(`
    SELECT batch_id, volume_loss
    FROM batch_racking_operations
    WHERE batch_id IN (${idList})
      AND deleted_at IS NULL
      AND racked_at < ${END_DATE}
      AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
  `);

  // Filter losses
  const filters = await client.query(`
    SELECT batch_id, volume_loss
    FROM batch_filter_operations
    WHERE batch_id IN (${idList})
      AND deleted_at IS NULL
      AND filtered_at < ${END_DATE}
  `);

  // Group by helper
  function groupBy(rows: any[], key: string): Map<string, any[]> {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const id = r[key];
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(r);
    }
    return map;
  }

  const transfersOutByBatch = groupBy(tOut.rows, 'source_batch_id');
  const transfersInByBatch = groupBy(tIn.rows, 'destination_batch_id');
  const mergesInByBatch = groupBy(mIn.rows, 'target_batch_id');
  const mergesOutByBatch = groupBy(mOut.rows, 'source_batch_id');
  const bottlesByBatch = groupBy(bottles.rows, 'batch_id');
  const kegsByBatch = groupBy(kegs.rows, 'batch_id');
  const distByBatch = groupBy(dist.rows, 'source_batch_id');
  const adjsByBatch = groupBy(adjs.rows, 'batch_id');
  const racksByBatch = groupBy(racks.rows, 'batch_id');
  const filtersByBatch = groupBy(filters.rows, 'batch_id');

  const num = (v: any) => parseFloat(v || '0') || 0;

  const negativeBatches: any[] = [];
  let totalClamped = 0;
  let totalUnclamped = 0;
  let totalCurrent = 0;

  for (const batch of batchRows.rows) {
    const batchId = batch.id;
    const initial = num(batch.initial_volume_liters);
    const parentId = batch.parent_batch_id;
    const currentVol = num(batch.current_volume_liters);

    const transfersIn = (transfersInByBatch.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_transferred), 0);
    const transfersOut = (transfersOutByBatch.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_transferred), 0);
    const transferLoss = (transfersOutByBatch.get(batchId) || []).reduce((s: number, r: any) => s + num(r.loss), 0);
    const mergesIn = (mergesInByBatch.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_added), 0);
    const mergesOut = (mergesOutByBatch.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_merged_out), 0);

    const bottlingVol = (bottlesByBatch.get(batchId) || []).reduce((s: number, b: any) => s + num(b.volume_taken_liters), 0);
    const bottlingLoss = (bottlesByBatch.get(batchId) || []).reduce((s: number, b: any) => {
      const volumeTaken = num(b.volume_taken_liters);
      const lossVal = num(b.loss);
      const productVol = ((b.units_produced || 0) * (b.package_size_ml || 0)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVol + lossVal)) < 2;
      return s + (lossIncluded ? 0 : lossVal);
    }, 0);

    const kegging = (kegsByBatch.get(batchId) || []).reduce((s: number, k: any) => s + num(k.volume_taken), 0);
    const keggingLoss = (kegsByBatch.get(batchId) || []).reduce((s: number, k: any) => s + num(k.loss), 0);
    const distillation = (distByBatch.get(batchId) || []).reduce((s: number, d: any) => s + num(d.source_volume_liters), 0);
    const adjustments = (adjsByBatch.get(batchId) || []).reduce((s: number, a: any) => s + num(a.adjustment_amount), 0);
    const rackingLoss = (racksByBatch.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_loss), 0);
    const filterLoss = (filtersByBatch.get(batchId) || []).reduce((s: number, f: any) => s + num(f.volume_loss), 0);

    const isTransferCreated = parentId && transfersIn >= initial * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : initial;

    const ending = effectiveInitial + mergesIn - mergesOut + transfersIn
      - transfersOut - transferLoss
      - bottlingVol - bottlingLoss
      - kegging - keggingLoss
      - distillation
      + adjustments
      - rackingLoss - filterLoss;

    const clamped = Math.max(0, ending);
    totalClamped += clamped;
    totalUnclamped += ending;
    totalCurrent += currentVol;

    if (ending < -0.01) {
      negativeBatches.push({
        name: batch.name,
        productType: batch.product_type,
        initial,
        effectiveInitial,
        isTransferCreated: !!isTransferCreated,
        parentId: parentId ? 'yes' : 'no',
        transfersIn: +transfersIn.toFixed(2),
        transfersOut: +transfersOut.toFixed(2),
        transferLoss: +transferLoss.toFixed(2),
        mergesIn: +mergesIn.toFixed(2),
        mergesOut: +mergesOut.toFixed(2),
        bottlingVol: +bottlingVol.toFixed(2),
        bottlingLoss: +bottlingLoss.toFixed(2),
        kegging: +kegging.toFixed(2),
        keggingLoss: +keggingLoss.toFixed(2),
        distillation: +distillation.toFixed(2),
        adjustments: +adjustments.toFixed(2),
        rackingLoss: +rackingLoss.toFixed(2),
        filterLoss: +filterLoss.toFixed(2),
        ending: +ending.toFixed(2),
        currentVolumeLiters: +currentVol.toFixed(2),
        clampedLoss: +Math.abs(ending).toFixed(2),
      });
    }
  }

  console.log(`Total batches: ${batchRows.rows.length}`);
  console.log(`Total unclamped (liters): ${totalUnclamped.toFixed(2)}`);
  console.log(`Total clamped   (liters): ${totalClamped.toFixed(2)}`);
  console.log(`Total current   (liters): ${totalCurrent.toFixed(2)}`);
  console.log(`Clamped loss    (liters): ${(totalClamped - totalUnclamped).toFixed(2)}`);
  console.log(`Clamped loss   (gallons): ${((totalClamped - totalUnclamped) / 3.78541).toFixed(2)}`);
  console.log();

  if (negativeBatches.length === 0) {
    console.log('No batches with negative reconstructed volume!');
  } else {
    console.log(`${negativeBatches.length} batches with NEGATIVE reconstructed volume:\n`);
    for (const b of negativeBatches) {
      console.log(`--- ${b.name} ---`);
      console.log(`  Product type: ${b.productType}`);
      console.log(`  Has parent: ${b.parentId}, Transfer-created: ${b.isTransferCreated}`);
      console.log(`  Initial: ${b.initial}L, Effective initial: ${b.effectiveInitial}L`);
      console.log(`  Inflows:  transfers=${b.transfersIn}L, merges=${b.mergesIn}L`);
      console.log(`  Outflows: transfers=${b.transfersOut}L, merges=${b.mergesOut}L, tLoss=${b.transferLoss}L`);
      console.log(`  Packaging: bottling=${b.bottlingVol}L (loss=${b.bottlingLoss}L), kegging=${b.kegging}L (loss=${b.keggingLoss}L)`);
      console.log(`  Other:    distillation=${b.distillation}L, racking=${b.rackingLoss}L, filter=${b.filterLoss}L`);
      console.log(`  Adjustments: ${b.adjustments}L`);
      console.log(`  RECONSTRUCTED ENDING: ${b.ending}L (NEGATIVE — clamped to 0, losing ${b.clampedLoss}L)`);
      console.log(`  Current volume (live): ${b.currentVolumeLiters}L`);
      console.log();
    }
  }

  client.release();
  await pool.end();
}

findNegativeBatches().catch(console.error);
