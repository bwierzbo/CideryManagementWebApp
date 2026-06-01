import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  const vessel = await db.execute(sql`
    SELECT id, name, status FROM vessels WHERE name = 'CARBOY-5G-5'
  `);
  const v = (vessel.rows as any[])[0];
  if (!v) { console.log("not found"); process.exit(0); }
  const vId = v.id;
  console.log(`Vessel: ${v.name}  status=${v.status}  id=${vId}`);

  // Batches that were ever IN this vessel (via transfers, current pointer, or historical pointer)
  const candidates = await db.execute(sql`
    SELECT DISTINCT b.id, b.name, b.custom_name, b.status, b.start_date, b.end_date,
           b.current_volume, b.current_volume_unit, b.vessel_id,
           v_now.name AS current_vessel_name
    FROM batches b
    LEFT JOIN vessels v_now ON b.vessel_id = v_now.id
    WHERE b.id IN (
      SELECT source_batch_id FROM batch_transfers WHERE source_vessel_id = ${vId}::uuid
      UNION
      SELECT destination_batch_id FROM batch_transfers WHERE destination_vessel_id = ${vId}::uuid
      UNION
      SELECT id FROM batches WHERE vessel_id = ${vId}::uuid
    )
    ORDER BY b.start_date DESC NULLS LAST
  `);
  console.log(`\nBatches associated with CARBOY-5G-5 (${candidates.rows.length}):`);
  for (const r of candidates.rows as any[]) {
    console.log(`  ${r.custom_name || r.name}  id=${r.id}  status=${r.status}  vol=${r.current_volume}${r.current_volume_unit}  current_vessel=${r.current_vessel_name ?? "(detached)"}  start=${r.start_date}  end=${r.end_date}`);
  }

  const latest = (candidates.rows as any[])[0];
  if (!latest) { console.log("no latest batch"); process.exit(0); }
  const batchId = latest.id;
  console.log(`\n=== Event timeline for "${latest.custom_name || latest.name}" (${batchId}) ===`);

  const events: Array<{ ts: string; type: string; detail: string }> = [];

  // Transfers
  const transfers = await db.execute(sql`
    SELECT bt.transferred_at::text AS ts, bt.volume_transferred, bt.volume_transferred_unit,
           sv.name AS src_vessel, dv.name AS dst_vessel,
           CASE WHEN bt.source_batch_id = ${batchId}::uuid THEN 'OUT' ELSE 'IN' END AS direction
    FROM batch_transfers bt
    LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE (bt.source_batch_id = ${batchId}::uuid OR bt.destination_batch_id = ${batchId}::uuid)
      AND bt.deleted_at IS NULL
  `);
  for (const r of transfers.rows as any[]) {
    events.push({ ts: r.ts, type: `transfer ${r.direction}`, detail: `${r.src_vessel} → ${r.dst_vessel}, ${r.volume_transferred}${r.volume_transferred_unit}` });
  }

  // Measurements
  const meas = await db.execute(sql`
    SELECT measured_at::text AS ts, sg, abv, ph FROM batch_measurements
    WHERE batch_id = ${batchId}::uuid
  `).catch(() => ({ rows: [] }));
  for (const r of meas.rows as any[]) {
    events.push({ ts: r.ts, type: "measurement", detail: `SG=${r.sg} ABV=${r.abv} pH=${r.ph}` });
  }

  // Additives
  const adds = await db.execute(sql`
    SELECT added_at::text AS ts, additive_type, amount, unit FROM batch_additives
    WHERE batch_id = ${batchId}::uuid
  `).catch(() => ({ rows: [] }));
  for (const r of adds.rows as any[]) {
    events.push({ ts: r.ts, type: "additive", detail: `${r.additive_type} ${r.amount}${r.unit}` });
  }

  // Volume adjustments (destroy / loss / correction)
  const adjs = await db.execute(sql`
    SELECT adjustment_date::text AS ts, adjustment_type, volume_before, volume_after, adjustment_amount, reason
    FROM batch_volume_adjustments WHERE batch_id = ${batchId}::uuid AND deleted_at IS NULL
  `);
  for (const r of adjs.rows as any[]) {
    events.push({ ts: r.ts, type: `adj:${r.adjustment_type}`, detail: `${r.volume_before}L → ${r.volume_after}L (Δ${r.adjustment_amount}L) reason="${r.reason ?? ""}"` });
  }

  // Sort chronologically (newest first)
  events.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  console.log("(most recent first)");
  for (const e of events) {
    console.log(`  ${e.ts}  [${e.type}]  ${e.detail}`);
  }

  // Surface the absolute latest event clearly
  if (events.length > 0) {
    const latestEv = events[0];
    console.log(`\n>>> LAST EVENT: ${latestEv.ts}  [${latestEv.type}]  ${latestEv.detail}`);
  }

  // Also check status/endDate
  console.log(`\nBatch status=${latest.status}  endDate=${latest.end_date}  vessel_id=${latest.vessel_id ?? "(detached)"}`);

  process.exit(0);
}

check().catch((e) => { console.error(e); process.exit(1); });
