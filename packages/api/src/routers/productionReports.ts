import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  pressRuns,
  pressRunLoads,
  batches,
  baseFruitVarieties,
} from "db";
import { eq, and, gte, lte, isNull, sql, desc } from "drizzle-orm";

// Input schema for date range queries
const dateRangeInput = z.object({
  startDate: z.date().or(z.string().transform((str) => new Date(str))),
  endDate: z.date().or(z.string().transform((str) => new Date(str))),
});

export const productionReportsRouter = router({
  /**
   * Get yield analysis from press runs
   * Shows fruit weight → juice volume conversion and extraction rates
   */
  getYieldAnalysis: createRbacProcedure("read", "batch")
    .input(dateRangeInput)
    .query(async ({ input }) => {
      // Get completed press runs in date range
      const pressRunsData = await db
        .select({
          pressRunId: pressRuns.id,
          pressRunName: pressRuns.pressRunName,
          dateCompleted: pressRuns.dateCompleted,
          totalAppleWeightKg: pressRuns.totalAppleWeightKg,
          totalJuiceVolumeLiters: pressRuns.totalJuiceVolumeLiters,
          extractionRate: pressRuns.extractionRate,
          status: pressRuns.status,
        })
        .from(pressRuns)
        .where(
          and(
            gte(pressRuns.dateCompleted, input.startDate.toISOString().split("T")[0]),
            lte(pressRuns.dateCompleted, input.endDate.toISOString().split("T")[0]),
            isNull(pressRuns.deletedAt),
            eq(pressRuns.status, "completed")
          )
        )
        .orderBy(desc(pressRuns.dateCompleted));

      // Get variety breakdown from press run loads
      const varietyBreakdownRaw = await db
        .select({
          varietyId: baseFruitVarieties.id,
          varietyName: baseFruitVarieties.name,
          totalWeightKg: sql<number>`SUM(${pressRunLoads.appleWeightKg})`.as("totalWeightKg"),
          totalJuiceL: sql<number>`SUM(${pressRunLoads.juiceVolume})`.as("totalJuiceL"),
          loadCount: sql<number>`COUNT(*)`.as("loadCount"),
        })
        .from(pressRunLoads)
        .innerJoin(pressRuns, eq(pressRunLoads.pressRunId, pressRuns.id))
        .innerJoin(baseFruitVarieties, eq(pressRunLoads.fruitVarietyId, baseFruitVarieties.id))
        .where(
          and(
            gte(pressRuns.dateCompleted, input.startDate.toISOString().split("T")[0]),
            lte(pressRuns.dateCompleted, input.endDate.toISOString().split("T")[0]),
            isNull(pressRuns.deletedAt),
            isNull(pressRunLoads.deletedAt),
            eq(pressRuns.status, "completed")
          )
        )
        .groupBy(baseFruitVarieties.id, baseFruitVarieties.name)
        .orderBy(desc(sql`SUM(${pressRunLoads.appleWeightKg})`));

      // Calculate summary totals
      let totalFruitKg = 0;
      let totalJuiceL = 0;

      pressRunsData.forEach((run) => {
        if (run.totalAppleWeightKg) {
          totalFruitKg += parseFloat(run.totalAppleWeightKg.toString());
        }
        if (run.totalJuiceVolumeLiters) {
          totalJuiceL += parseFloat(run.totalJuiceVolumeLiters.toString());
        }
      });

      // Calculate average extraction rate
      const avgExtractionRate = totalFruitKg > 0 ? (totalJuiceL / totalFruitKg) * 100 : 0;

      // Format variety breakdown
      const byVariety = varietyBreakdownRaw.map((row) => {
        const weightKg = row.totalWeightKg || 0;
        const juiceL = row.totalJuiceL || 0;
        return {
          varietyId: row.varietyId,
          varietyName: row.varietyName || "Unknown",
          fruitKg: weightKg,
          juiceL: juiceL,
          extractionRate: weightKg > 0 ? (juiceL / weightKg) * 100 : 0,
          loadCount: row.loadCount || 0,
        };
      });

      return {
        summary: {
          totalFruitKg,
          totalJuiceL,
          avgExtractionRate,
          pressRunCount: pressRunsData.length,
        },
        byVariety,
        pressRuns: pressRunsData.map((run) => ({
          id: run.pressRunId,
          name: run.pressRunName,
          date: run.dateCompleted,
          fruitKg: run.totalAppleWeightKg ? parseFloat(run.totalAppleWeightKg.toString()) : 0,
          juiceL: run.totalJuiceVolumeLiters ? parseFloat(run.totalJuiceVolumeLiters.toString()) : 0,
          extractionRate: run.extractionRate ? parseFloat(run.extractionRate.toString()) * 100 : 0,
        })),
      };
    }),

  /**
   * Get fermentation metrics from batches
   * Shows SG progression, time to completion, stage distribution
   */
  getFermentationMetrics: createRbacProcedure("read", "batch")
    .input(dateRangeInput)
    .query(async ({ input }) => {
      // Get batches started in date range
      const batchesData = await db
        .select({
          id: batches.id,
          name: batches.name,
          customName: batches.customName,
          batchNumber: batches.batchNumber,
          startDate: batches.startDate,
          endDate: batches.endDate,
          originalGravity: batches.originalGravity,
          finalGravity: batches.finalGravity,
          fermentationStage: batches.fermentationStage,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          status: batches.status,
        })
        .from(batches)
        .where(
          and(
            gte(batches.startDate, input.startDate),
            lte(batches.startDate, input.endDate),
            isNull(batches.deletedAt)
          )
        )
        .orderBy(desc(batches.startDate));

      // Calculate summary metrics
      let batchesStarted = batchesData.length;
      let batchesCompleted = 0;
      let totalDaysToTerminal = 0;
      let terminalBatchCount = 0;
      let totalOriginalGravity = 0;
      let ogCount = 0;
      let totalFinalGravity = 0;
      let fgCount = 0;

      // Stage distribution
      const stageDistribution: Record<string, number> = {
        early: 0,
        mid: 0,
        approaching_dry: 0,
        terminal: 0,
        unknown: 0,
      };

      const now = new Date();

      const batchDetails = batchesData.map((batch) => {
        // Count completed batches
        if (batch.status === "completed" || batch.fermentationStage === "terminal") {
          batchesCompleted++;
        }

        // Calculate days to terminal
        if (batch.fermentationStage === "terminal" && batch.endDate) {
          const startDate = new Date(batch.startDate);
          const endDate = new Date(batch.endDate);
          const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          totalDaysToTerminal += days;
          terminalBatchCount++;
        }

        // Accumulate gravity averages
        if (batch.originalGravity) {
          totalOriginalGravity += parseFloat(batch.originalGravity.toString());
          ogCount++;
        }
        if (batch.finalGravity) {
          totalFinalGravity += parseFloat(batch.finalGravity.toString());
          fgCount++;
        }

        // Count stage distribution
        const stage = batch.fermentationStage || "unknown";
        if (stageDistribution[stage] !== undefined) {
          stageDistribution[stage]++;
        } else {
          stageDistribution["unknown"]++;
        }

        // Calculate days active
        const startDate = new Date(batch.startDate);
        const endDate = batch.endDate ? new Date(batch.endDate) : now;
        const daysActive = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: batch.id,
          batchName: batch.customName || batch.name,
          startDate: batch.startDate,
          endDate: batch.endDate,
          originalGravity: batch.originalGravity ? parseFloat(batch.originalGravity.toString()) : null,
          currentGravity: batch.finalGravity ? parseFloat(batch.finalGravity.toString()) : null,
          fermentationStage: batch.fermentationStage || "unknown",
          daysActive,
          status: batch.status,
          volumeL: batch.currentVolumeLiters ? parseFloat(batch.currentVolumeLiters.toString()) : 0,
        };
      });

      return {
        summary: {
          batchesStarted,
          batchesCompleted,
          avgDaysToTerminal: terminalBatchCount > 0 ? Math.round(totalDaysToTerminal / terminalBatchCount) : null,
          avgOriginalGravity: ogCount > 0 ? totalOriginalGravity / ogCount : null,
          avgFinalGravity: fgCount > 0 ? totalFinalGravity / fgCount : null,
        },
        stageDistribution,
        batches: batchDetails,
      };
    }),

  /**
   * Get production summary
   * Shows batches created, volumes, breakdown by status
   */
  getProductionSummary: createRbacProcedure("read", "batch")
    .input(dateRangeInput)
    .query(async ({ input }) => {
      // Get all batches in date range
      const batchesData = await db
        .select({
          id: batches.id,
          name: batches.name,
          status: batches.status,
          initialVolumeLiters: batches.initialVolumeLiters,
          currentVolumeLiters: batches.currentVolumeLiters,
          productType: batches.productType,
          startDate: batches.startDate,
        })
        .from(batches)
        .where(
          and(
            gte(batches.startDate, input.startDate),
            lte(batches.startDate, input.endDate),
            isNull(batches.deletedAt)
          )
        );

      // Calculate totals
      let totalInitialVolumeL = 0;
      let totalCurrentVolumeL = 0;
      const byProductType: Record<string, { count: number; volumeL: number }> = {};
      const byStatus: Record<string, number> = {};

      batchesData.forEach((batch) => {
        // Volume totals
        if (batch.initialVolumeLiters) {
          totalInitialVolumeL += parseFloat(batch.initialVolumeLiters.toString());
        }
        if (batch.currentVolumeLiters) {
          totalCurrentVolumeL += parseFloat(batch.currentVolumeLiters.toString());
        }

        // By product type
        const productType = batch.productType || "unspecified";
        if (!byProductType[productType]) {
          byProductType[productType] = { count: 0, volumeL: 0 };
        }
        byProductType[productType].count++;
        if (batch.initialVolumeLiters) {
          byProductType[productType].volumeL += parseFloat(batch.initialVolumeLiters.toString());
        }

        // By status
        const status = batch.status || "unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      return {
        summary: {
          batchesCreated: batchesData.length,
          totalInitialVolumeL,
          totalCurrentVolumeL,
          volumeLossL: totalInitialVolumeL - totalCurrentVolumeL,
        },
        byProductType: Object.entries(byProductType).map(([productType, data]) => ({
          productType,
          count: data.count,
          volumeL: data.volumeL,
        })),
        byStatus: Object.entries(byStatus).map(([status, count]) => ({
          status,
          count,
        })),
      };
    }),
});

export type ProductionReportsRouter = typeof productionReportsRouter;
