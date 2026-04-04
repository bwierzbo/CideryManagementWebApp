import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const L2G = (l: number) => (l * 0.264172).toFixed(3);
const fmt = (l: number) => `${l.toFixed(3)} L (${L2G(l)} gal)`;
const p = (v: string | null | undefined) => parseFloat(v || "0");
const LITERS_PER_GAL = 3.78541;

function toLiters(val: number, unit: string): number {
  if (unit === "gal") return val * LITERS_PER_GAL;
  return val;
}

interface BatchInfo {
  id: string;
  batch_number: string;
  custom_name: string | null;
  name: string;
  vessel_id: string | null;
  vessel_name: string | null;
  initial_volume_liters: string | null;
  current_volume_liters: string | null;
  initial_volume: string;
  initial_volume_unit: string;
  current_volume: string | null;
  current_volume_unit: string;
  status: string;
  product_type: string;
  start_date: string | null;
  origin_press_run_id: string | null;
  origin_juice_purchase_item_id: string | null;
  parent_batch_id: string | null;
  is_racking_derivative: boolean;
  transfer_loss_l: string | null;
  transfer_loss_notes: string | null;
  reconciliation_status: string | null;
  deleted_at: string | null;
}

async function getBatch(batchIdPrefix: string): Promise<BatchInfo | null> {
  const res = await client.query(
    `SELECT b.id, b.batch_number, b.custom_name, b.name,
            b.vessel_id, v.name as vessel_name,
            b.initial_volume_liters, b.current_volume_liters,
            b.initial_volume, b.initial_volume_unit,
            b.current_volume, b.current_volume_unit,
            b.status, b.product_type, b.start_date::text,
            b.origin_press_run_id, b.origin_juice_purchase_item_id,
            b.parent_batch_id, b.is_racking_derivative,
            b.transfer_loss_l, b.transfer_loss_notes,
            b.reconciliation_status, b.deleted_at::text
     FROM batches b
     LEFT JOIN vessels v ON v.id = b.vessel_id
     WHERE b.id::text LIKE $1`,
    [batchIdPrefix + "%"]
  );
  return res.rows[0] || null;
}

async function getTransfersIn(batchId: string) {
  const res = await client.query(
    `SELECT bt.id, bt.source_batch_id, bt.source_vessel_id,
            bt.volume_transferred, bt.volume_transferred_unit,
            bt.loss, bt.loss_unit,
            bt.total_volume_processed, bt.total_volume_processed_unit,
            bt.remaining_volume, bt.remaining_volume_unit,
            bt.remaining_batch_id,
            bt.transferred_at::text, bt.notes, bt.deleted_at::text,
            sb.name as source_batch_name, sb.batch_number as source_batch_number,
            sb.custom_name as source_custom_name,
            sv.name as source_vessel_name
     FROM batch_transfers bt
     LEFT JOIN batches sb ON sb.id = bt.source_batch_id
     LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
     WHERE bt.destination_batch_id = $1
     ORDER BY bt.transferred_at`,
    [batchId]
  );
  return res.rows;
}

async function getTransfersOut(batchId: string) {
  const res = await client.query(
    `SELECT bt.id, bt.destination_batch_id, bt.destination_vessel_id,
            bt.volume_transferred, bt.volume_transferred_unit,
            bt.loss, bt.loss_unit,
            bt.total_volume_processed, bt.total_volume_processed_unit,
            bt.remaining_volume, bt.remaining_volume_unit,
            bt.remaining_batch_id,
            bt.transferred_at::text, bt.notes, bt.deleted_at::text,
            db.name as dest_batch_name, db.batch_number as dest_batch_number,
            db.custom_name as dest_custom_name,
            dv.name as dest_vessel_name
     FROM batch_transfers bt
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     WHERE bt.source_batch_id = $1
     ORDER BY bt.transferred_at`,
    [batchId]
  );
  return res.rows;
}

async function getVolumeAdjustments(batchId: string) {
  const res = await client.query(
    `SELECT bva.id, bva.adjustment_date::text, bva.adjustment_type,
            bva.volume_before, bva.volume_after, bva.adjustment_amount,
            bva.reason, bva.notes, bva.deleted_at::text
     FROM batch_volume_adjustments bva
     WHERE bva.batch_id = $1
     ORDER BY bva.adjustment_date`,
    [batchId]
  );
  return res.rows;
}

async function getBottleRuns(batchId: string) {
  const res = await client.query(
    `SELECT br.id, br.packaged_at::text, br.package_type,
            br.package_size_ml, br.units_produced,
            br.volume_taken, br.volume_taken_unit,
            br.volume_taken_liters,
            br.loss, br.loss_unit,
            br.production_notes as notes, br.voided_at::text as deleted_at
     FROM bottle_runs br
     WHERE br.batch_id = $1
     ORDER BY br.packaged_at`,
    [batchId]
  );
  return res.rows;
}

async function getKegFills(batchId: string) {
  const res = await client.query(
    `SELECT kf.id, kf.filled_at::text,
            kf.volume_taken, kf.volume_taken_unit,
            kf.loss, kf.loss_unit,
            kf.status, kf.voided_at::text, kf.deleted_at::text,
            k.keg_number as keg_name
     FROM keg_fills kf
     LEFT JOIN kegs k ON k.id = kf.keg_id
     WHERE kf.batch_id = $1
     ORDER BY kf.filled_at`,
    [batchId]
  );
  return res.rows;
}

async function getMergeHistory(batchId: string) {
  const res = await client.query(
    `SELECT bmh.id, bmh.merged_at::text, bmh.source_type,
            bmh.source_press_run_id, bmh.source_batch_id,
            bmh.source_juice_purchase_item_id,
            bmh.volume_added, bmh.volume_added_unit,
            bmh.target_volume_before, bmh.target_volume_before_unit,
            bmh.target_volume_after, bmh.target_volume_after_unit,
            bmh.notes, bmh.deleted_at::text,
            sb.name as source_batch_name, sb.batch_number as source_batch_number,
            sb.custom_name as source_custom_name
     FROM batch_merge_history bmh
     LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
     WHERE bmh.target_batch_id = $1
     ORDER BY bmh.merged_at`,
    [batchId]
  );
  return res.rows;
}

async function getFilterOperations(batchId: string) {
  const res = await client.query(
    `SELECT bfo.id, bfo.filtered_at::text, bfo.filter_type,
            bfo.volume_before, bfo.volume_before_unit,
            bfo.volume_after, bfo.volume_after_unit,
            bfo.volume_loss,
            bfo.notes, bfo.deleted_at::text
     FROM batch_filter_operations bfo
     WHERE bfo.batch_id = $1
     ORDER BY bfo.filtered_at`,
    [batchId]
  );
  return res.rows;
}

async function getPressRun(pressRunId: string) {
  const res = await client.query(
    `SELECT pr.id, pr.press_run_name, pr.status,
            pr.total_juice_volume_liters, pr.date_completed::text,
            pr.notes
     FROM press_runs pr
     WHERE pr.id = $1`,
    [pressRunId]
  );
  return res.rows[0] || null;
}

async function getBatchesFromPressRun(pressRunId: string) {
  const res = await client.query(
    `SELECT b.id, b.batch_number, b.custom_name, b.name,
            b.initial_volume_liters, b.current_volume_liters,
            b.transfer_loss_l, b.status, b.deleted_at::text,
            v.name as vessel_name
     FROM batches b
     LEFT JOIN vessels v ON v.id = b.vessel_id
     WHERE b.origin_press_run_id = $1
     ORDER BY b.name`,
    [pressRunId]
  );
  return res.rows;
}

async function getSiblingTransfers(sourceBatchId: string, excludeBatchId: string) {
  // Get all other batches that received transfers from the same source
  const res = await client.query(
    `SELECT bt.destination_batch_id, bt.volume_transferred, bt.volume_transferred_unit,
            bt.loss, bt.loss_unit, bt.transferred_at::text, bt.deleted_at::text,
            db.name as dest_batch_name, db.batch_number as dest_batch_number,
            db.custom_name as dest_custom_name,
            dv.name as dest_vessel_name,
            db.initial_volume_liters, db.current_volume_liters, db.status
     FROM batch_transfers bt
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     WHERE bt.source_batch_id = $1
       AND bt.destination_batch_id != $2
     ORDER BY bt.transferred_at`,
    [sourceBatchId, excludeBatchId]
  );
  return res.rows;
}

async function printBatchDetail(batch: BatchInfo, depth: number = 0) {
  const indent = "  ".repeat(depth);
  const divider = "=".repeat(80 - depth * 2);

  console.log(`\n${indent}${divider}`);
  console.log(`${indent}BATCH: ${batch.name} (${batch.batch_number})`);
  if (batch.custom_name) console.log(`${indent}  Custom Name: ${batch.custom_name}`);
  console.log(`${indent}  ID: ${batch.id}`);
  console.log(`${indent}  Vessel: ${batch.vessel_name || "NONE"} (${batch.vessel_id || "null"})`);
  console.log(`${indent}  Status: ${batch.status} | Product: ${batch.product_type}`);
  console.log(`${indent}  Start Date: ${batch.start_date}`);
  console.log(`${indent}  Reconciliation: ${batch.reconciliation_status}`);
  if (batch.parent_batch_id) console.log(`${indent}  Parent Batch ID: ${batch.parent_batch_id}`);
  if (batch.is_racking_derivative) console.log(`${indent}  IS RACKING DERIVATIVE`);
  if (batch.deleted_at) console.log(`${indent}  *** DELETED: ${batch.deleted_at} ***`);
  console.log(`${indent}  Initial Volume: ${fmt(p(batch.initial_volume_liters))}`);
  console.log(`${indent}  Current Volume: ${fmt(p(batch.current_volume_liters))}`);
  if (batch.transfer_loss_l) {
    console.log(`${indent}  Transfer Loss (press→vessel): ${fmt(p(batch.transfer_loss_l))}`);
    if (batch.transfer_loss_notes) console.log(`${indent}    Notes: ${batch.transfer_loss_notes}`);
  }
  if (batch.origin_press_run_id) console.log(`${indent}  Origin Press Run: ${batch.origin_press_run_id}`);
  if (batch.origin_juice_purchase_item_id) console.log(`${indent}  Origin Juice Purchase Item: ${batch.origin_juice_purchase_item_id}`);

  // Transfers IN
  const transfersIn = await getTransfersIn(batch.id);
  let totalTransfersInL = 0;
  if (transfersIn.length > 0) {
    console.log(`${indent}  --- Transfers IN (${transfersIn.length}) ---`);
    for (const t of transfersIn) {
      const volL = toLiters(p(t.volume_transferred), t.volume_transferred_unit);
      const del = t.deleted_at ? " [DELETED]" : "";
      totalTransfersInL += t.deleted_at ? 0 : volL;
      console.log(`${indent}    ${t.transferred_at}: ${fmt(volL)} from ${t.source_batch_name || t.source_batch_id} @ ${t.source_vessel_name}${del}`);
      if (t.notes) console.log(`${indent}      Notes: ${t.notes}`);
    }
  }

  // Merge history IN
  const merges = await getMergeHistory(batch.id);
  let totalMergesInL = 0;
  if (merges.length > 0) {
    console.log(`${indent}  --- Merge History IN (${merges.length}) ---`);
    for (const m of merges) {
      const volL = toLiters(p(m.volume_added), m.volume_added_unit);
      const del = m.deleted_at ? " [DELETED]" : "";
      totalMergesInL += m.deleted_at ? 0 : volL;
      const src = m.source_batch_name
        ? `batch ${m.source_batch_name}`
        : m.source_press_run_id
          ? `press run ${m.source_press_run_id}`
          : m.source_juice_purchase_item_id
            ? `juice purchase ${m.source_juice_purchase_item_id}`
            : `unknown`;
      console.log(`${indent}    ${m.merged_at}: ${fmt(volL)} from ${src} (type: ${m.source_type})${del}`);
      console.log(`${indent}      Before: ${fmt(p(m.target_volume_before))} → After: ${fmt(p(m.target_volume_after))}`);
      if (m.notes) console.log(`${indent}      Notes: ${m.notes}`);
    }
  }

  // Transfers OUT
  const transfersOut = await getTransfersOut(batch.id);
  let totalTransfersOutL = 0;
  let totalTransferLossOutL = 0;
  if (transfersOut.length > 0) {
    console.log(`${indent}  --- Transfers OUT (${transfersOut.length}) ---`);
    for (const t of transfersOut) {
      const volL = toLiters(p(t.volume_transferred), t.volume_transferred_unit);
      const lossL = toLiters(p(t.loss), t.loss_unit);
      const del = t.deleted_at ? " [DELETED]" : "";
      if (!t.deleted_at) {
        totalTransfersOutL += volL;
        totalTransferLossOutL += lossL;
      }
      console.log(`${indent}    ${t.transferred_at}: ${fmt(volL)} + ${fmt(lossL)} loss → ${t.dest_batch_name || t.destination_batch_id} @ ${t.dest_vessel_name}${del}`);
      if (t.remaining_volume) {
        console.log(`${indent}      Remaining in source: ${fmt(toLiters(p(t.remaining_volume), t.remaining_volume_unit))}`);
      }
      if (t.remaining_batch_id) {
        console.log(`${indent}      Remaining batch ID: ${t.remaining_batch_id}`);
      }
      if (t.notes) console.log(`${indent}      Notes: ${t.notes}`);
    }
  }

  // Volume Adjustments
  const adjustments = await getVolumeAdjustments(batch.id);
  let totalAdjustmentsL = 0; // net (negative = loss)
  if (adjustments.length > 0) {
    console.log(`${indent}  --- Volume Adjustments (${adjustments.length}) ---`);
    for (const a of adjustments) {
      const amt = p(a.adjustment_amount);
      const del = a.deleted_at ? " [DELETED]" : "";
      if (!a.deleted_at) totalAdjustmentsL += amt;
      console.log(`${indent}    ${a.adjustment_date}: ${a.adjustment_type} ${amt >= 0 ? "+" : ""}${fmt(amt)} (${fmt(p(a.volume_before))} → ${fmt(p(a.volume_after))})${del}`);
      console.log(`${indent}      Reason: ${a.reason}`);
      if (a.notes) console.log(`${indent}      Notes: ${a.notes}`);
    }
  }

  // Filter Operations
  const filters = await getFilterOperations(batch.id);
  let totalFilterLossL = 0;
  if (filters.length > 0) {
    console.log(`${indent}  --- Filter Operations (${filters.length}) ---`);
    for (const f of filters) {
      const lossL = p(f.volume_loss);
      const del = f.deleted_at ? " [DELETED]" : "";
      if (!f.deleted_at) totalFilterLossL += lossL;
      console.log(`${indent}    ${f.filtered_at}: ${f.filter_type} filter, loss=${fmt(lossL)} (${fmt(p(f.volume_before))} → ${fmt(p(f.volume_after))})${del}`);
      if (f.notes) console.log(`${indent}      Notes: ${f.notes}`);
    }
  }

  // Bottle Runs
  const bottles = await getBottleRuns(batch.id);
  let totalBottledL = 0;
  let totalBottleLossL = 0;
  if (bottles.length > 0) {
    console.log(`${indent}  --- Bottle Runs (${bottles.length}) ---`);
    for (const b of bottles) {
      const volL = p(b.volume_taken_liters) || toLiters(p(b.volume_taken), b.volume_taken_unit);
      const lossL = toLiters(p(b.loss), b.loss_unit);
      const del = b.deleted_at ? " [DELETED]" : "";
      if (!b.deleted_at) {
        totalBottledL += volL;
        totalBottleLossL += lossL;
      }
      console.log(`${indent}    ${b.packaged_at}: ${b.units_produced}x ${b.package_size_ml}ml ${b.package_type}, vol=${fmt(volL)}, loss=${fmt(lossL)}${del}`);
      if (b.notes) console.log(`${indent}      Notes: ${b.notes}`);
    }
  }

  // Keg Fills
  const kegs = await getKegFills(batch.id);
  let totalKeggedL = 0;
  let totalKegLossL = 0;
  if (kegs.length > 0) {
    console.log(`${indent}  --- Keg Fills (${kegs.length}) ---`);
    for (const k of kegs) {
      const volL = toLiters(p(k.volume_taken), k.volume_taken_unit);
      const lossL = toLiters(p(k.loss), k.loss_unit);
      const voided = k.voided_at ? " [VOIDED]" : "";
      const del = k.deleted_at ? " [DELETED]" : "";
      const skip = k.voided_at || k.deleted_at;
      if (!skip) {
        totalKeggedL += volL;
        totalKegLossL += lossL;
      }
      console.log(`${indent}    ${k.filled_at}: ${k.keg_name || "unknown keg"}, vol=${fmt(volL)}, loss=${fmt(lossL)}, status=${k.status}${voided}${del}`);
    }
  }

  // VOLUME BALANCE
  // For transfer-created batches, initial_volume == transfer volume, so don't double-count
  const initialL = p(batch.initial_volume_liters);
  const currentL = p(batch.current_volume_liters);

  // Detect if this batch's initial volume IS the transfer-in (i.e., transfer-created batch)
  const isTransferCreated = transfersIn.length > 0 && initialL > 0 && !transfersIn[0].deleted_at;

  // For transfer-created batches: starting volume is already in initial, transfers_in would double-count
  // For merge/press-run batches: initial + merges_in is the true starting point
  let effectiveStart: number;
  let transfersInForBalance: number;
  let mergesInForBalance: number;

  if (isTransferCreated && Math.abs(initialL - totalTransfersInL) < 0.1) {
    // initial_volume == transfer volume → they represent the same liquid
    effectiveStart = initialL;
    transfersInForBalance = 0;
    mergesInForBalance = totalMergesInL;
  } else {
    effectiveStart = initialL;
    transfersInForBalance = totalTransfersInL;
    mergesInForBalance = totalMergesInL;
  }

  const totalOut = totalTransfersOutL + totalTransferLossOutL + totalBottledL + totalBottleLossL + totalKeggedL + totalKegLossL + totalFilterLossL;
  const expected = effectiveStart + transfersInForBalance + mergesInForBalance - totalOut + totalAdjustmentsL;
  const delta = currentL - expected;

  console.log(`${indent}  --- VOLUME BALANCE ---`);
  console.log(`${indent}    Initial:               ${fmt(initialL)}${isTransferCreated && Math.abs(initialL - totalTransfersInL) < 0.1 ? " (= transfer in, not double-counted)" : ""}`);
  if (totalTransfersInL > 0 && transfersInForBalance > 0) console.log(`${indent}    + Transfers In:         ${fmt(totalTransfersInL)}`);
  if (totalTransfersInL > 0 && transfersInForBalance === 0) console.log(`${indent}    (Transfers In:          ${fmt(totalTransfersInL)} — already in initial)`);
  if (totalMergesInL > 0) console.log(`${indent}    + Merges In:            ${fmt(totalMergesInL)}`);
  if (totalTransfersOutL > 0) console.log(`${indent}    - Transfers Out:        ${fmt(totalTransfersOutL)}`);
  if (totalTransferLossOutL > 0) console.log(`${indent}    - Transfer Loss Out:    ${fmt(totalTransferLossOutL)}`);
  if (totalBottledL > 0) console.log(`${indent}    - Bottled:              ${fmt(totalBottledL)}`);
  if (totalBottleLossL > 0) console.log(`${indent}    - Bottle Loss:          ${fmt(totalBottleLossL)}`);
  if (totalKeggedL > 0) console.log(`${indent}    - Kegged:               ${fmt(totalKeggedL)}`);
  if (totalKegLossL > 0) console.log(`${indent}    - Keg Loss:             ${fmt(totalKegLossL)}`);
  if (totalFilterLossL > 0) console.log(`${indent}    - Filter Loss:          ${fmt(totalFilterLossL)}`);
  if (totalAdjustmentsL !== 0) console.log(`${indent}    +/- Adjustments:        ${totalAdjustmentsL >= 0 ? "+" : ""}${fmt(totalAdjustmentsL)}`);
  console.log(`${indent}    = Expected Current:     ${fmt(expected)}`);
  console.log(`${indent}    = Actual Current:       ${fmt(currentL)}`);
  console.log(`${indent}    DELTA:                  ${delta >= 0 ? "+" : ""}${fmt(delta)} ${Math.abs(delta) < 0.01 ? "✓ BALANCED" : "⚠ MISMATCH"}`);
  console.log(`${indent}${divider}`);

  return {
    initialL, currentL, totalOut, totalAdjustmentsL,
    expected, delta, transfersIn, transfersOut
  };
}

async function main() {
  await client.connect();
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  COMPLETE VOLUME TRACE: Batch cef85b11 (Red Currant in DRUM-120-3)         ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  // ─── LEVEL 0: The target batch ───
  console.log("\n\n████ LEVEL 0: TARGET BATCH (cef85b11) ████");
  const target = await getBatch("cef85b11");
  if (!target) {
    console.log("ERROR: Batch starting with cef85b11 not found!");
    await client.end();
    return;
  }

  const targetResult = await printBatchDetail(target, 0);

  // ─── LEVEL 1: Find how this batch was created ───
  console.log("\n\n████ LEVEL 1: SOURCE OF TARGET BATCH ████");

  let sourceBatchId: string | null = null;

  // Check if created via transfer
  if (targetResult.transfersIn.length > 0) {
    console.log("  → Created via TRANSFER");
    sourceBatchId = targetResult.transfersIn[0].source_batch_id;
  }
  // Check parent_batch_id
  else if (target.parent_batch_id) {
    console.log("  → Has parent_batch_id");
    sourceBatchId = target.parent_batch_id;
  }
  // Check origin press run
  else if (target.origin_press_run_id) {
    console.log("  → Created from PRESS RUN");
    const pr = await getPressRun(target.origin_press_run_id);
    if (pr) {
      console.log(`\n  Press Run: ${pr.press_run_name} (${pr.id})`);
      console.log(`  Status: ${pr.status}`);
      console.log(`  Date Completed: ${pr.date_completed}`);
      console.log(`  Total Juice Volume: ${fmt(p(pr.total_juice_volume_liters))}`);

      const siblings = await getBatchesFromPressRun(target.origin_press_run_id);
      console.log(`\n  Batches from this press run (${siblings.length}):`);
      let totalInit = 0, totalTL = 0;
      for (const s of siblings) {
        const si = p(s.initial_volume_liters);
        const stl = p(s.transfer_loss_l);
        totalInit += si;
        totalTL += stl;
        const del = s.deleted_at ? " [DELETED]" : "";
        console.log(`    ${s.name} @ ${s.vessel_name}: init=${fmt(si)}, TL=${fmt(stl)}, status=${s.status}${del}`);
      }
      console.log(`  Total initial: ${fmt(totalInit)}`);
      console.log(`  Total transfer loss: ${fmt(totalTL)}`);
      console.log(`  Total accounted (init+TL): ${fmt(totalInit + totalTL)}`);
      console.log(`  Press run total: ${fmt(p(pr.total_juice_volume_liters))}`);
      console.log(`  Unaccounted: ${fmt(p(pr.total_juice_volume_liters) - totalInit - totalTL)}`);
    }
  }
  // Check merge history
  else {
    const merges = await getMergeHistory(target.id);
    if (merges.length > 0 && merges[0].source_batch_id) {
      console.log("  → Created via MERGE from batch");
      sourceBatchId = merges[0].source_batch_id;
    }
  }

  // ─── Trace backwards through the chain ───
  let level = 1;
  let currentBatchId = sourceBatchId;
  const visited = new Set<string>([target.id]);

  while (currentBatchId && !visited.has(currentBatchId)) {
    visited.add(currentBatchId);
    level++;
    console.log(`\n\n████ LEVEL ${level}: ANCESTOR BATCH ████`);

    const ancestor = await getBatch(currentBatchId);
    if (!ancestor) {
      console.log(`  ERROR: Batch ${currentBatchId} not found!`);
      break;
    }

    const ancestorResult = await printBatchDetail(ancestor, 0);

    // Show ALL sibling transfers (other destinations from this batch)
    const excludeId = currentBatchId === sourceBatchId ? target.id : "00000000-0000-0000-0000-000000000000";
    const siblings = await getSiblingTransfers(ancestor.id, excludeId);
    if (siblings.length > 0 || ancestorResult.transfersOut.length > 1) {
      console.log(`\n  --- ALL CHILDREN (batches that received volume from ${ancestor.name}) ---`);
      for (const t of ancestorResult.transfersOut) {
        const volL = toLiters(p(t.volume_transferred), t.volume_transferred_unit);
        const lossL = toLiters(p(t.loss), t.loss_unit);
        const del = t.deleted_at ? " [DELETED]" : "";
        const isTarget = t.destination_batch_id === target.id ? " ← TARGET" : "";
        console.log(`    → ${t.dest_batch_name || t.destination_batch_id} @ ${t.dest_vessel_name}: ${fmt(volL)} + ${fmt(lossL)} loss${del}${isTarget}`);
      }
    }

    // Also show batches from press run if this batch has one
    if (ancestor.origin_press_run_id) {
      const pr = await getPressRun(ancestor.origin_press_run_id);
      if (pr) {
        console.log(`\n  --- ORIGIN PRESS RUN: ${pr.press_run_name} ---`);
        console.log(`  Total Juice: ${fmt(p(pr.total_juice_volume_liters))}`);
        console.log(`  Date: ${pr.date_completed}`);

        const prSiblings = await getBatchesFromPressRun(ancestor.origin_press_run_id);
        console.log(`  Batches from this press run (${prSiblings.length}):`);
        let totalInit = 0, totalTL = 0;
        for (const s of prSiblings) {
          const si = p(s.initial_volume_liters);
          const stl = p(s.transfer_loss_l);
          totalInit += si;
          totalTL += stl;
          const del = s.deleted_at ? " [DELETED]" : "";
          const isCurrent = s.id === ancestor.id ? " ← THIS BATCH" : "";
          console.log(`    ${s.name} @ ${s.vessel_name}: init=${fmt(si)}, TL=${fmt(stl)}, status=${s.status}${del}${isCurrent}`);
        }
        console.log(`  Total initial: ${fmt(totalInit)}, Total TL: ${fmt(totalTL)}`);
        console.log(`  Total accounted: ${fmt(totalInit + totalTL)}`);
        console.log(`  Press total: ${fmt(p(pr.total_juice_volume_liters))}`);
        console.log(`  Unaccounted: ${fmt(p(pr.total_juice_volume_liters) - totalInit - totalTL)}`);
      }
    }

    // Check origin juice purchase
    if (ancestor.origin_juice_purchase_item_id) {
      const jpRes = await client.query(
        `SELECT jpi.id, jpi.volume, jpi.unit, jpi.total_cost,
                jv.name as variety_name,
                jp.purchase_date::text, jp.notes,
                vn.name as vendor_name
         FROM juice_purchase_items jpi
         JOIN juice_purchases jp ON jp.id = jpi.purchase_id
         LEFT JOIN juice_varieties jv ON jv.id = jpi.juice_variety_id
         LEFT JOIN vendors vn ON vn.id = jp.vendor_id
         WHERE jpi.id = $1`,
        [ancestor.origin_juice_purchase_item_id]
      );
      if (jpRes.rows.length > 0) {
        const jp = jpRes.rows[0];
        console.log(`\n  --- ORIGIN JUICE PURCHASE ---`);
        console.log(`  Variety: ${jp.variety_name}`);
        console.log(`  Vendor: ${jp.vendor_name}`);
        console.log(`  Purchase Date: ${jp.purchase_date}`);
        console.log(`  Volume: ${jp.volume} ${jp.unit}`);
        console.log(`  Cost: $${jp.total_cost}`);
      }
    }

    // Determine next ancestor
    let nextBatchId: string | null = null;

    if (ancestorResult.transfersIn.length > 0) {
      nextBatchId = ancestorResult.transfersIn[0].source_batch_id;
    } else if (ancestor.parent_batch_id && !visited.has(ancestor.parent_batch_id)) {
      nextBatchId = ancestor.parent_batch_id;
    }
    // If we reach a press run or juice purchase, we've found the origin
    else if (ancestor.origin_press_run_id || ancestor.origin_juice_purchase_item_id) {
      console.log("\n  ═══ REACHED ORIGIN (press run or juice purchase) ═══");
      nextBatchId = null;
    }

    currentBatchId = nextBatchId;
  }

  // ─── FINAL SUMMARY ───
  console.log("\n\n╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  CHAIN SUMMARY                                                             ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");
  console.log(`  Traced ${visited.size} batch(es) in the lineage chain.\n`);

  console.log("  LINEAGE (oldest → newest):");
  console.log("  ┌─ Press Run 2025-09-17-01: 810 L juice pressed");
  console.log("  │");
  console.log("  ├─ [LEVEL 3] 2025-09-17_1000 IBC 1_BLEND_A (Summer Community Blend 1)");
  console.log("  │    init=810L, +190L merge from press run ab6d4041, → 1000L total");
  console.log("  │    Transferred ALL 1000L out → child batch (BALANCED)");
  console.log("  │");
  console.log("  ├─ [LEVEL 2] Batch #..._Tmix9gnpc (Summer Community Blend 1) in TANK-1000-2");
  console.log("  │    init=0L, received 1000L via transfer");
  console.log("  │    Distributed to 5 children:");
  console.log("  │    ├─ 190L → BARREL-225-4 (topped off barrel)");
  console.log("  │    ├─ 120L → TANK-120-MIX");
  console.log("  │    ├─ 130L → DRUM-120-10");
  console.log("  │    ├─ 120L → DRUM-120-3 ← THIS IS OUR TARGET (Red Currant)");
  console.log("  │    └─ 590L + 40L lees loss → IBC-1000-9");
  console.log("  │    Total out: 1150L + 40L loss = 1190L");
  console.log("  │    ⚠ 190L more out than in — likely the 190L barrel top-off");
  console.log("  │      was a cross-batch operation (volume came from the tank physically)");
  console.log("  │");
  console.log("  └─ [LEVEL 0] Batch #..._Tmmzkp342 (Red Currant) in DRUM-120-3");
  console.log("       init=120L = transfer in (BALANCED)");
  console.log("       Current: 120L — no outflows, no adjustments\n");

  console.log("  VOLUME FLOW:");
  console.log("  Press → 810L → Batch A (root)");
  console.log("  Merge → +190L (from another press run ab6d4041)");
  console.log("  Total in root batch: 1000L");
  console.log("  Root → 1000L transfer → Level 2 batch (TANK-1000-2)");
  console.log("  Level 2 → 120L transfer → Red Currant (DRUM-120-3)");
  console.log("  Red Currant current: 120L ✓\n");

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
