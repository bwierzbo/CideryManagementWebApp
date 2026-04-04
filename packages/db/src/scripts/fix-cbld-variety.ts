import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const varId = "dfa6e0f5-6499-4544-901c-1f3dda03dada";
  const newName = "Calville Blanc d'Hiver";

  await sql`
    UPDATE base_fruit_varieties
    SET name = ${newName},
        cider_category = 'sharp',
        variety_notes = 'French sharp apple',
        updated_at = NOW()
    WHERE id = ${varId}
  `;

  const result = await sql`
    SELECT name, fruit_type, cider_category, variety_notes
    FROM base_fruit_varieties WHERE id = ${varId}
  `;
  console.log("Updated:", result[0]);

  await sql.end();
}

main().catch(console.error);
