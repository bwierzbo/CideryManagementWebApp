import { z } from 'zod'
import { router, publicProcedure, protectedProcedure, adminProcedure, createRbacProcedure } from '../trpc'
import { auditRouter } from './audit'
import { healthRouter } from './health'
import { 
  db, 
  vendors, 
  purchases, 
  purchaseItems,
  pressRuns,
  pressItems,
  batches,
  batchIngredients,
  batchMeasurements,
  packages,
  inventory,
  inventoryTransactions,
  vessels,
  appleVarieties,
  auditLog 
} from 'db'
import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { publishCreateEvent, publishUpdateEvent, publishDeleteEvent } from 'lib'

export const appRouter = router({
  // Basic health check
  ping: publicProcedure.query(() => {
    return { ok: true }
  }),

  // Protected procedure that requires authentication
  profile: protectedProcedure.query(({ ctx }) => {
    return {
      user: ctx.session?.user,
      message: 'This is a protected route'
    }
  }),

  // Admin-only procedure
  adminInfo: adminProcedure.query(({ ctx }) => {
    return {
      user: ctx.session?.user,
      message: 'This is an admin-only route',
      timestamp: new Date().toISOString()
    }
  }),

  // Vendor management with proper RBAC and audit logging
  vendor: router({
    list: createRbacProcedure('list', 'vendor').query(async () => {
      try {
        const vendorList = await db
          .select()
          .from(vendors)
          .where(eq(vendors.isActive, true))
          .orderBy(vendors.name)

        return {
          vendors: vendorList,
          count: vendorList.length,
        }
      } catch (error) {
        console.error('Error listing vendors:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list vendors'
        })
      }
    }),

    create: createRbacProcedure('create', 'vendor')
      .input(z.object({
        name: z.string().min(1, 'Name is required'),
        contactInfo: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const newVendor = await db
            .insert(vendors)
            .values({
              name: input.name,
              contactInfo: input.contactInfo,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()

          // Audit logging
          await db.insert(auditLog).values({
            tableName: 'vendors',
            recordId: newVendor[0].id,
            operation: 'create',
            newData: { vendorId: newVendor[0].id, vendorName: input.name },
            changedBy: ctx.session?.user?.id,
          })

          return {
            success: true,
            vendor: newVendor[0],
            message: `Vendor "${input.name}" created successfully`,
          }
        } catch (error) {
          console.error('Error creating vendor:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create vendor'
          })
        }
      }),

    delete: createRbacProcedure('delete', 'vendor')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await db
            .select()
            .from(vendors)
            .where(eq(vendors.id, input.id))
            .limit(1)

          if (!existing.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Vendor not found'
            })
          }

          const deletedVendor = await db
            .update(vendors)
            .set({
              isActive: false,
              updatedAt: new Date(),
            })
            .where(eq(vendors.id, input.id))
            .returning()

          // Audit logging
          await db.insert(auditLog).values({
            tableName: 'vendors',
            recordId: input.id,
            operation: 'delete',
            oldData: existing[0],
            newData: { isActive: false },
            changedBy: ctx.session?.user?.id,
          })

          return {
            success: true,
            message: `Vendor "${existing[0].name}" deleted successfully`,
            vendor: deletedVendor[0],
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error deleting vendor:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete vendor'
          })
        }
      })
  }),

  // Purchase management
  purchase: router({
    list: createRbacProcedure('list', 'purchase').query(async () => {
      try {
        const purchaseList = await db
          .select({
            id: purchases.id,
            vendorId: purchases.vendorId,
            purchaseDate: purchases.purchaseDate,
            invoiceNumber: purchases.invoiceNumber,
            totalCost: purchases.totalCost,
            notes: purchases.notes,
            createdAt: purchases.createdAt,
          })
          .from(purchases)
          .where(isNull(purchases.deletedAt))
          .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt))

        return {
          purchases: purchaseList,
          count: purchaseList.length,
        }
      } catch (error) {
        console.error('Error listing purchases:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list purchases'
        })
      }
    }),

    create: createRbacProcedure('create', 'purchase')
      .input(z.object({
        vendorId: z.string().uuid('Invalid vendor ID'),
        purchaseDate: z.date().or(z.string().transform(val => new Date(val))),
        invoiceNumber: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          appleVarietyId: z.string().uuid('Invalid apple variety ID'),
          quantity: z.number().positive('Quantity must be positive'),
          unit: z.enum(['kg', 'lb', 'L', 'gal']),
          pricePerUnit: z.number().positive('Price per unit must be positive'),
          notes: z.string().optional(),
        })).min(1, 'At least one item is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Calculate total cost and convert units
            let totalCost = 0
            const processedItems = []

            for (const item of input.items) {
              const itemTotal = item.quantity * item.pricePerUnit
              totalCost += itemTotal

              // Convert to canonical units (kg for weight, L for volume)
              let quantityKg: number | null = null
              let quantityL: number | null = null

              if (item.unit === 'kg') {
                quantityKg = item.quantity
              } else if (item.unit === 'lb') {
                quantityKg = item.quantity * 0.453592 // lb to kg
              } else if (item.unit === 'L') {
                quantityL = item.quantity
              } else if (item.unit === 'gal') {
                quantityL = item.quantity * 3.78541 // gal to L
              }

              processedItems.push({
                ...item,
                totalCost: itemTotal,
                quantityKg,
                quantityL,
              })
            }

            // Create the purchase
            const newPurchase = await tx
              .insert(purchases)
              .values({
                vendorId: input.vendorId,
                purchaseDate: input.purchaseDate,
                totalCost: totalCost.toString(),
                invoiceNumber: input.invoiceNumber,
                notes: input.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            const purchaseId = newPurchase[0].id

            // Create purchase items
            const newItems = await tx
              .insert(purchaseItems)
              .values(
                processedItems.map((item) => ({
                  purchaseId,
                  appleVarietyId: item.appleVarietyId,
                  quantity: item.quantity.toString(),
                  unit: item.unit,
                  pricePerUnit: item.pricePerUnit.toString(),
                  totalCost: item.totalCost.toString(),
                  quantityKg: item.quantityKg?.toString(),
                  quantityL: item.quantityL?.toString(),
                  notes: item.notes,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }))
              )
              .returning()

            // Publish audit events
            await publishCreateEvent(
              'purchases',
              purchaseId,
              { purchaseId, vendorId: input.vendorId, totalCost, itemCount: input.items.length },
              ctx.session?.user?.id,
              'Purchase created via API'
            )

            for (const item of newItems) {
              await publishCreateEvent(
                'purchase_items',
                item.id,
                { itemId: item.id, purchaseId, appleVarietyId: item.appleVarietyId },
                ctx.session?.user?.id,
                'Purchase item created via API'
              )
            }

            return {
              success: true,
              purchase: newPurchase[0],
              items: newItems,
              message: `Purchase created with ${newItems.length} items`,
            }
          })
        } catch (error) {
          console.error('Error creating purchase:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create purchase'
          })
        }
      }),

    getById: createRbacProcedure('read', 'purchase')
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const purchase = await db
            .select()
            .from(purchases)
            .where(and(eq(purchases.id, input.id), isNull(purchases.deletedAt)))
            .limit(1)

          if (!purchase.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Purchase not found'
            })
          }

          const items = await db
            .select()
            .from(purchaseItems)
            .where(and(eq(purchaseItems.purchaseId, input.id), isNull(purchaseItems.deletedAt)))

          return {
            purchase: purchase[0],
            items,
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error getting purchase:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get purchase'
          })
        }
      }),
  }),

  // Press management
  press: router({
    list: createRbacProcedure('list', 'press').query(async () => {
      try {
        const pressList = await db
          .select({
            id: pressRuns.id,
            runDate: pressRuns.runDate,
            totalAppleProcessedKg: pressRuns.totalAppleProcessedKg,
            totalJuiceProducedL: pressRuns.totalJuiceProducedL,
            extractionRate: pressRuns.extractionRate,
            notes: pressRuns.notes,
            createdAt: pressRuns.createdAt,
          })
          .from(pressRuns)
          .where(isNull(pressRuns.deletedAt))
          .orderBy(desc(pressRuns.runDate), desc(pressRuns.createdAt))

        return {
          pressRuns: pressList,
          count: pressList.length,
        }
      } catch (error) {
        console.error('Error listing press runs:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list press runs'
        })
      }
    }),

    start: createRbacProcedure('create', 'press')
      .input(z.object({
        runDate: z.date().or(z.string().transform(val => new Date(val))),
        notes: z.string().optional(),
        items: z.array(z.object({
          purchaseItemId: z.string().uuid('Invalid purchase item ID'),
          quantityUsedKg: z.number().positive('Quantity used must be positive'),
          brixMeasured: z.number().min(0).max(30).optional(),
          notes: z.string().optional(),
        })).min(1, 'At least one purchase item is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Calculate totals and validate purchase items
            let totalAppleProcessedKg = 0
            let totalJuiceProducedL = 0
            const processedItems = []

            for (const item of input.items) {
              // Verify purchase item exists and has enough quantity
              const purchaseItem = await tx
                .select()
                .from(purchaseItems)
                .where(and(eq(purchaseItems.id, item.purchaseItemId), isNull(purchaseItems.deletedAt)))
                .limit(1)

              if (!purchaseItem.length) {
                throw new TRPCError({
                  code: 'NOT_FOUND',
                  message: `Purchase item ${item.purchaseItemId} not found`
                })
              }

              // Check if enough quantity is available (basic validation)
              const availableKg = parseFloat(purchaseItem[0].quantityKg || '0')
              if (item.quantityUsedKg > availableKg) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Not enough quantity available for purchase item ${item.purchaseItemId}`
                })
              }

              totalAppleProcessedKg += item.quantityUsedKg

              // Estimate juice production (60-70% extraction rate)
              const estimatedJuiceL = item.quantityUsedKg * 0.65 // 65% extraction rate
              totalJuiceProducedL += estimatedJuiceL

              processedItems.push({
                ...item,
                juiceProducedL: estimatedJuiceL,
              })
            }

            // Calculate overall extraction rate
            const extractionRate = totalAppleProcessedKg > 0 ? totalJuiceProducedL / totalAppleProcessedKg : 0

            // Create the press run
            const newPressRun = await tx
              .insert(pressRuns)
              .values({
                runDate: input.runDate,
                notes: input.notes,
                totalAppleProcessedKg: totalAppleProcessedKg.toString(),
                totalJuiceProducedL: totalJuiceProducedL.toString(),
                extractionRate: extractionRate.toString(),
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            const pressRunId = newPressRun[0].id

            // Create press items
            const newItems = await tx
              .insert(pressItems)
              .values(
                processedItems.map((item) => ({
                  pressRunId,
                  purchaseItemId: item.purchaseItemId,
                  quantityUsedKg: item.quantityUsedKg.toString(),
                  juiceProducedL: item.juiceProducedL.toString(),
                  brixMeasured: item.brixMeasured?.toString(),
                  notes: item.notes,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }))
              )
              .returning()

            // Publish audit events
            await publishCreateEvent(
              'press_runs',
              pressRunId,
              { pressRunId, totalAppleKg: totalAppleProcessedKg, totalJuiceL: totalJuiceProducedL },
              ctx.session?.user?.id,
              'Press run started via API'
            )

            for (const item of newItems) {
              await publishCreateEvent(
                'press_items',
                item.id,
                { itemId: item.id, pressRunId, purchaseItemId: item.purchaseItemId },
                ctx.session?.user?.id,
                'Press item created via API'
              )
            }

            return {
              success: true,
              pressRun: newPressRun[0],
              items: newItems,
              message: `Press run started with ${newItems.length} items`,
            }
          })
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error starting press run:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to start press run'
          })
        }
      }),

    complete: createRbacProcedure('update', 'press')
      .input(z.object({
        pressRunId: z.string().uuid('Invalid press run ID'),
        actualTotalJuiceProducedL: z.number().positive('Total juice produced must be positive'),
        items: z.array(z.object({
          pressItemId: z.string().uuid('Invalid press item ID'),
          actualJuiceProducedL: z.number().positive('Actual juice produced must be positive'),
          finalBrixMeasured: z.number().min(0).max(30).optional(),
          notes: z.string().optional(),
        })),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify press run exists
            const pressRun = await tx
              .select()
              .from(pressRuns)
              .where(and(eq(pressRuns.id, input.pressRunId), isNull(pressRuns.deletedAt)))
              .limit(1)

            if (!pressRun.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Press run not found'
              })
            }

            // Calculate actual extraction rate
            const totalAppleProcessedKg = parseFloat(pressRun[0].totalAppleProcessedKg)
            const actualExtractionRate = totalAppleProcessedKg > 0 ? input.actualTotalJuiceProducedL / totalAppleProcessedKg : 0

            // Update press run with actual values
            const updatedPressRun = await tx
              .update(pressRuns)
              .set({
                totalJuiceProducedL: input.actualTotalJuiceProducedL.toString(),
                extractionRate: actualExtractionRate.toString(),
                notes: input.notes || pressRun[0].notes,
                updatedAt: new Date(),
              })
              .where(eq(pressRuns.id, input.pressRunId))
              .returning()

            // Update press items with actual values
            const updatedItems = []
            for (const item of input.items) {
              const updatedItem = await tx
                .update(pressItems)
                .set({
                  juiceProducedL: item.actualJuiceProducedL.toString(),
                  brixMeasured: item.finalBrixMeasured?.toString(),
                  notes: item.notes,
                  updatedAt: new Date(),
                })
                .where(and(eq(pressItems.id, item.pressItemId), eq(pressItems.pressRunId, input.pressRunId)))
                .returning()

              if (updatedItem.length) {
                updatedItems.push(updatedItem[0])
              }
            }

            // Publish audit events
            await publishUpdateEvent(
              'press_runs',
              input.pressRunId,
              pressRun[0],
              { totalJuiceProducedL: input.actualTotalJuiceProducedL, extractionRate: actualExtractionRate },
              ctx.session?.user?.id,
              'Press run completed via API'
            )

            return {
              success: true,
              pressRun: updatedPressRun[0],
              items: updatedItems,
              message: `Press run completed with actual yield of ${input.actualTotalJuiceProducedL}L`,
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

    getById: createRbacProcedure('read', 'press')
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const pressRun = await db
            .select()
            .from(pressRuns)
            .where(and(eq(pressRuns.id, input.id), isNull(pressRuns.deletedAt)))
            .limit(1)

          if (!pressRun.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Press run not found'
            })
          }

          const items = await db
            .select()
            .from(pressItems)
            .where(and(eq(pressItems.pressRunId, input.id), isNull(pressItems.deletedAt)))

          return {
            pressRun: pressRun[0],
            items,
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
  }),

  // Batch management
  batch: router({
    list: createRbacProcedure('list', 'batch').query(async () => {
      try {
        const batchList = await db
          .select({
            id: batches.id,
            batchNumber: batches.batchNumber,
            status: batches.status,
            vesselId: batches.vesselId,
            startDate: batches.startDate,
            targetCompletionDate: batches.targetCompletionDate,
            actualCompletionDate: batches.actualCompletionDate,
            initialVolumeL: batches.initialVolumeL,
            currentVolumeL: batches.currentVolumeL,
            targetAbv: batches.targetAbv,
            actualAbv: batches.actualAbv,
            createdAt: batches.createdAt,
          })
          .from(batches)
          .where(isNull(batches.deletedAt))
          .orderBy(desc(batches.startDate), desc(batches.createdAt))

        return {
          batches: batchList,
          count: batchList.length,
        }
      } catch (error) {
        console.error('Error listing batches:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list batches'
        })
      }
    }),

    startFromJuiceLot: createRbacProcedure('create', 'batch')
      .input(z.object({
        batchNumber: z.string().min(1, 'Batch number is required'),
        vesselId: z.string().uuid('Invalid vessel ID'),
        startDate: z.date().or(z.string().transform(val => new Date(val))),
        targetCompletionDate: z.date().or(z.string().transform(val => new Date(val))).optional(),
        targetAbv: z.number().min(0).max(20).optional(),
        notes: z.string().optional(),
        pressItems: z.array(z.object({
          pressItemId: z.string().uuid('Invalid press item ID'),
          volumeUsedL: z.number().positive('Volume used must be positive'),
          brixAtUse: z.number().min(0).max(30).optional(),
          notes: z.string().optional(),
        })).min(1, 'At least one press item is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify vessel is available
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

            // Calculate total volume and validate press items
            let totalVolumeL = 0
            const processedItems = []

            for (const item of input.pressItems) {
              // Verify press item exists and has enough juice
              const pressItem = await tx
                .select()
                .from(pressItems)
                .where(and(eq(pressItems.id, item.pressItemId), isNull(pressItems.deletedAt)))
                .limit(1)

              if (!pressItem.length) {
                throw new TRPCError({
                  code: 'NOT_FOUND',
                  message: `Press item ${item.pressItemId} not found`
                })
              }

              const availableL = parseFloat(pressItem[0].juiceProducedL)
              if (item.volumeUsedL > availableL) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Not enough juice available for press item ${item.pressItemId}`
                })
              }

              totalVolumeL += item.volumeUsedL
              processedItems.push(item)
            }

            // Check vessel capacity
            const vesselCapacityL = parseFloat(vessel[0].capacityL)
            if (totalVolumeL > vesselCapacityL) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Total volume (${totalVolumeL}L) exceeds vessel capacity (${vesselCapacityL}L)`
              })
            }

            // Create the batch
            const newBatch = await tx
              .insert(batches)
              .values({
                batchNumber: input.batchNumber,
                status: 'active',
                vesselId: input.vesselId,
                startDate: input.startDate,
                targetCompletionDate: input.targetCompletionDate,
                initialVolumeL: totalVolumeL.toString(),
                currentVolumeL: totalVolumeL.toString(),
                targetAbv: input.targetAbv?.toString(),
                notes: input.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            const batchId = newBatch[0].id

            // Create batch ingredients
            const newIngredients = await tx
              .insert(batchIngredients)
              .values(
                processedItems.map((item) => ({
                  batchId,
                  pressItemId: item.pressItemId,
                  volumeUsedL: item.volumeUsedL.toString(),
                  brixAtUse: item.brixAtUse?.toString(),
                  notes: item.notes,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }))
              )
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
            await publishCreateEvent(
              'batches',
              batchId,
              { batchId, batchNumber: input.batchNumber, vesselId: input.vesselId, initialVolumeL: totalVolumeL },
              ctx.session?.user?.id,
              'Batch started from juice lot via API'
            )

            return {
              success: true,
              batch: newBatch[0],
              ingredients: newIngredients,
              message: `Batch ${input.batchNumber} started with ${totalVolumeL}L`,
            }
          })
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error starting batch from juice lot:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to start batch from juice lot'
          })
        }
      }),

    addMeasurement: createRbacProcedure('create', 'batch')
      .input(z.object({
        batchId: z.string().uuid('Invalid batch ID'),
        measurementDate: z.date().or(z.string().transform(val => new Date(val))),
        specificGravity: z.number().min(0.990).max(1.200).optional(),
        abv: z.number().min(0).max(20).optional(),
        ph: z.number().min(2).max(5).optional(),
        totalAcidity: z.number().min(0).max(15).optional(),
        temperature: z.number().min(-10).max(50).optional(),
        volumeL: z.number().positive().optional(),
        notes: z.string().optional(),
        takenBy: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Verify batch exists
          const batch = await db
            .select()
            .from(batches)
            .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
            .limit(1)

          if (!batch.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Batch not found'
            })
          }

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
              takenBy: input.takenBy || ctx.session?.user?.name || ctx.session?.user?.email,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()

          // Update batch current volume and ABV if provided
          const updateData: any = { updatedAt: new Date() }
          if (input.volumeL) {
            updateData.currentVolumeL = input.volumeL.toString()
          }
          if (input.abv) {
            updateData.actualAbv = input.abv.toString()
          }

          if (Object.keys(updateData).length > 1) {
            await db
              .update(batches)
              .set(updateData)
              .where(eq(batches.id, input.batchId))
          }

          // Publish audit event
          await publishCreateEvent(
            'batch_measurements',
            newMeasurement[0].id,
            { measurementId: newMeasurement[0].id, batchId: input.batchId, abv: input.abv },
            ctx.session?.user?.id,
            'Batch measurement added via API'
          )

          return {
            success: true,
            measurement: newMeasurement[0],
            message: 'Measurement added successfully',
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error adding batch measurement:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to add batch measurement'
          })
        }
      }),

    transfer: createRbacProcedure('update', 'batch')
      .input(z.object({
        batchId: z.string().uuid('Invalid batch ID'),
        newVesselId: z.string().uuid('Invalid vessel ID'),
        volumeTransferredL: z.number().positive('Volume transferred must be positive'),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify batch exists
            const batch = await tx
              .select()
              .from(batches)
              .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
              .limit(1)

            if (!batch.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Batch not found'
              })
            }

            // Verify new vessel is available
            const newVessel = await tx
              .select()
              .from(vessels)
              .where(and(eq(vessels.id, input.newVesselId), isNull(vessels.deletedAt)))
              .limit(1)

            if (!newVessel.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'New vessel not found'
              })
            }

            if (newVessel[0].status !== 'available') {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'New vessel is not available'
              })
            }

            // Check capacity
            const newVesselCapacityL = parseFloat(newVessel[0].capacityL)
            if (input.volumeTransferredL > newVesselCapacityL) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Volume exceeds new vessel capacity'
              })
            }

            const currentVolumeL = parseFloat(batch[0].currentVolumeL)
            if (input.volumeTransferredL > currentVolumeL) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Not enough volume in batch for transfer'
              })
            }

            // Update batch vessel and volume
            const updatedBatch = await tx
              .update(batches)
              .set({
                vesselId: input.newVesselId,
                currentVolumeL: input.volumeTransferredL.toString(),
                notes: input.notes || batch[0].notes,
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))
              .returning()

            // Update old vessel to available
            if (batch[0].vesselId) {
              await tx
                .update(vessels)
                .set({
                  status: 'available',
                  updatedAt: new Date(),
                })
                .where(eq(vessels.id, batch[0].vesselId))
            }

            // Update new vessel to in_use
            await tx
              .update(vessels)
              .set({
                status: 'in_use',
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.newVesselId))

            // Publish audit event
            await publishUpdateEvent(
              'batches',
              input.batchId,
              batch[0],
              { vesselId: input.newVesselId, currentVolumeL: input.volumeTransferredL },
              ctx.session?.user?.id,
              'Batch transferred to new vessel via API'
            )

            return {
              success: true,
              batch: updatedBatch[0],
              message: `Batch transferred to new vessel with ${input.volumeTransferredL}L`,
            }
          })
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error transferring batch:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to transfer batch'
          })
        }
      }),

    getById: createRbacProcedure('read', 'batch')
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const batch = await db
            .select()
            .from(batches)
            .where(and(eq(batches.id, input.id), isNull(batches.deletedAt)))
            .limit(1)

          if (!batch.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Batch not found'
            })
          }

          const ingredients = await db
            .select()
            .from(batchIngredients)
            .where(and(eq(batchIngredients.batchId, input.id), isNull(batchIngredients.deletedAt)))

          const measurements = await db
            .select()
            .from(batchMeasurements)
            .where(and(eq(batchMeasurements.batchId, input.id), isNull(batchMeasurements.deletedAt)))
            .orderBy(desc(batchMeasurements.measurementDate))

          return {
            batch: batch[0],
            ingredients,
            measurements,
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error getting batch:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get batch'
          })
        }
      }),
  }),

  // Packaging management
  packaging: router({
    list: createRbacProcedure('list', 'packaging').query(async () => {
      try {
        const packageList = await db
          .select({
            id: packages.id,
            batchId: packages.batchId,
            packageDate: packages.packageDate,
            volumePackagedL: packages.volumePackagedL,
            bottleSize: packages.bottleSize,
            bottleCount: packages.bottleCount,
            abvAtPackaging: packages.abvAtPackaging,
            notes: packages.notes,
            createdAt: packages.createdAt,
          })
          .from(packages)
          .where(isNull(packages.deletedAt))
          .orderBy(desc(packages.packageDate), desc(packages.createdAt))

        return {
          packages: packageList,
          count: packageList.length,
        }
      } catch (error) {
        console.error('Error listing packages:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list packages'
        })
      }
    }),

    create: createRbacProcedure('create', 'packaging')
      .input(z.object({
        batchId: z.string().uuid('Invalid batch ID'),
        packageDate: z.date().or(z.string().transform(val => new Date(val))),
        volumePackagedL: z.number().positive('Volume packaged must be positive'),
        bottleSize: z.string().min(1, 'Bottle size is required'),
        bottleCount: z.number().int().positive('Bottle count must be positive'),
        abvAtPackaging: z.number().min(0).max(20).optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify batch exists and has enough volume
            const batch = await tx
              .select()
              .from(batches)
              .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
              .limit(1)

            if (!batch.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Batch not found'
              })
            }

            const currentVolumeL = parseFloat(batch[0].currentVolumeL)
            if (input.volumePackagedL > currentVolumeL) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Not enough volume in batch. Available: ${currentVolumeL}L, Requested: ${input.volumePackagedL}L`
              })
            }

            // Calculate bottle volume to verify count
            const expectedBottleVolumeL = input.volumePackagedL / input.bottleCount
            if (expectedBottleVolumeL < 0.1 || expectedBottleVolumeL > 2.0) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Bottle volume calculation seems incorrect (should be between 0.1L and 2.0L per bottle)'
              })
            }

            // Create the package
            const newPackage = await tx
              .insert(packages)
              .values({
                batchId: input.batchId,
                packageDate: input.packageDate,
                volumePackagedL: input.volumePackagedL.toString(),
                bottleSize: input.bottleSize,
                bottleCount: input.bottleCount,
                abvAtPackaging: input.abvAtPackaging?.toString(),
                notes: input.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            const packageId = newPackage[0].id

            // Create initial inventory entry
            const newInventory = await tx
              .insert(inventory)
              .values({
                packageId,
                currentBottleCount: input.bottleCount,
                reservedBottleCount: 0,
                location: input.location,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            // Create initial inventory transaction
            await tx
              .insert(inventoryTransactions)
              .values({
                inventoryId: newInventory[0].id,
                transactionType: 'transfer',
                quantityChange: input.bottleCount,
                transactionDate: input.packageDate,
                reason: 'Initial packaging',
                notes: `Packaged from batch ${batch[0].batchNumber}`,
                createdAt: new Date(),
                updatedAt: new Date(),
              })

            // Update batch current volume
            const remainingVolumeL = currentVolumeL - input.volumePackagedL
            await tx
              .update(batches)
              .set({
                currentVolumeL: remainingVolumeL.toString(),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))

            // If batch is fully packaged, mark as completed
            if (remainingVolumeL <= 0.1) { // Allow for minor rounding
              await tx
                .update(batches)
                .set({
                  status: 'completed',
                  actualCompletionDate: input.packageDate,
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, input.batchId))

              // Free up vessel
              if (batch[0].vesselId) {
                await tx
                  .update(vessels)
                  .set({
                    status: 'available',
                    updatedAt: new Date(),
                  })
                  .where(eq(vessels.id, batch[0].vesselId))
              }
            }

            // Publish audit events
            await publishCreateEvent(
              'packages',
              packageId,
              { packageId, batchId: input.batchId, bottleCount: input.bottleCount, volumeL: input.volumePackagedL },
              ctx.session?.user?.id,
              'Packaging run created via API'
            )

            await publishCreateEvent(
              'inventory',
              newInventory[0].id,
              { inventoryId: newInventory[0].id, packageId, initialCount: input.bottleCount },
              ctx.session?.user?.id,
              'Initial inventory created via API'
            )

            return {
              success: true,
              package: newPackage[0],
              inventory: newInventory[0],
              remainingBatchVolumeL: remainingVolumeL,
              message: `Packaged ${input.bottleCount} bottles (${input.volumePackagedL}L) from batch ${batch[0].batchNumber}`,
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

    getById: createRbacProcedure('read', 'packaging')
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const packageData = await db
            .select()
            .from(packages)
            .where(and(eq(packages.id, input.id), isNull(packages.deletedAt)))
            .limit(1)

          if (!packageData.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Package not found'
            })
          }

          const inventoryData = await db
            .select()
            .from(inventory)
            .where(and(eq(inventory.packageId, input.id), isNull(inventory.deletedAt)))

          const transactions = await db
            .select()
            .from(inventoryTransactions)
            .where(inventoryData.length > 0 ? eq(inventoryTransactions.inventoryId, inventoryData[0].id) : sql`false`)
            .orderBy(desc(inventoryTransactions.transactionDate))

          return {
            package: packageData[0],
            inventory: inventoryData[0] || null,
            transactions,
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error getting package:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get package'
          })
        }
      }),

    updateInventory: createRbacProcedure('update', 'packaging')
      .input(z.object({
        inventoryId: z.string().uuid('Invalid inventory ID'),
        transactionType: z.enum(['purchase', 'transfer', 'adjustment', 'sale', 'waste']),
        quantityChange: z.number().int(),
        reason: z.string().min(1, 'Reason is required'),
        notes: z.string().optional(),
        newLocation: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify inventory exists
            const inventoryRecord = await tx
              .select()
              .from(inventory)
              .where(and(eq(inventory.id, input.inventoryId), isNull(inventory.deletedAt)))
              .limit(1)

            if (!inventoryRecord.length) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Inventory record not found'
              })
            }

            const currentCount = inventoryRecord[0].currentBottleCount
            const newCount = currentCount + input.quantityChange

            if (newCount < 0) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Insufficient inventory. Current: ${currentCount}, Requested change: ${input.quantityChange}`
              })
            }

            // Update inventory
            const updateData: any = {
              currentBottleCount: newCount,
              updatedAt: new Date(),
            }

            if (input.newLocation) {
              updateData.location = input.newLocation
            }

            const updatedInventory = await tx
              .update(inventory)
              .set(updateData)
              .where(eq(inventory.id, input.inventoryId))
              .returning()

            // Create transaction record
            const newTransaction = await tx
              .insert(inventoryTransactions)
              .values({
                inventoryId: input.inventoryId,
                transactionType: input.transactionType,
                quantityChange: input.quantityChange,
                transactionDate: new Date(),
                reason: input.reason,
                notes: input.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            // Publish audit event
            await publishUpdateEvent(
              'inventory',
              input.inventoryId,
              inventoryRecord[0],
              { currentBottleCount: newCount, transactionType: input.transactionType, quantityChange: input.quantityChange },
              ctx.session?.user?.id,
              'Inventory updated via API'
            )

            return {
              success: true,
              inventory: updatedInventory[0],
              transaction: newTransaction[0],
              message: `Inventory updated: ${input.quantityChange > 0 ? '+' : ''}${input.quantityChange} bottles`,
            }
          })
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error updating inventory:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update inventory'
          })
        }
      }),
  }),

  // Apple Varieties management
  appleVariety: router({
    list: createRbacProcedure('list', 'appleVariety').query(async () => {
      try {
        const varietyList = await db
          .select()
          .from(appleVarieties)
          .where(isNull(appleVarieties.deletedAt))
          .orderBy(appleVarieties.name)

        return {
          appleVarieties: varietyList,
          count: varietyList.length,
        }
      } catch (error) {
        console.error('Error listing apple varieties:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list apple varieties'
        })
      }
    }),

    create: createRbacProcedure('create', 'appleVariety')
      .input(z.object({
        name: z.string().min(1, 'Name is required'),
        description: z.string().optional(),
        typicalBrix: z.number().min(0).max(30).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const newVariety = await db
            .insert(appleVarieties)
            .values({
              name: input.name,
              description: input.description,
              typicalBrix: input.typicalBrix?.toString(),
              notes: input.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()

          // Publish audit event
          await publishCreateEvent(
            'apple_varieties',
            newVariety[0].id,
            { varietyId: newVariety[0].id, name: input.name },
            ctx.session?.user?.id,
            'Apple variety created via API'
          )

          return {
            success: true,
            appleVariety: newVariety[0],
            message: `Apple variety "${input.name}" created successfully`,
          }
        } catch (error) {
          console.error('Error creating apple variety:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create apple variety'
          })
        }
      }),
  }),

  // Vessel management
  vessel: router({
    list: createRbacProcedure('list', 'vessel').query(async () => {
      try {
        const vesselList = await db
          .select()
          .from(vessels)
          .where(isNull(vessels.deletedAt))
          .orderBy(vessels.name)

        return {
          vessels: vesselList,
          count: vesselList.length,
        }
      } catch (error) {
        console.error('Error listing vessels:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list vessels'
        })
      }
    }),

    liquidMap: createRbacProcedure('list', 'vessel').query(async () => {
      try {
        // Get vessels with their current batches
        const vesselsWithBatches = await db
          .select({
            vesselId: vessels.id,
            vesselName: vessels.name,
            vesselType: vessels.type,
            vesselCapacityL: vessels.capacityL,
            vesselStatus: vessels.status,
            vesselLocation: vessels.location,
            batchId: batches.id,
            batchNumber: batches.batchNumber,
            batchStatus: batches.status,
            currentVolumeL: batches.currentVolumeL,
          })
          .from(vessels)
          .leftJoin(batches, and(eq(batches.vesselId, vessels.id), isNull(batches.deletedAt)))
          .where(isNull(vessels.deletedAt))
          .orderBy(vessels.name)

        // Get total packaged inventory
        const packagedInventory = await db
          .select({
            totalBottles: sql<number>`sum(${inventory.currentBottleCount})`,
            totalVolumeL: sql<number>`sum(${packages.volumePackagedL}::decimal * ${inventory.currentBottleCount}::decimal / ${packages.bottleCount}::decimal)`,
          })
          .from(inventory)
          .leftJoin(packages, eq(packages.id, inventory.packageId))
          .where(and(isNull(inventory.deletedAt), isNull(packages.deletedAt)))

        // Calculate total liquid in cellar
        const cellarLiquid = vesselsWithBatches.reduce((total, vessel) => {
          if (vessel.currentVolumeL) {
            return total + parseFloat(vessel.currentVolumeL)
          }
          return total
        }, 0)

        return {
          vessels: vesselsWithBatches,
          cellarLiquidL: cellarLiquid,
          packagedInventory: packagedInventory[0] || { totalBottles: 0, totalVolumeL: 0 },
          totalLiquidL: cellarLiquid + (packagedInventory[0]?.totalVolumeL || 0),
        }
      } catch (error) {
        console.error('Error getting liquid map:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get liquid map'
        })
      }
    }),
  }),

  // COGS and Reporting
  reports: router({
    cogsPerBatch: createRbacProcedure('list', 'reports').query(async () => {
      try {
        const batchCostData = await db
          .select({
            batchId: batchCosts.batchId,
            batchNumber: batches.batchNumber,
            batchStatus: batches.status,
            totalAppleCost: batchCosts.totalAppleCost,
            laborCost: batchCosts.laborCost,
            overheadCost: batchCosts.overheadCost,
            packagingCost: batchCosts.packagingCost,
            totalCost: batchCosts.totalCost,
            costPerBottle: batchCosts.costPerBottle,
            costPerL: batchCosts.costPerL,
            calculatedAt: batchCosts.calculatedAt,
            initialVolumeL: batches.initialVolumeL,
            currentVolumeL: batches.currentVolumeL,
          })
          .from(batchCosts)
          .leftJoin(batches, eq(batches.id, batchCosts.batchId))
          .where(and(isNull(batchCosts.deletedAt), isNull(batches.deletedAt)))
          .orderBy(desc(batchCosts.calculatedAt))

        // Get detailed COGS items for each batch
        const cogsItems = await db
          .select({
            batchId: cogsItems.batchId,
            itemType: cogsItems.itemType,
            description: cogsItems.description,
            cost: cogsItems.cost,
            quantity: cogsItems.quantity,
            unit: cogsItems.unit,
            appliedAt: cogsItems.appliedAt,
          })
          .from(cogsItems)
          .where(isNull(cogsItems.deletedAt))
          .orderBy(cogsItems.appliedAt)

        // Group COGS items by batch
        const cogsItemsByBatch = cogsItems.reduce((acc, item) => {
          if (!acc[item.batchId]) {
            acc[item.batchId] = []
          }
          acc[item.batchId].push(item)
          return acc
        }, {} as Record<string, typeof cogsItems>)

        return {
          batches: batchCostData.map(batch => ({
            ...batch,
            cogsItems: cogsItemsByBatch[batch.batchId] || [],
          })),
          count: batchCostData.length,
        }
      } catch (error) {
        console.error('Error getting COGS per batch:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get COGS per batch'
        })
      }
    }),

    cogsBatchDetail: createRbacProcedure('list', 'reports')
      .input(z.object({ batchId: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const batch = await db
            .select()
            .from(batches)
            .where(and(eq(batches.id, input.batchId), isNull(batches.deletedAt)))
            .limit(1)

          if (!batch.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Batch not found'
            })
          }

          const costs = await db
            .select()
            .from(batchCosts)
            .where(and(eq(batchCosts.batchId, input.batchId), isNull(batchCosts.deletedAt)))
            .limit(1)

          const cogsBreakdown = await db
            .select()
            .from(cogsItems)
            .where(and(eq(cogsItems.batchId, input.batchId), isNull(cogsItems.deletedAt)))
            .orderBy(cogsItems.appliedAt)

          return {
            batch: batch[0],
            costs: costs[0] || null,
            cogsBreakdown,
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error
          console.error('Error getting batch COGS detail:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get batch COGS detail'
          })
        }
      }),
  }),

  // Legacy test endpoints for backward compatibility
  vendors: router({
    list: createRbacProcedure('list', 'vendor').query(({ ctx }) => {
      return {
        message: 'Listing vendors (RBAC: list vendor)',
        user: ctx.session?.user?.email,
        role: ctx.session?.user?.role
      }
    }),
    
    delete: createRbacProcedure('delete', 'vendor')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => {
        return {
          message: `Deleting vendor ${input.id} (RBAC: delete vendor)`,
          user: ctx.session?.user?.email,
          role: ctx.session?.user?.role
        }
      })
  }),

  users: router({
    create: createRbacProcedure('create', 'user')
      .input(z.object({ email: z.string().email() }))
      .mutation(({ ctx, input }) => {
        return {
          message: `Creating user ${input.email} (RBAC: create user)`,
          user: ctx.session?.user?.email,
          role: ctx.session?.user?.role
        }
      })
  }),

  // Health check and system monitoring
  health: healthRouter,

  // Audit logging and reporting
  audit: auditRouter
})

export type AppRouter = typeof appRouter