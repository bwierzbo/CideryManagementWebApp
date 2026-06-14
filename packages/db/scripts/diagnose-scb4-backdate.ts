import { db } from "../src/index";
import { sql } from "drizzle-orm";

// Replays the backdate-protection historical-volume calc (packages/api/src/routers/index.ts:3918+)
// for the "Summer Community Blend 4" batch currently in TANK-500-2, at the attempted
// transfer date of 2026-05-25 07:12 local. Goal: explain why historical = -0.17L while
// current = 114.8L.

const TRANSFER_DATE = new Date("2026-05-25T07:12:00"); // local-ish; we compare against stored timestamps

function n(v: any): number {
  return parseFloat((v ?? "0").toString());
}

async function main() {
  // Locate the source batch the same way the mutation does: active batch in TANK-500-2
  const vessel = await db.execute(sql`
    SELECT id, name, capacity, capacity_unit, status
    FROM vessels WHERE UPPER(name) = 'TANK-500-2'
  `);
  const vesselRow = (vessel.rows as any[])[0];
  if (!vesselRow) { console.log("TANK-500-2 not found"); process.exit(0); }
  const vesselId = vesselRow.id;
  console.log(`Vessel: ${vesselRow.name} (${vesselId}) status=${vesselRow.status} cap=${vesselRow.capacity}${vesselRow.capacity_unit}`);

  const batchRes = await db.execute(sql`
    SELECT id, name, custom_name, status, current_volume, current_volume_unit,
           initial_volume, initial_volume_unit, initial_volume_liters, start_date
    FROM batches
    WHERE vessel_id = ${vesselId}::uuid
      AND status IN ('fermentation','aging')
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const b = (batchRes.rows as any[])[0];
  if (!b) { console.log("No active batch in TANK-500-2"); process.exit(0); }
  console.log(`\nBatch: "${b.custom_name || b.name}" (${b.id})`);
  console.log(`  status=${b.status}`);
  console.log(`  current_volume=${b.current_volume} ${b.current_volume_unit}`);
  console.log(`  initial_volume=${b.initial_volume} ${b.initial_volume_unit}`);
  console.log(`  initial_volume_liters=${b.initial_volume_liters}`);
  console.log(`  start_date=${b.start_date}`);

  const batchId = b.id;

  // initial in liters (validator logic)
  const initialVolumeL = n(b.initial_volume_liters ?? b.initial_volume);
  let initialInLiters = initialVolumeL;
  if (!b.initial_volume_liters && b.initial_volume_unit === "gal") {
    initialInLiters = initialVolumeL * 3.78541;
  }

  const dateRow = async (label: string, q: any) => {
    const r = await db.execute(q);
    return r.rows as any[];
  };

  // ---- Aggregates ON OR BEFORE transfer date (what historical calc uses) ----
  const outBefore = await db.execute(sql`
    SELECT COALESCE(SUM(total_volume_processed::decimal),0) AS total
    FROM batch_transfers
    WHERE source_batch_id = ${batchId}::uuid AND deleted_at IS NULL
      AND transferred_at <= ${TRANSFER_DATE}`);
  const inBefore = await db.execute(sql`
    SELECT COALESCE(SUM(volume_transferred::decimal),0) AS total
    FROM batch_transfers
    WHERE destination_batch_id = ${batchId}::uuid AND deleted_at IS NULL
      AND transferred_at <= ${TRANSFER_DATE}`);
  const rackBefore = await db.execute(sql`
    SELECT COALESCE(SUM(volume_loss::decimal),0) AS total
    FROM batch_racking_operations
    WHERE batch_id = ${batchId}::uuid AND deleted_at IS NULL
      AND racked_at <= ${TRANSFER_DATE}`);
  const adjBefore = await db.execute(sql`
    SELECT COALESCE(SUM(adjustment_amount::decimal),0) AS total
    FROM batch_volume_adjustments
    WHERE batch_id = ${batchId}::uuid AND deleted_at IS NULL
      AND adjustment_date <= ${TRANSFER_DATE}`);
  const mergeBefore = await db.execute(sql`
    SELECT COALESCE(SUM(volume_added::decimal),0) AS total
    FROM batch_merge_history
    WHERE target_batch_id = ${batchId}::uuid AND deleted_at IS NULL
      AND merged_at <= ${TRANSFER_DATE}`);

  const totalOutL = n((outBefore.rows[0] as any).total);
  const totalInL = n((inBefore.rows[0] as any).total);
  const totalRackL = n((rackBefore.rows[0] as any).total);
  const totalAdjL = n((adjBefore.rows[0] as any).total);
  const totalMergeL = n((mergeBefore.rows[0] as any).total);

  const historical = initialInLiters + totalInL + totalMergeL - totalOutL - totalRackL + totalAdjL;

  console.log(`\n=== Historical volume at ${TRANSFER_DATE.toISOString()} (events <= date) ===`);
  console.log(`  initialInLiters   = ${initialInLiters.toFixed(3)}`);
  console.log(`  + transfersIn     = ${totalInL.toFixed(3)}`);
  console.log(`  + mergesIn        = ${totalMergeL.toFixed(3)}`);
  console.log(`  - transfersOut    = ${totalOutL.toFixed(3)}`);
  console.log(`  - rackingLoss     = ${totalRackL.toFixed(3)}`);
  console.log(`  + adjustments     = ${totalAdjL.toFixed(3)}`);
  console.log(`  = HISTORICAL      = ${historical.toFixed(3)} L`);

  // ---- Detailed event lists (before AND after) ----
  const dumpTransfersOut = await db.execute(sql`
    SELECT bt.transferred_at, bt.volume_transferred, bt.total_volume_processed, bt.loss,
           bt.id, dv.name AS dest_vessel, db2.custom_name AS dest_batch
    FROM batch_transfers bt
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    LEFT JOIN batches db2 ON bt.destination_batch_id = db2.id
    WHERE bt.source_batch_id = ${batchId}::uuid AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at ASC`);
  console.log(`\n=== Transfers OUT of this batch (${dumpTransfersOut.rows.length}) ===`);
  for (const r of dumpTransfersOut.rows as any[]) {
    const when = new Date(r.transferred_at) <= TRANSFER_DATE ? "BEFORE" : "after ";
    console.log(`  [${when}] ${r.transferred_at} → ${r.dest_vessel} (${r.dest_batch})  vol=${r.volume_transferred} proc=${r.total_volume_processed} loss=${r.loss}  id=${r.id}`);
  }

  const dumpTransfersIn = await db.execute(sql`
    SELECT bt.transferred_at, bt.volume_transferred, bt.total_volume_processed, bt.loss,
           bt.id, sv.name AS src_vessel, sb.custom_name AS src_batch
    FROM batch_transfers bt
    LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
    LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = ${batchId}::uuid AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at ASC`);
  console.log(`\n=== Transfers IN to this batch (${dumpTransfersIn.rows.length}) ===`);
  for (const r of dumpTransfersIn.rows as any[]) {
    const when = new Date(r.transferred_at) <= TRANSFER_DATE ? "BEFORE" : "after ";
    console.log(`  [${when}] ${r.transferred_at} ← ${r.src_vessel} (${r.src_batch})  vol=${r.volume_transferred} proc=${r.total_volume_processed} loss=${r.loss}  id=${r.id}`);
  }

  const dumpMerges = await db.execute(sql`
    SELECT merged_at, volume_added, source_batch_id, id
    FROM batch_merge_history
    WHERE target_batch_id = ${batchId}::uuid AND deleted_at IS NULL
    ORDER BY merged_at ASC`);
  console.log(`\n=== Merge history IN (${dumpMerges.rows.length}) ===`);
  for (const r of dumpMerges.rows as any[]) {
    const when = new Date(r.merged_at) <= TRANSFER_DATE ? "BEFORE" : "after ";
    console.log(`  [${when}] ${r.merged_at}  +${r.volume_added}L  src_batch=${r.source_batch_id}  id=${r.id}`);
  }

  const dumpAdj = await db.execute(sql`
    SELECT adjustment_date, adjustment_amount, reason, id
    FROM batch_volume_adjustments
    WHERE batch_id = ${batchId}::uuid AND deleted_at IS NULL
    ORDER BY adjustment_date ASC`);
  console.log(`\n=== Volume adjustments (${dumpAdj.rows.length}) ===`);
  for (const r of dumpAdj.rows as any[]) {
    const when = new Date(r.adjustment_date) <= TRANSFER_DATE ? "BEFORE" : "after ";
    console.log(`  [${when}] ${r.adjustment_date}  ${r.adjustment_amount}L  reason=${r.reason}  id=${r.id}`);
  }

  const dumpRack = await db.execute(sql`
    SELECT racked_at, volume_loss, id
    FROM batch_racking_operations
    WHERE batch_id = ${batchId}::uuid AND deleted_at IS NULL
    ORDER BY racked_at ASC`);
  console.log(`\n=== Racking losses (${dumpRack.rows.length}) ===`);
  for (const r of dumpRack.rows as any[]) {
    const when = new Date(r.racked_at) <= TRANSFER_DATE ? "BEFORE" : "after ";
    console.log(`  [${when}] ${r.racked_at}  -${r.volume_loss}L  id=${r.id}`);
  }

  console.log(`\nNOTE: current_volume reported by card = ${b.current_volume}${b.current_volume_unit}`);
  console.log(`Gap (current - historical) = ${(n(b.current_volume) - historical).toFixed(3)} L`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
