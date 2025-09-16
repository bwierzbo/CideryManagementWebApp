#!/usr/bin/env tsx

import 'dotenv/config'
import { db } from './index'
import { purchases, purchaseItems, vendorVarieties } from './schema'
import { sql } from 'drizzle-orm'

/**
 * Backfill vendor_varieties from existing purchase_items data
 * This populates the vendor_varieties join table based on which varieties each vendor has sold
 */
async function backfillVendorVarieties() {
  console.log('Starting vendor_varieties backfill...')

  try {
    // Insert vendor-variety relationships based on existing purchase data
    // Use DISTINCT to avoid duplicates if a vendor has sold the same variety multiple times
    const result = await db.execute(sql`
      INSERT INTO vendor_varieties (vendor_id, variety_id, notes, created_at, updated_at)
      SELECT DISTINCT
          p.vendor_id,
          pi.apple_variety_id,
          'Auto-generated from existing purchase data' as notes,
          NOW() as created_at,
          NOW() as updated_at
      FROM purchases p
      INNER JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.vendor_id IS NOT NULL
        AND pi.apple_variety_id IS NOT NULL
        AND p.deleted_at IS NULL
        AND pi.deleted_at IS NULL
      ON CONFLICT (vendor_id, variety_id) DO NOTHING
    `)

    console.log(`✅ Backfill completed. Vendor-variety relationships created.`)

    // Count the total relationships
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM vendor_varieties
      WHERE notes = 'Auto-generated from existing purchase data'
    `)

    const total = countResult.rows[0]?.total || 0
    console.log(`📊 Total auto-generated vendor-variety relationships: ${total}`)

    // Show some sample data
    const sampleResult = await db.execute(sql`
      SELECT
        v.name as vendor_name,
        av.name as variety_name,
        vv.created_at
      FROM vendor_varieties vv
      JOIN vendors v ON vv.vendor_id = v.id
      JOIN apple_varieties av ON vv.variety_id = av.id
      WHERE vv.notes = 'Auto-generated from existing purchase data'
      ORDER BY vv.created_at DESC
      LIMIT 5
    `)

    console.log('\n📋 Sample vendor-variety relationships:')
    for (const row of sampleResult.rows) {
      console.log(`  • ${row.vendor_name} → ${row.variety_name}`)
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  }
}

// Run the backfill
backfillVendorVarieties()
  .then(() => {
    console.log('\n✨ Backfill completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Backfill failed:', error)
    process.exit(1)
  })