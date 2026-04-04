/**
 * SO2 (Sulfite) Calculations for Cider/Wine Production
 *
 * Calculates Potassium Metabisulfite (KMS) additions to achieve target
 * free SO2 levels. Uses Henderson-Hasselbalch equation for molecular SO2.
 */

/** KMS is 57.6% SO2 by molecular weight (K2S2O5 → 2SO2) */
export const KMS_SO2_EFFICIENCY = 0.576;

/** pKa1 for bisulfite/molecular SO2 equilibrium at ~20°C */
export const SO2_PKA1 = 1.81;

/** Optimal molecular SO2 range in ppm */
export const MOLECULAR_SO2_MIN = 0.5;
export const MOLECULAR_SO2_MAX = 0.8;

/** Validation ranges */
export const SO2_PH_MIN = 2.8;
export const SO2_PH_MAX = 4.5;
export const SO2_FREE_MIN = 0;
export const SO2_FREE_MAX = 200;

export interface SO2CalculationInput {
  targetFreeSO2Ppm: number;
  currentFreeSO2Ppm: number;
  pH: number;
  volumeLiters: number;
}

export interface SO2CalculationResult {
  kmsGrams: number;
  so2PpmAdded: number;
  molecularSO2Ppm: number;
  warnings: string[];
}

export interface SO2ValidationResult {
  valid: boolean;
  errors: string[];
}

export type MolecularSO2Status = "low" | "optimal" | "high";

export interface MolecularSO2StatusResult {
  status: MolecularSO2Status;
  message: string;
}

/**
 * Calculate grams of KMS needed to achieve a target SO2 addition in ppm.
 *
 * Formula: grams = (ppm × liters) / (1000 × 0.576)
 */
export function calculateKMSGrams(so2Ppm: number, volumeL: number): number {
  if (so2Ppm <= 0 || volumeL <= 0) return 0;
  return (so2Ppm * volumeL) / (1000 * KMS_SO2_EFFICIENCY);
}

/**
 * Calculate molecular SO2 from free SO2 and pH using Henderson-Hasselbalch.
 *
 * molecular SO2 = freeSO2 / (1 + 10^(pH - pKa1))
 */
export function calculateMolecularSO2(
  freeSO2Ppm: number,
  pH: number,
): number {
  if (freeSO2Ppm <= 0) return 0;
  return freeSO2Ppm / (1 + Math.pow(10, pH - SO2_PKA1));
}

/**
 * Validate SO2 calculation inputs.
 */
export function validateSO2Input(
  input: SO2CalculationInput,
): SO2ValidationResult {
  const errors: string[] = [];

  if (input.pH < SO2_PH_MIN || input.pH > SO2_PH_MAX) {
    errors.push(`pH must be between ${SO2_PH_MIN} and ${SO2_PH_MAX}`);
  }
  if (input.targetFreeSO2Ppm < SO2_FREE_MIN || input.targetFreeSO2Ppm > SO2_FREE_MAX) {
    errors.push(`Target free SO2 must be between ${SO2_FREE_MIN} and ${SO2_FREE_MAX} ppm`);
  }
  if (input.currentFreeSO2Ppm < SO2_FREE_MIN || input.currentFreeSO2Ppm > SO2_FREE_MAX) {
    errors.push(`Current free SO2 must be between ${SO2_FREE_MIN} and ${SO2_FREE_MAX} ppm`);
  }
  if (input.currentFreeSO2Ppm > input.targetFreeSO2Ppm) {
    errors.push("Current free SO2 is already above target");
  }
  if (input.volumeLiters <= 0) {
    errors.push("Batch volume must be greater than 0");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate full SO2 addition details including KMS grams, molecular SO2,
 * and any warnings.
 */
export function calculateSO2Addition(
  input: SO2CalculationInput,
): SO2CalculationResult {
  const so2PpmAdded = input.targetFreeSO2Ppm - input.currentFreeSO2Ppm;
  const kmsGrams = calculateKMSGrams(so2PpmAdded, input.volumeLiters);
  const molecularSO2Ppm = calculateMolecularSO2(input.targetFreeSO2Ppm, input.pH);

  const warnings: string[] = [];

  if (input.pH >= 3.8) {
    warnings.push(
      `High pH (${input.pH}) — molecular SO2 will be very low. Consider acidifying first.`,
    );
  }

  const status = getMolecularSO2Status(molecularSO2Ppm);
  if (status.status === "low") {
    warnings.push(
      `Molecular SO2 (${molecularSO2Ppm.toFixed(2)} ppm) is below optimal range (${MOLECULAR_SO2_MIN}–${MOLECULAR_SO2_MAX} ppm).`,
    );
  } else if (status.status === "high") {
    warnings.push(
      `Molecular SO2 (${molecularSO2Ppm.toFixed(2)} ppm) is above optimal range. May affect flavor/aroma.`,
    );
  }

  return { kmsGrams, so2PpmAdded, molecularSO2Ppm, warnings };
}

/**
 * Get the status classification for a molecular SO2 level.
 */
export function getMolecularSO2Status(ppm: number): MolecularSO2StatusResult {
  if (ppm < MOLECULAR_SO2_MIN) {
    return { status: "low", message: "Below optimal — limited antimicrobial protection" };
  }
  if (ppm > MOLECULAR_SO2_MAX) {
    return { status: "high", message: "Above optimal — may affect flavor/aroma" };
  }
  return { status: "optimal", message: "Optimal antimicrobial protection" };
}

/**
 * Format a human-readable notes string for the additive record.
 */
export function formatSO2Notes(
  input: SO2CalculationInput,
  result: SO2CalculationResult,
): string {
  const parts = [
    `SO2 Calculator: ${result.kmsGrams.toFixed(2)}g KMS`,
    `Target: ${input.targetFreeSO2Ppm} ppm free SO2`,
  ];
  if (input.currentFreeSO2Ppm > 0) {
    parts.push(`Current: ${input.currentFreeSO2Ppm} ppm`);
  }
  parts.push(`pH: ${input.pH}`);
  parts.push(`Molecular SO2: ${result.molecularSO2Ppm.toFixed(2)} ppm`);
  parts.push(`Volume: ${input.volumeLiters.toFixed(1)} L`);
  return parts.join(" | ");
}
