import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";

async function runSingleMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error("Usage: tsx src/scripts/run-single-migration.ts <migration-file>");
    console.error("Example: tsx src/scripts/run-single-migration.ts migrations/0085_add_overhead_settings.sql");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const migrationPath = resolve(process.cwd(), migrationFile);
  console.log(`Reading migration from: ${migrationPath}`);

  const migration = readFileSync(migrationPath, "utf-8");
  console.log("Connecting to database...");

  const sql = postgres(connectionString, { max: 1 });

  try {
    console.log(`Running migration: ${migrationFile}`);
    await sql.unsafe(migration);
    console.log("✅ Migration completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runSingleMigration();
