import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  db,
  batches,
  vendors,
  batchMeasurements,
  vessels,
} from "db";
import { eq, and, isNull, sql, desc, or, inArray, lt } from "drizzle-orm";

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
   * Returns batches needing measurement, ready for next step, etc.
   */
  getTasks: protectedProcedure
    .input(
      z.object({
        measurementThresholdDays: z.number().default(3),
        limit: z.number().default(10),
      }).optional()
    )
    .query(async ({ input }) => {
      const thresholdDays = input?.measurementThresholdDays ?? 3;
      const limit = input?.limit ?? 10;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

      try {
        // Get active batches with their latest measurement date
        const activeBatches = await db
          .select({
            id: batches.id,
            batchNumber: batches.batchNumber,
            customName: batches.customName,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            startDate: batches.startDate,
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

        // Get latest measurement for each batch
        const tasksNeedingMeasurement: Array<{
          id: string;
          batchNumber: string;
          customName: string | null;
          vesselName: string | null;
          taskType: "measurement_needed";
          daysSinceLastMeasurement: number;
          priority: "high" | "medium" | "low";
        }> = [];

        for (const batch of activeBatches) {
          const latestMeasurement = await db
            .select({
              measurementDate: batchMeasurements.measurementDate,
            })
            .from(batchMeasurements)
            .where(eq(batchMeasurements.batchId, batch.id))
            .orderBy(desc(batchMeasurements.measurementDate))
            .limit(1);

          const lastMeasurementDate = latestMeasurement[0]?.measurementDate;

          // Calculate days since last measurement
          let daysSince = 0;
          if (lastMeasurementDate) {
            daysSince = Math.floor(
              (Date.now() - new Date(lastMeasurementDate).getTime()) /
                (1000 * 60 * 60 * 24)
            );
          } else if (batch.startDate) {
            // No measurements yet, use start date
            daysSince = Math.floor(
              (Date.now() - new Date(batch.startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }

          // Add to tasks if measurement is overdue
          if (daysSince >= thresholdDays) {
            tasksNeedingMeasurement.push({
              id: batch.id,
              batchNumber: batch.batchNumber,
              customName: batch.customName,
              vesselName: batch.vesselName,
              taskType: "measurement_needed",
              daysSinceLastMeasurement: daysSince,
              priority: daysSince >= 7 ? "high" : daysSince >= 5 ? "medium" : "low",
            });
          }
        }

        // Sort by days since last measurement (most overdue first)
        tasksNeedingMeasurement.sort(
          (a, b) => b.daysSinceLastMeasurement - a.daysSinceLastMeasurement
        );

        return {
          tasks: tasksNeedingMeasurement.slice(0, limit),
          totalCount: tasksNeedingMeasurement.length,
        };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        throw error;
      }
    }),
});
