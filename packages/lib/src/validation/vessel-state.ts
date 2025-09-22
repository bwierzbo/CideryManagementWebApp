/**
 * Vessel state transition validation guards
 */

import { z } from 'zod';
import { VesselStateValidationError } from './errors';

export type VesselStatus = 'available' | 'in_use' | 'cleaning' | 'maintenance';

export interface VesselStateData {
  id: string;
  name: string;
  status: VesselStatus;
  currentVolumeL?: number;
  capacityL: number;
  type: 'fermenter' | 'conditioning_tank' | 'bright_tank' | 'storage';
}

export interface StateTransition {
  fromStatus: VesselStatus;
  toStatus: VesselStatus;
  reason?: string;
  notes?: string;
}

/**
 * Valid state transitions for vessels
 */
const VALID_TRANSITIONS: Record<VesselStatus, VesselStatus[]> = {
  available: ['in_use', 'cleaning', 'maintenance'],
  in_use: ['available', 'cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning']
};

/**
 * Validates that a vessel state transition is allowed
 */
export function validateStateTransition(
  vessel: VesselStateData,
  newStatus: VesselStatus,
  reason?: string
): void {
  const currentStatus = vessel.status;

  if (currentStatus === newStatus) {
    throw new VesselStateValidationError(
      `Vessel ${vessel.name} is already in ${newStatus} status`,
      `Vessel "${vessel.name}" is already in "${newStatus}" status. No change needed.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        currentStatus,
        newStatus
      }
    );
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    throw new VesselStateValidationError(
      `Invalid state transition from ${currentStatus} to ${newStatus}`,
      `Cannot change vessel "${vessel.name}" from "${currentStatus}" to "${newStatus}". Valid transitions from "${currentStatus}" are: ${allowedTransitions.join(', ')}.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        currentStatus,
        newStatus,
        allowedTransitions
      }
    );
  }
}

/**
 * Validates specific transition rules based on vessel content
 */
export function validateTransitionWithContent(
  vessel: VesselStateData,
  newStatus: VesselStatus,
  hasBatches: boolean = false
): void {
  const currentVolumeL = vessel.currentVolumeL || 0;

  // Cannot set to cleaning if vessel has content
  if (newStatus === 'cleaning' && currentVolumeL > 0) {
    throw new VesselStateValidationError(
      `Cannot clean vessel with ${currentVolumeL}L content`,
      `Cannot set vessel "${vessel.name}" to cleaning status - it contains ${currentVolumeL}L of product. Please empty the vessel first or transfer the contents to another vessel.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        currentStatus: vessel.status,
        newStatus,
        currentVolumeL
      }
    );
  }

  // Cannot set to maintenance if vessel has content
  if (newStatus === 'maintenance' && currentVolumeL > 0) {
    throw new VesselStateValidationError(
      `Cannot perform maintenance on vessel with ${currentVolumeL}L content`,
      `Cannot set vessel "${vessel.name}" to maintenance status - it contains ${currentVolumeL}L of product. Please empty the vessel first or transfer the contents to another vessel.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        currentStatus: vessel.status,
        newStatus,
        currentVolumeL
      }
    );
  }

  // Cannot set to available if vessel is actively being used for batches
  if (newStatus === 'available' && vessel.status === 'in_use' && hasBatches) {
    throw new VesselStateValidationError(
      `Cannot set vessel to available while batches are active`,
      `Cannot set vessel "${vessel.name}" to available status - it has active batches. Please complete or transfer the batches first.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        currentStatus: vessel.status,
        newStatus,
        hasBatches
      }
    );
  }
}

/**
 * Validates vessel can be used for a specific operation
 */
export function validateVesselUsability(
  vessel: VesselStateData,
  operation: 'transfer_in' | 'transfer_out' | 'measurement' | 'packaging' | 'cleaning' | 'maintenance'
): void {
  switch (operation) {
    case 'transfer_in':
      if (vessel.status === 'maintenance') {
        throw new VesselStateValidationError(
          `Cannot transfer into vessel under maintenance`,
          `Cannot transfer product into vessel "${vessel.name}" - it's currently under maintenance. Please select a different vessel.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      if (vessel.status === 'cleaning') {
        throw new VesselStateValidationError(
          `Cannot transfer into vessel being cleaned`,
          `Cannot transfer product into vessel "${vessel.name}" - it's currently being cleaned. Please wait for cleaning to complete or select another vessel.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      break;

    case 'transfer_out':
      if (vessel.status === 'maintenance') {
        throw new VesselStateValidationError(
          `Cannot transfer from vessel under maintenance`,
          `Cannot transfer product from vessel "${vessel.name}" - it's currently under maintenance.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      break;

    case 'measurement':
      if (vessel.status === 'maintenance') {
        throw new VesselStateValidationError(
          `Cannot take measurements from vessel under maintenance`,
          `Cannot take measurements from vessel "${vessel.name}" - it's currently under maintenance.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      if (vessel.status === 'cleaning') {
        throw new VesselStateValidationError(
          `Cannot take measurements from vessel being cleaned`,
          `Cannot take measurements from vessel "${vessel.name}" - it's currently being cleaned.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      break;

    case 'packaging':
      if (vessel.status === 'maintenance') {
        throw new VesselStateValidationError(
          `Cannot package from vessel under maintenance`,
          `Cannot package product from vessel "${vessel.name}" - it's currently under maintenance.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      if (vessel.status === 'cleaning') {
        throw new VesselStateValidationError(
          `Cannot package from vessel being cleaned`,
          `Cannot package product from vessel "${vessel.name}" - it's currently being cleaned.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      break;

    case 'cleaning':
      if (vessel.status === 'maintenance') {
        throw new VesselStateValidationError(
          `Cannot clean vessel under maintenance`,
          `Cannot start cleaning vessel "${vessel.name}" - it's currently under maintenance. Complete maintenance first.`,
          { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
        );
      }
      break;

    case 'maintenance':
      // Maintenance can be performed from any state with proper authorization
      break;

    default:
      throw new VesselStateValidationError(
        `Unknown operation: ${operation}`,
        `Unknown vessel operation requested: ${operation}`,
        { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status, operation }
      );
  }
}

/**
 * Validates vessel type is appropriate for operation
 */
export function validateVesselTypeForOperation(
  vessel: VesselStateData,
  operation: 'fermentation' | 'conditioning' | 'packaging' | 'storage'
): void {
  const typeOperationMap: Record<typeof vessel.type, string[]> = {
    fermenter: ['fermentation', 'storage'],
    conditioning_tank: ['conditioning', 'storage'],
    bright_tank: ['packaging', 'storage'],
    storage: ['storage']
  };

  const allowedOperations = typeOperationMap[vessel.type];
  if (!allowedOperations.includes(operation)) {
    throw new VesselStateValidationError(
      `Vessel type ${vessel.type} not suitable for ${operation}`,
      `Vessel "${vessel.name}" is a ${vessel.type.replace('_', ' ')} and is not typically used for ${operation}. Consider using a more appropriate vessel type for optimal results.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        vesselType: vessel.type,
        operation,
        allowedOperations
      }
    );
  }
}

/**
 * Comprehensive vessel state validation function
 */
export function validateVesselState(
  vessel: VesselStateData,
  newStatus?: VesselStatus,
  operation?: 'transfer_in' | 'transfer_out' | 'measurement' | 'packaging' | 'cleaning' | 'maintenance',
  context: { hasBatches?: boolean; reason?: string } = {}
): void {
  // If changing status, validate the transition
  if (newStatus && newStatus !== vessel.status) {
    validateStateTransition(vessel, newStatus, context.reason);
    validateTransitionWithContent(vessel, newStatus, context.hasBatches);
  }

  // If performing an operation, validate vessel usability
  if (operation) {
    validateVesselUsability(vessel, operation);
  }
}

/**
 * Enhanced Zod schema for vessel state validation
 */
export const vesselStateValidationSchema = z.object({
  id: z.string().uuid('Invalid vessel ID format'),
  name: z.string().min(1, 'Vessel name is required'),
  status: z.enum(['available', 'in_use', 'cleaning', 'maintenance'] as const)
    .describe('Status must be one of: available, in_use, cleaning, maintenance'),
  currentVolumeL: z.number()
    .nonnegative('Current volume cannot be negative')
    .optional(),
  capacityL: z.number()
    .positive('Capacity must be greater than 0L'),
  type: z.enum(['fermenter', 'conditioning_tank', 'bright_tank', 'storage'] as const)
    .describe('Type must be one of: fermenter, conditioning_tank, bright_tank, storage')
}).refine((data) => {
  // Ensure current volume doesn't exceed capacity
  if (data.currentVolumeL && data.currentVolumeL > data.capacityL) {
    throw new Error(`Current volume (${data.currentVolumeL}L) cannot exceed capacity (${data.capacityL}L)`);
  }
  return true;
}, {
  message: 'Current volume cannot exceed vessel capacity',
  path: ['currentVolumeL']
});

export const stateTransitionSchema = z.object({
  fromStatus: z.enum(['available', 'in_use', 'cleaning', 'maintenance']),
  toStatus: z.enum(['available', 'in_use', 'cleaning', 'maintenance']),
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional()
});

export type ValidatedVesselStateData = z.infer<typeof vesselStateValidationSchema>;
export type ValidatedStateTransition = z.infer<typeof stateTransitionSchema>;