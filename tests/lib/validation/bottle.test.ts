/**
 * Tests for packaging validation guards
 */

import { describe, it, expect } from 'vitest';
import {
  validateBatchReadyForPackaging,
  validatePackagingVolume,
  validateBottleConsistency,
  validatePackagingAbv,
  validatePackagingDate,
  validatePackaging,
  packagingValidationSchema,
  type BatchPackagingData,
  type BottleRunData,
  type ExistingPackagingData
} from './packages/lib/src/validation/bottles';
import { PackagingValidationError } from './packages/lib/src/validation/errors';

describe('Packaging Validation', () => {
  const mockBatch: BatchPackagingData = {
    id: 'batch-1',
    batchNumber: 'B001',
    currentVolumeL: 500,
    status: 'active',
    vesselId: 'vessel-1'
  };

  const mockPackagingData: BottleRunData = {
    batchId: 'batch-1',
    packageDate: new Date('2023-01-01'),
    volumePackagedL: 200,
    bottleSize: '750ml',
    bottleCount: 267,
    abvAtPackaging: 6.5,
    notes: 'First packaging run'
  };

  const mockExistingPackaging: ExistingPackagingData = {
    totalVolumePackagedL: 100,
    bottleRuns: [
      {
        id: 'pkg-1',
        volumePackagedL: 100,
        packageDate: new Date('2022-12-01')
      }
    ]
  };

  describe('validateBatchReadyForPackaging', () => {
    it('should pass for active batch with volume', () => {
      expect(() => validateBatchReadyForPackaging(mockBatch)).not.toThrow();
    });

    it('should pass for completed batch', () => {
      const batch = { ...mockBatch, status: 'completed' as const };
      expect(() => validateBatchReadyForPackaging(batch)).not.toThrow();
    });

    it('should throw for planned batch', () => {
      const batch = { ...mockBatch, status: 'planned' as const };
      expect(() => validateBatchReadyForPackaging(batch)).toThrow(PackagingValidationError);
    });

    it('should throw for cancelled batch', () => {
      const batch = { ...mockBatch, status: 'cancelled' as const };
      expect(() => validateBatchReadyForPackaging(batch)).toThrow(PackagingValidationError);
    });

    it('should throw for batch with no volume', () => {
      const batch = { ...mockBatch, currentVolumeL: 0 };
      expect(() => validateBatchReadyForPackaging(batch)).toThrow(PackagingValidationError);
    });

    it('should throw for batch with negative volume', () => {
      const batch = { ...mockBatch, currentVolumeL: -10 };
      expect(() => validateBatchReadyForPackaging(batch)).toThrow(PackagingValidationError);
    });

    it('should include batch details in error', () => {
      const batch = { ...mockBatch, status: 'planned' as const };
      try {
        validateBatchReadyForPackaging(batch);
      } catch (error) {
        expect(error).toBeInstanceOf(PackagingValidationError);
        if (error instanceof PackagingValidationError) {
          expect(error.details.batchId).toBe(batch.id);
          expect(error.details.batchNumber).toBe(batch.batchNumber);
          expect(error.details.status).toBe(batch.status);
        }
      }
    });
  });

  describe('validatePackagingVolume', () => {
    it('should pass when packaging volume fits within available volume', () => {
      expect(() => validatePackagingVolume(mockBatch, mockPackagingData)).not.toThrow();
    });

    it('should pass when packaging entire remaining volume', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 400 };
      expect(() => validatePackagingVolume(mockBatch, packagingData, mockExistingPackaging)).not.toThrow();
    });

    it('should throw when packaging volume exceeds remaining volume', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 450 };
      expect(() => validatePackagingVolume(mockBatch, packagingData, mockExistingPackaging)).toThrow(PackagingValidationError);
    });

    it('should throw when packaging volume exceeds total batch volume', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 600 };
      expect(() => validatePackagingVolume(mockBatch, packagingData)).toThrow(PackagingValidationError);
    });

    it('should throw for negative packaging volume', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: -100 };
      expect(() => validatePackagingVolume(mockBatch, packagingData)).toThrow();
    });

    it('should throw for zero packaging volume', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 0 };
      expect(() => validatePackagingVolume(mockBatch, packagingData)).toThrow();
    });

    it('should include volume details in error', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 450 };
      try {
        validatePackagingVolume(mockBatch, packagingData, mockExistingPackaging);
      } catch (error) {
        expect(error).toBeInstanceOf(PackagingValidationError);
        if (error instanceof PackagingValidationError) {
          expect(error.details.batchVolumeL).toBe(500);
          expect(error.details.previouslyPackagedL).toBe(100);
          expect(error.details.remainingVolumeL).toBe(400);
          expect(error.details.requestedVolumeL).toBe(450);
          expect(error.details.excessVolumeL).toBe(50);
        }
      }
    });
  });

  describe('validateBottleConsistency', () => {
    it('should pass for consistent 750ml bottles', () => {
      expect(() => validateBottleConsistency(mockPackagingData)).not.toThrow();
    });

    it('should pass for 500ml bottles', () => {
      const packagingData = {
        ...mockPackagingData,
        bottleSize: '500ml',
        bottleCount: 400,
        volumePackagedL: 200
      };
      expect(() => validateBottleConsistency(packagingData)).not.toThrow();
    });

    it('should pass for 12oz bottles', () => {
      const packagingData = {
        ...mockPackagingData,
        bottleSize: '12oz',
        bottleCount: 565,
        volumePackagedL: 200
      };
      expect(() => validateBottleConsistency(packagingData)).not.toThrow();
    });

    it('should pass for bottles in liters', () => {
      const packagingData = {
        ...mockPackagingData,
        bottleSize: '0.75L',
        bottleCount: 267,
        volumePackagedL: 200
      };
      expect(() => validateBottleConsistency(packagingData)).not.toThrow();
    });

    it('should throw for invalid bottle size format', () => {
      const packagingData = { ...mockPackagingData, bottleSize: 'large' };
      expect(() => validateBottleConsistency(packagingData)).toThrow(PackagingValidationError);
    });

    it('should throw for negative bottle count', () => {
      const packagingData = { ...mockPackagingData, bottleCount: -10 };
      expect(() => validateBottleConsistency(packagingData)).toThrow();
    });

    it('should throw for zero bottle count', () => {
      const packagingData = { ...mockPackagingData, bottleCount: 0 };
      expect(() => validateBottleConsistency(packagingData)).toThrow();
    });

    it('should throw for non-integer bottle count', () => {
      const packagingData = { ...mockPackagingData, bottleCount: 267.5 };
      expect(() => validateBottleConsistency(packagingData)).toThrow();
    });

    it('should throw when volume calculation is inconsistent', () => {
      const packagingData = {
        ...mockPackagingData,
        bottleCount: 100, // 100 × 0.75L = 75L, but volumePackagedL is 200L
        volumePackagedL: 200
      };
      expect(() => validateBottleConsistency(packagingData)).toThrow(PackagingValidationError);
    });

    it('should include bottle calculation details in error', () => {
      const packagingData = {
        ...mockPackagingData,
        bottleCount: 100,
        volumePackagedL: 200
      };
      try {
        validateBottleConsistency(packagingData);
      } catch (error) {
        expect(error).toBeInstanceOf(PackagingValidationError);
        if (error instanceof PackagingValidationError) {
          expect(error.details.bottleCount).toBe(100);
          expect(error.details.bottleSize).toBe('750ml');
          expect(error.details.calculatedTotalVolumeL).toBeCloseTo(75);
          expect(error.details.specifiedVolumeL).toBe(200);
        }
      }
    });
  });

  describe('validatePackagingAbv', () => {
    it('should pass for valid ABV', () => {
      expect(() => validatePackagingAbv(6.5)).not.toThrow();
      expect(() => validatePackagingAbv(0)).not.toThrow();
      expect(() => validatePackagingAbv(20)).not.toThrow();
    });

    it('should pass for undefined ABV', () => {
      expect(() => validatePackagingAbv(undefined)).not.toThrow();
    });

    it('should throw for negative ABV', () => {
      expect(() => validatePackagingAbv(-1)).toThrow(PackagingValidationError);
    });

    it('should throw for ABV exceeding maximum', () => {
      expect(() => validatePackagingAbv(25)).toThrow(PackagingValidationError);
    });

    it('should throw for non-finite ABV', () => {
      expect(() => validatePackagingAbv(Infinity)).toThrow(PackagingValidationError);
      expect(() => validatePackagingAbv(NaN)).toThrow(PackagingValidationError);
    });

    it('should include ABV details in error', () => {
      try {
        validatePackagingAbv(25);
      } catch (error) {
        expect(error).toBeInstanceOf(PackagingValidationError);
        if (error instanceof PackagingValidationError) {
          expect(error.details.abv).toBe(25);
          expect(error.details.maxAllowed).toBe(20);
        }
      }
    });
  });

  describe('validatePackagingDate', () => {
    it('should pass for current date', () => {
      const today = new Date();
      expect(() => validatePackagingDate(today)).not.toThrow();
    });

    it('should pass for past date', () => {
      const pastDate = new Date('2022-01-01');
      expect(() => validatePackagingDate(pastDate)).not.toThrow();
    });

    it('should throw for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(() => validatePackagingDate(futureDate)).toThrow(PackagingValidationError);
    });

    it('should include date details in error', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      try {
        validatePackagingDate(futureDate);
      } catch (error) {
        expect(error).toBeInstanceOf(PackagingValidationError);
        if (error instanceof PackagingValidationError) {
          expect(error.details.packageDate).toBe(futureDate.toISOString());
          expect(error.details.currentDate).toBeDefined();
        }
      }
    });
  });

  describe('validatePackaging', () => {
    it('should pass for valid packaging data', () => {
      expect(() => validatePackaging(mockBatch, mockPackagingData)).not.toThrow();
    });

    it('should pass with existing packaging data', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 300 };
      expect(() => validatePackaging(mockBatch, packagingData, mockExistingPackaging)).not.toThrow();
    });

    it('should validate batch readiness', () => {
      const batch = { ...mockBatch, status: 'planned' as const };
      expect(() => validatePackaging(batch, mockPackagingData)).toThrow(PackagingValidationError);
    });

    it('should validate packaging date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const packagingData = { ...mockPackagingData, packageDate: futureDate };
      expect(() => validatePackaging(mockBatch, packagingData)).toThrow(PackagingValidationError);
    });

    it('should validate packaging volume', () => {
      const packagingData = { ...mockPackagingData, volumePackagedL: 600 };
      expect(() => validatePackaging(mockBatch, packagingData)).toThrow(PackagingValidationError);
    });

    it('should validate bottle consistency', () => {
      const packagingData = { ...mockPackagingData, bottleSize: 'invalid' };
      expect(() => validatePackaging(mockBatch, packagingData)).toThrow(PackagingValidationError);
    });

    it('should validate ABV', () => {
      const packagingData = { ...mockPackagingData, abvAtPackaging: 25 };
      expect(() => validatePackaging(mockBatch, packagingData)).toThrow(PackagingValidationError);
    });
  });

  describe('packagingValidationSchema', () => {
    const validPackagingData = {
      batchId: 'batch-1',
      packageDate: new Date('2023-01-01'),
      volumePackagedL: 200,
      bottleSize: '750ml',
      bottleCount: 267,
      abvAtPackaging: 6.5,
      notes: 'First packaging run'
    };

    it('should validate correct packaging data', () => {
      const result = packagingValidationSchema.parse(validPackagingData);
      expect(result).toEqual(validPackagingData);
    });

    it('should validate without optional fields', () => {
      const { abvAtPackaging, notes, ...packagingData } = validPackagingData;
      const result = packagingValidationSchema.parse(packagingData);
      expect(result.abvAtPackaging).toBeUndefined();
      expect(result.notes).toBeUndefined();
    });

    it('should reject invalid UUID format', () => {
      const invalidData = { ...validPackagingData, batchId: 'invalid-uuid' };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject future packaging date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const invalidData = { ...validPackagingData, packageDate: futureDate };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative volume', () => {
      const invalidData = { ...validPackagingData, volumePackagedL: -100 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject zero volume', () => {
      const invalidData = { ...validPackagingData, volumePackagedL: 0 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject excessively large volume', () => {
      const invalidData = { ...validPackagingData, volumePackagedL: 60000 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty bottle size', () => {
      const invalidData = { ...validPackagingData, bottleSize: '' };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject bottle size without numeric value', () => {
      const invalidData = { ...validPackagingData, bottleSize: 'large' };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative bottle count', () => {
      const invalidData = { ...validPackagingData, bottleCount: -10 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject zero bottle count', () => {
      const invalidData = { ...validPackagingData, bottleCount: 0 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject non-integer bottle count', () => {
      const invalidData = { ...validPackagingData, bottleCount: 267.5 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative ABV', () => {
      const invalidData = { ...validPackagingData, abvAtPackaging: -1 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject ABV exceeding maximum', () => {
      const invalidData = { ...validPackagingData, abvAtPackaging: 25 };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long notes', () => {
      const invalidData = { ...validPackagingData, notes: 'a'.repeat(1001) };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject non-finite values', () => {
      const invalidData = { ...validPackagingData, volumePackagedL: Infinity };
      expect(() => packagingValidationSchema.parse(invalidData)).toThrow();
    });
  });
});