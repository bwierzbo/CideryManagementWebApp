import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  // Find tank-500-2
  const vessel = await db.execute(sql`
    SELECT id, name, status, location, capacity, capacity_unit
    FROM vessels
    WHERE name ILIKE 'tank-500-2' OR name ILIKE '%500%2%'
    ORDER BY name
  `);
  console.log("Vessels matching '500-2':");
  console.log(vessel.rows);

  // pick exact match first
  const exact = (vessel.rows as any[]).find(
    (v) => v.name.toUpperCase() === "TANK-500-2",
  );
  if (!exact) {
    console.log("No exact TANK-500-2 found. Aborting.");
    process.exit(0);
  }
  const vesselId = exact.id;
  console.log(`\nUsing: ${exact.name} (${vesselId})`);

  // Current batch(es) in tank-500-2
  const current = await db.execute(sql`
    SELECT id, name, custom_name, status, current_volume, current_volume_unit, initial_volume_liters, start_date
    FROM batches
    WHERE vessel_id = ${vesselId}::uuid AND deleted_at IS NULL
  `);
  console.log("\nCurrent batches in TANK-500-2:");
  for (const r of current.rows as any[]) {
    console.log(`  ${r.custom_name || r.name}  status=${r.status}, current=${r.current_volume}${r.current_volume_unit}, initial=${r.initial_volume_liters}L, started=${r.start_date}`);
  }

  // All transfers INTO TANK-500-2
  const ins = await db.execute(sql`
    SELECT
      bt.transferred_at,
      bt.volume_transferred,
      bt.volume_transferred_unit,
      bt.loss,
      src_v.name AS source_vessel,
      src_b.name AS source_batch_name,
      src_b.custom_name AS source_batch_custom_name,
      dst_b.name AS dest_batch_name,
      dst_b.custom_name AS dest_batch_custom_name
    FROM batch_transfers bt
    LEFT JOIN vessels src_v ON bt.source_vessel_id = src_v.id
    LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
    LEFT JOIN batches dst_b ON bt.destination_batch_id = dst_b.id
    WHERE bt.destination_vessel_id = ${vesselId}::uuid AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at DESC
  `);
  console.log(`\nTransfers INTO TANK-500-2 (${ins.rows.length}):`);
  for (const r of ins.rows as any[]) {
    console.log(`  ${r.transferred_at}  ← ${r.source_vessel}  | src batch "${r.source_batch_custom_name || r.source_batch_name}" → dst "${r.dest_batch_custom_name || r.dest_batch_name}"  | ${r.volume_transferred}${r.volume_transferred_unit}, loss=${r.loss}`);
  }

  // All transfers OUT OF TANK-500-2
  const outs = await db.execute(sql`
    SELECT
      bt.transferred_at,
      bt.volume_transferred,
      bt.volume_transferred_unit,
      bt.loss,
      dst_v.name AS dest_vessel,
      src_b.name AS source_batch_name,
      src_b.custom_name AS source_batch_custom_name,
      dst_b.name AS dest_batch_name,
      dst_b.custom_name AS dest_batch_custom_name
    FROM batch_transfers bt
    LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
    LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
    LEFT JOIN batches dst_b ON bt.destination_batch_id = dst_b.id
    WHERE bt.source_vessel_id = ${vesselId}::uuid AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at DESC
  `);
  console.log(`\nTransfers OUT OF TANK-500-2 (${outs.rows.length}):`);
  for (const r of outs.rows as any[]) {
    console.log(`  ${r.transferred_at}  → ${r.dest_vessel}  | src batch "${r.source_batch_custom_name || r.source_batch_name}" → dst "${r.dest_batch_custom_name || r.dest_batch_name}"  | ${r.volume_transferred}${r.volume_transferred_unit}, loss=${r.loss}`);
  }

  // What batch lived in TANK-500-2 around 2026-05-05? Look at historical vessel via batches that ever pointed here
  const everInVessel = await db.execute(sql`
    SELECT id, name, custom_name, status, current_volume, current_volume_unit,
           initial_volume_liters, start_date, end_date, deleted_at,
           created_at, updated_at
    FROM batches
    WHERE vessel_id = ${vesselId}::uuid
    ORDER BY created_at DESC
  `);
  console.log(`\nAll batches whose CURRENT vessel = TANK-500-2 (includes deleted, ${everInVessel.rows.length}):`);
  for (const r of everInVessel.rows as any[]) {
    console.log(`  ${r.custom_name || r.name}  status=${r.status}, vol=${r.current_volume}${r.current_volume_unit}, init=${r.initial_volume_liters}L, start=${r.start_date}, end=${r.end_date}, deleted=${r.deleted_at ? "YES" : "no"}`);
  }

  // Comparison: TANK-1000-1 outflows
  console.log("\n\n=== Sanity check: TANK-1000-1 outflows ===");
  const tank1000 = await db.execute(sql`
    SELECT id, name FROM vessels WHERE name ILIKE 'tank-1000-1'
  `);
  const tank1000Id = (tank1000.rows as any[])[0]?.id;
  if (tank1000Id) {
    const t1000outs = await db.execute(sql`
      SELECT
        bt.transferred_at,
        bt.volume_transferred,
        bt.volume_transferred_unit,
        dst_v.name AS dest_vessel,
        src_b.name AS source_batch_name,
        src_b.custom_name AS source_batch_custom_name,
        dst_b.name AS dest_batch_name,
        dst_b.custom_name AS dest_batch_custom_name
      FROM batch_transfers bt
      LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
      LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
      LEFT JOIN batches dst_b ON bt.destination_batch_id = dst_b.id
      WHERE bt.source_vessel_id = ${tank1000Id}::uuid AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at DESC
      LIMIT 15
    `);
    for (const r of t1000outs.rows as any[]) {
      console.log(`  ${r.transferred_at}  → ${r.dest_vessel}  | "${r.source_batch_custom_name || r.source_batch_name}" → "${r.dest_batch_custom_name || r.dest_batch_name}"  | ${r.volume_transferred}${r.volume_transferred_unit}`);
    }

    // current batch in TANK-1000-1
    const t1000current = await db.execute(sql`
      SELECT id, name, custom_name, status, current_volume, current_volume_unit, initial_volume_liters
      FROM batches WHERE vessel_id = ${tank1000Id}::uuid AND deleted_at IS NULL
    `);
    console.log("\nCurrent batches in TANK-1000-1:");
    for (const r of t1000current.rows as any[]) {
      console.log(`  ${r.custom_name || r.name}  status=${r.status}, vol=${r.current_volume}${r.current_volume_unit}, init=${r.initial_volume_liters}L`);
    }
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
