import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix the 4 OUT transfers to deleted/excluded destinations.
 * First one (Legacy BRITE → Lavender Salal) was already soft-deleted but
 * the adjustment wasn't created. Handle all 4.
 */

const ADMIN_USER_ID = "8356e824-6b53-4751-b3ac-08a0df9327b9";
const L_PER_GAL = 3.78541;

// The 4 OUT transfers identified by the investigation
const OUT_TRANSFERS = [
  { srcName: "Legacy Cider BRITE T2302", dstName: "Lavender Salal Cider", alreadyDeleted: true },
  { srcName: "Legacy Cider BRITE T2302", dstName: "Raspberry Blackberry", alreadyDeleted: false },
  { srcName: "Calvados Barrel Aged Cider", dstName: "Calvados Barrel Aged Cider", alreadyDeleted: false },
  { srcName: "Plum Wine", dstName: "Plum Wine", alreadyDeleted: false },
];

async function main() {
  console.log("=== Fix OUT Transfers ===\n");

  // Get eligible batch IDs
  const END = "2025-12-31";
  const eligible = await db.execute(sql`
    SELECT b.id FROM batches b
    WHERE b.deleted_at IS NULL
      AND (COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative IS TRUE OR b.parent_batch_id IS NOT NULL)
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= ${END}::date
  `);
  const eligibleIds = new Set((eligible.rows as any[]).map(r => r.id));

  // Find the 4 OUT transfers (source eligible, destination NOT eligible)
  const outTransfers = await db.execute(sql`
    SELECT t.id, t.source_batch_id, t.destination_batch_id,
           CAST(t.volume_transferred AS TEXT) as vol,
           t.transferred_at, t.deleted_at,
           sb.custom_name as src_name, sb.batch_number as src_batch,
           CAST(sb.current_volume_liters AS TEXT) as src_current,
           db2.custom_name as dst_name, db2.batch_number as dst_batch
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db2 ON t.destination_batch_id = db2.id
    WHERE t.source_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= ${END}::date)
      AND t.transferred_at >= '2025-01-01'::date
      AND t.transferred_at < ('2025-12-31'::date + interval '1 day')
    ORDER BY t.transferred_at
  `);

  // Filter to non-eligible destinations (include already-deleted ones)
  const toFix: any[] = [];
  for (const t of outTransfers.rows as any[]) {
    if (!eligibleIds.has(t.destination_batch_id)) {
      toFix.push(t);
    }
  }

  console.log(`Found ${toFix.length} OUT transfers to non-eligible destinations:\n`);

  for (const t of toFix) {
    const vol = parseFloat(t.vol);
    const srcName = t.src_name || t.src_batch;
    const dstName = t.dst_name || t.dst_batch;
    const srcCurrent = parseFloat(t.src_current) || 0;
    const wasDeleted = !!t.deleted_at;

    console.log(`--- ${srcName} → ${dstName} ---`);
    console.log(`  Volume: ${vol}L (${(vol / L_PER_GAL).toFixed(1)} gal)`);
    console.log(`  Transfer date: ${t.transferred_at}`);
    console.log(`  Already soft-deleted: ${wasDeleted}`);

    // Soft-delete if not already
    if (!wasDeleted) {
      await db.execute(sql`
        UPDATE batch_transfers SET deleted_at = NOW() WHERE id = ${t.id}
      `);
      console.log(`  Soft-deleted transfer [${t.id.slice(0, 8)}]`);
    }

    // Create negative adjustment on source batch
    // volume_before/after are approximate (we use current as reference)
    const volBefore = srcCurrent + vol; // what it was before the transfer
    const volAfter = srcCurrent;        // what it is now

    await db.execute(sql`
      INSERT INTO batch_volume_adjustments (
        id, batch_id, adjustment_date, adjustment_type,
        volume_before, volume_after, adjustment_amount,
        reason, adjusted_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${t.source_batch_id},
        ${t.transferred_at},
        'correction_down',
        ${volBefore},
        ${volAfter},
        ${-vol},
        ${"Volume sent to " + dstName + " (batch later deleted) — reclassified from internal transfer"},
        ${ADMIN_USER_ID},
        NOW(),
        NOW()
      )
    `);
    console.log(`  Created -${vol}L adjustment on ${srcName}`);
    console.log(``);
  }

  // Verify
  console.log("\n=== Verification ===");
  const newTIn = await db.execute(sql`
    SELECT CAST(COALESCE(SUM(t.volume_transferred), 0) AS TEXT) as total
    FROM batch_transfers t
    WHERE t.destination_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= '2025-12-31'::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= '2025-01-01'::date
      AND t.transferred_at < ('2025-12-31'::date + interval '1 day')
  `);
  const newTOut = await db.execute(sql`
    SELECT CAST(COALESCE(SUM(t.volume_transferred), 0) AS TEXT) as total
    FROM batch_transfers t
    WHERE t.source_batch_id IN (SELECT id FROM batches WHERE deleted_at IS NULL
      AND (COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR is_racking_derivative IS TRUE OR parent_batch_id IS NOT NULL)
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= '2025-12-31'::date)
      AND t.deleted_at IS NULL
      AND t.transferred_at >= '2025-01-01'::date
      AND t.transferred_at < ('2025-12-31'::date + interval '1 day')
  `);

  const tInL = parseFloat((newTIn.rows as any[])[0].total);
  const tOutL = parseFloat((newTOut.rows as any[])[0].total);
  console.log(`Transfers IN:  ${(tInL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`Transfers OUT: ${(tOutL / L_PER_GAL).toFixed(1)} gal`);
  console.log(`Net transfers: ${((tInL - tOutL) / L_PER_GAL).toFixed(1)} gal`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
