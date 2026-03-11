import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Fix Community Blend #1 children: set start_date to their actual transfer date.
 * Children were created via transfers in July-August 2025 but inherited the parent's
 * start_date of 2024-10-05, making them appear in the wrong reconciliation period.
 */
async function main() {
  console.log("=== Fix Community Blend #1 child start dates ===\n");

  // Update each child's start_date to match the date it was transferred from the parent
  const result = await db.execute(sql`
    UPDATE batches b
    SET start_date = bt.transferred_at::date
    FROM batch_transfers bt
    WHERE bt.destination_batch_id = b.id
      AND bt.source_batch_id = 'e58d6eeb-5168-44a0-914a-5d9a353c73b4'
      AND bt.deleted_at IS NULL
      AND b.parent_batch_id = 'e58d6eeb-5168-44a0-914a-5d9a353c73b4'
      AND b.deleted_at IS NULL
    RETURNING b.id, COALESCE(b.custom_name, b.name) as name, b.start_date as new_start_date
  `);

  console.log(`Updated ${result.rows.length} children:\n`);
  for (const r of result.rows) {
    console.log(`  ${r.name}: start_date → ${r.new_start_date}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
