import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Investigate the 26.7 gal gap between SBD opening and configured opening (1121 gal).
 * Lists all carried-forward batches with their SBD-reconstructed opening at 2024-12-31,
 * grouped by tax class, sorted by contribution descending.
 */

const G = (l: number) => (l / 3.78541).toFixed(2);
const num = (v: any) => parseFloat(v || "0") || 0;

const OPENING_DATE = "2025-01-01"; // SBD cutoff: operations before this date

async function main() {
  // Get all eligible batches (same filter as ttb.ts computeReconciliationFromBatches)
  const batches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
           b.start_date, b.parent_batch_id, b.is_racking_derivative,
           CAST(b.initial_volume_liters AS float) as init_l,
           CAST(b.current_volume_liters AS float) as current_l,
           b.reconciliation_status
    FROM batches b
    -- Note: tax_class column doesn't exist, we derive from product_type
    WHERE b.deleted_at IS NULL
      AND b.product_type != 'juice'
      AND b.start_date <= '2024-12-31'
      AND (
        b.reconciliation_status NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative = true
        OR b.parent_batch_id IS NOT NULL
      )
    ORDER BY b.product_type, b.start_date
  `));

  const rows = batches.rows as any[];
  console.log(`Found ${rows.length} eligible carried-forward batches\n`);

  type BatchResult = {
    id: string;
    name: string;
    productType: string;
    initL: number;
    effectiveInit: number;
    sbdOpening: number;
    currentL: number;
    drift: number;
    isTC: boolean;
  };

  const results: BatchResult[] = [];

  for (const b of rows) {
    const batchId = b.id;
    const initL = num(b.init_l);

    // Check isTransferCreated (same logic as ttb.ts ~line 1052)
    const tiAll = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as total
      FROM batch_transfers
      WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL
    `));
    const totalTiAll = num((tiAll.rows as any[])[0].total);
    const isTC = !!(b.parent_batch_id && totalTiAll >= initL * 0.9);
    const effectiveInit = isTC ? 0 : initL;

    // SBD at opening date: effectiveInit + all operations before 2025-01-01
    const tiPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol
      FROM batch_transfers
      WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL
        AND transferred_at < '${OPENING_DATE}'
    `));
    const toPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol,
             COALESCE(SUM(CAST(COALESCE(loss, '0') AS float)), 0) as loss
      FROM batch_transfers
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND transferred_at < '${OPENING_DATE}'
    `));
    const miPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
      FROM batch_merge_history
      WHERE target_batch_id = '${batchId}' AND deleted_at IS NULL
        AND merged_at < '${OPENING_DATE}'
    `));
    const adjPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(adjustment_amount AS float)), 0) as vol
      FROM batch_volume_adjustments
      WHERE batch_id = '${batchId}' AND deleted_at IS NULL
        AND adjustment_date < '${OPENING_DATE}'
    `));
    const btlPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_taken_liters AS float)), 0) as vol
      FROM bottle_runs
      WHERE batch_id = '${batchId}' AND voided_at IS NULL
        AND packaged_at < '${OPENING_DATE}'
    `));
    const kegPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_taken AS float)), 0) as vol
      FROM keg_fills
      WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL
        AND filled_at < '${OPENING_DATE}'
    `));
    // mergesOut (where this batch was source)
    const moPre = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
      FROM batch_merge_history
      WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
        AND merged_at < '${OPENING_DATE}'
    `));

    const ti = num((tiPre.rows as any[])[0].vol);
    const to = num((toPre.rows as any[])[0].vol);
    const toLoss = num((toPre.rows as any[])[0].loss);
    const mi = num((miPre.rows as any[])[0].vol);
    const adj = num((adjPre.rows as any[])[0].vol);
    const btl = num((btlPre.rows as any[])[0].vol);
    const keg = num((kegPre.rows as any[])[0].vol);
    const mo = num((moPre.rows as any[])[0].vol);

    const raw = effectiveInit + ti - to - toLoss + mi + adj - btl - keg - mo;
    const sbdOpening = Math.max(0, raw);

    results.push({
      id: batchId.slice(0, 8),
      name: b.custom_name || b.batch_number,
      productType: b.product_type,
      initL,
      effectiveInit,
      sbdOpening,
      currentL: num(b.current_l),
      drift: sbdOpening - num(b.current_l),
      isTC,
    });
  }

  // Group by tax class mapping
  const taxClassMap: Record<string, string> = {
    cider: "hardCider",
    perry: "hardCider",
    pommeau: "wine16To21",
    wine: "wineUnder16",
    brandy: "appleBrandy",
    spirit: "grapeSpirits",
  };

  const byClass: Record<string, { batches: BatchResult[]; total: number }> = {};
  for (const r of results) {
    const tc = taxClassMap[r.productType] || r.productType;
    if (!byClass[tc]) byClass[tc] = { batches: [], total: 0 };
    byClass[tc].batches.push(r);
    byClass[tc].total += r.sbdOpening;
  }

  // Print summary
  console.log("=== SBD OPENING BY TAX CLASS (gal) ===");
  const configured: Record<string, number> = {
    hardCider: 1061,
    wine16To21: 60,
    wineUnder16: 0,
    appleBrandy: 0,
    grapeSpirits: 0,
  };

  let totalSBD = 0;
  let totalConfigured = 0;

  for (const [tc, data] of Object.entries(byClass).sort()) {
    const gal = parseFloat(G(data.total));
    const conf = configured[tc] || 0;
    const delta = gal - conf;
    totalSBD += gal;
    totalConfigured += conf;
    console.log(
      `  ${tc}: SBD=${gal} gal, configured=${conf} gal, delta=${delta > 0 ? "+" : ""}${delta.toFixed(1)} gal (${data.batches.length} batches)`,
    );
  }

  console.log(
    `\n  TOTAL: SBD=${totalSBD.toFixed(1)} gal, configured=${totalConfigured} gal, gap=${(totalSBD - totalConfigured).toFixed(1)} gal`,
  );

  // Print top contributors per class
  for (const [tc, data] of Object.entries(byClass).sort()) {
    const conf = configured[tc] || 0;
    const gal = parseFloat(G(data.total));
    if (Math.abs(gal - conf) < 1) continue;

    console.log(`\n=== ${tc} BATCH DETAILS (delta=${(gal - conf).toFixed(1)} gal) ===`);
    const sorted = data.batches
      .filter((b) => b.sbdOpening > 0)
      .sort((a, b) => b.sbdOpening - a.sbdOpening);

    for (const b of sorted) {
      const flag = b.isTC ? " [TC]" : "";
      const driftStr = Math.abs(b.drift) > 0.5 ? ` drift=${G(b.drift)}g` : "";
      console.log(
        `  ${b.id} ${b.name.slice(0, 40).padEnd(40)} init=${b.initL.toFixed(1)}L effInit=${b.effectiveInit.toFixed(1)}L sbd=${G(b.sbdOpening)}g current=${G(b.currentL)}g${driftStr}${flag}`,
      );
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
