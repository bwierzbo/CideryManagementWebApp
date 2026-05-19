/**
 * Consolidates duplicate additive inventory lots. For each (vendor + variety)
 * group with multiple active rows, it picks the OLDEST row as the canonical
 * lot, converts other rows' quantities to that lot's unit, sums them in, and
 * soft-deletes the rest.
 *
 *   - Same-unit groups: straight sum
 *   - Cross-unit (mass↔mass or volume↔volume): convert via standard tables
 *   - Cross-class (mass↔volume): skipped, flagged in output
 *
 * Why keep the OLDEST row: historical batch_additives.additive_purchase_item_id
 * references favor the longest-lived lot, so fewer references end up pointing
 * at soft-deleted rows. The price-per-unit is recomputed as a weighted
 * average across all source rows.
 *
 * Run:   tsx src/scripts/merge-additive-lot-duplicates.ts          → dry run
 *        tsx src/scripts/merge-additive-lot-duplicates.ts --apply  → commit
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

const TO_GRAMS: Record<string, number> = { g: 1, kg: 1000, lb: 453.592, lbs: 453.592, oz: 28.3495 };
const TO_ML: Record<string, number> = { ml: 1, mL: 1, l: 1000, L: 1000, gal: 3785.41 };

function unitClass(u: string): "mass" | "vol" | "other" {
  const lo = u.toLowerCase();
  if (TO_GRAMS[lo]) return "mass";
  if (TO_ML[lo] || TO_ML[u]) return "vol";
  return "other";
}

function convert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  const fLo = from.toLowerCase();
  const tLo = to.toLowerCase();
  if (TO_GRAMS[fLo] && TO_GRAMS[tLo]) return (amount * TO_GRAMS[fLo]) / TO_GRAMS[tLo];
  if (TO_ML[from] && TO_ML[to]) return (amount * TO_ML[from]) / TO_ML[to];
  if (TO_ML[fLo] && TO_ML[tLo]) return (amount * TO_ML[fLo]) / TO_ML[tLo];
  return null;
}

interface Lot {
  id: string;
  quantity: number;
  used: number;
  totalCost: number;
  unit: string;
  purchaseDate: string;
  expirationDate: string | null;
  lotBatchNumber: string | null;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const all = await db.execute(sql`
    SELECT
      api2.id, api2.quantity, api2.quantity_used, api2.unit, api2.total_cost,
      api2.expiration_date, api2.lot_batch_number,
      ap.purchase_date, ap.vendor_id,
      v.name AS vendor_name,
      av.id AS variety_id, av.name AS variety_name
    FROM additive_purchase_items api2
    JOIN additive_purchases ap ON ap.id = api2.purchase_id
    LEFT JOIN vendors v ON v.id = ap.vendor_id
    LEFT JOIN additive_varieties av ON av.id = api2.additive_variety_id
    WHERE api2.deleted_at IS NULL AND ap.deleted_at IS NULL
    ORDER BY ap.purchase_date ASC, api2.created_at ASC
  `);

  const groups = new Map<string, { vendor: string; variety: string; lots: Lot[] }>();
  for (const r of all.rows as any[]) {
    const key = `${r.vendor_id}|${r.variety_id}`;
    if (!groups.has(key)) groups.set(key, { vendor: r.vendor_name || "?", variety: r.variety_name || "?", lots: [] });
    groups.get(key)!.lots.push({
      id: r.id,
      quantity: Number(r.quantity),
      used: Number(r.quantity_used),
      totalCost: Number(r.total_cost || 0),
      unit: r.unit,
      purchaseDate: String(r.purchase_date).substring(0, 10),
      expirationDate: r.expiration_date ? String(r.expiration_date).substring(0, 10) : null,
      lotBatchNumber: r.lot_batch_number,
    });
  }

  const dupGroups = Array.from(groups.values()).filter((g) => g.lots.length > 1);
  if (dupGroups.length === 0) {
    console.log("✅ No duplicates to merge.");
    process.exit(0);
  }

  type MergePlan = {
    vendor: string;
    variety: string;
    keepId: string;
    keepUnit: string;
    newQuantity: number;
    newUsed: number;
    newTotalCost: number;
    newPricePerUnit: number;
    newExpiration: string | null;
    newLotNumber: string | null;
    deleteIds: string[];
    details: string[];
    skipped?: string;
  };

  const plans: MergePlan[] = [];
  for (const g of dupGroups) {
    const lots = [...g.lots].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
    const canonical = lots[0];
    const classes = new Set(lots.map((l) => unitClass(l.unit)));
    if (classes.has("other") || classes.size > 1) {
      plans.push({
        vendor: g.vendor,
        variety: g.variety,
        keepId: canonical.id,
        keepUnit: canonical.unit,
        newQuantity: canonical.quantity,
        newUsed: canonical.used,
        newTotalCost: canonical.totalCost,
        newPricePerUnit: 0,
        newExpiration: null,
        newLotNumber: null,
        deleteIds: [],
        details: [`incompatible units across lots (${[...new Set(lots.map((l) => l.unit))].join(", ")})`],
        skipped: "incompatible-units",
      });
      continue;
    }

    let totalQty = 0, totalUsed = 0, totalCost = 0;
    let newestExp = canonical.expirationDate;
    let newestLotNo = canonical.lotBatchNumber;
    let newestDate = canonical.purchaseDate;
    const details: string[] = [];
    const deleteIds: string[] = [];

    for (const l of lots) {
      const qtyConv = convert(l.quantity, l.unit, canonical.unit)!;
      const usedConv = convert(l.used, l.unit, canonical.unit)!;
      totalQty += qtyConv;
      totalUsed += usedConv;
      totalCost += l.totalCost;
      if (l.id !== canonical.id) deleteIds.push(l.id);
      const note = l.unit === canonical.unit ? "" : ` → ${qtyConv.toFixed(3)} ${canonical.unit}`;
      details.push(`  ${l.purchaseDate}: ${l.quantity} ${l.unit} (used ${l.used})${note}, $${l.totalCost.toFixed(2)}`);
      if (l.purchaseDate >= newestDate) {
        newestDate = l.purchaseDate;
        if (l.expirationDate) newestExp = l.expirationDate;
        if (l.lotBatchNumber) newestLotNo = l.lotBatchNumber;
      }
    }

    plans.push({
      vendor: g.vendor,
      variety: g.variety,
      keepId: canonical.id,
      keepUnit: canonical.unit,
      newQuantity: totalQty,
      newUsed: totalUsed,
      newTotalCost: totalCost,
      newPricePerUnit: totalQty > 0 ? totalCost / totalQty : 0,
      newExpiration: newestExp,
      newLotNumber: newestLotNo,
      deleteIds,
      details,
    });
  }

  // ─── Report ───
  console.log(`\n${apply ? "APPLYING" : "DRY RUN"}: ${plans.filter((p) => !p.skipped).length} group(s) to merge\n`);
  let totalRowsDeleted = 0;
  for (const p of plans) {
    console.log(`▸ ${p.variety} from ${p.vendor}`);
    p.details.forEach((d) => console.log(d));
    if (p.skipped) {
      console.log(`  ⚠️  SKIPPED: ${p.skipped} — manual cleanup required`);
    } else {
      console.log(
        `  → keep lot ${p.keepId.substring(0, 8)}…: ${p.newQuantity.toFixed(3)} ${p.keepUnit} (used ${p.newUsed.toFixed(3)}, available ${(p.newQuantity - p.newUsed).toFixed(3)}), $${p.newTotalCost.toFixed(2)} total, $${p.newPricePerUnit.toFixed(4)}/${p.keepUnit} weighted avg`
      );
      console.log(`  → soft-delete ${p.deleteIds.length} other lot(s)`);
      totalRowsDeleted += p.deleteIds.length;
    }
    console.log("");
  }

  console.log(`Total rows to soft-delete: ${totalRowsDeleted}`);

  if (!apply) {
    console.log("\n→ re-run with --apply to commit.");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    for (const p of plans) {
      if (p.skipped) continue;
      await tx.execute(sql`
        UPDATE additive_purchase_items
        SET quantity = ${p.newQuantity.toFixed(3)},
            quantity_used = ${p.newUsed.toFixed(3)},
            total_cost = ${p.newTotalCost.toFixed(2)},
            price_per_unit = ${p.newPricePerUnit > 0 ? p.newPricePerUnit.toFixed(4) : null},
            expiration_date = ${p.newExpiration},
            lot_batch_number = ${p.newLotNumber},
            updated_at = NOW()
        WHERE id = ${p.keepId}
      `);
      for (const delId of p.deleteIds) {
        await tx.execute(sql`
          UPDATE additive_purchase_items SET deleted_at = NOW(), updated_at = NOW() WHERE id = ${delId}
        `);
      }
    }
  });

  console.log(`\n✅ Merge complete.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
