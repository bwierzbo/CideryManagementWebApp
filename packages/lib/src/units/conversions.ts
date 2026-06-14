/**
 * Unit Conversion Utilities — the single canonical conversion module.
 *
 * Consolidates what used to live in three overlapping places
 * (utils/unitConversion.ts, utils/volumeConversion.ts, and the base-unit
 * helpers here) into one consistent source. Uses the same factors as the
 * database SQL functions.
 *
 * Three layers, all sharing the SAME constants:
 *   1. Base-unit helpers — `convertToLiters` / `convertFromLiters` /
 *      `convertToKg` / `convertFromKg` / temperature.
 *   2. From/to helpers — `convertVolume(value, from, to)` /
 *      `convertWeight(value, from, to)` with optional smart rounding.
 *   3. Validated + display helpers — strict `bushelsToKg` / `kgToBushels`,
 *      lenient `gallonsToLiters` / `litersToGallons`, and formatters.
 */

import { validatePositiveQuantity } from "../validation/volume-quantity";
import { QuantityValidationError } from "../validation/errors";

// ============================================================
// Type Definitions
// ============================================================

/** Volume units supported by the system. */
export type VolumeUnit = "L" | "gal" | "mL" | "oz";

/** Weight units supported by the system. */
export type WeightUnit = "g" | "kg" | "lb" | "oz" | "bushel";

/** Temperature units supported by the system. */
export type TemperatureUnit = "C" | "F";

// ============================================================
// Conversion Constants (single source of truth)
// ============================================================

/** 1 US gallon = 3.78541 liters. */
export const GAL_TO_L_FACTOR = 3.78541;
/** 1 milliliter = 0.001 liters. */
const ML_TO_L = 0.001;
/** 1 US fluid ounce = 0.0295735 liters. */
const FL_OZ_TO_L = 0.0295735;

/** 1 pound = 0.453592 kilograms. */
const LB_TO_KG = 0.453592;
/** 1 gram = 0.001 kilograms. */
const G_TO_KG = 0.001;
/** 1 ounce (weight) = 0.0283495 kilograms. */
const OZ_TO_KG = 0.0283495;
/**
 * 1 US dry bushel of apples = 40 lb = 18.14 kg.
 * Single canonical value (the old volumeConversion used 21.7724, which had no
 * callers and is intentionally dropped).
 */
export const BUSHEL_TO_KG_FACTOR = 18.14;

/** Floating-point tolerance (0.01) used by the lenient display conversions. */
const VOLUME_EPSILON = 0.01;

// ============================================================
// Base-unit Volume Conversions
// ============================================================

/** Convert a volume value to liters. */
export function convertToLiters(value: number, unit: VolumeUnit): number {
  switch (unit) {
    case "L":
      return value;
    case "gal":
      return value * GAL_TO_L_FACTOR;
    case "mL":
      return value * ML_TO_L;
    case "oz":
      return value * FL_OZ_TO_L;
    default:
      return value;
  }
}

/** Convert a volume value from liters to a target unit. */
export function convertFromLiters(liters: number, targetUnit: VolumeUnit): number {
  switch (targetUnit) {
    case "L":
      return liters;
    case "gal":
      return liters / GAL_TO_L_FACTOR;
    case "mL":
      return liters / ML_TO_L;
    case "oz":
      return liters / FL_OZ_TO_L;
    default:
      return liters;
  }
}

// ============================================================
// Base-unit Weight Conversions
// ============================================================

/** Convert a weight value to kilograms. */
export function convertToKg(value: number, unit: WeightUnit): number {
  switch (unit) {
    case "kg":
      return value;
    case "g":
      return value * G_TO_KG;
    case "lb":
      return value * LB_TO_KG;
    case "oz":
      return value * OZ_TO_KG;
    case "bushel":
      return value * BUSHEL_TO_KG_FACTOR;
    default:
      return value;
  }
}

/** Convert a weight value from kilograms to a target unit. */
export function convertFromKg(kg: number, targetUnit: WeightUnit): number {
  switch (targetUnit) {
    case "kg":
      return kg;
    case "g":
      return kg / G_TO_KG;
    case "lb":
      return kg / LB_TO_KG;
    case "oz":
      return kg / OZ_TO_KG;
    case "bushel":
      return kg / BUSHEL_TO_KG_FACTOR;
    default:
      return kg;
  }
}

// ============================================================
// Temperature Conversions
// ============================================================

/** Convert a temperature value to Celsius. */
export function convertToCelsius(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case "C":
      return value;
    case "F":
      return ((value - 32) * 5) / 9;
    default:
      return value;
  }
}

/** Convert a temperature value from Celsius to a target unit. */
export function convertFromCelsius(celsius: number, targetUnit: TemperatureUnit): number {
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
// Rounding helpers
// ============================================================

/** Round a value to a given number of decimal places (default 3). */
export function roundToDecimals(value: number, decimals: number = 3): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Smart rounding that snaps to whole numbers / common fractions to avoid
 * floating-point noise like "4.999986791391157" for 5 gallons.
 */
export function smartRound(value: number, unit: VolumeUnit): number {
  const precision: Record<VolumeUnit, number> = {
    L: 2,
    gal: 3,
    oz: 1,
    mL: 0,
  };

  const rounded = roundToDecimals(value, precision[unit]);

  const nearestWhole = Math.round(rounded);
  if (Math.abs(rounded - nearestWhole) < 0.0001) {
    return nearestWhole;
  }

  if (unit === "gal" || unit === "L") {
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

// ============================================================
// From/to Conversions (the style most of the app uses)
// ============================================================

/**
 * Convert a volume from one unit to another, applying smart rounding by
 * default to avoid floating-point precision issues.
 */
export function convertVolume(
  value: number,
  fromUnit: VolumeUnit,
  toUnit: VolumeUnit,
  applySmartRounding: boolean = true,
): number {
  if (fromUnit === toUnit) return value;
  const converted = convertFromLiters(convertToLiters(value, fromUnit), toUnit);
  return applySmartRounding ? smartRound(converted, toUnit) : converted;
}

/** Convert a weight from one unit to another (no rounding). */
export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit,
): number {
  if (fromUnit === toUnit) return value;
  return convertFromKg(convertToKg(value, fromUnit), toUnit);
}

/** Convert a volume to liters for database storage (rounded to 3 decimals). */
export function toStorageVolume(value: number, unit: VolumeUnit): number {
  return roundToDecimals(convertVolume(value, unit, "L"));
}

/** Convert a weight to kg for database storage (rounded to 3 decimals). */
export function toStorageWeight(value: number, unit: WeightUnit): number {
  return roundToDecimals(convertWeight(value, unit, "kg"));
}

// ============================================================
// Strict validated conversions (bushels ↔ kg)
// ============================================================

/**
 * Strict guard for conversions where zero/negative input is meaningless
 * (fruit purchases). Throws QuantityValidationError on zero, negative,
 * non-finite, or above the validation upper bound. Sub-unit positive values
 * (e.g. 0.001 bushel) are allowed.
 */
function assertConvertibleQuantity(
  value: number,
  fieldName: string,
  unit: string,
): void {
  if (value === 0) {
    throw new QuantityValidationError(
      `${fieldName} must be greater than zero: ${value}`,
      `Please enter a positive value for unit conversion.`,
      { fieldName, quantity: value, unit, context: "unit conversion" },
    );
  }
  // Handles negative, non-finite, and upper-bound checks with the shared
  // error type + messages.
  validatePositiveQuantity(value, fieldName, unit, "unit conversion");
}

/** Convert bushels to kilograms, rounded to 0.01 kg. Throws on invalid input. */
export function bushelsToKg(bushels: number): number {
  assertConvertibleQuantity(bushels, "Bushels", "bushels");
  return Math.round(bushels * BUSHEL_TO_KG_FACTOR * 100) / 100;
}

/** Convert kilograms to bushels, rounded to 0.01 bushel. Throws on invalid input. */
export function kgToBushels(kg: number): number {
  assertConvertibleQuantity(kg, "Kilograms", "kg");
  return Math.round((kg / BUSHEL_TO_KG_FACTOR) * 100) / 100;
}

// ============================================================
// Lenient display conversions (gallons ↔ liters)
// ============================================================

/**
 * Convert gallons to liters for storage. Lenient: clamps near-zero to 0 (empty
 * vessels) and rounds to 0.01 L. Throws only on negative / non-finite.
 */
export function gallonsToLiters(gallons: number): number {
  const clamped = Math.abs(gallons) < VOLUME_EPSILON ? 0 : gallons;
  validatePositiveQuantity(clamped, "Gallons", "gal", "unit conversion");
  return Math.round(clamped * GAL_TO_L_FACTOR * 100) / 100;
}

/**
 * Convert liters to gallons for display. Lenient: clamps near-zero to 0 and
 * rounds to 0.01 gal. Throws only on negative / non-finite.
 */
export function litersToGallons(liters: number): number {
  const clamped = Math.abs(liters) < VOLUME_EPSILON ? 0 : liters;
  validatePositiveQuantity(clamped, "Liters", "L", "unit conversion");
  return Math.round((clamped / GAL_TO_L_FACTOR) * 100) / 100;
}

// ============================================================
// Conversion-factor lookups (bushels/kg/gal/L)
// ============================================================

/** Get the multiplicative factor to convert between two supported units. */
export function getConversionFactor(fromUnit: string, toUnit: string): number {
  const conversions: Record<string, Record<string, number>> = {
    bushels: { kg: BUSHEL_TO_KG_FACTOR, bushels: 1 },
    kg: { bushels: 1 / BUSHEL_TO_KG_FACTOR, kg: 1 },
    gal: { L: GAL_TO_L_FACTOR, gal: 1 },
    L: { gal: 1 / GAL_TO_L_FACTOR, L: 1 },
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

/** Whether a (bushels/kg/gal/L) conversion is supported by getConversionFactor. */
export function isConversionSupported(fromUnit: string, toUnit: string): boolean {
  try {
    getConversionFactor(fromUnit, toUnit);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a round-trip conversion stays within ±0.1% tolerance.
 * Supports bushels↔kg and gal↔L.
 */
export function validateConversionPrecision(
  originalValue: number,
  fromUnit: string,
  toUnit: string,
): boolean {
  let roundTripValue: number;
  if (fromUnit === "bushels" && toUnit === "kg") {
    roundTripValue = kgToBushels(bushelsToKg(originalValue));
  } else if (fromUnit === "kg" && toUnit === "bushels") {
    roundTripValue = bushelsToKg(kgToBushels(originalValue));
  } else if (fromUnit === "gal" && toUnit === "L") {
    roundTripValue = litersToGallons(gallonsToLiters(originalValue));
  } else if (fromUnit === "L" && toUnit === "gal") {
    roundTripValue = gallonsToLiters(litersToGallons(originalValue));
  } else {
    throw new Error(`Unsupported conversion validation from ${fromUnit} to ${toUnit}`);
  }
  const percentageError =
    (Math.abs(originalValue - roundTripValue) / originalValue) * 100;
  return percentageError <= 0.1;
}

// ============================================================
// Display symbols + formatters
// ============================================================

/** Display symbols per volume unit. */
export const VOLUME_UNIT_SYMBOLS: Record<VolumeUnit, string> = {
  L: "L",
  gal: "gal",
  mL: "mL",
  oz: "oz",
};

/** Convert liters to a display unit's numeric value (rounded to 0.01). */
export function toDisplayVolume(liters: number, unit: VolumeUnit): number {
  if (unit === "L") return liters;
  return Math.round(convertFromLiters(liters, unit) * 100) / 100;
}

/**
 * Format a volume given in liters.
 * - Without `decimals`: friendly display — whole numbers when close, else 1
 *   decimal (e.g. "5 gal", "19.1 L").
 * - With `decimals`: fixed precision (e.g. formatVolume(5.5, "L", 2) → "5.50 L").
 */
export function formatVolume(
  liters: number,
  unit: VolumeUnit,
  decimals?: number,
): string {
  if (decimals !== undefined) {
    return `${convertFromLiters(liters, unit).toFixed(decimals)} ${unit}`;
  }
  const displayValue = toDisplayVolume(liters, unit);
  const symbol = VOLUME_UNIT_SYMBOLS[unit];
  const formatted =
    Math.abs(displayValue - Math.round(displayValue)) < 0.01
      ? Math.round(displayValue)
      : Number(displayValue.toFixed(1));
  return `${formatted} ${symbol}`;
}

/** Format a current/capacity volume range, e.g. "0 gal / 5 gal". */
export function formatVolumeRange(
  currentLiters: number,
  capacityLiters: number,
  unit: VolumeUnit,
): string {
  return `${formatVolume(currentLiters, unit)} / ${formatVolume(capacityLiters, unit)}`;
}

/**
 * Format a weight given in kilograms, converted to `unit`.
 * formatWeight(0.453592, "lb", 1) → "1.0 lb".
 */
export function formatWeight(
  kg: number,
  unit: WeightUnit,
  decimals: number = 2,
): string {
  return `${convertFromKg(kg, unit).toFixed(decimals)} ${unit}`;
}

/** Format a temperature given in Celsius, converted to `unit`. */
export function formatTemperature(
  celsius: number,
  unit: TemperatureUnit,
  decimals: number = 1,
): string {
  return `${convertFromCelsius(celsius, unit).toFixed(decimals)}°${unit}`;
}

/**
 * Format a (value, fromUnit) conversion as "X from = Y to". Supports
 * bushels↔kg and gal↔L. Throws on unsupported pairs.
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
  } else if (fromUnit === "bushels" && toUnit === "kg") {
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
  return `${value.toFixed(2)} ${fromUnit} = ${converted.toFixed(2)} ${toUnit}`;
}

// ============================================================
// Unit names / validation / misc helpers
// ============================================================

/** Human-readable name for a volume unit. */
export function getVolumeUnitName(unit: VolumeUnit): string {
  const names: Record<VolumeUnit, string> = {
    L: "Liters",
    gal: "Gallons",
    oz: "Fluid Ounces",
    mL: "Milliliters",
  };
  return names[unit];
}

/** Human-readable name for a weight unit. */
export function getWeightUnitName(unit: WeightUnit): string {
  const names: Record<WeightUnit, string> = {
    g: "Grams",
    kg: "Kilograms",
    lb: "Pounds",
    oz: "Ounces",
    bushel: "Bushels",
  };
  return names[unit];
}

/** Type guard: is the string a supported volume unit? */
export function isValidVolumeUnit(unit: string): unit is VolumeUnit {
  return ["L", "gal", "mL", "oz"].includes(unit);
}

/** Type guard: is the string a supported weight unit? */
export function isValidWeightUnit(unit: string): unit is WeightUnit {
  return ["g", "kg", "lb", "oz", "bushel"].includes(unit);
}

/** Validate that a volume value is positive and finite. */
export function isValidVolume(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Validate that a weight value is positive and finite. */
export function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Estimate the weight (kg) of a liquid volume using average densities. */
export function estimateWeightFromVolume(
  volumeLiters: number,
  material: "juice" | "water" | "cider" = "juice",
): number {
  const densities = { juice: 1.05, water: 1.0, cider: 1.01 };
  return volumeLiters * densities[material];
}

/** Sum a list of mixed-unit volumes, returning the total in `resultUnit`. */
export function calculateTotalVolume(
  volumes: Array<{ value: number; unit: VolumeUnit }>,
  resultUnit: VolumeUnit = "L",
): number {
  const totalLiters = volumes.reduce(
    (sum, item) => sum + convertVolume(item.value, item.unit, "L"),
    0,
  );
  return convertVolume(totalLiters, "L", resultUnit);
}
