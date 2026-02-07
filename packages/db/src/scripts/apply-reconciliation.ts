/**
 * Apply Reconciliation Recommendations Script
 *
 * Task 1: Update 2025 batch reconciliation statuses based on rules:
 *   - verified: initial_volume > 0 AND product_type != 'brandy' AND status = 'pending'
 *   - duplicate: initial_volume = 0 (or NULL) AND received volume via transfers AND status = 'pending'
 *   - excluded: product_type = 'brandy' AND status = 'pending'
 *
 * Task 2: Analyze 2024 (and earlier) carryover batches with current_volume > 0
 */

import { db } from "../index.js";
import { sql } from "drizzle-orm";

function litersToGallons(liters: number): number {
  return liters * 0.264172;
}

function fmtVol(liters: number): string {
  return `${liters.toFixed(2)}L (${litersToGallons(liters).toFixed(1)}gal)`;
}

async function applyReconciliation() {
  console.log("=".repeat(80));
  console.log("  TASK 1: APPLY 2025 RECONCILIATION RECOMMENDATIONS");
  console.log("=".repeat(80));
  console.log("");

  // ---- STEP 1: Set verified for real production batches ----
  // Criteria: 2025 batch, not deleted, initial_volume > 0, not brandy, currently pending
  const verifiedResult = await db.execute(sql`
    UPDATE batches
    SET reconciliation_status = 'verified',
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND start_date >= '2025-01-01'
      AND start_date < '2026-01-01'
      AND reconciliation_status = 'pending'
      AND COALESCE(CAST(initial_volume_liters AS NUMERIC), 0) > 0
      AND COALESCE(product_type, 'cider') != 'brandy'
    RETURNING id, name, custom_name, batch_number, product_type,
              CAST(initial_volume_liters AS TEXT) as initial_volume_liters
  `);

  const verifiedRows = verifiedResult.rows as any[];
  console.log(`--- VERIFIED (${verifiedRows.length} batches) ---`);
  console.log("These are real production batches with initial volume > 0:\n");
  for (const row of verifiedRows) {
    const displayName = row.custom_name || row.batch_number;
    const initL = parseFloat(row.initial_volume_liters || "0");
    console.log(`  ${displayName.padEnd(45)} ${(row.product_type || "cider").padEnd(10)} ${fmtVol(initL).padEnd(25)} -> verified`);
  }
  console.log("");

  // ---- STEP 2: Set duplicate for transfer-destination batches ----
  // Criteria: 2025 batch, not deleted, initial_volume = 0 or NULL, received transfers, currently pending
  const duplicateResult = await db.execute(sql`
    UPDATE batches
    SET reconciliation_status = 'duplicate',
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND start_date >= '2025-01-01'
      AND start_date < '2026-01-01'
      AND reconciliation_status = 'pending'
      AND COALESCE(CAST(initial_volume_liters AS NUMERIC), 0) = 0
      AND EXISTS (
        SELECT 1 FROM batch_transfers bt
        WHERE bt.destination_batch_id = batches.id
          AND bt.deleted_at IS NULL
      )
    RETURNING id, name, custom_name, batch_number, product_type,
              CAST(initial_volume_liters AS TEXT) as initial_volume_liters,
              CAST(current_volume_liters AS TEXT) as current_volume_liters
  `);

  const duplicateRows = duplicateResult.rows as any[];
  console.log(`--- DUPLICATE (${duplicateRows.length} batches) ---`);
  console.log("These are transfer-destination batches (init vol = 0, received transfers):\n");
  for (const row of duplicateRows) {
    const displayName = row.custom_name || row.batch_number;
    const curL = parseFloat(row.current_volume_liters || "0");
    console.log(`  ${displayName.padEnd(45)} current: ${fmtVol(curL).padEnd(25)} -> duplicate`);
  }
  console.log("");

  // ---- STEP 3: Set excluded for brandy batches ----
  // Criteria: 2025 batch, not deleted, product_type = 'brandy', currently pending
  const excludedResult = await db.execute(sql`
    UPDATE batches
    SET reconciliation_status = 'excluded',
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND start_date >= '2025-01-01'
      AND start_date < '2026-01-01'
      AND reconciliation_status = 'pending'
      AND product_type = 'brandy'
    RETURNING id, name, custom_name, batch_number, product_type,
              CAST(initial_volume_liters AS TEXT) as initial_volume_liters
  `);

  const excludedRows = excludedResult.rows as any[];
  console.log(`--- EXCLUDED (${excludedRows.length} batches) ---`);
  console.log("Brandy batches - tracked in spirits section:\n");
  for (const row of excludedRows) {
    const displayName = row.custom_name || row.batch_number;
    const initL = parseFloat(row.initial_volume_liters || "0");
    console.log(`  ${displayName.padEnd(45)} ${fmtVol(initL).padEnd(25)} -> excluded`);
  }
  console.log("");

  // ---- Check for any remaining pending 2025 batches ----
  const remainingResult = await db.execute(sql`
    SELECT
      id, name, custom_name, batch_number, product_type, status,
      CAST(initial_volume_liters AS TEXT) as initial_volume_liters,
      CAST(current_volume_liters AS TEXT) as current_volume_liters,
      reconciliation_status, is_racking_derivative, parent_batch_id
    FROM batches
    WHERE deleted_at IS NULL
      AND start_date >= '2025-01-01'
      AND start_date < '2026-01-01'
      AND reconciliation_status = 'pending'
    ORDER BY batch_number
  `);

  const remainingRows = remainingResult.rows as any[];
  if (remainingRows.length > 0) {
    console.log(`--- STILL PENDING (${remainingRows.length} batches) ---`);
    console.log("These did not match any rule and remain pending:\n");
    for (const row of remainingRows) {
      const displayName = row.custom_name || row.batch_number;
      const initL = parseFloat(row.initial_volume_liters || "0");
      const curL = parseFloat(row.current_volume_liters || "0");
      console.log(`  ${displayName.padEnd(45)} type=${(row.product_type || "null").padEnd(10)} init=${fmtVol(initL).padEnd(20)} cur=${fmtVol(curL).padEnd(20)} status=${row.status}`);
      if (row.is_racking_derivative) console.log(`    ^ is_racking_derivative=true`);
      if (row.parent_batch_id) console.log(`    ^ has parent_batch_id`);
    }
    console.log("");
  }

  // Summary for Task 1
  console.log("=".repeat(80));
  console.log("  TASK 1 SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Verified:  ${verifiedRows.length} batches`);
  console.log(`  Duplicate: ${duplicateRows.length} batches`);
  console.log(`  Excluded:  ${excludedRows.length} batches`);
  console.log(`  Remaining: ${remainingRows.length} batches still pending`);
  console.log(`  Total updated: ${verifiedRows.length + duplicateRows.length + excludedRows.length}`);
  console.log("");

  // =========================================================================
  // TASK 2: Analyze 2024 (and earlier) carryover batches
  // =========================================================================
  console.log("=".repeat(80));
  console.log("  TASK 2: 2024 AND EARLIER CARRYOVER BATCHES");
  console.log("=".repeat(80));
  console.log("");

  const carryoverResult = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.batch_number,
      b.product_type,
      b.status,
      CAST(b.current_volume_liters AS TEXT) as current_volume_liters,
      b.reconciliation_status,
      v.name as vessel_name,
      b.start_date
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NULL
      AND b.start_date < '2025-01-01'
      AND COALESCE(CAST(b.current_volume_liters AS NUMERIC), 0) > 0
    ORDER BY b.start_date, b.batch_number
  `);

  const carryoverRows = carryoverResult.rows as any[];
  console.log(`Found ${carryoverRows.length} carryover batches from 2024 and earlier with current volume > 0:\n`);

  let needsVerification = 0;
  let totalCarryoverVolume = 0;
  let pendingVolume = 0;

  for (const row of carryoverRows) {
    const displayName = row.custom_name || row.batch_number;
    const curL = parseFloat(row.current_volume_liters || "0");
    const isPending = row.reconciliation_status === "pending";
    totalCarryoverVolume += curL;

    if (isPending) {
      needsVerification++;
      pendingVolume += curL;
    }

    const startDateStr = row.start_date
      ? new Date(row.start_date).toISOString().split("T")[0]
      : "?";

    console.log(`  ${displayName.padEnd(45)} ${(row.product_type || "?").padEnd(10)} ${fmtVol(curL).padEnd(25)} recon=${(row.reconciliation_status || "null").padEnd(10)} vessel=${row.vessel_name || "none"}`);
    console.log(`    start=${startDateStr}  status=${row.status}${isPending ? "  ** NEEDS VERIFICATION **" : ""}`);
  }

  console.log("");
  console.log("=".repeat(80));
  console.log("  TASK 2 SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Total carryover batches (pre-2025 with volume > 0): ${carryoverRows.length}`);
  console.log(`  Total carryover volume: ${fmtVol(totalCarryoverVolume)}`);
  console.log(`  Batches needing verification (status = pending): ${needsVerification}`);
  console.log(`  Volume in pending batches: ${fmtVol(pendingVolume)}`);
  console.log("");

  process.exit(0);
}

applyReconciliation().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});
