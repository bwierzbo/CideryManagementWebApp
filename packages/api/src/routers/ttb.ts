/**
 * TTB Reporting Router
 *
 * API endpoints for generating TTB Form 5120.17 data
 * and managing report snapshots.
 */

import { z } from "zod";
import { router, protectedProcedure, createRbacProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  db,
  batches,
  vessels,
  inventoryItems,
  inventoryDistributions,
  inventoryAdjustments,
  kegFills,
  salesChannels,
  ttbReportingPeriods,
  ttbPeriodSnapshots,
  ttbReconciliationSnapshots,
  organizationSettings,
  batchFilterOperations,
  batchRackingOperations,
  bottleRuns,
  batchTransfers,
  distillationRecords,
  batchVolumeAdjustments,
  users,
  basefruitPurchases,
  basefruitPurchaseItems,
  baseFruitVarieties,
  pressRunLoads,
  pressRuns,
  additivePurchases,
  additivePurchaseItems,
  additiveVarieties,
  juicePurchases,
  juicePurchaseItems,
  physicalInventoryCounts,
  reconciliationAdjustments,
  batchCarbonationOperations,
  batchMergeHistory,
  ttbWaterfallAdjustments,
  type TTBOpeningBalances,
} from "db";
import {
  eq,
  and,
  gte,
  lte,
  lt,
  isNull,
  isNotNull,
  sql,
  desc,
  asc,
  or,
  like,
} from "drizzle-orm";
import {
  litersToWineGallons,
  wineGallonsToLiters,
  mlToWineGallons,
  calculateHardCiderTax,
  roundGallons,
  getPeriodDateRange,
  formatPeriodLabel,
  productTypeToTaxClass,
  classifyBatchTaxClass,
  type TTBClassificationConfig,
  type TTBTaxClass,
  DEFAULT_TTB_CLASSIFICATION_CONFIG,
  WINE_GALLONS_PER_LITER,
  LITERS_PER_WINE_GALLON,
  type TTBForm512017Data,
  type InventoryBreakdown,
  type TaxPaidRemovals,
  type OtherRemovals,
  type BulkWinesSection,
  type BottledWinesSection,
  type MaterialsSection,
  type FermentersSection,
  type DistilleryOperations,
  type BrandyTransfer,
  type CiderBrandyInventory,
  type CiderBrandyReconciliation,
} from "lib";

// ============================================
// Batch Classification Map Builder
// ============================================

/**
 * Build a map of batchId → TTBTaxClass using dynamic classification
 * (ABV, CO2, fruit source, carbonation method) instead of productType alone.
 *
 * Fetches the classification config from org settings, then queries all
 * relevant batch data (ABV, carbonation) to classify each batch.
 */
async function buildBatchTaxClassMap(): Promise<{
  map: Map<string, TTBTaxClass | null>;
  config: TTBClassificationConfig;
}> {
  // Fetch classification config
  const [orgSettings] = await db
    .select({ ttbClassificationConfig: organizationSettings.ttbClassificationConfig })
    .from(organizationSettings)
    .limit(1);
  const config = (orgSettings?.ttbClassificationConfig as TTBClassificationConfig | null) ?? DEFAULT_TTB_CLASSIFICATION_CONFIG;

  // Fetch all non-deleted batches with their ABV data and parent info
  const allBatches = await db
    .select({
      id: batches.id,
      productType: batches.productType,
      actualAbv: batches.actualAbv,
      estimatedAbv: batches.estimatedAbv,
      parentBatchId: batches.parentBatchId,
      isRackingDerivative: batches.isRackingDerivative,
    })
    .from(batches)
    .where(isNull(batches.deletedAt));

  // Fetch most recent completed carbonation operation per batch
  const carbonationData = await db.execute(sql`
    SELECT DISTINCT ON (batch_id)
      batch_id,
      CAST(final_co2_volumes AS TEXT) as final_co2_volumes,
      carbonation_process
    FROM batch_carbonation_operations
    WHERE deleted_at IS NULL
      AND final_co2_volumes IS NOT NULL
    ORDER BY batch_id, completed_at DESC NULLS LAST, created_at DESC
  `);

  const carbonationMap = new Map<string, { co2Volumes: number; process: string }>();
  for (const row of carbonationData.rows as any[]) {
    carbonationMap.set(row.batch_id, {
      co2Volumes: parseFloat(row.final_co2_volumes || "0"),
      process: row.carbonation_process || "",
    });
  }

  // Build a lookup for batch ABV (needed for parent ABV inheritance)
  // For all batches: prefer actual_abv over estimated_abv
  const batchActualAbv = new Map<string, number | null>();
  const batchEstimatedAbv = new Map<string, number | null>();
  for (const b of allBatches) {
    batchActualAbv.set(b.id, (b.actualAbv && parseFloat(String(b.actualAbv)) > 0)
      ? parseFloat(String(b.actualAbv)) : null);
    batchEstimatedAbv.set(b.id, (b.estimatedAbv && parseFloat(String(b.estimatedAbv)) > 0)
      ? parseFloat(String(b.estimatedAbv)) : null);
  }

  // Helper: get the best ABV for a batch.
  // For racking derivatives: use own actual_abv, or inherit from parent chain.
  // Racking derivatives often have wrong estimated_abv (e.g., pre-fortification SG-based
  // value of 4.59% for a pommeau that's actually 18% ABV). The parent's actual_abv is
  // the authoritative measurement.
  function getBestAbv(b: typeof allBatches[0]): number | null {
    // Own actual_abv is always authoritative
    const ownActual = batchActualAbv.get(b.id);
    if (ownActual != null) return ownActual;

    // For racking derivatives, inherit from parent chain instead of using
    // own estimated_abv (which may be wrong for fortified/blended products)
    if (b.isRackingDerivative && b.parentBatchId) {
      const visited = new Set<string>();
      let currentId: string | null = b.parentBatchId;
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const parentActual = batchActualAbv.get(currentId);
        if (parentActual != null) return parentActual;
        const parent = allBatches.find(p => p.id === currentId);
        currentId = parent?.parentBatchId ?? null;
      }
    }

    // Fall back to own estimated_abv
    return batchEstimatedAbv.get(b.id) ?? null;
  }

  // Build the classification map
  const map = new Map<string, TTBTaxClass | null>();
  for (const b of allBatches) {
    const carb = carbonationMap.get(b.id);
    const abv = getBestAbv(b);
    const taxClass = classifyBatchTaxClass({
      productType: b.productType,
      abv,
      co2Volumes: carb?.co2Volumes ?? null,
      carbonationMethod: carb?.process ?? null,
    }, config);
    map.set(b.id, taxClass);
  }

  return { map, config };
}

/**
 * Get tax class for a batch from the pre-built map, falling back to productType-based classification.
 */
function getTaxClassFromMap(
  map: Map<string, TTBTaxClass | null>,
  batchId: string | null | undefined,
  productType: string | null | undefined,
): TTBTaxClass | null {
  if (batchId && map.has(batchId)) {
    return map.get(batchId)!;
  }
  return productTypeToTaxClass(productType);
}

// Input schemas
const generateForm512017Input = z.object({
  periodType: z.enum(["monthly", "quarterly", "annual"]),
  year: z.number().int().min(2020).max(2100),
  periodNumber: z.number().int().min(1).max(12).optional(),
});

const saveReportSnapshotInput = z.object({
  periodType: z.enum(["monthly", "quarterly", "annual"]),
  periodStart: z.string().transform((s) => new Date(s)),
  periodEnd: z.string().transform((s) => new Date(s)),
  data: z.object({
    beginningInventoryBulkGallons: z.number().optional(),
    beginningInventoryBottledGallons: z.number().optional(),
    beginningInventoryTotalGallons: z.number().optional(),
    wineProducedGallons: z.number().optional(),
    taxPaidTastingRoomGallons: z.number().optional(),
    taxPaidWholesaleGallons: z.number().optional(),
    taxPaidOnlineDtcGallons: z.number().optional(),
    taxPaidEventsGallons: z.number().optional(),
    taxPaidRemovalsTotalGallons: z.number().optional(),
    otherRemovalsSamplesGallons: z.number().optional(),
    otherRemovalsBreakageGallons: z.number().optional(),
    otherRemovalsLossesGallons: z.number().optional(),
    otherRemovalsTotalGallons: z.number().optional(),
    endingInventoryBulkGallons: z.number().optional(),
    endingInventoryBottledGallons: z.number().optional(),
    endingInventoryTotalGallons: z.number().optional(),
    taxableGallons: z.number().optional(),
    taxRate: z.number().optional(),
    smallProducerCreditGallons: z.number().optional(),
    smallProducerCreditAmount: z.number().optional(),
    taxOwed: z.number().optional(),
  }),
  notes: z.string().optional(),
});

/** Breakdown of system-side volume categories (in liters) for variance analysis */
interface SystemVolumeBreakdown {
  totalLiters: number;
  initialVolumeLiters: number;    // Sum of effectiveInitial for all batches
  mergesInLiters: number;         // Juice merges (press runs, purchases added post-creation)
  mergesOutLiters: number;        // Volume sent out during merges (source batch side)
  transfersInLiters: number;      // Volume received from other batches
  transfersOutLiters: number;     // Volume sent to other batches
  transferLossLiters: number;     // Loss during transfers
  bottlingLiters: number;         // Volume taken for bottling
  bottlingLossLiters: number;     // Loss during bottling
  keggingLiters: number;          // Volume taken for kegging
  keggingLossLiters: number;      // Loss during kegging
  distillationLiters: number;     // Volume sent to distillery
  adjustmentsLiters: number;      // Net volume adjustments (positive = gain, negative = loss)
  positiveAdjLiters: number;      // Positive volume adjustments (gains)
  negativeAdjLiters: number;      // Negative volume adjustments (losses, absolute value)
  rackingLossLiters: number;      // Loss during racking
  filterLossLiters: number;       // Loss during filtering
  clampedLossLiters: number;      // Diagnostic: total volume from batches with negative SBD endings
  batchCount: number;             // Number of batches included
}

/**
 * Compute the sum of batch-level volumes at a specific date (point-in-time).
 * Uses date-bounded activity queries to reconstruct what each batch's volume
 * would have been at `asOfDate`. Returns total in wine gallons and a detailed breakdown.
 */
async function computeSystemCalculatedOnHand(
  verifiedBatchIds: string[],
  asOfDate: string,
): Promise<{ total: number; breakdown: SystemVolumeBreakdown; perBatch: Map<string, number>; perBatchClampedLoss: Map<string, number> }> {
  const emptyBreakdown: SystemVolumeBreakdown = {
    totalLiters: 0, initialVolumeLiters: 0, mergesInLiters: 0, mergesOutLiters: 0,
    transfersInLiters: 0, transfersOutLiters: 0, transferLossLiters: 0,
    bottlingLiters: 0, bottlingLossLiters: 0, keggingLiters: 0, keggingLossLiters: 0,
    distillationLiters: 0, adjustmentsLiters: 0, positiveAdjLiters: 0, negativeAdjLiters: 0,
    rackingLossLiters: 0, filterLossLiters: 0, clampedLossLiters: 0, batchCount: 0,
  };
  if (verifiedBatchIds.length === 0) return { total: 0, breakdown: emptyBreakdown, perBatch: new Map(), perBatchClampedLoss: new Map() };

  const idList = sql.join(verifiedBatchIds.map((id) => sql`${id}`), sql`, `);
  const endDate = sql`${asOfDate}::date + INTERVAL '1 day'`;

  // Fetch batch basics (initial volume, parent)
  const batchBasics = await db.execute(sql`
    SELECT id, initial_volume_liters, parent_batch_id
    FROM batches
    WHERE id IN (${idList}) AND deleted_at IS NULL
  `);
  const batchMap = new Map<string, { initial: number; parentId: string | null }>();
  for (const b of batchBasics.rows as any[]) {
    batchMap.set(b.id, {
      initial: parseFloat(b.initial_volume_liters || "0"),
      parentId: b.parent_batch_id,
    });
  }

  // Bulk query helper: group rows by batchId field
  function groupBy<T extends Record<string, any>>(rows: T[], key: string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const id = r[key];
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(r);
    }
    return map;
  }

  // 1. Transfers OUT (source)
  const tOut = await db.execute(sql`
    SELECT source_batch_id, volume_transferred, loss
    FROM batch_transfers
    WHERE source_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND transferred_at < ${endDate}
  `);
  const transfersOutByBatch = groupBy(tOut.rows as any[], "source_batch_id");

  // 2. Transfers IN (destination)
  const tIn = await db.execute(sql`
    SELECT destination_batch_id, volume_transferred
    FROM batch_transfers
    WHERE destination_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND transferred_at < ${endDate}
  `);
  const transfersInByBatch = groupBy(tIn.rows as any[], "destination_batch_id");

  // 3. Merges IN (excludes batch_transfer source_type — those are tracked via batch_transfers)
  const merges = await db.execute(sql`
    SELECT target_batch_id, volume_added
    FROM batch_merge_history
    WHERE target_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND merged_at < ${endDate}
      AND source_type != 'batch_transfer'
  `);
  const mergesByBatch = groupBy(merges.rows as any[], "target_batch_id");

  // 3b. Merges OUT (source batch side — excludes batch_transfer, tracked via batch_transfers)
  const mOut = await db.execute(sql`
    SELECT source_batch_id, volume_added AS volume_merged_out
    FROM batch_merge_history
    WHERE source_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND merged_at < ${endDate}
      AND source_type != 'batch_transfer'
  `);
  const mergesOutByBatch = groupBy(mOut.rows as any[], "source_batch_id");

  // 4. Bottle runs (convert loss using loss_unit)
  const bottles = await db.execute(sql`
    SELECT batch_id, volume_taken_liters,
      CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END AS loss,
      units_produced, package_size_ml
    FROM bottle_runs
    WHERE batch_id IN (${idList})
      AND voided_at IS NULL
      AND packaged_at < ${endDate}
  `);
  const bottlesByBatch = groupBy(bottles.rows as any[], "batch_id");

  // 5. Keg fills (convert volume_taken and loss using their unit columns)
  const kegs = await db.execute(sql`
    SELECT batch_id,
      CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END AS volume_taken,
      CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END AS loss
    FROM keg_fills
    WHERE batch_id IN (${idList})
      AND voided_at IS NULL
      AND deleted_at IS NULL
      AND filled_at < ${endDate}
  `);
  const kegsByBatch = groupBy(kegs.rows as any[], "batch_id");

  // 6. Distillation
  const dist = await db.execute(sql`
    SELECT source_batch_id, source_volume_liters
    FROM distillation_records
    WHERE source_batch_id IN (${idList})
      AND deleted_at IS NULL
      AND status IN ('sent', 'received')
      AND sent_at < ${endDate}
  `);
  const distByBatch = groupBy(dist.rows as any[], "source_batch_id");

  // 7. Volume adjustments
  const adjs = await db.execute(sql`
    SELECT batch_id, adjustment_amount
    FROM batch_volume_adjustments
    WHERE batch_id IN (${idList})
      AND deleted_at IS NULL
      AND adjustment_date < ${endDate}
  `);
  const adjsByBatch = groupBy(adjs.rows as any[], "batch_id");

  // 8. Racking losses
  const racks = await db.execute(sql`
    SELECT batch_id, volume_loss
    FROM batch_racking_operations
    WHERE batch_id IN (${idList})
      AND deleted_at IS NULL
      AND racked_at < ${endDate}
      AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
  `);
  const racksByBatch = groupBy(racks.rows as any[], "batch_id");

  // 9. Filter losses
  const filters = await db.execute(sql`
    SELECT batch_id, volume_loss
    FROM batch_filter_operations
    WHERE batch_id IN (${idList})
      AND deleted_at IS NULL
      AND filtered_at < ${endDate}
  `);
  const filtersByBatch = groupBy(filters.rows as any[], "batch_id");

  // Compute per-batch volume at asOfDate, accumulating breakdown
  const num = (v: any) => parseFloat(v || "0") || 0;
  let totalLiters = 0;
  const bd: SystemVolumeBreakdown = { ...emptyBreakdown, batchCount: verifiedBatchIds.length };
  const perBatch = new Map<string, number>();
  const perBatchClampedLoss = new Map<string, number>();

  for (const batchId of verifiedBatchIds) {
    const batch = batchMap.get(batchId);
    if (!batch) continue;

    const transfersIn = (transfersInByBatch.get(batchId) || []).reduce((s, r) => s + num(r.volume_transferred), 0);
    const transfersOut = (transfersOutByBatch.get(batchId) || []).reduce((s, r) => s + num(r.volume_transferred), 0);
    const transferLoss = (transfersOutByBatch.get(batchId) || []).reduce((s, r) => s + num(r.loss), 0);
    const mergesIn = (mergesByBatch.get(batchId) || []).reduce((s, r) => s + num(r.volume_added), 0);
    const mergesOut = (mergesOutByBatch.get(batchId) || []).reduce((s, r) => s + num(r.volume_merged_out), 0);

    // Bottling with smart loss detection (matching volume trace logic)
    const bottlingVol = (bottlesByBatch.get(batchId) || []).reduce((s, b) => s + num(b.volume_taken_liters), 0);
    const bottlingLoss = (bottlesByBatch.get(batchId) || []).reduce((s, b) => {
      const volumeTaken = num(b.volume_taken_liters);
      const lossVal = num(b.loss);
      const productVol = ((b.units_produced || 0) * (b.package_size_ml || 0)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVol + lossVal)) < 2;
      return s + (lossIncluded ? 0 : lossVal);
    }, 0);

    const kegging = (kegsByBatch.get(batchId) || []).reduce((s, k) => s + num(k.volume_taken), 0);
    const keggingLoss = (kegsByBatch.get(batchId) || []).reduce((s, k) => s + num(k.loss), 0);
    const distillation = (distByBatch.get(batchId) || []).reduce((s, d) => s + num(d.source_volume_liters), 0);
    const adjRows = adjsByBatch.get(batchId) || [];
    const adjustments = adjRows.reduce((s, a) => s + num(a.adjustment_amount), 0);
    const posAdj = adjRows.reduce((s, a) => { const v = num(a.adjustment_amount); return s + (v > 0 ? v : 0); }, 0);
    const negAdj = adjRows.reduce((s, a) => { const v = num(a.adjustment_amount); return s + (v < 0 ? Math.abs(v) : 0); }, 0);
    const rackingLoss = (racksByBatch.get(batchId) || []).reduce((s, r) => s + num(r.volume_loss), 0);
    const filterLoss = (filtersByBatch.get(batchId) || []).reduce((s, f) => s + num(f.volume_loss), 0);

    // Transfer-created batches: effective initial is 0 if they have parent + transfers
    // account for most of the initial volume (>= 90%). Small top-up transfers should
    // NOT zero out the initial volume.
    const isTransferCreated = batch.parentId && transfersIn >= batch.initial * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : batch.initial;

    const ending = effectiveInitial + mergesIn - mergesOut + transfersIn
      - transfersOut - transferLoss
      - bottlingVol - bottlingLoss
      - kegging - keggingLoss
      - distillation
      + adjustments
      - rackingLoss - filterLoss;

    // No clamping — negative endings indicate data quality issues that should be
    // investigated, not hidden. Clamping creates asymmetry with aggregate loss queries
    // (losses count the full amount but physical absorbs the overshoot), shifting variance.
    perBatch.set(batchId, ending);
    totalLiters += ending;

    // Accumulate breakdown
    bd.initialVolumeLiters += effectiveInitial;
    bd.mergesInLiters += mergesIn;
    bd.mergesOutLiters += mergesOut;
    bd.transfersInLiters += transfersIn;
    bd.transfersOutLiters += transfersOut;
    bd.transferLossLiters += transferLoss;
    bd.bottlingLiters += bottlingVol;
    bd.bottlingLossLiters += bottlingLoss;
    bd.keggingLiters += kegging;
    bd.keggingLossLiters += keggingLoss;
    bd.distillationLiters += distillation;
    bd.adjustmentsLiters += adjustments;
    bd.positiveAdjLiters += posAdj;
    bd.negativeAdjLiters += negAdj;
    bd.rackingLossLiters += rackingLoss;
    bd.filterLossLiters += filterLoss;
    if (ending < 0) {
      bd.clampedLossLiters += Math.abs(ending);
      perBatchClampedLoss.set(batchId, Math.abs(ending));
    }
  }

  bd.totalLiters = totalLiters;

  return { total: litersToWineGallons(totalLiters), breakdown: bd, perBatch, perBatchClampedLoss };
}

/**
 * Groups per-batch SBD volumes by tax class.
 * Returns liters per tax class key.
 */
function computePerTaxClassBulkInventory(
  perBatch: Map<string, number>,
  batchTaxClassMap: Map<string, TTBTaxClass | null>,
  batchProductTypes: Map<string, string | null>,
): Record<string, number> {
  const byClass: Record<string, number> = {};
  for (const [batchId, volumeLiters] of perBatch) {
    if (volumeLiters === 0) continue; // Skip zero-volume batches but include negatives for waterfall consistency
    const taxClass = getTaxClassFromMap(batchTaxClassMap, batchId, batchProductTypes.get(batchId) ?? null);
    if (!taxClass) continue; // Skip non-taxable batches (e.g. juice) rather than defaulting to HC
    byClass[taxClass] = (byClass[taxClass] || 0) + volumeLiters;
  }
  return byClass;
}

// ============================================
// BATCH-DERIVED TTB RECONCILIATION
// Single source of truth: reconstructs all volumes from operations,
// never uses batch.currentVolumeLiters. Provides per-batch drill-down
// with identity checks and double-counting detection.
// ============================================

interface BatchTTBContribution {
  batchId: string;
  batchName: string;
  batchNumber: string;
  productType: string | null;
  vesselName: string | null;
  startDate: string;
  reconciliationStatus: string;
  isCarriedForward: boolean;
  isNewInPeriod: boolean;
  isTransferCreated: boolean;
  isFullyTransferredSource: boolean;
  // All in wine gallons
  opening: number;
  production: number;
  positiveAdj: number;
  transfersIn: number;
  transfersOut: number;
  transferLoss: number;
  mergesIn: number;
  mergesOut: number;
  losses: number;
  sales: number;
  distillation: number;
  ending: number;
  identityCheck: number;
  lossBreakdown: {
    racking: number;
    filter: number;
    bottling: number;
    kegging: number;
    transfer: number;
    pressTransfer: number;
    adjustments: number;
  };
  packagingBreakdown: {
    bottlingTaken: number;
    bottlingLoss: number;
    keggingTaken: number;
    keggingLoss: number;
  };
  crossClassIn: Array<{ fromTaxClass: string; volume: number }>;
  crossClassOut: Array<{ toTaxClass: string; volume: number }>;
  // Double-counting checks
  currentVolumeLitersStored: number;
  reconstructedEndingLiters: number;
  driftLiters: number;
  hasInitialVolumeAnomaly: boolean;
  vesselCapacityGal: number | null;
  maxVolumeReceivedGal: number;
  exceedsVesselCapacity: boolean;
  vesselCapacityHistory?: Array<{
    vesselName: string;
    vesselCapacityGal: number;
    peakVolumeGal: number;
    peakDate: string;
    exceeds: boolean;
  }>;
}

interface BatchReconciliationResult {
  batches: BatchTTBContribution[];
  totals: {
    opening: number;
    production: number;
    positiveAdj: number;
    packaging: number;
    losses: number;
    sales: number;
    distillation: number;
    ending: number;
  };
  identityCheck: number;
  lossBreakdown: {
    racking: number;
    filter: number;
    bottling: number;
    kegging: number;
    transfer: number;
    pressTransfer: number;
    adjustments: number;
  };
  crossClassByTaxClass: Record<string, { in: number; out: number }>;
  byTaxClass: Record<string, {
    opening: number;
    production: number;
    positiveAdj: number;
    packaging: number;
    losses: number;
    sales: number;
    distillation: number;
    ending: number;
    transfersIn: number;
    transfersOut: number;
    mergesIn: number;
    mergesOut: number;
    lossBreakdown: {
      racking: number;
      filter: number;
      bottling: number;
      kegging: number;
      transfer: number;
      pressTransfer: number;
      adjustments: number;
    };
    packagingBreakdown: {
      bottlingTaken: number;
      bottlingLoss: number;
      keggingTaken: number;
      keggingLoss: number;
    };
    crossClassIn: number;
    crossClassOut: number;
  }>;
  batchesWithIdentityIssues: number;
  batchesWithDrift: number;
  batchesWithInitialAnomaly: number;
  vesselCapacityWarnings: number;
}

/**
 * Compute TTB reconciliation from batch operations.
 * Reconstructs all volumes purely from operations — never uses currentVolumeLiters.
 * Returns per-batch TTB contributions with identity checks and double-counting detection.
 *
 * @param startDate - Period start (opening date). Operations on or before this date contribute to opening.
 * @param endDate - Period end (reconciliation date). Operations after startDate and on or before endDate are period activity.
 */
async function computeReconciliationFromBatches(
  startDate: string,
  endDate: string,
  batchTaxClassMapInput?: Map<string, TTBTaxClass | null>,
): Promise<BatchReconciliationResult> {
  const emptyResult: BatchReconciliationResult = {
    batches: [],
    totals: { opening: 0, production: 0, positiveAdj: 0, packaging: 0, losses: 0, sales: 0, distillation: 0, ending: 0 },
    identityCheck: 0,
    lossBreakdown: { racking: 0, filter: 0, bottling: 0, kegging: 0, transfer: 0, pressTransfer: 0, adjustments: 0 },
    crossClassByTaxClass: {},
    byTaxClass: {},
    batchesWithIdentityIssues: 0,
    batchesWithDrift: 0,
    batchesWithInitialAnomaly: 0,
    vesselCapacityWarnings: 0,
  };

  // 1. Fetch eligible batches with vessel data
  const eligibleBatches = await db.execute(sql`
    SELECT b.id, b.name, b.batch_number, b.product_type, b.start_date,
           b.initial_volume_liters, b.parent_batch_id, b.current_volume_liters,
           b.is_racking_derivative, b.vessel_id, b.reconciliation_status,
           b.transfer_loss_l,
           v.name AS vessel_name, v.capacity_liters AS vessel_capacity_liters
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NULL
      AND (
        COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative IS TRUE
        OR b.parent_batch_id IS NOT NULL
      )
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= ${endDate}::date
  `);

  const batchRows = eligibleBatches.rows as any[];
  if (batchRows.length === 0) return emptyResult;

  // Build batch info map and id list
  interface BatchInfo {
    id: string;
    name: string;
    batchNumber: string;
    productType: string | null;
    vesselId: string | null;
    vesselName: string | null;
    startDate: string;
    initialVolumeLiters: number;
    parentBatchId: string | null;
    currentVolumeLiters: number;
    isRackingDerivative: boolean;
    vesselCapacityLiters: number | null;
    reconciliationStatus: string;
    pressTransferLossL: number;
  }

  const batchInfoMap = new Map<string, BatchInfo>();
  const batchIds: string[] = [];

  for (const b of batchRows) {
    const id = b.id as string;
    batchIds.push(id);
    batchInfoMap.set(id, {
      id,
      name: b.name || "",
      batchNumber: b.batch_number || "",
      productType: b.product_type,
      vesselId: b.vessel_id,
      vesselName: b.vessel_name,
      startDate: b.start_date ? new Date(b.start_date).toISOString().split("T")[0] : "",
      initialVolumeLiters: parseFloat(b.initial_volume_liters || "0"),
      parentBatchId: b.parent_batch_id,
      currentVolumeLiters: parseFloat(b.current_volume_liters || "0"),
      isRackingDerivative: b.is_racking_derivative === true,
      vesselCapacityLiters: b.vessel_capacity_liters ? parseFloat(b.vessel_capacity_liters) : null,
      reconciliationStatus: b.reconciliation_status || "pending",
      pressTransferLossL: parseFloat(b.transfer_loss_l || "0"),
    });
  }

  // Build set of batch IDs that have children (used to detect fully-transferred sources)
  const batchesWithChildren = new Set<string>();
  for (const info of batchInfoMap.values()) {
    if (info.parentBatchId) batchesWithChildren.add(info.parentBatchId);
  }

  // Resolve tax class map: use provided map or build one
  const taxClassMap = batchTaxClassMapInput ?? (await buildBatchTaxClassMap()).map;

  const idList = sql.join(batchIds.map((id) => sql`${id}`), sql`, `);

  // Helper: parse numeric
  const num = (v: any) => parseFloat(v || "0") || 0;

  // Helper: group rows by a key field
  function groupBy<T extends Record<string, any>>(rows: T[], key: string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const k = r[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }

  // Helper: partition rows by date relative to startDate and endDate
  // Returns [beforeOrOn, during, after] where:
  //   beforeOrOn = date <= startDate (contributes to opening)
  //   during = startDate < date <= endDate (period activity)
  //   after = date > endDate (post-period, used for all-time drift)
  function partitionByDate(rows: any[], dateField: string): [any[], any[], any[]] {
    const before: any[] = [];
    const during: any[] = [];
    const after: any[] = [];
    for (const r of rows) {
      const d = r[dateField] ? new Date(r[dateField]) : null;
      if (!d) { during.push(r); continue; }
      const dateStr = d.toISOString().split("T")[0];
      if (dateStr <= startDate) {
        before.push(r);
      } else if (dateStr <= endDate) {
        during.push(r);
      } else {
        after.push(r);
      }
    }
    return [before, during, after];
  }

  // 2. Fetch ALL operations (no date ceiling) — run in parallel for performance
  // Operations are partitioned by date later for period-specific columns.
  // Fetching all-time allows accurate drift detection (comparing with live currentVolumeLiters).
  const [tOut, tIn, merges, mergesOut, bottles, kegs, dist, adjs, racks, filters, bottleDist, kegDist] = await Promise.all([
    // 2a. Transfers OUT (source) — include destination_batch_id for same-vessel detection
    db.execute(sql`
      SELECT source_batch_id, destination_batch_id, volume_transferred, loss, transferred_at
      FROM batch_transfers
      WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
    `),
    // 2b. Transfers IN (destination) — include source_batch_id for same-vessel detection
    db.execute(sql`
      SELECT destination_batch_id, source_batch_id, volume_transferred, transferred_at
      FROM batch_transfers
      WHERE destination_batch_id IN (${idList}) AND deleted_at IS NULL
    `),
    // 2c. Merges IN (volume received via merge — excludes batch_transfer, tracked via batch_transfers)
    db.execute(sql`
      SELECT target_batch_id, volume_added, merged_at, source_type
      FROM batch_merge_history
      WHERE target_batch_id IN (${idList}) AND deleted_at IS NULL
        AND source_type != 'batch_transfer'
    `),
    // 2c2. Merges OUT (volume sent from source batch — excludes batch_transfer, tracked via batch_transfers)
    db.execute(sql`
      SELECT source_batch_id, volume_added AS volume_merged_out, merged_at
      FROM batch_merge_history
      WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL
        AND source_type != 'batch_transfer'
    `),
    // 2d. Bottle runs (convert loss using loss_unit)
    db.execute(sql`
      SELECT batch_id, volume_taken_liters,
        CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END AS loss,
        units_produced, package_size_ml, packaged_at
      FROM bottle_runs
      WHERE batch_id IN (${idList}) AND voided_at IS NULL
    `),
    // 2e. Keg fills (convert volume_taken and loss using their unit columns)
    db.execute(sql`
      SELECT batch_id,
        CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END AS volume_taken,
        CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END AS loss,
        filled_at, distributed_at
      FROM keg_fills
      WHERE batch_id IN (${idList}) AND voided_at IS NULL AND deleted_at IS NULL
    `),
    // 2f. Distillation
    db.execute(sql`
      SELECT source_batch_id, source_volume_liters, sent_at
      FROM distillation_records
      WHERE source_batch_id IN (${idList}) AND deleted_at IS NULL AND status IN ('sent', 'received')
    `),
    // 2g. Volume adjustments
    db.execute(sql`
      SELECT batch_id, adjustment_amount, adjustment_date
      FROM batch_volume_adjustments
      WHERE batch_id IN (${idList}) AND deleted_at IS NULL
    `),
    // 2h. Racking operations (loss only — transfers tracked via merges-out and child batches)
    db.execute(sql`
      SELECT batch_id, volume_loss, volume_before, volume_after, racked_at, source_vessel_id, destination_vessel_id
      FROM batch_racking_operations
      WHERE batch_id IN (${idList}) AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
    `),
    // 2i. Filter losses
    db.execute(sql`
      SELECT batch_id, volume_loss, filtered_at
      FROM batch_filter_operations
      WHERE batch_id IN (${idList}) AND deleted_at IS NULL
    `),
    // 2j. Bottle distributions
    db.execute(sql`
      SELECT br.batch_id,
             (CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)) / 1000.0 AS dist_liters,
             id.distribution_date
      FROM inventory_distributions id
      JOIN inventory_items ii ON id.inventory_item_id = ii.id
      JOIN bottle_runs br ON ii.bottle_run_id = br.id
      WHERE br.batch_id IN (${idList})
    `),
    // 2k. Keg distributions (convert volume_taken using volume_taken_unit)
    db.execute(sql`
      SELECT batch_id,
        CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END AS dist_liters,
        CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END AS loss_liters,
        CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END
          + CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END AS taken_plus_loss_liters,
        distributed_at
      FROM keg_fills
      WHERE batch_id IN (${idList}) AND distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
    `),
  ]);

  const transfersOutByBatch = groupBy(tOut.rows as any[], "source_batch_id");
  const transfersInByBatch = groupBy(tIn.rows as any[], "destination_batch_id");
  const mergesByBatch = groupBy(merges.rows as any[], "target_batch_id");
  const mergesOutByBatch = groupBy(mergesOut.rows as any[], "source_batch_id");
  const bottlesByBatch = groupBy(bottles.rows as any[], "batch_id");
  const kegsByBatch = groupBy(kegs.rows as any[], "batch_id");
  const distByBatch = groupBy(dist.rows as any[], "source_batch_id");
  const adjsByBatch = groupBy(adjs.rows as any[], "batch_id");
  const racksByBatch = groupBy(racks.rows as any[], "batch_id");
  const filtersByBatch = groupBy(filters.rows as any[], "batch_id");
  const bottleDistByBatch = groupBy(bottleDist.rows as any[], "batch_id");
  const kegDistByBatch = groupBy(kegDist.rows as any[], "batch_id");

  // 2k2. Build vessel capacity and name maps for timeline capacity checks
  const allVesselIds = new Set<string>();
  for (const info of batchInfoMap.values()) {
    if (info.vesselId) allVesselIds.add(info.vesselId);
  }
  for (const row of racks.rows as any[]) {
    if (row.source_vessel_id) allVesselIds.add(row.source_vessel_id);
    if (row.destination_vessel_id) allVesselIds.add(row.destination_vessel_id);
  }

  const vesselCapacityMap = new Map<string, number>();
  const vesselNameMap = new Map<string, string>();

  if (allVesselIds.size > 0) {
    const vesselIdList = sql.join(Array.from(allVesselIds).map(id => sql`${id}`), sql`, `);
    const vesselRows = await db.execute(sql`
      SELECT id, name, capacity_liters
      FROM vessels
      WHERE id IN (${vesselIdList})
    `);
    for (const v of vesselRows.rows as any[]) {
      if (v.capacity_liters) vesselCapacityMap.set(v.id, parseFloat(v.capacity_liters));
      vesselNameMap.set(v.id, v.name || "Unknown");
    }
  }

  // Note: Racking-created child batch volume is now tracked via batch_transfers records
  // (backfilled for historical data, created automatically for new partial racks).
  // No need for the old rackingFromParentsByChild / childCreationOutflows mechanism.

  // Helper: walk through volume events over time, tracking vessel changes and peak volumes per vessel
  function checkVesselCapacityTimeline(
    batchId: string,
    info: BatchInfo,
    effectiveInitialL: number,
    rackingRows: any[],
    transfersIn: any[],
    transfersOut: any[],
    mergesIn: any[],
    mergesOut: any[],
    bottleRows: any[],
    kegRows: any[],
    filterRows: any[],
    adjRows: any[],
    distRows: any[],
  ): {
    exceedsAny: boolean;
    vesselPeriods: Array<{
      vesselId: string;
      vesselName: string;
      vesselCapacityL: number;
      peakVolumeL: number;
      peakDate: string;
      exceeds: boolean;
    }>;
  } {
    // 1. Build vessel change timeline from racking operations
    interface VesselChange { date: Date; newVesselId: string }
    const vesselChanges: VesselChange[] = [];
    for (const r of rackingRows) {
      if (r.source_vessel_id && r.destination_vessel_id && r.source_vessel_id !== r.destination_vessel_id) {
        // Only record vessel change for full racks (batch actually moved to destination).
        // For partial racks (child batch creation), the parent stays in the source vessel —
        // remaining volume > 0 means the batch didn't fully move.
        const remaining = num(r.volume_before) - num(r.volume_after) - num(r.volume_loss);
        if (remaining < 1) {
          vesselChanges.push({
            date: r.racked_at ? new Date(r.racked_at) : new Date(info.startDate),
            newVesselId: r.destination_vessel_id,
          });
        }
      }
    }
    vesselChanges.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 2. Build volume event timeline
    interface VolumeEvent { date: Date; deltaL: number }
    const events: VolumeEvent[] = [];
    const batchStart = new Date(info.startDate);

    // Initial volume at batch start
    if (effectiveInitialL !== 0) {
      events.push({ date: batchStart, deltaL: effectiveInitialL });
    }

    // Transfers in: +volume_transferred (skip same-vessel transfers — volume was already physically there)
    for (const r of transfersIn) {
      const sourceBatchVesselId = r.source_batch_id ? batchInfoMap.get(r.source_batch_id)?.vesselId : null;
      const isSameVessel = sourceBatchVesselId && sourceBatchVesselId === info.vesselId;
      if (!isSameVessel) {
        events.push({ date: r.transferred_at ? new Date(r.transferred_at) : batchStart, deltaL: num(r.volume_transferred) });
      }
    }

    // Transfers out: -(volume_transferred + loss) (skip same-vessel transfers — volume stays physically there)
    for (const r of transfersOut) {
      const destBatchVesselId = r.destination_batch_id ? batchInfoMap.get(r.destination_batch_id)?.vesselId : null;
      const isSameVessel = destBatchVesselId && destBatchVesselId === info.vesselId;
      if (!isSameVessel) {
        events.push({ date: r.transferred_at ? new Date(r.transferred_at) : batchStart, deltaL: -(num(r.volume_transferred) + num(r.loss)) });
      }
    }

    // Merges in: +volume_added
    for (const r of mergesIn) {
      events.push({ date: r.merged_at ? new Date(r.merged_at) : batchStart, deltaL: num(r.volume_added) });
    }

    // Merges out: -volume_merged_out
    for (const r of mergesOut) {
      events.push({ date: r.merged_at ? new Date(r.merged_at) : batchStart, deltaL: -num(r.volume_merged_out) });
    }

    // Racking losses: For vessel-change rackings (partial rack creating child batch or merge),
    // only deduct volume_loss here — the volume transfer itself is tracked via batch_transfers
    // or batch_merge_history. For rack-to-self, use full volume delta (volume_before - volume_after)
    // which captures lees loss even when volume_loss=0.
    for (const r of rackingRows) {
      const isVesselChange = r.source_vessel_id && r.destination_vessel_id
        && r.source_vessel_id !== r.destination_vessel_id;
      let rackingDelta: number;
      if (isVesselChange) {
        // Volume transfer handled by batch_transfers/batch_merge_history; only deduct loss
        rackingDelta = -num(r.volume_loss);
      } else {
        // Rack-to-self: use full volume delta
        const vBefore = num(r.volume_before);
        const vAfter = num(r.volume_after);
        rackingDelta = (vBefore > 0 && vAfter >= 0 && vBefore > vAfter)
          ? -(vBefore - vAfter)
          : -num(r.volume_loss);
      }
      const rackingDate = r.racked_at ? new Date(r.racked_at) : batchStart;
      const eventDate = isVesselChange ? new Date(rackingDate.getTime() - 1) : rackingDate;
      events.push({ date: eventDate, deltaL: rackingDelta });
    }

    // Bottling: compute per bottle run using same logic as bottlingTakenL
    for (const b of bottleRows) {
      const volumeTaken = num(b.volume_taken_liters);
      const lossVal = num(b.loss);
      const productVolume = (num(b.units_produced) * num(b.package_size_ml)) / 1000;
      const lossIncluded = Math.abs(volumeTaken - (productVolume + lossVal)) < 2;
      const taken = volumeTaken + (lossIncluded ? 0 : lossVal);
      events.push({ date: b.packaged_at ? new Date(b.packaged_at) : batchStart, deltaL: -taken });
    }

    // Kegging: -(volume_taken + loss)
    for (const k of kegRows) {
      events.push({ date: k.filled_at ? new Date(k.filled_at) : batchStart, deltaL: -(num(k.volume_taken) + num(k.loss)) });
    }

    // Filters: -volume_loss
    for (const f of filterRows) {
      events.push({ date: f.filtered_at ? new Date(f.filtered_at) : batchStart, deltaL: -num(f.volume_loss) });
    }

    // Adjustments: +/- adjustment_amount
    for (const a of adjRows) {
      events.push({ date: a.adjustment_date ? new Date(a.adjustment_date) : batchStart, deltaL: num(a.adjustment_amount) });
    }

    // Distillation: -source_volume_liters
    for (const d of distRows) {
      events.push({ date: d.sent_at ? new Date(d.sent_at) : batchStart, deltaL: -num(d.source_volume_liters) });
    }

    // 3. Sort volume events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 4. Walk through events, tracking running volume and current vessel
    let runningVolumeL = 0;
    // Infer the STARTING vessel: if racking moved the batch to its current vessel,
    // the batch actually started in the source vessel of the first vessel-change racking.
    let currentVesselId = info.vesselId || "";
    if (vesselChanges.length > 0) {
      // Find the first racking record that matches the first vessel change
      const firstChange = vesselChanges[0];
      const matchingRack = rackingRows.find(
        (r) => r.source_vessel_id && r.destination_vessel_id
          && r.source_vessel_id !== r.destination_vessel_id
          && r.destination_vessel_id === firstChange.newVesselId
      );
      if (matchingRack && matchingRack.source_vessel_id) {
        currentVesselId = matchingRack.source_vessel_id;
      }
    }
    let vesselChangeIdx = 0;

    // Track peak volume per vessel
    const peakByVessel = new Map<string, { peakVolumeL: number; peakDate: Date }>();
    const updatePeak = (vesselId: string, volumeL: number, date: Date) => {
      if (!vesselId) return;
      const existing = peakByVessel.get(vesselId);
      if (!existing || volumeL > existing.peakVolumeL) {
        peakByVessel.set(vesselId, { peakVolumeL: volumeL, peakDate: date });
      }
    };

    for (const evt of events) {
      // Process any vessel changes that happen at or before this event's date
      while (vesselChangeIdx < vesselChanges.length && vesselChanges[vesselChangeIdx].date.getTime() <= evt.date.getTime()) {
        currentVesselId = vesselChanges[vesselChangeIdx].newVesselId;
        vesselChangeIdx++;
      }

      runningVolumeL += evt.deltaL;
      updatePeak(currentVesselId, runningVolumeL, evt.date);
    }

    // Process any remaining vessel changes
    while (vesselChangeIdx < vesselChanges.length) {
      currentVesselId = vesselChanges[vesselChangeIdx].newVesselId;
      vesselChangeIdx++;
      updatePeak(currentVesselId, runningVolumeL, vesselChanges[vesselChangeIdx - 1].date);
    }

    // 5. Build result
    let exceedsAny = false;
    const vesselPeriods: Array<{
      vesselId: string;
      vesselName: string;
      vesselCapacityL: number;
      peakVolumeL: number;
      peakDate: string;
      exceeds: boolean;
    }> = [];

    for (const [vesselId, peak] of peakByVessel) {
      const capacityL = vesselCapacityMap.get(vesselId);
      if (capacityL === undefined) continue;
      const exceeds = peak.peakVolumeL > capacityL * 1.05; // 5% tolerance for headspace
      if (exceeds) exceedsAny = true;
      vesselPeriods.push({
        vesselId,
        vesselName: vesselNameMap.get(vesselId) || "Unknown",
        vesselCapacityL: capacityL,
        peakVolumeL: peak.peakVolumeL,
        peakDate: peak.peakDate.toISOString().split("T")[0],
        exceeds,
      });
    }

    return { exceedsAny, vesselPeriods };
  }

  // 3. Per-batch computation
  const contributions: BatchTTBContribution[] = [];
  const totals = { opening: 0, production: 0, positiveAdj: 0, packaging: 0, losses: 0, sales: 0, distillation: 0, ending: 0, transfersIn: 0, transfersOut: 0, mergesIn: 0, mergesOut: 0 };
  const aggLoss = { racking: 0, filter: 0, bottling: 0, kegging: 0, transfer: 0, pressTransfer: 0, adjustments: 0 };
  let batchesWithIdentityIssues = 0;
  let batchesWithDrift = 0;
  let batchesWithInitialAnomaly = 0;
  let vesselCapacityWarnings = 0;
  for (const batchId of batchIds) {
    const info = batchInfoMap.get(batchId)!;

    // Determine if transfer-created (effective initial = 0)
    // Only zero initial if transfers account for most of the initial volume (>= 90%).
    // Small top-up transfers should NOT zero out the initial volume.
    const allTransfersIn = transfersInByBatch.get(batchId) || [];
    const totalTransfersInAllTime = allTransfersIn.reduce((s, r) => s + num(r.volume_transferred), 0);
    const isTransferCreated = !!(info.parentBatchId && totalTransfersInAllTime >= info.initialVolumeLiters * 0.9);
    const effectiveInitialL = isTransferCreated ? 0 : info.initialVolumeLiters;

    // Detect fully-transferred source batches: depleted batches that transferred all their
    // volume to other batches with no packaging activity. These are intermediate/staging batches
    // (e.g., pressed juice that was immediately transferred to a blending tank).
    // They stay in the SBD for transfer matching but are hidden from the UI list.
    const allTransfersOut = transfersOutByBatch.get(batchId) || [];
    const totalTransfersOutAllTime = allTransfersOut.reduce((s, r) => s + num(r.volume_transferred), 0);
    const allBottles = bottlesByBatch.get(batchId) || [];
    const allKegs = kegsByBatch.get(batchId) || [];
    const isFullyTransferredSource = info.currentVolumeLiters === 0
      && info.initialVolumeLiters > 0
      && totalTransfersOutAllTime >= info.initialVolumeLiters * 0.9
      && allBottles.length === 0
      && allKegs.length === 0
      && !batchesWithChildren.has(batchId);

    // Check if batch existed before period or was created during period
    const batchStartedBefore = info.startDate <= startDate;
    const isCarriedForward = batchStartedBefore;
    const isNewInPeriod = !batchStartedBefore;

    // Partition all operations by date into [before, during, after] buckets
    const [tOutBefore, tOutDuring, tOutAfter] = partitionByDate(transfersOutByBatch.get(batchId) || [], "transferred_at");
    const [tInBefore, tInDuring, tInAfter] = partitionByDate(transfersInByBatch.get(batchId) || [], "transferred_at");
    const [mergesBefore, mergesDuring, mergesAfter] = partitionByDate(mergesByBatch.get(batchId) || [], "merged_at");
    const [bottlesBefore, bottlesDuring, bottlesAfter] = partitionByDate(bottlesByBatch.get(batchId) || [], "packaged_at");
    const [kegsBefore, kegsDuring, kegsAfter] = partitionByDate(kegsByBatch.get(batchId) || [], "filled_at");
    const [distBefore, distDuring, distAfter] = partitionByDate(distByBatch.get(batchId) || [], "sent_at");
    const [adjsBefore, adjsDuring, adjsAfter] = partitionByDate(adjsByBatch.get(batchId) || [], "adjustment_date");
    const [racksBefore, racksDuring, racksAfter] = partitionByDate(racksByBatch.get(batchId) || [], "racked_at");
    const [filtersBefore, filtersDuring, filtersAfter] = partitionByDate(filtersByBatch.get(batchId) || [], "filtered_at");
    const [bottleDistBefore, bottleDistDuring, bottleDistAfter] = partitionByDate(bottleDistByBatch.get(batchId) || [], "distribution_date");
    const [kegDistBefore, kegDistDuring, kegDistAfter] = partitionByDate(kegDistByBatch.get(batchId) || [], "distributed_at");

    // Helper: sum a field from an array of rows
    const sumField = (rows: any[], field: string) => rows.reduce((s, r) => s + num(r[field]), 0);

    // Compute actual bottling loss (raw loss field)
    const bottlingLossL = (rows: any[]) => rows.reduce((s, b) => s + num(b.loss), 0);

    // Compute total packaging volume taken from batch (full amount deducted from currentVolumeLiters).
    // Data entry is inconsistent: some batches have loss included in volume_taken,
    // others have it separate. Detect which by comparing volume_taken to product + loss.
    const bottlingTakenL = (rows: any[]) => rows.reduce((s, b) => {
      const volumeTaken = num(b.volume_taken_liters);
      const lossVal = num(b.loss);
      const productVolume = (num(b.units_produced) * num(b.package_size_ml)) / 1000;
      // If volume_taken ≈ product + loss (within 2L tolerance), loss is already included
      const lossIncluded = Math.abs(volumeTaken - (productVolume + lossVal)) < 2;
      return s + volumeTaken + (lossIncluded ? 0 : lossVal);
    }, 0);
    const keggingTakenL = (rows: any[]) => rows.reduce((s, k) => s + num(k.volume_taken) + num(k.loss), 0);

    // Merges OUT (racking into occupied vessels — creates batch_merge_history record)
    const [mergesOutBefore, mergesOutDuring, mergesOutAfter] = partitionByDate(mergesOutByBatch.get(batchId) || [], "merged_at");

    // --- OPENING VOLUME (total volume at startDate) ---
    const openingInitialL = batchStartedBefore ? effectiveInitialL : 0;
    const openingMergesL = sumField(mergesBefore, "volume_added");
    const openingTransfersInL = sumField(tInBefore, "volume_transferred");
    const openingTransfersOutL = sumField(tOutBefore, "volume_transferred");
    const openingTransferLossL = sumField(tOutBefore, "loss");
    const openingBottlingTakenL = bottlingTakenL(bottlesBefore);
    const openingKeggingTakenL = keggingTakenL(kegsBefore);
    const openingDistillationL = sumField(distBefore, "source_volume_liters");
    const openingAdjustmentsL = sumField(adjsBefore, "adjustment_amount");
    const openingRackingLossL = sumField(racksBefore, "volume_loss");
    const openingMergesOutL = sumField(mergesOutBefore, "volume_merged_out");
    const openingFilterLossL = sumField(filtersBefore, "volume_loss");

    const openingL = openingInitialL + openingMergesL + openingTransfersInL
      - openingTransfersOutL - openingTransferLossL
      - openingBottlingTakenL - openingKeggingTakenL
      - openingDistillationL + openingAdjustmentsL
      - openingRackingLossL - openingMergesOutL - openingFilterLossL;

    const openingClampedL = openingL;

    // --- PERIOD ACTIVITY ---
    // Production: effectiveInitial for new batches + new-material merges (press runs, juice purchases)
    const productionInitialL = isNewInPeriod ? effectiveInitialL : 0;
    // Press-to-vessel transfer loss: juice lost during pump from press to fermentation vessel.
    // batch.initialVolumeLiters = gross - transferLossL, so this grosses up production to match
    // the TTB Form aggregate (which uses press_runs.total_juice_volume_liters = gross).
    const pressTransferLossL = isNewInPeriod ? info.pressTransferLossL : 0;
    // Press-run and juice-purchase merges are new material entering the system → production
    const newMaterialMergesL = sumField(
      mergesDuring.filter((m: any) => m.source_type === 'press_run' || m.source_type === 'juice_purchase'),
      "volume_added",
    );
    // Batch-to-batch merges (source_type = 'batch') are internal volume movement
    // (e.g. brandy additions for pommeau). Note: 'batch_transfer' type is already
    // excluded from the merge query and tracked via batchTransfers/periodTransfersInL.
    const internalMergesInL = sumField(
      mergesDuring.filter((m: any) => m.source_type === 'batch'),
      "volume_added",
    );
    const periodProductionL = productionInitialL + newMaterialMergesL + internalMergesInL;

    // Transfers during period
    const periodTransfersInL = sumField(tInDuring, "volume_transferred");
    const periodTransfersOutL = sumField(tOutDuring, "volume_transferred");
    const periodTransferLossL = sumField(tOutDuring, "loss");

    // Packaging during period (full amount taken from batch)
    const periodBottlingTakenL = bottlingTakenL(bottlesDuring);
    const periodKeggingTakenL = keggingTakenL(kegsDuring);

    // Process losses during period (for TTB reporting breakdown)
    const periodBottlingLossL = bottlingLossL(bottlesDuring);
    const periodKeggingLossL = sumField(kegsDuring, "loss");
    const periodRackingLossL = sumField(racksDuring, "volume_loss");
    const periodMergesOutL = sumField(mergesOutDuring, "volume_merged_out");
    const periodFilterLossL = sumField(filtersDuring, "volume_loss");
    const periodAdjustmentsL = sumField(adjsDuring, "adjustment_amount");
    const periodNegativeAdjL = Math.abs(Math.min(0, periodAdjustmentsL));
    const periodPositiveAdjL = Math.max(0, periodAdjustmentsL);

    // Total volume removed from batch (for bulk ending reconstruction)
    const periodTotalLossesL = periodBottlingLossL + periodKeggingLossL
      + periodRackingLossL + periodFilterLossL + periodNegativeAdjL;

    // Sales during period (distributions)
    const periodBottleDistL = sumField(bottleDistDuring, "dist_liters");
    const periodKegDistL = sumField(kegDistDuring, "dist_liters");
    const periodSalesL = periodBottleDistL + periodKegDistL;

    // Distillation during period
    const periodDistillationL = sumField(distDuring, "source_volume_liters");

    // --- ENDING VOLUME (bulk — what should match currentVolumeLiters) ---
    const endingL = openingClampedL + periodProductionL + periodPositiveAdjL
      + periodTransfersInL - periodTransfersOutL - periodTransferLossL
      - periodBottlingTakenL - periodKeggingTakenL
      - periodRackingLossL - periodMergesOutL - periodFilterLossL - periodNegativeAdjL
      - periodDistillationL;

    // No clamping — negative endings indicate data quality issues that should be
    // investigated, not hidden. All batch gaps have been reconciled to ~0.

    // --- IDENTITY CHECK ---
    // With clamping removed, identity is always 0. Kept for API compatibility.
    const identityL = 0;

    // --- STORED VOLUME AT END DATE (rewound from currentVolumeLiters) ---
    // Since we don't have historical snapshots, rewind currentVolumeLiters back to endDate
    // by adding back post-period removals and subtracting post-period additions.
    const afterRemovalsL = sumField(tOutAfter, "volume_transferred") + sumField(tOutAfter, "loss")
      + bottlingTakenL(bottlesAfter) + keggingTakenL(kegsAfter)
      + sumField(distAfter, "source_volume_liters")
      + sumField(racksAfter, "volume_loss") + sumField(mergesOutAfter, "volume_merged_out")
      + sumField(filtersAfter, "volume_loss")
      + Math.abs(Math.min(0, sumField(adjsAfter, "adjustment_amount")));
    const afterAdditionsL = sumField(tInAfter, "volume_transferred") + sumField(mergesAfter, "volume_added")
      + Math.max(0, sumField(adjsAfter, "adjustment_amount"));
    const storedAtEndDateL = info.currentVolumeLiters + afterRemovalsL - afterAdditionsL;

    // --- DOUBLE-COUNTING CHECKS ---
    // Drift: compare reconstructed ending at endDate with rewound stored volume at endDate
    const reconstructedEndingLiters = endingL;
    const driftLiters = reconstructedEndingLiters - storedAtEndDateL;

    // Initial volume anomaly: transfer-created batch should have initialVolume = 0
    // Only flag if transfers account for most of the initial volume (the batch was
    // truly created by transfer but initialVolumeLiters wasn't zeroed).
    // Small top-up transfers (< 90% of initial) are not anomalies.
    const hasInitialVolumeAnomaly = !!(
      info.parentBatchId && info.initialVolumeLiters > 0
      && totalTransfersInAllTime >= info.initialVolumeLiters * 0.9
      && (Math.abs(driftLiters) >= 0.5 || Math.abs(identityL) >= 0.95)
    );

    // Vessel capacity check: time-series walk tracking volume at each vessel
    const vesselCapacityResult = checkVesselCapacityTimeline(
      batchId, info, effectiveInitialL,
      racksByBatch.get(batchId) || [],
      transfersInByBatch.get(batchId) || [],
      transfersOutByBatch.get(batchId) || [],
      mergesByBatch.get(batchId) || [],
      mergesOutByBatch.get(batchId) || [],
      bottlesByBatch.get(batchId) || [],
      kegsByBatch.get(batchId) || [],
      filtersByBatch.get(batchId) || [],
      adjsByBatch.get(batchId) || [],
      distByBatch.get(batchId) || [],
    );
    const exceedsVesselCapacity = vesselCapacityResult.exceedsAny;
    const vesselCapacityL = info.vesselCapacityLiters;
    const maxVolumeReceivedL = vesselCapacityResult.vesselPeriods.length > 0
      ? Math.max(...vesselCapacityResult.vesselPeriods.map(vp => vp.peakVolumeL))
      : 0;

    // Convert to wine gallons
    const openingGal = litersToWineGallons(openingClampedL);
    // Production = gross output: net batch initial + press-to-vessel transfer loss + new material merges.
    // This matches TTB Form line 2 (Produced by fermentation) which uses gross press run volumes.
    // Positive adjustments are tracked separately (TTB Form line 9: Inventory gains).
    const productionGal = litersToWineGallons(productionInitialL + newMaterialMergesL + pressTransferLossL);
    const positiveAdjGal = litersToWineGallons(periodPositiveAdjL);
    const pressTransferLossGal = litersToWineGallons(pressTransferLossL);
    const transfersInGal = litersToWineGallons(periodTransfersInL);
    const transfersOutGal = litersToWineGallons(periodTransfersOutL);
    const transferLossGal = litersToWineGallons(periodTransferLossL);
    const mergesInGal = litersToWineGallons(internalMergesInL);
    const mergesOutGal = litersToWineGallons(periodMergesOutL);
    // "Losses" for the drill-down = process losses + press-to-vessel transfer loss (TTB category)
    const lossesGal = litersToWineGallons(periodTotalLossesL);
    // "Sales" for the drill-down = packaging taken (leaves bulk) + distributions (leaves premises)
    const packagingGal = litersToWineGallons(periodBottlingTakenL + periodKeggingTakenL - periodBottlingLossL - periodKeggingLossL);
    const salesGal = litersToWineGallons(periodSalesL);
    const distillationGal = litersToWineGallons(periodDistillationL);
    // Use raw conversion to preserve negative endings (batches over-packaged/transferred);
    // litersToWineGallons clamps negatives to 0 which inflates the waterfall total.
    const endingGal = endingL * WINE_GALLONS_PER_LITER;
    // identityL is always <= 0 (clamping only removes); use raw conversion to preserve magnitude
    const identityGal = identityL * WINE_GALLONS_PER_LITER;

    const lossBreakdown = {
      racking: litersToWineGallons(periodRackingLossL),
      filter: litersToWineGallons(periodFilterLossL),
      bottling: litersToWineGallons(periodBottlingLossL),
      kegging: litersToWineGallons(periodKeggingLossL),
      transfer: litersToWineGallons(periodTransferLossL),
      pressTransfer: litersToWineGallons(pressTransferLossL),
      adjustments: litersToWineGallons(periodNegativeAdjL),
    };

    const packagingBreakdown = {
      bottlingTaken: litersToWineGallons(periodBottlingTakenL),
      bottlingLoss: litersToWineGallons(periodBottlingLossL),
      keggingTaken: litersToWineGallons(periodKeggingTakenL),
      keggingLoss: litersToWineGallons(periodKeggingLossL),
    };

    // Cross-class transfer detection: compare tax class of this batch vs transfer partner
    const thisTaxClass = getTaxClassFromMap(taxClassMap, batchId, info.productType);
    const crossClassIn: Array<{ fromTaxClass: string; volume: number }> = [];
    const crossClassOut: Array<{ toTaxClass: string; volume: number }> = [];

    // Check transfers IN during period
    for (const r of tInDuring) {
      const sourceId = r.source_batch_id as string;
      const sourceInfo = batchInfoMap.get(sourceId);
      const sourceTaxClass = getTaxClassFromMap(taxClassMap, sourceId, sourceInfo?.productType ?? null);
      if (sourceTaxClass && thisTaxClass && sourceTaxClass !== thisTaxClass) {
        crossClassIn.push({ fromTaxClass: sourceTaxClass, volume: litersToWineGallons(num(r.volume_transferred)) });
      }
    }

    // Check transfers OUT during period
    for (const r of tOutDuring) {
      const destId = r.destination_batch_id as string;
      const destInfo = batchInfoMap.get(destId);
      const destTaxClass = getTaxClassFromMap(taxClassMap, destId, destInfo?.productType ?? null);
      if (destTaxClass && thisTaxClass && destTaxClass !== thisTaxClass) {
        crossClassOut.push({ toTaxClass: destTaxClass, volume: litersToWineGallons(num(r.volume_transferred)) });
      }
    }

    contributions.push({
      batchId,
      batchName: info.name,
      batchNumber: info.batchNumber,
      productType: info.productType,
      vesselName: info.vesselName,
      startDate: info.startDate,
      reconciliationStatus: info.reconciliationStatus,
      isCarriedForward,
      isNewInPeriod,
      isTransferCreated,
      isFullyTransferredSource,
      opening: parseFloat(openingGal.toFixed(3)),
      production: parseFloat(productionGal.toFixed(3)),
      positiveAdj: parseFloat(positiveAdjGal.toFixed(3)),
      transfersIn: parseFloat(transfersInGal.toFixed(3)),
      transfersOut: parseFloat(transfersOutGal.toFixed(3)),
      transferLoss: parseFloat(transferLossGal.toFixed(3)),
      mergesIn: parseFloat(mergesInGal.toFixed(3)),
      mergesOut: parseFloat(mergesOutGal.toFixed(3)),
      losses: parseFloat(lossesGal.toFixed(3)),
      sales: parseFloat(salesGal.toFixed(3)),
      distillation: parseFloat(distillationGal.toFixed(3)),
      ending: parseFloat(endingGal.toFixed(3)),
      identityCheck: parseFloat(identityGal.toFixed(3)),
      lossBreakdown: {
        racking: parseFloat(lossBreakdown.racking.toFixed(3)),
        filter: parseFloat(lossBreakdown.filter.toFixed(3)),
        bottling: parseFloat(lossBreakdown.bottling.toFixed(3)),
        kegging: parseFloat(lossBreakdown.kegging.toFixed(3)),
        transfer: parseFloat(lossBreakdown.transfer.toFixed(3)),
        pressTransfer: parseFloat(lossBreakdown.pressTransfer.toFixed(3)),
        adjustments: parseFloat(lossBreakdown.adjustments.toFixed(3)),
      },
      packagingBreakdown: {
        bottlingTaken: parseFloat(packagingBreakdown.bottlingTaken.toFixed(3)),
        bottlingLoss: parseFloat(packagingBreakdown.bottlingLoss.toFixed(3)),
        keggingTaken: parseFloat(packagingBreakdown.keggingTaken.toFixed(3)),
        keggingLoss: parseFloat(packagingBreakdown.keggingLoss.toFixed(3)),
      },
      crossClassIn: crossClassIn.map(c => ({ fromTaxClass: c.fromTaxClass, volume: parseFloat(c.volume.toFixed(3)) })),
      crossClassOut: crossClassOut.map(c => ({ toTaxClass: c.toTaxClass, volume: parseFloat(c.volume.toFixed(3)) })),
      currentVolumeLitersStored: parseFloat(info.currentVolumeLiters.toFixed(3)),
      reconstructedEndingLiters: parseFloat(reconstructedEndingLiters.toFixed(3)),
      driftLiters: parseFloat(driftLiters.toFixed(3)),
      hasInitialVolumeAnomaly,
      vesselCapacityGal: vesselCapacityL !== null ? parseFloat(litersToWineGallons(vesselCapacityL).toFixed(3)) : null,
      maxVolumeReceivedGal: parseFloat(litersToWineGallons(maxVolumeReceivedL).toFixed(3)),
      exceedsVesselCapacity,
      vesselCapacityHistory: vesselCapacityResult.vesselPeriods.map(vp => ({
        vesselName: vesselNameMap.get(vp.vesselId) || "Unknown",
        vesselCapacityGal: parseFloat(litersToWineGallons(vp.vesselCapacityL).toFixed(3)),
        peakVolumeGal: parseFloat(litersToWineGallons(vp.peakVolumeL).toFixed(3)),
        peakDate: vp.peakDate,
        exceeds: vp.exceeds,
      })),
    });

    // Accumulate totals
    totals.opening += openingGal;
    totals.production += productionGal;
    totals.positiveAdj += positiveAdjGal;
    totals.packaging += packagingGal;
    totals.losses += lossesGal + transferLossGal + pressTransferLossGal;
    totals.sales += salesGal;
    totals.distillation += distillationGal;
    totals.ending += endingGal;
    totals.transfersIn += transfersInGal;
    totals.transfersOut += transfersOutGal;
    totals.mergesIn += mergesInGal;
    totals.mergesOut += mergesOutGal;

    aggLoss.racking += lossBreakdown.racking;
    aggLoss.filter += lossBreakdown.filter;
    aggLoss.bottling += lossBreakdown.bottling;
    aggLoss.kegging += lossBreakdown.kegging;
    aggLoss.transfer += lossBreakdown.transfer;
    aggLoss.pressTransfer += lossBreakdown.pressTransfer;
    aggLoss.adjustments += lossBreakdown.adjustments;

    // Count issues — only for batches that appear in the main reconciliation list
    // (listForReconciliation excludes racking derivatives, transfer-derived children, brandy, juice,
    // and fully-transferred source batches)
    const isMainListBatch = !info.isRackingDerivative
      && !isFullyTransferredSource
      && !(info.parentBatchId && info.initialVolumeLiters === 0 && (info.productType || "cider") !== "pommeau")
      && !["brandy", "juice"].includes(info.productType || "");
    if (Math.abs(identityGal) >= 0.25) batchesWithIdentityIssues++;
    if (Math.abs(driftLiters) > 0.5 && info.reconciliationStatus !== "verified" && isMainListBatch) batchesWithDrift++;
    if (hasInitialVolumeAnomaly && info.reconciliationStatus !== "verified" && isMainListBatch) batchesWithInitialAnomaly++;
    if (exceedsVesselCapacity && info.reconciliationStatus !== "verified" && isMainListBatch) vesselCapacityWarnings++;
  }

  // Round totals
  const roundTotals = (t: typeof totals) => ({
    opening: parseFloat(t.opening.toFixed(1)),
    production: parseFloat(t.production.toFixed(1)),
    positiveAdj: parseFloat(t.positiveAdj.toFixed(1)),
    packaging: parseFloat(t.packaging.toFixed(1)),
    losses: parseFloat(t.losses.toFixed(1)),
    sales: parseFloat(t.sales.toFixed(1)),
    distillation: parseFloat(t.distillation.toFixed(1)),
    ending: parseFloat(t.ending.toFixed(1)),
    transfersIn: parseFloat(t.transfersIn.toFixed(1)),
    transfersOut: parseFloat(t.transfersOut.toFixed(1)),
    mergesIn: parseFloat(t.mergesIn.toFixed(1)),
    mergesOut: parseFloat(t.mergesOut.toFixed(1)),
  });

  const roundedTotals = roundTotals(totals);
  // Global identity = sum of per-batch identity checks (non-zero only from clamping)
  const globalIdentity = parseFloat(contributions.reduce((s, c) => s + c.identityCheck, 0).toFixed(1));

  // Aggregate by tax class
  type TaxClassAgg = BatchReconciliationResult["byTaxClass"][string];
  const byTaxClass: Record<string, TaxClassAgg> = {};
  const crossClassByTaxClass: Record<string, { in: number; out: number }> = {};

  for (const b of contributions) {
    const tc = getTaxClassFromMap(taxClassMap, b.batchId, b.productType);
    if (!tc) continue;

    if (!byTaxClass[tc]) {
      byTaxClass[tc] = {
        opening: 0, production: 0, positiveAdj: 0, packaging: 0,
        losses: 0, sales: 0, distillation: 0, ending: 0,
        transfersIn: 0, transfersOut: 0, mergesIn: 0, mergesOut: 0,
        lossBreakdown: { racking: 0, filter: 0, bottling: 0, kegging: 0, transfer: 0, pressTransfer: 0, adjustments: 0 },
        packagingBreakdown: { bottlingTaken: 0, bottlingLoss: 0, keggingTaken: 0, keggingLoss: 0 },
        crossClassIn: 0, crossClassOut: 0,
      };
    }
    if (!crossClassByTaxClass[tc]) {
      crossClassByTaxClass[tc] = { in: 0, out: 0 };
    }

    const a = byTaxClass[tc];
    a.opening += b.opening;
    a.production += b.production;
    a.positiveAdj += b.positiveAdj;
    // Net packaging = product volume (taken - loss)
    a.packaging += (b.packagingBreakdown.bottlingTaken - b.packagingBreakdown.bottlingLoss)
      + (b.packagingBreakdown.keggingTaken - b.packagingBreakdown.keggingLoss);
    a.losses += b.losses + b.transferLoss + (b.lossBreakdown?.pressTransfer || 0);
    a.sales += b.sales;
    a.distillation += b.distillation;
    a.ending += b.ending;
    a.transfersIn += b.transfersIn;
    a.transfersOut += b.transfersOut;
    a.mergesIn += b.mergesIn;
    a.mergesOut += b.mergesOut;

    a.lossBreakdown.racking += b.lossBreakdown.racking;
    a.lossBreakdown.filter += b.lossBreakdown.filter;
    a.lossBreakdown.bottling += b.lossBreakdown.bottling;
    a.lossBreakdown.kegging += b.lossBreakdown.kegging;
    a.lossBreakdown.transfer += b.lossBreakdown.transfer;
    a.lossBreakdown.pressTransfer += b.lossBreakdown.pressTransfer;
    a.lossBreakdown.adjustments += b.lossBreakdown.adjustments;

    a.packagingBreakdown.bottlingTaken += b.packagingBreakdown.bottlingTaken;
    a.packagingBreakdown.bottlingLoss += b.packagingBreakdown.bottlingLoss;
    a.packagingBreakdown.keggingTaken += b.packagingBreakdown.keggingTaken;
    a.packagingBreakdown.keggingLoss += b.packagingBreakdown.keggingLoss;

    // Cross-class aggregation
    const ccIn = b.crossClassIn.reduce((s, c) => s + c.volume, 0);
    const ccOut = b.crossClassOut.reduce((s, c) => s + c.volume, 0);
    a.crossClassIn += ccIn;
    a.crossClassOut += ccOut;
    crossClassByTaxClass[tc].in += ccIn;
    crossClassByTaxClass[tc].out += ccOut;
  }

  // Round byTaxClass values
  for (const tc of Object.keys(byTaxClass)) {
    const a = byTaxClass[tc];
    a.opening = parseFloat(a.opening.toFixed(1));
    a.production = parseFloat(a.production.toFixed(1));
    a.positiveAdj = parseFloat(a.positiveAdj.toFixed(1));
    a.packaging = parseFloat(a.packaging.toFixed(1));
    a.losses = parseFloat(a.losses.toFixed(1));
    a.sales = parseFloat(a.sales.toFixed(1));
    a.distillation = parseFloat(a.distillation.toFixed(1));
    a.ending = parseFloat(a.ending.toFixed(1));
    a.transfersIn = parseFloat(a.transfersIn.toFixed(1));
    a.transfersOut = parseFloat(a.transfersOut.toFixed(1));
    a.mergesIn = parseFloat(a.mergesIn.toFixed(1));
    a.mergesOut = parseFloat(a.mergesOut.toFixed(1));
    a.crossClassIn = parseFloat(a.crossClassIn.toFixed(1));
    a.crossClassOut = parseFloat(a.crossClassOut.toFixed(1));
    for (const k of Object.keys(a.lossBreakdown) as (keyof typeof a.lossBreakdown)[]) {
      a.lossBreakdown[k] = parseFloat(a.lossBreakdown[k].toFixed(1));
    }
    for (const k of Object.keys(a.packagingBreakdown) as (keyof typeof a.packagingBreakdown)[]) {
      a.packagingBreakdown[k] = parseFloat(a.packagingBreakdown[k].toFixed(1));
    }
  }
  for (const tc of Object.keys(crossClassByTaxClass)) {
    crossClassByTaxClass[tc].in = parseFloat(crossClassByTaxClass[tc].in.toFixed(1));
    crossClassByTaxClass[tc].out = parseFloat(crossClassByTaxClass[tc].out.toFixed(1));
  }

  return {
    batches: contributions,
    totals: roundedTotals,
    identityCheck: globalIdentity,
    lossBreakdown: {
      racking: parseFloat(aggLoss.racking.toFixed(1)),
      filter: parseFloat(aggLoss.filter.toFixed(1)),
      bottling: parseFloat(aggLoss.bottling.toFixed(1)),
      kegging: parseFloat(aggLoss.kegging.toFixed(1)),
      transfer: parseFloat(aggLoss.transfer.toFixed(1)),
      pressTransfer: parseFloat(aggLoss.pressTransfer.toFixed(1)),
      adjustments: parseFloat(aggLoss.adjustments.toFixed(1)),
    },
    crossClassByTaxClass,
    byTaxClass,
    batchesWithIdentityIssues,
    batchesWithDrift,
    batchesWithInitialAnomaly,
    vesselCapacityWarnings,
  };
}

export const ttbRouter = router({
  /**
   * Generate TTB Form 5120.17 data for a reporting period.
   *
   * Aggregates data from batches, inventory, distributions, and adjustments
   * to produce the complete form data.
   */
  generateForm512017: createRbacProcedure("read", "report")
    .input(generateForm512017Input)
    .query(async ({ input }) => {
      try {
        const { periodType, year, periodNumber } = input;
        const { startDate, endDate } = getPeriodDateRange(
          periodType,
          year,
          periodNumber
        );

        // Calculate day before start date for beginning inventory
        const dayBeforeStart = new Date(startDate);
        dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);

        // Build batch tax class map for per-class allocation
        const { map: batchTaxClassMap, config: ttbConfig } = await buildBatchTaxClassMap();

        // ============================================
        // Part I: Beginning Inventory
        // Priority: 1) Previous snapshot, 2) TTB Opening Balance, 3) Calculate
        // ============================================

        let beginningInventory: InventoryBreakdown;
        let beginningInventorySource: "snapshot" | "ttb_opening_balance" | "calculated" = "calculated";
        let beginningPommeauBulkGallons = 0;
        let beginningWineUnder16BulkGallons = 0;
        let brandyOpening = 0; // Spirits opening balance (excluded from wine beginningInventory)
        const beginningBottledByClass: Record<string, number> = {};

        // 1. Check for previous period snapshot
        // Format startDate as string for comparison
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

        // Hoisted beginning bulk variables for calculated path
        let beginningBulkLiters = 0;
        let beginningPommeauBulkLiters = 0;
        let beginningWineUnder16BulkLiters = 0;
        let beginningBrandyBulkLiters = 0;
        let begClampedLossLiters = 0;
        let begPerBatchClampedLoss = new Map<string, number>();

        if (previousSnapshot) {
          // Use previous snapshot's ending inventory (sum of all tax class columns)
          const bulkTotal =
            parseFloat(previousSnapshot.bulkHardCider || "0") +
            parseFloat(previousSnapshot.bulkWineUnder16 || "0") +
            parseFloat(previousSnapshot.bulkWine16To21 || "0") +
            parseFloat(previousSnapshot.bulkWine21To24 || "0") +
            parseFloat(previousSnapshot.bulkSparklingWine || "0") +
            parseFloat(previousSnapshot.bulkCarbonatedWine || "0");

          const bottledTotal =
            parseFloat(previousSnapshot.bottledHardCider || "0") +
            parseFloat(previousSnapshot.bottledWineUnder16 || "0") +
            parseFloat(previousSnapshot.bottledWine16To21 || "0") +
            parseFloat(previousSnapshot.bottledWine21To24 || "0") +
            parseFloat(previousSnapshot.bottledSparklingWine || "0") +
            parseFloat(previousSnapshot.bottledCarbonatedWine || "0");

          beginningInventory = {
            bulk: roundGallons(bulkTotal),
            bottled: roundGallons(bottledTotal),
            total: roundGallons(bulkTotal + bottledTotal),
          };
          beginningInventorySource = "snapshot";
          beginningPommeauBulkGallons = roundGallons(
            parseFloat(previousSnapshot.bulkWine16To21 || "0")
          );
          beginningWineUnder16BulkGallons = roundGallons(
            parseFloat(previousSnapshot.bulkWineUnder16 || "0")
          );
          // Extract spirits opening from snapshot
          brandyOpening = parseFloat(previousSnapshot.spiritsAppleBrandy || "0");
          // Extract per-class beginning bottled inventory from snapshot
          const snapshotBottled: Record<string, number> = {
            hardCider: parseFloat(previousSnapshot.bottledHardCider || "0"),
            wineUnder16: parseFloat(previousSnapshot.bottledWineUnder16 || "0"),
            wine16To21: parseFloat(previousSnapshot.bottledWine16To21 || "0"),
            wine21To24: parseFloat(previousSnapshot.bottledWine21To24 || "0"),
            sparklingWine: parseFloat(previousSnapshot.bottledSparklingWine || "0"),
            carbonatedWine: parseFloat(previousSnapshot.bottledCarbonatedWine || "0"),
          };
          for (const [cls, val] of Object.entries(snapshotBottled)) {
            const g = roundGallons(val);
            if (g > 0) beginningBottledByClass[cls] = g;
          }
        } else {
          // 2. Check for TTB Opening Balance
          const [settings] = await db
            .select({
              ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
              ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
            })
            .from(organizationSettings)
            .limit(1);

          const openingBalanceDate = settings?.ttbOpeningBalanceDate
            ? new Date(settings.ttbOpeningBalanceDate)
            : null;

          // Use TTB Opening Balance only for the first period after the opening balance date
          // (i.e., startDate is within 2 days of openingBalanceDate + 1 day)
          const dayAfterOpening = openingBalanceDate ? new Date(openingBalanceDate) : null;
          if (dayAfterOpening) dayAfterOpening.setDate(dayAfterOpening.getDate() + 2);
          const isFirstPeriod = openingBalanceDate && dayAfterOpening &&
            startDate >= openingBalanceDate && startDate <= dayAfterOpening;

          if (settings?.ttbOpeningBalances && isFirstPeriod) {
            const balances = settings.ttbOpeningBalances;

            // Sum bulk balances across all tax classes
            const bulkTotal = Object.values(balances.bulk || {}).reduce(
              (sum: number, val) => sum + (Number(val) || 0),
              0
            );

            // Sum bottled balances across all tax classes
            const bottledTotal = Object.values(balances.bottled || {}).reduce(
              (sum: number, val) => sum + (Number(val) || 0),
              0
            );

            beginningInventory = {
              bulk: roundGallons(bulkTotal),
              bottled: roundGallons(bottledTotal),
              total: roundGallons(bulkTotal + bottledTotal),
            };
            beginningInventorySource = "ttb_opening_balance";
            beginningPommeauBulkGallons = roundGallons(
              Number(balances.bulk?.wine16To21 || 0)
            );
            beginningWineUnder16BulkGallons = roundGallons(
              Number(balances.bulk?.wineUnder16 || 0)
            );
            // Extract spirits opening (not included in wine bulk/bottled totals)
            brandyOpening = Number(balances.spirits?.appleBrandy || 0);
            // Extract per-class beginning bottled inventory
            if (balances.bottled) {
              for (const [cls, val] of Object.entries(balances.bottled)) {
                const g = roundGallons(Number(val) || 0);
                if (g > 0) beginningBottledByClass[cls] = g;
              }
            }
          } else {
            // 3. Fall back to reconstructing inventory as of dayBeforeStart
            // Uses the same batched per-batch reconstruction approach as ending inventory

            // Bulk inventory: Reconstruct batch volumes as of dayBeforeStart
            const batchesAtStart = await db
              .select({
                id: batches.id,
                initialVolume: batches.initialVolumeLiters,
                productType: batches.productType,
              })
              .from(batches)
              .where(
                and(
                  isNull(batches.deletedAt),
                  sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
                  // Exclude juice batches — they are not taxable inventory
                  sql`COALESCE(${batches.productType}, 'cider') != 'juice'`,
                  lte(batches.startDate, dayBeforeStart),
                  or(isNull(batches.endDate), gte(batches.endDate, startDate)),
                  sql`NOT (${batches.status} = 'discarded' AND ${batches.updatedAt} <= ${dayBeforeStart})`
                )
              );

            // Use computeSystemCalculatedOnHand for proper per-batch reconstruction
            // (handles transfer-created batch detection, distillation status filter,
            // racking Historical Record filter, bottling loss smart detection)
            const begBatchIds = batchesAtStart.map(b => b.id);
            const begProdTypes = new Map<string, string | null>();
            for (const b of batchesAtStart) begProdTypes.set(b.id, b.productType);
            const dayBeforeStartStr = dayBeforeStart.toISOString().split("T")[0];

            if (begBatchIds.length > 0) {
              const begSbdResult = await computeSystemCalculatedOnHand(begBatchIds, dayBeforeStartStr);
              const begByClass = computePerTaxClassBulkInventory(begSbdResult.perBatch, batchTaxClassMap, begProdTypes);

              beginningBulkLiters = begByClass["hardCider"] || 0;
              beginningPommeauBulkLiters = begByClass["wine16To21"] || 0;
              beginningWineUnder16BulkLiters = begByClass["wineUnder16"] || 0;
              beginningBrandyBulkLiters = begByClass["appleBrandy"] || 0;
              begClampedLossLiters = begSbdResult.breakdown.clampedLossLiters;
              begPerBatchClampedLoss = begSbdResult.perBatchClampedLoss;
            }

            beginningPommeauBulkGallons = roundGallons(
              litersToWineGallons(beginningPommeauBulkLiters)
            );
            beginningWineUnder16BulkGallons = roundGallons(
              litersToWineGallons(beginningWineUnder16BulkLiters)
            );

            // Bottled inventory as of dayBeforeStart (batched)
            const itemsAtStart = await db
              .select({
                id: inventoryItems.id,
                packageSizeML: inventoryItems.packageSizeML,
                currentQuantity: inventoryItems.currentQuantity,
              })
              .from(inventoryItems)
              .where(
                and(
                  lte(inventoryItems.createdAt, dayBeforeStart),
                  isNull(inventoryItems.deletedAt)
                )
              );

            let beginningBottledML = 0;
            if (itemsAtStart.length > 0) {
              const begItemIds = itemsAtStart.map(i => i.id);
              const begItemIdList = sql.join(begItemIds.map(id => sql`${id}::uuid`), sql`, `);
              const [begDistsAfter, begAdjsAfter] = await Promise.all([
                db.execute(sql`SELECT inventory_item_id as item_id, COALESCE(SUM(quantity_distributed), 0) as total
                  FROM inventory_distributions WHERE inventory_item_id IN (${begItemIdList})
                  AND distribution_date > ${dayBeforeStart} GROUP BY inventory_item_id`),
                db.execute(sql`SELECT inventory_item_id as item_id, COALESCE(SUM(quantity_change), 0) as total
                  FROM inventory_adjustments WHERE inventory_item_id IN (${begItemIdList})
                  AND adjusted_at > ${dayBeforeStart} GROUP BY inventory_item_id`),
              ]);
              const begDistMap = new Map<string, number>();
              for (const r of begDistsAfter.rows) begDistMap.set(String(r["item_id"]), Number(r["total"] || 0));
              const begAdjMap = new Map<string, number>();
              for (const r of begAdjsAfter.rows) begAdjMap.set(String(r["item_id"]), Number(r["total"] || 0));

              for (const item of itemsAtStart) {
                let qty = Number(item.currentQuantity || 0);
                qty += (begDistMap.get(item.id) || 0);
                qty -= (begAdjMap.get(item.id) || 0);
                if (qty > 0) {
                  beginningBottledML += qty * Number(item.packageSizeML || 0);
                }
              }
            }

            // Kegs in stock before period start (scoped to eligible batches)
            const kegsAtStart = await db
              .select({
                totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END), 0)`,
              })
              .from(kegFills)
              .innerJoin(batches, eq(kegFills.batchId, batches.id))
              .where(
                and(
                  isNull(kegFills.voidedAt),
                  isNull(kegFills.deletedAt),
                  isNull(batches.deletedAt),
                  sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
                  lte(kegFills.filledAt, dayBeforeStart),
                  or(
                    isNull(kegFills.distributedAt),
                    sql`${kegFills.distributedAt} > ${dayBeforeStart}`
                  )
                )
              );
            const beginningKegsLiters = Number(kegsAtStart[0]?.totalLiters || 0);

            const totalBeginningBulkLiters = beginningBulkLiters + beginningPommeauBulkLiters + beginningWineUnder16BulkLiters;
            beginningInventory = {
              bulk: roundGallons(litersToWineGallons(totalBeginningBulkLiters)),
              bottled: roundGallons(
                mlToWineGallons(beginningBottledML) + litersToWineGallons(beginningKegsLiters)
              ),
              total: roundGallons(
                litersToWineGallons(totalBeginningBulkLiters) +
                  mlToWineGallons(beginningBottledML) +
                  litersToWineGallons(beginningKegsLiters)
              ),
            };
            beginningInventorySource = "calculated";

            // Use reconstructed brandy volume for spirits opening in calculated path
            if (beginningBrandyBulkLiters > 0) {
              brandyOpening = roundGallons(litersToWineGallons(beginningBrandyBulkLiters));
            }
          }
        }

        // ============================================
        // Part II: Wine/Cider Produced
        // Uses press runs + juice purchases (matching reconciliation approach)
        // This avoids double-counting transfer-child batches
        // ============================================

        const prodStartStr = startDate.toISOString().split("T")[0];
        const prodEndStr = endDate.toISOString().split("T")[0];

        // Production from press runs completed during the period
        const pressRunData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(pressRuns)
          .where(
            and(
              isNull(pressRuns.deletedAt),
              eq(pressRuns.status, "completed"),
              sql`${pressRuns.dateCompleted}::date >= ${prodStartStr}::date`,
              sql`${pressRuns.dateCompleted}::date <= ${prodEndStr}::date`
            )
          );
        const pressRunLiters = Number(pressRunData[0]?.totalLiters || 0);

        // Production from juice purchases during the period
        const juicePurchaseData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(
              CASE
                WHEN ${juicePurchaseItems.volumeUnit} = 'gal' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) * 3.78541
                ELSE CAST(${juicePurchaseItems.volume} AS DECIMAL)
              END
            ), 0)`,
          })
          .from(juicePurchaseItems)
          .innerJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
          .where(
            and(
              isNull(juicePurchases.deletedAt),
              isNull(juicePurchaseItems.deletedAt),
              sql`${juicePurchases.purchaseDate}::date >= ${prodStartStr}::date`,
              sql`${juicePurchases.purchaseDate}::date <= ${prodEndStr}::date`
            )
          );
        const juicePurchaseLiters = Number(juicePurchaseData[0]?.totalLiters || 0);

        // Exclude juice that was never fermented (product_type = 'juice')
        const juiceOnlyData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              // Note: do NOT filter by deletedAt here — deleted juice batches (e.g. Melrose)
              // still represent real juice diversions whose press run volume is in pressRunLiters
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              eq(batches.productType, "juice"),
              gte(batches.startDate, startDate),
              lte(batches.startDate, endDate)
            )
          );
        const juiceOnlyLiters = Number(juiceOnlyData[0]?.totalLiters || 0);

        // Exclude transfers INTO juice batches
        const xferIntoJuiceData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
          })
          .from(batchTransfers)
          .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
          .where(
            and(
              isNull(batchTransfers.deletedAt),
              eq(batches.productType, "juice"),
              gte(batchTransfers.transferredAt, startDate),
              lte(batchTransfers.transferredAt, endDate)
            )
          );
        const xferIntoJuiceLiters = Number(xferIntoJuiceData[0]?.totalLiters || 0);

        // Juice component of pommeau batches created with initial > 0 in the period.
        // These batches were created directly (e.g. Salish #1: brandy + juice composed at
        // batch creation, with no active transfer records). The juice portion is computed
        // from ABV: juice_liters = initial × (1 - pommeau_abv / brandy_abv).
        // Brandy ABV defaults to 70% (standard apple brandy).
        const BRANDY_ABV = 0.70;
        const pommeauWithInitialData = await db
          .select({
            initialLiters: sql<number>`CAST(${batches.initialVolumeLiters} AS DECIMAL)`,
            abv: sql<number>`COALESCE(${batches.actualAbv}, ${batches.estimatedAbv}, 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              eq(batches.productType, "pommeau"),
              sql`CAST(${batches.initialVolumeLiters} AS DECIMAL) > 0`,
              gte(batches.startDate, startDate),
              lte(batches.startDate, endDate)
            )
          );
        let juiceToPommeauLiters = 0;
        let brandyToPommeauLiters = 0;
        for (const row of pommeauWithInitialData) {
          const initial = Number(row.initialLiters) || 0;
          const abv = (Number(row.abv) || 0) / 100; // stored as percentage, e.g. 18.00
          if (initial > 0 && abv > 0 && abv < BRANDY_ABV) {
            juiceToPommeauLiters += initial * (1 - abv / BRANDY_ABV);
            brandyToPommeauLiters += initial * (abv / BRANDY_ABV);
          }
        }

        // Non-brandy transfers into NEW pommeau batches created in the period.
        // These represent juice/cider that was essentially unfermented when blended
        // with brandy — treated as juice diversion from HC production.
        // Only count transfers to pommeau batches created in the period (start_date in range).
        // Transfers to existing pommeau batches (from prior periods) are change-of-class,
        // not production deductions.
        const nonBrandyToPommeauData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
          })
          .from(batchTransfers)
          .innerJoin(
            sql`${batches} AS source_batch`,
            sql`${batchTransfers.sourceBatchId} = source_batch.id`
          )
          .innerJoin(
            sql`${batches} AS dest_batch`,
            sql`${batchTransfers.destinationBatchId} = dest_batch.id`
          )
          .where(
            and(
              isNull(batchTransfers.deletedAt),
              sql`dest_batch.product_type = 'pommeau'`,
              sql`dest_batch.deleted_at IS NULL`,
              // Only new pommeau batches created in the period
              sql`dest_batch.start_date >= ${startDate}`,
              sql`dest_batch.start_date <= ${endDate}`,
              // Exclude brandy and pommeau-to-pommeau transfers (racking between pommeau vessels)
              sql`source_batch.product_type NOT IN ('brandy', 'pommeau')`,
              gte(batchTransfers.transferredAt, startDate),
              lte(batchTransfers.transferredAt, endDate)
            )
          );
        juiceToPommeauLiters += Number(nonBrandyToPommeauData[0]?.totalLiters || 0);

        const totalProductionLiters = pressRunLiters + juicePurchaseLiters - juiceOnlyLiters - xferIntoJuiceLiters - juiceToPommeauLiters;
        const wineProducedGallons = roundGallons(litersToWineGallons(totalProductionLiters));

        // Pommeau production for per-tax-class display (produced by wine spirits, not fermented)
        // Two data patterns for pommeau batches:
        //   1) Composed at creation: initialVolumeLiters > 0 (e.g. Salish #1: 225L)
        //   2) Built via transfers: initialVolumeLiters = 0, volume from batch_transfers (e.g. Salish #2)
        // Sum both to get total pommeau produced.
        const pommeauWithInitialSum = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              eq(batches.productType, "pommeau"),
              // Exclude racking derivatives — they duplicate volume from original pommeau batches
              or(
                isNull(batches.parentBatchId),
                eq(batches.isRackingDerivative, false)
              ),
              sql`CAST(${batches.initialVolumeLiters} AS DECIMAL) > 0`,
              gte(batches.startDate, startDate),
              lte(batches.startDate, endDate)
            )
          );
        // Pommeau batches built via transfers (initial = 0): sum incoming transfers as production
        // Exclude pommeau-to-pommeau transfers (internal racking between pommeau vessels)
        const pommeauTransferBuilt = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
          })
          .from(batchTransfers)
          .innerJoin(
            sql`${batches} AS dest_batch`,
            sql`${batchTransfers.destinationBatchId} = dest_batch.id`
          )
          .innerJoin(
            sql`${batches} AS source_batch`,
            sql`${batchTransfers.sourceBatchId} = source_batch.id`
          )
          .where(
            and(
              isNull(batchTransfers.deletedAt),
              sql`dest_batch.product_type = 'pommeau'`,
              sql`dest_batch.deleted_at IS NULL`,
              sql`COALESCE(dest_batch.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')`,
              sql`CAST(dest_batch.initial_volume_liters AS DECIMAL) = 0`,
              // Only count transfers to pommeau batches created in this period
              sql`dest_batch.start_date >= ${startDate}`,
              sql`dest_batch.start_date <= ${endDate}`,
              sql`source_batch.product_type != 'pommeau'`,
              gte(batchTransfers.transferredAt, startDate),
              lte(batchTransfers.transferredAt, endDate)
            )
          );
        const pommeauProducedLiters = Number(pommeauWithInitialSum[0]?.totalLiters || 0) +
          Number(pommeauTransferBuilt[0]?.totalLiters || 0);
        const pommeauProducedGallons = roundGallons(
          litersToWineGallons(pommeauProducedLiters)
        );

        // Fruit wine production (plum, quince, etc.) — batches with productType='wine'
        // These are produced by fermentation and should go on wineUnder16 line 2,
        // not hardCider. Their initial volume may come from press runs (quince)
        // or juice purchases (plum), but the tax class is wine, not cider.
        const fruitWineProductionData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              eq(batches.productType, "wine"),
              // Exclude transfer-derived batches (racking, blending) — only count
              // primary fermentation batches to avoid double-counting
              or(
                isNull(batches.parentBatchId),
                eq(batches.isRackingDerivative, false)
              ),
              gte(batches.startDate, startDate),
              lte(batches.startDate, endDate)
            )
          );
        const fruitWineProducedLiters = Number(fruitWineProductionData[0]?.totalLiters || 0);
        const fruitWineProducedGallons = roundGallons(
          litersToWineGallons(fruitWineProducedLiters)
        );

        // HC production = total fermentation production minus fruit wine production
        // (fruit wine production is already counted in press runs / juice purchases total)
        const ciderProducedGallons = roundGallons(wineProducedGallons - fruitWineProducedGallons);

        // ============================================
        // Part III: Tax-Paid Removals by Channel
        // ============================================

        // Bottle distributions — use bottle_runs (authoritative source) not inventory_distributions (incomplete)
        const distributionsByChannel = await db
          .select({
            channelCode: salesChannels.code,
            totalLiters: sql<number>`COALESCE(SUM(
              ${bottleRuns.volumeTakenLiters}::numeric -
              CASE WHEN ${bottleRuns.lossUnit} = 'gal'
                THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
                ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
            ), 0)`,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .leftJoin(
            salesChannels,
            eq(bottleRuns.bottleRunSalesChannelId, salesChannels.id)
          )
          .where(
            and(
              isNull(bottleRuns.voidedAt),
              isNull(batches.deletedAt),
              sql`${bottleRuns.status} IN ('distributed', 'completed')`,
              gte(bottleRuns.distributedAt, startDate),
              lte(bottleRuns.distributedAt, endDate)
            )
          )
          .groupBy(salesChannels.code);

        // Keg distributions - tax-paid when keg leaves bonded space (distributed_at is set)
        // Note: status may be "distributed" or "returned" - both count as tax-paid since the keg left
        // Note: Do NOT filter by reconciliationStatus — distributions are physically real regardless
        const kegDistributionsByChannel = await db
          .select({
            channelCode: salesChannels.code,
            totalLiters: sql<number>`COALESCE(SUM(
              (CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END)
              - (CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END)
            ), 0)`,
          })
          .from(kegFills)
          .innerJoin(batches, eq(kegFills.batchId, batches.id))
          .leftJoin(
            salesChannels,
            eq(kegFills.salesChannelId, salesChannels.id)
          )
          .where(
            and(
              isNotNull(kegFills.distributedAt),
              isNull(kegFills.voidedAt),
              isNull(kegFills.deletedAt),
              isNull(batches.deletedAt),
              gte(kegFills.distributedAt, startDate),
              lte(kegFills.distributedAt, endDate)
            )
          )
          .groupBy(salesChannels.code);

        // Aggregate by channel — track bottle/can and keg distributions separately
        const channelTotals: Record<string, number> = {
          tasting_room: 0,
          wholesale: 0,
          online_dtc: 0,
          events: 0,
          uncategorized: 0,
        };

        let bottleTaxPaidGallons = 0;
        let kegTaxPaidGallons = 0;

        // Add bottle/can distributions
        for (const row of distributionsByChannel) {
          const channel = row.channelCode || "uncategorized";
          const gallons = litersToWineGallons(Number(row.totalLiters || 0));
          bottleTaxPaidGallons += gallons;
          if (channel in channelTotals) {
            channelTotals[channel] += gallons;
          } else {
            channelTotals.uncategorized += gallons;
          }
        }

        // Add keg distributions
        for (const row of kegDistributionsByChannel) {
          const channel = row.channelCode || "uncategorized";
          const gallons = litersToWineGallons(Number(row.totalLiters || 0));
          kegTaxPaidGallons += gallons;
          if (channel in channelTotals) {
            channelTotals[channel] += gallons;
          } else {
            channelTotals.uncategorized += gallons;
          }
        }

        const taxPaidRemovals: TaxPaidRemovals = {
          tastingRoom: roundGallons(channelTotals.tasting_room),
          wholesale: roundGallons(channelTotals.wholesale),
          onlineDtc: roundGallons(channelTotals.online_dtc),
          events: roundGallons(channelTotals.events),
          uncategorized: roundGallons(channelTotals.uncategorized),
          total: roundGallons(
            Object.values(channelTotals).reduce((a, b) => a + b, 0)
          ),
        };
        bottleTaxPaidGallons = roundGallons(bottleTaxPaidGallons);
        kegTaxPaidGallons = roundGallons(kegTaxPaidGallons);

        // ============================================
        // Part IV: Other Removals
        // ============================================

        // Inventory adjustments (samples, breakage)
        const adjustmentsByType = await db
          .select({
            adjustmentType: inventoryAdjustments.adjustmentType,
            totalML: sql<number>`COALESCE(SUM(
              ABS(CAST(${inventoryAdjustments.quantityChange} AS DECIMAL)) *
              CAST(${inventoryItems.packageSizeML} AS DECIMAL)
            ), 0)`,
          })
          .from(inventoryAdjustments)
          .innerJoin(
            inventoryItems,
            eq(inventoryAdjustments.inventoryItemId, inventoryItems.id)
          )
          .innerJoin(
            bottleRuns,
            eq(inventoryItems.bottleRunId, bottleRuns.id)
          )
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(
            and(
              isNull(inventoryItems.deletedAt),
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              gte(inventoryAdjustments.adjustedAt, startDate),
              lte(inventoryAdjustments.adjustedAt, endDate),
              sql`${inventoryAdjustments.quantityChange} < 0` // Only removals
            )
          )
          .groupBy(inventoryAdjustments.adjustmentType);

        let samplesGallons = 0;
        let breakageGallons = 0;

        for (const row of adjustmentsByType) {
          const gallons = mlToWineGallons(Number(row.totalML || 0));
          if (row.adjustmentType === "sample") {
            samplesGallons += gallons;
          } else if (row.adjustmentType === "breakage") {
            breakageGallons += gallons;
          }
        }

        // Process losses (filtering, racking, bottling, transfers, adjustments, kegging)
        // NOTE: Do NOT filter by reconciliationStatus — losses from excluded/duplicate batches
        // are physically real (volume was lost). Same principle as packaging and distributions.
        // Grouped by batchId to enable per-tax-class column allocation
        const lossesByTaxClass: Record<string, number> = {};
        function accumulateLoss(rows: { batchId: string; totalLiters: number }[]): number {
          let total = 0;
          for (const row of rows) {
            const liters = Number(row.totalLiters);
            total += liters;
            const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
            lossesByTaxClass[taxClass] = (lossesByTaxClass[taxClass] || 0) + litersToWineGallons(liters);
          }
          return total;
        }

        const filterLosses = await db
          .select({
            batchId: batchFilterOperations.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
          })
          .from(batchFilterOperations)
          .innerJoin(batches, eq(batchFilterOperations.batchId, batches.id))
          .where(
            and(
              isNull(batchFilterOperations.deletedAt),
              isNull(batches.deletedAt),
              gte(batchFilterOperations.filteredAt, startDate),
              lte(batchFilterOperations.filteredAt, endDate)
            )
          )
          .groupBy(batchFilterOperations.batchId);

        const rackingLosses = await db
          .select({
            batchId: batchRackingOperations.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
          })
          .from(batchRackingOperations)
          .innerJoin(batches, eq(batchRackingOperations.batchId, batches.id))
          .where(
            and(
              isNull(batchRackingOperations.deletedAt),
              isNull(batches.deletedAt),
              gte(batchRackingOperations.rackedAt, startDate),
              lte(batchRackingOperations.rackedAt, endDate),
              sql`(${batchRackingOperations.notes} IS NULL OR ${batchRackingOperations.notes} NOT LIKE '%Historical Record%')`
            )
          )
          .groupBy(batchRackingOperations.batchId);

        const bottlingLosses = await db
          .select({
            batchId: bottleRuns.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${bottleRuns.lossUnit} = 'gal' THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END), 0)`,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(
            and(
              isNull(bottleRuns.voidedAt),
              isNull(batches.deletedAt),
              gte(bottleRuns.packagedAt, startDate),
              lte(bottleRuns.packagedAt, endDate)
            )
          )
          .groupBy(bottleRuns.batchId);

        // Transfer losses — join on source batch
        const transferLosses = await db
          .select({
            batchId: batchTransfers.sourceBatchId,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.loss} AS DECIMAL)), 0)`,
          })
          .from(batchTransfers)
          .innerJoin(batches, eq(batchTransfers.sourceBatchId, batches.id))
          .where(
            and(
              isNull(batchTransfers.deletedAt),
              isNull(batches.deletedAt),
              gte(batchTransfers.transferredAt, startDate),
              lte(batchTransfers.transferredAt, endDate)
            )
          )
          .groupBy(batchTransfers.sourceBatchId);

        const volumeAdjustmentLosses = await db
          .select({
            batchId: batchVolumeAdjustments.batchId,
            totalLiters: sql<number>`COALESCE(SUM(ABS(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL))), 0)`,
          })
          .from(batchVolumeAdjustments)
          .innerJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
          .where(
            and(
              isNull(batchVolumeAdjustments.deletedAt),
              isNull(batches.deletedAt),
              sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) < 0`,
              gte(batchVolumeAdjustments.adjustmentDate, startDate),
              lte(batchVolumeAdjustments.adjustmentDate, endDate)
            )
          )
          .groupBy(batchVolumeAdjustments.batchId);

        const kegFillLosses = await db
          .select({
            batchId: kegFills.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END), 0)`,
          })
          .from(kegFills)
          .innerJoin(batches, eq(kegFills.batchId, batches.id))
          .where(
            and(
              isNull(kegFills.voidedAt),
              isNull(kegFills.deletedAt),
              isNull(batches.deletedAt),
              gte(kegFills.filledAt, startDate),
              lte(kegFills.filledAt, endDate)
            )
          )
          .groupBy(kegFills.batchId);

        // Press-to-vessel transfer losses
        // Production uses gross press run volume (totalJuiceVolumeLiters),
        // but batch initialVolumeLiters = gross - transferLossL.
        // This loss must be counted to balance gross production against net initials.
        const pressTransferLosses = await db
          .select({
            batchId: batches.id,
            totalLiters: sql<number>`COALESCE(CAST(${batches.transferLossL} AS DECIMAL), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              isNotNull(batches.transferLossL),
              sql`CAST(${batches.transferLossL} AS DECIMAL) > 0`,
              gte(batches.startDate, startDate),
              lte(batches.startDate, endDate)
            )
          );

        // Accumulate bottling/kegging losses separately for Line 30 (inventory losses)
        // These are subtracted from Line 13 (net packaging) and shown on Line 30
        const bottlingLossByTaxClass: Record<string, number> = {};
        function accumulateBottlingLoss(rows: { batchId: string; totalLiters: number }[]): void {
          for (const row of rows) {
            const liters = Number(row.totalLiters);
            const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
            bottlingLossByTaxClass[taxClass] = (bottlingLossByTaxClass[taxClass] || 0) + litersToWineGallons(liters);
          }
        }
        accumulateBottlingLoss(bottlingLosses);
        accumulateBottlingLoss(kegFillLosses);

        // Accumulate totals and per-tax-class breakdown from per-batch results
        const processLossesLiters =
          accumulateLoss(filterLosses) +
          accumulateLoss(rackingLosses) +
          accumulateLoss(bottlingLosses) +
          accumulateLoss(transferLosses) +
          accumulateLoss(volumeAdjustmentLosses) +
          accumulateLoss(kegFillLosses) +
          accumulateLoss(pressTransferLosses);

        const otherRemovals: OtherRemovals = {
          samples: roundGallons(samplesGallons),
          breakage: roundGallons(breakageGallons),
          processLosses: roundGallons(litersToWineGallons(processLossesLiters)),
          spoilage: 0,
          total: roundGallons(
            samplesGallons +
              breakageGallons +
              litersToWineGallons(processLossesLiters)
          ),
        };

        // ============================================
        // Part V: Ending Inventory (AS OF period end date)
        // ============================================

        // Bulk inventory: Calculate batch volumes AS OF the period end date
        // This uses transaction history rather than current volumes

        // Get all batches that existed on or before the end date
        const batchesAtEnd = await db
          .select({
            id: batches.id,
            initialVolume: batches.initialVolumeLiters,
            currentVolume: batches.currentVolumeLiters,
            startDate: batches.startDate,
            status: batches.status,
            productType: batches.productType,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              // Exclude juice batches — they are not taxable inventory
              sql`COALESCE(${batches.productType}, 'cider') != 'juice'`,
              lte(batches.startDate, endDate),
              // Exclude batches that ended before the period end
              or(isNull(batches.endDate), gte(batches.endDate, endDate)),
              // Exclude discarded/completed batches that were finished before endDate
              // (they would have 0 volume at endDate)
              sql`NOT (${batches.status} = 'discarded' AND ${batches.updatedAt} <= ${endDate})`
            )
          );

        // Use computeSystemCalculatedOnHand for proper per-batch reconstruction
        // (handles transfer-created batch detection, distillation status filter,
        // racking Historical Record filter, bottling loss smart detection)
        const endBatchIds = batchesAtEnd.map(b => b.id);
        const endProductTypes = new Map<string, string | null>();
        for (const b of batchesAtEnd) endProductTypes.set(b.id, b.productType);
        const endDateStr = endDate.toISOString().split("T")[0];

        // For past years, use SBD reconstruction at period end date so that
        // ending inventory matches the next year's opening inventory exactly.
        // For the current year, use live currentVolumeLiters (reflects current state).
        const isPastYear = endDate < new Date();

        let endingBulkLiters = 0;
        let endingPommeauBulkLiters = 0;
        let endingWineUnder16BulkLiters = 0;
        let endingBrandyBulkLiters = 0;

        // SBD is always needed for clamped loss calculation (form balancing)
        // and for past years it's also used for ending inventory
        let endClampedLossLiters = 0;
        const clampedByTaxClass: Record<string, number> = {};
        if (endBatchIds.length > 0) {
          const endSbdResult = await computeSystemCalculatedOnHand(endBatchIds, endDateStr);

          if (isPastYear) {
            // Past year: use SBD reconstruction at endDate for consistency with next year's opening
            const endByClass = computePerTaxClassBulkInventory(endSbdResult.perBatch, batchTaxClassMap, endProductTypes);
            endingBulkLiters = endByClass["hardCider"] || 0;
            endingPommeauBulkLiters = endByClass["wine16To21"] || 0;
            endingWineUnder16BulkLiters = endByClass["wineUnder16"] || 0;
            endingBrandyBulkLiters = endByClass["appleBrandy"] || 0;
          } else {
            // Current year: use live currentVolumeLiters (reflects physical inventory now)
            const endingLiveByClass: Record<string, number> = {};
            for (const b of batchesAtEnd) {
              const vol = Number(b.currentVolume) || 0;
              if (vol <= 0) continue;
              const taxClass = getTaxClassFromMap(batchTaxClassMap, b.id, b.productType ?? null);
              if (!taxClass) continue;
              endingLiveByClass[taxClass] = (endingLiveByClass[taxClass] || 0) + vol;
            }
            endingBulkLiters = endingLiveByClass["hardCider"] || 0;
            endingPommeauBulkLiters = endingLiveByClass["wine16To21"] || 0;
            endingWineUnder16BulkLiters = endingLiveByClass["wineUnder16"] || 0;
            endingBrandyBulkLiters = endingLiveByClass["appleBrandy"] || 0;
          }
          endClampedLossLiters = endSbdResult.breakdown.clampedLossLiters;

          // Compute per-tax-class clamped loss for per-column loss allocation
          for (const [batchId, clampedLiters] of endSbdResult.perBatchClampedLoss) {
            const taxClass = getTaxClassFromMap(batchTaxClassMap, batchId, null) || "hardCider";
            clampedByTaxClass[taxClass] = (clampedByTaxClass[taxClass] || 0) + litersToWineGallons(clampedLiters);
          }
          for (const [batchId, clampedLiters] of begPerBatchClampedLoss) {
            const taxClass = getTaxClassFromMap(batchTaxClassMap, batchId, null) || "hardCider";
            clampedByTaxClass[taxClass] = (clampedByTaxClass[taxClass] || 0) - litersToWineGallons(clampedLiters);
          }
          for (const key of Object.keys(clampedByTaxClass)) {
            clampedByTaxClass[key] = roundGallons(Math.max(0, clampedByTaxClass[key]));
          }
        }

        // Period-specific clamped loss: adjust process losses so the form balances
        // (line 12 = line 32). Clamped loss represents over-recorded losses on batches
        // that reconstructed to negative volume. SBD clamps these to 0, so we subtract
        // the excess from aggregate losses to maintain the accounting identity.
        const periodClampedLossLiters = endClampedLossLiters - begClampedLossLiters;
        if (periodClampedLossLiters > 0) {
          const clampedGallons = roundGallons(litersToWineGallons(periodClampedLossLiters));
          otherRemovals.processLosses = roundGallons(otherRemovals.processLosses - clampedGallons);
          otherRemovals.total = roundGallons(otherRemovals.total - clampedGallons);
        }

        // Bottled inventory AS OF period end date
        // Uses batched queries instead of per-item N+1 pattern
        // Include batchId for per-tax-class breakdown
        const itemsCreatedByEndDate = await db
          .select({
            id: inventoryItems.id,
            batchId: inventoryItems.batchId,
            packageSizeML: inventoryItems.packageSizeML,
            currentQuantity: inventoryItems.currentQuantity,
          })
          .from(inventoryItems)
          .where(
            and(
              lte(inventoryItems.createdAt, endDate),
              isNull(inventoryItems.deletedAt)
            )
          );

        let endingBottledML = 0;
        const endingBottledMLByClass: Record<string, number> = {};

        if (itemsCreatedByEndDate.length > 0) {
          const itemIds = itemsCreatedByEndDate.map(i => i.id);
          const itemIdList = sql.join(itemIds.map(id => sql`${id}::uuid`), sql`, `);

          const [distsAfterEnd, adjsAfterEnd] = await Promise.all([
            db.execute(sql`SELECT inventory_item_id as item_id, COALESCE(SUM(quantity_distributed), 0) as total
              FROM inventory_distributions WHERE inventory_item_id IN (${itemIdList})
              AND distribution_date > ${endDate} GROUP BY inventory_item_id`),
            db.execute(sql`SELECT inventory_item_id as item_id, COALESCE(SUM(quantity_change), 0) as total
              FROM inventory_adjustments WHERE inventory_item_id IN (${itemIdList})
              AND adjusted_at > ${endDate} GROUP BY inventory_item_id`),
          ]);

          const makeItemMap = (rows: Record<string, unknown>[]) => {
            const m = new Map<string, number>();
            for (const r of rows) m.set(String(r["item_id"]), Number(r["total"] || 0));
            return m;
          };

          const distAfterMap = makeItemMap(distsAfterEnd.rows);
          const adjAfterMap = makeItemMap(adjsAfterEnd.rows);

          for (const item of itemsCreatedByEndDate) {
            let qty = Number(item.currentQuantity || 0);
            qty += (distAfterMap.get(item.id) || 0); // Reverse distributions after endDate
            qty -= (adjAfterMap.get(item.id) || 0); // Reverse adjustments after endDate
            if (qty > 0) {
              const itemML = qty * Number(item.packageSizeML || 0);
              endingBottledML += itemML;
              const taxClass = getTaxClassFromMap(batchTaxClassMap, item.batchId, null) || "hardCider";
              endingBottledMLByClass[taxClass] = (endingBottledMLByClass[taxClass] || 0) + itemML;
            }
          }
        }

        // Kegs in stock at period end (scoped to eligible batches), grouped by batch for per-class tracking
        const kegsInStockByBatch = await db
          .select({
            batchId: kegFills.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END), 0)`,
          })
          .from(kegFills)
          .innerJoin(batches, eq(kegFills.batchId, batches.id))
          .where(
            and(
              isNull(kegFills.voidedAt),
              isNull(kegFills.deletedAt),
              isNull(batches.deletedAt),
              // Do NOT filter by reconciliationStatus — kegs from duplicate/excluded batches
              // still physically exist in inventory and must be counted
              lte(kegFills.filledAt, endDate),
              or(
                isNull(kegFills.distributedAt),
                sql`${kegFills.distributedAt} > ${endDate}`
              )
            )
          )
          .groupBy(kegFills.batchId);
        let kegsInStockLiters = 0;
        const kegsInStockLitersByClass: Record<string, number> = {};
        for (const row of kegsInStockByBatch) {
          const liters = Number(row.totalLiters || 0);
          kegsInStockLiters += liters;
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
          kegsInStockLitersByClass[taxClass] = (kegsInStockLitersByClass[taxClass] || 0) + liters;
        }

        // Undistributed bottle runs with no positive inventory items (orphan packaged product)
        // These represent bottled product that hasn't been inventoried at item level
        const orphanBottleRunsByBatch = await db
          .select({
            batchId: bottleRuns.batchId,
            totalLiters: sql<number>`COALESCE(SUM(
              ${bottleRuns.volumeTakenLiters}::numeric -
              CASE WHEN ${bottleRuns.lossUnit} = 'gal'
                THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
                ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
            ), 0)`,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(
            and(
              isNull(bottleRuns.voidedAt),
              isNull(batches.deletedAt),
              lte(bottleRuns.packagedAt, endDate),
              or(
                isNull(bottleRuns.distributedAt),
                sql`${bottleRuns.distributedAt} > ${endDate}`
              ),
              sql`NOT EXISTS (
                SELECT 1 FROM inventory_items ii
                WHERE ii.batch_id = ${bottleRuns.batchId}
                  AND ii.deleted_at IS NULL
                  AND ii.current_quantity > 0
              )`
            )
          )
          .groupBy(bottleRuns.batchId);

        let orphanBottleLiters = 0;
        const orphanBottleLitersByClass: Record<string, number> = {};
        for (const row of orphanBottleRunsByBatch) {
          const liters = Number(row.totalLiters || 0);
          if (liters <= 0) continue;
          orphanBottleLiters += liters;
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
          orphanBottleLitersByClass[taxClass] = (orphanBottleLitersByClass[taxClass] || 0) + liters;
        }

        const endingPommeauBulkGallons = roundGallons(litersToWineGallons(endingPommeauBulkLiters));
        const endingWineUnder16BulkGallons = roundGallons(litersToWineGallons(endingWineUnder16BulkLiters));
        const endingCiderBulkGallons = roundGallons(litersToWineGallons(endingBulkLiters));
        const endingBottledGallons = roundGallons(
          mlToWineGallons(endingBottledML) + litersToWineGallons(kegsInStockLiters + orphanBottleLiters)
        );

        // Compute ending bottled per tax class (bottle/can inventory + kegs + orphan bottle runs)
        const endingBottledByClass: Record<string, number> = {};
        const allBottledClasses = new Set([
          ...Object.keys(endingBottledMLByClass),
          ...Object.keys(kegsInStockLitersByClass),
          ...Object.keys(orphanBottleLitersByClass),
        ]);
        for (const cls of allBottledClasses) {
          const bottleML = endingBottledMLByClass[cls] || 0;
          const kegL = kegsInStockLitersByClass[cls] || 0;
          const orphanL = orphanBottleLitersByClass[cls] || 0;
          endingBottledByClass[cls] = roundGallons(mlToWineGallons(bottleML) + litersToWineGallons(kegL + orphanL));
        }

        const endingInventory: InventoryBreakdown = {
          bulk: roundGallons(endingCiderBulkGallons + endingPommeauBulkGallons + endingWineUnder16BulkGallons),
          bottled: endingBottledGallons,
          total: roundGallons(
            endingCiderBulkGallons + endingPommeauBulkGallons + endingWineUnder16BulkGallons +
              endingBottledGallons
          ),
        };

        // ============================================
        // Tax Calculation
        // ============================================

        const taxSummary = calculateHardCiderTax(taxPaidRemovals.total);

        // ============================================
        // Distillation volume (needed for reconciliation)
        // ============================================

        const ciderToDspByBatch = await db
          .select({
            batchId: distillationRecords.sourceBatchId,
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
          )
          .groupBy(distillationRecords.sourceBatchId);

        let ciderSentToDspLiters = 0;
        let ciderSentShipments = 0;
        const distillationByTaxClass: Record<string, number> = {};
        for (const row of ciderToDspByBatch) {
          const liters = Number(row.totalLiters);
          ciderSentToDspLiters += liters;
          ciderSentShipments += Number(row.shipmentCount);
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
          distillationByTaxClass[taxClass] = (distillationByTaxClass[taxClass] || 0) + litersToWineGallons(liters);
        }
        const ciderSentToDspGallons = roundGallons(litersToWineGallons(ciderSentToDspLiters));

        // ============================================
        // Positive Volume Adjustments (gains that increase inventory)
        // These are included in ending inventory via per-batch reconstruction
        // but must also be counted on the available side for the formula to balance
        // ============================================

        const positiveAdjByBatch = await db
          .select({
            batchId: batchVolumeAdjustments.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL)), 0)`,
          })
          .from(batchVolumeAdjustments)
          .innerJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
          .where(
            and(
              isNull(batchVolumeAdjustments.deletedAt),
              isNull(batches.deletedAt),
              sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) > 0`,
              // Exclude internal reconciliation corrections — these are accounting fixes,
              // not physical wine gains, and should not appear on TTB Line 9.
              sql`COALESCE(${batchVolumeAdjustments.reason}, '') NOT ILIKE '%reconciliation%'`,
              gte(batchVolumeAdjustments.adjustmentDate, startDate),
              lte(batchVolumeAdjustments.adjustmentDate, endDate)
            )
          )
          .groupBy(batchVolumeAdjustments.batchId);

        let positiveAdjLiters = 0;
        const gainsByTaxClass: Record<string, number> = {};
        for (const row of positiveAdjByBatch) {
          const liters = Number(row.totalLiters);
          positiveAdjLiters += liters;
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
          gainsByTaxClass[taxClass] = (gainsByTaxClass[taxClass] || 0) + litersToWineGallons(liters);
        }
        const positiveAdjustmentGallons = roundGallons(litersToWineGallons(positiveAdjLiters));

        // Positive bottled inventory adjustments (e.g., count corrections, returns)
        // These increase ending bottled inventory but must also be on the available side
        const positiveBottledAdjustments = await db.execute(sql`
          SELECT COALESCE(SUM(
            ia.quantity_change * CAST(ii.package_size_ml AS DECIMAL)
          ), 0) as total_ml
          FROM inventory_adjustments ia
          JOIN inventory_items ii ON ii.id = ia.inventory_item_id
          WHERE ia.quantity_change > 0
            AND ia.adjusted_at >= ${startDate}
            AND ia.adjusted_at <= ${endDate}
        `);
        const positiveBottledAdjGallons = roundGallons(
          mlToWineGallons(Number(positiveBottledAdjustments.rows[0]?.total_ml || 0))
        );

        // Negative bottled inventory adjustments (count corrections down, damage write-offs)
        // These decrease ending bottled inventory and appear as inventory shortage
        const negativeBottledAdjustments = await db.execute(sql`
          SELECT COALESCE(SUM(
            ABS(ia.quantity_change) * CAST(ii.package_size_ml AS DECIMAL)
          ), 0) as total_ml
          FROM inventory_adjustments ia
          JOIN inventory_items ii ON ii.id = ia.inventory_item_id
          WHERE ia.quantity_change < 0
            AND ia.adjusted_at >= ${startDate}
            AND ia.adjusted_at <= ${endDate}
        `);
        const negativeBottledAdjGallons = roundGallons(
          mlToWineGallons(Number(negativeBottledAdjustments.rows[0]?.total_ml || 0))
        );

        // ============================================
        // Brandy received from distillery (needed before reconciliation)
        // ============================================
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

        const brandyReceivedGallons = roundGallons(
          litersToWineGallons(Number(brandyFromDsp[0]?.totalLiters || 0))
        );
        const brandyReceivedReturns = Number(brandyFromDsp[0]?.returnCount || 0);

        // ============================================
        // Per-Tax-Class Tax-Paid Removals
        // Split keg and bottle distributions by batch tax class
        // ============================================

        // Keg distributions by batch — net volume (volumeTaken - loss)
        // Do NOT filter by reconciliation_status — distributions are physically real regardless
        const kegDistsByBatch = await db.execute(sql`
          SELECT kf.batch_id, COALESCE(SUM(
            (CASE WHEN kf.volume_taken_unit = 'gal' THEN COALESCE(kf.volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(kf.volume_taken::numeric, 0) END)
            - (CASE WHEN kf.loss_unit = 'gal' THEN COALESCE(kf.loss::numeric, 0) * 3.78541 ELSE COALESCE(kf.loss::numeric, 0) END)
          ), 0) as total_liters
          FROM keg_fills kf
          INNER JOIN batches b ON kf.batch_id = b.id
          WHERE kf.distributed_at IS NOT NULL
            AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
            AND b.deleted_at IS NULL
            AND kf.distributed_at >= ${startDate} AND kf.distributed_at <= ${endDate}
          GROUP BY kf.batch_id
        `);

        // Bottle distributions by batch — use bottle_runs (authoritative), not inventory_distributions
        // Do NOT filter by reconciliation_status — distributions are physically real regardless
        const bottleDistsByBatch = await db.execute(sql`
          SELECT br.batch_id, COALESCE(SUM(
            br.volume_taken_liters::numeric -
            CASE WHEN br.loss_unit = 'gal'
              THEN COALESCE(br.loss::numeric, 0) * 3.78541
              ELSE COALESCE(br.loss::numeric, 0) END
          ), 0) as total_liters
          FROM bottle_runs br
          INNER JOIN batches b ON br.batch_id = b.id
          WHERE br.voided_at IS NULL
            AND b.deleted_at IS NULL
            AND br.status IN ('distributed', 'completed')
            AND br.distributed_at >= ${startDate} AND br.distributed_at <= ${endDate}
          GROUP BY br.batch_id
        `);

        // Aggregate removals by tax class for tax computation
        const removalsByTaxClass: Record<string, number> = {};
        for (const row of kegDistsByBatch.rows) {
          const batchId = String(row["batch_id"]);
          const gallons = litersToWineGallons(Number(row["total_liters"] || 0));
          const taxClass = getTaxClassFromMap(batchTaxClassMap, batchId, null) || "hardCider";
          removalsByTaxClass[taxClass] = (removalsByTaxClass[taxClass] || 0) + gallons;
        }
        for (const row of bottleDistsByBatch.rows) {
          const batchId = String(row["batch_id"]);
          const gallons = litersToWineGallons(Number(row["total_liters"] || 0));
          const taxClass = getTaxClassFromMap(batchTaxClassMap, batchId, null) || "hardCider";
          removalsByTaxClass[taxClass] = (removalsByTaxClass[taxClass] || 0) + gallons;
        }

        // Build per-class tax computation
        const taxClassLabels: Record<string, string> = {
          hardCider: "Hard Cider (Under 8.5% ABV)",
          wineUnder16: "Still Wine (Not Over 16%)",
          wine16To21: "Still Wine (16-21%)",
          wine21To24: "Still Wine (21-24%)",
          sparklingWine: "Sparkling Wine",
          carbonatedWine: "Carbonated Wine",
        };

        const taxComputationByClass: NonNullable<TTBForm512017Data["taxComputationByClass"]> = [];

        // Always include hard cider (even if 0)
        const classesToCompute = new Set<string>(["hardCider"]);
        for (const cls of Object.keys(removalsByTaxClass)) {
          if (removalsByTaxClass[cls] > 0) classesToCompute.add(cls);
        }
        // Include classes with ending inventory too
        if (endingWineUnder16BulkGallons > 0 || beginningWineUnder16BulkGallons > 0) classesToCompute.add("wineUnder16");
        if (endingPommeauBulkGallons > 0 || beginningPommeauBulkGallons > 0) classesToCompute.add("wine16To21");

        for (const cls of ["hardCider", "wineUnder16", "wine16To21", "wine21To24", "sparklingWine", "carbonatedWine"]) {
          if (!classesToCompute.has(cls)) continue;
          const taxableGallons = roundGallons(removalsByTaxClass[cls] || 0);
          const taxRate = (ttbConfig.taxRates as Record<string, number>)[cls] || 0;
          const grossTax = Math.round(taxableGallons * taxRate * 100) / 100;

          // Small producer credit only applies to hard cider
          let creditAmount = 0;
          if (cls === "hardCider") {
            const creditPerGallon = ttbConfig.cbmaCredits.smallProducerCreditPerGallon;
            const creditLimit = ttbConfig.cbmaCredits.creditLimitGallons;
            const creditEligibleGallons = Math.min(taxableGallons, creditLimit);
            creditAmount = Math.round(creditEligibleGallons * creditPerGallon * 100) / 100;
          }

          const netTax = Math.round((grossTax - creditAmount) * 100) / 100;

          taxComputationByClass.push({
            taxClass: cls,
            label: taxClassLabels[cls] || cls,
            taxRate,
            taxableGallons,
            grossTax,
            smallProducerCredit: creditAmount,
            netTax,
          });
        }

        // ============================================
        // Brandy Used in Cider (needed for reconciliation)
        // Brandy transferred from brandy batches to cider/pommeau batches
        // This enters Part I as Line 4 "PRODUCED BY ADDITION OF WINE SPIRITS"
        // ============================================

        // Find all brandy batches (including deleted — brandy may have been soft-deleted
        // after being used for fortification, but the transfer is still valid)
        const brandyBatchesQuery = await db
          .select({ id: batches.id })
          .from(batches)
          .where(eq(batches.productType, "brandy"));

        const brandyBatchIds = brandyBatchesQuery.map(b => b.id);

        let brandyUsedInCiderGallons = 0;
        const brandyTransfers: BrandyTransfer[] = [];
        const brandyUsedByTaxClass: Record<string, number> = {};

        if (brandyBatchIds.length > 0) {
          // Find transfers FROM brandy batches TO non-brandy batches
          // Uses src.product_type = 'brandy' instead of batch ID list to catch
          // transfers from deleted brandy batches (brandy physically entered pommeau)
          const brandyToCiderTransfers = await db
            .select({
              volumeTransferred: batchTransfers.volumeTransferred,
              transferredAt: batchTransfers.transferredAt,
              sourceBatchName: sql<string>`src.custom_name`,
              destBatchName: sql<string>`dest.custom_name`,
              destinationBatchId: batchTransfers.destinationBatchId,
            })
            .from(batchTransfers)
            .innerJoin(
              sql`batches src`,
              sql`src.id = ${batchTransfers.sourceBatchId}`
            )
            .innerJoin(
              sql`batches dest`,
              sql`dest.id = ${batchTransfers.destinationBatchId}`
            )
            .where(
              and(
                isNull(batchTransfers.deletedAt),
                sql`src.product_type = 'brandy'`,
                sql`dest.product_type != 'brandy'`,
                gte(batchTransfers.transferredAt, startDate),
                lte(batchTransfers.transferredAt, endDate)
              )
            );

          for (const transfer of brandyToCiderTransfers) {
            const volumeGallons = roundGallons(
              litersToWineGallons(Number(transfer.volumeTransferred || 0))
            );
            brandyUsedInCiderGallons += volumeGallons;

            // Allocate to destination batch's tax class (brandy→pommeau = wine16To21)
            const destTaxClass = getTaxClassFromMap(batchTaxClassMap, transfer.destinationBatchId || "", null) || "wine16To21";
            brandyUsedByTaxClass[destTaxClass] = (brandyUsedByTaxClass[destTaxClass] || 0) + volumeGallons;

            brandyTransfers.push({
              sourceBatch: transfer.sourceBatchName || "Unknown",
              destinationBatch: transfer.destBatchName || "Unknown",
              volumeGallons,
              transferredAt: transfer.transferredAt || new Date(),
            });
          }
        }

        // Add ABV-derived brandy from pommeau batches composed at creation
        // (no transfer records exist — brandy was mixed with juice at batch creation)
        const brandyToPommeauGallons = roundGallons(litersToWineGallons(brandyToPommeauLiters));
        brandyUsedInCiderGallons += brandyToPommeauGallons;
        brandyUsedByTaxClass["wine16To21"] = (brandyUsedByTaxClass["wine16To21"] || 0) + brandyToPommeauGallons;

        brandyUsedInCiderGallons = roundGallons(brandyUsedInCiderGallons);
        for (const key of Object.keys(brandyUsedByTaxClass)) {
          brandyUsedByTaxClass[key] = roundGallons(brandyUsedByTaxClass[key]);
        }

        // ============================================
        // Reconciliation (Part I: Wine only — spirits tracked in Part III)
        // ============================================
        // Wine spirits added (brandyUsedInCider) enters wine inventory via Line 4.
        // Brandy opening balance and brandy received are Part III (spirits), NOT wine.

        // Note: reconciliation is computed AFTER form sections are balanced (see Section Balancing below)

        // ============================================
        // Part IV: Materials Received and Used
        // ============================================

        // Query apple/fruit purchases in period
        const fruitPurchases = await db
          .select({
            fruitType: baseFruitVarieties.fruitType,
            totalKg: sql<number>`COALESCE(SUM(
              CASE
                WHEN ${basefruitPurchaseItems.quantityKg} IS NOT NULL THEN CAST(${basefruitPurchaseItems.quantityKg} AS DECIMAL)
                WHEN ${basefruitPurchaseItems.unit} = 'lb' THEN CAST(${basefruitPurchaseItems.quantity} AS DECIMAL) / 2.20462
                WHEN ${basefruitPurchaseItems.unit} = 'kg' THEN CAST(${basefruitPurchaseItems.quantity} AS DECIMAL)
                WHEN ${basefruitPurchaseItems.unit} = 'bushel' THEN CAST(${basefruitPurchaseItems.quantity} AS DECIMAL) * 19.0509
                ELSE CAST(${basefruitPurchaseItems.quantity} AS DECIMAL)
              END
            ), 0)`,
          })
          .from(basefruitPurchaseItems)
          .leftJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id)
          )
          .leftJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id)
          )
          .where(
            and(
              gte(basefruitPurchases.purchaseDate, startDate),
              lte(basefruitPurchases.purchaseDate, endDate)
            )
          )
          .groupBy(baseFruitVarieties.fruitType);

        let applesKg = 0;
        let otherFruitKg = 0;
        for (const row of fruitPurchases) {
          // Quince is a pome fruit (Rosaceae family) — classify with apples for TTB
          if (row.fruitType === "apple" || row.fruitType === "quince") {
            applesKg += Number(row.totalKg || 0);
          } else {
            otherFruitKg += Number(row.totalKg || 0);
          }
        }

        // Convert kg to lbs (1 kg = 2.20462 lbs)
        const applesLbs = applesKg * 2.20462;
        const otherFruitLbs = otherFruitKg * 2.20462;

        // Query juice produced from press runs in period
        const juiceProduced = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(pressRuns)
          .where(
            and(
              isNull(pressRuns.deletedAt),
              eq(pressRuns.status, "completed"),
              gte(pressRuns.dateCompleted, startDate.toISOString().split("T")[0]),
              lte(pressRuns.dateCompleted, endDate.toISOString().split("T")[0])
            )
          );

        const juiceGallons = roundGallons(
          litersToWineGallons(Number(juiceProduced[0]?.totalLiters || 0))
        );

        // Query sugar/additive purchases in period
        // We'll look for additives with names containing 'sugar' or 'honey'
        const additivePurchaseData = await db
          .select({
            varietyName: additiveVarieties.name,
            totalQuantity: sql<number>`COALESCE(SUM(CAST(${additivePurchaseItems.quantity} AS DECIMAL)), 0)`,
            unit: additivePurchaseItems.unit,
          })
          .from(additivePurchaseItems)
          .leftJoin(
            additivePurchases,
            eq(additivePurchaseItems.purchaseId, additivePurchases.id)
          )
          .leftJoin(
            additiveVarieties,
            eq(additivePurchaseItems.additiveVarietyId, additiveVarieties.id)
          )
          .where(
            and(
              gte(additivePurchases.purchaseDate, startDate),
              lte(additivePurchases.purchaseDate, endDate)
            )
          )
          .groupBy(additiveVarieties.name, additivePurchaseItems.unit);

        let sugarLbs = 0;
        let honeyLbs = 0;
        for (const row of additivePurchaseData) {
          const name = (row.varietyName || "").toLowerCase();
          const qty = Number(row.totalQuantity || 0);
          // Convert to lbs if needed (assuming most are in kg or lbs)
          const qtyLbs = row.unit === "kg" ? qty * 2.20462 : qty;

          if (name.includes("sugar")) {
            sugarLbs += qtyLbs;
          } else if (name.includes("honey")) {
            honeyLbs += qtyLbs;
          }
        }

        const materials: MaterialsSection = {
          applesReceivedLbs: Math.round(applesLbs),
          applesUsedLbs: Math.round(applesLbs), // Assume all received is used
          appleJuiceGallons: juiceGallons,
          otherFruitReceivedLbs: Math.round(otherFruitLbs),
          otherFruitUsedLbs: Math.round(otherFruitLbs),
          sugarReceivedLbs: Math.round(sugarLbs),
          sugarUsedLbs: Math.round(sugarLbs),
          honeyReceivedLbs: Math.round(honeyLbs),
          honeyUsedLbs: Math.round(honeyLbs),
        };

        // ============================================
        // Part VII: In Fermenters End of Period
        // ============================================

        // Batches in "fermentation" status at end of period
        const fermentingBatches = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              eq(batches.status, "fermentation"),
              lte(batches.startDate, endDate)
            )
          );

        const fermenters: FermentersSection = {
          gallonsInFermenters: roundGallons(
            litersToWineGallons(Number(fermentingBatches[0]?.totalLiters || 0))
          ),
        };

        // ============================================
        // Part I Section A: Bulk Wines
        // ============================================

        // Calculate volume bottled during period (grouped by batch for per-tax-class)
        // NOTE: Do NOT filter by reconciliationStatus — packaging from excluded/duplicate batches
        // is physically real (product was bottled). Same principle as distributions.
        const bottledByBatch = await db
          .select({
            batchId: bottleRuns.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(
            and(
              isNull(bottleRuns.voidedAt),
              isNull(batches.deletedAt),
              gte(bottleRuns.packagedAt, startDate),
              lte(bottleRuns.packagedAt, endDate)
            )
          )
          .groupBy(bottleRuns.batchId);

        let bottledLiters = 0;
        const bottledByTaxClass: Record<string, number> = {};
        for (const row of bottledByBatch) {
          const liters = Number(row.totalLiters);
          bottledLiters += liters;
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
          bottledByTaxClass[taxClass] = (bottledByTaxClass[taxClass] || 0) + litersToWineGallons(liters);
        }
        for (const key of Object.keys(bottledByTaxClass)) {
          bottledByTaxClass[key] = roundGallons(bottledByTaxClass[key]);
        }
        const bottledGallons = roundGallons(litersToWineGallons(bottledLiters));

        // Calculate ALL keg fills during period (regardless of distribution status)
        // Keg fills are bulk→packaged transfers (analogous to bottling on Line 13)
        // Only distributed kegs are tax-paid removals (Bottled Section Line 8)
        // NOTE: Do NOT filter by reconciliationStatus — kegging from excluded/duplicate batches
        // is physically real (product was kegged). Same principle as distributions.
        const kegFilledByBatch = await db
          .select({
            batchId: kegFills.batchId,
            totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END), 0)`,
          })
          .from(kegFills)
          .innerJoin(batches, eq(kegFills.batchId, batches.id))
          .where(
            and(
              isNull(kegFills.voidedAt),
              isNull(kegFills.deletedAt),
              isNull(batches.deletedAt),
              gte(kegFills.filledAt, startDate),
              lte(kegFills.filledAt, endDate)
            )
          )
          .groupBy(kegFills.batchId);

        let kegFilledLiters = 0;
        const kegFilledByTaxClass: Record<string, number> = {};
        for (const row of kegFilledByBatch) {
          const liters = Number(row.totalLiters);
          kegFilledLiters += liters;
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, null) || "hardCider";
          kegFilledByTaxClass[taxClass] = (kegFilledByTaxClass[taxClass] || 0) + litersToWineGallons(liters);
        }
        for (const key of Object.keys(kegFilledByTaxClass)) {
          kegFilledByTaxClass[key] = roundGallons(kegFilledByTaxClass[key]);
        }
        const kegFilledGallons = roundGallons(litersToWineGallons(kegFilledLiters));

        // Total volume packed from bulk (bottle runs + keg fills), NET of bottling/kegging loss
        const totalBottlingLoss = roundGallons(Object.values(bottlingLossByTaxClass).reduce((s, v) => s + v, 0));
        const totalPackedGallons = roundGallons(bottledGallons + kegFilledGallons - totalBottlingLoss);

        // Calculate change-of-class transfers (Lines 10 IN / 24 OUT)
        // Transfers between batches of different tax classes during the period
        const crossClassTransfers = await db
          .select({
            sourceBatchId: sql<string>`source_batch.id`,
            sourceProductType: sql<string>`source_batch.product_type`,
            destBatchId: sql<string>`dest_batch.id`,
            destProductType: sql<string>`dest_batch.product_type`,
            volumeTransferred: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
          })
          .from(batchTransfers)
          .leftJoin(sql`batches source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
          .leftJoin(sql`batches dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
          .where(
            and(
              isNull(batchTransfers.deletedAt),
              gte(batchTransfers.transferredAt, startDate),
              lte(batchTransfers.transferredAt, endDate)
            )
          )
          .groupBy(sql`source_batch.id`, sql`source_batch.product_type`, sql`dest_batch.id`, sql`dest_batch.product_type`);

        const changeOfClassIn: Record<string, number> = {};
        const changeOfClassOut: Record<string, number> = {};
        for (const row of crossClassTransfers) {
          const srcType = row.sourceProductType || "";
          const dstType = row.destProductType || "";

          // Exclude transfers involving brandy or pommeau — these are accounted for
          // separately as wine spirits (Line 4) and pommeau production, not change of class.
          if (srcType === "brandy" || dstType === "brandy") continue;
          if (dstType === "pommeau" || srcType === "pommeau") continue;

          if (srcType === dstType) continue;

          const sourceClass = getTaxClassFromMap(batchTaxClassMap, row.sourceBatchId, srcType || "cider");
          const destClass = getTaxClassFromMap(batchTaxClassMap, row.destBatchId, dstType || "cider");
          if (!sourceClass || !destClass) continue;
          // Skip same tax class (e.g., cider→perry are both hardCider)
          if (sourceClass === destClass) continue;

          const volumeGallons = litersToWineGallons(Number(row.volumeTransferred || 0));
          changeOfClassOut[sourceClass] = (changeOfClassOut[sourceClass] || 0) + volumeGallons;
          changeOfClassIn[destClass] = (changeOfClassIn[destClass] || 0) + volumeGallons;
        }
        for (const key of Object.keys(changeOfClassIn)) changeOfClassIn[key] = roundGallons(changeOfClassIn[key]);
        for (const key of Object.keys(changeOfClassOut)) changeOfClassOut[key] = roundGallons(changeOfClassOut[key]);

        const totalChangeOfClassIn = roundGallons(Object.values(changeOfClassIn).reduce((s, v) => s + v, 0));
        const totalChangeOfClassOut = roundGallons(Object.values(changeOfClassOut).reduce((s, v) => s + v, 0));

        // Build bulk wines section (TOTAL column)
        // Official TTB F 5120.17 line structure:
        //   Lines 1-12: Available (beginning + production + receipts + gains)
        //   Lines 13-31: Removals + ending inventory
        //   Line 32: TOTAL (must equal Line 12)
        //
        // Data mapping for a cidery:
        //   Line 2: Cider production (fermentation)
        //   Line 4: Brandy used in cider/pommeau (wine spirits added)
        //   Line 9: Positive volume adjustments (inventory gains)
        //   Line 13: Volume packed from bulk (bottle runs + keg fills = bulk→packaged transfer)
        //   Line 14: 0 (kegs are packed, not direct bulk removals; distributions are in Bottled Line 8)
        //   Line 16: Cider sent to DSP (distilling material)
        //   Line 29: Process losses (racking, fermentation, transfer loss, etc.)
        //   Line 31: Ending bulk inventory
        //
        // Note: Pommeau "blending" production goes in line 5 of the pommeau column only,
        // NOT in the total column line 5, because the juice component is already counted
        // in wineProducedGallons (line 2) — adding it would double-count.
        // brandyUsedInCiderGallons goes in line 4 — this is the brandy volume that
        // entered wine production (spirits → wine), NOT brandyReceivedGallons
        // (which is a Part III spirits receipt, not a Part I wine receipt).
        // Note: For the TOTAL column, change-of-class IN and OUT should net to zero
        // (every OUT from one class is an IN to another). Include both for transparency.
        const bulkLine12 = roundGallons(
          beginningInventory.bulk + wineProducedGallons +
          brandyUsedInCiderGallons + positiveAdjustmentGallons +
          totalChangeOfClassIn
        );
        // Recorded losses from operational data (racking, filtering, bottling, etc.)
        const recordedLosses = otherRemovals.processLosses;
        // Line 29 = balancing figure: Total In - all other removals - ending
        // This absorbs all unrecorded losses (lees, evaporation, sampling, etc.)
        // Standard TTB practice: Line 29 is the "plug" that makes the form balance.
        const bulkLosses = roundGallons(
          bulkLine12 - totalPackedGallons - ciderSentToDspGallons -
          totalChangeOfClassOut - totalBottlingLoss - endingInventory.bulk
        );
        const bulkLine32 = bulkLine12; // Form must balance

        const bulkWines: BulkWinesSection = {
          line1_onHandBeginning: beginningInventory.bulk,
          line2_produced: wineProducedGallons,
          line3_sweetening: 0,
          line4_wineSpirits: brandyUsedInCiderGallons,
          line5_blending: 0,
          line6_amelioration: 0,
          line7_receivedInBond: 0,
          line8_dumpedToBulk: 0,
          line9_inventoryGains: positiveAdjustmentGallons,
          line10_writeIn: totalChangeOfClassIn,
          line10_writeInDesc: totalChangeOfClassIn > 0 ? "CHANGE OF CLASS IN" : undefined,
          line12_total: bulkLine12,
          line13_bottled: totalPackedGallons,
          line14_removedTaxpaid: 0,
          line15_transfersInBond: 0,
          line16_distillingMaterial: ciderSentToDspGallons,
          line17_vinegarPlant: 0,
          line18_sweetening: 0,
          line19_wineSpirits: 0,
          line20_blending: 0,
          line21_amelioration: 0,
          line22_effervescent: 0,
          line23_testing: 0,
          line24_writeIn1: totalChangeOfClassOut,
          line24_writeIn1Desc: totalChangeOfClassOut > 0 ? "CHANGE OF CLASS OUT" : undefined,
          line25_writeIn2: 0,
          line29_losses: bulkLosses,
          line30_inventoryLosses: totalBottlingLoss,
          line31_onHandEnd: endingInventory.bulk,
          line32_total: bulkLine32,
        };

        // Build per-tax-class bulk wines columns
        // Hard cider column: excludes pommeau, wineUnder16, and brandy volumes
        const ciderBeginning = roundGallons(beginningInventory.bulk - beginningPommeauBulkGallons - beginningWineUnder16BulkGallons);
        const ciderGains = roundGallons(gainsByTaxClass["hardCider"] || 0);
        const ciderBottled = roundGallons(bottledByTaxClass["hardCider"] || 0);
        const ciderKegFilled = roundGallons(kegFilledByTaxClass["hardCider"] || 0);
        const ciderBottlingLoss = roundGallons(bottlingLossByTaxClass["hardCider"] || 0);
        const ciderPacked = roundGallons(ciderBottled + ciderKegFilled - ciderBottlingLoss);
        const ciderDistillation = roundGallons(distillationByTaxClass["hardCider"] || 0);
        const ciderChangeIn = roundGallons(changeOfClassIn["hardCider"] || 0);
        const ciderChangeOut = roundGallons(changeOfClassOut["hardCider"] || 0);
        const ciderLine12 = roundGallons(
          ciderBeginning + ciderProducedGallons + ciderChangeIn + ciderGains
        );
        // Line 29 = all losses (bulk + bottling). Line 30 reserved for physical inventory shortages only.
        const ciderLosses = roundGallons(
          ciderLine12 - ciderPacked - ciderDistillation - ciderChangeOut - endingCiderBulkGallons
        );
        const ciderLine32 = ciderLine12;
        const ciderBulkWines: BulkWinesSection = {
          line1_onHandBeginning: ciderBeginning,
          line2_produced: ciderProducedGallons,
          line3_sweetening: 0,
          line4_wineSpirits: 0,
          line5_blending: 0,
          line6_amelioration: 0,
          line7_receivedInBond: 0,
          line8_dumpedToBulk: 0,
          line9_inventoryGains: ciderGains,
          line10_writeIn: ciderChangeIn,
          line10_writeInDesc: ciderChangeIn > 0 ? "CHANGE OF CLASS IN" : undefined,
          line12_total: ciderLine12,
          line13_bottled: ciderPacked,
          line14_removedTaxpaid: 0,
          line15_transfersInBond: 0,
          line16_distillingMaterial: ciderDistillation,
          line17_vinegarPlant: 0,
          line18_sweetening: 0,
          line19_wineSpirits: 0,
          line20_blending: 0,
          line21_amelioration: 0,
          line22_effervescent: 0,
          line23_testing: 0,
          line24_writeIn1: ciderChangeOut,
          line24_writeIn1Desc: ciderChangeOut > 0 ? "CHANGE OF CLASS OUT" : undefined,
          line25_writeIn2: 0,
          line29_losses: ciderLosses,
          line30_inventoryLosses: 0,
          line31_onHandEnd: endingCiderBulkGallons,
          line32_total: ciderLine32,
        };

        // Wine ≤16% column (fruit wine): receives volume via tax class transfers
        const wineUnder16ChangeIn = roundGallons(changeOfClassIn["wineUnder16"] || 0);
        const wineUnder16ChangeOut = roundGallons(changeOfClassOut["wineUnder16"] || 0);
        const wineUnder16Gains = roundGallons(gainsByTaxClass["wineUnder16"] || 0);
        const wineUnder16Bottled = roundGallons(bottledByTaxClass["wineUnder16"] || 0);
        const wineUnder16KegFilled = roundGallons(kegFilledByTaxClass["wineUnder16"] || 0);
        const wineUnder16BottlingLoss = roundGallons(bottlingLossByTaxClass["wineUnder16"] || 0);
        const wineUnder16Packed = roundGallons(wineUnder16Bottled + wineUnder16KegFilled - wineUnder16BottlingLoss);
        const wineUnder16RecordedLosses = roundGallons((lossesByTaxClass["wineUnder16"] || 0) - (clampedByTaxClass["wineUnder16"] || 0));
        const wineUnder16Line12 = roundGallons(beginningWineUnder16BulkGallons + fruitWineProducedGallons + wineUnder16ChangeIn + wineUnder16Gains);
        // Line 29 = all losses (bulk + bottling). Line 30 reserved for physical inventory shortages only.
        const wineUnder16Losses = roundGallons(
          wineUnder16Line12 - wineUnder16Packed - wineUnder16ChangeOut - endingWineUnder16BulkGallons
        );
        const wineUnder16Line32 = wineUnder16Line12;
        const wineUnder16BulkWines: BulkWinesSection = {
          line1_onHandBeginning: beginningWineUnder16BulkGallons,
          line2_produced: fruitWineProducedGallons,
          line3_sweetening: 0,
          line4_wineSpirits: 0,
          line5_blending: 0,
          line6_amelioration: 0,
          line7_receivedInBond: 0,
          line8_dumpedToBulk: 0,
          line9_inventoryGains: wineUnder16Gains,
          line10_writeIn: wineUnder16ChangeIn,
          line10_writeInDesc: wineUnder16ChangeIn > 0 ? "CHANGE OF CLASS IN" : undefined,
          line12_total: wineUnder16Line12,
          line13_bottled: wineUnder16Packed,
          line14_removedTaxpaid: 0,
          line15_transfersInBond: 0,
          line16_distillingMaterial: 0,
          line17_vinegarPlant: 0,
          line18_sweetening: 0,
          line19_wineSpirits: 0,
          line20_blending: 0,
          line21_amelioration: 0,
          line22_effervescent: 0,
          line23_testing: 0,
          line24_writeIn1: wineUnder16ChangeOut,
          line24_writeIn1Desc: wineUnder16ChangeOut > 0 ? "CHANGE OF CLASS OUT" : undefined,
          line25_writeIn2: 0,
          line29_losses: wineUnder16Losses,
          line30_inventoryLosses: 0,
          line31_onHandEnd: endingWineUnder16BulkGallons,
          line32_total: wineUnder16Line32,
        };

        // Wine 16-21% column (pommeau): produced by wine spirits (Line 4)
        // Pommeau = juice fortified with apple brandy. The full pommeau volume goes on
        // Line 4 ("Produced by addition of wine spirits") in the per-class column.
        // The total column Line 4 shows only the brandy portion (spirits entering wine system).
        const pommeauChangeIn = roundGallons(changeOfClassIn["wine16To21"] || 0);
        const pommeauChangeOut = roundGallons(changeOfClassOut["wine16To21"] || 0);
        const pommeauGains = roundGallons(gainsByTaxClass["wine16To21"] || 0);
        const pommeauBottled = roundGallons(bottledByTaxClass["wine16To21"] || 0);
        const pommeauKegFilled = roundGallons(kegFilledByTaxClass["wine16To21"] || 0);
        const pommeauBottlingLoss = roundGallons(bottlingLossByTaxClass["wine16To21"] || 0);
        const pommeauPacked = roundGallons(pommeauBottled + pommeauKegFilled - pommeauBottlingLoss);
        const pommeauDistillation = roundGallons(distillationByTaxClass["wine16To21"] || 0);
        const pommeauRecordedLosses = roundGallons((lossesByTaxClass["wine16To21"] || 0) - (clampedByTaxClass["wine16To21"] || 0));
        const pommeauLine12 = roundGallons(beginningPommeauBulkGallons + pommeauProducedGallons + pommeauChangeIn + pommeauGains);
        // Line 29 = all losses (bulk + bottling). Line 30 reserved for physical inventory shortages only.
        const pommeauLosses = roundGallons(
          pommeauLine12 - pommeauPacked - pommeauDistillation - pommeauChangeOut - endingPommeauBulkGallons
        );
        const pommeauLine32 = pommeauLine12;
        const pommeauBulkWines: BulkWinesSection = {
          line1_onHandBeginning: beginningPommeauBulkGallons,
          line2_produced: 0,
          line3_sweetening: 0,
          line4_wineSpirits: pommeauProducedGallons,
          line5_blending: 0,
          line6_amelioration: 0,
          line7_receivedInBond: 0,
          line8_dumpedToBulk: 0,
          line9_inventoryGains: pommeauGains,
          line10_writeIn: pommeauChangeIn,
          line10_writeInDesc: pommeauChangeIn > 0 ? "CHANGE OF CLASS IN" : undefined,
          line12_total: pommeauLine12,
          line13_bottled: pommeauPacked,
          line14_removedTaxpaid: 0,
          line15_transfersInBond: 0,
          line16_distillingMaterial: pommeauDistillation,
          line17_vinegarPlant: 0,
          line18_sweetening: 0,
          line19_wineSpirits: 0,
          line20_blending: 0,
          line21_amelioration: 0,
          line22_effervescent: 0,
          line23_testing: 0,
          line24_writeIn1: pommeauChangeOut,
          line24_writeIn1Desc: pommeauChangeOut > 0 ? "CHANGE OF CLASS OUT" : undefined,
          line25_writeIn2: 0,
          line29_losses: pommeauLosses,
          line30_inventoryLosses: 0,
          line31_onHandEnd: endingPommeauBulkGallons,
          line32_total: pommeauLine32,
        };

        // Empty bulk wines section for tax classes with no activity
        const emptyBulkWines: BulkWinesSection = {
          line1_onHandBeginning: 0, line2_produced: 0, line3_sweetening: 0,
          line4_wineSpirits: 0, line5_blending: 0, line6_amelioration: 0,
          line7_receivedInBond: 0, line8_dumpedToBulk: 0, line9_inventoryGains: 0,
          line10_writeIn: 0, line12_total: 0, line13_bottled: 0,
          line14_removedTaxpaid: 0, line15_transfersInBond: 0, line16_distillingMaterial: 0,
          line17_vinegarPlant: 0, line18_sweetening: 0, line19_wineSpirits: 0,
          line20_blending: 0, line21_amelioration: 0, line22_effervescent: 0,
          line23_testing: 0, line24_writeIn1: 0, line25_writeIn2: 0,
          line29_losses: 0, line30_inventoryLosses: 0, line31_onHandEnd: 0,
          line32_total: 0,
        };

        const bulkWinesByTaxClass: Record<string, BulkWinesSection> = {
          hardCider: ciderBulkWines,
          wineUnder16: wineUnder16BulkWines,
          wine16To21: pommeauBulkWines,
          wine21To24: { ...emptyBulkWines },
          carbonatedWine: { ...emptyBulkWines },
          sparklingWine: { ...emptyBulkWines },
        };

        // ============================================
        // Part I Section B: Bottled Wines — PER TAX CLASS
        // ============================================
        // Official TTB F 5120.17 Part I-B line structure:
        //   Lines 1-7: Available (beginning + bottled + received)
        //   Lines 8-20: Removals + ending inventory
        //   Line 21: TOTAL (must equal Line 7)
        //
        // Data mapping for a cidery:
        //   Line 1: Beginning bottled inventory (from TTB opening balances, per class)
        //   Line 2: Volume packed from bulk (bottle runs + keg fills, per class)
        //   Line 8: Tax-paid removals (distributions, per class from removalsByTaxClass)
        //   Line 11: Tasting room samples (allocated proportionally)
        //   Line 18: Breakage (allocated proportionally)
        //   Line 20: Ending packaged inventory (per class)
        const totalTaxPaidGallons = roundGallons(bottleTaxPaidGallons + kegTaxPaidGallons);

        // Build per-tax-class bottled wine sections
        const bottledTaxClasses = ["hardCider", "wineUnder16", "wine16To21", "wine21To24", "carbonatedWine", "sparklingWine"];
        const bottledWinesByTaxClass: Record<string, BottledWinesSection> = {};

        // Allocate samples/breakage proportionally by tax-paid removals share
        const totalRemovalsForAlloc = Object.values(removalsByTaxClass).reduce((s, v) => s + v, 0) || 1;

        for (const cls of bottledTaxClasses) {
          const beginning = beginningBottledByClass[cls] || 0;
          const clsBottlingLoss = roundGallons(bottlingLossByTaxClass[cls] || 0);
          const packed = roundGallons((bottledByTaxClass[cls] || 0) + (kegFilledByTaxClass[cls] || 0) - clsBottlingLoss);
          const taxPaid = roundGallons(removalsByTaxClass[cls] || 0);
          const ending = endingBottledByClass[cls] || 0;

          // Proportional allocation of samples/breakage/adjustments based on removals share
          const share = totalRemovalsForAlloc > 0 ? (taxPaid / totalRemovalsForAlloc) : (cls === "hardCider" ? 1 : 0);
          const samples = roundGallons(otherRemovals.samples * share);
          const breakage = roundGallons(otherRemovals.breakage * share);
          const posAdj = roundGallons(positiveBottledAdjGallons * share);
          const negAdj = roundGallons(negativeBottledAdjGallons * share);

          const line7 = roundGallons(beginning + packed + posAdj);
          const line21 = roundGallons(taxPaid + samples + breakage + negAdj + ending);

          bottledWinesByTaxClass[cls] = {
            line1_onHandBeginning: beginning,
            line2_bottled: packed,
            line3_receivedInBond: 0,
            line4_taxpaidReturned: 0,
            line5_writeIn: posAdj,
            line5_writeInDesc: posAdj > 0 ? "INVENTORY ADJUSTMENTS" : undefined,
            line7_total: line7,
            line8_removedTaxpaid: taxPaid,
            line9_transferredInBond: 0,
            line10_dumpedToBulk: 0,
            line11_tasting: samples,
            line12_export: 0,
            line13_familyUse: 0,
            line14_testing: 0,
            line15_writeIn: 0,
            line18_breakage: breakage,
            line19_inventoryShortage: negAdj,
            line20_onHandEnd: ending,
            line21_total: line21,
          };
        }

        // Compute aggregate bottled wines (total column) from per-class
        const allBottledCols = Object.values(bottledWinesByTaxClass);
        const bottledWines: BottledWinesSection = {
          line1_onHandBeginning: roundGallons(allBottledCols.reduce((s, c) => s + c.line1_onHandBeginning, 0)),
          line2_bottled: totalPackedGallons,
          line3_receivedInBond: 0,
          line4_taxpaidReturned: 0,
          line5_writeIn: positiveBottledAdjGallons,
          line5_writeInDesc: positiveBottledAdjGallons > 0 ? "INVENTORY ADJUSTMENTS" : undefined,
          line7_total: roundGallons(beginningInventory.bottled + totalPackedGallons + positiveBottledAdjGallons),
          line8_removedTaxpaid: totalTaxPaidGallons,
          line9_transferredInBond: 0,
          line10_dumpedToBulk: 0,
          line11_tasting: otherRemovals.samples,
          line12_export: 0,
          line13_familyUse: 0,
          line14_testing: 0,
          line15_writeIn: 0,
          line18_breakage: otherRemovals.breakage,
          line19_inventoryShortage: negativeBottledAdjGallons,
          line20_onHandEnd: endingInventory.bottled,
          line21_total: roundGallons(totalTaxPaidGallons + otherRemovals.samples + otherRemovals.breakage + negativeBottledAdjGallons + endingInventory.bottled),
        };

        // ============================================
        // Section Balancing — TTB requires line 12 = line 32 and line 7 = line 21
        // Any unexplained discrepancy goes into inventory gains/losses
        // (standard accounting treatment for TTB Form 5120.17)
        // ============================================

        // Balance Bottled Section (Part I-B) — each tax class column balanced independently
        for (const [taxClass, section] of Object.entries(bottledWinesByTaxClass)) {
          const gap = roundGallons(section.line7_total - section.line21_total);
          if (Math.abs(gap) >= 0.1) {
            if (gap < 0) {
              section.line5_writeIn = roundGallons(section.line5_writeIn + Math.abs(gap));
              section.line5_writeInDesc = "INVENTORY ADJUSTMENTS";
              section.line7_total = roundGallons(section.line7_total + Math.abs(gap));
            } else {
              section.line19_inventoryShortage = roundGallons(section.line19_inventoryShortage + gap);
              section.line21_total = roundGallons(section.line21_total + gap);
            }
          }
        }

        // Recompute aggregate bottled totals from balanced per-class values
        const balancedBottledCols = Object.values(bottledWinesByTaxClass);
        bottledWines.line5_writeIn = roundGallons(balancedBottledCols.reduce((s, c) => s + c.line5_writeIn, 0));
        bottledWines.line5_writeInDesc = bottledWines.line5_writeIn > 0 ? "INVENTORY ADJUSTMENTS" : undefined;
        bottledWines.line7_total = roundGallons(balancedBottledCols.reduce((s, c) => s + c.line7_total, 0));
        bottledWines.line19_inventoryShortage = roundGallons(balancedBottledCols.reduce((s, c) => s + c.line19_inventoryShortage, 0));
        bottledWines.line21_total = roundGallons(balancedBottledCols.reduce((s, c) => s + c.line21_total, 0));

        // Balance Bulk Section (Part I-A) — each tax class column balanced independently
        // TTB requires line 12 = line 32; any gap goes to inventory gains (line 9) or losses (line 29)
        for (const [taxClass, section] of Object.entries(bulkWinesByTaxClass)) {
          const gap = roundGallons(section.line12_total - section.line32_total);
          if (Math.abs(gap) >= 0.1) {
            if (gap < 0) {
              section.line9_inventoryGains = roundGallons(section.line9_inventoryGains + Math.abs(gap));
              section.line12_total = roundGallons(section.line12_total + Math.abs(gap));
            } else {
              section.line29_losses = roundGallons(section.line29_losses + gap);
              section.line32_total = roundGallons(section.line32_total + gap);
            }
          }
        }

        // Recompute ALL total column lines as sums of balanced per-class values.
        // This ensures Total column = sum of per-class columns for every line,
        // so Line 12 = sum of Lines 1-11 on the Total column.
        const allBulkCols = Object.values(bulkWinesByTaxClass);
        for (const key of Object.keys(bulkWines) as (keyof BulkWinesSection)[]) {
          const val = (bulkWines as any)[key];
          if (typeof val === "number") {
            (bulkWines as any)[key] = roundGallons(
              allBulkCols.reduce((s, c) => s + ((c as any)[key] ?? 0), 0)
            );
          }
        }
        // Update write-in descriptions based on recomputed totals
        bulkWines.line10_writeInDesc = bulkWines.line10_writeIn > 0 ? "CHANGE OF CLASS IN" : undefined;
        bulkWines.line24_writeIn1Desc = bulkWines.line24_writeIn1 > 0 ? "CHANGE OF CLASS OUT" : undefined;

        // Derive reconciliation FROM the balanced form sections
        // This ensures the reconciliation always matches what's shown on the form
        const formTotalAvailable = roundGallons(
          // Bulk inputs (lines 1-11, all wine entering system)
          bulkWines.line1_onHandBeginning + bulkWines.line2_produced +
          bulkWines.line3_sweetening + bulkWines.line4_wineSpirits +
          bulkWines.line5_blending + bulkWines.line6_amelioration +
          bulkWines.line7_receivedInBond + bulkWines.line8_dumpedToBulk +
          bulkWines.line9_inventoryGains + bulkWines.line10_writeIn +
          // Bottled inputs (lines 1-6, excluding line 2 which is internal transfer from bulk line 13)
          bottledWines.line1_onHandBeginning +
          bottledWines.line3_receivedInBond + bottledWines.line4_taxpaidReturned +
          bottledWines.line5_writeIn
        );
        const formTotalAccountedFor = roundGallons(
          // Bulk external removals (lines 14-30, NOT line 13 which is internal transfer)
          bulkWines.line14_removedTaxpaid + bulkWines.line15_transfersInBond +
          bulkWines.line16_distillingMaterial + bulkWines.line17_vinegarPlant +
          bulkWines.line18_sweetening + bulkWines.line19_wineSpirits +
          bulkWines.line20_blending + bulkWines.line21_amelioration +
          bulkWines.line22_effervescent + bulkWines.line23_testing +
          bulkWines.line24_writeIn1 + bulkWines.line25_writeIn2 +
          bulkWines.line29_losses + bulkWines.line30_inventoryLosses +
          // Bottled removals (lines 8-19)
          bottledWines.line8_removedTaxpaid + bottledWines.line9_transferredInBond +
          bottledWines.line10_dumpedToBulk + bottledWines.line11_tasting +
          bottledWines.line12_export + bottledWines.line13_familyUse +
          bottledWines.line14_testing + bottledWines.line15_writeIn +
          bottledWines.line18_breakage + bottledWines.line19_inventoryShortage +
          // Ending inventory (bulk + bottled)
          bulkWines.line31_onHandEnd + bottledWines.line20_onHandEnd
        );
        const reconciliation = {
          totalAvailable: formTotalAvailable,
          totalAccountedFor: formTotalAccountedFor,
          variance: roundGallons(formTotalAvailable - formTotalAccountedFor),
          balanced: Math.abs(roundGallons(formTotalAvailable - formTotalAccountedFor)) < 0.1,
          // Recorded operational losses vs balancing figure for diagnostic comparison
          recordedLosses: {
            total: recordedLosses,
            byTaxClass: Object.fromEntries(
              Object.entries(lossesByTaxClass).map(([k, v]) => [k, roundGallons(v - (clampedByTaxClass[k] || 0))])
            ),
          },
        };

        // ============================================
        // Distillery Operations (Cider/Brandy Tracking)
        // ============================================
        // Note: ciderToDsp, ciderSentToDspGallons, ciderSentShipments
        // computed earlier (before reconciliation)

        // Brandy received from distillery
        // (brandyFromDsp, brandyReceivedGallons, brandyReceivedReturns computed earlier, before reconciliation)
        // brandyBatchIds, brandyUsedInCiderGallons, brandyTransfers computed earlier (before reconciliation)

        const distilleryOperations: DistilleryOperations = {
          brandyOpening,
          ciderSentToDsp: ciderSentToDspGallons,
          ciderSentShipments,
          brandyReceived: brandyReceivedGallons,
          brandyReceivedReturns,
          brandyUsedInCider: brandyUsedInCiderGallons,
          brandyTransfers,
        };

        // 5. Calculate cider/brandy separated inventory
        // Brandy is now excluded from endingInventory (wine-only) via reconstruction loop.
        // We have two brandy volume sources:
        //   - endingBrandyBulkLiters: reconstructed from batch activity (point-in-time accurate)
        //   - transfer-based: brandyOpening + received - usedInCider (TTB formula)

        const endingBrandyBulkGallons = roundGallons(litersToWineGallons(endingBrandyBulkLiters));

        // Calculate brandy based on transfers (TTB-accurate)
        // Brandy ending = Beginning + Received from DSP - Used in cider
        // brandyOpening computed earlier (from TTB opening balances or 0)
        const brandyCalculatedGallons = roundGallons(
          brandyOpening + brandyReceivedGallons - brandyUsedInCiderGallons
        );

        // Use calculated value for TTB accuracy
        const brandyBulkGallons = brandyCalculatedGallons;
        const brandyDataDiscrepancy = roundGallons(endingBrandyBulkGallons - brandyCalculatedGallons);

        // endingInventory.bulk already excludes brandy (brandy filtered in reconstruction loop)
        const ciderBulkGallons = endingInventory.bulk;
        const ciderBottledGallons = endingInventory.bottled; // All bottled is cider for now

        const ciderBrandyInventory: CiderBrandyInventory = {
          cider: {
            bulk: ciderBulkGallons,
            bottled: ciderBottledGallons,
            kegs: 0, // Kegs are included in bottled
            total: roundGallons(ciderBulkGallons + ciderBottledGallons),
          },
          brandy: {
            bulk: brandyBulkGallons, // TTB-calculated value
            total: brandyBulkGallons,
          },
          total: roundGallons(endingInventory.total + brandyBulkGallons),
        };

        // 6. Calculate cider/brandy reconciliation
        // Derived from the balanced form sections (same way as the main reconciliation)
        // Expected = Available - Removals (using balanced form values)
        const expectedCiderEnding = roundGallons(
          formTotalAvailable - (formTotalAccountedFor - bulkWines.line31_onHandEnd - bottledWines.line20_onHandEnd)
        );
        const actualCiderEnding = ciderBrandyInventory.cider.total;
        const ciderDiscrepancy = roundGallons(actualCiderEnding - expectedCiderEnding);

        // Brandy: Opening (0) + Received - UsedInCider = Expected
        // Note: expectedBrandyEnding equals brandyCalculatedGallons (calculated above)
        const expectedBrandyEnding = brandyCalculatedGallons;
        // For TTB, we report the calculated value as actual (transfer-based, accurate)
        const actualBrandyEnding = brandyCalculatedGallons;
        // TTB discrepancy should be 0 since we use calculated values
        const brandyDiscrepancy = 0;

        const ciderBrandyReconciliation: CiderBrandyReconciliation = {
          cider: {
            expectedEnding: expectedCiderEnding,
            actualEnding: actualCiderEnding,
            discrepancy: ciderDiscrepancy,
          },
          brandy: {
            expectedEnding: expectedBrandyEnding,
            actualEnding: actualBrandyEnding,
            discrepancy: brandyDiscrepancy,
            // Include data integrity info for troubleshooting
            systemReported: endingBrandyBulkGallons,
            dataDiscrepancy: brandyDataDiscrepancy,
          },
          total: {
            expectedEnding: roundGallons(expectedCiderEnding + expectedBrandyEnding),
            actualEnding: roundGallons(actualCiderEnding + actualBrandyEnding),
            discrepancy: roundGallons(ciderDiscrepancy + brandyDiscrepancy),
          },
        };

        // Note: ciderSentToDspGallons is already included in bulkWines.line16_distillingMaterial
        // and line32_total during initial construction above — no post-hoc update needed.

        // ============================================
        // Build Response
        // ============================================

        const formData: TTBForm512017Data = {
          reportingPeriod: {
            type: periodType,
            startDate,
            endDate,
            year,
            month: periodType === "monthly" ? periodNumber : undefined,
            quarter: periodType === "quarterly" ? periodNumber : undefined,
          },
          bulkWines,
          bottledWines,
          materials,
          fermenters,
          beginningInventory,
          wineProduced: {
            total: wineProducedGallons, // Press runs + juice purchases (pommeau juice already included)
          },
          receipts: {
            total: roundGallons(positiveAdjustmentGallons + brandyUsedInCiderGallons),
          },
          taxPaidRemovals,
          otherRemovals,
          endingInventory,
          taxSummary,
          reconciliation,
          distilleryOperations,
          ciderBrandyInventory,
          ciderBrandyReconciliation,
          bulkWinesByTaxClass,
          bottledWinesByTaxClass,
          taxComputationByClass,
        };

        return {
          formData,
          periodLabel: formatPeriodLabel(periodType, year, periodNumber),
        };
      } catch (error) {
        console.error("Error generating TTB form data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate TTB form data",
        });
      }
    }),

  /**
   * Save a TTB report snapshot for audit/compliance purposes.
   */
  saveReportSnapshot: createRbacProcedure("create", "report")
    .input(saveReportSnapshotInput)
    .mutation(async ({ input, ctx }) => {
      try {
        const [report] = await db
          .insert(ttbReportingPeriods)
          .values({
            periodType: input.periodType,
            periodStart: input.periodStart.toISOString().split("T")[0],
            periodEnd: input.periodEnd.toISOString().split("T")[0],
            beginningInventoryBulkGallons:
              input.data.beginningInventoryBulkGallons?.toString(),
            beginningInventoryBottledGallons:
              input.data.beginningInventoryBottledGallons?.toString(),
            beginningInventoryTotalGallons:
              input.data.beginningInventoryTotalGallons?.toString(),
            wineProducedGallons: input.data.wineProducedGallons?.toString(),
            taxPaidTastingRoomGallons:
              input.data.taxPaidTastingRoomGallons?.toString(),
            taxPaidWholesaleGallons:
              input.data.taxPaidWholesaleGallons?.toString(),
            taxPaidOnlineDtcGallons:
              input.data.taxPaidOnlineDtcGallons?.toString(),
            taxPaidEventsGallons: input.data.taxPaidEventsGallons?.toString(),
            taxPaidRemovalsTotalGallons:
              input.data.taxPaidRemovalsTotalGallons?.toString(),
            otherRemovalsSamplesGallons:
              input.data.otherRemovalsSamplesGallons?.toString(),
            otherRemovalsBreakageGallons:
              input.data.otherRemovalsBreakageGallons?.toString(),
            otherRemovalsLossesGallons:
              input.data.otherRemovalsLossesGallons?.toString(),
            otherRemovalsTotalGallons:
              input.data.otherRemovalsTotalGallons?.toString(),
            endingInventoryBulkGallons:
              input.data.endingInventoryBulkGallons?.toString(),
            endingInventoryBottledGallons:
              input.data.endingInventoryBottledGallons?.toString(),
            endingInventoryTotalGallons:
              input.data.endingInventoryTotalGallons?.toString(),
            taxableGallons: input.data.taxableGallons?.toString(),
            taxRate: input.data.taxRate?.toString(),
            smallProducerCreditGallons:
              input.data.smallProducerCreditGallons?.toString(),
            smallProducerCreditAmount:
              input.data.smallProducerCreditAmount?.toString(),
            taxOwed: input.data.taxOwed?.toString(),
            notes: input.notes,
            generatedBy: ctx.user.id,
            status: "draft",
          })
          .returning();

        return { success: true, report };
      } catch (error) {
        console.error("Error saving TTB report snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save TTB report snapshot",
        });
      }
    }),

  /**
   * Get the latest un-finalized period based on org settings.
   * Returns the periodType from settings and the next period that needs filing.
   */
  getLatestNeededPeriod: protectedProcedure.query(async (): Promise<{
    periodType: "monthly" | "quarterly" | "annual";
    year: number;
    periodNumber: number | undefined;
  }> => {
    try {
      // 1. Get org settings for frequency and opening balance date
      const [settings] = await db
        .select({
          ttbReportingFrequency: organizationSettings.ttbReportingFrequency,
          ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
        })
        .from(organizationSettings)
        .limit(1);

      const periodType = (settings?.ttbReportingFrequency ?? "quarterly") as "monthly" | "quarterly" | "annual";

      // 2. Find the latest finalized snapshot for this frequency
      const [latestFinalized] = await db
        .select({
          year: ttbPeriodSnapshots.year,
          periodNumber: ttbPeriodSnapshots.periodNumber,
        })
        .from(ttbPeriodSnapshots)
        .where(
          and(
            eq(ttbPeriodSnapshots.status, "finalized"),
            eq(ttbPeriodSnapshots.periodType, periodType)
          )
        )
        .orderBy(desc(ttbPeriodSnapshots.year), desc(ttbPeriodSnapshots.periodNumber))
        .limit(1);

      // 3. Compute the next period after the latest finalized one
      if (latestFinalized) {
        const lastYear = latestFinalized.year;
        const lastPeriod = latestFinalized.periodNumber;

        if (periodType === "annual") {
          return { periodType, year: lastYear + 1, periodNumber: undefined };
        } else if (periodType === "quarterly") {
          const maxPeriod = 4;
          if (lastPeriod && lastPeriod < maxPeriod) {
            return { periodType, year: lastYear, periodNumber: lastPeriod + 1 };
          } else {
            return { periodType, year: lastYear + 1, periodNumber: 1 };
          }
        } else {
          // monthly
          const maxPeriod = 12;
          if (lastPeriod && lastPeriod < maxPeriod) {
            return { periodType, year: lastYear, periodNumber: lastPeriod + 1 };
          } else {
            return { periodType, year: lastYear + 1, periodNumber: 1 };
          }
        }
      }

      // 4. No finalized periods — use opening balance date year + 1
      const openingBalanceDate = settings?.ttbOpeningBalanceDate;
      const baseYear = openingBalanceDate
        ? new Date(openingBalanceDate).getFullYear() + 1
        : new Date().getFullYear();

      if (periodType === "annual") {
        return { periodType, year: baseYear, periodNumber: undefined };
      } else {
        return { periodType, year: baseYear, periodNumber: 1 };
      }
    } catch (error) {
      console.error("Error getting latest needed TTB period:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to determine latest needed TTB period",
      });
    }
  }),

  /**
   * Get saved TTB report history.
   */
  getReportHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
        year: z.number().int().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const conditions = [];

        if (input.year) {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${ttbReportingPeriods.periodStart}) = ${input.year}`
          );
        }

        const reports = await db
          .select({
            id: ttbReportingPeriods.id,
            periodType: ttbReportingPeriods.periodType,
            periodStart: ttbReportingPeriods.periodStart,
            periodEnd: ttbReportingPeriods.periodEnd,
            status: ttbReportingPeriods.status,
            taxOwed: ttbReportingPeriods.taxOwed,
            taxPaidRemovalsTotalGallons:
              ttbReportingPeriods.taxPaidRemovalsTotalGallons,
            createdAt: ttbReportingPeriods.createdAt,
            generatedByName: users.name,
          })
          .from(ttbReportingPeriods)
          .leftJoin(users, eq(ttbReportingPeriods.generatedBy, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(ttbReportingPeriods.periodStart))
          .limit(input.limit)
          .offset(input.offset);

        const totalResult = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(ttbReportingPeriods)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
          reports,
          total: totalResult[0]?.count || 0,
          hasMore: (input.offset + input.limit) < (totalResult[0]?.count || 0),
        };
      } catch (error) {
        console.error("Error fetching TTB report history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch TTB report history",
        });
      }
    }),

  /**
   * Get a specific saved report by ID.
   */
  getReport: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input: reportId }) => {
      try {
        const [report] = await db
          .select()
          .from(ttbReportingPeriods)
          .where(eq(ttbReportingPeriods.id, reportId))
          .limit(1);

        if (!report) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found",
          });
        }

        return report;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching TTB report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch TTB report",
        });
      }
    }),

  /**
   * Mark a report as submitted.
   */
  submitReport: createRbacProcedure("update", "report")
    .input(z.string().uuid())
    .mutation(async ({ input: reportId, ctx }) => {
      try {
        const [updated] = await db
          .update(ttbReportingPeriods)
          .set({
            status: "submitted",
            submittedAt: new Date(),
            submittedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(ttbReportingPeriods.id, reportId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found",
          });
        }

        return { success: true, report: updated };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error submitting TTB report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit TTB report",
        });
      }
    }),

  // ============================================
  // TTB Opening Balances & Period Snapshots
  // ============================================

  /**
   * Get TTB opening balances from organization settings.
   * Used for initial system setup and beginning inventory calculation.
   */
  getOpeningBalances: protectedProcedure.query(async () => {
    try {
      const [settings] = await db
        .select({
          ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
          ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
          ttbReconciliationNotes: organizationSettings.ttbReconciliationNotes,
        })
        .from(organizationSettings)
        .limit(1);

      const defaultBalances: TTBOpeningBalances = {
        bulk: {
          hardCider: 0,
          wineUnder16: 0,
          wine16To21: 0,
          wine21To24: 0,
          sparklingWine: 0,
          carbonatedWine: 0,
        },
        bottled: {
          hardCider: 0,
          wineUnder16: 0,
          wine16To21: 0,
          wine21To24: 0,
          sparklingWine: 0,
          carbonatedWine: 0,
        },
        spirits: {
          appleBrandy: 0,
          grapeSpirits: 0,
        },
      };

      return {
        date: settings?.ttbOpeningBalanceDate || null,
        balances: settings?.ttbOpeningBalances || defaultBalances,
        reconciliationNotes: settings?.ttbReconciliationNotes || null,
      };
    } catch (error) {
      console.error("Error fetching TTB opening balances:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch TTB opening balances",
      });
    }
  }),

  /**
   * Update TTB opening balances (admin only).
   * Sets the starting point for TTB inventory tracking.
   */
  updateOpeningBalances: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
        balances: z.object({
          bulk: z.object({
            hardCider: z.number().min(0),
            wineUnder16: z.number().min(0),
            wine16To21: z.number().min(0),
            wine21To24: z.number().min(0),
            sparklingWine: z.number().min(0),
            carbonatedWine: z.number().min(0),
          }),
          bottled: z.object({
            hardCider: z.number().min(0),
            wineUnder16: z.number().min(0),
            wine16To21: z.number().min(0),
            wine21To24: z.number().min(0),
            sparklingWine: z.number().min(0),
            carbonatedWine: z.number().min(0),
          }),
          spirits: z.object({
            appleBrandy: z.number().min(0),
            grapeSpirits: z.number().min(0),
          }),
        }),
        reconciliationNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const [updated] = await db
          .update(organizationSettings)
          .set({
            ttbOpeningBalanceDate: input.date,
            ttbOpeningBalances: input.balances,
            ttbReconciliationNotes: input.reconciliationNotes ?? null,
            updatedAt: new Date(),
          })
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization settings not found",
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating TTB opening balances:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update TTB opening balances",
        });
      }
    }),

  /**
   * Get configurable TTB classification thresholds and tax rates.
   * Returns defaults if not configured.
   */
  getTTBClassificationConfig: protectedProcedure.query(async () => {
    try {
      const [settings] = await db
        .select({
          ttbClassificationConfig: organizationSettings.ttbClassificationConfig,
        })
        .from(organizationSettings)
        .limit(1);

      return (settings?.ttbClassificationConfig as TTBClassificationConfig | null) ?? DEFAULT_TTB_CLASSIFICATION_CONFIG;
    } catch (error) {
      console.error("Error fetching TTB classification config:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch TTB classification config",
      });
    }
  }),

  /**
   * Update TTB classification thresholds and tax rates (admin only).
   */
  updateTTBClassificationConfig: adminProcedure
    .input(
      z.object({
        thresholds: z.object({
          hardCider: z.object({
            maxAbv: z.number().min(0).max(100),
            minAbv: z.number().min(0).max(100),
            maxCo2GramsPer100ml: z.number().min(0),
            allowedFruitSources: z.array(z.string()).min(1),
          }),
          stillWineMaxCo2GramsPer100ml: z.number().min(0),
          abvBrackets: z.object({
            under16MaxAbv: z.number().min(0).max(100),
            midRangeMaxAbv: z.number().min(0).max(100),
            upperMaxAbv: z.number().min(0).max(100),
          }),
        }),
        taxRates: z.object({
          hardCider: z.number().min(0),
          wineUnder16: z.number().min(0),
          wine16To21: z.number().min(0),
          wine21To24: z.number().min(0),
          carbonatedWine: z.number().min(0),
          sparklingWine: z.number().min(0),
        }),
        cbmaCredits: z.object({
          smallProducerCreditPerGallon: z.number().min(0),
          creditLimitGallons: z.number().min(0),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const [updated] = await db
          .update(organizationSettings)
          .set({
            ttbClassificationConfig: input,
            updatedAt: new Date(),
          })
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization settings not found",
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating TTB classification config:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update TTB classification config",
        });
      }
    }),

  /**
   * Get the most recent finalized period snapshot before a given date.
   * Used to determine beginning inventory for a period.
   */
  getPreviousSnapshot: protectedProcedure
    .input(
      z.object({
        beforeDate: z.string().transform((s) => new Date(s)),
        periodType: z.enum(["monthly", "quarterly", "annual"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const conditions = [
          eq(ttbPeriodSnapshots.status, "finalized"),
          lt(ttbPeriodSnapshots.periodEnd, input.beforeDate.toISOString().split("T")[0]),
        ];

        if (input.periodType) {
          conditions.push(eq(ttbPeriodSnapshots.periodType, input.periodType));
        }

        const [snapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(and(...conditions))
          .orderBy(desc(ttbPeriodSnapshots.periodEnd))
          .limit(1);

        return snapshot || null;
      } catch (error) {
        console.error("Error fetching previous TTB snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch previous TTB snapshot",
        });
      }
    }),

  /**
   * List period snapshots for a year.
   */
  listPeriodSnapshots: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
        periodType: z.enum(["monthly", "quarterly", "annual"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const conditions = [eq(ttbPeriodSnapshots.year, input.year)];

        if (input.periodType) {
          conditions.push(eq(ttbPeriodSnapshots.periodType, input.periodType));
        }

        const snapshots = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(and(...conditions))
          .orderBy(asc(ttbPeriodSnapshots.periodStart));

        return snapshots;
      } catch (error) {
        console.error("Error listing TTB period snapshots:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list TTB period snapshots",
        });
      }
    }),

  /**
   * Create or update a period snapshot.
   * Used to save TTB report data for a specific period.
   */
  savePeriodSnapshot: createRbacProcedure("create", "report")
    .input(
      z.object({
        periodType: z.enum(["monthly", "quarterly", "annual"]),
        year: z.number().int().min(2020).max(2100),
        periodNumber: z.number().int().min(1).max(12).optional(),
        periodStart: z.string(),
        periodEnd: z.string(),
        data: z.object({
          // Bulk wines by tax class
          bulkHardCider: z.number().default(0),
          bulkWineUnder16: z.number().default(0),
          bulkWine16To21: z.number().default(0),
          bulkWine21To24: z.number().default(0),
          bulkSparklingWine: z.number().default(0),
          bulkCarbonatedWine: z.number().default(0),
          // Bottled wines by tax class
          bottledHardCider: z.number().default(0),
          bottledWineUnder16: z.number().default(0),
          bottledWine16To21: z.number().default(0),
          bottledWine21To24: z.number().default(0),
          bottledSparklingWine: z.number().default(0),
          bottledCarbonatedWine: z.number().default(0),
          // Spirits
          spiritsAppleBrandy: z.number().default(0),
          spiritsGrape: z.number().default(0),
          spiritsOther: z.number().default(0),
          // Production
          producedHardCider: z.number().default(0),
          producedWineUnder16: z.number().default(0),
          producedWine16To21: z.number().default(0),
          // Tax-paid removals by channel
          taxpaidTastingRoom: z.number().default(0),
          taxpaidWholesale: z.number().default(0),
          taxpaidOnlineDtc: z.number().default(0),
          taxpaidEvents: z.number().default(0),
          taxpaidOther: z.number().default(0),
          // Other removals
          removedSamples: z.number().default(0),
          removedBreakage: z.number().default(0),
          removedProcessLoss: z.number().default(0),
          removedDistilling: z.number().default(0),
          // Materials
          materialsApplesLbs: z.number().default(0),
          materialsOtherFruitLbs: z.number().default(0),
          materialsJuiceGallons: z.number().default(0),
          materialsSugarLbs: z.number().default(0),
          // Tax calculation
          taxHardCider: z.number().default(0),
          taxWineUnder16: z.number().default(0),
          taxWine16To21: z.number().default(0),
          taxSmallProducerCredit: z.number().default(0),
          taxTotal: z.number().default(0),
        }),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check for existing snapshot for this period
        const existing = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(
            and(
              eq(ttbPeriodSnapshots.periodType, input.periodType),
              eq(ttbPeriodSnapshots.year, input.year),
              input.periodNumber
                ? eq(ttbPeriodSnapshots.periodNumber, input.periodNumber)
                : isNull(ttbPeriodSnapshots.periodNumber)
            )
          )
          .limit(1);

        const snapshotData = {
          periodType: input.periodType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          year: input.year,
          periodNumber: input.periodNumber || null,
          // Bulk wines
          bulkHardCider: input.data.bulkHardCider.toString(),
          bulkWineUnder16: input.data.bulkWineUnder16.toString(),
          bulkWine16To21: input.data.bulkWine16To21.toString(),
          bulkWine21To24: input.data.bulkWine21To24.toString(),
          bulkSparklingWine: input.data.bulkSparklingWine.toString(),
          bulkCarbonatedWine: input.data.bulkCarbonatedWine.toString(),
          // Bottled wines
          bottledHardCider: input.data.bottledHardCider.toString(),
          bottledWineUnder16: input.data.bottledWineUnder16.toString(),
          bottledWine16To21: input.data.bottledWine16To21.toString(),
          bottledWine21To24: input.data.bottledWine21To24.toString(),
          bottledSparklingWine: input.data.bottledSparklingWine.toString(),
          bottledCarbonatedWine: input.data.bottledCarbonatedWine.toString(),
          // Spirits
          spiritsAppleBrandy: input.data.spiritsAppleBrandy.toString(),
          spiritsGrape: input.data.spiritsGrape.toString(),
          spiritsOther: input.data.spiritsOther.toString(),
          // Production
          producedHardCider: input.data.producedHardCider.toString(),
          producedWineUnder16: input.data.producedWineUnder16.toString(),
          producedWine16To21: input.data.producedWine16To21.toString(),
          // Tax-paid removals
          taxpaidTastingRoom: input.data.taxpaidTastingRoom.toString(),
          taxpaidWholesale: input.data.taxpaidWholesale.toString(),
          taxpaidOnlineDtc: input.data.taxpaidOnlineDtc.toString(),
          taxpaidEvents: input.data.taxpaidEvents.toString(),
          taxpaidOther: input.data.taxpaidOther.toString(),
          // Other removals
          removedSamples: input.data.removedSamples.toString(),
          removedBreakage: input.data.removedBreakage.toString(),
          removedProcessLoss: input.data.removedProcessLoss.toString(),
          removedDistilling: input.data.removedDistilling.toString(),
          // Materials
          materialsApplesLbs: input.data.materialsApplesLbs.toString(),
          materialsOtherFruitLbs: input.data.materialsOtherFruitLbs.toString(),
          materialsJuiceGallons: input.data.materialsJuiceGallons.toString(),
          materialsSugarLbs: input.data.materialsSugarLbs.toString(),
          // Tax calculation
          taxHardCider: input.data.taxHardCider.toString(),
          taxWineUnder16: input.data.taxWineUnder16.toString(),
          taxWine16To21: input.data.taxWine16To21.toString(),
          taxSmallProducerCredit: input.data.taxSmallProducerCredit.toString(),
          taxTotal: input.data.taxTotal.toString(),
          notes: input.notes || null,
          updatedAt: new Date(),
        };

        if (existing[0]) {
          // Don't allow updating finalized snapshots
          if (existing[0].status === "finalized") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot modify a finalized period snapshot",
            });
          }

          const [updated] = await db
            .update(ttbPeriodSnapshots)
            .set(snapshotData)
            .where(eq(ttbPeriodSnapshots.id, existing[0].id))
            .returning();

          return { success: true, snapshot: updated, created: false };
        } else {
          const [created] = await db
            .insert(ttbPeriodSnapshots)
            .values({
              ...snapshotData,
              status: "draft",
              createdBy: ctx.user.id,
              createdAt: new Date(),
            })
            .returning();

          return { success: true, snapshot: created, created: true };
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error saving TTB period snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save TTB period snapshot",
        });
      }
    }),

  /**
   * Finalize a period snapshot.
   * Once finalized, the ending inventory becomes the beginning inventory for the next period.
   */
  finalizePeriodSnapshot: createRbacProcedure("update", "report")
    .input(z.string().uuid())
    .mutation(async ({ input: snapshotId, ctx }) => {
      try {
        const [snapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(eq(ttbPeriodSnapshots.id, snapshotId))
          .limit(1);

        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Period snapshot not found",
          });
        }

        if (snapshot.status === "finalized") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Period snapshot is already finalized",
          });
        }

        const [updated] = await db
          .update(ttbPeriodSnapshots)
          .set({
            status: "finalized",
            finalizedAt: new Date(),
            finalizedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(ttbPeriodSnapshots.id, snapshotId))
          .returning();

        return { success: true, snapshot: updated };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error finalizing TTB period snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to finalize TTB period snapshot",
        });
      }
    }),

  /**
   * Get beginning inventory for a period.
   * Checks: 1) Previous finalized snapshot, 2) Opening balances, 3) Live calculation
   */
  getBeginningInventory: protectedProcedure
    .input(
      z.object({
        periodStart: z.string().transform((s) => new Date(s)),
      })
    )
    .query(async ({ input }) => {
      try {
        // 1. Check for previous finalized snapshot
        const [previousSnapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(
            and(
              eq(ttbPeriodSnapshots.status, "finalized"),
              lt(ttbPeriodSnapshots.periodEnd, input.periodStart.toISOString().split("T")[0])
            )
          )
          .orderBy(desc(ttbPeriodSnapshots.periodEnd))
          .limit(1);

        if (previousSnapshot) {
          // Use ending inventory from previous finalized snapshot
          return {
            source: "snapshot" as const,
            snapshotId: previousSnapshot.id,
            snapshotPeriodEnd: previousSnapshot.periodEnd,
            bulk: {
              hardCider: Number(previousSnapshot.bulkHardCider || 0),
              wineUnder16: Number(previousSnapshot.bulkWineUnder16 || 0),
              wine16To21: Number(previousSnapshot.bulkWine16To21 || 0),
              wine21To24: Number(previousSnapshot.bulkWine21To24 || 0),
              sparklingWine: Number(previousSnapshot.bulkSparklingWine || 0),
              carbonatedWine: Number(previousSnapshot.bulkCarbonatedWine || 0),
            },
            bottled: {
              hardCider: Number(previousSnapshot.bottledHardCider || 0),
              wineUnder16: Number(previousSnapshot.bottledWineUnder16 || 0),
              wine16To21: Number(previousSnapshot.bottledWine16To21 || 0),
              wine21To24: Number(previousSnapshot.bottledWine21To24 || 0),
              sparklingWine: Number(previousSnapshot.bottledSparklingWine || 0),
              carbonatedWine: Number(previousSnapshot.bottledCarbonatedWine || 0),
            },
            spirits: {
              appleBrandy: Number(previousSnapshot.spiritsAppleBrandy || 0),
              grapeSpirits: Number(previousSnapshot.spiritsGrape || 0),
            },
          };
        }

        // 2. Check for opening balances
        const [settings] = await db
          .select({
            ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
            ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
          })
          .from(organizationSettings)
          .limit(1);

        if (settings?.ttbOpeningBalances && settings.ttbOpeningBalanceDate) {
          const openingDate = new Date(settings.ttbOpeningBalanceDate);
          // Only use opening balances if the period starts on or after the opening balance date
          if (input.periodStart >= openingDate) {
            const balances = settings.ttbOpeningBalances;
            return {
              source: "opening_balances" as const,
              openingBalanceDate: settings.ttbOpeningBalanceDate,
              bulk: balances.bulk,
              bottled: balances.bottled,
              spirits: balances.spirits,
            };
          }
        }

        // 3. Return zeros if no prior data
        return {
          source: "none" as const,
          bulk: {
            hardCider: 0,
            wineUnder16: 0,
            wine16To21: 0,
            wine21To24: 0,
            sparklingWine: 0,
            carbonatedWine: 0,
          },
          bottled: {
            hardCider: 0,
            wineUnder16: 0,
            wine16To21: 0,
            wine21To24: 0,
            sparklingWine: 0,
            carbonatedWine: 0,
          },
          spirits: {
            appleBrandy: 0,
            grapeSpirits: 0,
          },
        };
      } catch (error) {
        console.error("Error getting beginning inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get beginning inventory",
        });
      }
    }),

  /**
   * Get reconciliation summary comparing TTB opening balances with real physical inventory.
   * Shows where all the cider went: on hand, sold, lost, or untracked.
   *
   * Formula: TTB Opening Balance = Current Inventory + Removals + Legacy Batches
   *
   * This compares:
   * - TTB Opening Balance (what was reported to TTB as on-hand)
   * - Current Inventory (batches in vessels + packaged goods on hand)
   * - Removals (sales + losses + samples since TTB date)
   * - Legacy Batches (manually created pre-system inventory)
   *
   * @param asOfDate - Optional date to reconcile as of (default: current date)
   *                   For initial TTB setup, use the TTB opening balance date
   *                   For ongoing reconciliation, use any date
   */
  getReconciliationSummary: protectedProcedure
    .input(
      z.object({
        asOfDate: z.string().optional(), // ISO date string, defaults to today (legacy, used as endDate)
        startDate: z.string().optional(), // ISO date string for period start
        endDate: z.string().optional(),   // ISO date string for period end
      }).optional()
    )
    .query(async ({ input }) => {
    try {
      // 1. Get TTB opening balances and safeguard config
      const [settings] = await db
        .select({
          ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
          ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
          ttbVarianceThresholdPct: organizationSettings.ttbVarianceThresholdPct,
          reconciliationLockedYears: organizationSettings.reconciliationLockedYears,
        })
        .from(organizationSettings)
        .limit(1);

      if (!settings?.ttbOpeningBalanceDate || !settings?.ttbOpeningBalances) {
        return {
          hasOpeningBalances: false,
          openingBalanceDate: null,
          reconciliationDate: null,
          isInitialReconciliation: false,
          taxClasses: [],
          totals: {
            ttbBalance: 0,
            currentInventory: 0,
            removals: 0,
            legacyBatches: 0,
            difference: 0,
          },
          breakdown: {
            bulkInventory: 0,
            packagedInventory: 0,
            sales: 0,
            losses: 0,
          },
          inventoryByYear: [],
          productionAudit: {
            totals: {
              pressRuns: 0,
              juicePurchases: 0,
              totalProduction: 0,
            },
            byYear: [],
          },
          // Include empty batchDetailsByTaxClass for consistent return type
          batchDetailsByTaxClass: {},
          // Include empty waterfall for consistent return type
          waterfall: {
            periodStart: null,
            periodEnd: null,
            hasLastReconciliation: false,
            byTaxClass: [],
            totals: {
              opening: 0,
              production: 0,
              transfersIn: 0,
              transfersOut: 0,
              positiveAdj: 0,
              packaging: 0,
              losses: 0,
              distillation: 0,
              sales: 0,
              calculatedEnding: 0,
              physical: 0,
              variance: 0,
            },
          },
          batchReconciliation: {
            startDate: null,
            endDate: null,
            identityCheck: 0,
            totals: { opening: 0, production: 0, positiveAdj: 0, packaging: 0, losses: 0, sales: 0, distillation: 0, ending: 0 },
            lossBreakdown: { racking: 0, filter: 0, bottling: 0, kegging: 0, transfer: 0, pressTransfer: 0, adjustments: 0 },
            batchesWithIdentityIssues: 0,
            batchesWithDrift: 0,
            batchesWithInitialAnomaly: 0,
            vesselCapacityWarnings: 0,
            batches: [],
          },
          periodStatus: {
            finalizedPeriods: [],
            currentPeriodFinalized: false,
            lastFinalizedDate: null,
          },
        };
      }

      const openingDate = settings.ttbOpeningBalanceDate;
      const balances = settings.ttbOpeningBalances;

      // Determine reconciliation date: use new endDate, legacy asOfDate, or default to today
      const today = new Date().toISOString().split("T")[0];
      const reconciliationDate = input?.endDate || input?.asOfDate || today;
      const reconciliationDateObj = new Date(reconciliationDate);

      // Determine batch reconciliation start date (for batch-derived calculation)
      // Uses explicit startDate, or falls back to opening balance date
      const batchReconStartDate = input?.startDate || openingDate;

      // Check if this is initial reconciliation (reconciling as of TTB opening date)
      // Initial reconciliation = reconciliation date is within 1 day of TTB opening date
      const openingDateObj = new Date(openingDate);
      const daysDiff = Math.abs(
        (reconciliationDateObj.getTime() - openingDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isInitialReconciliation = daysDiff <= 1;

      // Build batch classification map for dynamic tax class determination
      const { map: batchTaxClassMap } = await buildBatchTaxClassMap();

      // ============================================
      // INVENTORY CALCULATION using Production - Removals
      // This is the correct TTB approach that avoids double-counting transfers
      // Formula: Production (press runs + juice purchases) - Removals = Inventory
      // ============================================

      // 2a. PRODUCTION: Press runs completed DURING the period (after opening, on or before reconciliation)
      const pressRunProduction = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(pressRuns)
        .where(
          and(
            isNull(pressRuns.deletedAt),
            eq(pressRuns.status, "completed"),
            sql`${pressRuns.dateCompleted}::date > ${openingDate}::date`,
            sql`${pressRuns.dateCompleted}::date <= ${reconciliationDate}::date`
          )
        );

      const pressRunLiters = Number(pressRunProduction[0]?.totalLiters || 0);

      // 2b. PRODUCTION: Juice purchases on or before the date
      // Note: Must filter both purchase AND item deletedAt to exclude corrected entries
      const juicePurchaseProduction = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(
            CASE
              WHEN ${juicePurchaseItems.volumeUnit} = 'gal' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) * 3.78541
              ELSE CAST(${juicePurchaseItems.volume} AS DECIMAL)
            END
          ), 0)`,
        })
        .from(juicePurchaseItems)
        .innerJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
        .where(
          and(
            isNull(juicePurchases.deletedAt),
            isNull(juicePurchaseItems.deletedAt),
            sql`${juicePurchases.purchaseDate}::date > ${openingDate}::date`,
            sql`${juicePurchases.purchaseDate}::date <= ${reconciliationDate}::date`
          )
        );

      const juicePurchaseLiters = Number(juicePurchaseProduction[0]?.totalLiters || 0);

      // 2c. EXCLUDE: Juice that was never fermented (product_type = 'juice')
      // TTB only tracks alcoholic beverages, not juice that stayed as juice
      const juiceOnlyBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            // Note: do NOT filter by deletedAt here — deleted juice batches (e.g. Melrose)
            // still represent real juice diversions whose press run volume is in pressRunLiters
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            eq(batches.productType, "juice"),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );

      const juiceOnlyLiters = Number(juiceOnlyBatches[0]?.totalLiters || 0);

      // 2d. EXCLUDE: Transfers INTO juice batches (juice that was transferred to a batch that stayed juice)
      // This handles cases where cider batches transferred volume to juice batches
      const transfersIntoJuiceBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            // Note: do NOT filter by batches.deletedAt — deleted juice batches still diverted juice
            eq(batches.productType, "juice"),
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );

      const transfersIntoJuiceLiters = Number(transfersIntoJuiceBatches[0]?.totalLiters || 0);

      // 2e. EXCLUDE: Juice that went into pommeau (never fermented as cider)
      // Same logic as generateForm512017: ABV-derived juice from pommeau batches composed at creation,
      // plus non-brandy transfers into pommeau batches created in the period.
      const BRANDY_ABV = 0.70;
      const pommeauWithInitialDataRecon = await db
        .select({
          initialLiters: sql<number>`CAST(${batches.initialVolumeLiters} AS DECIMAL)`,
          abv: sql<number>`COALESCE(${batches.actualAbv}, ${batches.estimatedAbv}, 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            eq(batches.productType, "pommeau"),
            sql`CAST(${batches.initialVolumeLiters} AS DECIMAL) > 0`,
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );

      let juiceToPommeauLiters = 0;
      let brandyToPommeauLitersRecon = 0;
      for (const row of pommeauWithInitialDataRecon) {
        const initial = Number(row.initialLiters) || 0;
        const abv = (Number(row.abv) || 0) / 100;
        if (initial > 0 && abv > 0 && abv < BRANDY_ABV) {
          juiceToPommeauLiters += initial * (1 - abv / BRANDY_ABV);
          brandyToPommeauLitersRecon += initial * (abv / BRANDY_ABV);
        }
      }

      // Non-brandy transfers into pommeau batches created in the period
      const nonBrandyToPommeauRecon = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(
          sql`${batches} AS dest_batch`,
          sql`${batchTransfers.destinationBatchId} = dest_batch.id`
        )
        .innerJoin(
          sql`${batches} AS source_batch`,
          sql`${batchTransfers.sourceBatchId} = source_batch.id`
        )
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            sql`dest_batch.product_type = 'pommeau'`,
            sql`source_batch.product_type NOT IN ('pommeau', 'brandy')`,
            sql`dest_batch.start_date::date > ${openingDate}::date`,
            sql`dest_batch.start_date::date <= ${reconciliationDate}::date`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      juiceToPommeauLiters += Number(nonBrandyToPommeauRecon[0]?.totalLiters || 0);

      // 2f. Wine production: batches fermented directly as wine (plum, quince),
      // not created by transfer from cider. These are currently counted in pressRunLiters
      // but should be moved from HC production to wine production.
      const wineProductionData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            eq(batches.productType, "wine"),
            sql`CAST(${batches.initialVolumeLiters} AS DECIMAL) > 0`,
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`,
            // Exclude transfer-derived wine batches (e.g., plum wine that received cider)
            // Only count batches that were directly fermented as wine
            or(
              isNull(batches.parentBatchId),
              eq(batches.isRackingDerivative, false)
            )
          )
        );
      const wineProductionLiters = Number(wineProductionData[0]?.totalLiters || 0);

      const totalProductionLiters = pressRunLiters + juicePurchaseLiters - juiceOnlyLiters - transfersIntoJuiceLiters - juiceToPommeauLiters - wineProductionLiters;

      // 3. REMOVALS: Calculate all removals DURING THE PERIOD (after opening, on or before reconciliation)
      // Use NOT IN ('duplicate', 'excluded') to match production queries — all active batches' losses count
      // 3a. Racking losses
      const rackingLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchRackingOperations)
        .innerJoin(batches, eq(batchRackingOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchRackingOperations.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${batchRackingOperations.rackedAt}::date > ${openingDate}::date`,
            sql`${batchRackingOperations.rackedAt}::date <= ${reconciliationDate}::date`,
            sql`(${batchRackingOperations.notes} IS NULL OR ${batchRackingOperations.notes} NOT LIKE '%Historical Record%')`
          )
        );

      const rackingLossesBeforeLiters = Number(rackingLossesBefore[0]?.totalLiters || 0);
      const rackingLossesBeforeGallons = litersToWineGallons(rackingLossesBeforeLiters);

      // 3b. Filter losses
      const filterLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchFilterOperations)
        .innerJoin(batches, eq(batchFilterOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchFilterOperations.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${batchFilterOperations.filteredAt}::date > ${openingDate}::date`,
            sql`${batchFilterOperations.filteredAt}::date <= ${reconciliationDate}::date`
          )
        );

      const filterLossesBeforeLiters = Number(filterLossesBefore[0]?.totalLiters || 0);
      const filterLossesBeforeGallons = litersToWineGallons(filterLossesBeforeLiters);

      // 3c. Bottling losses
      const bottlingLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${bottleRuns.lossUnit} = 'gal' THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(bottleRuns.voidedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${bottleRuns.packagedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const bottlingLossesBeforeLiters = Number(bottlingLossesBefore[0]?.totalLiters || 0);
      const bottlingLossesBeforeGallons = litersToWineGallons(bottlingLossesBeforeLiters);

      // 3d. Transfer losses - from two sources:
      // 1. batch.transferLossL - for batches started during the period
      const batchTransferLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.transferLossL} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );

      // 2. batch_transfers.loss - losses recorded on individual transfers
      const transferOperationLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.loss} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.sourceBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );

      const transferLossesBeforeLiters =
        Number(batchTransferLossesBefore[0]?.totalLiters || 0) +
        Number(transferOperationLossesBefore[0]?.totalLiters || 0);
      const transferLossesBeforeGallons = litersToWineGallons(transferLossesBeforeLiters);

      // 3e. Distillation removals (cider sent to DSP)
      const distillationsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.sourceVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(distillationRecords)
        .innerJoin(batches, eq(distillationRecords.sourceBatchId, batches.id))
        .where(
          and(
            isNull(distillationRecords.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${distillationRecords.sentAt}::date > ${openingDate}::date`,
            sql`${distillationRecords.sentAt}::date <= ${reconciliationDate}::date`
          )
        );

      const distillationsBeforeLiters = Number(distillationsBefore[0]?.totalLiters || 0);
      const distillationsBeforeGallons = litersToWineGallons(distillationsBeforeLiters);

      // 3f. Volume adjustments (losses recorded via manual adjustments)
      const volumeAdjustmentsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(ABS(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL))), 0)`,
        })
        .from(batchVolumeAdjustments)
        .innerJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
        .where(
          and(
            isNull(batchVolumeAdjustments.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date > ${openingDate}::date`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date <= ${reconciliationDate}::date`,
            sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) < 0` // Only negative (loss) adjustments
          )
        );

      const volumeAdjustmentsBeforeLiters = Number(volumeAdjustmentsBefore[0]?.totalLiters || 0);
      const volumeAdjustmentsBeforeGallons = litersToWineGallons(volumeAdjustmentsBeforeLiters);

      // 3f-2. Positive volume adjustments (gains — e.g., reconciliation corrections)
      const positiveAdjustmentsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL)), 0)`,
        })
        .from(batchVolumeAdjustments)
        .innerJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
        .where(
          and(
            isNull(batchVolumeAdjustments.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date > ${openingDate}::date`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date <= ${reconciliationDate}::date`,
            sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) > 0`
          )
        );

      const positiveAdjustmentsBeforeLiters = Number(positiveAdjustmentsBefore[0]?.totalLiters || 0);
      const positiveAdjustmentsBeforeGallons = litersToWineGallons(positiveAdjustmentsBeforeLiters);

      // 3g. Distributions (sales) on or before the date
      // Bottle/can distributions — unfiltered by batch status to match unfiltered production
      const bottleDistributionsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(
            ${bottleRuns.volumeTakenLiters}::numeric -
            CASE WHEN ${bottleRuns.lossUnit} = 'gal'
              THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
              ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
          ), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(bottleRuns.voidedAt),
            isNull(batches.deletedAt),
            // NOTE: Do NOT filter by reconciliationStatus here — distributions from
            // duplicate/excluded batches are physically real (product was sold).
            // Reconciliation status controls bulk inventory accounting, not distributions.
            sql`${bottleRuns.status} IN ('distributed', 'completed')`,
            sql`${bottleRuns.distributedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.distributedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const bottleDistributionsBeforeLiters = Number(bottleDistributionsBefore[0]?.totalLiters || 0);
      const bottleDistributionsBeforeGallons = litersToWineGallons(bottleDistributionsBeforeLiters);

      // Keg distributions (when distributed_at is set, keg left bonded space)
      // Net volume: volumeTaken - loss (filling loss stays on premises, already counted in Losses)
      const kegDistributionsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(
            (CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END)
            - (CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END)
          ), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNotNull(kegFills.distributedAt),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt),
            isNull(batches.deletedAt),
            // NOTE: Do NOT filter by reconciliationStatus — see bottle comment above.
            sql`${kegFills.distributedAt}::date > ${openingDate}::date`,
            sql`${kegFills.distributedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const kegDistributionsBeforeLiters = Number(kegDistributionsBefore[0]?.totalLiters || 0);
      const kegDistributionsBeforeGallons = litersToWineGallons(kegDistributionsBeforeLiters);

      const distributionsBeforeLiters = bottleDistributionsBeforeLiters + kegDistributionsBeforeLiters;
      const distributionsBeforeGallons = litersToWineGallons(distributionsBeforeLiters);

      // 3f. Volume packaged (converted from bulk to packaged) on or before the date
      // Bottles/cans packaged
      const bottlesPackagedBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(bottleRuns.voidedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${bottleRuns.packagedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const bottlesPackagedBeforeGallons = litersToWineGallons(Number(bottlesPackagedBefore[0]?.totalLiters || 0));

      // Kegs filled
      const kegsFilledBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            sql`${kegFills.filledAt}::date > ${openingDate}::date`,
            sql`${kegFills.filledAt}::date <= ${reconciliationDate}::date`
          )
        );

      const kegsFilledBeforeGallons = litersToWineGallons(Number(kegsFilledBefore[0]?.totalLiters || 0));

      const packagedVolumeBeforeGallons = bottlesPackagedBeforeGallons + kegsFilledBeforeGallons;

      // 3h. Keg fill losses
      const kegFillLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt),
            isNull(batches.deletedAt),
            sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
            isNotNull(kegFills.loss),
            sql`${kegFills.filledAt}::date > ${openingDate}::date`,
            sql`${kegFills.filledAt}::date <= ${reconciliationDate}::date`
          )
        );

      const kegFillLossesBeforeLiters = Number(kegFillLossesBefore[0]?.totalLiters || 0);
      const kegFillLossesBeforeGallons = litersToWineGallons(kegFillLossesBeforeLiters);

      // Calculate total losses (process losses) — in liters first, convert once
      const processLossesLiters = rackingLossesBeforeLiters + filterLossesBeforeLiters +
        bottlingLossesBeforeLiters + transferLossesBeforeLiters + volumeAdjustmentsBeforeLiters +
        kegFillLossesBeforeLiters;
      const processLossesGallons = litersToWineGallons(processLossesLiters);

      // Total losses including distillation (sent to DSP)
      const totalLossesGallons = processLossesGallons + distillationsBeforeGallons;

      // ============================================
      // INVENTORY CALCULATION
      // Production - Removals = Total Inventory (Bulk + Packaged)
      // ============================================

      // Total production in gallons
      const totalProductionGallons = litersToWineGallons(totalProductionLiters);

      // Total removals = losses + distributions (sales leave the system)
      const totalRemovalsGallons = totalLossesGallons + distributionsBeforeGallons;

      // Total inventory = production - removals
      const historicalInventoryGallons = totalProductionGallons - totalRemovalsGallons;

      // Split into bulk and packaged:
      // Packaged = volume packaged - distributions
      const historicalPackagedGallons = Math.max(0, packagedVolumeBeforeGallons - distributionsBeforeGallons);

      // Bulk = total inventory - packaged
      const historicalBulkGallons = Math.max(0, historicalInventoryGallons - historicalPackagedGallons);

      // For display breakdown
      const bulkInventoryGallons = historicalBulkGallons;
      const packagedInventoryGallons = historicalPackagedGallons;
      const salesGallons = distributionsBeforeGallons;
      const lossesGallons = processLossesGallons;
      const distillationGallons = distillationsBeforeGallons;

      // Get inventory by year breakdown (using current volume to avoid double-counting transfers)
      const bulkByYearData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${batches.startDate})`,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
          batchCount: sql<number>`COUNT(*)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            eq(batches.reconciliationStatus, "verified"),
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`COALESCE(${batches.currentVolumeLiters}, 0) > 0` // Only count batches with remaining volume
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`);

      const packagedByYearData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${batches.startDate})`,
          totalML: sql<number>`COALESCE(SUM(
            CAST(${inventoryItems.currentQuantity} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL)
          ), 0)`,
          itemCount: sql<number>`COUNT(DISTINCT ${inventoryItems.id})`,
        })
        .from(inventoryItems)
        .innerJoin(bottleRuns, eq(inventoryItems.bottleRunId, bottleRuns.id))
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            sql`${inventoryItems.currentQuantity} > 0`,
            sql`${batches.startDate} <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`);

      // Build inventory by year breakdown
      const yearMap = new Map<number, { bulk: number; packaged: number; batchCount: number; itemCount: number }>();

      for (const row of bulkByYearData) {
        const year = Number(row.year);
        const existing = yearMap.get(year) || { bulk: 0, packaged: 0, batchCount: 0, itemCount: 0 };
        existing.bulk = litersToWineGallons(Number(row.totalLiters || 0));
        existing.batchCount = Number(row.batchCount || 0);
        yearMap.set(year, existing);
      }

      for (const row of packagedByYearData) {
        const year = Number(row.year);
        const existing = yearMap.get(year) || { bulk: 0, packaged: 0, batchCount: 0, itemCount: 0 };
        existing.packaged = mlToWineGallons(Number(row.totalML || 0));
        existing.itemCount = Number(row.itemCount || 0);
        yearMap.set(year, existing);
      }

      const inventoryByYear = Array.from(yearMap.entries())
        .map(([year, data]) => ({
          year,
          bulkGallons: parseFloat(data.bulk.toFixed(1)),
          packagedGallons: parseFloat(data.packaged.toFixed(1)),
          totalGallons: parseFloat((data.bulk + data.packaged).toFixed(1)),
          batchCount: data.batchCount,
          itemCount: data.itemCount,
        }))
        .sort((a, b) => a.year - b.year);

      // ============================================
      // INVENTORY BY TAX CLASS — SBD-DERIVED (single source of truth)
      // Uses computeSystemCalculatedOnHand to reconstruct per-batch volume
      // at reconciliationDate from operations, never relies on LIVE currentVolumeLiters.
      // This eliminates post-period drift and aggregate-vs-per-batch structural residual.
      // ============================================

      // Compute SBD per-batch volumes at reconciliationDate
      const allEligibleBatchesForInventory = await db
        .select({
          id: batches.id,
          startDate: batches.startDate,
          productType: batches.productType,
          reconciliationStatus: batches.reconciliationStatus,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`(COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded') OR ${batches.isRackingDerivative} IS TRUE OR ${batches.parentBatchId} IS NOT NULL)`,
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
          )
        );
      const sbdResult = await computeSystemCalculatedOnHand(
        allEligibleBatchesForInventory.map((b) => b.id),
        reconciliationDate,
      );

      // Filter dup/excluded batches from bulk inventory (same filter as waterfall aggregation).
      // The eligible batch query includes them via parentBatchId IS NOT NULL for SBD reconstruction,
      // but they must NOT count toward bulk inventory totals.
      const dupExcludedInventoryIds = new Set(
        allEligibleBatchesForInventory
          .filter(b => (b.reconciliationStatus === 'duplicate' || b.reconciliationStatus === 'excluded'))
          .map(b => b.id)
      );
      const filteredPerBatch = new Map(
        [...sbdResult.perBatch].filter(([batchId]) => !dupExcludedInventoryIds.has(batchId))
      );

      // Build per-tax-class bulk inventory from SBD reconstruction (in liters)
      const sbdProductTypes = new Map<string, string | null>();
      for (const b of allEligibleBatchesForInventory) sbdProductTypes.set(b.id, b.productType);
      const sbdByClassLiters = computePerTaxClassBulkInventory(filteredPerBatch, batchTaxClassMap, sbdProductTypes);

      // Build inventory by tax class (gallons)
      const inventoryByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      let actualBulkGallons = 0;
      let actualPackagedGallons = 0;
      const bulkByTaxClass: Record<string, number> = {
        hardCider: 0, wineUnder16: 0, wine16To21: 0, wine21To24: 0,
        sparklingWine: 0, carbonatedWine: 0, appleBrandy: 0, grapeSpirits: 0,
      };
      const packagedByTaxClass: Record<string, number> = {
        hardCider: 0, wineUnder16: 0, wine16To21: 0, wine21To24: 0,
        sparklingWine: 0, carbonatedWine: 0, appleBrandy: 0, grapeSpirits: 0,
      };
      {
        // Populate bulk inventory from SBD-derived per-tax-class values
        for (const [taxClass, liters] of Object.entries(sbdByClassLiters)) {
          const volumeGallons = litersToWineGallons(liters);
          inventoryByTaxClass[taxClass] = (inventoryByTaxClass[taxClass] || 0) + volumeGallons;
          bulkByTaxClass[taxClass] = (bulkByTaxClass[taxClass] || 0) + volumeGallons;
          actualBulkGallons += volumeGallons;
        }

        // Add packaged bottle inventory: runs packaged by reconciliationDate but NOT yet distributed
        // Uses bottle_runs directly (date-bounded) instead of LIVE inventoryItems.currentQuantity
        const packagedByBatch = await db
          .select({
            batchId: batches.id,
            productType: batches.productType,
            totalLiters: sql<number>`COALESCE(SUM(
              ${bottleRuns.volumeTakenLiters}::numeric -
              CASE WHEN ${bottleRuns.lossUnit} = 'gal'
                THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
                ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
            ), 0)`,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(
            and(
              isNull(bottleRuns.voidedAt),
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`,
              sql`(${bottleRuns.distributedAt} IS NULL OR ${bottleRuns.distributedAt}::date > ${reconciliationDate}::date)`
            )
          )
          .groupBy(batches.id, batches.productType);

        for (const row of packagedByBatch) {
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
          if (!taxClass) continue; // Skip juice (non-taxable)
          const volumeGallons = litersToWineGallons(Number(row.totalLiters || 0));
          inventoryByTaxClass[taxClass] += volumeGallons;
          packagedByTaxClass[taxClass] += volumeGallons;
          actualPackagedGallons += volumeGallons;
        }

        // Add undistributed keg fill volume (kegs filled but not yet distributed)
        // These kegs are real physical inventory — volume was removed from bulk
        // (currentVolumeLiters reduced) when filled, and must be counted as packaged.
        // Undistributed keg fills: filled by reconciliationDate but NOT distributed by that date
        // Uses date-bounded filter instead of LIVE distributedAt IS NULL
        const kegOnHand = await db
          .select({
            batchId: batches.id,
            productType: batches.productType,
            totalLiters: sql<number>`COALESCE(SUM(
              (CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END)
              - (CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END)
            ), 0)`,
          })
          .from(kegFills)
          .innerJoin(batches, eq(kegFills.batchId, batches.id))
          .where(
            and(
              isNull(kegFills.voidedAt),
              isNull(kegFills.deletedAt),
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              sql`${kegFills.filledAt}::date <= ${reconciliationDate}::date`,
              sql`(${kegFills.distributedAt} IS NULL OR ${kegFills.distributedAt}::date > ${reconciliationDate}::date)`
            )
          )
          .groupBy(batches.id, batches.productType);

        for (const row of kegOnHand) {
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
          if (!taxClass) continue;
          const volumeGallons = litersToWineGallons(Number(row.totalLiters || 0));
          inventoryByTaxClass[taxClass] += volumeGallons;
          packagedByTaxClass[taxClass] += volumeGallons;
          actualPackagedGallons += volumeGallons;
        }
      }

      // ============================================
      // REMOVALS BY TAX CLASS
      // Query distributions grouped by product_type to get removals per tax class
      // ============================================
      const removalsByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      // Bottle distributions by tax class
      const bottleRemovalsByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(
            ${bottleRuns.volumeTakenLiters}::numeric -
            CASE WHEN ${bottleRuns.lossUnit} = 'gal'
              THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
              ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
          ), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(bottleRuns.voidedAt),
            isNull(batches.deletedAt),
            sql`${bottleRuns.status} IN ('distributed', 'completed')`,
            sql`${bottleRuns.distributedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.distributedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of bottleRemovalsByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        const volumeGallons = litersToWineGallons(Number(row.totalLiters || 0));
        removalsByTaxClass[taxClass] += volumeGallons;
      }

      // Keg distributions by tax class (net volume: volumeTaken - loss)
      const kegRemovalsByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(
            (CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END)
            - (CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END)
          ), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNotNull(kegFills.distributedAt),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt),
            isNull(batches.deletedAt),
            sql`${kegFills.distributedAt}::date > ${openingDate}::date`,
            sql`${kegFills.distributedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of kegRemovalsByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        const volumeGallons = litersToWineGallons(Number(row.totalLiters || 0));
        removalsByTaxClass[taxClass] += volumeGallons;
      }

      // ============================================
      // LOSSES BY TAX CLASS
      // Calculate racking, filter, bottling losses grouped by product_type
      // ============================================
      const lossesByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      // Racking losses by tax class — includes ALL non-deleted batches
      // Must be symmetric with cross-class transfers and distributions (which also
      // include duplicate/excluded batches). Excluding losses from dup/excluded batches
      // while counting their transfers/sales creates an asymmetric leak in the waterfall.
      // Excludes Historical Record rackings (matching aggregate query filter)
      const rackingLossesByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchRackingOperations)
        .innerJoin(batches, eq(batchRackingOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchRackingOperations.deletedAt),
            isNull(batches.deletedAt),
            sql`${batchRackingOperations.rackedAt}::date > ${openingDate}::date`,
            sql`${batchRackingOperations.rackedAt}::date <= ${reconciliationDate}::date`,
            sql`(${batchRackingOperations.notes} IS NULL OR ${batchRackingOperations.notes} NOT LIKE '%Historical Record%')`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of rackingLossesByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Filter losses by tax class — includes ALL non-deleted batches (symmetric with transfers/sales)
      const filterLossesByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchFilterOperations)
        .innerJoin(batches, eq(batchFilterOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchFilterOperations.deletedAt),
            isNull(batches.deletedAt),
            sql`${batchFilterOperations.filteredAt}::date > ${openingDate}::date`,
            sql`${batchFilterOperations.filteredAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of filterLossesByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Bottling losses by tax class — includes ALL non-deleted batches (symmetric with transfers/sales)
      const bottlingLossesByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${bottleRuns.lossUnit} = 'gal' THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(bottleRuns.voidedAt),
            isNull(batches.deletedAt),
            sql`${bottleRuns.packagedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of bottlingLossesByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Transfer losses by tax class (two sources: batch.transferLossL + batchTransfers.loss)
      const transferLossesByBatch = await db
        .select({
          id: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.transferLossL} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of transferLossesByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.id, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Transfer operation losses by source batch tax class — includes ALL non-deleted batches
      const transferOpLossesByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.loss} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.sourceBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            isNull(batches.deletedAt),
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of transferOpLossesByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Volume adjustments (losses) by tax class — includes ALL non-deleted batches
      const volumeAdjustmentsByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(ABS(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL))), 0)`,
        })
        .from(batchVolumeAdjustments)
        .innerJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
        .where(
          and(
            isNull(batchVolumeAdjustments.deletedAt),
            isNull(batches.deletedAt),
            sql`${batchVolumeAdjustments.adjustmentDate}::date > ${openingDate}::date`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date <= ${reconciliationDate}::date`,
            sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) < 0` // Only negative (loss) adjustments
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of volumeAdjustmentsByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Positive volume adjustments (inventory gains) by tax class — includes ALL non-deleted batches
      const positiveAdjByTaxClass: Record<string, number> = {
        hardCider: 0, wineUnder16: 0, wine16To21: 0, wine21To24: 0,
        sparklingWine: 0, carbonatedWine: 0, appleBrandy: 0, grapeSpirits: 0,
      };
      const positiveAdjByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL)), 0)`,
        })
        .from(batchVolumeAdjustments)
        .innerJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
        .where(
          and(
            isNull(batchVolumeAdjustments.deletedAt),
            isNull(batches.deletedAt),
            sql`${batchVolumeAdjustments.adjustmentDate}::date > ${openingDate}::date`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date <= ${reconciliationDate}::date`,
            sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) > 0` // Only positive (gain) adjustments
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of positiveAdjByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        positiveAdjByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // Keg fill losses by tax class — includes ALL non-deleted batches (symmetric with transfers/sales)
      const kegFillLossesByBatch = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt),
            isNull(batches.deletedAt),
            isNotNull(kegFills.loss),
            sql`${kegFills.filledAt}::date > ${openingDate}::date`,
            sql`${kegFills.filledAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of kegFillLossesByBatch) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        lossesByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
      }

      // ============================================
      // PRODUCTION AND DISTILLATION BY TAX CLASS
      // Production: All juice production becomes hard cider
      // Distillation: All distillation is from hard cider
      // ============================================

      // Apple Brandy Production = brandy RECEIVED from distillery
      const brandyReceivedData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.receivedVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(distillationRecords)
        .where(
          and(
            isNull(distillationRecords.deletedAt),
            isNotNull(distillationRecords.receivedVolumeLiters),
            sql`${distillationRecords.receivedAt}::date > ${openingDate}::date`,
            sql`${distillationRecords.receivedAt}::date <= ${reconciliationDate}::date`
          )
        );
      const brandyReceivedLiters = Number(brandyReceivedData[0]?.totalLiters || 0);
      const brandyReceivedGallons = litersToWineGallons(brandyReceivedLiters);

      // Apple Brandy Removals = brandy transferred to pommeau batches
      const brandyToPommeauData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.sourceBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "brandy"),
            sql`EXISTS (
              SELECT 1 FROM batches dest
              WHERE dest.id = ${batchTransfers.destinationBatchId}
              AND dest.product_type = 'pommeau'
            )`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const brandyToPommeauGallons = litersToWineGallons(Number(brandyToPommeauData[0]?.totalLiters || 0));

      // Pommeau Production = transfers INTO pommeau batches from NON-pommeau sources
      // Excludes pommeau-to-pommeau transfers (just moving within same tax class)
      const transfersIntoPommeauData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "pommeau"),
            // Exclude pommeau-to-pommeau transfers
            sql`NOT EXISTS (
              SELECT 1 FROM batches src
              WHERE src.id = ${batchTransfers.sourceBatchId}
              AND src.product_type = 'pommeau'
            )`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const transfersIntoPommeauGallons = litersToWineGallons(Number(transfersIntoPommeauData[0]?.totalLiters || 0));

      const wineProductionGallons = litersToWineGallons(wineProductionLiters);
      const productionByTaxClass: Record<string, number> = {
        hardCider: totalProductionGallons, // Juice production minus juice-to-pommeau and wine
        wineUnder16: wineProductionGallons, // Plum wine, quince wine, etc.
        wine16To21: 0, // Pommeau "production" handled by transfersIn (cider+brandy→pommeau)
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0, // Carbonated wine "production" handled by transfersIn (cider→carbonated)
        appleBrandy: brandyReceivedGallons, // Brandy received from distillery
        grapeSpirits: 0,
      };

      const distillationByTaxClass: Record<string, number> = {
        hardCider: distillationGallons, // Cider sent to distillation
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0, // Brandy doesn't get distilled further
        grapeSpirits: 0,
      };

      // Cross-class transfers (brandy→pommeau, cider→pommeau, cider→carbonated, etc.)
      // are handled by transfersInByTaxClass / transfersOutByTaxClass in the waterfall formula.
      // Do NOT add them to removalsByTaxClass — removals only tracks customer distributions.

      // Cider Removals for Pommeau = cider (hard cider tax class) transferred to pommeau batches
      // This balances the pommeau production by removing that volume from cider's tax class
      // Hard cider includes all product types EXCEPT 'pommeau' and 'brandy'
      const ciderToPommeauData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.sourceBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            // Source must be hard cider (not pommeau, not brandy)
            sql`COALESCE(${batches.productType}, 'cider') NOT IN ('pommeau', 'brandy')`,
            sql`EXISTS (
              SELECT 1 FROM batches dest
              WHERE dest.id = ${batchTransfers.destinationBatchId}
              AND dest.product_type = 'pommeau'
            )`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const ciderToPommeauGallons = litersToWineGallons(Number(ciderToPommeauData[0]?.totalLiters || 0));

      // ============================================
      // BATCH DETAILS BY TAX CLASS
      // Returns individual batches for reconciliation review
      // Uses historical vessel assignment from racking operations
      // ============================================

      // Get bulk batch details with HISTORICAL vessel info
      // For initial reconciliation, show verified batches with initial_volume
      // For ongoing reconciliation, show active batches with current_volume
      //
      // Historical vessel is determined by:
      // 1. Most recent racking operation before/on reconciliation date
      // 2. Falls back to current vesselId if no racking history
      const batchDetailData = await db.execute(sql`
            SELECT
              b.id,
              b.custom_name as "customName",
              b.batch_number as "batchNumber",
              b.product_type as "productType",
              b.current_volume_liters as volume,
              b.start_date as "startDate",
              COALESCE(
                (SELECT bro.destination_vessel_id
                 FROM batch_racking_operations bro
                 WHERE bro.batch_id = b.id
                   AND bro.deleted_at IS NULL
                   AND bro.racked_at >= b.start_date
                   AND bro.racked_at <= ${reconciliationDate}::date
                 ORDER BY bro.racked_at DESC
                 LIMIT 1),
                b.vessel_id
              ) as "vesselId",
              COALESCE(
                (SELECT v2.name
                 FROM batch_racking_operations bro2
                 JOIN vessels v2 ON v2.id = bro2.destination_vessel_id
                 WHERE bro2.batch_id = b.id
                   AND bro2.deleted_at IS NULL
                   AND bro2.racked_at >= b.start_date
                   AND bro2.racked_at <= ${reconciliationDate}::date
                 ORDER BY bro2.racked_at DESC
                 LIMIT 1),
                v.name
              ) as "vesselName"
            FROM batches b
            LEFT JOIN vessels v ON v.id = b.vessel_id
            WHERE b.deleted_at IS NULL
              AND b.reconciliation_status = 'verified'
              AND b.start_date <= ${reconciliationDate}::date
              AND COALESCE(b.current_volume_liters, 0) > 0
              AND NOT (b.batch_number LIKE 'LEGACY-%')
            ORDER BY CAST(b.current_volume_liters AS DECIMAL) DESC
          `);

      // Get packaged inventory details
      const packagedDetailData = await db
            .select({
              batchId: batches.id,
              batchName: batches.customName,
              batchNumber: batches.batchNumber,
              productType: batches.productType,
              lotCode: inventoryItems.lotCode,
              packageSizeML: inventoryItems.packageSizeML,
              currentQuantity: inventoryItems.currentQuantity,
            })
            .from(inventoryItems)
            .innerJoin(bottleRuns, eq(inventoryItems.bottleRunId, bottleRuns.id))
            .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
            .where(
              and(
                isNull(inventoryItems.deletedAt),
                sql`${inventoryItems.currentQuantity} > 0`,
                sql`${batches.startDate} <= ${reconciliationDate}::date`
              )
            )
            .orderBy(sql`CAST(${inventoryItems.currentQuantity} AS DECIMAL) * CAST(${inventoryItems.packageSizeML} AS DECIMAL) DESC`);

      // Group batch details by tax class
      type BatchDetail = {
        id: string;
        batchId: string; // always the real batch UUID (for hyperlinks)
        name: string;
        batchNumber: string;
        startDate: string | null;
        vesselId: string | null;
        vesselName: string | null;
        volumeLiters: number;
        volumeGallons: number;
        type: 'bulk' | 'packaged';
        packageInfo?: string;
      };

      const batchDetailsByTaxClass: Record<string, BatchDetail[]> = {
        hardCider: [],
        wineUnder16: [],
        wine16To21: [],
        wine21To24: [],
        sparklingWine: [],
        carbonatedWine: [],
        appleBrandy: [],
        grapeSpirits: [],
      };

      // Add bulk batches (batchDetailData is a raw SQL result with .rows array)
      type BatchDetailRow = {
        id: string;
        customName: string | null;
        batchNumber: string;
        productType: string | null;
        volume: string | null;
        startDate: string | null;
        vesselId: string | null;
        vesselName: string | null;
      };
      const batchRows = (batchDetailData as unknown as { rows: BatchDetailRow[] }).rows || [];

      for (const batch of batchRows) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, batch.id, batch.productType);
        if (!taxClass) continue;
        const volumeLiters = parseFloat(batch.volume || "0");
        const volumeGallons = litersToWineGallons(volumeLiters);

        batchDetailsByTaxClass[taxClass].push({
          id: batch.id,
          batchId: batch.id,
          name: batch.customName || batch.batchNumber,
          batchNumber: batch.batchNumber,
          startDate: batch.startDate,
          vesselId: batch.vesselId,
          vesselName: batch.vesselName,
          volumeLiters,
          volumeGallons,
          type: 'bulk',
        });
      }

      // Add packaged inventory
      for (const item of packagedDetailData) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, item.batchId, item.productType);
        if (!taxClass) continue;
        const packageSize = Number(item.packageSizeML || 0);
        const quantity = Number(item.currentQuantity || 0);
        const volumeML = packageSize * quantity;
        const volumeLiters = volumeML / 1000;
        const volumeGallons = mlToWineGallons(volumeML);

        batchDetailsByTaxClass[taxClass].push({
          id: `pkg-${item.batchId}-${item.lotCode || 'unknown'}`,
          batchId: item.batchId,
          name: item.lotCode || item.batchName || item.batchNumber,
          batchNumber: item.batchNumber,
          startDate: null,
          vesselId: null,
          vesselName: null,
          volumeLiters,
          volumeGallons,
          type: 'packaged',
          packageInfo: `${quantity} × ${packageSize}mL`,
        });
      }

      // Use historical inventory for the reconciliation
      const totalCurrentInventory = historicalInventoryGallons;
      const totalRemovals = 0; // Removals are already added back into historical inventory

      // ============================================
      // PRODUCTION AUDIT (Source-Based View)
      // Tracks all cider production/acquisition sources
      // ============================================

      // Get press run volumes by year
      const pressRunData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolumeLiters} AS DECIMAL)), 0)`,
          runCount: sql<number>`COUNT(*)`,
        })
        .from(pressRuns)
        .where(
          and(
            isNull(pressRuns.deletedAt),
            eq(pressRuns.status, "completed"),
            sql`${pressRuns.dateCompleted}::date > ${openingDate}::date`,
            sql`${pressRuns.dateCompleted}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`);

      // Get juice purchase volumes by year (normalize to liters)
      // Unit enum values: "kg", "lb", "L", "gal", "bushel"
      // Note: Must filter both purchase AND item deletedAt to exclude corrected entries
      const juicePurchaseData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`,
          totalLiters: sql<number>`COALESCE(SUM(
            CASE
              WHEN ${juicePurchaseItems.volumeUnit} = 'gal' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) * 3.78541
              ELSE CAST(${juicePurchaseItems.volume} AS DECIMAL)
            END
          ), 0)`,
          purchaseCount: sql<number>`COUNT(DISTINCT ${juicePurchases.id})`,
          itemCount: sql<number>`COUNT(*)`,
        })
        .from(juicePurchaseItems)
        .innerJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
        .where(
          and(
            isNull(juicePurchases.deletedAt),
            isNull(juicePurchaseItems.deletedAt),
            sql`${juicePurchases.purchaseDate}::date > ${openingDate}::date`,
            sql`${juicePurchases.purchaseDate}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`);

      // Build production by year breakdown
      const productionYearMap = new Map<number, {
        pressRuns: number;
        juicePurchases: number;
        pressRunCount: number;
        purchaseCount: number;
      }>();

      for (const row of pressRunData) {
        const year = Number(row.year);
        const existing = productionYearMap.get(year) || {
          pressRuns: 0,
          juicePurchases: 0,
          pressRunCount: 0,
          purchaseCount: 0
        };
        existing.pressRuns = litersToWineGallons(Number(row.totalLiters || 0));
        existing.pressRunCount = Number(row.runCount || 0);
        productionYearMap.set(year, existing);
      }

      for (const row of juicePurchaseData) {
        const year = Number(row.year);
        const existing = productionYearMap.get(year) || {
          pressRuns: 0,
          juicePurchases: 0,
          pressRunCount: 0,
          purchaseCount: 0
        };
        existing.juicePurchases = litersToWineGallons(Number(row.totalLiters || 0));
        existing.purchaseCount = Number(row.purchaseCount || 0);
        productionYearMap.set(year, existing);
      }

      const productionByYear = Array.from(productionYearMap.entries())
        .map(([year, data]) => ({
          year,
          pressRunsGallons: parseFloat(data.pressRuns.toFixed(1)),
          juicePurchasesGallons: parseFloat(data.juicePurchases.toFixed(1)),
          totalGallons: parseFloat((data.pressRuns + data.juicePurchases).toFixed(1)),
          pressRunCount: data.pressRunCount,
          purchaseCount: data.purchaseCount,
        }))
        .sort((a, b) => a.year - b.year);

      // Calculate total production for audit section
      const totalPressRunsGallons = productionByYear.reduce((sum, y) => sum + y.pressRunsGallons, 0);
      const totalJuicePurchasesGallons = productionByYear.reduce((sum, y) => sum + y.juicePurchasesGallons, 0);

      // Subtract juice-only batches from audit production (juice that was never fermented)
      const auditJuiceOnlyBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolume} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            eq(batches.reconciliationStatus, "verified"),
            eq(batches.productType, "juice"),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );
      const auditJuiceOnlyGallons = litersToWineGallons(Number(auditJuiceOnlyBatches[0]?.totalLiters || 0));

      // Also subtract transfers INTO juice batches from audit production
      const auditTransfersIntoJuiceBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "juice"),
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const auditTransfersIntoJuiceGallons = litersToWineGallons(Number(auditTransfersIntoJuiceBatches[0]?.totalLiters || 0));
      const auditTotalProductionGallons = totalPressRunsGallons + totalJuicePurchasesGallons - auditJuiceOnlyGallons - auditTransfersIntoJuiceGallons;

      // 4. Get legacy batches grouped by tax class
      const legacyBatchData = await db
        .select({
          customName: batches.customName,
          initialVolumeLiters: batches.initialVolume,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            isNull(batches.originPressRunId),
            isNull(batches.originJuicePurchaseItemId),
            like(batches.batchNumber, "LEGACY-%")
          )
        );

      // Parse tax class from customName and sum volumes
      const legacyByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      for (const batch of legacyBatchData) {
        const volumeLiters = parseFloat(batch.initialVolumeLiters || "0");
        const volumeGallons = litersToWineGallons(volumeLiters);

        // Extract tax class from customName
        const taxClassMatch = batch.customName?.match(/Tax Class: (\w+)/);
        const taxClass = taxClassMatch ? taxClassMatch[1] : "hardCider";

        if (taxClass in legacyByTaxClass) {
          legacyByTaxClass[taxClass] += volumeGallons;
        }
      }

      let totalLegacy = Object.values(legacyByTaxClass).reduce((sum, val) => sum + val, 0);

      // Debug: Get batches that existed on the opening date for verification
      const batchesAtOpeningDate = await db
        .select({
          id: batches.id,
          batchNumber: batches.batchNumber,
          customName: batches.customName,
          productType: batches.productType,
          initialVolume: batches.initialVolume,
          currentVolume: batches.currentVolume,
          startDate: batches.startDate,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate}::date <= ${openingDate}::date`,
            sql`COALESCE(${batches.isArchived}, false) = false`
          )
        )
        .orderBy(batches.batchNumber);

      const openingBatchDebug = batchesAtOpeningDate.map((b) => ({
        batchNumber: b.batchNumber,
        customName: b.customName,
        productType: b.productType || 'cider',
        startDate: b.startDate,
        initialVolumeGallons: parseFloat(litersToWineGallons(parseFloat(b.initialVolume || "0")).toFixed(2)),
        currentVolumeGallons: parseFloat(litersToWineGallons(parseFloat(b.currentVolume || "0")).toFixed(2)),
      }));

      const openingBatchTotalGallons = openingBatchDebug.reduce((sum, b) => sum + b.initialVolumeGallons, 0);

      // ============================================
      // WATERFALL CALCULATION
      // Track inventory flow from last reconciliation to current
      // Opening (last recon) + Production + Transfers In - Transfers Out - Packaging - Losses = Calculated Ending
      // Compare to Physical (current inventory) for variance
      // ============================================

      // Get last finalized reconciliation snapshot
      const [lastRecon] = await db
        .select({
          id: ttbReconciliationSnapshots.id,
          periodEndDate: ttbReconciliationSnapshots.periodEndDate,
          reconciliationDate: ttbReconciliationSnapshots.reconciliationDate,
          taxClassBreakdown: ttbReconciliationSnapshots.taxClassBreakdown,
        })
        .from(ttbReconciliationSnapshots)
        .where(eq(ttbReconciliationSnapshots.status, "finalized"))
        .orderBy(sql`${ttbReconciliationSnapshots.periodEndDate} DESC`)
        .limit(1);

      // Parse last reconciliation's tax class data for opening balances
      let waterfallOpening: Record<string, number> = {};
      let waterfallPeriodStart = openingDate; // Default to TTB opening date if no prior recon
      if (lastRecon?.taxClassBreakdown) {
        try {
          const parsed = JSON.parse(lastRecon.taxClassBreakdown);
          if (Array.isArray(parsed)) {
            for (const tc of parsed) {
              if (tc.key && tc.currentInventory !== undefined) {
                waterfallOpening[tc.key] = tc.currentInventory; // Already in gallons
              }
            }
          }
          // Use last reconciliation's end date as the start of this period
          waterfallPeriodStart = lastRecon.periodEndDate || lastRecon.reconciliationDate || openingDate;
        } catch {
          // Ignore parse errors, fall back to TTB opening
        }
      }

      // Track opening bulk vs packaged separately for TTB Section A/B
      let waterfallOpeningBulk: Record<string, number> = {};
      let waterfallOpeningPackaged: Record<string, number> = {};

      // Use configured TTB opening balances from organization_settings
      const allTaxKeys = [
        "hardCider", "wineUnder16", "wine16To21", "wine21To24",
        "sparklingWine", "carbonatedWine", "appleBrandy", "grapeSpirits",
      ];
      for (const key of allTaxKeys) {
        const bulkVal = Number((balances.bulk as any)?.[key] || 0);
        const bottledVal = Number((balances.bottled as any)?.[key] || 0);
        const spiritsVal = Number((balances.spirits as any)?.[key] || 0);
        waterfallOpeningBulk[key] = bulkVal + spiritsVal;
        waterfallOpeningPackaged[key] = bottledVal;
        waterfallOpening[key] = bulkVal + bottledVal + spiritsVal;
      }

      // ============================================
      // OPENING PACKAGED INVENTORY (at period start)
      // Same logic as packagedByTaxClass but as of batchReconStartDate instead of reconciliationDate.
      // Needed so the waterfall opening includes ALL on-premises inventory (bulk + packaged).
      // ============================================
      const openingPackagedByTaxClass: Record<string, number> = {
        hardCider: 0, wineUnder16: 0, wine16To21: 0, wine21To24: 0,
        sparklingWine: 0, carbonatedWine: 0, appleBrandy: 0, grapeSpirits: 0,
      };
      {
        // Bottles packaged by period start that were NOT yet distributed by period start
        const openingBottles = await db
          .select({
            batchId: batches.id,
            productType: batches.productType,
            totalLiters: sql<number>`COALESCE(SUM(
              ${bottleRuns.volumeTakenLiters}::numeric -
              CASE WHEN ${bottleRuns.lossUnit} = 'gal'
                THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
                ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
            ), 0)`,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(
            and(
              isNull(bottleRuns.voidedAt),
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              sql`${bottleRuns.packagedAt}::date <= ${batchReconStartDate}::date`,
              sql`(${bottleRuns.distributedAt} IS NULL OR ${bottleRuns.distributedAt}::date > ${batchReconStartDate}::date)`
            )
          )
          .groupBy(batches.id, batches.productType);

        for (const row of openingBottles) {
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
          if (!taxClass) continue;
          openingPackagedByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
        }

        // Kegs filled by period start that were NOT yet distributed by period start
        const openingKegs = await db
          .select({
            batchId: batches.id,
            productType: batches.productType,
            totalLiters: sql<number>`COALESCE(SUM(
              (CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END)
              - (CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END)
            ), 0)`,
          })
          .from(kegFills)
          .innerJoin(batches, eq(kegFills.batchId, batches.id))
          .where(
            and(
              isNull(kegFills.voidedAt),
              isNull(kegFills.deletedAt),
              isNull(batches.deletedAt),
              sql`COALESCE(${batches.reconciliationStatus}, 'pending') NOT IN ('duplicate', 'excluded')`,
              sql`${kegFills.filledAt}::date <= ${batchReconStartDate}::date`,
              sql`(${kegFills.distributedAt} IS NULL OR ${kegFills.distributedAt}::date > ${batchReconStartDate}::date)`
            )
          )
          .groupBy(batches.id, batches.productType);

        for (const row of openingKegs) {
          const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
          if (!taxClass) continue;
          openingPackagedByTaxClass[taxClass] += litersToWineGallons(Number(row.totalLiters || 0));
        }
      }

      // Calculate packaging by tax class (volume converted from bulk to packaged DURING period)
      // This includes bottling and kegging
      const packagingByBatchData = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            sql`${bottleRuns.packagedAt}::date > ${waterfallPeriodStart}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      const packagingByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      for (const row of packagingByBatchData) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        const volumeGallons = litersToWineGallons(Number(row.totalLiters || 0));
        packagingByTaxClass[taxClass] += volumeGallons;
      }

      // Add kegging to packaging (kegFills during period)
      const keggingByBatchData = await db
        .select({
          batchId: batches.id,
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt),
            sql`${kegFills.filledAt}::date > ${waterfallPeriodStart}::date`,
            sql`${kegFills.filledAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.id, batches.productType);

      for (const row of keggingByBatchData) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, row.batchId, row.productType);
        if (!taxClass) continue;
        const volumeGallons = litersToWineGallons(Number(row.totalLiters || 0));
        packagingByTaxClass[taxClass] += volumeGallons;
      }

      // Calculate transfers between tax classes DURING period
      // This tracks volume moving from one tax class to another (e.g., cider -> pommeau)
      const transfersBetweenClasses = await db
        .select({
          sourceBatchId: sql<string>`source_batch.id`,
          sourceProductType: sql<string>`source_batch.product_type`,
          destBatchId: sql<string>`dest_batch.id`,
          destProductType: sql<string>`dest_batch.product_type`,
          volumeTransferred: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .leftJoin(sql`batches source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
        .leftJoin(sql`batches dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            sql`${batchTransfers.transferredAt}::date > ${waterfallPeriodStart}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`source_batch.id`, sql`source_batch.product_type`, sql`dest_batch.id`, sql`dest_batch.product_type`);

      const transfersInByTaxClass: Record<string, number> = {
        hardCider: 0, wineUnder16: 0, wine16To21: 0, wine21To24: 0,
        sparklingWine: 0, carbonatedWine: 0, appleBrandy: 0, grapeSpirits: 0,
      };
      const transfersOutByTaxClass: Record<string, number> = {
        hardCider: 0, wineUnder16: 0, wine16To21: 0, wine21To24: 0,
        sparklingWine: 0, carbonatedWine: 0, appleBrandy: 0, grapeSpirits: 0,
      };

      for (const row of transfersBetweenClasses) {
        const sourceClass = getTaxClassFromMap(batchTaxClassMap, row.sourceBatchId, row.sourceProductType || "cider");
        const destClass = getTaxClassFromMap(batchTaxClassMap, row.destBatchId, row.destProductType || "cider");
        if (!sourceClass || !destClass) continue;
        const volumeGallons = litersToWineGallons(Number(row.volumeTransferred || 0));

        // Only track transfers between DIFFERENT tax classes
        if (sourceClass !== destClass) {
          transfersOutByTaxClass[sourceClass] += volumeGallons;
          transfersInByTaxClass[destClass] += volumeGallons;
        }
      }

      // Supplement: pommeau batches composed at creation (e.g. Salish #1)
      // These have soft-deleted transfers — ABV derivation captures brandy + juice volumes.
      // Brandy portion: appleBrandy → wine16To21 cross-class transfer
      const abvBrandySupplementGallons = litersToWineGallons(brandyToPommeauLitersRecon);
      transfersOutByTaxClass["appleBrandy"] = (transfersOutByTaxClass["appleBrandy"] || 0) + abvBrandySupplementGallons;
      transfersInByTaxClass["wine16To21"] = (transfersInByTaxClass["wine16To21"] || 0) + abvBrandySupplementGallons;
      // Juice portion: added as wine16To21 production (matches form Line 4 treatment —
      // pommeau is "produced by addition of wine spirits" from juice + brandy)
      // juiceToPommeauLiters includes both ABV-derived juice (composed) and nonBrandy transfers.
      // The ABV-derived juice portion for composed batches:
      const composedJuiceLiters = juiceToPommeauLiters - Number(nonBrandyToPommeauRecon[0]?.totalLiters || 0);
      if (composedJuiceLiters > 0) {
        productionByTaxClass["wine16To21"] = (productionByTaxClass["wine16To21"] || 0) + litersToWineGallons(composedJuiceLiters);
      }

      // Build waterfall data per tax class
      type WaterfallEntry = {
        taxClass: string;
        label: string;
        opening: number;
        openingBulk: number;
        openingPackaged: number;
        production: number;
        transfersIn: number;
        transfersOut: number;
        positiveAdj: number;
        reconAdj: number;
        packaging: number;
        losses: number;
        distillation: number;
        sales: number;
        calculatedEnding: number;
        physical: number;
        variance: number;
        bulk: number;
        packaged: number;
        bulkEnding: number;
        packagedEnding: number;
      };

      const waterfallData: WaterfallEntry[] = [];
      const waterfallTaxClasses = [
        "hardCider", "wineUnder16", "wine16To21", "wine21To24",
        "sparklingWine", "carbonatedWine", "appleBrandy", "grapeSpirits"
      ];

      const waterfallLabels: Record<string, string> = {
        hardCider: "Hard Cider",
        wineUnder16: "Wine (<16%)",
        wine16To21: "Wine (16-21%)",
        wine21To24: "Wine (21-24%)",
        sparklingWine: "Sparkling Wine",
        carbonatedWine: "Carbonated Wine",
        appleBrandy: "Apple Brandy",
        grapeSpirits: "Grape Spirits",
      };

      // ============================================
      // BATCH-DERIVED RECONCILIATION (single source of truth)
      // Computed before waterfall so SBD-derived per-tax-class values can replace aggregates.
      // ============================================
      const batchRecon = await computeReconciliationFromBatches(batchReconStartDate, reconciliationDate, batchTaxClassMap);

      // Aggregate batchRecon.batches by tax class for SBD-derived waterfall values.
      // This replaces the aggregate SQL queries (productionByTaxClass, lossesByTaxClass, etc.)
      // to ensure the waterfall identity and physical inventory use the same per-batch data source.
      const sbdWaterfallByTaxClass: Record<string, {
        production: number; losses: number; sales: number; distillation: number;
        positiveAdj: number; ending: number; opening: number;
        transfersIn: number; transfersOut: number; mergesIn: number; mergesOut: number;
      }> = {};
      for (const b of batchRecon.batches) {
        // Skip duplicate/excluded batches from waterfall aggregation (they don't count in bulk inventory)
        if (b.reconciliationStatus === 'duplicate' || b.reconciliationStatus === 'excluded') continue;
        const taxClass = getTaxClassFromMap(batchTaxClassMap, b.batchId, b.productType);
        if (!taxClass) continue;
        if (!sbdWaterfallByTaxClass[taxClass]) {
          sbdWaterfallByTaxClass[taxClass] = {
            production: 0, losses: 0, sales: 0, distillation: 0,
            positiveAdj: 0, ending: 0, opening: 0,
            transfersIn: 0, transfersOut: 0, mergesIn: 0, mergesOut: 0,
          };
        }
        const tc = sbdWaterfallByTaxClass[taxClass];
        tc.production += b.production;
        // Losses = process losses + transfer loss + press transfer loss (all SBD-derived)
        tc.losses += b.losses + b.transferLoss + (b.lossBreakdown?.pressTransfer || 0);
        tc.sales += b.sales;
        tc.distillation += b.distillation;
        tc.positiveAdj += b.positiveAdj;
        tc.ending += b.ending;
        tc.opening += b.opening;
        // Transfers + merges: when summed by tax class, same-class cancel; cross-class remain
        tc.transfersIn += b.transfersIn;
        tc.transfersOut += b.transfersOut;
        tc.mergesIn += b.mergesIn;
        tc.mergesOut += b.mergesOut;
      }

      // Use Phase 1 byTaxClass aggregation from computeReconciliationFromBatches
      // for consistent physical inventory (eliminates reconAdj gap between SBD impls)
      const batchReconByTaxClass = batchRecon.byTaxClass;

      for (const key of waterfallTaxClasses) {
        const sbdTc = sbdWaterfallByTaxClass[key];
        const reconTc = batchReconByTaxClass[key];
        // ALL waterfall values are SBD-derived from per-batch reconstruction.
        // Physical inventory also uses SBD ending + packaged, ensuring reconAdj ≈ 0.
        const opening = sbdTc?.opening || 0;
        const production = sbdTc?.production || 0;
        // Transfers + merges: when summed by tax class, same-class flows cancel
        // (batch A's tOut = batch B's tIn). Only cross-class flows and orphan
        // residual from deleted/excluded batches remain in the net.
        const transfersIn = (sbdTc?.transfersIn || 0) + (sbdTc?.mergesIn || 0);
        const transfersOut = (sbdTc?.transfersOut || 0) + (sbdTc?.mergesOut || 0);
        const losses = sbdTc?.losses || 0;
        const positiveAdj = sbdTc?.positiveAdj || 0;
        const distillation = sbdTc?.distillation || 0;

        // SBD-derived distributions (customer sales)
        const actualSales = sbdTc?.sales || 0;

        // SBD-derived packaging (net product volume transferred from bulk to packaged)
        const sbdPackaging = reconTc?.packaging || 0;

        // Opening includes ALL on-premises inventory: bulk + packaged at period start.
        // This ensures the TTB "On Premises" line reflects everything physically in bond.
        const openBulk = sbdTc?.opening || 0;
        const openPkg = openingPackagedByTaxClass[key] || 0;
        const openingTotal = openBulk + openPkg;

        // Ending includes ALL on-premises inventory: bulk + packaged at period end.
        const sbdBulkEnding = sbdTc?.ending || 0;
        const endPkg = packagedByTaxClass[key] || 0;
        const physical = sbdBulkEnding + Math.max(0, endPkg);

        // Formula: opening(total) + inflows - outflows = ending(total)
        // reconAdj absorbs any residual from rounding, cross-period packaging flows, etc.
        const formulaWithoutAdj = openingTotal + production + transfersIn - transfersOut
          + positiveAdj - losses - distillation - actualSales;
        const reconAdj = physical - formulaWithoutAdj;

        // TTB Calculated Ending: universal identity that accounts for all volume flows
        const calculatedEnding = formulaWithoutAdj + reconAdj; // = physical by construction

        // Variance = 0 by construction (reconAdj absorbs any orphan residual)
        const variance = calculatedEnding - physical;

        // Include tax classes with any activity (including negative ending from losses/sales)
        const hasActivity = openingTotal !== 0 || production > 0 || transfersIn > 0 || physical > 0 ||
          losses > 0 || actualSales > 0 || distillation > 0 || calculatedEnding !== 0;
        if (hasActivity) {
          const pkg = packagingByTaxClass[key] || 0;
          // Section A ending: use SBD-derived bulk inventory (authoritative physical inventory)
          // instead of waterfall-aggregated ending, which can diverge for zero-volume
          // intermediate batches that the waterfall computes as negative.
          const bulkEnding = bulkByTaxClass[key] || 0;
          // Section B ending: all undistributed packaged inventory at period end
          const packagedEnding = Math.max(0, endPkg);
          waterfallData.push({
            taxClass: key,
            label: waterfallLabels[key] || key,
            opening: parseFloat(openingTotal.toFixed(2)),
            openingBulk: parseFloat(openBulk.toFixed(2)),
            openingPackaged: parseFloat(openPkg.toFixed(2)),
            production: parseFloat(production.toFixed(2)),
            transfersIn: parseFloat(transfersIn.toFixed(2)),
            transfersOut: parseFloat(transfersOut.toFixed(2)),
            positiveAdj: parseFloat(positiveAdj.toFixed(2)),
            reconAdj: parseFloat(reconAdj.toFixed(2)),
            packaging: parseFloat(pkg.toFixed(2)),
            losses: parseFloat(losses.toFixed(2)),
            distillation: parseFloat(distillation.toFixed(2)),
            sales: parseFloat(actualSales.toFixed(2)),
            calculatedEnding: parseFloat(calculatedEnding.toFixed(2)),
            physical: parseFloat(physical.toFixed(2)),
            variance: parseFloat(variance.toFixed(2)),
            bulk: parseFloat((bulkByTaxClass[key] || 0).toFixed(2)),
            packaged: parseFloat((packagedByTaxClass[key] || 0).toFixed(2)),
            bulkEnding: parseFloat(bulkEnding.toFixed(2)),
            packagedEnding: parseFloat(packagedEnding.toFixed(2)),
          });
        }
      }

      // ============================================
      // SERVER-SIDE IDENTITY ASSERTION
      // Verify: Opening + Production - Sales - Losses - Distillation ≈ Calculated Ending
      // for each tax class. Collects diagnostics for client display.
      // ============================================
      const parityWarnings: Array<{
        level: "error" | "warning" | "info";
        category: string;
        message: string;
        detail: Record<string, number>;
      }> = [];

      for (const entry of waterfallData) {
        const expectedEnding = entry.opening + entry.production + entry.transfersIn
          - entry.transfersOut + entry.positiveAdj + entry.reconAdj - entry.losses - entry.distillation - entry.sales;
        const identityGap = Math.abs(expectedEnding - entry.calculatedEnding);
        if (identityGap > 0.05) {
          const msg = `Waterfall identity violation for ${entry.label}: gap ${identityGap.toFixed(2)} gal`;
          console.warn(`[TTB Parity] ${msg}`);
          parityWarnings.push({
            level: identityGap > 0.5 ? "error" : "warning",
            category: "taxClassIdentity",
            message: msg,
            detail: {
              opening: entry.opening,
              production: entry.production,
              transfersIn: entry.transfersIn,
              transfersOut: entry.transfersOut,
              positiveAdj: entry.positiveAdj,
              losses: entry.losses,
              distillation: entry.distillation,
              sales: entry.sales,
              expected: parseFloat(expectedEnding.toFixed(2)),
              actual: entry.calculatedEnding,
              gap: parseFloat(identityGap.toFixed(2)),
            },
          });
        }
      }

      // 5. Build reconciliation by tax class
      const taxClassLabels: Record<string, string> = {
        hardCider: "Hard Cider (<8.5% ABV)",
        wineUnder16: "Wine (<16% ABV)",
        wine16To21: "Wine (16-21% ABV)",
        wine21To24: "Wine (21-24% ABV)",
        sparklingWine: "Sparkling Wine",
        carbonatedWine: "Carbonated Wine",
        appleBrandy: "Apple Brandy",
        grapeSpirits: "Grape Spirits",
      };

      const taxClasses = [];
      let totalTtbOpening = 0;
      let totalTtbEnding = 0;

      // Wine/Cider tax classes
      for (const [key, label] of Object.entries(taxClassLabels)) {
        if (key === "appleBrandy" || key === "grapeSpirits") continue;

        // Use redistributed opening balances (proportionally split by current tax class)
        const ttbBulk = waterfallOpeningBulk[key] || 0;
        const ttbBottled = waterfallOpeningPackaged[key] || 0;
        const ttbOpening = waterfallOpening[key] || 0;

        // Get values for this tax class
        const production = productionByTaxClass[key] || 0;
        const transfersIn = transfersInByTaxClass[key] || 0;
        const transfersOut = transfersOutByTaxClass[key] || 0;
        const positiveAdj = positiveAdjByTaxClass[key] || 0;
        const currentInv = inventoryByTaxClass[key] || 0;
        const removals = removalsByTaxClass[key] || 0;
        const losses = lossesByTaxClass[key] || 0;
        const distillation = distillationByTaxClass[key] || 0;

        // TTB Ending = Opening + Production + TransfersIn - TransfersOut + PositiveAdj - Removals - Losses - Distillation
        const ttbEnding = ttbOpening + production + transfersIn - transfersOut
          + positiveAdj - removals - losses - distillation;

        // Difference = TTB Ending - Current Inventory
        const difference = ttbEnding - currentInv;

        if (ttbOpening > 0 || ttbEnding > 0 || currentInv > 0 || removals > 0 || transfersIn > 0) {
          taxClasses.push({
            key,
            label,
            type: "wine" as const,
            ttbBulk: parseFloat(ttbBulk.toFixed(1)),
            ttbBottled: parseFloat(ttbBottled.toFixed(1)),
            ttbOpening: parseFloat(ttbOpening.toFixed(1)),
            ttbTotal: parseFloat(ttbEnding.toFixed(1)), // Now shows ending balance
            production: parseFloat(production.toFixed(1)),
            transfersIn: parseFloat(transfersIn.toFixed(1)),
            transfersOut: parseFloat(transfersOut.toFixed(1)),
            positiveAdj: parseFloat(positiveAdj.toFixed(1)),
            losses: parseFloat(losses.toFixed(1)),
            distillation: parseFloat(distillation.toFixed(1)),
            currentInventory: parseFloat(currentInv.toFixed(1)),
            removals: parseFloat(removals.toFixed(1)),
            legacyBatches: 0,
            difference: parseFloat(difference.toFixed(1)),
            isReconciled: Math.abs(difference) < 0.5,
          });

          totalTtbOpening += ttbOpening;
          totalTtbEnding += ttbEnding;
        }
      }

      // Spirits tax classes
      for (const key of ["appleBrandy", "grapeSpirits"] as const) {
        const ttbOpening = balances.spirits[key] || 0;
        const production = productionByTaxClass[key] || 0;
        const transfersIn = transfersInByTaxClass[key] || 0;
        const transfersOut = transfersOutByTaxClass[key] || 0;
        const positiveAdj = positiveAdjByTaxClass[key] || 0;
        const currentInv = inventoryByTaxClass[key] || 0;
        const removals = removalsByTaxClass[key] || 0;
        const losses = lossesByTaxClass[key] || 0;
        const distillation = distillationByTaxClass[key] || 0;

        // TTB Ending = Opening + Production + TransfersIn - TransfersOut + PositiveAdj - Removals - Losses - Distillation
        const ttbEnding = ttbOpening + production + transfersIn - transfersOut
          + positiveAdj - removals - losses - distillation;
        const difference = ttbEnding - currentInv;

        if (ttbOpening > 0 || ttbEnding > 0 || currentInv > 0 || removals > 0 || transfersIn > 0) {
          taxClasses.push({
            key,
            label: taxClassLabels[key],
            type: "spirits" as const,
            ttbBulk: parseFloat(ttbOpening.toFixed(1)),
            ttbBottled: 0,
            ttbOpening: parseFloat(ttbOpening.toFixed(1)),
            ttbTotal: parseFloat(ttbEnding.toFixed(1)), // Now shows ending balance
            production: parseFloat(production.toFixed(1)),
            transfersIn: parseFloat(transfersIn.toFixed(1)),
            transfersOut: parseFloat(transfersOut.toFixed(1)),
            positiveAdj: parseFloat(positiveAdj.toFixed(1)),
            losses: parseFloat(losses.toFixed(1)),
            distillation: parseFloat(distillation.toFixed(1)),
            currentInventory: parseFloat(currentInv.toFixed(1)),
            removals: parseFloat(removals.toFixed(1)),
            legacyBatches: 0,
            difference: parseFloat(difference.toFixed(1)),
            isReconciled: Math.abs(difference) < 0.5,
          });

          totalTtbOpening += ttbOpening;
          totalTtbEnding += ttbEnding;
        }
      }

      // Use opening balance for totalTtb (for backward compatibility in calculations)
      const totalTtb = totalTtbOpening;

      // Calculate total inventory from inventoryByTaxClass
      const totalInventoryByTaxClass = Object.values(inventoryByTaxClass).reduce((sum, val) => sum + val, 0);

      // Cross-check: compare BULK portions only between the two SBD implementations.
      // The waterfall uses computeReconciliationFromBatches for bulk ending;
      // inventoryByTaxClass uses computeSystemCalculatedOnHand for bulk ending.
      // Packaged inventory is computed differently (period-scoped vs all-time) so
      // comparing total physical would always show pre-period packaged as a gap.
      // Bulk-to-bulk comparison isolates genuine SBD reconstruction divergence.
      // Parity check: compare waterfall-derived bulk ending with SBD-derived bulk ending.
      // Both are summed from waterfallData entries. bulkEnding comes from the waterfall
      // per-batch reconstruction (sbdWaterfallByTaxClass), while bulk comes from the SBD
      // function (computeSystemCalculatedOnHand → computePerTaxClassBulkInventory).
      const waterfallBulkTotal = waterfallData.reduce((s, w) => s + w.bulkEnding, 0);
      const inventoryBulkTotal = waterfallData.reduce((s, w) => s + w.bulk, 0);
      const bulkGap = Math.abs(waterfallBulkTotal - inventoryBulkTotal);
      if (bulkGap > 5.0) {
        const msg = `Bulk inventory mismatch: waterfall bulk ${waterfallBulkTotal.toFixed(1)} vs SBD bulk ${inventoryBulkTotal.toFixed(1)} (gap ${bulkGap.toFixed(2)} gal)`;
        console.warn(`[TTB Parity] ${msg}`);
        parityWarnings.push({
          level: bulkGap > 20 ? "error" : "warning",
          category: "physicalMismatch",
          message: msg,
          detail: {
            waterfallBulkTotal: parseFloat(waterfallBulkTotal.toFixed(2)),
            inventoryBulkTotal: parseFloat(inventoryBulkTotal.toFixed(2)),
            gap: parseFloat(bulkGap.toFixed(2)),
          },
        });
      }

      // ============================================
      // CORRECT TTB RECONCILIATION FORMULA
      // TTB Calculated Ending = Opening + Production - Removals - Losses - DSP
      // Variance = TTB Calculated - System On Hand
      // ============================================
      // System On Hand = actual current batch volumes + packaged inventory (from inventoryByTaxClass)
      //
      // IMPORTANT: Total production must include ALL sources:
      // 1. Juice production (press runs + juice purchases - juice-only)
      // 2. Brandy received from distillery (this is NEW inventory entering the system)
      //
      // Cross-class transfers (cider→pommeau, brandy→pommeau) are NOT additional production
      // at the total level - they just reclassify existing inventory.
      const systemOnHand = totalInventoryByTaxClass;
      // Compute TTB waterfall in liters, convert to gallons once at the end.
      // This eliminates cumulative rounding from independent liter→gallon conversions.
      const totalProductionIncludingBrandyLiters = totalProductionLiters + brandyReceivedLiters;
      const ttbCalculatedEndingLiters = wineGallonsToLiters(totalTtb)
        + totalProductionIncludingBrandyLiters + positiveAdjustmentsBeforeLiters
        - distributionsBeforeLiters - processLossesLiters - distillationsBeforeLiters;
      const ttbCalculatedEnding = litersToWineGallons(ttbCalculatedEndingLiters);
      const totalProductionIncludingBrandy = totalProductionGallons + brandyReceivedGallons;
      // Primary variance: use live systemOnHand for current year display
      const variance = ttbCalculatedEnding - systemOnHand;

      // Re-use SBD results computed earlier for inventory (avoids duplicate DB queries).
      // allEligibleBatchesForInventory, sbdResult, sbdProductTypes, sbdByClassLiters
      // were computed in the INVENTORY BY TAX CLASS section above.
      const allEligibleBatches = allEligibleBatchesForInventory;
      const systemCalcResult = sbdResult;
      const systemReconstructedOnHand = systemCalcResult.total;
      const sbd = systemCalcResult.breakdown;

      // Compute brandy portion of SBD to exclude from wine reconciliation
      // TTB Form Part I is wine-only; brandy is tracked in Part III.
      const reconProductTypes = sbdProductTypes;
      const reconByClass = sbdByClassLiters;
      const brandyBulkGallonsInRecon = litersToWineGallons(reconByClass["appleBrandy"] || 0);
      const wineOnlyReconstructedOnHand = systemReconstructedOnHand - brandyBulkGallonsInRecon;

      // Compute undistributed packaged inventory at the reconciliation date.
      // systemReconstructedOnHand is BULK only (subtracts all packaging taken).
      // ttbCalculatedEnding is BULK + PACKAGED (subtracts only distributions).
      // To compare them properly, we add back the packaged inventory still on premises:
      //   packaged_on_hand = (packaging_taken - packaging_loss) - distributions
      // IMPORTANT: distributions must be batch-scoped (only from eligible batches) to match
      // the scope of sbd.bottlingLiters/keggingLiters which come from eligible batches only.
      const eligibleBatchIds = allEligibleBatches.map((b) => b.id);
      const eligibleIdList = sql.join(eligibleBatchIds.map((id) => sql`${id}`), sql`, `);

      // Distributions must cover the FULL history (no openingDate lower bound) to match
      // the SBD packaging scope. computeSystemCalculatedOnHand accumulates ALL operations
      // from the beginning of time up to asOfDate, so distributions must match.
      const [batchScopedBottleDist, batchScopedKegDist] = await Promise.all([
        // Bottle distributions from eligible batches (net: volumeTaken - loss)
        db.execute(sql`
          SELECT COALESCE(SUM(
            ${bottleRuns.volumeTakenLiters}::numeric -
            CASE WHEN ${bottleRuns.lossUnit} = 'gal'
              THEN COALESCE(${bottleRuns.loss}::numeric, 0) * 3.78541
              ELSE COALESCE(${bottleRuns.loss}::numeric, 0) END
          ), 0) AS total_liters
          FROM ${bottleRuns}
          WHERE ${bottleRuns.batchId} IN (${eligibleIdList})
            AND ${bottleRuns.voidedAt} IS NULL
            AND ${bottleRuns.status} IN ('distributed', 'completed')
            AND ${bottleRuns.distributedAt}::date <= ${reconciliationDate}::date
        `),
        // Keg distributions from eligible batches (net: volumeTaken - loss)
        db.execute(sql`
          SELECT COALESCE(SUM(
            (CASE WHEN ${kegFills.volumeTakenUnit} = 'gal' THEN COALESCE(${kegFills.volumeTaken}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.volumeTaken}::numeric, 0) END)
            - (CASE WHEN ${kegFills.lossUnit} = 'gal' THEN COALESCE(${kegFills.loss}::numeric, 0) * 3.78541 ELSE COALESCE(${kegFills.loss}::numeric, 0) END)
          ), 0) AS total_liters
          FROM ${kegFills}
          WHERE ${kegFills.batchId} IN (${eligibleIdList})
            AND ${kegFills.distributedAt} IS NOT NULL
            AND ${kegFills.voidedAt} IS NULL
            AND ${kegFills.deletedAt} IS NULL
            AND ${kegFills.distributedAt}::date <= ${reconciliationDate}::date
        `),
      ]);

      const batchScopedDistributionsLiters =
        Number((batchScopedBottleDist.rows[0] as any)?.total_liters || 0)
        + Number((batchScopedKegDist.rows[0] as any)?.total_liters || 0);

      const packagedOnHandLiters = (sbd.bottlingLiters - sbd.bottlingLossLiters)
        + (sbd.keggingLiters - sbd.keggingLossLiters)
        - batchScopedDistributionsLiters;
      // Exclude brandy from wine reconciliation total (Part I is wine-only)
      const systemTotalOnHand = wineOnlyReconstructedOnHand
        + litersToWineGallons(Math.max(0, packagedOnHandLiters));

      // ============================================
      // AGGREGATE-BASED TTB WATERFALL
      // Uses same aggregate queries as TTB Form 5120.17 for consistent numbers.
      // Identity: Opening + Production + PosAdj - Sales - Losses - Distillation = Calculated Ending
      // Variance = Calculated Ending - Physical Inventory
      // ============================================

      // Clamped loss is a data quality diagnostic only — batches that went negative
      // during SBD reconstruction. NOT subtracted from losses in the waterfall identity.
      const clampedLossGallons = litersToWineGallons(sbd.clampedLossLiters);

      // SBD-derived system on-hand (same algorithm for all years — no opening year special case)
      const systemCalculatedOnHand = systemTotalOnHand;

      const varianceThresholdPct = parseFloat(settings.ttbVarianceThresholdPct || "0.50");

      // ============================================
      // PERIOD FINALIZATION STATUS
      // ============================================
      const finalizedPeriods = await db
        .select({
          id: ttbPeriodSnapshots.id,
          periodType: ttbPeriodSnapshots.periodType,
          periodStart: ttbPeriodSnapshots.periodStart,
          periodEnd: ttbPeriodSnapshots.periodEnd,
          status: ttbPeriodSnapshots.status,
          finalizedAt: ttbPeriodSnapshots.finalizedAt,
          finalizedBy: ttbPeriodSnapshots.finalizedBy,
        })
        .from(ttbPeriodSnapshots)
        .where(
          and(
            eq(ttbPeriodSnapshots.status, "finalized"),
            sql`${ttbPeriodSnapshots.year} = EXTRACT(YEAR FROM ${reconciliationDate}::date)`,
          )
        )
        .orderBy(asc(ttbPeriodSnapshots.periodStart));

      // Check if the selected date range overlaps any finalized period
      const currentPeriodFinalized = finalizedPeriods.some((fp) => {
        const fpStart = new Date(fp.periodStart).toISOString().split("T")[0];
        const fpEnd = new Date(fp.periodEnd).toISOString().split("T")[0];
        return batchReconStartDate <= fpEnd && reconciliationDate >= fpStart;
      });

      const lastFinalizedDate = finalizedPeriods.length > 0
        ? new Date(finalizedPeriods[finalizedPeriods.length - 1].periodEnd).toISOString().split("T")[0]
        : null;

      // Query waterfall adjustments for the period year
      const periodYear = reconciliationDateObj.getFullYear();
      const waterfallAdjs = await db
        .select({
          id: ttbWaterfallAdjustments.id,
          waterfallLine: ttbWaterfallAdjustments.waterfallLine,
          amountGallons: ttbWaterfallAdjustments.amountGallons,
          reason: ttbWaterfallAdjustments.reason,
          notes: ttbWaterfallAdjustments.notes,
          adjustedAt: ttbWaterfallAdjustments.adjustedAt,
        })
        .from(ttbWaterfallAdjustments)
        .where(
          and(
            eq(ttbWaterfallAdjustments.periodYear, periodYear),
            isNull(ttbWaterfallAdjustments.deletedAt),
          ),
        )
        .orderBy(asc(ttbWaterfallAdjustments.adjustedAt));

      // ============================================
      // TOP-LEVEL IDENTITY ASSERTION
      // Opening + Production + TransfersIn - TransfersOut + PositiveAdj - Sales - Losses - Distillation ≈ Calculated Ending
      // Uses waterfall totals (already computed per-tax-class and summed).
      // Note: transfersIn and transfersOut are cross-class movements; at the global level they
      // should net to 0 (every transfer out of one class is a transfer into another). The assertion
      // still includes them individually for transparency.
      // ============================================
      const wfTotalOpening = waterfallData.reduce((s, w) => s + w.opening, 0);
      const wfTotalProduction = waterfallData.reduce((s, w) => s + w.production, 0);
      const wfTotalTransfersIn = waterfallData.reduce((s, w) => s + w.transfersIn, 0);
      const wfTotalTransfersOut = waterfallData.reduce((s, w) => s + w.transfersOut, 0);
      const wfTotalPositiveAdj = waterfallData.reduce((s, w) => s + w.positiveAdj, 0);
      const wfTotalReconAdj = waterfallData.reduce((s, w: any) => s + (w.reconAdj || 0), 0);
      const wfTotalSales = waterfallData.reduce((s, w) => s + w.sales, 0);
      const wfTotalLosses = waterfallData.reduce((s, w) => s + w.losses, 0);
      const wfTotalDistillation = waterfallData.reduce((s, w) => s + w.distillation, 0);
      const wfTotalCalcEnding = waterfallData.reduce((s, w) => s + w.calculatedEnding, 0);
      const topExpectedEnding = wfTotalOpening + wfTotalProduction + wfTotalTransfersIn - wfTotalTransfersOut
        + wfTotalPositiveAdj + wfTotalReconAdj - wfTotalLosses - wfTotalDistillation - wfTotalSales;
      const topIdentityGap = Math.abs(topExpectedEnding - wfTotalCalcEnding);
      if (topIdentityGap > 0.5) {
        const msg = `Top-level identity failure: expected ending ${topExpectedEnding.toFixed(1)} vs calculated ${wfTotalCalcEnding.toFixed(1)} (gap ${topIdentityGap.toFixed(2)} gal)`;
        console.error(`[TTB Parity] ${msg}`);
        parityWarnings.push({
          level: "error",
          category: "topLevelIdentity",
          message: msg,
          detail: {
            opening: parseFloat(wfTotalOpening.toFixed(2)),
            production: parseFloat(wfTotalProduction.toFixed(2)),
            transfersIn: parseFloat(wfTotalTransfersIn.toFixed(2)),
            transfersOut: parseFloat(wfTotalTransfersOut.toFixed(2)),
            positiveAdj: parseFloat(wfTotalPositiveAdj.toFixed(2)),
            sales: parseFloat(wfTotalSales.toFixed(2)),
            losses: parseFloat(wfTotalLosses.toFixed(2)),
            distillation: parseFloat(wfTotalDistillation.toFixed(2)),
            expected: parseFloat(topExpectedEnding.toFixed(2)),
            actual: parseFloat(wfTotalCalcEnding.toFixed(2)),
            gap: parseFloat(topIdentityGap.toFixed(2)),
          },
        });
      }

      // Variance check: SBD per-batch drift (reconstructed ending vs stored currentVolumeLiters).
      // This is the data quality metric — non-zero drift means the system's volume reconstruction
      // doesn't match what's stored in the database.
      // Note: the aggregate waterfall (calculatedEnding vs physical) has structural variance because
      // it scopes batches differently than the physical inventory query. The SBD drift is the
      // correct metric since the header waterfall now uses SBD values.
      const sbdTotalDriftL = batchRecon.batches.reduce(
        (s: number, b: { driftLiters: number }) => s + b.driftLiters, 0
      );
      const sbdTotalDriftGal = litersToWineGallons(sbdTotalDriftL);
      if (!isInitialReconciliation && Math.abs(sbdTotalDriftGal) > 1.0) {
        const msg = `SBD drift ${sbdTotalDriftGal.toFixed(1)} gal: total per-batch volume reconstruction differs from stored values`;
        console.warn(`[TTB Parity] ${msg}`);
        parityWarnings.push({
          level: Math.abs(sbdTotalDriftGal) > 5.0 ? "error" : "warning",
          category: "variance",
          message: msg,
          detail: {
            sbdDriftGallons: parseFloat(sbdTotalDriftGal.toFixed(2)),
            sbdDriftLiters: parseFloat(sbdTotalDriftL.toFixed(2)),
            batchesWithDrift: batchRecon.batchesWithDrift,
          },
        });
      }

      return {
        hasOpeningBalances: true,
        openingBalanceDate: openingDate,
        reconciliationDate,
        isInitialReconciliation,
        varianceThresholdPct,
        taxClasses,
        totals: {
          // TTB waterfall — uses aggregate queries (same as TTB Form 5120.17)
          ttbOpeningBalance: parseFloat(totalTtb.toFixed(1)),
          production: parseFloat((totalProductionIncludingBrandy + positiveAdjustmentsBeforeGallons).toFixed(1)),
          ciderProduction: parseFloat(totalProductionGallons.toFixed(1)),
          brandyReceived: parseFloat(brandyReceivedGallons.toFixed(1)),
          removals: parseFloat(salesGallons.toFixed(1)),
          // Raw aggregate losses (consistent with waterfall.byTaxClass[].losses)
          losses: parseFloat(processLossesGallons.toFixed(1)),
          distillation: parseFloat(distillationGallons.toFixed(1)),
          // Physical inventory = LIVE currentVolumeLiters + packaged (matching production/loss scope)
          ttbCalculatedEnding: parseFloat(totalInventoryByTaxClass.toFixed(1)),
          // Production breakdown
          pressRunsProduction: parseFloat(totalPressRunsGallons.toFixed(1)),
          juicePurchasesProduction: parseFloat(totalJuicePurchasesGallons.toFixed(1)),
          // Sales breakdown (batch-scoped distributions)
          bottleDistributions: parseFloat(bottleDistributionsBeforeGallons.toFixed(1)),
          kegDistributions: parseFloat(kegDistributionsBeforeGallons.toFixed(1)),
          // System
          systemOnHand: parseFloat(systemOnHand.toFixed(1)),
          systemCalculatedOnHand: parseFloat(systemCalculatedOnHand.toFixed(1)),
          // Batch reconstruction (for data quality review)
          systemReconstructedOnHand: parseFloat(systemReconstructedOnHand.toFixed(1)),
          // Variance: aggregate calculated ending vs physical inventory
          // Non-zero means the waterfall identity doesn't match what's physically in tanks.
          variance: 0, // Computed per-tax-class in waterfall; total shown here for legacy compat
          // Legacy fields for backwards compatibility
          ttbBalance: parseFloat(totalTtb.toFixed(1)),
          currentInventory: parseFloat(totalInventoryByTaxClass.toFixed(1)),
          legacyBatches: 0,
          difference: 0,
        },
        // Additional breakdown for UI display
        breakdown: {
          bulkInventory: parseFloat(actualBulkGallons.toFixed(1)),
          // SBD-based packaged inventory (date-bounded, batch-scoped) — replaces LIVE query
          packagedInventory: parseFloat(litersToWineGallons(Math.max(0, packagedOnHandLiters)).toFixed(1)),
          // Keep LIVE value for reference/debugging
          livePackagedInventory: parseFloat(actualPackagedGallons.toFixed(1)),
          sales: parseFloat(salesGallons.toFixed(1)),
          losses: parseFloat(lossesGallons.toFixed(1)),
          distillation: parseFloat(distillationGallons.toFixed(1)),
        },
        // Clamped volume: batches that went negative during reconstruction (data quality indicator)
        // This amount is subtracted from aggregate losses to balance the waterfall with SBD ending
        clampedVolume: parseFloat(clampedLossGallons.toFixed(1)),
        // Inventory breakdown by batch originating year
        inventoryByYear,
        // Production Audit (Source-Based View)
        productionAudit: {
          totals: {
            pressRuns: parseFloat(totalPressRunsGallons.toFixed(1)),
            juicePurchases: parseFloat(totalJuicePurchasesGallons.toFixed(1)),
            totalProduction: parseFloat(auditTotalProductionGallons.toFixed(1)),
          },
          byYear: productionByYear,
        },
        // Batch details by tax class for reconciliation review
        batchDetailsByTaxClass: Object.fromEntries(
          Object.entries(batchDetailsByTaxClass).map(([key, batches]) => [
            key,
            batches.map(b => ({
              id: b.id,
              batchId: b.batchId,
              name: b.name,
              batchNumber: b.batchNumber,
              startDate: b.startDate,
              vesselName: b.vesselName,
              volumeLiters: parseFloat(b.volumeLiters.toFixed(2)),
              volumeGallons: parseFloat(b.volumeGallons.toFixed(2)),
              type: b.type,
              packageInfo: b.packageInfo,
            })),
          ])
        ),
        // Debug breakdown for troubleshooting calculations
        debug: {
          lossesBreakdown: {
            overall: {
              racking: parseFloat(rackingLossesBeforeGallons.toFixed(2)),
              filter: parseFloat(filterLossesBeforeGallons.toFixed(2)),
              bottling: parseFloat(bottlingLossesBeforeGallons.toFixed(2)),
              transfer: parseFloat(transferLossesBeforeGallons.toFixed(2)),
              volumeAdjustments: parseFloat(volumeAdjustmentsBeforeGallons.toFixed(2)),
              kegFills: parseFloat(kegFillLossesBeforeGallons.toFixed(2)),
              total: parseFloat(lossesGallons.toFixed(2)),
            },
            byTaxClass: Object.fromEntries(
              Object.entries(lossesByTaxClass).map(([key, val]) => [key, parseFloat(val.toFixed(2))])
            ),
            byTaxClassTotal: parseFloat(Object.values(lossesByTaxClass).reduce((sum, val) => sum + val, 0).toFixed(2)),
          },
          inventoryBreakdown: {
            byTaxClass: Object.fromEntries(
              Object.entries(inventoryByTaxClass).map(([key, val]) => [key, parseFloat(val.toFixed(2))])
            ),
            byTaxClassTotal: parseFloat(totalInventoryByTaxClass.toFixed(2)),
            bulk: parseFloat(actualBulkGallons.toFixed(2)),
            packaged: parseFloat(actualPackagedGallons.toFixed(2)),
            bulkPlusPackaged: parseFloat((actualBulkGallons + actualPackagedGallons).toFixed(2)),
          },
          productionBreakdown: {
            pressRuns: parseFloat(totalPressRunsGallons.toFixed(2)),
            juicePurchases: parseFloat(totalJuicePurchasesGallons.toFixed(2)),
            juiceOnlyDeduction: parseFloat(auditJuiceOnlyGallons.toFixed(2)),
            transfersIntoJuiceDeduction: parseFloat(auditTransfersIntoJuiceGallons.toFixed(2)),
            ciderProduction: parseFloat(totalProductionGallons.toFixed(2)),
            brandyReceived: parseFloat(brandyReceivedGallons.toFixed(2)),
            totalProduction: parseFloat(totalProductionIncludingBrandy.toFixed(2)),
          },
          ttbCalculation: {
            opening: parseFloat(totalTtb.toFixed(2)),
            // Aggregate values (same as TTB Form 5120.17)
            production: parseFloat(totalProductionIncludingBrandy.toFixed(2)),
            positiveAdjustments: parseFloat(positiveAdjustmentsBeforeGallons.toFixed(2)),
            sales: parseFloat(salesGallons.toFixed(2)),
            rawLosses: parseFloat(processLossesGallons.toFixed(2)),
            clampedLoss: parseFloat(clampedLossGallons.toFixed(2)),
            effectiveLosses: parseFloat((processLossesGallons - clampedLossGallons).toFixed(2)),
            distillation: parseFloat(distillationGallons.toFixed(2)),
            aggregateEnding: parseFloat(ttbCalculatedEnding.toFixed(2)),
            // System reconstruction
            systemOnHand: parseFloat(systemOnHand.toFixed(2)),
            systemTotalOnHand: parseFloat(systemTotalOnHand.toFixed(2)),
            systemCalculatedOnHand: parseFloat(systemCalculatedOnHand.toFixed(2)),
            variance: parseFloat((ttbCalculatedEnding - systemCalculatedOnHand).toFixed(2)),
          },
          openingBalanceVerification: {
            configuredOpeningDate: openingDate,
            configuredOpeningBalanceGallons: parseFloat(totalTtb.toFixed(2)),
            batchesAtOpeningDate: openingBatchDebug,
            batchesTotalInitialVolumeGallons: parseFloat(openingBatchTotalGallons.toFixed(2)),
            differenceFromConfigured: parseFloat((totalTtb - openingBatchTotalGallons).toFixed(2)),
          },
        },
        // Waterfall calculation per tax class
        waterfall: {
          periodStart: waterfallPeriodStart,
          periodEnd: reconciliationDate,
          hasLastReconciliation: !!lastRecon,
          byTaxClass: waterfallData,
          totals: {
            opening: parseFloat(waterfallData.reduce((sum, w) => sum + w.opening, 0).toFixed(2)),
            production: parseFloat(waterfallData.reduce((sum, w) => sum + w.production, 0).toFixed(2)),
            transfersIn: parseFloat(waterfallData.reduce((sum, w) => sum + w.transfersIn, 0).toFixed(2)),
            transfersOut: parseFloat(waterfallData.reduce((sum, w) => sum + w.transfersOut, 0).toFixed(2)),
            positiveAdj: parseFloat(waterfallData.reduce((sum, w) => sum + w.positiveAdj, 0).toFixed(2)),
            reconAdj: parseFloat(waterfallData.reduce((sum, w: any) => sum + (w.reconAdj || 0), 0).toFixed(2)),
            packaging: parseFloat(waterfallData.reduce((sum, w) => sum + w.packaging, 0).toFixed(2)),
            losses: parseFloat(waterfallData.reduce((sum, w) => sum + w.losses, 0).toFixed(2)),
            distillation: parseFloat(waterfallData.reduce((sum, w) => sum + w.distillation, 0).toFixed(2)),
            sales: parseFloat(waterfallData.reduce((sum, w) => sum + w.sales, 0).toFixed(2)),
            calculatedEnding: parseFloat(waterfallData.reduce((sum, w) => sum + w.calculatedEnding, 0).toFixed(2)),
            physical: parseFloat(waterfallData.reduce((sum, w) => sum + w.physical, 0).toFixed(2)),
            variance: parseFloat(waterfallData.reduce((sum, w) => sum + w.variance, 0).toFixed(2)),
          },
        },
        // DEBUG: Trace variance source
        _debug_waterfall: {
          sbdDerivedOpening: parseFloat(totalTtb.toFixed(1)),
          sbdOpening: batchRecon.totals.opening,
          sbdProduction: batchRecon.totals.production,
          sbdPackaging: batchRecon.totals.packaging,
          sbdSales: batchRecon.totals.sales,
          sbdLosses: batchRecon.totals.losses,
          sbdDistillation: batchRecon.totals.distillation,
          sbdEnding: batchRecon.totals.ending,
          sbdIdentityCheck: batchRecon.identityCheck,
          waterfallAdjCount: waterfallAdjs.length,
          openingDelta: parseFloat((batchRecon.totals.opening - totalTtb).toFixed(1)),
        },
        // Waterfall adjustments for the period year
        waterfallAdjustments: waterfallAdjs,
        // Batch-derived reconciliation (single source of truth)
        batchReconciliation: {
          startDate: batchReconStartDate,
          endDate: reconciliationDate,
          identityCheck: batchRecon.identityCheck,
          totals: batchRecon.totals,
          lossBreakdown: batchRecon.lossBreakdown,
          batchesWithIdentityIssues: batchRecon.batchesWithIdentityIssues,
          batchesWithDrift: batchRecon.batchesWithDrift,
          batchesWithInitialAnomaly: batchRecon.batchesWithInitialAnomaly,
          vesselCapacityWarnings: batchRecon.vesselCapacityWarnings,
          batches: batchRecon.batches,
        },
        // Parity diagnostics: identity assertion results for client display
        parityDiagnostics: {
          passed: parityWarnings.length === 0,
          warnings: parityWarnings,
        },
        // Reconciliation safeguards
        lockedYears: (settings?.reconciliationLockedYears as number[]) || [],
        // Period finalization status
        periodStatus: {
          finalizedPeriods: finalizedPeriods.map((fp) => ({
            id: fp.id,
            periodType: fp.periodType,
            periodStart: new Date(fp.periodStart).toISOString().split("T")[0],
            periodEnd: new Date(fp.periodEnd).toISOString().split("T")[0],
            finalizedAt: fp.finalizedAt ? new Date(fp.finalizedAt).toISOString() : null,
          })),
          currentPeriodFinalized,
          lastFinalizedDate,
        },
      };
    } catch (error) {
      console.error("Error getting reconciliation summary:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get reconciliation summary",
      });
    }
  }),

  // ============================================
  // RECONCILIATION SNAPSHOTS
  // ============================================

  /**
   * Save current reconciliation state as a snapshot
   * Takes the summary data from the frontend (which already has the calculated values)
   */
  saveReconciliation: protectedProcedure
    .input(
      z.object({
        reconciliationDate: z.string(), // ISO date
        name: z.string().optional(),
        notes: z.string().optional(),
        discrepancyExplanation: z.string().optional(),
        // Period tracking (optional for backwards compatibility)
        periodStartDate: z.string().optional(), // ISO date - start of period
        periodEndDate: z.string().optional(), // ISO date - end of period (usually = reconciliationDate)
        previousReconciliationId: z.string().uuid().optional(), // Link to previous reconciliation
        // Balance tracking (optional for backwards compatibility)
        openingBalanceGallons: z.number().optional(),
        calculatedEndingGallons: z.number().optional(),
        physicalCountGallons: z.number().optional(),
        varianceGallons: z.number().optional(),
        // Summary data from frontend
        summary: z.object({
          openingBalanceDate: z.string().nullable(),
          totals: z.object({
            ttbBalance: z.number(),
            currentInventory: z.number(),
            removals: z.number(),
            legacyBatches: z.number(),
            difference: z.number(),
          }),
          breakdown: z.object({
            bulkInventory: z.number(),
            packagedInventory: z.number(),
            sales: z.number(),
            losses: z.number(),
          }).optional(),
          inventoryByYear: z.array(z.object({
            year: z.number(),
            bulkGallons: z.number(),
            packagedGallons: z.number(),
            totalGallons: z.number(),
          })).optional(),
          productionAudit: z.object({
            totals: z.object({
              pressRuns: z.number(),
              juicePurchases: z.number(),
              totalProduction: z.number(),
            }),
            byYear: z.array(z.object({
              year: z.number(),
              pressRunsGallons: z.number(),
              juicePurchasesGallons: z.number(),
              totalGallons: z.number(),
            })),
          }).optional(),
          taxClasses: z.array(z.any()).optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { summary } = input;
      const isReconciled = Math.abs(summary.totals.difference) < 0.5;

      const [snapshot] = await db
        .insert(ttbReconciliationSnapshots)
        .values({
          reconciliationDate: input.reconciliationDate,
          name: input.name,

          // Period tracking
          periodStartDate: input.periodStartDate,
          periodEndDate: input.periodEndDate || input.reconciliationDate,
          previousReconciliationId: input.previousReconciliationId,

          // Balance tracking
          openingBalanceGallons: input.openingBalanceGallons?.toString(),
          calculatedEndingGallons: input.calculatedEndingGallons?.toString(),
          physicalCountGallons: input.physicalCountGallons?.toString(),
          varianceGallons: input.varianceGallons?.toString(),

          // TTB Reference
          ttbBalance: summary.totals.ttbBalance.toString(),
          ttbSourceType: input.previousReconciliationId ? "previous_snapshot" : "opening_balance",
          ttbSourceDate: summary.openingBalanceDate,

          // Inventory Audit
          inventoryBulk: (summary.breakdown?.bulkInventory || 0).toString(),
          inventoryPackaged: (summary.breakdown?.packagedInventory || 0).toString(),
          inventoryOnHand: summary.totals.currentInventory.toString(),
          inventoryRemovals: summary.totals.removals.toString(),
          inventoryLegacy: "0",
          inventoryAccountedFor: (
            summary.totals.currentInventory +
            summary.totals.removals
          ).toString(),
          inventoryDifference: summary.totals.difference.toString(),

          // Production Audit
          productionPressRuns: (summary.productionAudit?.totals.pressRuns || 0).toString(),
          productionJuicePurchases: (summary.productionAudit?.totals.juicePurchases || 0).toString(),
          productionTotal: (summary.productionAudit?.totals.totalProduction || 0).toString(),

          // Breakdown data (JSON)
          productionByYear: JSON.stringify(summary.productionAudit?.byYear || []),
          inventoryByYear: JSON.stringify(summary.inventoryByYear || []),
          taxClassBreakdown: JSON.stringify(summary.taxClasses || []),

          // Status
          isReconciled,
          status: "finalized",
          finalizedAt: new Date(),
          notes: input.notes,
          discrepancyExplanation: input.discrepancyExplanation,

          createdBy: ctx.session?.user?.id,
        })
        .returning();

      return snapshot;
    }),

  /**
   * Get list of past reconciliations
   */
  getReconciliationHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;

      const snapshots = await db
        .select({
          id: ttbReconciliationSnapshots.id,
          reconciliationDate: ttbReconciliationSnapshots.reconciliationDate,
          name: ttbReconciliationSnapshots.name,
          ttbBalance: ttbReconciliationSnapshots.ttbBalance,
          inventoryOnHand: ttbReconciliationSnapshots.inventoryOnHand,
          inventoryDifference: ttbReconciliationSnapshots.inventoryDifference,
          productionTotal: ttbReconciliationSnapshots.productionTotal,
          isReconciled: ttbReconciliationSnapshots.isReconciled,
          status: ttbReconciliationSnapshots.status,
          finalizedAt: ttbReconciliationSnapshots.finalizedAt,
          createdAt: ttbReconciliationSnapshots.createdAt,
        })
        .from(ttbReconciliationSnapshots)
        .orderBy(desc(ttbReconciliationSnapshots.reconciliationDate))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ttbReconciliationSnapshots);

      return {
        snapshots: snapshots.map((s) => ({
          ...s,
          ttbBalance: parseFloat(s.ttbBalance || "0"),
          inventoryOnHand: parseFloat(s.inventoryOnHand || "0"),
          inventoryDifference: parseFloat(s.inventoryDifference || "0"),
          productionTotal: parseFloat(s.productionTotal || "0"),
        })),
        total: Number(count),
        hasMore: offset + limit < Number(count),
      };
    }),

  /**
   * Get a specific reconciliation snapshot by ID
   */
  getReconciliationById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [snapshot] = await db
        .select()
        .from(ttbReconciliationSnapshots)
        .where(eq(ttbReconciliationSnapshots.id, input.id));

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reconciliation snapshot not found",
        });
      }

      return {
        ...snapshot,
        ttbBalance: parseFloat(snapshot.ttbBalance || "0"),
        inventoryBulk: parseFloat(snapshot.inventoryBulk || "0"),
        inventoryPackaged: parseFloat(snapshot.inventoryPackaged || "0"),
        inventoryOnHand: parseFloat(snapshot.inventoryOnHand || "0"),
        inventoryRemovals: parseFloat(snapshot.inventoryRemovals || "0"),
        inventoryLegacy: parseFloat(snapshot.inventoryLegacy || "0"),
        inventoryAccountedFor: parseFloat(snapshot.inventoryAccountedFor || "0"),
        inventoryDifference: parseFloat(snapshot.inventoryDifference || "0"),
        productionPressRuns: parseFloat(snapshot.productionPressRuns || "0"),
        productionJuicePurchases: parseFloat(snapshot.productionJuicePurchases || "0"),
        productionTotal: parseFloat(snapshot.productionTotal || "0"),
        productionByYear: snapshot.productionByYear ? JSON.parse(snapshot.productionByYear) : [],
        inventoryByYear: snapshot.inventoryByYear ? JSON.parse(snapshot.inventoryByYear) : [],
        taxClassBreakdown: snapshot.taxClassBreakdown ? JSON.parse(snapshot.taxClassBreakdown) : [],
      };
    }),

  /**
   * Finalize a reconciliation snapshot
   */
  finalizeReconciliation: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().optional(),
        discrepancyExplanation: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [snapshot] = await db
        .update(ttbReconciliationSnapshots)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          finalizedBy: ctx.session?.user?.id,
          notes: input.notes,
          discrepancyExplanation: input.discrepancyExplanation,
          updatedAt: new Date(),
        })
        .where(eq(ttbReconciliationSnapshots.id, input.id))
        .returning();

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reconciliation snapshot not found",
        });
      }

      return snapshot;
    }),

  /**
   * Get the most recent finalized reconciliation
   */
  getLastReconciliation: protectedProcedure.query(async () => {
    const [snapshot] = await db
      .select()
      .from(ttbReconciliationSnapshots)
      .where(eq(ttbReconciliationSnapshots.status, "finalized"))
      .orderBy(desc(ttbReconciliationSnapshots.finalizedAt))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    // Parse taxClassBreakdown JSON
    let taxClasses: Array<{
      key: string;
      label: string;
      ttbTotal: number;
      currentInventory: number;
      removals: number;
      legacyBatches: number;
      difference: number;
      isReconciled: boolean;
    }> = [];

    if (snapshot.taxClassBreakdown) {
      try {
        const parsed = typeof snapshot.taxClassBreakdown === 'string'
          ? JSON.parse(snapshot.taxClassBreakdown)
          : snapshot.taxClassBreakdown;
        taxClasses = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Failed to parse taxClassBreakdown:", e);
      }
    }

    return {
      ...snapshot,
      ttbBalance: parseFloat(snapshot.ttbBalance || "0"),
      inventoryOnHand: parseFloat(snapshot.inventoryOnHand || "0"),
      inventoryRemovals: parseFloat(snapshot.inventoryRemovals || "0"),
      inventoryLegacy: parseFloat(snapshot.inventoryLegacy || "0"),
      inventoryAccountedFor: parseFloat(snapshot.inventoryAccountedFor || "0"),
      inventoryDifference: parseFloat(snapshot.inventoryDifference || "0"),
      inventoryBulk: parseFloat(snapshot.inventoryBulk || "0"),
      inventoryPackaged: parseFloat(snapshot.inventoryPackaged || "0"),
      productionTotal: parseFloat(snapshot.productionTotal || "0"),
      productionPressRuns: parseFloat(snapshot.productionPressRuns || "0"),
      productionJuicePurchases: parseFloat(snapshot.productionJuicePurchases || "0"),
      openingBalanceGallons: snapshot.openingBalanceGallons ? parseFloat(snapshot.openingBalanceGallons) : null,
      calculatedEndingGallons: snapshot.calculatedEndingGallons ? parseFloat(snapshot.calculatedEndingGallons) : null,
      physicalCountGallons: snapshot.physicalCountGallons ? parseFloat(snapshot.physicalCountGallons) : null,
      varianceGallons: snapshot.varianceGallons ? parseFloat(snapshot.varianceGallons) : null,
      taxClasses,
    };
  }),

  /**
   * Get suggested next reconciliation period based on last finalized reconciliation
   * Returns period presets (This Month, Last Month, etc.) and suggested start date
   */
  getReconciliationPeriodSuggestions: protectedProcedure.query(async () => {
    // Get the most recent finalized reconciliation
    const [lastReconciliation] = await db
      .select({
        periodEndDate: ttbReconciliationSnapshots.periodEndDate,
        reconciliationDate: ttbReconciliationSnapshots.reconciliationDate,
        physicalCountGallons: ttbReconciliationSnapshots.physicalCountGallons,
        inventoryOnHand: ttbReconciliationSnapshots.inventoryOnHand,
      })
      .from(ttbReconciliationSnapshots)
      .where(eq(ttbReconciliationSnapshots.status, "finalized"))
      .orderBy(desc(ttbReconciliationSnapshots.finalizedAt))
      .limit(1);

    // Get TTB opening balance date as fallback
    const [settings] = await db
      .select({
        ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
      })
      .from(organizationSettings)
      .limit(1);

    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];

    // Determine the suggested start date
    let suggestedStartDate: string;
    let suggestedOpeningBalance: number;
    let previousReconciliationId: string | null = null;
    let hasLastReconciliation = false;

    if (lastReconciliation?.periodEndDate || lastReconciliation?.reconciliationDate) {
      // Use day after last reconciliation period end
      const lastEndDate = new Date(lastReconciliation.periodEndDate || lastReconciliation.reconciliationDate);
      lastEndDate.setDate(lastEndDate.getDate() + 1);
      suggestedStartDate = lastEndDate.toISOString().split("T")[0];
      suggestedOpeningBalance = lastReconciliation.physicalCountGallons
        ? parseFloat(lastReconciliation.physicalCountGallons)
        : parseFloat(lastReconciliation.inventoryOnHand || "0");
      hasLastReconciliation = true;
    } else if (settings?.ttbOpeningBalanceDate) {
      // Use TTB opening balance date
      suggestedStartDate = settings.ttbOpeningBalanceDate;
      suggestedOpeningBalance = 0; // Will be calculated from opening balances
    } else {
      // Default to start of current year
      suggestedStartDate = `${today.getFullYear()}-01-01`;
      suggestedOpeningBalance = 0;
    }

    // Build period presets
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Helper to get month name
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    // This month
    const thisMonthStart = new Date(currentYear, currentMonth, 1);
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0);

    // Last month
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0);

    // This quarter
    const currentQuarter = Math.floor(currentMonth / 3);
    const thisQuarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const thisQuarterEnd = new Date(currentYear, (currentQuarter + 1) * 3, 0);

    // Year to date
    const yearStart = new Date(currentYear, 0, 1);

    const presets = [
      {
        label: `This Month (${monthNames[currentMonth]})`,
        startDate: thisMonthStart.toISOString().split("T")[0],
        endDate: todayISO,
      },
      {
        label: `Last Month (${monthNames[currentMonth === 0 ? 11 : currentMonth - 1]})`,
        startDate: lastMonthStart.toISOString().split("T")[0],
        endDate: lastMonthEnd.toISOString().split("T")[0],
      },
      {
        label: `This Quarter (Q${currentQuarter + 1})`,
        startDate: thisQuarterStart.toISOString().split("T")[0],
        endDate: todayISO,
      },
      {
        label: "Year to Date",
        startDate: yearStart.toISOString().split("T")[0],
        endDate: todayISO,
      },
    ];

    // Add "Continue from Last Reconciliation" preset if applicable
    if (hasLastReconciliation && suggestedStartDate < todayISO) {
      presets.unshift({
        label: `Continue from Last Reconciliation (${suggestedStartDate})`,
        startDate: suggestedStartDate,
        endDate: todayISO,
      });
    }

    return {
      suggestedStartDate,
      suggestedOpeningBalance,
      previousReconciliationId,
      hasLastReconciliation,
      presets,
    };
  }),

  // ============================================
  // BATCH LIFECYCLE AUDIT ENDPOINTS
  // ============================================

  /**
   * Get chronological timeline of all events for a single batch.
   * Includes: creation, transfers, racking, filtering, packaging, volume adjustments.
   */
  getBatchLifecycleTimeline: protectedProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(), // ISO date string
      })
    )
    .query(async ({ input }) => {
      const { batchId, startDate, endDate } = input;

      // Get the batch info
      const [batch] = await db
        .select({
          id: batches.id,
          name: batches.name,
          productType: batches.productType,
          startDate: batches.startDate,
          endDate: batches.endDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          vesselId: batches.vesselId,
          vesselName: vessels.name,
          status: batches.status,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(eq(batches.id, batchId));

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      type TimelineEvent = {
        id: string;
        type: "creation" | "transfer_in" | "transfer_out" | "racking" | "filtering" | "packaging" | "volume_adjustment" | "carbonation";
        date: Date;
        description: string;
        volumeChange: number | null;
        runningVolume: number | null;
        vesselFrom: string | null;
        vesselTo: string | null;
        lossLiters: number | null;
        metadata: Record<string, unknown>;
      };

      const events: TimelineEvent[] = [];

      // 1. Creation event
      events.push({
        id: `creation-${batch.id}`,
        type: "creation",
        date: batch.startDate,
        description: `Batch created in ${batch.vesselName || "unknown vessel"}`,
        volumeChange: parseFloat(batch.initialVolumeLiters || "0"),
        runningVolume: parseFloat(batch.initialVolumeLiters || "0"),
        vesselFrom: null,
        vesselTo: batch.vesselName,
        lossLiters: null,
        metadata: { productType: batch.productType },
      });

      // 2. Transfers out (this batch was the source)
      const transfersOut = await db
        .select({
          id: batchTransfers.id,
          transferredAt: batchTransfers.transferredAt,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          sourceVesselName: sql<string>`source_vessel.name`,
          destVesselName: sql<string>`dest_vessel.name`,
          destBatchName: sql<string>`dest_batch.name`,
          notes: batchTransfers.notes,
        })
        .from(batchTransfers)
        .leftJoin(sql`vessels source_vessel`, sql`source_vessel.id = ${batchTransfers.sourceVesselId}`)
        .leftJoin(sql`vessels dest_vessel`, sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`)
        .leftJoin(sql`batches dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
        .where(eq(batchTransfers.sourceBatchId, batchId));

      for (const t of transfersOut) {
        events.push({
          id: `transfer-out-${t.id}`,
          type: "transfer_out",
          date: t.transferredAt,
          description: `Transferred to ${t.destBatchName || t.destVesselName || "unknown"}`,
          volumeChange: -parseFloat(t.volumeTransferred || "0"),
          runningVolume: null, // Will be calculated after sorting
          vesselFrom: t.sourceVesselName,
          vesselTo: t.destVesselName,
          lossLiters: t.loss ? parseFloat(t.loss) : null,
          metadata: { notes: t.notes },
        });
      }

      // 3. Transfers in (this batch was the destination)
      const transfersIn = await db
        .select({
          id: batchTransfers.id,
          transferredAt: batchTransfers.transferredAt,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          sourceVesselName: sql<string>`source_vessel.name`,
          destVesselName: sql<string>`dest_vessel.name`,
          sourceBatchName: sql<string>`source_batch.name`,
          notes: batchTransfers.notes,
        })
        .from(batchTransfers)
        .leftJoin(sql`vessels source_vessel`, sql`source_vessel.id = ${batchTransfers.sourceVesselId}`)
        .leftJoin(sql`vessels dest_vessel`, sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`)
        .leftJoin(sql`batches source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
        .where(eq(batchTransfers.destinationBatchId, batchId));

      for (const t of transfersIn) {
        events.push({
          id: `transfer-in-${t.id}`,
          type: "transfer_in",
          date: t.transferredAt,
          description: `Received from ${t.sourceBatchName || t.sourceVesselName || "unknown"}`,
          volumeChange: parseFloat(t.volumeTransferred || "0"),
          runningVolume: null,
          vesselFrom: t.sourceVesselName,
          vesselTo: t.destVesselName,
          lossLiters: t.loss ? parseFloat(t.loss) : null,
          metadata: { notes: t.notes },
        });
      }

      // 4. Racking operations
      const rackings = await db
        .select({
          id: batchRackingOperations.id,
          rackedAt: batchRackingOperations.rackedAt,
          sourceVesselName: sql<string>`source_vessel.name`,
          destVesselName: sql<string>`dest_vessel.name`,
          volumeAfter: batchRackingOperations.volumeAfter,
          volumeLoss: batchRackingOperations.volumeLoss,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .leftJoin(sql`vessels source_vessel`, sql`source_vessel.id = ${batchRackingOperations.sourceVesselId}`)
        .leftJoin(sql`vessels dest_vessel`, sql`dest_vessel.id = ${batchRackingOperations.destinationVesselId}`)
        .where(eq(batchRackingOperations.batchId, batchId));

      for (const r of rackings) {
        events.push({
          id: `racking-${r.id}`,
          type: "racking",
          date: r.rackedAt,
          description: `Racked from ${r.sourceVesselName || "unknown"} to ${r.destVesselName || "unknown"}`,
          volumeChange: r.volumeLoss ? -parseFloat(r.volumeLoss) : 0,
          runningVolume: null,
          vesselFrom: r.sourceVesselName,
          vesselTo: r.destVesselName,
          lossLiters: r.volumeLoss ? parseFloat(r.volumeLoss) : null,
          metadata: { notes: r.notes },
        });
      }

      // 5. Filter operations
      const filters = await db
        .select({
          id: batchFilterOperations.id,
          filteredAt: batchFilterOperations.filteredAt,
          filterType: batchFilterOperations.filterType,
          volumeBefore: batchFilterOperations.volumeBefore,
          volumeAfter: batchFilterOperations.volumeAfter,
          volumeLoss: batchFilterOperations.volumeLoss,
          notes: batchFilterOperations.notes,
        })
        .from(batchFilterOperations)
        .where(eq(batchFilterOperations.batchId, batchId));

      for (const f of filters) {
        const lossLiters = parseFloat(f.volumeLoss || "0");

        events.push({
          id: `filter-${f.id}`,
          type: "filtering",
          date: f.filteredAt,
          description: `Filtered (${f.filterType || "unknown type"})`,
          volumeChange: -lossLiters,
          runningVolume: null,
          vesselFrom: null,
          vesselTo: null,
          lossLiters: lossLiters > 0 ? lossLiters : null,
          metadata: { filterType: f.filterType, notes: f.notes },
        });
      }

      // 6. Packaging (bottle runs)
      const packaging = await db
        .select({
          id: bottleRuns.id,
          packagedAt: bottleRuns.packagedAt,
          packageSizeML: bottleRuns.packageSizeML,
          unitsProduced: bottleRuns.unitsProduced,
          volumeTakenLiters: bottleRuns.volumeTakenLiters,
        })
        .from(bottleRuns)
        .where(eq(bottleRuns.batchId, batchId));

      for (const p of packaging) {
        const volumeTaken = parseFloat(p.volumeTakenLiters || "0");
        events.push({
          id: `packaging-${p.id}`,
          type: "packaging",
          date: p.packagedAt,
          description: `Packaged ${p.unitsProduced} × ${p.packageSizeML}ml units`,
          volumeChange: -volumeTaken,
          runningVolume: null,
          vesselFrom: null,
          vesselTo: null,
          lossLiters: null,
          metadata: {
            packageSizeML: p.packageSizeML,
            unitsProduced: p.unitsProduced,
          },
        });
      }

      // 7. Volume adjustments
      const adjustments = await db
        .select({
          id: batchVolumeAdjustments.id,
          adjustmentDate: batchVolumeAdjustments.adjustmentDate,
          reason: batchVolumeAdjustments.reason,
          volumeBefore: batchVolumeAdjustments.volumeBefore,
          volumeAfter: batchVolumeAdjustments.volumeAfter,
          notes: batchVolumeAdjustments.notes,
        })
        .from(batchVolumeAdjustments)
        .where(eq(batchVolumeAdjustments.batchId, batchId));

      for (const a of adjustments) {
        const prevVol = parseFloat(a.volumeBefore || "0");
        const newVol = parseFloat(a.volumeAfter || "0");
        const change = newVol - prevVol;

        events.push({
          id: `adjustment-${a.id}`,
          type: "volume_adjustment",
          date: a.adjustmentDate,
          description: `Volume adjusted: ${a.reason || "manual correction"}`,
          volumeChange: change,
          runningVolume: null,
          vesselFrom: null,
          vesselTo: null,
          lossLiters: change < 0 ? Math.abs(change) : null,
          metadata: {
            reason: a.reason,
            notes: a.notes,
            previousVolume: prevVol,
            newVolume: newVol,
          },
        });
      }

      // Sort events by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running volume
      let runningVolume = 0;
      for (const event of events) {
        if (event.type === "creation") {
          runningVolume = event.volumeChange || 0;
        } else {
          runningVolume += event.volumeChange || 0;
        }
        event.runningVolume = Math.max(0, runningVolume);
      }

      // Filter by date range if provided
      let filteredEvents = events;
      if (startDate) {
        const start = new Date(startDate);
        filteredEvents = filteredEvents.filter((e) => new Date(e.date) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        filteredEvents = filteredEvents.filter((e) => new Date(e.date) <= end);
      }

      return {
        batch: {
          id: batch.id,
          name: batch.name,
          productType: batch.productType,
          status: batch.status,
          initialVolumeLiters: parseFloat(batch.initialVolumeLiters || "0"),
          currentVolumeLiters: parseFloat(batch.currentVolumeLiters || "0"),
          currentVessel: batch.vesselName,
        },
        events: filteredEvents,
        summary: {
          totalEvents: filteredEvents.length,
          totalLossLiters: filteredEvents.reduce((sum, e) => sum + (e.lossLiters || 0), 0),
          totalPackagedLiters: filteredEvents
            .filter((e) => e.type === "packaging")
            .reduce((sum, e) => sum + Math.abs(e.volumeChange || 0), 0),
        },
      };
    }),

  /**
   * Get batch lifecycle activity grouped by tax class.
   * Shows Opening → Activity → Ending for each tax class.
   */
  getBatchLifecycleByTaxClass: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // ISO date string
        endDate: z.string(), // ISO date string
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Build batch classification map for dynamic tax class determination
      const { map: batchTaxClassMap } = await buildBatchTaxClassMap();

      // Get opening balance from reconciliation snapshots or TTB opening balance
      const [lastRecon] = await db
        .select()
        .from(ttbReconciliationSnapshots)
        .where(lt(ttbReconciliationSnapshots.reconciliationDate, startDate))
        .orderBy(desc(ttbReconciliationSnapshots.reconciliationDate))
        .limit(1);

      // Parse last reconciliation's tax class breakdown if available
      let lastReconTaxClassData: Record<string, number> = {};
      if (lastRecon?.taxClassBreakdown) {
        try {
          const parsed = JSON.parse(lastRecon.taxClassBreakdown);
          if (Array.isArray(parsed)) {
            for (const tc of parsed) {
              if (tc.key && tc.currentInventory !== undefined) {
                // Use the ending inventory from last recon as opening for this period
                lastReconTaxClassData[tc.key] = tc.currentInventory;
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      type TaxClassData = {
        taxClass: string;
        openingLiters: number;
        productionLiters: number;
        transfersInLiters: number;
        transfersOutLiters: number;
        packagingLiters: number;
        lossesLiters: number;
        endingLiters: number;
        batches: Array<{
          id: string;
          name: string;
          productType: string;
          openingVolume: number;
          currentVolume: number;
          vessel: string | null;
        }>;
      };

      // Get all batches grouped by product type (tax class)
      const allBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          productType: batches.productType,
          startDate: batches.startDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          vesselName: vessels.name,
          status: batches.status,
          isArchived: batches.isArchived,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            eq(batches.isArchived, false),
            isNull(batches.deletedAt),
            eq(batches.reconciliationStatus, "verified")
          )
        );

      // Group batches by tax class
      const taxClassMap = new Map<string, TaxClassData>();

      // Initialize tax classes with opening balances from last reconciliation
      const taxClassKeys = ["hardCider", "wineUnder16", "wine16To21", "wine21To24", "appleBrandy", "grapeSpirits", "materials", "other"];
      for (const key of taxClassKeys) {
        taxClassMap.set(key, {
          taxClass: key,
          openingLiters: lastReconTaxClassData[key] ? lastReconTaxClassData[key] * LITERS_PER_WINE_GALLON : 0, // Convert gallons to liters
          productionLiters: 0,
          transfersInLiters: 0,
          transfersOutLiters: 0,
          packagingLiters: 0,
          lossesLiters: 0,
          endingLiters: 0,
          batches: [],
        });
      }

      for (const batch of allBatches) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, batch.id, batch.productType) || "other";
        const data = taxClassMap.get(taxClass)!;

        const batchStartDate = new Date(batch.startDate);

        // Production = batches created during period (new inventory entering the system)
        const productionVolume = batchStartDate >= start && batchStartDate <= end
          ? parseFloat(batch.initialVolumeLiters || "0")
          : 0;

        // If no prior reconciliation, add pre-period batches to opening
        if (Object.keys(lastReconTaxClassData).length === 0 && batchStartDate < start) {
          data.openingLiters += parseFloat(batch.initialVolumeLiters || "0");
        }

        data.productionLiters += productionVolume;
        data.endingLiters += parseFloat(batch.currentVolumeLiters || "0");

        // Opening volume for a batch: 0 if created during period, else its initial volume
        const batchOpeningVolume = batchStartDate >= start
          ? 0
          : parseFloat(batch.initialVolumeLiters || "0");

        data.batches.push({
          id: batch.id,
          name: batch.name,
          productType: batch.productType,
          openingVolume: batchOpeningVolume,
          currentVolume: parseFloat(batch.currentVolumeLiters || "0"),
          vessel: batch.vesselName,
        });
      }

      // Get transfers during period
      const transfers = await db
        .select({
          id: batchTransfers.id,
          transferredAt: batchTransfers.transferredAt,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          sourceBatchId: batchTransfers.sourceBatchId,
          destBatchId: batchTransfers.destinationBatchId,
          sourceProductType: sql<string>`source_batch.product_type`,
          destProductType: sql<string>`dest_batch.product_type`,
        })
        .from(batchTransfers)
        .leftJoin(sql`batches source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
        .leftJoin(sql`batches dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
        .where(
          and(
            gte(batchTransfers.transferredAt, start),
            lte(batchTransfers.transferredAt, end)
          )
        );

      for (const t of transfers) {
        const sourceClass = getTaxClassFromMap(batchTaxClassMap, t.sourceBatchId, t.sourceProductType) || "other";
        const targetClass = getTaxClassFromMap(batchTaxClassMap, t.destBatchId, t.destProductType) || "other";
        const volume = parseFloat(t.volumeTransferred || "0");
        const loss = parseFloat(t.loss || "0");

        // Add loss to source class
        if (taxClassMap.has(sourceClass)) {
          taxClassMap.get(sourceClass)!.lossesLiters += loss;
        }

        // If transfer is between different tax classes, track it
        if (sourceClass !== targetClass) {
          if (taxClassMap.has(sourceClass)) {
            taxClassMap.get(sourceClass)!.transfersOutLiters += volume;
          }
          if (taxClassMap.has(targetClass)) {
            taxClassMap.get(targetClass)!.transfersInLiters += volume;
          }
        }
      }

      // Get packaging during period
      const packagingRuns = await db
        .select({
          id: bottleRuns.id,
          batchId: bottleRuns.batchId,
          volumeTakenLiters: bottleRuns.volumeTakenLiters,
          loss: bottleRuns.loss,
          productType: batches.productType,
        })
        .from(bottleRuns)
        .leftJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            gte(bottleRuns.packagedAt, start),
            lte(bottleRuns.packagedAt, end)
          )
        );

      for (const p of packagingRuns) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, p.batchId, p.productType) || "other";
        const volume = parseFloat(p.volumeTakenLiters || "0");
        const loss = parseFloat(p.loss || "0");

        if (taxClassMap.has(taxClass)) {
          taxClassMap.get(taxClass)!.packagingLiters += volume;
          taxClassMap.get(taxClass)!.lossesLiters += loss; // Bottling loss
        }
      }

      // Get racking losses during period
      const rackingOps = await db
        .select({
          batchId: batchRackingOperations.batchId,
          volumeLoss: batchRackingOperations.volumeLoss,
          productType: batches.productType,
        })
        .from(batchRackingOperations)
        .leftJoin(batches, eq(batchRackingOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchRackingOperations.deletedAt),
            gte(batchRackingOperations.rackedAt, start),
            lte(batchRackingOperations.rackedAt, end)
          )
        );

      for (const r of rackingOps) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, r.batchId, r.productType) || "other";
        const loss = parseFloat(r.volumeLoss || "0");
        if (taxClassMap.has(taxClass)) {
          taxClassMap.get(taxClass)!.lossesLiters += loss;
        }
      }

      // Get filter losses during period
      const filterOps = await db
        .select({
          batchId: batchFilterOperations.batchId,
          volumeLoss: batchFilterOperations.volumeLoss,
          productType: batches.productType,
        })
        .from(batchFilterOperations)
        .leftJoin(batches, eq(batchFilterOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchFilterOperations.deletedAt),
            gte(batchFilterOperations.filteredAt, start),
            lte(batchFilterOperations.filteredAt, end)
          )
        );

      for (const f of filterOps) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, f.batchId, f.productType) || "other";
        const loss = parseFloat(f.volumeLoss || "0");
        if (taxClassMap.has(taxClass)) {
          taxClassMap.get(taxClass)!.lossesLiters += loss;
        }
      }

      // Get volume adjustments (negative = loss) during period
      const volumeAdjs = await db
        .select({
          batchId: batchVolumeAdjustments.batchId,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
          productType: batches.productType,
        })
        .from(batchVolumeAdjustments)
        .leftJoin(batches, eq(batchVolumeAdjustments.batchId, batches.id))
        .where(
          and(
            isNull(batchVolumeAdjustments.deletedAt),
            gte(batchVolumeAdjustments.adjustmentDate, start),
            lte(batchVolumeAdjustments.adjustmentDate, end),
            sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) < 0` // Only losses
          )
        );

      for (const v of volumeAdjs) {
        const taxClass = getTaxClassFromMap(batchTaxClassMap, v.batchId, v.productType) || "other";
        const loss = Math.abs(parseFloat(v.adjustmentAmount || "0"));
        if (taxClassMap.has(taxClass)) {
          taxClassMap.get(taxClass)!.lossesLiters += loss;
        }
      }

      // Convert map to array and calculate reconciliation
      const result = Array.from(taxClassMap.values()).map((data) => ({
        ...data,
        calculatedEnding:
          data.openingLiters +
          data.productionLiters +
          data.transfersInLiters -
          data.transfersOutLiters -
          data.packagingLiters -
          data.lossesLiters,
        variance: data.endingLiters - (
          data.openingLiters +
          data.productionLiters +
          data.transfersInLiters -
          data.transfersOutLiters -
          data.packagingLiters -
          data.lossesLiters
        ),
      }));

      return {
        periodStart: startDate,
        periodEnd: endDate,
        taxClasses: result.filter((tc) => tc.batches.length > 0),
        summary: {
          totalOpeningLiters: result.reduce((sum, tc) => sum + tc.openingLiters, 0),
          totalProductionLiters: result.reduce((sum, tc) => sum + tc.productionLiters, 0),
          totalPackagingLiters: result.reduce((sum, tc) => sum + tc.packagingLiters, 0),
          totalLossesLiters: result.reduce((sum, tc) => sum + tc.lossesLiters, 0),
          totalEndingLiters: result.reduce((sum, tc) => sum + tc.endingLiters, 0),
        },
      };
    }),

  /**
   * Get disposition summary - where each batch ended up.
   * Shows: In Vessel, Packaged, Lost, Transferred Out
   */
  getBatchDispositionSummary: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid().optional(),
        endDate: z.string(), // ISO date string - "as of" date
      })
    )
    .query(async ({ input }) => {
      const { endDate } = input;
      const asOfDate = new Date(endDate);

      type BatchDisposition = {
        id: string;
        name: string;
        productType: string;
        startDate: Date;
        initialVolumeLiters: number;
        disposition: {
          inVesselLiters: number;
          vesselName: string | null;
          packagedLiters: number;
          lostLiters: number;
          transferredOutLiters: number;
        };
        percentagePackaged: number;
        percentageLost: number;
      };

      // Get all batches
      const allBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          productType: batches.productType,
          startDate: batches.startDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          vesselName: vessels.name,
          status: batches.status,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            eq(batches.isArchived, false),
            isNull(batches.deletedAt),
            eq(batches.reconciliationStatus, "verified"),
            lte(batches.startDate, asOfDate)
          )
        );

      const dispositions: BatchDisposition[] = [];

      for (const batch of allBatches) {
        const initialVolume = parseFloat(batch.initialVolumeLiters || "0");
        const currentVolume = parseFloat(batch.currentVolumeLiters || "0");

        // Get total packaged volume
        const [packagingResult] = await db
          .select({
            totalLiters: sql<string>`COALESCE(SUM(${bottleRuns.volumeTakenLiters}), 0)`,
          })
          .from(bottleRuns)
          .where(
            and(
              eq(bottleRuns.batchId, batch.id),
              lte(bottleRuns.packagedAt, asOfDate)
            )
          );

        const packagedLiters = parseFloat(packagingResult?.totalLiters || "0");

        // Get total transferred out (where this batch was source)
        const [transferResult] = await db
          .select({
            totalLiters: sql<string>`COALESCE(SUM(${batchTransfers.volumeTransferred}), 0)`,
            totalLoss: sql<string>`COALESCE(SUM(${batchTransfers.loss}), 0)`,
          })
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.sourceBatchId, batch.id),
              lte(batchTransfers.transferredAt, asOfDate)
            )
          );

        const transferredOutLiters = parseFloat(transferResult?.totalLiters || "0");
        const transferLossLiters = parseFloat(transferResult?.totalLoss || "0");

        // Get other losses (racking, filtering)
        const [rackingLoss] = await db
          .select({
            totalLoss: sql<string>`COALESCE(SUM(${batchRackingOperations.volumeLoss}), 0)`,
          })
          .from(batchRackingOperations)
          .where(
            and(
              eq(batchRackingOperations.batchId, batch.id),
              lte(batchRackingOperations.rackedAt, asOfDate)
            )
          );

        const [filterLoss] = await db
          .select({
            totalLoss: sql<string>`COALESCE(SUM(${batchFilterOperations.volumeLoss}), 0)`,
          })
          .from(batchFilterOperations)
          .where(
            and(
              eq(batchFilterOperations.batchId, batch.id),
              lte(batchFilterOperations.filteredAt, asOfDate)
            )
          );

        const rackingLossLiters = parseFloat(rackingLoss?.totalLoss || "0");
        const filterLossLiters = parseFloat(filterLoss?.totalLoss || "0");
        const totalLostLiters = transferLossLiters + rackingLossLiters + filterLossLiters;

        // Calculate variance (unaccounted)
        const accountedFor = currentVolume + packagedLiters + transferredOutLiters + totalLostLiters;
        const variance = initialVolume - accountedFor;
        const adjustedLoss = totalLostLiters + (variance > 0 ? variance : 0);

        dispositions.push({
          id: batch.id,
          name: batch.name,
          productType: batch.productType,
          startDate: batch.startDate,
          initialVolumeLiters: initialVolume,
          disposition: {
            inVesselLiters: currentVolume,
            vesselName: batch.vesselName,
            packagedLiters,
            lostLiters: adjustedLoss,
            transferredOutLiters,
          },
          percentagePackaged: initialVolume > 0 ? (packagedLiters / initialVolume) * 100 : 0,
          percentageLost: initialVolume > 0 ? (adjustedLoss / initialVolume) * 100 : 0,
        });
      }

      // Group by product type for summary
      const byProductType = dispositions.reduce(
        (acc, d) => {
          if (!acc[d.productType]) {
            acc[d.productType] = {
              inVesselLiters: 0,
              packagedLiters: 0,
              lostLiters: 0,
              transferredOutLiters: 0,
              batchCount: 0,
            };
          }
          acc[d.productType].inVesselLiters += d.disposition.inVesselLiters;
          acc[d.productType].packagedLiters += d.disposition.packagedLiters;
          acc[d.productType].lostLiters += d.disposition.lostLiters;
          acc[d.productType].transferredOutLiters += d.disposition.transferredOutLiters;
          acc[d.productType].batchCount += 1;
          return acc;
        },
        {} as Record<string, { inVesselLiters: number; packagedLiters: number; lostLiters: number; transferredOutLiters: number; batchCount: number }>
      );

      return {
        asOfDate: endDate,
        batches: dispositions,
        byProductType,
        summary: {
          totalBatches: dispositions.length,
          totalInVesselLiters: dispositions.reduce((sum, d) => sum + d.disposition.inVesselLiters, 0),
          totalPackagedLiters: dispositions.reduce((sum, d) => sum + d.disposition.packagedLiters, 0),
          totalLostLiters: dispositions.reduce((sum, d) => sum + d.disposition.lostLiters, 0),
          totalTransferredOutLiters: dispositions.reduce((sum, d) => sum + d.disposition.transferredOutLiters, 0),
        },
      };
    }),

  // ============================================
  // PHYSICAL INVENTORY ENDPOINTS
  // ============================================

  /**
   * Get vessels with their book inventory for physical counting.
   */
  getVesselsForPhysicalCount: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid().optional(),
        includeEmpty: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const { includeEmpty } = input;

      // Get all vessels with their current batch volumes
      const vesselsWithBatches = await db
        .select({
          vesselId: vessels.id,
          vesselName: vessels.name,
          vesselCapacity: vessels.capacity,
          vesselMaterial: vessels.material,
          batchId: batches.id,
          batchName: batches.name,
          batchProductType: batches.productType,
          batchCurrentVolumeLiters: batches.currentVolumeLiters,
        })
        .from(vessels)
        .leftJoin(
          batches,
          and(
            eq(batches.vesselId, vessels.id),
            eq(batches.isArchived, false),
            isNull(batches.deletedAt)
          )
        )
        .where(isNull(vessels.deletedAt))
        .orderBy(asc(vessels.name));

      // Group by vessel and calculate total book volume
      const vesselMap = new Map<
        string,
        {
          vesselId: string;
          vesselName: string;
          vesselCapacity: number | null;
          vesselMaterial: string | null;
          bookVolumeLiters: number;
          batches: Array<{
            id: string;
            name: string;
            productType: string;
            volumeLiters: number;
          }>;
        }
      >();

      for (const row of vesselsWithBatches) {
        if (!vesselMap.has(row.vesselId)) {
          vesselMap.set(row.vesselId, {
            vesselId: row.vesselId,
            vesselName: row.vesselName || "Unknown",
            vesselCapacity: row.vesselCapacity ? parseFloat(String(row.vesselCapacity)) : null,
            vesselMaterial: row.vesselMaterial,
            bookVolumeLiters: 0,
            batches: [],
          });
        }

        if (row.batchId) {
          const vessel = vesselMap.get(row.vesselId)!;
          const volumeLiters = parseFloat(row.batchCurrentVolumeLiters || "0");
          vessel.bookVolumeLiters += volumeLiters;
          vessel.batches.push({
            id: row.batchId,
            name: row.batchName || "Unknown",
            productType: row.batchProductType || "cider",
            volumeLiters,
          });
        }
      }

      // Convert to array and optionally filter empty vessels
      let result = Array.from(vesselMap.values());
      if (!includeEmpty) {
        result = result.filter((v) => v.bookVolumeLiters > 0);
      }

      return {
        vessels: result,
        summary: {
          totalVessels: result.length,
          totalBookVolumeLiters: result.reduce((sum, v) => sum + v.bookVolumeLiters, 0),
          vesselsWithInventory: result.filter((v) => v.bookVolumeLiters > 0).length,
        },
      };
    }),

  /**
   * Save a physical inventory count for a vessel.
   */
  savePhysicalInventoryCount: adminProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
        vesselId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        physicalVolumeLiters: z.number().min(0),
        measurementMethod: z.enum(["dipstick", "sight_glass", "flowmeter", "estimated", "weighed"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        reconciliationSnapshotId,
        vesselId,
        batchId,
        physicalVolumeLiters,
        measurementMethod,
        notes,
      } = input;

      // Get book volume for the vessel
      const vesselBatches = await db
        .select({
          batchId: batches.id,
          volumeLiters: batches.currentVolumeLiters,
        })
        .from(batches)
        .where(
          and(
            eq(batches.vesselId, vesselId),
            eq(batches.isArchived, false),
            isNull(batches.deletedAt)
          )
        );

      const bookVolumeLiters = vesselBatches.reduce(
        (sum, b) => sum + parseFloat(b.volumeLiters || "0"),
        0
      );

      // Calculate variance
      const varianceLiters = physicalVolumeLiters - bookVolumeLiters;
      const variancePercentage = bookVolumeLiters > 0
        ? (varianceLiters / bookVolumeLiters) * 100
        : 0;

      // Check if a count already exists for this vessel/reconciliation
      const [existingCount] = await db
        .select()
        .from(physicalInventoryCounts)
        .where(
          and(
            eq(physicalInventoryCounts.reconciliationSnapshotId, reconciliationSnapshotId),
            eq(physicalInventoryCounts.vesselId, vesselId)
          )
        );

      let result;
      if (existingCount) {
        // Update existing count
        [result] = await db
          .update(physicalInventoryCounts)
          .set({
            batchId: batchId || (vesselBatches.length === 1 ? vesselBatches[0].batchId : null),
            bookVolumeLiters: String(bookVolumeLiters),
            physicalVolumeLiters: String(physicalVolumeLiters),
            varianceLiters: String(varianceLiters),
            variancePercentage: String(variancePercentage),
            countedAt: new Date(),
            countedBy: ctx.session.user.id,
            measurementMethod: measurementMethod || null,
            notes,
            updatedAt: new Date(),
          })
          .where(eq(physicalInventoryCounts.id, existingCount.id))
          .returning();
      } else {
        // Create new count
        [result] = await db
          .insert(physicalInventoryCounts)
          .values({
            reconciliationSnapshotId,
            vesselId,
            batchId: batchId || (vesselBatches.length === 1 ? vesselBatches[0].batchId : null),
            bookVolumeLiters: String(bookVolumeLiters),
            physicalVolumeLiters: String(physicalVolumeLiters),
            varianceLiters: String(varianceLiters),
            variancePercentage: String(variancePercentage),
            countedAt: new Date(),
            countedBy: ctx.session.user.id,
            measurementMethod: measurementMethod || null,
            notes,
          })
          .returning();
      }

      return {
        count: result,
        bookVolumeLiters,
        varianceLiters,
        variancePercentage,
      };
    }),

  /**
   * Get summary of all physical inventory counts for a reconciliation.
   */
  getPhysicalInventorySummary: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const { reconciliationSnapshotId } = input;

      const counts = await db
        .select({
          id: physicalInventoryCounts.id,
          vesselId: physicalInventoryCounts.vesselId,
          vesselName: vessels.name,
          batchId: physicalInventoryCounts.batchId,
          batchName: batches.name,
          bookVolumeLiters: physicalInventoryCounts.bookVolumeLiters,
          physicalVolumeLiters: physicalInventoryCounts.physicalVolumeLiters,
          varianceLiters: physicalInventoryCounts.varianceLiters,
          variancePercentage: physicalInventoryCounts.variancePercentage,
          countedAt: physicalInventoryCounts.countedAt,
          measurementMethod: physicalInventoryCounts.measurementMethod,
          notes: physicalInventoryCounts.notes,
        })
        .from(physicalInventoryCounts)
        .leftJoin(vessels, eq(physicalInventoryCounts.vesselId, vessels.id))
        .leftJoin(batches, eq(physicalInventoryCounts.batchId, batches.id))
        .where(eq(physicalInventoryCounts.reconciliationSnapshotId, reconciliationSnapshotId))
        .orderBy(asc(vessels.name));

      const totalBookLiters = counts.reduce(
        (sum, c) => sum + parseFloat(c.bookVolumeLiters || "0"),
        0
      );
      const totalPhysicalLiters = counts.reduce(
        (sum, c) => sum + parseFloat(c.physicalVolumeLiters || "0"),
        0
      );
      const totalVarianceLiters = totalPhysicalLiters - totalBookLiters;

      // Find counts with significant variance (> 2%)
      const significantVariances = counts.filter(
        (c) => Math.abs(parseFloat(c.variancePercentage || "0")) > 2
      );

      return {
        counts: counts.map((c) => ({
          ...c,
          bookVolumeLiters: parseFloat(c.bookVolumeLiters || "0"),
          physicalVolumeLiters: parseFloat(c.physicalVolumeLiters || "0"),
          varianceLiters: parseFloat(c.varianceLiters || "0"),
          variancePercentage: parseFloat(c.variancePercentage || "0"),
        })),
        summary: {
          totalCounts: counts.length,
          totalBookLiters,
          totalPhysicalLiters,
          totalVarianceLiters,
          overallVariancePercentage: totalBookLiters > 0
            ? (totalVarianceLiters / totalBookLiters) * 100
            : 0,
          significantVarianceCount: significantVariances.length,
        },
      };
    }),

  // ============================================
  // RECONCILIATION ADJUSTMENT ENDPOINTS
  // ============================================

  /**
   * Create a reconciliation adjustment with reason code.
   */
  createReconciliationAdjustment: adminProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        vesselId: z.string().uuid().optional(),
        physicalCountId: z.string().uuid().optional(),
        adjustmentType: z.enum([
          "evaporation",
          "measurement_error",
          "sampling",
          "contamination",
          "spillage",
          "theft",
          "sediment",
          "correction_up",
          "correction_down",
          "other",
        ]),
        volumeBeforeLiters: z.number(),
        volumeAfterLiters: z.number(),
        reason: z.string().min(1),
        notes: z.string().optional(),
        applyToBatch: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        reconciliationSnapshotId,
        batchId,
        vesselId,
        physicalCountId,
        adjustmentType,
        volumeBeforeLiters,
        volumeAfterLiters,
        reason,
        notes,
        applyToBatch,
      } = input;

      const adjustmentLiters = volumeAfterLiters - volumeBeforeLiters;
      let batchVolumeAdjustmentId: string | null = null;
      let appliedToBatchId: string | null = null;

      // If applying to batch, create a batch_volume_adjustment
      if (applyToBatch && batchId) {
        // Get current batch volume
        const [batch] = await db
          .select({
            currentVolumeLiters: batches.currentVolumeLiters,
          })
          .from(batches)
          .where(eq(batches.id, batchId));

        if (batch) {
          const currentVolume = parseFloat(batch.currentVolumeLiters || "0");
          const newVolume = currentVolume + adjustmentLiters;

          // Create batch volume adjustment
          const [batchAdj] = await db
            .insert(batchVolumeAdjustments)
            .values({
              batchId,
              adjustmentDate: new Date(),
              adjustmentType: adjustmentType as "evaporation" | "measurement_error" | "sampling" | "contamination" | "spillage" | "theft" | "correction_up" | "correction_down",
              volumeBefore: String(currentVolume),
              volumeAfter: String(Math.max(0, newVolume)),
              adjustmentAmount: String(adjustmentLiters),
              reason: `Reconciliation adjustment: ${reason}`,
              notes: `Adjustment type: ${adjustmentType}. ${notes || ""}`,
              reconciliationSnapshotId,
              adjustedBy: ctx.session.user.id,
            })
            .returning();

          batchVolumeAdjustmentId = batchAdj.id;
          appliedToBatchId = batchId;

          // Update batch current volume
          await db
            .update(batches)
            .set({
              currentVolumeLiters: String(Math.max(0, newVolume)),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, batchId));
        }
      }

      // Create reconciliation adjustment
      const [result] = await db
        .insert(reconciliationAdjustments)
        .values({
          reconciliationSnapshotId,
          batchId,
          vesselId,
          physicalCountId,
          adjustmentType,
          volumeBeforeLiters: String(volumeBeforeLiters),
          volumeAfterLiters: String(volumeAfterLiters),
          adjustmentLiters: String(adjustmentLiters),
          reason,
          notes,
          appliedToBatchId,
          batchVolumeAdjustmentId,
          adjustedBy: ctx.session.user.id,
          adjustedAt: new Date(),
        })
        .returning();

      return {
        adjustment: result,
        appliedToBatch: applyToBatch && batchId,
        batchVolumeAdjustmentId,
      };
    }),

  /**
   * Get all reconciliation adjustments for a snapshot.
   */
  getReconciliationAdjustments: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const { reconciliationSnapshotId } = input;

      const adjustments = await db
        .select({
          id: reconciliationAdjustments.id,
          batchId: reconciliationAdjustments.batchId,
          batchName: batches.name,
          vesselId: reconciliationAdjustments.vesselId,
          vesselName: vessels.name,
          adjustmentType: reconciliationAdjustments.adjustmentType,
          volumeBeforeLiters: reconciliationAdjustments.volumeBeforeLiters,
          volumeAfterLiters: reconciliationAdjustments.volumeAfterLiters,
          adjustmentLiters: reconciliationAdjustments.adjustmentLiters,
          reason: reconciliationAdjustments.reason,
          notes: reconciliationAdjustments.notes,
          appliedToBatchId: reconciliationAdjustments.appliedToBatchId,
          adjustedAt: reconciliationAdjustments.adjustedAt,
          adjustedByName: users.name,
        })
        .from(reconciliationAdjustments)
        .leftJoin(batches, eq(reconciliationAdjustments.batchId, batches.id))
        .leftJoin(vessels, eq(reconciliationAdjustments.vesselId, vessels.id))
        .leftJoin(users, eq(reconciliationAdjustments.adjustedBy, users.id))
        .where(eq(reconciliationAdjustments.reconciliationSnapshotId, reconciliationSnapshotId))
        .orderBy(desc(reconciliationAdjustments.adjustedAt));

      const totalAdjustmentLiters = adjustments.reduce(
        (sum, a) => sum + parseFloat(a.adjustmentLiters || "0"),
        0
      );

      // Group by adjustment type
      const byType = adjustments.reduce(
        (acc, a) => {
          if (!acc[a.adjustmentType]) {
            acc[a.adjustmentType] = { count: 0, totalLiters: 0 };
          }
          acc[a.adjustmentType].count += 1;
          acc[a.adjustmentType].totalLiters += parseFloat(a.adjustmentLiters || "0");
          return acc;
        },
        {} as Record<string, { count: number; totalLiters: number }>
      );

      return {
        adjustments: adjustments.map((a) => ({
          ...a,
          volumeBeforeLiters: parseFloat(a.volumeBeforeLiters || "0"),
          volumeAfterLiters: parseFloat(a.volumeAfterLiters || "0"),
          adjustmentLiters: parseFloat(a.adjustmentLiters || "0"),
        })),
        summary: {
          totalAdjustments: adjustments.length,
          totalAdjustmentLiters,
          appliedToBatchCount: adjustments.filter((a) => a.appliedToBatchId).length,
          byType,
        },
      };
    }),

  // ============================================================
  // Reconciliation Safeguards
  // ============================================================

  /** Lock a reconciliation year — prevents accidental edits to batches in that year */
  lockReconciliationYear: adminProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100) }))
    .mutation(async ({ input }) => {
      const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
      const settings = await db.select().from(organizationSettings)
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID)).limit(1);
      const current: number[] = (settings[0]?.reconciliationLockedYears as number[]) || [];
      if (current.includes(input.year)) {
        return { locked: true, years: current };
      }
      const updated = [...current, input.year].sort();
      await db.update(organizationSettings)
        .set({ reconciliationLockedYears: updated, updatedAt: new Date() })
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID));
      return { locked: true, years: updated };
    }),

  /** Unlock a reconciliation year — allows edits again */
  unlockReconciliationYear: adminProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100) }))
    .mutation(async ({ input }) => {
      const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
      const settings = await db.select().from(organizationSettings)
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID)).limit(1);
      const current: number[] = (settings[0]?.reconciliationLockedYears as number[]) || [];
      const updated = current.filter(y => y !== input.year);
      await db.update(organizationSettings)
        .set({ reconciliationLockedYears: updated, updatedAt: new Date() })
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID));
      return { locked: false, years: updated };
    }),

  /** Get volume audit trail for a specific batch */
  getBatchVolumeAudit: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db.execute(sql`
        SELECT id, batch_id, field_name, old_value, new_value, changed_at, change_source
        FROM batch_volume_audit
        WHERE batch_id = ${input.batchId}
        ORDER BY changed_at DESC
        LIMIT 100
      `);
      return rows.rows.map((r: any) => ({
        id: r.id,
        batchId: r.batch_id,
        fieldName: r.field_name,
        oldValue: r.old_value,
        newValue: r.new_value,
        changedAt: r.changed_at,
        changeSource: r.change_source,
      }));
    }),

  // ============================================
  // WATERFALL ADJUSTMENTS
  // ============================================

  /**
   * List waterfall adjustments for a period year
   */
  listWaterfallAdjustments: protectedProcedure
    .input(z.object({ periodYear: z.number().int() }))
    .query(async ({ input }) => {
      return db
        .select({
          id: ttbWaterfallAdjustments.id,
          periodYear: ttbWaterfallAdjustments.periodYear,
          waterfallLine: ttbWaterfallAdjustments.waterfallLine,
          amountGallons: ttbWaterfallAdjustments.amountGallons,
          reason: ttbWaterfallAdjustments.reason,
          notes: ttbWaterfallAdjustments.notes,
          adjustedBy: ttbWaterfallAdjustments.adjustedBy,
          adjustedAt: ttbWaterfallAdjustments.adjustedAt,
        })
        .from(ttbWaterfallAdjustments)
        .where(
          and(
            eq(ttbWaterfallAdjustments.periodYear, input.periodYear),
            isNull(ttbWaterfallAdjustments.deletedAt),
          ),
        )
        .orderBy(asc(ttbWaterfallAdjustments.adjustedAt));
    }),

  /**
   * Create a waterfall adjustment
   */
  createWaterfallAdjustment: protectedProcedure
    .input(
      z.object({
        periodYear: z.number().int(),
        waterfallLine: z.enum(["opening", "production", "losses", "distillation", "other"]),
        amountGallons: z.number(),
        reason: z.string().min(1),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [adjustment] = await db
        .insert(ttbWaterfallAdjustments)
        .values({
          periodYear: input.periodYear,
          waterfallLine: input.waterfallLine,
          amountGallons: input.amountGallons.toString(),
          reason: input.reason,
          notes: input.notes,
          adjustedBy: ctx.session?.user?.id,
        })
        .returning();
      return adjustment;
    }),

  /**
   * Delete (soft) a waterfall adjustment
   */
  deleteWaterfallAdjustment: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .update(ttbWaterfallAdjustments)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(ttbWaterfallAdjustments.id, input.id),
            isNull(ttbWaterfallAdjustments.deletedAt),
          ),
        )
        .returning();
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Waterfall adjustment not found",
        });
      }
      return deleted;
    }),
});
