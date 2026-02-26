import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const batchId = "d5ca38c8-e528-45ef-9ceb-89760bd390b0";

  const adj = await db.execute(sql.raw(`
    SELECT id, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = '${batchId}'
      AND deleted_at IS NULL
      AND adjustment_amount::numeric > 0
  `));

  if (adj.rows.length === 0) {
    console.log("No positive adjustments found — already deleted?");
    process.exit(0);
  }

  console.log("Deleting:", adj.rows[0].adjustment_amount, "L |", adj.rows[0].reason);

  await db.execute(sql.raw(`
    UPDATE batch_volume_adjustments
    SET deleted_at = NOW()
    WHERE id = '${adj.rows[0].id}'
  `));
  console.log("Done: adjustment soft-deleted");

  // Verify
  const check = await db.execute(sql.raw(`
    SELECT
      round(b.initial_volume_liters::numeric, 2) as init,
      round(b.current_volume_liters::numeric, 2) as cur,
      round(b.initial_volume_liters::numeric
        + COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE destination_batch_id = b.id AND deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE source_batch_id = b.id AND deleted_at IS NULL), 0)
      , 2) as reconstructed
    FROM batches b WHERE b.id = '${batchId}'
  `));
  const r = check.rows[0];
  console.log("Verify: init=" + r.init + ", reconstructed=" + r.reconstructed + ", stored=" + r.cur);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
