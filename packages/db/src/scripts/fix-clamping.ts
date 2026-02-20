import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // Verify the transfer exists and was soft-deleted
  const transfer = await db.execute(sql.raw(`
    SELECT id, source_batch_id, destination_batch_id, volume_transferred, transferred_at,
           created_at, created_at::date::text as created_date, deleted_at
    FROM batch_transfers
    WHERE id::text LIKE 'e62a2961%'
  `));

  if ((transfer.rows as any[]).length === 0) {
    console.log("Transfer not found");
    process.exit(1);
  }

  const t = (transfer.rows as any[])[0];
  
  if (t.deleted_at) {
    console.log(`Transfer already soft-deleted: ${t.volume_transferred}L, deleted_at=${t.deleted_at}`);
  } else {
    // Verify it was created on 2026-02-20 - safety check using DB-side date cast
    if (t.created_date !== '2026-02-20') {
      console.log(`WARNING: Transfer was created on ${t.created_date}, not 2026-02-20. Aborting.`);
      process.exit(1);
    }

    // Soft-delete it
    await db.execute(sql.raw(`
      UPDATE batch_transfers SET deleted_at = NOW() WHERE id = '${t.id}'
    `));
    console.log(`Soft-deleted transfer ${t.id}`);
  }

  // Verify parent SBD is now balanced
  const parentId = t.source_batch_id;
  const result = await db.execute(sql.raw(`
    WITH
    transfers_in AS (
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers
      WHERE destination_batch_id = '${parentId}' AND deleted_at IS NULL
    ),
    transfers_out AS (
      SELECT COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers
      WHERE source_batch_id = '${parentId}' AND deleted_at IS NULL
    ),
    distillation AS (
      SELECT COALESCE(SUM(source_volume_liters::numeric), 0) as total
      FROM distillation_records
      WHERE source_batch_id = '${parentId}' AND deleted_at IS NULL
    ),
    adjustments AS (
      SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as total
      FROM batch_volume_adjustments
      WHERE batch_id = '${parentId}' AND deleted_at IS NULL
    )
    SELECT 
      b.initial_volume_liters,
      ti.total as transfers_in,
      tout.total as transfers_out,
      a.total as adjustments,
      d.total as distillation,
      (b.initial_volume_liters::numeric + ti.total - tout.total + a.total - d.total) as raw_sbd
    FROM batches b
    CROSS JOIN transfers_in ti
    CROSS JOIN transfers_out tout
    CROSS JOIN distillation d
    CROSS JOIN adjustments a
    WHERE b.id = '${parentId}'
  `));

  const r = (result.rows as any[])[0];
  console.log(`\nParent batch ${parentId} SBD after fix:`);
  console.log(`  Initial: ${r.initial_volume_liters}L`);
  console.log(`  + TransfersIn: ${parseFloat(r.transfers_in).toFixed(1)}L`);
  console.log(`  - TransfersOut: ${parseFloat(r.transfers_out).toFixed(1)}L`);
  console.log(`  + Adjustments: ${parseFloat(r.adjustments).toFixed(1)}L`);
  console.log(`  - Distillation: ${parseFloat(r.distillation).toFixed(1)}L`);
  console.log(`  = Raw SBD: ${parseFloat(r.raw_sbd).toFixed(1)}L (${(parseFloat(r.raw_sbd) * 0.264172).toFixed(1)} gal)`);
  
  if (parseFloat(r.raw_sbd) >= -1) {
    console.log(`\nParent batch is now balanced (SBD >= 0). Clamping offset eliminated.`);
  } else {
    console.log(`\nParent batch still negative: ${parseFloat(r.raw_sbd).toFixed(1)}L`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
