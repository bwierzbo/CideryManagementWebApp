/**
 * Volume and quantity validation guards to prevent negative or invalid values
 */

import { z } from 'zod';
import { VolumeValidationError, QuantityValidationError } from './errors';

/**
 * Validates that volume is positive and within reasonable bounds
 */
export function validatePositiveVolume(
  volume: number,
  fieldName: string = 'Volume',
  context: string = ''
): void {
  if (volume < 0) {
    throw new VolumeValidationError(
      `${fieldName} cannot be negative: ${volume}`,
      `${fieldName} cannot be negative. Please enter a positive value${context ? ` for ${context}` : ''}.`,
      { fieldName, volume, context }
    );
  }

  if (volume === 0) {
    throw new VolumeValidationError(
      `${fieldName} cannot be zero: ${volume}`,
      `${fieldName} must be greater than 0L${context ? ` for ${context}` : ''}. Please enter a positive volume.`,
      { fieldName, volume, context }
    );
  }

  if (!Number.isFinite(volume)) {
    throw new VolumeValidationError(
      `${fieldName} must be a valid number: ${volume}`,
      `${fieldName} must be a valid number${context ? ` for ${context}` : ''}. Please check your input.`,
      { fieldName, volume, context }
    );
  }

  // Reasonable upper bound for cidery operations (50,000L)
  if (volume > 50000) {
    throw new VolumeValidationError(
      `${fieldName} exceeds maximum allowed: ${volume}L`,
      `${fieldName} of ${volume}L seems unusually large for cidery operations. Maximum allowed is 50,000L. Please verify your input.`,
      { fieldName, volume, maxAllowed: 50000, context }
    );
  }
}

/**
 * Validates that quantity is positive and within reasonable bounds
 */
export function validatePositiveQuantity(
  quantity: number,
  fieldName: string = 'Quantity',
  unit: string = '',
  context: string = ''
): void {
  if (quantity < 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be negative: ${quantity}`,
      `${fieldName} cannot be negative. Please enter a positive value${context ? ` for ${context}` : ''}.`,
      { fieldName, quantity, unit, context }
    );
  }

  if (quantity === 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be zero: ${quantity}`,
      `${fieldName} must be greater than 0${unit ? ` ${unit}` : ''}${context ? ` for ${context}` : ''}. Please enter a positive quantity.`,
      { fieldName, quantity, unit, context }
    );
  }

  if (!Number.isFinite(quantity)) {
    throw new QuantityValidationError(
      `${fieldName} must be a valid number: ${quantity}`,
      `${fieldName} must be a valid number${context ? ` for ${context}` : ''}. Please check your input.`,
      { fieldName, quantity, unit, context }
    );
  }

  // Unit-specific reasonable upper bounds
  const maxLimits: Record<string, number> = {
    'kg': 100000,  // 100 tons
    'lb': 220000,  // ~100 tons in pounds
    'L': 50000,    // 50,000 liters
    'gal': 13200   // ~50,000L in gallons
  };

  const maxAllowed = maxLimits[unit] || 1000000;
  if (quantity > maxAllowed) {
    throw new QuantityValidationError(
      `${fieldName} exceeds maximum allowed: ${quantity} ${unit}`,
      `${fieldName} of ${quantity}${unit ? ` ${unit}` : ''} seems unusually large. Maximum allowed is ${maxAllowed.toLocaleString()}${unit ? ` ${unit}` : ''}. Please verify your input.`,
      { fieldName, quantity, unit, maxAllowed, context }
    );
  }
}

/**
 * Validates that a count is a positive integer
 */
export function validatePositiveCount(
  count: number,
  fieldName: string = 'Count',
  context: string = ''
): void {
  if (!Number.isInteger(count)) {
    throw new QuantityValidationError(
      `${fieldName} must be a whole number: ${count}`,
      `${fieldName} must be a whole number${context ? ` for ${context}` : ''}. Please enter an integer value.`,
      { fieldName, count, context }
    );
  }

  if (count < 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be negative: ${count}`,
      `${fieldName} cannot be negative${context ? ` for ${context}` : ''}. Please enter a positive number.`,
      { fieldName, count, context }
    );
  }

  if (count === 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be zero: ${count}`,
      `${fieldName} must be greater than 0${context ? ` for ${context}` : ''}. Please enter a positive count.`,
      { fieldName, count, context }
    );
  }

  // Reasonable upper bound for bottle counts (1 million bottles)
  if (count > 1000000) {
    throw new QuantityValidationError(
      `${fieldName} exceeds maximum allowed: ${count}`,
      `${fieldName} of ${count.toLocaleString()} seems unusually large. Maximum allowed is 1,000,000. Please verify your input.`,
      { fieldName, count, maxAllowed: 1000000, context }
    );
  }
}

/**
 * Validates that price is positive and reasonable
 */
export function validatePositivePrice(
  price: number,
  fieldName: string = 'Price',
  currency: string = '',
  context: string = ''
): void {
  if (price < 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be negative: ${price}`,
      `${fieldName} cannot be negative${context ? ` for ${context}` : ''}. Please enter a positive value.`,
      { fieldName, price, currency, context }
    );
  }

  if (price === 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be zero: ${price}`,
      `${fieldName} must be greater than 0${currency ? ` ${currency}` : ''}${context ? ` for ${context}` : ''}. Please enter a positive price.`,
      { fieldName, price, currency, context }
    );
  }

  if (!Number.isFinite(price)) {
    throw new QuantityValidationError(
      `${fieldName} must be a valid number: ${price}`,
      `${fieldName} must be a valid number${context ? ` for ${context}` : ''}. Please check your input.`,
      { fieldName, price, currency, context }
    );
  }

  // Reasonable upper bound for prices (1 million)
  if (price > 1000000) {
    throw new QuantityValidationError(
      `${fieldName} exceeds maximum allowed: ${price}`,
      `${fieldName} of ${price.toLocaleString()}${currency ? ` ${currency}` : ''} seems unusually large. Maximum allowed is 1,000,000. Please verify your input.`,
      { fieldName, price, currency, maxAllowed: 1000000, context }
    );
  }
}

/**
 * Validates that a percentage is within valid range (0-100)
 */
export function validatePercentage(
  percentage: number,
  fieldName: string = 'Percentage',
  context: string = ''
): void {
  if (percentage < 0) {
    throw new QuantityValidationError(
      `${fieldName} cannot be negative: ${percentage}%`,
      `${fieldName} cannot be negative${context ? ` for ${context}` : ''}. Please enter a value between 0% and 100%.`,
      { fieldName, percentage, context }
    );
  }

  if (percentage > 100) {
    throw new QuantityValidationError(
      `${fieldName} cannot exceed 100%: ${percentage}%`,
      `${fieldName} cannot exceed 100%${context ? ` for ${context}` : ''}. Please enter a value between 0% and 100%.`,
      { fieldName, percentage, context }
    );
  }

  if (!Number.isFinite(percentage)) {
    throw new QuantityValidationError(
      `${fieldName} must be a valid number: ${percentage}`,
      `${fieldName} must be a valid number${context ? ` for ${context}` : ''}. Please check your input.`,
      { fieldName, percentage, context }
    );
  }
}

/**
 * Enhanced Zod schemas with positive validation
 */
export const positiveVolumeSchema = z.number()
  .positive('Volume must be greater than 0L')
  .max(50000, 'Volume cannot exceed 50,000L')
  .refine((val) => Number.isFinite(val), 'Volume must be a valid number');

export const positiveQuantitySchema = z.number()
  .positive('Quantity must be greater than 0')
  .max(1000000, 'Quantity seems unusually large')
  .refine((val) => Number.isFinite(val), 'Quantity must be a valid number');

export const positiveCountSchema = z.number()
  .int('Count must be a whole number')
  .positive('Count must be greater than 0')
  .max(1000000, 'Count seems unusually large');

export const positivePriceSchema = z.number()
  .positive('Price must be greater than 0')
  .max(1000000, 'Price seems unusually large')
  .refine((val) => Number.isFinite(val), 'Price must be a valid number');

export const percentageSchema = z.number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100%')
  .refine((val) => Number.isFinite(val), 'Percentage must be a valid number');

/**
 * Non-negative schemas for optional fields
 */
export const nonNegativeVolumeSchema = z.number()
  .nonnegative('Volume cannot be negative')
  .max(50000, 'Volume cannot exceed 50,000L')
  .refine((val) => Number.isFinite(val), 'Volume must be a valid number');

export const nonNegativeQuantitySchema = z.number()
  .nonnegative('Quantity cannot be negative')
  .max(1000000, 'Quantity seems unusually large')
  .refine((val) => Number.isFinite(val), 'Quantity must be a valid number');