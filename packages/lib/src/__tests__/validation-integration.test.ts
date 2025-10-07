/**
 * Integration test to verify validation functions work correctly
 */

import { describe, it, expect } from "vitest";
import {
  validatePositiveVolume,
  validateTransfer,
  validatePackaging,
  validateMeasurement,
  validateVesselState,
  VolumeValidationError,
  TransferValidationError,
} from "../validation";

describe("Validation Integration Tests", () => {
  it("should validate positive volume correctly", () => {
    expect(() => validatePositiveVolume(100)).not.toThrow();
    expect(() => validatePositiveVolume(-100)).toThrow(VolumeValidationError);
  });

  it("should validate transfer operations", () => {
    const vessel = {
      id: "vessel-1",
      name: "Test Vessel",
      capacityL: 1000,
      status: "available" as const,
      currentVolumeL: 100,
    };

    const batch = {
      id: "batch-1",
      batchNumber: "B001",
      currentVolumeL: 500,
      status: "active" as const,
      vesselId: "vessel-1",
    };

    const transfer = {
      batchId: "batch-1",
      toVesselId: "vessel-2",
      volumeTransferredL: 200,
      transferDate: new Date(),
    };

    expect(() =>
      validateTransfer(transfer, batch, vessel, undefined, 0),
    ).not.toThrow();

    // Test with invalid volume
    const invalidTransfer = { ...transfer, volumeTransferredL: -100 };
    expect(() =>
      validateTransfer(invalidTransfer, batch, vessel, undefined, 0),
    ).toThrow(TransferValidationError);
  });

  it("should validate packaging operations", () => {
    const batch = {
      id: "batch-1",
      batchNumber: "B001",
      currentVolumeL: 500,
      status: "active" as const,
      vesselId: "vessel-1",
    };

    const packaging = {
      batchId: "batch-1",
      packageDate: new Date(),
      volumePackagedL: 200.25, // 267 × 0.75L = 200.25L
      bottleSize: "750ml",
      bottleCount: 267,
      abvAtPackaging: 6.5,
    };

    expect(() => validatePackaging(batch, packaging)).not.toThrow();
  });

  it("should validate measurement operations", () => {
    const measurement = {
      batchId: "batch-1",
      measurementDate: new Date(),
      abv: 6.5,
      ph: 3.5,
      specificGravity: 1.05,
    };

    expect(() => validateMeasurement(measurement)).not.toThrow();
  });

  it("should validate vessel state operations", () => {
    const vessel = {
      id: "vessel-1",
      name: "Test Vessel",
      status: "available" as const,
      currentVolumeL: 0,
      capacityL: 1000,
      type: "fermenter" as const,
    };

    expect(() => validateVesselState(vessel, "fermenting")).not.toThrow();
  });
});
