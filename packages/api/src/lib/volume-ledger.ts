/**
 * Volume Ledger — Records every volume change on a batch.
 *
 * Every operation that changes a batch's volume (transfer, blend, packaging,
 * loss, adjustment, creation) writes an entry here. The batch detail page
 * reads from this ledger instead of reconstructing history from multiple tables.
 */

import { db, batchVolumeLedger, batches } from "db";
import { eq, desc, sql } from "drizzle-orm";

export type LedgerEventType =
  | "creation"
  | "inflow"
  | "outflow"
  | "loss"
  | "adjustment"
  | "packaging";

export interface LedgerEntry {
  batchId: string;
  eventDate: Date;
  eventType: LedgerEventType;
  /** Positive for inflow, negative for outflow/loss */
  volumeChange: number;
  unit?: string;
  /** Source characteristics at time of event */
  sourceAbv?: number | null;
  sourceSg?: number | null;
  sourcePh?: number | null;
  /** Cost of the material flowing in */
  materialCost?: number | null;
  /** Vessel the batch was in at time of event */
  vesselId?: string | null;
  /** Human-readable description */
  sourceDescription: string;
  /** For losses: sediment, evaporation, spillage, sampling, packaging, transfer, other */
  lossReason?: string | null;
  /** Link back to the source record */
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  /** Who did it */
  performedBy?: string | null;
  notes?: string | null;
}

/**
 * Write a volume ledger entry and return the running balance.
 *
 * This should be called inside the same transaction as the volume change.
 * Pass the transaction (`tx`) if inside a transaction, otherwise uses `db`.
 */
export async function writeLedgerEntry(
  entry: LedgerEntry,
  tx?: typeof db,
): Promise<{ runningBalance: number }> {
  const conn = tx || db;

  // Get current running balance from the last ledger entry
  const lastEntry = await conn
    .select({ runningBalance: batchVolumeLedger.runningBalance })
    .from(batchVolumeLedger)
    .where(eq(batchVolumeLedger.batchId, entry.batchId))
    .orderBy(desc(batchVolumeLedger.eventDate), desc(batchVolumeLedger.createdAt))
    .limit(1);

  const previousBalance = lastEntry.length > 0
    ? parseFloat(lastEntry[0].runningBalance?.toString() || "0")
    : 0;

  const runningBalance = Math.max(0, previousBalance + entry.volumeChange);

  await conn.insert(batchVolumeLedger).values({
    batchId: entry.batchId,
    eventDate: entry.eventDate,
    eventType: entry.eventType,
    volumeChange: entry.volumeChange.toFixed(3),
    runningBalance: runningBalance.toFixed(3),
    unit: entry.unit || "L",
    sourceAbv: entry.sourceAbv != null ? entry.sourceAbv.toString() : null,
    sourceSg: entry.sourceSg != null ? entry.sourceSg.toString() : null,
    sourcePh: entry.sourcePh != null ? entry.sourcePh.toString() : null,
    materialCost: entry.materialCost != null ? entry.materialCost.toString() : null,
    vesselId: entry.vesselId || null,
    sourceDescription: entry.sourceDescription,
    lossReason: entry.lossReason || null,
    linkedEntityType: entry.linkedEntityType || null,
    linkedEntityId: entry.linkedEntityId || null,
    performedBy: entry.performedBy || null,
    notes: entry.notes || null,
  });

  return { runningBalance };
}

/**
 * Write multiple ledger entries at once (e.g., for batch creation with initial volume).
 */
export async function writeLedgerEntries(
  entries: LedgerEntry[],
  tx?: typeof db,
): Promise<void> {
  for (const entry of entries) {
    await writeLedgerEntry(entry, tx);
  }
}

/**
 * Get the full volume ledger for a batch, ordered chronologically.
 */
export async function getBatchLedger(batchId: string) {
  return db
    .select()
    .from(batchVolumeLedger)
    .where(eq(batchVolumeLedger.batchId, batchId))
    .orderBy(batchVolumeLedger.eventDate, batchVolumeLedger.createdAt);
}

/**
 * Get the current balance from the ledger (last entry's running balance).
 */
export async function getLedgerBalance(batchId: string): Promise<number> {
  const last = await db
    .select({ runningBalance: batchVolumeLedger.runningBalance })
    .from(batchVolumeLedger)
    .where(eq(batchVolumeLedger.batchId, batchId))
    .orderBy(desc(batchVolumeLedger.eventDate), desc(batchVolumeLedger.createdAt))
    .limit(1);

  return last.length > 0 ? parseFloat(last[0].runningBalance?.toString() || "0") : 0;
}
