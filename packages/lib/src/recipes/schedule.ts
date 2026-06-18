/**
 * Recipe execution scheduling.
 *
 * Turns a recipe's ordered steps + a batch start date into a calendar due-date
 * per step, by walking the trigger model. Reuses `computeCumulativeOffsets`
 * (the same math the recipe view uses for "day 5 from start"), so the preview
 * and the live schedule never diverge.
 *
 * SG-based / indeterminate triggers (sg_threshold, sg_terminal_confirmed, or a
 * missing offset) yield a null due-date — those steps are operator-driven and
 * can't be placed on the calendar ahead of time.
 *
 * Pure functions. No DB, no side effects — easy to unit test.
 */

import { computeCumulativeOffsets, type ScheduleStep } from "./triggers";

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
  const offsets = computeCumulativeOffsets(steps);
  const startMs = startDate.getTime();
  return offsets.map((h) => (h === null ? null : new Date(startMs + h * MS_PER_HOUR)));
}
