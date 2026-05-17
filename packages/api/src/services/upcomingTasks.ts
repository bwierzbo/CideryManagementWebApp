/**
 * Computes upcoming tasks for the dashboard "Upcoming" widget.
 *
 * Sources of upcoming tasks (extensible — add to `gather*` helpers):
 *   - calculated: derived from existing data (next SG/pH/temp/sensory/volume
 *     reading due, terminal confirmation window opening)
 *   - aging:     STUBBED — will fire when per-product aging targets are set
 *                (see project_aging_targets.md)
 *   - recipe:    STUBBED — will fire when per-batch recipes are added (see
 *                project_recipes.md). Each recipe step becomes a task with
 *                its own dueAt + assignedRole.
 *   - manual:    Reserved for future manually-created tasks.
 *
 * The unified `UpcomingTask` shape carries `assignedTo` and `assignedRole`
 * so the multi-user feature (see project_multi_user_tasks.md) can plug in
 * filtering without a schema change.
 */

import {
  db,
  batches,
  vessels,
  batchMeasurements,
  organizationSettings,
} from "db";
import { eq, and, isNull, sql, desc, inArray } from "drizzle-orm";
import {
  getPerTypeSchedule,
  getRecommendedMeasurementFrequency,
  type FermentationStage,
  type PerTypeMeasurementSchedule,
} from "lib";

export type UpcomingTaskSource = "calculated" | "aging" | "recipe" | "manual";

export type UpcomingTaskKind =
  | "sg_reading"
  | "ph_reading"
  | "temperature_reading"
  | "sensory_check"
  | "volume_check"
  | "terminal_confirmation"
  | "aging_milestone"
  | "recipe_step";

export interface UpcomingTask {
  id: string;
  source: UpcomingTaskSource;
  kind: UpcomingTaskKind;
  batchId: string | null;
  batchName: string | null;
  vesselName: string | null;
  description: string;
  dueAt: Date;
  /** Hours until due (negative if past). Pre-computed for client convenience. */
  hoursUntilDue: number;
  priority: "high" | "medium" | "low";
  /** Future-proofing for multi-user — null today. */
  assignedTo: string | null;
  /** Future-proofing for multi-user — null today. */
  assignedRole: string | null;
  href: string | null;
}

interface ActiveBatchRow {
  id: string;
  batchNumber: string;
  customName: string | null;
  vesselId: string | null;
  vesselName: string | null;
  productType: string;
  status: string;
  fermentationStage: string | null;
  measurementScheduleOverride: unknown;
  startDate: Date;
}

interface MeasurementRow {
  batchId: string;
  measurementDate: Date;
  specificGravity: string | null;
  ph: string | null;
  temperature: string | null;
  volume: string | null;
  sensoryNotes: string | null;
  measurementMethod: string | null;
  isEstimated: boolean;
}

interface OrgScheduleSettings {
  terminalConfirmationHours: number;
}

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

async function loadOrgSettings(): Promise<OrgScheduleSettings> {
  const [row] = await db
    .select({
      terminalConfirmationHours: organizationSettings.terminalConfirmationHours,
    })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
    .limit(1);

  return {
    terminalConfirmationHours: row?.terminalConfirmationHours ?? 48,
  };
}

async function loadActiveBatches(): Promise<ActiveBatchRow[]> {
  const rows = await db
    .select({
      id: batches.id,
      batchNumber: batches.batchNumber,
      customName: batches.customName,
      vesselId: batches.vesselId,
      vesselName: vessels.name,
      productType: batches.productType,
      status: batches.status,
      fermentationStage: batches.fermentationStage,
      measurementScheduleOverride: batches.measurementScheduleOverride,
      startDate: batches.startDate,
    })
    .from(batches)
    .leftJoin(vessels, eq(batches.vesselId, vessels.id))
    .where(
      and(
        isNull(batches.deletedAt),
        inArray(batches.status, ["fermentation", "aging", "conditioning"]),
        sql`CAST(${batches.currentVolumeLiters} AS NUMERIC) > 0`,
        sql`${batches.vesselId} IS NOT NULL`,
      ),
    );
  return rows;
}

async function loadMeasurementsForBatches(batchIds: string[]): Promise<Map<string, MeasurementRow[]>> {
  const grouped = new Map<string, MeasurementRow[]>();
  if (batchIds.length === 0) return grouped;

  const rows = await db
    .select({
      batchId: batchMeasurements.batchId,
      measurementDate: batchMeasurements.measurementDate,
      specificGravity: batchMeasurements.specificGravity,
      ph: batchMeasurements.ph,
      temperature: batchMeasurements.temperature,
      volume: batchMeasurements.volume,
      sensoryNotes: batchMeasurements.sensoryNotes,
      measurementMethod: batchMeasurements.measurementMethod,
      isEstimated: batchMeasurements.isEstimated,
    })
    .from(batchMeasurements)
    .where(
      and(
        inArray(batchMeasurements.batchId, batchIds),
        isNull(batchMeasurements.deletedAt),
      ),
    )
    .orderBy(desc(batchMeasurements.measurementDate));

  for (const r of rows) {
    if (!grouped.has(r.batchId)) grouped.set(r.batchId, []);
    grouped.get(r.batchId)!.push(r as MeasurementRow);
  }
  return grouped;
}

interface LastDates {
  sg: Date | null;
  ph: Date | null;
  temperature: Date | null;
  sensory: Date | null;
  volume: Date | null;
  /** Most recent hydrometer SG reading (used for terminal confirmation timing). */
  hydrometerSg: Date | null;
  hydrometerSgValue: number | null;
}

function lastDatesFromMeasurements(measurements: MeasurementRow[]): LastDates {
  const out: LastDates = {
    sg: null, ph: null, temperature: null, sensory: null, volume: null,
    hydrometerSg: null, hydrometerSgValue: null,
  };

  for (const m of measurements) {
    const d = new Date(m.measurementDate);
    if (m.specificGravity && (!out.sg || d > out.sg)) out.sg = d;
    if (m.ph && (!out.ph || d > out.ph)) out.ph = d;
    if (m.temperature && (!out.temperature || d > out.temperature)) out.temperature = d;
    if (m.sensoryNotes && m.sensoryNotes.trim() && (!out.sensory || d > out.sensory)) out.sensory = d;
    if (m.volume && (!out.volume || d > out.volume)) out.volume = d;

    const isHydrometer = !m.measurementMethod || m.measurementMethod === "hydrometer";
    if (m.specificGravity && isHydrometer && (!out.hydrometerSg || d > out.hydrometerSg)) {
      out.hydrometerSg = d;
      out.hydrometerSgValue = parseFloat(m.specificGravity);
    }
  }
  return out;
}

function batchDisplayName(b: ActiveBatchRow): string {
  return b.customName || b.batchNumber;
}

function relativeWhen(dueAt: Date, now: Date): { hoursUntilDue: number } {
  return { hoursUntilDue: (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60) };
}

/**
 * Calculated tasks: next measurement-type due dates per batch, plus the
 * terminal-confirmation window for batches in terminal stage.
 */
function gatherCalculatedTasks(
  batchRows: ActiveBatchRow[],
  measurementsByBatch: Map<string, MeasurementRow[]>,
  settings: OrgScheduleSettings,
  now: Date,
  windowMs: number,
): UpcomingTask[] {
  const tasks: UpcomingTask[] = [];

  for (const b of batchRows) {
    const productType = b.productType || "cider";
    const measurements = measurementsByBatch.get(b.id) || [];
    const last = lastDatesFromMeasurements(measurements);

    // Per-batch schedule override (JSON column on batches). Matches
    // PerTypeMeasurementSchedule shape; null falls back to defaults from
    // getPerTypeSchedule().
    const batchSchedule = b.measurementScheduleOverride as PerTypeMeasurementSchedule | null;
    const schedule = getPerTypeSchedule(productType, b.status, batchSchedule);

    // SG uses stage-based interval during fermentation; everything else uses
    // the per-type schedule's intervalDays.
    const sgIntervalDays = b.fermentationStage
      ? getRecommendedMeasurementFrequency(b.fermentationStage as FermentationStage).maxDays
      : schedule.sg.intervalDays;

    const checks: Array<{
      kind: UpcomingTaskKind;
      label: string;
      lastDate: Date | null;
      intervalDays: number | null;
      enabled: boolean;
    }> = [
      { kind: "sg_reading", label: "SG reading", lastDate: last.sg,
        intervalDays: sgIntervalDays, enabled: schedule.sg.enabled },
      { kind: "ph_reading", label: "pH check", lastDate: last.ph,
        intervalDays: schedule.ph.intervalDays, enabled: schedule.ph.enabled },
      { kind: "temperature_reading", label: "Temperature check", lastDate: last.temperature,
        intervalDays: schedule.temperature.intervalDays, enabled: schedule.temperature.enabled },
      { kind: "sensory_check", label: "Sensory check", lastDate: last.sensory,
        intervalDays: schedule.sensory.intervalDays, enabled: schedule.sensory.enabled },
      { kind: "volume_check", label: "Volume check", lastDate: last.volume,
        intervalDays: schedule.volume.intervalDays, enabled: schedule.volume.enabled },
    ];

    const name = batchDisplayName(b);
    const vesselSuffix = b.vesselName ? ` (${b.vesselName})` : "";

    for (const c of checks) {
      if (!c.enabled || c.intervalDays === null || !c.lastDate) continue;
      const dueAt = new Date(c.lastDate.getTime() + c.intervalDays * 24 * 60 * 60 * 1000);

      // Skip already-overdue items — those go in Today's Tasks, not Upcoming.
      if (dueAt <= now) continue;
      if (dueAt.getTime() - now.getTime() > windowMs) continue;

      const { hoursUntilDue } = relativeWhen(dueAt, now);
      const priority = hoursUntilDue < 24 ? "high" : "medium";
      tasks.push({
        id: `${b.id}-${c.kind}`,
        source: "calculated",
        kind: c.kind,
        batchId: b.id,
        batchName: name,
        vesselName: b.vesselName,
        description: `${name} · ${c.label} due${vesselSuffix}`,
        dueAt,
        hoursUntilDue,
        priority,
        assignedTo: null,
        assignedRole: null,
        href: `/batch/${b.id}?tab=measurements`,
      });
    }

    // Terminal confirmation window: applies once batch reaches terminal
    // stage. Window opens at lastHydrometerReading + terminalConfirmationHours.
    if (b.fermentationStage === "terminal" && last.hydrometerSg) {
      const windowOpensAt = new Date(
        last.hydrometerSg.getTime() + settings.terminalConfirmationHours * 60 * 60 * 1000,
      );
      if (windowOpensAt > now && windowOpensAt.getTime() - now.getTime() <= windowMs) {
        const { hoursUntilDue } = relativeWhen(windowOpensAt, now);
        tasks.push({
          id: `${b.id}-terminal-confirmation`,
          source: "calculated",
          kind: "terminal_confirmation",
          batchId: b.id,
          batchName: name,
          vesselName: b.vesselName,
          description: `${name} · Confirming hydrometer reading possible${vesselSuffix}`,
          dueAt: windowOpensAt,
          hoursUntilDue,
          priority: hoursUntilDue < 24 ? "high" : "medium",
          assignedTo: null,
          assignedRole: null,
          href: `/batch/${b.id}?tab=measurements`,
        });
      }
    }
  }

  return tasks;
}

/**
 * STUB: Aging milestones. Returns empty until per-product target aging
 * durations are configurable (see project_aging_targets.md).
 *
 * When implemented, this should:
 *   - Read target duration from product type / batch override
 *   - For each active aging batch, compute targetCompletionAt = startDate + targetDays
 *   - Emit task with description like "{batch} hits {n}-week aging target {when}"
 */
function gatherAgingMilestones(
  _batchRows: ActiveBatchRow[],
  _now: Date,
  _windowMs: number,
): UpcomingTask[] {
  return [];
}

/**
 * STUB: Recipe-driven steps. Returns empty until per-batch recipes are
 * implemented (see project_recipes.md).
 *
 * When implemented, this should:
 *   - Load active recipes for each batch
 *   - For each recipe, find the next pending step
 *   - Compute its dueAt from its trigger (date offset OR condition like
 *     "when SG hits X", evaluated against latest measurement)
 *   - Emit UpcomingTask with kind="recipe_step", source="recipe"
 *   - Set assignedRole from the step definition (cellar-master, packaging, etc.)
 */
function gatherRecipeSteps(
  _batchRows: ActiveBatchRow[],
  _measurementsByBatch: Map<string, MeasurementRow[]>,
  _now: Date,
  _windowMs: number,
): UpcomingTask[] {
  return [];
}

export interface GetUpcomingTasksOptions {
  daysAhead?: number;
  /** Future: filter to a specific user. Today: ignored. */
  assignedTo?: string;
  /** Future: filter to a specific role. Today: ignored. */
  assignedRole?: string;
}

export async function gatherUpcomingTasks(
  options: GetUpcomingTasksOptions = {},
): Promise<UpcomingTask[]> {
  const now = new Date();
  const daysAhead = options.daysAhead ?? 7;
  const windowMs = daysAhead * 24 * 60 * 60 * 1000;

  const [settings, batchRows] = await Promise.all([
    loadOrgSettings(),
    loadActiveBatches(),
  ]);
  const measurementsByBatch = await loadMeasurementsForBatches(
    batchRows.map((b) => b.id),
  );

  const all: UpcomingTask[] = [
    ...gatherCalculatedTasks(batchRows, measurementsByBatch, settings, now, windowMs),
    ...gatherAgingMilestones(batchRows, now, windowMs),
    ...gatherRecipeSteps(batchRows, measurementsByBatch, now, windowMs),
  ];

  // Future multi-user filter — placeholder (no-op today since assignedTo/Role
  // are always null).
  const filtered = all.filter((t) => {
    if (options.assignedTo && t.assignedTo !== options.assignedTo) return false;
    if (options.assignedRole && t.assignedRole !== options.assignedRole) return false;
    return true;
  });

  // Sort by dueAt ascending (soonest first)
  filtered.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return filtered;
}
