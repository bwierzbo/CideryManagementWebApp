import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const L_TO_GAL = 0.264172;

function ltog(liters: number): number {
  return parseFloat((liters * L_TO_GAL).toFixed(1));
}

function mltog(ml: number): number {
  return parseFloat((ml / 1000 * L_TO_GAL).toFixed(1));
}

async function debug2025() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  console.log('Connected.\n');

  const openingDate = '2024-12-31';
  const endDate = '2025-12-31';

  // ============================================
  // 1. TTB Opening Balance
  // ============================================
  const settings = await client.query(`
    SELECT ttb_opening_balances FROM organization_settings LIMIT 1
  `);
  const balances = settings.rows[0]?.ttb_opening_balances;
  // balances.bulk and balances.bottled are objects with tax class keys
  const bulkTotal = Object.values(balances?.bulk || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const bottledTotal = Object.values(balances?.bottled || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const spiritsTotal = Object.values(balances?.spirits || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const opening = bulkTotal + bottledTotal + spiritsTotal;
  console.log('=== TTB OPENING BALANCE ===');
  console.log(`  Bulk: ${bulkTotal.toFixed(1)} gal, Bottled: ${bottledTotal.toFixed(1)} gal, Spirits: ${spiritsTotal.toFixed(1)} gal`);
  console.log(`  Total: ${opening.toFixed(1)} gal\n`);

  // ============================================
  // 2. TTB Production (press runs + juice purchases)
  // ============================================
  const pressRuns = await client.query(`
    SELECT COALESCE(SUM(CAST(total_juice_volume_liters AS DECIMAL)), 0) as total_l
    FROM press_runs
    WHERE deleted_at IS NULL
      AND status = 'completed'
      AND date_completed::date > $1::date
      AND date_completed::date <= $2::date
  `, [openingDate, endDate]);
  const pressRunL = parseFloat(pressRuns.rows[0].total_l);

  const juicePurchases = await client.query(`
    SELECT COALESCE(SUM(
      CASE WHEN jpi.volume_unit = 'gal' THEN CAST(jpi.volume AS DECIMAL) * 3.78541
           ELSE CAST(jpi.volume AS DECIMAL) END
    ), 0) as total_l
    FROM juice_purchase_items jpi
    JOIN juice_purchases jp ON jp.id = jpi.purchase_id
    WHERE jp.deleted_at IS NULL
      AND jpi.deleted_at IS NULL
      AND jp.purchase_date::date > $1::date
      AND jp.purchase_date::date <= $2::date
  `, [openingDate, endDate]);
  const juicePurchaseL = parseFloat(juicePurchases.rows[0].total_l);

  // Juice-only batches (subtract from production)
  const juiceOnly = await client.query(`
    SELECT COALESCE(SUM(CAST(b.initial_volume_liters AS DECIMAL)), 0) as total_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.product_type, 'cider') = 'juice'
      AND b.start_date::date > $1::date
      AND b.start_date::date <= $2::date
  `, [openingDate, endDate]);
  const juiceOnlyL = parseFloat(juiceOnly.rows[0].total_l);

  // Transfers INTO juice batches (subtract from production)
  const xfrsToJuice = await client.query(`
    SELECT COALESCE(SUM(CAST(t.volume_transferred AS DECIMAL)), 0) as total_l
    FROM batch_transfers t
    JOIN batches dest ON dest.id = t.destination_batch_id
    WHERE COALESCE(dest.product_type, 'cider') = 'juice'
      AND t.transferred_at::date > $1::date
      AND t.transferred_at::date <= $2::date
  `, [openingDate, endDate]);
  const xfrsToJuiceL = parseFloat(xfrsToJuice.rows[0].total_l);

  const totalProductionL = pressRunL + juicePurchaseL - juiceOnlyL - xfrsToJuiceL;

  // Brandy received (from distillation_records.received_volume_liters)
  const brandyRcvd = await client.query(`
    SELECT COALESCE(SUM(CAST(received_volume_liters AS DECIMAL)), 0) as total_l
    FROM distillation_records
    WHERE deleted_at IS NULL
      AND received_volume_liters IS NOT NULL
      AND received_at::date > $1::date
      AND received_at::date <= $2::date
  `, [openingDate, endDate]);
  const brandyL = parseFloat(brandyRcvd.rows[0].total_l);

  const totalProductionGal = ltog(totalProductionL) + ltog(brandyL);

  console.log('=== TTB PRODUCTION ===');
  console.log(`  Press runs: ${ltog(pressRunL)} gal (${pressRunL.toFixed(1)} L)`);
  console.log(`  Juice purchases: ${ltog(juicePurchaseL)} gal`);
  console.log(`  Juice-only: -${ltog(juiceOnlyL)} gal`);
  console.log(`  Transfers to juice: -${ltog(xfrsToJuiceL)} gal`);
  console.log(`  Brandy received: ${ltog(brandyL)} gal`);
  console.log(`  Total production: ${totalProductionGal} gal\n`);

  // ============================================
  // 3. Positive adjustments (bulk)
  // ============================================
  const posAdj = await client.query(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)), 0) as total_l
    FROM batch_volume_adjustments
    WHERE deleted_at IS NULL
      AND adjustment_date::date > $1::date
      AND adjustment_date::date <= $2::date
      AND CAST(adjustment_amount AS DECIMAL) > 0
  `, [openingDate, endDate]);
  const posAdjGal = ltog(parseFloat(posAdj.rows[0].total_l));
  console.log(`=== POSITIVE ADJUSTMENTS (bulk) === ${posAdjGal} gal\n`);

  // ============================================
  // 4. SALES / Distributions
  // ============================================
  const bottleDist = await client.query(`
    SELECT COALESCE(SUM(
      CAST(id2.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
    ), 0) as total_ml
    FROM inventory_distributions id2
    JOIN inventory_items ii ON ii.id = id2.inventory_item_id
    WHERE id2.distribution_date::date > $1::date
      AND id2.distribution_date::date <= $2::date
  `, [openingDate, endDate]);
  const bottleDistGal = mltog(parseFloat(bottleDist.rows[0].total_ml));

  const kegDist = await client.query(`
    SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)), 0) as total_l
    FROM keg_fills
    WHERE distributed_at IS NOT NULL
      AND voided_at IS NULL
      AND deleted_at IS NULL
      AND distributed_at::date > $1::date
      AND distributed_at::date <= $2::date
  `, [openingDate, endDate]);
  const kegDistGal = ltog(parseFloat(kegDist.rows[0].total_l));

  const totalSalesGal = bottleDistGal + kegDistGal;
  console.log('=== SALES ===');
  console.log(`  Bottle distributions: ${bottleDistGal} gal`);
  console.log(`  Keg distributions: ${kegDistGal} gal`);
  console.log(`  Total: ${totalSalesGal} gal\n`);

  // ============================================
  // 5. LOSSES (process losses)
  // ============================================
  const rackingLoss = await client.query(`
    SELECT COALESCE(SUM(CAST(bro.volume_loss AS DECIMAL)), 0) as total_l
    FROM batch_racking_operations bro
    JOIN batches b ON b.id = bro.batch_id
    WHERE bro.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bro.racked_at::date > $1::date
      AND bro.racked_at::date <= $2::date
  `, [openingDate, endDate]);
  const rackingLossL = parseFloat(rackingLoss.rows[0].total_l);

  // Transfer operation losses
  const xfrOpLoss = await client.query(`
    SELECT COALESCE(SUM(CAST(t.loss AS DECIMAL)), 0) as total_l
    FROM batch_transfers t
    WHERE t.loss IS NOT NULL
      AND CAST(t.loss AS DECIMAL) > 0
      AND t.transferred_at::date > $1::date
      AND t.transferred_at::date <= $2::date
  `, [openingDate, endDate]);
  const xfrOpLossL = parseFloat(xfrOpLoss.rows[0].total_l);

  const filterLoss = await client.query(`
    SELECT COALESCE(SUM(CAST(bfo.volume_loss AS DECIMAL)), 0) as total_l
    FROM batch_filter_operations bfo
    JOIN batches b ON b.id = bfo.batch_id
    WHERE bfo.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bfo.filtered_at::date > $1::date
      AND bfo.filtered_at::date <= $2::date
  `, [openingDate, endDate]);
  const filterLossL = parseFloat(filterLoss.rows[0].total_l);

  const bottlingLoss = await client.query(`
    SELECT COALESCE(SUM(CAST(br.loss AS DECIMAL)), 0) as total_l
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE br.voided_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND br.packaged_at::date > $1::date
      AND br.packaged_at::date <= $2::date
  `, [openingDate, endDate]);
  const bottlingLossL = parseFloat(bottlingLoss.rows[0].total_l);

  const negAdj = await client.query(`
    SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS DECIMAL))), 0) as total_l
    FROM batch_volume_adjustments
    WHERE deleted_at IS NULL
      AND adjustment_date::date > $1::date
      AND adjustment_date::date <= $2::date
      AND CAST(adjustment_amount AS DECIMAL) < 0
  `, [openingDate, endDate]);
  const negAdjL = parseFloat(negAdj.rows[0].total_l);

  const kegFillLoss = await client.query(`
    SELECT COALESCE(SUM(CAST(loss AS DECIMAL)), 0) as total_l
    FROM keg_fills
    WHERE voided_at IS NULL
      AND deleted_at IS NULL
      AND loss IS NOT NULL
      AND filled_at::date > $1::date
      AND filled_at::date <= $2::date
  `, [openingDate, endDate]);
  const kegFillLossL = parseFloat(kegFillLoss.rows[0].total_l);

  const totalTransferLossL = rackingLossL + xfrOpLossL;
  const processLossGal = ltog(totalTransferLossL + filterLossL + bottlingLossL + negAdjL + kegFillLossL);

  console.log('=== PROCESS LOSSES ===');
  console.log(`  Racking (batch.transfer_loss_l): ${ltog(rackingLossL)} gal`);
  console.log(`  Transfer ops (batch_transfers.loss): ${ltog(xfrOpLossL)} gal`);
  console.log(`  Filter losses: ${ltog(filterLossL)} gal`);
  console.log(`  Bottling losses: ${ltog(bottlingLossL)} gal`);
  console.log(`  Negative adjustments: ${ltog(negAdjL)} gal`);
  console.log(`  Keg fill losses: ${ltog(kegFillLossL)} gal`);
  console.log(`  Total process losses: ${processLossGal} gal\n`);

  // Distillation
  const distillation = await client.query(`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)), 0) as total_l
    FROM distillation_records
    WHERE deleted_at IS NULL
      AND sent_at::date > $1::date
      AND sent_at::date <= $2::date
  `, [openingDate, endDate]);
  const distillGal = ltog(parseFloat(distillation.rows[0].total_l));
  console.log(`=== DISTILLATION === ${distillGal} gal\n`);

  const totalRemovalsGal = totalSalesGal + processLossGal + distillGal;

  // ============================================
  // 6. TTB CALCULATED ENDING
  // ============================================
  const ttbEnding = parseFloat((opening + totalProductionGal + posAdjGal - totalSalesGal - processLossGal - distillGal).toFixed(1));
  console.log('=== TTB CALCULATED ENDING ===');
  console.log(`  ${opening} + ${totalProductionGal} + ${posAdjGal} - ${totalSalesGal} - ${processLossGal} - ${distillGal} = ${ttbEnding} gal\n`);

  // ============================================
  // 7. SYSTEM ON HAND (live inventory)
  // ============================================
  // Bulk: verified batches with currentVolume > 0
  const bulkOnHand = await client.query(`
    SELECT COALESCE(SUM(CAST(current_volume_liters AS DECIMAL)), 0) as total_l
    FROM batches
    WHERE deleted_at IS NULL
      AND reconciliation_status = 'verified'
      AND start_date <= $1::date
      AND COALESCE(current_volume_liters, 0) > 0
      AND COALESCE(is_archived, false) = false
      AND NOT (batch_number LIKE 'LEGACY-%')
  `, [endDate]);
  const bulkOnHandGal = ltog(parseFloat(bulkOnHand.rows[0].total_l));

  // Packaged: inventory items from verified batches
  const packagedOnHand = await client.query(`
    SELECT COALESCE(SUM(
      CAST(ii.current_quantity AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
    ), 0) as total_ml
    FROM inventory_items ii
    JOIN bottle_runs br ON br.id = ii.bottle_run_id
    JOIN batches b ON b.id = br.batch_id
    WHERE ii.deleted_at IS NULL
      AND b.reconciliation_status = 'verified'
      AND ii.current_quantity > 0
      AND b.start_date <= $1::date
  `, [endDate]);
  const packagedOnHandGal = mltog(parseFloat(packagedOnHand.rows[0].total_ml));

  const systemOnHand = parseFloat((bulkOnHandGal + packagedOnHandGal).toFixed(1));
  console.log('=== SYSTEM ON HAND ===');
  console.log(`  Bulk (verified): ${bulkOnHandGal} gal`);
  console.log(`  Packaged (verified): ${packagedOnHandGal} gal`);
  console.log(`  Total: ${systemOnHand} gal\n`);

  // ============================================
  // 8. VARIANCE
  // ============================================
  const variance = parseFloat((ttbEnding - systemOnHand).toFixed(1));
  console.log(`=== VARIANCE: ${variance} gal (${((variance / ttbEnding) * 100).toFixed(1)}%) ===\n`);

  // ============================================
  // 9. DIAGNOSTICS - Find the gap
  // ============================================
  console.log('=== DIAGNOSTICS ===\n');

  // Check for batches NOT verified but with volume
  const nonVerifiedWithVol = await client.query(`
    SELECT name, reconciliation_status, CAST(current_volume_liters AS DECIMAL) as cv_l,
           COALESCE(is_archived, false) as archived, batch_number
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND reconciliation_status != 'verified'
      AND start_date <= $1::date
      AND COALESCE(current_volume_liters, 0) > 0
      AND COALESCE(product_type, 'cider') != 'juice'
    ORDER BY CAST(current_volume_liters AS DECIMAL) DESC
  `, [endDate]);
  if (nonVerifiedWithVol.rows.length > 0) {
    let total = 0;
    console.log('Pending batches with volume (excluded from systemOnHand):');
    for (const r of nonVerifiedWithVol.rows) {
      const gal = ltog(parseFloat(r.cv_l));
      total += gal;
      console.log(`  ${r.name}: ${gal} gal (status=${r.reconciliation_status}, archived=${r.archived})`);
    }
    console.log(`  → Total: ${total.toFixed(1)} gal excluded\n`);
  } else {
    console.log('No pending batches with volume.\n');
  }

  // Check for archived batches with volume
  const archivedWithVol = await client.query(`
    SELECT name, CAST(current_volume_liters AS DECIMAL) as cv_l, reconciliation_status
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(is_archived, false) = true
      AND COALESCE(current_volume_liters, 0) > 0
      AND start_date <= $1::date
    ORDER BY CAST(current_volume_liters AS DECIMAL) DESC
  `, [endDate]);
  if (archivedWithVol.rows.length > 0) {
    let total = 0;
    console.log('Archived batches with volume (excluded from systemOnHand):');
    for (const r of archivedWithVol.rows) {
      const gal = ltog(parseFloat(r.cv_l));
      total += gal;
      console.log(`  ${r.name}: ${gal} gal (status=${r.reconciliation_status})`);
    }
    console.log(`  → Total: ${total.toFixed(1)} gal excluded\n`);
  } else {
    console.log('No archived batches with volume.\n');
  }

  // Check LEGACY batches with volume
  const legacyWithVol = await client.query(`
    SELECT name, batch_number, CAST(current_volume_liters AS DECIMAL) as cv_l, reconciliation_status
    FROM batches
    WHERE deleted_at IS NULL
      AND batch_number LIKE 'LEGACY-%'
      AND COALESCE(current_volume_liters, 0) > 0
    ORDER BY CAST(current_volume_liters AS DECIMAL) DESC
  `);
  if (legacyWithVol.rows.length > 0) {
    let total = 0;
    console.log('LEGACY batches with volume (excluded from systemOnHand):');
    for (const r of legacyWithVol.rows) {
      const gal = ltog(parseFloat(r.cv_l));
      total += gal;
      console.log(`  ${r.name}: ${gal} gal (status=${r.reconciliation_status})`);
    }
    console.log(`  → Total: ${total.toFixed(1)} gal excluded\n`);
  } else {
    console.log('No LEGACY batches with volume.\n');
  }

  // Check inventory_adjustments on packaged goods (not in TTB formula!)
  const invAdj = await client.query(`
    SELECT
      COALESCE(SUM(CASE WHEN CAST(ia.quantity_change AS DECIMAL) > 0
        THEN CAST(ia.quantity_change AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL) ELSE 0 END), 0) as pos_ml,
      COALESCE(SUM(CASE WHEN CAST(ia.quantity_change AS DECIMAL) < 0
        THEN ABS(CAST(ia.quantity_change AS DECIMAL)) * CAST(ii.package_size_ml AS DECIMAL) ELSE 0 END), 0) as neg_ml,
      COUNT(*) as cnt
    FROM inventory_adjustments ia
    JOIN inventory_items ii ON ii.id = ia.inventory_item_id
    WHERE ia.adjusted_at::date > $1::date
      AND ia.adjusted_at::date <= $2::date
  `, [openingDate, endDate]);
  const posInvAdjGal = mltog(parseFloat(invAdj.rows[0].pos_ml));
  const negInvAdjGal = mltog(parseFloat(invAdj.rows[0].neg_ml));
  console.log(`Packaged inventory adjustments (inventory_adjustments table):
  Count: ${invAdj.rows[0].cnt}
  Positive (gains): +${posInvAdjGal} gal
  Negative (shrinkage): -${negInvAdjGal} gal
  Net: ${(posInvAdjGal - negInvAdjGal).toFixed(1)} gal
  *** These are NOT in the TTB formula! ***\n`);

  // Check for voided bottle runs that might be counted in TTB packaging
  const voidedBottleRuns = await client.query(`
    SELECT COUNT(*) as cnt,
      COALESCE(SUM(CAST(volume_taken_liters AS DECIMAL)), 0) as total_l
    FROM bottle_runs
    WHERE voided_at IS NOT NULL
      AND packaged_at::date > $1::date
      AND packaged_at::date <= $2::date
  `, [openingDate, endDate]);
  console.log(`Voided bottle runs (counted in bottlesPackagedBefore without voidedAt filter):
  Count: ${voidedBottleRuns.rows[0].cnt}
  Volume: ${ltog(parseFloat(voidedBottleRuns.rows[0].total_l))} gal\n`);

  // Check for duplicate/excluded batches with bottle runs or keg fills in period
  const dupExclPackaging = await client.query(`
    SELECT
      'bottle_runs' as source,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)), 0) as total_l
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE br.voided_at IS NULL
      AND b.reconciliation_status IN ('duplicate', 'excluded')
      AND br.packaged_at::date > $1::date
      AND br.packaged_at::date <= $2::date
    UNION ALL
    SELECT
      'keg_fills' as source,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)), 0) as total_l
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id
    WHERE kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
      AND b.reconciliation_status IN ('duplicate', 'excluded')
      AND kf.filled_at::date > $1::date
      AND kf.filled_at::date <= $2::date
  `, [openingDate, endDate]);
  console.log('Packaging from duplicate/excluded batches:');
  for (const r of dupExclPackaging.rows) {
    console.log(`  ${r.source}: ${r.cnt} records, ${ltog(parseFloat(r.total_l))} gal`);
  }
  console.log();

  // Check for 2025 initial volume anomalies (transfer-derived with init > 0)
  const anomalies2025 = await client.query(`
    SELECT b.id, b.name, CAST(b.initial_volume_liters AS DECIMAL) as init_l,
      b.reconciliation_status,
      COALESCE(t_agg.total_in, 0) as xfr_in_l
    FROM batches b
    LEFT JOIN LATERAL (
      SELECT SUM(CAST(t.volume_transferred AS DECIMAL)) as total_in
      FROM batch_transfers t
      WHERE t.destination_batch_id = b.id
    ) t_agg ON true
    WHERE b.deleted_at IS NULL
      AND b.parent_batch_id IS NOT NULL
      AND CAST(b.initial_volume_liters AS DECIMAL) > 0
      AND b.start_date >= '2025-01-01' AND b.start_date <= '2025-12-31'
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND t_agg.total_in >= CAST(b.initial_volume_liters AS DECIMAL) * 0.9
    ORDER BY CAST(b.initial_volume_liters AS DECIMAL) DESC
  `);
  if (anomalies2025.rows.length > 0) {
    let total = 0;
    console.log('2025 Initial Volume Anomalies (transfer-derived with init > 0):');
    for (const r of anomalies2025.rows) {
      const gal = ltog(parseFloat(r.init_l));
      total += gal;
      console.log(`  ${r.name}: init=${parseFloat(r.init_l).toFixed(1)}L (${gal} gal), xfr_in=${parseFloat(r.xfr_in_l).toFixed(1)}L, status=${r.reconciliation_status}`);
    }
    console.log(`  → Total anomaly volume: ${total.toFixed(1)} gal\n`);
  } else {
    console.log('No 2025 initial volume anomalies.\n');
  }

  // Drift check: batches where currentVolume != reconstructed volume
  // Show the top drifters
  const driftBatches = await client.query(`
    WITH batch_ops AS (
      SELECT b.id, b.name, b.reconciliation_status,
        CAST(b.initial_volume_liters AS DECIMAL) as init_l,
        CAST(b.current_volume_liters AS DECIMAL) as cv_l,
        b.parent_batch_id IS NOT NULL as has_parent,
        COALESCE((SELECT SUM(CAST(t.volume_transferred AS DECIMAL)) FROM batch_transfers t WHERE t.destination_batch_id = b.id), 0) as xfr_in_l,
        COALESCE((SELECT SUM(CAST(t.volume_transferred AS DECIMAL)) FROM batch_transfers t WHERE t.source_batch_id = b.id), 0) as xfr_out_l,
        COALESCE((SELECT SUM(CAST(t.loss AS DECIMAL)) FROM batch_transfers t WHERE t.source_batch_id = b.id AND t.loss IS NOT NULL), 0) as xfr_loss_l,
        COALESCE(CAST(b.transfer_loss_l AS DECIMAL), 0) as racking_loss_l,
        COALESCE((SELECT SUM(CAST(br.volume_taken_liters AS DECIMAL)) FROM bottle_runs br WHERE br.batch_id = b.id AND br.voided_at IS NULL), 0) as bottled_l,
        COALESCE((SELECT SUM(CAST(br.loss AS DECIMAL)) FROM bottle_runs br WHERE br.batch_id = b.id AND br.voided_at IS NULL AND br.loss IS NOT NULL), 0) as bottling_loss_l,
        COALESCE((SELECT SUM(CAST(kf.volume_taken AS DECIMAL)) FROM keg_fills kf WHERE kf.batch_id = b.id AND kf.voided_at IS NULL AND kf.deleted_at IS NULL), 0) as kegged_l,
        COALESCE((SELECT SUM(CAST(kf.loss AS DECIMAL)) FROM keg_fills kf WHERE kf.batch_id = b.id AND kf.voided_at IS NULL AND kf.deleted_at IS NULL AND kf.loss IS NOT NULL), 0) as keg_loss_l,
        COALESCE((SELECT SUM(CAST(bfo.volume_loss AS DECIMAL)) FROM batch_filter_operations bfo WHERE bfo.batch_id = b.id AND bfo.deleted_at IS NULL), 0) as filter_loss_l,
        COALESCE((SELECT SUM(CAST(adj.adjustment_amount AS DECIMAL)) FROM batch_volume_adjustments adj WHERE adj.batch_id = b.id AND adj.deleted_at IS NULL), 0) as adj_l,
        COALESCE((SELECT SUM(CAST(dr.source_volume_liters AS DECIMAL)) FROM distillation_records dr WHERE dr.source_batch_id = b.id AND dr.deleted_at IS NULL), 0) as distill_l
      FROM batches b
      WHERE b.deleted_at IS NULL
        AND b.reconciliation_status = 'verified'
        AND b.start_date <= $1::date
        AND COALESCE(b.product_type, 'cider') != 'juice'
    )
    SELECT *,
      CASE WHEN has_parent AND xfr_in_l >= init_l * 0.9 THEN 0 ELSE init_l END as effective_init,
      (CASE WHEN has_parent AND xfr_in_l >= init_l * 0.9 THEN 0 ELSE init_l END)
        + xfr_in_l - xfr_out_l - xfr_loss_l - racking_loss_l - bottled_l - bottling_loss_l
        - kegged_l - keg_loss_l - filter_loss_l + adj_l - distill_l as reconstructed_l
    FROM batch_ops
    WHERE ABS(
      cv_l - (
        (CASE WHEN has_parent AND xfr_in_l >= init_l * 0.9 THEN 0 ELSE init_l END)
        + xfr_in_l - xfr_out_l - xfr_loss_l - racking_loss_l - bottled_l - bottling_loss_l
        - kegged_l - keg_loss_l - filter_loss_l + adj_l - distill_l
      )
    ) > 1
    ORDER BY ABS(cv_l - (
      (CASE WHEN has_parent AND xfr_in_l >= init_l * 0.9 THEN 0 ELSE init_l END)
      + xfr_in_l - xfr_out_l - xfr_loss_l - racking_loss_l - bottled_l - bottling_loss_l
      - kegged_l - keg_loss_l - filter_loss_l + adj_l - distill_l
    )) DESC
    LIMIT 20
  `, [endDate]);
  if (driftBatches.rows.length > 0) {
    let totalDrift = 0;
    console.log('Batches with drift > 1L (currentVol vs reconstructed):');
    for (const r of driftBatches.rows) {
      const cv = parseFloat(r.cv_l);
      const recon = parseFloat(r.reconstructed_l);
      const drift = cv - recon;
      totalDrift += drift;
      console.log(`  ${(r.name || '?').substring(0, 40).padEnd(40)} cv=${cv.toFixed(1).padStart(8)}L  recon=${recon.toFixed(1).padStart(8)}L  drift=${drift.toFixed(1).padStart(8)}L  (${ltog(Math.abs(drift))} gal)`);
    }
    console.log(`  → Total drift: ${totalDrift.toFixed(1)} L (${ltog(Math.abs(totalDrift))} gal)\n`);
  } else {
    console.log('No batches with significant drift.\n');
  }

  client.release();
  await pool.end();
}

debug2025().catch(console.error);
