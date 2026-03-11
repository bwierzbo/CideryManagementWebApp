import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Investigate all brandy-related data in the cidery database:
 * 1. Brandy production batches (product_type = 'brandy')
 * 2. Distillation records (cider sent → brandy received)
 * 3. Brandy usage (merges into pommeau, spirit additions)
 * 4. Batch compositions with source_type = 'brandy'
 * 5. Remaining brandy volumes
 */
async function main() {
  console.log("=".repeat(80));
  console.log("BRANDY INVENTORY INVESTIGATION");
  console.log("=".repeat(80));

  // ───────────────────────────────────────────────────────────────────────────
  // 1. BRANDY BATCHES
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(80));
  console.log("1. BRANDY BATCHES (product_type = 'brandy')");
  console.log("─".repeat(80));

  const brandyBatches = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.batch_number,
      b.product_type,
      b.status,
      CAST(b.initial_volume AS NUMERIC) AS initial_volume,
      b.initial_volume_unit,
      CAST(b.initial_volume_liters AS NUMERIC) AS initial_volume_liters,
      CAST(b.current_volume AS NUMERIC) AS current_volume,
      b.current_volume_unit,
      CAST(b.current_volume_liters AS NUMERIC) AS current_volume_liters,
      CAST(b.actual_abv AS NUMERIC) AS actual_abv,
      CAST(b.estimated_abv AS NUMERIC) AS estimated_abv,
      b.start_date,
      b.end_date,
      b.parent_batch_id,
      b.reconciliation_status,
      b.reconciliation_notes,
      b.fermentation_stage,
      b.is_archived,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.product_type = 'brandy'
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `);

  if (brandyBatches.rows.length === 0) {
    console.log("  No brandy batches found.");
  } else {
    console.log(`  Found ${brandyBatches.rows.length} brandy batch(es):\n`);
    for (const row of brandyBatches.rows as any[]) {
      console.log(`  Batch: ${row.custom_name || row.name} (${row.batch_number})`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Status: ${row.status} | Recon: ${row.reconciliation_status}`);
      console.log(`    Initial Volume: ${row.initial_volume} ${row.initial_volume_unit} (${row.initial_volume_liters} L)`);
      console.log(`    Current Volume: ${row.current_volume} ${row.current_volume_unit} (${row.current_volume_liters} L)`);
      console.log(`    ABV: actual=${row.actual_abv || "N/A"}, estimated=${row.estimated_abv || "N/A"}`);
      console.log(`    Vessel: ${row.vessel_name || "None"}`);
      console.log(`    Start: ${row.start_date} | End: ${row.end_date || "ongoing"}`);
      console.log(`    Fermentation Stage: ${row.fermentation_stage}`);
      console.log(`    Parent Batch: ${row.parent_batch_id || "None"}`);
      console.log(`    Archived: ${row.is_archived}`);
      if (row.reconciliation_notes) {
        console.log(`    Recon Notes: ${row.reconciliation_notes}`);
      }
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. POMMEAU BATCHES (likely brandy consumers)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("2. POMMEAU BATCHES (product_type = 'pommeau')");
  console.log("─".repeat(80));

  const pommeauBatches = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.batch_number,
      b.status,
      CAST(b.initial_volume AS NUMERIC) AS initial_volume,
      b.initial_volume_unit,
      CAST(b.initial_volume_liters AS NUMERIC) AS initial_volume_liters,
      CAST(b.current_volume AS NUMERIC) AS current_volume,
      b.current_volume_unit,
      CAST(b.current_volume_liters AS NUMERIC) AS current_volume_liters,
      CAST(b.actual_abv AS NUMERIC) AS actual_abv,
      CAST(b.estimated_abv AS NUMERIC) AS estimated_abv,
      b.start_date,
      b.parent_batch_id,
      b.reconciliation_status,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.product_type = 'pommeau'
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `);

  if (pommeauBatches.rows.length === 0) {
    console.log("  No pommeau batches found.");
  } else {
    console.log(`  Found ${pommeauBatches.rows.length} pommeau batch(es):\n`);
    for (const row of pommeauBatches.rows as any[]) {
      console.log(`  Batch: ${row.custom_name || row.name} (${row.batch_number})`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Status: ${row.status} | Recon: ${row.reconciliation_status}`);
      console.log(`    Initial Volume: ${row.initial_volume} ${row.initial_volume_unit} (${row.initial_volume_liters} L)`);
      console.log(`    Current Volume: ${row.current_volume} ${row.current_volume_unit} (${row.current_volume_liters} L)`);
      console.log(`    ABV: actual=${row.actual_abv || "N/A"}, estimated=${row.estimated_abv || "N/A"}`);
      console.log(`    Vessel: ${row.vessel_name || "None"}`);
      console.log(`    Start: ${row.start_date}`);
      console.log(`    Parent Batch: ${row.parent_batch_id || "None"}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DISTILLATION RECORDS
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("3. DISTILLATION RECORDS (cider → brandy)");
  console.log("─".repeat(80));

  const distRecords = await db.execute(sql`
    SELECT
      dr.id,
      dr.status,
      dr.distillery_name,
      dr.distillery_permit_number,
      -- Source (cider sent)
      dr.source_batch_id,
      sb.name AS source_batch_name,
      sb.custom_name AS source_batch_custom_name,
      sb.product_type AS source_product_type,
      CAST(dr.source_volume AS NUMERIC) AS source_volume,
      dr.source_volume_unit,
      CAST(dr.source_volume_liters AS NUMERIC) AS source_volume_liters,
      CAST(dr.source_abv AS NUMERIC) AS source_abv,
      dr.sent_at,
      dr.tib_outbound_number,
      -- Result (brandy received)
      dr.result_batch_id,
      rb.name AS result_batch_name,
      rb.custom_name AS result_batch_custom_name,
      CAST(dr.received_volume AS NUMERIC) AS received_volume,
      dr.received_volume_unit,
      CAST(dr.received_volume_liters AS NUMERIC) AS received_volume_liters,
      CAST(dr.received_abv AS NUMERIC) AS received_abv,
      dr.received_at,
      dr.tib_inbound_number,
      -- Proof gallons
      CAST(dr.proof_gallons_sent AS NUMERIC) AS proof_gallons_sent,
      CAST(dr.proof_gallons_received AS NUMERIC) AS proof_gallons_received,
      dr.notes
    FROM distillation_records dr
    LEFT JOIN batches sb ON sb.id = dr.source_batch_id
    LEFT JOIN batches rb ON rb.id = dr.result_batch_id
    WHERE dr.deleted_at IS NULL
    ORDER BY dr.sent_at
  `);

  if (distRecords.rows.length === 0) {
    console.log("  No distillation records found.");
  } else {
    console.log(`  Found ${distRecords.rows.length} distillation record(s):\n`);
    for (const row of distRecords.rows as any[]) {
      console.log(`  Record ID: ${row.id} | Status: ${row.status}`);
      console.log(`    Distillery: ${row.distillery_name} (Permit: ${row.distillery_permit_number || "N/A"})`);
      console.log(`    --- OUTBOUND (cider sent) ---`);
      console.log(`      Source Batch: ${row.source_batch_custom_name || row.source_batch_name} (type: ${row.source_product_type})`);
      console.log(`      Volume: ${row.source_volume} ${row.source_volume_unit} (${row.source_volume_liters} L)`);
      console.log(`      ABV: ${row.source_abv || "N/A"} | Proof Gallons: ${row.proof_gallons_sent || "N/A"}`);
      console.log(`      Sent: ${row.sent_at} | TIB#: ${row.tib_outbound_number || "N/A"}`);
      console.log(`    --- INBOUND (brandy received) ---`);
      if (row.result_batch_id) {
        console.log(`      Result Batch: ${row.result_batch_custom_name || row.result_batch_name}`);
        console.log(`      Volume: ${row.received_volume} ${row.received_volume_unit} (${row.received_volume_liters} L)`);
        console.log(`      ABV: ${row.received_abv || "N/A"} | Proof Gallons: ${row.proof_gallons_received || "N/A"}`);
        console.log(`      Received: ${row.received_at} | TIB#: ${row.tib_inbound_number || "N/A"}`);
      } else {
        console.log(`      Not yet received (pending)`);
      }
      if (row.notes) console.log(`    Notes: ${row.notes}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. BRANDY USAGE - Batch Compositions with source_type = 'brandy'
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("4. BATCH COMPOSITIONS WITH source_type = 'brandy'");
  console.log("─".repeat(80));

  const brandyComps = await db.execute(sql`
    SELECT
      bc.id,
      bc.batch_id,
      b.name AS batch_name,
      b.custom_name AS batch_custom_name,
      b.product_type AS batch_product_type,
      bc.source_type,
      CAST(bc.juice_volume AS NUMERIC) AS juice_volume,
      bc.juice_volume_unit,
      CAST(bc.material_cost AS NUMERIC) AS material_cost,
      CAST(bc.abv AS NUMERIC) AS abv,
      CAST(bc.fraction_of_batch AS NUMERIC) AS fraction_of_batch,
      v.name AS vendor_name,
      bc.lot_code,
      bc.created_at
    FROM batch_compositions bc
    JOIN batches b ON b.id = bc.batch_id
    LEFT JOIN vendors v ON v.id = bc.vendor_id
    WHERE bc.source_type = 'brandy'
      AND bc.deleted_at IS NULL
    ORDER BY bc.created_at
  `);

  if (brandyComps.rows.length === 0) {
    console.log("  No brandy compositions found.");
  } else {
    console.log(`  Found ${brandyComps.rows.length} brandy composition(s):\n`);
    for (const row of brandyComps.rows as any[]) {
      console.log(`  Batch: ${row.batch_custom_name || row.batch_name} (type: ${row.batch_product_type})`);
      console.log(`    Source: ${row.source_type} | Vendor: ${row.vendor_name || "N/A"}`);
      console.log(`    Volume: ${row.juice_volume} ${row.juice_volume_unit}`);
      console.log(`    ABV: ${row.abv || "N/A"} | Fraction: ${row.fraction_of_batch || "N/A"}`);
      console.log(`    Cost: $${row.material_cost}`);
      console.log(`    Lot Code: ${row.lot_code || "N/A"}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. BRANDY USAGE - Merge history (brandy merged into other batches)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("5. MERGE HISTORY INVOLVING BRANDY BATCHES");
  console.log("─".repeat(80));

  // Get all brandy batch IDs first
  const brandyIds = (brandyBatches.rows as any[]).map((r) => r.id);

  if (brandyIds.length === 0) {
    console.log("  No brandy batches exist, so no merges to check.");
  } else {
    // Check merges where brandy was the source (brandy → pommeau)
    const brandyMerges = await db.execute(sql`
      SELECT
        bmh.id,
        bmh.target_batch_id,
        tb.name AS target_batch_name,
        tb.custom_name AS target_batch_custom_name,
        tb.product_type AS target_product_type,
        bmh.source_batch_id,
        sb.name AS source_batch_name,
        sb.custom_name AS source_batch_custom_name,
        sb.product_type AS source_product_type,
        bmh.source_type,
        CAST(bmh.volume_added AS NUMERIC) AS volume_added,
        bmh.volume_added_unit,
        CAST(bmh.target_volume_before AS NUMERIC) AS target_volume_before,
        CAST(bmh.target_volume_after AS NUMERIC) AS target_volume_after,
        CAST(bmh.source_abv AS NUMERIC) AS source_abv,
        CAST(bmh.resulting_abv AS NUMERIC) AS resulting_abv,
        bmh.merged_at,
        bmh.notes
      FROM batch_merge_history bmh
      LEFT JOIN batches tb ON tb.id = bmh.target_batch_id
      LEFT JOIN batches sb ON sb.id = bmh.source_batch_id
      WHERE bmh.deleted_at IS NULL
        AND (
          sb.product_type = 'brandy'
          OR tb.product_type = 'brandy'
          OR tb.product_type = 'pommeau'
        )
      ORDER BY bmh.merged_at
    `);

    if (brandyMerges.rows.length === 0) {
      console.log("  No merge history involving brandy or pommeau batches.");
    } else {
      console.log(`  Found ${brandyMerges.rows.length} merge(s):\n`);
      for (const row of brandyMerges.rows as any[]) {
        console.log(`  Merge at: ${row.merged_at}`);
        console.log(`    Source: ${row.source_batch_custom_name || row.source_batch_name || "press run/juice"} (type: ${row.source_product_type || row.source_type})`);
        console.log(`    → Target: ${row.target_batch_custom_name || row.target_batch_name} (type: ${row.target_product_type})`);
        console.log(`    Volume Added: ${row.volume_added} ${row.volume_added_unit}`);
        console.log(`    Target Before: ${row.target_volume_before} → After: ${row.target_volume_after}`);
        console.log(`    Source ABV: ${row.source_abv || "N/A"} → Resulting ABV: ${row.resulting_abv || "N/A"}`);
        if (row.notes) console.log(`    Notes: ${row.notes}`);
        console.log();
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. TRANSFERS INVOLVING BRANDY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("6. TRANSFERS INVOLVING BRANDY BATCHES");
  console.log("─".repeat(80));

  const brandyTransfers = await db.execute(sql`
    SELECT
      bt.id,
      bt.source_batch_id,
      sb.name AS source_name,
      sb.custom_name AS source_custom_name,
      sb.product_type AS source_type,
      bt.destination_batch_id,
      db2.name AS dest_name,
      db2.custom_name AS dest_custom_name,
      db2.product_type AS dest_type,
      CAST(bt.volume_transferred AS NUMERIC) AS volume_transferred,
      CAST(bt.loss AS NUMERIC) AS loss,
      bt.transferred_at,
      bt.notes
    FROM batch_transfers bt
    LEFT JOIN batches sb ON sb.id = bt.source_batch_id
    LEFT JOIN batches db2 ON db2.id = bt.destination_batch_id
    WHERE bt.deleted_at IS NULL
      AND (sb.product_type IN ('brandy', 'pommeau') OR db2.product_type IN ('brandy', 'pommeau'))
    ORDER BY bt.transferred_at
  `);

  if (brandyTransfers.rows.length === 0) {
    console.log("  No transfers involving brandy/pommeau batches.");
  } else {
    console.log(`  Found ${brandyTransfers.rows.length} transfer(s):\n`);
    for (const row of brandyTransfers.rows as any[]) {
      console.log(`  Transfer at: ${row.transferred_at}`);
      console.log(`    From: ${row.source_custom_name || row.source_name} (${row.source_type})`);
      console.log(`    To:   ${row.dest_custom_name || row.dest_name} (${row.dest_type})`);
      console.log(`    Volume: ${row.volume_transferred} L | Loss: ${row.loss || 0} L`);
      if (row.notes) console.log(`    Notes: ${row.notes}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. BARREL CONTENTS HISTORY mentioning brandy
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("7. BARREL CONTENTS HISTORY (contents_type = 'brandy')");
  console.log("─".repeat(80));

  const barrelBrandy = await db.execute(sql`
    SELECT
      bch.id,
      bch.vessel_id,
      v.name AS vessel_name,
      bch.contents_type,
      bch.contents_description,
      bch.started_at,
      bch.ended_at,
      bch.source,
      bch.batch_id,
      b.name AS batch_name,
      b.custom_name AS batch_custom_name,
      bch.tasting_notes,
      bch.flavor_impact
    FROM barrel_contents_history bch
    LEFT JOIN vessels v ON v.id = bch.vessel_id
    LEFT JOIN batches b ON b.id = bch.batch_id
    WHERE bch.contents_type ILIKE '%brandy%'
    ORDER BY bch.started_at
  `);

  if (barrelBrandy.rows.length === 0) {
    console.log("  No barrel contents history with brandy.");
  } else {
    console.log(`  Found ${barrelBrandy.rows.length} barrel entry(ies):\n`);
    for (const row of barrelBrandy.rows as any[]) {
      console.log(`  Vessel: ${row.vessel_name} | Type: ${row.contents_type}`);
      console.log(`    Description: ${row.contents_description || "N/A"}`);
      console.log(`    Period: ${row.started_at} → ${row.ended_at || "present"}`);
      console.log(`    Source: ${row.source} | Batch: ${row.batch_custom_name || row.batch_name || "N/A"}`);
      if (row.tasting_notes) console.log(`    Tasting: ${row.tasting_notes}`);
      if (row.flavor_impact) console.log(`    Flavor Impact: ${row.flavor_impact}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. PACKAGING (bottling/kegging) OF BRANDY AND POMMEAU
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("8. PACKAGING OF BRANDY/POMMEAU BATCHES");
  console.log("─".repeat(80));

  const brandyBottling = await db.execute(sql`
    SELECT
      br.id,
      br.batch_id,
      b.name AS batch_name,
      b.custom_name AS batch_custom_name,
      b.product_type,
      CAST(br.volume_taken_liters AS NUMERIC) AS volume_taken_liters,
      CAST(br.loss AS NUMERIC) AS loss,
      br.packaged_at,
      br.status,
      br.voided_at,
      br.production_notes
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    WHERE b.product_type IN ('brandy', 'pommeau')
      AND br.voided_at IS NULL
    ORDER BY br.packaged_at
  `);

  if (brandyBottling.rows.length === 0) {
    console.log("  No bottling runs for brandy/pommeau.");
  } else {
    console.log(`  Found ${brandyBottling.rows.length} bottle run(s):\n`);
    for (const row of brandyBottling.rows as any[]) {
      console.log(`  Bottle Run: ${row.batch_custom_name || row.batch_name} (${row.product_type})`);
      console.log(`    Volume: ${row.volume_taken_liters} L | Loss: ${row.loss || 0} L`);
      console.log(`    Date: ${row.packaged_at} | Status: ${row.status}`);
      if (row.production_notes) console.log(`    Notes: ${row.production_notes}`);
      console.log();
    }
  }

  const brandyKegging = await db.execute(sql`
    SELECT
      kf.id,
      kf.batch_id,
      b.name AS batch_name,
      b.custom_name AS batch_custom_name,
      b.product_type,
      CAST(kf.volume_taken AS NUMERIC) AS volume_taken,
      CAST(kf.loss AS NUMERIC) AS loss,
      kf.filled_at,
      kf.voided_at,
      kf.deleted_at,
      kf.production_notes
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id
    WHERE b.product_type IN ('brandy', 'pommeau')
      AND kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
    ORDER BY kf.filled_at
  `);

  if (brandyKegging.rows.length === 0) {
    console.log("  No keg fills for brandy/pommeau.");
  } else {
    console.log(`  Found ${brandyKegging.rows.length} keg fill(s):\n`);
    for (const row of brandyKegging.rows as any[]) {
      console.log(`  Keg Fill: ${row.batch_custom_name || row.batch_name} (${row.product_type})`);
      console.log(`    Volume: ${row.volume_taken} L | Loss: ${row.loss || 0} L`);
      console.log(`    Date: ${row.filled_at}`);
      if (row.production_notes) console.log(`    Notes: ${row.production_notes}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9. VOLUME ADJUSTMENTS ON BRANDY/POMMEAU BATCHES
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─".repeat(80));
  console.log("9. VOLUME ADJUSTMENTS ON BRANDY/POMMEAU BATCHES");
  console.log("─".repeat(80));

  const brandyAdj = await db.execute(sql`
    SELECT
      bva.id,
      bva.batch_id,
      b.name AS batch_name,
      b.custom_name AS batch_custom_name,
      b.product_type,
      bva.adjustment_type,
      CAST(bva.adjustment_amount AS NUMERIC) AS adjustment_amount,
      bva.notes,
      bva.created_at
    FROM batch_volume_adjustments bva
    JOIN batches b ON b.id = bva.batch_id
    WHERE b.product_type IN ('brandy', 'pommeau')
      AND bva.deleted_at IS NULL
    ORDER BY bva.created_at
  `);

  if (brandyAdj.rows.length === 0) {
    console.log("  No volume adjustments on brandy/pommeau batches.");
  } else {
    console.log(`  Found ${brandyAdj.rows.length} adjustment(s):\n`);
    for (const row of brandyAdj.rows as any[]) {
      console.log(`  ${row.batch_custom_name || row.batch_name} (${row.product_type})`);
      console.log(`    Type: ${row.adjustment_type} | Amount: ${row.adjustment_amount} L`);
      console.log(`    Date: ${row.created_at}`);
      if (row.notes) console.log(`    Notes: ${row.notes}`);
      console.log();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 10. SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const brandyTotal = (brandyBatches.rows as any[]).reduce(
    (sum: number, r: any) => sum + parseFloat(r.current_volume_liters || "0"),
    0,
  );
  const pommeauTotal = (pommeauBatches.rows as any[]).reduce(
    (sum: number, r: any) => sum + parseFloat(r.current_volume_liters || "0"),
    0,
  );

  console.log(`  Brandy batches:      ${brandyBatches.rows.length}`);
  console.log(`  Brandy volume on hand: ${brandyTotal.toFixed(1)} L (${(brandyTotal * 0.2642).toFixed(1)} gal)`);
  console.log(`  Pommeau batches:     ${pommeauBatches.rows.length}`);
  console.log(`  Pommeau volume on hand: ${pommeauTotal.toFixed(1)} L (${(pommeauTotal * 0.2642).toFixed(1)} gal)`);
  console.log(`  Distillation records: ${distRecords.rows.length}`);
  console.log(`  Brandy compositions:  ${brandyComps.rows.length}`);
  console.log(`  Brandy/Pommeau merges: ${brandyTransfers.rows.length > 0 ? "see section 5" : "0"}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
