import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql`ALTER TABLE batch_measurements ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id)`;
  console.log("✅ Migration applied: added created_by column to batch_measurements");
  await sql.end();
}

main().catch(console.error);
