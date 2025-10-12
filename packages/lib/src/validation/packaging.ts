/**
 * Packaging validation guards ensuring consumption doesn't exceed available volume
 */

import { z } from "zod";
import { PackagingValidationError } from "./errors";
import {
  validatePositiveVolume,
  validatePositiveCount,
} from "./volume-quantity";

export interface BatchPackagingData {
  id: string;
  batchNumber: string;
  currentVolumeL: number;
  status: "fermentation" | "aging" | "conditioning" | "completed" | "discarded";
  vesselId?: string;
}

export interface PackagingRunData {
  batchId: string;
  packageDate: Date;
  volumePackagedL: number;
  bottleSize: string;
  bottleCount: number;
  abvAtPackaging?: number;
  notes?: string;
}

export interface ExistingPackagingData {
  totalVolumePackagedL: number;
  packagingRuns: Array<{
    id: string;
    volumePackagedL: number;
    packageDate: Date;
  }>;
}

/**
 * Validates that batch is ready for packaging
 */
export function validateBatchReadyForPackaging(
  batch: BatchPackagingData,
): void {
  if (batch.status === "discarded") {
    throw new PackagingValidationError(
      `Batch ${batch.batchNumber} is discarded`,
      `Batch "${batch.batchNumber}" is discarded and cannot be packaged.`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
      },
    );
  }

  if (batch.status !== "aging") {
    throw new PackagingValidationError(
      `Batch ${batch.batchNumber} is not ready for packaging`,
      `Batch "${batch.batchNumber}" must be in aging stage to be packaged. Current status: ${batch.status}`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
      },
    );
  }

  if (batch.currentVolumeL <= 0) {
    throw new PackagingValidationError(
      `Batch ${batch.batchNumber} has no volume available`,
      `Batch "${batch.batchNumber}" has no volume available for packaging (${batch.currentVolumeL}L). Please check the batch status.`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        currentVolumeL: batch.currentVolumeL,
      },
    );
  }
}

/**
 * Validates that packaging volume doesn't exceed available batch volume
 */
export function validatePackagingVolume(
  batch: BatchPackagingData,
  packagingData: PackagingRunData,
  existingPackaging?: ExistingPackagingData,
): void {
  // Validate positive packaging volume
  validatePositiveVolume(
    packagingData.volumePackagedL,
    "Packaging volume",
    `batch ${batch.batchNumber}`,
  );

  const totalPreviouslyPackaged = existingPackaging?.totalVolumePackagedL || 0;
  const remainingVolume = batch.currentVolumeL - totalPreviouslyPackaged;

  if (packagingData.volumePackagedL > remainingVolume) {
    throw new PackagingValidationError(
      `Packaging volume ${packagingData.volumePackagedL}L exceeds remaining batch volume ${remainingVolume}L`,
      `Cannot package ${packagingData.volumePackagedL}L from batch "${batch.batchNumber}". Only ${remainingVolume}L remains available (batch volume: ${batch.currentVolumeL}L, previously packaged: ${totalPreviouslyPackaged}L). Please reduce the packaging volume to ${remainingVolume}L or less.`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        batchVolumeL: batch.currentVolumeL,
        previouslyPackagedL: totalPreviouslyPackaged,
        remainingVolumeL: remainingVolume,
        requestedVolumeL: packagingData.volumePackagedL,
        excessVolumeL: packagingData.volumePackagedL - remainingVolume,
      },
    );
  }
}

/**
 * Validates bottle count and size consistency
 */
export function validateBottleConsistency(
  packagingData: PackagingRunData,
): void {
  validatePositiveCount(
    packagingData.bottleCount,
    "Bottle count",
    `packaging run`,
  );

  // Parse bottle size to extract volume
  const bottleSizeMatch = packagingData.bottleSize.match(/(\d+(?:\.\d+)?)/);
  if (!bottleSizeMatch) {
    throw new PackagingValidationError(
      `Invalid bottle size format: ${packagingData.bottleSize}`,
      `Bottle size "${packagingData.bottleSize}" is not in a valid format. Please use a format like "750ml", "500mL", "12oz", etc.`,
      { bottleSize: packagingData.bottleSize },
    );
  }

  const bottleVolume = parseFloat(bottleSizeMatch[1]);
  const isMetric =
    packagingData.bottleSize.toLowerCase().includes("ml") ||
    packagingData.bottleSize.toLowerCase().includes("l");

  // Convert to liters if needed
  let bottleVolumeL: number;
  if (isMetric) {
    bottleVolumeL = packagingData.bottleSize.toLowerCase().includes("ml")
      ? bottleVolume / 1000
      : bottleVolume;
  } else {
    // Assume fluid ounces, convert to liters
    bottleVolumeL = bottleVolume * 0.0295735;
  }

  const calculatedTotalVolume = bottleVolumeL * packagingData.bottleCount;
  const volumeDifference = Math.abs(
    calculatedTotalVolume - packagingData.volumePackagedL,
  );
  const tolerance = 0.05; // 50ml tolerance

  if (volumeDifference > tolerance) {
    throw new PackagingValidationError(
      `Volume mismatch: ${packagingData.bottleCount} × ${packagingData.bottleSize} ≠ ${packagingData.volumePackagedL}L`,
      `The bottle count and size don't match the packaging volume. ${packagingData.bottleCount} bottles of ${packagingData.bottleSize} should equal approximately ${calculatedTotalVolume.toFixed(2)}L, but ${packagingData.volumePackagedL}L was specified. Please verify your calculations.`,
      {
        bottleCount: packagingData.bottleCount,
        bottleSize: packagingData.bottleSize,
        bottleVolumeL,
        calculatedTotalVolumeL: calculatedTotalVolume,
        specifiedVolumeL: packagingData.volumePackagedL,
        volumeDifferenceL: volumeDifference,
        toleranceL: tolerance,
      },
    );
  }
}

/**
 * Validates ABV at packaging is within reasonable range
 */
export function validatePackagingAbv(abv: number | undefined): void {
  if (abv !== undefined) {
    if (abv < 0) {
      throw new PackagingValidationError(
        `ABV cannot be negative: ${abv}%`,
        `ABV at packaging cannot be negative. Please enter a value between 0% and 20%.`,
        { abv },
      );
    }

    if (abv > 20) {
      throw new PackagingValidationError(
        `ABV exceeds maximum: ${abv}%`,
        `ABV at packaging of ${abv}% exceeds the maximum allowed for cider (20%). Please verify your measurement.`,
        { abv, maxAllowed: 20 },
      );
    }

    if (!Number.isFinite(abv)) {
      throw new PackagingValidationError(
        `ABV must be a valid number: ${abv}`,
        `ABV at packaging must be a valid number. Please check your input.`,
        { abv },
      );
    }
  }
}

/**
 * Validates packaging date is not in the future
 */
export function validatePackagingDate(packageDate: Date): void {
  if (packageDate > new Date()) {
    throw new PackagingValidationError(
      `Packaging date cannot be in the future: ${packageDate.toISOString()}`,
      `Packaging date cannot be in the future. Please select today's date or an earlier date.`,
      {
        packageDate: packageDate.toISOString(),
        currentDate: new Date().toISOString(),
      },
    );
  }
}

/**
 * Comprehensive packaging validation function
 */
export function validatePackaging(
  batch: BatchPackagingData,
  packagingData: PackagingRunData,
  existingPackaging?: ExistingPackagingData,
): void {
  // Validate batch is ready for packaging
  validateBatchReadyForPackaging(batch);

  // Validate packaging date
  validatePackagingDate(packagingData.packageDate);

  // Validate packaging volume doesn't exceed available volume
  validatePackagingVolume(batch, packagingData, existingPackaging);

  // Validate bottle count and size consistency
  validateBottleConsistency(packagingData);

  // Validate ABV if provided
  validatePackagingAbv(packagingData.abvAtPackaging);
}

/**
 * Enhanced Zod schema for packaging validation with business rules
 */
export const packagingValidationSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID format"),
  packageDate: z
    .date()
    .refine(
      (date) => date <= new Date(),
      "Packaging date cannot be in the future",
    ),
  volumePackagedL: z
    .number()
    .positive("Packaging volume must be greater than 0L")
    .max(50000, "Packaging volume cannot exceed 50,000L")
    .refine(
      (val) => Number.isFinite(val),
      "Packaging volume must be a valid number",
    ),
  bottleSize: z
    .string()
    .min(1, "Bottle size is required")
    .max(20, "Bottle size description too long")
    .regex(/\d+(?:\.\d+)?/, "Bottle size must contain a numeric value"),
  bottleCount: z
    .number()
    .int("Bottle count must be a whole number")
    .positive("Bottle count must be greater than 0")
    .max(1000000, "Bottle count seems unusually large"),
  abvAtPackaging: z
    .number()
    .min(0, "ABV cannot be negative")
    .max(20, "ABV cannot exceed 20% for cider")
    .refine((val) => Number.isFinite(val), "ABV must be a valid number")
    .optional(),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
});

export type ValidatedPackagingData = z.infer<typeof packagingValidationSchema>;
