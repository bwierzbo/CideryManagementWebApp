import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { MIN_WORKING_VOLUME_L } from "lib";
import {
  db,
  kegs,
  kegFills,
  kegFillMaterials,
  vessels,
  batches,
  users,
  packagingPurchaseItems,
  batchCompositions,
  baseFruitVarieties,
  juicePurchaseItems,
  juiceVarieties,
  vendors,
  batchMeasurements,
  batchAdditives,
  additiveVarieties,
  batchTransfers,
  batchCarbonationOperations,
  salesChannels,
} from "db";
import { eq, and, desc, isNull, sql, like, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Input validation schemas
const kegMaterialSchema = z.object({
  packagingPurchaseItemId: z.string().uuid(),
  quantityUsed: z.number().int().positive(),
  materialType: z.string(),
});

const createKegSchema = z.object({
  kegNumber: z.string().min(1, "Keg number is required"),
  kegType: z.enum([
    "cornelius_5L",
    "cornelius_9L",
    "sanke_20L",
    "sanke_30L",
    "sanke_50L",
    "other",
  ]),
  capacityML: z.number().positive("Capacity must be positive"),
  capacityUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]).default("L"),
  purchaseDate: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .optional(),
  purchaseCost: z.number().positive().optional(),
  currentLocation: z.string().default("cellar"),
  condition: z
    .enum(["excellent", "good", "fair", "needs_repair", "retired"])
    .optional(),
  notes: z.string().optional(),
});

const updateKegSchema = z.object({
  kegId: z.string().uuid(),
  kegNumber: z.string().min(1).optional(),
  kegType: z
    .enum([
      "cornelius_5L",
      "cornelius_9L",
      "sanke_20L",
      "sanke_30L",
      "sanke_50L",
      "other",
    ])
    .optional(),
  capacityML: z.number().positive().optional(),
  status: z
    .enum([
      "available",
      "filled",
      "distributed",
      "cleaning",
      "maintenance",
      "retired",
    ])
    .optional(),
  condition: z
    .enum(["excellent", "good", "fair", "needs_repair", "retired"])
    .optional(),
  currentLocation: z.string().optional(),
  purchaseDate: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .optional(),
  purchaseCost: z.number().positive().optional(),
  notes: z.string().optional(),
});

const kegVolumeSchema = z.object({
  kegId: z.string().uuid(),
  volumeTaken: z.number().positive("Volume must be positive"),
});

const fillKegsSchema = z.object({
  kegVolumes: z.array(kegVolumeSchema).min(1, "Select at least one keg"),
  batchId: z.string().uuid(),
  vesselId: z.string().uuid(),
  filledAt: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .default(() => new Date()),
  volumeTakenUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]).default("L"),
  loss: z.number().min(0).optional(),
  lossUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]).default("L"),
  carbonationMethod: z.enum(["natural", "forced", "none"]).optional(),
  sourceCarbonationOperationId: z.string().uuid().optional(),
  productionNotes: z.string().optional(),
  materials: z.array(kegMaterialSchema).optional(),
});

const distributeKegFillSchema = z.object({
  kegFillId: z.string().uuid(),
  distributedAt: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .default(() => new Date()),
  distributionLocation: z.string().min(1, "Location is required"),
  salesChannelId: z.string().uuid().optional(),
});

const returnKegFillSchema = z.object({
  kegFillId: z.string().uuid(),
  returnedAt: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .default(() => new Date()),
});

const voidKegFillSchema = z.object({
  kegFillId: z.string().uuid(),
  voidReason: z.string().min(1, "Void reason is required"),
});

// Bulk operation schemas
const bulkDistributeKegFillsSchema = z.object({
  kegFillIds: z.array(z.string().uuid()).min(1, "Select at least one keg"),
  distributedAt: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .default(() => new Date()),
  distributionLocation: z.string().min(1, "Location is required"),
  salesChannelId: z.string().uuid().optional(),
});

const bulkReturnKegFillsSchema = z.object({
  kegFillIds: z.array(z.string().uuid()).min(1, "Select at least one keg"),
  returnedAt: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .default(() => new Date()),
});

const listKegsSchema = z.object({
  status: z
    .enum([
      "all",
      "available",
      "filled",
      "distributed",
      "cleaning",
      "maintenance",
      "retired",
    ])
    .default("all"),
  kegType: z
    .enum([
      "all",
      "cornelius_5L",
      "cornelius_9L",
      "sanke_20L",
      "sanke_30L",
      "sanke_50L",
      "other",
    ])
    .default("all"),
  location: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().max(500).default(100),
  offset: z.number().default(0),
});

export const kegsRouter = router({
  /**
   * List all kegs with filters
   */
  listKegs: createRbacProcedure("list", "package")
    .input(listKegsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { status, kegType, location, search, limit, offset } = input;

        // Build filter conditions
        const conditions = [isNull(kegs.deletedAt)];

        if (status !== "all") {
          conditions.push(eq(kegs.status, status));
        }

        if (kegType !== "all") {
          conditions.push(eq(kegs.kegType, kegType));
        }

        if (location) {
          conditions.push(like(kegs.currentLocation, `%${location}%`));
        }

        if (search) {
          const searchCondition = or(
            like(kegs.kegNumber, `%${search}%`),
            like(kegs.notes, `%${search}%`),
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

        // Get kegs with latest fill information
        const kegsList = await db
          .select({
            id: kegs.id,
            kegNumber: kegs.kegNumber,
            kegType: kegs.kegType,
            capacityML: kegs.capacityML,
            capacityUnit: kegs.capacityUnit,
            purchaseDate: kegs.purchaseDate,
            purchaseCost: kegs.purchaseCost,
            status: kegs.status,
            condition: kegs.condition,
            currentLocation: kegs.currentLocation,
            notes: kegs.notes,
            createdAt: kegs.createdAt,
            updatedAt: kegs.updatedAt,
            // Get latest fill info via subquery (exclude voided and returned fills)
            latestFillId: sql<string>`(
              SELECT keg_fills.id FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status NOT IN ('voided', 'returned')
                AND keg_fills.deleted_at IS NULL
              ORDER BY keg_fills.filled_at DESC
              LIMIT 1
            )`,
            latestFillBatchName: sql<string>`(
              SELECT COALESCE(b.custom_name, b.name) FROM keg_fills kf
              LEFT JOIN batches b ON kf.batch_id = b.id
              WHERE kf.keg_id = kegs.id
                AND kf.status NOT IN ('voided', 'returned')
                AND kf.deleted_at IS NULL
              ORDER BY kf.filled_at DESC
              LIMIT 1
            )`,
            latestFillDate: sql<Date>`(
              SELECT keg_fills.filled_at FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status NOT IN ('voided', 'returned')
                AND keg_fills.deleted_at IS NULL
              ORDER BY keg_fills.filled_at DESC
              LIMIT 1
            )`,
            latestFillRemainingVolume: sql<string>`(
              SELECT keg_fills.remaining_volume FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status NOT IN ('voided', 'returned')
                AND keg_fills.deleted_at IS NULL
              ORDER BY keg_fills.filled_at DESC
              LIMIT 1
            )`,
            latestFillVolumeTaken: sql<string>`(
              SELECT keg_fills.volume_taken FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status NOT IN ('voided', 'returned')
                AND keg_fills.deleted_at IS NULL
              ORDER BY keg_fills.filled_at DESC
              LIMIT 1
            )`,
            latestFillVolumeUnit: sql<string>`(
              SELECT keg_fills.volume_taken_unit FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status NOT IN ('voided', 'returned')
                AND keg_fills.deleted_at IS NULL
              ORDER BY keg_fills.filled_at DESC
              LIMIT 1
            )`,
          })
          .from(kegs)
          .where(and(...conditions))
          .orderBy(desc(kegs.createdAt))
          .limit(limit)
          .offset(offset);

        // Get total count
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(kegs)
          .where(and(...conditions));

        const totalCount = countResult[0]?.count || 0;

        return {
          kegs: kegsList,
          pagination: {
            total: totalCount,
            offset,
            limit,
            hasMore: totalCount > offset + limit,
          },
        };
      } catch (error) {
        console.error("Error listing kegs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch kegs",
        });
      }
    }),

  /**
   * Get detailed keg information with fill history
   */
  getKegDetails: createRbacProcedure("list", "package")
    .input(z.object({ kegId: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        // Get keg info
        const keg = await db
          .select()
          .from(kegs)
          .where(and(eq(kegs.id, input.kegId), isNull(kegs.deletedAt)))
          .limit(1);

        if (!keg.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg not found",
          });
        }

        // Get fill history
        const fills = await db
          .select({
            id: kegFills.id,
            batchId: kegFills.batchId,
            batchName: batches.name,
            batchCustomName: batches.customName,
            vesselId: kegFills.vesselId,
            vesselName: vessels.name,
            filledAt: kegFills.filledAt,
            volumeTaken: kegFills.volumeTaken,
            volumeTakenUnit: kegFills.volumeTakenUnit,
            abvAtPackaging: kegFills.abvAtPackaging,
            carbonationLevel: kegFills.carbonationLevel,
            carbonationMethod: kegFills.carbonationMethod,
            status: kegFills.status,
            distributedAt: kegFills.distributedAt,
            distributionLocation: kegFills.distributionLocation,
            returnedAt: kegFills.returnedAt,
            productionNotes: kegFills.productionNotes,
            createdBy: kegFills.createdBy,
            createdByName: users.name,
          })
          .from(kegFills)
          .leftJoin(batches, eq(kegFills.batchId, batches.id))
          .leftJoin(vessels, eq(kegFills.vesselId, vessels.id))
          .leftJoin(users, eq(kegFills.createdBy, users.id))
          .where(
            and(
              eq(kegFills.kegId, input.kegId),
              isNull(kegFills.deletedAt)
            )
          )
          .orderBy(desc(kegFills.filledAt));

        // Get comprehensive batch data for the latest fill (only if fill is active)
        let latestFillBatch = null;
        const latestFill = fills.length > 0 ? fills[0] : null;
        // Only show current batch info if the latest fill is active (not returned/voided)
        if (latestFill && (latestFill.status === 'filled' || latestFill.status === 'distributed')) {
          const batchId = latestFill.batchId;

          // Get batch composition
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
            .where(eq(batchCompositions.batchId, batchId));

          // Get batch measurements
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
            .where(eq(batchMeasurements.batchId, batchId))
            .orderBy(desc(batchMeasurements.measurementDate))
            .limit(20);

          // Get batch additives
          const additives = await db
            .select({
              additiveName: batchAdditives.additiveName,
              amount: batchAdditives.amount,
              unit: batchAdditives.unit,
              addedAt: batchAdditives.addedAt,
            })
            .from(batchAdditives)
            .where(eq(batchAdditives.batchId, batchId))
            .orderBy(desc(batchAdditives.addedAt))
            .limit(5);

          // Get additive varieties for label impact and allergen info
          const additiveNames = additives.map((a) => a.additiveName);
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
                  isNull(additiveVarieties.deletedAt),
                ),
              );

            for (const variety of varietyData) {
              additiveVarietyMap.set(variety.name, variety);
            }
          }

          // Enrich additives with variety info
          const enrichedAdditives = additives.map((additive) => {
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

          // Get batch transfers
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
            .where(eq(batchTransfers.sourceBatchId, batchId))
            .orderBy(desc(batchTransfers.transferredAt))
            .limit(5);

          // Get carbonation data if exists
          const carbonation = await db
            .select({
              finalCo2Volumes: batchCarbonationOperations.finalCo2Volumes,
              targetCo2Volumes: batchCarbonationOperations.targetCo2Volumes,
            })
            .from(batchCarbonationOperations)
            .where(eq(batchCarbonationOperations.batchId, batchId))
            .orderBy(desc(batchCarbonationOperations.createdAt))
            .limit(1);

          latestFillBatch = {
            batchId,
            batchName: latestFill.batchName,
            batchCustomName: latestFill.batchCustomName,
            composition: compositionData.map((c) => ({
              varietyName: c.varietyName,
              vendorName: c.vendorName,
              volumeL: c.volumeL ? parseFloat(c.volumeL.toString()) : 0,
              percentageOfBatch: c.percentageOfBatch
                ? parseFloat(c.percentageOfBatch.toString()) * 100
                : 0,
              ph: c.ph ? parseFloat(c.ph.toString()) : null,
              specificGravity: c.specificGravity
                ? parseFloat(c.specificGravity.toString())
                : null,
            })),
            history: {
              measurements: measurements.map((m) => ({
                measurementDate: m.measurementDate,
                specificGravity: m.specificGravity
                  ? parseFloat(m.specificGravity.toString())
                  : null,
                abv: m.abv ? parseFloat(m.abv.toString()) : null,
                ph: m.ph ? parseFloat(m.ph.toString()) : null,
                totalAcidity: m.totalAcidity
                  ? parseFloat(m.totalAcidity.toString())
                  : null,
                temperature: m.temperature
                  ? parseFloat(m.temperature.toString())
                  : null,
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
            carbonationCo2Volumes:
              carbonation.length > 0
                ? carbonation[0].finalCo2Volumes
                  ? parseFloat(carbonation[0].finalCo2Volumes.toString())
                  : carbonation[0].targetCo2Volumes
                    ? parseFloat(carbonation[0].targetCo2Volumes.toString())
                    : null
                : null,
          };
        }

        return {
          keg: keg[0],
          fills,
          latestFillBatch,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching keg details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch keg details",
        });
      }
    }),

  /**
   * Get available kegs for filling
   */
  getAvailableKegs: createRbacProcedure("list", "package").query(
    async () => {
      try {
        const availableKegs = await db
          .select({
            id: kegs.id,
            kegNumber: kegs.kegNumber,
            kegType: kegs.kegType,
            capacityML: kegs.capacityML,
            capacityUnit: kegs.capacityUnit,
            condition: kegs.condition,
            currentLocation: kegs.currentLocation,
          })
          .from(kegs)
          .where(
            and(
              eq(kegs.status, "available"),
              isNull(kegs.deletedAt),
            ),
          )
          .orderBy(kegs.kegNumber);

        return availableKegs;
      } catch (error) {
        console.error("Error fetching available kegs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch available kegs",
        });
      }
    },
  ),

  /**
   * Create a new keg asset
   */
  createKeg: createRbacProcedure("create", "package")
    .input(createKegSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Check if keg number already exists
        const existing = await db
          .select({ id: kegs.id })
          .from(kegs)
          .where(
            and(eq(kegs.kegNumber, input.kegNumber), isNull(kegs.deletedAt)),
          )
          .limit(1);

        if (existing.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A keg with this number already exists",
          });
        }

        const [newKeg] = await db
          .insert(kegs)
          .values({
            kegNumber: input.kegNumber,
            kegType: input.kegType,
            capacityML: input.capacityML,
            capacityUnit: input.capacityUnit,
            purchaseDate: input.purchaseDate
              ? input.purchaseDate instanceof Date
                ? input.purchaseDate.toISOString().split("T")[0]
                : input.purchaseDate
              : null,
            purchaseCost: input.purchaseCost?.toString(),
            currentLocation: input.currentLocation,
            condition: input.condition,
            notes: input.notes,
            status: "available",
          })
          .returning();

        return newKeg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating keg:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create keg",
        });
      }
    }),

  /**
   * Update keg details
   */
  updateKeg: createRbacProcedure("update", "package")
    .input(updateKegSchema)
    .mutation(async ({ input }) => {
      try {
        const { kegId, ...updates } = input;

        // Check if keg exists
        const existing = await db
          .select({ id: kegs.id })
          .from(kegs)
          .where(and(eq(kegs.id, kegId), isNull(kegs.deletedAt)))
          .limit(1);

        if (!existing.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg not found",
          });
        }

        // If updating keg number, check for conflicts
        if (updates.kegNumber) {
          const conflict = await db
            .select({ id: kegs.id })
            .from(kegs)
            .where(
              and(
                eq(kegs.kegNumber, updates.kegNumber),
                sql`${kegs.id} != ${kegId}`,
                isNull(kegs.deletedAt),
              ),
            )
            .limit(1);

          if (conflict.length > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A keg with this number already exists",
            });
          }
        }

        // Process updates for database
        const processedUpdates: any = { ...updates };

        // Convert purchaseDate to ISO string if provided
        if (processedUpdates.purchaseDate) {
          processedUpdates.purchaseDate = processedUpdates.purchaseDate instanceof Date
            ? processedUpdates.purchaseDate.toISOString().split("T")[0]
            : processedUpdates.purchaseDate;
        }

        // Convert purchaseCost to string if provided
        if (processedUpdates.purchaseCost !== undefined) {
          processedUpdates.purchaseCost = processedUpdates.purchaseCost.toString();
        }

        const [updatedKeg] = await db
          .update(kegs)
          .set({
            ...processedUpdates,
            updatedAt: new Date(),
          })
          .where(eq(kegs.id, kegId))
          .returning();

        return updatedKeg;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating keg:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update keg",
        });
      }
    }),

  /**
   * Delete (retire) a keg
   */
  deleteKeg: createRbacProcedure("delete", "package")
    .input(z.object({ kegId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        // Check if keg has active fills
        const activeFills = await db
          .select({ id: kegFills.id })
          .from(kegFills)
          .where(
            and(
              eq(kegFills.kegId, input.kegId),
              inArray(kegFills.status, ["filled", "distributed"]),
              isNull(kegFills.deletedAt),
            ),
          )
          .limit(1);

        if (activeFills.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot delete keg with active fills. Return or void fills first.",
          });
        }

        // Soft delete
        await db
          .update(kegs)
          .set({
            deletedAt: new Date(),
            status: "retired",
          })
          .where(eq(kegs.id, input.kegId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting keg:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete keg",
        });
      }
    }),

  /**
   * Fill kegs from vessel
   */
  fillKegs: createRbacProcedure("create", "package")
    .input(fillKegsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;

        // Extract keg IDs from volumes array
        const kegIds = input.kegVolumes.map(kv => kv.kegId);

        // Verify batch exists
        const [batch] = await db
          .select({ id: batches.id })
          .from(batches)
          .where(eq(batches.id, input.batchId))
          .limit(1);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // TODO: Calculate ABV from batch measurements if needed

        // Verify all kegs are available
        const kegsToFill = await db
          .select({ id: kegs.id, status: kegs.status, kegNumber: kegs.kegNumber })
          .from(kegs)
          .where(
            and(inArray(kegs.id, kegIds), isNull(kegs.deletedAt)),
          );

        if (kegsToFill.length !== kegIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more kegs not found",
          });
        }

        const unavailableKegs = kegsToFill.filter(
          (k) => k.status !== "available",
        );
        if (unavailableKegs.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Kegs not available: ${unavailableKegs.map((k) => k.kegNumber).join(", ")}`,
          });
        }

        // Calculate total volume being packaged
        const totalVolumeTaken = input.kegVolumes.reduce(
          (sum, kv) => sum + kv.volumeTaken,
          0
        );
        const totalLoss = input.loss || 0;
        const totalDeduction = totalVolumeTaken + totalLoss;

        // Update batch volume
        const [currentBatch] = await db
          .select({
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
          })
          .from(batches)
          .where(eq(batches.id, input.batchId))
          .limit(1);

        if (currentBatch?.currentVolume) {
          const newVolume = parseFloat(currentBatch.currentVolume.toString()) - totalDeduction;

          // Check if batch is exhausted (below minimum working volume threshold)
          if (newVolume <= MIN_WORKING_VOLUME_L) {
            // Complete the batch - no usable volume remaining
            await db
              .update(batches)
              .set({
                currentVolume: "0",
                currentVolumeUnit: currentBatch.currentVolumeUnit || "L",
                status: "completed",
                vesselId: null,
                endDate: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));

            // Set vessel to cleaning status
            await db
              .update(vessels)
              .set({
                status: "cleaning" as any,
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.vesselId));
          } else {
            // Partial kegging - just update volume
            await db
              .update(batches)
              .set({
                currentVolume: newVolume.toString(),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId));
          }
        }

        // Create keg fills and update keg status in a transaction
        const fillRecords = [];

        for (const kegVolume of input.kegVolumes) {
          // Create fill record
          const [fill] = await db
            .insert(kegFills)
            .values({
              kegId: kegVolume.kegId,
              batchId: input.batchId,
              vesselId: input.vesselId,
              filledAt: input.filledAt,
              volumeTaken: kegVolume.volumeTaken.toString(),
              volumeTakenUnit: input.volumeTakenUnit,
              remainingVolume: kegVolume.volumeTaken.toString(), // Initialize with full volume
              loss: input.loss?.toString(),
              lossUnit: input.lossUnit,
              abvAtPackaging: null, // TODO: Calculate from batch measurements
              carbonationMethod: input.carbonationMethod,
              sourceCarbonationOperationId: input.sourceCarbonationOperationId,
              productionNotes: input.productionNotes,
              status: "filled",
              createdBy: userId,
            })
            .returning();

          fillRecords.push(fill);

          // Update keg status
          await db
            .update(kegs)
            .set({
              status: "filled",
              updatedAt: new Date(),
            })
            .where(eq(kegs.id, kegVolume.kegId));

          // Add materials if provided and update inventory
          if (input.materials && input.materials.length > 0) {
            await db.insert(kegFillMaterials).values(
              input.materials.map((m) => ({
                kegFillId: fill.id,
                packagingPurchaseItemId: m.packagingPurchaseItemId,
                quantityUsed: m.quantityUsed,
                materialType: m.materialType,
                createdBy: userId,
              })),
            );

            // Increment quantityUsed on packaging inventory for each material
            for (const material of input.materials) {
              await db.execute(sql`
                UPDATE packaging_purchase_items
                SET quantity_used = quantity_used + ${material.quantityUsed},
                    updated_at = NOW()
                WHERE id = ${material.packagingPurchaseItemId}
              `);
            }
          }
        }

        return {
          success: true,
          fills: fillRecords,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error filling kegs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fill kegs",
        });
      }
    }),

  /**
   * Mark keg fill as ready to distribute (QA complete)
   */
  markKegReady: createRbacProcedure("update", "package")
    .input(z.object({
      kegFillId: z.string().uuid(),
      readyAt: z.date().or(z.string().transform((val) => new Date(val))).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const readyAt = input.readyAt || new Date();

        // Verify fill exists and is filled
        const [fill] = await db
          .select({ status: kegFills.status, kegId: kegFills.kegId })
          .from(kegFills)
          .where(
            and(
              eq(kegFills.id, input.kegFillId),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(1);

        if (!fill) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg fill not found",
          });
        }

        if (fill.status !== "filled") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot mark as ready: keg is currently '${fill.status}', must be 'filled'`,
          });
        }

        // Update fill status
        await db
          .update(kegFills)
          .set({
            status: "ready",
            readyAt: readyAt,
            readyBy: ctx.user.id,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(kegFills.id, input.kegFillId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error marking keg as ready:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark keg as ready",
        });
      }
    }),

  /**
   * Mark keg fill as distributed
   */
  distributeKegFill: createRbacProcedure("update", "package")
    .input(distributeKegFillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify fill exists and is filled or ready
        const [fill] = await db
          .select({ status: kegFills.status, kegId: kegFills.kegId })
          .from(kegFills)
          .where(
            and(
              eq(kegFills.id, input.kegFillId),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(1);

        if (!fill) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg fill not found",
          });
        }

        // Allow distribution from 'filled' or 'ready' status
        if (fill.status !== "filled" && fill.status !== "ready") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot distribute: keg is currently '${fill.status}', must be 'filled' or 'ready'`,
          });
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          status: "distributed",
          distributedAt: input.distributedAt,
          distributionLocation: input.distributionLocation,
          salesChannelId: input.salesChannelId,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        };

        // If skipping 'ready' status, auto-set readyAt
        if (fill.status === "filled") {
          updateData.readyAt = input.distributedAt;
          updateData.readyBy = ctx.user.id;
        }

        // Update fill status
        await db
          .update(kegFills)
          .set(updateData)
          .where(eq(kegFills.id, input.kegFillId));

        // Update keg status
        await db
          .update(kegs)
          .set({
            status: "distributed",
            currentLocation: input.distributionLocation,
            updatedAt: new Date(),
          })
          .where(eq(kegs.id, fill.kegId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error distributing keg:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to distribute keg",
        });
      }
    }),

  /**
   * Mark keg fill as returned
   */
  returnKegFill: createRbacProcedure("update", "package")
    .input(returnKegFillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify fill exists and is distributed
        const [fill] = await db
          .select({ status: kegFills.status, kegId: kegFills.kegId })
          .from(kegFills)
          .where(
            and(
              eq(kegFills.id, input.kegFillId),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(1);

        if (!fill) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg fill not found",
          });
        }

        if (fill.status !== "distributed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only distributed kegs can be returned",
          });
        }

        // Update fill status - mark as returned and empty
        await db
          .update(kegFills)
          .set({
            status: "returned",
            returnedAt: input.returnedAt,
            remainingVolume: "0", // Keg is empty when returned
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(kegFills.id, input.kegFillId));

        // Update keg status to cleaning (needs to be cleaned before next use)
        await db
          .update(kegs)
          .set({
            status: "cleaning",
            currentLocation: "cellar",
            updatedAt: new Date(),
          })
          .where(eq(kegs.id, fill.kegId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error returning keg:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to return keg",
        });
      }
    }),

  /**
   * Bulk distribute multiple keg fills
   * All kegs get the same distribution date, location, and optional sales channel
   */
  bulkDistributeKegFills: createRbacProcedure("update", "package")
    .input(bulkDistributeKegFillsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { kegFillIds, distributedAt, distributionLocation, salesChannelId } = input;

        // Get all keg fills with their current status
        const fills = await db
          .select({
            id: kegFills.id,
            status: kegFills.status,
            kegId: kegFills.kegId,
            kegNumber: kegs.kegNumber,
          })
          .from(kegFills)
          .innerJoin(kegs, eq(kegFills.kegId, kegs.id))
          .where(
            and(
              inArray(kegFills.id, kegFillIds),
              isNull(kegFills.deletedAt)
            )
          );

        // Separate valid (filled or ready) from invalid kegs
        const validFills = fills.filter((f) => f.status === "filled" || f.status === "ready");
        const invalidFills = fills.filter((f) => f.status !== "filled" && f.status !== "ready");

        if (validFills.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No kegs are in 'filled' or 'ready' status and eligible for distribution. Current statuses: ${fills.map(f => `${f.kegNumber}: ${f.status}`).join(", ")}`,
          });
        }

        // Update all valid keg fills in a transaction
        await db.transaction(async (tx) => {
          // Update keg fills - separate those coming from 'filled' to set readyAt
          const filledFills = validFills.filter((f) => f.status === "filled");
          const readyFills = validFills.filter((f) => f.status === "ready");

          // Update fills coming from 'filled' status (need to set readyAt)
          if (filledFills.length > 0) {
            await tx
              .update(kegFills)
              .set({
                status: "distributed",
                readyAt: distributedAt,
                readyBy: ctx.user.id,
                distributedAt,
                distributionLocation,
                salesChannelId,
                updatedBy: ctx.user.id,
                updatedAt: new Date(),
              })
              .where(inArray(kegFills.id, filledFills.map((f) => f.id)));
          }

          // Update fills coming from 'ready' status (readyAt already set)
          if (readyFills.length > 0) {
            await tx
              .update(kegFills)
              .set({
                status: "distributed",
                distributedAt,
                distributionLocation,
                salesChannelId,
                updatedBy: ctx.user.id,
                updatedAt: new Date(),
              })
              .where(inArray(kegFills.id, readyFills.map((f) => f.id)));
          }

          // Update kegs
          await tx
            .update(kegs)
            .set({
              status: "distributed",
              currentLocation: distributionLocation,
              updatedAt: new Date(),
            })
            .where(inArray(kegs.id, validFills.map((f) => f.kegId)));
        });

        return {
          success: true,
          distributed: validFills.length,
          skipped: invalidFills.map((f) => ({
            kegNumber: f.kegNumber,
            reason: `Cannot distribute: status is '${f.status}'`,
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error bulk distributing kegs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to distribute kegs",
        });
      }
    }),

  /**
   * Bulk return multiple keg fills
   * All kegs get the same return date
   */
  bulkReturnKegFills: createRbacProcedure("update", "package")
    .input(bulkReturnKegFillsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { kegFillIds, returnedAt } = input;

        // Get all keg fills with their current status
        const fills = await db
          .select({
            id: kegFills.id,
            status: kegFills.status,
            kegId: kegFills.kegId,
            kegNumber: kegs.kegNumber,
          })
          .from(kegFills)
          .innerJoin(kegs, eq(kegFills.kegId, kegs.id))
          .where(
            and(
              inArray(kegFills.id, kegFillIds),
              isNull(kegFills.deletedAt)
            )
          );

        // Separate valid (distributed) from invalid kegs
        const validFills = fills.filter((f) => f.status === "distributed");
        const invalidFills = fills.filter((f) => f.status !== "distributed");

        if (validFills.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No kegs are in 'distributed' status and eligible for return",
          });
        }

        // Update all valid keg fills in a transaction
        await db.transaction(async (tx) => {
          // Update keg fills - mark as returned and empty
          await tx
            .update(kegFills)
            .set({
              status: "returned",
              returnedAt,
              remainingVolume: "0",
              updatedBy: ctx.user.id,
              updatedAt: new Date(),
            })
            .where(inArray(kegFills.id, validFills.map((f) => f.id)));

          // Update kegs to cleaning status
          await tx
            .update(kegs)
            .set({
              status: "cleaning",
              currentLocation: "cellar",
              updatedAt: new Date(),
            })
            .where(inArray(kegs.id, validFills.map((f) => f.kegId)));
        });

        return {
          success: true,
          returned: validFills.length,
          skipped: invalidFills.map((f) => ({
            kegNumber: f.kegNumber,
            reason: `Cannot return: status is '${f.status}'`,
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error bulk returning kegs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to return kegs",
        });
      }
    }),

  /**
   * Void a keg fill
   */
  voidKegFill: createRbacProcedure("update", "package")
    .input(voidKegFillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get fill info
        const [fill] = await db
          .select({ kegId: kegFills.kegId })
          .from(kegFills)
          .where(
            and(
              eq(kegFills.id, input.kegFillId),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(1);

        if (!fill) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg fill not found",
          });
        }

        // Void fill
        await db
          .update(kegFills)
          .set({
            status: "voided",
            voidReason: input.voidReason,
            voidedAt: new Date(),
            voidedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(kegFills.id, input.kegFillId));

        // Update keg to available
        await db
          .update(kegs)
          .set({
            status: "available",
            updatedAt: new Date(),
          })
          .where(eq(kegs.id, fill.kegId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error voiding keg fill:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to void keg fill",
        });
      }
    }),

  /**
   * Delete a keg fill (hard delete)
   */
  deleteKegFill: createRbacProcedure("delete", "package")
    .input(z.object({ kegFillId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        // Get fill info including batch details
        const [fill] = await db
          .select({
            kegId: kegFills.kegId,
            batchId: kegFills.batchId,
            volumeTaken: kegFills.volumeTaken,
            loss: kegFills.loss,
          })
          .from(kegFills)
          .where(
            and(
              eq(kegFills.id, input.kegFillId),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(1);

        if (!fill) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg fill not found",
          });
        }

        // Delete associated materials first
        await db
          .delete(kegFillMaterials)
          .where(eq(kegFillMaterials.kegFillId, input.kegFillId));

        // Delete the keg fill
        await db
          .delete(kegFills)
          .where(eq(kegFills.id, input.kegFillId));

        // Update keg to available (volume is NOT restored to batch)
        await db
          .update(kegs)
          .set({
            status: "available",
            updatedAt: new Date(),
          })
          .where(eq(kegs.id, fill.kegId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting keg fill:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete keg fill",
        });
      }
    }),

  /**
   * Clean a keg (transition from cleaning to available status)
   */
  cleanKeg: createRbacProcedure("update", "package")
    .input(
      z.object({
        kegId: z.string().uuid(),
        cleanedAt: z
          .date()
          .or(z.string().transform((val) => new Date(val)))
          .optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify keg exists and is in cleaning status
        const [keg] = await db
          .select({ id: kegs.id, status: kegs.status, kegNumber: kegs.kegNumber })
          .from(kegs)
          .where(and(eq(kegs.id, input.kegId), isNull(kegs.deletedAt)))
          .limit(1);

        if (!keg) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg not found",
          });
        }

        if (keg.status !== "cleaning") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only kegs with cleaning status can be cleaned",
          });
        }

        // Update keg status to available
        await db
          .update(kegs)
          .set({
            status: "available",
            updatedAt: new Date(),
          })
          .where(eq(kegs.id, input.kegId));

        return {
          success: true,
          message: `Keg ${keg.kegNumber} is now available`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error cleaning keg:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to clean keg",
        });
      }
    }),

  /**
   * Get detailed information about a specific keg fill
   * Returns full fill details with batch composition, keg info, and history
   */
  getKegFillDetails: createRbacProcedure("list", "package")
    .input(z.string().uuid())
    .query(async ({ input: fillId }) => {
      try {
        // Fetch keg fill with all relations
        const fillData = await db
          .select({
            id: kegFills.id,
            kegId: kegFills.kegId,
            batchId: kegFills.batchId,
            vesselId: kegFills.vesselId,
            filledAt: kegFills.filledAt,
            volumeTaken: kegFills.volumeTaken,
            volumeTakenUnit: kegFills.volumeTakenUnit,
            remainingVolume: kegFills.remainingVolume,
            loss: kegFills.loss,
            lossUnit: kegFills.lossUnit,
            carbonationMethod: kegFills.carbonationMethod,
            productionNotes: kegFills.productionNotes,
            status: kegFills.status,
            distributedAt: kegFills.distributedAt,
            distributionLocation: kegFills.distributionLocation,
            returnedAt: kegFills.returnedAt,
            voidedAt: kegFills.voidedAt,
            voidReason: kegFills.voidReason,
            createdBy: kegFills.createdBy,
            createdAt: kegFills.createdAt,
            updatedAt: kegFills.updatedAt,
            // Keg details
            kegNumber: kegs.kegNumber,
            kegType: kegs.kegType,
            capacityML: kegs.capacityML,
            kegCondition: kegs.condition,
            kegCurrentLocation: kegs.currentLocation,
            kegStatus: kegs.status,
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
            // User who filled
            createdByName: sql<string>`created_user.name`.as("createdByName"),
          })
          .from(kegFills)
          .leftJoin(kegs, eq(kegFills.kegId, kegs.id))
          .leftJoin(batches, eq(kegFills.batchId, batches.id))
          .leftJoin(vessels, eq(kegFills.vesselId, vessels.id))
          .leftJoin(
            sql`users AS created_user`,
            sql`created_user.id = ${kegFills.createdBy}`,
          )
          .where(
            and(
              eq(kegFills.id, fillId),
              isNull(kegFills.deletedAt)
            )
          )
          .limit(1);

        if (!fillData.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Keg fill not found",
          });
        }

        const fill = fillData[0];

        // Calculate loss percentage
        const lossPercentage =
          fill.volumeTaken && fill.loss
            ? (parseFloat(fill.loss.toString()) / parseFloat(fill.volumeTaken.toString())) * 100
            : 0;

        return {
          ...fill,
          lossPercentage,
          batch: {
            name: fill.batchName || "",
            customName: fill.batchCustomName || null,
            batchNumber: fill.batchNumber || null,
            status: fill.batchStatus || null,
            initialVolume: fill.batchInitialVolume || null,
            currentVolume: fill.batchCurrentVolume || null,
            startDate: fill.batchStartDate || null,
            endDate: fill.batchEndDate || null,
          },
          keg: {
            kegNumber: fill.kegNumber || "",
            kegType: fill.kegType || "",
            capacityML: fill.capacityML || 0,
            condition: fill.kegCondition || null,
            currentLocation: fill.kegCurrentLocation || null,
            status: fill.kegStatus || null,
          },
          vessel: {
            name: fill.vesselName || "",
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching keg fill details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch keg fill details",
        });
      }
    }),
});
