import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Un-delete the Nourish Perry and Perry Pear batches so they appear
 * on the reconciliation list as tracked production batches.
 *
 * These were real pressed batches that transferred juice into Perry #1/#2.
 * They were deleted during cleanup but their transfers remain.
 */

const L_PER_GAL = 3.78541;

async function main() {
  console.log("=== Un-delete Perry Source Batches ===\n");

  // Find all deleted Nourish Perry and Perry Pear batches
  const deleted = await db.execute(sql`
    SELECT id, custom_name, batch_number,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           product_type, start_date, deleted_at,
           reconciliation_status
    FROM batches
    WHERE (custom_name LIKE '%Nourish Perry%' OR custom_name LIKE '%Perry Pear%')
      AND deleted_at IS NOT NULL
    ORDER BY start_date
  `);

  const rows = deleted.rows as any[];
  console.log(`Found ${rows.length} deleted batch(es):\n`);

  for (const b of rows) {
    console.log(`  ${b.custom_name} [${b.id.slice(0, 8)}]`);
    console.log(`    init=${b.init_vol}L | current=${b.current_vol}L | type=${b.product_type}`);
    console.log(`    started=${b.start_date} | deleted=${b.deleted_at}`);
    console.log(`    reconciliation_status=${b.reconciliation_status}`);

    // Check what transfers this batch has
    const tOut = await db.execute(sql`
      SELECT t.id, t.destination_batch_id,
             CAST(t.volume_transferred AS TEXT) as vol,
             t.transferred_at, t.deleted_at as t_deleted,
             db2.custom_name as dst_name
      FROM batch_transfers t
      LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
      WHERE t.source_batch_id = ${b.id}
      ORDER BY t.transferred_at
    `);
    console.log(`    Transfers OUT:`);
    for (const t of tOut.rows as any[]) {
      const del = t.t_deleted ? " [DELETED]" : "";
      console.log(`      → ${t.dst_name} | ${t.vol}L | ${t.transferred_at}${del}`);
    }
    console.log();
  }

  // Un-delete them
  console.log("--- Un-deleting ---\n");
  for (const b of rows) {
    await db.execute(sql`
      UPDATE batches
      SET deleted_at = NULL,
          reconciliation_status = 'verified',
          updated_at = NOW()
      WHERE id = ${b.id}
    `);
    console.log(`  ✓ ${b.custom_name} [${b.id.slice(0, 8)}] — un-deleted, set to verified`);
  }

  // Also un-delete any soft-deleted transfers FROM these batches
  // (the transfers to Perry #1/#2 that are still active)
  console.log("\n--- Checking transfers ---\n");
  for (const b of rows) {
    const deletedTransfers = await db.execute(sql`
      SELECT t.id, CAST(t.volume_transferred AS TEXT) as vol,
             db2.custom_name as dst_name, t.deleted_at
      FROM batch_transfers t
      LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
      WHERE t.source_batch_id = ${b.id}
        AND t.deleted_at IS NOT NULL
    `);
    for (const t of deletedTransfers.rows as any[]) {
      console.log(`  Found deleted transfer: ${b.custom_name} → ${t.dst_name} (${t.vol}L)`);
      console.log(`    This was already deleted — keeping as-is (volume absorbed into destination init)`);
    }

    const activeTransfers = await db.execute(sql`
      SELECT t.id, CAST(t.volume_transferred AS TEXT) as vol,
             db2.custom_name as dst_name
      FROM batch_transfers t
      LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
      WHERE t.source_batch_id = ${b.id}
        AND t.deleted_at IS NULL
    `);
    for (const t of activeTransfers.rows as any[]) {
      console.log(`  Active transfer: ${b.custom_name} → ${t.dst_name} (${t.vol}L) — good, matches the unmatched IN`);
    }
  }

  // Verify
  console.log("\n--- Verification ---\n");
  const verify = await db.execute(sql`
    SELECT id, custom_name,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           deleted_at, reconciliation_status
    FROM batches
    WHERE (custom_name LIKE '%Nourish Perry%' OR custom_name LIKE '%Perry Pear%')
    ORDER BY start_date
  `);
  for (const b of verify.rows as any[]) {
    const init = parseFloat(b.init_vol);
    console.log(`  ${b.custom_name} | init=${b.init_vol}L (${(init / L_PER_GAL).toFixed(1)} gal) | current=${b.current_vol}L | deleted=${b.deleted_at || "NO"} | recon=${b.reconciliation_status}`);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
