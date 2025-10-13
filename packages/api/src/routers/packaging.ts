import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  packagingRuns,
  vessels,
  batches,
  inventoryItems,
  packageSizes,
  packagingRunPhotos,
  users,
  batchCompositions,
  baseFruitVarieties,
  juiceVarieties,
  vendors,
  batchMeasurements,
  batchAdditives,
  additiveVarieties,
  batchTransfers,
} from "db";
import { eq, and, desc, isNull, sql, gte, lte, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publishCreateEvent, publishUpdateEvent } from "lib";
import {
  getPackagingRunsOptimized,
  getBatchPackagingRuns,
  getPackageSizesCached,
  getPackagingRunInventory,
  measureQuery,
  type CursorPaginationParams,
  type PackagingRunFilters,
} from "db";

// Input validation schemas
const createFromCellarSchema = z.object({
  batchId: z.string().uuid(),
  vesselId: z.string().uuid(),
  packagedAt: z.date().or(z.string().transform((val) => new Date(val))).default(() => new Date()),
  packageSizeMl: z.number().positive(),
  unitsProduced: z.number().int().min(0),
  volumeTakenL: z.number().positive(),
  notes: z.string().optional(),
});

const listPackagingRunsSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  batchId: z.string().uuid().optional(),
  batchSearch: z.string().optional(),
  packageType: z.string().optional(),
  packageSizeML: z.number().optional(),
  status: z.enum(["completed", "voided"]).optional(),
  limit: z.number().max(100).default(50), // Cap at 100 for performance
  offset: z.number().default(0),
  // Cursor-based pagination (preferred for performance)
  cursor: z.string().optional(),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

/**
 * Generates a lot code for inventory items
 * Format: {BATCH_NAME}-{YYYYMMDD}-{RUN_SEQUENCE}
 */
function generateLotCode(
  batchName: string,
  packagedAt: Date,
  runSequence: number,
): string {
  const dateStr = packagedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = runSequence.toString().padStart(2, "0");
  return `${batchName}-${dateStr}-${sequence}`;
}

/**
 * Determines package type from package size
 */
function determinePackageType(packageSizeMl: number): string {
  if (packageSizeMl <= 500) return "bottle";
  if (packageSizeMl <= 1000) return "can";
  return "keg";
}

/**
 * Calculate unit size in liters from package size in ML
 */
function calculateUnitSizeL(packageSizeMl: number): number {
  return packageSizeMl / 1000;
}

/**
 * Packaging Router
 * Handles packaging operations from cellar to finished goods inventory
 * RBAC: Operator and above can create and read packaging runs
 */
export const packagingRouter = router({
  /**
   * Create packaging run from cellar modal
   * Creates run, updates vessel volume, creates inventory
   */
  createFromCellar: createRbacProcedure("create", "package")
    .input(createFromCellarSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Validate vessel has sufficient volume and get details
          const vesselData = await tx
            .select({
              id: vessels.id,
              capacity: vessels.capacity,
              capacityUnit: vessels.capacityUnit,
              status: vessels.status,
              name: vessels.name,
            })
            .from(vessels)
            .where(
              and(eq(vessels.id, input.vesselId), isNull(vessels.deletedAt)),
            )
            .limit(1);

          if (!vesselData.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vessel not found",
            });
          }

          const vessel = vesselData[0];

          // Get batch data including status
          const batchData = await tx
            .select({
              id: batches.id,
              name: batches.name,
              status: batches.status,
              currentVolume: batches.currentVolume,
              currentVolumeUnit: batches.currentVolumeUnit,
              vesselId: batches.vesselId,
            })
            .from(batches)
            .where(
              and(
                eq(batches.id, input.batchId),
                eq(batches.vesselId, input.vesselId),
                isNull(batches.deletedAt),
              ),
            )
            .limit(1);

          if (!batchData.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found in specified vessel",
            });
          }

          const batch = batchData[0];

          // Check batch status - only "aging" batches can be bottled
          if (batch.status !== "aging") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Batch must be in aging stage to package. Current status: ${batch.status}`,
            });
          }
          const currentVolumeL = parseFloat(
            batch.currentVolume?.toString() || "0",
          );

          // Validate sufficient volume
          if (currentVolumeL < input.volumeTakenL) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient volume in vessel. Available: ${currentVolumeL}${batch.currentVolumeUnit || 'L'}, Requested: ${input.volumeTakenL}L`,
            });
          }

          // 2. Calculate loss and metrics
          const unitSizeL = calculateUnitSizeL(input.packageSizeMl);
          const theoreticalVolume = input.unitsProduced * unitSizeL;
          const lossL = input.volumeTakenL - theoreticalVolume;
          const lossPercentage = (lossL / input.volumeTakenL) * 100;

          // 3. Determine package type and get run sequence
          const packageType = determinePackageType(input.packageSizeMl);

          // Get count of packaging runs for this batch to determine sequence
          const runCountResult = await tx
            .select({ count: sql<number>`count(*)` })
            .from(packagingRuns)
            .where(
              and(
                eq(packagingRuns.batchId, input.batchId),
                eq(packagingRuns.status, "completed"),
              ),
            );

          const runSequence = (runCountResult[0]?.count || 0) + 1;

          // 4. Create packaging run
          const packagingRunData: any = {
            batchId: input.batchId,
            vesselId: input.vesselId,
            packagedAt: input.packagedAt,
            packageType: packageType as any,
            packageSizeML: input.packageSizeMl,
            unitSize: unitSizeL.toString(),
            unitSizeUnit: "L",
            unitsProduced: input.unitsProduced,
            volumeTaken: input.volumeTakenL.toString(),
            volumeTakenUnit: "L",
            loss: lossL.toString(),
            lossUnit: "L",
            lossPercentage: lossPercentage.toString(),
            status: "completed" as any,
            createdBy: ctx.session?.user?.id || "",
          };

          if (input.notes) {
            packagingRunData.productionNotes = input.notes;
          }

          const newPackagingRun = await tx
            .insert(packagingRuns)
            .values(packagingRunData)
            .returning();

          const packagingRun = newPackagingRun[0];

          // 5. Update vessel/batch volume
          const newVolumeL = currentVolumeL - input.volumeTakenL;

          await tx
            .update(batches)
            .set({
              currentVolume: newVolumeL.toString(),
              currentVolumeUnit: batch.currentVolumeUnit || "L",
              updatedAt: new Date(),
            })
            .where(eq(batches.id, input.batchId));

          // Update vessel status if volume is depleted
          let vesselStatus = vessel.status;
          if (newVolumeL <= 0) {
            vesselStatus = "cleaning" as any;
            await tx
              .update(vessels)
              .set({
                status: "cleaning" as any,
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.vesselId));
          }

          // 6. Generate lot code and create inventory item
          const lotCode = generateLotCode(
            batch.name || "BATCH",
            input.packagedAt,
            runSequence,
          );

          // Calculate expiration date (1 year from packaging)
          const expirationDate = new Date(input.packagedAt);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);

          const newInventoryItem = await tx
            .insert(inventoryItems)
            .values({
              batchId: input.batchId,
              lotCode: lotCode,
              packagingRunId: packagingRun.id,
              packageType: packageType,
              packageSizeML: input.packageSizeMl,
              expirationDate: expirationDate.toISOString().slice(0, 10) as any,
            })
            .returning();

          const inventoryItem = newInventoryItem[0];

          // 7. Publish audit event
          await publishCreateEvent("packaging_run", packagingRun.id, {
            batchId: input.batchId,
            vesselId: input.vesselId,
            unitsProduced: input.unitsProduced,
            volumeTakenL: input.volumeTakenL,
            lossL: lossL,
            packageType: packageType,
          });

          return {
            runId: packagingRun.id,
            lossL: parseFloat(lossL.toFixed(2)),
            lossPercentage: parseFloat(lossPercentage.toFixed(2)),
            vesselStatus: vesselStatus,
            inventoryItemId: inventoryItem.id,
            lotCode: lotCode,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating packaging run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create packaging run",
        });
      }
    }),

  /**
   * Get single packaging run by ID
   * Returns full run details with relations
   */
  get: createRbacProcedure("read", "package")
    .input(z.string().uuid())
    .query(async ({ input: runId }) => {
      try {
        const packagingRunData = await db
          .select({
            id: packagingRuns.id,
            batchId: packagingRuns.batchId,
            vesselId: packagingRuns.vesselId,
            packagedAt: packagingRuns.packagedAt,
            packageType: packagingRuns.packageType,
            packageSizeML: packagingRuns.packageSizeML,
            unitSize: packagingRuns.unitSize,
            unitSizeUnit: packagingRuns.unitSizeUnit,
            unitsProduced: packagingRuns.unitsProduced,
            volumeTaken: packagingRuns.volumeTaken,
            volumeTakenUnit: packagingRuns.volumeTakenUnit,
            loss: packagingRuns.loss,
            lossUnit: packagingRuns.lossUnit,
            lossPercentage: packagingRuns.lossPercentage,
            abvAtPackaging: packagingRuns.abvAtPackaging,
            carbonationLevel: packagingRuns.carbonationLevel,
            fillCheck: packagingRuns.fillCheck,
            fillVarianceML: packagingRuns.fillVarianceML,
            testMethod: packagingRuns.testMethod,
            testDate: packagingRuns.testDate,
            qaTechnicianId: packagingRuns.qaTechnicianId,
            qaNotes: packagingRuns.qaNotes,
            productionNotes: packagingRuns.productionNotes,
            status: packagingRuns.status,
            voidReason: packagingRuns.voidReason,
            voidedAt: packagingRuns.voidedAt,
            voidedBy: packagingRuns.voidedBy,
            createdBy: packagingRuns.createdBy,
            createdAt: packagingRuns.createdAt,
            updatedAt: packagingRuns.updatedAt,
            // Batch details
            batchName: batches.name,
            batchNumber: batches.batchNumber,
            batchStatus: batches.status,
            batchInitialVolume: batches.initialVolume,
            batchCurrentVolume: batches.currentVolume,
            batchStartDate: batches.startDate,
            batchEndDate: batches.endDate,
            // Vessel details
            vesselName: vessels.name,
            // User relations
            qaTechnicianName: sql<string>`qa_tech.name`.as("qaTechnicianName"),
            voidedByName: sql<string>`voided_user.name`.as("voidedByName"),
            createdByName: sql<string>`created_user.name`.as("createdByName"),
          })
          .from(packagingRuns)
          .leftJoin(batches, eq(packagingRuns.batchId, batches.id))
          .leftJoin(vessels, eq(packagingRuns.vesselId, vessels.id))
          .leftJoin(
            sql`users AS qa_tech`,
            sql`qa_tech.id = ${packagingRuns.qaTechnicianId}`,
          )
          .leftJoin(
            sql`users AS voided_user`,
            sql`voided_user.id = ${packagingRuns.voidedBy}`,
          )
          .leftJoin(
            sql`users AS created_user`,
            sql`created_user.id = ${packagingRuns.createdBy}`,
          )
          .where(eq(packagingRuns.id, runId))
          .limit(1);

        if (!packagingRunData.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Packaging run not found",
          });
        }

        const run = packagingRunData[0];

        console.log("📦 Fetching inventory for runId:", runId);
        // Get inventory items for this run (optimized)
        let inventory: any[] = [];
        try {
          const inventoryMap = await getPackagingRunInventory([runId]);
          inventory = inventoryMap.get(runId) || [];
          console.log("✅ Inventory fetched:", inventory.length, "items");
        } catch (inventoryError) {
          console.error("❌ Inventory fetch error:", inventoryError);
          inventory = [];
        }

        // Get photos for this run
        const photos = await db
          .select({
            id: packagingRunPhotos.id,
            photoUrl: packagingRunPhotos.photoUrl,
            photoType: packagingRunPhotos.photoType,
            caption: packagingRunPhotos.caption,
            uploadedBy: packagingRunPhotos.uploadedBy,
            uploadedAt: packagingRunPhotos.uploadedAt,
            uploaderName: users.name,
          })
          .from(packagingRunPhotos)
          .leftJoin(users, eq(packagingRunPhotos.uploadedBy, users.id))
          .where(eq(packagingRunPhotos.packagingRunId, runId))
          .orderBy(desc(packagingRunPhotos.uploadedAt));

        // Get batch composition
        const compositionData = await db
          .select({
            varietyName: baseFruitVarieties.name,
            vendorName: vendors.name,
            volumeL: batchCompositions.juiceVolume,
            percentageOfBatch: batchCompositions.fractionOfBatch,
          })
          .from(batchCompositions)
          .leftJoin(
            baseFruitVarieties,
            eq(batchCompositions.varietyId, baseFruitVarieties.id),
          )
          .leftJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .where(eq(batchCompositions.batchId, run.batchId));

        // Get batch measurements (last 5)
        const measurements = await db
          .select({
            measurementType: batchMeasurements.measurementType,
            value: batchMeasurements.value,
            measuredAt: batchMeasurements.measuredAt,
          })
          .from(batchMeasurements)
          .where(eq(batchMeasurements.batchId, run.batchId))
          .orderBy(desc(batchMeasurements.measuredAt))
          .limit(5);

        // Get batch additives (last 5)
        const additives = await db
          .select({
            additiveName: additiveVarieties.name,
            amountAdded: batchAdditives.amountAdded,
            unitType: batchAdditives.unitType,
            addedAt: batchAdditives.addedAt,
          })
          .from(batchAdditives)
          .leftJoin(
            additiveVarieties,
            eq(batchAdditives.additiveId, additiveVarieties.id),
          )
          .where(eq(batchAdditives.batchId, run.batchId))
          .orderBy(desc(batchAdditives.addedAt))
          .limit(5);

        // Get batch transfers (last 5)
        const transfers = await db
          .select({
            volumeTransferred: batchTransfers.volumeTransferred,
            destinationVesselName: sql<string>`dest_vessel.name`,
            transferredAt: batchTransfers.transferDate,
          })
          .from(batchTransfers)
          .leftJoin(
            sql`vessels AS dest_vessel`,
            sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`,
          )
          .where(eq(batchTransfers.sourceBatchId, run.batchId))
          .orderBy(desc(batchTransfers.transferDate))
          .limit(5);

        return {
          ...run,
          batch: {
            id: run.batchId,
            name: run.batchName,
            batchNumber: run.batchNumber,
            status: run.batchStatus,
            initialVolume: run.batchInitialVolume
              ? parseFloat(run.batchInitialVolume.toString())
              : undefined,
            currentVolume: run.batchCurrentVolume
              ? parseFloat(run.batchCurrentVolume.toString())
              : undefined,
            startDate: run.batchStartDate,
            endDate: run.batchEndDate,
            composition: compositionData.map((c) => ({
              varietyName: c.varietyName,
              vendorName: c.vendorName,
              volumeL: c.volumeL ? parseFloat(c.volumeL.toString()) : 0,
              percentageOfBatch: c.percentageOfBatch
                ? parseFloat(c.percentageOfBatch.toString())
                : 0,
            })),
            history: {
              measurements: measurements.map((m) => ({
                measurementType: m.measurementType,
                value: m.value,
                measuredAt: m.measuredAt,
              })),
              additives: additives.map((a) => ({
                additiveName: a.additiveName,
                amountAdded: a.amountAdded
                  ? parseFloat(a.amountAdded.toString())
                  : 0,
                unitType: a.unitType,
                addedAt: a.addedAt,
              })),
              transfers: transfers.map((t) => ({
                volumeTransferred: t.volumeTransferred
                  ? parseFloat(t.volumeTransferred.toString())
                  : 0,
                destinationVesselName: t.destinationVesselName,
                transferredAt: t.transferredAt,
              })),
            },
          },
          vessel: {
            id: run.vesselId,
            name: run.vesselName,
          },
          inventory,
          photos,
          // Convert string numbers to numbers
          volumeTaken: parseFloat(run.volumeTaken?.toString() || "0"),
          volumeTakenUnit: run.volumeTakenUnit,
          loss: parseFloat(run.loss?.toString() || "0"),
          lossUnit: run.lossUnit,
          lossPercentage: parseFloat(run.lossPercentage?.toString() || "0"),
          abvAtPackaging: run.abvAtPackaging
            ? parseFloat(run.abvAtPackaging.toString())
            : undefined,
          fillVarianceML: run.fillVarianceML
            ? parseFloat(run.fillVarianceML.toString())
            : undefined,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting packaging run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get packaging run",
        });
      }
    }),

  /**
   * List packaging runs with optimized filters and cursor-based pagination
   * Uses optimized queries with proper index utilization and caching
   */
  list: createRbacProcedure("list", "package")
    .input(listPackagingRunsSchema.optional())
    .query(async ({ input = {} }) => {
      try {
        // Prepare filters for optimized query
        const filters: PackagingRunFilters = {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          batchId: input.batchId,
          batchSearch: input.batchSearch,
          packageType: input.packageType,
          packageSizeML: input.packageSizeML,
          status: input.status,
        };

        // Prepare pagination parameters
        const pagination: CursorPaginationParams = {
          cursor: input.cursor,
          limit: input.limit || 50,
          direction: input.direction,
        };

        // Use optimized query with performance measurement
        const { result, metrics } = await measureQuery(
          "list-packaging-runs",
          () => getPackagingRunsOptimized(filters, pagination),
        );

        // Log performance metrics for monitoring
        if (metrics.executionTime > 500) {
          console.warn(
            `Packaging list query took ${metrics.executionTime}ms for ${metrics.rowsReturned} rows`,
          );
        }

        // Format response for backward compatibility
        const formattedRuns = result.items.map((run) => ({
          ...run,
          batch: {
            id: run.batchId,
            name: run.batchName,
          },
          vessel: {
            id: run.vesselId,
            name: run.vesselName,
          },
        }));

        return {
          runs: formattedRuns,
          total: result.totalCount,
          hasMore: result.hasNext,
          // Cursor-based pagination metadata
          nextCursor: result.nextCursor,
          previousCursor: result.previousCursor,
          // Legacy pagination for backward compatibility
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
        };
      } catch (error) {
        console.error("Error listing packaging runs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list packaging runs",
        });
      }
    }),

  /**
   * Update QA fields for a packaging run
   * Updates QA-specific fields with validation and audit logging
   */
  updateQA: createRbacProcedure("update", "package")
    .input(
      z.object({
        runId: z.string().uuid(),
        fillCheck: z.enum(["pass", "fail", "not_tested"]).optional(),
        fillVarianceMl: z.number().optional(),
        abvAtPackaging: z.number().min(0).max(100).optional(),
        carbonationLevel: z
          .enum(["still", "petillant", "sparkling"])
          .optional(),
        testMethod: z.string().optional(),
        testDate: z.date().optional(),
        qaTechnicianId: z.string().uuid().optional(),
        qaNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Get current packaging run data for audit logging
          const currentRun = await tx
            .select({
              id: packagingRuns.id,
              batchId: packagingRuns.batchId,
              fillCheck: packagingRuns.fillCheck,
              fillVarianceML: packagingRuns.fillVarianceML,
              abvAtPackaging: packagingRuns.abvAtPackaging,
              carbonationLevel: packagingRuns.carbonationLevel,
              testMethod: packagingRuns.testMethod,
              testDate: packagingRuns.testDate,
              qaTechnicianId: packagingRuns.qaTechnicianId,
              qaNotes: packagingRuns.qaNotes,
              status: packagingRuns.status,
            })
            .from(packagingRuns)
            .where(eq(packagingRuns.id, input.runId))
            .limit(1);

          if (!currentRun.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Packaging run not found",
            });
          }

          const run = currentRun[0];

          // 2. Validate QA technician exists if provided
          if (input.qaTechnicianId) {
            const technician = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, input.qaTechnicianId))
              .limit(1);

            if (!technician.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "QA technician not found",
              });
            }
          }

          // 3. Build update data only for provided fields
          const updateData: any = {
            updatedAt: new Date(),
          };

          if (input.fillCheck !== undefined)
            updateData.fillCheck = input.fillCheck;
          if (input.fillVarianceMl !== undefined)
            updateData.fillVarianceML = input.fillVarianceMl.toString();
          if (input.abvAtPackaging !== undefined)
            updateData.abvAtPackaging = input.abvAtPackaging.toString();
          if (input.carbonationLevel !== undefined)
            updateData.carbonationLevel = input.carbonationLevel;
          if (input.testMethod !== undefined)
            updateData.testMethod = input.testMethod;
          if (input.testDate !== undefined)
            updateData.testDate = input.testDate;
          if (input.qaTechnicianId !== undefined)
            updateData.qaTechnicianId = input.qaTechnicianId;
          if (input.qaNotes !== undefined) updateData.qaNotes = input.qaNotes;

          // 4. Update the packaging run
          const updatedRun = await tx
            .update(packagingRuns)
            .set(updateData)
            .where(eq(packagingRuns.id, input.runId))
            .returning();

          if (!updatedRun.length) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to update packaging run",
            });
          }

          // 5. Prepare audit data - only include changed fields
          const oldData: Record<string, any> = {};
          const newData: Record<string, any> = {};

          if (
            input.fillCheck !== undefined &&
            run.fillCheck !== input.fillCheck
          ) {
            oldData.fillCheck = run.fillCheck;
            newData.fillCheck = input.fillCheck;
          }
          if (
            input.fillVarianceMl !== undefined &&
            parseFloat(run.fillVarianceML?.toString() || "0") !==
              input.fillVarianceMl
          ) {
            oldData.fillVarianceMl = parseFloat(
              run.fillVarianceML?.toString() || "0",
            );
            newData.fillVarianceMl = input.fillVarianceMl;
          }
          if (
            input.abvAtPackaging !== undefined &&
            parseFloat(run.abvAtPackaging?.toString() || "0") !==
              input.abvAtPackaging
          ) {
            oldData.abvAtPackaging = parseFloat(
              run.abvAtPackaging?.toString() || "0",
            );
            newData.abvAtPackaging = input.abvAtPackaging;
          }
          if (
            input.carbonationLevel !== undefined &&
            run.carbonationLevel !== input.carbonationLevel
          ) {
            oldData.carbonationLevel = run.carbonationLevel;
            newData.carbonationLevel = input.carbonationLevel;
          }
          if (
            input.testMethod !== undefined &&
            run.testMethod !== input.testMethod
          ) {
            oldData.testMethod = run.testMethod;
            newData.testMethod = input.testMethod;
          }
          if (
            input.testDate !== undefined &&
            run.testDate?.toISOString() !== input.testDate.toISOString()
          ) {
            oldData.testDate = run.testDate;
            newData.testDate = input.testDate;
          }
          if (
            input.qaTechnicianId !== undefined &&
            run.qaTechnicianId !== input.qaTechnicianId
          ) {
            oldData.qaTechnicianId = run.qaTechnicianId;
            newData.qaTechnicianId = input.qaTechnicianId;
          }
          if (input.qaNotes !== undefined && run.qaNotes !== input.qaNotes) {
            oldData.qaNotes = run.qaNotes;
            newData.qaNotes = input.qaNotes;
          }

          // 6. Publish audit event only if there were actual changes
          if (Object.keys(newData).length > 0) {
            await publishUpdateEvent(
              "packaging_run",
              input.runId,
              oldData,
              newData,
              ctx.session?.user?.id,
              "QA fields updated",
            );
          }

          // 7. Return the updated run with parsed numbers
          const result = updatedRun[0];
          return {
            id: result.id,
            fillCheck: result.fillCheck,
            fillVarianceMl: result.fillVarianceML
              ? parseFloat(result.fillVarianceML.toString())
              : undefined,
            abvAtPackaging: result.abvAtPackaging
              ? parseFloat(result.abvAtPackaging.toString())
              : undefined,
            carbonationLevel: result.carbonationLevel,
            testMethod: result.testMethod,
            testDate: result.testDate,
            qaTechnicianId: result.qaTechnicianId,
            qaNotes: result.qaNotes,
            updatedAt: result.updatedAt,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating QA fields:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update QA fields",
        });
      }
    }),

  /**
   * Get package sizes for dropdown population (with caching)
   * Uses optimized cached query for frequently accessed reference data
   */
  getPackageSizes: createRbacProcedure("read", "package").query(async () => {
    try {
      // Use cached query for better performance
      const { result, metrics } = await measureQuery("get-package-sizes", () =>
        getPackageSizesCached(),
      );

      return result;
    } catch (error) {
      console.error("Error getting package sizes:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get package sizes",
      });
    }
  }),

  /**
   * Get packaging runs for specific batches (batch loading)
   * Optimized for bulk operations and dashboard views
   */
  getBatchRuns: createRbacProcedure("read", "package")
    .input(z.array(z.string().uuid()).max(50)) // Limit batch size
    .query(async ({ input: batchIds }) => {
      try {
        const { result, metrics } = await measureQuery(
          "get-batch-packaging-runs",
          () => getBatchPackagingRuns(batchIds),
        );

        // Convert Map to object for JSON serialization
        const batchRuns: Record<string, any[]> = {};
        for (const [batchId, runs] of result.entries()) {
          batchRuns[batchId] = runs.map((run) => ({
            ...run,
            batch: {
              id: run.batchId,
              name: run.batchName,
            },
            vessel: {
              id: run.vesselId,
              name: run.vesselName,
            },
          }));
        }

        return batchRuns;
      } catch (error) {
        console.error("Error getting batch packaging runs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get batch packaging runs",
        });
      }
    }),
});

export type PackagingRouter = typeof packagingRouter;
