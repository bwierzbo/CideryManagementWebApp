import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute(sql.raw(`
    WITH eligible_batches AS (
      SELECT id, name, product_type, initial_volume_liters, current_volume_liters,
             COALESCE(reconciliation_status, 'pending') as recon_status
      FROM batches
      WHERE deleted_at IS NULL
        AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        AND start_date::date <= '2025-12-31'::date
    ),
    transfers_in AS (
      SELECT destination_batch_id as batch_id,
             COALESCE(SUM(CAST(volume_transferred AS DECIMAL)), 0) as total
      FROM batch_transfers
      WHERE deleted_at IS NULL
      GROUP BY destination_batch_id
    ),
    transfers_out AS (
      SELECT source_batch_id as batch_id,
             COALESCE(SUM(CAST(volume_transferred AS DECIMAL)), 0) as total
      FROM batch_transfers
      WHERE deleted_at IS NULL
      GROUP BY source_batch_id
    ),
    merges_in AS (
      SELECT target_batch_id as batch_id,
             COALESCE(SUM(CAST(volume_added AS DECIMAL)), 0) as total
      FROM batch_merge_history
      WHERE deleted_at IS NULL
      GROUP BY target_batch_id
    ),
    merges_out AS (
      SELECT source_batch_id as batch_id,
             COALESCE(SUM(CAST(volume_added AS DECIMAL)), 0) as total
      FROM batch_merge_history
      WHERE source_batch_id IS NOT NULL AND deleted_at IS NULL
      GROUP BY source_batch_id
    ),
    racking_losses AS (
      SELECT batch_id,
             COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0) as total
      FROM batch_racking_operations
      WHERE deleted_at IS NULL
      GROUP BY batch_id
    ),
    filter_losses AS (
      SELECT batch_id,
             COALESCE(SUM(CAST(volume_loss AS DECIMAL)), 0) as total
      FROM batch_filter_operations
      GROUP BY batch_id
    ),
    bottle_runs AS (
      SELECT batch_id,
             COALESCE(SUM(CAST(volume_taken_liters AS DECIMAL)), 0) as vol_taken,
             COALESCE(SUM(
               CASE WHEN loss_unit = 'gal' THEN CAST(loss AS DECIMAL) * 3.78541
                    ELSE CAST(loss AS DECIMAL)
               END
             ), 0) as loss_total
      FROM bottle_runs br
      WHERE voided_at IS NULL
      GROUP BY batch_id
    ),
    keg_fills AS (
      SELECT batch_id,
             COALESCE(SUM(
               CASE WHEN volume_taken_unit = 'gal' THEN CAST(volume_taken AS DECIMAL) * 3.78541
                    ELSE CAST(volume_taken AS DECIMAL)
               END
             ), 0) as vol_taken,
             COALESCE(SUM(
               CASE WHEN loss_unit = 'gal' THEN CAST(loss AS DECIMAL) * 3.78541
                    ELSE CAST(loss AS DECIMAL)
               END
             ), 0) as loss_total
      FROM keg_fills kf
      WHERE voided_at IS NULL AND deleted_at IS NULL
      GROUP BY batch_id
    ),
    adjustments AS (
      SELECT batch_id,
             COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)), 0) as total
      FROM batch_volume_adjustments
      GROUP BY batch_id
    ),
    distillation AS (
      SELECT source_batch_id as batch_id,
             COALESCE(SUM(CAST(source_volume_liters AS DECIMAL)), 0) as total
      FROM distillation_records
      WHERE deleted_at IS NULL
      GROUP BY source_batch_id
    )
    SELECT
      eb.id,
      eb.name,
      eb.product_type,
      ROUND(CAST(eb.initial_volume_liters AS DECIMAL), 2) as initial_l,
      ROUND(CAST(eb.current_volume_liters AS DECIMAL), 2) as stored_l,
      ROUND(CAST(eb.initial_volume_liters AS DECIMAL)
        + COALESCE(ti.total, 0)
        + COALESCE(mi.total, 0)
        + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0)
        - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0)
        - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0)
        - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
      , 2) as reconstructed_l,
      ROUND(
        CAST(eb.initial_volume_liters AS DECIMAL)
        + COALESCE(ti.total, 0)
        + COALESCE(mi.total, 0)
        + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0)
        - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0)
        - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0)
        - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
        - CAST(eb.current_volume_liters AS DECIMAL)
      , 2) as gap_l,
      ROUND((
        CAST(eb.initial_volume_liters AS DECIMAL)
        + COALESCE(ti.total, 0)
        + COALESCE(mi.total, 0)
        + COALESCE(adj.total, 0)
        - COALESCE(tout.total, 0)
        - COALESCE(mout.total, 0)
        - COALESCE(rl.total, 0)
        - COALESCE(fl.total, 0)
        - COALESCE(br.vol_taken, 0)
        - COALESCE(kf.vol_taken, 0)
        - COALESCE(dist.total, 0)
        - CAST(eb.current_volume_liters AS DECIMAL)
      ) / 3.78541, 1) as gap_gal
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
    ORDER BY ABS(
      CAST(eb.initial_volume_liters AS DECIMAL)
      + COALESCE(ti.total, 0)
      + COALESCE(mi.total, 0)
      + COALESCE(adj.total, 0)
      - COALESCE(tout.total, 0)
      - COALESCE(mout.total, 0)
      - COALESCE(rl.total, 0)
      - COALESCE(fl.total, 0)
      - COALESCE(br.vol_taken, 0)
      - COALESCE(kf.vol_taken, 0)
      - COALESCE(dist.total, 0)
      - CAST(eb.current_volume_liters AS DECIMAL)
    ) DESC
  `));

  console.log("\n=== PER-BATCH VARIANCE (gap > 0.5 gal) ===\n");
  console.log("Gap_gal | Stored_L | Reconstructed_L | Gap_L | Name | Product");
  console.log("--------|----------|-----------------|-------|------|--------");

  let totalGapL = 0;
  let significantCount = 0;
  for (const r of rows.rows) {
    const gapGal = Number(r.gap_gal);
    const gapL = Number(r.gap_l);
    totalGapL += gapL;
    if (Math.abs(gapGal) >= 0.5) {
      significantCount++;
      console.log(
        `${gapGal > 0 ? "+" : ""}${gapGal.toFixed(1)} gal | ${Number(r.stored_l).toFixed(1)} | ${Number(r.reconstructed_l).toFixed(1)} | ${gapL > 0 ? "+" : ""}${gapL.toFixed(1)} | ${r.name} | ${r.product_type}`
      );
    }
  }

  console.log(`\nTotal batches: ${rows.rows.length}`);
  console.log(`Batches with gap >= 0.5 gal: ${significantCount}`);
  console.log(`Total gap: ${totalGapL.toFixed(1)} L = ${(totalGapL / 3.78541).toFixed(1)} gal`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
