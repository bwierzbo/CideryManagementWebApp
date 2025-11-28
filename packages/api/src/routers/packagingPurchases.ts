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
              unitType: item.unitType || null,
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

          // Create or update purchase items
          // For items with matching vendor + size + price, add to existing quantity
          const resultItems = [];

          for (const item of processedItems) {
            // Check for existing item with same vendor + size + price
            // Build price condition - handle null pricePerUnit
            const priceCondition = item.pricePerUnit === null
              ? isNull(packagingPurchaseItems.pricePerUnit)
              : eq(packagingPurchaseItems.pricePerUnit, item.pricePerUnit);

            const existingItem = await tx
              .select({
                id: packagingPurchaseItems.id,
                quantity: packagingPurchaseItems.quantity,
                totalCost: packagingPurchaseItems.totalCost,
              })
              .from(packagingPurchaseItems)
              .innerJoin(
                packagingPurchases,
                eq(packagingPurchaseItems.purchaseId, packagingPurchases.id)
              )
              .where(
                and(
                  eq(packagingPurchases.vendorId, input.vendorId),
                  eq(packagingPurchaseItems.size, item.size),
                  priceCondition,
                  isNull(packagingPurchaseItems.deletedAt)
                )
              )
              .limit(1);

            if (existingItem.length > 0) {
              // Add to existing item's quantity
              const newQuantity = existingItem[0].quantity + item.quantity;
              const existingTotal = parseFloat(existingItem[0].totalCost || "0");
              const itemTotal = parseFloat(item.totalCost || "0");
              const newTotalCost = (existingTotal + itemTotal).toString();

              const [updatedItem] = await tx
                .update(packagingPurchaseItems)
                .set({
                  quantity: newQuantity,
                  totalCost: newTotalCost,
                  updatedAt: new Date(),
                })
                .where(eq(packagingPurchaseItems.id, existingItem[0].id))
                .returning();

              resultItems.push({ ...updatedItem, merged: true });
            } else {
              // Create new item
              const [newItem] = await tx
                .insert(packagingPurchaseItems)
                .values({
                  purchaseId,
                  ...item,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning();

              resultItems.push({ ...newItem, merged: false });
            }
          }

          return {
            success: true,
            purchase: newPurchase[0],
            items: resultItems,
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

  // Update packaging purchase item
  updatePurchaseItem: createRbacProcedure("update", "purchase")
    .input(
      z.object({
        itemId: z.string().uuid("Invalid item ID"),
        packagingVarietyId: z.string().uuid("Invalid packaging variety ID").optional(),
        packageType: z.string().optional(),
        materialType: z.string().optional(),
        size: z.string().optional(),
        quantity: z.number().positive("Quantity must be positive").optional(),
        unitType: z.string().optional(),
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
            id: packagingPurchaseItems.id,
            purchaseId: packagingPurchaseItems.purchaseId
          })
          .from(packagingPurchaseItems)
          .where(eq(packagingPurchaseItems.id, itemId))
          .limit(1);

        if (!existingItem[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Packaging purchase item not found",
          });
        }

        // Prepare update data
        const updateData: any = { updatedAt: new Date() };

        if (updates.packagingVarietyId !== undefined) updateData.packagingVarietyId = updates.packagingVarietyId;
        if (updates.packageType !== undefined) updateData.packageType = updates.packageType;
        if (updates.materialType !== undefined) updateData.materialType = updates.materialType;
        if (updates.size !== undefined) updateData.size = updates.size;
        if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
        if (updates.unitType !== undefined) updateData.unitType = updates.unitType;
        if (updates.pricePerUnit !== undefined) updateData.pricePerUnit = updates.pricePerUnit.toString();
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        // Calculate total cost if quantity or price changed
        if (updates.quantity !== undefined || updates.pricePerUnit !== undefined) {
          const currentItem = await db
            .select({
              quantity: packagingPurchaseItems.quantity,
              pricePerUnit: packagingPurchaseItems.pricePerUnit
            })
            .from(packagingPurchaseItems)
            .where(eq(packagingPurchaseItems.id, itemId))
            .limit(1);

          const qty = updates.quantity ?? currentItem[0].quantity;
          const price = updates.pricePerUnit ?? parseFloat(currentItem[0].pricePerUnit || "0");
          updateData.totalCost = (qty * price).toFixed(2);
        }

        // Update the item
        const [updatedItem] = await db
          .update(packagingPurchaseItems)
          .set(updateData)
          .where(eq(packagingPurchaseItems.id, itemId))
          .returning();

        // Update parent purchase's purchase date if provided
        if (updates.purchaseDate !== undefined) {
          await db
            .update(packagingPurchases)
            .set({
              purchaseDate: updates.purchaseDate,
              updatedAt: new Date()
            })
            .where(eq(packagingPurchases.id, existingItem[0].purchaseId));
        }

        return {
          success: true,
          message: "Packaging purchase item updated successfully",
          item: updatedItem,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating packaging purchase item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update packaging purchase item",
        });
      }
    }),
});
