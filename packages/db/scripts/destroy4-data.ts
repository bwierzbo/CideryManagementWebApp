import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Workers matching 'wierzbanowski' ===");
  const w = await db.execute(sql`
    SELECT id, name, hourly_rate, is_active FROM workers
    WHERE name ILIKE '%wierzbanowski%' ORDER BY name`);
  for (const r of w.rows as any[]) console.log(`  ${r.id}  ${r.name}  $${r.hourly_rate}/hr  active=${r.is_active}`);

  console.log("\n=== Ashmeads Kernel batches (destroy info) ===");
  const b = await db.execute(sql`
    SELECT b.id, b.custom_name, v.name AS vessel, b.status, b.destroyed_at,
           b.destruction_category, b.destruction_reason
    FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.custom_name ILIKE '%ashmead%'
    ORDER BY b.destroyed_at NULLS LAST`);
  for (const r of b.rows as any[])
    console.log(`  "${r.custom_name}" (${r.id}) vessel=${r.vessel} status=${r.status} destroyed_at=${r.destroyed_at} cat=${r.destruction_category}`);

  console.log("\n=== Destruction adjustment rows for Ashmeads ===");
  const adj = await db.execute(sql`
    SELECT bva.id, b.custom_name, bva.adjustment_date, bva.adjustment_type,
           bva.adjustment_amount, bva.adjusted_by, bva.created_at
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE b.custom_name ILIKE '%ashmead%' AND bva.adjustment_type = 'destruction'
    ORDER BY bva.created_at`);
  for (const r of adj.rows as any[])
    console.log(`  adj=${r.id} "${r.custom_name}" date=${r.adjustment_date} amt=${r.adjustment_amount} by=${r.adjusted_by} created=${r.created_at}`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
