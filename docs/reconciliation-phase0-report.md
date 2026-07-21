# Reconciliation Phase 0 — Diagnostic Report

> Deliverable of `docs/reconciliation-robustness-plan.md` §3 Phase 0.
> Generated 2026-07-20 by `packages/api/scripts/phase0-recon-diagnostic.ts` (read-only; calls the REAL
> endpoints — `batch.listForReconciliation` → `checkVolumeBalance`, `ttb.generateForm512017`,
> `ttb.getReconciliationSummary` — via a server-side caller, then diffs against the officially filed
> 2024/2025 Form 5120.17 numbers).

## Headline answer: is it a formula bug, a data-entry backlog, or both?

**Both — but the big numbers are formula/scope artifacts, not missing cider.**

| Bucket | Magnitude | Nature |
|---|---|---|
| 2025 hard-cider Line 29/31 delta vs filed | **~1,320 gal** | Data-entry timing (root cause per 2026-07-06 investigation): fall-2025 cider entered with 2026 `start_date`s → booked to tax-year 2026 and excluded from the 2025 recompute. The Line-29 plug then absorbs it as phantom "losses". Filed 4,093 is CORRECT; no amendment needed. Durable fix = `ttb_origin_year` period membership (engine work), not event re-dating. |
| 2026 stored-vs-reconstructed aggregate gap | **~518 gal** | Mostly scope mismatches between engines (packaging/distribution scope ~261 gal, same-class inflows ~128 gal, per-batch drift ~64 gal) |
| Real per-batch data problems (2026) | **~124 gal abs** (net +18 gal) | 4 batches, all transfer-created children — data + formula-edge issues |
| 2025 fruited-cider (wineUnder16) deltas vs filed | **~35–56 gal** | Same 2026-booking effect on the fruited-cider path (filed in 2025, system-dated 2026). NOT fixed by re-dating — the 2026-07-06 investigation confirmed Summer Blend 4 & 2a correctly keep 2026 dates; resolved by period-membership (`ttb_origin_year`), plus dedup of duplicate-named 2025/2026 batches. |
| 2024 recompute | n/a | 2024 is **not event-sourced** — recompute is meaningless except ending inventory (system 1,051.8 vs filed 1,061 = −9.2 gal) |

**Consequence for the filed-2025 decision (§5 of the plan):** do **not** amend the 2025 filing based on
today's recompute — the dominant delta is engine artifact, not fact. Re-run this comparison after
Phases 1–3 (one engine, no plugs, boundary fix); the residual *real* delta is expected to be tens of
gallons, at which point amend-vs-roll-forward becomes a genuine choice.

---

## A. Per-batch engine (`checkVolumeBalance`) sweep

| Year | Batches | Pass | Warning | Fail | Net discrepancy | Abs discrepancy |
|---|---|---|---|---|---|---|
| 2024 | 21 | 21 | 0 | 0 | 0 L | 0 L |
| 2025 | 49 | 49 | 0 | 0 | 0 L | 0 L |
| 2026 | 58 | 54 | 1 | 3 | +68.6 L (+18.1 gal) | 468.6 L (123.8 gal) |

The per-batch engine is **healthy for closed years** and the 2026 problems are concentrated in exactly
4 batches — **all transfer-created children** (`parentBatchId` set, category `new_production`),
matching plan §2 root causes 3/5/6 (initial-vs-merge split of truth, 90% transfer cliff, one-sided
cross-batch ops):

| Status | Discrepancy | Batch | Note |
|---|---|---|---|
| fail | **−200 L** | Summer Community Blend 4 `…Tmn6yxvzc` | Mirrors the +200 L below — a one-sided/mis-attributed 200 L transfer between the pair |
| fail | **+200 L** | Hopped Cider `…Tmn6yxvzc-Tmpox6nyq` | Other half of the pair |
| fail | +58.6 L | Hopped Cider `2025-11-27_DRUM-120-12` | The known **−15.5 gal Hopped Cider drift** (58.6 L ≈ 15.5 gal) flagged on the reconciliation page |
| warning | +10 L | Raspberry Blackberry `…Tmmculla4` | Small |

Other checks: only 2 `active_volume` warnings and 1 `classification_data` warning (2026), 1
`classification_data` warning (2025). No batch uses `volume_manually_corrected` (confirming plan §2.2 —
the flag is a dead-end today).

## B. Second engine (SBD reconstruction) — drift & the "~560 gal" gap

Per-batch SBD drift (stored `currentVolumeLiters` vs history reconstruction), |drift| > 0.5 L:

- **2025:** 7 batches, total **−112.2 L (−29.6 gal)**. Largest two are a **±128.6 L mirrored pair**
  (120 Barrel 4 BIPE −128.6 vs 120 Barrel 1 BLEND +128.6) → volume recorded against the wrong sibling,
  nets to ~0.
- **2026:** 18 batches, total **−240.4 L (−63.5 gal)**. Again dominated by a mirrored pair
  (1000 IBC 1 BLEND lineage: −201.8 vs +180) plus the same ±128.6 pair and the 58.6 L Hopped Cider.

**Decomposition of the known "~560 gal" aggregate gap:** as of this run,
`systemCalculatedOnHand` 3,371.8 gal vs `systemReconstructedOnHand` 2,853.9 gal = **517.9 gal**.
Named categories:

| Category | ~gal | Source |
|---|---|---|
| Packaging/distribution scope mismatch | ~261 | Known residual (memory: `project_residual_261`) — packaged/distributed volume counted in one scope but not the other |
| Same-class inflows from non-recon batches | ~128 | Known residual (memory: `project_negative_losses`) |
| True per-batch SBD drift | ~64 | Sum of the 18-batch list above |
| Remainder (unattributed) | ~65 | To fall out of Phase 1 single-engine consolidation |

The two engines also disagree with each other (plan §1's core problem): per-batch `checkVolumeBalance`
says 2025 is fully balanced while SBD sees −29.6 gal of 2025 drift — direct evidence of two-formula
divergence, not of two different realities.

Note: the 2026 form's own `reconciliation.variance` is **−383 gal / balanced: false** — the plug does
not even fully absorb the gap intra-form anymore.

## C. Recomputed annual forms vs FILED numbers

### 2024 (filed 1/13/2025) — not comparable line-by-line

The 2024 recompute bears no resemblance to the filing on flow lines (produced 507.8 vs 1,496; bottled
0 vs 90; distilling 0 vs 264; blending 0 vs 42) because **2024 activity is not in the system as
events** — it predates full event capture. The *ending* inventory is close (HC 1,051.8 vs 1,061 filed;
wine16To21 59.4 vs 60). WineUnder16 ending disagrees (system 197.9 vs filed 0) — a classification
difference, not volume creation.

**Implication:** 2024 must be **frozen via a finalized snapshot** (plan Phase 4), never recomputed.
This resolves the plan §5 "backfill vs freeze" question in favor of freeze.

### 2025 (filed 2/27/2026) — structurally close; one giant plug artifact

Lines that match filed within ~1 gal: HC opening (exact), HC bottled (148.9 vs 149), HC Section B
(all), wine16To21 opening/spirits/bottled/ending, wineUnder16 taxpaid (566.3 vs 566). The engine's
event base for 2025 is fundamentally sound.

The deltas, categorized:

| Line | Filed | System | Δ | Explanation |
|---|---|---|---|---|
| HC line 29 losses | 199 | **1,523.1** | **+1,324** | **Data-entry backlog booked to the wrong tax year** (root cause, 2026-07-06 investigation): ~27 cider/perry batches physically pressed Sept–Nov 2025 (their `origin_press_run_id` → 2025 press runs) were entered with 2026 `start_date`s, so the engine excludes them from 2025; the Line-29 plug absorbs the gap as phantom losses. Actual *recorded* HC losses in 2025: **253.6 gal**. Fix = `ttb_origin_year`-based period membership (column exists since migration 0102, referenced nowhere in `ttb.ts`) + backfill — engine work, NOT event re-dating. |
| HC line 31 ending | 4,093 | 2,772.9 | **−1,320** | Mirror of the above. Filed 4,093 is correct; system 2,772.9 is a faithful reconstruction of the data *as entered*. |
| wU16 line 10 class-in | 675 | 618.9 | −56.1 | Same 2026-booking effect on the fruited-cider path (Summer Blend 4 & 2a correctly keep their 2026 dates — do NOT re-date) |
| wU16 line 13 bottled / B ending | 628 / 62 | 592.7 / 26.4 | −35.3 / −35.6 | Same cause — the missing ~35 gal of bottling is consistent across Section A and B |
| w16-21 line 29 losses | 1 | 45.8 | +44.8 | Pommeau-scope losses; needs a look during Phase 1 (not a plug — appears in the class totals) |
| HC line 2 produced | 4,808 | 4,818.0 | +10.0 | Rounding/small event edits since filing |
| HC line 16 distilling | 758 | 753.2 | −4.8 | Small |

### Reproducibility check (golden tests, run 2026-07-20)

The `ttb-golden-2025` suite (filed PDF numbers as assertions, live DB): **55 pass / 18 fail** —
failures line up exactly with the categorization above:

- **HC Line 29 +1,284.9 / Line 31 −1,319.4** — the plug artifact (near-mirror pair; the ~35 gal
  difference between them equals the wineUnder16 packaged gap).
- **wU16 packaged −35.5 (Sections A and B), ending −35.6, produced −10.0** — the 2026-dated blend
  events.
- **w16-21 Line 12 total +45.7** — the pommeau-scope losses.
- Materials: apples −357 lbs (tolerance 100).
- Internal checks: overall form variance 14.8 gal (limit 2); whole-history stored-vs-reconstructed
  drift **1,172 gal** over 6 batches — dominated by depleted staging blend batches where
  stored = 0 L but the reconstruction returns the full pre-transfer volume (e.g. IBC 1 BLEND
  stored 0 / reconstructed 1,000 L). That is an engine-scope bug (fully-transferred sources), not
  lost cider, and includes the same ±128.6 L mirrored barrel pair found in §B. Transfer in/out
  imbalance 189.7 gal (limit 50).

Every failure is attributable to a named category; no unexplained line-item deltas remain.

---

## Recommendations (feeds Phases 1–3 scoping)

1. **Phase 1 (one engine) proceeds as planned** — the per-batch engine is trustworthy for closed years;
   consolidation should preserve its behavior, fix the SBD scope mismatches (the ~518 gal gap's
   biggest components are *scope*, not arithmetic), and adopt
   `COALESCE(ttb_origin_year, EXTRACT(YEAR FROM start_date))` for period membership so backlogged
   fall-2025 cider books to the right tax year without re-dating events.
2. **The day-boundary fix still lands with the de-plug (Phase 3)** — real Dec-31 effect is small
   (~19 gal); the plug turns boundary changes into large phantom swings.
3. **Small, immediate data-entry fixes** (safe now, before any engine work; scoped to 2026 end-state
   correctness — 2024/2025 stay untouched):
   - Investigate the ±200 L Summer Community Blend 4 ↔ Hopped Cider transfer pair (one 200 L transfer
     recorded one-sided or double).
   - The 58.6 L Hopped Cider drift (the known −15.5 gal item).
   - The +10 L Raspberry Blackberry warning.
   - Dedup the duplicate-named 2025/2026 batch pairs (Summer Community Blend 4, Winter Blend 2) if
     they double-count current inventory.
   - DEFERRED: the ±128.6 L 120-Barrel-4 ↔ 120-Barrel-1 pair (2025 events, nets to zero, both batches
     depleted — reconstruction noise only, no effect on 2026 end state).
4. **2024: freeze via finalized snapshot** (Phase 4); do not attempt event backfill.
5. **2025 filing: NO amendment** (decided). Filed numbers are correct; the system diff is the
   as-entered backlog. Owner's direction (2026-07-20): 2024/2025 recompute parity is NOT a goal —
   correct 2026 end state is the acceptance bar.

## Addendum — data fixes applied 2026-07-20 (owner-approved)

Investigation (audit-trail traced, read-only agents) found the four per-batch flags were data
artifacts, plus ~2,070 L of phantom inventory from backlog data entry. Six fixes applied via
`scripts/query.ts --write`, each owner-confirmed against physical reality:

| Fix | Rows | Effect |
|---|---|---|
| Hopped Cider `37693faf` initial 71.25→130 L | `batches` | An **un-audited write path** had overwritten `initial_volume_liters` with the bottle-run volume after 2026-04-11 (no audit_logs entry — separate code bug to hunt) |
| Raspberry Blackberry duplicate ops | soft-deleted rack `3819ffaa`, filter `075281ae` | Residue of the fixed op-duplication bug (`ad583f1`); parent kept the real 5+5 L losses |
| SCB4 `e48435d2` current 470→670 L | `batches` | Duplicate 200 L transfer had been remediated twice (transfer deleted AND volume left debited); owner chose ledger value, any later physical difference to be one explicit adjustment |
| Redundant −200 L adjustment | soft-deleted `ad6b5ae8` | The second remediation of the same duplicate, on the Hopped Cider side |
| SCB4 phantom `a8901e0e` (1,040 L, TANK-1000-2) | zeroed + soft-deleted | Inert duplicate sibling; owner confirmed tank physically empty |
| WB2 phantom `688835da` (1,030 L, TANK-1100-1) | zeroed + soft-deleted | Owner confirmed the real ~1,030 L is in TANK-1100-2 (root batch `adf4e342`) |

**Post-fix verification (diagnostic re-run):** 2026 per-batch 58/58 pass, 0 L discrepancy.
Current inventory 3,385.2 → 2,906.7 gal. 2024/2025 outputs verified byte-identical (per-batch all
pass; 2025 form ending lines unchanged to the decimal) — the owner's no-touch constraint held.
The 518-gal calc-vs-reconstructed gap did NOT move: phantoms were counted on both sides, so that gap
is confirmed pure engine-scope mismatch (Phase 1 target), superseding this report's earlier partial
attribution of it to phantom data.

**Deferred / follow-up items raised by the investigation:**
- Systemic blend-source mis-entries: transfers claiming 525 L / 515 L drawn from 40 L batches
  (`033bb617` Winter Blend 1, `e168c78d` Winter Blend 4) feed both former phantoms and the real SCB4 —
  one dedicated cleanup pass needed. The deleted phantoms' inflow transfer rows were left in place for it.
- ~~Un-audited `initial_volume_liters` write path~~ **RESOLVED 2026-07-20.** Root cause: migration
  `0113_sync_volume_liters_trigger.sql`'s one-time backfill copied the stale legacy `initial_volume`
  column over the app-maintained `initial_volume_liters` (0114's header comment admits the mistake but
  never repaired the clobbered rows). Hopped Cider was the sole active victim (restored; signature
  sweep found no others — Melrose Base / Golden Delicious Base / Duskrun all reconcile via merge
  history). Systemic guard added: `apply-migration.ts` now records applied files in an
  `applied_migrations` table (seeded with all 159 existing migrations) and refuses re-application
  without `--force` — one-time backfills like 0113's can no longer re-fire. Residual (Phase 2 scope):
  `fix-missing-initial-volume.ts` and API volume writes still bypass `audit_logs`; the dual
  `initial_volume`/`initial_volume_liters` columns remain a standing drift hazard until the legacy
  column is retired.
- ±128.6 L 120-Barrel-4 ↔ 120-Barrel-1 pair (2025 events, nets to zero, both depleted) — reconstruction
  noise only; revisit during Phase 1.
- `vessels.status` is unreliable (everything reads 'available') — occupancy must come from
  `batches.vessel_id` + volume.

## Reproduction

```bash
pnpm --filter api exec tsx scripts/phase0-recon-diagnostic.ts --json /tmp/phase0.json
```

Read-only; safe to re-run any time. The JSON output contains full per-batch details, form dumps, and
the filed-number comparison.
