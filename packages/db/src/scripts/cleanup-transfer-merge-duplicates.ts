/**
 * Soft-deletes batch_merge_history rows that mirror an existing batch_transfers
 * row (same target, same source, same volume — a duplicate write from the
 * blend code path that no longer exists). Pairs with
 * audit-transfer-merge-duplicates.ts for verification.
 *
 * Default is dry-run. Pass --apply to actually soft-delete.
 *
 * Run dry:    pnpm --filter db exec tsx src/scripts/cleanup-transfer-merge-duplicates.ts
 * Run apply:  pnpm --filter db exec tsx src/scripts/cleanup-transfer-merge-duplicates.ts --apply
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "🔧 APPLY mode — will soft-delete rows\n" : "🔍 DRY RUN — no changes (pass --apply to commit)\n");

  // Find duplicates: merge_history rows where a matching batch_transfer exists
  // for the same (target, source, volume) triple.
  const dupes = await db.execute(sql`
    SELECT bmh.id::text AS id
    FROM batch_merge_history bmh
    JOIN batch_transfers bt
      ON bt.destination_batch_id = bmh.target_batch_id
     AND bt.source_batch_id      = bmh.source_batch_id
     AND ABS(CAST(bt.volume_transferred AS NUMERIC) - CAST(bmh.volume_added AS NUMERIC)) < 0.01
     AND bt.deleted_at IS NULL
    WHERE bmh.deleted_at IS NULL
      AND bmh.source_type = 'batch_transfer'
  `);

  const ids = (dupes.rows as Array<{ id: string }>).map((r) => r.id);
  console.log(`Found ${ids.length} duplicate merge_history row(s) to soft-delete.`);

  if (ids.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to soft-delete.");
    process.exit(0);
  }

  // Bulk soft-delete inside a transaction. Using IN (...) with sql.join
  // to inline the UUIDs since parameter binding for uuid[] is awkward here.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE batch_merge_history
         SET deleted_at = NOW()
       WHERE id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    `);
  });

  console.log(`✅ Soft-deleted ${ids.length} duplicate row(s).`);
  console.log(`Re-run audit-transfer-merge-duplicates.ts to verify (should report zero).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
