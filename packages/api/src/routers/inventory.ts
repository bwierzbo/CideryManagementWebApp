import { z } from "zod";
import { router, createRbacProcedure, protectedProcedure } from "../trpc";
import {
  db,
  // inventory, inventoryTransactions, packages - dropped in migration 0024
  appleVarieties,
  vendors,
  auditLogs,
  basefruitPurchases,
  basefruitPurchaseItems,
  baseFruitVarieties,
  additivePurchases,
  additivePurchaseItems,
  additiveVarieties,
  juicePurchases,
  juicePurchaseItems,
  packagingPurchases,
  packagingPurchaseItems,
  packagingVarieties,
  // Finished goods inventory
  inventoryItems,
  inventoryDistributions,
  inventoryAdjustments,
  // Batches
  batches,
  // Sales channels for TTB reporting
  salesChannels,
} from "db";
import { eq, and, desc, asc, like, or, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  inventoryTransactionSchema,
  recordTransactionSchema,
  createInventoryItemSchema,
  createInventoryTransactionSchema,
  inventoryListSchema,
  inventorySearchSchema,
  materialTypeEnum,
  type InventoryTransaction,
  type RecordTransactionInput,
  type CreateInventoryTransactionInput,
} from "../types/inventory";
import { InventoryService } from "../services/inventory";

// Note: Helper functions moved to InventoryService for better organization and reusability

export const inventoryRouter = router({
  // List inventory items - accessible by both admin and operator
  list: protectedProcedure
    .input(inventoryListSchema)
    .query(async ({ input }) => {
      // TODO: Temporarily show purchase items as inventory until proper inventory system is ready
      try {
        const { limit = 50, offset = 0 } = input;

        // Get all purchase items as unified inventory

        // Base Fruit purchases
        const basefruitItems = await db
          .select({
            id: sql<string>`CONCAT('basefruit-', ${basefruitPurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${basefruitPurchaseItems.quantity} AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`0`,
            materialType: sql<string>`'apple'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${basefruitPurchases.id},
              'vendorName', ${vendors.name},
              'varietyName', ${baseFruitVarieties.name},
              'harvestDate', ${basefruitPurchaseItems.harvestDate},
              'purchaseDate', ${basefruitPurchases.purchaseDate},
              'unit', ${basefruitPurchaseItems.unit},
              'quantity', ${basefruitPurchaseItems.quantity},
              'pricePerUnit', ${basefruitPurchaseItems.pricePerUnit},
              'totalCost', ${basefruitPurchaseItems.totalCost}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: basefruitPurchaseItems.notes,
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
              eq(basefruitPurchaseItems.isDepleted, false),
            ),
          );

        // Additive purchases
        const additiveItems = await db
          .select({
            id: sql<string>`CONCAT('additive-', ${additivePurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${additivePurchaseItems.quantity} AS NUMERIC) - CAST(COALESCE(${additivePurchaseItems.quantityUsed}, 0) AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`CAST(COALESCE(${additivePurchaseItems.quantityUsed}, 0) AS NUMERIC)`,
            materialType: sql<string>`'additive'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${additivePurchases.id},
              'vendorName', ${vendors.name},
              'varietyName', COALESCE(${additiveVarieties.name}, ${additivePurchaseItems.additiveType}),
              'varietyType', COALESCE(${additiveVarieties.itemType}, ${additivePurchaseItems.additiveType}),
              'brandManufacturer', ${additivePurchaseItems.brandManufacturer},
              'productName', CASE
                WHEN ${additivePurchaseItems.productName} LIKE '%(%'
                THEN TRIM(SUBSTRING(${additivePurchaseItems.productName} FROM 1 FOR POSITION('(' IN ${additivePurchaseItems.productName}) - 1))
                ELSE ${additivePurchaseItems.productName}
              END,
              'unit', ${additivePurchaseItems.unit},
              'quantity', ${additivePurchaseItems.quantity},
              'pricePerUnit', ${additivePurchaseItems.pricePerUnit},
              'unitCost', ${additivePurchaseItems.pricePerUnit},
              'totalCost', ${additivePurchaseItems.totalCost},
              'purchaseDate', ${additivePurchases.purchaseDate}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: additivePurchaseItems.notes,
            createdAt: additivePurchases.purchaseDate,
            updatedAt: additivePurchases.updatedAt,
          })
          .from(additivePurchaseItems)
          .leftJoin(
            additivePurchases,
            eq(additivePurchaseItems.purchaseId, additivePurchases.id),
          )
          .leftJoin(vendors, eq(additivePurchases.vendorId, vendors.id))
          .leftJoin(
            additiveVarieties,
            eq(additivePurchaseItems.additiveVarietyId, additiveVarieties.id),
          )
          .where(isNull(additivePurchaseItems.deletedAt));

        // Juice purchases
        const juiceItems = await db
          .select({
            id: sql<string>`CONCAT('juice-', ${juicePurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${juicePurchaseItems.volume} AS NUMERIC) - CAST(COALESCE(${juicePurchaseItems.volumeAllocated}, 0) AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`CAST(COALESCE(${juicePurchaseItems.volumeAllocated}, 0) AS NUMERIC)`,
            materialType: sql<string>`'juice'`,
            metadata: sql<unknown>`json_build_object(
              'itemId', ${juicePurchaseItems.id},
              'purchaseId', ${juicePurchases.id},
              'vendorName', ${vendors.name},
              'juiceType', ${juicePurchaseItems.juiceType},
              'varietyName', ${juicePurchaseItems.varietyName},
              'brix', ${juicePurchaseItems.brix},
              'specificGravity', ${juicePurchaseItems.specificGravity},
              'ph', ${juicePurchaseItems.ph},
              'containerType', ${juicePurchaseItems.containerType},
              'unit', 'L',
              'quantity', ${juicePurchaseItems.volume},
              'pricePerUnit', ${juicePurchaseItems.pricePerLiter},
              'totalCost', ${juicePurchaseItems.totalCost},
              'purchaseDate', ${juicePurchases.purchaseDate}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: juicePurchaseItems.notes,
            createdAt: juicePurchases.purchaseDate,
            updatedAt: juicePurchases.updatedAt,
          })
          .from(juicePurchaseItems)
          .leftJoin(
            juicePurchases,
            eq(juicePurchaseItems.purchaseId, juicePurchases.id),
          )
          .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
          .where(isNull(juicePurchaseItems.deletedAt));

        // Packaging purchases
        const packagingItems = await db
          .select({
            id: sql<string>`CONCAT('packaging-', ${packagingPurchaseItems.id})`,
            packageId: sql<string | null>`NULL`,
            currentBottleCount: sql<number>`COALESCE(CAST(${packagingPurchaseItems.quantity} AS NUMERIC) - CAST(COALESCE(${packagingPurchaseItems.quantityUsed}, 0) AS NUMERIC), 0)`,
            reservedBottleCount: sql<number>`CAST(COALESCE(${packagingPurchaseItems.quantityUsed}, 0) AS NUMERIC)`,
            materialType: sql<string>`'packaging'`,
            metadata: sql<unknown>`json_build_object(
              'purchaseId', ${packagingPurchases.id},
              'vendorName', ${vendors.name},
              'varietyName', ${packagingVarieties.name},
              'packageType', ${packagingPurchaseItems.packageType},
              'materialType', ${packagingPurchaseItems.materialType},
              'size', ${packagingPurchaseItems.size},
              'unit', 'units',
              'quantity', ${packagingPurchaseItems.quantity},
              'pricePerUnit', ${packagingPurchaseItems.pricePerUnit},
              'totalCost', ${packagingPurchaseItems.totalCost},
              'purchaseDate', ${packagingPurchases.purchaseDate}
            )`,
            location: sql<string | null>`'warehouse'`,
            notes: packagingPurchaseItems.notes,
            createdAt: packagingPurchases.purchaseDate,
            updatedAt: packagingPurchases.updatedAt,
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
          .where(isNull(packagingPurchaseItems.deletedAt));

        // Combine all items and sort by creation date
        const allItems = [
          ...basefruitItems,
          ...additiveItems,
          ...juiceItems,
          ...packagingItems,
        ].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        // Apply pagination to results
        const paginatedItems = allItems.slice(offset, offset + limit);
        const totalCount = allItems.length;

        return {
          items: paginatedItems,
          pagination: {
            total: totalCount,
            offset,
            limit,
            hasMore: totalCount > offset + limit,
          },
        };
      } catch (error) {
        console.error("Error listing inventory (purchase items):", error);
        // Fallback to empty list if there's an error
        return {
          items: [],
          pagination: {
            total: 0,
            offset: 0,
            limit: input.limit || 50,
            hasMore: false,
          },
        };
      }

      // Unreachable code below - keeping commented for future reference
      // const { materialType, location, isActive, limit, offset } = input

      // let query = db
      //   .select({
      //     id: inventory.id,
      //     packageId: inventory.packageId,
      //     currentBottleCount: inventory.currentBottleCount,
      //     reservedBottleCount: inventory.reservedBottleCount,
      //     // materialType: inventory.materialType, // TODO: Re-enable after database migration
      //     metadata: inventory.metadata,
      //     location: inventory.location,
      //     notes: inventory.notes,
      //     createdAt: inventory.createdAt,
      //     updatedAt: inventory.updatedAt,
      //   })
      //   .from(inventory)

      // // Apply filters
      // const conditions = []

      // if (materialType) {
      //   conditions.push(eq(inventory.materialType, materialType))
      // }

      // if (location) {
      //   conditions.push(like(inventory.location, `%${location}%`))
      // }

      // if (isActive) {
      //   conditions.push(isNull(inventory.deletedAt))
      // }

      // if (conditions.length > 0) {
      //   query = query.where(and(...conditions))
      // }

      // const inventoryItems = await query
      //   .orderBy(desc(inventory.createdAt))
      //   .limit(limit)
      //   .offset(offset)

      // const totalCount = await db
      //   .select({ count: sql<number>`count(*)` })
      //   .from(inventory)
      //   .where(conditions.length > 0 ? and(...conditions) : undefined)

      // return {
      //   items: inventoryItems,
      //   pagination: {
      //     total: totalCount[0]?.count || 0,
      //     limit,
      //     offset,
      //     hasMore: (totalCount[0]?.count || 0) > offset + limit
      //   }
      // }
    }),

  // DROPPED: getById procedure removed - uses dropped inventory table
  // TODO: Implement when proper inventory system is ready

  // DROPPED: search procedure removed - uses dropped inventory table
  // TODO: Implement when proper inventory system is ready

  // Record inventory transaction - accessible by both admin and operator
  // Uses the comprehensive service layer for enhanced validation and business logic
  recordTransaction: createRbacProcedure("create", "inventory")
    .input(recordTransactionSchema)
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.recordTransaction(
        input,
        ctx.session?.user?.id,
      );
    }),

  // Create new inventory item with material-specific data - accessible by both admin and operator
  createInventoryItem: createRbacProcedure("create", "inventory")
    .input(createInventoryTransactionSchema)
    .mutation(async ({ input, ctx }) => {
      // Convert the transaction schema to service parameters
      const createParams = {
        materialType: input.materialType,
        initialQuantity: input.quantityChange,
        metadata: {
          transactionData: input,
        },
        location: (input as any).storageLocation || (input as any).location,
        notes: input.notes,
      };

      return await InventoryService.createInventoryItem(
        createParams,
        input,
        ctx.session?.user?.id,
      );
    }),

  // Bulk transfer items between locations - accessible by both admin and operator
  bulkTransfer: createRbacProcedure("create", "inventory")
    .input(
      z.object({
        inventoryIds: z
          .array(z.string().uuid())
          .min(1, "At least one inventory ID required"),
        fromLocation: z.string().min(1, "From location is required"),
        toLocation: z.string().min(1, "To location is required"),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.bulkTransfer(
        input.inventoryIds,
        input.fromLocation,
        input.toLocation,
        input.reason,
        ctx.session?.user?.id,
      );
    }),

  // Check stock levels for low inventory - accessible by both admin and operator
  checkStockLevels: createRbacProcedure("list", "inventory")
    .input(
      z.object({
        materialType: materialTypeEnum.optional(),
        location: z.string().optional(),
        minimumThreshold: z.number().int().positive().default(10),
      }),
    )
    .query(async ({ input }) => {
      return await InventoryService.checkStockLevels(
        input.materialType,
        input.location,
        input.minimumThreshold,
      );
    }),

  // Reserve inventory for upcoming operations - accessible by both admin and operator
  reserveInventory: createRbacProcedure("create", "inventory")
    .input(
      z.object({
        inventoryId: z.string().uuid("Invalid inventory ID"),
        reserveQuantity: z
          .number()
          .int()
          .positive("Reserve quantity must be positive"),
        reason: z.string().min(1, "Reason is required for reservations"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.reserveInventory(
        input.inventoryId,
        input.reserveQuantity,
        input.reason,
        ctx.session?.user?.id,
      );
    }),

  // Release reserved inventory - accessible by both admin and operator
  releaseReservation: createRbacProcedure("create", "inventory")
    .input(
      z.object({
        inventoryId: z.string().uuid("Invalid inventory ID"),
        releaseQuantity: z
          .number()
          .int()
          .positive("Release quantity must be positive"),
        reason: z
          .string()
          .min(1, "Reason is required for reservation releases"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await InventoryService.releaseReservation(
        input.inventoryId,
        input.releaseQuantity,
        input.reason,
        ctx.session?.user?.id,
      );
    }),

  // DROPPED: getTransactionHistory procedure removed - uses dropped inventoryTransactions table
  // TODO: Implement when proper inventory system is ready

  // DROPPED: getSummaryByMaterialType procedure removed - uses dropped inventory table
  // TODO: Implement when proper inventory system is ready

  // Get transaction summary for inventory items - accessible by both admin and operator
  getTransactionSummary: createRbacProcedure("read", "inventory")
    .input(
      z.object({
        inventoryIds: z
          .array(z.string().uuid())
          .min(1, "At least one inventory ID required"),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await InventoryService.getTransactionSummary(
        input.inventoryIds,
        input.startDate,
        input.endDate,
      );
    }),

  // Update base fruit purchase item
  updateBaseFruitItem: createRbacProcedure("update", "inventory")
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().or(z.string().transform((val) => parseFloat(val))).pipe(z.number().min(0)).optional(),
        unit: z.enum(["kg", "lb", "L", "gal"]).optional(),
        harvestDate: z.date().or(z.string().transform((val) => new Date(val))).optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, harvestDate, quantity, ...updateData } = input;

      await db
        .update(basefruitPurchaseItems)
        .set({
          ...updateData,
          quantity: quantity?.toString(),
          harvestDate: harvestDate
            ? harvestDate.toISOString().split("T")[0]
            : null,
          updatedAt: new Date(),
        })
        .where(eq(basefruitPurchaseItems.id, id));

      // Log audit
      await db.insert(auditLogs).values({
        tableName: "basefruit_purchase_items",
        recordId: id,
        operation: "update",
        changedBy: ctx.session?.user?.id || "system",
        newData: updateData,
      });

      return { success: true };
    }),

  // Update additive purchase item
  updateAdditiveItem: createRbacProcedure("update", "inventory")
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().min(0).optional(),
        unit: z.string().optional(),
        expirationDate: z.date().optional().nullable(),
        storageRequirements: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, expirationDate, quantity, ...updateData } = input;

      await db
        .update(additivePurchaseItems)
        .set({
          ...updateData,
          quantity: quantity?.toString(),
          expirationDate: expirationDate
            ? expirationDate.toISOString().split("T")[0]
            : null,
          updatedAt: new Date(),
        })
        .where(eq(additivePurchaseItems.id, id));

      // Log audit
      await db.insert(auditLogs).values({
        tableName: "additive_purchase_items",
        recordId: id,
        operation: "update",
        changedBy: ctx.session?.user?.id || "system",
        newData: updateData,
      });

      return { success: true };
    }),

  // Update juice purchase item
  updateJuiceItem: createRbacProcedure("update", "inventory")
    .input(
      z.object({
        id: z.string().uuid(),
        volumeL: z.number().min(0).optional(),
        specificGravity: z.number().min(0.95).max(1.2).optional().nullable(),
        ph: z.number().min(0).max(14).optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, volumeL, specificGravity, ph, ...updateData } = input;

      await db
        .update(juicePurchaseItems)
        .set({
          ...updateData,
          volume: volumeL?.toString(),
          volumeUnit: "L" as const,
          specificGravity: specificGravity?.toString(),
          ph: ph?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(juicePurchaseItems.id, id));

      // Log audit
      await db.insert(auditLogs).values({
        tableName: "juice_purchase_items",
        recordId: id,
        operation: "update",
        changedBy: ctx.session?.user?.id || "system",
        newData: updateData,
      });

      return { success: true };
    }),

  // Update packaging purchase item
  updatePackagingItem: createRbacProcedure("update", "inventory")
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().min(0).optional(),
        notes: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, quantity, ...updateData } = input;

      await db
        .update(packagingPurchaseItems)
        .set({
          ...updateData,
          quantity,
          updatedAt: new Date(),
        })
        .where(eq(packagingPurchaseItems.id, id));

      // Log audit
      await db.insert(auditLogs).values({
        tableName: "packaging_purchase_items",
        recordId: id,
        operation: "update",
        changedBy: ctx.session?.user?.id || "system",
        newData: updateData,
      });

      return { success: true };
    }),

  // Delete purchase item (soft delete using deletedAt) - accessible by admin only
  deleteItem: createRbacProcedure("delete", "inventory")
    .input(
      z.object({
        id: z.string(),
        itemType: z.enum(["basefruit", "additive", "juice", "packaging"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, itemType } = input;
      const actualId = id.startsWith(itemType + "-")
        ? id.replace(itemType + "-", "")
        : id;

      try {
        // Soft delete by setting deletedAt timestamp
        const deletedAt = new Date();

        switch (itemType) {
          case "basefruit":
            await db
              .update(basefruitPurchaseItems)
              .set({ deletedAt })
              .where(eq(basefruitPurchaseItems.id, actualId));
            break;

          case "additive":
            await db
              .update(additivePurchaseItems)
              .set({ deletedAt })
              .where(eq(additivePurchaseItems.id, actualId));
            break;

          case "juice":
            await db
              .update(juicePurchaseItems)
              .set({ deletedAt })
              .where(eq(juicePurchaseItems.id, actualId));
            break;

          case "packaging":
            await db
              .update(packagingPurchaseItems)
              .set({ deletedAt })
              .where(eq(packagingPurchaseItems.id, actualId));
            break;

          default:
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Unsupported item type: ${itemType}`,
            });
        }

        // Log audit
        await db.insert(auditLogs).values({
          tableName: `${itemType}_purchase_items`,
          recordId: actualId,
          operation: "delete",
          changedBy: ctx.session?.user?.id || "system",
          newData: { deletedAt },
        });

        return {
          success: true,
          message: `${itemType} item deleted successfully`,
        };
      } catch (error) {
        console.error("Error deleting purchase item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete item",
        });
      }
    }),

  // ==============================================
  // Finished Goods Inventory Management
  // ==============================================

  /**
   * List finished goods inventory items (bottles)
   * Returns inventory items with batch and packaging details
   */
  listFinishedGoods: createRbacProcedure("read", "package")
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
        search: z.string().optional(),
        status: z.enum(["all", "in_stock", "depleted"]).optional().default("in_stock"),
      }),
    )
    .query(async ({ input }) => {
      const { limit, offset, search, status } = input;

      // Build where conditions
      const conditions = [];

      // Filter by status
      if (status === "in_stock") {
        conditions.push(sql`${inventoryItems.currentQuantity} > 0`);
      } else if (status === "depleted") {
        conditions.push(sql`${inventoryItems.currentQuantity} = 0`);
      }

      // Filter by search term (batch name, custom name, or lot code)
      if (search && search.trim().length > 0) {
        conditions.push(
          sql`(
            ${batches.customName} ILIKE ${`%${search}%`} OR
            ${batches.name} ILIKE ${`%${search}%`} OR
            ${inventoryItems.lotCode} ILIKE ${`%${search}%`}
          )`,
        );
      }

      // Build where clause
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get inventory items with batch and bottle run details
      const items = await db
        .select({
          id: inventoryItems.id,
          lotCode: inventoryItems.lotCode,
          packageType: inventoryItems.packageType,
          packageSizeML: inventoryItems.packageSizeML,
          currentQuantity: inventoryItems.currentQuantity,
          retailPrice: inventoryItems.retailPrice,
          wholesalePrice: inventoryItems.wholesalePrice,
          expirationDate: inventoryItems.expirationDate,
          createdAt: inventoryItems.createdAt,
          updatedAt: inventoryItems.updatedAt,
          // Relations
          bottleRunId: inventoryItems.bottleRunId,
          batchId: inventoryItems.batchId,
          // Batch details
          batchName: batches.name,
          batchCustomName: batches.customName,
        })
        .from(inventoryItems)
        .leftJoin(batches, eq(inventoryItems.batchId, batches.id))
        .where(whereClause)
        .orderBy(desc(inventoryItems.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalCountResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(inventoryItems)
        .leftJoin(batches, eq(inventoryItems.batchId, batches.id))
        .where(whereClause);

      const totalCount = totalCountResult[0]?.count || 0;

      return {
        items,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      };
    }),

  /**
   * Get sales channels for dropdown selection
   */
  getSalesChannels: protectedProcedure.query(async () => {
    try {
      const channels = await db
        .select()
        .from(salesChannels)
        .where(eq(salesChannels.isActive, true))
        .orderBy(asc(salesChannels.sortOrder));

      return channels;
    } catch (error) {
      console.error("Error fetching sales channels:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch sales channels",
      });
    }
  }),

  /**
   * Distribute inventory items (finished goods)
   * Tracks sales/distributions and updates quantity
   */
  distribute: createRbacProcedure("create", "package")
    .input(
      z.object({
        inventoryItemId: z.string().uuid(),
        distributionLocation: z.string().min(1),
        salesChannelId: z.string().uuid().optional(),
        quantityDistributed: z.number().int().positive(),
        pricePerUnit: z.number().positive(),
        distributionDate: z.string().datetime(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get inventory item and validate
        const [item] = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, input.inventoryItemId))
          .limit(1);

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Inventory item not found",
          });
        }

        const currentQty = item.currentQuantity || 0;
        if (input.quantityDistributed > currentQty) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot distribute ${input.quantityDistributed} units. Only ${currentQty} available.`,
          });
        }

        // Calculate total revenue
        const totalRevenue = input.quantityDistributed * input.pricePerUnit;

        // Create distribution record and update quantity in a transaction
        await db.transaction(async (tx) => {
          // Create distribution record
          await tx.insert(inventoryDistributions).values({
            inventoryItemId: input.inventoryItemId,
            distributionDate: new Date(input.distributionDate),
            distributionLocation: input.distributionLocation,
            salesChannelId: input.salesChannelId,
            quantityDistributed: input.quantityDistributed,
            pricePerUnit: input.pricePerUnit.toString(),
            totalRevenue: totalRevenue.toString(),
            notes: input.notes,
            distributedBy: ctx.session?.user?.id || "unknown",
          });

          // Update inventory quantity
          await tx
            .update(inventoryItems)
            .set({
              currentQuantity: currentQty - input.quantityDistributed,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, input.inventoryItemId));
        });

        // Return updated item
        const [updatedItem] = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, input.inventoryItemId))
          .limit(1);

        return {
          success: true,
          item: updatedItem,
          distribution: {
            quantityDistributed: input.quantityDistributed,
            totalRevenue,
            remainingQuantity: (currentQty - input.quantityDistributed),
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error distributing inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to distribute inventory",
        });
      }
    }),

  /**
   * Get distribution history for an inventory item
   */
  getDistributions: createRbacProcedure("read", "package")
    .input(z.string().uuid())
    .query(async ({ input: inventoryItemId }) => {
      try {
        const distributions = await db
          .select()
          .from(inventoryDistributions)
          .where(eq(inventoryDistributions.inventoryItemId, inventoryItemId))
          .orderBy(desc(inventoryDistributions.distributionDate));

        return distributions;
      } catch (error) {
        console.error("Error fetching distributions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch distribution history",
        });
      }
    }),

  /**
   * Adjust inventory quantities manually
   */
  adjustInventory: createRbacProcedure("update", "package")
    .input(
      z.object({
        inventoryItemId: z.string().uuid(),
        adjustmentType: z.enum(['breakage', 'sample', 'transfer', 'correction', 'void']),
        quantityChange: z.number().int(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get inventory item
        const [item] = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, input.inventoryItemId))
          .limit(1);

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Inventory item not found",
          });
        }

        const currentQty = item.currentQuantity || 0;
        const newQty = currentQty + input.quantityChange;

        if (newQty < 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid adjustment. Would result in negative quantity (${newQty}).`,
          });
        }

        // Create adjustment record and update quantity
        await db.transaction(async (tx) => {
          // Create adjustment record
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: input.inventoryItemId,
            adjustmentType: input.adjustmentType,
            quantityChange: input.quantityChange,
            reason: input.reason,
            adjustedBy: ctx.session?.user?.id || "unknown",
            adjustedAt: new Date(),
          });

          // Update inventory quantity
          await tx
            .update(inventoryItems)
            .set({
              currentQuantity: newQty,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, input.inventoryItemId));
        });

        // Return updated item
        const [updatedItem] = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, input.inventoryItemId))
          .limit(1);

        return {
          success: true,
          item: updatedItem,
          adjustment: {
            previousQuantity: currentQty,
            quantityChange: input.quantityChange,
            newQuantity: newQty,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error adjusting inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to adjust inventory",
        });
      }
    }),

  /**
   * Update pricing for an inventory item
   */
  updatePricing: createRbacProcedure("update", "package")
    .input(
      z.object({
        inventoryItemId: z.string().uuid(),
        retailPrice: z.number().positive().optional(),
        wholesalePrice: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const updates: any = {
          updatedAt: new Date(),
        };

        if (input.retailPrice !== undefined) {
          updates.retailPrice = input.retailPrice.toString();
        }
        if (input.wholesalePrice !== undefined) {
          updates.wholesalePrice = input.wholesalePrice.toString();
        }

        await db
          .update(inventoryItems)
          .set(updates)
          .where(eq(inventoryItems.id, input.inventoryItemId));

        // Return updated item
        const [updatedItem] = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, input.inventoryItemId))
          .limit(1);

        return {
          success: true,
          item: updatedItem,
        };
      } catch (error) {
        console.error("Error updating pricing:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update pricing",
        });
      }
    }),
});
