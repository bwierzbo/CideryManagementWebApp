/**
 * Owner-directed catch-up purchases (entered 2026-08-16, dated 2026-07-01 —
 * before the July production campaign drove inventory negative).
 * Idempotent: skips if the marker note already exists.
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const MARKER = "July catch-up order (backfilled 2026-08-16)";
const DATE = "2026-07-01";

async function main() {
  const existing = await db.execute(
    sql`SELECT id FROM packaging_purchases WHERE notes = ${MARKER} LIMIT 1`,
  );
  if ((existing as unknown as { rows?: unknown[] }).rows?.length) {
    console.log("Already applied — nothing to do.");
    process.exit(0);
  }

  const vendors = {
    innovative: "5fc2f286-1698-42ce-81e3-865fbde58681",
    amazon: "ea405a50-7226-487e-b622-2dac13f9db4f",
    costco: "88030c4f-658c-4411-b7c2-804970eefd57",
    graysMarsh: "1ce5d2dd-34f0-465b-88aa-7ec6799227c7",
    olympicBluff: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
  };

  await db.transaction(async (tx) => {
    const pkgVariety = async (name: string) => {
      const r = await tx.execute(
        sql`SELECT id FROM packaging_varieties WHERE name = ${name} LIMIT 1`,
      );
      const id = (r as any).rows?.[0]?.id;
      if (!id) throw new Error(`packaging variety not found: ${name}`);
      return id as string;
    };
    const addVariety = async (name: string) => {
      const r = await tx.execute(
        sql`SELECT id FROM additive_varieties WHERE name = ${name} LIMIT 1`,
      );
      const id = (r as any).rows?.[0]?.id;
      if (!id) throw new Error(`additive variety not found: ${name}`);
      return id as string;
    };

    const bottles = await pkgVariety("750ml Glass Bottles");
    const caps = await pkgVariety("750ml Bottle Caps");

    // --- Packaging purchase 1: Innovative Sourcing — bottles order A ---
    const newPkgPurchase = async (vendorId: string, totalCost: number, note: string) => {
      const r = await tx.execute(sql`
        INSERT INTO packaging_purchases (vendor_id, purchase_date, total_cost, notes, created_at, updated_at)
        VALUES (${vendorId}, ${DATE}, ${totalCost.toFixed(2)}, ${note}, NOW(), NOW())
        RETURNING id`);
      return (r as any).rows[0].id as string;
    };
    const pkgItem = (purchaseId: string, varietyId: string, size: string, qty: number, price: number) =>
      tx.execute(sql`
        INSERT INTO packaging_purchase_items
          (purchase_id, packaging_variety_id, package_type, size, quantity, price_per_unit, total_cost, unit_type, quantity_used, created_at, updated_at)
        VALUES (${purchaseId}, ${varietyId}, 'other', ${size}, ${qty}, ${price.toFixed(4)}, ${(qty * price).toFixed(2)}, 'individual', 0, NOW(), NOW())`);

    const p1 = await newPkgPurchase(vendors.innovative, 2744 * 0.95, MARKER);
    await pkgItem(p1, bottles, "750ml Glass Bottles", 2744, 0.95);

    const p2 = await newPkgPurchase(vendors.innovative, 2744 * 0.95, `${MARKER} — second pallet`);
    await pkgItem(p2, bottles, "750ml Glass Bottles", 2744, 0.95);

    const p3 = await newPkgPurchase(vendors.amazon, 5000 * 0.03, `${MARKER} — caps`);
    await pkgItem(p3, caps, "750ml Bottle Caps", 5000, 0.03);

    // --- Additive purchases ---
    const newAddPurchase = async (vendorId: string, totalCost: number, note: string) => {
      const r = await tx.execute(sql`
        INSERT INTO additive_purchases (vendor_id, purchase_date, total_cost, notes, created_at, updated_at)
        VALUES (${vendorId}, ${DATE}, ${totalCost.toFixed(2)}, ${note}, NOW(), NOW())
        RETURNING id`);
      return (r as any).rows[0].id as string;
    };
    const addItem = async (
      purchaseId: string, varietyName: string, brand: string, qty: number, unit: string,
      price: number | null, note?: string,
    ) => {
      const vid = await addVariety(varietyName);
      await tx.execute(sql`
        INSERT INTO additive_purchase_items
          (purchase_id, additive_variety_id, brand_manufacturer, product_name, quantity, unit, price_per_unit, total_cost, notes, quantity_used, created_at, updated_at)
        VALUES (${purchaseId}, ${vid}, ${brand}, ${varietyName}, ${qty}, ${unit},
                ${price === null ? null : price.toFixed(4)},
                ${price === null ? null : (qty * price).toFixed(2)},
                ${note ?? null}, 0, NOW(), NOW())`);
    };

    // Costco: sugar 4 × 25 lb bags
    const a1 = await newAddPurchase(vendors.costco, 100 * 0.5357, `${MARKER} — sugar`);
    await addItem(a1, "Cane Sugar", "Costco", 100, "lb", 0.5357, "4 × 25 lb bags");

    // Grays Marsh: berries in 30 lb containers @ $105 ($3.50/lb)
    const berriesCost = (120 + 90 + 60) * 3.5;
    const a2 = await newAddPurchase(vendors.graysMarsh, berriesCost, `${MARKER} — frozen berries`);
    await addItem(a2, "Blackberries", "Grays Marsh", 120, "lb", 3.5, "4 × 30 lb containers @ $105");
    await addItem(a2, "Raspberries", "Grays Marsh", 90, "lb", 3.5, "3 × 30 lb containers @ $105");
    await addItem(a2, "Strawberries", "Grays Marsh", 60, "lb", 3.5, "2 × 30 lb containers @ $105");

    // Olympic Bluff: rhubarb concentrate 130 L + lavender to 3 kg on hand
    const a3 = await newAddPurchase(vendors.olympicBluff, 130 * 16.67, `${MARKER} — concentrate + lavender`);
    await addItem(a3, "Rhubarb Concentrate (SG 1.030)", "Olympic Bluff Cidery", 130, "L", 16.67);
    await addItem(a3, "Lavender", "Olympic Bluff Cidery", 3.33, "kg", null, "price TBD — owner to confirm");

    // Amazon: hops, 2 × 1 lb bags each at last order's price
    const a4 = await newAddPurchase(vendors.amazon, 4 * 20, `${MARKER} — hops`);
    await addItem(a4, "Cascade Hops", "Amazon", 2, "lb", 20);
    await addItem(a4, "Citra Hops", "Amazon", 2, "lb", 20);
  });

  console.log("Catch-up purchases inserted.");

  const check = await db.execute(sql`
    SELECT av.name, ROUND(SUM(ai.quantity::numeric - ai.quantity_used::numeric),2) AS available, MAX(ai.unit) AS unit
    FROM additive_purchase_items ai JOIN additive_varieties av ON av.id = ai.additive_variety_id
    WHERE ai.deleted_at IS NULL
      AND av.name IN ('Blackberries','Raspberries','Strawberries','Cane Sugar','Rhubarb Concentrate (SG 1.030)','Lavender','Cascade Hops','Citra Hops')
    GROUP BY 1 ORDER BY 1`);
  console.table((check as any).rows);
  const check2 = await db.execute(sql`
    SELECT pv.name, SUM(pi.quantity - pi.quantity_used) AS available
    FROM packaging_purchase_items pi JOIN packaging_varieties pv ON pv.id = pi.packaging_variety_id
    WHERE pi.deleted_at IS NULL AND pv.name IN ('750ml Glass Bottles','750ml Bottle Caps')
    GROUP BY 1`);
  console.table((check2 as any).rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
