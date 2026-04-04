import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // Find the cyser batch in DRUM-120-10
  const batches = await sql`
    SELECT b.id, b.custom_name, b.product_type, b.original_gravity, b.estimated_abv, b.actual_abv,
           b.current_volume, b.current_volume_unit, b.fermentation_stage, v.name as vessel_name
    FROM batches b
    JOIN vessels v ON b.vessel_id = v.id
    WHERE v.name = 'DRUM-120-10' AND b.deleted_at IS NULL
  `;
  console.log("=== Batch ===");
  console.log(JSON.stringify(batches[0], null, 2));

  if (!batches.length) return;
  const batchId = batches[0].id;

  // Get all measurements
  const measurements = await sql`
    SELECT id, measurement_date, specific_gravity, abv, ph, temperature, volume, volume_unit,
           is_estimated, estimate_source, notes
    FROM batch_measurements
    WHERE batch_id = ${batchId} AND deleted_at IS NULL
    ORDER BY measurement_date DESC
  `;
  console.log("\n=== Measurements ===");
  for (const m of measurements) {
    console.log(`${m.measurement_date}: SG=${m.specific_gravity} ABV=${m.abv} pH=${m.ph} vol=${m.volume}${m.volume_unit || ''} est=${m.is_estimated} src=${m.estimate_source || ''}`);
    if (m.notes) console.log(`  notes: ${m.notes}`);
  }

  // Get all additives
  const additives = await sql`
    SELECT id, additive_type, additive_name, amount, unit, notes, added_at
    FROM batch_additives
    WHERE batch_id = ${batchId} AND deleted_at IS NULL
    ORDER BY added_at
  `;
  console.log("\n=== Additives ===");
  for (const a of additives) {
    console.log(`${a.added_at}: ${a.additive_name} ${a.amount} ${a.unit} (${a.additive_type})`);
    if (a.notes) console.log(`  notes: ${a.notes}`);
  }

  await sql.end();
}

main().catch(console.error);
