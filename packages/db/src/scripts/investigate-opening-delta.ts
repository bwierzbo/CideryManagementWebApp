import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Investigate the opening balance discrepancy between configured TTB opening (1,121 gal)
 * and SBD-reconstructed opening (1,209.2 gal) for the 2025 period.
 *
 * Also check the Base Cider parent batches for additives and the phantom child.
 */
async function main() {
  const toGal = (l: number) => (l / 3.78541).toFixed(1);
  const openingDate = "2024-12-31";

  // 1. Find ALL eligible batches at the opening date (same query as computeReconciliationFromBatches)
  const eligible = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.batch_number, b.product_type, b.start_date,
           b.initial_volume_liters, b.parent_batch_id, b.current_volume_liters,
           b.is_racking_derivative, b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND (
        COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
        OR b.is_racking_derivative IS TRUE
        OR b.parent_batch_id IS NOT NULL
      )
      AND COALESCE(b.product_type, 'cider') != 'juice'
      AND b.start_date::date <= '${openingDate}'::date
    ORDER BY b.start_date
  `));

  const rows = eligible.rows as any[];
  console.log(`=== Eligible batches at ${openingDate} (carried forward into 2025) ===`);
  console.log(`Found ${rows.length} batches\n`);

  let totalInitialL = 0;
  for (const r of rows) {
    const initial = parseFloat(r.initial_volume_liters || "0");
    totalInitialL += initial;
    console.log(
      `  ${(r.name || "").padEnd(40)} | init=${initial.toFixed(1).padStart(8)}L (${toGal(initial).padStart(6)} gal)` +
      ` | recon=${(r.reconciliation_status || "pending").padEnd(10)}` +
      ` | parent=${r.parent_batch_id ? "yes" : "no "}` +
      ` | racking=${r.is_racking_derivative ? "yes" : "no "}` +
      ` | type=${r.product_type || "cider"}`
    );
  }
  console.log(`\nTotal initial volume: ${totalInitialL.toFixed(1)}L (${toGal(totalInitialL)} gal)`);

  // 2. Check for batch_transfers records for each batch
  console.log("\n=== Transfer records for carried-forward batches ===\n");
  for (const r of rows) {
    if (!r.parent_batch_id) continue;
    const transfers = await db.execute(sql`
      SELECT bt.volume_transferred, bt.loss, bt.transferred_at,
             src.name AS source_name
      FROM batch_transfers bt
      LEFT JOIN batches src ON bt.source_batch_id = src.id
      WHERE bt.destination_batch_id = ${r.id}
        AND bt.deleted_at IS NULL
    `);
    const tRows = transfers.rows as any[];
    const totalTransferIn = tRows.reduce((s: number, t: any) => s + parseFloat(t.volume_transferred || "0"), 0);
    const initial = parseFloat(r.initial_volume_liters || "0");
    const isTransferCreated = r.parent_batch_id && totalTransferIn >= initial * 0.9;
    console.log(
      `  ${(r.name || "").padEnd(40)} | init=${initial.toFixed(1).padStart(7)}L` +
      ` | transfersIn=${totalTransferIn.toFixed(1).padStart(7)}L` +
      ` | isTransferCreated=${isTransferCreated ? "YES" : "NO "}` +
      ` | transfers=${tRows.length}`
    );
    if (tRows.length === 0 && initial > 0) {
      console.log(`    *** PHANTOM CHILD: ${initial.toFixed(1)}L initial with NO transfer records ***`);
    }
  }

  // 3. Check Base Cider and Community Blend additives
  console.log("\n=== Additive history for Base Cider / Community Blend parents ===\n");
  const wineParents = rows.filter((r: any) =>
    (r.product_type === "wine" || r.product_type === "other") && !r.parent_batch_id
  );
  for (const r of wineParents) {
    console.log(`Batch: ${r.name} (${r.id.slice(0, 8)}...) — type: ${r.product_type}`);
    const additives = await db.execute(sql`
      SELECT ba.additive_name, ba.additive_type, ba.added_at
      FROM batch_additives ba
      WHERE ba.batch_id = ${r.id}
        AND ba.deleted_at IS NULL
      ORDER BY ba.added_at
    `);
    if ((additives.rows as any[]).length === 0) {
      console.log(`  NO additives found on this batch`);
    } else {
      for (const a of additives.rows as any[]) {
        console.log(
          `  ${a.additive_name} (${a.additive_type})` +
          ` | added=${new Date(a.added_at).toISOString().split("T")[0]}`
        );
      }
    }

    // Also check children for additives
    const childAdditives = await db.execute(sql`
      SELECT b.name AS child_name, ba.additive_name, ba.additive_type
      FROM batch_additives ba
      JOIN batches b ON ba.batch_id = b.id
      WHERE b.parent_batch_id = ${r.id}
        AND ba.deleted_at IS NULL
        AND b.deleted_at IS NULL
    `);
    if ((childAdditives.rows as any[]).length > 0) {
      console.log(`  Children with additives:`);
      for (const ca of childAdditives.rows as any[]) {
        console.log(
          `    ${ca.child_name}: ${ca.additive_name} (${ca.additive_type})`
        );
      }
    }
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
