import { describe, it, expect } from "vitest";
import { computeScaledAmount } from "../../recipes/scaling";

describe("computeScaledAmount", () => {
  describe("g/L", () => {
    it("scales the standard Strawberry Rhubarb rate (100 g/L) to 60L", () => {
      const r = computeScaledAmount(100, "g/L", 60);
      expect(r).not.toBeNull();
      expect(r!.unit).toBe("kg"); // 6000 g rolls up to kg
      expect(r!.amount).toBe("6.00");
      expect(r!.rawAmount).toBe(6000);
      expect(r!.rawUnit).toBe("g");
    });

    it("scales 75 g/L raspberries to 240L (the user's standard)", () => {
      const r = computeScaledAmount(75, "g/L", 240);
      expect(r!.amount).toBe("18.00");
      expect(r!.unit).toBe("kg");
      expect(r!.rawAmount).toBe(18000);
    });

    it("returns grams (not kg) when total is under 1000g", () => {
      const r = computeScaledAmount(9, "g/L", 60);
      // 9 × 60 = 540 g
      expect(r!.amount).toBe("540");
      expect(r!.unit).toBe("g");
    });

    it("rolls up exactly at the 1000g boundary", () => {
      const r = computeScaledAmount(10, "g/L", 100);
      // 10 × 100 = 1000 g exactly → kg
      expect(r!.unit).toBe("kg");
      expect(r!.amount).toBe("1.00");
    });

    it("uses 2 decimals for sub-10g amounts", () => {
      const r = computeScaledAmount(0.05, "g/L", 100);
      // 0.05 × 100 = 5 g — under 10, should show decimals
      expect(r!.amount).toBe("5.00");
      expect(r!.unit).toBe("g");
    });

    it("scales the documented honey case for cyser (5.9 kg honey/40L → reverse check)", () => {
      // If a recipe used "147.5 g/L" honey and scaled to 40L = 5900 g = 5.90 kg
      const r = computeScaledAmount(147.5, "g/L", 40);
      expect(r!.amount).toBe("5.90");
      expect(r!.unit).toBe("kg");
    });
  });

  describe("kg/L", () => {
    it("scales kg/L rate", () => {
      const r = computeScaledAmount(0.1, "kg/L", 100);
      expect(r!.amount).toBe("10.00");
      expect(r!.unit).toBe("kg");
      expect(r!.rawAmount).toBe(10000); // canonical = grams
    });
  });

  describe("mL/L", () => {
    it("returns mL under 1000", () => {
      const r = computeScaledAmount(2, "mL/L", 100);
      expect(r!.amount).toBe("200");
      expect(r!.unit).toBe("mL");
    });

    it("rolls up to liters at 1000mL", () => {
      const r = computeScaledAmount(20, "mL/L", 60);
      // 20 × 60 = 1200 mL → 1.20 L
      expect(r!.amount).toBe("1.20");
      expect(r!.unit).toBe("L");
    });
  });

  describe("L/L (volume ratio for parent batches)", () => {
    it("computes liters from a 1.0 ratio", () => {
      const r = computeScaledAmount(1.0, "L/L", 240);
      expect(r!.amount).toBe("240.0");
      expect(r!.unit).toBe("L");
    });

    it("handles fractional ratios", () => {
      const r = computeScaledAmount(0.85, "L/L", 100);
      expect(r!.amount).toBe("85.0");
    });
  });

  describe("ppm", () => {
    it("computes 30 ppm SO2 in 100L", () => {
      // 30 ppm = 30 mg/L → 3000 mg = 3 g for 100L
      const r = computeScaledAmount(30, "ppm", 100);
      expect(r!.amount).toBe("3.00");
      expect(r!.unit).toBe("g");
    });

    it("returns mg for amounts under 1g", () => {
      // 5 ppm × 100L = 500 mg = 0.5 g — should show in mg
      const r = computeScaledAmount(5, "ppm", 100);
      expect(r!.amount).toBe("500");
      expect(r!.unit).toBe("mg");
    });
  });

  describe("%v/v", () => {
    it("returns the percentage as-is plus computed L volume", () => {
      const r = computeScaledAmount(2.5, "%v/v", 200);
      expect(r!.unit).toBe("%");
      expect(r!.amount).toBe("2.5");
      // raw = 2.5% of 200L = 5L
      expect(r!.rawAmount).toBe(5);
      expect(r!.rawUnit).toBe("L");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for null rate", () => {
      expect(computeScaledAmount(null, "g/L", 100)).toBeNull();
      expect(computeScaledAmount(undefined, "g/L", 100)).toBeNull();
    });

    it("returns null for missing unit", () => {
      expect(computeScaledAmount(10, null, 100)).toBeNull();
      expect(computeScaledAmount(10, "", 100)).toBeNull();
    });

    it("returns null for non-positive batch volume", () => {
      expect(computeScaledAmount(10, "g/L", 0)).toBeNull();
      expect(computeScaledAmount(10, "g/L", -5)).toBeNull();
    });

    it("returns null for negative rate", () => {
      expect(computeScaledAmount(-5, "g/L", 100)).toBeNull();
    });

    it("returns null for unknown unit", () => {
      expect(computeScaledAmount(10, "fluffs/L", 100)).toBeNull();
    });

    it("returns null for non-finite rate", () => {
      expect(computeScaledAmount(NaN, "g/L", 100)).toBeNull();
      expect(computeScaledAmount(Infinity, "g/L", 100)).toBeNull();
    });
  });

  describe("no floating-point drift on common values", () => {
    it("doesn't accumulate drift on 9 g/L × 120L", () => {
      // The exact case the user works with for cane sugar
      const r = computeScaledAmount(9, "g/L", 120);
      // 9 × 120 = exactly 1080 → rolls up to kg (1.08)
      expect(r!.amount).toBe("1.08");
      expect(r!.unit).toBe("kg");
      expect(r!.rawAmount).toBe(1080);
    });

    it("100 g/L × 1000L = 100 kg", () => {
      const r = computeScaledAmount(100, "g/L", 1000);
      expect(r!.amount).toBe("100.00");
      expect(r!.unit).toBe("kg");
    });
  });
});
