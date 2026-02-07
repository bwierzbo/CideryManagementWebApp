/**
 * Batch Reconciliation Analysis Script
 *
 * Queries ALL 2025 batches and analyzes their history to recommend
 * reconciliation status: "verified" | "duplicate" | "excluded"
 */

import { db } from "../index.js";
import { sql } from "drizzle-orm";

interface BatchRow {
  id: string;
  name: string;
  custom_name: string | null;
  batch_number: string;
  product_type: string | null;
  status: string;
  initial_volume_liters: string | null;
  current_volume_liters: string | null;
  reconciliation_status: string | null;
  is_racking_derivative: boolean | null;
  parent_batch_id: string | null;
  vessel_name: string | null;
  start_date: string | null;
}

interface ChildBatch {
  id: string;
  name: string;
  custom_name: string | null;
  batch_number: string;
  product_type: string | null;
  status: string;
  initial_volume_liters: string | null;
  is_racking_derivative: boolean | null;
  reconciliation_status: string | null;
}

interface Transfer {
  id: string;
  source_batch_id: string;
  destination_batch_id: string;
  volume_transferred: string;
  loss: string | null;
  transferred_at: string;
  notes: string | null;
}

interface RackingOp {
  id: string;
  batch_id: string;
  volume_before: string;
  volume_after: string;
  volume_loss: string;
  racked_at: string;
}

interface DistillationRec {
  id: string;
  source_batch_id: string;
  result_batch_id: string | null;
  source_volume_liters: string | null;
  received_volume_liters: string | null;
  status: string;
  sent_at: string;
}

interface BottleRunRow {
  id: string;
  batch_id: string;
  volume_taken_liters: string | null;
  units_produced: number;
  packaged_at: string;
  voided_at: string | null;
}

interface KegFillRow {
  id: string;
  batch_id: string;
  volume_taken: string;
  filled_at: string;
  voided_at: string | null;
  distributed_at: string | null;
}

type Recommendation = "verified" | "duplicate" | "excluded";

interface BatchAnalysis {
  batch: BatchRow;
  children: ChildBatch[];
  transfersAsSource: Transfer[];
  transfersAsDest: Transfer[];
  rackingOps: RackingOp[];
  distillationRecords: DistillationRec[];
  bottleRuns: BottleRunRow[];
  kegFills: KegFillRow[];
  recommendation: Recommendation;
  reasoning: string[];
  anomalies: string[];
}

function litersToGallons(liters: number): number {
  return liters * 0.264172;
}

function fmtVol(liters: number): string {
  return `${liters.toFixed(2)}L (${litersToGallons(liters).toFixed(1)}gal)`;
}

async function analyze() {
  console.log("=".repeat(80));
  console.log("  BATCH RECONCILIATION ANALYSIS - ALL 2025 BATCHES");
  console.log("=".repeat(80));
  console.log("");

  // 1. Query all 2025 batches
  const batchesResult = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.batch_number,
      b.product_type,
      b.status,
      CAST(b.initial_volume_liters AS TEXT) as initial_volume_liters,
      CAST(b.current_volume_liters AS TEXT) as current_volume_liters,
      b.reconciliation_status,
      b.is_racking_derivative,
      b.parent_batch_id,
      v.name as vessel_name,
      b.start_date
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NULL
      AND b.start_date >= '2025-01-01'
      AND b.start_date < '2026-01-01'
    ORDER BY b.start_date, b.batch_number
  `);

  const allBatches = batchesResult.rows as unknown as BatchRow[];
  console.log(`Found ${allBatches.length} batches in 2025\n`);

  const analyses: BatchAnalysis[] = [];

  for (const batch of allBatches) {
    // Query child batches
    const childResult = await db.execute(sql`
      SELECT
        id, name, custom_name, batch_number, product_type, status,
        CAST(initial_volume_liters AS TEXT) as initial_volume_liters,
        is_racking_derivative, reconciliation_status
      FROM batches
      WHERE parent_batch_id = ${batch.id}
        AND deleted_at IS NULL
    `);
    const children = childResult.rows as unknown as ChildBatch[];

    // Query transfers where this batch is SOURCE
    const transfersSourceResult = await db.execute(sql`
      SELECT
        id, source_batch_id, destination_batch_id,
        CAST(volume_transferred AS TEXT) as volume_transferred,
        CAST(loss AS TEXT) as loss,
        transferred_at, notes
      FROM batch_transfers
      WHERE source_batch_id = ${batch.id}
        AND deleted_at IS NULL
      ORDER BY transferred_at
    `);
    const transfersAsSource = transfersSourceResult.rows as unknown as Transfer[];

    // Query transfers where this batch is DESTINATION
    const transfersDestResult = await db.execute(sql`
      SELECT
        id, source_batch_id, destination_batch_id,
        CAST(volume_transferred AS TEXT) as volume_transferred,
        CAST(loss AS TEXT) as loss,
        transferred_at, notes
      FROM batch_transfers
      WHERE destination_batch_id = ${batch.id}
        AND deleted_at IS NULL
      ORDER BY transferred_at
    `);
    const transfersAsDest = transfersDestResult.rows as unknown as Transfer[];

    // Query racking operations
    const rackingResult = await db.execute(sql`
      SELECT
        id, batch_id,
        CAST(volume_before AS TEXT) as volume_before,
        CAST(volume_after AS TEXT) as volume_after,
        CAST(volume_loss AS TEXT) as volume_loss,
        racked_at
      FROM batch_racking_operations
      WHERE batch_id = ${batch.id}
        AND deleted_at IS NULL
      ORDER BY racked_at
    `);
    const rackingOps = rackingResult.rows as unknown as RackingOp[];

    // Query distillation records
    const distillResult = await db.execute(sql`
      SELECT
        id, source_batch_id, result_batch_id,
        CAST(source_volume_liters AS TEXT) as source_volume_liters,
        CAST(received_volume_liters AS TEXT) as received_volume_liters,
        status, sent_at
      FROM distillation_records
      WHERE (source_batch_id = ${batch.id} OR result_batch_id = ${batch.id})
        AND deleted_at IS NULL
    `);
    const distillationRecords = distillResult.rows as unknown as DistillationRec[];

    // Query bottle runs
    const bottleResult = await db.execute(sql`
      SELECT
        id, batch_id,
        CAST(volume_taken_liters AS TEXT) as volume_taken_liters,
        units_produced, packaged_at, voided_at
      FROM bottle_runs
      WHERE batch_id = ${batch.id}
    `);
    const bottleRuns = bottleResult.rows as unknown as BottleRunRow[];

    // Query keg fills
    const kegResult = await db.execute(sql`
      SELECT
        id, batch_id,
        CAST(volume_taken AS TEXT) as volume_taken,
        filled_at, voided_at, distributed_at
      FROM keg_fills
      WHERE batch_id = ${batch.id}
    `);
    const kegFills = kegResult.rows as unknown as KegFillRow[];

    // Analyze and recommend
    const { recommendation, reasoning, anomalies } = analyzeAndRecommend(
      batch,
      children,
      transfersAsSource,
      transfersAsDest,
      rackingOps,
      distillationRecords,
      bottleRuns,
      kegFills
    );

    analyses.push({
      batch,
      children,
      transfersAsSource,
      transfersAsDest,
      rackingOps,
      distillationRecords,
      bottleRuns,
      kegFills,
      recommendation,
      reasoning,
      anomalies,
    });
  }

  // Output analysis for each batch
  for (const a of analyses) {
    const b = a.batch;
    const initL = parseFloat(b.initial_volume_liters || "0");
    const curL = parseFloat(b.current_volume_liters || "0");
    const displayName = b.custom_name || b.batch_number;

    console.log("-".repeat(80));
    console.log(`BATCH: ${displayName}`);
    console.log(`  Name/ID: ${b.name} | Product: ${b.product_type || "null"} | Status: ${b.status}`);
    console.log(`  Vessel: ${b.vessel_name || "none"} | Start: ${b.start_date ? new Date(b.start_date).toISOString().split("T")[0] : "?"}`);
    console.log(`  Initial: ${fmtVol(initL)} | Current: ${fmtVol(curL)}`);
    console.log(`  Current Reconciliation: ${b.reconciliation_status || "null"} | Racking Derivative: ${b.is_racking_derivative}`);
    if (b.parent_batch_id) {
      console.log(`  Parent Batch ID: ${b.parent_batch_id}`);
    }

    // History summary
    console.log(`  --- History ---`);
    if (a.transfersAsDest.length > 0) {
      console.log(`  Received ${a.transfersAsDest.length} transfer(s) IN: ${a.transfersAsDest.map(t => `${parseFloat(t.volume_transferred).toFixed(1)}L`).join(", ")}`);
    }
    if (a.transfersAsSource.length > 0) {
      console.log(`  Sent ${a.transfersAsSource.length} transfer(s) OUT: ${a.transfersAsSource.map(t => `${parseFloat(t.volume_transferred).toFixed(1)}L`).join(", ")}`);
    }
    if (a.rackingOps.length > 0) {
      console.log(`  ${a.rackingOps.length} racking op(s): ${a.rackingOps.map(r => `${parseFloat(r.volume_before).toFixed(1)}L->${parseFloat(r.volume_after).toFixed(1)}L (loss: ${parseFloat(r.volume_loss).toFixed(1)}L)`).join("; ")}`);
    }
    if (a.distillationRecords.length > 0) {
      for (const d of a.distillationRecords) {
        if (d.source_batch_id === b.id) {
          console.log(`  Distillation: sent ${parseFloat(d.source_volume_liters || "0").toFixed(1)}L (status: ${d.status})`);
        } else {
          console.log(`  Distillation: result batch, received ${parseFloat(d.received_volume_liters || "0").toFixed(1)}L`);
        }
      }
    }
    if (a.bottleRuns.length > 0) {
      const active = a.bottleRuns.filter(br => !br.voided_at);
      const voided = a.bottleRuns.filter(br => br.voided_at);
      if (active.length > 0) {
        const totalBottledL = active.reduce((s, br) => s + parseFloat(br.volume_taken_liters || "0"), 0);
        const totalUnits = active.reduce((s, br) => s + (br.units_produced || 0), 0);
        console.log(`  ${active.length} bottle run(s): ${totalUnits} units, ${fmtVol(totalBottledL)} taken`);
      }
      if (voided.length > 0) {
        console.log(`  ${voided.length} VOIDED bottle run(s)`);
      }
    }
    if (a.kegFills.length > 0) {
      const active = a.kegFills.filter(k => !k.voided_at);
      const voided = a.kegFills.filter(k => k.voided_at);
      if (active.length > 0) {
        const totalKegL = active.reduce((s, k) => s + parseFloat(k.volume_taken || "0"), 0);
        console.log(`  ${active.length} keg fill(s): ${fmtVol(totalKegL)} taken`);
      }
      if (voided.length > 0) {
        console.log(`  ${voided.length} VOIDED keg fill(s)`);
      }
    }
    if (a.children.length > 0) {
      console.log(`  ${a.children.length} child batch(es): ${a.children.map(c => `${c.custom_name || c.batch_number} (${c.product_type}, racking_deriv=${c.is_racking_derivative})`).join("; ")}`);
    }
    const noActivity =
      a.transfersAsDest.length === 0 &&
      a.transfersAsSource.length === 0 &&
      a.rackingOps.length === 0 &&
      a.distillationRecords.length === 0 &&
      a.bottleRuns.length === 0 &&
      a.kegFills.length === 0 &&
      a.children.length === 0;
    if (noActivity) {
      console.log(`  (No transfers, racking, distillation, bottling, or keg activity)`);
    }

    // Recommendation
    console.log(`  --- Recommendation ---`);
    console.log(`  >> ${a.recommendation.toUpperCase()} <<`);
    for (const r of a.reasoning) {
      console.log(`     - ${r}`);
    }
    if (a.anomalies.length > 0) {
      console.log(`  --- Anomalies ---`);
      for (const an of a.anomalies) {
        console.log(`     ! ${an}`);
      }
    }
    console.log("");
  }

  // Summary
  console.log("=".repeat(80));
  console.log("  SUMMARY");
  console.log("=".repeat(80));

  const counts: Record<Recommendation, number> = { verified: 0, duplicate: 0, excluded: 0 };
  const volumeByRec: Record<Recommendation, number> = { verified: 0, duplicate: 0, excluded: 0 };

  for (const a of analyses) {
    counts[a.recommendation]++;
    volumeByRec[a.recommendation] += parseFloat(a.batch.initial_volume_liters || "0");
  }

  console.log(`\nTotal batches analyzed: ${analyses.length}\n`);
  for (const rec of ["verified", "duplicate", "excluded"] as Recommendation[]) {
    const volL = volumeByRec[rec];
    console.log(`  ${rec.toUpperCase().padEnd(12)} ${String(counts[rec]).padStart(3)} batches | Initial volume: ${fmtVol(volL)}`);
  }

  // Show current vs recommended status changes
  console.log(`\n--- STATUS CHANGES NEEDED ---\n`);
  let changesNeeded = 0;
  for (const a of analyses) {
    const current = a.batch.reconciliation_status || "pending";
    if (current !== a.recommendation) {
      changesNeeded++;
      const displayName = a.batch.custom_name || a.batch.batch_number;
      console.log(`  ${displayName.padEnd(40)} ${current.padEnd(12)} -> ${a.recommendation}`);
      for (const r of a.reasoning) {
        console.log(`    ${r}`);
      }
    }
  }
  if (changesNeeded === 0) {
    console.log("  No changes needed - all batches already have correct reconciliation status.");
  } else {
    console.log(`\n  Total changes needed: ${changesNeeded}`);
  }

  // Show anomalies summary
  const anomalyBatches = analyses.filter(a => a.anomalies.length > 0);
  if (anomalyBatches.length > 0) {
    console.log(`\n--- ANOMALIES (${anomalyBatches.length} batches) ---\n`);
    for (const a of anomalyBatches) {
      const displayName = a.batch.custom_name || a.batch.batch_number;
      console.log(`  ${displayName}:`);
      for (const an of a.anomalies) {
        console.log(`    ! ${an}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  process.exit(0);
}

function analyzeAndRecommend(
  batch: BatchRow,
  children: ChildBatch[],
  transfersAsSource: Transfer[],
  transfersAsDest: Transfer[],
  rackingOps: RackingOp[],
  distillationRecords: DistillationRec[],
  bottleRuns: BottleRunRow[],
  kegFills: KegFillRow[]
): { recommendation: Recommendation; reasoning: string[]; anomalies: string[] } {
  const reasoning: string[] = [];
  const anomalies: string[] = [];
  const initL = parseFloat(batch.initial_volume_liters || "0");
  const curL = parseFloat(batch.current_volume_liters || "0");
  const productType = batch.product_type || "cider";
  const isRackingDeriv = batch.is_racking_derivative === true;
  const hasParent = !!batch.parent_batch_id;

  // Check for zero/null initial volume
  if (initL === 0) {
    anomalies.push("Zero initial volume");
  }

  // Check for discarded status
  if (batch.status === "discarded") {
    anomalies.push("Batch is discarded");
  }

  // Check for possible test batch (very small volume)
  if (initL > 0 && initL < 1) {
    anomalies.push(`Very small initial volume (${initL.toFixed(3)}L) - possible test batch`);
  }

  // Check if current volume is negative
  if (curL < 0) {
    anomalies.push(`Negative current volume (${curL.toFixed(2)}L)`);
  }

  // Check for no activity on non-fresh batches
  const noActivity =
    transfersAsDest.length === 0 &&
    transfersAsSource.length === 0 &&
    rackingOps.length === 0 &&
    distillationRecords.length === 0 &&
    bottleRuns.length === 0 &&
    kegFills.length === 0 &&
    children.length === 0;

  // ---- RECOMMENDATION LOGIC ----

  // 1. Racking derivatives should be "duplicate"
  if (isRackingDeriv) {
    reasoning.push("Is a racking derivative (is_racking_derivative=true)");
    reasoning.push("Racking derivatives represent the same volume moved to a new vessel, not new production");
    return { recommendation: "duplicate", reasoning, anomalies };
  }

  // 2. Batches created by transfer-in (has parent, received transfers) - likely a derivative
  if (hasParent && transfersAsDest.length > 0 && initL === 0) {
    reasoning.push("Has parent batch and was created via transfer (init vol=0, received transfers)");
    reasoning.push("This is a transfer-destination batch, not new production");
    return { recommendation: "duplicate", reasoning, anomalies };
  }

  // 3. Batches with parent that are blending/transfer destinations
  if (hasParent && !isRackingDeriv) {
    // Check if it received all its volume from transfers
    const totalTransferredIn = transfersAsDest.reduce((s, t) => s + parseFloat(t.volume_transferred), 0);

    if (totalTransferredIn > 0 && initL <= 1) {
      reasoning.push(`Has parent batch and received ${fmtVol(totalTransferredIn)} from transfers`);
      reasoning.push("Volume came from parent - this is a derivative, not new production");
      return { recommendation: "duplicate", reasoning, anomalies };
    }
  }

  // 4. Brandy result batches from distillation
  if (productType === "brandy") {
    const asResult = distillationRecords.filter(d => d.result_batch_id === batch.id);
    if (asResult.length > 0) {
      reasoning.push("Brandy batch created from distillation return");
      reasoning.push("Brandy is tracked separately on TTB form (spirits, not cider)");
      reasoning.push("Volume was already counted when original cider was produced");
      return { recommendation: "excluded", reasoning, anomalies };
    }
    // Brandy batch not linked to distillation record
    reasoning.push("Brandy product type - excluded from cider TTB reconciliation");
    return { recommendation: "excluded", reasoning, anomalies };
  }

  // 5. Pommeau batches
  if (productType === "pommeau") {
    reasoning.push("Pommeau product type - tracked in wine16To21 tax class");
    reasoning.push("Pommeau is a blend of juice and brandy, reported separately from hard cider");
    // Pommeau IS counted in TTB reconciliation, just in a different tax class
    // It should be verified so the TTB form includes it
    reasoning.push("Should be verified for TTB reporting (different tax class, still counted)");
    return { recommendation: "verified", reasoning, anomalies };
  }

  // 6. Discarded batches with zero current volume
  if (batch.status === "discarded" && curL <= 0) {
    reasoning.push("Batch is discarded with zero/negative current volume");
    if (initL > 0) {
      reasoning.push(`Had ${fmtVol(initL)} initially - volume was produced and should be counted`);
      return { recommendation: "verified", reasoning, anomalies };
    } else {
      reasoning.push("Never had volume - likely a test or error entry");
      return { recommendation: "excluded", reasoning, anomalies };
    }
  }

  // 7. Check for "juice" product type with no fermentation activity
  if (productType === "juice") {
    // Juice that was pressed and fermented becomes cider
    // Juice that was used for pommeau or distillation is a source material
    if (distillationRecords.length > 0) {
      reasoning.push("Juice batch used in distillation");
      reasoning.push("Volume tracked via distillation records");
      return { recommendation: "verified", reasoning, anomalies };
    }
    if (transfersAsSource.length > 0 && noActivity) {
      reasoning.push("Juice batch that was fully transferred out");
      reasoning.push("Volume is tracked in destination batches");
      // If it transferred to other batches, it's the original production
      return { recommendation: "verified", reasoning, anomalies };
    }
    reasoning.push("Juice product type - represents pressed juice before fermentation");
    reasoning.push("Should be counted as production (juice becomes cider)");
    return { recommendation: "verified", reasoning, anomalies };
  }

  // 8. Normal cider/perry batches with production volume
  if ((productType === "cider" || productType === "perry" || productType === "other") && initL > 0) {
    reasoning.push(`${productType} batch with ${fmtVol(initL)} initial volume`);

    // Check for packaging activity
    const activeBottleRuns = bottleRuns.filter(br => !br.voided_at);
    const activeKegFills = kegFills.filter(k => !k.voided_at);

    if (activeBottleRuns.length > 0 || activeKegFills.length > 0) {
      reasoning.push("Has packaging activity (bottled/kegged) - clearly a real production batch");
    }

    if (transfersAsSource.length > 0) {
      reasoning.push(`Transferred out to ${transfersAsSource.length} batch(es)`);
    }

    if (distillationRecords.filter(d => d.source_batch_id === batch.id).length > 0) {
      reasoning.push("Source for distillation - volume sent to DSP");
    }

    if (noActivity && batch.status === "fermentation") {
      reasoning.push("Still fermenting with no activity yet - standard in-progress batch");
    }

    return { recommendation: "verified", reasoning, anomalies };
  }

  // 9. Zero-volume batches
  if (initL === 0) {
    if (transfersAsDest.length > 0) {
      const totalIn = transfersAsDest.reduce((s, t) => s + parseFloat(t.volume_transferred), 0);
      reasoning.push(`Zero initial volume but received ${fmtVol(totalIn)} from transfers`);
      reasoning.push("Transfer-destination batch - volume already counted at source");
      return { recommendation: "duplicate", reasoning, anomalies };
    }
    reasoning.push("Zero initial volume with no incoming transfers");
    reasoning.push("Likely a test entry or data error");
    return { recommendation: "excluded", reasoning, anomalies };
  }

  // Default fallback: verify
  reasoning.push(`Default: ${productType} batch with volume - counting as production`);
  return { recommendation: "verified", reasoning, anomalies };
}

analyze().catch((e) => {
  console.error("Analysis script error:", e);
  process.exit(1);
});
