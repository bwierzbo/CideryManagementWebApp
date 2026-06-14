import { db } from "../src/index";
import { sql } from "drizzle-orm";

/**
 * Correct the Raspberry Blackberry transfer that was logged against the wrong
 * source vessel/batch.
 *
 * Recorded:  TANK-1000-1 / SCB4 (e48435d2…) → TANK-120-MIX-2, 2026-05-11 14:21
 * Reality:   TANK-500-2  / SCB4 (a408aa3c…) → TANK-120-MIX-2, 2026-05-13 04:00
 *
 * Side effects of the original mis-entry:
 *  - SCB4-in-TANK-1000-1.current_volume was debited 120 L it shouldn't have lost
 *  - SCB4-in-TANK-500-2.current_volume was never debited the 120 L it actually lost
 *  - Raspberry Blackberry batch's start_date is pinned to the wrong moment
 *
 * Single transaction, four UPDATEs.
 */

const TRANSFER_ID = "4321473f-1741-4983-9b11-1102b1403a35";
const NEW_VESSEL_ID = "1b19c6ee-c61a-467b-b234-ce064abf972d"; // TANK-500-2
const NEW_SOURCE_BATCH_ID = "a408aa3c-d9bd-49e0-922d-f9e6698fff41"; // SCB4-in-TANK-500-2
const OLD_SOURCE_BATCH_ID = "e48435d2-621c-4e57-9e73-ae3c437946ea"; // SCB4-in-TANK-1000-1
const DEST_BATCH_ID = "14b33693-9b1c-4bbc-b650-bfab7025dad8"; // Raspberry Blackberry
const NEW_TRANSFERRED_AT = "2026-05-13 04:00:00+00";
const VOLUME_L = 120;

async function run() {
  const snapshot = async (label: string) => {
    console.log(`\n--- ${label} ---`);
    const t = await db.execute(sql`
      SELECT transferred_at::text AS transferred_at, source_vessel_id::text AS source_vessel_id, source_batch_id::text AS source_batch_id
      FROM batch_transfers WHERE id = ${TRANSFER_ID}::uuid
    `);
    console.log("transfer:", t.rows);
    const b1 = await db.execute(sql`
      SELECT current_volume, current_volume_liters
      FROM batches WHERE id = ${OLD_SOURCE_BATCH_ID}::uuid
    `);
    console.log("scb4-in-TANK-1000-1:", b1.rows);
    const b2 = await db.execute(sql`
      SELECT current_volume, current_volume_liters
      FROM batches WHERE id = ${NEW_SOURCE_BATCH_ID}::uuid
    `);
    console.log("scb4-in-TANK-500-2:", b2.rows);
    const b3 = await db.execute(sql`
      SELECT start_date::text AS start_date FROM batches WHERE id = ${DEST_BATCH_ID}::uuid
    `);
    console.log("Raspberry Blackberry:", b3.rows);
  };

  await snapshot("Pre-fix");

  await db.transaction(async (tx) => {
    // 1. Fix the transfer row
    await tx.execute(sql`
      UPDATE batch_transfers
      SET source_vessel_id = ${NEW_VESSEL_ID}::uuid,
          source_batch_id  = ${NEW_SOURCE_BATCH_ID}::uuid,
          transferred_at   = ${NEW_TRANSFERRED_AT}::timestamptz,
          updated_at       = NOW()
      WHERE id = ${TRANSFER_ID}::uuid
    `);

    // 2. Add 120L back to SCB4-in-TANK-1000-1 (undo wrong debit)
    await tx.execute(sql`
      UPDATE batches
      SET current_volume         = current_volume + ${VOLUME_L},
          current_volume_liters  = current_volume_liters + ${VOLUME_L},
          updated_at             = NOW()
      WHERE id = ${OLD_SOURCE_BATCH_ID}::uuid
    `);

    // 3. Subtract 120L from SCB4-in-TANK-500-2 (apply real debit)
    await tx.execute(sql`
      UPDATE batches
      SET current_volume         = current_volume - ${VOLUME_L},
          current_volume_liters  = current_volume_liters - ${VOLUME_L},
          updated_at             = NOW()
      WHERE id = ${NEW_SOURCE_BATCH_ID}::uuid
    `);

    // 4. Move Raspberry Blackberry start_date to match new transfer time
    await tx.execute(sql`
      UPDATE batches
      SET start_date = ${NEW_TRANSFERRED_AT}::timestamptz,
          updated_at = NOW()
      WHERE id = ${DEST_BATCH_ID}::uuid
    `);
  });

  await snapshot("Post-fix");

  console.log("\n✅ Done.");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
