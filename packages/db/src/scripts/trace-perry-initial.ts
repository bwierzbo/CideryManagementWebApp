import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(2);

async function main() {
  await c.connect();

  const batchId = "4fd3bb0a-de9c-419e-88dd-01fad55431d8"; // Original Perry Perry #2

  // 1. Batch details
  const batch = await c.query(
    `SELECT name, initial_volume_liters, initial_volume, initial_volume_unit,
            current_volume_liters, current_volume, transfer_loss_l,
            origin_press_run_id, vessel_id, start_date, created_at
     FROM batches WHERE id = $1`,
    [batchId]
  );
  const b = batch.rows[0];
  console.log("=== Perry Perry #2 Original Batch ===");
  console.log(`  Name: ${b.name}`);
  console.log(`  Start: ${b.start_date}`);
  console.log(`  Created: ${b.created_at}`);
  console.log(`  Initial Volume: ${b.initial_volume} ${b.initial_volume_unit}`);
  console.log(`  Initial Volume Liters: ${b.initial_volume_liters}`);
  console.log(`  Current Volume: ${b.current_volume}`);
  console.log(`  Current Volume Liters: ${b.current_volume_liters}`);
  console.log(`  Transfer Loss L: ${b.transfer_loss_l}`);
  console.log(`  Origin Press Run: ${b.origin_press_run_id || "NONE"}`);
  console.log(`  Vessel: ${b.vessel_id || "NONE"}`);

  // 2. Check vessel capacity
  if (b.vessel_id) {
    const vessel = await c.query(
      `SELECT name, capacity_liters FROM vessels WHERE id = $1`,
      [b.vessel_id]
    );
    if (vessel.rows[0]) {
      console.log(`  Vessel Name: ${vessel.rows[0].name}`);
      console.log(`  Vessel Capacity: ${vessel.rows[0].capacity_liters} L (${G(parseFloat(vessel.rows[0].capacity_liters))} gal)`);
    }
  }

  // 3. If from a press run, trace it
  if (b.origin_press_run_id) {
    const pr = await c.query(
      `SELECT id, press_run_name, total_juice_volume_liters, date_completed, status
       FROM press_runs WHERE id = $1`,
      [b.origin_press_run_id]
    );
    if (pr.rows[0]) {
      const p = pr.rows[0];
      console.log(`\n=== Origin Press Run ===`);
      console.log(`  Name: ${p.press_run_name}`);
      console.log(`  Date: ${p.date_completed}`);
      console.log(`  Total Juice: ${p.total_juice_volume_liters} L (${G(parseFloat(p.total_juice_volume_liters))} gal)`);

      // All batches from this press run
      const siblings = await c.query(
        `SELECT id, name, initial_volume_liters, transfer_loss_l, vessel_id
         FROM batches WHERE origin_press_run_id = $1 AND deleted_at IS NULL
         ORDER BY name`,
        [b.origin_press_run_id]
      );
      console.log(`\n  Batches from this press run:`);
      let totalInit = 0, totalTL = 0;
      for (const s of siblings.rows) {
        const si = parseFloat(s.initial_volume_liters || "0");
        const stl = parseFloat(s.transfer_loss_l || "0");
        totalInit += si;
        totalTL += stl;
        const marker = s.id === batchId ? " <-- THIS ONE" : "";
        console.log(`    ${s.name}: init=${si}L TL=${stl}L${marker}`);
      }
      console.log(`  Total init: ${totalInit.toFixed(1)}L, Total TL: ${totalTL.toFixed(2)}L`);
      console.log(`  Press total: ${p.total_juice_volume_liters}L`);
    }
  }

  // 4. Check merge history - was juice added to this batch?
  const merges = await c.query(
    `SELECT volume_added, source_type, notes, merged_at,
            target_volume_before, target_volume_after,
            source_press_run_id, source_batch_id, source_juice_purchase_item_id
     FROM batch_merge_history
     WHERE target_batch_id = $1 AND deleted_at IS NULL
     ORDER BY merged_at`,
    [batchId]
  );
  if (merges.rows.length > 0) {
    console.log(`\n=== Merge History (juice additions into this batch) ===`);
    for (const m of merges.rows) {
      console.log(`  ${m.merged_at} type=${m.source_type} vol=${m.volume_added}L`);
      console.log(`    before=${m.target_volume_before}L after=${m.target_volume_after}L`);
      console.log(`    notes: ${m.notes}`);
      if (m.source_press_run_id) {
        const spr = await c.query(
          `SELECT press_run_name, total_juice_volume_liters FROM press_runs WHERE id = $1`,
          [m.source_press_run_id]
        );
        if (spr.rows[0]) console.log(`    source press run: ${spr.rows[0].press_run_name} (${spr.rows[0].total_juice_volume_liters}L total)`);
      }
    }
  } else {
    console.log(`\n  No merge history found.`);
  }

  // 5. Check volume adjustments
  const adjs = await c.query(
    `SELECT adjustment_amount, adjustment_date, reason
     FROM batch_volume_adjustments WHERE batch_id = $1 AND deleted_at IS NULL
     ORDER BY adjustment_date`,
    [batchId]
  );
  if (adjs.rows.length > 0) {
    console.log(`\n=== Volume Adjustments ===`);
    for (const a of adjs.rows) {
      console.log(`  ${a.adjustment_date} amount=${a.adjustment_amount}L reason="${a.reason}"`);
    }
  } else {
    console.log(`  No volume adjustments.`);
  }

  // 6. Audit log for this batch (creation and volume changes)
  const audits = await c.query(
    `SELECT action, changes, created_at
     FROM audit_logs WHERE entity_id = $1
     ORDER BY created_at LIMIT 10`,
    [batchId]
  );
  if (audits.rows.length > 0) {
    console.log(`\n=== Audit Log ===`);
    for (const a of audits.rows) {
      const changes = typeof a.changes === 'string' ? JSON.parse(a.changes) : a.changes;
      // Only show relevant fields
      const relevant: Record<string, any> = {};
      for (const [k, v] of Object.entries(changes || {})) {
        if (k.includes('volume') || k.includes('initial') || k.includes('current') || k === 'vessel_id') {
          relevant[k] = v;
        }
      }
      if (Object.keys(relevant).length > 0) {
        console.log(`  ${a.created_at} ${a.action}: ${JSON.stringify(relevant)}`);
      } else {
        console.log(`  ${a.created_at} ${a.action}`);
      }
    }
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
