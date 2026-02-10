import { z } from "zod";
import { router, createRbacProcedure, protectedProcedure, adminProcedure } from "../trpc";
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
  batchVolumeAdjustments,
  juicePurchaseItems,
  juicePurchases,
  auditLogs,
  packagingPurchaseItems,
  additivePurchaseItems,
  organizationSettings,
} from "db";
import { bottleRuns, kegFills, kegs, bottleRunMaterials } from "db/src/schema/packaging";
import { batchCarbonationOperations } from "db/src/schema/carbonation";
import { eq, and, isNull, isNotNull, desc, asc, sql, or, like, ilike, inArray, aliasedTable, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { convertToLiters } from "lib/src/units/conversions";
import { validateBatches, type BatchValidation } from "../validation/batch-validation";
import {
  calculateEstimatedSGAfterAddition,
  calculateEstimatedABV,
  convertSugarToGrams,
  analyzeFermentationProgress,
  type FermentationMeasurement,
  type StageThresholds,
  type StallSettings,
} from "lib";
import { correctSgForTemperature } from "lib/src/calc/sg-correction";

/**
 * Recalculates composition fractions for a batch based on juice volumes.
 * Call this after adding/modifying compositions to ensure fractions sum to 100%.
 * @param tx - Database transaction
 * @param batchId - ID of the batch to recalculate
 */
async function recalculateCompositionFractions(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  batchId: string
): Promise<void> {
  // Get all compositions for this batch
  const compositions = await tx
    .select({
      id: batchCompositions.id,
      juiceVolume: batchCompositions.juiceVolume,
    })
    .from(batchCompositions)
    .where(and(eq(batchCompositions.batchId, batchId), isNull(batchCompositions.deletedAt)));

  if (compositions.length === 0) return;

  // Calculate total juice volume
  let totalVolume = 0;
  for (const comp of compositions) {
    if (comp.juiceVolume) {
      totalVolume += parseFloat(comp.juiceVolume);
    }
  }

  if (totalVolume === 0) return;

  // Update each composition's fraction
  for (const comp of compositions) {
    const volume = comp.juiceVolume ? parseFloat(comp.juiceVolume) : 0;
    const newFraction = volume / totalVolume;

    await tx
      .update(batchCompositions)
      .set({
        fractionOfBatch: newFraction.toFixed(6),
        updatedAt: new Date(),
      })
      .where(eq(batchCompositions.id, comp.id));
  }
}

// Input validation schemas
const batchIdSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
});

const listBatchesSchema = z.object({
  status: z.enum(["fermentation", "aging", "conditioning", "completed", "discarded"]).optional(),
  productType: z.enum(["juice", "cider", "perry", "brandy", "pommeau", "other"]).optional(),
  vesselId: z.string().uuid().optional(),
  unassigned: z.boolean().optional(), // Filter for batches without a vessel
  search: z.string().optional(),
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(["name", "startDate", "status", "productType", "vesselName", "currentVolume", "customName"]).default("startDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.boolean().default(false),
  includeArchived: z.boolean().default(false), // Include archived batches in results
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
  measurementMethod: z.enum(['hydrometer', 'refractometer', 'calculated']).default('hydrometer'),
  notes: z.string().optional(),
  sensoryNotes: z.string().optional(),
  takenBy: z.string().optional(),
});

const addAdditiveSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  additiveType: z.string().min(1, "Additive type is required"),
  additiveName: z.string().min(1, "Additive name is required"),
  amount: z.number().positive("Amount must be positive"),
  unit: z.string().min(1, "Unit is required"),
  // Cost tracking - link to purchase item for COGS
  additivePurchaseItemId: z.string().uuid().optional(),
  costPerUnit: z.number().min(0).optional(),
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

const deleteMeasurementSchema = z.object({
  measurementId: z.string().uuid("Invalid measurement ID"),
});

const deleteAdditiveSchema = z.object({
  additiveId: z.string().uuid("Invalid additive ID"),
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

const updateTransferSchema = z.object({
  transferId: z.string().uuid("Invalid transfer ID"),
  transferredAt: z.date().or(z.string().transform((val) => new Date(val))),
});

const updateRackingSchema = z.object({
  rackingId: z.string().uuid("Invalid racking ID"),
  rackedAt: z.date().or(z.string().transform((val) => new Date(val))),
});

const updateFilterSchema = z.object({
  filterId: z.string().uuid("Invalid filter ID"),
  filteredAt: z.date().or(z.string().transform((val) => new Date(val))),
});

const updateMergeSchema = z.object({
  mergeId: z.string().uuid("Invalid merge ID"),
  mergedAt: z.date().or(z.string().transform((val) => new Date(val))),
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
  notes: z.string().optional(),
}).refine((data) => data.volumeAfter < data.volumeBefore, {
  message: "Volume after filtering must be less than volume before",
  path: ["volumeAfter"],
});

const updateBatchSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  name: z.string().optional(),
  batchNumber: z.string().optional(),
  status: z.enum(["fermentation", "aging", "conditioning", "completed", "discarded"]).optional(),
  productType: z.enum(["juice", "cider", "perry", "brandy", "pommeau", "other"]).optional(),
  fermentationStage: z.enum(["not_started", "not_applicable", "early", "mid", "approaching_dry", "terminal", "unknown"]).optional(),
  customName: z.string().optional(),
  vesselId: z.string().uuid("Invalid vessel ID").optional().nullable(),
  startDate: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .optional(),
  endDate: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .optional(),
  notes: z.string().optional(),
  reconciliationStatus: z.enum(["verified", "duplicate", "excluded", "pending"]).optional(),
  reconciliationNotes: z.string().optional(),
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
            productType: batches.productType,
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
          productType: batch.productType,
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
   * Get date validation context for a batch
   * Returns the earliest valid date for activities on this batch
   * Optionally includes packaging context if bottleRunId is provided
   */
  getDateValidationContext: createRbacProcedure("read", "batch")
    .input(
      z.union([
        // Support simple batchId string for backward compatibility
        z.string().uuid("Invalid batch ID"),
        // Support object with optional bottleRunId for packaging phase validation
        z.object({
          batchId: z.string().uuid("Invalid batch ID"),
          bottleRunId: z.string().uuid("Invalid bottle run ID").optional(),
        }),
      ])
    )
    .query(async ({ input }) => {
      try {
        // Normalize input to always have batchId
        const batchId = typeof input === "string" ? input : input.batchId;
        const bottleRunId = typeof input === "string" ? undefined : input.bottleRunId;

        // Import validation utilities
        const { extractDateFromBatchName, calculateEarliestValidDate } = await import("lib");

        // Get batch details
        const [batch] = await db
          .select({
            id: batches.id,
            name: batches.name,
            startDate: batches.startDate,
            createdAt: batches.createdAt,
          })
          .from(batches)
          .where(and(eq(batches.id, batchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Check if batch was created via transfer (child batch)
        const [transfer] = await db
          .select({
            transferredAt: batchTransfers.transferredAt,
          })
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.destinationBatchId, batchId),
              isNull(batchTransfers.deletedAt)
            )
          )
          .limit(1);

        const batchStartDate = batch.startDate;
        const batchCreatedAt = batch.createdAt;
        const transferDate = transfer?.transferredAt || null;
        const batchNameDate = extractDateFromBatchName(batch.name);

        // Calculate earliest valid date
        const earliestValidDate = calculateEarliestValidDate(
          batchStartDate,
          batchCreatedAt,
          transferDate,
          batchNameDate
        );

        // Base response
        const baseResponse = {
          batchId: batch.id,
          batchName: batch.name,
          batchStartDate,
          batchCreatedAt,
          transferDate,
          batchNameDate,
          earliestValidDate,
        };

        // If bottleRunId provided, fetch packaging context for phase validation
        if (bottleRunId) {
          const [bottleRun] = await db
            .select({
              packagedAt: bottleRuns.packagedAt,
              pasteurizedAt: bottleRuns.pasteurizedAt,
              labeledAt: bottleRuns.labeledAt,
            })
            .from(bottleRuns)
            .where(eq(bottleRuns.id, bottleRunId))
            .limit(1);

          return {
            ...baseResponse,
            packagingContext: bottleRun
              ? {
                  packagedAt: bottleRun.packagedAt,
                  pasteurizedAt: bottleRun.pasteurizedAt,
                  labeledAt: bottleRun.labeledAt,
                }
              : null,
          };
        }

        return baseResponse;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting date validation context:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get date validation context",
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

        // Only exclude archived batches if includeArchived is false
        // Handle NULL values - treat NULL as not archived
        if (!input.includeArchived) {
          conditions.push(or(eq(batches.isArchived, false), isNull(batches.isArchived)));
        }

        if (input.status) {
          conditions.push(eq(batches.status, input.status));
        }

        if (input.productType) {
          conditions.push(eq(batches.productType, input.productType));
        }

        if (input.vesselId) {
          conditions.push(eq(batches.vesselId, input.vesselId));
        }

        // Filter for unassigned batches (no vessel)
        if (input.unassigned) {
          conditions.push(isNull(batches.vesselId));
        }

        if (input.search) {
          conditions.push(like(batches.name, `%${input.search}%`));
        }

        // Build ORDER BY clause
        const sortColumn = {
          name: batches.name,
          customName: batches.customName,
          startDate: sql`COALESCE(${pressRuns.dateCompleted}, ${batches.startDate})`,
          status: batches.status,
          productType: batches.productType,
          vesselName: vessels.name,
          currentVolume: sql`CAST(${batches.currentVolume} AS DECIMAL)`,
        }[input.sortBy || "startDate"];

        const orderBy =
          input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

        // Query batches with vessel info and press run completion date
        const batchesList = await db
          .select({
            id: batches.id,
            name: batches.name,
            batchNumber: batches.batchNumber,
            customName: batches.customName,
            status: batches.status,
            productType: batches.productType,
            fermentationStage: batches.fermentationStage,
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
            originalGravity: batches.originalGravity,
            estimatedAbv: batches.estimatedAbv,
            actualAbv: batches.actualAbv,
            createdAt: batches.createdAt,
            updatedAt: batches.updatedAt,
            deletedAt: batches.deletedAt,
            isArchived: batches.isArchived,
            archivedAt: batches.archivedAt,
            archivedReason: batches.archivedReason,
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
              abv: batchMeasurements.abv,
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
                abv: row.abv,
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
            rawReading: batchMeasurements.rawReading,
            measurementMethod: batchMeasurements.measurementMethod,
            correctionsApplied: batchMeasurements.correctionsApplied,
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

        // Get all contributing press runs from merge history (for blends)
        const mergeHistoryPressRuns = await db
          .select({
            id: batchMergeHistory.id,
            pressRunId: batchMergeHistory.sourcePressRunId,
            pressRunName: pressRuns.pressRunName,
            totalAppleWeightKg: pressRuns.totalAppleWeightKg,
            volumeAdded: batchMergeHistory.volumeAdded,
            volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
            mergedAt: batchMergeHistory.mergedAt,
          })
          .from(batchMergeHistory)
          .innerJoin(pressRuns, eq(batchMergeHistory.sourcePressRunId, pressRuns.id))
          .where(
            and(
              eq(batchMergeHistory.targetBatchId, input.batchId),
              isNull(batchMergeHistory.deletedAt),
            ),
          )
          .orderBy(asc(batchMergeHistory.mergedAt));

        // Get batch-sourced composition (for brandy/transfers from other batches)
        const sourceBatchAlias = aliasedTable(batches, "source_batch");
        const batchSourcedComposition = await db
          .select({
            id: batchMergeHistory.id,
            sourceBatchId: batchMergeHistory.sourceBatchId,
            sourceBatchName: sourceBatchAlias.name,
            sourceBatchCustomName: sourceBatchAlias.customName,
            volumeAdded: batchMergeHistory.volumeAdded,
            volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
            sourceAbv: batchMergeHistory.sourceAbv,
            resultingAbv: batchMergeHistory.resultingAbv,
            notes: batchMergeHistory.notes,
            mergedAt: batchMergeHistory.mergedAt,
            sourceType: batchMergeHistory.sourceType,
          })
          .from(batchMergeHistory)
          .innerJoin(sourceBatchAlias, eq(batchMergeHistory.sourceBatchId, sourceBatchAlias.id))
          .where(
            and(
              eq(batchMergeHistory.targetBatchId, input.batchId),
              eq(batchMergeHistory.sourceType, "batch_transfer"),
              isNull(batchMergeHistory.deletedAt),
            ),
          )
          .orderBy(asc(batchMergeHistory.mergedAt));

        return {
          batch,
          origin: originDetails,
          contributingPressRuns: mergeHistoryPressRuns.map((m) => ({
            id: m.id,
            pressRunId: m.pressRunId,
            pressRunName: m.pressRunName,
            totalAppleWeightKg: m.totalAppleWeightKg ? parseFloat(m.totalAppleWeightKg) : null,
            volumeAdded: parseFloat(m.volumeAdded),
            volumeAddedUnit: m.volumeAddedUnit,
            mergedAt: m.mergedAt,
          })),
          // Batch-sourced composition (e.g., brandy from distillation)
          batchSourcedComposition: batchSourcedComposition.map((b) => ({
            id: b.id,
            sourceBatchId: b.sourceBatchId,
            sourceBatchName: b.sourceBatchCustomName || b.sourceBatchName || "Unknown Batch",
            volumeAdded: parseFloat(b.volumeAdded),
            volumeAddedUnit: b.volumeAddedUnit,
            sourceAbv: b.sourceAbv ? parseFloat(b.sourceAbv) : undefined,
            resultingAbv: b.resultingAbv ? parseFloat(b.resultingAbv) : undefined,
            notes: b.notes,
            mergedAt: b.mergedAt,
            sourceType: b.sourceType,
          })),
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
        // Verify batch exists and get current OG, fermentation stage
        const batchData = await db
          .select({
            id: batches.id,
            originalGravity: batches.originalGravity,
            fermentationStage: batches.fermentationStage,
            productType: batches.productType,
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

        // Fetch organization settings for SG correction preferences
        const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
        const [settings] = await db
          .select({
            sgTemperatureCorrectionEnabled: organizationSettings.sgTemperatureCorrectionEnabled,
            hydrometerCalibrationTempC: organizationSettings.hydrometerCalibrationTempC,
          })
          .from(organizationSettings)
          .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
          .limit(1);

        // Apply temperature correction to SG if enabled and both values are provided
        let correctedSg = input.specificGravity;
        const sgCorrectionEnabled = settings?.sgTemperatureCorrectionEnabled ?? true;
        const calibrationTempC = settings?.hydrometerCalibrationTempC
          ? parseFloat(settings.hydrometerCalibrationTempC)
          : 15.56;

        if (sgCorrectionEnabled && input.specificGravity && input.temperature) {
          correctedSg = correctSgForTemperature(input.specificGravity, input.temperature, calibrationTempC);
        }

        // Check for duplicate measurement (same batch, date, SG, and pH)
        const existingMeasurement = await db
          .select({ id: batchMeasurements.id })
          .from(batchMeasurements)
          .where(
            and(
              eq(batchMeasurements.batchId, input.batchId),
              sql`DATE(${batchMeasurements.measurementDate}) = DATE(${input.measurementDate})`,
              input.specificGravity
                ? eq(batchMeasurements.specificGravity, correctedSg?.toString() ?? "")
                : isNull(batchMeasurements.specificGravity),
              input.ph
                ? eq(batchMeasurements.ph, input.ph.toString())
                : isNull(batchMeasurements.ph),
              isNull(batchMeasurements.deletedAt)
            )
          )
          .limit(1);

        if (existingMeasurement.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Duplicate measurement: A measurement with the same SG (${input.specificGravity ?? "N/A"}) and pH (${input.ph ?? "N/A"}) was already recorded on this date`,
          });
        }

        // Create measurement
        const newMeasurement = await db
          .insert(batchMeasurements)
          .values({
            batchId: input.batchId,
            measurementDate: input.measurementDate,
            specificGravity: correctedSg?.toString(),
            abv: input.abv?.toString(),
            ph: input.ph?.toString(),
            totalAcidity: input.totalAcidity?.toString(),
            temperature: input.temperature?.toString(),
            volume: input.volume?.toString(),
            volumeUnit: input.volumeUnit,
            measurementMethod: input.measurementMethod,
            notes: input.notes,
            sensoryNotes: input.sensoryNotes,
            takenBy: input.takenBy,
          })
          .returning();

        // Auto-set Original Gravity only if batch doesn't have one
        // Don't overwrite existing OG from pressing - that's the true OG for ABV calculation
        let ogAutoSet = false;
        if (correctedSg && !batchData[0].originalGravity) {
          await db
            .update(batches)
            .set({
              originalGravity: correctedSg.toString(),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, input.batchId));
          ogAutoSet = true;
        }

        // Check if SG drop triggers fermentation start
        // Threshold: SG drops 0.005+ below OG indicates fermentation has started
        let fermentationStarted = false;
        const canStartFermentation = batchData[0].fermentationStage === "not_started" &&
          batchData[0].productType !== "brandy" &&
          batchData[0].productType !== "pommeau";

        if (canStartFermentation && correctedSg && batchData[0].originalGravity) {
          const og = parseFloat(batchData[0].originalGravity);
          const currentSg = correctedSg;
          const sgDrop = og - currentSg;

          // If SG has dropped by at least 0.005, fermentation has started
          if (sgDrop >= 0.005) {
            await db
              .update(batches)
              .set({
                fermentationStage: "early",
                fermentationStageUpdatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));
            fermentationStarted = true;
          }
        }

        let message = "Measurement added successfully";
        if (ogAutoSet && fermentationStarted) {
          message = "Measurement added. OG auto-set and fermentation detected!";
        } else if (ogAutoSet) {
          message = "Measurement added. OG auto-set from this measurement.";
        } else if (fermentationStarted) {
          message = "Measurement added. Fermentation detected!";
        }

        return {
          success: true,
          measurement: newMeasurement[0],
          ogAutoSet,
          fermentationStarted,
          message,
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
        // Verify batch exists and get vessel ID, original gravity, fermentation stage
        const batchData = await db
          .select({
            id: batches.id,
            vesselId: batches.vesselId,
            originalGravity: batches.originalGravity,
            fermentationStage: batches.fermentationStage,
            productType: batches.productType,
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

        // Calculate cost if purchase item is provided
        let costPerUnit = input.costPerUnit;
        let totalCost: number | undefined;
        let purchaseItemUnit: string | null = null;

        // Unit conversion factors
        const toGrams: Record<string, number> = {
          'g': 1,
          'kg': 1000,
          'lb': 453.592,
          'lbs': 453.592,
          'oz': 28.3495,
        };
        const toMl: Record<string, number> = {
          'ml': 1,
          'mL': 1,
          'L': 1000,
          'gal': 3785.41,
        };

        if (input.additivePurchaseItemId) {
          // Fetch cost and unit from purchase item
          const [purchaseItem] = await db
            .select({
              pricePerUnit: additivePurchaseItems.pricePerUnit,
              unit: additivePurchaseItems.unit
            })
            .from(additivePurchaseItems)
            .where(eq(additivePurchaseItems.id, input.additivePurchaseItemId))
            .limit(1);

          if (purchaseItem) {
            purchaseItemUnit = purchaseItem.unit;
            if (!costPerUnit && purchaseItem.pricePerUnit) {
              const purchasePricePerUnit = parseFloat(purchaseItem.pricePerUnit.toString());

              // Convert cost per unit if usage unit differs from purchase unit
              // e.g., $30/lb should become ~$0.066/g when using grams
              const usageUnit = input.unit.replace('/L', ''); // Handle "g/L" -> "g"

              if (usageUnit !== purchaseItemUnit) {
                // Check if both are weight units
                if (toGrams[usageUnit] && toGrams[purchaseItemUnit]) {
                  // Convert: price per purchase unit -> price per usage unit
                  // e.g., $30/lb * (453.592g/lb) / (1g/g) = $30 * 453.592 / 1 per gram...
                  // Wait, that's wrong. We need: $30/lb / (453.592g/lb) = $0.066/g
                  // Formula: pricePerPurchaseUnit / (toGrams[purchaseUnit] / toGrams[usageUnit])
                  costPerUnit = purchasePricePerUnit * (toGrams[usageUnit] / toGrams[purchaseItemUnit]);
                }
                // Check if both are volume units
                else if (toMl[usageUnit] && toMl[purchaseItemUnit]) {
                  costPerUnit = purchasePricePerUnit * (toMl[usageUnit] / toMl[purchaseItemUnit]);
                }
                else {
                  // Units are incompatible, use raw price
                  costPerUnit = purchasePricePerUnit;
                }
              } else {
                costPerUnit = purchasePricePerUnit;
              }
            }
          }
        }

        if (costPerUnit !== undefined) {
          totalCost = input.amount * costPerUnit;
        }

        // Check for duplicate additive (same vessel, name, amount, unit, and date)
        const addedAtDate = input.addedAt || new Date();
        const existingAdditive = await db
          .select({ id: batchAdditives.id })
          .from(batchAdditives)
          .where(
            and(
              eq(batchAdditives.vesselId, batchData[0].vesselId),
              eq(batchAdditives.additiveName, input.additiveName),
              eq(batchAdditives.amount, input.amount.toString()),
              eq(batchAdditives.unit, input.unit),
              sql`DATE(${batchAdditives.addedAt}) = DATE(${addedAtDate})`,
              isNull(batchAdditives.deletedAt)
            )
          )
          .limit(1);

        if (existingAdditive.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Duplicate additive: ${input.additiveName} (${input.amount} ${input.unit}) was already added on this date`,
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
            additivePurchaseItemId: input.additivePurchaseItemId,
            costPerUnit: costPerUnit?.toString(),
            totalCost: totalCost?.toString(),
            notes: input.notes,
            addedBy: input.addedBy,
            addedAt: input.addedAt || new Date(),
          })
          .returning();

        // Update quantityUsed on the source purchase item if provided
        if (input.additivePurchaseItemId && purchaseItemUnit) {
          // Convert amount to purchase item's unit if different
          let amountInPurchaseUnit = input.amount;

          if (input.unit !== purchaseItemUnit) {
            // Weight conversions
            const toGrams: Record<string, number> = {
              'g': 1,
              'kg': 1000,
              'lb': 453.592,
              'lbs': 453.592,
              'oz': 28.3495,
            };

            // Volume conversions (to mL)
            const toMl: Record<string, number> = {
              'ml': 1,
              'mL': 1,
              'L': 1000,
              'gal': 3785.41,
            };

            // Check if both are weight units
            if (toGrams[input.unit] && toGrams[purchaseItemUnit]) {
              const amountInGrams = input.amount * toGrams[input.unit];
              amountInPurchaseUnit = amountInGrams / toGrams[purchaseItemUnit];
            }
            // Check if both are volume units
            else if (toMl[input.unit] && toMl[purchaseItemUnit]) {
              const amountInMl = input.amount * toMl[input.unit];
              amountInPurchaseUnit = amountInMl / toMl[purchaseItemUnit];
            }
            // If units are incompatible (e.g., weight vs volume), use raw amount
          }

          await db
            .update(additivePurchaseItems)
            .set({
              quantityUsed: sql`${additivePurchaseItems.quantityUsed} + ${amountInPurchaseUnit.toString()}`,
              updatedAt: new Date(),
            })
            .where(eq(additivePurchaseItems.id, input.additivePurchaseItemId));
        }

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

        // Check if yeast/fermentation organism was added and update fermentation stage if not_started
        let fermentationStarted = false;
        const isFermentationOrganism = input.additiveType === 'Fermentation Organisms';
        const canStartFermentation = batchData[0].fermentationStage === "not_started" &&
          batchData[0].productType !== "brandy" &&
          batchData[0].productType !== "pommeau";

        if (isFermentationOrganism && canStartFermentation) {
          await db
            .update(batches)
            .set({
              fermentationStage: "early",
              fermentationStageUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, input.batchId));
          fermentationStarted = true;
        }

        return {
          success: true,
          additive: newAdditive[0],
          estimatedMeasurement,
          fermentationStarted,
          message: fermentationStarted
            ? "Additive added - fermentation started"
            : estimatedMeasurement
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

        // Fetch organization settings for SG correction preferences
        const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
        const [settings] = await db
          .select({
            sgTemperatureCorrectionEnabled: organizationSettings.sgTemperatureCorrectionEnabled,
            hydrometerCalibrationTempC: organizationSettings.hydrometerCalibrationTempC,
          })
          .from(organizationSettings)
          .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
          .limit(1);

        const sgCorrectionEnabled = settings?.sgTemperatureCorrectionEnabled ?? true;
        const calibrationTempC = settings?.hydrometerCalibrationTempC
          ? parseFloat(settings.hydrometerCalibrationTempC)
          : 15.56;

        // Build update object
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.measurementDate) updateData.measurementDate = input.measurementDate;

        // Apply temperature correction to SG if enabled and updating SG with a temperature value
        if (input.specificGravity !== undefined) {
          // Use input temperature if provided, otherwise use existing measurement's temperature
          const tempForCorrection = input.temperature ??
            (existingMeasurement[0].temperature ? parseFloat(existingMeasurement[0].temperature) : null);

          if (sgCorrectionEnabled && tempForCorrection !== null) {
            const correctedSg = correctSgForTemperature(input.specificGravity, tempForCorrection, calibrationTempC);
            updateData.specificGravity = correctedSg.toString();
          } else {
            updateData.specificGravity = input.specificGravity.toString();
          }
        }

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
   * Delete measurement (soft delete)
   */
  deleteMeasurement: createRbacProcedure("delete", "batch")
    .input(deleteMeasurementSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify measurement exists and isn't already deleted
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
            message: "Measurement not found or already deleted",
          });
        }

        // Soft delete by setting deletedAt timestamp
        await db
          .update(batchMeasurements)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batchMeasurements.id, input.measurementId));

        return {
          success: true,
          message: "Measurement deleted successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting measurement:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete measurement",
        });
      }
    }),

  /**
   * Delete additive (soft delete)
   */
  deleteAdditive: createRbacProcedure("delete", "batch")
    .input(deleteAdditiveSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify additive exists and isn't already deleted
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
            message: "Additive not found or already deleted",
          });
        }

        // Soft delete by setting deletedAt timestamp
        await db
          .update(batchAdditives)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batchAdditives.id, input.additiveId));

        return {
          success: true,
          message: "Additive deleted successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting additive:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete additive",
        });
      }
    }),

  /**
   * Update transfer date
   */
  updateTransfer: createRbacProcedure("update", "batch")
    .input(updateTransferSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify transfer exists
        const existingTransfer = await db
          .select()
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.id, input.transferId),
              isNull(batchTransfers.deletedAt)
            )
          )
          .limit(1);

        if (!existingTransfer.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transfer not found",
          });
        }

        // Update transfer
        const updatedTransfer = await db
          .update(batchTransfers)
          .set({
            transferredAt: input.transferredAt,
            updatedAt: new Date(),
          })
          .where(eq(batchTransfers.id, input.transferId))
          .returning();

        return {
          success: true,
          transfer: updatedTransfer[0],
          message: "Transfer date updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating transfer:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update transfer",
        });
      }
    }),

  /**
   * Update racking date
   */
  updateRacking: createRbacProcedure("update", "batch")
    .input(updateRackingSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify racking exists
        const existingRacking = await db
          .select()
          .from(batchRackingOperations)
          .where(
            and(
              eq(batchRackingOperations.id, input.rackingId),
              isNull(batchRackingOperations.deletedAt)
            )
          )
          .limit(1);

        if (!existingRacking.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Racking operation not found",
          });
        }

        // Update racking
        const updatedRacking = await db
          .update(batchRackingOperations)
          .set({
            rackedAt: input.rackedAt,
            updatedAt: new Date(),
          })
          .where(eq(batchRackingOperations.id, input.rackingId))
          .returning();

        return {
          success: true,
          racking: updatedRacking[0],
          message: "Racking date updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating racking:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update racking",
        });
      }
    }),

  /**
   * Update filter date
   */
  updateFilter: createRbacProcedure("update", "batch")
    .input(updateFilterSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify filter exists
        const existingFilter = await db
          .select()
          .from(batchFilterOperations)
          .where(
            and(
              eq(batchFilterOperations.id, input.filterId),
              isNull(batchFilterOperations.deletedAt)
            )
          )
          .limit(1);

        if (!existingFilter.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Filter operation not found",
          });
        }

        // Update filter
        const updatedFilter = await db
          .update(batchFilterOperations)
          .set({
            filteredAt: input.filteredAt,
            updatedAt: new Date(),
          })
          .where(eq(batchFilterOperations.id, input.filterId))
          .returning();

        return {
          success: true,
          filter: updatedFilter[0],
          message: "Filter date updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating filter:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update filter",
        });
      }
    }),

  /**
   * Update merge date
   */
  updateMerge: createRbacProcedure("update", "batch")
    .input(updateMergeSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify merge exists
        const existingMerge = await db
          .select()
          .from(batchMergeHistory)
          .where(eq(batchMergeHistory.id, input.mergeId))
          .limit(1);

        if (!existingMerge.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Merge operation not found",
          });
        }

        // Update merge
        const updatedMerge = await db
          .update(batchMergeHistory)
          .set({
            mergedAt: input.mergedAt,
          })
          .where(eq(batchMergeHistory.id, input.mergeId))
          .returning();

        return {
          success: true,
          merge: updatedMerge[0],
          message: "Merge date updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating merge:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update merge",
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
        if (input.productType) updateData.productType = input.productType;
        if (input.fermentationStage) {
          updateData.fermentationStage = input.fermentationStage;
          updateData.fermentationStageUpdatedAt = new Date();
        }
        if (input.customName !== undefined)
          updateData.customName = input.customName;
        if (input.vesselId !== undefined) updateData.vesselId = input.vesselId;
        if (input.startDate) updateData.startDate = input.startDate;
        if (input.endDate) updateData.endDate = input.endDate;
        if (input.reconciliationStatus !== undefined)
          updateData.reconciliationStatus = input.reconciliationStatus;
        if (input.reconciliationNotes !== undefined)
          updateData.reconciliationNotes = input.reconciliationNotes;

        // Capture old values for audit log
        const oldStatus = existingBatch[0].status;
        const oldProductType = existingBatch[0].productType;
        const oldFermentationStage = existingBatch[0].fermentationStage;
        const oldReconciliationStatus = existingBatch[0].reconciliationStatus;

        // Update batch
        const updatedBatch = await db
          .update(batches)
          .set(updateData)
          .where(eq(batches.id, input.batchId))
          .returning();

        // Create audit log if status changed
        if (input.status && input.status !== oldStatus) {
          await db.insert(auditLogs).values({
            tableName: 'batches',
            recordId: input.batchId,
            operation: 'update',
            oldData: { status: oldStatus },
            newData: { status: input.status },
            diffData: {
              status: {
                old: oldStatus,
                new: input.status,
              },
            },
            changedAt: input.startDate || new Date(), // Use startDate if provided (aging date)
            reason: input.status === 'aging'
              ? 'Batch transitioned to aging phase'
              : `Batch status changed to ${input.status}`,
          });
        }

        // Create audit log if productType changed
        if (input.productType && input.productType !== oldProductType) {
          await db.insert(auditLogs).values({
            tableName: 'batches',
            recordId: input.batchId,
            operation: 'update',
            oldData: { productType: oldProductType },
            newData: { productType: input.productType },
            diffData: {
              productType: {
                old: oldProductType || 'cider',
                new: input.productType,
              },
            },
            changedAt: new Date(),
            reason: `Product type changed from ${oldProductType || 'cider'} to ${input.productType}`,
          });
        }

        // Create audit log if fermentationStage changed
        if (input.fermentationStage && input.fermentationStage !== oldFermentationStage) {
          await db.insert(auditLogs).values({
            tableName: 'batches',
            recordId: input.batchId,
            operation: 'update',
            oldData: { fermentationStage: oldFermentationStage },
            newData: { fermentationStage: input.fermentationStage },
            diffData: {
              fermentationStage: {
                old: oldFermentationStage || 'unknown',
                new: input.fermentationStage,
              },
            },
            changedAt: new Date(),
            reason: input.fermentationStage === 'early'
              ? 'Fermentation started'
              : `Fermentation stage changed to ${input.fermentationStage}`,
          });
        }

        // Create audit log if reconciliationStatus changed
        if (input.reconciliationStatus && input.reconciliationStatus !== oldReconciliationStatus) {
          await db.insert(auditLogs).values({
            tableName: 'batches',
            recordId: input.batchId,
            operation: 'update',
            oldData: { reconciliationStatus: oldReconciliationStatus },
            newData: { reconciliationStatus: input.reconciliationStatus },
            diffData: {
              reconciliationStatus: {
                old: oldReconciliationStatus || 'pending',
                new: input.reconciliationStatus,
              },
            },
            changedAt: new Date(),
            reason: `Reconciliation status changed to ${input.reconciliationStatus}`,
          });
        }

        return {
          success: true,
          batch: updatedBatch[0],
          message: input.reconciliationStatus
            ? `Batch reconciliation status set to ${input.reconciliationStatus}`
            : input.fermentationStage === 'early' && oldFermentationStage === 'not_started'
              ? "Batch updated - fermentation started"
              : "Batch updated successfully",
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
   * List batches with reconciliation-relevant fields for TTB verification workflow
   */
  listForReconciliation: adminProcedure
    .input(z.object({
      year: z.number().int().min(2020).max(2100).optional(),
      productType: z.enum(["juice", "cider", "perry", "brandy", "pommeau", "other"]).optional(),
      reconciliationStatus: z.enum(["verified", "pending"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input = {} }) => {
      const conditions: any[] = [
        isNull(batches.deletedAt),
        // Auto-exclude brandy and juice (not reportable on TTB wine form)
        sql`(${batches.productType} IS NULL OR ${batches.productType} NOT IN ('brandy', 'juice'))`,
        // Auto-exclude racking derivatives (tracked under parent batch)
        sql`${batches.isRackingDerivative} IS NOT TRUE`,
        // Auto-exclude transfer-destination batches with 0 initial volume
        sql`NOT (${batches.parentBatchId} IS NOT NULL AND CAST(COALESCE(${batches.initialVolumeLiters}, '1') AS DECIMAL) = 0)`,
      ];

      if (input.year) {
        // Show ALL batches "in bond" during this year:
        // 1. Started this year (new production), OR
        // 2. Started before this year AND still has volume (aging/carrying forward), OR
        // 3. Started before this year AND had activity during this year
        const yearStart = `${input.year}-01-01`;
        const yearEnd = `${input.year}-12-31`;
        conditions.push(sql`(
          EXTRACT(YEAR FROM ${batches.startDate}) = ${input.year}
          OR (
            ${batches.startDate} < ${yearStart}::date
            AND (
              CAST(COALESCE(${batches.currentVolumeLiters}, '0') AS DECIMAL) > 0
              OR EXISTS (
                SELECT 1 FROM batch_transfers bt
                WHERE (bt.source_batch_id = ${batches.id} OR bt.destination_batch_id = ${batches.id})
                  AND bt.deleted_at IS NULL
                  AND bt.transferred_at >= ${yearStart}::date AND bt.transferred_at < (${yearEnd}::date + INTERVAL '1 day')
              )
              OR EXISTS (
                SELECT 1 FROM bottle_runs br
                WHERE br.batch_id = ${batches.id} AND br.voided_at IS NULL
                  AND br.packaged_at >= ${yearStart}::date AND br.packaged_at < (${yearEnd}::date + INTERVAL '1 day')
              )
              OR EXISTS (
                SELECT 1 FROM keg_fills kf
                WHERE kf.batch_id = ${batches.id} AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
                  AND kf.filled_at >= ${yearStart}::date AND kf.filled_at < (${yearEnd}::date + INTERVAL '1 day')
              )
              OR EXISTS (
                SELECT 1 FROM batch_volume_adjustments bva
                WHERE bva.batch_id = ${batches.id} AND bva.deleted_at IS NULL
                  AND bva.adjustment_date >= ${yearStart}::date AND bva.adjustment_date <= ${yearEnd}::date
              )
              OR EXISTS (
                SELECT 1 FROM batch_merge_history bmh
                WHERE bmh.target_batch_id = ${batches.id} AND bmh.deleted_at IS NULL
                  AND bmh.merged_at >= ${yearStart}::date AND bmh.merged_at < (${yearEnd}::date + INTERVAL '1 day')
              )
              OR EXISTS (
                SELECT 1 FROM distillation_records dr
                WHERE dr.source_batch_id = ${batches.id} AND dr.deleted_at IS NULL AND dr.status IN ('sent', 'received')
                  AND dr.sent_at >= ${yearStart}::date AND dr.sent_at < (${yearEnd}::date + INTERVAL '1 day')
              )
            )
          )
        )`);
      }
      if (input.productType) {
        conditions.push(eq(batches.productType, input.productType));
      }
      if (input.reconciliationStatus) {
        conditions.push(eq(batches.reconciliationStatus, input.reconciliationStatus));
      }
      if (input.search) {
        conditions.push(or(
          ilike(batches.name, `%${input.search}%`),
          ilike(batches.customName, `%${input.search}%`),
          ilike(batches.batchNumber, `%${input.search}%`),
        ));
      }

      const batchesList = await db
        .select({
          id: batches.id,
          name: batches.name,
          customName: batches.customName,
          batchNumber: batches.batchNumber,
          status: batches.status,
          productType: batches.productType,
          startDate: batches.startDate,
          vesselName: vessels.name,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          reconciliationStatus: batches.reconciliationStatus,
          reconciliationNotes: batches.reconciliationNotes,
          parentBatchId: batches.parentBatchId,
          isRackingDerivative: batches.isRackingDerivative,
          isArchived: batches.isArchived,
          vesselId: batches.vesselId,
          actualAbv: batches.actualAbv,
          estimatedAbv: batches.estimatedAbv,
          reconciliationVerifiedForYear: batches.reconciliationVerifiedForYear,
          volumeManuallyCorrected: batches.volumeManuallyCorrected,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(and(...conditions))
        .orderBy(asc(batches.startDate));

      // Run validation on all batches
      const validationYear = input.year || new Date().getFullYear();
      let validationMap = new Map<string, BatchValidation>();
      try {
        validationMap = await validateBatches(batchesList, validationYear);
      } catch (err) {
        console.error("Batch validation failed:", err);
      }

      // Fetch transfer-derived children for expandable rows
      const parentIds = batchesList.map(b => b.id);
      let childBatches: Array<{
        id: string;
        name: string | null;
        customName: string | null;
        batchNumber: string | null;
        productType: string | null;
        startDate: Date | null;
        vesselName: string | null;
        initialVolumeLiters: string | null;
        currentVolumeLiters: string | null;
        parentBatchId: string | null;
      }> = [];

      if (parentIds.length > 0) {
        childBatches = await db
          .select({
            id: batches.id,
            name: batches.name,
            customName: batches.customName,
            batchNumber: batches.batchNumber,
            productType: batches.productType,
            startDate: batches.startDate,
            vesselName: vessels.name,
            initialVolumeLiters: batches.initialVolumeLiters,
            currentVolumeLiters: batches.currentVolumeLiters,
            parentBatchId: batches.parentBatchId,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(and(
            isNull(batches.deletedAt),
            inArray(batches.parentBatchId, parentIds),
            sql`(${batches.isRackingDerivative} IS TRUE OR (${batches.parentBatchId} IS NOT NULL AND CAST(COALESCE(${batches.initialVolumeLiters}, '1') AS DECIMAL) = 0) OR COALESCE(${batches.reconciliationStatus}, 'pending') IN ('duplicate', 'excluded'))`,
          ))
          .orderBy(asc(batches.startDate));
      }

      // Group children by parent
      const childrenByParent = new Map<string, typeof childBatches>();
      for (const child of childBatches) {
        if (child.parentBatchId) {
          const existing = childrenByParent.get(child.parentBatchId) || [];
          existing.push(child);
          childrenByParent.set(child.parentBatchId, existing);
        }
      }

      const result = batchesList.map((b) => {
        const batchYear = b.startDate ? new Date(b.startDate).getFullYear() : null;
        const category: "new_production" | "carried_forward" =
          batchYear === validationYear ? "new_production" : "carried_forward";
        const isVerifiedForYear =
          b.reconciliationStatus === "verified" &&
          b.reconciliationVerifiedForYear === validationYear;

        return {
          ...b,
          children: childrenByParent.get(b.id) || [],
          validation: validationMap.get(b.id) || null,
          category,
          verifiedForYear: isVerifiedForYear,
        };
      });

      const unverified = result.filter((b) => !b.verifiedForYear);
      const statusCounts = {
        verified: result.filter((b) => b.verifiedForYear).length,
        pending: unverified.length,
        total: result.length,
        newProduction: result.filter((b) => b.category === "new_production").length,
        carriedForward: result.filter((b) => b.category === "carried_forward").length,
        passing: unverified.filter((b) => b.validation?.status === "pass").length,
        warnings: unverified.filter((b) => b.validation?.status === "warning").length,
        failing: unverified.filter((b) => b.validation?.status === "fail").length,
      };

      return { batches: result, statusCounts };
    }),

  /**
   * Bulk update reconciliation status for multiple batches
   */
  bulkUpdateReconciliationStatus: adminProcedure
    .input(z.object({
      batchIds: z.array(z.string().uuid()).min(1).max(500),
      reconciliationStatus: z.enum(["verified", "pending", "duplicate", "excluded"]),
      reconciliationNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updateData: Record<string, any> = {
        reconciliationStatus: input.reconciliationStatus,
        updatedAt: new Date(),
      };
      if (input.reconciliationNotes !== undefined) {
        updateData.reconciliationNotes = input.reconciliationNotes;
      }

      const updated = await db
        .update(batches)
        .set(updateData)
        .where(and(
          inArray(batches.id, input.batchIds),
          isNull(batches.deletedAt),
        ))
        .returning({ id: batches.id });

      // Audit log for bulk change
      if (updated.length > 0) {
        await db.insert(auditLogs).values(
          updated.map((batch) => ({
            tableName: 'batches' as const,
            recordId: batch.id,
            operation: 'update' as const,
            newData: { reconciliationStatus: input.reconciliationStatus },
            diffData: { reconciliationStatus: { new: input.reconciliationStatus } },
            changedAt: new Date(),
            reason: `Bulk reconciliation status update to ${input.reconciliationStatus}`,
          }))
        );
      }

      return { success: true, updatedCount: updated.length };
    }),

  /**
   * Validate batches and auto-verify those that pass all checks.
   * Batches with only warnings can be force-verified.
   */
  validateAndVerify: adminProcedure
    .input(z.object({
      batchIds: z.array(z.string().uuid()).min(1).max(500),
      forceVerifyWarnings: z.boolean().default(false),
      year: z.number().int().min(2020).max(2100).optional(),
    }))
    .mutation(async ({ input }) => {
      // Fetch batch data needed for validation
      const batchData = await db
        .select({
          id: batches.id,
          productType: batches.productType,
          startDate: batches.startDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          parentBatchId: batches.parentBatchId,
          vesselId: batches.vesselId,
          actualAbv: batches.actualAbv,
          estimatedAbv: batches.estimatedAbv,
        })
        .from(batches)
        .where(and(inArray(batches.id, input.batchIds), isNull(batches.deletedAt)));

      const year = input.year || new Date().getFullYear();
      const validations = await validateBatches(batchData, year);

      const toVerify: string[] = [];
      const blocked: { batchId: string; validation: BatchValidation }[] = [];

      for (const [batchId, validation] of validations) {
        if (validation.status === "pass") {
          toVerify.push(batchId);
        } else if (validation.status === "warning" && input.forceVerifyWarnings) {
          toVerify.push(batchId);
        } else {
          blocked.push({ batchId, validation });
        }
      }

      if (toVerify.length > 0) {
        await db
          .update(batches)
          .set({
            reconciliationStatus: "verified",
            reconciliationVerifiedForYear: year,
            updatedAt: new Date(),
          })
          .where(inArray(batches.id, toVerify));

        await db.insert(auditLogs).values(
          toVerify.map((id) => ({
            tableName: "batches" as const,
            recordId: id,
            operation: "update" as const,
            newData: { reconciliationStatus: "verified" },
            diffData: { reconciliationStatus: { new: "verified" } },
            changedAt: new Date(),
            reason: input.forceVerifyWarnings
              ? "Auto-verified via batch validation (warnings overridden)"
              : "Auto-verified via batch validation (all checks passed)",
          })),
        );
      }

      return { verified: toVerify, blocked };
    }),

  /**
   * Get complete batch activity history
   * Returns all events related to this batch in chronological order
   */
  getActivityHistory: createRbacProcedure("read", "batch")
    .input(
      batchIdSchema.extend({
        // limit is optional - when omitted, returns all activities
        limit: z.number().min(1).max(1000).optional(),
        offset: z.number().min(0).default(0),
        // Display mode: 'lineage' hides inherited measurements/additives for blended batches
        displayMode: z.enum(["lineage", "full"]).default("lineage"),
        // When true, show source batch history even in lineage mode
        showSourceHistory: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Get batch details first (required for validation)
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

        // Check if this batch has blend sources (other batches merged in)
        // sourceType can be "batch_transfer" or "batch" depending on how the merge was created
        const blendSources = await db
          .select({
            id: batchMergeHistory.id,
            sourceBatchId: batchMergeHistory.sourceBatchId,
            volumeAdded: batchMergeHistory.volumeAdded,
            volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
            mergedAt: batchMergeHistory.mergedAt,
          })
          .from(batchMergeHistory)
          .where(
            and(
              eq(batchMergeHistory.targetBatchId, input.batchId),
              or(
                eq(batchMergeHistory.sourceType, "batch_transfer"),
                eq(batchMergeHistory.sourceType, "batch"),
              ),
              isNull(batchMergeHistory.deletedAt),
            ),
          );

        const isBlendedBatch = blendSources.length > 0;

        // Find ancestor batches using recursive CTE
        // This traces the lineage back to the original batch through transfers
        // Checks both remaining_batch_id (for splits) and destination_batch_id (for transfers)
        const ancestorChainResult = await db.execute<{
          batch_id: string;
          batch_name: string;
          split_timestamp: Date;
          start_date: Date | null;
          depth: number;
        }>(sql`
          WITH RECURSIVE ancestors AS (
            -- Base case: find transfers that created this batch (via remaining_batch_id or destination_batch_id)
            SELECT
              bt.source_batch_id as batch_id,
              b.name as batch_name,
              bt.transferred_at as split_timestamp,
              b.start_date as start_date,
              1 as depth
            FROM batch_transfers bt
            JOIN batches b ON b.id = bt.source_batch_id
            WHERE (bt.remaining_batch_id = ${input.batchId} OR bt.destination_batch_id = ${input.batchId})
              AND bt.source_batch_id != ${input.batchId}
              AND bt.deleted_at IS NULL

            UNION ALL

            -- Recursive case: find transfers that created parent batches
            SELECT
              bt.source_batch_id,
              b.name,
              bt.transferred_at,
              b.start_date,
              a.depth + 1
            FROM batch_transfers bt
            JOIN batches b ON b.id = bt.source_batch_id
            JOIN ancestors a ON (bt.remaining_batch_id = a.batch_id OR bt.destination_batch_id = a.batch_id)
            WHERE bt.source_batch_id != a.batch_id
              AND bt.deleted_at IS NULL
              AND a.depth < 10
          )
          SELECT DISTINCT ON (batch_id) * FROM ancestors ORDER BY batch_id, depth DESC
        `);

        // Convert to array with proper typing
        const ancestorChain = (ancestorChainResult.rows || []) as Array<{
          batch_id: string;
          batch_name: string;
          split_timestamp: Date;
          start_date: Date | null;
          depth: number;
        }>;

        // Build list of all batch IDs to query (current + ancestors)
        const allBatchIds = [input.batchId, ...ancestorChain.map(a => a.batch_id)];

        // Create a map of batch ID to split timestamp for filtering
        const splitTimestampMap = new Map<string, Date>();
        ancestorChain.forEach(a => {
          splitTimestampMap.set(a.batch_id, new Date(a.split_timestamp));
        });

        // Run all independent queries in parallel for performance
        const [
          earliestTransfer,
          measurements,
          additives,
          merges,
          transfers,
          rackingOps,
          filterOps,
          carbonationOps,
          bottles,
          kegFillsList,
          statusChangeLogs,
          volumeAdjustmentsList,
        ] = await Promise.all([
          // Check for earliest transfer to determine true origin vessel
          db
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
            .limit(1),

          // Get measurements - includes ancestor batches before split
          db
            .select({
              id: batchMeasurements.id,
              batchId: batchMeasurements.batchId,
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
                inArray(batchMeasurements.batchId, allBatchIds),
                isNull(batchMeasurements.deletedAt),
              ),
            ),

          // Get additives - includes ancestor batches before split
          db
            .select({
              id: batchAdditives.id,
              batchId: batchAdditives.batchId,
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
                inArray(batchAdditives.batchId, allBatchIds),
                isNull(batchAdditives.deletedAt),
              ),
            ),

          // Get merge history - includes ancestor batches before split
          db
            .select({
              id: batchMergeHistory.id,
              targetBatchId: batchMergeHistory.targetBatchId,
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
              // Source batch info for batch-to-batch blends
              sourceBatchId: batchMergeHistory.sourceBatchId,
              sourceBatchName: sql<string>`merge_source_batch.name`.as("sourceBatchName"),
              sourceBatchCustomName: sql<string>`merge_source_batch.custom_name`.as("sourceBatchCustomName"),
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
            .leftJoin(
              sql`batches AS merge_source_batch`,
              sql`merge_source_batch.id = ${batchMergeHistory.sourceBatchId}`,
            )
            .where(
              and(
                inArray(batchMergeHistory.targetBatchId, allBatchIds),
                isNull(batchMergeHistory.deletedAt),
              ),
            ),

          // Get transfers (as source or destination) - includes ancestor batches before split
          db
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
                  // Include ancestor batch transfers
                  ...(allBatchIds.length > 1
                    ? [inArray(batchTransfers.sourceBatchId, allBatchIds.slice(1))]
                    : []),
                  ...(allBatchIds.length > 1
                    ? [inArray(batchTransfers.destinationBatchId, allBatchIds.slice(1))]
                    : []),
                ),
                isNull(batchTransfers.deletedAt),
              ),
            ),

          // Get racking operations - includes ancestor batches before split
          db
            .select({
              id: batchRackingOperations.id,
              batchId: batchRackingOperations.batchId,
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
                inArray(batchRackingOperations.batchId, allBatchIds),
                isNull(batchRackingOperations.deletedAt),
              ),
            ),

          // Get filter operations - includes ancestor batches before split
          db
            .select({
              id: batchFilterOperations.id,
              batchId: batchFilterOperations.batchId,
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
                inArray(batchFilterOperations.batchId, allBatchIds),
                isNull(batchFilterOperations.deletedAt),
              ),
            ),

          // Get carbonation operations - includes ancestor batches before split
          db
            .select({
              id: batchCarbonationOperations.id,
              batchId: batchCarbonationOperations.batchId,
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
                inArray(batchCarbonationOperations.batchId, allBatchIds),
                isNull(batchCarbonationOperations.deletedAt),
              ),
            ),

          // Get bottle runs (include both completed and active/null status)
          db
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
                or(
                  eq(bottleRuns.status, "completed"),
                  eq(bottleRuns.status, "active"),
                  eq(bottleRuns.status, "distributed"),
                  isNull(bottleRuns.status)
                )
              ),
            ),

          // Get keg fills
          db
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
                isNull(kegFills.deletedAt)
              ),
            ),

          // Get audit logs for status changes
          db
            .select({
              id: auditLogs.id,
              changedAt: auditLogs.changedAt,
              diffData: auditLogs.diffData,
              reason: auditLogs.reason,
            })
            .from(auditLogs)
            .where(
              and(
                eq(auditLogs.tableName, 'batches'),
                eq(auditLogs.recordId, input.batchId),
                eq(auditLogs.operation, 'update'),
                sql`${auditLogs.diffData}->>'status' IS NOT NULL`
              )
            )
            .orderBy(asc(auditLogs.changedAt)),

          // Get volume adjustments (sediment, evaporation, sampling, etc.)
          db
            .select({
              id: batchVolumeAdjustments.id,
              batchId: batchVolumeAdjustments.batchId,
              adjustmentDate: batchVolumeAdjustments.adjustmentDate,
              adjustmentType: batchVolumeAdjustments.adjustmentType,
              volumeBefore: batchVolumeAdjustments.volumeBefore,
              volumeAfter: batchVolumeAdjustments.volumeAfter,
              adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
              reason: batchVolumeAdjustments.reason,
              notes: batchVolumeAdjustments.notes,
            })
            .from(batchVolumeAdjustments)
            .where(
              and(
                eq(batchVolumeAdjustments.batchId, input.batchId),
                isNull(batchVolumeAdjustments.deletedAt)
              )
            )
            .orderBy(asc(batchVolumeAdjustments.adjustmentDate)),
        ]);

        let activities: any[] = [];

        // Helper function to check if an activity from an ancestor should be included
        // Activities are only included if they occurred before the batch was split off
        const shouldIncludeAncestorActivity = (activityBatchId: string, activityTimestamp: Date): boolean => {
          if (activityBatchId === input.batchId) return true; // Own activity - always include
          const splitTime = splitTimestampMap.get(activityBatchId);
          if (!splitTime) return true; // No split time found, include by default
          return new Date(activityTimestamp) < splitTime;
        };

        // Helper function to get inherited info for an activity
        const getInheritedInfo = (activityBatchId: string): { inherited: boolean; inheritedFrom?: string } => {
          if (activityBatchId === input.batchId) return { inherited: false };
          const ancestor = ancestorChain.find(a => a.batch_id === activityBatchId);
          return { inherited: true, inheritedFrom: ancestor?.batch_name || "parent batch" };
        };

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

        // If this batch has ancestors (was created via transfer), use the oldest ancestor's start date
        // Otherwise use this batch's creation date (which is actually startDate per the query alias)
        let creationTimestamp = batch[0].createdAt;
        let creationDescription = `Batch created from ${originDescription}`;

        if (ancestorChain.length > 0) {
          // Find the ancestor with the earliest start_date (true origin of lineage)
          // This is more accurate than highest depth, especially for blended batches
          const ancestorsWithDates = ancestorChain.filter(a => a.start_date !== null);

          if (ancestorsWithDates.length > 0) {
            const earliestAncestor = ancestorsWithDates.reduce((earliest, current) => {
              const earliestDate = new Date(earliest.start_date!).getTime();
              const currentDate = new Date(current.start_date!).getTime();
              return currentDate < earliestDate ? current : earliest;
            }, ancestorsWithDates[0]);

            creationTimestamp = earliestAncestor.start_date!;
          } else {
            // Fallback to highest depth if no start_dates available
            const oldestAncestor = ancestorChain.reduce((oldest, current) =>
              current.depth > oldest.depth ? current : oldest
            , ancestorChain[0]);

            // Query the oldest ancestor's start date
            const [oldestAncestorBatch] = await db
              .select({
                startDate: batches.startDate,
                createdAt: batches.createdAt,
              })
              .from(batches)
              .where(eq(batches.id, oldestAncestor.batch_id))
              .limit(1);

            if (oldestAncestorBatch) {
              creationTimestamp = oldestAncestorBatch.startDate || oldestAncestorBatch.createdAt;
            }
          }

          // Update description to mention the parent batch
          creationDescription = `Batch lineage started from ${originDescription}`;
        }

        activities.push({
          id: `creation-${batch[0].id}`,
          type: "creation",
          timestamp: creationTimestamp,
          description: creationDescription,
          details:
            batch[0].initialVolume || creationVessel
              ? {
                  initialVolume: batch[0].initialVolume ? `${parseFloat(batch[0].initialVolume).toFixed(1)}${batch[0].initialVolumeUnit || 'L'}` : null,
                  vessel: creationVessel || null,
                }
              : {},
        });

        // Process measurements (filter by split timestamp for ancestors)
        measurements.forEach((m) => {
          if (!shouldIncludeAncestorActivity(m.batchId, m.measurementDate)) return;

          const details = [];
          if (m.specificGravity) details.push(`SG: ${m.specificGravity}`);
          if (m.abv) details.push(`ABV: ${m.abv}%`);
          if (m.ph) details.push(`pH: ${m.ph}`);
          if (m.totalAcidity) details.push(`TA: ${m.totalAcidity}`);
          if (m.temperature) details.push(`Temp: ${m.temperature}°C`);
          if (m.volume) details.push(`Volume: ${m.volume}${m.volumeUnit || 'L'}`);

          const inheritedInfo = getInheritedInfo(m.batchId);
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
            ...inheritedInfo,
          });
        });

        // Process additives (filter by split timestamp for ancestors)
        additives.forEach((a) => {
          if (!shouldIncludeAncestorActivity(a.batchId, a.addedAt)) return;

          const inheritedInfo = getInheritedInfo(a.batchId);
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
            ...inheritedInfo,
          });
        });

        // Process merges (filter by split timestamp for ancestors)
        merges.forEach((m) => {
          if (!shouldIncludeAncestorActivity(m.targetBatchId, m.mergedAt)) return;

          let sourceDescription = "another batch";
          let sourceBatchInfo: { id: string; name: string } | null = null;
          // Check for batch-to-batch merges (sourceType can be "batch_transfer" or "batch")
          const isBatchMerge = (m.sourceType === "batch_transfer" || m.sourceType === "batch") && m.sourceBatchId;
          const isExpandable = isBatchMerge;

          if (m.sourceType === "press_run" && m.pressRunName) {
            sourceDescription = `Press Run ${m.pressRunName}`;
          } else if (m.sourceType === "juice_purchase") {
            const juiceLabel = m.juiceType || m.juiceVarietyName || "Purchased Juice";
            const vendorLabel = m.juiceVendorName ? ` from ${m.juiceVendorName}` : "";
            sourceDescription = `${juiceLabel}${vendorLabel}`;
          } else if (isBatchMerge && m.sourceBatchName) {
            // For batch-to-batch blends, use the source batch name
            sourceDescription = m.sourceBatchCustomName || m.sourceBatchName;
            sourceBatchInfo = {
              id: m.sourceBatchId!,
              name: m.sourceBatchCustomName || m.sourceBatchName,
            };
          }

          const inheritedInfo = getInheritedInfo(m.targetBatchId);
          activities.push({
            id: `merge-${m.id}`,
            type: "merge",
            timestamp: m.mergedAt,
            description: isExpandable
              ? `Blended with ${sourceDescription}`
              : `Merged with juice from ${sourceDescription}`,
            details: {
              volumeAdded: `${m.volumeAdded}${m.volumeAddedUnit || 'L'}`,
              volumeChange: `${m.targetVolumeBefore}${m.targetVolumeBeforeUnit || 'L'} → ${m.targetVolumeAfter}${m.targetVolumeAfterUnit || 'L'}`,
              notes: m.notes || null,
            },
            // Source batch info for expandable UI (batch-to-batch blends only)
            sourceBatch: sourceBatchInfo,
            isExpandable,
            metadata: { id: m.id, mergedAt: m.mergedAt },
            ...inheritedInfo,
          });
        });

        // Process transfers (filter by split timestamp for ancestors)
        // Only include transfers where:
        // 1. This batch is directly involved (source or destination), OR
        // 2. Both source AND destination are in the ancestor chain (not sibling batches)
        transfers.forEach((t) => {
          const thisIsSource = t.sourceBatchId === input.batchId;
          const thisIsDestination = t.destinationBatchId === input.batchId;
          const sourceIsAncestor = allBatchIds.includes(t.sourceBatchId) && t.sourceBatchId !== input.batchId;
          const destIsAncestor = allBatchIds.includes(t.destinationBatchId) && t.destinationBatchId !== input.batchId;

          // Skip transfers from ancestors to non-ancestors (siblings)
          // These are transfers from parent batch to sibling child batches
          if (sourceIsAncestor && !destIsAncestor && !thisIsDestination) {
            return; // Skip sibling transfers
          }

          // Determine which batch ID to use for filtering
          const relevantBatchId = t.sourceBatchId === t.destinationBatchId
            ? t.sourceBatchId
            : (allBatchIds.includes(t.sourceBatchId) ? t.sourceBatchId : t.destinationBatchId);

          if (!shouldIncludeAncestorActivity(relevantBatchId, t.transferredAt)) return;

          // Check if this is a vessel move (same batch moved) or traditional transfer (different batches)
          const isSameBatch = t.sourceBatchId === t.destinationBatchId;
          const inheritedInfo = getInheritedInfo(relevantBatchId);

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
              metadata: { id: t.id, transferredAt: t.transferredAt },
              ...inheritedInfo,
            });
          } else {
            // Traditional transfer: different batches involved
            // For inherited transfers, check if this batch was the source
            const isSource = thisIsSource || sourceIsAncestor;
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
              metadata: { id: t.id, transferredAt: t.transferredAt },
              ...inheritedInfo,
            });
          }
        });

        // Process racking operations (filter by split timestamp for ancestors)
        rackingOps.forEach((r) => {
          if (!shouldIncludeAncestorActivity(r.batchId, r.rackedAt)) return;

          const inheritedInfo = getInheritedInfo(r.batchId);
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
            metadata: { id: r.id, rackedAt: r.rackedAt },
            ...inheritedInfo,
          });
        });

        // Process filter operations (filter by split timestamp for ancestors)
        filterOps.forEach((f) => {
          if (!shouldIncludeAncestorActivity(f.batchId, f.filteredAt)) return;

          const inheritedInfo = getInheritedInfo(f.batchId);
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
            metadata: { id: f.id, filteredAt: f.filteredAt },
            ...inheritedInfo,
          });
        });

        // Process carbonation operations (filter by split timestamp for ancestors)
        carbonationOps.forEach((c) => {
          // Use startedAt for timeline position - carbonation logically happens before bottling
          // Even if completedAt is later, the carbonation process started at startedAt
          const timestamp = c.startedAt;
          if (!shouldIncludeAncestorActivity(c.batchId, timestamp)) return;

          const isCompleted = !!c.completedAt;
          const inheritedInfo = getInheritedInfo(c.batchId);

          activities.push({
            id: `carbonation-${c.id}`,
            type: "carbonation",
            timestamp: timestamp,
            description: isCompleted
              ? `Carbonated to ${c.finalCo2Volumes || c.targetCo2Volumes} volumes CO₂ using ${c.carbonationProcess}`
              : `Started ${c.carbonationProcess} carbonation to ${c.targetCo2Volumes} volumes CO₂`,
            details: {
              process: c.carbonationProcess,
              targetCo2: `${c.targetCo2Volumes} volumes (target)`,
              ...(c.finalCo2Volumes && { finalCo2: `${c.finalCo2Volumes} volumes` }),
              pressure: `${c.pressureApplied} PSI`,
              volume: `${c.startingVolume}${c.startingVolumeUnit || 'L'}`,
              status: isCompleted ? 'completed' : 'in progress',
            },
            metadata: { id: c.id, startedAt: c.startedAt, completedAt: c.completedAt },
            ...inheritedInfo,
          });
        });

        // Process bottles
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
            metadata: { id: b.id, packagedAt: b.packagedAt },
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
              metadata: { id: b.id, pasteurizedAt: b.pasteurizedAt },
            });
          }

          // Add labeling event if labeled (will be populated below with label details)
          if (b.labeledAt) {
            activities.push({
              id: `label-${b.id}`,
              type: "label",
              timestamp: b.labeledAt,
              description: `Labels applied to bottle run`,
              details: {
                unitsLabeled: b.unitsProduced,
              },
              metadata: { id: b.id, labeledAt: b.labeledAt },
              bottleRunId: b.id, // Temporary field for lookup
            });
          }
        });

        // Process keg fills
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

        // Get label details for all labeled bottle runs (this query depends on bottles result)
        const labeledBottleRunIds = bottles
          .filter(b => b.labeledAt)
          .map(b => b.id);

        if (labeledBottleRunIds.length > 0) {
          const labelDetails = await db
            .select({
              bottleRunId: bottleRunMaterials.bottleRunId,
              labelName: packagingPurchaseItems.size,
              quantity: bottleRunMaterials.quantityUsed,
            })
            .from(bottleRunMaterials)
            .leftJoin(
              packagingPurchaseItems,
              eq(bottleRunMaterials.packagingPurchaseItemId, packagingPurchaseItems.id)
            )
            .where(
              and(
                inArray(bottleRunMaterials.bottleRunId, labeledBottleRunIds),
                eq(bottleRunMaterials.materialType, "Labels")
              )
            );

          // Group labels by bottle run
          const labelsByBottleRun = labelDetails.reduce((acc, label) => {
            if (!acc[label.bottleRunId]) {
              acc[label.bottleRunId] = [];
            }
            acc[label.bottleRunId].push(label);
            return acc;
          }, {} as Record<string, typeof labelDetails>);

          // Update label activities with detailed information
          activities.forEach((activity: any) => {
            if (activity.type === "label" && activity.bottleRunId) {
              const labels = labelsByBottleRun[activity.bottleRunId];
              if (labels && labels.length > 0) {
                const labelDescriptions = labels.map((l: any) =>
                  `${l.quantity.toLocaleString()}× ${l.labelName || 'Label'}`
                ).join(", ");

                activity.description = `Applied labels: ${labelDescriptions}`;
                activity.details = {
                  ...activity.details,
                  labels: labels.map((l: any) => ({
                    name: l.labelName || "Label",
                    quantity: l.quantity,
                  })),
                };
              }
              // Remove temporary field
              delete activity.bottleRunId;
            }
          });
        }

        // Process status change logs
        statusChangeLogs.forEach((log) => {
          const diffData = log.diffData as any;
          const statusChange = diffData?.status;
          if (statusChange && statusChange.old && statusChange.new) {
            activities.push({
              id: `status-change-${log.id}`,
              type: "status_change",
              timestamp: log.changedAt,
              description: `Batch status changed from ${statusChange.old} to ${statusChange.new}`,
              details: {
                previousStatus: statusChange.old,
                newStatus: statusChange.new,
                reason: log.reason || undefined,
              },
            });
          }
        });

        // Process volume adjustments (sediment, evaporation, sampling, etc.)
        volumeAdjustmentsList.forEach((adj) => {
          const amount = parseFloat(adj.adjustmentAmount || "0");
          const isLoss = amount < 0;

          // Format the adjustment type for display
          const typeLabel = (adj.adjustmentType || "other")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          activities.push({
            id: `adjustment-${adj.id}`,
            type: "adjustment",
            timestamp: adj.adjustmentDate,
            description: adj.reason || `Volume ${isLoss ? "decreased" : "increased"} (${typeLabel})`,
            details: {
              adjustmentType: typeLabel,
              volumeBefore: `${parseFloat(adj.volumeBefore || "0").toFixed(1)}L`,
              volumeAfter: `${parseFloat(adj.volumeAfter || "0").toFixed(1)}L`,
              adjustmentAmount: `${amount > 0 ? "+" : ""}${amount.toFixed(1)}L`,
              notes: adj.notes || null,
            },
            metadata: { id: adj.id, adjustmentDate: adj.adjustmentDate },
          });
        });

        // In lineage mode for blended batches, filter out inherited activities that are
        // redundant or not relevant to this batch's story (unless showSourceHistory is enabled)
        if (input.displayMode === "lineage" && isBlendedBatch && !input.showSourceHistory) {
          activities = activities.filter((activity) => {
            // Always include non-inherited activities (direct activities on this batch)
            if (!activity.inherited) return true;

            // Always include origin events (creation) - these show lineage
            if (activity.type === "creation") return true;

            // Exclude inherited merge events - the direct merge events already show blend sources
            // Showing both creates redundancy (merge on this batch + merge on source batch)
            if (activity.type === "merge") return false;

            // Exclude inherited transfers - these are redundant with merge events
            // (the transfer INTO this batch is the same event as the merge)
            if (activity.type === "transfer") return false;

            // Exclude inherited measurements and additives (source batch details)
            if (["measurement", "additive"].includes(activity.type)) return false;

            // Include everything else (rack, filter, packaging, etc.)
            return true;
          });
        }

        // Sort all activities by timestamp - true chronological order (oldest to newest)
        activities.sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateA - dateB; // Oldest first (chronological order)
        });

        // Apply pagination (if limit is specified)
        const totalActivities = activities.length;
        const limit = input.limit;
        const paginatedActivities = limit
          ? activities.slice(input.offset, input.offset + limit)
          : activities.slice(input.offset);

        return {
          batch: batch[0],
          activities: paginatedActivities,
          pagination: {
            total: totalActivities,
            limit: limit ?? totalActivities,
            offset: input.offset,
            hasMore: limit ? input.offset + limit < totalActivities : false,
          },
          // Blend metadata for UI
          blendInfo: {
            isBlended: isBlendedBatch,
            sourceBatchCount: blendSources.length,
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
   * Get child batches that were created from transfers out of this batch
   * Used for expandable Activity History lineage view
   */
  getChildBatches: createRbacProcedure("read", "batch")
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        // Find all transfers where this batch is the source
        // The destination batch is the "child"
        const transfers = await db
          .select({
            transferId: batchTransfers.id,
            destinationBatchId: batchTransfers.destinationBatchId,
            volumeTransferred: batchTransfers.volumeTransferred,
            volumeTransferredUnit: batchTransfers.volumeTransferredUnit,
            loss: batchTransfers.loss,
            lossUnit: batchTransfers.lossUnit,
            transferredAt: batchTransfers.transferredAt,
            notes: batchTransfers.notes,
            // Child batch details
            childName: batches.name,
            childCustomName: batches.customName,
            childBatchNumber: batches.batchNumber,
            childStatus: batches.status,
            childCurrentVolume: batches.currentVolume,
            childCurrentVolumeUnit: batches.currentVolumeUnit,
            childProductType: batches.productType,
            // Destination vessel
            destinationVesselId: batchTransfers.destinationVesselId,
            destinationVesselName: vessels.name,
          })
          .from(batchTransfers)
          .leftJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
          .leftJoin(vessels, eq(batchTransfers.destinationVesselId, vessels.id))
          .where(
            and(
              eq(batchTransfers.sourceBatchId, input.batchId),
              isNull(batchTransfers.deletedAt),
              // Only include if destination batch exists and is different from source
              ne(batchTransfers.destinationBatchId, input.batchId),
              isNotNull(batchTransfers.destinationBatchId)
            )
          )
          .orderBy(asc(batchTransfers.transferredAt));

        // For each child, get a count of their children (grandchildren)
        const childrenWithCounts = await Promise.all(
          transfers.map(async (transfer) => {
            if (!transfer.destinationBatchId) return { ...transfer, grandchildCount: 0, hasPackaging: false };

            // Count grandchildren (transfers out of this child)
            const grandchildCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(batchTransfers)
              .where(
                and(
                  eq(batchTransfers.sourceBatchId, transfer.destinationBatchId),
                  isNull(batchTransfers.deletedAt),
                  ne(batchTransfers.destinationBatchId, transfer.destinationBatchId)
                )
              );

            // Check if child has packaging (bottle runs)
            const packagingCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(bottleRuns)
              .where(eq(bottleRuns.batchId, transfer.destinationBatchId));

            return {
              ...transfer,
              grandchildCount: grandchildCount[0]?.count || 0,
              hasPackaging: (packagingCount[0]?.count || 0) > 0,
            };
          })
        );

        return {
          children: childrenWithCounts,
          totalCount: childrenWithCounts.length,
        };
      } catch (error) {
        console.error("Error fetching child batches:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch child batches",
        });
      }
    }),

  /**
   * Get a lightweight summary of child batch activities for expandable row preview
   * Returns activities scoped to this batch's vessel period only
   */
  getChildActivitySummary: createRbacProcedure("read", "batch")
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        // Get the batch info
        const batch = await db
          .select()
          .from(batches)
          .where(eq(batches.id, input.batchId))
          .limit(1);

        if (!batch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batchData = batch[0];

        // Find when this batch was created (via transfer or creation)
        const incomingTransfer = await db
          .select({ transferredAt: batchTransfers.transferredAt })
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.destinationBatchId, input.batchId),
              isNull(batchTransfers.deletedAt)
            )
          )
          .orderBy(asc(batchTransfers.transferredAt))
          .limit(1);

        const startDate = incomingTransfer[0]?.transferredAt || batchData.startDate || batchData.createdAt;

        // Find when this batch ended (transferred out completely or packaged)
        const outgoingTransfers = await db
          .select({
            transferredAt: batchTransfers.transferredAt,
            volumeTransferred: batchTransfers.volumeTransferred,
          })
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.sourceBatchId, input.batchId),
              isNull(batchTransfers.deletedAt)
            )
          )
          .orderBy(desc(batchTransfers.transferredAt));

        // Get activities in parallel (scoped to this batch only, no inheritance)
        const [measurements, additives, rackings, filters, carbonations, bottlings, kegFillsData] = await Promise.all([
          // Measurements
          db
            .select({
              id: batchMeasurements.id,
              date: batchMeasurements.measurementDate,
              type: sql<string>`'measurement'`,
              specificGravity: batchMeasurements.specificGravity,
              abv: batchMeasurements.abv,
              ph: batchMeasurements.ph,
            })
            .from(batchMeasurements)
            .where(
              and(
                eq(batchMeasurements.batchId, input.batchId),
                isNull(batchMeasurements.deletedAt)
              )
            )
            .orderBy(desc(batchMeasurements.measurementDate)),

          // Additives
          db
            .select({
              id: batchAdditives.id,
              date: batchAdditives.addedAt,
              type: sql<string>`'additive'`,
              additiveType: batchAdditives.additiveType,
              additiveName: batchAdditives.additiveName,
              amount: batchAdditives.amount,
              unit: batchAdditives.unit,
            })
            .from(batchAdditives)
            .where(
              and(
                eq(batchAdditives.batchId, input.batchId),
                isNull(batchAdditives.deletedAt)
              )
            )
            .orderBy(desc(batchAdditives.addedAt)),

          // Racking
          db
            .select({
              id: batchRackingOperations.id,
              date: batchRackingOperations.rackedAt,
              type: sql<string>`'rack'`,
              volumeLoss: batchRackingOperations.volumeLoss,
            })
            .from(batchRackingOperations)
            .where(
              and(
                eq(batchRackingOperations.batchId, input.batchId),
                isNull(batchRackingOperations.deletedAt)
              )
            )
            .orderBy(desc(batchRackingOperations.rackedAt)),

          // Filtering
          db
            .select({
              id: batchFilterOperations.id,
              date: batchFilterOperations.filteredAt,
              type: sql<string>`'filter'`,
              filterType: batchFilterOperations.filterType,
              volumeLoss: batchFilterOperations.volumeLoss,
            })
            .from(batchFilterOperations)
            .where(
              and(
                eq(batchFilterOperations.batchId, input.batchId),
                isNull(batchFilterOperations.deletedAt)
              )
            )
            .orderBy(desc(batchFilterOperations.filteredAt)),

          // Carbonation
          db
            .select({
              id: batchCarbonationOperations.id,
              date: batchCarbonationOperations.startedAt,
              type: sql<string>`'carbonation'`,
              targetCo2: batchCarbonationOperations.targetCo2Volumes,
              completedAt: batchCarbonationOperations.completedAt,
            })
            .from(batchCarbonationOperations)
            .where(
              and(
                eq(batchCarbonationOperations.batchId, input.batchId),
                isNull(batchCarbonationOperations.deletedAt)
              )
            )
            .orderBy(desc(batchCarbonationOperations.startedAt)),

          // Bottling
          db
            .select({
              id: bottleRuns.id,
              date: bottleRuns.packagedAt,
              type: sql<string>`'bottling'`,
              unitsProduced: bottleRuns.unitsProduced,
              packageSizeML: bottleRuns.packageSizeML,
              volumeTaken: bottleRuns.volumeTaken,
            })
            .from(bottleRuns)
            .where(eq(bottleRuns.batchId, input.batchId))
            .orderBy(desc(bottleRuns.packagedAt)),

          // Keg fills
          db
            .select({
              id: kegFills.id,
              date: kegFills.filledAt,
              type: sql<string>`'keg'`,
              volumeTaken: kegFills.volumeTaken,
              kegId: kegFills.kegId,
            })
            .from(kegFills)
            .where(
              and(
                eq(kegFills.batchId, input.batchId),
                isNull(kegFills.deletedAt)
              )
            )
            .orderBy(desc(kegFills.filledAt)),
        ]);

        // Get child count (transfers out)
        const childCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.sourceBatchId, input.batchId),
              isNull(batchTransfers.deletedAt),
              ne(batchTransfers.destinationBatchId, input.batchId)
            )
          );

        // Combine and sort all activities by date
        const allActivities = [
          ...measurements.map((m) => ({ ...m, activityType: "measurement" as const })),
          ...additives.map((a) => ({ ...a, activityType: "additive" as const })),
          ...rackings.map((r) => ({ ...r, activityType: "rack" as const })),
          ...filters.map((f) => ({ ...f, activityType: "filter" as const })),
          ...carbonations.map((c) => ({ ...c, activityType: "carbonation" as const })),
          ...bottlings.map((b) => ({ ...b, activityType: "bottling" as const })),
          ...kegFillsData.map((k) => ({ ...k, activityType: "keg" as const })),
        ].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA; // Most recent first
        });

        return {
          batch: {
            id: batchData.id,
            name: batchData.name,
            customName: batchData.customName,
            batchNumber: batchData.batchNumber,
            status: batchData.status,
            currentVolume: batchData.currentVolume,
            currentVolumeUnit: batchData.currentVolumeUnit,
            productType: batchData.productType,
          },
          activities: allActivities,
          activityCounts: {
            measurements: measurements.length,
            additives: additives.length,
            rackings: rackings.length,
            filters: filters.length,
            carbonations: carbonations.length,
            bottlings: bottlings.length,
            kegFills: kegFillsData.length,
            total: allActivities.length,
          },
          childCount: childCount[0]?.count || 0,
          hasPackaging: bottlings.length > 0 || kegFillsData.length > 0,
          startDate,
          outgoingTransfers: outgoingTransfers.length,
        };
      } catch (error) {
        console.error("Error fetching child activity summary:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch child activity summary",
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
        // Define alias for source batch join
        const sourceBatch = aliasedTable(batches, "source_batch");

        const mergeHistory = await db
          .select({
            id: batchMergeHistory.id,
            sourcePressRunId: batchMergeHistory.sourcePressRunId,
            sourceBatchId: batchMergeHistory.sourceBatchId,
            sourceType: batchMergeHistory.sourceType,
            volumeAdded: batchMergeHistory.volumeAdded,
            volumeAddedUnit: batchMergeHistory.volumeAddedUnit,
            targetVolumeBefore: batchMergeHistory.targetVolumeBefore,
            targetVolumeBeforeUnit: batchMergeHistory.targetVolumeBeforeUnit,
            targetVolumeAfter: batchMergeHistory.targetVolumeAfter,
            targetVolumeAfterUnit: batchMergeHistory.targetVolumeAfterUnit,
            compositionSnapshot: batchMergeHistory.compositionSnapshot,
            sourceAbv: batchMergeHistory.sourceAbv,
            resultingAbv: batchMergeHistory.resultingAbv,
            notes: batchMergeHistory.notes,
            mergedAt: batchMergeHistory.mergedAt,
            pressRunName: pressRuns.pressRunName,
            sourceBatchName: sourceBatch.name,
            sourceBatchCustomName: sourceBatch.customName,
          })
          .from(batchMergeHistory)
          .leftJoin(
            pressRuns,
            eq(batchMergeHistory.sourcePressRunId, pressRuns.id),
          )
          .leftJoin(
            sourceBatch,
            eq(batchMergeHistory.sourceBatchId, sourceBatch.id),
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
        const volumeRackedL = convertToLiters(
          input.volumeAfter,
          input.volumeAfterUnit as "L" | "gal" | "mL"
        );
        const volumeLossL = volumeBeforeL - volumeRackedL;

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
            notes: input.notes,
          })
          .returning();

        // Update batch current volume
        await db
          .update(batches)
          .set({
            currentVolume: volumeRackedL.toFixed(3),
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
        volumeToRack: z.number().positive("Volume to rack must be positive"),
        loss: z.number().min(0, "Loss cannot be negative").optional(),
        rackedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        notes: z.string().optional(),
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
              productType: batches.productType,
              originalGravity: batches.originalGravity,
              finalGravity: batches.finalGravity,
              estimatedAbv: batches.estimatedAbv,
              actualAbv: batches.actualAbv,
              originPressRunId: batches.originPressRunId,
              originJuicePurchaseItemId: batches.originJuicePurchaseItemId,
              fermentationStage: batches.fermentationStage,
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
              fermentationStage: batches.fermentationStage,
              productType: batches.productType,
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

          // Determine if racking to self (for volume loss recording)
          const sourceVesselId = batch[0].vesselId;
          const isRackToSelf = sourceVesselId === input.destinationVesselId;

          // NOTE: hasBatchInDestination && !isRackToSelf will trigger MERGE flow below
          // We allow racking into occupied vessels to merge batches together

          const volumeBeforeL = batch[0].currentVolume
            ? parseFloat(batch[0].currentVolume)
            : 0;

          // Validate volumeToRack + loss is not greater than current volume
          const totalToRemove = input.volumeToRack + (input.loss || 0);
          if (totalToRemove > volumeBeforeL) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Volume to rack + loss (${totalToRemove.toFixed(1)}L) cannot be greater than current volume (${volumeBeforeL.toFixed(1)}L)`,
            });
          }

          // 3. Calculate remaining volume and auto-determine rack type
          // User-provided loss (defaults to 0)
          const userProvidedLoss = input.loss || 0;

          // Remaining = volumeBefore - volumeToRack - loss
          const remainingInSourceL = volumeBeforeL - input.volumeToRack - userProvidedLoss;

          // Auto-determine: if remaining < 1L, treat as full rack
          const isPartialRack = remainingInSourceL >= 1.0;

          let volumeLossL: number;
          let volumeRackedL: number; // Amount that goes to destination
          let volumeRemainingInSourceL: number; // Amount that stays in source (for partial racks)

          if (isPartialRack) {
            // Partial rack: split the batch (remaining >= 1L stays in source)
            volumeRackedL = input.volumeToRack;
            volumeLossL = userProvidedLoss; // Use user-provided loss
            volumeRemainingInSourceL = remainingInSourceL;
          } else {
            // Full rack: remainder < 1L is treated as additional loss
            volumeRackedL = input.volumeToRack;
            // Add any small remainder to user-provided loss
            volumeLossL = userProvidedLoss + Math.max(0, remainingInSourceL);
            volumeRemainingInSourceL = 0;
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
              volumeAfter: volumeRackedL.toString(),
              volumeAfterUnit: 'L',
              volumeLoss: volumeLossL.toString(),
              volumeLossUnit: 'L',
              rackedAt: input.rackedAt || new Date(),
              rackedBy: ctx.session?.user?.id,
              notes: input.notes,
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

            // SAFETY CHECK: If destination has a batch, MERGE instead of creating child batch
            const destCheckForPartial = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolume: batches.currentVolume,
                fermentationStage: batches.fermentationStage,
                productType: batches.productType,
              })
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, input.destinationVesselId),
                  isNull(batches.deletedAt)
                )
              )
              .limit(1);

            if (destCheckForPartial.length > 0) {
              // Destination has a batch - MERGE partial rack into it
              const destBatch = destCheckForPartial[0];
              const destCurrentVolumeL = parseFloat(destBatch.currentVolume || "0");
              const mergedVolumeL = destCurrentVolumeL + volumeRackedL;

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

              // Update source batch - reduce volume (partial rack keeps source active)
              await tx
                .update(batches)
                .set({
                  currentVolume: volumeRemainingInSourceL.toString(),
                  currentVolumeUnit: 'L',
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, input.batchId));

              // Create merge history entry for partial batch-to-batch merge
              await tx.insert(batchMergeHistory).values({
                targetBatchId: destBatch.id,
                sourceBatchId: input.batchId,
                sourceType: "batch_transfer",
                volumeAdded: volumeRackedL.toString(),
                volumeAddedUnit: "L",
                targetVolumeBefore: destCurrentVolumeL.toString(),
                targetVolumeBeforeUnit: "L",
                targetVolumeAfter: mergedVolumeL.toString(),
                targetVolumeAfterUnit: "L",
                mergedAt: input.rackedAt || new Date(),
                mergedBy: ctx.session?.user?.id,
                createdAt: new Date(),
              });

              // Propagate fermentation stage from source to destination if source is actively fermenting
              // and destination is not_started or unknown (prevents yeast inheritance being missed)
              const fermentingStages = ['early', 'mid', 'approaching_dry', 'terminal'];
              const sourceFermentationStage = batch[0].fermentationStage;
              const destFermentationStage = destBatch.fermentationStage;
              const destProductType = destBatch.productType;

              // Only propagate if:
              // 1. Source batch has a fermenting stage
              // 2. Destination batch is not_started or unknown
              // 3. Destination is not brandy/pommeau (which don't ferment)
              if (
                sourceFermentationStage &&
                fermentingStages.includes(sourceFermentationStage) &&
                (destFermentationStage === 'not_started' || destFermentationStage === 'unknown') &&
                destProductType !== 'brandy' &&
                destProductType !== 'pommeau'
              ) {
                await tx
                  .update(batches)
                  .set({
                    fermentationStage: sourceFermentationStage,
                    fermentationStageUpdatedAt: new Date(),
                  })
                  .where(eq(batches.id, destBatch.id));
              }

              // Calculate and create estimated blended measurements for partial rack merge
              const [srcMeasurement] = await tx
                .select()
                .from(batchMeasurements)
                .where(and(eq(batchMeasurements.batchId, input.batchId), isNull(batchMeasurements.deletedAt)))
                .orderBy(desc(batchMeasurements.measurementDate))
                .limit(1);

              const [dstMeasurement] = await tx
                .select()
                .from(batchMeasurements)
                .where(and(eq(batchMeasurements.batchId, destBatch.id), isNull(batchMeasurements.deletedAt)))
                .orderBy(desc(batchMeasurements.measurementDate))
                .limit(1);

              if (srcMeasurement || dstMeasurement) {
                const srcVol = volumeRackedL;
                const dstVol = destCurrentVolumeL;
                const totVol = mergedVolumeL;

                const blendVal = (sVal: string | null, dVal: string | null): string | null => {
                  const s = sVal ? parseFloat(sVal) : null;
                  const d = dVal ? parseFloat(dVal) : null;
                  if (s !== null && d !== null) return ((s * srcVol + d * dstVol) / totVol).toString();
                  if (s !== null) return s.toString();
                  if (d !== null) return d.toString();
                  return null;
                };

                const srcName = batch[0].customName || batch[0].name;
                const dstName = destBatch.name;

                await tx.insert(batchMeasurements).values({
                  batchId: destBatch.id,
                  measurementDate: input.rackedAt || new Date(),
                  specificGravity: blendVal(srcMeasurement?.specificGravity, dstMeasurement?.specificGravity),
                  abv: blendVal(srcMeasurement?.abv, dstMeasurement?.abv),
                  ph: blendVal(srcMeasurement?.ph, dstMeasurement?.ph),
                  totalAcidity: blendVal(srcMeasurement?.totalAcidity, dstMeasurement?.totalAcidity),
                  temperature: blendVal(srcMeasurement?.temperature, dstMeasurement?.temperature),
                  volume: mergedVolumeL.toString(),
                  volumeUnit: "L",
                  volumeLiters: mergedVolumeL.toString(),
                  isEstimated: true,
                  estimateSource: `Volume-weighted blend: ${srcVol.toFixed(1)}L from ${srcName} + ${dstVol.toFixed(1)}L from ${dstName}`,
                  notes: `Estimated values from partial rack merge`,
                  takenBy: ctx.session?.user?.name || "System",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }

              // Copy compositions from source batch to destination
              const srcCompositions = await tx
                .select()
                .from(batchCompositions)
                .where(and(eq(batchCompositions.batchId, input.batchId), isNull(batchCompositions.deletedAt)));

              for (const comp of srcCompositions) {
                // Scale composition by volume ratio
                const volumeRatio = volumeRackedL / volumeBeforeL;
                const scaledInputWeight = comp.inputWeightKg ? (parseFloat(comp.inputWeightKg) * volumeRatio).toString() : comp.inputWeightKg;
                const scaledJuiceVol = comp.juiceVolume ? (parseFloat(comp.juiceVolume) * volumeRatio).toString() : comp.juiceVolume;
                const scaledMaterialCost = comp.materialCost ? (parseFloat(comp.materialCost) * volumeRatio).toString() : comp.materialCost;
                const scaledEstSugar = comp.estSugarKg ? (parseFloat(comp.estSugarKg) * volumeRatio).toString() : comp.estSugarKg;
                await tx.insert(batchCompositions).values({
                  batchId: destBatch.id,
                  sourceType: comp.sourceType,
                  purchaseItemId: comp.purchaseItemId,
                  varietyId: comp.varietyId,
                  juicePurchaseItemId: comp.juicePurchaseItemId,
                  vendorId: comp.vendorId,
                  lotCode: comp.lotCode,
                  inputWeightKg: scaledInputWeight,
                  juiceVolume: scaledJuiceVol,
                  juiceVolumeUnit: comp.juiceVolumeUnit,
                  fractionOfBatch: comp.fractionOfBatch,
                  materialCost: scaledMaterialCost,
                  avgBrix: comp.avgBrix,
                  estSugarKg: scaledEstSugar,
                  abv: comp.abv, // Preserve ABV from source
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }

              // Recalculate fractions for all compositions on destination batch
              await recalculateCompositionFractions(tx, destBatch.id);

              resultMessage = `Partial rack merged into ${destBatch.name} in ${destinationVessel[0].name} (${destCurrentVolumeL.toFixed(1)}L + ${volumeRackedL.toFixed(1)}L = ${mergedVolumeL.toFixed(1)}L), ${volumeRemainingInSourceL.toFixed(1)}L remaining in source`;
            } else {
              // No batch in destination - proceed with normal partial rack (create child batch)

            // Generate child batch name using numeric batch number
            const rackDate = input.rackedAt || new Date();
            // Use current timestamp with milliseconds for unique suffix (not rackDate, to ensure uniqueness)
            const uniqueSuffix = Date.now().toString(36); // Base36 timestamp for compact unique ID
            const childBatchNumber = `${batch[0].batchNumber}-R${uniqueSuffix}`; // e.g., "25-Rm5abc123"
            const childBatchName = `Batch #${childBatchNumber}`; // e.g., "Batch #25-Rm5abc123"

            // Create child batch in destination vessel with racked volume
            // Note: initialVolume is 0 because the volume comes from a transfer, not as initial production
            const newBatch = await tx
              .insert(batches)
              .values({
                vesselId: input.destinationVesselId,
                name: childBatchName,
                customName: batch[0].customName, // Inherit parent's custom name without suffix
                batchNumber: childBatchNumber,
                initialVolume: "0", // Volume comes from transfer, not initial production
                initialVolumeUnit: 'L',
                initialVolumeLiters: "0",
                currentVolume: volumeRackedL.toString(),
                currentVolumeUnit: 'L',
                currentVolumeLiters: volumeRackedL.toString(),
                productType: batch[0].productType, // Inherit parent's product type
                startDate: rackDate,
                originPressRunId: batch[0].originPressRunId,
                originJuicePurchaseItemId: batch[0].originJuicePurchaseItemId,
                originalGravity: batch[0].originalGravity,
                finalGravity: batch[0].finalGravity,
                estimatedAbv: batch[0].estimatedAbv,
                actualAbv: batch[0].actualAbv,
                parentBatchId: input.batchId,
                isRackingDerivative: true,
              })
              .returning();

            newChildBatch = newBatch[0];

            // Copy composition from parent batch to child batch
            const parentComposition = await tx
              .select()
              .from(batchCompositions)
              .where(
                and(
                  eq(batchCompositions.batchId, input.batchId),
                  isNull(batchCompositions.deletedAt),
                ),
              );

            if (parentComposition.length > 0) {
              // Calculate volume ratio for the child batch (what was racked out)
              const volumeRatio = volumeRackedL / volumeBeforeL;

              for (const comp of parentComposition) {
                await tx.insert(batchCompositions).values({
                  batchId: newChildBatch.id,
                  sourceType: comp.sourceType,
                  purchaseItemId: comp.purchaseItemId,
                  varietyId: comp.varietyId,
                  juicePurchaseItemId: comp.juicePurchaseItemId,
                  vendorId: comp.vendorId,
                  lotCode: comp.lotCode,
                  inputWeightKg: comp.inputWeightKg
                    ? (parseFloat(comp.inputWeightKg) * volumeRatio).toString()
                    : "0",
                  juiceVolume: (parseFloat(comp.juiceVolume || "0") * volumeRatio).toString(),
                  juiceVolumeUnit: comp.juiceVolumeUnit,
                  fractionOfBatch: comp.fractionOfBatch, // Keep same fraction
                  materialCost: comp.materialCost
                    ? (parseFloat(comp.materialCost) * volumeRatio).toString()
                    : "0",
                  avgBrix: comp.avgBrix,
                  estSugarKg: comp.estSugarKg
                    ? (parseFloat(comp.estSugarKg) * volumeRatio).toString()
                    : undefined,
                  abv: comp.abv, // Preserve ABV from source
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }

            // Copy measurements from parent batch to child batch (up to rack date)
            const parentMeasurements = await tx
              .select()
              .from(batchMeasurements)
              .where(
                and(
                  eq(batchMeasurements.batchId, input.batchId),
                  isNull(batchMeasurements.deletedAt),
                  sql`${batchMeasurements.measurementDate} <= ${rackDate}`,
                ),
              );

            for (const measurement of parentMeasurements) {
              await tx.insert(batchMeasurements).values({
                batchId: newChildBatch.id,
                measurementDate: measurement.measurementDate,
                specificGravity: measurement.specificGravity,
                temperature: measurement.temperature,
                ph: measurement.ph,
                totalAcidity: measurement.totalAcidity,
                abv: measurement.abv,
                volume: measurement.volume,
                volumeUnit: measurement.volumeUnit,
                notes: measurement.notes,
                takenBy: measurement.takenBy,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // Copy additives from parent batch to child batch (up to rack date)
            const parentAdditives = await tx
              .select()
              .from(batchAdditives)
              .where(
                and(
                  eq(batchAdditives.batchId, input.batchId),
                  isNull(batchAdditives.deletedAt),
                  sql`${batchAdditives.addedAt} <= ${rackDate}`,
                ),
              );

            for (const additive of parentAdditives) {
              await tx.insert(batchAdditives).values({
                batchId: newChildBatch.id,
                vesselId: input.destinationVesselId,
                additiveType: additive.additiveType,
                additiveName: additive.additiveName,
                amount: additive.amount,
                unit: additive.unit,
                notes: additive.notes,
                addedAt: additive.addedAt,
                addedBy: additive.addedBy,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

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

            // Note: batchRackingOperations record (created earlier) captures all transfer info
            // No separate batchTransfers record needed - avoids duplicate activity entries

            resultMessage = `Partial rack complete: ${volumeRackedL.toFixed(1)}L transferred to ${destinationVessel[0].name}, ${volumeRemainingInSourceL.toFixed(1)}L remaining in source vessel`;
            }
          } else if (isRackToSelf) {
            // 5a. RACK TO SELF: Update volume and transition to aging, don't change vessel
            updatedBatch = await tx
              .update(batches)
              .set({
                currentVolume: volumeRackedL.toString(),
                currentVolumeUnit: 'L',
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))
              .returning();

            resultMessage = `Batch racked to itself in ${destinationVessel[0].name}. Sediment removed, volume loss recorded.`;
          } else if (hasBatchInDestination) {
            // 5b. MERGE: Add volume to existing destination batch, then mark source batch as completed
            const destBatch = destinationBatch[0];
            const destCurrentVolumeL = parseFloat(destBatch.currentVolume || "0");
            const mergedVolumeL = destCurrentVolumeL + volumeRackedL;

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

            // Mark source batch as completed and archived (not deleted - preserve history)
            await tx
              .update(batches)
              .set({
                vesselId: null, // Remove vessel assignment
                status: "completed",
                currentVolume: "0",
                isArchived: true,
                archivedAt: new Date(),
                archivedReason: 'Auto-archived: Batch fully transferred',
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));

            // Create merge history entry for batch-to-batch merge
            await tx.insert(batchMergeHistory).values({
              targetBatchId: destBatch.id,
              sourceBatchId: input.batchId,
              sourceType: "batch_transfer",
              volumeAdded: volumeRackedL.toString(),
              volumeAddedUnit: "L",
              targetVolumeBefore: destCurrentVolumeL.toString(),
              targetVolumeBeforeUnit: "L",
              targetVolumeAfter: mergedVolumeL.toString(),
              targetVolumeAfterUnit: "L",
              mergedAt: input.rackedAt || new Date(),
              mergedBy: ctx.session?.user?.id,
              createdAt: new Date(),
            });

            // Propagate fermentation stage from source to destination if source is actively fermenting
            // and destination is not_started or unknown (prevents yeast inheritance being missed)
            const fermentingStages = ['early', 'mid', 'approaching_dry', 'terminal'];
            const sourceFermentationStage = batch[0].fermentationStage;
            const destFermentationStage = destBatch.fermentationStage;
            const destProductType = destBatch.productType;

            // Only propagate if:
            // 1. Source batch has a fermenting stage
            // 2. Destination batch is not_started or unknown
            // 3. Destination is not brandy/pommeau (which don't ferment)
            if (
              sourceFermentationStage &&
              fermentingStages.includes(sourceFermentationStage) &&
              (destFermentationStage === 'not_started' || destFermentationStage === 'unknown') &&
              destProductType !== 'brandy' &&
              destProductType !== 'pommeau'
            ) {
              await tx
                .update(batches)
                .set({
                  fermentationStage: sourceFermentationStage,
                  fermentationStageUpdatedAt: new Date(),
                })
                .where(eq(batches.id, destBatch.id));
            }

            // Calculate and create estimated blended measurements
            const [sourceMeasurement] = await tx
              .select()
              .from(batchMeasurements)
              .where(and(eq(batchMeasurements.batchId, input.batchId), isNull(batchMeasurements.deletedAt)))
              .orderBy(desc(batchMeasurements.measurementDate))
              .limit(1);

            const [destMeasurement] = await tx
              .select()
              .from(batchMeasurements)
              .where(and(eq(batchMeasurements.batchId, destBatch.id), isNull(batchMeasurements.deletedAt)))
              .orderBy(desc(batchMeasurements.measurementDate))
              .limit(1);

            // Only create estimated measurement if at least one batch has measurements
            if (sourceMeasurement || destMeasurement) {
              const sourceVol = volumeRackedL;
              const destVol = destCurrentVolumeL;
              const totalVol = mergedVolumeL;

              // Helper function for volume-weighted average
              const blendValue = (sourceVal: string | null, destVal: string | null): string | null => {
                const sVal = sourceVal ? parseFloat(sourceVal) : null;
                const dVal = destVal ? parseFloat(destVal) : null;
                if (sVal !== null && dVal !== null) {
                  return ((sVal * sourceVol + dVal * destVol) / totalVol).toString();
                } else if (sVal !== null) {
                  return sVal.toString();
                } else if (dVal !== null) {
                  return dVal.toString();
                }
                return null;
              };

              const sourceBatchName = batch[0].customName || batch[0].name;
              const destBatchName = destBatch.customName || destBatch.name;

              await tx.insert(batchMeasurements).values({
                batchId: destBatch.id,
                measurementDate: input.rackedAt || new Date(),
                specificGravity: blendValue(sourceMeasurement?.specificGravity, destMeasurement?.specificGravity),
                abv: blendValue(sourceMeasurement?.abv, destMeasurement?.abv),
                ph: blendValue(sourceMeasurement?.ph, destMeasurement?.ph),
                totalAcidity: blendValue(sourceMeasurement?.totalAcidity, destMeasurement?.totalAcidity),
                temperature: blendValue(sourceMeasurement?.temperature, destMeasurement?.temperature),
                volume: mergedVolumeL.toString(),
                volumeUnit: "L",
                volumeLiters: mergedVolumeL.toString(),
                isEstimated: true,
                estimateSource: `Volume-weighted blend: ${sourceVol.toFixed(1)}L from ${sourceBatchName} + ${destVol.toFixed(1)}L from ${destBatchName}`,
                notes: `Estimated values from merge of ${sourceBatchName} into ${destBatchName}`,
                takenBy: ctx.session?.user?.name || "System",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // Copy compositions from source batch to destination (proportionally)
            const sourceCompositions = await tx
              .select()
              .from(batchCompositions)
              .where(and(eq(batchCompositions.batchId, input.batchId), isNull(batchCompositions.deletedAt)));

            for (const comp of sourceCompositions) {
              await tx.insert(batchCompositions).values({
                batchId: destBatch.id,
                sourceType: comp.sourceType,
                purchaseItemId: comp.purchaseItemId,
                varietyId: comp.varietyId,
                juicePurchaseItemId: comp.juicePurchaseItemId,
                vendorId: comp.vendorId,
                lotCode: comp.lotCode,
                inputWeightKg: comp.inputWeightKg,
                juiceVolume: comp.juiceVolume,
                juiceVolumeUnit: comp.juiceVolumeUnit,
                fractionOfBatch: comp.fractionOfBatch,
                materialCost: comp.materialCost,
                avgBrix: comp.avgBrix,
                estSugarKg: comp.estSugarKg,
                abv: comp.abv, // Preserve ABV from source
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // Recalculate fractions for all compositions on destination batch
            await recalculateCompositionFractions(tx, destBatch.id);

            resultMessage = `Batch racked and merged into ${destBatch.customName || destBatch.name} in ${destinationVessel[0].name}`;
          } else {
            // 5c. MOVE: Transfer batch to new empty vessel
            // SAFETY CHECK: Re-verify destination is actually empty to prevent data loss
            const destSafetyCheck = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolume: batches.currentVolume,
                fermentationStage: batches.fermentationStage,
                productType: batches.productType,
              })
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, input.destinationVesselId),
                  isNull(batches.deletedAt)
                )
              )
              .limit(1);

            if (destSafetyCheck.length > 0) {
              // Destination has a batch - MERGE instead of overwriting
              const destBatch = destSafetyCheck[0];
              const destCurrentVolumeL = parseFloat(destBatch.currentVolume || "0");
              const mergedVolumeL = destCurrentVolumeL + volumeRackedL;

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

              // Mark source batch as completed and archived (not deleted - preserve history)
              await tx
                .update(batches)
                .set({
                  vesselId: null,
                  status: "completed",
                  currentVolume: "0",
                  isArchived: true,
                  archivedAt: new Date(),
                  archivedReason: 'Auto-archived: Batch fully transferred',
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, input.batchId));

              // Create merge history entry for batch-to-batch merge (safety check path)
              await tx.insert(batchMergeHistory).values({
                targetBatchId: destBatch.id,
                sourceBatchId: input.batchId,
                sourceType: "batch_transfer",
                volumeAdded: volumeRackedL.toString(),
                volumeAddedUnit: "L",
                targetVolumeBefore: destCurrentVolumeL.toString(),
                targetVolumeBeforeUnit: "L",
                targetVolumeAfter: mergedVolumeL.toString(),
                targetVolumeAfterUnit: "L",
                mergedAt: input.rackedAt || new Date(),
                mergedBy: ctx.session?.user?.id,
                createdAt: new Date(),
              });

              // Propagate fermentation stage from source to destination if source is actively fermenting
              // and destination is not_started or unknown (prevents yeast inheritance being missed)
              const fermentingStagesSafety = ['early', 'mid', 'approaching_dry', 'terminal'];
              const sourceFermentationStageSafety = batch[0].fermentationStage;
              const destFermentationStageSafety = destBatch.fermentationStage;
              const destProductTypeSafety = destBatch.productType;

              if (
                sourceFermentationStageSafety &&
                fermentingStagesSafety.includes(sourceFermentationStageSafety) &&
                (destFermentationStageSafety === 'not_started' || destFermentationStageSafety === 'unknown') &&
                destProductTypeSafety !== 'brandy' &&
                destProductTypeSafety !== 'pommeau'
              ) {
                await tx
                  .update(batches)
                  .set({
                    fermentationStage: sourceFermentationStageSafety,
                    fermentationStageUpdatedAt: new Date(),
                  })
                  .where(eq(batches.id, destBatch.id));
              }

              // Calculate and create estimated blended measurements (safety check path)
              const [sourceMeasurementSafety] = await tx
                .select()
                .from(batchMeasurements)
                .where(and(eq(batchMeasurements.batchId, input.batchId), isNull(batchMeasurements.deletedAt)))
                .orderBy(desc(batchMeasurements.measurementDate))
                .limit(1);

              const [destMeasurementSafety] = await tx
                .select()
                .from(batchMeasurements)
                .where(and(eq(batchMeasurements.batchId, destBatch.id), isNull(batchMeasurements.deletedAt)))
                .orderBy(desc(batchMeasurements.measurementDate))
                .limit(1);

              // Only create estimated measurement if at least one batch has measurements
              if (sourceMeasurementSafety || destMeasurementSafety) {
                const sourceVol = volumeRackedL;
                const destVol = destCurrentVolumeL;
                const totalVol = mergedVolumeL;

                // Helper function for volume-weighted average
                const blendValueSafety = (sourceVal: string | null, destVal: string | null): string | null => {
                  const sVal = sourceVal ? parseFloat(sourceVal) : null;
                  const dVal = destVal ? parseFloat(destVal) : null;
                  if (sVal !== null && dVal !== null) {
                    return ((sVal * sourceVol + dVal * destVol) / totalVol).toString();
                  } else if (sVal !== null) {
                    return sVal.toString();
                  } else if (dVal !== null) {
                    return dVal.toString();
                  }
                  return null;
                };

                const sourceBatchNameSafety = batch[0].customName || batch[0].name;
                const destBatchNameSafety = destBatch.name;

                await tx.insert(batchMeasurements).values({
                  batchId: destBatch.id,
                  measurementDate: input.rackedAt || new Date(),
                  specificGravity: blendValueSafety(sourceMeasurementSafety?.specificGravity, destMeasurementSafety?.specificGravity),
                  abv: blendValueSafety(sourceMeasurementSafety?.abv, destMeasurementSafety?.abv),
                  ph: blendValueSafety(sourceMeasurementSafety?.ph, destMeasurementSafety?.ph),
                  totalAcidity: blendValueSafety(sourceMeasurementSafety?.totalAcidity, destMeasurementSafety?.totalAcidity),
                  temperature: blendValueSafety(sourceMeasurementSafety?.temperature, destMeasurementSafety?.temperature),
                  volume: mergedVolumeL.toString(),
                  volumeUnit: "L",
                  volumeLiters: mergedVolumeL.toString(),
                  isEstimated: true,
                  estimateSource: `Volume-weighted blend: ${sourceVol.toFixed(1)}L from ${sourceBatchNameSafety} + ${destVol.toFixed(1)}L from ${destBatchNameSafety}`,
                  notes: `Estimated values from merge of ${sourceBatchNameSafety} into ${destBatchNameSafety}`,
                  takenBy: ctx.session?.user?.name || "System",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }

              // Copy compositions from source batch to destination (safety check path)
              const sourceCompositionsSafety = await tx
                .select()
                .from(batchCompositions)
                .where(and(eq(batchCompositions.batchId, input.batchId), isNull(batchCompositions.deletedAt)));

              for (const comp of sourceCompositionsSafety) {
                await tx.insert(batchCompositions).values({
                  batchId: destBatch.id,
                  sourceType: comp.sourceType,
                  purchaseItemId: comp.purchaseItemId,
                  varietyId: comp.varietyId,
                  juicePurchaseItemId: comp.juicePurchaseItemId,
                  vendorId: comp.vendorId,
                  lotCode: comp.lotCode,
                  inputWeightKg: comp.inputWeightKg,
                  juiceVolume: comp.juiceVolume,
                  juiceVolumeUnit: comp.juiceVolumeUnit,
                  fractionOfBatch: comp.fractionOfBatch,
                  materialCost: comp.materialCost,
                  avgBrix: comp.avgBrix,
                  estSugarKg: comp.estSugarKg,
                  abv: comp.abv, // Preserve ABV from source
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }

              // Recalculate fractions for all compositions on destination batch
              await recalculateCompositionFractions(tx, destBatch.id);

              resultMessage = `Batch racked and merged into ${destBatch.name} in ${destinationVessel[0].name} (${destCurrentVolumeL.toFixed(1)}L + ${volumeRackedL.toFixed(1)}L = ${mergedVolumeL.toFixed(1)}L)`;
            } else {
              // Full rack: Move batch to destination vessel
              updatedBatch = await tx
                .update(batches)
                .set({
                  vesselId: input.destinationVesselId,
                  currentVolume: volumeRackedL.toString(),
                  currentVolumeUnit: 'L',
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, input.batchId))
                .returning();

              resultMessage = `Batch racked to ${destinationVessel[0].name}`;
            }
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

            // Clear press runs pointing to the source vessel
            // This prevents the liquidMap query from showing stale press run volume
            await tx
              .update(pressRuns)
              .set({
                vesselId: null,
                updatedAt: new Date(),
              })
              .where(eq(pressRuns.vesselId, sourceVesselId));
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
                fermentationStage: "not_started", // Juice batch awaiting fermentation
                fermentationStageUpdatedAt: new Date(),
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
              abv: "0", // Fresh juice has 0% ABV
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
              abv: "0", // Fresh juice has 0% ABV
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            console.log("✅ Batch composition created for merged juice purchase");

            // Recalculate fractions for all compositions on the batch
            await recalculateCompositionFractions(tx, batchId);

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

        // Check for active keg fills that reference this batch
        const activeKegFills = await db
          .select({ id: kegFills.id, kegNumber: kegs.kegNumber })
          .from(kegFills)
          .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
          .where(
            and(
              eq(kegFills.batchId, input.batchId),
              inArray(kegFills.status, ["filled", "distributed"]),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(5);

        if (activeKegFills.length > 0) {
          const kegNumbers = activeKegFills.map(f => f.kegNumber).join(", ");
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot delete batch with active keg fills. Return or void kegs first: ${kegNumbers}`,
          });
        }

        // Soft delete the batch and clear vessel association
        await db
          .update(batches)
          .set({
            deletedAt: new Date(),
            vesselId: null,
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

  /**
   * Get fermentation progress for a batch
   * Calculates stage, percentage fermented, stall detection, and recommendations
   */
  getFermentationProgress: createRbacProcedure("read", "batch")
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        // Get batch with original gravity and target FG
        const batch = await db
          .select({
            id: batches.id,
            name: batches.name,
            originalGravity: batches.originalGravity,
            targetFinalGravity: batches.targetFinalGravity,
            fermentationStage: batches.fermentationStage,
            status: batches.status,
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

        const batchData = batch[0];

        // Get all measurements for the batch (newest first)
        const measurements = await db
          .select({
            specificGravity: batchMeasurements.specificGravity,
            measurementDate: batchMeasurements.measurementDate,
            measurementMethod: batchMeasurements.measurementMethod,
          })
          .from(batchMeasurements)
          .where(
            and(
              eq(batchMeasurements.batchId, input.batchId),
              isNull(batchMeasurements.deletedAt)
            )
          )
          .orderBy(desc(batchMeasurements.measurementDate));

        // Get organization settings for thresholds
        const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
        const [settings] = await db
          .select({
            fermentationStageEarlyMax: organizationSettings.fermentationStageEarlyMax,
            fermentationStageMidMax: organizationSettings.fermentationStageMidMax,
            fermentationStageApproachingDryMax: organizationSettings.fermentationStageApproachingDryMax,
            stallDetectionEnabled: organizationSettings.stallDetectionEnabled,
            stallDetectionDays: organizationSettings.stallDetectionDays,
            stallDetectionThreshold: organizationSettings.stallDetectionThreshold,
            terminalConfirmationHours: organizationSettings.terminalConfirmationHours,
            defaultTargetFgDry: organizationSettings.defaultTargetFgDry,
          })
          .from(organizationSettings)
          .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
          .limit(1);

        // Build stage thresholds from settings
        const stageThresholds: StageThresholds = {
          earlyMax: settings?.fermentationStageEarlyMax ?? 70,
          midMax: settings?.fermentationStageMidMax ?? 90,
          approachingDryMax: settings?.fermentationStageApproachingDryMax ?? 98,
        };

        // Build stall settings from settings
        const stallSettings: StallSettings = {
          enabled: settings?.stallDetectionEnabled ?? true,
          days: settings?.stallDetectionDays ?? 3,
          threshold: settings?.stallDetectionThreshold
            ? parseFloat(settings.stallDetectionThreshold)
            : 0.001,
        };

        const terminalConfirmationHours = settings?.terminalConfirmationHours ?? 48;

        // Get current SG (from most recent measurement)
        const currentSg = measurements.length > 0 && measurements[0].specificGravity
          ? parseFloat(measurements[0].specificGravity)
          : null;

        // Get OG from batch
        const originalGravity = batchData.originalGravity
          ? parseFloat(batchData.originalGravity)
          : null;

        // Get target FG (from batch or default to dry style)
        const targetFinalGravity = batchData.targetFinalGravity
          ? parseFloat(batchData.targetFinalGravity)
          : (settings?.defaultTargetFgDry
            ? parseFloat(settings.defaultTargetFgDry)
            : 0.998);

        // Convert measurements to FermentationMeasurement format
        const fermentationMeasurements: FermentationMeasurement[] = measurements
          .filter(m => m.specificGravity !== null)
          .map(m => ({
            specificGravity: parseFloat(m.specificGravity!),
            measurementDate: new Date(m.measurementDate),
            method: (m.measurementMethod as "hydrometer" | "refractometer" | "calculated") || "hydrometer",
          }));

        // Calculate fermentation progress using the lib function
        const progress = analyzeFermentationProgress({
          originalGravity,
          currentGravity: currentSg,
          targetFinalGravity,
          measurements: fermentationMeasurements,
          stageThresholds,
          stallSettings,
          terminalConfirmationHours,
        });

        // Update batch fermentation stage if it changed
        if (progress.stage !== batchData.fermentationStage && progress.stage !== "unknown") {
          await db
            .update(batches)
            .set({
              fermentationStage: progress.stage,
              fermentationStageUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, input.batchId));
        }

        return {
          batchId: input.batchId,
          batchName: batchData.name,
          originalGravity,
          currentGravity: currentSg,
          targetFinalGravity,
          ...progress,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting fermentation progress:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get fermentation progress",
        });
      }
    }),

  // Create batch from juice purchase (for purchased juice, cider, or brandy)
  createFromJuicePurchase: createRbacProcedure("create", "batch")
    .input(
      z.object({
        juicePurchaseItemId: z.string().uuid("Invalid juice purchase item ID"),
        volumeL: z.number().positive("Volume must be positive"),
        vesselId: z.string().uuid().optional(),
        productType: z.enum(["juice", "cider", "perry", "brandy", "other"]).default("juice"),
        name: z.string().optional(),
        startDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Get the juice purchase item
          const [juiceItem] = await tx
            .select({
              id: juicePurchaseItems.id,
              purchaseId: juicePurchaseItems.purchaseId,
              juiceType: juicePurchaseItems.juiceType,
              varietyName: juicePurchaseItems.varietyName,
              volume: juicePurchaseItems.volume,
              volumeAllocated: juicePurchaseItems.volumeAllocated,
              brix: juicePurchaseItems.brix,
              specificGravity: juicePurchaseItems.specificGravity,
              pricePerLiter: juicePurchaseItems.pricePerLiter,
              vendorId: juicePurchases.vendorId,
              vendorName: vendors.name,
            })
            .from(juicePurchaseItems)
            .leftJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
            .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
            .where(
              and(
                eq(juicePurchaseItems.id, input.juicePurchaseItemId),
                isNull(juicePurchaseItems.deletedAt)
              )
            )
            .limit(1);

          if (!juiceItem) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Juice purchase item not found",
            });
          }

          // Check available volume
          const totalVolume = parseFloat(juiceItem.volume || "0");
          const allocated = parseFloat(juiceItem.volumeAllocated || "0");
          const available = totalVolume - allocated;

          if (input.volumeL > available) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Only ${available.toFixed(1)}L available (requested ${input.volumeL}L)`,
            });
          }

          // Generate batch number
          const year = new Date().getFullYear();
          const existingCount = await tx
            .select({ count: sql<number>`count(*)` })
            .from(batches)
            .where(
              and(
                sql`EXTRACT(YEAR FROM ${batches.startDate}) = ${year}`,
                isNull(batches.deletedAt)
              )
            );
          const batchNumber = `${year}-${String((existingCount[0]?.count || 0) + 1).padStart(3, "0")}`;

          // Generate batch name
          const batchName = input.name ||
            `${juiceItem.juiceType || juiceItem.varietyName || "Juice"} ${batchNumber}`;

          // Calculate initial SG from brix if available
          let originalGravity: string | null = null;
          if (juiceItem.specificGravity) {
            originalGravity = juiceItem.specificGravity;
          } else if (juiceItem.brix) {
            // Convert brix to SG: SG = 1 + (brix / (258.6 - 0.8796 * brix))
            const brix = parseFloat(juiceItem.brix);
            const sg = 1 + (brix / (258.6 - 0.8796 * brix));
            originalGravity = sg.toFixed(4);
          }

          // Calculate material cost
          const materialCost = juiceItem.pricePerLiter
            ? (input.volumeL * parseFloat(juiceItem.pricePerLiter)).toFixed(2)
            : "0";

          // Determine fermentation stage based on product type
          // juice/cider/perry: not_started (awaiting fermentation)
          // brandy/pommeau: not_applicable (don't ferment)
          // other: unknown
          const fermentationStage = ["brandy", "pommeau"].includes(input.productType)
            ? "not_applicable"
            : ["juice", "cider", "perry"].includes(input.productType)
            ? "not_started"
            : "unknown";

          // Create the batch
          const [newBatch] = await tx
            .insert(batches)
            .values({
              name: batchName,
              batchNumber,
              vesselId: input.vesselId || null,
              originJuicePurchaseItemId: input.juicePurchaseItemId,
              initialVolume: input.volumeL.toString(),
              initialVolumeUnit: "L",
              initialVolumeLiters: input.volumeL.toString(),
              currentVolume: input.volumeL.toString(),
              currentVolumeUnit: "L",
              currentVolumeLiters: input.volumeL.toString(),
              productType: input.productType,
              status: input.productType === "brandy" ? "aging" : "fermentation",
              fermentationStage,
              fermentationStageUpdatedAt: new Date(),
              startDate: input.startDate || new Date(),
              originalGravity,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create batch composition record for COGS tracking
          await tx.insert(batchCompositions).values({
            batchId: newBatch.id,
            sourceType: "juice_purchase",
            juicePurchaseItemId: input.juicePurchaseItemId,
            vendorId: juiceItem.vendorId!,
            juiceVolume: input.volumeL.toString(),
            juiceVolumeUnit: "L",
            materialCost,
            avgBrix: juiceItem.brix || null,
            abv: "0", // Fresh juice has 0% ABV
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Update the juice purchase item's allocated volume
          await tx
            .update(juicePurchaseItems)
            .set({
              volumeAllocated: (allocated + input.volumeL).toString(),
              updatedAt: new Date(),
            })
            .where(eq(juicePurchaseItems.id, input.juicePurchaseItemId));

          return {
            success: true,
            batch: newBatch,
            message: `Batch "${batchName}" created from juice purchase`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating batch from juice purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create batch from juice purchase",
        });
      }
    }),

  // Create fruit wine batch (whole fruit maceration)
  createFruitWineBatch: createRbacProcedure("create", "batch")
    .input(
      z.object({
        fruitPurchaseItemId: z.string().uuid("Invalid fruit purchase item ID"),
        fruitWeightKg: z.number().positive("Fruit weight must be positive"),
        vesselId: z.string().uuid("Vessel is required for fruit wine"),
        waterAddedL: z.number().min(0).default(0),
        sugarAddedKg: z.number().min(0).default(0),
        estimatedVolumeL: z.number().positive().optional(),
        name: z.string().optional(),
        startDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Get the fruit purchase item with variety info
          const [fruitItem] = await tx
            .select({
              id: basefruitPurchaseItems.id,
              purchaseId: basefruitPurchaseItems.purchaseId,
              quantityKg: basefruitPurchaseItems.quantityKg,
              quantity: basefruitPurchaseItems.quantity,
              unit: basefruitPurchaseItems.unit,
              isDepleted: basefruitPurchaseItems.isDepleted,
              pricePerUnit: basefruitPurchaseItems.pricePerUnit,
              totalCost: basefruitPurchaseItems.totalCost,
              varietyId: basefruitPurchaseItems.fruitVarietyId,
              varietyName: baseFruitVarieties.name,
              fruitType: baseFruitVarieties.fruitType,
              vendorId: basefruitPurchases.vendorId,
              vendorName: vendors.name,
            })
            .from(basefruitPurchaseItems)
            .leftJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
            .leftJoin(baseFruitVarieties, eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id))
            .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .where(
              and(
                eq(basefruitPurchaseItems.id, input.fruitPurchaseItemId),
                isNull(basefruitPurchaseItems.deletedAt)
              )
            )
            .limit(1);

          if (!fruitItem) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Fruit purchase item not found",
            });
          }

          if (fruitItem.isDepleted) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This fruit inventory has been depleted",
            });
          }

          // Check available quantity
          const availableKg = parseFloat(fruitItem.quantityKg || "0");
          if (input.fruitWeightKg > availableKg) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Only ${availableKg.toFixed(1)}kg available (requested ${input.fruitWeightKg}kg)`,
            });
          }

          // Verify vessel exists
          const [vessel] = await tx
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

          // Generate batch number
          const year = new Date().getFullYear();
          const existingCount = await tx
            .select({ count: sql<number>`count(*)` })
            .from(batches)
            .where(
              and(
                sql`EXTRACT(YEAR FROM ${batches.startDate}) = ${year}`,
                isNull(batches.deletedAt)
              )
            );
          const batchNumber = `${year}-${String((existingCount[0]?.count || 0) + 1).padStart(3, "0")}`;

          // Generate batch name
          const fruitName = fruitItem.varietyName || fruitItem.fruitType || "Fruit";
          const batchName = input.name || `${fruitName} Wine ${batchNumber}`;

          // Estimate volume: fruit + water (fruit contributes ~60-70% of its weight as juice)
          const estimatedJuiceFromFruit = input.fruitWeightKg * 0.65; // ~65% juice yield
          const estimatedVolumeL = input.estimatedVolumeL ||
            (estimatedJuiceFromFruit + input.waterAddedL);

          // Calculate material cost (proportional to weight used)
          const totalCost = parseFloat(fruitItem.totalCost || "0");
          const totalKg = parseFloat(fruitItem.quantityKg || "1");
          const materialCost = ((input.fruitWeightKg / totalKg) * totalCost).toFixed(2);

          // Create the batch
          const [newBatch] = await tx
            .insert(batches)
            .values({
              name: batchName,
              batchNumber,
              vesselId: input.vesselId,
              initialVolume: estimatedVolumeL.toString(),
              initialVolumeUnit: "L",
              initialVolumeLiters: estimatedVolumeL.toString(),
              currentVolume: estimatedVolumeL.toString(),
              currentVolumeUnit: "L",
              currentVolumeLiters: estimatedVolumeL.toString(),
              productType: "other", // Fruit wine
              status: "fermentation",
              fermentationStage: "not_started", // Fruit wine awaiting fermentation
              fermentationStageUpdatedAt: new Date(),
              startDate: input.startDate || new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create batch composition record for COGS tracking
          await tx.insert(batchCompositions).values({
            batchId: newBatch.id,
            sourceType: "base_fruit",
            purchaseItemId: input.fruitPurchaseItemId,
            varietyId: fruitItem.varietyId,
            vendorId: fruitItem.vendorId!,
            inputWeightKg: input.fruitWeightKg.toString(),
            juiceVolume: estimatedVolumeL.toString(),
            juiceVolumeUnit: "L",
            materialCost,
            abv: "0", // Fresh juice has 0% ABV
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Record water and sugar additions as notes or additives
          if (input.waterAddedL > 0 || input.sugarAddedKg > 0 || input.notes) {
            const additionNotes: string[] = [];
            if (input.waterAddedL > 0) {
              additionNotes.push(`Water added: ${input.waterAddedL}L`);
            }
            if (input.sugarAddedKg > 0) {
              additionNotes.push(`Sugar added: ${input.sugarAddedKg}kg`);
            }
            if (input.notes) {
              additionNotes.push(input.notes);
            }

            // Add as batch additive record for traceability
            if (input.sugarAddedKg > 0) {
              await tx.insert(batchAdditives).values({
                batchId: newBatch.id,
                vesselId: input.vesselId,
                additiveType: "sugar",
                additiveName: "Sugar (initial)",
                amount: input.sugarAddedKg.toString(),
                unit: "kg",
                addedAt: input.startDate || new Date(),
                notes: "Added at batch creation",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }

          // Update fruit inventory - reduce available quantity
          const remainingKg = availableKg - input.fruitWeightKg;
          await tx
            .update(basefruitPurchaseItems)
            .set({
              quantityKg: remainingKg.toString(),
              isDepleted: remainingKg <= 0,
              depletedAt: remainingKg <= 0 ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(basefruitPurchaseItems.id, input.fruitPurchaseItemId));

          return {
            success: true,
            batch: newBatch,
            message: `Fruit wine batch "${batchName}" created`,
            details: {
              fruitUsedKg: input.fruitWeightKg,
              waterAddedL: input.waterAddedL,
              sugarAddedKg: input.sugarAddedKg,
              estimatedVolumeL,
            },
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating fruit wine batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create fruit wine batch",
        });
      }
    }),

  /**
   * Update measurement schedule override for a batch
   * Allows customizing measurement frequency and types for individual batches
   */
  updateMeasurementScheduleOverride: createRbacProcedure("update", "batch")
    .input(
      z.object({
        batchId: z.string().uuid(),
        override: z
          .object({
            intervalDays: z.number().int().min(1).optional(),
            measurementTypes: z
              .array(z.enum(["sg", "abv", "ph", "temperature", "sensory", "volume"]))
              .optional(),
            alertType: z
              .enum(["check_in_reminder", "measurement_overdue"])
              .nullable()
              .optional(),
            notes: z.string().optional(),
          })
          .nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { batchId, override } = input;

      // Verify batch exists
      const existingBatch = await db
        .select({ id: batches.id })
        .from(batches)
        .where(and(eq(batches.id, batchId), isNull(batches.deletedAt)))
        .limit(1);

      if (!existingBatch.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      // Update the batch with the override (null clears the override)
      await db
        .update(batches)
        .set({
          measurementScheduleOverride: override,
          updatedAt: new Date(),
        })
        .where(eq(batches.id, batchId));

      return {
        success: true,
        message: override
          ? "Measurement schedule override applied"
          : "Measurement schedule override cleared (using product type defaults)",
      };
    }),

  /**
   * Get measurement schedule override for a batch
   */
  getMeasurementScheduleOverride: protectedProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const { batchId } = input;

      const batch = await db
        .select({
          measurementScheduleOverride: batches.measurementScheduleOverride,
          productType: batches.productType,
        })
        .from(batches)
        .where(and(eq(batches.id, batchId), isNull(batches.deletedAt)))
        .limit(1);

      if (!batch.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      return {
        override: batch[0].measurementScheduleOverride,
        productType: batch[0].productType,
      };
    }),

  // ============================================
  // LEGACY INVENTORY BATCHES
  // ============================================

  /**
   * Create a legacy inventory batch for TTB reconciliation.
   * These batches have no origin (no press run or juice purchase) and represent
   * pre-system inventory that needs to be tracked for TTB compliance.
   */
  createLegacyBatch: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        volumeGallons: z.number().positive("Volume must be positive"),
        productType: z.enum(["cider", "wine", "brandy", "perry"]),
        taxClass: z.enum([
          "hardCider",
          "wineUnder16",
          "wine16To21",
          "wine21To24",
          "sparklingWine",
          "carbonatedWine",
          "appleBrandy",
          "grapeSpirits",
        ]),
        notes: z.string().optional(),
        asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        // Extended batch information
        originalGravity: z.number().min(0.990).max(1.200).optional(),
        finalGravity: z.number().min(0.990).max(1.200).optional(),
        ph: z.number().min(0).max(14).optional(),
        vesselId: z.string().uuid().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Override asOfDate for batch start
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        name,
        volumeGallons,
        productType: inputProductType,
        taxClass,
        notes,
        asOfDate,
        originalGravity,
        finalGravity,
        ph,
        vesselId,
        startDate,
      } = input;

      // Map product type to valid schema enum values
      // "wine" maps to "other" since wine is not in the productTypeEnum
      const productType = inputProductType === "wine" ? "other" as const : inputProductType;

      // Convert gallons to liters
      const volumeLiters = volumeGallons * 3.78541;

      // Generate a unique batch number for legacy batches
      const year = (startDate || asOfDate).split("-")[0];
      const timestamp = Date.now().toString(36).toUpperCase();
      const batchNumber = `LEGACY-${year}-${timestamp}`;

      // Store tax class and notes in customName field (notes field doesn't exist on batches)
      const customNameValue = notes
        ? `[Legacy] Tax Class: ${taxClass} | ${notes}`
        : `[Legacy] Tax Class: ${taxClass}`;

      // Calculate ABV if both gravities provided
      let estimatedAbv: string | undefined;
      if (originalGravity && finalGravity) {
        const abv = (originalGravity - finalGravity) * 131.25;
        estimatedAbv = abv.toFixed(2);
      }

      // Check if a batch with this name already exists
      const existingBatch = await db
        .select({ id: batches.id, name: batches.name })
        .from(batches)
        .where(eq(batches.name, name))
        .limit(1);

      if (existingBatch.length > 0) {
        // Batch already exists, return it without creating a duplicate
        return {
          success: true,
          skipped: true,
          message: `Batch "${name}" already exists`,
          batch: {
            id: existingBatch[0].id,
            name: existingBatch[0].name,
            batchNumber: "",
            volumeGallons,
            volumeLiters,
            productType: inputProductType,
            taxClass,
            asOfDate,
            originalGravity,
            finalGravity,
            ph,
            vesselId,
            startDate,
          },
        };
      }

      // Create the legacy batch
      const [newBatch] = await db
        .insert(batches)
        .values({
          name,
          batchNumber,
          customName: customNameValue,
          initialVolume: volumeLiters.toFixed(3),
          initialVolumeUnit: "L",
          currentVolumeLiters: volumeLiters.toFixed(3),
          status: "completed", // Legacy batches are already done fermenting
          productType,
          fermentationStage: "terminal", // Already complete
          startDate: new Date(startDate || asOfDate),
          // Origin tracking - these are legacy/pre-system batches
          originPressRunId: null,
          originJuicePurchaseItemId: null,
          vesselId: vesselId || null, // Assign to vessel if provided
          createdBy: ctx.session?.user?.id,
          // Gravity tracking
          originalGravity: originalGravity?.toFixed(3),
          finalGravity: finalGravity?.toFixed(3),
          estimatedAbv,
        })
        .returning();

      // If pH provided, create an initial measurement
      if (ph !== undefined) {
        await db.insert(batchMeasurements).values({
          batchId: newBatch.id,
          measurementDate: new Date(startDate || asOfDate),
          ph: ph.toFixed(2),
          specificGravity: finalGravity?.toFixed(4) || originalGravity?.toFixed(4),
          notes: "Initial measurement from legacy batch import",
          takenBy: ctx.session?.user?.name || "Legacy Import",
        });
      }

      return {
        success: true,
        batch: {
          id: newBatch.id,
          name: newBatch.name,
          batchNumber: newBatch.batchNumber,
          volumeGallons,
          volumeLiters,
          productType: inputProductType, // Return the original input for UI
          taxClass,
          asOfDate,
          originalGravity,
          finalGravity,
          ph,
          vesselId,
          startDate,
        },
      };
    }),

  /**
   * Get all legacy inventory batches.
   * Legacy batches are identified by having no origin press run or juice purchase.
   */
  getLegacyBatches: protectedProcedure.query(async () => {
    const legacyBatches = await db
      .select({
        id: batches.id,
        name: batches.name,
        batchNumber: batches.batchNumber,
        customName: batches.customName,
        initialVolumeLiters: batches.initialVolume,
        currentVolumeLiters: batches.currentVolumeLiters,
        status: batches.status,
        productType: batches.productType,
        startDate: batches.startDate,
        createdAt: batches.createdAt,
      })
      .from(batches)
      .where(
        and(
          isNull(batches.deletedAt),
          isNull(batches.originPressRunId),
          isNull(batches.originJuicePurchaseItemId),
          // Legacy batches have batch numbers starting with LEGACY-
          like(batches.batchNumber, "LEGACY-%")
        )
      )
      .orderBy(desc(batches.createdAt));

    return legacyBatches.map((batch) => {
      const volumeLiters = parseFloat(batch.initialVolumeLiters || "0");
      const volumeGallons = volumeLiters * 0.264172;

      // Extract tax class from customName field
      let taxClass = "hardCider";
      let notes: string | null = null;
      if (batch.customName) {
        const taxClassMatch = batch.customName.match(/Tax Class: (\w+)/);
        if (taxClassMatch) {
          taxClass = taxClassMatch[1];
        }
        // Extract notes (everything after the pipe separator)
        const pipeIndex = batch.customName.indexOf(" | ");
        if (pipeIndex > -1) {
          notes = batch.customName.slice(pipeIndex + 3);
        }
      }

      return {
        id: batch.id,
        name: batch.name,
        batchNumber: batch.batchNumber,
        volumeGallons: parseFloat(volumeGallons.toFixed(1)),
        volumeLiters: parseFloat(volumeLiters.toFixed(1)),
        status: batch.status,
        productType: batch.productType,
        taxClass,
        asOfDate: batch.startDate?.toISOString().split("T")[0] || null,
        notes,
        createdAt: batch.createdAt,
      };
    });
  }),

  /**
   * Get volume trace for a batch - shows where all volume went.
   * Used for TTB reconciliation to trace volume discrepancies.
   */
  getVolumeTrace: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { batchId } = input;

      // Get batch metadata
      const [batch] = await db
        .select({
          id: batches.id,
          name: batches.name,
          customName: batches.customName,
          batchNumber: batches.batchNumber,
          initialVolume: batches.initialVolumeLiters,
          currentVolume: batches.currentVolumeLiters,
          status: batches.status,
          parentBatchId: batches.parentBatchId,
        })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      // Destination batch alias for transfers
      const destBatch = aliasedTable(batches, "destBatch");
      const sourceVessel = aliasedTable(vessels, "sourceVessel");
      const destVessel = aliasedTable(vessels, "destVessel");

      // Query all volume flow sources
      // 1. Transfers out (to child batches)
      const transfersOut = await db
        .select({
          id: batchTransfers.id,
          date: batchTransfers.transferredAt,
          volumeOut: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          destinationId: batchTransfers.destinationBatchId,
          destinationName: destBatch.customName,
          destinationBatchNumber: destBatch.batchNumber,
        })
        .from(batchTransfers)
        .leftJoin(destBatch, eq(batchTransfers.destinationBatchId, destBatch.id))
        .where(
          and(
            eq(batchTransfers.sourceBatchId, batchId),
            // Exclude self-referencing transfers
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            // Exclude deleted transfers
            isNull(batchTransfers.deletedAt)
          )
        )
        .orderBy(asc(batchTransfers.transferredAt));

      // 1b. Transfers in (from other batches, e.g., blending)
      // First get the transfer records
      const transfersInRaw = await db
        .select({
          id: batchTransfers.id,
          date: batchTransfers.transferredAt,
          volumeIn: batchTransfers.volumeTransferred,
          sourceId: batchTransfers.sourceBatchId,
        })
        .from(batchTransfers)
        .where(
          and(
            eq(batchTransfers.destinationBatchId, batchId),
            // Exclude self-referencing transfers
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            // Exclude deleted transfers
            isNull(batchTransfers.deletedAt)
          )
        )
        .orderBy(asc(batchTransfers.transferredAt));

      // Then look up source batch names
      const transfersIn = await Promise.all(
        transfersInRaw.map(async (t) => {
          const sourceBatchInfo = await db
            .select({ customName: batches.customName, batchNumber: batches.batchNumber })
            .from(batches)
            .where(eq(batches.id, t.sourceId))
            .limit(1);
          return {
            ...t,
            sourceName: sourceBatchInfo[0]?.customName || null,
            sourceBatchNumber: sourceBatchInfo[0]?.batchNumber || null,
          };
        })
      );

      // 2. Racking operations (losses during vessel moves)
      const rackings = await db
        .select({
          id: batchRackingOperations.id,
          date: batchRackingOperations.rackedAt,
          volumeBefore: batchRackingOperations.volumeBefore,
          volumeAfter: batchRackingOperations.volumeAfter,
          loss: batchRackingOperations.volumeLoss,
          sourceVesselName: sourceVessel.name,
          destVesselName: destVessel.name,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .leftJoin(sourceVessel, eq(batchRackingOperations.sourceVesselId, sourceVessel.id))
        .leftJoin(destVessel, eq(batchRackingOperations.destinationVesselId, destVessel.id))
        .where(
          and(
            eq(batchRackingOperations.batchId, batchId),
            isNull(batchRackingOperations.deletedAt)
          )
        )
        .orderBy(asc(batchRackingOperations.rackedAt));

      // 3. Filter operations (losses during filtering)
      const filterings = await db
        .select({
          id: batchFilterOperations.id,
          date: batchFilterOperations.filteredAt,
          volumeBefore: batchFilterOperations.volumeBefore,
          volumeAfter: batchFilterOperations.volumeAfter,
          loss: batchFilterOperations.volumeLoss,
          vesselName: vessels.name,
          filterType: batchFilterOperations.filterType,
        })
        .from(batchFilterOperations)
        .leftJoin(vessels, eq(batchFilterOperations.vesselId, vessels.id))
        .where(
          and(
            eq(batchFilterOperations.batchId, batchId),
            isNull(batchFilterOperations.deletedAt)
          )
        )
        .orderBy(asc(batchFilterOperations.filteredAt));

      // 4. Bottle runs (packaging)
      const bottlings = await db
        .select({
          id: bottleRuns.id,
          date: bottleRuns.packagedAt,
          volumeOut: bottleRuns.volumeTakenLiters,
          loss: bottleRuns.loss,
          unitsProduced: bottleRuns.unitsProduced,
          packageSizeML: bottleRuns.packageSizeML,
        })
        .from(bottleRuns)
        .where(
          and(
            eq(bottleRuns.batchId, batchId),
            isNull(bottleRuns.voidedAt)
          )
        )
        .orderBy(asc(bottleRuns.packagedAt));

      // 5. Keg fills
      const kegFillsList = await db
        .select({
          id: kegFills.id,
          date: kegFills.filledAt,
          volumeOut: kegFills.volumeTaken,
          loss: kegFills.loss,
          kegNumber: kegs.kegNumber,
        })
        .from(kegFills)
        .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
        .where(
          and(
            eq(kegFills.batchId, batchId),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt)
          )
        )
        .orderBy(asc(kegFills.filledAt));

      // 6. Distillation records (sent to distillery) - use raw SQL since not imported
      const distillations = await db.execute(sql`
        SELECT
          id,
          sent_at as date,
          source_volume_liters as volume_out,
          distillery_name
        FROM distillation_records
        WHERE source_batch_id = ${batchId}
          AND deleted_at IS NULL
        ORDER BY sent_at ASC
      `);

      // 7. Volume adjustments (sediment loss, evaporation, sampling, etc.)
      const volumeAdjustments = await db
        .select({
          id: batchVolumeAdjustments.id,
          date: batchVolumeAdjustments.adjustmentDate,
          adjustmentType: batchVolumeAdjustments.adjustmentType,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
          reason: batchVolumeAdjustments.reason,
          notes: batchVolumeAdjustments.notes,
        })
        .from(batchVolumeAdjustments)
        .where(
          and(
            eq(batchVolumeAdjustments.batchId, batchId),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        )
        .orderBy(asc(batchVolumeAdjustments.adjustmentDate));

      // 8. Merge history (juice added post-creation from press runs, juice purchases, etc.)
      const merges = await db
        .select({
          id: batchMergeHistory.id,
          date: batchMergeHistory.mergedAt,
          volumeAdded: batchMergeHistory.volumeAdded,
          sourceType: batchMergeHistory.sourceType,
        })
        .from(batchMergeHistory)
        .where(
          and(
            eq(batchMergeHistory.targetBatchId, batchId),
            isNull(batchMergeHistory.deletedAt),
          ),
        )
        .orderBy(asc(batchMergeHistory.mergedAt));

      // Build unified entries list
      type ChildOutcome = {
        type: "bottling" | "kegging" | "loss" | "transfer";
        description: string;
        volume: number;
      };

      type VolumeEntry = {
        id: string;
        date: Date;
        type: "transfer" | "transfer_in" | "merge" | "racking" | "filtering" | "bottling" | "kegging" | "distillation" | "adjustment";
        description: string;
        volumeOut: number;
        volumeIn: number;
        loss: number;
        destinationId: string | null;
        destinationName: string | null;
        childOutcomes?: ChildOutcome[];  // For transfers: shows what happened to the liquid in child batch
      };

      const entries: VolumeEntry[] = [];

      // Add transfers out with child batch outcome roll-up
      for (const t of transfersOut) {
        const childOutcomes: ChildOutcome[] = [];

        if (t.destinationId) {
          // Query child batch outcomes: bottlings, keg fills, losses, and further transfers

          // Child batch bottlings
          const childBottlings = await db
            .select({
              unitsProduced: bottleRuns.unitsProduced,
              packageSizeML: bottleRuns.packageSizeML,
              volumeTaken: bottleRuns.volumeTakenLiters,
              loss: bottleRuns.loss,
            })
            .from(bottleRuns)
            .where(
              and(
                eq(bottleRuns.batchId, t.destinationId),
                isNull(bottleRuns.voidedAt)
              )
            );

          for (const b of childBottlings) {
            const units = b.unitsProduced || 0;
            const size = b.packageSizeML || 0;
            const productVolume = (units * size) / 1000;
            childOutcomes.push({
              type: "bottling",
              description: `Bottled: ${units} × ${size}ml`,
              volume: productVolume,
            });
            // Add bottling loss if any
            const bLoss = parseFloat(b.loss || "0");
            if (bLoss > 0) {
              childOutcomes.push({
                type: "loss",
                description: "Bottling loss",
                volume: bLoss,
              });
            }
          }

          // Child batch keg fills
          const childKegFills = await db
            .select({
              volumeTaken: kegFills.volumeTaken,
              loss: kegFills.loss,
              kegNumber: kegs.kegNumber,
            })
            .from(kegFills)
            .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
            .where(
              and(
                eq(kegFills.batchId, t.destinationId),
                isNull(kegFills.voidedAt),
                isNull(kegFills.deletedAt)
              )
            );

          for (const k of childKegFills) {
            childOutcomes.push({
              type: "kegging",
              description: `Kegged: ${k.kegNumber || "keg"}`,
              volume: parseFloat(k.volumeTaken || "0"),
            });
            const kLoss = parseFloat(k.loss || "0");
            if (kLoss > 0) {
              childOutcomes.push({
                type: "loss",
                description: "Kegging loss",
                volume: kLoss,
              });
            }
          }

          // Child batch volume adjustments (sediment, evaporation, etc.)
          const childAdjustments = await db
            .select({
              adjustmentType: batchVolumeAdjustments.adjustmentType,
              adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
              reason: batchVolumeAdjustments.reason,
            })
            .from(batchVolumeAdjustments)
            .where(
              and(
                eq(batchVolumeAdjustments.batchId, t.destinationId),
                isNull(batchVolumeAdjustments.deletedAt)
              )
            );

          for (const adj of childAdjustments) {
            const amount = parseFloat(adj.adjustmentAmount || "0");
            if (amount < 0) {
              // Negative = loss
              const typeLabel = (adj.adjustmentType || "other")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
              childOutcomes.push({
                type: "loss",
                description: adj.reason || `${typeLabel} loss`,
                volume: Math.abs(amount),
              });
            }
          }

          // Child batch racking losses
          const childRackings = await db
            .select({
              volumeLoss: batchRackingOperations.volumeLoss,
              notes: batchRackingOperations.notes,
            })
            .from(batchRackingOperations)
            .where(
              and(
                eq(batchRackingOperations.batchId, t.destinationId),
                isNull(batchRackingOperations.deletedAt)
              )
            );

          for (const r of childRackings) {
            const loss = parseFloat(r.volumeLoss || "0");
            if (loss > 0 && !r.notes?.includes("Historical Record")) {
              childOutcomes.push({
                type: "loss",
                description: "Racking loss",
                volume: loss,
              });
            }
          }

          // Child batch filter losses
          const childFilterings = await db
            .select({
              volumeLoss: batchFilterOperations.volumeLoss,
              filterType: batchFilterOperations.filterType,
            })
            .from(batchFilterOperations)
            .where(
              and(
                eq(batchFilterOperations.batchId, t.destinationId),
                isNull(batchFilterOperations.deletedAt)
              )
            );

          for (const f of childFilterings) {
            const loss = parseFloat(f.volumeLoss || "0");
            if (loss > 0) {
              childOutcomes.push({
                type: "loss",
                description: `${f.filterType || "Filtering"} loss`,
                volume: loss,
              });
            }
          }

          // Child batch further transfers out
          const childTransfersOut = await db
            .select({
              volumeTransferred: batchTransfers.volumeTransferred,
              destinationBatchId: batchTransfers.destinationBatchId,
              destinationName: destBatch.customName,
            })
            .from(batchTransfers)
            .leftJoin(destBatch, eq(batchTransfers.destinationBatchId, destBatch.id))
            .where(
              and(
                eq(batchTransfers.sourceBatchId, t.destinationId),
                sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
                isNull(batchTransfers.deletedAt)
              )
            );

          for (const ct of childTransfersOut) {
            childOutcomes.push({
              type: "transfer",
              description: `→ ${ct.destinationName || "child batch"}`,
              volume: parseFloat(ct.volumeTransferred || "0"),
            });
          }
        }

        entries.push({
          id: t.id,
          date: t.date,
          type: "transfer",
          description: `Transfer to ${t.destinationName || t.destinationBatchNumber || "batch"}`,
          volumeOut: parseFloat(t.volumeOut || "0"),
          volumeIn: 0,
          loss: parseFloat(t.loss || "0"),
          destinationId: t.destinationId,
          destinationName: t.destinationName || t.destinationBatchNumber || null,
          childOutcomes: childOutcomes.length > 0 ? childOutcomes : undefined,
        });
      }

      // Add transfers in (blending from other batches)
      for (const t of transfersIn) {
        entries.push({
          id: t.id,
          date: t.date,
          type: "transfer_in",
          description: `Blended from ${t.sourceName || t.sourceBatchNumber || "batch"}`,
          volumeOut: 0,
          volumeIn: parseFloat(t.volumeIn || "0"),
          loss: 0,
          destinationId: null,
          destinationName: null,
        });
      }

      // Add merge history (juice added from press runs, juice purchases, etc.)
      for (const m of merges) {
        const sourceLabel = m.sourceType === "press_run" ? "press run" :
          m.sourceType === "juice_purchase" ? "juice purchase" : "batch";
        entries.push({
          id: m.id,
          date: m.date,
          type: "merge",
          description: `Merged from ${sourceLabel}`,
          volumeOut: 0,
          volumeIn: parseFloat(m.volumeAdded || "0"),
          loss: 0,
          destinationId: null,
          destinationName: null,
        });
      }

      // Add rackings (only show if there's loss or it's meaningful)
      for (const r of rackings) {
        const lossValue = parseFloat(r.loss || "0");
        // Skip historical records (they don't represent actual losses)
        if (r.notes?.includes("Historical Record")) continue;

        entries.push({
          id: r.id,
          date: r.date,
          type: "racking",
          description: `${r.sourceVesselName || "?"} → ${r.destVesselName || "?"}`,
          volumeOut: 0, // Racking doesn't transfer volume out, just moves it
          volumeIn: 0,
          loss: lossValue,
          destinationId: null,
          destinationName: null,
        });
      }

      // Add filterings
      for (const f of filterings) {
        entries.push({
          id: f.id,
          date: f.date,
          type: "filtering",
          description: `${f.filterType || "Filter"} in ${f.vesselName || "vessel"}`,
          volumeOut: 0,
          volumeIn: 0,
          loss: parseFloat(f.loss || "0"),
          destinationId: null,
          destinationName: null,
        });
      }

      // Add bottlings
      // Data entry is inconsistent: some batches have loss included in volume_taken,
      // others have it separate. Detect which by comparing volume_taken to product + loss.
      for (const b of bottlings) {
        const units = b.unitsProduced || 0;
        const size = b.packageSizeML || 0;
        const productVolume = (units * size) / 1000;
        const volumeTaken = parseFloat(b.volumeOut || "0");
        const lossValue = parseFloat(b.loss || "0");

        // If volume_taken ≈ product + loss (within 2L tolerance), loss is already included
        const lossIncludedInVolumeTaken = Math.abs(volumeTaken - (productVolume + lossValue)) < 2;
        const effectiveLoss = lossIncludedInVolumeTaken ? 0 : lossValue;

        entries.push({
          id: b.id,
          date: b.date,
          type: "bottling",
          description: `${units} × ${size}ml`,
          volumeOut: volumeTaken,
          volumeIn: 0,
          loss: effectiveLoss,
          destinationId: null,
          destinationName: null,
        });
      }

      // Add keg fills
      for (const k of kegFillsList) {
        entries.push({
          id: k.id,
          date: k.date,
          type: "kegging",
          description: `Keg ${k.kegNumber || "?"}`,
          volumeOut: parseFloat(k.volumeOut || "0"),
          volumeIn: 0,
          loss: parseFloat(k.loss || "0"),
          destinationId: null,
          destinationName: null,
        });
      }

      // Add distillations
      type DistillationRow = { id: string; date: Date; volume_out: string; distillery_name: string };
      const distillationRows = (distillations as unknown as { rows: DistillationRow[] }).rows || [];
      for (const d of distillationRows) {
        entries.push({
          id: d.id,
          date: d.date,
          type: "distillation",
          description: `Sent to ${d.distillery_name || "distillery"}`,
          volumeOut: parseFloat(d.volume_out || "0"),
          volumeIn: 0,
          loss: 0,
          destinationId: null,
          destinationName: null,
        });
      }

      // Add volume adjustments (sediment, evaporation, sampling, etc.)
      // These are tracked losses/gains that explain discrepancies
      for (const adj of volumeAdjustments) {
        const amount = parseFloat(adj.adjustmentAmount || "0");
        // Negative adjustments are losses (sediment, evaporation, sampling, spillage)
        // Positive adjustments are gains (correction_up, measurement corrections)
        const isLoss = amount < 0;

        // Format the adjustment type for display
        const typeLabel = (adj.adjustmentType || "other")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        entries.push({
          id: adj.id,
          date: adj.date,
          type: "adjustment",
          description: adj.reason || adj.notes || typeLabel,
          volumeOut: 0,
          volumeIn: isLoss ? 0 : Math.abs(amount),
          loss: isLoss ? Math.abs(amount) : 0,
          destinationId: null,
          destinationName: null,
        });
      }

      // Sort all entries by date
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate summary
      const rawInitialVolume = parseFloat(batch.initialVolume || "0");
      const currentVolume = parseFloat(batch.currentVolume || "0");
      let totalOutflow = 0;
      let totalInflow = 0;
      let totalLoss = 0;

      for (const entry of entries) {
        totalOutflow += entry.volumeOut;
        totalInflow += entry.volumeIn;
        totalLoss += entry.loss;
      }

      // For batches created via transfer (has parentBatchId AND has inflow from transfer),
      // the initialVolume should not be counted as it would double-count with the transfer-in.
      // The batch's volume came from the transfer, not as an independent initial volume.
      const isTransferCreatedBatch = batch.parentBatchId && totalInflow > 0;
      const effectiveInitialVolume = isTransferCreatedBatch ? 0 : rawInitialVolume;

      // accountedVolume = initial + inflow - outflow - loss
      const accountedVolume = effectiveInitialVolume + totalInflow - totalOutflow - totalLoss;
      const discrepancy = currentVolume - accountedVolume;

      // Use effectiveInitialVolume for display to show the corrected calculation
      const initialVolume = effectiveInitialVolume;

      return {
        batch: {
          id: batch.id,
          name: batch.name,
          customName: batch.customName,
          batchNumber: batch.batchNumber,
          initialVolume,
          currentVolume,
          status: batch.status,
        },
        entries,
        summary: {
          initialVolume,
          totalInflow,
          totalOutflow,
          totalLoss,
          accountedVolume,
          currentVolume,
          discrepancy,
        },
      };
    }),

  /**
   * Get batch tracing report - shows all base batches as of a date and traces where volume went.
   * Used for TTB reconciliation to track all 2024 harvest cider.
   */
  getBatchTraceReport: protectedProcedure
    .input(z.object({ asOfDate: z.string() })) // ISO date string YYYY-MM-DD
    .query(async ({ input }) => {
      const { asOfDate } = input;
      const targetDate = new Date(asOfDate);

      // Find all TTB-reportable batches that existed on or before the target date
      const baseBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          customName: batches.customName,
          batchNumber: batches.batchNumber,
          initialVolume: batches.initialVolumeLiters,
          currentVolume: batches.currentVolumeLiters,
          status: batches.status,
          vesselId: batches.vesselId,
          vesselName: vessels.name,
          startDate: batches.startDate,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            sql`${batches.startDate} <= ${targetDate}`,
            // Only include verified batches as base batches
            eq(batches.reconciliationStatus, "verified"),
            sql`NOT (${batches.batchNumber} LIKE 'LEGACY-%')`,
            isNull(batches.deletedAt),
            sql`${batches.status} != 'discarded'`,
            // Include batches with initial volume > 0 OR that received transfers (transfer-destination batches)
            sql`(
              CAST(${batches.initialVolumeLiters} AS NUMERIC) > 0
              OR EXISTS (
                SELECT 1 FROM batch_transfers bt
                WHERE bt.destination_batch_id = ${batches.id}
                  AND bt.deleted_at IS NULL
              )
            )`
          )
        )
        .orderBy(asc(batches.customName), asc(batches.name));

      if (baseBatches.length === 0) {
        return {
          asOfDate,
          summary: {
            totalBatches: 0,
            // Source volumes
            totalInitialVolume: 0,
            totalInflow: 0,
            totalSource: 0,
            // Destination volumes
            totalPackaged: 0,
            totalDistilled: 0,
            totalLosses: 0,
            totalRemaining: 0,
            // Accounting
            totalDestinations: 0,
            totalDiscrepancy: 0,
            // Legacy/compatibility
            totalCurrentVolume: 0,
            totalTransferred: 0,
            totalChildrenRemaining: 0,
          },
          batches: [],
          inflowBreakdown: [] as {
            destinationBatchId: string;
            destinationBatchName: string;
            sourceBatchId: string;
            sourceBatchName: string;
            isSourceBaseBatch: boolean;
            isExternalInflow: boolean;
            volumeLiters: number;
            date: Date;
          }[],
        };
      }

      // Get all batch IDs for bulk queries
      const batchIds = baseBatches.map((b) => b.id);
      const baseBatchIdSet = new Set(batchIds); // For O(1) lookup to prevent double-counting

      // Type definitions
      type ChildOutcomeReport = {
        type: "bottling" | "kegging" | "loss" | "transfer";
        description: string;
        volume: number;
        grandchildCurrentVolume?: number; // For transfers to grandchildren
      };

      type VolumeEntry = {
        id: string;
        date: Date;
        type: "transfer" | "transfer_in" | "merge" | "racking" | "filtering" | "bottling" | "kegging" | "distillation" | "adjustment";
        description: string;
        volumeOut: number;
        volumeIn: number;
        loss: number;
        destinationId: string | null;
        destinationName: string | null;
        childOutcomes?: ChildOutcomeReport[];
      };

      type BatchWithTrace = {
        id: string;
        name: string;
        customName: string | null;
        batchNumber: string;
        vesselName: string | null;
        initialVolume: number;
        currentVolume: number;
        status: string | null;
        entries: VolumeEntry[];
        summary: {
          totalInflow: number;
          totalOutflow: number;
          totalLoss: number;
          totalPackaged: number;
          totalDistilled: number; // Volume sent to distillery
          childrenRemaining: number; // Volume still in child batches
          totalRemaining: number; // This batch + children
          discrepancy: number;
        };
      };

      // ============ BULK FETCH ALL DATA ============
      const destBatch = aliasedTable(batches, "destBatch");
      const sourceBatch = aliasedTable(batches, "sourceBatch");
      const sourceVessel = aliasedTable(vessels, "sourceVessel");
      const destVessel = aliasedTable(vessels, "destVessel");

      // 1. All transfers out from base batches
      const allTransfersOut = await db
        .select({
          id: batchTransfers.id,
          sourceBatchId: batchTransfers.sourceBatchId,
          date: batchTransfers.transferredAt,
          volumeOut: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          destinationId: batchTransfers.destinationBatchId,
          destinationName: destBatch.customName,
          destinationBatchNumber: destBatch.batchNumber,
          destinationCurrentVolume: destBatch.currentVolumeLiters,
        })
        .from(batchTransfers)
        .leftJoin(destBatch, eq(batchTransfers.destinationBatchId, destBatch.id))
        .where(
          and(
            inArray(batchTransfers.sourceBatchId, batchIds),
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            isNull(batchTransfers.deletedAt)
          )
        );

      // 2. All transfers in to base batches
      const allTransfersIn = await db
        .select({
          id: batchTransfers.id,
          destinationBatchId: batchTransfers.destinationBatchId,
          date: batchTransfers.transferredAt,
          volumeIn: batchTransfers.volumeTransferred,
          sourceId: batchTransfers.sourceBatchId,
          sourceName: sourceBatch.customName,
          sourceBatchNumber: sourceBatch.batchNumber,
        })
        .from(batchTransfers)
        .leftJoin(sourceBatch, eq(batchTransfers.sourceBatchId, sourceBatch.id))
        .where(
          and(
            inArray(batchTransfers.destinationBatchId, batchIds),
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            isNull(batchTransfers.deletedAt)
          )
        );

      // 3. All racking operations
      const allRackings = await db
        .select({
          id: batchRackingOperations.id,
          batchId: batchRackingOperations.batchId,
          date: batchRackingOperations.rackedAt,
          loss: batchRackingOperations.volumeLoss,
          sourceVesselName: sourceVessel.name,
          destVesselName: destVessel.name,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .leftJoin(sourceVessel, eq(batchRackingOperations.sourceVesselId, sourceVessel.id))
        .leftJoin(destVessel, eq(batchRackingOperations.destinationVesselId, destVessel.id))
        .where(
          and(
            inArray(batchRackingOperations.batchId, batchIds),
            isNull(batchRackingOperations.deletedAt)
          )
        );

      // 4. All filter operations
      const allFilterings = await db
        .select({
          id: batchFilterOperations.id,
          batchId: batchFilterOperations.batchId,
          date: batchFilterOperations.filteredAt,
          loss: batchFilterOperations.volumeLoss,
          filterType: batchFilterOperations.filterType,
        })
        .from(batchFilterOperations)
        .where(
          and(
            inArray(batchFilterOperations.batchId, batchIds),
            isNull(batchFilterOperations.deletedAt)
          )
        );

      // 5. All bottle runs
      const allBottlings = await db
        .select({
          id: bottleRuns.id,
          batchId: bottleRuns.batchId,
          date: bottleRuns.packagedAt,
          volumeOut: bottleRuns.volumeTakenLiters,
          loss: bottleRuns.loss,
          unitsProduced: bottleRuns.unitsProduced,
          packageSizeML: bottleRuns.packageSizeML,
        })
        .from(bottleRuns)
        .where(
          and(
            inArray(bottleRuns.batchId, batchIds),
            isNull(bottleRuns.voidedAt)
          )
        );

      // 6. All keg fills
      const allKegFills = await db
        .select({
          id: kegFills.id,
          batchId: kegFills.batchId,
          date: kegFills.filledAt,
          volumeOut: kegFills.volumeTaken,
          loss: kegFills.loss,
          kegNumber: kegs.kegNumber,
        })
        .from(kegFills)
        .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
        .where(
          and(
            inArray(kegFills.batchId, batchIds),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt)
          )
        );

      // 7. All distillations
      type DistillationRow = { id: string; source_batch_id: string; date: Date; volume_out: string; distillery_name: string };
      let allDistillations: DistillationRow[] = [];
      if (batchIds.length > 0) {
        const distillationsResult = await db.execute(sql`
          SELECT id, source_batch_id, sent_at as date, source_volume_liters as volume_out, distillery_name
          FROM distillation_records
          WHERE source_batch_id IN (${sql.join(batchIds.map(id => sql`${id}`), sql`, `)})
            AND deleted_at IS NULL
        `);
        allDistillations = (distillationsResult as unknown as { rows: DistillationRow[] }).rows || [];
      }

      // 8. All volume adjustments for base batches
      const allAdjustments = await db
        .select({
          id: batchVolumeAdjustments.id,
          batchId: batchVolumeAdjustments.batchId,
          date: batchVolumeAdjustments.adjustmentDate,
          adjustmentType: batchVolumeAdjustments.adjustmentType,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
          reason: batchVolumeAdjustments.reason,
        })
        .from(batchVolumeAdjustments)
        .where(
          and(
            inArray(batchVolumeAdjustments.batchId, batchIds),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        );

      // ============ BULK FETCH CHILD BATCH DATA ============
      // Get all destination batch IDs from transfers
      const destinationBatchIds = [...new Set(
        allTransfersOut
          .filter((t) => t.destinationId)
          .map((t) => t.destinationId as string)
      )];

      // Child batch bottlings
      const allChildBottlings = destinationBatchIds.length > 0 ? await db
        .select({
          id: bottleRuns.id,
          batchId: bottleRuns.batchId,
          unitsProduced: bottleRuns.unitsProduced,
          packageSizeML: bottleRuns.packageSizeML,
          volumeTaken: bottleRuns.volumeTakenLiters,
          loss: bottleRuns.loss,
        })
        .from(bottleRuns)
        .where(
          and(
            inArray(bottleRuns.batchId, destinationBatchIds),
            isNull(bottleRuns.voidedAt)
          )
        ) : [];

      // Child batch keg fills
      const allChildKegFills = destinationBatchIds.length > 0 ? await db
        .select({
          id: kegFills.id,
          batchId: kegFills.batchId,
          volumeTaken: kegFills.volumeTaken,
          loss: kegFills.loss,
          kegNumber: kegs.kegNumber,
        })
        .from(kegFills)
        .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
        .where(
          and(
            inArray(kegFills.batchId, destinationBatchIds),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt)
          )
        ) : [];

      // Child batch volume adjustments
      const allChildAdjustments = destinationBatchIds.length > 0 ? await db
        .select({
          id: batchVolumeAdjustments.id,
          batchId: batchVolumeAdjustments.batchId,
          adjustmentType: batchVolumeAdjustments.adjustmentType,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
          reason: batchVolumeAdjustments.reason,
        })
        .from(batchVolumeAdjustments)
        .where(
          and(
            inArray(batchVolumeAdjustments.batchId, destinationBatchIds),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        ) : [];

      // Child batch rackings
      const allChildRackings = destinationBatchIds.length > 0 ? await db
        .select({
          id: batchRackingOperations.id,
          batchId: batchRackingOperations.batchId,
          volumeLoss: batchRackingOperations.volumeLoss,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .where(
          and(
            inArray(batchRackingOperations.batchId, destinationBatchIds),
            isNull(batchRackingOperations.deletedAt)
          )
        ) : [];

      // Child batch filter operations
      const allChildFilterings = destinationBatchIds.length > 0 ? await db
        .select({
          id: batchFilterOperations.id,
          batchId: batchFilterOperations.batchId,
          volumeLoss: batchFilterOperations.volumeLoss,
          filterType: batchFilterOperations.filterType,
        })
        .from(batchFilterOperations)
        .where(
          and(
            inArray(batchFilterOperations.batchId, destinationBatchIds),
            isNull(batchFilterOperations.deletedAt)
          )
        ) : [];

      // Child batch transfers out (to grandchildren)
      const allChildTransfersOut = destinationBatchIds.length > 0 ? await db
        .select({
          sourceBatchId: batchTransfers.sourceBatchId,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          destinationBatchId: batchTransfers.destinationBatchId,
          destinationName: destBatch.customName,
          destinationCurrentVolume: destBatch.currentVolumeLiters,
        })
        .from(batchTransfers)
        .leftJoin(destBatch, eq(batchTransfers.destinationBatchId, destBatch.id))
        .where(
          and(
            inArray(batchTransfers.sourceBatchId, destinationBatchIds),
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            isNull(batchTransfers.deletedAt)
          )
        ) : [];

      // ============ GRANDCHILD DATA (from child transfers) ============
      const grandchildBatchIds = [...new Set(
        allChildTransfersOut
          .filter((t) => t.destinationBatchId)
          .map((t) => t.destinationBatchId as string)
      )];

      // Grandchild bottlings
      const allGrandchildBottlings = grandchildBatchIds.length > 0 ? await db
        .select({
          id: bottleRuns.id,
          batchId: bottleRuns.batchId,
          unitsProduced: bottleRuns.unitsProduced,
          packageSizeML: bottleRuns.packageSizeML,
          loss: bottleRuns.loss,
        })
        .from(bottleRuns)
        .where(
          and(
            inArray(bottleRuns.batchId, grandchildBatchIds),
            isNull(bottleRuns.voidedAt)
          )
        ) : [];

      // Grandchild keg fills
      const allGrandchildKegFills = grandchildBatchIds.length > 0 ? await db
        .select({
          id: kegFills.id,
          batchId: kegFills.batchId,
          volumeTaken: kegFills.volumeTaken,
          loss: kegFills.loss,
        })
        .from(kegFills)
        .where(
          and(
            inArray(kegFills.batchId, grandchildBatchIds),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt)
          )
        ) : [];

      // Grandchild volume adjustments (losses)
      const allGrandchildAdjustments = grandchildBatchIds.length > 0 ? await db
        .select({
          id: batchVolumeAdjustments.id,
          batchId: batchVolumeAdjustments.batchId,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
        })
        .from(batchVolumeAdjustments)
        .where(
          and(
            inArray(batchVolumeAdjustments.batchId, grandchildBatchIds),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        ) : [];

      // Grandchild racking losses
      const allGrandchildRackings = grandchildBatchIds.length > 0 ? await db
        .select({
          id: batchRackingOperations.id,
          batchId: batchRackingOperations.batchId,
          volumeLoss: batchRackingOperations.volumeLoss,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .where(
          and(
            inArray(batchRackingOperations.batchId, grandchildBatchIds),
            isNull(batchRackingOperations.deletedAt)
          )
        ) : [];

      // ============ BUILD LOOKUP MAPS ============
      // Group child data by batchId for O(1) lookups
      const childBottlingsMap = new Map<string, typeof allChildBottlings>();
      for (const b of allChildBottlings) {
        if (!childBottlingsMap.has(b.batchId)) childBottlingsMap.set(b.batchId, []);
        childBottlingsMap.get(b.batchId)!.push(b);
      }

      const childKegFillsMap = new Map<string, typeof allChildKegFills>();
      for (const k of allChildKegFills) {
        if (!childKegFillsMap.has(k.batchId)) childKegFillsMap.set(k.batchId, []);
        childKegFillsMap.get(k.batchId)!.push(k);
      }

      const childAdjustmentsMap = new Map<string, typeof allChildAdjustments>();
      for (const a of allChildAdjustments) {
        if (!childAdjustmentsMap.has(a.batchId)) childAdjustmentsMap.set(a.batchId, []);
        childAdjustmentsMap.get(a.batchId)!.push(a);
      }

      const childRackingsMap = new Map<string, typeof allChildRackings>();
      for (const r of allChildRackings) {
        if (!childRackingsMap.has(r.batchId)) childRackingsMap.set(r.batchId, []);
        childRackingsMap.get(r.batchId)!.push(r);
      }

      const childFilteringsMap = new Map<string, typeof allChildFilterings>();
      for (const f of allChildFilterings) {
        if (!childFilteringsMap.has(f.batchId)) childFilteringsMap.set(f.batchId, []);
        childFilteringsMap.get(f.batchId)!.push(f);
      }

      const childTransfersOutMap = new Map<string, typeof allChildTransfersOut>();
      for (const t of allChildTransfersOut) {
        if (!childTransfersOutMap.has(t.sourceBatchId)) childTransfersOutMap.set(t.sourceBatchId, []);
        childTransfersOutMap.get(t.sourceBatchId)!.push(t);
      }

      // Grandchild lookup maps
      const grandchildBottlingsMap = new Map<string, typeof allGrandchildBottlings>();
      for (const b of allGrandchildBottlings) {
        if (!grandchildBottlingsMap.has(b.batchId)) grandchildBottlingsMap.set(b.batchId, []);
        grandchildBottlingsMap.get(b.batchId)!.push(b);
      }

      const grandchildKegFillsMap = new Map<string, typeof allGrandchildKegFills>();
      for (const k of allGrandchildKegFills) {
        if (!grandchildKegFillsMap.has(k.batchId)) grandchildKegFillsMap.set(k.batchId, []);
        grandchildKegFillsMap.get(k.batchId)!.push(k);
      }

      const grandchildAdjustmentsMap = new Map<string, typeof allGrandchildAdjustments>();
      for (const a of allGrandchildAdjustments) {
        if (!grandchildAdjustmentsMap.has(a.batchId)) grandchildAdjustmentsMap.set(a.batchId, []);
        grandchildAdjustmentsMap.get(a.batchId)!.push(a);
      }

      const grandchildRackingsMap = new Map<string, typeof allGrandchildRackings>();
      for (const r of allGrandchildRackings) {
        if (!grandchildRackingsMap.has(r.batchId)) grandchildRackingsMap.set(r.batchId, []);
        grandchildRackingsMap.get(r.batchId)!.push(r);
      }

      // ============ PROCESS BATCHES ============
      const batchResults: BatchWithTrace[] = [];
      let grandTotalInitial = 0;
      let grandTotalCurrent = 0;
      let grandTotalInflow = 0;
      let grandTotalOutflow = 0;
      let grandTotalLoss = 0;
      let grandTotalPackaged = 0;
      let grandTotalDistilled = 0;
      let grandTotalChildrenRemaining = 0;

      for (const batch of baseBatches) {
        const batchId = batch.id;
        const entries: VolumeEntry[] = [];

        // 1. Transfers out
        const batchTransfersOut = allTransfersOut.filter((t) => t.sourceBatchId === batchId);
        for (const t of batchTransfersOut) {
          const childOutcomes: ChildOutcomeReport[] = [];

          if (t.destinationId) {
            // Child batch bottlings
            const childBottlings = childBottlingsMap.get(t.destinationId) || [];
            for (const b of childBottlings) {
              const units = b.unitsProduced || 0;
              const size = b.packageSizeML || 0;
              const productVolume = (units * size) / 1000;
              childOutcomes.push({
                type: "bottling",
                description: `Bottled: ${units} × ${size}ml`,
                volume: productVolume,
              });
              const bLoss = parseFloat(b.loss || "0");
              if (bLoss > 0) {
                childOutcomes.push({
                  type: "loss",
                  description: "Bottling loss",
                  volume: bLoss,
                });
              }
            }

            // Child batch keg fills
            const childKegFillsData = childKegFillsMap.get(t.destinationId) || [];
            for (const k of childKegFillsData) {
              childOutcomes.push({
                type: "kegging",
                description: `Kegged: ${k.kegNumber || "keg"}`,
                volume: parseFloat(k.volumeTaken || "0"),
              });
              const kLoss = parseFloat(k.loss || "0");
              if (kLoss > 0) {
                childOutcomes.push({
                  type: "loss",
                  description: "Kegging loss",
                  volume: kLoss,
                });
              }
            }

            // Child batch adjustments
            const childAdj = childAdjustmentsMap.get(t.destinationId) || [];
            for (const adj of childAdj) {
              const amount = parseFloat(adj.adjustmentAmount || "0");
              if (amount < 0) {
                const typeLabel = (adj.adjustmentType || "other")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                childOutcomes.push({
                  type: "loss",
                  description: adj.reason || `${typeLabel} loss`,
                  volume: Math.abs(amount),
                });
              }
            }

            // Child batch racking losses
            const childRack = childRackingsMap.get(t.destinationId) || [];
            for (const r of childRack) {
              const loss = parseFloat(r.volumeLoss || "0");
              if (loss > 0 && !r.notes?.includes("Historical Record")) {
                childOutcomes.push({
                  type: "loss",
                  description: "Racking loss",
                  volume: loss,
                });
              }
            }

            // Child batch filter losses
            const childFilt = childFilteringsMap.get(t.destinationId) || [];
            for (const f of childFilt) {
              const loss = parseFloat(f.volumeLoss || "0");
              if (loss > 0) {
                childOutcomes.push({
                  type: "loss",
                  description: `${f.filterType || "Filtering"} loss`,
                  volume: loss,
                });
              }
            }

            // Child batch transfers out (to grandchildren)
            const childTrans = childTransfersOutMap.get(t.destinationId) || [];
            for (const ct of childTrans) {
              childOutcomes.push({
                type: "transfer",
                description: `→ ${ct.destinationName || "grandchild batch"}`,
                volume: parseFloat(ct.volumeTransferred || "0"),
                grandchildCurrentVolume: parseFloat(ct.destinationCurrentVolume || "0"),
              });
              // Include loss from child → grandchild transfer
              const ctLoss = parseFloat(ct.loss || "0");
              if (ctLoss > 0) {
                childOutcomes.push({
                  type: "loss",
                  description: "Transfer loss (to grandchild)",
                  volume: ctLoss,
                });
              }

              // Include grandchild outcomes (what happened to the transferred volume)
              if (ct.destinationBatchId) {
                // Grandchild bottlings
                const gcBottlings = grandchildBottlingsMap.get(ct.destinationBatchId) || [];
                for (const gb of gcBottlings) {
                  const units = gb.unitsProduced || 0;
                  const size = gb.packageSizeML || 0;
                  const productVolume = (units * size) / 1000;
                  childOutcomes.push({
                    type: "bottling",
                    description: `Grandchild bottled: ${units} × ${size}ml`,
                    volume: productVolume,
                  });
                  const gbLoss = parseFloat(gb.loss || "0");
                  if (gbLoss > 0) {
                    childOutcomes.push({
                      type: "loss",
                      description: "Grandchild bottling loss",
                      volume: gbLoss,
                    });
                  }
                }

                // Grandchild keg fills
                const gcKegFills = grandchildKegFillsMap.get(ct.destinationBatchId) || [];
                for (const gk of gcKegFills) {
                  childOutcomes.push({
                    type: "kegging",
                    description: "Grandchild kegged",
                    volume: parseFloat(gk.volumeTaken || "0"),
                  });
                  const gkLoss = parseFloat(gk.loss || "0");
                  if (gkLoss > 0) {
                    childOutcomes.push({
                      type: "loss",
                      description: "Grandchild kegging loss",
                      volume: gkLoss,
                    });
                  }
                }

                // Grandchild adjustments (losses)
                const gcAdj = grandchildAdjustmentsMap.get(ct.destinationBatchId) || [];
                for (const ga of gcAdj) {
                  const amount = parseFloat(ga.adjustmentAmount || "0");
                  if (amount < 0) {
                    childOutcomes.push({
                      type: "loss",
                      description: "Grandchild adjustment loss",
                      volume: Math.abs(amount),
                    });
                  }
                }

                // Grandchild racking losses
                const gcRack = grandchildRackingsMap.get(ct.destinationBatchId) || [];
                for (const gr of gcRack) {
                  const loss = parseFloat(gr.volumeLoss || "0");
                  if (loss > 0 && !gr.notes?.includes("Historical Record")) {
                    childOutcomes.push({
                      type: "loss",
                      description: "Grandchild racking loss",
                      volume: loss,
                    });
                  }
                }
              }
            }
          }

          entries.push({
            id: t.id,
            date: t.date,
            type: "transfer",
            description: `→ ${t.destinationName || t.destinationBatchNumber || "batch"}`,
            volumeOut: parseFloat(t.volumeOut || "0"),
            volumeIn: 0,
            loss: parseFloat(t.loss || "0"),
            destinationId: t.destinationId,
            destinationName: t.destinationName || t.destinationBatchNumber || null,
            childOutcomes: childOutcomes.length > 0 ? childOutcomes : undefined,
          });
        }

        // 1b. Transfers in
        const batchTransfersIn = allTransfersIn.filter((t) => t.destinationBatchId === batchId);
        for (const t of batchTransfersIn) {
          entries.push({
            id: t.id,
            date: t.date,
            type: "transfer_in",
            description: `Blended from ${t.sourceName || t.sourceBatchNumber || "batch"}`,
            volumeOut: 0,
            volumeIn: parseFloat(t.volumeIn || "0"),
            loss: 0,
            destinationId: null,
            destinationName: null,
          });
        }

        // 2. Racking operations
        const batchRackings = allRackings.filter((r) => r.batchId === batchId);
        for (const r of batchRackings) {
          const lossValue = parseFloat(r.loss || "0");
          if (r.notes?.includes("Historical Record")) continue;
          if (lossValue <= 0) continue;

          entries.push({
            id: r.id,
            date: r.date,
            type: "racking",
            description: `${r.sourceVesselName || "?"} → ${r.destVesselName || "?"}`,
            volumeOut: 0,
            volumeIn: 0,
            loss: lossValue,
            destinationId: null,
            destinationName: null,
          });
        }

        // 3. Filter operations
        const batchFilterings = allFilterings.filter((f) => f.batchId === batchId);
        for (const f of batchFilterings) {
          const lossValue = parseFloat(f.loss || "0");
          if (lossValue <= 0) continue;

          entries.push({
            id: f.id,
            date: f.date,
            type: "filtering",
            description: f.filterType || "Filter",
            volumeOut: 0,
            volumeIn: 0,
            loss: lossValue,
            destinationId: null,
            destinationName: null,
          });
        }

        // 4. Bottle runs
        const batchBottlings = allBottlings.filter((b) => b.batchId === batchId);
        for (const b of batchBottlings) {
          const units = b.unitsProduced || 0;
          const size = b.packageSizeML || 0;
          const productVolume = (units * size) / 1000;
          const volumeTaken = parseFloat(b.volumeOut || "0");
          const lossValue = parseFloat(b.loss || "0");
          const lossIncludedInVolumeTaken = Math.abs(volumeTaken - (productVolume + lossValue)) < 2;
          const effectiveLoss = lossIncludedInVolumeTaken ? 0 : lossValue;

          entries.push({
            id: b.id,
            date: b.date,
            type: "bottling",
            description: `${units} × ${size}ml`,
            volumeOut: volumeTaken,
            volumeIn: 0,
            loss: effectiveLoss,
            destinationId: null,
            destinationName: null,
          });
        }

        // 5. Keg fills
        const batchKegFills = allKegFills.filter((k) => k.batchId === batchId);
        for (const k of batchKegFills) {
          entries.push({
            id: k.id,
            date: k.date,
            type: "kegging",
            description: `Keg ${k.kegNumber || "?"}`,
            volumeOut: parseFloat(k.volumeOut || "0"),
            volumeIn: 0,
            loss: parseFloat(k.loss || "0"),
            destinationId: null,
            destinationName: null,
          });
        }

        // 6. Distillation
        const batchDistillations = allDistillations.filter((d) => d.source_batch_id === batchId);
        for (const d of batchDistillations) {
          entries.push({
            id: d.id,
            date: d.date,
            type: "distillation",
            description: `→ ${d.distillery_name || "Distillery"}`,
            volumeOut: parseFloat(d.volume_out || "0"),
            volumeIn: 0,
            loss: 0,
            destinationId: null,
            destinationName: null,
          });
        }

        // 7. Volume adjustments (sediment, evaporation, dumps, etc.)
        const batchAdjustments = allAdjustments.filter((a) => a.batchId === batchId);
        for (const adj of batchAdjustments) {
          const amount = parseFloat(adj.adjustmentAmount || "0");
          // Only include negative adjustments (losses) - positive adjustments are gains
          if (amount < 0) {
            const typeLabel = (adj.adjustmentType || "other")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            entries.push({
              id: adj.id,
              date: adj.date,
              type: "adjustment",
              description: adj.reason || `${typeLabel}`,
              volumeOut: 0,
              volumeIn: 0,
              loss: Math.abs(amount),
              destinationId: null,
              destinationName: null,
            });
          }
        }

        // Sort entries by date
        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate batch summary using SAME formula as Volume Trace
        // Formula: accounted = initial + inflow - outflow - loss
        // Discrepancy = current - accounted
        // Child outcomes are displayed for context but NOT included in discrepancy calculation
        // (they would double-count when child batches are also base batches)
        const initialVolume = parseFloat(batch.initialVolume || "0");
        const currentVolume = parseFloat(batch.currentVolume || "0");
        let totalOutflow = 0;
        let totalInflow = 0;
        let externalInflow = 0; // Inflow from non-base-batch sources only (for grand total)
        let totalLoss = 0; // Direct losses only (same as Volume Trace)
        let totalPackaged = 0; // Direct packaging only (for display)
        let totalDistilled = 0; // Volume sent to distillery
        let childrenRemaining = 0; // For display context

        // Track unique child batches for display
        const countedChildBatches = new Set<string>();

        // Separate tracking for child outcomes (display only, not in discrepancy)
        let childPackaged = 0;
        let childLoss = 0;

        for (const entry of entries) {
          totalOutflow += entry.volumeOut;
          totalInflow += entry.volumeIn;
          totalLoss += entry.loss; // Direct loss from this entry only

          // Track external inflow (from non-base-batch sources) for grand total
          if (entry.type === "transfer_in" && entry.volumeIn > 0) {
            const transferIn = batchTransfersIn.find((t) => t.id === entry.id);
            if (transferIn && !baseBatchIdSet.has(transferIn.sourceId)) {
              externalInflow += entry.volumeIn;
            }
          }

          if (entry.type === "bottling" || entry.type === "kegging") {
            totalPackaged += entry.volumeOut;
          }
          if (entry.type === "distillation") {
            totalDistilled += entry.volumeOut;
          }

          // Track child outcomes for DISPLAY purposes only (not in discrepancy calculation)
          if (entry.childOutcomes) {
            for (const child of entry.childOutcomes) {
              if (child.type === "loss") {
                childLoss += child.volume;
              } else if (child.type === "bottling" || child.type === "kegging") {
                childPackaged += child.volume;
              } else if (child.type === "transfer" && child.grandchildCurrentVolume !== undefined) {
                childrenRemaining += child.grandchildCurrentVolume;
              }
            }
          }

          // Track remaining volume in child batches (for display)
          // Only count if child is NOT a base batch (base batches have their own row)
          if (entry.type === "transfer" && entry.destinationId && !countedChildBatches.has(entry.destinationId) && !baseBatchIdSet.has(entry.destinationId)) {
            const transfer = batchTransfersOut.find(t => t.destinationId === entry.destinationId);
            if (transfer?.destinationCurrentVolume) {
              childrenRemaining += parseFloat(transfer.destinationCurrentVolume);
              countedChildBatches.add(entry.destinationId);
            }
          }
        }

        // For display: show combined totals (direct + child)
        const displayPackaged = totalPackaged + childPackaged;
        const displayDistilled = totalDistilled; // Distillation doesn't have child outcomes
        const displayLoss = totalLoss + childLoss;
        const totalRemaining = currentVolume + childrenRemaining;

        // Per-batch discrepancy uses Volume Trace formula (NOT tree rollup)
        // Tree rollup doesn't work correctly when children have multiple parents (blends)
        // Formula: initial + inflow = outflow + loss + current
        // Discrepancy = (initial + inflow) - (outflow + loss + current)
        const source = initialVolume + totalInflow;
        const accounted = totalOutflow + totalLoss + currentVolume;
        const discrepancy = source - accounted;

        batchResults.push({
          id: batch.id,
          name: batch.name,
          customName: batch.customName,
          batchNumber: batch.batchNumber,
          vesselName: batch.vesselName,
          initialVolume,
          currentVolume,
          status: batch.status,
          entries,
          summary: {
            totalInflow,
            totalOutflow,
            totalLoss: displayLoss, // Show combined (direct + child) for display
            totalPackaged: displayPackaged, // Show combined (direct + child) for display
            totalDistilled: displayDistilled, // Volume sent to distillery
            childrenRemaining,
            totalRemaining,
            discrepancy, // Calculated using Volume Trace formula (direct only)
          },
        });
      }

      // ============ CALCULATE GRAND TOTALS USING GLOBAL TRACKING ============
      // Use unique IDs to prevent double-counting when children have multiple parents
      const countedPackagingIds = new Set<string>();
      const countedLossIds = new Set<string>();
      const countedChildBatchIds = new Set<string>();

      for (const batch of batchResults) {
        grandTotalInitial += batch.initialVolume;
        grandTotalCurrent += batch.currentVolume;

        // Count DIRECT packaging/distillation/losses from base batches
        for (const entry of batch.entries) {
          if (entry.type === "bottling" || entry.type === "kegging") {
            if (!countedPackagingIds.has(entry.id)) {
              grandTotalPackaged += entry.volumeOut;
              countedPackagingIds.add(entry.id);
            }
          }
          if (entry.type === "distillation") {
            grandTotalDistilled += entry.volumeOut;
          }
          if (entry.type === "racking" || entry.type === "filtering" || entry.type === "adjustment") {
            if (!countedLossIds.has(entry.id) && entry.loss > 0) {
              grandTotalLoss += entry.loss;
              countedLossIds.add(entry.id);
            }
          }

          // Track child outcomes (only if child is not a base batch)
          if (entry.type === "transfer" && entry.destinationId && !baseBatchIdSet.has(entry.destinationId)) {
            const childBatchId = entry.destinationId;

            // Count child's remaining volume only once
            if (!countedChildBatchIds.has(childBatchId)) {
              const transfer = allTransfersOut.find(t => t.destinationId === childBatchId);
              if (transfer?.destinationCurrentVolume) {
                grandTotalChildrenRemaining += parseFloat(transfer.destinationCurrentVolume);
              }
              countedChildBatchIds.add(childBatchId);
            }

            // Count child packaging (by unique ID)
            const childBottlings = childBottlingsMap.get(childBatchId) || [];
            for (const b of childBottlings) {
              if (!countedPackagingIds.has(b.id)) {
                const units = b.unitsProduced || 0;
                const size = b.packageSizeML || 0;
                const productVolume = (units * size) / 1000;
                grandTotalPackaged += productVolume;
                countedPackagingIds.add(b.id);
              }
            }

            const childKegFills = childKegFillsMap.get(childBatchId) || [];
            for (const k of childKegFills) {
              if (!countedPackagingIds.has(k.id)) {
                grandTotalPackaged += parseFloat(k.volumeTaken || "0");
                countedPackagingIds.add(k.id);
              }
            }

            // Count child losses (by unique ID)
            const childAdjustments = childAdjustmentsMap.get(childBatchId) || [];
            for (const a of childAdjustments) {
              if (!countedLossIds.has(a.id)) {
                const amount = parseFloat(a.adjustmentAmount || "0");
                if (amount < 0) {
                  grandTotalLoss += Math.abs(amount);
                  countedLossIds.add(a.id);
                }
              }
            }

            const childRackings = childRackingsMap.get(childBatchId) || [];
            for (const r of childRackings) {
              if (!countedLossIds.has(r.id)) {
                grandTotalLoss += parseFloat(r.volumeLoss || "0");
                countedLossIds.add(r.id);
              }
            }

            const childFilterings = childFilteringsMap.get(childBatchId) || [];
            for (const f of childFilterings) {
              if (!countedLossIds.has(f.id)) {
                grandTotalLoss += parseFloat(f.volumeLoss || "0");
                countedLossIds.add(f.id);
              }
            }

            // ============ GRANDCHILD OUTCOMES ============
            // Process transfers from this child to grandchildren
            const childTransfers = childTransfersOutMap.get(childBatchId) || [];
            for (const ct of childTransfers) {
              if (ct.destinationBatchId && !baseBatchIdSet.has(ct.destinationBatchId)) {
                const grandchildId = ct.destinationBatchId;

                // Grandchild bottlings
                const gcBottlings = grandchildBottlingsMap.get(grandchildId) || [];
                for (const gb of gcBottlings) {
                  if (!countedPackagingIds.has(gb.id)) {
                    const units = gb.unitsProduced || 0;
                    const size = gb.packageSizeML || 0;
                    const productVolume = (units * size) / 1000;
                    grandTotalPackaged += productVolume;
                    countedPackagingIds.add(gb.id);
                  }
                }

                // Grandchild keg fills
                const gcKegFills = grandchildKegFillsMap.get(grandchildId) || [];
                for (const gk of gcKegFills) {
                  if (!countedPackagingIds.has(gk.id)) {
                    grandTotalPackaged += parseFloat(gk.volumeTaken || "0");
                    countedPackagingIds.add(gk.id);
                  }
                }

                // Grandchild adjustment losses
                const gcAdjustments = grandchildAdjustmentsMap.get(grandchildId) || [];
                for (const ga of gcAdjustments) {
                  if (!countedLossIds.has(ga.id)) {
                    const amount = parseFloat(ga.adjustmentAmount || "0");
                    if (amount < 0) {
                      grandTotalLoss += Math.abs(amount);
                      countedLossIds.add(ga.id);
                    }
                  }
                }

                // Grandchild racking losses
                const gcRackings = grandchildRackingsMap.get(grandchildId) || [];
                for (const gr of gcRackings) {
                  if (!countedLossIds.has(gr.id)) {
                    grandTotalLoss += parseFloat(gr.volumeLoss || "0");
                    countedLossIds.add(gr.id);
                  }
                }
              }
            }
          }
        }
      }

      // Calculate external inflow (from non-base-batch sources only)
      for (const t of allTransfersIn) {
        if (!baseBatchIdSet.has(t.sourceId)) {
          grandTotalInflow += parseFloat(t.volumeIn || "0");
        }
      }

      // Remaining = base batch current volumes only
      // Children's volumes are already accounted for in their packaging/losses
      const grandTotalRemaining = grandTotalCurrent;

      // Balance equation: Initial + Inflow = Packaged + Distilled + Losses + Remaining + Discrepancy
      // If discrepancy is ~0, the data is clean
      const grandTotalSource = grandTotalInitial + grandTotalInflow;
      const grandTotalDestinations = grandTotalPackaged + grandTotalDistilled + grandTotalLoss + grandTotalRemaining;
      const grandTotalDiscrepancy = grandTotalSource - grandTotalDestinations;

      // Build inflow breakdown for debugging/analysis
      const inflowBreakdown = allTransfersIn.map((t) => {
        const destBatch = baseBatches.find((b) => b.id === t.destinationBatchId);
        const isSourceBaseBatch = baseBatchIdSet.has(t.sourceId);
        return {
          destinationBatchId: t.destinationBatchId,
          destinationBatchName: destBatch?.customName || destBatch?.name || "Unknown",
          sourceBatchId: t.sourceId,
          sourceBatchName: t.sourceName || t.sourceBatchNumber || "Unknown",
          isSourceBaseBatch,
          isExternalInflow: !isSourceBaseBatch,
          volumeLiters: parseFloat(t.volumeIn || "0"),
          date: t.date,
        };
      });

      return {
        asOfDate,
        summary: {
          totalBatches: batchResults.length,
          // Source volumes
          totalInitialVolume: grandTotalInitial,
          totalInflow: grandTotalInflow,
          totalSource: grandTotalSource, // Initial + Inflow (for balance display)
          // Destination volumes (tree rollup)
          totalPackaged: grandTotalPackaged, // All packaging in tree
          totalDistilled: grandTotalDistilled, // All distillation
          totalLosses: grandTotalLoss, // All losses in tree
          totalRemaining: grandTotalRemaining, // All current volumes
          // Accounting
          totalDestinations: grandTotalDestinations, // Sum of all destinations
          totalDiscrepancy: grandTotalDiscrepancy, // Source - Destinations (should be ~0)
          // Legacy/compatibility fields
          totalCurrentVolume: grandTotalCurrent, // Base batch current volumes only
          totalTransferred: grandTotalOutflow, // Keep for backward compatibility
          totalChildrenRemaining: grandTotalChildrenRemaining,
        },
        batches: batchResults,
        inflowBreakdown, // Diagnostic: shows all transfers into base batches with source info
      };
    }),

  /**
   * Get TTB-aligned batch trace report with period-based reporting and product type grouping.
   * This is the enhanced version for TTB Form 5120.17 compliance.
   * Groups inventory by product type (Cider/Perry, Brandy, Pommeau) and tracks
   * distillery operations (cider sent out, brandy received back).
   */
  getTTBBatchTraceReport: protectedProcedure
    .input(z.object({
      periodStart: z.string(), // ISO date string YYYY-MM-DD
      periodEnd: z.string(),   // ISO date string YYYY-MM-DD
    }))
    .query(async ({ input }) => {
      const { periodStart, periodEnd } = input;
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      // Set end date to end of day for inclusive filtering
      endDate.setHours(23, 59, 59, 999);

      // Type definitions
      type ProductType = "cider" | "perry" | "brandy" | "pommeau" | "juice" | "other";

      type ProductTypeSummary = {
        productType: ProductType;
        ttbTaxClass: string;
        batchCount: number;
        // Source side (where volume comes from)
        openingBalanceLiters: number;
        productionLiters: number;      // New batches created in period
        receiptsLiters: number;        // Brandy returns or external transfers
        blendedInLiters: number;       // Volume received via blending
        totalSourceLiters: number;
        // Destination side (where volume goes)
        packagedLiters: number;
        distilledLiters: number;       // Cider only - sent to distillery
        blendedOutLiters: number;      // Volume transferred to other batches
        lossesLiters: number;
        endingBalanceLiters: number;
        totalDestinationLiters: number;
        // Reconciliation
        discrepancyLiters: number;
        isBalanced: boolean;
      };

      type DistilleryOperation = {
        id: string;
        type: "sent" | "received";
        sourceBatchId: string | null;
        sourceBatchName: string | null;
        resultBatchId: string | null;
        resultBatchName: string | null;
        volumeLiters: number;
        abv: number | null;
        date: Date;
        distilleryName: string;
        status: string;
      };

      type DiscrepancyItem = {
        type: "volume_mismatch" | "missing_source" | "orphan_brandy" | "missing_distillation" | "unbalanced_yield";
        batchId: string;
        batchName: string;
        productType: ProductType;
        description: string;
        volumeAffectedLiters: number;
        suggestedAction: string;
      };

      // TTB tax class mapping
      const getTTBTaxClass = (productType: ProductType): string => {
        switch (productType) {
          case "cider":
          case "perry":
          case "juice":
            return "Wine (7% or less)";
          case "brandy":
            return "Spirits";
          case "pommeau":
            return "Wine (16-21%)";
          default:
            return "Other";
        }
      };

      // Initialize summaries for each product type
      const initSummary = (productType: ProductType): ProductTypeSummary => ({
        productType,
        ttbTaxClass: getTTBTaxClass(productType),
        batchCount: 0,
        openingBalanceLiters: 0,
        productionLiters: 0,
        receiptsLiters: 0,
        blendedInLiters: 0,
        totalSourceLiters: 0,
        packagedLiters: 0,
        distilledLiters: 0,
        blendedOutLiters: 0,
        lossesLiters: 0,
        endingBalanceLiters: 0,
        totalDestinationLiters: 0,
        discrepancyLiters: 0,
        isBalanced: true,
      });

      // ============ QUERY ALL BATCHES WITH PRODUCT TYPE ============
      // Get all verified batches that existed within or before the period
      const allBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          customName: batches.customName,
          batchNumber: batches.batchNumber,
          productType: batches.productType,
          initialVolume: batches.initialVolumeLiters,
          currentVolume: batches.currentVolumeLiters,
          status: batches.status,
          vesselId: batches.vesselId,
          vesselName: vessels.name,
          startDate: batches.startDate,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            sql`${batches.startDate} <= ${endDate}`,
            eq(batches.reconciliationStatus, "verified"),
            sql`NOT (${batches.batchNumber} LIKE 'LEGACY-%')`,
            isNull(batches.deletedAt),
            sql`${batches.status} != 'discarded'`,
            sql`(
              CAST(${batches.initialVolumeLiters} AS NUMERIC) > 0
              OR EXISTS (
                SELECT 1 FROM batch_transfers bt
                WHERE bt.destination_batch_id = ${batches.id}
                  AND bt.deleted_at IS NULL
              )
            )`
          )
        )
        .orderBy(asc(batches.productType), asc(batches.customName), asc(batches.name));

      if (allBatches.length === 0) {
        return {
          periodStart,
          periodEnd,
          summaries: {
            cider: initSummary("cider"),
            perry: initSummary("perry"),
            brandy: initSummary("brandy"),
            pommeau: initSummary("pommeau"),
            juice: initSummary("juice"),
            other: initSummary("other"),
          },
          grandSummary: {
            totalBatches: 0,
            totalSourceLiters: 0,
            totalDestinationLiters: 0,
            totalDiscrepancyLiters: 0,
            isBalanced: true,
          },
          distilleryOps: {
            ciderSentLiters: 0,
            brandyReceivedLiters: 0,
            operations: [] as DistilleryOperation[],
            pendingReturns: [] as { id: string; sourceBatchName: string; volumeSentLiters: number; sentAt: Date; distilleryName: string }[],
          },
          batchesByType: {
            cider: [],
            perry: [],
            brandy: [],
            pommeau: [],
            juice: [],
            other: [],
          } as Record<ProductType, typeof allBatches>,
          discrepancies: [] as DiscrepancyItem[],
        };
      }

      const batchIds = allBatches.map((b) => b.id);
      const batchIdSet = new Set(batchIds);

      // Group batches by product type
      const batchesByType: Record<ProductType, typeof allBatches> = {
        cider: [],
        perry: [],
        brandy: [],
        pommeau: [],
        juice: [],
        other: [],
      };

      for (const batch of allBatches) {
        const pType = (batch.productType || "other") as ProductType;
        if (batchesByType[pType]) {
          batchesByType[pType].push(batch);
        } else {
          batchesByType.other.push(batch);
        }
      }

      // ============ QUERY DISTILLATION RECORDS ============
      type DistillationRow = {
        id: string;
        source_batch_id: string;
        source_batch_name: string | null;
        source_volume_liters: string;
        source_abv: string | null;
        result_batch_id: string | null;
        result_batch_name: string | null;
        received_volume_liters: string | null;
        received_abv: string | null;
        sent_at: Date;
        received_at: Date | null;
        distillery_name: string;
        status: string;
      };

      const distillationResult = await db.execute(sql`
        SELECT
          dr.id,
          dr.source_batch_id,
          sb.custom_name as source_batch_name,
          dr.source_volume_liters,
          dr.source_abv,
          dr.result_batch_id,
          rb.custom_name as result_batch_name,
          dr.received_volume_liters,
          dr.received_abv,
          dr.sent_at,
          dr.received_at,
          dr.distillery_name,
          dr.status
        FROM distillation_records dr
        LEFT JOIN batches sb ON dr.source_batch_id = sb.id
        LEFT JOIN batches rb ON dr.result_batch_id = rb.id
        WHERE dr.deleted_at IS NULL
          AND (
            (dr.sent_at BETWEEN ${startDate} AND ${endDate})
            OR (dr.received_at BETWEEN ${startDate} AND ${endDate})
          )
        ORDER BY dr.sent_at
      `);

      const distillationRecords = (distillationResult as unknown as { rows: DistillationRow[] }).rows || [];

      // Build distillery operations list and calculate totals
      let ciderSentLiters = 0;
      let brandyReceivedLiters = 0;
      const distilleryOperations: DistilleryOperation[] = [];
      const pendingReturns: { id: string; sourceBatchName: string; volumeSentLiters: number; sentAt: Date; distilleryName: string }[] = [];

      for (const dr of distillationRecords) {
        const sentAt = new Date(dr.sent_at);
        const receivedAt = dr.received_at ? new Date(dr.received_at) : null;

        // Cider sent to distillery (within period)
        if (sentAt >= startDate && sentAt <= endDate) {
          const volumeSent = parseFloat(dr.source_volume_liters || "0");
          ciderSentLiters += volumeSent;
          distilleryOperations.push({
            id: dr.id,
            type: "sent",
            sourceBatchId: dr.source_batch_id,
            sourceBatchName: dr.source_batch_name,
            resultBatchId: dr.result_batch_id,
            resultBatchName: dr.result_batch_name,
            volumeLiters: volumeSent,
            abv: dr.source_abv ? parseFloat(dr.source_abv) : null,
            date: sentAt,
            distilleryName: dr.distillery_name,
            status: dr.status,
          });
        }

        // Brandy received from distillery (within period)
        if (receivedAt && receivedAt >= startDate && receivedAt <= endDate && dr.received_volume_liters) {
          const volumeReceived = parseFloat(dr.received_volume_liters);
          brandyReceivedLiters += volumeReceived;
          distilleryOperations.push({
            id: dr.id,
            type: "received",
            sourceBatchId: dr.source_batch_id,
            sourceBatchName: dr.source_batch_name,
            resultBatchId: dr.result_batch_id,
            resultBatchName: dr.result_batch_name,
            volumeLiters: volumeReceived,
            abv: dr.received_abv ? parseFloat(dr.received_abv) : null,
            date: receivedAt,
            distilleryName: dr.distillery_name,
            status: dr.status,
          });
        }

        // Track pending returns (sent but not yet received)
        if (dr.status === "sent" && !dr.received_at) {
          pendingReturns.push({
            id: dr.id,
            sourceBatchName: dr.source_batch_name || "Unknown",
            volumeSentLiters: parseFloat(dr.source_volume_liters || "0"),
            sentAt: sentAt,
            distilleryName: dr.distillery_name,
          });
        }
      }

      // ============ QUERY ALL ACTIVITY DATA ============
      const destBatch = aliasedTable(batches, "destBatch");
      const sourceBatch = aliasedTable(batches, "sourceBatch");

      // Transfers out
      const allTransfersOut = await db
        .select({
          id: batchTransfers.id,
          sourceBatchId: batchTransfers.sourceBatchId,
          date: batchTransfers.transferredAt,
          volumeOut: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          destinationId: batchTransfers.destinationBatchId,
        })
        .from(batchTransfers)
        .where(
          and(
            inArray(batchTransfers.sourceBatchId, batchIds),
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            isNull(batchTransfers.deletedAt)
          )
        );

      // Transfers in
      const allTransfersIn = await db
        .select({
          id: batchTransfers.id,
          destinationBatchId: batchTransfers.destinationBatchId,
          date: batchTransfers.transferredAt,
          volumeIn: batchTransfers.volumeTransferred,
          sourceId: batchTransfers.sourceBatchId,
        })
        .from(batchTransfers)
        .where(
          and(
            inArray(batchTransfers.destinationBatchId, batchIds),
            sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
            isNull(batchTransfers.deletedAt)
          )
        );

      // Bottlings
      const allBottlings = await db
        .select({
          id: bottleRuns.id,
          batchId: bottleRuns.batchId,
          date: bottleRuns.packagedAt,
          unitsProduced: bottleRuns.unitsProduced,
          packageSizeML: bottleRuns.packageSizeML,
          volumeTaken: bottleRuns.volumeTakenLiters,
          loss: bottleRuns.loss,
        })
        .from(bottleRuns)
        .where(
          and(
            inArray(bottleRuns.batchId, batchIds),
            isNull(bottleRuns.voidedAt)
          )
        );

      // Keg fills
      const allKegFills = await db
        .select({
          id: kegFills.id,
          batchId: kegFills.batchId,
          date: kegFills.filledAt,
          volumeOut: kegFills.volumeTaken,
          loss: kegFills.loss,
        })
        .from(kegFills)
        .where(
          and(
            inArray(kegFills.batchId, batchIds),
            isNull(kegFills.voidedAt),
            isNull(kegFills.deletedAt)
          )
        );

      // Volume adjustments (losses)
      const allAdjustments = await db
        .select({
          id: batchVolumeAdjustments.id,
          batchId: batchVolumeAdjustments.batchId,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
        })
        .from(batchVolumeAdjustments)
        .where(
          and(
            inArray(batchVolumeAdjustments.batchId, batchIds),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        );

      // Rackings (losses)
      const allRackings = await db
        .select({
          id: batchRackingOperations.id,
          batchId: batchRackingOperations.batchId,
          loss: batchRackingOperations.volumeLoss,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .where(
          and(
            inArray(batchRackingOperations.batchId, batchIds),
            isNull(batchRackingOperations.deletedAt)
          )
        );

      // Filter operations (losses)
      const allFilterings = await db
        .select({
          id: batchFilterOperations.id,
          batchId: batchFilterOperations.batchId,
          loss: batchFilterOperations.volumeLoss,
        })
        .from(batchFilterOperations)
        .where(
          and(
            inArray(batchFilterOperations.batchId, batchIds),
            isNull(batchFilterOperations.deletedAt)
          )
        );

      // Distillations (cider sent out)
      type DistillationOutRow = { id: string; source_batch_id: string; volume_out: string };
      let allDistillationsOut: DistillationOutRow[] = [];
      if (batchIds.length > 0) {
        const distillationsOutResult = await db.execute(sql`
          SELECT id, source_batch_id, source_volume_liters as volume_out
          FROM distillation_records
          WHERE source_batch_id IN (${sql.join(batchIds.map(id => sql`${id}`), sql`, `)})
            AND deleted_at IS NULL
        `);
        allDistillationsOut = (distillationsOutResult as unknown as { rows: DistillationOutRow[] }).rows || [];
      }

      // ============ BUILD LOOKUP MAPS ============
      const transfersOutByBatch = new Map<string, typeof allTransfersOut>();
      for (const t of allTransfersOut) {
        if (!transfersOutByBatch.has(t.sourceBatchId)) transfersOutByBatch.set(t.sourceBatchId, []);
        transfersOutByBatch.get(t.sourceBatchId)!.push(t);
      }

      const transfersInByBatch = new Map<string, typeof allTransfersIn>();
      for (const t of allTransfersIn) {
        if (!transfersInByBatch.has(t.destinationBatchId)) transfersInByBatch.set(t.destinationBatchId, []);
        transfersInByBatch.get(t.destinationBatchId)!.push(t);
      }

      const bottlingsByBatch = new Map<string, typeof allBottlings>();
      for (const b of allBottlings) {
        if (!bottlingsByBatch.has(b.batchId)) bottlingsByBatch.set(b.batchId, []);
        bottlingsByBatch.get(b.batchId)!.push(b);
      }

      const kegFillsByBatch = new Map<string, typeof allKegFills>();
      for (const k of allKegFills) {
        if (!kegFillsByBatch.has(k.batchId)) kegFillsByBatch.set(k.batchId, []);
        kegFillsByBatch.get(k.batchId)!.push(k);
      }

      const adjustmentsByBatch = new Map<string, typeof allAdjustments>();
      for (const a of allAdjustments) {
        if (!adjustmentsByBatch.has(a.batchId)) adjustmentsByBatch.set(a.batchId, []);
        adjustmentsByBatch.get(a.batchId)!.push(a);
      }

      const rackingsByBatch = new Map<string, typeof allRackings>();
      for (const r of allRackings) {
        if (!rackingsByBatch.has(r.batchId)) rackingsByBatch.set(r.batchId, []);
        rackingsByBatch.get(r.batchId)!.push(r);
      }

      const filteringsByBatch = new Map<string, typeof allFilterings>();
      for (const f of allFilterings) {
        if (!filteringsByBatch.has(f.batchId)) filteringsByBatch.set(f.batchId, []);
        filteringsByBatch.get(f.batchId)!.push(f);
      }

      const distillationsOutByBatch = new Map<string, typeof allDistillationsOut>();
      for (const d of allDistillationsOut) {
        if (!distillationsOutByBatch.has(d.source_batch_id)) distillationsOutByBatch.set(d.source_batch_id, []);
        distillationsOutByBatch.get(d.source_batch_id)!.push(d);
      }

      // ============ CALCULATE SUMMARIES BY PRODUCT TYPE ============
      const summaries: Record<ProductType, ProductTypeSummary> = {
        cider: initSummary("cider"),
        perry: initSummary("perry"),
        brandy: initSummary("brandy"),
        pommeau: initSummary("pommeau"),
        juice: initSummary("juice"),
        other: initSummary("other"),
      };

      const discrepancies: DiscrepancyItem[] = [];

      // Process each batch and aggregate into product type summaries
      for (const batch of allBatches) {
        const pType = (batch.productType || "other") as ProductType;
        const summary = summaries[pType] || summaries.other;

        summary.batchCount++;

        const initialVolume = parseFloat(batch.initialVolume || "0");
        const currentVolume = parseFloat(batch.currentVolume || "0");
        const batchStartDate = batch.startDate ? new Date(batch.startDate) : null;

        // Determine if this batch existed before the period (opening balance)
        // vs created during the period (production)
        if (batchStartDate && batchStartDate < startDate) {
          // Batch existed before period - contributes to opening balance
          // Opening balance = initial volume + all inflows - all outflows up to period start
          // For simplicity, we use current volume as the "effective" state
          // In a full implementation, you'd calculate volume at period start
          summary.openingBalanceLiters += initialVolume;
        } else {
          // Batch created during period - counts as production
          summary.productionLiters += initialVolume;
        }

        // Ending balance is current volume
        summary.endingBalanceLiters += currentVolume;

        // Process transfers out (blended out)
        const transfersOut = transfersOutByBatch.get(batch.id) || [];
        for (const t of transfersOut) {
          summary.blendedOutLiters += parseFloat(t.volumeOut || "0");
          // Add transfer loss to losses
          const tLoss = parseFloat(t.loss || "0");
          if (tLoss > 0) {
            summary.lossesLiters += tLoss;
          }
        }

        // Process transfers in (blended in or receipts)
        const transfersIn = transfersInByBatch.get(batch.id) || [];
        for (const t of transfersIn) {
          const volumeIn = parseFloat(t.volumeIn || "0");
          // Check if source is within our tracked batches or external
          if (batchIdSet.has(t.sourceId)) {
            summary.blendedInLiters += volumeIn;
          } else {
            // External source - count as receipts
            summary.receiptsLiters += volumeIn;
          }
        }

        // Process bottlings
        const bBottlings = bottlingsByBatch.get(batch.id) || [];
        for (const b of bBottlings) {
          summary.packagedLiters += parseFloat(b.volumeTaken || "0");
        }

        // Process keg fills
        const bKegFills = kegFillsByBatch.get(batch.id) || [];
        for (const k of bKegFills) {
          summary.packagedLiters += parseFloat(k.volumeOut || "0");
        }

        // Process volume adjustments (losses)
        const bAdjustments = adjustmentsByBatch.get(batch.id) || [];
        for (const a of bAdjustments) {
          const amount = parseFloat(a.adjustmentAmount || "0");
          if (amount < 0) {
            summary.lossesLiters += Math.abs(amount);
          }
        }

        // Process rackings (losses)
        const bRackings = rackingsByBatch.get(batch.id) || [];
        for (const r of bRackings) {
          const loss = parseFloat(r.loss || "0");
          if (loss > 0 && !r.notes?.includes("Historical Record")) {
            summary.lossesLiters += loss;
          }
        }

        // Process filterings (losses)
        const bFilterings = filteringsByBatch.get(batch.id) || [];
        for (const f of bFilterings) {
          const loss = parseFloat(f.loss || "0");
          if (loss > 0) {
            summary.lossesLiters += loss;
          }
        }

        // Process distillations (cider/perry only)
        if (pType === "cider" || pType === "perry") {
          const bDistillations = distillationsOutByBatch.get(batch.id) || [];
          for (const d of bDistillations) {
            summary.distilledLiters += parseFloat(d.volume_out || "0");
          }
        }
      }

      // Add brandy receipts from distillery returns
      summaries.brandy.receiptsLiters += brandyReceivedLiters;

      // Calculate totals for each product type
      for (const pType of Object.keys(summaries) as ProductType[]) {
        const s = summaries[pType];

        // Total source = opening + production + receipts + blended in
        s.totalSourceLiters = s.openingBalanceLiters + s.productionLiters + s.receiptsLiters + s.blendedInLiters;

        // Total destination = packaged + distilled + blended out + losses + ending
        s.totalDestinationLiters = s.packagedLiters + s.distilledLiters + s.blendedOutLiters + s.lossesLiters + s.endingBalanceLiters;

        // Discrepancy = source - destination
        s.discrepancyLiters = s.totalSourceLiters - s.totalDestinationLiters;
        s.isBalanced = Math.abs(s.discrepancyLiters) < 1; // Allow small rounding differences
      }

      // ============ CALCULATE GRAND SUMMARY ============
      const grandSummary = {
        totalBatches: allBatches.length,
        totalSourceLiters: Object.values(summaries).reduce((sum, s) => sum + s.totalSourceLiters, 0),
        totalDestinationLiters: Object.values(summaries).reduce((sum, s) => sum + s.totalDestinationLiters, 0),
        totalDiscrepancyLiters: Object.values(summaries).reduce((sum, s) => sum + s.discrepancyLiters, 0),
        isBalanced: Object.values(summaries).every(s => s.isBalanced),
      };

      // ============ IDENTIFY DISCREPANCIES ============
      for (const batch of allBatches) {
        const pType = (batch.productType || "other") as ProductType;
        const initialVolume = parseFloat(batch.initialVolume || "0");
        const currentVolume = parseFloat(batch.currentVolume || "0");

        // Calculate batch-level balance
        let inflow = initialVolume;
        let outflow = currentVolume;

        const transfersIn = transfersInByBatch.get(batch.id) || [];
        for (const t of transfersIn) {
          inflow += parseFloat(t.volumeIn || "0");
        }

        const transfersOut = transfersOutByBatch.get(batch.id) || [];
        for (const t of transfersOut) {
          outflow += parseFloat(t.volumeOut || "0");
          outflow += parseFloat(t.loss || "0");
        }

        const bBottlings = bottlingsByBatch.get(batch.id) || [];
        for (const b of bBottlings) {
          outflow += parseFloat(b.volumeTaken || "0");
        }

        const bKegFills = kegFillsByBatch.get(batch.id) || [];
        for (const k of bKegFills) {
          outflow += parseFloat(k.volumeOut || "0");
        }

        const bAdjustments = adjustmentsByBatch.get(batch.id) || [];
        for (const a of bAdjustments) {
          const amount = parseFloat(a.adjustmentAmount || "0");
          if (amount < 0) {
            outflow += Math.abs(amount);
          }
        }

        const bRackings = rackingsByBatch.get(batch.id) || [];
        for (const r of bRackings) {
          const loss = parseFloat(r.loss || "0");
          if (loss > 0 && !r.notes?.includes("Historical Record")) {
            outflow += loss;
          }
        }

        const bFilterings = filteringsByBatch.get(batch.id) || [];
        for (const f of bFilterings) {
          outflow += parseFloat(f.loss || "0");
        }

        const bDistillations = distillationsOutByBatch.get(batch.id) || [];
        for (const d of bDistillations) {
          outflow += parseFloat(d.volume_out || "0");
        }

        const batchDiscrepancy = inflow - outflow;
        if (Math.abs(batchDiscrepancy) > 1) {
          discrepancies.push({
            type: "volume_mismatch",
            batchId: batch.id,
            batchName: batch.customName || batch.name,
            productType: pType,
            description: `Inflow (${inflow.toFixed(1)}L) does not match outflow (${outflow.toFixed(1)}L)`,
            volumeAffectedLiters: Math.abs(batchDiscrepancy),
            suggestedAction: batchDiscrepancy > 0
              ? "Record a volume adjustment or check for missing transfers/packaging"
              : "Check for duplicate entries or unrecorded inflows",
          });
        }
      }

      // Check for orphan brandy batches (no distillation record linking them)
      for (const batch of batchesByType.brandy) {
        const hasDistillationLink = distillationRecords.some(
          dr => dr.result_batch_id === batch.id
        );
        if (!hasDistillationLink && parseFloat(batch.initialVolume || "0") > 0) {
          discrepancies.push({
            type: "orphan_brandy",
            batchId: batch.id,
            batchName: batch.customName || batch.name,
            productType: "brandy",
            description: "Brandy batch has no linked distillation record",
            volumeAffectedLiters: parseFloat(batch.initialVolume || "0"),
            suggestedAction: "Create a distillation record linking this brandy to its source cider",
          });
        }
      }

      return {
        periodStart,
        periodEnd,
        summaries,
        grandSummary,
        distilleryOps: {
          ciderSentLiters,
          brandyReceivedLiters,
          operations: distilleryOperations,
          pendingReturns,
        },
        batchesByType,
        discrepancies,
      };
    }),

  /**
   * Delete a legacy inventory batch.
   * Only legacy batches (those with LEGACY- prefix) can be deleted through this endpoint.
   */
  deleteLegacyBatch: adminProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { batchId } = input;

      // Verify this is a legacy batch
      const [batch] = await db
        .select({
          id: batches.id,
          batchNumber: batches.batchNumber,
        })
        .from(batches)
        .where(
          and(
            eq(batches.id, batchId),
            isNull(batches.deletedAt),
            like(batches.batchNumber, "LEGACY-%")
          )
        )
        .limit(1);

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Legacy batch not found",
        });
      }

      // Soft delete the batch
      await db
        .update(batches)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(batches.id, batchId));

      return { success: true };
    }),

  // ============================================================
  // VOLUME ADJUSTMENTS
  // Physical inventory corrections for bulk batches
  // ============================================================

  /**
   * Create a volume adjustment for a batch
   * Records the adjustment and updates batch.currentVolumeLiters
   */
  createVolumeAdjustment: createRbacProcedure("update", "batch")
    .input(
      z.object({
        batchId: z.string().uuid("Invalid batch ID"),
        adjustmentDate: z.date().or(z.string().transform((val) => new Date(val))),
        adjustmentType: z.enum([
          "evaporation",
          "measurement_error",
          "sampling",
          "contamination",
          "spillage",
          "theft",
          "sediment",
          "correction_up",
          "correction_down",
          "other",
        ]),
        volumeAfter: z.number().min(0, "Volume after cannot be negative"),
        reason: z.string().min(1, "Reason is required"),
        notes: z.string().optional(),
        reconciliationSnapshotId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Get the batch and verify it exists
          const [batch] = await tx
            .select({
              id: batches.id,
              name: batches.name,
              customName: batches.customName,
              currentVolume: batches.currentVolume,
              currentVolumeUnit: batches.currentVolumeUnit,
              currentVolumeLiters: batches.currentVolumeLiters,
              vesselId: batches.vesselId,
              status: batches.status,
            })
            .from(batches)
            .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
            .limit(1);

          if (!batch) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found",
            });
          }

          const volumeBeforeL = batch.currentVolumeLiters
            ? parseFloat(batch.currentVolumeLiters)
            : batch.currentVolume
              ? parseFloat(batch.currentVolume)
              : 0;

          const volumeAfterL = input.volumeAfter;
          const adjustmentAmount = volumeAfterL - volumeBeforeL;

          // 2. Create the volume adjustment record
          const [adjustment] = await tx
            .insert(batchVolumeAdjustments)
            .values({
              batchId: input.batchId,
              vesselId: batch.vesselId,
              adjustmentDate: input.adjustmentDate,
              adjustmentType: input.adjustmentType,
              volumeBefore: volumeBeforeL.toFixed(3),
              volumeAfter: volumeAfterL.toFixed(3),
              adjustmentAmount: adjustmentAmount.toFixed(3),
              reason: input.reason,
              notes: input.notes,
              reconciliationSnapshotId: input.reconciliationSnapshotId,
              adjustedBy: ctx.session?.user?.id,
            })
            .returning();

          // 3. Update the batch volume
          await tx
            .update(batches)
            .set({
              currentVolume: volumeAfterL.toFixed(3),
              currentVolumeUnit: "L",
              currentVolumeLiters: volumeAfterL.toFixed(3),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, input.batchId));

          return {
            adjustment,
            batch: {
              id: batch.id,
              name: batch.customName || batch.name,
              volumeBefore: volumeBeforeL,
              volumeAfter: volumeAfterL,
              adjustmentAmount,
            },
            message: `Volume adjusted from ${volumeBeforeL.toFixed(1)}L to ${volumeAfterL.toFixed(1)}L (${adjustmentAmount >= 0 ? "+" : ""}${adjustmentAmount.toFixed(1)}L)`,
          };
        });
      } catch (error) {
        console.error("Error creating volume adjustment:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create volume adjustment",
        });
      }
    }),

  /**
   * List volume adjustments for a batch
   */
  listVolumeAdjustments: protectedProcedure
    .input(
      z.object({
        batchId: z.string().uuid("Invalid batch ID"),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const adjustments = await db
        .select({
          id: batchVolumeAdjustments.id,
          batchId: batchVolumeAdjustments.batchId,
          vesselId: batchVolumeAdjustments.vesselId,
          adjustmentDate: batchVolumeAdjustments.adjustmentDate,
          adjustmentType: batchVolumeAdjustments.adjustmentType,
          volumeBefore: batchVolumeAdjustments.volumeBefore,
          volumeAfter: batchVolumeAdjustments.volumeAfter,
          adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
          reason: batchVolumeAdjustments.reason,
          notes: batchVolumeAdjustments.notes,
          reconciliationSnapshotId: batchVolumeAdjustments.reconciliationSnapshotId,
          adjustedBy: batchVolumeAdjustments.adjustedBy,
          createdAt: batchVolumeAdjustments.createdAt,
          vesselName: vessels.name,
        })
        .from(batchVolumeAdjustments)
        .leftJoin(vessels, eq(batchVolumeAdjustments.vesselId, vessels.id))
        .where(
          and(
            eq(batchVolumeAdjustments.batchId, input.batchId),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        )
        .orderBy(desc(batchVolumeAdjustments.adjustmentDate))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(batchVolumeAdjustments)
        .where(
          and(
            eq(batchVolumeAdjustments.batchId, input.batchId),
            isNull(batchVolumeAdjustments.deletedAt)
          )
        );

      return {
        adjustments,
        total: Number(countResult?.count || 0),
        hasMore: input.offset + input.limit < Number(countResult?.count || 0),
      };
    }),

  /**
   * Delete a volume adjustment (soft delete with volume rollback)
   */
  deleteVolumeAdjustment: createRbacProcedure("update", "batch")
    .input(
      z.object({
        adjustmentId: z.string().uuid("Invalid adjustment ID"),
        rollbackVolume: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Get the adjustment
          const [adjustment] = await tx
            .select({
              id: batchVolumeAdjustments.id,
              batchId: batchVolumeAdjustments.batchId,
              volumeBefore: batchVolumeAdjustments.volumeBefore,
              volumeAfter: batchVolumeAdjustments.volumeAfter,
              adjustmentAmount: batchVolumeAdjustments.adjustmentAmount,
            })
            .from(batchVolumeAdjustments)
            .where(
              and(
                eq(batchVolumeAdjustments.id, input.adjustmentId),
                isNull(batchVolumeAdjustments.deletedAt)
              )
            )
            .limit(1);

          if (!adjustment) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Volume adjustment not found",
            });
          }

          // 2. Soft delete the adjustment
          await tx
            .update(batchVolumeAdjustments)
            .set({
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(batchVolumeAdjustments.id, input.adjustmentId));

          // 3. Optionally rollback the batch volume
          if (input.rollbackVolume) {
            const volumeBefore = parseFloat(adjustment.volumeBefore || "0");

            await tx
              .update(batches)
              .set({
                currentVolume: volumeBefore.toFixed(3),
                currentVolumeUnit: "L",
                currentVolumeLiters: volumeBefore.toFixed(3),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, adjustment.batchId));
          }

          return {
            success: true,
            message: input.rollbackVolume
              ? `Volume adjustment deleted and batch volume restored to ${parseFloat(adjustment.volumeBefore || "0").toFixed(1)}L`
              : "Volume adjustment deleted (volume not rolled back)",
          };
        });
      } catch (error) {
        console.error("Error deleting volume adjustment:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete volume adjustment",
        });
      }
    }),
});

export type BatchRouter = typeof batchRouter;
