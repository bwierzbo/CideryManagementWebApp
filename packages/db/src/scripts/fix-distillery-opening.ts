import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix the For Distillery batch to zero out the 26.7 gal Reconciliation Adj.
 *
 * The SBD-reconstructed opening (1147.7 gal) exceeds the configured physical
 * inventory opening (1121 gal) by 26.7 gal. The For Distillery batch was
 * retroactively created (Nov 2025) with an inflated initial (387L) plus a
 * +39.7L reconciliation adjustment. These were rough estimates.
 *
 * Fix:
 * 1. Soft-delete the +39.7L "Year-end reconciliation" adjustment (redundant).
 * 2. Set initial_volume_liters = 325.5 (from 387.0).
 *
 * Net reduction: 61.5L (init) + 39.7L (adj) = 101.2L = 26.7 gal.
 * New SBD opening = 1121.0 gal = configured opening → Reconciliation Adj = 0.
 */

const DISTILLERY_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";
const NEW_INIT = 325.5;

async function main() {
  console.log("=== Fix For Distillery Opening ===\n");

  // 1. Show before state
  const before = await db.execute(sql`
    SELECT id, custom_name,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           reconciliation_status
    FROM batches
    WHERE id = ${DISTILLERY_ID} AND deleted_at IS NULL
  `);
  const b = (before.rows as any[])[0];
  if (!b) {
    console.log("ERROR: For Distillery batch not found");
    process.exit(1);
  }
  console.log(`Batch: ${b.custom_name} [${DISTILLERY_ID.slice(0, 8)}]`);
  console.log(`  Before: init=${b.init_vol}L, current=${b.current_vol}L, status=${b.reconciliation_status}`);

  // 2. Show and soft-delete the +39.7L adjustment
  console.log("\n1. Soft-deleting reconciliation adjustment...");
  const adjResult = await db.execute(sql`
    UPDATE batch_volume_adjustments
    SET deleted_at = NOW()
    WHERE batch_id = ${DISTILLERY_ID}
      AND deleted_at IS NULL
      AND reason LIKE '%Year-end reconciliation%'
    RETURNING id, CAST(adjustment_amount AS TEXT) as amt, reason
  `);
  const adjRows = adjResult.rows as any[];
  if (adjRows.length > 0) {
    for (const a of adjRows) {
      console.log(`   Deleted: ${a.amt}L — "${a.reason}" [${a.id}]`);
    }
  } else {
    console.log("   No matching adjustment found (already deleted?)");
  }

  // 3. Update initial volume
  console.log(`\n2. Updating initial_volume_liters: ${b.init_vol} → ${NEW_INIT}...`);
  await db.execute(sql`
    UPDATE batches
    SET initial_volume_liters = ${NEW_INIT},
        updated_at = NOW()
    WHERE id = ${DISTILLERY_ID}
  `);

  // 4. Verify after state
  const after = await db.execute(sql`
    SELECT CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           reconciliation_status
    FROM batches
    WHERE id = ${DISTILLERY_ID}
  `);
  const a = (after.rows as any[])[0];
  console.log(`  After: init=${a.init_vol}L, current=${a.current_vol}L, status=${a.reconciliation_status}`);

  // 5. Verify no remaining active adjustments
  const remaining = await db.execute(sql`
    SELECT id, CAST(adjustment_amount AS TEXT) as amt, reason
    FROM batch_volume_adjustments
    WHERE batch_id = ${DISTILLERY_ID} AND deleted_at IS NULL
  `);
  console.log(`\n  Remaining active adjustments: ${(remaining.rows as any[]).length}`);
  for (const r of remaining.rows as any[]) {
    console.log(`    ${r.amt}L — "${r.reason}"`);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
