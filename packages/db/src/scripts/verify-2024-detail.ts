/**
 * Verify 2024 Detail — Per-Batch SBD Reconstruction
 *
 * Reconstructs the volume of ALL in-bond batches as of Dec 31, 2024 using
 * per-batch SBD (System-Based Data) reconstruction. Shows full breakdown
 * for every batch with SBD ending > 0.1 gal, identifies the batches
 * contributing most to the +74.15 gal overshoot vs configured 1,121 gal
 * (1,061 HC + 60 W16-21), and shows "For Distillery" batch in detail.
 *
 * Run: cd packages/db && npx tsx src/scripts/verify-2024-detail.ts
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

const CUTOFF = "2024-12-31";
const L_PER_GAL = 3.78541;
const GAL_PER_L = 1 / L_PER_GAL;

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

function fmtGal(gal: number): string {
  return gal.toFixed(2);
}

function fmtRow(label: string, gal: number, liters: number): string {
  const sign = gal >= 0 ? "+" : "";
  return `    ${label.padEnd(20)} ${sign}${fmtGal(gal).padStart(10)} gal  (${liters.toFixed(1)}L)`;
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
  reconStatus: string | null;
  vesselName: string | null;
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

async function reconstructBatch(batch: BatchRow): Promise<BatchDetail> {
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
  const transfersOutL = num(
    (tOutResult.rows[0] as { total: string; loss_total: string }).total,
  );
  const transferLossL = num(
    (tOutResult.rows[0] as { total: string; loss_total: string }).loss_total,
  );

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

  // Bottling (date-bounded) — bottle_runs has NO deleted_at, only voided_at
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
    const lossInLiters =
      br.loss_unit === "gal" ? rawLoss * L_PER_GAL : rawLoss;
    const unitsProduced = num(br.units_produced);
    const pkgSizeMl = num(br.package_size_ml);
    const productVol = (unitsProduced * pkgSizeMl) / 1000;
    const lossIncluded =
      Math.abs(volTaken - (productVol + lossInLiters)) < 2;
    bottlingL += volTaken;
    if (!lossIncluded) bottlingLossL += lossInLiters;
  }

  // Kegging (date-bounded) — keg_fills has BOTH voided_at AND deleted_at
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
  const keggingL = num(
    (kegResult.rows[0] as { vol: string; loss: string }).vol,
  );
  const keggingLossL = num(
    (kegResult.rows[0] as { vol: string; loss: string }).loss,
  );

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
  const filterLossL = num(
    (filterResult.rows[0] as { total: string }).total,
  );

  // Adjustments (date-bounded)
  const adjResult = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as total
    FROM batch_volume_adjustments
    WHERE batch_id = ${bId}
      AND deleted_at IS NULL
      AND adjustment_date <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
  `);
  const adjustmentsL = num(
    (adjResult.rows[0] as { total: string }).total,
  );

  // Distillation (date-bounded)
  const distResult = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as total
    FROM distillation_records
    WHERE source_batch_id = ${bId}
      AND deleted_at IS NULL
      AND status IN ('sent', 'received')
      AND sent_at <= ${CUTOFF}::date + interval '1 day' - interval '1 second'
  `);
  const distillationL = num(
    (distResult.rows[0] as { total: string }).total,
  );

  // Transfer-created heuristic
  const isTransferCreated = !!(
    batch.parent_batch_id &&
    transfersInL >= initialL * 0.9 &&
    initialL > 0
  );
  const effectiveInitialL = isTransferCreated ? 0 : initialL;

  // SBD ending
  const sbdEndingL =
    effectiveInitialL +
    mergesInL -
    mergesOutL +
    transfersInL -
    transfersOutL -
    transferLossL -
    bottlingL -
    bottlingLossL -
    keggingL -
    keggingLossL -
    rackingLossL -
    filterLossL +
    adjustmentsL -
    distillationL;

  const name = batch.custom_name || batch.batch_number;
  const productType = batch.product_type || "cider";

  return {
    id: bId,
    name,
    productType,
    taxClass: taxClassFor(productType),
    reconStatus: batch.reconciliation_status,
    vesselName: batch.vessel_name,
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
  };
}

function printBatchDetail(d: BatchDetail): void {
  const sbdGal = toGal(d.sbdEndingL);
  const curGal = toGal(d.currentVolumeL);
  const tcLabel = d.isTransferCreated ? " [TC]" : "";
  const reconLabel = d.reconStatus ? ` [${d.reconStatus}]` : "";
  const vesselLabel = d.vesselName ? ` @ ${d.vesselName}` : "";

  console.log(
    `\n  ${d.name}${tcLabel}${reconLabel} (${d.productType})${vesselLabel}`,
  );
  console.log(`    ID: ${d.id}`);
  console.log(
    `    SBD Ending: ${fmtGal(sbdGal)} gal | Current: ${fmtGal(curGal)} gal | Delta: ${fmtGal(sbdGal - curGal)} gal`,
  );
  console.log(`    -------------------------------------------------------`);

  // Initial
  if (d.isTransferCreated) {
    console.log(
      `    Initial:       ${fmtGal(toGal(d.initialL)).padStart(10)} gal  (${d.initialL.toFixed(1)}L) -> effective 0 [transfer-created]`,
    );
  } else {
    console.log(fmtRow("Initial:", toGal(d.initialL), d.initialL));
  }

  // All flow items
  if (d.transfersInL > 0)
    console.log(fmtRow("+TransfersIn:", toGal(d.transfersInL), d.transfersInL));
  if (d.transfersOutL > 0)
    console.log(
      fmtRow("-TransfersOut:", -toGal(d.transfersOutL), -d.transfersOutL),
    );
  if (d.transferLossL > 0)
    console.log(
      fmtRow("-TransferLoss:", -toGal(d.transferLossL), -d.transferLossL),
    );
  if (d.mergesInL > 0)
    console.log(fmtRow("+MergesIn:", toGal(d.mergesInL), d.mergesInL));
  if (d.mergesOutL > 0)
    console.log(fmtRow("-MergesOut:", -toGal(d.mergesOutL), -d.mergesOutL));
  if (d.bottlingL > 0)
    console.log(fmtRow("-Bottling:", -toGal(d.bottlingL), -d.bottlingL));
  if (d.bottlingLossL > 0)
    console.log(
      fmtRow("-BottlingLoss:", -toGal(d.bottlingLossL), -d.bottlingLossL),
    );
  if (d.keggingL > 0)
    console.log(fmtRow("-Kegging:", -toGal(d.keggingL), -d.keggingL));
  if (d.keggingLossL > 0)
    console.log(
      fmtRow("-KeggingLoss:", -toGal(d.keggingLossL), -d.keggingLossL),
    );
  if (d.rackingLossL > 0)
    console.log(
      fmtRow("-RackingLoss:", -toGal(d.rackingLossL), -d.rackingLossL),
    );
  if (d.filterLossL > 0)
    console.log(
      fmtRow("-FilterLoss:", -toGal(d.filterLossL), -d.filterLossL),
    );
  if (d.adjustmentsL !== 0)
    console.log(
      fmtRow(
        `${d.adjustmentsL >= 0 ? "+" : ""}Adjustments:`,
        toGal(d.adjustmentsL),
        d.adjustmentsL,
      ),
    );
  if (d.distillationL > 0)
    console.log(
      fmtRow("-Distillation:", -toGal(d.distillationL), -d.distillationL),
    );

  console.log(
    `    ${"= SBD Ending:".padEnd(20)} ${fmtGal(sbdGal).padStart(10)} gal  (${d.sbdEndingL.toFixed(1)}L)`,
  );
}

async function main() {
  console.log("=".repeat(100));
  console.log(
    "  VERIFY 2024 DETAIL — PER-BATCH SBD RECONSTRUCTION AS OF " + CUTOFF,
  );
  console.log("=".repeat(100));
  console.log("");

  // ── 1. Find all in-bond batches as of Dec 31, 2024 ──
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

  // ── 2. Reconstruct each batch ──
  const details: BatchDetail[] = [];
  for (const batch of batches) {
    details.push(await reconstructBatch(batch));
  }

  // ── 3. Print per-batch detail for batches with SBD ending > 0.1 gal ──
  console.log(
    "SECTION 1: ALL BATCHES WITH SBD ENDING > 0.1 GAL (grouped by tax class)",
  );
  console.log("=".repeat(100));

  const byTaxClass: Record<string, BatchDetail[]> = {};
  for (const d of details) {
    if (!byTaxClass[d.taxClass]) byTaxClass[d.taxClass] = [];
    byTaxClass[d.taxClass].push(d);
  }

  const taxClassTotals: Record<
    string,
    { sbdGal: number; currentGal: number; count: number; shownCount: number }
  > = {};
  let grandTotalSbdGal = 0;
  let grandTotalCurrentGal = 0;

  for (const [taxClass, batchList] of Object.entries(byTaxClass).sort()) {
    // Sort by SBD ending descending
    batchList.sort((a, b) => b.sbdEndingL - a.sbdEndingL);

    let classSbdL = 0;
    let classCurrentL = 0;
    let shownCount = 0;

    console.log(
      `\n${"#".repeat(8)} ${taxClass} (${batchList.length} batches) ${"#".repeat(8)}`,
    );

    for (const d of batchList) {
      classSbdL += d.sbdEndingL;
      classCurrentL += d.currentVolumeL;

      if (toGal(d.sbdEndingL) > 0.1) {
        shownCount++;
        printBatchDetail(d);
      }
    }

    const classSbdGal = toGal(classSbdL);
    const classCurrentGal = toGal(classCurrentL);
    taxClassTotals[taxClass] = {
      sbdGal: classSbdGal,
      currentGal: classCurrentGal,
      count: batchList.length,
      shownCount,
    };
    grandTotalSbdGal += classSbdGal;
    grandTotalCurrentGal += classCurrentGal;

    console.log(
      `\n  >> ${taxClass} SUBTOTAL (${shownCount} shown / ${batchList.length} total):`,
    );
    console.log(`     SBD: ${fmtGal(classSbdGal)} gal`);
    console.log(`     Current: ${fmtGal(classCurrentGal)} gal`);
  }

  // ── 4. Summary totals ──
  console.log("\n" + "=".repeat(100));
  console.log("SECTION 2: TAX CLASS TOTALS (SBD reconstruction as of " + CUTOFF + ")");
  console.log("=".repeat(100));

  for (const [cls, t] of Object.entries(taxClassTotals).sort()) {
    console.log(
      `  ${cls.padEnd(15)} | ${String(t.shownCount).padStart(3)} shown / ${String(t.count).padStart(3)} total | SBD: ${fmtGal(t.sbdGal).padStart(10)} gal | Current: ${fmtGal(t.currentGal).padStart(10)} gal`,
    );
  }
  console.log("-".repeat(80));
  console.log(
    `  ${"GRAND TOTAL".padEnd(15)} | ${details.length} batches         | SBD: ${fmtGal(grandTotalSbdGal).padStart(10)} gal | Current: ${fmtGal(grandTotalCurrentGal).padStart(10)} gal`,
  );

  // ── 5. Comparison with configured 1,121 gal ──
  console.log("\n" + "=".repeat(100));
  console.log("SECTION 3: COMPARISON WITH CONFIGURED TTB OPENING BALANCE");
  console.log("=".repeat(100));

  const settingsResult = await db.execute(sql`
    SELECT ttb_opening_balances, ttb_opening_balance_date
    FROM organization_settings
    LIMIT 1
  `);
  const settings = settingsResult.rows[0] as {
    ttb_opening_balances: {
      bulk: Record<string, number>;
      bottled: Record<string, number>;
    };
    ttb_opening_balance_date: string;
  };

  const ob = settings.ttb_opening_balances;
  const configuredHC =
    (ob.bulk?.hardCider || 0) + (ob.bottled?.hardCider || 0);
  const configuredW16 =
    (ob.bulk?.wineUnder16 || 0) + (ob.bottled?.wineUnder16 || 0);
  const configuredW1621 =
    (ob.bulk?.wine16To21 || 0) + (ob.bottled?.wine16To21 || 0);
  const configuredTotal = configuredHC + configuredW16 + configuredW1621;

  const sbdHC = taxClassTotals["hardCider"]?.sbdGal || 0;
  const sbdW16 = taxClassTotals["wineUnder16"]?.sbdGal || 0;
  const sbdW1621 = taxClassTotals["wine16To21"]?.sbdGal || 0;

  const hcDelta = sbdHC - configuredHC;
  const w16Delta = sbdW16 - configuredW16;
  const w1621Delta = sbdW1621 - configuredW1621;
  const totalDelta = grandTotalSbdGal - configuredTotal;

  console.log(
    `\n  ${"".padEnd(18)} ${"Configured".padStart(12)} ${"SBD".padStart(12)} ${"Delta".padStart(12)}`,
  );
  console.log("  " + "-".repeat(56));
  console.log(
    `  ${"hardCider".padEnd(18)} ${fmtGal(configuredHC).padStart(12)} ${fmtGal(sbdHC).padStart(12)} ${(hcDelta >= 0 ? "+" : "") + fmtGal(hcDelta)}`.padStart(
      12,
    ),
  );
  console.log(
    `  ${"wineUnder16".padEnd(18)} ${fmtGal(configuredW16).padStart(12)} ${fmtGal(sbdW16).padStart(12)} ${(w16Delta >= 0 ? "+" : "") + fmtGal(w16Delta)}`.padStart(
      12,
    ),
  );
  console.log(
    `  ${"wine16To21".padEnd(18)} ${fmtGal(configuredW1621).padStart(12)} ${fmtGal(sbdW1621).padStart(12)} ${(w1621Delta >= 0 ? "+" : "") + fmtGal(w1621Delta)}`.padStart(
      12,
    ),
  );
  console.log("  " + "-".repeat(56));
  console.log(
    `  ${"TOTAL".padEnd(18)} ${fmtGal(configuredTotal).padStart(12)} ${fmtGal(grandTotalSbdGal).padStart(12)} ${(totalDelta >= 0 ? "+" : "") + fmtGal(totalDelta)}`.padStart(
      12,
    ),
  );

  // ── 6. Largest HC contributors to overshoot ──
  console.log("\n" + "=".repeat(100));
  console.log(
    "SECTION 4: HC BATCHES — LARGEST CONTRIBUTORS TO OVERSHOOT",
  );
  console.log(
    `  (HC SBD total ${fmtGal(sbdHC)} gal vs configured ${fmtGal(configuredHC)} gal = ${hcDelta >= 0 ? "+" : ""}${fmtGal(hcDelta)} gal delta)`,
  );
  console.log("=".repeat(100));

  // Show HC batches sorted by SBD ending (descending), each with its contribution
  const hcBatches = (byTaxClass["hardCider"] || []).filter(
    (d) => toGal(d.sbdEndingL) > 0.1,
  );
  hcBatches.sort((a, b) => b.sbdEndingL - a.sbdEndingL);

  // Table header
  console.log(
    `\n  ${"#".padStart(3)} ${"Batch Name".padEnd(40)} ${"SBD gal".padStart(10)} ${"Cur gal".padStart(10)} ${"SBD-Cur".padStart(10)} ${"Recon".padStart(10)} ${"TC?".padStart(4)}`,
  );
  console.log("  " + "-".repeat(90));

  let cumulativeSbd = 0;
  for (let i = 0; i < hcBatches.length; i++) {
    const d = hcBatches[i];
    const sbdGal = toGal(d.sbdEndingL);
    const curGal = toGal(d.currentVolumeL);
    cumulativeSbd += sbdGal;
    console.log(
      `  ${String(i + 1).padStart(3)} ${d.name.padEnd(40)} ${fmtGal(sbdGal).padStart(10)} ${fmtGal(curGal).padStart(10)} ${fmtGal(sbdGal - curGal).padStart(10)} ${(d.reconStatus || "null").padStart(10)} ${d.isTransferCreated ? " [TC]" : "    "}`,
    );
  }
  console.log("  " + "-".repeat(90));
  console.log(
    `  ${"".padStart(3)} ${"TOTAL".padEnd(40)} ${fmtGal(cumulativeSbd).padStart(10)}`,
  );

  // Identify batches where SBD > currentVolume (volume that "shouldn't" be there)
  console.log(
    "\n  HC batches where SBD ending > current volume (potential overshoot sources):",
  );
  const overshootBatches = hcBatches.filter(
    (d) => toGal(d.sbdEndingL) - toGal(d.currentVolumeL) > 0.5,
  );
  if (overshootBatches.length === 0) {
    console.log("    None found.");
  } else {
    let overshootTotal = 0;
    for (const d of overshootBatches.sort(
      (a, b) =>
        toGal(b.sbdEndingL) -
        toGal(b.currentVolumeL) -
        (toGal(a.sbdEndingL) - toGal(a.currentVolumeL)),
    )) {
      const delta = toGal(d.sbdEndingL) - toGal(d.currentVolumeL);
      overshootTotal += delta;
      console.log(
        `    ${d.name.padEnd(40)} SBD=${fmtGal(toGal(d.sbdEndingL))} cur=${fmtGal(toGal(d.currentVolumeL))} delta=+${fmtGal(delta)} gal`,
      );
    }
    console.log(
      `    TOTAL SBD-Current overshoot: +${fmtGal(overshootTotal)} gal`,
    );
  }

  // Also show batches where SBD < current (undershoot — other side)
  console.log(
    "\n  HC batches where SBD ending < current volume (potential undershoot):",
  );
  const undershootBatches = hcBatches.filter(
    (d) => toGal(d.currentVolumeL) - toGal(d.sbdEndingL) > 0.5,
  );
  if (undershootBatches.length === 0) {
    console.log("    None found.");
  } else {
    let undershootTotal = 0;
    for (const d of undershootBatches.sort(
      (a, b) =>
        toGal(b.currentVolumeL) -
        toGal(b.sbdEndingL) -
        (toGal(a.currentVolumeL) - toGal(a.sbdEndingL)),
    )) {
      const delta = toGal(d.currentVolumeL) - toGal(d.sbdEndingL);
      undershootTotal += delta;
      console.log(
        `    ${d.name.padEnd(40)} SBD=${fmtGal(toGal(d.sbdEndingL))} cur=${fmtGal(toGal(d.currentVolumeL))} delta=-${fmtGal(delta)} gal`,
      );
    }
    console.log(
      `    TOTAL Current-SBD undershoot: -${fmtGal(undershootTotal)} gal`,
    );
  }

  // ── 7. "For Distillery" batch detail ──
  console.log("\n" + "=".repeat(100));
  console.log("SECTION 5: 'FOR DISTILLERY' BATCH — FULL BREAKDOWN");
  console.log("=".repeat(100));

  const distilleryBatches = details.filter(
    (d) =>
      d.name.toLowerCase().includes("distillery") ||
      d.name.toLowerCase().includes("for distill"),
  );

  if (distilleryBatches.length === 0) {
    console.log("  No 'For Distillery' batch found. Checking broader search...");
    // Try broader search
    const distBatchResult = await db.execute(sql`
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
        AND (b.custom_name ILIKE '%distill%' OR b.batch_number ILIKE '%distill%')
      ORDER BY b.start_date
    `);
    if (distBatchResult.rows.length > 0) {
      console.log(
        `  Found ${distBatchResult.rows.length} distillery-related batches:`,
      );
      for (const row of distBatchResult.rows as unknown as BatchRow[]) {
        console.log(
          `    - ${row.custom_name || row.batch_number} (${row.product_type}, start: ${row.start_date})`,
        );
      }
      // Reconstruct whichever ones are in our detail set
      for (const row of distBatchResult.rows as unknown as BatchRow[]) {
        const existing = details.find((d) => d.id === row.id);
        if (existing) {
          printBatchDetail(existing);
        } else {
          // Reconstruct it if not already done (e.g., if it was brandy)
          console.log(
            `\n  Note: ${row.custom_name || row.batch_number} was excluded from main analysis (product_type=${row.product_type})`,
          );
        }
      }
    } else {
      console.log("  No distillery-related batches found at all.");
    }
  } else {
    for (const d of distilleryBatches) {
      printBatchDetail(d);

      // Also show individual transfers in/out for this batch
      console.log("\n    --- Individual Transfers IN ---");
      const tInDetail = await db.execute(sql`
        SELECT
          bt.id,
          CAST(bt.volume_transferred AS TEXT) as vol,
          CAST(bt.loss AS TEXT) as loss,
          bt.transferred_at::text as at,
          bt.notes,
          sb.custom_name as source_name,
          sb.batch_number as source_number,
          sb.product_type as source_type
        FROM batch_transfers bt
        LEFT JOIN batches sb ON bt.source_batch_id = sb.id
        WHERE bt.destination_batch_id = ${d.id}
          AND bt.deleted_at IS NULL
        ORDER BY bt.transferred_at
      `);
      if (tInDetail.rows.length === 0) {
        console.log("      (none)");
      }
      for (const t of tInDetail.rows as unknown as {
        id: string;
        vol: string;
        loss: string;
        at: string;
        notes: string | null;
        source_name: string | null;
        source_number: string;
        source_type: string;
      }[]) {
        const volGal = toGal(num(t.vol));
        const lossGal = toGal(num(t.loss));
        const dateCutoff =
          new Date(t.at) <= new Date("2024-12-31T23:59:59Z")
            ? ""
            : " [AFTER CUTOFF]";
        console.log(
          `      ${t.at}${dateCutoff}: ${fmtGal(volGal)} gal from ${t.source_name || t.source_number} (${t.source_type})${lossGal > 0 ? ` loss=${fmtGal(lossGal)}` : ""}${t.notes ? ` "${t.notes}"` : ""}`,
        );
      }

      console.log("\n    --- Individual Transfers OUT ---");
      const tOutDetail = await db.execute(sql`
        SELECT
          bt.id,
          CAST(bt.volume_transferred AS TEXT) as vol,
          CAST(bt.loss AS TEXT) as loss,
          bt.transferred_at::text as at,
          bt.notes,
          db.custom_name as dest_name,
          db.batch_number as dest_number,
          db.product_type as dest_type
        FROM batch_transfers bt
        LEFT JOIN batches db ON bt.destination_batch_id = db.id
        WHERE bt.source_batch_id = ${d.id}
          AND bt.deleted_at IS NULL
        ORDER BY bt.transferred_at
      `);
      if (tOutDetail.rows.length === 0) {
        console.log("      (none)");
      }
      for (const t of tOutDetail.rows as unknown as {
        id: string;
        vol: string;
        loss: string;
        at: string;
        notes: string | null;
        dest_name: string | null;
        dest_number: string;
        dest_type: string;
      }[]) {
        const volGal = toGal(num(t.vol));
        const lossGal = toGal(num(t.loss));
        const dateCutoff =
          new Date(t.at) <= new Date("2024-12-31T23:59:59Z")
            ? ""
            : " [AFTER CUTOFF]";
        console.log(
          `      ${t.at}${dateCutoff}: ${fmtGal(volGal)} gal to ${t.dest_name || t.dest_number} (${t.dest_type})${lossGal > 0 ? ` loss=${fmtGal(lossGal)}` : ""}${t.notes ? ` "${t.notes}"` : ""}`,
        );
      }

      console.log("\n    --- Individual Merges IN ---");
      const mInDetail = await db.execute(sql`
        SELECT
          bmh.id,
          CAST(bmh.volume_added AS TEXT) as vol,
          bmh.merged_at::text as at,
          bmh.notes,
          sb.custom_name as source_name,
          sb.batch_number as source_number,
          sb.product_type as source_type,
          bmh.source_batch_id,
          bmh.source_press_run_id,
          bmh.source_juice_purchase_item_id
        FROM batch_merge_history bmh
        LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
        WHERE bmh.target_batch_id = ${d.id}
          AND bmh.deleted_at IS NULL
        ORDER BY bmh.merged_at
      `);
      if (mInDetail.rows.length === 0) {
        console.log("      (none)");
      }
      for (const m of mInDetail.rows as unknown as {
        id: string;
        vol: string;
        at: string;
        notes: string | null;
        source_name: string | null;
        source_number: string | null;
        source_type: string | null;
        source_batch_id: string | null;
        source_press_run_id: string | null;
        source_juice_purchase_item_id: string | null;
      }[]) {
        const volGal = toGal(num(m.vol));
        const dateCutoff =
          new Date(m.at) <= new Date("2024-12-31T23:59:59Z")
            ? ""
            : " [AFTER CUTOFF]";
        let sourceLabel = "(unknown source)";
        if (m.source_batch_id)
          sourceLabel = `batch: ${m.source_name || m.source_number}`;
        else if (m.source_press_run_id)
          sourceLabel = `press run: ${m.source_press_run_id}`;
        else if (m.source_juice_purchase_item_id)
          sourceLabel = `juice purchase: ${m.source_juice_purchase_item_id}`;
        console.log(
          `      ${m.at}${dateCutoff}: ${fmtGal(volGal)} gal from ${sourceLabel}${m.notes ? ` "${m.notes}"` : ""}`,
        );
      }

      console.log("\n    --- Distillation Records ---");
      const distDetail = await db.execute(sql`
        SELECT
          dr.id,
          CAST(dr.source_volume_liters AS TEXT) as vol,
          dr.status,
          dr.sent_at::text as sent,
          dr.notes
        FROM distillation_records dr
        WHERE dr.source_batch_id = ${d.id}
          AND dr.deleted_at IS NULL
        ORDER BY dr.sent_at
      `);
      if (distDetail.rows.length === 0) {
        console.log("      (none)");
      }
      for (const dr of distDetail.rows as unknown as {
        id: string;
        vol: string;
        status: string;
        sent: string;
        notes: string | null;
      }[]) {
        const volGal = toGal(num(dr.vol));
        const dateCutoff =
          new Date(dr.sent) <= new Date("2024-12-31T23:59:59Z")
            ? ""
            : " [AFTER CUTOFF]";
        console.log(
          `      ${dr.sent}${dateCutoff}: ${fmtGal(volGal)} gal (status=${dr.status})${dr.notes ? ` "${dr.notes}"` : ""}`,
        );
      }

      console.log("\n    --- Adjustments ---");
      const adjDetail = await db.execute(sql`
        SELECT
          bva.id,
          CAST(bva.adjustment_amount AS TEXT) as amt,
          bva.reason,
          bva.adjustment_date::text as at
        FROM batch_volume_adjustments bva
        WHERE bva.batch_id = ${d.id}
          AND bva.deleted_at IS NULL
        ORDER BY bva.adjustment_date
      `);
      if (adjDetail.rows.length === 0) {
        console.log("      (none)");
      }
      for (const a of adjDetail.rows as unknown as {
        id: string;
        amt: string;
        reason: string | null;
        at: string;
      }[]) {
        const amtGal = toGal(num(a.amt));
        const dateCutoff =
          new Date(a.at) <= new Date("2024-12-31T23:59:59Z")
            ? ""
            : " [AFTER CUTOFF]";
        console.log(
          `      ${a.at}${dateCutoff}: ${amtGal >= 0 ? "+" : ""}${fmtGal(amtGal)} gal${a.reason ? ` "${a.reason}"` : ""}`,
        );
      }
    }
  }

  // ── 8. Negative SBD batches ──
  const negativeBatches = details.filter((d) => d.sbdEndingL < -0.5);
  if (negativeBatches.length > 0) {
    console.log("\n" + "=".repeat(100));
    console.log("SECTION 6: BATCHES WITH NEGATIVE SBD ENDING (< -0.5L)");
    console.log("=".repeat(100));
    for (const d of negativeBatches.sort(
      (a, b) => a.sbdEndingL - b.sbdEndingL,
    )) {
      printBatchDetail(d);
    }
  }

  // ── 9. Summary statistics ──
  console.log("\n" + "=".repeat(100));
  console.log("SECTION 7: SUMMARY STATISTICS");
  console.log("=".repeat(100));

  const withVolume = details.filter((d) => toGal(d.sbdEndingL) > 0.1);
  const transferCreated = details.filter((d) => d.isTransferCreated);
  const zeroVolume = details.filter(
    (d) => Math.abs(d.sbdEndingL) <= 0.5 && d.effectiveInitialL === 0 && d.transfersInL === 0,
  );

  console.log(`  Total batches analyzed:         ${details.length}`);
  console.log(`  Batches with SBD > 0.1 gal:     ${withVolume.length}`);
  console.log(`  Transfer-created batches:        ${transferCreated.length}`);
  console.log(`  Zero-volume (no activity):       ${zeroVolume.length}`);
  console.log(`  Negative SBD (< -0.5L):         ${negativeBatches.length}`);
  console.log("");
  console.log(`  Grand total SBD:                ${fmtGal(grandTotalSbdGal)} gal`);
  console.log(`  Grand total current:            ${fmtGal(grandTotalCurrentGal)} gal`);
  console.log(`  Configured opening:             ${fmtGal(configuredTotal)} gal`);
  console.log(
    `  Overshoot (SBD - configured):   ${totalDelta >= 0 ? "+" : ""}${fmtGal(totalDelta)} gal`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
