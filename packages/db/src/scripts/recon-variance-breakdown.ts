import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Reconciliation Variance Breakdown
 *
 * Replicates the EXACT aggregate waterfall queries from ttb.ts getReconciliationSummary
 * plus per-batch SBD reconstruction, to show precisely where the ~144 gal variance originates.
 *
 * Waterfall formula (from ttb.ts lines 6519-6520):
 *   calculatedEnding = opening + production + transfersIn - transfersOut
 *                    + positiveAdj - losses - distillation - sales
 *   variance = calculatedEnding - physical
 *
 * Where physical = LIVE bulk currentVolumeLiters + packaged inventory + undistributed kegs
 */

const LITERS_PER_GAL = 3.78541;
const GAL_PER_LITER = 1 / LITERS_PER_GAL;

function toL(val: any): number {
  return parseFloat(val || "0") || 0;
}

function lToGal(liters: number): number {
  return liters * GAL_PER_LITER;
}

function mlToGal(ml: number): number {
  return ml / 1000 * GAL_PER_LITER;
}

// Matches ttb.ts getTaxClassFromMap logic
function getTaxClass(productType: string | null): string | null {
  switch (productType) {
    case "cider": case "perry": return "hardCider";
    case "wine": return "wineUnder16";
    case "pommeau": return "wine16To21";
    case "brandy": return "appleBrandy";
    case "juice": return null;
    default: return "hardCider";
  }
}

const ALL_TAX_KEYS = [
  "hardCider", "wineUnder16", "wine16To21", "wine21To24",
  "sparklingWine", "carbonatedWine", "appleBrandy", "grapeSpirits",
];

function emptyByTc(): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of ALL_TAX_KEYS) r[k] = 0;
  return r;
}

async function main() {
  const OPENING_DATE = "2024-12-31";
  const END_DATE = "2025-12-31";
  const BRANDY_ABV = 0.70;

  console.log(`\n${"=".repeat(90)}`);
  console.log(`RECONCILIATION VARIANCE BREAKDOWN`);
  console.log(`Period: ${OPENING_DATE} to ${END_DATE}`);
  console.log(`${"=".repeat(90)}\n`);

  // ============================================================
  // 1. OPENING BALANCES (from organization_settings)
  // ============================================================
  const settingsRes = await db.execute(sql`
    SELECT ttb_opening_balances FROM organization_settings LIMIT 1
  `);
  const balances = ((settingsRes.rows[0] as any)?.ttb_opening_balances) || { bulk: {}, bottled: {}, spirits: {} };

  const opening = emptyByTc();
  for (const key of ALL_TAX_KEYS) {
    opening[key] = Number((balances.bulk as any)?.[key] || 0)
      + Number((balances.bottled as any)?.[key] || 0)
      + Number((balances.spirits as any)?.[key] || 0);
  }

  // ============================================================
  // 2. PRODUCTION BY TAX CLASS (aggregate queries matching ttb.ts)
  // ============================================================

  // 2a. Press runs
  const pressRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(total_juice_volume_liters AS DECIMAL)), 0) AS total_liters
    FROM press_runs
    WHERE deleted_at IS NULL AND status = 'completed'
      AND date_completed::date > ${OPENING_DATE}::date
      AND date_completed::date <= ${END_DATE}::date
  `);
  const pressRunLiters = toL((pressRes.rows[0] as any).total_liters);

  // 2b. Juice purchases
  const jpRes = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE WHEN jpi.volume_unit = 'gal' THEN CAST(jpi.volume AS DECIMAL) * 3.78541
           ELSE CAST(jpi.volume AS DECIMAL) END
    ), 0) AS total_liters
    FROM juice_purchase_items jpi
    JOIN juice_purchases jp ON jpi.purchase_id = jp.id
    WHERE jp.deleted_at IS NULL AND jpi.deleted_at IS NULL
      AND jp.purchase_date::date > ${OPENING_DATE}::date
      AND jp.purchase_date::date <= ${END_DATE}::date
  `);
  const juicePurchaseLiters = toL((jpRes.rows[0] as any).total_liters);

  // 2c. Juice-only batches (never fermented)
  const juiceOnlyRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(initial_volume_liters AS DECIMAL)), 0) AS total_liters
    FROM batches
    WHERE COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND product_type = 'juice'
      AND start_date::date > ${OPENING_DATE}::date
      AND start_date::date <= ${END_DATE}::date
  `);
  const juiceOnlyLiters = toL((juiceOnlyRes.rows[0] as any).total_liters);

  // 2d. Transfers into juice batches
  const xferToJuiceRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS total_liters
    FROM batch_transfers bt
    JOIN batches b ON bt.destination_batch_id = b.id
    WHERE bt.deleted_at IS NULL AND b.product_type = 'juice'
      AND bt.transferred_at::date > ${OPENING_DATE}::date
      AND bt.transferred_at::date <= ${END_DATE}::date
  `);
  const transfersIntoJuiceLiters = toL((xferToJuiceRes.rows[0] as any).total_liters);

  // 2e. Juice to pommeau (ABV-derived)
  const pommeauRes = await db.execute(sql`
    SELECT CAST(initial_volume_liters AS DECIMAL) AS initial_l,
           COALESCE(actual_abv, estimated_abv, 0) AS abv
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND product_type = 'pommeau'
      AND CAST(initial_volume_liters AS DECIMAL) > 0
      AND start_date::date > ${OPENING_DATE}::date
      AND start_date::date <= ${END_DATE}::date
  `);
  let juiceToPommeauLiters = 0;
  let brandyToPommeauLitersRecon = 0;
  for (const row of pommeauRes.rows as any[]) {
    const initial = toL(row.initial_l);
    const abv = (toL(row.abv)) / 100;
    if (initial > 0 && abv > 0 && abv < BRANDY_ABV) {
      juiceToPommeauLiters += initial * (1 - abv / BRANDY_ABV);
      brandyToPommeauLitersRecon += initial * (abv / BRANDY_ABV);
    }
  }

  // Non-brandy transfers into pommeau batches
  const nbpRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS total_liters
    FROM batch_transfers bt
    JOIN batches dest ON bt.destination_batch_id = dest.id
    JOIN batches src ON bt.source_batch_id = src.id
    WHERE bt.deleted_at IS NULL
      AND dest.product_type = 'pommeau'
      AND src.product_type NOT IN ('pommeau', 'brandy')
      AND dest.start_date::date > ${OPENING_DATE}::date
      AND dest.start_date::date <= ${END_DATE}::date
      AND bt.transferred_at::date > ${OPENING_DATE}::date
      AND bt.transferred_at::date <= ${END_DATE}::date
  `);
  const nonBrandyToPommeauLiters = toL((nbpRes.rows[0] as any).total_liters);
  juiceToPommeauLiters += nonBrandyToPommeauLiters;

  // 2f. Wine production (directly fermented wine)
  const wineRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(initial_volume_liters AS DECIMAL)), 0) AS total_liters
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND product_type = 'wine'
      AND CAST(initial_volume_liters AS DECIMAL) > 0
      AND start_date::date > ${OPENING_DATE}::date
      AND start_date::date <= ${END_DATE}::date
      AND (parent_batch_id IS NULL OR is_racking_derivative = false)
  `);
  const wineProductionLiters = toL((wineRes.rows[0] as any).total_liters);

  // HC production (from ttb.ts line 4949)
  const totalProductionLiters = pressRunLiters + juicePurchaseLiters - juiceOnlyLiters
    - transfersIntoJuiceLiters - juiceToPommeauLiters - wineProductionLiters;

  // Composed juice portion for pommeau production
  const composedJuiceLiters = juiceToPommeauLiters - nonBrandyToPommeauLiters;

  const production = emptyByTc();
  production["hardCider"] = lToGal(totalProductionLiters);
  production["wineUnder16"] = lToGal(wineProductionLiters);
  production["appleBrandy"] = 0; // Brandy received is separate

  // Brandy received
  const brandyRecRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(received_volume_liters AS DECIMAL)), 0) AS total_liters
    FROM distillation_records
    WHERE deleted_at IS NULL
      AND received_volume_liters IS NOT NULL
      AND received_at::date > ${OPENING_DATE}::date
      AND received_at::date <= ${END_DATE}::date
  `);
  const brandyReceivedLiters = toL((brandyRecRes.rows[0] as any).total_liters);
  production["appleBrandy"] = lToGal(brandyReceivedLiters);

  // Pommeau production from composed juice
  if (composedJuiceLiters > 0) {
    production["wine16To21"] = lToGal(composedJuiceLiters);
  }

  // ============================================================
  // 3. DISTILLATION BY TAX CLASS
  // ============================================================
  const distRes = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)), 0) AS total_liters
    FROM distillation_records
    WHERE deleted_at IS NULL AND status IN ('sent', 'received')
      AND sent_at::date > ${OPENING_DATE}::date
      AND sent_at::date <= ${END_DATE}::date
  `);
  const distillation = emptyByTc();
  distillation["hardCider"] = lToGal(toL((distRes.rows[0] as any).total_liters));

  // ============================================================
  // 4. LOSSES BY TAX CLASS (matching all 6 loss categories in ttb.ts)
  // ============================================================
  const losses = emptyByTc();

  // 4a. Racking losses
  const rackRes = await db.execute(sql`
    SELECT b.product_type, COALESCE(SUM(CAST(bro.volume_loss AS DECIMAL)), 0) AS total_liters
    FROM batch_racking_operations bro
    JOIN batches b ON bro.batch_id = b.id
    WHERE bro.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bro.racked_at::date > ${OPENING_DATE}::date
      AND bro.racked_at::date <= ${END_DATE}::date
      AND (bro.notes IS NULL OR bro.notes NOT LIKE '%Historical Record%')
    GROUP BY b.product_type
  `);
  for (const r of rackRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // 4b. Filter losses
  const filterRes = await db.execute(sql`
    SELECT b.product_type, COALESCE(SUM(CAST(bfo.volume_loss AS DECIMAL)), 0) AS total_liters
    FROM batch_filter_operations bfo
    JOIN batches b ON bfo.batch_id = b.id
    WHERE bfo.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bfo.filtered_at::date > ${OPENING_DATE}::date
      AND bfo.filtered_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of filterRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // 4c. Bottling losses
  const btlLossRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(CASE WHEN br.loss_unit = 'gal' THEN COALESCE(br.loss::numeric, 0) * 3.78541
                             ELSE COALESCE(br.loss::numeric, 0) END), 0) AS total_liters
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND br.packaged_at::date > ${OPENING_DATE}::date
      AND br.packaged_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of btlLossRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // 4d. Transfer losses (batches.transfer_loss_l)
  const xferLoss1Res = await db.execute(sql`
    SELECT b.product_type, COALESCE(SUM(CAST(b.transfer_loss_l AS DECIMAL)), 0) AS total_liters
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND b.start_date::date > ${OPENING_DATE}::date
      AND b.start_date::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of xferLoss1Res.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // 4e. Transfer operation losses (batch_transfers.loss)
  const xferLoss2Res = await db.execute(sql`
    SELECT b.product_type, COALESCE(SUM(CAST(bt.loss AS DECIMAL)), 0) AS total_liters
    FROM batch_transfers bt
    JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bt.transferred_at::date > ${OPENING_DATE}::date
      AND bt.transferred_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of xferLoss2Res.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // 4f. Negative volume adjustments (losses)
  const negAdjRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(ABS(CAST(bva.adjustment_amount AS DECIMAL))), 0) AS total_liters
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bva.adjustment_date::date > ${OPENING_DATE}::date
      AND bva.adjustment_date::date <= ${END_DATE}::date
      AND CAST(bva.adjustment_amount AS DECIMAL) < 0
    GROUP BY b.product_type
  `);
  for (const r of negAdjRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // 4g. Keg fill losses
  const kegLossRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(CASE WHEN kf.loss_unit = 'gal' THEN COALESCE(kf.loss::numeric, 0) * 3.78541
                             ELSE COALESCE(kf.loss::numeric, 0) END), 0) AS total_liters
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND kf.loss IS NOT NULL
      AND kf.filled_at::date > ${OPENING_DATE}::date
      AND kf.filled_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of kegLossRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) losses[tc] += lToGal(toL(r.total_liters));
  }

  // ============================================================
  // 5. POSITIVE ADJUSTMENTS BY TAX CLASS
  // ============================================================
  const posAdj = emptyByTc();
  const posAdjRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(CAST(bva.adjustment_amount AS DECIMAL)), 0) AS total_liters
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bva.adjustment_date::date > ${OPENING_DATE}::date
      AND bva.adjustment_date::date <= ${END_DATE}::date
      AND CAST(bva.adjustment_amount AS DECIMAL) > 0
    GROUP BY b.product_type
  `);
  for (const r of posAdjRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) posAdj[tc] += lToGal(toL(r.total_liters));
  }

  // ============================================================
  // 6. SALES/REMOVALS BY TAX CLASS (distributions)
  // ============================================================
  const sales = emptyByTc();

  // 6a. Bottle distributions (net = volumeTakenLiters - loss)
  const btlSalesRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(
             br.volume_taken_liters::numeric -
             CASE WHEN br.loss_unit = 'gal' THEN COALESCE(br.loss::numeric, 0) * 3.78541
                  ELSE COALESCE(br.loss::numeric, 0) END
           ), 0) AS total_liters
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL AND b.deleted_at IS NULL
      AND br.status IN ('distributed', 'completed')
      AND br.distributed_at::date > ${OPENING_DATE}::date
      AND br.distributed_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of btlSalesRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) sales[tc] += lToGal(toL(r.total_liters));
  }

  // 6b. Keg distributions (net = volumeTaken - loss)
  const kegSalesRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(
             (CASE WHEN kf.volume_taken_unit = 'gal' THEN COALESCE(kf.volume_taken::numeric, 0) * 3.78541
                   ELSE COALESCE(kf.volume_taken::numeric, 0) END)
             - (CASE WHEN kf.loss_unit = 'gal' THEN COALESCE(kf.loss::numeric, 0) * 3.78541
                     ELSE COALESCE(kf.loss::numeric, 0) END)
           ), 0) AS total_liters
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.distributed_at IS NOT NULL
      AND kf.voided_at IS NULL AND kf.deleted_at IS NULL AND b.deleted_at IS NULL
      AND kf.distributed_at::date > ${OPENING_DATE}::date
      AND kf.distributed_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of kegSalesRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) sales[tc] += lToGal(toL(r.total_liters));
  }

  // ============================================================
  // 7. CROSS-CLASS TRANSFERS (transfersIn / transfersOut)
  // ============================================================
  const xferIn = emptyByTc();
  const xferOut = emptyByTc();

  const xclassRes = await db.execute(sql`
    SELECT src.product_type AS src_type, dest.product_type AS dest_type,
           COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS total_liters
    FROM batch_transfers bt
    LEFT JOIN batches src ON bt.source_batch_id = src.id
    LEFT JOIN batches dest ON bt.destination_batch_id = dest.id
    WHERE bt.deleted_at IS NULL
      AND bt.transferred_at::date > ${OPENING_DATE}::date
      AND bt.transferred_at::date <= ${END_DATE}::date
    GROUP BY src.product_type, dest.product_type
  `);
  for (const r of xclassRes.rows as any[]) {
    const srcTc = getTaxClass(r.src_type);
    const destTc = getTaxClass(r.dest_type);
    if (!srcTc || !destTc) continue;
    if (srcTc !== destTc) {
      const gal = lToGal(toL(r.total_liters));
      xferOut[srcTc] += gal;
      xferIn[destTc] += gal;
    }
  }

  // Supplement: ABV-derived brandy→pommeau (from composed batches with soft-deleted transfers)
  const abvBrandyGal = lToGal(brandyToPommeauLitersRecon);
  xferOut["appleBrandy"] += abvBrandyGal;
  xferIn["wine16To21"] += abvBrandyGal;

  // ============================================================
  // 8. PHYSICAL INVENTORY (LIVE) matching ttb.ts inventoryByTaxClass
  // ============================================================
  const physical = emptyByTc();

  // 8a. Bulk (LIVE currentVolumeLiters)
  const bulkPhysRes = await db.execute(sql`
    SELECT product_type, COALESCE(SUM(CAST(current_volume_liters AS DECIMAL)), 0) AS total_liters
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND start_date::date <= ${END_DATE}::date
      AND COALESCE(current_volume_liters, 0) > 0
      AND NOT (batch_number LIKE 'LEGACY-%')
    GROUP BY product_type
  `);
  for (const r of bulkPhysRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) physical[tc] += lToGal(toL(r.total_liters));
  }

  // 8b. Packaged (inventory_items)
  const pkgPhysRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(CAST(ii.current_quantity AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)), 0) AS total_ml
    FROM inventory_items ii
    JOIN bottle_runs br ON ii.bottle_run_id = br.id
    JOIN batches b ON br.batch_id = b.id
    WHERE ii.deleted_at IS NULL AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND ii.current_quantity > 0
      AND b.start_date::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of pkgPhysRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) physical[tc] += mlToGal(toL(r.total_ml));
  }

  // 8c. Undistributed keg fills
  const kegPhysRes = await db.execute(sql`
    SELECT b.product_type,
           COALESCE(SUM(
             CASE WHEN kf.volume_taken_unit = 'gal' THEN COALESCE(kf.volume_taken::numeric, 0) * 3.78541
                  ELSE COALESCE(kf.volume_taken::numeric, 0) END
           ), 0) AS total_liters
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL
      AND kf.distributed_at IS NULL
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND kf.filled_at::date <= ${END_DATE}::date
    GROUP BY b.product_type
  `);
  for (const r of kegPhysRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (tc) physical[tc] += lToGal(toL(r.total_liters));
  }

  // ============================================================
  // RESULTS: Waterfall reconstruction
  // ============================================================

  console.log("--- PRODUCTION INPUTS (HC) ---");
  console.log(`  Press runs:           ${lToGal(pressRunLiters).toFixed(1)} gal (${pressRunLiters.toFixed(0)}L)`);
  console.log(`  Juice purchases:      ${lToGal(juicePurchaseLiters).toFixed(1)} gal (${juicePurchaseLiters.toFixed(0)}L)`);
  console.log(`  - Juice only:         ${lToGal(juiceOnlyLiters).toFixed(1)} gal (${juiceOnlyLiters.toFixed(0)}L)`);
  console.log(`  - Xfer to juice:      ${lToGal(transfersIntoJuiceLiters).toFixed(1)} gal (${transfersIntoJuiceLiters.toFixed(0)}L)`);
  console.log(`  - Juice to pommeau:   ${lToGal(juiceToPommeauLiters).toFixed(1)} gal (${juiceToPommeauLiters.toFixed(0)}L)`);
  console.log(`  - Wine production:    ${lToGal(wineProductionLiters).toFixed(1)} gal (${wineProductionLiters.toFixed(0)}L)`);
  console.log(`  = HC production:      ${production["hardCider"].toFixed(1)} gal`);
  console.log(`  Wine <16% production: ${production["wineUnder16"].toFixed(1)} gal`);
  console.log(`  Wine 16-21% prod:     ${production["wine16To21"].toFixed(1)} gal`);
  console.log(`  Brandy received:      ${production["appleBrandy"].toFixed(1)} gal`);

  console.log(`\n${"=".repeat(90)}`);
  console.log(`WATERFALL PER TAX CLASS`);
  console.log(`${"=".repeat(90)}`);

  const header = [
    "Tax Class".padEnd(16),
    "Opening".padStart(9),
    "Prod".padStart(9),
    "XferIn".padStart(9),
    "XferOut".padStart(9),
    "+Adj".padStart(9),
    "Losses".padStart(9),
    "Distill".padStart(9),
    "Sales".padStart(9),
    "CalcEnd".padStart(9),
    "Physical".padStart(9),
    "Var".padStart(9),
  ].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  let totalCalcEnd = 0;
  let totalPhysical = 0;
  let totalVariance = 0;

  for (const tc of ALL_TAX_KEYS) {
    const o = opening[tc];
    const p = production[tc];
    const xi = xferIn[tc];
    const xo = xferOut[tc];
    const pa = posAdj[tc];
    const l = losses[tc];
    const d = distillation[tc];
    const s = sales[tc];

    const calcEnd = o + p + xi - xo + pa - l - d - s;
    const phys = physical[tc];
    const variance = calcEnd - phys;

    const hasActivity = o !== 0 || p > 0 || xi > 0 || phys > 0 || l > 0 || s > 0 || d > 0;
    if (hasActivity) {
      totalCalcEnd += calcEnd;
      totalPhysical += phys;
      totalVariance += variance;

      console.log([
        tc.padEnd(16),
        o.toFixed(1).padStart(9),
        p.toFixed(1).padStart(9),
        xi.toFixed(1).padStart(9),
        xo.toFixed(1).padStart(9),
        pa.toFixed(1).padStart(9),
        l.toFixed(1).padStart(9),
        d.toFixed(1).padStart(9),
        s.toFixed(1).padStart(9),
        calcEnd.toFixed(1).padStart(9),
        phys.toFixed(1).padStart(9),
        variance.toFixed(1).padStart(9),
      ].join(" "));
    }
  }

  console.log("-".repeat(header.length));
  console.log([
    "TOTAL".padEnd(16),
    "".padStart(9), "".padStart(9), "".padStart(9), "".padStart(9),
    "".padStart(9), "".padStart(9), "".padStart(9), "".padStart(9),
    totalCalcEnd.toFixed(1).padStart(9),
    totalPhysical.toFixed(1).padStart(9),
    totalVariance.toFixed(1).padStart(9),
  ].join(" "));

  // ============================================================
  // VARIANCE DECOMPOSITION: What's in the gap?
  // ============================================================
  console.log(`\n${"=".repeat(90)}`);
  console.log(`VARIANCE DECOMPOSITION (per tax class)`);
  console.log(`${"=".repeat(90)}\n`);

  // Check post-2025 operations that reduce LIVE volumes but aren't in the waterfall
  // (since waterfall only covers openingDate to END_DATE)
  const postRes = await db.execute(sql`
    SELECT 'transfer_out' AS op, b.product_type,
           COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL) + COALESCE(CAST(bt.loss AS DECIMAL), 0)), 0) AS liters
    FROM batch_transfers bt JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.deleted_at IS NULL AND bt.transferred_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'transfer_in' AS op, b.product_type,
           COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS liters
    FROM batch_transfers bt JOIN batches b ON bt.destination_batch_id = b.id
    WHERE bt.deleted_at IS NULL AND bt.transferred_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'merge_out' AS op, b.product_type,
           COALESCE(SUM(CAST(bm.volume_added AS DECIMAL)), 0) AS liters
    FROM batch_merge_history bm JOIN batches b ON bm.source_batch_id = b.id
    WHERE bm.deleted_at IS NULL AND bm.merged_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'merge_in' AS op, b.product_type,
           COALESCE(SUM(CAST(bm.volume_added AS DECIMAL)), 0) AS liters
    FROM batch_merge_history bm JOIN batches b ON bm.target_batch_id = b.id
    WHERE bm.deleted_at IS NULL AND bm.merged_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'bottling' AS op, b.product_type,
           COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)), 0) AS liters
    FROM bottle_runs br JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL AND br.packaged_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'kegging' AS op, b.product_type,
           COALESCE(SUM(CASE WHEN kf.volume_taken_unit = 'gal' THEN COALESCE(kf.volume_taken::numeric,0)*3.78541
                             ELSE COALESCE(kf.volume_taken::numeric,0) END
                        + CASE WHEN kf.loss_unit = 'gal' THEN COALESCE(kf.loss::numeric,0)*3.78541
                               ELSE COALESCE(kf.loss::numeric,0) END), 0) AS liters
    FROM keg_fills kf JOIN batches b ON kf.batch_id = b.id
    WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL AND kf.filled_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'racking_loss' AS op, b.product_type,
           COALESCE(SUM(CAST(bro.volume_loss AS DECIMAL)), 0) AS liters
    FROM batch_racking_operations bro JOIN batches b ON bro.batch_id = b.id
    WHERE bro.deleted_at IS NULL AND bro.racked_at::date > ${END_DATE}::date
      AND b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND (bro.notes IS NULL OR bro.notes NOT LIKE '%Historical Record%')
    GROUP BY b.product_type

    UNION ALL

    SELECT 'adj_neg' AS op, b.product_type,
           COALESCE(SUM(ABS(CAST(bva.adjustment_amount AS DECIMAL))), 0) AS liters
    FROM batch_volume_adjustments bva JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL AND b.deleted_at IS NULL
      AND bva.adjustment_date::date > ${END_DATE}::date
      AND CAST(bva.adjustment_amount AS DECIMAL) < 0
    GROUP BY b.product_type

    UNION ALL

    SELECT 'adj_pos' AS op, b.product_type,
           COALESCE(SUM(CAST(bva.adjustment_amount AS DECIMAL)), 0) AS liters
    FROM batch_volume_adjustments bva JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL AND b.deleted_at IS NULL
      AND bva.adjustment_date::date > ${END_DATE}::date
      AND CAST(bva.adjustment_amount AS DECIMAL) > 0
    GROUP BY b.product_type
  `);

  const postPeriodNet = emptyByTc();
  for (const r of postRes.rows as any[]) {
    const tc = getTaxClass(r.product_type);
    if (!tc) continue;
    const liters = toL(r.liters);
    const gal = lToGal(liters);
    switch (r.op) {
      case "transfer_out": postPeriodNet[tc] -= gal; break;
      case "transfer_in": postPeriodNet[tc] += gal; break;
      case "merge_out": postPeriodNet[tc] -= gal; break;
      case "merge_in": postPeriodNet[tc] += gal; break;
      case "bottling": postPeriodNet[tc] -= gal; break;
      case "kegging": postPeriodNet[tc] -= gal; break;
      case "racking_loss": postPeriodNet[tc] -= gal; break;
      case "adj_neg": postPeriodNet[tc] -= gal; break;
      case "adj_pos": postPeriodNet[tc] += gal; break;
    }
  }

  for (const tc of ALL_TAX_KEYS) {
    const o = opening[tc];
    const p = production[tc];
    const xi = xferIn[tc];
    const xo = xferOut[tc];
    const pa = posAdj[tc];
    const l = losses[tc];
    const d = distillation[tc];
    const s = sales[tc];
    const calcEnd = o + p + xi - xo + pa - l - d - s;
    const phys = physical[tc];
    const variance = calcEnd - phys;
    const post = postPeriodNet[tc];

    if (Math.abs(variance) < 0.5) continue;

    console.log(`${tc}:`);
    console.log(`  calculatedEnding:    ${calcEnd.toFixed(1)} gal`);
    console.log(`  physical (LIVE):     ${phys.toFixed(1)} gal`);
    console.log(`  variance:            ${variance.toFixed(1)} gal`);
    console.log(`  post-period net:     ${post.toFixed(1)} gal (changes to LIVE since ${END_DATE})`);
    const residual = variance - (-post);
    console.log(`  residual:            ${residual.toFixed(1)} gal (variance unexplained by post-period ops)`);
    console.log(`  [residual = variance - (-post-period) = ${variance.toFixed(1)} - (${(-post).toFixed(1)}) = ${residual.toFixed(1)}]`);
    if (Math.abs(residual) > 1) {
      console.log(`  ** This residual may come from: scoping differences, batches created in 2026 `);
      console.log(`     (not in waterfall batch set but counted in physical), or SBD clamping.`);
    }
    console.log();
  }

  console.log(`\n${"=".repeat(90)}`);
  console.log(`TOTAL VARIANCE: ${totalVariance.toFixed(1)} gal`);
  const totalPost = Object.values(postPeriodNet).reduce((s, v) => s + v, 0);
  console.log(`Post-period net: ${totalPost.toFixed(1)} gal`);
  console.log(`Residual: ${(totalVariance - (-totalPost)).toFixed(1)} gal (not explained by post-period)`);
  console.log(`${"=".repeat(90)}\n`);

  // ============================================================
  // BONUS: Per-batch largest contributors to physical vs calcEnd gap
  // ============================================================

  // Show the largest batches by residual contribution
  // For each batch: what's its SBD ending vs its LIVE currentVolumeLiters?
  // The per-batch residual is the "unexplained" volume that doesn't come from
  // post-period operations.

  console.log("--- TOP BATCHES BY ABSOLUTE POST-PERIOD IMPACT ---");
  const postBatchRes = await db.execute(sql`
    WITH post_xfer_out AS (
      SELECT bt.source_batch_id AS batch_id,
             SUM(CAST(bt.volume_transferred AS DECIMAL) + COALESCE(CAST(bt.loss AS DECIMAL), 0)) AS liters
      FROM batch_transfers bt
      WHERE bt.deleted_at IS NULL AND bt.transferred_at::date > ${END_DATE}::date
      GROUP BY bt.source_batch_id
    ),
    post_xfer_in AS (
      SELECT bt.destination_batch_id AS batch_id,
             SUM(CAST(bt.volume_transferred AS DECIMAL)) AS liters
      FROM batch_transfers bt
      WHERE bt.deleted_at IS NULL AND bt.transferred_at::date > ${END_DATE}::date
      GROUP BY bt.destination_batch_id
    ),
    post_merge_out AS (
      SELECT bm.source_batch_id AS batch_id,
             SUM(CAST(bm.volume_added AS DECIMAL)) AS liters
      FROM batch_merge_history bm
      WHERE bm.deleted_at IS NULL AND bm.merged_at::date > ${END_DATE}::date
      GROUP BY bm.source_batch_id
    ),
    post_merge_in AS (
      SELECT bm.target_batch_id AS batch_id,
             SUM(CAST(bm.volume_added AS DECIMAL)) AS liters
      FROM batch_merge_history bm
      WHERE bm.deleted_at IS NULL AND bm.merged_at::date > ${END_DATE}::date
      GROUP BY bm.target_batch_id
    )
    SELECT b.id, COALESCE(b.custom_name, b.batch_number) AS name, b.product_type,
           CAST(b.current_volume_liters AS NUMERIC) AS current_l,
           COALESCE(pxo.liters, 0) AS post_xfer_out_l,
           COALESCE(pxi.liters, 0) AS post_xfer_in_l,
           COALESCE(pmo.liters, 0) AS post_merge_out_l,
           COALESCE(pmi.liters, 0) AS post_merge_in_l
    FROM batches b
    LEFT JOIN post_xfer_out pxo ON pxo.batch_id = b.id
    LEFT JOIN post_xfer_in pxi ON pxi.batch_id = b.id
    LEFT JOIN post_merge_out pmo ON pmo.batch_id = b.id
    LEFT JOIN post_merge_in pmi ON pmi.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND b.start_date::date <= ${END_DATE}::date
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND (COALESCE(pxo.liters, 0) > 0.1 OR COALESCE(pxi.liters, 0) > 0.1
           OR COALESCE(pmo.liters, 0) > 0.1 OR COALESCE(pmi.liters, 0) > 0.1)
    ORDER BY COALESCE(pxo.liters,0) + COALESCE(pmo.liters,0) DESC
    LIMIT 20
  `);

  for (const r of postBatchRes.rows as any[]) {
    const xo = lToGal(toL(r.post_xfer_out_l));
    const xi = lToGal(toL(r.post_xfer_in_l));
    const mo = lToGal(toL(r.post_merge_out_l));
    const mi = lToGal(toL(r.post_merge_in_l));
    const net = xi + mi - xo - mo;
    const tc = getTaxClass(r.product_type) || "?";
    console.log(
      `  ${(r.name || "").substring(0, 35).padEnd(37)} [${tc.padEnd(12)}] ` +
      `xferOut=${xo.toFixed(1)} xferIn=${xi.toFixed(1)} mergeOut=${mo.toFixed(1)} mergeIn=${mi.toFixed(1)} ` +
      `net=${net.toFixed(1)} gal`
    );
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
