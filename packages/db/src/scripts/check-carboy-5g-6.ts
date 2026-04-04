import { db } from '../';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== INVESTIGATION: CARBOY-5G-6 / "OBC Row #5" ===\n');

  // 1. Vessel info
  console.log('--- 1. VESSEL: CARBOY-5G-6 ---');
  const vesselResult = await db.execute(sql`
    SELECT id, name, status, capacity, capacity_unit, capacity_liters, location, notes, created_at
    FROM vessels
    WHERE name ILIKE '%CARBOY-5G-6%'
  `);
  for (const v of vesselResult.rows as any[]) {
    console.log(`  ID: ${v.id}`);
    console.log(`  Name: ${v.name}`);
    console.log(`  Status: ${v.status}`);
    console.log(`  Capacity: ${v.capacity} ${v.capacity_unit} (${v.capacity_liters}L)`);
    console.log(`  Location: ${v.location}`);
    console.log(`  Notes: ${v.notes}`);
  }
  const vesselId = (vesselResult.rows[0] as any)?.id;
  if (!vesselId) {
    console.log('ERROR: Vessel not found!');
    process.exit(1);
  }

  // 2. ALL batches ever associated with this vessel
  console.log('\n--- 2. ALL BATCHES EVER IN THIS VESSEL ---');
  const batchesResult = await db.execute(sql`
    SELECT b.id, b.name, b.batch_number, b.custom_name, b.status,
           b.initial_volume, b.initial_volume_unit, b.initial_volume_liters,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.vessel_id, v.name as current_vessel_name,
           b.created_at, b.deleted_at, b.start_date, b.end_date,
           b.origin_press_run_id, b.parent_batch_id, b.is_racking_derivative,
           b.original_gravity, b.final_gravity, b.estimated_abv, b.actual_abv,
           b.fermentation_stage, b.product_type, b.is_archived,
           b.reconciliation_status, b.reconciliation_notes
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.vessel_id = ${vesselId}
       OR b.id IN (
         SELECT source_batch_id FROM batch_transfers WHERE source_vessel_id = ${vesselId}
         UNION
         SELECT destination_batch_id FROM batch_transfers WHERE destination_vessel_id = ${vesselId}
       )
       OR b.id IN (
         SELECT batch_id FROM batch_racking_operations WHERE source_vessel_id = ${vesselId} OR destination_vessel_id = ${vesselId}
       )
       OR b.id IN (
         SELECT batch_id FROM batch_measurements WHERE id IN (
           SELECT id FROM batch_measurements -- measurements don't have vessel_id directly
         )
       )
    ORDER BY b.created_at ASC
  `);

  // Simplify: just get batches currently or historically in this vessel
  const allBatches = await db.execute(sql`
    SELECT DISTINCT b.id, b.name, b.batch_number, b.custom_name, b.status,
           b.initial_volume, b.initial_volume_unit, b.initial_volume_liters,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.vessel_id, v.name as current_vessel_name,
           b.created_at, b.deleted_at, b.start_date, b.end_date,
           b.origin_press_run_id, b.parent_batch_id, b.is_racking_derivative,
           b.original_gravity, b.final_gravity, b.estimated_abv, b.actual_abv,
           b.fermentation_stage, b.product_type, b.is_archived,
           b.reconciliation_status, b.reconciliation_notes
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.vessel_id = ${vesselId}
    ORDER BY b.created_at ASC
  `);

  console.log(`  Found ${allBatches.rows.length} batch(es) currently assigned to this vessel:`);
  for (const b of allBatches.rows as any[]) {
    console.log(`\n  BATCH: ${b.name} (${b.custom_name || 'no custom name'})`);
    console.log(`    ID: ${b.id}`);
    console.log(`    Batch#: ${b.batch_number}`);
    console.log(`    Status: ${b.status}, Fermentation Stage: ${b.fermentation_stage}`);
    console.log(`    Product Type: ${b.product_type}`);
    console.log(`    Current Vessel: ${b.current_vessel_name} (${b.vessel_id})`);
    console.log(`    Initial Volume: ${b.initial_volume} ${b.initial_volume_unit} (${b.initial_volume_liters}L)`);
    console.log(`    Current Volume: ${b.current_volume} ${b.current_volume_unit} (${b.current_volume_liters}L)`);
    console.log(`    Start Date: ${b.start_date}`);
    console.log(`    End Date: ${b.end_date}`);
    console.log(`    Created: ${b.created_at}`);
    console.log(`    Deleted: ${b.deleted_at}`);
    console.log(`    Origin Press Run: ${b.origin_press_run_id}`);
    console.log(`    Parent Batch: ${b.parent_batch_id}`);
    console.log(`    Is Racking Derivative: ${b.is_racking_derivative}`);
    console.log(`    OG: ${b.original_gravity}, FG: ${b.final_gravity}`);
    console.log(`    ABV Est: ${b.estimated_abv}, Actual: ${b.actual_abv}`);
    console.log(`    Archived: ${b.is_archived}`);
    console.log(`    Reconciliation: ${b.reconciliation_status} - ${b.reconciliation_notes}`);
  }

  // Also check batches that were transferred TO/FROM this vessel
  const transferredBatches = await db.execute(sql`
    SELECT DISTINCT b.id, b.name, b.custom_name, b.status, b.vessel_id, v.name as current_vessel_name,
           b.created_at, b.deleted_at, b.current_volume_liters
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.vessel_id != ${vesselId}
      AND (
        b.id IN (SELECT source_batch_id FROM batch_transfers WHERE source_vessel_id = ${vesselId} OR destination_vessel_id = ${vesselId})
        OR b.id IN (SELECT destination_batch_id FROM batch_transfers WHERE source_vessel_id = ${vesselId} OR destination_vessel_id = ${vesselId})
        OR b.id IN (SELECT batch_id FROM batch_racking_operations WHERE source_vessel_id = ${vesselId} OR destination_vessel_id = ${vesselId})
      )
    ORDER BY b.created_at ASC
  `);
  if (transferredBatches.rows.length > 0) {
    console.log(`\n  Found ${transferredBatches.rows.length} batch(es) transferred to/from this vessel (now elsewhere):`);
    for (const b of transferredBatches.rows as any[]) {
      console.log(`    ${b.name} (${b.custom_name}) - Status: ${b.status}, Now in: ${b.current_vessel_name}, Deleted: ${b.deleted_at}`);
    }
  }

  // 3. For each batch, get detailed history
  const allBatchIds = [
    ...allBatches.rows.map((b: any) => b.id),
    ...transferredBatches.rows.map((b: any) => b.id),
  ];
  const uniqueBatchIds = [...new Set(allBatchIds)];

  for (const batchId of uniqueBatchIds) {
    const batchInfo = [...allBatches.rows, ...transferredBatches.rows].find((b: any) => b.id === batchId) as any;
    console.log(`\n\n=== DETAILED HISTORY FOR: ${batchInfo.name} (${batchInfo.custom_name || 'no name'}) ===`);

    // 3a. Transfers IN
    console.log('\n  --- Transfers IN (destination) ---');
    const transfersIn = await db.execute(sql`
      SELECT bt.*,
             sv.name as source_vessel_name, dv.name as dest_vessel_name,
             sb.name as source_batch_name, sb.custom_name as source_batch_custom_name,
             db.name as dest_batch_name, db.custom_name as dest_batch_custom_name
      FROM batch_transfers bt
      LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN batches db ON db.id = bt.destination_batch_id
      WHERE bt.destination_batch_id = ${batchId}
         OR bt.destination_vessel_id = ${vesselId}
      ORDER BY bt.transferred_at ASC
    `);
    for (const t of transfersIn.rows as any[]) {
      console.log(`    ${t.transferred_at}: ${t.source_batch_name} (${t.source_batch_custom_name}) [${t.source_vessel_name}] -> ${t.dest_batch_name} (${t.dest_batch_custom_name}) [${t.dest_vessel_name}]`);
      console.log(`      Volume: ${t.volume_transferred} ${t.volume_transferred_unit}, Loss: ${t.loss}, Remaining: ${t.remaining_volume}`);
      console.log(`      Notes: ${t.notes}`);
    }

    // 3b. Transfers OUT
    console.log('\n  --- Transfers OUT (source) ---');
    const transfersOut = await db.execute(sql`
      SELECT bt.*,
             sv.name as source_vessel_name, dv.name as dest_vessel_name,
             sb.name as source_batch_name, sb.custom_name as source_batch_custom_name,
             db.name as dest_batch_name, db.custom_name as dest_batch_custom_name
      FROM batch_transfers bt
      LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN batches db ON db.id = bt.destination_batch_id
      WHERE bt.source_batch_id = ${batchId}
      ORDER BY bt.transferred_at ASC
    `);
    for (const t of transfersOut.rows as any[]) {
      console.log(`    ${t.transferred_at}: ${t.source_batch_name} (${t.source_batch_custom_name}) [${t.source_vessel_name}] -> ${t.dest_batch_name} (${t.dest_batch_custom_name}) [${t.dest_vessel_name}]`);
      console.log(`      Volume: ${t.volume_transferred} ${t.volume_transferred_unit}, Loss: ${t.loss}, Remaining: ${t.remaining_volume}`);
      console.log(`      Notes: ${t.notes}`);
    }

    // 3c. Racking operations
    console.log('\n  --- Racking Operations ---');
    const rackings = await db.execute(sql`
      SELECT r.*, sv.name as source_vessel_name, dv.name as dest_vessel_name
      FROM batch_racking_operations r
      LEFT JOIN vessels sv ON sv.id = r.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = r.destination_vessel_id
      WHERE r.batch_id = ${batchId}
      ORDER BY r.racked_at ASC
    `);
    for (const r of rackings.rows as any[]) {
      console.log(`    ${r.racked_at}: ${r.source_vessel_name} -> ${r.dest_vessel_name}`);
      console.log(`      Before: ${r.volume_before} ${r.volume_before_unit}, After: ${r.volume_after} ${r.volume_after_unit}, Loss: ${r.volume_loss}`);
      console.log(`      Notes: ${r.notes}`);
    }

    // 3d. Measurements
    console.log('\n  --- Measurements ---');
    const measurements = await db.execute(sql`
      SELECT * FROM batch_measurements
      WHERE batch_id = ${batchId}
      ORDER BY measurement_date ASC
    `);
    for (const m of measurements.rows as any[]) {
      console.log(`    ${m.measurement_date}: SG=${m.specific_gravity}, pH=${m.ph}, ABV=${m.abv}, Vol=${m.volume} ${m.volume_unit}`);
      console.log(`      Notes: ${m.notes}`);
      console.log(`      Is Estimated: ${m.is_estimated}, Source: ${m.estimate_source}`);
      console.log(`      Sensory: ${m.sensory_notes}`);
    }

    // 3e. Additives
    console.log('\n  --- Additives ---');
    const additives = await db.execute(sql`
      SELECT ba.*, v.name as vessel_name
      FROM batch_additives ba
      LEFT JOIN vessels v ON v.id = ba.vessel_id
      WHERE ba.batch_id = ${batchId}
      ORDER BY ba.added_at ASC
    `);
    for (const a of additives.rows as any[]) {
      console.log(`    ${a.added_at}: ${a.additive_name} (${a.additive_type}) - ${a.amount} ${a.unit} in ${a.vessel_name}`);
      console.log(`      Notes: ${a.notes}`);
    }

    // 3f. Press run origin
    const batchRow = [...allBatches.rows, ...transferredBatches.rows].find((b: any) => b.id === batchId) as any;
    if (batchRow?.origin_press_run_id) {
      console.log('\n  --- Origin Press Run ---');
      const pressRun = await db.execute(sql`
        SELECT pr.*, v.name as vessel_name
        FROM press_runs pr
        LEFT JOIN vessels v ON v.id = pr.vessel_id
        WHERE pr.id = ${batchRow.origin_press_run_id}
      `);
      for (const pr of pressRun.rows as any[]) {
        console.log(`    Press Run: ${pr.press_run_name}, Status: ${pr.status}`);
        console.log(`    Date: ${pr.date_completed}`);
        console.log(`    Vessel: ${pr.vessel_name}`);
        console.log(`    Total Weight: ${pr.total_apple_weight_kg}kg, Juice: ${pr.total_juice_volume}L`);
      }
    }

    // 3g. Batch compositions
    console.log('\n  --- Batch Compositions ---');
    const compositions = await db.execute(sql`
      SELECT bc.*,
             bfv.name as fruit_variety_name,
             v.name as vendor_name
      FROM batch_compositions bc
      LEFT JOIN base_fruit_varieties bfv ON bfv.id = bc.variety_id
      LEFT JOIN vendors v ON v.id = bc.vendor_id
      WHERE bc.batch_id = ${batchId}
      ORDER BY bc.created_at ASC
    `);
    for (const c of compositions.rows as any[]) {
      console.log(`    Source: ${c.source_type}, Variety: ${c.fruit_variety_name}, Vendor: ${c.vendor_name}`);
      console.log(`    Weight: ${c.input_weight_kg}kg, Juice Vol: ${c.juice_volume} ${c.juice_volume_unit}`);
      console.log(`    Fraction: ${c.fraction_of_batch}, Cost: $${c.material_cost}`);
      console.log(`    Brix: ${c.avg_brix}, ABV: ${c.abv}`);
    }
  }

  // 4. Check for overlapping batches in this vessel
  console.log('\n\n=== 4. OVERLAPPING BATCH CHECK ===');
  const overlapCheck = await db.execute(sql`
    SELECT b1.name as batch1, b1.custom_name as name1, b1.start_date as start1, b1.end_date as end1, b1.status as status1,
           b2.name as batch2, b2.custom_name as name2, b2.start_date as start2, b2.end_date as end2, b2.status as status2
    FROM batches b1
    JOIN batches b2 ON b1.id < b2.id
    WHERE b1.vessel_id = ${vesselId}
      AND b2.vessel_id = ${vesselId}
      AND b1.deleted_at IS NULL
      AND b2.deleted_at IS NULL
  `);
  if (overlapCheck.rows.length === 0) {
    console.log('  No overlapping batches found (only one active batch in vessel at a time).');
  } else {
    console.log('  WARNING: Multiple batches currently assigned to this vessel:');
    for (const o of overlapCheck.rows as any[]) {
      console.log(`    ${o.batch1} (${o.name1}) ${o.start1}-${o.end1} [${o.status1}]`);
      console.log(`    ${o.batch2} (${o.name2}) ${o.start2}-${o.end2} [${o.status2}]`);
    }
  }

  // 5. Check audit logs for this vessel and its batches
  console.log('\n\n=== 5. AUDIT LOGS FOR VESSEL AND BATCHES ===');
  const auditLogs = await db.execute(sql`
    SELECT al.table_name, al.record_id, al.operation, al.diff_data, al.changed_at,
           al.changed_by_email, al.reason
    FROM audit_logs al
    WHERE (al.table_name = 'vessels' AND al.record_id = ${vesselId})
       OR (al.table_name = 'batches' AND al.record_id IN (
         SELECT id FROM batches WHERE vessel_id = ${vesselId}
       ))
    ORDER BY al.changed_at ASC
  `);
  console.log(`  Found ${auditLogs.rows.length} audit log entries:`);
  for (const al of auditLogs.rows as any[]) {
    const diff = typeof al.diff_data === 'string' ? JSON.parse(al.diff_data) : al.diff_data;
    console.log(`    ${al.changed_at}: [${al.table_name}] ${al.operation} by ${al.changed_by_email}`);
    if (diff && Object.keys(diff).length > 0) {
      const interesting = ['status', 'vessel_id', 'custom_name', 'current_volume', 'name'];
      for (const key of Object.keys(diff)) {
        if (interesting.includes(key) || Object.keys(diff).length <= 5) {
          console.log(`      ${key}: ${JSON.stringify(diff[key])}`);
        }
      }
    }
  }

  // 5b. Check batch_merge_history for this batch
  console.log('\n\n=== 5b. MERGE HISTORY ===');
  const mergeHistory = await db.execute(sql`
    SELECT bmh.*,
           sb.name as source_batch_name, sb.custom_name as source_custom_name,
           tb.name as target_batch_name, tb.custom_name as target_custom_name
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
    LEFT JOIN batches tb ON tb.id = bmh.target_batch_id
    WHERE bmh.source_batch_id IN (SELECT id FROM batches WHERE vessel_id = ${vesselId})
       OR bmh.target_batch_id IN (SELECT id FROM batches WHERE vessel_id = ${vesselId})
    ORDER BY bmh.merged_at ASC
  `);
  console.log(`  Found ${mergeHistory.rows.length} merge history entries:`);
  for (const m of mergeHistory.rows as any[]) {
    console.log(`    ${m.merged_at}: Source: ${m.source_batch_name} (${m.source_custom_name}) -> Target: ${m.target_batch_name} (${m.target_custom_name})`);
    console.log(`      Type: ${m.source_type}, Volume: ${m.volume_added} ${m.volume_added_unit}`);
    console.log(`      Deleted: ${m.deleted_at}`);
  }

  // 5c. Check ancestor chain via recursive CTE (same as activity history uses)
  console.log('\n\n=== 5c. ANCESTOR CHAIN (what activity history would trace) ===');
  const currentBatchId = (allBatches.rows[0] as any)?.id;
  if (currentBatchId) {
    const ancestors = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT
          bt.source_batch_id as batch_id,
          b.name as batch_name,
          b.custom_name,
          bt.transferred_at as split_timestamp,
          b.start_date,
          b.vessel_id,
          v.name as vessel_name,
          1 as depth
        FROM batch_transfers bt
        JOIN batches b ON b.id = bt.source_batch_id
        LEFT JOIN vessels v ON v.id = b.vessel_id
        WHERE (bt.remaining_batch_id = ${currentBatchId} OR bt.destination_batch_id = ${currentBatchId})
          AND bt.source_batch_id != ${currentBatchId}
          AND bt.deleted_at IS NULL

        UNION

        SELECT
          bmh.source_batch_id as batch_id,
          b.name as batch_name,
          b.custom_name,
          bmh.merged_at as split_timestamp,
          b.start_date,
          b.vessel_id,
          v.name as vessel_name,
          1 as depth
        FROM batch_merge_history bmh
        JOIN batches b ON b.id = bmh.source_batch_id
        LEFT JOIN vessels v ON v.id = b.vessel_id
        WHERE bmh.target_batch_id = ${currentBatchId}
          AND bmh.source_batch_id != ${currentBatchId}
          AND bmh.source_type = 'batch_transfer'
          AND bmh.deleted_at IS NULL

        UNION ALL

        SELECT
          COALESCE(bt.source_batch_id, bmh2.source_batch_id) as batch_id,
          b.name,
          b.custom_name,
          COALESCE(bt.transferred_at, bmh2.merged_at) as split_timestamp,
          b.start_date,
          b.vessel_id,
          v.name as vessel_name,
          a.depth + 1
        FROM ancestors a
        LEFT JOIN batch_transfers bt ON (bt.remaining_batch_id = a.batch_id OR bt.destination_batch_id = a.batch_id)
          AND bt.source_batch_id != a.batch_id
          AND bt.deleted_at IS NULL
        LEFT JOIN batch_merge_history bmh2 ON bmh2.target_batch_id = a.batch_id
          AND bmh2.source_batch_id != a.batch_id
          AND bmh2.source_type = 'batch_transfer'
          AND bmh2.deleted_at IS NULL
        JOIN batches b ON b.id = COALESCE(bt.source_batch_id, bmh2.source_batch_id)
        LEFT JOIN vessels v ON v.id = b.vessel_id
        WHERE COALESCE(bt.source_batch_id, bmh2.source_batch_id) IS NOT NULL
          AND a.depth < 10
      )
      SELECT DISTINCT ON (batch_id) * FROM ancestors ORDER BY batch_id, depth DESC
    `);
    console.log(`  Found ${ancestors.rows.length} ancestor batch(es):`);
    for (const a of ancestors.rows as any[]) {
      console.log(`    Depth ${a.depth}: ${a.batch_name} (${a.custom_name}) in ${a.vessel_name}`);
      console.log(`      Split timestamp: ${a.split_timestamp}, Start date: ${a.start_date}`);

      // Show what measurements/additives exist for this ancestor
      const ancestorMeasurements = await db.execute(sql`
        SELECT measurement_date, specific_gravity, ph, notes FROM batch_measurements
        WHERE batch_id = ${a.batch_id} ORDER BY measurement_date ASC
      `);
      if (ancestorMeasurements.rows.length > 0) {
        console.log(`      Measurements:`);
        for (const m of ancestorMeasurements.rows as any[]) {
          console.log(`        ${m.measurement_date}: SG=${m.specific_gravity}, pH=${m.ph} - ${m.notes}`);
        }
      }
      const ancestorAdditives = await db.execute(sql`
        SELECT added_at, additive_name, amount, unit FROM batch_additives
        WHERE batch_id = ${a.batch_id} ORDER BY added_at ASC
      `);
      if (ancestorAdditives.rows.length > 0) {
        console.log(`      Additives:`);
        for (const ad of ancestorAdditives.rows as any[]) {
          console.log(`        ${ad.added_at}: ${ad.additive_name} ${ad.amount} ${ad.unit}`);
        }
      }
    }

    if (ancestors.rows.length === 0) {
      console.log('  No ancestors found - this batch has no transfer/merge lineage.');
    }
  }

  // 6. Check the BatchHistoryModal query - what does the activity history actually show?
  console.log('\n\n=== 6. ACTIVITY HISTORY RECONSTRUCTION ===');
  console.log('  Reconstructing what the UI would show for the batch currently in this vessel...\n');

  const currentBatch = allBatches.rows[0] as any; // Should be the current batch
  if (currentBatch) {
    // Get ALL activity for this batch by checking what the BatchHistoryModal queries
    // It typically unions: measurements, additives, rackings, transfers, status changes, etc.

    // Check if there's a parent_batch_id chain
    console.log(`  Current batch: ${currentBatch.name} (${currentBatch.custom_name})`);
    console.log(`  Parent batch ID: ${currentBatch.parent_batch_id}`);
    console.log(`  Is racking derivative: ${currentBatch.is_racking_derivative}`);

    if (currentBatch.parent_batch_id) {
      console.log('\n  --- Parent Batch Chain ---');
      let parentId = currentBatch.parent_batch_id;
      let depth = 0;
      while (parentId && depth < 10) {
        const parent = await db.execute(sql`
          SELECT id, name, custom_name, status, vessel_id, parent_batch_id, is_racking_derivative,
                 origin_press_run_id, created_at, deleted_at, current_volume_liters
          FROM batches WHERE id = ${parentId}
        `);
        if (parent.rows.length === 0) break;
        const p = parent.rows[0] as any;
        const pVessel = await db.execute(sql`SELECT name FROM vessels WHERE id = ${p.vessel_id}`);
        const vName = (pVessel.rows[0] as any)?.name || 'no vessel';
        console.log(`  ${'  '.repeat(depth)}Parent: ${p.name} (${p.custom_name}) in ${vName} - Status: ${p.status}, Racking Deriv: ${p.is_racking_derivative}`);
        console.log(`  ${'  '.repeat(depth)}  Press Run: ${p.origin_press_run_id}, Created: ${p.created_at}, Deleted: ${p.deleted_at}`);
        parentId = p.parent_batch_id;
        depth++;
      }
    }

    // Also check: are there OTHER batches sharing the same origin press run?
    if (currentBatch.origin_press_run_id) {
      console.log('\n  --- Other Batches From Same Press Run ---');
      const siblings = await db.execute(sql`
        SELECT b.id, b.name, b.custom_name, b.status, b.vessel_id, v.name as vessel_name,
               b.created_at, b.deleted_at, b.current_volume_liters, b.is_racking_derivative, b.parent_batch_id
        FROM batches b
        LEFT JOIN vessels v ON v.id = b.vessel_id
        WHERE b.origin_press_run_id = ${currentBatch.origin_press_run_id}
        ORDER BY b.created_at ASC
      `);
      for (const s of siblings.rows as any[]) {
        const marker = s.id === currentBatch.id ? ' <<< CURRENT' : '';
        console.log(`    ${s.name} (${s.custom_name}) in ${s.vessel_name} - Status: ${s.status}, Racking Deriv: ${s.is_racking_derivative}, Parent: ${s.parent_batch_id}${marker}`);
      }
    }
  }

  console.log('\n\n=== INVESTIGATION COMPLETE ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
