/**
 * Tests for transfer validation guards
 */

import { describe, it, expect } from 'vitest';
import {
  validateVesselAvailability,
  validateVesselCapacity,
  validateBatchVolume,
  validateNotSelfTransfer,
  validateTransfer,
  transferValidationSchema,
  type VesselData,
  type BatchData,
  type TransferData
} from '../../../packages/lib/src/validation/transfer';
import {
  TransferValidationError,
  VesselStateValidationError
} from '../../../packages/lib/src/validation/errors';

describe('Transfer Validation', () => {
  const mockVessel: VesselData = {
    id: 'vessel-1',
    name: 'Fermenter 1',
    capacityL: 1000,
    status: 'available',
    currentVolumeL: 100
  };

  const mockBatch: BatchData = {
    id: 'batch-1',
    batchNumber: 'B001',
    currentVolumeL: 500,
    status: 'active',
    vesselId: 'vessel-1'
  };

  const mockTransfer: TransferData = {
    batchId: 'batch-1',
    fromVesselId: 'vessel-1',
    toVesselId: 'vessel-2',
    volumeTransferredL: 200,
    transferDate: new Date(),
    reason: 'Moving to conditioning tank'
  };

  describe('validateVesselAvailability', () => {
    it('should pass for available vessel', () => {
      expect(() => validateVesselAvailability(mockVessel)).not.toThrow();
    });

    it('should pass for in_use vessel', () => {
      const vessel = { ...mockVessel, status: 'in_use' as const };
      expect(() => validateVesselAvailability(vessel)).not.toThrow();
    });

    it('should throw for vessel under maintenance', () => {
      const vessel = { ...mockVessel, status: 'maintenance' as const };
      expect(() => validateVesselAvailability(vessel)).toThrow(VesselStateValidationError);
    });

    it('should throw for vessel being cleaned', () => {
      const vessel = { ...mockVessel, status: 'cleaning' as const };
      expect(() => validateVesselAvailability(vessel)).toThrow(VesselStateValidationError);
    });

    it('should include vessel details in error', () => {
      const vessel = { ...mockVessel, status: 'maintenance' as const };
      try {
        validateVesselAvailability(vessel);
      } catch (error) {
        expect(error).toBeInstanceOf(VesselStateValidationError);
        if (error instanceof VesselStateValidationError) {
          expect(error.details.vesselId).toBe(vessel.id);
          expect(error.details.vesselName).toBe(vessel.name);
          expect(error.details.status).toBe(vessel.status);
        }
      }
    });
  });

  describe('validateVesselCapacity', () => {
    it('should pass when transfer fits within capacity', () => {
      expect(() => validateVesselCapacity(mockVessel, 200, 100)).not.toThrow();
    });

    it('should pass when vessel is empty', () => {
      expect(() => validateVesselCapacity(mockVessel, 500, 0)).not.toThrow();
    });

    it('should throw when transfer exceeds capacity', () => {
      expect(() => validateVesselCapacity(mockVessel, 950, 100)).toThrow(TransferValidationError);
    });

    it('should throw when current volume exceeds capacity', () => {
      expect(() => validateVesselCapacity(mockVessel, 1, 1000)).toThrow(TransferValidationError);
    });

    it('should include capacity details in error', () => {
      try {
        validateVesselCapacity(mockVessel, 950, 100);
      } catch (error) {
        expect(error).toBeInstanceOf(TransferValidationError);
        if (error instanceof TransferValidationError) {
          expect(error.details.vesselCapacityL).toBe(1000);
          expect(error.details.currentVolumeL).toBe(100);
          expect(error.details.transferVolumeL).toBe(950);
          expect(error.details.availableCapacityL).toBe(900);
          expect(error.details.excessVolumeL).toBe(50);
        }
      }
    });
  });

  describe('validateBatchVolume', () => {
    it('should pass when transfer volume is within batch volume', () => {
      expect(() => validateBatchVolume(mockBatch, 300)).not.toThrow();
    });

    it('should pass when transferring entire batch', () => {
      expect(() => validateBatchVolume(mockBatch, 500)).not.toThrow();
    });

    it('should throw when transfer exceeds batch volume', () => {
      expect(() => validateBatchVolume(mockBatch, 600)).toThrow(TransferValidationError);
    });

    it('should throw for completed batch', () => {
      const batch = { ...mockBatch, status: 'completed' as const };
      expect(() => validateBatchVolume(batch, 100)).toThrow(TransferValidationError);
    });

    it('should throw for cancelled batch', () => {
      const batch = { ...mockBatch, status: 'cancelled' as const };
      expect(() => validateBatchVolume(batch, 100)).toThrow(TransferValidationError);
    });

    it('should include batch details in error', () => {
      try {
        validateBatchVolume(mockBatch, 600);
      } catch (error) {
        expect(error).toBeInstanceOf(TransferValidationError);
        if (error instanceof TransferValidationError) {
          expect(error.details.batchId).toBe(mockBatch.id);
          expect(error.details.batchNumber).toBe(mockBatch.batchNumber);
          expect(error.details.batchVolumeL).toBe(500);
          expect(error.details.transferVolumeL).toBe(600);
          expect(error.details.shortfallL).toBe(100);
        }
      }
    });
  });

  describe('validateNotSelfTransfer', () => {
    it('should pass when transferring to different vessel', () => {
      expect(() => validateNotSelfTransfer('vessel-1', 'vessel-2')).not.toThrow();
    });

    it('should pass when fromVessel is undefined', () => {
      expect(() => validateNotSelfTransfer(undefined, 'vessel-2')).not.toThrow();
    });

    it('should throw when transferring to same vessel', () => {
      expect(() => validateNotSelfTransfer('vessel-1', 'vessel-1')).toThrow(TransferValidationError);
    });

    it('should include vessel IDs in error', () => {
      try {
        validateNotSelfTransfer('vessel-1', 'vessel-1');
      } catch (error) {
        expect(error).toBeInstanceOf(TransferValidationError);
        if (error instanceof TransferValidationError) {
          expect(error.details.fromVesselId).toBe('vessel-1');
          expect(error.details.toVesselId).toBe('vessel-1');
        }
      }
    });
  });

  describe('validateTransfer', () => {
    const toVessel: VesselData = {
      id: 'vessel-2',
      name: 'Conditioning Tank 1',
      capacityL: 800,
      status: 'available'
    };

    it('should pass for valid transfer', () => {
      expect(() => validateTransfer(
        mockTransfer,
        mockBatch,
        toVessel,
        mockVessel,
        0
      )).not.toThrow();
    });

    it('should throw for negative volume', () => {
      const transfer = { ...mockTransfer, volumeTransferredL: -100 };
      expect(() => validateTransfer(
        transfer,
        mockBatch,
        toVessel,
        mockVessel,
        0
      )).toThrow(TransferValidationError);
    });

    it('should throw for zero volume', () => {
      const transfer = { ...mockTransfer, volumeTransferredL: 0 };
      expect(() => validateTransfer(
        transfer,
        mockBatch,
        toVessel,
        mockVessel,
        0
      )).toThrow(TransferValidationError);
    });

    it('should validate batch volume constraints', () => {
      const transfer = { ...mockTransfer, volumeTransferredL: 600 };
      expect(() => validateTransfer(
        transfer,
        mockBatch,
        toVessel,
        mockVessel,
        0
      )).toThrow(TransferValidationError);
    });

    it('should validate destination vessel availability', () => {
      const unavailableVessel = { ...toVessel, status: 'maintenance' as const };
      expect(() => validateTransfer(
        mockTransfer,
        mockBatch,
        unavailableVessel,
        mockVessel,
        0
      )).toThrow(VesselStateValidationError);
    });

    it('should validate destination vessel capacity', () => {
      expect(() => validateTransfer(
        mockTransfer,
        mockBatch,
        toVessel,
        mockVessel,
        700 // Current volume in destination vessel
      )).toThrow(TransferValidationError);
    });

    it('should validate source vessel availability', () => {
      const unavailableFromVessel = { ...mockVessel, status: 'maintenance' as const };
      expect(() => validateTransfer(
        mockTransfer,
        mockBatch,
        toVessel,
        unavailableFromVessel,
        0
      )).toThrow(VesselStateValidationError);
    });

    it('should work without fromVessel for initial transfers', () => {
      const transfer = { ...mockTransfer, fromVesselId: undefined };
      expect(() => validateTransfer(
        transfer,
        mockBatch,
        toVessel,
        undefined,
        0
      )).not.toThrow();
    });
  });

  describe('transferValidationSchema', () => {
    const validTransferData = {
      batchId: 'batch-1',
      fromVesselId: 'vessel-1',
      toVesselId: 'vessel-2',
      volumeTransferredL: 200,
      transferDate: new Date('2023-01-01'),
      reason: 'Moving to conditioning',
      notes: 'Some notes'
    };

    it('should validate correct transfer data', () => {
      const result = transferValidationSchema.parse(validTransferData);
      expect(result).toEqual(validTransferData);
    });

    it('should validate without fromVesselId', () => {
      const { fromVesselId, ...transferData } = validTransferData;
      const result = transferValidationSchema.parse(transferData);
      expect(result.fromVesselId).toBeUndefined();
    });

    it('should validate without optional fields', () => {
      const { reason, notes, ...transferData } = validTransferData;
      const result = transferValidationSchema.parse(transferData);
      expect(result.reason).toBeUndefined();
      expect(result.notes).toBeUndefined();
    });

    it('should reject invalid UUID formats', () => {
      const invalidData = { ...validTransferData, batchId: 'invalid-uuid' };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative volume', () => {
      const invalidData = { ...validTransferData, volumeTransferredL: -100 };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject zero volume', () => {
      const invalidData = { ...validTransferData, volumeTransferredL: 0 };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject excessively large volume', () => {
      const invalidData = { ...validTransferData, volumeTransferredL: 60000 };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject future transfer date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const invalidData = { ...validTransferData, transferDate: futureDate };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject same from and to vessel', () => {
      const invalidData = { ...validTransferData, toVesselId: 'vessel-1' };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long reason', () => {
      const invalidData = { ...validTransferData, reason: 'a'.repeat(501) };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long notes', () => {
      const invalidData = { ...validTransferData, notes: 'a'.repeat(1001) };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject non-finite volumes', () => {
      const invalidData = { ...validTransferData, volumeTransferredL: Infinity };
      expect(() => transferValidationSchema.parse(invalidData)).toThrow();
    });
  });
});