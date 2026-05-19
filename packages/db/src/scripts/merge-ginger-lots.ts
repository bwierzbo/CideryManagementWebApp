/**
 * Merges the two duplicate Ginger lots into one (vendor=Safeway, unit=lb).
 *
 * Before:
 *   Lot 1 (04/29): qty=3, used=6, available=-3, price=$4/lb, total=$12
 *   Lot 2 (05/01): qty=10, used=0, available=+10, price=$4/lb, total=$40
 *
 * After (kept the OLDER lot row, since past additive usages reference its id):
 *   Lot 1: qty=13, used=6, available=+7, price=$4/lb (weighted), total=$52
 *   Lot 2: soft-deleted
 *
 * Going forward the new merge logic in additivePurchases.create prevents this
 * fragmentation from recurring.
 *
 * Run:   tsx src/scripts/merge-ginger-lots.ts          → dry run
 *        tsx src/scripts/merge-ginger-lots.ts --apply  → commit
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

const OLD_LOT_ID = "a409c5f8-5958-41ed-a48b-9230f3d9090d"; // 04/29, qty=3, used=6
const NEW_LOT_ID = "56152cef-adf8-48eb-a1fc-0eeb430d5f7a"; // 05/01, qty=10, used=0

async function main() {
  const apply = process.argv.includes("--apply");

  const old = (await db.execute(sql`
    SELECT quantity, quantity_used, total_cost, price_per_unit, expiration_date, lot_batch_number
    FROM additive_purchase_items WHERE id = ${OLD_LOT_ID}
  `)).rows[0] as any;
  const nu = (await db.execute(sql`
    SELECT quantity, quantity_used, total_cost, price_per_unit, expiration_date, lot_batch_number
    FROM additive_purchase_items WHERE id = ${NEW_LOT_ID}
  `)).rows[0] as any;

  const newQty = Number(old.quantity) + Number(nu.quantity);
  const newUsed = Number(old.quantity_used) + Number(nu.quantity_used);
  const newTotalCost = Number(old.total_cost || 0) + Number(nu.total_cost || 0);
  const newPricePerUnit = newQty > 0 ? newTotalCost / newQty : 0;

  console.log("\n=== PLAN ===");
  console.log(`Keep:    lot ${OLD_LOT_ID} (older)`);
  console.log(`  qty:           ${old.quantity} → ${newQty}`);
  console.log(`  quantity_used: ${old.quantity_used} → ${newUsed}`);
  console.log(`  total_cost:    $${old.total_cost} → $${newTotalCost.toFixed(2)}`);
  console.log(`  price_per_unit: $${old.price_per_unit} → $${newPricePerUnit.toFixed(4)} (weighted avg)`);
  console.log(`  available:     ${Number(old.quantity) - Number(old.quantity_used)} → ${newQty - newUsed}`);
  console.log(`\nSoft-delete: lot ${NEW_LOT_ID} (newer; rolled into older)`);

  if (!apply) {
    console.log("\n→ re-run with --apply");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE additive_purchase_items
      SET quantity = ${newQty},
          quantity_used = ${newUsed},
          total_cost = ${newTotalCost.toFixed(2)},
          price_per_unit = ${newPricePerUnit.toFixed(4)},
          updated_at = NOW()
      WHERE id = ${OLD_LOT_ID}
    `);
    await tx.execute(sql`
      UPDATE additive_purchase_items
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${NEW_LOT_ID}
    `);
  });

  console.log("✅ Merged. One Ginger lot now shows 7 lb available, weighted price $4.00/lb.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
