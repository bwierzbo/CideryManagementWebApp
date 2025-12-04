/**
 * TTB Form 5120.17 Calculations
 *
 * Utilities for calculating tax obligations and volume conversions
 * for TTB Wine Premises Operations reporting (hard cider).
 *
 * @see https://www.ttb.gov/forms/f512017.pdf
 */

// ============================================
// Constants
// ============================================

/** Liters per wine gallon (US) */
export const LITERS_PER_WINE_GALLON = 3.78541;

/** Wine gallons per liter */
export const WINE_GALLONS_PER_LITER = 0.264172;

/** Federal excise tax rate for hard cider under 8.5% ABV (per wine gallon) */
export const HARD_CIDER_TAX_RATE = 0.226;

/** Small producer credit per wine gallon (first 30,000 gallons annually) */
export const SMALL_PRODUCER_CREDIT_PER_GALLON = 0.056;

/** Maximum gallons eligible for small producer credit */
export const SMALL_PRODUCER_CREDIT_LIMIT_GALLONS = 30000;

/** Effective tax rate after small producer credit */
export const EFFECTIVE_TAX_RATE = HARD_CIDER_TAX_RATE - SMALL_PRODUCER_CREDIT_PER_GALLON; // $0.17

// ============================================
// Volume Conversions
// ============================================

/**
 * Convert liters to wine gallons.
 *
 * @param liters - Volume in liters
 * @returns Volume in wine gallons
 *
 * @example
 * litersToWineGallons(1000) // 264.17 wine gallons
 */
export function litersToWineGallons(liters: number): number {
  if (liters < 0) return 0;
  return liters * WINE_GALLONS_PER_LITER;
}

/**
 * Convert wine gallons to liters.
 *
 * @param gallons - Volume in wine gallons
 * @returns Volume in liters
 *
 * @example
 * wineGallonsToLiters(264.17) // ~1000 liters
 */
export function wineGallonsToLiters(gallons: number): number {
  if (gallons < 0) return 0;
  return gallons * LITERS_PER_WINE_GALLON;
}

/**
 * Convert milliliters to wine gallons.
 *
 * @param ml - Volume in milliliters
 * @returns Volume in wine gallons
 */
export function mlToWineGallons(ml: number): number {
  return litersToWineGallons(ml / 1000);
}

// ============================================
// Tax Calculations
// ============================================

/**
 * Tax calculation result
 */
export interface TaxCalculationResult {
  /** Taxable gallons */
  taxableGallons: number;
  /** Gross tax before credits */
  grossTax: number;
  /** Small producer credit amount */
  smallProducerCredit: number;
  /** Gallons eligible for credit */
  creditEligibleGallons: number;
  /** Net tax owed after credits */
  netTaxOwed: number;
  /** Effective tax rate per gallon */
  effectiveRate: number;
}

/**
 * Calculate federal excise tax for hard cider with small producer credit.
 *
 * The small producer credit applies to the first 30,000 gallons
 * removed during the calendar year.
 *
 * @param taxableGallons - Wine gallons subject to tax
 * @param priorYearGallonsUsed - Gallons already credited in the calendar year (default: 0)
 * @returns Tax calculation breakdown
 *
 * @example
 * // First batch of the year: 1,000 gallons
 * const tax = calculateHardCiderTax(1000);
 * // Returns:
 * // - grossTax: $226.00
 * // - smallProducerCredit: $56.00
 * // - netTaxOwed: $170.00
 * // - effectiveRate: $0.17/gallon
 */
export function calculateHardCiderTax(
  taxableGallons: number,
  priorYearGallonsUsed: number = 0
): TaxCalculationResult {
  if (taxableGallons <= 0) {
    return {
      taxableGallons: 0,
      grossTax: 0,
      smallProducerCredit: 0,
      creditEligibleGallons: 0,
      netTaxOwed: 0,
      effectiveRate: 0,
    };
  }

  // Calculate gross tax
  const grossTax = taxableGallons * HARD_CIDER_TAX_RATE;

  // Calculate how many gallons are eligible for credit
  const remainingCreditGallons = Math.max(
    0,
    SMALL_PRODUCER_CREDIT_LIMIT_GALLONS - priorYearGallonsUsed
  );
  const creditEligibleGallons = Math.min(taxableGallons, remainingCreditGallons);

  // Calculate credit amount
  const smallProducerCredit = creditEligibleGallons * SMALL_PRODUCER_CREDIT_PER_GALLON;

  // Calculate net tax
  const netTaxOwed = grossTax - smallProducerCredit;

  // Calculate effective rate
  const effectiveRate = taxableGallons > 0 ? netTaxOwed / taxableGallons : 0;

  return {
    taxableGallons,
    grossTax: roundToTwo(grossTax),
    smallProducerCredit: roundToTwo(smallProducerCredit),
    creditEligibleGallons,
    netTaxOwed: roundToTwo(netTaxOwed),
    effectiveRate: roundToFour(effectiveRate),
  };
}

/**
 * Calculate tax for a specific reporting period.
 *
 * @param taxPaidRemovalsGallons - Wine gallons removed with tax paid
 * @param ytdTaxableGallons - Year-to-date taxable gallons before this period
 * @returns Tax calculation for the period
 */
export function calculatePeriodTax(
  taxPaidRemovalsGallons: number,
  ytdTaxableGallons: number = 0
): TaxCalculationResult {
  return calculateHardCiderTax(taxPaidRemovalsGallons, ytdTaxableGallons);
}

// ============================================
// TTB Form Data Structures
// ============================================

/**
 * TTB Form 5120.17 reporting period info
 */
export interface TTBReportingPeriod {
  type: "monthly" | "quarterly" | "annual";
  startDate: Date;
  endDate: Date;
  year: number;
  month?: number;
  quarter?: number;
}

/**
 * Inventory breakdown (bulk vs bottled/packaged)
 */
export interface InventoryBreakdown {
  /** Wine gallons in bulk (tanks/barrels) */
  bulk: number;
  /** Wine gallons in finished packages (bottles/cans/kegs) */
  bottled: number;
  /** Total wine gallons */
  total: number;
}

/**
 * Tax-paid removals by sales channel
 */
export interface TaxPaidRemovals {
  /** Tasting room sales (wine gallons) */
  tastingRoom: number;
  /** Wholesale/distributor sales (wine gallons) */
  wholesale: number;
  /** Online/DTC shipping (wine gallons) */
  onlineDtc: number;
  /** Events/farmers markets (wine gallons) */
  events: number;
  /** Uncategorized removals (wine gallons) */
  uncategorized: number;
  /** Total tax-paid removals (wine gallons) */
  total: number;
}

/**
 * Other (non-tax-paid) removals
 */
export interface OtherRemovals {
  /** Samples/tastings (wine gallons) */
  samples: number;
  /** Breakage (wine gallons) */
  breakage: number;
  /** Losses during filtering/racking (wine gallons) */
  processLosses: number;
  /** Spoilage/dumped product (wine gallons) */
  spoilage: number;
  /** Total other removals (wine gallons) */
  total: number;
}

/**
 * Part I Section A - Bulk Wines (lines 1-32)
 * Hard Cider column (f) values in wine gallons
 */
export interface BulkWinesSection {
  /** Line 1: On hand first of period */
  line1_onHandFirst: number;
  /** Line 2: Produced by fermentation */
  line2_produced: number;
  /** Line 3: Produced by other processes */
  line3_otherProduction: number;
  /** Line 4: Received - bonded wine premises */
  line4_receivedBonded: number;
  /** Line 5: Received - customs custody */
  line5_receivedCustoms: number;
  /** Line 6: Received - returned after removal */
  line6_receivedReturned: number;
  /** Line 7: Received - by transfer in bond */
  line7_receivedTransfer: number;
  /** Line 8: Bottled wine dumped to bulk */
  line8_dumpedToBulk: number;
  /** Line 9: Wine transferred - from other wine classes */
  line9_transferredIn: number;
  /** Line 10: Withdrawn from fermenters */
  line10_withdrawnFermenters: number;
  /** Line 11: TOTAL (lines 1-10) */
  line11_total: number;
  /** Line 12: Bottled or packed (transferred to bottled wine storage) */
  line12_bottled: number;
  /** Line 13: Transferred - for export */
  line13_exportTransfer: number;
  /** Line 14: Transferred - to bonded wine premises */
  line14_bondedTransfer: number;
  /** Line 15: Transferred - to customs bonded warehouse */
  line15_customsTransfer: number;
  /** Line 16: Transferred - to foreign trade zone */
  line16_ftzTransfer: number;
  /** Line 17: Taxpaid removals */
  line17_taxpaid: number;
  /** Line 18: Tax-free removals - for use US */
  line18_taxFreeUS: number;
  /** Line 19: Tax-free removals - for export use */
  line19_taxFreeExport: number;
  /** Line 20: Wine transferred - to other wine tax classes */
  line20_transferredOut: number;
  /** Line 21: Used for distilling material or vinegar stock */
  line21_distillingMaterial: number;
  /** Line 22: Wine spirits added (winemaking) */
  line22_spiritsAdded: number;
  /** Line 23: Inventory losses */
  line23_inventoryLosses: number;
  /** Line 24: Destroyed */
  line24_destroyed: number;
  /** Line 25: Returned to bond */
  line25_returnedToBond: number;
  /** Line 26: Other (describe in remarks) */
  line26_other: number;
  /** Line 27: TOTAL (lines 12-26) */
  line27_total: number;
  /** Line 28: On hand - in fermenters */
  line28_onHandFermenters: number;
  /** Line 29: On hand - finished (not bottled) */
  line29_onHandFinished: number;
  /** Line 30: On hand - unfinished (other) */
  line30_onHandUnfinished: number;
  /** Line 31: In transit */
  line31_inTransit: number;
  /** Line 32: TOTAL on hand end of period (lines 28-31) */
  line32_totalOnHand: number;
}

/**
 * Part I Section B - Bottled Wines (lines 1-21)
 * Hard Cider column values in wine gallons
 */
export interface BottledWinesSection {
  /** Line 1: On hand first of period */
  line1_onHandFirst: number;
  /** Line 2: Bottled or packed (from bulk) */
  line2_bottled: number;
  /** Line 3: Received - bonded wine premises */
  line3_receivedBonded: number;
  /** Line 4: Received - customs custody */
  line4_receivedCustoms: number;
  /** Line 5: Received - returned after removal */
  line5_receivedReturned: number;
  /** Line 6: Received - by transfer in bond */
  line6_receivedTransfer: number;
  /** Line 7: TOTAL (lines 1-6) */
  line7_total: number;
  /** Line 8: Dumped to bulk */
  line8_dumpedToBulk: number;
  /** Line 9: Transferred - for export */
  line9_exportTransfer: number;
  /** Line 10: Transferred - to bonded wine premises */
  line10_bondedTransfer: number;
  /** Line 11: Transferred - to customs bonded warehouse */
  line11_customsTransfer: number;
  /** Line 12: Transferred - to foreign trade zone */
  line12_ftzTransfer: number;
  /** Line 13: Taxpaid removals */
  line13_taxpaid: number;
  /** Line 14: Tax-free removals - for use US */
  line14_taxFreeUS: number;
  /** Line 15: Tax-free removals - for export use */
  line15_taxFreeExport: number;
  /** Line 16: Inventory losses or shortages */
  line16_inventoryLosses: number;
  /** Line 17: Destroyed */
  line17_destroyed: number;
  /** Line 18: Returned to bond */
  line18_returnedToBond: number;
  /** Line 19: TOTAL (lines 8-18) */
  line19_total: number;
  /** Line 20: On hand end of period */
  line20_onHandEnd: number;
  /** Line 21: In transit */
  line21_inTransit: number;
}

/**
 * Part IV - Materials Received and Used
 */
export interface MaterialsSection {
  /** Apples received (pounds) */
  applesReceivedLbs: number;
  /** Apples used (pounds) */
  applesUsedLbs: number;
  /** Juice/cider from apples (gallons) */
  appleJuiceGallons: number;
  /** Other fruit/berries received (pounds) */
  otherFruitReceivedLbs: number;
  /** Other fruit/berries used (pounds) */
  otherFruitUsedLbs: number;
  /** Sugar received (pounds) */
  sugarReceivedLbs: number;
  /** Sugar used (pounds) */
  sugarUsedLbs: number;
  /** Honey received (pounds) */
  honeyReceivedLbs: number;
  /** Honey used (pounds) */
  honeyUsedLbs: number;
  /** Other materials description */
  otherMaterialsDescription?: string;
  /** Other materials received */
  otherMaterialsReceived?: number;
  /** Other materials used */
  otherMaterialsUsed?: number;
}

/**
 * Part VII - In Fermenters End of Period
 */
export interface FermentersSection {
  /** Gallons of wine in fermenters */
  gallonsInFermenters: number;
}

/**
 * Complete TTB Form 5120.17 data structure
 */
export interface TTBForm512017Data {
  /** Reporting period information */
  reportingPeriod: TTBReportingPeriod;

  /** Part I Section A - Bulk Wines */
  bulkWines: BulkWinesSection;

  /** Part I Section B - Bottled Wines */
  bottledWines: BottledWinesSection;

  /** Part IV - Materials Received and Used */
  materials: MaterialsSection;

  /** Part VII - In Fermenters End of Period */
  fermenters: FermentersSection;

  /** Part I - Beginning Inventory (legacy - for backwards compat) */
  beginningInventory: InventoryBreakdown;

  /** Part II - Wine/Cider Produced (legacy) */
  wineProduced: {
    /** Wine gallons produced this period */
    total: number;
    /** Breakdown by batch if available */
    byBatch?: Array<{ batchId: string; name: string; gallons: number }>;
  };

  /** Part III - Receipts (wine received from other premises) */
  receipts: {
    /** Wine gallons received */
    total: number;
  };

  /** Part IV - Tax-Paid Removals (legacy) */
  taxPaidRemovals: TaxPaidRemovals;

  /** Part V - Other Removals (legacy) */
  otherRemovals: OtherRemovals;

  /** Part VI - Ending Inventory (legacy) */
  endingInventory: InventoryBreakdown;

  /** Tax Summary */
  taxSummary: TaxCalculationResult;

  /** Inventory reconciliation check */
  reconciliation: {
    /** Beginning + Produced + Receipts */
    totalAvailable: number;
    /** Tax-Paid + Other Removals + Ending */
    totalAccountedFor: number;
    /** Difference (should be ~0) */
    variance: number;
    /** Whether the books balance */
    balanced: boolean;
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Round to 2 decimal places (currency)
 */
function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Round to 4 decimal places (rates)
 */
function roundToFour(num: number): number {
  return Math.round(num * 10000) / 10000;
}

/**
 * Round to 3 decimal places (gallons)
 */
export function roundGallons(gallons: number): number {
  return Math.round(gallons * 1000) / 1000;
}

/**
 * Calculate inventory reconciliation.
 *
 * The formula should balance:
 * Beginning Inventory + Production + Receipts =
 *   Tax-Paid Removals + Other Removals + Ending Inventory
 *
 * @param data - TTB form data
 * @returns Reconciliation result
 */
export function calculateReconciliation(data: {
  beginningInventory: number;
  wineProduced: number;
  receipts: number;
  taxPaidRemovals: number;
  otherRemovals: number;
  endingInventory: number;
}): { totalAvailable: number; totalAccountedFor: number; variance: number; balanced: boolean } {
  const totalAvailable =
    data.beginningInventory + data.wineProduced + data.receipts;

  const totalAccountedFor =
    data.taxPaidRemovals + data.otherRemovals + data.endingInventory;

  const variance = roundGallons(totalAvailable - totalAccountedFor);

  // Allow small variance due to rounding (0.01 gallons = ~38ml)
  const balanced = Math.abs(variance) < 0.1;

  return {
    totalAvailable: roundGallons(totalAvailable),
    totalAccountedFor: roundGallons(totalAccountedFor),
    variance,
    balanced,
  };
}

/**
 * Get period date range for TTB reporting.
 *
 * @param periodType - monthly, quarterly, or annual
 * @param year - Year
 * @param periodNumber - Month (1-12) or Quarter (1-4), ignored for annual
 * @returns Start and end dates for the period
 */
export function getPeriodDateRange(
  periodType: "monthly" | "quarterly" | "annual",
  year: number,
  periodNumber?: number
): { startDate: Date; endDate: Date } {
  let startDate: Date;
  let endDate: Date;

  switch (periodType) {
    case "monthly":
      const month = (periodNumber || 1) - 1; // 0-indexed
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0); // Last day of month
      break;

    case "quarterly":
      const quarter = periodNumber || 1;
      const startMonth = (quarter - 1) * 3;
      startDate = new Date(year, startMonth, 1);
      endDate = new Date(year, startMonth + 3, 0); // Last day of quarter
      break;

    case "annual":
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      break;
  }

  return { startDate, endDate };
}

/**
 * Format period for display.
 *
 * @param periodType - monthly, quarterly, or annual
 * @param year - Year
 * @param periodNumber - Month or quarter number
 * @returns Formatted period string
 */
export function formatPeriodLabel(
  periodType: "monthly" | "quarterly" | "annual",
  year: number,
  periodNumber?: number
): string {
  switch (periodType) {
    case "monthly":
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return `${monthNames[(periodNumber || 1) - 1]} ${year}`;

    case "quarterly":
      return `Q${periodNumber || 1} ${year}`;

    case "annual":
      return `${year}`;
  }
}
