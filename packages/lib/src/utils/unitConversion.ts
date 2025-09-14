/**
 * Unit conversion utilities for cidery management
 *
 * Provides precise conversion between bushels and kilograms with:
 * - 0.01 kg precision (±0.1% error tolerance)
 * - Validation for edge cases
 * - Display formatting helpers
 */

import { validatePositiveQuantity } from '../validation/volume-quantity';

/**
 * Conversion factor: 1 bushel = 40 lb = 18.14 kg
 * Source: US Dry Bushel standard for apples
 */
export const BUSHEL_TO_KG_FACTOR = 18.14;

/**
 * Convert bushels to kilograms with 0.01 kg precision
 * @param bushels - Amount in bushels to convert
 * @returns Amount in kilograms, rounded to 0.01 kg precision
 * @throws QuantityValidationError for invalid inputs
 */
export function bushelsToKg(bushels: number): number {
  validatePositiveQuantity(bushels, 'Bushels', 'bushels', 'unit conversion');

  // Convert and round to 0.01 kg precision
  return Math.round(bushels * BUSHEL_TO_KG_FACTOR * 100) / 100;
}

/**
 * Convert kilograms to bushels with 0.01 bushel precision
 * @param kg - Amount in kilograms to convert
 * @returns Amount in bushels, rounded to 0.01 bushel precision
 * @throws QuantityValidationError for invalid inputs
 */
export function kgToBushels(kg: number): number {
  validatePositiveQuantity(kg, 'Kilograms', 'kg', 'unit conversion');

  // Convert and round to 0.01 bushel precision
  return Math.round((kg / BUSHEL_TO_KG_FACTOR) * 100) / 100;
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
  convertedValue?: number
): string {
  let converted: number;

  if (convertedValue !== undefined) {
    converted = convertedValue;
  } else {
    // Auto-convert based on units
    if (fromUnit === 'bushels' && toUnit === 'kg') {
      converted = bushelsToKg(value);
    } else if (fromUnit === 'kg' && toUnit === 'bushels') {
      converted = kgToBushels(value);
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
  toUnit: string
): boolean {
  let roundTripValue: number;

  if (fromUnit === 'bushels' && toUnit === 'kg') {
    const kg = bushelsToKg(originalValue);
    roundTripValue = kgToBushels(kg);
  } else if (fromUnit === 'kg' && toUnit === 'bushels') {
    const bushels = kgToBushels(originalValue);
    roundTripValue = bushelsToKg(bushels);
  } else {
    throw new Error(`Unsupported conversion validation from ${fromUnit} to ${toUnit}`);
  }

  // Calculate percentage error: |original - roundtrip| / original * 100
  const percentageError = Math.abs(originalValue - roundTripValue) / originalValue * 100;

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
    'bushels': {
      'kg': BUSHEL_TO_KG_FACTOR,
      'bushels': 1
    },
    'kg': {
      'bushels': 1 / BUSHEL_TO_KG_FACTOR,
      'kg': 1
    }
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
export function isConversionSupported(fromUnit: string, toUnit: string): boolean {
  try {
    getConversionFactor(fromUnit, toUnit);
    return true;
  } catch {
    return false;
  }
}