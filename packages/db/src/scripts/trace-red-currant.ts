import { db } from '../';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('='.repeat(80));
  console.log('RED CURRANT BATCH LINEAGE TRACE');
  console.log('='.repeat(80));

  // ── 1. ALL batches with custom_name containing "Red Currant" ──────────────
  console.log('\n\n📋 SECTION 1: All batches with "Red Currant" in custom_name\n');

  const redCurrantBatches = await db.execute(sql`
    SELECT
      b.id,
      b.batch_number,
      b.name,
      b.custom_name,
      b.status,
      b.current_volume,
      b.current_volume_unit,
      b.initial_volume,
      b.vessel_id,
      b.parent_batch_id,
      b.is_racking_derivative,
      b.origin_press_run_id,
      b.created_at,
      b.deleted_at,
      b.is_archived,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.custom_name ILIKE '%red currant%'
    ORDER BY b.created_at ASC
  `);

  const rcRows = redCurrantBatches.rows as any[];
  console.log(`Found ${rcRows.length} batches with "Red Currant" custom name:\n`);

  for (const b of rcRows) {
    console.log(`  ID: ${b.id}`);
    console.log(`  Batch #: ${b.batch_number}`);
    console.log(`  Name: ${b.name}`);
    console.log(`  Custom Name: ${b.custom_name}`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Volume: ${b.initial_volume} -> ${b.current_volume} ${b.current_volume_unit}`);
    console.log(`  Vessel: ${b.vessel_name || 'NONE'} (${b.vessel_id || 'no vessel'})`);
    console.log(`  Parent Batch ID: ${b.parent_batch_id || 'NONE (root)'}`);
    console.log(`  Is Racking Derivative: ${b.is_racking_derivative}`);
    console.log(`  Created: ${b.created_at}`);
    console.log(`  Deleted: ${b.deleted_at || 'NOT DELETED'}`);
    console.log(`  Archived: ${b.is_archived}`);
    console.log('  ---');
  }

  // ── 2. For EACH Red Currant batch, find transfers and packaging ───────────
  console.log('\n\n📋 SECTION 2: Transfer history for each Red Currant batch\n');

  for (const b of rcRows) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`BATCH: ${b.custom_name} | ${b.name}`);
    console.log(`  ID: ${b.id}`);
    console.log(`${'─'.repeat(60)}`);

    // Incoming transfers (this batch is destination)
    const incomingTransfers = await db.execute(sql`
      SELECT
        bt.id AS transfer_id,
        bt.source_batch_id,
        bt.source_vessel_id,
        bt.destination_batch_id,
        bt.destination_vessel_id,
        bt.volume_transferred,
        bt.volume_transferred_unit,
        bt.loss,
        bt.remaining_volume,
        bt.notes,
        bt.transferred_at,
        bt.deleted_at AS transfer_deleted_at,
        sb.name AS source_batch_name,
        sb.custom_name AS source_custom_name,
        sb.batch_number AS source_batch_number,
        sb.status AS source_status,
        sv.name AS source_vessel_name,
        dv.name AS dest_vessel_name
      FROM batch_transfers bt
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
      WHERE bt.destination_batch_id = ${b.id}
      ORDER BY bt.transferred_at ASC
    `);

    console.log(`\n  INCOMING TRANSFERS (${(incomingTransfers.rows as any[]).length}):`);
    for (const t of incomingTransfers.rows as any[]) {
      console.log(`    Transfer ID: ${t.transfer_id}`);
      console.log(`    From: ${t.source_custom_name || t.source_batch_name} (${t.source_batch_number})`);
      console.log(`    Source Batch ID: ${t.source_batch_id}`);
      console.log(`    Source Vessel: ${t.source_vessel_name}`);
      console.log(`    To Vessel: ${t.dest_vessel_name}`);
      console.log(`    Volume: ${t.volume_transferred} ${t.volume_transferred_unit}`);
      console.log(`    Loss: ${t.loss}`);
      console.log(`    Remaining in source: ${t.remaining_volume}`);
      console.log(`    Date: ${t.transferred_at}`);
      console.log(`    Notes: ${t.notes || 'none'}`);
      console.log(`    Transfer Deleted: ${t.transfer_deleted_at || 'NO'}`);
      console.log(`    Source Batch Status: ${t.source_status}`);
      console.log('    ...');
    }

    // Outgoing transfers (this batch is source)
    const outgoingTransfers = await db.execute(sql`
      SELECT
        bt.id AS transfer_id,
        bt.source_batch_id,
        bt.destination_batch_id,
        bt.destination_vessel_id,
        bt.volume_transferred,
        bt.volume_transferred_unit,
        bt.loss,
        bt.remaining_volume,
        bt.remaining_batch_id,
        bt.notes,
        bt.transferred_at,
        bt.deleted_at AS transfer_deleted_at,
        db.name AS dest_batch_name,
        db.custom_name AS dest_custom_name,
        db.batch_number AS dest_batch_number,
        db.status AS dest_status,
        db.current_volume AS dest_current_volume,
        db.deleted_at AS dest_batch_deleted_at,
        dv.name AS dest_vessel_name
      FROM batch_transfers bt
      LEFT JOIN batches db ON db.id = bt.destination_batch_id
      LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
      WHERE bt.source_batch_id = ${b.id}
      ORDER BY bt.transferred_at ASC
    `);

    console.log(`\n  OUTGOING TRANSFERS (${(outgoingTransfers.rows as any[]).length}):`);
    for (const t of outgoingTransfers.rows as any[]) {
      console.log(`    Transfer ID: ${t.transfer_id}`);
      console.log(`    To: ${t.dest_custom_name || t.dest_batch_name} (${t.dest_batch_number})`);
      console.log(`    Dest Batch ID: ${t.destination_batch_id}`);
      console.log(`    Dest Vessel: ${t.dest_vessel_name}`);
      console.log(`    Volume: ${t.volume_transferred} ${t.volume_transferred_unit}`);
      console.log(`    Loss: ${t.loss}`);
      console.log(`    Remaining in source: ${t.remaining_volume}`);
      console.log(`    Remaining Batch ID: ${t.remaining_batch_id || 'NONE'}`);
      console.log(`    Date: ${t.transferred_at}`);
      console.log(`    Notes: ${t.notes || 'none'}`);
      console.log(`    Transfer Deleted: ${t.transfer_deleted_at || 'NO'}`);
      console.log(`    Dest Batch Status: ${t.dest_status}`);
      console.log(`    Dest Batch Current Volume: ${t.dest_current_volume}`);
      console.log(`    Dest Batch Deleted: ${t.dest_batch_deleted_at || 'NO'}`);
      console.log('    ...');
    }

    // Packaging runs (bottle_runs)
    const packagingRuns = await db.execute(sql`
      SELECT
        br.id,
        br.batch_id,
        br.vessel_id,
        br.packaged_at,
        br.package_type,
        br.units_produced,
        br.volume_taken,
        br.volume_taken_unit,
        br.loss,
        v.name AS vessel_name
      FROM bottle_runs br
      LEFT JOIN vessels v ON v.id = br.vessel_id
      WHERE br.batch_id = ${b.id}
      ORDER BY br.packaged_at ASC
    `);

    console.log(`\n  PACKAGING RUNS (${(packagingRuns.rows as any[]).length}):`);
    for (const p of packagingRuns.rows as any[]) {
      console.log(`    Run ID: ${p.id}`);
      console.log(`    Packaged At: ${p.packaged_at}`);
      console.log(`    Type: ${p.package_type}, Units: ${p.units_produced}`);
      console.log(`    Volume Taken: ${p.volume_taken} ${p.volume_taken_unit}`);
      console.log(`    Loss: ${p.loss}`);
      console.log(`    Vessel: ${p.vessel_name}`);
      console.log('    ...');
    }

    // Racking operations
    const rackingOps = await db.execute(sql`
      SELECT
        ro.id,
        ro.batch_id,
        ro.source_vessel_id,
        ro.destination_vessel_id,
        ro.volume_before,
        ro.volume_after,
        ro.volume_loss,
        ro.racked_at,
        ro.notes,
        sv.name AS source_vessel_name,
        dv.name AS dest_vessel_name
      FROM batch_racking_operations ro
      LEFT JOIN vessels sv ON sv.id = ro.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = ro.destination_vessel_id
      WHERE ro.batch_id = ${b.id}
      ORDER BY ro.racked_at ASC
    `);

    console.log(`\n  RACKING OPERATIONS (${(rackingOps.rows as any[]).length}):`);
    for (const r of rackingOps.rows as any[]) {
      console.log(`    Racking ID: ${r.id}`);
      console.log(`    From: ${r.source_vessel_name} -> To: ${r.dest_vessel_name}`);
      console.log(`    Volume: ${r.volume_before} -> ${r.volume_after}, Loss: ${r.volume_loss}`);
      console.log(`    Date: ${r.racked_at}`);
      console.log(`    Notes: ${r.notes || 'none'}`);
      console.log('    ...');
    }
  }

  // ── 3. Trace the specific batch with the long batch_number ────────────────
  console.log('\n\n📋 SECTION 3: Trace batch 2025-09-17_1000 IBC 1_BLEND_A-Tmix9gnpc\n');

  const specificBatch = await db.execute(sql`
    SELECT
      b.id,
      b.batch_number,
      b.name,
      b.custom_name,
      b.status,
      b.current_volume,
      b.initial_volume,
      b.vessel_id,
      b.parent_batch_id,
      b.is_racking_derivative,
      b.created_at,
      b.deleted_at,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.batch_number LIKE '%2025-09-17_1000 IBC 1_BLEND_A%'
    ORDER BY b.created_at ASC
  `);

  for (const b of specificBatch.rows as any[]) {
    console.log(`  ID: ${b.id}`);
    console.log(`  Batch #: ${b.batch_number}`);
    console.log(`  Name: ${b.name}`);
    console.log(`  Custom Name: ${b.custom_name || 'NONE'}`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Volume: ${b.initial_volume} -> ${b.current_volume}`);
    console.log(`  Vessel: ${b.vessel_name || 'NONE'}`);
    console.log(`  Parent Batch ID: ${b.parent_batch_id || 'NONE'}`);
    console.log(`  Is Racking Derivative: ${b.is_racking_derivative}`);
    console.log(`  Created: ${b.created_at}`);
    console.log(`  Deleted: ${b.deleted_at || 'NOT DELETED'}`);

    // If it has a parent, trace up
    if (b.parent_batch_id) {
      const parent = await db.execute(sql`
        SELECT
          b2.id, b2.batch_number, b2.name, b2.custom_name, b2.status,
          b2.parent_batch_id, b2.is_racking_derivative,
          v2.name AS vessel_name
        FROM batches b2
        LEFT JOIN vessels v2 ON v2.id = b2.vessel_id
        WHERE b2.id = ${b.parent_batch_id}
      `);
      if ((parent.rows as any[]).length > 0) {
        const p = (parent.rows as any[])[0];
        console.log(`\n  PARENT BATCH:`);
        console.log(`    ID: ${p.id}`);
        console.log(`    Batch #: ${p.batch_number}`);
        console.log(`    Name: ${p.name}`);
        console.log(`    Custom Name: ${p.custom_name || 'NONE'}`);
        console.log(`    Status: ${p.status}`);
        console.log(`    Vessel: ${p.vessel_name || 'NONE'}`);
        console.log(`    Parent Batch ID: ${p.parent_batch_id || 'NONE'}`);
      }
    }

    // Also check incoming transfers
    const inTrans = await db.execute(sql`
      SELECT
        bt.*,
        sb.name AS source_name,
        sb.custom_name AS source_custom_name,
        sb.batch_number AS source_batch_number
      FROM batch_transfers bt
      LEFT JOIN batches sb ON sb.id = bt.source_batch_id
      WHERE bt.destination_batch_id = ${b.id}
    `);
    console.log(`\n  INCOMING TRANSFERS: ${(inTrans.rows as any[]).length}`);
    for (const t of inTrans.rows as any[]) {
      console.log(`    From: ${t.source_custom_name || t.source_name} (${t.source_batch_number})`);
      console.log(`    Volume: ${t.volume_transferred}`);
      console.log(`    Date: ${t.transferred_at}`);
    }
  }

  // ── 4. FULL FAMILY TREE: Trace from root to all descendants ───────────────
  console.log('\n\n📋 SECTION 4: Full Red Currant Family Tree\n');

  // Find the ORIGINAL batch - the one that is NOT a racking derivative
  // or has no parent_batch_id among the Red Currant batches
  const rootBatches = rcRows.filter(
    (b: any) => !b.is_racking_derivative && !b.parent_batch_id
  );

  console.log(`Root batches (not racking derivatives, no parent): ${rootBatches.length}`);
  for (const root of rootBatches) {
    console.log(`\n  ROOT: ${root.custom_name} | ${root.name} | ID: ${root.id}`);
    console.log(`  Created: ${root.created_at}`);
    console.log(`  Vessel: ${root.vessel_name}`);
  }

  // Now trace ALL descendants using parent_batch_id recursively
  console.log('\n\nFull descendant tree (via parent_batch_id):');

  const allDescendants = await db.execute(sql`
    WITH RECURSIVE family_tree AS (
      -- Start with Red Currant root batches
      SELECT
        b.id,
        b.batch_number,
        b.name,
        b.custom_name,
        b.status,
        b.current_volume,
        b.initial_volume,
        b.vessel_id,
        b.parent_batch_id,
        b.is_racking_derivative,
        b.created_at,
        b.deleted_at,
        b.is_archived,
        0 AS depth,
        b.name AS root_name
      FROM batches b
      WHERE b.custom_name ILIKE '%red currant%'
        AND (b.parent_batch_id IS NULL OR b.is_racking_derivative IS NOT TRUE)

      UNION ALL

      -- Find children
      SELECT
        child.id,
        child.batch_number,
        child.name,
        child.custom_name,
        child.status,
        child.current_volume,
        child.initial_volume,
        child.vessel_id,
        child.parent_batch_id,
        child.is_racking_derivative,
        child.created_at,
        child.deleted_at,
        child.is_archived,
        ft.depth + 1,
        ft.root_name
      FROM batches child
      INNER JOIN family_tree ft ON child.parent_batch_id = ft.id
    )
    SELECT ft.*, v.name AS vessel_name
    FROM family_tree ft
    LEFT JOIN vessels v ON v.id = ft.vessel_id
    ORDER BY ft.root_name, ft.depth, ft.created_at
  `);

  for (const d of allDescendants.rows as any[]) {
    const indent = '  '.repeat(d.depth + 1);
    const marker = d.depth === 0 ? '🌳' : '├─';
    console.log(`${indent}${marker} [Depth ${d.depth}] ${d.custom_name || d.name}`);
    console.log(`${indent}   Batch #: ${d.batch_number}`);
    console.log(`${indent}   ID: ${d.id}`);
    console.log(`${indent}   Status: ${d.status} | Volume: ${d.initial_volume} -> ${d.current_volume}`);
    console.log(`${indent}   Vessel: ${d.vessel_name || 'NONE'}`);
    console.log(`${indent}   Parent: ${d.parent_batch_id || 'ROOT'}`);
    console.log(`${indent}   Is Racking Derivative: ${d.is_racking_derivative}`);
    console.log(`${indent}   Created: ${d.created_at}`);
    console.log(`${indent}   Deleted: ${d.deleted_at || 'NO'} | Archived: ${d.is_archived}`);
  }

  // Also trace via batch_transfers (not just parent_batch_id)
  console.log('\n\nFull descendant tree (via batch_transfers):');

  const transferTree = await db.execute(sql`
    WITH RECURSIVE transfer_tree AS (
      -- Start with Red Currant root batches
      SELECT
        b.id,
        b.batch_number,
        b.name,
        b.custom_name,
        b.status,
        b.current_volume,
        b.vessel_id,
        b.parent_batch_id,
        b.is_racking_derivative,
        b.created_at,
        b.deleted_at,
        0 AS depth,
        ARRAY[b.id] AS path
      FROM batches b
      WHERE b.custom_name ILIKE '%red currant%'
        AND (b.parent_batch_id IS NULL OR b.is_racking_derivative IS NOT TRUE)

      UNION ALL

      -- Find children via transfers
      SELECT
        child.id,
        child.batch_number,
        child.name,
        child.custom_name,
        child.status,
        child.current_volume,
        child.vessel_id,
        child.parent_batch_id,
        child.is_racking_derivative,
        child.created_at,
        child.deleted_at,
        tt.depth + 1,
        tt.path || child.id
      FROM batch_transfers bt
      INNER JOIN transfer_tree tt ON bt.source_batch_id = tt.id
      INNER JOIN batches child ON child.id = bt.destination_batch_id
      WHERE NOT (child.id = ANY(tt.path))  -- prevent cycles
    )
    SELECT tt.*, v.name AS vessel_name
    FROM transfer_tree tt
    LEFT JOIN vessels v ON v.id = tt.vessel_id
    ORDER BY tt.depth, tt.created_at
  `);

  console.log(`\nTotal nodes in transfer tree: ${(transferTree.rows as any[]).length}`);
  for (const d of transferTree.rows as any[]) {
    const indent = '  '.repeat(d.depth + 1);
    const marker = d.depth === 0 ? '🌳' : '├─';
    console.log(`${indent}${marker} [Depth ${d.depth}] ${d.custom_name || d.name}`);
    console.log(`${indent}   Batch #: ${d.batch_number}`);
    console.log(`${indent}   ID: ${d.id}`);
    console.log(`${indent}   Status: ${d.status} | Volume: ${d.current_volume}`);
    console.log(`${indent}   Vessel: ${d.vessel_name || 'NONE'}`);
    console.log(`${indent}   Is Racking Derivative: ${d.is_racking_derivative}`);
    console.log(`${indent}   Created: ${d.created_at}`);
    console.log(`${indent}   Deleted: ${d.deleted_at || 'NO'}`);
  }

  // ── 5. DRUM-120-3 investigation ───────────────────────────────────────────
  console.log('\n\n📋 SECTION 5: DRUM-120-3 vessel investigation\n');

  const drum120_3 = await db.execute(sql`
    SELECT
      b.id,
      b.batch_number,
      b.name,
      b.custom_name,
      b.status,
      b.current_volume,
      b.initial_volume,
      b.vessel_id,
      b.parent_batch_id,
      b.is_racking_derivative,
      b.created_at,
      b.deleted_at,
      b.is_archived,
      v.name AS vessel_name
    FROM batches b
    INNER JOIN vessels v ON v.id = b.vessel_id
    WHERE v.name ILIKE '%DRUM-120-3%'
      AND b.deleted_at IS NULL
    ORDER BY b.created_at ASC
  `);

  console.log(`Batches currently in DRUM-120-3: ${(drum120_3.rows as any[]).length}`);
  for (const b of drum120_3.rows as any[]) {
    console.log(`  ${b.custom_name || b.name} | Status: ${b.status} | Volume: ${b.current_volume}`);
    console.log(`  ID: ${b.id} | Racking Derivative: ${b.is_racking_derivative}`);
    console.log(`  Parent: ${b.parent_batch_id || 'NONE'}`);
  }

  // ── 6. Summary: Name propagation code evidence ────────────────────────────
  console.log('\n\n📋 SECTION 6: Name propagation mechanism\n');
  console.log('The custom_name propagation happens in packages/api/src/routers/batch.ts');
  console.log('Line ~4890: customName: batch[0].customName, // Inherit parent\'s custom name without suffix');
  console.log('This occurs during partial rack (rackBatch mutation) when creating a child batch.');
  console.log('Every time a batch is partially racked to a new vessel, the child batch');
  console.log('automatically inherits the parent\'s custom_name.');

  console.log('\n' + '='.repeat(80));
  console.log('TRACE COMPLETE');
  console.log('='.repeat(80));

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
