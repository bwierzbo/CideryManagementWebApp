/**
 * ABV (Alcohol By Volume) calculation utilities for cidery operations
 * Uses specific gravity (SG) readings to calculate alcohol content
 */

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
