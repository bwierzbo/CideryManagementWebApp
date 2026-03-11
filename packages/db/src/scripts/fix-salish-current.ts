import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix Salish parent batch currentVolumeLiters.
 *
 * After reducing init from 225→120, the SBD correctly shows 0.0L ending,
 * but currentVolumeLiters is still 105.0L (stale from old init).
 * This causes a -27.74 gal drift on the reconciliation page.
 *
 * Fix: Set currentVolumeLiters = 0 to match reality (batch is completed,
 * all volume transferred out or bottled).
 */

const SALISH_ID = "0639e21d-63c8-4b5d-94b4-bdd7823dee49";

async function main() {
  console.log("=== Fix Salish Current Volume ===\n");

  const before = await db.execute(sql`
    SELECT custom_name,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           reconciliation_status, status
    FROM batches WHERE id = ${SALISH_ID}
  `);
  const b = (before.rows as any[])[0];
  console.log(`Batch: ${b.custom_name} [${SALISH_ID.slice(0, 8)}]`);
  console.log(`  Before: init=${b.init_vol}L, current=${b.current_vol}L, status=${b.status}, recon=${b.reconciliation_status}`);

  await db.execute(sql`
    UPDATE batches
    SET current_volume_liters = 0,
        updated_at = NOW()
    WHERE id = ${SALISH_ID}
  `);

  const after = await db.execute(sql`
    SELECT CAST(current_volume_liters AS TEXT) as current_vol
    FROM batches WHERE id = ${SALISH_ID}
  `);
  const a = (after.rows as any[])[0];
  console.log(`  After:  current=${a.current_vol}L`);
  console.log(`  Drift should now be 0.0 gal`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
