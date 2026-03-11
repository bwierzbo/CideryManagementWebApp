import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix internal movement asymmetry by converting transfers from/to non-eligible
 * batches into initial volume (IN) or negative adjustments (OUT).
 *
 * For IN transfers (from deleted/excluded sources):
 *   - Soft-delete the transfer record
 *   - Increase destination batch's initial_volume_liters by the transfer amount
 *   - Effect: volume moves from "internal movement" to "production"
 *
 * For OUT transfers (to deleted/excluded destinations):
 *   - Soft-delete the transfer record
 *   - Add a negative adjustment to the source batch
 *   - Effect: volume moves from "internal movement" to "losses/adjustments"
 *
 * Safety: Only fix IN transfers where the destination batch won't remain
 * "transfer-created" after the fix. If isTransferCreated stays true, the
 * waterfall identity would break (init increase doesn't appear in production).
 */

const START = "2025-01-01";
const END = "2025-12-31";
const L_PER_GAL = 3.78541;

async function main() {
  console.log("=== Fix Internal Movement Data ===\n");

  // 1. Build eligible batch set
  const eligible = await db.execute(sql`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           b.is_racking_derivative, b.product_type
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND (
        COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative IS TRUE
        OR b.parent_batch_id IS NOT NULL
      )
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= ${END}::date
  `);
  const eligibleIds = new Set((eligible.rows as any[]).map(r => r.id));
  const eligibleMap = new Map((eligible.rows as any[]).map(r => [r.id, r]));
  console.log(`Eligible batches: ${eligibleIds.size}\n`);

  // 2. Find unmatched IN transfers (source outside eligible)
  const unmatchedIn = await db.execute(sql`
    SELECT t.id, t.source_batch_id, t.destination_batch_id,
           CAST(t.volume_transferred AS TEXT) as vol,
           t.transferred_at,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           db2.custom_name as dst_name, db2.batch_number as dst_batch,
           db2.parent_batch_id as dst_parent,
           CAST(db2.initial_volume_liters AS TEXT) as dst_init
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
    WHERE t.destination_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= ${START}::date
      AND t.transferred_at < (${END}::date + interval '1 day')
    ORDER BY t.transferred_at
  `);

  // Filter to only those where source is NOT eligible
  const inToFix: any[] = [];
  const inSkipped: any[] = [];
  for (const t of unmatchedIn.rows as any[]) {
    if (!eligibleIds.has(t.source_batch_id)) {
      // Group by destination to check if safe
      inToFix.push(t);
    }
  }

  // 3. Find unmatched OUT transfers (destination outside eligible)
  const unmatchedOut = await db.execute(sql`
    SELECT t.id, t.source_batch_id, t.destination_batch_id,
           CAST(t.volume_transferred AS TEXT) as vol,
           t.transferred_at,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           db2.custom_name as dst_name, db2.batch_number as dst_batch
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
    WHERE t.source_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= ${START}::date
      AND t.transferred_at < (${END}::date + interval '1 day')
    ORDER BY t.transferred_at
  `);

  const outToFix: any[] = [];
  for (const t of unmatchedOut.rows as any[]) {
    if (!eligibleIds.has(t.destination_batch_id)) {
      outToFix.push(t);
    }
  }

  // 4. Safety check: for each IN transfer, verify the destination won't remain
  //    "transfer-created" after the fix. If it would, skip it.
  //    isTransferCreated = parentBatchId && totalTransfersIn >= init * 0.9
  //
  //    We need to check: after removing our transfers and bumping init,
  //    will the remaining transfers still trigger isTransferCreated?

  // Group IN fixes by destination batch
  const inByDest = new Map<string, any[]>();
  for (const t of inToFix) {
    const list = inByDest.get(t.destination_batch_id) || [];
    list.push(t);
    inByDest.set(t.destination_batch_id, list);
  }

  const safeInFixes: any[] = [];
  for (const [destId, transfers] of inByDest) {
    const dest = eligibleMap.get(destId);
    const destName = transfers[0].dst_name || transfers[0].dst_batch;
    const currentInit = parseFloat(transfers[0].dst_init) || 0;
    const addedVolume = transfers.reduce((s: number, t: any) => s + parseFloat(t.vol), 0);
    const newInit = currentInit + addedVolume;

    // If no parent, can never be transfer-created → safe
    if (!transfers[0].dst_parent) {
      console.log(`✓ ${destName}: no parent → safe (init ${currentInit} → ${newInit.toFixed(1)}L, +${addedVolume.toFixed(1)}L)`);
      safeInFixes.push(...transfers);
      continue;
    }

    // Has parent. Check remaining transfers after removing our fixes.
    const remainingTransfers = await db.execute(sql`
      SELECT CAST(SUM(volume_transferred) AS TEXT) as total
      FROM batch_transfers
      WHERE destination_batch_id = ${destId}
        AND deleted_at IS NULL
        AND id NOT IN (${sql.join(transfers.map(t => sql`${t.id}`), sql`, `)})
    `);
    const remainingTotal = parseFloat((remainingTransfers.rows as any[])[0]?.total) || 0;

    const wouldBeTransferCreated = remainingTotal >= newInit * 0.9;

    if (wouldBeTransferCreated) {
      console.log(`✗ ${destName}: still transfer-created after fix (remaining transfers=${remainingTotal.toFixed(1)}L >= ${(newInit * 0.9).toFixed(1)}L) → SKIP`);
      for (const t of transfers) {
        inSkipped.push({ ...t, reason: "still transfer-created" });
      }
    } else {
      console.log(`✓ ${destName}: becomes non-transfer-created (remaining=${remainingTotal.toFixed(1)}L < ${(newInit * 0.9).toFixed(1)}L) → safe`);
      safeInFixes.push(...transfers);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`IN transfers to fix: ${safeInFixes.length} (${(safeInFixes.reduce((s: number, t: any) => s + parseFloat(t.vol), 0) / L_PER_GAL).toFixed(1)} gal)`);
  console.log(`IN transfers skipped: ${inSkipped.length} (${(inSkipped.reduce((s: number, t: any) => s + parseFloat(t.vol), 0) / L_PER_GAL).toFixed(1)} gal)`);
  console.log(`OUT transfers to fix: ${outToFix.length} (${(outToFix.reduce((s: number, t: any) => s + parseFloat(t.vol), 0) / L_PER_GAL).toFixed(1)} gal)`);

  // 5. Apply IN fixes
  console.log("\n\n========== APPLYING IN FIXES ==========\n");
  for (const [destId, transfers] of inByDest) {
    const isSkipped = transfers.every(t => inSkipped.some(s => s.id === t.id));
    if (isSkipped) continue;

    const destName = transfers[0].dst_name || transfers[0].dst_batch;
    const currentInit = parseFloat(transfers[0].dst_init) || 0;
    const addedVolume = transfers.reduce((s: number, t: any) => s + parseFloat(t.vol), 0);
    const newInit = currentInit + addedVolume;

    console.log(`--- ${destName} ---`);
    console.log(`  Current init: ${currentInit}L → New init: ${newInit.toFixed(3)}L (+${addedVolume.toFixed(3)}L)`);

    for (const t of transfers) {
      const vol = parseFloat(t.vol);
      console.log(`  Soft-deleting transfer [${t.id.slice(0, 8)}]: ${t.src_name || t.src_batch} → ${destName} (${vol}L)`);

      await db.execute(sql`
        UPDATE batch_transfers
        SET deleted_at = NOW()
        WHERE id = ${t.id}
      `);
    }

    await db.execute(sql`
      UPDATE batches
      SET initial_volume_liters = ${newInit},
          updated_at = NOW()
      WHERE id = ${destId}
    `);

    // Verify
    const after = await db.execute(sql`
      SELECT CAST(initial_volume_liters AS TEXT) as init_vol
      FROM batches WHERE id = ${destId}
    `);
    console.log(`  Verified: init = ${(after.rows as any[])[0].init_vol}L\n`);
  }

  // 6. Apply OUT fixes
  console.log("\n========== APPLYING OUT FIXES ==========\n");
  for (const t of outToFix) {
    const vol = parseFloat(t.vol);
    const srcName = t.src_name || t.src_batch;
    const dstName = t.dst_name || t.dst_batch;

    console.log(`--- ${srcName} → ${dstName} (${vol}L, ${(vol / L_PER_GAL).toFixed(1)} gal) ---`);

    // Soft-delete transfer
    console.log(`  Soft-deleting transfer [${t.id.slice(0, 8)}]`);
    await db.execute(sql`
      UPDATE batch_transfers
      SET deleted_at = NOW()
      WHERE id = ${t.id}
    `);

    // Add negative adjustment to source batch
    console.log(`  Adding -${vol}L adjustment to ${srcName}`);
    await db.execute(sql`
      INSERT INTO batch_volume_adjustments (id, batch_id, adjustment_amount, reason, adjusted_at, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${t.source_batch_id},
        ${-vol},
        ${"Volume transferred to deleted batch (" + dstName + ") — reclassified from internal movement"},
        ${t.transferred_at},
        NOW(),
        NOW()
      )
    `);
    console.log(`  Done\n`);
  }

  // 7. Show skipped transfers
  if (inSkipped.length > 0) {
    console.log("\n========== SKIPPED (still transfer-created) ==========\n");
    for (const t of inSkipped) {
      const vol = parseFloat(t.vol);
      console.log(`  ${t.src_name || t.src_batch} → ${t.dst_name || t.dst_batch} | ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal) | ${t.reason}`);
    }
    const skippedGal = inSkipped.reduce((s: number, t: any) => s + parseFloat(t.vol), 0) / L_PER_GAL;
    console.log(`\n  Total skipped: ${skippedGal.toFixed(1)} gal of remaining internal movement`);
  }

  // 8. Verify new transfer totals
  console.log("\n\n========== VERIFICATION ==========\n");

  const newTIn = await db.execute(sql`
    SELECT CAST(COALESCE(SUM(t.volume_transferred), 0) AS TEXT) as total
    FROM batch_transfers t
    WHERE t.destination_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= ${START}::date
      AND t.transferred_at < (${END}::date + interval '1 day')
  `);
  const newTOut = await db.execute(sql`
    SELECT CAST(COALESCE(SUM(t.volume_transferred), 0) AS TEXT) as total
    FROM batch_transfers t
    WHERE t.source_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= ${START}::date
      AND t.transferred_at < (${END}::date + interval '1 day')
  `);

  const tInL = parseFloat((newTIn.rows as any[])[0].total);
  const tOutL = parseFloat((newTOut.rows as any[])[0].total);
  console.log(`New transfers IN:  ${(tInL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`New transfers OUT: ${(tOutL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`Net transfers:     ${((tInL - tOutL) / L_PER_GAL).toFixed(1)} gal`);
  console.log(`(Merges are still 0.0 net, so expected Internal Movement ≈ ${((tInL - tOutL) / L_PER_GAL).toFixed(1)} gal)`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
