/**
 * Fix IBC vessel batches - add OG measurements
 */

import { db } from "../src/index";
import { batches, batchMeasurements, vessels } from "../src/schema";
import { eq, and, isNull } from "drizzle-orm";

async function fixIBCVessels() {
  const fixes = [
    { vesselName: "1000 IBC 1", sg: "1.048", date: "2025-10-19" },
    { vesselName: "1000 IBC 2", sg: "1.046", date: "2025-10-12" },
    { vesselName: "1000 IBC 3", sg: "1.048", date: "2025-10-28" },
  ];

  for (const fix of fixes) {
    console.log(`\nProcessing ${fix.vesselName}...`);

    // Find the vessel
    const [vessel] = await db
      .select({ id: vessels.id, name: vessels.name })
      .from(vessels)
      .where(eq(vessels.name, fix.vesselName))
      .limit(1);

    if (!vessel) {
      console.log(`  Vessel ${fix.vesselName} not found`);
      continue;
    }

    // Find the active batch in this vessel
    const [batch] = await db
      .select({ id: batches.id, name: batches.name, customName: batches.customName, originalGravity: batches.originalGravity })
      .from(batches)
      .where(and(eq(batches.vesselId, vessel.id), isNull(batches.deletedAt)))
      .limit(1);

    if (!batch) {
      console.log(`  No active batch found in ${fix.vesselName}`);
      continue;
    }

    const batchName = batch.customName || batch.name;
    console.log(`  Found batch: ${batchName}`);

    // Update batch OG if not set
    if (!batch.originalGravity) {
      await db
        .update(batches)
        .set({
          originalGravity: fix.sg,
          updatedAt: new Date(),
        })
        .where(eq(batches.id, batch.id));
      console.log(`  Set OG to ${fix.sg}`);
    } else {
      console.log(`  OG already set to ${batch.originalGravity}`);
    }

    // Add measurement
    await db
      .insert(batchMeasurements)
      .values({
        batchId: batch.id,
        measurementDate: new Date(fix.date),
        specificGravity: fix.sg,
        notes: "Initial OG measurement (backfilled)",
        takenBy: "System",
      });
    console.log(`  Added measurement: SG ${fix.sg} on ${fix.date}`);
  }

  console.log("\n========================================");
  console.log("IBC vessel fixes complete!");
  console.log("========================================\n");

  process.exit(0);
}

fixIBCVessels().catch(e => { console.error(e); process.exit(1); });
