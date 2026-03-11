import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Comprehensive Hard Cider reconciliation to explain the 441.3 gal loss gap.
 *
 * TTB form says:
 *   Opening:      1,061.0 gal
 *   Production:   5,034.1 gal (aggregate press runs)
 *   Class IN:         5.0 gal
 *   Total In:     6,100.1 gal
 *   Packaged:       155.0 gal
 *   Distillation:   758.2 gal
 *   Class OUT:      653.3 gal
 *   Ending bulk:  4,092.3 gal
 *   Losses (bal):   441.3 gal
 *
 * Per-batch losses across 74 eligible batches = only 133.5 gal.
 * Where are the other 307.8 gal?
 */

const L_PER_GAL = 3.78541;
const litersToGal = (l: number) => l / L_PER_GAL;
const galToLiters = (g: number) => g * L_PER_GAL;
const fmt = (gal: number) => gal.toFixed(1);
const fmtL = (l: number) => `${l.toFixed(1)}L (${fmt(litersToGal(l))} gal)`;

async function main() {
  console.log("=============================================================");
  console.log("  COMPREHENSIVE HC RECONCILIATION - Explaining 441.3 gal gap");
  console.log("=============================================================\n");

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY A: Production vs batch initials
  // ─────────────────────────────────────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY A: Press Run Production vs Batch Initials");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // A1: Total press run yield (all press runs, not just HC)
  const totalPressYield = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(total_juice_volume_liters AS NUMERIC)), 0) as total_l,
      COUNT(*) as cnt
    FROM press_runs
    WHERE deleted_at IS NULL
      AND status != 'cancelled'
  `));
  const totalPressYieldL = parseFloat((totalPressYield.rows[0] as any).total_l);
  const totalPressCount = parseInt((totalPressYield.rows[0] as any).cnt);
  console.log(`A1. Total press run yield (all): ${fmtL(totalPressYieldL)} across ${totalPressCount} press runs`);

  // A2: Total initial_volume_liters for ALL cider/perry batches, by reconciliation_status
  const batchInitials = await db.execute(sql.raw(`
    SELECT
      COALESCE(reconciliation_status, 'pending') as recon_status,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(initial_volume_liters AS NUMERIC)), 0) as initial_l,
      COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) as current_l
    FROM batches
    WHERE deleted_at IS NULL
      AND product_type IN ('cider', 'perry')
    GROUP BY COALESCE(reconciliation_status, 'pending')
    ORDER BY recon_status
  `));
  console.log(`\nA2. Cider/perry batch initials by reconciliation status:`);
  let totalAllInitialL = 0;
  let totalAllCurrentL = 0;
  let totalVerifiedPendingInitialL = 0;
  let totalVerifiedPendingCurrentL = 0;
  let totalVerifiedPendingCount = 0;
  for (const r of batchInitials.rows as any[]) {
    const initL = parseFloat(r.initial_l);
    const curL = parseFloat(r.current_l);
    totalAllInitialL += initL;
    totalAllCurrentL += curL;
    if (r.recon_status === 'verified' || r.recon_status === 'pending') {
      totalVerifiedPendingInitialL += initL;
      totalVerifiedPendingCurrentL += curL;
      totalVerifiedPendingCount += parseInt(r.cnt);
    }
    console.log(`  ${r.recon_status}: ${r.cnt} batches, initial=${fmtL(initL)}, current=${fmtL(curL)}`);
  }
  console.log(`  TOTAL ALL: initial=${fmtL(totalAllInitialL)}, current=${fmtL(totalAllCurrentL)}`);
  console.log(`  TOTAL verified/pending: ${totalVerifiedPendingCount} batches, initial=${fmtL(totalVerifiedPendingInitialL)}, current=${fmtL(totalVerifiedPendingCurrentL)}`);

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY B: Excluded/duplicate batch current volume
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY B: Excluded/Duplicate Batch Current Volume");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const exclDupBatches = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name,
      COALESCE(b.reconciliation_status, 'pending') as recon_status,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l,
      b.parent_batch_id,
      b.is_racking_derivative
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND COALESCE(b.reconciliation_status, 'pending') IN ('duplicate', 'excluded')
    ORDER BY CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) DESC
  `));

  let totalExclDupCurrentL = 0;
  let totalExclDupInitialL = 0;
  console.log("Batch                                           | Status    | Initial      | Current");
  console.log("------------------------------------------------|-----------|--------------|--------");
  for (const r of exclDupBatches.rows as any[]) {
    const initL = parseFloat(r.initial_l);
    const curL = parseFloat(r.current_l);
    totalExclDupCurrentL += curL;
    totalExclDupInitialL += initL;
    const name = (r.custom_name || r.batch_number || '').substring(0, 47).padEnd(48);
    console.log(`${name}| ${r.recon_status.padEnd(10)}| ${fmt(litersToGal(initL)).padStart(8)} gal | ${fmt(litersToGal(curL)).padStart(8)} gal`);
  }
  console.log(`\nTotal excl/dup: ${exclDupBatches.rows.length} batches`);
  console.log(`  Initial: ${fmtL(totalExclDupInitialL)}`);
  console.log(`  Current: ${fmtL(totalExclDupCurrentL)}`);

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY C: Per-batch SBD for excluded/duplicate batches
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY C: Per-Batch Losses in Excluded/Duplicate Batches");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  let totalExclDupLossesL = 0;
  for (const batch of exclDupBatches.rows as any[]) {
    const bId = batch.id;
    const sbd = await computeSBD(bId, parseFloat(batch.initial_l), batch.parent_batch_id);
    const curL = parseFloat(batch.current_l);
    const lossL = sbd.reconstructed - curL;
    if (Math.abs(lossL) > 0.1) {
      totalExclDupLossesL += lossL;
      const name = (batch.custom_name || batch.batch_number || '').substring(0, 40);
      console.log(`  ${name}: SBD=${fmtL(sbd.reconstructed)}, current=${fmtL(curL)}, loss=${fmtL(lossL)}`);
    }
  }
  console.log(`\nTotal per-batch losses in excl/dup: ${fmtL(totalExclDupLossesL)}`);

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY D: Orphaned press run volume
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY D: Orphaned Press Runs (no active batch)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const orphanedPR = await db.execute(sql.raw(`
    SELECT
      pr.id, pr.press_run_name, pr.date_completed,
      CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) as yield_l
    FROM press_runs pr
    WHERE pr.deleted_at IS NULL
      AND pr.status != 'cancelled'
      AND NOT EXISTS (
        SELECT 1 FROM batches b
        WHERE b.origin_press_run_id = pr.id AND b.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM batch_merge_history bmh
        JOIN batches b ON b.id = bmh.target_batch_id AND b.deleted_at IS NULL
        WHERE bmh.source_press_run_id = pr.id AND bmh.deleted_at IS NULL
      )
  `));

  let orphanedTotalL = 0;
  for (const r of orphanedPR.rows as any[]) {
    const yieldL = parseFloat(r.yield_l);
    orphanedTotalL += yieldL;
    console.log(`  ${r.press_run_name || r.id}: ${fmtL(yieldL)} (completed: ${r.date_completed})`);
  }
  if (orphanedPR.rows.length === 0) console.log("  None found.");
  console.log(`Total orphaned press run volume: ${fmtL(orphanedTotalL)}`);

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY E: Press run yield going to non-HC batches
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY E: Press Run Yield Going to Non-HC Batches");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // E1: Via batch_merge_history (source_press_run_id → non-cider/perry batch)
  const nonHCMerges = await db.execute(sql.raw(`
    SELECT
      b.id as batch_id, b.batch_number, b.custom_name, b.product_type,
      CAST(bmh.volume_added AS NUMERIC) as vol_l,
      pr.press_run_name
    FROM batch_merge_history bmh
    JOIN batches b ON b.id = bmh.target_batch_id AND b.deleted_at IS NULL
    LEFT JOIN press_runs pr ON pr.id = bmh.source_press_run_id
    WHERE bmh.source_press_run_id IS NOT NULL
      AND bmh.deleted_at IS NULL
      AND b.product_type NOT IN ('cider', 'perry')
    ORDER BY b.product_type, b.batch_number
  `));

  let nonHCMergeVolL = 0;
  console.log("E1. Via batch_merge_history (press_run → non-HC batch):");
  for (const r of nonHCMerges.rows as any[]) {
    const volL = parseFloat(r.vol_l);
    nonHCMergeVolL += volL;
    const name = r.custom_name || r.batch_number;
    console.log(`  ${name} [${r.product_type}]: ${fmtL(volL)} from PR ${r.press_run_name || 'unknown'}`);
  }
  if (nonHCMerges.rows.length === 0) console.log("  None found.");
  console.log(`  Subtotal via merges: ${fmtL(nonHCMergeVolL)}`);

  // E2: Via origin_press_run_id on non-cider/perry batches
  const nonHCOrigin = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name, b.product_type,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      pr.press_run_name
    FROM batches b
    JOIN press_runs pr ON pr.id = b.origin_press_run_id AND pr.deleted_at IS NULL
    WHERE b.deleted_at IS NULL
      AND b.product_type NOT IN ('cider', 'perry')
    ORDER BY b.product_type, b.batch_number
  `));

  let nonHCOriginVolL = 0;
  console.log(`\nE2. Via origin_press_run_id (non-HC batch created directly from press run):`);
  for (const r of nonHCOrigin.rows as any[]) {
    const volL = parseFloat(r.initial_l);
    nonHCOriginVolL += volL;
    const name = r.custom_name || r.batch_number;
    console.log(`  ${name} [${r.product_type}]: initial=${fmtL(volL)} from PR ${r.press_run_name || 'unknown'}`);
  }
  if (nonHCOrigin.rows.length === 0) console.log("  None found.");
  console.log(`  Subtotal via origin: ${fmtL(nonHCOriginVolL)}`);

  const totalNonHCFromPressL = nonHCMergeVolL + nonHCOriginVolL;
  console.log(`\nTotal press run yield going to non-HC: ${fmtL(totalNonHCFromPressL)}`);

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY F: Cider→pommeau transfers
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY F: Cider→Pommeau Transfers");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const ciderToPommeau = await db.execute(sql.raw(`
    SELECT
      bt.id, bt.transferred_at,
      CAST(bt.volume_transferred AS NUMERIC) as vol_l,
      CAST(COALESCE(bt.loss, '0') AS NUMERIC) as loss_l,
      sb.batch_number as source_batch, sb.custom_name as source_name, sb.product_type as source_type,
      db2.batch_number as dest_batch, db2.custom_name as dest_name, db2.product_type as dest_type
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id
    JOIN batches db2 ON db2.id = bt.destination_batch_id
    WHERE bt.deleted_at IS NULL
      AND sb.product_type IN ('cider', 'perry')
      AND db2.product_type = 'pommeau'
    ORDER BY bt.transferred_at
  `));

  let ciderToPommeauL = 0;
  for (const r of ciderToPommeau.rows as any[]) {
    const volL = parseFloat(r.vol_l);
    ciderToPommeauL += volL;
    console.log(`  ${r.source_name || r.source_batch} → ${r.dest_name || r.dest_batch}: ${fmtL(volL)} (loss: ${fmtL(parseFloat(r.loss_l))})`);
  }
  if (ciderToPommeau.rows.length === 0) console.log("  None found.");
  console.log(`Total cider→pommeau: ${fmtL(ciderToPommeauL)}`);

  // Also check merges from cider to pommeau via batch_merge_history
  const ciderToPommeauMerge = await db.execute(sql.raw(`
    SELECT
      bmh.id,
      CAST(bmh.volume_added AS NUMERIC) as vol_l,
      sb.batch_number as source_batch, sb.custom_name as source_name, sb.product_type as source_type,
      tb.batch_number as target_batch, tb.custom_name as target_name, tb.product_type as target_type
    FROM batch_merge_history bmh
    JOIN batches sb ON sb.id = bmh.source_batch_id AND sb.deleted_at IS NULL
    JOIN batches tb ON tb.id = bmh.target_batch_id AND tb.deleted_at IS NULL
    WHERE bmh.deleted_at IS NULL
      AND sb.product_type IN ('cider', 'perry')
      AND tb.product_type = 'pommeau'
  `));

  let ciderToPommeauMergeL = 0;
  if (ciderToPommeauMerge.rows.length > 0) {
    console.log(`\nCider→pommeau via batch_merge_history:`);
    for (const r of ciderToPommeauMerge.rows as any[]) {
      const volL = parseFloat(r.vol_l);
      ciderToPommeauMergeL += volL;
      console.log(`  ${r.source_name || r.source_batch} → ${r.target_name || r.target_batch}: ${fmtL(volL)}`);
    }
    console.log(`  Subtotal: ${fmtL(ciderToPommeauMergeL)}`);
  }

  const totalCiderToPommeauL = ciderToPommeauL + ciderToPommeauMergeL;

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY G: Juice/other typed batches from cider press runs
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY G: Juice/Other Batches From Cider Press Runs");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Batches typed 'juice' or 'other' that come from press runs
  const juiceOtherFromPR = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name, b.product_type,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l,
      pr.press_run_name,
      COALESCE(b.reconciliation_status, 'pending') as recon_status
    FROM batches b
    LEFT JOIN press_runs pr ON pr.id = b.origin_press_run_id
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('juice', 'other')
    ORDER BY b.product_type, b.batch_number
  `));

  let juiceOtherInitialL = 0;
  for (const r of juiceOtherFromPR.rows as any[]) {
    const initL = parseFloat(r.initial_l);
    juiceOtherInitialL += initL;
    const name = r.custom_name || r.batch_number;
    console.log(`  ${name} [${r.product_type}/${r.recon_status}]: initial=${fmtL(initL)}, current=${fmtL(parseFloat(r.current_l))}, PR=${r.press_run_name || 'none'}`);
  }
  if (juiceOtherFromPR.rows.length === 0) console.log("  None found.");
  console.log(`Total juice/other batches: ${fmtL(juiceOtherInitialL)}`);

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY H: Opening balance discrepancy
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CATEGORY H: Opening Balance Discrepancy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const configuredOpeningGal = 1061.0;
  const configuredOpeningL = galToLiters(configuredOpeningGal);

  // Current volume of batches that existed before 2025
  const priorYearBatches = await db.execute(sql.raw(`
    SELECT
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) as current_l,
      COALESCE(SUM(CAST(initial_volume_liters AS NUMERIC)), 0) as initial_l
    FROM batches
    WHERE deleted_at IS NULL
      AND product_type IN ('cider', 'perry')
      AND COALESCE(reconciliation_status, 'pending') IN ('verified', 'pending')
      AND created_at < '2025-01-01'
  `));

  const priorCnt = parseInt((priorYearBatches.rows[0] as any).cnt);
  const priorCurrentL = parseFloat((priorYearBatches.rows[0] as any).current_l);
  const priorInitialL = parseFloat((priorYearBatches.rows[0] as any).initial_l);
  console.log(`Batches created before 2025-01-01 (verified/pending cider/perry):`);
  console.log(`  Count: ${priorCnt}`);
  console.log(`  Initial volume: ${fmtL(priorInitialL)}`);
  console.log(`  Current volume (now): ${fmtL(priorCurrentL)}`);
  console.log(`  Configured opening: ${fmt(configuredOpeningGal)} gal (${fmtL(configuredOpeningL)})`);

  // List those batches
  const priorBatchList = await db.execute(sql.raw(`
    SELECT
      b.batch_number, b.custom_name,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l,
      b.start_date
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND COALESCE(b.reconciliation_status, 'pending') IN ('verified', 'pending')
      AND b.created_at < '2025-01-01'
    ORDER BY b.start_date
  `));

  for (const r of priorBatchList.rows as any[]) {
    const name = (r.custom_name || r.batch_number || '').substring(0, 45);
    console.log(`  ${name}: initial=${fmt(litersToGal(parseFloat(r.initial_l)))} gal, current=${fmt(litersToGal(parseFloat(r.current_l)))} gal`);
  }

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Per-batch losses for verified/pending (the known 133.5 gal)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Per-Batch Loss Detail (Verified/Pending HC)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const eligibleBatches = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name, b.parent_batch_id,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND COALESCE(b.reconciliation_status, 'pending') IN ('verified', 'pending')
    ORDER BY b.start_date
  `));

  let totalEligibleLossL = 0;
  let totalReconstructedL = 0;
  let bigLossBatches: { name: string; lossL: number; reconstructedL: number; currentL: number }[] = [];

  for (const batch of eligibleBatches.rows as any[]) {
    const bId = batch.id;
    const sbd = await computeSBD(bId, parseFloat(batch.initial_l), batch.parent_batch_id);
    const curL = parseFloat(batch.current_l);
    const lossL = sbd.reconstructed - curL;
    totalReconstructedL += sbd.reconstructed;
    if (lossL > 0.5) {
      totalEligibleLossL += lossL;
      bigLossBatches.push({
        name: batch.custom_name || batch.batch_number,
        lossL,
        reconstructedL: sbd.reconstructed,
        currentL: curL,
      });
    } else if (lossL < -0.5) {
      // Negative loss = gain (clamped in SBD)
      totalEligibleLossL += lossL;
    }
  }

  bigLossBatches.sort((a, b) => b.lossL - a.lossL);
  console.log("Top losses (verified/pending HC):");
  for (const b of bigLossBatches.slice(0, 20)) {
    console.log(`  ${b.name.substring(0, 45).padEnd(46)}: SBD=${fmt(litersToGal(b.reconstructedL)).padStart(8)} gal, cur=${fmt(litersToGal(b.currentL)).padStart(8)} gal, LOSS=${fmt(litersToGal(b.lossL)).padStart(8)} gal`);
  }
  console.log(`\nTotal per-batch losses (verified/pending): ${fmtL(totalEligibleLossL)}`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Transfer loss on press-to-vessel
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Transfer Loss (press → vessel)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const transferLoss = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(transfer_loss_l AS NUMERIC)), 0) as total_loss_l,
      COUNT(*) as cnt
    FROM batches
    WHERE deleted_at IS NULL
      AND product_type IN ('cider', 'perry')
      AND transfer_loss_l IS NOT NULL
      AND CAST(transfer_loss_l AS NUMERIC) > 0
  `));
  const transferLossL = parseFloat((transferLoss.rows[0] as any).total_loss_l);
  const transferLossCount = parseInt((transferLoss.rows[0] as any).cnt);
  console.log(`Transfer losses across ${transferLossCount} HC batches: ${fmtL(transferLossL)}`);
  console.log(`(Note: transfer_loss_l is already baked into initial_volume_liters. TTB counts gross=initial+loss as production, loss as a loss. This is informational.)`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Cider→Wine transfers (the Line 24 = 653.3 gal)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VERIFY: Cider→Wine Class Changes (Line 24 = 653.3 gal)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Batches that are wine but originated from cider press runs or have cider parents
  const wineFromCider = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name, b.product_type,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l,
      COALESCE(b.reconciliation_status, 'pending') as recon_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type = 'wine'
    ORDER BY b.batch_number
  `));

  let totalWineInitialL = 0;
  for (const r of wineFromCider.rows as any[]) {
    const initL = parseFloat(r.initial_l);
    totalWineInitialL += initL;
    const name = (r.custom_name || r.batch_number || '').substring(0, 45);
    console.log(`  ${name} [${r.recon_status}]: initial=${fmtL(initL)}, current=${fmtL(parseFloat(r.current_l))}`);
  }
  console.log(`Total wine batch initials: ${fmtL(totalWineInitialL)}`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Packaging breakdown
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VERIFY: Packaging (Line 13 = 155.0 gal)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Bottle runs from cider/perry batches
  const bottling = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(br.volume_taken_liters AS NUMERIC)), 0) as vol_l,
      COALESCE(SUM(CAST(COALESCE(br.loss, '0') AS NUMERIC)), 0) as loss_l,
      COUNT(*) as cnt
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id AND b.deleted_at IS NULL
    WHERE br.voided_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND (br.status IS NULL OR br.status IN ('distributed', 'completed', 'active', 'ready'))
  `));
  const bottlingVolL = parseFloat((bottling.rows[0] as any).vol_l);
  const bottlingLossL = parseFloat((bottling.rows[0] as any).loss_l);
  console.log(`Bottle runs (HC): ${fmtL(bottlingVolL)} taken, ${fmtL(bottlingLossL)} loss, across ${(bottling.rows[0] as any).cnt} runs`);

  // Keg fills from cider/perry batches
  const kegging = await db.execute(sql.raw(`
    SELECT
      kf.id,
      CAST(kf.volume_taken AS NUMERIC) as vol,
      kf.volume_taken_unit,
      CAST(COALESCE(kf.loss, '0') AS NUMERIC) as loss_val,
      kf.loss_unit
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id AND b.deleted_at IS NULL
    WHERE kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
  `));

  let keggingVolL = 0;
  let keggingLossL = 0;
  for (const r of kegging.rows as any[]) {
    let vol = parseFloat(r.vol);
    if (r.volume_taken_unit === 'gal') vol *= L_PER_GAL;
    let loss = parseFloat(r.loss_val);
    if (r.loss_unit === 'gal') loss *= L_PER_GAL;
    keggingVolL += vol;
    keggingLossL += loss;
  }
  console.log(`Keg fills (HC): ${fmtL(keggingVolL)} taken, ${fmtL(keggingLossL)} loss, across ${kegging.rows.length} fills`);
  console.log(`Total packaging: ${fmtL(bottlingVolL + keggingVolL)} = ${fmt(litersToGal(bottlingVolL + keggingVolL))} gal`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Distillation breakdown
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VERIFY: Distillation (Line 16 = 758.2 gal)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const distillation = await db.execute(sql.raw(`
    SELECT
      dr.id, b.batch_number, b.custom_name, b.product_type,
      CAST(COALESCE(dr.source_volume_liters, '0') AS NUMERIC) as vol_l,
      dr.status
    FROM distillation_records dr
    JOIN batches b ON b.id = dr.source_batch_id AND b.deleted_at IS NULL
    WHERE dr.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
    ORDER BY dr.sent_at
  `));

  let totalDistillL = 0;
  for (const r of distillation.rows as any[]) {
    const volL = parseFloat(r.vol_l);
    totalDistillL += volL;
    const name = (r.custom_name || r.batch_number || '').substring(0, 40);
    console.log(`  ${name}: ${fmtL(volL)} [${r.status}]`);
  }
  console.log(`Total distillation: ${fmtL(totalDistillL)} = ${fmt(litersToGal(totalDistillL))} gal`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Cider→Cider transfers (internal, net should be ~0)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Cross-status Transfers (verified/pending ↔ excl/dup)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Transfers FROM verified/pending HC → excluded/duplicate HC
  const vpToExcl = await db.execute(sql.raw(`
    SELECT
      bt.id,
      CAST(bt.volume_transferred AS NUMERIC) as vol_l,
      CAST(COALESCE(bt.loss, '0') AS NUMERIC) as loss_l,
      sb.batch_number as src, sb.custom_name as src_name,
      COALESCE(sb.reconciliation_status, 'pending') as src_status,
      db2.batch_number as dst, db2.custom_name as dst_name,
      COALESCE(db2.reconciliation_status, 'pending') as dst_status
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id AND sb.deleted_at IS NULL AND sb.product_type IN ('cider', 'perry')
    JOIN batches db2 ON db2.id = bt.destination_batch_id AND db2.deleted_at IS NULL AND db2.product_type IN ('cider', 'perry')
    WHERE bt.deleted_at IS NULL
      AND COALESCE(sb.reconciliation_status, 'pending') IN ('verified', 'pending')
      AND COALESCE(db2.reconciliation_status, 'pending') IN ('duplicate', 'excluded')
  `));

  let vpToExclL = 0;
  for (const r of vpToExcl.rows as any[]) {
    const volL = parseFloat(r.vol_l);
    vpToExclL += volL;
    console.log(`  [${r.src_status}] ${(r.src_name || r.src).substring(0, 25)} → [${r.dst_status}] ${(r.dst_name || r.dst).substring(0, 25)}: ${fmtL(volL)}`);
  }
  if (vpToExcl.rows.length === 0) console.log("  None found.");
  console.log(`Total verified/pending → excl/dup: ${fmtL(vpToExclL)}`);

  // Transfers FROM excluded/duplicate HC → verified/pending HC
  const exclToVP = await db.execute(sql.raw(`
    SELECT
      bt.id,
      CAST(bt.volume_transferred AS NUMERIC) as vol_l,
      sb.batch_number as src, sb.custom_name as src_name,
      COALESCE(sb.reconciliation_status, 'pending') as src_status,
      db2.batch_number as dst, db2.custom_name as dst_name,
      COALESCE(db2.reconciliation_status, 'pending') as dst_status
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id AND sb.deleted_at IS NULL AND sb.product_type IN ('cider', 'perry')
    JOIN batches db2 ON db2.id = bt.destination_batch_id AND db2.deleted_at IS NULL AND db2.product_type IN ('cider', 'perry')
    WHERE bt.deleted_at IS NULL
      AND COALESCE(sb.reconciliation_status, 'pending') IN ('duplicate', 'excluded')
      AND COALESCE(db2.reconciliation_status, 'pending') IN ('verified', 'pending')
  `));

  let exclToVPL = 0;
  for (const r of exclToVP.rows as any[]) {
    const volL = parseFloat(r.vol_l);
    exclToVPL += volL;
    console.log(`  [${r.src_status}] ${(r.src_name || r.src).substring(0, 25)} → [${r.dst_status}] ${(r.dst_name || r.dst).substring(0, 25)}: ${fmtL(volL)}`);
  }
  if (exclToVP.rows.length === 0) console.log("  None found.");
  console.log(`Total excl/dup → verified/pending: ${fmtL(exclToVPL)}`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Batch merges INTO cider/perry from non-press-run sources
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Merges INTO HC Batches (by source type)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const mergesIntoHC = await db.execute(sql.raw(`
    SELECT
      bmh.source_type,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(bmh.volume_added AS NUMERIC)), 0) as vol_l
    FROM batch_merge_history bmh
    JOIN batches tb ON tb.id = bmh.target_batch_id AND tb.deleted_at IS NULL
    WHERE bmh.deleted_at IS NULL
      AND tb.product_type IN ('cider', 'perry')
    GROUP BY bmh.source_type
    ORDER BY vol_l DESC
  `));

  let totalMergesIntoHCL = 0;
  for (const r of mergesIntoHC.rows as any[]) {
    const volL = parseFloat(r.vol_l);
    totalMergesIntoHCL += volL;
    console.log(`  ${r.source_type}: ${r.cnt} merges, ${fmtL(volL)}`);
  }
  console.log(`Total merges into HC: ${fmtL(totalMergesIntoHCL)}`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Volume adjustments on HC batches
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Volume Adjustments on HC Batches");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const adjustments = await db.execute(sql.raw(`
    SELECT
      bva.adjustment_type,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(bva.adjustment_amount AS NUMERIC)), 0) as total_l,
      COALESCE(b.reconciliation_status, 'pending') as recon_status
    FROM batch_volume_adjustments bva
    JOIN batches b ON b.id = bva.batch_id AND b.deleted_at IS NULL
    WHERE bva.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
    GROUP BY bva.adjustment_type, COALESCE(b.reconciliation_status, 'pending')
    ORDER BY recon_status, total_l
  `));

  let totalAdjVPL = 0;
  let totalAdjExclL = 0;
  for (const r of adjustments.rows as any[]) {
    const totalL = parseFloat(r.total_l);
    if (r.recon_status === 'verified' || r.recon_status === 'pending') {
      totalAdjVPL += totalL;
    } else {
      totalAdjExclL += totalL;
    }
    console.log(`  [${r.recon_status}] ${r.adjustment_type}: ${r.cnt}x, net=${fmtL(totalL)}`);
  }
  console.log(`Total adj (verified/pending): ${fmtL(totalAdjVPL)}`);
  console.log(`Total adj (excl/dup): ${fmtL(totalAdjExclL)}`);

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Racking and filter losses on HC batches
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Racking/Filter Losses on HC Batches");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const rackingLoss = await db.execute(sql.raw(`
    SELECT
      COALESCE(b.reconciliation_status, 'pending') as recon_status,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(bro.volume_loss AS NUMERIC)), 0) as total_l
    FROM batch_racking_operations bro
    JOIN batches b ON b.id = bro.batch_id AND b.deleted_at IS NULL
    WHERE bro.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
    GROUP BY COALESCE(b.reconciliation_status, 'pending')
  `));

  for (const r of rackingLoss.rows as any[]) {
    console.log(`  Racking loss [${r.recon_status}]: ${r.cnt}x, ${fmtL(parseFloat(r.total_l))}`);
  }

  const filterLoss = await db.execute(sql.raw(`
    SELECT
      COALESCE(b.reconciliation_status, 'pending') as recon_status,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(bfo.volume_loss AS NUMERIC)), 0) as total_l
    FROM batch_filter_operations bfo
    JOIN batches b ON b.id = bfo.batch_id AND b.deleted_at IS NULL
    WHERE bfo.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
    GROUP BY COALESCE(b.reconciliation_status, 'pending')
  `));

  for (const r of filterLoss.rows as any[]) {
    console.log(`  Filter loss [${r.recon_status}]: ${r.cnt}x, ${fmtL(parseFloat(r.total_l))}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL: Deleted HC batches (soft-deleted) that had volume
  // ─────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ADDITIONAL: Soft-Deleted HC Batches");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const deletedBatches = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l,
      b.deleted_at
    FROM batches b
    WHERE b.deleted_at IS NOT NULL
      AND b.product_type IN ('cider', 'perry')
    ORDER BY CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) DESC
  `));

  let deletedInitialL = 0;
  let deletedCurrentL = 0;
  for (const r of deletedBatches.rows as any[]) {
    const initL = parseFloat(r.initial_l);
    const curL = parseFloat(r.current_l);
    deletedInitialL += initL;
    deletedCurrentL += curL;
    if (initL > 1 || curL > 1) {
      const name = (r.custom_name || r.batch_number || '').substring(0, 45);
      console.log(`  ${name}: initial=${fmtL(initL)}, current=${fmtL(curL)}, deleted=${r.deleted_at}`);
    }
  }
  console.log(`Total deleted HC: ${deletedBatches.rows.length} batches, initial=${fmtL(deletedInitialL)}, current=${fmtL(deletedCurrentL)}`);

  // ─────────────────────────────────────────────────────────────────
  // FINAL RECONCILIATION WATERFALL
  // ─────────────────────────────────────────────────────────────────
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║              FINAL RECONCILIATION WATERFALL                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const ttbProductionGal = 5034.1;
  const ttbOpeningGal = 1061.0;
  const ttbClassInGal = 5.0;
  const ttbPackagedGal = 155.0;
  const ttbDistillGal = 758.2;
  const ttbClassOutGal = 653.3;
  const ttbEndingGal = 4092.3;
  const ttbLossesGal = 441.3;

  // What the TTB form says should balance:
  // Opening + Production + ClassIn - Packaged - Distillation - ClassOut - Losses = Ending
  // 1061 + 5034.1 + 5 - 155 - 758.2 - 653.3 - 441.3 = 4092.3

  const perBatchLossVPGal = litersToGal(totalEligibleLossL);
  const exclDupCurrentGal = litersToGal(totalExclDupCurrentL);
  const exclDupLossesGal = litersToGal(totalExclDupLossesL);
  const orphanedGal = litersToGal(orphanedTotalL);
  const ciderToPommeauGal = litersToGal(totalCiderToPommeauL);

  // The key insight: production is press run aggregate, but ending is verified/pending current_volume.
  // Volume that went to excluded/duplicate batches was "produced" but excluded from ending.
  // That volume needs to be accounted for.

  console.log(`TTB Form Numbers:`);
  console.log(`  Opening (Line 1):       ${fmt(ttbOpeningGal)} gal`);
  console.log(`  Production (Line 2):    ${fmt(ttbProductionGal)} gal`);
  console.log(`  Class IN (Line 10):     ${fmt(ttbClassInGal)} gal`);
  console.log(`  Packaged (Line 13):     ${fmt(ttbPackagedGal)} gal`);
  console.log(`  Distillation (Line 16): ${fmt(ttbDistillGal)} gal`);
  console.log(`  Class OUT (Line 24):    ${fmt(ttbClassOutGal)} gal`);
  console.log(`  Ending (Line 31):       ${fmt(ttbEndingGal)} gal`);
  console.log(`  Losses (Line 29/30):    ${fmt(ttbLossesGal)} gal (balancing figure)`);
  console.log(`  Check: ${fmt(ttbOpeningGal)} + ${fmt(ttbProductionGal)} + ${fmt(ttbClassInGal)} - ${fmt(ttbPackagedGal)} - ${fmt(ttbDistillGal)} - ${fmt(ttbClassOutGal)} - ${fmt(ttbLossesGal)} = ${fmt(ttbOpeningGal + ttbProductionGal + ttbClassInGal - ttbPackagedGal - ttbDistillGal - ttbClassOutGal - ttbLossesGal)} gal (should be ${fmt(ttbEndingGal)})`);

  console.log(`\nLoss Explanation:`);
  console.log(`  Total losses to explain:                    ${fmt(ttbLossesGal)} gal`);
  console.log(`  ─────────────────────────────────────────────────────`);
  console.log(`  Per-batch losses (verified/pending):        ${fmt(perBatchLossVPGal)} gal`);
  console.log(`  Excl/dup current volume (not in ending):    ${fmt(exclDupCurrentGal)} gal`);
  console.log(`  Excl/dup per-batch losses:                  ${fmt(exclDupLossesGal)} gal`);
  console.log(`  Orphaned press runs:                        ${fmt(orphanedGal)} gal`);
  console.log(`  Cider→pommeau transfers:                    ${fmt(ciderToPommeauGal)} gal`);

  const totalExclDupVolumeGal = exclDupCurrentGal + exclDupLossesGal;

  // Initial simple view
  const simpleExplainedGal = perBatchLossVPGal + totalExclDupVolumeGal + orphanedGal + ciderToPommeauGal;
  const simpleUnexplainedGal = ttbLossesGal - simpleExplainedGal;

  console.log(`  ─────────────────────────────────────────────────────`);
  console.log(`  Simple sum:                                 ${fmt(simpleExplainedGal)} gal`);
  console.log(`  Remaining:                                  ${fmt(simpleUnexplainedGal)} gal`);

  console.log(`\n  IMPORTANT NOTE ON ORPHANED PRESS RUNS:`);
  console.log(`  If TTB production = SBD-derived (from batch events),`);
  console.log(`  orphaned press run volume was NEVER counted in production.`);
  console.log(`  It can't explain losses since it never entered the system.`);
  console.log(`  If TTB production = aggregate press runs (including orphaned),`);
  console.log(`  then orphaned PR volume IS a loss (juice produced but not tracked).`);

  console.log(`\nNote: The quince adjustment (10 gal from cider→wine reclassification)`);
  console.log(`is already reflected in the Line 24 class-out figure of ${fmt(ttbClassOutGal)} gal.`);

  // ─────────────────────────────────────────────────────────────────
  // DEEP DIVE: TTB Production is AGGREGATE (press runs + juice purchases)
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("DEEP DIVE: Verify TTB Production = Aggregate-Based");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("TTB production = press_runs + juice_purchases - juice_batches - juice_xfers - quince_adj");
  console.log("             = 3872.1 + 1353.3 - 137.4 - 44.0 - 10.0 = 5034.0 gal (matches 5034.1)");
  console.log("");
  console.log("CRITICAL INSIGHT: Production is AGGREGATE (press runs), not SBD-derived.");
  console.log("This means orphaned press runs, non-HC batch volumes, and deleted batch");
  console.log("volumes ARE included in production if the press run completed in period.");
  console.log("The 441.3 gal loss must account for ALL volume leakage.\n");

  // Verified: TTB production = aggregate press runs + juice purchases - juice batches
  //           - transfers_into_juice - quince_adj
  // = 3872.1 + 1353.3 - 137.4 - 44.0 - 10.0 = 5034.0 gal

  // Orphaned press runs: how many completed in the TTB period?
  const orphanedInPeriod = await db.execute(sql.raw(`
    SELECT
      pr.id, pr.press_run_name, pr.date_completed,
      CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) as yield_l
    FROM press_runs pr
    WHERE pr.deleted_at IS NULL
      AND pr.status = 'completed'
      AND pr.date_completed::date > '2024-12-31'::date
      AND NOT EXISTS (
        SELECT 1 FROM batches b WHERE b.origin_press_run_id = pr.id AND b.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM batch_merge_history bmh
        JOIN batches b ON b.id = bmh.target_batch_id AND b.deleted_at IS NULL
        WHERE bmh.source_press_run_id = pr.id AND bmh.deleted_at IS NULL
      )
  `));
  let orphanedInPeriodL = 0;
  console.log(`Orphaned press runs completed in period (counted in production!):`);
  for (const r of orphanedInPeriod.rows as any[]) {
    const yL = parseFloat(r.yield_l);
    orphanedInPeriodL += yL;
    console.log(`  ${r.press_run_name || r.id}: ${fmtL(yL)} (completed: ${r.date_completed})`);
  }
  console.log(`  Total orphaned in period: ${fmtL(orphanedInPeriodL)} = ${fmt(litersToGal(orphanedInPeriodL))} gal`);

  // Press runs from period that went to non-HC batches
  const nonHCPressInPeriod = await db.execute(sql.raw(`
    SELECT
      b.product_type,
      COALESCE(SUM(CAST(b.initial_volume_liters AS NUMERIC)), 0) as initial_l,
      COUNT(*) as cnt
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.origin_press_run_id IS NOT NULL
      AND b.product_type NOT IN ('cider', 'perry')
      AND b.start_date::date > '2024-12-31'::date
    GROUP BY b.product_type
  `));
  let nonHCPressInPeriodL = 0;
  console.log(`\nNon-HC batches from press runs (period, counted in production):`);
  for (const r of nonHCPressInPeriod.rows as any[]) {
    const vL = parseFloat(r.initial_l);
    nonHCPressInPeriodL += vL;
    console.log(`  ${r.product_type}: ${r.cnt} batches, initial=${fmtL(vL)}`);
  }
  // Note: juice-only batches already deducted from production, so don't count those
  // Pommeau and wine from press runs are counted in production but aren't HC ending
  const juiceBatchesFromPressInPeriodL = 520.0; // The "Juice for Community" batch
  const nonHCNonJuicePressInPeriodL = nonHCPressInPeriodL - juiceBatchesFromPressInPeriodL;
  console.log(`  Non-juice, non-HC press run batches: ${fmtL(nonHCNonJuicePressInPeriodL)} (juice already deducted from production)`);

  // Volume sent to deleted HC batches from press runs in the period
  const deletedFromPressInPeriod = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CAST(b.initial_volume_liters AS NUMERIC)), 0) as initial_l,
      COUNT(*) as cnt
    FROM batches b
    WHERE b.deleted_at IS NOT NULL
      AND b.origin_press_run_id IS NOT NULL
      AND b.product_type IN ('cider', 'perry')
      AND b.start_date::date > '2024-12-31'::date
  `));
  const deletedFromPressInPeriodL = parseFloat((deletedFromPressInPeriod.rows[0] as any).initial_l);
  console.log(`\nDeleted HC batches from press runs in period: ${(deletedFromPressInPeriod.rows[0] as any).cnt} batches, initial=${fmtL(deletedFromPressInPeriodL)}`);

  // Check: press runs in period that have NO batch (deleted or otherwise)
  // These are fully orphaned - juice was produced but never tracked to any batch
  // This IS counted in TTB production since production uses aggregate press run yield

  // ─────────────────────────────────────────────────────────────────
  // CORRECT APPROACH: The TTB equation IS the answer.
  // ─────────────────────────────────────────────────────────────────
  //
  // TTB says: Losses = Opening + Production + ClassIN - Packaged - Distillation - ClassOUT - Ending
  //                   = 1061.0 + 5034.1 + 5.0 - 155.0 - 758.2 - 653.3 - 4092.3 = 441.3 gal
  //
  // Each line item is independently computed from the database. The "losses" line
  // is simply a balancing figure. The question isn't "where did 441.3 gal go?"
  // but rather "do we believe each line item is correct?"
  //
  // If every line is correct, then 441.3 gal of real physical loss occurred
  // (evaporation, lees, spillage, measurement error, etc.) and that's fine
  // for TTB reporting.
  //
  // If a line item is wrong, THAT is where the discrepancy lives.
  //
  // Let's verify each line item independently.

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("LINE ITEM VERIFICATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log(`Line 1 (Opening): ${fmt(ttbOpeningGal)} gal`);
  console.log(`  Source: organization_settings.ttb_opening_balances (configured value)`);
  console.log(`  This is a physical inventory count from Dec 31, 2024.`);
  console.log(`  Trust level: HIGH (physical count)\n`);

  console.log(`Line 2 (Production): ${fmt(ttbProductionGal)} gal`);
  console.log(`  Source: SUM(press_runs.total_juice_volume_liters) + juice purchases`);
  console.log(`  Formula: 3872.1 + 1353.3 - 137.4 (juice) - 44.0 (juice xfers) - 10.0 (quince) = 5034.0`);
  console.log(`  This includes volume from ALL press runs (orphaned, non-HC, deleted).`);
  console.log(`  Trust level: HIGH (measured at press)\n`);

  const actualEndingGal = litersToGal(totalVerifiedPendingCurrentL);
  console.log(`Line 31 (Ending): ${fmt(ttbEndingGal)} gal`);
  console.log(`  Source: SUM(current_volume_liters) for verified/pending HC batches`);
  console.log(`  Computed: ${fmt(actualEndingGal)} gal (${totalVerifiedPendingCount} batches)`);
  console.log(`  Delta: ${fmt(ttbEndingGal - actualEndingGal)} gal`);
  console.log(`  Trust level: MEDIUM (current_volume may drift from physical)\n`);

  console.log(`Line 13 (Packaged): ${fmt(ttbPackagedGal)} gal`);
  console.log(`  Computed: ${fmt(litersToGal(bottlingVolL + keggingVolL))} gal`);
  console.log(`  Trust level: HIGH (measured at packaging)\n`);

  console.log(`Line 16 (Distillation): ${fmt(ttbDistillGal)} gal`);
  console.log(`  Computed: ${fmt(litersToGal(totalDistillL))} gal`);
  console.log(`  Trust level: HIGH (measured at distillation)\n`);

  console.log(`Line 24 (Class OUT): ${fmt(ttbClassOutGal)} gal`);
  console.log(`  Wine batch initials: ${fmt(litersToGal(totalWineInitialL))} gal`);
  console.log(`  Trust level: MEDIUM (depends on correct classification)\n`);

  // ─────────────────────────────────────────────────────────────────
  // WHAT THE 441.3 GAL MEANS
  // ─────────────────────────────────────────────────────────────────
  //
  // The losses line captures everything that isn't accounted for elsewhere.
  // For a cidery, legitimate losses include:
  //   - Evaporation (significant for barrel aging)
  //   - Lees/sediment left behind during racking
  //   - Spillage during transfers
  //   - Measurement inaccuracy
  //   - Orphaned press run juice (pressed but never tracked to a batch)
  //   - Volume absorbed by fruit/adjuncts
  //
  // The key question is whether 441.3 gal (8.8% of available volume) is reasonable.

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("LOSS COMPOSITION ANALYSIS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const availableGal = ttbOpeningGal + ttbProductionGal + ttbClassInGal;
  console.log(`Available volume: ${fmt(availableGal)} gal (opening + production + class in)`);
  console.log(`Loss rate: ${(ttbLossesGal / availableGal * 100).toFixed(1)}%\n`);

  // The 441.3 gal IS the total losses. Let's break it down by what we CAN identify:
  console.log(`IDENTIFIED LOSS COMPONENTS:`);
  console.log(`────────────────────────────────────────────────────────────────`);

  // 1. Per-batch SBD losses: batches where current < reconstructed
  console.log(`  1. Per-batch losses (v/p HC, SBD vs current):   ${fmt(perBatchLossVPGal).padStart(7)} gal`);
  console.log(`     Evaporation, lees, measurement drift, etc.`);

  // 2. Orphaned press runs in period: juice produced but no batch ever created
  //    This volume was counted in Production but never entered any batch.
  const orphInPeriodGal = litersToGal(orphanedInPeriodL);
  console.log(`  2. Orphaned press runs (in-period):             ${fmt(orphInPeriodGal).padStart(7)} gal`);
  console.log(`     Juice pressed but never tracked to any batch.`);

  // 3. Cider→pommeau transfers: volume left HC batches, went to pommeau
  //    Not in Class OUT (that's cider→wine), not in packaging, not in ending
  console.log(`  3. Cider→pommeau transfers:                     ${fmt(ciderToPommeauGal).padStart(7)} gal`);
  console.log(`     Volume left HC, went to pommeau (not in Class OUT).`);

  // 4. Excl/dup batch current volume: produced and sitting in excl/dup batches
  //    Not counted in ending because they're excluded/duplicate
  console.log(`  4. Excl/dup batch current volume:               ${fmt(exclDupCurrentGal).padStart(7)} gal`);
  console.log(`     Volume sitting in batches excluded from ending.`);

  // 5. Press run yield going to non-HC, non-wine, non-juice batches in period
  //    (pommeau from press runs) - counted in production but not HC ending or Class OUT
  const pommeauFromPressInPeriod = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(b.initial_volume_liters AS NUMERIC)), 0) as initial_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.origin_press_run_id IS NOT NULL
      AND b.product_type = 'pommeau'
      AND b.start_date::date > '2024-12-31'::date
  `));
  const pommeauFromPressGal = litersToGal(parseFloat((pommeauFromPressInPeriod.rows[0] as any).initial_l));
  console.log(`  5. Pommeau from press (not in Class OUT):       ${fmt(pommeauFromPressGal).padStart(7)} gal`);

  // 6. Transfer loss (press→vessel): counted in Production but not in batch initials
  const transferLossGal = litersToGal(transferLossL);
  console.log(`  6. Transfer loss (press→vessel):                ${fmt(transferLossGal).padStart(7)} gal`);
  console.log(`     Gross production includes this; batch initials don't.`);

  // 7. Volume adjustments (net negative on v/p HC batches)
  //    These represent known losses like sediment removal, contamination
  //    NOTE: adjustments are already in SBD, so they're in per-batch loss IF
  //    the batch's current_volume was also adjusted. If both SBD and current
  //    include the adjustment, it cancels. If only SBD includes it, it shows
  //    up in per-batch losses. Let's just note them.
  const adjNetGal = litersToGal(totalAdjVPL);
  console.log(`  7. Volume adjustments (net, v/p HC):            ${fmt(adjNetGal).padStart(7)} gal`);
  console.log(`     (Already in SBD calc; shown for reference.)`);

  // 8. Orphaned press runs from prior period that are still "orphaned"
  //    These completed before 2025 but their yield was counted in prior year production.
  //    They should NOT be in 2025 losses. Let's verify.
  const orphPrePeriodGal = litersToGal(orphanedTotalL) - orphInPeriodGal;
  console.log(`  8. Orphaned press runs (pre-period):            ${fmt(orphPrePeriodGal).padStart(7)} gal`);
  console.log(`     NOT in 2025 production. NOT a 2025 loss.`);

  const identifiedLossGal = perBatchLossVPGal + orphInPeriodGal + ciderToPommeauGal
    + exclDupCurrentGal + pommeauFromPressGal + transferLossGal;
  const unidentifiedLossGal = ttbLossesGal - identifiedLossGal;

  console.log(`────────────────────────────────────────────────────────────────`);
  console.log(`  Total identified losses (items 1-6):            ${fmt(identifiedLossGal).padStart(7)} gal`);
  console.log(`  TTB losses line:                                ${fmt(ttbLossesGal).padStart(7)} gal`);
  console.log(`  Unidentified remainder:                         ${fmt(unidentifiedLossGal).padStart(7)} gal`);
  console.log(`────────────────────────────────────────────────────────────────`);

  // Additional check: are there v/p HC batches where current > SBD (gains)?
  // These gains mask losses in the per-batch total.
  let totalGainsL = 0;
  let totalTrueLossesL = 0;
  let gainCount = 0;
  let lossCount = 0;
  for (const batch of eligibleBatches.rows as any[]) {
    const sbd = await computeSBD(batch.id, parseFloat(batch.initial_l), batch.parent_batch_id);
    const curL = parseFloat(batch.current_l);
    const diff = curL - sbd.reconstructed;
    if (diff > 0.5) {
      totalGainsL += diff;
      gainCount++;
    } else if (diff < -0.5) {
      totalTrueLossesL += Math.abs(diff);
      lossCount++;
    }
  }

  console.log(`\n  Per-batch detail:`);
  console.log(`    Batches with losses (current < SBD): ${lossCount} batches, total ${fmtL(totalTrueLossesL)}`);
  console.log(`    Batches with gains  (current > SBD): ${gainCount} batches, total ${fmtL(totalGainsL)}`);
  console.log(`    Net per-batch = losses - gains:      ${fmtL(totalTrueLossesL - totalGainsL)}`);
  console.log(`    (This net is the 22.5 gal shown in item 1 above.)`);

  if (totalGainsL > 1) {
    console.log(`\n  Gross losses (ignoring gains): ${fmt(litersToGal(totalTrueLossesL))} gal`);
    console.log(`  Gains masking losses:          ${fmt(litersToGal(totalGainsL))} gal`);
    const grossIdentifiedGal = identifiedLossGal - perBatchLossVPGal + litersToGal(totalTrueLossesL);
    const grossRemainder = ttbLossesGal - grossIdentifiedGal;
    console.log(`  Adjusted identified (gross):   ${fmt(grossIdentifiedGal)} gal`);
    console.log(`  Adjusted remainder:            ${fmt(grossRemainder)} gal`);
  }

  // ─────────────────────────────────────────────────────────────────
  // CRITICAL: Opening balance analysis
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("OPENING BALANCE DEEP DIVE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log(`Configured opening: ${fmt(ttbOpeningGal)} gal (physical inventory Dec 31, 2024)`);
  console.log(`Pre-2025 v/p HC batches: ${priorCnt} with ${fmt(litersToGal(priorCurrentL))} gal current volume`);
  console.log(``);
  console.log(`The opening balance (${fmt(ttbOpeningGal)} gal) was physically measured inventory.`);
  console.log(`These batches were later entered into the system as new batches with start dates`);
  console.log(`in 2025, using press run volume from 2025 (counted in Production).`);
  console.log(``);
  console.log(`This means the opening volume is NOT double-counted with production if:`);
  console.log(`  - The carried-forward batches' initial volumes came from pre-2025 press runs`);
  console.log(`  - OR the system uses the SBD-based waterfall (which handles this via openingDelta)`);
  console.log(``);

  // Check: which batches in the current v/p HC set have start_date before 2025
  // vs which started in 2025? The ones that started in 2025 got ALL their volume
  // from 2025 production. The opening balance represents volume that existed before 2025.
  const batchesByYear = await db.execute(sql.raw(`
    SELECT
      CASE WHEN start_date < '2025-01-01' THEN 'pre-2025' ELSE '2025' END as year_group,
      COUNT(*) as cnt,
      COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) as current_l,
      COALESCE(SUM(CAST(initial_volume_liters AS NUMERIC)), 0) as initial_l
    FROM batches
    WHERE deleted_at IS NULL
      AND product_type IN ('cider', 'perry')
      AND COALESCE(reconciliation_status, 'pending') IN ('verified', 'pending')
    GROUP BY CASE WHEN start_date < '2025-01-01' THEN 'pre-2025' ELSE '2025' END
  `));
  for (const r of batchesByYear.rows as any[]) {
    console.log(`  ${r.year_group}: ${r.cnt} batches, initial=${fmtL(parseFloat(r.initial_l))}, current=${fmtL(parseFloat(r.current_l))}`);
  }

  // The key question: do the "2025" batches include volume that was physically
  // part of the opening balance? If yes, the TTB equation double-counts it:
  //   Opening(1061) counts it as pre-existing
  //   Production(5034.1) counts it again via press runs
  //
  // The app's SBD-based waterfall handles this via openingDelta, but the
  // aggregate TTB production formula does NOT.
  //
  // The TTB form says the cidery HAD 1061 gal at year start, PRODUCED 5034.1 gal
  // during the year, and ENDED with 4092.3 gal + 1566.5 gal removals + 441.3 losses.
  //
  // If the opening balance batches were re-entered as 2025 batches (with 2025 press
  // run initials), then their volume appears in BOTH opening AND production.
  // The "loss" is actually: real opening wasn't 1061 gal of additional volume —
  // it was volume that would later be re-pressed/re-tracked as 2025 production.

  // Check carried-forward batches (those that the SBD system would consider as opening)
  // These are batches with start_date ≤ opening date AND start_date in the
  // "carried forward" set of the SBD waterfall
  const carriedForward = await db.execute(sql.raw(`
    SELECT
      b.id, b.batch_number, b.custom_name,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l,
      b.start_date, b.created_at,
      COALESCE(b.reconciliation_status, 'pending') as recon_status,
      pr.press_run_name, pr.date_completed as pr_date
    FROM batches b
    LEFT JOIN press_runs pr ON pr.id = b.origin_press_run_id
    WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND COALESCE(b.reconciliation_status, 'pending') IN ('verified', 'pending')
      AND b.start_date < '2025-01-01'
    ORDER BY b.start_date
  `));

  console.log(`\nCarried-forward batches (start_date before 2025):`);
  let cfInitialL = 0;
  let cfCurrentL = 0;
  for (const r of carriedForward.rows as any[]) {
    const initL = parseFloat(r.initial_l);
    const curL = parseFloat(r.current_l);
    cfInitialL += initL;
    cfCurrentL += curL;
    const name = (r.custom_name || r.batch_number || '').substring(0, 40);
    console.log(`  ${name}: initial=${fmtL(initL)}, current=${fmtL(curL)}, start=${r.start_date}, PR=${r.press_run_name || 'none'} (${r.pr_date || 'n/a'})`);
  }
  if (carriedForward.rows.length === 0) console.log(`  None found.`);
  console.log(`  Total: initial=${fmtL(cfInitialL)}, current=${fmtL(cfCurrentL)}`);

  console.log(`\n  CONCLUSION ON OPENING BALANCE:`);
  if (carriedForward.rows.length <= 1) {
    console.log(`  Only ${carriedForward.rows.length} batch existed before 2025 (with ${fmt(litersToGal(cfCurrentL))} gal).`);
    console.log(`  The configured opening of ${fmt(ttbOpeningGal)} gal represents physical inventory that`);
    console.log(`  was subsequently re-entered as new batches from 2025 press runs.`);
    console.log(`  This means ~${fmt(ttbOpeningGal)} gal may be double-counted between Opening and Production.`);
    console.log(`  However, the SBD-based waterfall compensates via openingDelta.`);
    console.log(`  For the AGGREGATE TTB form (which this analysis uses), the apparent loss`);
    console.log(`  of ~${fmt(unidentifiedLossGal)} gal is likely the opening balance effect.`);
    console.log(`  The actual real losses are the identified items (${fmt(identifiedLossGal)} gal).`);
  } else {
    console.log(`  ${carriedForward.rows.length} batches carried forward with ${fmt(litersToGal(cfCurrentL))} gal.`);
    console.log(`  Opening balance of ${fmt(ttbOpeningGal)} gal is backed by these batches.`);
  }

  // Final summary
  console.log(`\n`);
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    EXECUTIVE SUMMARY                          ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  console.log(`TTB Line 29/30 (Losses): ${fmt(ttbLossesGal)} gal`);
  console.log(`Loss rate: ${(ttbLossesGal / availableGal * 100).toFixed(1)}% of available volume\n`);
  console.log(`Breakdown:`);
  console.log(`  Per-batch losses (evaporation/lees/drift):   ${fmt(perBatchLossVPGal).padStart(7)} gal`);
  console.log(`  Orphaned press runs (in-period):             ${fmt(orphInPeriodGal).padStart(7)} gal`);
  console.log(`  Cider-to-pommeau transfers:                  ${fmt(ciderToPommeauGal).padStart(7)} gal`);
  console.log(`  Excl/dup batch current volume:               ${fmt(exclDupCurrentGal).padStart(7)} gal`);
  console.log(`  Transfer loss (press-to-vessel):             ${fmt(transferLossGal).padStart(7)} gal`);
  console.log(`  Subtotal identified:                         ${fmt(identifiedLossGal).padStart(7)} gal`);
  console.log(`  ────────────────────────────────────────────────────────`);
  console.log(`  Remainder (likely opening balance effect):   ${fmt(unidentifiedLossGal).padStart(7)} gal`);
  console.log(`  ────────────────────────────────────────────────────────`);
  console.log(`  Total:                                       ${fmt(ttbLossesGal).padStart(7)} gal`);

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`Done.`);

  process.exit(0);
}

/**
 * Compute SBD (System Balance-Derived) reconstructed volume for a batch.
 * Returns the volume the system thinks the batch should have based on all recorded events.
 */
async function computeSBD(batchId: string, initialL: number, parentBatchId: string | null) {
  // Transfers
  const xfers = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN destination_batch_id = '${batchId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_in,
      COALESCE(SUM(CASE WHEN source_batch_id = '${batchId}' THEN CAST(volume_transferred AS NUMERIC) ELSE 0 END), 0) as xfer_out,
      COALESCE(SUM(CASE WHEN source_batch_id = '${batchId}' THEN CAST(COALESCE(loss, '0') AS NUMERIC) ELSE 0 END), 0) as xfer_loss
    FROM batch_transfers
    WHERE (source_batch_id = '${batchId}' OR destination_batch_id = '${batchId}') AND deleted_at IS NULL
  `));

  // Merges
  const merges = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN target_batch_id = '${batchId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_in,
      COALESCE(SUM(CASE WHEN source_batch_id = '${batchId}' THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as merge_out
    FROM batch_merge_history
    WHERE (target_batch_id = '${batchId}' OR source_batch_id = '${batchId}')
      AND deleted_at IS NULL
  `));

  // Bottling (voided_at only, no deleted_at on bottle_runs)
  const bottling = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken_liters AS NUMERIC)), 0) as vol,
           COALESCE(SUM(CAST(COALESCE(loss, '0') AS NUMERIC)), 0) as loss
    FROM bottle_runs WHERE batch_id = '${batchId}' AND voided_at IS NULL
  `));

  // Kegging (voided_at AND deleted_at)
  const kegging = await db.execute(sql.raw(`
    SELECT
      COALESCE(SUM(
        CASE WHEN volume_taken_unit = 'gal'
             THEN CAST(volume_taken AS NUMERIC) * ${L_PER_GAL}
             ELSE CAST(volume_taken AS NUMERIC) END
      ), 0) as vol,
      COALESCE(SUM(
        CASE WHEN loss_unit = 'gal'
             THEN CAST(COALESCE(loss, '0') AS NUMERIC) * ${L_PER_GAL}
             ELSE CAST(COALESCE(loss, '0') AS NUMERIC) END
      ), 0) as loss
    FROM keg_fills WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL
  `));

  // Distillation
  const distill = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(source_volume_liters AS NUMERIC)), 0) as vol
    FROM distillation_records WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
  `));

  // Adjustments
  const adj = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS NUMERIC)), 0) as vol
    FROM batch_volume_adjustments WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `));

  // Racking loss
  const rackLoss = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
    FROM batch_racking_operations WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `));

  // Filter loss
  const filterLoss = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_loss AS NUMERIC)), 0) as vol
    FROM batch_filter_operations WHERE batch_id = '${batchId}' AND deleted_at IS NULL
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
  const isTransferCreated = parentBatchId && xi >= initialL * 0.9 && initialL > 0;
  const effectiveInitial = isTransferCreated ? 0 : initialL;

  const reconstructed = Math.max(0, effectiveInitial + mi - mo + xi - xo - xl - bv - bl - kv - kl - dv + av - rl - fl);

  return { reconstructed, effectiveInitial, mi, mo, xi, xo, xl, bv, bl, kv, kl, dv, av, rl, fl, isTransferCreated: !!isTransferCreated };
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
