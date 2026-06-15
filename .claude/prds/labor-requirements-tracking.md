---
name: labor-requirements-tracking
description: Track labor time per batch as a "labor bill-of-materials" — sum per-task labor hours from a recipe, scaling for batch volume (20 L vs 120 L vs 1000 L), distinct setup/active/cleaning time, and volume-stepped consumables like filter pads
status: backlog
created: 2026-06-15T15:29:20Z
---

# PRD: Labor Requirements Tracking (Labor BOM)

## Executive Summary

Extend the recipe bill-of-materials concept from **materials** to **labor**: how
much labor time does it take to make a batch of cider? Just as the materials BOM
resolves a recipe + target volume into the consumables it draws down, a **labor
BOM** should resolve a recipe + target volume into the labor hours it requires —
summed per task and rolled up per batch, and eventually per planning period.

Requested by user 2026-06-15 while reviewing the materials BOM.

## Interim approach (available now)

`recipe_steps.estimatedDurationHours` already exists on every step. The minimum
viable version is to **sum `estimatedDurationHours` across a recipe's steps** to
produce a per-batch labor estimate, surfaced next to the materials BOM on the
recipe view, and aggregated per period in the planner (alongside the deferred
capacity work). This uses the labor hours the operator already enters per task —
no schema change required to start.

## The hard problem: labor does not scale linearly with volume

A 20 L batch, a 120 L batch, and a 1000 L batch do **not** take proportional
labor. The expansion must model how each labor component scales:

- **Fixed (per-batch) labor** — setup, sanitation/cleaning of vessels and lines,
  teardown, record-keeping. Largely independent of volume; a 20 L batch can cost
  almost as much setup/cleaning time as a 1000 L batch.
- **Volume-variable labor** — activities whose time grows with volume (e.g.
  filtering more liters, more transfers, longer fill times), though often
  sub-linearly.
- **Step-count / consumable-driven labor** — some consumables step up with
  volume and drive both materials AND labor. Example: **filter pads** — how many
  5–7 micron / 1 micron pads does a 20 L vs 120 L vs 1000 L batch consume, and
  the labor to change them. This ties labor to the materials BOM.

## Scope of the expanded capability

1. **Per-task labor model** richer than a single `estimatedDurationHours`:
   - Split into categories: **setup**, **active/processing**, **cleaning**,
     **teardown** (so the planner can reason about fixed vs variable).
   - A scaling rule per task: fixed, linear-with-volume, or a
     volume→time/quantity curve (e.g. table of breakpoints at 20/120/1000 L).
2. **Volume-stepped consumables** (e.g. filter pads): quantity as a function of
   batch volume, feeding both the materials BOM and the labor for changeovers.
3. **Labor roll-up**: per-batch total labor hours, broken down by category and by
   step; cross-batch aggregation per planning period (labor-hours demand).
4. **Planning integration**: labor-hours per period vs available labor capacity —
   same family as the deferred capacity load meter (see references), enabling
   feasibility flags ("this month's plan needs 180 labor-hours").

## Open questions

- How to express scaling without over-engineering: per-task flag (fixed vs
  scales-with-volume) + optional breakpoint table? A formula? Keep it as simple
  as the rate-per-liter model used for additives if possible.
- Should labor be costed (labor $/hr) to feed COGS, or hours-only for now?
- Where does cleaning time live — on the step, or on the vessel/equipment
  (cleaning a 1000 L tank is a vessel property, not a recipe property)?
- Roles/assignees: labor-hours by role ties into the multi-user task work.

## References / related work

- Materials BOM: `packages/lib/src/recipes/bom.ts` (the pattern to mirror).
- Existing field: `recipe_steps.estimatedDurationHours` (the interim data source).
- Deferred capacity load meter — labor-hours + tank occupancy vs capacity
  (memory: project_planning_capacity).
- Recipe roadmap Phase 4 (planning) / Phase 5 (execution) — memory:
  project_recipe_roadmap.
- Multi-user roles & task assignment — memory: project_multi_user_tasks.

## Status

Backlog. Interim sum-of-`estimatedDurationHours` can be built when prioritized;
the volume-scaling expansion is the larger effort and depends on decisions in the
open questions above.
