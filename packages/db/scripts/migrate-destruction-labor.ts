import { db } from "../src/index";
import { sql } from "drizzle-orm";

// Migration: support labor tracking on batch destruction.
//  1. add 'destruction' to the activity_labor_type enum
//  2. add activity_labor_assignments.batch_volume_adjustment_id (links labor to
//     the destruction's batch_volume_adjustments row)
//  3. index the new column
// Each statement runs autocommit (ALTER TYPE ... ADD VALUE cannot run inside a
// transaction). All are idempotent.

async function main() {
  await db.execute(sql`ALTER TYPE activity_labor_type ADD VALUE IF NOT EXISTS 'destruction'`);
  console.log("✓ enum value 'destruction' present");

  await db.execute(sql`
    ALTER TABLE activity_labor_assignments
    ADD COLUMN IF NOT EXISTS batch_volume_adjustment_id uuid`);
  console.log("✓ column batch_volume_adjustment_id present");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS activity_labor_assignments_bva_idx
    ON activity_labor_assignments (batch_volume_adjustment_id)`);
  console.log("✓ index present");

  console.log("Migration complete.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
