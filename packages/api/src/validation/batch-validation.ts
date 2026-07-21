import { db } from "db";
import { batchCarbonationOperations } from "db/src/schema/carbonation";
import { and, isNull, inArray } from "drizzle-orm";
import {
  computeBatchVolumeFromHistory,
  type BatchVolumeResult,
} from "lib";
import { fetchBatchVolumeEvents } from "../services/batch-volume-events";

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
// Volume events come from the shared fetcher (services/batch-volume-events.ts)
// feeding THE authoritative reducer in lib — the same pair every recon engine
// uses (Phase 1, reconciliation plan §3). Only carbonation rows (classification
// check, not volume) are fetched here.

interface CarbonationRow {
  batchId: string;
  finalCo2Volumes: string | null;
  carbonationProcess: string | null;
}

async function fetchCarbonationsByBatch(
  batchIds: string[],
): Promise<Map<string, CarbonationRow[]>> {
  const map = new Map<string, CarbonationRow[]>();
  if (batchIds.length === 0) return map;
  const rows = await db
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
    );
  for (const row of rows) {
    const arr = map.get(row.batchId);
    if (arr) arr.push(row);
    else map.set(row.batchId, [row]);
  }
  return map;
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
  volume: BatchVolumeResult,
): ValidationCheck {
  const current = num(batch.currentVolumeLiters);
  const expectedCurrent = volume.volumeL;

  const discrepancy = current - expectedCurrent;
  const absDiscrepancy = Math.abs(discrepancy);

  // Threshold: 5% of total inflow or 2L, whichever is larger
  const baseVolume = Math.max(
    volume.breakdown.initialL + volume.breakdown.mergesInL,
    volume.breakdown.transfersInL,
  );
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

/**
 * Surfaces the reducer's §2.3 split-of-truth signal (initial volume AND
 * same-day press-run/juice merges both present). Only escalates to a warning
 * when the volume balance ALSO fails — if the batch balances, the overlap
 * pattern did not double-count and is informational.
 */
function checkInitialMergeOverlap(
  batch: BatchForValidation,
  volume: BatchVolumeResult,
  volumeBalanceStatus: "pass" | "warning" | "fail",
): ValidationCheck {
  const overlap = volume.warnings.find((w) => w.code === "initial_merge_overlap");
  if (!overlap) {
    return { id: "initial_merge_overlap", status: "pass", message: "No initial/merge overlap" };
  }
  if (volumeBalanceStatus === "pass") {
    return {
      id: "initial_merge_overlap",
      status: "pass",
      message: "Initial/merge overlap pattern present but volumes balance",
      details: overlap.message,
    };
  }
  return {
    id: "initial_merge_overlap",
    status: "warning",
    message: "Possible double-count: initial volume vs merge history",
    details: overlap.message,
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
  volume: BatchVolumeResult,
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
      volume.breakdown.transfersOutL +
      volume.breakdown.bottlingL +
      volume.breakdown.keggingL +
      volume.breakdown.distillationL;

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
  const [volumeInputs, carbonationsByBatch] = await Promise.all([
    fetchBatchVolumeEvents(batchIds),
    fetchCarbonationsByBatch(batchIds),
  ]);
  const results = new Map<string, BatchValidation>();

  for (const batch of batchList) {
    const inputs = volumeInputs.get(batch.id) ?? {
      initialVolumeL: 0,
      transferCreated: false,
      startDate: null,
      events: [],
    };
    const volume = computeBatchVolumeFromHistory(inputs); // all-time = expected current
    const carbonations = carbonationsByBatch.get(batch.id) || [];

    const volumeBalance = checkVolumeBalance(batch, volume);
    const checks: ValidationCheck[] = [
      checkRequiredFields(batch),
      volumeBalance,
      checkInitialMergeOverlap(batch, volume, volumeBalance.status),
      checkClassificationData(batch, carbonations),
      checkActiveVolume(batch, volume),
      checkDateSanity(batch, year),
    ];

    results.set(batch.id, {
      status: overallStatus(checks),
      checks,
    });
  }

  return results;
}
