import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Per-batch balance audit: reconstructs each batch's volume from all inflows/outflows
 * and compares to currentVolumeLiters. The gap = liquid unaccounted for.
 *
 * This matches the computeSystemCalculatedOnHand logic in ttb.ts exactly, including:
 *  - Smart bottling loss detection (avoid double-counting when loss is baked into volumeTakenLiters)
 *  - Historical racking exclusion
 *  - Unit conversions for keg_fills (volume_taken_unit, loss_unit) and bottle_runs (loss_unit)
 *  - Both soft-delete columns on keg_fills (voided_at + deleted_at)
 *  - Transfer-created batch detection
 */

const GAL_PER_LITER = 0.264172;
const LITERS_PER_GAL = 3.78541;

interface BatchRow {
  id: string;
  custom_name: string | null;
  batch_number: string | null;
  parent_batch_id: string | null;
  product_type: string | null;
  reconciliation_status: string | null;
  initial_l: string;
  current_l: string;
  start_date: string | null;
}

interface BottleRunRow {
  volume_taken_liters: string;
  loss: string | null;
  loss_unit: string | null;
  units_produced: string | null;
  package_size_ml: string | null;
}

function toL(val: string | null | undefined): number {
  return parseFloat(val || "0");
}

async function main() {
  // Get ALL non-deleted batches (no reconciliation filter — we want to see every batch)
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           b.product_type, b.reconciliation_status,
           CAST(b.initial_volume_liters AS NUMERIC) as initial_l,
           CAST(b.current_volume_liters AS NUMERIC) as current_l,
           b.start_date::text as start_date
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.product_type, 'cider') != 'juice'
    ORDER BY b.start_date, b.batch_number
  `));

  const rows = batches.rows as unknown as BatchRow[];
  console.log(`\nAuditing ${rows.length} batches...\n`);

  let totalGapL = 0;
  let totalPositiveGapL = 0;
  let totalNegativeGapL = 0;
  let batchesWithGap = 0;

  const results: Array<{
    name: string;
    status: string;
    gapL: number;
    gapGal: number;
    currentL: number;
    reconstructedL: number;
    detail: string;
  }> = [];

  for (const batch of rows) {
    const bId = batch.id;
    const initial = toL(batch.initial_l);
    const currentVol = toL(batch.current_l);

    // Transfers
    const xfers = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN destination_batch_id = '${bId}'
          THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}'
          THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_out,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}'
          THEN CAST(COALESCE(loss, '0') AS NUMERIC) ELSE 0 END), 0) as xfer_loss
      FROM batch_transfers
      WHERE (source_batch_id = '${bId}' OR destination_batch_id = '${bId}') AND deleted_at IS NULL
    `));

    // Merges (3 source types: batch, press_run, juice_purchase — all use target_batch_id)
    const merges = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN target_batch_id = '${bId}'
          THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}'
          THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_out
      FROM batch_merge_history
      WHERE (target_batch_id = '${bId}' OR source_batch_id = '${bId}') AND deleted_at IS NULL
    `));

    // Bottling — smart loss detection matching computeSystemCalculatedOnHand
    const bottleRows = await db.execute(sql.raw(`
      SELECT CAST(volume_taken_liters AS NUMERIC) as volume_taken_liters,
             loss::text as loss, loss_unit,
             units_produced::text as units_produced,
             package_size_ml::text as package_size_ml
      FROM bottle_runs
      WHERE batch_id = '${bId}' AND voided_at IS NULL
    `));
    let bottlingVol = 0;
    let bottlingLoss = 0;
    for (const br of bottleRows.rows as unknown as BottleRunRow[]) {
      const volTaken = toL(br.volume_taken_liters);
      const rawLoss = toL(br.loss);
      const lossInLiters =
        br.loss_unit === "gal" ? rawLoss * LITERS_PER_GAL : rawLoss;
      const unitsProduced = toL(br.units_produced);
      const pkgSizeMl = toL(br.package_size_ml);
      const productVol = (unitsProduced * pkgSizeMl) / 1000;

      // Smart detection: if volumeTakenLiters ≈ productVol + loss, loss is already included
      const lossIncluded =
        Math.abs(volTaken - (productVol + lossInLiters)) < 2;
      bottlingVol += volTaken;
      if (!lossIncluded) {
        bottlingLoss += lossInLiters;
      }
    }

    // Kegging — with unit conversions and both soft-delete checks
    const kegging = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(
          CASE WHEN volume_taken_unit = 'gal'
            THEN CAST(volume_taken AS NUMERIC) * ${LITERS_PER_GAL}
            ELSE CAST(volume_taken AS NUMERIC) END
        ), 0) as vol,
        COALESCE(SUM(
          CASE WHEN loss_unit = 'gal'
            THEN CAST(COALESCE(loss, '0') AS NUMERIC) * ${LITERS_PER_GAL}
            ELSE CAST(COALESCE(loss, '0') AS NUMERIC) END
        ), 0) as loss
      FROM keg_fills
      WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL
    `));

    // Distillation
    const distill = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as vol
      FROM distillation_records
      WHERE source_batch_id = '${bId}' AND deleted_at IS NULL AND status IN ('sent', 'received')
    `));

    // Adjustments (net: positive = inflow, negative = outflow)
    const adj = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as vol
      FROM batch_volume_adjustments
      WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Racking loss (excluding Historical Record)
    const rackLoss = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
      FROM batch_racking_operations
      WHERE batch_id = '${bId}' AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
    `));

    // Filter loss
    const filterLoss = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
      FROM batch_filter_operations
      WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    const xi = toL((xfers.rows[0] as any).xfer_in);
    const xo = toL((xfers.rows[0] as any).xfer_out);
    const xl = toL((xfers.rows[0] as any).xfer_loss);
    const mi = toL((merges.rows[0] as any).merge_in);
    const mo = toL((merges.rows[0] as any).merge_out);
    const kv = toL((kegging.rows[0] as any).vol);
    const kl = toL((kegging.rows[0] as any).loss);
    const dv = toL((distill.rows[0] as any).vol);
    const av = toL((adj.rows[0] as any).vol);
    const rl = toL((rackLoss.rows[0] as any).vol);
    const fl = toL((filterLoss.rows[0] as any).vol);

    // Transfer-created batch detection (matches computeSystemCalculatedOnHand)
    const isTC =
      batch.parent_batch_id && xi >= initial * 0.9 && initial > 0;
    const effInit = isTC ? 0 : initial;

    // Reconstructed ending
    const reconstructed =
      effInit +
      mi - mo +
      xi - xo - xl -
      bottlingVol - bottlingLoss -
      kv - kl -
      dv +
      av -
      rl - fl;

    // Gap = reconstructed - currentVolumeLiters
    // Positive gap = system thinks there's more than DB shows (liquid untracked out)
    // Negative gap = system thinks there's less than DB shows (liquid untracked in)
    const gap = reconstructed - currentVol;

    if (Math.abs(gap) > 0.5) {
      batchesWithGap++;
      totalGapL += gap;
      if (gap > 0) totalPositiveGapL += gap;
      else totalNegativeGapL += gap;

      const name = batch.custom_name || batch.batch_number || bId.slice(0, 8);
      const status = batch.reconciliation_status || "pending";
      const detail = [
        `  Initial: ${initial.toFixed(1)}L (eff: ${effInit.toFixed(1)}${isTC ? " TC" : ""})`,
        `  +MergesIn:     ${mi.toFixed(1)}L`,
        mi > 0 ? "" : null,
        `  -MergesOut:    ${mo.toFixed(1)}L`,
        `  +XfersIn:      ${xi.toFixed(1)}L`,
        `  -XfersOut:     ${xo.toFixed(1)}L`,
        `  -XferLoss:     ${xl.toFixed(1)}L`,
        `  -Bottling:     ${bottlingVol.toFixed(1)}L (loss: ${bottlingLoss.toFixed(1)})`,
        `  -Kegging:      ${kv.toFixed(1)}L (loss: ${kl.toFixed(1)})`,
        `  -Distillation: ${dv.toFixed(1)}L`,
        `  +Adjustments:  ${av.toFixed(1)}L`,
        `  -RackLoss:     ${rl.toFixed(1)}L`,
        `  -FilterLoss:   ${fl.toFixed(1)}L`,
        `  = Reconstructed: ${reconstructed.toFixed(1)}L`,
        `  DB current:      ${currentVol.toFixed(1)}L`,
        `  GAP:             ${gap.toFixed(1)}L = ${(gap * GAL_PER_LITER).toFixed(1)} gal`,
      ]
        .filter(Boolean)
        .join("\n");

      results.push({
        name,
        status,
        gapL: gap,
        gapGal: gap * GAL_PER_LITER,
        currentL: currentVol,
        reconstructedL: reconstructed,
        detail,
      });
    }
  }

  // Sort by absolute gap descending
  results.sort((a, b) => Math.abs(b.gapL) - Math.abs(a.gapL));

  console.log("=".repeat(80));
  console.log("PER-BATCH BALANCE AUDIT — Batches with gaps > 0.5L");
  console.log("=".repeat(80));
  console.log(
    `Positive gap = reconstructed > currentVol (liquid untracked OUT or currentVol too low)`
  );
  console.log(
    `Negative gap = reconstructed < currentVol (liquid untracked IN or currentVol too high)`
  );
  console.log("=".repeat(80));

  for (const r of results) {
    const sign = r.gapL > 0 ? "+" : "";
    console.log(
      `\n${r.name} [${r.status}]  GAP: ${sign}${r.gapGal.toFixed(1)} gal (${sign}${r.gapL.toFixed(1)}L)`
    );
    console.log(r.detail);
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total batches:      ${rows.length}`);
  console.log(`Batches with gap:   ${batchesWithGap}`);
  console.log(
    `Net gap:            ${totalGapL.toFixed(1)}L = ${(totalGapL * GAL_PER_LITER).toFixed(1)} gal`
  );
  console.log(
    `Positive gaps:      +${totalPositiveGapL.toFixed(1)}L = +${(totalPositiveGapL * GAL_PER_LITER).toFixed(1)} gal (untracked removals)`
  );
  console.log(
    `Negative gaps:      ${totalNegativeGapL.toFixed(1)}L = ${(totalNegativeGapL * GAL_PER_LITER).toFixed(1)} gal (untracked additions)`
  );
  console.log("=".repeat(80));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
