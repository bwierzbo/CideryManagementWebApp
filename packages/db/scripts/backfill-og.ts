/**
 * Backfill Original Gravity (OG) for existing batches from their earliest SG measurement
 *
 * Run with: pnpm --filter db exec npx tsx scripts/backfill-og.ts
 */

import { db } from "../src/index";
import { batches, batchMeasurements } from "../src/schema";
import { eq, isNull, asc, and } from "drizzle-orm";

async function backfillOriginalGravity() {
  console.log("Starting OG backfill...\n");

  // Find all batches without originalGravity
  const batchesWithoutOG = await db
    .select({ id: batches.id, name: batches.name, customName: batches.customName })
    .from(batches)
    .where(and(isNull(batches.originalGravity), isNull(batches.deletedAt)));

  console.log(`Found ${batchesWithoutOG.length} batches without Original Gravity\n`);

  let updated = 0;
  let skipped = 0;

  for (const batch of batchesWithoutOG) {
    // Get earliest SG measurement for this batch
    const [earliestMeasurement] = await db
      .select({
        specificGravity: batchMeasurements.specificGravity,
        measurementDate: batchMeasurements.measurementDate,
      })
      .from(batchMeasurements)
      .where(
        and(
          eq(batchMeasurements.batchId, batch.id),
          isNull(batchMeasurements.deletedAt)
        )
      )
      .orderBy(asc(batchMeasurements.measurementDate))
      .limit(1);

    if (earliestMeasurement?.specificGravity) {
      // Update batch with this SG as OG
      try {
        await db
          .update(batches)
          .set({
            originalGravity: earliestMeasurement.specificGravity,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, batch.id));

        const batchName = batch.customName || batch.name;
        console.log(`✅ ${batchName}: Set OG to ${earliestMeasurement.specificGravity} (from ${earliestMeasurement.measurementDate.toISOString().slice(0, 10)})`);
        updated++;
      } catch (error: any) {
        const batchName = batch.customName || batch.name;
        console.log(`⚠️  ${batchName}: Failed to update (${error.constraint || error.message})`);
        skipped++;
      }
    } else {
      const batchName = batch.customName || batch.name;
      console.log(`⏭️  ${batchName}: No SG measurements found, skipped`);
      skipped++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Backfill complete!`);
  console.log(`  Updated: ${updated} batches`);
  console.log(`  Skipped: ${skipped} batches (no SG measurements)`);
  console.log(`========================================\n`);

  process.exit(0);
}

backfillOriginalGravity().catch((error) => {
  console.error("Error during backfill:", error);
  process.exit(1);
});
