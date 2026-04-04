import { db } from '../';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('='.repeat(80));
  console.log('INVESTIGATION: DRUM-120-3 "Red Currant" — Ghost Batch Check');
  console.log('='.repeat(80));

  // 1. Vessel info
  console.log('\n--- 1. VESSEL DRUM-120-3 ---');
  const vesselResult = await db.execute(sql`
    SELECT v.id, v.name, v.capacity, v.capacity_unit, v.status, v.deleted_at,
           b.id AS active_batch_id, b.name AS active_batch_name, b.custom_name AS active_batch_custom_name,
           b.status AS active_batch_status, b.current_volume_liters
    FROM vessels v
    LEFT JOIN batches b ON b.vessel_id = v.id AND b.deleted_at IS NULL AND b.status NOT IN ('completed', 'discarded')
    WHERE v.name ILIKE '%DRUM-120-3%'
  `);
  for (const row of vesselResult.rows as any[]) {
    console.log(`  Vessel ID: ${row.id}`);
    console.log(`  Name: ${row.name}`);
    console.log(`  Capacity: ${row.capacity} ${row.capacity_unit}`);
    console.log(`  Vessel Status: ${row.status}`);
    console.log(`  Deleted: ${row.deleted_at || 'No'}`);
    if (row.active_batch_id) {
      console.log(`  Active Batch: ${row.active_batch_name} (${row.active_batch_custom_name})`);
      console.log(`    Batch Status: ${row.active_batch_status}`);
      console.log(`    Current Volume (L): ${row.current_volume_liters}`);
    } else {
      console.log(`  Active Batch: NONE`);
    }
  }
  if (vesselResult.rows.length === 0) {
    console.log('  *** VESSEL NOT FOUND ***');
  }

  // Get vessel ID for subsequent queries
  const vesselId = (vesselResult.rows[0] as any)?.id;
  if (!vesselId) {
    console.log('\nCannot proceed without vessel ID.');
    process.exit(1);
  }

  // 2. ALL batches ever associated with this vessel
  console.log('\n--- 2. ALL BATCHES EVER IN THIS VESSEL (including deleted/completed) ---');
  const allBatches = await db.execute(sql`
    SELECT id, batch_number, name, custom_name, status, product_type,
           initial_volume_liters, current_volume_liters,
           vessel_id, is_archived, deleted_at, created_at, end_date,
           parent_batch_id, is_racking_derivative
    FROM batches
    WHERE vessel_id = ${vesselId}
    ORDER BY created_at DESC
  `);
  console.log(`  Total batches found: ${allBatches.rows.length}`);
  for (const b of allBatches.rows as any[]) {
    console.log(`\n  Batch: ${b.name} (${b.custom_name || 'no custom name'})`);
    console.log(`    ID: ${b.id}`);
    console.log(`    Batch #: ${b.batch_number}`);
    console.log(`    Status: ${b.status}`);
    console.log(`    Product Type: ${b.product_type}`);
    console.log(`    Initial Volume (L): ${b.initial_volume_liters}`);
    console.log(`    Current Volume (L): ${b.current_volume_liters}`);
    console.log(`    Vessel ID: ${b.vessel_id}`);
    console.log(`    Archived: ${b.is_archived}`);
    console.log(`    Created: ${b.created_at}`);
    console.log(`    End Date: ${b.end_date || 'null'}`);
    console.log(`    Deleted At: ${b.deleted_at || 'null'}`);
    console.log(`    Parent Batch: ${b.parent_batch_id || 'null'}`);
    console.log(`    Is Racking Derivative: ${b.is_racking_derivative}`);
  }

  // Also check batches with "Red Currant" in name regardless of vessel
  console.log('\n--- 2b. ALL "RED CURRANT" BATCHES (any vessel) ---');
  const redCurrantBatches = await db.execute(sql`
    SELECT b.id, b.batch_number, b.name, b.custom_name, b.status, b.product_type,
           b.initial_volume_liters, b.current_volume_liters,
           b.vessel_id, v.name AS vessel_name, b.is_archived, b.deleted_at, b.created_at, b.end_date
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.custom_name ILIKE '%red currant%' OR b.name ILIKE '%red currant%'
    ORDER BY b.created_at DESC
  `);
  console.log(`  Total "Red Currant" batches found: ${redCurrantBatches.rows.length}`);
  for (const b of redCurrantBatches.rows as any[]) {
    console.log(`\n  Batch: ${b.name} (${b.custom_name || 'no custom name'})`);
    console.log(`    ID: ${b.id}`);
    console.log(`    Status: ${b.status} | Vessel: ${b.vessel_name} (${b.vessel_id})`);
    console.log(`    Initial Vol (L): ${b.initial_volume_liters} | Current Vol (L): ${b.current_volume_liters}`);
    console.log(`    Archived: ${b.is_archived} | Deleted: ${b.deleted_at || 'null'}`);
    console.log(`    Created: ${b.created_at} | End Date: ${b.end_date || 'null'}`);
  }

  // 3. Packaging runs (bottle runs and keg fills) for batches from this vessel
  console.log('\n--- 3. PACKAGING RUNS FOR BATCHES IN THIS VESSEL ---');
  const bottleRuns = await db.execute(sql`
    SELECT br.id, br.batch_id, b.name AS batch_name, b.custom_name,
           br.packaged_at, br.package_type, br.package_size_ml, br.units_produced,
           br.volume_taken, br.volume_taken_unit, br.volume_taken_liters,
           br.loss, br.status, br.voided_at
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE b.vessel_id = ${vesselId} OR br.vessel_id = ${vesselId}
    ORDER BY br.packaged_at DESC
  `);
  console.log(`  Bottle runs found: ${bottleRuns.rows.length}`);
  for (const br of bottleRuns.rows as any[]) {
    console.log(`\n  Bottle Run: ${br.id}`);
    console.log(`    Batch: ${br.batch_name} (${br.custom_name})`);
    console.log(`    Packaged At: ${br.packaged_at}`);
    console.log(`    Type: ${br.package_type} | Size: ${br.package_size_ml}ml`);
    console.log(`    Units: ${br.units_produced} | Volume Taken: ${br.volume_taken} ${br.volume_taken_unit} (${br.volume_taken_liters}L)`);
    console.log(`    Loss: ${br.loss} | Status: ${br.status}`);
    console.log(`    Voided: ${br.voided_at || 'null'}`);
  }

  // Also check "Red Currant" batches in any vessel for packaging
  const rcBottleRuns = await db.execute(sql`
    SELECT br.id, br.batch_id, b.name AS batch_name, b.custom_name,
           br.packaged_at, br.package_type, br.units_produced,
           br.volume_taken, br.volume_taken_unit, br.volume_taken_liters,
           br.status, br.voided_at
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE (b.custom_name ILIKE '%red currant%' OR b.name ILIKE '%red currant%')
      AND b.vessel_id != ${vesselId}
    ORDER BY br.packaged_at DESC
  `);
  if (rcBottleRuns.rows.length > 0) {
    console.log(`\n  Additional bottle runs for "Red Currant" in OTHER vessels: ${rcBottleRuns.rows.length}`);
    for (const br of rcBottleRuns.rows as any[]) {
      console.log(`    Run ${br.id}: ${br.batch_name} - ${br.units_produced} units, ${br.volume_taken} ${br.volume_taken_unit}, status=${br.status}`);
    }
  }

  const kegFills = await db.execute(sql`
    SELECT kf.id, kf.batch_id, b.name AS batch_name, b.custom_name,
           kf.filled_at, kf.volume_taken, kf.volume_taken_unit, kf.loss,
           kf.status, kf.voided_at, kf.deleted_at
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id
    WHERE b.vessel_id = ${vesselId} OR kf.vessel_id = ${vesselId}
    ORDER BY kf.filled_at DESC
  `);
  console.log(`\n  Keg fills found: ${kegFills.rows.length}`);
  for (const kf of kegFills.rows as any[]) {
    console.log(`    Keg Fill: ${kf.id} | Batch: ${kf.batch_name} (${kf.custom_name})`);
    console.log(`    Filled At: ${kf.filled_at} | Volume Taken: ${kf.volume_taken} ${kf.volume_taken_unit} | Loss: ${kf.loss}`);
    console.log(`    Status: ${kf.status} | Voided: ${kf.voided_at || 'null'} | Deleted: ${kf.deleted_at || 'null'}`);
  }

  // 4. Transfers involving this vessel
  console.log('\n--- 4. TRANSFERS FROM/TO THIS VESSEL ---');
  const transfers = await db.execute(sql`
    SELECT bt.id,
           bt.source_batch_id, sb.name AS source_batch_name, sb.custom_name AS source_custom,
           bt.source_vessel_id, sv.name AS source_vessel_name,
           bt.destination_batch_id, db.name AS dest_batch_name, db.custom_name AS dest_custom,
           bt.destination_vessel_id, dv.name AS dest_vessel_name,
           bt.remaining_batch_id, rb.name AS remaining_batch_name,
           bt.volume_transferred, bt.volume_transferred_unit,
           bt.loss, bt.remaining_volume,
           bt.transferred_at, bt.deleted_at
    FROM batch_transfers bt
    JOIN batches sb ON sb.id = bt.source_batch_id
    JOIN vessels sv ON sv.id = bt.source_vessel_id
    JOIN batches db ON db.id = bt.destination_batch_id
    JOIN vessels dv ON dv.id = bt.destination_vessel_id
    LEFT JOIN batches rb ON rb.id = bt.remaining_batch_id
    WHERE bt.source_vessel_id = ${vesselId} OR bt.destination_vessel_id = ${vesselId}
    ORDER BY bt.transferred_at DESC
  `);
  console.log(`  Transfers found: ${transfers.rows.length}`);
  for (const t of transfers.rows as any[]) {
    console.log(`\n  Transfer: ${t.id}`);
    console.log(`    From: ${t.source_batch_name} (${t.source_custom}) in ${t.source_vessel_name}`);
    console.log(`    To: ${t.dest_batch_name} (${t.dest_custom}) in ${t.dest_vessel_name}`);
    console.log(`    Volume: ${t.volume_transferred} ${t.volume_transferred_unit} | Loss: ${t.loss} | Remaining: ${t.remaining_volume}`);
    if (t.remaining_batch_id) {
      console.log(`    Remaining Batch: ${t.remaining_batch_name} (${t.remaining_batch_id})`);
    }
    console.log(`    Date: ${t.transferred_at} | Deleted: ${t.deleted_at || 'null'}`);
  }

  // 5. Check for completed/packaged batch AND active batch for same product
  console.log('\n--- 5. DUPLICATE/GHOST BATCH CHECK ---');
  const batchIds = (allBatches.rows as any[]).map(b => b.id);
  if (batchIds.length > 0) {
    // Check volume adjustments
    const adjustments = await db.execute(sql`
      SELECT bva.id, bva.batch_id, b.name AS batch_name,
             bva.adjustment_type, bva.volume_before, bva.volume_after, bva.adjustment_amount,
             bva.reason, bva.notes, bva.created_at
      FROM batch_volume_adjustments bva
      JOIN batches b ON b.id = bva.batch_id
      WHERE b.vessel_id = ${vesselId}
      ORDER BY bva.created_at DESC
    `);
    if (adjustments.rows.length > 0) {
      console.log(`\n  Volume adjustments for batches in this vessel: ${adjustments.rows.length}`);
      for (const a of adjustments.rows as any[]) {
        console.log(`    ${a.batch_name}: ${a.adjustment_type} ${a.volume_before}L -> ${a.volume_after}L (${a.adjustment_amount}L) - ${a.reason} ${a.notes || ''} (${a.created_at})`);
      }
    }

    // Check packaging runs for ALL Red Currant batches (not just this vessel)
    const rcPackaging = await db.execute(sql`
      SELECT br.id, br.batch_id, b.name AS batch_name, b.custom_name,
             br.packaged_at, br.package_type, br.package_size_ml, br.units_produced,
             br.volume_taken, br.volume_taken_unit, br.volume_taken_liters,
             br.status, br.voided_at, br.vessel_id, v.name AS run_vessel_name
      FROM bottle_runs br
      JOIN batches b ON b.id = br.batch_id
      LEFT JOIN vessels v ON v.id = br.vessel_id
      WHERE b.custom_name ILIKE '%red currant%' OR b.name ILIKE '%red currant%'
      ORDER BY br.packaged_at DESC
    `);
    console.log(`\n  ALL packaging runs for ANY "Red Currant" batch: ${rcPackaging.rows.length}`);
    for (const br of rcPackaging.rows as any[]) {
      console.log(`    Run ${br.id}:`);
      console.log(`      Batch: ${br.batch_name} (${br.custom_name}) [${br.batch_id}]`);
      console.log(`      Vessel: ${br.run_vessel_name} | Packaged: ${br.packaged_at}`);
      console.log(`      Type: ${br.package_type} ${br.package_size_ml}ml x ${br.units_produced} = ${br.volume_taken} ${br.volume_taken_unit}`);
      console.log(`      Status: ${br.status} | Voided: ${br.voided_at || 'null'}`);
    }

    // Check the parent batch chain
    console.log(`\n  Parent batch chain for the active Red Currant batch:`);
    const parentId = (allBatches.rows[0] as any)?.parent_batch_id;
    if (parentId) {
      const parent = await db.execute(sql`
        SELECT id, name, custom_name, status, current_volume_liters, vessel_id,
               deleted_at, parent_batch_id
        FROM batches WHERE id = ${parentId}
      `);
      for (const p of parent.rows as any[]) {
        console.log(`    Parent: ${p.name} (${p.custom_name})`);
        console.log(`      Status: ${p.status} | Volume: ${p.current_volume_liters}L | Deleted: ${p.deleted_at || 'null'}`);
      }
    }

    // Check transfers specifically for the Red Currant batch that was packaged
    console.log(`\n  Transfers for the COMPLETED Red Currant batches:`);
    const completedRcIds = (redCurrantBatches.rows as any[])
      .filter((b: any) => b.status === 'completed')
      .map((b: any) => b.id);
    for (const cid of completedRcIds) {
      const xfers = await db.execute(sql`
        SELECT bt.id, bt.source_batch_id, sb.name AS src_name,
               bt.destination_batch_id, db.name AS dst_name,
               bt.volume_transferred, bt.transferred_at, bt.deleted_at,
               sv.name AS src_vessel, dv.name AS dst_vessel
        FROM batch_transfers bt
        JOIN batches sb ON sb.id = bt.source_batch_id
        JOIN batches db ON db.id = bt.destination_batch_id
        JOIN vessels sv ON sv.id = bt.source_vessel_id
        JOIN vessels dv ON dv.id = bt.destination_vessel_id
        WHERE bt.source_batch_id = ${cid} OR bt.destination_batch_id = ${cid}
        ORDER BY bt.transferred_at DESC
      `);
      for (const x of xfers.rows as any[]) {
        console.log(`    ${x.src_name} (${x.src_vessel}) -> ${x.dst_name} (${x.dst_vessel}): ${x.volume_transferred}L at ${x.transferred_at} ${x.deleted_at ? '[DELETED]' : ''}`);
      }
    }
  }

  // Summary analysis
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY ANALYSIS');
  console.log('='.repeat(80));

  const activeBatches = (allBatches.rows as any[]).filter(b => !b.deleted_at && !['completed', 'discarded'].includes(b.status));
  const completedBatches = (allBatches.rows as any[]).filter(b => !b.deleted_at && b.status === 'completed');
  const deletedBatches = (allBatches.rows as any[]).filter(b => b.deleted_at);
  const packagedTotal = (bottleRuns.rows as any[]).filter(br => !br.voided_at).reduce((sum: number, br: any) => sum + parseFloat(br.volume_taken_liters || br.volume_taken || '0'), 0);

  console.log(`  Active (non-completed, non-deleted) batches in vessel: ${activeBatches.length}`);
  for (const b of activeBatches) {
    console.log(`    - ${b.name} (${b.custom_name}): ${b.current_volume_liters}L, status=${b.status}`);
  }
  console.log(`  Completed batches: ${completedBatches.length}`);
  for (const b of completedBatches) {
    console.log(`    - ${b.name} (${b.custom_name}): ${b.current_volume_liters}L`);
  }
  console.log(`  Deleted batches: ${deletedBatches.length}`);
  console.log(`  Total volume packaged (bottle runs): ${packagedTotal.toFixed(2)}L`);

  if (activeBatches.length > 0 && (completedBatches.length > 0 || packagedTotal > 0)) {
    console.log('\n  *** LIKELY ISSUE: Active batch exists alongside completed/packaged batches. ***');
    console.log('  This batch may be a ghost — its volume should have been decremented or status set to completed after packaging.');
  } else if (activeBatches.length > 0 && packagedTotal === 0 && bottleRuns.rows.length === 0) {
    console.log('\n  *** No packaging runs found. Batch appears to not have been packaged yet. ***');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
