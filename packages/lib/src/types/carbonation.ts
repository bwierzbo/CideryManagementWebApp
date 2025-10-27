/**
 * Carbonation-related types and constants for cider production
 */

export type CarbonationMethod = "natural" | "forced" | "none";
export type CarbonationProcessType = "headspace" | "inline" | "stone";
export type CarbonationQuality =
  | "pass"
  | "fail"
  | "needs_adjustment"
  | "in_progress";

/**
 * CO2 volume ranges for different cider styles
 * 1 volume = 1 liter of CO2 per 1 liter of liquid
 */
export const CO2_RANGES = {
  still: { min: 0, max: 1.0, label: "Still" },
  petillant: { min: 1.0, max: 2.5, label: "Pétillant (slightly sparkling)" },
  sparkling: { min: 2.5, max: 4.0, label: "Sparkling" },
} as const;

/**
 * Temperature factors for Henry's Law
 * Values represent volumes of CO2 dissolved per PSI at different temperatures
 * Formula: CO2 volumes = (Pressure PSI + 14.7) × Temperature Factor
 */
export const TEMP_FACTORS_CELSIUS = {
  0: 0.166, // 32°F
  2: 0.154, // 36°F
  4: 0.142, // 39°F - Most common carbonation temp
  6: 0.13, // 43°F
  8: 0.119, // 46°F
  10: 0.107, // 50°F
  12: 0.096, // 54°F
  15: 0.081, // 59°F
} as const;

/**
 * Typical pressure ranges for cider carbonation (PSI)
 */
export const PRESSURE_RANGES = {
  still: { min: 0, max: 5 },
  petillant: { min: 5, max: 15 },
  sparkling: { min: 15, max: 30 },
} as const;

/**
 * Safe operating limits
 */
export const SAFETY_LIMITS = {
  maxPressurePSI: 50, // Absolute maximum
  minTemperatureC: -5, // Below this risks freezing
  maxTemperatureC: 25, // Above this poor CO2 absorption
  optimalTempRangeC: [0, 10] as const, // Best range for carbonation
} as const;

/**
 * Calculate required pressure (PSI) to achieve target CO2 volumes at a given temperature
 *
 * Uses Henry's Law: CO2 volumes = (Pressure PSI + 14.7) × Temperature Factor
 * Rearranged: Pressure PSI = (CO2 volumes / Temperature Factor) - 14.7
 *
 * @param targetVolumes - Desired CO2 volumes (e.g., 2.5 for sparkling cider)
 * @param temperatureC - Liquid temperature in Celsius
 * @returns Required pressure in PSI
 *
 * @example
 * // Calculate pressure for 2.5 volumes at 4°C (typical sparkling cider)
 * const pressure = calculateRequiredPressure(2.5, 4);
 * // Returns ~17.6 PSI
 */
export function calculateRequiredPressure(
  targetVolumes: number,
  temperatureC: number,
): number {
  // Find the closest temperature factor
  const tempFactors = TEMP_FACTORS_CELSIUS;
  const temps = Object.keys(tempFactors)
    .map(Number)
    .sort((a, b) => a - b);

  // Find closest temperature
  let closestTemp = temps[0];
  let minDiff = Math.abs(temperatureC - temps[0]);

  for (const temp of temps) {
    const diff = Math.abs(temperatureC - temp);
    if (diff < minDiff) {
      minDiff = diff;
      closestTemp = temp;
    }
  }

  const factor =
    tempFactors[closestTemp as keyof typeof TEMP_FACTORS_CELSIUS];

  // Calculate pressure using Henry's Law
  // CO2 volumes = (Pressure PSI + 14.7) × Factor
  // Pressure PSI = (CO2 volumes / Factor) - 14.7
  const pressurePSI = targetVolumes / factor - 14.7;

  return Math.max(0, pressurePSI); // Never return negative pressure
}

/**
 * Calculate CO2 volumes achieved at a given pressure and temperature
 *
 * Uses Henry's Law: CO2 volumes = (Pressure PSI + 14.7) × Temperature Factor
 *
 * @param pressurePSI - Applied pressure in PSI
 * @param temperatureC - Liquid temperature in Celsius
 * @returns Achieved CO2 volumes
 *
 * @example
 * // Calculate volumes at 15 PSI and 4°C
 * const volumes = calculateCO2Volumes(15, 4);
 * // Returns ~4.2 volumes
 */
export function calculateCO2Volumes(
  pressurePSI: number,
  temperatureC: number,
): number {
  // Find the closest temperature factor
  const tempFactors = TEMP_FACTORS_CELSIUS;
  const temps = Object.keys(tempFactors)
    .map(Number)
    .sort((a, b) => a - b);

  // Find closest temperature
  let closestTemp = temps[0];
  let minDiff = Math.abs(temperatureC - temps[0]);

  for (const temp of temps) {
    const diff = Math.abs(temperatureC - temp);
    if (diff < minDiff) {
      minDiff = diff;
      closestTemp = temp;
    }
  }

  const factor =
    tempFactors[closestTemp as keyof typeof TEMP_FACTORS_CELSIUS];

  // Calculate CO2 volumes using Henry's Law
  const volumes = (pressurePSI + 14.7) * factor;

  return volumes;
}

/**
 * Get the cider style category based on CO2 volumes
 *
 * @param volumes - CO2 volumes in the cider
 * @returns Style category: "still", "petillant", or "sparkling"
 *
 * @example
 * getCiderStyle(0.5); // Returns "still"
 * getCiderStyle(2.0); // Returns "petillant"
 * getCiderStyle(3.5); // Returns "sparkling"
 */
export function getCiderStyle(
  volumes: number,
): "still" | "petillant" | "sparkling" {
  if (volumes <= CO2_RANGES.still.max) return "still";
  if (volumes <= CO2_RANGES.petillant.max) return "petillant";
  return "sparkling";
}

/**
 * Validate that a pressure is safe for a given vessel
 *
 * @param pressurePSI - Pressure to validate
 * @param vesselMaxPressure - Maximum safe pressure for the vessel
 * @returns Object with isValid flag and optional error message
 *
 * @example
 * validatePressure(20, 30); // { isValid: true }
 * validatePressure(35, 30); // { isValid: false, error: "Pressure exceeds vessel max..." }
 */
export function validatePressure(
  pressurePSI: number,
  vesselMaxPressure: number,
): { isValid: boolean; error?: string } {
  if (pressurePSI < 0) {
    return { isValid: false, error: "Pressure cannot be negative" };
  }

  if (pressurePSI > SAFETY_LIMITS.maxPressurePSI) {
    return {
      isValid: false,
      error: `Pressure ${pressurePSI} PSI exceeds absolute maximum of ${SAFETY_LIMITS.maxPressurePSI} PSI`,
    };
  }

  if (pressurePSI > vesselMaxPressure) {
    return {
      isValid: false,
      error: `Pressure ${pressurePSI} PSI exceeds vessel maximum of ${vesselMaxPressure} PSI`,
    };
  }

  return { isValid: true };
}

/**
 * Validate that a temperature is safe for carbonation
 *
 * @param temperatureC - Temperature in Celsius
 * @returns Object with isValid flag and optional error/warning message
 *
 * @example
 * validateTemperature(4); // { isValid: true }
 * validateTemperature(-6); // { isValid: false, error: "Temperature too low..." }
 * validateTemperature(20); // { isValid: true, warning: "Temperature above optimal..." }
 */
export function validateTemperature(temperatureC: number): {
  isValid: boolean;
  error?: string;
  warning?: string;
} {
  if (temperatureC < SAFETY_LIMITS.minTemperatureC) {
    return {
      isValid: false,
      error: `Temperature ${temperatureC}°C is below minimum safe temperature of ${SAFETY_LIMITS.minTemperatureC}°C (risk of freezing)`,
    };
  }

  if (temperatureC > SAFETY_LIMITS.maxTemperatureC) {
    return {
      isValid: false,
      error: `Temperature ${temperatureC}°C exceeds maximum safe temperature of ${SAFETY_LIMITS.maxTemperatureC}°C (poor CO2 absorption)`,
    };
  }

  const [optimalMin, optimalMax] = SAFETY_LIMITS.optimalTempRangeC;
  if (temperatureC < optimalMin || temperatureC > optimalMax) {
    return {
      isValid: true,
      warning: `Temperature ${temperatureC}°C is outside optimal range of ${optimalMin}-${optimalMax}°C. Carbonation may be less efficient.`,
    };
  }

  return { isValid: true };
}
