import { describe, it, expect } from "vitest";
import {
  calcActualLPerKg,
  calcVariancePct,
  calculateExtractionEfficiency,
  getVarietyYieldRange,
  calculatePotentialJuiceVolume,
  getYieldPerformanceCategory,
  calculateWeightedAverageYield,
} from "../../calc/yield";

describe("Yield Calculations", () => {
  describe("calcActualLPerKg", () => {
    it("should calculate yield correctly with typical values", () => {
      // Typical cider apple yield: 300L from 500kg = 0.6 L/kg
      expect(calcActualLPerKg(300, 500)).toBe(0.6);

      // High yield: 350L from 500kg = 0.7 L/kg
      expect(calcActualLPerKg(350, 500)).toBe(0.7);

      // Low yield: 250L from 500kg = 0.5 L/kg
      expect(calcActualLPerKg(250, 500)).toBe(0.5);
    });

    it("should handle edge cases", () => {
      // No juice extracted
      expect(calcActualLPerKg(0, 100)).toBe(0);

      // Very small amounts
      expect(calcActualLPerKg(0.5, 1)).toBe(0.5);

      // Large amounts
      expect(calcActualLPerKg(10000, 15000)).toBe(0.6667);
    });

    it("should round to 4 decimal places", () => {
      expect(calcActualLPerKg(100, 333)).toBe(0.3003);
      expect(calcActualLPerKg(1, 3)).toBe(0.3333);
    });

    it("should throw error for invalid inputs", () => {
      // Negative juice volume
      expect(() => calcActualLPerKg(-100, 500)).toThrow(
        "Juice volume must be non-negative",
      );

      // Zero or negative weight
      expect(() => calcActualLPerKg(300, 0)).toThrow(
        "Input weight must be positive",
      );
      expect(() => calcActualLPerKg(300, -500)).toThrow(
        "Input weight must be positive",
      );

      // Physically impossible yield (juice > 2x weight)
      expect(() => calcActualLPerKg(1100, 500)).toThrow(
        "Juice volume cannot exceed twice the input weight",
      );
    });
  });

  describe("calcVariancePct", () => {
    it("should calculate positive variance correctly", () => {
      // 15% over expected
      expect(calcVariancePct(0.69, 0.6)).toBe(15);

      // 25% over expected
      expect(calcVariancePct(0.75, 0.6)).toBe(25);

      // Small positive variance
      expect(calcVariancePct(0.61, 0.6)).toBe(1.67);
    });

    it("should calculate negative variance correctly", () => {
      // 10% under expected
      expect(calcVariancePct(0.54, 0.6)).toBe(-10);

      // 20% under expected
      expect(calcVariancePct(0.48, 0.6)).toBe(-20);

      // Small negative variance
      expect(calcVariancePct(0.59, 0.6)).toBe(-1.67);
    });

    it("should handle edge cases", () => {
      // No variance
      expect(calcVariancePct(0.6, 0.6)).toBe(0);

      // Double the expected
      expect(calcVariancePct(1.2, 0.6)).toBe(100);

      // Zero actual (complete failure)
      expect(calcVariancePct(0, 0.6)).toBe(-100);
    });

    it("should round to 2 decimal places", () => {
      expect(calcVariancePct(0.6173, 0.6)).toBe(2.88);
    });

    it("should throw error for invalid inputs", () => {
      // Zero expected value
      expect(() => calcVariancePct(0.6, 0)).toThrow(
        "Expected value cannot be zero for variance calculation",
      );

      // Negative values
      expect(() => calcVariancePct(-0.1, 0.6)).toThrow(
        "Values must be non-negative for variance calculation",
      );
      expect(() => calcVariancePct(0.6, -0.1)).toThrow(
        "Values must be non-negative for variance calculation",
      );
    });
  });

  describe("calculateExtractionEfficiency", () => {
    it("should calculate efficiency correctly", () => {
      // Meeting expectations exactly
      expect(calculateExtractionEfficiency(0.6, 0.6)).toBe(100);

      // 110% efficiency
      expect(calculateExtractionEfficiency(0.66, 0.6)).toBe(110);

      // 90% efficiency
      expect(calculateExtractionEfficiency(0.54, 0.6)).toBe(90);

      // 75% efficiency
      expect(calculateExtractionEfficiency(0.45, 0.6)).toBe(75);
    });
  });

  describe("getVarietyYieldRange", () => {
    it("should return correct ranges for known varieties", () => {
      const honeycrisp = getVarietyYieldRange("Honeycrisp");
      expect(honeycrisp.typical).toBe(0.62);
      expect(honeycrisp.min).toBeLessThan(honeycrisp.typical);
      expect(honeycrisp.max).toBeGreaterThan(honeycrisp.typical);

      const grannySmith = getVarietyYieldRange("Granny Smith");
      expect(grannySmith.typical).toBe(0.65);

      const northernSpy = getVarietyYieldRange("Northern Spy");
      expect(northernSpy.typical).toBe(0.68);
    });

    it("should return default range for unknown varieties", () => {
      const unknown = getVarietyYieldRange("Unknown Variety");
      expect(unknown.typical).toBe(0.6);
      expect(unknown.min).toBe(0.5);
      expect(unknown.max).toBe(0.7);
    });

    it("should have consistent ranges (min < typical < max)", () => {
      const varieties = [
        "Honeycrisp",
        "Gala",
        "Fuji",
        "Northern Spy",
        "Unknown",
      ];

      varieties.forEach((variety) => {
        const range = getVarietyYieldRange(variety);
        expect(range.min).toBeLessThan(range.typical);
        expect(range.typical).toBeLessThan(range.max);
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeLessThan(1);
      });
    });
  });

  describe("calculatePotentialJuiceVolume", () => {
    it("should calculate total potential correctly", () => {
      const inventory = [
        { weightKg: 500, variety: "Honeycrisp" }, // 500 * 0.62 = 310L
        { weightKg: 300, variety: "Granny Smith" }, // 300 * 0.65 = 195L
        { weightKg: 200, variety: "Gala" }, // 200 * 0.60 = 120L
      ];

      const expected = 500 * 0.62 + 300 * 0.65 + 200 * 0.6;
      expect(calculatePotentialJuiceVolume(inventory)).toBe(expected);
    });

    it("should handle single variety", () => {
      const inventory = [{ weightKg: 1000, variety: "Northern Spy" }];
      const expected = 1000 * 0.68;
      expect(calculatePotentialJuiceVolume(inventory)).toBe(expected);
    });

    it("should handle empty inventory", () => {
      expect(calculatePotentialJuiceVolume([])).toBe(0);
    });

    it("should use default yield for unknown varieties", () => {
      const inventory = [{ weightKg: 100, variety: "Unknown Variety" }];
      const expected = 100 * 0.6; // Default typical yield
      expect(calculatePotentialJuiceVolume(inventory)).toBe(expected);
    });

    it("should throw error for invalid weights", () => {
      const invalidInventory = [{ weightKg: -100, variety: "Honeycrisp" }];
      expect(() => calculatePotentialJuiceVolume(invalidInventory)).toThrow(
        "Apple lot weight must be positive",
      );

      const zeroWeightInventory = [{ weightKg: 0, variety: "Gala" }];
      expect(() => calculatePotentialJuiceVolume(zeroWeightInventory)).toThrow(
        "Apple lot weight must be positive",
      );
    });
  });

  describe("getYieldPerformanceCategory", () => {
    it("should categorize performance correctly", () => {
      expect(getYieldPerformanceCategory(115)).toBe("Exceptional");
      expect(getYieldPerformanceCategory(105)).toBe("Excellent");
      expect(getYieldPerformanceCategory(95)).toBe("Good");
      expect(getYieldPerformanceCategory(85)).toBe("Fair");
      expect(getYieldPerformanceCategory(75)).toBe("Poor");
      expect(getYieldPerformanceCategory(65)).toBe("Very Poor");
    });

    it("should handle boundary values", () => {
      expect(getYieldPerformanceCategory(110)).toBe("Exceptional");
      expect(getYieldPerformanceCategory(100)).toBe("Excellent");
      expect(getYieldPerformanceCategory(90)).toBe("Good");
      expect(getYieldPerformanceCategory(80)).toBe("Fair");
      expect(getYieldPerformanceCategory(70)).toBe("Poor");
    });
  });

  describe("calculateWeightedAverageYield", () => {
    it("should calculate weighted average correctly", () => {
      const pressRuns = [
        { juiceVolumeL: 300, inputWeightKg: 500 }, // 0.6 L/kg
        { juiceVolumeL: 200, inputWeightKg: 400 }, // 0.5 L/kg
        { juiceVolumeL: 150, inputWeightKg: 300 }, // 0.5 L/kg
      ];

      // Total: 650L from 1200kg = 0.5417 L/kg
      const expected = calcActualLPerKg(650, 1200);
      expect(calculateWeightedAverageYield(pressRuns)).toBe(expected);
    });

    it("should handle single press run", () => {
      const pressRuns = [{ juiceVolumeL: 300, inputWeightKg: 500 }];
      expect(calculateWeightedAverageYield(pressRuns)).toBe(0.6);
    });

    it("should weight larger runs more heavily", () => {
      const pressRuns = [
        { juiceVolumeL: 10, inputWeightKg: 20 }, // 0.5 L/kg, small run
        { juiceVolumeL: 700, inputWeightKg: 1000 }, // 0.7 L/kg, large run
      ];

      const weightedAvg = calculateWeightedAverageYield(pressRuns);
      // Should be closer to 0.7 than 0.5 due to weighting
      expect(weightedAvg).toBeGreaterThan(0.65);
      expect(weightedAvg).toBeLessThan(0.7);
    });

    it("should throw error for empty array", () => {
      expect(() => calculateWeightedAverageYield([])).toThrow(
        "Cannot calculate average yield from empty array",
      );
    });

    it("should throw error for invalid data", () => {
      const invalidRuns = [{ juiceVolumeL: -100, inputWeightKg: 500 }];
      expect(() => calculateWeightedAverageYield(invalidRuns)).toThrow(
        "All press runs must have positive weight and non-negative juice volume",
      );

      const zeroWeightRuns = [{ juiceVolumeL: 100, inputWeightKg: 0 }];
      expect(() => calculateWeightedAverageYield(zeroWeightRuns)).toThrow(
        "All press runs must have positive weight and non-negative juice volume",
      );
    });
  });

  describe("Yield Curve Validation", () => {
    it("should show realistic yield ranges across varieties", () => {
      const varieties = [
        "Honeycrisp",
        "Granny Smith",
        "Gala",
        "Fuji",
        "Northern Spy",
        "Rhode Island Greening",
        "McIntosh",
      ];

      varieties.forEach((variety) => {
        const range = getVarietyYieldRange(variety);

        // All yields should be realistic (between 0.4 and 0.8 L/kg)
        expect(range.min).toBeGreaterThan(0.4);
        expect(range.max).toBeLessThan(0.8);

        // Range should be reasonable (not more than 0.25 spread)
        expect(range.max - range.min).toBeLessThanOrEqual(0.25);
      });
    });

    it("should maintain efficiency calculation consistency", () => {
      const testCases = [
        { actual: 0.6, expected: 0.6, efficiency: 100 },
        { actual: 0.66, expected: 0.6, efficiency: 110 },
        { actual: 0.54, expected: 0.6, efficiency: 90 },
        { actual: 0.48, expected: 0.6, efficiency: 80 },
        { actual: 0.72, expected: 0.6, efficiency: 120 },
      ];

      testCases.forEach(({ actual, expected, efficiency }) => {
        expect(calculateExtractionEfficiency(actual, expected)).toBe(
          efficiency,
        );
      });
    });

    it("should validate variance calculation accuracy", () => {
      const baseExpected = 0.6;
      const testActuals = [0.48, 0.54, 0.6, 0.66, 0.72];
      const expectedVariances = [-20, -10, 0, 10, 20];

      testActuals.forEach((actual, index) => {
        const variance = calcVariancePct(actual, baseExpected);
        expect(variance).toBe(expectedVariances[index]);
      });
    });

    it("should demonstrate realistic extraction scenarios", () => {
      // Poor extraction day
      const poorYield = calcActualLPerKg(400, 1000); // 0.4 L/kg
      expect(
        getYieldPerformanceCategory(
          calculateExtractionEfficiency(poorYield, 0.6),
        ),
      ).toBe("Very Poor");

      // Good extraction day
      const goodYield = calcActualLPerKg(650, 1000); // 0.65 L/kg
      expect(
        getYieldPerformanceCategory(
          calculateExtractionEfficiency(goodYield, 0.6),
        ),
      ).toBe("Excellent");

      // Exceptional day
      const exceptionalYield = calcActualLPerKg(720, 1000); // 0.72 L/kg
      expect(
        getYieldPerformanceCategory(
          calculateExtractionEfficiency(exceptionalYield, 0.6),
        ),
      ).toBe("Exceptional");
    });
  });

  describe("Yield Precision and Edge Cases", () => {
    it("should handle very small yields with precision", () => {
      // Minimal juice extraction
      const minimalYield = calcActualLPerKg(0.1, 1000);
      expect(minimalYield).toBe(0.0001);

      // Very small apple quantities (should be within physical limits)
      const smallBatch = calcActualLPerKg(0.15, 0.1); // 0.15L from 0.1kg = 1.5 L/kg (under 2x limit)
      expect(smallBatch).toBe(1.5);
    });

    it("should maintain precision with large quantities", () => {
      // Industrial scale processing
      const largeScale = calcActualLPerKg(50000, 75000);
      expect(largeScale).toBe(0.6667);

      // Very large numbers should still work
      const megaScale = calcActualLPerKg(1000000, 1666666);
      expect(megaScale).toBe(0.6);
    });

    it("should handle decimal precision edge cases", () => {
      // Test rounding to 4 decimal places
      const precisionTests = [
        { juice: 100, apples: 333, expected: 0.3003 },
        { juice: 1, apples: 3, expected: 0.3333 },
        { juice: 1000, apples: 777, expected: 1.287 },
      ];

      precisionTests.forEach(({ juice, apples, expected }) => {
        expect(calcActualLPerKg(juice, apples)).toBe(expected);
      });
    });

    it("should handle variance calculation boundary conditions", () => {
      // Very small variances
      const tinyVariance = calcVariancePct(0.60001, 0.6);
      expect(tinyVariance).toBe(0.0);

      // Very large variances
      const hugeVariance = calcVariancePct(1.8, 0.6);
      expect(hugeVariance).toBe(200.0);

      // Precision at boundary
      const boundaryVariance = calcVariancePct(0.599999, 0.6);
      expect(boundaryVariance).toBe(-0.0);
    });

    it("should validate physical impossibility checks", () => {
      // Juice cannot exceed 2x apple weight (1 kg apples = 1L at most, plus water)
      expect(() => calcActualLPerKg(2001, 1000)).toThrow(
        "Juice volume cannot exceed twice the input weight",
      );

      // Edge case: exactly 2x should work
      expect(() => calcActualLPerKg(2000, 1000)).not.toThrow();

      // Very close to limit should work
      expect(() => calcActualLPerKg(1999.99, 1000)).not.toThrow();
    });

    it("should handle floating-point precision in yield calculations", () => {
      // Test potential floating-point arithmetic issues
      const juice = 0.1 + 0.2; // JavaScript precision issue
      const apples = 0.3;

      const yield1 = calcActualLPerKg(juice, 1);
      const yield2 = calcActualLPerKg(0.3, 1);

      // Should be approximately equal within precision
      expect(Math.abs(yield1 - yield2)).toBeLessThan(0.0001);
    });
  });

  describe("Variety Yield Edge Cases", () => {
    it("should handle case sensitivity in variety names", () => {
      // Test same variety with different cases
      const lower = getVarietyYieldRange("honeycrisp");
      const upper = getVarietyYieldRange("HONEYCRISP");
      const mixed = getVarietyYieldRange("HoneyCrisp");
      const correct = getVarietyYieldRange("Honeycrisp");

      // All should return default since case doesn't match
      expect(lower).toEqual({ min: 0.5, max: 0.7, typical: 0.6 });
      expect(upper).toEqual({ min: 0.5, max: 0.7, typical: 0.6 });
      expect(mixed).toEqual({ min: 0.5, max: 0.7, typical: 0.6 });

      // Only exact case should return specific variety
      expect(correct.typical).toBe(0.62);
    });

    it("should handle empty and whitespace variety names", () => {
      expect(getVarietyYieldRange("")).toEqual({
        min: 0.5,
        max: 0.7,
        typical: 0.6,
      });
      expect(getVarietyYieldRange("   ")).toEqual({
        min: 0.5,
        max: 0.7,
        typical: 0.6,
      });
      expect(getVarietyYieldRange("\t\n")).toEqual({
        min: 0.5,
        max: 0.7,
        typical: 0.6,
      });
    });

    it("should validate variety yield relationships", () => {
      // High-yielding varieties should have higher typical yields
      const highYielders = ["Northern Spy", "Rhode Island Greening"];
      const lowYielders = ["Red Delicious", "Fuji"];

      const avgHighYield =
        highYielders
          .map((v) => getVarietyYieldRange(v).typical)
          .reduce((sum, val) => sum + val, 0) / highYielders.length;

      const avgLowYield =
        lowYielders
          .map((v) => getVarietyYieldRange(v).typical)
          .reduce((sum, val) => sum + val, 0) / lowYielders.length;

      expect(avgHighYield).toBeGreaterThan(avgLowYield);
    });

    it("should validate all defined varieties have consistent ranges", () => {
      const definedVarieties = [
        "Honeycrisp",
        "Granny Smith",
        "Gala",
        "Fuji",
        "Northern Spy",
        "Rhode Island Greening",
        "McIntosh",
        "Red Delicious",
        "Golden Delicious",
        "Braeburn",
      ];

      definedVarieties.forEach((variety) => {
        const range = getVarietyYieldRange(variety);

        // Validate range consistency
        expect(range.min).toBeLessThan(range.typical);
        expect(range.typical).toBeLessThan(range.max);

        // Validate realistic values
        expect(range.min).toBeGreaterThan(0.4);
        expect(range.max).toBeLessThan(0.8);
        expect(range.typical).toBeGreaterThan(0.5);
        expect(range.typical).toBeLessThan(0.75);
      });
    });
  });

  describe("Performance Category Edge Cases", () => {
    it("should handle boundary efficiency values", () => {
      // Test exact boundary values
      expect(getYieldPerformanceCategory(110.0)).toBe("Exceptional");
      expect(getYieldPerformanceCategory(109.99)).toBe("Excellent");
      expect(getYieldPerformanceCategory(100.0)).toBe("Excellent");
      expect(getYieldPerformanceCategory(99.99)).toBe("Good");
      expect(getYieldPerformanceCategory(90.0)).toBe("Good");
      expect(getYieldPerformanceCategory(89.99)).toBe("Fair");
      expect(getYieldPerformanceCategory(80.0)).toBe("Fair");
      expect(getYieldPerformanceCategory(79.99)).toBe("Poor");
      expect(getYieldPerformanceCategory(70.0)).toBe("Poor");
      expect(getYieldPerformanceCategory(69.99)).toBe("Very Poor");
    });

    it("should handle extreme efficiency values", () => {
      // Very high efficiency (theoretically impossible but handle gracefully)
      expect(getYieldPerformanceCategory(200)).toBe("Exceptional");
      expect(getYieldPerformanceCategory(1000)).toBe("Exceptional");

      // Very low efficiency
      expect(getYieldPerformanceCategory(0)).toBe("Very Poor");
      expect(getYieldPerformanceCategory(-50)).toBe("Very Poor");
    });

    it("should provide consistent categorization logic", () => {
      // Generate efficiency values and ensure monotonic categorization
      const categories = [
        "Very Poor",
        "Poor",
        "Fair",
        "Good",
        "Excellent",
        "Exceptional",
      ];
      const efficiencies = [0, 50, 75, 85, 95, 105, 115];

      const results = efficiencies.map((eff) =>
        getYieldPerformanceCategory(eff),
      );

      // Each subsequent efficiency should have same or better category
      for (let i = 1; i < results.length; i++) {
        const currentIndex = categories.indexOf(results[i]);
        const previousIndex = categories.indexOf(results[i - 1]);
        expect(currentIndex).toBeGreaterThanOrEqual(previousIndex);
      }
    });
  });

  describe("Weighted Average Edge Cases", () => {
    it("should handle edge cases in weighted average calculations", () => {
      // Single press run
      const singleRun = [{ juiceVolumeL: 500, inputWeightKg: 1000 }];
      expect(calculateWeightedAverageYield(singleRun)).toBe(0.5);

      // Identical runs
      const identicalRuns = [
        { juiceVolumeL: 300, inputWeightKg: 500 },
        { juiceVolumeL: 300, inputWeightKg: 500 },
        { juiceVolumeL: 300, inputWeightKg: 500 },
      ];
      expect(calculateWeightedAverageYield(identicalRuns)).toBe(0.6);
    });

    it("should handle extreme weight differences", () => {
      const extremeRuns = [
        { juiceVolumeL: 1, inputWeightKg: 10 }, // 0.1 L/kg, tiny run
        { juiceVolumeL: 10000, inputWeightKg: 15000 }, // 0.667 L/kg, huge run
      ];

      const weightedAvg = calculateWeightedAverageYield(extremeRuns);

      // Should be heavily weighted toward the large run
      expect(weightedAvg).toBeCloseTo(0.6667, 3);
      expect(weightedAvg).toBeGreaterThan(0.6);
    });

    it("should handle zero juice volume edge cases", () => {
      const zeroJuiceRuns = [
        { juiceVolumeL: 0, inputWeightKg: 100 }, // Complete failure
        { juiceVolumeL: 500, inputWeightKg: 1000 }, // Normal run
      ];

      // Should handle gracefully
      const avg = calculateWeightedAverageYield(zeroJuiceRuns);
      expect(avg).toBe(0.4545); // 500 / 1100 = 0.4545
    });

    it("should validate mathematical accuracy", () => {
      const precisionRuns = [
        { juiceVolumeL: 333.333, inputWeightKg: 555.555 },
        { juiceVolumeL: 666.666, inputWeightKg: 999.999 },
      ];

      const manualCalc = (333.333 + 666.666) / (555.555 + 999.999);
      const weightedAvg = calculateWeightedAverageYield(precisionRuns);

      // Should match manual calculation within rounding precision
      expect(Math.abs(weightedAvg - manualCalc)).toBeLessThan(0.0001);
    });
  });

  describe("Potential Volume Calculation Edge Cases", () => {
    it("should handle edge cases in potential volume calculations", () => {
      // Mix of very small and large lots
      const mixedInventory = [
        { weightKg: 0.1, variety: "Gala" },
        { weightKg: 10000, variety: "Honeycrisp" },
        { weightKg: 1, variety: "Unknown Variety" },
      ];

      const potential = calculatePotentialJuiceVolume(mixedInventory);
      const expected = 0.1 * 0.6 + 10000 * 0.62 + 1 * 0.6;
      expect(potential).toBeCloseTo(expected, 2);
    });

    it("should handle very large inventory calculations", () => {
      // Test with unrealistically large numbers to check for overflow
      const massiveInventory = [{ weightKg: 1000000, variety: "Granny Smith" }];

      const potential = calculatePotentialJuiceVolume(massiveInventory);
      expect(potential).toBe(650000); // 1M * 0.65
      expect(Number.isFinite(potential)).toBe(true);
    });

    it("should handle precision with many small lots", () => {
      // Many small lots that could accumulate precision errors
      const manySmallLots = Array.from({ length: 1000 }, (_, i) => ({
        weightKg: 0.001 + i * 0.0001, // Tiny weights
        variety: "Fuji",
      }));

      const potential = calculatePotentialJuiceVolume(manySmallLots);
      expect(Number.isFinite(potential)).toBe(true);
      expect(potential).toBeGreaterThan(0);
    });

    it("should validate calculation accuracy with mixed varieties", () => {
      // Test manual calculation verification
      const testInventory = [
        { weightKg: 100, variety: "Honeycrisp" }, // 100 * 0.62 = 62
        { weightKg: 200, variety: "Granny Smith" }, // 200 * 0.65 = 130
        { weightKg: 150, variety: "Unknown" }, // 150 * 0.60 = 90
      ];

      const calculated = calculatePotentialJuiceVolume(testInventory);
      const manual = 62 + 130 + 90;
      expect(calculated).toBe(manual);
    });
  });

  describe("Real-World Production Scenarios", () => {
    it("should model seasonal yield variations", () => {
      // Early season vs late season yields for same variety
      const earlySeasonYield = calcActualLPerKg(280, 500); // Lower yield
      const lateSeasonYield = calcActualLPerKg(320, 500); // Higher yield

      const earlyEfficiency = calculateExtractionEfficiency(
        earlySeasonYield,
        0.6,
      );
      const lateEfficiency = calculateExtractionEfficiency(
        lateSeasonYield,
        0.6,
      );

      expect(lateEfficiency).toBeGreaterThan(earlyEfficiency);
      expect(getYieldPerformanceCategory(earlyEfficiency)).not.toBe(
        "Exceptional",
      );
      expect(getYieldPerformanceCategory(lateEfficiency)).toBe("Excellent");
    });

    it("should model multi-variety press runs", () => {
      // Realistic multi-variety press run
      const multiVarietyRuns = [
        { juiceVolumeL: 150, inputWeightKg: 250 }, // Honeycrisp: good yield
        { juiceVolumeL: 120, inputWeightKg: 200 }, // Gala: average yield
        { juiceVolumeL: 100, inputWeightKg: 180 }, // Red Delicious: poor yield
      ];

      const avgYield = calculateWeightedAverageYield(multiVarietyRuns);
      const totalYield = calcActualLPerKg(370, 630);

      expect(avgYield).toBe(totalYield);
      expect(avgYield).toBeGreaterThan(0.55);
      expect(avgYield).toBeLessThan(0.65);
    });

    it("should demonstrate yield optimization scenarios", () => {
      // Before optimization: poor extraction
      const beforeOptimization = [
        { juiceVolumeL: 400, inputWeightKg: 1000 }, // 40% yield
        { juiceVolumeL: 450, inputWeightKg: 1000 }, // 45% yield
        { juiceVolumeL: 380, inputWeightKg: 1000 }, // 38% yield
      ];

      // After optimization: improved extraction
      const afterOptimization = [
        { juiceVolumeL: 600, inputWeightKg: 1000 }, // 60% yield
        { juiceVolumeL: 620, inputWeightKg: 1000 }, // 62% yield
        { juiceVolumeL: 580, inputWeightKg: 1000 }, // 58% yield
      ];

      const beforeAvg = calculateWeightedAverageYield(beforeOptimization);
      const afterAvg = calculateWeightedAverageYield(afterOptimization);

      const improvement = calcVariancePct(afterAvg, beforeAvg);
      expect(improvement).toBeGreaterThan(40); // Significant improvement
      expect(
        getYieldPerformanceCategory(
          calculateExtractionEfficiency(beforeAvg, 0.6),
        ),
      ).toBe("Very Poor");
      expect(
        getYieldPerformanceCategory(
          calculateExtractionEfficiency(afterAvg, 0.6),
        ),
      ).toBe("Excellent");
    });

    it("should validate commercial production targets", () => {
      // Industry standard targets
      const commercialTargets = {
        smallCidery: { expectedYield: 0.55, minAcceptable: 0.5 },
        mediumCidery: { expectedYield: 0.6, minAcceptable: 0.55 },
        largeCidery: { expectedYield: 0.65, minAcceptable: 0.6 },
      };

      Object.entries(commercialTargets).forEach(([scale, targets]) => {
        const achievedYield = targets.expectedYield;
        const efficiency = calculateExtractionEfficiency(
          achievedYield,
          targets.expectedYield,
        );
        const variance = calcVariancePct(achievedYield, targets.expectedYield);

        expect(efficiency).toBe(100); // Meeting targets
        expect(variance).toBe(0);
        expect(getYieldPerformanceCategory(efficiency)).toBe("Excellent");

        // Test performance against minimum acceptable
        const minEfficiency = calculateExtractionEfficiency(
          targets.minAcceptable,
          targets.expectedYield,
        );
        expect(minEfficiency).toBeGreaterThanOrEqual(90); // Should be at least "Good"
      });
    });
  });
});
