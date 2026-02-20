import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // Find the transfer we just soft-deleted (created today, parent→child)
  const result = await db.execute(sql.raw(`
    UPDATE batch_transfers 
    SET deleted_at = NULL 
    WHERE id::text LIKE 'e62a2961%' AND deleted_at IS NOT NULL
    RETURNING id, volume_transferred, source_batch_id, destination_batch_id
  `));

  if ((result.rows as any[]).length === 0) {
    console.log("Transfer not found or already active");
    process.exit(1);
  }

  const t = (result.rows as any[])[0];
  console.log(`Restored transfer ${t.id}: ${t.volume_transferred}L`);
  
  // Verify parent SBD
  const parentId = t.source_batch_id;
  const childId = t.destination_batch_id;
  
  const verification = await db.execute(sql.raw(`
    WITH
    batch_sbd AS (
      SELECT 
        b.id, b.name, b.initial_volume_liters::numeric as initial,
        COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE destination_batch_id = b.id AND deleted_at IS NULL), 0) as transfers_in,
        COALESCE((SELECT SUM(volume_transferred::numeric) FROM batch_transfers WHERE source_batch_id = b.id AND deleted_at IS NULL), 0) as transfers_out,
        COALESCE((SELECT SUM(adjustment_amount::numeric) FROM batch_volume_adjustments WHERE batch_id = b.id AND deleted_at IS NULL), 0) as adjustments,
        COALESCE((SELECT SUM(volume_liters::numeric) FROM distillation_records WHERE batch_id = b.id AND deleted_at IS NULL), 0) as distillation
      FROM batches b
      WHERE b.id IN ('${parentId}', '${childId}')
    )
    SELECT 
      name,
      initial,
      transfers_in,
      transfers_out,
      adjustments,
      distillation,
      (initial + transfers_in - transfers_out + adjustments - distillation) as raw_sbd
    FROM batch_sbd
    ORDER BY name
  `));

  console.log("\nBatch SBD after restoration:");
  for (const r of verification.rows as any[]) {
    const sbd = parseFloat(r.raw_sbd);
    const clamped = sbd < 0 ? `(clamped to 0, loss=${Math.abs(sbd).toFixed(1)}L)` : '';
    console.log(`  ${r.name}: initial=${r.initial}L + in=${parseFloat(r.transfers_in).toFixed(1)}L - out=${parseFloat(r.transfers_out).toFixed(1)}L + adj=${parseFloat(r.adjustments).toFixed(1)}L - dist=${parseFloat(r.distillation).toFixed(1)}L = ${sbd.toFixed(1)}L ${clamped}`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
