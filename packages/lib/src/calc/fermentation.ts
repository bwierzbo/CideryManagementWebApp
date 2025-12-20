/**
 * Fermentation stage tracking calculations for cidery operations
 * Calculates fermentation progress based on specific gravity readings
 * and determines appropriate measurement schedules
 */

// ============================================
// TYPES
// ============================================

export type FermentationStage =
  | "early"
  | "mid"
  | "approaching_dry"
  | "terminal"
  | "unknown";

export type MeasurementMethod = "hydrometer" | "refractometer" | "calculated";

export interface StageThresholds {
  earlyMax: number; // Default: 70
  midMax: number; // Default: 90
  approachingDryMax: number; // Default: 98
}

export interface StallSettings {
  enabled: boolean;
  days: number; // Default: 3
  threshold: number; // Min SG change (default: 0.001)
}

export interface MeasurementFrequency {
  minDays: number;
  maxDays: number;
  description: string;
}

export interface FermentationMeasurement {
  specificGravity: number;
  measurementDate: Date;
  method?: MeasurementMethod;
}

export interface FermentationProgress {
  percentFermented: number;
  stage: FermentationStage;
  isStalled: boolean;
  daysSinceLastMeasurement: number;
  recommendedAction: string;
  nextMeasurementDue: Date | null;
  isTerminalConfirmed: boolean;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_STAGE_THRESHOLDS: StageThresholds = {
  earlyMax: 70,
  midMax: 90,
  approachingDryMax: 98,
};

export const DEFAULT_STALL_SETTINGS: StallSettings = {
  enabled: true,
  days: 3,
  threshold: 0.001,
};

export const DEFAULT_TERMINAL_CONFIRMATION_HOURS = 48;

export const DEFAULT_TARGET_FG_BY_STYLE: Record<string, number> = {
  dry: 0.998,
  "semi-dry": 1.005,
  "semi-sweet": 1.012,
  sweet: 1.02,
};

// ============================================
// CORE CALCULATIONS
// ============================================

/**
 * Calculate the percentage of fermentation complete
 *
 * @param originalGravity - Original gravity (OG) at start of fermentation
 * @param currentGravity - Current specific gravity reading
 * @param targetFinalGravity - Expected final gravity (target FG)
 * @returns Percentage fermented (0-100+, can exceed 100 if FG drops below target)
 *
 * @example
 * ```typescript
 * // OG 1.050, current 1.020, target FG 0.998
 * const percent = calculatePercentFermented(1.050, 1.020, 0.998);
 * // Returns ~57.7%
 * ```
 */
export function calculatePercentFermented(
  originalGravity: number,
  currentGravity: number,
  targetFinalGravity: number
): number {
  // Validate inputs
  if (originalGravity <= 0 || currentGravity <= 0 || targetFinalGravity <= 0) {
    throw new Error("Gravity readings must be positive numbers");
  }

  if (originalGravity < currentGravity) {
    // This shouldn't happen in normal fermentation
    return 0;
  }

  if (originalGravity <= targetFinalGravity) {
    // OG must be greater than target FG for meaningful calculation
    return 0;
  }

  const totalDrop = originalGravity - targetFinalGravity;
  const actualDrop = originalGravity - currentGravity;

  const percentFermented = (actualDrop / totalDrop) * 100;

  // Round to 1 decimal place
  return Math.round(percentFermented * 10) / 10;
}

/**
 * Determine fermentation stage based on percentage complete
 *
 * @param percentFermented - Percentage of fermentation complete
 * @param thresholds - Stage threshold configuration
 * @returns Fermentation stage
 */
export function determineStage(
  percentFermented: number,
  thresholds: StageThresholds = DEFAULT_STAGE_THRESHOLDS
): FermentationStage {
  if (percentFermented < 0) {
    return "unknown";
  }

  if (percentFermented < thresholds.earlyMax) {
    return "early";
  }

  if (percentFermented < thresholds.midMax) {
    return "mid";
  }

  if (percentFermented < thresholds.approachingDryMax) {
    return "approaching_dry";
  }

  return "terminal";
}

/**
 * Calculate fermentation progress including stage
 *
 * @param originalGravity - Original gravity (OG)
 * @param currentGravity - Current SG reading
 * @param targetFinalGravity - Target final gravity
 * @param thresholds - Stage thresholds (optional)
 * @returns Progress object with percentage and stage
 */
export function calculateFermentationProgress(
  originalGravity: number,
  currentGravity: number,
  targetFinalGravity: number,
  thresholds: StageThresholds = DEFAULT_STAGE_THRESHOLDS
): { percentFermented: number; stage: FermentationStage } {
  const percentFermented = calculatePercentFermented(
    originalGravity,
    currentGravity,
    targetFinalGravity
  );

  const stage = determineStage(percentFermented, thresholds);

  return { percentFermented, stage };
}

// ============================================
// STALL DETECTION
// ============================================

/**
 * Detect if fermentation has stalled based on measurement history
 * A stall is when SG hasn't changed significantly over X days
 *
 * @param measurements - Array of measurements sorted by date (newest first)
 * @param settings - Stall detection settings
 * @returns true if fermentation appears stalled
 */
export function detectStall(
  measurements: FermentationMeasurement[],
  settings: StallSettings = DEFAULT_STALL_SETTINGS
): boolean {
  if (!settings.enabled || measurements.length < 2) {
    return false;
  }

  // Need at least 2 measurements to detect a stall
  const [latest, previous] = measurements;

  if (!latest.specificGravity || !previous.specificGravity) {
    return false;
  }

  // Calculate days between measurements
  const latestDate = new Date(latest.measurementDate);
  const previousDate = new Date(previous.measurementDate);
  const daysBetween = Math.abs(
    (latestDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If not enough time has passed, can't determine stall
  if (daysBetween < settings.days) {
    return false;
  }

  // Check if SG change is below threshold
  const sgChange = Math.abs(latest.specificGravity - previous.specificGravity);

  return sgChange < settings.threshold;
}

/**
 * Get days since the last measurement
 *
 * @param lastMeasurementDate - Date of the last measurement
 * @returns Number of days since last measurement
 */
export function getDaysSinceLastMeasurement(
  lastMeasurementDate: Date | null
): number {
  if (!lastMeasurementDate) {
    return Infinity;
  }

  const now = new Date();
  const lastDate = new Date(lastMeasurementDate);
  const daysDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  return Math.floor(daysDiff);
}

// ============================================
// TERMINAL CONFIRMATION
// ============================================

/**
 * Check if terminal stage is confirmed by two identical hydrometer readings
 *
 * @param measurements - Array of measurements (newest first)
 * @param confirmationHours - Minimum hours between identical readings (default: 48)
 * @returns true if terminal is confirmed
 */
export function isTerminalConfirmed(
  measurements: FermentationMeasurement[],
  confirmationHours: number = DEFAULT_TERMINAL_CONFIRMATION_HOURS
): boolean {
  // Need at least 2 hydrometer measurements
  const hydrometerReadings = measurements.filter(
    (m) => m.method === "hydrometer" || m.method === undefined
  );

  if (hydrometerReadings.length < 2) {
    return false;
  }

  const [latest, previous] = hydrometerReadings;

  // Check if readings are identical
  if (latest.specificGravity !== previous.specificGravity) {
    return false;
  }

  // Check if enough time has passed
  const latestDate = new Date(latest.measurementDate);
  const previousDate = new Date(previous.measurementDate);
  const hoursBetween = Math.abs(
    (latestDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60)
  );

  return hoursBetween >= confirmationHours;
}

// ============================================
// MEASUREMENT FREQUENCY
// ============================================

/**
 * Get recommended measurement frequency for a fermentation stage
 *
 * @param stage - Current fermentation stage
 * @returns Recommended frequency range
 */
export function getRecommendedMeasurementFrequency(
  stage: FermentationStage
): MeasurementFrequency {
  switch (stage) {
    case "early":
      return {
        minDays: 1,
        maxDays: 2,
        description: "Active fermentation - measure frequently",
      };
    case "mid":
      return {
        minDays: 2,
        maxDays: 3,
        description: "Fermentation slowing - moderate frequency",
      };
    case "approaching_dry":
      return {
        minDays: 3,
        maxDays: 4,
        description: "Nearly complete - reduce frequency",
      };
    case "terminal":
      return {
        minDays: 7,
        maxDays: 14,
        description: "Monitoring only - weekly checks",
      };
    case "unknown":
    default:
      return {
        minDays: 1,
        maxDays: 3,
        description: "Take initial measurement to establish stage",
      };
  }
}

/**
 * Calculate when the next measurement is due based on stage
 *
 * @param lastMeasurementDate - Date of last measurement
 * @param stage - Current fermentation stage
 * @returns Date when next measurement should be taken
 */
export function getNextMeasurementDue(
  lastMeasurementDate: Date | null,
  stage: FermentationStage
): Date | null {
  if (!lastMeasurementDate) {
    return new Date(); // Measure now
  }

  const frequency = getRecommendedMeasurementFrequency(stage);
  const lastDate = new Date(lastMeasurementDate);
  const nextDue = new Date(lastDate);
  nextDue.setDate(nextDue.getDate() + frequency.maxDays);

  return nextDue;
}

/**
 * Check if a measurement is due based on stage and last measurement
 *
 * @param lastMeasurementDate - Date of last measurement
 * @param stage - Current fermentation stage
 * @returns true if measurement is due or overdue
 */
export function isMeasurementDue(
  lastMeasurementDate: Date | null,
  stage: FermentationStage
): boolean {
  if (!lastMeasurementDate) {
    return true;
  }

  const daysSince = getDaysSinceLastMeasurement(lastMeasurementDate);
  const frequency = getRecommendedMeasurementFrequency(stage);

  return daysSince >= frequency.maxDays;
}

// ============================================
// FULL ANALYSIS
// ============================================

/**
 * Get complete fermentation progress analysis
 *
 * @param params - Analysis parameters
 * @returns Complete fermentation progress object
 */
export function analyzeFermentationProgress(params: {
  originalGravity: number | null;
  currentGravity: number | null;
  targetFinalGravity: number | null;
  measurements: FermentationMeasurement[];
  stageThresholds?: StageThresholds;
  stallSettings?: StallSettings;
  terminalConfirmationHours?: number;
}): FermentationProgress {
  const {
    originalGravity,
    currentGravity,
    targetFinalGravity,
    measurements,
    stageThresholds = DEFAULT_STAGE_THRESHOLDS,
    stallSettings = DEFAULT_STALL_SETTINGS,
    terminalConfirmationHours = DEFAULT_TERMINAL_CONFIRMATION_HOURS,
  } = params;

  // Handle missing data
  if (!originalGravity || !currentGravity || !targetFinalGravity) {
    const lastMeasurement =
      measurements.length > 0 ? measurements[0].measurementDate : null;
    const daysSince = getDaysSinceLastMeasurement(lastMeasurement);

    return {
      percentFermented: 0,
      stage: "unknown",
      isStalled: false,
      daysSinceLastMeasurement: daysSince,
      recommendedAction: "Record OG, current SG, and target FG to track progress",
      nextMeasurementDue: new Date(),
      isTerminalConfirmed: false,
    };
  }

  // Calculate progress
  const { percentFermented, stage } = calculateFermentationProgress(
    originalGravity,
    currentGravity,
    targetFinalGravity,
    stageThresholds
  );

  // Get last measurement date
  const lastMeasurement =
    measurements.length > 0 ? measurements[0].measurementDate : null;
  const daysSinceLastMeasurement = getDaysSinceLastMeasurement(lastMeasurement);

  // Detect stall
  const isStalled =
    stage !== "terminal" && detectStall(measurements, stallSettings);

  // Check terminal confirmation
  const terminalConfirmed =
    stage === "terminal" &&
    isTerminalConfirmed(measurements, terminalConfirmationHours);

  // Generate recommendation
  let recommendedAction: string;

  if (isStalled) {
    recommendedAction =
      "Fermentation may have stalled - consider temperature adjustment or yeast addition";
  } else if (stage === "terminal" && !terminalConfirmed) {
    recommendedAction =
      "Take another hydrometer reading to confirm terminal gravity";
  } else if (isMeasurementDue(lastMeasurement, stage)) {
    const frequency = getRecommendedMeasurementFrequency(stage);
    recommendedAction = `Measurement due - ${frequency.description}`;
  } else {
    const frequency = getRecommendedMeasurementFrequency(stage);
    const nextDue = getNextMeasurementDue(lastMeasurement, stage);
    const daysUntilDue = nextDue
      ? Math.ceil(
          (nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : 0;
    recommendedAction =
      daysUntilDue > 0
        ? `Next measurement in ${daysUntilDue} day(s)`
        : frequency.description;
  }

  return {
    percentFermented,
    stage,
    isStalled,
    daysSinceLastMeasurement,
    recommendedAction,
    nextMeasurementDue: getNextMeasurementDue(lastMeasurement, stage),
    isTerminalConfirmed: terminalConfirmed,
  };
}

/**
 * Get appropriate priority level for dashboard alerts
 *
 * @param progress - Fermentation progress object
 * @returns Priority level: "high", "medium", "low", or null (no alert needed)
 */
export function getAlertPriority(
  progress: FermentationProgress
): "high" | "medium" | "low" | null {
  // Stalled fermentation is always high priority
  if (progress.isStalled) {
    return "high";
  }

  // Terminal stage with confirmation doesn't need alerts
  if (progress.stage === "terminal" && progress.isTerminalConfirmed) {
    return null;
  }

  const frequency = getRecommendedMeasurementFrequency(progress.stage);

  // Check how overdue the measurement is
  if (progress.daysSinceLastMeasurement > frequency.maxDays * 2) {
    return "high";
  }

  if (progress.daysSinceLastMeasurement > frequency.maxDays) {
    return "medium";
  }

  if (progress.daysSinceLastMeasurement >= frequency.minDays) {
    return "low";
  }

  return null;
}

/**
 * Get stage display information for UI
 *
 * @param stage - Fermentation stage
 * @returns Display information
 */
export function getStageDisplayInfo(stage: FermentationStage): {
  label: string;
  color: string;
  description: string;
} {
  switch (stage) {
    case "early":
      return {
        label: "Early",
        color: "blue",
        description: "0-70% fermented - Active primary fermentation",
      };
    case "mid":
      return {
        label: "Mid",
        color: "yellow",
        description: "70-90% fermented - Fermentation slowing",
      };
    case "approaching_dry":
      return {
        label: "Approaching Dry",
        color: "orange",
        description: "90-98% fermented - Nearly complete",
      };
    case "terminal":
      return {
        label: "Terminal",
        color: "green",
        description: "98%+ fermented - Ready for conditioning",
      };
    case "unknown":
    default:
      return {
        label: "Unknown",
        color: "gray",
        description: "Missing gravity data",
      };
  }
}
