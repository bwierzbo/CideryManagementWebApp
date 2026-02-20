import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(4);

async function run() {
  await c.connect();

  // The child batch (racking derivative) received the 206.07 L transfer
  const childId = "91bb8d67-5b56-406e-889e-1bf10638d99b";
  
  console.log("=== CHILD BATCH: 2024-11-28_120 Barrel 2_BLEND_A - Remaining ===");
  console.log("(racking derivative, reconciliation_status=duplicate)\n");

  // What happened to this child batch?
  console.log("--- Transfers OUT from child ---");
  const txOut = await c.query(
    `SELECT id, destination_batch_id, CAST(volume_transferred AS float) as vol,
            CAST(loss AS float) as loss, transferred_at, deleted_at
     FROM batch_transfers WHERE source_batch_id = $1 ORDER BY transferred_at`,
    [childId]
  );
  if (txOut.rows.length === 0) console.log("  (none)");
  for (const r of txOut.rows) {
    console.log(`  ${r.id}: ${r.vol} L (${G(r.vol)} gal) -> ${r.destination_batch_id}, loss=${r.loss}, at=${r.transferred_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Transfers IN to child ---");
  const txIn = await c.query(
    `SELECT id, source_batch_id, CAST(volume_transferred AS float) as vol,
            CAST(loss AS float) as loss, transferred_at, deleted_at
     FROM batch_transfers WHERE destination_batch_id = $1 ORDER BY transferred_at`,
    [childId]
  );
  if (txIn.rows.length === 0) console.log("  (none)");
  for (const r of txIn.rows) {
    console.log(`  ${r.id}: ${r.vol} L (${G(r.vol)} gal) from ${r.source_batch_id}, loss=${r.loss}, at=${r.transferred_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Merges OUT from child ---");
  const mergeOut = await c.query(
    `SELECT id, target_batch_id, CAST(volume_added AS float) as vol, merged_at, deleted_at
     FROM batch_merge_history WHERE source_batch_id = $1 ORDER BY merged_at`,
    [childId]
  );
  if (mergeOut.rows.length === 0) console.log("  (none)");
  for (const r of mergeOut.rows) {
    console.log(`  ${r.id}: ${r.vol} L (${G(r.vol)} gal) -> ${r.target_batch_id}, at=${r.merged_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Merges IN to child ---");
  const mergeIn = await c.query(
    `SELECT id, source_batch_id, source_press_run_id, source_juice_purchase_item_id,
            CAST(volume_added AS float) as vol, merged_at, deleted_at
     FROM batch_merge_history WHERE target_batch_id = $1 ORDER BY merged_at`,
    [childId]
  );
  if (mergeIn.rows.length === 0) console.log("  (none)");
  for (const r of mergeIn.rows) {
    console.log(`  ${r.id}: ${r.vol} L (${G(r.vol)} gal) from batch=${r.source_batch_id}, press=${r.source_press_run_id}, juice=${r.source_juice_purchase_item_id}, at=${r.merged_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Bottle runs on child ---");
  const bottles = await c.query(
    `SELECT id, CAST(volume_taken_liters AS float) as vol, CAST(loss AS float) as loss,
            units_produced, packaged_at, voided_at
     FROM bottle_runs WHERE batch_id = $1 ORDER BY packaged_at`,
    [childId]
  );
  if (bottles.rows.length === 0) console.log("  (none)");
  for (const r of bottles.rows) {
    console.log(`  ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), loss=${r.loss}, units=${r.units_produced}, at=${r.packaged_at}, voided=${r.voided_at}`);
  }

  console.log("\n--- Keg fills on child ---");
  const kegs = await c.query(
    `SELECT id, CAST(volume_taken AS float) as vol, filled_at, voided_at, deleted_at
     FROM keg_fills WHERE batch_id = $1 ORDER BY filled_at`,
    [childId]
  );
  if (kegs.rows.length === 0) console.log("  (none)");
  for (const r of kegs.rows) {
    console.log(`  ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), at=${r.filled_at}, voided=${r.voided_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Volume adjustments on child ---");
  const adjs = await c.query(
    `SELECT id, CAST(adjustment_amount AS float) as amt, adjustment_type, reason, adjustment_date, deleted_at
     FROM batch_volume_adjustments WHERE batch_id = $1 ORDER BY adjustment_date`,
    [childId]
  );
  if (adjs.rows.length === 0) console.log("  (none)");
  for (const r of adjs.rows) {
    console.log(`  ${r.id}: ${r.amt} L (${G(r.amt)} gal), type=${r.adjustment_type}, reason=${r.reason}, at=${r.adjustment_date}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Racking operations on child ---");
  const racks = await c.query(
    `SELECT id, CAST(volume_loss AS float) as loss, CAST(volume_before AS float) as vb,
            CAST(volume_after AS float) as va, racked_at, notes, deleted_at
     FROM batch_racking_operations WHERE batch_id = $1 ORDER BY racked_at`,
    [childId]
  );
  if (racks.rows.length === 0) console.log("  (none)");
  for (const r of racks.rows) {
    console.log(`  ${r.id}: loss=${r.loss} L, before=${r.vb} L, after=${r.va} L, at=${r.racked_at}, notes=${r.notes}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Child batches of child ---");
  const grandchildren = await c.query(
    `SELECT id, name, batch_number, CAST(initial_volume_liters AS float) as init_l,
            CAST(current_volume_liters AS float) as cur_l, reconciliation_status, deleted_at
     FROM batches WHERE parent_batch_id = $1`,
    [childId]
  );
  if (grandchildren.rows.length === 0) console.log("  (none)");
  for (const r of grandchildren.rows) {
    console.log(`  ${r.id}: ${r.name}, init=${r.init_l} L, cur=${r.cur_l} L, recon=${r.reconciliation_status}, deleted=${r.deleted_at}`);
  }

  // Now check: what are the two source batches of the transfers IN to the parent?
  console.log("\n\n=== SOURCE BATCHES OF TRANSFERS IN ===");
  const sources = ["045016d0-83bc-4dd6-9bd0-685b55298559", "c6c5cbc8-c695-46f4-bfd1-6b63ce94a3a4"];
  for (const sid of sources) {
    const res = await c.query(
      `SELECT id, name, batch_number, product_type,
              CAST(initial_volume_liters AS float) as init_l,
              CAST(current_volume_liters AS float) as cur_l,
              reconciliation_status, deleted_at
       FROM batches WHERE id = $1`,
      [sid]
    );
    for (const r of res.rows) {
      console.log(`\n  Batch ${r.id}:`);
      console.log(`    Name: ${r.name}`);
      console.log(`    Batch#: ${r.batch_number}`);
      console.log(`    Product Type: ${r.product_type}`);
      console.log(`    Initial: ${r.init_l} L (${G(r.init_l)} gal)`);
      console.log(`    Current: ${r.cur_l} L (${G(r.cur_l)} gal)`);
      console.log(`    Recon Status: ${r.reconciliation_status}`);
      console.log(`    Deleted: ${r.deleted_at}`);
    }
  }

  // Also check the deleted merges - were those juice purchase merges replaced by transfers?
  console.log("\n\n=== DELETED MERGE JUICE PURCHASE ITEMS ===");
  const jpIds = ["6d9e0dcb-7d04-4961-8ead-c971abd11a8d", "b2a380f6-b86a-4f45-a5f6-355c87b4539b"];
  for (const jpId of jpIds) {
    const res = await c.query(
      `SELECT id, purchase_id, variety, CAST(quantity AS float) as qty, unit
       FROM purchase_lines WHERE id = $1`,
      [jpId]
    );
    for (const r of res.rows) {
      console.log(`  Purchase line ${r.id}: variety=${r.variety}, qty=${r.qty} ${r.unit}`);
    }
  }

  await c.end();
  console.log("\nDone.");
}

run().catch((e) => { console.error(e); process.exit(1); });
