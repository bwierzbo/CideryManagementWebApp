import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // Find all 2025 Salish batches
  const salish = await db.execute(sql.raw(`
    SELECT id, custom_name, product_type, status,
           initial_volume_liters::numeric as initial_l,
           current_volume_liters::numeric as current_l,
           actual_abv::numeric as abv,
           created_at
    FROM batches
    WHERE custom_name ILIKE '%salish%'
      AND deleted_at IS NULL
      AND created_at >= '2025-01-01'
    ORDER BY created_at
  `));

  console.log("=== 2025 Salish Batches ===");
  for (const r of salish.rows as any[]) {
    console.log(`${r.custom_name} [${r.product_type}] status=${r.status}`);
    console.log(`  initial=${parseFloat(r.initial_l).toFixed(1)}L, current=${parseFloat(r.current_l).toFixed(1)}L, ABV=${r.abv}`);
    console.log(`  id=${r.id}`);
  }

  const salishIds = (salish.rows as any[]).map((r: any) => `'${r.id}'`).join(",");

  // Brandy transfers INTO these Salish batches
  console.log("\n=== Brandy transfers INTO 2025 Salish batches ===");
  const transfers = await db.execute(sql.raw(`
    SELECT bt.id,
           src.custom_name as from_batch, src.product_type as src_type,
           dst.custom_name as to_batch,
           bt.volume_transferred::numeric as vol,
           bt.transferred_at,
           bt.notes
    FROM batch_transfers bt
    JOIN batches src ON bt.source_batch_id = src.id
    JOIN batches dst ON bt.destination_batch_id = dst.id
    WHERE dst.id IN (${salishIds})
      AND src.product_type = 'brandy'
      AND bt.deleted_at IS NULL
    ORDER BY dst.custom_name, bt.transferred_at
  `));
  let totalBrandy1 = 0;
  let totalBrandy2 = 0;
  for (const r of transfers.rows as any[]) {
    const vol = parseFloat(r.vol);
    console.log(`${r.from_batch} → ${r.to_batch}: ${vol.toFixed(1)}L on ${new Date(r.transferred_at).toISOString().slice(0, 10)}`);
    if (r.to_batch.includes("#1")) totalBrandy1 += vol;
    if (r.to_batch.includes("#2")) totalBrandy2 += vol;
  }
  console.log(`\nTotal brandy → Salish #1: ${totalBrandy1.toFixed(1)}L (${(totalBrandy1 / 3.78541).toFixed(1)} gal)`);
  console.log(`Total brandy → Salish #2: ${totalBrandy2.toFixed(1)}L (${(totalBrandy2 / 3.78541).toFixed(1)} gal)`);
  console.log(`Combined: ${(totalBrandy1 + totalBrandy2).toFixed(1)}L (${((totalBrandy1 + totalBrandy2) / 3.78541).toFixed(1)} gal)`);

  // Also check batch_compositions for brandy
  console.log("\n=== batch_compositions (brandy source) ===");
  const comps = await db.execute(sql.raw(`
    SELECT bc.batch_id, b.custom_name, bc.source_type,
           bc.juice_volume::numeric as vol,
           bc.abv::numeric as abv,
           bc.percentage::numeric as pct
    FROM batch_compositions bc
    JOIN batches b ON bc.batch_id = b.id
    WHERE b.id IN (${salishIds})
      AND bc.source_type = 'brandy'
    ORDER BY b.custom_name
  `));
  for (const r of comps.rows as any[]) {
    console.log(`${r.custom_name}: ${parseFloat(r.vol).toFixed(1)}L brandy at ${parseFloat(r.abv).toFixed(1)}% ABV (${parseFloat(r.pct).toFixed(1)}%)`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
