/**
 * Unit conversion utilities for cidery management
 *
 * Provides precise conversion between bushels and kilograms with:
 * - 0.01 kg precision (±0.1% error tolerance)
 * - Validation for edge cases
 * - Display formatting helpers
 */

import { validatePositiveQuantity } from "../validation/volume-quantity";

/**
 * Floating-point tolerance for volume calculations (0.01 L = 10 mL)
 * Matches the epsilon used in validation functions
 */
const VOLUME_EPSILON = 0.01;

/**
 * Conversion factor: 1 bushel = 40 lb = 18.14 kg
 * Source: US Dry Bushel standard for apples
 */
export const BUSHEL_TO_KG_FACTOR = 18.14;

/**
 * Conversion factor: 1 US gallon = 3.78541 liters
 * Source: US Liquid Gallon standard
 */
export const GAL_TO_L_FACTOR = 3.78541;

/**
 * Convert bushels to kilograms with 0.01 kg precision
 * @param bushels - Amount in bushels to convert
 * @returns Amount in kilograms, rounded to 0.01 kg precision
 * @throws QuantityValidationError for invalid inputs
 */
export function bushelsToKg(bushels: number): number {
  // Clamp near-zero values to exactly 0 to handle floating-point imprecision
  const clampedBushels = Math.abs(bushels) < VOLUME_EPSILON ? 0 : bushels;

  validatePositiveQuantity(clampedBushels, "Bushels", "bushels", "unit conversion");

  // Convert and round to 0.01 kg precision
  return Math.round(clampedBushels * BUSHEL_TO_KG_FACTOR * 100) / 100;
}

/**
 * Convert kilograms to bushels with 0.01 bushel precision
 * @param kg - Amount in kilograms to convert
 * @returns Amount in bushels, rounded to 0.01 bushel precision
 * @throws QuantityValidationError for invalid inputs
 */
export function kgToBushels(kg: number): number {
  // Clamp near-zero values to exactly 0 to handle floating-point imprecision
  const clampedKg = Math.abs(kg) < VOLUME_EPSILON ? 0 : kg;

  validatePositiveQuantity(clampedKg, "Kilograms", "kg", "unit conversion");

  // Convert and round to 0.01 bushel precision
  return Math.round((clampedKg / BUSHEL_TO_KG_FACTOR) * 100) / 100;
}

/**
 * Convert gallons to liters with 0.01 L precision
 * @param gallons - Amount in gallons to convert
 * @returns Amount in liters, rounded to 0.01 L precision
 * @throws QuantityValidationError for invalid inputs
 */
export function gallonsToLiters(gallons: number): number {
  // Clamp near-zero values to exactly 0 to handle floating-point imprecision
  const clampedGallons = Math.abs(gallons) < VOLUME_EPSILON ? 0 : gallons;

  validatePositiveQuantity(clampedGallons, "Gallons", "gal", "unit conversion");

  // Convert and round to 0.01 L precision
  return Math.round(clampedGallons * GAL_TO_L_FACTOR * 100) / 100;
}

/**
 * Convert liters to gallons with 0.01 gallon precision
 * @param liters - Amount in liters to convert
 * @returns Amount in gallons, rounded to 0.01 gallon precision
 * @throws QuantityValidationError for invalid inputs
 */
export function litersToGallons(liters: number): number {
  // Clamp near-zero values to exactly 0 to handle floating-point imprecision
  const clampedLiters = Math.abs(liters) < VOLUME_EPSILON ? 0 : liters;

  validatePositiveQuantity(clampedLiters, "Liters", "L", "unit conversion");

  // Convert and round to 0.01 gallon precision
  return Math.round((clampedLiters / GAL_TO_L_FACTOR) * 100) / 100;
}

/**
 * Format a unit conversion for display
 * @param value - The numeric value to format
 * @param fromUnit - Source unit (e.g., 'bushels', 'kg')
 * @param toUnit - Target unit (e.g., 'kg', 'bushels')
 * @param convertedValue - Optional pre-computed converted value
 * @returns Formatted string showing the conversion
 */
export function formatUnitConversion(
  value: number,
  fromUnit: string,
  toUnit: string,
  convertedValue?: number,
): string {
  let converted: number;

  if (convertedValue !== undefined) {
    converted = convertedValue;
  } else {
    // Auto-convert based on units
    if (fromUnit === "bushels" && toUnit === "kg") {
      converted = bushelsToKg(value);
    } else if (fromUnit === "kg" && toUnit === "bushels") {
      converted = kgToBushels(value);
    } else if (fromUnit === "gal" && toUnit === "L") {
      converted = gallonsToLiters(value);
    } else if (fromUnit === "L" && toUnit === "gal") {
      converted = litersToGallons(value);
    } else {
      throw new Error(`Unsupported conversion from ${fromUnit} to ${toUnit}`);
    }
  }

  return `${value.toFixed(2)} ${fromUnit} = ${converted.toFixed(2)} ${toUnit}`;
}

/**
 * Validate that a conversion maintains acceptable precision
 * Checks round-trip conversion stays within ±0.1% tolerance
 * @param originalValue - Original value before conversion
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns true if conversion maintains precision tolerance
 */
export function validateConversionPrecision(
  originalValue: number,
  fromUnit: string,
  toUnit: string,
): boolean {
  let roundTripValue: number;

  if (fromUnit === "bushels" && toUnit === "kg") {
    const kg = bushelsToKg(originalValue);
    roundTripValue = kgToBushels(kg);
  } else if (fromUnit === "kg" && toUnit === "bushels") {
    const bushels = kgToBushels(originalValue);
    roundTripValue = bushelsToKg(bushels);
  } else if (fromUnit === "gal" && toUnit === "L") {
    const liters = gallonsToLiters(originalValue);
    roundTripValue = litersToGallons(liters);
  } else if (fromUnit === "L" && toUnit === "gal") {
    const gallons = litersToGallons(originalValue);
    roundTripValue = gallonsToLiters(gallons);
  } else {
    throw new Error(
      `Unsupported conversion validation from ${fromUnit} to ${toUnit}`,
    );
  }

  // Calculate percentage error: |original - roundtrip| / original * 100
  const percentageError =
    (Math.abs(originalValue - roundTripValue) / originalValue) * 100;

  // Must be within ±0.1% tolerance
  return percentageError <= 0.1;
}

/**
 * Get the appropriate conversion factor between supported units
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Conversion factor to multiply by
 */
export function getConversionFactor(fromUnit: string, toUnit: string): number {
  const conversions: Record<string, Record<string, number>> = {
    bushels: {
      kg: BUSHEL_TO_KG_FACTOR,
      bushels: 1,
    },
    kg: {
      bushels: 1 / BUSHEL_TO_KG_FACTOR,
      kg: 1,
    },
    gal: {
      L: GAL_TO_L_FACTOR,
      gal: 1,
    },
    L: {
      gal: 1 / GAL_TO_L_FACTOR,
      L: 1,
    },
  };

  const fromConversions = conversions[fromUnit];
  if (!fromConversions) {
    throw new Error(`Unsupported source unit: ${fromUnit}`);
  }

  const factor = fromConversions[toUnit];
  if (factor === undefined) {
    throw new Error(`Unsupported conversion from ${fromUnit} to ${toUnit}`);
  }

  return factor;
}

/**
 * Check if a unit conversion is supported by this module
 * @param fromUnit - Source unit to check
 * @param toUnit - Target unit to check
 * @returns true if conversion is supported
 */
export function isConversionSupported(
  fromUnit: string,
  toUnit: string,
): boolean {
  try {
    getConversionFactor(fromUnit, toUnit);
    return true;
  } catch {
    return false;
  }
}

/**
 * Volume unit types supported for display formatting
 */
export type VolumeUnit = "L" | "gal";

/**
 * Volume unit display symbols
 */
export const VOLUME_UNIT_SYMBOLS: Record<VolumeUnit, string> = {
  L: "L",
  gal: "gal",
};

/**
 * Convert volume from liters to the specified display unit
 * @param liters - Volume in liters (base storage unit, can be 0 for empty vessels)
 * @param unit - Target display unit
 * @returns Volume in the target unit
 */
export function toDisplayVolume(liters: number, unit: VolumeUnit): number {
  if (unit === "gal") {
    // Use direct conversion for display, allowing zero values
    return Math.round((liters / GAL_TO_L_FACTOR) * 100) / 100;
  }
  return liters;
}

/**
 * Format a volume for display with appropriate unit symbol
 * @param liters - Volume in liters (base storage unit)
 * @param unit - Display unit to convert to
 * @returns Formatted volume string (e.g., "5 gal", "19 L")
 */
export function formatVolume(liters: number, unit: VolumeUnit): string {
  const displayValue = toDisplayVolume(liters, unit);
  const symbol = VOLUME_UNIT_SYMBOLS[unit];

  // Show whole numbers when close, else 1 decimal place
  const formatted =
    Math.abs(displayValue - Math.round(displayValue)) < 0.01
      ? Math.round(displayValue)
      : Number(displayValue.toFixed(1));

  return `${formatted} ${symbol}`;
}

/**
 * Format a volume range for display (e.g., current/capacity)
 * @param currentLiters - Current volume in liters
 * @param capacityLiters - Total capacity in liters
 * @param unit - Display unit to convert to
 * @returns Formatted range string (e.g., "0 gal / 5 gal")
 */
export function formatVolumeRange(
  currentLiters: number,
  capacityLiters: number,
  unit: VolumeUnit,
): string {
  const currentFormatted = formatVolume(currentLiters, unit);
  const capacityFormatted = formatVolume(capacityLiters, unit);
  return `${currentFormatted} / ${capacityFormatted}`;
}
