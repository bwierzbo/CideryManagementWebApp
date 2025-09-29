import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercentage,
  roundFinancial,
  calculateWeightedAverage,
  calculateStandardDeviation,
  calculateCoefficientOfVariation,
  calculateMedian,
  calculatePercentile,
  calculateCagr,
  isFinanciallyEqual,
  parseFinancialAmount,
  calculateRoi,
  calculateBreakEvenUnits,
} from "../../calc/financial";
import { calculateGrossMargin, calculateMarkup } from "../../calc/cogs";

describe("Financial Utilities", () => {
  describe("formatCurrency", () => {
    it("should format USD currency correctly", () => {
      expect(formatCurrency(123.45)).toBe("$123.45");
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(0)).toBe("$0.00");
      expect(formatCurrency(0.99)).toBe("$0.99");
    });

    it("should format different currencies", () => {
      expect(formatCurrency(123.45, "EUR")).toContain("123.45");
      expect(formatCurrency(123.45, "GBP")).toContain("123.45");
      expect(formatCurrency(123.45, "CAD")).toContain("123.45");
    });

    it("should handle negative amounts", () => {
      const formatted = formatCurrency(-123.45);
      expect(formatted).toContain("123.45");
      expect(formatted).toContain("-");
    });

    it("should always show 2 decimal places", () => {
      expect(formatCurrency(100)).toBe("$100.00");
      expect(formatCurrency(100.1)).toBe("$100.10");
      expect(formatCurrency(100.123)).toBe("$100.12");
    });

    it("should handle large amounts", () => {
      expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
    });

    it("should throw error for non-finite amounts", () => {
      expect(() => formatCurrency(Infinity)).toThrow(
        "Amount must be a finite number",
      );
      expect(() => formatCurrency(NaN)).toThrow(
        "Amount must be a finite number",
      );
    });
  });

  describe("formatPercentage", () => {
    it("should format percentages with default 2 decimal places", () => {
      expect(formatPercentage(15.5)).toBe("15.50%");
      expect(formatPercentage(100)).toBe("100.00%");
      expect(formatPercentage(0.5)).toBe("0.50%");
    });

    it("should format with custom decimal places", () => {
      expect(formatPercentage(15.5, 0)).toBe("16%");
      expect(formatPercentage(15.5, 1)).toBe("15.5%");
      expect(formatPercentage(15.5, 3)).toBe("15.500%");
    });

    it("should handle negative percentages", () => {
      expect(formatPercentage(-10.5)).toBe("-10.50%");
    });

    it("should handle zero", () => {
      expect(formatPercentage(0)).toBe("0.00%");
    });

    it("should throw error for invalid decimal places", () => {
      expect(() => formatPercentage(15.5, -1)).toThrow(
        "Decimal places must be between 0 and 10",
      );
      expect(() => formatPercentage(15.5, 11)).toThrow(
        "Decimal places must be between 0 and 10",
      );
    });

    it("should throw error for non-finite values", () => {
      expect(() => formatPercentage(Infinity)).toThrow(
        "Percentage value must be a finite number",
      );
    });
  });

  describe("roundFinancial", () => {
    it("should round to 2 decimal places by default", () => {
      expect(roundFinancial(123.456)).toBe(123.46);
      expect(roundFinancial(123.454)).toBe(123.45);
      expect(roundFinancial(123.455)).toBe(123.46); // Banker's rounding
    });

    it("should round to custom decimal places", () => {
      expect(roundFinancial(123.456, 0)).toBe(123);
      expect(roundFinancial(123.456, 1)).toBe(123.5);
      expect(roundFinancial(123.456, 3)).toBe(123.456);
      expect(roundFinancial(123.456, 4)).toBe(123.456);
    });

    it("should handle negative amounts", () => {
      expect(roundFinancial(-123.456)).toBe(-123.46);
    });

    it("should handle zero", () => {
      expect(roundFinancial(0)).toBe(0);
    });

    it("should throw error for invalid decimal places", () => {
      expect(() => roundFinancial(123.45, -1)).toThrow(
        "Decimal places must be between 0 and 10",
      );
    });

    it("should throw error for non-finite amounts", () => {
      expect(() => roundFinancial(Infinity)).toThrow(
        "Amount must be a finite number",
      );
    });
  });

  describe("calculateWeightedAverage", () => {
    it("should calculate weighted average correctly", () => {
      const values = [
        { value: 10, weight: 2 },
        { value: 20, weight: 3 },
        { value: 30, weight: 5 },
      ];

      // (10*2 + 20*3 + 30*5) / (2+3+5) = 230/10 = 23
      expect(calculateWeightedAverage(values)).toBe(23);
    });

    it("should handle single value", () => {
      const values = [{ value: 15.5, weight: 1 }];
      expect(calculateWeightedAverage(values)).toBe(15.5);
    });

    it("should handle equal weights", () => {
      const values = [
        { value: 10, weight: 1 },
        { value: 20, weight: 1 },
        { value: 30, weight: 1 },
      ];

      expect(calculateWeightedAverage(values)).toBe(20); // Simple average
    });

    it("should handle zero weights correctly", () => {
      const values = [
        { value: 10, weight: 0 },
        { value: 20, weight: 5 },
        { value: 30, weight: 0 },
      ];

      expect(calculateWeightedAverage(values)).toBe(20); // Only middle value counts
    });

    it("should round to 4 decimal places", () => {
      const values = [
        { value: 10.33333, weight: 1 },
        { value: 20.66666, weight: 2 },
      ];

      const result = calculateWeightedAverage(values);
      const decimalPlaces = result.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it("should throw error for empty array", () => {
      expect(() => calculateWeightedAverage([])).toThrow(
        "At least one value is required for weighted average",
      );
    });

    it("should throw error for non-finite values", () => {
      const invalidValues = [{ value: Infinity, weight: 1 }];
      expect(() => calculateWeightedAverage(invalidValues)).toThrow(
        "All values and weights must be finite numbers",
      );
    });

    it("should throw error for negative weights", () => {
      const invalidValues = [{ value: 10, weight: -1 }];
      expect(() => calculateWeightedAverage(invalidValues)).toThrow(
        "Weights must be non-negative",
      );
    });

    it("should throw error when all weights are zero", () => {
      const values = [
        { value: 10, weight: 0 },
        { value: 20, weight: 0 },
      ];

      expect(() => calculateWeightedAverage(values)).toThrow(
        "Total weight cannot be zero",
      );
    });
  });

  describe("calculateStandardDeviation", () => {
    it("should calculate standard deviation correctly", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = calculateStandardDeviation(values);

      expect(stdDev).toBeCloseTo(2.138, 3); // Known result
    });

    it("should return zero for single value", () => {
      expect(calculateStandardDeviation([5])).toBe(0);
    });

    it("should handle identical values", () => {
      expect(calculateStandardDeviation([5, 5, 5, 5])).toBe(0);
    });

    it("should handle negative values", () => {
      const stdDev = calculateStandardDeviation([-2, -1, 0, 1, 2]);
      expect(stdDev).toBeGreaterThan(0);
    });

    it("should round to 4 decimal places", () => {
      const values = [1, 2, 3, 4, 5];
      const result = calculateStandardDeviation(values);
      const decimalPlaces = result.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it("should throw error for empty array", () => {
      expect(() => calculateStandardDeviation([])).toThrow(
        "At least one value is required for standard deviation",
      );
    });

    it("should throw error for non-finite values", () => {
      expect(() => calculateStandardDeviation([1, 2, Infinity])).toThrow(
        "All values must be finite numbers",
      );
    });
  });

  describe("calculateCoefficientOfVariation", () => {
    it("should calculate CV correctly", () => {
      const values = [10, 12, 14, 16, 18]; // Mean = 14, StdDev ≈ 3.16
      const cv = calculateCoefficientOfVariation(values);

      expect(cv).toBeCloseTo(22.58, 1); // 3.16/14 * 100
    });

    it("should handle low variability", () => {
      const values = [100, 100.1, 100.2, 99.9, 99.8];
      const cv = calculateCoefficientOfVariation(values);

      expect(cv).toBeLessThan(1); // Very low variability
    });

    it("should throw error for zero mean", () => {
      const values = [-1, 0, 1];
      expect(() => calculateCoefficientOfVariation(values)).toThrow(
        "Cannot calculate coefficient of variation when mean is zero",
      );
    });

    it("should handle negative mean correctly", () => {
      const values = [-10, -12, -14, -16, -18];
      const cv = calculateCoefficientOfVariation(values);

      expect(cv).toBeCloseTo(22.58, 1); // Same CV as positive version
    });
  });

  describe("calculateMedian", () => {
    it("should calculate median for odd number of values", () => {
      expect(calculateMedian([1, 3, 5, 7, 9])).toBe(5);
      expect(calculateMedian([9, 1, 5, 3, 7])).toBe(5); // Order shouldn't matter
    });

    it("should calculate median for even number of values", () => {
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
      expect(calculateMedian([4, 1, 3, 2])).toBe(2.5); // Order shouldn't matter
    });

    it("should handle single value", () => {
      expect(calculateMedian([42])).toBe(42);
    });

    it("should handle duplicate values", () => {
      expect(calculateMedian([1, 2, 2, 2, 3])).toBe(2);
      expect(calculateMedian([1, 2, 2, 3])).toBe(2);
    });

    it("should handle negative values", () => {
      expect(calculateMedian([-5, -1, 0, 1, 5])).toBe(0);
    });

    it("should round result to 4 decimal places for even counts", () => {
      const result = calculateMedian([1.33333, 2.66666]);
      const decimalPlaces = result.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it("should throw error for empty array", () => {
      expect(() => calculateMedian([])).toThrow(
        "At least one value is required for median calculation",
      );
    });

    it("should throw error for non-finite values", () => {
      expect(() => calculateMedian([1, 2, Infinity])).toThrow(
        "All values must be finite numbers",
      );
    });
  });

  describe("calculatePercentile", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it("should calculate common percentiles correctly", () => {
      expect(calculatePercentile(values, 0)).toBe(1); // Min
      expect(calculatePercentile(values, 25)).toBe(3.25); // Q1
      expect(calculatePercentile(values, 50)).toBe(5.5); // Median
      expect(calculatePercentile(values, 75)).toBe(7.75); // Q3
      expect(calculatePercentile(values, 100)).toBe(10); // Max
    });

    it("should handle percentiles requiring interpolation", () => {
      const result = calculatePercentile([1, 2, 3, 4], 33.33);
      expect(result).toBeGreaterThan(1);
      expect(result).toBeLessThan(3);
    });

    it("should handle single value", () => {
      expect(calculatePercentile([42], 0)).toBe(42);
      expect(calculatePercentile([42], 50)).toBe(42);
      expect(calculatePercentile([42], 100)).toBe(42);
    });

    it("should handle duplicate values", () => {
      expect(calculatePercentile([1, 1, 1, 1], 50)).toBe(1);
    });

    it("should round to 4 decimal places", () => {
      const result = calculatePercentile([1.33333, 2.66666, 3.99999], 66.66);
      const decimalPlaces = result.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it("should throw error for invalid percentile", () => {
      expect(() => calculatePercentile(values, -1)).toThrow(
        "Percentile must be between 0 and 100",
      );
      expect(() => calculatePercentile(values, 101)).toThrow(
        "Percentile must be between 0 and 100",
      );
    });

    it("should throw error for empty array", () => {
      expect(() => calculatePercentile([], 50)).toThrow(
        "At least one value is required for percentile calculation",
      );
    });
  });

  describe("calculateCagr", () => {
    it("should calculate CAGR correctly", () => {
      // From $100 to $200 over 5 years = 14.87% CAGR
      const cagr = calculateCagr(100, 200, 5);
      expect(cagr).toBeCloseTo(14.87, 1);
    });

    it("should handle single period", () => {
      const cagr = calculateCagr(100, 120, 1);
      expect(cagr).toBe(20); // 20% growth in 1 period
    });

    it("should handle decline (negative CAGR)", () => {
      const cagr = calculateCagr(200, 100, 5);
      expect(cagr).toBeCloseTo(-12.94, 1);
    });

    it("should handle no change", () => {
      const cagr = calculateCagr(100, 100, 5);
      expect(cagr).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      const cagr = calculateCagr(123.456, 234.567, 3.14159);
      const decimalPlaces = cagr.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it("should throw error for invalid beginning value", () => {
      expect(() => calculateCagr(0, 100, 5)).toThrow(
        "Beginning value must be positive",
      );
      expect(() => calculateCagr(-100, 200, 5)).toThrow(
        "Beginning value must be positive",
      );
    });

    it("should throw error for invalid ending value", () => {
      expect(() => calculateCagr(100, 0, 5)).toThrow(
        "Ending value must be positive",
      );
    });

    it("should throw error for invalid periods", () => {
      expect(() => calculateCagr(100, 200, 0)).toThrow(
        "Number of periods must be positive",
      );
    });
  });

  describe("isFinanciallyEqual", () => {
    it("should return true for equal amounts", () => {
      expect(isFinanciallyEqual(10.0, 10.0)).toBe(true);
    });

    it("should return true for amounts within default tolerance", () => {
      expect(isFinanciallyEqual(10.0, 10.005)).toBe(true); // Within penny
      expect(isFinanciallyEqual(10.0, 9.995)).toBe(true); // Within penny
    });

    it("should return false for amounts outside default tolerance", () => {
      expect(isFinanciallyEqual(10.0, 10.02)).toBe(false); // 2 cents difference
      expect(isFinanciallyEqual(10.0, 9.98)).toBe(false); // 2 cents difference
    });

    it("should respect custom tolerance", () => {
      expect(isFinanciallyEqual(10.0, 10.05, 0.1)).toBe(true); // Within 10 cents
      expect(isFinanciallyEqual(10.0, 10.15, 0.1)).toBe(false); // Outside 10 cents
    });

    it("should handle zero amounts", () => {
      expect(isFinanciallyEqual(0, 0)).toBe(true);
      expect(isFinanciallyEqual(0, 0.005)).toBe(true);
      expect(isFinanciallyEqual(0, 0.02)).toBe(false);
    });

    it("should throw error for non-finite amounts", () => {
      expect(() => isFinanciallyEqual(Infinity, 10)).toThrow(
        "Amounts must be finite numbers",
      );
    });

    it("should throw error for negative tolerance", () => {
      expect(() => isFinanciallyEqual(10, 10, -0.01)).toThrow(
        "Tolerance must be non-negative",
      );
    });
  });

  describe("parseFinancialAmount", () => {
    it("should parse numeric values", () => {
      expect(parseFinancialAmount(123.45)).toBe(123.45);
      expect(parseFinancialAmount(0)).toBe(0);
    });

    it("should parse string values", () => {
      expect(parseFinancialAmount("123.45")).toBe(123.45);
      expect(parseFinancialAmount("0")).toBe(0);
    });

    it("should handle currency formatting in strings", () => {
      expect(parseFinancialAmount("$123.45")).toBe(123.45);
      expect(parseFinancialAmount("$1,234.56")).toBe(1234.56);
      expect(parseFinancialAmount("$ 123.45 ")).toBe(123.45);
    });

    it("should handle negative values", () => {
      expect(parseFinancialAmount("-123.45")).toBe(-123.45);
      expect(parseFinancialAmount("$-123.45")).toBe(-123.45);
    });

    it("should use field name in error messages", () => {
      expect(() => parseFinancialAmount("invalid", "price")).toThrow(
        "price must be a valid number",
      );
    });

    it("should throw error for empty strings", () => {
      expect(() => parseFinancialAmount("")).toThrow("amount cannot be empty");
      expect(() => parseFinancialAmount("$ ")).toThrow(
        "amount cannot be empty",
      );
    });

    it("should throw error for non-finite numbers", () => {
      expect(() => parseFinancialAmount(Infinity)).toThrow(
        "amount must be a finite number",
      );
    });

    it("should throw error for invalid types", () => {
      expect(() => parseFinancialAmount(null as any)).toThrow(
        "amount must be a string or number",
      );
    });
  });

  describe("calculateRoi", () => {
    it("should calculate positive ROI correctly", () => {
      const roi = calculateRoi(500, 1000); // $500 gain on $1000 investment = 50%
      expect(roi).toBe(50);
    });

    it("should calculate negative ROI (loss)", () => {
      const roi = calculateRoi(-200, 1000); // $200 loss on $1000 investment = -20%
      expect(roi).toBe(-20);
    });

    it("should handle zero gain", () => {
      const roi = calculateRoi(0, 1000);
      expect(roi).toBe(0);
    });

    it("should handle negative investment cost", () => {
      const roi = calculateRoi(500, -1000); // Treats as $1000 absolute cost
      expect(roi).toBe(50);
    });

    it("should round to 2 decimal places", () => {
      const roi = calculateRoi(333.33, 999.99);
      const decimalPlaces = roi.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it("should throw error for zero investment cost", () => {
      expect(() => calculateRoi(100, 0)).toThrow(
        "Investment cost cannot be zero",
      );
    });

    it("should throw error for non-finite values", () => {
      expect(() => calculateRoi(Infinity, 1000)).toThrow(
        "Gain and cost must be finite numbers",
      );
    });
  });

  describe("calculateBreakEvenUnits", () => {
    it("should calculate break-even units correctly", () => {
      const units = calculateBreakEvenUnits(5000, 15, 8); // $5000 fixed, $15 price, $8 variable
      // Contribution margin = $7, break-even = 5000/7 = 714.29, rounded up = 715
      expect(units).toBe(715);
    });

    it("should handle exact break-even", () => {
      const units = calculateBreakEvenUnits(1000, 15, 5); // Contribution = $10, 1000/10 = 100
      expect(units).toBe(100);
    });

    it("should always round up to whole units", () => {
      const units = calculateBreakEvenUnits(100, 15, 14.5); // Contribution = $0.50, 100/0.5 = 200
      expect(units).toBe(200);
    });

    it("should handle high fixed costs", () => {
      const units = calculateBreakEvenUnits(50000, 25, 15); // High fixed costs
      expect(units).toBe(5000); // 50000 / 10 = 5000
    });

    it("should throw error for negative fixed costs", () => {
      expect(() => calculateBreakEvenUnits(-1000, 15, 8)).toThrow(
        "Fixed costs must be non-negative",
      );
    });

    it("should throw error for invalid price per unit", () => {
      expect(() => calculateBreakEvenUnits(1000, 0, 8)).toThrow(
        "Price per unit must be positive",
      );
      expect(() => calculateBreakEvenUnits(1000, -15, 8)).toThrow(
        "Price per unit must be positive",
      );
    });

    it("should throw error for negative variable cost", () => {
      expect(() => calculateBreakEvenUnits(1000, 15, -5)).toThrow(
        "Variable cost per unit must be non-negative",
      );
    });

    it("should throw error when variable cost equals or exceeds price", () => {
      expect(() => calculateBreakEvenUnits(1000, 15, 15)).toThrow(
        "Price per unit must be greater than variable cost per unit",
      );
      expect(() => calculateBreakEvenUnits(1000, 15, 20)).toThrow(
        "Price per unit must be greater than variable cost per unit",
      );
    });
  });

  describe("Financial Integration Tests", () => {
    it("should demonstrate complete financial analysis workflow", () => {
      // Monthly cost analysis for cidery
      const monthlyCosts = [4500, 4800, 5200, 4300, 4900, 5100];

      const avgCost = calculateWeightedAverage(
        monthlyCosts.map((cost) => ({ value: cost, weight: 1 })),
      );
      const stdDev = calculateStandardDeviation(monthlyCosts);
      const cv = calculateCoefficientOfVariation(monthlyCosts);
      const median = calculateMedian(monthlyCosts);
      const p75 = calculatePercentile(monthlyCosts, 75);

      expect(avgCost).toBeCloseTo(4800, 0);
      expect(stdDev).toBeGreaterThan(0);
      expect(cv).toBeGreaterThan(0);
      expect(median).toBeGreaterThan(4000);
      expect(p75).toBeGreaterThan(median);
    });

    it("should validate pricing strategy calculations", () => {
      const cogsCost = 8.5;
      const sellingPrice = 18.0;

      const margin = calculateGrossMargin(sellingPrice, cogsCost);
      const markup = calculateMarkup(sellingPrice, cogsCost);

      expect(margin).toBeCloseTo(52.78, 1); // Healthy margin
      expect(markup).toBeCloseTo(111.76, 1); // Good markup

      // Break-even analysis
      const breakEvenUnits = calculateBreakEvenUnits(
        25000,
        sellingPrice,
        cogsCost,
      );
      expect(breakEvenUnits).toBeGreaterThan(2600); // Reasonable break-even
    });

    it("should handle precision edge cases in financial calculations", () => {
      // Test floating-point precision issues
      const amount1 = 0.1 + 0.2; // JavaScript precision issue
      const amount2 = 0.3;

      expect(isFinanciallyEqual(amount1, amount2, 0.001)).toBe(true);

      const rounded = roundFinancial(amount1, 2);
      expect(rounded).toBe(0.3);
    });
  });
});
