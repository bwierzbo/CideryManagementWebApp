/**
 * Transfer validation guards for vessel capacity and state checks
 */

import { z } from "zod";
import { TransferValidationError, VesselStateValidationError } from "./errors";

export interface VesselData {
  id: string;
  name: string;
  capacityL: number;
  status: "available" | "in_use" | "cleaning" | "maintenance";
  currentVolumeL?: number;
}

export interface BatchData {
  id: string;
  batchNumber: string;
  currentVolumeL: number;
  status: "fermentation" | "aging" | "conditioning" | "completed" | "discarded";
  vesselId?: string;
}

export interface TransferData {
  batchId: string;
  fromVesselId?: string;
  toVesselId: string;
  volumeTransferredL: number;
  transferDate: Date;
  reason?: string;
  notes?: string;
}

/**
 * Validates that vessel is available for receiving transfers
 */
export function validateVesselAvailability(vessel: VesselData): void {
  if (vessel.status === "maintenance") {
    throw new VesselStateValidationError(
      `Vessel ${vessel.name} is under maintenance`,
      `Cannot transfer to vessel "${vessel.name}" - it's currently under maintenance. Please select a different vessel or wait until maintenance is complete.`,
      { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status },
    );
  }

  if (vessel.status === "cleaning") {
    throw new VesselStateValidationError(
      `Vessel ${vessel.name} is being cleaned`,
      `Cannot transfer to vessel "${vessel.name}" - it's currently being cleaned. Please wait until cleaning is complete or select another vessel.`,
      { vesselId: vessel.id, vesselName: vessel.name, status: vessel.status },
    );
  }
}

/**
 * Validates that transfer volume doesn't exceed vessel capacity
 */
export function validateVesselCapacity(
  vessel: VesselData,
  transferVolume: number,
  currentVolumeL: number = 0,
): void {
  const totalVolumeAfterTransfer = currentVolumeL + transferVolume;

  if (totalVolumeAfterTransfer > vessel.capacityL) {
    const availableCapacity = vessel.capacityL - currentVolumeL;
    throw new TransferValidationError(
      `Transfer volume ${transferVolume}L exceeds vessel capacity`,
      `Cannot transfer ${transferVolume}L to vessel "${vessel.name}". The vessel can only hold ${availableCapacity}L more (current: ${currentVolumeL}L, capacity: ${vessel.capacityL}L). Please reduce the transfer volume or select a larger vessel.`,
      {
        vesselId: vessel.id,
        vesselName: vessel.name,
        vesselCapacityL: vessel.capacityL,
        currentVolumeL,
        transferVolumeL: transferVolume,
        availableCapacityL: availableCapacity,
        excessVolumeL: totalVolumeAfterTransfer - vessel.capacityL,
      },
    );
  }
}

/**
 * Validates that batch has sufficient volume for transfer
 */
export function validateBatchVolume(
  batch: BatchData,
  transferVolume: number,
): void {
  if (transferVolume > batch.currentVolumeL) {
    throw new TransferValidationError(
      `Transfer volume ${transferVolume}L exceeds batch volume ${batch.currentVolumeL}L`,
      `Cannot transfer ${transferVolume}L from batch "${batch.batchNumber}" - it only contains ${batch.currentVolumeL}L. Please reduce the transfer volume to ${batch.currentVolumeL}L or less.`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        batchVolumeL: batch.currentVolumeL,
        transferVolumeL: transferVolume,
        shortfallL: transferVolume - batch.currentVolumeL,
      },
    );
  }

  if (batch.status === "completed") {
    throw new TransferValidationError(
      `Cannot transfer from completed batch`,
      `Batch "${batch.batchNumber}" is marked as completed and cannot be transferred. If you need to make changes, please update the batch status first.`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
      },
    );
  }

  if (batch.status === "discarded") {
    throw new TransferValidationError(
      `Cannot transfer from discarded batch`,
      `Batch "${batch.batchNumber}" is discarded and cannot be transferred.`,
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
      },
    );
  }
}

/**
 * Validates that vessel is not transferring to itself
 */
export function validateNotSelfTransfer(
  fromVesselId: string | undefined,
  toVesselId: string,
): void {
  if (fromVesselId && fromVesselId === toVesselId) {
    throw new TransferValidationError(
      "Cannot transfer to same vessel",
      "Source and destination vessels cannot be the same. Please select a different destination vessel.",
      { fromVesselId, toVesselId },
    );
  }
}

/**
 * Comprehensive transfer validation function
 */
export function validateTransfer(
  transferData: TransferData,
  batch: BatchData,
  toVessel: VesselData,
  fromVessel?: VesselData,
  toVesselCurrentVolume: number = 0,
): void {
  // Validate transfer volume is positive
  if (transferData.volumeTransferredL <= 0) {
    throw new TransferValidationError(
      "Transfer volume must be positive",
      "Transfer volume must be greater than 0L. Please enter a valid volume.",
      { volumeTransferredL: transferData.volumeTransferredL },
    );
  }

  // Validate batch has sufficient volume
  validateBatchVolume(batch, transferData.volumeTransferredL);

  // Validate destination vessel availability
  validateVesselAvailability(toVessel);

  // Validate destination vessel capacity
  validateVesselCapacity(
    toVessel,
    transferData.volumeTransferredL,
    toVesselCurrentVolume,
  );

  // Validate not transferring to same vessel
  validateNotSelfTransfer(transferData.fromVesselId, transferData.toVesselId);

  // If transferring from a vessel, validate source vessel
  if (fromVessel) {
    if (fromVessel.status === "maintenance") {
      throw new VesselStateValidationError(
        `Source vessel ${fromVessel.name} is under maintenance`,
        `Cannot transfer from vessel "${fromVessel.name}" - it's currently under maintenance.`,
        {
          vesselId: fromVessel.id,
          vesselName: fromVessel.name,
          status: fromVessel.status,
        },
      );
    }
  }
}

/**
 * Enhanced Zod schema for transfer validation with business rules
 */
export const transferValidationSchema = z
  .object({
    batchId: z.string().uuid("Invalid batch ID format"),
    fromVesselId: z.string().uuid("Invalid source vessel ID format").optional(),
    toVesselId: z.string().uuid("Invalid destination vessel ID format"),
    volumeTransferredL: z
      .number()
      .positive("Transfer volume must be greater than 0L")
      .max(50000, "Transfer volume cannot exceed 50,000L")
      .refine(
        (val) => Number.isFinite(val),
        "Transfer volume must be a valid number",
      ),
    transferDate: z
      .date()
      .refine(
        (date) => date <= new Date(),
        "Transfer date cannot be in the future",
      ),
    reason: z
      .string()
      .max(500, "Reason cannot exceed 500 characters")
      .optional(),
    notes: z
      .string()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional(),
  })
  .refine(
    (data) => {
      // Ensure not transferring to same vessel
      if (data.fromVesselId && data.fromVesselId === data.toVesselId) {
        throw new Error("Source and destination vessels cannot be the same");
      }
      return true;
    },
    {
      message: "Source and destination vessels cannot be the same",
      path: ["toVesselId"],
    },
  );

export type ValidatedTransferData = z.infer<typeof transferValidationSchema>;
