import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  db,
  batches,
  vendors,
  batchMeasurements,
  vessels,
  organizationSettings,
  auditLogs,
  users,
} from "db";
import { eq, and, isNull, sql, desc, or, inArray, lt, notInArray } from "drizzle-orm";
import {
  analyzeFermentationProgress,
  getRecommendedMeasurementFrequency,
  getProductMeasurementSchedule,
  getMeasurementsDue,
  type FermentationMeasurement,
  type StageThresholds,
  type StallSettings,
  type FermentationStage,
  type MeasurementScheduleConfig,
  type BatchMeasurementOverride,
} from "lib";
import { formatRecentActivity } from "../services/recentActivityFormatter";
import { gatherUpcomingTasks } from "../services/upcomingTasks";

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
      // Batch counts and volumes by status
      const batchStats = await db.execute(sql`
        SELECT
          status,
          COUNT(*)::int as count,
          COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) as volume_l
        FROM batches
        WHERE deleted_at IS NULL
          AND status IN ('fermentation', 'aging', 'conditioning')
          AND vessel_id IS NOT NULL
        GROUP BY status
      `);

      const byStatus: Record<string, { count: number; volumeL: number }> = {};
      for (const row of batchStats.rows as any[]) {
        byStatus[row.status] = {
          count: parseInt(row.count || "0"),
          volumeL: parseFloat(row.volume_l || "0"),
        };
      }

      const fermenting = byStatus["fermentation"] || { count: 0, volumeL: 0 };
      const aging = byStatus["aging"] || { count: 0, volumeL: 0 };
      const conditioning = byStatus["conditioning"] || { count: 0, volumeL: 0 };

      // Packaged inventory — bottles and kegs in stock (not yet distributed)
      const [bottleStats] = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN br.status IN ('active', 'ready') THEN br.units_produced ELSE 0 END), 0)::int as bottles_in_stock,
          COALESCE(SUM(CASE WHEN br.status IN ('active', 'ready') THEN CAST(br.volume_taken AS NUMERIC) ELSE 0 END), 0) as bottle_volume_l
        FROM bottle_runs br
        WHERE br.status != 'voided'
      `).then(r => r.rows);

      const [kegStats] = await db.execute(sql`
        SELECT
          COUNT(CASE WHEN kf.status = 'filled' THEN 1 END)::int as kegs_in_stock,
          COALESCE(SUM(CASE WHEN kf.status = 'filled' THEN CAST(kf.volume_taken AS NUMERIC) ELSE 0 END), 0) as keg_volume_l
        FROM keg_fills kf
        WHERE kf.deleted_at IS NULL AND kf.status != 'voided'
      `).then(r => r.rows);

      const bs = (bottleStats || {}) as any;
      const ks = (kegStats || {}) as any;

      return {
        activeBatches: {
          count: fermenting.count + aging.count + conditioning.count,
          total: fermenting.count + aging.count + conditioning.count,
        },
        fermenting: {
          count: fermenting.count,
          volumeL: fermenting.volumeL,
        },
        aging: {
          count: aging.count,
          volumeL: aging.volumeL,
        },
        conditioning: {
          count: conditioning.count,
          volumeL: conditioning.volumeL,
        },
        bottlesReady: {
          count: parseInt(bs.bottles_in_stock || "0"),
          volumeL: parseFloat(bs.bottle_volume_l || "0"),
        },
        kegsReady: {
          count: parseInt(ks.kegs_in_stock || "0"),
          volumeL: parseFloat(ks.keg_volume_l || "0"),
        },
        packagedBatches: {
          count: conditioning.count,
        },
        activeVendors: {
          count: 0, // Computed elsewhere if needed
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
          productType: batches.productType,
        })
        .from(batches)
        .leftJoin(vessels, eq(batches.vesselId, vessels.id))
        .where(
          and(
            isNull(batches.deletedAt),
            inArray(batches.status, ["fermentation", "aging", "conditioning"]),
            sql`CAST(${batches.currentVolumeLiters} AS NUMERIC) > 0`,
            sql`${batches.vesselId} IS NOT NULL`,
          )
        )
        .orderBy(desc(batches.startDate))
        .limit(50);

      // Get latest measurements for all batches in one query (instead of N queries)
      const batchIds = recentBatches.map((b) => b.id);
      const allMeasurements = batchIds.length > 0
        ? await db
            .select({
              batchId: batchMeasurements.batchId,
              abv: batchMeasurements.abv,
              specificGravity: batchMeasurements.specificGravity,
              measurementDate: batchMeasurements.measurementDate,
            })
            .from(batchMeasurements)
            .where(inArray(batchMeasurements.batchId, batchIds))
            .orderBy(desc(batchMeasurements.measurementDate))
        : [];

      // Pick latest measurement per batch
      const measurementMap = new Map<string, (typeof allMeasurements)[0]>();
      for (const m of allMeasurements) {
        if (!measurementMap.has(m.batchId)) {
          measurementMap.set(m.batchId, m);
        }
      }

      const batchesWithMeasurements = recentBatches.map((batch) => {
        const measurement = measurementMap.get(batch.id);
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
          productType: batch.productType || "cider",
        };
      });

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
        // Get organization settings for fermentation thresholds and measurement schedules
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
            measurementSchedules: organizationSettings.measurementSchedules,
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

        // Get active batches with their gravity data and product type info
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
            productType: batches.productType,
            measurementScheduleOverride: batches.measurementScheduleOverride,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(
            and(
              isNull(batches.deletedAt),
              inArray(batches.status, ["fermentation", "aging", "conditioning"]),
              sql`CAST(${batches.currentVolumeLiters} AS NUMERIC) > 0`,
              // Exclude unassigned batches — they're remnants waiting to be completed
              sql`${batches.vesselId} IS NOT NULL`,
            )
          )
          .orderBy(desc(batches.startDate));

        // Build task list based on fermentation progress and product type
        const tasks: Array<{
          id: string;
          batchNumber: string;
          customName: string | null;
          vesselName: string | null;
          productType: string;
          taskType: "measurement_needed" | "stalled_fermentation" | "confirm_terminal" | "sensory_check_due" | "check_in_due" | "sg_due" | "ph_due" | "temperature_due" | "sensory_due" | "volume_due";
          alertType: "measurement_overdue" | "check_in_reminder" | null;
          daysSinceLastMeasurement: number;
          priority: "high" | "medium" | "low";
          percentFermented: number;
          fermentationStage: string;
          recommendedAction: string;
        }> = [];

        // Get measurement schedules from settings (with defaults)
        const measurementSchedules: Record<string, MeasurementScheduleConfig | undefined> =
          (settings?.measurementSchedules as Record<string, MeasurementScheduleConfig | undefined>) || {};

        // Batch-fetch all measurements for active batches (instead of N+1)
        // Include estimated measurements — for non-fermenting products (brandy/pommeau),
        // estimated blend measurements count as "the batch was checked"
        const activeBatchIds = activeBatches.map((b) => b.id);
        const agingOnlyTypes = new Set(["brandy", "pommeau"]);

        const allMeasurements = activeBatchIds.length > 0
          ? await db
              .select({
                batchId: batchMeasurements.batchId,
                specificGravity: batchMeasurements.specificGravity,
                ph: batchMeasurements.ph,
                temperature: batchMeasurements.temperature,
                volume: batchMeasurements.volume,
                sensoryNotes: batchMeasurements.sensoryNotes,
                measurementDate: batchMeasurements.measurementDate,
                measurementMethod: batchMeasurements.measurementMethod,
                isEstimated: batchMeasurements.isEstimated,
              })
              .from(batchMeasurements)
              .where(
                and(
                  inArray(batchMeasurements.batchId, activeBatchIds),
                  isNull(batchMeasurements.deletedAt),
                )
              )
              .orderBy(desc(batchMeasurements.measurementDate))
          : [];

        // Group measurements by batch ID
        const measurementsByBatch = new Map<string, typeof allMeasurements>();
        for (const m of allMeasurements) {
          if (!measurementsByBatch.has(m.batchId)) {
            measurementsByBatch.set(m.batchId, []);
          }
          measurementsByBatch.get(m.batchId)!.push(m);
        }

        // Helper: extract last measurement date per type from a batch's measurements
        function getLastDatesPerType(batchMeasurementList: typeof allMeasurements) {
          let lastSg: Date | null = null;
          let lastPh: Date | null = null;
          let lastTemp: Date | null = null;
          let lastSensory: Date | null = null;
          let lastVolume: Date | null = null;

          for (const m of batchMeasurementList) {
            const date = new Date(m.measurementDate);
            if (m.specificGravity && (!lastSg || date > lastSg)) lastSg = date;
            if (m.ph && (!lastPh || date > lastPh)) lastPh = date;
            if (m.temperature && (!lastTemp || date > lastTemp)) lastTemp = date;
            if (m.sensoryNotes && m.sensoryNotes.trim() && (!lastSensory || date > lastSensory)) lastSensory = date;
            if (m.volume && (!lastVolume || date > lastVolume)) lastVolume = date;
          }

          return { lastSg, lastPh, lastTemp, lastSensory, lastVolume };
        }

        for (const batch of activeBatches) {
          const productType = batch.productType || "cider";
          const allBatchMeasurements = measurementsByBatch.get(batch.id) || [];

          // For fermenting products (cider/perry/wine), exclude estimated measurements
          // For aging products (brandy/pommeau), include them — blend estimates count as check-ins
          const measurements = agingOnlyTypes.has(productType)
            ? allBatchMeasurements
            : allBatchMeasurements.filter(m => !m.isEstimated);

          // Get the product type schedule config
          const scheduleConfig = measurementSchedules[productType];
          const batchOverride = batch.measurementScheduleOverride as BatchMeasurementOverride | null;

          // Get last measurement date
          const lastMeasurementDate = measurements.length > 0
            ? new Date(measurements[0].measurementDate)
            : null;

          // Check if batch has an initial measurement
          const hasInitialMeasurement = measurements.length > 0;

          // Get the schedule for this batch
          const schedule = getProductMeasurementSchedule(
            productType,
            batch.fermentationStage as FermentationStage | null,
            hasInitialMeasurement,
            scheduleConfig,
            batchOverride
          );

          // For products that use fermentation stages (cider/perry), use detailed analysis
          // But skip fermentation-based tasks for batches already in aging/conditioning —
          // they should only get aging schedule tasks (pH, sensory, temp), not SG tasks.
          if (schedule.usesFermentationStages && batch.status === "fermentation") {
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

            // If batch has OG recorded but no measurements in batch_measurements table,
            // add the OG as an initial measurement using the batch start date
            if (originalGravity && fermentationMeasurements.length === 0 && batch.startDate) {
              fermentationMeasurements.push({
                specificGravity: originalGravity,
                measurementDate: new Date(batch.startDate),
                method: "hydrometer",
              });
            }
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
                productType,
                taskType: "stalled_fermentation",
                alertType: "measurement_overdue",
                daysSinceLastMeasurement: progress.daysSinceLastMeasurement,
                priority: "high",
                percentFermented: progress.percentFermented,
                fermentationStage: progress.stage,
                recommendedAction: progress.recommendedAction,
              });
            } else if (
              progress.stage === "terminal" &&
              !progress.isTerminalConfirmed &&
              progress.daysSinceLastMeasurement * 24 >= terminalConfirmationHours
            ) {
              // Terminal stage, awaiting a second hydrometer reading. We only
              // surface this once enough time has passed since the last
              // reading that a *confirming* reading is actually possible —
              // alerting earlier just nags about something the operator
              // can't act on yet. Escalate to high priority if the window
              // has been open for more than 5 days without confirmation.
              const daysOverdue =
                progress.daysSinceLastMeasurement - terminalConfirmationHours / 24;
              const priority: "high" | "medium" = daysOverdue > 5 ? "high" : "medium";

              tasks.push({
                id: batch.id,
                batchNumber: batch.batchNumber,
                customName: batch.customName,
                vesselName: batch.vesselName,
                productType,
                taskType: "confirm_terminal",
                alertType: "measurement_overdue",
                daysSinceLastMeasurement: progress.daysSinceLastMeasurement,
                priority,
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
                productType,
                taskType: "measurement_needed",
                alertType: schedule.alertType,
                daysSinceLastMeasurement: progress.daysSinceLastMeasurement,
                priority: isVeryOverdue ? "high" : "medium",
                percentFermented: progress.percentFermented,
                fermentationStage: progress.stage,
                recommendedAction: progress.recommendedAction,
              });
            }

            // Per-type checks for non-SG measurements (pH, temp, etc.) during fermentation
            const perTypeDates = getLastDatesPerType(allBatchMeasurements);
            const perTypeDue = getMeasurementsDue({
              productType,
              batchStatus: batch.status,
              fermentationStage: batch.fermentationStage as FermentationStage | null,
              lastSgDate: perTypeDates.lastSg,
              lastPhDate: perTypeDates.lastPh,
              lastTempDate: perTypeDates.lastTemp,
              lastSensoryDate: perTypeDates.lastSensory,
              lastVolumeDate: perTypeDates.lastVolume,
            });

            // Add per-type tasks (skip SG — already handled by stage-based system above)
            for (const due of perTypeDue) {
              if (due.type === "sg") continue;
              const taskTypeKey = `${due.type}_due` as "ph_due" | "temperature_due" | "sensory_due" | "volume_due";
              tasks.push({
                id: batch.id,
                batchNumber: batch.batchNumber,
                customName: batch.customName,
                vesselName: batch.vesselName,
                productType,
                taskType: taskTypeKey,
                alertType: schedule.alertType,
                daysSinceLastMeasurement: due.daysOverdue === Infinity ? 999 : due.daysOverdue,
                priority: due.priority,
                percentFermented: progress.percentFermented,
                fermentationStage: progress.stage,
                recommendedAction: `Record ${due.label}`,
              });
            }
          } else {
            // For fixed-interval products (brandy, pommeau, custom types)
            // Use per-type measurement scheduling
            if (schedule.alertType === null) {
              continue;
            }

            const perTypeDates = getLastDatesPerType(allBatchMeasurements);
            const perTypeDue = getMeasurementsDue({
              productType,
              batchStatus: batch.status,
              fermentationStage: batch.fermentationStage as FermentationStage | null,
              lastSgDate: perTypeDates.lastSg,
              lastPhDate: perTypeDates.lastPh,
              lastTempDate: perTypeDates.lastTemp,
              lastSensoryDate: perTypeDates.lastSensory,
              lastVolumeDate: perTypeDates.lastVolume,
            });

            // Generate one task per overdue measurement type
            for (const due of perTypeDue) {
              const taskTypeKey = `${due.type}_due` as "sg_due" | "ph_due" | "temperature_due" | "sensory_due" | "volume_due";
              tasks.push({
                id: batch.id,
                batchNumber: batch.batchNumber,
                customName: batch.customName,
                vesselName: batch.vesselName,
                productType,
                taskType: taskTypeKey,
                alertType: schedule.alertType,
                daysSinceLastMeasurement: due.daysOverdue === Infinity ? 999 : due.daysOverdue,
                priority: due.priority,
                percentFermented: 100, // Not applicable for aged products
                fermentationStage: "not_applicable",
                recommendedAction: `Record ${due.label}`,
              });
            }
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

        // Deduplicate: show only the most urgent task per batch
        // (multiple measurement types per batch → keep the highest priority one)
        const seenBatches = new Set<string>();
        const deduped = tasks.filter((t) => {
          if (seenBatches.has(t.id)) return false;
          seenBatches.add(t.id);
          return true;
        });

        return {
          tasks: deduped.slice(0, limit),
          totalCount: deduped.length,
          // Also return full count for context
          totalTasksBeforeDedup: tasks.length,
        };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        throw error;
      }
    }),

  /**
   * Get recent activity (audit log) for the dashboard.
   * Returns the most recent data-entry actions across all users so a returning
   * user can see where they (or teammates) last left off.
   */
  getRecentActivity: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(5),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 5;
      const offset = input?.offset ?? 0;

      // Tables that represent system/auth noise rather than data entry.
      const EXCLUDED_TABLES = [
        "audit_logs",
        "sessions",
        "accounts",
        "verification_tokens",
        "users",
        "organization_settings",
      ];

      // Skip batches.update events whose primary change is just vesselId —
      // those are produced as a side-effect of batch_transfers and would
      // double up the activity feed (the transfer itself already shows
      // source → destination + volume). We keep rows where status also
      // changed so transitions like "X batch closed" still surface.
      const skipBatchVesselOnlyUpdate = sql`NOT (
        ${auditLogs.tableName} = 'batches'
        AND ${auditLogs.operation} = 'update'
        AND COALESCE(${auditLogs.oldData}->>'vesselId', ${auditLogs.oldData}->>'vessel_id')
            IS DISTINCT FROM COALESCE(${auditLogs.newData}->>'vesselId', ${auditLogs.newData}->>'vessel_id')
        AND COALESCE(${auditLogs.oldData}->>'status', '')
            = COALESCE(${auditLogs.newData}->>'status', '')
      )`;

      // Skip "phantom closure" events: a batch's status flips to 'completed'
      // when it's already empty (vesselId is null). This happens after blends
      // and full transfers — the source batch row is paperwork-closed even
      // though the cider lives on under a different batch ID. No operational
      // meaning; would just confuse the user.
      const skipPhantomClosure = sql`NOT (
        ${auditLogs.tableName} = 'batches'
        AND ${auditLogs.operation} = 'update'
        AND COALESCE(${auditLogs.newData}->>'status', '') = 'completed'
        AND COALESCE(${auditLogs.oldData}->>'status', '') <> 'completed'
        AND COALESCE(${auditLogs.newData}->>'vesselId', ${auditLogs.newData}->>'vessel_id') IS NULL
      )`;

      // Fetch limit+1 so we can tell whether there's another page without a
      // separate COUNT query against the (potentially large) audit table.
      const rows = await db
        .select({
          id: auditLogs.id,
          tableName: auditLogs.tableName,
          recordId: auditLogs.recordId,
          operation: auditLogs.operation,
          changedAt: auditLogs.changedAt,
          changedByEmail: auditLogs.changedByEmail,
          oldData: auditLogs.oldData,
          newData: auditLogs.newData,
          userName: users.name,
          userEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.changedBy, users.id))
        .where(
          and(
            notInArray(auditLogs.tableName, EXCLUDED_TABLES),
            skipBatchVesselOnlyUpdate,
            skipPhantomClosure,
          ),
        )
        .orderBy(desc(auditLogs.changedAt))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const items = await formatRecentActivity(rows.slice(0, limit));

      return { items, hasMore };
    }),

  /**
   * Get upcoming tasks for the dashboard "Upcoming" widget.
   * Shows tasks due within `daysAhead` (default 7 days), sorted by due date.
   *
   * Multi-source by design — currently merges:
   *   - calculated (next measurement reading per type, terminal confirmation
   *     window opening)
   *   - aging milestones (stub — wired up when target durations are set)
   *   - recipe steps (stub — wired up when per-batch recipes ship)
   *
   * Pagination: fetch limit+1 to detect hasMore without a count query.
   * The assignedTo/assignedRole inputs are placeholders for the multi-user
   * future and are accepted but ignored today.
   */
  getUpcomingTasks: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(5),
          offset: z.number().min(0).default(0),
          daysAhead: z.number().min(1).max(60).default(7),
          assignedTo: z.string().optional(),
          assignedRole: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 5;
      const offset = input?.offset ?? 0;

      const all = await gatherUpcomingTasks({
        daysAhead: input?.daysAhead ?? 7,
        assignedTo: input?.assignedTo,
        assignedRole: input?.assignedRole,
      });

      const page = all.slice(offset, offset + limit + 1);
      const hasMore = page.length > limit;
      return { items: page.slice(0, limit), hasMore };
    }),
});
