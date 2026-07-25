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
import type { ExpectedDriftEntry, FiledDriftEvalMode } from "./ttb-filed";

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

// Tax-class keys the ExpectedDriftEntry union recognizes (used to derive a
// class label for a synthesized full-mode line from its field path).
const ENTRY_TAX_CLASSES = new Set<string>([
  "hardCider",
  "wineUnder16",
  "wine16To21",
  "carbonatedWine",
  "sparklingWine",
]);

// Top-level containers whose numeric leaves form the full-mode canonical set.
const FULL_MODE_CONTAINERS = [
  "bulkWinesByTaxClass",
  "bottledWinesByTaxClass",
  "materials",
] as const;

/** Derive the tax class for a full-mode leaf path (2nd segment, or null). */
function taxClassFromPath(path: string): ExpectedDriftEntry["taxClass"] {
  const seg = path.split(".");
  if (seg[0] === "materials") return null;
  return (ENTRY_TAX_CLASSES.has(seg[1]) ? seg[1] : null) as ExpectedDriftEntry["taxClass"];
}

/** Recursively collect dot-paths of finite-number leaves under `node`. */
function collectLeaves(node: unknown, prefix: string, out: string[]): void {
  if (node == null || typeof node !== "object" || Array.isArray(node)) return;
  for (const [k, v] of Object.entries(node)) {
    const p = `${prefix}.${k}`;
    if (typeof v === "number" && Number.isFinite(v)) out.push(p);
    else if (v != null && typeof v === "object" && !Array.isArray(v)) {
      collectLeaves(v, p, out);
    }
  }
}

/**
 * Classify one comparable line into match / expected / new_drift / skipped.
 * `expectedDeltaGal` is carried on `base`; `skip` and `tolerance` come from the
 * entry (or the full-mode default).
 */
function classifyLine(
  base: Omit<FiledDriftLine, "status" | "deltaGal" | "residualGal">,
  tolerance: number,
  skip: boolean,
): FiledDriftLine {
  const { filedGal, recomputedGal, expectedDeltaGal } = base;
  // Not comparable: explicitly skipped, or a value could not be resolved.
  if (skip || recomputedGal === null || filedGal === null) {
    return { ...base, deltaGal: null, residualGal: null, status: "skipped" };
  }
  const deltaGal = recomputedGal - filedGal;
  const residualGal = deltaGal - expectedDeltaGal;
  const absResidual = Math.abs(residualGal);
  let status: FiledDriftLineStatus;
  if (absResidual > tolerance) {
    // The documented delta does not explain the observed difference.
    status = "new_drift";
  } else if (Math.abs(expectedDeltaGal) <= tolerance) {
    // Expected ~zero drift, and the recompute indeed matches filed.
    status = "match";
  } else {
    // Documented nonzero drift, present as expected.
    status = "expected";
  }
  return { ...base, deltaGal, residualGal, status };
}

/** entries mode — compare ONLY the listed entries (field ↔ filedField). */
function computeEntriesModeLines(
  formData: unknown,
  filedForm: unknown,
  entries: ExpectedDriftEntry[],
): FiledDriftLine[] {
  return entries.map((entry) => {
    const base: Omit<FiledDriftLine, "status" | "deltaGal" | "residualGal"> = {
      label: entry.label,
      field: entry.field,
      taxClass: entry.taxClass,
      filedGal: resolveNumber(filedForm, entry.filedField),
      recomputedGal: resolveNumber(formData, entry.field),
      expectedDeltaGal: entry.deltaGal,
    };
    return classifyLine(base, entry.tolerance ?? DEFAULT_FILED_DRIFT_TOLERANCE, entry.mode === "skip");
  });
}

/**
 * full mode — the canonical field set is every numeric leaf under
 * bulkWinesByTaxClass / bottledWinesByTaxClass / materials OF THE FILED FORM,
 * compared same-path against the recompute at the default tolerance. `entries`
 * override per-field: an entry whose `field` equals the leaf path supplies its
 * documented delta / tolerance / skip. Any leaf beyond tolerance without a
 * covering override is NEW drift.
 */
function computeFullModeLines(
  formData: unknown,
  filedForm: unknown,
  entries: ExpectedDriftEntry[],
): FiledDriftLine[] {
  const overrides = new Map<string, ExpectedDriftEntry>();
  for (const e of entries) overrides.set(e.field, e);

  const paths: string[] = [];
  for (const container of FULL_MODE_CONTAINERS) {
    collectLeaves((filedForm as any)?.[container], container, paths);
  }

  return paths.map((path) => {
    const override = overrides.get(path);
    const base: Omit<FiledDriftLine, "status" | "deltaGal" | "residualGal"> = {
      label: override?.label ?? path,
      field: path,
      taxClass: override?.taxClass ?? taxClassFromPath(path),
      filedGal: resolveNumber(filedForm, path),
      recomputedGal: resolveNumber(formData, path),
      expectedDeltaGal: override?.deltaGal ?? 0,
    };
    return classifyLine(base, override?.tolerance ?? DEFAULT_FILED_DRIFT_TOLERANCE, override?.mode === "skip");
  });
}

/**
 * Compare a recomputed form against its filed form.
 *
 * @param formData    the recomputed form/recon object (source of `entry.field`)
 * @param filedForm   the FILED_* constant for this period (source of `entry.filedField`
 *                    in entries mode; source of the canonical leaf set in full mode)
 * @param expectedDrift the documented EXPECTED_DRIFT_* entries (per-field overrides in full mode)
 * @param opts.mode   "entries" (default) compares only the listed entries;
 *                    "full" compares the canonical leaf set with entries as overrides
 */
export function computeFiledDrift(
  formData: unknown,
  filedForm: unknown,
  expectedDrift: ExpectedDriftEntry[],
  opts?: { mode?: FiledDriftEvalMode },
): FiledDriftResult {
  const mode = opts?.mode ?? "entries";
  const lines =
    mode === "full"
      ? computeFullModeLines(formData, filedForm, expectedDrift)
      : computeEntriesModeLines(formData, filedForm, expectedDrift);

  let newDriftCount = 0;
  let maxResidualGal = 0;
  let hasExpected = false;
  for (const l of lines) {
    if (l.status === "new_drift") newDriftCount++;
    else if (l.status === "expected") hasExpected = true;
    if (l.residualGal !== null) {
      maxResidualGal = Math.max(maxResidualGal, Math.abs(l.residualGal));
    }
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
