/**
 * Integration tests for the recipe router.
 *
 * Hits a real DB via tRPC's createCaller. Per CLAUDE.md: no mock services.
 *
 * Each test creates ephemeral users + recipes and cleans them up afterward.
 * Names use a unique suffix per test run to avoid collisions when tests
 * run concurrently.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { inArray, like } from "drizzle-orm";
import { db, users, recipes } from "db";
import { recipesRouter } from "../recipes";
import bcrypt from "bcryptjs";
import type { AuthSession, AuthUser, Context } from "../../trpc";

// Real-DB integration tests do multi-statement transactions per call. The
// default 5s vitest timeout is too tight when the test DB is remote (Neon).
// Bumping for this file only.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// Unique suffix shared across this test file run; lets us scope cleanup queries.
const SUFFIX = `it-${Date.now().toString(36)}`;

interface TestUserHandles {
  admin: AuthUser;
  operator: AuthUser;
  viewer: AuthUser;
}

let testUsers: TestUserHandles;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(user: AuthUser): Context {
  const session: AuthSession = {
    user,
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
  return { session, user };
}

/**
 * Create a real DB-backed user. Only "admin" and "operator" exist in the
 * user_role pg enum — "viewer" is in the TS RBAC matrix but not the DB.
 * For viewer-role tests we use {@link makeSyntheticUser} below instead,
 * which is fine because RBAC denies the write before any DB FK is touched.
 */
async function makeUser(role: "admin" | "operator", suffix: string): Promise<AuthUser> {
  const hash = await bcrypt.hash("test-password", 4); // low rounds, tests only
  const [row] = await db
    .insert(users)
    .values({
      email: `recipes-test-${role}-${suffix}@example.com`,
      name: `Recipe Test ${role}`,
      passwordHash: hash,
      role,
      isActive: true,
    })
    .returning();
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
    permissionOverrides: row.permissionOverrides as Record<string, boolean>,
  };
}

/**
 * Synthetic user (no DB row). Used for viewer-role tests where RBAC must
 * deny the operation before any DB call happens, so the missing FK never
 * gets exercised.
 */
function makeSyntheticUser(role: "viewer"): AuthUser {
  return {
    id: "00000000-0000-0000-0000-000000009999",
    email: `synthetic-${role}@example.com`,
    name: `Synthetic ${role}`,
    role,
    isActive: true,
    permissionOverrides: {},
  };
}

// Sample recipe payload used by many tests.
const sampleRecipe = (name: string) => ({
  name,
  description: "Test recipe",
  productType: "cider" as const,
  enabledSections: { ingredients: true, process_steps: true },
  status: "draft" as const,
  inputs: [
    {
      kind: "ingredient" as const,
      label: "Strawberries",
      additiveType: "Fruit/Fruit Product",
      additiveName: "Strawberries",
      rateValue: 100,
      rateUnit: "g/L",
      sortOrder: 0,
    },
    {
      kind: "ingredient" as const,
      label: "Yeast",
      additiveType: "Fermentation Organisms",
      additiveName: "AB-1",
      rateValue: 1,
      rateUnit: "g/L",
      sortOrder: 1,
    },
  ],
  steps: [
    {
      kind: "pitch_yeast" as const,
      sequence: 0,
      label: "Pitch yeast",
      triggerKind: "manual" as const,
      triggerData: {},
      actionData: {},
    },
    {
      kind: "wait" as const,
      sequence: 1,
      label: "Primary fermentation",
      triggerKind: "date_offset_from_previous" as const,
      triggerData: { days: 14 },
      actionData: {},
      estimatedDurationHours: 0,
    },
  ],
});

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  testUsers = {
    admin:    await makeUser("admin",    SUFFIX),
    operator: await makeUser("operator", SUFFIX),
    viewer:   makeSyntheticUser("viewer"),
  };
});

afterAll(async () => {
  // Defensive: even if beforeAll partially failed, clean what we can.
  await db.delete(recipes).where(like(recipes.name, `%${SUFFIX}%`));
  const realIds = [testUsers?.admin?.id, testUsers?.operator?.id].filter(
    (x): x is string => !!x,
  );
  if (realIds.length > 0) {
    await db.delete(users).where(inArray(users.id, realIds));
  }
});

// Per-test cleanup of any recipes that match SUFFIX (defensive — covers tests
// that didn't manually clean up).
afterEach(async () => {
  await db.delete(recipes).where(like(recipes.name, `%${SUFFIX}%`));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("recipes router – CRUD basics", () => {
  it("create returns id + initial version 1", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const result = await caller.create(sampleRecipe(`Basic Recipe ${SUFFIX}`));
    expect(result.version).toBe(1);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("create persists inputs and steps", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`Persist Recipe ${SUFFIX}`));
    const got = await caller.get({ id });
    expect(got.recipe.name).toContain("Persist Recipe");
    expect(got.inputs).toHaveLength(2);
    expect(got.steps).toHaveLength(2);
    expect(got.inputs.find((i) => i.label === "Strawberries")?.rateValue).toBe("100.0000");
    expect(got.steps.find((s) => s.kind === "wait")?.triggerData).toEqual({ days: 14 });
  });

  it("create writes a v1 snapshot in recipe_versions", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`Snapshot Recipe ${SUFFIX}`));
    const versions = await caller.listVersions({ recipeId: id });
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
    const v1 = await caller.getVersion({ recipeId: id, version: 1 });
    const snap = v1.snapshot as { recipe: any; inputs: any[]; steps: any[] };
    expect(snap.recipe.name).toContain("Snapshot Recipe");
    expect(snap.inputs).toHaveLength(2);
    expect(snap.steps).toHaveLength(2);
  });

  it("get throws NOT_FOUND for unknown id", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(caller.get({ id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("recipes router – update + versioning", () => {
  it("update increments currentVersion and creates new snapshot", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`Versioning ${SUFFIX}`));
    await caller.update({
      id,
      name: `Versioning ${SUFFIX} renamed`,
      changeSummary: "Renamed for tests",
    });
    const got = await caller.get({ id });
    expect(got.recipe.currentVersion).toBe(2);
    expect(got.recipe.name).toContain("renamed");
    const versions = await caller.listVersions({ recipeId: id });
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2); // newest first
    expect(versions[0].changeSummary).toBe("Renamed for tests");
  });

  it("update with new inputs replaces the existing inputs entirely", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`InputReplace ${SUFFIX}`));
    await caller.update({
      id,
      inputs: [
        {
          kind: "ingredient",
          label: "Honey",
          additiveType: "Sugar & Sweeteners",
          additiveName: "Honey",
          rateValue: 150,
          rateUnit: "g/L",
          sortOrder: 0,
        },
      ],
    });
    const got = await caller.get({ id });
    expect(got.inputs).toHaveLength(1);
    expect(got.inputs[0].label).toBe("Honey");
  });

  it("old version snapshot is preserved byte-for-byte after edit", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`OldVer ${SUFFIX}`));
    const v1Before = await caller.getVersion({ recipeId: id, version: 1 });
    const snap1Before = v1Before.snapshot;

    // Make sweeping changes
    await caller.update({
      id,
      name: `OldVer ${SUFFIX} v2`,
      inputs: [],
      steps: [],
    });

    // V1 snapshot should be unchanged
    const v1After = await caller.getVersion({ recipeId: id, version: 1 });
    expect(v1After.snapshot).toEqual(snap1Before);
  });

  it("update throws NOT_FOUND for unknown id", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(
      caller.update({ id: "00000000-0000-0000-0000-000000000000", name: "x" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("recipes router – list + filtering", () => {
  it("filters by product type", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await caller.create({ ...sampleRecipe(`CiderOnly ${SUFFIX}`), productType: "cider" });
    await caller.create({ ...sampleRecipe(`PerryOnly ${SUFFIX}`), productType: "perry" });

    const ciders = await caller.list({ productType: "cider", search: SUFFIX });
    const perries = await caller.list({ productType: "perry", search: SUFFIX });

    const ciderNames = ciders.items.map((r) => r.name);
    const perryNames = perries.items.map((r) => r.name);
    expect(ciderNames).toContain(`CiderOnly ${SUFFIX}`);
    expect(ciderNames).not.toContain(`PerryOnly ${SUFFIX}`);
    expect(perryNames).toContain(`PerryOnly ${SUFFIX}`);
  });

  it("excludes archived by default", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id: liveId } = await caller.create(sampleRecipe(`Live ${SUFFIX}`));
    const { id: archivedId } = await caller.create(sampleRecipe(`Archive ${SUFFIX}`));
    await caller.archive({ id: archivedId });

    const result = await caller.list({ search: SUFFIX });
    const ids = result.items.map((r) => r.id);
    expect(ids).toContain(liveId);
    expect(ids).not.toContain(archivedId);
  });

  it("includeArchived=true returns archived rows", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`InclArc ${SUFFIX}`));
    await caller.archive({ id });
    const result = await caller.list({ search: SUFFIX, includeArchived: true });
    expect(result.items.find((r) => r.id === id)).toBeDefined();
  });

  it("search matches case-insensitive substring on name", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await caller.create(sampleRecipe(`UnusualWord ${SUFFIX}`));
    const result = await caller.list({ search: "unusualword" });
    expect(result.items.some((r) => r.name.includes("UnusualWord"))).toBe(true);
  });
});

describe("recipes router – archive + restore", () => {
  it("archive flips status and stamps archivedAt", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`ToArchive ${SUFFIX}`));
    await caller.archive({ id });
    const got = await caller.get({ id });
    expect(got.recipe.status).toBe("archived");
    expect(got.recipe.archivedAt).not.toBeNull();
  });

  it("restore puts the recipe back to draft and clears archivedAt", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await caller.create(sampleRecipe(`ToRestore ${SUFFIX}`));
    await caller.archive({ id });
    await caller.restore({ id });
    const got = await caller.get({ id });
    expect(got.recipe.status).toBe("draft");
    expect(got.recipe.archivedAt).toBeNull();
  });
});

describe("recipes router – clone", () => {
  it("creates a new draft with the same inputs/steps", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id: srcId } = await caller.create(sampleRecipe(`Source ${SUFFIX}`));
    const { id: cloneId } = await caller.clone({
      sourceId: srcId,
      newName: `Clone ${SUFFIX}`,
    });
    expect(cloneId).not.toBe(srcId);
    const clone = await caller.get({ id: cloneId });
    expect(clone.recipe.status).toBe("draft");
    expect(clone.recipe.currentVersion).toBe(1);
    expect(clone.inputs).toHaveLength(2);
    expect(clone.steps).toHaveLength(2);
    // Distinct rows — different ids
    expect(clone.inputs[0].id).not.toBe((await caller.get({ id: srcId })).inputs[0].id);
  });

  it("clone source NOT_FOUND surfaces the error", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(
      caller.clone({
        sourceId: "00000000-0000-0000-0000-000000000000",
        newName: "x",
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("recipes router – RBAC enforcement", () => {
  it("operator can list + read + create (per role default)", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.operator));
    const { id } = await caller.create(sampleRecipe(`OpCreate ${SUFFIX}`));
    expect(id).toBeTruthy();
    const list = await caller.list({ search: SUFFIX });
    expect(list.items.find((r) => r.id === id)).toBeDefined();
  });

  it("operator CANNOT update (role-default deny)", async () => {
    const adminCaller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await adminCaller.create(sampleRecipe(`OpUpdate ${SUFFIX}`));
    const opCaller = recipesRouter.createCaller(makeContext(testUsers.operator));
    await expect(opCaller.update({ id, name: "rejected" })).rejects.toThrow(
      /insufficient permissions/i,
    );
  });

  it("operator CANNOT archive (role-default deny)", async () => {
    const adminCaller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await adminCaller.create(sampleRecipe(`OpArchive ${SUFFIX}`));
    const opCaller = recipesRouter.createCaller(makeContext(testUsers.operator));
    await expect(opCaller.archive({ id })).rejects.toThrow(/insufficient permissions/i);
  });

  it("viewer CANNOT create (role-default deny)", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.viewer));
    await expect(caller.create(sampleRecipe(`ViewerNo ${SUFFIX}`))).rejects.toThrow(
      /insufficient permissions/i,
    );
  });

  it("viewer CAN read", async () => {
    const adminCaller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await adminCaller.create(sampleRecipe(`ViewerRead ${SUFFIX}`));
    const vCaller = recipesRouter.createCaller(makeContext(testUsers.viewer));
    const got = await vCaller.get({ id });
    expect(got.recipe.id).toBe(id);
  });

  it("permission_overrides grant works (operator with recipe:update override)", async () => {
    const adminCaller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await adminCaller.create(sampleRecipe(`OpOverride ${SUFFIX}`));
    // Build operator context with override
    const opUserWithOverride: AuthUser = {
      ...testUsers.operator,
      permissionOverrides: { "recipe:update": true },
    };
    const caller = recipesRouter.createCaller(makeContext(opUserWithOverride));
    await expect(caller.update({ id, name: `Op-update ${SUFFIX}` })).resolves.toBeTruthy();
    const got = await adminCaller.get({ id });
    expect(got.recipe.name).toContain("Op-update");
  });

  it("permission_overrides deny works (admin with recipe:delete=false)", async () => {
    const adminCaller = recipesRouter.createCaller(makeContext(testUsers.admin));
    const { id } = await adminCaller.create(sampleRecipe(`AdminDeny ${SUFFIX}`));
    const adminUserDenied: AuthUser = {
      ...testUsers.admin,
      permissionOverrides: { "recipe:delete": false },
    };
    const denied = recipesRouter.createCaller(makeContext(adminUserDenied));
    await expect(denied.archive({ id })).rejects.toThrow(/insufficient permissions/i);
  });
});

describe("recipes router – validation", () => {
  it("rejects empty name", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(
      caller.create({ ...sampleRecipe(`Valid ${SUFFIX}`), name: "" }),
    ).rejects.toThrow();
  });

  it("rejects unknown step kind", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(
      caller.create({
        ...sampleRecipe(`BadKind ${SUFFIX}`),
        steps: [
          {
            kind: "not_a_real_kind" as any,
            sequence: 0,
            label: "x",
            triggerKind: "manual",
            triggerData: {},
            actionData: {},
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("rejects negative ingredient rate", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(
      caller.create({
        ...sampleRecipe(`NegRate ${SUFFIX}`),
        inputs: [
          {
            kind: "ingredient",
            label: "Bad",
            rateValue: -5,
            rateUnit: "g/L",
            sortOrder: 0,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("rejects unknown trigger kind", async () => {
    const caller = recipesRouter.createCaller(makeContext(testUsers.admin));
    await expect(
      caller.create({
        ...sampleRecipe(`BadTrig ${SUFFIX}`),
        steps: [
          {
            kind: "wait",
            sequence: 0,
            label: "x",
            triggerKind: "fake_trigger" as any,
            triggerData: {},
            actionData: {},
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
