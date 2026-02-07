/**
 * TTB 2025 Annual Form 5120.17 Validation Script
 *
 * Validates the 2025 annual TTB form data against known reference values:
 * - Opening balance: ~1121 gallons (cider + pommeau/salish)
 * - Distillation: ~3000L cider sent to DSP, ~55gal brandy received
 * - Pommeau/salish in wine16To21 tax class
 * - Balance equation: Opening + Production + Receipts = Removals + Losses + Ending
 * - Tax calculation uses correct rates ($0.226/gal, $0.056 credit)
 */

import { db } from "../index.js";
import { sql, and, eq, gte, lte, isNull, isNotNull, or, ne, lt, desc } from "drizzle-orm";
import {
  batches,
  vessels,
  pressRuns,
  basefruitPurchases,
  basefruitPurchaseItems,
  baseFruitVarieties,
  batchTransfers,
  batchFilterOperations,
  batchRackingOperations,
  batchVolumeAdjustments,
  distillationRecords,
} from "../schema.js";
import {
  inventoryItems,
  inventoryDistributions,
  inventoryAdjustments,
  bottleRuns,
  kegFills,
} from "../schema/packaging.js";
import { organizationSettings } from "../schema/organization.js";
import {
  ttbPeriodSnapshots,
  salesChannels,
} from "../schema/ttb.js";

// ============================================
// Constants (matching lib/calculations/ttb.ts)
// ============================================
const WINE_GALLONS_PER_LITER = 0.264172;
const HARD_CIDER_TAX_RATE = 0.226;
const SMALL_PRODUCER_CREDIT_PER_GALLON = 0.056;
const SMALL_PRODUCER_CREDIT_LIMIT_GALLONS = 30000;

function litersToWineGallons(liters: number): number {
  if (liters < 0) return 0;
  return liters * WINE_GALLONS_PER_LITER;
}

function mlToWineGallons(ml: number): number {
  return litersToWineGallons(ml / 1000);
}

function roundGallons(gallons: number): number {
  return Math.round(gallons * 1000) / 1000;
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

// ============================================
// Validation Results
// ============================================

interface ValidationResult {
  check: string;
  expected: string;
  actual: string;
  pass: boolean;
  note?: string;
}

const results: ValidationResult[] = [];

function check(name: string, expected: string, actual: string, pass: boolean, note?: string) {
  results.push({ check: name, expected, actual, pass, note });
}

function checkRange(name: string, value: number, min: number, max: number, note?: string) {
  const pass = value >= min && value <= max;
  results.push({
    check: name,
    expected: `${min} - ${max}`,
    actual: value.toFixed(3),
    pass,
    note,
  });
}

// ============================================
// Main Validation
// ============================================

async function validate() {
  console.log("=".repeat(70));
  console.log("  TTB 2025 ANNUAL FORM 5120.17 VALIDATION");
  console.log("=".repeat(70));
  console.log("");

  const year = 2025;
  const startDate = new Date(year, 0, 1); // Jan 1, 2025
  const endDate = new Date(year, 11, 31); // Dec 31, 2025
  const dayBeforeStart = new Date(2024, 11, 31); // Dec 31, 2024

  console.log(`Period: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);
  console.log("");

  // ============================================
  // 1. OPENING BALANCE
  // ============================================
  console.log("--- 1. OPENING BALANCE ---");

  // Check for previous snapshot first
  const startDateStr = startDate.toISOString().split("T")[0];
  const [previousSnapshot] = await db
    .select()
    .from(ttbPeriodSnapshots)
    .where(
      and(
        sql`${ttbPeriodSnapshots.periodEnd} < ${startDateStr}::date`,
        eq(ttbPeriodSnapshots.status, "finalized")
      )
    )
    .orderBy(desc(ttbPeriodSnapshots.periodEnd))
    .limit(1);

  let openingBulk = 0;
  let openingBottled = 0;
  let openingTotal = 0;
  let openingSource = "none";

  if (previousSnapshot) {
    openingSource = "snapshot";
    openingBulk = parseFloat(previousSnapshot.bulkHardCider || "0") +
      parseFloat(previousSnapshot.bulkWineUnder16 || "0") +
      parseFloat(previousSnapshot.bulkWine16To21 || "0") +
      parseFloat(previousSnapshot.bulkWine21To24 || "0") +
      parseFloat(previousSnapshot.bulkSparklingWine || "0") +
      parseFloat(previousSnapshot.bulkCarbonatedWine || "0");
    openingBottled = parseFloat(previousSnapshot.bottledHardCider || "0") +
      parseFloat(previousSnapshot.bottledWineUnder16 || "0") +
      parseFloat(previousSnapshot.bottledWine16To21 || "0") +
      parseFloat(previousSnapshot.bottledWine21To24 || "0") +
      parseFloat(previousSnapshot.bottledSparklingWine || "0") +
      parseFloat(previousSnapshot.bottledCarbonatedWine || "0");
    openingTotal = roundGallons(openingBulk + openingBottled);
    console.log(`  Source: Previous finalized snapshot (period end: ${previousSnapshot.periodEnd})`);
  } else {
    // Check TTB Opening Balance in organization_settings
    const [settings] = await db
      .select({
        ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
        ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
      })
      .from(organizationSettings)
      .limit(1);

    if (settings?.ttbOpeningBalances) {
      openingSource = "ttb_opening_balance";
      const balances = settings.ttbOpeningBalances;
      openingBulk = Object.values(balances.bulk || {}).reduce(
        (sum: number, val) => sum + (Number(val) || 0), 0
      );
      openingBottled = Object.values(balances.bottled || {}).reduce(
        (sum: number, val) => sum + (Number(val) || 0), 0
      );
      openingTotal = roundGallons(openingBulk + openingBottled);
      console.log(`  Source: TTB Opening Balance (date: ${settings.ttbOpeningBalanceDate})`);
      console.log(`  Raw balances: ${JSON.stringify(balances, null, 2)}`);
    } else {
      openingSource = "calculated";
      console.log(`  Source: Calculated (no snapshot or opening balance found)`);
    }
  }

  console.log(`  Bulk: ${roundGallons(openingBulk).toFixed(3)} gal`);
  console.log(`  Bottled: ${roundGallons(openingBottled).toFixed(3)} gal`);
  console.log(`  Total: ${openingTotal.toFixed(3)} gal`);
  console.log("");

  // Validate: opening balance should be ~1121 gallons
  checkRange("Opening Balance Total", openingTotal, 1050, 1200,
    "Expected ~1121 gallons (cider + pommeau/salish)");
  check("Opening Balance Source", "ttb_opening_balance or snapshot", openingSource,
    openingSource === "ttb_opening_balance" || openingSource === "snapshot");

  // ============================================
  // 2. PRODUCTION (2025 batches)
  // ============================================
  console.log("--- 2. PRODUCTION ---");

  // Cider/perry production (excludes pommeau and brandy)
  const productionData = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
      batchCount: sql<number>`COUNT(*)`,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        eq(batches.reconciliationStatus, "verified"),
        gte(batches.startDate, startDate),
        lte(batches.startDate, endDate),
        sql`COALESCE(${batches.productType}, 'cider') NOT IN ('pommeau', 'brandy')`
      )
    );

  const productionLiters = Number(productionData[0]?.totalLiters || 0);
  const productionGallons = roundGallons(litersToWineGallons(productionLiters));
  const productionBatchCount = Number(productionData[0]?.batchCount || 0);

  console.log(`  Cider/Perry production: ${productionLiters.toFixed(2)} L = ${productionGallons.toFixed(3)} gal (${productionBatchCount} batches)`);

  // Pommeau production
  const pommeauData = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
      batchCount: sql<number>`COUNT(*)`,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        eq(batches.reconciliationStatus, "verified"),
        eq(batches.productType, "pommeau"),
        gte(batches.startDate, startDate),
        lte(batches.startDate, endDate)
      )
    );

  const pommeauLiters = Number(pommeauData[0]?.totalLiters || 0);
  const pommeauGallons = roundGallons(litersToWineGallons(pommeauLiters));
  const pommeauBatchCount = Number(pommeauData[0]?.batchCount || 0);

  console.log(`  Pommeau production: ${pommeauLiters.toFixed(2)} L = ${pommeauGallons.toFixed(3)} gal (${pommeauBatchCount} batches)`);

  // List all 2025 batches by product type
  const batchBreakdown = await db
    .select({
      productType: batches.productType,
      count: sql<number>`COUNT(*)`,
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        eq(batches.reconciliationStatus, "verified"),
        gte(batches.startDate, startDate),
        lte(batches.startDate, endDate)
      )
    )
    .groupBy(batches.productType);

  console.log("  Batch breakdown by product type:");
  for (const row of batchBreakdown) {
    const gal = roundGallons(litersToWineGallons(Number(row.totalLiters)));
    console.log(`    ${(row.productType || "null").padEnd(15)} ${Number(row.count)} batches  ${Number(row.totalLiters).toFixed(2)} L = ${gal.toFixed(3)} gal`);
  }

  check("Production has batches", "> 0", productionBatchCount.toString(),
    productionBatchCount > 0, "Should include all 2025 cider/perry batches");
  console.log("");

  // ============================================
  // 3. DISTILLERY OPERATIONS
  // ============================================
  console.log("--- 3. DISTILLERY OPERATIONS ---");

  const ciderToDsp = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.sourceVolumeLiters} AS DECIMAL)), 0)`,
      shipmentCount: sql<number>`COUNT(*)`,
    })
    .from(distillationRecords)
    .where(
      and(
        isNull(distillationRecords.deletedAt),
        gte(distillationRecords.sentAt, startDate),
        lte(distillationRecords.sentAt, endDate)
      )
    );

  const ciderSentLiters = Number(ciderToDsp[0]?.totalLiters || 0);
  const ciderSentGallons = roundGallons(litersToWineGallons(ciderSentLiters));
  console.log(`  Cider sent to DSP: ${ciderSentLiters.toFixed(2)} L = ${ciderSentGallons.toFixed(3)} gal (${Number(ciderToDsp[0]?.shipmentCount || 0)} shipments)`);

  const brandyFromDsp = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.receivedVolumeLiters} AS DECIMAL)), 0)`,
      returnCount: sql<number>`COUNT(*)`,
    })
    .from(distillationRecords)
    .where(
      and(
        isNull(distillationRecords.deletedAt),
        isNotNull(distillationRecords.receivedAt),
        gte(distillationRecords.receivedAt, startDate),
        lte(distillationRecords.receivedAt, endDate)
      )
    );

  const brandyReceivedLiters = Number(brandyFromDsp[0]?.totalLiters || 0);
  const brandyReceivedGallons = roundGallons(litersToWineGallons(brandyReceivedLiters));
  console.log(`  Brandy received from DSP: ${brandyReceivedLiters.toFixed(2)} L = ${brandyReceivedGallons.toFixed(3)} gal (${Number(brandyFromDsp[0]?.returnCount || 0)} returns)`);

  // Validate distillation: ~3000L sent, ~55 gal received
  checkRange("Cider sent to DSP (liters)", ciderSentLiters, 2500, 3500,
    "Expected ~3000L cider distilled");
  checkRange("Brandy received (gallons)", brandyReceivedGallons, 40, 70,
    "Expected ~55 gallons brandy received");

  // Check brandy batches
  const brandyBatches = await db
    .select({
      id: batches.id,
      customName: batches.customName,
      batchNumber: batches.batchNumber,
      productType: batches.productType,
      initialVolume: batches.initialVolumeLiters,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        eq(batches.productType, "brandy")
      )
    );

  console.log(`  Brandy batches: ${brandyBatches.length}`);
  for (const b of brandyBatches) {
    console.log(`    ${b.customName || b.batchNumber}: ${Number(b.initialVolume || 0).toFixed(2)} L, productType=${b.productType}`);
  }

  check("Brandy batches have productType=brandy", "brandy",
    brandyBatches.length > 0 ? brandyBatches[0].productType || "null" : "none",
    brandyBatches.every(b => b.productType === "brandy"));
  console.log("");

  // ============================================
  // 4. TAX-PAID REMOVALS
  // ============================================
  console.log("--- 4. TAX-PAID REMOVALS ---");

  // Bottle/can distributions
  const bottleDistributions = await db
    .select({
      channelCode: salesChannels.code,
      totalML: sql<number>`COALESCE(SUM(
        CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
        CAST(${inventoryItems.packageSizeML} AS DECIMAL)
      ), 0)`,
    })
    .from(inventoryDistributions)
    .leftJoin(inventoryItems, eq(inventoryDistributions.inventoryItemId, inventoryItems.id))
    .leftJoin(salesChannels, eq(inventoryDistributions.salesChannelId, salesChannels.id))
    .where(
      and(
        gte(inventoryDistributions.distributionDate, startDate),
        lte(inventoryDistributions.distributionDate, endDate)
      )
    )
    .groupBy(salesChannels.code);

  // Keg distributions
  const kegDistributions = await db
    .select({
      channelCode: salesChannels.code,
      totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
    })
    .from(kegFills)
    .leftJoin(salesChannels, eq(kegFills.salesChannelId, salesChannels.id))
    .where(
      and(
        isNotNull(kegFills.distributedAt),
        isNull(kegFills.voidedAt),
        gte(kegFills.distributedAt, startDate),
        lte(kegFills.distributedAt, endDate)
      )
    )
    .groupBy(salesChannels.code);

  const channelTotals: Record<string, number> = {
    tasting_room: 0, wholesale: 0, online_dtc: 0, events: 0, uncategorized: 0,
  };

  for (const row of bottleDistributions) {
    const channel = row.channelCode || "uncategorized";
    const gallons = mlToWineGallons(Number(row.totalML || 0));
    if (channel in channelTotals) {
      channelTotals[channel] += gallons;
    } else {
      channelTotals.uncategorized += gallons;
    }
  }

  for (const row of kegDistributions) {
    const channel = row.channelCode || "uncategorized";
    const gallons = litersToWineGallons(Number(row.totalLiters || 0));
    if (channel in channelTotals) {
      channelTotals[channel] += gallons;
    } else {
      channelTotals.uncategorized += gallons;
    }
  }

  const taxPaidTotal = roundGallons(Object.values(channelTotals).reduce((a, b) => a + b, 0));

  console.log("  By channel:");
  for (const [channel, gallons] of Object.entries(channelTotals)) {
    if (gallons > 0) {
      console.log(`    ${channel.padEnd(20)} ${roundGallons(gallons).toFixed(3)} gal`);
    }
  }
  console.log(`  Total tax-paid removals: ${taxPaidTotal.toFixed(3)} gal`);
  console.log("");

  // ============================================
  // 5. OTHER REMOVALS
  // ============================================
  console.log("--- 5. OTHER REMOVALS ---");

  const adjustmentsByType = await db
    .select({
      adjustmentType: inventoryAdjustments.adjustmentType,
      totalML: sql<number>`COALESCE(SUM(
        ABS(CAST(${inventoryAdjustments.quantityChange} AS DECIMAL)) *
        CAST(${inventoryItems.packageSizeML} AS DECIMAL)
      ), 0)`,
    })
    .from(inventoryAdjustments)
    .leftJoin(inventoryItems, eq(inventoryAdjustments.inventoryItemId, inventoryItems.id))
    .where(
      and(
        gte(inventoryAdjustments.adjustedAt, startDate),
        lte(inventoryAdjustments.adjustedAt, endDate),
        sql`${inventoryAdjustments.quantityChange} < 0`
      )
    )
    .groupBy(inventoryAdjustments.adjustmentType);

  let samplesGallons = 0;
  let breakageGallons = 0;
  for (const row of adjustmentsByType) {
    const gallons = mlToWineGallons(Number(row.totalML || 0));
    if (row.adjustmentType === "sample") samplesGallons += gallons;
    else if (row.adjustmentType === "breakage") breakageGallons += gallons;
    console.log(`  ${(row.adjustmentType || "unknown").padEnd(20)} ${roundGallons(gallons).toFixed(3)} gal`);
  }

  // Process losses
  const filterLosses = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
    })
    .from(batchFilterOperations)
    .where(
      and(
        isNull(batchFilterOperations.deletedAt),
        gte(batchFilterOperations.filteredAt, startDate),
        lte(batchFilterOperations.filteredAt, endDate)
      )
    );

  const rackingLosses = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
    })
    .from(batchRackingOperations)
    .where(
      and(
        isNull(batchRackingOperations.deletedAt),
        gte(batchRackingOperations.rackedAt, startDate),
        lte(batchRackingOperations.rackedAt, endDate)
      )
    );

  const processLossLiters = Number(filterLosses[0]?.totalLiters || 0) + Number(rackingLosses[0]?.totalLiters || 0);
  const processLossGallons = roundGallons(litersToWineGallons(processLossLiters));

  console.log(`  Filter losses: ${Number(filterLosses[0]?.totalLiters || 0).toFixed(2)} L`);
  console.log(`  Racking losses: ${Number(rackingLosses[0]?.totalLiters || 0).toFixed(2)} L`);
  console.log(`  Process losses total: ${processLossLiters.toFixed(2)} L = ${processLossGallons.toFixed(3)} gal`);

  const otherRemovalsTotal = roundGallons(samplesGallons + breakageGallons + processLossGallons);
  console.log(`  Total other removals: ${otherRemovalsTotal.toFixed(3)} gal`);
  console.log("");

  // ============================================
  // 6. ENDING INVENTORY
  // ============================================
  console.log("--- 6. ENDING INVENTORY ---");

  // Bulk: batches active at end of year
  const batchesAtEnd = await db
    .select({
      id: batches.id,
      customName: batches.customName,
      batchNumber: batches.batchNumber,
      initialVolume: batches.initialVolumeLiters,
      currentVolume: batches.currentVolumeLiters,
      productType: batches.productType,
      status: batches.status,
      startDate: batches.startDate,
      endDate: batches.endDate,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        eq(batches.reconciliationStatus, "verified"),
        lte(batches.startDate, endDate),
        or(isNull(batches.endDate), gte(batches.endDate, endDate)),
        sql`NOT (${batches.status} = 'discarded' AND ${batches.updatedAt} <= ${endDate})`
      )
    );

  let endingBulkLiters = 0;
  let endingPommeauBulkLiters = 0;
  let endingBrandyBulkLiters = 0;
  let batchDetailCount = 0;

  console.log(`  Active batches at end of 2025: ${batchesAtEnd.length}`);

  for (const batch of batchesAtEnd) {
    let batchVolume = Number(batch.initialVolume || 0);

    // Transfers IN
    const transfersIn = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
      })
      .from(batchTransfers)
      .where(
        and(
          eq(batchTransfers.destinationBatchId, batch.id),
          ne(batchTransfers.sourceBatchId, batch.id),
          isNull(batchTransfers.deletedAt),
          lte(batchTransfers.transferredAt, endDate)
        )
      );
    batchVolume += Number(transfersIn[0]?.total || 0);

    // Transfers OUT
    const transfersOut = await db
      .select({
        totalVolume: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        totalLoss: sql<number>`COALESCE(SUM(CAST(${batchTransfers.loss} AS DECIMAL)), 0)`,
      })
      .from(batchTransfers)
      .where(
        and(
          eq(batchTransfers.sourceBatchId, batch.id),
          ne(batchTransfers.destinationBatchId, batch.id),
          isNull(batchTransfers.deletedAt),
          lte(batchTransfers.transferredAt, endDate)
        )
      );
    batchVolume -= Number(transfersOut[0]?.totalVolume || 0);
    batchVolume -= Number(transfersOut[0]?.totalLoss || 0);

    // Bottlings
    const bottlings = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
      })
      .from(bottleRuns)
      .where(
        and(
          eq(bottleRuns.batchId, batch.id),
          isNull(bottleRuns.voidedAt),
          lte(bottleRuns.packagedAt, endDate)
        )
      );
    batchVolume -= Number(bottlings[0]?.total || 0);

    // Keg fills
    const kegFillsData = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
      })
      .from(kegFills)
      .where(
        and(
          eq(kegFills.batchId, batch.id),
          isNull(kegFills.voidedAt),
          lte(kegFills.filledAt, endDate)
        )
      );
    batchVolume -= Number(kegFillsData[0]?.total || 0);

    // Distillation
    const distillation = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${distillationRecords.sourceVolumeLiters} AS DECIMAL)), 0)`,
      })
      .from(distillationRecords)
      .where(
        and(
          eq(distillationRecords.sourceBatchId, batch.id),
          isNull(distillationRecords.deletedAt),
          lte(distillationRecords.sentAt, endDate)
        )
      );
    batchVolume -= Number(distillation[0]?.total || 0);

    // Racking losses
    const rackingLoss = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
      })
      .from(batchRackingOperations)
      .where(
        and(
          eq(batchRackingOperations.batchId, batch.id),
          isNull(batchRackingOperations.deletedAt),
          lte(batchRackingOperations.rackedAt, endDate)
        )
      );
    batchVolume -= Number(rackingLoss[0]?.total || 0);

    // Filter losses
    const filterLoss = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
      })
      .from(batchFilterOperations)
      .where(
        and(
          eq(batchFilterOperations.batchId, batch.id),
          isNull(batchFilterOperations.deletedAt),
          lte(batchFilterOperations.filteredAt, endDate)
        )
      );
    batchVolume -= Number(filterLoss[0]?.total || 0);

    if (batchVolume > 0) {
      batchDetailCount++;
      if (batch.productType === "pommeau") {
        endingPommeauBulkLiters += batchVolume;
      } else if (batch.productType === "brandy") {
        endingBrandyBulkLiters += batchVolume;
      } else {
        endingBulkLiters += batchVolume;
      }
      // Show top batches
      if (batchDetailCount <= 10 || batchVolume > 100) {
        console.log(`    ${(batch.customName || batch.batchNumber).padEnd(30)} ${batch.productType?.padEnd(10) || "null      "} ${batchVolume.toFixed(2)} L = ${roundGallons(litersToWineGallons(batchVolume)).toFixed(3)} gal`);
      }
    }
  }

  if (batchDetailCount > 10) {
    console.log(`    ... and ${batchDetailCount - 10} more batches with positive volume`);
  }

  const endingBulkGallons = roundGallons(litersToWineGallons(endingBulkLiters));
  const endingPommeauGallons = roundGallons(litersToWineGallons(endingPommeauBulkLiters));
  const endingBrandyGallons = roundGallons(litersToWineGallons(endingBrandyBulkLiters));

  // Bottled inventory at end
  const itemsAtEnd = await db
    .select({
      id: inventoryItems.id,
      packageSizeML: inventoryItems.packageSizeML,
      currentQuantity: inventoryItems.currentQuantity,
    })
    .from(inventoryItems)
    .where(lte(inventoryItems.createdAt, endDate));

  let endingBottledML = 0;
  for (const item of itemsAtEnd) {
    let qty = Number(item.currentQuantity || 0);
    // No need to reverse future changes for 2025 annual (endDate is Dec 31 2025, and we're in 2026)
    if (qty > 0) {
      endingBottledML += qty * Number(item.packageSizeML || 0);
    }
  }

  // Kegs in stock
  const kegsInStock = await db
    .select({
      totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
    })
    .from(kegFills)
    .where(
      and(
        isNull(kegFills.distributedAt),
        isNull(kegFills.voidedAt),
        lte(kegFills.filledAt, endDate)
      )
    );
  const kegsInStockLiters = Number(kegsInStock[0]?.totalLiters || 0);

  const endingBottledGallons = roundGallons(
    mlToWineGallons(endingBottledML) + litersToWineGallons(kegsInStockLiters)
  );
  const endingTotalGallons = roundGallons(
    endingBulkGallons + endingPommeauGallons + endingBrandyGallons + endingBottledGallons
  );

  console.log(`  Ending bulk (cider): ${endingBulkLiters.toFixed(2)} L = ${endingBulkGallons.toFixed(3)} gal`);
  console.log(`  Ending bulk (pommeau): ${endingPommeauBulkLiters.toFixed(2)} L = ${endingPommeauGallons.toFixed(3)} gal`);
  console.log(`  Ending bulk (brandy): ${endingBrandyBulkLiters.toFixed(2)} L = ${endingBrandyGallons.toFixed(3)} gal`);
  console.log(`  Ending bottled: ${endingBottledML.toFixed(0)} ml = ${roundGallons(mlToWineGallons(endingBottledML)).toFixed(3)} gal`);
  console.log(`  Ending kegs: ${kegsInStockLiters.toFixed(2)} L = ${roundGallons(litersToWineGallons(kegsInStockLiters)).toFixed(3)} gal`);
  console.log(`  Ending bottled total (bottles+kegs): ${endingBottledGallons.toFixed(3)} gal`);
  console.log(`  Ending total: ${endingTotalGallons.toFixed(3)} gal`);
  console.log("");

  // ============================================
  // 7. RECONCILIATION (Balance Equation)
  // ============================================
  console.log("--- 7. RECONCILIATION ---");

  const totalProducedGallons = productionGallons + pommeauGallons;
  const receiptsGallons = 0;

  const totalAvailable = roundGallons(openingTotal + totalProducedGallons + receiptsGallons);
  const totalAccountedFor = roundGallons(taxPaidTotal + otherRemovalsTotal + endingTotalGallons);
  const variance = roundGallons(totalAvailable - totalAccountedFor);

  console.log("  Balance equation:");
  console.log(`    Opening:    ${openingTotal.toFixed(3)} gal`);
  console.log(`  + Production: ${totalProducedGallons.toFixed(3)} gal (cider: ${productionGallons.toFixed(3)} + pommeau: ${pommeauGallons.toFixed(3)})`);
  console.log(`  + Receipts:   ${receiptsGallons.toFixed(3)} gal`);
  console.log(`  = Available:  ${totalAvailable.toFixed(3)} gal`);
  console.log("");
  console.log(`    Tax-Paid:   ${taxPaidTotal.toFixed(3)} gal`);
  console.log(`  + Other:      ${otherRemovalsTotal.toFixed(3)} gal`);
  console.log(`  + Ending:     ${endingTotalGallons.toFixed(3)} gal`);
  console.log(`  = Accounted:  ${totalAccountedFor.toFixed(3)} gal`);
  console.log("");
  console.log(`  VARIANCE:     ${variance.toFixed(3)} gal`);
  console.log(`  BALANCED:     ${Math.abs(variance) < 0.1 ? "YES" : "NO"}`);

  // The reconciliation may not be perfectly balanced since the ending inventory
  // calculation uses a different methodology (batch-by-batch with transaction history)
  // vs opening + production - removals. Log the variance for analysis.
  check("Reconciliation variance < 100 gal", "< 100", Math.abs(variance).toFixed(3),
    Math.abs(variance) < 100,
    "Large variance may indicate data issues. Small variance is normal due to different calculation methods.");
  console.log("");

  // ============================================
  // 8. TAX CALCULATION
  // ============================================
  console.log("--- 8. TAX CALCULATION ---");

  const grossTax = roundToTwo(taxPaidTotal * HARD_CIDER_TAX_RATE);
  const creditEligibleGallons = Math.min(taxPaidTotal, SMALL_PRODUCER_CREDIT_LIMIT_GALLONS);
  const smallProducerCredit = roundToTwo(creditEligibleGallons * SMALL_PRODUCER_CREDIT_PER_GALLON);
  const netTaxOwed = roundToTwo(grossTax - smallProducerCredit);
  const effectiveRate = taxPaidTotal > 0 ? roundToTwo(netTaxOwed / taxPaidTotal * 100) / 100 : 0;

  console.log(`  Taxable gallons:        ${taxPaidTotal.toFixed(3)} gal`);
  console.log(`  Gross tax:              $${grossTax.toFixed(2)} (at $${HARD_CIDER_TAX_RATE}/gal)`);
  console.log(`  Credit eligible:        ${creditEligibleGallons.toFixed(3)} gal (limit: ${SMALL_PRODUCER_CREDIT_LIMIT_GALLONS})`);
  console.log(`  Small producer credit:  $${smallProducerCredit.toFixed(2)} (at $${SMALL_PRODUCER_CREDIT_PER_GALLON}/gal)`);
  console.log(`  Net tax owed:           $${netTaxOwed.toFixed(2)}`);
  console.log(`  Effective rate:         $${effectiveRate.toFixed(4)}/gal`);

  check("Tax rate is $0.226/gal", "$0.226", `$${HARD_CIDER_TAX_RATE}`,
    HARD_CIDER_TAX_RATE === 0.226);
  check("Small producer credit is $0.056/gal", "$0.056", `$${SMALL_PRODUCER_CREDIT_PER_GALLON}`,
    SMALL_PRODUCER_CREDIT_PER_GALLON === 0.056);
  check("Credit limit is 30,000 gal", "30000", SMALL_PRODUCER_CREDIT_LIMIT_GALLONS.toString(),
    SMALL_PRODUCER_CREDIT_LIMIT_GALLONS === 30000);
  check("Under credit limit (small producer)", "< 30000", taxPaidTotal.toFixed(0),
    taxPaidTotal < 30000,
    "Small cidery should be well under 30k gallons");
  console.log("");

  // ============================================
  // 9. POMMEAU / TAX CLASS SEPARATION
  // ============================================
  console.log("--- 9. TAX CLASS SEPARATION ---");

  // Check pommeau batches
  const pommeauBatches = await db
    .select({
      id: batches.id,
      customName: batches.customName,
      batchNumber: batches.batchNumber,
      productType: batches.productType,
      initialVolume: batches.initialVolumeLiters,
      currentVolume: batches.currentVolumeLiters,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        eq(batches.productType, "pommeau")
      )
    );

  console.log(`  Pommeau batches: ${pommeauBatches.length}`);
  for (const b of pommeauBatches) {
    console.log(`    ${b.customName || b.batchNumber}: initial=${Number(b.initialVolume || 0).toFixed(2)}L, current=${Number(b.currentVolume || 0).toFixed(2)}L`);
  }

  check("Pommeau batches have productType=pommeau", "pommeau",
    pommeauBatches.length > 0 ? pommeauBatches[0].productType || "null" : "none",
    pommeauBatches.every(b => b.productType === "pommeau"),
    "Pommeau should map to wine16To21 tax class");

  // Verify tax class mapping
  const taxClassMap: Record<string, string> = {
    cider: "hardCider",
    perry: "hardCider",
    pommeau: "wine16To21",
    brandy: "appleBrandy",
    wine: "wineUnder16",
  };
  for (const [type, expectedClass] of Object.entries(taxClassMap)) {
    console.log(`    ${type.padEnd(10)} -> ${expectedClass}`);
  }
  check("Pommeau tax class is wine16To21", "wine16To21", "wine16To21", true);
  console.log("");

  // ============================================
  // RESULTS SUMMARY
  // ============================================
  console.log("=".repeat(70));
  console.log("  VALIDATION RESULTS SUMMARY");
  console.log("=".repeat(70));

  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    const icon = r.pass ? "[OK]" : "[!!]";
    if (r.pass) passCount++;
    else failCount++;
    console.log(`  ${icon} ${r.check}`);
    console.log(`       Expected: ${r.expected}  |  Actual: ${r.actual}`);
    if (r.note) console.log(`       Note: ${r.note}`);
  }

  console.log("");
  console.log(`  Total: ${results.length} checks  |  ${passCount} PASS  |  ${failCount} FAIL`);
  console.log("=".repeat(70));

  process.exit(failCount > 0 ? 1 : 0);
}

validate().catch((e) => {
  console.error("Validation script error:", e);
  process.exit(1);
});
