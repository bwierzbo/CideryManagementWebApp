import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const L_TO_GAL = 0.264172;
function ltog(liters: number): number {
  return liters * L_TO_GAL;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const openingDate = '2024-12-31';
  const reconciliationDate = '2025-12-31';
  const endDate = `'${reconciliationDate}'::date + INTERVAL '1 day'`;

  // ============================================
  // 1. Get TTB Opening Balance
  // ============================================
  const settings = await client.query(`SELECT ttb_opening_balances FROM organization_settings LIMIT 1`);
  const balances = settings.rows[0]?.ttb_opening_balances;
  const bulkTotal = Object.values(balances?.bulk || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const bottledTotal = Object.values(balances?.bottled || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const spiritsTotal = Object.values(balances?.spirits || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const openingGal = bulkTotal + bottledTotal + spiritsTotal;

  // ============================================
  // 2. TTB Waterfall Components (aggregate queries, matching ttb.ts)
  // ============================================
  // Production: press runs
  const pressQ = await client.query(`
    SELECT COALESCE(SUM(CAST(total_juice_volume_liters AS DECIMAL)), 0) AS total
    FROM press_runs
    WHERE deleted_at IS NULL AND status = 'completed'
      AND date_completed::date > '${openingDate}'::date
      AND date_completed::date <= '${reconciliationDate}'::date
  `);
  const pressRunLiters = Number(pressQ.rows[0].total);

  // Production: juice purchases
  const juicePurchQ = await client.query(`
    SELECT COALESCE(SUM(
      CASE WHEN jpi.volume_unit = 'gal' THEN CAST(jpi.volume AS DECIMAL) * 3.78541
           ELSE CAST(jpi.volume AS DECIMAL) END
    ), 0) AS total
    FROM juice_purchase_items jpi
    INNER JOIN juice_purchases jp ON jpi.purchase_id = jp.id
    WHERE jp.deleted_at IS NULL AND jpi.deleted_at IS NULL
      AND jp.purchase_date::date > '${openingDate}'::date
      AND jp.purchase_date::date <= '${reconciliationDate}'::date
  `);
  const juicePurchaseLiters = Number(juicePurchQ.rows[0].total);

  // Juice-only batches (excluded from production)
  const juiceOnlyQ = await client.query(`
    SELECT COALESCE(SUM(CAST(initial_volume AS DECIMAL)), 0) AS total
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND product_type = 'juice'
      AND start_date::date > '${openingDate}'::date
      AND start_date::date <= '${reconciliationDate}'::date
  `);
  const juiceOnlyLiters = Number(juiceOnlyQ.rows[0].total);

  // Transfers into juice batches
  const xferJuiceQ = await client.query(`
    SELECT COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS total
    FROM batch_transfers bt
    INNER JOIN batches b ON bt.destination_batch_id = b.id
    WHERE bt.deleted_at IS NULL AND b.product_type = 'juice'
      AND bt.transferred_at::date > '${openingDate}'::date
      AND bt.transferred_at::date <= '${reconciliationDate}'::date
  `);
  const xferIntoJuiceLiters = Number(xferJuiceQ.rows[0].total);

  const totalProductionLiters = pressRunLiters + juicePurchaseLiters - juiceOnlyLiters - xferIntoJuiceLiters;

  // Brandy received
  const brandyQ = await client.query(`
    SELECT COALESCE(SUM(CAST(received_volume_liters AS DECIMAL)), 0) AS total
    FROM distillation_records
    WHERE deleted_at IS NULL AND received_volume_liters IS NOT NULL
      AND received_at::date > '${openingDate}'::date
      AND received_at::date <= '${reconciliationDate}'::date
  `);
  const brandyReceivedLiters = Number(brandyQ.rows[0].total);

  // Positive adjustments
  const posAdjQ = await client.query(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)), 0) AS total
    FROM batch_volume_adjustments
    WHERE deleted_at IS NULL
      AND adjustment_date::date > '${openingDate}'::date
      AND adjustment_date::date <= '${reconciliationDate}'::date
      AND CAST(adjustment_amount AS DECIMAL) > 0
  `);
  const positiveAdjLiters = Number(posAdjQ.rows[0].total);

  // Distributions: bottles
  const bottleDistQ = await client.query(`
    SELECT COALESCE(SUM(
      CAST(id2.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
    ), 0) AS total_ml
    FROM inventory_distributions id2
    INNER JOIN inventory_items ii ON id2.inventory_item_id = ii.id
    WHERE id2.distribution_date::date > '${openingDate}'::date
      AND id2.distribution_date::date <= '${reconciliationDate}'::date
  `);
  const bottleDistLiters = Number(bottleDistQ.rows[0].total_ml) / 1000;

  // Distributions: kegs
  const kegDistQ = await client.query(`
    SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)), 0) AS total
    FROM keg_fills
    WHERE distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
      AND distributed_at::date > '${openingDate}'::date
      AND distributed_at::date <= '${reconciliationDate}'::date
  `);
  const kegDistLiters = Number(kegDistQ.rows[0].total);
  const distributionsLiters = bottleDistLiters + kegDistLiters;

  // Process losses: racking
  const rackQ = await client.query(`
    SELECT COALESCE(SUM(CAST(bro.volume_loss AS DECIMAL)), 0) AS total
    FROM batch_racking_operations bro
    INNER JOIN batches b ON bro.batch_id = b.id
    WHERE bro.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bro.racked_at::date > '${openingDate}'::date
      AND bro.racked_at::date <= '${reconciliationDate}'::date
      AND (bro.notes IS NULL OR bro.notes NOT LIKE '%Historical Record%')
  `);
  const rackingLossLiters = Number(rackQ.rows[0].total);

  // Process losses: filter
  const filterQ = await client.query(`
    SELECT COALESCE(SUM(CAST(bfo.volume_loss AS DECIMAL)), 0) AS total
    FROM batch_filter_operations bfo
    INNER JOIN batches b ON bfo.batch_id = b.id
    WHERE bfo.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bfo.filtered_at::date > '${openingDate}'::date
      AND bfo.filtered_at::date <= '${reconciliationDate}'::date
  `);
  const filterLossLiters = Number(filterQ.rows[0].total);

  // Process losses: bottling
  const bottleLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(br.loss AS DECIMAL)), 0) AS total
    FROM bottle_runs br
    INNER JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND br.packaged_at::date > '${openingDate}'::date
      AND br.packaged_at::date <= '${reconciliationDate}'::date
  `);
  const bottlingLossLiters = Number(bottleLossQ.rows[0].total);

  // Process losses: transfer losses (from batch field + batch_transfers)
  const batchTransferLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(transfer_loss_l AS DECIMAL)), 0) AS total
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND start_date::date > '${openingDate}'::date
      AND start_date::date <= '${reconciliationDate}'::date
  `);
  const transferOpLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(bt.loss AS DECIMAL)), 0) AS total
    FROM batch_transfers bt
    INNER JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bt.transferred_at::date > '${openingDate}'::date
      AND bt.transferred_at::date <= '${reconciliationDate}'::date
  `);
  const transferLossLiters = Number(batchTransferLossQ.rows[0].total) + Number(transferOpLossQ.rows[0].total);

  // Process losses: negative adjustments
  const negAdjQ = await client.query(`
    SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS DECIMAL))), 0) AS total
    FROM batch_volume_adjustments
    WHERE deleted_at IS NULL
      AND adjustment_date::date > '${openingDate}'::date
      AND adjustment_date::date <= '${reconciliationDate}'::date
      AND CAST(adjustment_amount AS DECIMAL) < 0
  `);
  const negAdjLiters = Number(negAdjQ.rows[0].total);

  // Process losses: keg fill losses (NO batch filter in TTB query!)
  const kegFillLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(loss AS DECIMAL)), 0) AS total
    FROM keg_fills
    WHERE voided_at IS NULL AND deleted_at IS NULL AND loss IS NOT NULL
      AND filled_at::date > '${openingDate}'::date
      AND filled_at::date <= '${reconciliationDate}'::date
  `);
  const kegFillLossLiters = Number(kegFillLossQ.rows[0].total);

  const processLossesLiters = rackingLossLiters + filterLossLiters + bottlingLossLiters
    + transferLossLiters + negAdjLiters + kegFillLossLiters;

  // Distillation (NO batch filter in TTB query!)
  const distQ = await client.query(`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)), 0) AS total
    FROM distillation_records
    WHERE deleted_at IS NULL AND status IN ('sent', 'received')
      AND sent_at::date > '${openingDate}'::date
      AND sent_at::date <= '${reconciliationDate}'::date
  `);
  const distillationLiters = Number(distQ.rows[0].total);

  // TTB Calculated Ending (in liters, convert once)
  const openingLiters = openingGal / L_TO_GAL;
  const ttbEndingLiters = openingLiters
    + totalProductionLiters + brandyReceivedLiters + positiveAdjLiters
    - distributionsLiters - processLossesLiters - distillationLiters;
  const ttbEndingGal = ltog(ttbEndingLiters);

  // ============================================
  // 3. SBD Per-Batch Reconstruction (matching computeSystemCalculatedOnHand)
  // ============================================
  const eligibleQ = await client.query(`
    SELECT id FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND start_date <= '${reconciliationDate}'::date
  `);
  const eligibleIds = eligibleQ.rows.map((r: any) => r.id);
  const idList = eligibleIds.map((id: string) => `'${id}'`).join(',');

  // Batch basics
  const batchBasicsQ = await client.query(`
    SELECT id, name, batch_number, initial_volume_liters, parent_batch_id, product_type
    FROM batches WHERE id IN (${idList}) AND deleted_at IS NULL
  `);
  const batchMap = new Map<string, any>();
  for (const b of batchBasicsQ.rows) {
    batchMap.set(b.id, {
      name: b.name,
      batchNumber: b.batch_number,
      initial: parseFloat(b.initial_volume_liters || '0'),
      parentId: b.parent_batch_id,
      productType: b.product_type,
    });
  }

  // Transfers out
  const tOutQ = await client.query(`
    SELECT source_batch_id, volume_transferred, loss
    FROM batch_transfers
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND transferred_at < ${endDate}
  `);
  const tOutMap = new Map<string, any[]>();
  for (const r of tOutQ.rows) {
    if (!tOutMap.has(r.source_batch_id)) tOutMap.set(r.source_batch_id, []);
    tOutMap.get(r.source_batch_id)!.push(r);
  }

  // Transfers in
  const tInQ = await client.query(`
    SELECT destination_batch_id, volume_transferred
    FROM batch_transfers
    WHERE destination_batch_id IN (${idList}) AND deleted_at IS NULL
      AND transferred_at < ${endDate}
  `);
  const tInMap = new Map<string, any[]>();
  for (const r of tInQ.rows) {
    if (!tInMap.has(r.destination_batch_id)) tInMap.set(r.destination_batch_id, []);
    tInMap.get(r.destination_batch_id)!.push(r);
  }

  // Merges in
  const mInQ = await client.query(`
    SELECT target_batch_id, volume_added
    FROM batch_merge_history
    WHERE target_batch_id IN (${idList}) AND deleted_at IS NULL
      AND merged_at < ${endDate}
  `);
  const mInMap = new Map<string, any[]>();
  for (const r of mInQ.rows) {
    if (!mInMap.has(r.target_batch_id)) mInMap.set(r.target_batch_id, []);
    mInMap.get(r.target_batch_id)!.push(r);
  }

  // Merges out
  const mOutQ = await client.query(`
    SELECT source_batch_id, volume_added AS volume_merged_out
    FROM batch_merge_history
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND merged_at < ${endDate}
  `);
  const mOutMap = new Map<string, any[]>();
  for (const r of mOutQ.rows) {
    if (!mOutMap.has(r.source_batch_id)) mOutMap.set(r.source_batch_id, []);
    mOutMap.get(r.source_batch_id)!.push(r);
  }

  // Bottle runs
  const brQ = await client.query(`
    SELECT batch_id, volume_taken_liters, loss, units_produced, package_size_ml
    FROM bottle_runs
    WHERE batch_id IN (${idList}) AND voided_at IS NULL
      AND packaged_at < ${endDate}
  `);
  const brMap = new Map<string, any[]>();
  for (const r of brQ.rows) {
    if (!brMap.has(r.batch_id)) brMap.set(r.batch_id, []);
    brMap.get(r.batch_id)!.push(r);
  }

  // Keg fills
  const kfQ = await client.query(`
    SELECT batch_id, volume_taken, loss
    FROM keg_fills
    WHERE batch_id IN (${idList}) AND voided_at IS NULL AND deleted_at IS NULL
      AND filled_at < ${endDate}
  `);
  const kfMap = new Map<string, any[]>();
  for (const r of kfQ.rows) {
    if (!kfMap.has(r.batch_id)) kfMap.set(r.batch_id, []);
    kfMap.get(r.batch_id)!.push(r);
  }

  // Distillation
  const dQ = await client.query(`
    SELECT source_batch_id, source_volume_liters
    FROM distillation_records
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND status IN ('sent', 'received')
      AND sent_at < ${endDate}
  `);
  const dMap = new Map<string, any[]>();
  for (const r of dQ.rows) {
    if (!dMap.has(r.source_batch_id)) dMap.set(r.source_batch_id, []);
    dMap.get(r.source_batch_id)!.push(r);
  }

  // Volume adjustments
  const adjQ = await client.query(`
    SELECT batch_id, adjustment_amount
    FROM batch_volume_adjustments
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND adjustment_date < ${endDate}
  `);
  const adjMap = new Map<string, any[]>();
  for (const r of adjQ.rows) {
    if (!adjMap.has(r.batch_id)) adjMap.set(r.batch_id, []);
    adjMap.get(r.batch_id)!.push(r);
  }

  // Racking losses
  const rlQ = await client.query(`
    SELECT batch_id, volume_loss
    FROM batch_racking_operations
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND racked_at < ${endDate}
      AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
  `);
  const rlMap = new Map<string, any[]>();
  for (const r of rlQ.rows) {
    if (!rlMap.has(r.batch_id)) rlMap.set(r.batch_id, []);
    rlMap.get(r.batch_id)!.push(r);
  }

  // Filter losses
  const flQ = await client.query(`
    SELECT batch_id, volume_loss
    FROM batch_filter_operations
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND filtered_at < ${endDate}
  `);
  const flMap = new Map<string, any[]>();
  for (const r of flQ.rows) {
    if (!flMap.has(r.batch_id)) flMap.set(r.batch_id, []);
    flMap.get(r.batch_id)!.push(r);
  }

  const num = (v: any) => parseFloat(v || '0') || 0;

  // Per-batch reconstruction
  let sbdTotalLiters = 0;
  let sbdClampedLoss = 0;
  const sbdAgg = {
    effectiveInitial: 0, mergesIn: 0, mergesOut: 0, transfersIn: 0, transfersOut: 0,
    transferLoss: 0, bottlingVol: 0, bottlingLoss: 0, kegging: 0, keggingLoss: 0,
    distillation: 0, posAdj: 0, negAdj: 0, rackingLoss: 0, filterLoss: 0, clamped: 0,
  };

  interface BatchDetail {
    name: string;
    batchNumber: string;
    productType: string;
    effectiveInitial: number;
    ending: number;
    clamped: number;
    clampedLoss: number;
    isTransferCreated: boolean;
    zeroed: number;
  }
  const batchDetails: BatchDetail[] = [];

  for (const batchId of eligibleIds) {
    const batch = batchMap.get(batchId);
    if (!batch) continue;

    const transfersIn = (tInMap.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_transferred), 0);
    const transfersOut = (tOutMap.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_transferred), 0);
    const transferLoss = (tOutMap.get(batchId) || []).reduce((s: number, r: any) => s + num(r.loss), 0);
    const mergesIn = (mInMap.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_added), 0);
    const mergesOut = (mOutMap.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_merged_out), 0);

    const bottlingVol = (brMap.get(batchId) || []).reduce((s: number, b: any) => s + num(b.volume_taken_liters), 0);
    const bottlingLoss = (brMap.get(batchId) || []).reduce((s: number, b: any) => {
      const volumeTaken = num(b.volume_taken_liters);
      const lossVal = num(b.loss);
      const productVol = ((b.units_produced || 0) * (b.package_size_ml || 0)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVol + lossVal)) < 2;
      return s + (lossIncluded ? 0 : lossVal);
    }, 0);

    const kegging = (kfMap.get(batchId) || []).reduce((s: number, k: any) => s + num(k.volume_taken), 0);
    const keggingLoss = (kfMap.get(batchId) || []).reduce((s: number, k: any) => s + num(k.loss), 0);
    const distillation = (dMap.get(batchId) || []).reduce((s: number, d: any) => s + num(d.source_volume_liters), 0);
    const adjRows = adjMap.get(batchId) || [];
    const adjustments = adjRows.reduce((s: number, a: any) => s + num(a.adjustment_amount), 0);
    const posAdj = adjRows.reduce((s: number, a: any) => { const v = num(a.adjustment_amount); return s + (v > 0 ? v : 0); }, 0);
    const negAdj = adjRows.reduce((s: number, a: any) => { const v = num(a.adjustment_amount); return s + (v < 0 ? Math.abs(v) : 0); }, 0);
    const rackingLossVal = (rlMap.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_loss), 0);
    const filterLossVal = (flMap.get(batchId) || []).reduce((s: number, f: any) => s + num(f.volume_loss), 0);

    const isTransferCreated = batch.parentId && transfersIn >= batch.initial * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : batch.initial;
    const zeroed = isTransferCreated ? batch.initial : 0;

    const ending = effectiveInitial + mergesIn - mergesOut + transfersIn
      - transfersOut - transferLoss - bottlingVol - bottlingLoss
      - kegging - keggingLoss - distillation + adjustments - rackingLossVal - filterLossVal;
    const clamped = Math.max(0, ending);
    const clampedLoss = ending < 0 ? Math.abs(ending) : 0;

    sbdTotalLiters += clamped;
    sbdClampedLoss += clampedLoss;

    sbdAgg.effectiveInitial += effectiveInitial;
    sbdAgg.mergesIn += mergesIn;
    sbdAgg.mergesOut += mergesOut;
    sbdAgg.transfersIn += transfersIn;
    sbdAgg.transfersOut += transfersOut;
    sbdAgg.transferLoss += transferLoss;
    sbdAgg.bottlingVol += bottlingVol;
    sbdAgg.bottlingLoss += bottlingLoss;
    sbdAgg.kegging += kegging;
    sbdAgg.keggingLoss += keggingLoss;
    sbdAgg.distillation += distillation;
    sbdAgg.posAdj += posAdj;
    sbdAgg.negAdj += negAdj;
    sbdAgg.rackingLoss += rackingLossVal;
    sbdAgg.filterLoss += filterLossVal;
    sbdAgg.clamped += clampedLoss;

    batchDetails.push({
      name: batch.name,
      batchNumber: batch.batchNumber,
      productType: batch.productType,
      effectiveInitial,
      ending,
      clamped,
      clampedLoss,
      isTransferCreated,
      zeroed,
    });
  }

  const sbdGal = ltog(sbdTotalLiters);

  // ============================================
  // 4. COMPARISON
  // ============================================
  console.log('=== TTB WATERFALL (aggregate queries) ===');
  console.log(`  Opening:          ${openingGal.toFixed(2)} gal (${(openingGal / L_TO_GAL).toFixed(2)} L)`);
  console.log(`  + Production:     ${ltog(totalProductionLiters).toFixed(2)} gal (${totalProductionLiters.toFixed(2)} L)`);
  console.log(`    Press runs:     ${ltog(pressRunLiters).toFixed(2)} gal`);
  console.log(`    Juice purch:    ${ltog(juicePurchaseLiters).toFixed(2)} gal`);
  console.log(`    - Juice only:   ${ltog(juiceOnlyLiters).toFixed(2)} gal`);
  console.log(`    - Xfer→juice:   ${ltog(xferIntoJuiceLiters).toFixed(2)} gal`);
  console.log(`  + Brandy:         ${ltog(brandyReceivedLiters).toFixed(2)} gal`);
  console.log(`  + Pos Adj:        ${ltog(positiveAdjLiters).toFixed(2)} gal`);
  console.log(`  - Distributions:  ${ltog(distributionsLiters).toFixed(2)} gal`);
  console.log(`    Bottle dist:    ${ltog(bottleDistLiters).toFixed(2)} gal`);
  console.log(`    Keg dist:       ${ltog(kegDistLiters).toFixed(2)} gal`);
  console.log(`  - Process Losses: ${ltog(processLossesLiters).toFixed(2)} gal`);
  console.log(`    Racking:        ${ltog(rackingLossLiters).toFixed(2)} gal`);
  console.log(`    Filter:         ${ltog(filterLossLiters).toFixed(2)} gal`);
  console.log(`    Bottling:       ${ltog(bottlingLossLiters).toFixed(2)} gal`);
  console.log(`    Transfer:       ${ltog(transferLossLiters).toFixed(2)} gal`);
  console.log(`    Neg Adj:        ${ltog(negAdjLiters).toFixed(2)} gal`);
  console.log(`    Keg fill:       ${ltog(kegFillLossLiters).toFixed(2)} gal`);
  console.log(`  - Distillation:   ${ltog(distillationLiters).toFixed(2)} gal`);
  console.log(`  = TTB Ending:     ${ttbEndingGal.toFixed(2)} gal`);

  console.log('\n=== SBD PER-BATCH RECONSTRUCTION ===');
  console.log(`  Batches:          ${eligibleIds.length}`);
  console.log(`  EffectiveInitial: ${ltog(sbdAgg.effectiveInitial).toFixed(2)} gal (${sbdAgg.effectiveInitial.toFixed(2)} L)`);
  console.log(`  + MergesIn:       ${ltog(sbdAgg.mergesIn).toFixed(2)} gal`);
  console.log(`  - MergesOut:      ${ltog(sbdAgg.mergesOut).toFixed(2)} gal`);
  console.log(`  + TransfersIn:    ${ltog(sbdAgg.transfersIn).toFixed(2)} gal`);
  console.log(`  - TransfersOut:   ${ltog(sbdAgg.transfersOut).toFixed(2)} gal`);
  console.log(`  - TransferLoss:   ${ltog(sbdAgg.transferLoss).toFixed(2)} gal`);
  console.log(`  - BottlingVol:    ${ltog(sbdAgg.bottlingVol).toFixed(2)} gal`);
  console.log(`  - BottlingLoss:   ${ltog(sbdAgg.bottlingLoss).toFixed(2)} gal`);
  console.log(`  - Kegging:        ${ltog(sbdAgg.kegging).toFixed(2)} gal`);
  console.log(`  - KeggingLoss:    ${ltog(sbdAgg.keggingLoss).toFixed(2)} gal`);
  console.log(`  - Distillation:   ${ltog(sbdAgg.distillation).toFixed(2)} gal`);
  console.log(`  + PosAdj:         ${ltog(sbdAgg.posAdj).toFixed(2)} gal`);
  console.log(`  - NegAdj:         ${ltog(sbdAgg.negAdj).toFixed(2)} gal`);
  console.log(`  - RackingLoss:    ${ltog(sbdAgg.rackingLoss).toFixed(2)} gal`);
  console.log(`  - FilterLoss:     ${ltog(sbdAgg.filterLoss).toFixed(2)} gal`);
  console.log(`  - ClampedLoss:    ${ltog(sbdAgg.clamped).toFixed(2)} gal`);
  console.log(`  = SBD Total:      ${sbdGal.toFixed(2)} gal`);

  console.log('\n=== VARIANCE ===');
  const variance = sbdGal - ttbEndingGal;
  console.log(`  TTB Ending:       ${ttbEndingGal.toFixed(2)} gal`);
  console.log(`  SBD Total:        ${sbdGal.toFixed(2)} gal`);
  console.log(`  Variance:         ${variance > 0 ? '+' : ''}${variance.toFixed(2)} gal (SBD - TTB)`);

  // ============================================
  // 5. COMPONENT-LEVEL COMPARISON (map SBD → TTB categories)
  // ============================================
  // SBD "inflows" that correspond to TTB Opening + Production + PosAdj:
  // effectiveInitial + mergesIn + transfersIn + posAdj
  // vs TTB: opening + production + brandy + posAdj
  const sbdInflowsL = sbdAgg.effectiveInitial + sbdAgg.mergesIn + sbdAgg.transfersIn + sbdAgg.posAdj;
  const ttbInflowsL = openingGal / L_TO_GAL + totalProductionLiters + brandyReceivedLiters + positiveAdjLiters;

  // SBD "outflows" that correspond to TTB Distributions + Losses + DSP:
  // mergesOut + transfersOut + transferLoss + bottlingVol + bottlingLoss + kegging + keggingLoss + distillation + negAdj + rackingLoss + filterLoss + clampedLoss
  const sbdOutflowsL = sbdAgg.mergesOut + sbdAgg.transfersOut + sbdAgg.transferLoss
    + sbdAgg.bottlingVol + sbdAgg.bottlingLoss + sbdAgg.kegging + sbdAgg.keggingLoss
    + sbdAgg.distillation + sbdAgg.negAdj + sbdAgg.rackingLoss + sbdAgg.filterLoss + sbdAgg.clamped;
  const ttbOutflowsL = distributionsLiters + processLossesLiters + distillationLiters;

  console.log('\n=== INFLOWS COMPARISON (should be equal for zero variance) ===');
  console.log(`  TTB Inflows:  ${ltog(ttbInflowsL).toFixed(2)} gal`);
  console.log(`  SBD Inflows:  ${ltog(sbdInflowsL).toFixed(2)} gal`);
  console.log(`  Difference:   ${ltog(sbdInflowsL - ttbInflowsL).toFixed(2)} gal`);

  console.log('\n=== OUTFLOWS COMPARISON ===');
  console.log(`  TTB Outflows: ${ltog(ttbOutflowsL).toFixed(2)} gal`);
  console.log(`  SBD Outflows: ${ltog(sbdOutflowsL).toFixed(2)} gal`);
  console.log(`  Difference:   ${ltog(sbdOutflowsL - ttbOutflowsL).toFixed(2)} gal`);

  // Net transfers (should cancel at aggregate level if all batches included)
  console.log('\n=== INTERNAL MOVEMENT CANCELLATION ===');
  console.log(`  TransfersIn - TransfersOut: ${ltog(sbdAgg.transfersIn - sbdAgg.transfersOut).toFixed(2)} gal`);
  console.log(`  MergesIn - MergesOut:       ${ltog(sbdAgg.mergesIn - sbdAgg.mergesOut).toFixed(2)} gal`);
  console.log(`  Net internal:               ${ltog(sbdAgg.transfersIn - sbdAgg.transfersOut + sbdAgg.mergesIn - sbdAgg.mergesOut).toFixed(2)} gal`);

  // Batches with clamping (negative volumes clamped to 0)
  const clampedBatches = batchDetails.filter(b => b.clampedLoss > 0);
  if (clampedBatches.length > 0) {
    console.log('\n=== CLAMPED BATCHES (negative volume → 0) ===');
    for (const b of clampedBatches) {
      console.log(`  ${b.name} (${b.batchNumber}): ending ${ltog(b.ending).toFixed(2)} gal → clamped loss ${ltog(b.clampedLoss).toFixed(2)} gal`);
    }
  }

  // Batches where effectiveInitial was zeroed
  const zeroedBatches = batchDetails.filter(b => b.isTransferCreated && b.zeroed > 0);
  if (zeroedBatches.length > 0) {
    console.log('\n=== TRANSFER-CREATED BATCHES (initial zeroed) ===');
    for (const b of zeroedBatches) {
      console.log(`  ${b.name} (${b.batchNumber}): initial ${ltog(b.zeroed).toFixed(2)} gal → 0 (transfer-created)`);
    }
    console.log(`  Total zeroed: ${ltog(zeroedBatches.reduce((s, b) => s + b.zeroed, 0)).toFixed(2)} gal`);
  }

  // Juice batches in SBD (included in SBD but excluded from TTB production)
  const juiceBatches = batchDetails.filter(b => b.productType === 'juice');
  if (juiceBatches.length > 0) {
    console.log('\n=== JUICE BATCHES IN SBD ===');
    for (const b of juiceBatches) {
      console.log(`  ${b.name} (${b.batchNumber}): ending ${ltog(b.clamped).toFixed(2)} gal`);
    }
    console.log(`  Total juice volume in SBD: ${ltog(juiceBatches.reduce((s, b) => s + b.clamped, 0)).toFixed(2)} gal`);
  }

  // ============================================
  // 6. SBD AT OPENING DATE (to compare with configured opening)
  // ============================================
  // Get batches that existed at the opening date
  const preOpeningQ = await client.query(`
    SELECT id FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND start_date <= '${openingDate}'::date
  `);
  const preOpeningIds = preOpeningQ.rows.map((r: any) => r.id);
  const preIdList = preOpeningIds.map((id: string) => `'${id}'`).join(',');

  if (preOpeningIds.length > 0) {
    const openingEndDate = `'${openingDate}'::date + INTERVAL '1 day'`;

    // Reconstruct each pre-opening batch at openingDate
    const preTOutQ = await client.query(`SELECT source_batch_id, volume_transferred, loss FROM batch_transfers WHERE source_batch_id IN (${preIdList}) AND deleted_at IS NULL AND transferred_at < ${openingEndDate}`);
    const preTInQ = await client.query(`SELECT destination_batch_id, volume_transferred FROM batch_transfers WHERE destination_batch_id IN (${preIdList}) AND deleted_at IS NULL AND transferred_at < ${openingEndDate}`);
    const preMInQ = await client.query(`SELECT target_batch_id, volume_added FROM batch_merge_history WHERE target_batch_id IN (${preIdList}) AND deleted_at IS NULL AND merged_at < ${openingEndDate}`);
    const preMOutQ = await client.query(`SELECT source_batch_id, volume_added AS volume_merged_out FROM batch_merge_history WHERE source_batch_id IN (${preIdList}) AND deleted_at IS NULL AND merged_at < ${openingEndDate}`);
    const preBrQ = await client.query(`SELECT batch_id, volume_taken_liters, loss, units_produced, package_size_ml FROM bottle_runs WHERE batch_id IN (${preIdList}) AND voided_at IS NULL AND packaged_at < ${openingEndDate}`);
    const preKfQ = await client.query(`SELECT batch_id, volume_taken, loss FROM keg_fills WHERE batch_id IN (${preIdList}) AND voided_at IS NULL AND deleted_at IS NULL AND filled_at < ${openingEndDate}`);
    const preDQ = await client.query(`SELECT source_batch_id, source_volume_liters FROM distillation_records WHERE source_batch_id IN (${preIdList}) AND deleted_at IS NULL AND status IN ('sent', 'received') AND sent_at < ${openingEndDate}`);
    const preAdjQ = await client.query(`SELECT batch_id, adjustment_amount FROM batch_volume_adjustments WHERE batch_id IN (${preIdList}) AND deleted_at IS NULL AND adjustment_date < ${openingEndDate}`);
    const preRlQ = await client.query(`SELECT batch_id, volume_loss FROM batch_racking_operations WHERE batch_id IN (${preIdList}) AND deleted_at IS NULL AND racked_at < ${openingEndDate} AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')`);
    const preFlQ = await client.query(`SELECT batch_id, volume_loss FROM batch_filter_operations WHERE batch_id IN (${preIdList}) AND deleted_at IS NULL AND filtered_at < ${openingEndDate}`);

    // Helper to group
    function groupBy(rows: any[], key: string): Map<string, any[]> {
      const map = new Map<string, any[]>();
      for (const r of rows) {
        if (!map.has(r[key])) map.set(r[key], []);
        map.get(r[key])!.push(r);
      }
      return map;
    }

    const preTOut = groupBy(preTOutQ.rows, 'source_batch_id');
    const preTIn = groupBy(preTInQ.rows, 'destination_batch_id');
    const preMIn = groupBy(preMInQ.rows, 'target_batch_id');
    const preMOut = groupBy(preMOutQ.rows, 'source_batch_id');
    const preBr = groupBy(preBrQ.rows, 'batch_id');
    const preKf = groupBy(preKfQ.rows, 'batch_id');
    const preD = groupBy(preDQ.rows, 'source_batch_id');
    const preAdj = groupBy(preAdjQ.rows, 'batch_id');
    const preRl = groupBy(preRlQ.rows, 'batch_id');
    const preFl = groupBy(preFlQ.rows, 'batch_id');

    let sbdOpeningTotalLiters = 0;
    const openingBatchVolumes: { name: string; batchNumber: string; productType: string; volumeGal: number; endingRaw: number }[] = [];

    for (const batchId of preOpeningIds) {
      const batch = batchMap.get(batchId);
      if (!batch) continue;

      const transfersIn = (preTIn.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_transferred), 0);
      const transfersOut = (preTOut.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_transferred), 0);
      const tLoss = (preTOut.get(batchId) || []).reduce((s: number, r: any) => s + num(r.loss), 0);
      const mergesIn = (preMIn.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_added), 0);
      const mergesOut = (preMOut.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_merged_out), 0);
      const bottlingVol = (preBr.get(batchId) || []).reduce((s: number, b: any) => s + num(b.volume_taken_liters), 0);
      const bottlingLoss = (preBr.get(batchId) || []).reduce((s: number, b: any) => {
        const vt = num(b.volume_taken_liters);
        const lv = num(b.loss);
        const pv = ((b.units_produced || 0) * (b.package_size_ml || 0)) / 1000;
        return s + (Math.abs(vt - (pv + lv)) < 2 ? 0 : lv);
      }, 0);
      const kegging = (preKf.get(batchId) || []).reduce((s: number, k: any) => s + num(k.volume_taken), 0);
      const keggingLoss = (preKf.get(batchId) || []).reduce((s: number, k: any) => s + num(k.loss), 0);
      const dist = (preD.get(batchId) || []).reduce((s: number, d: any) => s + num(d.source_volume_liters), 0);
      const adj = (preAdj.get(batchId) || []).reduce((s: number, a: any) => s + num(a.adjustment_amount), 0);
      const rl = (preRl.get(batchId) || []).reduce((s: number, r: any) => s + num(r.volume_loss), 0);
      const fl = (preFl.get(batchId) || []).reduce((s: number, f: any) => s + num(f.volume_loss), 0);

      const isTC = batch.parentId && transfersIn >= batch.initial * 0.9;
      const effInit = isTC ? 0 : batch.initial;

      const ending = effInit + mergesIn - mergesOut + transfersIn - transfersOut - tLoss
        - bottlingVol - bottlingLoss - kegging - keggingLoss - dist + adj - rl - fl;
      const clamped = Math.max(0, ending);
      sbdOpeningTotalLiters += clamped;

      openingBatchVolumes.push({
        name: batch.name,
        batchNumber: batch.batchNumber,
        productType: batch.productType,
        volumeGal: ltog(clamped),
        endingRaw: ltog(ending),
      });
    }

    const sbdOpeningGal = ltog(sbdOpeningTotalLiters);

    console.log('\n=== SBD AT OPENING DATE vs CONFIGURED OPENING ===');
    console.log(`  Pre-opening batches: ${preOpeningIds.length}`);
    console.log(`  SBD Opening:         ${sbdOpeningGal.toFixed(2)} gal`);
    console.log(`  Configured Opening:  ${openingGal.toFixed(2)} gal`);
    const openingDiff = sbdOpeningGal - openingGal;
    console.log(`  Difference:          ${openingDiff > 0 ? '+' : ''}${openingDiff.toFixed(2)} gal`);

    // Show juice batches at opening (these inflate SBD but aren't in TTB opening)
    const juiceAtOpening = openingBatchVolumes.filter(b => b.productType === 'juice');
    if (juiceAtOpening.length > 0) {
      const juiceTotal = juiceAtOpening.reduce((s, b) => s + b.volumeGal, 0);
      console.log(`\n  Juice at opening:    ${juiceTotal.toFixed(2)} gal`);
      console.log(`  SBD excl juice:      ${(sbdOpeningGal - juiceTotal).toFixed(2)} gal`);
      console.log(`  Diff excl juice:     ${(sbdOpeningGal - juiceTotal - openingGal).toFixed(2)} gal`);
    }

    // Now compute the "period-only" approach:
    // SBD at reconDate = SBD at openingDate + period activity
    // So: variance = (SBD_opening - configured_opening) + period_activity_diff
    // where period_activity_diff = SBD_period - TTB_period
    const sbdPeriodActivity = sbdGal - sbdOpeningGal;
    const ttbPeriodActivity = ttbEndingGal - openingGal;
    console.log(`\n  SBD period activity:  ${sbdPeriodActivity.toFixed(2)} gal`);
    console.log(`  TTB period activity:  ${ttbPeriodActivity.toFixed(2)} gal`);
    console.log(`  Period diff:          ${(sbdPeriodActivity - ttbPeriodActivity).toFixed(2)} gal`);
    console.log(`  Opening diff:         ${openingDiff.toFixed(2)} gal`);
    console.log(`  Sum (= variance):     ${(openingDiff + (sbdPeriodActivity - ttbPeriodActivity)).toFixed(2)} gal`);

    // Show top non-juice batch volumes at opening for debugging
    const nonJuiceAtOpening = openingBatchVolumes
      .filter(b => b.productType !== 'juice')
      .sort((a, b) => b.volumeGal - a.volumeGal);
    console.log(`\n  Top 10 non-juice batches at opening (${nonJuiceAtOpening.length} total):`);
    for (const b of nonJuiceAtOpening.slice(0, 10)) {
      console.log(`    ${b.name}: ${b.volumeGal.toFixed(2)} gal`);
    }
  }

  // ============================================
  // 7. TRACE SPECIFIC COMPONENT DIFFERENCES
  // ============================================
  console.log('\n=== TRACING COMPONENT DIFFERENCES ===');

  // A. Transfer Loss: TTB uses batches.transfer_loss_l + batch_transfers.loss
  //    SBD uses only batch_transfers.loss on eligible batches
  //    Check for double-counting in TTB
  const ttbBatchFieldLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(transfer_loss_l AS DECIMAL)), 0) AS total
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND start_date::date > '${openingDate}'::date
      AND start_date::date <= '${reconciliationDate}'::date
  `);
  const ttbTransferOpLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(bt.loss AS DECIMAL)), 0) AS total
    FROM batch_transfers bt
    INNER JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bt.transferred_at::date > '${openingDate}'::date
      AND bt.transferred_at::date <= '${reconciliationDate}'::date
  `);
  const ttbBatchFieldLoss = Number(ttbBatchFieldLossQ.rows[0].total);
  const ttbTransferOpLoss = Number(ttbTransferOpLossQ.rows[0].total);

  // SBD transfer loss for period-only (period = all-time minus pre-opening)
  const sbdTransferLossPreQ = await client.query(`
    SELECT COALESCE(SUM(CAST(loss AS DECIMAL)), 0) AS total
    FROM batch_transfers
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND transferred_at < '${openingDate}'::date + INTERVAL '1 day'
  `);
  const sbdTransferLossPre = Number(sbdTransferLossPreQ.rows[0].total);
  const sbdTransferLossPeriod = sbdAgg.transferLoss - ltog(sbdTransferLossPre) / L_TO_GAL;
  // Actually need liters
  const sbdTransferLossAllL = sbdAgg.transferLoss; // already in gal converted... wait

  // Let me just get raw liters
  const sbdTLAllQ = await client.query(`
    SELECT COALESCE(SUM(CAST(loss AS DECIMAL)), 0) AS total
    FROM batch_transfers
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND transferred_at < ${endDate}
  `);
  const sbdTLPreQ2 = await client.query(`
    SELECT COALESCE(SUM(CAST(loss AS DECIMAL)), 0) AS total
    FROM batch_transfers
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND transferred_at < '${openingDate}'::date + INTERVAL '1 day'
  `);
  const sbdTransferLossAllLiters = Number(sbdTLAllQ.rows[0].total);
  const sbdTransferLossPreLiters = Number(sbdTLPreQ2.rows[0].total);
  const sbdTransferLossPeriodLiters = sbdTransferLossAllLiters - sbdTransferLossPreLiters;

  console.log('\n  A. TRANSFER LOSS:');
  console.log(`    TTB batches.transfer_loss_l (new batches): ${ltog(ttbBatchFieldLoss).toFixed(2)} gal (${ttbBatchFieldLoss.toFixed(2)} L)`);
  console.log(`    TTB batch_transfers.loss (period):         ${ltog(ttbTransferOpLoss).toFixed(2)} gal (${ttbTransferOpLoss.toFixed(2)} L)`);
  console.log(`    TTB total transfer loss:                   ${ltog(ttbBatchFieldLoss + ttbTransferOpLoss).toFixed(2)} gal`);
  console.log(`    SBD batch_transfers.loss (period only):    ${ltog(sbdTransferLossPeriodLiters).toFixed(2)} gal (${sbdTransferLossPeriodLiters.toFixed(2)} L)`);
  console.log(`    Diff (TTB deducts more):                   ${ltog(ttbBatchFieldLoss + ttbTransferOpLoss - sbdTransferLossPeriodLiters).toFixed(2)} gal`);

  // B. Bottling Loss: TTB counts raw loss, SBD applies smart heuristic
  const ttbBottlingLossQ = await client.query(`
    SELECT COALESCE(SUM(CAST(br.loss AS DECIMAL)), 0) AS total
    FROM bottle_runs br
    INNER JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND br.packaged_at::date > '${openingDate}'::date
      AND br.packaged_at::date <= '${reconciliationDate}'::date
  `);
  const ttbBottlingLossL = Number(ttbBottlingLossQ.rows[0].total);

  // SBD bottling loss (period) - need to compute with heuristic
  const sbdBottleLossDetailQ = await client.query(`
    SELECT br.batch_id, b.name, br.volume_taken_liters, br.loss, br.units_produced, br.package_size_ml, br.packaged_at
    FROM bottle_runs br
    INNER JOIN batches b ON br.batch_id = b.id
    WHERE br.batch_id IN (${idList}) AND br.voided_at IS NULL
      AND br.packaged_at::date > '${openingDate}'::date
      AND br.packaged_at::date <= '${reconciliationDate}'::date
  `);

  let sbdBottlingLossPeriodL = 0;
  const bottleLossDetails: any[] = [];
  for (const br of sbdBottleLossDetailQ.rows) {
    const vt = num(br.volume_taken_liters);
    const lv = num(br.loss);
    const pv = ((br.units_produced || 0) * (br.package_size_ml || 0)) / 1000;
    const lossIncluded = Math.abs(vt - (pv + lv)) < 2;
    const effectiveLoss = lossIncluded ? 0 : lv;
    sbdBottlingLossPeriodL += effectiveLoss;
    if (lv > 0) {
      bottleLossDetails.push({
        batch: br.name,
        volumeTaken: vt,
        rawLoss: lv,
        productVol: pv,
        lossIncluded,
        effectiveLoss,
        date: br.packaged_at,
      });
    }
  }

  console.log('\n  B. BOTTLING LOSS:');
  console.log(`    TTB raw loss (period):           ${ltog(ttbBottlingLossL).toFixed(2)} gal (${ttbBottlingLossL.toFixed(2)} L)`);
  console.log(`    SBD smart loss (period):          ${ltog(sbdBottlingLossPeriodL).toFixed(2)} gal (${sbdBottlingLossPeriodL.toFixed(2)} L)`);
  console.log(`    Diff (TTB deducts more):          ${ltog(ttbBottlingLossL - sbdBottlingLossPeriodL).toFixed(2)} gal`);
  if (bottleLossDetails.length > 0) {
    console.log('    Bottle runs with loss:');
    for (const d of bottleLossDetails) {
      console.log(`      ${d.batch}: taken=${d.volumeTaken.toFixed(2)}L, rawLoss=${d.rawLoss.toFixed(2)}L, product=${d.productVol.toFixed(2)}L, ${d.lossIncluded ? 'INCLUDED (SBD=0)' : 'SEPARATE'}, effectiveLoss=${d.effectiveLoss.toFixed(2)}L`);
    }
  }

  // C. Racking Loss scope: TTB has period filter + batch filter, SBD has batch filter + all-time
  const sbdRackingPreQ = await client.query(`
    SELECT COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0) AS total
    FROM batch_racking_operations
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND racked_at < '${openingDate}'::date + INTERVAL '1 day'
      AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
  `);
  const sbdRackingPreL = Number(sbdRackingPreQ.rows[0].total);
  const sbdRackingPeriodL = sbdAgg.rackingLoss / L_TO_GAL - sbdRackingPreL;

  console.log('\n  C. RACKING LOSS:');
  console.log(`    TTB (period only):               ${ltog(rackingLossLiters).toFixed(2)} gal (${rackingLossLiters.toFixed(2)} L)`);
  console.log(`    SBD (period only):               ${ltog(sbdRackingPeriodL).toFixed(4)} gal`);

  // Wait, I need to be more careful with gal/liter conversions. Let me use raw liters from the maps.
  // Actually sbdAgg.rackingLoss is in gal already... no it's not. Let me check.
  // The sbdAgg accumulates from per-batch which are in liters. So sbdAgg.rackingLoss is in liters.
  // Hmm, actually I need to re-check. In the loop: `rackingLossVal = ... num(r.volume_loss)` which is liters from DB.
  // Then `sbdAgg.rackingLoss += rackingLossVal` — so it IS in liters. But above I print `ltog(sbdAgg.rackingLoss)` which converts to gal. OK good.

  const sbdRackPeriodLiters = (sbdAgg.rackingLoss) - sbdRackingPreL;
  console.log(`    Recalc: SBD all-time=${sbdAgg.rackingLoss.toFixed(2)}L, pre=${sbdRackingPreL.toFixed(2)}L, period=${sbdRackPeriodLiters.toFixed(2)}L = ${ltog(sbdRackPeriodLiters).toFixed(2)} gal`);
  console.log(`    Diff:                            ${ltog(rackingLossLiters - sbdRackPeriodLiters).toFixed(2)} gal`);

  // D. Filter Loss scope
  const sbdFilterPreQ = await client.query(`
    SELECT COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0) AS total
    FROM batch_filter_operations
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND filtered_at < '${openingDate}'::date + INTERVAL '1 day'
  `);
  const sbdFilterPreL = Number(sbdFilterPreQ.rows[0].total);
  const sbdFilterPeriodL = sbdAgg.filterLoss - sbdFilterPreL;

  console.log('\n  D. FILTER LOSS:');
  console.log(`    TTB (period only):               ${ltog(filterLossLiters).toFixed(2)} gal`);
  console.log(`    SBD (period only):               ${ltog(sbdFilterPeriodL).toFixed(2)} gal`);
  console.log(`    Diff:                            ${ltog(filterLossLiters - sbdFilterPeriodL).toFixed(2)} gal`);

  // E. Positive adjustments scope (TTB = global no batch filter, SBD = eligible batches only)
  const sbdPosAdjPreQ = await client.query(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)), 0) AS total
    FROM batch_volume_adjustments
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND adjustment_date < '${openingDate}'::date + INTERVAL '1 day'
      AND CAST(adjustment_amount AS DECIMAL) > 0
  `);
  const sbdPosAdjPreL = Number(sbdPosAdjPreQ.rows[0].total);
  const sbdPosAdjPeriodL = sbdAgg.posAdj - sbdPosAdjPreL;

  console.log('\n  E. POSITIVE ADJUSTMENTS:');
  console.log(`    TTB (period, global):            ${ltog(positiveAdjLiters).toFixed(2)} gal (${positiveAdjLiters.toFixed(2)} L)`);
  console.log(`    SBD (period, eligible):          ${ltog(sbdPosAdjPeriodL).toFixed(2)} gal (${sbdPosAdjPeriodL.toFixed(2)} L)`);
  console.log(`    Diff:                            ${ltog(sbdPosAdjPeriodL - positiveAdjLiters).toFixed(2)} gal`);

  // F. Negative adjustments
  const sbdNegAdjPreQ = await client.query(`
    SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS DECIMAL))), 0) AS total
    FROM batch_volume_adjustments
    WHERE batch_id IN (${idList}) AND deleted_at IS NULL
      AND adjustment_date < '${openingDate}'::date + INTERVAL '1 day'
      AND CAST(adjustment_amount AS DECIMAL) < 0
  `);
  const sbdNegAdjPreL = Number(sbdNegAdjPreQ.rows[0].total);
  const sbdNegAdjPeriodL = sbdAgg.negAdj - sbdNegAdjPreL;

  console.log('\n  F. NEGATIVE ADJUSTMENTS:');
  console.log(`    TTB (period, global):            ${ltog(negAdjLiters).toFixed(2)} gal (${negAdjLiters.toFixed(2)} L)`);
  console.log(`    SBD (period, eligible):          ${ltog(sbdNegAdjPeriodL).toFixed(2)} gal (${sbdNegAdjPeriodL.toFixed(2)} L)`);
  console.log(`    Diff:                            ${ltog(negAdjLiters - sbdNegAdjPeriodL).toFixed(2)} gal`);

  // G. Distillation
  const sbdDistPreQ = await client.query(`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)), 0) AS total
    FROM distillation_records
    WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
      AND status IN ('sent', 'received')
      AND sent_at < '${openingDate}'::date + INTERVAL '1 day'
  `);
  const sbdDistPreL = Number(sbdDistPreQ.rows[0].total);
  const sbdDistPeriodL = sbdAgg.distillation - sbdDistPreL;

  console.log('\n  G. DISTILLATION:');
  console.log(`    TTB (period):                    ${ltog(distillationLiters).toFixed(2)} gal`);
  console.log(`    SBD (period):                    ${ltog(sbdDistPeriodL).toFixed(2)} gal`);
  console.log(`    Diff:                            ${ltog(distillationLiters - sbdDistPeriodL).toFixed(2)} gal`);

  // SUMMARY
  console.log('\n=== VARIANCE DECOMPOSITION SUMMARY ===');
  console.log(`  Opening rounding:                  +${(sbdOpeningGal - openingGal).toFixed(2)} gal`);
  const transferDiff = (ttbBatchFieldLoss + ttbTransferOpLoss) - sbdTransferLossPeriodLiters;
  const bottleDiff = ttbBottlingLossL - sbdBottlingLossPeriodL;
  const rackDiff = rackingLossLiters - sbdRackPeriodLiters;
  const filterDiff = filterLossLiters - sbdFilterPeriodL;
  const posAdjDiff = sbdPosAdjPeriodL - positiveAdjLiters;
  const negAdjDiff = negAdjLiters - sbdNegAdjPeriodL;
  const distDiff = distillationLiters - sbdDistPeriodL;
  console.log(`  Transfer loss diff:                ${ltog(transferDiff).toFixed(2)} gal (TTB deducts more → SBD higher)`);
  console.log(`  Bottling loss diff:                ${ltog(bottleDiff).toFixed(2)} gal (TTB deducts more → SBD higher)`);
  console.log(`  Racking loss diff:                 ${ltog(rackDiff).toFixed(2)} gal`);
  console.log(`  Filter loss diff:                  ${ltog(filterDiff).toFixed(2)} gal`);
  console.log(`  Pos adj diff:                      ${ltog(posAdjDiff).toFixed(2)} gal (SBD adds more → SBD higher)`);
  console.log(`  Neg adj diff:                      ${ltog(negAdjDiff).toFixed(2)} gal`);
  console.log(`  Distillation diff:                 ${ltog(distDiff).toFixed(2)} gal`);
  // Note: distributions (TTB) vs packaging (SBD) and production differences
  // are structurally different but should net out through the opening balance and internal movements

  await client.release();
  await pool.end();
}

main().catch(console.error);
