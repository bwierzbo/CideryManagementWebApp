import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute(sql.raw(`
    WITH eligible_batches AS (
      SELECT id, name, custom_name, product_type, initial_volume_liters, current_volume_liters,
             COALESCE(reconciliation_status, 'pending') as recon_status
      FROM batches
      WHERE deleted_at IS NULL
        AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        AND start_date::date <= '2025-12-31'::date
    ),
    transfers_in AS (
      SELECT destination_batch_id as batch_id, COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers WHERE deleted_at IS NULL GROUP BY destination_batch_id
    ),
    transfers_out AS (
      SELECT source_batch_id as batch_id, COALESCE(SUM(volume_transferred::numeric), 0) as total
      FROM batch_transfers WHERE deleted_at IS NULL GROUP BY source_batch_id
    ),
    merges_in AS (
      SELECT target_batch_id as batch_id, COALESCE(SUM(volume_added::numeric), 0) as total
      FROM batch_merge_history WHERE deleted_at IS NULL GROUP BY target_batch_id
    ),
    merges_out AS (
      SELECT source_batch_id as batch_id, COALESCE(SUM(volume_added::numeric), 0) as total
      FROM batch_merge_history WHERE source_batch_id IS NOT NULL AND deleted_at IS NULL GROUP BY source_batch_id
    ),
    racking_losses AS (
      SELECT batch_id, COALESCE(SUM(volume_loss::numeric), 0) as total
      FROM batch_racking_operations WHERE deleted_at IS NULL GROUP BY batch_id
    ),
    filter_losses AS (
      SELECT batch_id, COALESCE(SUM(volume_loss::numeric), 0) as total
      FROM batch_filter_operations GROUP BY batch_id
    ),
    bottle_runs AS (
      SELECT batch_id,
        COALESCE(SUM(volume_taken_liters::numeric), 0) as vol_taken
      FROM bottle_runs WHERE voided_at IS NULL GROUP BY batch_id
    ),
    keg_fills AS (
      SELECT batch_id,
        COALESCE(SUM(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END), 0) as vol_taken
      FROM keg_fills WHERE voided_at IS NULL AND deleted_at IS NULL GROUP BY batch_id
    ),
    adjustments AS (
      SELECT batch_id, COALESCE(SUM(adjustment_amount::numeric), 0) as total
      FROM batch_volume_adjustments WHERE deleted_at IS NULL GROUP BY batch_id
    ),
    distillation AS (
      SELECT source_batch_id as batch_id, COALESCE(SUM(source_volume_liters::numeric), 0) as total
      FROM distillation_records WHERE deleted_at IS NULL GROUP BY source_batch_id
    )
    SELECT
      eb.id, eb.name, COALESCE(eb.custom_name, '') as custom_name, eb.product_type, eb.recon_status,
      ROUND(eb.initial_volume_liters::numeric, 2) as initial_l,
      ROUND(eb.current_volume_liters::numeric, 2) as stored_l,
      ROUND(eb.initial_volume_liters::numeric
        + COALESCE(ti.total, 0) + COALESCE(mi.total, 0) + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0) - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0) - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0) - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
      , 2) as reconstructed_l,
      ROUND((eb.initial_volume_liters::numeric
        + COALESCE(ti.total, 0) + COALESCE(mi.total, 0) + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0) - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0) - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0) - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
        - eb.current_volume_liters::numeric
      ) / 3.78541, 2) as gap_gal
    FROM eligible_batches eb
    LEFT JOIN transfers_in ti ON ti.batch_id = eb.id
    LEFT JOIN transfers_out tout ON tout.batch_id = eb.id
    LEFT JOIN merges_in mi ON mi.batch_id = eb.id
    LEFT JOIN merges_out mout ON mout.batch_id = eb.id
    LEFT JOIN racking_losses rl ON rl.batch_id = eb.id
    LEFT JOIN filter_losses fl ON fl.batch_id = eb.id
    LEFT JOIN bottle_runs br ON br.batch_id = eb.id
    LEFT JOIN keg_fills kf ON kf.batch_id = eb.id
    LEFT JOIN adjustments adj ON adj.batch_id = eb.id
    LEFT JOIN distillation dist ON dist.batch_id = eb.id
    WHERE ABS(eb.initial_volume_liters::numeric
        + COALESCE(ti.total, 0) + COALESCE(mi.total, 0) + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0) - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0) - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0) - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
        - eb.current_volume_liters::numeric
    ) / 3.78541 >= 0.1
    ORDER BY ABS(eb.initial_volume_liters::numeric
        + COALESCE(ti.total, 0) + COALESCE(mi.total, 0) + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0) - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0) - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0) - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
        - eb.current_volume_liters::numeric
    ) DESC
  `));

  console.log("\nBatches with gap >= 0.1 gal:\n");
  console.log("Gap (gal) | Stored L | Recon L | Name | Product | Status");
  console.log("----------|----------|---------|------|---------|-------");
  let totalGapGal = 0;
  for (const r of rows.rows) {
    const gap = Number(r.gap_gal);
    totalGapGal += gap;
    const name = (r.custom_name || r.name).substring(0, 45);
    console.log(
      `${gap > 0 ? "+" : ""}${gap.toFixed(2)} gal | ${Number(r.stored_l).toFixed(1)} | ${Number(r.reconstructed_l).toFixed(1)} | ${name} | ${r.product_type} | ${r.recon_status}`
    );
  }
  console.log(`\nTotal batches with gap >= 0.1 gal: ${rows.rows.length}`);
  console.log(`Sum of gaps: ${totalGapGal.toFixed(2)} gal (${(totalGapGal * 3.78541).toFixed(1)} L)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
