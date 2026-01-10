/**
 * SG Calibration System
 *
 * Provides calibration and correction functions for refractometer readings.
 * Refractometers give incorrect readings during fermentation because alcohol
 * affects the refractive index. This module provides:
 *
 * 1. Linear regression to fit calibration coefficients from paired readings
 * 2. Refractometer correction using those coefficients
 * 3. Master correction function for all SG measurements
 */

import { correctSgForTemperature, DEFAULT_CALIBRATION_TEMP_C } from "./sg-correction";

// ========== Types ==========

export interface CalibrationReading {
  originalGravity: number;
  refractometerReading: number;
  hydrometerReading: number;
  temperatureC: number;
  isFreshJuice?: boolean;
}

export interface CalibrationCoefficients {
  a: number; // Coefficient for refractometer reading
  b: number; // Coefficient for original gravity
  c: number; // Constant term
}

export interface CalibrationResult {
  coefficients: CalibrationCoefficients;
  rSquared: number;
  maxError: number;
  avgError: number;
  predictions: Array<{
    actual: number;
    predicted: number;
    error: number;
  }>;
}

export interface SGCorrectionInput {
  instrumentType: "hydrometer" | "refractometer";
  rawReading: number;
  temperatureC: number;
  originalGravity?: number;
  isFreshJuice?: boolean;
  calibration?: {
    hydrometerCalibrationTempC: number;
    refractometerBaselineOffset: number;
    linearCoefficients: CalibrationCoefficients | null;
  };
}

export interface SGCorrectionResult {
  correctedSG: number;
  rawReading: number;
  corrections: {
    temp?: number;
    alcohol?: number;
    baseline?: number;
  };
}

// ========== Hydrometer Temperature Correction ==========

/**
 * Simple hydrometer temperature correction
 * Uses the approximation: ~0.0002 SG per degree C deviation from calibration temp
 *
 * @param reading - Raw hydrometer reading
 * @param tempC - Measurement temperature in Celsius
 * @param calibrationTempC - Hydrometer calibration temperature (typically 15-20 C)
 * @returns Temperature-corrected SG
 */
export function correctHydrometerTemp(
  reading: number,
  tempC: number,
  calibrationTempC: number = DEFAULT_CALIBRATION_TEMP_C
): number {
  // Use the existing comprehensive correction function from sg-correction.ts
  return correctSgForTemperature(reading, tempC, calibrationTempC);
}

// ========== Refractometer Correction ==========

/**
 * Correct refractometer reading using calibrated linear model
 * Formula: Corrected_SG = a * refrac + b * OG + c
 *
 * @param reading - Raw refractometer reading (in SG, e.g., 1.020)
 * @param originalGravity - Original gravity of the batch
 * @param coefficients - Fitted linear coefficients {a, b, c}
 * @param baselineOffset - Optional baseline offset from fresh juice calibration
 * @returns Corrected specific gravity
 */
export function correctRefractometer(
  reading: number,
  originalGravity: number,
  coefficients: CalibrationCoefficients,
  baselineOffset: number = 0
): number {
  // Apply baseline offset first (from fresh juice calibration)
  const adjusted = reading - baselineOffset;

  // Apply linear correction
  const corrected =
    coefficients.a * adjusted + coefficients.b * originalGravity + coefficients.c;

  // Round to 4 decimal places (standard SG precision)
  return Math.round(corrected * 10000) / 10000;
}

/**
 * Alternative: Terrill formula for refractometer correction
 * A well-known formula that works reasonably well without calibration
 *
 * @param og - Original gravity
 * @param refracSG - Refractometer reading in SG
 * @returns Corrected specific gravity
 */
export function terrillCorrection(og: number, refracSG: number): number {
  // Convert SG to Brix for the formula
  const ogBrix = (og - 1) * 250;
  const refracBrix = (refracSG - 1) * 250;

  // Terrill formula
  const corrected =
    1.001843 -
    0.002318474 * ogBrix -
    0.000007775 * ogBrix ** 2 -
    0.000000034 * ogBrix ** 3 +
    0.00574 * refracBrix +
    0.00003344 * refracBrix ** 2 +
    0.000000086 * refracBrix ** 3;

  return Math.round(corrected * 10000) / 10000;
}

// ========== Linear Regression ==========

/**
 * Solve a 3x3 linear system using Gaussian elimination
 * Used for least squares normal equations
 */
function solve3x3(A: number[][], b: number[]): number[] {
  // Create augmented matrix
  const M = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];

  // Forward elimination
  for (let i = 0; i < 3; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [M[i], M[maxRow]] = [M[maxRow], M[i]];

    // Check for zero pivot
    if (Math.abs(M[i][i]) < 1e-10) {
      throw new Error("Matrix is singular or nearly singular");
    }

    // Eliminate column
    for (let k = i + 1; k < 3; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // Back substitution
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = M[i][3];
    for (let j = i + 1; j < 3; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

/**
 * Calculate linear calibration coefficients from paired readings
 * Uses least squares regression: y = a*x1 + b*x2 + c
 * Where x1 = refractometer, x2 = OG, y = actual SG (hydrometer corrected)
 *
 * @param readings - Array of calibration readings with hydrometer already temp-corrected
 * @returns Calibration result with coefficients, R-squared, and error metrics
 */
export function calculateLinearCalibration(
  readings: Array<{
    originalGravity: number;
    refractometerReading: number;
    hydrometerCorrected: number;
  }>
): CalibrationResult {
  const n = readings.length;

  if (n < 3) {
    throw new Error("Need at least 3 readings to calculate calibration");
  }

  // Build matrices for normal equations: (X^T * X) * coeffs = X^T * y
  // X = [refrac, og, 1] for each reading
  // y = hydrometer corrected

  // Calculate sums for normal equations
  let sumX1 = 0,
    sumX2 = 0,
    sumY = 0;
  let sumX1X1 = 0,
    sumX1X2 = 0,
    sumX2X2 = 0;
  let sumX1Y = 0,
    sumX2Y = 0;

  for (const r of readings) {
    const x1 = r.refractometerReading;
    const x2 = r.originalGravity;
    const y = r.hydrometerCorrected;

    sumX1 += x1;
    sumX2 += x2;
    sumY += y;
    sumX1X1 += x1 * x1;
    sumX1X2 += x1 * x2;
    sumX2X2 += x2 * x2;
    sumX1Y += x1 * y;
    sumX2Y += x2 * y;
  }

  // Normal equations: (X^T * X) * [a, b, c]^T = X^T * y
  const XtX = [
    [sumX1X1, sumX1X2, sumX1],
    [sumX1X2, sumX2X2, sumX2],
    [sumX1, sumX2, n],
  ];
  const XtY = [sumX1Y, sumX2Y, sumY];

  // Solve for coefficients
  const [a, b, c] = solve3x3(XtX, XtY);

  // Calculate predictions and errors
  const predictions: CalibrationResult["predictions"] = [];
  let ssRes = 0; // Sum of squared residuals
  let ssTot = 0; // Total sum of squares
  const yMean = sumY / n;
  let maxAbsError = 0;
  let sumAbsError = 0;

  for (const r of readings) {
    const predicted =
      a * r.refractometerReading + b * r.originalGravity + c;
    const error = predicted - r.hydrometerCorrected;
    const absError = Math.abs(error);

    predictions.push({
      actual: Math.round(r.hydrometerCorrected * 10000) / 10000,
      predicted: Math.round(predicted * 10000) / 10000,
      error: Math.round(error * 10000) / 10000,
    });

    ssRes += error * error;
    ssTot += (r.hydrometerCorrected - yMean) ** 2;
    maxAbsError = Math.max(maxAbsError, absError);
    sumAbsError += absError;
  }

  // R-squared: 1 - (SS_res / SS_tot)
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  return {
    coefficients: {
      a: Math.round(a * 10000) / 10000,
      b: Math.round(b * 10000) / 10000,
      c: Math.round(c * 10000) / 10000,
    },
    rSquared: Math.round(rSquared * 10000) / 10000,
    maxError: Math.round(maxAbsError * 10000) / 10000,
    avgError: Math.round((sumAbsError / n) * 10000) / 10000,
    predictions,
  };
}

/**
 * Prepare calibration readings by applying temperature correction to hydrometer readings
 *
 * @param readings - Raw calibration readings
 * @param hydrometerCalibrationTempC - Hydrometer calibration temperature
 * @returns Readings with hydrometer values temperature-corrected
 */
export function prepareCalibrationReadings(
  readings: CalibrationReading[],
  hydrometerCalibrationTempC: number = DEFAULT_CALIBRATION_TEMP_C
): Array<{
  originalGravity: number;
  refractometerReading: number;
  hydrometerCorrected: number;
}> {
  return readings.map((r) => ({
    originalGravity: r.originalGravity,
    refractometerReading: r.refractometerReading,
    hydrometerCorrected: correctHydrometerTemp(
      r.hydrometerReading,
      r.temperatureC,
      hydrometerCalibrationTempC
    ),
  }));
}

// ========== Master Correction Function ==========

/**
 * Apply all applicable corrections to an SG measurement
 * This is the main entry point for correcting measurements in the application
 *
 * @param input - Measurement details and calibration settings
 * @returns Corrected SG and breakdown of corrections applied
 */
export function applySGCorrection(input: SGCorrectionInput): SGCorrectionResult {
  const corrections: SGCorrectionResult["corrections"] = {};
  let correctedSG = input.rawReading;

  if (input.instrumentType === "hydrometer") {
    // Hydrometer: Apply temperature correction
    const calibTempC =
      input.calibration?.hydrometerCalibrationTempC ?? DEFAULT_CALIBRATION_TEMP_C;

    const tempCorrected = correctHydrometerTemp(
      input.rawReading,
      input.temperatureC,
      calibTempC
    );

    corrections.temp = Math.round((tempCorrected - input.rawReading) * 10000) / 10000;
    correctedSG = tempCorrected;
  } else if (input.instrumentType === "refractometer") {
    // Refractometer: Apply calibration correction if available

    if (input.isFreshJuice) {
      // Fresh juice - no alcohol correction needed
      // Just apply baseline offset if available
      const baselineOffset = input.calibration?.refractometerBaselineOffset ?? 0;
      if (baselineOffset !== 0) {
        corrections.baseline = -baselineOffset;
        correctedSG = input.rawReading - baselineOffset;
      }
    } else if (input.originalGravity && input.calibration?.linearCoefficients) {
      // Fermenting/fermented - apply full calibration
      const baselineOffset = input.calibration.refractometerBaselineOffset ?? 0;
      const coefficients = input.calibration.linearCoefficients;

      const corrected = correctRefractometer(
        input.rawReading,
        input.originalGravity,
        coefficients,
        baselineOffset
      );

      // Calculate the alcohol correction component
      // (difference between raw and corrected, minus baseline if any)
      const totalCorrection = corrected - input.rawReading;
      if (baselineOffset !== 0) {
        corrections.baseline = -baselineOffset;
        corrections.alcohol = totalCorrection + baselineOffset;
      } else {
        corrections.alcohol = totalCorrection;
      }

      correctedSG = corrected;
    } else if (input.originalGravity) {
      // No calibration available - use Terrill formula as fallback
      const corrected = terrillCorrection(input.originalGravity, input.rawReading);
      corrections.alcohol = Math.round((corrected - input.rawReading) * 10000) / 10000;
      correctedSG = corrected;
    }
    // If no OG and not fresh juice, no correction can be applied
  }

  return {
    correctedSG: Math.round(correctedSG * 10000) / 10000,
    rawReading: input.rawReading,
    corrections,
  };
}

/**
 * Format corrections for display to user
 * e.g., "Corrected SG: 1.012 (raw: 1.020, temp: +0.002, alcohol: -0.010)"
 *
 * @param result - Correction result from applySGCorrection
 * @returns Human-readable correction breakdown
 */
export function formatCorrectionBreakdown(result: SGCorrectionResult): string {
  const parts: string[] = [];

  if (result.corrections.temp !== undefined && result.corrections.temp !== 0) {
    const sign = result.corrections.temp >= 0 ? "+" : "";
    parts.push(`temp: ${sign}${result.corrections.temp.toFixed(4)}`);
  }

  if (result.corrections.baseline !== undefined && result.corrections.baseline !== 0) {
    const sign = result.corrections.baseline >= 0 ? "+" : "";
    parts.push(`baseline: ${sign}${result.corrections.baseline.toFixed(4)}`);
  }

  if (result.corrections.alcohol !== undefined && result.corrections.alcohol !== 0) {
    const sign = result.corrections.alcohol >= 0 ? "+" : "";
    parts.push(`alcohol: ${sign}${result.corrections.alcohol.toFixed(4)}`);
  }

  if (parts.length === 0) {
    return `${result.correctedSG.toFixed(4)} (no correction)`;
  }

  return `${result.correctedSG.toFixed(4)} (raw: ${result.rawReading.toFixed(4)}, ${parts.join(", ")})`;
}
