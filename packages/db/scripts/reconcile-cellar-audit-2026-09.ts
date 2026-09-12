/**
 * Cellar volume reconciliation per owner rulings (2026-09-12 audit):
 *
 * - Jonathan #1: book 943 L is correct (owner). Ledger summed 1111.5
 *   (an outflow was effectively double-counted). Adjustment -168.5.
 * - Salish 2025 #1: barrel physically full at ~225 L (owner). Ledger
 *   creation was overstated (recorded 225 L; running balances imply
 *   the initial fill was ~70 L). Adjustment -155.15 -> 224.85 = book.
 * - Salish #3: barrel physically full (owner). Ledger missing a
 *   ~65 L top-up inflow. Adjustment +64.96 -> 224.66 = book.
 * - Calvados Barrel Aged + Raspberry Blackberry: phantom volume on
 *   completed batches with no vessel (owner) -> book zeroed.
 *
 * Bourbon Barrel #2 deliberately NOT touched (pending owner ullage
 * check — ledger evidence suggests the book double-applied a 17 L
 * carboy blend).
 *
 * Run: pnpm --filter db exec tsx scripts/reconcile-cellar-audit-2026-09.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const NOTE = "Reconciliation to physical/book volume (owner-confirmed, cellar audit 2026-09-12)";

const ADJUSTMENTS: Array<{ name: string; delta: number; detail: string }> = [
  {
    name: "Jonathan #1",
    delta: -168.5,
    detail: "Ledger overcount — transfer to BARREL-225-2 effectively double-counted; owner confirms no net draw, book 943 L correct",
  },
  {
    name: "Salish 2025 #1",
    delta: -155.15,
    detail: "Creation entry overstated (recorded 225 L; initial fill ~70 L). Barrel physically full at 224.85 L",
  },
  {
    name: "Salish #3",
    delta: 64.96,
    detail: "Unrecorded top-up inflow. Barrel physically full at 224.66 L",
  },
];

const PHANTOMS = ["Calvados Barrel Aged", "Raspberry Blackberry"];

async function main() {
  await db.transaction(async (tx) => {
    for (const a of ADJUSTMENTS) {
      const res = await tx.execute(sql`
        INSERT INTO batch_volume_ledger
          (batch_id, event_date, event_type, volume_change, running_balance, unit, source_description, notes)
        SELECT b.id, NOW(), 'adjustment', ${a.delta}, b.current_volume_liters::numeric, 'L',
               ${a.detail}, ${NOTE}
        FROM batches b
        WHERE b.custom_name = ${a.name} AND b.deleted_at IS NULL
      `);
      if (res.rowCount !== 1) throw new Error(`Expected 1 batch named ${a.name}, got ${res.rowCount}`);
    }
    for (const name of PHANTOMS) {
      const res = await tx.execute(sql`
        UPDATE batches
        SET current_volume = '0', current_volume_liters = '0', updated_at = NOW()
        WHERE custom_name = ${name} AND deleted_at IS NULL AND vessel_id IS NULL
          AND status = 'completed' AND current_volume_liters::numeric > 0.01
      `);
      if (res.rowCount !== 1) throw new Error(`Expected 1 phantom named ${name}, got ${res.rowCount}`);
    }
  });

  const check = await db.execute(sql`
    SELECT b.custom_name, b.current_volume_liters::float AS book,
           (SELECT SUM(volume_change)::float FROM batch_volume_ledger l WHERE l.batch_id = b.id) AS ledger
    FROM batches b
    WHERE b.custom_name IN ('Jonathan #1','Salish 2025 #1','Salish #3','Calvados Barrel Aged','Raspberry Blackberry')
      AND b.deleted_at IS NULL
  `);
  console.table(check.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
