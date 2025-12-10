/**
 * Square POS Integration Router
 *
 * Provides tRPC procedures for Square inventory sync and product mapping
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db, inventoryItems, squareConfig, squareSyncLog, bottleRuns } from "db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  initializeSquareClient,
  getSquareClient,
  isSquareClientInitialized,
} from "../lib/square-client";
import {
  syncInventoryToSquare,
  syncInventoryFromSquare,
  getSquareCatalogItems,
  getSquareCategories,
} from "../lib/square-inventory-sync";

export const squareRouter = router({
  /**
   * Get Square configuration status
   * Returns whether Square is configured and enabled
   */
  getConfig: adminProcedure.query(async () => {
    const config = await db.query.squareConfig.findFirst();

    // Initialize client from stored config if not already initialized
    if (config?.accessTokenEncrypted && !isSquareClientInitialized()) {
      try {
        initializeSquareClient(
          config.accessTokenEncrypted,
          config.environment || "production"
        );
      } catch (error) {
        console.error("Failed to initialize Square client from stored config:", error);
      }
    }

    return {
      configured: !!config?.accessTokenEncrypted,
      enabled: config?.autoSyncEnabled ?? false,
      locationId: config?.locationId,
      environment: config?.environment,
      lastFullSync: config?.lastFullSyncAt,
      initialized: isSquareClientInitialized(),
    };
  }),

  /**
   * Initialize Square configuration
   * Stores encrypted access token and initializes Square client
   */
  initializeConfig: adminProcedure
    .input(
      z.object({
        accessToken: z.string().min(1, "Access token is required"),
        locationId: z.string().min(1, "Location ID is required"),
        environment: z.enum(["production", "sandbox"]).default("production"),
        webhookSignatureKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Initialize Square client
        initializeSquareClient(input.accessToken, input.environment);

        // Verify token works by making a test API call
        const squareClient = getSquareClient();
        const locationResponse = await squareClient.locations.get({
          locationId: input.locationId
        });

        const result = await locationResponse;
        if (result.errors?.length) {
          throw new Error(
            `Invalid Square credentials: ${result.errors[0]?.detail}`
          );
        }

        // TODO: Encrypt the access token before storing
        // For now, storing as-is (should implement encryption in production)
        const accessTokenEncrypted = input.accessToken;

        // Check if config exists
        const existingConfig = await db.query.squareConfig.findFirst();

        if (existingConfig) {
          // Update existing config
          await db
            .update(squareConfig)
            .set({
              accessTokenEncrypted,
              locationId: input.locationId,
              environment: input.environment,
              webhookSignatureKey: input.webhookSignatureKey,
              updatedAt: new Date(),
              updatedBy: ctx.session?.user?.id,
            })
            .where(eq(squareConfig.id, existingConfig.id));
        } else {
          // Create new config
          await db.insert(squareConfig).values({
            accessTokenEncrypted,
            locationId: input.locationId,
            environment: input.environment,
            webhookSignatureKey: input.webhookSignatureKey,
            autoSyncEnabled: true,
            createdBy: ctx.session?.user?.id,
            updatedBy: ctx.session?.user?.id,
          });
        }

        return {
          success: true,
          message: "Square configuration saved successfully",
        };
      } catch (error: any) {
        console.error("Error initializing Square config:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to initialize Square configuration",
        });
      }
    }),

  /**
   * Toggle auto-sync on/off
   */
  toggleAutoSync: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const config = await db.query.squareConfig.findFirst();

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Square not configured. Please initialize first.",
        });
      }

      await db
        .update(squareConfig)
        .set({
          autoSyncEnabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(squareConfig.id, config.id));

      return {
        success: true,
        enabled: input.enabled,
      };
    }),

  /**
   * Get Square catalog categories for filtering
   */
  getCategories: adminProcedure.query(async () => {
    try {
      const config = await db.query.squareConfig.findFirst();

      if (!config?.accessTokenEncrypted) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Square not configured. Please set up Square integration first.",
        });
      }

      if (!isSquareClientInitialized()) {
        initializeSquareClient(
          config.accessTokenEncrypted,
          config.environment || "production"
        );
      }

      const categories = await getSquareCategories();
      return { categories };
    } catch (error: any) {
      console.error("Error fetching Square categories:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch Square categories",
      });
    }
  }),

  /**
   * Get Square catalog items for product mapping
   */
  getCatalogItems: adminProcedure
    .input(
      z.object({
        categoryIds: z.array(z.string()).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
    try {
      const config = await db.query.squareConfig.findFirst();

      if (!config?.locationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Square not configured. Please set up Square integration first.",
        });
      }

      if (!isSquareClientInitialized()) {
        // Initialize client from stored config
        if (!config.accessTokenEncrypted) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Square access token not found",
          });
        }
        initializeSquareClient(
          config.accessTokenEncrypted,
          config.environment || "production"
        );
      }

      const catalogItems = await getSquareCatalogItems(
        config.locationId,
        input?.categoryIds
      );

      return {
        items: catalogItems,
        locationId: config.locationId,
      };
    } catch (error: any) {
      console.error("Error fetching Square catalog:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch Square catalog",
      });
    }
  }),

  /**
   * Map inventory item to Square product
   */
  mapProduct: adminProcedure
    .input(
      z.object({
        inventoryItemId: z.string().uuid(),
        squareCatalogItemId: z.string(),
        squareVariationId: z.string(),
        syncEnabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Update inventory item with Square mapping
        await db
          .update(inventoryItems)
          .set({
            squareCatalogItemId: input.squareCatalogItemId,
            squareVariationId: input.squareVariationId,
            squareSyncEnabled: input.syncEnabled,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, input.inventoryItemId));

        // Log the mapping event
        await db.insert(squareSyncLog).values({
          syncDirection: "to_square",
          syncType: "product_mapping",
          inventoryItemId: input.inventoryItemId,
          squareCatalogItemId: input.squareCatalogItemId,
          squareVariationId: input.squareVariationId,
          status: "success",
        });

        return {
          success: true,
          message: "Product mapped successfully",
        };
      } catch (error: any) {
        console.error("Error mapping product:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to map product",
        });
      }
    }),

  /**
   * Get inventory items with their Square mappings
   */
  getInventoryMappings: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          onlyUnmapped: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { limit = 50, offset = 0, onlyUnmapped = false } = input || {};

      const items = await db
        .select({
          id: inventoryItems.id,
          lotCode: inventoryItems.lotCode,
          batchId: inventoryItems.batchId,
          packageType: inventoryItems.packageType,
          packageSizeML: inventoryItems.packageSizeML,
          currentQuantity: inventoryItems.currentQuantity,
          squareCatalogItemId: inventoryItems.squareCatalogItemId,
          squareVariationId: inventoryItems.squareVariationId,
          squareSyncEnabled: inventoryItems.squareSyncEnabled,
          squareSyncedAt: inventoryItems.squareSyncedAt,
          productName: bottleRuns.productName,
        })
        .from(inventoryItems)
        .leftJoin(bottleRuns, eq(inventoryItems.bottleRunId, bottleRuns.id))
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            onlyUnmapped ? isNull(inventoryItems.squareVariationId) : undefined
          )
        )
        .orderBy(desc(inventoryItems.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            onlyUnmapped ? isNull(inventoryItems.squareVariationId) : undefined
          )
        );

      return {
        items,
        total: totalCount[0]?.count || 0,
        hasMore: offset + limit < (totalCount[0]?.count || 0),
      };
    }),

  /**
   * Manually sync inventory to Square
   */
  syncToSquare: adminProcedure
    .input(
      z.object({
        inventoryItemId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const config = await db.query.squareConfig.findFirst();

        if (!config?.locationId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Square not configured",
          });
        }

        if (!isSquareClientInitialized()) {
          initializeSquareClient(
            config.accessTokenEncrypted || "",
            config.environment || "production"
          );
        }

        const item = await db.query.inventoryItems.findFirst({
          where: eq(inventoryItems.id, input.inventoryItemId),
        });

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Inventory item not found",
          });
        }

        const quantity = item.currentQuantity || 0;
        const result = await syncInventoryToSquare(
          input.inventoryItemId,
          quantity,
          config.locationId
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.errorMessage || "Sync failed",
          });
        }

        return result;
      } catch (error: any) {
        console.error("Error syncing to Square:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to sync inventory",
        });
      }
    }),

  /**
   * Get sync history/logs
   */
  getSyncHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          inventoryItemId: z.string().uuid().optional(),
          status: z.enum(["pending", "success", "failed", "retrying"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { limit = 50, offset = 0, inventoryItemId, status } = input || {};

      const logs = await db
        .select()
        .from(squareSyncLog)
        .where(
          and(
            inventoryItemId
              ? eq(squareSyncLog.inventoryItemId, inventoryItemId)
              : undefined,
            status ? eq(squareSyncLog.status, status) : undefined
          )
        )
        .orderBy(desc(squareSyncLog.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(squareSyncLog)
        .where(
          and(
            inventoryItemId
              ? eq(squareSyncLog.inventoryItemId, inventoryItemId)
              : undefined,
            status ? eq(squareSyncLog.status, status) : undefined
          )
        );

      return {
        logs,
        total: totalCount[0]?.count || 0,
        hasMore: offset + limit < (totalCount[0]?.count || 0),
      };
    }),

  /**
   * Get sync statistics
   */
  getSyncStats: protectedProcedure.query(async () => {
    const [
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      mappedItems,
      unmappedItems,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(squareSyncLog),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(squareSyncLog)
        .where(eq(squareSyncLog.status, "success")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(squareSyncLog)
        .where(eq(squareSyncLog.status, "failed")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            sql`${inventoryItems.squareVariationId} IS NOT NULL`
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            isNull(inventoryItems.squareVariationId)
          )
        ),
    ]);

    return {
      totalSyncs: totalSyncs[0]?.count || 0,
      successfulSyncs: successfulSyncs[0]?.count || 0,
      failedSyncs: failedSyncs[0]?.count || 0,
      successRate:
        totalSyncs[0]?.count > 0
          ? ((successfulSyncs[0]?.count || 0) / totalSyncs[0].count) * 100
          : 0,
      mappedItems: mappedItems[0]?.count || 0,
      unmappedItems: unmappedItems[0]?.count || 0,
    };
  }),
});
