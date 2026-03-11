import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Fix parent Apple Brandy phantom SBD ===\n");
  
  // The parent Apple Brandy (cf5b8a7b) has SBD = 56.5L but currentVolumeLiters = 0.
  // The 56.5L phantom is from the deleted transfer to Salish 2025 #1 (ad247e3a).
  // Adding a -56.5L accounting adjustment to zero out the SBD.
  
  const batchId = 'cf5b8a7b-33b4-407c-9011-1e4a2068d1da';
  const userId = '18a350db-9b16-4640-90ab-ad0f76c0bce9';
  
  // Verify current state
  const before = await db.execute(sql.raw(`
    SELECT current_volume_liters FROM batches WHERE id = '${batchId}'
  `));
  console.log("Current volume:", before.rows[0].current_volume_liters);
  
  // Insert the adjustment
  // Check constraint: adjustment_amount = volume_after - volume_before
  // So volume_before = 56.5, volume_after = 0, adjustment_amount = -56.5
  await db.execute(sql.raw(`
    INSERT INTO batch_volume_adjustments (
      batch_id, adjustment_amount, volume_before, volume_after, 
      reason, adjusted_by, adjustment_date, adjustment_type
    ) VALUES (
      '${batchId}', -56.500, 56.500, 0,
      'Composition offset - brandy volume baked into Salish 2025 #1 initial (deleted transfer ad247e3a)',
      '${userId}',
      NOW(),
      'correction_down'
    )
  `));
  console.log("Created -56.5L adjustment on parent Apple Brandy");
  
  // Verify: compute new SBD
  const tOut = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as v
    FROM batch_transfers 
    WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
  `));
  const adj = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as v
    FROM batch_volume_adjustments 
    WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `));
  
  const initial = 208.198;
  const transfersOut = Number(tOut.rows[0].v);
  const adjustments = Number(adj.rows[0].v);
  const newSbd = initial - transfersOut + adjustments;
  
  console.log(`\nNew SBD check: ${initial} - ${transfersOut} + (${adjustments}) = ${newSbd.toFixed(3)} L`);
  console.log(`Expected: ~0 L`);
  console.log(`SBD drift: ${(newSbd).toFixed(3)} L (${(newSbd / 3.78541).toFixed(2)} gal)`);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
