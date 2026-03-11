import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Fix For Distillery batch for 2024 ending = 1121 gal:
 * 1. Add a -5 gal (18.927L) loss adjustment dated 2024-12-31
 * 2. Reduce the distillation source_volume_liters by the same amount
 *    so the volume trace stays clean (total in = total out, no discrepancy)
 */

const DISTILLERY_BATCH_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";
const TARGET_ENDING_GAL = 1121;
const GAL_TO_L = 3.78541;

async function main() {
  console.log("=== Fix For Distillery: 5 gal loss + distillation adjustment ===\n");

  // 1. Compute current SBD ending for this batch at 2024-12-31 (no existing adjustment)
  const batch = await db.execute(sql`
    SELECT id, COALESCE(custom_name, name) as name,
           initial_volume_liters::numeric as init_l,
           current_volume_liters::numeric as cur_l,
           vessel_id, product_type
    FROM batches WHERE id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL
  `);
  const b = batch.rows[0] as any;
  if (!b) { console.log("ERROR: Batch not found"); process.exit(1); }
  console.log(`Batch: ${b.name} (${b.product_type})`);
  console.log(`  init=${Number(b.init_l).toFixed(1)}L, current=${Number(b.cur_l).toFixed(1)}L`);

  // Check no existing TTB reconciliation adjustment
  const existingAdj = await db.execute(sql`
    SELECT id, adjustment_amount::numeric as amt FROM batch_volume_adjustments
    WHERE batch_id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL
      AND reason LIKE '%TTB opening balance reconciliation%'
  `);
  if (existingAdj.rows.length > 0) {
    console.log("\nERROR: Existing TTB reconciliation adjustment found. Delete it first.");
    for (const r of existingAdj.rows as any[]) {
      console.log(`  ${Number(r.amt).toFixed(3)}L [${r.id}]`);
    }
    process.exit(1);
  }

  // 2. Compute SBD ending at 2024-12-31 for ALL non-dup/excluded batches
  const allBatches = await db.execute(sql`
    SELECT id, initial_volume_liters::numeric as init_l, parent_batch_id,
           COALESCE(reconciliation_status, 'pending') as recon_status
    FROM batches
    WHERE deleted_at IS NULL
      AND start_date <= '2024-12-31'::date
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
           OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
  `);

  let totalEndingL = 0;
  let distilleryEndingL = 0;
  for (const row of allBatches.rows as any[]) {
    const bId = row.id as string;
    const initial = Number(row.init_l);
    const reconStatus = row.recon_status as string;

    // Compute per-batch SBD ending at 2024-12-31
    const tIn = await db.execute(sql`SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v FROM batch_transfers WHERE destination_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at <= '2024-12-31T23:59:59Z'`);
    const tOut = await db.execute(sql`SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v, COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) as l FROM batch_transfers WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at <= '2024-12-31T23:59:59Z'`);
    const mIn = await db.execute(sql`SELECT COALESCE(SUM(volume_added::numeric), 0) as v FROM batch_merge_history WHERE target_batch_id = ${bId} AND deleted_at IS NULL AND merged_at <= '2024-12-31T23:59:59Z'`);
    const mOut = await db.execute(sql`SELECT COALESCE(SUM(volume_added::numeric), 0) as v FROM batch_merge_history WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND merged_at <= '2024-12-31T23:59:59Z'`);
    const adj = await db.execute(sql`SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as v FROM batch_volume_adjustments WHERE batch_id = ${bId} AND deleted_at IS NULL AND adjustment_date <= '2024-12-31T23:59:59Z'`);

    const ending = initial + Number(mIn.rows[0].v) - Number(mOut.rows[0].v)
      + Number(tIn.rows[0].v) - Number(tOut.rows[0].v) - Number(tOut.rows[0].l)
      + Number(adj.rows[0].v);

    // Only count non-dup/excluded in the total (same as waterfall filter)
    if (reconStatus !== 'duplicate' && reconStatus !== 'excluded') {
      totalEndingL += ending;
    }
    if (bId === DISTILLERY_BATCH_ID) {
      distilleryEndingL = ending;
    }
  }

  const totalEndingGal = totalEndingL / GAL_TO_L;
  const deltaGal = totalEndingGal - TARGET_ENDING_GAL;
  const deltaL = deltaGal * GAL_TO_L;

  console.log(`\nCurrent 2024 ending (filtered): ${totalEndingL.toFixed(1)}L = ${totalEndingGal.toFixed(2)} gal`);
  console.log(`Target: ${TARGET_ENDING_GAL} gal`);
  console.log(`Delta: ${deltaGal.toFixed(2)} gal = ${deltaL.toFixed(1)}L`);
  console.log(`For Distillery ending: ${distilleryEndingL.toFixed(1)}L = ${(distilleryEndingL / GAL_TO_L).toFixed(2)} gal`);

  if (Math.abs(deltaGal) < 0.1) {
    console.log("\nAlready at target. Nothing to do.");
    process.exit(0);
  }

  // 3. Find distillation record
  const distRecord = await db.execute(sql`
    SELECT id, source_volume_liters::numeric as vol_l, source_volume::numeric as vol,
           source_volume_unit, sent_at, status
    FROM distillation_records
    WHERE source_batch_id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL
      AND status IN ('sent', 'received')
    ORDER BY sent_at
  `);
  if (distRecord.rows.length === 0) {
    console.log("\nERROR: No distillation record found");
    process.exit(1);
  }
  const dist = distRecord.rows[0] as any;
  const oldDistL = Number(dist.vol_l);
  const newDistL = oldDistL - deltaL;
  console.log(`\nDistillation record [${dist.id}]:`);
  console.log(`  source_volume_liters: ${oldDistL.toFixed(1)}L → ${newDistL.toFixed(1)}L`);
  console.log(`  source_volume: ${Number(dist.vol).toFixed(1)} ${dist.source_volume_unit}`);
  console.log(`  sent_at: ${dist.sent_at}`);

  // 4. Find admin user
  const admin = await db.execute(sql`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1`);
  const adminId = (admin.rows[0] as any).id;

  // 5. Create the loss adjustment
  // Use SBD-reconstructed volume at 2024-12-31 (not live currentVolumeLiters which is 0.0)
  const adjAmountL = -deltaL; // negative = loss
  const volBefore = distilleryEndingL;
  const volAfter = volBefore + adjAmountL;

  console.log(`\n--- Creating adjustment ---`);
  console.log(`  amount: ${adjAmountL.toFixed(3)}L (${(adjAmountL / GAL_TO_L).toFixed(2)} gal)`);

  await db.execute(sql`
    INSERT INTO batch_volume_adjustments (
      batch_id, vessel_id, adjustment_date, adjustment_type,
      volume_before, volume_after, adjustment_amount,
      reason, notes, adjusted_by
    ) VALUES (
      ${DISTILLERY_BATCH_ID}, ${b.vessel_id},
      '2024-12-31T23:59:59Z',
      'correction_down',
      ${volBefore.toFixed(3)},
      ${volAfter.toFixed(3)},
      ${adjAmountL.toFixed(3)},
      'TTB opening balance reconciliation — align SBD with physical inventory',
      ${'2024 SBD ending was ' + totalEndingGal.toFixed(2) + ' gal, configured opening = ' + TARGET_ENDING_GAL + ' gal, delta = ' + deltaGal.toFixed(2) + ' gal. Paired with distillation reduction to keep volume trace clean.'},
      ${adminId}
    )
  `);
  console.log("  Created.");

  // 6. Reduce distillation source_volume_liters
  console.log(`\n--- Updating distillation ---`);
  console.log(`  source_volume_liters: ${oldDistL.toFixed(3)} → ${newDistL.toFixed(3)}`);

  // Also update source_volume if it's in liters
  const newDistVol = dist.source_volume_unit === 'L' ? newDistL : newDistL / GAL_TO_L;
  await db.execute(sql`
    UPDATE distillation_records
    SET source_volume_liters = ${newDistL.toFixed(3)},
        source_volume = ${newDistVol.toFixed(3)}
    WHERE id = ${dist.id}
  `);
  console.log("  Updated.");

  // 7. Verify
  console.log("\n--- Verification ---");
  // Re-check the For Distillery volume trace
  const verifyAdj = await db.execute(sql`
    SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as v
    FROM batch_volume_adjustments
    WHERE batch_id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL
  `);
  const verifyDist = await db.execute(sql`
    SELECT COALESCE(SUM(source_volume_liters::numeric), 0) as v
    FROM distillation_records
    WHERE source_batch_id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL AND status IN ('sent', 'received')
  `);
  const totalIn = Number(b.init_l) + 370.3 + 474.4; // known inflows: blend 2024 + blends 2025
  // Actually, let's compute precisely
  const allMergesIn = await db.execute(sql`
    SELECT COALESCE(SUM(volume_added::numeric), 0) as v FROM batch_merge_history
    WHERE target_batch_id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL
  `);
  const allTransfersIn = await db.execute(sql`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v FROM batch_transfers
    WHERE destination_batch_id = ${DISTILLERY_BATCH_ID} AND deleted_at IS NULL
  `);
  const totalInL = Number(b.init_l) + Number(allMergesIn.rows[0].v) + Number(allTransfersIn.rows[0].v);
  const totalOutL = Number(verifyDist.rows[0].v);
  const totalAdjL = Number(verifyAdj.rows[0].v);
  const expected = totalInL - totalOutL + totalAdjL;

  console.log(`  Total in: ${totalInL.toFixed(1)}L`);
  console.log(`  Total out (distillation): ${totalOutL.toFixed(1)}L`);
  console.log(`  Adjustments: ${totalAdjL.toFixed(1)}L`);
  console.log(`  Expected ending: ${expected.toFixed(1)}L`);
  console.log(`  Actual (currentVolumeLiters): ${Number(b.cur_l).toFixed(1)}L`);
  console.log(`  Discrepancy: ${(Number(b.cur_l) - expected).toFixed(1)}L`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
