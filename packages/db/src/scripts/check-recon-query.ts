import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // Check if bottleRunSalesChannelId column exists
  const salesCols = await db.execute(sql.raw(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'bottle_runs' AND column_name LIKE '%sales%'
  `));
  console.log("bottle_runs sales columns:", (salesCols.rows as any[]).map((r: any) => r.column_name));

  // Check if the listForReconciliation query would work
  // Simplified version of the year filter
  const batchCount = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type NOT IN ('brandy', 'juice')
      AND b.is_racking_derivative IS NOT TRUE
  `));
  console.log("\nTotal eligible batches (no year filter):", (batchCount.rows[0] as any).cnt);

  // With year filter for 2025
  const batch2025 = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type NOT IN ('brandy', 'juice')
      AND b.is_racking_derivative IS NOT TRUE
      AND (
        EXTRACT(YEAR FROM COALESCE(b.start_date, b.created_at)) = 2025
        OR (
          COALESCE(b.start_date, b.created_at) < '2025-01-01'
          AND b.current_volume_liters > 0
        )
      )
  `));
  console.log("2025 batches (year filter):", (batch2025.rows[0] as any).cnt);

  // Check the getReconciliationSummary - does bottleRunSalesChannelId exist?
  const bottleRunCols = await db.execute(sql.raw(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'bottle_runs'
    ORDER BY ordinal_position
  `));
  console.log("\nbottle_runs ALL columns:", (bottleRunCols.rows as any[]).map((r: any) => r.column_name).join(", "));

  // Check if bottle_run_sales_channel_id exists
  const hasSalesChannel = (bottleRunCols.rows as any[]).some((r: any) =>
    r.column_name === 'bottle_run_sales_channel_id'
  );
  console.log("\nHas bottle_run_sales_channel_id:", hasSalesChannel);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
