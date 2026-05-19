/**
 * Integration tests for vessel.destroyBatch and vessel.prepForCleaning.
 *
 * These replaced the old vessel.purge. Key invariants under test:
 *   - destroyBatch creates a 'destruction' batch_volume_adjustments row
 *     (so TTB Form 5120.17 surfaces it under "Destroyed in process") AND
 *     marks the batch status='discarded' with destroyed_at + reason +
 *     category populated. The row is NOT soft-deleted — old purge did that
 *     and made destroyed cider invisible to reports.
 *   - prepForCleaning writes a 'sediment' row only when residueL > 0
 *     (otherwise the tank was already empty), closes the batch as
 *     completed, and clears vessel_id. Vessel goes to cleaning.
 *
 * No mocks per CLAUDE.md. Real DB via tRPC createCaller.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  users,
  vessels,
  batches,
  batchVolumeAdjustments,
} from "db";
import { appRouter } from "../index";
import bcrypt from "bcryptjs";
import type { AuthSession, AuthUser, Context } from "../../trpc";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const SUFFIX = `dp-${Date.now().toString(36)}`;

function makeContext(user: AuthUser): Context {
  const session: AuthSession = {
    user,
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
  return { session, user };
}

async function makeUser(): Promise<AuthUser> {
  const hash = await bcrypt.hash("test-password", 4);
  const [row] = await db
    .insert(users)
    .values({
      email: `destroy-prep-test-admin-${SUFFIX}@example.com`,
      name: `Destroy/Prep Test admin`,
      passwordHash: hash,
      role: "admin",
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

async function makeVesselAndBatch(opts: {
  vesselName: string;
  batchName: string;
  volumeL: number;
  status?: "fermentation" | "aging" | "conditioning";
}) {
  const [vessel] = await db
    .insert(vessels)
    .values({
      name: opts.vesselName,
      capacity: "1000",
      capacityUnit: "L",
      material: "stainless_steel",
      jacketed: "no",
      isPressureRated: "no",
      status: "available",
    })
    .returning();

  const [batch] = await db
    .insert(batches)
    .values({
      batchNumber: `BATCH-${SUFFIX}-${opts.batchName}`,
      name: `Batch ${opts.batchName}`,
      status: opts.status ?? "aging",
      vesselId: vessel.id,
      startDate: new Date(),
      initialVolume: opts.volumeL.toString(),
      initialVolumeUnit: "L",
      initialVolumeLiters: opts.volumeL.toString(),
      currentVolume: opts.volumeL.toString(),
      currentVolumeUnit: "L",
      currentVolumeLiters: opts.volumeL.toString(),
      productType: "cider",
      isArchived: false,
    })
    .returning();

  return { vessel, batch };
}

let testUser: AuthUser;
const createdVesselIds: string[] = [];
const createdBatchIds: string[] = [];

beforeAll(async () => {
  testUser = await makeUser();
});

afterAll(async () => {
  if (createdBatchIds.length) {
    await db
      .delete(batchVolumeAdjustments)
      .where(inArray(batchVolumeAdjustments.batchId, createdBatchIds))
      .catch(() => {});
    await db
      .delete(batches)
      .where(inArray(batches.id, createdBatchIds))
      .catch(() => {});
  }
  if (createdVesselIds.length) {
    await db
      .delete(vessels)
      .where(inArray(vessels.id, createdVesselIds))
      .catch(() => {});
  }
  if (testUser?.id) {
    await db.delete(users).where(eq(users.id, testUser.id)).catch(() => {});
  }
});

describe("vessel.destroyBatch", () => {
  it("destroys an active batch and writes a destruction adjustment", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-DESTROY-OK-${SUFFIX}`,
      batchName: `destroy-ok`,
      volumeL: 500,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    const result = await caller.vessel.destroyBatch({
      vesselId: vessel.id,
      volumeL: 500,
      category: "contamination_spoilage",
      reason: "Vinegar character, dumped to drain",
      confirmed: true,
    });

    expect(result.success).toBe(true);
    expect(result.volumeDestroyedL).toBe(500);

    const [after] = await db
      .select()
      .from(batches)
      .where(eq(batches.id, batch.id));
    expect(after.status).toBe("discarded");
    expect(after.destroyedAt).toBeTruthy();
    expect(after.destructionReason).toBe("Vinegar character, dumped to drain");
    expect(after.destructionCategory).toBe("contamination_spoilage");
    expect(parseFloat(after.currentVolumeLiters || "0")).toBe(0);
    expect(after.deletedAt).toBeNull(); // critical: NOT soft-deleted

    const adjs = await db
      .select()
      .from(batchVolumeAdjustments)
      .where(eq(batchVolumeAdjustments.batchId, batch.id));
    expect(adjs).toHaveLength(1);
    expect(adjs[0].adjustmentType).toBe("destruction");
    expect(parseFloat(adjs[0].adjustmentAmount)).toBe(-500);

    const [v] = await db.select().from(vessels).where(eq(vessels.id, vessel.id));
    expect(v.status).toBe("cleaning");
  });

  it("rejects when confirmed is false", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-DESTROY-NOCONFIRM-${SUFFIX}`,
      batchName: `destroy-noconfirm`,
      volumeL: 200,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    await expect(
      caller.vessel.destroyBatch({
        vesselId: vessel.id,
        volumeL: 200,
        category: "failed_quality",
        reason: "Out-of-spec FG, decided to dump",
        confirmed: false as unknown as true,
      }),
    ).rejects.toThrow();
  });

  it("rejects when reason is too short", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-DESTROY-SHORTRSN-${SUFFIX}`,
      batchName: `destroy-shortrsn`,
      volumeL: 200,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    await expect(
      caller.vessel.destroyBatch({
        vesselId: vessel.id,
        volumeL: 200,
        category: "other",
        reason: "bad",
        confirmed: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects when destroy volume exceeds batch current volume", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-DESTROY-OVER-${SUFFIX}`,
      batchName: `destroy-over`,
      volumeL: 100,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    await expect(
      caller.vessel.destroyBatch({
        vesselId: vessel.id,
        volumeL: 200,
        category: "accidental_loss",
        reason: "Operator entered larger volume than physically present",
        confirmed: true,
      }),
    ).rejects.toThrow(/exceeds batch current volume/);
  });

  it("rejects when vessel has no active batch", async () => {
    const [emptyVessel] = await db
      .insert(vessels)
      .values({
        name: `T-DESTROY-EMPTY-${SUFFIX}`,
        capacity: "1000",
        capacityUnit: "L",
        material: "stainless_steel",
        jacketed: "no",
        isPressureRated: "no",
        status: "available",
      })
      .returning();
    createdVesselIds.push(emptyVessel.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    await expect(
      caller.vessel.destroyBatch({
        vesselId: emptyVessel.id,
        volumeL: 10,
        category: "other",
        reason: "no batch to destroy here",
        confirmed: true,
      }),
    ).rejects.toThrow(/No active batch/);
  });
});

describe("vessel.prepForCleaning", () => {
  it("writes a sediment adjustment when residueL > 0 and closes the batch", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-PREP-RESIDUE-${SUFFIX}`,
      batchName: `prep-residue`,
      volumeL: 800,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    const result = await caller.vessel.prepForCleaning({
      vesselId: vessel.id,
      residueL: 5,
      notes: "racking lees",
    });
    expect(result.success).toBe(true);

    const [after] = await db.select().from(batches).where(eq(batches.id, batch.id));
    expect(after.status).toBe("completed");
    expect(after.vesselId).toBeNull();
    expect(parseFloat(after.currentVolumeLiters || "0")).toBe(0);

    const adjs = await db
      .select()
      .from(batchVolumeAdjustments)
      .where(eq(batchVolumeAdjustments.batchId, batch.id));
    expect(adjs).toHaveLength(1);
    expect(adjs[0].adjustmentType).toBe("sediment");
    expect(parseFloat(adjs[0].adjustmentAmount)).toBe(-5);

    const [v] = await db.select().from(vessels).where(eq(vessels.id, vessel.id));
    expect(v.status).toBe("cleaning");
  });

  it("skips the adjustment row when residueL is 0", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-PREP-EMPTY-${SUFFIX}`,
      batchName: `prep-empty`,
      volumeL: 0,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    const result = await caller.vessel.prepForCleaning({
      vesselId: vessel.id,
      residueL: 0,
    });
    expect(result.success).toBe(true);

    const adjs = await db
      .select()
      .from(batchVolumeAdjustments)
      .where(eq(batchVolumeAdjustments.batchId, batch.id));
    expect(adjs).toHaveLength(0);

    const [after] = await db.select().from(batches).where(eq(batches.id, batch.id));
    expect(after.status).toBe("completed");
    expect(after.vesselId).toBeNull();
  });

  it("rejects when residue exceeds batch volume", async () => {
    const { vessel, batch } = await makeVesselAndBatch({
      vesselName: `T-PREP-OVER-${SUFFIX}`,
      batchName: `prep-over`,
      volumeL: 10,
    });
    createdVesselIds.push(vessel.id);
    createdBatchIds.push(batch.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    await expect(
      caller.vessel.prepForCleaning({ vesselId: vessel.id, residueL: 50 }),
    ).rejects.toThrow(/exceeds batch volume/);
  });

  it("rejects when vessel has nothing to clear", async () => {
    const [emptyVessel] = await db
      .insert(vessels)
      .values({
        name: `T-PREP-NOTHING-${SUFFIX}`,
        capacity: "1000",
        capacityUnit: "L",
        material: "stainless_steel",
        jacketed: "no",
        isPressureRated: "no",
        status: "available",
      })
      .returning();
    createdVesselIds.push(emptyVessel.id);

    const caller = appRouter.createCaller(makeContext(testUser));
    await expect(
      caller.vessel.prepForCleaning({ vesselId: emptyVessel.id, residueL: 0 }),
    ).rejects.toThrow(/no batch or press run/);
  });
});
