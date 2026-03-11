import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  const tankBatchId = '90b37943-6cb4-4759-b9a8-fe93e877f58d';

  // 1. Ancestor chain
  const ancestors = await db.execute(sql.raw(`
    WITH RECURSIVE ancestors AS (
      SELECT bt.source_batch_id as batch_id, b.name as batch_name,
             bt.transferred_at as split_timestamp, 1 as depth
      FROM batch_transfers bt
      JOIN batches b ON b.id = bt.source_batch_id
      WHERE (bt.remaining_batch_id = '${tankBatchId}' OR bt.destination_batch_id = '${tankBatchId}')
        AND bt.source_batch_id != '${tankBatchId}'
        AND bt.deleted_at IS NULL
      UNION ALL
      SELECT bt.source_batch_id, b.name, bt.transferred_at, a.depth + 1
      FROM batch_transfers bt
      JOIN batches b ON b.id = bt.source_batch_id
      JOIN ancestors a ON (bt.remaining_batch_id = a.batch_id OR bt.destination_batch_id = a.batch_id)
      WHERE bt.source_batch_id != a.batch_id AND bt.deleted_at IS NULL AND a.depth < 10
    )
    SELECT DISTINCT ON (batch_id) * FROM ancestors ORDER BY batch_id, depth DESC
  `));

  console.log("=== ANCESTOR CHAIN ===");
  const ancestorChain = ancestors.rows as any[];
  for (const a of ancestorChain) {
    console.log(`  depth=${a.depth} | ${a.batch_name} | id=${a.batch_id} | splitAt=${a.split_timestamp}`);
  }

  const allBatchIds = [tankBatchId, ...ancestorChain.map((a: any) => a.batch_id)];
  console.log("\nAll batch IDs:", allBatchIds);

  // 2. Blend sources check
  const blendSources = await db.execute(sql.raw(`
    SELECT id, source_type, source_batch_id
    FROM batch_merge_history
    WHERE target_batch_id = '${tankBatchId}'
      AND (source_type = 'batch_transfer' OR source_type = 'batch')
      AND deleted_at IS NULL
  `));
  console.log("\nBlend sources:", blendSources.rows.length, "=> isBlendedBatch:", blendSources.rows.length > 0);

  // 3. Transfers found by the query
  const placeholders = allBatchIds.map(id => `'${id}'`).join(',');
  const transfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.transferred_at,
           sb.name as source_batch_name, db.name as dest_batch_name,
           sv.name as source_vessel, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE (
      bt.source_batch_id = '${tankBatchId}'
      OR bt.destination_batch_id = '${tankBatchId}'
      ${allBatchIds.length > 1 ? `OR bt.source_batch_id IN (${allBatchIds.slice(1).map(id => `'${id}'`).join(',')})` : ''}
      ${allBatchIds.length > 1 ? `OR bt.destination_batch_id IN (${allBatchIds.slice(1).map(id => `'${id}'`).join(',')})` : ''}
    )
    AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  console.log(`\n=== TRANSFERS FOUND (${transfers.rows.length}) ===`);

  const splitTimestampMap = new Map<string, Date>();
  for (const a of ancestorChain) {
    splitTimestampMap.set(a.batch_id, new Date(a.split_timestamp));
  }

  for (const t of transfers.rows as any[]) {
    const thisIsSource = t.source_batch_id === tankBatchId;
    const thisIsDestination = t.destination_batch_id === tankBatchId;
    const sourceIsAncestor = allBatchIds.includes(t.source_batch_id) && t.source_batch_id !== tankBatchId;
    const destIsAncestor = allBatchIds.includes(t.destination_batch_id) && t.destination_batch_id !== tankBatchId;

    // Skip check
    const skipSibling = sourceIsAncestor && !destIsAncestor && !thisIsDestination;

    // relevantBatchId
    const isSameBatch = t.source_batch_id === t.destination_batch_id;
    const relevantBatchId = isSameBatch
      ? t.source_batch_id
      : (allBatchIds.includes(t.source_batch_id) ? t.source_batch_id : t.destination_batch_id);

    // shouldInclude
    let shouldInclude = true;
    if (relevantBatchId !== tankBatchId) {
      const splitTime = splitTimestampMap.get(relevantBatchId);
      if (splitTime) {
        shouldInclude = new Date(t.transferred_at) < splitTime;
      }
    }

    const inherited = relevantBatchId !== tankBatchId;

    console.log(`\n  ${t.transferred_at} | ${t.source_batch_name} (${t.source_vessel}) -> ${t.dest_batch_name} (${t.dest_vessel}) | ${t.volume_transferred}${t.volume_transferred_unit}`);
    console.log(`    thisIsSource=${thisIsSource} thisIsDest=${thisIsDestination} srcAncestor=${sourceIsAncestor} dstAncestor=${destIsAncestor}`);
    console.log(`    skipSibling=${skipSibling} relevantBatchId=${relevantBatchId === tankBatchId ? 'SELF' : 'ANCESTOR'} shouldInclude=${shouldInclude} inherited=${inherited}`);

    if (skipSibling) console.log(`    >>> FILTERED: sibling transfer`);
    if (!shouldInclude) console.log(`    >>> FILTERED: after split time`);
  }

  // 4. Check volume calculations for TANK batch
  console.log("\n=== VOLUME ANALYSIS ===");
  const batchData = await db.execute(sql.raw(`
    SELECT initial_volume, current_volume, current_volume_liters FROM batches WHERE id = '${tankBatchId}'
  `));
  const b = batchData.rows[0] as any;
  console.log("DB values: initial_volume =", b.initial_volume, "| current_volume =", b.current_volume, "| current_volume_liters =", b.current_volume_liters);

  // Sum transfers in and out
  const volIn = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
    FROM batch_transfers WHERE destination_batch_id = '${tankBatchId}' AND deleted_at IS NULL
  `));
  const volOut = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
    FROM batch_transfers WHERE source_batch_id = '${tankBatchId}' AND deleted_at IS NULL
  `));
  console.log("Transfers in:", (volIn.rows[0] as any).total, "| Transfers out:", (volOut.rows[0] as any).total);
  console.log("Expected volume:", parseFloat(b.initial_volume) + parseFloat((volIn.rows[0] as any).total) - parseFloat((volOut.rows[0] as any).total));

  // 5. IBC-1000-1 analysis
  const ibcBatchId = '2031feb0-4a0f-435a-9623-08270987a564';
  console.log("\n=== IBC-1000-1 ANALYSIS ===");
  const ibcData = await db.execute(sql.raw(`
    SELECT b.initial_volume, b.current_volume, b.current_volume_liters, v.name as vessel_name
    FROM batches b LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id = '${ibcBatchId}'
  `));
  const ibc = ibcData.rows[0] as any;
  console.log("Vessel:", ibc.vessel_name, "| initial:", ibc.initial_volume, "| current:", ibc.current_volume, "| liters:", ibc.current_volume_liters);

  // Check merge total for IBC
  const ibcMergeTotal = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_added::numeric), 0) as total
    FROM batch_merge_history WHERE target_batch_id = '${ibcBatchId}' AND deleted_at IS NULL
  `));
  console.log("Total merged in:", (ibcMergeTotal.rows[0] as any).total);
  console.log("Expected volume:", parseFloat(ibc.initial_volume) + parseFloat((ibcMergeTotal.rows[0] as any).total));

  process.exit(0);
}

main().catch(console.error);
