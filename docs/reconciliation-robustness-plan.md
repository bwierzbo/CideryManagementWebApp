# Reconciliation Robustness Plan

> Goal: make reconciliation trustworthy. Two outcomes the user wants:
> 1. **Confidence the cider numbers are correct** — batch/vessel volumes reconcile against event history, and *real* drift is surfaced (not hidden).
> 2. **An accurate TTB Form 5120.17 summary** — line items derived from real events, with a *true* variance signal instead of a plugged-to-zero one.
>
> Companion to `.claude/prds/automated-reconciliation.md` (that PRD is about *automation/alerting*; this plan is about *correctness*). Written 2026-07-02 from a code map of the reconciliation engine + TTB form generator.

---

## 1. Current architecture (grounded, with file:line)

### Two independent history-replay engines (this is the core problem)
Both reconstruct volume from the SAME event tables, but are **separate implementations that can and do drift apart**:

- **Per-batch:** `checkVolumeBalance` + `fetchBulkVolumeData` — `packages/api/src/validation/batch-validation.ts:367-449` (formula), `:125-337` (data). Powers the Batch Reconciliation page (`apps/web/src/components/reports/BatchReconciliation.tsx`) via `batch.listForReconciliation` (`packages/api/src/routers/batch.ts:3210-3356`).
- **System/TTB:** `computeSystemCalculatedOnHand` (SBD reconstruction) — `packages/api/src/routers/ttb.ts:281-514`, grouped by tax class in `computePerTaxClassBulkInventory` (`:520`). Powers `generateForm512017` (`:1664`) and `getReconciliationSummary` (`:4916`).

Event tables replayed by both: `batch_transfers`, `batch_merge_history`, `bottle_runs`, `keg_fills`, `distillation_records`, `batch_volume_adjustments`, `batch_racking_operations`, `batch_filter_operations`.

### Live volume is delta-driven, never recomputed from history
Every mutation writes `batches.currentVolume` / `currentVolumeLiters` in place (deltas or absolutes) — `performBatchMerge`, `addAdditive`, `rackBatch`, `transferJuiceToTank`, `filter`, `createVolumeAdjustment`/`deleteVolumeAdjustment`, distillation, keg fill, packaging, `recipeExecution`. The trigger `trg_sync_volume_liters` (`packages/db/migrations/0115_add_reconciliation_safeguards.sql`) only unit-mirrors `currentVolume → currentVolumeLiters`; it does **not** compute from history. So the reconciliation formula is the *only* place that reconstructs truth, and nothing self-heals drift.

### The TTB form cannot "fail to balance" — it plugs
Reported `variance ≈ 0` is guaranteed by three plug points:
1. **Line 29 loss plug** — `ttb.ts:3431-3438` (comment: *"Line 29 is the 'plug' that makes the form balance"*).
2. **Line 9 gains flip** — negative losses flipped to "inventory gains" (`:3488-3502`).
3. **`reconAdj = physical − formula`** — `:6925`; `variance = 0` by construction (`:6928-6930`).

The **honest** signal already exists but isn't the headline: `sbdTotalDriftL` (SBD-reconstructed vs stored `currentVolumeLiters`, ~`:7364`). Filed 2024/2025 numbers live only as hardcoded test expectations (`ttb-golden-2025.test.ts:54-120`), never diffed against a recompute at runtime.

---

## 2. Root problems (why it doesn't reconcile)

**Per-batch formula (`checkVolumeBalance`):**
1. Live volume delta-driven, never recomputed — any missed/soft-deleted/out-of-order/double-applied op permanently desyncs.
2. `volume_manually_corrected` is a **dead-end**: never set by any API mutation (only 5 seeded batches in migration 0115), guards only `initial_volume_liters` on INSERT, and is **ignored by the formula**. No way to mark a hand-corrected batch "known-good."
3. `initial_volume_liters` vs `batch_merge_history` **split-of-truth** — press-run additions can be double-counted or missed depending on how they were recorded (the most fragile term).
4. Heuristic/string exclusions: `bottlingLoss` uses a `<2L` fuzzy test (`:387`); `rackingLosses` excludes rows by matching literal `"Historical Record"` in notes (`:394`).
5. `isTransferCreated` **90% cliff** (`:404`) — batches near the boundary flip between pass and large discrepancy.
6. Cross-batch terms depend on the counterparty's correctness; one-sided voids desync the two batches. Distillation counted only for `status IN ('sent','received')`.
7. **Unit ambiguity:** `batchMergeHistory.volumeAddedUnit` is fetched but **not applied** (`:379`); `kegFills.volumeTaken` assumed liters with no unit check.

**TTB summary:**
8. Balances by plugs (see §1) — real errors hidden in Line 29 / Line 9 / `reconAdj`.
9. Opening depends on which of 3 sources fires (finalized snapshot → manual seed → SBD; `:1683-1793`) — mixing sources across a boundary creates gaps.
10. `litersToWineGallons` clamps negatives to 0 (`packages/lib/src/calculations/ttb.ts:312`), inflating totals on net-negative flows.
11. Current-year ending uses live `currentVolumeLiters`; past years use SBD — asymmetry surfaces live drift as a plugged gap.
12. Dynamic tax-class classification (`classifyBatchTaxClass`, `:208`) can move volume between columns period-to-period.
13. `ttbWaterfallAdjustments` (manual plugs) are returned to the client but **not applied server-side** (`:7568`) — UI total and export can diverge.
14. Known residuals (~430.8 reconAdj, −261.5 packaging/distribution, −128 same-class inflows) are **absorbed, not resolved**.

Not a problem (verified correct): juice is excluded until it becomes cider/pommeau (`productTypeToTaxClass` null for juice, `:164`; production/opening/ending subtract juice).

---

## 3. Plan (phased)

### Phase 0 — Diagnostic (READ-ONLY, do this first; it scopes everything else)
- Run `checkVolumeBalance` across **all** batches; bucket by status (pass/warn/fail), magnitude, and probable cause (§2 items 3–7). Output: how much is *formula gap* vs *real data drift*.
- Compute `sbdTotalDriftL` per TTB period and decompose the known ~560 gal aggregate gap + current `reconAdj` into named categories (additions, bulk→packaged, inter-class transfers, negative endings).
- Deliverable: a short report that answers "is this mostly a formula bug, a data-entry backlog, or both?" — decides the size of Phases 1–3.
- Build it as a small read-only script using the real `checkVolumeBalance`/SBD functions (not a re-derivation), run via `pnpm --filter db exec tsx` (see `.claude/skills/db-query`).

### Phase 1 — One authoritative volume-from-history function
- Extract the volume reduction into a **single pure function** in `packages/lib` (e.g. `computeBatchVolumeFromHistory(events)`), and make BOTH `checkVolumeBalance` and `computeSystemCalculatedOnHand` call it. Kills the two-engine drift. Unit-test exhaustively.
- Fix the formula gaps while consolidating: apply merge/keg **units** (§2.7); resolve the `initial_volume_liters` vs merge-history double-count (§2.3); replace the 90% cliff with an explicit transfer-created flag (§2.5); replace the `"Historical Record"` string match and `<2L` bottling-loss heuristic with real columns/flags (§2.4); ensure distillation status coverage (§2.6).

### Phase 2 — Make live volume trustworthy + revive the manual-correction flag
- Add `recomputeBatchVolume(tx, batchId)` built on the Phase-1 function; **respect `volume_manually_corrected`**.
- Make `volume_manually_corrected` a **real, settable flag**: an API mutation sets it (with reason) when a user hand-corrects a volume; `checkVolumeBalance` and recompute must skip/annotate those batches instead of flagging them forever.
- Decide the architectural stance (a real decision to make): **(a)** keep delta-driven live volume but call `recomputeBatchVolume` after every volume-mutating op (self-healing), or **(b)** make `currentVolume` a derived read. Recommend (a) — smaller blast radius.
- **This phase unblocks the reverted transfer-delete/correction** — a safe delete/reversal falls out once recompute is authoritative and manual-correction is respected. See `project_transfer_volume_tracking` memory.

### Phase 3 — Replace TTB plugs with real derivations + a TRUE variance
- Promote `sbdTotalDriftL` to the headline reconciliation metric; stop reporting the plugged `variance ≈ 0`.
- Replace the Line 29 loss plug, Line 9 gains flip, and `reconAdj` with itemized derivations. Where a residual genuinely remains, label it "unexplained variance" and alert — never hide it.
- Apply `ttbWaterfallAdjustments` server-side (§2.13).
- Resolve (don't clamp/flip) negative batch endings and same-class cross-scope inflows (§2 items 10, 14).
- **Fix the period day-boundary here (bug-hunt finding #1), NOT standalone.** `generateForm512017` compares timestamp columns with `lte(col, endDate)` where `endDate` = 00:00 of the last day, silently dropping the entire last calendar day (understates removals/production/ending). The surgical fix (a next-day-midnight `endExclusive` with `lt`/`>= endExclusive` on ~40 timestamp comparisons) is correct and preserves internal parity — BUT tested in isolation it produced a **+1285/−1319 gal Hard Cider swing that only ~19 gal of real Dec-31 activity explains**, because the form plugs-to-balance (Line 29) and amplifies small boundary changes. So the boundary fix must land *after* the plugs are replaced, when its effect is a real number instead of plug noise. The isolated patch is reproducible: add `const endExclusive = new Date(endDate); endExclusive.setDate(endExclusive.getDate()+1)` after the `getPeriodDateRange` destructure, then `lte(col,endDate)→lt(col,endExclusive)`, `<= ${endDate}→< ${endExclusive}`, `> ${endDate}→>= ${endExclusive}` on timestamp columns only (leave `endDate.toISOString()` date-strings, `batches.endDate` column checks, and the display field). Golden tests will need re-derivation once it lands.

### Phase 4 — Snapshot-vs-recompute drift detection
- Store filed 2024/2025 numbers in the DB (they currently live only in tests) and add a runtime path that compares a recomputed period against its filed `ttbPeriodSnapshot`, flagging drift.
- Enforce opening-source consistency across period boundaries (§2.9).

### Phase 5 — Automation & trust surface (fold in existing PRD)
- Implement `.claude/prds/automated-reconciliation.md`: nightly recon job → `audit_logs`, dashboard "last reconciled at X / N drift items" badge, period-boundary snapshots, drift alerts.

---

## 4. Sequencing & acceptance criteria

**Order:** Phase 0 gates 1–3 → Phase 1 before 2 → 2 before 3 → 3 before 4 → 5 last (or parallel once 1–2 land).

**Done when:**
- One authoritative volume-from-history function; no duplicate formulas.
- Every active batch reconciles within tolerance **or** is explicitly `volume_manually_corrected` with a reason.
- The TTB form surfaces a real, non-plugged variance; residuals are itemized or flagged, not absorbed.
- A recomputed period matches its filed snapshot within tolerance; drift is alerted.
- The safe transfer delete/correction (currently reverted) is buildable on the Phase-2 recompute.

## 5. Decisions to make (before/early)
- Delta-driven + self-heal vs derived live volume (Phase 2 stance).
- Historical pre-2025 drift: backfill vs freeze via a finalized snapshot (PRD says pre-2025 backfill is out of scope).
- Tolerance thresholds for "reconciled" (per-batch and aggregate).

## 6. Key files
- Per-batch: `packages/api/src/validation/batch-validation.ts`; endpoint `packages/api/src/routers/batch.ts:3210-3472`.
- TTB: `packages/api/src/routers/ttb.ts` (SBD `:281-514`, form `:1664`, summary `:4916`); pure lib `packages/lib/src/calculations/ttb.ts`; schema `packages/db/src/schema/ttb.ts`.
- Trigger: `packages/db/migrations/0115_add_reconciliation_safeguards.sql`.
- UI: `apps/web/src/components/reports/BatchReconciliation.tsx`, `.../TTBReconciliationSummary.tsx`, `apps/web/src/app/reports/ttb/page.tsx`.
- Existing: `.claude/prds/automated-reconciliation.md`, `.claude/docs/ttb-reconciliation-2024.md`.
