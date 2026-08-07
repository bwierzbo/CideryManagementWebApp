/**
 * Family fulfillment for split recipe executions.
 *
 * When a vessel transfer splits a recipe batch, the child batch gets its own
 * cloned execution (vessel.transfer in routers/index.ts). The bottle/keg
 * packaging paths belong to the batch FAMILY, not to one vessel: bottling the
 * child's portion fulfills the bottle path for the parent too. This module
 * pairs a batch's open path-specific tasks against `done` tasks on related
 * executions (parent / children / siblings) so the checklist can show them as
 * "done via <batch>" instead of overdue.
 *
 * Shared steps (packagingPath === "all") are deliberately NOT paired — after a
 * split they are physical per-vessel work (filtering the parent tank does not
 * filter the child tank).
 *
 * Pure function: the router loads the rows, this decides the pairing.
 */

export interface LocalTaskLite {
  id: string;
  kind: string;
  label: string;
  packagingPath: string;
  status: string;
}

export interface FamilyDoneTaskLite {
  kind: string;
  label: string;
  packagingPath: string;
  batchId: string;
  completedAt: Date | string | null;
}

export interface Fulfillment {
  batchId: string;
  completedAt: Date | string | null;
}

const pairKey = (t: { kind: string; packagingPath: string; label: string }) =>
  `${t.kind}|${t.packagingPath}|${t.label}`;

/**
 * Map of local task id → the family completion that fulfills it.
 *
 * A local task is fulfillable only when it is path-specific (bottle/keg) and
 * still open (pending/in_progress) — a task the operator already completed,
 * skipped, or that belongs to the shared path is left alone. When several
 * family batches completed the same step, the earliest completion wins.
 */
export function computeFamilyFulfillment(
  localTasks: LocalTaskLite[],
  familyDoneTasks: FamilyDoneTaskLite[],
): Record<string, Fulfillment> {
  if (localTasks.length === 0 || familyDoneTasks.length === 0) return {};

  const doneByKey = new Map<string, FamilyDoneTaskLite>();
  for (const ft of familyDoneTasks) {
    if (ft.packagingPath === "all") continue;
    const key = pairKey(ft);
    const prev = doneByKey.get(key);
    if (!prev || completedMs(ft) < completedMs(prev)) doneByKey.set(key, ft);
  }
  if (doneByKey.size === 0) return {};

  const out: Record<string, Fulfillment> = {};
  for (const t of localTasks) {
    if (t.packagingPath === "all") continue;
    if (t.status !== "pending" && t.status !== "in_progress") continue;
    const match = doneByKey.get(pairKey(t));
    if (match) out[t.id] = { batchId: match.batchId, completedAt: match.completedAt };
  }
  return out;
}

const completedMs = (t: FamilyDoneTaskLite) =>
  t.completedAt ? new Date(t.completedAt).getTime() : Number.MAX_SAFE_INTEGER;
