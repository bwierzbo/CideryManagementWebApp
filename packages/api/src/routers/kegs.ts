import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  kegs,
  kegFills,
  kegFillMaterials,
  vessels,
  batches,
  users,
  packagingPurchaseItems,
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
  notes: z.string().optional(),
});

const fillKegsSchema = z.object({
  kegIds: z.array(z.string().uuid()).min(1, "Select at least one keg"),
  batchId: z.string().uuid(),
  vesselId: z.string().uuid(),
  filledAt: z
    .date()
    .or(z.string().transform((val) => new Date(val)))
    .default(() => new Date()),
  volumeTakenPerKeg: z.number().positive("Volume must be positive"),
  volumeTakenUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]).default("L"),
  loss: z.number().min(0).optional(),
  lossUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]).default("L"),
  abvAtPackaging: z.number().min(0).max(20).optional(),
  carbonationLevel: z.enum(["still", "petillant", "sparkling"]).optional(),
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
  listKegs: createRbacProcedure("list", "batch")
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
            // Get latest fill info via subquery
            latestFillId: sql<string>`(
              SELECT keg_fills.id FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status != 'voided'
              ORDER BY keg_fills.filled_at DESC
              LIMIT 1
            )`,
            latestFillBatchName: sql<string>`(
              SELECT b.name FROM keg_fills kf
              LEFT JOIN batches b ON kf.batch_id = b.id
              WHERE kf.keg_id = kegs.id
                AND kf.status != 'voided'
              ORDER BY kf.filled_at DESC
              LIMIT 1
            )`,
            latestFillDate: sql<Date>`(
              SELECT keg_fills.filled_at FROM keg_fills
              WHERE keg_fills.keg_id = kegs.id
                AND keg_fills.status != 'voided'
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
  getKegDetails: createRbacProcedure("list", "batch")
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
          .where(eq(kegFills.kegId, input.kegId))
          .orderBy(desc(kegFills.filledAt));

        return {
          keg: keg[0],
          fills,
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
  getAvailableKegs: createRbacProcedure("list", "batch").query(
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
  createKeg: createRbacProcedure("create", "batch")
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
  updateKeg: createRbacProcedure("update", "batch")
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

        const [updatedKeg] = await db
          .update(kegs)
          .set({
            ...updates,
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
  deleteKeg: createRbacProcedure("delete", "batch")
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
  fillKegs: createRbacProcedure("create", "batch")
    .input(fillKegsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;

        // Verify all kegs are available
        const kegsToFill = await db
          .select({ id: kegs.id, status: kegs.status, kegNumber: kegs.kegNumber })
          .from(kegs)
          .where(
            and(inArray(kegs.id, input.kegIds), isNull(kegs.deletedAt)),
          );

        if (kegsToFill.length !== input.kegIds.length) {
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

        // Create keg fills and update keg status in a transaction
        const fillRecords = [];

        for (const kegId of input.kegIds) {
          // Create fill record
          const [fill] = await db
            .insert(kegFills)
            .values({
              kegId,
              batchId: input.batchId,
              vesselId: input.vesselId,
              filledAt: input.filledAt,
              volumeTaken: input.volumeTakenPerKeg.toString(),
              volumeTakenUnit: input.volumeTakenUnit,
              loss: input.loss?.toString(),
              lossUnit: input.lossUnit,
              abvAtPackaging: input.abvAtPackaging?.toString(),
              carbonationLevel: input.carbonationLevel,
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
            .where(eq(kegs.id, kegId));

          // Add materials if provided
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
   * Mark keg fill as distributed
   */
  distributeKegFill: createRbacProcedure("update", "batch")
    .input(distributeKegFillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify fill exists and is filled
        const [fill] = await db
          .select({ status: kegFills.status, kegId: kegFills.kegId })
          .from(kegFills)
          .where(eq(kegFills.id, input.kegFillId))
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
            message: "Only filled kegs can be distributed",
          });
        }

        // Update fill status
        await db
          .update(kegFills)
          .set({
            status: "distributed",
            distributedAt: input.distributedAt,
            distributionLocation: input.distributionLocation,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
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
  returnKegFill: createRbacProcedure("update", "batch")
    .input(returnKegFillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify fill exists and is distributed
        const [fill] = await db
          .select({ status: kegFills.status, kegId: kegFills.kegId })
          .from(kegFills)
          .where(eq(kegFills.id, input.kegFillId))
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

        // Update fill status
        await db
          .update(kegFills)
          .set({
            status: "returned",
            returnedAt: input.returnedAt,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(kegFills.id, input.kegFillId));

        // Update keg status to available
        await db
          .update(kegs)
          .set({
            status: "available",
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
   * Void a keg fill
   */
  voidKegFill: createRbacProcedure("update", "batch")
    .input(voidKegFillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get fill info
        const [fill] = await db
          .select({ kegId: kegFills.kegId })
          .from(kegFills)
          .where(eq(kegFills.id, input.kegFillId))
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
});
