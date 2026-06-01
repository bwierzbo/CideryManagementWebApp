---
name: transfer-cleaning-workflow-hardening
description: Fix workflow gaps in transfers and cleaning that allow silent data corruption — duplicate transfer submissions, hidden cleaning status, and a destination dropdown that excludes vessels mid-cleaning
status: backlog
created: 2026-05-28T03:30:00Z
---

# PRD: Transfer & Cleaning Workflow Hardening

## Executive Summary

Three related bugs in the transfer/cleaning flow allow silent data corruption and operator confusion. All three were hit in a single session on 2026-05-28 while transferring out of TANK-1000-1. Fix them as one focused workflow-hardening pass.

## Problems

### 1. Duplicate transfer submission (no idempotency)
- **Observed:** Two identical `batch_transfers` rows were created 11 seconds apart for a single 200 L transfer from TANK-1000-1 → TANK-500-2 (txIds `04a7ba2a` and `58116d67`). The destination batch was credited 400 L instead of 200; the source was only debited once.
- **Cause:** The transfer mutation has no idempotency guard. A double-click or rapid re-submission creates two rows.
- **Asymmetric corruption:** Source was protected (single debit), destination was over-credited (double). Math doesn't close — and there's no automatic check that catches it.

### 2. Silent cleaning state — vessel mid-cleaning still has liquid
- **Observed:** TANK-1000-1 was marked `status = "cleaning"` while still holding 125 L of an active batch. The UI gave no visible cleaning indicator because `VesselMap.tsx:1488` shows full batch actions when `currentVolume > 0` regardless of status.
- **Cause:** "Prep for Cleaning" can be run on a vessel that still has volume, and the cleaning-status badge is suppressed in the standard vessel card whenever liquid is present.
- **Effect:** Vessel looks normal in the UI but behaves abnormally elsewhere (see #3).

### 3. Transfer destination dropdown excludes "cleaning" vessels
- **Observed:** TANK-1000-1 was missing from the destination dropdown despite being usable in the rest of the UI.
- **Cause:** `TankTransferForm.tsx:156` filters destinations to `status === "available"`. Cleaning vessels are hidden — even when they still contain a batch that could legitimately be merged into.
- **Effect:** Operator can't complete a valid merge-transfer; appears as a missing-tank glitch.

### 4. Destroy Batch form skips required action metadata
- **Observed:** Destroying Ashmeads Kernel #1 (CARBOY-5G-5) on 2026-05-28 wrote an adjustment row with `adjustmentDate = createdAt` (i.e., right now) and no worker, no labor hours, no destruction time recorded. The actual destruction happened on 2026-05-12.
- **Cause:** The Destroy Batch modal doesn't collect the fields we capture on every other batch action — date, performed-by user, labor hours, optional notes.
- **Effect:** Audit trail loses the *when* and *who*. Backdating requires manual DB intervention (as just done for this batch).

### 5. Discarded batch overrides cleaning color on vessel card
- **Observed:** After destroying Ashmeads Kernel #1, the CARBOY-5G-5 cellar card turned **grey** ("batch discarded") instead of **yellow** ("ready for cleaning"), even though the vessel status was correctly set to `cleaning`.
- **Cause:** `VesselMap.tsx:451-465` checks batch status before vessel status. A discarded batch (status="discarded") wins precedence over the vessel's cleaning state, so the card colors grey.
- **Effect:** Operator can't see at a glance which vessels need cleaning attention — destroyed-batch vessels blend in with general "completed" grey.

### 6. Destroyed-batch vessel still shows stale measurement data (ABV/SG/pH)
- **Observed:** After destroying Ashmeads Kernel #1, CARBOY-5G-5's card still displays the last-recorded ABV, SG, and pH from the destroyed batch.
- **Cause:** The vessel card pulls the most recent measurements from the still-linked discarded batch. There's no logic that clears or hides those fields once the batch is destroyed.
- **Effect:** A destroyed-and-cleaning vessel looks like it still has a live batch with chemistry readings. Confusing and misleading.
- **Required behavior:** A vessel with no active batch (i.e., its associated batch is `discarded` or `completed` with volume=0) should display as empty — no ABV/SG/pH carry-over from the prior batch. Either clear the display, or detach the batch from the vessel on destroy.

### 7. Edit Transfer UI only supports date — not source vessel or source batch
- **Observed:** Raspberry Blackberry was transferred into TANK-120-MIX-2 with the wrong source vessel logged (TANK-1000-1 instead of TANK-500-2). The existing `EditDateDialog` only accepts a `transferredAt` change; `updateTransferSchema` in `packages/api/src/routers/batch.ts:506` has no fields for source vessel or batch. Correcting the entry required a direct SQL transaction (also rebalancing `current_volume` on both source batches).
- **Cause:** The transfer edit flow was scoped to backdating only.
- **Effect:** Any mis-attribution of source vessel/batch is unfixable through the UI. Operators have to either accept the bad data or escalate for direct DB edits. Volume drift compounds because the source batches' `current_volume` was debited against the wrong batch and there's no UI flow to un-debit + re-debit.

## Goals

1. **Idempotent transfer mutation** — reject (or no-op) duplicate `{sourceBatchId, destBatchId, volumeTransferred, transferredAt}` within a short window (e.g., 60s), with a clear error to the client.
2. **Client-side double-submit guard** — disable Save button while transfer is in flight; show pending state.
3. **Block "Prep for Cleaning" on non-empty vessels** — require a destination transfer (or explicit Destroy Batch) first. Don't allow the hybrid "cleaning + has liquid" state.
4. **Visible cleaning indicator** — when a vessel is in cleaning state, show the badge prominently regardless of liquid content.
5. **Transfer dropdown includes cleaning vessels with content** — match the VesselMap rule (`status !== "cleaning" || currentVolume > 0`) so merge-transfers stay possible.
6. **Destroy Batch form parity with other batch actions** — collect: destruction date (default today, editable), performed-by user, labor hours, optional notes — same fields measurements/additives/transfers capture today. Write these to the `batch_volume_adjustments` row and the audit log.
7. **Cleaning color wins over discarded** — when a batch is `discarded` and its vessel is in `cleaning`, color the card yellow (cleaning takes priority). A discarded batch with no further action expected is dead weight in the visual cue.
8. **Detach destroyed batch from vessel** — on Destroy Batch, either clear `batches.vesselId` (so the vessel card shows empty) or suppress ABV/SG/pH/volume fields for discarded batches in the card view. The vessel should visibly *be* empty after destruction, not just colored differently.
9. **Edit Transfer: support source vessel + source batch reassignment** — extend `updateTransferSchema` and the edit dialog to accept new `sourceVesselId` / `sourceBatchId` values, with an atomic rebalance of `current_volume` (and `current_volume_liters`) on the old and new source batches (+volume back to old, −volume from new). Also allow editing the destination batch's `start_date` to track the corrected transfer time. Require a reason/note on save so the audit log captures *why* the source changed.

## Out of Scope

- Reworking the full transfer audit trail (handled by automated-reconciliation PRD)
- Backfilling prior duplicate transfers (one-off manual fix on 2026-05-28 already done)

## Open Questions

- Should the idempotency window be configurable, or hardcoded to 60s?
- For #3 (block prep-for-cleaning on non-empty vessels): does the current Prep for Cleaning flow have a legitimate "leave dregs and clean around them" use case? If yes, define what that should look like (sediment loss + status flip in one step).

## Dependencies

- Overlaps with `automated-reconciliation` PRD — duplicate transfers are exactly the kind of drift automated reconciliation should catch.
- Touches: `packages/api/src/routers/batch.ts` (transfer mutation, prep-for-cleaning), `apps/web/src/components/cellar/TankTransferForm.tsx`, `apps/web/src/components/cellar/VesselMap.tsx`, `apps/web/src/components/cellar/PrepForCleaningModal.tsx`.

## Priority

**Deferred** — incidents captured, manual fixes applied. Revisit after data entry catch-up. High priority within the corrective-actions phase since silent transfer corruption is a data integrity risk.

## Incident Log

- **2026-05-28** TANK-1000-1 marked cleaning while still holding 125 L of Summer Community Blend 4 → invisible in transfer dropdown. Manually flipped status back to `available`.
- **2026-05-28** Double-submitted 200 L transfer TANK-1000-1 → TANK-500-2 created two `batch_transfers` rows; destination over-credited to 400 L. Manually corrected to 200 L with a `correction_down` adjustment, duplicate row `04a7ba2a` soft-deleted.
- **2026-05-28** Ashmeads Kernel #1 destroyed in CARBOY-5G-5 without date prompt. Adjustment row got `adjustmentDate = today`; actual destruction was 2026-05-12. Manually backdated `adjustmentDate` and `batches.endDate` to 2026-05-12T19:00Z. Worker, labor hours, etc. were never collected. Card shows grey (discarded) instead of yellow (cleaning), and still displays stale ABV/SG/pH from the destroyed batch.
- **2026-05-31** Raspberry Blackberry transfer (id `4321473f-1741-4983-9b11-1102b1403a35`) had wrong source: logged as TANK-1000-1 / SCB4 (`e48435d2…`) at 2026-05-11 14:21; actual source was TANK-500-2 / SCB4 (`a408aa3c…`) at 2026-05-13 04:00 (after the post-Somerset refill). Required a 4-statement DB transaction: corrected the transfer row, +120L to SCB4-in-TANK-1000-1 (`675 → 795L`), −120L from SCB4-in-TANK-500-2 (`349.825 → 229.825L`), and moved Raspberry Blackberry `start_date` to 2026-05-13 04:00. Physical inventory confirmed the corrected volumes. Drove problem #7 / goal #9.
