# Square POS Integration Setup Guide

This guide explains how to set up two-way inventory synchronization between your cidery management app and Square POS.

## Overview

The Square integration provides:
- **Bottling → Square**: When you bottle cider, it automatically updates Square inventory
- **Square → Your App**: When Square processes a sale, it automatically decrements your inventory
- **Product Mapping UI**: Admin interface to map your products to Square catalog items
- **Sync Monitoring**: Dashboard to track all sync events and troubleshoot issues

## Prerequisites

1. **Square Account**: You need an active Square account with:
   - POS system set up
   - Products created in Square catalog
   - API access enabled

2. **Square Developer Account**:
   - Go to https://developer.squareup.com/
   - Create an application
   - Get your **Access Token** and **Location ID**

3. **Webhook URL**: You'll need your deployed app URL for webhooks:
   - Production: `https://yourdomain.com/api/webhooks/square`
   - Development: Use ngrok or similar for local testing

## Step 1: Run Database Migration

Apply the Square integration migration:

```bash
pnpm db:migrate
```

This creates:
- `square_config` table for API credentials
- `square_sync_log` table for tracking sync events
- Square mapping fields on `inventory_items` table

## Step 2: Configure Square API Credentials

### Option A: Via Admin UI (Recommended)

1. Navigate to `/admin/square` in your app
2. Click "Configure Square Integration"
3. Enter:
   - **Access Token**: Your Square API access token
   - **Location ID**: Your Square location ID
   - **Environment**: `production` or `sandbox`
   - **Webhook Signature Key**: (optional, for webhook verification)
4. Click "Save Configuration"

### Option B: Direct Database Insert

If needed, you can insert configuration directly:

```sql
INSERT INTO square_config (
  access_token_encrypted,
  location_id,
  environment,
  auto_sync_enabled
) VALUES (
  'YOUR_ACCESS_TOKEN',  -- TODO: Implement encryption
  'YOUR_LOCATION_ID',
  'production',
  true
);
```

**Security Note**: In production, access tokens should be encrypted before storage. Current implementation stores them as-is for MVP. Implement encryption before going live.

## Step 3: Set Up Square Webhooks

Configure Square to send inventory events to your app:

1. Go to https://developer.squareup.com/apps
2. Select your application
3. Go to **Webhooks** section
4. Click "Add Subscription"
5. Configure:
   - **URL**: `https://yourdomain.com/api/webhooks/square`
   - **Events**: Select `inventory.count.updated`
   - **Signature Key**: Copy this and add to your Square config

6. Click "Save"

### Testing Webhooks Locally

For local development:

```bash
# Install ngrok
npm install -g ngrok

# Create tunnel
ngrok http 3001

# Use the https URL for webhook: https://abc123.ngrok.io/api/webhooks/square
```

## Step 4: Map Products

Map your bottle inventory to Square products:

1. Go to `/admin/square/mapping`
2. You'll see:
   - Left column: Your bottle inventory items
   - Right column: Square catalog products with variations

3. For each inventory item:
   - Select the matching Square product
   - Choose the correct variation (size/SKU)
   - Toggle "Sync Enabled" if needed
   - Click "Map Product"

**Important**: Each bottle size should map to a unique Square variation. For example:
- Your Product: "Batch 2024-001, 750ml" → Square: "Dry Cider 750ml"
- Your Product: "Batch 2024-001, 375ml" → Square: "Dry Cider 375ml"

## Step 5: Test the Integration

### Test Bottling → Square Sync

1. Complete a bottle run in your app
2. Check the sync log at `/admin/square/logs`
3. Verify in Square POS that inventory was updated

### Test Square → Your App Sync

1. Process a sale in Square POS
2. Check your inventory page - quantity should decrement
3. Review sync log to verify the webhook was received

## Monitoring and Troubleshooting

### Sync Dashboard

View sync statistics at `/admin/square`:
- Total syncs performed
- Success rate
- Failed syncs
- Mapped vs unmapped products

### Sync Logs

Detailed logs at `/admin/square/logs` show:
- Timestamp
- Sync direction (to_square / from_square)
- Product details
- Quantity changes
- Error messages (if failed)

### Common Issues

**Issue: "Square client not initialized"**
- Solution: Make sure you've saved Square credentials in Step 2

**Issue: "No inventory item found with Square variation ID"**
- Solution: Product mapping is missing. Complete Step 4

**Issue: "Invalid webhook signature"**
- Solution: Verify webhook signature key matches between Square dashboard and your config

**Issue: Sync succeeds but inventory not updating in Square**
- Solution: Check that `square_sync_enabled` is true for the inventory item
- Verify location ID is correct
- Ensure product exists in Square catalog

### Manual Sync

If automatic sync fails, you can manually sync from the UI:
1. Go to `/inventory`
2. Find the bottle record
3. Click "Actions" → "Sync to Square"

## Auto-Sync Behavior

### When Bottling:

After a bottle run completes:
1. Inventory items are created in database
2. System checks if each item has Square mapping
3. If mapped and `square_sync_enabled` = true:
   - Calls Square API to update inventory count
   - Logs sync event
4. If mapping missing:
   - Skip sync (log warning)
   - Admin can map later and manually sync

### When Square Sells:

When a sale processes in Square:
1. Square sends webhook to `/api/webhooks/square`
2. Webhook extracts variation ID and new quantity
3. System finds matching inventory item
4. Updates local quantity to match Square
5. Logs sync event

## Disabling Sync

### Temporary Disable
Toggle off "Auto Sync" in admin settings - keeps mappings but stops syncing

### Disable for Specific Product
Edit inventory item, set `square_sync_enabled` = false

### Complete Removal
Delete Square configuration in admin UI

## Security Considerations

1. **API Token Storage**:
   - Current: Stored in plaintext (MVP)
   - TODO: Implement encryption before production

2. **Webhook Security**:
   - Always configure signature key
   - Verify signatures on every webhook

3. **Access Control**:
   - Only admins can configure Square
   - Only admins can view sync logs
   - Operators can view inventory status

## API Endpoints

- `POST /api/trpc/square.initializeConfig` - Save Square credentials
- `GET /api/trpc/square.getCatalogItems` - Fetch Square products
- `POST /api/trpc/square.mapProduct` - Map inventory to Square product
- `POST /api/trpc/square.syncToSquare` - Manual sync trigger
- `GET /api/trpc/square.getSyncHistory` - View sync logs
- `POST /api/webhooks/square` - Receive Square webhooks

## Support

For issues:
1. Check sync logs first
2. Verify product mappings
3. Test webhook endpoint with Square dashboard
4. Review Square API documentation: https://developer.squareup.com/docs

## Development Notes

Files modified for Square integration:
- `/packages/db/migrations/0060_add_square_integration.sql` - Database schema
- `/packages/db/src/schema/square.ts` - Drizzle schema
- `/packages/api/src/lib/square-client.ts` - Square SDK client
- `/packages/api/src/lib/square-inventory-sync.ts` - Sync logic
- `/packages/api/src/routers/square.ts` - tRPC API
- `/apps/web/src/app/api/webhooks/square/route.ts` - Webhook handler
