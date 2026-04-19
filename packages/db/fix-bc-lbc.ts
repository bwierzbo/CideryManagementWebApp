import postgres from 'postgres';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const sql = postgres(url!, { connect_timeout: 30 });

async function fixBatch(batchName: string, batchCustomName: string) {
  console.log(`\n========= Fixing ${batchCustomName} =========`);

  // Find the 2026 batch (initial_volume = 120)
  const batch = await sql`
    SELECT id, name, custom_name, current_volume, initial_volume, status
    FROM batches
    WHERE custom_name = ${batchCustomName}
      AND initial_volume = '120.000'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!batch.length) {
    console.log('Batch not found!');
    return;
  }
  const batchId = batch[0].id;
  console.log(`Found: ${batch[0].name} (${batch[0].status}, vol: ${batch[0].current_volume}L)`);

  // 1. Find and delete the wrongly-attributed parent racking (450.105 → 440)
  const parentRackings = await sql`
    SELECT id, racked_at, volume_before, volume_after, volume_loss
    FROM batch_racking_operations
    WHERE batch_id = ${batchId}
      AND deleted_at IS NULL
      AND CAST(volume_before AS DECIMAL) > 400
  `;
  console.log(`Parent rackings to remove: ${parentRackings.length}`);
  for (const r of parentRackings) {
    console.log(`  Deleting racking ${r.id}: ${r.volume_before}→${r.volume_after} (loss: ${r.volume_loss}) on ${r.racked_at}`);
    await sql`UPDATE batch_racking_operations SET deleted_at = NOW() WHERE id = ${r.id}`;
  }

  // 2. Find and delete duplicate sediment adjustment from rack-to-self
  const sedimentAdjs = await sql`
    SELECT id, adjustment_date, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = ${batchId}
      AND deleted_at IS NULL
      AND adjustment_type = 'sediment'
      AND reason ILIKE '%racking%'
  `;
  console.log(`Sediment adjustments to remove: ${sedimentAdjs.length}`);
  for (const a of sedimentAdjs) {
    console.log(`  Deleting adjustment ${a.id}: ${a.adjustment_amount}L "${a.reason}" on ${a.adjustment_date}`);
    await sql`UPDATE batch_volume_adjustments SET deleted_at = NOW() WHERE id = ${a.id}`;
  }

  // Verify: show remaining operations
  const remainingRackings = await sql`
    SELECT racked_at, volume_before, volume_after, volume_loss
    FROM batch_racking_operations
    WHERE batch_id = ${batchId} AND deleted_at IS NULL
  `;
  console.log(`Remaining rackings: ${remainingRackings.length}`);
  for (const r of remainingRackings) {
    console.log(`  ${r.racked_at}: ${r.volume_before}→${r.volume_after} (loss: ${r.volume_loss})`);
  }

  const remainingAdjs = await sql`
    SELECT adjustment_date, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = ${batchId} AND deleted_at IS NULL
  `;
  console.log(`Remaining adjustments: ${remainingAdjs.length}`);
  for (const a of remainingAdjs) {
    console.log(`  ${a.adjustment_date}: ${a.adjustment_amount}L "${a.reason}"`);
  }
}

async function main() {
  await fixBatch('Black Currant', 'Black Currant');
  await fixBatch('Lavender Black Currant', 'Lavender Black Currant');
  await sql.end();
}
main();
