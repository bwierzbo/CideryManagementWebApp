import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Investigate the ~258 gal gap in Hard Cider TTB Form reconciliation.
 *
 * Problem: TTB Form HC Column:
 *   Line 12 (Total In) = 6,050.6 gal
 *   Known removals: Bottled(155) + ClassChange(653.3) + Distillation(758.2) + Ending(4092.3) = 5,658.8
 *   Required Line 29 (Losses) = 6,050.6 - 5,658.8 = 391.8 gal
 *   Actual per-batch losses = 133.5 gal
 *   GAP = 258.3 gal
 *
 * Root cause: Production (Line 2) counts ALL press run juice volume,
 * but several categories of volume exit HC production without being tracked
 * as losses, ending inventory, bottling, or class transfers.
 */

const G = 0.264172;
function fmt(l: number): string { return `${l.toFixed(1)}L (${(l * G).toFixed(1)} gal)`; }

async function main() {
  console.log("=================================================================");
  console.log("  Hard Cider TTB Loss Gap Investigation");
  console.log("  Gap to explain: ~258 gal");
  console.log("=================================================================\n");

  // ---------------------------------------------------------------
  // 1. Excluded/duplicate HC batches: SBD ending + losses
  //    Production is counted (from their press runs), but their
  //    ending inventory (Line 31) and losses (Line 29) are excluded.
  // ---------------------------------------------------------------
  console.log("=== 1. EXCLUDED/DUPLICATE HC BATCHES ===\n");

  const exclBatches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           CAST(b.initial_volume_liters AS NUMERIC) as init_l,
           CAST(b.current_volume_liters AS NUMERIC) as curr_l,
           b.reconciliation_status
    FROM batches b WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND b.reconciliation_status IN ('duplicate', 'excluded')
    ORDER BY b.start_date
  `));

  let totalExclSBD = 0;
  for (const row of (exclBatches.rows as any[])) {
    const bId = row.id;
    const initL = parseFloat(row.init_l || "0");
    const s = await db.execute(sql.raw(`SELECT
      COALESCE((SELECT SUM(CAST(volume_added AS NUMERIC)) FROM batch_merge_history WHERE target_batch_id = '${bId}'), 0) as mi,
      COALESCE((SELECT SUM(CAST(volume_added AS NUMERIC)) FROM batch_merge_history WHERE source_batch_id = '${bId}'), 0) as mo,
      COALESCE((SELECT SUM(CAST(volume_transferred AS NUMERIC)) FROM batch_transfers WHERE destination_batch_id = '${bId}' AND deleted_at IS NULL), 0) as xi,
      COALESCE((SELECT SUM(CAST(volume_transferred AS NUMERIC)) FROM batch_transfers WHERE source_batch_id = '${bId}' AND deleted_at IS NULL), 0) as xo,
      COALESCE((SELECT SUM(CAST(COALESCE(loss, '0') AS NUMERIC)) FROM batch_transfers WHERE source_batch_id = '${bId}' AND deleted_at IS NULL), 0) as xl,
      COALESCE((SELECT SUM(CAST(volume_taken_liters AS NUMERIC)) FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL), 0) as bv,
      COALESCE((SELECT SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(CAST(loss AS NUMERIC), 0) * 3.78541 ELSE COALESCE(CAST(loss AS NUMERIC), 0) END) FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL), 0) as bl,
      COALESCE((SELECT SUM(CAST(volume_taken AS NUMERIC)) FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL), 0) as kv,
      COALESCE((SELECT SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(CAST(loss AS NUMERIC), 0) * 3.78541 ELSE COALESCE(CAST(loss AS NUMERIC), 0) END) FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL), 0) as kl,
      COALESCE((SELECT SUM(CAST(source_volume_liters AS NUMERIC)) FROM distillation_records WHERE source_batch_id = '${bId}' AND deleted_at IS NULL), 0) as dv,
      COALESCE((SELECT SUM(CAST(adjustment_amount AS NUMERIC)) FROM batch_volume_adjustments WHERE batch_id = '${bId}' AND deleted_at IS NULL), 0) as av,
      COALESCE((SELECT SUM(CAST(volume_loss AS NUMERIC)) FROM batch_racking_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL), 0) as rl,
      COALESCE((SELECT SUM(CAST(volume_loss AS NUMERIC)) FROM batch_filter_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL), 0) as fl
    `));
    const d = s.rows[0] as any;
    const mi = parseFloat(d.mi); const mo = parseFloat(d.mo);
    const xi = parseFloat(d.xi); const xo = parseFloat(d.xo); const xl = parseFloat(d.xl);
    const bv = parseFloat(d.bv); const bl = parseFloat(d.bl);
    const kv = parseFloat(d.kv); const kl = parseFloat(d.kl);
    const dv = parseFloat(d.dv); const av = parseFloat(d.av);
    const rl = parseFloat(d.rl); const fl = parseFloat(d.fl);
    const isTC = row.parent_batch_id && xi >= initL * 0.9 && initL > 0;
    const effInit = isTC ? 0 : initL;
    const raw = effInit + mi - mo + xi - xo - xl - bv - bl - kv - kl - dv + av - rl - fl;
    const sbdVal = Math.max(0, raw);
    totalExclSBD += sbdVal;
    const name = (row.custom_name || row.batch_number || "").substring(0, 40);
    console.log(`  ${name.padEnd(40)} SBD ending: ${fmt(sbdVal)}`);
    if (sbdVal > 0.1) {
      console.log(`    init=${effInit.toFixed(0)} +mi=${mi.toFixed(0)} -mo=${mo.toFixed(0)} +xi=${xi.toFixed(0)} -xo=${xo.toFixed(0)}`);
    }
  }

  const exclLoss = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(bt.loss AS NUMERIC)), 0) as v
    FROM batch_transfers bt JOIN batches b ON b.id = bt.source_batch_id
    WHERE bt.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.reconciliation_status IN ('duplicate', 'excluded') AND b.product_type IN ('cider', 'perry')
  `));
  const exclLossL = parseFloat((exclLoss.rows[0] as any).v);

  console.log(`\n  SBD ending (not in Line 31): ${fmt(totalExclSBD)}`);
  console.log(`  Losses (not in Line 29):     ${fmt(exclLossL)}`);
  console.log(`  SUBTOTAL:                    ${fmt(totalExclSBD + exclLossL)}`);

  // ---------------------------------------------------------------
  // 2. Orphaned press runs (completed, but no active batch)
  // ---------------------------------------------------------------
  console.log("\n=== 2. ORPHANED PRESS RUNS ===\n");

  const orphaned = await db.execute(sql.raw(`
    SELECT pr.press_run_name, CAST(pr.total_juice_volume_liters AS NUMERIC) as juice_l
    FROM press_runs pr
    WHERE pr.status = 'completed' AND pr.deleted_at IS NULL
      AND pr.id NOT IN (SELECT DISTINCT origin_press_run_id FROM batches WHERE origin_press_run_id IS NOT NULL AND deleted_at IS NULL)
      AND pr.id NOT IN (SELECT DISTINCT source_press_run_id FROM batch_merge_history WHERE source_press_run_id IS NOT NULL
                         AND target_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL))
  `));
  let orphanedL = 0;
  for (const row of (orphaned.rows as any[])) {
    const juiceL = parseFloat(row.juice_l || "0");
    orphanedL += juiceL;
    console.log(`  ${row.press_run_name}: ${fmt(juiceL)}`);
  }
  if (orphaned.rows.length === 0) console.log("  (none)");
  console.log(`  SUBTOTAL: ${fmt(orphanedL)}`);

  // ---------------------------------------------------------------
  // 3. Press runs -> only non-HC batches (wine/pommeau directly from press)
  //    Their juice is counted as HC production (Line 2) but the resulting
  //    batch is wine/pommeau. No batch_transfer record exists, so
  //    transfersOut (Line 15) doesn't capture this volume.
  // ---------------------------------------------------------------
  console.log("\n=== 3. DIRECT PRESS -> NON-HC BATCHES ===");
  console.log("  (Juice counted as HC prod, batch is wine/pommeau, no batch_transfer)\n");

  const directNonHC = await db.execute(sql.raw(`
    SELECT b.custom_name, b.batch_number, b.product_type,
           CAST(b.initial_volume_liters AS NUMERIC) as init_l,
           pr.press_run_name
    FROM batches b
    JOIN press_runs pr ON pr.id = b.origin_press_run_id
    WHERE b.deleted_at IS NULL
      AND b.product_type NOT IN ('cider', 'perry', 'juice', 'brandy')
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
    ORDER BY b.product_type, b.start_date
  `));
  let directNonHCL = 0;
  for (const row of (directNonHC.rows as any[])) {
    const initL = parseFloat(row.init_l || "0");
    directNonHCL += initL;
    const name = (row.custom_name || row.batch_number || "").substring(0, 30);
    console.log(`  ${name.padEnd(30)} ${(row.product_type || "").padEnd(10)} init: ${fmt(initL)} (from ${row.press_run_name})`);
  }
  if (directNonHC.rows.length === 0) console.log("  (none)");

  // Also check: press runs that ONLY link to non-HC + juice batches
  // The juice portion IS subtracted, but the non-HC portion is NOT
  // For press runs with mixed batches (HC + non-HC), the non-HC initial
  // is still counted in production and not subtracted
  console.log(`\n  Direct non-HC batch initials: ${fmt(directNonHCL)}`);
  console.log("  Note: These batches also received volume via batch_transfers from HC batches.");
  console.log("  The batch_transfer volume IS in transfersOut. But the initial_volume from");
  console.log("  the press run (if > 0) is extra volume NOT captured by transfersOut.");

  // Check how much of directNonHCL is truly unmatched
  // (i.e., press runs where non-HC batch initial is part of press juice, not from a transfer)
  const nonHCWithoutXfer = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.product_type,
           CAST(b.initial_volume_liters AS NUMERIC) as init_l,
           COALESCE((SELECT SUM(CAST(bt.volume_transferred AS NUMERIC))
                     FROM batch_transfers bt WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL), 0) as xfer_in_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type NOT IN ('cider', 'perry', 'juice', 'brandy')
      AND b.origin_press_run_id IS NOT NULL
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
  `));
  let trueDirectL = 0;
  for (const row of (nonHCWithoutXfer.rows as any[])) {
    const initL = parseFloat(row.init_l || "0");
    const xferInL = parseFloat(row.xfer_in_l || "0");
    // If batch has xferIn >= initL, the initial came from transfer (already in transfersOut)
    // If batch has xferIn < initL, the excess came directly from press (NOT in transfersOut)
    const directFromPress = Math.max(0, initL - xferInL);
    if (directFromPress > 0.1) {
      trueDirectL += directFromPress;
      const name = (row.custom_name || "").substring(0, 25);
      console.log(`  ${name.padEnd(25)} init=${initL.toFixed(0)}L xferIn=${xferInL.toFixed(0)}L direct=${directFromPress.toFixed(0)}L`);
    }
  }
  console.log(`\n  True direct press -> non-HC (not in transfersOut): ${fmt(trueDirectL)}`);

  // ---------------------------------------------------------------
  // 4. SBD clamping (verified/pending HC batches going negative)
  // ---------------------------------------------------------------
  console.log("\n=== 4. SBD CLAMPING ===\n");

  const eligible = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           CAST(b.initial_volume_liters AS NUMERIC) as init_l
    FROM batches b WHERE b.deleted_at IS NULL
      AND b.product_type IN ('cider', 'perry')
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
  `));
  let totalClampedL = 0;
  for (const row of (eligible.rows as any[])) {
    const bId = row.id;
    const initL = parseFloat(row.init_l || "0");
    const s = await db.execute(sql.raw(`SELECT
      COALESCE((SELECT SUM(CAST(volume_added AS NUMERIC)) FROM batch_merge_history WHERE target_batch_id = '${bId}'), 0) as mi,
      COALESCE((SELECT SUM(CAST(volume_added AS NUMERIC)) FROM batch_merge_history WHERE source_batch_id = '${bId}'), 0) as mo,
      COALESCE((SELECT SUM(CAST(volume_transferred AS NUMERIC)) FROM batch_transfers WHERE destination_batch_id = '${bId}' AND deleted_at IS NULL), 0) as xi,
      COALESCE((SELECT SUM(CAST(volume_transferred AS NUMERIC)) FROM batch_transfers WHERE source_batch_id = '${bId}' AND deleted_at IS NULL), 0) as xo,
      COALESCE((SELECT SUM(CAST(COALESCE(loss, '0') AS NUMERIC)) FROM batch_transfers WHERE source_batch_id = '${bId}' AND deleted_at IS NULL), 0) as xl,
      COALESCE((SELECT SUM(CAST(volume_taken_liters AS NUMERIC)) FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL), 0) as bv,
      COALESCE((SELECT SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(CAST(loss AS NUMERIC), 0) * 3.78541 ELSE COALESCE(CAST(loss AS NUMERIC), 0) END) FROM bottle_runs WHERE batch_id = '${bId}' AND voided_at IS NULL), 0) as bl,
      COALESCE((SELECT SUM(CAST(volume_taken AS NUMERIC)) FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL), 0) as kv,
      COALESCE((SELECT SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(CAST(loss AS NUMERIC), 0) * 3.78541 ELSE COALESCE(CAST(loss AS NUMERIC), 0) END) FROM keg_fills WHERE batch_id = '${bId}' AND voided_at IS NULL AND deleted_at IS NULL), 0) as kl,
      COALESCE((SELECT SUM(CAST(source_volume_liters AS NUMERIC)) FROM distillation_records WHERE source_batch_id = '${bId}' AND deleted_at IS NULL), 0) as dv,
      COALESCE((SELECT SUM(CAST(adjustment_amount AS NUMERIC)) FROM batch_volume_adjustments WHERE batch_id = '${bId}' AND deleted_at IS NULL), 0) as av,
      COALESCE((SELECT SUM(CAST(volume_loss AS NUMERIC)) FROM batch_racking_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL), 0) as rl,
      COALESCE((SELECT SUM(CAST(volume_loss AS NUMERIC)) FROM batch_filter_operations WHERE batch_id = '${bId}' AND deleted_at IS NULL), 0) as fl
    `));
    const d = s.rows[0] as any;
    const mi = parseFloat(d.mi); const mo = parseFloat(d.mo);
    const xi = parseFloat(d.xi); const xo = parseFloat(d.xo); const xl = parseFloat(d.xl);
    const bv = parseFloat(d.bv); const bl = parseFloat(d.bl);
    const kv = parseFloat(d.kv); const kl = parseFloat(d.kl);
    const dv = parseFloat(d.dv); const av = parseFloat(d.av);
    const rl = parseFloat(d.rl); const fl = parseFloat(d.fl);
    const isTC = row.parent_batch_id && xi >= initL * 0.9 && initL > 0;
    const effInit = isTC ? 0 : initL;
    const raw = effInit + mi - mo + xi - xo - xl - bv - bl - kv - kl - dv + av - rl - fl;
    if (raw < -0.5) {
      totalClampedL += Math.abs(raw);
      const name = (row.custom_name || row.batch_number || "").substring(0, 35);
      console.log(`  ${name.padEnd(35)} raw: ${raw.toFixed(1)}L -> clamped ${Math.abs(raw).toFixed(1)}L`);
    }
  }
  if (totalClampedL < 0.5) console.log("  (negligible)");
  console.log(`  SUBTOTAL: ${fmt(totalClampedL)}`);

  // ---------------------------------------------------------------
  // 5. Unaccounted press run volume (transfer_loss_l gap)
  //    Press runs produce X liters, but batch initials + merges = X - transfer_loss_l
  //    transfer_loss_l IS counted as a loss in the TTB form (pressTransferLosses)
  //    BUT only for verified/pending batches. Excl/dup batches' transfer_loss_l
  //    is NOT counted.
  // ---------------------------------------------------------------
  console.log("\n=== 5. EXCLUDED TRANSFER LOSSES ===\n");

  const exclXferLoss = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(b.transfer_loss_l AS NUMERIC)), 0) as v
    FROM batches b WHERE b.deleted_at IS NULL
      AND b.reconciliation_status IN ('duplicate', 'excluded')
      AND b.product_type IN ('cider', 'perry')
      AND b.transfer_loss_l IS NOT NULL AND CAST(b.transfer_loss_l AS NUMERIC) > 0
  `));
  const exclXferLossL = parseFloat((exclXferLoss.rows[0] as any).v);
  console.log(`  Transfer losses on excl/dup batches: ${fmt(exclXferLossL)}`);

  // ---------------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------------
  console.log("\n\n===========================================================");
  console.log("  FINAL SUMMARY: Sources of the ~258 gal Gap");
  console.log("===========================================================\n");

  const cat1 = (totalExclSBD + exclLossL) * G;
  const cat2 = orphanedL * G;
  const cat3 = trueDirectL * G;
  const cat4 = totalClampedL * G;
  const cat5 = exclXferLossL * G;

  console.log("  Category                                         Gallons");
  console.log("  ---------------------------------------------------------");
  console.log(`  1. Excl/dup batch SBD ending + losses:           ${cat1.toFixed(1)}`);
  console.log(`     Calvados Barrel Aged (184.7L SBD) is the main item.`);
  console.log(`     Production counted, ending/losses excluded.`);
  console.log(`  2. Orphaned press runs (no active batch):        ${cat2.toFixed(1)}`);
  console.log(`     Press 2025-11-25-04 (Mix for Salish - deleted).`);
  console.log(`     Juice counted in production but goes nowhere.`);
  console.log(`  3. Direct press -> non-HC (no batch_transfer):   ${cat3.toFixed(1)}`);
  console.log(`     Wine/pommeau batches created from press with`);
  console.log(`     initial_volume > xferIn. Not in transfersOut.`);
  console.log(`  4. SBD clamping (negligible):                    ${cat4.toFixed(1)}`);
  console.log(`  5. Excl/dup press transfer losses:               ${cat5.toFixed(1)}`);

  const total = cat1 + cat2 + cat3 + cat4 + cat5;
  console.log(`  ---------------------------------------------------------`);
  console.log(`  TOTAL EXPLAINED:                                 ${total.toFixed(1)} gal`);
  console.log(`  GAP TO EXPLAIN:                                  258.0 gal`);
  console.log(`  REMAINING UNEXPLAINED:                           ${(258.0 - total).toFixed(1)} gal`);

  if (258.0 - total > 20) {
    console.log(`\n  The remaining ${(258.0 - total).toFixed(0)} gal may come from:`);
    console.log("  - Date-range filtering differences (TTB form uses specific period dates)");
    console.log("  - Cross-class transfer amounts differing between this query (all time)");
    console.log("    and the TTB form (period-filtered). User sees 653.3 gal in Line 15,");
    console.log("    but all-time cross-class transfers = 699 gal (46 gal difference).");
    console.log("  - Rounding at L->gal conversion boundaries");
    console.log("  - The 133.5 gal 'per-batch losses' may use a different computation");
    console.log("    than the TTB form's aggregate loss queries (82.5 gal HC losses computed here)");
  }

  console.log("\n\n=== RECOMMENDED FIXES ===\n");
  console.log("  1. Add Line 15 or Line 20 entries for direct press->wine/pommeau volume");
  console.log("     that bypasses batch_transfer. These batches originate from press runs");
  console.log("     but have non-HC product_type with initial_volume from the press.");
  console.log("  2. Either delete orphaned press run 2025-11-25-04, or create a batch for it,");
  console.log("     or subtract its volume from production.");
  console.log("  3. Consider whether excl/dup batches should also exclude their production");
  console.log("     contribution (i.e., subtract their press run's juice from Line 2),");
  console.log("     or include their losses/ending in Lines 29/31.");

  console.log("\n=== INVESTIGATION COMPLETE ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
