import { z } from 'zod'
import { router, createRbacProcedure } from '../trpc'
import {
  db,
  packagingRuns,
  vessels,
  batches,
  inventoryItems,
  packageSizes,
  packagingRunPhotos,
  users
} from 'db'
import { eq, and, desc, isNull, sql, gte, lte, like, or } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { publishCreateEvent, publishUpdateEvent } from 'lib'

// Input validation schemas
const createFromCellarSchema = z.object({
  batchId: z.string().uuid(),
  vesselId: z.string().uuid(),
  packagedAt: z.date().default(() => new Date()),
  packageSizeMl: z.number().positive(),
  unitsProduced: z.number().int().min(0),
  volumeTakenL: z.number().positive(),
  notes: z.string().optional()
})

const listPackagingRunsSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  batchId: z.string().uuid().optional(),
  packageType: z.string().optional(),
  status: z.enum(['completed', 'voided']).optional(),
  limit: z.number().default(50),
  offset: z.number().default(0)
})

/**
 * Generates a lot code for inventory items
 * Format: {BATCH_NAME}-{YYYYMMDD}-{RUN_SEQUENCE}
 */
function generateLotCode(batchName: string, packagedAt: Date, runSequence: number): string {
  const dateStr = packagedAt.toISOString().slice(0, 10).replace(/-/g, '')
  const sequence = runSequence.toString().padStart(2, '0')
  return `${batchName}-${dateStr}-${sequence}`
}

/**
 * Determines package type from package size
 */
function determinePackageType(packageSizeMl: number): string {
  if (packageSizeMl <= 500) return 'bottle'
  if (packageSizeMl <= 1000) return 'can'
  return 'keg'
}

/**
 * Calculate unit size in liters from package size in ML
 */
function calculateUnitSizeL(packageSizeMl: number): number {
  return packageSizeMl / 1000
}

/**
 * Packaging Router
 * Handles packaging operations from cellar to finished goods inventory
 * RBAC: Operator and above can create and read packaging runs
 */
export const packagingRouter = router({
  /**
   * Create packaging run from cellar modal
   * Creates run, updates vessel volume, creates inventory
   */
  createFromCellar: createRbacProcedure('create', 'packaging')
    .input(createFromCellarSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Validate vessel has sufficient volume and get details
          const vesselData = await tx
            .select({
              id: vessels.id,
              capacityL: vessels.capacityL,
              status: vessels.status,
              name: vessels.name
            })
            .from(vessels)
            .where(and(eq(vessels.id, input.vesselId), isNull(vessels.deletedAt)))
            .limit(1)

          if (!vesselData.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Vessel not found'
            })
          }

          const vessel = vesselData[0]

          // Check vessel status
          if (vessel.status !== 'in_use' && vessel.status !== 'fermenting') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Vessel must be in use or fermenting to package from. Current status: ${vessel.status}`
            })
          }

          // Get current vessel volume from active batch
          const batchData = await tx
            .select({
              id: batches.id,
              name: batches.name,
              currentVolumeL: batches.currentVolumeL,
              vesselId: batches.vesselId
            })
            .from(batches)
            .where(and(
              eq(batches.id, input.batchId),
              eq(batches.vesselId, input.vesselId),
              isNull(batches.deletedAt)
            ))
            .limit(1)

          if (!batchData.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Batch not found in specified vessel'
            })
          }

          const batch = batchData[0]
          const currentVolumeL = parseFloat(batch.currentVolumeL?.toString() || '0')

          // Validate sufficient volume
          if (currentVolumeL < input.volumeTakenL) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient volume in vessel. Available: ${currentVolumeL}L, Requested: ${input.volumeTakenL}L`
            })
          }

          // 2. Calculate loss and metrics
          const unitSizeL = calculateUnitSizeL(input.packageSizeMl)
          const theoreticalVolume = input.unitsProduced * unitSizeL
          const lossL = input.volumeTakenL - theoreticalVolume
          const lossPercentage = (lossL / input.volumeTakenL) * 100

          // 3. Determine package type and get run sequence
          const packageType = determinePackageType(input.packageSizeMl)

          // Get count of packaging runs for this batch to determine sequence
          const runCountResult = await tx
            .select({ count: sql<number>`count(*)` })
            .from(packagingRuns)
            .where(and(
              eq(packagingRuns.batchId, input.batchId),
              eq(packagingRuns.status, 'completed')
            ))

          const runSequence = (runCountResult[0]?.count || 0) + 1

          // 4. Create packaging run
          const packagingRunData: any = {
            batchId: input.batchId,
            vesselId: input.vesselId,
            packagedAt: input.packagedAt,
            packageType: packageType as any,
            packageSizeML: input.packageSizeMl,
            unitSizeL: unitSizeL.toString(),
            unitsProduced: input.unitsProduced,
            volumeTakenL: input.volumeTakenL.toString(),
            lossL: lossL.toString(),
            lossPercentage: lossPercentage.toString(),
            status: 'completed' as any,
            createdBy: ctx.session?.user?.id || ''
          }

          if (input.notes) {
            packagingRunData.productionNotes = input.notes
          }

          const newPackagingRun = await tx
            .insert(packagingRuns)
            .values(packagingRunData)
            .returning()

          const packagingRun = newPackagingRun[0]

          // 5. Update vessel/batch volume
          const newVolumeL = currentVolumeL - input.volumeTakenL

          await tx
            .update(batches)
            .set({
              currentVolumeL: newVolumeL.toString(),
              updatedAt: new Date()
            })
            .where(eq(batches.id, input.batchId))

          // Update vessel status if volume is depleted
          let vesselStatus = vessel.status
          if (newVolumeL <= 0) {
            vesselStatus = 'cleaning' as any
            await tx
              .update(vessels)
              .set({
                status: 'cleaning' as any,
                updatedAt: new Date()
              })
              .where(eq(vessels.id, input.vesselId))
          }

          // 6. Generate lot code and create inventory item
          const lotCode = generateLotCode(batch.name || 'BATCH', input.packagedAt, runSequence)

          // Calculate expiration date (1 year from packaging)
          const expirationDate = new Date(input.packagedAt)
          expirationDate.setFullYear(expirationDate.getFullYear() + 1)

          const newInventoryItem = await tx
            .insert(inventoryItems)
            .values({
              batchId: input.batchId,
              lotCode: lotCode,
              packagingRunId: packagingRun.id,
              packageType: packageType,
              packageSizeML: input.packageSizeMl,
              expirationDate: expirationDate.toISOString().slice(0, 10) as any
            })
            .returning()

          const inventoryItem = newInventoryItem[0]

          // 7. Publish audit event
          await publishCreateEvent('packaging_run', packagingRun.id, {
            batchId: input.batchId,
            vesselId: input.vesselId,
            unitsProduced: input.unitsProduced,
            volumeTakenL: input.volumeTakenL,
            lossL: lossL,
            packageType: packageType
          })

          return {
            runId: packagingRun.id,
            lossL: parseFloat(lossL.toFixed(2)),
            lossPercentage: parseFloat(lossPercentage.toFixed(2)),
            vesselStatus: vesselStatus,
            inventoryItemId: inventoryItem.id,
            lotCode: lotCode
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error creating packaging run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create packaging run'
        })
      }
    }),

  /**
   * Get single packaging run by ID
   * Returns full run details with relations
   */
  get: createRbacProcedure('read', 'packaging')
    .input(z.string().uuid())
    .query(async ({ input: runId }) => {
      try {
        const packagingRunData = await db
          .select({
            id: packagingRuns.id,
            batchId: packagingRuns.batchId,
            vesselId: packagingRuns.vesselId,
            packagedAt: packagingRuns.packagedAt,
            packageType: packagingRuns.packageType,
            packageSizeML: packagingRuns.packageSizeML,
            unitSizeL: packagingRuns.unitSizeL,
            unitsProduced: packagingRuns.unitsProduced,
            volumeTakenL: packagingRuns.volumeTakenL,
            lossL: packagingRuns.lossL,
            lossPercentage: packagingRuns.lossPercentage,
            abvAtPackaging: packagingRuns.abvAtPackaging,
            carbonationLevel: packagingRuns.carbonationLevel,
            fillCheck: packagingRuns.fillCheck,
            fillVarianceML: packagingRuns.fillVarianceML,
            testMethod: packagingRuns.testMethod,
            testDate: packagingRuns.testDate,
            qaTechnicianId: packagingRuns.qaTechnicianId,
            qaNotes: packagingRuns.qaNotes,
            productionNotes: packagingRuns.productionNotes,
            status: packagingRuns.status,
            voidReason: packagingRuns.voidReason,
            voidedAt: packagingRuns.voidedAt,
            voidedBy: packagingRuns.voidedBy,
            createdBy: packagingRuns.createdBy,
            createdAt: packagingRuns.createdAt,
            updatedAt: packagingRuns.updatedAt,
            // Relations
            batchName: batches.name,
            vesselName: vessels.name,
            qaTechnicianName: sql<string>`qa_tech.name`.as('qaTechnicianName'),
            voidedByName: sql<string>`voided_user.name`.as('voidedByName'),
            createdByName: sql<string>`created_user.name`.as('createdByName')
          })
          .from(packagingRuns)
          .leftJoin(batches, eq(packagingRuns.batchId, batches.id))
          .leftJoin(vessels, eq(packagingRuns.vesselId, vessels.id))
          .leftJoin(sql`users AS qa_tech`, sql`qa_tech.id = ${packagingRuns.qaTechnicianId}`)
          .leftJoin(sql`users AS voided_user`, sql`voided_user.id = ${packagingRuns.voidedBy}`)
          .leftJoin(sql`users AS created_user`, sql`created_user.id = ${packagingRuns.createdBy}`)
          .where(eq(packagingRuns.id, runId))
          .limit(1)

        if (!packagingRunData.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Packaging run not found'
          })
        }

        const run = packagingRunData[0]

        // Get inventory items for this run
        const inventory = await db
          .select({
            id: inventoryItems.id,
            lotCode: inventoryItems.lotCode,
            packageType: inventoryItems.packageType,
            packageSizeML: inventoryItems.packageSizeML,
            expirationDate: inventoryItems.expirationDate,
            createdAt: inventoryItems.createdAt
          })
          .from(inventoryItems)
          .where(and(
            eq(inventoryItems.packagingRunId, runId),
            isNull(inventoryItems.deletedAt)
          ))

        // Get photos for this run
        const photos = await db
          .select({
            id: packagingRunPhotos.id,
            photoUrl: packagingRunPhotos.photoUrl,
            photoType: packagingRunPhotos.photoType,
            caption: packagingRunPhotos.caption,
            uploadedBy: packagingRunPhotos.uploadedBy,
            uploadedAt: packagingRunPhotos.uploadedAt,
            uploaderName: users.name
          })
          .from(packagingRunPhotos)
          .leftJoin(users, eq(packagingRunPhotos.uploadedBy, users.id))
          .where(eq(packagingRunPhotos.packagingRunId, runId))
          .orderBy(desc(packagingRunPhotos.uploadedAt))

        return {
          ...run,
          batch: {
            id: run.batchId,
            name: run.batchName
          },
          vessel: {
            id: run.vesselId,
            name: run.vesselName
          },
          inventory,
          photos,
          // Convert string numbers to numbers
          volumeTakenL: parseFloat(run.volumeTakenL?.toString() || '0'),
          lossL: parseFloat(run.lossL?.toString() || '0'),
          lossPercentage: parseFloat(run.lossPercentage?.toString() || '0'),
          abvAtPackaging: run.abvAtPackaging ? parseFloat(run.abvAtPackaging.toString()) : undefined,
          fillVarianceML: run.fillVarianceML ? parseFloat(run.fillVarianceML.toString()) : undefined,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error getting packaging run:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get packaging run'
        })
      }
    }),

  /**
   * List packaging runs with filters and pagination
   */
  list: createRbacProcedure('list', 'packaging')
    .input(listPackagingRunsSchema.optional())
    .query(async ({ input = {} }) => {
      try {
        // Build WHERE conditions
        const conditions = []

        if (input.dateFrom) {
          conditions.push(gte(packagingRuns.packagedAt, input.dateFrom))
        }

        if (input.dateTo) {
          conditions.push(lte(packagingRuns.packagedAt, input.dateTo))
        }

        if (input.batchId) {
          conditions.push(eq(packagingRuns.batchId, input.batchId))
        }

        if (input.packageType) {
          conditions.push(eq(packagingRuns.packageType, input.packageType as any))
        }

        if (input.status) {
          conditions.push(eq(packagingRuns.status, input.status as any))
        }

        // Query packaging runs with batch and vessel info
        const runs = await db
          .select({
            id: packagingRuns.id,
            batchId: packagingRuns.batchId,
            vesselId: packagingRuns.vesselId,
            packagedAt: packagingRuns.packagedAt,
            packageType: packagingRuns.packageType,
            packageSizeML: packagingRuns.packageSizeML,
            unitsProduced: packagingRuns.unitsProduced,
            volumeTakenL: packagingRuns.volumeTakenL,
            lossL: packagingRuns.lossL,
            lossPercentage: packagingRuns.lossPercentage,
            status: packagingRuns.status,
            createdAt: packagingRuns.createdAt,
            // Relations
            batchName: batches.name,
            vesselName: vessels.name
          })
          .from(packagingRuns)
          .leftJoin(batches, eq(packagingRuns.batchId, batches.id))
          .leftJoin(vessels, eq(packagingRuns.vesselId, vessels.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(packagingRuns.packagedAt))
          .limit(input.limit || 50)
          .offset(input.offset || 0)

        // Get total count for pagination
        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(packagingRuns)
          .where(conditions.length > 0 ? and(...conditions) : undefined)

        const totalCount = totalCountResult[0]?.count || 0

        // Convert string numbers to numbers and format response
        const formattedRuns = runs.map(run => ({
          ...run,
          volumeTakenL: parseFloat(run.volumeTakenL?.toString() || '0'),
          lossL: parseFloat(run.lossL?.toString() || '0'),
          lossPercentage: parseFloat(run.lossPercentage?.toString() || '0'),
          batch: {
            id: run.batchId,
            name: run.batchName
          },
          vessel: {
            id: run.vesselId,
            name: run.vesselName
          }
        }))

        return {
          runs: formattedRuns,
          total: totalCount,
          hasMore: (input.offset || 0) + (input.limit || 50) < totalCount
        }
      } catch (error) {
        console.error('Error listing packaging runs:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list packaging runs'
        })
      }
    }),

  /**
   * Update QA fields for a packaging run
   * Updates QA-specific fields with validation and audit logging
   */
  updateQA: createRbacProcedure('update', 'packaging')
    .input(z.object({
      runId: z.string().uuid(),
      fillCheck: z.enum(['pass', 'fail', 'not_tested']).optional(),
      fillVarianceMl: z.number().optional(),
      abvAtPackaging: z.number().min(0).max(100).optional(),
      carbonationLevel: z.enum(['still', 'petillant', 'sparkling']).optional(),
      testMethod: z.string().optional(),
      testDate: z.date().optional(),
      qaTechnicianId: z.string().uuid().optional(),
      qaNotes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Get current packaging run data for audit logging
          const currentRun = await tx
            .select({
              id: packagingRuns.id,
              batchId: packagingRuns.batchId,
              fillCheck: packagingRuns.fillCheck,
              fillVarianceML: packagingRuns.fillVarianceML,
              abvAtPackaging: packagingRuns.abvAtPackaging,
              carbonationLevel: packagingRuns.carbonationLevel,
              testMethod: packagingRuns.testMethod,
              testDate: packagingRuns.testDate,
              qaTechnicianId: packagingRuns.qaTechnicianId,
              qaNotes: packagingRuns.qaNotes,
              status: packagingRuns.status
            })
            .from(packagingRuns)
            .where(eq(packagingRuns.id, input.runId))
            .limit(1)

          if (!currentRun.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Packaging run not found'
            })
          }

          const run = currentRun[0]

          // 2. Validate QA technician exists if provided
          if (input.qaTechnicianId) {
            const technician = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, input.qaTechnicianId))
              .limit(1)

            if (!technician.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'QA technician not found'
              })
            }
          }

          // 3. Build update data only for provided fields
          const updateData: any = {
            updatedAt: new Date()
          }

          if (input.fillCheck !== undefined) updateData.fillCheck = input.fillCheck
          if (input.fillVarianceMl !== undefined) updateData.fillVarianceML = input.fillVarianceMl.toString()
          if (input.abvAtPackaging !== undefined) updateData.abvAtPackaging = input.abvAtPackaging.toString()
          if (input.carbonationLevel !== undefined) updateData.carbonationLevel = input.carbonationLevel
          if (input.testMethod !== undefined) updateData.testMethod = input.testMethod
          if (input.testDate !== undefined) updateData.testDate = input.testDate
          if (input.qaTechnicianId !== undefined) updateData.qaTechnicianId = input.qaTechnicianId
          if (input.qaNotes !== undefined) updateData.qaNotes = input.qaNotes

          // 4. Update the packaging run
          const updatedRun = await tx
            .update(packagingRuns)
            .set(updateData)
            .where(eq(packagingRuns.id, input.runId))
            .returning()

          if (!updatedRun.length) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to update packaging run'
            })
          }

          // 5. Prepare audit data - only include changed fields
          const oldData: Record<string, any> = {}
          const newData: Record<string, any> = {}

          if (input.fillCheck !== undefined && run.fillCheck !== input.fillCheck) {
            oldData.fillCheck = run.fillCheck
            newData.fillCheck = input.fillCheck
          }
          if (input.fillVarianceMl !== undefined && parseFloat(run.fillVarianceML?.toString() || '0') !== input.fillVarianceMl) {
            oldData.fillVarianceMl = parseFloat(run.fillVarianceML?.toString() || '0')
            newData.fillVarianceMl = input.fillVarianceMl
          }
          if (input.abvAtPackaging !== undefined && parseFloat(run.abvAtPackaging?.toString() || '0') !== input.abvAtPackaging) {
            oldData.abvAtPackaging = parseFloat(run.abvAtPackaging?.toString() || '0')
            newData.abvAtPackaging = input.abvAtPackaging
          }
          if (input.carbonationLevel !== undefined && run.carbonationLevel !== input.carbonationLevel) {
            oldData.carbonationLevel = run.carbonationLevel
            newData.carbonationLevel = input.carbonationLevel
          }
          if (input.testMethod !== undefined && run.testMethod !== input.testMethod) {
            oldData.testMethod = run.testMethod
            newData.testMethod = input.testMethod
          }
          if (input.testDate !== undefined && run.testDate?.toISOString() !== input.testDate.toISOString()) {
            oldData.testDate = run.testDate
            newData.testDate = input.testDate
          }
          if (input.qaTechnicianId !== undefined && run.qaTechnicianId !== input.qaTechnicianId) {
            oldData.qaTechnicianId = run.qaTechnicianId
            newData.qaTechnicianId = input.qaTechnicianId
          }
          if (input.qaNotes !== undefined && run.qaNotes !== input.qaNotes) {
            oldData.qaNotes = run.qaNotes
            newData.qaNotes = input.qaNotes
          }

          // 6. Publish audit event only if there were actual changes
          if (Object.keys(newData).length > 0) {
            await publishUpdateEvent(
              'packaging_run',
              input.runId,
              oldData,
              newData,
              ctx.session?.user?.id,
              'QA fields updated'
            )
          }

          // 7. Return the updated run with parsed numbers
          const result = updatedRun[0]
          return {
            id: result.id,
            fillCheck: result.fillCheck,
            fillVarianceMl: result.fillVarianceML ? parseFloat(result.fillVarianceML.toString()) : undefined,
            abvAtPackaging: result.abvAtPackaging ? parseFloat(result.abvAtPackaging.toString()) : undefined,
            carbonationLevel: result.carbonationLevel,
            testMethod: result.testMethod,
            testDate: result.testDate,
            qaTechnicianId: result.qaTechnicianId,
            qaNotes: result.qaNotes,
            updatedAt: result.updatedAt
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error updating QA fields:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update QA fields'
        })
      }
    }),

  /**
   * Get package sizes for dropdown population
   */
  getPackageSizes: createRbacProcedure('read', 'packaging')
    .query(async () => {
      try {
        const sizes = await db
          .select({
            id: packageSizes.id,
            sizeML: packageSizes.sizeML,
            sizeOz: packageSizes.sizeOz,
            displayName: packageSizes.displayName,
            packageType: packageSizes.packageType,
            sortOrder: packageSizes.sortOrder
          })
          .from(packageSizes)
          .where(eq(packageSizes.isActive, true))
          .orderBy(packageSizes.sortOrder, packageSizes.sizeML)

        return sizes.map(size => ({
          ...size,
          sizeOz: size.sizeOz ? parseFloat(size.sizeOz.toString()) : undefined
        }))
      } catch (error) {
        console.error('Error getting package sizes:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get package sizes'
        })
      }
    })
})

export type PackagingRouter = typeof packagingRouter