import "dotenv/config";
import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // ===== STEP 1: Fix opening balance =====
  // Current: hardCider=1066, wine16To21=60, total=1126
  // Correct: hardCider=1061, wine16To21=60, total=1121

  console.log("=== STEP 1: Fix Opening Balance ===\n");

  // Read current
  const [current] = (await db.execute(sql`
    SELECT id, ttb_opening_balances FROM organization_settings LIMIT 1
  `)).rows as any[];

  console.log("Current opening balances:", JSON.stringify(current.ttb_opening_balances, null, 2));

  // Update hardCider from 1066 to 1061
  const balances = current.ttb_opening_balances;
  balances.bulk.hardCider = 1061;

  await db.execute(sql`
    UPDATE organization_settings
    SET ttb_opening_balances = ${JSON.stringify(balances)}::jsonb,
        updated_at = NOW()
    WHERE id = ${current.id}
  `);

  // Verify
  const [updated] = (await db.execute(sql`
    SELECT ttb_opening_balances FROM organization_settings LIMIT 1
  `)).rows as any[];

  const newTotal = updated.ttb_opening_balances.bulk.hardCider + updated.ttb_opening_balances.bulk.wine16To21;
  console.log(`Updated: hardCider=${updated.ttb_opening_balances.bulk.hardCider}, wine16To21=${updated.ttb_opening_balances.bulk.wine16To21}, total=${newTotal}`);
  console.log("✅ Opening balance fixed\n");

  // ===== STEP 2: Debug the variance =====
  console.log("=== STEP 2: Debug Variance Sources ===\n");

  // 2a. Total physical on-hand (live currentVolumeLiters for eligible batches)
  const physResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(current_volume_liters AS DECIMAL)), 0) / 3.78541 as total_gal,
      COUNT(*) as batch_count
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND COALESCE(product_type, 'cider') != 'juice'
  `);
  console.log("Physical on-hand (live currentVolumeLiters):",
    parseFloat((physResult.rows as any[])[0].total_gal).toFixed(1), "gal,",
    (physResult.rows as any[])[0].batch_count, "batches");

  // 2b. Production breakdown: press runs vs SBD initial
  const pressRunProd = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(total_juice_volume_liters AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM press_runs
    WHERE status = 'completed'
      AND date_completed::date > '2024-12-31'::date
      AND date_completed::date <= '2025-12-31'::date
  `);
  console.log("Press run production (2025):", parseFloat((pressRunProd.rows as any[])[0].total_gal).toFixed(1), "gal");

  // 2c. Juice purchases (volume is on juice_purchase_items, with volume_unit)
  const juicePurch = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE WHEN jpi.volume_unit = 'gal' THEN CAST(jpi.volume AS DECIMAL) * 3.78541 ELSE CAST(jpi.volume AS DECIMAL) END
    ), 0) / 3.78541 as total_gal
    FROM juice_purchase_items jpi
    JOIN juice_purchases jp ON jpi.purchase_id = jp.id
    WHERE jp.deleted_at IS NULL
      AND jp.purchase_date::date > '2024-12-31'::date
      AND jp.purchase_date::date <= '2025-12-31'::date
  `);
  console.log("Juice purchases (2025):", parseFloat((juicePurch.rows as any[])[0].total_gal).toFixed(1), "gal");

  // 2d. SBD initial volume of new batches (production in SBD terms)
  const sbdProd = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(initial_volume_liters AS DECIMAL)), 0) / 3.78541 as total_gal,
           COUNT(*) as count
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date > '2024-12-31'::date
      AND start_date::date <= '2025-12-31'::date
  `);
  console.log("SBD new batch initial (2025):", parseFloat((sbdProd.rows as any[])[0].total_gal).toFixed(1), "gal,",
    (sbdProd.rows as any[])[0].count, "batches");

  // 2e. Transfers in/out (net internal movement)
  const tIn = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(volume_transferred AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM batch_transfers
    WHERE deleted_at IS NULL
      AND transferred_at::date > '2024-12-31'::date
      AND transferred_at::date <= '2025-12-31'::date
      AND destination_batch_id IN (
        SELECT id FROM batches WHERE deleted_at IS NULL
          AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
          AND COALESCE(product_type, 'cider') != 'juice'
      )
  `);
  const tOut = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(volume_transferred AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM batch_transfers
    WHERE deleted_at IS NULL
      AND transferred_at::date > '2024-12-31'::date
      AND transferred_at::date <= '2025-12-31'::date
      AND source_batch_id IN (
        SELECT id FROM batches WHERE deleted_at IS NULL
          AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
          AND COALESCE(product_type, 'cider') != 'juice'
      )
  `);
  const tiGal = parseFloat((tIn.rows as any[])[0].total_gal);
  const toGal = parseFloat((tOut.rows as any[])[0].total_gal);
  console.log(`Transfers IN: ${tiGal.toFixed(1)} gal, OUT: ${toGal.toFixed(1)} gal, NET: ${(tiGal - toGal).toFixed(1)} gal`);

  // 2f. Distributions
  const bottleDist = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(volume_taken_liters AS DECIMAL) -
      CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END
    ), 0) / 3.78541 as total_gal
    FROM bottle_runs
    JOIN batches ON bottle_runs.batch_id = batches.id
    WHERE bottle_runs.voided_at IS NULL
      AND batches.deleted_at IS NULL
      AND bottle_runs.status IN ('distributed', 'completed')
      AND bottle_runs.distributed_at::date > '2024-12-31'::date
      AND bottle_runs.distributed_at::date <= '2025-12-31'::date
  `);
  const kegDist = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END
      - CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END
    ), 0) / 3.78541 as total_gal
    FROM keg_fills
    JOIN batches ON keg_fills.batch_id = batches.id
    WHERE keg_fills.voided_at IS NULL
      AND keg_fills.deleted_at IS NULL
      AND batches.deleted_at IS NULL
      AND keg_fills.distributed_at IS NOT NULL
      AND keg_fills.distributed_at::date > '2024-12-31'::date
      AND keg_fills.distributed_at::date <= '2025-12-31'::date
  `);
  const bdGal = parseFloat((bottleDist.rows as any[])[0].total_gal);
  const kdGal = parseFloat((kegDist.rows as any[])[0].total_gal);
  console.log(`Bottle distributions: ${bdGal.toFixed(1)} gal, Keg distributions: ${kdGal.toFixed(1)} gal, Total: ${(bdGal + kdGal).toFixed(1)} gal`);

  // 2g. All losses breakdown
  const rackLoss = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM batch_racking_operations
    WHERE deleted_at IS NULL
      AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
      AND racked_at::date > '2024-12-31'::date AND racked_at::date <= '2025-12-31'::date
      AND batch_id IN (
        SELECT id FROM batches WHERE deleted_at IS NULL
        AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      )
  `);
  const bottleLoss = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END
    ), 0) / 3.78541 as total_gal
    FROM bottle_runs
    JOIN batches ON bottle_runs.batch_id = batches.id
    WHERE bottle_runs.voided_at IS NULL
      AND batches.deleted_at IS NULL
      AND COALESCE(batches.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bottle_runs.packaged_at::date > '2024-12-31'::date AND bottle_runs.packaged_at::date <= '2025-12-31'::date
  `);
  const adjLoss = await db.execute(sql`
    SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS DECIMAL))), 0) / 3.78541 as total_gal
    FROM batch_volume_adjustments
    JOIN batches ON batch_volume_adjustments.batch_id = batches.id
    WHERE batch_volume_adjustments.deleted_at IS NULL
      AND batches.deleted_at IS NULL
      AND COALESCE(batches.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND CAST(adjustment_amount AS DECIMAL) < 0
      AND adjustment_date::date > '2024-12-31'::date AND adjustment_date::date <= '2025-12-31'::date
  `);
  const distillation = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM distillation_records
    WHERE deleted_at IS NULL
      AND status IN ('sent', 'received')
      AND sent_at::date > '2024-12-31'::date AND sent_at::date <= '2025-12-31'::date
  `);

  console.log(`Racking loss: ${parseFloat((rackLoss.rows as any[])[0].total_gal).toFixed(1)} gal`);
  console.log(`Bottling loss: ${parseFloat((bottleLoss.rows as any[])[0].total_gal).toFixed(1)} gal`);
  console.log(`Negative adjustments: ${parseFloat((adjLoss.rows as any[])[0].total_gal).toFixed(1)} gal`);
  console.log(`Distillation: ${parseFloat((distillation.rows as any[])[0].total_gal).toFixed(1)} gal`);

  // 2h. Positive adjustments (inventory gains)
  const posAdj = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)), 0) / 3.78541 as total_gal,
           COUNT(*) as count
    FROM batch_volume_adjustments
    JOIN batches ON batch_volume_adjustments.batch_id = batches.id
    WHERE batch_volume_adjustments.deleted_at IS NULL
      AND batches.deleted_at IS NULL
      AND COALESCE(batches.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND CAST(adjustment_amount AS DECIMAL) > 0
      AND adjustment_date::date > '2024-12-31'::date AND adjustment_date::date <= '2025-12-31'::date
  `);
  console.log(`Positive adjustments (inv gains): ${parseFloat((posAdj.rows as any[])[0].total_gal).toFixed(1)} gal (${(posAdj.rows as any[])[0].count} entries)`);

  // 2i. Packaging (bulk→packaged)
  const bottlePkg = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(volume_taken_liters AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM bottle_runs
    JOIN batches ON bottle_runs.batch_id = batches.id
    WHERE bottle_runs.voided_at IS NULL
      AND batches.deleted_at IS NULL
      AND COALESCE(batches.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bottle_runs.packaged_at::date > '2024-12-31'::date AND bottle_runs.packaged_at::date <= '2025-12-31'::date
  `);
  const kegPkg = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END
    ), 0) / 3.78541 as total_gal
    FROM keg_fills
    JOIN batches ON keg_fills.batch_id = batches.id
    WHERE keg_fills.voided_at IS NULL
      AND keg_fills.deleted_at IS NULL
      AND batches.deleted_at IS NULL
      AND COALESCE(batches.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND keg_fills.filled_at::date > '2024-12-31'::date AND keg_fills.filled_at::date <= '2025-12-31'::date
  `);
  const bpGal = parseFloat((bottlePkg.rows as any[])[0].total_gal);
  const kpGal = parseFloat((kegPkg.rows as any[])[0].total_gal);
  console.log(`Packaging — Bottle: ${bpGal.toFixed(1)} gal, Keg: ${kpGal.toFixed(1)} gal, Total: ${(bpGal + kpGal).toFixed(1)} gal`);

  // 2j. Transfer losses
  const transferLoss = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(loss AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM batch_transfers
    WHERE deleted_at IS NULL
      AND transferred_at::date > '2024-12-31'::date AND transferred_at::date <= '2025-12-31'::date
      AND source_batch_id IN (
        SELECT id FROM batches WHERE deleted_at IS NULL
        AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      )
  `);
  console.log(`Transfer losses: ${parseFloat((transferLoss.rows as any[])[0].total_gal).toFixed(1)} gal`);

  // 2k. Filter losses
  const filterLoss = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM batch_filter_operations
    WHERE deleted_at IS NULL
      AND filtered_at::date > '2024-12-31'::date AND filtered_at::date <= '2025-12-31'::date
      AND batch_id IN (
        SELECT id FROM batches WHERE deleted_at IS NULL
        AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      )
  `);
  console.log(`Filter losses: ${parseFloat((filterLoss.rows as any[])[0].total_gal).toFixed(1)} gal`);

  // 2l. Press transfer losses
  const pressTransferLoss = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(transfer_loss_l AS DECIMAL)), 0) / 3.78541 as total_gal
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date > '2024-12-31'::date AND start_date::date <= '2025-12-31'::date
      AND transfer_loss_l IS NOT NULL
  `);
  console.log(`Press transfer losses: ${parseFloat((pressTransferLoss.rows as any[])[0].total_gal).toFixed(1)} gal`);

  // ===== STEP 3: Manual waterfall calculation =====
  console.log("\n=== STEP 3: Manual Waterfall Calculation ===\n");

  const opening = 1121; // corrected: 1061 + 60
  const production = parseFloat((pressRunProd.rows as any[])[0].total_gal) + parseFloat((juicePurch.rows as any[])[0].total_gal);
  const invGains = parseFloat((posAdj.rows as any[])[0].total_gal);
  const distributed = bdGal + kdGal;
  const packaging = bpGal + kpGal;
  const racking = parseFloat((rackLoss.rows as any[])[0].total_gal);
  const bottling = parseFloat((bottleLoss.rows as any[])[0].total_gal);
  const negAdj = parseFloat((adjLoss.rows as any[])[0].total_gal);
  const tLoss = parseFloat((transferLoss.rows as any[])[0].total_gal);
  const fLoss = parseFloat((filterLoss.rows as any[])[0].total_gal);
  const pLoss = parseFloat((pressTransferLoss.rows as any[])[0].total_gal);
  const dist = parseFloat((distillation.rows as any[])[0].total_gal);
  const totalLosses = racking + bottling + negAdj + tLoss + fLoss + pLoss;
  const physical = parseFloat((physResult.rows as any[])[0].total_gal);

  const calcEnding = opening + production + invGains - distributed - packaging - totalLosses - dist;
  const variance = calcEnding - physical;

  console.log(`Opening:        ${opening.toFixed(1)} gal`);
  console.log(`+ Production:   ${production.toFixed(1)} gal`);
  console.log(`+ Inv Gains:    ${invGains.toFixed(1)} gal`);
  console.log(`- Distributed:  ${distributed.toFixed(1)} gal`);
  console.log(`- Packaged:     ${packaging.toFixed(1)} gal`);
  console.log(`- Losses:       ${totalLosses.toFixed(1)} gal (racking=${racking.toFixed(1)}, bottling=${bottling.toFixed(1)}, adj=${negAdj.toFixed(1)}, transfer=${tLoss.toFixed(1)}, filter=${fLoss.toFixed(1)}, press=${pLoss.toFixed(1)})`);
  console.log(`- Distillation: ${dist.toFixed(1)} gal`);
  console.log(`= Calc Ending:  ${calcEnding.toFixed(1)} gal`);
  console.log(`Physical:       ${physical.toFixed(1)} gal`);
  console.log(`Variance:       ${variance.toFixed(1)} gal`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
