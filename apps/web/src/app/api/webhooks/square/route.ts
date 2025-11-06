/**
 * Square Webhook Endpoint
 *
 * Receives inventory update events from Square POS and syncs to local database
 */

import { NextRequest, NextResponse } from "next/server";
import { syncInventoryFromSquare } from "api/src/lib/square-inventory-sync";
import { db } from "db";
import crypto from "crypto";

/**
 * Verify Square webhook signature
 * https://developer.squareup.com/docs/webhooks/step3validate
 */
function verifySignature(
  body: string,
  signature: string,
  signatureKey: string
): boolean {
  const hmac = crypto.createHmac("sha256", signatureKey);
  hmac.update(body);
  const hash = hmac.digest("base64");
  return hash === signature;
}

/**
 * POST handler for Square webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-square-hmacsha256-signature");

    // Get Square config for signature verification
    const config = await db.query.squareConfig.findFirst();

    if (!config) {
      console.error("Square webhook received but config not found");
      return NextResponse.json(
        { error: "Square not configured" },
        { status: 500 }
      );
    }

    // Verify signature if configured
    if (config.webhookSignatureKey && signature) {
      const isValid = verifySignature(
        body,
        signature,
        config.webhookSignatureKey
      );

      if (!isValid) {
        console.error("Invalid Square webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    const eventType = payload.type;
    const eventId = payload.event_id;

    console.log(`Square webhook received: ${eventType} (${eventId})`);

    // Handle inventory.count.updated event
    if (eventType === "inventory.count.updated") {
      const data = payload.data?.object?.inventory_counts?.[0];

      if (!data) {
        console.warn("No inventory count data in webhook payload");
        return NextResponse.json({ received: true });
      }

      const catalogObjectId = data.catalog_object_id; // This is the variation ID
      const quantity = parseInt(data.quantity || "0", 10);
      const state = data.state; // IN_STOCK, SOLD, etc.

      // Only sync IN_STOCK quantities
      if (state === "IN_STOCK") {
        const result = await syncInventoryFromSquare(
          catalogObjectId,
          quantity,
          eventId
        );

        if (!result.success) {
          console.error("Failed to sync from Square:", result.errorMessage);
          // Return 200 anyway to acknowledge receipt - we logged the error
        } else {
          console.log(
            `Successfully synced inventory from Square: ${catalogObjectId} -> ${quantity}`
          );
        }
      }
    }

    // Handle catalog.version.updated event (when products are modified)
    else if (eventType === "catalog.version.updated") {
      console.log("Catalog updated in Square, consider refreshing mappings");
      // TODO: Optionally trigger a refresh of catalog items
    }

    // Acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing Square webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for webhook verification
 * Square may send a GET request to verify the endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Square webhook endpoint is active",
  });
}
