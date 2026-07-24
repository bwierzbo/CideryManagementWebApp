/**
 * TTB Filed Numbers — source of truth for the already-submitted annual filings.
 *
 * Phase 4 (docs/reconciliation-robustness-plan.md §3) moves the filed 2024/2025
 * Form 5120.17 numbers out of the golden test (where they lived as hardcoded
 * expectations) and into a single shared module. They are then:
 *   - imported by the golden test (which derives its KNOWN_DELTA map from the
 *     EXPECTED_DRIFT entries — zero behavioral change),
 *   - seeded into `ttb_period_snapshots` (migration 0148 columns) so a
 *     recomputed period can be compared to what was filed at runtime,
 *   - consumed by `computeFiledDrift` (filed-drift.ts) to flag NEW drift while
 *     tolerating the documented, owner-accepted permanent deltas below.
 *
 * ANCHOR (plan §0): the filed 2024 & 2025 reports are the source of truth. We
 * recompute honestly and *compare* — we never overwrite the filed numbers. When
 * a recompute diverges from filed for a documented reason (the fall-2025 backlog
 * booked with 2026 event dates; 2024 predating full event capture), that
 * divergence is an EXPECTED_DRIFT entry, not a new problem. If a delta appears
 * that is NOT in these arrays, the engine changed and must be investigated.
 *
 * FILED_* values are copied verbatim from the verified filings:
 *   2024 filed 2025-01-13; 2025 filed 2026-02-27.
 */

// ---------------------------------------------------------------------------
// Filed form shapes (values only — the numbers as submitted to TTB)
// ---------------------------------------------------------------------------

/**
 * FILED_2025 mirrors the verified 2025 Form 5120.17 PDF, structured exactly as
 * the golden test's former local `PDF` constant so the golden test can consume
 * it directly (`const PDF = FILED_2025`).
 */
export const FILED_2025 = {
  sectionA: {
    hardCider: {
      line1_opening: 1061.0,
      line2_produced: 4807.7,
      line10_changeOfClassIn: 5.0,
      line12_totalIn: 5873.7,
      line13_packaged: 148.9,
      line16_distillation: 753.2,
      line24_changeOfClassOut: 641.4, // perry no longer cross-class (cider→perry are both hardCider)
      line29_losses: 238.2, // all losses: bulk + bottling. Line 30 reserved for physical inventory shortages only. +5 gal from distillery adj.
      line31_ending: 4092.3, // LIVE currentVolumeLiters — after data fixes
      line32_totalOut: 5873.7,
    },
    wineUnder16: {
      line1_opening: 0.0,
      line2_produced: 56.2,
      line10_changeOfClassIn: 641.4, // perry no longer cross-class (cider→perry are both hardCider)
      line12_totalIn: 697.6, // adjusted for perry classification
      line13_packaged: 628.2,
      line24_changeOfClassOut: 5.0,
      line29_losses: 46.6, // all losses: bulk + bottling. Line 30 reserved for physical inventory shortages only.
      line31_ending: 17.9,
      line32_totalOut: 697.6, // adjusted for perry classification
    },
    wine16To21: {
      line1_opening: 60.0,
      line4_wineSpirits: 119.0,
      line12_totalIn: 179.0,
      line13_packaged: 55.2,
      line29_losses: 1.5, // all losses: bulk (1.3) + bottling (0.2). Line 30 reserved for physical inventory shortages only.
      line31_ending: 122.3,
      line32_totalOut: 179.0,
    },
  },
  sectionB: {
    hardCider: {
      line2_bottledFromBulk: 148.9,
      line8_removedTaxPaid: 148.9,
      line20_endingBottled: 0.0,
    },
    wineUnder16: {
      line2_bottledFromBulk: 628.2,
      line8_removedTaxPaid: 566.3,
      line20_endingBottled: 61.9,
    },
    wine16To21: {
      line2_bottledFromBulk: 55.2,
      line8_removedTaxPaid: 55.2,
      line20_endingBottled: 0.0,
    },
  },
  materials: {
    applesLbs: 63299,
    juiceGal: 3872,
    otherFruitLbs: 786,
    sugarLbs: 40,
  },
  brandy: {
    receivedGal: 55.0,
    receivedProofGal: 77.0,
    usedGal: 29.9,
    usedProofGal: 41.9,
    remainingGal: 25.1,
    remainingProofGal: 35.1,
  },
} as const;

/**
 * FILED_2024 mirrors the verified 2024 Form 5120.17 (filed 2025-01-13).
 * Source: the FILED table in docs/reconciliation-phase0-report.md §C and the
 * FILED constant in packages/api/scripts/phase0-recon-diagnostic.ts.
 *
 * 2024 predates full event capture, so the flow lines are NOT reproducible from
 * events (see EXPECTED_DRIFT_2024 — every flow line is mode:"skip"). Only the
 * endings are meaningful, and even those carry documented reconstruction drift.
 */
export const FILED_2024 = {
  sectionA: {
    hardCider: {
      line1_opening: 0,
      line2_produced: 1496,
      line13_bottled: 90,
      line16_distilling: 264,
      line20_blending: 42,
      line29_losses: 39,
      line31_ending: 1061,
      line32_total: 1496,
    },
    wineUnder16: {
      line1_opening: 0,
      line5_blending: 127,
      line13_bottled: 127,
      line29_losses: 0,
      line31_ending: 0,
      line32_total: 127,
    },
    wine16To21: {
      line1_opening: 0,
      line4_spirits: 60,
      line29_losses: 0,
      line31_ending: 60,
      line32_total: 60,
    },
  },
  totals: { bulkEnding: 1121, packagedEnding: 0, onPremisesEnding: 1121 },
} as const;

// ---------------------------------------------------------------------------
// Expected-drift entries (recompute-vs-filed permanent deltas)
// ---------------------------------------------------------------------------

/** Which surface the drift is observed on. */
export type FiledDriftSurface = "form" | "checkpoint";

/**
 * How the comparator treats the entry:
 * - "compare" (default): recompute is expected to differ from filed by
 *   ~`deltaGal`; residual = (recompute − filed) − deltaGal must stay within
 *   tolerance or it becomes NEW drift.
 * - "skip": the line is not reproducible from events (e.g. a pre-event-capture
 *   year); do not compare it at all.
 */
export type FiledDriftMode = "compare" | "skip";

/**
 * One documented, owner-accepted difference between the recomputed form and the
 * filed number. `deltaGal = recomputed − filed` (rounded to 0.1 gal).
 */
export interface ExpectedDriftEntry {
  /** Human label — matches the golden test assertion label exactly. */
  label: string;
  /** Dot-path into the recomputed form/recon result for this value. */
  field: string;
  /** Dot-path into the FILED_* constant for the corresponding filed value. */
  filedField: string;
  /** Tax class this line belongs to (null for cross-class totals/materials). */
  taxClass:
    | "hardCider"
    | "wineUnder16"
    | "wine16To21"
    | "carbonatedWine"
    | "sparklingWine"
    | null;
  /** Form section the line lives on: "A" bulk, "B" bottled, or a memo group. */
  section: "A" | "B" | "materials" | "waterfall";
  surface: FiledDriftSurface;
  /** recomputed − filed (gal). Ignored when mode === "skip". */
  deltaGal: number;
  /** Comparison tolerance in gal (defaults to 1.0 in the comparator). */
  tolerance?: number;
  mode?: FiledDriftMode;
  /** Why this delta exists — the audit trail for the owner decision. */
  reason: string;
}

/**
 * 2025 permanent deltas — the golden test's former KNOWN_DELTA map, verbatim
 * values, now with `field`/`filedField` paths + reasons. Cause (owner decision
 * 2026-07-20, no re-dating / no amended filing): the fall-2025 production backlog
 * was data-entered in 2026 with 2026-dated events, so filed numbers reflect
 * physical reality while the recompute reflects events exactly as entered.
 *
 * The two waterfall-opening entries are surface:"checkpoint" (they come from the
 * reconciliation waterfall, not the form).
 */
export const EXPECTED_DRIFT_2025: ExpectedDriftEntry[] = [
  {
    label: "HC Line 29 Losses",
    field: "bulkWinesByTaxClass.hardCider.line29_losses",
    filedField: "sectionA.hardCider.line29_losses",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: 15.4, // actual 253.6 (recorded losses) vs filed 238.2
    reason:
      "Line 29 is now the REAL recorded operational losses (de-plugged, Phase 3 C2), not a balance-forcing plug. Small recorded-loss difference vs filed.",
  },
  {
    label: "HC Line 31 Ending",
    field: "bulkWinesByTaxClass.hardCider.line31_onHandEnd",
    filedField: "sectionA.hardCider.line31_ending",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: -1156.1, // actual 2936.2 vs filed 4092.3
    reason:
      "Recompute counts fall-2025 volume as still-on-hand (booked 2026) rather than lost/ended in 2025, deflating Line 31 ending by ~1.15k gal.",
  },
  {
    label: "HC Line 12 Total In",
    field: "bulkWinesByTaxClass.hardCider.line12_total",
    filedField: "sectionA.hardCider.line12_totalIn",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: 1.6, // actual 5875.3 vs filed 5873.7
    reason: "Rounding of backlog inflows.",
  },
  {
    label: "W<16 Line 13 Packaged",
    field: "bulkWinesByTaxClass.wineUnder16.line13_bottled",
    filedField: "sectionA.wineUnder16.line13_packaged",
    taxClass: "wineUnder16",
    section: "A",
    surface: "form",
    deltaGal: -35.5, // actual 592.7 vs filed 628.2
    reason: "Plum/quince packaging booked 2026, so less packaged in 2025.",
  },
  {
    label: "W<16 Line 29 Losses",
    field: "bulkWinesByTaxClass.wineUnder16.line29_losses",
    filedField: "sectionA.wineUnder16.line29_losses",
    taxClass: "wineUnder16",
    section: "A",
    surface: "form",
    deltaGal: -9.5, // actual 37.1 (recorded losses) vs filed 46.6
    reason:
      "Line 29 = real recorded losses (37.1), not the former plug; difference now honest unexplained variance elsewhere.",
  },
  {
    label: "W<16 Line 31 Ending",
    field: "bulkWinesByTaxClass.wineUnder16.line31_onHandEnd",
    filedField: "sectionA.wineUnder16.line31_ending",
    taxClass: "wineUnder16",
    section: "A",
    surface: "form",
    deltaGal: -5.0, // actual 12.9 vs filed 17.9
    reason: "Mirror of the plum/quince packaging booked in 2026.",
  },
  {
    label: "W<16 Line 12 Total In",
    field: "bulkWinesByTaxClass.wineUnder16.line12_total",
    filedField: "sectionA.wineUnder16.line12_totalIn",
    taxClass: "wineUnder16",
    section: "A",
    surface: "form",
    deltaGal: -22.4, // actual 675.2 vs filed 697.6
    reason: "Fruited-cider inflow booked 2026.",
  },
  {
    label: "W<16-B Line 2 Bottled",
    field: "bottledWinesByTaxClass.wineUnder16.line2_bottled",
    filedField: "sectionB.wineUnder16.line2_bottledFromBulk",
    taxClass: "wineUnder16",
    section: "B",
    surface: "form",
    deltaGal: -35.5, // actual 592.7 vs filed 628.2 (same event as Line 13)
    reason: "Same plum/quince packaging event as Section A Line 13.",
  },
  {
    label: "W<16-B Line 20 Ending",
    field: "bottledWinesByTaxClass.wineUnder16.line20_onHandEnd",
    filedField: "sectionB.wineUnder16.line20_endingBottled",
    taxClass: "wineUnder16",
    section: "B",
    surface: "form",
    deltaGal: -35.5, // actual 26.4 vs filed 61.9
    reason: "Mirror of the plum/quince packaging booked 2026.",
  },
  {
    label: "W16-21 Line 12 Total In",
    field: "bulkWinesByTaxClass.wine16To21.line12_total",
    filedField: "sectionA.wine16To21.line12_totalIn",
    taxClass: "wine16To21",
    section: "A",
    surface: "form",
    deltaGal: 45.7, // actual 224.7 vs filed 179.0
    reason: "Extra 2025 blend inflow present in recompute (pommeau scope).",
  },
  {
    label: "Materials Apples (lbs)",
    field: "materials.applesReceivedLbs",
    filedField: "materials.applesLbs",
    taxClass: null,
    section: "materials",
    surface: "form",
    deltaGal: -357.0, // actual 62942 vs filed 63299 (lbs, not gal)
    tolerance: 100,
    reason:
      "Apple weight off by one small backlog receipt (value is lbs, wide tolerance).",
  },
  {
    label: "Waterfall total opening",
    field: "waterfall.totals.opening",
    filedField: "totals.onPremisesEnding",
    taxClass: null,
    section: "waterfall",
    surface: "checkpoint",
    deltaGal: -9.8, // actual 1111.3 vs filed 1121.0
    tolerance: 5,
    reason:
      "SBD reconstruction of Dec-31-2024 carried-forward batches runs ~10 gal below filed opening (reconstruction drift, permanent without re-dating history).",
  },
  {
    label: "HC waterfall opening",
    field: "waterfall.byTaxClass.hardCider.opening",
    filedField: "sectionA.hardCider.line1_opening",
    taxClass: "hardCider",
    section: "waterfall",
    surface: "checkpoint",
    deltaGal: -10.2, // actual 1051.8 vs filed 1062.0
    tolerance: 5,
    reason: "Same opening reconstruction drift, hard-cider slice.",
  },
];

/**
 * 2024 permanent deltas. 2024 predates full event capture, so every flow line is
 * mode:"skip" (not reproducible from events — the recompute produces near-zero
 * flows against filed hundreds/thousands). Only the endings are compared, and
 * they carry documented reconstruction drift. Endings are surface:"checkpoint"
 * (internal reconstruction signal) — the 2024 form itself is frozen via its
 * filed snapshot, never recomputed for filing (plan Phase 4 "freeze, not
 * backfill").
 */
export const EXPECTED_DRIFT_2024: ExpectedDriftEntry[] = [
  // --- Flow lines: not event-sourced, skip entirely ---
  {
    label: "HC Line 2 Produced",
    field: "bulkWinesByTaxClass.hardCider.line2_produced",
    filedField: "sectionA.hardCider.line2_produced",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: 0,
    mode: "skip",
    reason: "2024 predates full event capture (recompute ~508 vs filed 1496).",
  },
  {
    label: "HC Line 13 Bottled",
    field: "bulkWinesByTaxClass.hardCider.line13_bottled",
    filedField: "sectionA.hardCider.line13_bottled",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: 0,
    mode: "skip",
    reason: "2024 not event-sourced (recompute 0 vs filed 90).",
  },
  {
    label: "HC Line 16 Distilling",
    field: "bulkWinesByTaxClass.hardCider.line16_distillingMaterial",
    filedField: "sectionA.hardCider.line16_distilling",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: 0,
    mode: "skip",
    reason: "2024 not event-sourced (recompute 0 vs filed 264).",
  },
  {
    label: "HC Line 29 Losses (2024)",
    field: "bulkWinesByTaxClass.hardCider.line29_losses",
    filedField: "sectionA.hardCider.line29_losses",
    taxClass: "hardCider",
    section: "A",
    surface: "form",
    deltaGal: 0,
    mode: "skip",
    reason: "2024 not event-sourced (filed 39).",
  },
  {
    label: "W<16 Line 13 Bottled (2024)",
    field: "bulkWinesByTaxClass.wineUnder16.line13_bottled",
    filedField: "sectionA.wineUnder16.line13_bottled",
    taxClass: "wineUnder16",
    section: "A",
    surface: "form",
    deltaGal: 0,
    mode: "skip",
    reason: "2024 not event-sourced (filed 127).",
  },
  {
    label: "W16-21 Line 4 Spirits (2024)",
    field: "bulkWinesByTaxClass.wine16To21.line4_wineSpirits",
    filedField: "sectionA.wine16To21.line4_spirits",
    taxClass: "wine16To21",
    section: "A",
    surface: "form",
    deltaGal: 0,
    mode: "skip",
    reason: "2024 not event-sourced (filed 60).",
  },
  // --- Endings: documented reconstruction drift on the frozen year ---
  {
    label: "HC Line 31 Ending (2024)",
    field: "bulkWinesByTaxClass.hardCider.line31_onHandEnd",
    filedField: "sectionA.hardCider.line31_ending",
    taxClass: "hardCider",
    section: "A",
    surface: "checkpoint",
    deltaGal: -9.2, // recompute 1051.8 vs filed 1061
    tolerance: 5,
    reason:
      "SBD reconstruction of carried-forward batches runs ~9 gal below filed HC ending.",
  },
  {
    label: "W<16 Line 31 Ending (2024)",
    field: "bulkWinesByTaxClass.wineUnder16.line31_onHandEnd",
    filedField: "sectionA.wineUnder16.line31_ending",
    taxClass: "wineUnder16",
    section: "A",
    surface: "checkpoint",
    deltaGal: 197.9, // recompute 197.9 vs filed 0
    tolerance: 5,
    reason:
      "Classification difference (not volume creation): perry/fruited volume the filing carried elsewhere lands in wineUnder16 on recompute.",
  },
  {
    label: "W16-21 Line 31 Ending (2024)",
    field: "bulkWinesByTaxClass.wine16To21.line31_onHandEnd",
    filedField: "sectionA.wine16To21.line31_ending",
    taxClass: "wine16To21",
    section: "A",
    surface: "checkpoint",
    deltaGal: -0.6, // recompute 59.4 vs filed 60
    tolerance: 5,
    reason: "Minor reconstruction drift on wine16To21 ending.",
  },
];
