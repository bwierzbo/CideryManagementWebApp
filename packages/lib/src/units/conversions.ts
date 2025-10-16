/**
 * Unit Conversion Utilities
 *
 * Provides type-safe unit conversions for volume, weight, and temperature.
 * Uses the same conversion factors as the database SQL functions.
 */

// ============================================================
// Type Definitions
// ============================================================

/**
 * Volume units supported by the system
 */
export type VolumeUnit = "L" | "gal" | "mL";

/**
 * Weight units supported by the system
 */
export type WeightUnit = "kg" | "lb";

/**
 * Temperature units supported by the system
 */
export type TemperatureUnit = "C" | "F";

// ============================================================
// Conversion Constants
// ============================================================

/** Gallons to liters conversion factor */
const GAL_TO_L = 3.78541;

/** Milliliters to liters conversion factor */
const ML_TO_L = 0.001;

/** Pounds to kilograms conversion factor */
const LB_TO_KG = 0.453592;

// ============================================================
// Volume Conversion Functions
// ============================================================

/**
 * Convert a volume value to liters
 *
 * @param value - The numeric value to convert
 * @param unit - The unit of the input value
 * @returns The value converted to liters
 *
 * @example
 * ```typescript
 * convertToLiters(1, 'gal') // Returns 3.78541
 * convertToLiters(1000, 'mL') // Returns 1
 * convertToLiters(5, 'L') // Returns 5
 * ```
 */
export function convertToLiters(value: number, unit: VolumeUnit): number {
  switch (unit) {
    case "L":
      return value;
    case "gal":
      return value * GAL_TO_L;
    case "mL":
      return value * ML_TO_L;
    default:
      return value;
  }
}

/**
 * Convert a volume value from liters to a target unit
 *
 * @param liters - The volume in liters
 * @param targetUnit - The unit to convert to
 * @returns The value converted to the target unit
 *
 * @example
 * ```typescript
 * convertFromLiters(3.78541, 'gal') // Returns ~1
 * convertFromLiters(1, 'mL') // Returns 1000
 * convertFromLiters(5, 'L') // Returns 5
 * ```
 */
export function convertFromLiters(
  liters: number,
  targetUnit: VolumeUnit,
): number {
  switch (targetUnit) {
    case "L":
      return liters;
    case "gal":
      return liters / GAL_TO_L;
    case "mL":
      return liters / ML_TO_L;
    default:
      return liters;
  }
}

// ============================================================
// Weight Conversion Functions
// ============================================================

/**
 * Convert a weight value to kilograms
 *
 * @param value - The numeric value to convert
 * @param unit - The unit of the input value
 * @returns The value converted to kilograms
 *
 * @example
 * ```typescript
 * convertToKg(1, 'lb') // Returns 0.453592
 * convertToKg(5, 'kg') // Returns 5
 * ```
 */
export function convertToKg(value: number, unit: WeightUnit): number {
  switch (unit) {
    case "kg":
      return value;
    case "lb":
      return value * LB_TO_KG;
    default:
      return value;
  }
}

/**
 * Convert a weight value from kilograms to a target unit
 *
 * @param kg - The weight in kilograms
 * @param targetUnit - The unit to convert to
 * @returns The value converted to the target unit
 *
 * @example
 * ```typescript
 * convertFromKg(0.453592, 'lb') // Returns ~1
 * convertFromKg(5, 'kg') // Returns 5
 * ```
 */
export function convertFromKg(kg: number, targetUnit: WeightUnit): number {
  switch (targetUnit) {
    case "kg":
      return kg;
    case "lb":
      return kg / LB_TO_KG;
    default:
      return kg;
  }
}

// ============================================================
// Temperature Conversion Functions
// ============================================================

/**
 * Convert a temperature value to Celsius
 *
 * @param value - The numeric value to convert
 * @param unit - The unit of the input value
 * @returns The value converted to Celsius
 *
 * @example
 * ```typescript
 * convertToCelsius(32, 'F') // Returns 0
 * convertToCelsius(212, 'F') // Returns 100
 * convertToCelsius(20, 'C') // Returns 20
 * ```
 */
export function convertToCelsius(
  value: number,
  unit: TemperatureUnit,
): number {
  switch (unit) {
    case "C":
      return value;
    case "F":
      return ((value - 32) * 5) / 9;
    default:
      return value;
  }
}

/**
 * Convert a temperature value from Celsius to a target unit
 *
 * @param celsius - The temperature in Celsius
 * @param targetUnit - The unit to convert to
 * @returns The value converted to the target unit
 *
 * @example
 * ```typescript
 * convertFromCelsius(0, 'F') // Returns 32
 * convertFromCelsius(100, 'F') // Returns 212
 * convertFromCelsius(20, 'C') // Returns 20
 * ```
 */
export function convertFromCelsius(
  celsius: number,
  targetUnit: TemperatureUnit,
): number {
  switch (targetUnit) {
    case "C":
      return celsius;
    case "F":
      return (celsius * 9) / 5 + 32;
    default:
      return celsius;
  }
}

// ============================================================
// Formatting Functions
// ============================================================

/**
 * Format a volume value with proper unit display
 *
 * @param liters - The volume in liters (base unit)
 * @param unit - The unit to display the value in
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with value and unit
 *
 * @example
 * ```typescript
 * formatVolume(3.78541, 'gal', 1) // Returns "1.0 gal"
 * formatVolume(1000, 'mL', 0) // Returns "1000000 mL"
 * formatVolume(5.5, 'L', 2) // Returns "5.50 L"
 * ```
 */
export function formatVolume(
  liters: number,
  unit: VolumeUnit,
  decimals: number = 2,
): string {
  const converted = convertFromLiters(liters, unit);
  return `${converted.toFixed(decimals)} ${unit}`;
}

/**
 * Format a weight value with proper unit display
 *
 * @param kg - The weight in kilograms (base unit)
 * @param unit - The unit to display the value in
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with value and unit
 *
 * @example
 * ```typescript
 * formatWeight(0.453592, 'lb', 1) // Returns "1.0 lb"
 * formatWeight(5.5, 'kg', 2) // Returns "5.50 kg"
 * ```
 */
export function formatWeight(
  kg: number,
  unit: WeightUnit,
  decimals: number = 2,
): string {
  const converted = convertFromKg(kg, unit);
  return `${converted.toFixed(decimals)} ${unit}`;
}

/**
 * Format a temperature value with proper unit display
 *
 * @param celsius - The temperature in Celsius (base unit)
 * @param unit - The unit to display the value in
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with value and unit symbol
 *
 * @example
 * ```typescript
 * formatTemperature(0, 'F', 0) // Returns "32°F"
 * formatTemperature(20, 'C', 1) // Returns "20.0°C"
 * ```
 */
export function formatTemperature(
  celsius: number,
  unit: TemperatureUnit,
  decimals: number = 1,
): string {
  const converted = convertFromCelsius(celsius, unit);
  return `${converted.toFixed(decimals)}°${unit}`;
}

// ============================================================
// Validation Functions
// ============================================================

/**
 * Validate that a volume value is positive and finite
 *
 * @param value - The volume value to validate
 * @returns True if the value is valid (> 0 and finite)
 *
 * @example
 * ```typescript
 * isValidVolume(5.5) // Returns true
 * isValidVolume(0) // Returns false
 * isValidVolume(-1) // Returns false
 * isValidVolume(Infinity) // Returns false
 * ```
 */
export function isValidVolume(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Validate that a weight value is positive and finite
 *
 * @param value - The weight value to validate
 * @returns True if the value is valid (> 0 and finite)
 *
 * @example
 * ```typescript
 * isValidWeight(5.5) // Returns true
 * isValidWeight(0) // Returns false
 * isValidWeight(-1) // Returns false
 * isValidWeight(Infinity) // Returns false
 * ```
 */
export function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
