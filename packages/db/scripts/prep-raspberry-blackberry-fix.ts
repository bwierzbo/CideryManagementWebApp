import { db } from "../src/index";
import { sql } from "drizzle-orm";

/**
 * Dry-run helper: find the IDs needed to correct the Raspberry Blackberry
 * batch_transfers row so the source becomes TANK-500-2 / SCB4-in-TANK-500-2
 * instead of TANK-1000-1 / SCB4-in-TANK-1000-1.
 *
 * This script ONLY reads + prints the proposed UPDATE statement. Run a
 * follow-up script to execute the change after confirmation.
 */
async function check() {
  // 1. Locate the Raspberry Blackberry destination batch + its inbound transfer
  const rbTransfer = await db.execute(sql`
    SELECT
      bt.id AS transfer_id,
      bt.transferred_at,
      bt.source_vessel_id,
      bt.source_batch_id,
      bt.destination_vessel_id,
      bt.destination_batch_id,
      bt.volume_transferred,
      bt.volume_transferred_unit,
      src_v.name AS source_vessel,
      src_b.name AS source_batch_name,
      src_b.custom_name AS source_batch_custom,
      dst_v.name AS dest_vessel,
      dst_b.name AS dest_batch_name,
      dst_b.custom_name AS dest_batch_custom
    FROM batch_transfers bt
    LEFT JOIN vessels src_v ON bt.source_vessel_id = src_v.id
    LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
    LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
    LEFT JOIN batches dst_b ON bt.destination_batch_id = dst_b.id
    WHERE dst_b.custom_name = 'Raspberry Blackberry'
      AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at DESC
    LIMIT 5
  `);
  console.log("Candidate Raspberry Blackberry transfer rows:");
  for (const r of rbTransfer.rows as any[]) {
    console.log(
      `  transfer_id=${r.transfer_id}\n    transferred_at=${r.transferred_at}\n    source: ${r.source_vessel} / ${r.source_batch_custom || r.source_batch_name}  (vessel ${r.source_vessel_id}, batch ${r.source_batch_id})\n    dest:   ${r.dest_vessel} / ${r.dest_batch_custom || r.dest_batch_name}  (vessel ${r.destination_vessel_id}, batch ${r.destination_batch_id})\n    volume: ${r.volume_transferred}${r.volume_transferred_unit}`,
    );
  }

  // 2. Locate the SCB4 batch that's currently in TANK-500-2 (this is the new source_batch_id)
  const scb4InTank500_2 = await db.execute(sql`
    SELECT b.id, b.name, b.custom_name, b.status, b.start_date, b.current_volume, b.initial_volume_liters,
           v.name AS vessel
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE v.name = 'TANK-500-2'
      AND (b.name ILIKE '%Summer Community Blend 4%' OR b.custom_name ILIKE '%Summer Community Blend 4%')
      AND b.deleted_at IS NULL
  `);
  console.log("\nSCB4 batch currently in TANK-500-2 (new source_batch_id):");
  for (const r of scb4InTank500_2.rows as any[]) {
    console.log(`  id=${r.id}  ${r.custom_name || r.name}  vessel=${r.vessel}  status=${r.status}  start=${r.start_date}  current=${r.current_volume}L init=${r.initial_volume_liters}L`);
  }

  // 3. TANK-500-2 vessel id
  const tank500_2 = await db.execute(sql`
    SELECT id, name FROM vessels WHERE name = 'TANK-500-2' LIMIT 1
  `);
  console.log("\nTANK-500-2 vessel:");
  console.log(`  id=${(tank500_2.rows as any[])[0]?.id}  name=${(tank500_2.rows as any[])[0]?.name}`);

  // 4. Build proposed SQL preview
  const rb = (rbTransfer.rows as any[]).find(
    (r) => r.source_vessel === "TANK-1000-1",
  );
  const newVessel = (tank500_2.rows as any[])[0];
  const newBatch = (scb4InTank500_2.rows as any[])[0];
  if (rb && newVessel && newBatch) {
    console.log("\n=== Proposed UPDATE (DRY RUN ONLY — not executed) ===");
    console.log(`UPDATE batch_transfers SET`);
    console.log(`  source_vessel_id = '${newVessel.id}',  -- was ${rb.source_vessel_id} (TANK-1000-1)`);
    console.log(`  source_batch_id  = '${newBatch.id}',  -- was ${rb.source_batch_id} (SCB4-in-TANK-1000-1)`);
    console.log(`  transferred_at   = '<TBD by user, e.g. 2026-05-13 04:00:00+00>',  -- was ${rb.transferred_at}`);
    console.log(`  updated_at       = NOW()`);
    console.log(`WHERE id = '${rb.transfer_id}';`);
  } else {
    console.log("\n⚠️  Could not auto-derive all IDs — check rows above and craft UPDATE manually.");
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
