import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  // Search for batches mentioning strawberry rhubarb
  const sr = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.status,
      b.current_volume,
      b.current_volume_unit,
      b.initial_volume_liters,
      b.start_date,
      b.created_at,
      b.deleted_at,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE (b.name ILIKE '%strawberry%' AND b.name ILIKE '%rhubarb%')
       OR (b.custom_name ILIKE '%strawberry%' AND b.custom_name ILIKE '%rhubarb%')
    ORDER BY b.start_date DESC NULLS LAST, b.created_at DESC
    LIMIT 10
  `);
  console.log("=== Strawberry Rhubarb batches ===");
  for (const row of sr.rows as any[]) {
    console.log(
      `  ${row.start_date || row.created_at}  ${row.custom_name || row.name}  [status=${row.status}, vessel=${row.vessel_name}, vol=${row.current_volume}${row.current_volume_unit}, deleted=${row.deleted_at ? "YES" : "no"}]`,
    );
  }

  // Search for batches mentioning lavender black currant
  const lbc = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.status,
      b.current_volume,
      b.current_volume_unit,
      b.initial_volume_liters,
      b.start_date,
      b.created_at,
      b.deleted_at,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE (b.name ILIKE '%lavender%' AND (b.name ILIKE '%currant%' OR b.name ILIKE '%black%'))
       OR (b.custom_name ILIKE '%lavender%' AND (b.custom_name ILIKE '%currant%' OR b.custom_name ILIKE '%black%'))
       OR b.name ILIKE '%lavender%black%currant%'
       OR b.custom_name ILIKE '%lavender%black%currant%'
    ORDER BY b.start_date DESC NULLS LAST, b.created_at DESC
    LIMIT 10
  `);
  console.log("\n=== Lavender Black Currant batches ===");
  for (const row of lbc.rows as any[]) {
    console.log(
      `  ${row.start_date || row.created_at}  ${row.custom_name || row.name}  [status=${row.status}, vessel=${row.vessel_name}, vol=${row.current_volume}${row.current_volume_unit}, deleted=${row.deleted_at ? "YES" : "no"}]`,
    );
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
