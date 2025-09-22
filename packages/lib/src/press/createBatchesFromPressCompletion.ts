import { eq, and, sql } from 'drizzle-orm'
import { type Database } from 'db'
import {
  pressRuns,
  pressItems,
  purchaseItems,
  purchases,
  vendors,
  baseFruitVarieties,
  vessels,
  batches,
  batchCompositions,
} from 'db/src/schema'
import { generateBatchNameFromComposition, type BatchComposition } from '../naming/batchName'
import { auditEventBus, publishCreateEvent } from '../audit/eventBus'

export type Assignment = {
  toVesselId: string
  volumeL: number
}

export interface CreateBatchesOptions {
  allocationMode?: 'weight' | 'sugar'
}

export interface CreateBatchesResult {
  createdBatchIds: string[]
}

/**
 * Domain service error types
 */
export class PressCompletionError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'PressCompletionError'
  }
}

export class PressValidationError extends PressCompletionError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
  }
}

export class InvariantError extends PressCompletionError {
  constructor(message: string) {
    super(message, 'INVARIANT_ERROR')
  }
}

/**
 * Internal data structures
 */
interface PressRunData {
  id: string
  totalJuiceProducedL: number
  batchesCreated?: boolean
}

interface PurchaseLineData {
  id: string
  vendorId: string
  varietyId: string
  varietyName: string
  lotCode?: string
  inputWeightKg: number
  unitCost: number
  totalCost: number
  brixMeasured?: number
}

interface AllocationFraction {
  purchaseItemId: string
  fraction: number
  sugarWeight?: number
}

/**
 * Creates batches from a completed press run, allocating juice volumes to vessels
 * with proper composition tracking and cost allocation.
 *
 * @param db - Database connection
 * @param pressRunId - ID of the completed press run
 * @param assignments - Array of vessel assignments with volumes
 * @param opts - Optional configuration for allocation mode
 * @returns Promise with array of created batch IDs
 */
export async function createBatchesFromPressCompletion(
  db: Database,
  pressRunId: string,
  assignments: Assignment[],
  opts: CreateBatchesOptions = {}
): Promise<CreateBatchesResult> {
  const { allocationMode = 'weight' } = opts

  // Step 1: Validate inputs and load data
  const { pressRunData, purchaseLines } = await validateAndLoadData(db, pressRunId, assignments)

  // Step 2: Compute allocation fractions
  const fractions = computeAllocationFractions(purchaseLines, allocationMode)

  // Step 3: Create batches for each assignment
  const createdBatchIds: string[] = []

  for (const assignment of assignments) {
    const batchId = await createBatchForAssignment(
      db,
      pressRunData,
      assignment,
      purchaseLines,
      fractions
    )
    createdBatchIds.push(batchId)
  }

  // Step 4: Finalize press run (mark as processed)
  await finalizePressRun(db, pressRunId)

  return { createdBatchIds }
}

/**
 * Step 1: Validate inputs and load source data
 */
async function validateAndLoadData(
  db: Database,
  pressRunId: string,
  assignments: Assignment[]
): Promise<{ pressRunData: PressRunData; purchaseLines: PurchaseLineData[] }> {
  // Load press run data
  const pressRunResult = await db
    .select({
      id: pressRuns.id,
      totalJuiceProducedL: pressRuns.totalJuiceProducedL,
    })
    .from(pressRuns)
    .where(eq(pressRuns.id, pressRunId))
    .limit(1)

  if (pressRunResult.length === 0) {
    throw new PressValidationError(`Press run not found: ${pressRunId}`)
  }

  const pressRunData = pressRunResult[0]

  // Check for idempotency - verify no batches already created for this press run
  const existingBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(eq(batches.originPressRunId, pressRunId))
    .limit(1)

  if (existingBatches.length > 0) {
    throw new PressValidationError(`Batches already created for press run: ${pressRunId}`)
  }

  // Validate assignment volumes
  const totalAssignedVolume = assignments.reduce((sum, a) => sum + a.volumeL, 0)
  const availableVolume = Number(pressRunData.totalJuiceProducedL)

  if (totalAssignedVolume > availableVolume + 0.001) { // Allow 1mL tolerance
    throw new PressValidationError(
      `Total assigned volume (${totalAssignedVolume}L) exceeds available juice (${availableVolume}L)`
    )
  }

  // Validate vessel assignments
  for (const assignment of assignments) {
    if (assignment.volumeL <= 0) {
      throw new PressValidationError(`Invalid volume assignment: ${assignment.volumeL}L`)
    }

    // Check that vessel exists and has capacity
    const vesselResult = await db
      .select({
        id: vessels.id,
        capacityL: vessels.capacityL,
        name: vessels.name
      })
      .from(vessels)
      .where(eq(vessels.id, assignment.toVesselId))
      .limit(1)

    if (vesselResult.length === 0) {
      throw new PressValidationError(`Vessel not found: ${assignment.toVesselId}`)
    }

    const vessel = vesselResult[0]
    const vesselCapacity = Number(vessel.capacityL)

    if (assignment.volumeL > vesselCapacity + 0.001) { // Allow 1mL tolerance
      throw new PressValidationError(
        `Assignment volume (${assignment.volumeL}L) exceeds vessel capacity (${vesselCapacity}L) for vessel ${vessel.name}`
      )
    }
  }

  // Load purchase line data with vendor and variety info
  const purchaseLines = await db
    .select({
      id: purchaseItems.id,
      vendorId: vendors.id,
      varietyId: baseFruitVarieties.id,
      varietyName: baseFruitVarieties.name,
      lotCode: purchaseItems.notes, // Assuming lot code is stored in notes for now
      inputWeightKg: pressItems.quantityUsedKg,
      unitCost: purchaseItems.pricePerUnit,
      totalCost: purchaseItems.totalCost,
      brixMeasured: pressItems.brixMeasured,
    })
    .from(pressItems)
    .innerJoin(purchaseItems, eq(pressItems.purchaseItemId, purchaseItems.id))
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .innerJoin(vendors, eq(purchases.vendorId, vendors.id))
    .innerJoin(baseFruitVarieties, eq(purchaseItems.fruitVarietyId, baseFruitVarieties.id))
    .where(eq(pressItems.pressRunId, pressRunId))

  if (purchaseLines.length === 0) {
    throw new PressValidationError(`No purchase lines found for press run: ${pressRunId}`)
  }

  return {
    pressRunData: {
      id: pressRunData.id,
      totalJuiceProducedL: Number(pressRunData.totalJuiceProducedL)
    },
    purchaseLines: purchaseLines.map(line => ({
      id: line.id,
      vendorId: line.vendorId,
      varietyId: line.varietyId,
      varietyName: line.varietyName,
      lotCode: line.lotCode || undefined,
      inputWeightKg: Number(line.inputWeightKg),
      unitCost: Number(line.unitCost || 0),
      totalCost: Number(line.totalCost || 0),
      brixMeasured: line.brixMeasured ? Number(line.brixMeasured) : undefined,
    }))
  }
}

/**
 * Step 2: Compute allocation fractions based on weight or sugar content
 */
function computeAllocationFractions(
  purchaseLines: PurchaseLineData[],
  allocationMode: 'weight' | 'sugar'
): AllocationFraction[] {
  if (allocationMode === 'weight') {
    const totalWeight = purchaseLines.reduce((sum, line) => sum + line.inputWeightKg, 0)

    if (totalWeight <= 0) {
      throw new InvariantError('Total input weight must be greater than zero')
    }

    return purchaseLines.map(line => ({
      purchaseItemId: line.id,
      fraction: line.inputWeightKg / totalWeight
    }))
  } else {
    // Sugar-weighted allocation
    const linesWithSugar = purchaseLines.map(line => {
      const brix = line.brixMeasured || 0
      const sugarWeight = line.inputWeightKg * (brix / 100)
      return {
        ...line,
        sugarWeight
      }
    })

    const totalSugarWeight = linesWithSugar.reduce((sum, line) => sum + line.sugarWeight, 0)

    if (totalSugarWeight <= 0) {
      throw new InvariantError('Total sugar weight must be greater than zero for sugar-based allocation')
    }

    return linesWithSugar.map(line => ({
      purchaseItemId: line.id,
      fraction: line.sugarWeight / totalSugarWeight,
      sugarWeight: line.sugarWeight
    }))
  }
}

/**
 * Step 3: Create a batch for a single vessel assignment
 */
async function createBatchForAssignment(
  db: Database,
  pressRunData: PressRunData,
  assignment: Assignment,
  purchaseLines: PurchaseLineData[],
  fractions: AllocationFraction[]
): Promise<string> {
  // Get vessel information for batch naming
  const vesselResult = await db
    .select({
      id: vessels.id,
      name: vessels.name
    })
    .from(vessels)
    .where(eq(vessels.id, assignment.toVesselId))
    .limit(1)

  if (vesselResult.length === 0) {
    throw new PressValidationError(`Vessel not found: ${assignment.toVesselId}`)
  }

  const vessel = vesselResult[0]

  // Generate batch composition for naming
  const batchCompositionsForNaming: BatchComposition[] = fractions.map(fraction => {
    const purchaseLine = purchaseLines.find(line => line.id === fraction.purchaseItemId)!
    return {
      varietyName: purchaseLine.varietyName,
      fractionOfBatch: fraction.fraction
    }
  })

  // Generate batch name
  const batchName = generateBatchNameFromComposition({
    date: new Date(),
    vesselCode: vessel.name || vessel.id.substring(0, 6).toUpperCase(),
    batchCompositions: batchCompositionsForNaming
  })

  // Create batch record with all required fields
  const newBatch = {
    vesselId: assignment.toVesselId,
    name: batchName,
    batchNumber: batchName, // Using batch name as batch number
    initialVolumeL: assignment.volumeL.toString(),
    currentVolumeL: assignment.volumeL.toString(),
    status: 'active' as const,
    startDate: new Date(),
    originPressRunId: pressRunData.id
  }

  const batchResult = await db
    .insert(batches)
    .values(newBatch)
    .returning({ id: batches.id })

  const batchId = batchResult[0].id

  // Create batch compositions
  const compositions: any[] = []
  let totalFraction = 0
  let totalJuiceVolume = 0
  let totalMaterialCost = 0

  for (const fraction of fractions) {
    const purchaseLine = purchaseLines.find(line => line.id === fraction.purchaseItemId)!

    const juiceVolumeL = assignment.volumeL * fraction.fraction
    const materialCost = purchaseLine.totalCost * fraction.fraction

    totalFraction += fraction.fraction
    totalJuiceVolume += juiceVolumeL
    totalMaterialCost += materialCost

    const composition = {
      batchId,
      purchaseItemId: purchaseLine.id,
      vendorId: purchaseLine.vendorId,
      varietyId: purchaseLine.varietyId,
      lotCode: purchaseLine.lotCode,
      inputWeightKg: purchaseLine.inputWeightKg.toString(),
      juiceVolumeL: juiceVolumeL.toString(),
      fractionOfBatch: fraction.fraction.toString(),
      materialCost: materialCost.toString(),
      avgBrix: purchaseLine.brixMeasured?.toString(),
      estSugarKg: fraction.sugarWeight?.toString()
    }

    compositions.push(composition)
  }

  // Validate invariants
  const fractionTolerance = 5e-6
  const volumeTolerance = 0.001
  const costTolerance = 0.01

  if (Math.abs(totalFraction - 1.0) > fractionTolerance) {
    throw new InvariantError(`Fraction sum (${totalFraction}) must equal 1.0 ± ${fractionTolerance}`)
  }

  if (Math.abs(totalJuiceVolume - assignment.volumeL) > volumeTolerance) {
    throw new InvariantError(`Juice volume sum (${totalJuiceVolume}L) must equal assignment volume (${assignment.volumeL}L) ± ${volumeTolerance}L`)
  }

  const expectedTotalCost = purchaseLines.reduce((sum, line) => sum + line.totalCost, 0)
  if (Math.abs(totalMaterialCost - expectedTotalCost) > costTolerance) {
    throw new InvariantError(`Material cost sum ($${totalMaterialCost}) must equal expected total ($${expectedTotalCost}) ± $${costTolerance}`)
  }

  // Insert compositions
  await db.insert(batchCompositions).values(compositions)

  // Emit audit events
  await publishCreateEvent(
    'batches',
    batchId,
    newBatch
  )

  for (const composition of compositions) {
    await publishCreateEvent(
      'batch_compositions',
      composition.batchId, // Will need actual ID after insert
      composition
    )
  }

  return batchId
}

/**
 * Step 4: Finalize the press run to prevent duplicate processing
 */
async function finalizePressRun(db: Database, pressRunId: string): Promise<void> {
  // Note: The schema doesn't seem to have a 'batchesCreated' field,
  // so we'll rely on the existence of batches with originPressRunId for idempotency
  // This could be enhanced by adding a status field to press runs in the future

  // For now, this is a no-op since we check for existing batches in validation
  // In a future enhancement, we could add:
  // await db.update(pressRuns).set({ status: 'batches_created' }).where(eq(pressRuns.id, pressRunId))
}