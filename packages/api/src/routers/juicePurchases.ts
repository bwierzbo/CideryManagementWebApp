import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { db, juicePurchases, juicePurchaseItems, vendors } from "db";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const juicePurchasesRouter = router({
  // List juice purchases
  list: createRbacProcedure("list", "purchase")
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
        vendorId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { limit, offset, vendorId } = input;

        const conditions = [isNull(juicePurchases.deletedAt)];
        if (vendorId) {
          conditions.push(eq(juicePurchases.vendorId, vendorId));
        }

        const purchases = await db
          .select({
            id: juicePurchases.id,
            vendorId: juicePurchases.vendorId,
            vendorName: vendors.name,
            purchaseDate: juicePurchases.purchaseDate,
            totalCost: juicePurchases.totalCost,
            notes: juicePurchases.notes,
            createdAt: juicePurchases.createdAt,
            updatedAt: juicePurchases.updatedAt,
          })
          .from(juicePurchases)
          .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
          .where(and(...conditions))
          .orderBy(desc(juicePurchases.purchaseDate))
          .limit(limit)
          .offset(offset);

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(juicePurchases)
          .where(and(...conditions));

        return {
          purchases,
          pagination: {
            total: totalCount[0]?.count || 0,
            limit,
            offset,
            hasMore: (totalCount[0]?.count || 0) > offset + limit,
          },
        };
      } catch (error) {
        console.error("Error listing juice purchases:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list juice purchases",
        });
      }
    }),

  // Create juice purchase
  create: createRbacProcedure("create", "purchase")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
        purchaseDate: z.date().or(z.string().transform((val) => new Date(val))),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              juiceType: z.string().min(1, "Juice type is required"),
              varietyName: z.string().optional(),
              volumeL: z.number().positive("Volume must be positive"),
              brix: z.number().min(0).max(50).optional(),
              ph: z.number().min(0).max(14).optional(),
              specificGravity: z.number().min(0.9).max(1.2).optional(),
              containerType: z
                .enum(["drum", "tote", "tank", "other"])
                .optional(),
              pricePerLiter: z
                .number()
                .positive("Price per liter must be positive")
                .optional(),
              notes: z.string().optional(),
            }),
          )
          .min(1, "At least one item is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Calculate total cost
          let totalCost = 0;
          const processedItems = [];

          for (const item of input.items) {
            const itemTotal = item.pricePerLiter
              ? item.volumeL * item.pricePerLiter
              : 0;
            totalCost += itemTotal;

            const { volumeL, ...itemRest } = item;
            processedItems.push({
              ...itemRest,
              totalCost: itemTotal.toString(),
              volume: volumeL.toString(),
              volumeUnit: "L" as const,
              pricePerLiter: item.pricePerLiter?.toString() || null,
              brix: item.brix?.toString() || null,
              ph: item.ph?.toString() || null,
              specificGravity: item.specificGravity?.toString() || null,
            });
          }

          // Create the purchase
          const newPurchase = await tx
            .insert(juicePurchases)
            .values({
              vendorId: input.vendorId,
              purchaseDate: input.purchaseDate,
              totalCost: totalCost.toString(),
              notes: input.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          const purchaseId = newPurchase[0].id;

          // Create purchase items
          const newItems = await tx
            .insert(juicePurchaseItems)
            .values(
              processedItems.map((item) => ({
                purchaseId,
                ...item,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            )
            .returning();

          return {
            success: true,
            purchase: newPurchase[0],
            items: newItems,
            message: "Juice purchase created successfully",
          };
        });
      } catch (error) {
        console.error("Error creating juice purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create juice purchase",
        });
      }
    }),

  // Get purchase by ID with items
  getById: createRbacProcedure("read", "purchase")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const purchase = await db.query.juicePurchases.findFirst({
          where: eq(juicePurchases.id, input.id),
          with: {
            items: true,
            vendor: true,
          },
        });

        if (!purchase) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Juice purchase not found",
          });
        }

        return { purchase };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Error fetching juice purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch juice purchase",
        });
      }
    }),

  // List juice inventory with available volumes
  listInventory: createRbacProcedure("read", "purchase")
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
        vendorId: z.string().uuid().optional(),
        showFullyAllocated: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { limit, offset, vendorId, showFullyAllocated } = input;

        const items = await db
          .select({
            id: juicePurchaseItems.id,
            purchaseId: juicePurchaseItems.purchaseId,
            purchaseDate: juicePurchases.purchaseDate,
            vendorId: juicePurchases.vendorId,
            vendorName: vendors.name,
            juiceType: juicePurchaseItems.juiceType,
            varietyName: juicePurchaseItems.varietyName,
            volume: juicePurchaseItems.volume,
            volumeUnit: juicePurchaseItems.volumeUnit,
            volumeAllocated: juicePurchaseItems.volumeAllocated,
            brix: juicePurchaseItems.brix,
            ph: juicePurchaseItems.ph,
            specificGravity: juicePurchaseItems.specificGravity,
            containerType: juicePurchaseItems.containerType,
            notes: juicePurchaseItems.notes,
            createdAt: juicePurchaseItems.createdAt,
          })
          .from(juicePurchaseItems)
          .leftJoin(
            juicePurchases,
            eq(juicePurchaseItems.purchaseId, juicePurchases.id),
          )
          .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
          .where(
            and(
              isNull(juicePurchaseItems.deletedAt),
              isNull(juicePurchases.deletedAt),
              vendorId ? eq(juicePurchases.vendorId, vendorId) : undefined,
              !showFullyAllocated
                ? sql`CAST(${juicePurchaseItems.volume} AS DECIMAL) > CAST(${juicePurchaseItems.volumeAllocated} AS DECIMAL)`
                : undefined,
            ),
          )
          .orderBy(desc(juicePurchases.purchaseDate))
          .limit(limit)
          .offset(offset);

        // Calculate available volume for each item
        const itemsWithAvailable = items.map((item) => {
          const totalVolume = parseFloat(item.volume || "0");
          const allocated = parseFloat(item.volumeAllocated || "0");
          const available = totalVolume - allocated;

          return {
            ...item,
            availableVolume: available.toString(),
            availableVolumeL: available,
          };
        });

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(juicePurchaseItems)
          .leftJoin(
            juicePurchases,
            eq(juicePurchaseItems.purchaseId, juicePurchases.id),
          )
          .where(
            and(
              isNull(juicePurchaseItems.deletedAt),
              isNull(juicePurchases.deletedAt),
              vendorId ? eq(juicePurchases.vendorId, vendorId) : undefined,
              !showFullyAllocated
                ? sql`CAST(${juicePurchaseItems.volume} AS DECIMAL) > CAST(${juicePurchaseItems.volumeAllocated} AS DECIMAL)`
                : undefined,
            ),
          );

        return {
          items: itemsWithAvailable,
          pagination: {
            total: totalCount[0]?.count || 0,
            limit,
            offset,
            hasMore: (totalCount[0]?.count || 0) > offset + limit,
          },
        };
      } catch (error) {
        console.error("Error listing juice inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list juice inventory",
        });
      }
    }),
});
