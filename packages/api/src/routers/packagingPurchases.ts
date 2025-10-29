import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { db, packagingPurchases, packagingPurchaseItems, packagingVarieties, vendors } from "db";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const packagingPurchasesRouter = router({
  // List packaging purchases
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

        const conditions = [isNull(packagingPurchases.deletedAt)];
        if (vendorId) {
          conditions.push(eq(packagingPurchases.vendorId, vendorId));
        }

        const purchases = await db
          .select({
            id: packagingPurchases.id,
            vendorId: packagingPurchases.vendorId,
            vendorName: vendors.name,
            purchaseDate: packagingPurchases.purchaseDate,
            totalCost: packagingPurchases.totalCost,
            notes: packagingPurchases.notes,
            createdAt: packagingPurchases.createdAt,
            updatedAt: packagingPurchases.updatedAt,
          })
          .from(packagingPurchases)
          .leftJoin(vendors, eq(packagingPurchases.vendorId, vendors.id))
          .where(and(...conditions))
          .orderBy(desc(packagingPurchases.purchaseDate))
          .limit(limit)
          .offset(offset);

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(packagingPurchases)
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
        console.error("Error listing packaging purchases:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list packaging purchases",
        });
      }
    }),

  // Create packaging purchase
  create: createRbacProcedure("create", "purchase")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
        purchaseDate: z.date().or(z.string().transform((val) => new Date(val))),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              packagingId: z.string().uuid("Invalid packaging ID"),
              packagingName: z.string().optional(),
              packagingType: z.string().optional(),
              unitType: z.string().optional(),
              quantity: z.number().int().positive("Quantity must be positive"),
              pricePerUnit: z
                .number()
                .positive("Price per unit must be positive")
                .optional(),
              totalCost: z
                .number()
                .positive("Total cost must be positive")
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
            // Use totalCost if provided, otherwise calculate from unit cost
            const itemTotal =
              item.totalCost ||
              (item.pricePerUnit ? item.quantity * item.pricePerUnit : 0);
            totalCost += itemTotal;

            processedItems.push({
              packagingVarietyId: item.packagingId,
              packageType: item.packagingType || null,
              size: item.packagingName || "Unknown",
              quantity: item.quantity,
              totalCost: itemTotal.toString(),
              pricePerUnit: item.pricePerUnit?.toString() || null,
              notes: item.notes || null,
            });
          }

          // Create the purchase
          const newPurchase = await tx
            .insert(packagingPurchases)
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
            .insert(packagingPurchaseItems)
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
            message: "Packaging purchase created successfully",
          };
        });
      } catch (error) {
        console.error("Error creating packaging purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create packaging purchase",
        });
      }
    }),

  // Get purchase by ID with items
  getById: createRbacProcedure("read", "purchase")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const purchase = await db.query.packagingPurchases.findFirst({
          where: eq(packagingPurchases.id, input.id),
          with: {
            items: true,
            vendor: true,
          },
        });

        if (!purchase) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Packaging purchase not found",
          });
        }

        return { purchase };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Error fetching packaging purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch packaging purchase",
        });
      }
    }),

  // List packaging inventory with available quantities
  listInventory: createRbacProcedure("list", "purchase")
    .input(
      z.object({
        itemType: z.string().optional(),
        materialType: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { itemType, materialType, limit, offset } = input;

        const conditions = [isNull(packagingPurchaseItems.deletedAt)];

        // Filter by material type if provided
        if (materialType) {
          conditions.push(eq(packagingPurchaseItems.materialType, materialType));
        }

        // Query packaging purchase items with variety info
        const items = await db
          .select({
            id: packagingPurchaseItems.id,
            purchaseId: packagingPurchaseItems.purchaseId,
            packagingVarietyId: packagingPurchaseItems.packagingVarietyId,
            packageType: packagingPurchaseItems.packageType,
            materialType: packagingPurchaseItems.materialType,
            size: packagingPurchaseItems.size,
            quantity: packagingPurchaseItems.quantity,
            unitCost: packagingPurchaseItems.pricePerUnit,
            totalCost: packagingPurchaseItems.totalCost,
            notes: packagingPurchaseItems.notes,
            purchaseDate: packagingPurchases.purchaseDate,
            vendorName: vendors.name,
            // Get variety info for filtering by itemType
            varietyName: sql<string>`${packagingVarieties.name}`,
            varietyItemType: sql<string>`${packagingVarieties.itemType}`,
          })
          .from(packagingPurchaseItems)
          .leftJoin(
            packagingPurchases,
            eq(packagingPurchaseItems.purchaseId, packagingPurchases.id),
          )
          .leftJoin(vendors, eq(packagingPurchases.vendorId, vendors.id))
          .leftJoin(
            packagingVarieties,
            eq(packagingPurchaseItems.packagingVarietyId, packagingVarieties.id),
          )
          .where(and(...conditions))
          .orderBy(desc(packagingPurchaseItems.createdAt));

        // Filter by itemType if provided (client-side for now since itemType is in varieties table)
        const filteredItems = itemType
          ? items.filter((item) => item.varietyItemType === itemType)
          : items;

        // Apply pagination
        const paginatedItems = filteredItems.slice(offset, offset + limit);
        const totalCount = filteredItems.length;

        return {
          items: paginatedItems,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: totalCount > offset + limit,
          },
        };
      } catch (error) {
        console.error("Error listing packaging inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list packaging inventory",
        });
      }
    }),
});
