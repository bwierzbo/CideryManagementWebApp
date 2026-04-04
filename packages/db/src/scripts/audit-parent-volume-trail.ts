import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const batchId = "6a06ce10-06e9-4fba-8cb1-e4ab3bc6b909";

  // First, confirm this batch exists
  const batch = await sql`
    SELECT id, batch_number, custom_name, current_volume, current_volume_unit, initial_volume, status, vessel_id
    FROM batches WHERE id = ${batchId}
  `;
  console.log("=== Batch Record ===");
  console.log(batch[0]);

  // Check transfers where this batch is the source
  const transfersOut = await sql`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id, bt.volume_transferred, bt.loss,
           bt.remaining_volume, bt.transferred_at, bt.notes,
           sv.name as src_vessel, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE bt.source_batch_id = ${batchId}
    ORDER BY bt.transferred_at ASC
  `;
  console.log(`\n=== Transfers OUT (source_batch_id = this batch): ${transfersOut.length} ===`);
  for (const t of transfersOut) {
    console.log(t);
  }

  // Check transfers where this batch is the destination
  const transfersIn = await sql`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id, bt.volume_transferred, bt.loss,
           bt.remaining_volume, bt.transferred_at, bt.notes,
           sv.name as src_vessel, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE bt.destination_batch_id = ${batchId}
    ORDER BY bt.transferred_at ASC
  `;
  console.log(`\n=== Transfers IN (destination_batch_id = this batch): ${transfersIn.length} ===`);
  for (const t of transfersIn) {
    console.log(t);
  }

  // Check ALL transfers involving TANK-1000-2 vessel
  const tank1000_2 = await sql`SELECT id FROM vessels WHERE name = 'TANK-1000-2' AND deleted_at IS NULL`;
  if (tank1000_2.length) {
    const allTransfers = await sql`
      SELECT bt.transferred_at, bt.volume_transferred, bt.loss, bt.remaining_volume, bt.notes,
             bt.source_batch_id, bt.destination_batch_id,
             sb.custom_name as src_batch_name, sb.batch_number as src_batch_num,
             db.custom_name as dest_batch_name, db.batch_number as dest_batch_num,
             sv.name as src_vessel, dv.name as dest_vessel
      FROM batch_transfers bt
      LEFT JOIN batches sb ON bt.source_batch_id = sb.id
      LEFT JOIN batches db ON bt.destination_batch_id = db.id
      LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
      LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
      WHERE (bt.source_vessel_id = ${tank1000_2[0].id} OR bt.destination_vessel_id = ${tank1000_2[0].id})
        AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at ASC
    `;
    console.log(`\n=== ALL transfers involving TANK-1000-2 (${allTransfers.length}) ===`);
    for (const t of allTransfers) {
      const dir = t.src_vessel === 'TANK-1000-2' ? 'OUT' : 'IN';
      console.log(`${t.transferred_at} | ${dir} | ${t.volume_transferred}L + ${t.loss}L loss | ${t.src_vessel} → ${t.dest_vessel}`);
      console.log(`  src: "${t.src_batch_name}" (${t.src_batch_num})`);
      console.log(`  dst: "${t.dest_batch_name}" (${t.dest_batch_num})`);
      console.log(`  remaining: ${t.remaining_volume} | notes: ${t.notes || ""}`);
      console.log();
    }
  }

  await sql.end();
}

main().catch(console.error);
