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
import { bottleRuns, kegFills, kegs } from "db/src/schema/packaging";

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
        operationType: z
          .enum(["all", "creates", "updates", "deletes"])
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
        const { limit, offset, category, operationType, startDate, endDate, sortOrder } = input;

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

        // Build operation type filter
        let operationFilter = sql``;
        if (operationType === "creates") {
          operationFilter = sql`AND operation = 'create'`;
        } else if (operationType === "updates") {
          operationFilter = sql`AND operation = 'update'`;
        } else if (operationType === "deletes") {
          operationFilter = sql`AND operation IN ('delete', 'soft_delete')`;
        }

        // Query to get all activities with user attribution
        const activitiesQuery = sql`
          WITH all_activities AS (
            -- Base Fruit Purchases
            SELECT
              bfp.id::text as id,
              'purchase' as type,
              'purchases' as category,
              'create' as operation,
              bfp.purchase_date as activity_date,
              'Base Fruit Purchase' as activity_type,
              v.name as vendor_name,
              bfp.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', bfp.total_cost,
                'notes', bfp.notes
              ) as metadata
            FROM basefruit_purchases bfp
            LEFT JOIN vendors v ON bfp.vendor_id = v.id
            LEFT JOIN users u ON bfp.created_by = u.id
            WHERE bfp.deleted_at IS NULL

            UNION ALL

            -- Juice Purchases
            SELECT
              jp.id::text as id,
              'purchase' as type,
              'purchases' as category,
              'create' as operation,
              jp.purchase_date as activity_date,
              'Juice Purchase' as activity_type,
              v.name as vendor_name,
              jp.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', jp.total_cost,
                'notes', jp.notes
              ) as metadata
            FROM juice_purchases jp
            LEFT JOIN vendors v ON jp.vendor_id = v.id
            LEFT JOIN users u ON jp.created_by = u.id
            WHERE jp.deleted_at IS NULL

            UNION ALL

            -- Additive Purchases
            SELECT
              ap.id::text as id,
              'purchase' as type,
              'purchases' as category,
              'create' as operation,
              ap.purchase_date as activity_date,
              'Additive Purchase' as activity_type,
              v.name as vendor_name,
              ap.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', ap.total_cost,
                'notes', ap.notes
              ) as metadata
            FROM additive_purchases ap
            LEFT JOIN vendors v ON ap.vendor_id = v.id
            LEFT JOIN users u ON ap.created_by = u.id
            WHERE ap.deleted_at IS NULL

            UNION ALL

            -- Packaging Purchases
            SELECT
              pp.id::text as id,
              'purchase' as type,
              'purchases' as category,
              'create' as operation,
              pp.purchase_date as activity_date,
              'Packaging Purchase' as activity_type,
              v.name as vendor_name,
              pp.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'vendorName', v.name,
                'totalCost', pp.total_cost,
                'notes', pp.notes
              ) as metadata
            FROM packaging_purchases pp
            LEFT JOIN vendors v ON pp.vendor_id = v.id
            LEFT JOIN users u ON pp.created_by = u.id
            WHERE pp.deleted_at IS NULL

            UNION ALL

            -- Press Runs
            SELECT
              pr.id::text as id,
              'press_run' as type,
              'pressing' as category,
              'create' as operation,
              pr.date_completed as activity_date,
              'Press Run' as activity_type,
              pr.press_run_name as vendor_name,
              pr.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'runName', pr.press_run_name,
                'totalWeight', pr.total_apple_weight_kg,
                'totalVolume', pr.total_juice_volume,
                'status', pr.status
              ) as metadata
            FROM press_runs pr
            LEFT JOIN users u ON pr.created_by = u.id
            WHERE pr.deleted_at IS NULL
              AND pr.date_completed IS NOT NULL

            UNION ALL

            -- Batch Creation
            SELECT
              b.id::text as id,
              'batch' as type,
              'cellar' as category,
              'create' as operation,
              b.created_at as activity_date,
              'Batch Created' as activity_type,
              b.name as vendor_name,
              b.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'batchCode', b.name,
                'batchName', COALESCE(b.custom_name, b.name),
                'targetVolume', b.initial_volume,
                'status', b.status
              ) as metadata
            FROM batches b
            LEFT JOIN users u ON b.created_by = u.id
            WHERE b.deleted_at IS NULL

            UNION ALL

            -- Batch Measurements
            SELECT
              bm.id::text as id,
              'measurement' as type,
              'cellar' as category,
              'create' as operation,
              bm.measurement_date as activity_date,
              'Batch Measurement' as activity_type,
              b.name as vendor_name,
              NULL::uuid as performed_by_id,
              COALESCE(bm.taken_by, 'Unknown') as performed_by_name,
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
              'create' as operation,
              bt.transferred_at as activity_date,
              'Batch Transfer' as activity_type,
              b.name as vendor_name,
              bt.transferred_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'sourceBatchCode', b.name,
                'volumeTransferred', bt.volume_transferred,
                'notes', bt.notes
              ) as metadata
            FROM batch_transfers bt
            LEFT JOIN batches b ON bt.source_batch_id = b.id
            LEFT JOIN users u ON bt.transferred_by = u.id
            WHERE bt.deleted_at IS NULL

            UNION ALL

            -- Batch Additives
            SELECT
              ba.id::text as id,
              'additive' as type,
              'cellar' as category,
              'create' as operation,
              ba.added_at as activity_date,
              'Additive Added' as activity_type,
              b.name as vendor_name,
              NULL::uuid as performed_by_id,
              COALESCE(ba.added_by, 'Unknown') as performed_by_name,
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
              'create' as operation,
              bco.started_at as activity_date,
              'Carbonation Operation' as activity_type,
              b.name as vendor_name,
              bco.performed_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'batchCode', b.name,
                'targetVolumes', bco.target_co2_volumes,
                'processType', bco.carbonation_process
              ) as metadata
            FROM batch_carbonation_operations bco
            LEFT JOIN batches b ON bco.batch_id = b.id
            LEFT JOIN users u ON bco.performed_by = u.id
            WHERE bco.deleted_at IS NULL

            UNION ALL

            -- Bottle Runs
            SELECT
              br.id::text as id,
              'bottle_run' as type,
              'packaging' as category,
              'create' as operation,
              br.packaged_at as activity_date,
              'Bottle Run' as activity_type,
              b.name as vendor_name,
              br.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'batchCode', b.name,
                'totalBottles', br.units_produced,
                'status', br.status
              ) as metadata
            FROM bottle_runs br
            LEFT JOIN batches b ON br.batch_id = b.id
            LEFT JOIN users u ON br.created_by = u.id
            WHERE br.status = 'completed'

            UNION ALL

            -- Keg Fills
            SELECT
              kf.id::text as id,
              'keg_fill' as type,
              'packaging' as category,
              'create' as operation,
              kf.filled_at as activity_date,
              'Keg Fill' as activity_type,
              b.name as vendor_name,
              kf.created_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'batchCode', b.name,
                'kegNumber', k.keg_number,
                'volumeTaken', kf.volume_taken,
                'volumeUnit', kf.volume_taken_unit,
                'status', kf.status
              ) as metadata
            FROM keg_fills kf
            LEFT JOIN batches b ON kf.batch_id = b.id
            LEFT JOIN kegs k ON kf.keg_id = k.id
            LEFT JOIN users u ON kf.created_by = u.id
            WHERE kf.status != 'voided'

            UNION ALL

            -- Vessel Cleaning
            SELECT
              vco.id::text as id,
              'cleaning' as type,
              'vessels' as category,
              'create' as operation,
              vco.cleaned_at as activity_date,
              'Vessel Cleaning' as activity_type,
              v.name as vendor_name,
              vco.cleaned_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'vesselName', v.name,
                'notes', vco.notes
              ) as metadata
            FROM vessel_cleaning_operations vco
            LEFT JOIN vessels v ON vco.vessel_id = v.id
            LEFT JOIN users u ON vco.cleaned_by = u.id
            WHERE vco.deleted_at IS NULL

            UNION ALL

            -- Distillation Shipments (Sent to Distillery)
            SELECT
              dr.id::text as id,
              'distillation_sent' as type,
              'cellar' as category,
              'create' as operation,
              dr.sent_at as activity_date,
              'Sent to Distillery' as activity_type,
              b.name as vendor_name,
              dr.sent_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'batchCode', b.name,
                'batchName', COALESCE(b.custom_name, b.name),
                'distilleryName', dr.distillery_name,
                'sourceVolume', dr.source_volume,
                'sourceVolumeUnit', dr.source_volume_unit,
                'tibNumber', dr.tib_outbound_number,
                'status', dr.status
              ) as metadata
            FROM distillation_records dr
            LEFT JOIN batches b ON dr.source_batch_id = b.id
            LEFT JOIN users u ON dr.sent_by = u.id
            WHERE dr.deleted_at IS NULL AND dr.sent_at IS NOT NULL

            UNION ALL

            -- Distillation Receipts (Brandy Received)
            SELECT
              dr.id::text as id,
              'distillation_received' as type,
              'cellar' as category,
              'create' as operation,
              dr.received_at as activity_date,
              'Brandy Received' as activity_type,
              rb.name as vendor_name,
              dr.received_by as performed_by_id,
              CASE
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'brandyBatchCode', rb.name,
                'brandyBatchName', COALESCE(rb.custom_name, rb.name),
                'distilleryName', dr.distillery_name,
                'receivedVolume', dr.received_volume,
                'receivedVolumeUnit', dr.received_volume_unit,
                'receivedAbv', dr.received_abv,
                'tibNumber', dr.tib_inbound_number,
                'status', dr.status
              ) as metadata
            FROM distillation_records dr
            LEFT JOIN batches rb ON dr.result_batch_id = rb.id
            LEFT JOIN users u ON dr.received_by = u.id
            WHERE dr.deleted_at IS NULL AND dr.received_at IS NOT NULL

            UNION ALL

            -- Updates from Audit Logs
            SELECT
              al.id::text as id,
              'audit_update' as type,
              CASE al.table_name
                WHEN 'batches' THEN 'cellar'
                WHEN 'batch_measurements' THEN 'cellar'
                WHEN 'batch_transfers' THEN 'cellar'
                WHEN 'batch_additives' THEN 'cellar'
                WHEN 'basefruit_purchases' THEN 'purchases'
                WHEN 'juice_purchases' THEN 'purchases'
                WHEN 'additive_purchases' THEN 'purchases'
                WHEN 'packaging_purchases' THEN 'purchases'
                WHEN 'press_runs' THEN 'pressing'
                WHEN 'bottle_runs' THEN 'packaging'
                WHEN 'keg_fills' THEN 'packaging'
                WHEN 'vessels' THEN 'vessels'
                ELSE 'cellar'
              END as category,
              'update' as operation,
              al.changed_at as activity_date,
              al.table_name || ' Updated' as activity_type,
              COALESCE(al.reason, 'Record updated') as vendor_name,
              al.changed_by as performed_by_id,
              CASE
                WHEN al.changed_by_email = 'claude-assistant' THEN 'Claude Assistant'
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                WHEN al.changed_by_email IS NOT NULL THEN al.changed_by_email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'tableName', al.table_name,
                'recordId', al.record_id,
                'operation', al.operation,
                'reason', al.reason
              ) as metadata
            FROM audit_logs al
            LEFT JOIN users u ON al.changed_by = u.id
            WHERE al.operation = 'update'

            UNION ALL

            -- Deletes from Audit Logs
            SELECT
              al.id::text as id,
              'audit_delete' as type,
              CASE al.table_name
                WHEN 'batches' THEN 'cellar'
                WHEN 'batch_measurements' THEN 'cellar'
                WHEN 'batch_transfers' THEN 'cellar'
                WHEN 'batch_additives' THEN 'cellar'
                WHEN 'basefruit_purchases' THEN 'purchases'
                WHEN 'juice_purchases' THEN 'purchases'
                WHEN 'additive_purchases' THEN 'purchases'
                WHEN 'packaging_purchases' THEN 'purchases'
                WHEN 'press_runs' THEN 'pressing'
                WHEN 'bottle_runs' THEN 'packaging'
                WHEN 'keg_fills' THEN 'packaging'
                WHEN 'vessels' THEN 'vessels'
                ELSE 'cellar'
              END as category,
              CASE
                WHEN al.operation = 'soft_delete' THEN 'delete'
                ELSE al.operation::text
              END as operation,
              al.changed_at as activity_date,
              al.table_name || ' Deleted' as activity_type,
              COALESCE(al.reason, 'Record deleted') as vendor_name,
              al.changed_by as performed_by_id,
              CASE
                WHEN al.changed_by_email = 'claude-assistant' THEN 'Claude Assistant'
                WHEN u.name IS NOT NULL THEN u.name
                WHEN u.email IS NOT NULL THEN u.email
                WHEN al.changed_by_email IS NOT NULL THEN al.changed_by_email
                ELSE 'System'
              END as performed_by_name,
              jsonb_build_object(
                'tableName', al.table_name,
                'recordId', al.record_id,
                'operation', al.operation,
                'reason', al.reason
              ) as metadata
            FROM audit_logs al
            LEFT JOIN users u ON al.changed_by = u.id
            WHERE al.operation IN ('delete', 'soft_delete')
          )
          SELECT *
          FROM all_activities
          ${categoryFilter}
          ${dateFilter}
          ${operationFilter}
          ORDER BY activity_date ${sortOrder === "desc" ? sql`DESC` : sql`ASC`}
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const activities = await db.execute(activitiesQuery);

        // Get total count for pagination (must match main query structure)
        const countQuery = sql`
          WITH all_activities AS (
            SELECT bfp.id, bfp.purchase_date as activity_date, 'purchases' as category, 'create' as operation
            FROM basefruit_purchases bfp WHERE bfp.deleted_at IS NULL
            UNION ALL
            SELECT jp.id, jp.purchase_date as activity_date, 'purchases' as category, 'create' as operation
            FROM juice_purchases jp WHERE jp.deleted_at IS NULL
            UNION ALL
            SELECT ap.id, ap.purchase_date as activity_date, 'purchases' as category, 'create' as operation
            FROM additive_purchases ap WHERE ap.deleted_at IS NULL
            UNION ALL
            SELECT pp.id, pp.purchase_date as activity_date, 'purchases' as category, 'create' as operation
            FROM packaging_purchases pp WHERE pp.deleted_at IS NULL
            UNION ALL
            SELECT pr.id, pr.date_completed as activity_date, 'pressing' as category, 'create' as operation
            FROM press_runs pr WHERE pr.deleted_at IS NULL AND pr.date_completed IS NOT NULL
            UNION ALL
            SELECT b.id, b.created_at as activity_date, 'cellar' as category, 'create' as operation
            FROM batches b WHERE b.deleted_at IS NULL
            UNION ALL
            SELECT bm.id, bm.measurement_date as activity_date, 'cellar' as category, 'create' as operation
            FROM batch_measurements bm WHERE bm.deleted_at IS NULL
            UNION ALL
            SELECT bt.id, bt.transferred_at as activity_date, 'cellar' as category, 'create' as operation
            FROM batch_transfers bt WHERE bt.deleted_at IS NULL
            UNION ALL
            SELECT ba.id, ba.added_at as activity_date, 'cellar' as category, 'create' as operation
            FROM batch_additives ba WHERE ba.deleted_at IS NULL
            UNION ALL
            SELECT bco.id, bco.started_at as activity_date, 'cellar' as category, 'create' as operation
            FROM batch_carbonation_operations bco WHERE bco.deleted_at IS NULL
            UNION ALL
            SELECT br.id, br.packaged_at as activity_date, 'packaging' as category, 'create' as operation
            FROM bottle_runs br WHERE br.status = 'completed'
            UNION ALL
            SELECT kf.id, kf.filled_at as activity_date, 'packaging' as category, 'create' as operation
            FROM keg_fills kf WHERE kf.status != 'voided'
            UNION ALL
            SELECT vco.id, vco.cleaned_at as activity_date, 'vessels' as category, 'create' as operation
            FROM vessel_cleaning_operations vco WHERE vco.deleted_at IS NULL
            UNION ALL
            SELECT dr.id, dr.sent_at as activity_date, 'cellar' as category, 'create' as operation
            FROM distillation_records dr WHERE dr.deleted_at IS NULL AND dr.sent_at IS NOT NULL
            UNION ALL
            SELECT dr.id, dr.received_at as activity_date, 'cellar' as category, 'create' as operation
            FROM distillation_records dr WHERE dr.deleted_at IS NULL AND dr.received_at IS NOT NULL
            UNION ALL
            -- Updates from Audit Logs
            SELECT al.id, al.changed_at as activity_date,
              CASE al.table_name
                WHEN 'batches' THEN 'cellar'
                WHEN 'batch_measurements' THEN 'cellar'
                WHEN 'batch_transfers' THEN 'cellar'
                WHEN 'batch_additives' THEN 'cellar'
                WHEN 'basefruit_purchases' THEN 'purchases'
                WHEN 'juice_purchases' THEN 'purchases'
                WHEN 'additive_purchases' THEN 'purchases'
                WHEN 'packaging_purchases' THEN 'purchases'
                WHEN 'press_runs' THEN 'pressing'
                WHEN 'bottle_runs' THEN 'packaging'
                WHEN 'keg_fills' THEN 'packaging'
                WHEN 'vessels' THEN 'vessels'
                ELSE 'cellar'
              END as category,
              'update' as operation
            FROM audit_logs al WHERE al.operation = 'update'
            UNION ALL
            -- Deletes from Audit Logs
            SELECT al.id, al.changed_at as activity_date,
              CASE al.table_name
                WHEN 'batches' THEN 'cellar'
                WHEN 'batch_measurements' THEN 'cellar'
                WHEN 'batch_transfers' THEN 'cellar'
                WHEN 'batch_additives' THEN 'cellar'
                WHEN 'basefruit_purchases' THEN 'purchases'
                WHEN 'juice_purchases' THEN 'purchases'
                WHEN 'additive_purchases' THEN 'purchases'
                WHEN 'packaging_purchases' THEN 'purchases'
                WHEN 'press_runs' THEN 'pressing'
                WHEN 'bottle_runs' THEN 'packaging'
                WHEN 'keg_fills' THEN 'packaging'
                WHEN 'vessels' THEN 'vessels'
                ELSE 'cellar'
              END as category,
              'delete' as operation
            FROM audit_logs al WHERE al.operation IN ('delete', 'soft_delete')
          )
          SELECT COUNT(*)::int as count
          FROM all_activities
          ${categoryFilter}
          ${dateFilter}
          ${operationFilter}
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
