import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  batches,
  batchCompositions,
  vendors,
  baseFruitVarieties,
  purchaseItems,
  vessels,
  batchMeasurements,
  batchAdditives,
  pressRuns,
  basefruitPurchaseItems,
  basefruitPurchases,
  batchMergeHistory,
  batchTransfers,
  batchFilterOperations,
  batchRackingOperations,
  juicePurchaseItems,
  juicePurchases,
} from "db";
import { bottleRuns, kegFills, kegs } from "db/src/schema/packaging";
import { eq, and, isNull, desc, asc, sql, or, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { convertToLiters } from "lib/src/units/conversions";
import {
  calculateEstimatedSGAfterAddition,
  calculateEstimatedABV,
  convertSugarToGrams,
} from "lib";

// Input validation schemas
const batchIdSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
});

const listBatchesSchema = z.object({
  status: z.enum(["fermentation", "aging", "conditioning", "completed", "discarded"]).optional(),
  vesselId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(["name", "startDate", "status"]).default("startDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.boolean().default(false),
});

const addMeasurementSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  measurementDate: z.date().or(z.string().transform((val) => new Date(val))),
  specificGravity: z.number().min(0.99).max(1.2).optional(),
  abv: z.number().min(0).max(20).optional(),
  ph: z.number().min(2).max(5).optional(),
  totalAcidity: z.number().min(0).max(20).optional(),
  temperature: z.number().min(0).max(40).optional(),
  volume: z.number().positive().optional(),
  volumeUnit: z.enum(['L', 'gal']).default('L'),
  notes: z.string().optional(),
  takenBy: z.string().optional(),
});

const addAdditiveSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  additiveType: z.string().min(1, "Additive type is required"),
  additiveName: z.string().min(1, "Additive name is required"),
  amount: z.number().positive("Amount must be positive"),
  unit: z.string().min(1, "Unit is required"),
  notes: z.string().optional(),
  addedBy: z.string().optional(),
  addedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
});

const updateMeasurementSchema = z.object({
  measurementId: z.string().uuid("Invalid measurement ID"),
  measurementDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
  specificGravity: z.number().min(0.99).max(1.2).optional(),
  abv: z.number().min(0).max(20).optional(),
  ph: z.number().min(2).max(5).optional(),
  totalAcidity: z.number().min(0).max(20).optional(),
  temperature: z.number().min(0).max(40).optional(),
  volume: z.number().positive().optional(),
  volumeUnit: z.enum(['L', 'gal']).optional(),
  notes: z.string().optional(),
  takenBy: z.string().optional(),
});

const updateAdditiveSchema = z.object({
  additiveId: z.string().uuid("Invalid additive ID"),
  additiveType: z.string().min(1).optional(),
  additiveName: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  addedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
  notes: z.string().optional(),
  addedBy: z.string().optional(),
});

const filterBatchSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  vesselId: z.string().uuid("Invalid vessel ID"),
  filterType: z.enum(["coarse", "fine", "sterile"]),
  volumeBefore: z.number().positive("Volume before must be positive"),
  volumeBeforeUnit: z.enum(['L', 'gal']).default('L'),
  volumeAfter: z.number().positive("Volume after must be positive"),
  volumeAfterUnit: z.enum(['L', 'gal']).default('L'),
  filteredAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
  filteredBy: z.string().optional(),
}).refine((data) => data.volumeAfter < data.volumeBefore, {
  message: "Volume after filtering must be less than volume before",
  path: ["volumeAfter"],
});

const updateBatchSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  name: z.string().optional(),
  batchNumber: z.string().optional(),
  status: z.enum(["fermentation", "aging", "conditioning", "completed", "discarded"]).optional(),
  customName: z.string().optional(),
  startDate: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .optional(),
  endDate: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .optional(),
  notes: z.string().optional(),
});

const transferJuiceToTankSchema = z.object({
  juicePurchaseItemId: z.string().uuid("Invalid juice purchase item ID"),
  vesselId: z.string().uuid("Invalid vessel ID"),
  volumeToTransfer: z.number().positive("Volume must be positive"),
  volumeUnit: z.enum(["L", "gal"]).default("L"),
  transferDate: z.date().or(z.string().transform((val) => new Date(val))),
  notes: z.string().optional(),
});

/**
 * Batch Router
 * Provides batch metadata and composition details for UI display
 * RBAC: Viewer and above can read batch data
 */
export const batchRouter = router({
  /**
   * Get batch composition details
   * Returns array of composition entries with vendor, variety, and cost information
   */
  getComposition: createRbacProcedure("read", "batch")
    .input(batchIdSchema)
    .query(async ({ input }) => {
      console.log("🎨 getComposition called for batchId:", input.batchId);
      try {
        // First verify the batch exists
        const batchExists = await db
          .select({ id: batches.id })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        console.log("✅ Batch exists:", batchExists.length > 0);

        if (!batchExists.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Get all composition (base fruit AND juice purchases)
        const compositionData = await db
          .select({
            vendorName: vendors.name,
            varietyName: sql<string>`
              CASE
                WHEN ${batchCompositions.sourceType} = 'base_fruit' THEN ${baseFruitVarieties.name}
                WHEN ${batchCompositions.sourceType} = 'juice_purchase' THEN COALESCE(${juicePurchaseItems.varietyName}, ${juicePurchaseItems.juiceType})
                ELSE 'Unknown'
              END
            `,
            lotCode: batchCompositions.lotCode,
            inputWeightKg: batchCompositions.inputWeightKg,
            juiceVolume: batchCompositions.juiceVolume,
            fractionOfBatch: batchCompositions.fractionOfBatch,
            materialCost: batchCompositions.materialCost,
            avgBrix: batchCompositions.avgBrix,
            sourceType: batchCompositions.sourceType,
            ph: juicePurchaseItems.ph,
            specificGravity: juicePurchaseItems.specificGravity,
          })
          .from(batchCompositions)
          .leftJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .leftJoin(
            baseFruitVarieties,
            eq(batchCompositions.varietyId, baseFruitVarieties.id),
          )
          .leftJoin(
            juicePurchaseItems,
            eq(batchCompositions.juicePurchaseItemId, juicePurchaseItems.id),
          )
          .where(
            and(
              eq(batchCompositions.batchId, input.batchId),
              isNull(batchCompositions.deletedAt),
            ),
          );

        console.log("📊 Composition data count:", compositionData.length);

        // All composition is now in batch_compositions table
        const allComposition = compositionData;

        // Convert string fields to numbers for the response
        return allComposition.map((item) => ({
          vendorName: item.vendorName || "Unknown Vendor",
          varietyName: item.varietyName || "Unknown",
          lotCode: item.lotCode || "",
          inputWeightKg: item.inputWeightKg ? parseFloat(item.inputWeightKg) : 0,
          juiceVolume: parseFloat(item.juiceVolume || "0"),
          fractionOfBatch: item.fractionOfBatch ? parseFloat(item.fractionOfBatch) : 0,
          materialCost: parseFloat(item.materialCost || "0"),
          avgBrix: item.avgBrix ? parseFloat(item.avgBrix) : undefined,
          sourceType: item.sourceType,
          ph: item.ph ? parseFloat(item.ph) : undefined,
          specificGravity: item.specificGravity ? parseFloat(item.specificGravity) : undefined,
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting batch composition:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get batch composition",
        });
      }
    }),

  /**
   * Get batch metadata
   * Returns basic batch information for UI display
   */
  get: createRbacProcedure("read", "batch")
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        // Get batch metadata with vessel information
        const batchData = await db
          .select({
            id: batches.id,
            name: batches.name,
            batchNumber: batches.batchNumber,
            customName: batches.customName,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            vesselIsPressureVessel: vessels.isPressureVessel,
            vesselMaxPressure: vessels.maxPressure,
            startDate: batches.startDate,
            endDate: batches.endDate,
            originPressRunId: batches.originPressRunId,
            createdAt: batches.createdAt,
            updatedAt: batches.updatedAt,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batchData.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batch = batchData[0];

        return {
          id: batch.id,
          name: batch.name,
          batchNumber: batch.batchNumber,
          customName: batch.customName,
          status: batch.status,
          vesselId: batch.vesselId,
          vesselName: batch.vesselName,
          vesselIsPressureVessel: batch.vesselIsPressureVessel,
          vesselMaxPressure: batch.vesselMaxPressure,
          startDate: batch.startDate,
          endDate: batch.endDate,
          originPressRunId: batch.originPressRunId,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting batch metadata:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get batch metadata",
        });
      }
    }),

  /**
   * List all batches with filtering and pagination
   */
  list: createRbacProcedure("list", "batch")
    .input(listBatchesSchema.optional())
    .query(async ({ input = {} }) => {
      try {
        // Build WHERE conditions
        const conditions = [];

        // Only exclude deleted batches if includeDeleted is false
        if (!input.includeDeleted) {
          conditions.push(isNull(batches.deletedAt));
        }

        if (input.status) {
          conditions.push(eq(batches.status, input.status));
        }

        if (input.vesselId) {
          conditions.push(eq(batches.vesselId, input.vesselId));
        }

        if (input.search) {
          conditions.push(like(batches.name, `%${input.search}%`));
        }

        // Build ORDER BY clause
        const sortColumn = {
          name: batches.name,
          startDate: sql`COALESCE(${pressRuns.dateCompleted}, ${batches.startDate})`,
          status: batches.status,
        }[input.sortBy || "startDate"];

        const orderBy =
          input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

        // Query batches with vessel info and press run completion date
        const batchesList = await db
          .select({
            id: batches.id,
            name: batches.name,
            customName: batches.customName,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            vesselCapacity: vessels.capacity,
            vesselCapacityUnit: vessels.capacityUnit,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
            initialVolume: batches.initialVolume,
            initialVolumeUnit: batches.initialVolumeUnit,
            startDate:
              sql<string>`COALESCE(${pressRuns.dateCompleted}, ${batches.startDate})`.as(
                "startDate",
              ),
            endDate: batches.endDate,
            originPressRunId: batches.originPressRunId,
            createdAt: batches.createdAt,
            updatedAt: batches.updatedAt,
            deletedAt: batches.deletedAt,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .leftJoin(
            pressRuns,
            eq(batches.originPressRunId, pressRuns.id),
          )
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(orderBy)
          .limit(input.limit || 50)
          .offset(input.offset || 0);

        // Get total count for pagination
        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(batches)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        const totalCount = totalCountResult[0]?.count || 0;

        // Get latest measurements for each batch
        const batchIds = batchesList.map((b) => b.id);
        let batchMeasurementsMap: Record<string, any> = {};

        if (batchIds.length > 0) {
          const measurementData = await db
            .select({
              batchId: batchMeasurements.batchId,
              volume: batchMeasurements.volume,
              volumeUnit: batchMeasurements.volumeUnit,
              specificGravity: batchMeasurements.specificGravity,
              ph: batchMeasurements.ph,
              temperature: batchMeasurements.temperature,
              measurementDate: batchMeasurements.measurementDate,
            })
            .from(batchMeasurements)
            .where(
              and(
                sql`${batchMeasurements.batchId} IN (${sql.join(
                  batchIds.map((id) => sql`${id}`),
                  sql`, `,
                )})`,
                isNull(batchMeasurements.deletedAt),
              ),
            )
            .orderBy(desc(batchMeasurements.measurementDate));

          // Get the latest measurements for each batch
          measurementData.forEach((row) => {
            if (!batchMeasurementsMap[row.batchId]) {
              batchMeasurementsMap[row.batchId] = {
                volume: row.volume
                  ? parseFloat(row.volume.toString())
                  : null,
                volumeUnit: row.volumeUnit,
                specificGravity: row.specificGravity,
                ph: row.ph,
                temperature: row.temperature,
                measurementDate: row.measurementDate,
              };
            }
          });
        }

        // Calculate days active for each batch
        const enhancedBatches = batchesList.map((batch) => {
          const startDate = new Date(batch.startDate);
          const endDate = batch.endDate ? new Date(batch.endDate) : new Date();
          const daysActive = Math.floor(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          const measurement = batchMeasurementsMap[batch.id] || {};

          // Use batch's currentVolume or fall back to latest measurement
          const currentVolumeValue = batch.currentVolume
            ? parseFloat(batch.currentVolume.toString())
            : measurement.volume || 0;

          return {
            ...batch,
            currentVolume: currentVolumeValue,
            currentVolumeUnit: batch.currentVolumeUnit,
            initialVolume: batch.initialVolume ? parseFloat(batch.initialVolume.toString()) : null,
            initialVolumeUnit: batch.initialVolumeUnit,
            vesselCapacityUnit: batch.vesselCapacityUnit,
            daysActive,
            latestMeasurement: measurement,
          };
        });

        return {
          batches: enhancedBatches,
          pagination: {
            total: totalCount,
            limit: input.limit || 50,
            offset: input.offset || 0,
            hasMore: (input.offset || 0) + (input.limit || 50) < totalCount,
          },
        };
      } catch (error) {
        console.error("Error listing batches:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list batches",
        });
      }
    }),

  /**
   * Get complete batch history including origin, measurements, and additives
   */
  getHistory: createRbacProcedure("read", "batch")
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        // Get batch with full details
        const batchData = await db
          .select({
            id: batches.id,
            name: batches.name,
            customName: batches.customName,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            startDate: batches.startDate,
            endDate: batches.endDate,
            originPressRunId: batches.originPressRunId,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batchData.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batch = batchData[0];

        // Get composition with full origin details (base fruit AND juice purchases)
        const composition = await db
          .select({
            vendorName: vendors.name,
            varietyName: sql<string>`
              CASE
                WHEN ${batchCompositions.sourceType} = 'base_fruit' THEN ${baseFruitVarieties.name}
                WHEN ${batchCompositions.sourceType} = 'juice_purchase' THEN COALESCE(${juicePurchaseItems.varietyName}, ${juicePurchaseItems.juiceType})
                ELSE 'Unknown'
              END
            `,
            inputWeightKg: batchCompositions.inputWeightKg,
            juiceVolume: batchCompositions.juiceVolume,
            fractionOfBatch: batchCompositions.fractionOfBatch,
            materialCost: batchCompositions.materialCost,
            avgBrix: batchCompositions.avgBrix,
            sourceType: batchCompositions.sourceType,
            lotCode: batchCompositions.lotCode,
            ph: juicePurchaseItems.ph,
            specificGravity: juicePurchaseItems.specificGravity,
            brix: juicePurchaseItems.brix,
            notes: juicePurchaseItems.notes,
          })
          .from(batchCompositions)
          .leftJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .leftJoin(
            baseFruitVarieties,
            eq(batchCompositions.varietyId, baseFruitVarieties.id),
          )
          .leftJoin(
            juicePurchaseItems,
            eq(batchCompositions.juicePurchaseItemId, juicePurchaseItems.id),
          )
          .where(
            and(
              eq(batchCompositions.batchId, input.batchId),
              isNull(batchCompositions.deletedAt),
            ),
          )
          .orderBy(desc(batchCompositions.fractionOfBatch));

        // Get all measurements
        const measurements = await db
          .select({
            id: batchMeasurements.id,
            measurementDate: batchMeasurements.measurementDate,
            specificGravity: batchMeasurements.specificGravity,
            abv: batchMeasurements.abv,
            ph: batchMeasurements.ph,
            totalAcidity: batchMeasurements.totalAcidity,
            temperature: batchMeasurements.temperature,
            volume: batchMeasurements.volume,
            volumeUnit: batchMeasurements.volumeUnit,
            notes: batchMeasurements.notes,
            takenBy: batchMeasurements.takenBy,
          })
          .from(batchMeasurements)
          .where(
            and(
              eq(batchMeasurements.batchId, input.batchId),
              isNull(batchMeasurements.deletedAt),
            ),
          )
          .orderBy(desc(batchMeasurements.measurementDate));

        // Get all additives
        const additives = await db
          .select({
            id: batchAdditives.id,
            additiveType: batchAdditives.additiveType,
            additiveName: batchAdditives.additiveName,
            amount: batchAdditives.amount,
            unit: batchAdditives.unit,
            notes: batchAdditives.notes,
            addedAt: batchAdditives.addedAt,
            addedBy: batchAdditives.addedBy,
          })
          .from(batchAdditives)
          .where(
            and(
              eq(batchAdditives.batchId, input.batchId),
              isNull(batchAdditives.deletedAt),
            ),
          )
          .orderBy(desc(batchAdditives.addedAt));

        // Get origin press run details if available
        let originDetails = null;
        if (batch.originPressRunId) {
          const pressRunData = await db
            .select({
              id: pressRuns.id,
              pressRunName: pressRuns.pressRunName,
              pressedDate: pressRuns.dateCompleted,
              totalAppleWeightKg: pressRuns.totalAppleWeightKg,
              totalJuiceVolume: pressRuns.totalJuiceVolume,
              totalJuiceVolumeUnit: pressRuns.totalJuiceVolumeUnit,
              extractionRate: pressRuns.extractionRate,
            })
            .from(pressRuns)
            .where(eq(pressRuns.id, batch.originPressRunId))
            .limit(1);

          if (pressRunData.length) {
            originDetails = pressRunData[0];
          }
        }

        return {
          batch,
          origin: originDetails,
          composition: composition.map((item) => ({
            vendorName: item.vendorName || "Unknown Vendor",
            varietyName: item.varietyName || "Unknown",
            inputWeightKg: parseFloat(item.inputWeightKg || "0"),
            juiceVolume: parseFloat(item.juiceVolume || "0"),
            fractionOfBatch: parseFloat(item.fractionOfBatch || "0"),
            materialCost: parseFloat(item.materialCost || "0"),
            avgBrix: item.avgBrix ? parseFloat(item.avgBrix) : undefined,
            sourceType: item.sourceType,
          })),
          measurements: measurements.map((m) => ({
            ...m,
            specificGravity: m.specificGravity
              ? parseFloat(m.specificGravity.toString())
              : undefined,
            abv: m.abv ? parseFloat(m.abv.toString()) : undefined,
            ph: m.ph ? parseFloat(m.ph.toString()) : undefined,
            totalAcidity: m.totalAcidity
              ? parseFloat(m.totalAcidity.toString())
              : undefined,
            temperature: m.temperature
              ? parseFloat(m.temperature.toString())
              : undefined,
            volume: m.volume ? parseFloat(m.volume.toString()) : undefined,
            volumeUnit: m.volumeUnit,
          })),
          additives: additives.map((a) => ({
            ...a,
            amount: parseFloat(a.amount.toString()),
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting batch history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get batch history",
        });
      }
    }),

  /**
   * Add measurement to batch
   */
  addMeasurement: createRbacProcedure("create", "batch")
    .input(addMeasurementSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists
        const batchExists = await db
          .select({ id: batches.id })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batchExists.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Create measurement
        const newMeasurement = await db
          .insert(batchMeasurements)
          .values({
            batchId: input.batchId,
            measurementDate: input.measurementDate,
            specificGravity: input.specificGravity?.toString(),
            abv: input.abv?.toString(),
            ph: input.ph?.toString(),
            totalAcidity: input.totalAcidity?.toString(),
            temperature: input.temperature?.toString(),
            volume: input.volume?.toString(),
            volumeUnit: input.volumeUnit,
            notes: input.notes,
            takenBy: input.takenBy,
          })
          .returning();

        return {
          success: true,
          measurement: newMeasurement[0],
          message: "Measurement added successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error adding measurement:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add measurement",
        });
      }
    }),

  /**
   * Add additive to batch
   */
  addAdditive: createRbacProcedure("create", "batch")
    .input(addAdditiveSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists and get vessel ID, original gravity
        const batchData = await db
          .select({
            id: batches.id,
            vesselId: batches.vesselId,
            originalGravity: batches.originalGravity,
          })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batchData.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        if (!batchData[0].vesselId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Batch is not assigned to a vessel",
          });
        }

        // Create additive record
        const newAdditive = await db
          .insert(batchAdditives)
          .values({
            batchId: input.batchId,
            vesselId: batchData[0].vesselId,
            additiveType: input.additiveType,
            additiveName: input.additiveName,
            amount: input.amount.toString(),
            unit: input.unit,
            notes: input.notes,
            addedBy: input.addedBy,
            addedAt: input.addedAt || new Date(),
          })
          .returning();

        // If sugar is added, auto-create estimated measurement
        let estimatedMeasurement = null;
        if (input.additiveType === "Sugar & Sweeteners") {
          try {
            // Get most recent measurement for current SG and volume
            const recentMeasurement = await db
              .select({
                specificGravity: batchMeasurements.specificGravity,
                volume: batchMeasurements.volume,
                volumeUnit: batchMeasurements.volumeUnit,
                volumeLiters: batchMeasurements.volumeLiters,
              })
              .from(batchMeasurements)
              .where(
                and(
                  eq(batchMeasurements.batchId, input.batchId),
                  isNull(batchMeasurements.deletedAt),
                  sql`${batchMeasurements.specificGravity} IS NOT NULL`
                )
              )
              .orderBy(desc(batchMeasurements.measurementDate))
              .limit(1);

            if (!recentMeasurement.length || !recentMeasurement[0].specificGravity) {
              console.warn("No recent SG measurement found, skipping estimated measurement");
            } else {
              // Get volume - prefer volumeLiters, then convert from volume + unit
              let volumeL: number;
              if (recentMeasurement[0].volumeLiters) {
                volumeL = parseFloat(recentMeasurement[0].volumeLiters);
              } else if (recentMeasurement[0].volume && recentMeasurement[0].volumeUnit) {
                const vol = parseFloat(recentMeasurement[0].volume);
                volumeL = recentMeasurement[0].volumeUnit === "gal" ? vol * 3.78541 : vol;
              } else {
                console.warn("No volume data found in recent measurement, skipping estimated measurement");
                volumeL = 0;
              }

              if (volumeL > 0) {
                const currentSG = parseFloat(recentMeasurement[0].specificGravity);

                // Convert sugar amount to grams
                let sugarGrams: number;
                if (input.unit === "g/L") {
                  // If g/L, multiply by volume
                  sugarGrams = input.amount * volumeL;
                } else {
                  sugarGrams = convertSugarToGrams(input.amount, input.unit);
                }

                // Calculate estimated SG after sugar addition
                const estimatedSG = calculateEstimatedSGAfterAddition(
                  currentSG,
                  sugarGrams,
                  volumeL
                );

                // Calculate estimated ABV (assuming full fermentation)
                const originalGravity = batchData[0].originalGravity
                  ? parseFloat(batchData[0].originalGravity)
                  : currentSG; // Fallback to current SG if OG not available

                const estimatedABV = calculateEstimatedABV(
                  originalGravity,
                  currentSG,
                  sugarGrams,
                  volumeL,
                  true // Assume full fermentation
                );

                // Create estimated measurement
                const measurement = await db
                  .insert(batchMeasurements)
                  .values({
                    batchId: input.batchId,
                    measurementDate: input.addedAt || new Date(),
                    specificGravity: estimatedSG.toString(),
                    abv: estimatedABV.toString(),
                    volume: volumeL.toString(),
                    volumeUnit: "L",
                    volumeLiters: volumeL.toString(),
                    notes: `Estimated after adding ${input.amount}${input.unit} of ${input.additiveName}. Assumes full fermentation.`,
                    takenBy: "System (auto-calculated)",
                  })
                  .returning();

                estimatedMeasurement = measurement[0];
              }
            }
          } catch (error) {
            console.error("Error creating estimated measurement:", error);
            // Don't fail the additive creation if measurement fails
          }
        }

        return {
          success: true,
          additive: newAdditive[0],
          estimatedMeasurement,
          message: estimatedMeasurement
            ? "Additive added successfully with estimated SG/ABV"
            : "Additive added successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error adding additive:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add additive",
        });
      }
    }),

  /**
   * Update measurement
   */
  updateMeasurement: createRbacProcedure("update", "batch")
    .input(updateMeasurementSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify measurement exists
        const existingMeasurement = await db
          .select()
          .from(batchMeasurements)
          .where(
            and(
              eq(batchMeasurements.id, input.measurementId),
              isNull(batchMeasurements.deletedAt)
            )
          )
          .limit(1);

        if (!existingMeasurement.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Measurement not found",
          });
        }

        // Build update object
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.measurementDate) updateData.measurementDate = input.measurementDate;
        if (input.specificGravity !== undefined) updateData.specificGravity = input.specificGravity.toString();
        if (input.abv !== undefined) updateData.abv = input.abv.toString();
        if (input.ph !== undefined) updateData.ph = input.ph.toString();
        if (input.totalAcidity !== undefined) updateData.totalAcidity = input.totalAcidity.toString();
        if (input.temperature !== undefined) updateData.temperature = input.temperature.toString();
        if (input.volume !== undefined) updateData.volume = input.volume.toString();
        if (input.volumeUnit) updateData.volumeUnit = input.volumeUnit;
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.takenBy !== undefined) updateData.takenBy = input.takenBy;

        // Update measurement
        const updatedMeasurement = await db
          .update(batchMeasurements)
          .set(updateData)
          .where(eq(batchMeasurements.id, input.measurementId))
          .returning();

        return {
          success: true,
          measurement: updatedMeasurement[0],
          message: "Measurement updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating measurement:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update measurement",
        });
      }
    }),

  /**
   * Update additive
   */
  updateAdditive: createRbacProcedure("update", "batch")
    .input(updateAdditiveSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify additive exists
        const existingAdditive = await db
          .select()
          .from(batchAdditives)
          .where(
            and(
              eq(batchAdditives.id, input.additiveId),
              isNull(batchAdditives.deletedAt)
            )
          )
          .limit(1);

        if (!existingAdditive.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Additive not found",
          });
        }

        // Build update object
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.additiveType) updateData.additiveType = input.additiveType;
        if (input.additiveName) updateData.additiveName = input.additiveName;
        if (input.amount !== undefined) updateData.amount = input.amount.toString();
        if (input.unit) updateData.unit = input.unit;
        if (input.addedAt) updateData.addedAt = input.addedAt;
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.addedBy !== undefined) updateData.addedBy = input.addedBy;

        // Update additive
        const updatedAdditive = await db
          .update(batchAdditives)
          .set(updateData)
          .where(eq(batchAdditives.id, input.additiveId))
          .returning();

        return {
          success: true,
          additive: updatedAdditive[0],
          message: "Additive updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating additive:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update additive",
        });
      }
    }),

  /**
   * Update batch status and metadata
   */
  update: createRbacProcedure("update", "batch")
    .input(updateBatchSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists
        const existingBatch = await db
          .select()
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!existingBatch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Build update object
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.name) updateData.name = input.name;
        if (input.batchNumber) updateData.batchNumber = input.batchNumber;
        if (input.status) updateData.status = input.status;
        if (input.customName !== undefined)
          updateData.customName = input.customName;
        if (input.startDate) updateData.startDate = input.startDate;
        if (input.endDate) updateData.endDate = input.endDate;

        // Update batch
        const updatedBatch = await db
          .update(batches)
          .set(updateData)
          .where(eq(batches.id, input.batchId))
          .returning();

        return {
          success: true,
          batch: updatedBatch[0],
          message: "Batch updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update batch",
        });
      }
    }),

  /**
   * Get complete batch activity history
   * Returns all events related to this batch in chronological order
   */
  getActivityHistory: createRbacProcedure("read", "batch")
    .input(
      batchIdSchema.extend({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Get batch details including creation
        const batch = await db
          .select({
            id: batches.id,
            name: batches.name,
            customName: batches.customName,
            createdAt: batches.startDate,
            initialVolume: batches.initialVolume,
            initialVolumeUnit: batches.initialVolumeUnit,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            originPressRunId: batches.originPressRunId,
            pressRunName: pressRuns.pressRunName,
            pressRunVesselId: pressRuns.vesselId,
            pressRunVesselName: sql<string>`press_run_vessel.name`.as("pressRunVesselName"),
            originJuicePurchaseItemId: batches.originJuicePurchaseItemId,
            juiceType: juicePurchaseItems.juiceType,
            juiceVarietyName: juicePurchaseItems.varietyName,
            juiceVendorName: sql<string>`juice_vendor.name`.as("juiceVendorName"),
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .leftJoin(
            pressRuns,
            eq(batches.originPressRunId, pressRuns.id),
          )
          .leftJoin(
            sql`vessels AS press_run_vessel`,
            sql`press_run_vessel.id = ${pressRuns.vesselId}`,
          )
          .leftJoin(
            juicePurchaseItems,
            eq(batches.originJuicePurchaseItemId, juicePurchaseItems.id),
          )
          .leftJoin(
            juicePurchases,
            eq(juicePurchaseItems.purchaseId, juicePurchases.id),
          )
          .leftJoin(
            sql`vendors AS juice_vendor`,
            sql`juice_vendor.id = ${juicePurchases.vendorId}`,
          )
          .where(eq(batches.id, input.batchId))
          .limit(1);

        if (!batch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const activities: any[] = [];

        // Check for earliest transfer to determine true origin vessel
        const earliestTransfer = await db
          .select({
            sourceVesselName: sql<string>`source_vessel.name`,
            transferredAt: batchTransfers.transferredAt,
          })
          .from(batchTransfers)
          .leftJoin(
            sql`vessels AS source_vessel`,
            sql`source_vessel.id = ${batchTransfers.sourceVesselId}`,
          )
          .where(
            and(
              eq(batchTransfers.sourceBatchId, input.batchId),
              isNull(batchTransfers.deletedAt),
            ),
          )
          .orderBy(asc(batchTransfers.transferredAt))
          .limit(1);

        // Add batch creation event - handle press run or juice purchase origins
        // Use earliest transfer's source vessel if available, otherwise use current or press run vessel
        const creationVessel = earliestTransfer[0]?.sourceVesselName || batch[0].pressRunVesselName || batch[0].vesselName;

        let originDescription = "manual entry";
        if (batch[0].originPressRunId && batch[0].pressRunName) {
          originDescription = `Press Run ${batch[0].pressRunName}`;
        } else if (batch[0].originJuicePurchaseItemId) {
          const juiceLabel = batch[0].juiceType || batch[0].juiceVarietyName || "Purchased Juice";
          const vendorLabel = batch[0].juiceVendorName ? ` from ${batch[0].juiceVendorName}` : "";
          originDescription = `${juiceLabel}${vendorLabel}`;
        }

        activities.push({
          id: `creation-${batch[0].id}`,
          type: "creation",
          timestamp: batch[0].createdAt,
          description: `Batch created from ${originDescription}`,
          details:
            batch[0].initialVolume || creationVessel
              ? {
                  initialVolume: batch[0].initialVolume ? `${parseFloat(batch[0].initialVolume).toFixed(1)}${batch[0].initialVolumeUnit || 'L'}` : null,
                  vessel: creationVessel || null,
                }
              : {},
        });

        // Get measurements
        const measurements = await db
          .select({
            id: batchMeasurements.id,
            measurementDate: batchMeasurements.measurementDate,
            specificGravity: batchMeasurements.specificGravity,
            abv: batchMeasurements.abv,
            ph: batchMeasurements.ph,
            totalAcidity: batchMeasurements.totalAcidity,
            temperature: batchMeasurements.temperature,
            volume: batchMeasurements.volume,
            volumeUnit: batchMeasurements.volumeUnit,
            notes: batchMeasurements.notes,
            takenBy: batchMeasurements.takenBy,
          })
          .from(batchMeasurements)
          .where(
            and(
              eq(batchMeasurements.batchId, input.batchId),
              isNull(batchMeasurements.deletedAt),
            ),
          );

        measurements.forEach((m) => {
          const details = [];
          if (m.specificGravity) details.push(`SG: ${m.specificGravity}`);
          if (m.abv) details.push(`ABV: ${m.abv}%`);
          if (m.ph) details.push(`pH: ${m.ph}`);
          if (m.totalAcidity) details.push(`TA: ${m.totalAcidity}`);
          if (m.temperature) details.push(`Temp: ${m.temperature}°C`);
          if (m.volume) details.push(`Volume: ${m.volume}${m.volumeUnit || 'L'}`);

          activities.push({
            id: `measurement-${m.id}`,
            type: "measurement",
            timestamp: m.measurementDate,
            description: `Measurement taken${m.takenBy ? ` by ${m.takenBy}` : ""}`,
            details:
              details.length > 0 || m.notes
                ? {
                    values: details.length > 0 ? details.join(", ") : null,
                    notes: m.notes || null,
                  }
                : {},
            metadata: m, // Include full measurement object for editing
          });
        });

        // Get additives
        const additives = await db
          .select({
            id: batchAdditives.id,
            addedAt: batchAdditives.addedAt,
            additiveType: batchAdditives.additiveType,
            additiveName: batchAdditives.additiveName,
            amount: batchAdditives.amount,
            unit: batchAdditives.unit,
            notes: batchAdditives.notes,
            addedBy: batchAdditives.addedBy,
          })
          .from(batchAdditives)
          .where(
            and(
              eq(batchAdditives.batchId, input.batchId),
              isNull(batchAdditives.deletedAt),
            ),
          );

        additives.forEach((a) => {
          activities.push({
            id: `additive-${a.id}`,
            type: "additive",
            timestamp: a.addedAt,
            description: `${a.additiveType} added: ${a.additiveName}`,
            details: {
              amount: `${a.amount} ${a.unit}`,
              addedBy: a.addedBy || null,
              notes: a.notes || null,
            },
            metadata: a, // Include full additive object for editing
          });
        });

        // Get merge history
        const merges = await db
          .select({
            id: batchMergeHistory.id,
            mergedAt: batchMergeHistory.mergedAt,
            volumeAdded: batchMergeHistory.volumeAdded,
            volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
            targetVolumeBefore: batchMergeHistory.targetVolumeBefore,
            targetVolumeBeforeUnit: batchMergeHistory.targetVolumeBeforeUnit,
            targetVolumeAfter: batchMergeHistory.targetVolumeAfter,
            targetVolumeAfterUnit: batchMergeHistory.targetVolumeAfterUnit,
            sourceType: batchMergeHistory.sourceType,
            notes: batchMergeHistory.notes,
            pressRunName: pressRuns.pressRunName,
            juiceType: juicePurchaseItems.juiceType,
            juiceVarietyName: juicePurchaseItems.varietyName,
            juiceVendorName: sql<string>`merge_juice_vendor.name`.as("juiceVendorName"),
          })
          .from(batchMergeHistory)
          .leftJoin(
            pressRuns,
            eq(batchMergeHistory.sourcePressRunId, pressRuns.id),
          )
          .leftJoin(
            juicePurchaseItems,
            eq(batchMergeHistory.sourceJuicePurchaseItemId, juicePurchaseItems.id),
          )
          .leftJoin(
            juicePurchases,
            eq(juicePurchaseItems.purchaseId, juicePurchases.id),
          )
          .leftJoin(
            sql`vendors AS merge_juice_vendor`,
            sql`merge_juice_vendor.id = ${juicePurchases.vendorId}`,
          )
          .where(
            and(
              eq(batchMergeHistory.targetBatchId, input.batchId),
              isNull(batchMergeHistory.deletedAt),
            ),
          );

        merges.forEach((m) => {
          let sourceDescription = "another batch";
          if (m.sourceType === "press_run" && m.pressRunName) {
            sourceDescription = `Press Run ${m.pressRunName}`;
          } else if (m.sourceType === "juice_purchase") {
            const juiceLabel = m.juiceType || m.juiceVarietyName || "Purchased Juice";
            const vendorLabel = m.juiceVendorName ? ` from ${m.juiceVendorName}` : "";
            sourceDescription = `${juiceLabel}${vendorLabel}`;
          }

          activities.push({
            id: `merge-${m.id}`,
            type: "merge",
            timestamp: m.mergedAt,
            description: `Merged with juice from ${sourceDescription}`,
            details: {
              volumeAdded: `${m.volumeAdded}${m.volumeAddedUnit || 'L'}`,
              volumeChange: `${m.targetVolumeBefore}${m.targetVolumeBeforeUnit || 'L'} → ${m.targetVolumeAfter}${m.targetVolumeAfterUnit || 'L'}`,
              notes: m.notes || null,
            },
          });
        });

        // Get transfers (as source or destination)
        const transfers = await db
          .select({
            id: batchTransfers.id,
            transferredAt: batchTransfers.transferredAt,
            volumeTransferred: batchTransfers.volumeTransferred,
            volumeTransferredUnit: batchTransfers.volumeTransferredUnit,
            sourceBatchId: batchTransfers.sourceBatchId,
            destinationBatchId: batchTransfers.destinationBatchId,
            sourceBatchName: sql<string>`source_batch.name`.as(
              "sourceBatchName",
            ),
            destBatchName: sql<string>`dest_batch.name`.as("destBatchName"),
            sourceVesselName: sql<string>`source_vessel.name`.as(
              "sourceVesselName",
            ),
            destVesselName: sql<string>`dest_vessel.name`.as("destVesselName"),
            notes: batchTransfers.notes,
          })
          .from(batchTransfers)
          .leftJoin(
            sql`batches AS source_batch`,
            sql`source_batch.id = ${batchTransfers.sourceBatchId}`,
          )
          .leftJoin(
            sql`batches AS dest_batch`,
            sql`dest_batch.id = ${batchTransfers.destinationBatchId}`,
          )
          .leftJoin(
            sql`vessels AS source_vessel`,
            sql`source_vessel.id = ${batchTransfers.sourceVesselId}`,
          )
          .leftJoin(
            sql`vessels AS dest_vessel`,
            sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`,
          )
          .where(
            and(
              or(
                eq(batchTransfers.sourceBatchId, input.batchId),
                eq(batchTransfers.destinationBatchId, input.batchId),
              ),
              isNull(batchTransfers.deletedAt),
            ),
          );

        transfers.forEach((t) => {
          // Check if this is a vessel move (same batch moved) or traditional transfer (different batches)
          const isSameBatch = t.sourceBatchId === t.destinationBatchId;
          const isThisBatch =
            t.sourceBatchId === input.batchId ||
            t.destinationBatchId === input.batchId;

          if (isSameBatch) {
            // Vessel move: batch moved from one vessel to another
            activities.push({
              id: `transfer-${t.id}`,
              type: "transfer",
              timestamp: t.transferredAt,
              description: `Moved ${t.volumeTransferred}${t.volumeTransferredUnit || 'L'} from ${t.sourceVesselName || "vessel"} to ${t.destVesselName || "vessel"}`,
              details: {
                volume: `${t.volumeTransferred}${t.volumeTransferredUnit || 'L'}`,
                fromVessel: t.sourceVesselName || null,
                toVessel: t.destVesselName || null,
                notes: t.notes || null,
              },
            });
          } else {
            // Traditional transfer: different batches involved
            const isSource = t.sourceBatchId === input.batchId;
            activities.push({
              id: `transfer-${t.id}`,
              type: "transfer",
              timestamp: t.transferredAt,
              description: isSource
                ? `Transferred ${t.volumeTransferred}${t.volumeTransferredUnit || 'L'} to ${t.destVesselName || "vessel"}`
                : `Received ${t.volumeTransferred}${t.volumeTransferredUnit || 'L'} from ${t.sourceVesselName || "vessel"}`,
              details: {
                volume: `${t.volumeTransferred}${t.volumeTransferredUnit || 'L'}`,
                direction: isSource ? "outgoing" : "incoming",
                notes: t.notes || null,
              },
            });
          }
        });

        // Get racking operations
        const rackingOps = await db
          .select({
            id: batchRackingOperations.id,
            rackedAt: batchRackingOperations.rackedAt,
            sourceVesselId: batchRackingOperations.sourceVesselId,
            destinationVesselId: batchRackingOperations.destinationVesselId,
            sourceVesselName: sql<string>`source_vessel.name`.as("sourceVesselName"),
            destVesselName: sql<string>`dest_vessel.name`.as("destVesselName"),
            volumeBefore: batchRackingOperations.volumeBefore,
            volumeBeforeUnit: batchRackingOperations.volumeBeforeUnit,
            volumeAfter: batchRackingOperations.volumeAfter,
            volumeAfterUnit: batchRackingOperations.volumeAfterUnit,
            volumeLoss: batchRackingOperations.volumeLoss,
            volumeLossUnit: batchRackingOperations.volumeLossUnit,
            rackedBy: batchRackingOperations.rackedBy,
          })
          .from(batchRackingOperations)
          .leftJoin(
            sql`vessels AS source_vessel`,
            sql`source_vessel.id = ${batchRackingOperations.sourceVesselId}`,
          )
          .leftJoin(
            sql`vessels AS dest_vessel`,
            sql`dest_vessel.id = ${batchRackingOperations.destinationVesselId}`,
          )
          .where(
            and(
              eq(batchRackingOperations.batchId, input.batchId),
              isNull(batchRackingOperations.deletedAt),
            ),
          );

        rackingOps.forEach((r) => {
          activities.push({
            id: `rack-${r.id}`,
            type: "rack",
            timestamp: r.rackedAt,
            description: `Racked from ${r.sourceVesselName || "vessel"} to ${r.destVesselName || "vessel"}`,
            details: {
              volumeBefore: `${r.volumeBefore}${r.volumeBeforeUnit || 'L'}`,
              volumeAfter: `${r.volumeAfter}${r.volumeAfterUnit || 'L'}`,
              volumeLoss: `${r.volumeLoss}${r.volumeLossUnit || 'L'}`,
              lossPercentage: `${((parseFloat(r.volumeLoss) / parseFloat(r.volumeBefore)) * 100).toFixed(1)}%`,
              fromVessel: r.sourceVesselName || null,
              toVessel: r.destVesselName || null,
            },
          });
        });

        // Get filter operations
        const filterOps = await db
          .select({
            id: batchFilterOperations.id,
            filteredAt: batchFilterOperations.filteredAt,
            filterType: batchFilterOperations.filterType,
            volumeBefore: batchFilterOperations.volumeBefore,
            volumeBeforeUnit: batchFilterOperations.volumeBeforeUnit,
            volumeAfter: batchFilterOperations.volumeAfter,
            volumeAfterUnit: batchFilterOperations.volumeAfterUnit,
            volumeLoss: batchFilterOperations.volumeLoss,
            filteredBy: batchFilterOperations.filteredBy,
          })
          .from(batchFilterOperations)
          .where(
            and(
              eq(batchFilterOperations.batchId, input.batchId),
              isNull(batchFilterOperations.deletedAt),
            ),
          );

        filterOps.forEach((f) => {
          activities.push({
            id: `filter-${f.id}`,
            type: "filter",
            timestamp: f.filteredAt,
            description: `Filtered with ${f.filterType} filter${f.filteredBy ? ` by ${f.filteredBy}` : ""}`,
            details: {
              filterType: f.filterType,
              volumeBefore: `${f.volumeBefore}${f.volumeBeforeUnit || 'L'}`,
              volumeAfter: `${f.volumeAfter}${f.volumeAfterUnit || 'L'}`,
              volumeLoss: `${f.volumeLoss}L`,
              lossPercentage: `${((parseFloat(f.volumeLoss) / parseFloat(f.volumeBefore)) * 100).toFixed(1)}%`,
            },
          });
        });

        // Get carbonation operations
        const carbonationOps = await db
          .select({
            id: batchCarbonationOperations.id,
            startedAt: batchCarbonationOperations.startedAt,
            completedAt: batchCarbonationOperations.completedAt,
            carbonationProcess: batchCarbonationOperations.carbonationProcess,
            targetCo2Volumes: batchCarbonationOperations.targetCo2Volumes,
            finalCo2Volumes: batchCarbonationOperations.finalCo2Volumes,
            pressureApplied: batchCarbonationOperations.pressureApplied,
            startingVolume: batchCarbonationOperations.startingVolume,
            startingVolumeUnit: batchCarbonationOperations.startingVolumeUnit,
          })
          .from(batchCarbonationOperations)
          .where(
            and(
              eq(batchCarbonationOperations.batchId, input.batchId),
              isNull(batchCarbonationOperations.deletedAt),
            ),
          );

        carbonationOps.forEach((c) => {
          // Add start event
          activities.push({
            id: `carbonation-start-${c.id}`,
            type: "carbonation",
            timestamp: c.startedAt,
            description: `Started ${c.carbonationProcess} carbonation to ${c.targetCo2Volumes} volumes CO₂`,
            details: {
              process: c.carbonationProcess,
              targetCo2: `${c.targetCo2Volumes} volumes`,
              pressure: `${c.pressureApplied} PSI`,
              volume: `${c.startingVolume}${c.startingVolumeUnit || 'L'}`,
            },
          });

          // Add completion event if completed
          if (c.completedAt && c.finalCo2Volumes) {
            activities.push({
              id: `carbonation-complete-${c.id}`,
              type: "carbonation",
              timestamp: c.completedAt,
              description: `Completed carbonation at ${c.finalCo2Volumes} volumes CO₂`,
              details: {
                finalCo2: `${c.finalCo2Volumes} volumes`,
                targetCo2: `${c.targetCo2Volumes} volumes (target)`,
              },
            });
          }
        });

        // Get bottle runs
        const bottles = await db
          .select({
            id: bottleRuns.id,
            packagedAt: bottleRuns.packagedAt,
            unitsProduced: bottleRuns.unitsProduced,
            packageSizeML: bottleRuns.packageSizeML,
            volumeTaken: bottleRuns.volumeTaken,
            volumeTakenUnit: bottleRuns.volumeTakenUnit,
            status: bottleRuns.status,
            pasteurizedAt: bottleRuns.pasteurizedAt,
            pasteurizationTemperatureCelsius: bottleRuns.pasteurizationTemperatureCelsius,
            pasteurizationTimeMinutes: bottleRuns.pasteurizationTimeMinutes,
            pasteurizationUnits: bottleRuns.pasteurizationUnits,
            labeledAt: bottleRuns.labeledAt,
          })
          .from(bottleRuns)
          .where(
            and(
              eq(bottleRuns.batchId, input.batchId),
              eq(bottleRuns.status, "completed"),
            ),
          );

        bottles.forEach((b) => {
          // Add bottling event
          activities.push({
            id: `bottling-${b.id}`,
            type: "bottling",
            timestamp: b.packagedAt,
            description: `Bottled ${b.unitsProduced} units (${b.packageSizeML}mL)`,
            details: {
              unitsProduced: b.unitsProduced,
              packageSize: `${b.packageSizeML}mL`,
              volumeTaken: `${b.volumeTaken}${b.volumeTakenUnit || 'L'}`,
            },
          });

          // Add pasteurization event if pasteurized
          if (b.pasteurizedAt) {
            activities.push({
              id: `pasteurize-${b.id}`,
              type: "pasteurize",
              timestamp: b.pasteurizedAt,
              description: `Pasteurized at ${b.pasteurizationTemperatureCelsius}°C for ${b.pasteurizationTimeMinutes} min (${b.pasteurizationUnits} PU)`,
              details: {
                temperature: `${b.pasteurizationTemperatureCelsius}°C`,
                time: `${b.pasteurizationTimeMinutes} min`,
                pasteurizationUnits: `${b.pasteurizationUnits} PU`,
              },
            });
          }

          // Add labeling event if labeled
          if (b.labeledAt) {
            activities.push({
              id: `label-${b.id}`,
              type: "label",
              timestamp: b.labeledAt,
              description: `Labels applied to bottle run`,
              details: {
                unitsLabeled: b.unitsProduced,
              },
            });
          }
        });

        // Get keg fills
        const kegFillsList = await db
          .select({
            id: kegFills.id,
            filledAt: kegFills.filledAt,
            volumeTaken: kegFills.volumeTaken,
            volumeTakenUnit: kegFills.volumeTakenUnit,
            status: kegFills.status,
            kegNumber: kegs.kegNumber,
            kegType: kegs.kegType,
          })
          .from(kegFills)
          .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
          .where(
            and(
              eq(kegFills.batchId, input.batchId),
              sql`${kegFills.status} != 'voided'`,
            ),
          );

        kegFillsList.forEach((k) => {
          activities.push({
            id: `keg-fill-${k.id}`,
            type: "bottling", // Use "bottling" type for UI consistency
            timestamp: k.filledAt,
            description: `Filled keg ${k.kegNumber} (${k.kegType})`,
            details: {
              kegNumber: k.kegNumber,
              kegType: k.kegType,
              volumeTaken: `${k.volumeTaken}${k.volumeTakenUnit || 'L'}`,
              status: k.status,
            },
          });
        });

        // Sort all activities by timestamp - true chronological order (oldest to newest)
        activities.sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateA - dateB; // Oldest first (chronological order)
        });

        // Apply pagination
        const totalActivities = activities.length;
        const paginatedActivities = activities.slice(
          input.offset,
          input.offset + input.limit,
        );

        return {
          batch: batch[0],
          activities: paginatedActivities,
          pagination: {
            total: totalActivities,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < totalActivities,
          },
        };
      } catch (error) {
        console.error("Error fetching batch activity history:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch batch activity history",
        });
      }
    }),

  /**
   * Get batch merge history
   * Returns array of merge events for this batch
   */
  getMergeHistory: createRbacProcedure("read", "batch")
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        const mergeHistory = await db
          .select({
            id: batchMergeHistory.id,
            sourcePressRunId: batchMergeHistory.sourcePressRunId,
            sourceType: batchMergeHistory.sourceType,
            volumeAdded: batchMergeHistory.volumeAdded,
            volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
            targetVolumeBefore: batchMergeHistory.targetVolumeBefore,
            targetVolumeBeforeUnit: batchMergeHistory.targetVolumeBeforeUnit,
            targetVolumeAfter: batchMergeHistory.targetVolumeAfter,
            targetVolumeAfterUnit: batchMergeHistory.targetVolumeAfterUnit,
            compositionSnapshot: batchMergeHistory.compositionSnapshot,
            notes: batchMergeHistory.notes,
            mergedAt: batchMergeHistory.mergedAt,
            pressRunName: pressRuns.pressRunName,
          })
          .from(batchMergeHistory)
          .leftJoin(
            pressRuns,
            eq(batchMergeHistory.sourcePressRunId, pressRuns.id),
          )
          .where(
            and(
              eq(batchMergeHistory.targetBatchId, input.batchId),
              isNull(batchMergeHistory.deletedAt),
            ),
          )
          .orderBy(desc(batchMergeHistory.mergedAt));

        return {
          mergeHistory,
        };
      } catch (error) {
        console.error("Error fetching batch merge history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch batch merge history",
        });
      }
    }),

  /**
   * Filter batch - Record filtering operation with volume loss
   * Only available for batches in aging status
   */
  filter: createRbacProcedure("create", "batch")
    .input(filterBatchSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists and get current state
        const batchData = await db
          .select({
            id: batches.id,
            status: batches.status,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
            vesselId: batches.vesselId,
          })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batchData.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batch = batchData[0];

        // Verify batch is in correct vessel
        if (batch.vesselId !== input.vesselId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Batch is not in the specified vessel",
          });
        }

        // Verify vessel is in use
        const vesselData = await db
          .select({ status: vessels.status })
          .from(vessels)
          .where(eq(vessels.id, input.vesselId))
          .limit(1);

        if (!vesselData.length || vesselData[0].status !== "available") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Filtering is only available when vessel is available (current status: ${vesselData[0]?.status || 'unknown'})`,
          });
        }

        // Calculate volume loss (in liters for consistency)
        const volumeBeforeL = convertToLiters(
          input.volumeBefore,
          input.volumeBeforeUnit as "L" | "gal" | "mL"
        );
        const volumeAfterL = convertToLiters(
          input.volumeAfter,
          input.volumeAfterUnit as "L" | "gal" | "mL"
        );
        const volumeLossL = volumeBeforeL - volumeAfterL;

        // Create filter operation record
        const filterOperation = await db
          .insert(batchFilterOperations)
          .values({
            batchId: input.batchId,
            vesselId: input.vesselId,
            filterType: input.filterType,
            volumeBefore: input.volumeBefore.toString(),
            volumeBeforeUnit: input.volumeBeforeUnit,
            volumeAfter: input.volumeAfter.toString(),
            volumeAfterUnit: input.volumeAfterUnit,
            volumeLoss: volumeLossL.toFixed(3),
            filteredAt: input.filteredAt || new Date(),
            filteredBy: input.filteredBy,
          })
          .returning();

        // Update batch current volume
        await db
          .update(batches)
          .set({
            currentVolume: volumeAfterL.toFixed(3),
            currentVolumeUnit: 'L',
            updatedAt: new Date(),
          })
          .where(eq(batches.id, input.batchId));

        return {
          success: true,
          filterOperation: filterOperation[0],
          volumeLoss: volumeLossL,
          message: `Batch filtered with ${input.filterType} filter. Loss: ${volumeLossL.toFixed(2)}L`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error filtering batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to filter batch",
        });
      }
    }),

  /**
   * Rack a batch to a different vessel
   * Records the racking operation with volume loss tracking
   */
  rackBatch: createRbacProcedure("update", "batch")
    .input(
      z.object({
        batchId: z.string().uuid("Invalid batch ID"),
        destinationVesselId: z.string().uuid("Invalid destination vessel ID"),
        volumeAfter: z.number().positive("Volume after must be positive"),
        volumeAfterUnit: z.enum(['L', 'gal']).default('L'),
        volumeToRack: z.number().positive("Volume to rack must be positive").optional(), // For partial racking
        rackedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Get current batch and verify it exists
          const batch = await tx
            .select({
              id: batches.id,
              vesselId: batches.vesselId,
              name: batches.name,
              customName: batches.customName,
              batchNumber: batches.batchNumber,
              currentVolume: batches.currentVolume,
              currentVolumeUnit: batches.currentVolumeUnit,
              status: batches.status,
              originalGravity: batches.originalGravity,
              finalGravity: batches.finalGravity,
              estimatedAbv: batches.estimatedAbv,
              actualAbv: batches.actualAbv,
              originPressRunId: batches.originPressRunId,
              originJuicePurchaseItemId: batches.originJuicePurchaseItemId,
            })
            .from(batches)
            .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
            .limit(1);

          if (!batch.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found",
            });
          }

          if (!batch[0].vesselId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Batch must be assigned to a vessel before racking",
            });
          }

          // 2. Verify destination vessel exists
          const destinationVessel = await tx
            .select({
              id: vessels.id,
              name: vessels.name,
              status: vessels.status,
              capacity: vessels.capacity,
              capacityUnit: vessels.capacityUnit,
            })
            .from(vessels)
            .where(
              and(
                eq(vessels.id, input.destinationVesselId),
                isNull(vessels.deletedAt)
              )
            )
            .limit(1);

          if (!destinationVessel.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Destination vessel not found",
            });
          }

          // Check for existing batch in destination vessel
          const destinationBatch = await tx
            .select({
              id: batches.id,
              name: batches.name,
              customName: batches.customName,
              currentVolume: batches.currentVolume,
              currentVolumeUnit: batches.currentVolumeUnit,
              status: batches.status,
            })
            .from(batches)
            .where(
              and(
                eq(batches.vesselId, input.destinationVesselId),
                isNull(batches.deletedAt)
              )
            )
            .limit(1);

          const hasBatchInDestination = destinationBatch.length > 0;

          const sourceVesselId = batch[0].vesselId;
          const isRackToSelf = sourceVesselId === input.destinationVesselId;

          // Convert volumes to liters for calculations
          const volumeAfterL = convertToLiters(
            input.volumeAfter,
            input.volumeAfterUnit as "L" | "gal" | "mL"
          );
          const volumeBeforeL = batch[0].currentVolume
            ? parseFloat(batch[0].currentVolume)
            : 0;

          // 3. Determine if this is a partial rack
          const isPartialRack = input.volumeToRack && input.volumeToRack < volumeBeforeL;

          // For partial racking: volumeToRack is what moves, volumeAfter is what arrives (after loss)
          // For full racking: volumeAfter is what remains after loss
          let volumeLossL: number;
          let volumeRackedL: number; // Amount that goes to destination
          let volumeRemainingInSourceL: number; // Amount that stays in source (for partial racks)

          if (isPartialRack && input.volumeToRack) {
            // Partial rack: split the batch
            volumeRackedL = input.volumeToRack; // User-specified amount to rack
            volumeLossL = volumeRackedL - volumeAfterL; // Loss during the rack
            volumeRemainingInSourceL = volumeBeforeL - volumeRackedL; // What stays behind

            // Validate volumeToRack is not greater than current volume
            if (volumeRackedL > volumeBeforeL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Volume to rack (${volumeRackedL.toFixed(1)}L) cannot be greater than current volume (${volumeBeforeL.toFixed(1)}L)`,
              });
            }

            // Validate volumeAfter is not greater than volumeToRack
            if (volumeAfterL > volumeRackedL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Volume after racking (${volumeAfterL.toFixed(1)}L) cannot be greater than volume to rack (${volumeRackedL.toFixed(1)}L)`,
              });
            }
          } else {
            // Full rack: entire batch moves
            volumeRackedL = volumeBeforeL;
            volumeLossL = volumeBeforeL - volumeAfterL;
            volumeRemainingInSourceL = 0;

            // Validate that volumeAfter is not greater than volumeBefore
            if (volumeAfterL > volumeBeforeL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Volume after racking (${volumeAfterL.toFixed(1)}L) cannot be greater than current volume (${volumeBeforeL.toFixed(1)}L)`,
              });
            }
          }

          // Validate that loss is not negative
          if (volumeLossL < 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Calculated volume loss is negative. This should not happen.`,
            });
          }

          // 4. Record the racking operation
          const rackingOperation = await tx
            .insert(batchRackingOperations)
            .values({
              batchId: input.batchId,
              sourceVesselId: sourceVesselId,
              destinationVesselId: input.destinationVesselId,
              volumeBefore: volumeBeforeL.toString(),
              volumeBeforeUnit: 'L',
              volumeAfter: volumeAfterL.toString(),
              volumeAfterUnit: 'L',
              volumeLoss: volumeLossL.toString(),
              volumeLossUnit: 'L',
              rackedAt: input.rackedAt || new Date(),
              rackedBy: ctx.session?.user?.id,
            })
            .returning();

          let updatedBatch;
          let newChildBatch; // For partial racks
          let resultMessage: string;

          if (isPartialRack) {
            // 5a. PARTIAL RACK: Split batch - create child batch in destination, reduce source batch volume
            // Partial racking to self doesn't make sense
            if (isRackToSelf) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Partial racking to the same vessel is not supported. Use full racking to record volume loss.",
              });
            }

            // Generate child batch name (e.g., "Batch #25 - Racked 2025-01-09")
            const rackDate = input.rackedAt || new Date();
            const dateStr = rackDate.toISOString().split('T')[0];
            const childBatchName = `${batch[0].name} - Racked ${dateStr}`;

            // Create child batch in destination vessel with racked volume
            const newBatch = await tx
              .insert(batches)
              .values({
                vesselId: input.destinationVesselId,
                name: childBatchName,
                customName: batch[0].customName ? `${batch[0].customName} - Racked ${dateStr}` : null,
                batchNumber: `${batch[0].batchNumber}-R${dateStr.replace(/-/g, '')}`, // e.g., "25-R20250109"
                initialVolume: volumeAfterL.toString(),
                initialVolumeUnit: 'L',
                currentVolume: volumeAfterL.toString(),
                currentVolumeUnit: 'L',
                status: "aging", // Racked batches start in aging
                startDate: rackDate,
                originPressRunId: batch[0].originPressRunId,
                originJuicePurchaseItemId: batch[0].originJuicePurchaseItemId,
                originalGravity: batch[0].originalGravity,
                finalGravity: batch[0].finalGravity,
                estimatedAbv: batch[0].estimatedAbv,
                actualAbv: batch[0].actualAbv,
              })
              .returning();

            newChildBatch = newBatch[0];

            // Update source batch - reduce volume, stay in source vessel
            updatedBatch = await tx
              .update(batches)
              .set({
                currentVolume: volumeRemainingInSourceL.toString(),
                currentVolumeUnit: 'L',
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))
              .returning();

            // Create batch transfer record
            await tx
              .insert(batchTransfers)
              .values({
                sourceBatchId: input.batchId,
                sourceVesselId: sourceVesselId,
                destinationBatchId: newChildBatch.id,
                destinationVesselId: input.destinationVesselId,
                volumeTransferred: volumeAfterL.toString(),
                volumeTransferredUnit: 'L',
                loss: volumeLossL.toString(),
                lossUnit: 'L',
                totalVolumeProcessed: volumeRackedL.toString(),
                totalVolumeProcessedUnit: 'L',
                notes: `Partial rack: ${volumeAfterL.toFixed(1)}L transferred, ${volumeRemainingInSourceL.toFixed(1)}L remaining in source`,
                transferredAt: rackDate,
                transferredBy: ctx.session?.user?.id,
              });

            resultMessage = `Partial rack complete: ${volumeAfterL.toFixed(1)}L transferred to ${destinationVessel[0].name}, ${volumeRemainingInSourceL.toFixed(1)}L remaining in source vessel`;
          } else if (isRackToSelf) {
            // 5a. RACK TO SELF: Update volume and transition to aging, don't change vessel
            updatedBatch = await tx
              .update(batches)
              .set({
                currentVolume: volumeAfterL.toString(),
                currentVolumeUnit: 'L',
                status: "aging", // Racking transitions to aging stage
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))
              .returning();

            resultMessage = `Batch racked to itself in ${destinationVessel[0].name}. Sediment removed, volume loss recorded.`;
          } else if (hasBatchInDestination) {
            // 5b. MERGE: Add volume to existing destination batch, then mark source batch as completed
            const destBatch = destinationBatch[0];
            const destCurrentVolumeL = parseFloat(destBatch.currentVolume || "0");
            const mergedVolumeL = destCurrentVolumeL + volumeAfterL;

            // Update destination batch with merged volume
            updatedBatch = await tx
              .update(batches)
              .set({
                currentVolume: mergedVolumeL.toString(),
                currentVolumeUnit: 'L',
                updatedAt: new Date(),
              })
              .where(eq(batches.id, destBatch.id))
              .returning();

            // Mark source batch as completed (not deleted - preserve history)
            await tx
              .update(batches)
              .set({
                vesselId: null, // Remove vessel assignment
                status: "completed",
                currentVolume: "0",
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));

            // Create batch transfer record for merge
            await tx
              .insert(batchTransfers)
              .values({
                sourceBatchId: input.batchId,
                sourceVesselId: sourceVesselId,
                destinationBatchId: destBatch.id,
                destinationVesselId: input.destinationVesselId,
                volumeTransferred: volumeAfterL.toString(),
                volumeTransferredUnit: 'L',
                loss: volumeLossL.toString(),
                lossUnit: 'L',
                totalVolumeProcessed: volumeBeforeL.toString(),
                totalVolumeProcessedUnit: 'L',
                notes: 'Racking merge operation',
                transferredAt: input.rackedAt || new Date(),
                transferredBy: ctx.session?.user?.id,
              });

            resultMessage = `Batch racked and merged into ${destBatch.customName || destBatch.name} in ${destinationVessel[0].name}`;
          } else {
            // 5c. MOVE: Transfer batch to new empty vessel
            // Racking transitions batch from "fermentation" to "aging"
            updatedBatch = await tx
              .update(batches)
              .set({
                vesselId: input.destinationVesselId,
                currentVolume: volumeAfterL.toString(),
                currentVolumeUnit: 'L',
                status: "aging", // Racking always moves batch to aging stage
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))
              .returning();

            resultMessage = `Batch racked to ${destinationVessel[0].name}`;
          }

          // 6. Update source vessel status to cleaning (only if full rack and not rack-to-self)
          // For partial racks, batch stays in source vessel, so don't update status
          if (!isRackToSelf && !isPartialRack) {
            await tx
              .update(vessels)
              .set({
                status: "cleaning",
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, sourceVesselId));
          }

          // 7. Update destination vessel status (only if not rack-to-self and doesn't have batch already)
          if (!isRackToSelf && !hasBatchInDestination) {
            await tx
              .update(vessels)
              .set({
                status: "available",
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.destinationVesselId));
          }

          return {
            success: true,
            message: resultMessage,
            rackingOperation: rackingOperation[0],
            batch: updatedBatch[0],
            childBatch: newChildBatch, // Include child batch for partial racks
            merged: hasBatchInDestination,
            isPartialRack,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error racking batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rack batch",
        });
      }
    }),

  /**
   * Transfer juice from purchase to tank
   * Creates new batch if vessel empty, or merges with existing batch
   * Cache-bust: 2025-10-11-v2
   */
  transferJuiceToTank: createRbacProcedure("create", "batch")
    .input(transferJuiceToTankSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Validate juice purchase item and get details
          const juiceItem = await tx
            .select({
              id: juicePurchaseItems.id,
              purchaseId: juicePurchaseItems.purchaseId,
              juiceType: juicePurchaseItems.juiceType,
              varietyName: juicePurchaseItems.varietyName,
              volume: juicePurchaseItems.volume,
              volumeUnit: juicePurchaseItems.volumeUnit,
              volumeAllocated: juicePurchaseItems.volumeAllocated,
              vendorId: juicePurchases.vendorId,
              vendorName: sql<string>`vendors.name`.as("vendorName"),
              brix: juicePurchaseItems.brix,
              ph: juicePurchaseItems.ph,
              specificGravity: juicePurchaseItems.specificGravity,
              totalCost: juicePurchaseItems.totalCost,
            })
            .from(juicePurchaseItems)
            .leftJoin(
              juicePurchases,
              eq(juicePurchaseItems.purchaseId, juicePurchases.id)
            )
            .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
            .where(
              and(
                eq(juicePurchaseItems.id, input.juicePurchaseItemId),
                isNull(juicePurchaseItems.deletedAt)
              )
            )
            .limit(1);

          if (!juiceItem.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Juice purchase item not found",
            });
          }

          const juice = juiceItem[0];
          console.log("🧃 Juice purchase item data:", {
            id: juice.id,
            volume: juice.volume,
            volumeUnit: juice.volumeUnit,
            volumeAllocated: juice.volumeAllocated,
          });

          const totalVolumeL = parseFloat(juice.volume || "0");
          const allocatedVolumeL = parseFloat(juice.volumeAllocated || "0");
          const availableVolumeL = totalVolumeL - allocatedVolumeL;

          console.log("📊 Volume calculation:", {
            totalVolumeL,
            allocatedVolumeL,
            availableVolumeL,
          });

          // Convert transfer volume to liters for comparison
          const transferVolumeL = convertToLiters(
            input.volumeToTransfer,
            input.volumeUnit as "L" | "gal" | "mL"
          );

          if (transferVolumeL > availableVolumeL) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient juice available. Available: ${availableVolumeL.toFixed(2)}L (Total: ${totalVolumeL.toFixed(2)}L, Allocated: ${allocatedVolumeL.toFixed(2)}L), Requested: ${transferVolumeL.toFixed(2)}L`,
            });
          }

          // 2. Get vessel details and check if it has an active batch
          const vesselData = await tx
            .select({
              id: vessels.id,
              name: vessels.name,
              status: vessels.status,
            })
            .from(vessels)
            .where(
              and(eq(vessels.id, input.vesselId), isNull(vessels.deletedAt))
            )
            .limit(1);

          if (!vesselData.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vessel not found",
            });
          }

          const vessel = vesselData[0];

          // Check for existing batch in vessel
          const existingBatch = await tx
            .select({
              id: batches.id,
              name: batches.name,
              currentVolume: batches.currentVolume,
              currentVolumeUnit: batches.currentVolumeUnit,
              status: batches.status,
            })
            .from(batches)
            .where(
              and(
                eq(batches.vesselId, input.vesselId),
                isNull(batches.deletedAt)
              )
            )
            .limit(1);

          let batchId: string;
          let batchName: string;
          let isNewBatch = false;

          if (existingBatch.length === 0) {
            // 3a. Create new batch
            // Generate unique batch name with timestamp to avoid collisions
            const baseDate = input.transferDate.toISOString().slice(0, 10);
            const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
            const newBatchName = `${juice.juiceType || juice.varietyName || "JUICE"}-${baseDate}-${vessel.name}-${timestamp}`;

            console.log("🏭 Creating new batch with originJuicePurchaseItemId:", input.juicePurchaseItemId);

            const newBatch = await tx
              .insert(batches)
              .values({
                vesselId: input.vesselId,
                name: newBatchName,
                batchNumber: newBatchName,
                initialVolume: transferVolumeL.toString(),
                initialVolumeUnit: "L",
                currentVolume: transferVolumeL.toString(),
                currentVolumeUnit: "L",
                status: "fermentation",
                startDate: input.transferDate,
                originJuicePurchaseItemId: input.juicePurchaseItemId,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            console.log("✅ Batch created:", {
              batchId: newBatch[0].id,
              batchName: newBatch[0].name,
              originJuicePurchaseItemId: newBatch[0].originJuicePurchaseItemId,
            });

            batchId = newBatch[0].id;
            batchName = newBatch[0].name;
            isNewBatch = true;

            // Create batch composition entry for the juice
            await tx.insert(batchCompositions).values({
              batchId: batchId,
              sourceType: "juice_purchase",
              juicePurchaseItemId: input.juicePurchaseItemId,
              vendorId: juice.vendorId!,
              inputWeightKg: "0", // Juice has no weight input, only volume
              juiceVolume: transferVolumeL.toString(),
              juiceVolumeUnit: "L",
              fractionOfBatch: "1.0", // New batch, so this juice is 100% of the batch
              materialCost: juice.totalCost?.toString() || "0",
              avgBrix: juice.brix?.toString(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            console.log("✅ Batch composition created for juice purchase");

            // Create initial measurements from juice purchase if pH or SG exist
            if (juice.ph || juice.specificGravity) {
              await tx.insert(batchMeasurements).values({
                batchId: batchId,
                measurementDate: input.transferDate,
                ph: juice.ph?.toString(),
                specificGravity: juice.specificGravity?.toString(),
                notes: "Initial measurements from juice purchase",
                volumeUnit: "L",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              console.log("✅ Initial batch measurements created from juice purchase");
            }

            // Vessel status remains as-is when batch is assigned
            // The presence of a batch is tracked via the batch.vesselId relationship
          } else {
            // 3b. Merge with existing batch - add volumes together and recalculate composition
            const batch = existingBatch[0];
            batchId = batch.id;
            batchName = batch.name;

            const currentVolumeL = parseFloat(batch.currentVolume || "0");
            const newVolumeL = currentVolumeL + transferVolumeL;

            // Update batch volume
            await tx
              .update(batches)
              .set({
                currentVolume: newVolumeL.toString(),
                currentVolumeUnit: "L",
                updatedAt: new Date(),
              })
              .where(eq(batches.id, batchId));

            // Create merge history entry
            await tx.insert(batchMergeHistory).values({
              targetBatchId: batchId,
              sourceJuicePurchaseItemId: input.juicePurchaseItemId,
              sourceType: "juice_purchase",
              volumeAdded: transferVolumeL.toString(),
              volumeAddedUnit: "L",
              targetVolumeBefore: currentVolumeL.toString(),
              targetVolumeBeforeUnit: "L",
              targetVolumeAfter: newVolumeL.toString(),
              targetVolumeAfterUnit: "L",
              notes: input.notes,
              mergedAt: input.transferDate,
              mergedBy: ctx.session?.user?.id,
              createdAt: new Date(),
            });

            // Create batch composition entry for the merged juice
            // Calculate fraction based on this juice's volume relative to final batch volume
            const fractionOfBatch = transferVolumeL / newVolumeL;

            await tx.insert(batchCompositions).values({
              batchId: batchId,
              sourceType: "juice_purchase",
              juicePurchaseItemId: input.juicePurchaseItemId,
              vendorId: juice.vendorId!,
              inputWeightKg: "0", // Juice has no weight input, only volume
              juiceVolume: transferVolumeL.toString(),
              juiceVolumeUnit: "L",
              fractionOfBatch: fractionOfBatch.toString(),
              materialCost: juice.totalCost?.toString() || "0",
              avgBrix: juice.brix?.toString(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            console.log("✅ Batch composition created for merged juice purchase");

            // Create measurements from merged juice purchase if pH or SG exist
            if (juice.ph || juice.specificGravity) {
              await tx.insert(batchMeasurements).values({
                batchId: batchId,
                measurementDate: input.transferDate,
                ph: juice.ph?.toString(),
                specificGravity: juice.specificGravity?.toString(),
                notes: "Measurements from merged juice purchase",
                volumeUnit: "L",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              console.log("✅ Batch measurements created from merged juice purchase");
            }
          }

          // 4. Update juice purchase item's allocated volume
          const newAllocatedVolume = allocatedVolumeL + transferVolumeL;
          const isFullyAllocated = newAllocatedVolume >= totalVolumeL;

          await tx
            .update(juicePurchaseItems)
            .set({
              volumeAllocated: newAllocatedVolume.toString(),
              updatedAt: new Date(),
              // Archive (soft delete) if fully allocated
              deletedAt: isFullyAllocated ? new Date() : undefined,
            })
            .where(eq(juicePurchaseItems.id, input.juicePurchaseItemId));

          return {
            success: true,
            message: isNewBatch
              ? `New batch created in ${vessel.name} with ${transferVolumeL.toFixed(1)}L of ${juice.juiceType || juice.varietyName}`
              : `Added ${transferVolumeL.toFixed(1)}L of ${juice.juiceType || juice.varietyName} to existing batch in ${vessel.name}`,
            batchId,
            batchName,
            isNewBatch,
            volumeTransferredL: transferVolumeL,
            remainingVolumeL: availableVolumeL - transferVolumeL,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error transferring juice to tank:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to transfer juice to tank",
        });
      }
    }),

  /**
   * Delete (soft delete) a finished batch
   * Only allows deletion of completed or discarded batches
   */
  delete: createRbacProcedure("delete", "batch")
    .input(batchIdSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists and get its status
        const [batch] = await db
          .select({
            id: batches.id,
            name: batches.name,
            status: batches.status,
            vesselId: batches.vesselId,
            deletedAt: batches.deletedAt,
          })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found or already deleted",
          });
        }

        // Only allow deletion of completed or discarded batches
        if (batch.status !== "completed" && batch.status !== "discarded") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot delete batch with status "${batch.status}". Only completed or discarded batches can be deleted.`,
          });
        }

        // Soft delete the batch
        await db
          .update(batches)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batches.id, input.batchId));

        // Update vessel status to cleaning if batch was in a vessel
        if (batch.vesselId) {
          await db
            .update(vessels)
            .set({
              status: "cleaning",
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, batch.vesselId));
        }

        return {
          success: true,
          message: `Batch "${batch.name}" has been deleted`,
          batchId: batch.id,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete batch",
        });
      }
    }),
});

export type BatchRouter = typeof batchRouter;
