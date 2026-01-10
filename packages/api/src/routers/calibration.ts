import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  db,
  instrumentCalibrations,
  calibrationReadings,
} from "db";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  calculateLinearCalibration,
  prepareCalibrationReadings,
  applySGCorrection,
  correctHydrometerTemp,
  type CalibrationReading,
  type CalibrationCoefficients,
} from "lib";

// Input validation schemas
const calibrationReadingSchema = z.object({
  originalGravity: z.number().min(0.990).max(1.200),
  refractometerReading: z.number().min(0.990).max(1.200),
  hydrometerReading: z.number().min(0.990).max(1.200),
  temperatureC: z.number().min(-10).max(100),
  isFreshJuice: z.boolean().default(false),
  notes: z.string().optional(),
});

export const calibrationRouter = router({
  // Get the currently active calibration
  getActive: protectedProcedure.query(async () => {
    const [active] = await db
      .select()
      .from(instrumentCalibrations)
      .where(
        and(
          eq(instrumentCalibrations.isActive, true),
          isNull(instrumentCalibrations.deletedAt),
        ),
      )
      .limit(1);

    if (!active) {
      return { calibration: null };
    }

    // Get reading count
    const readings = await db
      .select()
      .from(calibrationReadings)
      .where(eq(calibrationReadings.calibrationId, active.id));

    return {
      calibration: {
        ...active,
        readingsCount: readings.length,
      },
    };
  }),

  // List all calibrations
  list: protectedProcedure
    .input(
      z
        .object({
          includeDeleted: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const includeDeleted = input?.includeDeleted ?? false;

      const whereConditions = [];
      if (!includeDeleted) {
        whereConditions.push(isNull(instrumentCalibrations.deletedAt));
      }

      const calibrations = await db
        .select()
        .from(instrumentCalibrations)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(instrumentCalibrations.calibrationDate));

      return { calibrations };
    }),

  // Get calibration by ID with all readings
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const [calibration] = await db
        .select()
        .from(instrumentCalibrations)
        .where(eq(instrumentCalibrations.id, input.id))
        .limit(1);

      if (!calibration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      const readings = await db
        .select()
        .from(calibrationReadings)
        .where(eq(calibrationReadings.calibrationId, input.id));

      return {
        calibration,
        readings,
      };
    }),

  // Create a new calibration session
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        hydrometerCalibrationTempC: z.number().default(20),
      }),
    )
    .mutation(async ({ input }) => {
      const [newCalibration] = await db
        .insert(instrumentCalibrations)
        .values({
          name: input.name,
          hydrometerCalibrationTempC: String(input.hydrometerCalibrationTempC),
          isActive: false,
        })
        .returning();

      return { calibration: newCalibration };
    }),

  // Add a reading to a calibration session
  addReading: adminProcedure
    .input(
      z.object({
        calibrationId: z.string().uuid(),
        ...calibrationReadingSchema.shape,
      }),
    )
    .mutation(async ({ input }) => {
      // Verify calibration exists
      const [calibration] = await db
        .select()
        .from(instrumentCalibrations)
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .limit(1);

      if (!calibration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      const [newReading] = await db
        .insert(calibrationReadings)
        .values({
          calibrationId: input.calibrationId,
          originalGravity: String(input.originalGravity),
          refractometerReading: String(input.refractometerReading),
          hydrometerReading: String(input.hydrometerReading),
          temperatureC: String(input.temperatureC),
          isFreshJuice: input.isFreshJuice,
          notes: input.notes,
        })
        .returning();

      return { reading: newReading };
    }),

  // Update a reading
  updateReading: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        ...calibrationReadingSchema.partial().shape,
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      // Build update object with string conversions for numeric fields
      const updateValues: Record<string, unknown> = {};
      if (updates.originalGravity !== undefined) {
        updateValues.originalGravity = String(updates.originalGravity);
      }
      if (updates.refractometerReading !== undefined) {
        updateValues.refractometerReading = String(updates.refractometerReading);
      }
      if (updates.hydrometerReading !== undefined) {
        updateValues.hydrometerReading = String(updates.hydrometerReading);
      }
      if (updates.temperatureC !== undefined) {
        updateValues.temperatureC = String(updates.temperatureC);
      }
      if (updates.isFreshJuice !== undefined) {
        updateValues.isFreshJuice = updates.isFreshJuice;
      }
      if (updates.notes !== undefined) {
        updateValues.notes = updates.notes;
      }

      const [updated] = await db
        .update(calibrationReadings)
        .set(updateValues)
        .where(eq(calibrationReadings.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading not found",
        });
      }

      return { reading: updated };
    }),

  // Delete a reading
  deleteReading: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .delete(calibrationReadings)
        .where(eq(calibrationReadings.id, input.id));

      return { success: true };
    }),

  // Calculate calibration coefficients from readings
  calculate: adminProcedure
    .input(
      z.object({
        calibrationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      // Get calibration
      const [calibration] = await db
        .select()
        .from(instrumentCalibrations)
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .limit(1);

      if (!calibration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      // Get all readings
      const readings = await db
        .select()
        .from(calibrationReadings)
        .where(eq(calibrationReadings.calibrationId, input.calibrationId));

      if (readings.length < 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Need at least 3 readings to calculate calibration",
        });
      }

      // Convert to the format expected by the calculation function
      const calibrationReadingsData: CalibrationReading[] = readings.map((r) => ({
        originalGravity: parseFloat(r.originalGravity),
        refractometerReading: parseFloat(r.refractometerReading),
        hydrometerReading: parseFloat(r.hydrometerReading),
        temperatureC: parseFloat(r.temperatureC),
        isFreshJuice: r.isFreshJuice ?? false,
      }));

      // Prepare readings (apply temperature correction to hydrometer values)
      const hydrometerCalibrationTempC = parseFloat(
        calibration.hydrometerCalibrationTempC ?? "20",
      );
      const preparedReadings = prepareCalibrationReadings(
        calibrationReadingsData,
        hydrometerCalibrationTempC,
      );

      // Calculate calibration
      const result = calculateLinearCalibration(preparedReadings);

      // Calculate baseline offset from fresh juice readings if any
      let baselineOffset = 0;
      const freshJuiceReadings = calibrationReadingsData.filter(
        (r) => r.isFreshJuice,
      );
      if (freshJuiceReadings.length > 0) {
        const avgRefrac =
          freshJuiceReadings.reduce((sum, r) => sum + r.refractometerReading, 0) /
          freshJuiceReadings.length;
        const avgHydro =
          freshJuiceReadings.reduce((sum, r) => {
            return sum + correctHydrometerTemp(r.hydrometerReading, r.temperatureC, hydrometerCalibrationTempC);
          }, 0) / freshJuiceReadings.length;
        baselineOffset = avgRefrac - avgHydro;
      }

      // Update readings with calculated values
      for (let i = 0; i < readings.length; i++) {
        const prediction = result.predictions[i];
        const prepared = preparedReadings[i];

        await db
          .update(calibrationReadings)
          .set({
            hydrometerCorrected: String(prepared.hydrometerCorrected),
            predictedSg: String(prediction.predicted),
            error: String(prediction.error),
          })
          .where(eq(calibrationReadings.id, readings[i].id));
      }

      // Update calibration with coefficients
      const [updatedCalibration] = await db
        .update(instrumentCalibrations)
        .set({
          linearCoefficients: result.coefficients,
          refractometerBaselineOffset: String(baselineOffset),
          readingsCount: readings.length,
          rSquared: String(result.rSquared),
          maxError: String(result.maxError),
          avgError: String(result.avgError),
          calibrationDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .returning();

      return {
        calibration: updatedCalibration,
        result,
      };
    }),

  // Activate a calibration (deactivates any other active calibration)
  activate: adminProcedure
    .input(
      z.object({
        calibrationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      // Verify calibration exists and has coefficients
      const [calibration] = await db
        .select()
        .from(instrumentCalibrations)
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .limit(1);

      if (!calibration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      if (!calibration.linearCoefficients) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Calibration must be calculated before activating",
        });
      }

      // Deactivate all other calibrations
      await db
        .update(instrumentCalibrations)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(instrumentCalibrations.isActive, true));

      // Activate this calibration
      const [activated] = await db
        .update(instrumentCalibrations)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .returning();

      return { calibration: activated };
    }),

  // Deactivate a calibration
  deactivate: adminProcedure
    .input(
      z.object({
        calibrationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const [deactivated] = await db
        .update(instrumentCalibrations)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .returning();

      if (!deactivated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      return { calibration: deactivated };
    }),

  // Soft delete a calibration
  delete: adminProcedure
    .input(
      z.object({
        calibrationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .update(instrumentCalibrations)
        .set({
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(instrumentCalibrations.id, input.calibrationId))
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      return { success: true };
    }),

  // Preview correction for a reading (no database write)
  // Used for real-time preview in the measurement form
  previewCorrection: protectedProcedure
    .input(
      z.object({
        instrumentType: z.enum(["hydrometer", "refractometer"]),
        rawReading: z.number().min(0.990).max(1.200),
        temperatureC: z.number().min(-10).max(100),
        originalGravity: z.number().min(0.990).max(1.200).optional(),
        isFreshJuice: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      // Get active calibration
      const [activeCalibration] = await db
        .select()
        .from(instrumentCalibrations)
        .where(
          and(
            eq(instrumentCalibrations.isActive, true),
            isNull(instrumentCalibrations.deletedAt),
          ),
        )
        .limit(1);

      // Apply correction
      const result = applySGCorrection({
        instrumentType: input.instrumentType,
        rawReading: input.rawReading,
        temperatureC: input.temperatureC,
        originalGravity: input.originalGravity,
        isFreshJuice: input.isFreshJuice,
        calibration: activeCalibration
          ? {
              hydrometerCalibrationTempC: parseFloat(
                activeCalibration.hydrometerCalibrationTempC ?? "20",
              ),
              refractometerBaselineOffset: parseFloat(
                activeCalibration.refractometerBaselineOffset ?? "0",
              ),
              linearCoefficients: activeCalibration.linearCoefficients as CalibrationCoefficients | null,
            }
          : undefined,
      });

      return {
        ...result,
        hasActiveCalibration: !!activeCalibration,
        calibrationName: activeCalibration?.name ?? null,
      };
    }),

  // Update calibration metadata
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        hydrometerCalibrationTempC: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) {
        updateValues.name = updates.name;
      }
      if (updates.hydrometerCalibrationTempC !== undefined) {
        updateValues.hydrometerCalibrationTempC = String(
          updates.hydrometerCalibrationTempC,
        );
      }
      if (updates.notes !== undefined) {
        updateValues.notes = updates.notes;
      }

      const [updated] = await db
        .update(instrumentCalibrations)
        .set(updateValues)
        .where(eq(instrumentCalibrations.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calibration not found",
        });
      }

      return { calibration: updated };
    }),
});
