import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Fix completed batches with unrecorded lees/sediment losses.
 * These are batches where current_volume = 0 but reconstructed > 0,
 * meaning the vessel was emptied but the leftover wasn't recorded.
 * Records each as a sediment adjustment.
 */
async function main() {
  // Batches with known lees gaps (from batch-gaps.ts analysis)
  const fixes = [
    { id: "f9da6312-a11e-48ef-95a4-d4a8f3fc4bba", name: "Summer Community Blend 3", gapL: 50.0 },
    { id: "4fd3bb0a-de9c-419e-88dd-01fad55431d8", name: "Perry #2", gapL: 24.52 },
    { id: "1e6ba98d-7f37-43e1-87e9-4b79661f019c", name: "Calvados Barrel Aged Cider", gapL: 20.3 },
    { id: "298c081d-72bd-403a-8a28-bc62fef2716a", name: "Base Cider", gapL: 15.0 },
    { id: "e58d6eeb-5168-44a0-914a-5d9a353c73b4", name: "Community Blend #1", gapL: 15.0 },
    { id: "a0f86927-6031-40f6-855e-e822dc2af5d6", name: "Community Cider", gapL: 10.0 },
    { id: "a3e01109-3e60-4a1d-8a14-4f39f92e2ed2", name: "Salish (pommeau)", gapL: 2.0 },
    { id: "4ac91b9d-89d5-4e25-bc27-b86a2b65c78a", name: "Perry Pear", gapL: 1.71 },
    { id: "986208dd-4d08-4282-80a1-80c7e75d8ff7", name: "Nourish Perry", gapL: 0.38 },
  ];

  // Get a user ID for adjusted_by
  const userRow = await db.execute(sql.raw(`SELECT id FROM users LIMIT 1`));
  const userId = userRow.rows[0].id;

  let totalFixed = 0;

  for (const fix of fixes) {
    // Verify batch exists and has expected gap
    const batch = await db.execute(sql.raw(`
      SELECT name, custom_name, product_type,
        round(initial_volume_liters::numeric, 2) as init,
        round(current_volume_liters::numeric, 2) as cur,
        vessel_id, status, start_date::date
      FROM batches WHERE id = '${fix.id}' AND deleted_at IS NULL
    `));

    if (batch.rows.length === 0) {
      console.log(`SKIP: ${fix.name} — batch not found`);
      continue;
    }

    const b = batch.rows[0];
    if (Number(b.cur) !== 0) {
      console.log(`SKIP: ${fix.name} — current volume is ${b.cur}L (expected 0)`);
      continue;
    }

    // Check if adjustment already exists (idempotency)
    const existing = await db.execute(sql.raw(`
      SELECT id FROM batch_volume_adjustments
      WHERE batch_id = '${fix.id}' AND deleted_at IS NULL
        AND adjustment_type = 'sediment'
        AND reason ILIKE '%lees%sediment%vessel%'
    `));
    if (existing.rows.length > 0) {
      console.log(`SKIP: ${fix.name} — sediment adjustment already exists`);
      continue;
    }

    const adjAmount = -fix.gapL;

    await db.execute(sql.raw(`
      INSERT INTO batch_volume_adjustments (
        batch_id, vessel_id,
        adjustment_date, adjustment_type,
        volume_before, volume_after, adjustment_amount,
        reason, notes, adjusted_by
      ) VALUES (
        '${fix.id}', ${b.vessel_id ? `'${b.vessel_id}'` : "NULL"},
        COALESCE('${b.start_date}'::date + interval '1 year', NOW()),
        'sediment',
        '${fix.gapL}', '0', '${adjAmount}',
        'Lees/sediment left in vessel when batch was emptied',
        'Batch completed with current_volume=0 but ${fix.gapL}L (${(fix.gapL / 3.78541).toFixed(1)} gal) unaccounted. This is lees/sediment that remained in the vessel after transfer/packaging and was discarded.',
        '${userId}'
      )
    `));

    totalFixed += fix.gapL;
    console.log(`Fixed: ${fix.name} — ${adjAmount}L (${(adjAmount / 3.78541).toFixed(1)} gal) sediment adjustment`);
  }

  console.log(`\nTotal fixed: ${totalFixed.toFixed(2)}L (${(totalFixed / 3.78541).toFixed(1)} gal) across ${fixes.length} batches`);

  // Verify all gaps are closed
  console.log("\nVerification:");
  for (const fix of fixes) {
    const verify = await db.execute(sql.raw(`
      SELECT
        round(b.initial_volume_liters::numeric
          + COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE destination_batch_id = b.id AND deleted_at IS NULL), 0)
          + COALESCE((SELECT SUM(volume_added::numeric) FROM batch_merge_history WHERE target_batch_id = b.id AND deleted_at IS NULL), 0)
          + COALESCE((SELECT SUM(adjustment_amount::numeric) FROM batch_volume_adjustments WHERE batch_id = b.id AND deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE source_batch_id = b.id AND deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(volume_added::numeric) FROM batch_merge_history WHERE source_batch_id = b.id AND deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(volume_loss::numeric) FROM batch_racking_operations WHERE batch_id = b.id AND deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(volume_loss::numeric) FROM batch_filter_operations WHERE batch_id = b.id), 0)
          - COALESCE((SELECT SUM(volume_taken_liters::numeric) FROM bottle_runs WHERE batch_id = b.id AND voided_at IS NULL), 0)
          - COALESCE((SELECT SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END) FROM keg_fills WHERE batch_id = b.id AND voided_at IS NULL AND deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(source_volume_liters::numeric) FROM distillation_records WHERE source_batch_id = b.id AND deleted_at IS NULL), 0)
          - b.current_volume_liters::numeric
        , 2) / 3.78541 as gap_gal
      FROM batches b WHERE b.id = '${fix.id}'
    `));
    const gap = Number(verify.rows[0].gap_gal);
    const status = Math.abs(gap) < 0.05 ? "OK" : "STILL HAS GAP";
    console.log(`  ${fix.name}: ${gap.toFixed(2)} gal — ${status}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
