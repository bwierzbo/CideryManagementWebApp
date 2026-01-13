/**
 * Product-type-specific measurement schedule calculations
 * Determines measurement frequencies based on product type, fermentation stage, and overrides
 */

import {
  getRecommendedMeasurementFrequency,
  type FermentationStage,
  type MeasurementFrequency,
} from "./fermentation";

// ============================================
// TYPES
// ============================================

export type BuiltInProductType = "juice" | "cider" | "perry" | "brandy" | "pommeau";
export type AlertType = "check_in_reminder" | "measurement_overdue";
export type MeasurementType = "sg" | "abv" | "ph" | "temperature" | "sensory" | "volume";

export interface MeasurementScheduleConfig {
  initialMeasurementTypes: MeasurementType[];
  ongoingMeasurementTypes: MeasurementType[];
  primaryMeasurement: MeasurementType;
  usesFermentationStages: boolean;
  defaultIntervalDays: number | null;
  alertType: AlertType | null;
}

export interface BatchMeasurementOverride {
  intervalDays?: number;
  measurementTypes?: MeasurementType[];
  alertType?: AlertType | null;
  notes?: string;
}

export interface MeasurementSchedules {
  cider: MeasurementScheduleConfig;
  perry: MeasurementScheduleConfig;
  brandy: MeasurementScheduleConfig;
  pommeau: MeasurementScheduleConfig;
  juice: MeasurementScheduleConfig;
  [key: string]: MeasurementScheduleConfig;
}

export interface ProductScheduleResult {
  measurementTypes: MeasurementType[];
  intervalDays: { min: number; max: number };
  alertType: AlertType | null;
  description: string;
  usesFermentationStages: boolean;
  primaryMeasurement: MeasurementType;
}

export interface MeasurementNeededResult {
  needed: boolean;
  daysOverdue: number;
  priority: "high" | "medium" | "low" | null;
  taskType: "measurement_needed" | "sensory_check_due" | "check_in_due" | null;
}

// ============================================
// DEFAULT SCHEDULES
// ============================================

export const DEFAULT_PRODUCT_SCHEDULES: Record<BuiltInProductType, MeasurementScheduleConfig> = {
  cider: {
    initialMeasurementTypes: ["sg", "ph", "temperature"],
    ongoingMeasurementTypes: ["sg", "ph", "temperature"],
    primaryMeasurement: "sg",
    usesFermentationStages: true,
    defaultIntervalDays: null,
    alertType: "measurement_overdue",
  },
  perry: {
    initialMeasurementTypes: ["sg", "ph", "temperature"],
    ongoingMeasurementTypes: ["sg", "ph", "temperature"],
    primaryMeasurement: "sg",
    usesFermentationStages: true,
    defaultIntervalDays: null,
    alertType: "measurement_overdue",
  },
  brandy: {
    initialMeasurementTypes: ["abv"],
    ongoingMeasurementTypes: ["sensory", "volume"],
    primaryMeasurement: "sensory",
    usesFermentationStages: false,
    defaultIntervalDays: 30,
    alertType: "check_in_reminder",
  },
  pommeau: {
    initialMeasurementTypes: ["sg", "ph"],
    ongoingMeasurementTypes: ["sensory", "volume"],
    primaryMeasurement: "sensory",
    usesFermentationStages: false,
    defaultIntervalDays: 90,
    alertType: "check_in_reminder",
  },
  juice: {
    initialMeasurementTypes: ["sg", "ph"],
    ongoingMeasurementTypes: [],
    primaryMeasurement: "sg",
    usesFermentationStages: false,
    defaultIntervalDays: null,
    alertType: null,
  },
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get measurement types for a batch based on whether it has an initial measurement
 */
export function getMeasurementTypesForBatch(
  config: MeasurementScheduleConfig,
  hasInitialMeasurement: boolean
): MeasurementType[] {
  if (!hasInitialMeasurement) {
    return config.initialMeasurementTypes;
  }
  return config.ongoingMeasurementTypes;
}

/**
 * Get the measurement schedule for a product type, considering fermentation stage and overrides
 */
export function getProductMeasurementSchedule(
  productType: string,
  fermentationStage: FermentationStage | null,
  hasInitialMeasurement: boolean,
  config?: MeasurementScheduleConfig,
  override?: BatchMeasurementOverride | null
): ProductScheduleResult {
  // Get base config (from org settings or defaults)
  const baseConfig = config ?? DEFAULT_PRODUCT_SCHEDULES[productType as BuiltInProductType] ?? DEFAULT_PRODUCT_SCHEDULES.cider;

  // Determine measurement types based on initial/ongoing
  let measurementTypes = getMeasurementTypesForBatch(baseConfig, hasInitialMeasurement);

  // Apply override measurement types if specified
  if (override?.measurementTypes && override.measurementTypes.length > 0) {
    measurementTypes = override.measurementTypes;
  }

  // Determine alert type (override takes precedence)
  const alertType = override?.alertType !== undefined ? override.alertType : baseConfig.alertType;

  // For SG-based products (cider/perry), use fermentation stage to determine interval
  if (baseConfig.usesFermentationStages && fermentationStage) {
    const stageFreq = getRecommendedMeasurementFrequency(fermentationStage);

    // Override interval if specified
    const intervalDays = override?.intervalDays
      ? { min: override.intervalDays, max: override.intervalDays }
      : { min: stageFreq.minDays, max: stageFreq.maxDays };

    return {
      measurementTypes,
      intervalDays,
      alertType,
      description: stageFreq.description,
      usesFermentationStages: true,
      primaryMeasurement: baseConfig.primaryMeasurement,
    };
  }

  // For fixed-interval products (brandy, pommeau, custom)
  const defaultInterval = override?.intervalDays ?? baseConfig.defaultIntervalDays;

  if (defaultInterval === null) {
    // No scheduled measurements
    return {
      measurementTypes,
      intervalDays: { min: 0, max: Infinity },
      alertType: null,
      description: "No scheduled measurements",
      usesFermentationStages: false,
      primaryMeasurement: baseConfig.primaryMeasurement,
    };
  }

  return {
    measurementTypes,
    intervalDays: { min: defaultInterval, max: defaultInterval },
    alertType,
    description: getIntervalDescription(productType, defaultInterval, measurementTypes),
    usesFermentationStages: false,
    primaryMeasurement: baseConfig.primaryMeasurement,
  };
}

/**
 * Generate a human-readable description for the measurement interval
 */
function getIntervalDescription(
  productType: string,
  days: number,
  measurementTypes: MeasurementType[]
): string {
  const hasSensory = measurementTypes.includes("sensory");
  const hasVolume = measurementTypes.includes("volume");

  if (productType === "brandy") {
    if (hasSensory) {
      return `Monthly sensory check (every ${days} days)`;
    }
    return `Monthly check (every ${days} days)`;
  }

  if (productType === "pommeau") {
    if (hasSensory && hasVolume) {
      return `Quarterly sensory & volume check (every ${days} days)`;
    }
    if (hasSensory) {
      return `Quarterly sensory check (every ${days} days)`;
    }
    return `Quarterly check (every ${days} days)`;
  }

  if (hasSensory) {
    return `Sensory check every ${days} days`;
  }

  return `Check every ${days} days`;
}

/**
 * Determine if a measurement is needed based on product type and last measurement date
 */
export function isMeasurementNeeded(params: {
  productType: string;
  lastMeasurementDate: Date | null;
  fermentationStage: FermentationStage | null;
  hasInitialMeasurement: boolean;
  scheduleConfig?: MeasurementScheduleConfig;
  batchOverride?: BatchMeasurementOverride | null;
}): MeasurementNeededResult {
  const {
    productType,
    lastMeasurementDate,
    fermentationStage,
    hasInitialMeasurement,
    scheduleConfig,
    batchOverride,
  } = params;

  const schedule = getProductMeasurementSchedule(
    productType,
    fermentationStage,
    hasInitialMeasurement,
    scheduleConfig,
    batchOverride
  );

  // No alerts configured
  if (schedule.alertType === null) {
    return { needed: false, daysOverdue: 0, priority: null, taskType: null };
  }

  // Never measured
  if (!lastMeasurementDate) {
    const taskType = getTaskType(schedule.measurementTypes, productType);
    return { needed: true, daysOverdue: Infinity, priority: "high", taskType };
  }

  // Infinite interval means no scheduled measurements
  if (schedule.intervalDays.max === Infinity) {
    return { needed: false, daysOverdue: 0, priority: null, taskType: null };
  }

  // Calculate days since last measurement
  const now = new Date();
  const lastDate = new Date(lastMeasurementDate);
  const daysSince = Math.floor(
    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const overdue = daysSince - schedule.intervalDays.max;

  // Determine priority based on how overdue
  if (overdue > schedule.intervalDays.max) {
    // Very overdue (more than double the interval)
    const taskType = getTaskType(schedule.measurementTypes, productType);
    return { needed: true, daysOverdue: overdue, priority: "high", taskType };
  }

  if (overdue > 0) {
    // Overdue but within tolerance
    const taskType = getTaskType(schedule.measurementTypes, productType);
    return { needed: true, daysOverdue: overdue, priority: "medium", taskType };
  }

  if (daysSince >= schedule.intervalDays.min) {
    // Within window but not overdue - low priority
    const taskType = getTaskType(schedule.measurementTypes, productType);
    return { needed: false, daysOverdue: 0, priority: "low", taskType };
  }

  return { needed: false, daysOverdue: 0, priority: null, taskType: null };
}

/**
 * Determine the task type based on measurement types and product type
 */
function getTaskType(
  measurementTypes: MeasurementType[],
  productType: string
): "measurement_needed" | "sensory_check_due" | "check_in_due" {
  // SG-based products get "measurement_needed"
  if (measurementTypes.includes("sg") && !measurementTypes.includes("sensory")) {
    return "measurement_needed";
  }

  // Sensory-focused products get "sensory_check_due"
  if (measurementTypes.includes("sensory")) {
    return "sensory_check_due";
  }

  // Default to generic check-in
  return "check_in_due";
}

/**
 * Calculate the next measurement due date based on product schedule
 */
export function getNextScheduledMeasurementDue(
  lastMeasurementDate: Date | null,
  schedule: ProductScheduleResult
): Date | null {
  if (!lastMeasurementDate || schedule.intervalDays.max === Infinity) {
    return null;
  }

  const nextDue = new Date(lastMeasurementDate);
  nextDue.setDate(nextDue.getDate() + schedule.intervalDays.max);
  return nextDue;
}

/**
 * Get display info for a measurement type
 */
export function getMeasurementTypeDisplay(type: MeasurementType): {
  label: string;
  shortLabel: string;
  icon: string;
} {
  switch (type) {
    case "sg":
      return { label: "Specific Gravity", shortLabel: "SG", icon: "beaker" };
    case "abv":
      return { label: "Alcohol by Volume", shortLabel: "ABV", icon: "wine" };
    case "ph":
      return { label: "pH Level", shortLabel: "pH", icon: "test-tube" };
    case "temperature":
      return { label: "Temperature", shortLabel: "Temp", icon: "thermometer" };
    case "sensory":
      return { label: "Sensory Evaluation", shortLabel: "Sensory", icon: "grape" };
    case "volume":
      return { label: "Volume Check", shortLabel: "Vol", icon: "droplet" };
    default:
      return { label: type, shortLabel: type, icon: "clipboard" };
  }
}

/**
 * Get display info for an alert type
 */
export function getAlertTypeDisplay(alertType: AlertType | null): {
  label: string;
  color: string;
  urgency: "high" | "low" | null;
} {
  switch (alertType) {
    case "measurement_overdue":
      return { label: "Measurement Overdue", color: "orange", urgency: "high" };
    case "check_in_reminder":
      return { label: "Check-in Reminder", color: "blue", urgency: "low" };
    default:
      return { label: "No Alert", color: "gray", urgency: null };
  }
}
