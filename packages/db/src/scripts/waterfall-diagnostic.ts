import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;
const LGAL = 3.78541;

async function main() {
  // Get ALL non-deleted non-juice batches
  const batches = await db.execute(
    sql.raw(`
    SELECT b.id, CAST(b.initial_volume_liters AS NUMERIC) as initial_l,
           CAST(b.current_volume_liters AS NUMERIC) as current_l,
           b.parent_batch_id, b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL AND COALESCE(b.product_type, 'cider') != 'juice'
    ORDER BY b.start_date
  `)
  );

  let sbdTotal = 0;
  let sbdTotalRaw = 0;
  let eligibleCurrentTotal = 0;
  let allCurrentTotal = 0;
  let totalEffInitial = 0;
  let totalMergesIn = 0;
  let totalMergesOut = 0;
  let totalTransfersIn = 0;
  let totalTransfersOut = 0;
  let totalTransferLoss = 0;
  let totalBottling = 0;
  let totalKegging = 0;
  let totalKegLoss = 0;
  let totalDistill = 0;
  let totalAdj = 0;
  let totalRack = 0;
  let totalFilter = 0;
  let totalClamped = 0;

  for (const batch of batches.rows as any[]) {
    const bId = batch.id;
    const initial = parseFloat(batch.initial_l || "0");
    const currentVol = parseFloat(batch.current_l || "0");
    const reconStatus = batch.reconciliation_status || "pending";

    allCurrentTotal += currentVol;
    if (reconStatus !== "duplicate" && reconStatus !== "excluded") {
      eligibleCurrentTotal += currentVol;
    }

    const xfers = await db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN destination_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xin,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xout,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(COALESCE(loss,'0') AS NUMERIC) ELSE 0 END), 0) as xloss
      FROM batch_transfers WHERE (source_batch_id = '${bId}' OR destination_batch_id = '${bId}') AND deleted_at IS NULL
    `)
    );
    const merges = await db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN target_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as min,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as mout
      FROM batch_merge_history WHERE (target_batch_id = '${bId}' OR source_batch_id = '${bId}') AND deleted_at IS NULL
    `)
    );

    const xi = parseFloat((xfers.rows[0] as any).xin);
    const xo = parseFloat((xfers.rows[0] as any).xout);
    const xl = parseFloat((xfers.rows[0] as any).xloss);
    const mi = parseFloat((merges.rows[0] as any).min);
    const mo = parseFloat((merges.rows[0] as any).mout);

    // Transfer-created detection
    const isTC =
      batch.parent_batch_id && xi >= initial * 0.9 && initial > 0;
    const effInit = isTC ? 0 : initial;

    const outflows = await db.execute(
      sql.raw(`
      SELECT
        (SELECT COALESCE(SUM(CAST(volume_taken_liters AS NUMERIC)), 0)
         FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL) as bottle_vol,
        (SELECT COALESCE(SUM(CASE WHEN volume_taken_unit='gal' THEN volume_taken::numeric*${LGAL} ELSE volume_taken::numeric END), 0)
         FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL) as keg_vol,
        (SELECT COALESCE(SUM(CASE WHEN loss_unit='gal' THEN COALESCE(loss::numeric,0)*${LGAL} ELSE COALESCE(loss::numeric,0) END), 0)
         FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL) as keg_loss,
        (SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0)
         FROM distillation_records WHERE source_batch_id = '${bId}' AND deleted_at IS NULL AND status IN ('sent','received')) as distill,
        (SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0)
         FROM batch_volume_adjustments WHERE batch_id = '${bId}' AND deleted_at IS NULL) as adj,
        (SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0)
         FROM batch_racking_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL
           AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')) as rack,
        (SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0)
         FROM batch_filter_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL) as filter_l
    `)
    );
    const o = outflows.rows[0] as any;
    const bv = parseFloat(o.bottle_vol);
    const kv = parseFloat(o.keg_vol);
    const kl = parseFloat(o.keg_loss);
    const dv = parseFloat(o.distill);
    const av = parseFloat(o.adj);
    const rl = parseFloat(o.rack);
    const fl = parseFloat(o.filter_l);

    const raw =
      effInit + mi - mo + xi - xo - xl - bv - kv - kl - dv + av - rl - fl;
    const clamped = Math.max(0, raw);
    if (raw < 0) totalClamped += Math.abs(raw);

    sbdTotalRaw += raw;
    sbdTotal += clamped;
    totalEffInitial += effInit;
    totalMergesIn += mi;
    totalMergesOut += mo;
    totalTransfersIn += xi;
    totalTransfersOut += xo;
    totalTransferLoss += xl;
    totalBottling += bv;
    totalKegging += kv;
    totalKegLoss += kl;
    totalDistill += dv;
    totalAdj += av;
    totalRack += rl;
    totalFilter += fl;
  }

  console.log("=== SBD COMPONENT TOTALS (all batches, all time) ===");
  console.log(`Effective initials: ${(totalEffInitial * GAL).toFixed(1)} gal`);
  console.log(`+ MergesIn:         ${(totalMergesIn * GAL).toFixed(1)} gal`);
  console.log(`- MergesOut:        ${(totalMergesOut * GAL).toFixed(1)} gal`);
  console.log(`+ TransfersIn:      ${(totalTransfersIn * GAL).toFixed(1)} gal`);
  console.log(`- TransfersOut:     ${(totalTransfersOut * GAL).toFixed(1)} gal`);
  console.log(`- TransferLoss:     ${(totalTransferLoss * GAL).toFixed(1)} gal`);
  console.log(`- Bottling:         ${(totalBottling * GAL).toFixed(1)} gal`);
  console.log(`- Kegging:          ${(totalKegging * GAL).toFixed(1)} gal`);
  console.log(`- KegLoss:          ${(totalKegLoss * GAL).toFixed(1)} gal`);
  console.log(`- Distillation:     ${(totalDistill * GAL).toFixed(1)} gal`);
  console.log(`+ Adjustments(net): ${(totalAdj * GAL).toFixed(1)} gal`);
  console.log(`- RackingLoss:      ${(totalRack * GAL).toFixed(1)} gal`);
  console.log(`- FilterLoss:       ${(totalFilter * GAL).toFixed(1)} gal`);
  console.log(`Clamped (neg→0):    ${(totalClamped * GAL).toFixed(1)} gal`);
  console.log();
  console.log(`SBD raw total:      ${(sbdTotalRaw * GAL).toFixed(1)} gal`);
  console.log(`SBD clamped total:  ${(sbdTotal * GAL).toFixed(1)} gal`);
  console.log(`Eligible currentVol:${(eligibleCurrentTotal * GAL).toFixed(1)} gal`);
  console.log(`All currentVol:     ${(allCurrentTotal * GAL).toFixed(1)} gal`);
  console.log();
  console.log(
    `SBD clamped - eligible current: ${((sbdTotal - eligibleCurrentTotal) * GAL).toFixed(1)} gal`
  );
  console.log(
    `SBD clamped - all current:      ${((sbdTotal - allCurrentTotal) * GAL).toFixed(1)} gal`
  );

  // Compare SBD "gross inflows" vs aggregate production
  const grossInflows = totalEffInitial + totalMergesIn + totalTransfersIn;
  console.log();
  console.log(
    `SBD gross inflows (effInit+mergesIn+xfersIn): ${(grossInflows * GAL).toFixed(1)} gal`
  );
  console.log(`Aggregate production (press+juice-juiceOnly):  ~5088 gal`);
  console.log(
    `Difference: ${((grossInflows * GAL) - 5088).toFixed(1)} gal`
  );

  // Check merges net (should be ~0 for internal transfers)
  console.log();
  console.log(
    `MergesIn - MergesOut: ${((totalMergesIn - totalMergesOut) * GAL).toFixed(1)} gal (net new volume from merges)`
  );
  console.log(
    `XfersIn - XfersOut: ${((totalTransfersIn - totalTransfersOut) * GAL).toFixed(1)} gal (net new volume from transfers)`
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
