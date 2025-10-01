/**
 * Volume conversion utilities for handling different units
 */

export type VolumeUnit = 'L' | 'gal' | 'oz' | 'ml';
export type WeightUnit = 'kg' | 'lb' | 'bushel';

/**
 * Conversion factors to base units
 * Volume base: liters (L)
 * Weight base: kilograms (kg)
 */
const VOLUME_TO_LITERS: Record<VolumeUnit, number> = {
  'L': 1,
  'gal': 3.78541,
  'oz': 0.0295735,
  'ml': 0.001,
};

const WEIGHT_TO_KG: Record<WeightUnit, number> = {
  'kg': 1,
  'lb': 0.453592,
  'bushel': 21.7724, // Average for apples
};

/**
 * Convert a volume from one unit to another
 * Applies smart rounding to avoid floating point precision issues
 */
export function convertVolume(
  value: number,
  fromUnit: VolumeUnit,
  toUnit: VolumeUnit,
  applySmartRounding: boolean = true
): number {
  if (fromUnit === toUnit) return value;

  // Convert to liters first (base unit)
  const liters = value * VOLUME_TO_LITERS[fromUnit];

  // Convert from liters to target unit
  const converted = liters / VOLUME_TO_LITERS[toUnit];

  // Apply smart rounding to avoid floating point precision issues
  return applySmartRounding ? smartRound(converted, toUnit) : converted;
}

/**
 * Convert a weight from one unit to another
 */
export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return value;

  // Convert to kg first (base unit)
  const kg = value * WEIGHT_TO_KG[fromUnit];

  // Convert from kg to target unit
  return kg / WEIGHT_TO_KG[toUnit];
}

/**
 * Round a value to specified decimal places
 */
export function roundToDecimals(value: number, decimals: number = 3): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Smart rounding that preserves common whole numbers
 * This helps avoid floating point precision issues like 5 gallons becoming 4.999986791391157
 */
export function smartRound(value: number, unit: VolumeUnit): number {
  // For display purposes, round to reasonable precision based on unit
  const precision: Record<VolumeUnit, number> = {
    'L': 2,      // 2 decimal places for liters (e.g., 18.93 L)
    'gal': 3,    // 3 decimal places for gallons (e.g., 5.000 gal)
    'oz': 1,     // 1 decimal place for fluid ounces
    'ml': 0,     // whole numbers for milliliters
  };

  const rounded = roundToDecimals(value, precision[unit]);

  // If we're very close to a whole number (within 0.0001), snap to it
  const nearestWhole = Math.round(rounded);
  if (Math.abs(rounded - nearestWhole) < 0.0001) {
    return nearestWhole;
  }

  // For gallons and liters, also check if we're close to common fractions
  if (unit === 'gal' || unit === 'L') {
    const commonFractions = [0.25, 0.5, 0.75];
    for (const frac of commonFractions) {
      const wholeWithFraction = Math.floor(rounded) + frac;
      if (Math.abs(rounded - wholeWithFraction) < 0.001) {
        return wholeWithFraction;
      }
    }
  }

  return rounded;
}

/**
 * Convert volume to liters (for database storage)
 */
export function toStorageVolume(value: number, unit: VolumeUnit): number {
  return roundToDecimals(convertVolume(value, unit, 'L'));
}

/**
 * Convert weight to kg (for database storage)
 */
export function toStorageWeight(value: number, unit: WeightUnit): number {
  return roundToDecimals(convertWeight(value, unit, 'kg'));
}

/**
 * Format volume with unit for display
 */
export function formatVolume(value: number, unit: VolumeUnit): string {
  const rounded = roundToDecimals(value, 2);
  return `${rounded} ${unit}`;
}

/**
 * Format weight with unit for display
 */
export function formatWeight(value: number, unit: WeightUnit): string {
  const rounded = roundToDecimals(value, 2);
  return `${rounded} ${unit}`;
}

/**
 * Get the display name for a volume unit
 */
export function getVolumeUnitName(unit: VolumeUnit): string {
  const names: Record<VolumeUnit, string> = {
    'L': 'Liters',
    'gal': 'Gallons',
    'oz': 'Fluid Ounces',
    'ml': 'Milliliters',
  };
  return names[unit];
}

/**
 * Get the display name for a weight unit
 */
export function getWeightUnitName(unit: WeightUnit): string {
  const names: Record<WeightUnit, string> = {
    'kg': 'Kilograms',
    'lb': 'Pounds',
    'bushel': 'Bushels',
  };
  return names[unit];
}

/**
 * Validate if a string is a valid volume unit
 */
export function isValidVolumeUnit(unit: string): unit is VolumeUnit {
  return ['L', 'gal', 'oz', 'ml'].includes(unit);
}

/**
 * Validate if a string is a valid weight unit
 */
export function isValidWeightUnit(unit: string): unit is WeightUnit {
  return ['kg', 'lb', 'bushel'].includes(unit);
}

/**
 * Convert between volume and weight for specific materials
 * This uses average density values
 */
export function estimateWeightFromVolume(
  volumeLiters: number,
  material: 'juice' | 'water' | 'cider' = 'juice'
): number {
  // Density in kg/L
  const densities = {
    juice: 1.05,   // Apple juice is slightly denser than water
    water: 1.0,
    cider: 1.01,   // Fermented cider is close to water
  };

  return volumeLiters * densities[material];
}

/**
 * Calculate the total volume with mixed units
 * Converts all to liters for calculation, then converts result to desired unit
 */
export function calculateTotalVolume(
  volumes: Array<{ value: number; unit: VolumeUnit }>,
  resultUnit: VolumeUnit = 'L'
): number {
  const totalLiters = volumes.reduce((sum, item) => {
    return sum + convertVolume(item.value, item.unit, 'L');
  }, 0);

  return convertVolume(totalLiters, 'L', resultUnit);
}