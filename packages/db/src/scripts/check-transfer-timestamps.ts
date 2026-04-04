import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // Get all transfers FROM TANK-1000-2 for the Summer Community Blend batch
  // Compare transferred_at (user-entered date) vs created_at (when actually submitted)
  const tank = await sql`SELECT id FROM vessels WHERE name = 'TANK-1000-2' AND deleted_at IS NULL`;

  const transfers = await sql`
    SELECT bt.transferred_at, bt.created_at, bt.volume_transferred, bt.loss,
           bt.remaining_volume, bt.notes,
           dv.name as dest_vessel,
           db.custom_name as dest_batch_name,
           sb.batch_number as src_batch_num
    FROM batch_transfers bt
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    LEFT JOIN batches db ON bt.destination_batch_id = db.id
    LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.source_vessel_id = ${tank[0].id}
      AND bt.deleted_at IS NULL
      AND sb.batch_number LIKE '%Tmix9gnpc%'
    ORDER BY bt.created_at ASC
  `;

  console.log("=== Transfers from TANK-1000-2 (Summer Community Blend 1) ===");
  console.log("Comparing transferred_at (user date) vs created_at (submission time)\n");

  for (const t of transfers) {
    const userDate = new Date(t.transferred_at);
    const systemDate = new Date(t.created_at);
    const diffHours = (systemDate.getTime() - userDate.getTime()) / (1000 * 60 * 60);
    const backdated = diffHours > 24 ? `⚠️ BACKDATED by ${Math.round(diffHours / 24)} days` :
                      diffHours > 1 ? `entered ${Math.round(diffHours)}h later` : "real-time";

    console.log(`${t.transferred_at}`);
    console.log(`  → ${t.dest_vessel} "${t.dest_batch_name}" | ${t.volume_transferred}L + ${t.loss || 0}L loss`);
    console.log(`  created_at: ${t.created_at}`);
    console.log(`  timing: ${backdated}`);
    console.log(`  remaining: ${t.remaining_volume}`);
    console.log();
  }

  await sql.end();
}

main().catch(console.error);
