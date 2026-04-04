import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // Check all Salish batches
  const batches = await sql`
    SELECT id, custom_name, product_type, status, fermentation_stage, actual_abv, estimated_abv, current_volume
    FROM batches
    WHERE custom_name LIKE '%Salish%' AND deleted_at IS NULL
    ORDER BY custom_name
  `;
  console.log("=== All active Salish batches ===");
  for (const b of batches) {
    console.log(`${b.custom_name}: type=${b.product_type} status=${b.status} fermStage=${b.fermentation_stage} actualAbv=${b.actual_abv} estAbv=${b.estimated_abv} vol=${b.current_volume}`);
  }

  await sql.end();
}

main().catch(console.error);
