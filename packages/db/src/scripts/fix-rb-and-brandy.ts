import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // ============================================================
  // FIX 1: Raspberry Blackberry — increase racking loss by 1.0L
  // Batch c2436e1d has reconstructed=1.0L but stored=0.0L
  // The 1.0L is unmeasured loss (likely during kegging)
  // Increase existing racking loss from 2.5L to 3.5L
  // ============================================================
  const rbBatchId = "c2436e1d-2e14-4d04-a68a-2258fcd64b16";

  // Find the existing racking operation (non-Historical Record)
  const rbRacking = await db.execute(sql.raw(`
    SELECT id, volume_loss, racked_at, notes
    FROM batch_racking_operations
    WHERE batch_id = '${rbBatchId}' AND deleted_at IS NULL
      AND (notes IS NULL OR notes NOT ILIKE '%Historical Record%')
  `));

  if (rbRacking.rows.length !== 1) {
    console.error("Expected exactly 1 non-historical racking op for RB, found:", rbRacking.rows.length);
    process.exit(1);
  }

  const rackingId = rbRacking.rows[0].id;
  const oldLoss = Number(rbRacking.rows[0].volume_loss);
  const newLoss = oldLoss + 1.0; // 2.5 + 1.0 = 3.5

  console.log(`\nFIX 1: Raspberry Blackberry racking loss`);
  console.log(`  Racking op ID: ${rackingId}`);
  console.log(`  Old loss: ${oldLoss}L → New loss: ${newLoss}L`);

  await db.execute(sql.raw(`
    UPDATE batch_racking_operations
    SET volume_loss = '${newLoss}',
        notes = COALESCE(notes, '') || ' [Adjusted +1.0L to account for unmeasured kegging loss]'
    WHERE id = '${rackingId}'
  `));
  console.log("  ✅ Racking loss updated");

  // Verify the gap is now zero
  const rbCheck = await db.execute(sql.raw(`
    SELECT
      round(b.initial_volume_liters::numeric, 2) as init,
      round(b.current_volume_liters::numeric, 2) as cur,
      round(b.initial_volume_liters::numeric
        - COALESCE((SELECT SUM(volume_loss::numeric) FROM batch_racking_operations WHERE batch_id = b.id AND deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(volume_taken_liters::numeric) FROM bottle_runs WHERE batch_id = b.id AND voided_at IS NULL), 0)
        - COALESCE((SELECT SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END) FROM keg_fills WHERE batch_id = b.id AND voided_at IS NULL AND deleted_at IS NULL), 0)
      , 2) as reconstructed
    FROM batches b WHERE b.id = '${rbBatchId}'
  `));
  const rbR = rbCheck.rows[0];
  console.log(`  Verify: init=${rbR.init}, reconstructed=${rbR.reconstructed}, stored=${rbR.cur}, gap=${(Number(rbR.reconstructed) - Number(rbR.cur)).toFixed(2)}L`);

  // ============================================================
  // FIX 2: Apple Brandy #2 — replace adjustment with transfer
  // The +6.1L adjustment represents a physical move from AB#3
  // Create a proper transfer from AB#3 → AB#2, then delete the adjustment
  // ============================================================
  const ab2Id = "4d46e928-74a5-4f85-9c1f-e55664756e06"; // Apple Brandy 2025 #2

  // Find AB#3 (BARREL-10G-3)
  const ab3 = await db.execute(sql.raw(`
    SELECT id, name, custom_name, round(current_volume_liters::numeric, 2) as cur_l
    FROM batches
    WHERE name LIKE '%Apple Brandy 2025 #3%' AND deleted_at IS NULL
  `));

  if (ab3.rows.length !== 1) {
    // Try broader search
    const ab3alt = await db.execute(sql.raw(`
      SELECT id, name, custom_name, round(current_volume_liters::numeric, 2) as cur_l
      FROM batches
      WHERE (name ILIKE '%brandy%3%' OR custom_name ILIKE '%brandy%3%' OR name ILIKE '%BARREL-10G-3%')
        AND product_type = 'brandy' AND deleted_at IS NULL
    `));
    console.log("\nSearching for AB#3:");
    for (const r of ab3alt.rows) console.log(`  ${r.name} | ${r.custom_name} | cur: ${r.cur_l}L | id: ${r.id}`);
    if (ab3alt.rows.length !== 1) {
      console.error("Could not uniquely identify AB#3. Found:", ab3alt.rows.length);
      process.exit(1);
    }
    ab3.rows = ab3alt.rows;
  }

  const ab3Id = ab3.rows[0].id as string;
  const ab3Name = ab3.rows[0].name;
  console.log(`\nFIX 2: Apple Brandy #2 — replace adjustment with transfer from AB#3`);
  console.log(`  AB#3: ${ab3Name} (${ab3Id}), current: ${ab3.rows[0].cur_l}L`);

  // Find the adjustment to delete
  const adjToDelete = await db.execute(sql.raw(`
    SELECT id, adjustment_amount, adjustment_date, reason
    FROM batch_volume_adjustments
    WHERE batch_id = '${ab2Id}'
      AND deleted_at IS NULL
      AND adjustment_amount::numeric > 0
      AND reason ILIKE '%top-up%'
  `));

  if (adjToDelete.rows.length !== 1) {
    console.error("Expected exactly 1 top-up adjustment on AB#2, found:", adjToDelete.rows.length);
    process.exit(1);
  }

  const adjId = adjToDelete.rows[0].id;
  const adjDate = adjToDelete.rows[0].adjustment_date;
  console.log(`  Adjustment to delete: ${adjToDelete.rows[0].adjustment_amount}L on ${adjDate} | "${adjToDelete.rows[0].reason}"`);

  // Get vessel IDs for both brandy batches (required NOT NULL columns)
  const ab2Vessel = await db.execute(sql.raw(`SELECT vessel_id FROM batches WHERE id = '${ab2Id}'`));
  const ab3Vessel = await db.execute(sql.raw(`SELECT vessel_id FROM batches WHERE id = '${ab3Id}'`));
  const ab2VesselId = ab2Vessel.rows[0].vessel_id;
  const ab3VesselId = ab3Vessel.rows[0].vessel_id;
  console.log(`  AB#2 vessel: ${ab2VesselId}, AB#3 vessel: ${ab3VesselId}`);

  // Get a user ID for transferred_by
  const userRow = await db.execute(sql.raw(`SELECT id FROM users LIMIT 1`));
  const userId = userRow.rows[0].id;

  // Create the transfer from AB#3 → AB#2
  await db.execute(sql.raw(`
    INSERT INTO batch_transfers (
      source_batch_id, source_vessel_id,
      destination_batch_id, destination_vessel_id,
      volume_transferred, volume_transferred_unit,
      total_volume_processed, total_volume_processed_unit,
      loss, loss_unit,
      transferred_at, transferred_by, notes
    ) VALUES (
      '${ab3Id}', '${ab3VesselId}',
      '${ab2Id}', '${ab2VesselId}',
      '6.1', 'L',
      '6.1', 'L',
      '0', 'L',
      '${adjDate}', '${userId}',
      'Inter-barrel top-up: brandy moved from BARREL-10G-3 to AB#2 (replaces volume adjustment)'
    )
  `));
  console.log("  ✅ Transfer created: AB#3 → AB#2, 6.1L");

  // Soft-delete the adjustment
  await db.execute(sql.raw(`
    UPDATE batch_volume_adjustments
    SET deleted_at = NOW()
    WHERE id = '${adjId}'
  `));
  console.log("  ✅ Adjustment soft-deleted");

  // Update AB#3 current volume (reduce by 6.1L since transfer removes from source)
  await db.execute(sql.raw(`
    UPDATE batches
    SET current_volume_liters = current_volume_liters::numeric - 6.1
    WHERE id = '${ab3Id}'
  `));
  console.log(`  ✅ AB#3 current volume reduced by 6.1L`);

  // Verify AB#2 and AB#3
  const verify = await db.execute(sql.raw(`
    SELECT name, round(initial_volume_liters::numeric, 2) as init, round(current_volume_liters::numeric, 2) as cur
    FROM batches WHERE id IN ('${ab2Id}', '${ab3Id}')
  `));
  for (const r of verify.rows) {
    console.log(`  Verify: ${r.name} | init=${r.init}L | cur=${r.cur}L`);
  }

  console.log("\nDone. Both fixes applied.");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
