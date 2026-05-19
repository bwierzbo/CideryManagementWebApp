/**
 * Audits additive_purchase_items for duplicate lots — multiple active rows
 * for the same vendor + variety. Read-only. Run before any merge script.
 *
 * Why duplicates exist: additivePurchases.create historically inserted a new
 * row for every purchase. The May 2026 patch added merge-on-create, but
 * historical receipts accumulated as separate lots.
 *
 * Cross-unit duplicates (e.g. 7 kg + 0 lb of Raspberries) are flagged with
 * a [cross-unit] marker so you know they'll require unit conversion when
 * merged. The merge script handles mass↔mass and volume↔volume via the same
 * conversion tables used in the API.
 *
 * Run: pnpm --filter db exec tsx src/scripts/audit-additive-lot-duplicates.ts
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

interface LotRow {
  id: string;
  quantity: number;
  used: number;
  available: number;
  unit: string;
  totalCost: number;
  pricePerUnit: number | null;
  purchaseDate: string;
  expirationDate: string | null;
  lotBatchNumber: string | null;
}

const MASS_UNITS = new Set(["g", "kg", "lb", "lbs", "oz"]);
const VOL_UNITS = new Set(["ml", "mL", "L", "l", "gal"]);
function unitClass(u: string): "mass" | "vol" | "other" {
  const lo = u.toLowerCase();
  if (MASS_UNITS.has(lo)) return "mass";
  if (VOL_UNITS.has(lo)) return "vol";
  return "other";
}

async function main() {
  // Pull every active lot with vendor + variety
  const all = await db.execute(sql`
    SELECT
      api2.id, api2.quantity, api2.quantity_used, api2.unit, api2.total_cost, api2.price_per_unit,
      api2.expiration_date, api2.lot_batch_number,
      ap.purchase_date, ap.vendor_id,
      v.name AS vendor_name,
      av.id AS variety_id, av.name AS variety_name, av.item_type
    FROM additive_purchase_items api2
    JOIN additive_purchases ap ON ap.id = api2.purchase_id
    LEFT JOIN vendors v ON v.id = ap.vendor_id
    LEFT JOIN additive_varieties av ON av.id = api2.additive_variety_id
    WHERE api2.deleted_at IS NULL AND ap.deleted_at IS NULL
    ORDER BY av.name, v.name, ap.purchase_date ASC
  `);

  // Group by vendor + variety
  type GroupKey = string;
  const groups = new Map<GroupKey, { vendor: string; variety: string; rows: (LotRow & { unit: string })[] }>();
  for (const r of all.rows as any[]) {
    const key = `${r.vendor_id}|${r.variety_id}`;
    if (!groups.has(key)) groups.set(key, { vendor: r.vendor_name || "(no vendor)", variety: r.variety_name || "(unknown)", rows: [] });
    groups.get(key)!.rows.push({
      id: r.id,
      quantity: Number(r.quantity),
      used: Number(r.quantity_used),
      available: Number(r.quantity) - Number(r.quantity_used),
      unit: r.unit,
      totalCost: Number(r.total_cost || 0),
      pricePerUnit: r.price_per_unit ? Number(r.price_per_unit) : null,
      purchaseDate: r.purchase_date ? String(r.purchase_date).substring(0, 10) : "(no date)",
      expirationDate: r.expiration_date ? String(r.expiration_date).substring(0, 10) : null,
      lotBatchNumber: r.lot_batch_number,
    });
  }

  const dupGroups = Array.from(groups.values()).filter((g) => g.rows.length > 1);
  if (dupGroups.length === 0) {
    console.log("✅ No duplicate additive lots found.");
    process.exit(0);
  }

  console.log(`\nFound ${dupGroups.length} vendor+variety group(s) with duplicates:\n`);

  let totalRowsToMerge = 0;
  let crossUnitGroups = 0;
  let incompatibleGroups = 0;

  for (const g of dupGroups) {
    const units = new Set(g.rows.map((r) => r.unit.toLowerCase()));
    const classes = new Set(g.rows.map((r) => unitClass(r.unit)));
    let mark = "";
    if (units.size > 1) {
      mark = classes.size === 1 ? " [cross-unit, convertible]" : " ❌ [incompatible units]";
      if (classes.size === 1) crossUnitGroups++;
      else incompatibleGroups++;
    }
    console.log(`▸ ${g.variety} from ${g.vendor}${mark}`);
    for (const r of g.rows) {
      console.log(`    ${r.purchaseDate} → qty=${r.quantity} ${r.unit}, used=${r.used}, available=${r.available}, total=$${r.totalCost.toFixed(2)}${r.pricePerUnit !== null ? `, $${r.pricePerUnit}/${r.unit}` : ""}`);
    }
    totalRowsToMerge += g.rows.length - 1; // we keep 1 per group, soft-delete the rest
    console.log("");
  }

  console.log("─── Summary ───");
  console.log(`Groups with duplicates: ${dupGroups.length}`);
  console.log(`  - same-unit groups:        ${dupGroups.length - crossUnitGroups - incompatibleGroups}`);
  console.log(`  - cross-unit convertible:  ${crossUnitGroups}`);
  console.log(`  - incompatible (skip):     ${incompatibleGroups}`);
  console.log(`Rows that would be soft-deleted after merge: ${totalRowsToMerge}`);
  console.log(`\n(No changes made. Run merge-additive-lot-duplicates.ts to consolidate.)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
