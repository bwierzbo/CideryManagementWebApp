import { describe, it, expect } from "vitest";
import { buildStepSchedule, rescheduleWithActuals } from "../../recipes/schedule";

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

  it("schedules bottle and keg branches in parallel off the shared trunk", () => {
    // Trunk: start (day 0) → filter (day 5). Then bottle and keg branches.
    const dates = buildStepSchedule(
      [
        { triggerKind: "date_offset_from_start", triggerData: { days: 0 }, packagingPath: "all" },
        { triggerKind: "date_offset_from_previous", triggerData: { days: 5 }, packagingPath: "all" }, // filter, day 5
        { triggerKind: "after_previous", triggerData: {}, packagingPath: "bottle" }, // bottle carbonate
        { triggerKind: "date_offset_from_previous", triggerData: { days: 2 }, packagingPath: "bottle" }, // pasteurize, day 7
        { triggerKind: "after_previous", triggerData: {}, packagingPath: "keg" }, // keg package — follows FILTER, not pasteurize
        { triggerKind: "after_previous", triggerData: {}, packagingPath: "keg" }, // keg measure
      ],
      START,
    );
    expect(iso(dates[1])).toBe("2026-06-06T00:00:00.000Z"); // filter, day 5
    expect(iso(dates[2])).toBe("2026-06-06T00:00:00.000Z"); // bottle carbonate, day 5
    expect(iso(dates[3])).toBe("2026-06-08T00:00:00.000Z"); // pasteurize, day 7
    // Keg branch ties to the end of the trunk (filter, day 5), NOT the bottle tail (day 7).
    expect(iso(dates[4])).toBe("2026-06-06T00:00:00.000Z");
    expect(iso(dates[5])).toBe("2026-06-06T00:00:00.000Z");
  });
});

describe("rescheduleWithActuals", () => {
  const STEPS = [
    { triggerKind: "date_offset_from_start", triggerData: { days: 0 }, packagingPath: "all" },
    { triggerKind: "date_offset_from_previous", triggerData: { days: 3 }, packagingPath: "all" },
    { triggerKind: "date_offset_from_previous", triggerData: { days: 2 }, packagingPath: "all" },
  ];

  it("matches buildStepSchedule when nothing is done yet", () => {
    const a = buildStepSchedule(STEPS, START).map(iso);
    const b = rescheduleWithActuals(STEPS, START).map(iso);
    expect(b).toEqual(a);
  });

  it("re-anchors downstream steps to a step's actual completion", () => {
    // Step 1 (planned day 3) actually finished day 5 → step 2 (+2d) shifts to day 7.
    const dates = rescheduleWithActuals(
      [
        { ...STEPS[0], status: "done", completedAt: new Date("2026-06-01T00:00:00Z") },
        { ...STEPS[1], status: "done", completedAt: new Date("2026-06-06T00:00:00Z") },
        STEPS[2],
      ],
      START,
    );
    expect(iso(dates[2])).toBe("2026-06-08T00:00:00.000Z"); // day-5 completion + 2 days
  });

  it("treats a skipped step as pass-through (no delay)", () => {
    const dates = rescheduleWithActuals(
      [
        { ...STEPS[0], status: "done", completedAt: new Date("2026-06-01T00:00:00Z") },
        { ...STEPS[1], status: "skipped" },
        { triggerKind: "after_previous", triggerData: {}, packagingPath: "all" },
      ],
      START,
    );
    // Skipped step contributes nothing → after_previous follows step 0 (day 0).
    expect(iso(dates[2])).toBe("2026-06-01T00:00:00.000Z");
  });

  it("keeps date_offset_from_start anchored to batch start, not actuals", () => {
    const dates = rescheduleWithActuals(
      [
        { ...STEPS[0], status: "done", completedAt: new Date("2026-06-03T00:00:00Z") },
        { triggerKind: "date_offset_from_start", triggerData: { days: 10 }, packagingPath: "all" },
      ],
      START,
    );
    expect(iso(dates[1])).toBe("2026-06-11T00:00:00.000Z"); // start + 10d, regardless of the late step 0
  });
});
