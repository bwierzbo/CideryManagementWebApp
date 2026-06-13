/**
 * Apply migration 0136_production_plans.sql — production plans + planned batches.
 * Idempotent (CREATE TABLE / INDEX IF NOT EXISTS). Run from the project root:
 *   npx tsx ./packages/db/src/scripts/apply-0136-production-plans.ts
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE IF NOT EXISTS production_plans (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      year            INTEGER,
      is_operational  BOOLEAN NOT NULL DEFAULT FALSE,
      notes           TEXT,
      created_by      UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by      UUID REFERENCES users(id),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS production_plans_org_idx ON production_plans (organization_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS planned_batches (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id         UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
      recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      label           TEXT,
      target_volume_l NUMERIC(12, 3) NOT NULL,
      bottle_volume_l NUMERIC(12, 3),
      keg_volume_l    NUMERIC(12, 3),
      period          TEXT NOT NULL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS planned_batches_plan_idx ON planned_batches (plan_id, sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS planned_batches_recipe_idx ON planned_batches (recipe_id)`;

  // Confirm both tables exist.
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('production_plans', 'planned_batches')
    ORDER BY table_name
  `;
  console.log("Tables present:", tables.map((t) => t.table_name).join(", "));

  await sql.end();
  console.log("Migration 0136 applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
