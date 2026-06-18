/**
 * Recipe execution scheduling.
 *
 * Turns a recipe's ordered steps + a batch start date into a calendar due-date
 * per step, by walking the trigger model. Uses `computeBranchAwareOffsets` so
 * bottle and keg branches each chain along their own lineage (the shared steps
 * + that path's steps) and run in parallel — e.g. keg packaging follows the end
 * of filtering, not the end of the bottle tail.
 *
 * SG-based / indeterminate triggers (sg_threshold, sg_terminal_confirmed, or a
 * missing offset) yield a null due-date — those steps are operator-driven and
 * can't be placed on the calendar ahead of time.
 *
 * Pure functions. No DB, no side effects — easy to unit test.
 */

import { computeBranchAwareOffsets, type ScheduleStep } from "./triggers";

const MS_PER_HOUR = 3_600_000;

/**
 * Compute the initial scheduled due-date for each step, in order.
 *
 * @example
 *   buildStepSchedule(
 *     [
 *       { triggerKind: "date_offset_from_start", triggerData: { days: 0 } },
 *       { triggerKind: "date_offset_from_previous", triggerData: { days: 3 } },
 *       { triggerKind: "sg_terminal_confirmed", triggerData: {} },
 *     ],
 *     new Date("2026-06-01T00:00:00Z"),
 *   )
 *   // [2026-06-01, 2026-06-04, null]
 */
export function buildStepSchedule(
  steps: ScheduleStep[],
  startDate: Date,
): (Date | null)[] {
  const offsets = computeBranchAwareOffsets(steps);
  const startMs = startDate.getTime();
  return offsets.map((h) => (h === null ? null : new Date(startMs + h * MS_PER_HOUR)));
}

/** A step's offset in hours, or null when absent. */
function offsetHours(data: Record<string, unknown>): number | null {
  if (typeof data.days === "number") return data.days * 24;
  if (typeof data.hours === "number") return data.hours;
  return null;
}

export interface RuntimeStep extends ScheduleStep {
  /** "pending" | "in_progress" | "done" | "skipped". */
  status?: string;
  /** Real completion time for a done step — anchors everything after it. */
  completedAt?: Date | null;
}

/**
 * Recompute due-dates from ACTUAL progress. Branch-aware, like
 * `buildStepSchedule`, but each step's effective time is:
 *   - a DONE step → its real `completedAt` (becomes the anchor for what follows),
 *   - a SKIPPED step → pass-through (adds nothing; downstream follows the step
 *     before it),
 *   - otherwise → its trigger relative to the previous step's effective time.
 *
 * `date_offset_from_start` stays anchored to the batch start (absolute), so a
 * fixed calendar step doesn't drift when earlier work runs early/late. With no
 * done/skipped steps this returns exactly what `buildStepSchedule` does.
 */
export function rescheduleWithActuals(
  steps: RuntimeStep[],
  startDate: Date,
): (Date | null)[] {
  const out: (Date | null)[] = new Array(steps.length).fill(null);
  for (const path of ["bottle", "keg"] as const) {
    const idxs = steps
      .map((_, i) => i)
      .filter((i) => {
        const p = steps[i].packagingPath ?? "all";
        return p === "all" || p === path;
      });
    if (idxs.length === 0) continue;
    let prev: Date | null = startDate;
    for (const i of idxs) {
      const s = steps[i];
      let eff: Date | null;
      if (s.status === "done" && s.completedAt) {
        eff = s.completedAt;
      } else if (s.status === "skipped") {
        eff = prev; // pass-through — a skipped step doesn't delay the rest
      } else {
        const off = offsetHours(s.triggerData);
        switch (s.triggerKind) {
          case "manual":
          case "after_previous":
            eff = prev;
            break;
          case "date_offset_from_previous":
            eff = prev !== null && off !== null ? new Date(prev.getTime() + off * MS_PER_HOUR) : null;
            break;
          case "date_offset_from_start":
            eff = off !== null ? new Date(startDate.getTime() + off * MS_PER_HOUR) : null;
            break;
          default:
            eff = null; // sg_threshold / sg_terminal_confirmed — operator-driven
        }
      }
      out[i] = eff;
      prev = eff;
    }
  }
  return out;
}
