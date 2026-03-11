import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix the Perry chain after un-deleting Perry Pear batches:
 *
 * 1. Revert Perry #1 parent init from 109.93 → 70 (remove absorbed Perry Pear volume)
 * 2. Un-delete the Perry Pear → Perry #1 parent transfers (volume flows via transfer again)
 * 3. Fix Perry Pear [ccc9fa66] current: 18.93 → 0 (transfer took all the volume)
 * 4. Un-delete "Salish - Racked 2025-03-07" (5L racking derivative, fixes last 1.3 gal)
 */

async function main() {
  console.log("=== Fix Perry Chain & Salish Racked ===\n");

  // 1. Find Perry #1 parent (the one with no parent, init=109.93)
  const perry1Parent = await db.execute(sql`
    SELECT id, custom_name, CAST(initial_volume_liters AS TEXT) as init_vol
    FROM batches
    WHERE custom_name = 'Perry #1' AND parent_batch_id IS NULL AND deleted_at IS NULL
  `);
  const p1 = (perry1Parent.rows as any[])[0];
  console.log(`Perry #1 parent [${p1.id.slice(0, 8)}]: init=${p1.init_vol}L`);
  console.log(`  Reverting init: ${p1.init_vol}L → 70L`);
  await db.execute(sql`
    UPDATE batches SET initial_volume_liters = 70, updated_at = NOW() WHERE id = ${p1.id}
  `);

  // Verify
  const p1After = await db.execute(sql`
    SELECT CAST(initial_volume_liters AS TEXT) as init_vol FROM batches WHERE id = ${p1.id}
  `);
  console.log(`  Verified: init=${(p1After.rows as any[])[0].init_vol}L\n`);

  // 2. Un-delete Perry Pear → Perry #1 parent transfers
  console.log("Un-deleting Perry Pear transfers to Perry #1 parent...");
  const perryPearTransfers = await db.execute(sql`
    SELECT t.id, sb.custom_name as src_name,
           CAST(t.volume_transferred AS TEXT) as vol,
           t.transferred_at
    FROM batch_transfers t
    JOIN batches sb ON t.source_batch_id = sb.id
    WHERE t.destination_batch_id = ${p1.id}
      AND t.deleted_at IS NOT NULL
      AND sb.custom_name = 'Perry Pear'
  `);
  for (const t of perryPearTransfers.rows as any[]) {
    console.log(`  Un-deleting: ${t.src_name} → Perry #1 | ${t.vol}L | ${t.transferred_at}`);
    await db.execute(sql`
      UPDATE batch_transfers SET deleted_at = NULL WHERE id = ${t.id}
    `);
  }

  // 3. Fix Perry Pear current volume (the one with current=18.93 that should be 0)
  console.log("\nFixing Perry Pear current volumes...");
  const perryPears = await db.execute(sql`
    SELECT id, custom_name,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol
    FROM batches
    WHERE custom_name = 'Perry Pear' AND deleted_at IS NULL
    ORDER BY start_date
  `);
  for (const pp of perryPears.rows as any[]) {
    const current = parseFloat(pp.current_vol);
    if (current > 0) {
      console.log(`  ${pp.custom_name} [${pp.id.slice(0, 8)}]: current=${pp.current_vol}L → 0L`);
      await db.execute(sql`
        UPDATE batches SET current_volume_liters = 0, updated_at = NOW() WHERE id = ${pp.id}
      `);
    } else {
      console.log(`  ${pp.custom_name} [${pp.id.slice(0, 8)}]: current=${pp.current_vol}L — already 0`);
    }
  }

  // 4. Un-delete Salish Racked batch
  console.log("\nUn-deleting Salish - Racked 2025-03-07...");
  const salishRacked = await db.execute(sql`
    SELECT id, custom_name,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           is_racking_derivative
    FROM batches
    WHERE custom_name LIKE 'Salish - Racked 2025-03-07%'
      AND deleted_at IS NOT NULL
  `);
  for (const s of salishRacked.rows as any[]) {
    console.log(`  ${s.custom_name} [${s.id.slice(0, 8)}]: init=${s.init_vol}L | current=${s.current_vol}L | isRacking=${s.is_racking_derivative}`);
    await db.execute(sql`
      UPDATE batches
      SET deleted_at = NULL,
          reconciliation_status = 'verified',
          current_volume_liters = 0,
          updated_at = NOW()
      WHERE id = ${s.id}
    `);
    console.log(`  Un-deleted, set current=0, status=verified`);
  }

  // 5. Final verification
  console.log("\n\n=== Final Transfer Balance Check ===");
  const END = "2025-12-31";
  const eligSub = sql`(SELECT id FROM batches WHERE deleted_at IS NULL
    AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
    AND COALESCE(product_type, 'cider') != 'juice'
    AND start_date::date <= ${END}::date)`;

  const tIn = await db.execute(sql`
    SELECT CAST(COALESCE(SUM(volume_transferred), 0) AS TEXT) as total
    FROM batch_transfers
    WHERE destination_batch_id IN ${eligSub}
      AND deleted_at IS NULL
      AND transferred_at >= '2025-01-01'::date AND transferred_at < '2026-01-01'::date
  `);
  const tOut = await db.execute(sql`
    SELECT CAST(COALESCE(SUM(volume_transferred), 0) AS TEXT) as total
    FROM batch_transfers
    WHERE source_batch_id IN ${eligSub}
      AND deleted_at IS NULL
      AND transferred_at >= '2025-01-01'::date AND transferred_at < '2026-01-01'::date
  `);

  const L = 3.78541;
  const tiL = parseFloat((tIn.rows as any[])[0].total);
  const toL = parseFloat((tOut.rows as any[])[0].total);
  console.log(`Transfers IN:  ${(tiL / L).toFixed(1)} gal`);
  console.log(`Transfers OUT: ${(toL / L).toFixed(1)} gal`);
  console.log(`Net:           ${((tiL - toL) / L).toFixed(1)} gal`);

  // Check unmatched
  const unmatched = await db.execute(sql`
    SELECT sb.custom_name as src, db2.custom_name as dst,
           CAST(t.volume_transferred AS TEXT) as vol
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
    WHERE t.destination_batch_id IN ${eligSub}
      AND t.source_batch_id NOT IN ${eligSub}
      AND t.deleted_at IS NULL
      AND t.transferred_at >= '2025-01-01'::date AND t.transferred_at < '2026-01-01'::date
  `);
  if ((unmatched.rows as any[]).length > 0) {
    console.log(`\nRemaining unmatched IN: ${(unmatched.rows as any[]).length}`);
    for (const u of unmatched.rows as any[]) {
      console.log(`  ${u.src} → ${u.dst} | ${u.vol}L`);
    }
  } else {
    console.log(`\nNo unmatched transfers! Internal movement should be 0.`);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
