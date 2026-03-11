import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const endDate = '2024-12-31';
  
  // Get all verified/pending batches started by 2024-12-31
  const batches = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.current_volume_liters, b.start_date
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.start_date <= ${endDate}::timestamptz
      AND b.reconciliation_status IN ('verified', 'pending')
    ORDER BY b.product_type, b.start_date
  `);
  
  let totalEndingByType: Record<string, number> = {};
  let totalInitialByType: Record<string, number> = {};
  
  for (const batch of batches.rows) {
    const bId = batch.id as string;
    const initial = Number(batch.initial_volume_liters);
    const productType = batch.product_type as string;
    
    // Transfers IN during 2024
    const tIn = await db.execute(sql`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers
      WHERE destination_batch_id = ${bId} AND deleted_at IS NULL
        AND transferred_at::date <= ${endDate}::date
    `);
    
    // Transfers OUT during 2024
    const tOut = await db.execute(sql`
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total,
             COALESCE(SUM(COALESCE(loss::numeric, 0)), 0) as loss_total
      FROM batch_transfers
      WHERE source_batch_id = ${bId} AND deleted_at IS NULL
        AND transferred_at::date <= ${endDate}::date
    `);
    
    // Merges IN during 2024
    const mIn = await db.execute(sql`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as total
      FROM batch_merge_history
      WHERE target_batch_id = ${bId} AND deleted_at IS NULL
        AND merged_at::date <= ${endDate}::date
    `);
    
    // Merges OUT during 2024
    const mOut = await db.execute(sql`
      SELECT COALESCE(SUM(volume_added::numeric), 0) as total
      FROM batch_merge_history
      WHERE source_batch_id = ${bId} AND deleted_at IS NULL
        AND merged_at::date <= ${endDate}::date
    `);
    
    // Bottle runs in 2024
    const bottles = await db.execute(sql`
      SELECT COALESCE(SUM(volume_taken_liters::numeric), 0) as total,
             COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) as loss_total
      FROM bottle_runs
      WHERE batch_id = ${bId} AND voided_at IS NULL
        AND packaged_at::date <= ${endDate}::date
    `);
    
    // Keg fills in 2024
    const kegs = await db.execute(sql`
      SELECT COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN COALESCE(volume_taken::numeric, 0) * 3.78541 ELSE COALESCE(volume_taken::numeric, 0) END), 0) as total,
             COALESCE(SUM(CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541 ELSE COALESCE(loss::numeric, 0) END), 0) as loss_total
      FROM keg_fills
      WHERE batch_id = ${bId} AND voided_at IS NULL AND deleted_at IS NULL
        AND filled_at::date <= ${endDate}::date
    `);
    
    // Racking losses in 2024
    const racks = await db.execute(sql`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as total
      FROM batch_racking_operations
      WHERE batch_id = ${bId} AND deleted_at IS NULL
        AND (notes IS NULL OR notes NOT LIKE '%Historical Record%')
        AND racked_at::date <= ${endDate}::date
    `);
    
    // Filter losses in 2024
    const filters = await db.execute(sql`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as total
      FROM batch_filter_operations
      WHERE batch_id = ${bId} AND deleted_at IS NULL
        AND filtered_at::date <= ${endDate}::date
    `);
    
    // Adjustments in 2024
    const adjs = await db.execute(sql`
      SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as total
      FROM batch_volume_adjustments
      WHERE batch_id = ${bId} AND deleted_at IS NULL
        AND adjustment_date::date <= ${endDate}::date
    `);
    
    // Distillation in 2024
    const dist = await db.execute(sql`
      SELECT COALESCE(SUM(source_volume_liters::numeric), 0) as total
      FROM distillation_records
      WHERE source_batch_id = ${bId} AND deleted_at IS NULL AND status IN ('sent', 'received')
        AND sent_at::date <= ${endDate}::date
    `);
    
    const transfersIn = Number(tIn.rows[0].total);
    const transfersOut = Number(tOut.rows[0].total);
    const transferLoss = Number(tOut.rows[0].loss_total);
    const mergesIn = Number(mIn.rows[0].total);
    const mergesOut = Number(mOut.rows[0].total);
    const bottled = Number(bottles.rows[0].total);
    const bottleLoss = Number(bottles.rows[0].loss_total);
    const kegged = Number(kegs.rows[0].total);
    const kegLoss = Number(kegs.rows[0].loss_total);
    const rackLoss = Number(racks.rows[0].total);
    const filterLoss = Number(filters.rows[0].total);
    const adjustment = Number(adjs.rows[0].total);
    const distillation = Number(dist.rows[0].total);
    
    const ending = initial + transfersIn + mergesIn - transfersOut - transferLoss - mergesOut
      - bottled - bottleLoss - kegged - kegLoss - rackLoss - filterLoss + adjustment - distillation;
    
    if (!totalEndingByType[productType]) totalEndingByType[productType] = 0;
    if (!totalInitialByType[productType]) totalInitialByType[productType] = 0;
    totalEndingByType[productType] += ending;
    totalInitialByType[productType] += initial;
    
    const endGal = (ending / 3.78541).toFixed(1);
    if (Math.abs(ending) > 0.1) {
      console.log(`  ${batch.name} (${productType}): ending=${endGal} gal [init=${(initial/3.78541).toFixed(1)}, tIn=${(transfersIn/3.78541).toFixed(1)}, mIn=${(mergesIn/3.78541).toFixed(1)}, tOut=${(transfersOut/3.78541).toFixed(1)}, mOut=${(mergesOut/3.78541).toFixed(1)}, btl=${(bottled/3.78541).toFixed(1)}, keg=${(kegged/3.78541).toFixed(1)}, rack=${(rackLoss/3.78541).toFixed(1)}, filter=${(filterLoss/3.78541).toFixed(1)}, adj=${(adjustment/3.78541).toFixed(1)}, dist=${(distillation/3.78541).toFixed(1)}]`);
    }
  }
  
  console.log("\n=== TOTAL SBD ENDING BY TYPE (at 2024-12-31) ===");
  let grandTotal = 0;
  for (const [type, ending] of Object.entries(totalEndingByType)) {
    const gal = (ending / 3.78541).toFixed(1);
    console.log(`  ${type}: ${gal} gal (initial: ${(totalInitialByType[type]/3.78541).toFixed(1)} gal)`);
    grandTotal += ending;
  }
  console.log(`  GRAND TOTAL: ${(grandTotal / 3.78541).toFixed(1)} gal`);
  console.log(`  Target: 1121.0 gal`);
  console.log(`  Gap: ${((grandTotal / 3.78541) - 1121).toFixed(1)} gal`);
  console.log(`  Needed adjustment change: ${(1121 - grandTotal / 3.78541).toFixed(1)} gal = ${((1121 - grandTotal / 3.78541) * 3.78541).toFixed(3)} L`);
  
  // Current For Distillery adjustment
  const currentAdj = await db.execute(sql`
    SELECT adjustment_amount FROM batch_volume_adjustments
    WHERE batch_id = '1539d85e-299a-4e13-ae0e-ee2ca38b7ea6' AND deleted_at IS NULL
  `);
  const currentAdjL = Number(currentAdj.rows[0]?.adjustment_amount || 0);
  const currentAdjGal = currentAdjL / 3.78541;
  console.log(`\n  Current For Distillery adj: ${currentAdjGal.toFixed(1)} gal (${currentAdjL.toFixed(3)} L)`);
  
  const neededAdjChange = 1121 - grandTotal / 3.78541;
  const newAdjGal = currentAdjGal + neededAdjChange;
  const newAdjL = newAdjGal * 3.78541;
  console.log(`  New For Distillery adj should be: ${newAdjGal.toFixed(1)} gal (${newAdjL.toFixed(3)} L)`);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
