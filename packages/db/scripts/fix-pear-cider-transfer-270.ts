/**
 * Owner correction 2026-09-11: the apple-cider transfer into
 * Pear Cider 2026-065 was recorded as 360 L but should be 270 L
 * (recipe: 300 mL/L pear juice -> 269.2 L cider + 80.8 L juice = 350 L).
 * The 90 L difference returns to the source IBC blend batch.
 *
 * Touches all six records of the transfer chain consistently:
 * batch_transfers, batch_merge_history, both ledger entries, and both
 * batches' volumes. Pre-existing ledger-vs-stored drift on the source
 * batch is left as-is (+90 applied to both sides equally).
 *
 * Run: pnpm --filter db exec tsx scripts/fix-pear-cider-transfer-270.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const TRANSFER_ID = "37a4d98d-9476-4f36-b45b-4e299291aa99";
const MERGE_ID = "2d3aa9f1-b5fd-41e4-9525-6fd56d4c13ca";
const LEDGER_OUT_ID = "e6423093-e20e-4aac-bbdf-35f96e3cd0d2"; // source outflow
const LEDGER_IN_ID = "a483c91f-41b3-4a81-9f71-6e740155f398"; // pear creation
const PEAR_BATCH = "ef470f97-695a-4429-b7cc-26157c484c99";
const SOURCE_BATCH = "e48435d2-621c-4e57-9e73-ae3c437946ea";
const NOTE = "Corrected 360 L -> 270 L per recipe ratio (owner, 2026-09-11)";

async function main() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE batch_transfers
      SET volume_transferred = '270.000', total_volume_processed = '270.000',
          notes = COALESCE(notes || E'\n', '') || ${NOTE}, updated_at = NOW()
      WHERE id = ${TRANSFER_ID} AND volume_transferred = '360.000'
    `);
    await tx.execute(sql`
      UPDATE batch_merge_history
      SET volume_added = '270.000', target_volume_after = '270.000',
          notes = COALESCE(notes || E'\n', '') || ${NOTE}
      WHERE id = ${MERGE_ID} AND volume_added = '360.000'
    `);
    await tx.execute(sql`
      UPDATE batch_volume_ledger
      SET volume_change = '-270.000', running_balance = running_balance + 90,
          notes = ${NOTE}
      WHERE id = ${LEDGER_OUT_ID} AND volume_change = '-360.000'
    `);
    await tx.execute(sql`
      UPDATE batch_volume_ledger
      SET volume_change = '270.000', running_balance = running_balance - 90,
          notes = ${NOTE}
      WHERE id = ${LEDGER_IN_ID} AND volume_change = '360.000'
    `);
    await tx.execute(sql`
      UPDATE batches
      SET current_volume = '270.000', current_volume_liters = '270.000',
          initial_volume_liters = '270.000', updated_at = NOW()
      WHERE id = ${PEAR_BATCH} AND current_volume_liters = '360.000'
    `);
    await tx.execute(sql`
      UPDATE batches
      SET current_volume = current_volume + 90,
          current_volume_liters = current_volume_liters + 90,
          updated_at = NOW()
      WHERE id = ${SOURCE_BATCH} AND current_volume_unit = 'L'
    `);
  });

  const check = await db.execute(sql`
    SELECT b.batch_number, b.current_volume_liters, b.initial_volume_liters
    FROM batches b WHERE b.id IN (${PEAR_BATCH}, ${SOURCE_BATCH})
  `);
  console.table(check.rows);
  const ledger = await db.execute(sql`
    SELECT event_type, volume_change, running_balance FROM batch_volume_ledger
    WHERE id IN (${LEDGER_OUT_ID}, ${LEDGER_IN_ID})
  `);
  console.table(ledger.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
