import {
  db,
  batches,
  batchTransfers,
  batchFilterOperations,
  batchRackingOperations,
  batchVolumeAdjustments,
  batchMergeHistory,
} from "db";
import { bottleRuns, kegFills } from "db/src/schema/packaging";
import { batchCarbonationOperations } from "db/src/schema/carbonation";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationCheck {
  id: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: string;
  link?: string;
}

export interface BatchValidation {
  status: "pass" | "warning" | "fail";
  checks: ValidationCheck[];
}

/** Minimal batch shape needed by the validation checks. */
export interface BatchForValidation {
  id: string;
  productType: string | null;
  startDate: Date | null;
  initialVolumeLiters: string | null;
  currentVolumeLiters: string | null;
  parentBatchId: string | null;
  vesselId: string | null;
  actualAbv: string | null;
  estimatedAbv: string | null;
}

// ---------------------------------------------------------------------------
// Bulk data fetching
// ---------------------------------------------------------------------------

interface TransferOut {
  sourceBatchId: string;
  volumeTransferred: string | null;
  loss: string | null;
}

interface TransferIn {
  destinationBatchId: string;
  volumeTransferred: string | null;
}

interface BottleRunRow {
  batchId: string;
  volumeTakenLiters: string | null;
  loss: string | null;
  unitsProduced: number | null;
  packageSizeML: number | null;
}

interface KegFillRow {
  batchId: string;
  volumeTaken: string | null;
  loss: string | null;
}

interface AdjustmentRow {
  batchId: string;
  adjustmentAmount: string | null;
}

interface RackingRow {
  batchId: string;
  volumeLoss: string | null;
  notes: string | null;
}

interface FilterRow {
  batchId: string;
  volumeLoss: string | null;
}

interface CarbonationRow {
  batchId: string;
  finalCo2Volumes: string | null;
  carbonationProcess: string | null;
}

interface MergeHistoryRow {
  targetBatchId: string;
  volumeAdded: string | null;
  volumeAddedUnit: string | null;
}

interface DistillationRow {
  source_batch_id: string;
  source_volume_liters: string | null;
}

function groupBy<T>(rows: T[], keyFn: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const arr = map.get(key);
    if (arr) {
      arr.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}

async function fetchBulkVolumeData(batchIds: string[]) {
  if (batchIds.length === 0) {
    return {
      transfersOutByBatch: new Map<string, TransferOut[]>(),
      transfersInByBatch: new Map<string, TransferIn[]>(),
      mergeHistoryByBatch: new Map<string, MergeHistoryRow[]>(),
      bottleRunsByBatch: new Map<string, BottleRunRow[]>(),
      kegFillsByBatch: new Map<string, KegFillRow[]>(),
      adjustmentsByBatch: new Map<string, AdjustmentRow[]>(),
      rackingsByBatch: new Map<string, RackingRow[]>(),
      filtersByBatch: new Map<string, FilterRow[]>(),
      carbonationsByBatch: new Map<string, CarbonationRow[]>(),
      distillationsByBatch: new Map<string, DistillationRow[]>(),
    };
  }

  const [
    transfersOut,
    transfersIn,
    mergeHistory,
    bottles,
    kegs_,
    adjustments,
    rackings,
    filters,
    carbonations,
    distillations,
  ] = await Promise.all([
    // 1. Transfers out (source = our batch, destination ≠ source)
    db
      .select({
        sourceBatchId: batchTransfers.sourceBatchId,
        volumeTransferred: batchTransfers.volumeTransferred,
        loss: batchTransfers.loss,
      })
      .from(batchTransfers)
      .where(
        and(
          inArray(batchTransfers.sourceBatchId, batchIds),
          sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
          isNull(batchTransfers.deletedAt),
        ),
      ),

    // 2. Transfers in (destination = our batch, source ≠ destination)
    db
      .select({
        destinationBatchId: batchTransfers.destinationBatchId,
        volumeTransferred: batchTransfers.volumeTransferred,
      })
      .from(batchTransfers)
      .where(
        and(
          inArray(batchTransfers.destinationBatchId, batchIds),
          sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
          isNull(batchTransfers.deletedAt),
        ),
      ),

    // 2b. Merge history (juice added from press runs, juice purchases, batch transfers post-creation)
    db
      .select({
        targetBatchId: batchMergeHistory.targetBatchId,
        volumeAdded: batchMergeHistory.volumeAdded,
        volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
      })
      .from(batchMergeHistory)
      .where(
        and(
          inArray(batchMergeHistory.targetBatchId, batchIds),
          isNull(batchMergeHistory.deletedAt),
        ),
      ),

    // 3. Bottle runs (non-voided) — volumeTakenLiters is trigger-maintained
    //    Need units/size to detect if loss is already included in volumeTaken (batch.ts:6694-6696)
    db
      .select({
        batchId: bottleRuns.batchId,
        volumeTakenLiters: bottleRuns.volumeTakenLiters,
        loss: bottleRuns.loss,
        unitsProduced: bottleRuns.unitsProduced,
        packageSizeML: bottleRuns.packageSizeML,
      })
      .from(bottleRuns)
      .where(
        and(
          inArray(bottleRuns.batchId, batchIds),
          isNull(bottleRuns.voidedAt),
        ),
      ),

    // 4. Keg fills (non-voided) — volumeTaken defaults to liters
    db
      .select({
        batchId: kegFills.batchId,
        volumeTaken: kegFills.volumeTaken,
        loss: kegFills.loss,
      })
      .from(kegFills)
      .where(
        and(
          inArray(kegFills.batchId, batchIds),
          isNull(kegFills.voidedAt),
          isNull(kegFills.deletedAt),
        ),
      ),

    // 5. Volume adjustments — adjustmentAmount is always in liters
    db
      .select({
        batchId: batchVolumeAdjustments.batchId,
        adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
      })
      .from(batchVolumeAdjustments)
      .where(
        and(
          inArray(batchVolumeAdjustments.batchId, batchIds),
          isNull(batchVolumeAdjustments.deletedAt),
        ),
      ),

    // 6. Racking losses (need notes to exclude "Historical Record")
    db
      .select({
        batchId: batchRackingOperations.batchId,
        volumeLoss: batchRackingOperations.volumeLoss,
        notes: batchRackingOperations.notes,
      })
      .from(batchRackingOperations)
      .where(
        and(
          inArray(batchRackingOperations.batchId, batchIds),
          isNull(batchRackingOperations.deletedAt),
        ),
      ),

    // 7. Filter losses
    db
      .select({
        batchId: batchFilterOperations.batchId,
        volumeLoss: batchFilterOperations.volumeLoss,
      })
      .from(batchFilterOperations)
      .where(
        and(
          inArray(batchFilterOperations.batchId, batchIds),
          isNull(batchFilterOperations.deletedAt),
        ),
      ),

    // 8. Carbonation operations (for classification check)
    db
      .select({
        batchId: batchCarbonationOperations.batchId,
        finalCo2Volumes: batchCarbonationOperations.finalCo2Volumes,
        carbonationProcess: batchCarbonationOperations.carbonationProcess,
      })
      .from(batchCarbonationOperations)
      .where(
        and(
          inArray(batchCarbonationOperations.batchId, batchIds),
          isNull(batchCarbonationOperations.deletedAt),
        ),
      ),

    // 9. Distillation records (sent or received — both mean cider left the cidery)
    db.execute(sql`
      SELECT source_batch_id, source_volume_liters
      FROM distillation_records
      WHERE source_batch_id IN (${sql.join(batchIds.map((id) => sql`${id}`), sql`, `)})
        AND deleted_at IS NULL
        AND status IN ('sent', 'received')
    `),
  ]);

  return {
    transfersOutByBatch: groupBy(transfersOut as TransferOut[], (r) => r.sourceBatchId),
    transfersInByBatch: groupBy(transfersIn as TransferIn[], (r) => r.destinationBatchId),
    mergeHistoryByBatch: groupBy(mergeHistory as MergeHistoryRow[], (r) => r.targetBatchId),
    bottleRunsByBatch: groupBy(bottles as BottleRunRow[], (r) => r.batchId),
    kegFillsByBatch: groupBy(kegs_ as KegFillRow[], (r) => r.batchId),
    adjustmentsByBatch: groupBy(adjustments as AdjustmentRow[], (r) => r.batchId),
    rackingsByBatch: groupBy(rackings as RackingRow[], (r) => r.batchId),
    filtersByBatch: groupBy(filters as FilterRow[], (r) => r.batchId),
    carbonationsByBatch: groupBy(carbonations as CarbonationRow[], (r) => r.batchId),
    distillationsByBatch: groupBy(
      ((distillations as any).rows ?? distillations) as unknown as DistillationRow[],
      (r) => r.source_batch_id,
    ),
  };
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function num(val: string | null | undefined): number {
  return parseFloat(val || "0") || 0;
}

function checkRequiredFields(batch: BatchForValidation): ValidationCheck {
  const issues: string[] = [];
  if (!batch.productType) issues.push("Product type not set");
  if (!batch.startDate) issues.push("Start date not set");
  if (!batch.parentBatchId && num(batch.initialVolumeLiters) <= 0) {
    issues.push("Initial volume is 0 for a root batch");
  }

  if (issues.length > 0) {
    return {
      id: "required_fields",
      status: "fail",
      message: "Missing required fields",
      details: issues.join("; "),
      link: `/batch/${batch.id}`,
    };
  }
  return { id: "required_fields", status: "pass", message: "All required fields set" };
}

function checkVolumeBalance(
  batch: BatchForValidation,
  data: ReturnType<typeof getBatchVolumeData>,
): ValidationCheck {
  const initial = num(batch.initialVolumeLiters);
  const current = num(batch.currentVolumeLiters);

  const transfersIn = data.transfersIn.reduce((s, t) => s + num(t.volumeTransferred), 0);
  const transfersOut = data.transfersOut.reduce((s, t) => s + num(t.volumeTransferred), 0);
  const transferLosses = data.transfersOut.reduce((s, t) => s + num(t.loss), 0);
  // Merge history: juice added post-creation from press runs, juice purchases, etc.
  // These volumes update currentVolumeLiters but NOT initialVolumeLiters.
  const mergeVolume = data.mergeHistory.reduce((s, m) => s + num(m.volumeAdded), 0);
  const bottling = data.bottleRuns.reduce((s, b) => s + num(b.volumeTakenLiters), 0);
  // Bottling loss: match getBatchVolumeTrace logic (batch.ts:6694-6696) —
  // if volumeTaken ≈ productVolume + loss (within 2L), loss is already in volumeTaken
  const bottlingLoss = data.bottleRuns.reduce((s, b) => {
    const volumeTaken = num(b.volumeTakenLiters);
    const lossValue = num(b.loss);
    const productVolume = ((b.unitsProduced || 0) * (b.packageSizeML || 0)) / 1000;
    const lossIncludedInVolumeTaken = Math.abs(volumeTaken - (productVolume + lossValue)) < 2;
    return s + (lossIncludedInVolumeTaken ? 0 : lossValue);
  }, 0);
  const kegging = data.kegFills.reduce((s, k) => s + num(k.volumeTaken), 0);
  const keggingLoss = data.kegFills.reduce((s, k) => s + num(k.loss), 0);
  const adjustments = data.adjustments.reduce((s, a) => s + num(a.adjustmentAmount), 0);
  const rackingLosses = data.rackings
    .filter((r) => !r.notes?.includes("Historical Record"))
    .reduce((s, r) => s + num(r.volumeLoss), 0);
  const filterLosses = data.filters.reduce((s, f) => s + num(f.volumeLoss), 0);
  const distillation = data.distillations.reduce((s, d) => s + num(d.source_volume_liters), 0);

  // Match getBatchVolumeTrace logic (batch.ts:6603-6607):
  // Transfer-created batches use 0 initial (volume comes from transfer-in)
  const isTransferCreated = batch.parentBatchId && transfersIn > 0;
  const effectiveInitial = isTransferCreated ? 0 : initial;

  // accountedVolume = initial + inflow (transfers + merges) - outflow - loss
  const expectedCurrent =
    effectiveInitial +
    transfersIn +
    mergeVolume -
    transfersOut -
    transferLosses -
    bottling -
    bottlingLoss -
    kegging -
    keggingLoss -
    distillation +
    adjustments - // adjustments can be positive (gain) or negative (loss)
    rackingLosses -
    filterLosses;

  const discrepancy = current - expectedCurrent;
  const absDiscrepancy = Math.abs(discrepancy);

  // Threshold: 5% of total inflow or 2L, whichever is larger
  const baseVolume = Math.max(effectiveInitial + mergeVolume, transfersIn);
  const threshold = Math.max(baseVolume * 0.05, 2.0);

  if (absDiscrepancy <= threshold) {
    return { id: "volume_balance", status: "pass", message: "Volume balanced within tolerance" };
  }

  const percentStr =
    baseVolume > 0 ? ` / ${((absDiscrepancy / baseVolume) * 100).toFixed(1)}%` : "";
  const details = `Expected ${expectedCurrent.toFixed(1)}L, actual ${current.toFixed(1)}L (${discrepancy > 0 ? "+" : ""}${discrepancy.toFixed(1)}L${percentStr})`;

  // Warning if above threshold, fail if above 2× threshold
  const status = absDiscrepancy > threshold * 2 ? "fail" : "warning";

  return {
    id: "volume_balance",
    status,
    message: "Volume discrepancy detected",
    details,
    link: `/batch/${batch.id}?tab=volume-trace`,
  };
}

function checkClassificationData(
  batch: BatchForValidation,
  carbonations: CarbonationRow[],
): ValidationCheck {
  const issues: string[] = [];
  const hasAbv = batch.actualAbv || batch.estimatedAbv;
  if (!hasAbv) {
    issues.push("No ABV recorded (needed for tax class)");
  }

  if (carbonations.length > 0) {
    const hasFinished = carbonations.some((c) => c.finalCo2Volumes);
    if (!hasFinished) {
      issues.push("Carbonation operations exist but no final CO2 volumes recorded");
    }
  }

  if (issues.length > 0) {
    return {
      id: "classification_data",
      status: "warning",
      message: "Missing classification data",
      details: issues.join("; "),
      link:
        carbonations.length > 0
          ? `/batch/${batch.id}?tab=carbonations`
          : `/batch/${batch.id}?tab=measurements`,
    };
  }
  return { id: "classification_data", status: "pass", message: "Classification data complete" };
}

function checkActiveVolume(
  batch: BatchForValidation,
  data: ReturnType<typeof getBatchVolumeData>,
): ValidationCheck {
  const current = num(batch.currentVolumeLiters);

  if (current > 0 && !batch.vesselId) {
    return {
      id: "active_volume",
      status: "warning",
      message: "Volume exists but no vessel assigned",
      details: `${current.toFixed(1)}L remaining with no vessel`,
      link: `/batch/${batch.id}`,
    };
  }

  if (current === 0 && num(batch.initialVolumeLiters) > 0) {
    const totalConsumed =
      data.transfersOut.reduce((s, t) => s + num(t.volumeTransferred), 0) +
      data.bottleRuns.reduce((s, b) => s + num(b.volumeTakenLiters), 0) +
      data.kegFills.reduce((s, k) => s + num(k.volumeTaken), 0) +
      data.distillations.reduce((s, d) => s + num(d.source_volume_liters), 0);

    if (totalConsumed === 0) {
      return {
        id: "active_volume",
        status: "warning",
        message: "Volume zeroed without tracked consumption",
        details: "Batch has 0L but no packaging, transfers, or distillation recorded",
        link: `/batch/${batch.id}?tab=volume-trace`,
      };
    }
  }

  return { id: "active_volume", status: "pass", message: "Volume state valid" };
}

function checkDateSanity(batch: BatchForValidation, year: number): ValidationCheck {
  if (!batch.startDate) {
    // Already caught by required_fields; pass here to avoid double-reporting
    return { id: "date_sanity", status: "pass", message: "Date check deferred to required fields" };
  }
  const batchYear = new Date(batch.startDate).getFullYear();
  if (batchYear > year) {
    // Future-dated batch is genuinely suspicious
    return {
      id: "date_sanity",
      status: "warning",
      message: "Start date is in a future year",
      details: `Batch started in ${batchYear}, viewing year ${year}`,
      link: `/batch/${batch.id}`,
    };
  }
  // Prior-year batches are normal carried-forward inventory — not a warning
  return { id: "date_sanity", status: "pass", message: batchYear < year ? "Carried forward from prior year" : "Date within year" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBatchVolumeData(
  batchId: string,
  bulkData: Awaited<ReturnType<typeof fetchBulkVolumeData>>,
) {
  return {
    transfersOut: bulkData.transfersOutByBatch.get(batchId) || [],
    transfersIn: bulkData.transfersInByBatch.get(batchId) || [],
    mergeHistory: bulkData.mergeHistoryByBatch.get(batchId) || [],
    bottleRuns: bulkData.bottleRunsByBatch.get(batchId) || [],
    kegFills: bulkData.kegFillsByBatch.get(batchId) || [],
    adjustments: bulkData.adjustmentsByBatch.get(batchId) || [],
    rackings: bulkData.rackingsByBatch.get(batchId) || [],
    filters: bulkData.filtersByBatch.get(batchId) || [],
    distillations: bulkData.distillationsByBatch.get(batchId) || [],
  };
}

function overallStatus(checks: ValidationCheck[]): "pass" | "warning" | "fail" {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warning")) return "warning";
  return "pass";
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function validateBatches(
  batchList: BatchForValidation[],
  year: number,
): Promise<Map<string, BatchValidation>> {
  const batchIds = batchList.map((b) => b.id);
  const bulkData = await fetchBulkVolumeData(batchIds);
  const results = new Map<string, BatchValidation>();

  for (const batch of batchList) {
    const volumeData = getBatchVolumeData(batch.id, bulkData);
    const carbonations = bulkData.carbonationsByBatch.get(batch.id) || [];

    const checks: ValidationCheck[] = [
      checkRequiredFields(batch),
      checkVolumeBalance(batch, volumeData),
      checkClassificationData(batch, carbonations),
      checkActiveVolume(batch, volumeData),
      checkDateSanity(batch, year),
    ];

    results.set(batch.id, {
      status: overallStatus(checks),
      checks,
    });
  }

  return results;
}
