import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { db, additivePurchases, additivePurchaseItems, vendors, additiveVarieties } from "db";
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
        itemType: z.string().optional(), // Filter by additive variety item type (e.g., "Sugar & Sweeteners")
      }),
    )
    .query(async ({ input }) => {
      try {
        const { limit, offset, vendorId, itemType } = input;

        const conditions = [isNull(additivePurchases.deletedAt)];
        if (vendorId) {
          conditions.push(eq(additivePurchases.vendorId, vendorId));
        }
        if (itemType) {
          conditions.push(eq(additiveVarieties.itemType, itemType));
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
            // Include item data
            itemId: additivePurchaseItems.id,
            itemProductName: additivePurchaseItems.productName,
            itemBrandManufacturer: additivePurchaseItems.brandManufacturer,
            itemQuantity: additivePurchaseItems.quantity,
            itemUnit: additivePurchaseItems.unit,
            itemAdditiveVarietyId: additivePurchaseItems.additiveVarietyId,
          })
          .from(additivePurchases)
          .leftJoin(vendors, eq(additivePurchases.vendorId, vendors.id))
          .leftJoin(additivePurchaseItems, eq(additivePurchases.id, additivePurchaseItems.purchaseId))
          .leftJoin(additiveVarieties, eq(additivePurchaseItems.additiveVarietyId, additiveVarieties.id))
          .where(and(...conditions))
          .orderBy(desc(additivePurchases.purchaseDate))
          .limit(limit * 10) // Increase limit to account for multiple items per purchase
          .offset(offset);

        // Group items by purchase
        const groupedPurchases = purchases.reduce((acc: any[], row) => {
          const existingPurchase = acc.find(p => p.id === row.id);

          if (existingPurchase) {
            if (row.itemId) {
              existingPurchase.items.push({
                id: row.itemId,
                productName: row.itemProductName,
                brandManufacturer: row.itemBrandManufacturer,
                quantity: row.itemQuantity,
                unit: row.itemUnit,
                additiveVarietyId: row.itemAdditiveVarietyId,
              });
            }
          } else {
            acc.push({
              id: row.id,
              vendorId: row.vendorId,
              vendorName: row.vendorName,
              purchaseDate: row.purchaseDate,
              totalCost: row.totalCost,
              notes: row.notes,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              items: row.itemId ? [{
                id: row.itemId,
                productName: row.itemProductName,
                brandManufacturer: row.itemBrandManufacturer,
                quantity: row.itemQuantity,
                unit: row.itemUnit,
                additiveVarietyId: row.itemAdditiveVarietyId,
              }] : [],
            });
          }
          return acc;
        }, []);

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(additivePurchases)
          .where(and(...conditions));

        return {
          purchases: groupedPurchases.slice(0, limit),
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

  // Update additive purchase item
  updatePurchaseItem: createRbacProcedure("update", "purchase")
    .input(
      z.object({
        itemId: z.string().uuid("Invalid item ID"),
        additiveVarietyId: z.string().uuid("Invalid additive variety ID").optional(),
        additiveType: z.string().optional(),
        brandManufacturer: z.string().optional(),
        productName: z.string().optional(),
        quantity: z.number().positive("Quantity must be positive").optional(),
        unit: z.enum(["g", "kg", "oz", "lb"]).optional(),
        lotBatchNumber: z.string().optional(),
        expirationDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        storageRequirements: z.string().optional(),
        pricePerUnit: z.number().min(0, "Price per unit cannot be negative").optional(),
        purchaseDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { itemId, ...updates } = input;

        // Check if item exists and get purchase ID
        const existingItem = await db
          .select({
            id: additivePurchaseItems.id,
            purchaseId: additivePurchaseItems.purchaseId
          })
          .from(additivePurchaseItems)
          .where(eq(additivePurchaseItems.id, itemId))
          .limit(1);

        if (!existingItem[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Additive purchase item not found",
          });
        }

        // Prepare update data
        const updateData: any = { updatedAt: new Date() };

        if (updates.additiveVarietyId !== undefined) updateData.additiveVarietyId = updates.additiveVarietyId;
        if (updates.additiveType !== undefined) updateData.additiveType = updates.additiveType;
        if (updates.brandManufacturer !== undefined) updateData.brandManufacturer = updates.brandManufacturer;
        if (updates.productName !== undefined) updateData.productName = updates.productName;
        if (updates.quantity !== undefined) updateData.quantity = updates.quantity.toString();
        if (updates.unit !== undefined) updateData.unit = updates.unit;
        if (updates.lotBatchNumber !== undefined) updateData.lotBatchNumber = updates.lotBatchNumber;
        if (updates.expirationDate !== undefined) updateData.expirationDate = updates.expirationDate instanceof Date ? updates.expirationDate.toISOString().split('T')[0] : updates.expirationDate;
        if (updates.storageRequirements !== undefined) updateData.storageRequirements = updates.storageRequirements;
        if (updates.pricePerUnit !== undefined) updateData.pricePerUnit = updates.pricePerUnit.toString();
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        // Calculate total cost if quantity or price changed
        if (updates.quantity !== undefined || updates.pricePerUnit !== undefined) {
          const currentItem = await db
            .select({
              quantity: additivePurchaseItems.quantity,
              pricePerUnit: additivePurchaseItems.pricePerUnit
            })
            .from(additivePurchaseItems)
            .where(eq(additivePurchaseItems.id, itemId))
            .limit(1);

          const qty = updates.quantity ?? parseFloat(currentItem[0].quantity);
          const price = updates.pricePerUnit ?? parseFloat(currentItem[0].pricePerUnit || "0");
          updateData.totalCost = (qty * price).toFixed(2);
        }

        // Update the item
        const [updatedItem] = await db
          .update(additivePurchaseItems)
          .set(updateData)
          .where(eq(additivePurchaseItems.id, itemId))
          .returning();

        // Update parent purchase's purchase date if provided
        if (updates.purchaseDate !== undefined) {
          await db
            .update(additivePurchases)
            .set({
              purchaseDate: updates.purchaseDate,
              updatedAt: new Date()
            })
            .where(eq(additivePurchases.id, existingItem[0].purchaseId));
        }

        return {
          success: true,
          message: "Additive purchase item updated successfully",
          item: updatedItem,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating additive purchase item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update additive purchase item",
        });
      }
    }),
});
