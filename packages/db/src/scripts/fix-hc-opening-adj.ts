import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Create a volume adjustment on "For Distillery" batch to align the HC SBD
 * reconstruction with the configured TTB opening balance of 1,061 gal.
 *
 * Background:
 *   HC SBD ending at Dec 31, 2024 = 1,135.71 gal
 *   Configured TTB opening for HC   = 1,061.00 gal
 *   Delta                           =    74.71 gal = 282.87 L
 *
 * The "For Distillery" batch was retroactively created and its initial volume
 * was an estimate. Adding a negative adjustment dated 2024-12-31 brings the
 * SBD in line with the physical inventory count used for the TTB filing.
 *
 * This does NOT change current_volume_liters — the SBD reconstruction picks
 * up adjustment_amount automatically.
 */

const DISTILLERY_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";
const TARGET_HC_GAL = 1061.0;
const GAL_TO_L = 3.78541;

async function main() {
  console.log("=== Fix HC Opening: Create TTB Reconciliation Adjustment ===\n");

  // 1. Find and display the For Distillery batch
  const batchResult = await db.execute(sql`
    SELECT id, name, custom_name,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           product_type, reconciliation_status, vessel_id
    FROM batches
    WHERE id = ${DISTILLERY_ID} AND deleted_at IS NULL
  `);
  const batch = (batchResult.rows as any[])[0];
  if (!batch) {
    console.log("ERROR: For Distillery batch not found");
    process.exit(1);
  }
  console.log(`Batch: ${batch.custom_name || batch.name} [${DISTILLERY_ID.slice(0, 8)}]`);
  console.log(`  init=${batch.init_vol}L, current=${batch.current_vol}L`);
  console.log(`  product_type=${batch.product_type}, recon_status=${batch.reconciliation_status}`);

  // 2. Compute current HC SBD ending at Dec 31, 2024
  //    Sum initial_volume_liters for all HC batches that were active on or before 2024-12-31
  //    plus all their SBD activity through 2024-12-31
  console.log("\n--- Computing HC SBD at Dec 31, 2024 ---");

  // Get all HC batches active at end of 2024 (created before 2025, not deleted)
  const hcBatches = await db.execute(sql.raw(`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name,
           b.initial_volume_liters::numeric as init_l,
           b.current_volume_liters::numeric as current_l,
           b.parent_batch_id, b.product_type, b.start_date
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'juice')
      AND b.reconciliation_status NOT IN ('excluded', 'duplicate')
      AND b.start_date <= '2024-12-31'
  `));

  let totalSBD = 0;
  const batchDetails: { name: string; sbd: number; id: string }[] = [];

  for (const b of hcBatches.rows as any[]) {
    const batchId = b.id as string;
    const initial = Number(b.init_l);

    // Transfers in (before end of 2024)
    const tIn = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v
      FROM batch_transfers
      WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL
        AND transferred_at <= '2024-12-31T23:59:59Z'
    `));
    // Transfers out
    const tOut = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v,
             COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) as l
      FROM batch_transfers
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND transferred_at <= '2024-12-31T23:59:59Z'
    `));
    // Merges in
    const mIn = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as v
      FROM batch_merge_history
      WHERE target_batch_id = '${batchId}' AND deleted_at IS NULL
        AND merged_at <= '2024-12-31T23:59:59Z'
    `));
    // Merges out
    const mOut = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as v
      FROM batch_merge_history
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND merged_at <= '2024-12-31T23:59:59Z'
    `));
    // Bottling
    const bottleRuns = await db.execute(sql.raw(`
      SELECT volume_taken_liters::numeric as vol,
        CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END as loss_l,
        units_produced, package_size_ml
      FROM bottle_runs
      WHERE batch_id = '${batchId}' AND voided_at IS NULL
        AND packaged_at <= '2024-12-31T23:59:59Z'
    `));
    let bottlingVol = 0;
    let bottlingLoss = 0;
    for (const br of bottleRuns.rows as any[]) {
      const volumeTaken = Number(br.vol);
      const lossVal = Number(br.loss_l);
      const productVol = ((br.units_produced || 0) * (br.package_size_ml || 0)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVol + lossVal)) < 2;
      bottlingVol += volumeTaken;
      if (!lossIncluded) {
        bottlingLoss += lossVal;
      }
    }
    // Keg fills
    const kegs = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END), 0) as v,
             COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) as l
      FROM keg_fills
      WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL
        AND filled_at <= '2024-12-31T23:59:59Z'
    `));
    // Racking losses
    const racks = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as v
      FROM batch_racking_operations
      WHERE batch_id = '${batchId}' AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
        AND racked_at <= '2024-12-31T23:59:59Z'
    `));
    // Filter losses
    const filt = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as v
      FROM batch_filter_operations
      WHERE batch_id = '${batchId}'
        AND filtered_at <= '2024-12-31T23:59:59Z'
    `));
    // Adjustments (existing)
    const adj = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as v
      FROM batch_volume_adjustments
      WHERE batch_id = '${batchId}' AND deleted_at IS NULL
        AND adjustment_date <= '2024-12-31T23:59:59Z'
    `));
    // Distillation
    const dist = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(source_volume_liters::numeric), 0) as v
      FROM distillation_records
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND status IN ('sent', 'received')
        AND sent_at <= '2024-12-31T23:59:59Z'
    `));

    const transfersIn = Number(tIn.rows[0].v);
    const isTransferCreated = b.parent_batch_id && transfersIn >= initial * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : initial;

    const sbd = effectiveInitial
      + Number(mIn.rows[0].v) - Number(mOut.rows[0].v)
      + transfersIn
      - Number(tOut.rows[0].v) - Number(tOut.rows[0].l)
      - bottlingVol - bottlingLoss
      - Number(kegs.rows[0].v) - Number(kegs.rows[0].l)
      - Number(dist.rows[0].v)
      + Number(adj.rows[0].v)
      - Number(racks.rows[0].v) - Number(filt.rows[0].v);

    totalSBD += sbd;
    batchDetails.push({ name: b.name as string, sbd, id: batchId });
  }

  const totalSBDGal = totalSBD / GAL_TO_L;
  console.log(`\nHC SBD at Dec 31, 2024: ${totalSBD.toFixed(2)}L = ${totalSBDGal.toFixed(2)} gal`);
  console.log(`Target TTB opening:     ${(TARGET_HC_GAL * GAL_TO_L).toFixed(2)}L = ${TARGET_HC_GAL.toFixed(2)} gal`);

  const deltaL = totalSBD - TARGET_HC_GAL * GAL_TO_L;
  const deltaGal = deltaL / GAL_TO_L;
  console.log(`Delta (SBD - target):   ${deltaL.toFixed(2)}L = ${deltaGal.toFixed(2)} gal`);

  if (Math.abs(deltaGal) < 0.1) {
    console.log("\nDelta is < 0.1 gal — no adjustment needed. Exiting.");
    process.exit(0);
  }

  // 3. Find admin user for adjusted_by
  const adminResult = await db.execute(sql.raw(`
    SELECT id, name FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1
  `));
  const adminUser = (adminResult.rows as any[])[0];
  if (!adminUser) {
    console.log("ERROR: No admin user found");
    process.exit(1);
  }
  console.log(`\nAdmin user: ${adminUser.name} [${(adminUser.id as string).slice(0, 8)}]`);

  // 4. Compute adjustment values
  // deltaL = SBD - target. If negative, SBD is below target → need positive adj (correction_up).
  // If positive, SBD is above target → need negative adj (correction_down).
  const adjustmentAmountL = -deltaL; // Negate: positive deltaL → negative adj, negative deltaL → positive adj
  const adjustmentType = adjustmentAmountL >= 0 ? "correction_up" : "correction_down";
  const volumeBeforeL = Number(batch.current_vol);
  // Check constraint requires: volume_after - volume_before = adjustment_amount
  // For a retroactive SBD adjustment, set volume_before/after to satisfy the constraint.
  // Use current volume as before, and current + adjustment as after.
  const volumeAfterL = volumeBeforeL + adjustmentAmountL;

  console.log("\n--- Adjustment to create ---");
  console.log(`  batch_id:         ${DISTILLERY_ID}`);
  console.log(`  adjustment_date:  2024-12-31`);
  console.log(`  adjustment_type:  ${adjustmentType}`);
  console.log(`  adjustment_amount: ${adjustmentAmountL.toFixed(3)}L (${(adjustmentAmountL / GAL_TO_L).toFixed(2)} gal)`);
  console.log(`  volume_before:    ${volumeBeforeL.toFixed(3)}L`);
  console.log(`  volume_after:     ${volumeAfterL.toFixed(3)}L`);
  console.log(`  reason:           TTB opening balance reconciliation — align SBD with physical inventory`);
  console.log(`  adjusted_by:      ${adminUser.name}`);
  console.log(`  NOTE: current_volume_liters will NOT be changed`);

  // 5. Check for existing duplicate adjustment
  const existingAdj = await db.execute(sql.raw(`
    SELECT id, CAST(adjustment_amount AS TEXT) as amt, reason
    FROM batch_volume_adjustments
    WHERE batch_id = '${DISTILLERY_ID}'
      AND deleted_at IS NULL
      AND reason LIKE '%TTB opening balance reconciliation%'
  `));
  if ((existingAdj.rows as any[]).length > 0) {
    console.log("\nWARNING: A TTB opening balance reconciliation adjustment already exists:");
    for (const ea of existingAdj.rows as any[]) {
      console.log(`  ${ea.amt}L — "${ea.reason}" [${ea.id}]`);
    }
    console.log("Skipping to avoid duplicate. Delete the existing one first if you want to recreate.");
    process.exit(0);
  }

  // 6. Create the adjustment
  console.log("\nCreating adjustment...");
  const insertResult = await db.execute(sql.raw(`
    INSERT INTO batch_volume_adjustments (
      batch_id, vessel_id,
      adjustment_date, adjustment_type,
      volume_before, volume_after, adjustment_amount,
      reason, notes, adjusted_by
    ) VALUES (
      '${DISTILLERY_ID}',
      ${batch.vessel_id ? `'${batch.vessel_id}'` : "NULL"},
      '2024-12-31T23:59:59Z',
      '${adjustmentType}',
      '${volumeBeforeL.toFixed(3)}',
      '${volumeAfterL.toFixed(3)}',
      '${adjustmentAmountL.toFixed(3)}',
      'TTB opening balance reconciliation — align SBD with physical inventory',
      'HC SBD at Dec 31 2024 = ${totalSBDGal.toFixed(2)} gal, configured opening = ${TARGET_HC_GAL} gal, delta = ${deltaGal.toFixed(2)} gal. Retroactive adjustment to align system reconstruction with physical inventory count used for TTB filing. Does not change current_volume_liters.',
      '${adminUser.id}'
    )
    RETURNING id, CAST(adjustment_amount AS TEXT) as amt
  `));
  const newAdj = (insertResult.rows as any[])[0];
  console.log(`Created: ${newAdj.amt}L [${newAdj.id}]`);

  // 7. Verify: recompute HC SBD at Dec 31, 2024 with the new adjustment
  console.log("\n--- Verification: recomputing HC SBD at Dec 31, 2024 ---");

  let verifyTotal = 0;
  for (const b of hcBatches.rows as any[]) {
    const batchId = b.id as string;
    const initial = Number(b.init_l);

    const tIn = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v
      FROM batch_transfers
      WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL
        AND transferred_at <= '2024-12-31T23:59:59Z'
    `));
    const tOut = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v,
             COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) as l
      FROM batch_transfers
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND transferred_at <= '2024-12-31T23:59:59Z'
    `));
    const mIn = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as v
      FROM batch_merge_history
      WHERE target_batch_id = '${batchId}' AND deleted_at IS NULL
        AND merged_at <= '2024-12-31T23:59:59Z'
    `));
    const mOut = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as v
      FROM batch_merge_history
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND merged_at <= '2024-12-31T23:59:59Z'
    `));
    const bottleRuns = await db.execute(sql.raw(`
      SELECT volume_taken_liters::numeric as vol,
        CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END as loss_l,
        units_produced, package_size_ml
      FROM bottle_runs
      WHERE batch_id = '${batchId}' AND voided_at IS NULL
        AND packaged_at <= '2024-12-31T23:59:59Z'
    `));
    let bottlingVol = 0;
    let bottlingLoss = 0;
    for (const br of bottleRuns.rows as any[]) {
      const volumeTaken = Number(br.vol);
      const lossVal = Number(br.loss_l);
      const productVol = ((br.units_produced || 0) * (br.package_size_ml || 0)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVol + lossVal)) < 2;
      bottlingVol += volumeTaken;
      if (!lossIncluded) {
        bottlingLoss += lossVal;
      }
    }
    const kegs = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END), 0) as v,
             COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) as l
      FROM keg_fills
      WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL
        AND filled_at <= '2024-12-31T23:59:59Z'
    `));
    const racks = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as v
      FROM batch_racking_operations
      WHERE batch_id = '${batchId}' AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
        AND racked_at <= '2024-12-31T23:59:59Z'
    `));
    const filt = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as v
      FROM batch_filter_operations
      WHERE batch_id = '${batchId}'
        AND filtered_at <= '2024-12-31T23:59:59Z'
    `));
    const adj = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as v
      FROM batch_volume_adjustments
      WHERE batch_id = '${batchId}' AND deleted_at IS NULL
        AND adjustment_date <= '2024-12-31T23:59:59Z'
    `));
    const dist = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(source_volume_liters::numeric), 0) as v
      FROM distillation_records
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND status IN ('sent', 'received')
        AND sent_at <= '2024-12-31T23:59:59Z'
    `));

    const transfersIn = Number(tIn.rows[0].v);
    const isTransferCreated = b.parent_batch_id && transfersIn >= initial * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : initial;

    const sbd = effectiveInitial
      + Number(mIn.rows[0].v) - Number(mOut.rows[0].v)
      + transfersIn
      - Number(tOut.rows[0].v) - Number(tOut.rows[0].l)
      - bottlingVol - bottlingLoss
      - Number(kegs.rows[0].v) - Number(kegs.rows[0].l)
      - Number(dist.rows[0].v)
      + Number(adj.rows[0].v)
      - Number(racks.rows[0].v) - Number(filt.rows[0].v);

    verifyTotal += sbd;
  }

  const verifyGal = verifyTotal / GAL_TO_L;
  const residual = verifyGal - TARGET_HC_GAL;
  console.log(`HC SBD after adjustment: ${verifyTotal.toFixed(2)}L = ${verifyGal.toFixed(2)} gal`);
  console.log(`Target:                  ${(TARGET_HC_GAL * GAL_TO_L).toFixed(2)}L = ${TARGET_HC_GAL.toFixed(2)} gal`);
  console.log(`Residual:                ${(residual * GAL_TO_L).toFixed(2)}L = ${residual.toFixed(2)} gal`);

  if (Math.abs(residual) < 0.1) {
    console.log("\nSUCCESS: HC SBD now matches configured TTB opening balance.");
  } else {
    console.log(`\nWARNING: Residual is ${residual.toFixed(2)} gal — may need fine-tuning.`);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
