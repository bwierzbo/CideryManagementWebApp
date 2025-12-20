/**
 * Fix 1000 IBC 1 batch - set OG to 1.048 and add measurement for 10/19/25
 */

import { db } from "../src/index";
import { batches, batchMeasurements } from "../src/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

async function fix() {
  // The batch ID for 2025-10-20_1000 IBC 1_BLEND_A in vessel fe50eeff-af79-4802-b496-6915313e6d44
  const batchResult = await db.execute(sql`
    SELECT id, name, original_gravity
    FROM batches
    WHERE name = '2025-10-20_1000 IBC 1_BLEND_A'
    AND vessel_id = 'fe50eeff-af79-4802-b496-6915313e6d44'::uuid
  `);

  if (batchResult.rows.length === 0) {
    console.log("❌ Batch not found");
    process.exit(1);
  }

  const batch = batchResult.rows[0] as { id: string; name: string; original_gravity: string };
  console.log(`Found batch: ${batch.name} (ID: ${batch.id})`);
  console.log(`Current OG: ${batch.original_gravity}`);

  // Update OG to 1.048
  await db
    .update(batches)
    .set({
      originalGravity: "1.048",
      updatedAt: new Date(),
    })
    .where(eq(batches.id, batch.id));

  console.log("✅ Updated OG to 1.048");

  // Check if measurement already exists for 10/19/25
  const existingMeasurement = await db.execute(sql`
    SELECT id FROM batch_measurements
    WHERE batch_id = ${batch.id}::uuid
    AND measurement_date::date = '2025-10-19'::date
    AND specific_gravity = '1.048'
  `);

  if (existingMeasurement.rows.length > 0) {
    console.log("⏭️  Measurement for 2025-10-19 already exists, skipping");
  } else {
    // Add measurement for 10/19/25
    await db
      .insert(batchMeasurements)
      .values({
        batchId: batch.id,
        measurementDate: new Date("2025-10-19"),
        specificGravity: "1.048",
        notes: "Initial OG measurement (backfilled)",
        takenBy: "System",
      });

    console.log("✅ Added measurement: SG 1.048 on 2025-10-19");
  }

  console.log("\n========================================");
  console.log("1000 IBC 1 fix complete!");
  console.log("========================================\n");

  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
