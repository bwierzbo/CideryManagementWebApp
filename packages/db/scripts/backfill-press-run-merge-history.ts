#!/usr/bin/env tsx
/**
 * Backfill script to create batchMergeHistory records for press runs
 * that were merged into existing batches.
 *
 * This script identifies batch compositions that were created after their
 * parent batch (indicating a merge operation) and attempts to match them
 * to the press run that added them.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-press-run-merge-history.ts [--dry-run]
 */

import { db } from "../src/index";
import {
  batches,
  batchCompositions,
  batchMergeHistory,
  pressRuns,
  pressRunLoads,
} from "../src/schema";
import { eq, and, gt, isNull, sql, inArray } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry-run");

interface CompositionGroup {
  batchId: string;
  batchName: string;
  batchCreated: Date;
  currentVolume: string;
  compositionCreatedAt: Date;
  compositions: Array<{
    id: string;
    purchaseItemId: string;
    juiceVolume: string;
  }>;
}

interface PressRunCandidate {
  pressRunId: string;
  pressRunName: string | null;
  dateCompleted: string | null;
  totalJuiceVolume: string | null;
  matchScore: number;
}

async function findLateCompositions(): Promise<CompositionGroup[]> {
  console.log("\n🔍 Finding compositions created after their batch...");

  const results = await db.execute<{
    batch_id: string;
    batch_name: string;
    batch_created: string;
    current_volume: string;
    composition_id: string;
    purchase_item_id: string;
    juice_volume: string;
    composition_created: string;
  }>(sql`
    SELECT
      b.id as batch_id,
      b.name as batch_name,
      b.created_at as batch_created,
      b.current_volume,
      bc.id as composition_id,
      bc.purchase_item_id,
      bc.juice_volume,
      bc.created_at as composition_created
    FROM batches b
    JOIN batch_compositions bc ON b.id = bc.batch_id
    WHERE b.deleted_at IS NULL
      AND bc.deleted_at IS NULL
      AND bc.created_at > b.created_at + INTERVAL '1 minute'
      AND bc.source_type = 'base_fruit'
    ORDER BY b.id, bc.created_at
  `);

  // Group compositions by batch and creation time window (within 1 minute)
  const groups: Map<string, CompositionGroup> = new Map();

  for (const row of results.rows) {
    const key = `${row.batch_id}-${row.composition_created}`;

    if (!groups.has(key)) {
      groups.set(key, {
        batchId: row.batch_id,
        batchName: row.batch_name,
        batchCreated: new Date(row.batch_created),
        currentVolume: row.current_volume,
        compositionCreatedAt: new Date(row.composition_created),
        compositions: [],
      });
    }

    groups.get(key)!.compositions.push({
      id: row.composition_id,
      purchaseItemId: row.purchase_item_id,
      juiceVolume: row.juice_volume,
    });
  }

  return Array.from(groups.values());
}

async function findMatchingPressRun(
  group: CompositionGroup
): Promise<PressRunCandidate | null> {
  // Get all press runs that used any of these purchase items
  const purchaseItemIds = group.compositions.map((c) => c.purchaseItemId);

  const candidates = await db.execute<{
    press_run_id: string;
    press_run_name: string | null;
    date_completed: string | null;
    total_juice_volume: string | null;
  }>(sql`
    SELECT DISTINCT
      pr.id as press_run_id,
      pr.press_run_name,
      pr.date_completed,
      pr.total_juice_volume
    FROM press_runs pr
    JOIN press_run_loads prl ON pr.id = prl.press_run_id
    WHERE prl.purchase_item_id IN (${sql.join(purchaseItemIds.map(id => sql`${id}`), sql`, `)})
      AND pr.deleted_at IS NULL
      AND pr.status = 'completed'
      AND pr.date_completed IS NOT NULL
  `);

  if (candidates.rows.length === 0) {
    return null;
  }

  // Score each candidate based on:
  // 1. Date proximity (closer is better)
  // 2. Volume match (total composition volume ~= press run volume)
  const totalCompositionVolume = group.compositions.reduce(
    (sum, c) => sum + parseFloat(c.juiceVolume),
    0
  );

  let bestCandidate: PressRunCandidate | null = null;
  let bestScore = -Infinity;

  for (const candidate of candidates.rows) {
    const dateCompleted = candidate.date_completed
      ? new Date(candidate.date_completed)
      : null;

    if (!dateCompleted) continue;

    // Date score: inverse of days difference (max 30 days)
    const daysDiff = Math.abs(
      (group.compositionCreatedAt.getTime() - dateCompleted.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const dateScore = Math.max(0, 30 - daysDiff);

    // Volume score: how close the volumes match (as percentage)
    const pressRunVolume = candidate.total_juice_volume
      ? parseFloat(candidate.total_juice_volume)
      : 0;
    const volumeDiff = Math.abs(totalCompositionVolume - pressRunVolume);
    const volumeScore =
      pressRunVolume > 0
        ? Math.max(0, 100 - (volumeDiff / pressRunVolume) * 100)
        : 0;

    // Combined score (weight date more heavily)
    const score = dateScore * 2 + volumeScore;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = {
        pressRunId: candidate.press_run_id,
        pressRunName: candidate.press_run_name,
        dateCompleted: candidate.date_completed,
        totalJuiceVolume: candidate.total_juice_volume,
        matchScore: score,
      };
    }
  }

  // Only return high confidence matches (score > 80 indicates good volume match)
  // Score breakdown: date proximity (max 60) + volume match (max 100)
  // Score > 80 means either perfect volume match or very close date + good volume
  if (bestCandidate && bestScore > 80) {
    return bestCandidate;
  }

  return null;
}

async function createMergeHistory(
  group: CompositionGroup,
  pressRun: PressRunCandidate
): Promise<void> {
  const totalVolume = group.compositions.reduce(
    (sum, c) => sum + parseFloat(c.juiceVolume),
    0
  );

  const currentVolume = parseFloat(group.currentVolume);
  const volumeBefore = currentVolume - totalVolume;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create merge history:`);
    console.log(`    Target Batch: ${group.batchName}`);
    console.log(`    Source Press Run: ${pressRun.pressRunName}`);
    console.log(`    Volume Added: ${totalVolume.toFixed(3)}L`);
    console.log(
      `    Volume Change: ${volumeBefore.toFixed(3)}L → ${currentVolume.toFixed(3)}L`
    );
    console.log(`    Merged At: ${group.compositionCreatedAt.toISOString()}`);
    return;
  }

  await db.insert(batchMergeHistory).values({
    targetBatchId: group.batchId,
    sourcePressRunId: pressRun.pressRunId,
    sourceType: "press_run",
    volumeAdded: totalVolume.toString(),
    volumeAddedUnit: "L",
    targetVolumeBefore: volumeBefore.toString(),
    targetVolumeBeforeUnit: "L",
    targetVolumeAfter: currentVolume.toString(),
    targetVolumeAfterUnit: "L",
    notes: `Press run juice added to existing batch (backfilled from historical data)`,
    mergedAt: group.compositionCreatedAt,
    mergedBy: null, // Unknown from historical data
    createdAt: new Date(),
  });

  console.log(`  ✅ Created merge history for ${group.batchName}`);
}

async function main() {
  console.log("🚀 Starting Press Run Merge History Backfill");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will modify database)"}`);

  const groups = await findLateCompositions();
  console.log(`\n📊 Found ${groups.length} composition groups to process`);

  let successCount = 0;
  let skipCount = 0;

  for (const group of groups) {
    console.log(`\n📦 Processing batch: ${group.batchName}`);
    console.log(`  Compositions: ${group.compositions.length}`);
    console.log(`  Total Volume: ${group.compositions.reduce((s, c) => s + parseFloat(c.juiceVolume), 0).toFixed(3)}L`);
    console.log(`  Created At: ${group.compositionCreatedAt.toISOString()}`);

    const pressRun = await findMatchingPressRun(group);

    if (!pressRun) {
      console.log(`  ⚠️  Could not find matching press run - skipping`);
      skipCount++;
      continue;
    }

    console.log(`  🎯 Matched to press run: ${pressRun.pressRunName || pressRun.pressRunId}`);
    console.log(`     Match Score: ${pressRun.matchScore.toFixed(1)}`);
    console.log(`     Press Run Volume: ${pressRun.totalJuiceVolume}L`);
    console.log(`     Press Run Date: ${pressRun.dateCompleted}`);

    await createMergeHistory(group, pressRun);
    successCount++;
  }

  console.log("\n" + "=".repeat(60));
  console.log("📈 Summary:");
  console.log(`  Total groups processed: ${groups.length}`);
  console.log(`  Successfully matched: ${successCount}`);
  console.log(`  Skipped (no match): ${skipCount}`);

  if (DRY_RUN) {
    console.log("\n💡 This was a DRY RUN. No changes were made.");
    console.log("   Run without --dry-run to apply changes.");
  } else {
    console.log("\n✅ Backfill completed!");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error during backfill:", error);
  process.exit(1);
});
