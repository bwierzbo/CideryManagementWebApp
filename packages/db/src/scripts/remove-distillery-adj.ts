import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Remove the "TTB opening balance reconciliation" adjustment on For Distillery batch.
 *
 * This adjustment was created to force the 2024 SBD ending to exactly 1121 gal,
 * but it's no longer needed now that the dup/excluded batch filter correctly
 * removes ~54 gal of duplicate/excluded batch volume from the waterfall.
 *
 * The -18.9L adjustment creates:
 * - Volume trace discrepancy: batch expects -18.9L (negative!) but has 0.0L
 * - Drift error: -4.99 gal on the reconciliation card
 *
 * Without this adjustment, the 2024 ending rises ~5 gal (from 1121 to ~1126),
 * which is within normal SBD reconstruction variance and absorbed by reconAdj.
 */

const DISTILLERY_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";

async function main() {
  console.log("=== Remove For Distillery TTB Adjustment ===\n");

  // Find the adjustment
  const existing = await db.execute(sql`
    SELECT id, CAST(adjustment_amount AS TEXT) as amt, reason, adjustment_date
    FROM batch_volume_adjustments
    WHERE batch_id = ${DISTILLERY_ID}
      AND deleted_at IS NULL
      AND reason LIKE '%TTB opening balance reconciliation%'
  `);

  if (existing.rows.length === 0) {
    console.log("No TTB opening balance reconciliation adjustment found. Nothing to do.");
    process.exit(0);
  }

  for (const row of existing.rows as any[]) {
    console.log(`Found: ${row.amt}L on ${row.adjustment_date} — "${row.reason}" [${row.id}]`);
  }

  // Soft-delete
  const result = await db.execute(sql`
    UPDATE batch_volume_adjustments
    SET deleted_at = NOW()
    WHERE batch_id = ${DISTILLERY_ID}
      AND deleted_at IS NULL
      AND reason LIKE '%TTB opening balance reconciliation%'
    RETURNING id
  `);

  console.log(`\nSoft-deleted ${result.rows.length} adjustment(s).`);
  console.log("The For Distillery batch will now show 0 discrepancy in volume trace.");
  console.log("2024 ending will increase by ~5 gal (absorbed by reconAdj).");

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
