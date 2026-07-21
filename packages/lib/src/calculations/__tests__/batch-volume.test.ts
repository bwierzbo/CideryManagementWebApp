/**
 * Tests for THE authoritative volume-from-history reducer (Phase 1).
 *
 * Verbose by design — each fixture states the scenario it guards so failures
 * read as domain regressions, not math trivia. Covers every event type's sign
 * and breakdown slot, both sides of the (dead) transfer-created cliff, the
 * loss-included bottling flag (including a case the old <2L heuristic got
 * wrong), asOfDate day semantics, null-timestamp inclusion, negative results
 * preserved, the §2.3 initial/merge overlap warning, and the all-time ==
 * far-future-asOf identity.
 */
import { describe, it, expect } from "vitest";
import {
  computeBatchVolumeFromHistory,
  type BatchVolumeEvent,
  type BatchVolumeInputs,
} from "../batch-volume";

const at = (iso: string) => new Date(iso);

function inputs(partial: Partial<BatchVolumeInputs>): BatchVolumeInputs {
  return {
    initialVolumeL: 0,
    transferCreated: false,
    startDate: null,
    events: [],
    ...partial,
  };
}

const ev = (partial: Partial<BatchVolumeEvent> & Pick<BatchVolumeEvent, "type">): BatchVolumeEvent => ({
  volumeL: 0,
  lossL: 0,
  at: null,
  ...partial,
});

describe("computeBatchVolumeFromHistory — per-event-type signs and slots", () => {
  it("transfer_in adds volume", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({ initialVolumeL: 100, events: [ev({ type: "transfer_in", volumeL: 50 })] }),
    );
    expect(r.volumeL).toBe(150);
    expect(r.breakdown.transfersInL).toBe(50);
  });

  it("transfer_out subtracts volume AND its loss", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({ initialVolumeL: 100, events: [ev({ type: "transfer_out", volumeL: 40, lossL: 2 })] }),
    );
    expect(r.volumeL).toBe(58);
    expect(r.breakdown.transfersOutL).toBe(40);
    expect(r.breakdown.transferLossL).toBe(2);
  });

  it("merge_in adds volume (press-run juice addition)", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 65,
        events: [ev({ type: "merge_in", volumeL: 985, mergeSourceType: "press_run", at: at("2025-11-25T10:00:00Z") })],
      }),
    );
    // Melrose Base shape: 65 initial + 985 merges = 1050
    expect(r.volumeL).toBe(1050);
    expect(r.breakdown.mergesInL).toBe(985);
  });

  it("merge_out subtracts volume (e.g. pommeau blending draw)", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({ initialVolumeL: 100, events: [ev({ type: "merge_out", volumeL: 42 })] }),
    );
    expect(r.volumeL).toBe(58);
    expect(r.breakdown.mergesOutL).toBe(42);
  });

  it("keg_fill subtracts volume and loss separately", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({ initialVolumeL: 100, events: [ev({ type: "keg_fill", volumeL: 58.66, lossL: 1.34 })] }),
    );
    expect(r.volumeL).toBeCloseTo(40, 6);
    expect(r.breakdown.keggingL).toBeCloseTo(58.66, 6);
    expect(r.breakdown.keggingLossL).toBeCloseTo(1.34, 6);
  });

  it("distillation subtracts source volume", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({ initialVolumeL: 1000, events: [ev({ type: "distillation", volumeL: 758 })] }),
    );
    expect(r.volumeL).toBe(242);
    expect(r.breakdown.distillationL).toBe(758);
  });

  it("adjustment is the one signed event: positive = gain, negative = loss", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 100,
        events: [
          ev({ type: "adjustment", volumeL: 10 }),
          ev({ type: "adjustment", volumeL: -25 }),
        ],
      }),
    );
    expect(r.volumeL).toBe(85);
    expect(r.breakdown.adjustmentsPositiveL).toBe(10);
    expect(r.breakdown.adjustmentsNegativeL).toBe(-25);
  });

  it("racking_loss and filter_loss subtract", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 130,
        events: [
          ev({ type: "racking_loss", volumeL: 50 }),
          ev({ type: "filter_loss", volumeL: 4.942 }),
        ],
      }),
    );
    expect(r.volumeL).toBeCloseTo(75.058, 6);
  });
});

describe("transferCreated flag (replaces the 90% cliff)", () => {
  it("true zeroes initial even when transfers-in are tiny relative to initial", () => {
    // Old cliff: transfersIn (50) < 90% × initial (71.25) would have flipped
    // this batch to counting initial — exactly the Hopped Cider +58.6L bug.
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 71.25,
        transferCreated: true,
        events: [ev({ type: "transfer_in", volumeL: 50 })],
      }),
    );
    expect(r.breakdown.initialL).toBe(0);
    expect(r.volumeL).toBe(50);
  });

  it("false keeps initial even when transfersIn ≈ initial (other side of the dead cliff)", () => {
    // Old cliff: transfersIn (120) >= 90% × initial (119.5) would have zeroed
    // a real initial. The flag makes the classification explicit and stable.
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 119.5,
        transferCreated: false,
        events: [ev({ type: "transfer_in", volumeL: 120 })],
      }),
    );
    expect(r.breakdown.initialL).toBe(119.5);
    expect(r.volumeL).toBe(239.5);
  });
});

describe("bottling loss-included flag (replaces the <2L fuzzy heuristic)", () => {
  it("lossIncludedInVolume=true: loss NOT double-subtracted", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 130,
        events: [ev({ type: "bottle_run", volumeL: 71.25, lossL: 1.5, lossIncludedInVolume: true })],
      }),
    );
    expect(r.volumeL).toBeCloseTo(58.75, 6);
    expect(r.breakdown.bottlingLossL).toBe(0);
  });

  it("lossIncludedInVolume=false: loss subtracted separately — even when small", () => {
    // The old heuristic treated ANY |volumeTaken − (product+loss)| < 2L as
    // loss-included. A 1.5L genuinely-separate loss was silently dropped.
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 130,
        events: [ev({ type: "bottle_run", volumeL: 71.25, lossL: 1.5, lossIncludedInVolume: false })],
      }),
    );
    expect(r.volumeL).toBeCloseTo(57.25, 6);
    expect(r.breakdown.bottlingLossL).toBe(1.5);
  });
});

describe("asOfDate semantics (SBD `< asOf + 1 day` parity)", () => {
  const base = inputs({
    initialVolumeL: 100,
    events: [
      ev({ type: "transfer_out", volumeL: 10, at: at("2025-12-31T09:00:00Z") }), // ON the as-of day
      ev({ type: "transfer_out", volumeL: 20, at: at("2026-01-01T00:00:00Z") }), // day after
      ev({ type: "transfer_out", volumeL: 5, at: null }),                        // undated
    ],
  });

  it("event ON the as-of day is included; the next day is excluded; null-at always included", () => {
    const r = computeBatchVolumeFromHistory(base, { asOfDate: "2025-12-31" });
    expect(r.volumeL).toBe(85); // 100 - 10 (on day) - 5 (null at); the +1d event excluded
  });

  it("all-time mode includes everything", () => {
    const r = computeBatchVolumeFromHistory(base);
    expect(r.volumeL).toBe(65);
  });

  it("identity: all-time equals far-future asOfDate", () => {
    const allTime = computeBatchVolumeFromHistory(base);
    const farFuture = computeBatchVolumeFromHistory(base, { asOfDate: "2099-12-31" });
    expect(farFuture.volumeL).toBe(allTime.volumeL);
    expect(farFuture.breakdown).toEqual(allTime.breakdown);
  });
});

describe("negative results preserved (no clamping — negatives are signal)", () => {
  it("over-drawn batch reconstructs negative", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({ initialVolumeL: 50, events: [ev({ type: "keg_fill", volumeL: 80, lossL: 0 })] }),
    );
    expect(r.volumeL).toBe(-30);
  });
});

describe("initial_merge_overlap warning (plan §2.3 split-of-truth)", () => {
  const start = at("2025-10-01T08:00:00Z");

  it("fires when same-day press-run merges cover >=90% of a nonzero initial", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 500,
        startDate: start,
        events: [
          ev({ type: "merge_in", volumeL: 480, mergeSourceType: "press_run", at: at("2025-10-01T12:00:00Z") }),
        ],
      }),
    );
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].code).toBe("initial_merge_overlap");
    expect(r.warnings[0].detailL).toBe(480);
  });

  it("does NOT fire for batch-sourced merges, later merges, transfer-created batches, or small overlaps", () => {
    const cases: BatchVolumeInputs[] = [
      // batch-sourced merge same day
      inputs({
        initialVolumeL: 500, startDate: start,
        events: [ev({ type: "merge_in", volumeL: 480, mergeSourceType: "batch", at: at("2025-10-01T12:00:00Z") })],
      }),
      // press-run merge 3 days later (legit addition)
      inputs({
        initialVolumeL: 500, startDate: start,
        events: [ev({ type: "merge_in", volumeL: 480, mergeSourceType: "press_run", at: at("2025-10-04T12:00:00Z") })],
      }),
      // transfer-created (initial not counted, nothing to double)
      inputs({
        initialVolumeL: 500, transferCreated: true, startDate: start,
        events: [ev({ type: "merge_in", volumeL: 480, mergeSourceType: "press_run", at: at("2025-10-01T12:00:00Z") })],
      }),
      // small same-day merge (below 90%)
      inputs({
        initialVolumeL: 500, startDate: start,
        events: [ev({ type: "merge_in", volumeL: 100, mergeSourceType: "press_run", at: at("2025-10-01T12:00:00Z") })],
      }),
    ];
    for (const c of cases) {
      expect(computeBatchVolumeFromHistory(c).warnings).toHaveLength(0);
    }
  });
});

describe("composite regression fixture — post-fix Hopped Cider ledger", () => {
  it("reproduces the repaired batch: 130 initial, blends in, packaged to ~0", () => {
    // Real ledger shape from the 2026-07-20 forensics (batch 37693faf).
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 130,
        transferCreated: false,
        events: [
          ev({ type: "racking_loss", volumeL: 50, at: at("2025-12-12T00:00:00Z") }),
          ev({ type: "merge_in", volumeL: 22.4, mergeSourceType: "batch", at: at("2026-03-20T00:00:00Z") }),
          ev({ type: "merge_in", volumeL: 17.97, mergeSourceType: "batch", at: at("2026-03-20T00:00:00Z") }),
          ev({ type: "merge_in", volumeL: 9.7, mergeSourceType: "batch", at: at("2026-03-20T00:00:00Z") }),
          ev({ type: "filter_loss", volumeL: 4.942, at: at("2026-03-25T00:00:00Z") }),
          ev({ type: "bottle_run", volumeL: 71.25, lossL: 0, lossIncludedInVolume: true, at: at("2026-03-27T00:00:00Z") }),
          ev({ type: "keg_fill", volumeL: 19.5, lossL: 0, at: at("2026-03-27T00:00:00Z") }),
          ev({ type: "keg_fill", volumeL: 19.5, lossL: 0, at: at("2026-03-27T00:00:00Z") }),
          ev({ type: "keg_fill", volumeL: 14.75, lossL: 0, at: at("2026-03-27T00:00:00Z") }),
        ],
      }),
    );
    // 130 - 50 + 50.07 - 4.942 - 71.25 - 53.75 = 0.128 — within tolerance of 0.
    expect(r.volumeL).toBeCloseTo(0.128, 3);
  });

  it("as-of 2025-12-31 reconstructs the year-end state (80 L)", () => {
    const r = computeBatchVolumeFromHistory(
      inputs({
        initialVolumeL: 130,
        transferCreated: false,
        events: [
          ev({ type: "racking_loss", volumeL: 50, at: at("2025-12-12T00:00:00Z") }),
          ev({ type: "merge_in", volumeL: 50.07, mergeSourceType: "batch", at: at("2026-03-20T00:00:00Z") }),
          ev({ type: "bottle_run", volumeL: 71.25, lossL: 0, lossIncludedInVolume: true, at: at("2026-03-27T00:00:00Z") }),
        ],
      }),
      { asOfDate: "2025-12-31" },
    );
    expect(r.volumeL).toBe(80);
  });
});
