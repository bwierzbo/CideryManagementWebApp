import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(3);
const L = (v: number) => v.toFixed(3);
const sep = (title: string) => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(80));
};
const sub = (title: string) => {
  console.log(`\n  --- ${title} ---`);
};

async function auditBatch(batchIdPrefix: string, label: string) {
  sep(`BATCH AUDIT: ${label} (id starts with ${batchIdPrefix})`);

  // Find batch
  const batchRes = await c.query(
    `SELECT b.id, b.name, b.custom_name, b.batch_number, b.status, b.product_type,
            b.initial_volume, b.initial_volume_unit, b.initial_volume_liters,
            b.current_volume, b.current_volume_unit, b.current_volume_liters,
            b.transfer_loss_l, b.transfer_loss_notes,
            b.original_gravity, b.final_gravity, b.estimated_abv, b.actual_abv,
            b.parent_batch_id, b.is_racking_derivative, b.is_archived,
            b.reconciliation_status, b.start_date, b.end_date, b.created_at,
            b.vessel_id, b.created_by,
            v.name as vessel_name, v.capacity_liters as vessel_capacity,
            u.name as creator_name
     FROM batches b
     LEFT JOIN vessels v ON b.vessel_id = v.id
     LEFT JOIN users u ON b.created_by = u.id
     WHERE b.id::text LIKE $1 AND b.deleted_at IS NULL`,
    [`${batchIdPrefix}%`]
  );

  if (batchRes.rows.length === 0) {
    console.log("  BATCH NOT FOUND!");
    return null;
  }

  const b = batchRes.rows[0];
  const id = b.id;
  const init = parseFloat(b.initial_volume_liters || b.initial_volume || "0");
  const cur = parseFloat(b.current_volume_liters || b.current_volume || "0");
  const tl = parseFloat(b.transfer_loss_l || "0");

  sub("BASIC INFO");
  console.log(`    ID:              ${id}`);
  console.log(`    Name:            ${b.name}`);
  console.log(`    Custom Name:     ${b.custom_name || "(none)"}`);
  console.log(`    Batch Number:    ${b.batch_number}`);
  console.log(`    Status:          ${b.status}`);
  console.log(`    Product Type:    ${b.product_type}`);
  console.log(`    Created:         ${b.created_at}`);
  console.log(`    Start Date:      ${b.start_date}`);
  console.log(`    End Date:        ${b.end_date || "(none)"}`);
  console.log(`    Created By:      ${b.creator_name || b.created_by || "(unknown)"}`);
  console.log(`    Vessel:          ${b.vessel_name || "(none)"} (cap: ${b.vessel_capacity ? G(parseFloat(b.vessel_capacity)) + " gal" : "N/A"})`);
  console.log(`    Parent Batch:    ${b.parent_batch_id || "(none)"}`);
  console.log(`    Racking Deriv:   ${b.is_racking_derivative}`);
  console.log(`    Archived:        ${b.is_archived}`);
  console.log(`    Recon Status:    ${b.reconciliation_status}`);
  console.log(`    Initial Volume:  ${L(init)} L (${G(init)} gal) [${b.initial_volume} ${b.initial_volume_unit}]`);
  console.log(`    Current Volume:  ${L(cur)} L (${G(cur)} gal) [${b.current_volume} ${b.current_volume_unit}]`);
  console.log(`    Transfer Loss:   ${L(tl)} L (${G(tl)} gal)`);
  console.log(`    OG:              ${b.original_gravity || "N/A"}`);
  console.log(`    FG:              ${b.final_gravity || "N/A"}`);
  console.log(`    Est ABV:         ${b.estimated_abv || "N/A"}%`);
  console.log(`    Actual ABV:      ${b.actual_abv || "N/A"}%`);

  // TRANSFERS IN
  sub("TRANSFERS IN");
  const tIn = await c.query(
    `SELECT bt.id, bt.volume_transferred, bt.loss, bt.transferred_at,
            bs.name as source_name, bs.id as source_id,
            vs.name as source_vessel
     FROM batch_transfers bt
     JOIN batches bs ON bt.source_batch_id = bs.id
     LEFT JOIN vessels vs ON bs.vessel_id = vs.id
     WHERE bt.destination_batch_id = $1 AND bt.deleted_at IS NULL
     ORDER BY bt.transferred_at`,
    [id]
  );
  let transfersInTotal = 0;
  let transfersInLossTotal = 0;
  if (tIn.rows.length === 0) {
    console.log("    (none)");
  }
  for (const t of tIn.rows) {
    const vol = parseFloat(t.volume_transferred);
    const loss = parseFloat(t.loss || "0");
    transfersInTotal += vol;
    transfersInLossTotal += loss;
    console.log(`    ${t.transferred_at} | FROM "${t.source_name}" (${t.source_vessel || "?"}) | vol=${L(vol)} L (${G(vol)} gal) | loss=${L(loss)} L`);
  }
  if (tIn.rows.length > 0) {
    console.log(`    TOTAL IN: ${L(transfersInTotal)} L (${G(transfersInTotal)} gal), loss: ${L(transfersInLossTotal)} L`);
  }

  // TRANSFERS OUT
  sub("TRANSFERS OUT");
  const tOut = await c.query(
    `SELECT bt.id, bt.volume_transferred, bt.loss, bt.transferred_at,
            bd.name as dest_name, bd.id as dest_id,
            vd.name as dest_vessel
     FROM batch_transfers bt
     JOIN batches bd ON bt.destination_batch_id = bd.id
     LEFT JOIN vessels vd ON bd.vessel_id = vd.id
     WHERE bt.source_batch_id = $1 AND bt.deleted_at IS NULL
     ORDER BY bt.transferred_at`,
    [id]
  );
  let transfersOutTotal = 0;
  let transfersOutLossTotal = 0;
  if (tOut.rows.length === 0) {
    console.log("    (none)");
  }
  for (const t of tOut.rows) {
    const vol = parseFloat(t.volume_transferred);
    const loss = parseFloat(t.loss || "0");
    transfersOutTotal += vol;
    transfersOutLossTotal += loss;
    console.log(`    ${t.transferred_at} | TO "${t.dest_name}" (${t.dest_vessel || "?"}) | vol=${L(vol)} L (${G(vol)} gal) | loss=${L(loss)} L`);
  }
  if (tOut.rows.length > 0) {
    console.log(`    TOTAL OUT: ${L(transfersOutTotal)} L (${G(transfersOutTotal)} gal), loss: ${L(transfersOutLossTotal)} L`);
  }

  // MERGES IN
  sub("MERGES IN (as target)");
  const mIn = await c.query(
    `SELECT bb.id, bb.volume_added, bb.merged_at, bb.source_type,
            COALESCE(b2.name, pr.press_run_name, 'juice purchase') as source_name
     FROM batch_merge_history bb
     LEFT JOIN batches b2 ON bb.source_batch_id = b2.id
     LEFT JOIN press_runs pr ON bb.source_press_run_id = pr.id
     WHERE bb.target_batch_id = $1 AND bb.deleted_at IS NULL
     ORDER BY bb.merged_at`,
    [id]
  );
  let mergesInTotal = 0;
  if (mIn.rows.length === 0) {
    console.log("    (none)");
  }
  for (const m of mIn.rows) {
    const vol = parseFloat(m.volume_added);
    mergesInTotal += vol;
    console.log(`    ${m.merged_at} | FROM "${m.source_name}" (${m.source_type}) | vol=${L(vol)} L (${G(vol)} gal)`);
  }

  // MERGES OUT
  sub("MERGES OUT (as source)");
  const mOut = await c.query(
    `SELECT bb.id, bb.volume_added, bb.merged_at, b2.name as target_name
     FROM batch_merge_history bb
     JOIN batches b2 ON bb.target_batch_id = b2.id
     WHERE bb.source_batch_id = $1 AND bb.deleted_at IS NULL
     ORDER BY bb.merged_at`,
    [id]
  );
  let mergesOutTotal = 0;
  if (mOut.rows.length === 0) {
    console.log("    (none)");
  }
  for (const m of mOut.rows) {
    const vol = parseFloat(m.volume_added);
    mergesOutTotal += vol;
    console.log(`    ${m.merged_at} | TO "${m.target_name}" | vol=${L(vol)} L (${G(vol)} gal)`);
  }

  // VOLUME ADJUSTMENTS
  sub("VOLUME ADJUSTMENTS");
  const adj = await c.query(
    `SELECT adjustment_amount, adjustment_date, reason FROM batch_volume_adjustments
     WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY adjustment_date`,
    [id]
  );
  let adjTotal = 0;
  if (adj.rows.length === 0) {
    console.log("    (none)");
  }
  for (const a of adj.rows) {
    const amt = parseFloat(a.adjustment_amount);
    adjTotal += amt;
    console.log(`    ${a.adjustment_date} | amount=${L(amt)} L (${G(amt)} gal) | reason="${a.reason}"`);
  }

  // RACKING OPERATIONS
  sub("RACKING OPERATIONS");
  const rack = await c.query(
    `SELECT volume_loss, racked_at, notes FROM batch_racking_operations
     WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY racked_at`,
    [id]
  );
  let rackingTotal = 0;
  if (rack.rows.length === 0) {
    console.log("    (none)");
  }
  for (const r of rack.rows) {
    const loss = parseFloat(r.volume_loss);
    rackingTotal += loss;
    console.log(`    ${r.racked_at} | loss=${L(loss)} L (${G(loss)} gal) | notes="${r.notes || ""}"`);
  }

  // MEASUREMENTS
  sub("MEASUREMENTS");
  const meas = await c.query(
    `SELECT measurement_date, specific_gravity, abv, ph, volume, volume_unit, volume_liters,
            temperature, is_estimated, measurement_method, notes
     FROM batch_measurements
     WHERE batch_id = $1 AND deleted_at IS NULL
     ORDER BY measurement_date`,
    [id]
  );
  if (meas.rows.length === 0) {
    console.log("    (none)");
  }
  for (const m of meas.rows) {
    const volL = m.volume_liters ? parseFloat(m.volume_liters) : null;
    console.log(`    ${m.measurement_date} | SG=${m.specific_gravity || "?"} | ABV=${m.abv || "?"}% | pH=${m.ph || "?"} | vol=${volL !== null ? L(volL) + " L" : m.volume ? m.volume + " " + m.volume_unit : "?"} | temp=${m.temperature || "?"}°C | method=${m.measurement_method || "?"} | est=${m.is_estimated} | notes="${m.notes || ""}"`);
  }

  // ADDITIVES
  sub("ADDITIVES");
  const addRes = await c.query(
    `SELECT additive_type, additive_name, amount, unit, added_at, added_by, notes, total_cost
     FROM batch_additives
     WHERE batch_id = $1 AND deleted_at IS NULL
     ORDER BY added_at`,
    [id]
  );
  if (addRes.rows.length === 0) {
    console.log("    (none)");
  }
  for (const a of addRes.rows) {
    console.log(`    ${a.added_at} | ${a.additive_type}: ${a.additive_name} | ${a.amount} ${a.unit} | cost=${a.total_cost || "?"} | by=${a.added_by || "?"} | notes="${a.notes || ""}"`);
  }

  // BOTTLE RUNS (PACKAGING)
  sub("BOTTLE RUNS (PACKAGING)");
  const bot = await c.query(
    `SELECT br.id, br.packaged_at, br.package_type, br.package_size_ml, br.units_produced,
            br.volume_taken, br.volume_taken_unit, br.volume_taken_liters,
            br.loss, br.loss_unit, br.loss_percentage,
            br.abv_at_packaging, br.carbonation_level, br.status,
            br.voided_at, v.name as vessel_name
     FROM bottle_runs br
     LEFT JOIN vessels v ON br.vessel_id = v.id
     WHERE br.batch_id = $1
     ORDER BY br.packaged_at`,
    [id]
  );
  let bottlingTotalTaken = 0;
  let bottlingTotalLoss = 0;
  if (bot.rows.length === 0) {
    console.log("    (none)");
  }
  for (const r of bot.rows) {
    const taken = parseFloat(r.volume_taken_liters || r.volume_taken || "0");
    const loss = parseFloat(r.loss || "0");
    const voided = r.voided_at ? " [VOIDED]" : "";
    if (!r.voided_at) {
      bottlingTotalTaken += taken;
      bottlingTotalLoss += loss;
    }
    console.log(`    ${r.packaged_at} | ${r.package_type} ${r.package_size_ml}ml | units=${r.units_produced} | taken=${L(taken)} L (${G(taken)} gal) | loss=${L(loss)} L | ABV=${r.abv_at_packaging || "?"}% | status=${r.status}${voided}`);
    console.log(`      Bottle Run ID: ${r.id}`);
  }
  if (bot.rows.length > 0) {
    console.log(`    TOTAL PACKAGED: taken=${L(bottlingTotalTaken)} L (${G(bottlingTotalTaken)} gal), loss=${L(bottlingTotalLoss)} L`);
  }

  // KEG FILLS
  sub("KEG FILLS");
  const keg = await c.query(
    `SELECT volume_taken, loss, filled_at, distributed_at, voided_at
     FROM keg_fills
     WHERE batch_id = $1 AND deleted_at IS NULL
     ORDER BY filled_at`,
    [id]
  );
  let keggingTotal = 0;
  let keggingLoss = 0;
  if (keg.rows.length === 0) {
    console.log("    (none)");
  }
  for (const r of keg.rows) {
    const taken = parseFloat(r.volume_taken);
    const loss = parseFloat(r.loss || "0");
    if (!r.voided_at) {
      keggingTotal += taken;
      keggingLoss += loss;
    }
    console.log(`    ${r.filled_at} | taken=${L(taken)} L | loss=${L(loss)} L | dist=${r.distributed_at || "N/A"} ${r.voided_at ? "[VOIDED]" : ""}`);
  }

  // DISTILLATION
  sub("DISTILLATION");
  const dist = await c.query(
    `SELECT source_volume_liters, sent_at, status FROM distillation_records
     WHERE source_batch_id = $1 AND deleted_at IS NULL ORDER BY sent_at`,
    [id]
  );
  let distTotal = 0;
  if (dist.rows.length === 0) {
    console.log("    (none)");
  }
  for (const r of dist.rows) {
    const vol = parseFloat(r.source_volume_liters || "0");
    if (r.status === "sent" || r.status === "received") distTotal += vol;
    console.log(`    ${r.sent_at} | vol=${L(vol)} L | status=${r.status}`);
  }

  // VOLUME RECONSTRUCTION
  sub("VOLUME RECONSTRUCTION");
  const isTransferCreated = b.parent_batch_id && transfersInTotal >= init * 0.9;
  const effectiveInitial = isTransferCreated ? 0 : init;

  const reconstructed = effectiveInitial + mergesInTotal - mergesOutTotal
    + transfersInTotal - transfersOutTotal
    - transfersInLossTotal - transfersOutLossTotal
    - bottlingTotalTaken - bottlingTotalLoss
    - keggingTotal - keggingLoss
    - distTotal + adjTotal - rackingTotal;

  console.log(`    Effective Initial:   ${L(effectiveInitial)} L (transfer-created: ${isTransferCreated})`);
  console.log(`    + Merges In:         ${L(mergesInTotal)} L`);
  console.log(`    - Merges Out:        ${L(mergesOutTotal)} L`);
  console.log(`    + Transfers In:      ${L(transfersInTotal)} L`);
  console.log(`    - Transfers Out:     ${L(transfersOutTotal)} L`);
  console.log(`    - Transfer In Loss:  ${L(transfersInLossTotal)} L`);
  console.log(`    - Transfer Out Loss: ${L(transfersOutLossTotal)} L`);
  console.log(`    - Bottling Taken:    ${L(bottlingTotalTaken)} L`);
  console.log(`    - Bottling Loss:     ${L(bottlingTotalLoss)} L`);
  console.log(`    - Kegging Taken:     ${L(keggingTotal)} L`);
  console.log(`    - Kegging Loss:      ${L(keggingLoss)} L`);
  console.log(`    - Distillation:      ${L(distTotal)} L`);
  console.log(`    + Adjustments:       ${L(adjTotal)} L`);
  console.log(`    - Racking Loss:      ${L(rackingTotal)} L`);
  console.log(`    ────────────────────────────────`);
  console.log(`    = RECONSTRUCTED:     ${L(reconstructed)} L (${G(reconstructed)} gal)`);
  console.log(`    STORED (current):    ${L(cur)} L (${G(cur)} gal)`);
  const delta = reconstructed - cur;
  console.log(`    DELTA:               ${L(delta)} L (${G(delta)} gal) ${Math.abs(delta) < 0.01 ? "✓ MATCHES" : "⚠ MISMATCH"}`);

  return {
    id,
    name: b.name,
    init,
    cur,
    transfersInTotal,
    transfersOutTotal,
    transfersInLossTotal,
    transfersOutLossTotal,
    mergesInTotal,
    mergesOutTotal,
    bottlingTotalTaken,
    bottlingTotalLoss,
    keggingTotal,
    keggingLoss,
    rackingTotal,
    adjTotal,
    distTotal,
    reconstructed,
    delta,
    bottleRuns: bot.rows,
    status: b.status,
    parentBatchId: b.parent_batch_id,
  };
}

async function auditInventory(batchId: string) {
  sep("INVENTORY ITEMS FOR RED CURRANT PACKAGING");

  // Get bottle runs for this batch
  const runs = await c.query(
    `SELECT br.id, br.packaged_at, br.package_size_ml, br.units_produced, br.status, br.voided_at
     FROM bottle_runs br
     WHERE br.batch_id = $1
     ORDER BY br.packaged_at`,
    [batchId]
  );

  for (const run of runs.rows) {
    console.log(`\n  Bottle Run ${run.id} (${run.packaged_at}, ${run.package_size_ml}ml, ${run.units_produced} units, status=${run.status}${run.voided_at ? " VOIDED" : ""}):`);

    const items = await c.query(
      `SELECT ii.id, ii.lot_code, ii.package_type, ii.package_size_ml, ii.current_quantity,
              ii.created_at, ii.deleted_at
       FROM inventory_items ii
       WHERE ii.bottle_run_id = $1
       ORDER BY ii.created_at`,
      [run.id]
    );

    if (items.rows.length === 0) {
      console.log("    No inventory items found.");
    }
    for (const item of items.rows) {
      console.log(`    Item ${item.id}: lot=${item.lot_code || "?"} | ${item.package_type} ${item.package_size_ml}ml | qty=${item.current_quantity} | deleted=${item.deleted_at ? "YES" : "no"}`);

      // Distributions
      const dists = await c.query(
        `SELECT distribution_date, distribution_location, quantity_distributed, price_per_unit, total_revenue, notes
         FROM inventory_distributions
         WHERE inventory_item_id = $1
         ORDER BY distribution_date`,
        [item.id]
      );
      if (dists.rows.length > 0) {
        console.log(`    Distributions (${dists.rows.length}):`);
        for (const d of dists.rows) {
          console.log(`      ${d.distribution_date} | qty=${d.quantity_distributed} | to="${d.distribution_location}" | price=${d.price_per_unit} | rev=${d.total_revenue}`);
        }
      }

      // Adjustments
      const adjRes = await c.query(
        `SELECT adjusted_at, quantity_change, reason, adjustment_type
         FROM inventory_adjustments
         WHERE inventory_item_id = $1
         ORDER BY adjusted_at`,
        [item.id]
      );
      if (adjRes.rows.length > 0) {
        console.log(`    Inventory Adjustments (${adjRes.rows.length}):`);
        for (const a of adjRes.rows) {
          console.log(`      ${a.adjusted_at} | ${a.adjustment_type} | qty_change=${a.quantity_change} | reason="${a.reason}"`);
        }
      }
    }
  }
}

async function auditParentOutgoingTransfers(parentIdPrefix: string) {
  sep("PARENT BATCH: ALL OUTGOING TRANSFERS (6a06ce10 - Summer Community Blend 1)");

  const parentRes = await c.query(
    `SELECT b.id, b.name, b.initial_volume_liters, b.current_volume_liters, b.status,
            b.transfer_loss_l, v.name as vessel_name
     FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
     WHERE b.id::text LIKE $1 AND b.deleted_at IS NULL`,
    [`${parentIdPrefix}%`]
  );

  if (parentRes.rows.length === 0) {
    console.log("  PARENT NOT FOUND!");
    return null;
  }

  const p = parentRes.rows[0];
  const pInit = parseFloat(p.initial_volume_liters || "0");
  const pCur = parseFloat(p.current_volume_liters || "0");
  const pTL = parseFloat(p.transfer_loss_l || "0");

  console.log(`\n  ID:              ${p.id}`);
  console.log(`  Name:            ${p.name}`);
  console.log(`  Vessel:          ${p.vessel_name}`);
  console.log(`  Status:          ${p.status}`);
  console.log(`  Initial Volume:  ${L(pInit)} L (${G(pInit)} gal)`);
  console.log(`  Current Volume:  ${L(pCur)} L (${G(pCur)} gal)`);
  console.log(`  Transfer Loss:   ${L(pTL)} L`);

  // All transfers IN to parent
  sub("TRANSFERS IN to parent");
  const ptIn = await c.query(
    `SELECT bt.volume_transferred, bt.loss, bt.transferred_at, bs.name as source_name
     FROM batch_transfers bt JOIN batches bs ON bt.source_batch_id = bs.id
     WHERE bt.destination_batch_id = $1 AND bt.deleted_at IS NULL
     ORDER BY bt.transferred_at`,
    [p.id]
  );
  let parentTransfersIn = 0;
  let parentTransfersInLoss = 0;
  if (ptIn.rows.length === 0) {
    console.log("    (none)");
  }
  for (const t of ptIn.rows) {
    const vol = parseFloat(t.volume_transferred);
    const loss = parseFloat(t.loss || "0");
    parentTransfersIn += vol;
    parentTransfersInLoss += loss;
    console.log(`    ${t.transferred_at} | FROM "${t.source_name}" | vol=${L(vol)} L (${G(vol)} gal) | loss=${L(loss)} L`);
  }

  // All merges IN to parent
  sub("MERGES IN to parent");
  const pmIn = await c.query(
    `SELECT bb.volume_added, bb.merged_at, bb.source_type,
            COALESCE(b2.name, pr.press_run_name, 'juice purchase') as source_name
     FROM batch_merge_history bb
     LEFT JOIN batches b2 ON bb.source_batch_id = b2.id
     LEFT JOIN press_runs pr ON bb.source_press_run_id = pr.id
     WHERE bb.target_batch_id = $1 AND bb.deleted_at IS NULL
     ORDER BY bb.merged_at`,
    [p.id]
  );
  let parentMergesIn = 0;
  if (pmIn.rows.length === 0) {
    console.log("    (none)");
  }
  for (const m of pmIn.rows) {
    const vol = parseFloat(m.volume_added);
    parentMergesIn += vol;
    console.log(`    ${m.merged_at} | FROM "${m.source_name}" (${m.source_type}) | vol=${L(vol)} L (${G(vol)} gal)`);
  }

  // All transfers OUT from parent
  sub("ALL TRANSFERS OUT from parent");
  const ptOut = await c.query(
    `SELECT bt.volume_transferred, bt.loss, bt.transferred_at,
            bd.name as dest_name, bd.id as dest_id,
            vd.name as dest_vessel
     FROM batch_transfers bt
     JOIN batches bd ON bt.destination_batch_id = bd.id
     LEFT JOIN vessels vd ON bd.vessel_id = vd.id
     WHERE bt.source_batch_id = $1 AND bt.deleted_at IS NULL
     ORDER BY bt.transferred_at`,
    [p.id]
  );
  let parentTransfersOut = 0;
  let parentTransfersOutLoss = 0;
  if (ptOut.rows.length === 0) {
    console.log("    (none)");
  }
  for (const t of ptOut.rows) {
    const vol = parseFloat(t.volume_transferred);
    const loss = parseFloat(t.loss || "0");
    parentTransfersOut += vol;
    parentTransfersOutLoss += loss;
    console.log(`    ${t.transferred_at} | TO "${t.dest_name}" (${t.dest_vessel || "?"}) | vol=${L(vol)} L (${G(vol)} gal) | loss=${L(loss)} L`);
  }
  console.log(`    TOTAL TRANSFERS OUT: ${L(parentTransfersOut)} L (${G(parentTransfersOut)} gal), loss: ${L(parentTransfersOutLoss)} L`);

  // All merges OUT from parent
  sub("ALL MERGES OUT from parent");
  const pmOut = await c.query(
    `SELECT bb.volume_added, bb.merged_at, b2.name as target_name
     FROM batch_merge_history bb JOIN batches b2 ON bb.target_batch_id = b2.id
     WHERE bb.source_batch_id = $1 AND bb.deleted_at IS NULL
     ORDER BY bb.merged_at`,
    [p.id]
  );
  let parentMergesOut = 0;
  if (pmOut.rows.length === 0) {
    console.log("    (none)");
  }
  for (const m of pmOut.rows) {
    const vol = parseFloat(m.volume_added);
    parentMergesOut += vol;
    console.log(`    ${m.merged_at} | TO "${m.target_name}" | vol=${L(vol)} L (${G(vol)} gal)`);
  }

  // Racking operations on parent
  sub("RACKING on parent");
  const prack = await c.query(
    `SELECT volume_loss, racked_at, notes FROM batch_racking_operations
     WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY racked_at`,
    [p.id]
  );
  let parentRacking = 0;
  if (prack.rows.length === 0) {
    console.log("    (none)");
  }
  for (const r of prack.rows) {
    const loss = parseFloat(r.volume_loss);
    parentRacking += loss;
    console.log(`    ${r.racked_at} | loss=${L(loss)} L | notes="${r.notes || ""}"`);
  }

  // Adjustments on parent
  sub("ADJUSTMENTS on parent");
  const padj = await c.query(
    `SELECT adjustment_amount, adjustment_date, reason FROM batch_volume_adjustments
     WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY adjustment_date`,
    [p.id]
  );
  let parentAdj = 0;
  if (padj.rows.length === 0) {
    console.log("    (none)");
  }
  for (const a of padj.rows) {
    const amt = parseFloat(a.adjustment_amount);
    parentAdj += amt;
    console.log(`    ${a.adjustment_date} | amount=${L(amt)} L | reason="${a.reason}"`);
  }

  // Packaging on parent
  sub("PACKAGING on parent");
  const pbot = await c.query(
    `SELECT volume_taken_liters, loss, packaged_at, units_produced, package_size_ml, voided_at
     FROM bottle_runs WHERE batch_id = $1 ORDER BY packaged_at`,
    [p.id]
  );
  let parentBottling = 0;
  let parentBottlingLoss = 0;
  if (pbot.rows.length === 0) {
    console.log("    (none)");
  }
  for (const r of pbot.rows) {
    const taken = parseFloat(r.volume_taken_liters || "0");
    const loss = parseFloat(r.loss || "0");
    if (!r.voided_at) {
      parentBottling += taken;
      parentBottlingLoss += loss;
    }
    console.log(`    ${r.packaged_at} | ${r.package_size_ml}ml x${r.units_produced} | taken=${L(taken)} L | loss=${L(loss)} L ${r.voided_at ? "[VOIDED]" : ""}`);
  }

  // Kegging on parent
  const pkeg = await c.query(
    `SELECT volume_taken, loss, filled_at, voided_at FROM keg_fills
     WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY filled_at`,
    [p.id]
  );
  let parentKegging = 0;
  let parentKeggingLoss = 0;
  for (const r of pkeg.rows) {
    const taken = parseFloat(r.volume_taken);
    const loss = parseFloat(r.loss || "0");
    if (!r.voided_at) {
      parentKegging += taken;
      parentKeggingLoss += loss;
    }
  }

  // Distillation
  const pdist = await c.query(
    `SELECT source_volume_liters, status FROM distillation_records
     WHERE source_batch_id = $1 AND deleted_at IS NULL`,
    [p.id]
  );
  let parentDist = 0;
  for (const r of pdist.rows) {
    if (r.status === "sent" || r.status === "received") parentDist += parseFloat(r.source_volume_liters || "0");
  }

  // PARENT VOLUME RECONCILIATION
  sub("PARENT VOLUME RECONCILIATION");
  const parentReconstructed = pInit + parentTransfersIn - parentTransfersInLoss
    + parentMergesIn - parentMergesOut
    - parentTransfersOut - parentTransfersOutLoss
    - parentBottling - parentBottlingLoss
    - parentKegging - parentKeggingLoss
    - parentDist + parentAdj - parentRacking;

  console.log(`    Initial:             ${L(pInit)} L (${G(pInit)} gal)`);
  console.log(`    + Transfers In:      ${L(parentTransfersIn)} L`);
  console.log(`    - Transfers In Loss: ${L(parentTransfersInLoss)} L`);
  console.log(`    + Merges In:         ${L(parentMergesIn)} L`);
  console.log(`    - Merges Out:        ${L(parentMergesOut)} L`);
  console.log(`    - Transfers Out:     ${L(parentTransfersOut)} L`);
  console.log(`    - Transfers Out Loss:${L(parentTransfersOutLoss)} L`);
  console.log(`    - Bottling:          ${L(parentBottling)} L (loss: ${L(parentBottlingLoss)} L)`);
  console.log(`    - Kegging:           ${L(parentKegging)} L (loss: ${L(parentKeggingLoss)} L)`);
  console.log(`    - Distillation:      ${L(parentDist)} L`);
  console.log(`    + Adjustments:       ${L(parentAdj)} L`);
  console.log(`    - Racking Loss:      ${L(parentRacking)} L`);
  console.log(`    ────────────────────────────────`);
  console.log(`    = RECONSTRUCTED:     ${L(parentReconstructed)} L (${G(parentReconstructed)} gal)`);
  console.log(`    STORED (current):    ${L(pCur)} L (${G(pCur)} gal)`);
  const pDelta = parentReconstructed - pCur;
  console.log(`    DELTA:               ${L(pDelta)} L (${G(pDelta)} gal) ${Math.abs(pDelta) < 0.01 ? "✓ MATCHES" : "⚠ MISMATCH"}`);

  return {
    id: p.id,
    init: pInit,
    cur: pCur,
    transfersOut: parentTransfersOut,
    transfersOutLoss: parentTransfersOutLoss,
    transfersIn: parentTransfersIn,
    transfersInLoss: parentTransfersInLoss,
    mergesIn: parentMergesIn,
    mergesOut: parentMergesOut,
    bottling: parentBottling,
    bottlingLoss: parentBottlingLoss,
    kegging: parentKegging,
    keggingLoss: parentKeggingLoss,
    racking: parentRacking,
    adj: parentAdj,
    dist: parentDist,
    reconstructed: parentReconstructed,
    delta: pDelta,
  };
}

async function main() {
  await c.connect();

  // Audit batch 991bdbd1 (DRUM-120-10, Red Currant)
  const drum = await auditBatch("991bdbd1", "Red Currant DRUM-120-10");

  // Audit batch b1c4f5b6 (TANK-120-MIX, packaged)
  const tank = await auditBatch("b1c4f5b6", "Red Currant TANK-120-MIX (packaged)");

  // Audit parent batch 6a06ce10 (Summer Community Blend 1)
  const parent = await auditParentOutgoingTransfers("6a06ce10");

  // Inventory check for the packaged batch
  if (tank) {
    await auditInventory(tank.id);
  }

  // FINAL CHAIN-OF-CUSTODY RECONCILIATION
  sep("CHAIN-OF-CUSTODY RECONCILIATION: RED CURRANT FLOW");

  if (drum && tank && parent) {
    console.log(`\n  FLOW: Parent (Summer Community Blend 1, TANK-1000-2)`);
    console.log(`        → DRUM-120-10 (batch 991bdbd1)`);
    console.log(`        → TANK-120-MIX (batch b1c4f5b6, packaged)`);

    console.log(`\n  STEP 1: Parent → DRUM-120-10`);
    console.log(`    Transfer in to DRUM:     ${L(drum.transfersInTotal)} L`);
    console.log(`    Transfer loss on IN:     ${L(drum.transfersInLossTotal)} L`);
    console.log(`    DRUM initial volume:     ${L(drum.init)} L`);

    console.log(`\n  STEP 2: DRUM-120-10 processing`);
    console.log(`    Racking loss:            ${L(drum.rackingTotal)} L`);
    console.log(`    Adjustments:             ${L(drum.adjTotal)} L`);
    console.log(`    Merges in:               ${L(drum.mergesInTotal)} L`);
    console.log(`    Merges out:              ${L(drum.mergesOutTotal)} L`);
    console.log(`    DRUM current volume:     ${L(drum.cur)} L`);

    console.log(`\n  STEP 3: DRUM-120-10 → TANK-120-MIX`);
    console.log(`    Transfer out from DRUM:  ${L(drum.transfersOutTotal)} L`);
    console.log(`    Transfer out loss:       ${L(drum.transfersOutLossTotal)} L`);
    console.log(`    Transfer in to TANK:     ${L(tank.transfersInTotal)} L`);
    console.log(`    Transfer in loss:        ${L(tank.transfersInLossTotal)} L`);
    console.log(`    TANK initial volume:     ${L(tank.init)} L`);

    console.log(`\n  STEP 4: TANK-120-MIX packaging`);
    console.log(`    Racking loss:            ${L(tank.rackingTotal)} L`);
    console.log(`    Bottling taken:          ${L(tank.bottlingTotalTaken)} L`);
    console.log(`    Bottling loss:           ${L(tank.bottlingTotalLoss)} L`);
    console.log(`    Kegging taken:           ${L(tank.keggingTotal)} L`);
    console.log(`    TANK current volume:     ${L(tank.cur)} L`);
    console.log(`    TANK status:             ${tank.status}`);

    // Check if DRUM fully transferred
    const drumAccountedFor = drum.transfersOutTotal + drum.transfersOutLossTotal + drum.rackingTotal + drum.cur - drum.adjTotal;
    const drumExpected = drum.transfersInTotal - drum.transfersInLossTotal;
    console.log(`\n  DRUM BALANCE CHECK:`);
    console.log(`    Volume received (net):   ${L(drumExpected)} L`);
    console.log(`    Volume accounted for:    ${L(drumAccountedFor)} L (transferred out + losses + remaining)`);
    console.log(`    Gap:                     ${L(drumExpected - drumAccountedFor)} L ${Math.abs(drumExpected - drumAccountedFor) < 0.01 ? "✓" : "⚠"}`);

    // Check TANK balance
    const tankAccountedFor = tank.bottlingTotalTaken + tank.bottlingTotalLoss + tank.keggingTotal + tank.keggingLoss + tank.rackingTotal + tank.cur - tank.adjTotal;
    const tankExpected = tank.transfersInTotal - tank.transfersInLossTotal;
    console.log(`\n  TANK BALANCE CHECK:`);
    console.log(`    Volume received (net):   ${L(tankExpected)} L`);
    console.log(`    Volume accounted for:    ${L(tankAccountedFor)} L (packaged + losses + remaining)`);
    console.log(`    Gap:                     ${L(tankExpected - tankAccountedFor)} L ${Math.abs(tankExpected - tankAccountedFor) < 0.01 ? "✓" : "⚠"}`);

    // Packaging detail
    if (tank.bottleRuns.length > 0) {
      console.log(`\n  PACKAGING DETAIL:`);
      for (const r of tank.bottleRuns) {
        if (!r.voided_at) {
          const taken = parseFloat(r.volume_taken_liters || r.volume_taken || "0");
          const loss = parseFloat(r.loss || "0");
          const netML = parseFloat(r.package_size_ml) * parseInt(r.units_produced);
          console.log(`    ${r.units_produced} x ${r.package_size_ml}ml = ${(netML / 1000).toFixed(3)} L packaged product`);
          console.log(`    Volume taken: ${L(taken)} L, Loss: ${L(loss)} L, Net product: ${L(taken - loss)} L`);
          console.log(`    Packaging efficiency: ${((netML / 1000) / taken * 100).toFixed(1)}%`);
        }
      }
    }

    // Parent reconciliation
    console.log(`\n  PARENT (Summer Community Blend 1) RECONCILIATION:`);
    console.log(`    Initial:              ${L(parent.init)} L`);
    console.log(`    Sum transfers out:    ${L(parent.transfersOut)} L`);
    console.log(`    Sum transfer losses:  ${L(parent.transfersOutLoss)} L`);
    console.log(`    Merges in:            ${L(parent.mergesIn)} L`);
    console.log(`    Merges out:           ${L(parent.mergesOut)} L`);
    console.log(`    Bottling:             ${L(parent.bottling)} L`);
    console.log(`    Kegging:              ${L(parent.kegging)} L`);
    console.log(`    Racking:              ${L(parent.racking)} L`);
    console.log(`    Adjustments:          ${L(parent.adj)} L`);
    console.log(`    Distillation:         ${L(parent.dist)} L`);
    console.log(`    Remaining:            ${L(parent.cur)} L`);
    console.log(`    Reconstructed:        ${L(parent.reconstructed)} L`);
    console.log(`    Delta:                ${L(parent.delta)} L ${Math.abs(parent.delta) < 0.01 ? "✓ BALANCED" : "⚠ IMBALANCED"}`);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("  AUDIT COMPLETE");
  console.log("=".repeat(80));

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
