/**
 * Unit tests for the filed-vs-recompute drift comparator (Phase 4 C3).
 *
 * Verbose by design: each case states the scenario it exercises so a failure
 * points straight at the classification rule that broke.
 */
import { describe, it, expect } from "vitest";
import {
  computeFiledDrift,
  DEFAULT_FILED_DRIFT_TOLERANCE,
} from "../filed-drift";
import {
  FILED_2025,
  EXPECTED_DRIFT_2025,
  EXPECTED_DRIFT_2024,
  type ExpectedDriftEntry,
} from "../ttb-filed";

// --- helpers ---------------------------------------------------------------

/** Set a dot-path on a plain object, creating intermediate objects. */
function setPath(root: any, path: string, value: number): void {
  const keys = path.split(".");
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

/** Read a dot-path number from a plain object (test-side mirror). */
function getPath(root: any, path: string): number {
  let cur = root;
  for (const k of path.split(".")) cur = cur?.[k];
  return cur as number;
}

/**
 * Build a synthetic recomputed form from a filed form + entries so that each
 * comparable entry reads exactly `filed + deltaGal` (i.e. the recompute matches
 * every documented delta perfectly → expected/clean, no new drift).
 */
function buildMatchingForm(
  filed: any,
  entries: ExpectedDriftEntry[],
): Record<string, unknown> {
  const form: Record<string, unknown> = {};
  for (const e of entries) {
    if (e.mode === "skip") continue;
    const filedVal = getPath(filed, e.filedField);
    if (typeof filedVal !== "number") continue;
    setPath(form, e.field, filedVal + e.deltaGal);
  }
  return form;
}

// A tiny hand-built entry set for precise unit control.
const filed = {
  sectionA: { hardCider: { line29_losses: 100, line31_ending: 200 } },
  materials: { applesLbs: 60000 },
};
const zeroDriftEntry: ExpectedDriftEntry = {
  label: "Z",
  field: "a.b",
  filedField: "sectionA.hardCider.line29_losses",
  taxClass: "hardCider",
  section: "A",
  surface: "form",
  deltaGal: 0,
  reason: "test",
};
const documentedDriftEntry: ExpectedDriftEntry = {
  label: "D",
  field: "a.c",
  filedField: "sectionA.hardCider.line31_ending",
  taxClass: "hardCider",
  section: "A",
  surface: "form",
  deltaGal: -50,
  reason: "test",
};

// ---------------------------------------------------------------------------

describe("computeFiledDrift — line classification", () => {
  it('marks a zero-expected line that matches filed as "match" → year "clean"', () => {
    const form = { a: { b: 100 } }; // equals filed 100, delta 0
    const res = computeFiledDrift(form, filed, [zeroDriftEntry]);
    expect(res.lines).toHaveLength(1);
    expect(res.lines[0].status).toBe("match");
    expect(res.lines[0].deltaGal).toBe(0);
    expect(res.lines[0].residualGal).toBe(0);
    expect(res.newDriftCount).toBe(0);
    expect(res.status).toBe("clean");
  });

  it('marks a documented nonzero delta present as expected → "expected" → "expected_only"', () => {
    const form = { a: { c: 150 } }; // filed 200 + delta -50 = 150
    const res = computeFiledDrift(form, filed, [documentedDriftEntry]);
    expect(res.lines[0].status).toBe("expected");
    expect(res.lines[0].deltaGal).toBe(-50);
    expect(res.lines[0].residualGal).toBe(0);
    expect(res.newDriftCount).toBe(0);
    expect(res.status).toBe("expected_only");
  });

  it('flags residual beyond tolerance as "new_drift" → year "new_drift"', () => {
    const form = { a: { c: 160 } }; // filed 200 + observed delta -40; expected -50 → residual +10
    const res = computeFiledDrift(form, filed, [documentedDriftEntry]);
    expect(res.lines[0].status).toBe("new_drift");
    expect(res.lines[0].residualGal).toBe(10);
    expect(res.newDriftCount).toBe(1);
    expect(res.maxResidualGal).toBe(10);
    expect(res.status).toBe("new_drift");
  });

  it("treats residual exactly at tolerance as NOT new drift (boundary, ≤)", () => {
    const form = { a: { c: 151 } }; // delta -49 vs expected -50 → residual +1 == default tol
    const res = computeFiledDrift(form, filed, [documentedDriftEntry]);
    expect(res.lines[0].status).toBe("expected");
    expect(res.newDriftCount).toBe(0);
  });

  it("treats residual just above tolerance as new drift", () => {
    const form = { a: { c: 151.01 } }; // residual +1.01 > default tol 1.0
    const res = computeFiledDrift(form, filed, [documentedDriftEntry]);
    expect(res.lines[0].status).toBe("new_drift");
    expect(res.newDriftCount).toBe(1);
  });

  it("treats a documented delta that vanished (recompute now matches filed) as new drift", () => {
    // Engine 'fixed' a documented -50 delta: recompute == filed → observed delta 0,
    // residual = 0 - (-50) = 50 > tol. The documented explanation no longer holds.
    const form = { a: { c: 200 } };
    const res = computeFiledDrift(form, filed, [documentedDriftEntry]);
    expect(res.lines[0].status).toBe("new_drift");
    expect(res.lines[0].residualGal).toBe(50);
  });

  it("honors a per-entry tolerance override (materials, tol 100)", () => {
    const entry: ExpectedDriftEntry = {
      label: "M",
      field: "materials.applesReceivedLbs",
      filedField: "materials.applesLbs",
      taxClass: null,
      section: "materials",
      surface: "form",
      deltaGal: -357,
      tolerance: 100,
      reason: "test",
    };
    // filed 60000 + expected -357 = 59643; recompute 59700 → residual +57 (< 100)
    const res = computeFiledDrift({ materials: { applesReceivedLbs: 59700 } }, filed, [entry]);
    expect(res.lines[0].status).toBe("expected");
    // Same line but residual 150 > 100 → new drift
    const res2 = computeFiledDrift({ materials: { applesReceivedLbs: 59493 } }, filed, [entry]);
    expect(res2.lines[0].status).toBe("new_drift");
  });

  it("uses the default tolerance constant when none is given", () => {
    expect(DEFAULT_FILED_DRIFT_TOLERANCE).toBe(1.0);
  });
});

describe("computeFiledDrift — skip / defensive resolution", () => {
  it('mode:"skip" entries are always "skipped" and never counted as drift', () => {
    const skipEntry: ExpectedDriftEntry = { ...documentedDriftEntry, mode: "skip" };
    // Even with a wildly-off recompute, a skip entry contributes nothing.
    const res = computeFiledDrift({ a: { c: 9999 } }, filed, [skipEntry]);
    expect(res.lines[0].status).toBe("skipped");
    expect(res.lines[0].deltaGal).toBeNull();
    expect(res.lines[0].residualGal).toBeNull();
    expect(res.newDriftCount).toBe(0);
    expect(res.status).toBe("clean");
  });

  it('unresolvable recompute path → "skipped" (recomputedGal null)', () => {
    const res = computeFiledDrift({}, filed, [documentedDriftEntry]);
    expect(res.lines[0].status).toBe("skipped");
    expect(res.lines[0].recomputedGal).toBeNull();
    expect(res.lines[0].filedGal).toBe(200); // filed still resolved
  });

  it('unresolvable filed path → "skipped" (filedGal null)', () => {
    const entry: ExpectedDriftEntry = { ...documentedDriftEntry, filedField: "nope.missing" };
    const res = computeFiledDrift({ a: { c: 150 } }, filed, [entry]);
    expect(res.lines[0].status).toBe("skipped");
    expect(res.lines[0].filedGal).toBeNull();
    expect(res.lines[0].recomputedGal).toBe(150);
  });

  it("never throws on null / non-object / array-in-path / non-numeric leaves", () => {
    const weird: ExpectedDriftEntry = {
      ...zeroDriftEntry,
      field: "list.0.value", // array indexed by string key → null
    };
    expect(() => computeFiledDrift(null, filed, [zeroDriftEntry])).not.toThrow();
    expect(() => computeFiledDrift(undefined, filed, [zeroDriftEntry])).not.toThrow();
    expect(() => computeFiledDrift(42, filed, [zeroDriftEntry])).not.toThrow();
    expect(() => computeFiledDrift("str", filed, [zeroDriftEntry])).not.toThrow();
    expect(
      computeFiledDrift({ list: [{ value: 5 }] }, filed, [weird]).lines[0].status,
    ).toBe("skipped");
    // non-numeric leaf resolves to null → skipped
    expect(
      computeFiledDrift({ a: { b: "100" } }, filed, [zeroDriftEntry]).lines[0].status,
    ).toBe("skipped");
    // NaN / Infinity leaves are not finite → skipped
    expect(
      computeFiledDrift({ a: { b: NaN } }, filed, [zeroDriftEntry]).lines[0].status,
    ).toBe("skipped");
  });

  it("handles an empty expectedDrift array as clean with no lines", () => {
    const res = computeFiledDrift({}, filed, []);
    expect(res.lines).toHaveLength(0);
    expect(res.newDriftCount).toBe(0);
    expect(res.maxResidualGal).toBe(0);
    expect(res.status).toBe("clean");
  });
});

describe("computeFiledDrift — roll-up status precedence", () => {
  it("new_drift dominates expected when both present", () => {
    const form = { a: { b: 100, c: 999 } }; // b matches (match), c is new drift
    const res = computeFiledDrift(form, filed, [zeroDriftEntry, documentedDriftEntry]);
    const statuses = res.lines.map((l) => l.status).sort();
    expect(statuses).toContain("new_drift");
    expect(res.status).toBe("new_drift");
  });

  it("maxResidualGal is the largest absolute residual across compared lines", () => {
    const form = { a: { b: 103, c: 148 } }; // b residual +3, c residual -2
    const res = computeFiledDrift(form, filed, [zeroDriftEntry, documentedDriftEntry]);
    expect(res.maxResidualGal).toBe(3);
  });
});

describe("computeFiledDrift — against real 2025 constants", () => {
  const formEntries = EXPECTED_DRIFT_2025.filter((e) => e.surface === "form");

  it("a faithful recompute of every documented delta yields expected_only, 0 new drift", () => {
    const form = buildMatchingForm(FILED_2025, formEntries);
    const res = computeFiledDrift(form, FILED_2025, formEntries);
    expect(res.newDriftCount).toBe(0);
    expect(res.status).toBe("expected_only");
    // Every form entry has a nonzero documented delta → all "expected".
    expect(res.lines.every((l) => l.status === "expected")).toBe(true);
    expect(res.maxResidualGal).toBeLessThanOrEqual(0.001);
  });

  it("a single engine change beyond tolerance surfaces exactly one new_drift line", () => {
    const form = buildMatchingForm(FILED_2025, formEntries);
    // Perturb HC Line 31 ending by +5 gal (beyond its default 1.0 tolerance).
    setPath(
      form,
      "bulkWinesByTaxClass.hardCider.line31_onHandEnd",
      getPath(form, "bulkWinesByTaxClass.hardCider.line31_onHandEnd") + 5,
    );
    const res = computeFiledDrift(form, FILED_2025, formEntries);
    expect(res.newDriftCount).toBe(1);
    expect(res.status).toBe("new_drift");
    const drifted = res.lines.find((l) => l.status === "new_drift");
    expect(drifted?.label).toBe("HC Line 31 Ending");
    expect(drifted?.residualGal).toBeCloseTo(5, 5);
  });

  it("unresolved form fields (partial form) degrade to skipped, not new drift", () => {
    // Empty form → nothing resolves → all skipped → clean (no false positives).
    const res = computeFiledDrift({}, FILED_2025, formEntries);
    expect(res.lines.every((l) => l.status === "skipped")).toBe(true);
    expect(res.newDriftCount).toBe(0);
    expect(res.status).toBe("clean");
  });
});

describe("computeFiledDrift — against real 2024 constants", () => {
  const formEntries = EXPECTED_DRIFT_2024.filter((e) => e.surface === "form");

  it("2024 form entries are all mode:skip → skipped regardless of recompute → clean", () => {
    // 2024 is not event-sourced; feed a nonsense form and confirm no drift fires.
    const junkForm = {
      bulkWinesByTaxClass: {
        hardCider: { line2_produced: 0, line13_bottled: 0, line16_distillingMaterial: 0, line29_losses: 0 },
        wineUnder16: { line13_bottled: 0 },
        wine16To21: { line4_wineSpirits: 0 },
      },
    };
    const res = computeFiledDrift(junkForm, {}, formEntries);
    expect(res.lines.every((l) => l.status === "skipped")).toBe(true);
    expect(res.newDriftCount).toBe(0);
    expect(res.status).toBe("clean");
  });
});
