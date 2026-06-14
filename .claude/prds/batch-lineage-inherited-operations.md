---
name: batch-lineage-inherited-operations
description: Show inherited additives and operations from parent batches on child batches; compute recipe rates against the blend volume at time of addition, not against initial/current batch volume
status: backlog
created: 2026-05-28T19:00:00Z
---

# PRD: Batch Lineage & Inherited Operations

## Executive Summary

Child batches (blends, splits, transfers into a new vessel) currently show only the additives and operations explicitly logged against them. Anything pitched into a parent batch — yeast, sulfites, nutrients — disappears from the child's view. The operator has to mentally trace the lineage to know what's actually in the cider.

This PRD makes that lineage first-class: the child batch view should display inherited additives from all upstream parents, clearly distinguished from operations explicitly added at the child level. It also fixes a related display bug where recipe rates (g/L) are computed against the wrong reference volume.

## Problem Statement

### Observed incident (2026-05-28 review of Hopped Cider)

Hopped Cider (batchNumber `…DRUM-120-12_MELR_A-Tmk7rnymu`) was assembled from four parent batches on 2026-03-20:

| Parent | Volume to child | Yeast (AB-1) logged on parent? |
|---|---|---|
| OBC Cider Blend | 17.97 L | ✓ 17.97 g (2024-11-28) |
| OBC Cider #2 | 22.4 L | ✓ 5 g (2025-11-16) |
| Calvados Barrel Aged #2 | 9.7 L | ✓ 25 g (2025-10-21) |
| Melrose (large parent) | 130 L (later soft-deleted) | ✗ none logged |

The Hopped Cider batch view shows only Cascade hops + Citra hops + cane sugar. Yeast appears nowhere — making it look like an unyeasted batch, even though three of four parents were pitched.

### Related display bug — recipe rate against wrong volume

The Hopped Cider notes say "Put in a total of 2.5 g/L of combined hops" — correctly computed against the 120 L blend volume at the time of dosing. But the system stores `initialVolumeLiters = 71.25 L` (a misleading post-loss number), so any UI that displays "additive amount ÷ batch volume" produces **4.21 g/L** instead of the operator's intended **2.5 g/L**. The note becomes the only reliable source of truth.

## Goals

1. **Inherited additive rollup on child batches** — when viewing a child batch, show a section "Inherited from parents" listing all upstream additives (yeast, sulfites, nutrients, etc.), volume-weighted by the share each parent contributed.
2. **Visually distinguish** explicit additives (added directly to this batch) from inherited (came in via blend/transfer).
3. **Lineage view** — make the parent → child graph navigable: clicking an inherited additive should reveal which parent it came from and how much volume that parent contributed.
4. **Recipe rate computed against the right reference volume** — when an additive is recorded with a rate unit (g/L, mL/L, g/hL), the displayed rate should be computed against the *blend volume at the time the additive was added*, not against `initialVolumeLiters` or `currentVolumeLiters`.
   - Source of truth: at additive-add time, record a snapshot `blendVolumeAtAdditionL` on the `batch_additives` row.
   - Backfill: for existing additives, fall back to `volume at addedAt` from batch_volume_adjustments + transfers.
5. **Missing-yeast detection** — if no fermentation organism appears anywhere in a child batch's full lineage (explicit or inherited), flag the batch (warning, not error). Helps catch entry gaps like the Melrose 345 L parent that has no yeast logged.

## Out of Scope

- Auto-backfilling missing yeast pitches (operator must confirm)
- Recipe inheritance for the recipes feature (`prd-recipes` covers ordered production schedules; this PRD covers retrospective additive display)
- Changing the underlying lineage data model — `batch_transfers` and the parent/child batch graph already capture enough

## Open Questions

- For multi-stage lineage (grandparent → parent → child), how deep should the inherited rollup display before collapsing? Default proposal: show two levels expanded, collapse deeper with "show more."
- When a parent's volume share rounds to <1%, hide it from the inherited view? (Avoids long tail of tiny contributions clouding the picture.)
- What about additive *dates* on inherited entries — display the parent's `addedAt`, or the date of the transfer that brought it in? Probably both: "AB-1 from OBC Cider Blend, pitched 2024-11-28, blended in 2026-03-20."

## Dependencies

- Touches: batch detail page (`apps/web/src/app/cellar/batch/…` or wherever the batch view lives), `packages/api/src/routers/batch.ts` (new query for inherited additives), `batch_additives` schema (add `blendVolumeAtAdditionL` column).
- Overlaps with `prd-recipes` (per-batch production schedules) — recipes will eventually want lineage-aware display of completed steps. Build the lineage view here; recipes consumes it.
- Overlaps with `automated-reconciliation` — the −15.5 gal drift on Hopped Cider is the same underlying volume tracking problem that makes recipe-rate display unreliable.

## Priority

**Deferred** — captured for the corrective-actions phase. Medium priority: the data is all in the DB (lineage via `batch_transfers`, additives via `batch_additives` on each parent), it's just not being surfaced. Pure display improvement, no schema rework needed beyond the optional `blendVolumeAtAdditionL` field.

## Incident Log

- **2026-05-28** Hopped Cider review: child shows no yeast (3 of 4 parents had AB-1 logged, 1 parent missing yeast entry entirely). Recipe rate display reported 4.21 g/L for hops when the actual operator-intended rate was 2.5 g/L (correctly noted, but against the 120 L blend, not the 71.25 L `initialVolumeLiters`).
