/**
 * Verify 2024 Ending Balance — SBD Reconstruction
 *
 * Reconstructs the volume of ALL in-bond batches as of Dec 31, 2024 using
 * per-batch SBD (System-Based Data) reconstruction. Compares to the configured
 * TTB opening balance of 1,121 gal (1,061 HC + 60 W16-21).
 *
 * Excludes deleted batches, brandy, and juice.
 * Applies transfer-created heuristic to avoid double-counting.
 *
 * Run: cd packages/db && npx tsx src/scripts/verify-2024-ending.ts
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

const CUTOFF = "2024-12-31";
const L_PER_GAL = 3.78541;
const GAL_PER_L = 1 / L_PER_GAL; // 0.264172

function toGal(liters: number): number {
  return liters * GAL_PER_L;
}

function num(v: unknown): number {
  return parseFloat(String(v || "0")) || 0;
}

function taxClassFor(productType: string): string {
  switch (productType) {
    case "cider":
    case "perry":
      return "hardCider";
    case "pommeau":
      return "wine16To21";
    case "wine":
      return "wineUnder16";
    default:
      return "hardCider";
  }
}

interface BatchRow {
  id: string;
  batch_number: string;
  custom_name: string | null;
  product_type: string;
  status: string;
  reconciliation_status: string | null;
  initial_volume_liters: string;
  current_volume_liters: string;
  start_date: string;
  parent_batch_id: string | null;
  vessel_name: string | null;
}

interface BottleRunRow {
  volume_taken_liters: string;
  loss: string | null;
  loss_unit: string | null;
  units_produced: string | null;
  package_size_ml: string | null;
}

interface BatchDetail {
  id: string;
  name: string;
  productType: string;
  taxClass: string;
  initialL: number;
  effectiveInitialL: number;
  isTransferCreated: boolean;
  transfersInL: number;
  transfersOutL: number;
  transferLossL: number;
  mergesInL: number;
  mergesOutL: number;
  bottlingL: number;
  bottlingLossL: number;
  keggingL: number;
  keggingLossL: number;
  rackingLossL: number;
  filterLossL: number;
  adjustmentsL: number;
  distillationL: number;
  sbdEndingL: number;
  currentVolumeL: number;
}

async function main() {
  console.log("=".repeat(90));
  console.log("  VERIFY 2024 ENDING BALANCE — SBD RECONSTRUCTION");
  console.log("  Cutoff date: " + CUTOFF);
  console.log("=".repeat(90));
  console.log("");

  // ── 1. Find all in-bond batches as of Dec 31, 2024 ──
  // start_date <= cutoff, not deleted, not brandy, not juice
  const batchResult = await db.execute(sql`
    SELECT
      b.id,
      b.batch_number,
      b.custom_name,
      b.product_type,
      b.status,
      b.reconciliation_status,
      CAST(b.initial_volume_liters AS TEXT) as initial_volume_liters,
      CAST(b.current_volume_liters AS TEXT) as current_volume_liters,
      b.start_date::text as start_date,
      b.parent_batch_id::text as parent_batch_id,
      v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NULL
      AND b.start_date <= ${CUTOFF}::date
      AND COALESCE(b.product_type, 'cider') NOT IN ('brandy', 'juice')
    ORDER BY b.product_type, b.start_date, b.batch_number
  `);

  const batches = batchResult.rows as unknown as BatchRow[];
  console.log(`Found ${batches.length} in-bond batches as of ${CUTOFF}\n`);

  // ── 2. For each batch, reconstruct volume at cutoff ──
  const details: BatchDetail[] = [];

  for (const batch of batches) {
    const bId = batch.id;
    const initialL = num(batch.initial_volume_liters);

    // Transfers IN (date-bounded)
    const tInResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(volume_transferred AS NUMERIC)), 0) as total
      FROM batch_transfers
      WHERE destination_batch_id = ${bId}
        AND deleted_at IS NULL
        AND transferred_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const transfersInL = num((tInResult.rows[0] as { total: string }).total);

    // Transfers OUT + transfer loss (date-bounded)
    const tOutResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(volume_transferred AS NUMERIC)), 0) as total,
        COALESCE(SUM(CAST(COALESCE(loss, '0') AS NUMERIC)), 0) as loss_total
      FROM batch_transfers
      WHERE source_batch_id = ${bId}
        AND deleted_at IS NULL
        AND transferred_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const transfersOutL = num((tOutResult.rows[0] as { total: string; loss_total: string }).total);
    const transferLossL = num((tOutResult.rows[0] as { total: string; loss_total: string }).loss_total);

    // Merges IN (date-bounded) — target_batch_id = this batch
    const mInResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(volume_added AS NUMERIC)), 0) as total
      FROM batch_merge_history
      WHERE target_batch_id = ${bId}
        AND deleted_at IS NULL
        AND merged_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const mergesInL = num((mInResult.rows[0] as { total: string }).total);

    // Merges OUT (date-bounded) — source_batch_id = this batch
    const mOutResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(volume_added AS NUMERIC)), 0) as total
      FROM batch_merge_history
      WHERE source_batch_id = ${bId}
        AND deleted_at IS NULL
        AND merged_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const mergesOutL = num((mOutResult.rows[0] as { total: string }).total);

    // Bottling (date-bounded) — smart loss detection
    // bottle_runs has NO deleted_at column, only voided_at
    const bottleResult = await db.execute(sql`
      SELECT
        CAST(volume_taken_liters AS TEXT) as volume_taken_liters,
        loss::text as loss,
        loss_unit,
        units_produced::text as units_produced,
        package_size_ml::text as package_size_ml
      FROM bottle_runs
      WHERE batch_id = ${bId}
        AND voided_at IS NULL
        AND packaged_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    let bottlingL = 0;
    let bottlingLossL = 0;
    for (const br of bottleResult.rows as unknown as BottleRunRow[]) {
      const volTaken = num(br.volume_taken_liters);
      const rawLoss = num(br.loss);
      const lossInLiters = br.loss_unit === "gal" ? rawLoss * L_PER_GAL : rawLoss;
      const unitsProduced = num(br.units_produced);
      const pkgSizeMl = num(br.package_size_ml);
      const productVol = (unitsProduced * pkgSizeMl) / 1000;
      // If volumeTaken ≈ productVol + loss, then loss is already included in volumeTaken
      const lossIncluded = Math.abs(volTaken - (productVol + lossInLiters)) < 2;
      bottlingL += volTaken;
      if (!lossIncluded) bottlingLossL += lossInLiters;
    }

    // Kegging (date-bounded) — unit conversion required
    // keg_fills has BOTH voided_at AND deleted_at
    const kegResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(
          CASE WHEN volume_taken_unit = 'gal'
               THEN CAST(volume_taken AS NUMERIC) * ${L_PER_GAL}
               ELSE CAST(volume_taken AS NUMERIC)
          END
        ), 0) as vol,
        COALESCE(SUM(
          CASE WHEN loss_unit = 'gal'
               THEN CAST(COALESCE(loss, '0') AS NUMERIC) * ${L_PER_GAL}
               ELSE CAST(COALESCE(loss, '0') AS NUMERIC)
          END
        ), 0) as loss
      FROM keg_fills
      WHERE batch_id = ${bId}
        AND voided_at IS NULL
        AND deleted_at IS NULL
        AND filled_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const keggingL = num((kegResult.rows[0] as { vol: string; loss: string }).vol);
    const keggingLossL = num((kegResult.rows[0] as { vol: string; loss: string }).loss);

    // Racking losses (date-bounded)
    const rackResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as total
      FROM batch_racking_operations
      WHERE batch_id = ${bId}
        AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
        AND racked_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const rackingLossL = num((rackResult.rows[0] as { total: string }).total);

    // Filter losses (date-bounded)
    const filterResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as total
      FROM batch_filter_operations
      WHERE batch_id = ${bId}
        AND deleted_at IS NULL
        AND filtered_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const filterLossL = num((filterResult.rows[0] as { total: string }).total);

    // Adjustments (date-bounded)
    const adjResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as total
      FROM batch_volume_adjustments
      WHERE batch_id = ${bId}
        AND deleted_at IS NULL
        AND adjustment_date <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const adjustmentsL = num((adjResult.rows[0] as { total: string }).total);

    // Distillation (date-bounded)
    const distResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as total
      FROM distillation_records
      WHERE source_batch_id = ${bId}
        AND deleted_at IS NULL
        AND status IN ('sent', 'received')
        AND sent_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
    `);
    const distillationL = num((distResult.rows[0] as { total: string }).total);

    // Transfer-created heuristic: if parentBatchId IS NOT NULL and transfersIn >= initial * 0.9
    const isTransferCreated = !!(batch.parent_batch_id && transfersInL >= initialL * 0.9 && initialL > 0);
    const effectiveInitialL = isTransferCreated ? 0 : initialL;

    // SBD ending = effectiveInitial + mergesIn - mergesOut + transfersIn - transfersOut
    //              - transferLoss - bottling - bottlingLoss - kegging - keggingLoss
    //              - racking - filter + adjustments - distillation
    const sbdEndingL = effectiveInitialL
      + mergesInL - mergesOutL
      + transfersInL - transfersOutL - transferLossL
      - bottlingL - bottlingLossL
      - keggingL - keggingLossL
      - rackingLossL - filterLossL
      + adjustmentsL
      - distillationL;

    const name = batch.custom_name || batch.batch_number;
    const productType = batch.product_type || "cider";

    details.push({
      id: bId,
      name,
      productType,
      taxClass: taxClassFor(productType),
      initialL,
      effectiveInitialL,
      isTransferCreated,
      transfersInL,
      transfersOutL,
      transferLossL,
      mergesInL,
      mergesOutL,
      bottlingL,
      bottlingLossL,
      keggingL,
      keggingLossL,
      rackingLossL,
      filterLossL,
      adjustmentsL,
      distillationL,
      sbdEndingL,
      currentVolumeL: num(batch.current_volume_liters),
    });
  }

  // ── 3. Print per-batch detail ──
  console.log("PER-BATCH SBD RECONSTRUCTION (showing batches with SBD ending > 0.1 gal or < -0.1 gal)");
  console.log("-".repeat(90));

  // Group by tax class
  const byTaxClass: Record<string, BatchDetail[]> = {};
  for (const d of details) {
    if (!byTaxClass[d.taxClass]) byTaxClass[d.taxClass] = [];
    byTaxClass[d.taxClass].push(d);
  }

  const taxClassTotals: Record<string, { sbdGal: number; currentGal: number; count: number }> = {};
  let grandTotalSbdGal = 0;
  let grandTotalCurrentGal = 0;

  for (const [taxClass, batchList] of Object.entries(byTaxClass).sort()) {
    console.log(`\n${"=".repeat(10)} ${taxClass} (${batchList.length} batches) ${"=".repeat(10)}`);

    let classSbdL = 0;
    let classCurrentL = 0;

    // Sort by SBD ending descending
    batchList.sort((a, b) => b.sbdEndingL - a.sbdEndingL);

    for (const d of batchList) {
      const sbdGal = toGal(d.sbdEndingL);
      const curGal = toGal(d.currentVolumeL);

      classSbdL += d.sbdEndingL;
      classCurrentL += d.currentVolumeL;

      // Show all batches with any meaningful volume or interesting data
      if (Math.abs(sbdGal) > 0.1 || Math.abs(curGal) > 0.1) {
        const tcLabel = d.isTransferCreated ? " [TC]" : "";
        console.log(
          `\n  ${d.name}${tcLabel} (${d.productType}) — SBD: ${sbdGal.toFixed(2)} gal | Current: ${curGal.toFixed(2)} gal`
        );
        console.log(`    ID: ${d.id}`);
        console.log(`    Initial:       ${toGal(d.initialL).toFixed(2)} gal (${d.initialL.toFixed(1)}L)${d.isTransferCreated ? " -> eff 0 (transfer-created)" : ""}`);
        if (d.mergesInL > 0) console.log(`    +MergesIn:     ${toGal(d.mergesInL).toFixed(2)} gal (${d.mergesInL.toFixed(1)}L)`);
        if (d.mergesOutL > 0) console.log(`    -MergesOut:    ${toGal(d.mergesOutL).toFixed(2)} gal (${d.mergesOutL.toFixed(1)}L)`);
        if (d.transfersInL > 0) console.log(`    +TransfersIn:  ${toGal(d.transfersInL).toFixed(2)} gal (${d.transfersInL.toFixed(1)}L)`);
        if (d.transfersOutL > 0) console.log(`    -TransfersOut: ${toGal(d.transfersOutL).toFixed(2)} gal (${d.transfersOutL.toFixed(1)}L)`);
        if (d.transferLossL > 0) console.log(`    -TransferLoss: ${toGal(d.transferLossL).toFixed(2)} gal (${d.transferLossL.toFixed(1)}L)`);
        if (d.bottlingL > 0) console.log(`    -Bottling:     ${toGal(d.bottlingL).toFixed(2)} gal (${d.bottlingL.toFixed(1)}L)`);
        if (d.bottlingLossL > 0) console.log(`    -BottlingLoss: ${toGal(d.bottlingLossL).toFixed(2)} gal (${d.bottlingLossL.toFixed(1)}L)`);
        if (d.keggingL > 0) console.log(`    -Kegging:      ${toGal(d.keggingL).toFixed(2)} gal (${d.keggingL.toFixed(1)}L)`);
        if (d.keggingLossL > 0) console.log(`    -KeggingLoss:  ${toGal(d.keggingLossL).toFixed(2)} gal (${d.keggingLossL.toFixed(1)}L)`);
        if (d.rackingLossL > 0) console.log(`    -RackingLoss:  ${toGal(d.rackingLossL).toFixed(2)} gal (${d.rackingLossL.toFixed(1)}L)`);
        if (d.filterLossL > 0) console.log(`    -FilterLoss:   ${toGal(d.filterLossL).toFixed(2)} gal (${d.filterLossL.toFixed(1)}L)`);
        if (d.adjustmentsL !== 0) console.log(`    +Adjustments:  ${toGal(d.adjustmentsL).toFixed(2)} gal (${d.adjustmentsL.toFixed(1)}L)`);
        if (d.distillationL > 0) console.log(`    -Distillation: ${toGal(d.distillationL).toFixed(2)} gal (${d.distillationL.toFixed(1)}L)`);
        console.log(`    = SBD Ending:  ${sbdGal.toFixed(2)} gal (${d.sbdEndingL.toFixed(1)}L)`);
      }
    }

    const classSbdGal = toGal(classSbdL);
    const classCurrentGal = toGal(classCurrentL);
    taxClassTotals[taxClass] = { sbdGal: classSbdGal, currentGal: classCurrentGal, count: batchList.length };
    grandTotalSbdGal += classSbdGal;
    grandTotalCurrentGal += classCurrentGal;

    console.log(`\n  ${taxClass} SUBTOTAL: SBD = ${classSbdGal.toFixed(2)} gal | Current = ${classCurrentGal.toFixed(2)} gal`);
  }

  // ── 4. Summary ──
  console.log("\n" + "=".repeat(90));
  console.log("  TAX CLASS TOTALS (SBD reconstruction as of " + CUTOFF + ")");
  console.log("=".repeat(90));

  for (const [cls, t] of Object.entries(taxClassTotals).sort()) {
    console.log(`  ${cls.padEnd(15)} | ${t.count} batches | SBD: ${t.sbdGal.toFixed(2)} gal | Current: ${t.currentGal.toFixed(2)} gal`);
  }

  console.log("-".repeat(60));
  console.log(`  ${"GRAND TOTAL".padEnd(15)} | ${details.length} batches | SBD: ${grandTotalSbdGal.toFixed(2)} gal | Current: ${grandTotalCurrentGal.toFixed(2)} gal`);

  // ── 5. Comparison with configured 1,121 gal ──
  console.log("\n" + "=".repeat(90));
  console.log("  COMPARISON WITH CONFIGURED TTB OPENING BALANCE");
  console.log("=".repeat(90));

  // Read configured opening
  const settingsResult = await db.execute(sql`
    SELECT ttb_opening_balances, ttb_opening_balance_date
    FROM organization_settings
    LIMIT 1
  `);
  const settings = settingsResult.rows[0] as {
    ttb_opening_balances: { bulk: Record<string, number>; bottled: Record<string, number> };
    ttb_opening_balance_date: string;
  };

  const ob = settings.ttb_opening_balances;
  const configuredHC = (ob.bulk?.hardCider || 0) + (ob.bottled?.hardCider || 0);
  const configuredW16 = (ob.bulk?.wineUnder16 || 0) + (ob.bottled?.wineUnder16 || 0);
  const configuredW1621 = (ob.bulk?.wine16To21 || 0) + (ob.bottled?.wine16To21 || 0);
  const configuredTotal = configuredHC + configuredW16 + configuredW1621;

  console.log(`\n  Configured opening date:    ${settings.ttb_opening_balance_date}`);
  console.log(`  Configured total:           ${configuredTotal.toFixed(2)} gal`);
  console.log(`    hardCider:                ${configuredHC.toFixed(2)} gal`);
  console.log(`    wineUnder16:              ${configuredW16.toFixed(2)} gal`);
  console.log(`    wine16To21:               ${configuredW1621.toFixed(2)} gal`);

  console.log("");
  console.log(`  SBD reconstruction total:   ${grandTotalSbdGal.toFixed(2)} gal`);
  console.log(`    hardCider:                ${(taxClassTotals["hardCider"]?.sbdGal || 0).toFixed(2)} gal`);
  console.log(`    wineUnder16:              ${(taxClassTotals["wineUnder16"]?.sbdGal || 0).toFixed(2)} gal`);
  console.log(`    wine16To21:               ${(taxClassTotals["wine16To21"]?.sbdGal || 0).toFixed(2)} gal`);

  console.log("");
  const totalDelta = grandTotalSbdGal - configuredTotal;
  const hcDelta = (taxClassTotals["hardCider"]?.sbdGal || 0) - configuredHC;
  const w16Delta = (taxClassTotals["wineUnder16"]?.sbdGal || 0) - configuredW16;
  const w1621Delta = (taxClassTotals["wine16To21"]?.sbdGal || 0) - configuredW1621;

  console.log("  DELTA (SBD - Configured):");
  console.log(`    hardCider:                ${hcDelta >= 0 ? "+" : ""}${hcDelta.toFixed(2)} gal`);
  console.log(`    wineUnder16:              ${w16Delta >= 0 ? "+" : ""}${w16Delta.toFixed(2)} gal`);
  console.log(`    wine16To21:               ${w1621Delta >= 0 ? "+" : ""}${w1621Delta.toFixed(2)} gal`);
  console.log(`    TOTAL:                    ${totalDelta >= 0 ? "+" : ""}${totalDelta.toFixed(2)} gal`);

  if (Math.abs(totalDelta) < 5) {
    console.log("\n  Volumes match within 5 gallon tolerance.");
  } else {
    console.log(`\n  Significant difference of ${totalDelta.toFixed(2)} gal detected.`);
    console.log("  Positive delta = SBD reconstructs MORE volume than configured.");
    console.log("  Negative delta = SBD reconstructs LESS volume than configured.");
    console.log("  This is expected — the configured balance is from physical inventory / TTB records,");
    console.log("  while SBD reconstructs from batch data that may not fully match legacy records.");
  }

  // ── 6. Also show batches with negative SBD ending (potential issues) ──
  const negativeBatches = details.filter((d) => d.sbdEndingL < -0.5);
  if (negativeBatches.length > 0) {
    console.log("\n" + "=".repeat(90));
    console.log("  WARNING: BATCHES WITH NEGATIVE SBD ENDING (< -0.5L)");
    console.log("=".repeat(90));
    for (const d of negativeBatches.sort((a, b) => a.sbdEndingL - b.sbdEndingL)) {
      console.log(`  ${d.name.padEnd(35)} ${toGal(d.sbdEndingL).toFixed(2)} gal (${d.sbdEndingL.toFixed(1)}L) [${d.taxClass}]`);
    }
    console.log("  These may indicate data entry issues or missing inflows.");
  }

  // ── 7. Show zero-volume batches that were excluded ──
  const zeroBatches = details.filter((d) => Math.abs(d.sbdEndingL) <= 0.5 && d.sbdEndingL !== 0);
  console.log(`\n  ${zeroBatches.length} batches with near-zero SBD ending (suppressed from detail view)`);
  console.log(`  ${details.filter((d) => d.sbdEndingL === 0 && d.effectiveInitialL === 0 && d.transfersInL === 0 && d.mergesInL === 0).length} batches with exactly zero volume (no activity before cutoff)`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
