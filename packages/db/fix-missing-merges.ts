/**
 * Fix missing batch_merge_history records and Jonathan #1 volume.
 *
 * 1. Find all blends done via vessel transfer that have batchTransfers records
 *    but no corresponding batch_merge_history records, and backfill them.
 * 2. Fix Jonathan #1 currentVolumeLiters (956 -> 943) — the stale pre-rack
 *    value was used during the blend.
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const sql = postgres(url!, { connect_timeout: 60 });

async function main() {
  console.log('=== Fix Missing Merge History & Jonathan Volume ===\n');

  // ─── 1. Find blends with batchTransfers but no batch_merge_history ───
  // A blend transfer has notes starting with 'BLEND:' or 'Merge:'
  // and source_batch_id != destination_batch_id
  console.log('--- Finding blends missing merge history ---\n');

  const missingMerges = await sql`
    SELECT bt.id as transfer_id,
           bt.source_batch_id, bt.destination_batch_id,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.transferred_at, bt.transferred_by,
           bt.notes,
           sb.name as source_name, db.name as dest_name
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id
    JOIN batches db ON db.id = bt.destination_batch_id
    WHERE bt.deleted_at IS NULL
      AND bt.source_batch_id != bt.destination_batch_id
      AND (bt.notes LIKE 'BLEND:%' OR bt.notes LIKE 'Merge:%')
      AND NOT EXISTS (
        SELECT 1 FROM batch_merge_history bmh
        WHERE bmh.target_batch_id = bt.destination_batch_id
          AND bmh.source_batch_id = bt.source_batch_id
          AND bmh.deleted_at IS NULL
          AND bmh.source_type = 'batch_transfer'
          AND ABS(CAST(bmh.volume_added AS numeric) - CAST(bt.volume_transferred AS numeric)) < 0.1
      )
    ORDER BY bt.transferred_at
  `;

  console.log(`Found ${missingMerges.length} blends missing merge history:\n`);

  for (const m of missingMerges) {
    console.log(`  ${m.transferred_at}: ${Number(m.volume_transferred).toFixed(1)}${m.volume_transferred_unit} from ${m.source_name} -> ${m.dest_name}`);
    console.log(`    notes: ${m.notes?.substring(0, 80)}`);

    // Get destination batch volume at transfer time from audit logs
    // We need target_volume_before and target_volume_after
    // Best effort: look at audit logs around the transfer date
    const auditBefore = await sql`
      SELECT old_data, new_data, diff_data
      FROM audit_logs
      WHERE record_id = ${m.destination_batch_id}
        AND table_name = 'batches'
        AND ABS(EXTRACT(EPOCH FROM (changed_at - ${m.transferred_at}::timestamptz))) < 60
      ORDER BY changed_at
      LIMIT 1
    `;

    let volBefore = '0';
    let volAfter = '0';
    if (auditBefore.length > 0) {
      const diff = auditBefore[0].diff_data;
      if (diff?.currentVolume?.__old) volBefore = diff.currentVolume.__old;
      if (diff?.currentVolume?.__new) volAfter = diff.currentVolume.__new;
    }

    // If we couldn't find audit data, compute from the transfer
    if (volBefore === '0' && volAfter === '0') {
      const vol = Number(m.volume_transferred);
      // We don't know the exact before/after, but we can approximate
      volAfter = vol.toString();
      console.log(`    ⚠️  No audit data found, using volume_transferred as approximation`);
    }

    await sql`
      INSERT INTO batch_merge_history (target_batch_id, source_batch_id, source_type,
        volume_added, volume_added_unit,
        target_volume_before, target_volume_before_unit,
        target_volume_after, target_volume_after_unit,
        merged_at, merged_by, created_at)
      VALUES (${m.destination_batch_id}, ${m.source_batch_id}, 'batch_transfer',
        ${m.volume_transferred}, ${m.volume_transferred_unit},
        ${volBefore}, 'L',
        ${volAfter}, 'L',
        ${m.transferred_at}, ${m.transferred_by}, NOW())
    `;
    console.log(`    ✅ Created batch_merge_history record`);
  }

  // ─── 2. Fix Jonathan #1 volume ───
  // The blend on Mar 25 set currentVolume to 943 (650 + 293).
  // But currentVolumeLiters is 956 because the old code read a stale currentVolume
  // of 663 (pre-rack) and computed 663 + 293 = 956.
  // The correct value is 943.
  console.log('\n--- Fixing Jonathan #1 volume ---\n');

  const jonathanName = '2025-11-26_IBC-1000-10_JONA_A';
  const [jonathan] = await sql`SELECT id, current_volume, current_volume_liters FROM batches WHERE name = ${jonathanName}`;
  console.log(`  Current: volume=${jonathan.current_volume}, liters=${jonathan.current_volume_liters}`);

  // The audit log clearly shows the blend computed total as 943 (650 + 293).
  // The 956 came from reading currentVolume=663 (stale pre-rack value).
  // Set both fields to 943 to match what the blend intended.
  if (Number(jonathan.current_volume_liters) === 956) {
    await sql`UPDATE batches SET current_volume = '943', current_volume_liters = '943', updated_at = NOW() WHERE id = ${jonathan.id}`;
    console.log(`  ✅ Corrected Jonathan #1: 956 -> 943 (removing stale pre-rack 13L)`);
  } else {
    console.log(`  ℹ️  Jonathan already at ${jonathan.current_volume_liters}L, no change needed`);
  }

  // ─── Verify ───
  console.log('\n--- Verification ---');

  // Check TES merge history
  const tesId = (await sql`SELECT id FROM batches WHERE name = '2025-10-14_120 Barrel 3_BDBO_A'`)[0].id;
  const tesMerges = await sql`SELECT volume_added, source_type FROM batch_merge_history WHERE target_batch_id = ${tesId} AND deleted_at IS NULL`;
  console.log(`\n  TES merge history: ${tesMerges.length} records`);
  for (const m of tesMerges) console.log(`    ${Number(m.volume_added).toFixed(1)}L (${m.source_type})`);

  // Check Jonathan final volume
  const [jFinal] = await sql`SELECT current_volume, current_volume_liters FROM batches WHERE id = ${jonathan.id}`;
  console.log(`\n  Jonathan #1: volume=${jFinal.current_volume}, liters=${jFinal.current_volume_liters}`);

  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
