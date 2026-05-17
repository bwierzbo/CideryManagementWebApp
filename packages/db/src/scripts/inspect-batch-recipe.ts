import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const search = process.argv[2] || "Tmmcekhit";

  const batches = await db.execute(sql`
    SELECT id, name, COALESCE(custom_name, name) AS display, product_type::text AS pt,
           CAST(initial_volume_liters AS NUMERIC) AS init_l,
           CAST(current_volume_liters AS NUMERIC) AS cur_l, status::text AS status
    FROM batches WHERE name ILIKE ${`%${search}%`} OR custom_name ILIKE ${`%${search}%`}
  `);

  if (batches.rows.length === 0) {
    console.log("No batch found.");
    process.exit(1);
  }

  const b = batches.rows[0] as any;
  console.log("=== BATCH ===");
  console.log(`  ${b.display} (${b.pt}, ${b.status})`);
  console.log(`  id: ${b.id}`);
  console.log(`  initial: ${Number(b.init_l).toFixed(1)}L  current: ${Number(b.cur_l).toFixed(1)}L`);

  console.log("\n=== ADDITIVES (the recipe) ===");
  const adds = await db.execute(sql`
    SELECT additive_type, additive_name, CAST(amount AS NUMERIC) AS amt, unit,
           CAST(COALESCE(cost_per_unit, '0') AS NUMERIC) AS cpu,
           CAST(COALESCE(total_cost, '0') AS NUMERIC) AS total,
           added_at, notes
    FROM batch_additives
    WHERE batch_id = ${b.id} AND deleted_at IS NULL
    ORDER BY added_at
  `);
  for (const a of adds.rows as any[]) {
    const cost = Number(a.total) > 0
      ? `  [$${Number(a.total).toFixed(2)} total @ $${Number(a.cpu).toFixed(4)}/${a.unit}]`
      : "";
    console.log(
      `  ${String(a.added_at).substring(0, 10)} · ${(a.additive_type as string).padEnd(28)} ${a.additive_name} = ${Number(a.amt).toFixed(2)} ${a.unit}${cost}`,
    );
    if (a.notes) console.log(`    notes: ${a.notes}`);
  }

  console.log("\n=== INFLOWS (where the base liquid came from) ===");
  const inflows = await db.execute(sql`
    SELECT 'transfer' AS kind, sb.name AS source, CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.transferred_at AS at
    FROM batch_transfers bt LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    WHERE bt.destination_batch_id = ${b.id} AND bt.deleted_at IS NULL
    UNION ALL
    SELECT 'merge:' || bmh.source_type, COALESCE(sb.name, '?'), CAST(bmh.volume_added AS NUMERIC), bmh.merged_at
    FROM batch_merge_history bmh LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    WHERE bmh.target_batch_id = ${b.id} AND bmh.deleted_at IS NULL
    ORDER BY 4
  `);
  for (const i of inflows.rows as any[]) {
    console.log(`  ${String(i.at).substring(0, 10)} · ${(i.kind as string).padEnd(25)} ${Number(i.vol).toFixed(1)}L from ${i.source}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
