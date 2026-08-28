/**
 * Sugar to Gravity Calculations
 *
 * Utilities for calculating gravity increases from sugar additions.
 * Used for back-sweetening and re-fermentation calculations.
 */

/**
 * Calculate the specific gravity increase from adding sugar to a batch.
 *
 * Uses the standard brewing formula:
 * 1 pound of sucrose (table sugar) in 1 gallon of water = 46 gravity points (0.046 SG increase)
 *
 * @param sugarGrams - Amount of sugar added in grams
 * @param volumeLiters - Current volume of the batch in liters
 * @returns Gravity increase (e.g., 0.00345 for a 3.45 point increase)
 *
 * @example
 * // Adding 170g of sugar to 18.9L
 * const gravityIncrease = calculateGravityIncrease(170, 18.9);
 * // Returns ~0.00345 (3.45 gravity points)
 */
export function calculateGravityIncrease(
  sugarGrams: number,
  volumeLiters: number
): number {
  if (sugarGrams <= 0 || volumeLiters <= 0) {
    return 0;
  }

  // Constants
  const GRAMS_PER_POUND = 453.592;
  const LITERS_PER_GALLON = 3.78541;
  const GRAVITY_POINTS_PER_LB_GAL = 0.046; // Sucrose: 46 points per lb/gal

  // Convert grams to pounds
  const sugarPounds = sugarGrams / GRAMS_PER_POUND;

  // Convert liters to gallons
  const volumeGallons = volumeLiters / LITERS_PER_GALLON;

  // Calculate gravity points increase
  // Formula: (lbs of sugar / gallons) * points per lb/gal
  const gravityIncrease =
    (sugarPounds / volumeGallons) * GRAVITY_POINTS_PER_LB_GAL;

  return gravityIncrease;
}

/**
 * Calculate the estimated final gravity after sugar addition, assuming full fermentation.
 *
 * @param currentSG - Current specific gravity
 * @param sugarGrams - Amount of sugar to add in grams
 * @param volumeLiters - Current volume in liters
 * @param willFerment - Whether the sugar is expected to ferment (default: true)
 * @returns Estimated final SG after fermentation
 *
 * @example
 * // Current SG 1.050, adding 170g to 18.9L, will ferment fully
 * const estFG = calculateEstimatedFinalGravity(1.050, 170, 18.9, true);
 * // Returns ~1.050 (sugar ferments out completely)
 *
 * @example
 * // Back-sweetening (won't ferment)
 * const estFG = calculateEstimatedFinalGravity(1.010, 170, 18.9, false);
 * // Returns ~1.01345 (sugar remains)
 */
export function calculateEstimatedFinalGravity(
  currentSG: number,
  sugarGrams: number,
  volumeLiters: number,
  willFerment: boolean = true
): number {
  const gravityIncrease = calculateGravityIncrease(sugarGrams, volumeLiters);

  if (willFerment) {
    // If sugar will ferment, it doesn't affect final gravity
    // (it converts to alcohol, so FG stays the same)
    return currentSG;
  } else {
    // If sugar won't ferment (back-sweetening), add to current SG
    return currentSG + gravityIncrease;
  }
}

/**
 * Calculate the estimated ABV after sugar addition and fermentation.
 *
 * Uses the standard formula: ABV = (OG - FG) * 131.25
 *
 * @param originalGravity - Original gravity at the start of fermentation
 * @param currentSG - Current specific gravity before sugar addition
 * @param sugarGrams - Amount of sugar to add in grams
 * @param volumeLiters - Current volume in liters
 * @param willFerment - Whether the sugar is expected to ferment (default: true)
 * @returns Estimated ABV percentage
 *
 * @example
 * // OG 1.055, current SG 1.010, adding 170g to 18.9L
 * const estABV = calculateEstimatedABV(1.055, 1.010, 170, 18.9, true);
 * // Returns ~6.36% (accounts for additional fermentation)
 */
export function calculateEstimatedABV(
  originalGravity: number,
  currentSG: number,
  sugarGrams: number,
  volumeLiters: number,
  willFerment: boolean = true
): number {
  if (!willFerment) {
    // If sugar won't ferment, ABV doesn't change
    return (originalGravity - currentSG) * 131.25;
  }

  // Calculate gravity increase from sugar
  const gravityIncrease = calculateGravityIncrease(sugarGrams, volumeLiters);

  // The new "original gravity" for the sugar addition
  const effectiveOG = currentSG + gravityIncrease;

  // Assuming full fermentation of added sugar, the final gravity stays the same
  const estimatedFG = currentSG;

  // Calculate total ABV: original fermentation + new fermentation
  const originalABV = (originalGravity - currentSG) * 131.25;
  const additionalABV = gravityIncrease * 131.25;

  return originalABV + additionalABV;
}

/**
 * Calculate estimated specific gravity immediately after sugar addition
 * (before any fermentation occurs).
 *
 * This is used for creating the estimated measurement record.
 *
 * @param currentSG - Current specific gravity
 * @param sugarGrams - Amount of sugar to add in grams
 * @param volumeLiters - Current volume in liters
 * @returns Estimated SG immediately after sugar addition
 *
 * @example
 * // Current SG 1.050, adding 170g to 18.9L
 * const estSG = calculateEstimatedSGAfterAddition(1.050, 170, 18.9);
 * // Returns ~1.05345
 */
export function calculateEstimatedSGAfterAddition(
  currentSG: number,
  sugarGrams: number,
  volumeLiters: number
): number {
  const gravityIncrease = calculateGravityIncrease(sugarGrams, volumeLiters);
  return currentSG + gravityIncrease;
}

/**
 * Convert sugar amount from various units to grams.
 *
 * @param amount - Amount of sugar
 * @param unit - Unit of measurement
 * @returns Amount in grams
 */
export function convertSugarToGrams(amount: number, unit: string): number {
  const conversionFactors: Record<string, number> = {
    g: 1,
    kg: 1000,
    lbs: 453.592,
    oz: 28.3495,
    "g/L": 1, // Will need to multiply by volume separately
  };

  const factor = conversionFactors[unit];
  if (factor === undefined) {
    throw new Error(`Unsupported sugar unit: ${unit}`);
  }

  return amount * factor;
}

/**
 * Convert specific gravity to degrees Brix.
 *
 * Uses the standard cubic approximation (accurate to ±0.02°Bx for
 * SG 1.000–1.120, well beyond the juice range).
 *
 * @param sg - Specific gravity (e.g., 1.050)
 * @returns Degrees Brix (% sucrose by weight)
 *
 * @example
 * sgToBrix(1.050); // ~12.4
 */
export function sgToBrix(sg: number): number {
  if (sg <= 0) {
    return 0;
  }
  const brix = 143.254 * sg ** 3 - 648.670 * sg ** 2 + 1125.805 * sg - 620.389;
  return Math.max(0, brix);
}

/**
 * Estimate the sugar content of a liquid (e.g., juice) from its specific
 * gravity, in grams per liter.
 *
 * Brix is % sucrose by WEIGHT, so g/L = Brix × density(g/mL) × 10.
 * This is a sucrose-equivalent estimate: SG reflects all dissolved solids
 * (sugars, acids, sorbitol), so true fermentable sugar is slightly lower.
 *
 * @param sg - Specific gravity of the liquid (e.g., 1.050)
 * @returns Approximate sugar content in g/L (sucrose-equivalent)
 *
 * @example
 * sugarGramsPerLiterFromSG(1.050); // ~130 g/L
 */
export function sugarGramsPerLiterFromSG(sg: number): number {
  if (sg <= 1.0) {
    return 0;
  }
  return sgToBrix(sg) * sg * 10;
}

/**
 * Sugar (grams) contributed by a juice addition, from the juice's SG and
 * the volume added.
 *
 * @param juiceSG - Specific gravity of the juice being added
 * @param juiceVolumeL - Volume of juice added in liters
 * @returns Approximate sugar added in grams (sucrose-equivalent)
 */
export function sugarGramsFromJuiceAddition(
  juiceSG: number,
  juiceVolumeL: number,
): number {
  if (juiceVolumeL <= 0) {
    return 0;
  }
  return sugarGramsPerLiterFromSG(juiceSG) * juiceVolumeL;
}

/**
 * Sugar concentration (g/L) a juice dose adds to a batch, accounting for
 * the volume the juice itself contributes.
 *
 * At a dose of R mL of juice per liter of batch, the added sugar lands in
 * (1000 + R) mL of final blend per original liter — not 1000 mL — so the
 * naive rate × concentration overstates the result by R/1000.
 *
 * @param juiceSG - Specific gravity of the juice being added
 * @param doseMlPerL - Dose rate in mL of juice per liter of batch
 * @returns Approximate added sugar in the final blend, g/L (sucrose-equivalent)
 *
 * @example
 * // 34 mL/L of SG 1.050 juice
 * addedSugarGramsPerLiter(1.050, 34); // ~4.3 g/L in the final blend
 */
export function addedSugarGramsPerLiter(
  juiceSG: number,
  doseMlPerL: number,
): number {
  if (doseMlPerL <= 0) {
    return 0;
  }
  const sugarPerLiterOfJuice = sugarGramsPerLiterFromSG(juiceSG);
  return (sugarPerLiterOfJuice * doseMlPerL) / (1000 + doseMlPerL);
}
