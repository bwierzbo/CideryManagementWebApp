---
name: recipe-version-auto-summary
description: Auto-generate a recipe version's change summary by diffing consecutive snapshots, so version history is meaningful even when the author leaves the summary blank
status: backlog
created: 2026-06-16T02:15:08Z
---

# PRD: Recipe Version Auto-Summary

## Executive Summary

Recipe version history currently shows a change summary only when the author
typed one into the optional "Change summary" field on save. Most saves leave it
blank, so the history reads "v7 / v6 / v5 …" with no indication of what changed.
Since every version already stores a **full JSONB snapshot** (`recipe_versions.snapshot`
= `{ recipe, inputs, steps }`), the system can compute a summary by **diffing the
new version against the previous one** — deterministic, no AI required.

Requested by user 2026-06-15.

## Problem

- `recipes.update` writes `changeSummary` straight from user input; blank in →
  blank stored (see `packages/api/src/routers/recipes.ts`).
- Version history (`recipes.listVersions`) therefore shows empty rows for most
  versions, making the history nearly useless for "what changed when".

## Proposed Solution

When creating a version, if the author left `changeSummary` blank, generate one by
diffing the previous snapshot against the new one and describing the changes in
plain language. Author-entered summaries always win (never overwrite).

Diff coverage (snapshot → snapshot):
- **Recipe head**: name, productType, status, isTemplate, notes, enabled sections.
- **Ingredients** (`inputs`, kind=ingredient): added / removed / renamed; rate
  changes ("Cascade Hops 1.5 → 1.8 g/L"); inventory-link added/removed.
- **Steps**: added / removed / reordered; label, kind, trigger, packaging path,
  optional flag, and labor estimate changes; key actionData changes (container
  size, carbonation method, pasteurization params).

Output: a short, human-readable sentence or two, e.g.
*"Linked 3 ingredients to inventory; set bottle size 750 mL + caps; added 4 keg
steps."* Possibly tag it (auto) to distinguish from author-written summaries.

## Scope decisions / open questions

- **Deterministic diff, not AI.** A pure snapshot-diff function in
  `packages/lib` (testable, no side effects) is the right tool. An LLM summary is
  out of scope (heavier, non-deterministic, overkill).
- Where to run it: in the `update`/`clone` mutation right before inserting the
  version row (it already has both old `currentVersion` snapshot context and the
  freshly-built snapshot).
- Backfill: optionally generate summaries for existing blank versions by diffing
  their stored snapshots (one-off). Decide if worth it.
- How granular before it gets noisy — cap at the top N changes with "+ N more".

## References / related work

- Snapshot shape + write path: `packages/api/src/routers/recipes.ts`
  (`buildSnapshotInTx`, `update`, `clone`, `listVersions`, `getVersion`).
- Recipe roadmap — memory: project_recipe_roadmap.

## Status

Backlog. Self-contained; could be built independently when prioritized. A pure
`diffRecipeSnapshots(prev, next)` function in `packages/lib` with tests, wired
into the version-creation path as the fallback summary.
