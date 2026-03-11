import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  const tankBatchId = '90b37943-6cb4-4759-b9a8-fe93e877f58d';
  const ibcBatchId = '2031feb0-4a0f-435a-9623-08270987a564';

  // Verify current state
  console.log("=== BEFORE ===");
  const before = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.current_volume, b.current_volume_unit,
           b.current_volume_liters, v.name as vessel_name
    FROM batches b LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id IN ('${tankBatchId}', '${ibcBatchId}')
  `));
  for (const b of before.rows as any[]) {
    console.log(`${b.custom_name || b.name} (${b.vessel_name}): current_volume=${b.current_volume}${b.current_volume_unit} liters=${b.current_volume_liters}`);
  }

  // Fix TANK-1000-1: 1000L in - 1000L out = 0L remaining
  // Verify the math first
  const volIn = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
    FROM batch_transfers WHERE destination_batch_id = '${tankBatchId}' AND deleted_at IS NULL
  `));
  const volOut = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
    FROM batch_transfers WHERE source_batch_id = '${tankBatchId}' AND deleted_at IS NULL
  `));
  const expectedVol = parseFloat((volIn.rows[0] as any).total) - parseFloat((volOut.rows[0] as any).total);
  console.log(`\nTANK-1000-1 expected volume: ${(volIn.rows[0] as any).total} in - ${(volOut.rows[0] as any).total} out = ${expectedVol}L`);

  // Update TANK-1000-1 current_volume to 0
  await db.execute(sql.raw(`
    UPDATE batches SET
      current_volume = '0.000',
      current_volume_unit = 'L',
      current_volume_liters = '0.000',
      updated_at = NOW()
    WHERE id = '${tankBatchId}'
  `));
  console.log("Updated TANK-1000-1 current_volume to 0");

  // Fix IBC-1000-1: current_volume should match current_volume_liters (1030.010)
  const ibcExpected = await db.execute(sql.raw(`
    SELECT b.initial_volume::numeric + COALESCE(
      (SELECT SUM(volume_added::numeric) FROM batch_merge_history
       WHERE target_batch_id = '${ibcBatchId}' AND deleted_at IS NULL), 0
    ) as expected
    FROM batches b WHERE b.id = '${ibcBatchId}'
  `));
  console.log(`IBC-1000-1 expected volume: ${(ibcExpected.rows[0] as any).expected}L`);

  await db.execute(sql.raw(`
    UPDATE batches SET
      current_volume = current_volume_liters::text,
      current_volume_unit = 'L',
      updated_at = NOW()
    WHERE id = '${ibcBatchId}'
  `));
  console.log("Updated IBC-1000-1 current_volume to match current_volume_liters");

  // Verify
  console.log("\n=== AFTER ===");
  const after = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.current_volume, b.current_volume_unit,
           b.current_volume_liters, v.name as vessel_name
    FROM batches b LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id IN ('${tankBatchId}', '${ibcBatchId}')
  `));
  for (const b of after.rows as any[]) {
    console.log(`${b.custom_name || b.name} (${b.vessel_name}): current_volume=${b.current_volume}${b.current_volume_unit} liters=${b.current_volume_liters}`);
  }

  process.exit(0);
}

main().catch(console.error);
