import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // Find the Cyser batch
  const batches = await sql`
    SELECT b.id, b.custom_name, b.product_type, b.vessel_id, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE (b.custom_name ILIKE '%cyser%' OR b.product_type = 'cyser')
      AND b.deleted_at IS NULL
  `;
  console.log("=== Cyser Batches ===");
  for (const b of batches) {
    console.log(JSON.stringify(b, null, 2));
  }

  if (!batches.length) {
    console.log("No Cyser batches found");
    await sql.end();
    return;
  }

  // Check measurements around 3/24/26 for each Cyser batch
  for (const batch of batches) {
    console.log(`\n=== Measurements for ${batch.custom_name || batch.id} ===`);
    const measurements = await sql`
      SELECT id, measurement_date, specific_gravity, abv, ph, temperature,
             volume, volume_unit, is_estimated, estimate_source,
             taken_by, notes, created_at
      FROM batch_measurements
      WHERE batch_id = ${batch.id} AND deleted_at IS NULL
      ORDER BY measurement_date DESC
    `;
    for (const m of measurements) {
      console.log(JSON.stringify(m, null, 2));
    }
  }

  // Check DRUM-120-3 vessel status
  console.log("\n=== DRUM-120-3 Status ===");
  const vessel = await sql`
    SELECT id, name, status, updated_at
    FROM vessels
    WHERE name = 'DRUM-120-3' AND deleted_at IS NULL
  `;
  for (const v of vessel) {
    console.log(JSON.stringify(v, null, 2));
  }

  // Check DRUM-120-3 cleaning operations
  console.log("\n=== DRUM-120-3 Cleaning Operations ===");
  if (vessel.length) {
    const cleanings = await sql`
      SELECT co.id, co.cleaned_at, co.notes, co.created_at, u.name as cleaned_by_name
      FROM vessel_cleaning_operations co
      LEFT JOIN users u ON co.cleaned_by = u.id
      WHERE co.vessel_id = ${vessel[0].id}
      ORDER BY co.cleaned_at DESC
    `;
    for (const c of cleanings) {
      console.log(JSON.stringify(c, null, 2));
    }
  }

  await sql.end();
}

main().catch(console.error);
