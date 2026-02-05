import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== INVESTIGATING 317 GAL DISCREPANCY ===\n");

  const asOfDate = "2024-12-31";

  // The discrepancy formula:
  // Accounted = Initial + Inflow - Outflow - Loss
  // Discrepancy = Current - Accounted
  //
  // We have:
  // Initial: 1099.3 gal, Inflow: 248.9 gal, Outflow: 1001.1 gal, Loss: 20.1 gal
  // Accounted: 327 gal, Current: 9.6 gal
  // Discrepancy: -317 gal (volume is MISSING)

  console.log("Question: Where did the 317 gal go?\n");

  // 1. Check transfers OUT - where did they go?
  console.log("=== 1. WHERE DID TRANSFERS GO? ===\n");

  const transferDestinations = await db.execute(sql`
    SELECT
      dest.batch_number,
      dest.custom_name,
      dest.reconciliation_status,
      dest.current_volume,
      COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as volume_received
    FROM batch_transfers bt
    INNER JOIN batches src ON bt.source_batch_id = src.id
    INNER JOIN batches dest ON bt.destination_batch_id = dest.id
    WHERE src.deleted_at IS NULL
      AND src.status != 'discarded'
      AND src.reconciliation_status = 'verified'
      AND NOT (src.batch_number LIKE 'LEGACY-%')
      AND CAST(src.initial_volume_liters AS NUMERIC) > 0
      AND src.start_date::date <= ${asOfDate}::date
      AND bt.deleted_at IS NULL
    GROUP BY dest.id, dest.batch_number, dest.custom_name, dest.reconciliation_status, dest.current_volume
    ORDER BY volume_received DESC
    LIMIT 20
  `);

  let totalToVerified = 0;
  let totalToOther = 0;
  let verifiedDestCurrent = 0;
  let otherDestCurrent = 0;

  console.log("Destinations of transfers FROM the 17 verified batches:\n");
  for (const d of transferDestinations.rows as any[]) {
    const received = Number(d.volume_received);
    const current = Number(d.current_volume || 0);
    const isVerified = d.reconciliation_status === 'verified';
    const inReport = isVerified && !d.batch_number.startsWith('LEGACY-');

    if (inReport) {
      totalToVerified += received;
      verifiedDestCurrent += current;
    } else {
      totalToOther += received;
      otherDestCurrent += current;
    }

    console.log(`  ${d.batch_number.slice(0, 40)}`);
    console.log(`    Received: ${received.toFixed(1)} L (${(received * 0.264172).toFixed(1)} gal)`);
    console.log(`    Current: ${current.toFixed(1)} L | Status: ${d.reconciliation_status}`);
    console.log(`    In Report: ${inReport ? 'YES' : 'NO'}`);
    console.log("");
  }

  console.log("Summary:");
  console.log(`  To batches IN report:     ${totalToVerified.toFixed(1)} L (${(totalToVerified * 0.264172).toFixed(1)} gal)`);
  console.log(`  To batches OUTSIDE report: ${totalToOther.toFixed(1)} L (${(totalToOther * 0.264172).toFixed(1)} gal)`);
  console.log(`  Current volume in verified destinations: ${verifiedDestCurrent.toFixed(1)} L`);
  console.log(`  Current volume in other destinations: ${otherDestCurrent.toFixed(1)} L`);

  // 2. Check child batches of the 17 verified batches
  console.log("\n=== 2. CHILD BATCHES (Created from transfers) ===\n");

  const childBatches = await db.execute(sql`
    WITH verified_batches AS (
      SELECT id
      FROM batches
      WHERE deleted_at IS NULL
        AND status != 'discarded'
        AND reconciliation_status = 'verified'
        AND NOT (batch_number LIKE 'LEGACY-%')
        AND CAST(initial_volume_liters AS NUMERIC) > 0
        AND start_date::date <= ${asOfDate}::date
    )
    SELECT
      child.batch_number,
      child.custom_name,
      child.reconciliation_status,
      child.initial_volume_liters,
      child.current_volume,
      parent.batch_number as parent_batch
    FROM batches child
    INNER JOIN batches parent ON child.parent_batch_id = parent.id
    WHERE parent.id IN (SELECT id FROM verified_batches)
      AND child.deleted_at IS NULL
    ORDER BY CAST(child.current_volume AS NUMERIC) DESC
  `);

  let childInitialTotal = 0;
  let childCurrentTotal = 0;

  if (childBatches.rows.length === 0) {
    console.log("No direct child batches found.");
  } else {
    console.log(`Found ${childBatches.rows.length} child batches:\n`);
    for (const c of childBatches.rows as any[]) {
      const initial = Number(c.initial_volume_liters || 0);
      const current = Number(c.current_volume || 0);
      childInitialTotal += initial;
      childCurrentTotal += current;

      console.log(`  ${c.batch_number.slice(0, 45)}`);
      console.log(`    Parent: ${c.parent_batch}`);
      console.log(`    Initial: ${initial.toFixed(1)} L | Current: ${current.toFixed(1)} L`);
      console.log(`    Status: ${c.reconciliation_status}`);
      console.log("");
    }

    console.log(`Child batch totals:`);
    console.log(`  Initial: ${childInitialTotal.toFixed(1)} L (${(childInitialTotal * 0.264172).toFixed(1)} gal)`);
    console.log(`  Current: ${childCurrentTotal.toFixed(1)} L (${(childCurrentTotal * 0.264172).toFixed(1)} gal)`);
  }

  // 3. Check where packaged volume went (inventory)
  console.log("\n=== 3. PACKAGED VOLUME → INVENTORY ===\n");

  const inventoryFromVerified = await db.execute(sql`
    SELECT
      ii.batch_id,
      b.batch_number,
      b.custom_name,
      COALESCE(SUM(ii.current_quantity), 0) as units_on_hand,
      COALESCE(SUM(ii.current_quantity * CAST(ii.package_size_ml AS DECIMAL) / 1000.0), 0) as volume_on_hand
    FROM inventory_items ii
    INNER JOIN batches b ON ii.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.status != 'discarded'
      AND b.reconciliation_status = 'verified'
      AND NOT (b.batch_number LIKE 'LEGACY-%')
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
      AND b.start_date::date <= ${asOfDate}::date
      AND ii.deleted_at IS NULL
    GROUP BY ii.batch_id, b.batch_number, b.custom_name
    ORDER BY volume_on_hand DESC
  `);

  let totalInventoryVolume = 0;
  for (const inv of inventoryFromVerified.rows as any[]) {
    const vol = Number(inv.volume_on_hand || 0);
    totalInventoryVolume += vol;
    if (vol > 0) {
      console.log(`  ${inv.batch_number}: ${inv.units_on_hand} units, ${vol.toFixed(1)} L`);
    }
  }
  console.log(`\nTotal inventory volume from 17 batches: ${totalInventoryVolume.toFixed(1)} L (${(totalInventoryVolume * 0.264172).toFixed(1)} gal)`);

  // 4. Check distillation records
  console.log("\n=== 4. DISTILLATION RECORDS ===\n");

  const distillation = await db.execute(sql`
    SELECT
      dr.id,
      dr.source_volume_liters,
      dr.sent_at,
      b.batch_number,
      b.custom_name
    FROM distillation_records dr
    INNER JOIN batches b ON dr.source_batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.status != 'discarded'
      AND b.reconciliation_status = 'verified'
      AND NOT (b.batch_number LIKE 'LEGACY-%')
      AND b.start_date::date <= ${asOfDate}::date
      AND (
        CAST(b.initial_volume_liters AS NUMERIC) > 0
        OR EXISTS (
          SELECT 1 FROM batch_transfers bt
          WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
        )
      )
      AND dr.deleted_at IS NULL
  `);

  let totalDistilled = 0;
  if (distillation.rows.length === 0) {
    console.log("No distillation records found for verified batches.");
  } else {
    for (const d of distillation.rows as any[]) {
      const vol = Number(d.source_volume_liters || 0);
      totalDistilled += vol;
      console.log(`  ${d.batch_number}: ${vol.toFixed(1)} L sent for distillation on ${d.sent_at}`);
    }
    console.log(`\nTotal distilled: ${totalDistilled.toFixed(1)} L (${(totalDistilled * 0.264172).toFixed(1)} gal)`);
  }

  // 5. Check direct packaged volume (bottle runs + keg fills)
  console.log("\n=== 5. DIRECT PACKAGED VOLUME ===\n");

  const bottleRunsFromVerified = await db.execute(sql`
    SELECT
      b.batch_number,
      COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)), 0) as volume_packaged,
      COALESCE(SUM(CAST(br.loss AS DECIMAL)), 0) as loss
    FROM bottle_runs br
    INNER JOIN batches b ON br.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.status != 'discarded'
      AND b.reconciliation_status = 'verified'
      AND NOT (b.batch_number LIKE 'LEGACY-%')
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
      AND b.start_date::date <= ${asOfDate}::date
      AND br.status != 'voided'
    GROUP BY b.batch_number
    ORDER BY volume_packaged DESC
  `);

  let totalBottled = 0;
  let totalBottleLoss = 0;
  for (const br of bottleRunsFromVerified.rows as any[]) {
    const vol = Number(br.volume_packaged || 0);
    const loss = Number(br.loss || 0);
    totalBottled += vol;
    totalBottleLoss += loss;
    if (vol > 0) {
      console.log(`  ${br.batch_number}: ${vol.toFixed(1)} L packaged, ${loss.toFixed(1)} L loss`);
    }
  }

  const kegFillsFromVerified = await db.execute(sql`
    SELECT
      b.batch_number,
      COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)), 0) as volume_kegged,
      COALESCE(SUM(CAST(COALESCE(kf.loss, '0') AS DECIMAL)), 0) as loss
    FROM keg_fills kf
    INNER JOIN batches b ON kf.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.status != 'discarded'
      AND b.reconciliation_status = 'verified'
      AND NOT (b.batch_number LIKE 'LEGACY-%')
      AND CAST(b.initial_volume_liters AS NUMERIC) > 0
      AND b.start_date::date <= ${asOfDate}::date
      AND kf.status != 'voided'
    GROUP BY b.batch_number
    ORDER BY volume_kegged DESC
  `);

  let totalKegged = 0;
  let totalKegLoss = 0;
  for (const kf of kegFillsFromVerified.rows as any[]) {
    const vol = Number(kf.volume_kegged || 0);
    const loss = Number(kf.loss || 0);
    totalKegged += vol;
    totalKegLoss += loss;
    if (vol > 0) {
      console.log(`  ${kf.batch_number}: ${vol.toFixed(1)} L kegged, ${loss.toFixed(1)} L loss`);
    }
  }

  console.log(`\nTotal bottled: ${totalBottled.toFixed(1)} L (${(totalBottled * 0.264172).toFixed(1)} gal)`);
  console.log(`Total kegged: ${totalKegged.toFixed(1)} L (${(totalKegged * 0.264172).toFixed(1)} gal)`);
  console.log(`Packaging losses: ${(totalBottleLoss + totalKegLoss).toFixed(1)} L (${((totalBottleLoss + totalKegLoss) * 0.264172).toFixed(1)} gal)`);

  // 6. Check transfer losses
  console.log("\n=== 6. TRANSFER LOSSES ===\n");

  const transferLosses = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(bt.loss AS DECIMAL)), 0) as transfer_loss
    FROM batch_transfers bt
    INNER JOIN batches src ON bt.source_batch_id = src.id
    WHERE src.deleted_at IS NULL
      AND src.status != 'discarded'
      AND src.reconciliation_status = 'verified'
      AND NOT (src.batch_number LIKE 'LEGACY-%')
      AND CAST(src.initial_volume_liters AS NUMERIC) > 0
      AND src.start_date::date <= ${asOfDate}::date
      AND bt.deleted_at IS NULL
  `);

  const totalTransferLoss = Number((transferLosses.rows[0] as any)?.transfer_loss || 0);
  console.log(`Transfer losses: ${totalTransferLoss.toFixed(1)} L (${(totalTransferLoss * 0.264172).toFixed(1)} gal)`);

  // 7. Where did the NON-VERIFIED batch volume go?
  console.log("\n=== 7. NON-VERIFIED BATCH OUTCOMES ===\n");
  console.log("What happened to the 593 gal transferred to duplicate/excluded batches?\n");

  const nonVerifiedOutcomes = await db.execute(sql`
    WITH non_verified_destinations AS (
      SELECT DISTINCT dest.id, dest.batch_number, dest.reconciliation_status,
        COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as received
      FROM batch_transfers bt
      INNER JOIN batches src ON bt.source_batch_id = src.id
      INNER JOIN batches dest ON bt.destination_batch_id = dest.id
      WHERE src.deleted_at IS NULL
        AND src.status != 'discarded'
        AND src.reconciliation_status = 'verified'
        AND NOT (src.batch_number LIKE 'LEGACY-%')
        AND CAST(src.initial_volume_liters AS NUMERIC) > 0
        AND src.start_date::date <= ${asOfDate}::date
        AND bt.deleted_at IS NULL
        AND (dest.reconciliation_status != 'verified' OR dest.batch_number LIKE 'LEGACY-%')
      GROUP BY dest.id, dest.batch_number, dest.reconciliation_status
    )
    SELECT
      nvd.batch_number,
      nvd.reconciliation_status,
      nvd.received,
      COALESCE((SELECT SUM(CAST(br.volume_taken_liters AS DECIMAL)) FROM bottle_runs br WHERE br.batch_id = nvd.id AND br.status != 'voided'), 0) as bottled,
      COALESCE((SELECT SUM(CAST(kf.volume_taken AS DECIMAL)) FROM keg_fills kf WHERE kf.batch_id = nvd.id AND kf.status != 'voided'), 0) as kegged,
      COALESCE((SELECT SUM(CAST(bt.volume_transferred AS DECIMAL)) FROM batch_transfers bt WHERE bt.source_batch_id = nvd.id AND bt.deleted_at IS NULL), 0) as transferred_out
    FROM non_verified_destinations nvd
    ORDER BY nvd.received DESC
    LIMIT 10
  `);

  let nonVerifiedBottled = 0;
  let nonVerifiedKegged = 0;
  let nonVerifiedTransferred = 0;

  for (const nv of nonVerifiedOutcomes.rows as any[]) {
    const received = Number(nv.received || 0);
    const bottled = Number(nv.bottled || 0);
    const kegged = Number(nv.kegged || 0);
    const transferred = Number(nv.transferred_out || 0);

    nonVerifiedBottled += bottled;
    nonVerifiedKegged += kegged;
    nonVerifiedTransferred += transferred;

    console.log(`  ${nv.batch_number.slice(0, 40)} (${nv.reconciliation_status})`);
    console.log(`    Received: ${received.toFixed(1)} L → Bottled: ${bottled.toFixed(1)} L, Kegged: ${kegged.toFixed(1)} L, Transferred: ${transferred.toFixed(1)} L`);
  }

  console.log(`\nNon-verified batches outcomes:`);
  console.log(`  Bottled: ${nonVerifiedBottled.toFixed(1)} L (${(nonVerifiedBottled * 0.264172).toFixed(1)} gal)`);
  console.log(`  Kegged: ${nonVerifiedKegged.toFixed(1)} L (${(nonVerifiedKegged * 0.264172).toFixed(1)} gal)`);
  console.log(`  Transferred further: ${nonVerifiedTransferred.toFixed(1)} L`);

  // 8. Check INFLOW into the 17 verified batches (from outside)
  console.log("\n=== 8. INFLOW FROM OUTSIDE ===\n");

  const inflowFromOutside = await db.execute(sql`
    WITH verified_batch_ids AS (
      SELECT id
      FROM batches
      WHERE deleted_at IS NULL
        AND status != 'discarded'
        AND reconciliation_status = 'verified'
        AND NOT (batch_number LIKE 'LEGACY-%')
        AND CAST(initial_volume_liters AS NUMERIC) > 0
        AND start_date::date <= ${asOfDate}::date
    )
    SELECT
      src.batch_number as source_batch,
      src.reconciliation_status as source_status,
      COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as volume
    FROM batch_transfers bt
    INNER JOIN batches src ON bt.source_batch_id = src.id
    INNER JOIN batches dest ON bt.destination_batch_id = dest.id
    WHERE dest.id IN (SELECT id FROM verified_batch_ids)
      AND src.id NOT IN (SELECT id FROM verified_batch_ids)
      AND bt.deleted_at IS NULL
    GROUP BY src.batch_number, src.reconciliation_status
    ORDER BY volume DESC
  `);

  let totalInflow = 0;
  for (const inf of inflowFromOutside.rows as any[]) {
    const vol = Number(inf.volume || 0);
    totalInflow += vol;
    console.log(`  ${inf.source_batch.slice(0, 40)} (${inf.source_status}): ${vol.toFixed(1)} L`);
  }
  console.log(`\nTotal inflow from outside: ${totalInflow.toFixed(1)} L (${(totalInflow * 0.264172).toFixed(1)} gal)`);

  // 9. Summary and reconciliation
  console.log("\n" + "═".repeat(60));
  console.log("=== VOLUME RECONCILIATION ===");
  console.log("═".repeat(60));

  const toGal = (l: number) => (l * 0.264172).toFixed(1);

  // Get the raw values again - using updated filter that includes transfer-destination batches
  const verifiedBatches = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(initial_volume_liters AS DECIMAL)), 0) as initial,
      COALESCE(SUM(CAST(current_volume AS DECIMAL)), 0) as current
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.status != 'discarded'
      AND b.reconciliation_status = 'verified'
      AND NOT (b.batch_number LIKE 'LEGACY-%')
      AND b.start_date::date <= ${asOfDate}::date
      AND (
        CAST(b.initial_volume_liters AS NUMERIC) > 0
        OR EXISTS (
          SELECT 1 FROM batch_transfers bt
          WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
        )
      )
  `);

  const initial = Number((verifiedBatches.rows[0] as any)?.initial || 0);
  const current = Number((verifiedBatches.rows[0] as any)?.current || 0);

  console.log("\nStarting point:");
  console.log(`  Initial Volume (17 batches): ${toGal(initial)} gal`);
  console.log(`  Plus inflow from outside:    ${toGal(totalInflow)} gal`);
  console.log(`  Total available:             ${toGal(initial + totalInflow)} gal`);

  console.log("\nOutflows from the 17 batch system:");
  console.log(`  → Directly bottled:            ${toGal(totalBottled)} gal`);
  console.log(`  → Directly kegged:             ${toGal(totalKegged)} gal`);
  console.log(`  → Distilled:                   ${toGal(totalDistilled)} gal`);
  console.log(`  → Transferred to non-verified: ${toGal(totalToOther)} gal`);
  console.log(`  → Packaging losses:            ${toGal(totalBottleLoss + totalKegLoss)} gal`);
  console.log(`  → Transfer losses:             ${toGal(totalTransferLoss)} gal`);

  console.log("\nRemaining:");
  console.log(`  → Current in 17 batches:       ${toGal(current)} gal`);

  console.log("\nInternal flows (not counted as outflows):");
  console.log(`  → Transferred within verified: ${toGal(totalToVerified)} gal`);

  console.log("\nWhat happened to volume transferred to non-verified batches:");
  console.log(`  (This volume already LEFT the 17, just showing where it went)`);
  console.log(`  → Bottled from non-verified:   ${toGal(nonVerifiedBottled)} gal`);
  console.log(`  → Kegged from non-verified:    ${toGal(nonVerifiedKegged)} gal`);
  console.log(`  → Transferred further:         ${(nonVerifiedTransferred * 0.264172).toFixed(1)} gal`);

  // Correct reconciliation:
  // Available = Initial + Inflow from outside
  // Outflows = Bottled + Kegged + Distilled + Transferred_to_non_verified + Losses
  // Available = Outflows + Current

  const totalLosses = totalBottleLoss + totalKegLoss + totalTransferLoss;
  const available = initial + totalInflow;
  const outflows = totalBottled + totalKegged + totalDistilled + totalToOther + totalLosses;
  const accounted = outflows + current;
  const discrepancy = available - accounted;

  console.log("\n" + "─".repeat(50));
  console.log("CLOSED-SYSTEM RECONCILIATION (17 verified batches):");
  console.log("─".repeat(50));
  console.log(`Initial volume:          ${toGal(initial)} gal`);
  console.log(`+ Inflow from outside:   ${toGal(totalInflow)} gal`);
  console.log("                         ─────────");
  console.log(`= Available:             ${toGal(available)} gal`);
  console.log("");
  console.log(`- Direct packaging:      ${toGal(totalBottled + totalKegged)} gal`);
  console.log(`- Distilled:             ${toGal(totalDistilled)} gal`);
  console.log(`- To non-verified:       ${toGal(totalToOther)} gal`);
  console.log(`- Losses:                ${toGal(totalLosses)} gal`);
  console.log(`- Current remaining:     ${toGal(current)} gal`);
  console.log("                         ─────────");
  console.log(`= Accounted:             ${toGal(accounted)} gal`);
  console.log("─".repeat(50));
  console.log(`DISCREPANCY:             ${toGal(discrepancy)} gal`);

  let potentialOvercount = 0;

  if (Math.abs(discrepancy) > 50) {
    console.log("\n⚠️  Significant discrepancy!");
    console.log("Investigating potential double-counting...\n");

    // Check for batches that have BOTH initial volume AND received transfers (potential double-count)
    const potentialDoubleCount = await db.execute(sql`
      WITH verified_batch_ids AS (
        SELECT id, batch_number, initial_volume_liters
        FROM batches
        WHERE deleted_at IS NULL
          AND status != 'discarded'
          AND reconciliation_status = 'verified'
          AND NOT (batch_number LIKE 'LEGACY-%')
          AND CAST(initial_volume_liters AS NUMERIC) > 0
          AND start_date::date <= ${asOfDate}::date
      )
      SELECT
        vb.batch_number,
        CAST(vb.initial_volume_liters AS DECIMAL) as initial_vol,
        COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as transfers_received
      FROM verified_batch_ids vb
      LEFT JOIN batch_transfers bt ON bt.destination_batch_id = vb.id AND bt.deleted_at IS NULL
      LEFT JOIN batches src ON bt.source_batch_id = src.id
      WHERE src.id IN (SELECT id FROM verified_batch_ids)
        OR src.id IS NULL
      GROUP BY vb.id, vb.batch_number, vb.initial_volume_liters
      HAVING COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) > 50
      ORDER BY transfers_received DESC
    `);

    if (potentialDoubleCount.rows.length > 0) {
      console.log("Batches with both initial volume AND transfers from other verified batches:");
      for (const dc of potentialDoubleCount.rows as any[]) {
        const initial = Number(dc.initial_vol || 0);
        const received = Number(dc.transfers_received || 0);
        const minOvercount = Math.min(initial, received);
        potentialOvercount += minOvercount;
        console.log(`  ${dc.batch_number.slice(0, 45)}`);
        console.log(`    Initial: ${initial.toFixed(1)} L | Received: ${received.toFixed(1)} L`);
        console.log(`    Potential overcount: ${minOvercount.toFixed(1)} L (${(minOvercount * 0.264172).toFixed(1)} gal)`);
      }
      console.log(`\nTotal potential double-counting: ${potentialOvercount.toFixed(1)} L (${(potentialOvercount * 0.264172).toFixed(1)} gal)`);

      if (Math.abs(potentialOvercount * 0.264172 - discrepancy) < 50) {
        console.log(`\n💡 This approximately matches the discrepancy!`);
        console.log(`   The issue is likely that some batches have initial_volume_liters`);
        console.log(`   set to volume they RECEIVED via transfer, causing double-counting.`);
      }
    }

    // Also check for transfers to deleted batches
    const deletedDestinations = await db.execute(sql`
      SELECT
        dest.batch_number,
        COALESCE(SUM(CAST(bt.volume_transferred AS DECIMAL)), 0) as volume_lost
      FROM batch_transfers bt
      INNER JOIN batches src ON bt.source_batch_id = src.id
      INNER JOIN batches dest ON bt.destination_batch_id = dest.id
      WHERE src.deleted_at IS NULL
        AND src.status != 'discarded'
        AND src.reconciliation_status = 'verified'
        AND NOT (src.batch_number LIKE 'LEGACY-%')
        AND CAST(src.initial_volume_liters AS NUMERIC) > 0
        AND src.start_date::date <= ${asOfDate}::date
        AND bt.deleted_at IS NULL
        AND dest.deleted_at IS NOT NULL
      GROUP BY dest.batch_number
    `);

    let totalToDeleted = 0;
    if (deletedDestinations.rows.length > 0) {
      console.log("\nVolume transferred to DELETED batches:");
      for (const del of deletedDestinations.rows as any[]) {
        const vol = Number(del.volume_lost || 0);
        totalToDeleted += vol;
        console.log(`  ${del.batch_number}: ${vol.toFixed(1)} L`);
      }
      console.log(`Total to deleted: ${totalToDeleted.toFixed(1)} L (${(totalToDeleted * 0.264172).toFixed(1)} gal)`);
    }

    // Final summary (all values converted to gallons)
    const discrepancyGal = discrepancy * 0.264172;
    const doubleCountGal = potentialOvercount * 0.264172;
    const deletedGal = totalToDeleted * 0.264172;
    const explainedGal = doubleCountGal + deletedGal;
    const remainingGal = discrepancyGal - explainedGal;

    console.log("\n" + "═".repeat(50));
    console.log("DISCREPANCY EXPLANATION:");
    console.log("═".repeat(50));
    console.log(`Discrepancy:              ${discrepancyGal.toFixed(1)} gal`);
    console.log(`Potential double-count:   ${doubleCountGal.toFixed(1)} gal`);
    console.log(`To deleted batches:       ${deletedGal.toFixed(1)} gal`);
    console.log("                          ─────────");
    console.log(`Total explained:          ${explainedGal.toFixed(1)} gal`);
    console.log(`Remaining unexplained:    ${remainingGal.toFixed(1)} gal`);

    if (Math.abs(remainingGal) < 10) {
      console.log("\n✅ DISCREPANCY FULLY EXPLAINED!");
      console.log("\nRecommended actions:");
      console.log("  1. Review 'blend-2024-12-20-1000 IBC 4-024554' batch");
      console.log("     - Its initial_volume should likely be 0");
      console.log("     - It's a blend batch that received volume via transfers");
      console.log("  2. Investigate deleted destination batches");
      console.log("     - Volume transferred there may need recovery or loss recording");
    }

  } else if (Math.abs(discrepancy) > 10) {
    console.log("\n⚡ Minor discrepancy - likely due to rounding or small unrecorded losses");
  } else {
    console.log("\n✅ Volume reconciles within acceptable margin!");
  }

  process.exit(0);
}

main();
