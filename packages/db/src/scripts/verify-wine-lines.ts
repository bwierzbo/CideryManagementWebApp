/**
 * Wine TTB Form Verification Script
 *
 * Independently queries the database for each line of the
 * Wine <16% and Wine 16-21% columns on TTB Form 5120.17.
 *
 * Classification:
 *   Wine <16%  = product_type = 'wine'    (fruit wines: plum, quince, black currant)
 *   Wine 16-21% = product_type = 'pommeau' (Salish batches, fortified ~18% ABV)
 *
 * Lines checked:
 *   1  - Opening inventory (from organization_settings JSONB)
 *   2  - Produced by fermentation
 *   4  - Produced by addition of wine spirits
 *  10  - Received by change of tax class (IN)
 *  12  - Total in (1 + 2 + 4 + 10)
 *  13  - Packaged (bottle_runs + keg_fills)
 *  16  - Distillation (sent to DSP)
 *  24  - Removed by change of tax class (OUT)
 *  31  - Ending bulk inventory
 *  29/30 - Losses (balancing figure)
 *
 * Per-batch loss detail for each tax class.
 */

import { db } from "..";
import { sql } from "drizzle-orm";

const LITERS_PER_GALLON = 3.78541;

function lToGal(liters: number): number {
  return liters / LITERS_PER_GALLON;
}

function fmtGal(gal: number): string {
  return gal.toFixed(1);
}

function fmtL(liters: number): string {
  return liters.toFixed(1);
}

function matchLabel(actual: number, expected: number): string {
  return Math.abs(actual - expected) < 0.15 ? "MATCH" : "MISMATCH";
}

/** Convert keg volume_taken to liters, accounting for volume_taken_unit */
function kegVolToLiters(vol: number, unit: string): number {
  if (unit === "gal") return vol * LITERS_PER_GALLON;
  return vol; // default 'L'
}

/** Convert keg loss to liters, accounting for loss_unit */
function kegLossToLiters(loss: number, unit: string): number {
  if (unit === "gal") return loss * LITERS_PER_GALLON;
  return loss; // default 'L'
}

interface TaxClassConfig {
  label: string;
  productTypes: string[];
  openingBalanceKey: string;
  expectedLine1: number;
  expectedLine2: number;
  expectedLine4: number;
  expectedLine10: number;
  expectedLine13: number;
  expectedLine16: number;
  expectedLine24: number;
  expectedLine31: number;
}

const WINE_UNDER_16: TaxClassConfig = {
  label: "WINE <16%",
  productTypes: ["wine"],
  openingBalanceKey: "wineUnder16",
  expectedLine1: 0,
  expectedLine2: 56.2,
  expectedLine4: 0,
  expectedLine10: 653.3,
  expectedLine13: 632.2,
  expectedLine16: 0,
  expectedLine24: 0,
  expectedLine31: 16.5,
};

const WINE_16_TO_21: TaxClassConfig = {
  label: "WINE 16-21%",
  productTypes: ["pommeau"],
  openingBalanceKey: "wine16To21",
  expectedLine1: 60.0,
  expectedLine2: 0,
  expectedLine4: 119.0,
  expectedLine10: 0,
  expectedLine13: 55.4,
  expectedLine16: 0,
  expectedLine24: 0,
  expectedLine31: 122.3,
};

async function verifyTaxClass(config: TaxClassConfig) {
  const ptList = config.productTypes.map((t) => `'${t}'`).join(",");

  console.log(`\n=== ${config.label} TTB Form Verification ===\n`);

  // ---------------------------------------------------------------
  // Line 1: Opening (from organization_settings)
  // ---------------------------------------------------------------
  const settingsResult = await db.execute(sql.raw(`
    SELECT ttb_opening_balances
    FROM organization_settings
    LIMIT 1
  `));
  const balances = (settingsResult.rows[0] as any)?.ttb_opening_balances as any;
  const line1Gal = Number(balances?.bulk?.[config.openingBalanceKey] ?? 0);
  console.log(
    `Line 1  (Opening):           ${fmtGal(line1Gal)} gal [${matchLabel(line1Gal, config.expectedLine1)} vs ${fmtGal(config.expectedLine1)}]`,
  );

  // ---------------------------------------------------------------
  // Line 2: Produced by fermentation
  // For wine <16%: direct fermentation batches (NOT transfer-derived)
  // For wine 16-21%: 0 (pommeau is made by adding spirits, not fermentation)
  // ---------------------------------------------------------------
  const fermentationResult = await db.execute(sql.raw(`
    SELECT
      b.id,
      b.custom_name,
      b.batch_number,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      b.parent_batch_id
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN (${ptList})
      AND b.start_date > '2024-12-31'
      AND (
        b.parent_batch_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM batch_transfers bt
          WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
          HAVING SUM(CAST(bt.volume_transferred AS NUMERIC)) >= CAST(b.initial_volume_liters AS NUMERIC) * 0.9
        )
      )
    ORDER BY b.start_date, b.custom_name
  `));
  let line2Liters = 0;
  const fermentBatches: Array<{ name: string; liters: number }> = [];
  for (const row of fermentationResult.rows as any[]) {
    const initL = parseFloat(row.init_l || "0");
    line2Liters += initL;
    fermentBatches.push({
      name: row.custom_name || row.batch_number,
      liters: initL,
    });
  }
  const line2Gal = lToGal(line2Liters);
  console.log(
    `Line 2  (Fermentation):      ${fmtGal(line2Gal)} gal [${matchLabel(line2Gal, config.expectedLine2)} vs ${fmtGal(config.expectedLine2)}]`,
  );
  for (const b of fermentBatches) {
    console.log(`  - ${b.name}: ${fmtL(b.liters)} L (${fmtGal(lToGal(b.liters))} gal)`);
  }

  // ---------------------------------------------------------------
  // Line 4: Produced by addition of wine spirits
  // For wine 16-21%: total initial volume of pommeau batches
  // For wine <16%: 0
  // ---------------------------------------------------------------
  let line4Liters = 0;
  const spiritsBatches: Array<{ name: string; liters: number }> = [];

  if (config.openingBalanceKey === "wine16To21") {
    // Pommeau is produced by blending apple juice with apple brandy (spirits addition)
    // These batches have initial_volume_liters representing total volume after spirits addition
    const spiritsResult = await db.execute(sql.raw(`
      SELECT
        b.id,
        b.custom_name,
        b.batch_number,
        CAST(b.initial_volume_liters AS NUMERIC) AS init_l
      FROM batches b
      WHERE b.deleted_at IS NULL
        AND b.product_type IN (${ptList})
        AND b.start_date > '2024-12-31'
      ORDER BY b.start_date, b.custom_name
    `));
    for (const row of spiritsResult.rows as any[]) {
      const initL = parseFloat(row.init_l || "0");
      line4Liters += initL;
      spiritsBatches.push({
        name: row.custom_name || row.batch_number,
        liters: initL,
      });
    }
  }
  const line4Gal = lToGal(line4Liters);
  console.log(
    `Line 4  (Wine spirits):      ${fmtGal(line4Gal)} gal [${matchLabel(line4Gal, config.expectedLine4)} vs ${fmtGal(config.expectedLine4)}]`,
  );
  for (const b of spiritsBatches) {
    console.log(`  - ${b.name}: ${fmtL(b.liters)} L (${fmtGal(lToGal(b.liters))} gal)`);
  }

  // ---------------------------------------------------------------
  // Line 10: Received by change of tax class (IN)
  // Transfers where source is a DIFFERENT tax class and dest is THIS tax class
  // For wine <16%: source = cider/perry, dest = wine
  // For wine 16-21%: unlikely, expected 0
  // ---------------------------------------------------------------
  // Build the opposite product types list for "class change IN"
  // Class change IN = source NOT in this class, dest IN this class
  const classInResult = await db.execute(sql.raw(`
    SELECT
      bt.id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol_liters,
      sb.custom_name AS source_name,
      sb.batch_number AS source_batch_number,
      sb.product_type AS source_type,
      db2.custom_name AS dest_name,
      db2.batch_number AS dest_batch_number,
      db2.product_type AS dest_type,
      bt.transferred_at
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id
    JOIN batches db2 ON db2.id = bt.destination_batch_id
    WHERE db2.product_type IN (${ptList})
      AND sb.product_type NOT IN (${ptList})
      AND sb.deleted_at IS NULL
      AND db2.deleted_at IS NULL
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));
  let line10Liters = 0;
  const classInDetails: Array<{
    sourceName: string;
    sourceType: string;
    destName: string;
    destType: string;
    liters: number;
    date: string;
  }> = [];
  for (const row of classInResult.rows as any[]) {
    const volL = parseFloat(row.vol_liters || "0");
    line10Liters += volL;
    const xDate = row.transferred_at
      ? new Date(row.transferred_at).toISOString().slice(0, 10)
      : "unknown";
    classInDetails.push({
      sourceName: row.source_name || row.source_batch_number,
      sourceType: row.source_type,
      destName: row.dest_name || row.dest_batch_number,
      destType: row.dest_type,
      liters: volL,
      date: xDate,
    });
  }
  const line10Gal = lToGal(line10Liters);
  console.log(
    `Line 10 (Class change IN):   ${fmtGal(line10Gal)} gal [${matchLabel(line10Gal, config.expectedLine10)} vs ${fmtGal(config.expectedLine10)}]`,
  );
  for (const d of classInDetails) {
    console.log(
      `  - ${d.sourceName} (${d.sourceType}) -> ${d.destName} (${d.destType}): ${fmtGal(lToGal(d.liters))} gal (${fmtL(d.liters)} L) on ${d.date}`,
    );
  }

  // ---------------------------------------------------------------
  // Line 12: Total In = Line 1 + Line 2 + Line 4 + Line 10
  // ---------------------------------------------------------------
  const line12Gal = line1Gal + line2Gal + line4Gal + line10Gal;
  console.log(
    `Line 12 (Total):             ${fmtGal(line12Gal)} gal`,
  );
  console.log(
    `  = ${fmtGal(line1Gal)} + ${fmtGal(line2Gal)} + ${fmtGal(line4Gal)} + ${fmtGal(line10Gal)}`,
  );

  // ---------------------------------------------------------------
  // Line 13: Packaged (Bottled + Kegged)
  // ---------------------------------------------------------------
  // Bottle runs
  const bottleResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(br.volume_taken_liters AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS run_count
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE br.voided_at IS NULL
      AND b.deleted_at IS NULL
      AND b.product_type IN (${ptList})
  `));
  const bottleLiters = parseFloat((bottleResult.rows[0] as any).total_liters);
  const bottleCount = parseInt((bottleResult.rows[0] as any).run_count, 10);
  const bottleGal = lToGal(bottleLiters);

  // Keg fills — must handle volume_taken_unit for unit conversion
  const kegResult = await db.execute(sql.raw(`
    SELECT
      kf.volume_taken,
      kf.volume_taken_unit,
      kf.loss,
      kf.loss_unit
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id
    WHERE kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND b.product_type IN (${ptList})
  `));
  let kegLiters = 0;
  let kegCount = 0;
  for (const row of kegResult.rows as any[]) {
    const vol = parseFloat(row.volume_taken || "0");
    const unit = row.volume_taken_unit || "L";
    kegLiters += kegVolToLiters(vol, unit);
    kegCount++;
  }
  const kegGal = lToGal(kegLiters);

  const line13Gal = bottleGal + kegGal;
  console.log(
    `Line 13 (Packaged):          ${fmtGal(line13Gal)} gal [${matchLabel(line13Gal, config.expectedLine13)} vs ${fmtGal(config.expectedLine13)}]`,
  );
  console.log(
    `  - Bottles: ${fmtGal(bottleGal)} gal (${bottleCount} runs, ${fmtL(bottleLiters)} L)`,
  );
  console.log(
    `  - Kegs:    ${fmtGal(kegGal)} gal (${kegCount} fills, ${fmtL(kegLiters)} L)`,
  );

  // ---------------------------------------------------------------
  // Line 16: Distillation
  // ---------------------------------------------------------------
  const distResult = await db.execute(sql.raw(`
    SELECT
      dr.id,
      dr.distillery_name,
      CAST(dr.source_volume_liters AS NUMERIC) AS vol_liters,
      b.custom_name AS batch_name,
      b.batch_number,
      b.product_type,
      dr.sent_at
    FROM distillation_records dr
    JOIN batches b ON b.id = dr.source_batch_id
    WHERE b.product_type IN (${ptList})
      AND b.deleted_at IS NULL
      AND dr.deleted_at IS NULL
    ORDER BY dr.sent_at
  `));
  let distTotalLiters = 0;
  const distRows = distResult.rows as any[];
  for (const row of distRows) {
    distTotalLiters += parseFloat(row.vol_liters || "0");
  }
  const line16Gal = lToGal(distTotalLiters);
  console.log(
    `Line 16 (Distillation):      ${fmtGal(line16Gal)} gal [${matchLabel(line16Gal, config.expectedLine16)} vs ${fmtGal(config.expectedLine16)}]`,
  );
  for (const row of distRows) {
    const volL = parseFloat(row.vol_liters || "0");
    const sentDate = row.sent_at
      ? new Date(row.sent_at).toISOString().slice(0, 10)
      : "unknown";
    console.log(
      `  - ${row.batch_name || row.batch_number} -> ${row.distillery_name}: ${fmtGal(lToGal(volL))} gal (${fmtL(volL)} L) sent ${sentDate}`,
    );
  }

  // ---------------------------------------------------------------
  // Line 24: Removed by change of tax class (OUT)
  // Source = THIS class, Dest = different class
  // ---------------------------------------------------------------
  const classOutResult = await db.execute(sql.raw(`
    SELECT
      bt.id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol_liters,
      sb.custom_name AS source_name,
      sb.batch_number AS source_batch_number,
      sb.product_type AS source_type,
      db2.custom_name AS dest_name,
      db2.batch_number AS dest_batch_number,
      db2.product_type AS dest_type,
      bt.transferred_at
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id
    JOIN batches db2 ON db2.id = bt.destination_batch_id
    WHERE sb.product_type IN (${ptList})
      AND db2.product_type NOT IN (${ptList})
      AND sb.deleted_at IS NULL
      AND db2.deleted_at IS NULL
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));
  let classOutTotalLiters = 0;
  const classOutRows = classOutResult.rows as any[];
  for (const row of classOutRows) {
    classOutTotalLiters += parseFloat(row.vol_liters || "0");
  }
  const line24Gal = lToGal(classOutTotalLiters);
  console.log(
    `Line 24 (Class change OUT):  ${fmtGal(line24Gal)} gal [${matchLabel(line24Gal, config.expectedLine24)} vs ${fmtGal(config.expectedLine24)}]`,
  );
  for (const row of classOutRows) {
    const volL = parseFloat(row.vol_liters || "0");
    const xDate = row.transferred_at
      ? new Date(row.transferred_at).toISOString().slice(0, 10)
      : "unknown";
    console.log(
      `  - ${row.source_name || row.source_batch_number} (${row.source_type}) -> ${row.dest_name || row.dest_batch_number} (${row.dest_type}): ${fmtGal(lToGal(volL))} gal (${fmtL(volL)} L) on ${xDate}`,
    );
  }

  // ---------------------------------------------------------------
  // Line 31: Ending bulk inventory
  // ---------------------------------------------------------------
  const endingResult = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) AS total_liters,
      COUNT(*) AS batch_count
    FROM batches
    WHERE product_type IN (${ptList})
      AND deleted_at IS NULL
      AND reconciliation_status IN ('verified', 'pending')
  `));
  const endingLiters = parseFloat((endingResult.rows[0] as any).total_liters);
  const endingCount = parseInt((endingResult.rows[0] as any).batch_count, 10);
  const line31Gal = lToGal(endingLiters);
  console.log(
    `Line 31 (Ending bulk):       ${fmtGal(line31Gal)} gal [${matchLabel(line31Gal, config.expectedLine31)} vs ${fmtGal(config.expectedLine31)}]`,
  );
  console.log(`  - ${endingCount} batches, ${fmtL(endingLiters)} L`);

  // ---------------------------------------------------------------
  // Line 29/30: Losses (balancing figure)
  // Losses = Line 12 - Line 13 - Line 16 - Line 24 - Line 31
  // ---------------------------------------------------------------
  const lossesGal = line12Gal - line13Gal - line16Gal - line24Gal - line31Gal;
  console.log(
    `Line 29/30 (Losses = bal.):  ${fmtGal(lossesGal)} gal`,
  );
  console.log(
    `  = ${fmtGal(line12Gal)} - ${fmtGal(line13Gal)} - ${fmtGal(line16Gal)} - ${fmtGal(line24Gal)} - ${fmtGal(line31Gal)}`,
  );

  // ---------------------------------------------------------------
  // Per-batch loss detail
  // ---------------------------------------------------------------
  console.log(`\nPer-batch losses (unaccounted > 0.5L):`);

  const allBatches = await db.execute(sql.raw(`
    SELECT
      b.id,
      b.custom_name,
      b.batch_number,
      b.parent_batch_id,
      CAST(b.initial_volume_liters AS NUMERIC) AS initial_l,
      CAST(b.current_volume_liters AS NUMERIC) AS current_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN (${ptList})
    ORDER BY b.start_date
  `));

  const batchLosses: Array<{
    name: string;
    unaccountedL: number;
    detail: string;
  }> = [];
  let totalPerBatchLossL = 0;

  for (const batch of allBatches.rows as any[]) {
    const bId = batch.id;
    const initial = parseFloat(batch.initial_l || "0");
    const current = parseFloat(batch.current_l || "0");

    // Transfers IN/OUT
    const xfers = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN destination_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) AS xfer_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) AS xfer_out,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(COALESCE(loss, '0') AS NUMERIC) ELSE 0 END), 0) AS xfer_loss
      FROM batch_transfers
      WHERE (source_batch_id = '${bId}' OR destination_batch_id = '${bId}') AND deleted_at IS NULL
    `));

    // Merges IN/OUT (volume_added column)
    const merges = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN target_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) AS merge_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) AS merge_out
      FROM batch_merge_history
      WHERE (target_batch_id = '${bId}' OR source_batch_id = '${bId}')
        AND deleted_at IS NULL
    `));

    // Bottling (voided_at only, NO deleted_at column on bottle_runs)
    const bottling = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CAST(volume_taken_liters AS NUMERIC)), 0) AS vol,
        COALESCE(SUM(CAST(COALESCE(loss, '0') AS NUMERIC)), 0) AS loss
      FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL
    `));

    // Kegging (voided_at AND deleted_at) — handle unit conversion
    const kegging = await db.execute(sql.raw(`
      SELECT volume_taken, volume_taken_unit, loss, loss_unit
      FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL
    `));
    let kegVolL = 0;
    let kegLossL = 0;
    for (const row of kegging.rows as any[]) {
      kegVolL += kegVolToLiters(
        parseFloat(row.volume_taken || "0"),
        row.volume_taken_unit || "L",
      );
      kegLossL += kegLossToLiters(
        parseFloat(row.loss || "0"),
        row.loss_unit || "L",
      );
    }

    // Distillation
    const distill = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) AS vol
      FROM distillation_records WHERE source_batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Adjustments (positive = gain, negative = loss)
    const adj = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) AS vol
      FROM batch_volume_adjustments WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Racking loss
    const rackLoss = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) AS vol
      FROM batch_racking_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Filter loss
    const filterLoss = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) AS vol
      FROM batch_filter_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    const xi = parseFloat((xfers.rows[0] as any).xfer_in);
    const xo = parseFloat((xfers.rows[0] as any).xfer_out);
    const xl = parseFloat((xfers.rows[0] as any).xfer_loss);
    const mi = parseFloat((merges.rows[0] as any).merge_in);
    const mo = parseFloat((merges.rows[0] as any).merge_out);
    const bv = parseFloat((bottling.rows[0] as any).vol);
    const bl = parseFloat((bottling.rows[0] as any).loss);
    const dv = parseFloat((distill.rows[0] as any).vol);
    const av = parseFloat((adj.rows[0] as any).vol);
    const rl = parseFloat((rackLoss.rows[0] as any).vol);
    const fl = parseFloat((filterLoss.rows[0] as any).vol);

    // volume_in = initial + transfers_in + merges_in + positive_adjustments
    // volume_out = transfers_out + transfer_loss + bottling_vol + bottling_loss + keg_vol + keg_loss + distillation + negative_adjustments_abs + rack_loss + filter_loss
    // unaccounted = volume_in - volume_out - current
    const volumeIn = initial + xi + mi + (av > 0 ? av : 0);
    const volumeOut =
      xo + xl + bv + bl + kegVolL + kegLossL + dv + (av < 0 ? Math.abs(av) : 0) + rl + fl;
    const unaccounted = volumeIn - volumeOut - current;

    if (Math.abs(unaccounted) > 0.5) {
      const name = batch.custom_name || batch.batch_number;
      const parts: string[] = [];
      parts.push(`init=${fmtL(initial)}`);
      if (xi > 0) parts.push(`xferIn=${fmtL(xi)}`);
      if (mi > 0) parts.push(`mergeIn=${fmtL(mi)}`);
      if (av > 0) parts.push(`adj+=${fmtL(av)}`);
      if (xo > 0) parts.push(`xferOut=${fmtL(xo)}`);
      if (xl > 0) parts.push(`xferLoss=${fmtL(xl)}`);
      if (bv > 0) parts.push(`bottled=${fmtL(bv)}`);
      if (bl > 0) parts.push(`bottleLoss=${fmtL(bl)}`);
      if (kegVolL > 0) parts.push(`kegged=${fmtL(kegVolL)}`);
      if (kegLossL > 0) parts.push(`kegLoss=${fmtL(kegLossL)}`);
      if (dv > 0) parts.push(`distill=${fmtL(dv)}`);
      if (av < 0) parts.push(`adj-=${fmtL(Math.abs(av))}`);
      if (rl > 0) parts.push(`rackLoss=${fmtL(rl)}`);
      if (fl > 0) parts.push(`filterLoss=${fmtL(fl)}`);
      parts.push(`current=${fmtL(current)}`);

      batchLosses.push({
        name,
        unaccountedL: unaccounted,
        detail: parts.join(", "),
      });
      totalPerBatchLossL += unaccounted;
    }
  }

  // Sort by unaccounted DESC
  batchLosses.sort((a, b) => Math.abs(b.unaccountedL) - Math.abs(a.unaccountedL));

  if (batchLosses.length === 0) {
    console.log("  (none)");
  } else {
    for (const bl of batchLosses) {
      console.log(
        `  ${bl.name}: unaccounted ${fmtL(bl.unaccountedL)} L (${fmtGal(lToGal(bl.unaccountedL))} gal) -- ${bl.detail}`,
      );
    }
  }
  console.log(
    `Total per-batch losses: ${fmtL(totalPerBatchLossL)} L (${fmtGal(lToGal(totalPerBatchLossL))} gal)`,
  );
}

async function main() {
  await verifyTaxClass(WINE_UNDER_16);
  await verifyTaxClass(WINE_16_TO_21);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
