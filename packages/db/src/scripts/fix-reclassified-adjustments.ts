import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Reverse the "reclassified from internal transfer" correction adjustments
 * and restore proper transfer records.
 *
 * Root cause: During reconciliation cleanup (Nov-Dec 2025), several source batches
 * were deleted through the UI instead of being archived. This orphaned their transfers.
 * Two fix scripts then compensated:
 *   - fix-carried-forward-inits.ts: reverted inflated initials on destination batches,
 *     added correction_up adjustments to replace the lost transfersIn
 *   - fix-out-transfers.ts: soft-deleted transfers FROM eligible batches TO deleted destinations,
 *     added correction_down adjustments on the source (eligible) batches
 *
 * This fix reverses that by un-deleting the batches + transfers and removing the adjustments.
 *
 * Changes:
 *   1. Un-delete 4 source batches, mark as 'duplicate' reconciliation status
 *   2. Un-delete 5 outbound transfers (source → destination)
 *   3. Un-delete 2 inbound transfers (eligible → source)
 *   4. Soft-delete 5 correction_up adjustments
 *   5. Soft-delete 2 correction_down adjustments
 */

const GAL = 0.264172;

// === Step 1: Source batches to un-delete ===
const BATCHES_TO_UNDELETE = [
  { id: "b11200f5-c24d-4450-a75d-8feae24dd122", name: "Calvados Barrel Aged", currentRecon: "duplicate" },
  { id: "fe565ff0-b519-447e-966f-8bc6dcd0b8a6", name: "OBC Cider Mix", currentRecon: "pending" },
  { id: "430cdcd3-af47-4260-a26f-6aab040f5b3f", name: "Raspberry Blackberry", currentRecon: "pending" },
  { id: "b80ffc1f-39e2-4059-a269-dace865d99cb", name: "Calvados BA Cider dup", currentRecon: "duplicate" },
];

// === Step 2: Outbound transfers to un-delete (source → eligible destination) ===
const OUTBOUND_TRANSFERS = [
  { id: "4a9f263a", src: "Calvados BA", dst: "Rye Cider", volL: 82.5 },
  { id: "ceeccb92", src: "OBC Cider Mix", dst: "For Distillery", volL: 56.0 },
  { id: "36e9f5fc", src: "Raspberry Blackberry", dst: "For Distillery", volL: 18.9 },
  { id: "cd5d8af1", src: "Calvados BA Cider dup", dst: "For Distillery", volL: 17.5 },
  { id: "8f855956", src: "Calvados BA", dst: "Calvados BA Cider", volL: 37.8 },
];

// === Step 3: Inbound transfers to un-delete (eligible → source) ===
const INBOUND_TRANSFERS = [
  { id: "d8e96926", src: "Legacy BRITE", dst: "Raspberry Blackberry", volL: 18.9 },
  { id: "0d3fcc6d", src: "Calvados BA Cider", dst: "Calvados BA Cider dup", volL: 17.5 },
];

// === Step 4: Correction_UP adjustments to delete ===
const CORRECTION_UPS = [
  { id: "b7fb5814", batch: "Rye Cider", amtL: 82.5 },
  { id: "4e7115f9", batch: "For Distillery", amtL: 56.0 },
  { id: "b7663172", batch: "For Distillery", amtL: 18.9 },
  { id: "314e56b8", batch: "For Distillery", amtL: 17.5 },
  { id: "9908dcfc", batch: "Calvados BA Cider", amtL: 37.8 },
];

// === Step 5: Correction_DOWN adjustments to delete ===
const CORRECTION_DOWNS = [
  { id: "d9b37371", batch: "Legacy BRITE", amtL: -18.9 },
  { id: "808f3795", batch: "Calvados BA Cider", amtL: -17.5 },
];

async function main() {
  console.log("=== Fix Reclassified Adjustments ===\n");
  console.log("Reversing correction adjustments and restoring proper transfers.\n");

  // --- Step 1: Un-delete source batches ---
  console.log("STEP 1: Un-delete source batches and mark as 'duplicate'\n");
  for (const b of BATCHES_TO_UNDELETE) {
    const result = await db.execute(sql.raw(`
      UPDATE batches
      SET deleted_at = NULL,
          reconciliation_status = 'duplicate',
          updated_at = NOW()
      WHERE id = '${b.id}'
      RETURNING id, custom_name, deleted_at, reconciliation_status
    `));
    const row = (result.rows as any[])[0];
    if (row) {
      console.log(`  ✓ Un-deleted "${row.custom_name}" → recon: ${row.reconciliation_status}`);
    } else {
      console.log(`  ✗ FAILED: batch ${b.name} (${b.id}) not found`);
    }
  }

  // --- Step 2: Un-delete outbound transfers ---
  console.log("\nSTEP 2: Un-delete outbound transfers (source → destination)\n");
  for (const t of OUTBOUND_TRANSFERS) {
    const result = await db.execute(sql.raw(`
      UPDATE batch_transfers
      SET deleted_at = NULL
      WHERE id::text LIKE '${t.id}%'
        AND deleted_at IS NOT NULL
      RETURNING id, volume_transferred::numeric as vol
    `));
    const row = (result.rows as any[])[0];
    if (row) {
      console.log(`  ✓ Un-deleted transfer ${t.src} → ${t.dst}: ${parseFloat(row.vol).toFixed(1)}L`);
    } else {
      console.log(`  ✗ FAILED: transfer ${t.id}... (${t.src} → ${t.dst}) not found or already active`);
    }
  }

  // --- Step 3: Un-delete inbound transfers ---
  console.log("\nSTEP 3: Un-delete inbound transfers (eligible → source)\n");
  for (const t of INBOUND_TRANSFERS) {
    const result = await db.execute(sql.raw(`
      UPDATE batch_transfers
      SET deleted_at = NULL
      WHERE id::text LIKE '${t.id}%'
        AND deleted_at IS NOT NULL
      RETURNING id, volume_transferred::numeric as vol
    `));
    const row = (result.rows as any[])[0];
    if (row) {
      console.log(`  ✓ Un-deleted transfer ${t.src} → ${t.dst}: ${parseFloat(row.vol).toFixed(1)}L`);
    } else {
      console.log(`  ✗ FAILED: transfer ${t.id}... (${t.src} → ${t.dst}) not found or already active`);
    }
  }

  // --- Step 4: Soft-delete correction_up adjustments ---
  console.log("\nSTEP 4: Soft-delete correction_up adjustments\n");
  for (const a of CORRECTION_UPS) {
    const result = await db.execute(sql.raw(`
      UPDATE batch_volume_adjustments
      SET deleted_at = NOW()
      WHERE id::text LIKE '${a.id}%'
        AND deleted_at IS NULL
      RETURNING id, adjustment_amount::numeric as amt, reason
    `));
    const row = (result.rows as any[])[0];
    if (row) {
      console.log(`  ✓ Deleted adj on ${a.batch}: +${parseFloat(row.amt).toFixed(1)}L`);
    } else {
      console.log(`  ✗ FAILED: adjustment ${a.id}... on ${a.batch} not found or already deleted`);
    }
  }

  // --- Step 5: Soft-delete correction_down adjustments ---
  console.log("\nSTEP 5: Soft-delete correction_down adjustments\n");
  for (const a of CORRECTION_DOWNS) {
    const result = await db.execute(sql.raw(`
      UPDATE batch_volume_adjustments
      SET deleted_at = NOW()
      WHERE id::text LIKE '${a.id}%'
        AND deleted_at IS NULL
      RETURNING id, adjustment_amount::numeric as amt, reason
    `));
    const row = (result.rows as any[])[0];
    if (row) {
      console.log(`  ✓ Deleted adj on ${a.batch}: ${parseFloat(row.amt).toFixed(1)}L`);
    } else {
      console.log(`  ✗ FAILED: adjustment ${a.id}... on ${a.batch} not found or already deleted`);
    }
  }

  // === VERIFICATION ===
  console.log("\n=== VERIFICATION ===\n");

  // Check remaining positive adjustments
  const remaining = await db.execute(sql.raw(`
    SELECT bva.id, bva.batch_id, bva.adjustment_amount::numeric as amt,
           bva.adjustment_type, bva.reason, bva.adjustment_date::text,
           b.custom_name
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND bva.adjustment_amount::numeric > 0
      AND bva.adjustment_date::date > '2024-12-31'
      AND bva.adjustment_date::date <= '2025-12-31'
    ORDER BY bva.adjustment_amount::numeric DESC
  `));
  console.log("Remaining positive adjustments (2025):");
  let totalPositive = 0;
  for (const r of remaining.rows as any[]) {
    const amt = parseFloat(r.amt);
    totalPositive += amt;
    console.log(`  ${r.custom_name}: +${(amt * GAL).toFixed(2)} gal (${r.reason})`);
  }
  console.log(`  TOTAL: +${(totalPositive * GAL).toFixed(1)} gal\n`);

  // Check remaining negative "reclassified" adjustments
  const remainingDown = await db.execute(sql.raw(`
    SELECT bva.adjustment_amount::numeric as amt, bva.reason, b.custom_name
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND bva.reason LIKE '%reclassified from internal transfer%'
    ORDER BY bva.adjustment_date
  `));
  console.log("Remaining 'reclassified' adjustments:");
  if ((remainingDown.rows as any[]).length === 0) {
    console.log("  (none — all reclassified adjustments have been replaced with transfers)");
  }
  for (const r of remainingDown.rows as any[]) {
    console.log(`  ${r.custom_name}: ${(parseFloat(r.amt) * GAL).toFixed(1)} gal (${r.reason})`);
  }

  // Check that the 4 un-deleted batches are properly set as 'duplicate'
  console.log("\nUn-deleted batch status:");
  for (const b of BATCHES_TO_UNDELETE) {
    const check = await db.execute(sql.raw(`
      SELECT custom_name, deleted_at, reconciliation_status
      FROM batches WHERE id = '${b.id}'
    `));
    const row = (check.rows as any[])[0];
    console.log(`  ${row.custom_name}: deleted=${row.deleted_at}, recon=${row.reconciliation_status}`);
  }

  // Verify transfer counts
  const activeTransfers = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt
    FROM batch_transfers
    WHERE deleted_at IS NULL
      AND (
        source_batch_id IN ('b11200f5-c24d-4450-a75d-8feae24dd122', 'fe565ff0-b519-447e-966f-8bc6dcd0b8a6', '430cdcd3-af47-4260-a26f-6aab040f5b3f', 'b80ffc1f-39e2-4059-a269-dace865d99cb')
        OR destination_batch_id IN ('b11200f5-c24d-4450-a75d-8feae24dd122', 'fe565ff0-b519-447e-966f-8bc6dcd0b8a6', '430cdcd3-af47-4260-a26f-6aab040f5b3f', 'b80ffc1f-39e2-4059-a269-dace865d99cb')
      )
  `));
  console.log(`\nActive transfers involving un-deleted batches: ${(activeTransfers.rows as any[])[0].cnt}`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
