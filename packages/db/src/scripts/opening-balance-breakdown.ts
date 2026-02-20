import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OPENING_DATE = "2024-12-31";
const PERIOD_END = "2025-12-31";
const L_PER_GAL = 3.78541;

const num = (v: any) => parseFloat(v || "0") || 0;

async function main() {
  // 1. Get all eligible batches that started on or before the opening date (carried forward)
  const batches = await pool.query(`
    SELECT b.id, b.name, b.product_type, b.batch_number,
           CAST(b.initial_volume_liters AS float) as init_l,
           CAST(b.current_volume_liters AS float) as cur_l,
           b.parent_batch_id, b.start_date,
           b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= '${OPENING_DATE}'::date
    ORDER BY b.start_date, b.name
  `);

  console.log(`Found ${batches.rowCount} carried-forward batches\n`);

  // For each batch, reconstruct its volume at the opening date
  // This mirrors the computeReconciliationFromBatches logic
  const results: Array<{
    id: string;
    name: string;
    productType: string;
    taxClass: string;
    openingL: number;
    openingGal: number;
  }> = [];

  for (const b of batches.rows) {
    const batchId = b.id;
    const initL = num(b.initial_volume_liters || b.init_l);

    // Check if transfer-created
    const transfersIn = await pool.query(`
      SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as total
      FROM batch_transfers
      WHERE destination_batch_id = $1 AND deleted_at IS NULL
    `, [batchId]);
    const totalTransfersIn = num(transfersIn.rows[0].total);
    const isTransferCreated = !!(b.parent_batch_id && totalTransfersIn >= initL * 0.9);
    const effectiveInitialL = isTransferCreated ? 0 : initL;

    // All operations BEFORE or ON the opening date
    const [tOut, tIn, mergesIn, mergesOut, bottles, kegs, dist, adjs, racks, filters] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as total,
                         COALESCE(SUM(CAST(loss AS float)), 0) as loss_total
                  FROM batch_transfers WHERE source_batch_id = $1 AND deleted_at IS NULL
                    AND transferred_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as total
                  FROM batch_transfers WHERE destination_batch_id = $1 AND deleted_at IS NULL
                    AND transferred_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as total
                  FROM batch_merge_history WHERE target_batch_id = $1 AND deleted_at IS NULL
                    AND merged_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as total
                  FROM batch_merge_history WHERE source_batch_id = $1 AND deleted_at IS NULL
                    AND merged_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`
        SELECT volume_taken_liters, loss, units_produced, package_size_ml
        FROM bottle_runs WHERE batch_id = $1 AND voided_at IS NULL
          AND packaged_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(volume_taken AS float) + CAST(COALESCE(loss, '0') AS float)), 0) as total
                  FROM keg_fills WHERE batch_id = $1 AND voided_at IS NULL AND deleted_at IS NULL
                    AND filled_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(source_volume_liters AS float)), 0) as total
                  FROM distillation_records WHERE source_batch_id = $1 AND deleted_at IS NULL
                    AND status IN ('sent', 'received') AND sent_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(adjustment_amount AS float)), 0) as total
                  FROM batch_volume_adjustments WHERE batch_id = $1 AND deleted_at IS NULL
                    AND adjustment_date::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(volume_loss AS float)), 0) as total
                  FROM batch_racking_operations WHERE batch_id = $1 AND deleted_at IS NULL
                    AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
                    AND racked_at::date <= $2::date`, [batchId, OPENING_DATE]),
      pool.query(`SELECT COALESCE(SUM(CAST(volume_loss AS float)), 0) as total
                  FROM batch_filter_operations WHERE batch_id = $1 AND deleted_at IS NULL
                    AND filtered_at::date <= $2::date`, [batchId, OPENING_DATE]),
    ]);

    // Compute bottling taken (same logic as computeReconciliationFromBatches)
    let bottlingTakenL = 0;
    for (const br of bottles.rows) {
      const volumeTaken = num(br.volume_taken_liters);
      const lossVal = num(br.loss);
      const productVolume = (num(br.units_produced) * num(br.package_size_ml)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVolume + lossVal)) < 2;
      bottlingTakenL += volumeTaken + (lossIncluded ? 0 : lossVal);
    }

    // Check for racking-received (child batch from parent's racking)
    let rackingReceivedL = 0;
    if (b.parent_batch_id && initL === 0) {
      const parentRack = await pool.query(`
        SELECT volume_after FROM batch_racking_operations
        WHERE batch_id = $1 AND deleted_at IS NULL
          AND source_vessel_id != destination_vessel_id
        ORDER BY racked_at LIMIT 1
      `, [b.parent_batch_id]);
      if (parentRack.rows.length > 0) {
        rackingReceivedL = num(parentRack.rows[0].volume_after);
      }
    }

    // Check for child-creation outflows
    const childOutflows = await pool.query(`
      SELECT COALESCE(SUM(CAST(ro.volume_after AS float)), 0) as total
      FROM batch_racking_operations ro
      JOIN batches child ON child.parent_batch_id = $1
        AND child.initial_volume_liters = '0'
        AND child.start_date::date <= $2::date
      WHERE ro.batch_id = $1 AND ro.deleted_at IS NULL
        AND ro.source_vessel_id != ro.destination_vessel_id
        AND ro.racked_at::date <= $2::date
    `, [batchId, OPENING_DATE]);
    const childOutL = num(childOutflows.rows[0]?.total);

    const openingL = effectiveInitialL + rackingReceivedL
      + num(mergesIn.rows[0].total) + num(tIn.rows[0].total)
      - num(tOut.rows[0].total) - num(tOut.rows[0].loss_total)
      - bottlingTakenL - num(kegs.rows[0].total)
      - num(dist.rows[0].total) + num(adjs.rows[0].total)
      - num(racks.rows[0].total) - num(mergesOut.rows[0].total) - childOutL
      - num(filters.rows[0].total);

    const openingClampedL = Math.max(0, openingL);
    const openingGal = openingClampedL / L_PER_GAL;

    // Determine tax class
    const pt = b.product_type || "cider";
    let taxClass = "hardCider";
    if (pt === "wine") taxClass = "wineUnder16";
    else if (pt === "pommeau") taxClass = "wine16To21";
    else if (pt === "perry") taxClass = "hardCider"; // perry is hard cider for TTB
    else if (pt === "brandy") taxClass = "appleBrandy";

    results.push({
      id: batchId,
      name: b.name,
      productType: pt,
      taxClass,
      openingL: openingClampedL,
      openingGal,
    });
  }

  // Summary by tax class
  const byClass: Record<string, { count: number; totalL: number; totalGal: number; batches: typeof results }> = {};
  for (const r of results) {
    if (!byClass[r.taxClass]) byClass[r.taxClass] = { count: 0, totalL: 0, totalGal: 0, batches: [] };
    byClass[r.taxClass].count++;
    byClass[r.taxClass].totalL += r.openingL;
    byClass[r.taxClass].totalGal += r.openingGal;
    byClass[r.taxClass].batches.push(r);
  }

  console.log("=== Carried-Forward Batches Opening at", OPENING_DATE, "===\n");
  let grandTotalGal = 0;
  for (const [cls, data] of Object.entries(byClass).sort((a, b) => b[1].totalGal - a[1].totalGal)) {
    console.log(`${cls}: ${data.count} batches, ${data.totalGal.toFixed(1)} gal (${data.totalL.toFixed(1)} L)`);
    for (const b of data.batches.sort((a, b) => b.openingGal - a.openingGal)) {
      if (b.openingGal > 0.01) {
        console.log(`  ${b.openingGal.toFixed(2)} gal  ${b.name} (${b.productType})`);
      }
    }
    grandTotalGal += data.totalGal;
  }

  console.log(`\nGrand Total: ${grandTotalGal.toFixed(1)} gal`);
  console.log(`Target:      1121.0 gal`);
  console.log(`Gap:         ${(1121.0 - grandTotalGal).toFixed(1)} gal`);

  // Target breakdown
  console.log("\n=== Target vs Current ===");
  const targets: Record<string, number> = { hardCider: 1061, wine16To21: 60 };
  for (const [cls, target] of Object.entries(targets)) {
    const current = byClass[cls]?.totalGal || 0;
    console.log(`${cls}: current=${current.toFixed(1)} gal, target=${target} gal, delta=${(target - current).toFixed(1)} gal`);
  }

  await pool.end();
}

main().catch(console.error);
