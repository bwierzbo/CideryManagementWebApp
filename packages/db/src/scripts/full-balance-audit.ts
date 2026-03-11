import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Full per-batch balance audit — shows ALL batches with ANY gap (threshold: 0.1L).
 * For each batch: reconstructed ending vs currentVolumeLiters.
 * Includes smart bottling loss detection matching computeSystemCalculatedOnHand.
 */

const GAL = 0.264172;
const LGAL = 3.78541;

function toL(val: string | null | undefined): number {
  return parseFloat(val || "0");
}

interface BottleRunRow {
  volume_taken_liters: string;
  loss: string | null;
  loss_unit: string | null;
  units_produced: string | null;
  package_size_ml: string | null;
}

async function main() {
  const batches = await db.execute(
    sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           b.product_type, b.reconciliation_status, b.is_racking_derivative,
           CAST(b.initial_volume_liters AS NUMERIC) as initial_l,
           CAST(b.current_volume_liters AS NUMERIC) as current_l,
           b.start_date::text as start_date
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.product_type, 'cider') != 'juice'
    ORDER BY b.start_date, b.batch_number
  `)
  );

  const rows = batches.rows as any[];
  console.log(`Auditing ${rows.length} batches (threshold: 0.1L / 0.03 gal)...\n`);

  const results: Array<{
    name: string;
    id: string;
    status: string;
    productType: string;
    gapL: number;
    gapGal: number;
    currentL: number;
    reconstructedL: number;
    components: Record<string, number>;
  }> = [];

  for (const batch of rows) {
    const bId = batch.id;
    const initial = toL(batch.initial_l);
    const currentVol = toL(batch.current_l);

    const xfers = await db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN destination_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_out,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(COALESCE(loss, '0') AS NUMERIC) ELSE 0 END), 0) as xfer_loss
      FROM batch_transfers
      WHERE (source_batch_id = '${bId}' OR destination_batch_id = '${bId}') AND deleted_at IS NULL
    `)
    );

    const merges = await db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN target_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_out
      FROM batch_merge_history
      WHERE (target_batch_id = '${bId}' OR source_batch_id = '${bId}') AND deleted_at IS NULL
    `)
    );

    // Smart bottling loss detection
    const bottleRows = await db.execute(
      sql.raw(`
      SELECT CAST(volume_taken_liters AS NUMERIC) as volume_taken_liters,
             loss::text as loss, loss_unit,
             units_produced::text as units_produced,
             package_size_ml::text as package_size_ml
      FROM bottle_runs
      WHERE batch_id = '${bId}' AND voided_at IS NULL
    `)
    );
    let bottlingVol = 0;
    let bottlingLoss = 0;
    for (const br of bottleRows.rows as unknown as BottleRunRow[]) {
      const volTaken = toL(br.volume_taken_liters);
      const rawLoss = toL(br.loss);
      const lossInLiters =
        br.loss_unit === "gal" ? rawLoss * LGAL : rawLoss;
      const unitsProduced = toL(br.units_produced);
      const pkgSizeMl = toL(br.package_size_ml);
      const productVol = (unitsProduced * pkgSizeMl) / 1000;
      const lossIncluded =
        Math.abs(volTaken - (productVol + lossInLiters)) < 2;
      bottlingVol += volTaken;
      if (!lossIncluded) bottlingLoss += lossInLiters;
    }

    const kegging = await db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN CAST(volume_taken AS NUMERIC) * ${LGAL} ELSE CAST(volume_taken AS NUMERIC) END), 0) as vol,
        COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN CAST(COALESCE(loss, '0') AS NUMERIC) * ${LGAL} ELSE CAST(COALESCE(loss, '0') AS NUMERIC) END), 0) as loss
      FROM keg_fills
      WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL
    `)
    );

    const distill = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as vol
      FROM distillation_records
      WHERE source_batch_id = '${bId}' AND deleted_at IS NULL AND status IN ('sent', 'received')
    `)
    );

    const adj = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as vol
      FROM batch_volume_adjustments
      WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `)
    );

    const rackLoss = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
      FROM batch_racking_operations
      WHERE batch_id = '${bId}' AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
    `)
    );

    const filterLoss = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
      FROM batch_filter_operations
      WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `)
    );

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

    const isTC =
      batch.parent_batch_id && xi >= initial * 0.9 && initial > 0;
    const effInit = isTC ? 0 : initial;

    const reconstructed =
      effInit + mi - mo + xi - xo - xl - bottlingVol - bottlingLoss - kv - kl - dv + av - rl - fl;

    const gap = reconstructed - currentVol;

    if (Math.abs(gap) > 0.1) {
      const name =
        batch.custom_name || batch.batch_number || bId.slice(0, 8);
      results.push({
        name,
        id: bId,
        status: batch.reconciliation_status || "pending",
        productType: batch.product_type || "cider",
        gapL: gap,
        gapGal: gap * GAL,
        currentL: currentVol,
        reconstructedL: reconstructed,
        components: {
          initial,
          effInit,
          mergesIn: mi,
          mergesOut: mo,
          xfersIn: xi,
          xfersOut: xo,
          xferLoss: xl,
          bottlingVol,
          bottlingLoss,
          keggingVol: kv,
          keggingLoss: kl,
          distillation: dv,
          adjustments: av,
          rackingLoss: rl,
          filterLoss: fl,
        },
      });
    }
  }

  // Sort by absolute gap descending
  results.sort((a, b) => Math.abs(b.gapL) - Math.abs(a.gapL));

  console.log("=".repeat(90));
  console.log("ALL BATCHES WITH BALANCE GAPS (threshold: 0.1L)");
  console.log("Positive gap = reconstructed > current (unrecorded outflow)");
  console.log("Negative gap = reconstructed < current (unrecorded inflow)");
  console.log("=".repeat(90));

  let totalGap = 0;
  let totalPositive = 0;
  let totalNegative = 0;

  for (const r of results) {
    const sign = r.gapL > 0 ? "+" : "";
    totalGap += r.gapL;
    if (r.gapL > 0) totalPositive += r.gapL;
    else totalNegative += r.gapL;

    console.log(
      `\n${r.name} [${r.status}] (${r.productType})  GAP: ${sign}${r.gapGal.toFixed(2)} gal (${sign}${r.gapL.toFixed(1)}L)`
    );
    const c = r.components;
    console.log(`  ID: ${r.id}`);
    const isTC = c.effInit !== c.initial;
    console.log(
      `  Initial:       ${(c.initial * GAL).toFixed(1)} gal (${c.initial.toFixed(1)}L)${isTC ? " → eff 0 (transfer-created)" : ""}`
    );
    if (c.mergesIn > 0)
      console.log(
        `  +MergesIn:     ${(c.mergesIn * GAL).toFixed(1)} gal (${c.mergesIn.toFixed(1)}L)`
      );
    if (c.mergesOut > 0)
      console.log(
        `  -MergesOut:    ${(c.mergesOut * GAL).toFixed(1)} gal (${c.mergesOut.toFixed(1)}L)`
      );
    if (c.xfersIn > 0)
      console.log(
        `  +XfersIn:      ${(c.xfersIn * GAL).toFixed(1)} gal (${c.xfersIn.toFixed(1)}L)`
      );
    if (c.xfersOut > 0)
      console.log(
        `  -XfersOut:     ${(c.xfersOut * GAL).toFixed(1)} gal (${c.xfersOut.toFixed(1)}L)`
      );
    if (c.xferLoss > 0)
      console.log(
        `  -XferLoss:     ${(c.xferLoss * GAL).toFixed(1)} gal (${c.xferLoss.toFixed(1)}L)`
      );
    if (c.bottlingVol > 0)
      console.log(
        `  -Bottling:     ${(c.bottlingVol * GAL).toFixed(1)} gal (${c.bottlingVol.toFixed(1)}L) (loss: ${(c.bottlingLoss * GAL).toFixed(1)})`
      );
    if (c.keggingVol > 0)
      console.log(
        `  -Kegging:      ${(c.keggingVol * GAL).toFixed(1)} gal (${c.keggingVol.toFixed(1)}L) (loss: ${(c.keggingLoss * GAL).toFixed(1)})`
      );
    if (c.distillation > 0)
      console.log(
        `  -Distillation: ${(c.distillation * GAL).toFixed(1)} gal (${c.distillation.toFixed(1)}L)`
      );
    if (c.adjustments !== 0)
      console.log(
        `  +Adjustments:  ${(c.adjustments * GAL).toFixed(1)} gal (${c.adjustments.toFixed(1)}L)`
      );
    if (c.rackingLoss > 0)
      console.log(
        `  -RackingLoss:  ${(c.rackingLoss * GAL).toFixed(1)} gal (${c.rackingLoss.toFixed(1)}L)`
      );
    if (c.filterLoss > 0)
      console.log(
        `  -FilterLoss:   ${(c.filterLoss * GAL).toFixed(1)} gal (${c.filterLoss.toFixed(1)}L)`
      );
    console.log(
      `  = Reconstructed: ${(r.reconstructedL * GAL).toFixed(2)} gal (${r.reconstructedL.toFixed(1)}L)`
    );
    console.log(
      `  DB current:      ${(r.currentL * GAL).toFixed(2)} gal (${r.currentL.toFixed(1)}L)`
    );
  }

  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));
  console.log(`Total batches:      ${rows.length}`);
  console.log(`Batches with gap:   ${results.length}`);
  console.log(
    `Net gap:            ${(totalGap * GAL).toFixed(2)} gal (${totalGap.toFixed(1)}L)`
  );
  console.log(
    `Positive gaps:      +${(totalPositive * GAL).toFixed(2)} gal (unrecorded outflows)`
  );
  console.log(
    `Negative gaps:      ${(totalNegative * GAL).toFixed(2)} gal (unrecorded inflows)`
  );
  console.log("=".repeat(90));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
