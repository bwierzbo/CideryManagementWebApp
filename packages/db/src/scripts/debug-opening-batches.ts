import { Pool } from "pg";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: join(__dirname, "../../../../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function query(sql: string, params?: any[]) {
  const res = await pool.query(sql, params);
  return res.rows;
}

function printRows(rows: any[], label: string) {
  console.log(`\n--- ${label} ---`);
  if (!rows.length) {
    console.log("  (no rows)");
    return;
  }
  for (const row of rows) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(row)) {
      if (v === null) continue;
      let val = v instanceof Date ? v.toISOString().slice(0,10) : String(v);
      if (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/.test(v) && v.length === 36) {
        val = v.slice(0, 8) + '...';
      }
      parts.push(`${k}=${val}`);
    }
    console.log(`  ${parts.join(' | ')}`);
  }
}

async function main() {
  try {
    // ===== BATCH 1: Raspberry Blackberry =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 1: ALL RASPBERRY BLACKBERRY BATCHES");
    console.log("=".repeat(70));

    const raspBatches = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv,
             start_date, deleted_at, product_type
      FROM batches
      WHERE custom_name ILIKE '%raspberry%' OR name ILIKE '%raspberry%'
      ORDER BY start_date
    `);
    printRows(raspBatches, "Raspberry Blackberry Batches");

    const raspIds = raspBatches.map((b: any) => b.id);
    if (raspIds.length > 0) {
      const raspTransfers = await query(`
        SELECT t.transferred_at, t.volume_transferred as vol_L,
               sb.custom_name as src, sb.id as src_id,
               db.custom_name as dest, db.id as dest_id
        FROM batch_transfers t
        LEFT JOIN batches sb ON t.source_batch_id = sb.id
        LEFT JOIN batches db ON t.destination_batch_id = db.id
        WHERE t.source_batch_id = ANY($1) OR t.destination_batch_id = ANY($1)
        ORDER BY t.transferred_at
      `, [raspIds]);
      printRows(raspTransfers, "Transfers involving Raspberry Blackberry batches");

      const raspBottle = await query(`
        SELECT b.custom_name, b.id as batch_id, br.volume_taken_liters as vol_L, br.packaged_at, br.voided_at
        FROM bottle_runs br
        JOIN batches b ON br.batch_id = b.id
        WHERE br.batch_id = ANY($1)
        ORDER BY br.packaged_at
      `, [raspIds]);
      printRows(raspBottle, "Bottle runs for Raspberry Blackberry batches");

      const raspKeg = await query(`
        SELECT b.custom_name, b.id as batch_id, kf.volume_taken as vol_L, kf.filled_at, kf.voided_at, kf.deleted_at
        FROM keg_fills kf
        JOIN batches b ON kf.batch_id = b.id
        WHERE kf.batch_id = ANY($1)
        ORDER BY kf.filled_at
      `, [raspIds]);
      printRows(raspKeg, "Keg fills for Raspberry Blackberry batches");
    }

    // ===== BATCH 2 & 3: Black Currant Cider =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 2: ALL BLACK CURRANT CIDER BATCHES");
    console.log("=".repeat(70));

    const bcBatches = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv,
             start_date, deleted_at, product_type
      FROM batches
      WHERE custom_name ILIKE '%black currant%' OR name ILIKE '%black currant%'
      ORDER BY start_date
    `);
    printRows(bcBatches, "Black Currant Cider Batches");

    const bcIds = bcBatches.map((b: any) => b.id);
    if (bcIds.length > 0) {
      const bcTransfers = await query(`
        SELECT t.transferred_at, t.volume_transferred as vol_L,
               sb.custom_name as src, sb.id as src_id,
               db.custom_name as dest, db.id as dest_id
        FROM batch_transfers t
        LEFT JOIN batches sb ON t.source_batch_id = sb.id
        LEFT JOIN batches db ON t.destination_batch_id = db.id
        WHERE t.source_batch_id = ANY($1) OR t.destination_batch_id = ANY($1)
        ORDER BY t.transferred_at
      `, [bcIds]);
      printRows(bcTransfers, "Transfers involving Black Currant batches");

      const bcBottle = await query(`
        SELECT b.custom_name, b.id as batch_id, br.volume_taken_liters as vol_L, br.packaged_at, br.voided_at
        FROM bottle_runs br
        JOIN batches b ON br.batch_id = b.id
        WHERE br.batch_id = ANY($1)
        ORDER BY br.packaged_at
      `, [bcIds]);
      printRows(bcBottle, "Bottle runs for Black Currant batches");

      const bcKeg = await query(`
        SELECT b.custom_name, b.id as batch_id, kf.volume_taken as vol_L, kf.filled_at, kf.voided_at, kf.deleted_at
        FROM keg_fills kf
        JOIN batches b ON kf.batch_id = b.id
        WHERE kf.batch_id = ANY($1)
        ORDER BY kf.filled_at
      `, [bcIds]);
      printRows(bcKeg, "Keg fills for Black Currant batches");
    }

    // ===== BATCH 4: Strawberry Rhubarb =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 3: ALL STRAWBERRY RHUBARB BATCHES");
    console.log("=".repeat(70));

    const srBatches = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv,
             start_date, deleted_at, product_type
      FROM batches
      WHERE custom_name ILIKE '%strawberry%' OR name ILIKE '%strawberry%'
      ORDER BY start_date
    `);
    printRows(srBatches, "Strawberry Rhubarb Batches");

    const srIds = srBatches.map((b: any) => b.id);
    if (srIds.length > 0) {
      const srTransfers = await query(`
        SELECT t.transferred_at, t.volume_transferred as vol_L,
               sb.custom_name as src, sb.id as src_id,
               db.custom_name as dest, db.id as dest_id
        FROM batch_transfers t
        LEFT JOIN batches sb ON t.source_batch_id = sb.id
        LEFT JOIN batches db ON t.destination_batch_id = db.id
        WHERE t.source_batch_id = ANY($1) OR t.destination_batch_id = ANY($1)
        ORDER BY t.transferred_at
      `, [srIds]);
      printRows(srTransfers, "Transfers involving Strawberry Rhubarb batches");

      const srBottle = await query(`
        SELECT b.custom_name, b.id as batch_id, br.volume_taken_liters as vol_L, br.packaged_at, br.voided_at
        FROM bottle_runs br
        JOIN batches b ON br.batch_id = b.id
        WHERE br.batch_id = ANY($1)
        ORDER BY br.packaged_at
      `, [srIds]);
      printRows(srBottle, "Bottle runs for Strawberry Rhubarb batches");

      const srKeg = await query(`
        SELECT b.custom_name, b.id as batch_id, kf.volume_taken as vol_L, kf.filled_at, kf.voided_at, kf.deleted_at
        FROM keg_fills kf
        JOIN batches b ON kf.batch_id = b.id
        WHERE kf.batch_id = ANY($1)
        ORDER BY kf.filled_at
      `, [srIds]);
      printRows(srKeg, "Keg fills for Strawberry Rhubarb batches");
    }

    // ===== ADDITIONAL: Original Raspberry Blackberry batch (c2436e1d) full history =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 4: ORIGINAL RASPBERRY BLACKBERRY (c2436e1d) FULL HISTORY");
    console.log("=".repeat(70));

    const origBatch = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv,
             start_date, deleted_at, product_type
      FROM batches
      WHERE id::text LIKE 'c2436e1d%' OR batch_number = '2024-10-20_UNKN_BLEND_A'
      ORDER BY start_date
    `);
    printRows(origBatch, "Original Raspberry Blackberry batch");

    const origIds = origBatch.map((b: any) => b.id);
    if (origIds.length > 0) {
      const origTransfers = await query(`
        SELECT t.transferred_at, t.volume_transferred as vol_L,
               sb.custom_name as src, sb.id as src_id,
               db.custom_name as dest, db.id as dest_id
        FROM batch_transfers t
        LEFT JOIN batches sb ON t.source_batch_id = sb.id
        LEFT JOIN batches db ON t.destination_batch_id = db.id
        WHERE t.source_batch_id = ANY($1) OR t.destination_batch_id = ANY($1)
        ORDER BY t.transferred_at
      `, [origIds]);
      printRows(origTransfers, "Transfers for original Raspberry Blackberry (c2436e1d)");

      const origMerges = await query(`
        SELECT bmh.target_batch_id as dest_id, bmh.source_batch_id as src_batch_id,
               bmh.source_press_run_id as src_pr_id, bmh.source_juice_purchase_item_id as src_jp_id,
               bmh.volume_added as vol_added, bmh.merged_at,
               sb.custom_name as src_name, db.custom_name as dest_name
        FROM batch_merge_history bmh
        LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
        LEFT JOIN batches db ON bmh.target_batch_id = db.id
        WHERE bmh.target_batch_id = ANY($1) OR bmh.source_batch_id = ANY($1)
        ORDER BY bmh.merged_at
      `, [origIds]);
      printRows(origMerges, "Merge history for original Raspberry Blackberry (c2436e1d)");

      const origBottle = await query(`
        SELECT b.custom_name, b.id as batch_id, br.volume_taken_liters as vol_L, br.packaged_at, br.voided_at
        FROM bottle_runs br
        JOIN batches b ON br.batch_id = b.id
        WHERE br.batch_id = ANY($1)
        ORDER BY br.packaged_at
      `, [origIds]);
      printRows(origBottle, "Bottle runs for original Raspberry Blackberry (c2436e1d)");

      const origKeg = await query(`
        SELECT b.custom_name, b.id as batch_id, kf.volume_taken as vol_L, kf.filled_at, kf.voided_at, kf.deleted_at
        FROM keg_fills kf
        JOIN batches b ON kf.batch_id = b.id
        WHERE kf.batch_id = ANY($1)
        ORDER BY kf.filled_at
      `, [origIds]);
      printRows(origKeg, "Keg fills for original Raspberry Blackberry (c2436e1d)");

      const origAdj = await query(`
        SELECT ba.batch_id, b.custom_name, ba.adjustment_amount as adj_L, ba.reason, ba.created_at
        FROM batch_volume_adjustments ba
        JOIN batches b ON ba.batch_id = b.id
        WHERE ba.batch_id = ANY($1)
        ORDER BY ba.created_at
      `, [origIds]);
      printRows(origAdj, "Adjustments for original Raspberry Blackberry (c2436e1d)");
    }

    // ===== Cross-reference: Parent relationships =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 5: PARENT RELATIONSHIP CROSS-REFERENCES");
    console.log("=".repeat(70));

    const childrenOfRasp = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv
      FROM batches
      WHERE parent_batch_id = 'ef9febe3-29be-4b71-a3bb-6421c4127654'
      ORDER BY start_date
    `);
    printRows(childrenOfRasp, "Children of broken Raspberry Blackberry (ef9febe3)");

    const childrenOfOrig = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv
      FROM batches
      WHERE parent_batch_id::text LIKE 'c2436e1d%'
      ORDER BY start_date
    `);
    printRows(childrenOfOrig, "Children of original Raspberry Blackberry (c2436e1d)");

    const childrenOfSR = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv
      FROM batches
      WHERE parent_batch_id = '9c7112c8-c747-45d5-b71f-3565d91b2915'
      ORDER BY start_date
    `);
    printRows(childrenOfSR, "Children of broken Strawberry Rhubarb (9c7112c8)");

    // ===== Broken batches verification & history =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 6: ALL 4 BROKEN BATCHES - VERIFICATION & HISTORY");
    console.log("=".repeat(70));

    const brokenIds = [
      'ef9febe3-29be-4b71-a3bb-6421c4127654',
      '23298358-5a93-4db9-a2fe-3a2e50e2b15b',
      '8964d840-1c5f-4698-8e88-1f63e58b3db2',
      '9c7112c8-c747-45d5-b71f-3565d91b2915'
    ];

    const brokenBatchCheck = await query(`
      SELECT id, custom_name, batch_number,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             parent_batch_id, reconciliation_status as recon, is_racking_derivative as racking_deriv
      FROM batches
      WHERE id = ANY($1)
    `, [brokenIds]);
    printRows(brokenBatchCheck, "All 4 broken batches");

    const brokenMerges = await query(`
      SELECT bmh.target_batch_id as dest_id, bmh.source_batch_id as src_batch_id,
             bmh.volume_added as vol_added, bmh.merged_at,
             sb.custom_name as src_name, db.custom_name as dest_name
      FROM batch_merge_history bmh
      LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
      LEFT JOIN batches db ON bmh.target_batch_id = db.id
      WHERE bmh.target_batch_id = ANY($1) OR bmh.source_batch_id = ANY($1)
      ORDER BY bmh.merged_at
    `, [brokenIds]);
    printRows(brokenMerges, "Merge history involving broken batches");

    const brokenTransfers = await query(`
      SELECT t.transferred_at, t.volume_transferred as vol_L,
             sb.custom_name as src, sb.id as src_id,
             db.custom_name as dest, db.id as dest_id
      FROM batch_transfers t
      LEFT JOIN batches sb ON t.source_batch_id = sb.id
      LEFT JOIN batches db ON t.destination_batch_id = db.id
      WHERE t.source_batch_id = ANY($1) OR t.destination_batch_id = ANY($1)
      ORDER BY t.transferred_at
    `, [brokenIds]);
    printRows(brokenTransfers, "Transfers involving broken batches");

    // ===== Strawberry Rhubarb parent chain =====
    console.log("\n" + "=".repeat(70));
    console.log("SECTION 7: STRAWBERRY RHUBARB PARENT CHAIN & FAMILY");
    console.log("=".repeat(70));

    const srChain = await query(`
      WITH RECURSIVE chain AS (
        SELECT id, custom_name, batch_number, parent_batch_id,
               initial_volume_liters as init_L, current_volume_liters as curr_L,
               reconciliation_status as recon, is_racking_derivative as racking_deriv, 0 as depth
        FROM batches WHERE id = '9c7112c8-c747-45d5-b71f-3565d91b2915'
        UNION ALL
        SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
               b.initial_volume_liters, b.current_volume_liters,
               b.reconciliation_status, b.is_racking_derivative, c.depth + 1
        FROM batches b
        JOIN chain c ON b.id = c.parent_batch_id
        WHERE c.depth < 5
      )
      SELECT * FROM chain ORDER BY depth
    `);
    printRows(srChain, "Strawberry Rhubarb recursive parent chain");

    const srFamily = await query(`
      SELECT id, custom_name, batch_number, parent_batch_id,
             initial_volume_liters as init_L, current_volume_liters as curr_L,
             reconciliation_status as recon, is_racking_derivative as racking_deriv, start_date
      FROM batches
      WHERE custom_name ILIKE '%strawberry%' OR name ILIKE '%strawberry%'
         OR parent_batch_id IN (SELECT id FROM batches WHERE custom_name ILIKE '%strawberry%' OR name ILIKE '%strawberry%')
      ORDER BY start_date
    `);
    printRows(srFamily, "All Strawberry Rhubarb batches + their children");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
