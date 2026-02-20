import { db } from "../index";
import { sql } from "drizzle-orm";

/**
 * Backfill distributedAt for distributed bottle runs and keg fills.
 *
 * Logic:
 * - Bottle runs: distributedAt = COALESCE(labeled_at, packaged_at) + 3 days
 * - Keg fills:   distributedAt = filled_at + 3 days
 *
 * Only updates rows where status is distributed/completed/returned.
 */
async function main() {
  console.log("Backfilling distributedAt = last_activity + 3 days...\n");

  // Preview bottle runs that will be updated
  const bottlePreview = await db.execute(sql`
    SELECT id, status,
      packaged_at,
      labeled_at,
      distributed_at AS current_distributed_at,
      COALESCE(labeled_at, packaged_at) + INTERVAL '3 days' AS new_distributed_at
    FROM bottle_runs
    WHERE status IN ('distributed', 'completed')
      AND voided_at IS NULL
    ORDER BY packaged_at
  `);
  console.log(`=== Bottle Runs to update: ${bottlePreview.rowCount} ===`);
  for (const row of bottlePreview.rows) {
    const r = row as any;
    console.log(
      `  ${r.id.slice(0, 8)}... status=${r.status} ` +
      `packaged=${r.packaged_at ? new Date(r.packaged_at).toISOString().slice(0, 10) : 'NULL'} ` +
      `labeled=${r.labeled_at ? new Date(r.labeled_at).toISOString().slice(0, 10) : 'NULL'} ` +
      `current_dist=${r.current_distributed_at ? new Date(r.current_distributed_at).toISOString().slice(0, 10) : 'NULL'} → ` +
      `new_dist=${r.new_distributed_at ? new Date(r.new_distributed_at).toISOString().slice(0, 10) : 'NULL'}`
    );
  }

  // Preview keg fills that will be updated
  const kegPreview = await db.execute(sql`
    SELECT id, status,
      filled_at,
      distributed_at AS current_distributed_at,
      filled_at + INTERVAL '3 days' AS new_distributed_at
    FROM keg_fills
    WHERE status IN ('distributed', 'returned')
      AND voided_at IS NULL
      AND deleted_at IS NULL
    ORDER BY filled_at
  `);
  console.log(`\n=== Keg Fills to update: ${kegPreview.rowCount} ===`);
  for (const row of kegPreview.rows) {
    const r = row as any;
    console.log(
      `  ${r.id.slice(0, 8)}... status=${r.status} ` +
      `filled=${r.filled_at ? new Date(r.filled_at).toISOString().slice(0, 10) : 'NULL'} ` +
      `current_dist=${r.current_distributed_at ? new Date(r.current_distributed_at).toISOString().slice(0, 10) : 'NULL'} → ` +
      `new_dist=${r.new_distributed_at ? new Date(r.new_distributed_at).toISOString().slice(0, 10) : 'NULL'}`
    );
  }

  console.log("\nApplying updates...\n");

  // Update bottle runs: distributedAt = COALESCE(labeled_at, packaged_at) + 3 days
  const bottleResult = await db.execute(sql`
    UPDATE bottle_runs
    SET distributed_at = COALESCE(labeled_at, packaged_at) + INTERVAL '3 days',
        updated_at = NOW()
    WHERE status IN ('distributed', 'completed')
      AND voided_at IS NULL
  `);
  console.log(`Bottle runs updated: ${bottleResult.rowCount}`);

  // Update keg fills: distributedAt = filled_at + 3 days
  const kegResult = await db.execute(sql`
    UPDATE keg_fills
    SET distributed_at = filled_at + INTERVAL '3 days',
        updated_at = NOW()
    WHERE status IN ('distributed', 'returned')
      AND voided_at IS NULL
      AND deleted_at IS NULL
  `);
  console.log(`Keg fills updated: ${kegResult.rowCount}`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
