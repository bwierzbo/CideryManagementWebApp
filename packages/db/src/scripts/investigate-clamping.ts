// packages/db/src/scripts/investigate-clamping.ts
import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // Find the parent batch (blend-2024-12-20-1000 IBC 4) and child "Legacy inventory"
  const batches = await db.execute(sql.raw(`
    SELECT id, name, initial_volume_liters, current_volume_liters, parent_batch_id, product_type
    FROM batches
    WHERE name ILIKE '%for distillery%' OR name ILIKE '%legacy inventory%to be distilled%'
       OR id = '1539d85e-299a-4e13-ae0e-ee2ca38b7ea6'
    ORDER BY name
  `));
  
  console.log("=== BATCHES ===");
  for (const b of batches.rows as any[]) {
    console.log(`  ${b.name}`);
    console.log(`    id: ${b.id}`);
    console.log(`    initial: ${b.initial_volume_liters}L`);
    console.log(`    current: ${b.current_volume_liters}L`);
    console.log(`    parent: ${b.parent_batch_id}`);
    console.log(`    productType: ${b.product_type}`);
  }

  // Get IDs
  const forDistillery = (batches.rows as any[]).find((b: any) => b.name?.toLowerCase().includes('for distillery')) 
    || (batches.rows as any[]).find((b: any) => b.id === '1539d85e-299a-4e13-ae0e-ee2ca38b7ea6');
  const legacyInv = (batches.rows as any[]).find((b: any) => b.name?.toLowerCase().includes('legacy inventory'));
  
  if (!forDistillery || !legacyInv) {
    console.log("Could not find both batches");
    console.log("forDistillery:", forDistillery);
    console.log("legacyInv:", legacyInv);
    process.exit(1);
  }

  const parentId = forDistillery.id;
  const childId = legacyInv.id;

  console.log(`\nUsing parent: ${forDistillery.name} (${parentId})`);
  console.log(`Using child: ${legacyInv.name} (${childId})`);

  // All transfers involving either batch
  const transfers = await db.execute(sql.raw(`
    SELECT id, source_batch_id, destination_batch_id, volume_transferred, transferred_at, created_at, deleted_at,
           CASE WHEN source_batch_id = '${parentId}' THEN 'parent→child'
                WHEN source_batch_id = '${childId}' THEN 'child→parent'
                ELSE 'other' END as direction
    FROM batch_transfers
    WHERE (source_batch_id IN ('${parentId}', '${childId}') OR destination_batch_id IN ('${parentId}', '${childId}'))
    ORDER BY transferred_at, created_at
  `));

  console.log("\n=== TRANSFERS involving these batches ===");
  for (const t of transfers.rows as any[]) {
    const deleted = t.deleted_at ? ' [DELETED]' : '';
    console.log(`  ${t.direction}: ${t.volume_transferred}L | transferred: ${t.transferred_at} | created: ${t.created_at}${deleted}`);
    console.log(`    id: ${t.id}`);
    console.log(`    source: ${t.source_batch_id}`);
    console.log(`    dest: ${t.destination_batch_id}`);
  }

  // All transfers INTO parent (For Distillery)
  const parentTransfersIn = await db.execute(sql.raw(`
    SELECT bt.id, bt.volume_transferred, bt.transferred_at, bt.source_batch_id, b.name as source_name, bt.deleted_at
    FROM batch_transfers bt
    LEFT JOIN batches b ON b.id = bt.source_batch_id
    WHERE bt.destination_batch_id = '${parentId}' AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  console.log("\n=== Parent (For Distillery) Transfers IN (non-deleted) ===");
  let totalIn = 0;
  for (const t of parentTransfersIn.rows as any[]) {
    console.log(`  FROM ${t.source_name}: ${t.volume_transferred}L on ${t.transferred_at}`);
    totalIn += parseFloat(t.volume_transferred);
  }
  console.log(`  TOTAL IN: ${totalIn.toFixed(1)}L`);

  // All transfers OUT of parent
  const parentTransfersOut = await db.execute(sql.raw(`
    SELECT bt.id, bt.volume_transferred, bt.transferred_at, bt.destination_batch_id, b.name as dest_name, bt.deleted_at
    FROM batch_transfers bt
    LEFT JOIN batches b ON b.id = bt.destination_batch_id
    WHERE bt.source_batch_id = '${parentId}' AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  console.log("\n=== Parent (For Distillery) Transfers OUT (non-deleted) ===");
  let totalOut = 0;
  for (const t of parentTransfersOut.rows as any[]) {
    console.log(`  TO ${t.dest_name}: ${t.volume_transferred}L on ${t.transferred_at}`);
    totalOut += parseFloat(t.volume_transferred);
  }
  console.log(`  TOTAL OUT: ${totalOut.toFixed(1)}L`);

  // Distillation records for parent
  const distillation = await db.execute(sql.raw(`
    SELECT id, source_volume_liters, sent_at, notes, deleted_at, status
    FROM distillation_records
    WHERE source_batch_id = '${parentId}' AND deleted_at IS NULL
    ORDER BY sent_at
  `));

  console.log("\n=== Parent Distillation Records ===");
  let totalDist = 0;
  for (const d of distillation.rows as any[]) {
    console.log(`  ${d.source_volume_liters}L sent on ${d.sent_at} | status: ${d.status} | notes: ${d.notes || 'none'}`);
    totalDist += parseFloat(d.source_volume_liters);
  }
  console.log(`  TOTAL DISTILLED: ${totalDist.toFixed(1)}L`);

  // Adjustments for parent
  const adjustments = await db.execute(sql.raw(`
    SELECT id, adjustment_amount, reason, adjustment_date
    FROM batch_volume_adjustments
    WHERE batch_id = '${parentId}' AND deleted_at IS NULL
    ORDER BY adjustment_date
  `));

  console.log("\n=== Parent Adjustments ===");
  let totalAdj = 0;
  for (const a of adjustments.rows as any[]) {
    console.log(`  ${a.adjustment_amount}L | reason: ${a.reason} | date: ${a.adjustment_date}`);
    totalAdj += parseFloat(a.adjustment_amount);
  }
  console.log(`  TOTAL ADJ: ${totalAdj.toFixed(1)}L`);

  // Merges into parent
  const merges = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.volume_added, bmh.merged_at, bmh.source_batch_id, b.name as source_name
    FROM batch_merge_history bmh
    LEFT JOIN batches b ON b.id = bmh.source_batch_id
    WHERE bmh.target_batch_id = '${parentId}'
    ORDER BY bmh.merged_at
  `));

  console.log("\n=== Parent Merges IN ===");
  for (const m of merges.rows as any[]) {
    console.log(`  FROM ${m.source_name || 'press/purchase'}: ${m.volume_added}L on ${m.merged_at}`);
  }

  // Calculate SBD
  const initial = parseFloat(forDistillery.initial_volume_liters);
  console.log("\n=== PARENT SBD CALCULATION ===");
  console.log(`  Initial: ${initial}L`);
  console.log(`  + TransfersIn: ${totalIn.toFixed(1)}L`);
  console.log(`  - TransfersOut: ${totalOut.toFixed(1)}L`);
  console.log(`  + Adjustments: ${totalAdj.toFixed(1)}L`);
  console.log(`  - Distillation: ${totalDist.toFixed(1)}L`);
  const rawSBD = initial + totalIn - totalOut + totalAdj - totalDist;
  console.log(`  = Raw SBD: ${rawSBD.toFixed(1)}L (${(rawSBD * 0.264172).toFixed(1)} gal)`);
  console.log(`  Clamped: ${Math.max(0, rawSBD).toFixed(1)}L`);
  
  // What if we delete our parent→child transfer?
  console.log("\n=== SCENARIO: Delete parent→child transfer (our fix) ===");
  const withoutOurFix = initial + totalIn - (totalOut - 370.3) + totalAdj - totalDist;
  console.log(`  Raw SBD without our transfer: ${withoutOurFix.toFixed(1)}L (${(withoutOurFix * 0.264172).toFixed(1)} gal)`);

  // What if we also set child initial = 370.3?
  console.log("\n=== SCENARIO: Delete parent→child transfer + set child initial=370.3L ===");
  console.log(`  Parent SBD: ${withoutOurFix.toFixed(1)}L ≈ 0`);
  console.log(`  Child SBD: 370.3 (initial) - 370.3 (transfer to parent) = 0L`);
  console.log(`  Both batches balance!`);

  // Check child's current state
  const childTransfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.volume_transferred, bt.transferred_at, bt.source_batch_id, bt.destination_batch_id,
           CASE WHEN bt.source_batch_id = '${childId}' THEN 'OUT' ELSE 'IN' END as dir,
           b_src.name as source_name, b_dst.name as dest_name, bt.created_at
    FROM batch_transfers bt
    LEFT JOIN batches b_src ON b_src.id = bt.source_batch_id
    LEFT JOIN batches b_dst ON b_dst.id = bt.destination_batch_id
    WHERE (bt.source_batch_id = '${childId}' OR bt.destination_batch_id = '${childId}')
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));

  console.log("\n=== CHILD (Legacy inventory) Transfers ===");
  for (const t of childTransfers.rows as any[]) {
    console.log(`  ${t.dir}: ${t.volume_transferred}L | from ${t.source_name} → ${t.dest_name} | transferred: ${t.transferred_at} | created: ${t.created_at}`);
    console.log(`    transfer id: ${t.id}`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
