/**
 * Recipe scaling — converts a per-liter rate into the absolute amount for a
 * given target batch volume. The whole point of recipes being scale-invariant
 * is that "75 g/L of strawberries" works at any scale; this function answers
 * "how many grams (or kg) is that for a 240L batch?"
 *
 * Used by:
 *   - Recipe detail page volume preview
 *   - Phase 2 batch wizard at instantiation time
 *
 * Pure function, no side effects, no DB. Easy to unit test.
 */

export type RateUnit = "g/L" | "kg/L" | "mL/L" | "L/L" | "ppm" | "%v/v";

export interface ScaledAmount {
  /** Amount as a string with sensible precision for display. */
  amount: string;
  /** Display unit (may roll up — e.g. g → kg above 1000g). */
  unit: string;
  /** Raw amount in the canonical base unit (grams, mL, L, %), for math. */
  rawAmount: number;
  /** Canonical base unit. */
  rawUnit: "g" | "mL" | "L" | "%";
}

/**
 * Compute the absolute amount of an ingredient needed for a batch.
 *
 * @example
 *   computeScaledAmount(75, "g/L", 240)
 *   // → { amount: "18.00", unit: "kg", rawAmount: 18000, rawUnit: "g" }
 *
 * @example
 *   computeScaledAmount(9, "g/L", 120)
 *   // → { amount: "1080", unit: "g", rawAmount: 1080, rawUnit: "g" }
 *
 * @example
 *   computeScaledAmount(30, "ppm", 1000)
 *   // → { amount: "30.00", unit: "g", rawAmount: 30, rawUnit: "g" }
 *   // (30 ppm = 30 mg/L × 1000 L = 30,000 mg = 30 g)
 *
 * Returns null when the inputs are unusable (null rate, unknown unit,
 * non-positive volume).
 */
export function computeScaledAmount(
  rateValue: number | null | undefined,
  rateUnit: string | null | undefined,
  batchVolumeL: number,
): ScaledAmount | null {
  if (rateValue === null || rateValue === undefined) return null;
  if (!rateUnit) return null;
  if (!Number.isFinite(batchVolumeL) || batchVolumeL <= 0) return null;
  if (!Number.isFinite(rateValue) || rateValue < 0) return null;

  switch (rateUnit) {
    case "g/L": {
      const g = rateValue * batchVolumeL;
      // Roll up to kg over 1000g. Cleaner display, no precision loss.
      if (g >= 1000) {
        return { amount: (g / 1000).toFixed(2), unit: "kg", rawAmount: g, rawUnit: "g" };
      }
      // For sub-gram amounts keep 2 decimals; for whole grams round to int.
      return {
        amount: g >= 10 ? g.toFixed(0) : g.toFixed(2),
        unit: "g",
        rawAmount: g,
        rawUnit: "g",
      };
    }
    case "kg/L": {
      const kg = rateValue * batchVolumeL;
      return {
        amount: kg.toFixed(2),
        unit: "kg",
        rawAmount: kg * 1000, // canonical = grams
        rawUnit: "g",
      };
    }
    case "mL/L": {
      const ml = rateValue * batchVolumeL;
      if (ml >= 1000) {
        return { amount: (ml / 1000).toFixed(2), unit: "L", rawAmount: ml, rawUnit: "mL" };
      }
      return {
        amount: ml >= 10 ? ml.toFixed(0) : ml.toFixed(2),
        unit: "mL",
        rawAmount: ml,
        rawUnit: "mL",
      };
    }
    case "L/L": {
      const l = rateValue * batchVolumeL;
      return { amount: l.toFixed(1), unit: "L", rawAmount: l, rawUnit: "L" };
    }
    case "ppm": {
      // 1 ppm = 1 mg/L. So total milligrams = rate × volumeL → grams = mg / 1000.
      const g = (rateValue * batchVolumeL) / 1000;
      if (g < 1) {
        return {
          amount: (g * 1000).toFixed(0),
          unit: "mg",
          rawAmount: g, // canonical = grams
          rawUnit: "g",
        };
      }
      return { amount: g.toFixed(2), unit: "g", rawAmount: g, rawUnit: "g" };
    }
    case "%v/v": {
      // Concentration — display the percentage as-is. Absolute volume is
      // (rate / 100) × batchVolumeL. Caller may want either; we expose both.
      return {
        amount: rateValue.toFixed(1),
        unit: "%",
        rawAmount: (rateValue / 100) * batchVolumeL,
        rawUnit: "L",
      };
    }
    default:
      return null;
  }
}
