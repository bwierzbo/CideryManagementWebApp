/**
 * TTB 2025 drift fixes per owner rulings (2026-09-15 review):
 *
 * 1. Remove the two ttb_waterfall_adjustments rows written into the LIVE
 *    database by ttb-checkpoint.test.ts on 2026-09-11 (reason CKPT_TEST_*,
 *    -5.45 gal each on 2025 hardCider). Test pollution, never real data.
 *
 * 2. Restore the two 2025 juice-purchase items soft-deleted on 2026-08-28
 *    (3122.963 L @ 2025-07-01 and 2000.000 L @ 2025-11-26). Their juice was
 *    consumed into 2025 batches (1100SS tanks, JONA IBCs) long ago and the
 *    volumes are part of the FILED 2025 Form 5120.17 production (line 2).
 *    Deleting them removed 5122.96 L = 1353.3 gal from the recomputed
 *    "Produced" line — the exact new-drift residual.
 *
 * 3. Summer Community Blend 4 - A (TANK-1000-1): owner physical ruling is
 *    750 L; event reconstruction says 1300 L (a duplicated inflow in its
 *    2026 transfer lineage). Set volume_manually_corrected — the designed
 *    owner-pin that stops the self-heal recompute from overwriting the
 *    physical value (it did so on 2026-09-11, 660→1210) and skips the
 *    failing reconstruction check — and write an annotated -550 L
 *    batch_volume_ledger adjustment so the ledger carries the ruling.
 *
 * Run: pnpm --filter db exec tsx scripts/fix-ttb-2025-drift-2026-09.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const ITEMS = [
  "58b5c955-7c00-428a-a333-b2123f98551c", // 3122.963 L, purchase 2025-07-01
  "e244e7a6-a088-4668-aad2-68b7763b156a", // 2000.000 L, purchase 2025-11-26
];
const RESTORE_NOTE =
  "Restored 2026-09-15: soft-deleted 2026-08-28 via juice-inventory cleanup; " +
  "volume is consumed 2025 production filed on Form 5120.17 (line 2) and must stay on the books";

const SB4A = "e48435d2-621c-4e57-9e73-ae3c437946ea"; // Summer Community Blend 4 - A
const SB4A_NOTE =
  "Owner-confirmed physical volume 750 L (2026-09-15 ruling; TANK-1000-1). " +
  "Event history reconstructs 1300 L via a duplicated inflow in the 2026 transfer lineage; " +
  "-550 L adjustment records the ruling. volume_manually_corrected pins the stored value.";

async function main() {
  await db.transaction(async (tx) => {
    // 1. Test pollution — the checkpoint test turned out to clean up its own
    // rows (audit CREATE entries remain, table rows do not), so this is a
    // belt-and-suspenders sweep that normally deletes nothing.
    const ckpt = await tx.execute(sql`
      DELETE FROM ttb_waterfall_adjustments WHERE reason LIKE 'CKPT_TEST_%'
    `);
    console.log(`CKPT_TEST adjustment rows deleted: ${ckpt.rowCount}`);

    // 2. Restore the filed-2025 juice purchase items
    const items = await tx.execute(sql`
      UPDATE juice_purchase_items
      SET deleted_at = NULL,
          notes = CASE WHEN COALESCE(notes, '') = '' THEN ${RESTORE_NOTE}
                       ELSE notes || ' | ' || ${RESTORE_NOTE} END,
          updated_at = NOW()
      WHERE id = ANY(ARRAY[${ITEMS[0]}::uuid, ${ITEMS[1]}::uuid])
        AND deleted_at IS NOT NULL
    `);
    console.log(`Juice purchase items restored: ${items.rowCount}`);
    if (items.rowCount !== 2) throw new Error(`Expected 2 items, got ${items.rowCount}`);

    // 3. Summer Blend 4 - A: owner pin + annotated ledger adjustment
    const pin = await tx.execute(sql`
      UPDATE batches
      SET volume_manually_corrected = true, updated_at = NOW()
      WHERE id = ${SB4A}::uuid AND deleted_at IS NULL
        AND current_volume_liters::numeric = 750
    `);
    if (pin.rowCount !== 1) {
      throw new Error(
        `Summer Blend 4-A pin failed (rowCount ${pin.rowCount}) — stored volume no longer 750 L? Re-check before pinning.`,
      );
    }
    console.log("Summer Blend 4-A volume_manually_corrected set (stored 750 L)");

    const ledger = await tx.execute(sql`
      INSERT INTO batch_volume_ledger
        (batch_id, event_date, event_type, volume_change, running_balance, unit, source_description, notes)
      VALUES (${SB4A}::uuid, NOW(), 'adjustment', -550, 750, 'L',
              'Owner physical ruling: duplicated inflow correction (cellar audit follow-up)',
              ${SB4A_NOTE})
    `);
    console.log(`Ledger adjustment rows written: ${ledger.rowCount}`);
  });

  // Post-check
  const check = await db.execute(sql`
    SELECT (SELECT COUNT(*) FROM ttb_waterfall_adjustments WHERE reason LIKE 'CKPT_TEST_%') AS ckpt_left,
           (SELECT COUNT(*) FROM juice_purchase_items WHERE id = ANY(ARRAY[${ITEMS[0]}::uuid, ${ITEMS[1]}::uuid]) AND deleted_at IS NULL) AS items_alive,
           (SELECT volume_manually_corrected FROM batches WHERE id = ${SB4A}::uuid) AS sb4a_pinned
  `);
  console.table(check.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
