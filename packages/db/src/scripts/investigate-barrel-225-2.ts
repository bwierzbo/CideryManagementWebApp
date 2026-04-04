import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await c.connect();

  // 1. Batch record for BARREL-225-2
  console.log("=== 1. BATCH RECORD FOR BARREL-225-2 ===\n");
  const batchRes = await c.query(
    `SELECT b.* FROM batches b JOIN vessels v ON b.vessel_id = v.id
     WHERE v.name = 'BARREL-225-2' AND b.deleted_at IS NULL`
  );
  if (batchRes.rows.length === 0) {
    console.log("No batch found in BARREL-225-2");
    await c.end();
    return;
  }
  const batch = batchRes.rows[0];
  const batchId = batch.id;
  for (const [key, val] of Object.entries(batch)) {
    console.log(`  ${key}: ${val}`);
  }

  // 2. All measurements
  console.log("\n=== 2. MEASUREMENTS (most recent first) ===\n");
  const measRes = await c.query(
    `SELECT id, measurement_date, abv, specific_gravity, ph, temperature, volume,
            is_estimated, estimate_source, notes
     FROM batch_measurements WHERE batch_id = $1 ORDER BY measurement_date DESC`,
    [batchId]
  );
  if (measRes.rows.length === 0) {
    console.log("  No measurements found.");
  }
  for (const r of measRes.rows) {
    console.log(`  Date: ${r.measurement_date} | ABV: ${r.abv} | SG: ${r.specific_gravity} | pH: ${r.ph} | Temp: ${r.temperature} | Vol: ${r.volume} | Est: ${r.is_estimated} (${r.estimate_source}) | Notes: ${r.notes}`);
  }

  // 3. Merge history (as target)
  console.log("\n=== 3. MERGE HISTORY (this batch as target) ===\n");
  const mergeRes = await c.query(
    `SELECT source_batch_id, volume_added, merged_at FROM batch_merge_history
     WHERE target_batch_id = $1 ORDER BY merged_at DESC`,
    [batchId]
  );
  if (mergeRes.rows.length === 0) {
    console.log("  No merge history found.");
  }
  for (const r of mergeRes.rows) {
    console.log(`  Source: ${r.source_batch_id} | Volume Added: ${r.volume_added} | Merged At: ${r.merged_at}`);
  }

  // 4. Source batch details
  if (mergeRes.rows.length > 0) {
    console.log("\n=== 4. SOURCE BATCH DETAILS (from merges) ===\n");
    const sourceIds = mergeRes.rows.map((r: any) => r.source_batch_id);
    const srcRes = await c.query(
      `SELECT id, name, custom_name, product_type, actual_abv, estimated_abv, status,
              CAST(initial_volume_liters AS float) as init_vol,
              CAST(current_volume_liters AS float) as cur_vol
       FROM batches WHERE id = ANY($1)`,
      [sourceIds]
    );
    for (const r of srcRes.rows) {
      console.log(`  ID: ${r.id} | Name: ${r.name} | Custom: ${r.custom_name} | Type: ${r.product_type} | ABV actual: ${r.actual_abv} | ABV est: ${r.estimated_abv} | Status: ${r.status} | Init Vol: ${r.init_vol} | Cur Vol: ${r.cur_vol}`);
    }
  }

  // 5. Transfers (as destination)
  console.log("\n=== 5. TRANSFERS (this batch as destination) ===\n");
  const xferRes = await c.query(
    `SELECT source_batch_id, volume_transferred, transferred_at FROM batch_transfers
     WHERE destination_batch_id = $1 ORDER BY transferred_at DESC`,
    [batchId]
  );
  if (xferRes.rows.length === 0) {
    console.log("  No transfers found.");
  }
  for (const r of xferRes.rows) {
    console.log(`  Source: ${r.source_batch_id} | Volume: ${r.volume_transferred} | At: ${r.transferred_at}`);
  }

  // Also check transfers OUT
  console.log("\n=== 5b. TRANSFERS (this batch as source) ===\n");
  const xferOutRes = await c.query(
    `SELECT destination_batch_id, volume_transferred, transferred_at FROM batch_transfers
     WHERE source_batch_id = $1 ORDER BY transferred_at DESC`,
    [batchId]
  );
  if (xferOutRes.rows.length === 0) {
    console.log("  No outbound transfers found.");
  }
  for (const r of xferOutRes.rows) {
    console.log(`  Destination: ${r.destination_batch_id} | Volume: ${r.volume_transferred} | At: ${r.transferred_at}`);
  }

  // 6. Batch compositions
  console.log("\n=== 6. BATCH COMPOSITIONS ===\n");
  const compRes = await c.query(
    `SELECT bc.source_type, bfv.name as variety_name, bc.juice_volume, bc.fraction_of_batch, bc.abv
     FROM batch_compositions bc
     LEFT JOIN base_fruit_varieties bfv ON bc.variety_id = bfv.id
     WHERE bc.batch_id = $1`,
    [batchId]
  );
  if (compRes.rows.length === 0) {
    console.log("  No compositions found.");
  }
  for (const r of compRes.rows) {
    console.log(`  Source: ${r.source_type} | Variety: ${r.variety_name} | Volume: ${r.juice_volume} | Fraction: ${r.fraction_of_batch} | ABV: ${r.abv}`);
  }

  // 7. Batch additives
  console.log("\n=== 7. BATCH ADDITIVES ===\n");
  const addRes = await c.query(
    `SELECT * FROM batch_additives WHERE batch_id = $1`,
    [batchId]
  );
  if (addRes.rows.length === 0) {
    console.log("  No additives found.");
  }
  for (const r of addRes.rows) {
    for (const [key, val] of Object.entries(r)) {
      console.log(`  ${key}: ${val}`);
    }
    console.log("  ---");
  }

  // 8. All Salish batches for comparison
  console.log("\n=== 8. ALL SALISH BATCHES ===\n");
  const salishRes = await c.query(
    `SELECT id, name, custom_name, product_type, status, actual_abv, estimated_abv,
            CAST(initial_volume_liters AS float) as init_vol,
            CAST(current_volume_liters AS float) as cur_vol,
            vessel_id
     FROM batches WHERE custom_name ILIKE '%Salish%' AND deleted_at IS NULL
     ORDER BY name`
  );
  for (const r of salishRes.rows) {
    // Get vessel name
    const vRes = await c.query(`SELECT name FROM vessels WHERE id = $1`, [r.vessel_id]);
    const vesselName = vRes.rows[0]?.name || "unknown";
    console.log(`  ID: ${r.id} | Name: ${r.name} | Custom: ${r.custom_name} | Type: ${r.product_type} | Status: ${r.status} | ABV actual: ${r.actual_abv} | ABV est: ${r.estimated_abv} | Init: ${r.init_vol}L | Cur: ${r.cur_vol}L | Vessel: ${vesselName}`);
  }

  // 9. Bonus: Check batch activity/history for any clues
  console.log("\n=== 9. BATCH HISTORY / ACTIVITY LOG ===\n");
  const histRes = await c.query(
    `SELECT * FROM batch_history WHERE batch_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [batchId]
  );
  if (histRes.rows.length === 0) {
    console.log("  No history entries found.");
  }
  for (const r of histRes.rows) {
    console.log(`  ${r.created_at} | Action: ${r.action_type} | Description: ${r.description} | Volume Change: ${r.volume_change} | New Volume: ${r.new_volume}`);
  }

  await c.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
