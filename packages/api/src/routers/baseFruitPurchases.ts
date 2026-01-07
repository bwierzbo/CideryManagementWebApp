import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  basefruitPurchases,
  basefruitPurchaseItems,
  vendors,
  baseFruitVarieties,
} from "db";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const baseFruitPurchasesRouter = router({
  // List individual base fruit purchase items (for inventory table)
  listItems: createRbacProcedure("list", "purchase")
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { limit, offset } = input;

        // Get individual purchase items with their purchase and vendor info
        const items = await db
          .select({
            id: basefruitPurchaseItems.id,
            purchaseId: basefruitPurchases.id,
            vendorName: vendors.name,
            varietyName: baseFruitVarieties.name,
            harvestDate: basefruitPurchaseItems.harvestDate,
            quantity: basefruitPurchaseItems.quantity,
            unit: basefruitPurchaseItems.unit,
            pricePerUnit: basefruitPurchaseItems.pricePerUnit,
            totalCost: basefruitPurchaseItems.totalCost,
            notes: basefruitPurchaseItems.notes,
            purchaseDate: basefruitPurchases.purchaseDate,
            createdAt: basefruitPurchases.purchaseDate,
            updatedAt: basefruitPurchases.updatedAt,
          })
          .from(basefruitPurchaseItems)
          .leftJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
          )
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .leftJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
          )
          .where(
            and(
              isNull(basefruitPurchaseItems.deletedAt),
              isNull(basefruitPurchases.deletedAt),
              eq(basefruitPurchaseItems.isDepleted, false),
            ),
          )
          .orderBy(desc(basefruitPurchases.purchaseDate))
          .limit(limit)
          .offset(offset);

        // Get total count
        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(basefruitPurchaseItems)
          .leftJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
          )
          .where(
            and(
              isNull(basefruitPurchaseItems.deletedAt),
              isNull(basefruitPurchases.deletedAt),
              eq(basefruitPurchaseItems.isDepleted, false),
            ),
          );

        const totalCount = totalCountResult[0]?.count || 0;

        return {
          items,
          pagination: {
            totalCount,
            hasNextPage: offset + limit < totalCount,
            hasPreviousPage: offset > 0,
          },
        };
      } catch (error) {
        console.error("Error fetching base fruit purchase items:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch base fruit purchase items",
        });
      }
    }),

  // List base fruit purchases
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

        const conditions = [isNull(basefruitPurchases.deletedAt)];
        if (vendorId) {
          conditions.push(eq(basefruitPurchases.vendorId, vendorId));
        }

        const purchases = await db
          .select({
            id: basefruitPurchases.id,
            vendorId: basefruitPurchases.vendorId,
            vendorName: vendors.name,
            purchaseDate: basefruitPurchases.purchaseDate,
            totalCost: basefruitPurchases.totalCost,
            notes: basefruitPurchases.notes,
            createdAt: basefruitPurchases.createdAt,
            updatedAt: basefruitPurchases.updatedAt,
          })
          .from(basefruitPurchases)
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .where(and(...conditions))
          .orderBy(desc(basefruitPurchases.purchaseDate))
          .limit(limit)
          .offset(offset);

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(basefruitPurchases)
          .where(and(...conditions));

        return {
          purchases,
          pagination: {
            totalCount: totalCount[0].count,
            hasNextPage: offset + limit < totalCount[0].count,
            hasPreviousPage: offset > 0,
          },
        };
      } catch (error) {
        console.error("Error fetching base fruit purchases:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch base fruit purchases",
        });
      }
    }),

  // Create base fruit purchase
  create: createRbacProcedure("create", "purchase")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
        purchaseDate: z.date().or(z.string().transform((val) => new Date(val))),
        invoiceNumber: z.string().optional(),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              fruitVarietyId: z.string().uuid("Invalid fruit variety ID"),
              quantity: z.number().positive("Quantity must be positive"),
              unit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
              pricePerUnit: z
                .number()
                .nonnegative("Price per unit cannot be negative")
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
          const totalCostNum = input.items.reduce((sum, item) => {
            return sum + (item.pricePerUnit || 0) * item.quantity;
          }, 0);
          const totalCost = totalCostNum.toString();

          // Create purchase
          const newPurchase = await tx
            .insert(basefruitPurchases)
            .values({
              vendorId: input.vendorId,
              purchaseDate: input.purchaseDate,
              totalCost,
              notes: input.notes,
            })
            .returning();

          if (!newPurchase[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create base fruit purchase",
            });
          }

          // Create purchase items
          const purchaseItems = await Promise.all(
            input.items.map(async (item) => {
              // Convert quantity to kg for standardization
              let quantityKg = item.quantity;
              if (item.unit === "lb") {
                quantityKg = item.quantity * 0.453592; // lb to kg
              } else if (item.unit === "bushel") {
                quantityKg = item.quantity * 19.05; // bushel to kg (42 lbs)
              }
              // kg, L, gal stay as-is for quantityKg field

              // Calculate total cost for this item
              const itemTotalCost = item.pricePerUnit
                ? (item.quantity * item.pricePerUnit).toString()
                : null;

              const newItem = await tx
                .insert(basefruitPurchaseItems)
                .values({
                  purchaseId: newPurchase[0].id,
                  fruitVarietyId: item.fruitVarietyId,
                  quantity: item.quantity.toString(),
                  unit: item.unit,
                  quantityKg: quantityKg.toString(),
                  pricePerUnit: item.pricePerUnit?.toString(),
                  totalCost: itemTotalCost,
                  notes: item.notes,
                })
                .returning();

              return newItem[0];
            }),
          );

          return {
            success: true,
            purchase: newPurchase[0],
            items: purchaseItems,
            message: `Created base fruit purchase with ${purchaseItems.length} items`,
          };
        });
      } catch (error) {
        console.error("Error creating base fruit purchase:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create base fruit purchase",
        });
      }
    }),

  // Get purchase by ID
  getById: createRbacProcedure("read", "purchase")
    .input(
      z.object({
        purchaseId: z.string().uuid("Invalid purchase ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const purchase = await db
          .select({
            id: basefruitPurchases.id,
            vendorId: basefruitPurchases.vendorId,
            vendorName: vendors.name,
            purchaseDate: basefruitPurchases.purchaseDate,
            totalCost: basefruitPurchases.totalCost,
            notes: basefruitPurchases.notes,
            createdAt: basefruitPurchases.createdAt,
            updatedAt: basefruitPurchases.updatedAt,
          })
          .from(basefruitPurchases)
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .where(
            and(
              eq(basefruitPurchases.id, input.purchaseId),
              isNull(basefruitPurchases.deletedAt),
            ),
          )
          .limit(1);

        if (!purchase[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Base fruit purchase not found",
          });
        }

        // Get purchase items
        const items = await db
          .select({
            id: basefruitPurchaseItems.id,
            fruitVarietyId: basefruitPurchaseItems.fruitVarietyId,
            varietyName: baseFruitVarieties.name,
            quantity: basefruitPurchaseItems.quantity,
            unit: basefruitPurchaseItems.unit,
            pricePerUnit: basefruitPurchaseItems.pricePerUnit,
            notes: basefruitPurchaseItems.notes,
            createdAt: basefruitPurchaseItems.createdAt,
            updatedAt: basefruitPurchaseItems.updatedAt,
          })
          .from(basefruitPurchaseItems)
          .leftJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
          )
          .where(eq(basefruitPurchaseItems.purchaseId, purchase[0].id));

        return {
          ...purchase[0],
          items,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching base fruit purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch base fruit purchase",
        });
      }
    }),

  // Delete purchase (soft delete)
  delete: createRbacProcedure("delete", "purchase")
    .input(
      z.object({
        purchaseId: z.string().uuid("Invalid purchase ID"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Check if purchase exists and is not already deleted
          const existingPurchase = await tx
            .select({ id: basefruitPurchases.id })
            .from(basefruitPurchases)
            .where(
              and(
                eq(basefruitPurchases.id, input.purchaseId),
                isNull(basefruitPurchases.deletedAt),
              ),
            )
            .limit(1);

          if (!existingPurchase[0]) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Base fruit purchase not found or already deleted",
            });
          }

          // Soft delete the purchase
          await tx
            .update(basefruitPurchases)
            .set({ deletedAt: new Date() })
            .where(eq(basefruitPurchases.id, input.purchaseId));

          return {
            success: true,
            message: "Base fruit purchase deleted successfully",
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting base fruit purchase:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete base fruit purchase",
        });
      }
    }),

  // Delete individual purchase item (soft delete)
  deleteItem: createRbacProcedure("delete", "purchase")
    .input(
      z.object({
        itemId: z.string().uuid("Invalid item ID"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Check if item exists and is not already deleted
          const existingItem = await tx
            .select({ id: basefruitPurchaseItems.id })
            .from(basefruitPurchaseItems)
            .where(
              and(
                eq(basefruitPurchaseItems.id, input.itemId),
                isNull(basefruitPurchaseItems.deletedAt),
              ),
            )
            .limit(1);

          if (!existingItem[0]) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Base fruit purchase item not found or already deleted",
            });
          }

          // Soft delete the item
          await tx
            .update(basefruitPurchaseItems)
            .set({ deletedAt: new Date() })
            .where(eq(basefruitPurchaseItems.id, input.itemId));

          return {
            success: true,
            message: "Base fruit purchase item deleted successfully",
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting base fruit purchase item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete base fruit purchase item",
        });
      }
    }),

  // Update base fruit purchase item
  updatePurchaseItem: createRbacProcedure("update", "purchase")
    .input(
      z.object({
        itemId: z.string().uuid("Invalid item ID"),
        fruitVarietyId: z.string().uuid("Invalid fruit variety ID").optional(),
        quantity: z.number().positive("Quantity must be positive").optional(),
        unit: z.enum(["kg", "lb", "L", "gal", "bushel"]).optional(),
        pricePerUnit: z.number().min(0, "Price per unit cannot be negative").optional(),
        purchaseDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        harvestDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { itemId, ...updates } = input;

        // Check if item exists and get purchase ID
        const existingItem = await db
          .select({
            id: basefruitPurchaseItems.id,
            purchaseId: basefruitPurchaseItems.purchaseId
          })
          .from(basefruitPurchaseItems)
          .where(eq(basefruitPurchaseItems.id, itemId))
          .limit(1);

        if (!existingItem[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Base fruit purchase item not found",
          });
        }

        // Prepare update data
        const updateData: any = { updatedAt: new Date() };

        if (updates.fruitVarietyId !== undefined) updateData.fruitVarietyId = updates.fruitVarietyId;
        if (updates.quantity !== undefined) updateData.quantity = updates.quantity.toString();
        if (updates.unit !== undefined) updateData.unit = updates.unit;
        if (updates.pricePerUnit !== undefined) updateData.pricePerUnit = updates.pricePerUnit.toString();
        if (updates.harvestDate !== undefined) updateData.harvestDate = updates.harvestDate instanceof Date ? updates.harvestDate.toISOString().split('T')[0] : updates.harvestDate;
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        // Recalculate derived fields if quantity, unit, or price changed
        if (updates.quantity !== undefined || updates.unit !== undefined || updates.pricePerUnit !== undefined) {
          // Get current values if not provided
          const currentItem = await db
            .select({
              quantity: basefruitPurchaseItems.quantity,
              unit: basefruitPurchaseItems.unit,
              pricePerUnit: basefruitPurchaseItems.pricePerUnit
            })
            .from(basefruitPurchaseItems)
            .where(eq(basefruitPurchaseItems.id, itemId))
            .limit(1);

          const qty = updates.quantity ?? parseFloat(currentItem[0].quantity);
          const unit = updates.unit ?? currentItem[0].unit;
          const price = updates.pricePerUnit ?? parseFloat(currentItem[0].pricePerUnit || "0");

          // Recalculate totalCost
          updateData.totalCost = (qty * price).toFixed(2);

          // Recalculate quantityKg based on unit
          let quantityKg = qty;
          if (unit === "lb") {
            quantityKg = qty * 0.453592; // lb to kg
          } else if (unit === "bushel") {
            quantityKg = qty * 19.05; // bushel to kg (42 lbs)
          }
          // kg, L, gal stay as-is
          updateData.quantityKg = quantityKg.toFixed(3);
        }

        // Update the item
        const [updatedItem] = await db
          .update(basefruitPurchaseItems)
          .set(updateData)
          .where(eq(basefruitPurchaseItems.id, itemId))
          .returning();

        // Update parent purchase's purchase date if provided
        if (updates.purchaseDate !== undefined) {
          await db
            .update(basefruitPurchases)
            .set({
              purchaseDate: updates.purchaseDate,
              updatedAt: new Date()
            })
            .where(eq(basefruitPurchases.id, existingItem[0].purchaseId));
        }

        return {
          success: true,
          message: "Base fruit purchase item updated successfully",
          item: updatedItem,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating base fruit purchase item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update base fruit purchase item",
        });
      }
    }),
});
