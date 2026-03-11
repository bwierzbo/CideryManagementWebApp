import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const endDate = '2024-12-31';
  const forDistilleryId = '1539d85e-299a-4e13-ae0e-ee2ca38b7ea6';
  const adjId = '246b1f94-102d-4c17-808c-6f952cc1026c';
  const targetGal = 1121.0;
  const targetL = targetGal * 3.78541;

  // Get all verified/pending batches started by 2024-12-31
  const batches = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.start_date <= ${endDate}::timestamptz
      AND b.reconciliation_status IN ('verified', 'pending')
  `);

  let totalEndingL = 0;

  for (const batch of batches.rows) {
    const bId = batch.id as string;
    const initial = Number(batch.initial_volume_liters);

    const ops = await db.execute(sql`
      SELECT
        (SELECT COALESCE(SUM(volume_transferred::numeric), 0) FROM batch_transfers WHERE destination_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date) as t_in,
        (SELECT COALESCE(SUM(volume_transferred::numeric), 0) FROM batch_transfers WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date) as t_out,
        (SELECT COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) FROM batch_transfers WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date) as t_loss,
        (SELECT COALESCE(SUM(volume_added::numeric), 0) FROM batch_merge_history WHERE target_batch_id = ${bId} AND deleted_at IS NULL AND merged_at::date <= ${endDate}::date) as m_in,
        (SELECT COALESCE(SUM(volume_added::numeric), 0) FROM batch_merge_history WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND merged_at::date <= ${endDate}::date) as m_out,
        (SELECT COALESCE(SUM(volume_taken_liters::numeric), 0) FROM bottle_runs WHERE batch_id = ${bId} AND voided_at IS NULL AND packaged_at::date <= ${endDate}::date) as btl,
        (SELECT COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) FROM bottle_runs WHERE batch_id = ${bId} AND voided_at IS NULL AND packaged_at::date <= ${endDate}::date) as btl_loss,
        (SELECT COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END), 0) FROM keg_fills WHERE batch_id = ${bId} AND voided_at IS NULL AND deleted_at IS NULL AND filled_at::date <= ${endDate}::date) as keg,
        (SELECT COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) FROM keg_fills WHERE batch_id = ${bId} AND voided_at IS NULL AND deleted_at IS NULL AND filled_at::date <= ${endDate}::date) as keg_loss,
        (SELECT COALESCE(SUM(volume_loss::numeric), 0) FROM batch_racking_operations WHERE batch_id = ${bId} AND deleted_at IS NULL AND (notes IS NULL OR notes NOT LIKE '%Historical Record%') AND racked_at::date <= ${endDate}::date) as rack,
        (SELECT COALESCE(SUM(volume_loss::numeric), 0) FROM batch_filter_operations WHERE batch_id = ${bId} AND deleted_at IS NULL AND filtered_at::date <= ${endDate}::date) as filt,
        (SELECT COALESCE(SUM(adjustment_amount::numeric), 0) FROM batch_volume_adjustments WHERE batch_id = ${bId} AND deleted_at IS NULL AND adjustment_date::date <= ${endDate}::date) as adj,
        (SELECT COALESCE(SUM(source_volume_liters::numeric), 0) FROM distillation_records WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND status IN ('sent', 'received') AND sent_at::date <= ${endDate}::date) as dist
    `);

    const r = ops.rows[0];
    const ending = initial + Number(r.t_in) + Number(r.m_in) - Number(r.t_out) - Number(r.t_loss) - Number(r.m_out)
      - Number(r.btl) - Number(r.btl_loss) - Number(r.keg) - Number(r.keg_loss) - Number(r.rack) - Number(r.filt)
      + Number(r.adj) - Number(r.dist);

    totalEndingL += ending;
  }

  const totalEndingGal = totalEndingL / 3.78541;
  const gapL = targetL - totalEndingL;
  const gapGal = gapL / 3.78541;

  console.log(`=== Current SBD Ending (2024-12-31) ===`);
  console.log(`  Total: ${totalEndingL.toFixed(3)} L = ${totalEndingGal.toFixed(2)} gal`);
  console.log(`  Target: ${targetL.toFixed(3)} L = ${targetGal} gal`);
  console.log(`  Gap: ${gapL.toFixed(3)} L = ${gapGal.toFixed(2)} gal`);

  // Current adjustment
  const currentAdj = await db.execute(sql`
    SELECT adjustment_amount, volume_before, volume_after
    FROM batch_volume_adjustments WHERE id = ${adjId}
  `);
  const currentAdjL = Number(currentAdj.rows[0].adjustment_amount);
  const newAdjL = currentAdjL + gapL;
  const newAdjGal = newAdjL / 3.78541;

  console.log(`\n=== Adjustment Update ===`);
  console.log(`  Current adj: ${currentAdjL.toFixed(3)} L = ${(currentAdjL/3.78541).toFixed(2)} gal`);
  console.log(`  New adj: ${newAdjL.toFixed(3)} L = ${newAdjGal.toFixed(2)} gal`);
  console.log(`  Delta: ${gapL.toFixed(3)} L = ${gapGal.toFixed(2)} gal`);

  // Compute the batch volume at the time of this adjustment (excluding this adj)
  const batchVolBeforeAdj = await db.execute(sql`
    SELECT
      b.initial_volume_liters::numeric +
      COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE destination_batch_id = ${forDistilleryId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date), 0) -
      COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE source_batch_id = ${forDistilleryId} AND deleted_at IS NULL AND transferred_at::date <= ${endDate}::date), 0)
      as vol_before
    FROM batches b WHERE b.id = ${forDistilleryId}
  `);
  const volBeforeL = Number(batchVolBeforeAdj.rows[0].vol_before);

  console.log(`\n  Batch volume before adj: ${volBeforeL.toFixed(3)} L = ${(volBeforeL/3.78541).toFixed(2)} gal`);
  console.log(`  Batch volume after adj: ${(volBeforeL + newAdjL).toFixed(3)} L = ${((volBeforeL + newAdjL)/3.78541).toFixed(2)} gal`);

  // Apply the update
  const result = await db.execute(sql`
    UPDATE batch_volume_adjustments
    SET adjustment_amount = ${newAdjL.toFixed(3)},
        volume_before = ${volBeforeL.toFixed(3)},
        volume_after = ${(volBeforeL + newAdjL).toFixed(3)}
    WHERE id = ${adjId}
    RETURNING id, adjustment_amount, volume_before, volume_after
  `);
  console.log(`\n  ✅ Updated adjustment:`, JSON.stringify(result.rows[0], null, 2));

  // Also update the batch's currentVolumeLiters to reflect the change
  // Current volume should change by the same delta as the adjustment
  const batchUpdate = await db.execute(sql`
    UPDATE batches
    SET current_volume_liters = (current_volume_liters::numeric + ${gapL.toFixed(3)}::numeric)::text
    WHERE id = ${forDistilleryId}
    RETURNING id, custom_name, current_volume_liters
  `);
  console.log(`  ✅ Updated batch volume:`, JSON.stringify(batchUpdate.rows[0], null, 2));

  // Verify new total
  const newTotal = totalEndingL + gapL;
  console.log(`\n=== Verification ===`);
  console.log(`  New total ending: ${newTotal.toFixed(3)} L = ${(newTotal/3.78541).toFixed(2)} gal`);
  console.log(`  Target: ${targetL.toFixed(3)} L = ${targetGal} gal`);
  console.log(`  Residual: ${((newTotal - targetL)).toFixed(6)} L`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
