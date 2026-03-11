import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

async function main() {
  // Find batches that have BOTH initial_volume > 0 AND merge-in from press runs
  const overlaps = await db.execute(
    sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number,
           CAST(b.initial_volume_liters AS NUMERIC) as initial_l,
           COALESCE(pr_merges.total_merged, 0) as pr_merged_l,
           COALESCE(jp_merges.total_merged, 0) as jp_merged_l,
           COALESCE(batch_merges.total_merged, 0) as batch_merged_l
    FROM batches b
    LEFT JOIN (
      SELECT target_batch_id, SUM(CAST(volume_added AS NUMERIC)) as total_merged
      FROM batch_merge_history
      WHERE source_press_run_id IS NOT NULL AND deleted_at IS NULL
      GROUP BY target_batch_id
    ) pr_merges ON pr_merges.target_batch_id = b.id
    LEFT JOIN (
      SELECT target_batch_id, SUM(CAST(volume_added AS NUMERIC)) as total_merged
      FROM batch_merge_history
      WHERE source_juice_purchase_item_id IS NOT NULL AND deleted_at IS NULL
      GROUP BY target_batch_id
    ) jp_merges ON jp_merges.target_batch_id = b.id
    LEFT JOIN (
      SELECT target_batch_id, SUM(CAST(volume_added AS NUMERIC)) as total_merged
      FROM batch_merge_history
      WHERE source_batch_id IS NOT NULL AND deleted_at IS NULL
      GROUP BY target_batch_id
    ) batch_merges ON batch_merges.target_batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
      AND (pr_merges.total_merged > 0 OR jp_merges.total_merged > 0)
    ORDER BY CAST(b.initial_volume_liters AS NUMERIC) DESC
    LIMIT 20
  `)
  );

  console.log(
    "Batches with initial > 0 AND merge-in from press runs or juice purchases:\n"
  );
  let totalInitial = 0;
  let totalPrMerge = 0;
  let totalJpMerge = 0;
  for (const r of overlaps.rows as any[]) {
    const init = parseFloat(r.initial_l);
    const prm = parseFloat(r.pr_merged_l || "0");
    const jpm = parseFloat(r.jp_merged_l || "0");
    const bm = parseFloat(r.batch_merged_l || "0");
    totalInitial += init;
    totalPrMerge += prm;
    totalJpMerge += jpm;
    console.log(
      `${r.custom_name || r.batch_number}: initial=${(init * GAL).toFixed(1)} gal, prMerge=${(prm * GAL).toFixed(1)} gal, jpMerge=${(jpm * GAL).toFixed(1)} gal, batchMerge=${(bm * GAL).toFixed(1)} gal`
    );
  }
  console.log(
    `\nTotal overlap: initial=${(totalInitial * GAL).toFixed(1)} gal, prMerges=${(totalPrMerge * GAL).toFixed(1)} gal, jpMerges=${(totalJpMerge * GAL).toFixed(1)} gal`
  );
  console.log(
    `If these are double-counted: ${((totalPrMerge + totalJpMerge) * GAL).toFixed(1)} gal of phantom volume`
  );

  // Also check: total merges by source type
  const mergeTotals = await db.execute(
    sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN source_press_run_id IS NOT NULL THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as from_press,
      COALESCE(SUM(CASE WHEN source_juice_purchase_item_id IS NOT NULL THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as from_juice,
      COALESCE(SUM(CASE WHEN source_batch_id IS NOT NULL THEN CAST(volume_added AS NUMERIC) ELSE 0 END), 0) as from_batch
    FROM batch_merge_history
    WHERE deleted_at IS NULL
  `)
  );
  const mt = mergeTotals.rows[0] as any;
  console.log("\n=== MERGE TOTALS BY SOURCE TYPE ===");
  console.log(
    `From press runs:      ${(parseFloat(mt.from_press) * GAL).toFixed(1)} gal`
  );
  console.log(
    `From juice purchases: ${(parseFloat(mt.from_juice) * GAL).toFixed(1)} gal`
  );
  console.log(
    `From other batches:   ${(parseFloat(mt.from_batch) * GAL).toFixed(1)} gal`
  );

  // Check batches with initial > 0 but NO merge-in (these get their volume from direct pumping)
  const noMerge = await db.execute(
    sql.raw(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(CAST(initial_volume_liters AS NUMERIC)), 0) as total
    FROM batches b
    WHERE b.deleted_at IS NULL AND COALESCE(b.product_type, 'cider') != 'juice'
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
      AND NOT EXISTS (SELECT 1 FROM batch_merge_history bmh
                      WHERE bmh.target_batch_id = b.id AND bmh.deleted_at IS NULL)
  `)
  );
  const nm = noMerge.rows[0] as any;
  console.log(
    `\nBatches with initial > 0 but NO merges: ${nm.cnt} batches, ${(parseFloat(nm.total) * GAL).toFixed(1)} gal`
  );

  // Check batches with initial = 0 that ONLY get volume from merges
  const zeroInit = await db.execute(
    sql.raw(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(m.total_merged), 0) as total_merged
    FROM batches b
    INNER JOIN (
      SELECT target_batch_id, SUM(CAST(volume_added AS NUMERIC)) as total_merged
      FROM batch_merge_history WHERE deleted_at IS NULL
      GROUP BY target_batch_id
    ) m ON m.target_batch_id = b.id
    WHERE b.deleted_at IS NULL AND COALESCE(b.product_type, 'cider') != 'juice'
      AND (CAST(b.initial_volume_liters AS NUMERIC) = 0 OR b.initial_volume_liters IS NULL)
  `)
  );
  const zi = zeroInit.rows[0] as any;
  console.log(
    `Batches with initial=0 getting volume from merges: ${zi.cnt} batches, ${(parseFloat(zi.total_merged) * GAL).toFixed(1)} gal`
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
