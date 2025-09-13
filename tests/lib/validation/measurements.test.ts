/**
 * Tests for measurement validation guards
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateAbv,
  validatePh,
  validateSpecificGravity,
  validateTotalAcidity,
  validateTemperature,
  validateMeasurementDate,
  validateMeasurementVolume,
  validateMeasurement,
  measurementValidationSchema,
  type MeasurementData
} from '../../../packages/lib/src/validation/measurements';
import { MeasurementValidationError } from '../../../packages/lib/src/validation/errors';

describe('Measurement Validation', () => {
  const mockMeasurement: MeasurementData = {
    batchId: 'batch-1',
    measurementDate: new Date('2023-01-01'),
    specificGravity: 1.050,
    abv: 6.5,
    ph: 3.5,
    totalAcidity: 2.5,
    temperature: 18.0,
    volumeL: 500,
    notes: 'Standard measurement',
    takenBy: 'John Doe'
  };

  describe('validateAbv', () => {
    it('should pass for valid ABV values', () => {
      expect(() => validateAbv(0)).not.toThrow();
      expect(() => validateAbv(6.5)).not.toThrow();
      expect(() => validateAbv(20)).not.toThrow();
    });

    it('should pass for undefined ABV', () => {
      expect(() => validateAbv(undefined)).not.toThrow();
    });

    it('should throw for negative ABV', () => {
      expect(() => validateAbv(-1)).toThrow(MeasurementValidationError);
    });

    it('should throw for ABV exceeding maximum', () => {
      expect(() => validateAbv(25)).toThrow(MeasurementValidationError);
    });

    it('should throw for non-finite ABV', () => {
      expect(() => validateAbv(Infinity)).toThrow(MeasurementValidationError);
      expect(() => validateAbv(NaN)).toThrow(MeasurementValidationError);
    });

    it('should include ABV details in error', () => {
      try {
        validateAbv(25);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.abv).toBe(25);
          expect(error.details.maxAllowed).toBe(20);
          expect(error.details.measurementType).toBe('abv');
        }
      }
    });

    it('should log warning for high but valid ABV', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateAbv(15);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('High ABV detected: 15%')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('validatePh', () => {
    it('should pass for valid pH values', () => {
      expect(() => validatePh(2.5)).not.toThrow();
      expect(() => validatePh(3.5)).not.toThrow();
      expect(() => validatePh(4.5)).not.toThrow();
    });

    it('should pass for undefined pH', () => {
      expect(() => validatePh(undefined)).not.toThrow();
    });

    it('should throw for pH too low', () => {
      expect(() => validatePh(2.0)).toThrow(MeasurementValidationError);
    });

    it('should throw for pH too high', () => {
      expect(() => validatePh(5.0)).toThrow(MeasurementValidationError);
    });

    it('should throw for pH outside possible range', () => {
      expect(() => validatePh(-1)).toThrow(MeasurementValidationError);
      expect(() => validatePh(15)).toThrow(MeasurementValidationError);
    });

    it('should throw for non-finite pH', () => {
      expect(() => validatePh(Infinity)).toThrow(MeasurementValidationError);
      expect(() => validatePh(NaN)).toThrow(MeasurementValidationError);
    });

    it('should include pH details in error', () => {
      try {
        validatePh(2.0);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.ph).toBe(2.0);
          expect(error.details.minAllowed).toBe(2.5);
          expect(error.details.maxAllowed).toBe(4.5);
          expect(error.details.measurementType).toBe('ph');
        }
      }
    });
  });

  describe('validateSpecificGravity', () => {
    it('should pass for valid specific gravity values', () => {
      expect(() => validateSpecificGravity(1.000)).not.toThrow();
      expect(() => validateSpecificGravity(1.050)).not.toThrow();
      expect(() => validateSpecificGravity(1.200)).not.toThrow();
    });

    it('should pass for undefined specific gravity', () => {
      expect(() => validateSpecificGravity(undefined)).not.toThrow();
    });

    it('should throw for specific gravity too low', () => {
      expect(() => validateSpecificGravity(0.999)).toThrow(MeasurementValidationError);
    });

    it('should throw for specific gravity too high', () => {
      expect(() => validateSpecificGravity(1.201)).toThrow(MeasurementValidationError);
    });

    it('should throw for specific gravity outside reasonable bounds', () => {
      expect(() => validateSpecificGravity(0.900)).toThrow(MeasurementValidationError);
      expect(() => validateSpecificGravity(1.400)).toThrow(MeasurementValidationError);
    });

    it('should throw for non-finite specific gravity', () => {
      expect(() => validateSpecificGravity(Infinity)).toThrow(MeasurementValidationError);
      expect(() => validateSpecificGravity(NaN)).toThrow(MeasurementValidationError);
    });

    it('should include specific gravity details in error', () => {
      try {
        validateSpecificGravity(0.999);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.specificGravity).toBe(0.999);
          expect(error.details.minAllowed).toBe(1.000);
          expect(error.details.maxAllowed).toBe(1.200);
          expect(error.details.measurementType).toBe('specificGravity');
        }
      }
    });
  });

  describe('validateTotalAcidity', () => {
    it('should pass for valid total acidity values', () => {
      expect(() => validateTotalAcidity(0)).not.toThrow();
      expect(() => validateTotalAcidity(2.5)).not.toThrow();
      expect(() => validateTotalAcidity(5.0)).not.toThrow();
    });

    it('should pass for undefined total acidity', () => {
      expect(() => validateTotalAcidity(undefined)).not.toThrow();
    });

    it('should throw for negative total acidity', () => {
      expect(() => validateTotalAcidity(-1)).toThrow(MeasurementValidationError);
    });

    it('should throw for total acidity too high', () => {
      expect(() => validateTotalAcidity(6.0)).toThrow(MeasurementValidationError);
    });

    it('should throw for dangerously high total acidity', () => {
      expect(() => validateTotalAcidity(25)).toThrow(MeasurementValidationError);
    });

    it('should throw for non-finite total acidity', () => {
      expect(() => validateTotalAcidity(Infinity)).toThrow(MeasurementValidationError);
      expect(() => validateTotalAcidity(NaN)).toThrow(MeasurementValidationError);
    });

    it('should include total acidity details in error', () => {
      try {
        validateTotalAcidity(6.0);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.totalAcidity).toBe(6.0);
          expect(error.details.maxAllowed).toBe(5.0);
          expect(error.details.measurementType).toBe('totalAcidity');
        }
      }
    });
  });

  describe('validateTemperature', () => {
    it('should pass for valid temperature values', () => {
      expect(() => validateTemperature(-10)).not.toThrow();
      expect(() => validateTemperature(18)).not.toThrow();
      expect(() => validateTemperature(50)).not.toThrow();
    });

    it('should pass for undefined temperature', () => {
      expect(() => validateTemperature(undefined)).not.toThrow();
    });

    it('should throw for temperature too low', () => {
      expect(() => validateTemperature(-15)).toThrow(MeasurementValidationError);
    });

    it('should throw for temperature too high', () => {
      expect(() => validateTemperature(60)).toThrow(MeasurementValidationError);
    });

    it('should throw for temperature outside reasonable bounds', () => {
      expect(() => validateTemperature(-60)).toThrow(MeasurementValidationError);
      expect(() => validateTemperature(120)).toThrow(MeasurementValidationError);
    });

    it('should throw for non-finite temperature', () => {
      expect(() => validateTemperature(Infinity)).toThrow(MeasurementValidationError);
      expect(() => validateTemperature(NaN)).toThrow(MeasurementValidationError);
    });

    it('should include temperature details in error', () => {
      try {
        validateTemperature(-15);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.temperature).toBe(-15);
          expect(error.details.minAllowed).toBe(-10);
          expect(error.details.maxAllowed).toBe(50);
          expect(error.details.measurementType).toBe('temperature');
        }
      }
    });
  });

  describe('validateMeasurementDate', () => {
    it('should pass for current date', () => {
      const today = new Date();
      expect(() => validateMeasurementDate(today)).not.toThrow();
    });

    it('should pass for past date', () => {
      const pastDate = new Date('2022-01-01');
      expect(() => validateMeasurementDate(pastDate)).not.toThrow();
    });

    it('should throw for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(() => validateMeasurementDate(futureDate)).toThrow(MeasurementValidationError);
    });

    it('should include date details in error', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      try {
        validateMeasurementDate(futureDate);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.measurementDate).toBe(futureDate.toISOString());
          expect(error.details.currentDate).toBeDefined();
          expect(error.details.measurementType).toBe('date');
        }
      }
    });
  });

  describe('validateMeasurementVolume', () => {
    it('should pass for valid volumes', () => {
      expect(() => validateMeasurementVolume(100)).not.toThrow();
      expect(() => validateMeasurementVolume(0)).not.toThrow();
    });

    it('should pass for undefined volume', () => {
      expect(() => validateMeasurementVolume(undefined)).not.toThrow();
    });

    it('should throw for negative volume', () => {
      expect(() => validateMeasurementVolume(-100)).toThrow(MeasurementValidationError);
    });

    it('should throw for excessively large volume', () => {
      expect(() => validateMeasurementVolume(60000)).toThrow(MeasurementValidationError);
    });

    it('should throw for non-finite volume', () => {
      expect(() => validateMeasurementVolume(Infinity)).toThrow(MeasurementValidationError);
      expect(() => validateMeasurementVolume(NaN)).toThrow(MeasurementValidationError);
    });

    it('should include volume details in error', () => {
      try {
        validateMeasurementVolume(-100);
      } catch (error) {
        expect(error).toBeInstanceOf(MeasurementValidationError);
        if (error instanceof MeasurementValidationError) {
          expect(error.details.volumeL).toBe(-100);
          expect(error.details.measurementType).toBe('volume');
        }
      }
    });
  });

  describe('validateMeasurement', () => {
    it('should pass for valid measurement data', () => {
      expect(() => validateMeasurement(mockMeasurement)).not.toThrow();
    });

    it('should pass with minimal measurement data', () => {
      const minimalMeasurement: MeasurementData = {
        batchId: 'batch-1',
        measurementDate: new Date('2023-01-01')
      };
      expect(() => validateMeasurement(minimalMeasurement)).not.toThrow();
    });

    it('should validate measurement date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const measurement = { ...mockMeasurement, measurementDate: futureDate };
      expect(() => validateMeasurement(measurement)).toThrow(MeasurementValidationError);
    });

    it('should validate all measurement types', () => {
      const invalidMeasurement = {
        ...mockMeasurement,
        abv: -1,
        ph: 5.5,
        specificGravity: 0.999,
        totalAcidity: -1,
        temperature: -20,
        volumeL: -100
      };

      // Should throw for the first invalid measurement encountered
      expect(() => validateMeasurement(invalidMeasurement)).toThrow(MeasurementValidationError);
    });
  });

  describe('measurementValidationSchema', () => {
    const validMeasurementData = {
      batchId: 'batch-1',
      measurementDate: new Date('2023-01-01'),
      specificGravity: 1.050,
      abv: 6.5,
      ph: 3.5,
      totalAcidity: 2.5,
      temperature: 18.0,
      volumeL: 500,
      notes: 'Standard measurement',
      takenBy: 'John Doe'
    };

    it('should validate correct measurement data', () => {
      const result = measurementValidationSchema.parse(validMeasurementData);
      expect(result).toEqual(validMeasurementData);
    });

    it('should validate with minimal required fields', () => {
      const minimalData = {
        batchId: 'batch-1',
        measurementDate: new Date('2023-01-01')
      };
      const result = measurementValidationSchema.parse(minimalData);
      expect(result.batchId).toBe(minimalData.batchId);
      expect(result.measurementDate).toEqual(minimalData.measurementDate);
    });

    it('should reject invalid UUID format', () => {
      const invalidData = { ...validMeasurementData, batchId: 'invalid-uuid' };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject future measurement date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const invalidData = { ...validMeasurementData, measurementDate: futureDate };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject specific gravity below minimum', () => {
      const invalidData = { ...validMeasurementData, specificGravity: 0.999 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject specific gravity above maximum', () => {
      const invalidData = { ...validMeasurementData, specificGravity: 1.201 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative ABV', () => {
      const invalidData = { ...validMeasurementData, abv: -1 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject ABV exceeding maximum', () => {
      const invalidData = { ...validMeasurementData, abv: 25 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject pH below minimum', () => {
      const invalidData = { ...validMeasurementData, ph: 2.4 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject pH above maximum', () => {
      const invalidData = { ...validMeasurementData, ph: 4.6 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative total acidity', () => {
      const invalidData = { ...validMeasurementData, totalAcidity: -1 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject total acidity exceeding maximum', () => {
      const invalidData = { ...validMeasurementData, totalAcidity: 6 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject temperature below minimum', () => {
      const invalidData = { ...validMeasurementData, temperature: -15 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject temperature above maximum', () => {
      const invalidData = { ...validMeasurementData, temperature: 60 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative volume', () => {
      const invalidData = { ...validMeasurementData, volumeL: -100 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject excessively large volume', () => {
      const invalidData = { ...validMeasurementData, volumeL: 60000 };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long notes', () => {
      const invalidData = { ...validMeasurementData, notes: 'a'.repeat(1001) };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long takenBy', () => {
      const invalidData = { ...validMeasurementData, takenBy: 'a'.repeat(101) };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject non-finite values', () => {
      const invalidData = { ...validMeasurementData, abv: Infinity };
      expect(() => measurementValidationSchema.parse(invalidData)).toThrow();
    });
  });
});