/**
 * TTB Reporting Router
 *
 * API endpoints for generating TTB Form 5120.17 data
 * and managing report snapshots.
 */

import { z } from "zod";
import { router, protectedProcedure, createRbacProcedure } from "../trpc";
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
        // ============================================

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
        // This is approximate - we calculate based on what was packaged minus distributed
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

        const beginningInventory: InventoryBreakdown = {
          bulk: roundGallons(litersToWineGallons(beginningBulkLiters)),
          bottled: roundGallons(mlToWineGallons(beginningBottledML)),
          total: roundGallons(
            litersToWineGallons(beginningBulkLiters) +
              mlToWineGallons(beginningBottledML)
          ),
        };

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
  updateOpeningBalances: createRbacProcedure("update", "settings")
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
      })
    )
    .mutation(async ({ input }) => {
      try {
        const [updated] = await db
          .update(organizationSettings)
          .set({
            ttbOpeningBalanceDate: input.date,
            ttbOpeningBalances: input.balances,
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
});
