import { db } from "../src/index";
import { sql } from "drizzle-orm";

// Fix the duplicate SCB4 -> DRUM-120-1 transfer (PRD: transfer-cleaning-workflow-hardening #1).
// A double-submit (~5s apart, 2026-06-02 14:12) created TWO identical 115 L transfers and TWO
// identical "Lavender Black Currant" batches in DRUM-120-1, each with auto-cloned measurements/
// additives/compositions/ledger inherited from the SCB4 blend lineage. Source (SCB4) was debited
// only once, so its volume (114.825 L) is already correct.
//
// Action: remove duplicate batch B (5b8fc827) and its cloned children + the duplicate transfer row.
//   - tables with a deleted_at column  -> soft delete
//   - tables without deleted_at        -> hard delete (rows are dup clones created today)

const DUP_TRANSFER_ID = "bd5e9049-54b5-4e6f-90e8-ee1ee5dffd75";
const PHANTOM_BATCH_ID = "5b8fc827-d274-454b-9e80-46c6a7227e55";
const SCB4_BATCH_ID = "a408aa3c-d9bd-49e0-922d-f9e6698fff41";
const DRUM_120_1_VESSEL = "b47b77fb-dcc6-46c5-9db4-af92994e8422";

// Anything tied to the phantom batch created after this instant = real post-clone activity -> abort.
const CLONE_BURST_END = "2026-06-02 14:13:00";

async function hasColumn(table: string, column: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table} AND column_name=${column} LIMIT 1`);
  return r.rows.length > 0;
}

async function main() {
  // Tables that reference a batch via batch_id
  const childTables = ["batch_measurements", "batch_additives", "batch_compositions", "batch_volume_ledger"];

  // ---- SAFETY GUARD: abort if any dependent row was created after the clone burst ----
  for (const t of childTables) {
    if (!(await hasColumn(t, "created_at"))) continue;
    const r = await db.execute(sql.raw(
      `SELECT COUNT(*)::int n FROM "${t}" WHERE batch_id='${PHANTOM_BATCH_ID}' AND created_at > '${CLONE_BURST_END}'`));
    const n = (r.rows[0] as any).n as number;
    if (n > 0) {
      console.log(`ABORT: ${t} has ${n} row(s) on phantom batch created after the clone burst (real user data). Manual review needed.`);
      process.exit(1);
    }
  }
  console.log("Safety guard passed: all phantom-batch dependents are clone-burst rows (no later user activity).");

  const before = await db.execute(sql`SELECT current_volume FROM batches WHERE id=${SCB4_BATCH_ID}::uuid`);
  console.log(`\nSCB4 current_volume BEFORE: ${(before.rows[0] as any).current_volume}`);

  // ---- Apply in a transaction ----
  await db.transaction(async (tx) => {
    // child rows
    for (const t of childTables) {
      if (await hasColumn(t, "deleted_at")) {
        await tx.execute(sql.raw(
          `UPDATE "${t}" SET deleted_at=now() WHERE batch_id='${PHANTOM_BATCH_ID}' AND deleted_at IS NULL`));
      } else {
        await tx.execute(sql.raw(`DELETE FROM "${t}" WHERE batch_id='${PHANTOM_BATCH_ID}'`));
      }
    }
    // duplicate transfer row (soft delete)
    await tx.execute(sql`
      UPDATE batch_transfers SET deleted_at=now(), updated_at=now()
      WHERE id=${DUP_TRANSFER_ID}::uuid AND deleted_at IS NULL`);
    // phantom batch (soft delete)
    await tx.execute(sql`
      UPDATE batches SET deleted_at=now(), updated_at=now()
      WHERE id=${PHANTOM_BATCH_ID}::uuid AND deleted_at IS NULL`);
  });
  console.log("Removed duplicate transfer + phantom batch + its cloned child rows.");

  // ---- Verify ----
  const after = await db.execute(sql`SELECT current_volume FROM batches WHERE id=${SCB4_BATCH_ID}::uuid`);
  console.log(`SCB4 current_volume AFTER : ${(after.rows[0] as any).current_volume} (expect unchanged 114.825)`);

  const drum = await db.execute(sql`
    SELECT custom_name, current_volume, status FROM batches
    WHERE vessel_id=${DRUM_120_1_VESSEL}::uuid AND deleted_at IS NULL`);
  console.log(`\nDRUM-120-1 live batches now (${drum.rows.length}, expect 1):`);
  for (const r of drum.rows as any[]) console.log(`  ${r.custom_name}  ${r.current_volume}L  ${r.status}`);

  const TRANSFER_DATE = new Date("2026-05-25T14:12:00Z");
  const n = (v: any) => parseFloat((v ?? "0").toString());
  const ins = await db.execute(sql`SELECT COALESCE(SUM(volume_transferred::decimal),0) t FROM batch_transfers
    WHERE destination_batch_id=${SCB4_BATCH_ID}::uuid AND deleted_at IS NULL AND transferred_at<=${TRANSFER_DATE}`);
  const outs = await db.execute(sql`SELECT COALESCE(SUM(total_volume_processed::decimal),0) t FROM batch_transfers
    WHERE source_batch_id=${SCB4_BATCH_ID}::uuid AND deleted_at IS NULL AND transferred_at<=${TRANSFER_DATE}`);
  const adj = await db.execute(sql`SELECT COALESCE(SUM(adjustment_amount::decimal),0) t FROM batch_volume_adjustments
    WHERE batch_id=${SCB4_BATCH_ID}::uuid AND deleted_at IS NULL AND adjustment_date<=${TRANSFER_DATE}`);
  const hist = 200 + n((ins.rows[0] as any).t) - n((outs.rows[0] as any).t) + n((adj.rows[0] as any).t);
  console.log(`\nRecomputed historical volume at 07:12 = ${hist.toFixed(3)} L (expect ~114.825 → DRUM-120-2 transfer allowed)`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
