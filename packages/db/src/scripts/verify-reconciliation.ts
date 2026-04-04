import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // 1. Check DRUM-120-3 state
  const drum3 = await sql`
    SELECT v.name, v.status,
           b.id as batch_id, b.custom_name, b.status as batch_status, b.current_volume, b.deleted_at
    FROM vessels v
    LEFT JOIN batches b ON b.vessel_id = v.id AND b.deleted_at IS NULL
    WHERE v.name = 'DRUM-120-3' AND v.deleted_at IS NULL
  `;
  console.log("=== DRUM-120-3 ===");
  console.log(drum3[0]);

  // 2. All Red Currant batches
  const redCurrants = await sql`
    SELECT id, batch_number, custom_name, status, current_volume, vessel_id, deleted_at
    FROM batches
    WHERE custom_name ILIKE '%red currant%'
    ORDER BY created_at
  `;
  console.log("\n=== All Red Currant batches ===");
  for (const b of redCurrants) {
    console.log(`  ${b.id.substring(0,8)} | "${b.custom_name}" | status=${b.status} vol=${b.current_volume} | deleted=${b.deleted_at ? 'YES' : 'no'}`);
  }

  // 3. Check the phantom transfer was soft-deleted
  const phantomTransfer = await sql`
    SELECT bt.id, bt.volume_transferred, bt.deleted_at, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE dv.name = 'DRUM-120-3'
      AND bt.source_batch_id IN (
        SELECT id FROM batches WHERE custom_name ILIKE '%Summer Community Blend%'
      )
  `;
  console.log("\n=== Phantom transfer to DRUM-120-3 ===");
  for (const t of phantomTransfer) {
    console.log(`  ${t.id.substring(0,8)} | ${t.volume_transferred}L | deleted=${t.deleted_at ? 'YES' : 'no'}`);
  }

  // 4. Check racking records on Red Currant chain
  for (const b of redCurrants.filter(b => !b.deleted_at)) {
    const rackings = await sql`
      SELECT id, volume_loss, racked_at FROM batch_racking_operations
      WHERE batch_id = ${b.id} AND deleted_at IS NULL
    `;
    const adjs = await sql`
      SELECT id, adjustment_amount, reason FROM batch_volume_adjustments
      WHERE batch_id = ${b.id} AND deleted_at IS NULL
    `;
    if (rackings.length || adjs.length) {
      console.log(`\n  Batch ${b.id.substring(0,8)} "${b.custom_name}":`);
      console.log(`    Rackings: ${rackings.length}`, rackings.map(r => `${r.volume_loss}L`));
      console.log(`    Adjustments: ${adjs.length}`, adjs.map(a => `${a.adjustment_amount}L (${a.reason})`));
    }
  }

  await sql.end();
}

main().catch(console.error);
