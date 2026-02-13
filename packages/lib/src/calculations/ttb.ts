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
// TTB Classification Configuration
// ============================================

/** CO2 density factor: 1 volume CO2 = 0.1977 grams per 100ml at STP */
export const CO2_VOLUMES_TO_GRAMS_PER_100ML = 0.1977;

/** Convert CO2 volumes (1 vol = 1L CO2/L liquid) to grams per 100ml */
export function co2VolumesToGramsPer100ml(co2Volumes: number): number {
  return co2Volumes * CO2_VOLUMES_TO_GRAMS_PER_100ML;
}

/**
 * Configurable TTB classification thresholds, tax rates, and CBMA credits.
 * Stored in organizationSettings.ttbClassificationConfig as JSONB.
 * NULL in DB means use DEFAULT_TTB_CLASSIFICATION_CONFIG.
 */
export interface TTBClassificationConfig {
  thresholds: {
    hardCider: {
      /** Max ABV for hard cider classification (default 8.5%) */
      maxAbv: number;
      /** Min ABV for hard cider classification (default 0.5%) */
      minAbv: number;
      /** Max CO2 in grams per 100ml for hard cider (default 0.64) */
      maxCo2GramsPer100ml: number;
      /** Fruit sources that qualify for hard cider (default ["apple", "pear"]) */
      allowedFruitSources: string[];
    };
    /** Max CO2 in grams per 100ml for still wine classification (default 0.392) */
    stillWineMaxCo2GramsPer100ml: number;
    abvBrackets: {
      /** Max ABV for "not over 16%" category (default 16) */
      under16MaxAbv: number;
      /** Max ABV for "16-21%" category (default 21) */
      midRangeMaxAbv: number;
      /** Max ABV for "21-24%" category (default 24) */
      upperMaxAbv: number;
    };
  };
  taxRates: {
    /** $/gallon for hard cider (default 0.226) */
    hardCider: number;
    /** $/gallon for still wine ≤16% (default 1.07) */
    wineUnder16: number;
    /** $/gallon for still wine 16-21% (default 1.57) */
    wine16To21: number;
    /** $/gallon for still wine 21-24% (default 3.15) */
    wine21To24: number;
    /** $/gallon for artificially carbonated wine (default 3.30) */
    carbonatedWine: number;
    /** $/gallon for sparkling wine (default 3.40) */
    sparklingWine: number;
  };
  cbmaCredits: {
    /** Small producer credit per gallon (default 0.056) */
    smallProducerCreditPerGallon: number;
    /** Max gallons eligible for credit annually (default 30000) */
    creditLimitGallons: number;
  };
}

/** Default TTB classification config per 27 CFR 24.10 */
export const DEFAULT_TTB_CLASSIFICATION_CONFIG: TTBClassificationConfig = {
  thresholds: {
    hardCider: {
      maxAbv: 8.5,
      minAbv: 0.5,
      maxCo2GramsPer100ml: 0.64,
      allowedFruitSources: ["apple", "pear"],
    },
    stillWineMaxCo2GramsPer100ml: 0.392,
    abvBrackets: {
      under16MaxAbv: 16,
      midRangeMaxAbv: 21,
      upperMaxAbv: 24,
    },
  },
  taxRates: {
    hardCider: 0.226,
    wineUnder16: 1.07,
    wine16To21: 1.57,
    wine21To24: 3.15,
    carbonatedWine: 3.30,
    sparklingWine: 3.40,
  },
  cbmaCredits: {
    smallProducerCreditPerGallon: 0.056,
    creditLimitGallons: 30000,
  },
};

// ============================================
// Tax Class Mapping
// ============================================

/** TTB tax class identifiers used for Form 5120.17 reporting */
export const TTB_TAX_CLASSES = [
  "hardCider",
  "wineUnder16",
  "wine16To21",
  "wine21To24",
  "sparklingWine",
  "carbonatedWine",
  "appleBrandy",
  "grapeSpirits",
] as const;

export type TTBTaxClass = (typeof TTB_TAX_CLASSES)[number];

/**
 * Map a batch productType to its TTB tax class.
 *
 * Returns null for "juice" since juice is not a taxable product
 * and should be excluded from TTB reporting.
 *
 * @param productType - The batch productType value (from productTypeEnum)
 * @returns TTB tax class key, or null for juice
 */
export function productTypeToTaxClass(productType: string | null | undefined): TTBTaxClass | null {
  switch (productType) {
    case "cider":
      return "hardCider";
    case "perry":
      return "hardCider";
    case "pommeau":
      return "wine16To21";
    case "brandy":
      return "appleBrandy";
    case "wine":
      return "wineUnder16";
    case "juice":
      return null;
    case null:
    case undefined:
    case "other":
    default:
      return "hardCider";
  }
}

// ============================================
// Dynamic Tax Class Classification
// ============================================

/** Data needed from a batch for dynamic TTB classification */
export interface BatchClassificationData {
  /** Batch productType (cider, perry, pommeau, brandy, juice, etc.) */
  productType: string | null | undefined;
  /** ABV percentage — prefer actualAbv, fall back to estimatedAbv */
  abv: number | null | undefined;
  /** CO2 level in volumes from batchCarbonationOperations.finalCo2Volumes */
  co2Volumes: number | null | undefined;
  /** Carbonation method: "headspace"|"inline"|"stone"|"bottle_conditioning" */
  carbonationMethod: string | null | undefined;
}

/**
 * Determine TTB tax class from batch data and configurable thresholds.
 * Pure function — no DB calls.
 *
 * Classification priority (per 27 CFR 24.10, §24.331):
 * 1. brandy → appleBrandy
 * 2. juice → null (non-taxable)
 * 3. apple/pear fruit + ABV 0.5-8.5% + CO2 ≤ 0.64 g/100ml → hardCider
 * 4. CO2 > 0.392 g/100ml + natural fermentation → sparklingWine
 * 5. CO2 > 0.392 g/100ml + artificial injection → carbonatedWine
 * 6. ABV ≤ 16% → wineUnder16
 * 7. ABV 16-21% → wine16To21
 * 8. ABV 21-24% → wine21To24
 * 9. Fallback → productTypeToTaxClass()
 */
export function classifyBatchTaxClass(
  batch: BatchClassificationData,
  config: TTBClassificationConfig = DEFAULT_TTB_CLASSIFICATION_CONFIG,
): TTBTaxClass | null {
  const { productType, abv, co2Volumes, carbonationMethod } = batch;

  // 1. Brandy → appleBrandy
  if (productType === "brandy") return "appleBrandy";

  // 2. Juice → null (non-taxable)
  if (productType === "juice") return null;

  // Determine fruit source eligibility for hard cider
  const fruitSource =
    productType === "cider" ? "apple" :
    productType === "perry" ? "pear" :
    productType || "";
  const isHardCiderFruit = config.thresholds.hardCider.allowedFruitSources.includes(fruitSource);

  // Convert CO2 volumes to g/100ml (missing data = 0, i.e. still/uncarbonated)
  const co2GramsPer100ml = co2Volumes != null ? co2VolumesToGramsPer100ml(co2Volumes) : 0;

  // 3a. Hard cider shortcut: eligible fruit + null ABV + CO2 within limit
  // Null ABV means unmeasured (not zero alcohol). A cidery's cider/perry batch
  // without an ABV reading is almost certainly hard cider, not sparkling wine.
  // Without this, null ABV → effectiveAbv=0 → fails minAbv (0.5%) → falls through
  // to carbonated/sparkling wine at 14.6x the hard cider tax rate.
  if (
    abv == null &&
    isHardCiderFruit &&
    co2GramsPer100ml <= config.thresholds.hardCider.maxCo2GramsPer100ml
  ) {
    return "hardCider";
  }

  // 3a-ii. Pommeau shortcut: pommeau is always fortified wine (16-21%) by definition.
  // If ABV is null/missing, default to wine16To21 rather than wineUnder16 (effectiveAbv=0).
  if (abv == null && productType === "pommeau") {
    return "wine16To21";
  }

  const effectiveAbv = abv ?? 0;

  // 3b. Hard cider: eligible fruit + ABV in range + CO2 within limit
  if (
    isHardCiderFruit &&
    effectiveAbv >= config.thresholds.hardCider.minAbv &&
    effectiveAbv <= config.thresholds.hardCider.maxAbv &&
    co2GramsPer100ml <= config.thresholds.hardCider.maxCo2GramsPer100ml
  ) {
    return "hardCider";
  }

  // 4 & 5. Effervescent wine: CO2 above still wine threshold
  if (co2GramsPer100ml > config.thresholds.stillWineMaxCo2GramsPer100ml) {
    // bottle_conditioning = natural secondary fermentation → sparkling
    // all other methods (headspace, inline, stone) = artificially carbonated
    const isNaturalCarbonation = carbonationMethod === "bottle_conditioning";
    return isNaturalCarbonation ? "sparklingWine" : "carbonatedWine";
  }

  // 6-8. Still wine ABV brackets
  if (effectiveAbv <= config.thresholds.abvBrackets.under16MaxAbv) {
    return "wineUnder16";
  }
  if (effectiveAbv <= config.thresholds.abvBrackets.midRangeMaxAbv) {
    return "wine16To21";
  }
  if (effectiveAbv <= config.thresholds.abvBrackets.upperMaxAbv) {
    return "wine21To24";
  }

  // 9. Fallback for ABV above 24% or unexpected data
  return productTypeToTaxClass(productType);
}

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
  priorYearGallonsUsed: number = 0,
  config?: TTBClassificationConfig,
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

  const taxRate = config?.taxRates.hardCider ?? HARD_CIDER_TAX_RATE;
  const creditPerGallon = config?.cbmaCredits.smallProducerCreditPerGallon ?? SMALL_PRODUCER_CREDIT_PER_GALLON;
  const creditLimit = config?.cbmaCredits.creditLimitGallons ?? SMALL_PRODUCER_CREDIT_LIMIT_GALLONS;

  // Calculate gross tax
  const grossTax = taxableGallons * taxRate;

  // Calculate how many gallons are eligible for credit
  const remainingCreditGallons = Math.max(0, creditLimit - priorYearGallonsUsed);
  const creditEligibleGallons = Math.min(taxableGallons, remainingCreditGallons);

  // Calculate credit amount
  const smallProducerCredit = creditEligibleGallons * creditPerGallon;

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
 * Distillery operations tracking for cider/brandy separation
 */
export interface DistilleryOperations {
  /** Cider sent to distillery (DSP) in wine gallons */
  ciderSentToDsp: number;
  /** Number of shipments to DSP */
  ciderSentShipments: number;
  /** Brandy received from DSP in wine gallons */
  brandyReceived: number;
  /** Number of brandy returns */
  brandyReceivedReturns: number;
  /** Brandy used in cider production (fortification) in wine gallons */
  brandyUsedInCider: number;
  /** Brandy transfer details */
  brandyTransfers: BrandyTransfer[];
}

/**
 * Individual brandy transfer record
 */
export interface BrandyTransfer {
  /** Source brandy batch name */
  sourceBatch: string;
  /** Destination cider batch name */
  destinationBatch: string;
  /** Volume transferred in wine gallons */
  volumeGallons: number;
  /** Transfer date */
  transferredAt: Date;
}

/**
 * Cider and Brandy inventory breakdown
 */
export interface CiderBrandyInventory {
  /** Cider inventory */
  cider: {
    bulk: number;
    bottled: number;
    kegs: number;
    total: number;
  };
  /** Brandy inventory */
  brandy: {
    bulk: number;
    total: number;
  };
  /** Combined total */
  total: number;
}

/**
 * Cider/Brandy reconciliation
 */
export interface CiderBrandyReconciliation {
  /** Cider reconciliation */
  cider: {
    expectedEnding: number;
    actualEnding: number;
    discrepancy: number;
  };
  /** Brandy reconciliation */
  brandy: {
    expectedEnding: number;
    actualEnding: number;
    discrepancy: number;
    /** System-reported value from current_volume_liters (may have data integrity issues) */
    systemReported?: number;
    /** Difference between system-reported and calculated values */
    dataDiscrepancy?: number;
  };
  /** Total reconciliation */
  total: {
    expectedEnding: number;
    actualEnding: number;
    discrepancy: number;
  };
}

/**
 * Part I Section A - Bulk Wines (lines 1-32)
 * Matches official TTB F 5120.17 line structure exactly.
 * Column values in wine gallons.
 *
 * Balance equation: Line 12 (total available) = Line 32 (total accounted for)
 * where Line 32 = sum of removals (lines 13-30) + ending inventory (line 31)
 */
export interface BulkWinesSection {
  // --- AVAILABLE (lines 1-12) ---
  /** Line 1: ON HAND BEGINNING OF PERIOD */
  line1_onHandBeginning: number;
  /** Line 2: PRODUCED BY FERMENTATION */
  line2_produced: number;
  /** Line 3: PRODUCED BY SWEETENING */
  line3_sweetening: number;
  /** Line 4: PRODUCED BY ADDITION OF WINE SPIRITS */
  line4_wineSpirits: number;
  /** Line 5: PRODUCED BY BLENDING */
  line5_blending: number;
  /** Line 6: PRODUCED BY AMELIORATION */
  line6_amelioration: number;
  /** Line 7: RECEIVED IN BOND */
  line7_receivedInBond: number;
  /** Line 8: BOTTLED WINE DUMPED TO BULK */
  line8_dumpedToBulk: number;
  /** Line 9: INVENTORY GAINS */
  line9_inventoryGains: number;
  /** Line 10: (Write-in) */
  line10_writeIn: number;
  /** Line 10 write-in description */
  line10_writeInDesc?: string;
  // Line 11: blank/reserved
  /** Line 12: TOTAL (lines 1 through 11) */
  line12_total: number;

  // --- REMOVALS + ENDING (lines 13-32) ---
  /** Line 13: BOTTLED */
  line13_bottled: number;
  /** Line 14: REMOVED TAXPAID */
  line14_removedTaxpaid: number;
  /** Line 15: TRANSFERS IN BOND */
  line15_transfersInBond: number;
  /** Line 16: REMOVED FOR DISTILLING MATERIAL */
  line16_distillingMaterial: number;
  /** Line 17: REMOVED TO VINEGAR PLANT */
  line17_vinegarPlant: number;
  /** Line 18: USED FOR SWEETENING */
  line18_sweetening: number;
  /** Line 19: USED FOR ADDITION OF WINE SPIRITS */
  line19_wineSpirits: number;
  /** Line 20: USED FOR BLENDING */
  line20_blending: number;
  /** Line 21: USED FOR AMELIORATION */
  line21_amelioration: number;
  /** Line 22: USED FOR EFFERVESCENT WINE */
  line22_effervescent: number;
  /** Line 23: USED FOR TESTING */
  line23_testing: number;
  /** Line 24: (Write-in) */
  line24_writeIn1: number;
  /** Line 24 write-in description */
  line24_writeIn1Desc?: string;
  /** Line 25: (Write-in) */
  line25_writeIn2: number;
  /** Line 25 write-in description */
  line25_writeIn2Desc?: string;
  // Lines 26-28: blank/reserved
  /** Line 29: LOSSES (OTHER THAN INVENTORY) */
  line29_losses: number;
  /** Line 30: INVENTORY LOSSES */
  line30_inventoryLosses: number;
  /** Line 31: ON HAND END OF PERIOD */
  line31_onHandEnd: number;
  /** Line 32: TOTAL (lines 13 through 31) — must equal Line 12 */
  line32_total: number;
}

/**
 * Part I Section B - Bottled Wines (lines 1-21)
 * Matches official TTB F 5120.17 line structure exactly.
 * Column values in wine gallons.
 *
 * Balance equation: Line 7 (total available) = Line 21 (total accounted for)
 * where Line 21 = sum of removals (lines 8-19) + ending inventory (line 20)
 */
export interface BottledWinesSection {
  // --- AVAILABLE (lines 1-7) ---
  /** Line 1: ON HAND BEGINNING OF PERIOD */
  line1_onHandBeginning: number;
  /** Line 2: BOTTLED */
  line2_bottled: number;
  /** Line 3: RECEIVED IN BOND */
  line3_receivedInBond: number;
  /** Line 4: TAXPAID WINE RETURNED TO BOND */
  line4_taxpaidReturned: number;
  /** Line 5: (Write-in) */
  line5_writeIn: number;
  /** Line 5 write-in description */
  line5_writeInDesc?: string;
  // Line 6: blank/reserved
  /** Line 7: TOTAL (lines 1 through 6) */
  line7_total: number;

  // --- REMOVALS + ENDING (lines 8-21) ---
  /** Line 8: REMOVED TAXPAID */
  line8_removedTaxpaid: number;
  /** Line 9: TRANSFERRED IN BOND */
  line9_transferredInBond: number;
  /** Line 10: DUMPED TO BULK */
  line10_dumpedToBulk: number;
  /** Line 11: USED FOR TASTING */
  line11_tasting: number;
  /** Line 12: REMOVED FOR EXPORT */
  line12_export: number;
  /** Line 13: REMOVED FOR FAMILY USE */
  line13_familyUse: number;
  /** Line 14: USED FOR TESTING */
  line14_testing: number;
  /** Line 15: (Write-in) */
  line15_writeIn: number;
  /** Line 15 write-in description */
  line15_writeInDesc?: string;
  // Lines 16-17: blank/reserved
  /** Line 18: BREAKAGE */
  line18_breakage: number;
  /** Line 19: INVENTORY SHORTAGE */
  line19_inventoryShortage: number;
  /** Line 20: ON HAND END OF PERIOD */
  line20_onHandEnd: number;
  /** Line 21: TOTAL (lines 8 through 20) — must equal Line 7 */
  line21_total: number;
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

  /** Distillery operations (cider sent, brandy received) */
  distilleryOperations?: DistilleryOperations;

  /** Cider/Brandy separated inventory */
  ciderBrandyInventory?: CiderBrandyInventory;

  /** Cider/Brandy separated reconciliation */
  ciderBrandyReconciliation?: CiderBrandyReconciliation;

  /** Part I Section A - Bulk Wines by tax class (multi-column form) */
  bulkWinesByTaxClass?: Record<string, BulkWinesSection>;

  /** Part I Section B - Bottled Wines by tax class (multi-column form) */
  bottledWinesByTaxClass?: Record<string, BottledWinesSection>;

  /** Per-tax-class tax computation breakdown */
  taxComputationByClass?: Array<{
    taxClass: string;
    label: string;
    taxRate: number;
    taxableGallons: number;
    grossTax: number;
    smallProducerCredit: number;
    netTax: number;
  }>;
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
