/**
 * Backfill Fermentation Stages for existing batches
 *
 * This script calculates fermentation stages for all batches based on their
 * OG, current SG (from latest measurement), and target FG.
 *
 * What it does:
 * 1. Sets targetFinalGravity for batches missing it (uses finalGravity if available, else 0.998)
 * 2. Calculates fermentation progress using the formula: % = (OG - current SG) / (OG - target FG) * 100
 * 3. Sets fermentationStage based on percentage (early: 0-70%, mid: 70-90%, approaching_dry: 90-98%, terminal: 98%+)
 *
 * Run with: pnpm --filter db exec npx tsx scripts/backfill-fermentation-stages.ts
 */

import { db } from "../src/index";
import { batches, batchMeasurements } from "../src/schema";
import { eq, isNull, desc, and } from "drizzle-orm";

const DEFAULT_TARGET_FG = 0.998; // Dry cider

// Inlined fermentation calculation to avoid cross-package dependency
type FermentationStage = "early" | "mid" | "approaching_dry" | "terminal" | "unknown";

const STAGE_THRESHOLDS = {
  earlyMax: 70,
  midMax: 90,
  approachingDryMax: 98,
};

function calculateFermentationProgress(
  originalGravity: number,
  currentGravity: number,
  targetFinalGravity: number
): { percentFermented: number; stage: FermentationStage } {
  // Calculate percentage fermented
  if (originalGravity <= 0 || currentGravity <= 0 || targetFinalGravity <= 0) {
    return { percentFermented: 0, stage: "unknown" };
  }

  if (originalGravity < currentGravity || originalGravity <= targetFinalGravity) {
    return { percentFermented: 0, stage: "unknown" };
  }

  const totalDrop = originalGravity - targetFinalGravity;
  const actualDrop = originalGravity - currentGravity;
  const percentFermented = Math.round((actualDrop / totalDrop) * 1000) / 10;

  // Determine stage
  let stage: FermentationStage;
  if (percentFermented < STAGE_THRESHOLDS.earlyMax) {
    stage = "early";
  } else if (percentFermented < STAGE_THRESHOLDS.midMax) {
    stage = "mid";
  } else if (percentFermented < STAGE_THRESHOLDS.approachingDryMax) {
    stage = "approaching_dry";
  } else {
    stage = "terminal";
  }

  return { percentFermented, stage };
}

type BatchStatus = "fermentation" | "aging" | "conditioning" | "packaged" | "archived" | "completed";

async function backfillFermentationStages() {
  console.log("Starting fermentation stage backfill...\n");

  // Get all non-deleted batches
  const allBatches = await db
    .select({
      id: batches.id,
      name: batches.name,
      customName: batches.customName,
      status: batches.status,
      originalGravity: batches.originalGravity,
      finalGravity: batches.finalGravity,
      targetFinalGravity: batches.targetFinalGravity,
      fermentationStage: batches.fermentationStage,
    })
    .from(batches)
    .where(isNull(batches.deletedAt));

  console.log(`Found ${allBatches.length} total batches\n`);

  let updatedTargetFG = 0;
  let updatedStage = 0;
  let skippedNoOG = 0;
  let skippedNoMeasurement = 0;

  for (const batch of allBatches) {
    const batchName = batch.customName || batch.name;
    const updates: {
      targetFinalGravity?: string;
      fermentationStage?: FermentationStage;
      fermentationStageUpdatedAt?: Date;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    // 1. Set targetFinalGravity if not already set
    if (!batch.targetFinalGravity) {
      const targetFG = batch.finalGravity
        ? parseFloat(batch.finalGravity)
        : DEFAULT_TARGET_FG;

      updates.targetFinalGravity = targetFG.toFixed(3);
      updatedTargetFG++;
      console.log(
        `📍 ${batchName}: Setting target FG to ${targetFG.toFixed(3)} ${batch.finalGravity ? "(from finalGravity)" : "(default dry)"}`
      );
    }

    // 2. Calculate fermentation stage for fermenting/aging batches
    const activeStatuses: BatchStatus[] = ["fermentation", "aging"];
    if (activeStatuses.includes(batch.status as BatchStatus)) {
      const og = batch.originalGravity
        ? parseFloat(batch.originalGravity)
        : null;

      if (!og) {
        console.log(`⏭️  ${batchName}: No OG set, skipping stage calculation`);
        skippedNoOG++;
        continue;
      }

      // Get latest SG measurement
      const [latestMeasurement] = await db
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
        .orderBy(desc(batchMeasurements.measurementDate))
        .limit(1);

      if (!latestMeasurement?.specificGravity) {
        console.log(
          `⏭️  ${batchName}: No SG measurements found, skipping stage calculation`
        );
        skippedNoMeasurement++;
        continue;
      }

      const currentSG = parseFloat(latestMeasurement.specificGravity);
      const targetFG = updates.targetFinalGravity
        ? parseFloat(updates.targetFinalGravity)
        : batch.targetFinalGravity
          ? parseFloat(batch.targetFinalGravity)
          : DEFAULT_TARGET_FG;

      // Calculate progress
      const { percentFermented, stage } = calculateFermentationProgress(
        og,
        currentSG,
        targetFG,
        DEFAULT_STAGE_THRESHOLDS
      );

      updates.fermentationStage = stage;
      updates.fermentationStageUpdatedAt = new Date();
      updatedStage++;

      console.log(
        `✅ ${batchName}: OG=${og.toFixed(3)}, SG=${currentSG.toFixed(3)}, Target=${targetFG.toFixed(3)} → ${percentFermented.toFixed(1)}% (${stage})`
      );
    } else if (batch.status === "completed" || batch.status === "packaged" || batch.status === "archived") {
      // For completed batches, set stage to terminal
      if (batch.fermentationStage !== "terminal") {
        updates.fermentationStage = "terminal";
        updates.fermentationStageUpdatedAt = new Date();
        updatedStage++;
        console.log(`✅ ${batchName}: Status=${batch.status} → terminal`);
      }
    }

    // Apply updates if we have any
    if (
      updates.targetFinalGravity ||
      updates.fermentationStage
    ) {
      await db.update(batches).set(updates).where(eq(batches.id, batch.id));
    }
  }

  console.log(`\n========================================`);
  console.log(`Backfill complete!`);
  console.log(`  Target FG set: ${updatedTargetFG} batches`);
  console.log(`  Stage updated: ${updatedStage} batches`);
  console.log(`  Skipped (no OG): ${skippedNoOG} batches`);
  console.log(`  Skipped (no measurements): ${skippedNoMeasurement} batches`);
  console.log(`========================================\n`);

  process.exit(0);
}

backfillFermentationStages().catch((error) => {
  console.error("Error during backfill:", error);
  process.exit(1);
});
