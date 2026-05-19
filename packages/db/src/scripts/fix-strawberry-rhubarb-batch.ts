/**
 * Fixes the Strawberry Rhubarb batch (id 82c25123) hit by the additive
 * volume contribution bug + corrects the amounts to 75 g/L per user request.
 *
 * Bug recap: the user entered 100 g/L for Strawberries with unit g/L and the
 * UI's Volume Contribution field was typed as 100 (mistakenly interpreted as
 * "100 L of liquid"). The API bumped current_volume by 100L (120 → 220) and
 * created a +100 batch_volume_adjustments row. Separately, the inventory
 * deduction code can't convert g/L → kg/L without batch volume, so it
 * deducted the raw amount (100) into the purchase item's unit, over-deducting
 * inventory in both lots.
 *
 * Changes (in a single transaction):
 *   1. batches.current_volume: 220 → 120 (restore)
 *   2. batches.current_volume_liters: 220 → 120
 *   3. Soft-delete the bad +100L batch_volume_adjustments row
 *   4. batch_additives.amount: 100 → 75 (g/L) for Strawberries + Rhubarb Concentrate
 *   5. additive_purchase_items.quantity_used:
 *        Strawberries (05ff4d51, kg):       back out 100, add correct 9 kg  (75 g/L × 120 L = 9000 g)
 *        Rhubarb Concentrate (374a42af, L): back out 100, add correct 8.738 L (9000 g / 1.030 kg/L)
 *
 * NOTE: We intentionally do NOT re-add a volume_contribution adjustment for
 * the corrected amounts. The user's complaint was about the bogus +100L
 * volume jump; they want the batch back to 120L. The physical additions
 * (9 kg strawberries + ~8.7 L rhubarb concentrate) do add real volume,
 * but the operator can record that separately if/when they want.
 *
 * Modes:
 *   tsx src/scripts/fix-strawberry-rhubarb-batch.ts          → dry run
 *   tsx src/scripts/fix-strawberry-rhubarb-batch.ts --apply  → commit
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

const BATCH_ID = "82c25123-51b5-43d1-9b0f-0fc9c1b1219e";
const BAD_VOL_ADJ_ID = "eefafe9c-5653-4f4f-937f-fbd7316ee794";
const STRAWBERRY_BA_ID = "06380b4f-6038-4912-a040-1977a6924494";
const RHUBARB_BA_ID = "aacb4ee8-ff91-4f62-8f40-9a63198ff1c1";
const STRAWBERRY_PURCHASE_ID = "05ff4d51-a6d4-43a1-841c-499e40f92d35"; // unit: kg
const RHUBARB_PURCHASE_ID = "374a42af-98f8-449c-9ae8-6011393d0513";   // unit: L

const NEW_RATE = 75; // g/L
const BATCH_VOL_L = 120;
const NEW_TOTAL_G = NEW_RATE * BATCH_VOL_L; // 9000 g
const NEW_TOTAL_KG = NEW_TOTAL_G / 1000;     // 9 kg

// Rhubarb concentrate: SG 1.030 → 1.030 kg/L → L = kg / 1.030
const RHUBARB_DENSITY_KG_PER_L = 1.030;
const NEW_RHUBARB_L = NEW_TOTAL_KG / RHUBARB_DENSITY_KG_PER_L; // ≈ 8.738 L

const BAD_DEDUCT_STRAWBERRY = 100;
const BAD_DEDUCT_RHUBARB = 100;

async function main() {
  const apply = process.argv.includes("--apply");

  // Read current state for verification
  const beforeBatch = await db.execute(sql`
    SELECT current_volume, current_volume_liters FROM batches WHERE id = ${BATCH_ID}
  `);
  const beforeStraw = await db.execute(sql`
    SELECT quantity, quantity_used FROM additive_purchase_items WHERE id = ${STRAWBERRY_PURCHASE_ID}
  `);
  const beforeRhub = await db.execute(sql`
    SELECT quantity, quantity_used FROM additive_purchase_items WHERE id = ${RHUBARB_PURCHASE_ID}
  `);

  const bRow = beforeBatch.rows[0] as any;
  const sRow = beforeStraw.rows[0] as any;
  const rRow = beforeRhub.rows[0] as any;

  console.log("\n=== BEFORE ===");
  console.log(`Batch ${BATCH_ID}: current_volume=${bRow.current_volume}L (liters=${bRow.current_volume_liters}L)`);
  console.log(`Strawberries inventory (${STRAWBERRY_PURCHASE_ID}): qty=${sRow.quantity} kg, used=${sRow.quantity_used} kg, available=${Number(sRow.quantity) - Number(sRow.quantity_used)} kg`);
  console.log(`Rhubarb Concentrate inventory (${RHUBARB_PURCHASE_ID}): qty=${rRow.quantity} L, used=${rRow.quantity_used} L, available=${Number(rRow.quantity) - Number(rRow.quantity_used)} L`);

  // Compute target inventory deltas
  const strawNewUsed = Number(sRow.quantity_used) - BAD_DEDUCT_STRAWBERRY + NEW_TOTAL_KG;
  const rhubNewUsed = Number(rRow.quantity_used) - BAD_DEDUCT_RHUBARB + NEW_RHUBARB_L;

  console.log("\n=== PLANNED CHANGES ===");
  console.log(`1. batches.current_volume: ${bRow.current_volume}L → ${BATCH_VOL_L}L`);
  console.log(`2. Soft-delete batch_volume_adjustments row ${BAD_VOL_ADJ_ID} (bad +100L addition)`);
  console.log(`3. batch_additives ${STRAWBERRY_BA_ID} (Strawberries): amount 100 → ${NEW_RATE} g/L`);
  console.log(`4. batch_additives ${RHUBARB_BA_ID} (Rhubarb Concentrate): amount 100 → ${NEW_RATE} g/L`);
  console.log(`5. Strawberries inventory used: ${sRow.quantity_used} kg → ${strawNewUsed} kg (back out raw 100, add correct ${NEW_TOTAL_KG} kg)`);
  console.log(`6. Rhubarb Concentrate inventory used: ${rRow.quantity_used} L → ${rhubNewUsed.toFixed(3)} L (back out raw 100, add correct ${NEW_RHUBARB_L.toFixed(3)} L using SG 1.030)`);

  if (!apply) {
    console.log("\n  → re-run with --apply to commit.");
    process.exit(0);
  }

  // Apply in transaction
  await db.transaction(async (tx) => {
    // 1. Restore batch volume
    await tx.execute(sql`
      UPDATE batches
      SET current_volume = ${BATCH_VOL_L}, current_volume_liters = ${BATCH_VOL_L}, current_volume_unit = 'L', updated_at = NOW()
      WHERE id = ${BATCH_ID}
    `);

    // 2. Soft-delete bad volume adjustment
    await tx.execute(sql`
      UPDATE batch_volume_adjustments
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${BAD_VOL_ADJ_ID}
    `);

    // 3-4. Update batch_additives amount: 100 → 75
    await tx.execute(sql`
      UPDATE batch_additives SET amount = ${NEW_RATE}, updated_at = NOW()
      WHERE id IN (${STRAWBERRY_BA_ID}, ${RHUBARB_BA_ID})
    `);

    // 5. Strawberries inventory correction
    await tx.execute(sql`
      UPDATE additive_purchase_items
      SET quantity_used = ${strawNewUsed}, updated_at = NOW()
      WHERE id = ${STRAWBERRY_PURCHASE_ID}
    `);

    // 6. Rhubarb concentrate inventory correction
    await tx.execute(sql`
      UPDATE additive_purchase_items
      SET quantity_used = ${rhubNewUsed.toFixed(3)}, updated_at = NOW()
      WHERE id = ${RHUBARB_PURCHASE_ID}
    `);
  });

  // Verify
  const afterBatch = await db.execute(sql`
    SELECT current_volume, current_volume_liters FROM batches WHERE id = ${BATCH_ID}
  `);
  const afterStraw = await db.execute(sql`
    SELECT quantity, quantity_used FROM additive_purchase_items WHERE id = ${STRAWBERRY_PURCHASE_ID}
  `);
  const afterRhub = await db.execute(sql`
    SELECT quantity, quantity_used FROM additive_purchase_items WHERE id = ${RHUBARB_PURCHASE_ID}
  `);
  const aB = afterBatch.rows[0] as any;
  const aS = afterStraw.rows[0] as any;
  const aR = afterRhub.rows[0] as any;

  console.log("\n=== AFTER ===");
  console.log(`Batch current_volume: ${aB.current_volume}L`);
  console.log(`Strawberries used: ${aS.quantity_used} kg, available: ${Number(aS.quantity) - Number(aS.quantity_used)} kg`);
  console.log(`Rhubarb Concentrate used: ${aR.quantity_used} L, available: ${(Number(aR.quantity) - Number(aR.quantity_used)).toFixed(3)} L`);
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
