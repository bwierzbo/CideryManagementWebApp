import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Backfill batch_transfers records for historical partial rack operations.
 *
 * Problem: Partial racks create child batches (isRackingDerivative = true)
 * but did NOT create batch_transfers records. This breaks SBD volume
 * reconstruction: parents are over-counted (no transfersOut), children
 * compute to 0 (no transfersIn).
 *
 * Fix: For each racking-derivative child, match it to the parent's
 * batch_racking_operation and create the missing batch_transfers record.
 */
async function main() {
  // 1. Find racking-derivative children that lack batch_transfers records
  const candidates = await db.execute(sql`
    SELECT
      child.id AS child_id,
      child.parent_batch_id,
      child.name AS child_name,
      child.start_date AS child_start_date,
      rop.id AS racking_op_id,
      rop.source_vessel_id,
      rop.destination_vessel_id,
      rop.volume_before,
      rop.volume_after,
      rop.volume_loss,
      rop.racked_at,
      rop.racked_by
    FROM batches child
    JOIN batch_racking_operations rop
      ON rop.batch_id = child.parent_batch_id
      AND rop.destination_vessel_id IS NOT NULL
      AND rop.deleted_at IS NULL
      AND ABS(EXTRACT(EPOCH FROM rop.racked_at - child.start_date)) < 120
    WHERE child.deleted_at IS NULL
      AND (
        child.is_racking_derivative IS TRUE
        OR (
          child.parent_batch_id IS NOT NULL
          AND CAST(COALESCE(child.initial_volume_liters, '1') AS DECIMAL) = 0
          AND COALESCE(child.product_type, 'cider') != 'pommeau'
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM batch_transfers bt
        WHERE bt.source_batch_id = child.parent_batch_id
          AND bt.destination_batch_id = child.id
          AND bt.deleted_at IS NULL
      )
    ORDER BY rop.racked_at
  `);

  const rows = candidates.rows as any[];
  console.log(`Found ${rows.length} racking-derivative children without batch_transfers records.\n`);

  if (rows.length === 0) {
    console.log("Nothing to backfill.");
    process.exit(0);
  }

  // 2. Preview what will be created
  for (const row of rows) {
    const volumeTransferred = parseFloat(row.volume_after || "0");
    const remaining = parseFloat(row.volume_before || "0") - volumeTransferred - parseFloat(row.volume_loss || "0");
    console.log(
      `  ${row.child_name} (${row.child_id.slice(0, 8)}...)` +
      ` ← parent ${row.parent_batch_id.slice(0, 8)}...` +
      ` | ${volumeTransferred.toFixed(1)}L transferred` +
      ` | ${remaining.toFixed(1)}L remaining` +
      ` | racked ${new Date(row.racked_at).toISOString().split("T")[0]}`
    );
  }

  console.log(`\nInserting ${rows.length} batch_transfers records...`);

  // 3. Insert batch_transfers records
  let inserted = 0;
  for (const row of rows) {
    const volumeTransferred = row.volume_after;
    const remaining = (
      parseFloat(row.volume_before || "0") -
      parseFloat(row.volume_after || "0") -
      parseFloat(row.volume_loss || "0")
    ).toString();

    await db.execute(sql`
      INSERT INTO batch_transfers (
        source_batch_id, source_vessel_id,
        destination_batch_id, destination_vessel_id,
        volume_transferred, volume_transferred_unit,
        loss, loss_unit,
        total_volume_processed, total_volume_processed_unit,
        remaining_volume, remaining_volume_unit,
        transferred_at, transferred_by,
        created_at, updated_at
      ) VALUES (
        ${row.parent_batch_id}, ${row.source_vessel_id},
        ${row.child_id}, ${row.destination_vessel_id},
        ${volumeTransferred}, 'L',
        '0', 'L',
        ${volumeTransferred}, 'L',
        ${remaining}, 'L',
        ${row.racked_at}, ${row.racked_by},
        NOW(), NOW()
      )
    `);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted} batch_transfers records.`);
  console.log("Run the reconciliation page to verify variance drops to ~0.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
