import { describe, it, expect } from "vitest";
import { buildStepSchedule } from "../../recipes/schedule";

const START = new Date("2026-06-01T00:00:00Z");
const iso = (d: Date | null) => (d === null ? null : d.toISOString());

describe("buildStepSchedule", () => {
  it("places steps by cumulative offset from the start date", () => {
    const dates = buildStepSchedule(
      [
        { triggerKind: "date_offset_from_start", triggerData: { days: 0 } },
        { triggerKind: "after_previous", triggerData: {} }, // same point as prev
        { triggerKind: "date_offset_from_previous", triggerData: { days: 3 } },
        { triggerKind: "date_offset_from_previous", triggerData: { days: 2 } },
      ],
      START,
    );
    expect(iso(dates[0])).toBe("2026-06-01T00:00:00.000Z");
    expect(iso(dates[1])).toBe("2026-06-01T00:00:00.000Z");
    expect(iso(dates[2])).toBe("2026-06-04T00:00:00.000Z"); // +3 days
    expect(iso(dates[3])).toBe("2026-06-06T00:00:00.000Z"); // +2 more days
  });

  it("supports hour offsets", () => {
    const dates = buildStepSchedule(
      [{ triggerKind: "date_offset_from_start", triggerData: { hours: 12 } }],
      START,
    );
    expect(iso(dates[0])).toBe("2026-06-01T12:00:00.000Z");
  });

  it("returns null from an SG-based trigger onward (indeterminate)", () => {
    const dates = buildStepSchedule(
      [
        { triggerKind: "date_offset_from_start", triggerData: { days: 1 } },
        { triggerKind: "sg_terminal_confirmed", triggerData: {} },
        { triggerKind: "date_offset_from_previous", triggerData: { days: 2 } },
      ],
      START,
    );
    expect(iso(dates[0])).toBe("2026-06-02T00:00:00.000Z");
    expect(dates[1]).toBeNull();
    expect(dates[2]).toBeNull();
  });

  it("treats manual triggers as the running position (no advance)", () => {
    const dates = buildStepSchedule(
      [
        { triggerKind: "date_offset_from_start", triggerData: { days: 5 } },
        { triggerKind: "manual", triggerData: {} },
      ],
      START,
    );
    expect(iso(dates[0])).toBe("2026-06-06T00:00:00.000Z");
    expect(iso(dates[1])).toBe("2026-06-06T00:00:00.000Z");
  });

  it("returns an empty array for no steps", () => {
    expect(buildStepSchedule([], START)).toEqual([]);
  });
});
