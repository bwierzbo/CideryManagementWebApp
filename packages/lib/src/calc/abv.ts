/**
 * ABV (Alcohol By Volume) calculation utilities for cidery operations
 * Uses specific gravity (SG) readings to calculate alcohol content
 */

import { litersToWineGallons } from "../calculations/ttb";

/**
 * Calculate ABV from original gravity (OG) and final gravity (FG) specific gravity readings
 * Uses the simple formula: ABV = (OG - FG) * 131.25
 *
 * @param og - Original gravity (specific gravity before fermentation, e.g., 1.050)
 * @param fg - Final gravity (specific gravity after fermentation, e.g., 1.000)
 * @returns ABV percentage (e.g., 6.56 for 6.56% ABV)
 *
 * @example
 * ```typescript
 * const abv = calculateAbv(1.050, 1.000); // Returns 6.56
 * ```
 */
export function calculateAbv(og: number, fg: number): number {
  if (og <= 0 || fg <= 0) {
    throw new Error("Specific gravity readings must be positive numbers");
  }

  if (og < 0.98 || og > 1.2) {
    throw new Error("Original gravity must be between 0.980 and 1.200");
  }

  if (fg < 0.98 || fg > 1.2) {
    throw new Error("Final gravity must be between 0.980 and 1.200");
  }

  if (og < fg) {
    throw new Error(
      "Original gravity must be greater than or equal to final gravity",
    );
  }

  const abv = (og - fg) * 131.25;

  // Round to 2 decimal places
  return Math.round(abv * 100) / 100;
}

/**
 * Calculate potential ABV from original gravity only
 * Assumes complete fermentation (FG = 1.000)
 *
 * @param og - Original gravity (specific gravity before fermentation)
 * @returns Potential ABV percentage if fermented to dryness
 */
export function calculatePotentialAbv(og: number): number {
  return calculateAbv(og, 1.0);
}

/**
 * Convert Brix (sugar content) to specific gravity
 * Uses the formula: SG = 1 + (Brix / (258.6 - ((Brix / 258.2) * 227.1)))
 *
 * @param brix - Brix reading (degrees Brix)
 * @returns Specific gravity equivalent
 */
export function brixToSpecificGravity(brix: number): number {
  if (brix < 0 || brix > 50) {
    throw new Error("Brix must be between 0 and 50");
  }

  // Simplified conversion formula
  const sg = 1 + brix / (258.6 - (brix / 258.2) * 227.1);

  return Math.round(sg * 1000) / 1000;
}

/**
 * Calculate ABV from Brix readings
 * Converts Brix to SG then calculates ABV
 *
 * @param originalBrix - Original Brix reading
 * @param finalBrix - Final Brix reading
 * @returns ABV percentage
 */
export function calculateAbvFromBrix(
  originalBrix: number,
  finalBrix: number,
): number {
  const og = brixToSpecificGravity(originalBrix);
  const fg = brixToSpecificGravity(finalBrix);

  return calculateAbv(og, fg);
}

/**
 * Calculate apparent attenuation percentage
 * Measures how much of the original sugars were consumed during fermentation
 *
 * @param og - Original gravity
 * @param fg - Final gravity
 * @returns Attenuation percentage (e.g., 75.0 for 75% attenuation)
 */
export function calculateAttenuation(og: number, fg: number): number {
  if (og <= 0 || fg <= 0) {
    throw new Error("Specific gravity readings must be positive numbers");
  }

  if (og < fg) {
    throw new Error(
      "Original gravity must be greater than or equal to final gravity",
    );
  }

  const attenuation = ((og - fg) / (og - 1.0)) * 100;

  return Math.round(attenuation * 100) / 100;
}

/**
 * Validate specific gravity reading
 * Ensures the reading is within typical fermentation ranges
 *
 * @param sg - Specific gravity reading
 * @returns boolean indicating if the reading is valid
 */
export function isValidSpecificGravity(sg: number): boolean {
  return sg >= 0.98 && sg <= 1.2 && sg > 0;
}

/**
 * Get ABV category based on alcohol content
 * Useful for classification and regulation compliance
 *
 * @param abv - ABV percentage
 * @returns Category string
 */
export function getAbvCategory(abv: number): string {
  if (abv < 0.5) return "Non-alcoholic";
  if (abv < 3.5) return "Low alcohol";
  if (abv < 7.0) return "Standard cider";
  if (abv < 12.0) return "Strong cider";
  return "Very strong cider";
}

// ============================================================================
// Blending and Spirit Calculations (for Pommeau/Brandy)
// ============================================================================

/**
 * Component for ABV blend calculation
 */
export interface BlendComponent {
  volumeLiters: number;
  abv: number; // ABV percentage (0-100)
}

/**
 * Calculate the resulting ABV of a blend of components with different ABV values
 * Formula: ABV_result = (V1 × ABV1 + V2 × ABV2 + ...) / (V1 + V2 + ...)
 *
 * Used for pommeau creation (blending juice + brandy)
 *
 * @param components - Array of components with volume and ABV
 * @returns Resulting ABV percentage of the blend
 *
 * @example
 * ```typescript
 * // Pommeau: 75L juice (0% ABV) + 25L brandy (60% ABV)
 * const abv = calculateBlendAbv([
 *   { volumeLiters: 75, abv: 0 },
 *   { volumeLiters: 25, abv: 60 }
 * ]); // Returns 15.0 (15% ABV)
 * ```
 */
export function calculateBlendAbv(components: BlendComponent[]): number {
  if (components.length === 0) {
    throw new Error("At least one component is required");
  }

  const totalVolume = components.reduce((sum, c) => sum + c.volumeLiters, 0);
  if (totalVolume <= 0) {
    throw new Error("Total volume must be greater than zero");
  }

  // Validate ABV values
  for (const component of components) {
    if (component.abv < 0 || component.abv > 100) {
      throw new Error("ABV must be between 0 and 100");
    }
    if (component.volumeLiters < 0) {
      throw new Error("Volume must be non-negative");
    }
  }

  const totalAlcohol = components.reduce(
    (sum, c) => sum + c.volumeLiters * c.abv,
    0
  );

  const resultAbv = totalAlcohol / totalVolume;

  // Round to 2 decimal places
  return Math.round(resultAbv * 100) / 100;
}

/**
 * Calculate the volume of brandy needed to achieve a target ABV in a blend
 * Useful for determining how much brandy to add to juice for pommeau
 *
 * @param juiceVolumeLiters - Volume of juice (assumed 0% ABV)
 * @param brandyAbv - ABV of the brandy
 * @param targetAbv - Target ABV for the final blend
 * @returns Volume of brandy needed in liters
 *
 * @example
 * ```typescript
 * // How much 60% brandy to add to 75L juice to get 15% ABV pommeau?
 * const brandyNeeded = calculateBrandyForTargetAbv(75, 60, 15); // Returns 25L
 * ```
 */
export function calculateBrandyForTargetAbv(
  juiceVolumeLiters: number,
  brandyAbv: number,
  targetAbv: number
): number {
  if (juiceVolumeLiters <= 0) {
    throw new Error("Juice volume must be greater than zero");
  }
  if (brandyAbv <= 0 || brandyAbv > 100) {
    throw new Error("Brandy ABV must be between 0 and 100");
  }
  if (targetAbv <= 0 || targetAbv >= brandyAbv) {
    throw new Error("Target ABV must be between 0 and brandy ABV");
  }

  // Formula derived from: (juiceVol * 0 + brandyVol * brandyAbv) / (juiceVol + brandyVol) = targetAbv
  // Solving for brandyVol: brandyVol = (targetAbv * juiceVol) / (brandyAbv - targetAbv)
  const brandyVolume =
    (targetAbv * juiceVolumeLiters) / (brandyAbv - targetAbv);

  return Math.round(brandyVolume * 100) / 100;
}

// ============================================================================
// TTB Proof Gallon Calculations
// ============================================================================

// Note: litersToWineGallons is exported from calculations/ttb.ts
// Use that function for volume conversions. These functions are specific
// to distillation/brandy operations.

/**
 * Calculate proof gallons for TTB reporting
 * Proof gallons = wine gallons × (ABV × 2) / 100
 * OR: proof gallons = wine gallons × proof / 100
 *
 * "Proof" is twice the ABV percentage (e.g., 60% ABV = 120 proof)
 *
 * @param liters - Volume in liters
 * @param abv - ABV percentage (e.g., 60 for 60% ABV)
 * @returns Proof gallons for TTB reporting
 *
 * @example
 * ```typescript
 * // 100L of 60% ABV brandy
 * const proofGallons = calculateProofGallons(100, 60); // Returns ~31.7 proof gallons
 * ```
 */
export function calculateProofGallons(liters: number, abv: number): number {
  if (liters < 0) {
    throw new Error("Volume must be non-negative");
  }
  if (abv < 0 || abv > 100) {
    throw new Error("ABV must be between 0 and 100");
  }

  const wineGallons = litersToWineGallons(liters);
  const proof = abv * 2;
  const proofGallons = (wineGallons * proof) / 100;

  return Math.round(proofGallons * 1000) / 1000;
}

/**
 * Calculate distillation loss based on input and output proof gallons
 *
 * @param proofGallonsSent - Proof gallons of cider sent to distillery
 * @param proofGallonsReceived - Proof gallons of brandy received back
 * @returns Loss percentage
 */
export function calculateDistillationLoss(
  proofGallonsSent: number,
  proofGallonsReceived: number
): number {
  if (proofGallonsSent <= 0) {
    throw new Error("Proof gallons sent must be greater than zero");
  }
  if (proofGallonsReceived < 0) {
    throw new Error("Proof gallons received must be non-negative");
  }

  const loss = proofGallonsSent - proofGallonsReceived;
  const lossPercent = (loss / proofGallonsSent) * 100;

  return Math.round(lossPercent * 100) / 100;
}
