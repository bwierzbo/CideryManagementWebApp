import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  // Find the vessel named tank-120-mix-2
  const vessel = await db.execute(sql`
    SELECT id, name, status, location
    FROM vessels
    WHERE name = 'tank-120-mix-2' OR name ILIKE '%120-mix-2%' OR name ILIKE '%tank%120%mix%2%'
    LIMIT 5
  `);
  console.log("Vessel match(es):");
  console.log(vessel.rows);

  if (vessel.rows.length === 0) {
    console.log("\nNo vessel found. Listing vessels with 'mix' in name:");
    const all = await db.execute(sql`
      SELECT id, name, status FROM vessels WHERE name ILIKE '%mix%' ORDER BY name
    `);
    console.log(all.rows);
    process.exit(0);
  }

  const vesselId = (vessel.rows[0] as any).id;
  const vesselName = (vessel.rows[0] as any).name;
  console.log(`\nUsing vessel: ${vesselName} (${vesselId})`);

  // Current batch in this vessel
  const current = await db.execute(sql`
    SELECT id, name, custom_name, status, vessel_id, current_volume, created_at
    FROM batches
    WHERE vessel_id = ${vesselId}::uuid AND deleted_at IS NULL
  `);
  console.log("\nCurrent batches in vessel:");
  console.log(current.rows);

  // Transfers into this vessel (as destination) — these reveal what vessel it came FROM
  const transfersIn = await db.execute(sql`
    SELECT
      bt.id,
      bt.transferred_at,
      bt.volume_transferred,
      bt.volume_transferred_unit,
      bt.notes,
      src_v.name AS source_vessel_name,
      src_v.id AS source_vessel_id,
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
  console.log("\nTransfers INTO this vessel (most recent first):");
  for (const row of transfersIn.rows as any[]) {
    console.log(
      `  ${row.transferred_at}: from vessel "${row.source_vessel_name}" — source batch "${row.source_batch_name || row.source_batch_custom_name}" → dest batch "${row.dest_batch_name || row.dest_batch_custom_name}" (vol ${row.volume_transferred} ${row.volume_transferred_unit})`,
    );
  }

  // Transfers OUT of this vessel for context
  const transfersOut = await db.execute(sql`
    SELECT
      bt.id,
      bt.transferred_at,
      bt.volume_transferred,
      bt.volume_transferred_unit,
      dst_v.name AS dest_vessel_name
    FROM batch_transfers bt
    LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
    WHERE bt.source_vessel_id = ${vesselId}::uuid AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at DESC
  `);
  console.log("\nTransfers OUT of this vessel:");
  for (const row of transfersOut.rows as any[]) {
    console.log(
      `  ${row.transferred_at}: → "${row.dest_vessel_name}" (vol ${row.volume_transferred} ${row.volume_transferred_unit})`,
    );
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
