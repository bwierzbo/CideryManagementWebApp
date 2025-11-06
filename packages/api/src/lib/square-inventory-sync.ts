/**
 * Square Inventory Sync Service
 *
 * Handles two-way inventory synchronization between cidery app and Square POS
 */

import { getSquareClient } from "./square-client";
import { db } from "db";
import { sql } from "drizzle-orm";

export interface InventorySyncResult {
  success: boolean;
  inventoryItemId: string;
  squareVariationId: string;
  quantityBefore: number;
  quantityAfter: number;
  errorMessage?: string;
}

/**
 * Sync inventory TO Square (when bottling completes)
 *
 * @param inventoryItemId - Internal inventory item ID
 * @param quantity - New quantity to set in Square
 * @param locationId - Square location ID
 * @returns Sync result with success status
 */
export async function syncInventoryToSquare(
  inventoryItemId: string,
  quantity: number,
  locationId: string
): Promise<InventorySyncResult> {
  const startTime = new Date();

  try {
    // Get inventory item with Square mapping
    const inventoryItem = await db.query.inventoryItems.findFirst({
      where: (items, { eq, and, isNull }) =>
        and(eq(items.id, inventoryItemId), isNull(items.deletedAt)),
    });

    if (!inventoryItem) {
      throw new Error(`Inventory item ${inventoryItemId} not found`);
    }

    if (!inventoryItem.squareVariationId) {
      throw new Error(
        `Inventory item ${inventoryItemId} is not mapped to a Square product. Please configure the mapping first.`
      );
    }

    if (!inventoryItem.squareSyncEnabled) {
      console.log(
        `Square sync disabled for inventory item ${inventoryItemId}, skipping sync`
      );
      return {
        success: true,
        inventoryItemId,
        squareVariationId: inventoryItem.squareVariationId,
        quantityBefore: 0,
        quantityAfter: quantity,
        errorMessage: "Sync disabled for this item",
      };
    }

    const squareClient = getSquareClient();
    const currentQuantity = inventoryItem.currentQuantity || 0;

    // Call Square Inventory API to update the count
    const response = await squareClient.inventory.batchCreateChanges({
      idempotencyKey: `sync-${inventoryItemId}-${Date.now()}`,
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physicalCount: {
            catalogObjectId: inventoryItem.squareVariationId,
            locationId: locationId,
            quantity: quantity.toString(),
            occurredAt: new Date().toISOString(),
            state: "IN_STOCK",
          },
        },
      ],
    });

    // Check for errors in the response
    const result = await response;
    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors
        .map((e: any) => e.detail || e.code)
        .join(", ");
      throw new Error(`Square API errors: ${errorMessages}`);
    }

    // Update sync timestamp in database
    await db.execute(sql`
      UPDATE inventory_items
      SET square_synced_at = NOW()
      WHERE id = ${inventoryItemId}
    `);

    // Log successful sync
    await logSync({
      direction: "to_square",
      type: "inventory_update",
      inventoryItemId,
      squareVariationId: inventoryItem.squareVariationId,
      squareCatalogItemId: inventoryItem.squareCatalogItemId,
      quantityBefore: currentQuantity,
      quantityAfter: quantity,
      squareQuantity: quantity,
      status: "success",
    });

    return {
      success: true,
      inventoryItemId,
      squareVariationId: inventoryItem.squareVariationId,
      quantityBefore: currentQuantity,
      quantityAfter: quantity,
    };
  } catch (error: any) {
    console.error("Error syncing inventory to Square:", error);

    // Log failed sync
    await logSync({
      direction: "to_square",
      type: "inventory_update",
      inventoryItemId,
      squareVariationId: "",
      quantityBefore: 0,
      quantityAfter: quantity,
      status: "failed",
      errorMessage: error.message || "Unknown error",
    });

    return {
      success: false,
      inventoryItemId,
      squareVariationId: "",
      quantityBefore: 0,
      quantityAfter: quantity,
      errorMessage: error.message || "Failed to sync to Square",
    };
  }
}

/**
 * Sync inventory FROM Square (when Square webhook notifies of change)
 *
 * @param squareVariationId - Square catalog variation ID
 * @param newQuantity - New quantity from Square
 * @param eventId - Square event ID for idempotency
 * @returns Sync result
 */
export async function syncInventoryFromSquare(
  squareVariationId: string,
  newQuantity: number,
  eventId?: string
): Promise<InventorySyncResult> {
  try {
    // Find inventory item by Square variation ID
    const inventoryItem = await db.query.inventoryItems.findFirst({
      where: (items, { eq, and, isNull }) =>
        and(
          eq(items.squareVariationId, squareVariationId),
          isNull(items.deletedAt)
        ),
    });

    if (!inventoryItem) {
      throw new Error(
        `No inventory item found with Square variation ID: ${squareVariationId}`
      );
    }

    const currentQuantity = inventoryItem.currentQuantity || 0;

    // Update inventory quantity in database
    await db.execute(sql`
      UPDATE inventory_items
      SET current_quantity = ${newQuantity},
          square_synced_at = NOW()
      WHERE id = ${inventoryItem.id}
    `);

    // Log successful sync
    await logSync({
      direction: "from_square",
      type: "webhook",
      inventoryItemId: inventoryItem.id,
      squareVariationId,
      squareCatalogItemId: inventoryItem.squareCatalogItemId,
      quantityBefore: currentQuantity,
      quantityAfter: newQuantity,
      squareQuantity: newQuantity,
      status: "success",
      squareEventId: eventId,
    });

    return {
      success: true,
      inventoryItemId: inventoryItem.id,
      squareVariationId,
      quantityBefore: currentQuantity,
      quantityAfter: newQuantity,
    };
  } catch (error: any) {
    console.error("Error syncing inventory from Square:", error);

    // Log failed sync
    await logSync({
      direction: "from_square",
      type: "webhook",
      squareVariationId,
      quantityAfter: newQuantity,
      status: "failed",
      errorMessage: error.message || "Unknown error",
      squareEventId: eventId,
    });

    return {
      success: false,
      inventoryItemId: "",
      squareVariationId,
      quantityBefore: 0,
      quantityAfter: newQuantity,
      errorMessage: error.message || "Failed to sync from Square",
    };
  }
}

/**
 * Log a sync event to square_sync_log table
 */
interface LogSyncParams {
  direction: "to_square" | "from_square";
  type: "inventory_update" | "product_mapping" | "manual_sync" | "webhook";
  inventoryItemId?: string;
  squareVariationId?: string;
  squareCatalogItemId?: string | null;
  quantityBefore?: number;
  quantityAfter?: number;
  squareQuantity?: number;
  status: "pending" | "success" | "failed" | "retrying";
  errorMessage?: string;
  squareEventId?: string;
  squareEventType?: string;
  webhookPayload?: any;
}

async function logSync(params: LogSyncParams) {
  try {
    await db.execute(sql`
      INSERT INTO square_sync_log (
        sync_direction,
        sync_type,
        inventory_item_id,
        square_variation_id,
        square_catalog_item_id,
        quantity_before,
        quantity_after,
        square_quantity,
        status,
        error_message,
        square_event_id,
        square_event_type,
        webhook_payload,
        completed_at
      ) VALUES (
        ${params.direction},
        ${params.type},
        ${params.inventoryItemId || null},
        ${params.squareVariationId || null},
        ${params.squareCatalogItemId || null},
        ${params.quantityBefore || null},
        ${params.quantityAfter || null},
        ${params.squareQuantity || null},
        ${params.status},
        ${params.errorMessage || null},
        ${params.squareEventId || null},
        ${params.squareEventType || null},
        ${params.webhookPayload ? JSON.stringify(params.webhookPayload) : null},
        ${params.status === "success" || params.status === "failed" ? sql`NOW()` : null}
      )
    `);
  } catch (error) {
    console.error("Failed to log sync event:", error);
    // Don't throw - logging failure shouldn't break sync
  }
}

/**
 * Get Square catalog items (products) for mapping UI
 */
export async function getSquareCatalogItems(locationId: string) {
  const squareClient = getSquareClient();

  // catalog.list returns a Page iterator
  const responsePage = await squareClient.catalog.list({ types: "ITEM" });

  // Collect all items from the paginated response
  const items: any[] = [];
  for await (const item of responsePage) {
    items.push(item);
  }

  // Transform to simpler format for UI
  return items.map((item: any) => {
    const itemData = item.itemData;
    const variations = itemData?.variations || [];

    return {
      id: item.id,
      name: itemData?.name || "Unnamed Product",
      description: itemData?.description,
      variations: variations.map((v: any) => ({
        id: v.id,
        name: v.itemVariationData?.name || "Default",
        sku: v.itemVariationData?.sku,
        price: v.itemVariationData?.priceMoney?.amount
          ? Number(v.itemVariationData.priceMoney.amount) / 100
          : 0,
      })),
    };
  });
}
