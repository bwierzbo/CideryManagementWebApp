/**
 * Compare additive usage across batches that match a name pattern.
 * Shows each batch side-by-side with absolute amounts AND g/L (or unit/L)
 * normalized to initial volume — so you can see if the recipe was consistent.
 *
 * Usage:
 *   pnpm --filter db exec tsx src/scripts/compare-recipes.ts "strawberry rhubarb"
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

interface BatchRow {
  id: string;
  display: string;
  pt: string;
  status: string;
  init_l: string | null;
  start_date: Date;
}

interface AdditiveRow {
  batch_id: string;
  additive_type: string;
  additive_name: string;
  amt: string;
  unit: string;
  total: string;
}

async function main() {
  const search = process.argv[2] || "strawberry rhubarb";
  const pattern = `%${search}%`;

  const batches = await db.execute(sql`
    SELECT id, COALESCE(custom_name, name) AS display, product_type::text AS pt,
           status::text AS status,
           CAST(initial_volume_liters AS NUMERIC) AS init_l,
           start_date
    FROM batches
    WHERE deleted_at IS NULL
      AND (custom_name ILIKE ${pattern} OR name ILIKE ${pattern})
    ORDER BY start_date
  `);

  const rows = batches.rows as unknown as BatchRow[];
  if (rows.length === 0) {
    console.log(`No batches matching "${search}".`);
    process.exit(0);
  }

  const ids = rows.map((r) => r.id);
  const idsLit = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);

  const adds = await db.execute(sql`
    SELECT batch_id::text AS batch_id,
           additive_type, additive_name,
           CAST(amount AS NUMERIC) AS amt, unit,
           CAST(COALESCE(total_cost, '0') AS NUMERIC) AS total
    FROM batch_additives
    WHERE batch_id IN (${idsLit}) AND deleted_at IS NULL
    ORDER BY batch_id, added_at
  `);

  const byBatch = new Map<string, AdditiveRow[]>();
  for (const a of adds.rows as unknown as AdditiveRow[]) {
    if (!byBatch.has(a.batch_id)) byBatch.set(a.batch_id, []);
    byBatch.get(a.batch_id)!.push(a);
  }

  console.log(`Found ${rows.length} batch(es) matching "${search}":\n`);

  // Per-batch breakdown
  for (const b of rows) {
    const init = Number(b.init_l ?? 0);
    const initStr = init > 0 ? `${init.toFixed(1)}L initial` : "?L initial";
    console.log(`──── ${b.display}  (${b.pt}, ${b.status}, ${initStr}, started ${String(b.start_date).substring(0, 10)})`);

    const adds = byBatch.get(b.id) || [];
    if (adds.length === 0) {
      console.log("    (no additives)");
      continue;
    }

    let totalCost = 0;
    for (const a of adds) {
      const amt = Number(a.amt);
      const cost = Number(a.total);
      totalCost += cost;

      // Normalize to g/L when possible
      let normalized = "";
      if (init > 0) {
        if (a.unit === "kg") {
          normalized = ` = ${((amt * 1000) / init).toFixed(2)} g/L`;
        } else if (a.unit === "g") {
          normalized = ` = ${(amt / init).toFixed(3)} g/L`;
        } else if (a.unit === "g/L") {
          // already a concentration; compute total
          normalized = ` (= ${(amt * init).toFixed(0)} g total)`;
        } else if (a.unit === "L" || a.unit === "ml" || a.unit === "mL") {
          const ml = a.unit === "L" ? amt * 1000 : amt;
          normalized = ` = ${(ml / init).toFixed(2)} mL/L`;
        }
      }

      const costStr = cost > 0 ? `  $${cost.toFixed(2)}` : "";
      console.log(
        `    ${(a.additive_type as string).padEnd(28)} ${a.additive_name.padEnd(36)} ${amt.toFixed(2)} ${a.unit}${normalized}${costStr}`,
      );
    }
    if (totalCost > 0) console.log(`    ──── recipe additive cost: $${totalCost.toFixed(2)}`);
    console.log();
  }

  // Side-by-side g/L summary table for fast comparison of the recipe ratios
  console.log("══════ COMPARISON (g/L of initial volume) ══════");
  // Collect unique (type, name) pairs
  const uniq = new Set<string>();
  for (const list of byBatch.values()) {
    for (const a of list) uniq.add(`${a.additive_type}||${a.additive_name}`);
  }
  const ingredients = Array.from(uniq).sort();

  // Header
  const labels = rows.map((r, i) => `B${i + 1}`);
  const labelLine = "ingredient".padEnd(60) + labels.map((l) => l.padStart(10)).join("");
  console.log(labelLine);
  console.log("-".repeat(labelLine.length));

  for (const key of ingredients) {
    const [type, name] = key.split("||");
    const label = `${type}: ${name}`.substring(0, 58).padEnd(60);
    const cells = rows.map((b) => {
      const init = Number(b.init_l ?? 0);
      const list = byBatch.get(b.id) || [];
      const found = list.find((a) => a.additive_type === type && a.additive_name === name);
      if (!found || init <= 0) return "—".padStart(10);

      const amt = Number(found.amt);
      let gPerL: number | null = null;
      if (found.unit === "kg") gPerL = (amt * 1000) / init;
      else if (found.unit === "g") gPerL = amt / init;
      else if (found.unit === "g/L") gPerL = amt;
      if (gPerL === null) return `${amt}${found.unit}`.padStart(10);
      return `${gPerL.toFixed(1)}`.padStart(10);
    });
    console.log(label + cells.join(""));
  }

  console.log("\nLegend:");
  rows.forEach((r, i) => {
    console.log(`  B${i + 1} = ${r.display.substring(0, 60)} (${Number(r.init_l ?? 0).toFixed(0)}L)`);
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
