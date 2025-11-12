/**
 * CO2 Carbonation Calculation Utilities
 *
 * Provides accurate calculations for forced carbonation using Henry's Law.
 * Henry's Law states that the amount of gas dissolved in a liquid is proportional
 * to the pressure of that gas above the liquid.
 *
 * Formula: CO2 volumes = (Pressure PSI + 14.7) × Temperature Factor
 * Where:
 * - Pressure PSI is gauge pressure (14.7 added for atmospheric pressure)
 * - Temperature Factor varies with temperature (from lookup table)
 * - CO2 volumes is the amount dissolved (1 volume = 1L CO2 per 1L liquid)
 *
 * @see https://en.wikipedia.org/wiki/Henry%27s_law
 * @see https://www.kegerators.com/carbonation-table/
 */

/**
 * Temperature factors for Henry's Law
 * Values represent volumes of CO2 dissolved per PSI (absolute) at different temperatures
 *
 * Calculated from standard brewing carbonation charts:
 * Factor = CO2 volumes / (PSI gauge + 14.7 atmospheric)
 *
 * Source: Brewer's Friend Force Carbonation Chart
 * @see https://www.brewersfriend.com/force-carbonation-chart/
 */
const TEMP_FACTORS_CELSIUS: Record<number, number> = {
  0: 0.11417, // 32°F - At 10 PSI gauge = 2.82 volumes
  2: 0.10568, // 36°F - Interpolated
  4: 0.09474, // 39°F - At 10 PSI gauge = 2.34 volumes (most common temp)
  6: 0.08899, // 43°F - Interpolated
  8: 0.08458, // 46°F - Interpolated
  10: 0.08016, // 50°F - At 10 PSI gauge = 1.98 volumes
  12: 0.07470, // 54°F - Interpolated
  15: 0.06923, // 59°F - At 10 PSI gauge = 1.71 volumes
  18: 0.06417, // 64°F - Interpolated
  20: 0.05911, // 68°F - At 10 PSI gauge = 1.46 volumes
  22: 0.05506, // 72°F - Interpolated
  25: 0.04959, // 77°F - Interpolated
};

/**
 * Atmospheric pressure constant in PSI
 * Used to convert between gauge pressure and absolute pressure
 */
const ATMOSPHERIC_PRESSURE_PSI = 14.7;

/**
 * Interpolates temperature factor for temperatures between known data points
 *
 * @param temperatureCelsius - Temperature in °C
 * @returns Interpolated temperature factor
 */
function getTemperatureFactor(temperatureCelsius: number): number {
  const temps = Object.keys(TEMP_FACTORS_CELSIUS)
    .map(Number)
    .sort((a, b) => a - b);

  // If exact match, return it
  if (TEMP_FACTORS_CELSIUS[temperatureCelsius] !== undefined) {
    return TEMP_FACTORS_CELSIUS[temperatureCelsius];
  }

  // If below lowest temp, use lowest
  if (temperatureCelsius <= temps[0]) {
    return TEMP_FACTORS_CELSIUS[temps[0]];
  }

  // If above highest temp, use highest
  if (temperatureCelsius >= temps[temps.length - 1]) {
    return TEMP_FACTORS_CELSIUS[temps[temps.length - 1]];
  }

  // Linear interpolation between two closest points
  let lowerTemp = temps[0];
  let upperTemp = temps[temps.length - 1];

  for (let i = 0; i < temps.length - 1; i++) {
    if (temperatureCelsius >= temps[i] && temperatureCelsius <= temps[i + 1]) {
      lowerTemp = temps[i];
      upperTemp = temps[i + 1];
      break;
    }
  }

  const lowerFactor = TEMP_FACTORS_CELSIUS[lowerTemp];
  const upperFactor = TEMP_FACTORS_CELSIUS[upperTemp];

  // Linear interpolation formula: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
  const factor =
    lowerFactor +
    ((temperatureCelsius - lowerTemp) * (upperFactor - lowerFactor)) /
      (upperTemp - lowerTemp);

  return factor;
}

/**
 * Calculates CO2 volumes dissolved based on pressure and temperature.
 * Uses Henry's Law: CO2_volumes = (Pressure + 14.7) × Temperature_Factor
 *
 * @param pressurePSI - Gauge pressure in PSI (not absolute)
 * @param temperatureCelsius - Temperature in °C
 * @returns CO2 volumes (vol/vol), rounded to 2 decimal places
 *
 * @example
 * // 15 PSI at 4°C should give approximately 2.13 volumes
 * const volumes = calculateCO2Volumes(15, 4);
 * console.log(volumes); // 4.22
 */
export function calculateCO2Volumes(
  pressurePSI: number,
  temperatureCelsius: number,
): number {
  const factor = getTemperatureFactor(temperatureCelsius);
  const absolutePressure = pressurePSI + ATMOSPHERIC_PRESSURE_PSI;
  const volumes = absolutePressure * factor;

  return Math.round(volumes * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculates required pressure to achieve target CO2 volumes at given temperature.
 * Inverse of calculateCO2Volumes.
 *
 * @param targetCO2Volumes - Desired CO2 volumes (e.g., 2.5 for sparkling cider)
 * @param temperatureCelsius - Temperature in °C
 * @returns Required gauge pressure in PSI, rounded to 2 decimal places
 *
 * @example
 * // To achieve 2.5 volumes at 4°C
 * const pressure = calculateRequiredPressure(2.5, 4);
 * console.log(pressure); // 17.61
 */
export function calculateRequiredPressure(
  targetCO2Volumes: number,
  temperatureCelsius: number,
): number {
  const factor = getTemperatureFactor(temperatureCelsius);

  // Rearranged Henry's Law: Pressure = (CO2_volumes / Factor) - 14.7
  const absolutePressure = targetCO2Volumes / factor;
  const gaugePressure = absolutePressure - ATMOSPHERIC_PRESSURE_PSI;

  // Never return negative pressure
  const result = Math.max(0, gaugePressure);

  return Math.round(result * 100) / 100; // Round to 2 decimal places
}

/**
 * Estimates time needed for CO2 to dissolve.
 * Based on empirical data from brewing industry:
 * - ~24-48 hours per 1.0 volume at typical conditions (4°C, 15-20 PSI)
 * - Higher pressure speeds up dissolution
 * - Lower temperature improves CO2 solubility but may slow dissolution
 *
 * This is a rough estimate - actual time depends on:
 * - Carbonation method (headspace vs inline vs stone)
 * - Surface area of liquid exposed to CO2
 * - Agitation/circulation
 * - Initial CO2 content
 *
 * @param currentCO2 - Starting CO2 volumes
 * @param targetCO2 - Target CO2 volumes
 * @param pressurePSI - Applied pressure in PSI
 * @returns Estimated hours to reach target, rounded to 1 decimal place
 *
 * @example
 * // Carbonate from 0 to 2.5 volumes at 18 PSI
 * const hours = estimateCarbonationDuration(0, 2.5, 18);
 * console.log(hours); // Approximately 60 hours (2.5 days)
 */
export function estimateCarbonationDuration(
  currentCO2: number,
  targetCO2: number,
  pressurePSI: number,
): number {
  const co2Delta = targetCO2 - currentCO2;

  // If already at or above target, no time needed
  if (co2Delta <= 0) {
    return 0;
  }

  // Base rate: 24 hours per volume at 15 PSI (typical sparkling cider pressure)
  const baseHoursPerVolume = 24;
  const basePressure = 15;

  // Pressure factor: higher pressure speeds up dissolution
  // Using square root to model diminishing returns at very high pressure
  const pressureFactor = Math.sqrt(basePressure / Math.max(1, pressurePSI));

  // Calculate estimated hours
  const estimatedHours = co2Delta * baseHoursPerVolume * pressureFactor;

  return Math.round(estimatedHours * 10) / 10; // Round to 1 decimal place
}

/**
 * Classifies CO2 volumes into still/petillant/sparkling categories
 *
 * Categories:
 * - still: < 1.0 volumes (no bubbles)
 * - petillant: 1.0-2.5 volumes (lightly sparkling)
 * - sparkling: ≥ 2.5 volumes (fully sparkling)
 *
 * @param co2Volumes - CO2 volumes in the cider
 * @returns Carbonation level classification
 *
 * @example
 * getCarbonationLevel(0.5); // "still"
 * getCarbonationLevel(1.8); // "petillant"
 * getCarbonationLevel(3.0); // "sparkling"
 */
export function getCarbonationLevel(
  co2Volumes: number,
): "still" | "petillant" | "sparkling" {
  if (co2Volumes < 1.0) return "still";
  if (co2Volumes < 2.5) return "petillant";
  return "sparkling";
}

/**
 * Validates that pressure is safe for vessel
 *
 * @param pressurePSI - Pressure to validate
 * @param vesselMaxPressure - Maximum safe pressure for the vessel
 * @returns Whether pressure is safe for the vessel
 *
 * @example
 * isPressureSafe(20, 30); // true
 * isPressureSafe(35, 30); // false
 */
export function isPressureSafe(
  pressurePSI: number,
  vesselMaxPressure: number,
): boolean {
  if (pressurePSI < 0) return false;
  if (pressurePSI > vesselMaxPressure) return false;
  return true;
}

/**
 * Validates temperature is in safe range for carbonation
 *
 * Safe range: -5°C to 25°C
 * - Below -5°C: Risk of freezing
 * - Above 25°C: Poor CO2 absorption
 *
 * @param temperatureCelsius - Temperature in °C
 * @returns Whether temperature is safe
 *
 * @example
 * isTemperatureSafe(4); // true
 * isTemperatureSafe(-10); // false
 * isTemperatureSafe(30); // false
 */
export function isTemperatureSafe(temperatureCelsius: number): boolean {
  return temperatureCelsius >= -5 && temperatureCelsius <= 25;
}

/**
 * Validates temperature is in safe/optimal range with detailed feedback
 *
 * @param temperatureCelsius - Temperature in °C
 * @returns Object with validation result and message
 *
 * @example
 * validateTemperature(4); // { isValid: true, isOptimal: true }
 * validateTemperature(15); // { isValid: true, isOptimal: false, message: "..." }
 * validateTemperature(-10); // { isValid: false, isOptimal: false, message: "..." }
 */
export function validateTemperature(
  temperatureCelsius: number
): { isValid: boolean; isOptimal: boolean; message?: string } {
  if (temperatureCelsius < -5) {
    return {
      isValid: false,
      isOptimal: false,
      message: 'Temperature too low (risk of freezing)',
    };
  }

  if (temperatureCelsius > 25) {
    return {
      isValid: false,
      isOptimal: false,
      message: 'Temperature too high (poor CO2 absorption)',
    };
  }

  if (temperatureCelsius >= 0 && temperatureCelsius <= 10) {
    return {
      isValid: true,
      isOptimal: true,
    };
  }

  return {
    isValid: true,
    isOptimal: false,
    message: 'Temperature is valid but not optimal (best: 0-10°C)',
  };
}

/**
 * Gets typical CO2 ranges for cider styles
 */
export const CO2_RANGES = {
  still: { min: 0, max: 1.0, label: 'Still' },
  petillant: { min: 1.0, max: 2.5, label: 'Pétillant (lightly sparkling)' },
  sparkling: { min: 2.5, max: 4.0, label: 'Sparkling' },
} as const;

/**
 * Safety limits
 */
export const SAFETY_LIMITS = {
  maxPressurePSI: 50,
  minTemperatureC: -5,
  maxTemperatureC: 25,
  optimalTempRange: [0, 10] as const,
} as const;

/**
 * Calculates priming sugar needed for bottle conditioning (natural carbonation)
 *
 * Uses the formula: Sugar (g/L) = (Target CO2 - Residual CO2) × Sugar Factor
 * Where:
 * - Target CO2: Desired carbonation level in volumes
 * - Residual CO2: CO2 already dissolved in the cider
 * - Sugar Factor: ~4g sugar per L per volume of CO2 (varies by sugar type)
 *
 * Different sugar types produce different amounts of CO2:
 * - Table sugar (sucrose): 4.0 g/L per volume
 * - Corn sugar (dextrose): 3.8 g/L per volume
 * - Honey: 3.5 g/L per volume (approximate, varies by type)
 *
 * @param targetCO2Volumes - Desired CO2 volumes (e.g., 2.5 for sparkling)
 * @param residualCO2Volumes - CO2 already present in the cider (default 0)
 * @param volumeLiters - Volume of cider to prime in liters
 * @param sugarType - Type of priming sugar: "sucrose" | "dextrose" | "honey"
 * @returns Required sugar in grams, rounded to 1 decimal place
 *
 * @example
 * // Calculate table sugar needed for 20L batch at 2.5 volumes
 * const sugar = calculatePrimingSugar(2.5, 0, 20, "sucrose");
 * console.log(sugar); // 200.0 grams
 */
export function calculatePrimingSugar(
  targetCO2Volumes: number,
  residualCO2Volumes: number = 0,
  volumeLiters: number,
  sugarType: "sucrose" | "dextrose" | "honey" = "sucrose",
): number {
  // Sugar factors: grams per liter per CO2 volume
  const sugarFactors = {
    sucrose: 4.0,   // Table sugar
    dextrose: 3.8,  // Corn sugar
    honey: 3.5,     // Approximate, varies by type
  };

  const co2Delta = targetCO2Volumes - residualCO2Volumes;

  // If already at or above target, no sugar needed
  if (co2Delta <= 0) {
    return 0;
  }

  const factor = sugarFactors[sugarType];
  const sugarPerLiter = co2Delta * factor;
  const totalSugar = sugarPerLiter * volumeLiters;

  return Math.round(totalSugar * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate CO2 volumes from priming sugar amount (inverse calculation)
 *
 * @param sugarGramsPerLiter - Amount of priming sugar in grams per liter
 * @param residualCO2Volumes - Existing CO2 in the beverage (default 0)
 * @param sugarType - Type of sugar used for priming
 * @returns Target CO2 volumes that will be achieved
 *
 * @example
 * // Calculate CO2 from 10 g/L of sucrose
 * const co2 = calculateCO2FromSugar(10, 0, "sucrose");
 * console.log(co2); // 2.5 volumes
 */
export function calculateCO2FromSugar(
  sugarGramsPerLiter: number,
  residualCO2Volumes: number = 0,
  sugarType: "sucrose" | "dextrose" | "honey" = "sucrose",
): number {
  // Sugar factors: grams per liter per CO2 volume
  const sugarFactors = {
    sucrose: 4.0,   // Table sugar
    dextrose: 3.8,  // Corn sugar
    honey: 3.5,     // Approximate, varies by type
  };

  const factor = sugarFactors[sugarType];

  // Calculate CO2 delta from sugar amount
  // If sugarPerLiter = co2Delta * factor, then co2Delta = sugarPerLiter / factor
  const co2Delta = sugarGramsPerLiter / factor;

  const targetCO2 = residualCO2Volumes + co2Delta;

  return Math.round(targetCO2 * 100) / 100; // Round to 2 decimal places
}
