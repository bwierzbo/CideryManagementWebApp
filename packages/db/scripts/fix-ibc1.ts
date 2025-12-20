/**
 * Fix 1000 IBC 1 batch - find and add OG measurement
 */

import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function fix() {
  // Find the batch for 1000 IBC 1 by name pattern
  const batchByName = await db.execute(sql`
    SELECT id, name, custom_name, vessel_id, current_volume, status, deleted_at, original_gravity
    FROM batches
    WHERE name LIKE '%1000 IBC 1%' OR custom_name LIKE '%1000 IBC 1%'
    ORDER BY created_at DESC
  `);

  console.log("Batches matching '1000 IBC 1':");
  for (const row of batchByName.rows as any[]) {
    console.log(`  ${row.name || row.custom_name}: ${row.current_volume}L, vessel: ${row.vessel_id}, status: ${row.status}, deleted: ${row.deleted_at}, OG: ${row.original_gravity}`);
  }

  // Also find the vessel for 1000 IBC 1
  const vessel = await db.execute(sql`
    SELECT id, name, status, current_volume, current_batch_id
    FROM vessels
    WHERE name = '1000 IBC 1'
  `);

  console.log("\n1000 IBC 1 Vessel:");
  for (const row of vessel.rows as any[]) {
    console.log(`  id: ${row.id}, status: ${row.status}, volume: ${row.current_volume}L, current_batch_id: ${row.current_batch_id}`);
  }

  // Now check the batch in merge history
  const vesselId = "fe50eeff-af79-4802-b496-6915313e6d44"; // From merge history
  const batchInVessel = await db.execute(sql`
    SELECT id, name, custom_name, vessel_id, current_volume, status, deleted_at, original_gravity
    FROM batches
    WHERE vessel_id = ${vesselId}::uuid
    ORDER BY created_at DESC
  `);

  console.log("\nBatches in vessel fe50eeff... (from merge history):");
  for (const row of batchInVessel.rows as any[]) {
    console.log(`  ${row.name || row.custom_name}: ${row.current_volume}L, status: ${row.status}, deleted: ${row.deleted_at}, OG: ${row.original_gravity}`);
  }

  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
