import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { db, additivePurchases, additivePurchaseItems, vendors } from "db";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const additivePurchasesRouter = router({
  // List additive purchases
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

        const conditions = [isNull(additivePurchases.deletedAt)];
        if (vendorId) {
          conditions.push(eq(additivePurchases.vendorId, vendorId));
        }

        const purchases = await db
          .select({
            id: additivePurchases.id,
            vendorId: additivePurchases.vendorId,
            vendorName: vendors.name,
            purchaseDate: additivePurchases.purchaseDate,
            totalCost: additivePurchases.totalCost,
            notes: additivePurchases.notes,
            createdAt: additivePurchases.createdAt,
            updatedAt: additivePurchases.updatedAt,
          })
          .from(additivePurchases)
          .leftJoin(vendors, eq(additivePurchases.vendorId, vendors.id))
          .where(and(...conditions))
          .orderBy(desc(additivePurchases.purchaseDate))
          .limit(limit)
          .offset(offset);

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(additivePurchases)
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
        console.error("Error listing additive purchases:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list additive purchases",
        });
      }
    }),

  // Create additive purchase
  create: createRbacProcedure("create", "purchase")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
        purchaseDate: z.date().or(z.string().transform((val) => new Date(val))),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              additiveVarietyId: z.string().uuid("Invalid additive variety ID"),
              brandManufacturer: z
                .string()
                .min(1, "Brand/manufacturer is required"),
              productName: z.string().min(1, "Product name is required"),
              quantity: z.number().positive("Quantity must be positive"),
              unit: z.enum(["g", "kg", "oz", "lb"]),
              lotBatchNumber: z.string().optional(),
              expirationDate: z
                .date()
                .or(z.string().transform((val) => new Date(val)))
                .optional(),
              storageRequirements: z.string().optional(),
              pricePerUnit: z
                .number()
                .positive("Price per unit must be positive")
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
            const itemTotal = item.pricePerUnit
              ? item.quantity * item.pricePerUnit
              : 0;
            totalCost += itemTotal;

            processedItems.push({
              additiveVarietyId: item.additiveVarietyId,
              brandManufacturer: item.brandManufacturer,
              productName: item.productName,
              quantity: item.quantity.toString(),
              unit: item.unit,
              lotBatchNumber: item.lotBatchNumber,
              expirationDate: item.expirationDate
                ? item.expirationDate.toISOString().split("T")[0]
                : null,
              storageRequirements: item.storageRequirements,
              pricePerUnit: item.pricePerUnit?.toString() || null,
              totalCost: itemTotal.toString(),
              notes: item.notes,
            });
          }

          // Create the purchase
          const newPurchase = await tx
            .insert(additivePurchases)
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
            .insert(additivePurchaseItems)
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
            message: "Additive purchase created successfully",
          };
        });
      } catch (error) {
        console.error("Error creating additive purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create additive purchase",
        });
      }
    }),

  // Get purchase by ID with items
  getById: createRbacProcedure("read", "purchase")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const purchase = await db.query.additivePurchases.findFirst({
          where: eq(additivePurchases.id, input.id),
          with: {
            items: true,
            vendor: true,
          },
        });

        if (!purchase) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Additive purchase not found",
          });
        }

        return { purchase };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Error fetching additive purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch additive purchase",
        });
      }
    }),
});
