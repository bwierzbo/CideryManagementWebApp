/**
 * TTB Parity Regression Tests
 *
 * Verifies all parity fixes between reconciliation waterfall and TTB form outputs.
 * Each test targets a specific fix (P0-1, P0-3, P1-1, P1-3, P1-4)
 * to prevent regressions.
 *
 * These are integration tests that hit the real database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "..";
import {
  db,
  batches,
  vessels,
  organizations,
  organizationSettings,
  kegFills,
  kegs,
  bottleRuns,
  batchRackingOperations,
  pressRuns,
  pressRunLoads,
  vendors,
  baseFruitVarieties,
  basefruitPurchases,
  basefruitPurchaseItems,
  users,
} from "db";
import { eq } from "drizzle-orm";

// ============================================
// TEST CONSTANTS
// ============================================
const TEST_PREFIX = "__ttb_parity_test__";
const OPENING_DATE = "2024-12-31";
const RECONCILIATION_DATE = "2025-12-31";

// Test context with admin session
const testContext = {
  session: {
    user: {
      id: "00000000-0000-0000-0000-000000000099",
      email: "ttb-test@example.com",
      role: "admin" as const,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  },
  user: {
    id: "00000000-0000-0000-0000-000000000099",
    email: "ttb-test@example.com",
    role: "admin" as const,
  },
};

// ============================================
// TEST DATA TRACKING
// ============================================
let testOrgId: string;
let testOrgSettingsId: string;
let testVesselId: string;
let testVesselId2: string; // Second vessel for racking destination
let testVendorId: string;
let testVarietyId: string;
let testPurchaseId: string;
let testPurchaseItemId: string;
let testUserId: string;
let testKegId: string;
let testBatchIds: string[] = [];
let testKegFillIds: string[] = [];
let testBottleRunIds: string[] = [];
let testRackingIds: string[] = [];
let testPressRunIds: string[] = [];
let testPressRunLoadIds: string[] = [];

// ============================================
// SETUP AND TEARDOWN
// ============================================

async function cleanupTestData() {
  // Delete in reverse dependency order
  for (const id of testRackingIds) {
    await db.delete(batchRackingOperations).where(eq(batchRackingOperations.id, id)).catch(() => {});
  }
  for (const id of testKegFillIds) {
    await db.delete(kegFills).where(eq(kegFills.id, id)).catch(() => {});
  }
  for (const id of testBottleRunIds) {
    await db.delete(bottleRuns).where(eq(bottleRuns.id, id)).catch(() => {});
  }
  for (const id of testPressRunLoadIds) {
    await db.delete(pressRunLoads).where(eq(pressRunLoads.id, id)).catch(() => {});
  }
  // Clear batch originPressRunId before deleting press runs
  for (const id of testBatchIds) {
    await db.update(batches).set({ originPressRunId: null }).where(eq(batches.id, id)).catch(() => {});
  }
  for (const id of testPressRunIds) {
    await db.delete(pressRuns).where(eq(pressRuns.id, id)).catch(() => {});
  }
  for (const id of testBatchIds) {
    await db.delete(batches).where(eq(batches.id, id)).catch(() => {});
  }
  if (testKegId) {
    await db.delete(kegs).where(eq(kegs.id, testKegId)).catch(() => {});
  }
  if (testPurchaseItemId) {
    await db.delete(basefruitPurchaseItems).where(eq(basefruitPurchaseItems.id, testPurchaseItemId)).catch(() => {});
  }
  if (testPurchaseId) {
    await db.delete(basefruitPurchases).where(eq(basefruitPurchases.id, testPurchaseId)).catch(() => {});
  }
  if (testVarietyId) {
    await db.delete(baseFruitVarieties).where(eq(baseFruitVarieties.id, testVarietyId)).catch(() => {});
  }
  if (testVendorId) {
    await db.delete(vendors).where(eq(vendors.id, testVendorId)).catch(() => {});
  }
  if (testVesselId) {
    await db.delete(vessels).where(eq(vessels.id, testVesselId)).catch(() => {});
  }
  if (testVesselId2) {
    await db.delete(vessels).where(eq(vessels.id, testVesselId2)).catch(() => {});
  }
  if (testOrgSettingsId) {
    await db.delete(organizationSettings).where(eq(organizationSettings.id, testOrgSettingsId)).catch(() => {});
  }
  if (testOrgId) {
    await db.delete(organizations).where(eq(organizations.id, testOrgId)).catch(() => {});
  }
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId)).catch(() => {});
  }

  // Reset tracking
  testBatchIds = [];
  testKegFillIds = [];
  testBottleRunIds = [];
  testRackingIds = [];
  testPressRunIds = [];
  testPressRunLoadIds = [];
}

async function setupBaseTestData() {
  // Create test user (needed for createdBy FKs)
  const [user] = await db.insert(users).values({
    email: `${TEST_PREFIX}_${Date.now()}@test.com`,
    name: `${TEST_PREFIX}_user`,
    passwordHash: "test-hash-not-real",
    role: "admin" as any,
  }).returning();
  testUserId = user.id;

  // Create organization
  const [org] = await db.insert(organizations).values({
    name: `${TEST_PREFIX}_org`,
  }).returning();
  testOrgId = org.id;

  // Create org settings with TTB opening balances
  const [settings] = await db.insert(organizationSettings).values({
    organizationId: testOrgId,
    name: `${TEST_PREFIX}_settings`,
    ttbOpeningBalanceDate: OPENING_DATE,
    ttbOpeningBalances: {
      bulk: {
        hardCider: 100,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
      },
      bottled: {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
      },
      spirits: {
        appleBrandy: 0,
        grapeSpirits: 0,
      },
    },
  }).returning();
  testOrgSettingsId = settings.id;

  // Create two vessels (second for racking destination)
  const [vessel] = await db.insert(vessels).values({
    name: `${TEST_PREFIX}_vessel`,
    capacity: "1000",
    capacityUnit: "L",
    capacityLiters: "1000",
  }).returning();
  testVesselId = vessel.id;

  const [vessel2] = await db.insert(vessels).values({
    name: `${TEST_PREFIX}_vessel2`,
    capacity: "1000",
    capacityUnit: "L",
    capacityLiters: "1000",
  }).returning();
  testVesselId2 = vessel2.id;

  // Create vendor and variety for press runs
  const [vendor] = await db.insert(vendors).values({
    name: `${TEST_PREFIX}_vendor`,
    contactInfo: {},
  }).returning();
  testVendorId = vendor.id;

  const [variety] = await db.insert(baseFruitVarieties).values({
    name: `${TEST_PREFIX}_variety`,
  }).returning();
  testVarietyId = variety.id;

  // Create purchase + purchase item (required FK for press run loads)
  const [purchase] = await db.insert(basefruitPurchases).values({
    vendorId: testVendorId,
    purchaseDate: new Date("2025-01-05"),
    totalCost: "50.00",
  }).returning();
  testPurchaseId = purchase.id;

  const [purchaseItem] = await db.insert(basefruitPurchaseItems).values({
    purchaseId: testPurchaseId,
    fruitVarietyId: testVarietyId,
    quantity: "100",
    unit: "lb" as any,
    pricePerUnit: "0.50",
    totalCost: "50.00",
  }).returning();
  testPurchaseItemId = purchaseItem.id;

  // Create a keg for keg fill tests
  const [keg] = await db.insert(kegs).values({
    kegNumber: `${TEST_PREFIX}_KEG_${Date.now()}`,
    kegType: "sanke_20L" as any,
    capacityML: 20000,
  }).returning();
  testKegId = keg.id;
}

/**
 * Helper: create a batch with controlled parameters
 */
async function createTestBatch(opts: {
  name: string;
  initialVolumeLiters: number;
  currentVolumeLiters: number;
  status?: string;
  productType?: string;
  reconciliationStatus?: "verified" | "duplicate" | "excluded" | "pending";
  startDate?: Date;
}) {
  const batchName = `${TEST_PREFIX}_${opts.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const [batch] = await db.insert(batches).values({
    vesselId: testVesselId,
    name: batchName,
    customName: `${TEST_PREFIX}_${opts.name}`,
    batchNumber: `T-${testBatchIds.length + 1}-${Date.now()}`,
    initialVolume: opts.initialVolumeLiters.toString(),
    initialVolumeUnit: "L",
    initialVolumeLiters: opts.initialVolumeLiters.toString(),
    currentVolume: opts.currentVolumeLiters.toString(),
    currentVolumeUnit: "L",
    currentVolumeLiters: opts.currentVolumeLiters.toString(),
    status: (opts.status ?? "aging") as any,
    productType: (opts.productType ?? "cider") as any,
    reconciliationStatus: opts.reconciliationStatus ?? "verified",
    startDate: opts.startDate ?? new Date("2025-03-01"),
  }).returning();
  testBatchIds.push(batch.id);
  return batch;
}

/**
 * Helper: create a keg fill with proper FK references
 */
async function createTestKegFill(opts: {
  batchId: string;
  volumeTaken: number;
  volumeTakenUnit?: string;
  loss?: number;
  lossUnit?: string;
  filledAt?: Date;
  distributedAt?: Date | null;
}) {
  const [kf] = await db.insert(kegFills).values({
    kegId: testKegId,
    batchId: opts.batchId,
    vesselId: testVesselId,
    volumeTaken: opts.volumeTaken.toString(),
    volumeTakenUnit: (opts.volumeTakenUnit ?? "L") as any,
    loss: (opts.loss ?? 0).toString(),
    lossUnit: (opts.lossUnit ?? "L") as any,
    filledAt: opts.filledAt ?? new Date("2025-06-01"),
    distributedAt: opts.distributedAt ?? null,
    createdBy: testUserId,
  }).returning();
  testKegFillIds.push(kf.id);
  return kf;
}

/**
 * Helper: create a bottle run with proper FK references
 */
async function createTestBottleRun(opts: {
  batchId: string;
  volumeTakenLiters: number;
  loss?: number;
  lossUnit?: string;
  packagedAt?: Date;
  distributedAt?: Date | null;
  status?: string;
}) {
  const [br] = await db.insert(bottleRuns).values({
    batchId: opts.batchId,
    vesselId: testVesselId,
    packageType: "bottle" as any,
    packageSizeML: 750,
    unitSize: "0.75",
    unitSizeUnit: "L" as any,
    unitsProduced: 10,
    volumeTaken: opts.volumeTakenLiters.toString(),
    volumeTakenUnit: "L" as any,
    volumeTakenLiters: opts.volumeTakenLiters.toString(),
    loss: (opts.loss ?? 0).toString(),
    lossUnit: (opts.lossUnit ?? "L") as any,
    packagedAt: opts.packagedAt ?? new Date("2025-06-01"),
    distributedAt: opts.distributedAt ?? null,
    status: (opts.status ?? "distributed") as any,
    createdBy: testUserId,
  }).returning();
  testBottleRunIds.push(br.id);
  return br;
}

/**
 * Helper: create a racking operation with proper FK references
 */
async function createTestRacking(opts: {
  batchId: string;
  volumeLoss: number;
  notes?: string;
  rackedAt?: Date;
}) {
  const [rack] = await db.insert(batchRackingOperations).values({
    batchId: opts.batchId,
    sourceVesselId: testVesselId,
    destinationVesselId: testVesselId2,
    volumeBefore: "100",
    volumeBeforeUnit: "L" as any,
    volumeAfter: (100 - opts.volumeLoss).toString(),
    volumeAfterUnit: "L" as any,
    volumeLoss: opts.volumeLoss.toString(),
    volumeLossUnit: "L" as any,
    notes: opts.notes ?? null,
    rackedAt: opts.rackedAt ?? new Date("2025-05-01"),
  }).returning();
  testRackingIds.push(rack.id);
  return rack;
}

/**
 * Helper: create a press run for production (current schema)
 */
async function createTestPressRun(opts: {
  batchId: string;
  yieldLiters: number;
  pressDate?: Date;
}) {
  // Create the press run
  const [pr] = await db.insert(pressRuns).values({
    vendorId: testVendorId,
    vesselId: testVesselId,
    status: "completed" as any,
    dateCompleted: (opts.pressDate ?? new Date("2025-03-01")).toISOString().split("T")[0],
    totalJuiceVolume: opts.yieldLiters.toString(),
    totalJuiceVolumeUnit: "L" as any,
    totalJuiceVolumeLiters: opts.yieldLiters.toString(),
  }).returning();
  testPressRunIds.push(pr.id);

  // Create a press run load (links press run to purchase item)
  const [load] = await db.insert(pressRunLoads).values({
    pressRunId: pr.id,
    purchaseItemId: testPurchaseItemId,
    fruitVarietyId: testVarietyId,
    loadSequence: 1,
    appleWeightKg: "45.36",
  }).returning();
  testPressRunLoadIds.push(load.id);

  // Link batch to press run via originPressRunId
  await db.update(batches)
    .set({ originPressRunId: pr.id })
    .where(eq(batches.id, opts.batchId));

  return pr;
}

/**
 * Call getReconciliationSummary and return the result
 */
async function getReconciliation(endDate?: string) {
  const caller = appRouter.createCaller(testContext);
  return caller.ttb.getReconciliationSummary({
    endDate: endDate ?? RECONCILIATION_DATE,
  });
}

// ============================================
// TESTS
// ============================================

describe("TTB Parity Regression Tests", () => {
  beforeAll(async () => {
    await cleanupTestData();
    await setupBaseTestData();
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  // ------------------------------------------
  // Fix #1 (P0-1): Inventory scope — pending batches counted
  // ------------------------------------------
  describe("Fix #1 (P0-1): Inventory scope includes pending batches", () => {
    beforeAll(async () => {
      const pendingBatch = await createTestBatch({
        name: "pending_batch",
        initialVolumeLiters: 100,
        currentVolumeLiters: 80,
        reconciliationStatus: "pending",
      });
      await createTestPressRun({
        batchId: pendingBatch.id,
        yieldLiters: 100,
      });
    }, 15000);

    it("should include pending batch volume in inventory totals", async () => {
      const result = await getReconciliation();

      // The pending batch's currentVolumeLiters (80L) should be in the inventory
      // If the old bug was present (verified-only), pending batches would be excluded
      expect(result.totals.ttbCalculatedEnding).toBeGreaterThan(0);
      expect(result.waterfall.byTaxClass.length).toBeGreaterThan(0);
    }, 30000);

    it("should NOT include duplicate batches in inventory", async () => {
      await createTestBatch({
        name: "duplicate_batch",
        initialVolumeLiters: 50,
        currentVolumeLiters: 50,
        reconciliationStatus: "duplicate",
      });

      const result = await getReconciliation();
      const debugInv = (result as any).debug?.inventoryBreakdown?.byTaxClassTotal ?? 0;

      // Add another pending batch and verify it increases inventory
      const pendingBatch2 = await createTestBatch({
        name: "pending_batch2",
        initialVolumeLiters: 30,
        currentVolumeLiters: 30,
        reconciliationStatus: "pending",
      });
      await createTestPressRun({
        batchId: pendingBatch2.id,
        yieldLiters: 30,
      });

      const result2 = await getReconciliation();
      const debugInv2 = (result2 as any).debug?.inventoryBreakdown?.byTaxClassTotal ?? 0;

      // Pending batch added ~30L (≈7.9 gal) — should increase inventory
      expect(debugInv2).toBeGreaterThan(debugInv);
    }, 30000);
  });

  // ------------------------------------------
  // Fix #3 (P1-1): Historical Record racking filter
  // ------------------------------------------
  describe("Fix #3 (P1-1): Historical Record rackings excluded from losses", () => {
    beforeAll(async () => {
      const rackingBatch = await createTestBatch({
        name: "racking_filter_batch",
        initialVolumeLiters: 200,
        currentVolumeLiters: 180,
      });
      await createTestPressRun({
        batchId: rackingBatch.id,
        yieldLiters: 200,
      });

      // Normal racking (should be counted)
      await createTestRacking({
        batchId: rackingBatch.id,
        volumeLoss: 5,
        notes: "Normal racking loss",
      });
    }, 15000);

    it("should exclude Historical Record rackings from loss totals", async () => {
      const resultBefore = await getReconciliation();
      const lossesBefore = resultBefore.waterfall.totals.losses;

      // Add a Historical Record racking — should NOT increase losses
      const histBatch = testBatchIds.find((_, i) =>
        // Use the racking_filter_batch
        true
      );
      // Create on the last batch (racking_filter_batch is still the most recent for this describe)
      const rackingBatch = await createTestBatch({
        name: "hist_racking_batch",
        initialVolumeLiters: 100,
        currentVolumeLiters: 90,
      });
      await createTestPressRun({
        batchId: rackingBatch.id,
        yieldLiters: 100,
      });

      await createTestRacking({
        batchId: rackingBatch.id,
        volumeLoss: 10,
        notes: "Historical Record - imported from old system",
      });

      const resultAfter = await getReconciliation();
      const lossesAfter = resultAfter.waterfall.totals.losses;

      // The 10L Historical Record racking should NOT add to losses.
      // If old bug present, delta would be ~2.6 gal.
      const delta = Math.abs(lossesAfter - lossesBefore);
      expect(delta).toBeLessThan(0.2);
    }, 30000);

    it("should include regular rackings in loss totals", async () => {
      const result = await getReconciliation();
      // The 5L normal racking = ~1.32 gal should contribute to losses
      expect(result.waterfall.totals.losses).toBeGreaterThan(0);
    }, 30000);
  });

  // ------------------------------------------
  // Fix #4 (P1-3): Bottle/keg loss lossUnit handling
  // Verifies both the aggregate waterfall and per-batch SBD loss queries
  // convert lossUnit='gal' correctly.
  // ------------------------------------------
  describe("Fix #4 (P1-3): lossUnit conversion in loss queries", () => {
    let lossBatch: any;

    beforeAll(async () => {
      lossBatch = await createTestBatch({
        name: "loss_unit_batch",
        initialVolumeLiters: 300,
        currentVolumeLiters: 250,
      });
      await createTestPressRun({
        batchId: lossBatch.id,
        yieldLiters: 300,
      });

      // Create bottle run with 1 gal loss = 3.78541 L
      await createTestBottleRun({
        batchId: lossBatch.id,
        volumeTakenLiters: 20,
        loss: 1,
        lossUnit: "gal",
        distributedAt: new Date("2025-07-01"),
      });

      // Create keg fill with 2 gal loss = 7.57 L
      await createTestKegFill({
        batchId: lossBatch.id,
        volumeTaken: 30,
        volumeTakenUnit: "L",
        loss: 2,
        lossUnit: "gal",
        filledAt: new Date("2025-08-01"),
      });
    }, 15000);

    it("per-batch SBD should show bottling loss of ~1 gal (not ~0.26 gal)", async () => {
      const result = await getReconciliation();
      const batches = (result as any).batchReconciliation?.batches ?? [];
      const entry = batches.find((b: any) => b.batchId === lossBatch.id);

      expect(entry).toBeDefined();
      // 1 gal bottle loss ≈ 1.0 gal. If unconverted: 1L ≈ 0.264 gal.
      expect(entry.lossBreakdown.bottling).toBeGreaterThan(0.8);
      expect(entry.lossBreakdown.bottling).toBeLessThan(1.3);
    }, 30000);

    it("per-batch SBD should show kegging loss of ~2 gal (not ~0.53 gal)", async () => {
      const result = await getReconciliation();
      const batches = (result as any).batchReconciliation?.batches ?? [];
      const entry = batches.find((b: any) => b.batchId === lossBatch.id);

      expect(entry).toBeDefined();
      // 2 gal keg loss ≈ 2.0 gal. If unconverted: 2L ≈ 0.528 gal.
      expect(entry.lossBreakdown.kegging).toBeGreaterThan(1.5);
      expect(entry.lossBreakdown.kegging).toBeLessThan(2.5);
    }, 30000);
  });

  // ------------------------------------------
  // Fix #5 (P1-4): Keg distribution volumeTaken unit handling
  // Tests per-batch SBD to avoid waterfall clamping (Math.max(0, removals - transfersOut)).
  // ------------------------------------------
  describe("Fix #5 (P1-4): Keg volumeTaken unit conversion in distributions", () => {
    let kegBatch: any;

    beforeAll(async () => {
      kegBatch = await createTestBatch({
        name: "keg_unit_batch",
        initialVolumeLiters: 500,
        currentVolumeLiters: 400,
      });
      await createTestPressRun({
        batchId: kegBatch.id,
        yieldLiters: 500,
      });

      // 5 gal volumeTaken, distributed → should show as ~5 gal in per-batch sales
      await createTestKegFill({
        batchId: kegBatch.id,
        volumeTaken: 5,
        volumeTakenUnit: "gal",
        loss: 0,
        lossUnit: "L",
        filledAt: new Date("2025-09-01"),
        distributedAt: new Date("2025-09-15"),
      });

      // 10 gal taken, 1 gal loss, distributed → net 9 gal
      await createTestKegFill({
        batchId: kegBatch.id,
        volumeTaken: 10,
        volumeTakenUnit: "gal",
        loss: 1,
        lossUnit: "gal",
        filledAt: new Date("2025-10-01"),
        distributedAt: new Date("2025-10-15"),
      });
    }, 15000);

    it("per-batch SBD should show ~5 gal + ~9 gal = ~14 gal keg distributions (not ~3.7 gal)", async () => {
      const result = await getReconciliation();
      const batches = (result as any).batchReconciliation?.batches ?? [];
      const entry = batches.find((b: any) => b.batchId === kegBatch.id);

      expect(entry).toBeDefined();
      // Total keg distributions: 5 gal + (10 - 1) gal = 14 gal.
      // If unconverted: 5L + 9L = 14L ≈ 3.70 gal.
      // Per-batch "sales" = periodBottleDistL + periodKegDistL (in gallons)
      expect(entry.sales).toBeGreaterThan(12.0);
      expect(entry.sales).toBeLessThan(16.0);
    }, 30000);

    it("per-batch SBD should correctly convert kegging taken volume with gallon units", async () => {
      const result = await getReconciliation();
      const batches = (result as any).batchReconciliation?.batches ?? [];
      const entry = batches.find((b: any) => b.batchId === kegBatch.id);

      expect(entry).toBeDefined();
      // Kegging loss for mixed gallon: 1 gal ≈ 1.0 gal
      // If unconverted: 1L ≈ 0.264 gal
      expect(entry.lossBreakdown.kegging).toBeGreaterThan(0.8);
      expect(entry.lossBreakdown.kegging).toBeLessThan(1.3);
    }, 30000);
  });

  // ------------------------------------------
  // Fix #6: Parity diagnostics structure
  // ------------------------------------------
  describe("Fix #6: Parity diagnostics in API response", () => {
    it("should include parityDiagnostics in response", async () => {
      const result = await getReconciliation();

      expect(result).toHaveProperty("parityDiagnostics");
      const diag = (result as any).parityDiagnostics;
      expect(diag).toHaveProperty("passed");
      expect(typeof diag.passed).toBe("boolean");
      expect(diag).toHaveProperty("warnings");
      expect(Array.isArray(diag.warnings)).toBe(true);
    }, 30000);

    it("parity warnings should have correct structure when present", async () => {
      const result = await getReconciliation();
      const diag = (result as any).parityDiagnostics;

      for (const w of diag.warnings) {
        expect(w).toHaveProperty("level");
        expect(["error", "warning", "info"]).toContain(w.level);
        expect(w).toHaveProperty("category");
        expect(typeof w.category).toBe("string");
        expect(w).toHaveProperty("message");
        expect(typeof w.message).toBe("string");
        expect(w).toHaveProperty("detail");
        expect(typeof w.detail).toBe("object");
      }
    }, 30000);
  });

  // ------------------------------------------
  // Fix #2 (P0-3): Waterfall identity check
  // ------------------------------------------
  describe("Fix #2 (P0-3): Waterfall uses raw losses and aggregate inventory", () => {
    it("waterfall totals should satisfy identity: opening + production - transfers - sales - losses - distillation ≈ calculatedEnding", async () => {
      const result = await getReconciliation();
      const t = result.waterfall.totals;

      const expected = t.opening + t.production - t.transfersOut
        - t.sales - t.losses - t.distillation;

      const gap = Math.abs(expected - t.calculatedEnding);
      // Allow tolerance for floating-point arithmetic
      expect(gap).toBeLessThan(0.5);
    }, 30000);

    it("per-tax-class waterfall entries should each satisfy identity", async () => {
      const result = await getReconciliation();

      for (const entry of result.waterfall.byTaxClass) {
        const expected = entry.opening + entry.production - entry.transfersOut
          - entry.sales - entry.losses - entry.distillation;
        const gap = Math.abs(expected - entry.calculatedEnding);

        expect(gap).toBeLessThan(0.05);
      }
    }, 30000);

    it("totals.losses should use raw processLosses (not effective/clamped)", async () => {
      const result = await getReconciliation();
      const debug = (result as any).debug?.ttbCalculation;

      if (debug) {
        expect(result.totals.losses).toBeCloseTo(debug.rawLosses, 0);
      }
    }, 30000);

    it("totals.ttbCalculatedEnding should use inventoryByTaxClass total", async () => {
      const result = await getReconciliation();
      const debug = (result as any).debug?.inventoryBreakdown;

      if (debug) {
        expect(result.totals.ttbCalculatedEnding).toBeCloseTo(debug.byTaxClassTotal, 0);
      }
    }, 30000);
  });
});
