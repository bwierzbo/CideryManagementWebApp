import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Find all batches that exist in the system for 2025 but are NOT part of
 * the 60-batch reconciliation list. Show why each is excluded.
 */

const YEAR_END = "2025-12-31";

async function main() {
  console.log("=== Batches Excluded from Reconciliation List ===\n");

  // Get ALL non-deleted batches that started on or before 2025-12-31
  const allBatches = await db.execute(sql`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
           b.start_date, b.is_racking_derivative, b.parent_batch_id,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           CAST(b.current_volume_liters AS TEXT) as current_vol,
           b.reconciliation_status, b.status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.start_date::date <= ${YEAR_END}::date
    ORDER BY b.start_date, b.custom_name
  `);
  const rows = allBatches.rows as any[];
  console.log(`Total non-deleted batches (started <= ${YEAR_END}): ${rows.length}\n`);

  // Apply the same exclusion logic as listForReconciliation
  const mainList: any[] = [];
  const excluded: any[] = [];

  for (const b of rows) {
    const productType = b.product_type || "cider";
    const isRacking = b.is_racking_derivative === true;
    const isTransferDerived = b.parent_batch_id && parseFloat(b.init_vol) === 0 && productType !== "pommeau";
    const isBrandyOrJuice = ["brandy", "juice"].includes(productType);

    let reason = "";
    if (isBrandyOrJuice) reason = `product_type = '${productType}'`;
    else if (isRacking) reason = "isRackingDerivative = true";
    else if (isTransferDerived) reason = "transfer-derived (parent + init=0)";

    if (reason) {
      excluded.push({ ...b, reason });
    } else {
      mainList.push(b);
    }
  }

  console.log(`Main list (visible on page): ${mainList.length}`);
  console.log(`Excluded from list: ${excluded.length}\n`);

  // Group excluded by reason
  const byReason = new Map<string, any[]>();
  for (const b of excluded) {
    const list = byReason.get(b.reason) || [];
    list.push(b);
    byReason.set(b.reason, list);
  }

  for (const [reason, batches] of byReason) {
    console.log(`\n--- ${reason} (${batches.length} batches) ---`);
    let totalInit = 0;
    let totalCurrent = 0;
    for (const b of batches) {
      const init = parseFloat(b.init_vol) || 0;
      const current = parseFloat(b.current_vol) || 0;
      totalInit += init;
      totalCurrent += current;
      const parentNote = b.parent_batch_id ? ` (parent: ${b.parent_batch_id.slice(0, 8)})` : "";
      console.log(`  ${b.custom_name || b.batch_number} | type=${b.product_type || "null"} | init=${init}L | current=${current}L | recon=${b.reconciliation_status} | started=${b.start_date?.toISOString?.().slice(0, 10) || b.start_date}${parentNote}`);
    }
    console.log(`  TOTALS: init=${totalInit.toFixed(1)}L, current=${totalCurrent.toFixed(1)}L`);
  }

  // Check if excluded batches are in the SBD computation
  console.log("\n\n--- Are excluded batches in the SBD computation? ---");
  const sbdEligible = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM batches b
    WHERE b.deleted_at IS NULL
      AND (
        COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative IS TRUE
        OR b.parent_batch_id IS NOT NULL
      )
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= ${YEAR_END}::date
  `);
  console.log(`SBD-eligible batches: ${(sbdEligible.rows as any[])[0].cnt}`);

  // Find batches that are excluded from BOTH the list AND the SBD
  const sbdExcluded = [];
  for (const b of excluded) {
    const productType = b.product_type || "cider";
    const reconStatus = b.reconciliation_status || "pending";
    const isRacking = b.is_racking_derivative === true;
    const hasParent = !!b.parent_batch_id;

    // SBD excludes: juice, and duplicate/excluded without racking/parent
    const sbdIncluded = productType !== "juice" &&
      (reconStatus !== "duplicate" && reconStatus !== "excluded" || isRacking || hasParent);

    if (!sbdIncluded) {
      sbdExcluded.push(b);
    }
  }

  if (sbdExcluded.length > 0) {
    console.log(`\nBatches excluded from BOTH list AND SBD computation:`);
    for (const b of sbdExcluded) {
      console.log(`  ${b.custom_name || b.batch_number} | type=${b.product_type} | init=${b.init_vol}L | current=${b.current_vol}L | reason=${b.reason}`);
    }
  } else {
    console.log(`\nAll excluded batches are still included in the SBD computation ✓`);
  }

  // Also check: soft-deleted batches that had activity in 2025
  console.log("\n\n--- Soft-deleted batches (for awareness) ---");
  const deleted = await db.execute(sql`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           CAST(b.current_volume_liters AS TEXT) as current_vol,
           b.deleted_at
    FROM batches b
    WHERE b.deleted_at IS NOT NULL
    ORDER BY b.deleted_at
  `);
  const delRows = deleted.rows as any[];
  if (delRows.length > 0) {
    console.log(`${delRows.length} soft-deleted batch(es):`);
    for (const b of delRows) {
      console.log(`  ${b.custom_name || b.batch_number} | type=${b.product_type} | init=${b.init_vol}L | deleted=${b.deleted_at}`);
    }
  } else {
    console.log("No soft-deleted batches.");
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
