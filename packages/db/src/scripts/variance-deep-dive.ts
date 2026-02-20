import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(2);
const rd = "2025-12-31";

async function main() {
  await c.connect();

  // 1. TTB aggregate distributions (what the TTB waterfall uses)
  const ttbBottle = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     WHERE id.distribution_date::date > '2024-12-31'::date
       AND id.distribution_date::date <= $1::date`,
    [rd]
  );
  const ttbKeg = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills
     WHERE distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
       AND distributed_at::date > '2024-12-31'::date
       AND distributed_at::date <= $1::date`,
    [rd]
  );

  const ttbBottleL = parseFloat(ttbBottle.rows[0].total_l);
  const ttbKegL = parseFloat(ttbKeg.rows[0].total_l);
  console.log("=== TTB AGGREGATE DISTRIBUTIONS (2025) ===");
  console.log(`  Bottle: ${G(ttbBottleL)} gal (${ttbBottleL.toFixed(1)} L)`);
  console.log(`  Keg:    ${G(ttbKegL)} gal (${ttbKegL.toFixed(1)} L)`);
  console.log(`  Total:  ${G(ttbBottleL + ttbKegL)} gal\n`);

  // 2. Batch-scoped distributions (FULL HISTORY, eligible batches only)
  const bsBottle = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     JOIN batches b ON br.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND br.voided_at IS NULL
       AND id.distribution_date::date <= $1::date`,
    [rd]
  );
  const bsKeg = await c.query(
    `SELECT COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills kf
     JOIN batches b ON kf.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND kf.distributed_at IS NOT NULL
       AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
       AND kf.distributed_at::date <= $1::date`,
    [rd]
  );

  const bsBottleL = parseFloat(bsBottle.rows[0].total_l);
  const bsKegL = parseFloat(bsKeg.rows[0].total_l);
  console.log("=== BATCH-SCOPED DISTRIBUTIONS (full history, eligible batches) ===");
  console.log(`  Bottle: ${G(bsBottleL)} gal (${bsBottleL.toFixed(1)} L)`);
  console.log(`  Keg:    ${G(bsKegL)} gal (${bsKegL.toFixed(1)} L)`);
  console.log(`  Total:  ${G(bsBottleL + bsKegL)} gal\n`);

  // 3. WHERE ARE THE UNTRACEABLE DISTRIBUTIONS?
  console.log("=== UNTRACEABLE BOTTLE DISTRIBUTIONS ===");
  // Bottle distributions where batch is NULL, deleted, or excluded
  const untraceableBottle = await c.query(
    `SELECT
       CASE
         WHEN br.id IS NULL THEN 'no_bottle_run'
         WHEN br.batch_id IS NULL THEN 'bottle_run_no_batch'
         WHEN b.id IS NULL THEN 'batch_deleted'
         WHEN b.deleted_at IS NOT NULL THEN 'batch_soft_deleted'
         WHEN COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded') THEN 'batch_excluded'
         WHEN br.voided_at IS NOT NULL THEN 'bottle_run_voided'
         ELSE 'other'
       END as reason,
       COUNT(*) as dist_count,
       COALESCE(SUM(
         CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
       ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     LEFT JOIN bottle_runs br ON ii.bottle_run_id = br.id
     LEFT JOIN batches b ON br.batch_id = b.id
     WHERE id.distribution_date::date > '2024-12-31'::date
       AND id.distribution_date::date <= $1::date
       AND NOT (
         b.deleted_at IS NULL
         AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
         AND br.voided_at IS NULL
         AND br.batch_id IS NOT NULL
       )
     GROUP BY 1
     ORDER BY total_l DESC`,
    [rd]
  );
  for (const r of untraceableBottle.rows) {
    console.log(`  ${r.reason}: ${r.dist_count} distributions, ${G(parseFloat(r.total_l))} gal (${parseFloat(r.total_l).toFixed(1)} L)`);
  }

  console.log("\n=== UNTRACEABLE KEG DISTRIBUTIONS ===");
  const untraceableKeg = await c.query(
    `SELECT
       CASE
         WHEN kf.batch_id IS NULL THEN 'keg_no_batch'
         WHEN b.id IS NULL THEN 'batch_deleted_hard'
         WHEN b.deleted_at IS NOT NULL THEN 'batch_soft_deleted'
         WHEN COALESCE(b.reconciliation_status,'pending') IN ('duplicate','excluded') THEN 'batch_excluded'
         ELSE 'other'
       END as reason,
       COUNT(*) as fill_count,
       COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills kf
     LEFT JOIN batches b ON kf.batch_id = b.id
     WHERE kf.distributed_at IS NOT NULL
       AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
       AND kf.distributed_at::date > '2024-12-31'::date
       AND kf.distributed_at::date <= $1::date
       AND NOT (
         b.deleted_at IS NULL
         AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
         AND kf.batch_id IS NOT NULL
       )
     GROUP BY 1
     ORDER BY total_l DESC`,
    [rd]
  );
  for (const r of untraceableKeg.rows) {
    console.log(`  ${r.reason}: ${r.fill_count} fills, ${G(parseFloat(r.total_l))} gal (${parseFloat(r.total_l).toFixed(1)} L)`);
  }

  // 4. Check: are there inventory items with no bottle_run link?
  console.log("\n=== INVENTORY ITEMS WITHOUT BOTTLE_RUN ===");
  const noBottleRun = await c.query(
    `SELECT COUNT(*) as cnt,
            COALESCE(SUM(
              CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
            ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     WHERE ii.bottle_run_id IS NULL
       AND id.distribution_date::date > '2024-12-31'::date
       AND id.distribution_date::date <= $1::date`,
    [rd]
  );
  console.log(`  ${noBottleRun.rows[0].cnt} distributions from items with no bottle_run_id: ${G(parseFloat(noBottleRun.rows[0].total_l))} gal`);

  // 5. Check: are there inventory items where bottle_run has no batch?
  console.log("\n=== BOTTLE RUNS WITH NO BATCH ===");
  const noBatch = await c.query(
    `SELECT COUNT(*) as cnt,
            COALESCE(SUM(
              CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
            ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     WHERE br.batch_id IS NULL
       AND id.distribution_date::date > '2024-12-31'::date
       AND id.distribution_date::date <= $1::date`,
    [rd]
  );
  console.log(`  ${noBatch.rows[0].cnt} distributions from bottle_runs with no batch_id: ${G(parseFloat(noBatch.rows[0].total_l))} gal`);

  // 6. Keg fills with no batch
  console.log("\n=== KEG FILLS WITH NO BATCH ===");
  const kegNoBatch = await c.query(
    `SELECT COUNT(*) as cnt,
            COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as total_l
     FROM keg_fills
     WHERE batch_id IS NULL
       AND distributed_at IS NOT NULL
       AND voided_at IS NULL AND deleted_at IS NULL
       AND distributed_at::date > '2024-12-31'::date
       AND distributed_at::date <= $1::date`,
    [rd]
  );
  console.log(`  ${kegNoBatch.rows[0].cnt} fills with no batch_id: ${G(parseFloat(kegNoBatch.rows[0].total_l))} gal`);

  // 7. Distributions from 2025 period but BEFORE opening date scope in my query
  console.log("\n=== TIMING: Batch-scoped dists split by period ===");
  const bsBefore = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     JOIN batches b ON br.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND br.voided_at IS NULL
       AND id.distribution_date::date <= '2024-12-31'::date`,
    []
  );
  const bsDuring = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as total_l
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     JOIN batches b ON br.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND br.voided_at IS NULL
       AND id.distribution_date::date > '2024-12-31'::date
       AND id.distribution_date::date <= $1::date`,
    [rd]
  );
  console.log(`  Pre-2025 (<=2024-12-31): ${G(parseFloat(bsBefore.rows[0].total_l))} gal`);
  console.log(`  During 2025:             ${G(parseFloat(bsDuring.rows[0].total_l))} gal`);
  console.log(`  Full history total:      ${G(bsBottleL)} gal`);

  // 8. Summary
  const bottleGap = ttbBottleL - bsBottleL;
  const kegGap = ttbKegL - bsKegL;
  console.log("\n=== DISTRIBUTION GAP SUMMARY ===");
  console.log(`  Bottle gap (TTB agg - batch-scoped): ${G(bottleGap)} gal — untraceable to eligible batches`);
  console.log(`  Keg gap (TTB agg - batch-scoped):    ${G(kegGap)} gal — untraceable to eligible batches`);
  console.log(`  Total gap: ${G(bottleGap + kegGap)} gal`);
  console.log(`\n  NOTE: TTB agg uses 2025-only distributions (>2024-12-31).`);
  console.log(`  Batch-scoped uses FULL HISTORY (all time up to ${rd}).`);
  console.log(`  Gap means distributions exist that can't trace back to an eligible batch.`);

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
