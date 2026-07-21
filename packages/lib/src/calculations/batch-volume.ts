/**
 * THE authoritative batch volume-from-history reducer.
 *
 * Phase 1 of docs/reconciliation-robustness-plan.md: every engine that
 * reconstructs a batch's volume from its event history calls this ONE pure
 * function — per-batch validation (`checkVolumeBalance`), TTB SBD
 * reconstruction (`computeSystemCalculatedOnHand`), and the batch-derived
 * reconciliation (`computeReconciliationFromBatches`). Two formulas drifting
 * apart was the root problem this replaces.
 *
 * Design rules:
 * - Pure and client-safe: no DB access, no Date.now(); callers fetch and
 *   normalize events (packages/api/src/services/batch-volume-events.ts).
 * - All volumes are LITERS by the time they arrive here — the fetcher applies
 *   unit columns (`volume_added_unit`, `volume_taken_unit`, `loss_unit`, …)
 *   via `convertToLiters`.
 * - No heuristics: transfer-created is an explicit flag (`batches.
 *   transfer_created`, migration 0143), bottling loss-included is an explicit
 *   flag (`bottle_runs.loss_included_in_volume_taken`), historical-record
 *   racking rows are excluded by the fetcher via
 *   `batch_racking_operations.is_historical_record`.
 * - No clamping: a negative reconstruction is real signal and is returned
 *   as-is (matches the SBD stance; the old per-batch engine agreed).
 */

export type BatchVolumeEventType =
  | "transfer_in"
  | "transfer_out"
  | "merge_in"
  | "merge_out"
  | "bottle_run"
  | "keg_fill"
  | "distillation"
  | "adjustment"
  | "racking_loss"
  | "filter_loss";

export interface BatchVolumeEvent {
  type: BatchVolumeEventType;
  /**
   * Primary magnitude in liters, sign-free: always the volume the event
   * moved/removed/added. For `adjustment` this is the signed adjustment
   * amount (positive = gain, negative = loss) — the one signed case, matching
   * how `batch_volume_adjustments.adjustment_amount` is stored.
   */
  volumeL: number;
  /** Associated loss in liters (transfer_out, bottle_run, keg_fill). 0 otherwise. */
  lossL: number;
  /**
   * Event timestamp. `null` means "always included" regardless of asOfDate —
   * used for rows whose date column is NULL; documented so callers make that
   * choice deliberately.
   */
  at: Date | null;
  /**
   * bottle_run only: when true, `lossL` is already inside `volumeL`
   * (from `bottle_runs.loss_included_in_volume_taken`) and must not be
   * subtracted again.
   */
  lossIncludedInVolume?: boolean;
  /** merge_in only: 'press_run' | 'juice_purchase' | 'batch' | … (drives the overlap warning). */
  mergeSourceType?: string;
}

export interface BatchVolumeInputs {
  /** batches.initial_volume_liters, already a number. */
  initialVolumeL: number;
  /**
   * batches.transfer_created (migration 0143). True = the batch's volume
   * arrived via transfer_in events and `initialVolumeL` is a display artifact
   * that must NOT be counted. Replaces the old `transfersIn >= 90% × initial`
   * cliff.
   */
  transferCreated: boolean;
  /** batches.start_date — only used for the initial/merge overlap warning. */
  startDate: Date | null;
  events: BatchVolumeEvent[];
}

export interface BatchVolumeBreakdown {
  initialL: number;
  transfersInL: number;
  transfersOutL: number;
  transferLossL: number;
  mergesInL: number;
  mergesOutL: number;
  bottlingL: number;
  bottlingLossL: number;
  keggingL: number;
  keggingLossL: number;
  distillationL: number;
  adjustmentsPositiveL: number;
  adjustmentsNegativeL: number;
  rackingLossL: number;
  filterLossL: number;
}

export type BatchVolumeWarningCode = "initial_merge_overlap";

export interface BatchVolumeWarning {
  code: BatchVolumeWarningCode;
  /** Magnitude in liters that triggered the warning. */
  detailL: number;
  message: string;
}

export interface BatchVolumeResult {
  /** Expected volume from history, liters. NOT clamped — negatives are signal. */
  volumeL: number;
  breakdown: BatchVolumeBreakdown;
  warnings: BatchVolumeWarning[];
}

/**
 * Window (hours) around startDate within which press-run/juice-purchase merge
 * inflows are compared against initialVolumeL for the split-of-truth warning
 * (plan §2.3): flows recorded BOTH as initial volume and as merge history
 * would double-count.
 */
const OVERLAP_WINDOW_HOURS = 24;
/** Overlap warning fires when same-day source merges reach this share of initial. */
const OVERLAP_RATIO = 0.9;

const MS_PER_HOUR = 3_600_000;

function emptyBreakdown(initialL: number): BatchVolumeBreakdown {
  return {
    initialL,
    transfersInL: 0,
    transfersOutL: 0,
    transferLossL: 0,
    mergesInL: 0,
    mergesOutL: 0,
    bottlingL: 0,
    bottlingLossL: 0,
    keggingL: 0,
    keggingLossL: 0,
    distillationL: 0,
    adjustmentsPositiveL: 0,
    adjustmentsNegativeL: 0,
    rackingLossL: 0,
    filterLossL: 0,
  };
}

/**
 * Inclusive as-of-day cutoff: an event on the asOfDate calendar day is
 * included; the next day is not. Matches the SBD engine's historical
 * `event_at < asOf::date + 1 day` semantics exactly (see ttb.ts SBD queries).
 * asOfDate format: "YYYY-MM-DD".
 */
function makeCutoff(asOfDate: string): number {
  const [y, m, d] = asOfDate.split("-").map((n) => parseInt(n, 10));
  // UTC midnight of the day AFTER asOfDate; comparison is strict <.
  return Date.UTC(y, m - 1, d + 1);
}

/**
 * Reduce a batch's event history to its expected volume.
 *
 * Two modes, one core:
 * - `opts.asOfDate` omitted → all-time reduction (per-batch expected-current).
 * - `opts.asOfDate` set → point-in-time reconstruction (SBD/opening/ending);
 *   events after that day (and only those with a non-null `at`) are excluded.
 */
export function computeBatchVolumeFromHistory(
  input: BatchVolumeInputs,
  opts?: { asOfDate?: string },
): BatchVolumeResult {
  const initialL = input.transferCreated ? 0 : input.initialVolumeL;
  const breakdown = emptyBreakdown(initialL);
  const warnings: BatchVolumeWarning[] = [];

  const cutoff = opts?.asOfDate ? makeCutoff(opts.asOfDate) : null;
  let overlapMergeL = 0;

  for (const e of input.events) {
    if (cutoff !== null && e.at !== null && e.at.getTime() >= cutoff) continue;

    switch (e.type) {
      case "transfer_in":
        breakdown.transfersInL += e.volumeL;
        break;
      case "transfer_out":
        breakdown.transfersOutL += e.volumeL;
        breakdown.transferLossL += e.lossL;
        break;
      case "merge_in":
        breakdown.mergesInL += e.volumeL;
        if (
          !input.transferCreated &&
          input.startDate !== null &&
          e.at !== null &&
          (e.mergeSourceType === "press_run" || e.mergeSourceType === "juice_purchase") &&
          Math.abs(e.at.getTime() - input.startDate.getTime()) <=
            OVERLAP_WINDOW_HOURS * MS_PER_HOUR
        ) {
          overlapMergeL += e.volumeL;
        }
        break;
      case "merge_out":
        breakdown.mergesOutL += e.volumeL;
        break;
      case "bottle_run":
        breakdown.bottlingL += e.volumeL;
        if (!e.lossIncludedInVolume) breakdown.bottlingLossL += e.lossL;
        break;
      case "keg_fill":
        breakdown.keggingL += e.volumeL;
        breakdown.keggingLossL += e.lossL;
        break;
      case "distillation":
        breakdown.distillationL += e.volumeL;
        break;
      case "adjustment":
        if (e.volumeL >= 0) breakdown.adjustmentsPositiveL += e.volumeL;
        else breakdown.adjustmentsNegativeL += e.volumeL;
        break;
      case "racking_loss":
        breakdown.rackingLossL += e.volumeL;
        break;
      case "filter_loss":
        breakdown.filterLossL += e.volumeL;
        break;
    }
  }

  if (
    initialL > 0 &&
    overlapMergeL >= initialL * OVERLAP_RATIO
  ) {
    warnings.push({
      code: "initial_merge_overlap",
      detailL: overlapMergeL,
      message:
        `Press-run/juice merges within ${OVERLAP_WINDOW_HOURS}h of batch start ` +
        `(${overlapMergeL.toFixed(1)}L) cover >=${OVERLAP_RATIO * 100}% of initial volume ` +
        `(${initialL.toFixed(1)}L) — possible double-count between initial_volume_liters ` +
        `and batch_merge_history (plan §2.3).`,
    });
  }

  const volumeL =
    breakdown.initialL +
    breakdown.transfersInL +
    breakdown.mergesInL -
    breakdown.transfersOutL -
    breakdown.transferLossL -
    breakdown.mergesOutL -
    breakdown.bottlingL -
    breakdown.bottlingLossL -
    breakdown.keggingL -
    breakdown.keggingLossL -
    breakdown.distillationL +
    breakdown.adjustmentsPositiveL +
    breakdown.adjustmentsNegativeL -
    breakdown.rackingLossL -
    breakdown.filterLossL;

  return { volumeL, breakdown, warnings };
}
