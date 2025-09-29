/**
 * Tests for vessel state transition validation guards
 */

import { describe, it, expect } from 'vitest';
import {
  validateStateTransition,
  validateTransitionWithContent,
  validateVesselUsability,
  validateVesselTypeForOperation,
  validateVesselState,
  vesselStateValidationSchema,
  stateTransitionSchema,
  type VesselStateData,
  type VesselStatus
} from './packages/lib/src/validation/vessel-state';
import { VesselStateValidationError } from './packages/lib/src/validation/errors';

describe('Vessel State Validation', () => {
  const mockVessel: VesselStateData = {
    id: 'vessel-1',
    name: 'Fermenter 1',
    status: 'available',
    currentVolumeL: 0,
    capacityL: 1000,
    type: 'fermenter'
  };

  describe('validateStateTransition', () => {
    it('should pass for valid transitions from available', () => {
      expect(() => validateStateTransition(mockVessel, 'in_use')).not.toThrow();
      expect(() => validateStateTransition(mockVessel, 'cleaning')).not.toThrow();
      expect(() => validateStateTransition(mockVessel, 'maintenance')).not.toThrow();
    });

    it('should pass for valid transitions from in_use', () => {
      const vessel = { ...mockVessel, status: 'in_use' as VesselStatus };
      expect(() => validateStateTransition(vessel, 'available')).not.toThrow();
      expect(() => validateStateTransition(vessel, 'cleaning')).not.toThrow();
      expect(() => validateStateTransition(vessel, 'maintenance')).not.toThrow();
    });

    it('should pass for valid transitions from cleaning', () => {
      const vessel = { ...mockVessel, status: 'cleaning' as VesselStatus };
      expect(() => validateStateTransition(vessel, 'available')).not.toThrow();
      expect(() => validateStateTransition(vessel, 'maintenance')).not.toThrow();
    });

    it('should pass for valid transitions from maintenance', () => {
      const vessel = { ...mockVessel, status: 'maintenance' as VesselStatus };
      expect(() => validateStateTransition(vessel, 'available')).not.toThrow();
      expect(() => validateStateTransition(vessel, 'cleaning')).not.toThrow();
    });

    it('should throw when transitioning to same status', () => {
      expect(() => validateStateTransition(mockVessel, 'available')).toThrow(VesselStateValidationError);
    });

    it('should throw for invalid transitions', () => {
      const vessel = { ...mockVessel, status: 'cleaning' as VesselStatus };
      expect(() => validateStateTransition(vessel, 'in_use')).toThrow(VesselStateValidationError);
    });

    it('should include transition details in error', () => {
      try {
        validateStateTransition(mockVessel, 'available');
      } catch (error) {
        expect(error).toBeInstanceOf(VesselStateValidationError);
        if (error instanceof VesselStateValidationError) {
          expect(error.details.vesselId).toBe(mockVessel.id);
          expect(error.details.vesselName).toBe(mockVessel.name);
          expect(error.details.currentStatus).toBe('available');
          expect(error.details.newStatus).toBe('available');
        }
      }
    });

    it('should include allowed transitions in error for invalid transition', () => {
      const vessel = { ...mockVessel, status: 'cleaning' as VesselStatus };
      try {
        validateStateTransition(vessel, 'in_use');
      } catch (error) {
        expect(error).toBeInstanceOf(VesselStateValidationError);
        if (error instanceof VesselStateValidationError) {
          expect(error.details.allowedTransitions).toEqual(['available', 'maintenance']);
        }
      }
    });
  });

  describe('validateTransitionWithContent', () => {
    it('should pass for transitions with empty vessel', () => {
      expect(() => validateTransitionWithContent(mockVessel, 'cleaning')).not.toThrow();
      expect(() => validateTransitionWithContent(mockVessel, 'maintenance')).not.toThrow();
    });

    it('should pass for transitions that allow content', () => {
      const vessel = { ...mockVessel, currentVolumeL: 500 };
      expect(() => validateTransitionWithContent(vessel, 'in_use')).not.toThrow();
      expect(() => validateTransitionWithContent(vessel, 'available')).not.toThrow();
    });

    it('should throw when trying to clean vessel with content', () => {
      const vessel = { ...mockVessel, currentVolumeL: 500 };
      expect(() => validateTransitionWithContent(vessel, 'cleaning')).toThrow(VesselStateValidationError);
    });

    it('should throw when trying to maintain vessel with content', () => {
      const vessel = { ...mockVessel, currentVolumeL: 500 };
      expect(() => validateTransitionWithContent(vessel, 'maintenance')).toThrow(VesselStateValidationError);
    });

    it('should throw when setting in_use vessel to available with active batches', () => {
      const vessel = { ...mockVessel, status: 'in_use' as VesselStatus };
      expect(() => validateTransitionWithContent(vessel, 'available', true)).toThrow(VesselStateValidationError);
    });

    it('should pass when setting in_use vessel to available without active batches', () => {
      const vessel = { ...mockVessel, status: 'in_use' as VesselStatus };
      expect(() => validateTransitionWithContent(vessel, 'available', false)).not.toThrow();
    });

    it('should include content details in error', () => {
      const vessel = { ...mockVessel, currentVolumeL: 500 };
      try {
        validateTransitionWithContent(vessel, 'cleaning');
      } catch (error) {
        expect(error).toBeInstanceOf(VesselStateValidationError);
        if (error instanceof VesselStateValidationError) {
          expect(error.details.currentVolumeL).toBe(500);
          expect(error.details.newStatus).toBe('cleaning');
        }
      }
    });
  });

  describe('validateVesselUsability', () => {
    it('should pass for available vessel operations', () => {
      expect(() => validateVesselUsability(mockVessel, 'transfer_in')).not.toThrow();
      expect(() => validateVesselUsability(mockVessel, 'transfer_out')).not.toThrow();
      expect(() => validateVesselUsability(mockVessel, 'measurement')).not.toThrow();
      expect(() => validateVesselUsability(mockVessel, 'packaging')).not.toThrow();
      expect(() => validateVesselUsability(mockVessel, 'cleaning')).not.toThrow();
      expect(() => validateVesselUsability(mockVessel, 'maintenance')).not.toThrow();
    });

    it('should pass for in_use vessel operations', () => {
      const vessel = { ...mockVessel, status: 'in_use' as VesselStatus };
      expect(() => validateVesselUsability(vessel, 'transfer_in')).not.toThrow();
      expect(() => validateVesselUsability(vessel, 'transfer_out')).not.toThrow();
      expect(() => validateVesselUsability(vessel, 'measurement')).not.toThrow();
      expect(() => validateVesselUsability(vessel, 'packaging')).not.toThrow();
    });

    it('should throw for transfer operations on maintenance vessel', () => {
      const vessel = { ...mockVessel, status: 'maintenance' as VesselStatus };
      expect(() => validateVesselUsability(vessel, 'transfer_in')).toThrow(VesselStateValidationError);
      expect(() => validateVesselUsability(vessel, 'transfer_out')).toThrow(VesselStateValidationError);
      expect(() => validateVesselUsability(vessel, 'measurement')).toThrow(VesselStateValidationError);
      expect(() => validateVesselUsability(vessel, 'packaging')).toThrow(VesselStateValidationError);
    });

    it('should throw for transfer_in and measurements on cleaning vessel', () => {
      const vessel = { ...mockVessel, status: 'cleaning' as VesselStatus };
      expect(() => validateVesselUsability(vessel, 'transfer_in')).toThrow(VesselStateValidationError);
      expect(() => validateVesselUsability(vessel, 'measurement')).toThrow(VesselStateValidationError);
      expect(() => validateVesselUsability(vessel, 'packaging')).toThrow(VesselStateValidationError);
    });

    it('should allow transfer_out from cleaning vessel', () => {
      const vessel = { ...mockVessel, status: 'cleaning' as VesselStatus };
      expect(() => validateVesselUsability(vessel, 'transfer_out')).not.toThrow();
    });

    it('should throw for cleaning vessel under maintenance', () => {
      const vessel = { ...mockVessel, status: 'maintenance' as VesselStatus };
      expect(() => validateVesselUsability(vessel, 'cleaning')).toThrow(VesselStateValidationError);
    });

    it('should throw for unknown operation', () => {
      // @ts-expect-error - Testing invalid operation
      expect(() => validateVesselUsability(mockVessel, 'unknown')).toThrow(VesselStateValidationError);
    });

    it('should include operation details in error', () => {
      const vessel = { ...mockVessel, status: 'maintenance' as VesselStatus };
      try {
        validateVesselUsability(vessel, 'transfer_in');
      } catch (error) {
        expect(error).toBeInstanceOf(VesselStateValidationError);
        if (error instanceof VesselStateValidationError) {
          expect(error.details.operation).toBe('transfer_in');
          expect(error.details.status).toBe('maintenance');
        }
      }
    });
  });

  describe('validateVesselTypeForOperation', () => {
    it('should pass for appropriate vessel type operations', () => {
      const fermenter = { ...mockVessel, type: 'fermenter' as const };
      expect(() => validateVesselTypeForOperation(fermenter, 'fermentation')).not.toThrow();
      expect(() => validateVesselTypeForOperation(fermenter, 'storage')).not.toThrow();

      const conditioningTank = { ...mockVessel, type: 'conditioning_tank' as const };
      expect(() => validateVesselTypeForOperation(conditioningTank, 'conditioning')).not.toThrow();
      expect(() => validateVesselTypeForOperation(conditioningTank, 'storage')).not.toThrow();

      const brightTank = { ...mockVessel, type: 'bright_tank' as const };
      expect(() => validateVesselTypeForOperation(brightTank, 'packaging')).not.toThrow();
      expect(() => validateVesselTypeForOperation(brightTank, 'storage')).not.toThrow();

      const storage = { ...mockVessel, type: 'storage' as const };
      expect(() => validateVesselTypeForOperation(storage, 'storage')).not.toThrow();
    });

    it('should throw for inappropriate vessel type operations', () => {
      const fermenter = { ...mockVessel, type: 'fermenter' as const };
      expect(() => validateVesselTypeForOperation(fermenter, 'packaging')).toThrow(VesselStateValidationError);
      expect(() => validateVesselTypeForOperation(fermenter, 'conditioning')).toThrow(VesselStateValidationError);

      const brightTank = { ...mockVessel, type: 'bright_tank' as const };
      expect(() => validateVesselTypeForOperation(brightTank, 'fermentation')).toThrow(VesselStateValidationError);

      const storage = { ...mockVessel, type: 'storage' as const };
      expect(() => validateVesselTypeForOperation(storage, 'fermentation')).toThrow(VesselStateValidationError);
      expect(() => validateVesselTypeForOperation(storage, 'conditioning')).toThrow(VesselStateValidationError);
      expect(() => validateVesselTypeForOperation(storage, 'packaging')).toThrow(VesselStateValidationError);
    });

    it('should include type and operation details in error', () => {
      const fermenter = { ...mockVessel, type: 'fermenter' as const };
      try {
        validateVesselTypeForOperation(fermenter, 'packaging');
      } catch (error) {
        expect(error).toBeInstanceOf(VesselStateValidationError);
        if (error instanceof VesselStateValidationError) {
          expect(error.details.vesselType).toBe('fermenter');
          expect(error.details.operation).toBe('packaging');
          expect(error.details.allowedOperations).toEqual(['fermentation', 'storage']);
        }
      }
    });
  });

  describe('validateVesselState', () => {
    it('should pass for valid vessel state without changes', () => {
      expect(() => validateVesselState(mockVessel)).not.toThrow();
    });

    it('should validate status transitions', () => {
      expect(() => validateVesselState(mockVessel, 'in_use')).not.toThrow();
      expect(() => validateVesselState(mockVessel, 'available')).toThrow(VesselStateValidationError);
    });

    it('should validate operations', () => {
      expect(() => validateVesselState(mockVessel, undefined, 'transfer_in')).not.toThrow();

      const maintenanceVessel = { ...mockVessel, status: 'maintenance' as VesselStatus };
      expect(() => validateVesselState(maintenanceVessel, undefined, 'transfer_in')).toThrow(VesselStateValidationError);
    });

    it('should validate both transition and operation', () => {
      expect(() => validateVesselState(mockVessel, 'in_use', 'transfer_in')).not.toThrow();
    });

    it('should validate with context', () => {
      const vessel = { ...mockVessel, currentVolumeL: 500 };
      expect(() => validateVesselState(vessel, 'cleaning', undefined, { reason: 'Daily cleaning' })).toThrow(VesselStateValidationError);
    });
  });

  describe('vesselStateValidationSchema', () => {
    const validVesselData = {
      id: 'vessel-1',
      name: 'Fermenter 1',
      status: 'available' as VesselStatus,
      currentVolumeL: 500,
      capacityL: 1000,
      type: 'fermenter' as const
    };

    it('should validate correct vessel data', () => {
      const result = vesselStateValidationSchema.parse(validVesselData);
      expect(result).toEqual(validVesselData);
    });

    it('should validate without currentVolumeL', () => {
      const { currentVolumeL, ...vesselData } = validVesselData;
      const result = vesselStateValidationSchema.parse(vesselData);
      expect(result.currentVolumeL).toBeUndefined();
    });

    it('should reject invalid UUID format', () => {
      const invalidData = { ...validVesselData, id: 'invalid-uuid' };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty vessel name', () => {
      const invalidData = { ...validVesselData, name: '' };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid status', () => {
      // @ts-expect-error - Testing invalid status
      const invalidData = { ...validVesselData, status: 'invalid' };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative current volume', () => {
      const invalidData = { ...validVesselData, currentVolumeL: -100 };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative or zero capacity', () => {
      const invalidData = { ...validVesselData, capacityL: -100 };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();

      const zeroCapacityData = { ...validVesselData, capacityL: 0 };
      expect(() => vesselStateValidationSchema.parse(zeroCapacityData)).toThrow();
    });

    it('should reject invalid vessel type', () => {
      // @ts-expect-error - Testing invalid type
      const invalidData = { ...validVesselData, type: 'invalid' };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();
    });

    it('should reject current volume exceeding capacity', () => {
      const invalidData = { ...validVesselData, currentVolumeL: 1500, capacityL: 1000 };
      expect(() => vesselStateValidationSchema.parse(invalidData)).toThrow();
    });
  });

  describe('stateTransitionSchema', () => {
    const validTransitionData = {
      fromStatus: 'available' as VesselStatus,
      toStatus: 'in_use' as VesselStatus,
      reason: 'Starting new batch',
      notes: 'Transition notes'
    };

    it('should validate correct transition data', () => {
      const result = stateTransitionSchema.parse(validTransitionData);
      expect(result).toEqual(validTransitionData);
    });

    it('should validate without optional fields', () => {
      const { reason, notes, ...transitionData } = validTransitionData;
      const result = stateTransitionSchema.parse(transitionData);
      expect(result.reason).toBeUndefined();
      expect(result.notes).toBeUndefined();
    });

    it('should reject invalid status values', () => {
      // @ts-expect-error - Testing invalid status
      const invalidData = { ...validTransitionData, fromStatus: 'invalid' };
      expect(() => stateTransitionSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long reason', () => {
      const invalidData = { ...validTransitionData, reason: 'a'.repeat(501) };
      expect(() => stateTransitionSchema.parse(invalidData)).toThrow();
    });

    it('should reject overly long notes', () => {
      const invalidData = { ...validTransitionData, notes: 'a'.repeat(1001) };
      expect(() => stateTransitionSchema.parse(invalidData)).toThrow();
    });
  });
});