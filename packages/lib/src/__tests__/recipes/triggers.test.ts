import { describe, it, expect } from "vitest";
import {
  evaluateTrigger,
  computeCumulativeOffsets,
  summarizeStepTrigger,
  formatDurationHours,
  type TriggerContext,
} from "../../recipes/triggers";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Helper: build a baseline context for a batch that started 30 days ago
const makeCtx = (overrides: Partial<TriggerContext> = {}): TriggerContext => ({
  batchStartDate: new Date("2026-04-01T00:00:00Z"),
  previousStepCompletedAt: null,
  hydrometerHistory: [],
  ...overrides,
});

const NOW = new Date("2026-05-01T00:00:00Z"); // 30 days after batch start

describe("evaluateTrigger", () => {
  describe("manual", () => {
    it("never fires automatically — readyAt is null", () => {
      const r = evaluateTrigger({ kind: "manual", data: {} }, makeCtx(), NOW);
      expect(r.ready).toBe(false);
      expect(r.readyAt).toBeNull();
      expect(r.reason).toContain("operator decides");
    });
  });

  describe("date_offset_from_start", () => {
    it("fires after the configured days have passed", () => {
      const r = evaluateTrigger(
        { kind: "date_offset_from_start", data: { days: 14 } },
        makeCtx(),
        NOW, // now is day 30
      );
      expect(r.ready).toBe(true);
      expect(r.readyAt).toEqual(new Date("2026-04-15T00:00:00Z"));
    });

    it("does NOT fire before the offset elapses", () => {
      const r = evaluateTrigger(
        { kind: "date_offset_from_start", data: { days: 60 } }, // 60 days; we're at 30
        makeCtx(),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.readyAt).toEqual(new Date("2026-05-31T00:00:00Z"));
    });

    it("supports hours offset for fast triggers", () => {
      const r = evaluateTrigger(
        { kind: "date_offset_from_start", data: { hours: 48 } },
        makeCtx(),
        new Date("2026-04-03T00:00:00Z"), // 2 days = 48h after start
      );
      expect(r.ready).toBe(true);
    });

    it("returns not-ready when offset is missing", () => {
      const r = evaluateTrigger(
        { kind: "date_offset_from_start", data: {} },
        makeCtx(),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.readyAt).toBeNull();
    });

    it("fires exactly at the offset moment (boundary)", () => {
      const start = new Date("2026-04-01T00:00:00Z");
      const exactly14DaysLater = new Date(start.getTime() + 14 * DAY);
      const r = evaluateTrigger(
        { kind: "date_offset_from_start", data: { days: 14 } },
        makeCtx({ batchStartDate: start }),
        exactly14DaysLater,
      );
      expect(r.ready).toBe(true);
    });
  });

  describe("date_offset_from_previous", () => {
    it("waits when previous step has not completed yet", () => {
      const r = evaluateTrigger(
        { kind: "date_offset_from_previous", data: { days: 3 } },
        makeCtx({ previousStepCompletedAt: null }),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.readyAt).toBeNull();
      expect(r.reason).toContain("previous");
    });

    it("fires when N days after previous-step completion have passed", () => {
      const prevAt = new Date("2026-04-25T00:00:00Z");
      const r = evaluateTrigger(
        { kind: "date_offset_from_previous", data: { days: 3 } },
        makeCtx({ previousStepCompletedAt: prevAt }),
        NOW, // 6 days after prevAt
      );
      expect(r.ready).toBe(true);
      expect(r.readyAt).toEqual(new Date("2026-04-28T00:00:00Z"));
    });

    it("does NOT fire while still within the offset window", () => {
      const prevAt = new Date("2026-04-29T00:00:00Z");
      const r = evaluateTrigger(
        { kind: "date_offset_from_previous", data: { days: 5 } },
        makeCtx({ previousStepCompletedAt: prevAt }),
        NOW, // only 2 days after prev, need 5
      );
      expect(r.ready).toBe(false);
      expect(r.readyAt).toEqual(new Date("2026-05-04T00:00:00Z"));
    });
  });

  describe("after_previous", () => {
    it("waits when previous step has not completed yet", () => {
      const r = evaluateTrigger(
        { kind: "after_previous", data: {} },
        makeCtx({ previousStepCompletedAt: null }),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.readyAt).toBeNull();
      expect(r.reason).toContain("previous");
    });

    it("fires immediately once the previous step has completed", () => {
      const prevAt = new Date("2026-04-25T00:00:00Z");
      const r = evaluateTrigger(
        { kind: "after_previous", data: {} },
        makeCtx({ previousStepCompletedAt: prevAt }),
        NOW, // any time at/after prevAt
      );
      expect(r.ready).toBe(true);
      expect(r.readyAt).toEqual(prevAt);
    });

    it("fires exactly at the previous-step completion moment (boundary)", () => {
      const prevAt = new Date("2026-04-25T00:00:00Z");
      const r = evaluateTrigger(
        { kind: "after_previous", data: {} },
        makeCtx({ previousStepCompletedAt: prevAt }),
        prevAt,
      );
      expect(r.ready).toBe(true);
      expect(r.readyAt).toEqual(prevAt);
    });
  });

  describe("sg_threshold", () => {
    it("fires on the FIRST measurement that crossed below the threshold", () => {
      // Three readings: 1.020, 1.010, 1.004 (newest-first per contract)
      const history = [
        { value: 1.004, takenAt: new Date("2026-04-20T00:00:00Z") },
        { value: 1.010, takenAt: new Date("2026-04-15T00:00:00Z") },
        { value: 1.020, takenAt: new Date("2026-04-10T00:00:00Z") },
      ];
      const r = evaluateTrigger(
        { kind: "sg_threshold", data: { sg: 1.005, direction: "below" } },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(true);
      // The 1.004 reading was the first to dip below 1.005
      expect(r.readyAt).toEqual(new Date("2026-04-20T00:00:00Z"));
    });

    it("waits when no measurement has crossed yet", () => {
      const history = [
        { value: 1.020, takenAt: new Date("2026-04-15T00:00:00Z") },
        { value: 1.030, takenAt: new Date("2026-04-10T00:00:00Z") },
      ];
      const r = evaluateTrigger(
        { kind: "sg_threshold", data: { sg: 1.005, direction: "below" } },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.readyAt).toBeNull();
    });

    it("supports above direction", () => {
      // For e.g. sugar additions where you wait for SG to climb
      const history = [
        { value: 1.060, takenAt: new Date("2026-04-20T00:00:00Z") },
      ];
      const r = evaluateTrigger(
        { kind: "sg_threshold", data: { sg: 1.050, direction: "above" } },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(true);
    });

    it("treats SG exactly equal to threshold as crossed (≤ semantics)", () => {
      const history = [
        { value: 1.005, takenAt: new Date("2026-04-20T00:00:00Z") },
      ];
      const r = evaluateTrigger(
        { kind: "sg_threshold", data: { sg: 1.005, direction: "below" } },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(true);
    });

    it("returns not-ready with no history", () => {
      const r = evaluateTrigger(
        { kind: "sg_threshold", data: { sg: 1.005, direction: "below" } },
        makeCtx({ hydrometerHistory: [] }),
        NOW,
      );
      expect(r.ready).toBe(false);
    });

    it("returns not-ready when target SG missing from data", () => {
      const r = evaluateTrigger(
        { kind: "sg_threshold", data: { direction: "below" } },
        makeCtx(),
        NOW,
      );
      expect(r.ready).toBe(false);
    });
  });

  describe("sg_terminal_confirmed", () => {
    it("fires on two identical hydrometer readings ≥48h apart", () => {
      const history = [
        { value: 1.002, takenAt: new Date("2026-04-22T00:00:00Z") },
        { value: 1.002, takenAt: new Date("2026-04-19T00:00:00Z") }, // 72h earlier
      ];
      const r = evaluateTrigger(
        { kind: "sg_terminal_confirmed", data: {} },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(true);
    });

    it("does NOT fire when latest two readings differ", () => {
      const history = [
        { value: 1.002, takenAt: new Date("2026-04-22T00:00:00Z") },
        { value: 1.005, takenAt: new Date("2026-04-19T00:00:00Z") },
      ];
      const r = evaluateTrigger(
        { kind: "sg_terminal_confirmed", data: {} },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("≠");
    });

    it("does NOT fire when readings are <48h apart even if identical", () => {
      const history = [
        { value: 1.002, takenAt: new Date("2026-04-22T12:00:00Z") },
        { value: 1.002, takenAt: new Date("2026-04-22T00:00:00Z") }, // only 12h
      ];
      const r = evaluateTrigger(
        { kind: "sg_terminal_confirmed", data: {} },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("12.0h");
    });

    it("supports custom confirmationHours override", () => {
      const history = [
        { value: 1.002, takenAt: new Date("2026-04-22T13:00:00Z") },
        { value: 1.002, takenAt: new Date("2026-04-22T00:00:00Z") }, // 13h apart
      ];
      // Default 48h would deny; override to 12h allows
      const r = evaluateTrigger(
        { kind: "sg_terminal_confirmed", data: { confirmationHours: 12 } },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(true);
    });

    it("requires at least 2 hydrometer readings", () => {
      const history = [{ value: 1.002, takenAt: new Date("2026-04-22T00:00:00Z") }];
      const r = evaluateTrigger(
        { kind: "sg_terminal_confirmed", data: {} },
        makeCtx({ hydrometerHistory: history }),
        NOW,
      );
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("at least 2");
    });
  });
});

describe("computeCumulativeOffsets", () => {
  it("accumulates date_offset_from_previous, treating after_previous/manual as +0", () => {
    // Mirrors the hopped-cider recipe: manual start, two immediate adds, then a
    // 2-day rack, then immediate, then a 1-day measurement.
    const offsets = computeCumulativeOffsets([
      { triggerKind: "manual", triggerData: {} },                                  // day 0
      { triggerKind: "after_previous", triggerData: {} },                          // day 0
      { triggerKind: "after_previous", triggerData: {} },                          // day 0
      { triggerKind: "date_offset_from_previous", triggerData: { days: 2 } },      // day 2
      { triggerKind: "after_previous", triggerData: {} },                          // day 2
      { triggerKind: "date_offset_from_previous", triggerData: { days: 1 } },      // day 3
    ]);
    expect(offsets).toEqual([0, 0, 0, 48, 48, 72]); // hours
  });

  it("date_offset_from_start sets an absolute position", () => {
    const offsets = computeCumulativeOffsets([
      { triggerKind: "date_offset_from_previous", triggerData: { days: 5 } },      // day 5
      { triggerKind: "date_offset_from_start", triggerData: { days: 3 } },         // reset → day 3
      { triggerKind: "date_offset_from_previous", triggerData: { hours: 12 } },    // day 3.5
    ]);
    expect(offsets).toEqual([120, 72, 84]);
  });

  it("goes indeterminate (null) from an SG-based or unset trigger onward", () => {
    const offsets = computeCumulativeOffsets([
      { triggerKind: "date_offset_from_previous", triggerData: { days: 1 } },      // day 1
      { triggerKind: "sg_threshold", triggerData: { sg: 1.0 } },                   // unknown → null
      { triggerKind: "after_previous", triggerData: {} },                          // still null
    ]);
    expect(offsets).toEqual([24, null, null]);
  });

  it("treats a missing date offset as indeterminate", () => {
    const offsets = computeCumulativeOffsets([
      { triggerKind: "date_offset_from_previous", triggerData: {} },               // no days/hours
      { triggerKind: "after_previous", triggerData: {} },
    ]);
    expect(offsets).toEqual([null, null]);
  });
});

describe("summarizeStepTrigger", () => {
  it("shows the per-step offset AND the running total from start", () => {
    expect(
      summarizeStepTrigger({ triggerKind: "date_offset_from_previous", triggerData: { days: 2 } }, 120),
    ).toBe("2 days after previous · 5 days from start");
  });

  it("appends the total to an immediate step when the clock has advanced", () => {
    expect(
      summarizeStepTrigger({ triggerKind: "after_previous", triggerData: {} }, 48),
    ).toBe("Immediately after previous · 2 days from start");
  });

  it("omits the total at the start (cumulative 0)", () => {
    expect(
      summarizeStepTrigger({ triggerKind: "after_previous", triggerData: {} }, 0),
    ).toBe("Immediately after previous step");
  });

  it("never renders a literal placeholder for a date offset", () => {
    const s = summarizeStepTrigger({ triggerKind: "date_offset_from_previous", triggerData: { days: 3 } }, null);
    expect(s).toBe("3 days after previous");
    expect(s).not.toContain("N ");
  });

  it("prompts when a date offset is unset rather than showing 'N'", () => {
    expect(
      summarizeStepTrigger({ triggerKind: "date_offset_from_previous", triggerData: {} }, null),
    ).toBe("Set a duration after previous step");
  });

  it("formats date_offset_from_start as an absolute day", () => {
    expect(
      summarizeStepTrigger({ triggerKind: "date_offset_from_start", triggerData: { days: 3 } }, 72),
    ).toBe("3 days from batch start");
  });
});

describe("formatDurationHours", () => {
  it("formats whole days, sub-day hours, and fractional days", () => {
    expect(formatDurationHours(0)).toBe("0 days");
    expect(formatDurationHours(24)).toBe("1 day");
    expect(formatDurationHours(48)).toBe("2 days");
    expect(formatDurationHours(12)).toBe("12 hours");
    expect(formatDurationHours(36)).toBe("1.5 days");
  });
});
