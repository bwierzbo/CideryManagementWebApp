/**
 * Tests for volume and quantity validation guards
 */

import { describe, it, expect } from 'vitest';
import {
  validatePositiveVolume,
  validatePositiveQuantity,
  validatePositiveCount,
  validatePositivePrice,
  validatePercentage,
  positiveVolumeSchema,
  positiveQuantitySchema,
  positiveCountSchema,
  positivePriceSchema,
  percentageSchema,
  nonNegativeVolumeSchema,
  nonNegativeQuantitySchema
} from '../../../packages/lib/src/validation/volume-quantity';
import {
  VolumeValidationError,
  QuantityValidationError
} from '../../../packages/lib/src/validation/errors';

describe('Volume and Quantity Validation', () => {
  describe('validatePositiveVolume', () => {
    it('should pass for positive volumes', () => {
      expect(() => validatePositiveVolume(100)).not.toThrow();
      expect(() => validatePositiveVolume(0.1)).not.toThrow();
      expect(() => validatePositiveVolume(1000.5)).not.toThrow();
    });

    it('should throw for negative volume', () => {
      expect(() => validatePositiveVolume(-100)).toThrow(VolumeValidationError);
    });

    it('should throw for zero volume', () => {
      expect(() => validatePositiveVolume(0)).toThrow(VolumeValidationError);
    });

    it('should throw for non-finite volume', () => {
      expect(() => validatePositiveVolume(Infinity)).toThrow(VolumeValidationError);
      expect(() => validatePositiveVolume(NaN)).toThrow(VolumeValidationError);
    });

    it('should throw for excessively large volume', () => {
      expect(() => validatePositiveVolume(60000)).toThrow(VolumeValidationError);
    });

    it('should include context in error messages', () => {
      try {
        validatePositiveVolume(-100, 'Transfer Volume', 'batch B001');
      } catch (error) {
        expect(error).toBeInstanceOf(VolumeValidationError);
        if (error instanceof VolumeValidationError) {
          expect(error.userMessage).toContain('Transfer Volume');
          expect(error.userMessage).toContain('batch B001');
          expect(error.details.fieldName).toBe('Transfer Volume');
          expect(error.details.context).toBe('batch B001');
          expect(error.details.volume).toBe(-100);
        }
      }
    });
  });

  describe('validatePositiveQuantity', () => {
    it('should pass for positive quantities', () => {
      expect(() => validatePositiveQuantity(100, 'Weight', 'kg')).not.toThrow();
      expect(() => validatePositiveQuantity(0.1, 'Amount', 'L')).not.toThrow();
    });

    it('should throw for negative quantity', () => {
      expect(() => validatePositiveQuantity(-100, 'Weight', 'kg')).toThrow(QuantityValidationError);
    });

    it('should throw for zero quantity', () => {
      expect(() => validatePositiveQuantity(0, 'Weight', 'kg')).toThrow(QuantityValidationError);
    });

    it('should throw for non-finite quantity', () => {
      expect(() => validatePositiveQuantity(Infinity, 'Weight', 'kg')).toThrow(QuantityValidationError);
    });

    it('should enforce unit-specific limits', () => {
      expect(() => validatePositiveQuantity(150000, 'Weight', 'kg')).toThrow(QuantityValidationError);
      expect(() => validatePositiveQuantity(300000, 'Weight', 'lb')).toThrow(QuantityValidationError);
      expect(() => validatePositiveQuantity(60000, 'Volume', 'L')).toThrow(QuantityValidationError);
      expect(() => validatePositiveQuantity(15000, 'Volume', 'gal')).toThrow(QuantityValidationError);
    });

    it('should include unit and context in error messages', () => {
      try {
        validatePositiveQuantity(-100, 'Apple Weight', 'kg', 'purchase order');
      } catch (error) {
        expect(error).toBeInstanceOf(QuantityValidationError);
        if (error instanceof QuantityValidationError) {
          expect(error.userMessage).toContain('Apple Weight');
          expect(error.userMessage).toContain('purchase order');
          expect(error.details.unit).toBe('kg');
          expect(error.details.context).toBe('purchase order');
        }
      }
    });
  });

  describe('validatePositiveCount', () => {
    it('should pass for positive integers', () => {
      expect(() => validatePositiveCount(100)).not.toThrow();
      expect(() => validatePositiveCount(1)).not.toThrow();
    });

    it('should throw for negative count', () => {
      expect(() => validatePositiveCount(-5)).toThrow(QuantityValidationError);
    });

    it('should throw for zero count', () => {
      expect(() => validatePositiveCount(0)).toThrow(QuantityValidationError);
    });

    it('should throw for non-integer count', () => {
      expect(() => validatePositiveCount(5.5)).toThrow(QuantityValidationError);
    });

    it('should throw for excessively large count', () => {
      expect(() => validatePositiveCount(2000000)).toThrow(QuantityValidationError);
    });

    it('should include context in error messages', () => {
      try {
        validatePositiveCount(-5, 'Bottle Count', 'packaging run');
      } catch (error) {
        expect(error).toBeInstanceOf(QuantityValidationError);
        if (error instanceof QuantityValidationError) {
          expect(error.userMessage).toContain('Bottle Count');
          expect(error.userMessage).toContain('packaging run');
        }
      }
    });
  });

  describe('validatePositivePrice', () => {
    it('should pass for positive prices', () => {
      expect(() => validatePositivePrice(19.99)).not.toThrow();
      expect(() => validatePositivePrice(0.01)).not.toThrow();
    });

    it('should throw for negative price', () => {
      expect(() => validatePositivePrice(-10)).toThrow(QuantityValidationError);
    });

    it('should throw for zero price', () => {
      expect(() => validatePositivePrice(0)).toThrow(QuantityValidationError);
    });

    it('should throw for non-finite price', () => {
      expect(() => validatePositivePrice(Infinity)).toThrow(QuantityValidationError);
    });

    it('should throw for excessively large price', () => {
      expect(() => validatePositivePrice(2000000)).toThrow(QuantityValidationError);
    });

    it('should include currency and context in error messages', () => {
      try {
        validatePositivePrice(-10, 'Unit Price', 'USD', 'apple purchase');
      } catch (error) {
        expect(error).toBeInstanceOf(QuantityValidationError);
        if (error instanceof QuantityValidationError) {
          expect(error.userMessage).toContain('Unit Price');
          expect(error.userMessage).toContain('apple purchase');
          expect(error.details.currency).toBe('USD');
        }
      }
    });
  });

  describe('validatePercentage', () => {
    it('should pass for valid percentages', () => {
      expect(() => validatePercentage(50)).not.toThrow();
      expect(() => validatePercentage(0)).not.toThrow();
      expect(() => validatePercentage(100)).not.toThrow();
      expect(() => validatePercentage(0.5)).not.toThrow();
    });

    it('should throw for negative percentage', () => {
      expect(() => validatePercentage(-10)).toThrow(QuantityValidationError);
    });

    it('should throw for percentage over 100', () => {
      expect(() => validatePercentage(150)).toThrow(QuantityValidationError);
    });

    it('should throw for non-finite percentage', () => {
      expect(() => validatePercentage(Infinity)).toThrow(QuantityValidationError);
    });

    it('should include context in error messages', () => {
      try {
        validatePercentage(-10, 'Extraction Rate', 'press run');
      } catch (error) {
        expect(error).toBeInstanceOf(QuantityValidationError);
        if (error instanceof QuantityValidationError) {
          expect(error.userMessage).toContain('Extraction Rate');
          expect(error.userMessage).toContain('press run');
        }
      }
    });
  });

  describe('Zod Schemas', () => {
    describe('positiveVolumeSchema', () => {
      it('should validate positive volumes', () => {
        expect(positiveVolumeSchema.parse(100)).toBe(100);
        expect(positiveVolumeSchema.parse(0.1)).toBe(0.1);
      });

      it('should reject negative volumes', () => {
        expect(() => positiveVolumeSchema.parse(-100)).toThrow();
      });

      it('should reject zero volumes', () => {
        expect(() => positiveVolumeSchema.parse(0)).toThrow();
      });

      it('should reject non-finite volumes', () => {
        expect(() => positiveVolumeSchema.parse(Infinity)).toThrow();
        expect(() => positiveVolumeSchema.parse(NaN)).toThrow();
      });

      it('should reject volumes exceeding maximum', () => {
        expect(() => positiveVolumeSchema.parse(60000)).toThrow();
      });
    });

    describe('positiveQuantitySchema', () => {
      it('should validate positive quantities', () => {
        expect(positiveQuantitySchema.parse(100)).toBe(100);
        expect(positiveQuantitySchema.parse(0.001)).toBe(0.001);
      });

      it('should reject negative quantities', () => {
        expect(() => positiveQuantitySchema.parse(-100)).toThrow();
      });

      it('should reject zero quantities', () => {
        expect(() => positiveQuantitySchema.parse(0)).toThrow();
      });
    });

    describe('positiveCountSchema', () => {
      it('should validate positive integers', () => {
        expect(positiveCountSchema.parse(100)).toBe(100);
        expect(positiveCountSchema.parse(1)).toBe(1);
      });

      it('should reject negative counts', () => {
        expect(() => positiveCountSchema.parse(-5)).toThrow();
      });

      it('should reject zero counts', () => {
        expect(() => positiveCountSchema.parse(0)).toThrow();
      });

      it('should reject non-integers', () => {
        expect(() => positiveCountSchema.parse(5.5)).toThrow();
      });
    });

    describe('positivePriceSchema', () => {
      it('should validate positive prices', () => {
        expect(positivePriceSchema.parse(19.99)).toBe(19.99);
        expect(positivePriceSchema.parse(0.01)).toBe(0.01);
      });

      it('should reject negative prices', () => {
        expect(() => positivePriceSchema.parse(-10)).toThrow();
      });

      it('should reject zero prices', () => {
        expect(() => positivePriceSchema.parse(0)).toThrow();
      });
    });

    describe('percentageSchema', () => {
      it('should validate valid percentages', () => {
        expect(percentageSchema.parse(50)).toBe(50);
        expect(percentageSchema.parse(0)).toBe(0);
        expect(percentageSchema.parse(100)).toBe(100);
      });

      it('should reject negative percentages', () => {
        expect(() => percentageSchema.parse(-10)).toThrow();
      });

      it('should reject percentages over 100', () => {
        expect(() => percentageSchema.parse(150)).toThrow();
      });
    });

    describe('nonNegativeVolumeSchema', () => {
      it('should validate non-negative volumes including zero', () => {
        expect(nonNegativeVolumeSchema.parse(100)).toBe(100);
        expect(nonNegativeVolumeSchema.parse(0)).toBe(0);
      });

      it('should reject negative volumes', () => {
        expect(() => nonNegativeVolumeSchema.parse(-100)).toThrow();
      });
    });

    describe('nonNegativeQuantitySchema', () => {
      it('should validate non-negative quantities including zero', () => {
        expect(nonNegativeQuantitySchema.parse(100)).toBe(100);
        expect(nonNegativeQuantitySchema.parse(0)).toBe(0);
      });

      it('should reject negative quantities', () => {
        expect(() => nonNegativeQuantitySchema.parse(-100)).toThrow();
      });
    });
  });
});