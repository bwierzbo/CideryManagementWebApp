import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(2);
const openDate = "2024-12-31";
const endDate = "2025-12-31";

async function main() {
  await c.connect();

  // ============================================================
  // TTB SIDE — aggregate queries (same as getReconciliationSummary)
  // ============================================================

  // Opening balance (configured)
  const settings = await c.query(
    `SELECT ttb_opening_balances FROM organization_settings LIMIT 1`
  );
  const balances = settings.rows[0]?.ttb_opening_balances || {};
  const ttbOpeningGal =
    (balances.bulk?.hardCider || 0) + (balances.bottled?.hardCider || 0) +
    (balances.bulk?.wineUnder16 || 0) + (balances.bottled?.wineUnder16 || 0) +
    (balances.bulk?.wine16To21 || 0) + (balances.bottled?.wine16To21 || 0) +
    (balances.bulk?.sparklingWine || 0) + (balances.bottled?.sparklingWine || 0) +
    (balances.bulk?.carbonatedWine || 0) + (balances.bottled?.carbonatedWine || 0) +
    (balances.spirits?.appleBrandy || 0) + (balances.spirits?.grapeSpirits || 0);

  // Production: press runs + juice purchases
  const pressRuns = await c.query(
    `SELECT COALESCE(SUM(CAST(total_juice_volume_liters AS DECIMAL)),0) as total_l
     FROM press_runs
     WHERE deleted_at IS NULL AND status = 'completed'
       AND date_completed::date > $1::date AND date_completed::date <= $2::date`,
    [openDate, endDate]
  );
  const juicePurchases = await c.query(
    `SELECT COALESCE(SUM(
       CASE WHEN jpi.volume_unit = 'gal' THEN CAST(jpi.volume AS DECIMAL) * 3.78541
            ELSE CAST(jpi.volume AS DECIMAL) END
     ), 0) as total_l
     FROM juice_purchase_items jpi
     JOIN juice_purchases jp ON jpi.purchase_id = jp.id
     WHERE jpi.deleted_at IS NULL AND jp.deleted_at IS NULL
       AND jp.purchase_date::date > $1::date AND jp.purchase_date::date <= $2::date`,
    [openDate, endDate]
  );
  // Juice-only batch exclusion (subtract initial volumes of batches whose ONLY source is juice purchases)
  const juiceOnlyExcl = await c.query(
    `SELECT COALESCE(SUM(CAST(b.initial_volume_liters AS DECIMAL)),0) as total_l
     FROM batches b
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND b.origin_press_run_id IS NULL
       AND b.start_date::date > $1::date AND b.start_date::date <= $2::date
       AND EXISTS (
         SELECT 1 FROM batch_merge_history bmh
         WHERE bmh.target_batch_id = b.id AND bmh.deleted_at IS NULL
           AND bmh.source_juice_purchase_item_id IS NOT NULL
       )`,
    [openDate, endDate]
  );
  // Transfers into juice-only batches (subtracted from production to avoid double-counting)
  const transfersIntoJuice = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)),0) as total_l
     FROM batch_transfers bt
     JOIN batches dest ON bt.destination_batch_id = dest.id
     WHERE bt.deleted_at IS NULL AND dest.deleted_at IS NULL
       AND dest.origin_press_run_id IS NULL
       AND bt.transferred_at::date > $1::date AND bt.transferred_at::date <= $2::date`,
    [openDate, endDate]
  );

  const pressL = parseFloat(pressRuns.rows[0].total_l);
  const juiceL = parseFloat(juicePurchases.rows[0].total_l);
  const juiceExclL = parseFloat(juiceOnlyExcl.rows[0].total_l);
  const xferIntoJuiceL = parseFloat(transfersIntoJuice.rows[0].total_l);

  // Positive adjustments (added to production in TTB)
  const posAdj = await c.query(
    `SELECT COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)),0) as total_l
     FROM batch_volume_adjustments
     WHERE deleted_at IS NULL
       AND adjustment_date::date > $1::date AND adjustment_date::date <= $2::date
       AND CAST(adjustment_amount AS DECIMAL) > 0`,
    [openDate, endDate]
  );
  const posAdjL = parseFloat(posAdj.rows[0].total_l);

  const ttbProductionL = pressL + juiceL - juiceExclL - xferIntoJuiceL + posAdjL;

  // Distributions (unfiltered)
  const bottleDist = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     WHERE id.distribution_date::date > $1::date AND id.distribution_date::date <= $2::date`,
    [openDate, endDate]
  );
  const kegDist = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills
     WHERE distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
       AND distributed_at::date > $1::date AND distributed_at::date <= $2::date`,
    [openDate, endDate]
  );
  const ttbDistL = parseFloat(bottleDist.rows[0].total_l) + parseFloat(kegDist.rows[0].total_l);

  // Losses (batch-filtered for racking/filter/bottling/transfer, unfiltered for adjustments/keg)
  const rackingLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(bro.volume_loss AS DECIMAL)),0) as total_l
     FROM batch_racking_operations bro
     JOIN batches b ON bro.batch_id = b.id
     WHERE bro.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND bro.racked_at::date > $1::date AND bro.racked_at::date <= $2::date`,
    [openDate, endDate]
  );
  const filterLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(bfo.volume_loss AS DECIMAL)),0) as total_l
     FROM batch_filter_operations bfo
     JOIN batches b ON bfo.batch_id = b.id
     WHERE bfo.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND bfo.filtered_at::date > $1::date AND bfo.filtered_at::date <= $2::date`,
    [openDate, endDate]
  );
  const bottlingLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(br.loss AS DECIMAL)),0) as total_l
     FROM bottle_runs br
     JOIN batches b ON br.batch_id = b.id
     WHERE br.voided_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND br.packaged_at::date > $1::date AND br.packaged_at::date <= $2::date`,
    [openDate, endDate]
  );
  const transferLossBatch = await c.query(
    `SELECT COALESCE(SUM(CAST(b.transfer_loss_l AS DECIMAL)),0) as total_l
     FROM batches b
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND b.start_date::date > $1::date AND b.start_date::date <= $2::date`,
    [openDate, endDate]
  );
  const transferLossOp = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.loss AS DECIMAL)),0) as total_l
     FROM batch_transfers bt
     JOIN batches b ON bt.source_batch_id = b.id
     WHERE bt.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND bt.transferred_at::date > $1::date AND bt.transferred_at::date <= $2::date`,
    [openDate, endDate]
  );
  // Volume adjustments (negative = losses) — UNFILTERED in aggregate
  const negAdj = await c.query(
    `SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS DECIMAL))),0) as total_l
     FROM batch_volume_adjustments
     WHERE deleted_at IS NULL
       AND adjustment_date::date > $1::date AND adjustment_date::date <= $2::date
       AND CAST(adjustment_amount AS DECIMAL) < 0`,
    [openDate, endDate]
  );
  // Keg fill losses — UNFILTERED in aggregate
  const kegFillLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(loss AS DECIMAL)),0) as total_l
     FROM keg_fills
     WHERE voided_at IS NULL AND deleted_at IS NULL AND loss IS NOT NULL
       AND filled_at::date > $1::date AND filled_at::date <= $2::date`,
    [openDate, endDate]
  );

  const ttbLossesL =
    parseFloat(rackingLoss.rows[0].total_l) +
    parseFloat(filterLoss.rows[0].total_l) +
    parseFloat(bottlingLoss.rows[0].total_l) +
    parseFloat(transferLossBatch.rows[0].total_l) +
    parseFloat(transferLossOp.rows[0].total_l) +
    parseFloat(negAdj.rows[0].total_l) +
    parseFloat(kegFillLoss.rows[0].total_l);

  // Distillation — UNFILTERED
  const distillation = await c.query(
    `SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)),0) as total_l
     FROM distillation_records
     WHERE deleted_at IS NULL
       AND sent_at::date > $1::date AND sent_at::date <= $2::date`,
    [openDate, endDate]
  );
  const ttbDistillL = parseFloat(distillation.rows[0].total_l);

  const ttbEndingL = ttbOpeningGal * 3.78541 + ttbProductionL - ttbDistL - ttbLossesL - ttbDistillL;

  // ============================================================
  // SYSTEM SIDE — per-batch reconstruction (eligible batches only)
  // ============================================================

  // Get all eligible batch IDs
  const eligibleBatches = await c.query(
    `SELECT id, name, start_date, initial_volume_liters, current_volume_liters
     FROM batches
     WHERE deleted_at IS NULL
       AND COALESCE(reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND (
         start_date::date <= $1::date
         OR EXISTS (SELECT 1 FROM batch_merge_history bmh WHERE bmh.target_batch_id = batches.id AND bmh.deleted_at IS NULL)
         OR origin_press_run_id IS NOT NULL
       )`,
    [endDate]
  );
  const batchIds = eligibleBatches.rows.map((b: any) => b.id);
  const idList = batchIds.map((id: string) => `'${id}'`).join(",");

  // System opening: reconstructed volumes at opening date
  // (For carried-forward batches, their volume at 2024-12-31)
  // For now, use configured opening balance (same as TTB)
  const sysOpeningGal = ttbOpeningGal; // Both use same configured opening

  // System production: sum of eligible batch initial volumes (from press runs, not transfers)
  // + external merges (from press runs and juice purchases, not from other batches)
  const sysInitials = await c.query(
    `SELECT COALESCE(SUM(CAST(initial_volume_liters AS DECIMAL)),0) as total_l
     FROM batches
     WHERE deleted_at IS NULL
       AND COALESCE(reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND start_date::date > $1::date AND start_date::date <= $2::date`,
    [openDate, endDate]
  );
  const sysMergesExternal = await c.query(
    `SELECT COALESCE(SUM(CAST(bmh.volume_added AS DECIMAL)),0) as total_l
     FROM batch_merge_history bmh
     JOIN batches b ON bmh.target_batch_id = b.id
     WHERE bmh.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND bmh.merged_at::date > $1::date AND bmh.merged_at::date <= $2::date
       AND (bmh.source_press_run_id IS NOT NULL OR bmh.source_juice_purchase_item_id IS NOT NULL)`,
    [openDate, endDate]
  );
  // Positive adjustments for eligible batches only
  const sysPosAdj = await c.query(
    `SELECT COALESCE(SUM(CAST(bva.adjustment_amount AS DECIMAL)),0) as total_l
     FROM batch_volume_adjustments bva
     JOIN batches b ON bva.batch_id = b.id
     WHERE bva.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND bva.adjustment_date::date > $1::date AND bva.adjustment_date::date <= $2::date
       AND CAST(bva.adjustment_amount AS DECIMAL) > 0`,
    [openDate, endDate]
  );

  const sysInitL = parseFloat(sysInitials.rows[0].total_l);
  const sysMergeExtL = parseFloat(sysMergesExternal.rows[0].total_l);
  const sysPosAdjL = parseFloat(sysPosAdj.rows[0].total_l);
  const sysProductionL = sysInitL + sysMergeExtL + sysPosAdjL;

  // System distributions (batch-scoped, full history)
  const sysBottleDist = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     WHERE br.batch_id IN (${idList})
       AND br.voided_at IS NULL
       AND id.distribution_date::date > $1::date AND id.distribution_date::date <= $2::date`,
    [openDate, endDate]
  );
  const sysKegDist = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills
     WHERE batch_id IN (${idList})
       AND distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
       AND distributed_at::date > $1::date AND distributed_at::date <= $2::date`,
    [openDate, endDate]
  );
  const sysDistL = parseFloat(sysBottleDist.rows[0].total_l) + parseFloat(sysKegDist.rows[0].total_l);

  // System losses (eligible batches only)
  const sysRacking = await c.query(
    `SELECT COALESCE(SUM(CAST(bro.volume_loss AS DECIMAL)),0) as total_l
     FROM batch_racking_operations bro
     WHERE bro.deleted_at IS NULL AND bro.batch_id IN (${idList})
       AND bro.racked_at::date > $1::date AND bro.racked_at::date <= $2::date`,
    [openDate, endDate]
  );
  const sysFilter = await c.query(
    `SELECT COALESCE(SUM(CAST(bfo.volume_loss AS DECIMAL)),0) as total_l
     FROM batch_filter_operations bfo
     WHERE bfo.deleted_at IS NULL AND bfo.batch_id IN (${idList})
       AND bfo.filtered_at::date > $1::date AND bfo.filtered_at::date <= $2::date`,
    [openDate, endDate]
  );
  const sysBottling = await c.query(
    `SELECT COALESCE(SUM(CAST(br.loss AS DECIMAL)),0) as total_l
     FROM bottle_runs br
     WHERE br.voided_at IS NULL AND br.batch_id IN (${idList})
       AND br.packaged_at::date > $1::date AND br.packaged_at::date <= $2::date`,
    [openDate, endDate]
  );
  const sysTransferLossBatch = await c.query(
    `SELECT COALESCE(SUM(CAST(transfer_loss_l AS DECIMAL)),0) as total_l
     FROM batches
     WHERE id IN (${idList})
       AND start_date::date > $1::date AND start_date::date <= $2::date`,
    [openDate, endDate]
  );
  const sysTransferLossOp = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.loss AS DECIMAL)),0) as total_l
     FROM batch_transfers bt
     WHERE bt.deleted_at IS NULL AND bt.source_batch_id IN (${idList})
       AND bt.transferred_at::date > $1::date AND bt.transferred_at::date <= $2::date`,
    [openDate, endDate]
  );
  const sysNegAdj = await c.query(
    `SELECT COALESCE(SUM(ABS(CAST(bva.adjustment_amount AS DECIMAL))),0) as total_l
     FROM batch_volume_adjustments bva
     WHERE bva.deleted_at IS NULL AND bva.batch_id IN (${idList})
       AND bva.adjustment_date::date > $1::date AND bva.adjustment_date::date <= $2::date
       AND CAST(bva.adjustment_amount AS DECIMAL) < 0`,
    [openDate, endDate]
  );
  const sysKegFillLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(loss AS DECIMAL)),0) as total_l
     FROM keg_fills
     WHERE voided_at IS NULL AND deleted_at IS NULL AND loss IS NOT NULL
       AND batch_id IN (${idList})
       AND filled_at::date > $1::date AND filled_at::date <= $2::date`,
    [openDate, endDate]
  );

  const sysLossesL =
    parseFloat(sysRacking.rows[0].total_l) +
    parseFloat(sysFilter.rows[0].total_l) +
    parseFloat(sysBottling.rows[0].total_l) +
    parseFloat(sysTransferLossBatch.rows[0].total_l) +
    parseFloat(sysTransferLossOp.rows[0].total_l) +
    parseFloat(sysNegAdj.rows[0].total_l) +
    parseFloat(sysKegFillLoss.rows[0].total_l);

  // System distillation (eligible batches only)
  const sysDistill = await c.query(
    `SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)),0) as total_l
     FROM distillation_records
     WHERE deleted_at IS NULL AND source_batch_id IN (${idList})
       AND sent_at::date > $1::date AND sent_at::date <= $2::date`,
    [openDate, endDate]
  );
  const sysDistillL = parseFloat(sysDistill.rows[0].total_l);

  // ============================================================
  // COMPARISON TABLE
  // ============================================================

  const categories = [
    {
      name: "Opening",
      ttbL: ttbOpeningGal * 3.78541,
      sysL: sysOpeningGal * 3.78541,
      sign: 1, // adds to ending
    },
    {
      name: "Production",
      ttbL: ttbProductionL,
      sysL: sysProductionL,
      sign: 1, // adds to ending
    },
    {
      name: "Distributions",
      ttbL: ttbDistL,
      sysL: sysDistL,
      sign: -1, // subtracts from ending
    },
    {
      name: "Losses",
      ttbL: ttbLossesL,
      sysL: sysLossesL,
      sign: -1, // subtracts from ending
    },
    {
      name: "Distillation",
      ttbL: ttbDistillL,
      sysL: sysDistillL,
      sign: -1, // subtracts from ending
    },
  ];

  console.log("=== VARIANCE DECOMPOSITION: TTB vs SYSTEM ===");
  console.log(`Period: ${openDate} to ${endDate}\n`);
  console.log(
    `${"Category".padEnd(18)} ${"TTB (gal)".padStart(12)} ${"System (gal)".padStart(14)} ${"Gap (gal)".padStart(12)} ${"Impact (gal)".padStart(14)}`
  );
  console.log("-".repeat(72));

  let ttbEndingGal = 0;
  let sysEndingGal = 0;
  let totalImpact = 0;

  for (const cat of categories) {
    const ttbGal = parseFloat(G(cat.ttbL));
    const sysGal = parseFloat(G(cat.sysL));
    const rawGap = ttbGal - sysGal;
    // Impact: how the gap in this category affects the ending variance
    // For additive categories (opening, production): TTB higher → TTB ending higher → positive impact
    // For subtractive categories (distributions, losses, distill): TTB higher → TTB ending LOWER → negative impact
    const impact = rawGap * cat.sign;

    ttbEndingGal += ttbGal * cat.sign;
    sysEndingGal += sysGal * cat.sign;
    totalImpact += impact;

    const prefix = cat.sign === 1 ? "+" : "-";
    console.log(
      `${(prefix + " " + cat.name).padEnd(18)} ${ttbGal.toFixed(1).padStart(12)} ${sysGal.toFixed(1).padStart(14)} ${rawGap.toFixed(1).padStart(12)} ${impact.toFixed(1).padStart(14)}`
    );
  }

  console.log("-".repeat(72));
  console.log(
    `${"= Ending".padEnd(18)} ${ttbEndingGal.toFixed(1).padStart(12)} ${sysEndingGal.toFixed(1).padStart(14)} ${(ttbEndingGal - sysEndingGal).toFixed(1).padStart(12)} ${totalImpact.toFixed(1).padStart(14)}`
  );

  console.log("\n=== DETAIL BREAKDOWN ===");
  console.log(`\nTTB Production breakdown:`);
  console.log(`  Press runs:        ${G(pressL)} gal (${pressL.toFixed(1)} L)`);
  console.log(`  Juice purchases:   ${G(juiceL)} gal (${juiceL.toFixed(1)} L)`);
  console.log(`  - Juice-only excl: ${G(juiceExclL)} gal (${juiceExclL.toFixed(1)} L)`);
  console.log(`  - Xfer into juice: ${G(xferIntoJuiceL)} gal (${xferIntoJuiceL.toFixed(1)} L)`);
  console.log(`  + Positive adj:    ${G(posAdjL)} gal (${posAdjL.toFixed(1)} L)`);
  console.log(`  = Total:           ${G(ttbProductionL)} gal`);

  console.log(`\nSystem Production breakdown:`);
  console.log(`  Batch initials:    ${G(sysInitL)} gal (${sysInitL.toFixed(1)} L)`);
  console.log(`  External merges:   ${G(sysMergeExtL)} gal (${sysMergeExtL.toFixed(1)} L)`);
  console.log(`  + Positive adj:    ${G(sysPosAdjL)} gal (${sysPosAdjL.toFixed(1)} L)`);
  console.log(`  = Total:           ${G(sysProductionL)} gal`);

  console.log(`\nDistribution breakdown:`);
  console.log(`  TTB bottle:  ${G(parseFloat(bottleDist.rows[0].total_l))} gal`);
  console.log(`  TTB keg:     ${G(parseFloat(kegDist.rows[0].total_l))} gal`);
  console.log(`  Sys bottle:  ${G(parseFloat(sysBottleDist.rows[0].total_l))} gal`);
  console.log(`  Sys keg:     ${G(parseFloat(sysKegDist.rows[0].total_l))} gal`);

  console.log(`\nLoss breakdown (TTB / System):`);
  console.log(`  Racking:     ${G(parseFloat(rackingLoss.rows[0].total_l))} / ${G(parseFloat(sysRacking.rows[0].total_l))} gal`);
  console.log(`  Filter:      ${G(parseFloat(filterLoss.rows[0].total_l))} / ${G(parseFloat(sysFilter.rows[0].total_l))} gal`);
  console.log(`  Bottling:    ${G(parseFloat(bottlingLoss.rows[0].total_l))} / ${G(parseFloat(sysBottling.rows[0].total_l))} gal`);
  console.log(`  Transfer(b): ${G(parseFloat(transferLossBatch.rows[0].total_l))} / ${G(parseFloat(sysTransferLossBatch.rows[0].total_l))} gal`);
  console.log(`  Transfer(o): ${G(parseFloat(transferLossOp.rows[0].total_l))} / ${G(parseFloat(sysTransferLossOp.rows[0].total_l))} gal`);
  console.log(`  Vol adj(-):  ${G(parseFloat(negAdj.rows[0].total_l))} / ${G(parseFloat(sysNegAdj.rows[0].total_l))} gal`);
  console.log(`  Keg fill:    ${G(parseFloat(kegFillLoss.rows[0].total_l))} / ${G(parseFloat(sysKegFillLoss.rows[0].total_l))} gal`);

  console.log(`\nDistillation: TTB ${G(ttbDistillL)} / System ${G(sysDistillL)} gal`);

  // Check: excluded/duplicate batch contributions
  console.log(`\n=== EXCLUDED/DUPLICATE BATCH CONTRIBUTIONS ===`);
  const exclDist = await c.query(
    `SELECT
       COALESCE(SUM(CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)),0) / 1000.0 as bottle_l,
       0 as keg_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     JOIN batches b ON br.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded')
       AND br.voided_at IS NULL
       AND id.distribution_date::date > $1::date AND id.distribution_date::date <= $2::date`,
    [openDate, endDate]
  );
  const exclKegDist = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills kf
     JOIN batches b ON kf.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded')
       AND kf.distributed_at IS NOT NULL AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
       AND kf.distributed_at::date > $1::date AND kf.distributed_at::date <= $2::date`,
    [openDate, endDate]
  );
  const exclBottleDistL = parseFloat(exclDist.rows[0].bottle_l);
  const exclKegDistL = parseFloat(exclKegDist.rows[0].total_l);
  console.log(`  Distributions from excluded batches: ${G(exclBottleDistL + exclKegDistL)} gal (bottle: ${G(exclBottleDistL)}, keg: ${G(exclKegDistL)})`);

  // Losses from excluded batches that ARE counted in TTB (unfiltered queries)
  const exclNegAdj = await c.query(
    `SELECT COALESCE(SUM(ABS(CAST(bva.adjustment_amount AS DECIMAL))),0) as total_l
     FROM batch_volume_adjustments bva
     JOIN batches b ON bva.batch_id = b.id
     WHERE bva.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded')
       AND bva.adjustment_date::date > $1::date AND bva.adjustment_date::date <= $2::date
       AND CAST(bva.adjustment_amount AS DECIMAL) < 0`,
    [openDate, endDate]
  );
  const exclKegLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(loss AS DECIMAL)),0) as total_l
     FROM keg_fills kf
     JOIN batches b ON kf.batch_id = b.id
     WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL AND kf.loss IS NOT NULL
       AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded')
       AND kf.filled_at::date > $1::date AND kf.filled_at::date <= $2::date`,
    [openDate, endDate]
  );
  const exclDistill = await c.query(
    `SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)),0) as total_l
     FROM distillation_records dr
     JOIN batches b ON dr.source_batch_id = b.id
     WHERE dr.deleted_at IS NULL AND b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded')
       AND dr.sent_at::date > $1::date AND dr.sent_at::date <= $2::date`,
    [openDate, endDate]
  );
  console.log(`  Neg adjustments from excluded batches: ${G(parseFloat(exclNegAdj.rows[0].total_l))} gal (in TTB losses, not in System)`);
  console.log(`  Keg fill losses from excluded batches: ${G(parseFloat(exclKegLoss.rows[0].total_l))} gal (in TTB losses, not in System)`);
  console.log(`  Distillation from excluded batches: ${G(parseFloat(exclDistill.rows[0].total_l))} gal (in TTB distillation, not in System)`);

  // Soft-deleted batch contributions
  const softDelDist = await c.query(
    `SELECT
       COALESCE(SUM(CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)),0) / 1000.0 as bottle_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     JOIN batches b ON br.batch_id = b.id
     WHERE b.deleted_at IS NOT NULL
       AND br.voided_at IS NULL
       AND id.distribution_date::date > $1::date AND id.distribution_date::date <= $2::date`,
    [openDate, endDate]
  );
  const softDelKegDist = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills kf
     JOIN batches b ON kf.batch_id = b.id
     WHERE b.deleted_at IS NOT NULL
       AND kf.distributed_at IS NOT NULL AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
       AND kf.distributed_at::date > $1::date AND kf.distributed_at::date <= $2::date`,
    [openDate, endDate]
  );
  console.log(`  Distributions from soft-deleted batches: ${G(parseFloat(softDelDist.rows[0].bottle_l) + parseFloat(softDelKegDist.rows[0].total_l))} gal`);

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
