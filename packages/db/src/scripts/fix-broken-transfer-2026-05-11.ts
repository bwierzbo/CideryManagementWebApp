/**
 * Repairs the broken TANK-1000-1 → TANK-120-MIX-2 transfer from 2026-05-11
 * where 725 L of cider was misrecorded as sediment loss.
 *
 * Bug: TankTransferForm auto-fills loss = sourceVolume − transferAmt as a
 * "rack-everything" default. For a 120 L transfer out of 845 L, loss
 * defaulted to 725 L and the operator submitted without overriding it.
 *
 * Repair (Option A): preserve the original batch identity at the source.
 *   - Restore batch e48435d2 (Summer Community Blend 4) to TANK-1000-1 with
 *     current_volume = 725 L.
 *   - Create a child batch at TANK-120-MIX-2 with 120 L, linked via
 *     parent_batch_id. Inherits status / product_type / etc. from parent.
 *   - Update batch_transfers row 4321473f: dst → new child, loss → 0,
 *     total_processed → 120, remaining_volume → 725.
 *   - Soft-delete batch_volume_adjustments row fcf6ba96 (bogus sediment).
 *
 *   No post-transfer measurements/additives recorded against the original
 *   batch since 2026-05-11, so reverting it is safe.
 *
 * Run:  tsx src/scripts/fix-broken-transfer-2026-05-11.ts          → dry run
 *       tsx src/scripts/fix-broken-transfer-2026-05-11.ts --apply  → commit
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

const SOURCE_BATCH_ID = "e48435d2-621c-4e57-9e73-ae3c437946ea";
const TRANSFER_ID = "4321473f-1741-4983-9b11-1102b1403a35";
const BAD_ADJ_ID = "fcf6ba96-03a4-43aa-8428-57edf6d6852a";
const SOURCE_VESSEL_ID = "6ace0d37-853a-489d-b712-e30cecde28fa"; // TANK-1000-1
const DEST_VESSEL_ID = "35b0fc70-12ab-4638-a773-e6da9e6452a1";   // TANK-120-MIX-2

const TRANSFER_VOL = 120;     // L
const REMAINING_VOL = 725;    // L
const TRANSFER_DATE = "2026-05-11 14:21:00";

async function main() {
  const apply = process.argv.includes("--apply");

  const source = (await db.execute(sql`
    SELECT * FROM batches WHERE id = ${SOURCE_BATCH_ID}
  `)).rows[0] as any;
  if (!source) { console.error("Source batch not found"); process.exit(1); }

  console.log("\n=== CURRENT STATE ===");
  console.log(`Source batch ${source.name} (${SOURCE_BATCH_ID})`);
  console.log(`  vessel_id=${source.vessel_id}  current_volume=${source.current_volume} ${source.current_volume_unit}`);
  console.log(`  status=${source.status}  product_type=${source.product_type}`);

  console.log("\n=== PLANNED CHANGES ===");
  console.log(`1. Restore source batch ${SOURCE_BATCH_ID} → vessel TANK-1000-1, current_volume = ${REMAINING_VOL} L`);
  console.log(`2. Create child batch at TANK-120-MIX-2 with ${TRANSFER_VOL} L (parent_batch_id = source)`);
  console.log(`3. Update transfer ${TRANSFER_ID}: dst_batch → new child, loss=0, total_processed=${TRANSFER_VOL}, remaining=${REMAINING_VOL}`);
  console.log(`4. Soft-delete batch_volume_adjustments row ${BAD_ADJ_ID} (bogus 725 L sediment)`);

  if (!apply) { console.log("\n→ re-run with --apply"); process.exit(0); }

  await db.transaction(async (tx) => {
    // 1. Restore source batch
    await tx.execute(sql`
      UPDATE batches
      SET vessel_id = ${SOURCE_VESSEL_ID},
          current_volume = ${REMAINING_VOL},
          current_volume_liters = ${REMAINING_VOL},
          current_volume_unit = 'L',
          updated_at = NOW()
      WHERE id = ${SOURCE_BATCH_ID}
    `);

    // 2. Create child batch (clone source metadata, set new vessel/volume).
    // Pre-compute the derived strings in JS — keeping them out of the SQL
    // string avoids the "could not determine data type of parameter" error
    // that pg throws when string concatenation references bound parameters.
    const childName = `${source.name} (child ${TRANSFER_VOL}L)`;
    const childCustomName = source.custom_name ? `${source.custom_name} (child ${TRANSFER_VOL}L)` : null;
    const childBatchNumber = `${source.batch_number}-split-${TRANSFER_ID.substring(0, 8)}`;
    const childInsert = await tx.execute(sql`
      INSERT INTO batches (
        batch_number, name, custom_name, status, vessel_id,
        start_date, initial_volume, initial_volume_unit, initial_volume_liters,
        current_volume, current_volume_unit, current_volume_liters,
        product_type, is_archived, parent_batch_id, is_racking_derivative,
        original_gravity, final_gravity, estimated_abv, actual_abv,
        ttb_origin_year, created_at, updated_at
      ) VALUES (
        ${childBatchNumber},
        ${childName},
        ${childCustomName},
        ${source.status},
        ${DEST_VESSEL_ID},
        ${TRANSFER_DATE},
        ${TRANSFER_VOL}, 'L', ${TRANSFER_VOL},
        ${TRANSFER_VOL}, 'L', ${TRANSFER_VOL},
        ${source.product_type},
        false,
        ${SOURCE_BATCH_ID},
        true,
        ${source.original_gravity},
        ${source.final_gravity},
        ${source.estimated_abv},
        ${source.actual_abv},
        ${source.ttb_origin_year},
        NOW(), NOW()
      )
      RETURNING id
    `);
    const newBatchId = (childInsert.rows[0] as any).id;
    console.log(`  → created child batch ${newBatchId}`);

    // 3. Update the transfer row
    await tx.execute(sql`
      UPDATE batch_transfers
      SET destination_batch_id = ${newBatchId},
          loss = 0,
          loss_unit = 'L',
          total_volume_processed = ${TRANSFER_VOL},
          total_volume_processed_unit = 'L',
          remaining_volume = ${REMAINING_VOL},
          remaining_volume_unit = 'L',
          updated_at = NOW()
      WHERE id = ${TRANSFER_ID}
    `);

    // 4. Soft-delete the bad sediment adjustment
    await tx.execute(sql`
      UPDATE batch_volume_adjustments
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${BAD_ADJ_ID}
    `);
  });

  console.log("\n✅ Transfer repaired. TANK-1000-1 should now show 725 L; TANK-120-MIX-2 shows the new child batch at 120 L.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
