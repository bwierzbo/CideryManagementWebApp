import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix 2 batches whose initial_volume_liters double-counts volume that is
 * already tracked via active transfers or other batch initials.
 *
 * Rule: A batch either has an initial volume (representing original production)
 * OR receives volume via transfers — never both for the same juice.
 *
 * 1. Salish Pommeau (0639e21d): initial = 225L but should be 120L.
 *    The 225L = 120L original cider juice (press run 2024-11-28-01) + 105L
 *    brandy/blend (68L Legacy Brandy + 37L blend component). The 105L is
 *    ALSO recorded as active batch_transfers into this batch. Double-count.
 *    → Set initial to 120L.
 *
 * 2. Raspberry Blackberry (c2436e1d): initial = 120.5L but should be 0L.
 *    This batch was created 2025-09-28 (backdated to 2024-10-20). Its 120.5L
 *    represents juice from press run ff306a18 (2024-10-20-03), but Base Cider
 *    (298c081d, init=975L) already accounts for all juice from that press run
 *    group. The same juice is counted in both batches' initials. Base Cider
 *    later transferred 120L back to RB on 2025-05-13 (active transfer).
 *    → Set initial to 0L.
 */

const fixes = [
  {
    id: "0639e21d-63c8-4b5d-94b4-bdd7823dee49",
    label: "Salish Pommeau",
    newInitial: 120,
    reason: "225L included 105L brandy/blend also tracked as active transfers",
  },
  {
    id: "c2436e1d-2e14-4d04-a68a-2258fcd64b16",
    label: "Raspberry Blackberry",
    newInitial: 0,
    reason:
      "120.5L juice already counted in Base Cider (298c081d) initial of 975L",
  },
];

async function main() {
  console.log("=== Fix Double-Counted Initial Volumes ===\n");

  for (const fix of fixes) {
    console.log(`Fixing: ${fix.label} [${fix.id}]`);
    console.log(`  Reason: ${fix.reason}`);

    // Show before state
    const before = await db.execute(sql`
      SELECT id, custom_name, batch_number,
             CAST(initial_volume_liters AS TEXT) as initial_vol,
             CAST(current_volume_liters AS TEXT) as current_vol,
             reconciliation_status, product_type
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
      `  Before: initial=${b.initial_vol}L, current=${b.current_vol}L, type=${b.product_type}, status=${b.reconciliation_status}`,
    );

    // Update initial volume
    await db.execute(sql`
      UPDATE batches
      SET initial_volume_liters = ${fix.newInitial},
          updated_at = NOW()
      WHERE id = ${fix.id}
    `);

    // Verify after state
    const after = await db.execute(sql`
      SELECT CAST(initial_volume_liters AS TEXT) as initial_vol,
             CAST(current_volume_liters AS TEXT) as current_vol,
             reconciliation_status
      FROM batches
      WHERE id = ${fix.id}
    `);
    const a = (after.rows as any[])[0];
    console.log(
      `  After:  initial=${a.initial_vol}L, current=${a.current_vol}L, status=${a.reconciliation_status}\n`,
    );
  }

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
