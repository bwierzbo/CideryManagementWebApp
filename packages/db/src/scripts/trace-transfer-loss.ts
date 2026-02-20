import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(3);

async function main() {
  await c.connect();

  const batchId = "bb7d438a-4d0d-4030-ac75-14e1d5ef137c"; // OBC Cider #2

  // 1. Get batch details
  const batch = await c.query(
    `SELECT name, initial_volume_liters, current_volume_liters, transfer_loss_l,
            transfer_loss_notes, origin_press_run_id, start_date
     FROM batches WHERE id = $1`,
    [batchId]
  );
  const b = batch.rows[0];
  const init = parseFloat(b.initial_volume_liters || "0");
  const tl = parseFloat(b.transfer_loss_l || "0");
  console.log("=== OBC Cider #2 Batch ===");
  console.log(`  Name: ${b.name}`);
  console.log(`  Start: ${b.start_date}`);
  console.log(`  Initial: ${init} L (${G(init)} gal)`);
  console.log(`  Transfer Loss: ${tl} L (${G(tl)} gal)`);
  console.log(`  Transfer Loss Notes: ${b.transfer_loss_notes || "none"}`);
  console.log(`  Gross (init + loss): ${(init + tl).toFixed(1)} L (${G(init + tl)} gal)`);
  console.log(`  Origin Press Run ID: ${b.origin_press_run_id || "none"}`);

  // 2. Get the press run
  if (b.origin_press_run_id) {
    const pr = await c.query(
      `SELECT pr.id, pr.total_juice_volume_liters, pr.date_completed, pr.status,
              pr.press_run_name
       FROM press_runs pr WHERE pr.id = $1`,
      [b.origin_press_run_id]
    );
    if (pr.rows.length > 0) {
      const p = pr.rows[0];
      console.log(`\n=== Press Run ===`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Name: ${p.press_run_name}`);
      console.log(`  Date: ${p.date_completed}`);
      console.log(`  Total Juice: ${p.total_juice_volume_liters} L (${G(parseFloat(p.total_juice_volume_liters))} gal)`);

      // 3. Get ALL batches created from this press run
      const siblings = await c.query(
        `SELECT id, name, initial_volume_liters, transfer_loss_l, vessel_id
         FROM batches WHERE origin_press_run_id = $1 AND deleted_at IS NULL
         ORDER BY name`,
        [b.origin_press_run_id]
      );
      console.log(`\n=== Batches from this press run ===`);
      let totalInit = 0, totalTL = 0;
      for (const s of siblings.rows) {
        const si = parseFloat(s.initial_volume_liters || "0");
        const stl = parseFloat(s.transfer_loss_l || "0");
        totalInit += si;
        totalTL += stl;
        console.log(`  ${s.name}: init=${si}L (${G(si)}gal), TL=${stl}L (${G(stl)}gal), gross=${(si+stl).toFixed(1)}L`);
      }
      console.log(`  TOTAL: init=${totalInit.toFixed(1)}L, TL=${totalTL.toFixed(2)}L, gross=${(totalInit+totalTL).toFixed(1)}L`);
      console.log(`  Press run total: ${p.total_juice_volume_liters}L`);
      console.log(`  Accounted (init+TL): ${(totalInit+totalTL).toFixed(1)}L`);
      console.log(`  Unaccounted: ${(parseFloat(p.total_juice_volume_liters) - totalInit - totalTL).toFixed(2)}L`);
    }
  }

  // 4. Get merge history entries for this batch (juice additions from press runs)
  const merges = await c.query(
    `SELECT bmh.volume_added, bmh.source_type, bmh.notes, bmh.merged_at,
            bmh.target_volume_before, bmh.target_volume_after
     FROM batch_merge_history bmh
     WHERE bmh.target_batch_id = $1 AND bmh.deleted_at IS NULL
     ORDER BY bmh.merged_at`,
    [batchId]
  );
  if (merges.rows.length > 0) {
    console.log(`\n=== Merge History (juice additions) ===`);
    for (const m of merges.rows) {
      console.log(`  ${m.merged_at} type=${m.source_type} vol=${m.volume_added}L before=${m.target_volume_before}L after=${m.target_volume_after}L`);
      console.log(`    notes: ${m.notes}`);
    }
  }

  // 5. Summary
  console.log(`\n=== WHERE IS THE 0.08 GAL? ===`);
  console.log(`Press run produced GROSS volume (includes all batches + losses)`);
  console.log(`When juice was pumped from press to CARBOY-6G-3:`);
  console.log(`  Gross volume assigned to this vessel: ${(init + tl).toFixed(1)} L (${G(init + tl)} gal)`);
  console.log(`  Transfer loss during pumping:         ${tl.toFixed(2)} L (${G(tl)} gal)`);
  console.log(`  Net volume in batch (initial):        ${init.toFixed(1)} L (${G(init)} gal)`);
  console.log(`\nTTB side: production = gross press run volume; loss = transfer_loss_l`);
  console.log(`System side: batch initial = net (already reduced by transfer loss)`);
  console.log(`Both sides net to the same amount. The loss IS accounted for.`);

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
