import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Per-batch volume reconciliation for ALL Wine <16% (product_type = 'wine')
 * and Wine 16-21% (product_type = 'pommeau') batches.
 *
 * For each batch, computes total volume in, total volume out, and compares
 * to current_volume_liters. The difference = unaccounted volume.
 */

const LITERS_PER_GAL = 3.78541;
const GAL_PER_LITER = 0.264172;

function toL(val: string | null | undefined): number {
  return parseFloat(val || "0");
}

function fmt(liters: number, decimals = 2): string {
  return liters.toFixed(decimals);
}

function fmtGal(liters: number, decimals = 2): string {
  return (liters * GAL_PER_LITER).toFixed(decimals);
}

interface BatchRow {
  id: string;
  custom_name: string | null;
  batch_number: string | null;
  product_type: string;
  reconciliation_status: string | null;
  initial_l: string;
  current_l: string;
}

interface BatchResult {
  name: string;
  productType: string;
  reconStatus: string;
  initialL: number;
  xferInL: number;
  mergesInL: number;
  adjInL: number;
  totalInL: number;
  xferOutL: number;
  bottlesL: number;
  kegsL: number;
  adjOutL: number;
  distillL: number;
  totalOutL: number;
  currentL: number;
  unaccountedL: number;
}

async function main() {
  console.log("Per-batch volume reconciliation for Wine <16% and Wine 16-21%\n");
  console.log("=".repeat(80));

  // Get all wine and pommeau batches
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number,
           b.product_type,
           b.reconciliation_status,
           CAST(b.initial_volume_liters AS NUMERIC) as initial_l,
           CAST(b.current_volume_liters AS NUMERIC) as current_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('wine', 'pommeau')
    ORDER BY b.product_type, b.batch_number
  `));

  const rows = batches.rows as unknown as BatchRow[];
  console.log(`Found ${rows.length} batches (wine + pommeau)\n`);

  const results: BatchResult[] = [];

  for (const batch of rows) {
    const bId = batch.id;
    const initial = toL(batch.initial_l);
    const currentVol = toL(batch.current_l);

    // 1. Transfers IN
    const xferInRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_transferred AS NUMERIC)), 0) as vol
      FROM batch_transfers
      WHERE destination_batch_id = '${bId}' AND deleted_at IS NULL
    `));
    const xferIn = toL((xferInRes.rows[0] as any).vol);

    // 2. Merges IN (volume_added column, has deleted_at)
    const mergesInRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_added AS NUMERIC)), 0) as vol
      FROM batch_merge_history
      WHERE target_batch_id = '${bId}' AND deleted_at IS NULL
    `));
    const mergesIn = toL((mergesInRes.rows[0] as any).vol);

    // 3. Positive adjustments
    const adjInRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as vol
      FROM batch_volume_adjustments
      WHERE batch_id = '${bId}' AND adjustment_amount > 0 AND deleted_at IS NULL
    `));
    const adjIn = toL((adjInRes.rows[0] as any).vol);

    // 4. Transfers OUT
    const xferOutRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_transferred AS NUMERIC)), 0) as vol
      FROM batch_transfers
      WHERE source_batch_id = '${bId}' AND deleted_at IS NULL
    `));
    const xferOut = toL((xferOutRes.rows[0] as any).vol);

    // 5. Bottle runs (voided_at only — NO deleted_at on bottle_runs)
    const bottlesRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_taken_liters AS NUMERIC)), 0) as vol
      FROM bottle_runs
      WHERE batch_id = '${bId}' AND voided_at IS NULL
    `));
    const bottles = toL((bottlesRes.rows[0] as any).vol);

    // 6. Keg fills (voided_at AND deleted_at, convert gal to liters)
    const kegsRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        CASE WHEN volume_taken_unit = 'gal'
          THEN CAST(volume_taken AS NUMERIC) * ${LITERS_PER_GAL}
          ELSE CAST(volume_taken AS NUMERIC)
        END
      ), 0) as vol
      FROM keg_fills
      WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL
    `));
    const kegs = toL((kegsRes.rows[0] as any).vol);

    // 7. Negative adjustments (absolute value)
    const adjOutRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS NUMERIC))), 0) as vol
      FROM batch_volume_adjustments
      WHERE batch_id = '${bId}' AND adjustment_amount < 0 AND deleted_at IS NULL
    `));
    const adjOut = toL((adjOutRes.rows[0] as any).vol);

    // 8. Distillation (source_volume_liters from distillation_records)
    const distillRes = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as vol
      FROM distillation_records
      WHERE source_batch_id = '${bId}' AND deleted_at IS NULL
    `));
    const distill = toL((distillRes.rows[0] as any).vol);

    const totalIn = initial + xferIn + mergesIn + adjIn;
    const totalOut = xferOut + bottles + kegs + adjOut + distill;
    const unaccounted = totalIn - totalOut - currentVol;

    const name = batch.custom_name || batch.batch_number || bId.slice(0, 8);

    results.push({
      name,
      productType: batch.product_type,
      reconStatus: batch.reconciliation_status || "pending",
      initialL: initial,
      xferInL: xferIn,
      mergesInL: mergesIn,
      adjInL: adjIn,
      totalInL: totalIn,
      xferOutL: xferOut,
      bottlesL: bottles,
      kegsL: kegs,
      adjOutL: adjOut,
      distillL: distill,
      totalOutL: totalOut,
      currentL: currentVol,
      unaccountedL: unaccounted,
    });
  }

  // Sort by product_type first, then by ABS(unaccounted) DESC
  results.sort((a, b) => {
    if (a.productType !== b.productType) {
      return a.productType.localeCompare(b.productType);
    }
    return Math.abs(b.unaccountedL) - Math.abs(a.unaccountedL);
  });

  // Print each batch
  for (const r of results) {
    const typeLabel = r.productType === "wine" ? "Wine <16%" : "Wine 16-21%";
    console.log(
      `"${r.name}" [${typeLabel}] (recon: ${r.reconStatus})`
    );
    console.log(
      `  In:  initial=${fmt(r.initialL)} L, xferIn=${fmt(r.xferInL)} L, merges=${fmt(r.mergesInL)} L, adjIn=${fmt(r.adjInL)} L -> total_in=${fmt(r.totalInL)} L`
    );
    console.log(
      `  Out: xferOut=${fmt(r.xferOutL)} L, bottles=${fmt(r.bottlesL)} L, kegs=${fmt(r.kegsL)} L, adjOut=${fmt(r.adjOutL)} L, distill=${fmt(r.distillL)} L -> total_out=${fmt(r.totalOutL)} L`
    );
    console.log(`  Current: ${fmt(r.currentL)} L`);
    console.log(
      `  Unaccounted: ${fmt(r.unaccountedL)} L (${fmtGal(r.unaccountedL)} gal)`
    );
    console.log();
  }

  // === Summaries ===
  const wineResults = results.filter((r) => r.productType === "wine");
  const pommeauResults = results.filter((r) => r.productType === "pommeau");

  for (const [label, group] of [
    ["Wine <16%", wineResults],
    ["Wine 16-21%", pommeauResults],
  ] as const) {
    const totalIn = group.reduce((s, r) => s + r.totalInL, 0);
    const totalOut = group.reduce((s, r) => s + r.totalOutL, 0);
    const totalCurrent = group.reduce((s, r) => s + r.currentL, 0);
    const totalUnaccounted = group.reduce((s, r) => s + r.unaccountedL, 0);

    // Categorize unaccounted
    // "Racking/transfer losses": batches where xferOut > 0 and unaccounted != 0
    let rackingLosses = 0;
    let bottlingLosses = 0;
    let other = 0;
    for (const r of group) {
      if (Math.abs(r.unaccountedL) < 0.01) continue;
      if (r.xferOutL > 0 && r.bottlesL === 0 && r.kegsL === 0) {
        rackingLosses += r.unaccountedL;
      } else if (r.bottlesL > 0 || r.kegsL > 0) {
        bottlingLosses += r.unaccountedL;
      } else {
        other += r.unaccountedL;
      }
    }

    console.log(`=== ${label} Summary ===`);
    console.log(`Total batches: ${group.length}`);
    console.log(
      `Total volume in: ${fmt(totalIn)} L (${fmtGal(totalIn)} gal)`
    );
    console.log(
      `Total volume out: ${fmt(totalOut)} L (${fmtGal(totalOut)} gal)`
    );
    console.log(
      `Total current: ${fmt(totalCurrent)} L (${fmtGal(totalCurrent)} gal)`
    );
    console.log(
      `Total unaccounted: ${fmt(totalUnaccounted)} L (${fmtGal(totalUnaccounted)} gal)`
    );
    console.log(
      `  - Racking/transfer losses: ${fmt(rackingLosses)} L (${fmtGal(rackingLosses)} gal)`
    );
    console.log(
      `  - Bottling/kegging losses: ${fmt(bottlingLosses)} L (${fmtGal(bottlingLosses)} gal)`
    );
    console.log(
      `  - Other: ${fmt(other)} L (${fmtGal(other)} gal)`
    );
    console.log();
  }

  // === Pommeau-specific: racking loss records and negative adjustments ===
  console.log("=".repeat(80));
  console.log("POMMEAU (Wine 16-21%) — Racking loss & adjustment details");
  console.log("=".repeat(80));

  // Check for transfer_loss_l on pommeau batch transfers
  const pommeauBatchIds = pommeauResults.map((r) => {
    // We need the actual batch IDs — re-query
    return null;
  });

  // Re-query pommeau batch IDs
  const pommeauBatches = await db.execute(sql.raw(`
    SELECT b.id, COALESCE(b.custom_name, b.batch_number, b.id::text) as name
    FROM batches b
    WHERE b.deleted_at IS NULL AND b.product_type = 'pommeau'
  `));
  const pomBatchRows = pommeauBatches.rows as any[];

  if (pomBatchRows.length === 0) {
    console.log("No pommeau batches found.\n");
  } else {
    const pomIds = pomBatchRows.map((r: any) => `'${r.id}'`).join(", ");

    // Transfers with transfer_loss_l > 0
    const rackingLossXfers = await db.execute(sql.raw(`
      SELECT bt.source_batch_id, bt.destination_batch_id,
             CAST(bt.volume_transferred AS NUMERIC) as vol,
             CAST(COALESCE(bt.loss, '0') AS NUMERIC) as transfer_loss,
             bt.transferred_at::text as xfer_date,
             COALESCE(sb.custom_name, sb.batch_number, sb.id::text) as source_name,
             COALESCE(db2.custom_name, db2.batch_number, db2.id::text) as dest_name
      FROM batch_transfers bt
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
      WHERE (bt.source_batch_id IN (${pomIds}) OR bt.destination_batch_id IN (${pomIds}))
        AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at
    `));

    console.log(`\nPommeau-related transfers (${rackingLossXfers.rows.length} records):`);
    let anyLoss = false;
    for (const row of rackingLossXfers.rows as any[]) {
      const loss = toL(row.transfer_loss);
      const vol = toL(row.vol);
      const lossStr = loss > 0 ? ` ** LOSS: ${fmt(loss)} L **` : "";
      if (loss > 0) anyLoss = true;
      console.log(
        `  ${row.xfer_date}: "${row.source_name}" -> "${row.dest_name}" vol=${fmt(vol)} L${lossStr}`
      );
    }
    if (!anyLoss) {
      console.log("  (No transfers with loss > 0 found for pommeau batches)");
    }

    // Negative adjustments for pommeau batches
    const pomNegAdj = await db.execute(sql.raw(`
      SELECT bva.batch_id, bva.adjustment_amount::numeric as amt,
             bva.reason, bva.created_at::text as created,
             COALESCE(b.custom_name, b.batch_number, b.id::text) as batch_name
      FROM batch_volume_adjustments bva
      JOIN batches b ON b.id = bva.batch_id
      WHERE bva.batch_id IN (${pomIds})
        AND bva.deleted_at IS NULL
        AND bva.adjustment_amount < 0
      ORDER BY bva.created_at
    `));

    console.log(`\nPommeau negative adjustments (${pomNegAdj.rows.length} records):`);
    if (pomNegAdj.rows.length === 0) {
      console.log("  (No negative adjustments found for pommeau batches)");
    } else {
      for (const row of pomNegAdj.rows as any[]) {
        console.log(
          `  "${row.batch_name}" ${row.created}: ${fmt(toL(row.amt))} L — reason: ${row.reason || "(none)"}`
        );
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
