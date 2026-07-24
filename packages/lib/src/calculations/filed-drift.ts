/**
 * Filed-vs-recompute drift comparator (Phase 4 C3).
 *
 * Compares a recomputed TTB form against the FILED numbers for the same period,
 * tolerating the documented owner-accepted permanent deltas (EXPECTED_DRIFT_*)
 * and flagging anything else as NEW drift. This is the runtime realization of
 * the golden test's static assertion: instead of "recompute == filed + known
 * delta" checked in CI, it runs at form-generation time so an engine change that
 * moves a filed line is surfaced to the owner immediately.
 *
 * Pure and defensive: unresolvable field paths become "skipped" lines; the
 * function never throws on shape mismatch.
 */
import type { ExpectedDriftEntry } from "./ttb-filed";

/** Per-line comparison outcome. */
export type FiledDriftLineStatus =
  | "match" // recompute matches filed (no meaningful drift expected or observed)
  | "expected" // drift present and matches the documented expected delta
  | "new_drift" // drift present that the documented delta does NOT explain
  | "skipped"; // not comparable (mode:"skip" or a value could not be resolved)

/** Roll-up status for the whole period. */
export type FiledDriftStatus = "clean" | "expected_only" | "new_drift";

export interface FiledDriftLine {
  label: string;
  field: string;
  taxClass: ExpectedDriftEntry["taxClass"];
  /** Filed value (null when unresolved). */
  filedGal: number | null;
  /** Recomputed value (null when unresolved). */
  recomputedGal: number | null;
  /** recomputed − filed (null when either side unresolved / skipped). */
  deltaGal: number | null;
  /** The documented expected delta for this line. */
  expectedDeltaGal: number;
  /** deltaGal − expectedDeltaGal (null when not compared). */
  residualGal: number | null;
  status: FiledDriftLineStatus;
}

export interface FiledDriftResult {
  lines: FiledDriftLine[];
  /** Count of lines whose status is "new_drift". */
  newDriftCount: number;
  /** Largest absolute residual across compared lines (0 when none compared). */
  maxResidualGal: number;
  status: FiledDriftStatus;
}

/** Default per-line tolerance (gal) when an entry does not specify one. */
export const DEFAULT_FILED_DRIFT_TOLERANCE = 1.0;

/**
 * Resolve a dot-path (e.g. "bulkWinesByTaxClass.hardCider.line29_losses")
 * against a plain object, returning a finite number or null. Never throws —
 * missing keys, non-objects, arrays-indexed-by-string, and non-numeric leaves
 * all resolve to null.
 */
function resolveNumber(root: unknown, path: string): number | null {
  if (root == null || typeof root !== "object") return null;
  let cur: any = root;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return null;
    cur = cur[key];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : null;
}

/**
 * Compare a recomputed form against its filed form.
 *
 * @param formData    the recomputed form/recon object (source of `entry.field`)
 * @param filedForm   the FILED_* constant for this period (source of `entry.filedField`)
 * @param expectedDrift the documented EXPECTED_DRIFT_* entries to evaluate
 */
export function computeFiledDrift(
  formData: unknown,
  filedForm: unknown,
  expectedDrift: ExpectedDriftEntry[],
): FiledDriftResult {
  const lines: FiledDriftLine[] = [];
  let newDriftCount = 0;
  let maxResidualGal = 0;
  let hasExpected = false;

  for (const entry of expectedDrift) {
    const tolerance = entry.tolerance ?? DEFAULT_FILED_DRIFT_TOLERANCE;
    const recomputedGal = resolveNumber(formData, entry.field);
    const filedGal = resolveNumber(filedForm, entry.filedField);

    const base: Omit<FiledDriftLine, "status" | "deltaGal" | "residualGal"> = {
      label: entry.label,
      field: entry.field,
      taxClass: entry.taxClass,
      filedGal,
      recomputedGal,
      expectedDeltaGal: entry.deltaGal,
    };

    // Not comparable: explicitly skipped, or a value could not be resolved.
    if (entry.mode === "skip" || recomputedGal === null || filedGal === null) {
      lines.push({ ...base, deltaGal: null, residualGal: null, status: "skipped" });
      continue;
    }

    const deltaGal = recomputedGal - filedGal;
    const residualGal = deltaGal - entry.deltaGal;
    const absResidual = Math.abs(residualGal);
    if (absResidual > maxResidualGal) maxResidualGal = absResidual;

    let status: FiledDriftLineStatus;
    if (absResidual > tolerance) {
      // The documented delta does not explain the observed difference.
      status = "new_drift";
      newDriftCount++;
    } else if (Math.abs(entry.deltaGal) <= tolerance) {
      // Expected ~zero drift, and the recompute indeed matches filed.
      status = "match";
    } else {
      // Documented nonzero drift, present as expected.
      status = "expected";
      hasExpected = true;
    }

    lines.push({ ...base, deltaGal, residualGal, status });
  }

  const status: FiledDriftStatus =
    newDriftCount > 0 ? "new_drift" : hasExpected ? "expected_only" : "clean";

  return {
    lines,
    newDriftCount,
    maxResidualGal: Math.round(maxResidualGal * 100) / 100,
    status,
  };
}
