/**
 * Fix batch numbers - regenerate batch numbers using startDate instead of createdAt
 */

import { db } from "../src/index.js";
import { batches, vessels } from "../src/schema.js";
import { sql, and, isNull, eq } from "drizzle-orm";

interface BatchComposition {
  varietyName: string;
  fractionOfBatch: number;
}

// Copied from lib - batch name generation
function generateVarietyCode(varietyName: string): string {
  if (!varietyName || typeof varietyName !== "string") {
    return "UNKN";
  }

  const cleaned = varietyName.trim().toUpperCase();

  if (cleaned === "") {
    return "UNKN";
  }

  const words = cleaned.split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) {
    return "UNKN";
  } else if (words.length === 1) {
    return words[0].substring(0, 4);
  } else if (words.length === 2) {
    return words[0].substring(0, 2) + words[1].substring(0, 2);
  } else if (words.length === 3) {
    return words[0].charAt(0) + words[1].charAt(0) + words[2].substring(0, 2);
  } else {
    return words
      .slice(0, 4)
      .map((word) => word.charAt(0))
      .join("");
  }
}

function generateBatchName(
  date: Date,
  vesselCode: string,
  primaryVariety?: string,
  sequence: string = "A"
): string {
  const dateStr = date.toISOString().split("T")[0];
  const varietyCode = primaryVariety ? generateVarietyCode(primaryVariety) : "BLEND";
  return `${dateStr}_${vesselCode}_${varietyCode}_${sequence}`;
}

async function fixBatchNumbers() {
  console.log("=== Fixing Batch Numbers ===\n");

  // Get all batches with their vessel info
  const allBatches = await db
    .select({
      id: batches.id,
      batchNumber: batches.batchNumber,
      name: batches.name,
      customName: batches.customName,
      startDate: batches.startDate,
      createdAt: batches.createdAt,
      vesselId: batches.vesselId,
      productType: batches.productType,
    })
    .from(batches)
    .where(isNull(batches.deletedAt))
    .orderBy(batches.startDate);

  // Get all vessels for lookup
  const allVessels = await db
    .select({
      id: vessels.id,
      name: vessels.name,
    })
    .from(vessels)
    .where(isNull(vessels.deletedAt));

  const vesselMap = new Map(allVessels.map((v) => [v.id, v.name || v.id.substring(0, 6).toUpperCase()]));

  // Find mismatches
  const mismatches: {
    id: string;
    oldBatchNumber: string;
    newBatchNumber: string;
    customName: string | null;
    startDate: Date;
  }[] = [];

  for (const b of allBatches) {
    // Skip LEGACY batches, blend batches, and brandy batches - they have different naming conventions
    if (b.batchNumber?.startsWith("LEGACY-")) continue;
    if (b.batchNumber?.startsWith("blend-")) continue;
    if (b.batchNumber?.startsWith("brandy-")) continue;
    if (b.batchNumber?.startsWith("BR-")) continue;

    // Check if batch number contains a date pattern
    const dateMatch = b.batchNumber?.match(/^(\d{4}-\d{2}-\d{2})/);
    const batchNumDate = dateMatch ? dateMatch[1] : null;
    const startDate = b.startDate?.toISOString().split("T")[0];

    if (batchNumDate && batchNumDate !== startDate && b.startDate) {
      // Generate new batch number using startDate
      const vesselCode = b.vesselId ? vesselMap.get(b.vesselId) || "UNKN" : "UNKN";

      // Extract existing variety code from current batch number (after vessel name)
      const existingParts = b.batchNumber?.split("_") || [];
      const existingVarietyCode = existingParts.length >= 3 ? existingParts[existingParts.length - 2] : "BLEND";
      const existingSequence = existingParts.length >= 4 ? existingParts[existingParts.length - 1] : "A";

      // Build new batch number preserving the variety and sequence
      const newDateStr = b.startDate.toISOString().split("T")[0];
      const newBatchNumber = `${newDateStr}_${vesselCode}_${existingVarietyCode}_${existingSequence}`;

      mismatches.push({
        id: b.id,
        oldBatchNumber: b.batchNumber || "",
        newBatchNumber,
        customName: b.customName,
        startDate: b.startDate,
      });
    }
  }

  console.log(`Found ${mismatches.length} batches with mismatched dates\n`);

  if (mismatches.length === 0) {
    console.log("No mismatches to fix!");
    process.exit(0);
  }

  // Show what will be changed
  console.log("| Custom Name | Old Batch Number | New Batch Number |");
  console.log("|-------------|------------------|------------------|");

  for (const m of mismatches) {
    const name = (m.customName || "").substring(0, 25).padEnd(25);
    const oldNum = m.oldBatchNumber.substring(0, 45).padEnd(45);
    const newNum = m.newBatchNumber.substring(0, 45).padEnd(45);
    console.log(`| ${name} | ${oldNum} | ${newNum} |`);
  }

  console.log("\n=== Applying Fixes ===\n");

  // Apply fixes
  let updated = 0;
  for (const m of mismatches) {
    try {
      await db
        .update(batches)
        .set({
          batchNumber: m.newBatchNumber,
          name: m.newBatchNumber, // Also update name to match
        })
        .where(eq(batches.id, m.id));

      console.log(`✅ Fixed: ${m.customName || m.oldBatchNumber} -> ${m.newBatchNumber}`);
      updated++;
    } catch (err) {
      console.error(`❌ Failed to fix ${m.oldBatchNumber}:`, err);
    }
  }

  console.log(`\nUpdated ${updated} batch numbers`);

  process.exit(0);
}

fixBatchNumbers().catch((e) => {
  console.error(e);
  process.exit(1);
});
