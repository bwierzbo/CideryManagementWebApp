import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  const tankBatchId = '90b37943-6cb4-4759-b9a8-fe93e877f58d';
  const ibcBatchId = '2031feb0-4a0f-435a-9623-08270987a564';

  // ============================================================
  // TANK-1000-1: "Summer Community Blend 3"
  // ============================================================
  console.log("================================================================");
  console.log("TANK-1000-1: Summer Community Blend 3");
  console.log("================================================================");

  const tankBatch = await db.execute(sql.raw(`
    SELECT b.name, b.custom_name, b.initial_volume, b.current_volume, b.current_volume_unit,
           b.status, v.name as vessel_name, b.start_date
    FROM batches b LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id = '${tankBatchId}'
  `));
  const tb = tankBatch.rows[0] as any;
  console.log(`Status: ${tb.status} | Vessel: ${tb.vessel_name} | Volume: ${tb.current_volume}${tb.current_volume_unit}`);

  // Ancestor chain
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
  const ancestorChain = ancestors.rows as any[];
  const allBatchIds = [tankBatchId, ...ancestorChain.map((a: any) => a.batch_id)];
  const splitTimestampMap = new Map<string, Date>();
  for (const a of ancestorChain) {
    splitTimestampMap.set(a.batch_id, new Date(a.split_timestamp));
  }

  console.log(`\nAncestor chain: ${ancestorChain.length} ancestors`);
  for (const a of ancestorChain) {
    console.log(`  depth=${a.depth} | ${a.batch_name} | split: ${a.split_timestamp}`);
  }

  // Blend sources check
  const blendSources = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM batch_merge_history
    WHERE target_batch_id = '${tankBatchId}'
      AND (source_type = 'batch_transfer' OR source_type = 'batch')
      AND deleted_at IS NULL
  `));
  const isBlendedBatch = parseInt((blendSources.rows[0] as any).cnt) > 0;
  console.log(`isBlendedBatch: ${isBlendedBatch}`);

  // Simulate full activity history build
  let activities: any[] = [];

  // 1. Creation event
  activities.push({ type: "creation", timestamp: tb.start_date, desc: `Batch created`, inherited: false });

  // 2. Measurements
  const measurements = await db.execute(sql.raw(`
    SELECT id, batch_id, measurement_date, specific_gravity, ph
    FROM batch_measurements
    WHERE batch_id IN (${allBatchIds.map(id => `'${id}'`).join(',')}) AND deleted_at IS NULL
    ORDER BY measurement_date
  `));
  for (const m of measurements.rows as any[]) {
    const isOwn = m.batch_id === tankBatchId;
    if (!isOwn) {
      const splitTime = splitTimestampMap.get(m.batch_id);
      if (splitTime && new Date(m.measurement_date) > splitTime) continue; // After split - exclude (using <=)
    }
    activities.push({ type: "measurement", timestamp: m.measurement_date, desc: `SG: ${m.specific_gravity} pH: ${m.ph}`, inherited: !isOwn });
  }

  // 3. Additives
  const additives = await db.execute(sql.raw(`
    SELECT id, batch_id, added_at, additive_type, additive_name
    FROM batch_additives
    WHERE batch_id IN (${allBatchIds.map(id => `'${id}'`).join(',')}) AND deleted_at IS NULL
    ORDER BY added_at
  `));
  for (const a of additives.rows as any[]) {
    const isOwn = a.batch_id === tankBatchId;
    if (!isOwn) {
      const splitTime = splitTimestampMap.get(a.batch_id);
      if (splitTime && new Date(a.added_at) > splitTime) continue;
    }
    activities.push({ type: "additive", timestamp: a.added_at, desc: `${a.additive_type}: ${a.additive_name}`, inherited: !isOwn });
  }

  // 4. Merges
  const merges = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id, bmh.merged_at, bmh.volume_added, bmh.volume_added_unit,
           bmh.source_type, sb.name as source_batch_name, pr.press_run_name
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    LEFT JOIN press_runs pr ON pr.id = bmh.source_press_run_id
    WHERE bmh.target_batch_id IN (${allBatchIds.map(id => `'${id}'`).join(',')}) AND bmh.deleted_at IS NULL
    ORDER BY bmh.merged_at
  `));
  for (const m of merges.rows as any[]) {
    const isOwn = m.target_batch_id === tankBatchId;
    if (!isOwn) {
      const splitTime = splitTimestampMap.get(m.target_batch_id);
      if (splitTime && new Date(m.merged_at) > splitTime) continue;
    }
    activities.push({ type: "merge", timestamp: m.merged_at, desc: `${m.volume_added}${m.volume_added_unit} from ${m.source_batch_name || m.press_run_name}`, inherited: !isOwn });
  }

  // 5. Transfers (the critical part)
  const placeholders = allBatchIds.map(id => `'${id}'`).join(',');
  const transfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit, bt.transferred_at,
           sb.name as source_batch_name, db.name as dest_batch_name,
           db.custom_name as dest_custom_name,
           sv.name as source_vessel, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE (bt.source_batch_id IN (${placeholders}) OR bt.destination_batch_id IN (${placeholders}))
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  for (const t of transfers.rows as any[]) {
    const thisIsSource = t.source_batch_id === tankBatchId;
    const thisIsDestination = t.destination_batch_id === tankBatchId;
    const sourceIsAncestor = allBatchIds.includes(t.source_batch_id) && t.source_batch_id !== tankBatchId;
    const destIsAncestor = allBatchIds.includes(t.destination_batch_id) && t.destination_batch_id !== tankBatchId;

    // Skip sibling transfers
    if (sourceIsAncestor && !destIsAncestor && !thisIsDestination) continue;

    const isSameBatch = t.source_batch_id === t.destination_batch_id;
    const relevantBatchId = isSameBatch
      ? t.source_batch_id
      : (allBatchIds.includes(t.source_batch_id) ? t.source_batch_id : t.destination_batch_id);

    // shouldIncludeAncestorActivity with <= fix
    if (relevantBatchId !== tankBatchId) {
      const splitTime = splitTimestampMap.get(relevantBatchId);
      if (splitTime && new Date(t.transferred_at) > splitTime) continue; // Changed: > instead of >=
    }

    const inherited = relevantBatchId !== tankBatchId;
    const isSource = thisIsSource || sourceIsAncestor;
    const desc = isSource
      ? `Transferred ${t.volume_transferred}${t.volume_transferred_unit} to ${t.dest_custom_name || t.dest_batch_name} (${t.dest_vessel})`
      : `Received ${t.volume_transferred}${t.volume_transferred_unit} from ${t.source_batch_name} (${t.source_vessel})`;

    activities.push({ type: "transfer", timestamp: t.transferred_at, desc, inherited });
  }

  // 6. Volume adjustments
  const adjustments = await db.execute(sql.raw(`
    SELECT adjustment_date, adjustment_type, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = '${tankBatchId}' AND deleted_at IS NULL
    ORDER BY adjustment_date
  `));
  for (const a of adjustments.rows as any[]) {
    activities.push({ type: "adjustment", timestamp: a.adjustment_date, desc: `${a.adjustment_type}: ${a.adjustment_amount}L - ${a.reason}`, inherited: false });
  }

  // Apply lineage filter if blended
  if (isBlendedBatch) {
    activities = activities.filter(a => {
      if (!a.inherited) return true;
      if (a.type === "creation") return true;
      if (["merge", "transfer", "measurement", "additive"].includes(a.type)) return false;
      return true;
    });
  }

  // Sort chronologically
  activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`\n--- Activity History (${activities.length} events) ---`);
  let volRunning = 0;
  for (const a of activities) {
    const tag = a.inherited ? " [inherited]" : "";
    console.log(`  ${new Date(a.timestamp).toISOString().slice(0,16)} | ${a.type.padEnd(12)} | ${a.desc}${tag}`);
  }

  // Volume trace
  const inTotal = transfers.rows.filter((t: any) => t.destination_batch_id === tankBatchId)
    .reduce((sum: number, t: any) => sum + parseFloat(t.volume_transferred), 0);
  const outTotal = transfers.rows.filter((t: any) => t.source_batch_id === tankBatchId)
    .reduce((sum: number, t: any) => sum + parseFloat(t.volume_transferred), 0);
  console.log(`\nVolume trace: ${inTotal}L in - ${outTotal}L out = ${inTotal - outTotal}L`);
  console.log(`DB current_volume: ${tb.current_volume}${tb.current_volume_unit}`);
  console.log(`Match: ${Math.abs((inTotal - outTotal) - parseFloat(tb.current_volume)) < 0.01 ? 'YES' : 'NO'}`);

  // ============================================================
  // IBC-1000-1: "Summer Community Blend 4"
  // ============================================================
  console.log("\n================================================================");
  console.log("IBC-1000-1: Summer Community Blend 4");
  console.log("================================================================");

  const ibcBatch = await db.execute(sql.raw(`
    SELECT b.name, b.custom_name, b.initial_volume, b.current_volume, b.current_volume_unit,
           b.status, v.name as vessel_name
    FROM batches b LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id = '${ibcBatchId}'
  `));
  const ib = ibcBatch.rows[0] as any;
  console.log(`Status: ${ib.status} | Vessel: ${ib.vessel_name} | Volume: ${ib.current_volume}${ib.current_volume_unit}`);

  // Transfers
  const ibcTransfers = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM batch_transfers
    WHERE (source_batch_id = '${ibcBatchId}' OR destination_batch_id = '${ibcBatchId}')
      AND deleted_at IS NULL
  `));
  console.log(`Transfers: ${(ibcTransfers.rows[0] as any).cnt} (expected: 0)`);

  // Merge history
  const ibcMerges = await db.execute(sql.raw(`
    SELECT bmh.merged_at, bmh.volume_added, bmh.volume_added_unit, bmh.source_type,
           bmh.target_volume_before, bmh.target_volume_after,
           pr.press_run_name
    FROM batch_merge_history bmh
    LEFT JOIN press_runs pr ON pr.id = bmh.source_press_run_id
    WHERE bmh.target_batch_id = '${ibcBatchId}' AND bmh.deleted_at IS NULL
    ORDER BY bmh.merged_at
  `));

  let ibcActivities: any[] = [];
  ibcActivities.push({ type: "creation", timestamp: ib.start_date || "unknown", desc: `Batch created (initial: ${ib.initial_volume}L)` });

  for (const m of ibcMerges.rows as any[]) {
    ibcActivities.push({
      type: "merge",
      timestamp: m.merged_at,
      desc: `${m.volume_added}${m.volume_added_unit} from ${m.press_run_name} (${m.target_volume_before} -> ${m.target_volume_after})`
    });
  }

  // Measurements
  const ibcMeasurements = await db.execute(sql.raw(`
    SELECT measurement_date, specific_gravity, ph, abv
    FROM batch_measurements
    WHERE batch_id = '${ibcBatchId}' AND deleted_at IS NULL
    ORDER BY measurement_date
  `));
  for (const m of ibcMeasurements.rows as any[]) {
    ibcActivities.push({ type: "measurement", timestamp: m.measurement_date, desc: `SG: ${m.specific_gravity} pH: ${m.ph} ABV: ${m.abv}` });
  }

  // Additives
  const ibcAdditives = await db.execute(sql.raw(`
    SELECT added_at, additive_type, additive_name
    FROM batch_additives
    WHERE batch_id = '${ibcBatchId}' AND deleted_at IS NULL
    ORDER BY added_at
  `));
  for (const a of ibcAdditives.rows as any[]) {
    ibcActivities.push({ type: "additive", timestamp: a.added_at, desc: `${a.additive_type}: ${a.additive_name}` });
  }

  ibcActivities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`\n--- Activity History (${ibcActivities.length} events) ---`);
  for (const a of ibcActivities) {
    console.log(`  ${new Date(a.timestamp).toISOString().slice(0,16)} | ${a.type.padEnd(12)} | ${a.desc}`);
  }

  // Volume trace
  const ibcInitial = parseFloat(ib.initial_volume);
  const ibcMergeTotal = ibcMerges.rows.reduce((sum: number, m: any) => sum + parseFloat(m.volume_added), 0);
  console.log(`\nVolume trace: ${ibcInitial}L initial + ${ibcMergeTotal}L merged = ${ibcInitial + ibcMergeTotal}L`);
  console.log(`DB current_volume: ${ib.current_volume}${ib.current_volume_unit}`);
  console.log(`Match: ${Math.abs((ibcInitial + ibcMergeTotal) - parseFloat(ib.current_volume)) < 0.1 ? 'YES' : 'NO'}`);

  process.exit(0);
}

main().catch(console.error);
