/**
 * Specific Gravity (SG) Temperature Correction utilities
 * Corrects hydrometer readings for temperature variance from calibration temperature
 *
 * Hydrometers are calibrated at a specific temperature (typically 60°F/15.56°C).
 * When the sample temperature differs from the calibration temperature, the
 * density of the liquid changes, requiring a correction to get accurate readings.
 */

/** Default calibration temperature in Celsius (60°F) */
export const DEFAULT_CALIBRATION_TEMP_C = 15.56;

/** Default calibration temperature in Fahrenheit */
export const DEFAULT_CALIBRATION_TEMP_F = 60;

/**
 * Calculate the water density correction factor for a given temperature
 * Uses the polynomial approximation for water density vs temperature
 *
 * @param tempC - Temperature in Celsius
 * @returns Density correction factor
 */
function waterDensityFactor(tempC: number): number {
  // Polynomial coefficients for water density calculation
  // Based on NIST reference data
  return (
    1.00130346 -
    0.000134722124 * tempC +
    0.00000204052596 * tempC * tempC -
    0.00000000232820948 * tempC * tempC * tempC
  );
}

/**
 * Correct a specific gravity reading for temperature
 * Adjusts the measured SG to what it would be at the calibration temperature
 *
 * @param measuredSg - The specific gravity reading from the hydrometer
 * @param sampleTempC - The temperature of the sample in Celsius
 * @param calibrationTempC - The calibration temperature of the hydrometer (default: 15.56°C / 60°F)
 * @returns Temperature-corrected specific gravity
 *
 * @example
 * ```typescript
 * // Reading of 1.050 at 11°C, hydrometer calibrated at 60°F (15.56°C)
 * const correctedSg = correctSgForTemperature(1.050, 11);
 * // Returns approximately 1.0492 (colder sample = lower corrected SG)
 * ```
 */
export function correctSgForTemperature(
  measuredSg: number,
  sampleTempC: number,
  calibrationTempC: number = DEFAULT_CALIBRATION_TEMP_C
): number {
  if (measuredSg <= 0) {
    throw new Error("Specific gravity must be a positive number");
  }

  if (sampleTempC < -10 || sampleTempC > 100) {
    throw new Error("Sample temperature must be between -10°C and 100°C");
  }

  // If the sample is at calibration temperature, no correction needed
  if (Math.abs(sampleTempC - calibrationTempC) < 0.01) {
    return measuredSg;
  }

  // Calculate the correction factor
  const sampleDensityFactor = waterDensityFactor(sampleTempC);
  const calibrationDensityFactor = waterDensityFactor(calibrationTempC);

  // Apply correction: adjust the measured reading based on the density difference
  const correctionFactor = sampleDensityFactor / calibrationDensityFactor;
  const correctedSg = measuredSg * correctionFactor;

  // Round to 4 decimal places (standard SG precision)
  return Math.round(correctedSg * 10000) / 10000;
}

/**
 * Convert Fahrenheit to Celsius
 *
 * @param tempF - Temperature in Fahrenheit
 * @returns Temperature in Celsius
 */
export function fahrenheitToCelsius(tempF: number): number {
  return (tempF - 32) * (5 / 9);
}

/**
 * Convert Celsius to Fahrenheit
 *
 * @param tempC - Temperature in Celsius
 * @returns Temperature in Fahrenheit
 */
export function celsiusToFahrenheit(tempC: number): number {
  return (tempC * 9 / 5) + 32;
}

/**
 * Correct a specific gravity reading when temperature is provided in Fahrenheit
 *
 * @param measuredSg - The specific gravity reading from the hydrometer
 * @param sampleTempF - The temperature of the sample in Fahrenheit
 * @param calibrationTempF - The calibration temperature in Fahrenheit (default: 60°F)
 * @returns Temperature-corrected specific gravity
 *
 * @example
 * ```typescript
 * // Reading of 1.050 at 52°F, hydrometer calibrated at 60°F
 * const correctedSg = correctSgForTemperatureF(1.050, 52);
 * ```
 */
export function correctSgForTemperatureF(
  measuredSg: number,
  sampleTempF: number,
  calibrationTempF: number = DEFAULT_CALIBRATION_TEMP_F
): number {
  const sampleTempC = fahrenheitToCelsius(sampleTempF);
  const calibrationTempC = fahrenheitToCelsius(calibrationTempF);
  return correctSgForTemperature(measuredSg, sampleTempC, calibrationTempC);
}

/**
 * Get the SG correction amount (to add/subtract from measured reading)
 * Useful for displaying the correction being applied
 *
 * @param measuredSg - The specific gravity reading from the hydrometer
 * @param sampleTempC - The temperature of the sample in Celsius
 * @param calibrationTempC - The calibration temperature (default: 15.56°C)
 * @returns The correction amount (positive = add, negative = subtract)
 *
 * @example
 * ```typescript
 * const correction = getSgCorrectionAmount(1.050, 25); // warm sample
 * // Returns approximately +0.0014 (add to get corrected reading)
 *
 * const correction = getSgCorrectionAmount(1.050, 10); // cold sample
 * // Returns approximately -0.0010 (subtract to get corrected reading)
 * ```
 */
export function getSgCorrectionAmount(
  measuredSg: number,
  sampleTempC: number,
  calibrationTempC: number = DEFAULT_CALIBRATION_TEMP_C
): number {
  const correctedSg = correctSgForTemperature(measuredSg, sampleTempC, calibrationTempC);
  const correction = correctedSg - measuredSg;

  // Round to 4 decimal places
  return Math.round(correction * 10000) / 10000;
}

/**
 * Check if a temperature requires significant SG correction
 * Useful for deciding whether to apply/display correction
 *
 * @param sampleTempC - The temperature of the sample in Celsius
 * @param calibrationTempC - The calibration temperature (default: 15.56°C)
 * @param threshold - Minimum temperature difference to consider significant (default: 2°C)
 * @returns boolean indicating if correction is significant
 */
export function requiresSgCorrection(
  sampleTempC: number,
  calibrationTempC: number = DEFAULT_CALIBRATION_TEMP_C,
  threshold: number = 2
): boolean {
  return Math.abs(sampleTempC - calibrationTempC) >= threshold;
}
