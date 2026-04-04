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
  // 1. VESSEL: BARREL-225-4
  // ============================================================
  sep("1. VESSEL: BARREL-225-4 - All Fields");

  const vesselRes = await c.query(
    `SELECT * FROM vessels WHERE name = 'BARREL-225-4'`
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
  console.log(`  Is Barrel:         ${vessel.is_barrel}`);
  console.log(`  Barrel Wood:       ${vessel.barrel_wood_type || "N/A"}`);
  console.log(`  Barrel Origin:     ${vessel.barrel_origin_contents || "N/A"}`);
  console.log(`  Barrel Origin Note:${vessel.barrel_origin_notes || "N/A"}`);
  console.log(`  Barrel Toast:      ${vessel.barrel_toast_level || "N/A"}`);
  console.log(`  Year Acquired:     ${vessel.barrel_year_acquired || "N/A"}`);
  console.log(`  Barrel Age:        ${vessel.barrel_age_years || "N/A"} years`);
  console.log(`  Barrel Cost:       ${vessel.barrel_cost || "N/A"}`);
  console.log(`  Flavor Level:      ${vessel.barrel_flavor_level || "N/A"}`);
  console.log(`  Use Count:         ${vessel.barrel_use_count}`);
  console.log(`  Last Prepared:     ${fmt(vessel.barrel_last_prepared_at)}`);
  console.log(`  Retired At:        ${fmt(vessel.barrel_retired_at)}`);
  console.log(`  Retired Reason:    ${vessel.barrel_retired_reason || "N/A"}`);
  console.log(`  Notes:             ${vessel.notes || "N/A"}`);
  console.log(`  Created:           ${fmt(vessel.created_at)}`);
  console.log(`  Deleted:           ${fmt(vessel.deleted_at)}`);

  const vesselId = vessel.id;

  // ============================================================
  // 2. ALL BATCHES EVER IN THIS VESSEL
  // ============================================================
  sep("2. ALL BATCHES ASSOCIATED WITH BARREL-225-4");

  // Batches currently or historically in this vessel (including via transfers)
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
          SELECT batch_id FROM barrel_usage_history WHERE vessel_id = $1
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
    console.log(`    Current Vessel:${b.vessel_id === vesselId ? " BARREL-225-4" : ` ${b.vessel_id}`}`);
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

  const batchIds = batchesRes.rows.map((b: any) => b.id);

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
      console.log(`      Vessel: ${a.vessel_id === vesselId ? "BARREL-225-4" : a.vessel_id} | Notes: ${a.notes || "N/A"} | Deleted: ${fmt(a.deleted_at)}`);
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
  // 4. CHRONOLOGICAL TIMELINE ACROSS ALL BATCHES ON THIS VESSEL
  // ============================================================
  sep("4. CHRONOLOGICAL TIMELINE OF ALL ACTIVITY ON BARREL-225-4");

  // Build timeline from all activity tables that reference this vessel
  const timeline: { date: Date; type: string; detail: string }[] = [];

  // Batch assignments
  for (const b of batchesRes.rows) {
    if (b.vessel_id === vesselId) {
      timeline.push({ date: new Date(b.start_date), type: "BATCH_ASSIGN", detail: `Batch ${b.name} assigned to vessel (initial vol: ${Number(b.initial_volume_liters || b.initial_volume).toFixed(1)}L)` });
    }
  }

  // Transfers involving this vessel
  const allTransfers = await c.query(
    `SELECT bt.*,
            sv.name as src_vessel, dv.name as dst_vessel,
            sb.name as src_batch, db.name as dst_batch
     FROM batch_transfers bt
     LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     LEFT JOIN batches sb ON sb.id = bt.source_batch_id
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     WHERE bt.source_vessel_id = $1 OR bt.destination_vessel_id = $1
     ORDER BY bt.transferred_at ASC`,
    [vesselId]
  );
  for (const t of allTransfers.rows) {
    const dir = t.source_vessel_id === vesselId ? "OUT" : "IN";
    const other = dir === "OUT" ? `-> ${t.dst_vessel} (${t.dst_batch})` : `<- ${t.src_vessel} (${t.src_batch})`;
    timeline.push({
      date: new Date(t.transferred_at),
      type: `TRANSFER_${dir}`,
      detail: `${t.volume_transferred}L ${other} | Loss: ${t.loss || 0}L | Notes: ${t.notes || "N/A"} | Deleted: ${t.deleted_at ? "YES" : "no"}`,
    });
  }

  // Rackings involving this vessel
  const allRackings = await c.query(
    `SELECT r.*, sv.name as src_vessel, dv.name as dst_vessel, b.name as batch_name
     FROM batch_racking_operations r
     LEFT JOIN vessels sv ON sv.id = r.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = r.destination_vessel_id
     LEFT JOIN batches b ON b.id = r.batch_id
     WHERE r.source_vessel_id = $1 OR r.destination_vessel_id = $1
     ORDER BY r.racked_at ASC`,
    [vesselId]
  );
  for (const r of allRackings.rows) {
    const dir = r.source_vessel_id === vesselId ? "FROM" : "INTO";
    timeline.push({
      date: new Date(r.racked_at),
      type: `RACKING_${dir}`,
      detail: `${r.batch_name} | ${r.src_vessel} -> ${r.dst_vessel} | Before: ${r.volume_before}L After: ${r.volume_after}L Loss: ${r.volume_loss}L`,
    });
  }

  // Additives on this vessel
  const allAdditives = await c.query(
    `SELECT a.*, b.name as batch_name
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
      detail: `${a.batch_name} | ${a.additive_name} (${a.additive_type}) ${a.amount} ${a.unit}`,
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
        detail: `${b.name} | SG: ${m.specific_gravity || "?"} ABV: ${m.abv || "?"}% pH: ${m.ph || "?"} Vol: ${m.volume || "?"}L`,
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
        detail: `${b.name} | ${a.adjustment_type} | ${a.volume_before}L -> ${a.volume_after}L (${a.adjustment_amount}L) | ${a.reason}`,
      });
    }
  }

  // Barrel usage history
  const usageHist = await c.query(
    `SELECT buh.*, b.name as batch_name
     FROM barrel_usage_history buh
     LEFT JOIN batches b ON b.id = buh.batch_id
     WHERE buh.vessel_id = $1
     ORDER BY buh.started_at ASC`,
    [vesselId]
  );
  for (const u of usageHist.rows) {
    timeline.push({
      date: new Date(u.started_at),
      type: "BARREL_USE_START",
      detail: `${u.batch_name} | Flavor at start: ${u.flavor_level_at_start || "?"} | Duration: ${u.duration_days || "ongoing"} days`,
    });
    if (u.ended_at) {
      timeline.push({
        date: new Date(u.ended_at),
        type: "BARREL_USE_END",
        detail: `${u.batch_name} ended | Tasting: ${u.tasting_notes || "N/A"}`,
      });
    }
  }

  // Barrel contents history
  const contentsHist = await c.query(
    `SELECT * FROM barrel_contents_history
     WHERE vessel_id = $1
     ORDER BY started_at ASC`,
    [vesselId]
  );
  for (const ch of contentsHist.rows) {
    timeline.push({
      date: new Date(ch.started_at),
      type: "BARREL_CONTENTS",
      detail: `${ch.contents_type}: ${ch.contents_description || "N/A"} | Source: ${ch.source} | Ended: ${ch.ended_at || "ongoing"}`,
    });
  }

  // Cleaning operations
  const cleanings = await c.query(
    `SELECT * FROM vessel_cleaning_operations WHERE vessel_id = $1 ORDER BY cleaned_at ASC`,
    [vesselId]
  );
  for (const cl of cleanings.rows) {
    timeline.push({
      date: new Date(cl.cleaned_at),
      type: "CLEANING",
      detail: `Notes: ${cl.notes || "N/A"}`,
    });
  }

  // Sort and print timeline
  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  console.log(`\n  ${timeline.length} events total:\n`);
  for (const e of timeline) {
    console.log(`  ${fmt(e.date)} | ${e.type.padEnd(18)} | ${e.detail}`);
  }

  // ============================================================
  // 5. SPECIFIC: 190L TOP-OFF FROM TANK-1000-2 (batch 6a06ce10)
  // ============================================================
  sep("5. SEARCHING FOR 190L TOP-OFF FROM TANK-1000-2 (Summer Community Blend 1, batch 6a06ce10)");

  // Find the source batch
  const srcBatch = await c.query(
    `SELECT id, name, batch_number, custom_name, current_volume_liters
     FROM batches WHERE id::text LIKE '6a06ce10%' OR name ILIKE '%Summer Community Blend%'
     ORDER BY created_at DESC`
  );
  console.log("\n  Source batch search results:");
  for (const sb of srcBatch.rows) {
    console.log(`    ${sb.id} | ${sb.name} | ${sb.custom_name || "N/A"} | Vol: ${sb.current_volume_liters}L`);
  }

  // Find TANK-1000-2
  const tank = await c.query(
    `SELECT id, name FROM vessels WHERE name = 'TANK-1000-2'`
  );
  console.log("\n  TANK-1000-2:");
  for (const t of tank.rows) {
    console.log(`    ID: ${t.id} | Name: ${t.name}`);
  }

  // Search for any transfer ~190L involving this barrel and TANK-1000-2
  const topoffTransfers = await c.query(
    `SELECT bt.*,
            sv.name as src_vessel, dv.name as dst_vessel,
            sb.name as src_batch, sb.custom_name as src_custom_name,
            db.name as dst_batch, db.custom_name as dst_custom_name
     FROM batch_transfers bt
     LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     LEFT JOIN batches sb ON sb.id = bt.source_batch_id
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     WHERE (bt.source_vessel_id = $1 OR bt.destination_vessel_id = $1)
       AND (bt.source_vessel_id = $2 OR bt.destination_vessel_id = $2)
     ORDER BY bt.transferred_at ASC`,
    [vesselId, tank.rows[0]?.id]
  );

  console.log(`\n  Transfers between BARREL-225-4 and TANK-1000-2: ${topoffTransfers.rows.length}`);
  for (const t of topoffTransfers.rows) {
    console.log(`\n    Transfer ID: ${t.id}`);
    console.log(`    Date:        ${fmt(t.transferred_at)}`);
    console.log(`    Direction:   ${t.src_vessel} -> ${t.dst_vessel}`);
    console.log(`    Src Batch:   ${t.src_batch} (${t.src_custom_name || "N/A"}) [${t.source_batch_id}]`);
    console.log(`    Dst Batch:   ${t.dst_batch} (${t.dst_custom_name || "N/A"}) [${t.destination_batch_id}]`);
    console.log(`    Volume:      ${t.volume_transferred}L (${L2G(Number(t.volume_transferred))} gal)`);
    console.log(`    Loss:        ${t.loss || 0}L`);
    console.log(`    Total Proc:  ${t.total_volume_processed}L`);
    console.log(`    Remaining:   ${t.remaining_volume}L`);
    console.log(`    Notes:       ${t.notes || "N/A"}`);
    console.log(`    Deleted:     ${fmt(t.deleted_at)}`);
  }

  // Also search broadly for any ~190L transfer into this barrel in Jan 2026
  const broadSearch = await c.query(
    `SELECT bt.*,
            sv.name as src_vessel, dv.name as dst_vessel,
            sb.name as src_batch, sb.custom_name as src_custom_name,
            db.name as dst_batch, db.custom_name as dst_custom_name
     FROM batch_transfers bt
     LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     LEFT JOIN batches sb ON sb.id = bt.source_batch_id
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     WHERE bt.destination_vessel_id = $1
       AND bt.transferred_at >= '2026-01-01' AND bt.transferred_at <= '2026-02-28'
     ORDER BY bt.transferred_at ASC`,
    [vesselId]
  );

  console.log(`\n  All transfers INTO barrel Jan-Feb 2026: ${broadSearch.rows.length}`);
  for (const t of broadSearch.rows) {
    console.log(`\n    Transfer ID: ${t.id}`);
    console.log(`    Date:        ${fmt(t.transferred_at)}`);
    console.log(`    From:        ${t.src_vessel} (${t.src_batch} / ${t.src_custom_name || "N/A"}) [${t.source_batch_id}]`);
    console.log(`    Volume:      ${t.volume_transferred}L (${L2G(Number(t.volume_transferred))} gal)`);
    console.log(`    Loss:        ${t.loss || 0}L`);
    console.log(`    Notes:       ${t.notes || "N/A"}`);
    console.log(`    Deleted:     ${fmt(t.deleted_at)}`);
  }

  // Also search for transfers OUT of barrel in Jan 2026 (in case direction is reversed)
  const broadSearchOut = await c.query(
    `SELECT bt.*,
            sv.name as src_vessel, dv.name as dst_vessel,
            sb.name as src_batch, db.name as dst_batch
     FROM batch_transfers bt
     LEFT JOIN vessels sv ON sv.id = bt.source_vessel_id
     LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
     LEFT JOIN batches sb ON sb.id = bt.source_batch_id
     LEFT JOIN batches db ON db.id = bt.destination_batch_id
     WHERE bt.source_vessel_id = $1
       AND bt.transferred_at >= '2026-01-01' AND bt.transferred_at <= '2026-02-28'
     ORDER BY bt.transferred_at ASC`,
    [vesselId]
  );
  console.log(`\n  All transfers OUT of barrel Jan-Feb 2026: ${broadSearchOut.rows.length}`);
  for (const t of broadSearchOut.rows) {
    console.log(`    ${fmt(t.transferred_at)} | ${t.volume_transferred}L to ${t.dst_vessel} (${t.dst_batch}) | Deleted: ${t.deleted_at ? "YES" : "no"}`);
  }

  // ============================================================
  // 6. BARREL VOLUME BEFORE TOP-OFF
  // ============================================================
  sep("6. BARREL VOLUME CONTEXT AROUND JAN 24, 2026");

  // Find what batch was in the barrel around Jan 24
  const batchInBarrelJan = await c.query(
    `SELECT b.id, b.name, b.custom_name, b.batch_number, b.status,
            b.current_volume, b.current_volume_liters, b.initial_volume_liters,
            b.vessel_id, b.start_date, b.end_date
     FROM batches b
     WHERE b.vessel_id = $1
       AND b.start_date <= '2026-01-25'
       AND (b.end_date IS NULL OR b.end_date >= '2026-01-20')
       AND b.deleted_at IS NULL
     ORDER BY b.start_date DESC`,
    [vesselId]
  );

  console.log("\n  Batch(es) in barrel around Jan 24, 2026:");
  for (const b of batchInBarrelJan.rows) {
    console.log(`    ${b.name} (${b.custom_name || "N/A"}) | Status: ${b.status} | Start: ${fmt(b.start_date)} | Vol: ${Number(b.current_volume_liters || 0).toFixed(1)}L`);

    // Find the last measurement or volume event before Jan 24
    const lastMeas = await c.query(
      `SELECT * FROM batch_measurements
       WHERE batch_id = $1 AND measurement_date <= '2026-01-24' AND deleted_at IS NULL
       ORDER BY measurement_date DESC LIMIT 3`,
      [b.id]
    );
    console.log(`\n    Last measurements before Jan 24:`);
    for (const m of lastMeas.rows) {
      console.log(`      ${fmt(m.measurement_date)} | Vol: ${m.volume || "?"}L | SG: ${m.specific_gravity || "?"}`);
    }

    // Volume audit trail around Jan 24
    const volChanges = await c.query(
      `SELECT * FROM batch_volume_audit
       WHERE batch_id = $1
         AND changed_at >= '2026-01-15' AND changed_at <= '2026-02-05'
       ORDER BY changed_at ASC`,
      [b.id]
    );
    console.log(`\n    Volume audit trail Jan 15 - Feb 5:`);
    for (const va of volChanges.rows) {
      console.log(`      ${fmt(va.changed_at)} | ${va.field_name}: ${va.old_value} -> ${va.new_value} | Source: ${va.change_source}`);
    }
  }

  // Also check: any batch that was EVER in this barrel and active around Jan 24, even if vessel changed
  const anyBatchJan = await c.query(
    `SELECT DISTINCT b.id, b.name, b.custom_name, b.current_volume_liters, b.start_date
     FROM batches b
     JOIN batch_transfers bt ON (bt.destination_batch_id = b.id AND bt.destination_vessel_id = $1)
                              OR (bt.source_batch_id = b.id AND bt.source_vessel_id = $1)
     WHERE bt.transferred_at >= '2026-01-20' AND bt.transferred_at <= '2026-01-31'`,
    [vesselId]
  );
  console.log(`\n  Batches involved in transfers with barrel around Jan 20-31:`)
  for (const b of anyBatchJan.rows) {
    console.log(`    ${b.id} | ${b.name} (${b.custom_name || "N/A"}) | Vol: ${Number(b.current_volume_liters || 0).toFixed(1)}L`);
  }

  // Check barrel capacity vs typical fill
  console.log(`\n  Barrel capacity: ${vessel.capacity}L (${L2G(Number(vessel.capacity))} gal)`);
  console.log(`  A 190L top-off into a 225L barrel implies it was ~35L full beforehand (if filled to capacity).`);
  console.log(`  Or it was empty and 190L was a partial fill (84% of capacity).`);

  await c.end();
  console.log("\n\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  c.end();
  process.exit(1);
});
