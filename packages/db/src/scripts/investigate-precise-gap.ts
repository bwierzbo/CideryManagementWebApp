import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Compute precise SBD opening and ending totals to determine exact adjustments
 * needed to zero out both Reconciliation Adj and Variance.
 */

const num = (v: any) => parseFloat(v || "0") || 0;
const L2G = (l: number) => l / 3.78541;
const G2L = (g: number) => g * 3.78541;

const OPENING_DATE = "2025-01-01";
const ENDING_DATE = "2026-01-01"; // current year end

const DISTILLERY_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";

async function computeBatchSBD(batchId: string, cutoffDate: string, parentBatchId: string | null, initL: number) {
  // isTransferCreated check
  const tiAll = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as total
    FROM batch_transfers WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL
  `));
  const totalTiAll = num((tiAll.rows as any[])[0].total);
  const isTC = !!(parentBatchId && totalTiAll >= initL * 0.9);
  const effectiveInit = isTC ? 0 : initL;

  const tiPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol
    FROM batch_transfers WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL AND transferred_at < '${cutoffDate}'
  `));
  const toPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol,
           COALESCE(SUM(CAST(COALESCE(loss, '0') AS float)), 0) as loss
    FROM batch_transfers WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL AND transferred_at < '${cutoffDate}'
  `));
  const miPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
    FROM batch_merge_history WHERE target_batch_id = '${batchId}' AND deleted_at IS NULL AND merged_at < '${cutoffDate}'
  `));
  const moPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
    FROM batch_merge_history WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL AND merged_at < '${cutoffDate}'
  `));
  const adjPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS float)), 0) as vol
    FROM batch_volume_adjustments WHERE batch_id = '${batchId}' AND deleted_at IS NULL AND adjustment_date < '${cutoffDate}'
  `));
  const btlPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken_liters AS float)), 0) as vol
    FROM bottle_runs WHERE batch_id = '${batchId}' AND voided_at IS NULL AND packaged_at < '${cutoffDate}'
  `));
  const kegPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken AS float)), 0) as vol
    FROM keg_fills WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL AND filled_at < '${cutoffDate}'
  `));
  const distPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS float)), 0) as vol
    FROM distillation_records WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL AND sent_at < '${cutoffDate}'
  `));

  const ti = num((tiPre.rows as any[])[0].vol);
  const to = num((toPre.rows as any[])[0].vol);
  const tl = num((toPre.rows as any[])[0].loss);
  const mi = num((miPre.rows as any[])[0].vol);
  const mo = num((moPre.rows as any[])[0].vol);
  const ad = num((adjPre.rows as any[])[0].vol);
  const bl = num((btlPre.rows as any[])[0].vol);
  const kg = num((kegPre.rows as any[])[0].vol);
  const ds = num((distPre.rows as any[])[0].vol);

  const raw = effectiveInit + ti - to - tl + mi - mo + ad - bl - kg - ds;
  return { raw, clamped: Math.max(0, raw), effectiveInit, isTC };
}

async function main() {
  // Get all eligible batches
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
           b.start_date, b.parent_batch_id, b.is_racking_derivative,
           CAST(b.initial_volume_liters AS float) as init_l,
           CAST(b.current_volume_liters AS float) as current_l,
           b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type != 'juice'
      AND b.start_date <= '2025-12-31'
      AND (
        b.reconciliation_status NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative = true
        OR b.parent_batch_id IS NOT NULL
      )
    ORDER BY b.product_type, b.start_date
  `));

  const rows = batches.rows as any[];

  const taxClassMap: Record<string, string> = {
    cider: "hardCider", perry: "hardCider",
    pommeau: "wine16To21", wine: "wineUnder16",
    brandy: "appleBrandy", spirit: "grapeSpirits",
  };

  const configured: Record<string, number> = {
    hardCider: 1061, wine16To21: 60, wineUnder16: 0,
    appleBrandy: 0, grapeSpirits: 0,
  };

  // Compute opening and ending for each batch
  type Result = {
    id: string; name: string; productType: string; taxClass: string;
    initL: number; currentL: number;
    openingL: number; endingL: number; openingRaw: number; endingRaw: number;
  };

  const results: Result[] = [];
  let count = 0;

  for (const b of rows) {
    count++;
    if (count % 10 === 0) process.stderr.write(`  Processing ${count}/${rows.length}...\n`);

    const startDate = new Date(b.start_date);
    const isCarriedForward = startDate < new Date("2025-01-01");

    const opening = isCarriedForward
      ? await computeBatchSBD(b.id, OPENING_DATE, b.parent_batch_id, num(b.init_l))
      : { raw: 0, clamped: 0, effectiveInit: 0, isTC: false };

    const ending = await computeBatchSBD(b.id, ENDING_DATE, b.parent_batch_id, num(b.init_l));

    results.push({
      id: b.id,
      name: b.custom_name || b.batch_number,
      productType: b.product_type,
      taxClass: taxClassMap[b.product_type] || b.product_type,
      initL: num(b.init_l),
      currentL: num(b.current_l),
      openingL: opening.clamped,
      endingL: ending.clamped,
      openingRaw: opening.raw,
      endingRaw: ending.raw,
    });
  }

  // Aggregate by tax class
  const byClass: Record<string, { openingL: number; endingL: number; currentL: number; clampedOpeningL: number; clampedEndingL: number }> = {};
  for (const r of results) {
    if (!byClass[r.taxClass]) byClass[r.taxClass] = { openingL: 0, endingL: 0, currentL: 0, clampedOpeningL: 0, clampedEndingL: 0 };
    byClass[r.taxClass].openingL += r.openingL;
    byClass[r.taxClass].endingL += r.endingL;
    byClass[r.taxClass].currentL += r.currentL;
    byClass[r.taxClass].clampedOpeningL += r.openingL;
    byClass[r.taxClass].clampedEndingL += r.endingL;
  }

  console.log("=== PRECISE SBD BY TAX CLASS ===");
  let totalOpeningL = 0, totalEndingL = 0, totalCurrentL = 0;
  for (const [tc, data] of Object.entries(byClass).sort()) {
    const oG = L2G(data.openingL);
    const eG = L2G(data.endingL);
    const cG = L2G(data.currentL);
    const confG = configured[tc] || 0;
    totalOpeningL += data.openingL;
    totalEndingL += data.endingL;
    totalCurrentL += data.currentL;
    console.log(`  ${tc}:`);
    console.log(`    opening: ${data.openingL.toFixed(3)}L = ${oG.toFixed(4)} gal (configured: ${confG} gal, delta: ${(oG - confG).toFixed(4)} gal)`);
    console.log(`    ending:  ${data.endingL.toFixed(3)}L = ${eG.toFixed(4)} gal`);
    console.log(`    current: ${data.currentL.toFixed(3)}L = ${cG.toFixed(4)} gal`);
  }

  const totalOpeningG = L2G(totalOpeningL);
  const totalEndingG = L2G(totalEndingL);
  const totalCurrentG = L2G(totalCurrentL);
  const totalConfigured = 1121;

  console.log(`\n=== TOTALS ===`);
  console.log(`  SBD Opening:  ${totalOpeningL.toFixed(3)}L = ${totalOpeningG.toFixed(4)} gal`);
  console.log(`  Configured:   ${G2L(totalConfigured).toFixed(3)}L = ${totalConfigured.toFixed(4)} gal`);
  console.log(`  Recon Adj:    ${(totalOpeningG - totalConfigured).toFixed(4)} gal = ${(totalOpeningL - G2L(totalConfigured)).toFixed(3)}L`);
  console.log(`  SBD Ending:   ${totalEndingL.toFixed(3)}L = ${totalEndingG.toFixed(4)} gal`);
  console.log(`  Live Current: ${totalCurrentL.toFixed(3)}L = ${totalCurrentG.toFixed(4)} gal`);
  console.log(`  Variance (ending - current): ${(totalEndingG - totalCurrentG).toFixed(4)} gal`);

  // What adjustment to For Distillery init would zero out Recon Adj?
  const gapL = totalOpeningL - G2L(totalConfigured);
  const gapG = L2G(gapL);
  console.log(`\n=== REQUIRED FIX ===`);
  console.log(`  Total gap: ${gapL.toFixed(3)}L = ${gapG.toFixed(4)} gal`);
  console.log(`  Current For Distillery init: 387.0L`);
  console.log(`  New For Distillery init to zero Recon Adj: ${(387.0 - gapL).toFixed(3)}L`);
  console.log(`  Reduction: ${gapL.toFixed(3)}L = ${gapG.toFixed(4)} gal`);

  // Would this also fix variance?
  // The ending SBD would also drop by gapL (since init contributes to ending too)
  const newEndingL = totalEndingL - gapL;
  const newEndingG = L2G(newEndingL);
  console.log(`\n  After fix:`);
  console.log(`    New SBD Opening: ${(totalOpeningL - gapL).toFixed(3)}L = ${(totalOpeningG - gapG).toFixed(4)} gal`);
  console.log(`    New Recon Adj: 0.0000 gal`);
  console.log(`    New SBD Ending: ${newEndingL.toFixed(3)}L = ${newEndingG.toFixed(4)} gal`);
  console.log(`    Live Current (unchanged): ${totalCurrentL.toFixed(3)}L = ${totalCurrentG.toFixed(4)} gal`);
  console.log(`    New Variance: ${(newEndingG - totalCurrentG).toFixed(4)} gal`);

  // Show batches with drift (ending != current) to understand variance
  console.log(`\n=== BATCHES WITH DRIFT (ending SBD != currentVolume) ===`);
  const drifters = results
    .filter(r => Math.abs(r.endingL - r.currentL) > 0.1)
    .sort((a, b) => Math.abs(b.endingL - b.currentL) - Math.abs(a.endingL - a.currentL))
    .slice(0, 15);

  for (const d of drifters) {
    const drift = d.endingL - d.currentL;
    console.log(`  ${d.id.slice(0,8)} ${d.name.slice(0,35).padEnd(35)} type=${d.productType.padEnd(8)} endingSBD=${d.endingL.toFixed(1)}L current=${d.currentL.toFixed(1)}L drift=${drift.toFixed(1)}L (${L2G(drift).toFixed(2)}g) raw=${d.endingRaw.toFixed(1)}L`);
  }

  // Also show For Distillery specifically
  const distResult = results.find(r => r.id === DISTILLERY_ID);
  if (distResult) {
    console.log(`\n=== FOR DISTILLERY DETAIL ===`);
    console.log(`  opening: ${distResult.openingL.toFixed(3)}L = ${L2G(distResult.openingL).toFixed(4)} gal`);
    console.log(`  ending:  ${distResult.endingL.toFixed(3)}L = ${L2G(distResult.endingL).toFixed(4)} gal`);
    console.log(`  current: ${distResult.currentL.toFixed(3)}L = ${L2G(distResult.currentL).toFixed(4)} gal`);
    console.log(`  endingRaw: ${distResult.endingRaw.toFixed(3)}L`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
