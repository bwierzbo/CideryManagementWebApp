import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix the 3 batch balance gaps (Apple Brandy handled by user separately):
 *
 * 1. Salish Pommeau: Un-delete transfer to CARBOY-5G-7 (5.0L)
 * 2. Perry Pear: Increase transfer loss from 1.0L to 1.7L
 * 3. Raspberry Blackberry: Create keg fill for 20L (~5.28 gal)
 */

async function main() {
  console.log("=== FIX #1: Salish Pommeau — un-delete transfer to carboy ===");
  const salishResult = await db.execute(
    sql.raw(`
    UPDATE batch_transfers
    SET deleted_at = NULL
    WHERE id = '639be9fa-22b1-4324-982f-e03d159ca648'
    RETURNING id, volume_transferred, deleted_at
  `)
  );
  console.log(
    `  Un-deleted transfer: ${(salishResult.rows[0] as any)?.id}`
  );
  console.log(
    `  Volume: ${(salishResult.rows[0] as any)?.volume_transferred}L, deleted_at: ${(salishResult.rows[0] as any)?.deleted_at}`
  );

  console.log("\n=== FIX #2: Perry Pear — increase transfer loss 1.0L → 1.7L ===");
  const perryResult = await db.execute(
    sql.raw(`
    UPDATE batch_transfers
    SET loss = '1.700'
    WHERE id = '6b78f72b-bbad-44c0-927a-a8aa5132b27c'
    RETURNING id, loss
  `)
  );
  console.log(
    `  Updated transfer: ${(perryResult.rows[0] as any)?.id}`
  );
  console.log(`  New loss: ${(perryResult.rows[0] as any)?.loss}L`);

  console.log(
    "\n=== FIX #3: Raspberry Blackberry — create keg fill for 20L ===",
  );
  // The bottle run was 2025-03-01. Keg fill was likely same timeframe.
  // Batch ID: ef9febe3-29be-4b71-a3bb-6421c4127654
  // Need: batch_id, volume_taken, volume_taken_unit, filled_at, status, distributed_at
  // The 20L ≈ 5.28 gal. The user said it was kegged and likely distributed.
  const kegResult = await db.execute(
    sql.raw(`
    INSERT INTO keg_fills (
      id, batch_id, volume_taken, volume_taken_unit, loss, loss_unit,
      filled_at, status, distributed_at, production_notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'ef9febe3-29be-4b71-a3bb-6421c4127654',
      '20.000', 'L',
      '0', 'L',
      '2025-03-01 16:00:00',
      'distributed',
      '2025-03-01 16:00:00',
      'Reconciliation fix: unrecorded 5 gal keg fill',
      NOW(), NOW()
    )
    RETURNING id, volume_taken, volume_taken_unit, filled_at
  `)
  );
  const kf = kegResult.rows[0] as any;
  console.log(`  Created keg fill: ${kf?.id}`);
  console.log(
    `  Volume: ${kf?.volume_taken} ${kf?.volume_taken_unit}, filled: ${kf?.filled_at}`
  );

  // Verify all 3 fixes
  console.log("\n=== VERIFICATION ===");

  // Salish: reconstructed should now be ~0
  const salishCheck = await db.execute(
    sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN destination_batch_id = '91bb8d67-5b56-406e-889e-1bf10638d99b' THEN volume_transferred::numeric ELSE 0 END), 0) as xin,
      COALESCE(SUM(CASE WHEN source_batch_id = '91bb8d67-5b56-406e-889e-1bf10638d99b' THEN volume_transferred::numeric ELSE 0 END), 0) as xout
    FROM batch_transfers
    WHERE (source_batch_id = '91bb8d67-5b56-406e-889e-1bf10638d99b' OR destination_batch_id = '91bb8d67-5b56-406e-889e-1bf10638d99b')
      AND deleted_at IS NULL
  `)
  );
  const sc = salishCheck.rows[0] as any;
  const salishReconstructed =
    parseFloat(sc.xin) - parseFloat(sc.xout) - 18.9; // minus bottling
  console.log(
    `  Salish: xfersIn=${parseFloat(sc.xin).toFixed(1)}L, xfersOut=${parseFloat(sc.xout).toFixed(1)}L, bottled=18.9L, reconstructed=${salishReconstructed.toFixed(1)}L (should be ~0)`
  );

  // Perry: reconstructed should now be ~0
  const perryCheck = await db.execute(
    sql.raw(`
    SELECT volume_transferred::numeric as vol, loss::numeric as loss
    FROM batch_transfers
    WHERE source_batch_id = '4ac91b9d-562a-4e8e-85f8-1b6dd3ce3ffa' AND deleted_at IS NULL
  `)
  );
  const pc = perryCheck.rows[0] as any;
  const perryReconstructed =
    22.7 - parseFloat(pc.vol) - parseFloat(pc.loss);
  console.log(
    `  Perry: initial=22.7L, xferOut=${parseFloat(pc.vol).toFixed(1)}L, loss=${parseFloat(pc.loss).toFixed(1)}L, reconstructed=${perryReconstructed.toFixed(1)}L (should be ~0)`
  );

  // Raspberry Blackberry: reconstructed should now be ~0
  const rbCheck = await db.execute(
    sql.raw(`
    SELECT
      (SELECT COALESCE(SUM(volume_transferred::numeric), 0) FROM batch_transfers WHERE destination_batch_id = 'ef9febe3-29be-4b71-a3bb-6421c4127654' AND deleted_at IS NULL) as xin,
      (SELECT COALESCE(SUM(CAST(volume_taken_liters AS numeric)), 0) FROM bottle_runs WHERE batch_id = 'ef9febe3-29be-4b71-a3bb-6421c4127654' AND voided_at IS NULL) as bottled,
      (SELECT COALESCE(SUM(CASE WHEN volume_taken_unit='gal' THEN volume_taken::numeric*3.78541 ELSE volume_taken::numeric END), 0) FROM keg_fills WHERE batch_id = 'ef9febe3-29be-4b71-a3bb-6421c4127654' AND voided_at IS NULL AND deleted_at IS NULL) as kegged,
      (SELECT COALESCE(SUM(CAST(volume_loss AS numeric)), 0) FROM batch_filter_operations WHERE batch_id = 'ef9febe3-29be-4b71-a3bb-6421c4127654' AND deleted_at IS NULL) as filter_loss
  `)
  );
  const rc = rbCheck.rows[0] as any;
  const rbReconstructed =
    parseFloat(rc.xin) -
    parseFloat(rc.bottled) -
    parseFloat(rc.kegged) -
    parseFloat(rc.filter_loss);
  console.log(
    `  RB: xfersIn=${parseFloat(rc.xin).toFixed(1)}L, bottled=${parseFloat(rc.bottled).toFixed(1)}L, kegged=${parseFloat(rc.kegged).toFixed(1)}L, filterLoss=${parseFloat(rc.filter_loss).toFixed(1)}L, reconstructed=${rbReconstructed.toFixed(1)}L (should be ~0)`
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
