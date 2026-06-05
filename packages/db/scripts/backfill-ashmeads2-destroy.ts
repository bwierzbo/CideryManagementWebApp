import { db } from "../src/index";
import { sql } from "drizzle-orm";

// Backfill the already-destroyed Ashmeads Kernel #2 (CARBOY-5G-9) with the
// destruction metadata the form now captures:
//   - destruction date = same as Ashmeads Kernel #1 (2026-05-12 19:00:00+00)
//   - laborer Scott Wierzbanowski, 0.2 h @ $25/hr = $5.00
// Idempotent: skips the labor insert if one already exists for this adjustment.

const BATCH_ID = "2d7a8ea1-0434-4372-af8f-f2cf11ee75cc"; // Ashmeads Kernel #2
const ADJ_ID = "d8e26be7-c6b4-414e-a1f5-fd1c6bd73335"; // its destruction adjustment
const SCOTT_WORKER_ID = "09696a75-a8c4-4070-9389-fad36a414b39";
const PERFORMED_BY_USER = "8356e824-6b53-4751-b3ac-08a0df9327b9"; // adjusted_by on the row
const NEW_DATE = "2026-05-12 19:00:00+00"; // matches Ashmeads Kernel #1
const HOURS = "0.20";
const RATE = "25.00";
const COST = "5.00";

async function main() {
  await db.transaction(async (tx) => {
    // 1. Re-date the destruction adjustment + the batch's destroyed_at
    await tx.execute(sql`
      UPDATE batch_volume_adjustments
      SET adjustment_date = ${NEW_DATE}::timestamptz, updated_at = now()
      WHERE id = ${ADJ_ID}::uuid`);
    await tx.execute(sql`
      UPDATE batches
      SET destroyed_at = ${NEW_DATE}::timestamptz, updated_at = now()
      WHERE id = ${BATCH_ID}::uuid`);

    // 2. Labor row (guarded against duplicates)
    const existing = await tx.execute(sql`
      SELECT 1 FROM activity_labor_assignments
      WHERE batch_volume_adjustment_id = ${ADJ_ID}::uuid AND worker_id = ${SCOTT_WORKER_ID}::uuid`);
    if (existing.rows.length) {
      console.log("Labor row already exists — skipping insert.");
    } else {
      await tx.execute(sql`
        INSERT INTO activity_labor_assignments
          (activity_type, batch_volume_adjustment_id, worker_id, hours_worked,
           hourly_rate_snapshot, labor_cost, created_by)
        VALUES ('destruction', ${ADJ_ID}::uuid, ${SCOTT_WORKER_ID}::uuid, ${HOURS},
           ${RATE}, ${COST}, ${PERFORMED_BY_USER}::uuid)`);
      console.log("Inserted destruction labor row for Scott Wierzbanowski.");
    }
  });

  // Verify
  const v = await db.execute(sql`
    SELECT b.custom_name, b.destroyed_at, bva.adjustment_date,
           w.name AS worker, ala.hours_worked, ala.labor_cost, ala.activity_type
    FROM batches b
    JOIN batch_volume_adjustments bva ON bva.id = ${ADJ_ID}::uuid
    LEFT JOIN activity_labor_assignments ala ON ala.batch_volume_adjustment_id = bva.id
    LEFT JOIN workers w ON w.id = ala.worker_id
    WHERE b.id = ${BATCH_ID}::uuid`);
  console.log("\nResult:");
  for (const r of v.rows as any[]) console.log("  " + JSON.stringify(r));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
