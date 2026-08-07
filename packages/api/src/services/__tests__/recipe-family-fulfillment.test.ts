import { describe, expect, it } from "vitest";
import {
  computeFamilyFulfillment,
  type FamilyDoneTaskLite,
  type LocalTaskLite,
} from "../recipe-family-fulfillment";

const local = (over: Partial<LocalTaskLite> = {}): LocalTaskLite => ({
  id: "local-1",
  kind: "package",
  label: "Package Cider in 750ml bottles",
  packagingPath: "bottle",
  status: "pending",
  ...over,
});

const familyDone = (over: Partial<FamilyDoneTaskLite> = {}): FamilyDoneTaskLite => ({
  kind: "package",
  label: "Package Cider in 750ml bottles",
  packagingPath: "bottle",
  batchId: "child-batch",
  completedAt: "2026-07-08T12:00:00Z",
  ...over,
});

describe("computeFamilyFulfillment", () => {
  it("pairs an open path task with a matching family completion (the Duskrun case)", () => {
    const result = computeFamilyFulfillment([local()], [familyDone()]);
    expect(result).toEqual({
      "local-1": { batchId: "child-batch", completedAt: "2026-07-08T12:00:00Z" },
    });
  });

  it("pairs on the exact (kind, path, label) triple — any mismatch means no pairing", () => {
    expect(
      computeFamilyFulfillment([local()], [familyDone({ label: "Package Cider in Kegs" })]),
    ).toEqual({});
    expect(
      computeFamilyFulfillment([local()], [familyDone({ packagingPath: "keg" })]),
    ).toEqual({});
    expect(computeFamilyFulfillment([local()], [familyDone({ kind: "measure" })])).toEqual({});
  });

  it("never pairs shared-path steps — post-split they are per-vessel physical work", () => {
    const filterLocal = local({ kind: "filter", label: "Fine Filter Cider", packagingPath: "all" });
    const filterFamily = familyDone({
      kind: "filter",
      label: "Fine Filter Cider",
      packagingPath: "all",
    });
    expect(computeFamilyFulfillment([filterLocal], [filterFamily])).toEqual({});
  });

  it("leaves locally-done and skipped tasks alone", () => {
    expect(computeFamilyFulfillment([local({ status: "done" })], [familyDone()])).toEqual({});
    expect(computeFamilyFulfillment([local({ status: "skipped" })], [familyDone()])).toEqual({});
  });

  it("also fulfills in_progress tasks", () => {
    const result = computeFamilyFulfillment([local({ status: "in_progress" })], [familyDone()]);
    expect(result["local-1"]?.batchId).toBe("child-batch");
  });

  it("picks the earliest family completion when several batches did the step", () => {
    const result = computeFamilyFulfillment(
      [local()],
      [
        familyDone({ batchId: "late-sibling", completedAt: "2026-07-10T00:00:00Z" }),
        familyDone({ batchId: "first-child", completedAt: "2026-07-08T00:00:00Z" }),
      ],
    );
    expect(result["local-1"]?.batchId).toBe("first-child");
  });

  it("treats a null completedAt as latest, so dated completions win the tie-break", () => {
    const result = computeFamilyFulfillment(
      [local()],
      [
        familyDone({ batchId: "undated", completedAt: null }),
        familyDone({ batchId: "dated", completedAt: "2026-07-08T00:00:00Z" }),
      ],
    );
    expect(result["local-1"]?.batchId).toBe("dated");
  });

  it("fulfills multiple distinct path steps independently", () => {
    const tasks = [
      local({ id: "carb", kind: "carbonate", label: "Carbonate Cider" }),
      local({ id: "pkg" }),
      local({ id: "keg-pkg", label: "Package Cider in Kegs", packagingPath: "keg" }),
    ];
    const family = [
      familyDone({ kind: "carbonate", label: "Carbonate Cider" }),
      familyDone(),
    ];
    const result = computeFamilyFulfillment(tasks, family);
    expect(Object.keys(result).sort()).toEqual(["carb", "pkg"]);
  });

  it("returns empty for empty inputs", () => {
    expect(computeFamilyFulfillment([], [familyDone()])).toEqual({});
    expect(computeFamilyFulfillment([local()], [])).toEqual({});
  });
});
