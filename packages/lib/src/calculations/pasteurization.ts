/**
 * Pasteurization Unit (PU) Calculations
 *
 * Implements hot-start water bath pasteurization using:
 * - Craft Metrics PU formula: PU = t × 10^((T - T_ref) / z)
 * - Reference temperature: 60°C
 * - z-value: 7°C
 * - Dynamic temperature curve modeling for heatup and cooldown phases
 * - Bottle-type thermal profiles with size-dependent time constants
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
  t_reach_min: number;           // Time to reach 60°C core temperature (min) - legacy
  PU_heatup: number;             // Cumulative PUs gained during warm-up - legacy estimate
  PU_cooldown: number;           // Cumulative PUs gained during cool-down - legacy estimate
  PU_profile: number;            // Total PUs from warm-up + cool-down - legacy estimate
  // Enhanced thermal properties
  thermalTimeConstant: number;   // Thermal time constant for heating (minutes)
  cooldownConstants: {           // Time constants for different cooling methods
    air: number;
    water_bath: number;
    ice_bath: number;
  };
}

export type CooldownMethod = 'air' | 'water_bath' | 'ice_bath';

export interface EnhancedPasteurizationInput {
  bottleTypeId: string;
  productStartingTempC: number;      // Starting temperature (e.g., 4°C fridge, 20°C room)
  bathTempC: number;                  // Water bath temperature (e.g., 65°C, 70°C)
  holdTimeMinutes: number;            // Time at bath temperature
  cooldownMethod: CooldownMethod;
  cooldownAmbientTempC?: number;      // Ambient temp for cooldown (auto-set by method if not provided)
  cooldownStopTempC?: number;         // Stop counting PUs below this temp (default 55°C)
}

export interface TemperatureDataPoint {
  time_min: number;
  core_temp_C: number;
  pu_rate: number;
  cumulative_pu: number;
  phase: 'heatup' | 'hold' | 'cooldown';
}

export interface PhaseResult {
  duration_min: number;
  pu: number;
  start_temp_C: number;
  end_temp_C: number;
}

export interface EnhancedPasteurizationResult {
  input: EnhancedPasteurizationInput;
  phases: {
    heatup: PhaseResult;
    hold: PhaseResult;
    cooldown: PhaseResult;
  };
  totals: {
    total_time_min: number;
    total_pu: number;
    effective_hold_temp_C: number;
  };
  temperatureProfile: TemperatureDataPoint[];
  warnings: string[];
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
 * Bottle type profiles with thermal properties
 * Time constants derived from Newton's law of cooling/heating
 * τ (tau) = time for temperature to change by ~63% of the difference
 */

export const BOTTLE_PROFILE_375ML_GLASS: BottleTypeProfile = {
  id: '375ml_glass',
  name: '375mL Glass Bottle',
  volume_ml: 375,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 4,
  PU_heatup: 6,
  PU_cooldown: 12,
  PU_profile: 18,
  thermalTimeConstant: 3.5,
  cooldownConstants: {
    air: 8,
    water_bath: 4,
    ice_bath: 2,
  },
};

export const BOTTLE_PROFILE_500ML_GLASS: BottleTypeProfile = {
  id: '500ml_glass',
  name: '500mL Glass Bottle',
  volume_ml: 500,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 5,
  PU_heatup: 8,
  PU_cooldown: 16,
  PU_profile: 24,
  thermalTimeConstant: 4.5,
  cooldownConstants: {
    air: 10,
    water_bath: 5,
    ice_bath: 2.5,
  },
};

export const BOTTLE_PROFILE_750ML_GLASS: BottleTypeProfile = {
  id: '750ml_glass',
  name: '750mL Glass Bottle',
  volume_ml: 750,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 6,
  PU_heatup: 10,
  PU_cooldown: 20,
  PU_profile: 30,
  thermalTimeConstant: 6.0,
  cooldownConstants: {
    air: 12,
    water_bath: 6,
    ice_bath: 3,
  },
};

export const BOTTLE_PROFILE_1L_GLASS: BottleTypeProfile = {
  id: '1l_glass',
  name: '1L Glass Bottle',
  volume_ml: 1000,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 8,
  PU_heatup: 14,
  PU_cooldown: 28,
  PU_profile: 42,
  thermalTimeConstant: 7.5,
  cooldownConstants: {
    air: 15,
    water_bath: 7.5,
    ice_bath: 4,
  },
};

export const BOTTLE_PROFILE_330ML_CAN: BottleTypeProfile = {
  id: '330ml_can',
  name: '330mL Aluminum Can',
  volume_ml: 330,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 2.5,
  PU_heatup: 4,
  PU_cooldown: 8,
  PU_profile: 12,
  thermalTimeConstant: 2.5,  // Cans heat faster due to better thermal conductivity
  cooldownConstants: {
    air: 5,
    water_bath: 2.5,
    ice_bath: 1.5,
  },
};

export const BOTTLE_PROFILE_473ML_CAN: BottleTypeProfile = {
  id: '473ml_can',
  name: '473mL (16oz) Aluminum Can',
  volume_ml: 473,
  default_T_hold: 65,
  T_ref: 60,
  z: 7,
  t_reach_min: 3,
  PU_heatup: 5,
  PU_cooldown: 10,
  PU_profile: 15,
  thermalTimeConstant: 3.0,
  cooldownConstants: {
    air: 6,
    water_bath: 3,
    ice_bath: 1.8,
  },
};

/**
 * Registry of available bottle types
 */
export const BOTTLE_PROFILES: Record<string, BottleTypeProfile> = {
  '375ml_glass': BOTTLE_PROFILE_375ML_GLASS,
  '500ml_glass': BOTTLE_PROFILE_500ML_GLASS,
  '750ml_glass': BOTTLE_PROFILE_750ML_GLASS,
  '1l_glass': BOTTLE_PROFILE_1L_GLASS,
  '330ml_can': BOTTLE_PROFILE_330ML_CAN,
  '473ml_can': BOTTLE_PROFILE_473ML_CAN,
};

/**
 * Get list of bottle profiles for UI dropdowns
 */
export function getBottleProfileOptions(): Array<{ id: string; name: string; volume_ml: number }> {
  return Object.values(BOTTLE_PROFILES).map(p => ({
    id: p.id,
    name: p.name,
    volume_ml: p.volume_ml,
  }));
}

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

// ============================================================================
// ENHANCED PASTEURIZATION WITH DYNAMIC RAMP CALCULATIONS
// ============================================================================

/**
 * Default ambient temperatures for different cooldown methods
 */
const COOLDOWN_AMBIENT_TEMPS: Record<CooldownMethod, number> = {
  air: 22,        // Room temperature
  water_bath: 18, // Cool water bath
  ice_bath: 2,    // Ice water
};

/**
 * Model temperature change using Newton's law of heating/cooling
 * T(t) = T_ambient + (T_initial - T_ambient) * e^(-t/τ)
 *
 * For heating: T_ambient = bath temperature
 * For cooling: T_ambient = ambient temperature
 *
 * @param initialTemp - Starting temperature (°C)
 * @param targetTemp - Target/ambient temperature (°C)
 * @param timeConstant - Thermal time constant τ (minutes)
 * @param time - Time elapsed (minutes)
 * @returns Temperature at given time (°C)
 */
function calculateTemperatureAtTime(
  initialTemp: number,
  targetTemp: number,
  timeConstant: number,
  time: number
): number {
  return targetTemp + (initialTemp - targetTemp) * Math.exp(-time / timeConstant);
}

/**
 * Model the heatup phase and calculate PU accumulation
 * Uses numerical integration with small time steps
 *
 * @param startTempC - Product starting temperature
 * @param bathTempC - Water bath temperature
 * @param timeConstant - Thermal time constant for heating
 * @param T_ref - Reference temperature for PU calculation
 * @param z - z-value
 * @param timeStepMin - Integration time step (default 0.25 min = 15 sec)
 * @returns Array of temperature data points for heatup phase
 */
function modelHeatupPhase(
  startTempC: number,
  bathTempC: number,
  timeConstant: number,
  T_ref: number = 60,
  z: number = 7,
  timeStepMin: number = 0.25
): TemperatureDataPoint[] {
  const profile: TemperatureDataPoint[] = [];
  let cumulativePU = 0;
  let t = 0;

  // Continue until within 0.5°C of bath temp (practical equilibrium)
  while (true) {
    const coreTemp = calculateTemperatureAtTime(startTempC, bathTempC, timeConstant, t);

    // Calculate PU rate at this temperature (only above T_ref)
    const puRate = coreTemp >= T_ref ? Math.pow(10, (coreTemp - T_ref) / z) : 0;

    // Integrate PU (trapezoidal rule - use current rate * time step)
    if (t > 0) {
      cumulativePU += puRate * timeStepMin;
    }

    profile.push({
      time_min: Math.round(t * 100) / 100,
      core_temp_C: Math.round(coreTemp * 100) / 100,
      pu_rate: Math.round(puRate * 1000) / 1000,
      cumulative_pu: Math.round(cumulativePU * 100) / 100,
      phase: 'heatup',
    });

    // Stop when within 0.5°C of bath temp or after 45 minutes (safety limit)
    if (Math.abs(bathTempC - coreTemp) < 0.5 || t > 45) {
      break;
    }

    t += timeStepMin;
  }

  return profile;
}

/**
 * Model the hold phase at constant temperature
 *
 * @param startTime - Time offset from start of pasteurization
 * @param holdTempC - Hold temperature
 * @param holdDurationMin - Duration of hold phase
 * @param startingPU - Cumulative PU from previous phases
 * @param T_ref - Reference temperature
 * @param z - z-value
 * @param timeStepMin - Time step for data points
 * @returns Array of temperature data points for hold phase
 */
function modelHoldPhase(
  startTime: number,
  holdTempC: number,
  holdDurationMin: number,
  startingPU: number,
  T_ref: number = 60,
  z: number = 7,
  timeStepMin: number = 0.5
): TemperatureDataPoint[] {
  const profile: TemperatureDataPoint[] = [];
  const puRate = holdTempC >= T_ref ? Math.pow(10, (holdTempC - T_ref) / z) : 0;
  let cumulativePU = startingPU;

  for (let t = 0; t <= holdDurationMin; t += timeStepMin) {
    if (t > 0) {
      cumulativePU += puRate * timeStepMin;
    }

    profile.push({
      time_min: Math.round((startTime + t) * 100) / 100,
      core_temp_C: holdTempC,
      pu_rate: Math.round(puRate * 1000) / 1000,
      cumulative_pu: Math.round(cumulativePU * 100) / 100,
      phase: 'hold',
    });
  }

  return profile;
}

/**
 * Model the cooldown phase and calculate PU accumulation
 * PUs continue to accumulate while temperature is above T_ref
 *
 * @param startTime - Time offset from start of pasteurization
 * @param startTempC - Temperature at start of cooldown (bath temp)
 * @param ambientTempC - Ambient/target temperature for cooling
 * @param timeConstant - Thermal time constant for cooling
 * @param startingPU - Cumulative PU from previous phases
 * @param stopTempC - Stop counting when below this temp
 * @param T_ref - Reference temperature
 * @param z - z-value
 * @param timeStepMin - Integration time step
 * @returns Array of temperature data points for cooldown phase
 */
function modelCooldownPhase(
  startTime: number,
  startTempC: number,
  ambientTempC: number,
  timeConstant: number,
  startingPU: number,
  stopTempC: number = 55,
  T_ref: number = 60,
  z: number = 7,
  timeStepMin: number = 0.25
): TemperatureDataPoint[] {
  const profile: TemperatureDataPoint[] = [];
  let cumulativePU = startingPU;
  let t = 0;

  while (true) {
    const coreTemp = calculateTemperatureAtTime(startTempC, ambientTempC, timeConstant, t);

    // Calculate PU rate (only above T_ref)
    const puRate = coreTemp >= T_ref ? Math.pow(10, (coreTemp - T_ref) / z) : 0;

    // Integrate PU
    if (t > 0) {
      cumulativePU += puRate * timeStepMin;
    }

    profile.push({
      time_min: Math.round((startTime + t) * 100) / 100,
      core_temp_C: Math.round(coreTemp * 100) / 100,
      pu_rate: Math.round(puRate * 1000) / 1000,
      cumulative_pu: Math.round(cumulativePU * 100) / 100,
      phase: 'cooldown',
    });

    // Stop when below stop temp or after 60 minutes (safety limit)
    if (coreTemp <= stopTempC || t > 60) {
      break;
    }

    t += timeStepMin;
  }

  return profile;
}

/**
 * Calculate enhanced pasteurization with dynamic temperature modeling
 *
 * This function models the complete pasteurization process:
 * 1. Heatup phase: Product warms from starting temp to bath temp
 * 2. Hold phase: Product held at bath temperature
 * 3. Cooldown phase: Product cools from bath temp to ambient
 *
 * PUs are calculated by integrating over the temperature curve,
 * providing accurate PU values that account for the contribution
 * during temperature transitions.
 *
 * @param input - Enhanced pasteurization input parameters
 * @returns Complete pasteurization result with temperature profile
 */
export function calculateEnhancedPasteurization(
  input: EnhancedPasteurizationInput
): EnhancedPasteurizationResult {
  const {
    bottleTypeId,
    productStartingTempC,
    bathTempC,
    holdTimeMinutes,
    cooldownMethod,
    cooldownAmbientTempC,
    cooldownStopTempC = 55,
  } = input;

  // Lookup bottle profile
  const profile = BOTTLE_PROFILES[bottleTypeId];
  if (!profile) {
    throw new Error(`Unknown bottle type: ${bottleTypeId}`);
  }

  const { T_ref, z, thermalTimeConstant, cooldownConstants } = profile;
  const cooldownTimeConstant = cooldownConstants[cooldownMethod];
  const ambientTemp = cooldownAmbientTempC ?? COOLDOWN_AMBIENT_TEMPS[cooldownMethod];

  const warnings: string[] = [];

  // Validate inputs
  if (productStartingTempC >= bathTempC) {
    warnings.push('Starting temperature is at or above bath temperature - no heatup phase needed.');
  }
  if (bathTempC < T_ref) {
    warnings.push(`Bath temperature (${bathTempC}°C) is below reference temperature (${T_ref}°C) - no PUs will accumulate during hold.`);
  }
  if (holdTimeMinutes <= 0) {
    warnings.push('Hold time is zero or negative - only ramp PUs will be counted.');
  }

  // Phase 1: Heatup
  const heatupProfile = modelHeatupPhase(
    productStartingTempC,
    bathTempC,
    thermalTimeConstant,
    T_ref,
    z
  );

  const heatupEndTime = heatupProfile.length > 0
    ? heatupProfile[heatupProfile.length - 1].time_min
    : 0;
  const heatupPU = heatupProfile.length > 0
    ? heatupProfile[heatupProfile.length - 1].cumulative_pu
    : 0;
  const heatupEndTemp = heatupProfile.length > 0
    ? heatupProfile[heatupProfile.length - 1].core_temp_C
    : productStartingTempC;

  // Phase 2: Hold
  const holdProfile = modelHoldPhase(
    heatupEndTime,
    bathTempC,
    holdTimeMinutes,
    heatupPU,
    T_ref,
    z
  );

  const holdEndTime = holdProfile.length > 0
    ? holdProfile[holdProfile.length - 1].time_min
    : heatupEndTime;
  const holdEndPU = holdProfile.length > 0
    ? holdProfile[holdProfile.length - 1].cumulative_pu
    : heatupPU;
  const holdPU = holdEndPU - heatupPU;

  // Phase 3: Cooldown
  const cooldownProfile = modelCooldownPhase(
    holdEndTime,
    bathTempC,
    ambientTemp,
    cooldownTimeConstant,
    holdEndPU,
    cooldownStopTempC,
    T_ref,
    z
  );

  const cooldownEndTime = cooldownProfile.length > 0
    ? cooldownProfile[cooldownProfile.length - 1].time_min
    : holdEndTime;
  const cooldownEndPU = cooldownProfile.length > 0
    ? cooldownProfile[cooldownProfile.length - 1].cumulative_pu
    : holdEndPU;
  const cooldownPU = cooldownEndPU - holdEndPU;
  const cooldownEndTemp = cooldownProfile.length > 0
    ? cooldownProfile[cooldownProfile.length - 1].core_temp_C
    : bathTempC;

  // Combine all profiles
  const temperatureProfile: TemperatureDataPoint[] = [
    ...heatupProfile,
    ...holdProfile.slice(1), // Skip first point (duplicate of heatup end)
    ...cooldownProfile.slice(1), // Skip first point (duplicate of hold end)
  ];

  return {
    input,
    phases: {
      heatup: {
        duration_min: Math.round(heatupEndTime * 10) / 10,
        pu: Math.round(heatupPU * 10) / 10,
        start_temp_C: productStartingTempC,
        end_temp_C: heatupEndTemp,
      },
      hold: {
        duration_min: holdTimeMinutes,
        pu: Math.round(holdPU * 10) / 10,
        start_temp_C: bathTempC,
        end_temp_C: bathTempC,
      },
      cooldown: {
        duration_min: Math.round((cooldownEndTime - holdEndTime) * 10) / 10,
        pu: Math.round(cooldownPU * 10) / 10,
        start_temp_C: bathTempC,
        end_temp_C: cooldownEndTemp,
      },
    },
    totals: {
      total_time_min: Math.round(cooldownEndTime * 10) / 10,
      total_pu: Math.round(cooldownEndPU * 10) / 10,
      effective_hold_temp_C: bathTempC,
    },
    temperatureProfile,
    warnings,
  };
}

/**
 * Calculate recommended hold time to achieve target PUs
 *
 * Given starting temperature, bath temperature, and cooldown method,
 * this function calculates how long to hold at bath temperature
 * to achieve the desired total PUs.
 *
 * @param targetPU - Desired total PUs
 * @param bottleTypeId - Bottle type ID
 * @param productStartingTempC - Starting temperature
 * @param bathTempC - Bath temperature
 * @param cooldownMethod - Cooling method
 * @returns Recommended hold time in minutes
 */
export function calculateRequiredHoldTime(
  targetPU: number,
  bottleTypeId: string = '750ml_glass',
  productStartingTempC: number = 20,
  bathTempC: number = 65,
  cooldownMethod: CooldownMethod = 'air'
): {
  holdTimeMinutes: number;
  estimatedTotalPU: number;
  heatupPU: number;
  cooldownPU: number;
} {
  const profile = BOTTLE_PROFILES[bottleTypeId];
  if (!profile) {
    throw new Error(`Unknown bottle type: ${bottleTypeId}`);
  }

  const { T_ref, z, thermalTimeConstant, cooldownConstants } = profile;
  const cooldownTimeConstant = cooldownConstants[cooldownMethod];
  const ambientTemp = COOLDOWN_AMBIENT_TEMPS[cooldownMethod];

  // Calculate heatup PUs
  const heatupProfile = modelHeatupPhase(
    productStartingTempC,
    bathTempC,
    thermalTimeConstant,
    T_ref,
    z
  );
  const heatupPU = heatupProfile.length > 0
    ? heatupProfile[heatupProfile.length - 1].cumulative_pu
    : 0;

  // Estimate cooldown PUs (calculate with 0 hold time)
  const cooldownProfile = modelCooldownPhase(
    0,
    bathTempC,
    ambientTemp,
    cooldownTimeConstant,
    0,
    55,
    T_ref,
    z
  );
  const cooldownPU = cooldownProfile.length > 0
    ? cooldownProfile[cooldownProfile.length - 1].cumulative_pu
    : 0;

  // Calculate PUs needed from hold phase
  const puFromRamps = heatupPU + cooldownPU;
  const puNeededFromHold = Math.max(0, targetPU - puFromRamps);

  // Calculate hold time needed
  const holdPURate = bathTempC >= T_ref ? Math.pow(10, (bathTempC - T_ref) / z) : 0;
  const holdTimeMinutes = holdPURate > 0 ? puNeededFromHold / holdPURate : 0;

  return {
    holdTimeMinutes: Math.round(holdTimeMinutes * 10) / 10,
    estimatedTotalPU: Math.round((puFromRamps + puNeededFromHold) * 10) / 10,
    heatupPU: Math.round(heatupPU * 10) / 10,
    cooldownPU: Math.round(cooldownPU * 10) / 10,
  };
}
