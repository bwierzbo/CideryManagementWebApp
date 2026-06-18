---
name: recipe-execution-work-queue
description: Turn a recipe template into a live batch — instantiate (new batch or attach to existing) into a scheduled, per-step task list surfaced in a cross-batch work queue, where each task opens the existing pre-filled action modal and records the operation. Phase 5 (execution) of the recipe roadmap.
status: backlog
created: 2026-06-17T13:10:30Z
---

# PRD: Recipe Execution & Cross-Batch Work Queue

## Executive Summary

Recipe **authoring** is done (templates, steps, triggers, BOM, labor, planning).
This PRD covers recipe **execution**: pressing "Use this recipe" turns a recipe
version into a live batch with a **scheduled, per-step task list**, and those
tasks appear in a single **cross-batch work queue** (Today / This week / Overdue).
Each task opens the *same* pre-filled action modal as today's manual flow and
records the real operation — so recipe-driven and manual work converge on one
set of mutations and one inventory drawdown.

This is Phase 5 of the recipe roadmap and the largest piece: ~4 new tables, a new
work-queue surface, and wiring into the existing action modals.

## Decisions (locked with user 2026-06-17)

1. **Instantiation: both modes, chosen each time.**
   - *Create new* — pick the starting liquid (an existing base batch for recipes
     with a `parent_batch_requirement`, e.g. Coastal Hop on base cider; or a press
     run / juice), create a new batch linked to that source, drive it with the recipe.
   - *Attach to existing* — apply the recipe's task list to a batch already created
     manually; no new batch.
2. **Assignment: shared queue + optional assignee.** One cross-batch queue everyone
   sees; a task *can* be assigned to a `worker` (feeds labor costing) but assignment
   is not required.
3. **Scheduling: recompute from actual completion.** Completing a step shifts
   downstream due-dates via the existing trigger model (`after_previous`,
   `date_offset_from_previous`, `date_offset_from_start`). Late/early ripples forward.
4. **Flexibility: soft warnings.** Any step can be completed, skipped, or done out
   of order; the system warns (confirm dialog) on out-of-order completion or skipping
   a non-optional step. "A guide, not a cage."

## Foundations that already exist (reuse, don't rebuild)

- **Trigger/schedule math:** `packages/lib/src/recipes/triggers.ts`
  (`computeCumulativeOffsets`, `summarizeStepTrigger`) — already powers the recipe
  view's "5 days from start". Reuse for due-date computation + recompute.
- **BOM + labor:** `computeRecipeBOM`, `computeRecipeLabor` — pre-fill quantities and
  per-task labor estimates.
- **Action mutations (the manual flow each task reuses):**
  | Step kind | Existing mutation | File |
  |---|---|---|
  | add_additive / pitch_yeast | `batch.addAdditive` | batch.ts |
  | measurement | `batch.addMeasurement` | batch.ts |
  | rack | `batch.rackBatch` | batch.ts |
  | filter | `batch.filter` | batch.ts |
  | transfer | `batch.transferJuiceToTank` | batch.ts |
  | carbonate | `carbonation.start/record/complete` | carbonation.ts |
  | package | `packaging.createFromCellar` | packaging.ts |
  | pasteurize | fields on `bottleRuns`, **no mutation yet** | packaging.ts |
  | label | fields on `bottleRuns`, **no mutation yet** | packaging.ts |
  | qa_gate | **none — build sign-off** | — |
  | wait / note | no-op (mark done) | — |
- **Batch parent/child:** `batches.parentBatchId`, `rackBatch`, `batchTransfers`,
  `batchMergeHistory`.
- **Labor:** `workers` + `activityLaborAssignments` (polymorphic) for capturing
  hours per task.

## Gaps to build

- No task / work-queue / scheduling tables (build from scratch).
- No dedicated **pasteurize** / **label** mutations (fields exist on `bottleRuns`).
- No **qa_gate** sign-off.
- No central raw-ingredient **on-hand balance**. Drawdown rides on the existing
  `addAdditive` → purchase-line `quantityUsed` mechanism; v1 **soft-warns** on
  likely shortfall (using buy-list/planning data) rather than hard-blocking.

## Data model (proposed)

- **`batch_recipe_executions`** — links a batch to the recipe *version* it's running.
  `id, batch_id (unique), recipe_id, recipe_version, mode ('new'|'attach'),
  start_date, bottle_volume_l, keg_volume_l, status ('active'|'completed'|'abandoned'),
  created_by, created_at`. One active execution per batch (1:1) for v1.
- **`batch_step_tasks`** — the work-queue items; a **snapshot** of each recipe step at
  instantiation (so later recipe edits don't disrupt in-flight batches).
  `id, execution_id, batch_id, sequence, kind, label, description, packaging_path,
  is_optional, trigger_kind, trigger_data, action_data,
  scheduled_date (computed), due_date, status ('pending'|'in_progress'|'done'|'skipped'),
  completed_at, assigned_worker_id (nullable), result_ref (jsonb: {type,id} of the
  operation row created — e.g. batchAdditiveId), estimated_hours, actual_hours, notes`.
- Tasks for keg-path vs bottle-path steps are generated per the split: a side with
  0 L suppresses its tasks; optional steps default included but skippable.
- Snapshot rationale mirrors `recipe_versions`: in-flight batches are immutable to
  template changes.

## Work queue UX (the hero surface)

- New top-level **"Work"** (or "Tasks") nav item → cross-batch queue.
- Grouped, time-ordered: **Overdue · Today · This week · Upcoming**, plus a Done view.
- Filters: by batch, by worker, by step kind, by packaging path.
- Each row: batch name · step label · due date · status · optional assignee chip.
- Click a task → the matching **pre-filled action modal** (additive variety +
  BOM-computed quantity for this batch's volume; measurement fields; etc.).
- Completing the action: records the real operation (reusing the mutation), marks the
  task done, stamps `actual_hours` (→ `activityLaborAssignments` when a worker is set),
  and **recomputes downstream due-dates** from the actual completion time.
- Soft warnings: confirm dialog on out-of-order completion or skipping a non-optional
  step. Skip/undo supported.
- Per-batch view: the same task list shown on the batch detail page as a checklist +
  timeline (read + act).

## Milestones (phased so each lands independently)

- **M1 — Instantiation + schedule generation.** Tables; "Use this recipe" wizard
  (mode select, start date, volume, bottle/keg split, source-batch picker, optional-step
  include/skip); generate `batch_step_tasks` with initial due-dates from triggers.
  Read-only checklist on the batch page. *No actions yet.*
- **M2 — Work queue surface.** Cross-batch queue (Overdue/Today/Week/Upcoming),
  statuses, manual complete/skip with soft warnings, dynamic reschedule on completion,
  optional worker assignment. Tasks completable as plain checkboxes (no action wiring yet).
- **M3 — Action wiring (the payoff).** Task → pre-filled modal for the kinds that
  already have mutations (add_additive, measurement, rack, filter, transfer, carbonate,
  package). Record operation + link `result_ref` + BOM-prefilled quantities.
  - **Partial draw from a base cider (user, 2026-06-18).** When a new batch starts
    from an existing cider, the first transfer step must move just the chosen
    portion (e.g. 120 L out of a 1000 L base) into a target vessel — exactly the
    existing split-transfer/rack mechanism (`batchTransfers` + partial volume +
    new vessel) used to make fruited cider today. The wizard's "Total volume" is
    that portion; M3's transfer step needs a TARGET VESSEL input and reuses
    `rackBatch`/transfer to draw the portion and seed the working batch. New-mode
    M1 batches are shells (no vessel/liquid) until this transfer runs.
- **M4 — Fill the gaps.** Pasteurize + label mutations; qa_gate sign-off; inventory
  drawdown pre-fill + soft shortfall warnings; per-task labor capture.
- **M5 — Later.** Due-date notifications; role-scoped queue views (ties to
  multi-user roles); promote a planner `planned_batch` directly into an execution.

## Open questions / to resolve during M1

- Can a batch run **more than one** recipe over its life (e.g. base cider recipe, then
  a hopped sub-recipe)? v1 assumes one active execution per batch; revisit.
- "Attach to existing" with steps already physically done — allow bulk "mark first N
  done" at attach time? (Likely yes.)
- Exact source-liquid handling per `recipeInputs.kind`
  (`parent_batch_requirement` vs `press_run_requirement` vs `juice_purchase_requirement`).
- Where labor `actual_hours` is entered — in the action modal, or a quick prompt on
  complete.
- **Editable volume + bottle/keg split after instantiation (user, 2026-06-18).** M1
  sets total volume + keg split once at start. Make them editable later (M2): updating
  the split must reconcile packaging-path tasks (add keg/bottle tasks when a side goes
  >0, remove/skip when it goes to 0); changing total volume just re-derives BOM
  quantities (not stored). Edit lives on the execution / checklist header.

## References

- Roadmap (Phase 5) — memory: project_recipe_roadmap.
- Cross-batch work queue & "guide not cage" UX — memory: project_recipes.
- Assignment by user/role (future) — memory: project_multi_user_tasks.
- Kegs are vessels, excluded from BOM — memory: project_kegs_as_equipment.
- Labor model — `.claude/prds/labor-requirements-tracking.md`.

## Status

Backlog. Largest recipe build to date. Recommend implementing M1→M3 first (delivers a
usable scheduled work queue reusing existing actions) before M4/M5.
