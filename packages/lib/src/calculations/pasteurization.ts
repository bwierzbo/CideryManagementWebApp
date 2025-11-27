/**
 * Pasteurization Unit (PU) Calculations
 *
 * Implements hot-start water bath pasteurization at 65°C using:
 * - Craft Metrics PU formula: PU = t × 10^((T - T_ref) / z)
 * - Reference temperature: 60°C
 * - z-value: 7°C
 * - Bottle-type thermal profiles
 *
 * @module pasteurization
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BottleTypeProfile {
  id: string;
  name: string;
  volume_ml: number;
  default_T_hold: number;        // Default hold temperature (°C)
  T_ref: number;                 // Reference temperature for PU calculation (°C)
  z: number;                     // z-value for thermal death time
  t_reach_min: number;           // Time to reach 60°C core temperature (min)
  PU_heatup: number;             // Cumulative PUs gained during warm-up
  PU_cooldown: number;           // Cumulative PUs gained during cool-down
  PU_profile: number;            // Total PUs from warm-up + cool-down
}

export interface ProductClassification {
  sweetness: 'dry' | 'semi-sweet' | 'sweet';
  hasFruit: boolean;
  finalGravity: number;
  targetPU_min: number;
  targetPU_max: number;
  riskLevel: 'low' | 'moderate' | 'high';
  description: string;
}

export interface PasteurizationPlan {
  bottleTypeId: string;
  T_hold: number;                // Hold temperature (°C)
  T_ref: number;                 // Reference temperature (°C)
  z: number;                     // z-value
  PU_target: number;             // Target PUs for this product
  PU_profile: number;            // PUs from warm-up + cool-down
  PU_extra: number;              // Extra PUs needed from hold time
  PU_rate: number;               // PU accumulation rate at hold temp (PU/min)
  time_to_reach_hold_min: number;  // Time to reach 60°C
  time_at_hold_min: number;      // Required hold time at T_hold
  total_bath_time_min: number;   // Total time in bath
  PU_breakdown: {
    heatup: number;
    hold: number;
    cooldown: number;
    total: number;
  };
  assumptions: {
    starting_temp_C: string;
    bath_temp_C: number;
    notes: string;
  };
}

// ============================================================================
// BOTTLE TYPE PROFILES
// ============================================================================

/**
 * Default bottle type profile for 750ml glass bottles
 * Based on thermal probe data and validated models
 */
export const BOTTLE_PROFILE_750ML_GLASS: BottleTypeProfile = {
  id: '750ml_glass',
  name: '750mL Glass Bottle',
  volume_ml: 750,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 6,        // Time to reach 60-65°C core
  PU_heatup: 10,         // PUs gained during warm-up
  PU_cooldown: 20,       // PUs gained during cool-down
  PU_profile: 30,        // Total PUs from thermal profile
};

/**
 * Registry of available bottle types
 * Can be extended with additional profiles
 */
export const BOTTLE_PROFILES: Record<string, BottleTypeProfile> = {
  '750ml_glass': BOTTLE_PROFILE_750ML_GLASS,
  // Future: Add 375ml, 500ml, cans, etc.
};

// ============================================================================
// PRODUCT CLASSIFICATION
// ============================================================================

/**
 * Classify cider product based on final gravity and fruit additions
 * Used to determine appropriate PU targets
 *
 * Classification logic:
 * - Dry: FG < 1.002 (low residual sugar, low risk)
 * - Semi-sweet: FG 1.002 - 1.008 (moderate sugar, moderate risk)
 * - Sweet: FG > 1.008 (high sugar, high risk)
 * - Fruited: Any with fruit additions (+5 PU)
 *
 * @param finalGravity - Final specific gravity of the cider
 * @param hasFruitAddition - Whether fruit was added to the batch
 * @returns Product classification with PU targets
 */
export function classifyProduct(
  finalGravity: number,
  hasFruitAddition: boolean = false
): ProductClassification {
  let sweetness: 'dry' | 'semi-sweet' | 'sweet';
  let basePU_min: number;
  let basePU_max: number;
  let riskLevel: 'low' | 'moderate' | 'high';

  // Classify by final gravity
  if (finalGravity < 1.002) {
    sweetness = 'dry';
    basePU_min = 20;
    basePU_max = 25;
    riskLevel = 'low';
  } else if (finalGravity <= 1.008) {
    sweetness = 'semi-sweet';
    basePU_min = 25;
    basePU_max = 30;
    riskLevel = 'moderate';
  } else {
    sweetness = 'sweet';
    basePU_min = 30;
    basePU_max = 35;
    riskLevel = 'high';
  }

  // Add +5 PU for fruit additions (higher microbial risk)
  if (hasFruitAddition) {
    basePU_min += 5;
    basePU_max += 5;
    riskLevel = riskLevel === 'low' ? 'moderate' : 'high';
  }

  // Generate description
  const sweetnessLabel = sweetness.charAt(0).toUpperCase() + sweetness.slice(1);
  const fruitLabel = hasFruitAddition ? ' with Fruit' : '';
  const description = `${sweetnessLabel} Cider${fruitLabel} (FG: ${finalGravity.toFixed(3)})`;

  return {
    sweetness,
    hasFruit: hasFruitAddition,
    finalGravity,
    targetPU_min: basePU_min,
    targetPU_max: basePU_max,
    riskLevel,
    description,
  };
}

// ============================================================================
// PU CALCULATIONS (CRAFT METRICS FORMULA)
// ============================================================================

/**
 * Calculate Pasteurization Units using Craft Metrics formula
 *
 * Formula: PU = t × 10^((T - T_ref) / z)
 *
 * Where:
 * - t = time at temperature (minutes)
 * - T = actual temperature (°C)
 * - T_ref = reference temperature (60°C)
 * - z = temperature coefficient (7°C)
 *
 * Only counts PUs at temperatures ≥ 60°C
 *
 * @param temperatureCelsius - Temperature in °C
 * @param timeMinutes - Time at that temperature in minutes
 * @param T_ref - Reference temperature (default 60°C)
 * @param z - z-value (default 7°C)
 * @returns Pasteurization Units
 */
export function calculatePU(
  temperatureCelsius: number,
  timeMinutes: number,
  T_ref: number = 60,
  z: number = 7
): number {
  // Don't count PUs below reference temperature
  if (temperatureCelsius < T_ref) {
    return 0;
  }

  // Craft Metrics formula: PU = t × 10^((T - T_ref) / z)
  const exponent = (temperatureCelsius - T_ref) / z;
  const pu = timeMinutes * Math.pow(10, exponent);

  return pu;
}

/**
 * Calculate PU accumulation rate at a given temperature
 * Returns PUs per minute at that temperature
 *
 * @param temperatureCelsius - Temperature in °C
 * @param T_ref - Reference temperature (default 60°C)
 * @param z - z-value (default 7°C)
 * @returns PU accumulation rate (PU/min)
 */
export function calculatePURate(
  temperatureCelsius: number,
  T_ref: number = 60,
  z: number = 7
): number {
  if (temperatureCelsius < T_ref) {
    return 0;
  }

  const exponent = (temperatureCelsius - T_ref) / z;
  return Math.pow(10, exponent);
}

// ============================================================================
// PASTEURIZATION PLANNING
// ============================================================================

/**
 * Calculate pasteurization plan for hot-start water bath method
 *
 * Planning algorithm:
 * 1. Look up bottle thermal profile (warm-up time, PU profile)
 * 2. Calculate PUs needed beyond profile (PU_extra = target - profile)
 * 3. Calculate PU rate at hold temperature
 * 4. Calculate required hold time
 * 5. Calculate total bath time
 *
 * @param bottleTypeId - ID of bottle type profile
 * @param PU_target - Target PUs for the product
 * @param T_hold - Hold temperature (default 65°C)
 * @returns Complete pasteurization plan
 */
export function calculatePasteurizationPlan(
  bottleTypeId: string = '750ml_glass',
  PU_target: number = 30,
  T_hold: number = 65
): PasteurizationPlan {
  // Step 1: Lookup bottle profile
  const profile = BOTTLE_PROFILES[bottleTypeId];
  if (!profile) {
    throw new Error(`Unknown bottle type: ${bottleTypeId}`);
  }

  const {
    t_reach_min,
    PU_heatup,
    PU_cooldown,
    PU_profile,
    T_ref,
    z,
  } = profile;

  // Step 2: Calculate extra PUs needed
  const PU_extra = Math.max(0, PU_target - PU_profile);

  // Step 3: Calculate PU rate at hold temperature
  const PU_rate = calculatePURate(T_hold, T_ref, z);

  // Step 4: Calculate required hold time
  const time_at_hold = PU_extra > 0 ? PU_extra / PU_rate : 0;

  // Step 5: Calculate total bath time
  const total_bath_time = t_reach_min + time_at_hold;

  // Step 6: Calculate PU breakdown
  const PU_hold = time_at_hold * PU_rate;
  const PU_total = PU_heatup + PU_hold + PU_cooldown;

  return {
    bottleTypeId,
    T_hold,
    T_ref,
    z,
    PU_target,
    PU_profile,
    PU_extra,
    PU_rate,
    time_to_reach_hold_min: t_reach_min,
    time_at_hold_min: time_at_hold,
    total_bath_time_min: total_bath_time,
    PU_breakdown: {
      heatup: PU_heatup,
      hold: PU_hold,
      cooldown: PU_cooldown,
      total: PU_total,
    },
    assumptions: {
      starting_temp_C: '20-22',
      bath_temp_C: 65,
      notes: 'Hot-start pasteurization; PUs counted only at ≥60°C, consistent with Craft Metrics.',
    },
  };
}

/**
 * Validate pasteurization result against product requirements
 *
 * @param actualPU - Actual PUs achieved
 * @param productClassification - Product classification with targets
 * @returns Validation result with status and message
 */
export function validatePasteurization(
  actualPU: number,
  productClassification: ProductClassification
): {
  status: 'optimal' | 'acceptable' | 'insufficient';
  message: string;
  color: 'green' | 'yellow' | 'red';
} {
  const { targetPU_min, targetPU_max, description } = productClassification;

  if (actualPU >= targetPU_min) {
    return {
      status: 'optimal',
      message: `Optimal pasteurization for ${description}. Target: ${targetPU_min}-${targetPU_max} PU.`,
      color: 'green',
    };
  } else if (actualPU >= targetPU_min * 0.75) {
    return {
      status: 'acceptable',
      message: `Acceptable but below target for ${description}. Consider extending time. Target: ${targetPU_min}-${targetPU_max} PU.`,
      color: 'yellow',
    };
  } else {
    return {
      status: 'insufficient',
      message: `Insufficient pasteurization for ${description}. Increase time or temperature. Target: ${targetPU_min}-${targetPU_max} PU.`,
      color: 'red',
    };
  }
}
