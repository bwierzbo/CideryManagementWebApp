/**
 * Applies migration 0130_batch_destruction_tracking.sql.
 *
 * drizzle-kit migrate doesn't work in this project; per the memory note,
 * hand-written SQL migrations need a tsx runner. This script executes the
 * three changes from 0130 individually so each is idempotent:
 *   - ALTER TYPE for the new 'destruction' adjustment type
 *   - ADD COLUMN IF NOT EXISTS for destroyed_at / destruction_reason /
 *     destruction_category on batches
 *   - CREATE INDEX IF NOT EXISTS for the partial destroyed_at index
 *
 * One quirk: ALTER TYPE ... ADD VALUE cannot run inside a transaction in
 * PostgreSQL, so the enum addition uses a separate, auto-committed call.
 *
 * Run from project root:
 *   npx tsx packages/db/src/scripts/apply-0130-batch-destruction.ts
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("Applying 0130_batch_destruction_tracking.sql ...");

  // 1. Add 'destruction' to the enum. Cannot run inside a transaction; the
  //    postgres-js client implicitly auto-commits standalone statements.
  await sql`ALTER TYPE batch_volume_adjustment_type ADD VALUE IF NOT EXISTS 'destruction'`;
  console.log("  ✓ enum batch_volume_adjustment_type += 'destruction'");

  // 2. New nullable columns on batches.
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS destroyed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS destruction_reason TEXT`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS destruction_category TEXT`;
  console.log("  ✓ batches += destroyed_at, destruction_reason, destruction_category");

  // 3. Partial index for fast TTB "destroyed this year" queries.
  await sql`CREATE INDEX IF NOT EXISTS batches_destroyed_at_idx
            ON batches (destroyed_at) WHERE destroyed_at IS NOT NULL`;
  console.log("  ✓ index batches_destroyed_at_idx");

  await sql.end();
  console.log("✅ Migration 0130 applied.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
