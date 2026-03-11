import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix 4 batches with broken parent links that inflate the SBD opening by ~33.7 gal.
 *
 * Root cause: These batches were created via transfers but lack parent_batch_id,
 * so the isTransferCreated check fails and their phantom initial_volume_liters
 * counts as "production" in the SBD opening reconstruction.
 *
 * Fixes:
 * 1. ef9febe3 (blend-3BBL BRITE): 120L phantom initial, received 120L from Legacy BRITE.
 *    → Set parent to Legacy BRITE, zero initial, status → pending.
 *
 * 2. 23298358 (blend-3BBL BRITE - Remaining x3): Racking derivative of ef9febe3,
 *    but actual transfer source is Legacy BRITE (120L).
 *    → Set parent to Legacy BRITE, status → pending.
 *
 * 3. 8964d840 (blend-3BBL BRITE - Remaining x4): Racking derivative of ef9febe3,
 *    but actual transfer sources are Community Cider blend (108L) + Legacy BRITE (11L).
 *    → Set parent to Community Cider blend (primary source), status → pending.
 *
 * 4. 9c7112c8 (Strawberry Rhubarb racking): 7.5L phantom initial, received 105L
 *    from batch 25a0c6a9.
 *    → Set parent to 25a0c6a9, zero initial, status → pending.
 */

const LEGACY_BRITE_ID = "a1a0efb2-56a6-486e-9f88-48d7b8bc14b6";
const COMMUNITY_CIDER_BLEND_ID = "a0f86927-6031-40f6-855e-e822dc2af5d6";
const STRAWBERRY_PARENT_ID = "25a0c6a9-b9e7-4c4a-9fea-eb78215977cc";

const fixes = [
  {
    id: "ef9febe3-29be-4b71-a3bb-6421c4127654",
    label: "blend-3BBL BRITE (Raspberry Blackberry)",
    parentBatchId: LEGACY_BRITE_ID,
    initialVolumeLiters: 0,
    reconciliationStatus: "pending",
  },
  {
    id: "23298358-3d7f-4baa-96b3-1d3cb5008d9f",
    label: "blend-3BBL BRITE - Remaining x3 (Black Currant)",
    parentBatchId: LEGACY_BRITE_ID,
    initialVolumeLiters: null, // keep existing (already 0)
    reconciliationStatus: "pending",
  },
  {
    id: "8964d840-b5f9-4b59-9a02-d77a7048bffe",
    label: "blend-3BBL BRITE - Remaining x4 (Black Currant)",
    parentBatchId: COMMUNITY_CIDER_BLEND_ID,
    initialVolumeLiters: null, // keep existing (already 0)
    reconciliationStatus: "pending",
  },
  {
    id: "9c7112c8-c747-45d5-b71f-3565d91b2915",
    label: "Strawberry Rhubarb racking",
    parentBatchId: STRAWBERRY_PARENT_ID,
    initialVolumeLiters: 0,
    reconciliationStatus: "pending",
  },
];

async function main() {
  console.log("=== Fix Broken Batch Parents ===\n");

  for (const fix of fixes) {
    console.log(`Fixing: ${fix.label} [${fix.id}]`);

    // Verify batch exists and show before state
    const before = await db.execute(sql`
      SELECT id, parent_batch_id,
             CAST(initial_volume_liters AS TEXT) as initial_vol,
             reconciliation_status, is_racking_derivative
      FROM batches
      WHERE id = ${fix.id} AND deleted_at IS NULL
    `);
    const rows = before.rows as any[];

    if (rows.length === 0) {
      console.log(`  SKIPPED: batch not found or deleted\n`);
      continue;
    }

    const b = rows[0];
    console.log(
      `  Before: parent=${b.parent_batch_id || "NULL"}, initial=${b.initial_vol}L, status=${b.reconciliation_status}`,
    );

    // Build UPDATE
    if (fix.initialVolumeLiters !== null) {
      await db.execute(sql`
        UPDATE batches
        SET parent_batch_id = ${fix.parentBatchId},
            initial_volume_liters = ${fix.initialVolumeLiters},
            reconciliation_status = ${fix.reconciliationStatus},
            updated_at = NOW()
        WHERE id = ${fix.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE batches
        SET parent_batch_id = ${fix.parentBatchId},
            reconciliation_status = ${fix.reconciliationStatus},
            updated_at = NOW()
        WHERE id = ${fix.id}
      `);
    }

    // Verify after state
    const after = await db.execute(sql`
      SELECT parent_batch_id,
             CAST(initial_volume_liters AS TEXT) as initial_vol,
             reconciliation_status
      FROM batches
      WHERE id = ${fix.id}
    `);
    const a = (after.rows as any[])[0];
    console.log(
      `  After:  parent=${a.parent_batch_id || "NULL"}, initial=${a.initial_vol}L, status=${a.reconciliation_status}\n`,
    );
  }

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
