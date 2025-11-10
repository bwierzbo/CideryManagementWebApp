import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  bottleRuns,
  bottleRunMaterials,
  vessels,
  batches,
  inventoryItems,
  packageSizes,
  bottleRunPhotos,
  users,
  batchCompositions,
  baseFruitVarieties,
  juiceVarieties,
  juicePurchaseItems,
  vendors,
  batchMeasurements,
  batchAdditives,
  additiveVarieties,
  batchTransfers,
  packagingPurchaseItems,
  squareConfig,
  batchCarbonationOperations,
} from "db";
import { eq, and, desc, isNull, sql, gte, lte, like, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publishCreateEvent, publishUpdateEvent } from "lib";
import { syncInventoryToSquare } from "../lib/square-inventory-sync";
import {
  getBottleRunsOptimized,
  getBatchBottleRuns,
  getPackageSizesCached,
  getBottleRunInventory,
  measureQuery,
  type CursorPaginationParams,
  type PackagingRunFilters,
} from "db";

// Input validation schemas
const packagingMaterialSchema = z.object({
  packagingPurchaseItemId: z.string().uuid(),
  quantityUsed: z.number().int().positive(),
  materialType: z.string(), // e.g., "Primary Packaging", "Caps", "Labels"
});

const createFromCellarSchema = z.object({
  batchId: z.string().uuid(),
  vesselId: z.string().uuid(),
  packagedAt: z.date().or(z.string().transform((val) => new Date(val))).default(() => new Date()),
  packageSizeMl: z.number().positive(),
  unitsProduced: z.number().int().min(0),
  volumeTakenL: z.number().positive(),
  notes: z.string().optional(),
  // Array of packaging materials used (bottles, caps, labels, etc.)
  // TODO: Make required once materials tracking UI is fully implemented
  materials: z.array(packagingMaterialSchema).optional(),
});

const listPackagingRunsSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  batchId: z.string().uuid().optional(),
  batchSearch: z.string().optional(),
  packageType: z.string().optional(),
  packageSizeML: z.number().optional(),
  status: z.enum(["active", "completed"]).optional(),
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
 * Most cideries bottle everything in glass bottles, with kegs for draft
 */
function determinePackageType(packageSizeMl: number): string {
  // Kegs are typically 19L (5 gallon) or larger
  if (packageSizeMl >= 19000) return "keg";
  // Everything else is bottled
  return "bottle";
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
export const bottlesRouter = router({
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
            .from(bottleRuns)
            .where(
              and(
                eq(bottleRuns.batchId, input.batchId),
                eq(bottleRuns.status, "completed"),
              ),
            );

          const runSequence = (runCountResult[0]?.count || 0) + 1;

          // 4. Create packaging run
          if (!ctx.session?.user?.id) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "User session required to create packaging run",
            });
          }

          // Find most recent completed carbonation operation for this batch
          const [latestCarbonation] = await tx
            .select({
              id: batchCarbonationOperations.id,
              finalCo2Volumes: batchCarbonationOperations.finalCo2Volumes,
            })
            .from(batchCarbonationOperations)
            .where(
              and(
                eq(batchCarbonationOperations.batchId, input.batchId),
                isNull(batchCarbonationOperations.deletedAt),
                sql`${batchCarbonationOperations.completedAt} IS NOT NULL`
              )
            )
            .orderBy(desc(batchCarbonationOperations.completedAt))
            .limit(1);

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
            // Link to most recent completed carbonation operation
            sourceCarbonationOperationId: latestCarbonation?.id ?? null,
            // Don't set status - let it default to null (active)
            createdBy: ctx.session.user.id,
          };

          if (input.notes) {
            packagingRunData.productionNotes = input.notes;
          }

          const newPackagingRun = await tx
            .insert(bottleRuns)
            .values(packagingRunData)
            .returning();

          const packagingRun = newPackagingRun[0];

          // 5. Update vessel/batch volume
          const newVolumeL = currentVolumeL - input.volumeTakenL;

          // If batch is fully packaged, mark as completed and clear vessel assignment
          // Use epsilon threshold (0.1L = 100ml) to handle display rounding and floating-point precision
          const EMPTY_THRESHOLD_L = 0.1;
          if (newVolumeL <= EMPTY_THRESHOLD_L) {
            await tx
              .update(batches)
              .set({
                currentVolume: "0",
                currentVolumeUnit: batch.currentVolumeUnit || "L",
                status: "completed",
                vesselId: null,
                endDate: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));

            // Set vessel to cleaning status
            await tx
              .update(vessels)
              .set({
                status: "cleaning" as any,
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.vesselId));
          } else {
            // Partial packaging - just update volume
            await tx
              .update(batches)
              .set({
                currentVolume: newVolumeL.toString(),
                currentVolumeUnit: batch.currentVolumeUnit || "L",
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));
          }

          let vesselStatus = newVolumeL <= EMPTY_THRESHOLD_L ? ("cleaning" as any) : vessel.status;

          // 6. Generate lot code and create inventory item
          const lotCode = generateLotCode(
            batch.name || "BATCH",
            input.packagedAt,
            runSequence,
          );

          // Don't auto-add expiration dates for bottles - cider ages well in glass
          // Expiration dates should only be added if explicitly required (e.g., for cans)
          const newInventoryItem = await tx
            .insert(inventoryItems)
            .values({
              batchId: input.batchId,
              lotCode: lotCode,
              bottleRunId: packagingRun.id,
              packageType: packageType,
              packageSizeML: input.packageSizeMl,
              // expirationDate is optional and omitted for bottles
            })
            .returning();

          const inventoryItem = newInventoryItem[0];

          // 6.5. Sync to Square POS if configured and product is mapped
          try {
            // Check if Square sync is enabled
            const squareConfigData = await tx.query.squareConfig.findFirst();

            if (squareConfigData?.autoSyncEnabled && squareConfigData.locationId) {
              // Check if this inventory item has Square mapping
              if (inventoryItem.squareVariationId && inventoryItem.squareSyncEnabled !== false) {
                // Sync the newly created inventory to Square
                const syncResult = await syncInventoryToSquare(
                  inventoryItem.id,
                  input.unitsProduced,
                  squareConfigData.locationId
                );

                if (!syncResult.success) {
                  // Log the error but don't fail the transaction
                  // The sync can be retried manually from the admin UI
                  console.error(
                    `Square sync failed for inventory item ${inventoryItem.id}:`,
                    syncResult.errorMessage
                  );
                }
              }
            }
          } catch (squareSyncError) {
            // Don't fail the bottling operation if Square sync fails
            // Just log the error - admin can manually sync later
            console.error("Square sync error during bottling:", squareSyncError);
          }

          // 7. Track packaging materials used and deduct from inventory (if provided)
          if (input.materials && input.materials.length > 0) {
            for (const material of input.materials) {
              // Insert material tracking record
              await tx.insert(bottleRunMaterials).values({
                bottleRunId: packagingRun.id,
                packagingPurchaseItemId: material.packagingPurchaseItemId,
                quantityUsed: material.quantityUsed,
                materialType: material.materialType,
                createdBy: ctx.session.user.id,
              });

              // Deduct quantity from packaging inventory
              // Note: This assumes packaging inventory is tracked in a table
              // You may need to adjust this based on your actual inventory structure
              await tx.execute(sql`
                UPDATE packaging_purchase_items
                SET quantity = quantity - ${material.quantityUsed},
                    updated_at = NOW()
                WHERE id = ${material.packagingPurchaseItemId}
                AND quantity >= ${material.quantityUsed}
              `);
            }
          }

          // 8. Publish audit event
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
            id: bottleRuns.id,
            batchId: bottleRuns.batchId,
            vesselId: bottleRuns.vesselId,
            packagedAt: bottleRuns.packagedAt,
            packageType: bottleRuns.packageType,
            packageSizeML: bottleRuns.packageSizeML,
            unitSize: bottleRuns.unitSize,
            unitSizeUnit: bottleRuns.unitSizeUnit,
            unitsProduced: bottleRuns.unitsProduced,
            volumeTaken: bottleRuns.volumeTaken,
            volumeTakenUnit: bottleRuns.volumeTakenUnit,
            loss: bottleRuns.loss,
            lossUnit: bottleRuns.lossUnit,
            lossPercentage: bottleRuns.lossPercentage,
            abvAtPackaging: bottleRuns.abvAtPackaging,
            carbonationLevel: bottleRuns.carbonationLevel,
            carbonationCo2Volumes: sql<string>`carb_op.final_co2_volumes`.as("carbonationCo2Volumes"),
            fillCheck: bottleRuns.fillCheck,
            fillVarianceML: bottleRuns.fillVarianceML,
            testMethod: bottleRuns.testMethod,
            testDate: bottleRuns.testDate,
            qaTechnicianId: bottleRuns.qaTechnicianId,
            qaNotes: bottleRuns.qaNotes,
            productionNotes: bottleRuns.productionNotes,
            status: bottleRuns.status,
            voidReason: bottleRuns.voidReason,
            voidedAt: bottleRuns.voidedAt,
            voidedBy: bottleRuns.voidedBy,
            pasteurizedAt: bottleRuns.pasteurizedAt,
            labeledAt: bottleRuns.labeledAt,
            createdBy: bottleRuns.createdBy,
            createdAt: bottleRuns.createdAt,
            updatedAt: bottleRuns.updatedAt,
            // Batch details
            batchName: batches.name,
            batchCustomName: batches.customName,
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
          .from(bottleRuns)
          .leftJoin(batches, eq(bottleRuns.batchId, batches.id))
          .leftJoin(vessels, eq(bottleRuns.vesselId, vessels.id))
          .leftJoin(
            sql`batch_carbonation_operations AS carb_op`,
            sql`carb_op.id = ${bottleRuns.sourceCarbonationOperationId}`,
          )
          .leftJoin(
            sql`users AS qa_tech`,
            sql`qa_tech.id = ${bottleRuns.qaTechnicianId}`,
          )
          .leftJoin(
            sql`users AS voided_user`,
            sql`voided_user.id = ${bottleRuns.voidedBy}`,
          )
          .leftJoin(
            sql`users AS created_user`,
            sql`created_user.id = ${bottleRuns.createdBy}`,
          )
          .where(eq(bottleRuns.id, runId))
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
          const inventoryMap = await getBottleRunInventory([runId]);
          inventory = inventoryMap.get(runId) || [];
          console.log("✅ Inventory fetched:", inventory.length, "items");
        } catch (inventoryError) {
          console.error("❌ Inventory fetch error:", inventoryError);
          inventory = [];
        }

        // Get photos for this run
        const photos = await db
          .select({
            id: bottleRunPhotos.id,
            photoUrl: bottleRunPhotos.photoUrl,
            photoType: bottleRunPhotos.photoType,
            caption: bottleRunPhotos.caption,
            uploadedBy: bottleRunPhotos.uploadedBy,
            uploadedAt: bottleRunPhotos.uploadedAt,
            uploaderName: users.name,
          })
          .from(bottleRunPhotos)
          .leftJoin(users, eq(bottleRunPhotos.uploadedBy, users.id))
          .where(eq(bottleRunPhotos.bottleRunId, runId))
          .orderBy(desc(bottleRunPhotos.uploadedAt));

        // Get batch composition with pH and SG from juice purchases
        const compositionData = await db
          .select({
            varietyName: sql<string>`
              CASE
                WHEN ${batchCompositions.sourceType} = 'base_fruit' THEN ${baseFruitVarieties.name}
                WHEN ${batchCompositions.sourceType} = 'juice_purchase' THEN COALESCE(${juicePurchaseItems.varietyName}, ${juicePurchaseItems.juiceType})
                ELSE 'Unknown'
              END
            `,
            vendorName: vendors.name,
            volumeL: batchCompositions.juiceVolume,
            percentageOfBatch: batchCompositions.fractionOfBatch,
            ph: juicePurchaseItems.ph,
            specificGravity: juicePurchaseItems.specificGravity,
          })
          .from(batchCompositions)
          .leftJoin(
            baseFruitVarieties,
            eq(batchCompositions.varietyId, baseFruitVarieties.id),
          )
          .leftJoin(
            juicePurchaseItems,
            eq(batchCompositions.juicePurchaseItemId, juicePurchaseItems.id),
          )
          .leftJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .where(eq(batchCompositions.batchId, run.batchId));

        // Get batch measurements (last 20 for better ABV estimation from SG range)
        const measurements = await db
          .select({
            measurementDate: batchMeasurements.measurementDate,
            specificGravity: batchMeasurements.specificGravity,
            abv: batchMeasurements.abv,
            ph: batchMeasurements.ph,
            totalAcidity: batchMeasurements.totalAcidity,
            temperature: batchMeasurements.temperature,
          })
          .from(batchMeasurements)
          .where(eq(batchMeasurements.batchId, run.batchId))
          .orderBy(desc(batchMeasurements.measurementDate))
          .limit(20);

        // Get batch additives (last 5)
        const additives = await db
          .select({
            additiveName: batchAdditives.additiveName,
            amount: batchAdditives.amount,
            unit: batchAdditives.unit,
            addedAt: batchAdditives.addedAt,
          })
          .from(batchAdditives)
          .where(eq(batchAdditives.batchId, run.batchId))
          .orderBy(desc(batchAdditives.addedAt))
          .limit(5);

        // Get additive varieties for label impact and allergen info
        const additiveNames = additives.map(a => a.additiveName);
        let additiveVarietyMap = new Map();

        if (additiveNames.length > 0) {
          const varietyData = await db
            .select({
              name: additiveVarieties.name,
              labelImpact: additiveVarieties.labelImpact,
              labelImpactNotes: additiveVarieties.labelImpactNotes,
              allergensVegan: additiveVarieties.allergensVegan,
              allergensVeganNotes: additiveVarieties.allergensVeganNotes,
              itemType: additiveVarieties.itemType,
            })
            .from(additiveVarieties)
            .where(
              and(
                inArray(additiveVarieties.name, additiveNames),
                isNull(additiveVarieties.deletedAt)
              )
            );

          for (const variety of varietyData) {
            additiveVarietyMap.set(variety.name, variety);
          }
        }

        // Enrich additives with variety info
        const enrichedAdditives = additives.map(additive => {
          const varietyInfo = additiveVarietyMap.get(additive.additiveName);
          return {
            ...additive,
            labelImpact: varietyInfo?.labelImpact ?? false,
            labelImpactNotes: varietyInfo?.labelImpactNotes ?? null,
            allergensVegan: varietyInfo?.allergensVegan ?? false,
            allergensVeganNotes: varietyInfo?.allergensVeganNotes ?? null,
            itemType: varietyInfo?.itemType ?? null,
          };
        });

        // Get batch transfers (last 5)
        const transfers = await db
          .select({
            volumeTransferred: batchTransfers.volumeTransferred,
            destinationVesselName: sql<string>`dest_vessel.name`,
            transferredAt: batchTransfers.transferredAt,
          })
          .from(batchTransfers)
          .leftJoin(
            sql`vessels AS dest_vessel`,
            sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`,
          )
          .where(eq(batchTransfers.sourceBatchId, run.batchId))
          .orderBy(desc(batchTransfers.transferredAt))
          .limit(5);

        return {
          ...run,
          batch: {
            id: run.batchId,
            name: run.batchName,
            customName: run.batchCustomName,
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
                ? parseFloat(c.percentageOfBatch.toString()) * 100
                : 0,
              ph: c.ph ? parseFloat(c.ph.toString()) : null,
              specificGravity: c.specificGravity ? parseFloat(c.specificGravity.toString()) : null,
            })),
            history: {
              measurements: measurements.map((m) => ({
                measurementDate: m.measurementDate,
                specificGravity: m.specificGravity ? parseFloat(m.specificGravity.toString()) : null,
                abv: m.abv ? parseFloat(m.abv.toString()) : null,
                ph: m.ph ? parseFloat(m.ph.toString()) : null,
                totalAcidity: m.totalAcidity ? parseFloat(m.totalAcidity.toString()) : null,
                temperature: m.temperature ? parseFloat(m.temperature.toString()) : null,
              })),
              additives: enrichedAdditives.map((a) => ({
                additiveName: a.additiveName,
                amount: a.amount ? parseFloat(a.amount.toString()) : 0,
                unit: a.unit,
                addedAt: a.addedAt,
                labelImpact: a.labelImpact,
                labelImpactNotes: a.labelImpactNotes,
                allergensVegan: a.allergensVegan,
                allergensVeganNotes: a.allergensVeganNotes,
                itemType: a.itemType,
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
          carbonationCo2Volumes: run.carbonationCo2Volumes
            ? parseFloat(run.carbonationCo2Volumes.toString())
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
          () => getBottleRunsOptimized(filters, pagination),
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
            customName: run.batchCustomName,
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
              id: bottleRuns.id,
              batchId: bottleRuns.batchId,
              fillCheck: bottleRuns.fillCheck,
              fillVarianceML: bottleRuns.fillVarianceML,
              abvAtPackaging: bottleRuns.abvAtPackaging,
              carbonationLevel: bottleRuns.carbonationLevel,
              testMethod: bottleRuns.testMethod,
              testDate: bottleRuns.testDate,
              qaTechnicianId: bottleRuns.qaTechnicianId,
              qaNotes: bottleRuns.qaNotes,
              status: bottleRuns.status,
            })
            .from(bottleRuns)
            .where(eq(bottleRuns.id, input.runId))
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
            .update(bottleRuns)
            .set(updateData)
            .where(eq(bottleRuns.id, input.runId))
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
          () => getBatchBottleRuns(batchIds),
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

  /**
   * Mark a bottle run as completed
   */
  markComplete: createRbacProcedure("update", "package")
    .input(z.object({ runId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        return await db.transaction(async (tx) => {
          // Update bottle run status to completed
          const [updated] = await tx
            .update(bottleRuns)
            .set({
              status: "completed",
              updatedAt: new Date(),
            })
            .where(eq(bottleRuns.id, input.runId))
            .returning();

          if (!updated) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Bottle run not found",
            });
          }

          // Update inventory item quantity to make it appear in finished goods inventory
          await tx
            .update(inventoryItems)
            .set({
              currentQuantity: updated.unitsProduced,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.bottleRunId, input.runId));

          return updated;
        });
      } catch (error) {
        console.error("Error marking bottle run as complete:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark bottle run as complete",
        });
      }
    }),

  /**
   * Mark a bottle run as pasteurized
   */
  pasteurize: createRbacProcedure("update", "package")
    .input(
      z.object({
        runId: z.string().uuid(),
        temperatureCelsius: z.number().min(0).max(100),
        timeMinutes: z.number().positive().max(120),
        pasteurizationUnits: z.number().positive(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const pasteurizedAt = new Date();

        const [updated] = await db
          .update(bottleRuns)
          .set({
            pasteurizationTemperatureCelsius: input.temperatureCelsius.toString(),
            pasteurizationTimeMinutes: input.timeMinutes.toString(),
            pasteurizationUnits: input.pasteurizationUnits.toString(),
            pasteurizedAt: pasteurizedAt,
            productionNotes: input.notes
              ? `${input.notes}\n\nPasteurized at ${pasteurizedAt.toISOString()} (${input.temperatureCelsius}°C for ${input.timeMinutes} min, ${input.pasteurizationUnits} PU)`
              : `Pasteurized at ${pasteurizedAt.toISOString()} (${input.temperatureCelsius}°C for ${input.timeMinutes} min, ${input.pasteurizationUnits} PU)`,
            updatedAt: new Date(),
          })
          .where(eq(bottleRuns.id, input.runId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bottle run not found",
          });
        }

        return updated;
      } catch (error) {
        console.error("Error pasteurizing bottle run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to pasteurize bottle run",
        });
      }
    }),

  /**
   * Mark a bottle run as labeled
   */
  label: createRbacProcedure("update", "package")
    .input(
      z.object({
        runId: z.string().uuid(),
        labeledAt: z.date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const labeledAt = input.labeledAt || new Date();

        const [updated] = await db
          .update(bottleRuns)
          .set({
            labeledAt: labeledAt,
            productionNotes: input.notes
              ? `${input.notes}\n\nLabeled at ${labeledAt.toISOString()}`
              : `Labeled at ${labeledAt.toISOString()}`,
            updatedAt: new Date(),
          })
          .where(eq(bottleRuns.id, input.runId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bottle run not found",
          });
        }

        return updated;
      } catch (error) {
        console.error("Error labeling bottle run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to label bottle run",
        });
      }
    }),

  /**
   * Apply labels from packaging inventory to a bottle run
   * Reduces label quantity from inventory
   */
  addLabel: createRbacProcedure("update", "package")
    .input(
      z.object({
        bottleRunId: z.string().uuid(),
        packagingItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Get the packaging item
          const [packagingItem] = await tx
            .select()
            .from(packagingPurchaseItems)
            .where(eq(packagingPurchaseItems.id, input.packagingItemId))
            .limit(1);

          if (!packagingItem) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Label not found in inventory",
            });
          }

          // Check if enough stock
          if (packagingItem.quantity < input.quantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient labels in stock. Available: ${packagingItem.quantity}, Requested: ${input.quantity}`,
            });
          }

          // Reduce label quantity
          const newQuantity = packagingItem.quantity - input.quantity;
          await tx
            .update(packagingPurchaseItems)
            .set({
              quantity: newQuantity,
              updatedAt: new Date(),
            })
            .where(eq(packagingPurchaseItems.id, input.packagingItemId));

          // Update bottle run notes
          const [bottleRun] = await tx
            .select()
            .from(bottleRuns)
            .where(eq(bottleRuns.id, input.bottleRunId))
            .limit(1);

          if (!bottleRun) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Bottle run not found",
            });
          }

          const labelNote = `Applied ${input.quantity} labels (${packagingItem.size}) at ${new Date().toISOString()}`;
          const updatedNotes = bottleRun.productionNotes
            ? `${bottleRun.productionNotes}\n\n${labelNote}`
            : labelNote;

          const [updated] = await tx
            .update(bottleRuns)
            .set({
              productionNotes: updatedNotes,
              updatedAt: new Date(),
            })
            .where(eq(bottleRuns.id, input.bottleRunId))
            .returning();

          return {
            bottleRun: updated,
            labelsRemaining: newQuantity,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error applying labels:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to apply labels",
        });
      }
    }),
});

export type BottlesRouter = typeof bottlesRouter;
