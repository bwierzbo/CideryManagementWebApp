import { db } from "../index";
import { sql } from "drizzle-orm";

async function findUnverifiedBatches() {
  // Find batches that are SOURCES of transfers to verified batches but are NOT verified themselves
  const result = await db.execute(sql`
    SELECT DISTINCT
      b.id,
      b.batch_number,
      b.custom_name,
      b.reconciliation_status,
      b.status,
      CAST(b.initial_volume_liters AS NUMERIC) as initial_volume_liters,
      CAST(b.current_volume_liters AS NUMERIC) as current_volume_liters,
      b.start_date,
      (SELECT COUNT(*) FROM batch_transfers bt WHERE bt.source_batch_id = b.id AND bt.deleted_at IS NULL) as transfers_out_count,
      (SELECT COALESCE(SUM(CAST(bt.volume_transferred AS NUMERIC)), 0) FROM batch_transfers bt WHERE bt.source_batch_id = b.id AND bt.deleted_at IS NULL) as total_volume_out
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.reconciliation_status != 'verified'
      AND EXISTS (
        SELECT 1 FROM batch_transfers bt
        WHERE bt.source_batch_id = b.id
          AND bt.deleted_at IS NULL
          AND bt.transferred_at > '2025-01-01'
      )
    ORDER BY b.custom_name, b.batch_number
  `);

  console.log("\n=== UNVERIFIED BATCHES INVOLVED IN TRANSFERS ===\n");
  console.log("These batches are NOT verified but are part of the volume flow:\n");

  const rows = result.rows as any[];
  for (const row of rows) {
    const initialGal = (parseFloat(row.initial_volume_liters || "0") / 3.78541).toFixed(1);
    const currentGal = (parseFloat(row.current_volume_liters || "0") / 3.78541).toFixed(1);
    console.log("Batch:", row.custom_name || row.batch_number);
    console.log("  ID:", row.id);
    console.log("  Status:", row.status, "| Reconciliation:", row.reconciliation_status);
    console.log("  Initial:", initialGal, "gal | Current:", currentGal, "gal");
    console.log("  Transfers OUT:", row.transfers_out_count, "| Transfers IN:", row.transfers_in_count);
    console.log("  Start Date:", row.start_date);
    console.log("");
  }

  console.log("Total:", rows.length, "unverified batches\n");
  process.exit(0);
}

findUnverifiedBatches().catch(console.error);
