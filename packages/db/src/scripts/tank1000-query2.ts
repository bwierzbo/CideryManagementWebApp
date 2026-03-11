import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  const ibcBatchId = '2031feb0-4a0f-435a-9623-08270987a564';
  const tankBatchId = '90b37943-6cb4-4759-b9a8-fe93e877f58d';

  // Check ALL transfers where IBC-1000-1 batch is source or dest (including deleted)
  const allIbcTransfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.transferred_at, bt.deleted_at,
           sb.name as source_batch_name, db.name as dest_batch_name,
           sv.name as source_vessel, dv.name as dest_vessel,
           bt.remaining_batch_id
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE bt.source_batch_id = '${ibcBatchId}' OR bt.destination_batch_id = '${ibcBatchId}'
    ORDER BY bt.transferred_at
  `));

  console.log("=== ALL IBC-1000-1 TRANSFERS (incl deleted) ===");
  for (const t of allIbcTransfers.rows as any[]) {
    const del = t.deleted_at ? ' [DELETED]' : '';
    console.log(t.transferred_at, "|", t.source_batch_name, "(", t.source_vessel, ") ->", t.dest_batch_name, "(", t.dest_vessel, ") |", t.volume_transferred, t.volume_transferred_unit, del);
  }

  // Check the IBC batch's ancestor chain - does it trace to TANK-1000-1?
  const ancestors = await db.execute(sql.raw(`
    WITH RECURSIVE ancestors AS (
      SELECT
        bt.source_batch_id as batch_id,
        b.name as batch_name,
        bt.transferred_at as split_timestamp,
        1 as depth
      FROM batch_transfers bt
      JOIN batches b ON b.id = bt.source_batch_id
      WHERE (bt.remaining_batch_id = '${ibcBatchId}' OR bt.destination_batch_id = '${ibcBatchId}')
        AND bt.source_batch_id != '${ibcBatchId}'
        AND bt.deleted_at IS NULL
      UNION ALL
      SELECT
        bt.source_batch_id,
        b.name,
        bt.transferred_at,
        a.depth + 1
      FROM batch_transfers bt
      JOIN batches b ON b.id = bt.source_batch_id
      JOIN ancestors a ON (bt.remaining_batch_id = a.batch_id OR bt.destination_batch_id = a.batch_id)
      WHERE bt.source_batch_id != a.batch_id
        AND bt.deleted_at IS NULL
        AND a.depth < 10
    )
    SELECT DISTINCT ON (batch_id) * FROM ancestors ORDER BY batch_id, depth DESC
  `));

  console.log("\n=== IBC-1000-1 ANCESTOR CHAIN ===");
  for (const a of ancestors.rows as any[]) {
    console.log("depth:", a.depth, "| batch:", a.batch_name, "| id:", a.batch_id);
  }

  // Check the TANK batch's ancestor chain
  const tankAncestors = await db.execute(sql.raw(`
    WITH RECURSIVE ancestors AS (
      SELECT
        bt.source_batch_id as batch_id,
        b.name as batch_name,
        bt.transferred_at as split_timestamp,
        1 as depth
      FROM batch_transfers bt
      JOIN batches b ON b.id = bt.source_batch_id
      WHERE (bt.remaining_batch_id = '${tankBatchId}' OR bt.destination_batch_id = '${tankBatchId}')
        AND bt.source_batch_id != '${tankBatchId}'
        AND bt.deleted_at IS NULL
      UNION ALL
      SELECT
        bt.source_batch_id,
        b.name,
        bt.transferred_at,
        a.depth + 1
      FROM batch_transfers bt
      JOIN batches b ON b.id = bt.source_batch_id
      JOIN ancestors a ON (bt.remaining_batch_id = a.batch_id OR bt.destination_batch_id = a.batch_id)
      WHERE bt.source_batch_id != a.batch_id
        AND bt.deleted_at IS NULL
        AND a.depth < 10
    )
    SELECT DISTINCT ON (batch_id) * FROM ancestors ORDER BY batch_id, depth DESC
  `));

  console.log("\n=== TANK-1000-1 ANCESTOR CHAIN ===");
  for (const a of tankAncestors.rows as any[]) {
    console.log("depth:", a.depth, "| batch:", a.batch_name, "| id:", a.batch_id);
  }

  // Check blend sources for IBC-1000-1
  const ibcBlendSources = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.source_type, bmh.source_batch_id,
           sb.name as source_batch_name
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    WHERE bmh.target_batch_id = '${ibcBatchId}'
      AND (bmh.source_type = 'batch_transfer' OR bmh.source_type = 'batch')
      AND bmh.deleted_at IS NULL
  `));

  console.log("\n=== IBC-1000-1 BLEND SOURCES ===");
  for (const s of ibcBlendSources.rows as any[]) {
    console.log("type:", s.source_type, "| from:", s.source_batch_name, "| id:", s.source_batch_id);
  }

  // Check volume adjustments for both
  const tankAdj = await db.execute(sql.raw(`
    SELECT id, adjustment_date, adjustment_type, volume_before, volume_after, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = '${tankBatchId}' AND deleted_at IS NULL
    ORDER BY adjustment_date
  `));

  console.log("\n=== TANK-1000-1 VOLUME ADJUSTMENTS ===");
  for (const a of tankAdj.rows as any[]) {
    console.log(a.adjustment_date, "|", a.adjustment_type, "| before:", a.volume_before, "-> after:", a.volume_after, "| change:", a.adjustment_amount, "|", a.reason);
  }

  // Check IBC-1000-1 volume adjustments
  const ibcAdj = await db.execute(sql.raw(`
    SELECT id, adjustment_date, adjustment_type, volume_before, volume_after, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = '${ibcBatchId}' AND deleted_at IS NULL
    ORDER BY adjustment_date
  `));

  console.log("\n=== IBC-1000-1 VOLUME ADJUSTMENTS ===");
  for (const a of ibcAdj.rows as any[]) {
    console.log(a.adjustment_date, "|", a.adjustment_type, "| before:", a.volume_before, "-> after:", a.volume_after, "| change:", a.adjustment_amount, "|", a.reason);
  }

  // Get the IBC's actual batch_transfers where it is the source (outgoing from IBC)
  const ibcOutgoing = await db.execute(sql.raw(`
    SELECT bt.id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.transferred_at,
           db.name as dest_batch_name, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE bt.source_batch_id = '${ibcBatchId}'
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  console.log("\n=== IBC-1000-1 OUTGOING TRANSFERS ===");
  for (const t of ibcOutgoing.rows as any[]) {
    console.log(t.transferred_at, "->", t.dest_batch_name, "(", t.dest_vessel, ") |", t.volume_transferred, t.volume_transferred_unit);
  }

  process.exit(0);
}

main().catch(console.error);
