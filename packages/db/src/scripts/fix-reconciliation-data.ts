import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix reconciliation data issues found during Feb 2026 TTB reconciliation review:
 *
 * 1. Delete stale waterfall adjustment (-9.6 gal opening correction for 2025).
 *    This is now computed dynamically via openingDelta in the client waterfall code.
 *    Keeping the DB adjustment would double-correct.
 *
 * 2. Reset 8 "Base Cider" children from 'duplicate' to 'pending' and clear isRackingDerivative.
 *    These are real unique wine batches (Strawberry Rhubarb, Raspberry Blackberry, etc.)
 *    with initialVolumeLiters = 120.0 — they were incorrectly bulk-marked as duplicates.
 *
 * 3. Reset "Ginger Quince Cider" from 'verified' to 'pending'.
 *    This batch has 0 initial volume and needs investigation before verification.
 */
async function main() {
  console.log("=== Fix Reconciliation Data ===\n");

  // --- 1. Soft-delete stale waterfall adjustment ---
  console.log("1. Checking for stale waterfall adjustment...");
  const adjResult = await db.execute(sql.raw(`
    UPDATE ttb_waterfall_adjustments
    SET deleted_at = NOW()
    WHERE period_year = 2025
      AND waterfall_line = 'opening'
      AND deleted_at IS NULL
    RETURNING id, amount_gallons, reason
  `));
  const adjRows = adjResult.rows as any[];
  if (adjRows.length > 0) {
    for (const r of adjRows) {
      console.log(`   Soft-deleted: ${r.reason} (${r.amount_gallons} gal) [${r.id}]`);
    }
  } else {
    console.log("   No stale waterfall adjustments found (already deleted or never created).");
  }

  // --- 2. Fix Base Cider children ---
  console.log("\n2. Fixing Base Cider children marked as 'duplicate'...");

  // First, find the parent "Base Cider" batch
  const parentResult = await db.execute(sql.raw(`
    SELECT id, custom_name, batch_number
    FROM batches
    WHERE batch_number = '2024-10-20_UNKN_BLEND_A-R'
      AND deleted_at IS NULL
    LIMIT 1
  `));
  const parents = parentResult.rows as any[];

  if (parents.length === 0) {
    console.log("   WARNING: Could not find Base Cider parent batch (2024-10-20_UNKN_BLEND_A-R).");
  } else {
    const parentId = parents[0].id;
    console.log(`   Found parent: ${parents[0].custom_name || parents[0].batch_number} [${parentId}]`);

    // Find and fix children marked as duplicate with real initial volume
    const childResult = await db.execute(sql`
      UPDATE batches
      SET reconciliation_status = 'pending',
          is_racking_derivative = false,
          updated_at = NOW()
      WHERE parent_batch_id = ${parentId}
        AND deleted_at IS NULL
        AND reconciliation_status = 'duplicate'
      RETURNING id, custom_name, batch_number, CAST(initial_volume_liters AS TEXT) as initial_vol
    `);
    const children = childResult.rows as any[];
    if (children.length > 0) {
      console.log(`   Reset ${children.length} children to 'pending':`);
      for (const c of children) {
        console.log(`     - ${c.custom_name || c.batch_number} (initial: ${c.initial_vol}L)`);
      }
    } else {
      console.log("   No duplicate children found (already fixed or different status).");
    }
  }

  // --- 3. Fix Ginger Quince Cider ---
  console.log("\n3. Fixing Ginger Quince Cider...");
  const gingerResult = await db.execute(sql.raw(`
    UPDATE batches
    SET reconciliation_status = 'pending',
        updated_at = NOW()
    WHERE batch_number = 'blend-2024-12-20-120 Barrel 3-910854'
      AND deleted_at IS NULL
      AND reconciliation_status = 'verified'
    RETURNING id, custom_name, batch_number, CAST(initial_volume_liters AS TEXT) as initial_vol,
              CAST(current_volume_liters AS TEXT) as current_vol
  `));
  const gingerRows = gingerResult.rows as any[];
  if (gingerRows.length > 0) {
    for (const r of gingerRows) {
      console.log(`   Reset: ${r.custom_name || r.batch_number} (initial: ${r.initial_vol}L, current: ${r.current_vol}L) → 'pending'`);
    }
  } else {
    console.log("   Ginger Quince not found or already reset.");
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
