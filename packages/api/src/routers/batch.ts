import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import { db, batches, batchCompositions, vendors, baseFruitVarieties, purchaseItems, vessels, batchMeasurements, batchAdditives, applePressRuns, basefruitPurchaseItems, basefruitPurchases, batchMergeHistory, batchTransfers } from 'db'
import { eq, and, isNull, desc, asc, sql, or, like } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const batchIdSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID')
})

const listBatchesSchema = z.object({
  status: z.enum(['planned', 'active', 'packaged']).optional(),
  vesselId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'startDate', 'status']).default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeDeleted: z.boolean().default(false),
})

const addMeasurementSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  measurementDate: z.date().or(z.string().transform(val => new Date(val))),
  specificGravity: z.number().min(0.990).max(1.200).optional(),
  abv: z.number().min(0).max(20).optional(),
  ph: z.number().min(2).max(5).optional(),
  totalAcidity: z.number().min(0).max(20).optional(),
  temperature: z.number().min(0).max(40).optional(),
  volumeL: z.number().positive().optional(),
  notes: z.string().optional(),
  takenBy: z.string().optional(),
})

const addAdditiveSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  additiveType: z.string().min(1, 'Additive type is required'),
  additiveName: z.string().min(1, 'Additive name is required'),
  amount: z.number().positive('Amount must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  notes: z.string().optional(),
  addedBy: z.string().optional(),
})

const updateBatchSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  status: z.enum(['planned', 'active', 'packaged']).optional(),
  customName: z.string().optional(),
  endDate: z.date().or(z.string().transform(val => new Date(val))).optional(),
  notes: z.string().optional(),
})

/**
 * Batch Router
 * Provides batch metadata and composition details for UI display
 * RBAC: Viewer and above can read batch data
 */
export const batchRouter = router({
  /**
   * Get batch composition details
   * Returns array of composition entries with vendor, variety, and cost information
   */
  getComposition: createRbacProcedure('read', 'batch')
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        // First verify the batch exists
        const batchExists = await db
          .select({ id: batches.id })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!batchExists.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        // Get composition details with optimized single query
        const compositionData = await db
          .select({
            vendorName: vendors.name,
            varietyName: baseFruitVarieties.name,
            lotCode: batchCompositions.lotCode,
            inputWeightKg: batchCompositions.inputWeightKg,
            juiceVolumeL: batchCompositions.juiceVolumeL,
            fractionOfBatch: batchCompositions.fractionOfBatch,
            materialCost: batchCompositions.materialCost,
            avgBrix: batchCompositions.avgBrix,
          })
          .from(batchCompositions)
          .innerJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .innerJoin(baseFruitVarieties, eq(batchCompositions.varietyId, baseFruitVarieties.id))
          .where(and(
            eq(batchCompositions.batchId, input.batchId),
            isNull(batchCompositions.deletedAt)
          ))
          .orderBy(batchCompositions.fractionOfBatch) // Order by fraction for consistent display

        // Convert string fields to numbers for the response
        return compositionData.map(item => ({
          vendorName: item.vendorName,
          varietyName: item.varietyName,
          lotCode: item.lotCode || '',
          inputWeightKg: parseFloat(item.inputWeightKg || '0'),
          juiceVolumeL: parseFloat(item.juiceVolumeL || '0'),
          fractionOfBatch: parseFloat(item.fractionOfBatch || '0'),
          materialCost: parseFloat(item.materialCost || '0'),
          avgBrix: item.avgBrix ? parseFloat(item.avgBrix) : undefined,
        }))
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error getting batch composition:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get batch composition'
        })
      }
    }),

  /**
   * Get batch metadata
   * Returns basic batch information for UI display
   */
  get: createRbacProcedure('read', 'batch')
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        // Get batch metadata with vessel information
        const batchData = await db
          .select({
            id: batches.id,
            name: batches.name,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            startDate: batches.startDate,
            endDate: batches.endDate,
            originPressRunId: batches.originPressRunId,
            createdAt: batches.createdAt,
            updatedAt: batches.updatedAt,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!batchData.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        const batch = batchData[0]

        return {
          id: batch.id,
          name: batch.name,
          status: batch.status,
          vesselId: batch.vesselId,
          vesselName: batch.vesselName,
          startDate: batch.startDate,
          endDate: batch.endDate,
          originPressRunId: batch.originPressRunId,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error getting batch metadata:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get batch metadata'
        })
      }
    }),

  /**
   * List all batches with filtering and pagination
   */
  list: createRbacProcedure('list', 'batch')
    .input(listBatchesSchema.optional())
    .query(async ({ input = {} }) => {
      try {
        // Build WHERE conditions
        const conditions = []

        // Only exclude deleted batches if includeDeleted is false
        if (!input.includeDeleted) {
          conditions.push(isNull(batches.deletedAt))
        }

        if (input.status) {
          conditions.push(eq(batches.status, input.status))
        }

        if (input.vesselId) {
          conditions.push(eq(batches.vesselId, input.vesselId))
        }

        if (input.search) {
          conditions.push(like(batches.name, `%${input.search}%`))
        }

        // Build ORDER BY clause
        const sortColumn = {
          name: batches.name,
          startDate: batches.startDate,
          status: batches.status,
        }[input.sortBy || 'startDate']

        const orderBy = input.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

        // Query batches with vessel info
        const batchesList = await db
          .select({
            id: batches.id,
            name: batches.name,
            customName: batches.customName,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            vesselCapacity: vessels.capacityL,
            currentVolumeL: batches.currentVolumeL,
            startDate: batches.startDate,
            endDate: batches.endDate,
            originPressRunId: batches.originPressRunId,
            createdAt: batches.createdAt,
            updatedAt: batches.updatedAt,
            deletedAt: batches.deletedAt,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(orderBy)
          .limit(input.limit || 50)
          .offset(input.offset || 0)

        // Get total count for pagination
        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(batches)
          .where(conditions.length > 0 ? and(...conditions) : undefined)

        const totalCount = totalCountResult[0]?.count || 0

        // Get latest measurements for each batch
        const batchIds = batchesList.map(b => b.id)
        let batchMeasurementsMap: Record<string, any> = {}

        if (batchIds.length > 0) {
          const measurementData = await db
            .select({
              batchId: batchMeasurements.batchId,
              volumeL: batchMeasurements.volumeL,
              specificGravity: batchMeasurements.specificGravity,
              ph: batchMeasurements.ph,
              temperature: batchMeasurements.temperature,
              measurementDate: batchMeasurements.measurementDate,
            })
            .from(batchMeasurements)
            .where(and(
              sql`${batchMeasurements.batchId} IN (${sql.join(batchIds.map(id => sql`${id}`), sql`, `)})`,
              isNull(batchMeasurements.deletedAt)
            ))
            .orderBy(desc(batchMeasurements.measurementDate))

          // Get the latest measurements for each batch
          measurementData.forEach(row => {
            if (!batchMeasurementsMap[row.batchId]) {
              batchMeasurementsMap[row.batchId] = {
                volumeL: row.volumeL ? parseFloat(row.volumeL.toString()) : null,
                specificGravity: row.specificGravity,
                ph: row.ph,
                temperature: row.temperature,
                measurementDate: row.measurementDate
              }
            }
          })
        }

        // Calculate days active for each batch
        const enhancedBatches = batchesList.map(batch => {
          const startDate = new Date(batch.startDate)
          const endDate = batch.endDate ? new Date(batch.endDate) : new Date()
          const daysActive = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const measurement = batchMeasurementsMap[batch.id] || {}

          // Use batch's currentVolumeL or fall back to latest measurement
          const currentVolume = batch.currentVolumeL ?
            parseFloat(batch.currentVolumeL.toString()) :
            (measurement.volumeL || 0)

          return {
            ...batch,
            currentVolume,
            currentVolumeL: batch.currentVolumeL,
            daysActive,
            latestMeasurement: measurement
          }
        })

        return {
          batches: enhancedBatches,
          pagination: {
            total: totalCount,
            limit: input.limit || 50,
            offset: input.offset || 0,
            hasMore: (input.offset || 0) + (input.limit || 50) < totalCount,
          },
        }
      } catch (error) {
        console.error('Error listing batches:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list batches'
        })
      }
    }),

  /**
   * Get complete batch history including origin, measurements, and additives
   */
  getHistory: createRbacProcedure('read', 'batch')
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        // Get batch with full details
        const batchData = await db
          .select({
            id: batches.id,
            name: batches.name,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            startDate: batches.startDate,
            endDate: batches.endDate,
            originPressRunId: batches.originPressRunId,
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!batchData.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        const batch = batchData[0]

        // Get composition with full origin details
        const composition = await db
          .select({
            vendorName: vendors.name,
            varietyName: baseFruitVarieties.name,
            inputWeightKg: batchCompositions.inputWeightKg,
            juiceVolumeL: batchCompositions.juiceVolumeL,
            fractionOfBatch: batchCompositions.fractionOfBatch,
            materialCost: batchCompositions.materialCost,
            avgBrix: batchCompositions.avgBrix,
          })
          .from(batchCompositions)
          .innerJoin(vendors, eq(batchCompositions.vendorId, vendors.id))
          .innerJoin(baseFruitVarieties, eq(batchCompositions.varietyId, baseFruitVarieties.id))
          .where(and(
            eq(batchCompositions.batchId, input.batchId),
            isNull(batchCompositions.deletedAt)
          ))
          .orderBy(desc(batchCompositions.fractionOfBatch))

        // Get all measurements
        const measurements = await db
          .select({
            id: batchMeasurements.id,
            measurementDate: batchMeasurements.measurementDate,
            specificGravity: batchMeasurements.specificGravity,
            abv: batchMeasurements.abv,
            ph: batchMeasurements.ph,
            totalAcidity: batchMeasurements.totalAcidity,
            temperature: batchMeasurements.temperature,
            volumeL: batchMeasurements.volumeL,
            notes: batchMeasurements.notes,
            takenBy: batchMeasurements.takenBy,
          })
          .from(batchMeasurements)
          .where(and(
            eq(batchMeasurements.batchId, input.batchId),
            isNull(batchMeasurements.deletedAt)
          ))
          .orderBy(desc(batchMeasurements.measurementDate))

        // Get all additives
        const additives = await db
          .select({
            id: batchAdditives.id,
            additiveType: batchAdditives.additiveType,
            additiveName: batchAdditives.additiveName,
            amount: batchAdditives.amount,
            unit: batchAdditives.unit,
            notes: batchAdditives.notes,
            addedAt: batchAdditives.addedAt,
            addedBy: batchAdditives.addedBy,
          })
          .from(batchAdditives)
          .where(and(
            eq(batchAdditives.batchId, input.batchId),
            isNull(batchAdditives.deletedAt)
          ))
          .orderBy(desc(batchAdditives.addedAt))

        // Get origin press run details if available
        let originDetails = null
        if (batch.originPressRunId) {
          const pressRunData = await db
            .select({
              id: applePressRuns.id,
              pressRunName: applePressRuns.pressRunName,
              pressedDate: applePressRuns.startTime,
              totalAppleWeightKg: applePressRuns.totalAppleWeightKg,
              totalJuiceVolumeL: applePressRuns.totalJuiceVolumeL,
              extractionRate: applePressRuns.extractionRate,
            })
            .from(applePressRuns)
            .where(eq(applePressRuns.id, batch.originPressRunId))
            .limit(1)

          if (pressRunData.length) {
            originDetails = pressRunData[0]
          }
        }

        return {
          batch,
          origin: originDetails,
          composition: composition.map(item => ({
            vendorName: item.vendorName,
            varietyName: item.varietyName,
            inputWeightKg: parseFloat(item.inputWeightKg || '0'),
            juiceVolumeL: parseFloat(item.juiceVolumeL || '0'),
            fractionOfBatch: parseFloat(item.fractionOfBatch || '0'),
            materialCost: parseFloat(item.materialCost || '0'),
            avgBrix: item.avgBrix ? parseFloat(item.avgBrix) : undefined,
          })),
          measurements: measurements.map(m => ({
            ...m,
            specificGravity: m.specificGravity ? parseFloat(m.specificGravity.toString()) : undefined,
            abv: m.abv ? parseFloat(m.abv.toString()) : undefined,
            ph: m.ph ? parseFloat(m.ph.toString()) : undefined,
            totalAcidity: m.totalAcidity ? parseFloat(m.totalAcidity.toString()) : undefined,
            temperature: m.temperature ? parseFloat(m.temperature.toString()) : undefined,
            volumeL: m.volumeL ? parseFloat(m.volumeL.toString()) : undefined,
          })),
          additives: additives.map(a => ({
            ...a,
            amount: parseFloat(a.amount.toString()),
          })),
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error getting batch history:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get batch history'
        })
      }
    }),

  /**
   * Add measurement to batch
   */
  addMeasurement: createRbacProcedure('create', 'batch')
    .input(addMeasurementSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists
        const batchExists = await db
          .select({ id: batches.id })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!batchExists.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        // Create measurement
        const newMeasurement = await db
          .insert(batchMeasurements)
          .values({
            batchId: input.batchId,
            measurementDate: input.measurementDate,
            specificGravity: input.specificGravity?.toString(),
            abv: input.abv?.toString(),
            ph: input.ph?.toString(),
            totalAcidity: input.totalAcidity?.toString(),
            temperature: input.temperature?.toString(),
            volumeL: input.volumeL?.toString(),
            notes: input.notes,
            takenBy: input.takenBy,
          })
          .returning()

        return {
          success: true,
          measurement: newMeasurement[0],
          message: 'Measurement added successfully'
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error adding measurement:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add measurement'
        })
      }
    }),

  /**
   * Add additive to batch
   */
  addAdditive: createRbacProcedure('create', 'batch')
    .input(addAdditiveSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists and get vessel ID
        const batchData = await db
          .select({
            id: batches.id,
            vesselId: batches.vesselId
          })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!batchData.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        if (!batchData[0].vesselId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Batch is not assigned to a vessel'
          })
        }

        // Create additive record
        const newAdditive = await db
          .insert(batchAdditives)
          .values({
            batchId: input.batchId,
            vesselId: batchData[0].vesselId,
            additiveType: input.additiveType,
            additiveName: input.additiveName,
            amount: input.amount.toString(),
            unit: input.unit,
            notes: input.notes,
            addedBy: input.addedBy,
          })
          .returning()

        return {
          success: true,
          additive: newAdditive[0],
          message: 'Additive added successfully'
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error adding additive:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add additive'
        })
      }
    }),

  /**
   * Update batch status and metadata
   */
  update: createRbacProcedure('update', 'batch')
    .input(updateBatchSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists
        const existingBatch = await db
          .select()
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!existingBatch.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        // Build update object
        const updateData: any = {
          updatedAt: new Date(),
        }

        if (input.status) updateData.status = input.status
        if (input.customName !== undefined) updateData.customName = input.customName
        if (input.endDate) updateData.endDate = input.endDate

        // Update batch
        const updatedBatch = await db
          .update(batches)
          .set(updateData)
          .where(eq(batches.id, input.batchId))
          .returning()

        return {
          success: true,
          batch: updatedBatch[0],
          message: 'Batch updated successfully'
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error updating batch:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update batch'
        })
      }
    }),

  /**
   * Delete batch (soft delete)
   */
  delete: createRbacProcedure('delete', 'batch')
    .input(batchIdSchema)
    .mutation(async ({ input }) => {
      try {
        // Verify batch exists and get vessel info
        const existingBatch = await db
          .select({ status: batches.status, vesselId: batches.vesselId })
          .from(batches)
          .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
          .limit(1)

        if (!existingBatch.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        const batch = existingBatch[0]

        // Soft delete batch
        await db
          .update(batches)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batches.id, input.batchId))

        // Update vessel status to needs_cleaning if batch was in a vessel
        if (batch.vesselId) {
          await db
            .update(vessels)
            .set({
              status: 'cleaning',
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, batch.vesselId))
        }

        return {
          success: true,
          message: 'Batch deleted successfully'
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error deleting batch:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete batch'
        })
      }
    }),

  /**
   * Get complete batch activity history
   * Returns all events related to this batch in chronological order
   */
  getActivityHistory: createRbacProcedure('read', 'batch')
    .input(batchIdSchema.extend({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input }) => {
      try {
        // Get batch details including creation
        const batch = await db
          .select({
            id: batches.id,
            name: batches.name,
            createdAt: batches.startDate,
            initialVolumeL: batches.initialVolumeL,
            currentVolumeL: batches.currentVolumeL,
            status: batches.status,
            vesselId: batches.vesselId,
            vesselName: vessels.name,
            originPressRunId: batches.originPressRunId,
            pressRunName: applePressRuns.pressRunName
          })
          .from(batches)
          .leftJoin(vessels, eq(batches.vesselId, vessels.id))
          .leftJoin(applePressRuns, eq(batches.originPressRunId, applePressRuns.id))
          .where(eq(batches.id, input.batchId))
          .limit(1)

        if (!batch.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          })
        }

        const activities: any[] = []

        // Add batch creation event
        activities.push({
          id: `creation-${batch[0].id}`,
          type: 'creation',
          timestamp: batch[0].createdAt,
          description: `Batch created from ${batch[0].pressRunName ? `Press Run ${batch[0].pressRunName}` : 'manual entry'}`,
          details: batch[0].initialVolumeL || batch[0].vesselName ? {
            initialVolume: batch[0].initialVolumeL || null,
            vessel: batch[0].vesselName || null
          } : {}
        })

        // Get measurements
        const measurements = await db
          .select({
            id: batchMeasurements.id,
            measurementDate: batchMeasurements.measurementDate,
            specificGravity: batchMeasurements.specificGravity,
            abv: batchMeasurements.abv,
            ph: batchMeasurements.ph,
            totalAcidity: batchMeasurements.totalAcidity,
            temperature: batchMeasurements.temperature,
            volumeL: batchMeasurements.volumeL,
            notes: batchMeasurements.notes,
            takenBy: batchMeasurements.takenBy
          })
          .from(batchMeasurements)
          .where(and(
            eq(batchMeasurements.batchId, input.batchId),
            isNull(batchMeasurements.deletedAt)
          ))

        measurements.forEach(m => {
          const details = []
          if (m.specificGravity) details.push(`SG: ${m.specificGravity}`)
          if (m.abv) details.push(`ABV: ${m.abv}%`)
          if (m.ph) details.push(`pH: ${m.ph}`)
          if (m.totalAcidity) details.push(`TA: ${m.totalAcidity}`)
          if (m.temperature) details.push(`Temp: ${m.temperature}°C`)
          if (m.volumeL) details.push(`Volume: ${m.volumeL}L`)

          activities.push({
            id: `measurement-${m.id}`,
            type: 'measurement',
            timestamp: m.measurementDate,
            description: `Measurement taken${m.takenBy ? ` by ${m.takenBy}` : ''}`,
            details: details.length > 0 || m.notes ? {
              values: details.length > 0 ? details.join(', ') : null,
              notes: m.notes || null
            } : {}
          })
        })

        // Get additives
        const additives = await db
          .select({
            id: batchAdditives.id,
            addedAt: batchAdditives.addedAt,
            additiveType: batchAdditives.additiveType,
            additiveName: batchAdditives.additiveName,
            amount: batchAdditives.amount,
            unit: batchAdditives.unit,
            notes: batchAdditives.notes,
            addedBy: batchAdditives.addedBy
          })
          .from(batchAdditives)
          .where(and(
            eq(batchAdditives.batchId, input.batchId),
            isNull(batchAdditives.deletedAt)
          ))

        additives.forEach(a => {
          activities.push({
            id: `additive-${a.id}`,
            type: 'additive',
            timestamp: a.addedAt,
            description: `${a.additiveType} added: ${a.additiveName}`,
            details: {
              amount: `${a.amount} ${a.unit}`,
              addedBy: a.addedBy || null,
              notes: a.notes || null
            }
          })
        })

        // Get merge history
        const merges = await db
          .select({
            id: batchMergeHistory.id,
            mergedAt: batchMergeHistory.mergedAt,
            volumeAddedL: batchMergeHistory.volumeAddedL,
            targetVolumeBeforeL: batchMergeHistory.targetVolumeBeforeL,
            targetVolumeAfterL: batchMergeHistory.targetVolumeAfterL,
            sourceType: batchMergeHistory.sourceType,
            notes: batchMergeHistory.notes,
            pressRunName: applePressRuns.pressRunName
          })
          .from(batchMergeHistory)
          .leftJoin(applePressRuns, eq(batchMergeHistory.sourcePressRunId, applePressRuns.id))
          .where(and(
            eq(batchMergeHistory.targetBatchId, input.batchId),
            isNull(batchMergeHistory.deletedAt)
          ))

        merges.forEach(m => {
          activities.push({
            id: `merge-${m.id}`,
            type: 'merge',
            timestamp: m.mergedAt,
            description: `Merged with juice from ${m.sourceType === 'press_run' && m.pressRunName ? `Press Run ${m.pressRunName}` : 'another batch'}`,
            details: {
              volumeAdded: `${m.volumeAddedL}L`,
              volumeChange: `${m.targetVolumeBeforeL}L → ${m.targetVolumeAfterL}L`,
              notes: m.notes || null
            }
          })
        })

        // Get transfers (as source or destination)
        const transfers = await db
          .select({
            id: batchTransfers.id,
            transferredAt: batchTransfers.transferredAt,
            volumeTransferredL: batchTransfers.volumeTransferredL,
            sourceBatchId: batchTransfers.sourceBatchId,
            destinationBatchId: batchTransfers.destinationBatchId,
            sourceBatchName: sql<string>`source_batch.name`.as('sourceBatchName'),
            destBatchName: sql<string>`dest_batch.name`.as('destBatchName'),
            sourceVesselName: sql<string>`source_vessel.name`.as('sourceVesselName'),
            destVesselName: sql<string>`dest_vessel.name`.as('destVesselName'),
            notes: batchTransfers.notes
          })
          .from(batchTransfers)
          .leftJoin(sql`batches AS source_batch`, sql`source_batch.id = ${batchTransfers.sourceBatchId}`)
          .leftJoin(sql`batches AS dest_batch`, sql`dest_batch.id = ${batchTransfers.destinationBatchId}`)
          .leftJoin(sql`vessels AS source_vessel`, sql`source_vessel.id = ${batchTransfers.sourceVesselId}`)
          .leftJoin(sql`vessels AS dest_vessel`, sql`dest_vessel.id = ${batchTransfers.destinationVesselId}`)
          .where(and(
            or(
              eq(batchTransfers.sourceBatchId, input.batchId),
              eq(batchTransfers.destinationBatchId, input.batchId)
            ),
            isNull(batchTransfers.deletedAt)
          ))

        transfers.forEach(t => {
          // Check if this is a vessel move (same batch moved) or traditional transfer (different batches)
          const isSameBatch = t.sourceBatchId === t.destinationBatchId
          const isThisBatch = t.sourceBatchId === input.batchId || t.destinationBatchId === input.batchId

          if (isSameBatch) {
            // Vessel move: batch moved from one vessel to another
            activities.push({
              id: `transfer-${t.id}`,
              type: 'transfer',
              timestamp: t.transferredAt,
              description: `Moved ${t.volumeTransferredL}L from ${t.sourceVesselName || 'vessel'} to ${t.destVesselName || 'vessel'}`,
              details: {
                volume: `${t.volumeTransferredL}L`,
                fromVessel: t.sourceVesselName || null,
                toVessel: t.destVesselName || null,
                notes: t.notes || null
              }
            })
          } else {
            // Traditional transfer: different batches involved
            const isSource = t.sourceBatchId === input.batchId
            activities.push({
              id: `transfer-${t.id}`,
              type: 'transfer',
              timestamp: t.transferredAt,
              description: isSource
                ? `Transferred ${t.volumeTransferredL}L to ${t.destVesselName || 'vessel'}`
                : `Received ${t.volumeTransferredL}L from ${t.sourceVesselName || 'vessel'}`,
              details: {
                volume: `${t.volumeTransferredL}L`,
                direction: isSource ? 'outgoing' : 'incoming',
                notes: t.notes || null
              }
            })
          }
        })

        // TODO: Add packaging/bottling events when implemented

        // Sort all activities by timestamp - true chronological order (oldest to newest)
        activities.sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime()
          const dateB = new Date(b.timestamp).getTime()
          return dateA - dateB // Oldest first (chronological order)
        })

        // Apply pagination
        const totalActivities = activities.length
        const paginatedActivities = activities.slice(input.offset, input.offset + input.limit)

        return {
          batch: batch[0],
          activities: paginatedActivities,
          pagination: {
            total: totalActivities,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < totalActivities
          }
        }
      } catch (error) {
        console.error('Error fetching batch activity history:', error)
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch batch activity history'
        })
      }
    }),

  /**
   * Get batch merge history
   * Returns array of merge events for this batch
   */
  getMergeHistory: createRbacProcedure('read', 'batch')
    .input(batchIdSchema)
    .query(async ({ input }) => {
      try {
        const mergeHistory = await db
          .select({
            id: batchMergeHistory.id,
            sourcePressRunId: batchMergeHistory.sourcePressRunId,
            sourceType: batchMergeHistory.sourceType,
            volumeAddedL: batchMergeHistory.volumeAddedL,
            targetVolumeBeforeL: batchMergeHistory.targetVolumeBeforeL,
            targetVolumeAfterL: batchMergeHistory.targetVolumeAfterL,
            compositionSnapshot: batchMergeHistory.compositionSnapshot,
            notes: batchMergeHistory.notes,
            mergedAt: batchMergeHistory.mergedAt,
            pressRunName: applePressRuns.pressRunName
          })
          .from(batchMergeHistory)
          .leftJoin(applePressRuns, eq(batchMergeHistory.sourcePressRunId, applePressRuns.id))
          .where(and(
            eq(batchMergeHistory.targetBatchId, input.batchId),
            isNull(batchMergeHistory.deletedAt)
          ))
          .orderBy(desc(batchMergeHistory.mergedAt))

        return {
          mergeHistory
        }
      } catch (error) {
        console.error('Error fetching batch merge history:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch batch merge history'
        })
      }
    })
})

export type BatchRouter = typeof batchRouter