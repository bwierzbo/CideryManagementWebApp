import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  const vesselId = "ae56c002-9b68-405b-be5a-8266e3417cd8";

  // Check batch merge history where target batch is in this vessel
  const mergeHistory = await db.execute(sql`
    SELECT bmh.*, b.name as batch_name, b.custom_name, b.vessel_id as current_vessel_id
    FROM batch_merge_history bmh
    JOIN batches b ON bmh.target_batch_id = b.id
    ORDER BY bmh.merged_at DESC
    LIMIT 20
  `);

  console.log("Recent batch merge history:");
  for (const row of mergeHistory.rows as any[]) {
    console.log(`  ${row.batch_name || row.custom_name}: ${row.source_volume_added}L added, now ${row.target_volume_after}L (vessel: ${row.current_vessel_id})`);
  }

  // Find batches that match the vessel
  const batchesInVessel = await db.execute(sql`
    SELECT b.id, b.name, b.custom_name, b.vessel_id, b.current_volume, b.status, b.deleted_at
    FROM batches b
    WHERE b.vessel_id = ${vesselId}::uuid
  `);

  console.log("\nAll batches in this vessel (including deleted):");
  console.log(batchesInVessel.rows);

  // Check press run with date 2025-10-20
  const pressRun = await db.execute(sql`
    SELECT id, name, status, vessel_id, total_juice_volume, date_completed
    FROM press_runs
    WHERE name LIKE '%2025-10-20%' OR date_completed = '2025-10-20'
    ORDER BY date_completed DESC
  `);

  console.log("\nPress runs from 2025-10-20:");
  console.log(pressRun.rows);

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
