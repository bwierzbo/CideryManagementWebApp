/**
 * Financial utility functions for currency formatting, precision handling, and statistical calculations
 * Ensures consistent financial calculations and display across the cidery management system
 */

/**
 * Format currency amount to string with proper symbol and precision
 * Handles different currency codes and locales
 *
 * @param amount - Numeric amount to format
 * @param currencyCode - ISO currency code (default: USD)
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD', locale: string = 'en-US'): string {
  if (!isFinite(amount)) {
    throw new Error('Amount must be a finite number')
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return formatter.format(amount)
}

/**
 * Format percentage with consistent precision
 * Used for margins, yields, and variance displays
 *
 * @param value - Percentage value (e.g., 15.5 for 15.5%)
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimalPlaces: number = 2): string {
  if (!isFinite(value)) {
    throw new Error('Percentage value must be a finite number')
  }

  if (decimalPlaces < 0 || decimalPlaces > 10) {
    throw new Error('Decimal places must be between 0 and 10')
  }

  return `${value.toFixed(decimalPlaces)}%`
}

/**
 * Round financial amount to specified decimal places
 * Ensures consistent rounding behavior for monetary calculations
 *
 * @param amount - Amount to round
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Rounded amount
 */
export function roundFinancial(amount: number, decimalPlaces: number = 2): number {
  if (!isFinite(amount)) {
    throw new Error('Amount must be a finite number')
  }

  if (decimalPlaces < 0 || decimalPlaces > 10) {
    throw new Error('Decimal places must be between 0 and 10')
  }

  const multiplier = Math.pow(10, decimalPlaces)
  return Math.round(amount * multiplier) / multiplier
}

/**
 * Calculate weighted average with financial precision
 * Used for average costs, pricing, and performance metrics
 *
 * @param values - Array of {value, weight} objects
 * @returns Weighted average value
 */
export function calculateWeightedAverage(values: Array<{ value: number; weight: number }>): number {
  if (values.length === 0) {
    throw new Error('At least one value is required for weighted average')
  }

  let totalWeightedValue = 0
  let totalWeight = 0

  for (const item of values) {
    if (!isFinite(item.value) || !isFinite(item.weight)) {
      throw new Error('All values and weights must be finite numbers')
    }

    if (item.weight < 0) {
      throw new Error('Weights must be non-negative')
    }

    totalWeightedValue += item.value * item.weight
    totalWeight += item.weight
  }

  if (totalWeight === 0) {
    throw new Error('Total weight cannot be zero')
  }

  return roundFinancial(totalWeightedValue / totalWeight, 4)
}

/**
 * Calculate standard deviation for financial data
 * Used for cost variance analysis and risk assessment
 *
 * @param values - Array of numeric values
 * @returns Standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) {
    throw new Error('At least one value is required for standard deviation')
  }

  if (values.length === 1) {
    return 0
  }

  for (const value of values) {
    if (!isFinite(value)) {
      throw new Error('All values must be finite numbers')
    }
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2))
  const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / (values.length - 1)

  return roundFinancial(Math.sqrt(variance), 4)
}

/**
 * Calculate coefficient of variation
 * Measures relative variability (std dev / mean)
 *
 * @param values - Array of numeric values
 * @returns Coefficient of variation as percentage
 */
export function calculateCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) {
    throw new Error('At least one value is required')
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length

  if (mean === 0) {
    throw new Error('Cannot calculate coefficient of variation when mean is zero')
  }

  const stdDev = calculateStandardDeviation(values)
  const cv = (stdDev / Math.abs(mean)) * 100

  return roundFinancial(cv, 2)
}

/**
 * Calculate median value
 * Used for robust central tendency when outliers are present
 *
 * @param values - Array of numeric values
 * @returns Median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    throw new Error('At least one value is required for median calculation')
  }

  for (const value of values) {
    if (!isFinite(value)) {
      throw new Error('All values must be finite numbers')
    }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    // Even number of values - average of two middle values
    return roundFinancial((sorted[middle - 1] + sorted[middle]) / 2, 4)
  } else {
    // Odd number of values - middle value
    return sorted[middle]
  }
}

/**
 * Calculate percentile value
 * Used for cost benchmarking and performance analysis
 *
 * @param values - Array of numeric values
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    throw new Error('At least one value is required for percentile calculation')
  }

  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100')
  }

  for (const value of values) {
    if (!isFinite(value)) {
      throw new Error('All values must be finite numbers')
    }
  }

  const sorted = [...values].sort((a, b) => a - b)

  if (percentile === 0) return sorted[0]
  if (percentile === 100) return sorted[sorted.length - 1]

  const index = (percentile / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) {
    return sorted[lower]
  }

  // Linear interpolation between adjacent values
  const weight = index - lower
  const interpolated = sorted[lower] * (1 - weight) + sorted[upper] * weight

  return roundFinancial(interpolated, 4)
}

/**
 * Calculate compound annual growth rate (CAGR)
 * Used for business growth analysis
 *
 * @param beginningValue - Starting value
 * @param endingValue - Ending value
 * @param periods - Number of periods (years, months, etc.)
 * @returns CAGR as percentage
 */
export function calculateCagr(beginningValue: number, endingValue: number, periods: number): number {
  if (beginningValue <= 0) {
    throw new Error('Beginning value must be positive')
  }

  if (endingValue <= 0) {
    throw new Error('Ending value must be positive')
  }

  if (periods <= 0) {
    throw new Error('Number of periods must be positive')
  }

  const cagr = (Math.pow(endingValue / beginningValue, 1 / periods) - 1) * 100

  return roundFinancial(cagr, 2)
}

/**
 * Check if two financial amounts are approximately equal
 * Accounts for floating-point precision issues
 *
 * @param amount1 - First amount
 * @param amount2 - Second amount
 * @param tolerance - Tolerance for comparison (default: 0.01 for penny precision)
 * @returns True if amounts are approximately equal
 */
export function isFinanciallyEqual(amount1: number, amount2: number, tolerance: number = 0.01): boolean {
  if (!isFinite(amount1) || !isFinite(amount2)) {
    throw new Error('Amounts must be finite numbers')
  }

  if (tolerance < 0) {
    throw new Error('Tolerance must be non-negative')
  }

  return Math.abs(amount1 - amount2) <= tolerance
}

/**
 * Convert between different number formats safely
 * Handles string to number conversion with validation
 *
 * @param value - Value to convert (string or number)
 * @param fieldName - Name of field for error messages
 * @returns Parsed number
 */
export function parseFinancialAmount(value: string | number, fieldName: string = 'amount'): number {
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new Error(`${fieldName} must be a finite number`)
    }
    return value
  }

  if (typeof value === 'string') {
    // Remove currency symbols and whitespace
    const cleaned = value.replace(/[$,\s]/g, '')

    if (cleaned === '') {
      throw new Error(`${fieldName} cannot be empty`)
    }

    const parsed = parseFloat(cleaned)

    if (!isFinite(parsed)) {
      throw new Error(`${fieldName} must be a valid number`)
    }

    return parsed
  }

  throw new Error(`${fieldName} must be a string or number`)
}

/**
 * Calculate return on investment (ROI)
 * Measures efficiency of investment in equipment, inventory, etc.
 *
 * @param gain - Investment gain (profit)
 * @param cost - Investment cost
 * @returns ROI as percentage
 */
export function calculateRoi(gain: number, cost: number): number {
  if (!isFinite(gain) || !isFinite(cost)) {
    throw new Error('Gain and cost must be finite numbers')
  }

  if (cost === 0) {
    throw new Error('Investment cost cannot be zero')
  }

  const roi = (gain / Math.abs(cost)) * 100

  return roundFinancial(roi, 2)
}

/**
 * Calculate break-even point in units
 * Determines how many units need to be sold to cover fixed costs
 *
 * @param fixedCosts - Total fixed costs
 * @param pricePerUnit - Selling price per unit
 * @param variableCostPerUnit - Variable cost per unit
 * @returns Break-even point in units
 */
export function calculateBreakEvenUnits(
  fixedCosts: number,
  pricePerUnit: number,
  variableCostPerUnit: number
): number {
  if (fixedCosts < 0) {
    throw new Error('Fixed costs must be non-negative')
  }

  if (pricePerUnit <= 0) {
    throw new Error('Price per unit must be positive')
  }

  if (variableCostPerUnit < 0) {
    throw new Error('Variable cost per unit must be non-negative')
  }

  const contributionMargin = pricePerUnit - variableCostPerUnit

  if (contributionMargin <= 0) {
    throw new Error('Price per unit must be greater than variable cost per unit')
  }

  const breakEvenUnits = fixedCosts / contributionMargin

  return Math.ceil(breakEvenUnits) // Round up to whole units
}