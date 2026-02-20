import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Phase 1: Find direct fruit batches + descendants (already done previously)
  const wineBatches = await pool.query(`
    SELECT id, name, product_type FROM batches WHERE product_type = 'wine'
  `);
  console.log("Current wine batches:", wineBatches.rowCount);

  // Phase 2: Find PARENT batches that should also be wine
  // Logic: If a cider/perry batch has 0L volume and ALL its transfer destinations are wine,
  // then its production was entirely wine → reclassify as wine
  // Do this iteratively until no more changes
  let changed = true;
  let iteration = 0;
  while (changed) {
    iteration++;
    const result = await pool.query(`
      WITH parent_candidates AS (
        -- Find cider/perry batches with 0 volume that transferred to other batches
        SELECT DISTINCT b.id, b.name
        FROM batches b
        INNER JOIN batch_transfers bt ON bt.source_batch_id = b.id
        WHERE b.product_type IN ('cider', 'perry')
          AND COALESCE(CAST(b.current_volume_liters AS float), 0) = 0
          AND b.deleted_at IS NULL
      ),
      parents_with_all_wine_children AS (
        -- Of those parents, find ones where ALL destinations are wine
        SELECT pc.id, pc.name
        FROM parent_candidates pc
        WHERE NOT EXISTS (
          -- No non-wine destination
          SELECT 1
          FROM batch_transfers bt
          JOIN batches dest ON dest.id = bt.destination_batch_id
          WHERE bt.source_batch_id = pc.id
            AND dest.product_type != 'wine'
        )
      )
      UPDATE batches
      SET product_type = 'wine', updated_at = NOW()
      FROM parents_with_all_wine_children p
      WHERE batches.id = p.id
      RETURNING batches.id, batches.name
    `);

    changed = (result.rowCount ?? 0) > 0;
    if (changed) {
      console.log(`\nIteration ${iteration}: Reclassified ${result.rowCount} parent batches:`);
      result.rows.forEach((r: any) => console.log("  ", r.name));
    }
  }

  // Phase 3: Also check merge history — if a batch was merged INTO wine batches
  changed = true;
  while (changed) {
    iteration++;
    const result = await pool.query(`
      WITH merge_candidates AS (
        SELECT DISTINCT b.id, b.name
        FROM batches b
        INNER JOIN batch_merge_history bmh ON bmh.source_batch_id = b.id
        WHERE b.product_type IN ('cider', 'perry')
          AND COALESCE(CAST(b.current_volume_liters AS float), 0) = 0
          AND b.deleted_at IS NULL
          AND bmh.target_batch_id IS NOT NULL
      ),
      sources_with_all_wine_targets AS (
        SELECT mc.id, mc.name
        FROM merge_candidates mc
        WHERE NOT EXISTS (
          SELECT 1
          FROM batch_merge_history bmh
          JOIN batches tgt ON tgt.id = bmh.target_batch_id
          WHERE bmh.source_batch_id = mc.id
            AND tgt.product_type != 'wine'
        )
        -- Also ensure no non-wine transfer destinations
        AND NOT EXISTS (
          SELECT 1
          FROM batch_transfers bt
          JOIN batches dest ON dest.id = bt.destination_batch_id
          WHERE bt.source_batch_id = mc.id
            AND dest.product_type != 'wine'
        )
      )
      UPDATE batches
      SET product_type = 'wine', updated_at = NOW()
      FROM sources_with_all_wine_targets p
      WHERE batches.id = p.id
      RETURNING batches.id, batches.name
    `);

    changed = (result.rowCount ?? 0) > 0;
    if (changed) {
      console.log(`\nIteration ${iteration} (merges): Reclassified ${result.rowCount} source batches:`);
      result.rows.forEach((r: any) => console.log("  ", r.name));
    }
  }

  // Final count
  const finalCount = await pool.query(`
    SELECT product_type, COUNT(*) as cnt
    FROM batches
    WHERE deleted_at IS NULL
    GROUP BY product_type
    ORDER BY product_type
  `);
  console.log("\n=== Final batch counts by product type ===");
  finalCount.rows.forEach((r: any) => console.log("  ", r.product_type, ":", r.cnt));

  // Show wine batches that are verified for 2025
  const verified2025 = await pool.query(`
    SELECT name, product_type, reconciliation_status,
           CAST(initial_volume_liters AS float) as init_l,
           CAST(current_volume_liters AS float) as cur_l
    FROM batches
    WHERE product_type = 'wine' AND reconciliation_status = 'verified'
    ORDER BY name
  `);
  console.log("\n=== Verified wine batches ===");
  verified2025.rows.forEach((r: any) => console.log(
    "  ", (r.name || "").substring(0, 55).padEnd(57),
    "init:", String(r.init_l).padStart(7),
    "cur:", String(r.cur_l).padStart(7)
  ));

  await pool.end();
}

main().catch(console.error);
