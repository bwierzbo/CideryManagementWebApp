import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Find batches whose SBD reconstruction goes negative (clamped to 0).
 * These represent data quality issues that need to be fixed at the root cause.
 */
async function main() {
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           CAST(b.initial_volume_liters AS NUMERIC) as initial_l,
           CAST(b.current_volume_liters AS NUMERIC) as current_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.product_type, 'cider') NOT IN ('brandy', 'juice')
      AND b.is_racking_derivative IS NOT TRUE
      AND NOT (b.parent_batch_id IS NOT NULL AND CAST(COALESCE(b.initial_volume_liters, '1') AS DECIMAL) = 0 AND COALESCE(b.product_type, 'cider') != 'pommeau')
      AND COALESCE(b.reconciliation_status, 'pending') IN ('verified', 'pending')
    ORDER BY b.start_date
  `));

  let totalClamped = 0;

  for (const batch of batches.rows as any[]) {
    const bId = batch.id;
    const initial = parseFloat(batch.initial_l || "0");

    // Transfers
    const xfers = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN destination_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_out,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(COALESCE(loss, '0') AS NUMERIC) ELSE 0 END), 0) as xfer_loss
      FROM batch_transfers
      WHERE (source_batch_id = '${bId}' OR destination_batch_id = '${bId}') AND deleted_at IS NULL
    `));

    // Merges (target_batch_id = destination, source_batch_id for batch-to-batch merges)
    const merges = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(CASE WHEN target_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_in,
        COALESCE(SUM(CASE WHEN source_batch_id = '${bId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_out
      FROM batch_merge_history
      WHERE target_batch_id = '${bId}' OR source_batch_id = '${bId}'
    `));

    // Bottling (voided_at only, no deleted_at)
    const bottling = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_taken_liters AS NUMERIC)), 0) as vol,
             COALESCE(SUM(CAST(COALESCE(loss, '0') AS NUMERIC)), 0) as loss
      FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL
    `));

    // Kegging (voided_at AND deleted_at)
    const kegging = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_taken AS NUMERIC)), 0) as vol,
             COALESCE(SUM(CAST(COALESCE(loss, '0') AS NUMERIC)), 0) as loss
      FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL
    `));

    // Distillation (source_batch_id, source_volume_liters)
    const distill = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as vol
      FROM distillation_records WHERE source_batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Adjustments
    const adj = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as vol
      FROM batch_volume_adjustments WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Racking loss
    const rackLoss = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
      FROM batch_racking_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    // Filter loss
    const filterLoss = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
      FROM batch_filter_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL
    `));

    const xi = parseFloat((xfers.rows[0] as any).xfer_in);
    const xo = parseFloat((xfers.rows[0] as any).xfer_out);
    const xl = parseFloat((xfers.rows[0] as any).xfer_loss);
    const mi = parseFloat((merges.rows[0] as any).merge_in);
    const mo = parseFloat((merges.rows[0] as any).merge_out);
    const bv = parseFloat((bottling.rows[0] as any).vol);
    const bl = parseFloat((bottling.rows[0] as any).loss);
    const kv = parseFloat((kegging.rows[0] as any).vol);
    const kl = parseFloat((kegging.rows[0] as any).loss);
    const dv = parseFloat((distill.rows[0] as any).vol);
    const av = parseFloat((adj.rows[0] as any).vol);
    const rl = parseFloat((rackLoss.rows[0] as any).vol);
    const fl = parseFloat((filterLoss.rows[0] as any).vol);

    // Transfer-created heuristic (matches computeSystemCalculatedOnHand)
    const isTC = batch.parent_batch_id && xi >= initial * 0.9 && initial > 0;
    const effInit = isTC ? 0 : initial;

    const raw = effInit + mi - mo + xi - xo - xl - bv - bl - kv - kl - dv + av - rl - fl;

    if (raw < -0.5) {
      totalClamped += Math.abs(raw);
      console.log(`\nCLAMPED: ${batch.custom_name || batch.batch_number}`);
      console.log(`  Raw ending: ${raw.toFixed(1)}L = ${(raw * 0.2642).toFixed(1)} gal`);
      console.log(`  DB current: ${parseFloat(batch.current_l || "0").toFixed(1)}L`);
      console.log(`  Initial: ${initial.toFixed(1)}L (effective: ${effInit.toFixed(1)}, transferCreated: ${!!isTC})`);
      console.log(`  +MergesIn:    ${mi.toFixed(1)}L`);
      console.log(`  -MergesOut:   ${mo.toFixed(1)}L`);
      console.log(`  +XferIn:      ${xi.toFixed(1)}L`);
      console.log(`  -XferOut:     ${xo.toFixed(1)}L`);
      console.log(`  -XferLoss:    ${xl.toFixed(1)}L`);
      console.log(`  -Bottling:    ${bv.toFixed(1)}L (loss: ${bl.toFixed(1)})`);
      console.log(`  -Kegging:     ${kv.toFixed(1)}L (loss: ${kl.toFixed(1)})`);
      console.log(`  -Distillation:${dv.toFixed(1)}L`);
      console.log(`  +Adjustments: ${av.toFixed(1)}L`);
      console.log(`  -RackLoss:    ${rl.toFixed(1)}L`);
      console.log(`  -FilterLoss:  ${fl.toFixed(1)}L`);
    }
  }

  console.log(`\nTotal clamped: ${totalClamped.toFixed(1)}L = ${(totalClamped * 0.2642).toFixed(1)} gal`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
