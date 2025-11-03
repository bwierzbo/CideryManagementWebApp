import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  basefruitPurchases,
  basefruitPurchaseItems,
  juicePurchases,
  juicePurchaseItems,
  additivePurchases,
  packagingPurchases,
  pressRuns,
  batches,
  batchMeasurements,
  batchTransfers,
  batchAdditives,
  vesselCleaningOperations,
  vendors,
  baseFruitVarieties,
  vessels,
  users,
} from "db";
import { eq, and, desc, asc, sql, isNull, gte, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { batchCarbonationOperations } from "db/src/schema/carbonation";
import { bottleRuns } from "db/src/schema/packaging";

/**
 * Activity Register Router
 * Provides a unified view of all activities across the system
 */
export const activityRegisterRouter = router({
  /**
   * List all activities across the system
   * Returns a unified view of purchases, pressing, cellar operations, packaging, and vessel operations
   */
  listActivities: createRbacProcedure("list", "activity")
    .input(
      z.object({
        limit: z.number().int().positive().max(500).default(100),
        offset: z.number().int().min(0).default(0),
        category: z
          .enum(["all", "purchases", "pressing", "cellar", "packaging", "vessels"])
          .default("all"),
        startDate: z
          .date()
          .or(z.string().transform((val) => new Date(val)))
          .optional(),
        endDate: z
          .date()
          .or(z.string().transform((val) => new Date(val)))
          .optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { limit, offset, category, startDate, endDate, sortOrder } = input;

        // Build date filter conditions
        const dateConditions = [];
        if (startDate) {
          dateConditions.push(sql`activity_date >= ${startDate.toISOString()}`);
        }
        if (endDate) {
          dateConditions.push(sql`activity_date <= ${endDate.toISOString()}`);
        }
        const dateFilter =
          dateConditions.length > 0
            ? sql`AND ${sql.join(dateConditions, sql` AND `)}`
            : sql``;

        // Build category filter
        let categoryFilter = sql``;
        if (category !== "all") {
          categoryFilter = sql`WHERE category = ${category}`;
        }

        // Query to get all activities
        const activitiesQuery = sql`
          WITH all_activities AS (
            -- Base Fruit Purchases
            SELECT
              bfp.id::text as id,
              'purchase' as type,
              'purchases' as category,
              bfp.purchase_date as activity_date,
              'Base Fruit Purchase' as activity_type,
              v.name as vendor_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', bfp.total_cost,
                'notes', bfp.notes
              ) as metadata
            FROM basefruit_purchases bfp
            LEFT JOIN vendors v ON bfp.vendor_id = v.id
            WHERE bfp.deleted_at IS NULL

            UNION ALL

            -- Juice Purchases
            SELECT
              jp.id::text as id,
              'purchase' as type,
              'purchases' as category,
              jp.purchase_date as activity_date,
              'Juice Purchase' as activity_type,
              v.name as vendor_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', jp.total_cost,
                'notes', jp.notes
              ) as metadata
            FROM juice_purchases jp
            LEFT JOIN vendors v ON jp.vendor_id = v.id
            WHERE jp.deleted_at IS NULL

            UNION ALL

            -- Additive Purchases
            SELECT
              ap.id::text as id,
              'purchase' as type,
              'purchases' as category,
              ap.purchase_date as activity_date,
              'Additive Purchase' as activity_type,
              v.name as vendor_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', ap.total_cost,
                'notes', ap.notes
              ) as metadata
            FROM additive_purchases ap
            LEFT JOIN vendors v ON ap.vendor_id = v.id
            WHERE ap.deleted_at IS NULL

            UNION ALL

            -- Packaging Purchases
            SELECT
              pp.id::text as id,
              'purchase' as type,
              'purchases' as category,
              pp.purchase_date as activity_date,
              'Packaging Purchase' as activity_type,
              v.name as vendor_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', pp.total_cost,
                'notes', pp.notes
              ) as metadata
            FROM packaging_purchases pp
            LEFT JOIN vendors v ON pp.vendor_id = v.id
            WHERE pp.deleted_at IS NULL

            UNION ALL

            -- Press Runs
            SELECT
              pr.id::text as id,
              'press_run' as type,
              'pressing' as category,
              pr.date_completed as activity_date,
              'Press Run' as activity_type,
              pr.press_run_name as vendor_name,
              jsonb_build_object(
                'runName', pr.press_run_name,
                'totalWeight', pr.total_apple_weight_kg,
                'totalVolume', pr.total_juice_volume,
                'status', pr.status
              ) as metadata
            FROM press_runs pr
            WHERE pr.deleted_at IS NULL
              AND pr.date_completed IS NOT NULL

            UNION ALL

            -- Batch Creation
            SELECT
              b.id::text as id,
              'batch' as type,
              'cellar' as category,
              b.created_at as activity_date,
              'Batch Created' as activity_type,
              b.name as vendor_name,
              jsonb_build_object(
                'batchCode', b.name,
                'batchName', COALESCE(b.custom_name, b.name),
                'targetVolume', b.initial_volume,
                'status', b.status
              ) as metadata
            FROM batches b
            WHERE b.deleted_at IS NULL

            UNION ALL

            -- Batch Measurements
            SELECT
              bm.id::text as id,
              'measurement' as type,
              'cellar' as category,
              bm.measurement_date as activity_date,
              'Batch Measurement' as activity_type,
              b.name as vendor_name,
              jsonb_build_object(
                'batchCode', b.name,
                'specificGravity', bm.specific_gravity,
                'abv', bm.abv,
                'ph', bm.ph,
                'temperature', bm.temperature
              ) as metadata
            FROM batch_measurements bm
            LEFT JOIN batches b ON bm.batch_id = b.id
            WHERE bm.deleted_at IS NULL

            UNION ALL

            -- Batch Transfers
            SELECT
              bt.id::text as id,
              'transfer' as type,
              'cellar' as category,
              bt.transferred_at as activity_date,
              'Batch Transfer' as activity_type,
              b.name as vendor_name,
              jsonb_build_object(
                'sourceBatchCode', b.name,
                'volumeTransferred', bt.volume_transferred,
                'notes', bt.notes
              ) as metadata
            FROM batch_transfers bt
            LEFT JOIN batches b ON bt.source_batch_id = b.id
            WHERE bt.deleted_at IS NULL

            UNION ALL

            -- Batch Additives
            SELECT
              ba.id::text as id,
              'additive' as type,
              'cellar' as category,
              ba.added_at as activity_date,
              'Additive Added' as activity_type,
              b.name as vendor_name,
              jsonb_build_object(
                'batchCode', b.name,
                'additiveName', ba.additive_name,
                'amount', ba.amount,
                'unit', ba.unit
              ) as metadata
            FROM batch_additives ba
            LEFT JOIN batches b ON ba.batch_id = b.id
            WHERE ba.deleted_at IS NULL

            UNION ALL

            -- Carbonation Operations
            SELECT
              bco.id::text as id,
              'carbonation' as type,
              'cellar' as category,
              bco.started_at as activity_date,
              'Carbonation Operation' as activity_type,
              b.name as vendor_name,
              jsonb_build_object(
                'batchCode', b.name,
                'targetVolumes', bco.target_co2_volumes,
                'processType', bco.carbonation_process
              ) as metadata
            FROM batch_carbonation_operations bco
            LEFT JOIN batches b ON bco.batch_id = b.id
            WHERE bco.deleted_at IS NULL

            UNION ALL

            -- Bottle Runs
            SELECT
              br.id::text as id,
              'bottle_run' as type,
              'packaging' as category,
              br.packaged_at as activity_date,
              'Bottle Run' as activity_type,
              b.name as vendor_name,
              jsonb_build_object(
                'batchCode', b.name,
                'totalBottles', br.units_produced,
                'status', br.status
              ) as metadata
            FROM bottle_runs br
            LEFT JOIN batches b ON br.batch_id = b.id
            WHERE br.status = 'completed'

            UNION ALL

            -- Vessel Cleaning
            SELECT
              vco.id::text as id,
              'cleaning' as type,
              'vessels' as category,
              vco.cleaned_at as activity_date,
              'Vessel Cleaning' as activity_type,
              v.name as vendor_name,
              jsonb_build_object(
                'vesselName', v.name,
                'cleaningType', vco.cleaning_type,
                'notes', vco.notes
              ) as metadata
            FROM vessel_cleaning_operations vco
            LEFT JOIN vessels v ON vco.vessel_id = v.id
            WHERE vco.deleted_at IS NULL
          )
          SELECT *
          FROM all_activities
          ${categoryFilter}
          ${dateFilter}
          ORDER BY activity_date ${sortOrder === "desc" ? sql`DESC` : sql`ASC`}
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const activities = await db.execute(activitiesQuery);

        // Get total count for pagination
        const countQuery = sql`
          WITH all_activities AS (
            SELECT bfp.id, bfp.purchase_date as activity_date, 'purchases' as category
            FROM basefruit_purchases bfp WHERE bfp.deleted_at IS NULL
            UNION ALL
            SELECT jp.id, jp.purchase_date as activity_date, 'purchases' as category
            FROM juice_purchases jp WHERE jp.deleted_at IS NULL
            UNION ALL
            SELECT ap.id, ap.purchase_date as activity_date, 'purchases' as category
            FROM additive_purchases ap WHERE ap.deleted_at IS NULL
            UNION ALL
            SELECT pp.id, pp.purchase_date as activity_date, 'purchases' as category
            FROM packaging_purchases pp WHERE pp.deleted_at IS NULL
            UNION ALL
            SELECT pr.id, pr.date_completed as activity_date, 'pressing' as category
            FROM press_runs pr WHERE pr.deleted_at IS NULL AND pr.date_completed IS NOT NULL
            UNION ALL
            SELECT b.id, b.created_at as activity_date, 'cellar' as category
            FROM batches b WHERE b.deleted_at IS NULL
            UNION ALL
            SELECT bm.id, bm.measurement_date as activity_date, 'cellar' as category
            FROM batch_measurements bm WHERE bm.deleted_at IS NULL
            UNION ALL
            SELECT bt.id, bt.transferred_at as activity_date, 'cellar' as category
            FROM batch_transfers bt WHERE bt.deleted_at IS NULL
            UNION ALL
            SELECT ba.id, ba.added_at as activity_date, 'cellar' as category
            FROM batch_additives ba WHERE ba.deleted_at IS NULL
            UNION ALL
            SELECT bco.id, bco.started_at as activity_date, 'cellar' as category
            FROM batch_carbonation_operations bco WHERE bco.deleted_at IS NULL
            UNION ALL
            SELECT br.id, br.packaged_at as activity_date, 'packaging' as category
            FROM bottle_runs br WHERE br.status = 'completed'
            UNION ALL
            SELECT vco.id, vco.cleaned_at as activity_date, 'vessels' as category
            FROM vessel_cleaning_operations vco WHERE vco.deleted_at IS NULL
          )
          SELECT COUNT(*)::int as count
          FROM all_activities
          ${categoryFilter}
          ${dateFilter}
        `;

        const countResult = await db.execute(countQuery);
        const totalCount = (countResult.rows[0] as any)?.count || 0;

        return {
          activities: activities.rows,
          pagination: {
            total: totalCount,
            offset,
            limit,
            hasMore: totalCount > offset + limit,
          },
        };
      } catch (error) {
        console.error("Error fetching activity register:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch activity register",
        });
      }
    }),
});
