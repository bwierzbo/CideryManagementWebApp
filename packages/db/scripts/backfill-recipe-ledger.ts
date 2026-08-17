/**
 * Backfill batch_volume_ledger for the two event classes that never wrote
 * entries (both now fixed forward in the API):
 *   1. Recipe-blend draws (batch_transfers "Recipe blend:%") — source outflow
 *      + target creation, double-entry.
 *   2. Additive volume contributions (batch_volume_adjustments 'addition',
 *      "Volume contribution%") — inflow on the batch.
 * Then recomputes running balances chronologically for affected batches.
 * Idempotent: guarded per-row.
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function main() {
  const touched = new Set<string>();

  await db.transaction(async (tx) => {
    // 1. Recipe-blend transfers → outflow (source) + creation (target)
    const xfers = (await tx.execute(sql`
      SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
             bt.source_vessel_id, bt.destination_vessel_id,
             bt.volume_transferred::numeric AS vol, bt.transferred_at, bt.notes
      FROM batch_transfers bt
      WHERE bt.notes LIKE 'Recipe blend:%' AND bt.deleted_at IS NULL
        AND bt.source_batch_id IS DISTINCT FROM bt.destination_batch_id
        AND NOT EXISTS (
          SELECT 1 FROM batch_volume_ledger l
          WHERE l.linked_entity_type = 'batch_transfer' AND l.linked_entity_id = bt.id
        )
      ORDER BY bt.transferred_at`)) as unknown as { rows: any[] };

    for (const t of xfers.rows) {
      await tx.execute(sql`
        INSERT INTO batch_volume_ledger
          (batch_id, event_date, event_type, volume_change, running_balance, unit,
           vessel_id, source_description, linked_entity_type, linked_entity_id, created_at)
        VALUES
          (${t.source_batch_id}, ${t.transferred_at}, 'outflow', ${(-t.vol).toFixed(3)}, 0, 'L',
           ${t.source_vessel_id}, ${"Recipe draw (backfilled): " + t.notes}, 'batch_transfer', ${t.id}, NOW()),
          (${t.destination_batch_id}, ${t.transferred_at}, 'creation', ${Number(t.vol).toFixed(3)}, 0, 'L',
           ${t.destination_vessel_id}, ${t.notes + " (backfilled)"}, 'batch_transfer', ${t.id}, NOW())`);
      touched.add(t.source_batch_id);
      touched.add(t.destination_batch_id);
    }
    console.log(`recipe-blend transfers backfilled: ${xfers.rows.length} (× 2 entries)`);

    // 2. Additive volume contributions → inflow
    const adds = (await tx.execute(sql`
      SELECT a.id, a.batch_id, a.vessel_id, a.adjustment_date,
             a.adjustment_amount::numeric AS vol, a.reason
      FROM batch_volume_adjustments a
      WHERE a.adjustment_type = 'addition' AND a.reason LIKE 'Volume contribution%'
        AND a.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM batch_volume_ledger l
          WHERE l.batch_id = a.batch_id AND l.event_type = 'inflow'
            AND l.event_date = a.adjustment_date
            AND ABS(l.volume_change::numeric - a.adjustment_amount::numeric) < 0.001
        )
      ORDER BY a.adjustment_date`)) as unknown as { rows: any[] };

    for (const a of adds.rows) {
      await tx.execute(sql`
        INSERT INTO batch_volume_ledger
          (batch_id, event_date, event_type, volume_change, running_balance, unit,
           vessel_id, source_description, linked_entity_type, linked_entity_id, created_at)
        VALUES (${a.batch_id}, ${a.adjustment_date}, 'inflow', ${Number(a.vol).toFixed(3)}, 0, 'L',
                ${a.vessel_id}, ${a.reason + " (backfilled)"}, 'batch_volume_adjustment', ${a.id}, NOW())`);
      touched.add(a.batch_id);
    }
    console.log(`additive volume inflows backfilled: ${adds.rows.length}`);

    // 3. Recompute running balances chronologically for every touched batch
    for (const batchId of touched) {
      await tx.execute(sql`
        WITH ordered AS (
          SELECT id,
                 GREATEST(0, SUM(volume_change::numeric) OVER (ORDER BY event_date, created_at
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS bal
          FROM batch_volume_ledger WHERE batch_id = ${batchId}
        )
        UPDATE batch_volume_ledger l SET running_balance = o.bal
        FROM ordered o WHERE l.id = o.id`);
    }
    console.log(`running balances recomputed for ${touched.size} batches`);
  });

  // Post-check: remaining per-batch mismatches among recent/active batches
  const audit = (await db.execute(sql`
    SELECT COALESCE(b.custom_name, b.name) AS batch, b.status,
           b.current_volume_liters::numeric AS vol,
           COALESCE(SUM(l.volume_change::numeric),0) AS ledger_sum
    FROM batches b LEFT JOIN batch_volume_ledger l ON l.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND (b.created_at >= '2026-06-01' OR b.status IN ('fermentation','aging','conditioning'))
    GROUP BY b.id
    HAVING ABS(b.current_volume_liters::numeric - COALESCE(SUM(l.volume_change::numeric),0)) > 1
    ORDER BY ABS(b.current_volume_liters::numeric - COALESCE(SUM(l.volume_change::numeric),0)) DESC
    LIMIT 12`)) as unknown as { rows: any[] };
  console.log("Remaining ledger-vs-volume mismatches (>1 L):");
  console.table(audit.rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
