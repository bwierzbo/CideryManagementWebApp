/**
 * COGS (Cost of Goods Sold) calculation utilities for cidery financial tracking
 * Handles cost allocation, overhead distribution, and batch costing
 */

export interface CogsComponent {
  itemType: 'apple_cost' | 'labor' | 'overhead' | 'packaging'
  amount: number
  description?: string
  unitCost?: number
  quantity?: number
}

export interface BatchCostData {
  batchId: string
  juiceVolumeL: number
  appleWeightKg: number
  laborHours: number
  packagingUnits: number
  bottleCount: number
}

export interface CostAllocationConfig {
  appleCostPerKg: number
  laborRatePerHour: number
  overheadRatePerL: number
  packagingCostPerUnit: number
  wastageRate: number // Percentage loss expected (0-100)
}

/**
 * Calculate total COGS for a batch
 * Allocates costs across apple materials, labor, overhead, and packaging
 *
 * @param batchData - Batch production data
 * @param config - Cost allocation configuration
 * @returns Total COGS amount
 */
export function calculateTotalCogs(batchData: BatchCostData, config: CostAllocationConfig): number {
  if (batchData.juiceVolumeL <= 0) {
    throw new Error('Juice volume must be positive')
  }

  if (batchData.appleWeightKg <= 0) {
    throw new Error('Apple weight must be positive')
  }

  if (config.wastageRate < 0 || config.wastageRate > 100) {
    throw new Error('Wastage rate must be between 0 and 100 percent')
  }

  const components = calculateCogsComponents(batchData, config)
  const totalCogs = components.reduce((sum, component) => sum + component.amount, 0)

  // Round to 2 decimal places
  return Math.round(totalCogs * 100) / 100
}

/**
 * Calculate detailed COGS components breakdown
 * Provides itemized cost allocation for transparency
 *
 * @param batchData - Batch production data
 * @param config - Cost allocation configuration
 * @returns Array of COGS components with amounts
 */
export function calculateCogsComponents(batchData: BatchCostData, config: CostAllocationConfig): CogsComponent[] {
  const components: CogsComponent[] = []

  // Apple cost (adjusted for wastage)
  const appleWastageMultiplier = 1 + (config.wastageRate / 100)
  const adjustedAppleWeight = batchData.appleWeightKg * appleWastageMultiplier
  const appleCost = adjustedAppleWeight * config.appleCostPerKg

  components.push({
    itemType: 'apple_cost',
    amount: Math.round(appleCost * 100) / 100,
    description: `Apple cost for ${batchData.appleWeightKg}kg (adjusted for ${config.wastageRate}% wastage)`,
    unitCost: config.appleCostPerKg,
    quantity: adjustedAppleWeight
  })

  // Labor cost
  const laborCost = batchData.laborHours * config.laborRatePerHour
  components.push({
    itemType: 'labor',
    amount: Math.round(laborCost * 100) / 100,
    description: `Labor cost for ${batchData.laborHours} hours`,
    unitCost: config.laborRatePerHour,
    quantity: batchData.laborHours
  })

  // Overhead cost (utilities, rent, equipment depreciation)
  const overheadCost = batchData.juiceVolumeL * config.overheadRatePerL
  components.push({
    itemType: 'overhead',
    amount: Math.round(overheadCost * 100) / 100,
    description: `Overhead allocation for ${batchData.juiceVolumeL}L production`,
    unitCost: config.overheadRatePerL,
    quantity: batchData.juiceVolumeL
  })

  // Packaging cost
  const packagingCost = batchData.packagingUnits * config.packagingCostPerUnit
  components.push({
    itemType: 'packaging',
    amount: Math.round(packagingCost * 100) / 100,
    description: `Packaging cost for ${batchData.packagingUnits} units`,
    unitCost: config.packagingCostPerUnit,
    quantity: batchData.packagingUnits
  })

  return components
}

/**
 * Calculate cost per liter of finished product
 * Essential metric for pricing and profitability analysis
 *
 * @param totalCogs - Total COGS amount
 * @param finalVolumeL - Final volume of packaged product
 * @returns Cost per liter
 */
export function calculateCostPerLiter(totalCogs: number, finalVolumeL: number): number {
  if (totalCogs < 0) {
    throw new Error('Total COGS must be non-negative')
  }

  if (finalVolumeL <= 0) {
    throw new Error('Final volume must be positive')
  }

  const costPerL = totalCogs / finalVolumeL

  return Math.round(costPerL * 10000) / 10000 // 4 decimal places for precision
}

/**
 * Calculate cost per bottle
 * Used for retail pricing and margin analysis
 *
 * @param totalCogs - Total COGS amount
 * @param bottleCount - Number of bottles produced
 * @returns Cost per bottle
 */
export function calculateCostPerBottle(totalCogs: number, bottleCount: number): number {
  if (totalCogs < 0) {
    throw new Error('Total COGS must be non-negative')
  }

  if (bottleCount <= 0) {
    throw new Error('Bottle count must be positive')
  }

  const costPerBottle = totalCogs / bottleCount

  return Math.round(costPerBottle * 100) / 100
}

/**
 * Calculate gross margin percentage
 * Compares selling price to cost for profitability analysis
 *
 * @param sellingPrice - Selling price per unit
 * @param cogsCost - COGS cost per unit
 * @returns Gross margin as percentage
 */
export function calculateGrossMargin(sellingPrice: number, cogsCost: number): number {
  if (sellingPrice <= 0) {
    throw new Error('Selling price must be positive')
  }

  if (cogsCost < 0) {
    throw new Error('COGS cost must be non-negative')
  }

  if (cogsCost > sellingPrice) {
    // Allow negative margins for loss analysis
    const margin = ((sellingPrice - cogsCost) / sellingPrice) * 100
    return Math.round(margin * 100) / 100
  }

  const margin = ((sellingPrice - cogsCost) / sellingPrice) * 100

  return Math.round(margin * 100) / 100
}

/**
 * Calculate markup percentage
 * Shows how much the selling price exceeds the cost
 *
 * @param sellingPrice - Selling price per unit
 * @param cogsCost - COGS cost per unit
 * @returns Markup as percentage
 */
export function calculateMarkup(sellingPrice: number, cogsCost: number): number {
  if (sellingPrice <= 0) {
    throw new Error('Selling price must be positive')
  }

  if (cogsCost <= 0) {
    throw new Error('COGS cost must be positive for markup calculation')
  }

  const markup = ((sellingPrice - cogsCost) / cogsCost) * 100

  return Math.round(markup * 100) / 100
}

/**
 * Allocate shared costs across multiple batches
 * Distributes overhead costs proportionally by volume
 *
 * @param sharedCost - Total shared cost to allocate
 * @param batches - Array of batches with volumes
 * @returns Array of allocated costs per batch
 */
export function allocateSharedCosts(
  sharedCost: number,
  batches: Array<{ batchId: string; volumeL: number }>
): Array<{ batchId: string; allocatedCost: number }> {
  if (sharedCost < 0) {
    throw new Error('Shared cost must be non-negative')
  }

  if (batches.length === 0) {
    throw new Error('At least one batch is required for cost allocation')
  }

  const totalVolume = batches.reduce((sum, batch) => {
    if (batch.volumeL <= 0) {
      throw new Error(`Batch ${batch.batchId} volume must be positive`)
    }
    return sum + batch.volumeL
  }, 0)

  return batches.map(batch => ({
    batchId: batch.batchId,
    allocatedCost: Math.round((sharedCost * batch.volumeL / totalVolume) * 100) / 100
  }))
}

/**
 * Calculate yield variance impact on costs
 * Shows how yield performance affects per-unit costs
 *
 * @param expectedYield - Expected yield ratio (L/kg)
 * @param actualYield - Actual yield achieved (L/kg)
 * @param baseCostPerL - Base cost per liter at expected yield
 * @returns Adjusted cost per liter based on actual yield
 */
export function calculateYieldVarianceCostImpact(
  expectedYield: number,
  actualYield: number,
  baseCostPerL: number
): number {
  if (expectedYield <= 0 || actualYield <= 0) {
    throw new Error('Yield values must be positive')
  }

  if (baseCostPerL < 0) {
    throw new Error('Base cost per liter must be non-negative')
  }

  // Cost per liter increases when actual yield is lower than expected
  const yieldRatio = expectedYield / actualYield
  const adjustedCost = baseCostPerL * yieldRatio

  return Math.round(adjustedCost * 10000) / 10000
}

/**
 * Get COGS performance category based on cost variance
 * Provides qualitative assessment of cost performance
 *
 * @param actualCogs - Actual COGS achieved
 * @param budgetedCogs - Budgeted/target COGS
 * @returns Performance category string
 */
export function getCogsPerformanceCategory(actualCogs: number, budgetedCogs: number): string {
  if (actualCogs < 0 || budgetedCogs <= 0) {
    throw new Error('COGS values must be positive')
  }

  const variance = ((actualCogs - budgetedCogs) / budgetedCogs) * 100

  if (variance <= -10) return 'Excellent' // 10%+ under budget
  if (variance <= -5) return 'Good' // 5-10% under budget
  if (variance <= 5) return 'On Target' // Within 5% of budget
  if (variance <= 15) return 'Over Budget' // 5-15% over budget
  return 'Significantly Over Budget' // 15%+ over budget
}

/**
 * Calculate inventory valuation using FIFO method
 * Values remaining inventory at current COGS
 *
 * @param inventoryBottles - Number of bottles in inventory
 * @param recentCogsPerBottle - Most recent COGS per bottle
 * @returns Total inventory value
 */
export function calculateInventoryValue(inventoryBottles: number, recentCogsPerBottle: number): number {
  if (inventoryBottles < 0) {
    throw new Error('Inventory bottles must be non-negative')
  }

  if (recentCogsPerBottle < 0) {
    throw new Error('COGS per bottle must be non-negative')
  }

  const inventoryValue = inventoryBottles * recentCogsPerBottle

  return Math.round(inventoryValue * 100) / 100
}