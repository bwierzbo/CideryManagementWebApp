import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { MIN_WORKING_VOLUME_L } from "lib";
import { kegsRouter } from "./kegs";
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
  kegFills,
  kegFillMaterials,
  kegs,
  pressRuns,
  pressRunLoads,
  basefruitPurchaseItems,
  basefruitPurchases,
  additivePurchaseItems,
  workers,
  activityLaborAssignments,
  organizationSettings,
  inventoryDistributions,
} from "db";
import { eq, and, desc, isNull, sql, gte, lte, like, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publishCreateEvent, publishUpdateEvent } from "lib";
import { syncInventoryToSquare } from "../lib/square-inventory-sync";
import {
  getBottleRunsOptimized,
  getUnifiedPackagingRuns,
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

// Labor assignment schema for worker-based labor tracking
const laborAssignmentSchema = z.object({
  workerId: z.string().uuid(),
  hoursWorked: z.number().positive(),
});

const createFromCellarSchema = z.object({
  batchId: z.string().uuid(),
  vesselId: z.string().uuid(),
  packagedAt: z.date().or(z.string().transform((val) => new Date(val))),
  packageSizeMl: z.number().positive(),
  unitsProduced: z.number().int().min(0),
  volumeTakenL: z.number().positive(),
  notes: z.string().optional(),
  // Array of packaging materials used (bottles, caps, labels, etc.)
  // TODO: Make required once materials tracking UI is fully implemented
  materials: z.array(packagingMaterialSchema).optional(),
  // Optional keg fill ID when bottling from a filled keg
  kegFillId: z.string().uuid().optional(),
  // Worker-based labor tracking for COGS
  laborAssignments: z.array(laborAssignmentSchema).optional(),
});

const listPackagingRunsSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  batchId: z.string().uuid().optional(),
  batchSearch: z.string().optional(),
  packageType: z.string().optional(),
  packageSizeML: z.number().optional(),
  status: z.enum(["active", "ready", "distributed", "completed"]).optional(),
  limit: z.number().max(100).default(50), // Cap at 100 for performance
  offset: z.number().default(0),
  // Cursor-based pagination (preferred for performance)
  cursor: z.string().optional(),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

const updateBottleRunDatesSchema = z.object({
  runId: z.string().uuid("Invalid bottle run ID"),
  packagedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
  pasteurizedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
  labeledAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
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
          // Determine if bottling from keg or vessel
          const isBottlingFromKeg = !!input.kegFillId;
          let currentVolumeL = 0;
          let batch: any;
          let vessel: any;
          let kegFill: any;

          if (isBottlingFromKeg) {
            // Get keg fill details
            const kegFillData = await tx
              .select({
                id: kegFills.id,
                kegId: kegFills.kegId,
                batchId: kegFills.batchId,
                vesselId: kegFills.vesselId,
                volumeTaken: kegFills.volumeTaken,
                remainingVolume: kegFills.remainingVolume,
                status: kegFills.status,
              })
              .from(kegFills)
              .where(
                and(
                  eq(kegFills.id, input.kegFillId!),
                  isNull(kegFills.deletedAt)
                )
              )
              .limit(1);

            if (!kegFillData.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Keg fill not found",
              });
            }

            kegFill = kegFillData[0];

            if (kegFill.status !== "filled") {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Cannot bottle from keg with status: ${kegFill.status}`,
              });
            }

            // Use remaining volume or fall back to volume taken
            currentVolumeL = parseFloat(
              kegFill.remainingVolume?.toString() || kegFill.volumeTaken?.toString() || "0"
            );

            // Get batch and vessel details for the keg fill
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
                  eq(batches.id, kegFill.batchId),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            if (!batchData.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Batch not found for keg fill",
              });
            }

            batch = batchData[0];

            // Get vessel details
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
                and(eq(vessels.id, kegFill.vesselId), isNull(vessels.deletedAt)),
              )
              .limit(1);

            if (!vesselData.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Vessel not found for keg fill",
              });
            }

            vessel = vesselData[0];
          } else {
            // Original vessel bottling flow
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

          vessel = vesselData[0];

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

            batch = batchData[0];

            // Check batch status - only "aging" batches can be bottled from vessel
            if (batch.status !== "aging") {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Batch must be in aging stage to package. Current status: ${batch.status}`,
              });
            }
            currentVolumeL = parseFloat(
              batch.currentVolume?.toString() || "0",
            );
          }

          // Validate sufficient volume (for both keg and vessel)
          if (currentVolumeL < input.volumeTakenL) {
            const source = isBottlingFromKeg ? "keg" : "vessel";
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient volume in ${source}. Available: ${currentVolumeL}L, Requested: ${input.volumeTakenL}L`,
            });
          }

          // 2. Calculate loss and metrics
          const unitSizeL = calculateUnitSizeL(input.packageSizeMl);
          const theoreticalVolume = input.unitsProduced * unitSizeL;
          const lossL = input.volumeTakenL - theoreticalVolume;
          const lossPercentage = (lossL / input.volumeTakenL) * 100;

          // 3. Determine package type and get run sequence
          const packageType = determinePackageType(input.packageSizeMl);

          // Get count of packaging runs for this batch ON THIS DATE to determine sequence
          // Count all runs (not just completed) to prevent duplicate lot codes
          const packagedDateStr = input.packagedAt.toISOString().split('T')[0];
          const runCountResult = await tx
            .select({ count: sql<number>`count(*)` })
            .from(bottleRuns)
            .where(
              and(
                eq(bottleRuns.batchId, input.batchId),
                sql`DATE(${bottleRuns.packagedAt}) = ${packagedDateStr}`
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

          // Get overhead rate from organization settings
          const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
          const [orgSettings] = await tx
            .select({
              overheadTrackingEnabled: organizationSettings.overheadTrackingEnabled,
              overheadRatePerGallon: organizationSettings.overheadRatePerGallon,
            })
            .from(organizationSettings)
            .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
            .limit(1);

          // Calculate overhead cost if tracking is enabled
          // Convert liters to gallons: 1 gallon = 3.78541 liters
          let overheadCostAllocated: number | null = null;
          if (orgSettings?.overheadTrackingEnabled && orgSettings.overheadRatePerGallon) {
            const volumeGallons = input.volumeTakenL / 3.78541;
            const ratePerGallon = parseFloat(orgSettings.overheadRatePerGallon);
            overheadCostAllocated = Math.round(volumeGallons * ratePerGallon * 100) / 100;
          }

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
            // Link to keg fill if bottling from keg (for activity history tracking)
            kegFillId: input.kegFillId ?? null,
            // Don't set status - let it default to null (active)
            createdBy: ctx.session.user.id,
            // Overhead cost allocation based on volume
            overheadCostAllocated: overheadCostAllocated?.toString() ?? null,
          };

          if (input.notes) {
            packagingRunData.productionNotes = input.notes;
          }

          const newPackagingRun = await tx
            .insert(bottleRuns)
            .values(packagingRunData)
            .returning();

          const packagingRun = newPackagingRun[0];

          // 5. Update volume - keg fill OR vessel/batch
          const newVolumeL = currentVolumeL - input.volumeTakenL;
          // Use shared minimum working volume threshold (1.0L)
          // Volumes below this are considered residual waste

          if (isBottlingFromKeg) {
            // If keg is empty or below minimum working volume, soft-delete the fill and set keg to cleaning
            if (newVolumeL <= MIN_WORKING_VOLUME_L) {
              // Delete associated keg fill materials (hard delete - they're just junction records)
              await tx
                .delete(kegFillMaterials)
                .where(eq(kegFillMaterials.kegFillId, kegFill.id));

              // Soft-delete the keg fill (preserves history)
              await tx
                .update(kegFills)
                .set({
                  deletedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(kegFills.id, kegFill.id));

              // Update keg status to cleaning (needs cleaning before next use)
              await tx
                .update(kegs)
                .set({
                  status: "cleaning" as any,
                  updatedAt: new Date(),
                })
                .where(eq(kegs.id, kegFill.kegId));
            } else {
              // Update keg fill remaining volume
              await tx
                .update(kegFills)
                .set({
                  remainingVolume: newVolumeL.toString(),
                  updatedAt: new Date(),
                })
                .where(eq(kegFills.id, kegFill.id));
            }

            // Note: Do NOT update batch volume - it was already deducted when the keg was filled
          } else {
            // Original vessel bottling - update batch volume
            if (newVolumeL <= MIN_WORKING_VOLUME_L) {
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
          }

          let vesselStatus = (!isBottlingFromKeg && newVolumeL <= MIN_WORKING_VOLUME_L) ? ("cleaning" as any) : vessel.status;

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

              // Increment quantityUsed on packaging inventory
              await tx.execute(sql`
                UPDATE packaging_purchase_items
                SET quantity_used = quantity_used + ${material.quantityUsed},
                    updated_at = NOW()
                WHERE id = ${material.packagingPurchaseItemId}
                AND (quantity - quantity_used) >= ${material.quantityUsed}
              `);
            }
          }

          // 7.5. Save labor assignments if provided
          if (input.laborAssignments && input.laborAssignments.length > 0) {
            for (const assignment of input.laborAssignments) {
              // Get worker's current hourly rate
              const [worker] = await tx
                .select({ hourlyRate: workers.hourlyRate })
                .from(workers)
                .where(eq(workers.id, assignment.workerId))
                .limit(1);

              const hourlyRate = parseFloat(worker?.hourlyRate?.toString() || "20.00");
              const laborCost = assignment.hoursWorked * hourlyRate;

              await tx.insert(activityLaborAssignments).values({
                activityType: "bottle_run",
                bottleRunId: packagingRun.id,
                workerId: assignment.workerId,
                hoursWorked: assignment.hoursWorked.toString(),
                hourlyRateSnapshot: hourlyRate.toString(),
                laborCost: laborCost.toString(),
                createdBy: ctx.session.user.id,
              });
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
        // Include actual error message for debugging
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create packaging run: ${errorMessage}`,
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
            unitsLabeled: bottleRuns.unitsLabeled,
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

        // Get batch measurements from this batch AND all parent batches in the chain
        // Uses recursive CTE to traverse batch_transfers to find parent batches
        const measurements = await db.execute(sql`
          WITH RECURSIVE batch_chain AS (
            -- Start with the current batch
            SELECT id, name, 1 as depth FROM batches WHERE id = ${run.batchId}
            UNION ALL
            -- Recursively find parent batches via transfers
            -- Exclude self-referencing transfers and limit depth to prevent infinite loops
            SELECT b.id, b.name, bc.depth + 1
            FROM batches b
            JOIN batch_transfers bt ON bt.source_batch_id = b.id
            JOIN batch_chain bc ON bt.destination_batch_id = bc.id
            WHERE b.deleted_at IS NULL
              AND bt.source_batch_id != bt.destination_batch_id
              AND bc.depth < 10
          )
          SELECT
            bm.measurement_date,
            bm.specific_gravity,
            bm.abv,
            bm.ph,
            bm.total_acidity,
            bm.temperature,
            bm.is_estimated,
            bm.estimate_source,
            bm.measurement_method,
            bm.notes as measurement_notes,
            bc.name as source_batch_name
          FROM batch_chain bc
          JOIN batch_measurements bm ON bm.batch_id = bc.id
          WHERE bm.deleted_at IS NULL
          ORDER BY bm.measurement_date DESC
          LIMIT 20
        `) as { rows: Array<{
          measurement_date: Date;
          specific_gravity: string | null;
          abv: string | null;
          ph: string | null;
          total_acidity: string | null;
          temperature: string | null;
          is_estimated: boolean | null;
          estimate_source: string | null;
          measurement_method: string | null;
          measurement_notes: string | null;
          source_batch_name: string | null;
        }> };

        // Get batch additives from this batch AND all parent batches
        const additivesResult = await db.execute(sql`
          WITH RECURSIVE batch_chain AS (
            SELECT id, name, 1 as depth FROM batches WHERE id = ${run.batchId}
            UNION ALL
            SELECT b.id, b.name, bc.depth + 1
            FROM batches b
            JOIN batch_transfers bt ON bt.source_batch_id = b.id
            JOIN batch_chain bc ON bt.destination_batch_id = bc.id
            WHERE b.deleted_at IS NULL
              AND bt.source_batch_id != bt.destination_batch_id
              AND bc.depth < 10
          )
          SELECT
            ba.additive_name,
            ba.amount,
            ba.unit,
            ba.added_at,
            ba.notes as additive_notes,
            ba.total_cost,
            bc.name as source_batch_name
          FROM batch_chain bc
          JOIN batch_additives ba ON ba.batch_id = bc.id
          WHERE ba.deleted_at IS NULL
          ORDER BY ba.added_at DESC
          LIMIT 20
        `) as { rows: Array<{
          additive_name: string;
          amount: string | null;
          unit: string | null;
          added_at: Date;
          additive_notes: string | null;
          total_cost: string | null;
          source_batch_name: string | null;
        }> };
        const additives = additivesResult.rows.map(a => ({
          additiveName: a.additive_name,
          amount: a.amount,
          unit: a.unit,
          addedAt: a.added_at,
          notes: a.additive_notes,
          totalCost: a.total_cost ? parseFloat(a.total_cost) : null,
          sourceBatchName: a.source_batch_name,
        }));

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

        // Compile all notes from the batch chain (measurements, additives, transfers, carbonation)
        const compiledNotesResult = await db.execute(sql`
          WITH RECURSIVE batch_chain AS (
            SELECT id, name, start_date, 1 as depth FROM batches WHERE id = ${run.batchId}
            UNION ALL
            SELECT b.id, b.name, b.start_date, bc.depth + 1
            FROM batches b
            JOIN batch_transfers bt ON bt.source_batch_id = b.id
            JOIN batch_chain bc ON bt.destination_batch_id = bc.id
            WHERE b.deleted_at IS NULL
              AND bt.source_batch_id != bt.destination_batch_id
              AND bc.depth < 10
          )
          SELECT * FROM (
            -- Measurement notes
            SELECT 'measurement' as note_type, bc.name as source, bm.notes as note, bm.measurement_date as note_date
            FROM batch_chain bc
            JOIN batch_measurements bm ON bm.batch_id = bc.id
            WHERE bm.notes IS NOT NULL AND bm.notes != '' AND bm.deleted_at IS NULL
            UNION ALL
            -- Additive notes
            SELECT 'additive' as note_type, bc.name as source, ba.notes as note, ba.added_at as note_date
            FROM batch_chain bc
            JOIN batch_additives ba ON ba.batch_id = bc.id
            WHERE ba.notes IS NOT NULL AND ba.notes != '' AND ba.deleted_at IS NULL
            UNION ALL
            -- Transfer notes
            SELECT 'transfer' as note_type, bc.name as source, bt.notes as note, bt.transferred_at as note_date
            FROM batch_chain bc
            JOIN batch_transfers bt ON bt.source_batch_id = bc.id
            WHERE bt.notes IS NOT NULL AND bt.notes != '' AND bt.deleted_at IS NULL
            UNION ALL
            -- Carbonation notes
            SELECT 'carbonation' as note_type, bc.name as source, bco.notes as note, bco.completed_at as note_date
            FROM batch_chain bc
            JOIN batch_carbonation_operations bco ON bco.batch_id = bc.id
            WHERE bco.notes IS NOT NULL AND bco.notes != '' AND bco.deleted_at IS NULL
          ) all_notes
          ORDER BY note_date ASC
        `) as { rows: Array<{
          note_type: string;
          source: string;
          note: string;
          note_date: Date;
        }> };
        const compiledNotes = compiledNotesResult.rows;

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
            composition: (() => {
              // Calculate total volume from all compositions
              const totalVolumeL = compositionData.reduce((sum, c) =>
                sum + (c.volumeL ? parseFloat(c.volumeL.toString()) : 0), 0
              );

              return compositionData.map((c) => {
                const volumeL = c.volumeL ? parseFloat(c.volumeL.toString()) : 0;
                // Calculate percentage based on actual volume, not stored fractionOfBatch
                const percentageOfBatch = totalVolumeL > 0 ? (volumeL / totalVolumeL) * 100 : 0;

                return {
                  varietyName: c.varietyName,
                  vendorName: c.vendorName,
                  volumeL,
                  percentageOfBatch,
                  ph: c.ph ? parseFloat(c.ph.toString()) : null,
                  specificGravity: c.specificGravity ? parseFloat(c.specificGravity.toString()) : null,
                };
              });
            })(),
            history: {
              measurements: measurements.rows.map((m) => ({
                measurementDate: m.measurement_date,
                specificGravity: m.specific_gravity ? parseFloat(m.specific_gravity.toString()) : null,
                abv: m.abv ? parseFloat(m.abv.toString()) : null,
                ph: m.ph ? parseFloat(m.ph.toString()) : null,
                totalAcidity: m.total_acidity ? parseFloat(m.total_acidity.toString()) : null,
                temperature: m.temperature ? parseFloat(m.temperature.toString()) : null,
                isEstimated: m.is_estimated ?? false,
                estimateSource: m.estimate_source,
                measurementMethod: m.measurement_method,
                notes: m.measurement_notes,
                sourceBatchName: m.source_batch_name,
              })),
              additives: enrichedAdditives.map((a) => ({
                additiveName: a.additiveName,
                amount: a.amount ? parseFloat(a.amount.toString()) : 0,
                unit: a.unit,
                addedAt: a.addedAt,
                notes: a.notes,
                totalCost: a.totalCost,
                sourceBatchName: a.sourceBatchName,
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
            compiledNotes: compiledNotes.map((n) => ({
              type: n.note_type,
              source: n.source,
              note: n.note,
              date: n.note_date,
            })),
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
          offset: input.offset, // Support offset-based pagination as fallback
        };

        // Use unified query (bottles + kegs) with performance measurement
        const { result, metrics } = await measureQuery(
          "list-packaging-runs",
          () => getUnifiedPackagingRuns(filters, pagination),
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
    .input(z.object({
      runId: z.string().uuid(),
      completedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await db.transaction(async (tx) => {
          const completedAt = input.completedAt || new Date();

          // Update bottle run status to completed
          const [updated] = await tx
            .update(bottleRuns)
            .set({
              status: "completed",
              completedAt: completedAt,
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
   * Mark a bottle run as ready to distribute (QA complete)
   */
  markReady: createRbacProcedure("update", "package")
    .input(z.object({
      runId: z.string().uuid(),
      readyAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          const readyAt = input.readyAt || new Date();

          // Get current run to validate status
          const [run] = await tx
            .select({ status: bottleRuns.status })
            .from(bottleRuns)
            .where(eq(bottleRuns.id, input.runId));

          if (!run) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Bottle run not found",
            });
          }

          if (run.status !== "active") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Cannot mark as ready: run is currently '${run.status}', must be 'active'`,
            });
          }

          // Update bottle run status to ready
          const [updated] = await tx
            .update(bottleRuns)
            .set({
              status: "ready",
              readyAt: readyAt,
              readyBy: ctx.user.id,
              updatedAt: new Date(),
              updatedBy: ctx.user.id,
            })
            .where(eq(bottleRuns.id, input.runId))
            .returning();

          return updated;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error marking bottle run as ready:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark bottle run as ready",
        });
      }
    }),

  /**
   * Distribute a bottle run
   */
  distribute: createRbacProcedure("update", "package")
    .input(z.object({
      runId: z.string().uuid(),
      distributedAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
      distributionLocation: z.string().min(1, "Distribution location is required"),
      salesChannelId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          const distributedAt = input.distributedAt || new Date();

          // Get current run to validate status
          const [run] = await tx
            .select({ status: bottleRuns.status, unitsProduced: bottleRuns.unitsProduced })
            .from(bottleRuns)
            .where(eq(bottleRuns.id, input.runId));

          if (!run) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Bottle run not found",
            });
          }

          // Allow distribution from 'active', 'ready', or 'completed' status
          if (run.status !== "active" && run.status !== "ready" && run.status !== "completed") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Cannot distribute: run is currently '${run.status}', must be 'active', 'ready', or 'completed'`,
            });
          }

          // Build update object
          const updateData: Record<string, unknown> = {
            status: "distributed",
            distributedAt: distributedAt,
            distributedBy: ctx.user.id,
            distributionLocation: input.distributionLocation,
            updatedAt: new Date(),
            updatedBy: ctx.user.id,
          };

          // If skipping 'ready' status, auto-set readyAt
          if (run.status === "active") {
            updateData.readyAt = distributedAt;
            updateData.readyBy = ctx.user.id;
          }

          // Add sales channel if provided
          if (input.salesChannelId) {
            updateData.bottleRunSalesChannelId = input.salesChannelId;
          }

          // Update bottle run status to distributed
          const [updated] = await tx
            .update(bottleRuns)
            .set(updateData)
            .where(eq(bottleRuns.id, input.runId))
            .returning();

          // Get all inventory items for this run and create distribution records
          const items = await tx
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.bottleRunId, input.runId));

          for (const item of items) {
            const qty = run.unitsProduced || item.currentQuantity || 0;
            if (qty > 0) {
              // Create distribution record for TTB tracking
              await tx.insert(inventoryDistributions).values({
                inventoryItemId: item.id,
                distributionDate: distributedAt,
                distributionLocation: input.distributionLocation,
                salesChannelId: input.salesChannelId,
                quantityDistributed: qty,
                pricePerUnit: "0",
                totalRevenue: "0",
                distributedBy: ctx.user.id,
              });

              // Set quantity to 0 (fully distributed)
              await tx
                .update(inventoryItems)
                .set({
                  currentQuantity: 0,
                  updatedAt: new Date(),
                })
                .where(eq(inventoryItems.id, item.id));
            }
          }

          return updated;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error distributing bottle run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to distribute bottle run",
        });
      }
    }),

  /**
   * Get batch pasteurization planning data
   * Returns batch composition for product classification and PU targeting
   */
  getBatchPasteurizationData: createRbacProcedure("read", "package")
    .input(z.object({
      batchId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      try {
        // Get batch with final gravity
        const [batch] = await db
          .select({
            id: batches.id,
            name: batches.name,
            customName: batches.customName,
            finalGravity: batches.finalGravity,
          })
          .from(batches)
          .where(eq(batches.id, input.batchId))
          .limit(1);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Check for fruit additions
        const fruitAdditives = await db
          .select({
            id: batchAdditives.id,
            additiveName: batchAdditives.additiveName,
            additiveType: batchAdditives.additiveType,
          })
          .from(batchAdditives)
          .where(
            and(
              eq(batchAdditives.batchId, input.batchId),
              or(
                like(batchAdditives.additiveType, '%fruit%'),
                like(batchAdditives.additiveName, '%fruit%'),
                like(batchAdditives.additiveName, '%berry%'),
                like(batchAdditives.additiveName, '%cherry%'),
                like(batchAdditives.additiveName, '%peach%'),
                like(batchAdditives.additiveName, '%apple%'),
                like(batchAdditives.additiveName, '%plum%'),
              )
            )
          );

        const hasFruitAddition = fruitAdditives.length > 0;
        const finalGravity = batch.finalGravity ? parseFloat(batch.finalGravity.toString()) : 1.000;

        return {
          batchId: batch.id,
          batchName: batch.customName || batch.name || `Batch ${batch.id.slice(0, 8)}`,
          finalGravity,
          hasFruitAddition,
          fruitAdditives: fruitAdditives.map(f => f.additiveName),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching batch pasteurization data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch batch pasteurization data",
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
        pasteurizedAt: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
        temperatureCelsius: z.number().min(0).max(100),
        timeMinutes: z.number().min(0).max(120),
        pasteurizationUnits: z.number().positive(),
        bottlesLost: z.number().int().min(0).optional(),
        notes: z.string().optional(),
        // Worker-based labor tracking
        laborAssignments: z.array(laborAssignmentSchema).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Check if bottle run exists and is not already pasteurized
          const [existingRun] = await tx
            .select({
              id: bottleRuns.id,
              pasteurizedAt: bottleRuns.pasteurizedAt,
            })
            .from(bottleRuns)
            .where(eq(bottleRuns.id, input.runId))
            .limit(1);

          if (!existingRun) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Bottle run not found",
            });
          }

          if (existingRun.pasteurizedAt) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Bottle run is already pasteurized. Edit the pasteurization date instead of creating a new one.",
            });
          }

          const pasteurizedAt = input.pasteurizedAt || new Date();
          const lossNote = input.bottlesLost ? ` (${input.bottlesLost} bottles lost)` : '';

          const [updated] = await tx
            .update(bottleRuns)
            .set({
              pasteurizationTemperatureCelsius: input.temperatureCelsius.toString(),
              pasteurizationTimeMinutes: input.timeMinutes.toString(),
              pasteurizationUnits: input.pasteurizationUnits.toString(),
              pasteurizedAt: pasteurizedAt,
              pasteurizationLoss: input.bottlesLost || null,
              productionNotes: input.notes
                ? `${input.notes}\n\nPasteurized at ${pasteurizedAt.toISOString()} (${input.temperatureCelsius}°C for ${input.timeMinutes} min, ${input.pasteurizationUnits} PU)${lossNote}`
                : `Pasteurized at ${pasteurizedAt.toISOString()} (${input.temperatureCelsius}°C for ${input.timeMinutes} min, ${input.pasteurizationUnits} PU)${lossNote}`,
              updatedAt: new Date(),
            })
            .where(eq(bottleRuns.id, input.runId))
            .returning();

          // Save labor assignments if provided
          if (input.laborAssignments && input.laborAssignments.length > 0) {
            for (const assignment of input.laborAssignments) {
              // Get worker's current hourly rate
              const [worker] = await tx
                .select({ hourlyRate: workers.hourlyRate })
                .from(workers)
                .where(eq(workers.id, assignment.workerId))
                .limit(1);

              const hourlyRate = parseFloat(worker?.hourlyRate?.toString() || "20.00");
              const laborCost = assignment.hoursWorked * hourlyRate;

              await tx.insert(activityLaborAssignments).values({
                activityType: "pasteurization",
                bottleRunId: input.runId,
                workerId: assignment.workerId,
                hoursWorked: assignment.hoursWorked.toString(),
                hourlyRateSnapshot: hourlyRate.toString(),
                laborCost: laborCost.toString(),
                createdBy: ctx.session?.user?.id,
              });
            }
          }

          return updated;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
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
        // Worker-based labor tracking
        laborAssignments: z.array(laborAssignmentSchema).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          const labeledAt = input.labeledAt || new Date();

          const [updated] = await tx
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

          // Save labor assignments if provided
          if (input.laborAssignments && input.laborAssignments.length > 0) {
            for (const assignment of input.laborAssignments) {
              // Get worker's current hourly rate
              const [worker] = await tx
                .select({ hourlyRate: workers.hourlyRate })
                .from(workers)
                .where(eq(workers.id, assignment.workerId))
                .limit(1);

              const hourlyRate = parseFloat(worker?.hourlyRate?.toString() || "20.00");
              const laborCost = assignment.hoursWorked * hourlyRate;

              await tx.insert(activityLaborAssignments).values({
                activityType: "labeling",
                bottleRunId: input.runId,
                workerId: assignment.workerId,
                hoursWorked: assignment.hoursWorked.toString(),
                hourlyRateSnapshot: hourlyRate.toString(),
                laborCost: laborCost.toString(),
                createdBy: ctx.session?.user?.id,
              });
            }
          }

          return updated;
        });
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
        quantity: z.number().int().positive(), // Number of labels to use from inventory
        unitsToLabel: z.number().int().positive().optional(), // Number of bottles being labeled (for partial labeling)
        labeledAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        // Worker-based labor tracking (optional) - only set on first label application
        laborAssignments: z.array(laborAssignmentSchema).optional(),
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

          // Check if enough stock (available = quantity - quantityUsed)
          const available = packagingItem.quantity - (packagingItem.quantityUsed || 0);
          if (available < input.quantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient labels in stock. Available: ${available}, Requested: ${input.quantity}`,
            });
          }

          // Increment quantityUsed instead of decrementing quantity
          await tx
            .update(packagingPurchaseItems)
            .set({
              quantityUsed: sql`${packagingPurchaseItems.quantityUsed} + ${input.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(packagingPurchaseItems.id, input.packagingItemId));

          // Get bottle run to check current state
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

          // Insert label into bottleRunMaterials junction table
          await tx.insert(bottleRunMaterials).values({
            bottleRunId: input.bottleRunId,
            packagingPurchaseItemId: input.packagingItemId,
            quantityUsed: input.quantity,
            materialType: "Labels",
            createdBy: ctx.session.user.id,
          });

          // Calculate new unitsLabeled count
          const currentUnitsLabeled = bottleRun.unitsLabeled || 0;
          const unitsBeingLabeled = input.unitsToLabel || input.quantity; // Default to label quantity if not specified
          const newUnitsLabeled = Math.min(
            currentUnitsLabeled + unitsBeingLabeled,
            bottleRun.unitsProduced // Cap at total units produced
          );

          // Build update object
          const updateData: Record<string, unknown> = {
            unitsLabeled: newUnitsLabeled,
            updatedAt: new Date(),
          };

          // Set labeledAt timestamp only if not already set (first label application)
          if (!bottleRun.labeledAt) {
            updateData.labeledAt = input.labeledAt || new Date();
          }

          await tx
            .update(bottleRuns)
            .set(updateData)
            .where(eq(bottleRuns.id, input.bottleRunId));

          // Save labor assignments if provided (only on first label application)
          if (input.laborAssignments && input.laborAssignments.length > 0) {
            for (const assignment of input.laborAssignments) {
              // Get worker's current hourly rate
              const [worker] = await tx
                .select({ hourlyRate: workers.hourlyRate })
                .from(workers)
                .where(eq(workers.id, assignment.workerId))
                .limit(1);

              const hourlyRate = parseFloat(worker?.hourlyRate?.toString() || "20.00");
              const laborCost = assignment.hoursWorked * hourlyRate;

              await tx.insert(activityLaborAssignments).values({
                activityType: "labeling",
                bottleRunId: input.bottleRunId,
                workerId: assignment.workerId,
                hoursWorked: assignment.hoursWorked.toString(),
                hourlyRateSnapshot: hourlyRate.toString(),
                laborCost: laborCost.toString(),
                createdBy: ctx.session.user.id,
              });
            }
          }

          // Calculate remaining labels after this usage
          const labelsRemaining = available - input.quantity;

          return {
            success: true,
            labelsRemaining,
            labelName: packagingItem.size || "Label",
            unitsLabeled: newUnitsLabeled,
            unitsRemaining: bottleRun.unitsProduced - newUnitsLabeled,
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

  /**
   * Update bottle run dates (packaged, pasteurized, labeled)
   */
  updateBottleRunDates: createRbacProcedure("update", "package")
    .input(updateBottleRunDatesSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify bottle run exists
        const existingRun = await db
          .select()
          .from(bottleRuns)
          .where(eq(bottleRuns.id, input.runId))
          .limit(1);

        if (!existingRun.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bottle run not found",
          });
        }

        // Build update object with only provided dates
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.packagedAt) updateData.packagedAt = input.packagedAt;
        if (input.pasteurizedAt !== undefined) updateData.pasteurizedAt = input.pasteurizedAt;
        if (input.labeledAt !== undefined) updateData.labeledAt = input.labeledAt;

        // Update bottle run
        const updatedRun = await db
          .update(bottleRuns)
          .set(updateData)
          .where(eq(bottleRuns.id, input.runId))
          .returning();

        return {
          success: true,
          bottleRun: updatedRun[0],
          message: "Bottle run dates updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating bottle run dates:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update bottle run dates",
        });
      }
    }),

  /**
   * Get enhanced details for comprehensive bottle details page with COGS
   * Returns complete traceability from apples to bottles with full cost breakdown
   */
  getEnhancedDetails: createRbacProcedure("read", "package")
    .input(z.string().uuid())
    .query(async ({ input: bottleRunId }) => {
      try {
        // 1. Get basic bottle run info
        const [bottleRun] = await db
          .select()
          .from(bottleRuns)
          .where(eq(bottleRuns.id, bottleRunId))
          .limit(1);

        if (!bottleRun) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bottle run not found",
          });
        }

        // 1b. If this bottle run came from a keg, get the source keg fill details
        let sourceKegFill = null;
        if (bottleRun.kegFillId) {
          const [kegFillData] = await db
            .select({
              id: kegFills.id,
              filledAt: kegFills.filledAt,
              volumeTaken: kegFills.volumeTaken,
              volumeTakenUnit: kegFills.volumeTakenUnit,
              status: kegFills.status,
              kegNumber: kegs.kegNumber,
              kegType: kegs.kegType,
              kegId: kegs.id,
            })
            .from(kegFills)
            .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
            .where(eq(kegFills.id, bottleRun.kegFillId))
            .limit(1);

          if (kegFillData) {
            sourceKegFill = {
              ...kegFillData,
              volumeTaken: parseFloat(kegFillData.volumeTaken?.toString() || "0"),
            };
          }
        }

        // 2. Get batch composition with juice lots and costs
        // Note: batchCompositions links to basefruitPurchaseItems for base fruit path
        const compositionData = await db
          .select({
            compositionId: batchCompositions.id,
            sourceType: batchCompositions.sourceType,
            purchaseItemId: batchCompositions.purchaseItemId,
            juicePurchaseItemId: batchCompositions.juicePurchaseItemId,
            fractionOfBatch: batchCompositions.fractionOfBatch,
            juiceVolume: batchCompositions.juiceVolume,
            materialCost: batchCompositions.materialCost,
            varietyId: batchCompositions.varietyId,
            varietyName: baseFruitVarieties.name,
            vendorId: batchCompositions.vendorId,
            vendorName: vendors.name,
          })
          .from(batchCompositions)
          .leftJoin(baseFruitVarieties, eq(batchCompositions.varietyId, baseFruitVarieties.id))
          .leftJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .where(eq(batchCompositions.batchId, bottleRun.batchId));

        // 3. Get apple loads - trace through purchase items used in this batch
        const appleLoadsData: any[] = [];
        for (const comp of compositionData) {
          if (comp.sourceType === "base_fruit" && comp.purchaseItemId) {
            // Get the press run loads that used this purchase item
            const loads = await db
              .select({
                loadId: pressRunLoads.id,
                pressRunId: pressRunLoads.pressRunId,
                varietyName: baseFruitVarieties.name,
                appleWeightKg: pressRunLoads.appleWeightKg,
                juiceVolume: pressRunLoads.juiceVolume,
                // Get purchase item details
                purchaseItemQuantityKg: basefruitPurchaseItems.quantityKg,
                pricePerUnit: basefruitPurchaseItems.pricePerUnit,
                totalCost: basefruitPurchaseItems.totalCost,
                harvestDate: basefruitPurchaseItems.harvestDate,
                // Get vendor through purchase
                vendorId: basefruitPurchases.vendorId,
              })
              .from(pressRunLoads)
              .innerJoin(basefruitPurchaseItems, eq(pressRunLoads.purchaseItemId, basefruitPurchaseItems.id))
              .innerJoin(baseFruitVarieties, eq(pressRunLoads.fruitVarietyId, baseFruitVarieties.id))
              .innerJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
              .where(eq(pressRunLoads.purchaseItemId, comp.purchaseItemId));

            appleLoadsData.push(...loads);
          }
        }

        // 4. Get fermentation measurements
        const measurements = await db
          .select()
          .from(batchMeasurements)
          .where(eq(batchMeasurements.batchId, bottleRun.batchId))
          .orderBy(batchMeasurements.measurementDate);

        // 5. Get additives with cost tracking
        const additives = await db
          .select({
            id: batchAdditives.id,
            additiveType: batchAdditives.additiveType,
            additiveName: batchAdditives.additiveName,
            amount: batchAdditives.amount,
            unit: batchAdditives.unit,
            addedAt: batchAdditives.addedAt,
            addedBy: batchAdditives.addedBy,
            notes: batchAdditives.notes,
            costPerUnit: batchAdditives.costPerUnit,
            totalCost: batchAdditives.totalCost,
          })
          .from(batchAdditives)
          .where(eq(batchAdditives.batchId, bottleRun.batchId));

        // 6. Get transfers (where this batch is the source or destination)
        const transfers = await db
          .select()
          .from(batchTransfers)
          .where(
            or(
              eq(batchTransfers.sourceBatchId, bottleRun.batchId),
              eq(batchTransfers.destinationBatchId, bottleRun.batchId)
            )
          )
          .orderBy(batchTransfers.transferredAt);

        // 7. Get carbonation details
        const carbonation = await db
          .select()
          .from(batchCarbonationOperations)
          .where(eq(batchCarbonationOperations.batchId, bottleRun.batchId))
          .orderBy(desc(batchCarbonationOperations.completedAt))
          .limit(1);

        // 8. Get packaging materials with costs (including labels)
        const packagingMaterials = await db
          .select({
            materialId: bottleRunMaterials.id,
            materialType: bottleRunMaterials.materialType,
            quantityUsed: bottleRunMaterials.quantityUsed,
            itemId: packagingPurchaseItems.id,
            packageType: packagingPurchaseItems.packageType,
            materialTypePurchase: packagingPurchaseItems.materialType,
            size: packagingPurchaseItems.size,
            materialName: packagingPurchaseItems.size, // Alias for UI compatibility
            pricePerUnit: packagingPurchaseItems.pricePerUnit,
            totalCost: sql<number>`${bottleRunMaterials.quantityUsed} * ${packagingPurchaseItems.pricePerUnit}`,
          })
          .from(bottleRunMaterials)
          .leftJoin(packagingPurchaseItems, eq(bottleRunMaterials.packagingPurchaseItemId, packagingPurchaseItems.id))
          .where(eq(bottleRunMaterials.bottleRunId, bottleRunId));

        // 9. Get inventory items for this run
        const inventory = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.bottleRunId, bottleRunId));

        // 10. Calculate COGS breakdown
        // First, get the batch's total volume from compositions
        const batchTotalVolumeL = compositionData.reduce((total, comp) => {
          return total + (parseFloat(comp.juiceVolume?.toString() || "0"));
        }, 0);

        // Get volume taken for this bottle run
        const volumeTakenL = parseFloat(bottleRun.volumeTaken?.toString() || "0");

        // Calculate proration factor: what fraction of the batch was bottled in this run
        const prorationFactor = batchTotalVolumeL > 0 ? volumeTakenL / batchTotalVolumeL : 0;

        // Apple costs from composition - PRORATED by volume taken
        const totalBatchAppleCosts = compositionData.reduce((total, comp) => {
          return total + (parseFloat(comp.materialCost?.toString() || "0"));
        }, 0);
        const appleCosts = totalBatchAppleCosts * prorationFactor;

        // Additive costs from batch additives - PRORATED by volume taken
        const totalBatchAdditiveCosts = additives.reduce((total, additive) => {
          return total + (parseFloat(additive.totalCost?.toString() || "0"));
        }, 0);
        const additiveCosts = totalBatchAdditiveCosts * prorationFactor;

        // Packaging costs from materials
        const packagingCosts = packagingMaterials.reduce((total, mat) => {
          return total + (parseFloat(mat.totalCost?.toString() || "0"));
        }, 0);

        // Labor and overhead from bottle run
        const laborCostPerHour = parseFloat(bottleRun.laborCostPerHour?.toString() || "0");
        const bottlingLaborHours = parseFloat(bottleRun.laborHours?.toString() || "0");
        const pasteurizationLaborHours = parseFloat(bottleRun.pasteurizationLaborHours?.toString() || "0");
        const labelingLaborHours = parseFloat(bottleRun.labelingLaborHours?.toString() || "0");
        const totalLaborHours = bottlingLaborHours + pasteurizationLaborHours + labelingLaborHours;
        const laborCost = totalLaborHours * laborCostPerHour;
        const overheadCost = parseFloat(bottleRun.overheadCostAllocated?.toString() || "0");

        const totalCogs = appleCosts + additiveCosts + packagingCosts + laborCost + overheadCost;
        const costPerBottle = bottleRun.unitsProduced > 0 ? totalCogs / bottleRun.unitsProduced : 0;
        const costPerLiter = volumeTakenL > 0 ? totalCogs / volumeTakenL : 0;

        // 11. Calculate yields
        // Total apple weight input
        const totalAppleKg = appleLoadsData.reduce((total, load) => {
          return total + (parseFloat(load.appleWeightKg?.toString() || "0"));
        }, 0);

        // Total juice produced from compositions
        const totalJuiceL = compositionData.reduce((total, comp) => {
          return total + (parseFloat(comp.juiceVolume?.toString() || "0"));
        }, 0);

        const applesToJuiceYield = totalAppleKg > 0 ? (totalJuiceL / totalAppleKg) : 0;

        // Get batch start volume (from composition total)
        const batchStartVolume = totalJuiceL;

        const juiceToPackagedYield = batchStartVolume > 0 ? (volumeTakenL / batchStartVolume) * 100 : 0;
        const overallYield = totalAppleKg > 0 ? volumeTakenL / totalAppleKg : 0;

        // 12. Calculate margins if retail price is set
        // Use inventory retail price first, fallback to bottle_run retail price
        const inventoryRetailPrice = inventory[0] ? parseFloat(inventory[0].retailPrice?.toString() || "0") : 0;
        const bottleRunRetailPrice = parseFloat(bottleRun.retailPrice?.toString() || "0");
        const retailPrice = inventoryRetailPrice > 0 ? inventoryRetailPrice : bottleRunRetailPrice;
        const margins = retailPrice > 0 ? {
          retailPrice,
          costPerBottle,
          grossMargin: retailPrice - costPerBottle,
          grossMarginPercent: ((retailPrice - costPerBottle) / retailPrice) * 100,
          markup: retailPrice - costPerBottle,
          markupPercent: costPerBottle > 0 ? ((retailPrice - costPerBottle) / costPerBottle) * 100 : 0,
        } : null;

        // 13. Build enhanced composition with apple loads
        const enhancedComposition = compositionData.map(comp => {
          // Find apple loads for this composition
          const loadsForComp = appleLoadsData.filter(load => load.purchaseItemId === comp.purchaseItemId);
          return {
            ...comp,
            appleLoads: loadsForComp,
            fractionPercent: comp.fractionOfBatch ? parseFloat(comp.fractionOfBatch.toString()) * 100 : 0,
          };
        });

        return {
          bottleRun: {
            ...bottleRun,
            volumeTaken: parseFloat(bottleRun.volumeTaken?.toString() || "0"),
            loss: parseFloat(bottleRun.loss?.toString() || "0"),
          },
          // If this bottle was sourced from a keg, include the keg fill details
          sourceKegFill,
          composition: enhancedComposition,
          fermentation: {
            measurements,
            additives,
            transfers,
            startDate: measurements[0]?.measurementDate || null,
            endDate: measurements[measurements.length - 1]?.measurementDate || null,
            durationDays: measurements.length > 1 ?
              Math.floor((new Date(measurements[measurements.length - 1].measurementDate).getTime() -
                         new Date(measurements[0].measurementDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          },
          carbonation: carbonation[0] || null,
          packagingMaterials,
          cogs: {
            appleCosts: {
              totalCost: appleCosts,
              costByVariety: (() => {
                // Calculate total volume for percentage calculation
                const totalVolumeL = compositionData.reduce((sum, c) =>
                  sum + (c.juiceVolume ? parseFloat(c.juiceVolume.toString()) : 0), 0
                );

                // Filter for only apple/base fruit varieties and calculate percentages
                // Apply proration factor to individual variety costs
                return compositionData
                  .filter(c => c.sourceType === 'base_fruit')
                  .map(c => {
                    const volumeL = c.juiceVolume ? parseFloat(c.juiceVolume.toString()) : 0;
                    const percentage = totalVolumeL > 0 ? (volumeL / totalVolumeL) * 100 : 0;
                    // Prorate the cost based on volume taken from batch
                    const rawCost = parseFloat(c.materialCost?.toString() || "0");
                    const proratedCost = rawCost * prorationFactor;

                    return {
                      variety: c.varietyName || "Unknown",
                      cost: proratedCost,
                      percentage,
                    };
                  });
              })(),
            },
            additiveCosts: {
              totalCost: additiveCosts,
              items: additives.map(a => {
                const rawCost = parseFloat(a.totalCost?.toString() || "0");
                const proratedCost = rawCost * prorationFactor;
                return {
                  name: a.additiveName || "Unknown",
                  type: a.additiveType || "",
                  amount: parseFloat(a.amount?.toString() || "0"),
                  unit: a.unit,
                  costPerUnit: parseFloat(a.costPerUnit?.toString() || "0"),
                  totalCost: proratedCost,
                };
              }),
            },
            packagingCosts: {
              totalCost: packagingCosts,
              costByType: packagingMaterials.map(m => ({
                type: m.materialType,
                packageType: m.packageType || "",
                size: m.size || "",
                quantityUsed: m.quantityUsed,
                pricePerUnit: parseFloat(m.pricePerUnit?.toString() || "0"),
                cost: parseFloat(m.totalCost?.toString() || "0"),
              })),
            },
            laborCost,
            overheadCost,
            totalCogs,
            costPerBottle,
            costPerLiter,
          },
          yields: {
            applesToJuice: {
              inputKg: totalAppleKg,
              outputL: totalJuiceL,
              yieldPercent: applesToJuiceYield,
              lossKg: 0, // Could be calculated if we track press waste
            },
            juiceToPackaged: {
              inputL: batchStartVolume,
              outputL: volumeTakenL,
              yieldPercent: juiceToPackagedYield,
              lossL: batchStartVolume - volumeTakenL,
            },
            overallYield: {
              inputKg: totalAppleKg,
              outputBottles: bottleRun.unitsProduced,
              kgPerBottle: bottleRun.unitsProduced > 0 ? totalAppleKg / bottleRun.unitsProduced : 0,
            },
          },
          inventory: {
            totalUnitsProduced: bottleRun.unitsProduced,
            // Use unitsProduced as default if currentQuantity was never set (null)
            // Only use currentQuantity if it's explicitly set (including 0)
            currentRemaining: inventory[0]?.currentQuantity !== null && inventory[0]?.currentQuantity !== undefined
              ? inventory[0].currentQuantity
              : bottleRun.unitsProduced,
            // Only show depleted count if currentQuantity is explicitly tracked
            unitsDepleted: inventory[0]?.currentQuantity !== null && inventory[0]?.currentQuantity !== undefined
              ? bottleRun.unitsProduced - inventory[0].currentQuantity
              : 0,
            // Calculate values based on actual remaining inventory
            inventoryValueRemaining: (() => {
              const remaining = inventory[0]?.currentQuantity !== null && inventory[0]?.currentQuantity !== undefined
                ? inventory[0].currentQuantity
                : bottleRun.unitsProduced;
              return remaining * costPerBottle;
            })(),
            revenueIfSold: (() => {
              if (retailPrice <= 0) return 0;
              const remaining = inventory[0]?.currentQuantity !== null && inventory[0]?.currentQuantity !== undefined
                ? inventory[0].currentQuantity
                : bottleRun.unitsProduced;
              return remaining * retailPrice;
            })(),
            potentialProfit: (() => {
              if (retailPrice <= 0) return 0;
              const remaining = inventory[0]?.currentQuantity !== null && inventory[0]?.currentQuantity !== undefined
                ? inventory[0].currentQuantity
                : bottleRun.unitsProduced;
              return remaining * (retailPrice - costPerBottle);
            })(),
          },
          margins,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching enhanced bottle details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch enhanced bottle details",
        });
      }
    }),

  /**
   * Keg management operations (asset management and fill operations)
   * Nested under packaging for unified packaging system
   */
  kegs: kegsRouter,
});

export type PackagingRouter = typeof packagingRouter;
export type BottlesRouter = typeof packagingRouter; // @deprecated - use PackagingRouter

// Also export for backward compatibility during migration
export const bottlesRouter = packagingRouter;
