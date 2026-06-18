/**
 * Recipe step trigger evaluation.
 *
 * Given a step's trigger spec (kind + params) and a runtime context (batch
 * start, previous step's actual completion time, recent SG measurements),
 * decide whether the step is "ready" right now and — if not — when it will be.
 *
 * Used by the Phase 2 scheduler to compute `scheduled_at` per step in a
 * batch plan, and to decide which steps surface in the dashboard task list.
 *
 * Pure function. No side effects, no DB. Easy to unit test.
 */

export type TriggerKind =
  | "manual"
  | "after_previous"
  | "date_offset_from_start"
  | "date_offset_from_previous"
  | "sg_threshold"
  | "sg_terminal_confirmed";

export interface TriggerSpec {
  kind: TriggerKind;
  /**
   * Kind-specific parameters. Shape per kind:
   *   manual                     → {}
   *   date_offset_from_start     → { days: number } or { hours: number }
   *   date_offset_from_previous  → { days: number } or { hours: number }
   *   sg_threshold               → { sg: number, direction: "below" | "above" }
   *   sg_terminal_confirmed      → { confirmationHours?: number }  (default 48)
   */
  data: Record<string, unknown>;
}

export interface TriggerContext {
  /** When the batch started. */
  batchStartDate: Date;
  /** When the previous step in this batch was actually completed. */
  previousStepCompletedAt: Date | null;
  /**
   * Hydrometer SG measurements for the batch, ordered newest-first.
   * Used by sg_threshold and sg_terminal_confirmed.
   */
  hydrometerHistory?: Array<{ value: number; takenAt: Date }>;
}

export interface TriggerResult {
  /** True when the trigger is satisfied as of the evaluation time. */
  ready: boolean;
  /**
   * The instant the trigger fires (or fired). Null when:
   *   - manual triggers (operator decides)
   *   - we don't have enough info to predict (e.g. previous step incomplete)
   */
  readyAt: Date | null;
  /** Human-readable explanation, useful for tooltips and dev debugging. */
  reason: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Evaluate a trigger.
 *
 * @param spec  The trigger spec from the recipe step
 * @param ctx   Runtime context for the batch the step belongs to
 * @param now   Current time (injected for testability — defaults to new Date())
 */
export function evaluateTrigger(
  spec: TriggerSpec,
  ctx: TriggerContext,
  now: Date = new Date(),
): TriggerResult {
  switch (spec.kind) {
    case "manual":
      return {
        ready: false,
        readyAt: null,
        reason: "Manual — operator decides when to fire",
      };

    case "date_offset_from_start": {
      const offsetMs = parseOffset(spec.data);
      if (offsetMs === null) {
        return { ready: false, readyAt: null, reason: "Missing days/hours offset" };
      }
      const readyAt = new Date(ctx.batchStartDate.getTime() + offsetMs);
      return {
        ready: now.getTime() >= readyAt.getTime(),
        readyAt,
        reason: `Day ${formatOffset(spec.data)} from batch start (${readyAt.toISOString()})`,
      };
    }

    case "after_previous": {
      // Fires the instant the previous step completes — no delay. Equivalent
      // to date_offset_from_previous with a zero offset. Used for chained
      // actions (e.g. "rack, then immediately add sugar").
      if (!ctx.previousStepCompletedAt) {
        return {
          ready: false,
          readyAt: null,
          reason: "Waiting on previous step to complete",
        };
      }
      return {
        ready: now.getTime() >= ctx.previousStepCompletedAt.getTime(),
        readyAt: ctx.previousStepCompletedAt,
        reason: "Immediately after previous step completes",
      };
    }

    case "date_offset_from_previous": {
      // Without a completed previous step we can't predict when this one fires.
      if (!ctx.previousStepCompletedAt) {
        return {
          ready: false,
          readyAt: null,
          reason: "Waiting on previous step to complete",
        };
      }
      const offsetMs = parseOffset(spec.data);
      if (offsetMs === null) {
        return { ready: false, readyAt: null, reason: "Missing days/hours offset" };
      }
      const readyAt = new Date(ctx.previousStepCompletedAt.getTime() + offsetMs);
      return {
        ready: now.getTime() >= readyAt.getTime(),
        readyAt,
        reason: `${formatOffset(spec.data)} after previous step`,
      };
    }

    case "sg_threshold": {
      const sg = spec.data.sg as number | undefined;
      const direction = (spec.data.direction as "below" | "above" | undefined) ?? "below";
      if (typeof sg !== "number") {
        return { ready: false, readyAt: null, reason: "Missing target SG" };
      }
      const history = ctx.hydrometerHistory ?? [];
      // Find the FIRST (oldest) measurement that crossed the threshold —
      // that's when the trigger fired, not the latest reading.
      // history is newest-first per the contract, so iterate reversed.
      const ordered = [...history].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
      for (const m of ordered) {
        const matches = direction === "below" ? m.value <= sg : m.value >= sg;
        if (matches) {
          return {
            ready: true,
            readyAt: m.takenAt,
            reason: `SG ${m.value} crossed threshold ${direction} ${sg} on ${m.takenAt.toISOString()}`,
          };
        }
      }
      return {
        ready: false,
        readyAt: null,
        reason: `Waiting for SG to be ${direction} ${sg}`,
      };
    }

    case "sg_terminal_confirmed": {
      // Two consecutive hydrometer readings with the SAME SG, taken at least
      // confirmationHours apart. Mirrors `isTerminalConfirmed` in fermentation.ts
      // but evaluated against the trigger's history.
      const confirmationHours =
        (spec.data.confirmationHours as number | undefined) ?? 48;
      const history = ctx.hydrometerHistory ?? [];
      if (history.length < 2) {
        return { ready: false, readyAt: null, reason: "Need at least 2 hydrometer readings" };
      }
      // history is newest-first; the latest two are what matter.
      const sorted = [...history].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
      const [latest, previous] = sorted;
      if (latest.value !== previous.value) {
        return {
          ready: false,
          readyAt: null,
          reason: `Latest SG (${latest.value}) ≠ previous (${previous.value})`,
        };
      }
      const hoursBetween = Math.abs(
        (latest.takenAt.getTime() - previous.takenAt.getTime()) / HOUR_MS,
      );
      if (hoursBetween < confirmationHours) {
        return {
          ready: false,
          readyAt: null,
          reason: `Identical readings only ${hoursBetween.toFixed(1)}h apart; need ${confirmationHours}h`,
        };
      }
      return {
        ready: true,
        readyAt: latest.takenAt,
        reason: `Two identical hydrometer readings (SG ${latest.value}) ${hoursBetween.toFixed(1)}h apart`,
      };
    }

    default: {
      // Defensive: unknown trigger kind. Treat as not-ready rather than throw.
      const _exhaustiveCheck: never = spec.kind;
      void _exhaustiveCheck;
      return { ready: false, readyAt: null, reason: `Unknown trigger kind` };
    }
  }
}

function parseOffset(data: Record<string, unknown>): number | null {
  if (typeof data.days === "number") return data.days * DAY_MS;
  if (typeof data.hours === "number") return data.hours * HOUR_MS;
  return null;
}

// ─── Schedule summary (cumulative time-from-start for the recipe UI) ─────────

/** A step's timing inputs — the subset the schedule summary needs. */
export interface ScheduleStep {
  triggerKind: string;
  triggerData: Record<string, unknown>;
  /** "all" | "bottle" | "keg" — for branch-aware scheduling. Defaults "all". */
  packagingPath?: string | null;
}

/** Pull a date-offset trigger's {days}|{hours} as hours. Null when absent. */
function offsetHours(data: Record<string, unknown>): number | null {
  if (typeof data.days === "number") return data.days * 24;
  if (typeof data.hours === "number") return data.hours;
  return null;
}

/**
 * Cumulative HOURS from batch start to each step, in order — so the recipe UI
 * can show "day 5 from start" instead of only "2 days after previous step".
 *
 * Rules: `manual` and `after_previous` add 0 (treated as "happens at the same
 * point"). `date_offset_from_previous` adds its offset. `date_offset_from_start`
 * sets the absolute position. A missing offset or an SG-based trigger makes the
 * total indeterminate from that step onward (null) — we genuinely can't predict
 * a calendar position for those ahead of time.
 */
export function computeCumulativeOffsets(steps: ScheduleStep[]): (number | null)[] {
  const out: (number | null)[] = [];
  let running: number | null = 0;
  for (const step of steps) {
    if (running === null) {
      out.push(null);
      continue;
    }
    switch (step.triggerKind) {
      case "manual":
      case "after_previous":
        out.push(running);
        break;
      case "date_offset_from_previous": {
        const h = offsetHours(step.triggerData);
        if (h === null) {
          running = null;
        } else {
          running += h;
        }
        out.push(running);
        break;
      }
      case "date_offset_from_start": {
        const h = offsetHours(step.triggerData);
        running = h; // absolute reset (null if missing)
        out.push(running);
        break;
      }
      default: // sg_threshold, sg_terminal_confirmed, unknown
        running = null;
        out.push(null);
        break;
    }
  }
  return out;
}

/**
 * Branch-aware cumulative offsets. Bottle-path and keg-path steps each chain
 * along their OWN lineage (the shared "all" steps + that path's steps), not the
 * flat list. So a keg step's "after previous" follows the last *shared* step
 * (e.g. filtering) rather than the end of the bottle tail — letting bottle and
 * keg packaging run in parallel.
 *
 * "all" steps belong to both lineages and take the trunk offset.
 */
export function computeBranchAwareOffsets(steps: ScheduleStep[]): (number | null)[] {
  const out: (number | null)[] = new Array(steps.length).fill(null);
  for (const path of ["bottle", "keg"] as const) {
    const idxs = steps
      .map((_, i) => i)
      .filter((i) => {
        const p = steps[i].packagingPath ?? "all";
        return p === "all" || p === path;
      });
    if (idxs.length === 0) continue;
    const lineageOffsets = computeCumulativeOffsets(idxs.map((i) => steps[i]));
    idxs.forEach((origIdx, k) => {
      out[origIdx] = lineageOffsets[k];
    });
  }
  return out;
}

/** Format a span of hours as a friendly "N days" / "N hours" string. */
export function formatDurationHours(hours: number): string {
  if (hours === 0) return "0 days";
  if (hours % 24 === 0) {
    const d = hours / 24;
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${(hours / 24).toFixed(1)} days`;
}

/**
 * Human summary of a step's trigger, including the cumulative time from batch
 * start when known. `cumulativeHours` comes from {@link computeCumulativeOffsets}.
 *
 * @example "2 days after previous · 5 days from start"
 * @example "Immediately after previous · 3 days from start"
 * @example "Day 3 from batch start"
 */
export function summarizeStepTrigger(
  step: ScheduleStep,
  cumulativeHours: number | null,
): string {
  const total =
    cumulativeHours !== null && cumulativeHours > 0
      ? `${formatDurationHours(cumulativeHours)} from start`
      : null;

  switch (step.triggerKind) {
    case "manual":
      return "Manual (operator decides when)";
    case "after_previous":
      return total ? `Immediately after previous · ${total}` : "Immediately after previous step";
    case "date_offset_from_previous": {
      const h = offsetHours(step.triggerData);
      if (h === null) return "Set a duration after previous step";
      const per = `${formatDurationHours(h)} after previous`;
      return total ? `${per} · ${total}` : per;
    }
    case "date_offset_from_start": {
      const h = offsetHours(step.triggerData);
      return h === null ? "Set days from batch start" : `${formatDurationHours(h)} from batch start`;
    }
    case "sg_threshold": {
      const sg = step.triggerData.sg;
      const dir = (step.triggerData.direction as string) ?? "below";
      return typeof sg === "number" ? `When SG ${dir} ${sg}` : "When SG threshold is reached";
    }
    case "sg_terminal_confirmed":
      return "When fermentation is terminal";
    default:
      return step.triggerKind;
  }
}

function formatOffset(data: Record<string, unknown>): string {
  if (typeof data.days === "number") return `${data.days} day${data.days === 1 ? "" : "s"}`;
  if (typeof data.hours === "number") return `${data.hours} hour${data.hours === 1 ? "" : "s"}`;
  return "?";
}
