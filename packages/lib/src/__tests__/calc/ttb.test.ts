import { describe, it, expect } from "vitest";
import {
  LITERS_PER_WINE_GALLON,
  WINE_GALLONS_PER_LITER,
  HARD_CIDER_TAX_RATE,
  SMALL_PRODUCER_CREDIT_PER_GALLON,
  SMALL_PRODUCER_CREDIT_LIMIT_GALLONS,
  EFFECTIVE_TAX_RATE,
  TTB_TAX_CLASSES,
  productTypeToTaxClass,
  litersToWineGallons,
  wineGallonsToLiters,
  mlToWineGallons,
  roundGallons,
  calculateHardCiderTax,
  calculatePeriodTax,
  calculateReconciliation,
  getPeriodDateRange,
  formatPeriodLabel,
} from "../../calculations/ttb";

// ============================================
// Constants Verification
// ============================================

describe("TTB Constants", () => {
  it("should have correct wine gallon conversion constants", () => {
    // 1 wine gallon = 3.78541 liters (US wine gallon)
    expect(LITERS_PER_WINE_GALLON).toBe(3.78541);

    // 1 liter = 0.264172 wine gallons
    expect(WINE_GALLONS_PER_LITER).toBe(0.264172);

    // Constants should be inverses of each other (within precision)
    expect(LITERS_PER_WINE_GALLON * WINE_GALLONS_PER_LITER).toBeCloseTo(1, 4);
  });

  it("should have correct tax rate constants", () => {
    // Hard cider tax rate: $0.226 per wine gallon
    expect(HARD_CIDER_TAX_RATE).toBe(0.226);

    // Small producer credit: $0.056 per wine gallon
    expect(SMALL_PRODUCER_CREDIT_PER_GALLON).toBe(0.056);

    // Credit limit: 30,000 gallons
    expect(SMALL_PRODUCER_CREDIT_LIMIT_GALLONS).toBe(30000);

    // Effective rate = base rate - credit
    expect(EFFECTIVE_TAX_RATE).toBeCloseTo(0.17, 10);
    expect(EFFECTIVE_TAX_RATE).toBe(HARD_CIDER_TAX_RATE - SMALL_PRODUCER_CREDIT_PER_GALLON);
  });

  it("should define all TTB tax classes", () => {
    expect(TTB_TAX_CLASSES).toEqual([
      "hardCider",
      "wineUnder16",
      "wine16To21",
      "wine21To24",
      "sparklingWine",
      "carbonatedWine",
      "appleBrandy",
      "grapeSpirits",
    ]);
    expect(TTB_TAX_CLASSES.length).toBe(8);
  });
});

// ============================================
// productTypeToTaxClass Mapping
// ============================================

describe("productTypeToTaxClass", () => {
  it("should map cider to hardCider", () => {
    expect(productTypeToTaxClass("cider")).toBe("hardCider");
  });

  it("should map perry to hardCider", () => {
    // Perry (pear cider) is taxed as hard cider
    expect(productTypeToTaxClass("perry")).toBe("hardCider");
  });

  it("should map pommeau to wine16To21", () => {
    // Pommeau is an apple aperitif typically 16-21% ABV
    expect(productTypeToTaxClass("pommeau")).toBe("wine16To21");
  });

  it("should map brandy to appleBrandy", () => {
    expect(productTypeToTaxClass("brandy")).toBe("appleBrandy");
  });

  it("should map wine to wineUnder16", () => {
    expect(productTypeToTaxClass("wine")).toBe("wineUnder16");
  });

  it("should return null for juice (not taxable)", () => {
    // Juice is not a taxable product and should be excluded from TTB reporting
    expect(productTypeToTaxClass("juice")).toBeNull();
  });

  it("should default to hardCider for null/undefined/other", () => {
    expect(productTypeToTaxClass(null)).toBe("hardCider");
    expect(productTypeToTaxClass(undefined)).toBe("hardCider");
    expect(productTypeToTaxClass("other")).toBe("hardCider");
  });

  it("should default to hardCider for unknown product types", () => {
    expect(productTypeToTaxClass("mead")).toBe("hardCider");
    expect(productTypeToTaxClass("unknown")).toBe("hardCider");
    expect(productTypeToTaxClass("")).toBe("hardCider");
  });

  it("should cover all known product types consistently", () => {
    // Every non-juice product type should return a non-null tax class
    const nonJuiceTypes = ["cider", "perry", "pommeau", "brandy", "wine", "other"];
    for (const type of nonJuiceTypes) {
      const result = productTypeToTaxClass(type);
      expect(result).not.toBeNull();
      expect(TTB_TAX_CLASSES).toContain(result);
    }
  });
});

// ============================================
// Volume Conversion Functions
// ============================================

describe("Volume Conversions", () => {
  describe("litersToWineGallons", () => {
    it("should convert typical cidery volumes", () => {
      // 1000 liters (standard tank) ~ 264.17 gallons
      expect(litersToWineGallons(1000)).toBeCloseTo(264.172, 2);

      // 200 liters (small batch) ~ 52.83 gallons
      expect(litersToWineGallons(200)).toBeCloseTo(52.8344, 2);

      // 3785.41 liters = ~1000 gallons
      expect(litersToWineGallons(3785.41)).toBeCloseTo(1000, 0);
    });

    it("should handle zero correctly", () => {
      expect(litersToWineGallons(0)).toBe(0);
    });

    it("should return 0 for negative inputs", () => {
      expect(litersToWineGallons(-1)).toBe(0);
      expect(litersToWineGallons(-100)).toBe(0);
      expect(litersToWineGallons(-0.001)).toBe(0);
    });

    it("should handle very small volumes", () => {
      // 1 liter = 0.264172 gallons
      expect(litersToWineGallons(1)).toBeCloseTo(0.264172, 5);

      // 0.1 liter = 0.0264172 gallons
      expect(litersToWineGallons(0.1)).toBeCloseTo(0.0264172, 6);
    });

    it("should handle very large volumes", () => {
      // 100,000 liters (large operation)
      expect(litersToWineGallons(100000)).toBeCloseTo(26417.2, 0);
    });
  });

  describe("wineGallonsToLiters", () => {
    it("should convert typical TTB reporting volumes", () => {
      // 1000 gallons ~ 3785.41 liters
      expect(wineGallonsToLiters(1000)).toBeCloseTo(3785.41, 0);

      // 264.17 gallons ~ 1000 liters
      expect(wineGallonsToLiters(264.172)).toBeCloseTo(1000, 0);
    });

    it("should handle zero correctly", () => {
      expect(wineGallonsToLiters(0)).toBe(0);
    });

    it("should return 0 for negative inputs", () => {
      expect(wineGallonsToLiters(-1)).toBe(0);
      expect(wineGallonsToLiters(-500)).toBe(0);
    });

    it("should handle 1 gallon", () => {
      expect(wineGallonsToLiters(1)).toBeCloseTo(3.78541, 4);
    });
  });

  describe("round-trip conversion accuracy", () => {
    it("should preserve volume through liters -> gallons -> liters", () => {
      const originalLiters = 500;
      const gallons = litersToWineGallons(originalLiters);
      const backToLiters = wineGallonsToLiters(gallons);
      // Allow small floating point drift
      expect(backToLiters).toBeCloseTo(originalLiters, 1);
    });

    it("should preserve volume through gallons -> liters -> gallons", () => {
      const originalGallons = 1000;
      const liters = wineGallonsToLiters(originalGallons);
      const backToGallons = litersToWineGallons(liters);
      expect(backToGallons).toBeCloseTo(originalGallons, 1);
    });
  });

  describe("mlToWineGallons", () => {
    it("should convert milliliters to wine gallons", () => {
      // 750ml bottle = ~0.198 gallons
      expect(mlToWineGallons(750)).toBeCloseTo(0.198129, 4);

      // 355ml can = ~0.0938 gallons
      expect(mlToWineGallons(355)).toBeCloseTo(0.093781, 4);

      // 1000ml = 1 liter = 0.264172 gallons
      expect(mlToWineGallons(1000)).toBeCloseTo(0.264172, 4);
    });

    it("should handle zero", () => {
      expect(mlToWineGallons(0)).toBe(0);
    });

    it("should handle negative inputs (delegates to litersToWineGallons)", () => {
      // -500ml => -0.5L => litersToWineGallons(-0.5) => 0
      expect(mlToWineGallons(-500)).toBe(0);
    });

    it("should handle a standard case of 473ml (US pint)", () => {
      expect(mlToWineGallons(473)).toBeCloseTo(0.124933, 4);
    });

    it("should handle a full keg (19,500ml / 19.5L)", () => {
      expect(mlToWineGallons(19500)).toBeCloseTo(litersToWineGallons(19.5), 6);
    });
  });

  describe("roundGallons", () => {
    it("should round to 3 decimal places", () => {
      expect(roundGallons(264.1724)).toBe(264.172);
      expect(roundGallons(264.1725)).toBe(264.173);
      expect(roundGallons(264.1726)).toBe(264.173);
    });

    it("should handle exact values", () => {
      expect(roundGallons(100)).toBe(100);
      expect(roundGallons(0)).toBe(0);
      expect(roundGallons(1.5)).toBe(1.5);
    });

    it("should handle negative values", () => {
      // Math.round rounds toward +infinity: Math.round(-0.5) = -0, Math.round(-1234.5) = -1234
      expect(roundGallons(-0.0005)).toBe(-0);
      expect(roundGallons(-1.2345)).toBe(-1.234); // -1234.5 rounds to -1234
      expect(roundGallons(-1.2346)).toBe(-1.235); // -1234.6 rounds to -1235
    });

    it("should handle very small values near zero", () => {
      expect(roundGallons(0.0001)).toBe(0);
      expect(roundGallons(0.0005)).toBe(0.001);
      expect(roundGallons(0.0004)).toBe(0);
    });
  });
});

// ============================================
// Tax Calculations
// ============================================

describe("Tax Calculations", () => {
  describe("calculateHardCiderTax", () => {
    it("should calculate tax for first batch of the year with full credit", () => {
      // 1,000 gallons, no prior usage
      const result = calculateHardCiderTax(1000);
      expect(result.taxableGallons).toBe(1000);
      expect(result.grossTax).toBe(226.0); // 1000 * 0.226
      expect(result.smallProducerCredit).toBe(56.0); // 1000 * 0.056
      expect(result.creditEligibleGallons).toBe(1000);
      expect(result.netTaxOwed).toBe(170.0); // 226 - 56
      expect(result.effectiveRate).toBe(0.17); // 0.226 - 0.056
    });

    it("should calculate tax when approaching credit limit", () => {
      // 5,000 gallons with 28,000 already used this year
      // Only 2,000 gallons still eligible for credit
      const result = calculateHardCiderTax(5000, 28000);
      expect(result.taxableGallons).toBe(5000);
      expect(result.grossTax).toBe(1130.0); // 5000 * 0.226
      expect(result.creditEligibleGallons).toBe(2000); // 30000 - 28000
      expect(result.smallProducerCredit).toBe(112.0); // 2000 * 0.056
      expect(result.netTaxOwed).toBe(1018.0); // 1130 - 112
    });

    it("should calculate tax when credit limit is fully exhausted", () => {
      // 1,000 gallons with 30,000 already used (no credit remaining)
      const result = calculateHardCiderTax(1000, 30000);
      expect(result.taxableGallons).toBe(1000);
      expect(result.grossTax).toBe(226.0);
      expect(result.creditEligibleGallons).toBe(0);
      expect(result.smallProducerCredit).toBe(0);
      expect(result.netTaxOwed).toBe(226.0);
      expect(result.effectiveRate).toBe(0.226);
    });

    it("should calculate tax when prior usage exceeds limit", () => {
      // Prior year gallons already past limit
      const result = calculateHardCiderTax(500, 35000);
      expect(result.creditEligibleGallons).toBe(0);
      expect(result.smallProducerCredit).toBe(0);
      expect(result.netTaxOwed).toBe(result.grossTax);
    });

    it("should handle zero gallons", () => {
      const result = calculateHardCiderTax(0);
      expect(result.taxableGallons).toBe(0);
      expect(result.grossTax).toBe(0);
      expect(result.smallProducerCredit).toBe(0);
      expect(result.creditEligibleGallons).toBe(0);
      expect(result.netTaxOwed).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it("should handle negative gallons", () => {
      const result = calculateHardCiderTax(-100);
      expect(result.taxableGallons).toBe(0);
      expect(result.grossTax).toBe(0);
      expect(result.smallProducerCredit).toBe(0);
      expect(result.creditEligibleGallons).toBe(0);
      expect(result.netTaxOwed).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it("should handle very small volumes", () => {
      // 0.5 gallons (~1.9 liters)
      const result = calculateHardCiderTax(0.5);
      expect(result.taxableGallons).toBe(0.5);
      expect(result.grossTax).toBe(0.11); // roundToTwo(0.5 * 0.226) = roundToTwo(0.113) = 0.11
      expect(result.smallProducerCredit).toBe(0.03); // roundToTwo(0.5 * 0.056) = roundToTwo(0.028) = 0.03
      // netTaxOwed = roundToTwo(0.113 - 0.028) = roundToTwo(0.085) = 0.09
      // (rounding of gross - credit happens on the raw values, not rounded intermediates)
      expect(result.netTaxOwed).toBe(0.09);
    });

    it("should handle exact credit limit boundary", () => {
      // Exactly 30,000 gallons with no prior usage
      const result = calculateHardCiderTax(30000, 0);
      expect(result.creditEligibleGallons).toBe(30000);
      expect(result.grossTax).toBe(6780.0); // 30000 * 0.226
      expect(result.smallProducerCredit).toBe(1680.0); // 30000 * 0.056
      expect(result.netTaxOwed).toBe(5100.0); // 6780 - 1680
    });

    it("should handle volume straddling credit limit", () => {
      // 35,000 gallons with no prior usage
      // First 30,000 get credit, last 5,000 do not
      const result = calculateHardCiderTax(35000, 0);
      expect(result.taxableGallons).toBe(35000);
      expect(result.grossTax).toBe(7910.0); // 35000 * 0.226
      expect(result.creditEligibleGallons).toBe(30000);
      expect(result.smallProducerCredit).toBe(1680.0); // 30000 * 0.056
      expect(result.netTaxOwed).toBe(6230.0); // 7910 - 1680
    });

    it("should round grossTax and netTaxOwed to 2 decimal places", () => {
      // 777 gallons * 0.226 = 175.602
      const result = calculateHardCiderTax(777);
      expect(result.grossTax).toBe(175.6); // roundToTwo(175.602)
      // 777 * 0.056 = 43.512
      expect(result.smallProducerCredit).toBe(43.51); // roundToTwo(43.512)
      expect(result.netTaxOwed).toBe(132.09); // roundToTwo(175.602 - 43.512 = 132.09)
    });

    it("should round effectiveRate to 4 decimal places", () => {
      // With partial credit, the effective rate is not a clean number
      const result = calculateHardCiderTax(5000, 28000);
      // netTax = 1018, taxable = 5000, rate = 0.2036
      expect(result.effectiveRate).toBe(0.2036);
    });
  });

  describe("calculatePeriodTax", () => {
    it("should delegate to calculateHardCiderTax", () => {
      const periodResult = calculatePeriodTax(1000, 0);
      const directResult = calculateHardCiderTax(1000, 0);
      expect(periodResult).toEqual(directResult);
    });

    it("should pass ytdTaxableGallons as priorYearGallonsUsed", () => {
      const periodResult = calculatePeriodTax(2000, 29000);
      const directResult = calculateHardCiderTax(2000, 29000);
      expect(periodResult).toEqual(directResult);
    });

    it("should default ytdTaxableGallons to 0", () => {
      const periodResult = calculatePeriodTax(500);
      const directResult = calculateHardCiderTax(500, 0);
      expect(periodResult).toEqual(directResult);
    });
  });
});

// ============================================
// Period Date Ranges
// ============================================

describe("getPeriodDateRange", () => {
  describe("monthly periods", () => {
    it("should return correct range for January", () => {
      const { startDate, endDate } = getPeriodDateRange("monthly", 2025, 1);
      expect(startDate.getFullYear()).toBe(2025);
      expect(startDate.getMonth()).toBe(0); // January = 0
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getFullYear()).toBe(2025);
      expect(endDate.getMonth()).toBe(0);
      expect(endDate.getDate()).toBe(31);
    });

    it("should return correct range for February (non-leap year)", () => {
      const { startDate, endDate } = getPeriodDateRange("monthly", 2025, 2);
      expect(startDate.getMonth()).toBe(1);
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(1);
      expect(endDate.getDate()).toBe(28);
    });

    it("should return correct range for February (leap year)", () => {
      const { startDate, endDate } = getPeriodDateRange("monthly", 2024, 2);
      expect(endDate.getDate()).toBe(29);
    });

    it("should return correct range for December", () => {
      const { startDate, endDate } = getPeriodDateRange("monthly", 2025, 12);
      expect(startDate.getMonth()).toBe(11); // December = 11
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(11);
      expect(endDate.getDate()).toBe(31);
    });

    it("should return correct range for June (30-day month)", () => {
      const { startDate, endDate } = getPeriodDateRange("monthly", 2025, 6);
      expect(startDate.getMonth()).toBe(5);
      expect(endDate.getMonth()).toBe(5);
      expect(endDate.getDate()).toBe(30);
    });

    it("should default to January when periodNumber is undefined", () => {
      const { startDate, endDate } = getPeriodDateRange("monthly", 2025);
      expect(startDate.getMonth()).toBe(0);
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(0);
      expect(endDate.getDate()).toBe(31);
    });
  });

  describe("quarterly periods", () => {
    it("should return correct range for Q1 (Jan-Mar)", () => {
      const { startDate, endDate } = getPeriodDateRange("quarterly", 2025, 1);
      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(2); // March
      expect(endDate.getDate()).toBe(31);
    });

    it("should return correct range for Q2 (Apr-Jun)", () => {
      const { startDate, endDate } = getPeriodDateRange("quarterly", 2025, 2);
      expect(startDate.getMonth()).toBe(3); // April
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(5); // June
      expect(endDate.getDate()).toBe(30);
    });

    it("should return correct range for Q3 (Jul-Sep)", () => {
      const { startDate, endDate } = getPeriodDateRange("quarterly", 2025, 3);
      expect(startDate.getMonth()).toBe(6); // July
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(8); // September
      expect(endDate.getDate()).toBe(30);
    });

    it("should return correct range for Q4 (Oct-Dec)", () => {
      const { startDate, endDate } = getPeriodDateRange("quarterly", 2025, 4);
      expect(startDate.getMonth()).toBe(9); // October
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(11); // December
      expect(endDate.getDate()).toBe(31);
    });

    it("should default to Q1 when periodNumber is undefined", () => {
      const { startDate, endDate } = getPeriodDateRange("quarterly", 2025);
      expect(startDate.getMonth()).toBe(0);
      expect(endDate.getMonth()).toBe(2);
    });
  });

  describe("annual periods", () => {
    it("should return Jan 1 to Dec 31", () => {
      const { startDate, endDate } = getPeriodDateRange("annual", 2025);
      expect(startDate.getMonth()).toBe(0);
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(11);
      expect(endDate.getDate()).toBe(31);
      expect(startDate.getFullYear()).toBe(2025);
      expect(endDate.getFullYear()).toBe(2025);
    });

    it("should ignore periodNumber for annual", () => {
      const withNumber = getPeriodDateRange("annual", 2025, 7);
      const withoutNumber = getPeriodDateRange("annual", 2025);
      expect(withNumber.startDate.getTime()).toBe(withoutNumber.startDate.getTime());
      expect(withNumber.endDate.getTime()).toBe(withoutNumber.endDate.getTime());
    });
  });
});

// ============================================
// formatPeriodLabel
// ============================================

describe("formatPeriodLabel", () => {
  it("should format monthly labels", () => {
    expect(formatPeriodLabel("monthly", 2025, 1)).toBe("January 2025");
    expect(formatPeriodLabel("monthly", 2025, 6)).toBe("June 2025");
    expect(formatPeriodLabel("monthly", 2025, 12)).toBe("December 2025");
  });

  it("should format quarterly labels", () => {
    expect(formatPeriodLabel("quarterly", 2025, 1)).toBe("Q1 2025");
    expect(formatPeriodLabel("quarterly", 2025, 2)).toBe("Q2 2025");
    expect(formatPeriodLabel("quarterly", 2025, 3)).toBe("Q3 2025");
    expect(formatPeriodLabel("quarterly", 2025, 4)).toBe("Q4 2025");
  });

  it("should format annual labels", () => {
    expect(formatPeriodLabel("annual", 2025)).toBe("2025");
    expect(formatPeriodLabel("annual", 2024)).toBe("2024");
  });

  it("should default to January/Q1 when periodNumber is undefined", () => {
    expect(formatPeriodLabel("monthly", 2025)).toBe("January 2025");
    expect(formatPeriodLabel("quarterly", 2025)).toBe("Q1 2025");
  });
});

// ============================================
// Reconciliation Formula
// ============================================

describe("calculateReconciliation", () => {
  it("should balance when books are correct", () => {
    // Beginning(100) + Produced(50) + Receipts(10) = 160
    // TaxPaid(80) + Other(5) + Ending(75) = 160
    const result = calculateReconciliation({
      beginningInventory: 100,
      wineProduced: 50,
      receipts: 10,
      taxPaidRemovals: 80,
      otherRemovals: 5,
      endingInventory: 75,
    });
    expect(result.totalAvailable).toBe(160);
    expect(result.totalAccountedFor).toBe(160);
    expect(result.variance).toBe(0);
    expect(result.balanced).toBe(true);
  });

  it("should detect positive variance (more available than accounted)", () => {
    // Available: 100 + 50 + 10 = 160
    // Accounted: 70 + 5 + 75 = 150
    // Variance: 10 (unaccounted product)
    const result = calculateReconciliation({
      beginningInventory: 100,
      wineProduced: 50,
      receipts: 10,
      taxPaidRemovals: 70,
      otherRemovals: 5,
      endingInventory: 75,
    });
    expect(result.totalAvailable).toBe(160);
    expect(result.totalAccountedFor).toBe(150);
    expect(result.variance).toBe(10);
    expect(result.balanced).toBe(false);
  });

  it("should detect negative variance (more accounted than available)", () => {
    // Available: 100 + 50 + 10 = 160
    // Accounted: 90 + 10 + 75 = 175
    // Variance: -15 (phantom product)
    const result = calculateReconciliation({
      beginningInventory: 100,
      wineProduced: 50,
      receipts: 10,
      taxPaidRemovals: 90,
      otherRemovals: 10,
      endingInventory: 75,
    });
    expect(result.variance).toBe(-15);
    expect(result.balanced).toBe(false);
  });

  it("should consider balanced when variance is within 0.1 gallons", () => {
    // Variance = 0.09 should be balanced (< 0.1 threshold)
    const result = calculateReconciliation({
      beginningInventory: 100,
      wineProduced: 50.09,
      receipts: 0,
      taxPaidRemovals: 50,
      otherRemovals: 0,
      endingInventory: 100,
    });
    expect(result.variance).toBeCloseTo(0.09, 2);
    expect(result.balanced).toBe(true);
  });

  it("should consider unbalanced when variance is exactly 0.1 gallons", () => {
    // Variance = 0.1 should NOT be balanced (threshold is < 0.1, not <=)
    const result = calculateReconciliation({
      beginningInventory: 100,
      wineProduced: 50.1,
      receipts: 0,
      taxPaidRemovals: 50,
      otherRemovals: 0,
      endingInventory: 100,
    });
    expect(result.variance).toBeCloseTo(0.1, 2);
    expect(result.balanced).toBe(false);
  });

  it("should handle all-zero inputs", () => {
    const result = calculateReconciliation({
      beginningInventory: 0,
      wineProduced: 0,
      receipts: 0,
      taxPaidRemovals: 0,
      otherRemovals: 0,
      endingInventory: 0,
    });
    expect(result.totalAvailable).toBe(0);
    expect(result.totalAccountedFor).toBe(0);
    expect(result.variance).toBe(0);
    expect(result.balanced).toBe(true);
  });

  it("should round totalAvailable and totalAccountedFor to 3 decimals", () => {
    const result = calculateReconciliation({
      beginningInventory: 100.1234,
      wineProduced: 50.5678,
      receipts: 10.9012,
      taxPaidRemovals: 80.3456,
      otherRemovals: 5.7891,
      endingInventory: 75.4567,
    });
    // totalAvailable = roundGallons(100.1234 + 50.5678 + 10.9012) = roundGallons(161.5924) = 161.592
    expect(result.totalAvailable).toBe(161.592);
    // totalAccountedFor = roundGallons(80.3456 + 5.7891 + 75.4567) = roundGallons(161.5914) = 161.591
    expect(result.totalAccountedFor).toBe(161.591);
    // variance = roundGallons(161.5924 - 161.5914) = roundGallons(0.001) = 0.001
    expect(result.variance).toBe(0.001);
    expect(result.balanced).toBe(true);
  });

  it("should handle a realistic cidery reporting period", () => {
    // Realistic scenario: small cidery, monthly report
    // Beginning: 500 gal bulk + 200 gal bottled = 700 gal
    // Produced: 300 gal from 2 batches
    // Receipts: 0 (no transfers in)
    // Tax-paid removals: 150 gal (sold at tasting room + wholesale)
    // Other removals: 10 gal (samples + losses)
    // Ending: 840 gal
    const result = calculateReconciliation({
      beginningInventory: 700,
      wineProduced: 300,
      receipts: 0,
      taxPaidRemovals: 150,
      otherRemovals: 10,
      endingInventory: 840,
    });
    expect(result.totalAvailable).toBe(1000); // 700 + 300 + 0
    expect(result.totalAccountedFor).toBe(1000); // 150 + 10 + 840
    expect(result.variance).toBe(0);
    expect(result.balanced).toBe(true);
  });
});

// ============================================
// Integration / Real-World Scenarios
// ============================================

describe("Real-World TTB Scenarios", () => {
  it("should calculate a complete monthly tax filing", () => {
    // Small cidery filing monthly:
    // - Removed 2,500 gallons with tax paid (all domestic sales)
    // - It's the first month of the year (no prior usage)
    const periodRange = getPeriodDateRange("monthly", 2025, 1);
    expect(periodRange.startDate.getMonth()).toBe(0);
    expect(periodRange.endDate.getDate()).toBe(31);

    const label = formatPeriodLabel("monthly", 2025, 1);
    expect(label).toBe("January 2025");

    const tax = calculatePeriodTax(2500, 0);
    expect(tax.taxableGallons).toBe(2500);
    expect(tax.grossTax).toBe(565.0); // 2500 * 0.226
    expect(tax.smallProducerCredit).toBe(140.0); // 2500 * 0.056
    expect(tax.netTaxOwed).toBe(425.0); // 565 - 140
    expect(tax.effectiveRate).toBe(0.17);
  });

  it("should calculate end-of-year filing after exceeding credit limit", () => {
    // December filing. Prior 11 months used 29,500 gallons of credit.
    // This month: 2,000 gallons removed
    // Only 500 gallons still eligible for credit
    const tax = calculatePeriodTax(2000, 29500);
    expect(tax.creditEligibleGallons).toBe(500);
    expect(tax.grossTax).toBe(452.0); // 2000 * 0.226
    expect(tax.smallProducerCredit).toBe(28.0); // 500 * 0.056
    expect(tax.netTaxOwed).toBe(424.0); // 452 - 28
  });

  it("should handle volume conversion in a typical bottling run", () => {
    // Cidery bottled 1,500 liters into 750ml bottles
    const gallons = litersToWineGallons(1500);
    const rounded = roundGallons(gallons);
    expect(rounded).toBeCloseTo(396.258, 2);

    // Verify: 1500L / 0.75L per bottle = 2000 bottles
    // 2000 bottles * 750ml = 1,500,000 ml
    const gallonsFromMl = mlToWineGallons(1500000);
    expect(gallonsFromMl).toBeCloseTo(gallons, 6);
  });

  it("should map all common cidery products to correct tax classes", () => {
    // A cidery producing multiple products for TTB reporting
    const products = [
      { type: "cider", expectedClass: "hardCider" },
      { type: "perry", expectedClass: "hardCider" },
      { type: "pommeau", expectedClass: "wine16To21" },
      { type: "brandy", expectedClass: "appleBrandy" },
      { type: "wine", expectedClass: "wineUnder16" },
      { type: "juice", expectedClass: null },
    ];

    for (const { type, expectedClass } of products) {
      expect(productTypeToTaxClass(type)).toBe(expectedClass);
    }
  });

  it("should reconcile a balanced quarterly report", () => {
    // Q1 report: beginning inventory, production, sales, ending inventory
    const beginningGallons = roundGallons(litersToWineGallons(2000)); // ~528.344
    const producedGallons = roundGallons(litersToWineGallons(5000)); // ~1320.860
    const taxPaidGallons = roundGallons(litersToWineGallons(3000)); // ~792.516
    const otherGallons = roundGallons(litersToWineGallons(200)); // ~52.834
    const endingGallons = roundGallons(
      beginningGallons + producedGallons - taxPaidGallons - otherGallons
    );

    const recon = calculateReconciliation({
      beginningInventory: beginningGallons,
      wineProduced: producedGallons,
      receipts: 0,
      taxPaidRemovals: taxPaidGallons,
      otherRemovals: otherGallons,
      endingInventory: endingGallons,
    });

    expect(recon.balanced).toBe(true);

    // Tax on the removals
    const tax = calculatePeriodTax(taxPaidGallons, 0);
    expect(tax.taxableGallons).toBe(taxPaidGallons);
    expect(tax.netTaxOwed).toBeGreaterThan(0);
    expect(tax.smallProducerCredit).toBeGreaterThan(0);
  });
});
