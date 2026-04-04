import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const L2G = (l: number) => (l / 3.78541).toFixed(2);
const fmt = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "N/A";
const sep = (title: string) => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(80));
};
const sub = (title: string) => {
  console.log(`\n  --- ${title} ---`);
};

async function main() {
  await c.connect();
  console.log("Connected to database.\n");

  // ============================================================
  // 1. VESSEL: DRUM-120-4
  // ============================================================
  sep("1. VESSEL: DRUM-120-4 - All Fields");

  const vesselRes = await c.query(
    `SELECT * FROM vessels WHERE name = 'DRUM-120-4'`
  );
  if (vesselRes.rows.length === 0) {
    console.log("  VESSEL NOT FOUND!");
    await c.end();
    return;
  }
  const vessel = vesselRes.rows[0];
  console.log(`  ID:                ${vessel.id}`);
  console.log(`  Name:              ${vessel.name}`);
  console.log(`  Capacity:          ${vessel.capacity} ${vessel.capacity_unit} (${L2G(Number(vessel.capacity_liters || vessel.capacity))} gal)`);
  console.log(`  Max Capacity:      ${vessel.max_capacity || "N/A"}`);
  console.log(`  Material:          ${vessel.material}`);
  console.log(`  Status:            ${vessel.status}`);
  console.log(`  Jacketed:          ${vessel.jacketed}`);
  console.log(`  Pressure Vessel:   ${vessel.is_pressure_vessel}`);
  console.log(`  Location:          ${vessel.location || "N/A"}`);
  console.log(`  Notes:             ${vessel.notes || "N/A"}`);
  console.log(`  Created:           ${fmt(vessel.created_at)}`);
  console.log(`  Deleted:           ${fmt(vessel.deleted_at)}`);

  const vesselId = vessel.id;

  // ============================================================
  // 2. ALL BATCHES EVER IN THIS VESSEL
  // ============================================================
  sep("2. ALL BATCHES ASSOCIATED WITH DRUM-120-4");

  const batchesRes = await c.query(
    `SELECT DISTINCT b.id, b.name, b.batch_number, b.custom_name, b.status,
            b.initial_volume, b.initial_volume_unit, b.initial_volume_liters,
            b.current_volume, b.current_volume_unit, b.current_volume_liters,
            b.vessel_id, b.product_type, b.original_gravity, b.final_gravity,
            b.estimated_abv, b.actual_abv, b.start_date, b.end_date,
            b.parent_batch_id, b.is_racking_derivative, b.is_archived,
            b.reconciliation_status, b.ttb_origin_year,
            b.created_at, b.deleted_at,
            CASE WHEN b.vessel_id = $1 THEN 'CURRENT' ELSE 'HISTORICAL' END as assignment
     FROM batches b
     WHERE b.vessel_id = $1
        OR b.id IN (
          SELECT source_batch_id FROM batch_transfers WHERE source_vessel_id = $1
          UNION
          SELECT destination_batch_id FROM batch_transfers WHERE destination_vessel_id = $1
        )
        OR b.id IN (
          SELECT batch_id FROM batch_racking_operations WHERE source_vessel_id = $1 OR destination_vessel_id = $1
        )
        OR b.id IN (
          SELECT batch_id FROM batch_additives WHERE vessel_id = $1
        )
        OR b.id IN (
          SELECT batch_id FROM batch_filter_operations WHERE vessel_id = $1
        )
     ORDER BY b.start_date ASC`,
    [vesselId]
  );

  console.log(`\n  Found ${batchesRes.rows.length} batches:\n`);
  for (const b of batchesRes.rows) {
    const vol = Number(b.current_volume_liters || b.current_volume || 0);
    const initVol = Number(b.initial_volume_liters || b.initial_volume || 0);
    console.log(`  [${b.assignment}] ${b.name} (${b.batch_number})`);
    console.log(`    ID:            ${b.id}`);
    console.log(`    Custom Name:   ${b.custom_name || "N/A"}`);
    console.log(`    Status:        ${b.status}`);
    console.log(`    Product Type:  ${b.product_type}`);
    console.log(`    Init Volume:   ${initVol.toFixed(1)}L (${L2G(initVol)} gal)`);
    console.log(`    Curr Volume:   ${vol.toFixed(1)}L (${L2G(vol)} gal)`);
    console.log(`    Current Vessel:${b.vessel_id === vesselId ? " DRUM-120-4" : ` ${b.vessel_id}`}`);
    console.log(`    OG/FG/ABV:     ${b.original_gravity || "?"} / ${b.final_gravity || "?"} / ${b.actual_abv || b.estimated_abv || "?"}%`);
    console.log(`    Parent Batch:  ${b.parent_batch_id || "N/A"}`);
    console.log(`    Racking Deriv: ${b.is_racking_derivative}`);
    console.log(`    Start:         ${fmt(b.start_date)}`);
    console.log(`    End:           ${fmt(b.end_date)}`);
    console.log(`    Created:       ${fmt(b.created_at)}`);
    console.log(`    Deleted:       ${fmt(b.deleted_at)}`);
    console.log(`    Recon Status:  ${b.reconciliation_status}`);
    console.log(`    TTB Origin Yr: ${b.ttb_origin_year || "N/A"}`);
    console.log(`    Archived:      ${b.is_archived}`);
    console.log();
  }

  // ============================================================
  // 3. DETAILED ACTIVITY PER BATCH
  // ============================================================
  for (const b of batchesRes.rows) {
    sep(`3. ACTIVITY FOR BATCH: ${b.name} (${b.batch_number}) [${b.custom_name || "no custom name"}]`);

    // Transfers IN (this batch is destination)
    sub("Transfers IN (batch is destination)");
    const tIn = await c.query(
      `SELECT bt.*,
              sv.name as source_vessel_name,
              sb.name as source_batch_name, sb.batch_number as source_batch_number
       FROM batch_transfers bt
       LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
       LEFT JOIN batches sb ON sb.id = bt.source_batch_id
       WHERE bt.destination_batch_id = $1
       ORDER BY bt.transferred_at ASC`,
      [b.id]
    );
    if (tIn.rows.length === 0) {
      console.log("    (none)");
    }
    for (const t of tIn.rows) {
      console.log(`    ${fmt(t.transferred_at)} | ${t.volume_transferred}L (${L2G(Number(t.volume_transferred))} gal) from ${t.source_vessel_name || t.source_vessel_id} (${t.source_batch_name || t.source_batch_id})`);
      console.log(`      Loss: ${t.loss || 0}L | Total processed: ${t.total_volume_processed}L | Remaining in source: ${t.remaining_volume}L`);
      console.log(`      Notes: ${t.notes || "N/A"} | Deleted: ${fmt(t.deleted_at)}`);
      console.log(`      Transfer ID: ${t.id}`);
    }

    // Transfers OUT (this batch is source)
    sub("Transfers OUT (batch is source)");
    const tOut = await c.query(
      `SELECT bt.*,
              dv.name as dest_vessel_name,
              db.name as dest_batch_name, db.batch_number as dest_batch_number
       FROM batch_transfers bt
       LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
       LEFT JOIN batches db ON db.id = bt.destination_batch_id
       WHERE bt.source_batch_id = $1
       ORDER BY bt.transferred_at ASC`,
      [b.id]
    );
    if (tOut.rows.length === 0) {
      console.log("    (none)");
    }
    for (const t of tOut.rows) {
      console.log(`    ${fmt(t.transferred_at)} | ${t.volume_transferred}L (${L2G(Number(t.volume_transferred))} gal) to ${t.dest_vessel_name || t.destination_vessel_id} (${t.dest_batch_name || t.destination_batch_id})`);
      console.log(`      Loss: ${t.loss || 0}L | Total processed: ${t.total_volume_processed}L | Remaining: ${t.remaining_volume}L`);
      console.log(`      Notes: ${t.notes || "N/A"} | Deleted: ${fmt(t.deleted_at)}`);
      console.log(`      Transfer ID: ${t.id}`);
    }

    // Racking operations
    sub("Racking Operations");
    const racks = await c.query(
      `SELECT r.*,
              sv.name as source_vessel_name, dv.name as dest_vessel_name
       FROM batch_racking_operations r
       LEFT JOIN vessels sv ON sv.id = r.source_vessel_id
       LEFT JOIN vessels dv ON dv.id = r.destination_vessel_id
       WHERE r.batch_id = $1
       ORDER BY r.racked_at ASC`,
      [b.id]
    );
    if (racks.rows.length === 0) {
      console.log("    (none)");
    }
    for (const r of racks.rows) {
      console.log(`    ${fmt(r.racked_at)} | ${r.source_vessel_name} -> ${r.dest_vessel_name} | Before: ${r.volume_before}L After: ${r.volume_after}L Loss: ${r.volume_loss}L`);
      console.log(`      Notes: ${r.notes || "N/A"} | Deleted: ${fmt(r.deleted_at)}`);
      console.log(`      Racking ID: ${r.id}`);
    }

    // Filter operations
    sub("Filter Operations");
    const filters = await c.query(
      `SELECT f.*, v.name as vessel_name
       FROM batch_filter_operations f
       LEFT JOIN vessels v ON v.id = f.vessel_id
       WHERE f.batch_id = $1
       ORDER BY f.filtered_at ASC`,
      [b.id]
    );
    if (filters.rows.length === 0) {
      console.log("    (none)");
    }
    for (const f of filters.rows) {
      console.log(`    ${fmt(f.filtered_at)} | ${f.filter_type} | Before: ${f.volume_before}L After: ${f.volume_after}L Loss: ${f.volume_loss}L | Vessel: ${f.vessel_name}`);
      console.log(`      Notes: ${f.notes || "N/A"} | Deleted: ${fmt(f.deleted_at)}`);
      console.log(`      Filter Op ID: ${f.id}`);
    }

    // Volume adjustments
    sub("Volume Adjustments");
    const adjs = await c.query(
      `SELECT * FROM batch_volume_adjustments
       WHERE batch_id = $1
       ORDER BY adjustment_date ASC`,
      [b.id]
    );
    if (adjs.rows.length === 0) {
      console.log("    (none)");
    }
    for (const a of adjs.rows) {
      console.log(`    ${fmt(a.adjustment_date)} | ${a.adjustment_type} | Before: ${a.volume_before}L After: ${a.volume_after}L Amount: ${a.adjustment_amount}L`);
      console.log(`      Reason: ${a.reason} | Notes: ${a.notes || "N/A"} | Deleted: ${fmt(a.deleted_at)}`);
    }

    // Measurements
    sub("Measurements");
    const meas = await c.query(
      `SELECT * FROM batch_measurements
       WHERE batch_id = $1
       ORDER BY measurement_date ASC`,
      [b.id]
    );
    if (meas.rows.length === 0) {
      console.log("    (none)");
    }
    for (const m of meas.rows) {
      console.log(`    ${fmt(m.measurement_date)} | SG: ${m.specific_gravity || "?"} | ABV: ${m.abv || "?"}% | pH: ${m.ph || "?"} | Vol: ${m.volume || "?"}${m.volume_unit || ""} | Temp: ${m.temperature || "?"}°C`);
      console.log(`      Est: ${m.is_estimated} | Method: ${m.measurement_method || "?"} | Notes: ${m.notes || "N/A"} | Deleted: ${fmt(m.deleted_at)}`);
    }

    // Additives
    sub("Additives");
    const adds = await c.query(
      `SELECT * FROM batch_additives
       WHERE batch_id = $1
       ORDER BY added_at ASC`,
      [b.id]
    );
    if (adds.rows.length === 0) {
      console.log("    (none)");
    }
    for (const a of adds.rows) {
      console.log(`    ${fmt(a.added_at)} | ${a.additive_name} (${a.additive_type}) | ${a.amount} ${a.unit} | Cost: ${a.total_cost || "N/A"}`);
      console.log(`      Vessel: ${a.vessel_id === vesselId ? "DRUM-120-4" : a.vessel_id} | Notes: ${a.notes || "N/A"} | Deleted: ${fmt(a.deleted_at)}`);
    }

    // Carbonation operations
    sub("Carbonation Operations");
    const carbs = await c.query(
      `SELECT * FROM batch_carbonation_operations
       WHERE batch_id = $1
       ORDER BY started_at ASC`,
      [b.id]
    );
    if (carbs.rows.length === 0) {
      console.log("    (none)");
    }
    for (const cb of carbs.rows) {
      console.log(`    ${fmt(cb.started_at)} | Process: ${cb.carbonation_process || "?"} | Target CO2 Vols: ${cb.target_co2_volumes || "?"} | Pressure: ${cb.pressure_applied || "?"} PSI`);
      console.log(`      Starting Vol: ${cb.starting_volume || "?"}L | Completed: ${fmt(cb.completed_at)}`);
    }

    // Packaging runs
    sub("Packaging Runs");
    const pkgRuns = await c.query(
      `SELECT br.*
       FROM bottle_runs br
       WHERE br.batch_id = $1
       ORDER BY br.created_at ASC`,
      [b.id]
    );
    if (pkgRuns.rows.length === 0) {
      console.log("    (none)");
    }
    for (const p of pkgRuns.rows) {
      console.log(`    ${fmt(p.created_at)} | Status: ${p.status} | Volume: ${p.volume_used || "?"}L | Bottles: ${p.total_bottles || "?"}`);
    }

    // Volume audit trail
    sub("Volume Audit Trail");
    const volAudit = await c.query(
      `SELECT * FROM batch_volume_audit
       WHERE batch_id = $1
       ORDER BY changed_at ASC`,
      [b.id]
    );
    if (volAudit.rows.length === 0) {
      console.log("    (none)");
    }
    for (const va of volAudit.rows) {
      console.log(`    ${fmt(va.changed_at)} | ${va.field_name}: ${va.old_value} -> ${va.new_value} | Source: ${va.change_source}`);
    }
  }

  // ============================================================
  // 4. ALL FILTER OPERATIONS ON THIS VESSEL (regardless of batch)
  // ============================================================
  sep("4. ALL FILTER OPERATIONS ON DRUM-120-4 (by vessel_id)");

  const allFilters = await c.query(
    `SELECT f.*, b.name as batch_name, b.batch_number, b.custom_name as batch_custom_name
     FROM batch_filter_operations f
     LEFT JOIN batches b ON b.id = f.batch_id
     WHERE f.vessel_id = $1
     ORDER BY f.filtered_at ASC`,
    [vesselId]
  );
  console.log(`\n  Found ${allFilters.rows.length} filter operations:\n`);
  for (const f of allFilters.rows) {
    console.log(`  ${fmt(f.filtered_at)} | ${f.filter_type} | Batch: ${f.batch_name} (${f.batch_custom_name || "N/A"}) [${f.batch_number}]`);
    console.log(`    Before: ${f.volume_before}L After: ${f.volume_after}L Loss: ${f.volume_loss}L`);
    console.log(`    Batch ID: ${f.batch_id}`);
    console.log(`    Filter Op ID: ${f.id}`);
    console.log(`    Notes: ${f.notes || "N/A"} | Deleted: ${fmt(f.deleted_at)}`);
  }

  // ============================================================
  // 5. ALL CLEANING OPERATIONS ON THIS VESSEL
  // ============================================================
  sep("5. ALL CLEANING OPERATIONS ON DRUM-120-4");

  const cleanings = await c.query(
    `SELECT * FROM vessel_cleaning_operations WHERE vessel_id = $1 ORDER BY cleaned_at ASC`,
    [vesselId]
  );
  console.log(`\n  Found ${cleanings.rows.length} cleaning operations:\n`);
  for (const cl of cleanings.rows) {
    console.log(`  ${fmt(cl.cleaned_at)} | Cleaning ID: ${cl.id}`);
    console.log(`    Notes: ${cl.notes || "N/A"} | Deleted: ${fmt(cl.deleted_at)}`);
  }

  // ============================================================
  // 6. ALL RACKING OPERATIONS INVOLVING THIS VESSEL
  // ============================================================
  sep("6. ALL RACKING OPERATIONS INVOLVING DRUM-120-4");

  const allRackings = await c.query(
    `SELECT r.*, sv.name as src_vessel, dv.name as dst_vessel, b.name as batch_name, b.custom_name as batch_custom_name
     FROM batch_racking_operations r
     LEFT JOIN vessels sv ON sv.id = r.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = r.destination_vessel_id
     LEFT JOIN batches b ON b.id = r.batch_id
     WHERE r.source_vessel_id = $1 OR r.destination_vessel_id = $1
     ORDER BY r.racked_at ASC`,
    [vesselId]
  );
  console.log(`\n  Found ${allRackings.rows.length} racking operations:\n`);
  for (const r of allRackings.rows) {
    const dir = r.source_vessel_id === vesselId ? "FROM" : "INTO";
    console.log(`  ${fmt(r.racked_at)} | RACKING ${dir} | ${r.src_vessel} -> ${r.dst_vessel}`);
    console.log(`    Batch: ${r.batch_name} (${r.batch_custom_name || "N/A"}) | Batch ID: ${r.batch_id}`);
    console.log(`    Before: ${r.volume_before}L After: ${r.volume_after}L Loss: ${r.volume_loss}L`);
    console.log(`    Racking ID: ${r.id}`);
    console.log(`    Notes: ${r.notes || "N/A"} | Deleted: ${fmt(r.deleted_at)}`);
  }

  // ============================================================
  // 7. ALL TRANSFERS INVOLVING THIS VESSEL
  // ============================================================
  sep("7. ALL TRANSFERS INVOLVING DRUM-120-4");

  const allTransfers = await c.query(
    `SELECT bt.*,
            sv.name as src_vessel, dv.name as dst_vessel,
            sb.name as src_batch, sb.custom_name as src_custom,
            db.name as dst_batch, db.custom_name as dst_custom
     FROM batch_transfers bt
     LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     LEFT JOIN batches sb ON sb.id = bt.source_batch_id
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     WHERE bt.source_vessel_id = $1 OR bt.destination_vessel_id = $1
     ORDER BY bt.transferred_at ASC`,
    [vesselId]
  );
  console.log(`\n  Found ${allTransfers.rows.length} transfers:\n`);
  for (const t of allTransfers.rows) {
    const dir = t.source_vessel_id === vesselId ? "OUT" : "IN";
    console.log(`  ${fmt(t.transferred_at)} | TRANSFER ${dir} | ${t.src_vessel} (${t.src_batch} / ${t.src_custom || "N/A"}) -> ${t.dst_vessel} (${t.dst_batch} / ${t.dst_custom || "N/A"})`);
    console.log(`    Volume: ${t.volume_transferred}L (${L2G(Number(t.volume_transferred))} gal) | Loss: ${t.loss || 0}L | Remaining: ${t.remaining_volume}L`);
    console.log(`    Transfer ID: ${t.id}`);
    console.log(`    Notes: ${t.notes || "N/A"} | Deleted: ${fmt(t.deleted_at)}`);
  }

  // ============================================================
  // 8. CURRENT BATCH ASSIGNED TO THIS VESSEL
  // ============================================================
  sep("8. CURRENT BATCH ASSIGNED TO DRUM-120-4");

  const currentBatch = await c.query(
    `SELECT b.*, v.name as vessel_name
     FROM batches b
     LEFT JOIN vessels v ON v.id = b.vessel_id
     WHERE b.vessel_id = $1
       AND b.deleted_at IS NULL
       AND b.status NOT IN ('completed', 'discarded')
     ORDER BY b.start_date DESC`,
    [vesselId]
  );
  if (currentBatch.rows.length === 0) {
    console.log("\n  No active batch currently assigned to this vessel.");
  } else {
    console.log(`\n  ${currentBatch.rows.length} active batch(es):\n`);
    for (const b of currentBatch.rows) {
      console.log(`  ${b.name} (${b.custom_name || "N/A"})`);
      console.log(`    ID:            ${b.id}`);
      console.log(`    Batch #:       ${b.batch_number}`);
      console.log(`    Status:        ${b.status}`);
      console.log(`    Product Type:  ${b.product_type}`);
      console.log(`    Init Volume:   ${Number(b.initial_volume_liters || 0).toFixed(1)}L (${L2G(Number(b.initial_volume_liters || 0))} gal)`);
      console.log(`    Curr Volume:   ${Number(b.current_volume_liters || 0).toFixed(1)}L (${L2G(Number(b.current_volume_liters || 0))} gal)`);
      console.log(`    Start:         ${fmt(b.start_date)}`);
      console.log(`    End:           ${fmt(b.end_date)}`);
    }
  }

  // ============================================================
  // 9. CHRONOLOGICAL TIMELINE OF ALL ACTIVITY ON DRUM-120-4
  // ============================================================
  sep("9. CHRONOLOGICAL TIMELINE OF ALL ACTIVITY ON DRUM-120-4");

  const timeline: { date: Date; type: string; detail: string }[] = [];

  // Batch assignments
  for (const b of batchesRes.rows) {
    if (b.vessel_id === vesselId) {
      timeline.push({
        date: new Date(b.start_date),
        type: "BATCH_ASSIGN",
        detail: `Batch ${b.name} (${b.custom_name || "N/A"}) assigned to vessel (initial vol: ${Number(b.initial_volume_liters || b.initial_volume).toFixed(1)}L)`,
      });
    }
  }

  // Transfers involving this vessel
  for (const t of allTransfers.rows) {
    const dir = t.source_vessel_id === vesselId ? "OUT" : "IN";
    const other =
      dir === "OUT"
        ? `-> ${t.dst_vessel} (${t.dst_batch} / ${t.dst_custom || "N/A"})`
        : `<- ${t.src_vessel} (${t.src_batch} / ${t.src_custom || "N/A"})`;
    timeline.push({
      date: new Date(t.transferred_at),
      type: `TRANSFER_${dir}`,
      detail: `${t.volume_transferred}L ${other} | Loss: ${t.loss || 0}L | Deleted: ${t.deleted_at ? "YES" : "no"} | ID: ${t.id}`,
    });
  }

  // Rackings involving this vessel
  for (const r of allRackings.rows) {
    const dir = r.source_vessel_id === vesselId ? "FROM" : "INTO";
    timeline.push({
      date: new Date(r.racked_at),
      type: `RACKING_${dir}`,
      detail: `${r.batch_name} (${r.batch_custom_name || "N/A"}) | ${r.src_vessel} -> ${r.dst_vessel} | Before: ${r.volume_before}L After: ${r.volume_after}L Loss: ${r.volume_loss}L | Deleted: ${r.deleted_at ? "YES" : "no"} | ID: ${r.id}`,
    });
  }

  // Filter operations on this vessel
  for (const f of allFilters.rows) {
    timeline.push({
      date: new Date(f.filtered_at),
      type: "FILTER",
      detail: `${f.batch_name} (${f.batch_custom_name || "N/A"}) | ${f.filter_type} | Before: ${f.volume_before}L After: ${f.volume_after}L Loss: ${f.volume_loss}L | Deleted: ${f.deleted_at ? "YES" : "no"} | ID: ${f.id}`,
    });
  }

  // Cleaning operations
  for (const cl of cleanings.rows) {
    timeline.push({
      date: new Date(cl.cleaned_at),
      type: "CLEANING",
      detail: `Notes: ${cl.notes || "N/A"} | Deleted: ${cl.deleted_at ? "YES" : "no"} | ID: ${cl.id}`,
    });
  }

  // Additives on this vessel
  const allAdditives = await c.query(
    `SELECT a.*, b.name as batch_name, b.custom_name as batch_custom_name
     FROM batch_additives a
     LEFT JOIN batches b ON b.id = a.batch_id
     WHERE a.vessel_id = $1
     ORDER BY a.added_at ASC`,
    [vesselId]
  );
  for (const a of allAdditives.rows) {
    timeline.push({
      date: new Date(a.added_at),
      type: "ADDITIVE",
      detail: `${a.batch_name} (${a.batch_custom_name || "N/A"}) | ${a.additive_name} (${a.additive_type}) ${a.amount} ${a.unit}`,
    });
  }

  // Measurements for batches in this vessel
  for (const b of batchesRes.rows) {
    const measAll = await c.query(
      `SELECT * FROM batch_measurements WHERE batch_id = $1 ORDER BY measurement_date ASC`,
      [b.id]
    );
    for (const m of measAll.rows) {
      timeline.push({
        date: new Date(m.measurement_date),
        type: "MEASUREMENT",
        detail: `${b.name} (${b.custom_name || "N/A"}) | SG: ${m.specific_gravity || "?"} ABV: ${m.abv || "?"}% pH: ${m.ph || "?"} Vol: ${m.volume || "?"}L`,
      });
    }
  }

  // Volume adjustments on batches in this vessel
  for (const b of batchesRes.rows) {
    const adjAll = await c.query(
      `SELECT * FROM batch_volume_adjustments WHERE batch_id = $1 ORDER BY adjustment_date ASC`,
      [b.id]
    );
    for (const a of adjAll.rows) {
      timeline.push({
        date: new Date(a.adjustment_date),
        type: "VOL_ADJUST",
        detail: `${b.name} (${b.custom_name || "N/A"}) | ${a.adjustment_type} | ${a.volume_before}L -> ${a.volume_after}L (${a.adjustment_amount}L) | ${a.reason}`,
      });
    }
  }

  // Sort and print timeline
  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  console.log(`\n  ${timeline.length} events total:\n`);
  for (const e of timeline) {
    console.log(`  ${fmt(e.date)} | ${e.type.padEnd(18)} | ${e.detail}`);
  }

  // ============================================================
  // 10. ANOMALY DETECTION
  // ============================================================
  sep("10. ANOMALY DETECTION");

  // Check for duplicate racking entries (same batch, same timestamp, same vessels)
  sub("Duplicate Racking Entries");
  const dupRackings = await c.query(
    `SELECT r1.id as id1, r2.id as id2, r1.batch_id, b.name as batch_name,
            r1.racked_at, r1.source_vessel_id, r1.destination_vessel_id,
            r1.volume_before, r1.volume_after
     FROM batch_racking_operations r1
     JOIN batch_racking_operations r2 ON r1.batch_id = r2.batch_id
       AND r1.racked_at = r2.racked_at
       AND r1.source_vessel_id = r2.source_vessel_id
       AND r1.destination_vessel_id = r2.destination_vessel_id
       AND r1.id < r2.id
     LEFT JOIN batches b ON b.id = r1.batch_id
     WHERE r1.source_vessel_id = $1 OR r1.destination_vessel_id = $1`,
    [vesselId]
  );
  if (dupRackings.rows.length === 0) {
    console.log("    No duplicate racking entries found.");
  } else {
    console.log(`    FOUND ${dupRackings.rows.length} duplicate racking pair(s):`);
    for (const d of dupRackings.rows) {
      console.log(`    IDs: ${d.id1} & ${d.id2} | Batch: ${d.batch_name} | At: ${fmt(d.racked_at)}`);
    }
  }

  // Check for filter after cleaning with no transfer in between
  sub("Filter After Cleaning (no transfer in between)");
  const sortedCleanings = cleanings.rows.sort(
    (a: any, b: any) => new Date(a.cleaned_at).getTime() - new Date(b.cleaned_at).getTime()
  );
  for (const cl of sortedCleanings) {
    const cleanedAt = new Date(cl.cleaned_at);
    // Find next filter operation after this cleaning
    const nextFilter = allFilters.rows.find(
      (f: any) => new Date(f.filtered_at).getTime() > cleanedAt.getTime()
    );
    if (nextFilter) {
      // Check if there's a transfer between cleaning and filter
      const transferBetween = allTransfers.rows.find(
        (t: any) =>
          new Date(t.transferred_at).getTime() > cleanedAt.getTime() &&
          new Date(t.transferred_at).getTime() < new Date(nextFilter.filtered_at).getTime() &&
          t.destination_vessel_id === vesselId
      );
      const rackingBetween = allRackings.rows.find(
        (r: any) =>
          new Date(r.racked_at).getTime() > cleanedAt.getTime() &&
          new Date(r.racked_at).getTime() < new Date(nextFilter.filtered_at).getTime() &&
          r.destination_vessel_id === vesselId
      );
      if (!transferBetween && !rackingBetween) {
        console.log(`    GAP DETECTED: Cleaning at ${fmt(cl.cleaned_at)} followed by filter at ${fmt(nextFilter.filtered_at)} with NO transfer/racking in between!`);
        console.log(`      Filter batch: ${nextFilter.batch_name} (${nextFilter.batch_custom_name || "N/A"})`);
      } else {
        console.log(`    OK: Cleaning at ${fmt(cl.cleaned_at)} -> transfer/racking -> filter at ${fmt(nextFilter.filtered_at)}`);
      }
    }
  }

  // Check for filter operations where batch vessel doesn't match filter vessel
  sub("Filter Operations: Batch Vessel vs Filter Vessel Mismatch");
  for (const f of allFilters.rows) {
    const batchForFilter = batchesRes.rows.find((b: any) => b.id === f.batch_id);
    if (batchForFilter && batchForFilter.vessel_id !== vesselId) {
      console.log(`    MISMATCH: Filter on vessel DRUM-120-4 but batch ${batchForFilter.name} currently assigned to vessel ${batchForFilter.vessel_id}`);
      console.log(`      Filter ID: ${f.id} | Filtered at: ${fmt(f.filtered_at)}`);
    }
  }

  await c.end();
  console.log("\n\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  c.end();
  process.exit(1);
});
