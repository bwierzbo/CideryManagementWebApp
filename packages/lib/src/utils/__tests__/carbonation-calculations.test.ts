/**
 * Unit tests for carbonation calculation utilities
 *
 * Tests cover:
 * - Henry's Law accuracy with known values
 * - Linear interpolation for temperatures between data points
 * - Round-trip conversion consistency
 * - Duration estimation accuracy
 * - Carbonation level classification
 * - Pressure and temperature validation
 * - Edge cases: zero, negative, extreme values
 */

import { describe, it, expect } from "vitest";
import {
  calculateCO2Volumes,
  calculateRequiredPressure,
  estimateCarbonationDuration,
  getCarbonationLevel,
  isPressureSafe,
  isTemperatureSafe,
  validateTemperature,
} from "../carbonation-calculations";

describe("calculateCO2Volumes", () => {
  it("should calculate CO2 volumes using Henry's Law at exact temperature points", () => {
    // At 4°C (factor 0.09474), 15 PSI should give (15 + 14.7) * 0.09474 = 2.81 volumes
    const volumes = calculateCO2Volumes(15, 4);
    expect(volumes).toBe(2.81);
  });

  it("should calculate volumes at 0°C", () => {
    // At 0°C (factor 0.11417), 10 PSI should give (10 + 14.7) * 0.11417 = 2.82 volumes
    const volumes = calculateCO2Volumes(10, 0);
    expect(volumes).toBe(2.82);
  });

  it("should calculate volumes at 20°C", () => {
    // At 20°C (factor 0.05911), 20 PSI should give (20 + 14.7) * 0.05911 = 2.05 volumes
    const volumes = calculateCO2Volumes(20, 20);
    expect(volumes).toBe(2.05);
  });

  it("should handle zero pressure", () => {
    // At 4°C with 0 PSI, only atmospheric pressure: 14.7 * 0.09474 = 1.39
    const volumes = calculateCO2Volumes(0, 4);
    expect(volumes).toBe(1.39);
  });

  it("should interpolate between temperature points", () => {
    // At 5°C (between 4°C factor 0.09474 and 6°C factor 0.08899)
    // Interpolated factor ≈ 0.09186, 15 PSI gives (15 + 14.7) * 0.09186 ≈ 2.73
    const volumes = calculateCO2Volumes(15, 5);
    expect(volumes).toBeGreaterThan(2.6); // Should be between 4°C (2.81) and 6°C (2.64) results
    expect(volumes).toBeLessThan(2.9);
  });

  it("should use lowest factor for temperatures below 0°C", () => {
    // At -2°C, should use 0°C factor (0.166)
    const volumesNegative = calculateCO2Volumes(15, -2);
    const volumesZero = calculateCO2Volumes(15, 0);
    expect(volumesNegative).toBe(volumesZero);
  });

  it("should use highest factor for temperatures above 25°C", () => {
    // At 30°C, should use 25°C factor (0.052)
    const volumesHigh = calculateCO2Volumes(15, 30);
    const volumes25 = calculateCO2Volumes(15, 25);
    expect(volumesHigh).toBe(volumes25);
  });

  it("should handle high pressure values", () => {
    // At 4°C with 50 PSI: (50 + 14.7) * 0.09474 = 6.13
    const volumes = calculateCO2Volumes(50, 4);
    expect(volumes).toBe(6.13);
  });

  it("should round to 2 decimal places", () => {
    const volumes = calculateCO2Volumes(15.5, 4.5);
    // Result should have max 2 decimal places
    expect(Number.isInteger(volumes * 100)).toBe(true);
  });
});

describe("calculateRequiredPressure", () => {
  it("should calculate required pressure for typical sparkling cider", () => {
    // 2.5 volumes at 4°C (factor 0.09474)
    // absolutePressure = 2.5 / 0.09474 = 26.39
    // gaugePressure = 26.39 - 14.7 = 11.69 PSI
    const pressure = calculateRequiredPressure(2.5, 4);
    expect(pressure).toBeGreaterThan(11);
    expect(pressure).toBeLessThan(12);
  });

  it("should calculate pressure for petillant cider", () => {
    // 1.5 volumes at 4°C (factor 0.09474)
    // absolutePressure = 1.5 / 0.09474 = 15.83
    // gaugePressure = 15.83 - 14.7 = 1.13 PSI
    const pressure = calculateRequiredPressure(1.5, 4);
    expect(pressure).toBeGreaterThan(1);
    expect(pressure).toBeLessThan(2);
  });

  it("should handle zero volume target", () => {
    const pressure = calculateRequiredPressure(0, 4);
    expect(pressure).toBe(0); // Should never be negative
  });

  it("should handle high volume targets", () => {
    // 4.0 volumes at 4°C (highly carbonated)
    const pressure = calculateRequiredPressure(4.0, 4);
    expect(pressure).toBeGreaterThan(10);
  });

  it("should interpolate between temperature points", () => {
    // 2.5 volumes at 5°C (between 4°C and 6°C)
    const pressure = calculateRequiredPressure(2.5, 5);
    expect(pressure).toBeGreaterThan(0);
  });

  it("should return 0 for negative calculated pressure", () => {
    // Very low volume target at high temp might theoretically need negative pressure
    // At 25°C (factor 0.04959), 0.5 volumes needs: 0.5/0.04959 - 14.7 = -4.62 PSI → clamped to 0
    const pressure = calculateRequiredPressure(0.5, 25);
    expect(pressure).toBe(0);
  });

  it("should round to 2 decimal places", () => {
    const pressure = calculateRequiredPressure(2.75, 6.5);
    // Result should have max 2 decimal places
    expect(Number.isInteger(pressure * 100)).toBe(true);
  });

  it("should be inverse of calculateCO2Volumes", () => {
    // Round-trip test: pressure → volumes → pressure should give same result
    const originalPressure = 18;
    const temperature = 4;

    const volumes = calculateCO2Volumes(originalPressure, temperature);
    const calculatedPressure = calculateRequiredPressure(volumes, temperature);

    // Should be within 0.1 PSI due to rounding
    expect(Math.abs(calculatedPressure - originalPressure)).toBeLessThan(0.1);
  });
});

describe("estimateCarbonationDuration", () => {
  it("should estimate ~24 hours per volume at 15 PSI", () => {
    // From 0 to 1 volume at 15 PSI should be ~24 hours
    const hours = estimateCarbonationDuration(0, 1, 15);
    expect(hours).toBeGreaterThan(20);
    expect(hours).toBeLessThan(28);
  });

  it("should estimate ~60 hours for 2.5 volumes at 15 PSI", () => {
    // From 0 to 2.5 volumes at 15 PSI should be ~60 hours (2.5 days)
    const hours = estimateCarbonationDuration(0, 2.5, 15);
    expect(hours).toBeGreaterThan(50);
    expect(hours).toBeLessThan(70);
  });

  it("should reduce time estimate with higher pressure", () => {
    // Higher pressure should speed up carbonation
    const hours15PSI = estimateCarbonationDuration(0, 2.5, 15);
    const hours30PSI = estimateCarbonationDuration(0, 2.5, 30);

    expect(hours30PSI).toBeLessThan(hours15PSI);
  });

  it("should return 0 when already at target", () => {
    const hours = estimateCarbonationDuration(2.5, 2.5, 15);
    expect(hours).toBe(0);
  });

  it("should return 0 when above target", () => {
    const hours = estimateCarbonationDuration(3.0, 2.5, 15);
    expect(hours).toBe(0);
  });

  it("should handle partial carbonation", () => {
    // From 1.0 to 2.5 volumes (only 1.5 delta) should be less than full carbonation
    const hoursPartial = estimateCarbonationDuration(1.0, 2.5, 15);
    const hoursFull = estimateCarbonationDuration(0, 2.5, 15);

    expect(hoursPartial).toBeLessThan(hoursFull);
    expect(hoursPartial).toBeGreaterThan(hoursFull * 0.5); // Should be ~60% of full time
  });

  it("should handle low pressure gracefully", () => {
    // Very low pressure should give longer estimate
    const hours = estimateCarbonationDuration(0, 2.5, 5);
    expect(hours).toBeGreaterThan(60); // Should be longer than at 15 PSI
  });

  it("should round to 1 decimal place", () => {
    const hours = estimateCarbonationDuration(0, 2.5, 15);
    // Result should have max 1 decimal place
    expect(Number.isInteger(hours * 10)).toBe(true);
  });
});

describe("getCarbonationLevel", () => {
  it("should classify still cider", () => {
    expect(getCarbonationLevel(0)).toBe("still");
    expect(getCarbonationLevel(0.5)).toBe("still");
    expect(getCarbonationLevel(0.99)).toBe("still");
  });

  it("should classify petillant cider", () => {
    expect(getCarbonationLevel(1.0)).toBe("petillant");
    expect(getCarbonationLevel(1.5)).toBe("petillant");
    expect(getCarbonationLevel(2.0)).toBe("petillant");
    expect(getCarbonationLevel(2.49)).toBe("petillant");
  });

  it("should classify sparkling cider", () => {
    expect(getCarbonationLevel(2.5)).toBe("sparkling");
    expect(getCarbonationLevel(3.0)).toBe("sparkling");
    expect(getCarbonationLevel(4.0)).toBe("sparkling");
  });

  it("should handle edge cases at boundaries", () => {
    // Exactly 1.0 should be petillant (not still)
    expect(getCarbonationLevel(1.0)).toBe("petillant");

    // Exactly 2.5 should be sparkling (not petillant)
    expect(getCarbonationLevel(2.5)).toBe("sparkling");
  });

  it("should handle very high carbonation", () => {
    expect(getCarbonationLevel(5.0)).toBe("sparkling");
    expect(getCarbonationLevel(10.0)).toBe("sparkling");
  });
});

describe("isPressureSafe", () => {
  it("should return true for pressure within vessel limits", () => {
    expect(isPressureSafe(20, 30)).toBe(true);
    expect(isPressureSafe(15, 30)).toBe(true);
    expect(isPressureSafe(0, 30)).toBe(true);
  });

  it("should return false for pressure exceeding vessel limits", () => {
    expect(isPressureSafe(35, 30)).toBe(false);
    expect(isPressureSafe(31, 30)).toBe(false);
  });

  it("should return true for pressure exactly at vessel limit", () => {
    expect(isPressureSafe(30, 30)).toBe(true);
  });

  it("should return false for negative pressure", () => {
    expect(isPressureSafe(-1, 30)).toBe(false);
    expect(isPressureSafe(-10, 30)).toBe(false);
  });

  it("should handle zero vessel max pressure", () => {
    expect(isPressureSafe(0, 0)).toBe(true);
    expect(isPressureSafe(1, 0)).toBe(false);
  });

  it("should handle very high vessel ratings", () => {
    expect(isPressureSafe(100, 150)).toBe(true);
    expect(isPressureSafe(151, 150)).toBe(false);
  });
});

describe("isTemperatureSafe", () => {
  it("should return true for temperatures in safe range", () => {
    expect(isTemperatureSafe(0)).toBe(true);
    expect(isTemperatureSafe(4)).toBe(true);
    expect(isTemperatureSafe(10)).toBe(true);
    expect(isTemperatureSafe(20)).toBe(true);
  });

  it("should return false for temperatures below -5°C", () => {
    expect(isTemperatureSafe(-6)).toBe(false);
    expect(isTemperatureSafe(-10)).toBe(false);
  });

  it("should return false for temperatures above 25°C", () => {
    expect(isTemperatureSafe(26)).toBe(false);
    expect(isTemperatureSafe(30)).toBe(false);
  });

  it("should return true at boundary temperatures", () => {
    expect(isTemperatureSafe(-5)).toBe(true); // Min safe temp
    expect(isTemperatureSafe(25)).toBe(true); // Max safe temp
  });

  it("should handle extreme temperatures", () => {
    expect(isTemperatureSafe(-50)).toBe(false);
    expect(isTemperatureSafe(100)).toBe(false);
  });
});

describe("Round-trip conversion tests", () => {
  it("should maintain accuracy through pressure → volumes → pressure conversion", () => {
    const testCases = [
      { pressure: 10, temp: 4 },
      { pressure: 15, temp: 4 },
      { pressure: 20, temp: 10 },
      { pressure: 25, temp: 15 },
    ];

    testCases.forEach(({ pressure, temp }) => {
      const volumes = calculateCO2Volumes(pressure, temp);
      const calculatedPressure = calculateRequiredPressure(volumes, temp);

      // Should be within 0.1 PSI due to rounding
      expect(Math.abs(calculatedPressure - pressure)).toBeLessThan(0.1);
    });
  });

  it("should maintain accuracy through volumes → pressure → volumes conversion", () => {
    const testCases = [
      { volumes: 1.5, temp: 4 },
      { volumes: 2.5, temp: 4 },
      { volumes: 3.0, temp: 10 },
      { volumes: 2.0, temp: 15 },
    ];

    testCases.forEach(({ volumes, temp }) => {
      const pressure = calculateRequiredPressure(volumes, temp);
      const calculatedVolumes = calculateCO2Volumes(pressure, temp);

      // Should be within 0.05 volumes due to rounding
      expect(Math.abs(calculatedVolumes - volumes)).toBeLessThan(0.05);
    });
  });
});

describe("Known brewing values verification", () => {
  it("should match known carbonation chart values at 4°C", () => {
    // These are known values from Brewer's Friend carbonation chart
    // At 4°C (39°F):
    // - 10 PSI should give 2.34 volumes
    // - 15 PSI should give 2.80 volumes
    // - 20 PSI should give 3.25 volumes

    const volumes10PSI = calculateCO2Volumes(10, 4);
    const volumes15PSI = calculateCO2Volumes(15, 4);
    const volumes20PSI = calculateCO2Volumes(20, 4);

    // Allow small variance due to rounding
    expect(volumes10PSI).toBeGreaterThan(2.30);
    expect(volumes10PSI).toBeLessThan(2.40);

    expect(volumes15PSI).toBeGreaterThan(2.75);
    expect(volumes15PSI).toBeLessThan(2.85);

    expect(volumes20PSI).toBeGreaterThan(3.20);
    expect(volumes20PSI).toBeLessThan(3.30);
  });

  it("should calculate correct pressure for typical cider styles", () => {
    // Still cider: 0.5-1.0 volumes
    // 0.8 volumes at 4°C: 0.8/0.09474 - 14.7 = -6.25 → clamped to 0
    // (Still cider doesn't need pressure carbonation - it's naturally still or bottle conditioned)
    const stillPressure = calculateRequiredPressure(0.8, 4);
    expect(stillPressure).toBe(0); // Below atmospheric CO2 level, no pressure needed

    // Petillant: 1.5-2.0 volumes
    // 1.8 volumes at 4°C: 1.8/0.09474 - 14.7 = 4.29 PSI
    const petillantPressure = calculateRequiredPressure(1.8, 4);
    expect(petillantPressure).toBeGreaterThan(4);
    expect(petillantPressure).toBeLessThan(5);

    // Sparkling: 2.5-3.5 volumes
    // 2.8 volumes at 4°C: 2.8/0.09474 - 14.7 = 14.86 PSI
    const sparklingPressure = calculateRequiredPressure(2.8, 4);
    expect(sparklingPressure).toBeGreaterThan(14);
    expect(sparklingPressure).toBeLessThan(16);
  });
});

describe("validateTemperature", () => {
  it("should validate optimal temperature range (0-10°C)", () => {
    const result4C = validateTemperature(4);
    expect(result4C.isValid).toBe(true);
    expect(result4C.isOptimal).toBe(true);
    expect(result4C.message).toBeUndefined();

    const result0C = validateTemperature(0);
    expect(result0C.isValid).toBe(true);
    expect(result0C.isOptimal).toBe(true);
    expect(result0C.message).toBeUndefined();

    const result10C = validateTemperature(10);
    expect(result10C.isValid).toBe(true);
    expect(result10C.isOptimal).toBe(true);
    expect(result10C.message).toBeUndefined();
  });

  it("should validate but warn for suboptimal temperatures", () => {
    const result15C = validateTemperature(15);
    expect(result15C.isValid).toBe(true);
    expect(result15C.isOptimal).toBe(false);
    expect(result15C.message).toBeDefined();
    expect(result15C.message).toContain('optimal');

    const result20C = validateTemperature(20);
    expect(result20C.isValid).toBe(true);
    expect(result20C.isOptimal).toBe(false);
    expect(result20C.message).toContain('optimal');
  });

  it("should reject temperatures that are too cold", () => {
    const result = validateTemperature(-10);
    expect(result.isValid).toBe(false);
    expect(result.isOptimal).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('freezing');
  });

  it("should reject temperatures that are too hot", () => {
    const result = validateTemperature(30);
    expect(result.isValid).toBe(false);
    expect(result.isOptimal).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('high');
  });

  it("should handle boundary temperatures correctly", () => {
    // At -5°C (boundary - just valid)
    const resultColdBoundary = validateTemperature(-5);
    expect(resultColdBoundary.isValid).toBe(true);
    expect(resultColdBoundary.isOptimal).toBe(false);

    // At 25°C (boundary - just valid)
    const resultHotBoundary = validateTemperature(25);
    expect(resultHotBoundary.isValid).toBe(true);
    expect(resultHotBoundary.isOptimal).toBe(false);

    // Just below cold boundary
    const resultTooCold = validateTemperature(-6);
    expect(resultTooCold.isValid).toBe(false);

    // Just above hot boundary
    const resultTooHot = validateTemperature(26);
    expect(resultTooHot.isValid).toBe(false);
  });

  it("should provide appropriate messages for each range", () => {
    const tooCold = validateTemperature(-10);
    expect(tooCold.message).toContain('low');

    const tooHot = validateTemperature(30);
    expect(tooHot.message).toContain('high');

    const suboptimal = validateTemperature(15);
    expect(suboptimal.message).toContain('optimal');
    expect(suboptimal.message).toContain('0-10');
  });
});
