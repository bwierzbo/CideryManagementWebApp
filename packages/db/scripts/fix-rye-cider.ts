/**
 * Fix Rye Cider batch - set OG to 1.048 and add measurement
 */

import { db } from "../src/index";
import { batches, batchMeasurements } from "../src/schema";
import { eq } from "drizzle-orm";

async function fixRyeCider() {
  // Find the Rye Cider batch
  const [batch] = await db
    .select({ id: batches.id, name: batches.name, customName: batches.customName })
    .from(batches)
    .where(eq(batches.customName, "Rye Cider"))
    .limit(1);

  if (!batch) {
    console.log("Rye Cider batch not found");
    process.exit(1);
  }

  console.log("Found batch:", batch.customName || batch.name, "- ID:", batch.id);

  // Update the batch with OG and fix the estimatedAbv
  await db
    .update(batches)
    .set({
      originalGravity: "1.048",
      estimatedAbv: null, // Clear the invalid negative value
      updatedAt: new Date(),
    })
    .where(eq(batches.id, batch.id));

  console.log("Updated batch OG to 1.048 and cleared invalid estimatedAbv");

  // Add a measurement for 01/01/2024
  await db
    .insert(batchMeasurements)
    .values({
      batchId: batch.id,
      measurementDate: new Date("2024-01-01"),
      specificGravity: "1.048",
      notes: "Initial OG measurement (backfilled)",
      takenBy: "System",
    });

  console.log("Added measurement: SG 1.048 on 2024-01-01");
  console.log("\nRye Cider batch fixed!");

  process.exit(0);
}

fixRyeCider().catch(e => { console.error(e); process.exit(1); });
