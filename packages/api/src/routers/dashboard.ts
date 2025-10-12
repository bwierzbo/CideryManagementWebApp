import { router, protectedProcedure } from "../trpc";
import {
  db,
  batches,
  vendors,
  batchMeasurements,
  vessels,
} from "db";
import { eq, and, isNull, sql, desc, or, inArray } from "drizzle-orm";

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
});
