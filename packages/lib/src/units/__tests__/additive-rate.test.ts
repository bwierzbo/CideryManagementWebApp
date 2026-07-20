/**
 * Tests for additiveRateGramsPerL — the comparable g/L dosage intensity used
 * to make fruit/additive additions comparable across batches regardless of
 * whether they were logged by mass (kg) or as a rate (g/L).
 */

import { describe, it, expect } from "vitest";
import { additiveRateGramsPerL } from "../conversions";

describe("additiveRateGramsPerL", () => {
  it("passes a g/L rate through unchanged (case-insensitive, no volume needed)", () => {
    expect(additiveRateGramsPerL(100, "g/L", 120)).toBe(100);
    expect(additiveRateGramsPerL(100, "g/l", null)).toBe(100);
  });

  it("converts kg against batch volume to g/L", () => {
    // 8 kg over 120 L = 8000 g / 120 = 66.6667 g/L (the low Jan-2026 artifact)
    expect(additiveRateGramsPerL(8, "kg", 120)).toBeCloseTo(66.6667, 3);
    // Same 8 kg over the 71.5 L sub-batch = 111.888… g/L (the high artifact)
    expect(additiveRateGramsPerL(8, "kg", 71.5)).toBeCloseTo(111.8881, 3);
  });

  it("makes the two logging styles agree at the same volume", () => {
    // 12 kg over 120 L === 100 g/L — the whole point of the change.
    expect(additiveRateGramsPerL(12, "kg", 120)).toBe(100);
    expect(additiveRateGramsPerL(100, "g/L", 120)).toBe(100);
  });

  it("normalizes the form's loose unit strings (lbs, grams)", () => {
    // 1 lb = 453.592 g; over 100 L = 4.53592 g/L
    expect(additiveRateGramsPerL(1, "lbs", 100)).toBeCloseTo(4.53592, 4);
    expect(additiveRateGramsPerL(1, "lb", 100)).toBeCloseTo(4.53592, 4);
    expect(additiveRateGramsPerL(500, "grams", 100)).toBe(5);
  });

  it("handles g and oz mass units", () => {
    expect(additiveRateGramsPerL(900, "g", 120)).toBe(7.5);
    // 1 oz = 28.3495 g over 100 L
    expect(additiveRateGramsPerL(1, "oz", 100)).toBeCloseTo(0.2835, 3);
  });

  it("treats ppm as mg/L (÷1000), no volume needed", () => {
    expect(additiveRateGramsPerL(50, "ppm", 120)).toBe(0.05);
  });

  it("returns null for pure volume units (no density to get mass)", () => {
    expect(additiveRateGramsPerL(5, "L", 120)).toBeNull();
    expect(additiveRateGramsPerL(500, "mL", 120)).toBeNull();
    expect(additiveRateGramsPerL(500, "ml", 120)).toBeNull();
  });

  it("returns null when a mass unit has no usable batch volume", () => {
    expect(additiveRateGramsPerL(8, "kg", null)).toBeNull();
    expect(additiveRateGramsPerL(8, "kg", 0)).toBeNull();
    expect(additiveRateGramsPerL(8, "kg", undefined)).toBeNull();
  });

  it("returns null for invalid amounts and unknown units", () => {
    expect(additiveRateGramsPerL(-5, "kg", 120)).toBeNull();
    expect(additiveRateGramsPerL(NaN, "kg", 120)).toBeNull();
    expect(additiveRateGramsPerL(10, "widgets", 120)).toBeNull();
  });
});
