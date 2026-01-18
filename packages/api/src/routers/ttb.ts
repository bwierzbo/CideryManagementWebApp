/**
 * TTB Reporting Router
 *
 * API endpoints for generating TTB Form 5120.17 data
 * and managing report snapshots.
 */

import { z } from "zod";
import { router, protectedProcedure, createRbacProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  db,
  batches,
  inventoryItems,
  inventoryDistributions,
  inventoryAdjustments,
  kegFills,
  salesChannels,
  ttbReportingPeriods,
  ttbPeriodSnapshots,
  organizationSettings,
  batchFilterOperations,
  batchRackingOperations,
  bottleRuns,
  users,
  basefruitPurchases,
  basefruitPurchaseItems,
  baseFruitVarieties,
  pressRunLoads,
  pressRuns,
  additivePurchases,
  additivePurchaseItems,
  additiveVarieties,
  juicePurchases,
  juicePurchaseItems,
  type TTBOpeningBalances,
} from "db";
import {
  eq,
  and,
  gte,
  lte,
  lt,
  isNull,
  sql,
  desc,
  asc,
  ne,
  or,
  like,
} from "drizzle-orm";
import {
  litersToWineGallons,
  mlToWineGallons,
  calculateHardCiderTax,
  calculateReconciliation,
  roundGallons,
  getPeriodDateRange,
  formatPeriodLabel,
  type TTBForm512017Data,
  type InventoryBreakdown,
  type TaxPaidRemovals,
  type OtherRemovals,
  type BulkWinesSection,
  type BottledWinesSection,
  type MaterialsSection,
  type FermentersSection,
} from "lib";

// Input schemas
const generateForm512017Input = z.object({
  periodType: z.enum(["monthly", "quarterly", "annual"]),
  year: z.number().int().min(2020).max(2100),
  periodNumber: z.number().int().min(1).max(12).optional(),
});

const saveReportSnapshotInput = z.object({
  periodType: z.enum(["monthly", "quarterly", "annual"]),
  periodStart: z.string().transform((s) => new Date(s)),
  periodEnd: z.string().transform((s) => new Date(s)),
  data: z.object({
    beginningInventoryBulkGallons: z.number().optional(),
    beginningInventoryBottledGallons: z.number().optional(),
    beginningInventoryTotalGallons: z.number().optional(),
    wineProducedGallons: z.number().optional(),
    taxPaidTastingRoomGallons: z.number().optional(),
    taxPaidWholesaleGallons: z.number().optional(),
    taxPaidOnlineDtcGallons: z.number().optional(),
    taxPaidEventsGallons: z.number().optional(),
    taxPaidRemovalsTotalGallons: z.number().optional(),
    otherRemovalsSamplesGallons: z.number().optional(),
    otherRemovalsBreakageGallons: z.number().optional(),
    otherRemovalsLossesGallons: z.number().optional(),
    otherRemovalsTotalGallons: z.number().optional(),
    endingInventoryBulkGallons: z.number().optional(),
    endingInventoryBottledGallons: z.number().optional(),
    endingInventoryTotalGallons: z.number().optional(),
    taxableGallons: z.number().optional(),
    taxRate: z.number().optional(),
    smallProducerCreditGallons: z.number().optional(),
    smallProducerCreditAmount: z.number().optional(),
    taxOwed: z.number().optional(),
  }),
  notes: z.string().optional(),
});

export const ttbRouter = router({
  /**
   * Generate TTB Form 5120.17 data for a reporting period.
   *
   * Aggregates data from batches, inventory, distributions, and adjustments
   * to produce the complete form data.
   */
  generateForm512017: createRbacProcedure("read", "report")
    .input(generateForm512017Input)
    .query(async ({ input }) => {
      try {
        const { periodType, year, periodNumber } = input;
        const { startDate, endDate } = getPeriodDateRange(
          periodType,
          year,
          periodNumber
        );

        // Calculate day before start date for beginning inventory
        const dayBeforeStart = new Date(startDate);
        dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);

        // ============================================
        // Part I: Beginning Inventory
        // Priority: 1) Previous snapshot, 2) TTB Opening Balance, 3) Calculate
        // ============================================

        let beginningInventory: InventoryBreakdown;
        let beginningInventorySource: "snapshot" | "ttb_opening_balance" | "calculated" = "calculated";

        // 1. Check for previous period snapshot
        // Format startDate as string for comparison
        const startDateStr = startDate.toISOString().split("T")[0];

        const [previousSnapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(
            and(
              sql`${ttbPeriodSnapshots.periodEnd} < ${startDateStr}::date`,
              eq(ttbPeriodSnapshots.status, "finalized")
            )
          )
          .orderBy(desc(ttbPeriodSnapshots.periodEnd))
          .limit(1);

        if (previousSnapshot) {
          // Use previous snapshot's ending inventory (sum of all tax class columns)
          const bulkTotal =
            parseFloat(previousSnapshot.bulkHardCider || "0") +
            parseFloat(previousSnapshot.bulkWineUnder16 || "0") +
            parseFloat(previousSnapshot.bulkWine16To21 || "0") +
            parseFloat(previousSnapshot.bulkWine21To24 || "0") +
            parseFloat(previousSnapshot.bulkSparklingWine || "0") +
            parseFloat(previousSnapshot.bulkCarbonatedWine || "0");

          const bottledTotal =
            parseFloat(previousSnapshot.bottledHardCider || "0") +
            parseFloat(previousSnapshot.bottledWineUnder16 || "0") +
            parseFloat(previousSnapshot.bottledWine16To21 || "0") +
            parseFloat(previousSnapshot.bottledWine21To24 || "0") +
            parseFloat(previousSnapshot.bottledSparklingWine || "0") +
            parseFloat(previousSnapshot.bottledCarbonatedWine || "0");

          beginningInventory = {
            bulk: roundGallons(bulkTotal),
            bottled: roundGallons(bottledTotal),
            total: roundGallons(bulkTotal + bottledTotal),
          };
          beginningInventorySource = "snapshot";
        } else {
          // 2. Check for TTB Opening Balance
          const [settings] = await db
            .select({
              ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
              ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
            })
            .from(organizationSettings)
            .limit(1);

          const openingBalanceDate = settings?.ttbOpeningBalanceDate
            ? new Date(settings.ttbOpeningBalanceDate)
            : null;

          // Use TTB Opening Balance if period starts on or after the opening balance date
          if (settings?.ttbOpeningBalances && openingBalanceDate && startDate >= openingBalanceDate) {
            const balances = settings.ttbOpeningBalances;

            // Sum bulk balances across all tax classes
            const bulkTotal = Object.values(balances.bulk || {}).reduce(
              (sum: number, val) => sum + (Number(val) || 0),
              0
            );

            // Sum bottled balances across all tax classes
            const bottledTotal = Object.values(balances.bottled || {}).reduce(
              (sum: number, val) => sum + (Number(val) || 0),
              0
            );

            beginningInventory = {
              bulk: roundGallons(bulkTotal),
              bottled: roundGallons(bottledTotal),
              total: roundGallons(bulkTotal + bottledTotal),
            };
            beginningInventorySource = "ttb_opening_balance";
          } else {
            // 3. Fall back to calculating from current inventory
            // This is used for periods before the TTB opening balance date
            // or when no opening balance is set

            // Bulk inventory: Active batches with volume at start of period
            const bulkAtStart = await db
              .select({
                totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
              })
              .from(batches)
              .where(
                and(
                  isNull(batches.deletedAt),
                  lte(batches.startDate, dayBeforeStart),
                  or(
                    isNull(batches.endDate),
                    gte(batches.endDate, startDate)
                  )
                )
              );

            const beginningBulkLiters = Number(bulkAtStart[0]?.totalLiters || 0);

            // Bottled inventory: Inventory items created before period start
            const bottledAtStart = await db
              .select({
                totalML: sql<number>`COALESCE(SUM(
                  CAST(${inventoryItems.currentQuantity} AS DECIMAL) *
                  CAST(${inventoryItems.packageSizeML} AS DECIMAL)
                ), 0)`,
              })
              .from(inventoryItems)
              .where(lte(inventoryItems.createdAt, dayBeforeStart));

            const beginningBottledML = Number(bottledAtStart[0]?.totalML || 0);

            beginningInventory = {
              bulk: roundGallons(litersToWineGallons(beginningBulkLiters)),
              bottled: roundGallons(mlToWineGallons(beginningBottledML)),
              total: roundGallons(
                litersToWineGallons(beginningBulkLiters) +
                  mlToWineGallons(beginningBottledML)
              ),
            };
          }
        }

        // ============================================
        // Part II: Wine/Cider Produced
        // ============================================

        // Sum of initial volume from batches started in period
        const productionData = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              gte(batches.startDate, startDate),
              lte(batches.startDate, endDate)
            )
          );

        const wineProducedLiters = Number(productionData[0]?.totalLiters || 0);
        const wineProducedGallons = roundGallons(
          litersToWineGallons(wineProducedLiters)
        );

        // ============================================
        // Part III: Tax-Paid Removals by Channel
        // ============================================

        // Inventory distributions (bottles/cans)
        const distributionsByChannel = await db
          .select({
            channelCode: salesChannels.code,
            totalML: sql<number>`COALESCE(SUM(
              CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
              CAST(${inventoryItems.packageSizeML} AS DECIMAL)
            ), 0)`,
          })
          .from(inventoryDistributions)
          .leftJoin(
            inventoryItems,
            eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
          )
          .leftJoin(
            salesChannels,
            eq(inventoryDistributions.salesChannelId, salesChannels.id)
          )
          .where(
            and(
              gte(inventoryDistributions.distributionDate, startDate),
              lte(inventoryDistributions.distributionDate, endDate)
            )
          )
          .groupBy(salesChannels.code);

        // Keg distributions
        const kegDistributionsByChannel = await db
          .select({
            channelCode: salesChannels.code,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
          })
          .from(kegFills)
          .leftJoin(
            salesChannels,
            eq(kegFills.salesChannelId, salesChannels.id)
          )
          .where(
            and(
              eq(kegFills.status, "distributed"),
              isNull(kegFills.deletedAt),
              gte(kegFills.distributedAt, startDate),
              lte(kegFills.distributedAt, endDate)
            )
          )
          .groupBy(salesChannels.code);

        // Aggregate by channel
        const channelTotals: Record<string, number> = {
          tasting_room: 0,
          wholesale: 0,
          online_dtc: 0,
          events: 0,
          uncategorized: 0,
        };

        // Add bottle/can distributions
        for (const row of distributionsByChannel) {
          const channel = row.channelCode || "uncategorized";
          const gallons = mlToWineGallons(Number(row.totalML || 0));
          if (channel in channelTotals) {
            channelTotals[channel] += gallons;
          } else {
            channelTotals.uncategorized += gallons;
          }
        }

        // Add keg distributions
        for (const row of kegDistributionsByChannel) {
          const channel = row.channelCode || "uncategorized";
          const gallons = litersToWineGallons(Number(row.totalLiters || 0));
          if (channel in channelTotals) {
            channelTotals[channel] += gallons;
          } else {
            channelTotals.uncategorized += gallons;
          }
        }

        const taxPaidRemovals: TaxPaidRemovals = {
          tastingRoom: roundGallons(channelTotals.tasting_room),
          wholesale: roundGallons(channelTotals.wholesale),
          onlineDtc: roundGallons(channelTotals.online_dtc),
          events: roundGallons(channelTotals.events),
          uncategorized: roundGallons(channelTotals.uncategorized),
          total: roundGallons(
            Object.values(channelTotals).reduce((a, b) => a + b, 0)
          ),
        };

        // ============================================
        // Part IV: Other Removals
        // ============================================

        // Inventory adjustments (samples, breakage)
        const adjustmentsByType = await db
          .select({
            adjustmentType: inventoryAdjustments.adjustmentType,
            totalML: sql<number>`COALESCE(SUM(
              ABS(CAST(${inventoryAdjustments.quantityChange} AS DECIMAL)) *
              CAST(${inventoryItems.packageSizeML} AS DECIMAL)
            ), 0)`,
          })
          .from(inventoryAdjustments)
          .leftJoin(
            inventoryItems,
            eq(inventoryAdjustments.inventoryItemId, inventoryItems.id)
          )
          .where(
            and(
              gte(inventoryAdjustments.adjustedAt, startDate),
              lte(inventoryAdjustments.adjustedAt, endDate),
              sql`${inventoryAdjustments.quantityChange} < 0` // Only removals
            )
          )
          .groupBy(inventoryAdjustments.adjustmentType);

        let samplesGallons = 0;
        let breakageGallons = 0;

        for (const row of adjustmentsByType) {
          const gallons = mlToWineGallons(Number(row.totalML || 0));
          if (row.adjustmentType === "sample") {
            samplesGallons += gallons;
          } else if (row.adjustmentType === "breakage") {
            breakageGallons += gallons;
          }
        }

        // Process losses (filtering, racking)
        const filterLosses = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
          })
          .from(batchFilterOperations)
          .where(
            and(
              isNull(batchFilterOperations.deletedAt),
              gte(batchFilterOperations.filteredAt, startDate),
              lte(batchFilterOperations.filteredAt, endDate)
            )
          );

        const rackingLosses = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
          })
          .from(batchRackingOperations)
          .where(
            and(
              isNull(batchRackingOperations.deletedAt),
              gte(batchRackingOperations.rackedAt, startDate),
              lte(batchRackingOperations.rackedAt, endDate)
            )
          );

        const processLossesLiters =
          Number(filterLosses[0]?.totalLiters || 0) +
          Number(rackingLosses[0]?.totalLiters || 0);

        const otherRemovals: OtherRemovals = {
          samples: roundGallons(samplesGallons),
          breakage: roundGallons(breakageGallons),
          processLosses: roundGallons(litersToWineGallons(processLossesLiters)),
          spoilage: 0, // TODO: Track spoilage separately
          total: roundGallons(
            samplesGallons +
              breakageGallons +
              litersToWineGallons(processLossesLiters)
          ),
        };

        // ============================================
        // Part V: Ending Inventory
        // ============================================

        // Bulk inventory: Active batches with volume at end of period
        const bulkAtEnd = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              lte(batches.startDate, endDate),
              or(isNull(batches.endDate), gte(batches.endDate, endDate))
            )
          );

        const endingBulkLiters = Number(bulkAtEnd[0]?.totalLiters || 0);

        // Bottled inventory at end of period
        const bottledAtEnd = await db
          .select({
            totalML: sql<number>`COALESCE(SUM(
              CAST(${inventoryItems.currentQuantity} AS DECIMAL) *
              CAST(${inventoryItems.packageSizeML} AS DECIMAL)
            ), 0)`,
          })
          .from(inventoryItems)
          .where(lte(inventoryItems.createdAt, endDate));

        const endingBottledML = Number(bottledAtEnd[0]?.totalML || 0);

        const endingInventory: InventoryBreakdown = {
          bulk: roundGallons(litersToWineGallons(endingBulkLiters)),
          bottled: roundGallons(mlToWineGallons(endingBottledML)),
          total: roundGallons(
            litersToWineGallons(endingBulkLiters) +
              mlToWineGallons(endingBottledML)
          ),
        };

        // ============================================
        // Tax Calculation
        // ============================================

        const taxSummary = calculateHardCiderTax(taxPaidRemovals.total);

        // ============================================
        // Reconciliation
        // ============================================

        const reconciliation = calculateReconciliation({
          beginningInventory: beginningInventory.total,
          wineProduced: wineProducedGallons,
          receipts: 0, // No receipts from other premises
          taxPaidRemovals: taxPaidRemovals.total,
          otherRemovals: otherRemovals.total,
          endingInventory: endingInventory.total,
        });

        // ============================================
        // Part IV: Materials Received and Used
        // ============================================

        // Query apple/fruit purchases in period
        const fruitPurchases = await db
          .select({
            fruitType: baseFruitVarieties.fruitType,
            totalKg: sql<number>`COALESCE(SUM(CAST(${basefruitPurchaseItems.quantityKg} AS DECIMAL)), 0)`,
          })
          .from(basefruitPurchaseItems)
          .leftJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id)
          )
          .leftJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id)
          )
          .where(
            and(
              gte(basefruitPurchases.purchaseDate, startDate),
              lte(basefruitPurchases.purchaseDate, endDate)
            )
          )
          .groupBy(baseFruitVarieties.fruitType);

        let applesKg = 0;
        let otherFruitKg = 0;
        for (const row of fruitPurchases) {
          if (row.fruitType === "apple") {
            applesKg += Number(row.totalKg || 0);
          } else {
            otherFruitKg += Number(row.totalKg || 0);
          }
        }

        // Convert kg to lbs (1 kg = 2.20462 lbs)
        const applesLbs = applesKg * 2.20462;
        const otherFruitLbs = otherFruitKg * 2.20462;

        // Query juice produced from press runs in period
        const juiceProduced = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolume} AS DECIMAL)), 0)`,
          })
          .from(pressRuns)
          .where(
            and(
              isNull(pressRuns.deletedAt),
              eq(pressRuns.status, "completed"),
              gte(pressRuns.dateCompleted, startDate.toISOString().split("T")[0]),
              lte(pressRuns.dateCompleted, endDate.toISOString().split("T")[0])
            )
          );

        const juiceGallons = roundGallons(
          litersToWineGallons(Number(juiceProduced[0]?.totalLiters || 0))
        );

        // Query sugar/additive purchases in period
        // We'll look for additives with names containing 'sugar' or 'honey'
        const additivePurchaseData = await db
          .select({
            varietyName: additiveVarieties.name,
            totalQuantity: sql<number>`COALESCE(SUM(CAST(${additivePurchaseItems.quantity} AS DECIMAL)), 0)`,
            unit: additivePurchaseItems.unit,
          })
          .from(additivePurchaseItems)
          .leftJoin(
            additivePurchases,
            eq(additivePurchaseItems.purchaseId, additivePurchases.id)
          )
          .leftJoin(
            additiveVarieties,
            eq(additivePurchaseItems.additiveVarietyId, additiveVarieties.id)
          )
          .where(
            and(
              gte(additivePurchases.purchaseDate, startDate),
              lte(additivePurchases.purchaseDate, endDate)
            )
          )
          .groupBy(additiveVarieties.name, additivePurchaseItems.unit);

        let sugarLbs = 0;
        let honeyLbs = 0;
        for (const row of additivePurchaseData) {
          const name = (row.varietyName || "").toLowerCase();
          const qty = Number(row.totalQuantity || 0);
          // Convert to lbs if needed (assuming most are in kg or lbs)
          const qtyLbs = row.unit === "kg" ? qty * 2.20462 : qty;

          if (name.includes("sugar")) {
            sugarLbs += qtyLbs;
          } else if (name.includes("honey")) {
            honeyLbs += qtyLbs;
          }
        }

        const materials: MaterialsSection = {
          applesReceivedLbs: Math.round(applesLbs),
          applesUsedLbs: Math.round(applesLbs), // Assume all received is used
          appleJuiceGallons: juiceGallons,
          otherFruitReceivedLbs: Math.round(otherFruitLbs),
          otherFruitUsedLbs: Math.round(otherFruitLbs),
          sugarReceivedLbs: Math.round(sugarLbs),
          sugarUsedLbs: Math.round(sugarLbs),
          honeyReceivedLbs: Math.round(honeyLbs),
          honeyUsedLbs: Math.round(honeyLbs),
        };

        // ============================================
        // Part VII: In Fermenters End of Period
        // ============================================

        // Batches in "fermentation" status at end of period
        const fermentingBatches = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              eq(batches.status, "fermentation"),
              lte(batches.startDate, endDate)
            )
          );

        const fermenters: FermentersSection = {
          gallonsInFermenters: roundGallons(
            litersToWineGallons(Number(fermentingBatches[0]?.totalLiters || 0))
          ),
        };

        // ============================================
        // Part I Section A: Bulk Wines
        // ============================================

        // Calculate volume bottled during period
        const bottledDuringPeriod = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
          })
          .from(bottleRuns)
          .where(
            and(
              ne(bottleRuns.status, "voided"),
              gte(bottleRuns.packagedAt, startDate),
              lte(bottleRuns.packagedAt, endDate)
            )
          );

        const bottledLiters = Number(bottledDuringPeriod[0]?.totalLiters || 0);
        const bottledGallons = roundGallons(litersToWineGallons(bottledLiters));

        // Build bulk wines section
        const line11_total = beginningInventory.bulk + wineProducedGallons;
        const line27_total = bottledGallons + taxPaidRemovals.total + otherRemovals.total;

        const bulkWines: BulkWinesSection = {
          line1_onHandFirst: beginningInventory.bulk,
          line2_produced: wineProducedGallons,
          line3_otherProduction: 0,
          line4_receivedBonded: 0,
          line5_receivedCustoms: 0,
          line6_receivedReturned: 0,
          line7_receivedTransfer: 0,
          line8_dumpedToBulk: 0,
          line9_transferredIn: 0,
          line10_withdrawnFermenters: 0,
          line11_total: roundGallons(line11_total),
          line12_bottled: bottledGallons,
          line13_exportTransfer: 0,
          line14_bondedTransfer: 0,
          line15_customsTransfer: 0,
          line16_ftzTransfer: 0,
          line17_taxpaid: taxPaidRemovals.total,
          line18_taxFreeUS: 0,
          line19_taxFreeExport: 0,
          line20_transferredOut: 0,
          line21_distillingMaterial: 0,
          line22_spiritsAdded: 0,
          line23_inventoryLosses: otherRemovals.total,
          line24_destroyed: 0,
          line25_returnedToBond: 0,
          line26_other: 0,
          line27_total: roundGallons(line27_total),
          line28_onHandFermenters: fermenters.gallonsInFermenters,
          line29_onHandFinished: roundGallons(endingInventory.bulk - fermenters.gallonsInFermenters),
          line30_onHandUnfinished: 0,
          line31_inTransit: 0,
          line32_totalOnHand: endingInventory.bulk,
        };

        // ============================================
        // Part I Section B: Bottled Wines
        // ============================================

        const bottledLine7_total = beginningInventory.bottled + bottledGallons;
        const bottledLine19_total = taxPaidRemovals.total + otherRemovals.breakage;

        const bottledWines: BottledWinesSection = {
          line1_onHandFirst: beginningInventory.bottled,
          line2_bottled: bottledGallons,
          line3_receivedBonded: 0,
          line4_receivedCustoms: 0,
          line5_receivedReturned: 0,
          line6_receivedTransfer: 0,
          line7_total: roundGallons(bottledLine7_total),
          line8_dumpedToBulk: 0,
          line9_exportTransfer: 0,
          line10_bondedTransfer: 0,
          line11_customsTransfer: 0,
          line12_ftzTransfer: 0,
          line13_taxpaid: taxPaidRemovals.total,
          line14_taxFreeUS: 0,
          line15_taxFreeExport: 0,
          line16_inventoryLosses: otherRemovals.breakage,
          line17_destroyed: 0,
          line18_returnedToBond: 0,
          line19_total: roundGallons(bottledLine19_total),
          line20_onHandEnd: endingInventory.bottled,
          line21_inTransit: 0,
        };

        // ============================================
        // Build Response
        // ============================================

        const formData: TTBForm512017Data = {
          reportingPeriod: {
            type: periodType,
            startDate,
            endDate,
            year,
            month: periodType === "monthly" ? periodNumber : undefined,
            quarter: periodType === "quarterly" ? periodNumber : undefined,
          },
          bulkWines,
          bottledWines,
          materials,
          fermenters,
          beginningInventory,
          wineProduced: {
            total: wineProducedGallons,
          },
          receipts: {
            total: 0,
          },
          taxPaidRemovals,
          otherRemovals,
          endingInventory,
          taxSummary,
          reconciliation,
        };

        return {
          formData,
          periodLabel: formatPeriodLabel(periodType, year, periodNumber),
        };
      } catch (error) {
        console.error("Error generating TTB form data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate TTB form data",
        });
      }
    }),

  /**
   * Save a TTB report snapshot for audit/compliance purposes.
   */
  saveReportSnapshot: createRbacProcedure("create", "report")
    .input(saveReportSnapshotInput)
    .mutation(async ({ input, ctx }) => {
      try {
        const [report] = await db
          .insert(ttbReportingPeriods)
          .values({
            periodType: input.periodType,
            periodStart: input.periodStart.toISOString().split("T")[0],
            periodEnd: input.periodEnd.toISOString().split("T")[0],
            beginningInventoryBulkGallons:
              input.data.beginningInventoryBulkGallons?.toString(),
            beginningInventoryBottledGallons:
              input.data.beginningInventoryBottledGallons?.toString(),
            beginningInventoryTotalGallons:
              input.data.beginningInventoryTotalGallons?.toString(),
            wineProducedGallons: input.data.wineProducedGallons?.toString(),
            taxPaidTastingRoomGallons:
              input.data.taxPaidTastingRoomGallons?.toString(),
            taxPaidWholesaleGallons:
              input.data.taxPaidWholesaleGallons?.toString(),
            taxPaidOnlineDtcGallons:
              input.data.taxPaidOnlineDtcGallons?.toString(),
            taxPaidEventsGallons: input.data.taxPaidEventsGallons?.toString(),
            taxPaidRemovalsTotalGallons:
              input.data.taxPaidRemovalsTotalGallons?.toString(),
            otherRemovalsSamplesGallons:
              input.data.otherRemovalsSamplesGallons?.toString(),
            otherRemovalsBreakageGallons:
              input.data.otherRemovalsBreakageGallons?.toString(),
            otherRemovalsLossesGallons:
              input.data.otherRemovalsLossesGallons?.toString(),
            otherRemovalsTotalGallons:
              input.data.otherRemovalsTotalGallons?.toString(),
            endingInventoryBulkGallons:
              input.data.endingInventoryBulkGallons?.toString(),
            endingInventoryBottledGallons:
              input.data.endingInventoryBottledGallons?.toString(),
            endingInventoryTotalGallons:
              input.data.endingInventoryTotalGallons?.toString(),
            taxableGallons: input.data.taxableGallons?.toString(),
            taxRate: input.data.taxRate?.toString(),
            smallProducerCreditGallons:
              input.data.smallProducerCreditGallons?.toString(),
            smallProducerCreditAmount:
              input.data.smallProducerCreditAmount?.toString(),
            taxOwed: input.data.taxOwed?.toString(),
            notes: input.notes,
            generatedBy: ctx.user.id,
            status: "draft",
          })
          .returning();

        return { success: true, report };
      } catch (error) {
        console.error("Error saving TTB report snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save TTB report snapshot",
        });
      }
    }),

  /**
   * Get saved TTB report history.
   */
  getReportHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
        year: z.number().int().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const conditions = [];

        if (input.year) {
          conditions.push(
            sql`EXTRACT(YEAR FROM ${ttbReportingPeriods.periodStart}) = ${input.year}`
          );
        }

        const reports = await db
          .select({
            id: ttbReportingPeriods.id,
            periodType: ttbReportingPeriods.periodType,
            periodStart: ttbReportingPeriods.periodStart,
            periodEnd: ttbReportingPeriods.periodEnd,
            status: ttbReportingPeriods.status,
            taxOwed: ttbReportingPeriods.taxOwed,
            taxPaidRemovalsTotalGallons:
              ttbReportingPeriods.taxPaidRemovalsTotalGallons,
            createdAt: ttbReportingPeriods.createdAt,
            generatedByName: users.name,
          })
          .from(ttbReportingPeriods)
          .leftJoin(users, eq(ttbReportingPeriods.generatedBy, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(ttbReportingPeriods.periodStart))
          .limit(input.limit)
          .offset(input.offset);

        const totalResult = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(ttbReportingPeriods)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
          reports,
          total: totalResult[0]?.count || 0,
          hasMore: (input.offset + input.limit) < (totalResult[0]?.count || 0),
        };
      } catch (error) {
        console.error("Error fetching TTB report history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch TTB report history",
        });
      }
    }),

  /**
   * Get a specific saved report by ID.
   */
  getReport: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input: reportId }) => {
      try {
        const [report] = await db
          .select()
          .from(ttbReportingPeriods)
          .where(eq(ttbReportingPeriods.id, reportId))
          .limit(1);

        if (!report) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found",
          });
        }

        return report;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching TTB report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch TTB report",
        });
      }
    }),

  /**
   * Mark a report as submitted.
   */
  submitReport: createRbacProcedure("update", "report")
    .input(z.string().uuid())
    .mutation(async ({ input: reportId, ctx }) => {
      try {
        const [updated] = await db
          .update(ttbReportingPeriods)
          .set({
            status: "submitted",
            submittedAt: new Date(),
            submittedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(ttbReportingPeriods.id, reportId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found",
          });
        }

        return { success: true, report: updated };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error submitting TTB report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit TTB report",
        });
      }
    }),

  // ============================================
  // TTB Opening Balances & Period Snapshots
  // ============================================

  /**
   * Get TTB opening balances from organization settings.
   * Used for initial system setup and beginning inventory calculation.
   */
  getOpeningBalances: protectedProcedure.query(async () => {
    try {
      const [settings] = await db
        .select({
          ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
          ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
          ttbReconciliationNotes: organizationSettings.ttbReconciliationNotes,
        })
        .from(organizationSettings)
        .limit(1);

      const defaultBalances: TTBOpeningBalances = {
        bulk: {
          hardCider: 0,
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
      };

      return {
        date: settings?.ttbOpeningBalanceDate || null,
        balances: settings?.ttbOpeningBalances || defaultBalances,
        reconciliationNotes: settings?.ttbReconciliationNotes || null,
      };
    } catch (error) {
      console.error("Error fetching TTB opening balances:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch TTB opening balances",
      });
    }
  }),

  /**
   * Update TTB opening balances (admin only).
   * Sets the starting point for TTB inventory tracking.
   */
  updateOpeningBalances: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
        balances: z.object({
          bulk: z.object({
            hardCider: z.number().min(0),
            wineUnder16: z.number().min(0),
            wine16To21: z.number().min(0),
            wine21To24: z.number().min(0),
            sparklingWine: z.number().min(0),
            carbonatedWine: z.number().min(0),
          }),
          bottled: z.object({
            hardCider: z.number().min(0),
            wineUnder16: z.number().min(0),
            wine16To21: z.number().min(0),
            wine21To24: z.number().min(0),
            sparklingWine: z.number().min(0),
            carbonatedWine: z.number().min(0),
          }),
          spirits: z.object({
            appleBrandy: z.number().min(0),
            grapeSpirits: z.number().min(0),
          }),
        }),
        reconciliationNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const [updated] = await db
          .update(organizationSettings)
          .set({
            ttbOpeningBalanceDate: input.date,
            ttbOpeningBalances: input.balances,
            ttbReconciliationNotes: input.reconciliationNotes ?? null,
            updatedAt: new Date(),
          })
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization settings not found",
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating TTB opening balances:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update TTB opening balances",
        });
      }
    }),

  /**
   * Get the most recent finalized period snapshot before a given date.
   * Used to determine beginning inventory for a period.
   */
  getPreviousSnapshot: protectedProcedure
    .input(
      z.object({
        beforeDate: z.string().transform((s) => new Date(s)),
        periodType: z.enum(["monthly", "quarterly", "annual"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const conditions = [
          eq(ttbPeriodSnapshots.status, "finalized"),
          lt(ttbPeriodSnapshots.periodEnd, input.beforeDate.toISOString().split("T")[0]),
        ];

        if (input.periodType) {
          conditions.push(eq(ttbPeriodSnapshots.periodType, input.periodType));
        }

        const [snapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(and(...conditions))
          .orderBy(desc(ttbPeriodSnapshots.periodEnd))
          .limit(1);

        return snapshot || null;
      } catch (error) {
        console.error("Error fetching previous TTB snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch previous TTB snapshot",
        });
      }
    }),

  /**
   * List period snapshots for a year.
   */
  listPeriodSnapshots: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
        periodType: z.enum(["monthly", "quarterly", "annual"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const conditions = [eq(ttbPeriodSnapshots.year, input.year)];

        if (input.periodType) {
          conditions.push(eq(ttbPeriodSnapshots.periodType, input.periodType));
        }

        const snapshots = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(and(...conditions))
          .orderBy(asc(ttbPeriodSnapshots.periodStart));

        return snapshots;
      } catch (error) {
        console.error("Error listing TTB period snapshots:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list TTB period snapshots",
        });
      }
    }),

  /**
   * Create or update a period snapshot.
   * Used to save TTB report data for a specific period.
   */
  savePeriodSnapshot: createRbacProcedure("create", "report")
    .input(
      z.object({
        periodType: z.enum(["monthly", "quarterly", "annual"]),
        year: z.number().int().min(2020).max(2100),
        periodNumber: z.number().int().min(1).max(12).optional(),
        periodStart: z.string(),
        periodEnd: z.string(),
        data: z.object({
          // Bulk wines by tax class
          bulkHardCider: z.number().default(0),
          bulkWineUnder16: z.number().default(0),
          bulkWine16To21: z.number().default(0),
          bulkWine21To24: z.number().default(0),
          bulkSparklingWine: z.number().default(0),
          bulkCarbonatedWine: z.number().default(0),
          // Bottled wines by tax class
          bottledHardCider: z.number().default(0),
          bottledWineUnder16: z.number().default(0),
          bottledWine16To21: z.number().default(0),
          bottledWine21To24: z.number().default(0),
          bottledSparklingWine: z.number().default(0),
          bottledCarbonatedWine: z.number().default(0),
          // Spirits
          spiritsAppleBrandy: z.number().default(0),
          spiritsGrape: z.number().default(0),
          spiritsOther: z.number().default(0),
          // Production
          producedHardCider: z.number().default(0),
          producedWineUnder16: z.number().default(0),
          producedWine16To21: z.number().default(0),
          // Tax-paid removals by channel
          taxpaidTastingRoom: z.number().default(0),
          taxpaidWholesale: z.number().default(0),
          taxpaidOnlineDtc: z.number().default(0),
          taxpaidEvents: z.number().default(0),
          taxpaidOther: z.number().default(0),
          // Other removals
          removedSamples: z.number().default(0),
          removedBreakage: z.number().default(0),
          removedProcessLoss: z.number().default(0),
          removedDistilling: z.number().default(0),
          // Materials
          materialsApplesLbs: z.number().default(0),
          materialsOtherFruitLbs: z.number().default(0),
          materialsJuiceGallons: z.number().default(0),
          materialsSugarLbs: z.number().default(0),
          // Tax calculation
          taxHardCider: z.number().default(0),
          taxWineUnder16: z.number().default(0),
          taxWine16To21: z.number().default(0),
          taxSmallProducerCredit: z.number().default(0),
          taxTotal: z.number().default(0),
        }),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check for existing snapshot for this period
        const existing = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(
            and(
              eq(ttbPeriodSnapshots.periodType, input.periodType),
              eq(ttbPeriodSnapshots.year, input.year),
              input.periodNumber
                ? eq(ttbPeriodSnapshots.periodNumber, input.periodNumber)
                : isNull(ttbPeriodSnapshots.periodNumber)
            )
          )
          .limit(1);

        const snapshotData = {
          periodType: input.periodType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          year: input.year,
          periodNumber: input.periodNumber || null,
          // Bulk wines
          bulkHardCider: input.data.bulkHardCider.toString(),
          bulkWineUnder16: input.data.bulkWineUnder16.toString(),
          bulkWine16To21: input.data.bulkWine16To21.toString(),
          bulkWine21To24: input.data.bulkWine21To24.toString(),
          bulkSparklingWine: input.data.bulkSparklingWine.toString(),
          bulkCarbonatedWine: input.data.bulkCarbonatedWine.toString(),
          // Bottled wines
          bottledHardCider: input.data.bottledHardCider.toString(),
          bottledWineUnder16: input.data.bottledWineUnder16.toString(),
          bottledWine16To21: input.data.bottledWine16To21.toString(),
          bottledWine21To24: input.data.bottledWine21To24.toString(),
          bottledSparklingWine: input.data.bottledSparklingWine.toString(),
          bottledCarbonatedWine: input.data.bottledCarbonatedWine.toString(),
          // Spirits
          spiritsAppleBrandy: input.data.spiritsAppleBrandy.toString(),
          spiritsGrape: input.data.spiritsGrape.toString(),
          spiritsOther: input.data.spiritsOther.toString(),
          // Production
          producedHardCider: input.data.producedHardCider.toString(),
          producedWineUnder16: input.data.producedWineUnder16.toString(),
          producedWine16To21: input.data.producedWine16To21.toString(),
          // Tax-paid removals
          taxpaidTastingRoom: input.data.taxpaidTastingRoom.toString(),
          taxpaidWholesale: input.data.taxpaidWholesale.toString(),
          taxpaidOnlineDtc: input.data.taxpaidOnlineDtc.toString(),
          taxpaidEvents: input.data.taxpaidEvents.toString(),
          taxpaidOther: input.data.taxpaidOther.toString(),
          // Other removals
          removedSamples: input.data.removedSamples.toString(),
          removedBreakage: input.data.removedBreakage.toString(),
          removedProcessLoss: input.data.removedProcessLoss.toString(),
          removedDistilling: input.data.removedDistilling.toString(),
          // Materials
          materialsApplesLbs: input.data.materialsApplesLbs.toString(),
          materialsOtherFruitLbs: input.data.materialsOtherFruitLbs.toString(),
          materialsJuiceGallons: input.data.materialsJuiceGallons.toString(),
          materialsSugarLbs: input.data.materialsSugarLbs.toString(),
          // Tax calculation
          taxHardCider: input.data.taxHardCider.toString(),
          taxWineUnder16: input.data.taxWineUnder16.toString(),
          taxWine16To21: input.data.taxWine16To21.toString(),
          taxSmallProducerCredit: input.data.taxSmallProducerCredit.toString(),
          taxTotal: input.data.taxTotal.toString(),
          notes: input.notes || null,
          updatedAt: new Date(),
        };

        if (existing[0]) {
          // Don't allow updating finalized snapshots
          if (existing[0].status === "finalized") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot modify a finalized period snapshot",
            });
          }

          const [updated] = await db
            .update(ttbPeriodSnapshots)
            .set(snapshotData)
            .where(eq(ttbPeriodSnapshots.id, existing[0].id))
            .returning();

          return { success: true, snapshot: updated, created: false };
        } else {
          const [created] = await db
            .insert(ttbPeriodSnapshots)
            .values({
              ...snapshotData,
              status: "draft",
              createdBy: ctx.user.id,
              createdAt: new Date(),
            })
            .returning();

          return { success: true, snapshot: created, created: true };
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error saving TTB period snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save TTB period snapshot",
        });
      }
    }),

  /**
   * Finalize a period snapshot.
   * Once finalized, the ending inventory becomes the beginning inventory for the next period.
   */
  finalizePeriodSnapshot: createRbacProcedure("update", "report")
    .input(z.string().uuid())
    .mutation(async ({ input: snapshotId, ctx }) => {
      try {
        const [snapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(eq(ttbPeriodSnapshots.id, snapshotId))
          .limit(1);

        if (!snapshot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Period snapshot not found",
          });
        }

        if (snapshot.status === "finalized") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Period snapshot is already finalized",
          });
        }

        const [updated] = await db
          .update(ttbPeriodSnapshots)
          .set({
            status: "finalized",
            finalizedAt: new Date(),
            finalizedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(ttbPeriodSnapshots.id, snapshotId))
          .returning();

        return { success: true, snapshot: updated };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error finalizing TTB period snapshot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to finalize TTB period snapshot",
        });
      }
    }),

  /**
   * Get beginning inventory for a period.
   * Checks: 1) Previous finalized snapshot, 2) Opening balances, 3) Live calculation
   */
  getBeginningInventory: protectedProcedure
    .input(
      z.object({
        periodStart: z.string().transform((s) => new Date(s)),
      })
    )
    .query(async ({ input }) => {
      try {
        // 1. Check for previous finalized snapshot
        const [previousSnapshot] = await db
          .select()
          .from(ttbPeriodSnapshots)
          .where(
            and(
              eq(ttbPeriodSnapshots.status, "finalized"),
              lt(ttbPeriodSnapshots.periodEnd, input.periodStart.toISOString().split("T")[0])
            )
          )
          .orderBy(desc(ttbPeriodSnapshots.periodEnd))
          .limit(1);

        if (previousSnapshot) {
          // Use ending inventory from previous finalized snapshot
          return {
            source: "snapshot" as const,
            snapshotId: previousSnapshot.id,
            snapshotPeriodEnd: previousSnapshot.periodEnd,
            bulk: {
              hardCider: Number(previousSnapshot.bulkHardCider || 0),
              wineUnder16: Number(previousSnapshot.bulkWineUnder16 || 0),
              wine16To21: Number(previousSnapshot.bulkWine16To21 || 0),
              wine21To24: Number(previousSnapshot.bulkWine21To24 || 0),
              sparklingWine: Number(previousSnapshot.bulkSparklingWine || 0),
              carbonatedWine: Number(previousSnapshot.bulkCarbonatedWine || 0),
            },
            bottled: {
              hardCider: Number(previousSnapshot.bottledHardCider || 0),
              wineUnder16: Number(previousSnapshot.bottledWineUnder16 || 0),
              wine16To21: Number(previousSnapshot.bottledWine16To21 || 0),
              wine21To24: Number(previousSnapshot.bottledWine21To24 || 0),
              sparklingWine: Number(previousSnapshot.bottledSparklingWine || 0),
              carbonatedWine: Number(previousSnapshot.bottledCarbonatedWine || 0),
            },
            spirits: {
              appleBrandy: Number(previousSnapshot.spiritsAppleBrandy || 0),
              grapeSpirits: Number(previousSnapshot.spiritsGrape || 0),
            },
          };
        }

        // 2. Check for opening balances
        const [settings] = await db
          .select({
            ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
            ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
          })
          .from(organizationSettings)
          .limit(1);

        if (settings?.ttbOpeningBalances && settings.ttbOpeningBalanceDate) {
          const openingDate = new Date(settings.ttbOpeningBalanceDate);
          // Only use opening balances if the period starts on or after the opening balance date
          if (input.periodStart >= openingDate) {
            const balances = settings.ttbOpeningBalances;
            return {
              source: "opening_balances" as const,
              openingBalanceDate: settings.ttbOpeningBalanceDate,
              bulk: balances.bulk,
              bottled: balances.bottled,
              spirits: balances.spirits,
            };
          }
        }

        // 3. Return zeros if no prior data
        return {
          source: "none" as const,
          bulk: {
            hardCider: 0,
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
        };
      } catch (error) {
        console.error("Error getting beginning inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get beginning inventory",
        });
      }
    }),

  /**
   * Get reconciliation summary comparing TTB opening balances with real physical inventory.
   * Shows where all the cider went: on hand, sold, lost, or untracked.
   *
   * Formula: TTB Opening Balance = Current Inventory + Removals + Legacy Batches
   *
   * This compares:
   * - TTB Opening Balance (what was reported to TTB as on-hand)
   * - Current Inventory (batches in vessels + packaged goods on hand)
   * - Removals (sales + losses + samples since TTB date)
   * - Legacy Batches (manually created pre-system inventory)
   *
   * @param asOfDate - Optional date to reconcile as of (default: current date)
   *                   For initial TTB setup, use the TTB opening balance date
   *                   For ongoing reconciliation, use any date
   */
  getReconciliationSummary: protectedProcedure
    .input(
      z.object({
        asOfDate: z.string().optional(), // ISO date string, defaults to today
      }).optional()
    )
    .query(async ({ input }) => {
    try {
      // 1. Get TTB opening balances
      const [settings] = await db
        .select({
          ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
          ttbOpeningBalances: organizationSettings.ttbOpeningBalances,
        })
        .from(organizationSettings)
        .limit(1);

      if (!settings?.ttbOpeningBalanceDate || !settings?.ttbOpeningBalances) {
        return {
          hasOpeningBalances: false,
          openingBalanceDate: null,
          reconciliationDate: null,
          isInitialReconciliation: false,
          taxClasses: [],
          totals: {
            ttbBalance: 0,
            currentInventory: 0,
            removals: 0,
            legacyBatches: 0,
            difference: 0,
          },
          breakdown: {
            bulkInventory: 0,
            packagedInventory: 0,
            sales: 0,
            losses: 0,
          },
          inventoryByYear: [],
          productionAudit: {
            totals: {
              pressRuns: 0,
              juicePurchases: 0,
              totalProduction: 0,
            },
            byYear: [],
          },
        };
      }

      const openingDate = settings.ttbOpeningBalanceDate;
      const balances = settings.ttbOpeningBalances;

      // Determine reconciliation date: use input or default to today
      const today = new Date().toISOString().split("T")[0];
      const reconciliationDate = input?.asOfDate || today;
      const reconciliationDateObj = new Date(reconciliationDate);

      // Check if this is initial reconciliation (reconciling as of TTB opening date)
      // Initial reconciliation = reconciliation date is within 1 day of TTB opening date
      const openingDateObj = new Date(openingDate);
      const daysDiff = Math.abs(
        (reconciliationDateObj.getTime() - openingDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isInitialReconciliation = daysDiff <= 1;

      // ============================================
      // HISTORICAL INVENTORY CALCULATION
      // To find inventory at [reconciliationDate], we use:
      // Inventory at Date = Initial Volume - Losses/Packaging BEFORE that date
      // This accurately reconstructs what was on hand at any historical date
      // ============================================

      // 2. Calculate INITIAL VOLUME of batches that existed on the reconciliation date
      const initialVolumeData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolume} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate} <= ${reconciliationDate}::date`
          )
        );

      const initialVolumeGallons = Number(initialVolumeData[0]?.totalLiters || 0) * 0.264172;

      // 3. Calculate volume REMOVED BEFORE the reconciliation date (reduces initial to historical)

      // 3a. Packaging that happened BEFORE reconciliation date
      const packagedBeforeData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`${bottleRuns.packagedAt} <= ${reconciliationDate}::date`
          )
        );

      const packagedBeforeGallons = Number(packagedBeforeData[0]?.totalLiters || 0) * 0.264172;

      // 3b. Racking losses BEFORE reconciliation date
      const rackingLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchRackingOperations)
        .innerJoin(batches, eq(batchRackingOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchRackingOperations.deletedAt),
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`${batchRackingOperations.rackedAt} <= ${reconciliationDate}::date`
          )
        );

      const rackingLossesBeforeGallons = Number(rackingLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // 3c. Filter losses BEFORE reconciliation date
      const filterLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchFilterOperations)
        .innerJoin(batches, eq(batchFilterOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchFilterOperations.deletedAt),
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`${batchFilterOperations.filteredAt} <= ${reconciliationDate}::date`
          )
        );

      const filterLossesBeforeGallons = Number(filterLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // 3d. Bottling losses BEFORE reconciliation date
      const bottlingLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.loss} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`${bottleRuns.packagedAt} <= ${reconciliationDate}::date`
          )
        );

      const bottlingLossesBeforeGallons = Number(bottlingLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // Total removed before reconciliation date
      const totalRemovedBefore = packagedBeforeGallons + rackingLossesBeforeGallons +
                                  filterLossesBeforeGallons + bottlingLossesBeforeGallons;

      // Historical BULK inventory = Initial - Packaging - Losses (before date)
      const historicalBulkGallons = initialVolumeGallons - totalRemovedBefore;

      // Historical PACKAGED inventory = what was packaged before date (minus sales before date)
      // For simplicity, we calculate packaged items that existed on that date
      const packagedOnDateData = await db
        .select({
          totalML: sql<number>`COALESCE(SUM(
            CAST(${inventoryItems.currentQuantity} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL)
          ), 0)`,
        })
        .from(inventoryItems)
        .innerJoin(bottleRuns, eq(inventoryItems.bottleRunId, bottleRuns.id))
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`${bottleRuns.packagedAt} <= ${reconciliationDate}::date`
          )
        );

      // Add back sales that happened AFTER reconciliation date (to get historical packaged quantity)
      const salesAfterData = await db
        .select({
          totalML: sql<number>`COALESCE(SUM(
            CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL)
          ), 0)`,
        })
        .from(inventoryDistributions)
        .innerJoin(inventoryItems, eq(inventoryDistributions.inventoryItemId, inventoryItems.id))
        .innerJoin(bottleRuns, eq(inventoryItems.bottleRunId, bottleRuns.id))
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            sql`${inventoryDistributions.distributionDate} > ${reconciliationDate}::date`,
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`${bottleRuns.packagedAt} <= ${reconciliationDate}::date`
          )
        );

      const packagedCurrentML = Number(packagedOnDateData[0]?.totalML || 0);
      const salesAfterML = Number(salesAfterData[0]?.totalML || 0);
      const historicalPackagedGallons = (packagedCurrentML + salesAfterML) / 3785.41;

      // Total historical inventory
      const historicalInventoryGallons = historicalBulkGallons + historicalPackagedGallons;

      // For display breakdown
      const bulkInventoryGallons = historicalBulkGallons;
      const packagedInventoryGallons = historicalPackagedGallons;
      const salesGallons = 0; // Not applicable for historical view
      const lossesGallons = rackingLossesBeforeGallons + filterLossesBeforeGallons + bottlingLossesBeforeGallons;

      // Get inventory by year breakdown (using initial volume for historical)
      const bulkByYearData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${batches.startDate})`,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolume} AS DECIMAL)), 0)`,
          batchCount: sql<number>`COUNT(*)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate} <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`);

      const packagedByYearData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${batches.startDate})`,
          totalML: sql<number>`COALESCE(SUM(
            CAST(${inventoryItems.currentQuantity} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL)
          ), 0)`,
          itemCount: sql<number>`COUNT(DISTINCT ${inventoryItems.id})`,
        })
        .from(inventoryItems)
        .innerJoin(bottleRuns, eq(inventoryItems.bottleRunId, bottleRuns.id))
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            isNull(inventoryItems.deletedAt),
            sql`${inventoryItems.currentQuantity} > 0`,
            sql`${batches.startDate} <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${batches.startDate})`);

      // Build inventory by year breakdown
      const yearMap = new Map<number, { bulk: number; packaged: number; batchCount: number; itemCount: number }>();

      for (const row of bulkByYearData) {
        const year = Number(row.year);
        const existing = yearMap.get(year) || { bulk: 0, packaged: 0, batchCount: 0, itemCount: 0 };
        existing.bulk = Number(row.totalLiters || 0) * 0.264172;
        existing.batchCount = Number(row.batchCount || 0);
        yearMap.set(year, existing);
      }

      for (const row of packagedByYearData) {
        const year = Number(row.year);
        const existing = yearMap.get(year) || { bulk: 0, packaged: 0, batchCount: 0, itemCount: 0 };
        existing.packaged = Number(row.totalML || 0) / 3785.41;
        existing.itemCount = Number(row.itemCount || 0);
        yearMap.set(year, existing);
      }

      const inventoryByYear = Array.from(yearMap.entries())
        .map(([year, data]) => ({
          year,
          bulkGallons: parseFloat(data.bulk.toFixed(1)),
          packagedGallons: parseFloat(data.packaged.toFixed(1)),
          totalGallons: parseFloat((data.bulk + data.packaged).toFixed(1)),
          batchCount: data.batchCount,
          itemCount: data.itemCount,
        }))
        .sort((a, b) => a.year - b.year);

      // Use historical inventory for the reconciliation
      const totalCurrentInventory = historicalInventoryGallons;
      const totalRemovals = 0; // Removals are already added back into historical inventory

      // ============================================
      // PRODUCTION AUDIT (Source-Based View)
      // Tracks all cider production/acquisition sources
      // ============================================

      // Get press run volumes by year
      const pressRunData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolumeLiters} AS DECIMAL)), 0)`,
          runCount: sql<number>`COUNT(*)`,
        })
        .from(pressRuns)
        .where(
          and(
            isNull(pressRuns.deletedAt),
            eq(pressRuns.status, "completed"),
            sql`${pressRuns.dateCompleted} IS NOT NULL`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`);

      // Get juice purchase volumes by year (normalize to liters)
      const juicePurchaseData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`,
          totalLiters: sql<number>`COALESCE(SUM(
            CASE
              WHEN ${juicePurchaseItems.volumeUnit} = 'gal' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) * 3.78541
              WHEN ${juicePurchaseItems.volumeUnit} = 'mL' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) / 1000
              ELSE CAST(${juicePurchaseItems.volume} AS DECIMAL)
            END
          ), 0)`,
          purchaseCount: sql<number>`COUNT(DISTINCT ${juicePurchases.id})`,
          itemCount: sql<number>`COUNT(*)`,
        })
        .from(juicePurchaseItems)
        .innerJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
        .where(isNull(juicePurchases.deletedAt))
        .groupBy(sql`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`);

      // Build production by year breakdown
      const productionYearMap = new Map<number, {
        pressRuns: number;
        juicePurchases: number;
        pressRunCount: number;
        purchaseCount: number;
      }>();

      for (const row of pressRunData) {
        const year = Number(row.year);
        const existing = productionYearMap.get(year) || {
          pressRuns: 0,
          juicePurchases: 0,
          pressRunCount: 0,
          purchaseCount: 0
        };
        existing.pressRuns = Number(row.totalLiters || 0) * 0.264172; // to gallons
        existing.pressRunCount = Number(row.runCount || 0);
        productionYearMap.set(year, existing);
      }

      for (const row of juicePurchaseData) {
        const year = Number(row.year);
        const existing = productionYearMap.get(year) || {
          pressRuns: 0,
          juicePurchases: 0,
          pressRunCount: 0,
          purchaseCount: 0
        };
        existing.juicePurchases = Number(row.totalLiters || 0) * 0.264172; // to gallons
        existing.purchaseCount = Number(row.purchaseCount || 0);
        productionYearMap.set(year, existing);
      }

      const productionByYear = Array.from(productionYearMap.entries())
        .map(([year, data]) => ({
          year,
          pressRunsGallons: parseFloat(data.pressRuns.toFixed(1)),
          juicePurchasesGallons: parseFloat(data.juicePurchases.toFixed(1)),
          totalGallons: parseFloat((data.pressRuns + data.juicePurchases).toFixed(1)),
          pressRunCount: data.pressRunCount,
          purchaseCount: data.purchaseCount,
        }))
        .sort((a, b) => a.year - b.year);

      // Calculate total production
      const totalPressRunsGallons = productionByYear.reduce((sum, y) => sum + y.pressRunsGallons, 0);
      const totalJuicePurchasesGallons = productionByYear.reduce((sum, y) => sum + y.juicePurchasesGallons, 0);
      const totalProductionGallons = totalPressRunsGallons + totalJuicePurchasesGallons;

      // 4. Get legacy batches grouped by tax class
      const legacyBatchData = await db
        .select({
          customName: batches.customName,
          initialVolumeLiters: batches.initialVolume,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            isNull(batches.originPressRunId),
            isNull(batches.originJuicePurchaseItemId),
            like(batches.batchNumber, "LEGACY-%")
          )
        );

      // Parse tax class from customName and sum volumes
      const legacyByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      for (const batch of legacyBatchData) {
        const volumeLiters = parseFloat(batch.initialVolumeLiters || "0");
        const volumeGallons = volumeLiters * 0.264172;

        // Extract tax class from customName
        const taxClassMatch = batch.customName?.match(/Tax Class: (\w+)/);
        const taxClass = taxClassMatch ? taxClassMatch[1] : "hardCider";

        if (taxClass in legacyByTaxClass) {
          legacyByTaxClass[taxClass] += volumeGallons;
        }
      }

      let totalLegacy = Object.values(legacyByTaxClass).reduce((sum, val) => sum + val, 0);

      // 5. Build reconciliation by tax class
      const taxClassLabels: Record<string, string> = {
        hardCider: "Hard Cider (<8.5% ABV)",
        wineUnder16: "Wine (<16% ABV)",
        wine16To21: "Wine (16-21% ABV)",
        wine21To24: "Wine (21-24% ABV)",
        sparklingWine: "Sparkling Wine",
        carbonatedWine: "Carbonated Wine",
        appleBrandy: "Apple Brandy",
        grapeSpirits: "Grape Spirits",
      };

      const taxClasses = [];
      let totalTtb = 0;

      // Wine/Cider tax classes
      for (const [key, label] of Object.entries(taxClassLabels)) {
        if (key === "appleBrandy" || key === "grapeSpirits") continue;

        const ttbBulk = balances.bulk[key as keyof typeof balances.bulk] || 0;
        const ttbBottled = balances.bottled[key as keyof typeof balances.bottled] || 0;
        const ttbTotal = ttbBulk + ttbBottled;

        // For now, all inventory/removals go to hardCider since we don't track tax class per batch
        // This is a simplification - in reality, batches might be different tax classes
        let currentInv = 0;
        let removals = 0;
        if (key === "hardCider") {
          currentInv = totalCurrentInventory;
          removals = totalRemovals;
        }

        const legacy = legacyByTaxClass[key] || 0;
        const accountedFor = currentInv + removals + legacy;
        const difference = ttbTotal - accountedFor;

        if (ttbTotal > 0 || currentInv > 0 || removals > 0 || legacy > 0) {
          taxClasses.push({
            key,
            label,
            type: "wine" as const,
            ttbBulk: parseFloat(ttbBulk.toFixed(1)),
            ttbBottled: parseFloat(ttbBottled.toFixed(1)),
            ttbTotal: parseFloat(ttbTotal.toFixed(1)),
            currentInventory: parseFloat(currentInv.toFixed(1)),
            removals: parseFloat(removals.toFixed(1)),
            legacyBatches: parseFloat(legacy.toFixed(1)),
            difference: parseFloat(difference.toFixed(1)),
            isReconciled: Math.abs(difference) < 0.5,
          });

          totalTtb += ttbTotal;
        }
      }

      // Spirits tax classes
      for (const key of ["appleBrandy", "grapeSpirits"] as const) {
        const ttbTotal = balances.spirits[key] || 0;
        const legacy = legacyByTaxClass[key] || 0;
        const difference = ttbTotal - legacy;

        if (ttbTotal > 0 || legacy > 0) {
          taxClasses.push({
            key,
            label: taxClassLabels[key],
            type: "spirits" as const,
            ttbBulk: parseFloat(ttbTotal.toFixed(1)),
            ttbBottled: 0,
            ttbTotal: parseFloat(ttbTotal.toFixed(1)),
            currentInventory: 0, // Spirits tracked separately
            removals: 0,
            legacyBatches: parseFloat(legacy.toFixed(1)),
            difference: parseFloat(difference.toFixed(1)),
            isReconciled: Math.abs(difference) < 0.5,
          });

          totalTtb += ttbTotal;
        }
      }

      const totalAccountedFor = totalCurrentInventory + totalRemovals + totalLegacy;

      return {
        hasOpeningBalances: true,
        openingBalanceDate: openingDate,
        reconciliationDate,
        isInitialReconciliation,
        taxClasses,
        totals: {
          ttbBalance: parseFloat(totalTtb.toFixed(1)),
          currentInventory: parseFloat(totalCurrentInventory.toFixed(1)),
          removals: parseFloat(totalRemovals.toFixed(1)),
          legacyBatches: parseFloat(totalLegacy.toFixed(1)),
          difference: parseFloat((totalTtb - totalAccountedFor).toFixed(1)),
        },
        // Additional breakdown for UI display
        breakdown: {
          bulkInventory: parseFloat(bulkInventoryGallons.toFixed(1)),
          packagedInventory: parseFloat(packagedInventoryGallons.toFixed(1)),
          sales: parseFloat(salesGallons.toFixed(1)),
          losses: parseFloat(lossesGallons.toFixed(1)),
        },
        // Inventory breakdown by batch originating year
        inventoryByYear,
        // Production Audit (Source-Based View)
        productionAudit: {
          totals: {
            pressRuns: parseFloat(totalPressRunsGallons.toFixed(1)),
            juicePurchases: parseFloat(totalJuicePurchasesGallons.toFixed(1)),
            totalProduction: parseFloat(totalProductionGallons.toFixed(1)),
          },
          byYear: productionByYear,
        },
      };
    } catch (error) {
      console.error("Error getting reconciliation summary:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get reconciliation summary",
      });
    }
  }),
});
