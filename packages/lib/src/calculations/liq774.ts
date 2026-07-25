/**
 * WA LIQ-774 — "Domestic Winery Summary Tax Report" (WSLCB)
 *
 * Pure derivation of the WA state winery tax report from the federal TTB Form
 * 5120.17 (single source of truth for production/removals) plus a channel-sales
 * breakdown (single source of truth for taxable-sales-by-channel).
 *
 * @see docs/ttb-liq774-form-spec.md — extracted from Olympic Bluffs' filed 2025
 *      LIQ-774. That spec's numbers are the golden fixture (liq774.test.ts).
 *
 * Categories on this form: Cider · Non-Fortified Wine · Fortified Wine.
 * Federal tax classes map onto them as (spec §"Source-data mapping" + owner's
 * filed form):
 *   hardCider                                   → Cider
 *   wineUnder16 + carbonatedWine + sparklingWine → Non-Fortified
 *   wine16To21 + wine21To24                       → Fortified
 * (appleBrandy / grapeSpirits are distilled spirits — not on this wine form.)
 *
 * Everything here is pure: no DB, no I/O. The generator (ttb.generateLIQ774)
 * recomputes the TTB form + a channel-sales query, then calls computeLIQ774.
 */

import type {
  TTBForm512017Data,
  BulkWinesSection,
  BottledWinesSection,
  TTBReportingPeriod,
} from "./ttb";

// ============================================
// Constants — tax rates (spec §"Tax (17)–(24)")
// ============================================

/** WA excise tax per wine gallon — Cider (box 17). */
export const LIQ774_CIDER_TAX_RATE_PER_GAL = 0.308135;
/** WA excise tax per wine gallon — Non-Fortified wine (box 18). */
export const LIQ774_NON_FORTIFIED_TAX_RATE_PER_GAL = 0.867623;
/** WA excise tax per wine gallon — Fortified wine (box 19). */
export const LIQ774_FORTIFIED_TAX_RATE_PER_GAL = 1.717076;
/**
 * WA Wine Commission assessment per gallon (box 23). Applies ONLY to
 * Non-Fortified + Fortified gallons — cider and mead are excluded.
 */
export const LIQ774_WINE_COMMISSION_RATE_PER_GAL = 0.08;

/** Default identity tolerance (gal) for the box16≡box9 reconciliation check. */
export const LIQ774_IDENTITY_TOLERANCE_GAL = 1.0;

// ============================================
// Category mapping
// ============================================

/** LIQ-774 report categories. */
export type LIQ774Category = "cider" | "nonFortified" | "fortified";

export const LIQ774_CATEGORIES: readonly LIQ774Category[] = [
  "cider",
  "nonFortified",
  "fortified",
] as const;

/** Human labels for the three category columns. */
export const LIQ774_CATEGORY_LABELS: Record<LIQ774Category, string> = {
  cider: "Cider",
  nonFortified: "Non-Fortified Wine",
  fortified: "Fortified Wine",
};

/**
 * Which federal TTB tax classes roll up into each LIQ-774 category.
 * Keys match the TTBTaxClass identifiers used across the TTB form.
 */
export const LIQ774_TAX_CLASSES_BY_CATEGORY: Record<LIQ774Category, readonly string[]> = {
  cider: ["hardCider"],
  nonFortified: ["wineUnder16", "carbonatedWine", "sparklingWine"],
  fortified: ["wine16To21", "wine21To24"],
};

/** Reverse map: federal tax class → LIQ-774 category (null if not on this form). */
export function taxClassToLIQ774Category(taxClass: string): LIQ774Category | null {
  for (const category of LIQ774_CATEGORIES) {
    if (LIQ774_TAX_CLASSES_BY_CATEGORY[category].includes(taxClass)) {
      return category;
    }
  }
  return null;
}

// ============================================
// Input / output types
// ============================================

/**
 * Taxable/non-taxable sales gallons per category, split by WA sales channel.
 * Sourced from `inventory_distributions` joined to `sales_channels`, grouped by
 * channel and TTB tax class → LIQ-774 category (see ttb.generateLIQ774).
 */
export interface LIQ774CategoryChannelSales {
  /** Box 13 — winery retail (tasting room, direct ship/DTC, events, charged tasting, samples, donations). */
  retailGal: number;
  /** Box 14 — WA retail licensees (the wholesale channel: on/off-premise licensees). */
  licenseeGal: number;
  /** Box 10 — bottled sold to out-of-state wineries bond-to-bond (non-taxable). */
  outOfStateGal?: number;
  /** Box 11 — WA distributors (reported on companion Form 777, non-taxable here). */
  waDistributorGal?: number;
  /** Box 12 — WSLCB / Military / ICC / exports out of WA (non-taxable). */
  wslcbMilitaryExportGal?: number;
}

/** Channel-sales input to computeLIQ774. */
export interface LIQ774ChannelSales {
  byCategory: Record<LIQ774Category, LIQ774CategoryChannelSales>;
  /** Box 21 — late-filing penalty ($). Defaults to 0. */
  latePenalty?: number;
  /** Box 22 — mead gallons excluded from the wine-commission base. Defaults to 0. */
  meadGallons?: number;
}

/** A value carried across the three category columns plus a total. */
export interface LIQ774CategoryValues {
  cider: number;
  nonFortified: number;
  fortified: number;
  total: number;
}

/** 3-state result of the box16 ≡ box9 identity check (never plugged). */
export type LIQ774IdentityState =
  /** box16 == box9 within tolerance — the form reconciles. */
  | "match"
  /** box16 > box9 — channel-attributed sales exceed TTB taxpaid removals. */
  | "channelExceedsRemovals"
  /** box16 < box9 — TTB taxpaid removals exceed channel-attributed sales. */
  | "removalsExceedChannel";

/** box16 ≡ box9 reconciliation, surfaced as a variance flag (never balanced by a plug). */
export interface LIQ774Identity {
  /** Box 9 — total removals from the TTB form. */
  box9: number;
  /** Box 16 — (box11 + box12 + box15) computed from channel sales. */
  box16: number;
  /** box16 − box9 (signed gallons). */
  variance: number;
  state: LIQ774IdentityState;
  toleranceGal: number;
}

/** Per-category tax computation line. */
export interface LIQ774TaxLine {
  category: LIQ774Category;
  label: string;
  taxableGallons: number;
  taxRate: number;
  tax: number;
}

/** Complete computed LIQ-774. All gallon values are whole gallons; $ to cents. */
export interface LIQ774Data {
  reportingPeriod: TTBReportingPeriod;

  // --- Production / removals (derived from the TTB 5120.17) ---
  /** Box 1 — Total NET gallons (total wine handled; see computeLIQ774 note). */
  box1_totalNetGallons: LIQ774CategoryValues;
  /** Box 2 — Total removed at winery (TTB Section B line 8 taxpaid + line 12 export). */
  box2_totalAtWinery: LIQ774CategoryValues;
  /** Box 9 — Total removals (boxes 2–8; boxes 3–8 are federal-area/warehouse adjustments, 0 here). */
  box9_totalRemovals: LIQ774CategoryValues;

  // --- Non-taxable removals (from channel sales) ---
  /** Box 10 — bottled sold out-of-state bond-to-bond. */
  box10_outOfState: LIQ774CategoryValues;
  /** Box 11 — WA distributors (Form 777). */
  box11_waDistributors: LIQ774CategoryValues;
  /** Box 12 — WSLCB / Military / ICC / exports out of WA. */
  box12_wslcbMilitaryExport: LIQ774CategoryValues;

  // --- Taxable sales (from channel sales) ---
  /** Box 13 — winery retail (incl. direct ship, samples, donations, charged tasting). */
  box13_wineryRetail: LIQ774CategoryValues;
  /** Box 14 — WA retail licensees. */
  box14_waRetailLicensees: LIQ774CategoryValues;
  /** Box 15 — total taxable = box13 + box14. */
  box15_totalTaxable: LIQ774CategoryValues;
  /** Box 16 — (box11 + box12 + box15); must equal box 9. */
  box16_reconciliation: LIQ774CategoryValues;

  /** box16 ≡ box9 identity, surfaced as a variance flag. */
  identity: LIQ774Identity;

  // --- Tax computation ---
  /** Boxes 17–19 — per-category excise tax on box15. */
  taxLines: LIQ774TaxLine[];
  /** Box 20 — total wine excise tax (sum of boxes 17–19). */
  box20_totalWineTax: number;
  /** Box 21 — late-filing penalty. */
  box21_latePenalty: number;
  /** Box 22 — mead gallons excluded from the commission base. */
  box22_meadGallons: number;
  /** Box 23 — WA Wine Commission assessment ($0.08/gal on Non-Fort + Fort box15). */
  box23_wineCommission: number;
  /** Box 24 — total due = box20 + box21 + box23. */
  box24_totalDue: number;
}

// ============================================
// Helpers
// ============================================

function roundGal(gal: number): number {
  return Math.round(gal);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Empty category-values accumulator. */
function emptyCategoryValues(): LIQ774CategoryValues {
  return { cider: 0, nonFortified: 0, fortified: 0, total: 0 };
}

/** Set the total field to the sum of the three category columns (rounded whole gal). */
function withTotal(v: {
  cider: number;
  nonFortified: number;
  fortified: number;
}): LIQ774CategoryValues {
  const cider = roundGal(v.cider);
  const nonFortified = roundGal(v.nonFortified);
  const fortified = roundGal(v.fortified);
  return { cider, nonFortified, fortified, total: cider + nonFortified + fortified };
}

/**
 * Sum a numeric bulk-section line across the TTB tax classes belonging to each
 * LIQ-774 category.
 */
function sumBulkLine(
  bulkByClass: Record<string, Partial<BulkWinesSection>> | undefined,
  line: keyof BulkWinesSection,
): { cider: number; nonFortified: number; fortified: number } {
  const out = { cider: 0, nonFortified: 0, fortified: 0 };
  for (const category of LIQ774_CATEGORIES) {
    for (const taxClass of LIQ774_TAX_CLASSES_BY_CATEGORY[category]) {
      const section = bulkByClass?.[taxClass];
      const value = section ? (section[line] as number | undefined) : undefined;
      if (typeof value === "number") out[category] += value;
    }
  }
  return out;
}

/** Sum a numeric bottled-section line across the tax classes for each category. */
function sumBottledLine(
  bottledByClass: Record<string, Partial<BottledWinesSection>> | undefined,
  line: keyof BottledWinesSection,
): { cider: number; nonFortified: number; fortified: number } {
  const out = { cider: 0, nonFortified: 0, fortified: 0 };
  for (const category of LIQ774_CATEGORIES) {
    for (const taxClass of LIQ774_TAX_CLASSES_BY_CATEGORY[category]) {
      const section = bottledByClass?.[taxClass];
      const value = section ? (section[line] as number | undefined) : undefined;
      if (typeof value === "number") out[category] += value;
    }
  }
  return out;
}

/** Read a channel field across categories (missing → 0). */
function channelField(
  channelSales: LIQ774ChannelSales,
  field: keyof LIQ774CategoryChannelSales,
): { cider: number; nonFortified: number; fortified: number } {
  const out = { cider: 0, nonFortified: 0, fortified: 0 };
  for (const category of LIQ774_CATEGORIES) {
    out[category] = channelSales.byCategory[category]?.[field] ?? 0;
  }
  return out;
}

function addCat(
  a: { cider: number; nonFortified: number; fortified: number },
  b: { cider: number; nonFortified: number; fortified: number },
): { cider: number; nonFortified: number; fortified: number } {
  return {
    cider: a.cider + b.cider,
    nonFortified: a.nonFortified + b.nonFortified,
    fortified: a.fortified + b.fortified,
  };
}

// ============================================
// Main derivation
// ============================================

/** The subset of the TTB form computeLIQ774 reads (kept narrow for testability). */
export type LIQ774TTBInput = Pick<
  TTBForm512017Data,
  "reportingPeriod" | "bulkWinesByTaxClass" | "bottledWinesByTaxClass"
>;

/**
 * Compute the WA LIQ-774 from the federal TTB form + channel sales.
 *
 * Box-1 note (docs/ttb-liq774-form-spec.md deviation): the spec's prose formula
 * for box 1 ("net production = add Section A lines 2–6,9,10,11; subtract
 * 16–23,29,30,24–28") CANNOT reproduce the filed 6,762 gal — those additions
 * alone total only ~5,629 gal, already below 6,762, so box 1 must include the
 * opening inventory (line 1) and must not net out removals. The only reading
 * consistent with the filed value is box 1 = total wine handled = Section A
 * line 12 (TOTAL available = opening + all inflows) summed per category. We
 * implement that; the residual ~11 gal vs filed is documented reconstruction
 * drift (FILED_2025 was adjusted post-filing for perry reclassification). The
 * spec doc's box-1 prose was corrected to match (Phase 7 C6).
 */
export function computeLIQ774(
  ttbForm: LIQ774TTBInput,
  channelSales: LIQ774ChannelSales,
  options: { identityToleranceGal?: number } = {},
): LIQ774Data {
  const bulk = ttbForm.bulkWinesByTaxClass as
    | Record<string, Partial<BulkWinesSection>>
    | undefined;
  const bottled = ttbForm.bottledWinesByTaxClass as
    | Record<string, Partial<BottledWinesSection>>
    | undefined;

  // --- Box 1: total net (handled) gallons = Section A line 12 (total available) ---
  const box1 = withTotal(sumBulkLine(bulk, "line12_total"));

  // --- Box 2: total removed at winery = Section B line 8 (taxpaid) + line 12 (export) ---
  const box2raw = addCat(
    sumBottledLine(bottled, "line8_removedTaxpaid"),
    sumBottledLine(bottled, "line12_export"),
  );
  const box2 = withTotal(box2raw);
  // Boxes 3–8 (federal-taxpaid-area & warehouse adjustments) are 0 here, so box 9 = box 2.
  const box9 = withTotal(box2raw);

  // --- Non-taxable removals (from channel sales) ---
  const box10 = withTotal(channelField(channelSales, "outOfStateGal"));
  const box11 = withTotal(channelField(channelSales, "waDistributorGal"));
  const box12 = withTotal(channelField(channelSales, "wslcbMilitaryExportGal"));

  // --- Taxable sales (from channel sales) ---
  const box13raw = channelField(channelSales, "retailGal");
  const box14raw = channelField(channelSales, "licenseeGal");
  const box13 = withTotal(box13raw);
  const box14 = withTotal(box14raw);
  const box15 = withTotal(addCat(box13raw, box14raw));

  // --- Box 16: (box11 + box12 + box15) must equal box 9 ---
  const box16 = withTotal(
    addCat(
      addCat(
        channelField(channelSales, "waDistributorGal"),
        channelField(channelSales, "wslcbMilitaryExportGal"),
      ),
      addCat(box13raw, box14raw),
    ),
  );

  // --- Identity: box16 ≡ box9 (3-state flag, never plugged) ---
  const toleranceGal = options.identityToleranceGal ?? LIQ774_IDENTITY_TOLERANCE_GAL;
  const variance = box16.total - box9.total;
  let state: LIQ774IdentityState = "match";
  if (variance > toleranceGal) state = "channelExceedsRemovals";
  else if (variance < -toleranceGal) state = "removalsExceedChannel";
  const identity: LIQ774Identity = {
    box9: box9.total,
    box16: box16.total,
    variance,
    state,
    toleranceGal,
  };

  // --- Tax (boxes 17–20): per-category excise on box15 taxable gallons ---
  const taxLines: LIQ774TaxLine[] = [
    {
      category: "cider",
      label: LIQ774_CATEGORY_LABELS.cider,
      taxableGallons: box15.cider,
      taxRate: LIQ774_CIDER_TAX_RATE_PER_GAL,
      tax: roundMoney(box15.cider * LIQ774_CIDER_TAX_RATE_PER_GAL),
    },
    {
      category: "nonFortified",
      label: LIQ774_CATEGORY_LABELS.nonFortified,
      taxableGallons: box15.nonFortified,
      taxRate: LIQ774_NON_FORTIFIED_TAX_RATE_PER_GAL,
      tax: roundMoney(box15.nonFortified * LIQ774_NON_FORTIFIED_TAX_RATE_PER_GAL),
    },
    {
      category: "fortified",
      label: LIQ774_CATEGORY_LABELS.fortified,
      taxableGallons: box15.fortified,
      taxRate: LIQ774_FORTIFIED_TAX_RATE_PER_GAL,
      tax: roundMoney(box15.fortified * LIQ774_FORTIFIED_TAX_RATE_PER_GAL),
    },
  ];
  const box20 = roundMoney(taxLines.reduce((sum, l) => sum + l.tax, 0));

  const box21 = roundMoney(channelSales.latePenalty ?? 0);
  const box22 = roundGal(channelSales.meadGallons ?? 0);

  // --- Box 23: WA Wine Commission = $0.08/gal on Non-Fortified + Fortified only ---
  const box23 = roundMoney(
    (box15.nonFortified + box15.fortified) * LIQ774_WINE_COMMISSION_RATE_PER_GAL,
  );

  const box24 = roundMoney(box20 + box21 + box23);

  return {
    reportingPeriod: ttbForm.reportingPeriod,
    box1_totalNetGallons: box1,
    box2_totalAtWinery: box2,
    box9_totalRemovals: box9,
    box10_outOfState: box10,
    box11_waDistributors: box11,
    box12_wslcbMilitaryExport: box12,
    box13_wineryRetail: box13,
    box14_waRetailLicensees: box14,
    box15_totalTaxable: box15,
    box16_reconciliation: box16,
    identity,
    taxLines,
    box20_totalWineTax: box20,
    box21_latePenalty: box21,
    box22_meadGallons: box22,
    box23_wineCommission: box23,
    box24_totalDue: box24,
  };
}

// Ensure emptyCategoryValues is retained for consumers building blank forms.
export { emptyCategoryValues as emptyLIQ774CategoryValues };
