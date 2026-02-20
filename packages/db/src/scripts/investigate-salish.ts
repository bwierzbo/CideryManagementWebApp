import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(4);
const BATCH_NUMBER = "2024-11-28_120 Barrel 2_BLEND_A";

async function run() {
  await c.connect();
  console.log("Investigating batch:", BATCH_NUMBER);
  console.log("=".repeat(80));

  // 1. Batch details
  console.log("\n--- 1. BATCH DETAILS ---");
  const batchRes = await c.query(
    `SELECT id, name, batch_number, product_type, 
            CAST(initial_volume_liters AS float) as init_l,
            CAST(current_volume_liters AS float) as cur_l,
            CAST(transfer_loss_l AS float) as transfer_loss_l,
            parent_batch_id, start_date, reconciliation_status,
            vessel_id, is_racking_derivative, deleted_at
     FROM batches 
     WHERE batch_number = $1 AND deleted_at IS NULL`,
    [BATCH_NUMBER]
  );
  for (const r of batchRes.rows) {
    console.log(`  ID: ${r.id}`);
    console.log(`  Name: ${r.name}`);
    console.log(`  Batch#: ${r.batch_number}`);
    console.log(`  Product Type: ${r.product_type}`);
    console.log(`  Initial Volume: ${r.init_l} L (${G(r.init_l)} gal)`);
    console.log(`  Current Volume: ${r.cur_l} L (${G(r.cur_l)} gal)`);
    console.log(`  Transfer Loss: ${r.transfer_loss_l} L`);
    console.log(`  Parent Batch ID: ${r.parent_batch_id}`);
    console.log(`  Start Date: ${r.start_date}`);
    console.log(`  Reconciliation Status: ${r.reconciliation_status}`);
    console.log(`  Vessel ID: ${r.vessel_id}`);
    console.log(`  Is Racking Derivative: ${r.is_racking_derivative}`);
  }
  if (batchRes.rows.length === 0) {
    console.log("  BATCH NOT FOUND!");
    await c.end();
    return;
  }
  const batchId = batchRes.rows[0].id;
  console.log(`\n  Using batch ID: ${batchId}`);

  // 2. Transfers OUT
  console.log("\n--- 2. TRANSFERS OUT (source_batch_id = this batch) ---");
  const txOut = await c.query(
    `SELECT id, destination_batch_id, CAST(volume_transferred AS float) as vol,
            CAST(loss AS float) as loss, transferred_at, deleted_at
     FROM batch_transfers 
     WHERE source_batch_id = $1
     ORDER BY transferred_at`,
    [batchId]
  );
  if (txOut.rows.length === 0) console.log("  (none)");
  for (const r of txOut.rows) {
    console.log(`  Transfer ${r.id}: ${r.vol} L (${G(r.vol)} gal) -> batch ${r.destination_batch_id}, loss=${r.loss} L, at=${r.transferred_at}, deleted=${r.deleted_at}`);
  }

  // 3. Transfers IN
  console.log("\n--- 3. TRANSFERS IN (destination_batch_id = this batch) ---");
  const txIn = await c.query(
    `SELECT id, source_batch_id, CAST(volume_transferred AS float) as vol,
            CAST(loss AS float) as loss, transferred_at, deleted_at
     FROM batch_transfers 
     WHERE destination_batch_id = $1
     ORDER BY transferred_at`,
    [batchId]
  );
  if (txIn.rows.length === 0) console.log("  (none)");
  for (const r of txIn.rows) {
    console.log(`  Transfer ${r.id}: ${r.vol} L (${G(r.vol)} gal) from batch ${r.source_batch_id}, loss=${r.loss} L, at=${r.transferred_at}, deleted=${r.deleted_at}`);
  }

  // 4. Merges as SOURCE (volume leaving)
  console.log("\n--- 4. MERGES AS SOURCE (volume leaving this batch) ---");
  const mergeOut = await c.query(
    `SELECT id, target_batch_id, CAST(volume_added AS float) as vol, merged_at, deleted_at
     FROM batch_merge_history 
     WHERE source_batch_id = $1
     ORDER BY merged_at`,
    [batchId]
  );
  if (mergeOut.rows.length === 0) console.log("  (none)");
  for (const r of mergeOut.rows) {
    console.log(`  Merge ${r.id}: ${r.vol} L (${G(r.vol)} gal) -> target batch ${r.target_batch_id}, at=${r.merged_at}, deleted=${r.deleted_at}`);
  }

  // 5. Merges as TARGET (volume entering)
  console.log("\n--- 5. MERGES AS TARGET (volume entering this batch) ---");
  const mergeIn = await c.query(
    `SELECT id, source_batch_id, source_press_run_id, source_juice_purchase_item_id,
            CAST(volume_added AS float) as vol, merged_at, deleted_at
     FROM batch_merge_history 
     WHERE target_batch_id = $1
     ORDER BY merged_at`,
    [batchId]
  );
  if (mergeIn.rows.length === 0) console.log("  (none)");
  for (const r of mergeIn.rows) {
    console.log(`  Merge ${r.id}: ${r.vol} L (${G(r.vol)} gal) from source_batch=${r.source_batch_id}, press_run=${r.source_press_run_id}, juice_purchase=${r.source_juice_purchase_item_id}, at=${r.merged_at}, deleted=${r.deleted_at}`);
  }

  // 6. Bottle runs
  console.log("\n--- 6. BOTTLE RUNS ---");
  const bottles = await c.query(
    `SELECT id, CAST(volume_taken_liters AS float) as vol, CAST(loss AS float) as loss,
            units_produced, package_size_ml, packaged_at, voided_at
     FROM bottle_runs 
     WHERE batch_id = $1
     ORDER BY packaged_at`,
    [batchId]
  );
  if (bottles.rows.length === 0) console.log("  (none)");
  for (const r of bottles.rows) {
    console.log(`  Bottle ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), loss=${r.loss} L, units=${r.units_produced}, pkg=${r.package_size_ml}ml, at=${r.packaged_at}, voided=${r.voided_at}`);
  }

  // 7. Keg fills
  console.log("\n--- 7. KEG FILLS ---");
  const kegs = await c.query(
    `SELECT id, CAST(volume_taken AS float) as vol, CAST(COALESCE(loss, '0') AS float) as loss,
            filled_at, voided_at, deleted_at
     FROM keg_fills 
     WHERE batch_id = $1
     ORDER BY filled_at`,
    [batchId]
  );
  if (kegs.rows.length === 0) console.log("  (none)");
  for (const r of kegs.rows) {
    console.log(`  Keg ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), loss=${r.loss} L, at=${r.filled_at}, voided=${r.voided_at}, deleted=${r.deleted_at}`);
  }

  // 8. Volume adjustments
  console.log("\n--- 8. VOLUME ADJUSTMENTS ---");
  const adjs = await c.query(
    `SELECT id, CAST(adjustment_amount AS float) as amt, adjustment_type, reason,
            adjustment_date, deleted_at
     FROM batch_volume_adjustments 
     WHERE batch_id = $1
     ORDER BY adjustment_date`,
    [batchId]
  );
  if (adjs.rows.length === 0) console.log("  (none)");
  for (const r of adjs.rows) {
    console.log(`  Adj ${r.id}: ${r.amt} L (${G(r.amt)} gal), type=${r.adjustment_type}, reason=${r.reason}, at=${r.adjustment_date}, deleted=${r.deleted_at}`);
  }

  // 9. Racking operations
  console.log("\n--- 9. RACKING OPERATIONS ---");
  const racks = await c.query(
    `SELECT id, CAST(volume_loss AS float) as loss, CAST(volume_before AS float) as vol_before,
            CAST(volume_after AS float) as vol_after, source_vessel_id, destination_vessel_id,
            racked_at, notes, deleted_at
     FROM batch_racking_operations 
     WHERE batch_id = $1
     ORDER BY racked_at`,
    [batchId]
  );
  if (racks.rows.length === 0) console.log("  (none)");
  for (const r of racks.rows) {
    console.log(`  Rack ${r.id}: loss=${r.loss} L (${G(r.loss)} gal), before=${r.vol_before} L (${G(r.vol_before)} gal), after=${r.vol_after} L (${G(r.vol_after)} gal), src_vessel=${r.source_vessel_id}, dst_vessel=${r.destination_vessel_id}, at=${r.racked_at}, notes=${r.notes}, deleted=${r.deleted_at}`);
  }

  // 10. Filter operations
  console.log("\n--- 10. FILTER OPERATIONS ---");
  const filters = await c.query(
    `SELECT id, CAST(volume_loss AS float) as loss, filtered_at, deleted_at
     FROM batch_filter_operations 
     WHERE batch_id = $1
     ORDER BY filtered_at`,
    [batchId]
  );
  if (filters.rows.length === 0) console.log("  (none)");
  for (const r of filters.rows) {
    console.log(`  Filter ${r.id}: loss=${r.loss} L (${G(r.loss)} gal), at=${r.filtered_at}, deleted=${r.deleted_at}`);
  }

  // 11. Distillation records
  console.log("\n--- 11. DISTILLATION RECORDS ---");
  const distil = await c.query(
    `SELECT id, CAST(source_volume_liters AS float) as vol, status, sent_at, deleted_at
     FROM distillation_records 
     WHERE source_batch_id = $1
     ORDER BY sent_at`,
    [batchId]
  );
  if (distil.rows.length === 0) console.log("  (none)");
  for (const r of distil.rows) {
    console.log(`  Distil ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), status=${r.status}, at=${r.sent_at}, deleted=${r.deleted_at}`);
  }

  // 12. Child batches (from racking)
  console.log("\n--- 12. CHILD BATCHES (parent_batch_id = this batch) ---");
  const children = await c.query(
    `SELECT id, name, batch_number, CAST(initial_volume_liters AS float) as init_l,
            CAST(current_volume_liters AS float) as cur_l, start_date, deleted_at,
            reconciliation_status, is_racking_derivative
     FROM batches 
     WHERE parent_batch_id = $1`,
    [batchId]
  );
  if (children.rows.length === 0) console.log("  (none)");
  for (const r of children.rows) {
    console.log(`  Child ${r.id}: name=${r.name}, batch#=${r.batch_number}, init=${r.init_l} L (${G(r.init_l)} gal), cur=${r.cur_l} L (${G(r.cur_l)} gal), start=${r.start_date}, deleted=${r.deleted_at}, recon=${r.reconciliation_status}, racking_deriv=${r.is_racking_derivative}`);
  }

  // 13. Volume balance summary
  console.log("\n--- 13. VOLUME BALANCE SUMMARY ---");
  const b = batchRes.rows[0];
  const initL = b.init_l;

  // Sum active transfers out
  let txOutTotal = 0;
  for (const r of txOut.rows) {
    if (!r.deleted_at) txOutTotal += r.vol + (r.loss || 0);
  }

  // Sum active transfers in
  let txInTotal = 0;
  for (const r of txIn.rows) {
    if (!r.deleted_at) txInTotal += r.vol;
  }

  // Sum active merges out
  let mergeOutTotal = 0;
  for (const r of mergeOut.rows) {
    if (!r.deleted_at) mergeOutTotal += r.vol;
  }

  // Sum active merges in
  let mergeInTotal = 0;
  for (const r of mergeIn.rows) {
    if (!r.deleted_at) mergeInTotal += r.vol;
  }

  // Sum active bottle runs
  let bottleTotal = 0;
  for (const r of bottles.rows) {
    if (!r.voided_at) bottleTotal += r.vol + (r.loss || 0);
  }

  // Sum active keg fills
  let kegTotal = 0;
  for (const r of kegs.rows) {
    if (!r.voided_at && !r.deleted_at) kegTotal += r.vol + (r.loss || 0);
  }

  // Sum active adjustments
  let adjTotal = 0;
  for (const r of adjs.rows) {
    if (!r.deleted_at) adjTotal += r.amt;
  }

  // Sum active racking losses
  let rackLossTotal = 0;
  for (const r of racks.rows) {
    if (!r.deleted_at) rackLossTotal += r.loss;
  }

  // Sum active filter losses
  let filterLossTotal = 0;
  for (const r of filters.rows) {
    if (!r.deleted_at) filterLossTotal += r.loss;
  }

  // Sum distillation
  let distilTotal = 0;
  for (const r of distil.rows) {
    if (!r.deleted_at && r.status !== "voided") distilTotal += r.vol;
  }

  const expectedCurrent = initL + txInTotal + mergeInTotal + adjTotal
    - txOutTotal - mergeOutTotal - bottleTotal - kegTotal - rackLossTotal - filterLossTotal - distilTotal;

  console.log(`  Initial Volume:       ${initL.toFixed(4)} L (${G(initL)} gal)`);
  console.log(`  + Transfers In:       ${txInTotal.toFixed(4)} L (${G(txInTotal)} gal)`);
  console.log(`  + Merges In:          ${mergeInTotal.toFixed(4)} L (${G(mergeInTotal)} gal)`);
  console.log(`  + Adjustments:        ${adjTotal.toFixed(4)} L (${G(adjTotal)} gal)`);
  console.log(`  - Transfers Out:      ${txOutTotal.toFixed(4)} L (${G(txOutTotal)} gal)`);
  console.log(`  - Merges Out:         ${mergeOutTotal.toFixed(4)} L (${G(mergeOutTotal)} gal)`);
  console.log(`  - Bottle Runs:        ${bottleTotal.toFixed(4)} L (${G(bottleTotal)} gal)`);
  console.log(`  - Keg Fills:          ${kegTotal.toFixed(4)} L (${G(kegTotal)} gal)`);
  console.log(`  - Racking Losses:     ${rackLossTotal.toFixed(4)} L (${G(rackLossTotal)} gal)`);
  console.log(`  - Filter Losses:      ${filterLossTotal.toFixed(4)} L (${G(filterLossTotal)} gal)`);
  console.log(`  - Distillation:       ${distilTotal.toFixed(4)} L (${G(distilTotal)} gal)`);
  console.log(`  -----------------------------------------------`);
  console.log(`  Expected Current:     ${expectedCurrent.toFixed(4)} L (${G(expectedCurrent)} gal)`);
  console.log(`  Actual Current:       ${b.cur_l.toFixed(4)} L (${G(b.cur_l)} gal)`);
  console.log(`  Discrepancy:          ${(expectedCurrent - b.cur_l).toFixed(4)} L (${G(expectedCurrent - b.cur_l)} gal)`);

  await c.end();
  console.log("\nDone.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
