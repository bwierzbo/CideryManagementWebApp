import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // Fix all active pommeau batches that have wrong fermentation_stage
  const fixed = await sql`
    UPDATE batches
    SET
      fermentation_stage = 'not_applicable',
      status = CASE WHEN status = 'fermentation' THEN 'aging' ELSE status END,
      updated_at = NOW()
    WHERE product_type = 'pommeau'
      AND deleted_at IS NULL
      AND fermentation_stage != 'not_applicable'
    RETURNING id, custom_name, fermentation_stage, status
  `;
  console.log("=== Fixed pommeau fermentation_stage ===");
  for (const b of fixed) {
    console.log(`  ${b.custom_name}: fermStage=${b.fermentation_stage} status=${b.status}`);
  }
  console.log(`Fixed ${fixed.length} batches`);

  // Verify all active Salish batches after fix
  console.log("\n=== All active Salish batches after fix ===");
  const batches = await sql`
    SELECT id, custom_name, product_type, status, fermentation_stage, actual_abv, estimated_abv, current_volume
    FROM batches
    WHERE custom_name LIKE '%Salish%' AND deleted_at IS NULL
    ORDER BY custom_name
  `;
  for (const b of batches) {
    console.log(`${b.custom_name}: type=${b.product_type} status=${b.status} fermStage=${b.fermentation_stage} actualAbv=${b.actual_abv} estAbv=${b.estimated_abv} vol=${b.current_volume}`);
  }

  await sql.end();
}

main().catch(console.error);
