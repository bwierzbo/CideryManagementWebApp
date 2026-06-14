---
name: automated-reconciliation
description: Automated, recurring reconciliation checks that proactively detect data drift across batches, TTB totals, and bulk/packaged flows
status: backlog
created: 2026-05-26T20:54:59Z
---

# PRD: Automated Reconciliation

## Executive Summary

Move batch and TTB reconciliation from a manual page the operator has to remember to open into a recurring, automated system check. The system should continuously verify data integrity and surface drift the moment it appears — not months later at TTB filing time.

## Problem Statement

The Batch Reconciliation page (Reports → Batch Reconciliation) currently requires manual review. Observed on 2026-05-26 for year 2026:

- Per-batch identity check passes ("all volume accounted for")
- One batch flagged with real drift: **Hopped Cider** (−15.5 gal)
- Aggregate footer (Opening + Production − Losses − Sales − Distillation) does not equal Ending Bulk — gap of approximately **560 gal**
- Likely cause: footer omits inflows like additions (brandy to pommeau, honey/water to cyser) and bulk → packaged transfers, but this has not been verified

The operator does not know whether the gap is a display bug or a real data integrity issue. There is no recurring process that would have caught this.

## Goals

1. **Recurring identity checks** — nightly job runs the per-batch reconciliation across all active years and writes results to `audit_logs`
2. **Drift alerts** — any new drift (or change in drift magnitude) is surfaced to the operator without them having to open the page
3. **Aggregate completeness** — the summary footer must mathematically close once *all* flow categories (additions, inter-class transfers, bulk-to-packaged) are included; if it doesn't, the page itself is a bug
4. **TTB period snapshots** — at each semi-monthly TTB period boundary, snapshot expected vs. actual and flag mismatches before filing
5. **Self-healing visibility** — operator can see "last reconciled at X, status: clean/N drift items" on dashboard

## Out of Scope

- Auto-correcting drift (humans resolve)
- Real-time (per-transaction) reconciliation
- Historical backfill of pre-2025 data

## Open Questions

- Investigate the 560-gal aggregate gap to determine whether it's a display omission or a true reconciliation failure (deferred — pending data entry catch-up)
- Decide between cron job, scheduled tRPC route, or worker package for the nightly run
- Define alert channel: dashboard badge, email, or both

## Dependencies

- Overlaps with `prd-testing-audit` (business rule guards, audit logging)
- Overlaps with `prd-system-verification` (E2E health checks)
- Builds on existing reconciliation logic in the Reports page

## Priority

**Deferred** — user is catching up on cider production data entry first. Revisit after data entry is current, before next TTB filing.
