/**
 * Audits historical bottle packaging runs for the "qty=1" bug, where the user
 * added packaging materials BEFORE typing the unit count. The form's default
 * staging qty of 1 was frozen into bottle_run_materials.quantity_used, so a
 * 132-bottle run only consumed 1 bottle from inventory and only charged 1
 * bottle's worth of cost into COGS.
 *
 * Heuristic: flag rows where quantity_used = 1 AND the parent run packaged
 * more than 1 unit AND the material is Primary Packaging / Caps / Labels
 * (which are 1:1 with units).
 *
 * Read-only — never modifies anything.
 *
 * Run: pnpm --filter db exec tsx src/scripts/audit-bottle-run-material-qty.ts
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const r = await db.execute(sql`
    SELECT
      pr.id              AS run_id,
      pr.packaged_at,
      pr.units_produced,
      brm.id             AS material_row_id,
      brm.quantity_used,
      brm.material_type,
      brm.cost_per_unit,
      av.name            AS variety_name,
      b.name             AS batch_name
    FROM bottle_run_materials brm
    JOIN bottle_runs pr ON pr.id = brm.bottle_run_id
    JOIN packaging_purchase_items pi ON pi.id = brm.packaging_purchase_item_id
    LEFT JOIN packaging_varieties av ON av.id = pi.packaging_variety_id
    LEFT JOIN batches b ON b.id = pr.batch_id
    WHERE brm.quantity_used = 1
      AND pr.units_produced > 1
      AND brm.material_type IN ('Primary Packaging', 'Caps', 'Labels')
    ORDER BY pr.packaged_at DESC
  `);

  console.log(`\nFound ${r.rows.length} suspicious bottle_run_materials row(s):\n`);
  if (r.rows.length === 0) {
    console.log("✅ No historical damage from the qty=1 bug.");
    process.exit(0);
  }

  let totalUnitsMissed = 0;
  let totalCostMissed = 0;
  for (const row of r.rows as any[]) {
    const units = Number(row.units_produced);
    const charged = Number(row.quantity_used);
    const missed = units - charged;
    const price = Number(row.cost_per_unit || 0);
    const costMissed = missed * price;
    totalUnitsMissed += missed;
    totalCostMissed += costMissed;

    const date = row.packaged_at ? String(row.packaged_at).substring(0, 10) : "?";
    console.log(
      `  [${date}] ${row.batch_name || "?"} → ${row.material_type}: ${row.variety_name || "?"}`
    );
    console.log(
      `    run produced ${units} units, charged ${charged} → missed ${missed} @ $${price.toFixed(2)} = $${costMissed.toFixed(2)}`
    );
    console.log(`    run_id=${row.run_id}  material_row_id=${row.material_row_id}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total units never deducted from inventory: ${totalUnitsMissed}`);
  console.log(`Total material cost missing from COGS:     $${totalCostMissed.toFixed(2)}`);
  console.log(`\nNo changes were made. Review and confirm before running a fix script.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
