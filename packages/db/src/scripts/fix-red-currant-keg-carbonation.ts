import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // 1. Find Red Currant keg fills
  const kegFills = await sql`
    SELECT kf.id, kf.filled_at, kf.carbonation_method, kf.carbonation_level,
           kf.volume_taken, kf.volume_taken_unit, kf.status,
           b.custom_name, b.batch_number, b.id as batch_id,
           k.keg_number
    FROM keg_fills kf
    INNER JOIN batches b ON kf.batch_id = b.id
    INNER JOIN kegs k ON kf.keg_id = k.id
    WHERE b.custom_name ILIKE '%red currant%'
      AND kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
    ORDER BY kf.filled_at
  `;

  if (kegFills.length === 0) {
    console.error("No Red Currant keg fills found.");
    await sql.end();
    process.exit(1);
  }

  console.log(`=== Found ${kegFills.length} Red Currant keg fills ===`);
  for (const kf of kegFills) {
    console.log(`  ${kf.id.substring(0, 8)} | Keg: ${kf.keg_number} | ${kf.volume_taken} ${kf.volume_taken_unit} | method=${kf.carbonation_method} | level=${kf.carbonation_level} | status=${kf.status}`);
  }

  // 2. Update carbonation fields on all 3 keg fills
  //    2 vol CO2 = "petillant", method = "forced"
  const ids = kegFills.map((kf: { id: string }) => kf.id);
  await sql`
    UPDATE keg_fills
    SET carbonation_method = 'forced',
        carbonation_level = 'petillant',
        production_notes = COALESCE(production_notes || E'\n', '') || 'Retroactive: force carbonated to 2 vol CO2 on 2026-03-08',
        updated_at = NOW()
    WHERE id = ANY(${ids})
  `;

  console.log(`\n=== Updated ${ids.length} keg fills ===`);
  console.log("  carbonation_method: forced");
  console.log("  carbonation_level: petillant (2 vol CO2)");

  // 3. Verify
  const verify = await sql`
    SELECT kf.id, kf.carbonation_method, kf.carbonation_level, kf.production_notes,
           k.keg_number
    FROM keg_fills kf
    INNER JOIN kegs k ON kf.keg_id = k.id
    WHERE kf.id = ANY(${ids})
  `;
  console.log("\n=== Verification ===");
  for (const kf of verify) {
    console.log(`  ${kf.keg_number}: method=${kf.carbonation_method}, level=${kf.carbonation_level}`);
  }

  await sql.end();
}

main().catch(console.error);
