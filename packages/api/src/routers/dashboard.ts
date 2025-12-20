import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  db,
  batches,
  vendors,
  batchMeasurements,
  vessels,
  organizationSettings,
} from "db";
import { eq, and, isNull, sql, desc, or, inArray, lt } from "drizzle-orm";
import {
  analyzeFermentationProgress,
  getRecommendedMeasurementFrequency,
  type FermentationMeasurement,
  type StageThresholds,
  type StallSettings,
} from "lib";

/**
 * Dashboard Router
 * Provides aggregated statistics and overview data for the dashboard
 */
export const dashboardRouter = router({
  /**
   * Get dashboard statistics
   * Returns counts and aggregated data for the main dashboard view
   */
  getStats: protectedProcedure.query(async () => {
    try {
      // Get in-progress batches count (fermentation, aging, conditioning)
      const activeBatchesResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(batches)
        .where(
          and(
            inArray(batches.status, ["fermentation", "aging", "conditioning"]),
            isNull(batches.deletedAt)
          )
        );
      const activeBatches = activeBatchesResult[0]?.count || 0;

      // Get total bottles ready (packaged inventory)
      // DROPPED TABLE: inventory table no longer exists
      // const bottlesReadyResult = await db
      //   .select({ total: sql<number>`COALESCE(SUM(quantity)::int, 0)` })
      //   .from(inventory)
      //   .where(
      //     and(
      //       isNull(inventory.deletedAt),
      //       sql`quantity > 0`
      //     )
      //   );
      const bottlesReady = 0; // TODO: Implement when inventory system is ready

      // Get active vendors count
      const activeVendorsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vendors)
        .where(
          and(
            eq(vendors.isActive, true),
            isNull(vendors.deletedAt)
          )
        );
      const activeVendors = activeVendorsResult[0]?.count || 0;

      // Get all batches count for comparison
      const allBatchesResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(batches)
        .where(isNull(batches.deletedAt));
      const allBatches = allBatchesResult[0]?.count || 0;

      // Get conditioning batches count for comparison
      const packagedBatchesResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(batches)
        .where(
          and(
            eq(batches.status, "conditioning"),
            isNull(batches.deletedAt)
          )
        );
      const packagedBatches = packagedBatchesResult[0]?.count || 0;

      return {
        activeBatches: {
          count: activeBatches,
          total: allBatches,
        },
        bottlesReady: {
          count: bottlesReady,
        },
        activeVendors: {
          count: activeVendors,
        },
        packagedBatches: {
          count: packagedBatches,
        },
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  }),

  /**
   * Get recent active batches with their latest measurements
   * Returns up to 10 most recently active batches with status and ABV
   */
  getRecentBatches: protectedProcedure.query(async () => {
    try {
      const recentBatches = await db
        .select({
          id: batches.id,
          batchNumber: batches.batchNumber,
          customName: batches.customName,
          status: batches.status,
          startDate: batches.startDate,
          vesselId: batches.vesselId,
          vesselName: vessels.name,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            isNull(batches.deletedAt),
            inArray(batches.status, ["fermentation", "aging", "conditioning"])
          )
        )
        .orderBy(desc(batches.startDate))
        .limit(10);

      // Get latest measurements for each batch
      const batchesWithMeasurements = await Promise.all(
        recentBatches.map(async (batch) => {
          const latestMeasurement = await db
            .select({
              abv: batchMeasurements.abv,
              specificGravity: batchMeasurements.specificGravity,
              measurementDate: batchMeasurements.measurementDate,
            })
            .from(batchMeasurements)
            .where(eq(batchMeasurements.batchId, batch.id))
            .orderBy(desc(batchMeasurements.measurementDate))
            .limit(1);

          const measurement = latestMeasurement[0];
          const daysActive = batch.startDate
            ? Math.floor(
                (Date.now() - new Date(batch.startDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0;

          return {
            id: batch.id,
            batchNumber: batch.batchNumber,
            customName: batch.customName,
            status: batch.status,
            vesselName: batch.vesselName,
            abv: measurement?.abv ? Number(measurement.abv).toFixed(1) : null,
            specificGravity: measurement?.specificGravity
              ? Number(measurement.specificGravity).toFixed(3)
              : null,
            daysActive,
            startDate: batch.startDate,
          };
        })
      );

      return {
        batches: batchesWithMeasurements,
      };
    } catch (error) {
      console.error("Error fetching recent batches:", error);
      throw error;
    }
  }),

  /**
   * Get actionable tasks for the dashboard
   * Uses SG-based fermentation stage tracking instead of arbitrary day thresholds
   * Returns batches needing measurement based on fermentation stage, stalled fermentations, etc.
   */
  getTasks: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(10),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 10;

      try {
        // Get organization settings for fermentation thresholds
        const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
        const [settings] = await db
          .select({
            fermentationStageEarlyMax: organizationSettings.fermentationStageEarlyMax,
            fermentationStageMidMax: organizationSettings.fermentationStageMidMax,
            fermentationStageApproachingDryMax: organizationSettings.fermentationStageApproachingDryMax,
            stallDetectionEnabled: organizationSettings.stallDetectionEnabled,
            stallDetectionDays: organizationSettings.stallDetectionDays,
            stallDetectionThreshold: organizationSettings.stallDetectionThreshold,
            terminalConfirmationHours: organizationSettings.terminalConfirmationHours,
            defaultTargetFgDry: organizationSettings.defaultTargetFgDry,
          })
          .from(organizationSettings)
          .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
          .limit(1);

        // Build stage thresholds from settings
        const stageThresholds: StageThresholds = {
          earlyMax: settings?.fermentationStageEarlyMax ?? 70,
          midMax: settings?.fermentationStageMidMax ?? 90,
          approachingDryMax: settings?.fermentationStageApproachingDryMax ?? 98,
        };

        // Build stall settings from settings
        const stallSettings: StallSettings = {
          enabled: settings?.stallDetectionEnabled ?? true,
          days: settings?.stallDetectionDays ?? 3,
          threshold: settings?.stallDetectionThreshold
            ? parseFloat(settings.stallDetectionThreshold)
            : 0.001,
        };

        const terminalConfirmationHours = settings?.terminalConfirmationHours ?? 48;
        const defaultTargetFg = settings?.defaultTargetFgDry
          ? parseFloat(settings.defaultTargetFgDry)
          : 0.998;

        // Get active batches with their gravity data
        const activeBatches = await db
          .select({
            id: batches.id,
            batchNumber: batches.batchNumber,
            customName: batches.customName,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            startDate: batches.startDate,
            originalGravity: batches.originalGravity,
            targetFinalGravity: batches.targetFinalGravity,
            fermentationStage: batches.fermentationStage,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(
            and(
              isNull(batches.deletedAt),
              inArray(batches.status, ["fermentation", "aging", "conditioning"])
            )
          )
          .orderBy(desc(batches.startDate));

        // Build task list based on fermentation progress
        const tasks: Array<{
          id: string;
          batchNumber: string;
          customName: string | null;
          vesselName: string | null;
          taskType: "measurement_needed" | "stalled_fermentation" | "confirm_terminal";
          daysSinceLastMeasurement: number;
          priority: "high" | "medium" | "low";
          percentFermented: number;
          fermentationStage: string;
          recommendedAction: string;
        }> = [];

        for (const batch of activeBatches) {
          // Get all measurements for this batch
          const measurements = await db
            .select({
              specificGravity: batchMeasurements.specificGravity,
              measurementDate: batchMeasurements.measurementDate,
              measurementMethod: batchMeasurements.measurementMethod,
            })
            .from(batchMeasurements)
            .where(
              and(
                eq(batchMeasurements.batchId, batch.id),
                isNull(batchMeasurements.deletedAt)
              )
            )
            .orderBy(desc(batchMeasurements.measurementDate));

          // Convert to FermentationMeasurement format
          const fermentationMeasurements: FermentationMeasurement[] = measurements
            .filter(m => m.specificGravity !== null)
            .map(m => ({
              specificGravity: parseFloat(m.specificGravity!),
              measurementDate: new Date(m.measurementDate),
              method: (m.measurementMethod as "hydrometer" | "refractometer" | "calculated") || "hydrometer",
            }));

          // Get gravity values
          const originalGravity = batch.originalGravity
            ? parseFloat(batch.originalGravity)
            : null;
          const currentSg = fermentationMeasurements.length > 0
            ? fermentationMeasurements[0].specificGravity
            : null;
          const targetFinalGravity = batch.targetFinalGravity
            ? parseFloat(batch.targetFinalGravity)
            : defaultTargetFg;

          // Analyze fermentation progress
          const progress = analyzeFermentationProgress({
            originalGravity,
            currentGravity: currentSg,
            targetFinalGravity,
            measurements: fermentationMeasurements,
            stageThresholds,
            stallSettings,
            terminalConfirmationHours,
          });

          // Determine if this batch needs attention
          const frequency = getRecommendedMeasurementFrequency(progress.stage);
          const measurementDue = progress.daysSinceLastMeasurement >= frequency.maxDays;
          const isVeryOverdue = progress.daysSinceLastMeasurement >= frequency.maxDays * 2;

          // Add to tasks based on conditions
          if (progress.isStalled) {
            // Stalled fermentation is always high priority
            tasks.push({
              id: batch.id,
              batchNumber: batch.batchNumber,
              customName: batch.customName,
              vesselName: batch.vesselName,
              taskType: "stalled_fermentation",
              daysSinceLastMeasurement: progress.daysSinceLastMeasurement,
              priority: "high",
              percentFermented: progress.percentFermented,
              fermentationStage: progress.stage,
              recommendedAction: progress.recommendedAction,
            });
          } else if (progress.stage === "terminal" && !progress.isTerminalConfirmed) {
            // Terminal but needs confirmation
            tasks.push({
              id: batch.id,
              batchNumber: batch.batchNumber,
              customName: batch.customName,
              vesselName: batch.vesselName,
              taskType: "confirm_terminal",
              daysSinceLastMeasurement: progress.daysSinceLastMeasurement,
              priority: "medium",
              percentFermented: progress.percentFermented,
              fermentationStage: progress.stage,
              recommendedAction: progress.recommendedAction,
            });
          } else if (measurementDue) {
            // Measurement is due based on stage
            tasks.push({
              id: batch.id,
              batchNumber: batch.batchNumber,
              customName: batch.customName,
              vesselName: batch.vesselName,
              taskType: "measurement_needed",
              daysSinceLastMeasurement: progress.daysSinceLastMeasurement,
              priority: isVeryOverdue ? "high" : "medium",
              percentFermented: progress.percentFermented,
              fermentationStage: progress.stage,
              recommendedAction: progress.recommendedAction,
            });
          }
        }

        // Sort by priority (high first), then by days since last measurement
        tasks.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return b.daysSinceLastMeasurement - a.daysSinceLastMeasurement;
        });

        return {
          tasks: tasks.slice(0, limit),
          totalCount: tasks.length,
        };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        throw error;
      }
    }),
});
