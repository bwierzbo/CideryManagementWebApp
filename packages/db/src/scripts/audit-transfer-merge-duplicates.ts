/**
 * Audits the database for the "transfer logged twice" bug found on Perry #2.
 *
 * Symptom: when a batch transfer happens, the system writes to BOTH
 * `batch_transfers` AND `batch_merge_history` (with source_type='batch_transfer')
 * for the same physical operation. The merge_history row is the duplicate —
 * it inflates inflows and breaks volume reconciliation.
 *
 * Detection: find merge_history rows where there's a matching batch_transfers
 * row with the same (target_batch_id, source_batch_id, volume) pair. We
 * tolerate small rounding differences (< 0.01 L).
 *
 * Run:  pnpm --filter db exec tsx src/scripts/audit-transfer-merge-duplicates.ts
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

interface Row {
  merge_id: string;
  transfer_id: string;
  target_batch_name: string | null;
  source_batch_name: string | null;
  volume: string;
  merged_at: Date;
  transferred_at: Date;
  hours_apart: string;
}

async function main() {
  const r = await db.execute(sql`
    SELECT
      bmh.id::text                                   AS merge_id,
      bt.id::text                                    AS transfer_id,
      COALESCE(tb.custom_name, tb.name)              AS target_batch_name,
      COALESCE(sb.custom_name, sb.name)              AS source_batch_name,
      bmh.volume_added::text                         AS volume,
      bmh.merged_at,
      bt.transferred_at,
      ROUND(EXTRACT(EPOCH FROM (bmh.merged_at - bt.transferred_at)) / 3600, 1)::text AS hours_apart
    FROM batch_merge_history bmh
    JOIN batch_transfers bt
      ON bt.destination_batch_id = bmh.target_batch_id
     AND bt.source_batch_id      = bmh.source_batch_id
     AND ABS(CAST(bt.volume_transferred AS NUMERIC) - CAST(bmh.volume_added AS NUMERIC)) < 0.01
     AND bt.deleted_at IS NULL
    LEFT JOIN batches tb ON tb.id = bmh.target_batch_id
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    WHERE bmh.deleted_at IS NULL
      AND bmh.source_type = 'batch_transfer'
    ORDER BY bmh.merged_at DESC
  `);

  const rows = r.rows as unknown as Row[];

  if (rows.length === 0) {
    console.log("✅ No duplicate transfer/merge_history pairs found.");
    process.exit(0);
  }

  console.log(`Found ${rows.length} duplicate merge_history row(s) that mirror an existing batch_transfers row:\n`);
  console.log(
    "target → source".padEnd(60) +
      "  volume".padStart(10) +
      "  merged".padEnd(20) +
      "  hours after transfer".padStart(22),
  );
  console.log("-".repeat(115));
  for (const row of rows) {
    const label = `${(row.target_batch_name || "?").substring(0, 28)} ← ${(row.source_batch_name || "?").substring(0, 28)}`;
    console.log(
      label.padEnd(60) +
        `  ${row.volume}L`.padStart(10) +
        `  ${String(row.merged_at).substring(0, 19)}`.padEnd(20) +
        `  ${row.hours_apart}h`.padStart(22),
    );
  }
  console.log("-".repeat(115));
  console.log(
    `\nThese rows inflate volume inflows and corrupt COGS proration for the target batches.\n` +
      `To clean up, soft-delete the merge_id rows. The corresponding batch_transfers rows\n` +
      `remain as the source of truth.`,
  );

  console.log("\nMerge IDs (for cleanup script):");
  console.log("  " + rows.map((r) => `'${r.merge_id}'`).join(", "));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
