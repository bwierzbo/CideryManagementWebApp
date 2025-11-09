import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  batchCarbonationOperations,
  batches,
  vessels,
  additivePurchases,
} from "db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  calculateCO2Volumes,
  calculateRequiredPressure,
  estimateCarbonationDuration,
  isPressureSafe,
  validateTemperature,
  getCarbonationLevel,
} from "lib/src/utils/carbonation-calculations";

export const carbonationRouter = router({
  /**
   * Start a new carbonation operation
   */
  start: createRbacProcedure("create", "carbonation")
    .input(
      z.object({
        batchId: z.string().uuid(),
        vesselId: z.string().uuid().nullable(),
        startedAt: z.date().optional(),
        carbonationProcess: z.enum(["headspace", "inline", "stone", "bottle_conditioning"]),
        targetCo2Volumes: z.number().min(0).max(5),
        startingTemperature: z.preprocess(
          (val) => val === undefined || val === null ? undefined : Number(val),
          z.number().min(-5).max(25).optional()
        ),
        startingCo2Volumes: z.preprocess(
          (val) => val === undefined || val === null ? undefined : Number(val),
          z.number().min(0).max(5).optional()
        ),
        pressureApplied: z.number().min(0).max(50),
        startingVolume: z.number().positive(),
        startingVolumeUnit: z.enum(["L", "gal"]).default("L"),
        gasType: z.string().default("CO2"),
        notes: z.string().optional(),
        // For bottle conditioning
        additivePurchaseId: z.string().uuid().optional(),
        primingSugarAmount: z.preprocess(
          (val) => val === undefined || val === null ? undefined : Number(val),
          z.number().positive().optional()
        ),
        primingSugarType: z.enum(["sucrose", "dextrose", "honey"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate temperature if provided
      if (input.startingTemperature !== undefined) {
        const tempValidation = validateTemperature(input.startingTemperature);
        if (!tempValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: tempValidation.message || "Invalid temperature",
          });
        }
      }

      // Validate vessel for forced carbonation (skip for bottle conditioning)
      if (input.vesselId && input.carbonationProcess !== "bottle_conditioning") {
        const [vessel] = await db
          .select()
          .from(vessels)
          .where(eq(vessels.id, input.vesselId))
          .limit(1);

        if (!vessel) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vessel not found",
          });
        }

        // Validate pressure is safe for vessel
        const vesselMaxPressure = vessel.maxPressure ? parseFloat(vessel.maxPressure) : 30;
        if (!isPressureSafe(input.pressureApplied, vesselMaxPressure)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Pressure ${input.pressureApplied} PSI exceeds safe limit for this vessel (max: ${vesselMaxPressure} PSI)`,
          });
        }
      }

      // Get batch to check current status
      const [batch] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, input.batchId))
        .limit(1);

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      // Check if batch already has active carbonation
      const [existingCarbonation] = await db
        .select()
        .from(batchCarbonationOperations)
        .where(
          and(
            eq(batchCarbonationOperations.batchId, input.batchId),
            isNull(batchCarbonationOperations.completedAt),
            isNull(batchCarbonationOperations.deletedAt)
          )
        )
        .limit(1);

      if (existingCarbonation) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Batch already has an active carbonation operation",
        });
      }

      // Calculate suggested pressure if temperature provided
      let suggestedPressure = null;
      if (input.startingTemperature !== undefined) {
        suggestedPressure = calculateRequiredPressure(
          input.targetCo2Volumes,
          input.startingTemperature
        );
      }

      // Validate additive purchase exists for bottle conditioning
      if (input.carbonationProcess === "bottle_conditioning" && input.additivePurchaseId) {
        const [additivePurchase] = await db
          .select()
          .from(additivePurchases)
          .where(eq(additivePurchases.id, input.additivePurchaseId))
          .limit(1);

        if (!additivePurchase) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Additive purchase not found in inventory",
          });
        }

        // TODO: Implement proper inventory tracking for additives
        // Currently additivePurchases table doesn't have quantity field
        // Need to implement proper additive inventory management with:
        // - additive_purchase_items table for line items with quantities
        // - Tracking quantity used vs available
        // - Depletion of inventory when used
      }

      // Create carbonation operation
      const [carbonation] = await db
        .insert(batchCarbonationOperations)
        .values({
          batchId: input.batchId,
          vesselId: input.vesselId,
          startedAt: input.startedAt || new Date(),
          carbonationProcess: input.carbonationProcess,
          targetCo2Volumes: input.targetCo2Volumes.toString(),
          startingTemperature: input.startingTemperature?.toString(),
          startingCo2Volumes: input.startingCo2Volumes?.toString() || "0",
          pressureApplied: input.pressureApplied.toString(),
          suggestedPressure: suggestedPressure?.toString(),
          startingVolume: input.startingVolume.toString(),
          startingVolumeUnit: input.startingVolumeUnit,
          gasType: input.gasType,
          performedBy: null, // TODO: Add user ID to session type
          notes: input.notes,
          // Additive tracking
          additivePurchaseId: input.additivePurchaseId,
          primingSugarAmount: input.primingSugarAmount?.toString(),
          primingSugarType: input.primingSugarType,
        })
        .returning();

      return {
        carbonation,
        carbonationLevel: getCarbonationLevel(input.targetCo2Volumes),
      };
    }),

  /**
   * Complete a carbonation operation
   */
  complete: createRbacProcedure("update", "carbonation")
    .input(
      z.object({
        carbonationId: z.string().uuid(),
        finalCo2Volumes: z.number().min(0).max(5),
        finalPressure: z.number().min(0).max(50),
        finalTemperature: z.number().min(-5).max(25),
        finalVolume: z.number().positive(),
        finalVolumeUnit: z.enum(["L", "gal"]).default("L"),
        qualityCheck: z.enum(["pass", "fail", "needs_adjustment"]),
        qualityNotes: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get carbonation operation
      const [carbonation] = await db
        .select()
        .from(batchCarbonationOperations)
        .where(eq(batchCarbonationOperations.id, input.carbonationId))
        .limit(1);

      if (!carbonation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Carbonation operation not found",
        });
      }

      if (carbonation.completedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Carbonation operation already completed",
        });
      }

      // Calculate actual duration in hours
      const startTime = new Date(carbonation.startedAt).getTime();
      const endTime = Date.now();
      const actualDurationHours = ((endTime - startTime) / (1000 * 60 * 60)).toFixed(1);

      // Update carbonation operation
      const [updated] = await db
        .update(batchCarbonationOperations)
        .set({
          finalCo2Volumes: input.finalCo2Volumes.toString(),
          finalPressure: input.finalPressure.toString(),
          finalTemperature: input.finalTemperature.toString(),
          finalVolume: input.finalVolume.toString(),
          finalVolumeUnit: input.finalVolumeUnit,
          durationHours: actualDurationHours,
          qualityCheck: input.qualityCheck,
          qualityNotes: input.qualityNotes,
          completedAt: new Date(),
          completedBy: null, // TODO: Add user ID to session type
          updatedAt: new Date(),
        })
        .where(eq(batchCarbonationOperations.id, input.carbonationId))
        .returning();

      const targetCo2 = parseFloat(carbonation.targetCo2Volumes);
      const targetMet = Math.abs(input.finalCo2Volumes - targetCo2) < 0.3;

      return {
        carbonation: updated,
        carbonationLevel: getCarbonationLevel(input.finalCo2Volumes),
        targetMet,
      };
    }),

  /**
   * List all carbonations with filters
   */
  list: createRbacProcedure("read", "carbonation")
    .input(
      z
        .object({
          batchId: z.string().uuid().optional(),
          vesselId: z.string().uuid().optional(),
          activeOnly: z.boolean().default(false),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions = [isNull(batchCarbonationOperations.deletedAt)];

      if (input?.batchId) {
        conditions.push(eq(batchCarbonationOperations.batchId, input.batchId));
      }

      if (input?.vesselId) {
        conditions.push(eq(batchCarbonationOperations.vesselId, input.vesselId));
      }

      if (input?.activeOnly) {
        conditions.push(isNull(batchCarbonationOperations.completedAt));
      }

      const carbonations = await db
        .select({
          carbonation: batchCarbonationOperations,
          batch: batches,
          vessel: vessels,
        })
        .from(batchCarbonationOperations)
        .leftJoin(batches, eq(batchCarbonationOperations.batchId, batches.id))
        .leftJoin(vessels, eq(batchCarbonationOperations.vesselId, vessels.id))
        .where(and(...conditions))
        .orderBy(desc(batchCarbonationOperations.startedAt))
        .limit(input?.limit || 50);

      return carbonations.map((row) => {
        const targetCo2 = parseFloat(row.carbonation.targetCo2Volumes);
        return {
          ...row,
          carbonationLevel: getCarbonationLevel(targetCo2),
          isComplete: !!row.carbonation.completedAt,
        };
      });
    }),

  /**
   * List active carbonations only
   */
  listActive: createRbacProcedure("read", "carbonation").query(async () => {
    const carbonations = await db
      .select({
        carbonation: batchCarbonationOperations,
        batch: batches,
        vessel: vessels,
      })
      .from(batchCarbonationOperations)
      .leftJoin(batches, eq(batchCarbonationOperations.batchId, batches.id))
      .leftJoin(vessels, eq(batchCarbonationOperations.vesselId, vessels.id))
      .where(
        and(
          isNull(batchCarbonationOperations.completedAt),
          isNull(batchCarbonationOperations.deletedAt)
        )
      )
      .orderBy(desc(batchCarbonationOperations.startedAt));

    return carbonations.map((row) => {
      const startTime = new Date(row.carbonation.startedAt).getTime();
      const now = Date.now();
      const hoursElapsed = Math.round((now - startTime) / (1000 * 60 * 60));
      
      // Estimate 48 hours if no estimate provided
      const estimatedHours = row.carbonation.durationHours 
        ? parseFloat(row.carbonation.durationHours) 
        : 48;
      
      const percentComplete = Math.min(
        100,
        Math.round((hoursElapsed / estimatedHours) * 100)
      );

      const targetCo2 = parseFloat(row.carbonation.targetCo2Volumes);

      return {
        ...row,
        carbonationLevel: getCarbonationLevel(targetCo2),
        hoursElapsed,
        percentComplete,
        isOverdue: hoursElapsed > estimatedHours * 1.2,
      };
    });
  }),

  /**
   * Calculate pressure/duration suggestions for target CO2
   */
  calculateSuggestions: createRbacProcedure("read", "carbonation")
    .input(
      z.object({
        targetCO2Volumes: z.number().min(0).max(5),
        temperatureCelsius: z.number().min(-5).max(25),
        currentCO2Volumes: z.number().min(0).max(5).default(0),
        vesselMaxPressure: z.number().min(0).max(100).optional(),
      })
    )
    .query(async ({ input }) => {
      // Validate temperature
      const tempValidation = validateTemperature(input.temperatureCelsius);

      // Calculate required pressure
      const requiredPressure = calculateRequiredPressure(
        input.targetCO2Volumes,
        input.temperatureCelsius
      );

      // Check if pressure is safe for vessel
      const isSafe = input.vesselMaxPressure
        ? isPressureSafe(requiredPressure, input.vesselMaxPressure)
        : true;

      // Estimate duration
      const durationHours = estimateCarbonationDuration(
        input.currentCO2Volumes,
        input.targetCO2Volumes,
        requiredPressure
      );

      // Calculate expected CO2 at this pressure/temp (verification)
      const expectedCO2 = calculateCO2Volumes(
        requiredPressure,
        input.temperatureCelsius
      );

      // Get carbonation level
      const carbonationLevel = getCarbonationLevel(input.targetCO2Volumes);

      // Generate alternative suggestions (±2°C)
      const alternatives = [];
      for (let tempDelta = -2; tempDelta <= 2; tempDelta += 2) {
        if (tempDelta === 0) continue;
        const altTemp = input.temperatureCelsius + tempDelta;
        if (altTemp < 0 || altTemp > 20) continue;

        const altPressure = calculateRequiredPressure(
          input.targetCO2Volumes,
          altTemp
        );
        const altDuration = estimateCarbonationDuration(
          input.currentCO2Volumes,
          input.targetCO2Volumes,
          altPressure
        );

        alternatives.push({
          temperatureCelsius: altTemp,
          pressurePSI: altPressure,
          estimatedDurationHours: altDuration,
        });
      }

      return {
        targetCO2Volumes: input.targetCO2Volumes,
        carbonationLevel,
        requiredPressurePSI: requiredPressure,
        estimatedDurationHours: durationHours,
        isSafeForVessel: isSafe,
        expectedCO2Volumes: expectedCO2,
        temperatureValidation: tempValidation,
        alternatives,
        recommendations: {
          pressure: `Apply ${requiredPressure} PSI`,
          temperature: `Maintain ${input.temperatureCelsius}°C (${tempValidation.isOptimal ? "optimal" : "acceptable"})`,
          duration: `Expect approximately ${durationHours} hours`,
          method:
            input.targetCO2Volumes >= 2.5
              ? "Carbonation stone recommended for high CO2"
              : "Headspace pressure is sufficient",
        },
      };
    }),
});
