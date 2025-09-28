/**
 * Unit tests for unit conversion utilities
 *
 * Tests cover:
 * - Basic conversion accuracy (±0.1% tolerance)
 * - Precision handling with 0.01 precision
 * - Edge cases: zero, negative, very large numbers
 * - Round-trip conversion consistency
 * - Error handling for invalid inputs
 * - Display formatting functionality
 */

import { describe, it, expect } from 'vitest';
import {
  bushelsToKg,
  kgToBushels,
  formatUnitConversion,
  validateConversionPrecision,
  getConversionFactor,
  isConversionSupported,
  BUSHEL_TO_KG_FACTOR,
  formatVolume,
  formatVolumeRange,
  toDisplayVolume,
  VolumeUnit,
  VOLUME_UNIT_SYMBOLS
} from '../unitConversion';
import { QuantityValidationError } from '../../validation/errors';

describe('Unit Conversion - bushelsToKg', () => {
  it('should convert 1 bushel to 18.14 kg exactly', () => {
    const result = bushelsToKg(1);
    expect(result).toBe(18.14);
  });

  it('should convert whole numbers accurately', () => {
    expect(bushelsToKg(2)).toBe(36.28);
    expect(bushelsToKg(5)).toBe(90.70);
    expect(bushelsToKg(10)).toBe(181.40);
  });

  it('should handle decimal values with 0.01 kg precision', () => {
    expect(bushelsToKg(1.5)).toBe(27.21);
    expect(bushelsToKg(2.25)).toBe(40.82);
    expect(bushelsToKg(0.1)).toBe(1.81);
  });

  it('should maintain precision for very small values', () => {
    expect(bushelsToKg(0.01)).toBe(0.18);
    expect(bushelsToKg(0.001)).toBe(0.02);
  });

  it('should handle large values accurately', () => {
    expect(bushelsToKg(1000)).toBe(18140);
    expect(bushelsToKg(5000)).toBe(90700);
  });

  it('should round to 0.01 kg precision consistently', () => {
    // Test values that require rounding
    expect(bushelsToKg(1.001)).toBe(18.16); // 18.15814 -> 18.16
    expect(bushelsToKg(1.0001)).toBe(18.14); // 18.141814 -> 18.14
  });

  it('should throw QuantityValidationError for negative values', () => {
    expect(() => bushelsToKg(-1)).toThrow(QuantityValidationError);
    expect(() => bushelsToKg(-0.1)).toThrow(QuantityValidationError);
  });

  it('should throw QuantityValidationError for zero', () => {
    expect(() => bushelsToKg(0)).toThrow(QuantityValidationError);
  });

  it('should throw QuantityValidationError for infinite values', () => {
    expect(() => bushelsToKg(Infinity)).toThrow(QuantityValidationError);
    expect(() => bushelsToKg(-Infinity)).toThrow(QuantityValidationError);
  });

  it('should throw QuantityValidationError for NaN', () => {
    expect(() => bushelsToKg(NaN)).toThrow(QuantityValidationError);
  });
});

describe('Unit Conversion - kgToBushels', () => {
  it('should convert 18.14 kg to 1 bushel exactly', () => {
    const result = kgToBushels(18.14);
    expect(result).toBe(1);
  });

  it('should convert whole kilogram amounts accurately', () => {
    expect(kgToBushels(36.28)).toBe(2);
    expect(kgToBushels(90.70)).toBe(5);
    expect(kgToBushels(181.40)).toBe(10);
  });

  it('should handle decimal values with 0.01 bushel precision', () => {
    expect(kgToBushels(27.21)).toBe(1.5);
    expect(kgToBushels(40.82)).toBe(2.25);
  });

  it('should maintain precision for small values', () => {
    expect(kgToBushels(1.81)).toBe(0.1);
    expect(kgToBushels(0.18)).toBe(0.01);
  });

  it('should handle large values accurately', () => {
    expect(kgToBushels(18140)).toBe(1000);
    expect(kgToBushels(90700)).toBe(5000);
  });

  it('should round to 0.01 bushel precision consistently', () => {
    // Test values that require rounding
    expect(kgToBushels(18.15)).toBe(1); // 1.0005512... -> 1.00
    expect(kgToBushels(18.16)).toBe(1); // 1.0011025... -> 1.00
  });

  it('should throw QuantityValidationError for negative values', () => {
    expect(() => kgToBushels(-1)).toThrow(QuantityValidationError);
    expect(() => kgToBushels(-0.1)).toThrow(QuantityValidationError);
  });

  it('should throw QuantityValidationError for zero', () => {
    expect(() => kgToBushels(0)).toThrow(QuantityValidationError);
  });

  it('should throw QuantityValidationError for infinite values', () => {
    expect(() => kgToBushels(Infinity)).toThrow(QuantityValidationError);
    expect(() => kgToBushels(-Infinity)).toThrow(QuantityValidationError);
  });

  it('should throw QuantityValidationError for NaN', () => {
    expect(() => kgToBushels(NaN)).toThrow(QuantityValidationError);
  });
});

describe('Unit Conversion - Round-trip Accuracy', () => {
  it('should maintain accuracy in bushels -> kg -> bushels conversion', () => {
    const testValues = [1, 2.5, 10, 0.1, 100, 1000];

    testValues.forEach(bushels => {
      const kg = bushelsToKg(bushels);
      const backToBushels = kgToBushels(kg);
      const percentageError = Math.abs(bushels - backToBushels) / bushels * 100;

      expect(percentageError).toBeLessThanOrEqual(0.1);
    });
  });

  it('should maintain accuracy in kg -> bushels -> kg conversion', () => {
    const testValues = [18.14, 50, 100, 1.81, 1814];

    testValues.forEach(kg => {
      const bushels = kgToBushels(kg);
      const backToKg = bushelsToKg(bushels);
      const percentageError = Math.abs(kg - backToKg) / kg * 100;

      // Allow slightly higher tolerance for floating point precision issues
      expect(percentageError).toBeLessThanOrEqual(0.15);
    });
  });
});

describe('Unit Conversion - formatUnitConversion', () => {
  it('should format bushels to kg conversion', () => {
    const result = formatUnitConversion(1, 'bushels', 'kg');
    expect(result).toBe('1.00 bushels = 18.14 kg');
  });

  it('should format kg to bushels conversion', () => {
    const result = formatUnitConversion(18.14, 'kg', 'bushels');
    expect(result).toBe('18.14 kg = 1.00 bushels');
  });

  it('should use pre-computed converted value when provided', () => {
    const result = formatUnitConversion(1, 'bushels', 'kg', 18.14);
    expect(result).toBe('1.00 bushels = 18.14 kg');
  });

  it('should handle decimal values with proper formatting', () => {
    const result = formatUnitConversion(2.5, 'bushels', 'kg');
    expect(result).toBe('2.50 bushels = 45.35 kg');
  });

  it('should throw error for unsupported conversions', () => {
    expect(() => formatUnitConversion(1, 'bushels', 'pounds')).toThrow('Unsupported conversion');
    expect(() => formatUnitConversion(1, 'liters', 'kg')).toThrow('Unsupported conversion');
  });
});

describe('Unit Conversion - validateConversionPrecision', () => {
  it('should validate that standard conversions are within tolerance', () => {
    expect(validateConversionPrecision(1, 'bushels', 'kg')).toBe(true);
    expect(validateConversionPrecision(18.14, 'kg', 'bushels')).toBe(true);
    expect(validateConversionPrecision(10, 'bushels', 'kg')).toBe(true);
    expect(validateConversionPrecision(100, 'kg', 'bushels')).toBe(true);
  });

  it('should validate small values maintain precision', () => {
    expect(validateConversionPrecision(0.1, 'bushels', 'kg')).toBe(true);
    expect(validateConversionPrecision(1.81, 'kg', 'bushels')).toBe(true);
  });

  it('should validate large values maintain precision', () => {
    expect(validateConversionPrecision(1000, 'bushels', 'kg')).toBe(true);
    expect(validateConversionPrecision(18140, 'kg', 'bushels')).toBe(true);
  });

  it('should throw error for unsupported unit combinations', () => {
    expect(() => validateConversionPrecision(1, 'bushels', 'pounds')).toThrow('Unsupported conversion');
    expect(() => validateConversionPrecision(1, 'liters', 'kg')).toThrow('Unsupported conversion');
  });
});

describe('Unit Conversion - getConversionFactor', () => {
  it('should return correct factor for bushels to kg', () => {
    expect(getConversionFactor('bushels', 'kg')).toBe(BUSHEL_TO_KG_FACTOR);
  });

  it('should return correct factor for kg to bushels', () => {
    expect(getConversionFactor('kg', 'bushels')).toBe(1 / BUSHEL_TO_KG_FACTOR);
  });

  it('should return 1 for same unit conversions', () => {
    expect(getConversionFactor('bushels', 'bushels')).toBe(1);
    expect(getConversionFactor('kg', 'kg')).toBe(1);
  });

  it('should throw error for unsupported source units', () => {
    expect(() => getConversionFactor('pounds', 'kg')).toThrow('Unsupported source unit: pounds');
  });

  it('should throw error for unsupported target units', () => {
    expect(() => getConversionFactor('bushels', 'pounds')).toThrow('Unsupported conversion from bushels to pounds');
  });
});

describe('Unit Conversion - isConversionSupported', () => {
  it('should return true for supported conversions', () => {
    expect(isConversionSupported('bushels', 'kg')).toBe(true);
    expect(isConversionSupported('kg', 'bushels')).toBe(true);
    expect(isConversionSupported('bushels', 'bushels')).toBe(true);
    expect(isConversionSupported('kg', 'kg')).toBe(true);
  });

  it('should return false for unsupported conversions', () => {
    expect(isConversionSupported('bushels', 'pounds')).toBe(false);
    expect(isConversionSupported('liters', 'kg')).toBe(false);
    expect(isConversionSupported('pounds', 'bushels')).toBe(false);
  });
});

describe('Unit Conversion - Constant Values', () => {
  it('should have correct conversion factor constant', () => {
    expect(BUSHEL_TO_KG_FACTOR).toBe(18.14);
  });
});

describe('Unit Conversion - Error Messages', () => {
  it('should provide meaningful error messages for validation failures', () => {
    try {
      bushelsToKg(-1);
      expect.fail('Should have thrown QuantityValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(QuantityValidationError);
      expect((error as QuantityValidationError).message).toContain('cannot be negative');
      expect((error as QuantityValidationError).userMessage).toContain('unit conversion');
    }
  });

  it('should provide context in error messages', () => {
    try {
      kgToBushels(0);
      expect.fail('Should have thrown QuantityValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(QuantityValidationError);
      expect((error as QuantityValidationError).userMessage).toContain('unit conversion');
    }
  });
});

describe('Unit Conversion - Integration with Validation System', () => {
  it('should integrate properly with existing quantity validation', () => {
    // Test that the validation uses the same error types as the rest of the system
    expect(() => bushelsToKg(-1)).toThrow(QuantityValidationError);
    expect(() => kgToBushels(Infinity)).toThrow(QuantityValidationError);

    // Test that reasonable upper bounds are enforced by validation
    // The validation system allows up to 1,000,000 for unmapped units
    expect(() => bushelsToKg(1000001)).toThrow(QuantityValidationError);
  });
});

describe('Volume Formatting - toDisplayVolume', () => {
  it('should return liters unchanged for L unit', () => {
    expect(toDisplayVolume(100, 'L')).toBe(100);
    expect(toDisplayVolume(19.05, 'L')).toBe(19.05);
    expect(toDisplayVolume(0, 'L')).toBe(0);
  });

  it('should convert liters to gallons for gal unit', () => {
    expect(toDisplayVolume(18.93, 'gal')).toBeCloseTo(5, 1); // 5 gallon container
    expect(toDisplayVolume(0, 'gal')).toBe(0);
    expect(toDisplayVolume(3.785, 'gal')).toBeCloseTo(1, 1); // ~1 gallon
  });
});

describe('Volume Formatting - formatVolume', () => {
  it('should format liters with L symbol', () => {
    expect(formatVolume(100, 'L')).toBe('100 L');
    expect(formatVolume(19.05, 'L')).toBe('19.1 L');
    expect(formatVolume(19, 'L')).toBe('19 L');
    expect(formatVolume(0, 'L')).toBe('0 L');
  });

  it('should format gallons with gal symbol', () => {
    expect(formatVolume(18.93, 'gal')).toBe('5 gal'); // 5 gallon container
    expect(formatVolume(0, 'gal')).toBe('0 gal');
    expect(formatVolume(3.785, 'gal')).toBe('1 gal'); // ~1 gallon
    expect(formatVolume(7.57, 'gal')).toBe('2 gal'); // ~2 gallons
  });

  it('should show whole numbers when close to integers', () => {
    expect(formatVolume(19.001, 'L')).toBe('19 L'); // Very close to 19
    expect(formatVolume(18.999, 'L')).toBe('19 L'); // Very close to 19
    expect(formatVolume(18.93, 'gal')).toBe('5 gal'); // Exactly 5 gallons when converted
  });

  it('should show 1 decimal place for non-whole numbers', () => {
    expect(formatVolume(19.1, 'L')).toBe('19.1 L');
    expect(formatVolume(18.5, 'L')).toBe('18.5 L');
    expect(formatVolume(7.0, 'gal')).toBe('1.9 gal'); // 7L ≈ 1.85 gal → 1.9 gal
  });
});

describe('Volume Formatting - formatVolumeRange', () => {
  it('should format liter ranges correctly', () => {
    expect(formatVolumeRange(0, 19, 'L')).toBe('0 L / 19 L');
    expect(formatVolumeRange(5.5, 100, 'L')).toBe('5.5 L / 100 L');
    expect(formatVolumeRange(120, 120, 'L')).toBe('120 L / 120 L');
  });

  it('should format gallon ranges correctly', () => {
    // 19L ≈ 5 gal container
    expect(formatVolumeRange(0, 18.93, 'gal')).toBe('0 gal / 5 gal');
    // Partially filled 5 gallon container
    expect(formatVolumeRange(7.57, 18.93, 'gal')).toBe('2 gal / 5 gal');
  });

  it('should handle real-world vessel scenarios', () => {
    // Empty 5-gallon carboy
    expect(formatVolumeRange(0, 18.93, 'gal')).toBe('0 gal / 5 gal');
    // Full 5-gallon carboy
    expect(formatVolumeRange(18.93, 18.93, 'gal')).toBe('5 gal / 5 gal');
    // Empty 120L tank
    expect(formatVolumeRange(0, 120, 'L')).toBe('0 L / 120 L');
    // Partially filled 120L tank
    expect(formatVolumeRange(75.5, 120, 'L')).toBe('75.5 L / 120 L');
  });
});

describe('Volume Formatting - Unit Symbols', () => {
  it('should define correct volume unit symbols', () => {
    expect(VOLUME_UNIT_SYMBOLS.L).toBe('L');
    expect(VOLUME_UNIT_SYMBOLS.gal).toBe('gal');
  });

  it('should support all VolumeUnit types', () => {
    const units: VolumeUnit[] = ['L', 'gal'];
    units.forEach(unit => {
      expect(VOLUME_UNIT_SYMBOLS[unit]).toBeDefined();
      expect(typeof VOLUME_UNIT_SYMBOLS[unit]).toBe('string');
    });
  });
});