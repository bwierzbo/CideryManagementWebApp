/**
 * Measurement range validation for ABV, pH, specific gravity, and other parameters
 */

import { z } from 'zod';
import { MeasurementValidationError } from './errors';

export interface MeasurementData {
  batchId: string;
  measurementDate: Date;
  specificGravity?: number;
  abv?: number;
  ph?: number;
  totalAcidity?: number;
  temperature?: number;
  volumeL?: number;
  notes?: string;
  takenBy?: string;
}

/**
 * Validates ABV (Alcohol By Volume) is within cider range
 */
export function validateAbv(abv: number | undefined): void {
  if (abv === undefined) return;

  if (!Number.isFinite(abv)) {
    throw new MeasurementValidationError(
      `ABV must be a valid number: ${abv}`,
      'ABV must be a valid number. Please check your input.',
      { abv, measurementType: 'abv' }
    );
  }

  if (abv < 0) {
    throw new MeasurementValidationError(
      `ABV cannot be negative: ${abv}%`,
      'ABV cannot be negative. Please enter a value between 0% and 20%.',
      { abv, minAllowed: 0, maxAllowed: 20, measurementType: 'abv' }
    );
  }

  if (abv > 20) {
    throw new MeasurementValidationError(
      `ABV exceeds maximum for cider: ${abv}%`,
      `ABV of ${abv}% exceeds the typical maximum for cider (20%). Please verify your measurement. If this reading is correct, this may indicate a measurement error or incomplete fermentation.`,
      { abv, minAllowed: 0, maxAllowed: 20, measurementType: 'abv' }
    );
  }

  // Warn about unusually high ABV for cider
  if (abv > 12) {
    // This is not an error, but could be flagged as unusual
    console.warn(`High ABV detected: ${abv}% is unusually high for cider (typical range: 4-8%)`);
  }
}

/**
 * Validates pH is within acceptable range for cider
 */
export function validatePh(ph: number | undefined): void {
  if (ph === undefined) return;

  if (!Number.isFinite(ph)) {
    throw new MeasurementValidationError(
      `pH must be a valid number: ${ph}`,
      'pH must be a valid number. Please check your input.',
      { ph, measurementType: 'ph' }
    );
  }

  if (ph < 2.5) {
    throw new MeasurementValidationError(
      `pH too low for cider: ${ph}`,
      `pH of ${ph} is dangerously low for cider. Normal range is 2.5-4.5. Please verify your measurement as this may indicate contamination or measurement error.`,
      { ph, minAllowed: 2.5, maxAllowed: 4.5, measurementType: 'ph' }
    );
  }

  if (ph > 4.5) {
    throw new MeasurementValidationError(
      `pH too high for cider: ${ph}`,
      `pH of ${ph} is too high for safe cider production. Normal range is 2.5-4.5. This may indicate bacterial contamination or incomplete fermentation. Please verify your measurement.`,
      { ph, minAllowed: 2.5, maxAllowed: 4.5, measurementType: 'ph' }
    );
  }

  // Extended validation for reasonable pH range
  if (ph < 0 || ph > 14) {
    throw new MeasurementValidationError(
      `pH outside possible range: ${ph}`,
      `pH of ${ph} is outside the possible range (0-14). Please check your measurement equipment and procedure.`,
      { ph, minPossible: 0, maxPossible: 14, measurementType: 'ph' }
    );
  }
}

/**
 * Validates specific gravity is within reasonable range
 */
export function validateSpecificGravity(sg: number | undefined): void {
  if (sg === undefined) return;

  if (!Number.isFinite(sg)) {
    throw new MeasurementValidationError(
      `Specific gravity must be a valid number: ${sg}`,
      'Specific gravity must be a valid number. Please check your input.',
      { specificGravity: sg, measurementType: 'specificGravity' }
    );
  }

  if (sg < 1.000) {
    throw new MeasurementValidationError(
      `Specific gravity too low: ${sg}`,
      `Specific gravity of ${sg} is below 1.000, which is physically impossible for cider. Normal range is 1.000-1.200. Please verify your measurement.`,
      { specificGravity: sg, minAllowed: 1.000, maxAllowed: 1.200, measurementType: 'specificGravity' }
    );
  }

  if (sg > 1.200) {
    throw new MeasurementValidationError(
      `Specific gravity too high: ${sg}`,
      `Specific gravity of ${sg} is unusually high for cider. Normal range is 1.000-1.200. Please verify your measurement - this may indicate very high sugar content or measurement error.`,
      { specificGravity: sg, minAllowed: 1.000, maxAllowed: 1.200, measurementType: 'specificGravity' }
    );
  }

  // Reasonable bounds for cider production
  if (sg < 0.980 || sg > 1.300) {
    throw new MeasurementValidationError(
      `Specific gravity outside reasonable bounds: ${sg}`,
      `Specific gravity of ${sg} is outside reasonable bounds for any beverage production. Please check your measurement equipment and procedure.`,
      { specificGravity: sg, minReasonable: 0.980, maxReasonable: 1.300, measurementType: 'specificGravity' }
    );
  }
}

/**
 * Validates total acidity is within acceptable range
 */
export function validateTotalAcidity(acidity: number | undefined): void {
  if (acidity === undefined) return;

  if (!Number.isFinite(acidity)) {
    throw new MeasurementValidationError(
      `Total acidity must be a valid number: ${acidity}`,
      'Total acidity must be a valid number. Please check your input.',
      { totalAcidity: acidity, measurementType: 'totalAcidity' }
    );
  }

  if (acidity < 0) {
    throw new MeasurementValidationError(
      `Total acidity cannot be negative: ${acidity}`,
      'Total acidity cannot be negative. Please enter a positive value.',
      { totalAcidity: acidity, measurementType: 'totalAcidity' }
    );
  }

  if (acidity > 5.0) {
    throw new MeasurementValidationError(
      `Total acidity too high: ${acidity}g/L`,
      `Total acidity of ${acidity}g/L is unusually high for cider. Normal range is 0-5g/L. Please verify your measurement as this may indicate excessive acid addition or measurement error.`,
      { totalAcidity: acidity, maxAllowed: 5.0, measurementType: 'totalAcidity' }
    );
  }

  // Extended upper bound for safety
  if (acidity > 20) {
    throw new MeasurementValidationError(
      `Total acidity dangerously high: ${acidity}g/L`,
      `Total acidity of ${acidity}g/L is dangerously high. This level could indicate a serious issue. Please verify your measurement immediately.`,
      { totalAcidity: acidity, dangerousLevel: 20, measurementType: 'totalAcidity' }
    );
  }
}

/**
 * Validates temperature is within reasonable range
 */
export function validateTemperature(temp: number | undefined): void {
  if (temp === undefined) return;

  if (!Number.isFinite(temp)) {
    throw new MeasurementValidationError(
      `Temperature must be a valid number: ${temp}`,
      'Temperature must be a valid number. Please check your input.',
      { temperature: temp, measurementType: 'temperature' }
    );
  }

  if (temp < -10) {
    throw new MeasurementValidationError(
      `Temperature too low: ${temp}°C`,
      `Temperature of ${temp}°C is too low for cider storage or production. Please verify your measurement.`,
      { temperature: temp, minAllowed: -10, maxAllowed: 50, measurementType: 'temperature' }
    );
  }

  if (temp > 50) {
    throw new MeasurementValidationError(
      `Temperature too high: ${temp}°C`,
      `Temperature of ${temp}°C is too high for cider - this could damage the product or indicate equipment malfunction. Normal range is -10°C to 50°C.`,
      { temperature: temp, minAllowed: -10, maxAllowed: 50, measurementType: 'temperature' }
    );
  }

  // Extended bounds for safety
  if (temp < -50 || temp > 100) {
    throw new MeasurementValidationError(
      `Temperature outside reasonable bounds: ${temp}°C`,
      `Temperature of ${temp}°C is outside reasonable bounds. Please check your measurement equipment.`,
      { temperature: temp, minReasonable: -50, maxReasonable: 100, measurementType: 'temperature' }
    );
  }
}

/**
 * Validates measurement date is not in the future
 */
export function validateMeasurementDate(measurementDate: Date): void {
  if (measurementDate > new Date()) {
    throw new MeasurementValidationError(
      `Measurement date cannot be in the future: ${measurementDate.toISOString()}`,
      'Measurement date cannot be in the future. Please select today\'s date or an earlier date.',
      {
        measurementDate: measurementDate.toISOString(),
        currentDate: new Date().toISOString(),
        measurementType: 'date'
      }
    );
  }
}

/**
 * Validates volume measurement if provided
 */
export function validateMeasurementVolume(volumeL: number | undefined): void {
  if (volumeL === undefined) return;

  if (!Number.isFinite(volumeL)) {
    throw new MeasurementValidationError(
      `Volume must be a valid number: ${volumeL}`,
      'Volume must be a valid number. Please check your input.',
      { volumeL, measurementType: 'volume' }
    );
  }

  if (volumeL < 0) {
    throw new MeasurementValidationError(
      `Volume cannot be negative: ${volumeL}L`,
      'Volume cannot be negative. Please enter a positive value.',
      { volumeL, measurementType: 'volume' }
    );
  }

  if (volumeL > 50000) {
    throw new MeasurementValidationError(
      `Volume unusually large: ${volumeL}L`,
      `Volume of ${volumeL}L seems unusually large for a single measurement. Please verify your input.`,
      { volumeL, maxReasonable: 50000, measurementType: 'volume' }
    );
  }
}

/**
 * Comprehensive measurement validation function
 */
export function validateMeasurement(measurementData: MeasurementData): void {
  // Validate measurement date
  validateMeasurementDate(measurementData.measurementDate);

  // Validate individual measurements
  validateAbv(measurementData.abv);
  validatePh(measurementData.ph);
  validateSpecificGravity(measurementData.specificGravity);
  validateTotalAcidity(measurementData.totalAcidity);
  validateTemperature(measurementData.temperature);
  validateMeasurementVolume(measurementData.volumeL);
}

/**
 * Enhanced Zod schema for measurement validation with business rules
 */
export const measurementValidationSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID format'),
  measurementDate: z.date()
    .refine((date) => date <= new Date(), 'Measurement date cannot be in the future'),
  specificGravity: z.number()
    .min(1.000, 'Specific gravity must be at least 1.000')
    .max(1.200, 'Specific gravity cannot exceed 1.200 for cider')
    .refine((val) => Number.isFinite(val), 'Specific gravity must be a valid number')
    .optional(),
  abv: z.number()
    .min(0, 'ABV cannot be negative')
    .max(20, 'ABV cannot exceed 20% for cider')
    .refine((val) => Number.isFinite(val), 'ABV must be a valid number')
    .optional(),
  ph: z.number()
    .min(2.5, 'pH must be at least 2.5 for safe cider production')
    .max(4.5, 'pH cannot exceed 4.5 for safe cider production')
    .refine((val) => Number.isFinite(val), 'pH must be a valid number')
    .optional(),
  totalAcidity: z.number()
    .min(0, 'Total acidity cannot be negative')
    .max(5, 'Total acidity cannot exceed 5g/L')
    .refine((val) => Number.isFinite(val), 'Total acidity must be a valid number')
    .optional(),
  temperature: z.number()
    .min(-10, 'Temperature must be at least -10°C')
    .max(50, 'Temperature cannot exceed 50°C')
    .refine((val) => Number.isFinite(val), 'Temperature must be a valid number')
    .optional(),
  volumeL: z.number()
    .nonnegative('Volume cannot be negative')
    .max(50000, 'Volume cannot exceed 50,000L')
    .refine((val) => Number.isFinite(val), 'Volume must be a valid number')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional(),
  takenBy: z.string()
    .max(100, 'Name cannot exceed 100 characters')
    .optional()
});

export type ValidatedMeasurementData = z.infer<typeof measurementValidationSchema>;