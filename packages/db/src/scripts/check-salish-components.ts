import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Check the composition of the two Salish 2025 pommeau batches.
 * Pommeau = apple brandy blended with juice/cider.
 *
 * Queries:
 * 1. Find the two Salish 2025 batches by name/product_type
 * 2. All batch_merge_history rows (3 source types: batch, press_run, juice_purchase)
 * 3. All batch_transfers where these batches are source or destination
 * 4. Source batch/press_run/juice_purchase details for each component
 */

const G = (l: number) => (l / 3.78541).toFixed(2);

async function main() {
  console.log("=== Salish 2025 Pommeau Component Analysis ===\n");

  // 1. Find the two Salish 2025 pommeau batches
  console.log("--- 1. FINDING SALISH 2025 POMMEAU BATCHES ---");
  const batchResult = await db.execute(sql.raw(`
    SELECT id, custom_name, batch_number, product_type,
           CAST(initial_volume_liters AS NUMERIC) as initial_l,
           CAST(current_volume_liters AS NUMERIC) as current_l,
           start_date, vessel_id, parent_batch_id,
           reconciliation_status, is_racking_derivative, deleted_at
    FROM batches
    WHERE (custom_name ILIKE '%salish%2025%' OR custom_name ILIKE '%salish 2025%')
      AND product_type = 'pommeau'
    ORDER BY start_date
  `));
  const batches = batchResult.rows as any[];

  if (batches.length === 0) {
    // Fallback: search more broadly
    console.log("  No exact match. Trying broader search...");
    const fallback = await db.execute(sql.raw(`
      SELECT id, custom_name, batch_number, product_type,
             CAST(initial_volume_liters AS NUMERIC) as initial_l,
             CAST(current_volume_liters AS NUMERIC) as current_l,
             start_date, vessel_id, parent_batch_id,
             reconciliation_status, is_racking_derivative, deleted_at
      FROM batches
      WHERE product_type = 'pommeau'
        AND deleted_at IS NULL
      ORDER BY start_date
    `));
    const fb = fallback.rows as any[];
    console.log(`  Found ${fb.length} pommeau batches total:`);
    for (const b of fb) {
      console.log(`    ${b.custom_name || b.batch_number} | ID: ${b.id} | initial: ${parseFloat(b.initial_l).toFixed(1)}L | current: ${parseFloat(b.current_l).toFixed(1)}L | start: ${b.start_date}`);
    }
    if (fb.length === 0) {
      console.log("  No pommeau batches found at all.");
      process.exit(0);
    }
    // Use all pommeau batches for analysis
    batches.push(...fb);
  }

  console.log(`\n  Found ${batches.length} Salish 2025 pommeau batch(es):\n`);
  for (const b of batches) {
    console.log(`  Batch: ${b.custom_name || b.batch_number}`);
    console.log(`    ID:            ${b.id}`);
    console.log(`    Batch#:        ${b.batch_number}`);
    console.log(`    Product Type:  ${b.product_type}`);
    console.log(`    Initial Vol:   ${parseFloat(b.initial_l).toFixed(2)} L (${G(parseFloat(b.initial_l))} gal)`);
    console.log(`    Current Vol:   ${parseFloat(b.current_l).toFixed(2)} L (${G(parseFloat(b.current_l))} gal)`);
    console.log(`    Start Date:    ${b.start_date}`);
    console.log(`    Vessel ID:     ${b.vessel_id}`);
    console.log(`    Parent Batch:  ${b.parent_batch_id || "(none)"}`);
    console.log(`    Recon Status:  ${b.reconciliation_status}`);
    console.log(`    Racking Deriv: ${b.is_racking_derivative}`);
    console.log(`    Deleted:       ${b.deleted_at || "no"}`);
    console.log("");
  }

  // Get vessel names for context
  const vesselIds = batches.map((b: any) => b.vessel_id).filter(Boolean);
  if (vesselIds.length > 0) {
    const vesselResult = await db.execute(sql.raw(`
      SELECT id, name FROM vessels WHERE id IN (${vesselIds.map((v: string) => `'${v}'`).join(",")})
    `));
    const vessels = vesselResult.rows as any[];
    console.log("  Vessels:");
    for (const v of vessels) {
      console.log(`    ${v.id} => ${v.name}`);
    }
    console.log("");
  }

  // Now analyze each batch
  for (const batch of batches) {
    const bId = batch.id;
    const bName = batch.custom_name || batch.batch_number;

    console.log("=".repeat(80));
    console.log(`ANALYZING: ${bName} [${bId}]`);
    console.log("=".repeat(80));

    // 2. Merge history as TARGET (components blended INTO this batch)
    console.log(`\n--- MERGES IN (batch_merge_history where target_batch_id = this) ---`);
    const mergesIn = await db.execute(sql.raw(`
      SELECT bmh.id, bmh.source_batch_id, bmh.source_press_run_id, bmh.source_juice_purchase_item_id,
             bmh.source_type,
             CAST(bmh.volume_added AS NUMERIC) as volume_added,
             CAST(bmh.target_volume_before AS NUMERIC) as vol_before,
             CAST(bmh.target_volume_after AS NUMERIC) as vol_after,
             CAST(bmh.source_abv AS NUMERIC) as source_abv,
             CAST(bmh.resulting_abv AS NUMERIC) as resulting_abv,
             bmh.notes, bmh.merged_at, bmh.deleted_at,
             bmh.composition_snapshot
      FROM batch_merge_history bmh
      WHERE bmh.target_batch_id = '${bId}'
      ORDER BY bmh.merged_at
    `));
    const miRows = mergesIn.rows as any[];

    if (miRows.length === 0) {
      console.log("  (none)");
    } else {
      for (const m of miRows) {
        const vol = parseFloat(m.volume_added);
        const deletedTag = m.deleted_at ? " [DELETED]" : "";
        console.log(`\n  Merge ${m.id}:${deletedTag}`);
        console.log(`    Source Type:      ${m.source_type}`);
        console.log(`    Volume Added:     ${vol.toFixed(2)} L (${G(vol)} gal)`);
        console.log(`    Target Before:    ${parseFloat(m.vol_before).toFixed(2)} L`);
        console.log(`    Target After:     ${parseFloat(m.vol_after).toFixed(2)} L`);
        console.log(`    Source ABV:       ${m.source_abv || "(none)"}`);
        console.log(`    Resulting ABV:    ${m.resulting_abv || "(none)"}`);
        console.log(`    Merged At:        ${m.merged_at}`);
        console.log(`    Notes:            ${m.notes || "(none)"}`);

        if (m.source_batch_id) {
          console.log(`    Source Batch ID:  ${m.source_batch_id}`);
          // Get source batch details
          const srcBatch = await db.execute(sql.raw(`
            SELECT id, custom_name, batch_number, product_type,
                   CAST(initial_volume_liters AS NUMERIC) as initial_l,
                   CAST(current_volume_liters AS NUMERIC) as current_l,
                   start_date, reconciliation_status, deleted_at
            FROM batches WHERE id = '${m.source_batch_id}'
          `));
          for (const s of srcBatch.rows as any[]) {
            console.log(`    --> Source Batch:  ${s.custom_name || s.batch_number}`);
            console.log(`        Product Type: ${s.product_type}`);
            console.log(`        Initial Vol:  ${parseFloat(s.initial_l).toFixed(2)} L (${G(parseFloat(s.initial_l))} gal)`);
            console.log(`        Current Vol:  ${parseFloat(s.current_l).toFixed(2)} L (${G(parseFloat(s.current_l))} gal)`);
            console.log(`        Start Date:   ${s.start_date}`);
            console.log(`        Recon Status: ${s.reconciliation_status}`);
            console.log(`        Deleted:      ${s.deleted_at || "no"}`);
          }
        }

        if (m.source_press_run_id) {
          console.log(`    Source Press Run: ${m.source_press_run_id}`);
          const srcPR = await db.execute(sql.raw(`
            SELECT apr.id, apr.press_date,
                   CAST(apr.total_juice_yield AS NUMERIC) as juice_yield,
                   apr.notes
            FROM apple_press_runs apr
            WHERE apr.id = '${m.source_press_run_id}'
          `));
          for (const p of srcPR.rows as any[]) {
            console.log(`    --> Press Run:     ${p.id}`);
            console.log(`        Press Date:   ${p.press_date}`);
            console.log(`        Juice Yield:  ${parseFloat(p.juice_yield || "0").toFixed(2)} L`);
            console.log(`        Notes:        ${p.notes || "(none)"}`);
          }
        }

        if (m.source_juice_purchase_item_id) {
          console.log(`    Source Juice Purchase Item: ${m.source_juice_purchase_item_id}`);
          const srcJP = await db.execute(sql.raw(`
            SELECT jpi.id, jpi.variety, CAST(jpi.volume_liters AS NUMERIC) as vol_l,
                   jpi.juice_purchase_id
            FROM juice_purchase_items jpi
            WHERE jpi.id = '${m.source_juice_purchase_item_id}'
          `));
          for (const j of srcJP.rows as any[]) {
            console.log(`    --> Juice Purchase Item: ${j.id}`);
            console.log(`        Variety:      ${j.variety}`);
            console.log(`        Volume:       ${parseFloat(j.vol_l || "0").toFixed(2)} L`);
          }
        }

        if (m.composition_snapshot) {
          console.log(`    Composition Snapshot: ${JSON.stringify(m.composition_snapshot)}`);
        }
      }
    }

    // 3. Merge history as SOURCE (volume leaving this batch to another)
    console.log(`\n--- MERGES OUT (batch_merge_history where source_batch_id = this) ---`);
    const mergesOut = await db.execute(sql.raw(`
      SELECT bmh.id, bmh.target_batch_id,
             CAST(bmh.volume_added AS NUMERIC) as volume_added,
             bmh.source_type, bmh.merged_at, bmh.deleted_at, bmh.notes
      FROM batch_merge_history bmh
      WHERE bmh.source_batch_id = '${bId}'
      ORDER BY bmh.merged_at
    `));
    const moRows = mergesOut.rows as any[];

    if (moRows.length === 0) {
      console.log("  (none)");
    } else {
      for (const m of moRows) {
        const vol = parseFloat(m.volume_added);
        const deletedTag = m.deleted_at ? " [DELETED]" : "";
        console.log(`  Merge ${m.id}:${deletedTag} ${vol.toFixed(2)} L (${G(vol)} gal) -> target batch ${m.target_batch_id}, type=${m.source_type}, at=${m.merged_at}`);
        // Get target batch name
        const tgtBatch = await db.execute(sql.raw(`
          SELECT custom_name, batch_number, product_type FROM batches WHERE id = '${m.target_batch_id}'
        `));
        for (const t of tgtBatch.rows as any[]) {
          console.log(`    --> Target: ${t.custom_name || t.batch_number} (${t.product_type})`);
        }
      }
    }

    // 4. Transfers IN (batch_transfers where destination_batch_id = this)
    console.log(`\n--- TRANSFERS IN (batch_transfers where destination_batch_id = this) ---`);
    const transfersIn = await db.execute(sql.raw(`
      SELECT bt.id, bt.source_batch_id,
             CAST(bt.volume_transferred AS NUMERIC) as vol,
             CAST(bt.loss AS NUMERIC) as loss,
             bt.transferred_at, bt.deleted_at, bt.notes
      FROM batch_transfers bt
      WHERE bt.destination_batch_id = '${bId}'
      ORDER BY bt.transferred_at
    `));
    const tiRows = transfersIn.rows as any[];

    if (tiRows.length === 0) {
      console.log("  (none)");
    } else {
      for (const t of tiRows) {
        const vol = parseFloat(t.vol);
        const loss = parseFloat(t.loss || "0");
        const deletedTag = t.deleted_at ? " [DELETED]" : "";
        console.log(`\n  Transfer ${t.id}:${deletedTag}`);
        console.log(`    Volume:       ${vol.toFixed(2)} L (${G(vol)} gal)`);
        console.log(`    Loss:         ${loss.toFixed(2)} L`);
        console.log(`    Transferred:  ${t.transferred_at}`);
        console.log(`    Notes:        ${t.notes || "(none)"}`);
        console.log(`    Source Batch:  ${t.source_batch_id}`);
        // Get source batch details
        const srcBatch = await db.execute(sql.raw(`
          SELECT id, custom_name, batch_number, product_type,
                 CAST(initial_volume_liters AS NUMERIC) as initial_l,
                 CAST(current_volume_liters AS NUMERIC) as current_l,
                 start_date, reconciliation_status, deleted_at
          FROM batches WHERE id = '${t.source_batch_id}'
        `));
        for (const s of srcBatch.rows as any[]) {
          console.log(`    --> Source:    ${s.custom_name || s.batch_number}`);
          console.log(`        Product:  ${s.product_type}`);
          console.log(`        Initial:  ${parseFloat(s.initial_l).toFixed(2)} L (${G(parseFloat(s.initial_l))} gal)`);
          console.log(`        Current:  ${parseFloat(s.current_l).toFixed(2)} L (${G(parseFloat(s.current_l))} gal)`);
          console.log(`        Start:    ${s.start_date}`);
          console.log(`        Recon:    ${s.reconciliation_status}`);
          console.log(`        Deleted:  ${s.deleted_at || "no"}`);
        }
      }
    }

    // 5. Transfers OUT (batch_transfers where source_batch_id = this)
    console.log(`\n--- TRANSFERS OUT (batch_transfers where source_batch_id = this) ---`);
    const transfersOut = await db.execute(sql.raw(`
      SELECT bt.id, bt.destination_batch_id,
             CAST(bt.volume_transferred AS NUMERIC) as vol,
             CAST(bt.loss AS NUMERIC) as loss,
             bt.transferred_at, bt.deleted_at, bt.notes
      FROM batch_transfers bt
      WHERE bt.source_batch_id = '${bId}'
      ORDER BY bt.transferred_at
    `));
    const toRows = transfersOut.rows as any[];

    if (toRows.length === 0) {
      console.log("  (none)");
    } else {
      for (const t of toRows) {
        const vol = parseFloat(t.vol);
        const loss = parseFloat(t.loss || "0");
        const deletedTag = t.deleted_at ? " [DELETED]" : "";
        console.log(`\n  Transfer ${t.id}:${deletedTag}`);
        console.log(`    Volume:       ${vol.toFixed(2)} L (${G(vol)} gal)`);
        console.log(`    Loss:         ${loss.toFixed(2)} L`);
        console.log(`    Transferred:  ${t.transferred_at}`);
        console.log(`    Notes:        ${t.notes || "(none)"}`);
        console.log(`    Dest Batch:   ${t.destination_batch_id}`);
        // Get destination batch details
        const dstBatch = await db.execute(sql.raw(`
          SELECT id, custom_name, batch_number, product_type,
                 CAST(initial_volume_liters AS NUMERIC) as initial_l,
                 CAST(current_volume_liters AS NUMERIC) as current_l,
                 reconciliation_status, deleted_at
          FROM batches WHERE id = '${t.destination_batch_id}'
        `));
        for (const d of dstBatch.rows as any[]) {
          console.log(`    --> Dest:     ${d.custom_name || d.batch_number} (${d.product_type})`);
        }
      }
    }

    // 6. Summary: component breakdown
    console.log(`\n--- COMPONENT SUMMARY FOR ${bName} ---`);

    // Active merges in (not deleted)
    const activeMergesIn = miRows.filter((m: any) => !m.deleted_at);
    const deletedMergesIn = miRows.filter((m: any) => m.deleted_at);

    // Active transfers in (not deleted)
    const activeTransfersIn = tiRows.filter((t: any) => !t.deleted_at);

    let totalBrandyL = 0;
    let totalJuiceCiderL = 0;
    let totalOtherL = 0;

    // Classify merge sources
    for (const m of activeMergesIn) {
      const vol = parseFloat(m.volume_added);
      if (m.source_batch_id) {
        // Look up the source batch product type
        const srcRes = await db.execute(sql.raw(`
          SELECT product_type FROM batches WHERE id = '${m.source_batch_id}'
        `));
        const pt = (srcRes.rows[0] as any)?.product_type || "unknown";
        if (pt === "brandy" || pt === "spirits") {
          totalBrandyL += vol;
          console.log(`  BRANDY component:  ${vol.toFixed(2)} L (${G(vol)} gal) from batch merge (${pt})`);
        } else if (pt === "cider" || pt === "juice" || pt === "perry") {
          totalJuiceCiderL += vol;
          console.log(`  JUICE/CIDER component: ${vol.toFixed(2)} L (${G(vol)} gal) from batch merge (${pt})`);
        } else {
          totalOtherL += vol;
          console.log(`  OTHER component:   ${vol.toFixed(2)} L (${G(vol)} gal) from batch merge (${pt})`);
        }
      } else if (m.source_press_run_id) {
        totalJuiceCiderL += vol;
        console.log(`  JUICE component:   ${vol.toFixed(2)} L (${G(vol)} gal) from press run`);
      } else if (m.source_juice_purchase_item_id) {
        totalJuiceCiderL += vol;
        console.log(`  JUICE component:   ${vol.toFixed(2)} L (${G(vol)} gal) from juice purchase`);
      } else {
        totalOtherL += vol;
        console.log(`  UNKNOWN component: ${vol.toFixed(2)} L (${G(vol)} gal) (no source ID)`);
      }
    }

    // Classify transfer sources
    for (const t of activeTransfersIn) {
      const vol = parseFloat(t.vol);
      if (t.source_batch_id) {
        const srcRes = await db.execute(sql.raw(`
          SELECT product_type, custom_name, batch_number FROM batches WHERE id = '${t.source_batch_id}'
        `));
        const row = srcRes.rows[0] as any;
        const pt = row?.product_type || "unknown";
        const name = row?.custom_name || row?.batch_number || "?";
        if (pt === "brandy" || pt === "spirits") {
          totalBrandyL += vol;
          console.log(`  BRANDY component:  ${vol.toFixed(2)} L (${G(vol)} gal) via transfer from "${name}" (${pt})`);
        } else if (pt === "cider" || pt === "juice" || pt === "perry") {
          totalJuiceCiderL += vol;
          console.log(`  JUICE/CIDER component: ${vol.toFixed(2)} L (${G(vol)} gal) via transfer from "${name}" (${pt})`);
        } else {
          totalOtherL += vol;
          console.log(`  OTHER component:   ${vol.toFixed(2)} L (${G(vol)} gal) via transfer from "${name}" (${pt})`);
        }
      }
    }

    const totalL = totalBrandyL + totalJuiceCiderL + totalOtherL;
    console.log(`\n  TOTALS:`);
    console.log(`    Brandy/Spirits:  ${totalBrandyL.toFixed(2)} L (${G(totalBrandyL)} gal)${totalL > 0 ? ` = ${((totalBrandyL / totalL) * 100).toFixed(1)}%` : ""}`);
    console.log(`    Juice/Cider:     ${totalJuiceCiderL.toFixed(2)} L (${G(totalJuiceCiderL)} gal)${totalL > 0 ? ` = ${((totalJuiceCiderL / totalL) * 100).toFixed(1)}%` : ""}`);
    if (totalOtherL > 0) {
      console.log(`    Other:           ${totalOtherL.toFixed(2)} L (${G(totalOtherL)} gal)${totalL > 0 ? ` = ${((totalOtherL / totalL) * 100).toFixed(1)}%` : ""}`);
    }
    console.log(`    TOTAL IN:        ${totalL.toFixed(2)} L (${G(totalL)} gal)`);
    console.log(`    Initial Vol:     ${parseFloat(batch.initial_l).toFixed(2)} L (may overlap with merges/transfers)`);
    console.log(`    Current Vol:     ${parseFloat(batch.current_l).toFixed(2)} L`);

    if (deletedMergesIn.length > 0) {
      console.log(`\n  (${deletedMergesIn.length} deleted merge(s) not counted above)`);
    }

    console.log("");
  }

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
