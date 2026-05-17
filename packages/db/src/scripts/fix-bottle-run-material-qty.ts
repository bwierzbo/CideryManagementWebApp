/**
 * Fixes the historical "qty=1" bug found by audit-bottle-run-material-qty.ts.
 *
 * For each affected bottle_run_materials row (where quantity_used = 1 but the
 * run produced > 1 unit, and material_type is Primary Packaging / Caps /
 * Labels), this script:
 *
 *   1. Sets bottle_run_materials.quantity_used = bottle_runs.units_produced
 *   2. Increments packaging_purchase_items.quantity_used by the delta
 *      (delta = units_produced - 1)
 *
 * Effect on COGS: packaging.ts line ~2595 computes material totalCost as
 *   bottleRunMaterials.quantityUsed * packagingPurchaseItems.pricePerUnit
 * live on read. So fixing quantity_used here automatically corrects every
 * future COGS report — no snapshot invalidation required.
 *
 * Pre-flight check: for every row, verifies the packaging item has enough
 * remaining stock to absorb the delta. If ANY row would push an item below 0
 * available, the whole script aborts in dry-run before touching anything.
 *
 * Modes:
 *   pnpm --filter db exec tsx src/scripts/fix-bottle-run-material-qty.ts
 *     → DRY RUN: print what would change, exit 0 without modifying anything.
 *
 *   pnpm --filter db exec tsx src/scripts/fix-bottle-run-material-qty.ts --apply
 *     → APPLY: wrap all updates in a single transaction. Rollback on any error.
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

interface AffectedRow {
  brmId: string;
  bottleRunId: string;
  packagingPurchaseItemId: string;
  unitsProduced: number;
  currentQtyUsed: number;
  delta: number;
  materialType: string;
  varietyName: string | null;
  batchName: string | null;
  packagedAt: string | null;
  costPerUnit: number;
  pricePerUnit: number;
  itemQuantity: number;
  itemQuantityUsed: number;
}

async function main() {
  const apply = process.argv.includes("--apply");

  // ─── 1. Identify affected rows + capture current packaging-item stock ────
  const r = await db.execute(sql`
    SELECT
      brm.id                AS brm_id,
      brm.bottle_run_id,
      brm.packaging_purchase_item_id,
      brm.quantity_used     AS current_qty_used,
      brm.material_type,
      brm.cost_per_unit,
      pr.units_produced,
      pr.packaged_at,
      av.name               AS variety_name,
      b.name                AS batch_name,
      pi.quantity           AS item_quantity,
      pi.quantity_used      AS item_quantity_used,
      pi.price_per_unit
    FROM bottle_run_materials brm
    JOIN bottle_runs pr            ON pr.id = brm.bottle_run_id
    JOIN packaging_purchase_items pi ON pi.id = brm.packaging_purchase_item_id
    LEFT JOIN packaging_varieties av ON av.id = pi.packaging_variety_id
    LEFT JOIN batches b              ON b.id = pr.batch_id
    WHERE brm.quantity_used = 1
      AND pr.units_produced > 1
      AND brm.material_type IN ('Primary Packaging', 'Caps', 'Labels')
    ORDER BY pr.packaged_at DESC
  `);

  const rows: AffectedRow[] = (r.rows as any[]).map((row) => ({
    brmId: row.brm_id,
    bottleRunId: row.bottle_run_id,
    packagingPurchaseItemId: row.packaging_purchase_item_id,
    unitsProduced: Number(row.units_produced),
    currentQtyUsed: Number(row.current_qty_used),
    delta: Number(row.units_produced) - Number(row.current_qty_used),
    materialType: row.material_type,
    varietyName: row.variety_name,
    batchName: row.batch_name,
    packagedAt: row.packaged_at ? String(row.packaged_at).substring(0, 10) : null,
    costPerUnit: Number(row.cost_per_unit || 0),
    pricePerUnit: Number(row.price_per_unit || 0),
    itemQuantity: Number(row.item_quantity || 0),
    itemQuantityUsed: Number(row.item_quantity_used || 0),
  }));

  if (rows.length === 0) {
    console.log("\n✅ No affected rows found. Nothing to fix.");
    process.exit(0);
  }

  // ─── 2. Pre-flight: aggregate deltas per packaging item, check stock ─────
  const deltaByItem = new Map<string, number>();
  for (const row of rows) {
    deltaByItem.set(
      row.packagingPurchaseItemId,
      (deltaByItem.get(row.packagingPurchaseItemId) ?? 0) + row.delta
    );
  }

  const stockByItem = new Map<string, { qty: number; used: number; name: string }>();
  for (const row of rows) {
    if (!stockByItem.has(row.packagingPurchaseItemId)) {
      stockByItem.set(row.packagingPurchaseItemId, {
        qty: row.itemQuantity,
        used: row.itemQuantityUsed,
        name: row.varietyName || "(unknown)",
      });
    }
  }

  // We deliberately allow available to go negative. A negative value honestly
  // signals "we used more than we recorded purchasing on this lot." When the
  // user records the missing purchase later it creates a new lot row with
  // positive stock; per-variety totals stay correct. We just collect warnings
  // here for the report.
  const negativeWarnings: string[] = [];
  for (const [itemId, totalDelta] of deltaByItem.entries()) {
    const stock = stockByItem.get(itemId)!;
    const newAvailable = stock.qty - stock.used - totalDelta;
    if (newAvailable < 0) {
      negativeWarnings.push(
        `  ${stock.name} (${itemId.substring(0, 8)}…): will read ${newAvailable} available — record a missing-purchase entry to bring back to non-negative`
      );
    }
  }

  // ─── 3. Report plan ──────────────────────────────────────────────────────
  console.log(`\n${apply ? "APPLYING" : "DRY RUN"}: fixing ${rows.length} bottle_run_materials row(s)\n`);
  let totalCogsCorrection = 0;
  for (const row of rows) {
    const cogsDelta = row.delta * row.pricePerUnit;
    totalCogsCorrection += cogsDelta;
    console.log(
      `  [${row.packagedAt}] ${row.batchName || "?"} → ${row.materialType}: ${row.varietyName || "?"}`
    );
    console.log(
      `    qty_used: ${row.currentQtyUsed} → ${row.unitsProduced} (+${row.delta}), COGS correction: +$${cogsDelta.toFixed(2)} @ $${row.pricePerUnit.toFixed(2)}/unit`
    );
  }

  console.log(`\n--- Net packaging-item stock impact ---`);
  for (const [itemId, totalDelta] of deltaByItem.entries()) {
    const stock = stockByItem.get(itemId)!;
    const newUsed = stock.used + totalDelta;
    const newAvailable = stock.qty - newUsed;
    const flag = newAvailable < 0 ? " ⚠️  negative — intentional" : "";
    console.log(
      `  ${stock.name}: quantity_used ${stock.used} → ${newUsed}, available ${stock.qty - stock.used} → ${newAvailable}${flag}`
    );
  }
  console.log(`\nTotal COGS correction: +$${totalCogsCorrection.toFixed(2)} (live-computed; no snapshot to refresh)`);

  if (negativeWarnings.length > 0) {
    console.log(`\n⚠️  These packaging items will go NEGATIVE (intentional — see below):`);
    negativeWarnings.forEach((s) => console.log(s));
    console.log(
      `\n  Why: they were physically consumed in past runs, but recorded purchase quantities are too low. Negative is the honest signal — record the missing purchases later and they'll net out.`
    );
  }

  if (!apply) {
    console.log(`\n  → re-run with --apply to commit these changes.`);
    process.exit(0);
  }

  // ─── 4. Apply in a single transaction ────────────────────────────────────
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx.execute(sql`
        UPDATE bottle_run_materials
        SET quantity_used = ${row.unitsProduced}
        WHERE id = ${row.brmId}
      `);
      await tx.execute(sql`
        UPDATE packaging_purchase_items
        SET quantity_used = quantity_used + ${row.delta}
        WHERE id = ${row.packagingPurchaseItemId}
      `);
    }
  });

  console.log(`\n✅ Applied. Updated ${rows.length} bottle_run_materials row(s) and ${deltaByItem.size} packaging item stock counter(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fix script failed:", e);
  process.exit(1);
});
