import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import { db, applePressRuns, applePressRunLoads, vendors, vessels, purchaseItems, purchases, appleVarieties, auditLog, users } from 'db'
import { eq, and, desc, asc, sql, isNull, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { publishCreateEvent, publishUpdateEvent, publishDeleteEvent } from 'lib'

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
  appleVarietyId: z.string().uuid('Invalid apple variety ID'),
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
  appleVarietyId: z.string().uuid('Invalid apple variety ID'),
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

const finishPressRunSchema = z.object({
  pressRunId: z.string().uuid('Invalid press run ID'),
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
          // Create new press run
          const newPressRun = await tx
            .insert(applePressRuns)
            .values({
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

          // Verify purchase item exists and has enough quantity
          const purchaseItem = await tx
            .select()
            .from(purchaseItems)
            .where(and(eq(purchaseItems.id, input.purchaseItemId), isNull(purchaseItems.deletedAt)))
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
            .from(appleVarieties)
            .where(eq(appleVarieties.id, input.appleVarietyId))
            .limit(1)

          if (!appleVariety.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Apple variety not found'
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
              appleVarietyId: input.appleVarietyId,
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

          // Verify purchase item exists and has enough quantity
          const purchaseItem = await tx
            .select()
            .from(purchaseItems)
            .where(and(eq(purchaseItems.id, input.purchaseItemId), isNull(purchaseItems.deletedAt)))
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
            .from(appleVarieties)
            .where(eq(appleVarieties.id, input.appleVarietyId))
            .limit(1)

          if (!appleVariety.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Apple variety not found'
            })
          }

          // Update the load
          const updatedLoad = await tx
            .update(applePressRunLoads)
            .set({
              purchaseItemId: input.purchaseItemId,
              appleVarietyId: input.appleVarietyId,
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

          // Complete the press run
          const completedPressRun = await tx
            .update(applePressRuns)
            .set({
              vesselId: input.vesselId,
              status: 'completed',
              endTime: new Date(),
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
            extractionRate: Math.round(extractionRate * 10000) / 100, // Convert to percentage with 2 decimals
            message: `Press run completed: ${input.totalJuiceVolumeL}L juice (${Math.round(extractionRate * 100)}% extraction) assigned to ${vessel[0].name}`,
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
              varietyName: appleVarieties.name
            })
            .from(applePressRunLoads)
            .leftJoin(appleVarieties, eq(applePressRunLoads.appleVarietyId, appleVarieties.id))
            .where(and(
              inArray(applePressRunLoads.applePressRunId, pressRunIds),
              isNull(applePressRunLoads.deletedAt)
            ))
            .groupBy(applePressRunLoads.applePressRunId, appleVarieties.name)

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
            appleVarietyId: applePressRunLoads.appleVarietyId,
            appleVarietyName: appleVarieties.name,
            vendorId: purchases.vendorId,
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
          })
          .from(applePressRunLoads)
          .leftJoin(appleVarieties, eq(applePressRunLoads.appleVarietyId, appleVarieties.id))
          .leftJoin(purchaseItems, eq(applePressRunLoads.purchaseItemId, purchaseItems.id))
          .leftJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
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
})