import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  pressRuns,
  pressRunLoads,
  vendors,
  vessels,
  basefruitPurchaseItems,
  basefruitPurchases,
  baseFruitVarieties,
  auditLogs,
  users,
  batches,
  batchCompositions,
  batchMergeHistory,
  batchTransfers,
  batchRackingOperations,
} from "db";
import { eq, and, desc, asc, sql, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  publishCreateEvent,
  publishUpdateEvent,
  publishDeleteEvent,
} from "lib";
import { generateBatchNameFromComposition, type BatchComposition } from "lib";

// Input validation schemas
const createPressRunSchema = z.object({
  notes: z.string().optional(),
});

const addLoadSchema = z.object({
  pressRunId: z.string().uuid("Invalid press run ID"),
  vendorId: z.string().uuid("Invalid vendor ID"),
  purchaseItemId: z.string().uuid("Invalid purchase item ID"),
  fruitVarietyId: z.string().uuid("Invalid fruit variety ID"),
  appleWeightKg: z.number().positive("Apple weight must be positive"),
  originalWeight: z.number().positive("Original weight must be positive"),
  originalWeightUnit: z.enum(["kg", "lb", "bushel"]),
  notes: z.string().optional(),
});

const updateLoadSchema = z.object({
  loadId: z.string().uuid("Invalid load ID"),
  vendorId: z.string().uuid("Invalid vendor ID"),
  purchaseItemId: z.string().uuid("Invalid purchase item ID"),
  fruitVarietyId: z.string().uuid("Invalid fruit variety ID"),
  appleWeightKg: z.number().positive("Apple weight must be positive"),
  originalWeight: z.number().positive("Original weight must be positive"),
  originalWeightUnit: z.enum(["kg", "lb", "bushel"]),
  notes: z.string().optional(),
});

const deleteLoadSchema = z.object({
  loadId: z.string().uuid("Invalid load ID"),
});

const completeSchema = z.object({
  pressRunId: z.string().uuid("Invalid press run ID"),
  completionDate: z.date().or(z.string().transform((val) => new Date(val))),
  assignments: z
    .array(
      z.object({
        toVesselId: z.string().uuid("Invalid vessel ID"),
        volumeL: z.number().positive("Volume must be positive"),
        transferLossL: z.number().min(0).default(0),
        transferLossNotes: z.string().optional(),
      }),
    )
    .min(1, "At least one vessel assignment is required"),
  totalJuiceVolumeL: z
    .number()
    .positive("Total juice volume must be positive")
    .optional(),
  depletedPurchaseItemIds: z.array(z.string().uuid()).optional(),
});

const finishPressRunSchema = z.object({
  pressRunId: z.string().uuid("Invalid press run ID"),
  completionDate: z.date().or(z.string().transform((val) => new Date(val))),
  vesselId: z.string().uuid("Invalid vessel ID"),
  totalJuiceVolumeL: z.number().positive("Juice volume must be positive"),
  laborHours: z.number().min(0).optional(),
  laborCostPerHour: z.number().min(0).optional(),
  notes: z.string().optional(),
  loads: z
    .array(
      z.object({
        loadId: z.string().uuid("Invalid load ID"),
        juiceVolumeL: z.number().positive("Juice volume must be positive"),
        originalVolume: z.number().positive("Original volume must be positive"),
        originalVolumeUnit: z.enum(["L", "gal"]),
      }),
    )
    .min(1, "At least one load with juice volume is required"),
});

// Schema for creating a press run with all inventory selections in one step
const createWithInventorySchema = z.object({
  items: z
    .array(
      z.object({
        purchaseItemId: z.string().uuid("Invalid purchase item ID"),
        fruitVarietyId: z.string().uuid("Invalid fruit variety ID"),
        quantityKg: z.number().positive("Quantity must be positive"),
      }),
    )
    .min(1, "At least one inventory item is required"),
  completionDate: z.date().or(z.string().transform((val) => new Date(val))),
  totalJuiceVolumeL: z.number().positive("Total juice volume must be positive"),
  assignments: z
    .array(
      z.object({
        toVesselId: z.string().uuid("Invalid vessel ID"),
        volumeL: z.number().positive("Volume must be positive"),
        transferLossL: z.number().min(0).default(0),
        transferLossNotes: z.string().optional(),
      }),
    )
    .min(1, "At least one vessel assignment is required"),
  laborHours: z.number().min(0).optional(),
  workerCount: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

const listPressRunsSchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "cancelled"]).optional(),
  vendorId: z.string().uuid().optional(),
  // Legacy pagination (backward compatibility)
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional(),
  // New pagination parameters
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().min(1).max(100).optional(),
  // Sorting
  sortBy: z
    .enum(["created", "started", "updated", "completed"])
    .default("created"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const pressRunRouter = router({
  // Create new press run - admin/operator only
  create: createRbacProcedure("create", "press_run")
    .input(createPressRunSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Create new press run (name will be set when completed)
          const newPressRun = await tx
            .insert(pressRuns)
            .values({
              pressRunName: null, // Name will be set when completing the press run
              status: "in_progress",
              notes: input.notes,
              createdBy: ctx.session?.user?.id,
              updatedBy: ctx.session?.user?.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          const pressRunId = newPressRun[0].id;

          // Publish audit event
          await publishCreateEvent(
            "press_runs",
            pressRunId,
            {
              pressRunId,
              status: "in_progress",
            },
            ctx.session?.user?.id,
            "Press run created via mobile app",
          );

          return {
            success: true,
            pressRun: newPressRun[0],
            message: "Press run created successfully",
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create press run",
        });
      }
    }),

  // Create press run with all inventory items and complete it in one step
  createWithInventory: createRbacProcedure("create", "press_run")
    .input(createWithInventorySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // 1. Validate all purchase items exist and have sufficient inventory
          const purchaseItemIds = input.items.map((item) => item.purchaseItemId);

          const purchaseItems = await tx
            .select({
              id: basefruitPurchaseItems.id,
              purchaseId: basefruitPurchaseItems.purchaseId,
              fruitVarietyId: basefruitPurchaseItems.fruitVarietyId,
              quantityKg: basefruitPurchaseItems.quantityKg,
              isDepleted: basefruitPurchaseItems.isDepleted,
              totalCost: basefruitPurchaseItems.totalCost,
              vendorId: basefruitPurchases.vendorId,
              varietyName: baseFruitVarieties.name,
            })
            .from(basefruitPurchaseItems)
            .innerJoin(
              basefruitPurchases,
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
            )
            .innerJoin(
              baseFruitVarieties,
              eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
            )
            .where(
              and(
                inArray(basefruitPurchaseItems.id, purchaseItemIds),
                isNull(basefruitPurchaseItems.deletedAt),
                eq(basefruitPurchaseItems.isDepleted, false),
              ),
            );

          if (purchaseItems.length !== purchaseItemIds.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "One or more purchase items not found or already depleted",
            });
          }

          // Get consumption data for these items
          const consumptions = await tx
            .select({
              purchaseItemId: pressRunLoads.purchaseItemId,
              consumedKg: sql<number>`COALESCE(SUM(CAST(${pressRunLoads.appleWeightKg} AS NUMERIC)), 0)`,
            })
            .from(pressRunLoads)
            .where(
              and(
                isNull(pressRunLoads.deletedAt),
                inArray(pressRunLoads.purchaseItemId, purchaseItemIds),
              ),
            )
            .groupBy(pressRunLoads.purchaseItemId);

          const consumptionMap = new Map<string, number>();
          consumptions.forEach((c) => {
            consumptionMap.set(c.purchaseItemId, parseFloat(c.consumedKg.toString()));
          });

          // Validate quantities
          for (const inputItem of input.items) {
            const purchaseItem = purchaseItems.find(
              (p) => p.id === inputItem.purchaseItemId,
            );
            if (!purchaseItem) continue;

            const totalKg = parseFloat(purchaseItem.quantityKg || "0");
            const consumedKg = consumptionMap.get(inputItem.purchaseItemId) || 0;
            const availableKg = totalKg - consumedKg;

            if (inputItem.quantityKg > availableKg + 0.001) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Requested quantity (${inputItem.quantityKg.toFixed(1)} kg) exceeds available (${availableKg.toFixed(1)} kg) for ${purchaseItem.varietyName}`,
              });
            }
          }

          // 2. Validate vessels exist and have capacity
          const totalAssignedVolume = input.assignments.reduce(
            (sum, a) => sum + a.volumeL,
            0,
          );

          if (totalAssignedVolume > input.totalJuiceVolumeL + 0.02) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Total assigned volume (${totalAssignedVolume.toFixed(2)}L) exceeds total juice volume (${input.totalJuiceVolumeL.toFixed(2)}L)`,
            });
          }

          for (const assignment of input.assignments) {
            const vessel = await tx
              .select({
                id: vessels.id,
                capacity: vessels.capacity,
                capacityUnit: vessels.capacityUnit,
                name: vessels.name,
              })
              .from(vessels)
              .where(
                and(eq(vessels.id, assignment.toVesselId), isNull(vessels.deletedAt)),
              )
              .limit(1);

            if (!vessel.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Vessel not found: ${assignment.toVesselId}`,
              });
            }

            const existingBatch = await tx
              .select({
                id: batches.id,
                currentVolume: batches.currentVolume,
              })
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, assignment.toVesselId),
                  eq(batches.status, "fermentation"),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            const vesselCapacity = parseFloat(vessel[0].capacity?.toString() || "0");
            const currentVolume =
              existingBatch.length > 0
                ? parseFloat(existingBatch[0].currentVolume?.toString() || "0")
                : 0;
            const remainingCapacity = vesselCapacity - currentVolume;

            if (assignment.volumeL > remainingCapacity + 0.001) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Assignment volume (${assignment.volumeL}L) exceeds remaining capacity (${remainingCapacity.toFixed(1)}L) in vessel ${vessel[0].name}`,
              });
            }
          }

          // 3. Generate press run name
          const completionDateStr = input.completionDate.toISOString().split("T")[0];
          const existingRuns = await tx
            .select({ pressRunName: pressRuns.pressRunName })
            .from(pressRuns)
            .where(
              and(
                sql`${pressRuns.pressRunName} LIKE ${completionDateStr + "-%"}`,
                isNull(pressRuns.deletedAt),
              ),
            )
            .orderBy(desc(pressRuns.pressRunName));

          let sequenceNumber = 1;
          if (existingRuns.length > 0) {
            const pattern = new RegExp(`^${completionDateStr}-(\\d+)$`);
            for (const run of existingRuns) {
              if (run.pressRunName) {
                const match = run.pressRunName.match(pattern);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num >= sequenceNumber) {
                    sequenceNumber = num + 1;
                  }
                }
              }
            }
          }
          const pressRunName = `${completionDateStr}-${String(sequenceNumber).padStart(2, "0")}`;

          // 4. Calculate total apple weight
          const totalAppleWeightKg = input.items.reduce(
            (sum, item) => sum + item.quantityKg,
            0,
          );
          const extractionRate =
            totalAppleWeightKg > 0
              ? input.totalJuiceVolumeL / totalAppleWeightKg
              : 0;

          // 5. Create the press run
          const newPressRun = await tx
            .insert(pressRuns)
            .values({
              pressRunName,
              status: "completed",
              dateCompleted: completionDateStr,
              totalAppleWeightKg: totalAppleWeightKg.toString(),
              totalJuiceVolume: input.totalJuiceVolumeL.toString(),
              totalJuiceVolumeUnit: "L",
              extractionRate: extractionRate.toString(),
              laborHours: input.laborHours?.toString(),
              notes: input.notes,
              createdBy: ctx.session?.user?.id,
              updatedBy: ctx.session?.user?.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          const pressRunId = newPressRun[0].id;

          // 6. Create press run loads for each item
          const depletedPurchaseItemIds: string[] = [];

          for (let i = 0; i < input.items.length; i++) {
            const item = input.items[i];
            const purchaseItem = purchaseItems.find(
              (p) => p.id === item.purchaseItemId,
            )!;

            await tx.insert(pressRunLoads).values({
              pressRunId,
              purchaseItemId: item.purchaseItemId,
              fruitVarietyId: item.fruitVarietyId,
              appleWeightKg: item.quantityKg.toString(),
              originalWeight: item.quantityKg.toString(),
              originalWeightUnit: "kg",
              loadSequence: i + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Check if this item should be marked as depleted
            const totalKg = parseFloat(purchaseItem.quantityKg || "0");
            const consumedKg = consumptionMap.get(item.purchaseItemId) || 0;
            const remainingAfter = totalKg - consumedKg - item.quantityKg;

            if (remainingAfter <= 0.001) {
              depletedPurchaseItemIds.push(item.purchaseItemId);
            }
          }

          // 7. Mark depleted items
          if (depletedPurchaseItemIds.length > 0) {
            await tx
              .update(basefruitPurchaseItems)
              .set({
                isDepleted: true,
                depletedAt: new Date(),
                depletedBy: ctx.session?.user?.id,
                depletedInPressRun: pressRunId,
                updatedAt: new Date(),
              })
              .where(inArray(basefruitPurchaseItems.id, depletedPurchaseItemIds));
          }

          // 8. Create batches for each vessel assignment
          const createdBatchIds: string[] = [];

          for (const assignment of input.assignments) {
            const vessel = await tx
              .select({ id: vessels.id, name: vessels.name })
              .from(vessels)
              .where(eq(vessels.id, assignment.toVesselId))
              .limit(1);

            const vesselInfo = vessel[0];

            // Check for existing batch
            const existingBatch = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolume: batches.currentVolume,
                currentVolumeUnit: batches.currentVolumeUnit,
                transferLossL: batches.transferLossL,
                transferLossNotes: batches.transferLossNotes,
              })
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, assignment.toVesselId),
                  eq(batches.status, "fermentation"),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            const transferLossL = assignment.transferLossL || 0;
            const netVolumeL = assignment.volumeL - transferLossL;

            let batchId: string;

            if (existingBatch.length > 0) {
              // Add to existing batch
              batchId = existingBatch[0].id;
              const currentVolume = parseFloat(
                existingBatch[0].currentVolume?.toString() || "0",
              );
              const newVolume = currentVolume + netVolumeL;

              const updateData: Record<string, unknown> = {
                currentVolume: newVolume.toString(),
                currentVolumeUnit: existingBatch[0].currentVolumeUnit || "L",
                updatedAt: new Date(),
              };

              if (transferLossL > 0) {
                const existingLoss = parseFloat(
                  existingBatch[0].transferLossL?.toString() || "0",
                );
                updateData.transferLossL = (existingLoss + transferLossL).toString();
                if (assignment.transferLossNotes) {
                  const existingNotes = existingBatch[0].transferLossNotes || "";
                  updateData.transferLossNotes = existingNotes
                    ? `${existingNotes}; ${assignment.transferLossNotes}`
                    : assignment.transferLossNotes;
                }
              }

              await tx.update(batches).set(updateData).where(eq(batches.id, batchId));

              // Create merge history
              await tx.insert(batchMergeHistory).values({
                targetBatchId: batchId,
                sourcePressRunId: pressRunId,
                sourceType: "press_run",
                volumeAdded: netVolumeL.toString(),
                volumeAddedUnit: "L",
                targetVolumeBefore: currentVolume.toString(),
                targetVolumeBeforeUnit: "L",
                targetVolumeAfter: newVolume.toString(),
                targetVolumeAfterUnit: "L",
                notes: `Press run juice added to existing batch`,
                mergedAt: input.completionDate,
                mergedBy: ctx.session?.user?.id,
                createdAt: new Date(),
              });
            } else {
              // Create new batch
              const batchCompositionData: BatchComposition[] = input.items.map(
                (item) => {
                  const purchaseItem = purchaseItems.find(
                    (p) => p.id === item.purchaseItemId,
                  )!;
                  const fraction = item.quantityKg / totalAppleWeightKg;
                  return {
                    varietyName: purchaseItem.varietyName,
                    fractionOfBatch: fraction,
                  };
                },
              );

              const baseBatchName = generateBatchNameFromComposition({
                date: input.completionDate,
                vesselCode: vesselInfo.name || vesselInfo.id.substring(0, 6).toUpperCase(),
                batchCompositions: batchCompositionData,
              });

              // Ensure unique batch name
              let batchName = baseBatchName;
              let sequenceSuffix = 2;
              while (true) {
                const existingBatchWithName = await tx
                  .select({ id: batches.id })
                  .from(batches)
                  .where(and(eq(batches.name, batchName), isNull(batches.deletedAt)))
                  .limit(1);

                if (existingBatchWithName.length === 0) break;
                batchName = `${baseBatchName}_${sequenceSuffix}`;
                sequenceSuffix++;
              }

              const newBatch = await tx
                .insert(batches)
                .values({
                  vesselId: assignment.toVesselId,
                  name: batchName,
                  batchNumber: batchName,
                  initialVolume: netVolumeL.toString(),
                  initialVolumeUnit: "L",
                  currentVolume: netVolumeL.toString(),
                  currentVolumeUnit: "L",
                  status: "fermentation",
                  startDate: input.completionDate,
                  originPressRunId: pressRunId,
                  transferLossL: transferLossL > 0 ? transferLossL.toString() : null,
                  transferLossNotes: assignment.transferLossNotes || null,
                })
                .returning({ id: batches.id });

              batchId = newBatch[0].id;

              // Create batch compositions
              for (const item of input.items) {
                const purchaseItem = purchaseItems.find(
                  (p) => p.id === item.purchaseItemId,
                )!;
                const fraction = item.quantityKg / totalAppleWeightKg;
                const juiceVolumeL = assignment.volumeL * fraction;
                const materialCost = parseFloat(purchaseItem.totalCost || "0") * fraction;

                await tx.insert(batchCompositions).values({
                  batchId,
                  purchaseItemId: item.purchaseItemId,
                  vendorId: purchaseItem.vendorId,
                  varietyId: item.fruitVarietyId,
                  fractionOfBatch: fraction.toString(),
                  inputWeightKg: item.quantityKg.toString(),
                  juiceVolume: juiceVolumeL.toString(),
                  juiceVolumeUnit: "L",
                  materialCost: materialCost.toString(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }

            createdBatchIds.push(batchId);

            // Update vessel status
            await tx
              .update(vessels)
              .set({ status: "available", updatedAt: new Date() })
              .where(eq(vessels.id, assignment.toVesselId));
          }

          // Publish audit event
          await publishCreateEvent(
            "press_runs",
            pressRunId,
            {
              pressRunId,
              pressRunName,
              status: "completed",
              totalAppleWeightKg,
              totalJuiceVolumeL: input.totalJuiceVolumeL,
              itemCount: input.items.length,
              vesselCount: input.assignments.length,
            },
            ctx.session?.user?.id,
            "Press run created and completed via Build Press Run UI",
          );

          return {
            success: true,
            pressRunId,
            pressRunName,
            batchIds: createdBatchIds,
            message: "Press run created and completed successfully",
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating press run with inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create press run",
        });
      }
    }),

  // Add fruit load to press run - admin/operator only
  addLoad: createRbacProcedure("update", "press_run")
    .input(addLoadSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify press run exists and is editable - lock the row to prevent concurrent modifications
          const pressRun = await tx
            .select()
            .from(pressRuns)
            .where(
              and(
                eq(pressRuns.id, input.pressRunId),
                isNull(pressRuns.deletedAt),
              ),
            )
            .limit(1)
            .for("update");

          if (!pressRun.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Press run not found",
            });
          }

          if (
            pressRun[0].status === "completed" ||
            pressRun[0].status === "cancelled"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot add loads to completed or cancelled press run",
            });
          }

          // Verify purchase item exists, is not depleted, and has enough quantity
          const purchaseItem = await tx
            .select()
            .from(basefruitPurchaseItems)
            .where(
              and(
                eq(basefruitPurchaseItems.id, input.purchaseItemId),
                isNull(basefruitPurchaseItems.deletedAt),
                eq(basefruitPurchaseItems.isDepleted, false),
              ),
            )
            .limit(1);

          if (!purchaseItem.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Purchase item not found",
            });
          }

          // Verify apple variety exists
          const appleVariety = await tx
            .select()
            .from(baseFruitVarieties)
            .where(eq(baseFruitVarieties.id, input.fruitVarietyId))
            .limit(1);

          if (!appleVariety.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Fruit variety not found",
            });
          }

          // Note: Purchase weights are estimates only - no validation against actual pressing weights

          // Get next load sequence number (press run is already locked above, preventing race conditions)
          const maxSequenceResult = await tx
            .select({
              maxSequence: sql<number>`COALESCE(MAX(${pressRunLoads.loadSequence}), 0)`,
            })
            .from(pressRunLoads)
            .where(
              and(
                eq(pressRunLoads.pressRunId, input.pressRunId),
                isNull(pressRunLoads.deletedAt),
              ),
            );

          const nextSequence = (maxSequenceResult[0]?.maxSequence || 0) + 1;

          // Create the load
          const newLoad = await tx
            .insert(pressRunLoads)
            .values({
              pressRunId: input.pressRunId,
              purchaseItemId: input.purchaseItemId,
              fruitVarietyId: input.fruitVarietyId,
              loadSequence: nextSequence,
              appleWeightKg: input.appleWeightKg.toString(),
              originalWeight: input.originalWeight.toString(),
              originalWeightUnit: input.originalWeightUnit,
              notes: input.notes,
              createdBy: ctx.session?.user?.id,
              updatedBy: ctx.session?.user?.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Update press run status if still in draft
          if (pressRun[0].status === "draft") {
            await tx
              .update(pressRuns)
              .set({
                status: "in_progress",
                updatedBy: ctx.session?.user?.id,
                updatedAt: new Date(),
              })
              .where(eq(pressRuns.id, input.pressRunId));
          }

          // Update press run totals
          const allLoads = await tx
            .select({ appleWeightKg: pressRunLoads.appleWeightKg })
            .from(pressRunLoads)
            .where(
              and(
                eq(pressRunLoads.pressRunId, input.pressRunId),
                isNull(pressRunLoads.deletedAt),
              ),
            );

          const totalAppleWeightKg = allLoads.reduce(
            (sum, load) => sum + parseFloat(load.appleWeightKg || "0"),
            0,
          );

          await tx
            .update(pressRuns)
            .set({
              totalAppleWeightKg: totalAppleWeightKg.toString(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(pressRuns.id, input.pressRunId));

          // Publish audit events
          await publishCreateEvent(
            "press_run_loads",
            newLoad[0].id,
            {
              loadId: newLoad[0].id,
              pressRunId: input.pressRunId,
              appleVarietyName: appleVariety[0].name,
              weightKg: input.appleWeightKg,
              sequence: nextSequence,
            },
            ctx.session?.user?.id,
            "Fruit load added to press run",
          );

          return {
            success: true,
            load: newLoad[0],
            totalAppleWeightKg,
            message: `Load #${nextSequence} added: ${input.originalWeight} ${input.originalWeightUnit} ${appleVariety[0].name}`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error adding load to press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add load to press run",
        });
      }
    }),

  // Update existing load - admin/operator only
  updateLoad: createRbacProcedure("update", "press_run")
    .input(updateLoadSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify load exists and get press run info
          const existingLoad = await tx
            .select({
              loadId: pressRunLoads.id,
              pressRunId: pressRunLoads.pressRunId,
              pressRunStatus: pressRuns.status,
            })
            .from(pressRunLoads)
            .leftJoin(
              pressRuns,
              eq(pressRunLoads.pressRunId, pressRuns.id),
            )
            .where(
              and(
                eq(pressRunLoads.id, input.loadId),
                isNull(pressRunLoads.deletedAt),
              ),
            )
            .limit(1);

          if (!existingLoad.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Load not found",
            });
          }

          if (
            existingLoad[0].pressRunStatus === "completed" ||
            existingLoad[0].pressRunStatus === "cancelled"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot update loads in completed or cancelled press run",
            });
          }

          // Verify purchase item exists, is not depleted, and has enough quantity
          const purchaseItem = await tx
            .select()
            .from(basefruitPurchaseItems)
            .where(
              and(
                eq(basefruitPurchaseItems.id, input.purchaseItemId),
                isNull(basefruitPurchaseItems.deletedAt),
                eq(basefruitPurchaseItems.isDepleted, false),
              ),
            )
            .limit(1);

          if (!purchaseItem.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Purchase item not found",
            });
          }

          // Verify apple variety exists
          const appleVariety = await tx
            .select()
            .from(baseFruitVarieties)
            .where(eq(baseFruitVarieties.id, input.fruitVarietyId))
            .limit(1);

          if (!appleVariety.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Fruit variety not found",
            });
          }

          // Update the load
          const updatedLoad = await tx
            .update(pressRunLoads)
            .set({
              purchaseItemId: input.purchaseItemId,
              fruitVarietyId: input.fruitVarietyId,
              appleWeightKg: input.appleWeightKg.toString(),
              originalWeight: input.originalWeight.toString(),
              originalWeightUnit: input.originalWeightUnit,
              notes: input.notes,
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(pressRunLoads.id, input.loadId))
            .returning();

          // Update press run totals
          const allLoads = await tx
            .select({ appleWeightKg: pressRunLoads.appleWeightKg })
            .from(pressRunLoads)
            .where(
              and(
                eq(
                  pressRunLoads.pressRunId,
                  existingLoad[0].pressRunId,
                ),
                isNull(pressRunLoads.deletedAt),
              ),
            );

          const totalAppleWeightKg = allLoads.reduce(
            (sum, load) => sum + parseFloat(load.appleWeightKg || "0"),
            0,
          );

          await tx
            .update(pressRuns)
            .set({
              totalAppleWeightKg: totalAppleWeightKg.toString(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(pressRuns.id, existingLoad[0].pressRunId));

          // Publish audit event
          await publishUpdateEvent(
            "press_run_loads",
            input.loadId,
            existingLoad[0],
            {
              appleVarietyName: appleVariety[0].name,
              weightKg: input.appleWeightKg,
            },
            ctx.session?.user?.id,
            "Load updated",
          );

          return {
            success: true,
            load: updatedLoad[0],
            totalAppleWeightKg,
            message: `Load updated: ${input.originalWeight} ${input.originalWeightUnit} ${appleVariety[0].name}`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating load:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update load",
        });
      }
    }),

  // Finish press run and assign to vessel - admin/operator only
  finish: createRbacProcedure("update", "press_run")
    .input(finishPressRunSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify press run exists and is in progress
          const pressRun = await tx
            .select()
            .from(pressRuns)
            .where(
              and(
                eq(pressRuns.id, input.pressRunId),
                isNull(pressRuns.deletedAt),
              ),
            )
            .limit(1);

          if (!pressRun.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Press run not found",
            });
          }

          if (pressRun[0].status !== "in_progress") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Press run is not in progress",
            });
          }

          // Verify vessel exists and is available
          const vessel = await tx
            .select()
            .from(vessels)
            .where(
              and(eq(vessels.id, input.vesselId), isNull(vessels.deletedAt)),
            )
            .limit(1);

          if (!vessel.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vessel not found",
            });
          }

          if (vessel[0].status !== "available") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Vessel is not available",
            });
          }

          // Check vessel capacity
          const vesselCapacityL = parseFloat(vessel[0].capacity?.toString() || "0");
          if (input.totalJuiceVolumeL > vesselCapacityL) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Total juice volume (${input.totalJuiceVolumeL}L) exceeds vessel capacity (${vesselCapacityL}${vessel[0].capacityUnit || 'L'})`,
            });
          }

          // Update loads with juice volumes and measurements
          const updatedLoads = [];
          for (const load of input.loads) {
            const updatedLoad = await tx
              .update(pressRunLoads)
              .set({
                juiceVolume: load.juiceVolumeL.toString(),
                juiceVolumeUnit: "L",
                originalVolume: load.originalVolume.toString(),
                originalVolumeUnit: load.originalVolumeUnit,
                updatedBy: ctx.session?.user?.id,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(pressRunLoads.id, load.loadId),
                  eq(pressRunLoads.pressRunId, input.pressRunId),
                ),
              )
              .returning();

            if (updatedLoad.length) {
              updatedLoads.push(updatedLoad[0]);
            }
          }

          // Calculate totals and extraction rate
          const totalAppleWeightKg = parseFloat(
            pressRun[0].totalAppleWeightKg || "0",
          );
          const extractionRate =
            totalAppleWeightKg > 0
              ? input.totalJuiceVolumeL / totalAppleWeightKg
              : 0;

          // Calculate labor cost if provided
          let totalLaborCost: number | null = null;
          if (input.laborHours && input.laborCostPerHour) {
            totalLaborCost = input.laborHours * input.laborCostPerHour;
          }

          // Generate press run name based on completion date (YYYY-MM-DD-##)
          const completionDateStr = input.completionDate
            .toISOString()
            .split("T")[0];

          // Find existing press runs on the same date to determine sequence number
          const existingRuns = await tx
            .select({ pressRunName: pressRuns.pressRunName })
            .from(pressRuns)
            .where(
              and(
                sql`${pressRuns.pressRunName} LIKE ${completionDateStr + "-%"}`,
                isNull(pressRuns.deletedAt),
              ),
            )
            .orderBy(desc(pressRuns.pressRunName));

          // Extract the highest sequence number for this date
          let sequenceNumber = 1;
          if (existingRuns.length > 0) {
            const pattern = new RegExp(`^${completionDateStr}-(\\d+)$`);
            for (const run of existingRuns) {
              if (run.pressRunName) {
                const match = run.pressRunName.match(pattern);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num >= sequenceNumber) {
                    sequenceNumber = num + 1;
                  }
                }
              }
            }
          }

          const pressRunName = `${completionDateStr}-${String(sequenceNumber).padStart(2, "0")}`;

          // Complete the press run
          const completedPressRun = await tx
            .update(pressRuns)
            .set({
              pressRunName,
              vesselId: input.vesselId,
              status: "completed",
              dateCompleted: input.completionDate.toISOString().split("T")[0],
              totalJuiceVolume: input.totalJuiceVolumeL.toString(),
              totalJuiceVolumeUnit: "L",
              extractionRate: extractionRate.toString(),
              laborHours: input.laborHours?.toString(),
              laborCostPerHour: input.laborCostPerHour?.toString(),
              totalLaborCost: totalLaborCost?.toString(),
              notes: input.notes || pressRun[0].notes,
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(pressRuns.id, input.pressRunId))
            .returning();

          // Update vessel status
          await tx
            .update(vessels)
            .set({
              status: "available",
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, input.vesselId));

          // Create a batch for this press run automatically
          // Get all loads with vendor and variety information for batch composition
          const loads = await tx
            .select({
              id: pressRunLoads.id,
              purchaseItemId: pressRunLoads.purchaseItemId,
              vendorId: basefruitPurchases.vendorId,
              vendorName: vendors.name,
              fruitVarietyId: pressRunLoads.fruitVarietyId,
              varietyName: baseFruitVarieties.name,
              appleWeightKg: pressRunLoads.appleWeightKg,
              juiceVolume: pressRunLoads.juiceVolume,
              juiceVolumeUnit: pressRunLoads.juiceVolumeUnit,
              totalCost: basefruitPurchaseItems.totalCost,
            })
            .from(pressRunLoads)
            .innerJoin(
              basefruitPurchaseItems,
              eq(pressRunLoads.purchaseItemId, basefruitPurchaseItems.id),
            )
            .innerJoin(
              basefruitPurchases,
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
            )
            .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .innerJoin(
              baseFruitVarieties,
              eq(pressRunLoads.fruitVarietyId, baseFruitVarieties.id),
            )
            .where(
              and(
                eq(pressRunLoads.pressRunId, input.pressRunId),
                isNull(pressRunLoads.deletedAt),
              ),
            );

          // Calculate allocation fractions based on weight and total juice volume
          const totalWeight = loads.reduce(
            (sum, load) => sum + parseFloat(load.appleWeightKg || "0"),
            0,
          );
          const totalJuiceVolumeL = loads.reduce(
            (sum, load) => sum + parseFloat(load.juiceVolume || "0"),
            0,
          );

          // Generate batch composition for naming
          const batchCompositionData: BatchComposition[] = loads.map((load) => {
            const fraction =
              parseFloat(load.appleWeightKg || "0") / totalWeight;
            return {
              varietyName: load.varietyName,
              fractionOfBatch: fraction,
            };
          });

          // Generate batch name using press run completion date
          const batchName = generateBatchNameFromComposition({
            date: input.completionDate,
            vesselCode:
              vessel[0].name || input.vesselId.substring(0, 6).toUpperCase(),
            batchCompositions: batchCompositionData,
          });

          // Create batch record with all required fields
          const newBatch = await tx
            .insert(batches)
            .values({
              vesselId: input.vesselId,
              name: batchName,
              batchNumber: batchName, // Using batch name as batch number for now
              initialVolume: totalJuiceVolumeL.toString(),
              initialVolumeUnit: "L",
              currentVolume: totalJuiceVolumeL.toString(),
              currentVolumeUnit: "L",
              status: "fermentation",
              startDate: input.completionDate,
              originPressRunId: input.pressRunId,
            })
            .returning({ id: batches.id });

          const batchId = newBatch[0].id;

          // Update vessel status to fermenting when batch is created
          await tx
            .update(vessels)
            .set({
              status: "available",
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, input.vesselId));

          // Publish vessel status update audit event
          await publishUpdateEvent(
            "vessels",
            input.vesselId,
            { status: "available" },
            { status: "available" },
            ctx.session?.user?.id,
            "Vessel status changed to fermenting when batch was created from press run completion",
          );

          // Create batch compositions
          for (const load of loads) {
            const fraction =
              parseFloat(load.appleWeightKg || "0") / totalWeight;
            const juiceVolumeL = input.totalJuiceVolumeL * fraction;
            const materialCost = parseFloat(load.totalCost || "0") * fraction;

            await tx.insert(batchCompositions).values({
              batchId,
              purchaseItemId: load.purchaseItemId,
              vendorId: load.vendorId,
              varietyId: load.fruitVarietyId,
              inputWeightKg: load.appleWeightKg,
              juiceVolume: juiceVolumeL.toString(),
              juiceVolumeUnit: "L" as const,
              fractionOfBatch: fraction.toString(),
              materialCost: materialCost.toString(),
            });
          }

          // Publish audit events
          await publishUpdateEvent(
            "press_runs",
            input.pressRunId,
            pressRun[0],
            {
              status: "completed",
              vesselId: input.vesselId,
              totalJuiceVolumeL: input.totalJuiceVolumeL,
              extractionRate: extractionRate,
              dateCompleted: input.completionDate.toISOString().split("T")[0],
            },
            ctx.session?.user?.id,
            "Press run completed and juice assigned to vessel",
          );

          return {
            success: true,
            pressRun: completedPressRun[0],
            loads: updatedLoads,
            batchId,
            batchName,
            extractionRate: Math.round(extractionRate * 10000) / 100, // Convert to percentage with 2 decimals
            message: `Press run completed: ${input.totalJuiceVolumeL}L juice (${Math.round(extractionRate * 100)}% extraction) assigned to ${vessel[0].name}. Batch ${batchName} created.`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error finishing press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to finish press run",
        });
      }
    }),

  // Complete press run and create batches - admin/operator only
  complete: createRbacProcedure("update", "press_run")
    .input(completeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify press run exists
          const pressRun = await tx
            .select()
            .from(pressRuns)
            .where(
              and(
                eq(pressRuns.id, input.pressRunId),
                isNull(pressRuns.deletedAt),
              ),
            )
            .limit(1);

          if (!pressRun.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Press run not found",
            });
          }

          // Allow both in_progress and completed status
          // If in_progress, we'll complete it first
          if (
            pressRun[0].status !== "in_progress" &&
            pressRun[0].status !== "completed"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Press run must be in progress or completed",
            });
          }

          // Check if batches already exist for this press run
          const existingBatches = await tx
            .select({ id: batches.id })
            .from(batches)
            .where(eq(batches.originPressRunId, input.pressRunId))
            .limit(1);

          if (existingBatches.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Batches already created for this press run",
            });
          }

          // Calculate total juice volume (needed for validation and completion)
          // Get total juice volume from loads
          const juiceVolumeLoads = await tx
            .select({ juiceVolume: pressRunLoads.juiceVolume })
            .from(pressRunLoads)
            .where(
              and(
                eq(pressRunLoads.pressRunId, input.pressRunId),
                isNull(pressRunLoads.deletedAt),
              ),
            );

          const totalJuiceVolume =
            input.totalJuiceVolumeL ||
            juiceVolumeLoads.reduce(
              (sum, load) => sum + parseFloat(load.juiceVolume || "0"),
              0,
            );

          // If press run is still in_progress, complete it first
          if (pressRun[0].status === "in_progress") {

            // Generate press run name based on user-selected completion date (YYYY-MM-DD-##)
            const completionDateStr = input.completionDate.toISOString().split("T")[0];

            // Find existing press runs on the same date to determine sequence number
            const existingRuns = await tx
              .select({ pressRunName: pressRuns.pressRunName })
              .from(pressRuns)
              .where(
                and(
                  sql`${pressRuns.pressRunName} LIKE ${completionDateStr + "-%"}`,
                  isNull(pressRuns.deletedAt),
                ),
              )
              .orderBy(desc(pressRuns.pressRunName));

            let sequenceNumber = 1;
            if (existingRuns.length > 0) {
              const pattern = new RegExp(`^${completionDateStr}-(\\d+)$`);
              for (const run of existingRuns) {
                if (run.pressRunName) {
                  const match = run.pressRunName.match(pattern);
                  if (match) {
                    const num = parseInt(match[1], 10);
                    if (num >= sequenceNumber) {
                      sequenceNumber = num + 1;
                    }
                  }
                }
              }
            }

            const pressRunName = `${completionDateStr}-${String(sequenceNumber).padStart(2, "0")}`;

            // Calculate extraction rate (L of juice per kg of apples)
            const totalAppleWeightKg = parseFloat(
              pressRun[0].totalAppleWeightKg || "0",
            );
            const extractionRate =
              totalAppleWeightKg > 0
                ? totalJuiceVolume / totalAppleWeightKg
                : 0;

            // Complete the press run
            await tx
              .update(pressRuns)
              .set({
                pressRunName,
                status: "completed",
                dateCompleted: input.completionDate.toISOString().split("T")[0], // Use user-selected completion date
                totalJuiceVolume: totalJuiceVolume.toString(),
                totalJuiceVolumeUnit: "L",
                extractionRate: extractionRate.toString(),
                updatedAt: new Date(),
              })
              .where(eq(pressRuns.id, input.pressRunId));
          }

          // Validate total assigned volume doesn't exceed available juice
          const totalAssignedVolume = input.assignments.reduce(
            (sum, a) => sum + a.volumeL,
            0,
          );

          // Re-fetch press run to get updated juice volume and completion date if it was just completed
          const updatedPressRun = await tx
            .select({
              totalJuiceVolume: pressRuns.totalJuiceVolume,
              totalJuiceVolumeUnit: pressRuns.totalJuiceVolumeUnit,
              dateCompleted: pressRuns.dateCompleted,
            })
            .from(pressRuns)
            .where(eq(pressRuns.id, input.pressRunId))
            .limit(1);

          const availableVolume =
            input.totalJuiceVolumeL ||
            parseFloat(updatedPressRun[0].totalJuiceVolume || "0");

          // Allow 0.02L (20mL) tolerance for floating-point precision errors from unit conversions
          const VOLUME_TOLERANCE = 0.02;
          if (totalAssignedVolume > availableVolume + VOLUME_TOLERANCE) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Total assigned volume (${totalAssignedVolume.toFixed(2)}L) exceeds available juice (${availableVolume.toFixed(2)}L)`,
            });
          }

          // Validate vessels exist and have capacity
          for (const assignment of input.assignments) {
            const vessel = await tx
              .select({
                id: vessels.id,
                capacity: vessels.capacity,
                capacityUnit: vessels.capacityUnit,
                name: vessels.name,
              })
              .from(vessels)
              .where(
                and(
                  eq(vessels.id, assignment.toVesselId),
                  isNull(vessels.deletedAt),
                ),
              )
              .limit(1);

            if (!vessel.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Vessel not found: ${assignment.toVesselId}`,
              });
            }

            // Check for existing active batch in vessel
            const existingBatch = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolume: batches.currentVolume,
                currentVolumeUnit: batches.currentVolumeUnit,
              })
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, assignment.toVesselId),
                  eq(batches.status, "fermentation"),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            const vesselCapacity = parseFloat(vessel[0].capacity?.toString() || "0");
            const currentVolume =
              existingBatch.length > 0
                ? parseFloat(existingBatch[0].currentVolume?.toString() || "0")
                : 0;
            const remainingCapacity = vesselCapacity - currentVolume;

            if (assignment.volumeL > remainingCapacity + 0.001) {
              if (existingBatch.length > 0) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Assignment volume (${assignment.volumeL}L) exceeds remaining capacity (${remainingCapacity.toFixed(1)}L) in vessel ${vessel[0].name}. Current batch: ${existingBatch[0].name} (${currentVolume}${existingBatch[0].currentVolumeUnit || 'L'}/${vesselCapacity}${vessel[0].capacityUnit || 'L'})`,
                });
              } else {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Assignment volume (${assignment.volumeL}L) exceeds vessel capacity (${vesselCapacity}${vessel[0].capacityUnit || 'L'}) for vessel ${vessel[0].name}`,
                });
              }
            }
          }

          // Handle purchase item depletion if specified
          if (
            input.depletedPurchaseItemIds &&
            input.depletedPurchaseItemIds.length > 0
          ) {
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
                  inArray(
                    basefruitPurchaseItems.id,
                    input.depletedPurchaseItemIds,
                  ),
                  eq(basefruitPurchaseItems.isDepleted, false),
                ),
              );

            // Publish audit events for each depleted item
            for (const purchaseItemId of input.depletedPurchaseItemIds) {
              await publishUpdateEvent(
                "basefruit_purchase_items",
                purchaseItemId,
                { isDepleted: false },
                {
                  isDepleted: true,
                  depletedAt: new Date(),
                  depletedInPressRun: input.pressRunId,
                },
                ctx.session?.user?.id,
                "Purchase item marked as depleted during press run completion",
              );
            }
          }

          // Load press run loads for composition calculation
          const loads = await tx
            .select({
              id: pressRunLoads.id,
              purchaseItemId: pressRunLoads.purchaseItemId,
              fruitVarietyId: pressRunLoads.fruitVarietyId,
              varietyName: baseFruitVarieties.name,
              appleWeightKg: pressRunLoads.appleWeightKg,
              vendorId: vendors.id,
              totalCost: basefruitPurchaseItems.totalCost,
            })
            .from(pressRunLoads)
            .innerJoin(
              basefruitPurchaseItems,
              eq(pressRunLoads.purchaseItemId, basefruitPurchaseItems.id),
            )
            .innerJoin(
              basefruitPurchases,
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
            )
            .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .innerJoin(
              baseFruitVarieties,
              eq(pressRunLoads.fruitVarietyId, baseFruitVarieties.id),
            )
            .where(
              and(
                eq(pressRunLoads.pressRunId, input.pressRunId),
                isNull(pressRunLoads.deletedAt),
              ),
            );

          if (loads.length === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No loads found for press run",
            });
          }

          // Calculate allocation fractions based on weight
          const totalWeight = loads.reduce(
            (sum, load) => sum + parseFloat(load.appleWeightKg || "0"),
            0,
          );
          if (totalWeight <= 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Total apple weight must be greater than zero",
            });
          }

          const createdBatchIds: string[] = [];

          // Create or update batches for each assignment
          for (const assignment of input.assignments) {
            // Get vessel info for batch naming
            const vessel = await tx
              .select({ id: vessels.id, name: vessels.name })
              .from(vessels)
              .where(eq(vessels.id, assignment.toVesselId))
              .limit(1);

            const vesselInfo = vessel[0];

            // Check for existing active batch in vessel
            const existingBatch = await tx
              .select({
                id: batches.id,
                name: batches.name,
                currentVolume: batches.currentVolume,
                currentVolumeUnit: batches.currentVolumeUnit,
                initialVolume: batches.initialVolume,
                initialVolumeUnit: batches.initialVolumeUnit,
                transferLossL: batches.transferLossL,
                transferLossNotes: batches.transferLossNotes,
              })
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, assignment.toVesselId),
                  eq(batches.status, "fermentation"),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            let batchId: string;
            let batchName: string;

            if (existingBatch.length > 0) {
              // Add to existing batch
              batchId = existingBatch[0].id;
              batchName = existingBatch[0].name;
              const currentVolume = parseFloat(
                existingBatch[0].currentVolume?.toString() || "0",
              );

              // Calculate net volume (gross volume minus transfer loss)
              const transferLossL = assignment.transferLossL || 0;
              const netVolumeL = assignment.volumeL - transferLossL;
              const newVolume = currentVolume + netVolumeL;

              // Update existing batch volume (and add transfer loss info if this is the first loss recorded)
              const updateData: Record<string, unknown> = {
                currentVolume: newVolume.toString(),
                currentVolumeUnit: existingBatch[0].currentVolumeUnit || "L",
                updatedAt: new Date(),
              };

              // If there's a transfer loss and batch doesn't already have one, record it
              if (transferLossL > 0) {
                const existingLoss = parseFloat(existingBatch[0].transferLossL?.toString() || "0");
                updateData.transferLossL = (existingLoss + transferLossL).toString();
                if (assignment.transferLossNotes) {
                  const existingNotes = existingBatch[0].transferLossNotes || "";
                  updateData.transferLossNotes = existingNotes
                    ? `${existingNotes}; ${assignment.transferLossNotes}`
                    : assignment.transferLossNotes;
                }
              }

              await tx
                .update(batches)
                .set(updateData)
                .where(eq(batches.id, batchId));

              // Create merge history entry - record net volume added
              const mergeNotes = transferLossL > 0
                ? `Press run juice added to existing batch (${transferLossL}L transfer loss${assignment.transferLossNotes ? `: ${assignment.transferLossNotes}` : ''})`
                : `Press run juice added to existing batch`;

              await tx.insert(batchMergeHistory).values({
                targetBatchId: batchId,
                sourcePressRunId: input.pressRunId,
                sourceType: "press_run",
                volumeAdded: netVolumeL.toString(),
                volumeAddedUnit: "L",
                targetVolumeBefore: currentVolume.toString(),
                targetVolumeBeforeUnit: "L",
                targetVolumeAfter: newVolume.toString(),
                targetVolumeAfterUnit: "L",
                notes: mergeNotes,
                mergedAt: input.completionDate,
                mergedBy: ctx.session?.user?.id,
                createdAt: new Date(),
              });

              console.log(
                `Added ${assignment.volumeL}L to existing batch ${existingBatch[0].name}, new volume: ${newVolume}L`,
              );
            } else {
              // Create new batch
              // Generate batch composition for naming
              const batchCompositionData: BatchComposition[] = loads.map(
                (load) => {
                  const fraction =
                    parseFloat(load.appleWeightKg || "0") / totalWeight;
                  return {
                    varietyName: load.varietyName,
                    fractionOfBatch: fraction,
                  };
                },
              );

              // Use press run completion date for batch start date and naming
              const pressRunCompletionDate = updatedPressRun[0].dateCompleted
                ? new Date(updatedPressRun[0].dateCompleted)
                : input.completionDate;

              // Generate batch name using completion date
              const baseBatchName = generateBatchNameFromComposition({
                date: pressRunCompletionDate,
                vesselCode:
                  vesselInfo.name ||
                  vesselInfo.id.substring(0, 6).toUpperCase(),
                batchCompositions: batchCompositionData,
              });

              // Ensure batch name is unique by checking for existing batches and adding sequence suffix
              batchName = baseBatchName;
              let sequenceSuffix = 2;
              while (true) {
                const existingBatchWithName = await tx
                  .select({ id: batches.id })
                  .from(batches)
                  .where(
                    and(
                      eq(batches.name, batchName),
                      isNull(batches.deletedAt),
                    ),
                  )
                  .limit(1);

                if (existingBatchWithName.length === 0) {
                  // Name is unique, we can use it
                  break;
                }

                // Name exists, add/increment sequence suffix
                batchName = `${baseBatchName}_${sequenceSuffix}`;
                sequenceSuffix++;
              }

              // Calculate net volume (gross volume minus transfer loss)
              const transferLossL = assignment.transferLossL || 0;
              const netVolumeL = assignment.volumeL - transferLossL;

              // Create batch record
              const newBatch = await tx
                .insert(batches)
                .values({
                  vesselId: assignment.toVesselId,
                  name: batchName,
                  batchNumber: batchName, // Add batch_number for database compatibility
                  initialVolume: netVolumeL.toString(),
                  initialVolumeUnit: "L",
                  currentVolume: netVolumeL.toString(),
                  currentVolumeUnit: "L",
                  status: "fermentation",
                  startDate: pressRunCompletionDate,
                  originPressRunId: input.pressRunId,
                  transferLossL: transferLossL > 0 ? transferLossL.toString() : null,
                  transferLossNotes: assignment.transferLossNotes || null,
                })
                .returning({ id: batches.id });

              batchId = newBatch[0].id;
            }

            createdBatchIds.push(batchId);

            // Update vessel status to fermenting when batch is created
            await tx
              .update(vessels)
              .set({
                status: "available",
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, assignment.toVesselId));

            // Publish vessel status update audit event
            await publishUpdateEvent(
              "vessels",
              assignment.toVesselId,
              { status: "available" },
              { status: "available" },
              ctx.session?.user?.id,
              "Vessel status changed to fermenting when batch was created from press run completion",
            );

            // Handle batch compositions - either create new or merge with existing
            let totalFraction = 0;
            let totalJuiceVolume = 0;
            let totalMaterialCost = 0;

            // Group loads by purchaseItemId to consolidate multiple loads from same purchase
            const consolidatedLoads = loads.reduce(
              (acc, load) => {
                const key = load.purchaseItemId;
                if (!acc[key]) {
                  acc[key] = {
                    purchaseItemId: load.purchaseItemId,
                    vendorId: load.vendorId,
                    varietyId: load.fruitVarietyId,
                    totalAppleWeightKg: 0,
                    totalCost: 0,
                    brixMeasurements: [] as (string | null)[],
                  };
                }
                acc[key].totalAppleWeightKg += parseFloat(
                  load.appleWeightKg || "0",
                );
                acc[key].totalCost += parseFloat(load.totalCost || "0");
                return acc;
              },
              {} as Record<string, any>,
            );

            if (existingBatch.length > 0) {
              // For existing batch, we need to merge compositions
              const currentVolume = parseFloat(
                existingBatch[0].currentVolume?.toString() || "0",
              );
              const newTotalVolume = currentVolume + assignment.volumeL;

              // Get existing compositions
              const existingCompositions = await tx
                .select()
                .from(batchCompositions)
                .where(
                  and(
                    eq(batchCompositions.batchId, batchId),
                    isNull(batchCompositions.deletedAt),
                  ),
                );

              // Update existing compositions with new fractions
              for (const existingComp of existingCompositions) {
                const oldVolumeContribution = parseFloat(
                  existingComp.juiceVolume || "0",
                );
                const newFraction = oldVolumeContribution / newTotalVolume;

                await tx
                  .update(batchCompositions)
                  .set({
                    fractionOfBatch: newFraction.toString(),
                    updatedAt: new Date(),
                  })
                  .where(eq(batchCompositions.id, existingComp.id));
              }

              // Add new compositions from this press run
              for (const consolidatedLoad of Object.values(consolidatedLoads)) {
                const fraction =
                  consolidatedLoad.totalAppleWeightKg / totalWeight;
                const juiceVolumeL = assignment.volumeL * fraction;
                const materialCost = consolidatedLoad.totalCost * fraction;
                const batchFraction = juiceVolumeL / newTotalVolume;

                // Calculate average brix if available
                const avgBrix =
                  consolidatedLoad.brixMeasurements.length > 0
                    ? consolidatedLoad.brixMeasurements.reduce(
                        (sum: number, brix: string | null) =>
                          sum + (brix ? parseFloat(brix) : 0),
                        0,
                      ) / consolidatedLoad.brixMeasurements.length
                    : null;

                totalFraction += batchFraction;
                totalJuiceVolume += juiceVolumeL;
                totalMaterialCost += materialCost;

                // Check if this purchase item already exists in the batch
                const existingPurchaseComp = existingCompositions.find(
                  (comp) =>
                    comp.purchaseItemId === consolidatedLoad.purchaseItemId,
                );

                if (existingPurchaseComp) {
                  // Merge with existing composition
                  const existingWeight = parseFloat(
                    existingPurchaseComp.inputWeightKg || "0",
                  );
                  const newWeight =
                    existingWeight + consolidatedLoad.totalAppleWeightKg;
                  const existingVolume = parseFloat(
                    existingPurchaseComp.juiceVolume || "0",
                  );
                  const newVolume = existingVolume + juiceVolumeL;
                  const existingCost = parseFloat(
                    existingPurchaseComp.materialCost || "0",
                  );
                  const newCost = existingCost + materialCost;
                  const newFraction = newVolume / newTotalVolume;

                  await tx
                    .update(batchCompositions)
                    .set({
                      inputWeightKg: newWeight.toString(),
                      juiceVolume: newVolume.toString(),
                      juiceVolumeUnit: "L",
                      materialCost: newCost.toString(),
                      fractionOfBatch: newFraction.toString(),
                      avgBrix:
                        avgBrix?.toString() || existingPurchaseComp.avgBrix,
                      updatedAt: new Date(),
                    })
                    .where(eq(batchCompositions.id, existingPurchaseComp.id));
                } else {
                  // Add new composition entry
                  await tx.insert(batchCompositions).values({
                    batchId,
                    purchaseItemId: consolidatedLoad.purchaseItemId,
                    vendorId: consolidatedLoad.vendorId,
                    varietyId: consolidatedLoad.varietyId,
                    inputWeightKg:
                      consolidatedLoad.totalAppleWeightKg.toString(),
                    juiceVolume: juiceVolumeL.toString(),
                    juiceVolumeUnit: "L",
                    fractionOfBatch: batchFraction.toString(),
                    materialCost: materialCost.toString(),
                    avgBrix: avgBrix ? avgBrix.toString() : null,
                  });

                  // Publish batch composition audit event
                  await publishCreateEvent(
                    "batch_compositions",
                    batchId,
                    {
                      batchId,
                      purchaseItemId: consolidatedLoad.purchaseItemId,
                      juiceVolumeL,
                      fraction: batchFraction,
                    },
                    ctx.session?.user?.id,
                    "Batch composition added from press run completion to existing batch",
                  );
                }
              }
            } else {
              // For new batch, create compositions normally
              for (const consolidatedLoad of Object.values(consolidatedLoads)) {
                const fraction =
                  consolidatedLoad.totalAppleWeightKg / totalWeight;
                const juiceVolumeL = assignment.volumeL * fraction;
                const materialCost = consolidatedLoad.totalCost * fraction;

                // Calculate average brix if available
                const avgBrix =
                  consolidatedLoad.brixMeasurements.length > 0
                    ? consolidatedLoad.brixMeasurements.reduce(
                        (sum: number, brix: string | null) =>
                          sum + (brix ? parseFloat(brix) : 0),
                        0,
                      ) / consolidatedLoad.brixMeasurements.length
                    : null;

                totalFraction += fraction;
                totalJuiceVolume += juiceVolumeL;
                totalMaterialCost += materialCost;

                await tx.insert(batchCompositions).values({
                  batchId,
                  purchaseItemId: consolidatedLoad.purchaseItemId,
                  vendorId: consolidatedLoad.vendorId,
                  varietyId: consolidatedLoad.varietyId,
                  inputWeightKg: consolidatedLoad.totalAppleWeightKg.toString(),
                  juiceVolume: juiceVolumeL.toString(),
                  juiceVolumeUnit: "L",
                  fractionOfBatch: fraction.toString(),
                  materialCost: materialCost.toString(),
                  avgBrix: avgBrix ? avgBrix.toString() : null,
                });

                // Publish batch composition audit event
                await publishCreateEvent(
                  "batch_compositions",
                  batchId,
                  {
                    batchId,
                    purchaseItemId: consolidatedLoad.purchaseItemId,
                    juiceVolumeL,
                    fraction,
                  },
                  ctx.session?.user?.id,
                  "Batch composition created from press run completion",
                );
              }
            }

            // Publish batch creation audit event
            await publishCreateEvent(
              "batches",
              batchId,
              {
                batchId,
                name: batchName,
                vesselId: assignment.toVesselId,
                pressRunId: input.pressRunId,
                volumeL: assignment.volumeL,
              },
              ctx.session?.user?.id,
              "Batch created from press run completion",
            );
          }

          // Publish press completion audit event
          await publishUpdateEvent(
            "press_runs",
            input.pressRunId,
            pressRun[0],
            { batchesCreated: true },
            ctx.session?.user?.id,
            "Press run completed with batch creation",
          );

          return {
            pressRunId: input.pressRunId,
            createdBatchIds,
            message: `Press run completed with ${createdBatchIds.length} batches created`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error completing press run:", error);

        // Include error details in the message for better debugging
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to complete press run: ${errorMessage}`,
        });
      }
    }),

  // List press runs with filtering and pagination - admin/operator/viewer
  list: createRbacProcedure("list", "press_run")
    .input(listPressRunsSchema)
    .query(async ({ input }) => {
      try {
        // Build WHERE conditions
        const conditions = [isNull(pressRuns.deletedAt)];

        if (input.status) {
          conditions.push(eq(pressRuns.status, input.status));
        }

        if (input.vendorId) {
          conditions.push(eq(pressRuns.vendorId, input.vendorId));
        }

        // Calculate limit and offset
        // Support both legacy (limit/offset) and new (page/pageSize) pagination
        let limit: number;
        let offset: number;

        if (input.page !== undefined && input.pageSize !== undefined) {
          // New pagination: page/pageSize
          limit = input.pageSize;
          offset = (input.page - 1) * input.pageSize;
        } else {
          // Legacy pagination: limit/offset
          limit = input.limit ?? 20;
          offset = input.offset ?? 0;
        }

        // Build ORDER BY clause
        const sortColumn = {
          created: pressRuns.createdAt,
          started: pressRuns.dateCompleted,
          updated: pressRuns.updatedAt,
          completed: pressRuns.dateCompleted,
        }[input.sortBy];

        const orderBy =
          input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

        // Query press runs with vendor and vessel info
        const pressRunsList = await db
          .select({
            id: pressRuns.id,
            pressRunName: pressRuns.pressRunName,
            vendorId: pressRuns.vendorId,
            vendorName: vendors.name,
            vesselId: pressRuns.vesselId,
            vesselName: vessels.name,
            status: pressRuns.status,
            dateCompleted: pressRuns.dateCompleted,
            totalAppleWeightKg: pressRuns.totalAppleWeightKg,
            totalJuiceVolume: pressRuns.totalJuiceVolume,
            totalJuiceVolumeUnit: pressRuns.totalJuiceVolumeUnit,
            extractionRate: pressRuns.extractionRate,
            laborHours: pressRuns.laborHours,
            totalLaborCost: pressRuns.totalLaborCost,
            notes: pressRuns.notes,
            createdAt: pressRuns.createdAt,
            updatedAt: pressRuns.updatedAt,
          })
          .from(pressRuns)
          .leftJoin(vendors, eq(pressRuns.vendorId, vendors.id))
          .leftJoin(vessels, eq(pressRuns.vesselId, vessels.id))
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset);

        // Get total count for pagination
        const totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(pressRuns)
          .where(and(...conditions));

        const totalCount = totalCountResult[0]?.count || 0;

        // Get load counts and varieties for each press run
        const pressRunIds = pressRunsList.map((pr) => pr.id);

        let loadCounts: Record<string, number> = {};
        let pressRunVarieties: Record<string, string[]> = {};
        if (pressRunIds.length > 0) {
          const loadCountsResult = await db
            .select({
              pressRunId: pressRunLoads.pressRunId,
              count: sql<number>`count(*)`,
            })
            .from(pressRunLoads)
            .where(
              and(
                inArray(pressRunLoads.pressRunId, pressRunIds),
                isNull(pressRunLoads.deletedAt),
              ),
            )
            .groupBy(pressRunLoads.pressRunId);

          loadCounts = loadCountsResult.reduce(
            (acc, row) => {
              acc[row.pressRunId] = row.count;
              return acc;
            },
            {} as Record<string, number>,
          );

          // Get varieties for each press run (using array_agg to prevent duplicates)
          const varietiesResult = await db
            .select({
              pressRunId: pressRunLoads.pressRunId,
              varieties: sql<string[]>`array_agg(DISTINCT ${baseFruitVarieties.name}) FILTER (WHERE ${baseFruitVarieties.name} IS NOT NULL)`,
            })
            .from(pressRunLoads)
            .leftJoin(
              baseFruitVarieties,
              eq(pressRunLoads.fruitVarietyId, baseFruitVarieties.id),
            )
            .where(
              and(
                inArray(pressRunLoads.pressRunId, pressRunIds),
                isNull(pressRunLoads.deletedAt),
              ),
            )
            .groupBy(pressRunLoads.pressRunId);

          pressRunVarieties = varietiesResult.reduce(
            (acc, row) => {
              acc[row.pressRunId] = row.varieties || [];
              return acc;
            },
            {} as Record<string, string[]>,
          );
        }

        // Get vessel assignments for each completed press run
        // This includes batches created from press runs AND merges into existing batches
        let vesselAssignmentsByPressRun: Record<string, Array<{ vesselName: string; volumeL: number }>> = {};

        const completedPressRunIds = pressRunsList
          .filter(pr => pr.status === 'completed')
          .map(pr => pr.id);

        if (completedPressRunIds.length > 0) {
          // Get all vessels for name lookup
          const allVessels = await db
            .select({ id: vessels.id, name: vessels.name })
            .from(vessels)
            .where(isNull(vessels.deletedAt));

          const vesselNameMap: Record<string, string> = {};
          for (const v of allVessels) {
            vesselNameMap[v.id] = v.name ?? 'Unknown Vessel';
          }

          // 1. Get batches created directly from these press runs (with their initial volumes)
          // Include deleted batches for historical tracking - we want to show where juice went
          // even if that batch was later deleted
          const batchesFromPressRuns = await db
            .select({
              batchId: batches.id,
              pressRunId: batches.originPressRunId,
              vesselId: batches.vesselId,
              initialVolume: batches.initialVolume,
              name: batches.name,
            })
            .from(batches)
            .where(inArray(batches.originPressRunId, completedPressRunIds));

          // Get batch IDs that were created by transfers (not directly from press run)
          // A batch is considered "created by transfer" only if:
          // 1. It's a destination in a non-self transfer
          // 2. AND the source batch has the SAME originPressRunId (meaning it's a derivative, not external juice)
          const batchIdsFromPressRuns = batchesFromPressRuns.map(b => b.batchId);
          let batchesCreatedByTransfer: Set<string> = new Set();

          if (batchIdsFromPressRuns.length > 0) {
            const transferDestinations = await db
              .select({
                sourceBatchId: batchTransfers.sourceBatchId,
                destinationBatchId: batchTransfers.destinationBatchId
              })
              .from(batchTransfers)
              .where(inArray(batchTransfers.destinationBatchId, batchIdsFromPressRuns));

            // Get originPressRunId for all source batches
            const sourceBatchIds = transferDestinations
              .map(t => t.sourceBatchId)
              .filter((id): id is string => id !== null && id !== undefined);

            let sourceBatchOrigins: Record<string, string | null> = {};
            if (sourceBatchIds.length > 0) {
              const sourceBatches = await db
                .select({ id: batches.id, originPressRunId: batches.originPressRunId })
                .from(batches)
                .where(inArray(batches.id, sourceBatchIds));

              for (const sb of sourceBatches) {
                sourceBatchOrigins[sb.id] = sb.originPressRunId;
              }
            }

            // Build a map of destination batch ID to its originPressRunId
            const destBatchOrigins: Record<string, string | null> = {};
            for (const b of batchesFromPressRuns) {
              destBatchOrigins[b.batchId] = b.pressRunId;
            }

            for (const t of transferDestinations) {
              if (!t.destinationBatchId || t.sourceBatchId === t.destinationBatchId) continue;

              // Check if source batch has the same originPressRunId as destination
              const sourceOrigin = t.sourceBatchId ? sourceBatchOrigins[t.sourceBatchId] : null;
              const destOrigin = destBatchOrigins[t.destinationBatchId];

              // Only mark as derivative if source has same origin (derivative batch)
              // If source has different/null origin, the destination was likely created from the press run
              // and later received external juice
              if (sourceOrigin === destOrigin && sourceOrigin !== null) {
                batchesCreatedByTransfer.add(t.destinationBatchId);
              }
            }
          }

          // Group batches by press run, excluding derivative batches
          for (const batch of batchesFromPressRuns) {
            if (!batch.pressRunId) continue;

            // Skip batches that were created by transfers - they didn't come directly from the press run
            if (batchesCreatedByTransfer.has(batch.batchId)) continue;

            // Skip derivative batches (those created from splits/rackings that inherited originPressRunId)
            // These have naming patterns like " - Remaining", " - Split", etc.
            if (batch.name && (
              batch.name.includes(' - Remaining') ||
              batch.name.includes(' - Split') ||
              batch.name.includes('-Tmi') // Transfer-created batch naming pattern
            )) continue;

            if (!vesselAssignmentsByPressRun[batch.pressRunId]) {
              vesselAssignmentsByPressRun[batch.pressRunId] = [];
            }

            let vesselName = 'Unknown Vessel';
            if (batch.vesselId && vesselNameMap[batch.vesselId]) {
              vesselName = vesselNameMap[batch.vesselId];
            } else if (batch.name) {
              // Extract vessel name from batch name pattern: YYYY-MM-DD_VesselName_Code
              const parts = batch.name.split('_');
              if (parts.length >= 2) {
                vesselName = parts[1];
              }
            }

            vesselAssignmentsByPressRun[batch.pressRunId].push({
              vesselName,
              volumeL: batch.initialVolume ? parseFloat(batch.initialVolume.toString()) : 0,
            });
          }

          // 2. Get merges from these press runs into existing batches
          const merges = await db
            .select({
              pressRunId: batchMergeHistory.sourcePressRunId,
              volumeAdded: batchMergeHistory.volumeAdded,
              targetBatchId: batchMergeHistory.targetBatchId,
            })
            .from(batchMergeHistory)
            .where(
              and(
                inArray(batchMergeHistory.sourcePressRunId, completedPressRunIds),
                isNull(batchMergeHistory.deletedAt),
              ),
            );

          // Get target batch info for merges
          const targetBatchIds = merges.map(m => m.targetBatchId).filter(Boolean) as string[];
          let targetBatchMap: Record<string, { vesselId: string | null; name: string | null }> = {};

          if (targetBatchIds.length > 0) {
            const targetBatches = await db
              .select({ id: batches.id, vesselId: batches.vesselId, name: batches.name })
              .from(batches)
              .where(inArray(batches.id, targetBatchIds));

            for (const batch of targetBatches) {
              targetBatchMap[batch.id] = { vesselId: batch.vesselId, name: batch.name };
            }
          }

          // Add merges to vessel assignments
          for (const merge of merges) {
            if (!merge.pressRunId) continue;

            if (!vesselAssignmentsByPressRun[merge.pressRunId]) {
              vesselAssignmentsByPressRun[merge.pressRunId] = [];
            }

            const targetBatch = targetBatchMap[merge.targetBatchId];
            let vesselName = 'Unknown Vessel';

            if (targetBatch) {
              if (targetBatch.vesselId && vesselNameMap[targetBatch.vesselId]) {
                vesselName = vesselNameMap[targetBatch.vesselId];
              } else if (targetBatch.name) {
                // Extract vessel name from batch name pattern
                const parts = targetBatch.name.split('_');
                if (parts.length >= 2) {
                  vesselName = parts[1];
                }
              }
            }

            vesselAssignmentsByPressRun[merge.pressRunId].push({
              vesselName,
              volumeL: merge.volumeAdded ? parseFloat(merge.volumeAdded.toString()) : 0,
            });
          }
        }

        // Enhance press runs with load counts, varieties, and vessel assignments
        const enhancedPressRuns = pressRunsList.map((pressRun) => ({
          ...pressRun,
          loadCount: loadCounts[pressRun.id] || 0,
          varieties: pressRunVarieties[pressRun.id] || [],
          extractionRatePercent: pressRun.extractionRate
            ? Math.round(parseFloat(pressRun.extractionRate) * 10000) / 100
            : null,
          vesselAssignments: vesselAssignmentsByPressRun[pressRun.id] || [],
        }));

        return {
          pressRuns: enhancedPressRuns,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount,
          },
        };
      } catch (error) {
        console.error("Error listing press runs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list press runs",
        });
      }
    }),

  // Get specific press run with loads - admin/operator/viewer
  get: createRbacProcedure("read", "press_run")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        // Get press run with vendor and vessel info
        const pressRunResult = await db
          .select({
            id: pressRuns.id,
            pressRunName: pressRuns.pressRunName,
            vendorId: pressRuns.vendorId,
            vendorName: vendors.name,
            vendorContactInfo: vendors.contactInfo,
            vesselId: pressRuns.vesselId,
            vesselName: vessels.name,
            // TODO: Remove vessel type logic after migration
            // vesselType: vessels.type,
            vesselCapacity: vessels.capacity,
            vesselCapacityUnit: vessels.capacityUnit,
            status: pressRuns.status,
            dateCompleted: pressRuns.dateCompleted,
            totalAppleWeightKg: pressRuns.totalAppleWeightKg,
            totalJuiceVolume: pressRuns.totalJuiceVolume,
            totalJuiceVolumeUnit: pressRuns.totalJuiceVolumeUnit,
            extractionRate: pressRuns.extractionRate,
            laborHours: pressRuns.laborHours,
            laborCostPerHour: pressRuns.laborCostPerHour,
            totalLaborCost: pressRuns.totalLaborCost,
            notes: pressRuns.notes,
            createdAt: pressRuns.createdAt,
            updatedAt: pressRuns.updatedAt,
            createdByUserId: pressRuns.createdBy,
            updatedByUserId: pressRuns.updatedBy,
          })
          .from(pressRuns)
          .leftJoin(vendors, eq(pressRuns.vendorId, vendors.id))
          .leftJoin(vessels, eq(pressRuns.vesselId, vessels.id))
          .where(
            and(
              eq(pressRuns.id, input.id),
              isNull(pressRuns.deletedAt),
            ),
          )
          .limit(1);

        if (!pressRunResult.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Press run not found",
          });
        }

        const pressRun = pressRunResult[0];

        // Get loads with apple variety and purchase item info including vendor details
        const loads = await db
          .select({
            id: pressRunLoads.id,
            purchaseItemId: pressRunLoads.purchaseItemId,
            fruitVarietyId: pressRunLoads.fruitVarietyId,
            appleVarietyName: baseFruitVarieties.name,
            vendorId: basefruitPurchases.vendorId,
            vendorName: vendors.name,
            loadSequence: pressRunLoads.loadSequence,
            appleWeightKg: pressRunLoads.appleWeightKg,
            originalWeight: pressRunLoads.originalWeight,
            originalWeightUnit: pressRunLoads.originalWeightUnit,
            juiceVolume: pressRunLoads.juiceVolume,
            juiceVolumeUnit: pressRunLoads.juiceVolumeUnit,
            originalVolume: pressRunLoads.originalVolume,
            originalVolumeUnit: pressRunLoads.originalVolumeUnit,
            notes: pressRunLoads.notes,
            createdAt: pressRunLoads.createdAt,
            // Purchase item original quantities
            purchaseItemOriginalQuantityKg: basefruitPurchaseItems.quantityKg,
            purchaseItemOriginalQuantity: basefruitPurchaseItems.quantity,
            purchaseItemOriginalUnit: basefruitPurchaseItems.unit,
          })
          .from(pressRunLoads)
          .leftJoin(
            baseFruitVarieties,
            eq(pressRunLoads.fruitVarietyId, baseFruitVarieties.id),
          )
          .leftJoin(
            basefruitPurchaseItems,
            eq(pressRunLoads.purchaseItemId, basefruitPurchaseItems.id),
          )
          .leftJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
          )
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .where(
            and(
              eq(pressRunLoads.pressRunId, input.id),
              isNull(pressRunLoads.deletedAt),
            ),
          )
          .orderBy(asc(pressRunLoads.loadSequence));

        // Get user info for created/updated by
        const userIds = [
          pressRun.createdByUserId,
          pressRun.updatedByUserId,
        ].filter(Boolean) as string[];
        let userInfo: Record<string, any> = {};

        if (userIds.length > 0) {
          const userRecords = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(inArray(users.id, userIds));

          userInfo = userRecords.reduce(
            (acc: Record<string, any>, user: any) => {
              acc[user.id] = user;
              return acc;
            },
            {} as Record<string, any>,
          );
        }

        // Get batches created from this press run
        const batchesFromPressRun = await db
          .select({
            batchId: batches.id,
            batchName: batches.name,
            vesselId: batches.vesselId,
            initialVolume: batches.initialVolume,
            startDate: batches.startDate,
          })
          .from(batches)
          .where(
            and(
              eq(batches.originPressRunId, input.id),
              isNull(batches.deletedAt),
            ),
          );

        // Get all vessel names for lookup
        const allVessels = await db.select({ id: vessels.id, name: vessels.name }).from(vessels);
        const vesselNameMap: Record<string, string> = {};
        for (const v of allVessels) {
          vesselNameMap[v.id] = v.name ?? 'Unknown Vessel';
        }

        // Build list of initial vessel assignments (where juice from press run went)
        // This includes both:
        // 1. Batches created directly from the press run (originPressRunId)
        // 2. Merges into existing batches (batchMergeHistory)
        const vesselAssignments: Array<{
          vesselId: string;
          vesselName: string;
          volumeL: number;
        }> = [];

        // 1. Get batches created directly from this press run
        for (const batch of batchesFromPressRun) {
          // Check if this batch was created by a transfer (not directly from press run)
          const transfersIn = await db
            .select({ id: batchTransfers.id })
            .from(batchTransfers)
            .where(eq(batchTransfers.destinationBatchId, batch.batchId))
            .limit(1);

          // Skip batches created by transfers - they didn't come directly from the press run
          if (transfersIn.length > 0) continue;

          // Get racking operations to find original vessel
          const rackings = await db
            .select({ sourceVesselId: batchRackingOperations.sourceVesselId })
            .from(batchRackingOperations)
            .where(eq(batchRackingOperations.batchId, batch.batchId))
            .orderBy(asc(batchRackingOperations.rackedAt))
            .limit(1);

          // Get outgoing transfers to find original vessel
          const transfersOut = await db
            .select({ sourceVesselId: batchTransfers.sourceVesselId })
            .from(batchTransfers)
            .where(eq(batchTransfers.sourceBatchId, batch.batchId))
            .orderBy(asc(batchTransfers.transferredAt))
            .limit(1);

          // Determine the initial vessel where juice was placed
          let initialVesselId: string | null = null;
          if (rackings.length > 0 && rackings[0].sourceVesselId) {
            initialVesselId = rackings[0].sourceVesselId;
          } else if (transfersOut.length > 0 && transfersOut[0].sourceVesselId) {
            initialVesselId = transfersOut[0].sourceVesselId;
          } else {
            initialVesselId = batch.vesselId;
          }

          if (initialVesselId) {
            vesselAssignments.push({
              vesselId: initialVesselId,
              vesselName: vesselNameMap[initialVesselId] || 'Unknown Vessel',
              volumeL: batch.initialVolume ? parseFloat(batch.initialVolume.toString()) : 0,
            });
          }
        }

        // 2. Get merges from this press run into existing batches
        const merges = await db
          .select({
            volumeAdded: batchMergeHistory.volumeAdded,
            targetBatchId: batchMergeHistory.targetBatchId,
          })
          .from(batchMergeHistory)
          .where(
            and(
              eq(batchMergeHistory.sourcePressRunId, input.id),
              isNull(batchMergeHistory.deletedAt),
            ),
          );

        for (const merge of merges) {
          // Get the vessel for the target batch
          const targetBatch = await db
            .select({ vesselId: batches.vesselId, name: batches.name })
            .from(batches)
            .where(eq(batches.id, merge.targetBatchId))
            .limit(1);

          if (targetBatch.length > 0) {
            let vesselName = 'Unknown Vessel';
            let vesselId = targetBatch[0].vesselId;

            if (vesselId && vesselNameMap[vesselId]) {
              // Batch still has a vessel assigned
              vesselName = vesselNameMap[vesselId];
            } else {
              // Batch has been moved/completed - extract vessel name from batch name
              // Batch names follow pattern: YYYY-MM-DD_VesselName_CompositionCode
              const batchName = targetBatch[0].name;
              if (batchName) {
                const parts = batchName.split('_');
                if (parts.length >= 2) {
                  vesselName = parts[1]; // Second part is typically the vessel name
                }
              }
              vesselId = null;
            }

            vesselAssignments.push({
              vesselId: vesselId || 'unknown',
              vesselName,
              volumeL: merge.volumeAdded ? parseFloat(merge.volumeAdded.toString()) : 0,
            });
          }
        }

        // Calculate unassigned volume (total juice - sum of all assignments)
        const totalJuiceVolume = pressRun.totalJuiceVolume ? parseFloat(pressRun.totalJuiceVolume) : 0;
        const assignedVolume = vesselAssignments.reduce((sum, a) => sum + a.volumeL, 0);
        const unassignedVolume = totalJuiceVolume - assignedVolume;

        return {
          pressRun: {
            ...pressRun,
            extractionRatePercent: pressRun.extractionRate
              ? Math.round(parseFloat(pressRun.extractionRate) * 10000) / 100
              : null,
            createdByUser: pressRun.createdByUserId
              ? userInfo[pressRun.createdByUserId]
              : null,
            updatedByUser: pressRun.updatedByUserId
              ? userInfo[pressRun.updatedByUserId]
              : null,
          },
          loads: loads.map((load) => ({
            ...load,
            individualExtractionRate:
              load.appleWeightKg && load.juiceVolume
                ? parseFloat(load.juiceVolume) / parseFloat(load.appleWeightKg)
                : null,
          })),
          summary: {
            totalLoads: loads.length,
            totalAppleWeightKg: pressRun.totalAppleWeightKg
              ? parseFloat(pressRun.totalAppleWeightKg)
              : 0,
            totalJuiceVolume: pressRun.totalJuiceVolume
              ? parseFloat(pressRun.totalJuiceVolume)
              : 0,
            varietyBreakdown: loads.reduce(
              (acc, load) => {
                const variety = load.appleVarietyName || "Unknown";
                if (!acc[variety]) {
                  acc[variety] = { count: 0, weightKg: 0, juiceL: 0 };
                }
                acc[variety].count++;
                acc[variety].weightKg += parseFloat(load.appleWeightKg || "0");
                acc[variety].juiceL += parseFloat(load.juiceVolume || "0");
                return acc;
              },
              {} as Record<
                string,
                { count: number; weightKg: number; juiceL: number }
              >,
            ),
          },
          vesselAssignments,
          unassignedVolume: unassignedVolume > 0.1 ? unassignedVolume : 0, // Only show if > 0.1L to handle rounding
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error getting press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get press run",
        });
      }
    }),

  // Update press run metadata - admin/operator only
  update: createRbacProcedure("update", "press_run")
    .input(
      z.object({
        id: z.string().uuid(),
        notes: z.string().optional(),
        pressingMethod: z.string().optional(),
        weatherConditions: z.string().optional(),
        dateCompleted: z.date().or(z.string().transform((val) => new Date(val))).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updateData } = input;

        const existingPressRun = await db
          .select()
          .from(pressRuns)
          .where(
            and(eq(pressRuns.id, id), isNull(pressRuns.deletedAt)),
          )
          .limit(1);

        if (!existingPressRun.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Press run not found",
          });
        }

        // Allow updating metadata fields (notes, pressingMethod, weatherConditions, dateCompleted)
        // even on completed press runs

        // Convert dateCompleted to ISO date string if provided
        const updatePayload: Record<string, unknown> = { ...updateData };
        if (updateData.dateCompleted) {
          updatePayload.dateCompleted = updateData.dateCompleted.toISOString().split("T")[0];

          // If date is changing and press run is completed, regenerate pressRunName
          const newDateStr = updateData.dateCompleted.toISOString().split("T")[0];
          const oldDateStr = existingPressRun[0].dateCompleted;

          if (existingPressRun[0].status === "completed" && newDateStr !== oldDateStr) {
            // Find existing press runs on the new date (excluding this press run)
            const existingRuns = await db
              .select({ pressRunName: pressRuns.pressRunName })
              .from(pressRuns)
              .where(
                and(
                  sql`${pressRuns.pressRunName} LIKE ${newDateStr + "-%"}`,
                  isNull(pressRuns.deletedAt),
                  sql`${pressRuns.id} != ${id}`, // Exclude current press run
                ),
              )
              .orderBy(desc(pressRuns.pressRunName));

            // Extract the highest sequence number for this date
            let sequenceNumber = 1;
            if (existingRuns.length > 0) {
              const pattern = new RegExp(`^${newDateStr}-(\\d+)$`);
              for (const run of existingRuns) {
                if (run.pressRunName) {
                  const match = run.pressRunName.match(pattern);
                  if (match) {
                    const num = parseInt(match[1], 10);
                    if (num >= sequenceNumber) {
                      sequenceNumber = num + 1;
                    }
                  }
                }
              }
            }

            // Generate new press run name
            const newPressRunName = `${newDateStr}-${String(sequenceNumber).padStart(2, "0")}`;
            updatePayload.pressRunName = newPressRunName;
          }
        }

        const updatedPressRun = await db
          .update(pressRuns)
          .set({
            ...updatePayload,
            updatedBy: ctx.session?.user?.id,
            updatedAt: new Date(),
          })
          .where(eq(pressRuns.id, id))
          .returning();

        // Publish audit event
        await publishUpdateEvent(
          "press_runs",
          id,
          existingPressRun[0],
          updateData,
          ctx.session?.user?.id,
          "Press run updated",
        );

        return {
          success: true,
          pressRun: updatedPressRun[0],
          message: "Press run updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update press run",
        });
      }
    }),

  // Cancel press run - admin/operator only
  cancel: createRbacProcedure("update", "press_run")
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, "Cancellation reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const existingPressRun = await db
          .select()
          .from(pressRuns)
          .where(
            and(
              eq(pressRuns.id, input.id),
              isNull(pressRuns.deletedAt),
            ),
          )
          .limit(1);

        if (!existingPressRun.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Press run not found",
          });
        }

        if (existingPressRun[0].status === "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot cancel completed press run",
          });
        }

        if (existingPressRun[0].status === "cancelled") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Press run is already cancelled",
          });
        }

        const cancelledPressRun = await db
          .update(pressRuns)
          .set({
            status: "cancelled",
            notes: existingPressRun[0].notes
              ? `${existingPressRun[0].notes}\n\nCANCELLED: ${input.reason}`
              : `CANCELLED: ${input.reason}`,
            updatedBy: ctx.session?.user?.id,
            updatedAt: new Date(),
          })
          .where(eq(pressRuns.id, input.id))
          .returning();

        // Publish audit event
        await publishUpdateEvent(
          "press_runs",
          input.id,
          existingPressRun[0],
          { status: "cancelled", cancellationReason: input.reason },
          ctx.session?.user?.id,
          "Press run cancelled",
        );

        return {
          success: true,
          pressRun: cancelledPressRun[0],
          message: `Press run cancelled: ${input.reason}`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error cancelling press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel press run",
        });
      }
    }),

  // Delete press run (soft delete) - admin only
  delete: createRbacProcedure("delete", "press_run")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          const existingPressRun = await tx
            .select()
            .from(pressRuns)
            .where(
              and(
                eq(pressRuns.id, input.id),
                isNull(pressRuns.deletedAt),
              ),
            )
            .limit(1);

          if (!existingPressRun.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Press run not found",
            });
          }

          if (
            existingPressRun[0].status === "completed" &&
            existingPressRun[0].vesselId
          ) {
            // Check if vessel still exists
            const vessel = await tx
              .select()
              .from(vessels)
              .where(
                and(
                  eq(vessels.id, existingPressRun[0].vesselId),
                  isNull(vessels.deletedAt),
                ),
              )
              .limit(1);

            if (vessel.length > 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "Cannot delete completed press run with juice assigned to vessel",
              });
            }
          }

          // Soft delete press run and all loads
          const deletedPressRun = await tx
            .update(pressRuns)
            .set({
              deletedAt: new Date(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(pressRuns.id, input.id))
            .returning();

          await tx
            .update(pressRunLoads)
            .set({
              deletedAt: new Date(),
              updatedBy: ctx.session?.user?.id,
              updatedAt: new Date(),
            })
            .where(eq(pressRunLoads.pressRunId, input.id));

          // Cascade soft delete to batches created from this press run
          await tx
            .update(batches)
            .set({
              deletedAt: new Date(),
            })
            .where(
              and(
                eq(batches.originPressRunId, input.id),
                isNull(batches.deletedAt),
              ),
            );

          // Set source_press_run_id to NULL in batch_merge_history (soft delete doesn't remove references)
          await tx
            .update(batchMergeHistory)
            .set({
              sourcePressRunId: null,
            })
            .where(
              and(
                eq(batchMergeHistory.sourcePressRunId, input.id),
                isNull(batchMergeHistory.deletedAt),
              ),
            );

          // Publish audit event
          await publishDeleteEvent(
            "press_runs",
            input.id,
            existingPressRun[0],
            ctx.session?.user?.id,
            "Press run deleted",
          );

          return {
            success: true,
            pressRun: deletedPressRun[0],
            message: "Press run deleted successfully",
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting press run:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete press run",
        });
      }
    }),

  // Delete load - admin/operator only
  deleteLoad: createRbacProcedure("delete", "press_run")
    .input(deleteLoadSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Verify load exists and get press run info
          const load = await tx
            .select({
              id: pressRunLoads.id,
              pressRunId: pressRunLoads.pressRunId,
              loadSequence: pressRunLoads.loadSequence,
            })
            .from(pressRunLoads)
            .where(
              and(
                eq(pressRunLoads.id, input.loadId),
                isNull(pressRunLoads.deletedAt),
              ),
            )
            .limit(1);

          if (!load.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Load not found",
            });
          }

          // Verify press run is still in progress
          const pressRun = await tx
            .select({ status: pressRuns.status })
            .from(pressRuns)
            .where(
              and(
                eq(pressRuns.id, load[0].pressRunId),
                isNull(pressRuns.deletedAt),
              ),
            )
            .limit(1);

          if (!pressRun.length || pressRun[0].status !== "in_progress") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot delete load - press run is not in progress",
            });
          }

          // Soft delete the load
          const deletedLoad = await tx
            .update(pressRunLoads)
            .set({
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(pressRunLoads.id, input.loadId))
            .returning();

          // Resequence remaining loads to maintain consecutive numbering
          const remainingLoads = await tx
            .select({
              id: pressRunLoads.id,
              loadSequence: pressRunLoads.loadSequence,
            })
            .from(pressRunLoads)
            .where(
              and(
                eq(pressRunLoads.pressRunId, load[0].pressRunId),
                isNull(pressRunLoads.deletedAt),
              ),
            )
            .orderBy(asc(pressRunLoads.loadSequence));

          // Update sequence numbers to be consecutive (1, 2, 3, ...)
          for (let i = 0; i < remainingLoads.length; i++) {
            const newSequence = i + 1;
            if (remainingLoads[i].loadSequence !== newSequence) {
              await tx
                .update(pressRunLoads)
                .set({
                  loadSequence: newSequence,
                  updatedAt: new Date(),
                })
                .where(eq(pressRunLoads.id, remainingLoads[i].id));
            }
          }

          // Create audit log entry
          await publishDeleteEvent(
            "apple_press_run_load",
            input.loadId,
            load[0],
            ctx.session?.user?.id,
            `Load #${load[0].loadSequence} deleted from press run`,
          );

          return {
            success: true,
            loadId: input.loadId,
            message: "Load deleted successfully",
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting load:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete load",
        });
      }
    }),

  // Get available purchase lines with allocation tracking for a specific press run
  getAvailablePurchaseLines: createRbacProcedure("read", "press_run")
    .input(
      z.object({
        pressRunId: z.string().uuid("Invalid press run ID"),
        vendorId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Verify press run exists
        const pressRunExists = await db
          .select({ id: pressRuns.id })
          .from(pressRuns)
          .where(
            and(
              eq(pressRuns.id, input.pressRunId),
              isNull(pressRuns.deletedAt),
            ),
          )
          .limit(1);

        if (!pressRunExists.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Press run not found",
          });
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
          .innerJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
          )
          .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .innerJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
          )
          .where(
            and(
              isNull(basefruitPurchaseItems.deletedAt),
              isNull(basefruitPurchases.deletedAt),
              isNull(vendors.deletedAt),
              isNull(baseFruitVarieties.deletedAt),
              eq(basefruitPurchaseItems.isDepleted, false),
              input.vendorId
                ? eq(basefruitPurchases.vendorId, input.vendorId)
                : sql`1=1`,
            ),
          )
          .orderBy(
            desc(basefruitPurchases.purchaseDate),
            asc(baseFruitVarieties.name),
          )
          .limit(input.limit)
          .offset(input.offset);

        const purchaseItems = await baseQuery;

        if (purchaseItems.length === 0) {
          return {
            items: [],
            summary: {
              totalAvailableItems: 0,
              totalAvailableKg: 0,
            },
          };
        }

        // Get allocation data for this press run - sum up all existing loads by purchaseItemId
        const allocations = await db
          .select({
            purchaseItemId: pressRunLoads.purchaseItemId,
            allocatedKg: sql<number>`COALESCE(SUM(CAST(${pressRunLoads.appleWeightKg} AS NUMERIC)), 0)`,
          })
          .from(pressRunLoads)
          .where(
            and(
              eq(pressRunLoads.pressRunId, input.pressRunId),
              isNull(pressRunLoads.deletedAt),
              inArray(
                pressRunLoads.purchaseItemId,
                purchaseItems.map((item) => item.purchaseItemId),
              ),
            ),
          )
          .groupBy(pressRunLoads.purchaseItemId);

        // Create allocation map for quick lookup
        const allocationMap = new Map();
        allocations.forEach((alloc) => {
          allocationMap.set(
            alloc.purchaseItemId,
            parseFloat(alloc.allocatedKg.toString()),
          );
        });

        // Transform results to include allocation tracking
        const itemsWithAllocations = purchaseItems.map((item) => {
          const totalQuantityKg = parseFloat(item.quantityKg || "0");
          const allocatedKg = allocationMap.get(item.purchaseItemId) || 0;
          const availableQuantityKg = Math.max(
            0,
            totalQuantityKg - allocatedKg,
          );
          const availablePercentage =
            totalQuantityKg > 0
              ? (availableQuantityKg / totalQuantityKg) * 100
              : 0;

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
            originalQuantity: parseFloat(item.originalQuantity || "0"),
            originalUnit: item.originalUnit,
            pricePerUnit: item.pricePerUnit
              ? parseFloat(item.pricePerUnit)
              : null,
            totalCost: item.totalCost ? parseFloat(item.totalCost) : null,
            harvestDate: item.harvestDate,
            notes: item.notes,
          };
        });

        // Filter out items with no available quantity (archived/fully allocated items)
        const availableItems = itemsWithAllocations.filter(
          (item) => item.availableQuantityKg > 0,
        );

        // Calculate summary
        const totalAvailableKg = availableItems.reduce(
          (sum, item) => sum + item.availableQuantityKg,
          0,
        );

        return {
          items: availableItems,
          summary: {
            totalAvailableItems: availableItems.length,
            totalAvailableKg,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error(
          "Error fetching available purchase lines with allocations:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch available purchase lines",
        });
      }
    }),

  // Get all available inventory grouped by vendor for the Build Press Run UI
  getInventoryGroupedByVendor: createRbacProcedure("read", "press_run")
    .input(
      z.object({
        vendorFilter: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Get all non-depleted purchase items with their consumption data
        const purchaseItems = await db
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
            purchaseDate: basefruitPurchases.purchaseDate,
            harvestDate: basefruitPurchaseItems.harvestDate,
            pricePerUnit: basefruitPurchaseItems.pricePerUnit,
            totalCost: basefruitPurchaseItems.totalCost,
          })
          .from(basefruitPurchaseItems)
          .innerJoin(
            basefruitPurchases,
            eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
          )
          .innerJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .innerJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
          )
          .where(
            and(
              isNull(basefruitPurchaseItems.deletedAt),
              isNull(basefruitPurchases.deletedAt),
              isNull(vendors.deletedAt),
              isNull(baseFruitVarieties.deletedAt),
              eq(basefruitPurchaseItems.isDepleted, false),
              input.vendorFilter
                ? sql`LOWER(${vendors.name}) LIKE LOWER(${"%" + input.vendorFilter + "%"})`
                : sql`1=1`,
            ),
          )
          .orderBy(asc(vendors.name), desc(basefruitPurchases.purchaseDate));

        if (purchaseItems.length === 0) {
          return {
            vendors: [],
            summary: {
              totalVendors: 0,
              totalItems: 0,
              totalAvailableKg: 0,
            },
          };
        }

        // Get consumption data for all purchase items - sum of all press run loads
        const consumptions = await db
          .select({
            purchaseItemId: pressRunLoads.purchaseItemId,
            consumedKg: sql<number>`COALESCE(SUM(CAST(${pressRunLoads.appleWeightKg} AS NUMERIC)), 0)`,
          })
          .from(pressRunLoads)
          .where(
            and(
              isNull(pressRunLoads.deletedAt),
              inArray(
                pressRunLoads.purchaseItemId,
                purchaseItems.map((item) => item.purchaseItemId),
              ),
            ),
          )
          .groupBy(pressRunLoads.purchaseItemId);

        // Create consumption map
        const consumptionMap = new Map<string, number>();
        consumptions.forEach((c) => {
          consumptionMap.set(
            c.purchaseItemId,
            parseFloat(c.consumedKg.toString()),
          );
        });

        // Group by vendor and calculate available quantities
        const vendorMap = new Map<
          string,
          {
            vendorId: string;
            vendorName: string;
            items: Array<{
              purchaseItemId: string;
              purchaseId: string;
              fruitVarietyId: string;
              varietyName: string;
              purchaseDate: Date;
              harvestDate: string | null;
              totalQuantityKg: number;
              consumedQuantityKg: number;
              availableQuantityKg: number;
              pricePerUnit: number | null;
              totalCost: number | null;
            }>;
            totalAvailableKg: number;
          }
        >();

        for (const item of purchaseItems) {
          const totalKg = parseFloat(item.quantityKg || "0");
          const consumedKg = consumptionMap.get(item.purchaseItemId) || 0;
          const availableKg = Math.max(0, totalKg - consumedKg);

          // Skip items with no available quantity
          if (availableKg <= 0) continue;

          if (!vendorMap.has(item.vendorId)) {
            vendorMap.set(item.vendorId, {
              vendorId: item.vendorId,
              vendorName: item.vendorName,
              items: [],
              totalAvailableKg: 0,
            });
          }

          const vendor = vendorMap.get(item.vendorId)!;
          vendor.items.push({
            purchaseItemId: item.purchaseItemId,
            purchaseId: item.purchaseId,
            fruitVarietyId: item.fruitVarietyId,
            varietyName: item.varietyName,
            purchaseDate: item.purchaseDate,
            harvestDate: item.harvestDate,
            totalQuantityKg: totalKg,
            consumedQuantityKg: consumedKg,
            availableQuantityKg: availableKg,
            pricePerUnit: item.pricePerUnit
              ? parseFloat(item.pricePerUnit)
              : null,
            totalCost: item.totalCost ? parseFloat(item.totalCost) : null,
          });
          vendor.totalAvailableKg += availableKg;
        }

        // Convert to array and sort
        const vendorList = Array.from(vendorMap.values()).sort((a, b) =>
          a.vendorName.localeCompare(b.vendorName),
        );

        // Calculate summary
        const totalAvailableKg = vendorList.reduce(
          (sum, v) => sum + v.totalAvailableKg,
          0,
        );
        const totalItems = vendorList.reduce(
          (sum, v) => sum + v.items.length,
          0,
        );

        return {
          vendors: vendorList,
          summary: {
            totalVendors: vendorList.length,
            totalItems,
            totalAvailableKg,
          },
        };
      } catch (error) {
        console.error("Error fetching grouped inventory:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch inventory",
        });
      }
    }),
});
