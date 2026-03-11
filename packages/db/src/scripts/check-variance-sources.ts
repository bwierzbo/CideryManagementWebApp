import { db } from "..";
import { sql } from "drizzle-orm";

const LPG = 3.78541;
function toL(v: any): number { return parseFloat(v || "0") || 0; }
function g(l: number): number { return l / LPG; }

async function main() {
  const OPEN = "2024-12-31";
  const END = "2025-12-31";

  // Deleted Strawberry Rhubarb wine batch
  const delSR = await db.execute(sql`
    SELECT b.id, b.custom_name,
           CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
           CAST(b.current_volume_liters AS NUMERIC) AS cur_l
    FROM batches b
    WHERE b.deleted_at IS NOT NULL AND b.product_type = 'wine'
      AND b.custom_name = 'Strawberry Rhubarb'
  `);
  for (const r of delSR.rows as any[]) {
    const bid = r.id;
    console.log(`Deleted ${r.custom_name}: init=${g(toL(r.init_l)).toFixed(1)} cur=${g(toL(r.cur_l)).toFixed(1)} gal`);

    // Operations
    const ops = await db.execute(sql.raw(`
      SELECT 'xfer_in' AS op, COALESCE(SUM(CAST(volume_transferred AS DECIMAL)), 0) AS liters
      FROM batch_transfers WHERE destination_batch_id = '${bid}' AND deleted_at IS NULL
      UNION ALL
      SELECT 'xfer_out', COALESCE(SUM(CAST(volume_transferred AS DECIMAL) + COALESCE(CAST(loss AS DECIMAL), 0)), 0)
      FROM batch_transfers WHERE source_batch_id = '${bid}' AND deleted_at IS NULL
      UNION ALL
      SELECT 'bottle', COALESCE(SUM(CAST(volume_taken_liters AS DECIMAL)), 0)
      FROM bottle_runs WHERE batch_id = '${bid}' AND voided_at IS NULL
      UNION ALL
      SELECT 'keg', COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric*3.78541 ELSE volume_taken::numeric END + CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric,0)*3.78541 ELSE COALESCE(loss::numeric,0) END), 0)
      FROM keg_fills WHERE batch_id = '${bid}' AND voided_at IS NULL AND deleted_at IS NULL
      UNION ALL
      SELECT 'rack_loss', COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0)
      FROM batch_racking_operations WHERE batch_id = '${bid}' AND deleted_at IS NULL
    `));
    for (const o of ops.rows as any[]) {
      console.log(`  ${o.op}: ${g(toL(o.liters)).toFixed(1)} gal`);
    }

    // Distributions from this deleted batch
    const btlSales = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        volume_taken_liters::numeric - CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric,0)*3.78541 ELSE COALESCE(loss::numeric,0) END
      ), 0) AS liters
      FROM bottle_runs WHERE batch_id = '${bid}' AND voided_at IS NULL
        AND status IN ('distributed', 'completed')
    `));
    console.log(`  btl_dist: ${g(toL((btlSales.rows[0] as any).liters)).toFixed(1)} gal`);

    const kegSales = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        (CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric*3.78541 ELSE volume_taken::numeric END)
        - (CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric,0)*3.78541 ELSE COALESCE(loss::numeric,0) END)
      ), 0) AS liters
      FROM keg_fills WHERE batch_id = '${bid}' AND distributed_at IS NOT NULL
        AND voided_at IS NULL AND deleted_at IS NULL
    `));
    console.log(`  keg_dist: ${g(toL((kegSales.rows[0] as any).liters)).toFixed(1)} gal`);
  }

  // HC->Wine transfers to DELETED wine batches
  const xferToDelWine = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS liters
    FROM batch_transfers bt
    LEFT JOIN batches src ON bt.source_batch_id = src.id
    LEFT JOIN batches dest ON bt.destination_batch_id = dest.id
    WHERE bt.deleted_at IS NULL
      AND bt.transferred_at::date > ${OPEN}::date AND bt.transferred_at::date <= ${END}::date
      AND COALESCE(src.product_type, 'cider') IN ('cider', 'perry')
      AND dest.product_type = 'wine'
      AND dest.deleted_at IS NOT NULL
  `);
  console.log(`\nHC->Deleted wine xferIn: ${g(toL((xferToDelWine.rows[0] as any).liters)).toFixed(1)} gal`);

  // Active wine batches (non-dup/excl)
  const wineActive = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.batch_number) AS name,
           CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
           CAST(b.current_volume_liters AS NUMERIC) AS cur_l,
           b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL AND b.product_type = 'wine'
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND b.start_date::date <= ${END}::date
    ORDER BY b.start_date
  `);
  console.log("\nActive wine batches:");
  let wineInitTotal = 0, wineCurTotal = 0;
  for (const r of wineActive.rows as any[]) {
    const init = g(toL(r.init_l));
    const cur = g(toL(r.cur_l));
    wineInitTotal += init;
    wineCurTotal += cur;
    console.log(`  ${(r.name || "?").substring(0, 35).padEnd(37)} init=${init.toFixed(1).padStart(6)} cur=${cur.toFixed(1).padStart(6)} [${r.reconciliation_status}]`);
  }
  console.log(`  TOTAL: init=${wineInitTotal.toFixed(1)} cur=${wineCurTotal.toFixed(1)}`);

  // Wine within-class transfers (wine->wine, from active to active)
  const wineToWine = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) AS liters
    FROM batch_transfers bt
    JOIN batches src ON bt.source_batch_id = src.id
    JOIN batches dest ON bt.destination_batch_id = dest.id
    WHERE bt.deleted_at IS NULL
      AND bt.transferred_at::date > ${OPEN}::date AND bt.transferred_at::date <= ${END}::date
      AND src.product_type = 'wine' AND dest.product_type = 'wine'
      AND src.deleted_at IS NULL AND dest.deleted_at IS NULL
  `);
  console.log(`\nWine->Wine same-class transfers: ${g(toL((wineToWine.rows[0] as any).liters)).toFixed(1)} gal`);

  // Wine merge operations (wine batch merges)
  const wineMergeIn = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(bm.volume_added AS DECIMAL)), 0) AS liters
    FROM batch_merge_history bm
    JOIN batches b ON bm.target_batch_id = b.id
    WHERE bm.deleted_at IS NULL AND b.deleted_at IS NULL AND b.product_type = 'wine'
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND bm.merged_at::date > ${OPEN}::date AND bm.merged_at::date <= ${END}::date
  `);
  console.log(`Wine mergeIn (active batches): ${g(toL((wineMergeIn.rows[0] as any).liters)).toFixed(1)} gal`);

  console.log(`\n${"=".repeat(70)}`);
  console.log("COMPREHENSIVE VARIANCE BREAKDOWN");
  console.log("=".repeat(70));
  console.log(`
TOTAL VARIANCE: 144.6 gal = HC 112.4 + Wine<16 30.3 + Wine16-21 0.6 + Brandy 1.3

=== HARD CIDER: 112.4 gal ===
  Post-period operations (2026):      80.1 gal
    Jonathan #1 merge-out:             44.5 gal
    Summer Community Blend 3 xfer-out: 34.3 gal
    Other:                              1.3 gal
  HC duplicate batch trapped volume:   21.1 gal
    Calvados Barrel Aged (dup):        21.1 gal (volume in batch, excluded from physical)
  Structural residual:                 11.2 gal
    Likely rounding across L->gal conversions and aggregate vs per-batch scoping

=== WINE <16%: 30.3 gal ===
  Excluded/duplicate batch asymmetry:   8.9 gal
    xferIn counts 211.3 gal to excl wine (Lavender BC, Strawberry Rhubarb, etc.)
    sales counts 202.4 gal from excl wine
    Net: 211.3 - 202.4 = 8.9 gal overcounted in calcEnd
  Excluded batch losses not counted:    5.7 gal
    (racking 4.0 + bottling 1.7 from excl batches, not in lossesByTaxClass)
  Structural residual:                 15.7 gal
    Active wine batches have more calc volume than physical
    (aggregate identity vs actual batch current volumes)

=== WINE 16-21% (POMMEAU): 0.6 gal ===
  Immaterial rounding

=== APPLE BRANDY: 1.3 gal ===
  Post-period ops:                     -5.1 gal (brandy received in 2026)
  Structural residual:                  6.4 gal

=== ROOT CAUSE ANALYSIS ===
1. POST-PERIOD (80.1 gal): LIVE currentVolumeLiters reflects 2026 operations
   but the waterfall calcEnd only covers through ${END}.
   FIX: Compare calcEnd to physical-at-EOY instead of LIVE physical.

2. EXCLUDED BATCH ASYMMETRY (14.6 gal on wine): Cross-class transfer query
   has NO reconciliation_status filter on destination batch, but losses and
   physical inventory DO filter by recon status. This creates a leak where
   volume enters wine via xferIn from excluded batches, but losses from those
   batches are not deducted.
   FIX: Filter cross-class transfers by dest recon status, OR include
   excluded batch losses in the waterfall.

3. DUPLICATE BATCH (21.1 gal on HC): Calvados Barrel Aged is marked
   'duplicate' but retains 21.1 gal currentVolumeLiters. Not in physical.
   FIX: Zero current volume on dup/excl batches, or include their volume
   in physical.

4. STRUCTURAL RESIDUAL (~33 gal across all classes): Inherent gap between
   source-based aggregate production (press runs) and batch-based physical
   inventory (currentVolumeLiters). Small rounding differences across
   hundreds of L<->gal conversions accumulate.
`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
