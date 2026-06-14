/**
 * Apply migration 0137 — recipe_steps.is_optional + recipes.is_template.
 * Idempotent. Run from the project root:
 *   npx tsx ./packages/db/src/scripts/apply-0137-recipe-optional-templates.ts
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`ALTER TABLE recipe_steps ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE`;

  const cols = await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE (table_name = 'recipe_steps' AND column_name = 'is_optional')
       OR (table_name = 'recipes' AND column_name = 'is_template')
    ORDER BY table_name, column_name
  `;
  console.log("Columns present:", cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "));

  await sql.end();
  console.log("Migration 0137 applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
