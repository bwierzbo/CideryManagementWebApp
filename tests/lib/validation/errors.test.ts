/**
 * Tests for validation error types
 */

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  TransferValidationError,
  VolumeValidationError,
  QuantityValidationError,
  PackagingValidationError,
  MeasurementValidationError,
  VesselStateValidationError,
  PermissionValidationError,
  createValidationError,
  isValidationError,
  extractUserMessage
} from './packages/lib/src/validation/errors';

describe('Validation Errors', () => {
  describe('ValidationError', () => {
    it('should create a validation error with correct properties', () => {
      const error = new ValidationError(
        'TEST_ERROR',
        'Technical message',
        'User friendly message',
        { field: 'value' }
      );

      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Technical message');
      expect(error.userMessage).toBe('User friendly message');
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should be an instance of Error', () => {
      const error = new ValidationError('TEST', 'message', 'user message');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Specific Error Types', () => {
    it('should create TransferValidationError with correct code', () => {
      const error = new TransferValidationError('message', 'user message');
      expect(error.name).toBe('TransferValidationError');
      expect(error.code).toBe('TRANSFER_VALIDATION_ERROR');
    });

    it('should create VolumeValidationError with correct code', () => {
      const error = new VolumeValidationError('message', 'user message');
      expect(error.name).toBe('VolumeValidationError');
      expect(error.code).toBe('VOLUME_VALIDATION_ERROR');
    });

    it('should create QuantityValidationError with correct code', () => {
      const error = new QuantityValidationError('message', 'user message');
      expect(error.name).toBe('QuantityValidationError');
      expect(error.code).toBe('QUANTITY_VALIDATION_ERROR');
    });

    it('should create PackagingValidationError with correct code', () => {
      const error = new PackagingValidationError('message', 'user message');
      expect(error.name).toBe('PackagingValidationError');
      expect(error.code).toBe('PACKAGING_VALIDATION_ERROR');
    });

    it('should create MeasurementValidationError with correct code', () => {
      const error = new MeasurementValidationError('message', 'user message');
      expect(error.name).toBe('MeasurementValidationError');
      expect(error.code).toBe('MEASUREMENT_VALIDATION_ERROR');
    });

    it('should create VesselStateValidationError with correct code', () => {
      const error = new VesselStateValidationError('message', 'user message');
      expect(error.name).toBe('VesselStateValidationError');
      expect(error.code).toBe('VESSEL_STATE_VALIDATION_ERROR');
    });

    it('should create PermissionValidationError with correct code', () => {
      const error = new PermissionValidationError('message', 'user message');
      expect(error.name).toBe('PermissionValidationError');
      expect(error.code).toBe('PERMISSION_VALIDATION_ERROR');
    });
  });

  describe('createValidationError', () => {
    it('should create transfer validation error', () => {
      const error = createValidationError('transfer', 'message', 'user message');
      expect(error).toBeInstanceOf(TransferValidationError);
    });

    it('should create volume validation error', () => {
      const error = createValidationError('volume', 'message', 'user message');
      expect(error).toBeInstanceOf(VolumeValidationError);
    });

    it('should create quantity validation error', () => {
      const error = createValidationError('quantity', 'message', 'user message');
      expect(error).toBeInstanceOf(QuantityValidationError);
    });

    it('should create packaging validation error', () => {
      const error = createValidationError('packaging', 'message', 'user message');
      expect(error).toBeInstanceOf(PackagingValidationError);
    });

    it('should create measurement validation error', () => {
      const error = createValidationError('measurement', 'message', 'user message');
      expect(error).toBeInstanceOf(MeasurementValidationError);
    });

    it('should create vessel state validation error', () => {
      const error = createValidationError('vessel_state', 'message', 'user message');
      expect(error).toBeInstanceOf(VesselStateValidationError);
    });

    it('should create permission validation error', () => {
      const error = createValidationError('permission', 'message', 'user message');
      expect(error).toBeInstanceOf(PermissionValidationError);
    });

    it('should create generic validation error for unknown type', () => {
      // @ts-expect-error - Testing invalid type
      const error = createValidationError('unknown', 'message', 'user message');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should include details in created error', () => {
      const details = { field: 'test', value: 123 };
      const error = createValidationError('transfer', 'message', 'user message', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('isValidationError', () => {
    it('should return true for ValidationError instances', () => {
      const error = new ValidationError('TEST', 'message', 'user message');
      expect(isValidationError(error)).toBe(true);
    });

    it('should return true for specific validation error types', () => {
      const transferError = new TransferValidationError('message', 'user message');
      const volumeError = new VolumeValidationError('message', 'user message');

      expect(isValidationError(transferError)).toBe(true);
      expect(isValidationError(volumeError)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('regular error');
      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isValidationError('string')).toBe(false);
      expect(isValidationError(123)).toBe(false);
      expect(isValidationError(null)).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
      expect(isValidationError({})).toBe(false);
    });
  });

  describe('extractUserMessage', () => {
    it('should extract user message from validation errors', () => {
      const error = new ValidationError('TEST', 'technical', 'user friendly');
      expect(extractUserMessage(error)).toBe('user friendly');
    });

    it('should extract user message from specific validation error types', () => {
      const error = new TransferValidationError('technical', 'user friendly');
      expect(extractUserMessage(error)).toBe('user friendly');
    });

    it('should return error message for regular Error instances', () => {
      const error = new Error('regular error message');
      expect(extractUserMessage(error)).toBe('regular error message');
    });

    it('should return default message for non-error values', () => {
      expect(extractUserMessage('string')).toBe('An unexpected error occurred');
      expect(extractUserMessage(123)).toBe('An unexpected error occurred');
      expect(extractUserMessage(null)).toBe('An unexpected error occurred');
      expect(extractUserMessage(undefined)).toBe('An unexpected error occurred');
      expect(extractUserMessage({})).toBe('An unexpected error occurred');
    });
  });
});