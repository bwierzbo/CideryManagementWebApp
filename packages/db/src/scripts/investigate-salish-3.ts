import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(4);

async function run() {
  await c.connect();

  // Grandchild: a3e01109-199b-4750-926b-2bcc52f7ae7f
  const gcId = "a3e01109-199b-4750-926b-2bcc52f7ae7f";
  console.log("=== GRANDCHILD: 2024-11-28_120 Barrel 2_BLEND_A - Remaining - Remaining ===\n");

  const batch = await c.query(
    `SELECT id, name, batch_number, product_type,
            CAST(initial_volume_liters AS float) as init_l,
            CAST(current_volume_liters AS float) as cur_l,
            reconciliation_status, is_racking_derivative, parent_batch_id, vessel_id, deleted_at
     FROM batches WHERE id = $1`,
    [gcId]
  );
  for (const r of batch.rows) {
    console.log(`  Init: ${r.init_l} L (${G(r.init_l)} gal), Cur: ${r.cur_l} L (${G(r.cur_l)} gal)`);
    console.log(`  Recon: ${r.reconciliation_status}, Racking Deriv: ${r.is_racking_derivative}`);
    console.log(`  Parent: ${r.parent_batch_id}, Vessel: ${r.vessel_id}`);
  }

  console.log("\n--- Transfers OUT ---");
  const txOut = await c.query(
    `SELECT id, destination_batch_id, CAST(volume_transferred AS float) as vol,
            CAST(loss AS float) as loss, transferred_at, deleted_at
     FROM batch_transfers WHERE source_batch_id = $1 ORDER BY transferred_at`,
    [gcId]
  );
  if (txOut.rows.length === 0) console.log("  (none)");
  for (const r of txOut.rows) {
    console.log(`  ${r.id}: ${r.vol} L (${G(r.vol)} gal) -> ${r.destination_batch_id}, loss=${r.loss}, at=${r.transferred_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Transfers IN ---");
  const txIn = await c.query(
    `SELECT id, source_batch_id, CAST(volume_transferred AS float) as vol,
            CAST(loss AS float) as loss, transferred_at, deleted_at
     FROM batch_transfers WHERE destination_batch_id = $1 ORDER BY transferred_at`,
    [gcId]
  );
  if (txIn.rows.length === 0) console.log("  (none)");
  for (const r of txIn.rows) {
    console.log(`  ${r.id}: ${r.vol} L (${G(r.vol)} gal) from ${r.source_batch_id}, loss=${r.loss}, at=${r.transferred_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Bottle Runs ---");
  const bottles = await c.query(
    `SELECT id, CAST(volume_taken_liters AS float) as vol, CAST(loss AS float) as loss,
            units_produced, packaged_at, voided_at
     FROM bottle_runs WHERE batch_id = $1 ORDER BY packaged_at`,
    [gcId]
  );
  if (bottles.rows.length === 0) console.log("  (none)");
  for (const r of bottles.rows) {
    console.log(`  ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), loss=${r.loss}, units=${r.units_produced}, at=${r.packaged_at}, voided=${r.voided_at}`);
  }

  console.log("\n--- Keg Fills ---");
  const kegs = await c.query(
    `SELECT id, CAST(volume_taken AS float) as vol, filled_at, voided_at, deleted_at
     FROM keg_fills WHERE batch_id = $1 ORDER BY filled_at`,
    [gcId]
  );
  if (kegs.rows.length === 0) console.log("  (none)");
  for (const r of kegs.rows) {
    console.log(`  ${r.id}: vol=${r.vol} L (${G(r.vol)} gal), at=${r.filled_at}, voided=${r.voided_at}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Volume Adjustments ---");
  const adjs = await c.query(
    `SELECT id, CAST(adjustment_amount AS float) as amt, adjustment_type, reason, adjustment_date, deleted_at
     FROM batch_volume_adjustments WHERE batch_id = $1 ORDER BY adjustment_date`,
    [gcId]
  );
  if (adjs.rows.length === 0) console.log("  (none)");
  for (const r of adjs.rows) {
    console.log(`  ${r.id}: ${r.amt} L (${G(r.amt)} gal), type=${r.adjustment_type}, reason=${r.reason}, at=${r.adjustment_date}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Racking Ops ---");
  const racks = await c.query(
    `SELECT id, CAST(volume_loss AS float) as loss, CAST(volume_before AS float) as vb,
            CAST(volume_after AS float) as va, racked_at, notes, deleted_at
     FROM batch_racking_operations WHERE batch_id = $1 ORDER BY racked_at`,
    [gcId]
  );
  if (racks.rows.length === 0) console.log("  (none)");
  for (const r of racks.rows) {
    console.log(`  ${r.id}: loss=${r.loss} L, before=${r.vb} L, after=${r.va} L, at=${r.racked_at}, notes=${r.notes}, deleted=${r.deleted_at}`);
  }

  console.log("\n--- Children ---");
  const children = await c.query(
    `SELECT id, name, CAST(initial_volume_liters AS float) as init_l,
            CAST(current_volume_liters AS float) as cur_l, reconciliation_status, deleted_at
     FROM batches WHERE parent_batch_id = $1`,
    [gcId]
  );
  if (children.rows.length === 0) console.log("  (none)");
  for (const r of children.rows) {
    console.log(`  ${r.id}: ${r.name}, init=${r.init_l} L, cur=${r.cur_l} L, recon=${r.reconciliation_status}, deleted=${r.deleted_at}`);
  }

  // Also check batch 5ce0e31a that had an interesting deleted/active transfer pair with child
  console.log("\n\n=== BATCH 5ce0e31a (transferred 5L to/from child) ===");
  const b5 = await c.query(
    `SELECT id, name, batch_number, product_type,
            CAST(initial_volume_liters AS float) as init_l,
            CAST(current_volume_liters AS float) as cur_l,
            reconciliation_status, deleted_at
     FROM batches WHERE id = '5ce0e31a-9b1d-4786-ae0d-8f96a10fd915'`
  );
  for (const r of b5.rows) {
    console.log(`  Name: ${r.name}, Type: ${r.product_type}`);
    console.log(`  Init: ${r.init_l} L, Cur: ${r.cur_l} L, Recon: ${r.reconciliation_status}, Deleted: ${r.deleted_at}`);
  }

  // Now check SBD computation - what does computeSystemCalculatedOnHand return for parent batch?
  // Let's check what the SBD query actually does - look at all operations for the parent
  // within the TTB period (2025-01-01 to 2025-12-31)
  const parentId = "0639e21d-63c8-4b5d-94b4-bdd7823dee49";
  console.log("\n\n=== SBD-RELEVANT: PARENT BATCH OPERATIONS IN 2025 ===");
  
  // Transfers out after 2025-01-01
  console.log("\n--- Transfers OUT in 2025 ---");
  const txOut25 = await c.query(
    `SELECT id, CAST(volume_transferred AS float) as vol, transferred_at, deleted_at
     FROM batch_transfers WHERE source_batch_id = $1 AND transferred_at >= '2025-01-01' AND deleted_at IS NULL`,
    [parentId]
  );
  if (txOut25.rows.length === 0) console.log("  (none)");
  for (const r of txOut25.rows) console.log(`  ${r.vol} L at ${r.transferred_at}`);

  // Transfers in after 2025-01-01
  console.log("\n--- Transfers IN in 2025 ---");
  const txIn25 = await c.query(
    `SELECT id, CAST(volume_transferred AS float) as vol, transferred_at, deleted_at
     FROM batch_transfers WHERE destination_batch_id = $1 AND transferred_at >= '2025-01-01' AND deleted_at IS NULL`,
    [parentId]
  );
  if (txIn25.rows.length === 0) console.log("  (none)");
  for (const r of txIn25.rows) console.log(`  ${r.vol} L at ${r.transferred_at}`);

  // Bottles in 2025
  console.log("\n--- Bottle runs in 2025 ---");
  const bot25 = await c.query(
    `SELECT id, CAST(volume_taken_liters AS float) as vol, packaged_at, voided_at
     FROM bottle_runs WHERE batch_id = $1 AND packaged_at >= '2025-01-01' AND voided_at IS NULL`,
    [parentId]
  );
  if (bot25.rows.length === 0) console.log("  (none)");
  for (const r of bot25.rows) console.log(`  ${r.vol} L at ${r.packaged_at}`);

  // Racking in 2025
  console.log("\n--- Racking ops in 2025 ---");
  const rack25 = await c.query(
    `SELECT id, CAST(volume_loss AS float) as loss, racked_at, deleted_at
     FROM batch_racking_operations WHERE batch_id = $1 AND racked_at >= '2025-01-01' AND deleted_at IS NULL`,
    [parentId]
  );
  if (rack25.rows.length === 0) console.log("  (none)");
  for (const r of rack25.rows) console.log(`  loss=${r.loss} L at ${r.racked_at}`);

  await c.end();
  console.log("\nDone.");
}

run().catch((e) => { console.error(e); process.exit(1); });
