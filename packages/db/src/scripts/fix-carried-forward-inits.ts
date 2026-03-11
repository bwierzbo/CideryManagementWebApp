import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix the 3 carried-forward batches where we incorrectly increased init
 * (which inflated the SBD opening by 56.2 gal).
 *
 * For carried-forward batches, the transfers happened DURING 2025 but we put
 * the volume into init (which affects opening). Instead, we should use positive
 * adjustments dated on the transfer date — these go into period production.
 *
 * Batches to fix:
 *   - Rye Cider: revert init from 120.3 → 37.8, add +82.5L adjustment
 *   - For Distillery: revert init from 417.93 → 325.5, add +56L, +18.93L, +17.5L adjustments
 *   - Calvados Barrel Aged Cider: revert init from 262.8 → 225, add +37.8L adjustment
 */

const ADMIN_USER_ID = "8356e824-6b53-4751-b3ac-08a0df9327b9";

interface Fix {
  batchName: string;
  batchId: string;
  originalInit: number;
  adjustments: { amount: number; date: string; source: string }[];
}

const FIXES: Omit<Fix, "batchId">[] = [
  {
    batchName: "Rye Cider",
    originalInit: 37.8,
    adjustments: [
      { amount: 82.5, date: "2025-02-16 18:00:00", source: "Calvados Barrel Aged" },
    ],
  },
  {
    batchName: "For Distillery",
    originalInit: 325.5,
    adjustments: [
      { amount: 56, date: "2025-08-05 16:00:00", source: "OBC Cider Mix" },
      { amount: 18.93, date: "2025-08-05 19:00:00", source: "Raspberry Blackberry" },
      { amount: 17.5, date: "2025-09-09 15:00:00", source: "Calvados Barrel Aged Cider" },
    ],
  },
  {
    batchName: "Calvados Barrel Aged Cider",
    originalInit: 225,
    adjustments: [
      { amount: 37.8, date: "2025-11-10 00:17:08", source: "Calvados Barrel Aged" },
    ],
  },
];

async function main() {
  console.log("=== Fix Carried-Forward Init Increases ===\n");

  for (const fix of FIXES) {
    // Find the batch
    const batch = await db.execute(sql`
      SELECT id, custom_name,
             CAST(initial_volume_liters AS TEXT) as init_vol,
             CAST(current_volume_liters AS TEXT) as current_vol
      FROM batches
      WHERE custom_name = ${fix.batchName}
        AND deleted_at IS NULL
        AND parent_batch_id IS NULL
      LIMIT 1
    `);
    const b = (batch.rows as any[])[0];
    if (!b) {
      console.log(`ERROR: Batch "${fix.batchName}" not found`);
      continue;
    }

    console.log(`--- ${fix.batchName} [${b.id.slice(0, 8)}] ---`);
    console.log(`  Current init: ${b.init_vol}L → Reverting to: ${fix.originalInit}L`);

    // Revert init
    await db.execute(sql`
      UPDATE batches
      SET initial_volume_liters = ${fix.originalInit},
          updated_at = NOW()
      WHERE id = ${b.id}
    `);

    // Create positive adjustments for each transfer we absorbed
    for (const adj of fix.adjustments) {
      const currentVol = parseFloat(b.current_vol) || 0;
      console.log(`  Adding +${adj.amount}L adjustment (from ${adj.source}, ${adj.date})`);

      await db.execute(sql`
        INSERT INTO batch_volume_adjustments (
          id, batch_id, adjustment_date, adjustment_type,
          volume_before, volume_after, adjustment_amount,
          reason, adjusted_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${b.id},
          ${adj.date}::timestamp,
          'correction_up',
          ${currentVol},
          ${currentVol + adj.amount},
          ${adj.amount},
          ${"Volume received from " + adj.source + " (batch deleted) — reclassified from internal transfer"},
          ${ADMIN_USER_ID},
          NOW(),
          NOW()
        )
      `);
    }

    // Verify
    const after = await db.execute(sql`
      SELECT CAST(initial_volume_liters AS TEXT) as init_vol
      FROM batches WHERE id = ${b.id}
    `);
    console.log(`  Verified: init = ${(after.rows as any[])[0].init_vol}L\n`);
  }

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
