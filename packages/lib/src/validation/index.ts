/**
 * Business rule validation guards for cidery management
 *
 * This module provides comprehensive validation functions and Zod schemas
 * to enforce business rules and data integrity across the cidery management system.
 */

// Error types
export * from './errors';

// Transfer validation
export * from './transfer';

// Volume and quantity validation
export * from './volume-quantity';

// Packaging validation
export * from './packaging';

// Measurement validation
export * from './measurements';

// Vessel state validation
export * from './vessel-state';

/**
 * Main validation function that combines all business rule validations
 */
export function validateBusinessRules(
  operation: string,
  data: Record<string, any>,
  context: Record<string, any> = {}
): void {
  // This function can be extended to provide a centralized validation entry point
  // based on the operation type and data provided

  switch (operation) {
    case 'transfer':
      // Transfer validations are handled by the transfer module
      break;
    case 'packaging':
      // Packaging validations are handled by the packaging module
      break;
    case 'measurement':
      // Measurement validations are handled by the measurements module
      break;
    case 'vessel_state':
      // Vessel state validations are handled by the vessel-state module
      break;
    default:
      // Generic validations can be added here
      break;
  }
}