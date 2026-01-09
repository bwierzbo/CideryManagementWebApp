import { z } from "zod";
import { router, protectedProcedure, createRbacProcedure } from "../trpc";
import {
  db,
  distillationRecords,
  batches,
  vessels,
  users,
  batchMergeHistory,
  batchMeasurements,
} from "db";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  calculateProofGallons,
  calculateDistillationLoss,
} from "lib/src/calc/abv";
import { convertVolume } from "lib/src/utils/volumeConversion";

// Constants
const LITERS_PER_GALLON = 3.785411784;

export const distillationRouter = router({
  /**
   * Send multiple batches to distillery in a single shipment
   * Creates distillation records for each batch and optionally reduces source batch volumes
   */
  sendMultipleToDistillery: createRbacProcedure("create", "batch")
    .input(
      z.object({
        batches: z.array(
          z.object({
            sourceBatchId: z.string().uuid(),
            sourceVolume: z.number().positive(),
            sourceVolumeUnit: z.enum(["L", "gal"]).default("L"),
            sourceAbv: z.number().min(0).max(100).optional(),
          })
        ).min(1),
        distilleryName: z.string().min(1),
        distilleryAddress: z.string().optional(),
        distilleryPermitNumber: z.string().optional(),
        sentAt: z.union([z.date(), z.string().transform((val) => new Date(val))]),
        tibOutboundNumber: z.string().optional(),
        notes: z.string().optional(),
        deductFromBatch: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results: Array<typeof distillationRecords.$inferSelect> = [];

      for (const batchInput of input.batches) {
        // Verify source batch exists and has volume
        const [sourceBatch] = await db
          .select()
          .from(batches)
          .where(and(eq(batches.id, batchInput.sourceBatchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!sourceBatch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Source batch ${batchInput.sourceBatchId} not found`,
          });
        }

        // Convert volume to liters
        const sourceVolumeLiters = batchInput.sourceVolumeUnit === "gal"
          ? batchInput.sourceVolume * LITERS_PER_GALLON
          : batchInput.sourceVolume;

        // Check if batch has enough volume
        const currentVolumeLiters = sourceBatch.currentVolumeLiters
          ? parseFloat(sourceBatch.currentVolumeLiters)
          : 0;

        if (input.deductFromBatch && sourceVolumeLiters > currentVolumeLiters) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Batch "${sourceBatch.name}" only has ${currentVolumeLiters.toFixed(1)}L available, cannot send ${sourceVolumeLiters.toFixed(1)}L`,
          });
        }

        // Calculate proof gallons if ABV is provided
        let proofGallonsSent: number | null = null;
        if (batchInput.sourceAbv !== undefined) {
          proofGallonsSent = calculateProofGallons(sourceVolumeLiters, batchInput.sourceAbv);
        }

        // Create distillation record
        const [record] = await db
          .insert(distillationRecords)
          .values({
            sourceBatchId: batchInput.sourceBatchId,
            sourceVolume: String(batchInput.sourceVolume),
            sourceVolumeUnit: batchInput.sourceVolumeUnit,
            sourceVolumeLiters: String(sourceVolumeLiters),
            sourceAbv: batchInput.sourceAbv !== undefined ? String(batchInput.sourceAbv) : null,
            distilleryName: input.distilleryName,
            distilleryAddress: input.distilleryAddress || null,
            distilleryPermitNumber: input.distilleryPermitNumber || null,
            sentAt: input.sentAt,
            sentBy: ctx.user.id,
            tibOutboundNumber: input.tibOutboundNumber || null,
            proofGallonsSent: proofGallonsSent !== null ? String(proofGallonsSent) : null,
            notes: input.notes || null,
            status: "sent",
          })
          .returning();

        results.push(record);

        // Deduct volume from source batch if requested
        if (input.deductFromBatch) {
          const newVolumeLiters = currentVolumeLiters - sourceVolumeLiters;
          await db
            .update(batches)
            .set({
              currentVolumeLiters: String(Math.max(0, newVolumeLiters)),
              currentVolume: String(Math.max(0, newVolumeLiters)),
              updatedAt: new Date(),
            })
            .where(eq(batches.id, batchInput.sourceBatchId));
        }
      }

      return {
        records: results,
        count: results.length,
      };
    }),

  /**
   * Send cider to distillery
   * Creates a distillation record and optionally reduces source batch volume
   */
  sendToDistillery: createRbacProcedure("create", "batch")
    .input(
      z.object({
        sourceBatchId: z.string().uuid(),
        sourceVolume: z.number().positive(),
        sourceVolumeUnit: z.enum(["L", "gal"]).default("L"),
        sourceAbv: z.number().min(0).max(100).optional(),
        distilleryName: z.string().min(1),
        distilleryAddress: z.string().optional(),
        distilleryPermitNumber: z.string().optional(),
        sentAt: z.union([z.date(), z.string().transform((val) => new Date(val))]),
        tibOutboundNumber: z.string().optional(),
        notes: z.string().optional(),
        deductFromBatch: z.boolean().default(true), // Whether to reduce batch volume
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify source batch exists and has volume
      const [sourceBatch] = await db
        .select()
        .from(batches)
        .where(and(eq(batches.id, input.sourceBatchId), isNull(batches.deletedAt)))
        .limit(1);

      if (!sourceBatch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source batch not found",
        });
      }

      // Convert volume to liters
      const sourceVolumeLiters = input.sourceVolumeUnit === "gal"
        ? input.sourceVolume * LITERS_PER_GALLON
        : input.sourceVolume;

      // Check if batch has enough volume
      const currentVolumeLiters = sourceBatch.currentVolumeLiters
        ? parseFloat(sourceBatch.currentVolumeLiters)
        : 0;

      if (input.deductFromBatch && sourceVolumeLiters > currentVolumeLiters) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Batch only has ${currentVolumeLiters.toFixed(1)}L available, cannot send ${sourceVolumeLiters.toFixed(1)}L`,
        });
      }

      // Calculate proof gallons if ABV is provided
      let proofGallonsSent: number | null = null;
      if (input.sourceAbv !== undefined) {
        proofGallonsSent = calculateProofGallons(sourceVolumeLiters, input.sourceAbv);
      }

      // Create distillation record
      const [record] = await db
        .insert(distillationRecords)
        .values({
          sourceBatchId: input.sourceBatchId,
          sourceVolume: String(input.sourceVolume),
          sourceVolumeUnit: input.sourceVolumeUnit,
          sourceVolumeLiters: String(sourceVolumeLiters),
          sourceAbv: input.sourceAbv !== undefined ? String(input.sourceAbv) : null,
          distilleryName: input.distilleryName,
          distilleryAddress: input.distilleryAddress || null,
          distilleryPermitNumber: input.distilleryPermitNumber || null,
          sentAt: input.sentAt,
          sentBy: ctx.user.id,
          tibOutboundNumber: input.tibOutboundNumber || null,
          proofGallonsSent: proofGallonsSent !== null ? String(proofGallonsSent) : null,
          notes: input.notes || null,
          status: "sent",
        })
        .returning();

      // Deduct volume from source batch if requested
      if (input.deductFromBatch) {
        const newVolumeLiters = currentVolumeLiters - sourceVolumeLiters;
        await db
          .update(batches)
          .set({
            currentVolumeLiters: String(Math.max(0, newVolumeLiters)),
            currentVolume: String(Math.max(0, newVolumeLiters)),
            updatedAt: new Date(),
          })
          .where(eq(batches.id, input.sourceBatchId));
      }

      return record;
    }),

  /**
   * Receive brandy back from distillery
   * Completes a distillation record and creates a new brandy batch
   */
  receiveBrandy: createRbacProcedure("create", "batch")
    .input(
      z.object({
        distillationRecordId: z.string().uuid(),
        receivedVolume: z.number().positive(),
        receivedVolumeUnit: z.enum(["L", "gal"]).default("L"),
        receivedAbv: z.number().min(0).max(100),
        receivedAt: z.union([z.date(), z.string().transform((val) => new Date(val))]),
        tibInboundNumber: z.string().optional(),
        destinationVesselId: z.string().uuid().optional(),
        notes: z.string().optional(),
        // New batch info
        brandyBatchName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get distillation record
      const [record] = await db
        .select()
        .from(distillationRecords)
        .where(and(
          eq(distillationRecords.id, input.distillationRecordId),
          isNull(distillationRecords.deletedAt)
        ))
        .limit(1);

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Distillation record not found",
        });
      }

      if (record.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Record is already ${record.status}`,
        });
      }

      // Get source batch for naming
      const [sourceBatch] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, record.sourceBatchId))
        .limit(1);

      // Convert volume to liters
      const receivedVolumeLiters = input.receivedVolumeUnit === "gal"
        ? input.receivedVolume * LITERS_PER_GALLON
        : input.receivedVolume;

      // Calculate proof gallons
      const proofGallonsReceived = calculateProofGallons(receivedVolumeLiters, input.receivedAbv);

      // Verify destination vessel if provided
      let vessel = null;
      if (input.destinationVesselId) {
        const [v] = await db
          .select()
          .from(vessels)
          .where(and(eq(vessels.id, input.destinationVesselId), isNull(vessels.deletedAt)))
          .limit(1);

        if (!v) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Destination vessel not found",
          });
        }
        vessel = v;
      }

      // Generate batch name for brandy
      const batchName = input.brandyBatchName ||
        `Brandy-${sourceBatch?.batchNumber || "Unknown"}-${new Date().getFullYear()}`;

      // Generate unique batch number
      const batchNumber = `BR-${Date.now().toString(36).toUpperCase()}`;

      // Create brandy batch
      const [brandyBatch] = await db
        .insert(batches)
        .values({
          vesselId: input.destinationVesselId || null,
          name: batchName,
          batchNumber: batchNumber,
          initialVolume: String(input.receivedVolume),
          initialVolumeUnit: input.receivedVolumeUnit,
          initialVolumeLiters: String(receivedVolumeLiters),
          currentVolume: String(input.receivedVolume),
          currentVolumeUnit: input.receivedVolumeUnit,
          currentVolumeLiters: String(receivedVolumeLiters),
          status: "aging", // Brandy typically goes into aging
          productType: "brandy",
          actualAbv: String(input.receivedAbv),
          startDate: input.receivedAt,
        })
        .returning();

      // Update distillation record
      const combinedNotes = [record.notes, input.notes].filter(Boolean).join("\n");

      await db
        .update(distillationRecords)
        .set({
          resultBatchId: brandyBatch.id,
          receivedVolume: String(input.receivedVolume),
          receivedVolumeUnit: input.receivedVolumeUnit,
          receivedVolumeLiters: String(receivedVolumeLiters),
          receivedAbv: String(input.receivedAbv),
          receivedAt: input.receivedAt,
          receivedBy: ctx.user.id,
          tibInboundNumber: input.tibInboundNumber || null,
          proofGallonsReceived: String(proofGallonsReceived),
          status: "received",
          notes: combinedNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(distillationRecords.id, input.distillationRecordId));

      return {
        distillationRecord: record,
        brandyBatch,
        proofGallonsReceived,
      };
    }),

  /**
   * Receive brandy from multiple cider batches combined into one brandy batch
   * This handles the case where a distillery combines multiple cider batches into a single distillation run
   */
  receiveMultipleBrandy: createRbacProcedure("create", "batch")
    .input(
      z.object({
        distillationRecordIds: z.array(z.string().uuid()).min(1),
        receivedVolume: z.number().positive(),
        receivedVolumeUnit: z.enum(["L", "gal"]).default("L"),
        receivedAbv: z.number().min(0).max(100),
        receivedAt: z.union([z.date(), z.string().transform((val) => new Date(val))]),
        tibInboundNumber: z.string().optional(),
        destinationVesselId: z.string().uuid().optional(),
        notes: z.string().optional(),
        brandyBatchName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get all distillation records
      const records = await db
        .select()
        .from(distillationRecords)
        .where(and(
          inArray(distillationRecords.id, input.distillationRecordIds),
          isNull(distillationRecords.deletedAt)
        ));

      if (records.length !== input.distillationRecordIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Some distillation records not found. Expected ${input.distillationRecordIds.length}, found ${records.length}`,
        });
      }

      // Verify all records are in 'sent' status
      const notSentRecords = records.filter((r) => r.status !== "sent");
      if (notSentRecords.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Some records are not in 'sent' status: ${notSentRecords.map((r) => r.sourceBatchId).join(", ")}`,
        });
      }

      // Get source batches for naming
      const sourceBatchIds = records.map((r) => r.sourceBatchId);
      const sourceBatches = await db
        .select()
        .from(batches)
        .where(inArray(batches.id, sourceBatchIds));

      // Calculate totals from source records
      const totalSourceVolumeLiters = records.reduce((sum, r) => {
        return sum + parseFloat(r.sourceVolumeLiters || "0");
      }, 0);

      const totalProofGallonsSent = records.reduce((sum, r) => {
        return sum + parseFloat(r.proofGallonsSent || "0");
      }, 0);

      // Convert received volume to liters
      const receivedVolumeLiters = input.receivedVolumeUnit === "gal"
        ? input.receivedVolume * LITERS_PER_GALLON
        : input.receivedVolume;

      // Calculate proof gallons received
      const proofGallonsReceived = calculateProofGallons(receivedVolumeLiters, input.receivedAbv);

      // Verify destination vessel if provided
      if (input.destinationVesselId) {
        const [vessel] = await db
          .select()
          .from(vessels)
          .where(and(eq(vessels.id, input.destinationVesselId), isNull(vessels.deletedAt)))
          .limit(1);

        if (!vessel) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Destination vessel not found",
          });
        }
      }

      // Generate batch name for brandy
      const sourceNames = sourceBatches.map((b) => b.customName || b.batchNumber).slice(0, 3);
      const batchName = input.brandyBatchName ||
        `Brandy-Combined-${sourceNames.join("-")}-${new Date().getFullYear()}`;

      // Generate unique batch number
      const batchNumber = `BR-${Date.now().toString(36).toUpperCase()}`;

      // Create brandy batch
      const [brandyBatch] = await db
        .insert(batches)
        .values({
          vesselId: input.destinationVesselId || null,
          name: batchName,
          batchNumber: batchNumber,
          initialVolume: String(input.receivedVolume),
          initialVolumeUnit: input.receivedVolumeUnit,
          initialVolumeLiters: String(receivedVolumeLiters),
          currentVolume: String(input.receivedVolume),
          currentVolumeUnit: input.receivedVolumeUnit,
          currentVolumeLiters: String(receivedVolumeLiters),
          status: "aging",
          productType: "brandy",
          actualAbv: String(input.receivedAbv),
          startDate: input.receivedAt,
        })
        .returning();

      // Update all distillation records to reference the same brandy batch
      // Distribute the received volume proportionally across records for tracking
      for (const record of records) {
        const recordSourceVolume = parseFloat(record.sourceVolumeLiters || "0");
        const proportion = totalSourceVolumeLiters > 0 ? recordSourceVolume / totalSourceVolumeLiters : 1 / records.length;

        const recordReceivedVolumeLiters = receivedVolumeLiters * proportion;
        const recordReceivedVolume = input.receivedVolumeUnit === "gal"
          ? recordReceivedVolumeLiters / LITERS_PER_GALLON
          : recordReceivedVolumeLiters;
        const recordProofGallons = proofGallonsReceived * proportion;

        const combinedNotes = [record.notes, input.notes].filter(Boolean).join("\n");

        await db
          .update(distillationRecords)
          .set({
            resultBatchId: brandyBatch.id,
            receivedVolume: String(recordReceivedVolume),
            receivedVolumeUnit: input.receivedVolumeUnit,
            receivedVolumeLiters: String(recordReceivedVolumeLiters),
            receivedAbv: String(input.receivedAbv),
            receivedAt: input.receivedAt,
            receivedBy: ctx.user.id,
            tibInboundNumber: input.tibInboundNumber || null,
            proofGallonsReceived: String(recordProofGallons),
            status: "received",
            notes: combinedNotes || null,
            updatedAt: new Date(),
          })
          .where(eq(distillationRecords.id, record.id));
      }

      return {
        brandyBatch,
        proofGallonsReceived,
        recordsUpdated: records.length,
        totalSourceVolumeLiters,
        totalProofGallonsSent,
      };
    }),

  /**
   * Cancel a distillation record
   */
  cancel: createRbacProcedure("delete", "batch")
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [record] = await db
        .select()
        .from(distillationRecords)
        .where(and(
          eq(distillationRecords.id, input.id),
          isNull(distillationRecords.deletedAt)
        ))
        .limit(1);

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Distillation record not found",
        });
      }

      if (record.status === "received") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel a completed distillation record",
        });
      }

      const notes = [record.notes, `Cancelled: ${input.reason || "No reason provided"}`]
        .filter(Boolean)
        .join("\n");

      await db
        .update(distillationRecords)
        .set({
          status: "cancelled",
          notes,
          updatedAt: new Date(),
        })
        .where(eq(distillationRecords.id, input.id));

      return { success: true };
    }),

  /**
   * List distillation records with optional filters
   */
  list: createRbacProcedure("list", "batch")
    .input(
      z.object({
        status: z.enum(["sent", "received", "cancelled"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { status, limit, offset } = input;

      const conditions = [isNull(distillationRecords.deletedAt)];
      if (status) {
        conditions.push(eq(distillationRecords.status, status));
      }

      const records = await db
        .select({
          id: distillationRecords.id,
          sourceBatchId: distillationRecords.sourceBatchId,
          sourceBatchName: batches.name,
          sourceBatchNumber: batches.batchNumber,
          sourceVolume: distillationRecords.sourceVolume,
          sourceVolumeUnit: distillationRecords.sourceVolumeUnit,
          sourceAbv: distillationRecords.sourceAbv,
          distilleryName: distillationRecords.distilleryName,
          distilleryPermitNumber: distillationRecords.distilleryPermitNumber,
          sentAt: distillationRecords.sentAt,
          tibOutboundNumber: distillationRecords.tibOutboundNumber,
          resultBatchId: distillationRecords.resultBatchId,
          receivedVolume: distillationRecords.receivedVolume,
          receivedVolumeUnit: distillationRecords.receivedVolumeUnit,
          receivedAbv: distillationRecords.receivedAbv,
          receivedAt: distillationRecords.receivedAt,
          tibInboundNumber: distillationRecords.tibInboundNumber,
          proofGallonsSent: distillationRecords.proofGallonsSent,
          proofGallonsReceived: distillationRecords.proofGallonsReceived,
          status: distillationRecords.status,
          notes: distillationRecords.notes,
          createdAt: distillationRecords.createdAt,
        })
        .from(distillationRecords)
        .leftJoin(batches, eq(distillationRecords.sourceBatchId, batches.id))
        .where(and(...conditions))
        .orderBy(desc(distillationRecords.sentAt))
        .limit(limit)
        .offset(offset);

      return records;
    }),

  /**
   * Get a single distillation record by ID
   */
  getById: createRbacProcedure("list", "batch")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [record] = await db
        .select({
          id: distillationRecords.id,
          sourceBatchId: distillationRecords.sourceBatchId,
          sourceVolume: distillationRecords.sourceVolume,
          sourceVolumeUnit: distillationRecords.sourceVolumeUnit,
          sourceVolumeLiters: distillationRecords.sourceVolumeLiters,
          sourceAbv: distillationRecords.sourceAbv,
          distilleryName: distillationRecords.distilleryName,
          distilleryAddress: distillationRecords.distilleryAddress,
          distilleryPermitNumber: distillationRecords.distilleryPermitNumber,
          sentAt: distillationRecords.sentAt,
          tibOutboundNumber: distillationRecords.tibOutboundNumber,
          resultBatchId: distillationRecords.resultBatchId,
          receivedVolume: distillationRecords.receivedVolume,
          receivedVolumeUnit: distillationRecords.receivedVolumeUnit,
          receivedVolumeLiters: distillationRecords.receivedVolumeLiters,
          receivedAbv: distillationRecords.receivedAbv,
          receivedAt: distillationRecords.receivedAt,
          tibInboundNumber: distillationRecords.tibInboundNumber,
          proofGallonsSent: distillationRecords.proofGallonsSent,
          proofGallonsReceived: distillationRecords.proofGallonsReceived,
          status: distillationRecords.status,
          notes: distillationRecords.notes,
          createdAt: distillationRecords.createdAt,
          updatedAt: distillationRecords.updatedAt,
        })
        .from(distillationRecords)
        .where(and(
          eq(distillationRecords.id, input.id),
          isNull(distillationRecords.deletedAt)
        ))
        .limit(1);

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Distillation record not found",
        });
      }

      // Get source batch details
      const [sourceBatch] = await db
        .select({
          id: batches.id,
          name: batches.name,
          batchNumber: batches.batchNumber,
          productType: batches.productType,
        })
        .from(batches)
        .where(eq(batches.id, record.sourceBatchId))
        .limit(1);

      // Get result batch details if exists
      let resultBatch = null;
      if (record.resultBatchId) {
        const [rb] = await db
          .select({
            id: batches.id,
            name: batches.name,
            batchNumber: batches.batchNumber,
            productType: batches.productType,
            actualAbv: batches.actualAbv,
          })
          .from(batches)
          .where(eq(batches.id, record.resultBatchId))
          .limit(1);
        resultBatch = rb;
      }

      // Calculate loss if both proof gallons are available
      let lossPercent = null;
      if (record.proofGallonsSent && record.proofGallonsReceived) {
        lossPercent = calculateDistillationLoss(
          parseFloat(record.proofGallonsSent),
          parseFloat(record.proofGallonsReceived)
        );
      }

      return {
        ...record,
        sourceBatch,
        resultBatch,
        lossPercent,
      };
    }),

  /**
   * Get unique distilleries from past records for auto-complete
   */
  getDistilleries: createRbacProcedure("list", "batch").query(async () => {
    const distilleries = await db
      .selectDistinct({
        name: distillationRecords.distilleryName,
        address: distillationRecords.distilleryAddress,
        permitNumber: distillationRecords.distilleryPermitNumber,
      })
      .from(distillationRecords)
      .where(isNull(distillationRecords.deletedAt))
      .orderBy(distillationRecords.distilleryName);

    return distilleries;
  }),

  /**
   * Get summary stats for distillation operations
   */
  getStats: createRbacProcedure("list", "batch").query(async () => {
    const [stats] = await db
      .select({
        totalRecords: sql<number>`COUNT(*)::int`,
        pendingRecords: sql<number>`COUNT(*) FILTER (WHERE ${distillationRecords.status} = 'sent')::int`,
        completedRecords: sql<number>`COUNT(*) FILTER (WHERE ${distillationRecords.status} = 'received')::int`,
        totalProofGallonsSent: sql<number>`COALESCE(SUM(${distillationRecords.proofGallonsSent}::numeric), 0)::float`,
        totalProofGallonsReceived: sql<number>`COALESCE(SUM(${distillationRecords.proofGallonsReceived}::numeric), 0)::float`,
      })
      .from(distillationRecords)
      .where(isNull(distillationRecords.deletedAt));

    return stats || {
      totalRecords: 0,
      pendingRecords: 0,
      completedRecords: 0,
      totalProofGallonsSent: 0,
      totalProofGallonsReceived: 0,
    };
  }),

  /**
   * Create a pommeau/fortified blend from cider/juice and brandy
   * Creates a new pommeau batch and optionally deducts from source batches
   */
  createPommeau: createRbacProcedure("create", "batch")
    .input(
      z.object({
        name: z.string().optional(),
        // Cider/juice source - either provide a batch or manual entry
        ciderBatchId: z.string().uuid().optional(),
        juiceVolumeLiters: z.number().positive(),
        juiceAbv: z.number().min(0).max(100).default(0),
        deductFromCider: z.boolean().default(true),
        // Brandy source
        brandyBatchId: z.string().uuid(),
        brandyVolumeLiters: z.number().positive(),
        deductFromBrandy: z.boolean().default(true),
        // Destination
        destinationVesselId: z.string().uuid().optional(),
        blendDate: z.union([z.date(), z.string().transform((val) => new Date(val))]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Get cider batch if provided to verify and get ABV
      let ciderBatch = null;
      let ciderAbv = input.juiceAbv;
      let currentCiderVolume = 0;
      let ciderSg: number | null = null;
      let ciderPh: number | null = null;

      if (input.ciderBatchId) {
        const [batch] = await db
          .select()
          .from(batches)
          .where(and(eq(batches.id, input.ciderBatchId), isNull(batches.deletedAt)))
          .limit(1);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cider batch not found",
          });
        }

        ciderBatch = batch;
        ciderAbv = batch.actualAbv ? parseFloat(batch.actualAbv) :
                   batch.estimatedAbv ? parseFloat(batch.estimatedAbv) : input.juiceAbv;
        currentCiderVolume = batch.currentVolumeLiters ? parseFloat(batch.currentVolumeLiters) : 0;

        // Get cider's latest SG and pH from measurements
        const ciderMeasurements = await db
          .select({
            specificGravity: batchMeasurements.specificGravity,
            ph: batchMeasurements.ph,
          })
          .from(batchMeasurements)
          .where(and(
            eq(batchMeasurements.batchId, input.ciderBatchId),
            isNull(batchMeasurements.deletedAt)
          ))
          .orderBy(desc(batchMeasurements.measurementDate))
          .limit(10);

        // Get most recent non-null values
        for (const m of ciderMeasurements) {
          if (ciderSg === null && m.specificGravity) {
            ciderSg = parseFloat(m.specificGravity);
          }
          if (ciderPh === null && m.ph) {
            ciderPh = parseFloat(m.ph);
          }
          if (ciderSg !== null && ciderPh !== null) break;
        }

        // Check cider has enough volume
        if (input.deductFromCider && input.juiceVolumeLiters > currentCiderVolume) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cider batch only has ${currentCiderVolume.toFixed(1)}L available`,
          });
        }
      }

      // Get brandy batch to verify and get ABV
      const [brandyBatch] = await db
        .select()
        .from(batches)
        .where(and(eq(batches.id, input.brandyBatchId), isNull(batches.deletedAt)))
        .limit(1);

      if (!brandyBatch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brandy batch not found",
        });
      }

      const brandyAbv = brandyBatch.actualAbv ? parseFloat(brandyBatch.actualAbv) : 60;
      const currentBrandyVolume = brandyBatch.currentVolumeLiters
        ? parseFloat(brandyBatch.currentVolumeLiters)
        : 0;

      // Check brandy has enough volume
      if (input.deductFromBrandy && input.brandyVolumeLiters > currentBrandyVolume) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Brandy batch only has ${currentBrandyVolume.toFixed(1)}L available`,
        });
      }

      // Calculate blend ABV (use ciderAbv which may come from batch or manual input)
      const totalVolume = input.juiceVolumeLiters + input.brandyVolumeLiters;
      const totalAlcohol =
        input.juiceVolumeLiters * ciderAbv +
        input.brandyVolumeLiters * brandyAbv;
      const resultingAbv = Math.round((totalAlcohol / totalVolume) * 100) / 100;

      // Generate batch name and number using BR- format (same as brandy/transfer-created pommeau)
      const timestamp = Date.now().toString(36).toUpperCase();
      const shortCode = timestamp.slice(-8);
      const batchNumber = `BR-${shortCode}-Tmk${timestamp.slice(-5).toLowerCase()}`;
      const batchName = input.name || `Batch #${batchNumber}`;

      // Verify destination vessel if provided
      if (input.destinationVesselId) {
        const [vessel] = await db
          .select()
          .from(vessels)
          .where(and(eq(vessels.id, input.destinationVesselId), isNull(vessels.deletedAt)))
          .limit(1);

        if (!vessel) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Destination vessel not found",
          });
        }
      }

      // Calculate blended SG and pH for the pommeau
      // Brandy SG is estimated from ABV: pure ethanol SG ~0.789, water SG ~1.0
      // Approximation: SG ≈ 1 - (ABV/100 * 0.21) for spirits
      const brandySg = 1 - (brandyAbv / 100 * 0.21);

      // Calculate weighted average SG if we have cider SG
      let blendedSg: number | null = null;
      if (ciderSg !== null) {
        blendedSg = (ciderSg * input.juiceVolumeLiters + brandySg * input.brandyVolumeLiters) / totalVolume;
      }

      // Calculate blended pH using logarithmic blending (pH is logarithmic scale)
      // pH = -log10[H+], so we must blend H+ concentrations, not pH values directly
      const brandyPh = 6.5; // Brandy is relatively neutral
      let blendedPh: number | null = null;
      if (ciderPh !== null) {
        const ciderH = Math.pow(10, -ciderPh);
        const brandyH = Math.pow(10, -brandyPh);
        const blendedH = (ciderH * input.juiceVolumeLiters + brandyH * input.brandyVolumeLiters) / totalVolume;
        blendedPh = -Math.log10(blendedH);
      }

      // Create pommeau batch
      // Note: batches table doesn't have a notes field, so blend info is stored in the batch name/customName

      const [pommeauBatch] = await db
        .insert(batches)
        .values({
          vesselId: input.destinationVesselId || null,
          name: batchName,
          customName: input.notes || null,
          batchNumber: batchNumber,
          initialVolume: String(totalVolume),
          initialVolumeUnit: "L",
          initialVolumeLiters: String(totalVolume),
          currentVolume: String(totalVolume),
          currentVolumeUnit: "L",
          currentVolumeLiters: String(totalVolume),
          status: "aging",
          productType: "pommeau",
          fermentationStage: "not_applicable", // Pommeau doesn't ferment
          fermentationStageUpdatedAt: new Date(),
          estimatedAbv: String(resultingAbv), // Use estimatedAbv since it's calculated, not measured
          startDate: input.blendDate,
        })
        .returning();

      // Create initial measurement with blended SG and pH
      if (blendedSg !== null || blendedPh !== null) {
        await db.insert(batchMeasurements).values({
          batchId: pommeauBatch.id,
          measurementDate: input.blendDate,
          specificGravity: blendedSg !== null ? String(blendedSg.toFixed(4)) : null,
          ph: blendedPh !== null ? String(blendedPh.toFixed(2)) : null,
          isEstimated: true,
          estimateSource: "blend_calculation",
          notes: `Estimated from blend components. Cider: ${input.juiceVolumeLiters}L${ciderSg ? ` (SG ${ciderSg.toFixed(4)})` : ""}${ciderPh ? ` (pH ${ciderPh.toFixed(2)})` : ""}, Brandy: ${input.brandyVolumeLiters}L (${brandyAbv}% ABV, est. SG ${brandySg.toFixed(2)}). For accurate ABV, use ebulliometer or lab analysis.`,
        });
      }

      // Create batch_merge_history entry to track the brandy addition
      await db.insert(batchMergeHistory).values({
        targetBatchId: pommeauBatch.id,
        sourceBatchId: input.brandyBatchId,
        sourceType: "batch",
        volumeAdded: String(input.brandyVolumeLiters),
        volumeAddedUnit: "L",
        targetVolumeBefore: String(input.juiceVolumeLiters),
        targetVolumeBeforeUnit: "L",
        targetVolumeAfter: String(totalVolume),
        targetVolumeAfterUnit: "L",
        sourceAbv: String(brandyAbv),
        resultingAbv: String(resultingAbv),
        compositionSnapshot: {
          brandy: {
            batchId: input.brandyBatchId,
            name: brandyBatch.name,
            volume: input.brandyVolumeLiters,
            abv: brandyAbv,
          },
          cider: input.ciderBatchId
            ? {
                batchId: input.ciderBatchId,
                name: ciderBatch?.name,
                volume: input.juiceVolumeLiters,
                abv: ciderAbv,
              }
            : {
                source: "manual",
                volume: input.juiceVolumeLiters,
                abv: ciderAbv,
              },
        },
        notes: input.notes || "Pommeau blend created",
        mergedAt: input.blendDate,
      });

      // Deduct from brandy batch if requested
      if (input.deductFromBrandy) {
        const newBrandyVolume = currentBrandyVolume - input.brandyVolumeLiters;
        await db
          .update(batches)
          .set({
            currentVolumeLiters: String(Math.max(0, newBrandyVolume)),
            currentVolume: String(Math.max(0, newBrandyVolume)),
            updatedAt: new Date(),
          })
          .where(eq(batches.id, input.brandyBatchId));
      }

      // Deduct from cider batch if provided and requested
      if (input.ciderBatchId && input.deductFromCider && ciderBatch) {
        const newCiderVolume = currentCiderVolume - input.juiceVolumeLiters;
        await db
          .update(batches)
          .set({
            currentVolumeLiters: String(Math.max(0, newCiderVolume)),
            currentVolume: String(Math.max(0, newCiderVolume)),
            updatedAt: new Date(),
          })
          .where(eq(batches.id, input.ciderBatchId));
      }

      return {
        pommeauBatch,
        resultingAbv,
        brandyAbv,
        ciderAbv,
      };
    }),
});
