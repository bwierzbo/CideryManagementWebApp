/**
 * Seed the FILED TTB numbers onto their period snapshots (Phase 4 C2).
 *
 * Sets is_filed / filed_at / filed_form / expected_drift on the already-finalized
 * 2024 and 2025 annual snapshots. The jsonb payloads come DIRECTLY from the lib
 * constants (single source of truth — the golden suite's parity guard deep-equals
 * these rows against the same constants). This script makes NO changes to any
 * numeric inventory column; it only populates the four columns added by
 * migration 0148.
 *
 * Run from repo root:
 *   pnpm --filter db exec tsx scripts/seed-filed-snapshots.ts
 */
import { eq } from "drizzle-orm";
import { db, ttbPeriodSnapshots } from "../src/index";
// Pure constants module (no runtime deps) — imported by source path since the db
// package does not declare a workspace dependency on lib.
import {
  FILED_2024,
  FILED_2025_FORM,
  FILED_DRIFT_PAYLOAD_2024,
  FILED_DRIFT_PAYLOAD_2025,
} from "../../lib/src/calculations/ttb-filed";

// The finalized annual snapshot rows to stamp as filed.
//
// Phase 7 C4b: expected_drift is now a { mode, entries } payload. 2024 keeps the
// native FILED_2024 form + entries-mode payload (flow lines not event-sourced);
// 2025 stores the recompute-shaped FILED_2025_FORM + full-mode payload so the
// runtime comparator self-compares the canonical field set with entry overrides.
const ROWS = [
  {
    id: "fb3964e1-3560-43a1-9ec6-377e9cc1778a",
    year: 2024,
    filedAt: "2025-01-13",
    filedForm: FILED_2024,
    expectedDrift: FILED_DRIFT_PAYLOAD_2024,
  },
  {
    id: "f968b31f-7ee7-43bc-9e06-510cfd3920c0",
    year: 2025,
    filedAt: "2026-02-27",
    filedForm: FILED_2025_FORM,
    expectedDrift: FILED_DRIFT_PAYLOAD_2025,
  },
];

async function main() {
  for (const row of ROWS) {
    const result = await db
      .update(ttbPeriodSnapshots)
      .set({
        isFiled: true,
        filedAt: row.filedAt,
        filedForm: row.filedForm,
        expectedDrift: row.expectedDrift,
      })
      .where(eq(ttbPeriodSnapshots.id, row.id))
      .returning({ id: ttbPeriodSnapshots.id, year: ttbPeriodSnapshots.year });

    if (result.length === 0) {
      throw new Error(
        `Snapshot ${row.id} (year ${row.year}) not found — cannot seed filed data.`,
      );
    }
    console.log(
      `✅ Stamped filed data on ${row.year} snapshot ${row.id} ` +
        `(filed_at=${row.filedAt}, mode=${row.expectedDrift.mode}, ` +
        `entries=${row.expectedDrift.entries.length})`,
    );
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
