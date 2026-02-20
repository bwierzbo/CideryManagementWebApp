import { db } from "../index";
import { sql } from "drizzle-orm";

async function main() {
  // Check bottle runs distribution dates
  const bottleDistributed = await db.execute(sql`
    SELECT
      status,
      COUNT(*) as count,
      MIN(packaged_at) as earliest_packaged,
      MAX(packaged_at) as latest_packaged,
      MIN(distributed_at) as earliest_distributed,
      MAX(distributed_at) as latest_distributed,
      COUNT(*) FILTER (WHERE distributed_at IS NULL) as null_distributed_at,
      COUNT(*) FILTER (WHERE distributed_at >= '2025-01-01' AND distributed_at < '2026-01-01') as distributed_in_2025,
      COUNT(*) FILTER (WHERE packaged_at >= '2025-01-01' AND packaged_at < '2026-01-01') as packaged_in_2025
    FROM bottle_runs
    WHERE voided_at IS NULL
    GROUP BY status
    ORDER BY status
  `);
  console.log("=== Bottle Runs by Status ===");
  console.table(bottleDistributed.rows);

  // Check keg fills distribution dates
  const kegDistributed = await db.execute(sql`
    SELECT
      status,
      COUNT(*) as count,
      MIN(filled_at) as earliest_filled,
      MAX(filled_at) as latest_filled,
      MIN(distributed_at) as earliest_distributed,
      MAX(distributed_at) as latest_distributed,
      COUNT(*) FILTER (WHERE distributed_at IS NULL) as null_distributed_at,
      COUNT(*) FILTER (WHERE distributed_at >= '2025-01-01' AND distributed_at < '2026-01-01') as distributed_in_2025,
      COUNT(*) FILTER (WHERE filled_at >= '2025-01-01' AND filled_at < '2026-01-01') as filled_in_2025
    FROM keg_fills
    WHERE voided_at IS NULL AND deleted_at IS NULL
    GROUP BY status
    ORDER BY status
  `);
  console.log("\n=== Keg Fills by Status ===");
  console.table(kegDistributed.rows);

  // Show distributed bottle runs with their dates
  const bottleSample = await db.execute(sql`
    SELECT id, status, packaged_at, distributed_at, updated_at,
      COALESCE(distributed_at, updated_at) as effective_dist_date
    FROM bottle_runs
    WHERE voided_at IS NULL
      AND status IN ('distributed', 'completed')
    ORDER BY packaged_at DESC
    LIMIT 20
  `);
  console.log("\n=== Sample Distributed Bottle Runs ===");
  console.table(bottleSample.rows);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
