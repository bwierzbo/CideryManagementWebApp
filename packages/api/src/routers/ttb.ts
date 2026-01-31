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
  vessels,
  inventoryItems,
  inventoryDistributions,
  inventoryAdjustments,
  kegFills,
  salesChannels,
  ttbReportingPeriods,
  ttbPeriodSnapshots,
  ttbReconciliationSnapshots,
  organizationSettings,
  batchFilterOperations,
  batchRackingOperations,
  bottleRuns,
  batchTransfers,
  distillationRecords,
  batchVolumeAdjustments,
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
  physicalInventoryCounts,
  reconciliationAdjustments,
  type TTBOpeningBalances,
} from "db";
import {
  eq,
  and,
  gte,
  lte,
  lt,
  isNull,
  isNotNull,
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
  type DistilleryOperations,
  type BrandyTransfer,
  type CiderBrandyInventory,
  type CiderBrandyReconciliation,
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

            // Kegs in stock before period start (filled but not yet distributed)
            const kegsAtStart = await db
              .select({
                totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
              })
              .from(kegFills)
              .where(
                and(
                  isNull(kegFills.distributedAt), // Not yet distributed
                  isNull(kegFills.voidedAt),
                  lte(kegFills.filledAt, dayBeforeStart)
                )
              );
            const beginningKegsLiters = Number(kegsAtStart[0]?.totalLiters || 0);

            beginningInventory = {
              bulk: roundGallons(litersToWineGallons(beginningBulkLiters)),
              bottled: roundGallons(
                mlToWineGallons(beginningBottledML) + litersToWineGallons(beginningKegsLiters)
              ),
              total: roundGallons(
                litersToWineGallons(beginningBulkLiters) +
                  mlToWineGallons(beginningBottledML) +
                  litersToWineGallons(beginningKegsLiters)
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

        // Keg distributions - tax-paid when keg leaves bonded space (distributed_at is set)
        // Note: status may be "distributed" or "returned" - both count as tax-paid since the keg left
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
              isNotNull(kegFills.distributedAt),
              isNull(kegFills.voidedAt),
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
        // Part V: Ending Inventory (AS OF period end date)
        // ============================================

        // Bulk inventory: Calculate batch volumes AS OF the period end date
        // This uses transaction history rather than current volumes

        // Get all batches that existed on or before the end date
        const batchesAtEnd = await db
          .select({
            id: batches.id,
            initialVolume: batches.initialVolumeLiters,
            startDate: batches.startDate,
            status: batches.status,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              lte(batches.startDate, endDate),
              // Exclude batches that ended before the period end
              or(isNull(batches.endDate), gte(batches.endDate, endDate)),
              // Exclude discarded/completed batches that were finished before endDate
              // (they would have 0 volume at endDate)
              sql`NOT (${batches.status} = 'discarded' AND ${batches.updatedAt} <= ${endDate})`
            )
          );

        let endingBulkLiters = 0;

        for (const batch of batchesAtEnd) {
          let batchVolume = Number(batch.initialVolume || 0);

          // Add transfers IN on or before endDate
          const transfersIn = await db
            .select({
              totalVolume: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
            })
            .from(batchTransfers)
            .where(
              and(
                eq(batchTransfers.destinationBatchId, batch.id),
                ne(batchTransfers.sourceBatchId, batch.id), // Exclude self-transfers
                isNull(batchTransfers.deletedAt),
                lte(batchTransfers.transferredAt, endDate)
              )
            );
          batchVolume += Number(transfersIn[0]?.totalVolume || 0);

          // Subtract transfers OUT on or before endDate
          const transfersOut = await db
            .select({
              totalVolume: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
              totalLoss: sql<number>`COALESCE(SUM(CAST(${batchTransfers.loss} AS DECIMAL)), 0)`,
            })
            .from(batchTransfers)
            .where(
              and(
                eq(batchTransfers.sourceBatchId, batch.id),
                ne(batchTransfers.destinationBatchId, batch.id), // Exclude self-transfers
                isNull(batchTransfers.deletedAt),
                lte(batchTransfers.transferredAt, endDate)
              )
            );
          batchVolume -= Number(transfersOut[0]?.totalVolume || 0);
          batchVolume -= Number(transfersOut[0]?.totalLoss || 0);

          // Subtract bottlings on or before endDate
          const bottlings = await db
            .select({
              totalVolume: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
            })
            .from(bottleRuns)
            .where(
              and(
                eq(bottleRuns.batchId, batch.id),
                isNull(bottleRuns.voidedAt),
                lte(bottleRuns.packagedAt, endDate)
              )
            );
          batchVolume -= Number(bottlings[0]?.totalVolume || 0);

          // Subtract keg fills on or before endDate
          const kegFillsData = await db
            .select({
              totalVolume: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
            })
            .from(kegFills)
            .where(
              and(
                eq(kegFills.batchId, batch.id),
                isNull(kegFills.voidedAt),
                lte(kegFills.filledAt, endDate)
              )
            );
          batchVolume -= Number(kegFillsData[0]?.totalVolume || 0);

          // Subtract distillation on or before endDate
          const distillation = await db
            .select({
              totalVolume: sql<number>`COALESCE(SUM(CAST(${distillationRecords.sourceVolumeLiters} AS DECIMAL)), 0)`,
            })
            .from(distillationRecords)
            .where(
              and(
                eq(distillationRecords.sourceBatchId, batch.id),
                isNull(distillationRecords.deletedAt),
                lte(distillationRecords.sentAt, endDate)
              )
            );
          batchVolume -= Number(distillation[0]?.totalVolume || 0);

          // Subtract racking losses on or before endDate
          const rackingLoss = await db
            .select({
              totalLoss: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
            })
            .from(batchRackingOperations)
            .where(
              and(
                eq(batchRackingOperations.batchId, batch.id),
                isNull(batchRackingOperations.deletedAt),
                lte(batchRackingOperations.rackedAt, endDate)
              )
            );
          batchVolume -= Number(rackingLoss[0]?.totalLoss || 0);

          // Subtract filter losses on or before endDate
          const filterLoss = await db
            .select({
              totalLoss: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
            })
            .from(batchFilterOperations)
            .where(
              and(
                eq(batchFilterOperations.batchId, batch.id),
                isNull(batchFilterOperations.deletedAt),
                lte(batchFilterOperations.filteredAt, endDate)
              )
            );
          batchVolume -= Number(filterLoss[0]?.totalLoss || 0);

          // Only add positive volumes (batch had liquid at endDate)
          if (batchVolume > 0) {
            endingBulkLiters += batchVolume;
          }
        }

        // Bottled inventory AS OF period end date
        // Calculate by taking current quantity and reversing changes that happened AFTER endDate

        // Get all inventory items that were created on or before endDate
        const itemsCreatedByEndDate = await db
          .select({
            id: inventoryItems.id,
            packageSizeML: inventoryItems.packageSizeML,
            currentQuantity: inventoryItems.currentQuantity,
          })
          .from(inventoryItems)
          .where(lte(inventoryItems.createdAt, endDate));

        let endingBottledML = 0;

        for (const item of itemsCreatedByEndDate) {
          // Start with current quantity
          let itemQuantity = Number(item.currentQuantity || 0);

          // Add back distributions that happened AFTER endDate (reverse them)
          const distributionsAfter = await db
            .select({
              totalQuantity: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
            })
            .from(inventoryDistributions)
            .where(
              and(
                eq(inventoryDistributions.inventoryItemId, item.id),
                sql`${inventoryDistributions.distributionDate} > ${endDate}`
              )
            );
          itemQuantity += Number(distributionsAfter[0]?.totalQuantity || 0);

          // Reverse adjustments that happened AFTER endDate
          const adjustmentsAfter = await db
            .select({
              totalChange: sql<number>`COALESCE(SUM(${inventoryAdjustments.quantityChange}), 0)`,
            })
            .from(inventoryAdjustments)
            .where(
              and(
                eq(inventoryAdjustments.inventoryItemId, item.id),
                sql`${inventoryAdjustments.adjustedAt} > ${endDate}`
              )
            );
          // Reverse the adjustment (if it was -5 after endDate, add 5 back)
          itemQuantity -= Number(adjustmentsAfter[0]?.totalChange || 0);

          // Only add positive quantities
          if (itemQuantity > 0) {
            endingBottledML += itemQuantity * Number(item.packageSizeML || 0);
          }
        }

        // Kegs in stock (filled but not yet distributed)
        // These are packaged inventory that hasn't left the bonded space yet
        const kegsInStock = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
          })
          .from(kegFills)
          .where(
            and(
              isNull(kegFills.distributedAt), // Not yet distributed
              isNull(kegFills.voidedAt),
              lte(kegFills.filledAt, endDate) // Filled on or before end date
            )
          );
        const kegsInStockLiters = Number(kegsInStock[0]?.totalLiters || 0);

        const endingInventory: InventoryBreakdown = {
          bulk: roundGallons(litersToWineGallons(endingBulkLiters)),
          bottled: roundGallons(
            mlToWineGallons(endingBottledML) + litersToWineGallons(kegsInStockLiters)
          ),
          total: roundGallons(
            litersToWineGallons(endingBulkLiters) +
              mlToWineGallons(endingBottledML) +
              litersToWineGallons(kegsInStockLiters)
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
        // Distillery Operations (Cider/Brandy Tracking)
        // ============================================

        // 1. Cider sent to distillery (DSP)
        const ciderToDsp = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.sourceVolumeLiters} AS DECIMAL)), 0)`,
            shipmentCount: sql<number>`COUNT(*)`,
          })
          .from(distillationRecords)
          .where(
            and(
              isNull(distillationRecords.deletedAt),
              gte(distillationRecords.sentAt, startDate),
              lte(distillationRecords.sentAt, endDate)
            )
          );

        const ciderSentToDspGallons = roundGallons(
          litersToWineGallons(Number(ciderToDsp[0]?.totalLiters || 0))
        );
        const ciderSentShipments = Number(ciderToDsp[0]?.shipmentCount || 0);

        // 2. Brandy received from distillery
        const brandyFromDsp = await db
          .select({
            totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.receivedVolumeLiters} AS DECIMAL)), 0)`,
            returnCount: sql<number>`COUNT(*)`,
          })
          .from(distillationRecords)
          .where(
            and(
              isNull(distillationRecords.deletedAt),
              isNotNull(distillationRecords.receivedAt),
              gte(distillationRecords.receivedAt, startDate),
              lte(distillationRecords.receivedAt, endDate)
            )
          );

        const brandyReceivedGallons = roundGallons(
          litersToWineGallons(Number(brandyFromDsp[0]?.totalLiters || 0))
        );
        const brandyReceivedReturns = Number(brandyFromDsp[0]?.returnCount || 0);

        // 3. Get all brandy batch IDs (by name pattern)
        const brandyBatchesQuery = await db
          .select({ id: batches.id })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              or(
                sql`${batches.customName} ILIKE '%apple brandy%'`,
                sql`${batches.name} ILIKE '%apple brandy%'`
              )
            )
          );

        const brandyBatchIds = brandyBatchesQuery.map(b => b.id);

        // 4. Brandy transfers to cider batches (fortification)
        let brandyUsedInCiderGallons = 0;
        const brandyTransfers: BrandyTransfer[] = [];

        if (brandyBatchIds.length > 0) {
          // Find transfers FROM brandy batches TO non-brandy batches
          const brandyToCiderTransfers = await db
            .select({
              volumeTransferred: batchTransfers.volumeTransferred,
              transferredAt: batchTransfers.transferredAt,
              sourceBatchName: sql<string>`src.custom_name`,
              destBatchName: sql<string>`dest.custom_name`,
            })
            .from(batchTransfers)
            .innerJoin(
              sql`batches src`,
              sql`src.id = ${batchTransfers.sourceBatchId}`
            )
            .innerJoin(
              sql`batches dest`,
              sql`dest.id = ${batchTransfers.destinationBatchId}`
            )
            .where(
              and(
                isNull(batchTransfers.deletedAt),
                sql`${batchTransfers.sourceBatchId} IN (${sql.raw(brandyBatchIds.map(id => `'${id}'`).join(","))})`,
                sql`dest.custom_name NOT ILIKE '%brandy%'`,
                sql`dest.name NOT ILIKE '%brandy%'`,
                gte(batchTransfers.transferredAt, startDate),
                lte(batchTransfers.transferredAt, endDate)
              )
            );

          for (const transfer of brandyToCiderTransfers) {
            const volumeGallons = roundGallons(
              litersToWineGallons(Number(transfer.volumeTransferred || 0))
            );
            brandyUsedInCiderGallons += volumeGallons;

            brandyTransfers.push({
              sourceBatch: transfer.sourceBatchName || "Unknown",
              destinationBatch: transfer.destBatchName || "Unknown",
              volumeGallons,
              transferredAt: transfer.transferredAt || new Date(),
            });
          }
        }

        brandyUsedInCiderGallons = roundGallons(brandyUsedInCiderGallons);

        const distilleryOperations: DistilleryOperations = {
          ciderSentToDsp: ciderSentToDspGallons,
          ciderSentShipments,
          brandyReceived: brandyReceivedGallons,
          brandyReceivedReturns,
          brandyUsedInCider: brandyUsedInCiderGallons,
          brandyTransfers,
        };

        // 5. Calculate cider/brandy separated inventory
        // Note: We use transfer-based calculation for brandy (more accurate for TTB)
        // because current_volume_liters may have data integrity issues from
        // manual entries or transfers that didn't update volumes correctly.

        // Get system-reported brandy volumes (from current_volume_liters)
        let brandyReportedGallons = 0;
        if (brandyBatchIds.length > 0) {
          const brandyVolumes = await db
            .select({
              totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
            })
            .from(batches)
            .where(
              and(
                sql`${batches.id} IN (${sql.raw(brandyBatchIds.map(id => `'${id}'`).join(","))})`,
                isNull(batches.deletedAt),
                ne(batches.status, "discarded")
              )
            );

          brandyReportedGallons = roundGallons(
            litersToWineGallons(Number(brandyVolumes[0]?.totalLiters || 0))
          );
        }

        // Calculate brandy based on transfers (TTB-accurate)
        // Brandy ending = Beginning (0) + Received from DSP - Used in cider
        const brandyOpening = 0; // TODO: Get from opening balances if available
        const brandyCalculatedGallons = roundGallons(
          brandyOpening + brandyReceivedGallons - brandyUsedInCiderGallons
        );

        // Use calculated value for TTB accuracy
        const brandyBulkGallons = brandyCalculatedGallons;
        const brandyDataDiscrepancy = roundGallons(brandyReportedGallons - brandyCalculatedGallons);

        const ciderBulkGallons = roundGallons(endingInventory.bulk - brandyReportedGallons);
        const ciderBottledGallons = endingInventory.bottled; // All bottled is cider for now

        const ciderBrandyInventory: CiderBrandyInventory = {
          cider: {
            bulk: ciderBulkGallons,
            bottled: ciderBottledGallons,
            kegs: 0, // Kegs are included in bottled
            total: roundGallons(ciderBulkGallons + ciderBottledGallons),
          },
          brandy: {
            bulk: brandyBulkGallons, // TTB-calculated value
            total: brandyBulkGallons,
          },
          total: endingInventory.total,
        };

        // 6. Calculate cider/brandy reconciliation
        // Cider: Beginning + Produced - TaxPaid - Losses - ToDistillery = Expected
        const expectedCiderEnding = roundGallons(
          beginningInventory.total +
            wineProducedGallons -
            taxPaidRemovals.total -
            otherRemovals.total -
            ciderSentToDspGallons
        );
        const actualCiderEnding = ciderBrandyInventory.cider.total;
        const ciderDiscrepancy = roundGallons(actualCiderEnding - expectedCiderEnding);

        // Brandy: Opening (0) + Received - UsedInCider = Expected
        // Note: expectedBrandyEnding equals brandyCalculatedGallons (calculated above)
        const expectedBrandyEnding = brandyCalculatedGallons;
        // For TTB, we report the calculated value as actual (transfer-based, accurate)
        const actualBrandyEnding = brandyCalculatedGallons;
        // TTB discrepancy should be 0 since we use calculated values
        const brandyDiscrepancy = 0;

        const ciderBrandyReconciliation: CiderBrandyReconciliation = {
          cider: {
            expectedEnding: expectedCiderEnding,
            actualEnding: actualCiderEnding,
            discrepancy: ciderDiscrepancy,
          },
          brandy: {
            expectedEnding: expectedBrandyEnding,
            actualEnding: actualBrandyEnding,
            discrepancy: brandyDiscrepancy,
            // Include data integrity info for troubleshooting
            systemReported: brandyReportedGallons,
            dataDiscrepancy: brandyDataDiscrepancy,
          },
          total: {
            expectedEnding: roundGallons(expectedCiderEnding + expectedBrandyEnding),
            actualEnding: roundGallons(actualCiderEnding + actualBrandyEnding),
            discrepancy: roundGallons(ciderDiscrepancy + brandyDiscrepancy),
          },
        };

        // Update bulkWines line21 to show distilling material sent
        bulkWines.line21_distillingMaterial = ciderSentToDspGallons;

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
          distilleryOperations,
          ciderBrandyInventory,
          ciderBrandyReconciliation,
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
          // Include empty batchDetailsByTaxClass for consistent return type
          batchDetailsByTaxClass: {},
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
      // INVENTORY CALCULATION using Production - Removals
      // This is the correct TTB approach that avoids double-counting transfers
      // Formula: Production (press runs + juice purchases) - Removals = Inventory
      // ============================================

      // 2a. PRODUCTION: Press runs completed DURING the period (after opening, on or before reconciliation)
      const pressRunProduction = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${pressRuns.totalJuiceVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(pressRuns)
        .where(
          and(
            isNull(pressRuns.deletedAt),
            eq(pressRuns.status, "completed"),
            sql`${pressRuns.dateCompleted}::date > ${openingDate}::date`,
            sql`${pressRuns.dateCompleted}::date <= ${reconciliationDate}::date`
          )
        );

      const pressRunLiters = Number(pressRunProduction[0]?.totalLiters || 0);

      // 2b. PRODUCTION: Juice purchases on or before the date
      // Note: Must filter both purchase AND item deletedAt to exclude corrected entries
      const juicePurchaseProduction = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(
            CASE
              WHEN ${juicePurchaseItems.volumeUnit} = 'gal' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) * 3.78541
              ELSE CAST(${juicePurchaseItems.volume} AS DECIMAL)
            END
          ), 0)`,
        })
        .from(juicePurchaseItems)
        .innerJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
        .where(
          and(
            isNull(juicePurchases.deletedAt),
            isNull(juicePurchaseItems.deletedAt),
            sql`${juicePurchases.purchaseDate}::date > ${openingDate}::date`,
            sql`${juicePurchases.purchaseDate}::date <= ${reconciliationDate}::date`
          )
        );

      const juicePurchaseLiters = Number(juicePurchaseProduction[0]?.totalLiters || 0);

      // 2c. EXCLUDE: Juice that was never fermented (product_type = 'juice')
      // TTB only tracks alcoholic beverages, not juice that stayed as juice
      const juiceOnlyBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolume} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            eq(batches.productType, "juice"),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );

      const juiceOnlyLiters = Number(juiceOnlyBatches[0]?.totalLiters || 0);

      // 2d. EXCLUDE: Transfers INTO juice batches (juice that was transferred to a batch that stayed juice)
      // This handles cases where cider batches transferred volume to juice batches
      const transfersIntoJuiceBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "juice"),
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );

      const transfersIntoJuiceLiters = Number(transfersIntoJuiceBatches[0]?.totalLiters || 0);
      const totalProductionLiters = pressRunLiters + juicePurchaseLiters - juiceOnlyLiters - transfersIntoJuiceLiters;

      // 3. REMOVALS: Calculate all removals DURING THE PERIOD (after opening, on or before reconciliation)
      // 3a. Racking losses
      const rackingLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchRackingOperations)
        .innerJoin(batches, eq(batchRackingOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchRackingOperations.deletedAt),
            sql`${batchRackingOperations.rackedAt}::date > ${openingDate}::date`,
            sql`${batchRackingOperations.rackedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const rackingLossesBeforeGallons = Number(rackingLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // 3b. Filter losses
      const filterLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchFilterOperations)
        .innerJoin(batches, eq(batchFilterOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchFilterOperations.deletedAt),
            sql`${batchFilterOperations.filteredAt}::date > ${openingDate}::date`,
            sql`${batchFilterOperations.filteredAt}::date <= ${reconciliationDate}::date`
          )
        );

      const filterLossesBeforeGallons = Number(filterLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // 3c. Bottling losses
      const bottlingLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.loss} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            sql`${bottleRuns.packagedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const bottlingLossesBeforeGallons = Number(bottlingLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // 3d. Transfer losses - from two sources:
      // 1. batch.transferLossL - for batches started during the period
      const batchTransferLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.transferLossL} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );

      // 2. batch_transfers.loss - losses recorded on individual transfers
      const transferOperationLossesBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.loss} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );

      const transferLossesBeforeGallons =
        Number(batchTransferLossesBefore[0]?.totalLiters || 0) * 0.264172 +
        Number(transferOperationLossesBefore[0]?.totalLiters || 0) * 0.264172;

      // 3e. Distillation removals (cider sent to DSP)
      const distillationsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.sourceVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(distillationRecords)
        .where(
          and(
            isNull(distillationRecords.deletedAt),
            sql`${distillationRecords.sentAt}::date > ${openingDate}::date`,
            sql`${distillationRecords.sentAt}::date <= ${reconciliationDate}::date`
          )
        );

      const distillationsBeforeGallons = Number(distillationsBefore[0]?.totalLiters || 0) * 0.264172;

      // 3f. Volume adjustments (losses recorded via manual adjustments)
      const volumeAdjustmentsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(ABS(CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL))), 0)`,
        })
        .from(batchVolumeAdjustments)
        .where(
          and(
            isNull(batchVolumeAdjustments.deletedAt),
            sql`${batchVolumeAdjustments.adjustmentDate}::date > ${openingDate}::date`,
            sql`${batchVolumeAdjustments.adjustmentDate}::date <= ${reconciliationDate}::date`,
            sql`CAST(${batchVolumeAdjustments.adjustmentAmount} AS DECIMAL) < 0` // Only negative (loss) adjustments
          )
        );

      const volumeAdjustmentsBeforeGallons = Number(volumeAdjustmentsBefore[0]?.totalLiters || 0) * 0.264172;

      // 3g. Distributions (sales) on or before the date
      // Bottle/can distributions
      const bottleDistributionsBefore = await db
        .select({
          totalML: sql<number>`COALESCE(SUM(
            CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL)
          ), 0)`,
        })
        .from(inventoryDistributions)
        .innerJoin(inventoryItems, eq(inventoryDistributions.inventoryItemId, inventoryItems.id))
        .where(
          and(
            sql`${inventoryDistributions.distributionDate}::date > ${openingDate}::date`,
            sql`${inventoryDistributions.distributionDate}::date <= ${reconciliationDate}::date`
          )
        );

      const bottleDistributionsBeforeGallons = Number(bottleDistributionsBefore[0]?.totalML || 0) / 3785.41;

      // Keg distributions (when distributed_at is set, keg left bonded space)
      const kegDistributionsBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
        })
        .from(kegFills)
        .where(
          and(
            isNotNull(kegFills.distributedAt),
            isNull(kegFills.voidedAt),
            sql`${kegFills.distributedAt}::date > ${openingDate}::date`,
            sql`${kegFills.distributedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const kegDistributionsBeforeGallons = Number(kegDistributionsBefore[0]?.totalLiters || 0) * 0.264172;

      const distributionsBeforeGallons = bottleDistributionsBeforeGallons + kegDistributionsBeforeGallons;

      // 3f. Volume packaged (converted from bulk to packaged) on or before the date
      // Bottles/cans packaged
      const bottlesPackagedBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.volumeTakenLiters} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .where(
          and(
            sql`${bottleRuns.packagedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        );

      const bottlesPackagedBeforeGallons = Number(bottlesPackagedBefore[0]?.totalLiters || 0) * 0.264172;

      // Kegs filled
      const kegsFilledBefore = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
        })
        .from(kegFills)
        .where(
          and(
            isNull(kegFills.voidedAt),
            sql`${kegFills.filledAt}::date > ${openingDate}::date`,
            sql`${kegFills.filledAt}::date <= ${reconciliationDate}::date`
          )
        );

      const kegsFilledBeforeGallons = Number(kegsFilledBefore[0]?.totalLiters || 0) * 0.264172;

      const packagedVolumeBeforeGallons = bottlesPackagedBeforeGallons + kegsFilledBeforeGallons;

      // Calculate total losses (process losses)
      const processLossesGallons = rackingLossesBeforeGallons + filterLossesBeforeGallons +
        bottlingLossesBeforeGallons + transferLossesBeforeGallons + volumeAdjustmentsBeforeGallons;

      // Total losses including distillation (sent to DSP)
      const totalLossesGallons = processLossesGallons + distillationsBeforeGallons;

      // ============================================
      // INVENTORY CALCULATION
      // Production - Removals = Total Inventory (Bulk + Packaged)
      // ============================================

      // Total production in gallons
      const totalProductionGallons = totalProductionLiters * 0.264172;

      // Total removals = losses + distributions (sales leave the system)
      const totalRemovalsGallons = totalLossesGallons + distributionsBeforeGallons;

      // Total inventory = production - removals
      const historicalInventoryGallons = totalProductionGallons - totalRemovalsGallons;

      // Split into bulk and packaged:
      // Packaged = volume packaged - distributions
      const historicalPackagedGallons = Math.max(0, packagedVolumeBeforeGallons - distributionsBeforeGallons);

      // Bulk = total inventory - packaged
      const historicalBulkGallons = Math.max(0, historicalInventoryGallons - historicalPackagedGallons);

      // For display breakdown
      const bulkInventoryGallons = historicalBulkGallons;
      const packagedInventoryGallons = historicalPackagedGallons;
      const salesGallons = distributionsBeforeGallons;
      const lossesGallons = processLossesGallons;
      const distillationGallons = distillationsBeforeGallons;

      // Get inventory by year breakdown (using current volume to avoid double-counting transfers)
      const bulkByYearData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${batches.startDate})`,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolume} AS DECIMAL)), 0)`,
          batchCount: sql<number>`COUNT(*)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate} <= ${reconciliationDate}::date`,
            sql`COALESCE(${batches.currentVolume}, 0) > 0`, // Only count batches with remaining volume
            sql`COALESCE(${batches.isArchived}, false) = false`
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

      // ============================================
      // INVENTORY BY TAX CLASS (based on product_type)
      // For initial reconciliation, use initial_volume of verified batches
      // For ongoing reconciliation, use current_volume
      // ============================================

      // Map product_type to tax class key
      const productTypeToTaxClass = (productType: string | null): string => {
        switch (productType) {
          case 'pommeau': return 'wine16To21';
          case 'brandy': return 'appleBrandy';
          default: return 'hardCider';
        }
      };

      // Build inventory by tax class
      const inventoryByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      // Use current_volume of active batches for inventory by tax class
      let actualBulkGallons = 0;
      let actualPackagedGallons = 0;
      {
        const bulkByProductType = await db
          .select({
            productType: batches.productType,
            totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolume} AS DECIMAL)), 0)`,
          })
          .from(batches)
          .where(
            and(
              isNull(batches.deletedAt),
              sql`${batches.startDate} <= ${reconciliationDate}::date`,
              sql`COALESCE(${batches.currentVolume}, 0) > 0`,
              sql`COALESCE(${batches.isArchived}, false) = false`,
              sql`NOT (${batches.batchNumber} LIKE 'LEGACY-%')`
            )
          )
          .groupBy(batches.productType);

        for (const row of bulkByProductType) {
          const taxClass = productTypeToTaxClass(row.productType);
          const volumeGallons = Number(row.totalLiters || 0) * 0.264172;
          inventoryByTaxClass[taxClass] += volumeGallons;
          actualBulkGallons += volumeGallons;
        }

        // Add packaged inventory by product_type
        const packagedByProductType = await db
          .select({
            productType: batches.productType,
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
              sql`${inventoryItems.currentQuantity} > 0`,
              sql`${batches.startDate} <= ${reconciliationDate}::date`
            )
          )
          .groupBy(batches.productType);

        for (const row of packagedByProductType) {
          const taxClass = productTypeToTaxClass(row.productType);
          const volumeGallons = Number(row.totalML || 0) / 3785.41;
          inventoryByTaxClass[taxClass] += volumeGallons;
          actualPackagedGallons += volumeGallons;
        }
      }

      // ============================================
      // REMOVALS BY TAX CLASS
      // Query distributions grouped by product_type to get removals per tax class
      // ============================================
      const removalsByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      // Bottle distributions by tax class
      const bottleRemovalsByType = await db
        .select({
          productType: batches.productType,
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
            sql`${inventoryDistributions.distributionDate}::date > ${openingDate}::date`,
            sql`${inventoryDistributions.distributionDate}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.productType);

      for (const row of bottleRemovalsByType) {
        const taxClass = productTypeToTaxClass(row.productType);
        const volumeGallons = Number(row.totalML || 0) / 3785.41;
        removalsByTaxClass[taxClass] += volumeGallons;
      }

      // Keg distributions by tax class
      const kegRemovalsByType = await db
        .select({
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
        })
        .from(kegFills)
        .innerJoin(batches, eq(kegFills.batchId, batches.id))
        .where(
          and(
            isNotNull(kegFills.distributedAt),
            isNull(kegFills.voidedAt),
            sql`${kegFills.distributedAt}::date > ${openingDate}::date`,
            sql`${kegFills.distributedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.productType);

      for (const row of kegRemovalsByType) {
        const taxClass = productTypeToTaxClass(row.productType);
        const volumeGallons = Number(row.totalLiters || 0) * 0.264172;
        removalsByTaxClass[taxClass] += volumeGallons;
      }

      // ============================================
      // LOSSES BY TAX CLASS
      // Calculate racking, filter, bottling losses grouped by product_type
      // ============================================
      const lossesByTaxClass: Record<string, number> = {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0,
        grapeSpirits: 0,
      };

      // Racking losses by tax class
      const rackingLossesByType = await db
        .select({
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchRackingOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchRackingOperations)
        .innerJoin(batches, eq(batchRackingOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchRackingOperations.deletedAt),
            sql`${batchRackingOperations.rackedAt}::date > ${openingDate}::date`,
            sql`${batchRackingOperations.rackedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.productType);

      for (const row of rackingLossesByType) {
        const taxClass = productTypeToTaxClass(row.productType);
        lossesByTaxClass[taxClass] += Number(row.totalLiters || 0) * 0.264172;
      }

      // Filter losses by tax class
      const filterLossesByType = await db
        .select({
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchFilterOperations.volumeLoss} AS DECIMAL)), 0)`,
        })
        .from(batchFilterOperations)
        .innerJoin(batches, eq(batchFilterOperations.batchId, batches.id))
        .where(
          and(
            isNull(batchFilterOperations.deletedAt),
            sql`${batchFilterOperations.filteredAt}::date > ${openingDate}::date`,
            sql`${batchFilterOperations.filteredAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.productType);

      for (const row of filterLossesByType) {
        const taxClass = productTypeToTaxClass(row.productType);
        lossesByTaxClass[taxClass] += Number(row.totalLiters || 0) * 0.264172;
      }

      // Bottling losses by tax class
      const bottlingLossesByType = await db
        .select({
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${bottleRuns.loss} AS DECIMAL)), 0)`,
        })
        .from(bottleRuns)
        .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            sql`${bottleRuns.packagedAt}::date > ${openingDate}::date`,
            sql`${bottleRuns.packagedAt}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.productType);

      for (const row of bottlingLossesByType) {
        const taxClass = productTypeToTaxClass(row.productType);
        lossesByTaxClass[taxClass] += Number(row.totalLiters || 0) * 0.264172;
      }

      // Transfer losses by tax class
      const transferLossesByType = await db
        .select({
          productType: batches.productType,
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.transferLossL} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(batches.productType);

      for (const row of transferLossesByType) {
        const taxClass = productTypeToTaxClass(row.productType);
        lossesByTaxClass[taxClass] += Number(row.totalLiters || 0) * 0.264172;
      }

      // ============================================
      // PRODUCTION AND DISTILLATION BY TAX CLASS
      // Production: All juice production becomes hard cider
      // Distillation: All distillation is from hard cider
      // ============================================

      // Apple Brandy Production = brandy RECEIVED from distillery
      const brandyReceivedData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${distillationRecords.receivedVolumeLiters} AS DECIMAL)), 0)`,
        })
        .from(distillationRecords)
        .where(
          and(
            isNull(distillationRecords.deletedAt),
            isNotNull(distillationRecords.receivedVolumeLiters),
            sql`${distillationRecords.receivedAt}::date > ${openingDate}::date`,
            sql`${distillationRecords.receivedAt}::date <= ${reconciliationDate}::date`
          )
        );
      const brandyReceivedGallons = Number(brandyReceivedData[0]?.totalLiters || 0) * 0.264172;

      // Apple Brandy Removals = brandy transferred to pommeau batches
      const brandyToPommeauData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.sourceBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "brandy"),
            sql`EXISTS (
              SELECT 1 FROM batches dest
              WHERE dest.id = ${batchTransfers.destinationBatchId}
              AND dest.product_type = 'pommeau'
            )`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const brandyToPommeauGallons = Number(brandyToPommeauData[0]?.totalLiters || 0) * 0.264172;

      // Pommeau Production = transfers INTO pommeau batches from NON-pommeau sources
      // Excludes pommeau-to-pommeau transfers (just moving within same tax class)
      const transfersIntoPommeauData = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "pommeau"),
            // Exclude pommeau-to-pommeau transfers
            sql`NOT EXISTS (
              SELECT 1 FROM batches src
              WHERE src.id = ${batchTransfers.sourceBatchId}
              AND src.product_type = 'pommeau'
            )`,
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const transfersIntoPommeauGallons = Number(transfersIntoPommeauData[0]?.totalLiters || 0) * 0.264172;

      const productionByTaxClass: Record<string, number> = {
        hardCider: totalProductionGallons, // All juice production goes to cider
        wineUnder16: 0,
        wine16To21: transfersIntoPommeauGallons, // Pommeau production from transfers
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: brandyReceivedGallons, // Brandy received from distillery
        grapeSpirits: 0,
      };

      const distillationByTaxClass: Record<string, number> = {
        hardCider: distillationGallons, // Cider sent to distillation
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
        appleBrandy: 0, // Brandy doesn't get distilled further
        grapeSpirits: 0,
      };

      // Add brandy used in pommeau to brandy removals
      removalsByTaxClass["appleBrandy"] += brandyToPommeauGallons;

      // ============================================
      // BATCH DETAILS BY TAX CLASS
      // Returns individual batches for reconciliation review
      // Uses historical vessel assignment from racking operations
      // ============================================

      // Get bulk batch details with HISTORICAL vessel info
      // For initial reconciliation, show verified batches with initial_volume
      // For ongoing reconciliation, show active batches with current_volume
      //
      // Historical vessel is determined by:
      // 1. Most recent racking operation before/on reconciliation date
      // 2. Falls back to current vesselId if no racking history
      const batchDetailData = await db.execute(sql`
            SELECT
              b.id,
              b.custom_name as "customName",
              b.batch_number as "batchNumber",
              b.product_type as "productType",
              b.current_volume as volume,
              COALESCE(
                (SELECT bro.destination_vessel_id
                 FROM batch_racking_operations bro
                 WHERE bro.batch_id = b.id
                   AND bro.deleted_at IS NULL
                   AND bro.racked_at >= b.start_date
                   AND bro.racked_at <= ${reconciliationDate}::date
                 ORDER BY bro.racked_at DESC
                 LIMIT 1),
                b.vessel_id
              ) as "vesselId",
              COALESCE(
                (SELECT v2.name
                 FROM batch_racking_operations bro2
                 JOIN vessels v2 ON v2.id = bro2.destination_vessel_id
                 WHERE bro2.batch_id = b.id
                   AND bro2.deleted_at IS NULL
                   AND bro2.racked_at >= b.start_date
                   AND bro2.racked_at <= ${reconciliationDate}::date
                 ORDER BY bro2.racked_at DESC
                 LIMIT 1),
                v.name
              ) as "vesselName"
            FROM batches b
            LEFT JOIN vessels v ON v.id = b.vessel_id
            WHERE b.deleted_at IS NULL
              AND b.start_date <= ${reconciliationDate}::date
              AND COALESCE(b.current_volume, 0) > 0
              AND COALESCE(b.is_archived, false) = false
              AND NOT (b.batch_number LIKE 'LEGACY-%')
            ORDER BY CAST(b.current_volume AS DECIMAL) DESC
          `);

      // Get packaged inventory details
      const packagedDetailData = await db
            .select({
              batchId: batches.id,
              batchName: batches.customName,
              batchNumber: batches.batchNumber,
              productType: batches.productType,
              lotCode: inventoryItems.lotCode,
              packageSizeML: inventoryItems.packageSizeML,
              currentQuantity: inventoryItems.currentQuantity,
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
            .orderBy(sql`CAST(${inventoryItems.currentQuantity} AS DECIMAL) * CAST(${inventoryItems.packageSizeML} AS DECIMAL) DESC`);

      // Group batch details by tax class
      type BatchDetail = {
        id: string;
        name: string;
        batchNumber: string;
        vesselId: string | null;
        vesselName: string | null;
        volumeLiters: number;
        volumeGallons: number;
        type: 'bulk' | 'packaged';
        packageInfo?: string;
      };

      const batchDetailsByTaxClass: Record<string, BatchDetail[]> = {
        hardCider: [],
        wineUnder16: [],
        wine16To21: [],
        wine21To24: [],
        sparklingWine: [],
        carbonatedWine: [],
        appleBrandy: [],
        grapeSpirits: [],
      };

      // Add bulk batches (batchDetailData is a raw SQL result with .rows array)
      type BatchDetailRow = {
        id: string;
        customName: string | null;
        batchNumber: string;
        productType: string | null;
        volume: string | null;
        vesselId: string | null;
        vesselName: string | null;
      };
      const batchRows = (batchDetailData as unknown as { rows: BatchDetailRow[] }).rows || [];

      for (const batch of batchRows) {
        const taxClass = productTypeToTaxClass(batch.productType);
        const volumeLiters = parseFloat(batch.volume || "0");
        const volumeGallons = volumeLiters * 0.264172;

        batchDetailsByTaxClass[taxClass].push({
          id: batch.id,
          name: batch.customName || batch.batchNumber,
          batchNumber: batch.batchNumber,
          vesselId: batch.vesselId,
          vesselName: batch.vesselName,
          volumeLiters,
          volumeGallons,
          type: 'bulk',
        });
      }

      // Add packaged inventory
      for (const item of packagedDetailData) {
        const taxClass = productTypeToTaxClass(item.productType);
        const packageSize = Number(item.packageSizeML || 0);
        const quantity = Number(item.currentQuantity || 0);
        const volumeML = packageSize * quantity;
        const volumeLiters = volumeML / 1000;
        const volumeGallons = volumeML / 3785.41;

        batchDetailsByTaxClass[taxClass].push({
          id: `pkg-${item.batchId}-${item.lotCode || 'unknown'}`,
          name: item.lotCode || item.batchName || item.batchNumber,
          batchNumber: item.batchNumber,
          vesselId: null,
          vesselName: null,
          volumeLiters,
          volumeGallons,
          type: 'packaged',
          packageInfo: `${quantity} × ${packageSize}mL`,
        });
      }

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
            sql`${pressRuns.dateCompleted}::date > ${openingDate}::date`,
            sql`${pressRuns.dateCompleted}::date <= ${reconciliationDate}::date`
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${pressRuns.dateCompleted})`);

      // Get juice purchase volumes by year (normalize to liters)
      // Unit enum values: "kg", "lb", "L", "gal", "bushel"
      // Note: Must filter both purchase AND item deletedAt to exclude corrected entries
      const juicePurchaseData = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${juicePurchases.purchaseDate})`,
          totalLiters: sql<number>`COALESCE(SUM(
            CASE
              WHEN ${juicePurchaseItems.volumeUnit} = 'gal' THEN CAST(${juicePurchaseItems.volume} AS DECIMAL) * 3.78541
              ELSE CAST(${juicePurchaseItems.volume} AS DECIMAL)
            END
          ), 0)`,
          purchaseCount: sql<number>`COUNT(DISTINCT ${juicePurchases.id})`,
          itemCount: sql<number>`COUNT(*)`,
        })
        .from(juicePurchaseItems)
        .innerJoin(juicePurchases, eq(juicePurchaseItems.purchaseId, juicePurchases.id))
        .where(
          and(
            isNull(juicePurchases.deletedAt),
            isNull(juicePurchaseItems.deletedAt),
            sql`${juicePurchases.purchaseDate}::date > ${openingDate}::date`,
            sql`${juicePurchases.purchaseDate}::date <= ${reconciliationDate}::date`
          )
        )
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

      // Calculate total production for audit section
      const totalPressRunsGallons = productionByYear.reduce((sum, y) => sum + y.pressRunsGallons, 0);
      const totalJuicePurchasesGallons = productionByYear.reduce((sum, y) => sum + y.juicePurchasesGallons, 0);

      // Subtract juice-only batches from audit production (juice that was never fermented)
      const auditJuiceOnlyBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolume} AS DECIMAL)), 0)`,
        })
        .from(batches)
        .where(
          and(
            isNull(batches.deletedAt),
            eq(batches.productType, "juice"),
            sql`${batches.startDate}::date > ${openingDate}::date`,
            sql`${batches.startDate}::date <= ${reconciliationDate}::date`
          )
        );
      const auditJuiceOnlyGallons = Number(auditJuiceOnlyBatches[0]?.totalLiters || 0) * 0.264172;

      // Also subtract transfers INTO juice batches from audit production
      const auditTransfersIntoJuiceBatches = await db
        .select({
          totalLiters: sql<number>`COALESCE(SUM(CAST(${batchTransfers.volumeTransferred} AS DECIMAL)), 0)`,
        })
        .from(batchTransfers)
        .innerJoin(batches, eq(batchTransfers.destinationBatchId, batches.id))
        .where(
          and(
            isNull(batchTransfers.deletedAt),
            eq(batches.productType, "juice"),
            sql`${batchTransfers.transferredAt}::date > ${openingDate}::date`,
            sql`${batchTransfers.transferredAt}::date <= ${reconciliationDate}::date`
          )
        );
      const auditTransfersIntoJuiceGallons = Number(auditTransfersIntoJuiceBatches[0]?.totalLiters || 0) * 0.264172;
      const auditTotalProductionGallons = totalPressRunsGallons + totalJuicePurchasesGallons - auditJuiceOnlyGallons - auditTransfersIntoJuiceGallons;

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
      let totalTtbOpening = 0;
      let totalTtbEnding = 0;

      // Wine/Cider tax classes
      for (const [key, label] of Object.entries(taxClassLabels)) {
        if (key === "appleBrandy" || key === "grapeSpirits") continue;

        const ttbBulk = balances.bulk[key as keyof typeof balances.bulk] || 0;
        const ttbBottled = balances.bottled[key as keyof typeof balances.bottled] || 0;
        const ttbOpening = ttbBulk + ttbBottled;

        // Get values for this tax class
        const production = productionByTaxClass[key] || 0;
        const currentInv = inventoryByTaxClass[key] || 0;
        const removals = removalsByTaxClass[key] || 0;
        const losses = lossesByTaxClass[key] || 0;
        const distillation = distillationByTaxClass[key] || 0;

        // TTB Ending = Opening + Production - Removals - Losses - Distillation
        const ttbEnding = ttbOpening + production - removals - losses - distillation;

        // Difference = TTB Ending - Current Inventory
        const difference = ttbEnding - currentInv;

        if (ttbOpening > 0 || ttbEnding > 0 || currentInv > 0 || removals > 0) {
          taxClasses.push({
            key,
            label,
            type: "wine" as const,
            ttbBulk: parseFloat(ttbBulk.toFixed(1)),
            ttbBottled: parseFloat(ttbBottled.toFixed(1)),
            ttbOpening: parseFloat(ttbOpening.toFixed(1)),
            ttbTotal: parseFloat(ttbEnding.toFixed(1)), // Now shows ending balance
            production: parseFloat(production.toFixed(1)),
            losses: parseFloat(losses.toFixed(1)),
            distillation: parseFloat(distillation.toFixed(1)),
            currentInventory: parseFloat(currentInv.toFixed(1)),
            removals: parseFloat(removals.toFixed(1)),
            legacyBatches: 0,
            difference: parseFloat(difference.toFixed(1)),
            isReconciled: Math.abs(difference) < 0.5,
          });

          totalTtbOpening += ttbOpening;
          totalTtbEnding += ttbEnding;
        }
      }

      // Spirits tax classes
      for (const key of ["appleBrandy", "grapeSpirits"] as const) {
        const ttbOpening = balances.spirits[key] || 0;
        const production = productionByTaxClass[key] || 0;
        const currentInv = inventoryByTaxClass[key] || 0;
        const removals = removalsByTaxClass[key] || 0;
        const losses = lossesByTaxClass[key] || 0;
        const distillation = distillationByTaxClass[key] || 0;

        // TTB Ending = Opening + Production - Removals - Losses - Distillation
        const ttbEnding = ttbOpening + production - removals - losses - distillation;
        const difference = ttbEnding - currentInv;

        if (ttbOpening > 0 || ttbEnding > 0 || currentInv > 0 || removals > 0) {
          taxClasses.push({
            key,
            label: taxClassLabels[key],
            type: "spirits" as const,
            ttbBulk: parseFloat(ttbOpening.toFixed(1)),
            ttbBottled: 0,
            ttbOpening: parseFloat(ttbOpening.toFixed(1)),
            ttbTotal: parseFloat(ttbEnding.toFixed(1)), // Now shows ending balance
            production: parseFloat(production.toFixed(1)),
            losses: parseFloat(losses.toFixed(1)),
            distillation: parseFloat(distillation.toFixed(1)),
            currentInventory: parseFloat(currentInv.toFixed(1)),
            removals: parseFloat(removals.toFixed(1)),
            legacyBatches: 0,
            difference: parseFloat(difference.toFixed(1)),
            isReconciled: Math.abs(difference) < 0.5,
          });

          totalTtbOpening += ttbOpening;
          totalTtbEnding += ttbEnding;
        }
      }

      // Use opening balance for totalTtb (for backward compatibility in calculations)
      const totalTtb = totalTtbOpening;

      // Calculate total inventory from inventoryByTaxClass
      const totalInventoryByTaxClass = Object.values(inventoryByTaxClass).reduce((sum, val) => sum + val, 0);

      // ============================================
      // CORRECT TTB RECONCILIATION FORMULA
      // TTB Calculated Ending = Opening + Production - Removals - Losses
      // Variance = TTB Calculated - System On Hand
      // ============================================
      // System On Hand = actual current batch volumes + packaged inventory (from inventoryByTaxClass)
      // NOT the historical production-minus-removals calc (which cancels out with ttbCalculatedEnding)
      const systemOnHand = totalInventoryByTaxClass;
      const ttbCalculatedEnding = totalTtb + totalProductionGallons - salesGallons - lossesGallons - distillationGallons;
      const variance = ttbCalculatedEnding - systemOnHand;

      return {
        hasOpeningBalances: true,
        openingBalanceDate: openingDate,
        reconciliationDate,
        isInitialReconciliation,
        taxClasses,
        totals: {
          // TTB Flow
          ttbOpeningBalance: parseFloat(totalTtb.toFixed(1)),
          production: parseFloat(totalProductionGallons.toFixed(1)),
          removals: parseFloat(salesGallons.toFixed(1)),
          losses: parseFloat(lossesGallons.toFixed(1)),
          distillation: parseFloat(distillationGallons.toFixed(1)),
          ttbCalculatedEnding: parseFloat(ttbCalculatedEnding.toFixed(1)),
          // System
          systemOnHand: parseFloat(systemOnHand.toFixed(1)),
          // Variance
          variance: parseFloat(variance.toFixed(1)),
          // Legacy fields for backwards compatibility
          ttbBalance: parseFloat(totalTtb.toFixed(1)),
          currentInventory: parseFloat(totalInventoryByTaxClass.toFixed(1)),
          legacyBatches: 0,
          difference: parseFloat(variance.toFixed(1)), // Now uses correct variance
        },
        // Additional breakdown for UI display
        breakdown: {
          bulkInventory: parseFloat(actualBulkGallons.toFixed(1)),
          packagedInventory: parseFloat(actualPackagedGallons.toFixed(1)),
          sales: parseFloat(salesGallons.toFixed(1)),
          losses: parseFloat(lossesGallons.toFixed(1)),
          distillation: parseFloat(distillationGallons.toFixed(1)),
        },
        // Inventory breakdown by batch originating year
        inventoryByYear,
        // Production Audit (Source-Based View)
        productionAudit: {
          totals: {
            pressRuns: parseFloat(totalPressRunsGallons.toFixed(1)),
            juicePurchases: parseFloat(totalJuicePurchasesGallons.toFixed(1)),
            totalProduction: parseFloat(auditTotalProductionGallons.toFixed(1)),
          },
          byYear: productionByYear,
        },
        // Batch details by tax class for reconciliation review
        batchDetailsByTaxClass: Object.fromEntries(
          Object.entries(batchDetailsByTaxClass).map(([key, batches]) => [
            key,
            batches.map(b => ({
              id: b.id,
              name: b.name,
              batchNumber: b.batchNumber,
              vesselName: b.vesselName,
              volumeLiters: parseFloat(b.volumeLiters.toFixed(2)),
              volumeGallons: parseFloat(b.volumeGallons.toFixed(2)),
              type: b.type,
              packageInfo: b.packageInfo,
            })),
          ])
        ),
      };
    } catch (error) {
      console.error("Error getting reconciliation summary:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get reconciliation summary",
      });
    }
  }),

  // ============================================
  // RECONCILIATION SNAPSHOTS
  // ============================================

  /**
   * Save current reconciliation state as a snapshot
   * Takes the summary data from the frontend (which already has the calculated values)
   */
  saveReconciliation: protectedProcedure
    .input(
      z.object({
        reconciliationDate: z.string(), // ISO date
        name: z.string().optional(),
        notes: z.string().optional(),
        discrepancyExplanation: z.string().optional(),
        // Period tracking (optional for backwards compatibility)
        periodStartDate: z.string().optional(), // ISO date - start of period
        periodEndDate: z.string().optional(), // ISO date - end of period (usually = reconciliationDate)
        previousReconciliationId: z.string().uuid().optional(), // Link to previous reconciliation
        // Balance tracking (optional for backwards compatibility)
        openingBalanceGallons: z.number().optional(),
        calculatedEndingGallons: z.number().optional(),
        physicalCountGallons: z.number().optional(),
        varianceGallons: z.number().optional(),
        // Summary data from frontend
        summary: z.object({
          openingBalanceDate: z.string().nullable(),
          totals: z.object({
            ttbBalance: z.number(),
            currentInventory: z.number(),
            removals: z.number(),
            legacyBatches: z.number(),
            difference: z.number(),
          }),
          breakdown: z.object({
            bulkInventory: z.number(),
            packagedInventory: z.number(),
            sales: z.number(),
            losses: z.number(),
          }).optional(),
          inventoryByYear: z.array(z.object({
            year: z.number(),
            bulkGallons: z.number(),
            packagedGallons: z.number(),
            totalGallons: z.number(),
          })).optional(),
          productionAudit: z.object({
            totals: z.object({
              pressRuns: z.number(),
              juicePurchases: z.number(),
              totalProduction: z.number(),
            }),
            byYear: z.array(z.object({
              year: z.number(),
              pressRunsGallons: z.number(),
              juicePurchasesGallons: z.number(),
              totalGallons: z.number(),
            })),
          }).optional(),
          taxClasses: z.array(z.any()).optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { summary } = input;
      const isReconciled = Math.abs(summary.totals.difference) < 0.5;

      const [snapshot] = await db
        .insert(ttbReconciliationSnapshots)
        .values({
          reconciliationDate: input.reconciliationDate,
          name: input.name,

          // Period tracking
          periodStartDate: input.periodStartDate,
          periodEndDate: input.periodEndDate || input.reconciliationDate,
          previousReconciliationId: input.previousReconciliationId,

          // Balance tracking
          openingBalanceGallons: input.openingBalanceGallons?.toString(),
          calculatedEndingGallons: input.calculatedEndingGallons?.toString(),
          physicalCountGallons: input.physicalCountGallons?.toString(),
          varianceGallons: input.varianceGallons?.toString(),

          // TTB Reference
          ttbBalance: summary.totals.ttbBalance.toString(),
          ttbSourceType: input.previousReconciliationId ? "previous_snapshot" : "opening_balance",
          ttbSourceDate: summary.openingBalanceDate,

          // Inventory Audit
          inventoryBulk: (summary.breakdown?.bulkInventory || 0).toString(),
          inventoryPackaged: (summary.breakdown?.packagedInventory || 0).toString(),
          inventoryOnHand: summary.totals.currentInventory.toString(),
          inventoryRemovals: summary.totals.removals.toString(),
          inventoryLegacy: "0",
          inventoryAccountedFor: (
            summary.totals.currentInventory +
            summary.totals.removals
          ).toString(),
          inventoryDifference: summary.totals.difference.toString(),

          // Production Audit
          productionPressRuns: (summary.productionAudit?.totals.pressRuns || 0).toString(),
          productionJuicePurchases: (summary.productionAudit?.totals.juicePurchases || 0).toString(),
          productionTotal: (summary.productionAudit?.totals.totalProduction || 0).toString(),

          // Breakdown data (JSON)
          productionByYear: JSON.stringify(summary.productionAudit?.byYear || []),
          inventoryByYear: JSON.stringify(summary.inventoryByYear || []),
          taxClassBreakdown: JSON.stringify(summary.taxClasses || []),

          // Status
          isReconciled,
          status: "finalized",
          finalizedAt: new Date(),
          notes: input.notes,
          discrepancyExplanation: input.discrepancyExplanation,

          createdBy: ctx.session?.user?.id,
        })
        .returning();

      return snapshot;
    }),

  /**
   * Get list of past reconciliations
   */
  getReconciliationHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;

      const snapshots = await db
        .select({
          id: ttbReconciliationSnapshots.id,
          reconciliationDate: ttbReconciliationSnapshots.reconciliationDate,
          name: ttbReconciliationSnapshots.name,
          ttbBalance: ttbReconciliationSnapshots.ttbBalance,
          inventoryOnHand: ttbReconciliationSnapshots.inventoryOnHand,
          inventoryDifference: ttbReconciliationSnapshots.inventoryDifference,
          productionTotal: ttbReconciliationSnapshots.productionTotal,
          isReconciled: ttbReconciliationSnapshots.isReconciled,
          status: ttbReconciliationSnapshots.status,
          finalizedAt: ttbReconciliationSnapshots.finalizedAt,
          createdAt: ttbReconciliationSnapshots.createdAt,
        })
        .from(ttbReconciliationSnapshots)
        .orderBy(desc(ttbReconciliationSnapshots.reconciliationDate))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ttbReconciliationSnapshots);

      return {
        snapshots: snapshots.map((s) => ({
          ...s,
          ttbBalance: parseFloat(s.ttbBalance || "0"),
          inventoryOnHand: parseFloat(s.inventoryOnHand || "0"),
          inventoryDifference: parseFloat(s.inventoryDifference || "0"),
          productionTotal: parseFloat(s.productionTotal || "0"),
        })),
        total: Number(count),
        hasMore: offset + limit < Number(count),
      };
    }),

  /**
   * Get a specific reconciliation snapshot by ID
   */
  getReconciliationById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [snapshot] = await db
        .select()
        .from(ttbReconciliationSnapshots)
        .where(eq(ttbReconciliationSnapshots.id, input.id));

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reconciliation snapshot not found",
        });
      }

      return {
        ...snapshot,
        ttbBalance: parseFloat(snapshot.ttbBalance || "0"),
        inventoryBulk: parseFloat(snapshot.inventoryBulk || "0"),
        inventoryPackaged: parseFloat(snapshot.inventoryPackaged || "0"),
        inventoryOnHand: parseFloat(snapshot.inventoryOnHand || "0"),
        inventoryRemovals: parseFloat(snapshot.inventoryRemovals || "0"),
        inventoryLegacy: parseFloat(snapshot.inventoryLegacy || "0"),
        inventoryAccountedFor: parseFloat(snapshot.inventoryAccountedFor || "0"),
        inventoryDifference: parseFloat(snapshot.inventoryDifference || "0"),
        productionPressRuns: parseFloat(snapshot.productionPressRuns || "0"),
        productionJuicePurchases: parseFloat(snapshot.productionJuicePurchases || "0"),
        productionTotal: parseFloat(snapshot.productionTotal || "0"),
        productionByYear: snapshot.productionByYear ? JSON.parse(snapshot.productionByYear) : [],
        inventoryByYear: snapshot.inventoryByYear ? JSON.parse(snapshot.inventoryByYear) : [],
        taxClassBreakdown: snapshot.taxClassBreakdown ? JSON.parse(snapshot.taxClassBreakdown) : [],
      };
    }),

  /**
   * Finalize a reconciliation snapshot
   */
  finalizeReconciliation: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().optional(),
        discrepancyExplanation: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [snapshot] = await db
        .update(ttbReconciliationSnapshots)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          finalizedBy: ctx.session?.user?.id,
          notes: input.notes,
          discrepancyExplanation: input.discrepancyExplanation,
          updatedAt: new Date(),
        })
        .where(eq(ttbReconciliationSnapshots.id, input.id))
        .returning();

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reconciliation snapshot not found",
        });
      }

      return snapshot;
    }),

  /**
   * Get the most recent finalized reconciliation
   */
  getLastReconciliation: protectedProcedure.query(async () => {
    const [snapshot] = await db
      .select()
      .from(ttbReconciliationSnapshots)
      .where(eq(ttbReconciliationSnapshots.status, "finalized"))
      .orderBy(desc(ttbReconciliationSnapshots.finalizedAt))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    // Parse taxClassBreakdown JSON
    let taxClasses: Array<{
      key: string;
      label: string;
      ttbTotal: number;
      currentInventory: number;
      removals: number;
      legacyBatches: number;
      difference: number;
      isReconciled: boolean;
    }> = [];

    if (snapshot.taxClassBreakdown) {
      try {
        const parsed = typeof snapshot.taxClassBreakdown === 'string'
          ? JSON.parse(snapshot.taxClassBreakdown)
          : snapshot.taxClassBreakdown;
        taxClasses = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Failed to parse taxClassBreakdown:", e);
      }
    }

    return {
      ...snapshot,
      ttbBalance: parseFloat(snapshot.ttbBalance || "0"),
      inventoryOnHand: parseFloat(snapshot.inventoryOnHand || "0"),
      inventoryRemovals: parseFloat(snapshot.inventoryRemovals || "0"),
      inventoryLegacy: parseFloat(snapshot.inventoryLegacy || "0"),
      inventoryAccountedFor: parseFloat(snapshot.inventoryAccountedFor || "0"),
      inventoryDifference: parseFloat(snapshot.inventoryDifference || "0"),
      inventoryBulk: parseFloat(snapshot.inventoryBulk || "0"),
      inventoryPackaged: parseFloat(snapshot.inventoryPackaged || "0"),
      productionTotal: parseFloat(snapshot.productionTotal || "0"),
      productionPressRuns: parseFloat(snapshot.productionPressRuns || "0"),
      productionJuicePurchases: parseFloat(snapshot.productionJuicePurchases || "0"),
      openingBalanceGallons: snapshot.openingBalanceGallons ? parseFloat(snapshot.openingBalanceGallons) : null,
      calculatedEndingGallons: snapshot.calculatedEndingGallons ? parseFloat(snapshot.calculatedEndingGallons) : null,
      physicalCountGallons: snapshot.physicalCountGallons ? parseFloat(snapshot.physicalCountGallons) : null,
      varianceGallons: snapshot.varianceGallons ? parseFloat(snapshot.varianceGallons) : null,
      taxClasses,
    };
  }),

  /**
   * Get suggested next reconciliation period based on last finalized reconciliation
   * Returns period presets (This Month, Last Month, etc.) and suggested start date
   */
  getReconciliationPeriodSuggestions: protectedProcedure.query(async () => {
    // Get the most recent finalized reconciliation
    const [lastReconciliation] = await db
      .select({
        periodEndDate: ttbReconciliationSnapshots.periodEndDate,
        reconciliationDate: ttbReconciliationSnapshots.reconciliationDate,
        physicalCountGallons: ttbReconciliationSnapshots.physicalCountGallons,
        inventoryOnHand: ttbReconciliationSnapshots.inventoryOnHand,
      })
      .from(ttbReconciliationSnapshots)
      .where(eq(ttbReconciliationSnapshots.status, "finalized"))
      .orderBy(desc(ttbReconciliationSnapshots.finalizedAt))
      .limit(1);

    // Get TTB opening balance date as fallback
    const [settings] = await db
      .select({
        ttbOpeningBalanceDate: organizationSettings.ttbOpeningBalanceDate,
      })
      .from(organizationSettings)
      .limit(1);

    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];

    // Determine the suggested start date
    let suggestedStartDate: string;
    let suggestedOpeningBalance: number;
    let previousReconciliationId: string | null = null;
    let hasLastReconciliation = false;

    if (lastReconciliation?.periodEndDate || lastReconciliation?.reconciliationDate) {
      // Use day after last reconciliation period end
      const lastEndDate = new Date(lastReconciliation.periodEndDate || lastReconciliation.reconciliationDate);
      lastEndDate.setDate(lastEndDate.getDate() + 1);
      suggestedStartDate = lastEndDate.toISOString().split("T")[0];
      suggestedOpeningBalance = lastReconciliation.physicalCountGallons
        ? parseFloat(lastReconciliation.physicalCountGallons)
        : parseFloat(lastReconciliation.inventoryOnHand || "0");
      hasLastReconciliation = true;
    } else if (settings?.ttbOpeningBalanceDate) {
      // Use TTB opening balance date
      suggestedStartDate = settings.ttbOpeningBalanceDate;
      suggestedOpeningBalance = 0; // Will be calculated from opening balances
    } else {
      // Default to start of current year
      suggestedStartDate = `${today.getFullYear()}-01-01`;
      suggestedOpeningBalance = 0;
    }

    // Build period presets
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Helper to get month name
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    // This month
    const thisMonthStart = new Date(currentYear, currentMonth, 1);
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0);

    // Last month
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0);

    // This quarter
    const currentQuarter = Math.floor(currentMonth / 3);
    const thisQuarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const thisQuarterEnd = new Date(currentYear, (currentQuarter + 1) * 3, 0);

    // Year to date
    const yearStart = new Date(currentYear, 0, 1);

    const presets = [
      {
        label: `This Month (${monthNames[currentMonth]})`,
        startDate: thisMonthStart.toISOString().split("T")[0],
        endDate: todayISO,
      },
      {
        label: `Last Month (${monthNames[currentMonth === 0 ? 11 : currentMonth - 1]})`,
        startDate: lastMonthStart.toISOString().split("T")[0],
        endDate: lastMonthEnd.toISOString().split("T")[0],
      },
      {
        label: `This Quarter (Q${currentQuarter + 1})`,
        startDate: thisQuarterStart.toISOString().split("T")[0],
        endDate: todayISO,
      },
      {
        label: "Year to Date",
        startDate: yearStart.toISOString().split("T")[0],
        endDate: todayISO,
      },
    ];

    // Add "Continue from Last Reconciliation" preset if applicable
    if (hasLastReconciliation && suggestedStartDate < todayISO) {
      presets.unshift({
        label: `Continue from Last Reconciliation (${suggestedStartDate})`,
        startDate: suggestedStartDate,
        endDate: todayISO,
      });
    }

    return {
      suggestedStartDate,
      suggestedOpeningBalance,
      previousReconciliationId,
      hasLastReconciliation,
      presets,
    };
  }),

  // ============================================
  // BATCH LIFECYCLE AUDIT ENDPOINTS
  // ============================================

  /**
   * Get chronological timeline of all events for a single batch.
   * Includes: creation, transfers, racking, filtering, packaging, volume adjustments.
   */
  getBatchLifecycleTimeline: protectedProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(), // ISO date string
      })
    )
    .query(async ({ input }) => {
      const { batchId, startDate, endDate } = input;

      // Get the batch info
      const [batch] = await db
        .select({
          id: batches.id,
          name: batches.name,
          productType: batches.productType,
          startDate: batches.startDate,
          endDate: batches.endDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          vesselId: batches.vesselId,
          vesselName: vessels.name,
          status: batches.status,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(eq(batches.id, batchId));

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      type TimelineEvent = {
        id: string;
        type: "creation" | "transfer_in" | "transfer_out" | "racking" | "filtering" | "packaging" | "volume_adjustment" | "carbonation";
        date: Date;
        description: string;
        volumeChange: number | null;
        runningVolume: number | null;
        vesselFrom: string | null;
        vesselTo: string | null;
        lossLiters: number | null;
        metadata: Record<string, unknown>;
      };

      const events: TimelineEvent[] = [];

      // 1. Creation event
      events.push({
        id: `creation-${batch.id}`,
        type: "creation",
        date: batch.startDate,
        description: `Batch created in ${batch.vesselName || "unknown vessel"}`,
        volumeChange: parseFloat(batch.initialVolumeLiters || "0"),
        runningVolume: parseFloat(batch.initialVolumeLiters || "0"),
        vesselFrom: null,
        vesselTo: batch.vesselName,
        lossLiters: null,
        metadata: { productType: batch.productType },
      });

      // 2. Transfers out (this batch was the source)
      const transfersOut = await db
        .select({
          id: batchTransfers.id,
          transferredAt: batchTransfers.transferredAt,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          sourceVesselName: sql<string>`source_vessel.name`,
          destVesselName: sql<string>`dest_vessel.name`,
          destBatchName: sql<string>`dest_batch.name`,
          notes: batchTransfers.notes,
        })
        .from(batchTransfers)
        .leftJoin(sql`vessels source_vessel`, sql`source_vessel.id = ${batchTransfers.sourceVesselId}`)
        .leftJoin(sql`vessels dest_vessel`, sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`)
        .leftJoin(sql`batches dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
        .where(eq(batchTransfers.sourceBatchId, batchId));

      for (const t of transfersOut) {
        events.push({
          id: `transfer-out-${t.id}`,
          type: "transfer_out",
          date: t.transferredAt,
          description: `Transferred to ${t.destBatchName || t.destVesselName || "unknown"}`,
          volumeChange: -parseFloat(t.volumeTransferred || "0"),
          runningVolume: null, // Will be calculated after sorting
          vesselFrom: t.sourceVesselName,
          vesselTo: t.destVesselName,
          lossLiters: t.loss ? parseFloat(t.loss) : null,
          metadata: { notes: t.notes },
        });
      }

      // 3. Transfers in (this batch was the destination)
      const transfersIn = await db
        .select({
          id: batchTransfers.id,
          transferredAt: batchTransfers.transferredAt,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          sourceVesselName: sql<string>`source_vessel.name`,
          destVesselName: sql<string>`dest_vessel.name`,
          sourceBatchName: sql<string>`source_batch.name`,
          notes: batchTransfers.notes,
        })
        .from(batchTransfers)
        .leftJoin(sql`vessels source_vessel`, sql`source_vessel.id = ${batchTransfers.sourceVesselId}`)
        .leftJoin(sql`vessels dest_vessel`, sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`)
        .leftJoin(sql`batches source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
        .where(eq(batchTransfers.destinationBatchId, batchId));

      for (const t of transfersIn) {
        events.push({
          id: `transfer-in-${t.id}`,
          type: "transfer_in",
          date: t.transferredAt,
          description: `Received from ${t.sourceBatchName || t.sourceVesselName || "unknown"}`,
          volumeChange: parseFloat(t.volumeTransferred || "0"),
          runningVolume: null,
          vesselFrom: t.sourceVesselName,
          vesselTo: t.destVesselName,
          lossLiters: t.loss ? parseFloat(t.loss) : null,
          metadata: { notes: t.notes },
        });
      }

      // 4. Racking operations
      const rackings = await db
        .select({
          id: batchRackingOperations.id,
          rackedAt: batchRackingOperations.rackedAt,
          sourceVesselName: sql<string>`source_vessel.name`,
          destVesselName: sql<string>`dest_vessel.name`,
          volumeAfter: batchRackingOperations.volumeAfter,
          volumeLoss: batchRackingOperations.volumeLoss,
          notes: batchRackingOperations.notes,
        })
        .from(batchRackingOperations)
        .leftJoin(sql`vessels source_vessel`, sql`source_vessel.id = ${batchRackingOperations.sourceVesselId}`)
        .leftJoin(sql`vessels dest_vessel`, sql`dest_vessel.id = ${batchRackingOperations.destinationVesselId}`)
        .where(eq(batchRackingOperations.batchId, batchId));

      for (const r of rackings) {
        events.push({
          id: `racking-${r.id}`,
          type: "racking",
          date: r.rackedAt,
          description: `Racked from ${r.sourceVesselName || "unknown"} to ${r.destVesselName || "unknown"}`,
          volumeChange: r.volumeLoss ? -parseFloat(r.volumeLoss) : 0,
          runningVolume: null,
          vesselFrom: r.sourceVesselName,
          vesselTo: r.destVesselName,
          lossLiters: r.volumeLoss ? parseFloat(r.volumeLoss) : null,
          metadata: { notes: r.notes },
        });
      }

      // 5. Filter operations
      const filters = await db
        .select({
          id: batchFilterOperations.id,
          filteredAt: batchFilterOperations.filteredAt,
          filterType: batchFilterOperations.filterType,
          volumeBefore: batchFilterOperations.volumeBefore,
          volumeAfter: batchFilterOperations.volumeAfter,
          volumeLoss: batchFilterOperations.volumeLoss,
          notes: batchFilterOperations.notes,
        })
        .from(batchFilterOperations)
        .where(eq(batchFilterOperations.batchId, batchId));

      for (const f of filters) {
        const lossLiters = parseFloat(f.volumeLoss || "0");

        events.push({
          id: `filter-${f.id}`,
          type: "filtering",
          date: f.filteredAt,
          description: `Filtered (${f.filterType || "unknown type"})`,
          volumeChange: -lossLiters,
          runningVolume: null,
          vesselFrom: null,
          vesselTo: null,
          lossLiters: lossLiters > 0 ? lossLiters : null,
          metadata: { filterType: f.filterType, notes: f.notes },
        });
      }

      // 6. Packaging (bottle runs)
      const packaging = await db
        .select({
          id: bottleRuns.id,
          packagedAt: bottleRuns.packagedAt,
          packageSizeML: bottleRuns.packageSizeML,
          unitsProduced: bottleRuns.unitsProduced,
          volumeTakenLiters: bottleRuns.volumeTakenLiters,
        })
        .from(bottleRuns)
        .where(eq(bottleRuns.batchId, batchId));

      for (const p of packaging) {
        const volumeTaken = parseFloat(p.volumeTakenLiters || "0");
        events.push({
          id: `packaging-${p.id}`,
          type: "packaging",
          date: p.packagedAt,
          description: `Packaged ${p.unitsProduced} × ${p.packageSizeML}ml units`,
          volumeChange: -volumeTaken,
          runningVolume: null,
          vesselFrom: null,
          vesselTo: null,
          lossLiters: null,
          metadata: {
            packageSizeML: p.packageSizeML,
            unitsProduced: p.unitsProduced,
          },
        });
      }

      // 7. Volume adjustments
      const adjustments = await db
        .select({
          id: batchVolumeAdjustments.id,
          adjustmentDate: batchVolumeAdjustments.adjustmentDate,
          reason: batchVolumeAdjustments.reason,
          volumeBefore: batchVolumeAdjustments.volumeBefore,
          volumeAfter: batchVolumeAdjustments.volumeAfter,
          notes: batchVolumeAdjustments.notes,
        })
        .from(batchVolumeAdjustments)
        .where(eq(batchVolumeAdjustments.batchId, batchId));

      for (const a of adjustments) {
        const prevVol = parseFloat(a.volumeBefore || "0");
        const newVol = parseFloat(a.volumeAfter || "0");
        const change = newVol - prevVol;

        events.push({
          id: `adjustment-${a.id}`,
          type: "volume_adjustment",
          date: a.adjustmentDate,
          description: `Volume adjusted: ${a.reason || "manual correction"}`,
          volumeChange: change,
          runningVolume: null,
          vesselFrom: null,
          vesselTo: null,
          lossLiters: change < 0 ? Math.abs(change) : null,
          metadata: {
            reason: a.reason,
            notes: a.notes,
            previousVolume: prevVol,
            newVolume: newVol,
          },
        });
      }

      // Sort events by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running volume
      let runningVolume = 0;
      for (const event of events) {
        if (event.type === "creation") {
          runningVolume = event.volumeChange || 0;
        } else {
          runningVolume += event.volumeChange || 0;
        }
        event.runningVolume = Math.max(0, runningVolume);
      }

      // Filter by date range if provided
      let filteredEvents = events;
      if (startDate) {
        const start = new Date(startDate);
        filteredEvents = filteredEvents.filter((e) => new Date(e.date) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        filteredEvents = filteredEvents.filter((e) => new Date(e.date) <= end);
      }

      return {
        batch: {
          id: batch.id,
          name: batch.name,
          productType: batch.productType,
          status: batch.status,
          initialVolumeLiters: parseFloat(batch.initialVolumeLiters || "0"),
          currentVolumeLiters: parseFloat(batch.currentVolumeLiters || "0"),
          currentVessel: batch.vesselName,
        },
        events: filteredEvents,
        summary: {
          totalEvents: filteredEvents.length,
          totalLossLiters: filteredEvents.reduce((sum, e) => sum + (e.lossLiters || 0), 0),
          totalPackagedLiters: filteredEvents
            .filter((e) => e.type === "packaging")
            .reduce((sum, e) => sum + Math.abs(e.volumeChange || 0), 0),
        },
      };
    }),

  /**
   * Get batch lifecycle activity grouped by tax class.
   * Shows Opening → Activity → Ending for each tax class.
   */
  getBatchLifecycleByTaxClass: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // ISO date string
        endDate: z.string(), // ISO date string
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get opening balance from reconciliation snapshots or TTB opening balance
      const [lastRecon] = await db
        .select()
        .from(ttbReconciliationSnapshots)
        .where(lt(ttbReconciliationSnapshots.reconciliationDate, startDate))
        .orderBy(desc(ttbReconciliationSnapshots.reconciliationDate))
        .limit(1);

      type TaxClassData = {
        taxClass: string;
        openingLiters: number;
        productionLiters: number;
        transfersInLiters: number;
        transfersOutLiters: number;
        packagingLiters: number;
        lossesLiters: number;
        endingLiters: number;
        batches: Array<{
          id: string;
          name: string;
          productType: string;
          openingVolume: number;
          currentVolume: number;
          vessel: string | null;
        }>;
      };

      // Get all batches grouped by product type (tax class)
      const allBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          productType: batches.productType,
          startDate: batches.startDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          vesselName: vessels.name,
          status: batches.status,
          isArchived: batches.isArchived,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            eq(batches.isArchived, false),
            isNull(batches.deletedAt)
          )
        );

      // Map product types to tax classes
      const productTypeToTaxClass: Record<string, string> = {
        cider: "hardCider",
        wine: "wineUnder16",
        pommeau: "wine16To21",
        brandy: "appleBrandy",
        perry: "hardCider",
        juice: "materials",
      };

      // Group batches by tax class
      const taxClassMap = new Map<string, TaxClassData>();

      for (const batch of allBatches) {
        const taxClass = productTypeToTaxClass[batch.productType] || "other";

        if (!taxClassMap.has(taxClass)) {
          taxClassMap.set(taxClass, {
            taxClass,
            openingLiters: 0,
            productionLiters: 0,
            transfersInLiters: 0,
            transfersOutLiters: 0,
            packagingLiters: 0,
            lossesLiters: 0,
            endingLiters: 0,
            batches: [],
          });
        }

        const data = taxClassMap.get(taxClass)!;

        // Calculate opening volume (batch volume at start date)
        // For simplicity, use initial volume if batch started before period, else 0
        const batchStartDate = new Date(batch.startDate);
        const openingVolume = batchStartDate < start
          ? parseFloat(batch.initialVolumeLiters || "0")
          : 0;

        // Production = batches created during period
        const productionVolume = batchStartDate >= start && batchStartDate <= end
          ? parseFloat(batch.initialVolumeLiters || "0")
          : 0;

        data.openingLiters += openingVolume;
        data.productionLiters += productionVolume;
        data.endingLiters += parseFloat(batch.currentVolumeLiters || "0");

        data.batches.push({
          id: batch.id,
          name: batch.name,
          productType: batch.productType,
          openingVolume,
          currentVolume: parseFloat(batch.currentVolumeLiters || "0"),
          vessel: batch.vesselName,
        });
      }

      // Get transfers during period
      const transfers = await db
        .select({
          id: batchTransfers.id,
          transferredAt: batchTransfers.transferredAt,
          volumeTransferred: batchTransfers.volumeTransferred,
          loss: batchTransfers.loss,
          sourceBatchId: batchTransfers.sourceBatchId,
          destBatchId: batchTransfers.destinationBatchId,
          sourceProductType: sql<string>`source_batch.product_type`,
          destProductType: sql<string>`dest_batch.product_type`,
        })
        .from(batchTransfers)
        .leftJoin(sql`batches source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
        .leftJoin(sql`batches dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
        .where(
          and(
            gte(batchTransfers.transferredAt, start),
            lte(batchTransfers.transferredAt, end)
          )
        );

      for (const t of transfers) {
        const sourceClass = productTypeToTaxClass[t.sourceProductType] || "other";
        const targetClass = productTypeToTaxClass[t.destProductType] || "other";
        const volume = parseFloat(t.volumeTransferred || "0");
        const loss = parseFloat(t.loss || "0");

        // Add loss to source class
        if (taxClassMap.has(sourceClass)) {
          taxClassMap.get(sourceClass)!.lossesLiters += loss;
        }

        // If transfer is between different tax classes, track it
        if (sourceClass !== targetClass) {
          if (taxClassMap.has(sourceClass)) {
            taxClassMap.get(sourceClass)!.transfersOutLiters += volume;
          }
          if (taxClassMap.has(targetClass)) {
            taxClassMap.get(targetClass)!.transfersInLiters += volume;
          }
        }
      }

      // Get packaging during period
      const packagingRuns = await db
        .select({
          id: bottleRuns.id,
          batchId: bottleRuns.batchId,
          volumeTakenLiters: bottleRuns.volumeTakenLiters,
          productType: batches.productType,
        })
        .from(bottleRuns)
        .leftJoin(batches, eq(bottleRuns.batchId, batches.id))
        .where(
          and(
            gte(bottleRuns.packagedAt, start),
            lte(bottleRuns.packagedAt, end)
          )
        );

      for (const p of packagingRuns) {
        const taxClass = productTypeToTaxClass[p.productType || "cider"] || "other";
        const volume = parseFloat(p.volumeTakenLiters || "0");

        if (taxClassMap.has(taxClass)) {
          taxClassMap.get(taxClass)!.packagingLiters += volume;
        }
      }

      // Convert map to array and calculate reconciliation
      const result = Array.from(taxClassMap.values()).map((data) => ({
        ...data,
        calculatedEnding:
          data.openingLiters +
          data.productionLiters +
          data.transfersInLiters -
          data.transfersOutLiters -
          data.packagingLiters -
          data.lossesLiters,
        variance: data.endingLiters - (
          data.openingLiters +
          data.productionLiters +
          data.transfersInLiters -
          data.transfersOutLiters -
          data.packagingLiters -
          data.lossesLiters
        ),
      }));

      return {
        periodStart: startDate,
        periodEnd: endDate,
        taxClasses: result.filter((tc) => tc.batches.length > 0),
        summary: {
          totalOpeningLiters: result.reduce((sum, tc) => sum + tc.openingLiters, 0),
          totalProductionLiters: result.reduce((sum, tc) => sum + tc.productionLiters, 0),
          totalPackagingLiters: result.reduce((sum, tc) => sum + tc.packagingLiters, 0),
          totalLossesLiters: result.reduce((sum, tc) => sum + tc.lossesLiters, 0),
          totalEndingLiters: result.reduce((sum, tc) => sum + tc.endingLiters, 0),
        },
      };
    }),

  /**
   * Get disposition summary - where each batch ended up.
   * Shows: In Vessel, Packaged, Lost, Transferred Out
   */
  getBatchDispositionSummary: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid().optional(),
        endDate: z.string(), // ISO date string - "as of" date
      })
    )
    .query(async ({ input }) => {
      const { endDate } = input;
      const asOfDate = new Date(endDate);

      type BatchDisposition = {
        id: string;
        name: string;
        productType: string;
        startDate: Date;
        initialVolumeLiters: number;
        disposition: {
          inVesselLiters: number;
          vesselName: string | null;
          packagedLiters: number;
          lostLiters: number;
          transferredOutLiters: number;
        };
        percentagePackaged: number;
        percentageLost: number;
      };

      // Get all batches
      const allBatches = await db
        .select({
          id: batches.id,
          name: batches.name,
          productType: batches.productType,
          startDate: batches.startDate,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          vesselName: vessels.name,
          status: batches.status,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            eq(batches.isArchived, false),
            isNull(batches.deletedAt),
            lte(batches.startDate, asOfDate)
          )
        );

      const dispositions: BatchDisposition[] = [];

      for (const batch of allBatches) {
        const initialVolume = parseFloat(batch.initialVolumeLiters || "0");
        const currentVolume = parseFloat(batch.currentVolumeLiters || "0");

        // Get total packaged volume
        const [packagingResult] = await db
          .select({
            totalLiters: sql<string>`COALESCE(SUM(${bottleRuns.volumeTakenLiters}), 0)`,
          })
          .from(bottleRuns)
          .where(
            and(
              eq(bottleRuns.batchId, batch.id),
              lte(bottleRuns.packagedAt, asOfDate)
            )
          );

        const packagedLiters = parseFloat(packagingResult?.totalLiters || "0");

        // Get total transferred out (where this batch was source)
        const [transferResult] = await db
          .select({
            totalLiters: sql<string>`COALESCE(SUM(${batchTransfers.volumeTransferred}), 0)`,
            totalLoss: sql<string>`COALESCE(SUM(${batchTransfers.loss}), 0)`,
          })
          .from(batchTransfers)
          .where(
            and(
              eq(batchTransfers.sourceBatchId, batch.id),
              lte(batchTransfers.transferredAt, asOfDate)
            )
          );

        const transferredOutLiters = parseFloat(transferResult?.totalLiters || "0");
        const transferLossLiters = parseFloat(transferResult?.totalLoss || "0");

        // Get other losses (racking, filtering)
        const [rackingLoss] = await db
          .select({
            totalLoss: sql<string>`COALESCE(SUM(${batchRackingOperations.volumeLoss}), 0)`,
          })
          .from(batchRackingOperations)
          .where(
            and(
              eq(batchRackingOperations.batchId, batch.id),
              lte(batchRackingOperations.rackedAt, asOfDate)
            )
          );

        const [filterLoss] = await db
          .select({
            totalLoss: sql<string>`COALESCE(SUM(${batchFilterOperations.volumeLoss}), 0)`,
          })
          .from(batchFilterOperations)
          .where(
            and(
              eq(batchFilterOperations.batchId, batch.id),
              lte(batchFilterOperations.filteredAt, asOfDate)
            )
          );

        const rackingLossLiters = parseFloat(rackingLoss?.totalLoss || "0");
        const filterLossLiters = parseFloat(filterLoss?.totalLoss || "0");
        const totalLostLiters = transferLossLiters + rackingLossLiters + filterLossLiters;

        // Calculate variance (unaccounted)
        const accountedFor = currentVolume + packagedLiters + transferredOutLiters + totalLostLiters;
        const variance = initialVolume - accountedFor;
        const adjustedLoss = totalLostLiters + (variance > 0 ? variance : 0);

        dispositions.push({
          id: batch.id,
          name: batch.name,
          productType: batch.productType,
          startDate: batch.startDate,
          initialVolumeLiters: initialVolume,
          disposition: {
            inVesselLiters: currentVolume,
            vesselName: batch.vesselName,
            packagedLiters,
            lostLiters: adjustedLoss,
            transferredOutLiters,
          },
          percentagePackaged: initialVolume > 0 ? (packagedLiters / initialVolume) * 100 : 0,
          percentageLost: initialVolume > 0 ? (adjustedLoss / initialVolume) * 100 : 0,
        });
      }

      // Group by product type for summary
      const byProductType = dispositions.reduce(
        (acc, d) => {
          if (!acc[d.productType]) {
            acc[d.productType] = {
              inVesselLiters: 0,
              packagedLiters: 0,
              lostLiters: 0,
              transferredOutLiters: 0,
              batchCount: 0,
            };
          }
          acc[d.productType].inVesselLiters += d.disposition.inVesselLiters;
          acc[d.productType].packagedLiters += d.disposition.packagedLiters;
          acc[d.productType].lostLiters += d.disposition.lostLiters;
          acc[d.productType].transferredOutLiters += d.disposition.transferredOutLiters;
          acc[d.productType].batchCount += 1;
          return acc;
        },
        {} as Record<string, { inVesselLiters: number; packagedLiters: number; lostLiters: number; transferredOutLiters: number; batchCount: number }>
      );

      return {
        asOfDate: endDate,
        batches: dispositions,
        byProductType,
        summary: {
          totalBatches: dispositions.length,
          totalInVesselLiters: dispositions.reduce((sum, d) => sum + d.disposition.inVesselLiters, 0),
          totalPackagedLiters: dispositions.reduce((sum, d) => sum + d.disposition.packagedLiters, 0),
          totalLostLiters: dispositions.reduce((sum, d) => sum + d.disposition.lostLiters, 0),
          totalTransferredOutLiters: dispositions.reduce((sum, d) => sum + d.disposition.transferredOutLiters, 0),
        },
      };
    }),

  // ============================================
  // PHYSICAL INVENTORY ENDPOINTS
  // ============================================

  /**
   * Get vessels with their book inventory for physical counting.
   */
  getVesselsForPhysicalCount: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid().optional(),
        includeEmpty: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const { includeEmpty } = input;

      // Get all vessels with their current batch volumes
      const vesselsWithBatches = await db
        .select({
          vesselId: vessels.id,
          vesselName: vessels.name,
          vesselCapacity: vessels.capacity,
          vesselMaterial: vessels.material,
          batchId: batches.id,
          batchName: batches.name,
          batchProductType: batches.productType,
          batchCurrentVolumeLiters: batches.currentVolumeLiters,
        })
        .from(vessels)
        .leftJoin(
          batches,
          and(
            eq(batches.vesselId, vessels.id),
            eq(batches.isArchived, false),
            isNull(batches.deletedAt)
          )
        )
        .where(isNull(vessels.deletedAt))
        .orderBy(asc(vessels.name));

      // Group by vessel and calculate total book volume
      const vesselMap = new Map<
        string,
        {
          vesselId: string;
          vesselName: string;
          vesselCapacity: number | null;
          vesselMaterial: string | null;
          bookVolumeLiters: number;
          batches: Array<{
            id: string;
            name: string;
            productType: string;
            volumeLiters: number;
          }>;
        }
      >();

      for (const row of vesselsWithBatches) {
        if (!vesselMap.has(row.vesselId)) {
          vesselMap.set(row.vesselId, {
            vesselId: row.vesselId,
            vesselName: row.vesselName || "Unknown",
            vesselCapacity: row.vesselCapacity ? parseFloat(String(row.vesselCapacity)) : null,
            vesselMaterial: row.vesselMaterial,
            bookVolumeLiters: 0,
            batches: [],
          });
        }

        if (row.batchId) {
          const vessel = vesselMap.get(row.vesselId)!;
          const volumeLiters = parseFloat(row.batchCurrentVolumeLiters || "0");
          vessel.bookVolumeLiters += volumeLiters;
          vessel.batches.push({
            id: row.batchId,
            name: row.batchName || "Unknown",
            productType: row.batchProductType || "cider",
            volumeLiters,
          });
        }
      }

      // Convert to array and optionally filter empty vessels
      let result = Array.from(vesselMap.values());
      if (!includeEmpty) {
        result = result.filter((v) => v.bookVolumeLiters > 0);
      }

      return {
        vessels: result,
        summary: {
          totalVessels: result.length,
          totalBookVolumeLiters: result.reduce((sum, v) => sum + v.bookVolumeLiters, 0),
          vesselsWithInventory: result.filter((v) => v.bookVolumeLiters > 0).length,
        },
      };
    }),

  /**
   * Save a physical inventory count for a vessel.
   */
  savePhysicalInventoryCount: adminProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
        vesselId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        physicalVolumeLiters: z.number().min(0),
        measurementMethod: z.enum(["dipstick", "sight_glass", "flowmeter", "estimated", "weighed"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        reconciliationSnapshotId,
        vesselId,
        batchId,
        physicalVolumeLiters,
        measurementMethod,
        notes,
      } = input;

      // Get book volume for the vessel
      const vesselBatches = await db
        .select({
          batchId: batches.id,
          volumeLiters: batches.currentVolumeLiters,
        })
        .from(batches)
        .where(
          and(
            eq(batches.vesselId, vesselId),
            eq(batches.isArchived, false),
            isNull(batches.deletedAt)
          )
        );

      const bookVolumeLiters = vesselBatches.reduce(
        (sum, b) => sum + parseFloat(b.volumeLiters || "0"),
        0
      );

      // Calculate variance
      const varianceLiters = physicalVolumeLiters - bookVolumeLiters;
      const variancePercentage = bookVolumeLiters > 0
        ? (varianceLiters / bookVolumeLiters) * 100
        : 0;

      // Check if a count already exists for this vessel/reconciliation
      const [existingCount] = await db
        .select()
        .from(physicalInventoryCounts)
        .where(
          and(
            eq(physicalInventoryCounts.reconciliationSnapshotId, reconciliationSnapshotId),
            eq(physicalInventoryCounts.vesselId, vesselId)
          )
        );

      let result;
      if (existingCount) {
        // Update existing count
        [result] = await db
          .update(physicalInventoryCounts)
          .set({
            batchId: batchId || (vesselBatches.length === 1 ? vesselBatches[0].batchId : null),
            bookVolumeLiters: String(bookVolumeLiters),
            physicalVolumeLiters: String(physicalVolumeLiters),
            varianceLiters: String(varianceLiters),
            variancePercentage: String(variancePercentage),
            countedAt: new Date(),
            countedBy: ctx.session.user.id,
            measurementMethod: measurementMethod || null,
            notes,
            updatedAt: new Date(),
          })
          .where(eq(physicalInventoryCounts.id, existingCount.id))
          .returning();
      } else {
        // Create new count
        [result] = await db
          .insert(physicalInventoryCounts)
          .values({
            reconciliationSnapshotId,
            vesselId,
            batchId: batchId || (vesselBatches.length === 1 ? vesselBatches[0].batchId : null),
            bookVolumeLiters: String(bookVolumeLiters),
            physicalVolumeLiters: String(physicalVolumeLiters),
            varianceLiters: String(varianceLiters),
            variancePercentage: String(variancePercentage),
            countedAt: new Date(),
            countedBy: ctx.session.user.id,
            measurementMethod: measurementMethod || null,
            notes,
          })
          .returning();
      }

      return {
        count: result,
        bookVolumeLiters,
        varianceLiters,
        variancePercentage,
      };
    }),

  /**
   * Get summary of all physical inventory counts for a reconciliation.
   */
  getPhysicalInventorySummary: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const { reconciliationSnapshotId } = input;

      const counts = await db
        .select({
          id: physicalInventoryCounts.id,
          vesselId: physicalInventoryCounts.vesselId,
          vesselName: vessels.name,
          batchId: physicalInventoryCounts.batchId,
          batchName: batches.name,
          bookVolumeLiters: physicalInventoryCounts.bookVolumeLiters,
          physicalVolumeLiters: physicalInventoryCounts.physicalVolumeLiters,
          varianceLiters: physicalInventoryCounts.varianceLiters,
          variancePercentage: physicalInventoryCounts.variancePercentage,
          countedAt: physicalInventoryCounts.countedAt,
          measurementMethod: physicalInventoryCounts.measurementMethod,
          notes: physicalInventoryCounts.notes,
        })
        .from(physicalInventoryCounts)
        .leftJoin(vessels, eq(physicalInventoryCounts.vesselId, vessels.id))
        .leftJoin(batches, eq(physicalInventoryCounts.batchId, batches.id))
        .where(eq(physicalInventoryCounts.reconciliationSnapshotId, reconciliationSnapshotId))
        .orderBy(asc(vessels.name));

      const totalBookLiters = counts.reduce(
        (sum, c) => sum + parseFloat(c.bookVolumeLiters || "0"),
        0
      );
      const totalPhysicalLiters = counts.reduce(
        (sum, c) => sum + parseFloat(c.physicalVolumeLiters || "0"),
        0
      );
      const totalVarianceLiters = totalPhysicalLiters - totalBookLiters;

      // Find counts with significant variance (> 2%)
      const significantVariances = counts.filter(
        (c) => Math.abs(parseFloat(c.variancePercentage || "0")) > 2
      );

      return {
        counts: counts.map((c) => ({
          ...c,
          bookVolumeLiters: parseFloat(c.bookVolumeLiters || "0"),
          physicalVolumeLiters: parseFloat(c.physicalVolumeLiters || "0"),
          varianceLiters: parseFloat(c.varianceLiters || "0"),
          variancePercentage: parseFloat(c.variancePercentage || "0"),
        })),
        summary: {
          totalCounts: counts.length,
          totalBookLiters,
          totalPhysicalLiters,
          totalVarianceLiters,
          overallVariancePercentage: totalBookLiters > 0
            ? (totalVarianceLiters / totalBookLiters) * 100
            : 0,
          significantVarianceCount: significantVariances.length,
        },
      };
    }),

  // ============================================
  // RECONCILIATION ADJUSTMENT ENDPOINTS
  // ============================================

  /**
   * Create a reconciliation adjustment with reason code.
   */
  createReconciliationAdjustment: adminProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        vesselId: z.string().uuid().optional(),
        physicalCountId: z.string().uuid().optional(),
        adjustmentType: z.enum([
          "evaporation",
          "measurement_error",
          "sampling",
          "contamination",
          "spillage",
          "theft",
          "correction_up",
          "correction_down",
          "other",
        ]),
        volumeBeforeLiters: z.number(),
        volumeAfterLiters: z.number(),
        reason: z.string().min(1),
        notes: z.string().optional(),
        applyToBatch: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        reconciliationSnapshotId,
        batchId,
        vesselId,
        physicalCountId,
        adjustmentType,
        volumeBeforeLiters,
        volumeAfterLiters,
        reason,
        notes,
        applyToBatch,
      } = input;

      const adjustmentLiters = volumeAfterLiters - volumeBeforeLiters;
      let batchVolumeAdjustmentId: string | null = null;
      let appliedToBatchId: string | null = null;

      // If applying to batch, create a batch_volume_adjustment
      if (applyToBatch && batchId) {
        // Get current batch volume
        const [batch] = await db
          .select({
            currentVolumeLiters: batches.currentVolumeLiters,
          })
          .from(batches)
          .where(eq(batches.id, batchId));

        if (batch) {
          const currentVolume = parseFloat(batch.currentVolumeLiters || "0");
          const newVolume = currentVolume + adjustmentLiters;

          // Create batch volume adjustment
          const [batchAdj] = await db
            .insert(batchVolumeAdjustments)
            .values({
              batchId,
              adjustmentDate: new Date(),
              adjustmentType: adjustmentType as "evaporation" | "measurement_error" | "sampling" | "contamination" | "spillage" | "theft" | "correction_up" | "correction_down",
              volumeBefore: String(currentVolume),
              volumeAfter: String(Math.max(0, newVolume)),
              adjustmentAmount: String(adjustmentLiters),
              reason: `Reconciliation adjustment: ${reason}`,
              notes: `Adjustment type: ${adjustmentType}. ${notes || ""}`,
              reconciliationSnapshotId,
              adjustedBy: ctx.session.user.id,
            })
            .returning();

          batchVolumeAdjustmentId = batchAdj.id;
          appliedToBatchId = batchId;

          // Update batch current volume
          await db
            .update(batches)
            .set({
              currentVolumeLiters: String(Math.max(0, newVolume)),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, batchId));
        }
      }

      // Create reconciliation adjustment
      const [result] = await db
        .insert(reconciliationAdjustments)
        .values({
          reconciliationSnapshotId,
          batchId,
          vesselId,
          physicalCountId,
          adjustmentType,
          volumeBeforeLiters: String(volumeBeforeLiters),
          volumeAfterLiters: String(volumeAfterLiters),
          adjustmentLiters: String(adjustmentLiters),
          reason,
          notes,
          appliedToBatchId,
          batchVolumeAdjustmentId,
          adjustedBy: ctx.session.user.id,
          adjustedAt: new Date(),
        })
        .returning();

      return {
        adjustment: result,
        appliedToBatch: applyToBatch && batchId,
        batchVolumeAdjustmentId,
      };
    }),

  /**
   * Get all reconciliation adjustments for a snapshot.
   */
  getReconciliationAdjustments: protectedProcedure
    .input(
      z.object({
        reconciliationSnapshotId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const { reconciliationSnapshotId } = input;

      const adjustments = await db
        .select({
          id: reconciliationAdjustments.id,
          batchId: reconciliationAdjustments.batchId,
          batchName: batches.name,
          vesselId: reconciliationAdjustments.vesselId,
          vesselName: vessels.name,
          adjustmentType: reconciliationAdjustments.adjustmentType,
          volumeBeforeLiters: reconciliationAdjustments.volumeBeforeLiters,
          volumeAfterLiters: reconciliationAdjustments.volumeAfterLiters,
          adjustmentLiters: reconciliationAdjustments.adjustmentLiters,
          reason: reconciliationAdjustments.reason,
          notes: reconciliationAdjustments.notes,
          appliedToBatchId: reconciliationAdjustments.appliedToBatchId,
          adjustedAt: reconciliationAdjustments.adjustedAt,
          adjustedByName: users.name,
        })
        .from(reconciliationAdjustments)
        .leftJoin(batches, eq(reconciliationAdjustments.batchId, batches.id))
        .leftJoin(vessels, eq(reconciliationAdjustments.vesselId, vessels.id))
        .leftJoin(users, eq(reconciliationAdjustments.adjustedBy, users.id))
        .where(eq(reconciliationAdjustments.reconciliationSnapshotId, reconciliationSnapshotId))
        .orderBy(desc(reconciliationAdjustments.adjustedAt));

      const totalAdjustmentLiters = adjustments.reduce(
        (sum, a) => sum + parseFloat(a.adjustmentLiters || "0"),
        0
      );

      // Group by adjustment type
      const byType = adjustments.reduce(
        (acc, a) => {
          if (!acc[a.adjustmentType]) {
            acc[a.adjustmentType] = { count: 0, totalLiters: 0 };
          }
          acc[a.adjustmentType].count += 1;
          acc[a.adjustmentType].totalLiters += parseFloat(a.adjustmentLiters || "0");
          return acc;
        },
        {} as Record<string, { count: number; totalLiters: number }>
      );

      return {
        adjustments: adjustments.map((a) => ({
          ...a,
          volumeBeforeLiters: parseFloat(a.volumeBeforeLiters || "0"),
          volumeAfterLiters: parseFloat(a.volumeAfterLiters || "0"),
          adjustmentLiters: parseFloat(a.adjustmentLiters || "0"),
        })),
        summary: {
          totalAdjustments: adjustments.length,
          totalAdjustmentLiters,
          appliedToBatchCount: adjustments.filter((a) => a.appliedToBatchId).length,
          byType,
        },
      };
    }),
});
