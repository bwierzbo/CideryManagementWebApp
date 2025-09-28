/**
 * Yield calculation utilities for cidery production efficiency
 * Tracks juice extraction rates and variance from expected yields
 */

/**
 * Calculate actual juice yield per kilogram of apples
 *
 * @param juiceVolumeL - Total juice volume produced in liters
 * @param inputWeightKg - Total apple weight processed in kilograms
 * @returns Yield in liters per kilogram (L/kg)
 *
 * @example
 * ```typescript
 * const yield = calcActualLPerKg(300, 500); // Returns 0.60 L/kg
 * ```
 */
export function calcActualLPerKg(
  juiceVolumeL: number,
  inputWeightKg: number,
): number {
  if (juiceVolumeL < 0) {
    throw new Error("Juice volume must be non-negative");
  }

  if (inputWeightKg <= 0) {
    throw new Error("Input weight must be positive");
  }

  if (juiceVolumeL > inputWeightKg * 2) {
    throw new Error(
      "Juice volume cannot exceed twice the input weight (physically impossible)",
    );
  }

  const yieldRatio = juiceVolumeL / inputWeightKg;

  // Round to 4 decimal places for precision
  return Math.round(yieldRatio * 10000) / 10000;
}

/**
 * Calculate variance percentage between actual and expected values
 * Positive values indicate overperformance, negative indicate underperformance
 *
 * @param actual - Actual measured value
 * @param expected - Expected or target value
 * @returns Variance as a percentage (e.g., 15.5 for +15.5% variance)
 *
 * @example
 * ```typescript
 * const variance = calcVariancePct(0.65, 0.60); // Returns 8.33 (+8.33% over expected)
 * const variance = calcVariancePct(0.55, 0.60); // Returns -8.33 (-8.33% under expected)
 * ```
 */
export function calcVariancePct(actual: number, expected: number): number {
  if (expected === 0) {
    throw new Error("Expected value cannot be zero for variance calculation");
  }

  if (actual < 0 || expected < 0) {
    throw new Error("Values must be non-negative for variance calculation");
  }

  const variance = ((actual - expected) / expected) * 100;

  // Round to 2 decimal places
  return Math.round(variance * 100) / 100;
}

/**
 * Calculate juice extraction efficiency based on apple variety typical yields
 * Different apple varieties have different expected yield rates
 *
 * @param actualYield - Actual yield achieved (L/kg)
 * @param varietyExpectedYield - Expected yield for the apple variety (L/kg)
 * @returns Efficiency percentage (100% = meeting expectations)
 */
export function calculateExtractionEfficiency(
  actualYield: number,
  varietyExpectedYield: number,
): number {
  const efficiency = (actualYield / varietyExpectedYield) * 100;

  return Math.round(efficiency * 100) / 100;
}

/**
 * Get typical yield ranges for common apple varieties
 * Based on industry standards and variety characteristics
 *
 * @param varietyName - Name of the apple variety
 * @returns Object with min, max, and typical yield in L/kg
 */
export function getVarietyYieldRange(varietyName: string): {
  min: number;
  max: number;
  typical: number;
} {
  const varietyYields: Record<
    string,
    { min: number; max: number; typical: number }
  > = {
    Honeycrisp: { min: 0.55, max: 0.7, typical: 0.62 },
    "Granny Smith": { min: 0.58, max: 0.72, typical: 0.65 },
    Gala: { min: 0.52, max: 0.68, typical: 0.6 },
    Fuji: { min: 0.5, max: 0.65, typical: 0.58 },
    "Northern Spy": { min: 0.6, max: 0.75, typical: 0.68 },
    "Rhode Island Greening": { min: 0.62, max: 0.78, typical: 0.7 },
    McIntosh: { min: 0.55, max: 0.7, typical: 0.63 },
    "Red Delicious": { min: 0.48, max: 0.62, typical: 0.55 },
    "Golden Delicious": { min: 0.52, max: 0.66, typical: 0.59 },
    Braeburn: { min: 0.54, max: 0.68, typical: 0.61 },
  };

  // Default to generic apple if variety not found
  return varietyYields[varietyName] || { min: 0.5, max: 0.7, typical: 0.6 };
}

/**
 * Calculate total potential juice volume from apple inventory
 * Useful for production planning
 *
 * @param appleInventory - Array of apple lots with weight and variety
 * @returns Total expected juice volume in liters
 */
export function calculatePotentialJuiceVolume(
  appleInventory: Array<{ weightKg: number; variety: string }>,
): number {
  let totalPotentialL = 0;

  for (const lot of appleInventory) {
    if (lot.weightKg <= 0) {
      throw new Error("Apple lot weight must be positive");
    }

    const varietyYield = getVarietyYieldRange(lot.variety);
    totalPotentialL += lot.weightKg * varietyYield.typical;
  }

  return Math.round(totalPotentialL * 100) / 100;
}

/**
 * Assess yield performance category
 * Provides qualitative assessment of yield performance
 *
 * @param efficiency - Efficiency percentage from calculateExtractionEfficiency
 * @returns Performance category string
 */
export function getYieldPerformanceCategory(efficiency: number): string {
  if (efficiency >= 110) return "Exceptional";
  if (efficiency >= 100) return "Excellent";
  if (efficiency >= 90) return "Good";
  if (efficiency >= 80) return "Fair";
  if (efficiency >= 70) return "Poor";
  return "Very Poor";
}

/**
 * Calculate weighted average yield across multiple press runs
 * Accounts for different volumes in each run
 *
 * @param pressRuns - Array of press runs with volume and weight data
 * @returns Weighted average yield in L/kg
 */
export function calculateWeightedAverageYield(
  pressRuns: Array<{ juiceVolumeL: number; inputWeightKg: number }>,
): number {
  if (pressRuns.length === 0) {
    throw new Error("Cannot calculate average yield from empty array");
  }

  let totalJuice = 0;
  let totalWeight = 0;

  for (const run of pressRuns) {
    if (run.inputWeightKg <= 0 || run.juiceVolumeL < 0) {
      throw new Error(
        "All press runs must have positive weight and non-negative juice volume",
      );
    }

    totalJuice += run.juiceVolumeL;
    totalWeight += run.inputWeightKg;
  }

  return calcActualLPerKg(totalJuice, totalWeight);
}
