import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import { db, applePressRuns, applePressRunLoads, vendors, vessels, basefruitPurchaseItems, basefruitPurchases, baseFruitVarieties, auditLog, users, batches, batchCompositions } from 'db'
import { eq, and, desc, asc, sql, isNull, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { publishCreateEvent, publishUpdateEvent, publishDeleteEvent } from 'lib'
import { generateBatchNameFromComposition, type BatchComposition } from 'lib'

// Input validation schemas
const createPressRunSchema = z.object({
  scheduledDate: z.date().or(z.string().transform(val => new Date(val))).optional(),
  startTime: z.date().or(z.string().transform(val => new Date(val))).optional(),
  notes: z.string().optional(),
  pressingMethod: z.string().optional(),
  weatherConditions: z.string().optional(),
})

const addLoadSchema = z.object({
  pressRunId: z.string().uuid('Invalid press run ID'),
  vendorId: z.string().uuid('Invalid vendor ID'),
  purchaseItemId: z.string().uuid('Invalid purchase item ID'),
  fruitVarietyId: z.string().uuid('Invalid fruit variety ID'),
  appleWeightKg: z.number().positive('Apple weight must be positive'),
  originalWeight: z.number().positive('Original weight must be positive'),
  originalWeightUnit: z.enum(['kg', 'lb', 'bushel']),
  brixMeasured: z.number().min(0).max(30).optional(),
  phMeasured: z.number().min(2).max(5).optional(),
  appleCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  defectPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

const updateLoadSchema = z.object({
  loadId: z.string().uuid('Invalid load ID'),
  vendorId: z.string().uuid('Invalid vendor ID'),
  purchaseItemId: z.string().uuid('Invalid purchase item ID'),
  fruitVarietyId: z.string().uuid('Invalid fruit variety ID'),
  appleWeightKg: z.number().positive('Apple weight must be positive'),
  originalWeight: z.number().positive('Original weight must be positive'),
  originalWeightUnit: z.enum(['kg', 'lb', 'bushel']),
  brixMeasured: z.number().min(0).max(30).optional(),
  phMeasured: z.number().min(2).max(5).optional(),
  appleCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  defectPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

const deleteLoadSchema = z.object({
  loadId: z.string().uuid('Invalid load ID'),
})

const completeSchema = z.object({
  pressRunId: z.string().uuid('Invalid press run ID'),
  assignments: z.array(z.object({
    toVesselId: z.string().uuid('Invalid vessel ID'),
    volumeL: z.number().positive('Volume must be positive'),
  })).min(1, 'At least one vessel assignment is required'),
  totalJuiceVolumeL: z.number().positive('Total juice volume must be positive').optional(),
  depletedPurchaseItemIds: z.array(z.string().uuid()).optional(),
})

const finishPressRunSchema = z.object({
  pressRunId: z.string().uuid('Invalid press run ID'),
  completionDate: z.date().or(z.string().transform(val => new Date(val))),
  vesselId: z.string().uuid('Invalid vessel ID'),
  totalJuiceVolumeL: z.number().positive('Juice volume must be positive'),
  laborHours: z.number().min(0).optional(),
  laborCostPerHour: z.number().min(0).optional(),
  notes: z.string().optional(),
  loads: z.array(z.object({
    loadId: z.string().uuid('Invalid load ID'),
    juiceVolumeL: z.number().positive('Juice volume must be positive'),
    originalVolume: z.number().positive('Original volume must be positive'),
    originalVolumeUnit: z.enum(['L', 'gal']),
    brixMeasured: z.number().min(0).max(30).optional(),
    phMeasured: z.number().min(2).max(5).optional(),
  })).min(1, 'At least one load with juice volume is required'),
})

const listPressRunsSchema = z.object({
  status: z.enum(['draft', 'in_progress', 'completed', 'cancelled']).optional(),
  vendorId: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['created', 'scheduled', 'started', 'updated']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const pressRunRouter = router({
  // Create new press run - admin/operator only
  create: createRbacProcedure('create', 'press_run')
    .input(createPressRunSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Create new press run (name will be set when completed)
          const newPressRun = await tx
            .insert(applePressRuns)
            .values({
              pressRunName: null, // Name will be set when completing the press run
              status: 'in_progress',
              scheduledDate: input.scheduledDate ? input.scheduledDate.toISOString().split('T')[0] : null,
              startTime: input.startTime || new Date(),
              notes: input.notes,
              pressingMethod: input.pressingMethod,
              weatherConditions: input.weatherConditions,
              createdBy: ctx.session?.user?.id,
              updatedBy: ctx.session?.user?.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()

          const pressRunId = newPressRun[0].id

          // Publish audit event
          await publishCreateEvent(
            'apple_press_runs',
            pressRunId,
            {
              pressRunId,
              status: 'in_progress',
              scheduledDate: input.scheduledDate,
            },
            ctx.session?.user?.id,
            'Press run created via mobile app'
          )

          return {
            success: true,
            pressRun: newPressRun[0],
            message: 'Press run created successfully',
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error creating press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create press run'
        })
      }
    }),

  // Add fruit load to press run - admin/operator only
  addLoad: createRbacProcedure('update', 'press_run')
    .input(addLoadSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify press run exists and is editable - lock the row to prevent concurrent modifications
          const pressRun = await tx
            .select()
            .from(applePressRuns)
            .where(and(eq(applePressRuns.id, input.pressRunId), isNull(applePressRuns.deletedAt)))
            .limit(1)
            .for('update')

          if (!pressRun.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Press run not found'
            })
          }

          if (pressRun[0].status === 'completed' || pressRun[0].status === 'cancelled') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot add loads to completed or cancelled press run'
            })
          }

          // Verify purchase item exists, is not depleted, and has enough quantity
          const purchaseItem = await tx
            .select()
            .from(basefruitPurchaseItems)
            .where(and(
              eq(basefruitPurchaseItems.id, input.purchaseItemId),
              isNull(basefruitPurchaseItems.deletedAt),
              eq(basefruitPurchaseItems.isDepleted, false)
            ))
            .limit(1)

          if (!purchaseItem.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Purchase item not found'
            })
          }

          // Verify apple variety exists
          const appleVariety = await tx
            .select()
            .from(baseFruitVarieties)
            .where(eq(baseFruitVarieties.id, input.fruitVarietyId))
            .limit(1)

          if (!appleVariety.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Fruit variety not found'
            })
          }

          // Note: Purchase weights are estimates only - no validation against actual pressing weights

          // Get next load sequence number (press run is already locked above, preventing race conditions)
          const maxSequenceResult = await tx
            .select({ maxSequence: sql<number>`COALESCE(MAX(${applePressRunLoads.loadSequence}), 0)` })
            .from(applePressRunLoads)
            .where(and(eq(applePressRunLoads.applePressRunId, input.pressRunId), isNull(applePressRunLoads.deletedAt)))

          const nextSequence = (maxSequenceResult[0]?.maxSequence || 0) + 1

          // Create the load
          const newLoad = await tx
            .insert(applePressRunLoads)
            .values({
              applePressRunId: input.pressRunId,
              purchaseItemId: input.purchaseItemId,
              fruitVarietyId: input.fruitVarietyId,
              loadSequence: nextSequence,
              appleWeightKg: input.appleWeightKg.toString(),
              originalWeight: input.originalWeight.toString(),
              originalWeightUnit: input.originalWeightUnit,
              brixMeasured: input.brixMeasured?.toString(),
              phMeasured: input.phMeasured?.toString(),
              appleCondition: input.appleCondition,
              defectPercentage: input.defectPercentage?.toString(),
              notes: input.notes,
              pressedAt: new Date(),
              createdBy: ctx.session?.user?.id,
              updatedBy: ctx.session?.user?.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()

          // Update press run status if still in draft
          if (pressRun[0].status === 'draft') {
            await tx
              .update(applePressRuns)
              .set({
                status: 'in_progress',
                startTime: new Date(),
                updatedBy: ctx.session?.user?.id,
                updatedAt: new Date(),
              })
              .where(eq(applePressRuns.id, input.pressRunId))
          }

          // Update press run totals
          const allLoads = await tx
            .select({ appleWeightKg: applePressRunLoads.appleWeightKg })
            .from(applePressRunLoads)
            .where(and(eq(applePressRunLoads.applePressRunId, input.pressRunId), isNull(applePressRunLoads.deletedAt)))

          const totalAppleWeightKg = allLoads.reduce((sum, load) => sum + parseFloat(load.appleWeightKg || '0'), 0)

          await tx
            .update(applePressRuns)
            .set({
              totalAppleWeightKg: totalAppleWeightKg.toString(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(applePressRuns.id, input.pressRunId))

          // Publish audit events
          await publishCreateEvent(
            'apple_press_run_loads',
            newLoad[0].id,
            {
              loadId: newLoad[0].id,
              pressRunId: input.pressRunId,
              appleVarietyName: appleVariety[0].name,
              weightKg: input.appleWeightKg,
              sequence: nextSequence,
            },
            ctx.session?.user?.id,
            'Fruit load added to press run'
          )

          return {
            success: true,
            load: newLoad[0],
            totalAppleWeightKg,
            message: `Load #${nextSequence} added: ${input.originalWeight} ${input.originalWeightUnit} ${appleVariety[0].name}`,
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error adding load to press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add load to press run'
        })
      }
    }),

  // Update existing load - admin/operator only
  updateLoad: createRbacProcedure('update', 'press_run')
    .input(updateLoadSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify load exists and get press run info
          const existingLoad = await tx
            .select({
              loadId: applePressRunLoads.id,
              pressRunId: applePressRunLoads.applePressRunId,
              pressRunStatus: applePressRuns.status,
            })
            .from(applePressRunLoads)
            .leftJoin(applePressRuns, eq(applePressRunLoads.applePressRunId, applePressRuns.id))
            .where(and(eq(applePressRunLoads.id, input.loadId), isNull(applePressRunLoads.deletedAt)))
            .limit(1)

          if (!existingLoad.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Load not found'
            })
          }

          if (existingLoad[0].pressRunStatus === 'completed' || existingLoad[0].pressRunStatus === 'cancelled') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot update loads in completed or cancelled press run'
            })
          }

          // Verify purchase item exists, is not depleted, and has enough quantity
          const purchaseItem = await tx
            .select()
            .from(basefruitPurchaseItems)
            .where(and(
              eq(basefruitPurchaseItems.id, input.purchaseItemId),
              isNull(basefruitPurchaseItems.deletedAt),
              eq(basefruitPurchaseItems.isDepleted, false)
            ))
            .limit(1)

          if (!purchaseItem.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Purchase item not found'
            })
          }

          // Verify apple variety exists
          const appleVariety = await tx
            .select()
            .from(baseFruitVarieties)
            .where(eq(baseFruitVarieties.id, input.fruitVarietyId))
            .limit(1)

          if (!appleVariety.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Fruit variety not found'
            })
          }

          // Update the load
          const updatedLoad = await tx
            .update(applePressRunLoads)
            .set({
              purchaseItemId: input.purchaseItemId,
              fruitVarietyId: input.fruitVarietyId,
              appleWeightKg: input.appleWeightKg.toString(),
              originalWeight: input.originalWeight.toString(),
              originalWeightUnit: input.originalWeightUnit,
              brixMeasured: input.brixMeasured?.toString(),
              phMeasured: input.phMeasured?.toString(),
              appleCondition: input.appleCondition,
              defectPercentage: input.defectPercentage?.toString(),
              notes: input.notes,
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(applePressRunLoads.id, input.loadId))
            .returning()

          // Update press run totals
          const allLoads = await tx
            .select({ appleWeightKg: applePressRunLoads.appleWeightKg })
            .from(applePressRunLoads)
            .where(and(eq(applePressRunLoads.applePressRunId, existingLoad[0].pressRunId), isNull(applePressRunLoads.deletedAt)))

          const totalAppleWeightKg = allLoads.reduce((sum, load) => sum + parseFloat(load.appleWeightKg || '0'), 0)

          await tx
            .update(applePressRuns)
            .set({
              totalAppleWeightKg: totalAppleWeightKg.toString(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(applePressRuns.id, existingLoad[0].pressRunId))

          // Publish audit event
          await publishUpdateEvent(
            'apple_press_run_loads',
            input.loadId,
            existingLoad[0],
            {
              appleVarietyName: appleVariety[0].name,
              weightKg: input.appleWeightKg,
            },
            ctx.session?.user?.id,
            'Load updated'
          )

          return {
            success: true,
            load: updatedLoad[0],
            totalAppleWeightKg,
            message: `Load updated: ${input.originalWeight} ${input.originalWeightUnit} ${appleVariety[0].name}`,
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error updating load:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update load'
        })
      }
    }),

  // Finish press run and assign to vessel - admin/operator only
  finish: createRbacProcedure('update', 'press_run')
    .input(finishPressRunSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify press run exists and is in progress
          const pressRun = await tx
            .select()
            .from(applePressRuns)
            .where(and(eq(applePressRuns.id, input.pressRunId), isNull(applePressRuns.deletedAt)))
            .limit(1)

          if (!pressRun.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Press run not found'
            })
          }

          if (pressRun[0].status !== 'in_progress') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Press run is not in progress'
            })
          }

          // Verify vessel exists and is available
          const vessel = await tx
            .select()
            .from(vessels)
            .where(and(eq(vessels.id, input.vesselId), isNull(vessels.deletedAt)))
            .limit(1)

          if (!vessel.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Vessel not found'
            })
          }

          if (vessel[0].status !== 'available') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Vessel is not available'
            })
          }

          // Check vessel capacity
          const vesselCapacityL = parseFloat(vessel[0].capacityL)
          if (input.totalJuiceVolumeL > vesselCapacityL) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Total juice volume (${input.totalJuiceVolumeL}L) exceeds vessel capacity (${vesselCapacityL}L)`
            })
          }

          // Update loads with juice volumes and measurements
          const updatedLoads = []
          for (const load of input.loads) {
            const updatedLoad = await tx
              .update(applePressRunLoads)
              .set({
                juiceVolumeL: load.juiceVolumeL.toString(),
                originalVolume: load.originalVolume.toString(),
                originalVolumeUnit: load.originalVolumeUnit,
                brixMeasured: load.brixMeasured?.toString(),
                phMeasured: load.phMeasured?.toString(),
                updatedBy: ctx.session?.user?.id,
                updatedAt: new Date(),
              })
              .where(and(
                eq(applePressRunLoads.id, load.loadId),
                eq(applePressRunLoads.applePressRunId, input.pressRunId)
              ))
              .returning()

            if (updatedLoad.length) {
              updatedLoads.push(updatedLoad[0])
            }
          }

          // Calculate totals and extraction rate
          const totalAppleWeightKg = parseFloat(pressRun[0].totalAppleWeightKg || '0')
          const extractionRate = totalAppleWeightKg > 0 ? input.totalJuiceVolumeL / totalAppleWeightKg : 0

          // Calculate labor cost if provided
          let totalLaborCost: number | null = null
          if (input.laborHours && input.laborCostPerHour) {
            totalLaborCost = input.laborHours * input.laborCostPerHour
          }

          // Generate press run name based on completion date (YYYY-MM-DD-##)
          const completionDateStr = input.completionDate.toISOString().split('T')[0]

          // Find existing press runs on the same date to determine sequence number
          const existingRuns = await tx
            .select({ pressRunName: applePressRuns.pressRunName })
            .from(applePressRuns)
            .where(and(
              sql`${applePressRuns.pressRunName} LIKE ${completionDateStr + '-%'}`,
              isNull(applePressRuns.deletedAt)
            ))
            .orderBy(desc(applePressRuns.pressRunName))

          // Extract the highest sequence number for this date
          let sequenceNumber = 1
          if (existingRuns.length > 0) {
            const pattern = new RegExp(`^${completionDateStr}-(\\d+)$`)
            for (const run of existingRuns) {
              if (run.pressRunName) {
                const match = run.pressRunName.match(pattern)
                if (match) {
                  const num = parseInt(match[1], 10)
                  if (num >= sequenceNumber) {
                    sequenceNumber = num + 1
                  }
                }
              }
            }
          }

          const pressRunName = `${completionDateStr}-${String(sequenceNumber).padStart(2, '0')}`

          // Complete the press run
          const completedPressRun = await tx
            .update(applePressRuns)
            .set({
              pressRunName,
              vesselId: input.vesselId,
              status: 'completed',
              endTime: input.completionDate,
              totalJuiceVolumeL: input.totalJuiceVolumeL.toString(),
              extractionRate: extractionRate.toString(),
              laborHours: input.laborHours?.toString(),
              laborCostPerHour: input.laborCostPerHour?.toString(),
              totalLaborCost: totalLaborCost?.toString(),
              notes: input.notes || pressRun[0].notes,
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(applePressRuns.id, input.pressRunId))
            .returning()

          // Update vessel status
          await tx
            .update(vessels)
            .set({
              status: 'in_use',
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, input.vesselId))

          // Create a batch for this press run automatically
          // Get all loads with vendor and variety information for batch composition
          const loads = await tx
            .select({
              id: applePressRunLoads.id,
              purchaseItemId: applePressRunLoads.purchaseItemId,
              vendorId: basefruitPurchases.vendorId,
              vendorName: vendors.name,
              fruitVarietyId: applePressRunLoads.fruitVarietyId,
              varietyName: baseFruitVarieties.name,
              appleWeightKg: applePressRunLoads.appleWeightKg,
              juiceVolumeL: applePressRunLoads.juiceVolumeL,
              brixMeasured: applePressRunLoads.brixMeasured,
              totalCost: basefruitPurchaseItems.totalCost,
            })
            .from(applePressRunLoads)
            .innerJoin(basefruitPurchaseItems, eq(applePressRunLoads.purchaseItemId, basefruitPurchaseItems.id))
            .innerJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
            .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .innerJoin(baseFruitVarieties, eq(applePressRunLoads.fruitVarietyId, baseFruitVarieties.id))
            .where(and(
              eq(applePressRunLoads.applePressRunId, input.pressRunId),
              isNull(applePressRunLoads.deletedAt)
            ))

          // Calculate allocation fractions based on weight and total juice volume
          const totalWeight = loads.reduce((sum, load) => sum + parseFloat(load.appleWeightKg || '0'), 0)
          const totalJuiceVolumeL = loads.reduce((sum, load) => sum + parseFloat(load.juiceVolumeL || '0'), 0)

          // Generate batch composition for naming
          const batchCompositionData: BatchComposition[] = loads.map(load => {
            const fraction = parseFloat(load.appleWeightKg || '0') / totalWeight
            return {
              varietyName: load.varietyName,
              fractionOfBatch: fraction
            }
          })

          // Generate batch name
          const batchName = generateBatchNameFromComposition({
            date: new Date(),
            vesselCode: vessel[0].name || input.vesselId.substring(0, 6).toUpperCase(),
            batchCompositions: batchCompositionData
          })

          // Create batch record with all required fields
          const newBatch = await tx
            .insert(batches)
            .values({
              vesselId: input.vesselId,
              name: batchName,
              batchNumber: batchName, // Using batch name as batch number for now
              initialVolumeL: totalJuiceVolumeL.toString(),
              currentVolumeL: totalJuiceVolumeL.toString(),
              status: 'active',
              startDate: new Date(),
              originPressRunId: input.pressRunId
            })
            .returning({ id: batches.id })

          const batchId = newBatch[0].id

          // Update vessel status to fermenting when batch is created
          await tx
            .update(vessels)
            .set({
              status: 'fermenting',
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, input.vesselId))

          // Publish vessel status update audit event
          await publishUpdateEvent(
            'vessels',
            input.vesselId,
            { status: 'available' },
            { status: 'fermenting' },
            ctx.session?.user?.id,
            'Vessel status changed to fermenting when batch was created from press run completion'
          )

          // Create batch compositions
          for (const load of loads) {
            const fraction = parseFloat(load.appleWeightKg || '0') / totalWeight
            const juiceVolumeL = input.totalJuiceVolumeL * fraction
            const materialCost = parseFloat(load.totalCost || '0') * fraction

            await tx.insert(batchCompositions).values({
              batchId,
              purchaseItemId: load.purchaseItemId,
              vendorId: load.vendorId,
              varietyId: load.fruitVarietyId,
              inputWeightKg: load.appleWeightKg,
              juiceVolumeL: juiceVolumeL.toString(),
              fractionOfBatch: fraction.toString(),
              materialCost: materialCost.toString(),
              avgBrix: load.brixMeasured,
            })
          }

          // Publish audit events
          await publishUpdateEvent(
            'apple_press_runs',
            input.pressRunId,
            pressRun[0],
            {
              status: 'completed',
              vesselId: input.vesselId,
              totalJuiceVolumeL: input.totalJuiceVolumeL,
              extractionRate: extractionRate,
              endTime: new Date(),
            },
            ctx.session?.user?.id,
            'Press run completed and juice assigned to vessel'
          )

          return {
            success: true,
            pressRun: completedPressRun[0],
            loads: updatedLoads,
            batchId,
            batchName,
            extractionRate: Math.round(extractionRate * 10000) / 100, // Convert to percentage with 2 decimals
            message: `Press run completed: ${input.totalJuiceVolumeL}L juice (${Math.round(extractionRate * 100)}% extraction) assigned to ${vessel[0].name}. Batch ${batchName} created.`,
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error finishing press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to finish press run'
        })
      }
    }),

  // Complete press run and create batches - admin/operator only
  complete: createRbacProcedure('update', 'press_run')
    .input(completeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify press run exists
          const pressRun = await tx
            .select()
            .from(applePressRuns)
            .where(and(eq(applePressRuns.id, input.pressRunId), isNull(applePressRuns.deletedAt)))
            .limit(1)

          if (!pressRun.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Press run not found'
            })
          }

          // Allow both in_progress and completed status
          // If in_progress, we'll complete it first
          if (pressRun[0].status !== 'in_progress' && pressRun[0].status !== 'completed') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Press run must be in progress or completed'
            })
          }

          // Check if batches already exist for this press run
          const existingBatches = await tx
            .select({ id: batches.id })
            .from(batches)
            .where(eq(batches.originPressRunId, input.pressRunId))
            .limit(1)

          if (existingBatches.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Batches already created for this press run'
            })
          }

          // If press run is still in_progress, complete it first
          if (pressRun[0].status === 'in_progress') {
            // Get total juice volume from loads
            const loads = await tx
              .select({ juiceVolumeL: applePressRunLoads.juiceVolumeL })
              .from(applePressRunLoads)
              .where(and(
                eq(applePressRunLoads.applePressRunId, input.pressRunId),
                isNull(applePressRunLoads.deletedAt)
              ))

            const totalJuiceVolume = input.totalJuiceVolumeL || loads.reduce((sum, load) =>
              sum + parseFloat(load.juiceVolumeL || '0'), 0
            )

            // Generate press run name based on current date (YYYY-MM-DD-##)
            const completionDateStr = new Date().toISOString().split('T')[0]

            // Find existing press runs on the same date to determine sequence number
            const existingRuns = await tx
              .select({ pressRunName: applePressRuns.pressRunName })
              .from(applePressRuns)
              .where(and(
                sql`${applePressRuns.pressRunName} LIKE ${completionDateStr + '-%'}`,
                isNull(applePressRuns.deletedAt)
              ))
              .orderBy(desc(applePressRuns.pressRunName))

            let sequenceNumber = 1
            if (existingRuns.length > 0) {
              const pattern = new RegExp(`^${completionDateStr}-(\\d+)$`)
              for (const run of existingRuns) {
                if (run.pressRunName) {
                  const match = run.pressRunName.match(pattern)
                  if (match) {
                    const num = parseInt(match[1], 10)
                    if (num >= sequenceNumber) {
                      sequenceNumber = num + 1
                    }
                  }
                }
              }
            }

            const pressRunName = `${completionDateStr}-${String(sequenceNumber).padStart(2, '0')}`

            // Complete the press run
            await tx
              .update(applePressRuns)
              .set({
                pressRunName,
                status: 'completed',
                endTime: new Date(),
                totalJuiceVolumeL: totalJuiceVolume.toString(),
                updatedAt: new Date(),
              })
              .where(eq(applePressRuns.id, input.pressRunId))
          }

          // Validate total assigned volume doesn't exceed available juice
          const totalAssignedVolume = input.assignments.reduce((sum, a) => sum + a.volumeL, 0)

          // Re-fetch press run to get updated juice volume and end time if it was just completed
          const updatedPressRun = await tx
            .select({
              totalJuiceVolumeL: applePressRuns.totalJuiceVolumeL,
              endTime: applePressRuns.endTime
            })
            .from(applePressRuns)
            .where(eq(applePressRuns.id, input.pressRunId))
            .limit(1)

          const availableVolume = input.totalJuiceVolumeL || parseFloat(updatedPressRun[0].totalJuiceVolumeL || '0')

          if (totalAssignedVolume > availableVolume + 0.001) { // Allow 1mL tolerance
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Total assigned volume (${totalAssignedVolume}L) exceeds available juice (${availableVolume}L)`
            })
          }

          // Validate vessels exist and have capacity
          for (const assignment of input.assignments) {
            const vessel = await tx
              .select({ id: vessels.id, capacityL: vessels.capacityL, name: vessels.name })
              .from(vessels)
              .where(and(eq(vessels.id, assignment.toVesselId), isNull(vessels.deletedAt)))
              .limit(1)

            if (!vessel.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Vessel not found: ${assignment.toVesselId}`
              })
            }

            // Check for existing active batch in vessel
            const existingBatch = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolumeL: batches.currentVolumeL
              })
              .from(batches)
              .where(and(
                eq(batches.vesselId, assignment.toVesselId),
                eq(batches.status, 'active'),
                isNull(batches.deletedAt)
              ))
              .limit(1)

            const vesselCapacity = parseFloat(vessel[0].capacityL)
            const currentVolume = existingBatch.length > 0
              ? parseFloat(existingBatch[0].currentVolumeL || '0')
              : 0
            const remainingCapacity = vesselCapacity - currentVolume

            if (assignment.volumeL > remainingCapacity + 0.001) {
              if (existingBatch.length > 0) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Assignment volume (${assignment.volumeL}L) exceeds remaining capacity (${remainingCapacity.toFixed(1)}L) in vessel ${vessel[0].name}. Current batch: ${existingBatch[0].name} (${currentVolume}L/${vesselCapacity}L)`
                })
              } else {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Assignment volume (${assignment.volumeL}L) exceeds vessel capacity (${vesselCapacity}L) for vessel ${vessel[0].name}`
                })
              }
            }
          }

          // Handle purchase item depletion if specified
          if (input.depletedPurchaseItemIds && input.depletedPurchaseItemIds.length > 0) {
            await tx
              .update(basefruitPurchaseItems)
              .set({
                isDepleted: true,
                depletedAt: new Date(),
                depletedBy: ctx.session?.user?.id,
                depletedInPressRun: input.pressRunId,
                updatedAt: new Date(),
              })
              .where(
                and(
                  inArray(basefruitPurchaseItems.id, input.depletedPurchaseItemIds),
                  eq(basefruitPurchaseItems.isDepleted, false)
                )
              )

            // Publish audit events for each depleted item
            for (const purchaseItemId of input.depletedPurchaseItemIds) {
              await publishUpdateEvent(
                'basefruit_purchase_items',
                purchaseItemId,
                { isDepleted: false },
                { isDepleted: true, depletedAt: new Date(), depletedInPressRun: input.pressRunId },
                ctx.session?.user?.id,
                'Purchase item marked as depleted during press run completion'
              )
            }
          }

          // Load press run loads for composition calculation
          const loads = await tx
            .select({
              id: applePressRunLoads.id,
              purchaseItemId: applePressRunLoads.purchaseItemId,
              fruitVarietyId: applePressRunLoads.fruitVarietyId,
              varietyName: baseFruitVarieties.name,
              appleWeightKg: applePressRunLoads.appleWeightKg,
              brixMeasured: applePressRunLoads.brixMeasured,
              vendorId: vendors.id,
              totalCost: basefruitPurchaseItems.totalCost,
            })
            .from(applePressRunLoads)
            .innerJoin(basefruitPurchaseItems, eq(applePressRunLoads.purchaseItemId, basefruitPurchaseItems.id))
            .innerJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
            .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .innerJoin(baseFruitVarieties, eq(applePressRunLoads.fruitVarietyId, baseFruitVarieties.id))
            .where(and(
              eq(applePressRunLoads.applePressRunId, input.pressRunId),
              isNull(applePressRunLoads.deletedAt)
            ))

          if (loads.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'No loads found for press run'
            })
          }

          // Calculate allocation fractions based on weight
          const totalWeight = loads.reduce((sum, load) => sum + parseFloat(load.appleWeightKg || '0'), 0)
          if (totalWeight <= 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Total apple weight must be greater than zero'
            })
          }

          const createdBatchIds: string[] = []

          // Create or update batches for each assignment
          for (const assignment of input.assignments) {
            // Get vessel info for batch naming
            const vessel = await tx
              .select({ id: vessels.id, name: vessels.name })
              .from(vessels)
              .where(eq(vessels.id, assignment.toVesselId))
              .limit(1)

            const vesselInfo = vessel[0]

            // Check for existing active batch in vessel
            const existingBatch = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolumeL: batches.currentVolumeL,
                initialVolumeL: batches.initialVolumeL
              })
              .from(batches)
              .where(and(
                eq(batches.vesselId, assignment.toVesselId),
                eq(batches.status, 'active'),
                isNull(batches.deletedAt)
              ))
              .limit(1)

            let batchId: string
            let batchName: string

            if (existingBatch.length > 0) {
              // Add to existing batch
              batchId = existingBatch[0].id
              batchName = existingBatch[0].name
              const currentVolume = parseFloat(existingBatch[0].currentVolumeL || '0')
              const newVolume = currentVolume + assignment.volumeL

              // Update existing batch volume
              await tx
                .update(batches)
                .set({
                  currentVolumeL: newVolume.toString(),
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, batchId))

              console.log(`Added ${assignment.volumeL}L to existing batch ${existingBatch[0].name}, new volume: ${newVolume}L`)

            } else {
              // Create new batch
              // Generate batch composition for naming
              const batchCompositionData: BatchComposition[] = loads.map(load => {
                const fraction = parseFloat(load.appleWeightKg || '0') / totalWeight
                return {
                  varietyName: load.varietyName,
                  fractionOfBatch: fraction
                }
              })

              // Use press run completion date for batch start date and naming
              const pressRunCompletionDate = updatedPressRun[0].endTime || new Date()

              // Generate batch name using completion date
              batchName = generateBatchNameFromComposition({
                date: pressRunCompletionDate,
                vesselCode: vesselInfo.name || vesselInfo.id.substring(0, 6).toUpperCase(),
                batchCompositions: batchCompositionData
              })

              // Create batch record
              const newBatch = await tx
                .insert(batches)
                .values({
                  vesselId: assignment.toVesselId,
                  name: batchName,
                  batchNumber: batchName, // Add batch_number for database compatibility
                  initialVolumeL: assignment.volumeL.toString(),
                  currentVolumeL: assignment.volumeL.toString(),
                  status: 'active',
                  startDate: pressRunCompletionDate,
                  originPressRunId: input.pressRunId
                })
                .returning({ id: batches.id })

              batchId = newBatch[0].id
            }

            createdBatchIds.push(batchId)

            // Update vessel status to fermenting when batch is created
            await tx
              .update(vessels)
              .set({
                status: 'fermenting',
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, assignment.toVesselId))

            // Publish vessel status update audit event
            await publishUpdateEvent(
              'vessels',
              assignment.toVesselId,
              { status: 'available' },
              { status: 'fermenting' },
              ctx.session?.user?.id,
              'Vessel status changed to fermenting when batch was created from press run completion'
            )

            // Handle batch compositions - either create new or merge with existing
            let totalFraction = 0
            let totalJuiceVolume = 0
            let totalMaterialCost = 0

            // Group loads by purchaseItemId to consolidate multiple loads from same purchase
            const consolidatedLoads = loads.reduce((acc, load) => {
              const key = load.purchaseItemId
              if (!acc[key]) {
                acc[key] = {
                  purchaseItemId: load.purchaseItemId,
                  vendorId: load.vendorId,
                  varietyId: load.fruitVarietyId,
                  totalAppleWeightKg: 0,
                  totalCost: 0,
                  brixMeasurements: [] as (string | null)[]
                }
              }
              acc[key].totalAppleWeightKg += parseFloat(load.appleWeightKg || '0')
              acc[key].totalCost += parseFloat(load.totalCost || '0')
              if (load.brixMeasured) {
                acc[key].brixMeasurements.push(load.brixMeasured)
              }
              return acc
            }, {} as Record<string, any>)

            if (existingBatch.length > 0) {
              // For existing batch, we need to merge compositions
              const currentVolume = parseFloat(existingBatch[0].currentVolumeL || '0')
              const newTotalVolume = currentVolume + assignment.volumeL

              // Get existing compositions
              const existingCompositions = await tx
                .select()
                .from(batchCompositions)
                .where(and(
                  eq(batchCompositions.batchId, batchId),
                  isNull(batchCompositions.deletedAt)
                ))

              // Update existing compositions with new fractions
              for (const existingComp of existingCompositions) {
                const oldVolumeContribution = parseFloat(existingComp.juiceVolumeL || '0')
                const newFraction = oldVolumeContribution / newTotalVolume

                await tx
                  .update(batchCompositions)
                  .set({
                    fractionOfBatch: newFraction.toString(),
                    updatedAt: new Date()
                  })
                  .where(eq(batchCompositions.id, existingComp.id))
              }

              // Add new compositions from this press run
              for (const consolidatedLoad of Object.values(consolidatedLoads)) {
                const fraction = consolidatedLoad.totalAppleWeightKg / totalWeight
                const juiceVolumeL = assignment.volumeL * fraction
                const materialCost = consolidatedLoad.totalCost * fraction
                const batchFraction = juiceVolumeL / newTotalVolume

                // Calculate average brix if available
                const avgBrix = consolidatedLoad.brixMeasurements.length > 0
                  ? consolidatedLoad.brixMeasurements.reduce((sum: number, brix: string | null) =>
                      sum + (brix ? parseFloat(brix) : 0), 0) / consolidatedLoad.brixMeasurements.length
                  : null

                totalFraction += batchFraction
                totalJuiceVolume += juiceVolumeL
                totalMaterialCost += materialCost

                // Check if this purchase item already exists in the batch
                const existingPurchaseComp = existingCompositions.find(comp =>
                  comp.purchaseItemId === consolidatedLoad.purchaseItemId
                )

                if (existingPurchaseComp) {
                  // Merge with existing composition
                  const existingWeight = parseFloat(existingPurchaseComp.inputWeightKg || '0')
                  const newWeight = existingWeight + consolidatedLoad.totalAppleWeightKg
                  const existingVolume = parseFloat(existingPurchaseComp.juiceVolumeL || '0')
                  const newVolume = existingVolume + juiceVolumeL
                  const existingCost = parseFloat(existingPurchaseComp.materialCost || '0')
                  const newCost = existingCost + materialCost
                  const newFraction = newVolume / newTotalVolume

                  await tx
                    .update(batchCompositions)
                    .set({
                      inputWeightKg: newWeight.toString(),
                      juiceVolumeL: newVolume.toString(),
                      materialCost: newCost.toString(),
                      fractionOfBatch: newFraction.toString(),
                      avgBrix: avgBrix?.toString() || existingPurchaseComp.avgBrix,
                      updatedAt: new Date()
                    })
                    .where(eq(batchCompositions.id, existingPurchaseComp.id))
                } else {
                  // Add new composition entry
                  await tx.insert(batchCompositions).values({
                    batchId,
                    purchaseItemId: consolidatedLoad.purchaseItemId,
                    vendorId: consolidatedLoad.vendorId,
                    varietyId: consolidatedLoad.varietyId,
                    inputWeightKg: consolidatedLoad.totalAppleWeightKg.toString(),
                    juiceVolumeL: juiceVolumeL.toString(),
                    fractionOfBatch: batchFraction.toString(),
                    materialCost: materialCost.toString(),
                    avgBrix: avgBrix ? avgBrix.toString() : null,
                  })

                  // Publish batch composition audit event
                  await publishCreateEvent(
                    'batch_compositions',
                    batchId,
                    {
                      batchId,
                      purchaseItemId: consolidatedLoad.purchaseItemId,
                      juiceVolumeL,
                      fraction: batchFraction
                    },
                    ctx.session?.user?.id,
                    'Batch composition added from press run completion to existing batch'
                  )
                }
              }
            } else {
              // For new batch, create compositions normally
              for (const consolidatedLoad of Object.values(consolidatedLoads)) {
                const fraction = consolidatedLoad.totalAppleWeightKg / totalWeight
                const juiceVolumeL = assignment.volumeL * fraction
                const materialCost = consolidatedLoad.totalCost * fraction

                // Calculate average brix if available
                const avgBrix = consolidatedLoad.brixMeasurements.length > 0
                  ? consolidatedLoad.brixMeasurements.reduce((sum: number, brix: string | null) =>
                      sum + (brix ? parseFloat(brix) : 0), 0) / consolidatedLoad.brixMeasurements.length
                  : null

                totalFraction += fraction
                totalJuiceVolume += juiceVolumeL
                totalMaterialCost += materialCost

                await tx.insert(batchCompositions).values({
                  batchId,
                  purchaseItemId: consolidatedLoad.purchaseItemId,
                  vendorId: consolidatedLoad.vendorId,
                  varietyId: consolidatedLoad.varietyId,
                  inputWeightKg: consolidatedLoad.totalAppleWeightKg.toString(),
                  juiceVolumeL: juiceVolumeL.toString(),
                  fractionOfBatch: fraction.toString(),
                  materialCost: materialCost.toString(),
                  avgBrix: avgBrix ? avgBrix.toString() : null,
                })

                // Publish batch composition audit event
                await publishCreateEvent(
                  'batch_compositions',
                  batchId,
                  {
                    batchId,
                    purchaseItemId: consolidatedLoad.purchaseItemId,
                    juiceVolumeL,
                    fraction
                  },
                  ctx.session?.user?.id,
                  'Batch composition created from press run completion'
                )
              }
            }

            // Publish batch creation audit event
            await publishCreateEvent(
              'batches',
              batchId,
              {
                batchId,
                name: batchName,
                vesselId: assignment.toVesselId,
                pressRunId: input.pressRunId,
                volumeL: assignment.volumeL
              },
              ctx.session?.user?.id,
              'Batch created from press run completion'
            )
          }

          // Publish press completion audit event
          await publishUpdateEvent(
            'apple_press_runs',
            input.pressRunId,
            pressRun[0],
            { batchesCreated: true },
            ctx.session?.user?.id,
            'Press run completed with batch creation'
          )

          return {
            pressRunId: input.pressRunId,
            createdBatchIds,
            message: `Press run completed with ${createdBatchIds.length} batches created`
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error completing press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete press run'
        })
      }
    }),

  // List press runs with filtering and pagination - admin/operator/viewer
  list: createRbacProcedure('list', 'press_run')
    .input(listPressRunsSchema)
    .query(async ({ input }) => {
      try {
        // Build WHERE conditions
        const conditions = [isNull(applePressRuns.deletedAt)]

        if (input.status) {
          conditions.push(eq(applePressRuns.status, input.status))
        }

        if (input.vendorId) {
          conditions.push(eq(applePressRuns.vendorId, input.vendorId))
        }

        // Build ORDER BY clause
        const sortColumn = {
          created: applePressRuns.createdAt,
          scheduled: applePressRuns.scheduledDate,
          started: applePressRuns.startTime,
          updated: applePressRuns.updatedAt,
        }[input.sortBy]

        const orderBy = input.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

        // Query press runs with vendor and vessel info
        const pressRunsList = await db
          .select({
            id: applePressRuns.id,
            pressRunName: applePressRuns.pressRunName,
            vendorId: applePressRuns.vendorId,
            vendorName: vendors.name,
            vesselId: applePressRuns.vesselId,
            vesselName: vessels.name,
            status: applePressRuns.status,
            scheduledDate: applePressRuns.scheduledDate,
            startTime: applePressRuns.startTime,
            endTime: applePressRuns.endTime,
            totalAppleWeightKg: applePressRuns.totalAppleWeightKg,
            totalJuiceVolumeL: applePressRuns.totalJuiceVolumeL,
            extractionRate: applePressRuns.extractionRate,
            laborHours: applePressRuns.laborHours,
            totalLaborCost: applePressRuns.totalLaborCost,
            notes: applePressRuns.notes,
            createdAt: applePressRuns.createdAt,
            updatedAt: applePressRuns.updatedAt,
          })
          .from(applePressRuns)
          .leftJoin(vendors, eq(applePressRuns.vendorId, vendors.id))
          .leftJoin(vessels, eq(applePressRuns.vesselId, vessels.id))
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(input.limit)
          .offset(input.offset)

        // Get total count for pagination
        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(applePressRuns)
          .where(and(...conditions))

        const totalCount = totalCountResult[0]?.count || 0

        // Get load counts and varieties for each press run
        const pressRunIds = pressRunsList.map(pr => pr.id)

        let loadCounts: Record<string, number> = {}
        let pressRunVarieties: Record<string, string[]> = {}
        if (pressRunIds.length > 0) {
          const loadCountsResult = await db
            .select({
              pressRunId: applePressRunLoads.applePressRunId,
              count: sql<number>`count(*)`
            })
            .from(applePressRunLoads)
            .where(and(
              inArray(applePressRunLoads.applePressRunId, pressRunIds),
              isNull(applePressRunLoads.deletedAt)
            ))
            .groupBy(applePressRunLoads.applePressRunId)

          loadCounts = loadCountsResult.reduce((acc, row) => {
            acc[row.pressRunId] = row.count
            return acc
          }, {} as Record<string, number>)

          // Get varieties for each press run
          const varietiesResult = await db
            .select({
              pressRunId: applePressRunLoads.applePressRunId,
              varietyName: baseFruitVarieties.name
            })
            .from(applePressRunLoads)
            .leftJoin(baseFruitVarieties, eq(applePressRunLoads.fruitVarietyId, baseFruitVarieties.id))
            .where(and(
              inArray(applePressRunLoads.applePressRunId, pressRunIds),
              isNull(applePressRunLoads.deletedAt)
            ))
            .groupBy(applePressRunLoads.applePressRunId, baseFruitVarieties.name)

          pressRunVarieties = varietiesResult.reduce((acc, row) => {
            if (!acc[row.pressRunId]) {
              acc[row.pressRunId] = []
            }
            if (row.varietyName && !acc[row.pressRunId].includes(row.varietyName)) {
              acc[row.pressRunId].push(row.varietyName)
            }
            return acc
          }, {} as Record<string, string[]>)
        }

        // Enhance press runs with load counts and varieties
        const enhancedPressRuns = pressRunsList.map(pressRun => ({
          ...pressRun,
          loadCount: loadCounts[pressRun.id] || 0,
          varieties: pressRunVarieties[pressRun.id] || [],
          extractionRatePercent: pressRun.extractionRate
            ? Math.round(parseFloat(pressRun.extractionRate) * 10000) / 100
            : null,
        }))

        return {
          pressRuns: enhancedPressRuns,
          pagination: {
            total: totalCount,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < totalCount,
          },
        }
      } catch (error) {
        console.error('Error listing press runs:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list press runs'
        })
      }
    }),

  // Get specific press run with loads - admin/operator/viewer
  get: createRbacProcedure('read', 'press_run')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        // Get press run with vendor and vessel info
        const pressRunResult = await db
          .select({
            id: applePressRuns.id,
            pressRunName: applePressRuns.pressRunName,
            vendorId: applePressRuns.vendorId,
            vendorName: vendors.name,
            vendorContactInfo: vendors.contactInfo,
            vesselId: applePressRuns.vesselId,
            vesselName: vessels.name,
            vesselType: vessels.type,
            vesselCapacityL: vessels.capacityL,
            status: applePressRuns.status,
            scheduledDate: applePressRuns.scheduledDate,
            startTime: applePressRuns.startTime,
            endTime: applePressRuns.endTime,
            totalAppleWeightKg: applePressRuns.totalAppleWeightKg,
            totalJuiceVolumeL: applePressRuns.totalJuiceVolumeL,
            extractionRate: applePressRuns.extractionRate,
            laborHours: applePressRuns.laborHours,
            laborCostPerHour: applePressRuns.laborCostPerHour,
            totalLaborCost: applePressRuns.totalLaborCost,
            notes: applePressRuns.notes,
            pressingMethod: applePressRuns.pressingMethod,
            weatherConditions: applePressRuns.weatherConditions,
            createdAt: applePressRuns.createdAt,
            updatedAt: applePressRuns.updatedAt,
            createdByUserId: applePressRuns.createdBy,
            updatedByUserId: applePressRuns.updatedBy,
          })
          .from(applePressRuns)
          .leftJoin(vendors, eq(applePressRuns.vendorId, vendors.id))
          .leftJoin(vessels, eq(applePressRuns.vesselId, vessels.id))
          .where(and(eq(applePressRuns.id, input.id), isNull(applePressRuns.deletedAt)))
          .limit(1)

        if (!pressRunResult.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Press run not found'
          })
        }

        const pressRun = pressRunResult[0]

        // Get loads with apple variety and purchase item info including vendor details
        const loads = await db
          .select({
            id: applePressRunLoads.id,
            purchaseItemId: applePressRunLoads.purchaseItemId,
            fruitVarietyId: applePressRunLoads.fruitVarietyId,
            appleVarietyName: baseFruitVarieties.name,
            vendorId: basefruitPurchases.vendorId,
            vendorName: vendors.name,
            loadSequence: applePressRunLoads.loadSequence,
            appleWeightKg: applePressRunLoads.appleWeightKg,
            originalWeight: applePressRunLoads.originalWeight,
            originalWeightUnit: applePressRunLoads.originalWeightUnit,
            juiceVolumeL: applePressRunLoads.juiceVolumeL,
            originalVolume: applePressRunLoads.originalVolume,
            originalVolumeUnit: applePressRunLoads.originalVolumeUnit,
            brixMeasured: applePressRunLoads.brixMeasured,
            phMeasured: applePressRunLoads.phMeasured,
            appleCondition: applePressRunLoads.appleCondition,
            defectPercentage: applePressRunLoads.defectPercentage,
            notes: applePressRunLoads.notes,
            pressedAt: applePressRunLoads.pressedAt,
            createdAt: applePressRunLoads.createdAt,
            // Purchase item original quantities
            purchaseItemOriginalQuantityKg: basefruitPurchaseItems.quantityKg,
            purchaseItemOriginalQuantity: basefruitPurchaseItems.quantity,
            purchaseItemOriginalUnit: basefruitPurchaseItems.unit,
          })
          .from(applePressRunLoads)
          .leftJoin(baseFruitVarieties, eq(applePressRunLoads.fruitVarietyId, baseFruitVarieties.id))
          .leftJoin(basefruitPurchaseItems, eq(applePressRunLoads.purchaseItemId, basefruitPurchaseItems.id))
          .leftJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .where(and(
            eq(applePressRunLoads.applePressRunId, input.id),
            isNull(applePressRunLoads.deletedAt)
          ))
          .orderBy(asc(applePressRunLoads.loadSequence))

        // Get user info for created/updated by
        const userIds = [pressRun.createdByUserId, pressRun.updatedByUserId].filter(Boolean) as string[]
        let userInfo: Record<string, any> = {}

        if (userIds.length > 0) {
          const userRecords = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(inArray(users.id, userIds))

          userInfo = userRecords.reduce((acc: Record<string, any>, user: any) => {
            acc[user.id] = user
            return acc
          }, {} as Record<string, any>)
        }

        return {
          pressRun: {
            ...pressRun,
            extractionRatePercent: pressRun.extractionRate
              ? Math.round(parseFloat(pressRun.extractionRate) * 10000) / 100
              : null,
            createdByUser: pressRun.createdByUserId ? userInfo[pressRun.createdByUserId] : null,
            updatedByUser: pressRun.updatedByUserId ? userInfo[pressRun.updatedByUserId] : null,
          },
          loads: loads.map(load => ({
            ...load,
            individualExtractionRate: load.appleWeightKg && load.juiceVolumeL
              ? parseFloat(load.juiceVolumeL) / parseFloat(load.appleWeightKg)
              : null,
          })),
          summary: {
            totalLoads: loads.length,
            totalAppleWeightKg: pressRun.totalAppleWeightKg ? parseFloat(pressRun.totalAppleWeightKg) : 0,
            totalJuiceVolumeL: pressRun.totalJuiceVolumeL ? parseFloat(pressRun.totalJuiceVolumeL) : 0,
            averageBrix: loads.length > 0
              ? loads.reduce((sum, load) => sum + parseFloat(load.brixMeasured || '0'), 0) / loads.length
              : null,
            varietyBreakdown: loads.reduce((acc, load) => {
              const variety = load.appleVarietyName || 'Unknown'
              if (!acc[variety]) {
                acc[variety] = { count: 0, weightKg: 0, juiceL: 0 }
              }
              acc[variety].count++
              acc[variety].weightKg += parseFloat(load.appleWeightKg || '0')
              acc[variety].juiceL += parseFloat(load.juiceVolumeL || '0')
              return acc
            }, {} as Record<string, { count: number; weightKg: number; juiceL: number }>),
          },
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error getting press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get press run'
        })
      }
    }),

  // Update press run metadata - admin/operator only
  update: createRbacProcedure('update', 'press_run')
    .input(z.object({
      id: z.string().uuid(),
      scheduledDate: z.date().or(z.string().transform(val => new Date(val))).optional(),
      notes: z.string().optional(),
      pressingMethod: z.string().optional(),
      weatherConditions: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updateData } = input

        const existingPressRun = await db
          .select()
          .from(applePressRuns)
          .where(and(eq(applePressRuns.id, id), isNull(applePressRuns.deletedAt)))
          .limit(1)

        if (!existingPressRun.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Press run not found'
          })
        }

        if (existingPressRun[0].status === 'completed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot update completed press run'
          })
        }

        const updatedPressRun = await db
          .update(applePressRuns)
          .set({
            ...updateData,
            scheduledDate: updateData.scheduledDate ? updateData.scheduledDate.toISOString().split('T')[0] : undefined,
            updatedBy: ctx.session?.user?.id,
            updatedAt: new Date(),
          })
          .where(eq(applePressRuns.id, id))
          .returning()

        // Publish audit event
        await publishUpdateEvent(
          'apple_press_runs',
          id,
          existingPressRun[0],
          updateData,
          ctx.session?.user?.id,
          'Press run updated'
        )

        return {
          success: true,
          pressRun: updatedPressRun[0],
          message: 'Press run updated successfully',
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error updating press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update press run'
        })
      }
    }),

  // Cancel press run - admin/operator only
  cancel: createRbacProcedure('update', 'press_run')
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().min(1, 'Cancellation reason is required'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const existingPressRun = await db
          .select()
          .from(applePressRuns)
          .where(and(eq(applePressRuns.id, input.id), isNull(applePressRuns.deletedAt)))
          .limit(1)

        if (!existingPressRun.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Press run not found'
          })
        }

        if (existingPressRun[0].status === 'completed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot cancel completed press run'
          })
        }

        if (existingPressRun[0].status === 'cancelled') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Press run is already cancelled'
          })
        }

        const cancelledPressRun = await db
          .update(applePressRuns)
          .set({
            status: 'cancelled',
            notes: existingPressRun[0].notes
              ? `${existingPressRun[0].notes}\n\nCANCELLED: ${input.reason}`
              : `CANCELLED: ${input.reason}`,
            endTime: new Date(),
            updatedBy: ctx.session?.user?.id,
            updatedAt: new Date(),
          })
          .where(eq(applePressRuns.id, input.id))
          .returning()

        // Publish audit event
        await publishUpdateEvent(
          'apple_press_runs',
          input.id,
          existingPressRun[0],
          { status: 'cancelled', cancellationReason: input.reason },
          ctx.session?.user?.id,
          'Press run cancelled'
        )

        return {
          success: true,
          pressRun: cancelledPressRun[0],
          message: `Press run cancelled: ${input.reason}`,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error cancelling press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel press run'
        })
      }
    }),

  // Delete press run (soft delete) - admin only
  delete: createRbacProcedure('delete', 'press_run')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          const existingPressRun = await tx
            .select()
            .from(applePressRuns)
            .where(and(eq(applePressRuns.id, input.id), isNull(applePressRuns.deletedAt)))
            .limit(1)

          if (!existingPressRun.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Press run not found'
            })
          }

          if (existingPressRun[0].status === 'completed' && existingPressRun[0].vesselId) {
            // Check if vessel still exists
            const vessel = await tx
              .select()
              .from(vessels)
              .where(and(eq(vessels.id, existingPressRun[0].vesselId), isNull(vessels.deletedAt)))
              .limit(1)

            if (vessel.length > 0) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Cannot delete completed press run with juice assigned to vessel'
              })
            }
          }

          // Soft delete press run and all loads
          const deletedPressRun = await tx
            .update(applePressRuns)
            .set({
              deletedAt: new Date(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(applePressRuns.id, input.id))
            .returning()

          await tx
            .update(applePressRunLoads)
            .set({
              deletedAt: new Date(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(applePressRunLoads.applePressRunId, input.id))

          // Publish audit event
          await publishDeleteEvent(
            'apple_press_runs',
            input.id,
            existingPressRun[0],
            ctx.session?.user?.id,
            'Press run deleted'
          )

          return {
            success: true,
            pressRun: deletedPressRun[0],
            message: 'Press run deleted successfully',
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error deleting press run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete press run'
        })
      }
    }),

  // Delete load - admin/operator only
  deleteLoad: createRbacProcedure('delete', 'press_run')
    .input(deleteLoadSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify load exists and get press run info
          const load = await tx
            .select({
              id: applePressRunLoads.id,
              applePressRunId: applePressRunLoads.applePressRunId,
              loadSequence: applePressRunLoads.loadSequence,
            })
            .from(applePressRunLoads)
            .where(and(eq(applePressRunLoads.id, input.loadId), isNull(applePressRunLoads.deletedAt)))
            .limit(1)

          if (!load.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Load not found'
            })
          }

          // Verify press run is still in progress
          const pressRun = await tx
            .select({ status: applePressRuns.status })
            .from(applePressRuns)
            .where(and(eq(applePressRuns.id, load[0].applePressRunId), isNull(applePressRuns.deletedAt)))
            .limit(1)

          if (!pressRun.length || pressRun[0].status !== 'in_progress') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot delete load - press run is not in progress'
            })
          }

          // Soft delete the load
          const deletedLoad = await tx
            .update(applePressRunLoads)
            .set({
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(applePressRunLoads.id, input.loadId))
            .returning()

          // Resequence remaining loads to maintain consecutive numbering
          const remainingLoads = await tx
            .select({
              id: applePressRunLoads.id,
              loadSequence: applePressRunLoads.loadSequence,
            })
            .from(applePressRunLoads)
            .where(and(
              eq(applePressRunLoads.applePressRunId, load[0].applePressRunId),
              isNull(applePressRunLoads.deletedAt)
            ))
            .orderBy(asc(applePressRunLoads.loadSequence))

          // Update sequence numbers to be consecutive (1, 2, 3, ...)
          for (let i = 0; i < remainingLoads.length; i++) {
            const newSequence = i + 1
            if (remainingLoads[i].loadSequence !== newSequence) {
              await tx
                .update(applePressRunLoads)
                .set({
                  loadSequence: newSequence,
                  updatedAt: new Date(),
                })
                .where(eq(applePressRunLoads.id, remainingLoads[i].id))
            }
          }

          // Create audit log entry
          await publishDeleteEvent(
            'apple_press_run_load',
            input.loadId,
            load[0],
            ctx.session?.user?.id,
            `Load #${load[0].loadSequence} deleted from press run`
          )

          return {
            success: true,
            loadId: input.loadId,
            message: 'Load deleted successfully'
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error deleting load:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete load'
        })
      }
    }),

  // Get available purchase lines with allocation tracking for a specific press run
  getAvailablePurchaseLines: createRbacProcedure('read', 'press_run')
    .input(z.object({
      pressRunId: z.string().uuid('Invalid press run ID'),
      vendorId: z.string().uuid().optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      try {
        // Verify press run exists
        const pressRunExists = await db
          .select({ id: applePressRuns.id })
          .from(applePressRuns)
          .where(and(eq(applePressRuns.id, input.pressRunId), isNull(applePressRuns.deletedAt)))
          .limit(1)

        if (!pressRunExists.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Press run not found'
          })
        }

        // Base query for basefruitPurchaseItems with vendor filtering
        let baseQuery = db
          .select({
            purchaseItemId: basefruitPurchaseItems.id,
            purchaseId: basefruitPurchases.id,
            vendorId: vendors.id,
            vendorName: vendors.name,
            fruitVarietyId: basefruitPurchaseItems.fruitVarietyId,
            varietyName: baseFruitVarieties.name,
            quantityKg: basefruitPurchaseItems.quantityKg,
            originalQuantity: basefruitPurchaseItems.quantity,
            originalUnit: basefruitPurchaseItems.unit,
            pricePerUnit: basefruitPurchaseItems.pricePerUnit,
            totalCost: basefruitPurchaseItems.totalCost,
            harvestDate: basefruitPurchaseItems.harvestDate,
            notes: basefruitPurchaseItems.notes,
          })
          .from(basefruitPurchaseItems)
          .innerJoin(basefruitPurchases, eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id))
          .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .innerJoin(baseFruitVarieties, eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id))
          .where(and(
            isNull(basefruitPurchaseItems.deletedAt),
            isNull(basefruitPurchases.deletedAt),
            isNull(vendors.deletedAt),
            isNull(baseFruitVarieties.deletedAt),
            eq(basefruitPurchaseItems.isDepleted, false),
            input.vendorId ? eq(basefruitPurchases.vendorId, input.vendorId) : sql`1=1`
          ))
          .orderBy(desc(basefruitPurchases.purchaseDate), asc(baseFruitVarieties.name))
          .limit(input.limit)
          .offset(input.offset)

        const purchaseItems = await baseQuery

        if (purchaseItems.length === 0) {
          return {
            items: [],
            summary: {
              totalAvailableItems: 0,
              totalAvailableKg: 0
            }
          }
        }

        // Get allocation data for this press run - sum up all existing loads by purchaseItemId
        const allocations = await db
          .select({
            purchaseItemId: applePressRunLoads.purchaseItemId,
            allocatedKg: sql<number>`COALESCE(SUM(CAST(${applePressRunLoads.appleWeightKg} AS NUMERIC)), 0)`,
          })
          .from(applePressRunLoads)
          .where(and(
            eq(applePressRunLoads.applePressRunId, input.pressRunId),
            isNull(applePressRunLoads.deletedAt),
            inArray(applePressRunLoads.purchaseItemId, purchaseItems.map(item => item.purchaseItemId))
          ))
          .groupBy(applePressRunLoads.purchaseItemId)

        // Create allocation map for quick lookup
        const allocationMap = new Map()
        allocations.forEach(alloc => {
          allocationMap.set(alloc.purchaseItemId, parseFloat(alloc.allocatedKg.toString()))
        })

        // Transform results to include allocation tracking
        const itemsWithAllocations = purchaseItems.map(item => {
          const totalQuantityKg = parseFloat(item.quantityKg || '0')
          const allocatedKg = allocationMap.get(item.purchaseItemId) || 0
          const availableQuantityKg = Math.max(0, totalQuantityKg - allocatedKg)
          const availablePercentage = totalQuantityKg > 0 ? (availableQuantityKg / totalQuantityKg) * 100 : 0

          return {
            purchaseItemId: item.purchaseItemId,
            purchaseId: item.purchaseId,
            vendorId: item.vendorId,
            vendorName: item.vendorName,
            fruitVarietyId: item.fruitVarietyId,
            varietyName: item.varietyName,
            totalQuantityKg,
            allocatedQuantityKg: allocatedKg,
            availableQuantityKg,
            availablePercentage,
            originalQuantity: parseFloat(item.originalQuantity || '0'),
            originalUnit: item.originalUnit,
            pricePerUnit: item.pricePerUnit ? parseFloat(item.pricePerUnit) : null,
            totalCost: item.totalCost ? parseFloat(item.totalCost) : null,
            harvestDate: item.harvestDate,
            notes: item.notes,
          }
        })

        // Calculate summary
        const totalAvailableKg = itemsWithAllocations.reduce((sum, item) => sum + item.availableQuantityKg, 0)

        return {
          items: itemsWithAllocations,
          summary: {
            totalAvailableItems: itemsWithAllocations.filter(item => item.availableQuantityKg > 0).length,
            totalAvailableKg
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error fetching available purchase lines with allocations:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch available purchase lines'
        })
      }
    }),
})