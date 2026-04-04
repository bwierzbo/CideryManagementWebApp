import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString:
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://localhost:5432/cidery_management",
  ssl: { rejectUnauthorized: false },
});

const BATCH_ID = "505c2f54-eb15-48dd-bedf-ffb4d00878d1";
const G = (l: number) => (l / 3.78541).toFixed(2);
const sep = (title: string) => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(80));
};

async function main() {
  await c.connect();
  console.log("Connected to database.\n");

  // ─────────────────────────────────────────────────────────────────────────
  // 0. BATCH OVERVIEW
  // ─────────────────────────────────────────────────────────────────────────
  sep("0. BATCH OVERVIEW");
  const batch = await c.query(
    `SELECT b.*, v.name AS vessel_name, v.capacity_liters AS vessel_capacity
     FROM batches b
     LEFT JOIN vessels v ON v.id = b.vessel_id
     WHERE b.id = $1`,
    [BATCH_ID]
  );
  if (batch.rows.length === 0) {
    console.log("BATCH NOT FOUND! Checking if it was deleted...");
    const deleted = await c.query(
      `SELECT id, name, custom_name, deleted_at FROM batches WHERE id = $1`,
      [BATCH_ID]
    );
    if (deleted.rows.length > 0) {
      console.log("Found deleted batch:", deleted.rows[0]);
    } else {
      console.log("No batch exists with this ID at all.");
    }
    await c.end();
    return;
  }
  const b = batch.rows[0];
  console.log(`  Name:           ${b.name}`);
  console.log(`  Custom Name:    ${b.custom_name}`);
  console.log(`  Batch Number:   ${b.batch_number}`);
  console.log(`  Status:         ${b.status}`);
  console.log(`  Product Type:   ${b.product_type}`);
  console.log(`  Start Date:     ${b.start_date}`);
  console.log(`  Vessel:         ${b.vessel_name} (ID: ${b.vessel_id})`);
  console.log(`  Vessel Cap:     ${b.vessel_capacity ? G(parseFloat(b.vessel_capacity)) + " gal" : "N/A"}`);
  console.log(`  Initial Vol:    ${parseFloat(b.initial_volume_liters || "0").toFixed(2)} L (${G(parseFloat(b.initial_volume_liters || "0"))} gal)`);
  console.log(`  Current Vol:    ${parseFloat(b.current_volume_liters || "0").toFixed(2)} L (${G(parseFloat(b.current_volume_liters || "0"))} gal)`);
  console.log(`  Transfer Loss:  ${parseFloat(b.transfer_loss_l || "0").toFixed(2)} L`);
  console.log(`  Parent Batch:   ${b.parent_batch_id || "none"}`);
  console.log(`  Press Run:      ${b.origin_press_run_id || "none"}`);
  console.log(`  Recon Status:   ${b.reconciliation_status || "none"}`);
  console.log(`  Is Racking Der: ${b.is_racking_derivative}`);
  console.log(`  Deleted At:     ${b.deleted_at || "NOT deleted"}`);
  console.log(`  Notes:          ${b.notes || "none"}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. FULL AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────────────────
  sep("1. FULL AUDIT TRAIL FOR THIS BATCH");
  const auditBatch = await c.query(
    `SELECT table_name, record_id, operation, old_data, new_data, diff_data,
            changed_by, changed_at
     FROM audit_logs
     WHERE record_id = $1 AND table_name = 'batches'
     ORDER BY changed_at ASC`,
    [BATCH_ID]
  );
  console.log(`Found ${auditBatch.rows.length} audit entries for batches table:`);
  for (const a of auditBatch.rows) {
    console.log(`\n  [${a.changed_at}] ${a.operation} by ${a.changed_by || "system"}`);
    if (a.diff_data) {
      console.log(`    DIFF: ${JSON.stringify(a.diff_data, null, 2)}`);
    }
    if (a.operation === "create" && a.new_data) {
      const nd = a.new_data as any;
      console.log(`    NEW: status=${nd.status}, vessel_id=${nd.vessel_id || nd.vesselId}, volume=${nd.initial_volume_liters || nd.volumeL}L, custom_name=${nd.custom_name || nd.customName}`);
    }
    if (a.operation === "update") {
      if (a.old_data) console.log(`    OLD: ${JSON.stringify(a.old_data)}`);
      if (a.new_data) console.log(`    NEW: ${JSON.stringify(a.new_data)}`);
    }
    if (a.operation === "delete" || a.operation === "soft_delete") {
      console.log(`    DELETED DATA: ${JSON.stringify(a.old_data)}`);
    }
  }

  // Also check audit logs referencing this batch in ANY table
  const auditAll = await c.query(
    `SELECT table_name, record_id, operation, old_data, new_data, diff_data,
            changed_by, changed_at
     FROM audit_logs
     WHERE record_id = $1 AND table_name != 'batches'
     ORDER BY changed_at ASC`,
    [BATCH_ID]
  );
  if (auditAll.rows.length > 0) {
    console.log(`\n  Also found ${auditAll.rows.length} audit entries in OTHER tables with same record_id:`);
    for (const a of auditAll.rows) {
      console.log(`  [${a.changed_at}] ${a.table_name}.${a.operation} by ${a.changed_by || "system"}`);
      if (a.diff_data) console.log(`    DIFF: ${JSON.stringify(a.diff_data)}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CHECK FOR PACKAGING RUNS
  // ─────────────────────────────────────────────────────────────────────────
  sep("2. PACKAGING RUNS CHECK");

  // Bottle runs for this batch
  const bottleRuns = await c.query(
    `SELECT * FROM bottle_runs WHERE batch_id = $1 ORDER BY packaged_at`,
    [BATCH_ID]
  );
  console.log(`Bottle runs for this batch: ${bottleRuns.rows.length}`);
  for (const r of bottleRuns.rows) {
    console.log(`  ID: ${r.id}`);
    console.log(`  Packaged: ${r.packaged_at}, Volume: ${G(parseFloat(r.volume_taken_liters))} gal`);
    console.log(`  Loss: ${G(parseFloat(r.loss || "0"))} gal, Voided: ${r.voided_at || "no"}`);
  }

  // Keg fills for this batch
  const kegFills = await c.query(
    `SELECT * FROM keg_fills WHERE batch_id = $1 ORDER BY filled_at`,
    [BATCH_ID]
  );
  console.log(`\nKeg fills for this batch: ${kegFills.rows.length}`);
  for (const r of kegFills.rows) {
    console.log(`  ID: ${r.id}`);
    console.log(`  Filled: ${r.filled_at}, Volume: ${G(parseFloat(r.volume_taken))} gal`);
    console.log(`  Loss: ${G(parseFloat(r.loss || "0"))} gal, Distributed: ${r.distributed_at || "no"}`);
  }

  // Search for "Row 5" or "OBC Row" in bottle_runs (by batch name)
  const bottleRunSearch = await c.query(
    `SELECT br.id, br.packaged_at, br.volume_taken_liters, br.voided_at,
            b.name AS batch_name, b.custom_name
     FROM bottle_runs br
     JOIN batches b ON br.batch_id = b.id
     WHERE b.custom_name ILIKE '%Row 5%' OR b.custom_name ILIKE '%OBC Row%'
        OR b.name ILIKE '%Row 5%' OR b.name ILIKE '%OBC Row%'
        OR b.name ILIKE '%RO5%'
     ORDER BY br.packaged_at`
  );
  console.log(`\nBottle runs for "Row 5" / "OBC Row" batches: ${bottleRunSearch.rows.length}`);
  for (const r of bottleRunSearch.rows) {
    console.log(`  Batch: ${r.batch_name} (${r.custom_name}), Packaged: ${r.packaged_at}, Vol: ${G(parseFloat(r.volume_taken_liters))} gal, Voided: ${r.voided_at || "no"}`);
  }

  // Search keg fills similarly
  const kegFillSearch = await c.query(
    `SELECT kf.id, kf.filled_at, kf.volume_taken, kf.distributed_at, kf.voided_at,
            b.name AS batch_name, b.custom_name
     FROM keg_fills kf
     JOIN batches b ON kf.batch_id = b.id
     WHERE b.custom_name ILIKE '%Row 5%' OR b.custom_name ILIKE '%OBC Row%'
        OR b.name ILIKE '%Row 5%' OR b.name ILIKE '%OBC Row%'
        OR b.name ILIKE '%RO5%'
     ORDER BY kf.filled_at`
  );
  console.log(`Keg fills for "Row 5" / "OBC Row" batches: ${kegFillSearch.rows.length}`);
  for (const r of kegFillSearch.rows) {
    console.log(`  Batch: ${r.batch_name} (${r.custom_name}), Filled: ${r.filled_at}, Vol: ${G(parseFloat(r.volume_taken))} gal, Voided: ${r.voided_at || "no"}`);
  }

  // Inventory items linked to "Row 5" batches (via bottle_runs -> batches)
  const invItems = await c.query(
    `SELECT ii.id, ii.lot_code, ii.package_size_ml, ii.current_quantity, ii.created_at,
            br.product_name, br.packaged_at, br.voided_at,
            b.name AS batch_name, b.custom_name
     FROM inventory_items ii
     LEFT JOIN bottle_runs br ON ii.bottle_run_id = br.id
     LEFT JOIN batches b ON br.batch_id = b.id
     WHERE br.product_name ILIKE '%Row 5%' OR br.product_name ILIKE '%OBC Row%'
        OR br.product_name ILIKE '%OBC%'
        OR b.custom_name ILIKE '%Row 5%' OR b.custom_name ILIKE '%OBC Row%'
     ORDER BY ii.created_at`
  );
  console.log(`\nInventory items for "Row 5" / "OBC" batches: ${invItems.rows.length}`);
  for (const r of invItems.rows) {
    console.log(`  Product: ${r.product_name || "unnamed"}, Lot: ${r.lot_code}, Batch: ${r.batch_name} (${r.custom_name})`);
    console.log(`    Size: ${r.package_size_ml}ml, Qty: ${r.current_quantity}, Created: ${r.created_at}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. BATCH COMPOSITIONS
  // ─────────────────────────────────────────────────────────────────────────
  sep("3. BATCH COMPOSITIONS");

  const compFor = await c.query(
    `SELECT bc.*, bfv.name AS variety_name
     FROM batch_compositions bc
     LEFT JOIN base_fruit_varieties bfv ON bfv.id = bc.variety_id
     WHERE bc.batch_id = $1`,
    [BATCH_ID]
  );
  console.log(`Compositions FOR this batch: ${compFor.rows.length}`);
  for (const r of compFor.rows) {
    console.log(`  Source: ${r.source_type}, Variety: ${r.variety_name || "N/A"}, Weight: ${r.input_weight_kg || "N/A"}kg, Fraction: ${r.fraction_of_batch}, Juice Vol: ${r.juice_volume}L`);
  }

  // Was this batch used as a source in blends?
  const mergeOut = await c.query(
    `SELECT bmh.*, b.name AS target_name, b.custom_name AS target_custom
     FROM batch_merge_history bmh
     JOIN batches b ON bmh.target_batch_id = b.id
     WHERE bmh.source_batch_id = $1
     ORDER BY bmh.merged_at`,
    [BATCH_ID]
  );
  console.log(`\nMerge history OUT (this batch as source): ${mergeOut.rows.length}`);
  for (const r of mergeOut.rows) {
    console.log(`  -> ${r.target_name} (${r.target_custom}) on ${r.merged_at}, vol: ${G(parseFloat(r.volume_added))} gal, deleted: ${r.deleted_at || "no"}`);
  }

  // Merges IN
  const mergeIn = await c.query(
    `SELECT bmh.*,
            COALESCE(b2.name, pr.press_run_name, 'juice purchase') AS source_name,
            b2.custom_name AS source_custom
     FROM batch_merge_history bmh
     LEFT JOIN batches b2 ON bmh.source_batch_id = b2.id
     LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
     WHERE bmh.target_batch_id = $1
     ORDER BY bmh.merged_at`,
    [BATCH_ID]
  );
  console.log(`\nMerge history IN (this batch as target): ${mergeIn.rows.length}`);
  for (const r of mergeIn.rows) {
    console.log(`  <- ${r.source_name} (${r.source_custom || ""}) on ${r.merged_at}, vol: ${G(parseFloat(r.volume_added))} gal, type: ${r.source_type}`);
  }

  // Transfers OUT
  const tOut = await c.query(
    `SELECT bt.*, b2.name AS dest_name, b2.custom_name AS dest_custom
     FROM batch_transfers bt
     JOIN batches b2 ON bt.destination_batch_id = b2.id
     WHERE bt.source_batch_id = $1
     ORDER BY bt.transferred_at`,
    [BATCH_ID]
  );
  console.log(`\nTransfers OUT: ${tOut.rows.length}`);
  for (const r of tOut.rows) {
    console.log(`  -> ${r.dest_name} (${r.dest_custom}) on ${r.transferred_at}, vol: ${G(parseFloat(r.volume_transferred))} gal, deleted: ${r.deleted_at || "no"}`);
  }

  // Transfers IN
  const tIn = await c.query(
    `SELECT bt.*, b2.name AS source_name, b2.custom_name AS source_custom
     FROM batch_transfers bt
     JOIN batches b2 ON bt.source_batch_id = b2.id
     WHERE bt.destination_batch_id = $1
     ORDER BY bt.transferred_at`,
    [BATCH_ID]
  );
  console.log(`\nTransfers IN: ${tIn.rows.length}`);
  for (const r of tIn.rows) {
    console.log(`  <- ${r.source_name} (${r.source_custom}) on ${r.transferred_at}, vol: ${G(parseFloat(r.volume_transferred))} gal, deleted: ${r.deleted_at || "no"}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. SEARCH "ROW 5" ACROSS THE SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  sep("4. SEARCH 'ROW 5' ACROSS THE SYSTEM");

  const row5Batches = await c.query(
    `SELECT id, name, custom_name, batch_number, status, vessel_id,
            initial_volume_liters, current_volume_liters, product_type, deleted_at,
            start_date
     FROM batches
     WHERE custom_name ILIKE '%Row 5%' OR custom_name ILIKE '%RO5%'
        OR batch_number ILIKE '%Row 5%' OR batch_number ILIKE '%RO5%'
        OR name ILIKE '%Row 5%' OR name ILIKE '%RO5%'
     ORDER BY start_date`
  );
  console.log(`Batches matching "Row 5" / "RO5": ${row5Batches.rows.length}`);
  for (const r of row5Batches.rows) {
    const vesselRes = r.vessel_id
      ? await c.query(`SELECT name FROM vessels WHERE id = $1`, [r.vessel_id])
      : { rows: [{ name: "none" }] };
    console.log(`  ID: ${r.id}`);
    console.log(`    Name: ${r.name}, Custom: ${r.custom_name}`);
    console.log(`    Status: ${r.status}, Product: ${r.product_type}`);
    console.log(`    Vessel: ${vesselRes.rows[0]?.name || "none"}`);
    console.log(`    Volume: ${parseFloat(r.initial_volume_liters || "0").toFixed(1)}L -> ${parseFloat(r.current_volume_liters || "0").toFixed(1)}L`);
    console.log(`    Start: ${r.start_date}, Deleted: ${r.deleted_at || "no"}`);
  }

  // Press runs with "Row 5"
  const row5Press = await c.query(
    `SELECT * FROM press_runs WHERE press_run_name ILIKE '%Row 5%' OR notes ILIKE '%Row 5%' ORDER BY date_completed`
  );
  console.log(`\nPress runs matching "Row 5": ${row5Press.rows.length}`);
  for (const r of row5Press.rows) {
    console.log(`  ID: ${r.id}, Name: ${r.press_run_name}, Date: ${r.date_completed}, Status: ${r.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PRESS RUN DETAILS
  // ─────────────────────────────────────────────────────────────────────────
  sep("5. PRESS RUN DETAILS");

  if (b.origin_press_run_id) {
    const pr = await c.query(
      `SELECT * FROM press_runs WHERE id = $1`,
      [b.origin_press_run_id]
    );
    if (pr.rows.length > 0) {
      const p = pr.rows[0];
      console.log(`Press Run: ${p.press_run_name}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Date: ${p.date_completed}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  Total Juice: ${p.total_juice_volume_liters ? parseFloat(p.total_juice_volume_liters).toFixed(1) + "L" : "N/A"}`);
      console.log(`  Notes: ${p.notes || "none"}`);

      // Loads
      const loads = await c.query(
        `SELECT prl.*, bfv.name AS variety_name
         FROM press_run_loads prl
         LEFT JOIN base_fruit_varieties bfv ON bfv.id = prl.fruit_variety_id
         WHERE prl.press_run_id = $1
         ORDER BY prl.load_sequence`,
        [b.origin_press_run_id]
      );
      console.log(`\n  Loads (${loads.rows.length}):`);
      for (const l of loads.rows) {
        console.log(`    Seq ${l.load_sequence}: ${l.variety_name || "unknown"} ${parseFloat(l.apple_weight_kg || "0").toFixed(1)}kg`);
      }

      // ALL batches created from this press run
      const prBatches = await c.query(
        `SELECT id, name, custom_name, status, vessel_id,
                initial_volume_liters, current_volume_liters, deleted_at
         FROM batches WHERE origin_press_run_id = $1
         ORDER BY start_date`,
        [b.origin_press_run_id]
      );
      console.log(`\n  Batches created from this press run: ${prBatches.rows.length}`);
      for (const pb of prBatches.rows) {
        const vr = pb.vessel_id
          ? await c.query(`SELECT name FROM vessels WHERE id = $1`, [pb.vessel_id])
          : { rows: [{ name: "none" }] };
        console.log(`    ${pb.id}`);
        console.log(`      Name: ${pb.name} (${pb.custom_name})`);
        console.log(`      Vessel: ${vr.rows[0]?.name || "none"}, Status: ${pb.status}`);
        console.log(`      Volume: ${parseFloat(pb.initial_volume_liters || "0").toFixed(1)}L -> ${parseFloat(pb.current_volume_liters || "0").toFixed(1)}L`);
        console.log(`      Deleted: ${pb.deleted_at || "no"}`);
      }
    } else {
      console.log("Press run not found!");
    }
  } else {
    console.log("No press run linked to this batch.");
    // Check if the batch was created via merge/transfer
    console.log("Checking if batch was created via transfer...");
    if (b.parent_batch_id) {
      const parent = await c.query(
        `SELECT id, name, custom_name, status FROM batches WHERE id = $1`,
        [b.parent_batch_id]
      );
      if (parent.rows.length > 0) {
        console.log(`  Parent batch: ${parent.rows[0].name} (${parent.rows[0].custom_name})`);
      }
    }
  }

  // Also search for press run on 2024-11-18 (check name pattern and date)
  const pr1118 = await c.query(
    `SELECT id, press_run_name, date_completed, status, total_juice_volume_liters
     FROM press_runs WHERE press_run_name LIKE '2024/11/18%'
        OR press_run_name LIKE '2024-11-18%'
        OR date_completed = '2024-11-18'
     ORDER BY date_completed`
  );
  console.log(`\nPress runs on 2024-11-18: ${pr1118.rows.length}`);
  for (const r of pr1118.rows) {
    console.log(`  ${r.press_run_name} (${r.id}), juice: ${r.total_juice_volume_liters ? parseFloat(r.total_juice_volume_liters).toFixed(1) + "L" : "N/A"}, status: ${r.status}`);
    // Batches from this press run
    const pb = await c.query(
      `SELECT id, name, custom_name, status, vessel_id FROM batches WHERE origin_press_run_id = $1`,
      [r.id]
    );
    for (const x of pb.rows) {
      const vn = x.vessel_id
        ? (await c.query(`SELECT name FROM vessels WHERE id = $1`, [x.vessel_id])).rows[0]?.name
        : "none";
      console.log(`    -> Batch: ${x.name} (${x.custom_name}), vessel: ${vn}, status: ${x.status}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. VESSEL HISTORY
  // ─────────────────────────────────────────────────────────────────────────
  sep("6. VESSEL HISTORY - CARBOY-5G-6");

  // Find vessel
  const vessel = await c.query(
    `SELECT * FROM vessels WHERE name ILIKE '%CARBOY-5G-6%' OR name ILIKE '%Carboy 6%' OR name ILIKE '%5G-6%'`
  );
  if (vessel.rows.length > 0) {
    const v = vessel.rows[0];
    console.log(`Vessel found: ${v.name} (ID: ${v.id})`);
    console.log(`  Capacity: ${v.capacity_liters ? G(parseFloat(v.capacity_liters)) + " gal" : "N/A"}`);
    console.log(`  Status: ${v.status}`);
    console.log(`  Current batch: ${v.current_batch_id || "none"}`);

    // Audit logs for this vessel
    const vesselAudit = await c.query(
      `SELECT * FROM audit_logs WHERE record_id = $1 AND table_name = 'vessels'
       ORDER BY changed_at ASC`,
      [v.id]
    );
    console.log(`\n  Audit entries for vessel: ${vesselAudit.rows.length}`);
    for (const a of vesselAudit.rows) {
      console.log(`    [${a.changed_at}] ${a.operation}`);
      if (a.diff_data) console.log(`      DIFF: ${JSON.stringify(a.diff_data)}`);
    }

    // ALL batches that have been in this vessel (current or historical)
    const vesselBatches = await c.query(
      `SELECT id, name, custom_name, status, start_date, vessel_id,
              initial_volume_liters, current_volume_liters, deleted_at
       FROM batches WHERE vessel_id = $1
       ORDER BY start_date`,
      [v.id]
    );
    console.log(`\n  Batches currently assigned to this vessel: ${vesselBatches.rows.length}`);
    for (const vb of vesselBatches.rows) {
      console.log(`    ${vb.name} (${vb.custom_name}), start: ${vb.start_date}, status: ${vb.status}, vol: ${parseFloat(vb.current_volume_liters || "0").toFixed(1)}L, deleted: ${vb.deleted_at || "no"}`);
    }

    // Check audit_logs for vessel_id changes on ANY batch that involved this vessel
    const vesselSwaps = await c.query(
      `SELECT al.record_id, al.operation, al.old_data, al.new_data, al.diff_data,
              al.changed_at, al.changed_by
       FROM audit_logs al
       WHERE al.table_name = 'batches'
         AND (
           (al.diff_data::text ILIKE '%vessel_id%' AND al.diff_data::text ILIKE '%${v.id}%')
           OR (al.diff_data::text ILIKE '%vesselId%' AND al.diff_data::text ILIKE '%${v.id}%')
           OR (al.new_data::text ILIKE '%${v.id}%' AND al.operation = 'create')
         )
       ORDER BY al.changed_at ASC`
    );
    console.log(`\n  Audit entries with vessel_id changes involving this vessel: ${vesselSwaps.rows.length}`);
    for (const a of vesselSwaps.rows) {
      console.log(`    [${a.changed_at}] ${a.operation} batch=${a.record_id}`);
      if (a.diff_data) console.log(`      DIFF: ${JSON.stringify(a.diff_data)}`);
      if (a.operation === "create" && a.new_data) {
        const nd = a.new_data as any;
        console.log(`      NEW batch: name=${nd.name || nd.added?.name}, custom=${nd.custom_name || nd.added?.customName}, vessel=${nd.vessel_id || nd.added?.vesselId}`);
      }
    }
  } else {
    console.log("Vessel CARBOY-5G-6 NOT FOUND. Listing all carboy-like vessels:");
    const allCarboys = await c.query(
      `SELECT id, name, capacity_liters, status FROM vessels WHERE name ILIKE '%carboy%' OR name ILIKE '%5G%' ORDER BY name`
    );
    for (const v of allCarboys.rows) {
      console.log(`  ${v.name} (${v.id}), cap: ${v.capacity_liters ? G(parseFloat(v.capacity_liters)) + " gal" : "N/A"}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. ALL "OBC" BATCHES
  // ─────────────────────────────────────────────────────────────────────────
  sep("7. ALL OBC BATCHES");

  const obcBatches = await c.query(
    `SELECT b.id, b.name, b.custom_name, b.batch_number, b.status,
            b.product_type, b.vessel_id, b.initial_volume_liters,
            b.current_volume_liters, b.start_date, b.deleted_at,
            v.name AS vessel_name
     FROM batches b
     LEFT JOIN vessels v ON v.id = b.vessel_id
     WHERE b.custom_name ILIKE '%OBC%' OR b.name ILIKE '%OBC%'
     ORDER BY b.start_date`
  );
  console.log(`Total OBC batches: ${obcBatches.rows.length}`);
  for (const ob of obcBatches.rows) {
    console.log(`\n  ${ob.custom_name || ob.name}`);
    console.log(`    ID: ${ob.id}`);
    console.log(`    Status: ${ob.status}, Product: ${ob.product_type}`);
    console.log(`    Vessel: ${ob.vessel_name || "none"}`);
    console.log(`    Volume: ${parseFloat(ob.initial_volume_liters || "0").toFixed(1)}L -> ${parseFloat(ob.current_volume_liters || "0").toFixed(1)}L (${G(parseFloat(ob.current_volume_liters || "0"))} gal)`);
    console.log(`    Start: ${ob.start_date}, Deleted: ${ob.deleted_at || "no"}`);

    // Check if packaged
    const pkg = await c.query(
      `SELECT 'bottle' AS type, br.packaged_at AS date, br.volume_taken_liters AS vol, br.voided_at
       FROM bottle_runs br WHERE br.batch_id = $1
       UNION ALL
       SELECT 'keg' AS type, kf.filled_at AS date, kf.volume_taken AS vol, kf.voided_at
       FROM keg_fills kf WHERE kf.batch_id = $1 AND kf.deleted_at IS NULL
       ORDER BY date`,
      [ob.id]
    );
    if (pkg.rows.length > 0) {
      console.log(`    PACKAGING:`);
      for (const p of pkg.rows) {
        console.log(`      ${p.type}: ${p.date}, vol: ${G(parseFloat(p.vol))} gal, voided: ${p.voided_at || "no"}`);
      }
    } else {
      console.log(`    PACKAGING: NONE`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. TIMELINE RECONSTRUCTION
  // ─────────────────────────────────────────────────────────────────────────
  sep("8. COMPLETE TIMELINE");
  console.log("Gathering all events for this batch and vessel...\n");

  const vesselId = b.vessel_id;
  const timeline: { date: string; type: string; detail: string }[] = [];

  // Audit logs for the batch
  for (const a of auditBatch.rows) {
    let detail = `${a.operation}`;
    if (a.diff_data) detail += ` diff=${JSON.stringify(a.diff_data)}`;
    timeline.push({ date: String(a.changed_at), type: `AUDIT(batch)`, detail });
  }

  // Measurements
  const measurements = await c.query(
    `SELECT * FROM batch_measurements WHERE batch_id = $1 ORDER BY measurement_date`,
    [BATCH_ID]
  );
  for (const m of measurements.rows) {
    timeline.push({
      date: String(m.measurement_date),
      type: "MEASUREMENT",
      detail: `SG=${m.specific_gravity}, temp=${m.temperature}C, pH=${m.ph || "N/A"}`,
    });
  }

  // Additives
  const additives = await c.query(
    `SELECT * FROM batch_additives WHERE batch_id = $1 ORDER BY added_at`,
    [BATCH_ID]
  );
  for (const a of additives.rows) {
    timeline.push({
      date: String(a.added_at),
      type: "ADDITIVE",
      detail: `${a.additive_name || a.additive_type}: ${a.amount} ${a.unit}`,
    });
  }

  // Racking
  const rackings = await c.query(
    `SELECT * FROM batch_racking_operations WHERE batch_id = $1 ORDER BY racked_at`,
    [BATCH_ID]
  );
  for (const r of rackings.rows) {
    timeline.push({
      date: String(r.racked_at),
      type: "RACKING",
      detail: `loss=${G(parseFloat(r.volume_loss || "0"))} gal, notes: ${r.notes || "none"}`,
    });
  }

  // Transfers
  for (const r of tOut.rows) {
    timeline.push({
      date: String(r.transferred_at),
      type: "TRANSFER_OUT",
      detail: `-> ${r.dest_name} (${r.dest_custom}), vol=${G(parseFloat(r.volume_transferred))} gal, deleted=${r.deleted_at || "no"}`,
    });
  }
  for (const r of tIn.rows) {
    timeline.push({
      date: String(r.transferred_at),
      type: "TRANSFER_IN",
      detail: `<- ${r.source_name} (${r.source_custom}), vol=${G(parseFloat(r.volume_transferred))} gal, deleted=${r.deleted_at || "no"}`,
    });
  }

  // Merges
  for (const r of mergeOut.rows) {
    timeline.push({
      date: String(r.merged_at),
      type: "MERGE_OUT",
      detail: `-> ${r.target_name} (${r.target_custom}), vol=${G(parseFloat(r.volume_added))} gal`,
    });
  }
  for (const r of mergeIn.rows) {
    timeline.push({
      date: String(r.merged_at),
      type: "MERGE_IN",
      detail: `<- ${r.source_name} (${r.source_custom || ""}), vol=${G(parseFloat(r.volume_added))} gal`,
    });
  }

  // Bottle runs
  for (const r of bottleRuns.rows) {
    timeline.push({
      date: String(r.packaged_at),
      type: "BOTTLE_RUN",
      detail: `vol=${G(parseFloat(r.volume_taken_liters))} gal, voided=${r.voided_at || "no"}`,
    });
  }

  // Keg fills
  for (const r of kegFills.rows) {
    timeline.push({
      date: String(r.filled_at),
      type: "KEG_FILL",
      detail: `vol=${G(parseFloat(r.volume_taken))} gal, distributed=${r.distributed_at || "no"}`,
    });
  }

  // Volume adjustments
  const adjustments = await c.query(
    `SELECT * FROM batch_volume_adjustments WHERE batch_id = $1 ORDER BY adjustment_date`,
    [BATCH_ID]
  );
  for (const a of adjustments.rows) {
    timeline.push({
      date: String(a.adjustment_date),
      type: "ADJUSTMENT",
      detail: `amount=${G(parseFloat(a.adjustment_amount))} gal, type=${a.adjustment_type}, reason: ${a.reason || a.notes || "none"}`,
    });
  }

  // Also check OTHER batches that have been in this vessel (timeline overlap)
  if (vesselId) {
    const otherVesselBatches = await c.query(
      `SELECT id, name, custom_name, start_date, status, deleted_at
       FROM batches WHERE vessel_id = $1 AND id != $2
       ORDER BY start_date`,
      [vesselId, BATCH_ID]
    );
    for (const ob of otherVesselBatches.rows) {
      timeline.push({
        date: String(ob.start_date),
        type: "OTHER_BATCH_IN_VESSEL",
        detail: `${ob.name} (${ob.custom_name}), status=${ob.status}, deleted=${ob.deleted_at || "no"}`,
      });
    }
  }

  // Sort by date
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  console.log(`Total timeline events: ${timeline.length}\n`);
  for (const e of timeline) {
    const d = new Date(e.date);
    const dateStr = isNaN(d.getTime()) ? e.date : d.toISOString().replace("T", " ").slice(0, 19);
    console.log(`  ${dateStr}  [${e.type.padEnd(22)}]  ${e.detail}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  sep("SUMMARY / ANALYSIS");
  const init = parseFloat(b.initial_volume_liters || "0");
  const cur = parseFloat(b.current_volume_liters || "0");
  console.log(`Batch: ${b.custom_name || b.name}`);
  console.log(`Status: ${b.status}`);
  console.log(`Volume: ${init.toFixed(1)}L (${G(init)} gal) initial -> ${cur.toFixed(1)}L (${G(cur)} gal) current`);
  console.log(`Start Date: ${b.start_date}`);
  console.log(`Vessel: ${b.vessel_name}`);
  console.log(`Packaging runs found: ${bottleRuns.rows.length} bottle, ${kegFills.rows.length} keg`);
  console.log(`Transfers out: ${tOut.rows.length}, Merges out: ${mergeOut.rows.length}`);
  console.log(`Audit entries: ${auditBatch.rows.length}`);
  console.log(`Measurements: ${measurements.rows.length}`);
  console.log(`\nIf this batch has 0 packaging and 0 transfers out, and it's been a year,`);
  console.log(`it's likely either a ghost record or was dealt with outside the system.`);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
