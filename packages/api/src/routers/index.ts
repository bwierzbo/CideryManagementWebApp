import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  createRbacProcedure,
} from "../trpc";
import { auditRouter } from "./audit";
import { batchRouter } from "./batch";
import { healthRouter } from "./health";
import { inventoryRouter } from "./inventory";
import { invoiceNumberRouter } from "./invoiceNumber";
import { pressRunRouter } from "./pressRun";
import { reportsRouter } from "./reports";
import { varietiesRouter } from "./varieties";
import { vendorRouter } from "./vendor";
import { vendorVarietyRouter } from "./vendorVariety";
import { additivePurchasesRouter } from "./additivePurchases";
import { baseFruitPurchasesRouter } from "./baseFruitPurchases";
import { juicePurchasesRouter } from "./juicePurchases";
import { packagingPurchasesRouter } from "./packagingPurchases";
import { additiveVarietiesRouter } from "./additiveVarieties";
import { juiceVarietiesRouter } from "./juiceVarieties";
import { packagingVarietiesRouter } from "./packagingVarieties";
import { packagingRouter } from "./packaging";
import { userRouter } from "./user";
import {
  db,
  vendors,
  basefruitPurchases,
  basefruitPurchaseItems,
  additivePurchases,
  additivePurchaseItems,
  juicePurchases,
  juicePurchaseItems,
  packagingPurchases,
  packagingPurchaseItems,
  pressRuns,
  pressItems,
  batches,
  batchCompositions,
  batchMeasurements,
  batchTransfers,
  packages,
  inventory,
  inventoryTransactions,
  vessels,
  baseFruitVarieties,
  auditLog,
  applePressRuns,
  applePressRunLoads,
  users,
} from "db";
import {
  eq,
  and,
  desc,
  asc,
  sql,
  isNull,
  ne,
  or,
  aliasedTable,
  inArray,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { convertVolume, roundToDecimals } from "lib/src/utils/volumeConversion";
import {
  publishCreateEvent,
  publishUpdateEvent,
  publishDeleteEvent,
  bushelsToKg,
} from "lib";

export const appRouter = router({
  // Basic health check
  ping: publicProcedure.query(() => {
    return { ok: true };
  }),

  // Protected procedure that requires authentication
  profile: protectedProcedure.query(({ ctx }) => {
    return {
      user: ctx.session?.user,
      message: "This is a protected route",
    };
  }),

  // Admin-only procedure
  adminInfo: adminProcedure.query(({ ctx }) => {
    return {
      user: ctx.session?.user,
      message: "This is an admin-only route",
      timestamp: new Date().toISOString(),
    };
  }),

  // User management
  user: userRouter,

  // Vendor management with proper RBAC and audit logging
  vendor: vendorRouter,

  // DEPRECATED: Old inline vendor router - keeping temporarily for reference
  vendorOld: router({
    list: publicProcedure.query(async () => {
      try {
        const vendorList = await db
          .select()
          .from(vendors)
          .where(eq(vendors.isActive, true))
          .orderBy(vendors.name);

        return {
          vendors: vendorList,
          count: vendorList.length,
        };
      } catch (error) {
        console.error("Error listing vendors:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list vendors",
        });
      }
    }),

    create: createRbacProcedure("create", "vendor")
      .input(
        z.object({
          name: z.string().min(1, "Name is required"),
          contactEmail: z.string().email().optional().or(z.literal("")),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Build contactInfo object
          const contactInfo: any = {};
          if (input.contactEmail) contactInfo.email = input.contactEmail;
          if (input.contactPhone) contactInfo.phone = input.contactPhone;
          if (input.address) contactInfo.address = input.address;

          const newVendor = await db
            .insert(vendors)
            .values({
              name: input.name,
              contactInfo:
                Object.keys(contactInfo).length > 0 ? contactInfo : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Audit logging
          await db.insert(auditLog).values({
            tableName: "vendors",
            recordId: newVendor[0].id,
            operation: "create",
            newData: { vendorId: newVendor[0].id, vendorName: input.name },
            changedBy: ctx.session?.user?.id,
          });

          return {
            success: true,
            vendor: newVendor[0],
            message: `Vendor "${input.name}" created successfully`,
          };
        } catch (error) {
          console.error("Error creating vendor:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create vendor",
          });
        }
      }),

    delete: createRbacProcedure("delete", "vendor")
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await db
            .select()
            .from(vendors)
            .where(eq(vendors.id, input.id))
            .limit(1);

          if (!existing.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vendor not found",
            });
          }

          const deletedVendor = await db
            .update(vendors)
            .set({
              isActive: false,
              updatedAt: new Date(),
            })
            .where(eq(vendors.id, input.id))
            .returning();

          // Audit logging
          await db.insert(auditLog).values({
            tableName: "vendors",
            recordId: input.id,
            operation: "delete",
            oldData: existing[0],
            newData: { isActive: false },
            changedBy: ctx.session?.user?.id,
          });

          return {
            success: true,
            message: `Vendor "${existing[0].name}" deleted successfully`,
            vendor: deletedVendor[0],
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error deleting vendor:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete vendor",
          });
        }
      }),

    update: createRbacProcedure("update", "vendor")
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1, "Name is required"),
          contactEmail: z.string().email().optional().or(z.literal("")),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await db
            .select()
            .from(vendors)
            .where(eq(vendors.id, input.id))
            .limit(1);

          if (!existing.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vendor not found",
            });
          }

          // Build contactInfo object
          const contactInfo: any = {};
          if (input.contactEmail) contactInfo.email = input.contactEmail;
          if (input.contactPhone) contactInfo.phone = input.contactPhone;
          if (input.address) contactInfo.address = input.address;

          const updatedVendor = await db
            .update(vendors)
            .set({
              name: input.name,
              contactInfo:
                Object.keys(contactInfo).length > 0 ? contactInfo : null,
              updatedAt: new Date(),
            })
            .where(eq(vendors.id, input.id))
            .returning();

          // Audit logging
          await db.insert(auditLog).values({
            tableName: "vendors",
            recordId: input.id,
            operation: "update",
            oldData: existing[0],
            newData: { name: input.name, contactInfo },
            changedBy: ctx.session?.user?.id,
          });

          return {
            success: true,
            vendor: updatedVendor[0],
            message: `Vendor "${input.name}" updated successfully`,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error updating vendor:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update vendor",
          });
        }
      }),
  }),

  // Purchase management
  purchase: router({
    list: createRbacProcedure("list", "purchase")
      .input(
        z.object({
          vendorId: z.string().uuid().optional(),
          startDate: z
            .date()
            .or(z.string().transform((val) => new Date(val)))
            .optional(),
          endDate: z
            .date()
            .or(z.string().transform((val) => new Date(val)))
            .optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          sortBy: z
            .enum(["purchaseDate", "vendorName", "totalCost", "createdAt"])
            .default("purchaseDate"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
        }),
      )
      .query(async ({ input }) => {
        try {
          // Build WHERE conditions
          const conditions = [isNull(basefruitPurchases.deletedAt)];

          if (input.vendorId) {
            conditions.push(eq(basefruitPurchases.vendorId, input.vendorId));
          }

          if (input.startDate) {
            conditions.push(
              sql`${basefruitPurchases.purchaseDate} >= ${input.startDate.toISOString().split("T")[0]}`,
            );
          }

          if (input.endDate) {
            conditions.push(
              sql`${basefruitPurchases.purchaseDate} <= ${input.endDate.toISOString().split("T")[0]}`,
            );
          }

          // Build ORDER BY clause
          const sortColumn = {
            purchaseDate: basefruitPurchases.purchaseDate,
            vendorName: vendors.name,
            totalCost: basefruitPurchases.totalCost,
            createdAt: basefruitPurchases.createdAt,
          }[input.sortBy];

          const orderBy =
            input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

          // Get basefruitPurchases with pagination
          const purchaseList = await db
            .select({
              id: basefruitPurchases.id,
              vendorId: basefruitPurchases.vendorId,
              vendorName: vendors.name,
              purchaseDate: basefruitPurchases.purchaseDate,
              invoiceNumber: basefruitPurchases.invoiceNumber,
              totalCost: basefruitPurchases.totalCost,
              notes: basefruitPurchases.notes,
              createdAt: basefruitPurchases.createdAt,
            })
            .from(basefruitPurchases)
            .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .where(and(...conditions))
            .orderBy(orderBy, desc(basefruitPurchases.createdAt))
            .limit(input.limit)
            .offset(input.offset);

          // Get total count for pagination
          const totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(basefruitPurchases)
            .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .where(and(...conditions));

          const totalCount = totalCountResult[0]?.count || 0;

          // Get purchase items for each purchase to create item summary
          const basefruitPurchasesWithItems = await Promise.all(
            purchaseList.map(async (purchase) => {
              const items = await db
                .select({
                  id: basefruitPurchaseItems.id,
                  fruitVarietyId: basefruitPurchaseItems.fruitVarietyId,
                  varietyName: baseFruitVarieties.name,
                  originalQuantity: basefruitPurchaseItems.originalQuantity,
                  originalUnit: basefruitPurchaseItems.originalUnit,
                })
                .from(basefruitPurchaseItems)
                .leftJoin(
                  baseFruitVarieties,
                  eq(
                    basefruitPurchaseItems.fruitVarietyId,
                    baseFruitVarieties.id,
                  ),
                )
                .where(eq(basefruitPurchaseItems.purchaseId, purchase.id));

              const itemsSummary = items
                .map(
                  (item) =>
                    `${item.originalQuantity} ${item.originalUnit} ${item.varietyName}`,
                )
                .join(", ");

              return {
                ...purchase,
                itemsSummary,
                itemCount: items.length,
              };
            }),
          );

          return {
            basefruitPurchases: basefruitPurchasesWithItems,
            pagination: {
              total: totalCount,
              limit: input.limit,
              offset: input.offset,
              hasMore:
                input.offset + basefruitPurchasesWithItems.length < totalCount,
            },
            count: basefruitPurchasesWithItems.length,
          };
        } catch (error) {
          console.error("Error listing basefruitPurchases:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to list basefruitPurchases",
          });
        }
      }),

    create: createRbacProcedure("create", "purchase")
      .input(
        z.object({
          vendorId: z.string().uuid("Invalid vendor ID"),
          purchaseDate: z
            .date()
            .or(z.string().transform((val) => new Date(val))),
          invoiceNumber: z.string().optional(),
          notes: z.string().optional(),
          items: z
            .array(
              z.object({
                fruitVarietyId: z.string().uuid("Invalid apple variety ID"),
                quantity: z.number().positive("Quantity must be positive"),
                unit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
                pricePerUnit: z
                  .number()
                  .positive("Price per unit must be positive")
                  .optional(),
                harvestDate: z
                  .date()
                  .or(z.string().transform((val) => new Date(val)))
                  .optional(),
                notes: z.string().optional(),
              }),
            )
            .min(1, "At least one item is required"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // TODO: Re-enable vendor-variety validation after fixing imports
            // Validate vendor-variety relationships for all items
            // for (const item of input.items) {
            //   const isValidVariety = await ensureVendorVariety(input.vendorId, item.fruitVarietyId)
            //   if (!isValidVariety) {
            //     throw new TRPCError({
            //       code: 'BAD_REQUEST',
            //       message: 'This vendor is not configured for the selected variety. Please link the variety to the vendor first.'
            //     })
            //   }
            // }

            // Calculate total cost and convert units
            let totalCost = 0;
            const processedItems = [];

            for (const item of input.items) {
              // Handle nullable pricePerUnit for free apples
              const itemTotal = item.pricePerUnit
                ? item.quantity * item.pricePerUnit
                : 0;
              totalCost += itemTotal;

              // Store original values for traceability
              const originalUnit = item.unit;
              const originalQuantity = item.quantity;

              // Convert to canonical units (kg for weight, L for volume)
              let quantityKg: number | null = null;
              let quantityL: number | null = null;

              if (item.unit === "kg") {
                quantityKg = item.quantity;
              } else if (item.unit === "lb") {
                quantityKg = item.quantity * 0.453592; // lb to kg
              } else if (item.unit === "bushel") {
                quantityKg = bushelsToKg(item.quantity); // bushel to kg using utility
              } else if (item.unit === "L") {
                quantityL = item.quantity;
              } else if (item.unit === "gal") {
                quantityL = item.quantity * 3.78541; // gal to L
              }

              processedItems.push({
                ...item,
                totalCost: itemTotal,
                quantityKg,
                quantityL,
                originalUnit,
                originalQuantity,
              });
            }

            // Auto-generate invoice number if not provided
            let finalInvoiceNumber = input.invoiceNumber;
            let autoGenerated = false;

            if (!input.invoiceNumber) {
              // Generate invoice number using the same logic as invoiceNumber router
              const dateStr = input.purchaseDate
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "");
              const startOfDay = new Date(input.purchaseDate);
              startOfDay.setHours(0, 0, 0, 0);
              const endOfDay = new Date(input.purchaseDate);
              endOfDay.setHours(23, 59, 59, 999);

              const maxSequenceResult = await tx
                .select({
                  maxInvoice: sql<string>`MAX(${basefruitPurchases.invoiceNumber})`,
                })
                .from(basefruitPurchases)
                .where(
                  and(
                    eq(basefruitPurchases.vendorId, input.vendorId),
                    sql`${basefruitPurchases.purchaseDate} >= ${startOfDay}`,
                    sql`${basefruitPurchases.purchaseDate} <= ${endOfDay}`,
                    eq(basefruitPurchases.autoGeneratedInvoice, true),
                    sql`${basefruitPurchases.invoiceNumber} LIKE ${`${dateStr}-${input.vendorId}-%`}`,
                  ),
                );

              let nextSequence = 1;
              if (maxSequenceResult[0]?.maxInvoice) {
                const parts = maxSequenceResult[0].maxInvoice.split("-");
                if (parts.length >= 7) {
                  // Date + UUID (5 parts) + sequence = 7 parts minimum
                  const sequencePart = parts[parts.length - 1];
                  const currentSeq = parseInt(sequencePart, 10);
                  if (!isNaN(currentSeq)) {
                    nextSequence = currentSeq + 1;
                  }
                }
              }

              const paddedSequence = nextSequence.toString().padStart(3, "0");
              finalInvoiceNumber = `${dateStr}-${input.vendorId}-${paddedSequence}`;
              autoGenerated = true;

              // Verify uniqueness
              const existingInvoice = await tx
                .select({ id: basefruitPurchases.id })
                .from(basefruitPurchases)
                .where(eq(basefruitPurchases.invoiceNumber, finalInvoiceNumber))
                .limit(1);

              if (existingInvoice.length > 0) {
                const retrySequence = (nextSequence + 1)
                  .toString()
                  .padStart(3, "0");
                finalInvoiceNumber = `${dateStr}-${input.vendorId}-${retrySequence}`;
              }
            }

            // Create the purchase
            const newPurchase = await tx
              .insert(basefruitPurchases)
              .values({
                vendorId: input.vendorId,
                purchaseDate: input.purchaseDate,
                totalCost: totalCost.toString(),
                invoiceNumber: finalInvoiceNumber,
                autoGeneratedInvoice: autoGenerated,
                notes: input.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            const purchaseId = newPurchase[0].id;

            // Create purchase items
            const newItems = await tx
              .insert(basefruitPurchaseItems)
              .values(
                processedItems.map((item) => ({
                  purchaseId,
                  fruitVarietyId: item.fruitVarietyId,
                  quantity: item.quantity.toString(),
                  unit: item.unit,
                  pricePerUnit: item.pricePerUnit
                    ? item.pricePerUnit.toString()
                    : null,
                  totalCost:
                    item.totalCost > 0 ? item.totalCost.toString() : null,
                  quantityKg: item.quantityKg?.toString(),
                  quantityL: item.quantityL?.toString(),
                  harvestDate: item.harvestDate
                    ? item.harvestDate.toISOString().split("T")[0]
                    : null,
                  originalUnit: item.originalUnit,
                  originalQuantity: item.originalQuantity.toString(),
                  notes: item.notes,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })),
              )
              .returning();

            // Publish audit events
            await publishCreateEvent(
              "basefruitPurchases",
              purchaseId,
              {
                purchaseId,
                vendorId: input.vendorId,
                totalCost,
                itemCount: input.items.length,
              },
              ctx.session?.user?.id,
              "Purchase created via API",
            );

            for (const item of newItems) {
              await publishCreateEvent(
                "purchase_items",
                item.id,
                {
                  itemId: item.id,
                  purchaseId,
                  fruitVarietyId: item.fruitVarietyId,
                },
                ctx.session?.user?.id,
                "Purchase item created via API",
              );
            }

            return {
              success: true,
              purchase: newPurchase[0],
              items: newItems,
              message: `Purchase created with ${newItems.length} items`,
            };
          });
        } catch (error) {
          console.error("Error creating purchase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create purchase",
          });
        }
      }),

    getById: createRbacProcedure("read", "purchase")
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const purchase = await db
            .select()
            .from(basefruitPurchases)
            .where(
              and(
                eq(basefruitPurchases.id, input.id),
                isNull(basefruitPurchases.deletedAt),
              ),
            )
            .limit(1);

          if (!purchase.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Purchase not found",
            });
          }

          const items = await db
            .select()
            .from(basefruitPurchaseItems)
            .where(
              and(
                eq(basefruitPurchaseItems.purchaseId, input.id),
                isNull(basefruitPurchaseItems.deletedAt),
              ),
            );

          return {
            purchase: purchase[0],
            items,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error getting purchase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get purchase",
          });
        }
      }),

    update: createRbacProcedure("update", "purchase")
      .input(
        z.object({
          id: z.string().uuid(),
          vendorId: z.string().uuid("Invalid vendor ID").optional(),
          purchaseDate: z
            .date()
            .or(z.string().transform((val) => new Date(val)))
            .optional(),
          invoiceNumber: z.string().optional(),
          notes: z.string().optional(),
          items: z
            .array(
              z.object({
                id: z.string().uuid().optional(), // For existing items
                fruitVarietyId: z.string().uuid("Invalid apple variety ID"),
                quantity: z.number().positive("Quantity must be positive"),
                unit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
                pricePerUnit: z
                  .number()
                  .positive("Price per unit must be positive")
                  .optional(),
                harvestDate: z
                  .date()
                  .or(z.string().transform((val) => new Date(val)))
                  .optional(),
                notes: z.string().optional(),
              }),
            )
            .min(1, "At least one item is required")
            .optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const existingPurchase = await db
            .select()
            .from(basefruitPurchases)
            .where(
              and(
                eq(basefruitPurchases.id, input.id),
                isNull(basefruitPurchases.deletedAt),
              ),
            );

          if (!existingPurchase.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Purchase not found",
            });
          }

          return await db.transaction(async (tx) => {
            // Update purchase if fields provided
            if (
              input.vendorId ||
              input.purchaseDate ||
              input.invoiceNumber !== undefined ||
              input.notes !== undefined
            ) {
              const updateData: any = {};
              if (input.vendorId) updateData.vendorId = input.vendorId;
              if (input.purchaseDate)
                updateData.purchaseDate = input.purchaseDate;
              if (input.invoiceNumber !== undefined)
                updateData.invoiceNumber = input.invoiceNumber;
              if (input.notes !== undefined) updateData.notes = input.notes;

              await tx
                .update(basefruitPurchases)
                .set(updateData)
                .where(eq(basefruitPurchases.id, input.id));
            }

            // Update items if provided
            if (input.items) {
              // TODO: Re-enable vendor-variety validation after fixing imports
              // Validate vendor-variety relationships for all new items
              // const finalVendorId = input.vendorId || existingPurchase[0].vendorId
              // if (finalVendorId) {
              //   for (const item of input.items) {
              //     const isValidVariety = await ensureVendorVariety(finalVendorId, item.fruitVarietyId)
              //     if (!isValidVariety) {
              //       throw new TRPCError({
              //         code: 'BAD_REQUEST',
              //         message: 'This vendor is not configured for the selected variety. Please link the variety to the vendor first.'
              //       })
              //     }
              //   }
              // }

              // Remove existing items (soft delete)
              await tx
                .update(basefruitPurchaseItems)
                .set({ deletedAt: new Date() })
                .where(eq(basefruitPurchaseItems.purchaseId, input.id));

              // Add new/updated items
              const processedItems = [];
              let totalCost = 0;

              for (const item of input.items) {
                const itemTotal = item.pricePerUnit
                  ? item.quantity * item.pricePerUnit
                  : 0;
                totalCost += itemTotal;

                const originalUnit = item.unit;
                const originalQuantity = item.quantity;

                let quantityKg: number | null = null;
                let quantityL: number | null = null;

                if (item.unit === "kg") {
                  quantityKg = item.quantity;
                } else if (item.unit === "lb") {
                  quantityKg = item.quantity * 0.453592;
                } else if (item.unit === "bushel") {
                  quantityKg = bushelsToKg(item.quantity);
                } else if (item.unit === "L") {
                  quantityL = item.quantity;
                } else if (item.unit === "gal") {
                  quantityL = item.quantity * 3.78541;
                }

                processedItems.push({
                  purchaseId: input.id,
                  fruitVarietyId: item.fruitVarietyId,
                  quantity: originalQuantity.toString(),
                  unit: originalUnit,
                  quantityKg: quantityKg?.toString() || null,
                  quantityL: quantityL?.toString() || null,
                  originalUnit,
                  originalQuantity: originalQuantity.toString(),
                  pricePerUnit: item.pricePerUnit?.toString() || null,
                  totalCost: itemTotal.toString(),
                  harvestDate: item.harvestDate
                    ? item.harvestDate.toISOString().split("T")[0]
                    : null,
                  notes: item.notes,
                });
              }

              await tx.insert(basefruitPurchaseItems).values(processedItems);

              // Update total cost
              await tx
                .update(basefruitPurchases)
                .set({ totalCost: totalCost.toString() })
                .where(eq(basefruitPurchases.id, input.id));
            }

            // Audit log
            await publishUpdateEvent(
              "purchase",
              input.id,
              {},
              {},
              ctx.session?.user?.email || "system",
            );

            return { success: true, id: input.id };
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error updating purchase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update purchase",
          });
        }
      }),

    delete: createRbacProcedure("delete", "purchase")
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const existingPurchase = await db
            .select()
            .from(basefruitPurchases)
            .where(
              and(
                eq(basefruitPurchases.id, input.id),
                isNull(basefruitPurchases.deletedAt),
              ),
            );

          if (!existingPurchase.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Purchase not found",
            });
          }

          // Soft delete the purchase
          await db.transaction(async (tx) => {
            await tx
              .update(basefruitPurchases)
              .set({ deletedAt: new Date() })
              .where(eq(basefruitPurchases.id, input.id));

            // Also soft delete associated purchase items
            await tx
              .update(basefruitPurchaseItems)
              .set({ deletedAt: new Date() })
              .where(eq(basefruitPurchaseItems.purchaseId, input.id));

            // Audit log
            await publishDeleteEvent(
              "purchase",
              input.id,
              {},
              ctx.session?.user?.email || "system",
            );
          });

          return { success: true, id: input.id };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error deleting purchase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete purchase",
          });
        }
      }),

    // Unified transaction history endpoint for all purchase types
    allPurchases: createRbacProcedure("list", "purchase")
      .input(
        z.object({
          vendorId: z.string().uuid().optional(),
          materialType: z
            .enum(["basefruit", "additives", "juice", "packaging", "all"])
            .default("all"),
          startDate: z
            .date()
            .or(z.string().transform((val) => new Date(val)))
            .optional(),
          endDate: z
            .date()
            .or(z.string().transform((val) => new Date(val)))
            .optional(),
          includeArchived: z.boolean().default(true),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        try {
          const allPurchases = [];

          // Query basefruit purchases
          if (
            input.materialType === "all" ||
            input.materialType === "basefruit"
          ) {
            const conditions = [];
            if (!input.includeArchived) {
              conditions.push(isNull(basefruitPurchases.deletedAt));
            }
            if (input.vendorId) {
              conditions.push(eq(basefruitPurchases.vendorId, input.vendorId));
            }
            if (input.startDate) {
              conditions.push(
                sql`${basefruitPurchases.purchaseDate} >= ${input.startDate.toISOString().split("T")[0]}`,
              );
            }
            if (input.endDate) {
              conditions.push(
                sql`${basefruitPurchases.purchaseDate} <= ${input.endDate.toISOString().split("T")[0]}`,
              );
            }

            const basefruitResults = await db
              .select({
                id: basefruitPurchases.id,
                vendorId: basefruitPurchases.vendorId,
                vendorName: vendors.name,
                purchaseDate: basefruitPurchases.purchaseDate,
                invoiceNumber: basefruitPurchases.invoiceNumber,
                totalCost: basefruitPurchases.totalCost,
                notes: basefruitPurchases.notes,
                createdAt: basefruitPurchases.createdAt,
                deletedAt: basefruitPurchases.deletedAt,
              })
              .from(basefruitPurchases)
              .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
              .where(conditions.length > 0 ? and(...conditions) : undefined);

            // Get depletion status for basefruit purchases
            for (const purchase of basefruitResults) {
              const items = await db
                .select({
                  id: basefruitPurchaseItems.id,
                  isDepleted: basefruitPurchaseItems.isDepleted,
                  depletedAt: basefruitPurchaseItems.depletedAt,
                })
                .from(basefruitPurchaseItems)
                .where(eq(basefruitPurchaseItems.purchaseId, purchase.id));

              const totalItems = items.length;
              const depletedItems = items.filter(
                (item) => item.isDepleted,
              ).length;

              let status = "active";
              if (purchase.deletedAt) {
                status = "archived";
              } else if (depletedItems === totalItems && totalItems > 0) {
                status = "depleted";
              } else if (depletedItems > 0) {
                status = "partially_depleted";
              }

              allPurchases.push({
                ...purchase,
                materialType: "basefruit" as const,
                status,
                totalItems,
                depletedItems,
              });
            }
          }

          // Query additive purchases
          if (
            input.materialType === "all" ||
            input.materialType === "additives"
          ) {
            const conditions = [];
            if (!input.includeArchived) {
              conditions.push(isNull(additivePurchases.deletedAt));
            }
            if (input.vendorId) {
              conditions.push(eq(additivePurchases.vendorId, input.vendorId));
            }
            if (input.startDate) {
              conditions.push(
                sql`${additivePurchases.purchaseDate} >= ${input.startDate.toISOString().split("T")[0]}`,
              );
            }
            if (input.endDate) {
              conditions.push(
                sql`${additivePurchases.purchaseDate} <= ${input.endDate.toISOString().split("T")[0]}`,
              );
            }

            const additiveResults = await db
              .select({
                id: additivePurchases.id,
                vendorId: additivePurchases.vendorId,
                vendorName: vendors.name,
                purchaseDate: additivePurchases.purchaseDate,
                invoiceNumber: additivePurchases.invoiceNumber,
                totalCost: additivePurchases.totalCost,
                notes: additivePurchases.notes,
                createdAt: additivePurchases.createdAt,
                deletedAt: additivePurchases.deletedAt,
              })
              .from(additivePurchases)
              .leftJoin(vendors, eq(additivePurchases.vendorId, vendors.id))
              .where(conditions.length > 0 ? and(...conditions) : undefined);

            for (const purchase of additiveResults) {
              const items = await db
                .select({ id: additivePurchaseItems.id })
                .from(additivePurchaseItems)
                .where(eq(additivePurchaseItems.purchaseId, purchase.id));

              const status = purchase.deletedAt ? "archived" : "active";

              allPurchases.push({
                ...purchase,
                materialType: "additives" as const,
                status,
                totalItems: items.length,
                depletedItems: 0,
              });
            }
          }

          // Query juice purchases
          if (input.materialType === "all" || input.materialType === "juice") {
            const conditions = [];
            if (!input.includeArchived) {
              conditions.push(isNull(juicePurchases.deletedAt));
            }
            if (input.vendorId) {
              conditions.push(eq(juicePurchases.vendorId, input.vendorId));
            }
            if (input.startDate) {
              conditions.push(
                sql`${juicePurchases.purchaseDate} >= ${input.startDate.toISOString().split("T")[0]}`,
              );
            }
            if (input.endDate) {
              conditions.push(
                sql`${juicePurchases.purchaseDate} <= ${input.endDate.toISOString().split("T")[0]}`,
              );
            }

            const juiceResults = await db
              .select({
                id: juicePurchases.id,
                vendorId: juicePurchases.vendorId,
                vendorName: vendors.name,
                purchaseDate: juicePurchases.purchaseDate,
                invoiceNumber: juicePurchases.invoiceNumber,
                totalCost: juicePurchases.totalCost,
                notes: juicePurchases.notes,
                createdAt: juicePurchases.createdAt,
                deletedAt: juicePurchases.deletedAt,
              })
              .from(juicePurchases)
              .leftJoin(vendors, eq(juicePurchases.vendorId, vendors.id))
              .where(conditions.length > 0 ? and(...conditions) : undefined);

            for (const purchase of juiceResults) {
              const items = await db
                .select({ id: juicePurchaseItems.id })
                .from(juicePurchaseItems)
                .where(eq(juicePurchaseItems.purchaseId, purchase.id));

              const status = purchase.deletedAt ? "archived" : "active";

              allPurchases.push({
                ...purchase,
                materialType: "juice" as const,
                status,
                totalItems: items.length,
                depletedItems: 0,
              });
            }
          }

          // Query packaging purchases
          if (
            input.materialType === "all" ||
            input.materialType === "packaging"
          ) {
            const conditions = [];
            if (!input.includeArchived) {
              conditions.push(isNull(packagingPurchases.deletedAt));
            }
            if (input.vendorId) {
              conditions.push(eq(packagingPurchases.vendorId, input.vendorId));
            }
            if (input.startDate) {
              conditions.push(
                sql`${packagingPurchases.purchaseDate} >= ${input.startDate.toISOString().split("T")[0]}`,
              );
            }
            if (input.endDate) {
              conditions.push(
                sql`${packagingPurchases.purchaseDate} <= ${input.endDate.toISOString().split("T")[0]}`,
              );
            }

            const packagingResults = await db
              .select({
                id: packagingPurchases.id,
                vendorId: packagingPurchases.vendorId,
                vendorName: vendors.name,
                purchaseDate: packagingPurchases.purchaseDate,
                invoiceNumber: packagingPurchases.invoiceNumber,
                totalCost: packagingPurchases.totalCost,
                notes: packagingPurchases.notes,
                createdAt: packagingPurchases.createdAt,
                deletedAt: packagingPurchases.deletedAt,
              })
              .from(packagingPurchases)
              .leftJoin(vendors, eq(packagingPurchases.vendorId, vendors.id))
              .where(conditions.length > 0 ? and(...conditions) : undefined);

            for (const purchase of packagingResults) {
              const items = await db
                .select({ id: packagingPurchaseItems.id })
                .from(packagingPurchaseItems)
                .where(eq(packagingPurchaseItems.purchaseId, purchase.id));

              const status = purchase.deletedAt ? "archived" : "active";

              allPurchases.push({
                ...purchase,
                materialType: "packaging" as const,
                status,
                totalItems: items.length,
                depletedItems: 0,
              });
            }
          }

          // Sort all purchases by date (most recent first)
          allPurchases.sort(
            (a, b) =>
              new Date(b.purchaseDate).getTime() -
              new Date(a.purchaseDate).getTime(),
          );

          // Apply pagination
          const startIndex = input.offset;
          const endIndex = input.offset + input.limit;
          const paginatedPurchases = allPurchases.slice(startIndex, endIndex);

          return {
            purchases: paginatedPurchases,
            pagination: {
              total: allPurchases.length,
              limit: input.limit,
              offset: input.offset,
              hasMore: endIndex < allPurchases.length,
            },
            summary: {
              totalPurchases: allPurchases.length,
              byMaterialType: {
                basefruit: allPurchases.filter(
                  (p) => p.materialType === "basefruit",
                ).length,
                additives: allPurchases.filter(
                  (p) => p.materialType === "additives",
                ).length,
                juice: allPurchases.filter((p) => p.materialType === "juice")
                  .length,
                packaging: allPurchases.filter(
                  (p) => p.materialType === "packaging",
                ).length,
              },
              byStatus: {
                active: allPurchases.filter((p) => p.status === "active")
                  .length,
                partially_depleted: allPurchases.filter(
                  (p) => p.status === "partially_depleted",
                ).length,
                depleted: allPurchases.filter((p) => p.status === "depleted")
                  .length,
                archived: allPurchases.filter((p) => p.status === "archived")
                  .length,
              },
            },
          };
        } catch (error) {
          console.error("Error listing all purchases:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to list all purchases",
          });
        }
      }),
  }),

  // Purchase Line Integration for Apple Press workflow
  purchaseLine: router({
    available: createRbacProcedure("list", "purchaseLine")
      .input(
        z.object({
          vendorId: z.string().uuid().optional(),
          fruitVarietyId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        try {
          // Build WHERE conditions
          const conditions = [
            isNull(basefruitPurchaseItems.deletedAt),
            isNull(basefruitPurchases.deletedAt),
          ];

          if (input.vendorId) {
            conditions.push(eq(basefruitPurchases.vendorId, input.vendorId));
          }

          if (input.fruitVarietyId) {
            conditions.push(
              eq(basefruitPurchaseItems.fruitVarietyId, input.fruitVarietyId),
            );
          }

          // Get purchase items with consumed quantities from apple press run loads
          const availableItems = await db
            .select({
              // Purchase item details
              purchaseItemId: basefruitPurchaseItems.id,
              purchaseId: basefruitPurchaseItems.purchaseId,
              fruitVarietyId: basefruitPurchaseItems.fruitVarietyId,
              varietyName: baseFruitVarieties.name,
              originalQuantity: basefruitPurchaseItems.originalQuantity,
              originalUnit: basefruitPurchaseItems.originalUnit,
              quantityKg: basefruitPurchaseItems.quantityKg,
              harvestDate: basefruitPurchaseItems.harvestDate,
              notes: basefruitPurchaseItems.notes,

              // Purchase details
              vendorId: basefruitPurchases.vendorId,
              vendorName: vendors.name,
              purchaseDate: basefruitPurchases.purchaseDate,
              invoiceNumber: basefruitPurchases.invoiceNumber,

              // Calculate consumed quantity from apple press run loads
              consumedKg: sql<string>`COALESCE(SUM(${applePressRunLoads.appleWeightKg}), 0)`,
            })
            .from(basefruitPurchaseItems)
            .leftJoin(
              basefruitPurchases,
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
            )
            .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .leftJoin(
              baseFruitVarieties,
              eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
            )
            .leftJoin(
              applePressRunLoads,
              eq(applePressRunLoads.purchaseItemId, basefruitPurchaseItems.id),
            )
            .where(and(...conditions))
            .groupBy(
              basefruitPurchaseItems.id,
              basefruitPurchaseItems.purchaseId,
              basefruitPurchaseItems.fruitVarietyId,
              baseFruitVarieties.name,
              basefruitPurchaseItems.originalQuantity,
              basefruitPurchaseItems.originalUnit,
              basefruitPurchaseItems.quantityKg,
              basefruitPurchaseItems.harvestDate,
              basefruitPurchaseItems.notes,
              basefruitPurchases.vendorId,
              vendors.name,
              basefruitPurchases.purchaseDate,
              basefruitPurchases.invoiceNumber,
            )
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(
              desc(basefruitPurchases.purchaseDate),
              baseFruitVarieties.name,
            );

          // Filter items that have available quantity and calculate remaining amounts
          const availableInventory = availableItems
            .map((item) => {
              const totalKg = parseFloat(item.quantityKg || "0");
              const consumedKg = parseFloat(item.consumedKg || "0");
              const availableKg = totalKg - consumedKg;

              return {
                ...item,
                totalQuantityKg: totalKg,
                consumedQuantityKg: consumedKg,
                availableQuantityKg: availableKg,
                // Calculate available percentage
                availablePercentage:
                  totalKg > 0 ? (availableKg / totalKg) * 100 : 0,
              };
            })
            .filter((item) => item.availableQuantityKg > 0); // Only return items with available inventory

          // Get total count for pagination (similar query but count only)
          const countResult = await db
            .select({
              count: sql<number>`COUNT(DISTINCT ${basefruitPurchaseItems.id})`,
            })
            .from(basefruitPurchaseItems)
            .leftJoin(
              basefruitPurchases,
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
            )
            .leftJoin(
              applePressRunLoads,
              eq(applePressRunLoads.purchaseItemId, basefruitPurchaseItems.id),
            )
            .where(and(...conditions));

          const totalCount = countResult[0]?.count || 0;

          return {
            items: availableInventory,
            pagination: {
              total: totalCount,
              limit: input.limit,
              offset: input.offset,
              hasMore: input.offset + availableInventory.length < totalCount,
            },
            summary: {
              totalAvailableItems: availableInventory.length,
              totalAvailableKg: availableInventory.reduce(
                (sum, item) => sum + item.availableQuantityKg,
                0,
              ),
            },
          };
        } catch (error) {
          console.error("Error getting available purchase lines:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get available purchase lines",
          });
        }
      }),

    validateAvailability: createRbacProcedure("read", "purchaseLine")
      .input(
        z.object({
          purchaseItemId: z.string().uuid(),
          requestedQuantityKg: z.number().positive(),
        }),
      )
      .query(async ({ input }) => {
        try {
          // Get purchase item with current consumption
          const item = await db
            .select({
              purchaseItemId: basefruitPurchaseItems.id,
              quantityKg: basefruitPurchaseItems.quantityKg,
              consumedKg: sql<string>`COALESCE(SUM(${applePressRunLoads.appleWeightKg}), 0)`,
              varietyName: baseFruitVarieties.name,
              vendorName: vendors.name,
            })
            .from(basefruitPurchaseItems)
            .leftJoin(
              basefruitPurchases,
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
            )
            .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
            .leftJoin(
              baseFruitVarieties,
              eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
            )
            .leftJoin(
              applePressRunLoads,
              eq(applePressRunLoads.purchaseItemId, basefruitPurchaseItems.id),
            )
            .where(
              and(
                eq(basefruitPurchaseItems.id, input.purchaseItemId),
                isNull(basefruitPurchaseItems.deletedAt),
              ),
            )
            .groupBy(
              basefruitPurchaseItems.id,
              basefruitPurchaseItems.quantityKg,
              baseFruitVarieties.name,
              vendors.name,
            )
            .limit(1);

          if (!item.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Purchase item not found",
            });
          }

          const totalKg = parseFloat(item[0].quantityKg || "0");
          const consumedKg = parseFloat(item[0].consumedKg || "0");
          const availableKg = totalKg - consumedKg;

          const isAvailable = input.requestedQuantityKg <= availableKg;
          const shortfallKg = isAvailable
            ? 0
            : input.requestedQuantityKg - availableKg;

          return {
            isAvailable,
            availableQuantityKg: availableKg,
            requestedQuantityKg: input.requestedQuantityKg,
            shortfallKg,
            totalQuantityKg: totalKg,
            consumedQuantityKg: consumedKg,
            item: {
              id: item[0].purchaseItemId,
              varietyName: item[0].varietyName,
              vendorName: item[0].vendorName,
            },
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error validating purchase line availability:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to validate purchase line availability",
          });
        }
      }),
  }),

  // Press management
  press: router({
    list: createRbacProcedure("list", "press").query(async () => {
      try {
        const pressList = await db
          .select({
            id: pressRuns.id,
            runDate: pressRuns.runDate,
            totalAppleProcessedKg: pressRuns.totalAppleProcessedKg,
            totalJuiceProduced: pressRuns.totalJuiceProduced,
            totalJuiceProducedUnit: pressRuns.totalJuiceProducedUnit,
            extractionRate: pressRuns.extractionRate,
            notes: pressRuns.notes,
            createdAt: pressRuns.createdAt,
          })
          .from(pressRuns)
          .where(isNull(pressRuns.deletedAt))
          .orderBy(desc(pressRuns.runDate), desc(pressRuns.createdAt));

        return {
          pressRuns: pressList,
          count: pressList.length,
        };
      } catch (error) {
        console.error("Error listing press runs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list press runs",
        });
      }
    }),

    start: createRbacProcedure("create", "press")
      .input(
        z.object({
          runDate: z.date().or(z.string().transform((val) => new Date(val))),
          notes: z.string().optional(),
          items: z
            .array(
              z.object({
                purchaseItemId: z.string().uuid("Invalid purchase item ID"),
                quantityUsedKg: z
                  .number()
                  .positive("Quantity used must be positive"),
                brixMeasured: z.number().min(0).max(30).optional(),
                notes: z.string().optional(),
              }),
            )
            .min(1, "At least one purchase item is required"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Calculate totals and validate purchase items
            let totalAppleProcessedKg = 0;
            let totalJuiceProduced = 0;
            const processedItems = [];

            for (const item of input.items) {
              // Verify purchase item exists and has enough quantity
              const purchaseItem = await tx
                .select()
                .from(basefruitPurchaseItems)
                .where(
                  and(
                    eq(basefruitPurchaseItems.id, item.purchaseItemId),
                    isNull(basefruitPurchaseItems.deletedAt),
                  ),
                )
                .limit(1);

              if (!purchaseItem.length) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: `Purchase item ${item.purchaseItemId} not found`,
                });
              }

              // Check if enough quantity is available (basic validation)
              const availableKg = parseFloat(purchaseItem[0].quantityKg || "0");
              if (item.quantityUsedKg > availableKg) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Not enough quantity available for purchase item ${item.purchaseItemId}`,
                });
              }

              totalAppleProcessedKg += item.quantityUsedKg;

              // Estimate juice production (60-70% extraction rate)
              const estimatedJuiceL = item.quantityUsedKg * 0.65; // 65% extraction rate
              totalJuiceProduced += estimatedJuiceL;

              processedItems.push({
                ...item,
                juiceProducedL: estimatedJuiceL,
              });
            }

            // Calculate overall extraction rate
            const extractionRate =
              totalAppleProcessedKg > 0
                ? totalJuiceProduced / totalAppleProcessedKg
                : 0;

            // Create the press run
            const newPressRun = await tx
              .insert(pressRuns)
              .values({
                runDate: input.runDate,
                notes: input.notes,
                totalAppleProcessedKg: totalAppleProcessedKg.toString(),
                totalJuiceProduced: totalJuiceProduced.toString(),
                totalJuiceProducedUnit: "L" as const,
                extractionRate: extractionRate.toString(),
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            const pressRunId = newPressRun[0].id;

            // Create press items
            const newItems = await tx
              .insert(pressItems)
              .values(
                processedItems.map((item) => ({
                  pressRunId,
                  purchaseItemId: item.purchaseItemId,
                  quantityUsedKg: item.quantityUsedKg.toString(),
                  juiceProduced: item.juiceProducedL.toString(),
                  juiceProducedUnit: "L" as const,
                  brixMeasured: item.brixMeasured?.toString(),
                  notes: item.notes,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })),
              )
              .returning();

            // Publish audit events
            await publishCreateEvent(
              "press_runs",
              pressRunId,
              {
                pressRunId,
                totalAppleKg: totalAppleProcessedKg,
                totalJuiceL: totalJuiceProduced,
                totalJuiceUnit: "L",
              },
              ctx.session?.user?.id,
              "Press run started via API",
            );

            for (const item of newItems) {
              await publishCreateEvent(
                "press_items",
                item.id,
                {
                  itemId: item.id,
                  pressRunId,
                  purchaseItemId: item.purchaseItemId,
                },
                ctx.session?.user?.id,
                "Press item created via API",
              );
            }

            return {
              success: true,
              pressRun: newPressRun[0],
              items: newItems,
              message: `Press run started with ${newItems.length} items`,
            };
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error starting press run:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start press run",
          });
        }
      }),

    complete: createRbacProcedure("update", "press")
      .input(
        z.object({
          pressRunId: z.string().uuid("Invalid press run ID"),
          actualTotalJuiceProducedL: z
            .number()
            .positive("Total juice produced must be positive"),
          items: z.array(
            z.object({
              pressItemId: z.string().uuid("Invalid press item ID"),
              actualJuiceProducedL: z
                .number()
                .positive("Actual juice produced must be positive"),
              finalBrixMeasured: z.number().min(0).max(30).optional(),
              notes: z.string().optional(),
            }),
          ),
          notes: z.string().optional(),
        }),
      )
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

            // Calculate actual extraction rate
            const totalAppleProcessedKg = parseFloat(
              pressRun[0].totalAppleProcessedKg,
            );
            const actualExtractionRate =
              totalAppleProcessedKg > 0
                ? input.actualTotalJuiceProducedL / totalAppleProcessedKg
                : 0;

            // Update press run with actual values
            const updatedPressRun = await tx
              .update(pressRuns)
              .set({
                totalJuiceProduced: input.actualTotalJuiceProducedL.toString(),
                totalJuiceProducedUnit: "L" as const,
                extractionRate: actualExtractionRate.toString(),
                notes: input.notes || pressRun[0].notes,
                updatedAt: new Date(),
              })
              .where(eq(pressRuns.id, input.pressRunId))
              .returning();

            // Update press items with actual values
            const updatedItems = [];
            for (const item of input.items) {
              const updatedItem = await tx
                .update(pressItems)
                .set({
                  juiceProduced: item.actualJuiceProducedL.toString(),
                  juiceProducedUnit: "L" as const,
                  brixMeasured: item.finalBrixMeasured?.toString(),
                  notes: item.notes,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(pressItems.id, item.pressItemId),
                    eq(pressItems.pressRunId, input.pressRunId),
                  ),
                )
                .returning();

              if (updatedItem.length) {
                updatedItems.push(updatedItem[0]);
              }
            }

            // Publish audit events
            await publishUpdateEvent(
              "press_runs",
              input.pressRunId,
              pressRun[0],
              {
                totalJuiceProduced: input.actualTotalJuiceProducedL,
                totalJuiceProducedUnit: "L",
                extractionRate: actualExtractionRate,
              },
              ctx.session?.user?.id,
              "Press run completed via API",
            );

            return {
              success: true,
              pressRun: updatedPressRun[0],
              items: updatedItems,
              message: `Press run completed with actual yield of ${input.actualTotalJuiceProducedL}L`,
            };
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error completing press run:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to complete press run",
          });
        }
      }),

    getById: createRbacProcedure("read", "press")
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const pressRun = await db
            .select()
            .from(pressRuns)
            .where(and(eq(pressRuns.id, input.id), isNull(pressRuns.deletedAt)))
            .limit(1);

          if (!pressRun.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Press run not found",
            });
          }

          const items = await db
            .select()
            .from(pressItems)
            .where(
              and(
                eq(pressItems.pressRunId, input.id),
                isNull(pressItems.deletedAt),
              ),
            );

          return {
            pressRun: pressRun[0],
            items,
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
  }),

  // Batch management (imported from batch.ts)
  batch: batchRouter,

  // Batch transfer operations
  batchTransfer: router({
    list: createRbacProcedure("list", "batch").query(async () => {
      try {
        const batchList = await db
          .select({
            id: batches.id,
            batchNumber: batches.batchNumber,
            status: batches.status,
            vesselId: batches.vesselId,
            startDate: batches.startDate,
            endDate: batches.endDate,
            initialVolume: batches.initialVolume,
            initialVolumeUnit: batches.initialVolumeUnit,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
            createdAt: batches.createdAt,
          })
          .from(batches)
          .where(isNull(batches.deletedAt))
          .orderBy(desc(batches.startDate), desc(batches.createdAt));

        return {
          batches: batchList,
          count: batchList.length,
        };
      } catch (error) {
        console.error("Error listing batches:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list batches",
        });
      }
    }),

    startFromJuiceLot: createRbacProcedure("create", "batch")
      .input(
        z.object({
          batchNumber: z.string().min(1, "Batch number is required"),
          vesselId: z.string().uuid("Invalid vessel ID"),
          startDate: z.date().or(z.string().transform((val) => new Date(val))),
          targetCompletionDate: z
            .date()
            .or(z.string().transform((val) => new Date(val)))
            .optional(),
          targetAbv: z.number().min(0).max(20).optional(),
          notes: z.string().optional(),
          pressItems: z
            .array(
              z.object({
                pressItemId: z.string().uuid("Invalid press item ID"),
                volumeUsedL: z
                  .number()
                  .positive("Volume used must be positive"),
                brixAtUse: z.number().min(0).max(30).optional(),
                notes: z.string().optional(),
              }),
            )
            .min(1, "At least one press item is required"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify vessel is available
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

            // Calculate total volume and validate press items
            let totalVolumeL = 0;
            const processedItems = [];

            for (const item of input.pressItems) {
              // Verify press item exists and has enough juice
              const pressItem = await tx
                .select()
                .from(pressItems)
                .where(
                  and(
                    eq(pressItems.id, item.pressItemId),
                    isNull(pressItems.deletedAt),
                  ),
                )
                .limit(1);

              if (!pressItem.length) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: `Press item ${item.pressItemId} not found`,
                });
              }

              const availableL = parseFloat(pressItem[0].juiceProduced);
              if (item.volumeUsedL > availableL) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Not enough juice available for press item ${item.pressItemId}`,
                });
              }

              totalVolumeL += item.volumeUsedL;
              processedItems.push(item);
            }

            // Check vessel capacity
            const vesselCapacityL = parseFloat(vessel[0].capacity?.toString() || "0");
            if (totalVolumeL > vesselCapacityL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Total volume (${totalVolumeL}L) exceeds vessel capacity (${vesselCapacityL}${vessel[0].capacityUnit || 'L'})`,
              });
            }

            // Create the batch
            const newBatch = await tx
              .insert(batches)
              .values({
                name: input.batchNumber,
                batchNumber: input.batchNumber,
                status: "active",
                vesselId: input.vesselId,
                juiceLotId: null, // This might need to be set based on your business logic
                originPressRunId: null, // This might need to be set based on your business logic
                startDate: input.startDate,
                endDate: input.targetCompletionDate || null,
                initialVolume: totalVolumeL.toString(),
                initialVolumeUnit: "L",
                currentVolume: totalVolumeL.toString(),
                currentVolumeUnit: "L",
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            const batchId = newBatch[0].id;

            // Create batch ingredients - commented out as the data structure doesn't match
            // TODO: Fix batch compositions to properly track base fruit purchases used in batch
            // const newIngredients = await tx
            //   .insert(batchCompositions)
            //   .values(
            //     processedItems.map((item) => ({
            //       batchId,
            //       // Need to map pressItemId to actual purchase items with vendor/variety info
            //       // This requires a different data structure
            //     }))
            //   )
            //   .returning()

            // Update vessel status
            await tx
              .update(vessels)
              .set({
                status: "fermenting",
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.vesselId));

            // Publish audit events
            await publishCreateEvent(
              "batches",
              batchId,
              {
                batchId,
                batchNumber: input.batchNumber,
                vesselId: input.vesselId,
                initialVolume: totalVolumeL,
                initialVolumeUnit: "L",
              },
              ctx.session?.user?.id,
              "Batch started from juice lot via API",
            );

            return {
              success: true,
              batch: newBatch[0],
              ingredients: [], // TODO: Fix when batch compositions are properly implemented
              message: `Batch ${input.batchNumber} started with ${totalVolumeL}L`,
            };
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error starting batch from juice lot:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start batch from juice lot",
          });
        }
      }),

    addMeasurement: createRbacProcedure("create", "batch")
      .input(
        z.object({
          batchId: z.string().uuid("Invalid batch ID"),
          measurementDate: z
            .date()
            .or(z.string().transform((val) => new Date(val))),
          specificGravity: z.number().min(0.99).max(1.2).optional(),
          abv: z.number().min(0).max(20).optional(),
          ph: z.number().min(2).max(5).optional(),
          totalAcidity: z.number().min(0).max(15).optional(),
          temperature: z.number().min(-10).max(50).optional(),
          volumeL: z.number().positive().optional(),
          notes: z.string().optional(),
          takenBy: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Verify batch exists
          const batch = await db
            .select()
            .from(batches)
            .where(
              and(eq(batches.id, input.batchId), isNull(batches.deletedAt)),
            )
            .limit(1);

          if (!batch.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found",
            });
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
              volume: input.volumeL?.toString(),
              volumeUnit: "L",
              notes: input.notes,
              takenBy:
                input.takenBy ||
                ctx.session?.user?.name ||
                ctx.session?.user?.email,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Update batch current volume and ABV if provided
          const updateData: any = { updatedAt: new Date() };
          if (input.volumeL) {
            updateData.currentVolume = input.volumeL.toString();
            updateData.currentVolumeUnit = "L";
          }
          if (input.abv) {
            updateData.actualAbv = input.abv.toString();
          }

          if (Object.keys(updateData).length > 1) {
            await db
              .update(batches)
              .set(updateData)
              .where(eq(batches.id, input.batchId));
          }

          // Publish audit event
          await publishCreateEvent(
            "batch_measurements",
            newMeasurement[0].id,
            {
              measurementId: newMeasurement[0].id,
              batchId: input.batchId,
              abv: input.abv,
            },
            ctx.session?.user?.id,
            "Batch measurement added via API",
          );

          return {
            success: true,
            measurement: newMeasurement[0],
            message: "Measurement added successfully",
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error adding batch measurement:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to add batch measurement",
          });
        }
      }),

    transfer: createRbacProcedure("update", "batch")
      .input(
        z.object({
          batchId: z.string().uuid("Invalid batch ID"),
          newVesselId: z.string().uuid("Invalid vessel ID"),
          volumeTransferredL: z
            .number()
            .positive("Volume transferred must be positive"),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify batch exists
            const batch = await tx
              .select()
              .from(batches)
              .where(
                and(eq(batches.id, input.batchId), isNull(batches.deletedAt)),
              )
              .limit(1);

            if (!batch.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Batch not found",
              });
            }

            // Verify new vessel is available
            const newVessel = await tx
              .select()
              .from(vessels)
              .where(
                and(
                  eq(vessels.id, input.newVesselId),
                  isNull(vessels.deletedAt),
                ),
              )
              .limit(1);

            if (!newVessel.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "New vessel not found",
              });
            }

            if (newVessel[0].status !== "available") {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "New vessel is not available",
              });
            }

            // Check capacity
            const newVesselCapacityL = parseFloat(newVessel[0].capacity?.toString() || "0");
            if (input.volumeTransferredL > newVesselCapacityL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Volume exceeds new vessel capacity",
              });
            }

            const currentVolumeL = parseFloat(batch[0].currentVolume?.toString() || "0");
            if (input.volumeTransferredL > currentVolumeL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Not enough volume in batch for transfer",
              });
            }

            // Update batch vessel and volume
            const updatedBatch = await tx
              .update(batches)
              .set({
                vesselId: input.newVesselId,
                currentVolume: input.volumeTransferredL.toString(),
                currentVolumeUnit: "L",
                updatedAt: new Date(),
              })
              .where(eq(batches.id, input.batchId))
              .returning();

            // Update old vessel to available
            if (batch[0].vesselId) {
              await tx
                .update(vessels)
                .set({
                  status: "available",
                  updatedAt: new Date(),
                })
                .where(eq(vessels.id, batch[0].vesselId));
            }

            // Update new vessel to in_use
            await tx
              .update(vessels)
              .set({
                status: "fermenting",
                updatedAt: new Date(),
              })
              .where(eq(vessels.id, input.newVesselId));

            // Publish audit event
            await publishUpdateEvent(
              "batches",
              input.batchId,
              batch[0],
              {
                vesselId: input.newVesselId,
                currentVolume: input.volumeTransferredL,
                currentVolumeUnit: "L",
              },
              ctx.session?.user?.id,
              "Batch transferred to new vessel via API",
            );

            return {
              success: true,
              batch: updatedBatch[0],
              message: `Batch transferred to new vessel with ${input.volumeTransferredL}L`,
            };
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error transferring batch:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to transfer batch",
          });
        }
      }),

    getById: createRbacProcedure("read", "batch")
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const batch = await db
            .select()
            .from(batches)
            .where(and(eq(batches.id, input.id), isNull(batches.deletedAt)))
            .limit(1);

          if (!batch.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found",
            });
          }

          const ingredients = await db
            .select()
            .from(batchCompositions)
            .where(
              and(
                eq(batchCompositions.batchId, input.id),
                isNull(batchCompositions.deletedAt),
              ),
            );

          const measurements = await db
            .select()
            .from(batchMeasurements)
            .where(
              and(
                eq(batchMeasurements.batchId, input.id),
                isNull(batchMeasurements.deletedAt),
              ),
            )
            .orderBy(desc(batchMeasurements.measurementDate));

          return {
            batch: batch[0],
            ingredients,
            measurements,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error getting batch:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get batch",
          });
        }
      }),
  }),

  // Packaging management
  packaging: packagingRouter,

  // Apple Varieties management - comprehensive CRUD with new enriched fields
  fruitVariety: varietiesRouter,

  // Vessel management
  vessel: router({
    list: createRbacProcedure("list", "vessel").query(async () => {
      try {
        const vesselList = await db
          .select()
          .from(vessels)
          .where(isNull(vessels.deletedAt))
          .orderBy(vessels.name);

        return {
          vessels: vesselList,
          count: vesselList.length,
        };
      } catch (error) {
        console.error("Error listing vessels:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list vessels",
        });
      }
    }),

    listWithBatches: createRbacProcedure("list", "vessel").query(async () => {
      try {
        // Get all vessels with their current active batches
        const vesselsWithBatches = await db
          .select({
            id: vessels.id,
            name: vessels.name,
            capacity: vessels.capacity,
            capacityUnit: vessels.capacityUnit,
            status: vessels.status,
            material: vessels.material,
            location: vessels.location,
            // Batch information (if exists)
            batchId: batches.id,
            batchName: batches.name,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
            batchStatus: batches.status,
          })
          .from(vessels)
          .leftJoin(
            batches,
            and(
              eq(vessels.id, batches.vesselId),
              eq(batches.status, "active"),
              isNull(batches.deletedAt),
            ),
          )
          .where(isNull(vessels.deletedAt))
          .orderBy(vessels.name);

        // Calculate remaining capacity for each vessel
        const vesselCapacities = vesselsWithBatches.map((vessel) => {
          const capacity = parseFloat(vessel.capacity?.toString() || "0");
          const currentVolume = vessel.currentVolume
            ? parseFloat(vessel.currentVolume.toString())
            : 0;
          const remainingCapacity = capacity - currentVolume;

          return {
            id: vessel.id,
            name: vessel.name,
            capacity: vessel.capacity,
            capacityUnit: vessel.capacityUnit,
            status: vessel.status,
            material: vessel.material,
            location: vessel.location,
            currentBatch: vessel.batchId
              ? {
                  id: vessel.batchId,
                  name: vessel.batchName,
                  currentVolume: vessel.currentVolume,
                  currentVolumeUnit: vessel.currentVolumeUnit,
                  status: vessel.batchStatus,
                }
              : null,
            remainingCapacityL: remainingCapacity.toString(),
            isAvailable: remainingCapacity > 0.1, // Consider available if >0.1L remaining
          };
        });

        return {
          vessels: vesselCapacities,
          count: vesselCapacities.length,
        };
      } catch (error) {
        console.error("Error listing vessels with batches:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list vessels with batch information",
        });
      }
    }),

    create: createRbacProcedure("create", "vessel")
      .input(
        z.object({
          name: z.string().optional(),
          capacityL: z.number().positive("Capacity must be positive"),
          capacityUnit: z.enum(["L", "gal"]).default("L"),
          material: z.enum(["stainless_steel", "plastic"]).optional(),
          jacketed: z.enum(["yes", "no"]).optional(),
          location: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Auto-generate tank name if not provided
          let finalName = input.name;
          if (!finalName) {
            const existingVessels = await db
              .select({ name: vessels.name })
              .from(vessels)
              .where(
                and(
                  isNull(vessels.deletedAt),
                  sql`${vessels.name} ~ '^Tank [0-9]+$'`,
                ),
              )
              .orderBy(vessels.name);

            const tankNumbers = existingVessels
              .map((v) => parseInt(v.name?.match(/Tank (\d+)/)?.[1] || "0"))
              .filter((num) => !isNaN(num));

            const nextNumber =
              tankNumbers.length === 0 ? 1 : Math.max(...tankNumbers) + 1;
            finalName = `Tank ${nextNumber}`;
          }

          // capacityL is already in liters from the frontend, just round it
          const capacityInLiters = roundToDecimals(input.capacityL, 3);

          const newVessel = await db
            .insert(vessels)
            .values({
              name: finalName,
              type: "storage", // Temporary default value until migration is applied
              capacity: capacityInLiters.toString(),
              capacityUnit: input.capacityUnit || "L",
              material: input.material,
              jacketed: input.jacketed,
              location: input.location,
              notes: input.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Audit logging
          await publishCreateEvent(
            "vessels",
            newVessel[0].id,
            { vesselId: newVessel[0].id, name: finalName },
            ctx.session?.user?.id,
            "Vessel created via API",
          );

          return {
            success: true,
            vessel: newVessel[0],
            message: `Vessel "${finalName}" created successfully`,
          };
        } catch (error) {
          console.error("Error creating vessel:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create vessel",
          });
        }
      }),

    update: createRbacProcedure("update", "vessel")
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().optional(),
          capacityL: z
            .number()
            .positive("Capacity must be positive")
            .optional(),
          capacityUnit: z.enum(["L", "gal"]).optional(),
          material: z.enum(["stainless_steel", "plastic"]).optional(),
          jacketed: z.enum(["yes", "no"]).optional(),
          status: z
            .enum([
              "available",
              "fermenting",
              "cleaning",
              "maintenance",
              "aging",
            ])
            .optional(),
          location: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await db
            .select()
            .from(vessels)
            .where(and(eq(vessels.id, input.id), isNull(vessels.deletedAt)))
            .limit(1);

          if (!existing.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vessel not found",
            });
          }

          const updateData: any = { updatedAt: new Date() };

          if (input.name !== undefined) updateData.name = input.name;
          if (input.capacityL !== undefined && input.capacityUnit !== undefined) {
            // capacityL is already in liters from the frontend, just round it
            const capacityInLiters = roundToDecimals(input.capacityL, 3);
            updateData.capacity = capacityInLiters.toString();
            updateData.capacityUnit = input.capacityUnit;
          } else if (input.capacityUnit !== undefined) {
            updateData.capacityUnit = input.capacityUnit;
          }
          if (input.material !== undefined)
            updateData.material = input.material;
          if (input.jacketed !== undefined)
            updateData.jacketed = input.jacketed;
          if (input.status !== undefined) updateData.status = input.status;
          if (input.location !== undefined)
            updateData.location = input.location;
          if (input.notes !== undefined) updateData.notes = input.notes;

          const updatedVessel = await db
            .update(vessels)
            .set(updateData)
            .where(eq(vessels.id, input.id))
            .returning();

          // Audit logging
          await publishUpdateEvent(
            "vessels",
            input.id,
            existing[0],
            updateData,
            ctx.session?.user?.id,
            "Vessel updated via API",
          );

          return {
            success: true,
            vessel: updatedVessel[0],
            message: `Vessel "${updatedVessel[0].name || "Unknown"}" updated successfully`,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error updating vessel:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update vessel",
          });
        }
      }),

    delete: createRbacProcedure("delete", "vessel")
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await db
            .select()
            .from(vessels)
            .where(and(eq(vessels.id, input.id), isNull(vessels.deletedAt)))
            .limit(1);

          if (!existing.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vessel not found",
            });
          }

          // Check if vessel is in use (including fermenting)
          if (
            existing[0].status === "fermenting" ||
            existing[0].status === "aging"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot delete vessel that contains liquid or is actively in use",
            });
          }

          const deletedVessel = await db
            .update(vessels)
            .set({
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, input.id))
            .returning();

          // Audit logging
          await publishDeleteEvent(
            "vessels",
            input.id,
            existing[0],
            ctx.session?.user?.id,
            "Vessel deleted via API",
          );

          return {
            success: true,
            message: `Vessel "${existing[0].name || "Unknown"}" deleted successfully`,
            vessel: deletedVessel[0],
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error deleting vessel:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete vessel",
          });
        }
      }),

    getById: createRbacProcedure("read", "vessel")
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const vessel = await db
            .select()
            .from(vessels)
            .where(and(eq(vessels.id, input.id), isNull(vessels.deletedAt)))
            .limit(1);

          if (!vessel.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vessel not found",
            });
          }

          return {
            vessel: vessel[0],
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error getting vessel:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get vessel",
          });
        }
      }),

    liquidMap: createRbacProcedure("list", "vessel").query(async () => {
      try {
        // Get vessels with their current batches and apple press runs
        const vesselsWithBatches = await db
          .select({
            vesselId: vessels.id,
            vesselName: vessels.name,
            vesselCapacity: vessels.capacity,
            vesselCapacityUnit: vessels.capacityUnit,
            vesselStatus: vessels.status,
            vesselLocation: vessels.location,
            batchId: batches.id,
            batchNumber: batches.batchNumber,
            batchStatus: batches.status,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
            batchCustomName: batches.customName,
            // Include apple press run volume when no batch exists
            applePressRunId: applePressRuns.id,
            applePressRunVolume: applePressRuns.totalJuiceVolume,
            applePressRunVolumeUnit: applePressRuns.totalJuiceVolumeUnit,
          })
          .from(vessels)
          .leftJoin(
            batches,
            and(
              eq(batches.vesselId, vessels.id),
              isNull(batches.deletedAt),
              eq(batches.status, "active"),
            ),
          )
          .leftJoin(
            applePressRuns,
            and(
              eq(applePressRuns.vesselId, vessels.id),
              isNull(applePressRuns.deletedAt),
              eq(applePressRuns.status, "completed"),
            ),
          )
          .where(isNull(vessels.deletedAt))
          .orderBy(vessels.name);

        // Get latest measurements for each batch
        const batchIds = vesselsWithBatches
          .filter((v) => v.batchId)
          .map((v) => v.batchId as string);

        let latestMeasurements = new Map();
        if (batchIds.length > 0) {
          const measurementsList = await db
            .select({
              batchId: batchMeasurements.batchId,
              specificGravity: batchMeasurements.specificGravity,
              ph: batchMeasurements.ph,
              temperature: batchMeasurements.temperature,
              measurementDate: batchMeasurements.measurementDate,
            })
            .from(batchMeasurements)
            .where(
              and(
                inArray(batchMeasurements.batchId, batchIds),
                isNull(batchMeasurements.deletedAt),
              ),
            )
            .orderBy(desc(batchMeasurements.measurementDate));

          // Group by batch and take the latest
          for (const m of measurementsList) {
            if (!latestMeasurements.has(m.batchId)) {
              latestMeasurements.set(m.batchId, m);
            }
          }
        }

        // Get total packaged inventory
        const packagedInventory = await db
          .select({
            totalBottles: sql<number>`sum(${inventory.currentBottleCount})`,
            totalVolumeL: sql<number>`sum(${packages.volumePackaged}::decimal * ${inventory.currentBottleCount}::decimal / ${packages.bottleCount}::decimal)`,
          })
          .from(inventory)
          .leftJoin(packages, eq(packages.id, inventory.packageId))
          .where(and(isNull(inventory.deletedAt), isNull(packages.deletedAt)));

        // Calculate total liquid in cellar from both batches and apple press runs
        const cellarLiquid = vesselsWithBatches.reduce((total, vessel) => {
          // Prioritize batch volume if it exists, otherwise use apple press run volume
          if (vessel.currentVolume) {
            return total + parseFloat(vessel.currentVolume.toString());
          } else if (vessel.applePressRunVolume) {
            return total + parseFloat(vessel.applePressRunVolume.toString());
          }
          return total;
        }, 0);

        // Ensure packaged inventory values are valid numbers
        const packagedData = packagedInventory[0] || {
          totalBottles: 0,
          totalVolumeL: 0,
        };
        const packagedVolumeL =
          parseFloat(String(packagedData.totalVolumeL || 0)) || 0;

        // Combine vessel data with measurements
        const vesselsWithMeasurements = vesselsWithBatches.map((vessel) => ({
          ...vessel,
          latestMeasurement: vessel.batchId
            ? latestMeasurements.get(vessel.batchId)
            : null,
        }));

        return {
          vessels: vesselsWithMeasurements,
          cellarLiquidL: cellarLiquid,
          packagedInventory: {
            totalBottles: parseInt(String(packagedData.totalBottles || 0)) || 0,
            totalVolumeL: packagedVolumeL,
          },
          totalLiquidL: cellarLiquid + packagedVolumeL,
        };
      } catch (error) {
        console.error("Error getting liquid map:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get liquid map",
        });
      }
    }),
    transfer: createRbacProcedure("update", "vessel")
      .input(
        z.object({
          fromVesselId: z.string().uuid("Invalid source vessel ID"),
          toVesselId: z.string().uuid("Invalid destination vessel ID"),
          volumeL: z.number().positive("Transfer volume must be positive"),
          loss: z.number().min(0, "Loss cannot be negative").optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.transaction(async (tx) => {
            // Verify source vessel exists and has liquid
            const sourceVessel = await tx
              .select()
              .from(vessels)
              .where(
                and(
                  eq(vessels.id, input.fromVesselId),
                  isNull(vessels.deletedAt),
                ),
              )
              .limit(1);

            if (!sourceVessel.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Source vessel not found",
              });
            }

            // Verify destination vessel exists and is available
            const destVessel = await tx
              .select()
              .from(vessels)
              .where(
                and(
                  eq(vessels.id, input.toVesselId),
                  isNull(vessels.deletedAt),
                ),
              )
              .limit(1);

            if (!destVessel.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Destination vessel not found",
              });
            }

            // Check if destination is available or fermenting (allow blending)
            if (destVessel[0].status !== "available" && destVessel[0].status !== "fermenting") {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Destination vessel is ${destVessel[0].status} and cannot receive liquid`,
              });
            }

            // Check if destination vessel exists has an active batch (blend scenario)
            const destBatch = await tx
              .select()
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, input.toVesselId),
                  eq(batches.status, "active"),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            const isBlending = destBatch.length > 0;
            const destCurrentVolumeL = isBlending
              ? parseFloat(destBatch[0].currentVolume?.toString() || "0")
              : 0;

            // Check if destination vessel has enough capacity for the combined volume
            const destCapacityL = parseFloat(destVessel[0].capacity?.toString() || "0");
            const totalVolumeAfterTransfer = destCurrentVolumeL + input.volumeL;
            if (totalVolumeAfterTransfer > destCapacityL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Transfer volume (${input.volumeL}L) plus existing volume (${destCurrentVolumeL}L) exceeds destination vessel capacity (${destCapacityL}${destVessel[0].capacityUnit || 'L'})`,
              });
            }

            // Get current batch in source vessel
            const sourceBatch = await tx
              .select()
              .from(batches)
              .where(
                and(
                  eq(batches.vesselId, input.fromVesselId),
                  eq(batches.status, "active"),
                  isNull(batches.deletedAt),
                ),
              )
              .limit(1);

            if (!sourceBatch.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "No active batch found in source vessel",
              });
            }

            const currentVolumeL = parseFloat(
              sourceBatch[0].currentVolume?.toString() || "0",
            );
            const transferVolumeL = input.volumeL + (input.loss || 0);

            if (transferVolumeL > currentVolumeL) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Transfer volume plus loss (${transferVolumeL}L) exceeds current batch volume (${currentVolumeL}${sourceBatch[0].currentVolumeUnit || 'L'})`,
              });
            }

            const remainingVolumeL = currentVolumeL - transferVolumeL;
            let remainingBatch = null;

            // Check if this is a full transfer or partial transfer
            if (remainingVolumeL > 0) {
              // Partial transfer - create remaining batch in source vessel
              const newRemainingBatch = await tx
                .insert(batches)
                .values({
                  vesselId: input.fromVesselId,
                  name: `${sourceBatch[0].name} - Remaining`,
                  batchNumber: `${sourceBatch[0].batchNumber}-R`,
                  initialVolume: remainingVolumeL.toString(),
                  initialVolumeUnit: sourceBatch[0].currentVolumeUnit || "L",
                  currentVolume: remainingVolumeL.toString(),
                  currentVolumeUnit: sourceBatch[0].currentVolumeUnit || "L",
                  status: "active",
                  juiceLotId: sourceBatch[0].juiceLotId,
                  originPressRunId: sourceBatch[0].originPressRunId,
                  startDate: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning();

              remainingBatch = newRemainingBatch[0];

              // Audit logging for new remaining batch
              await publishCreateEvent(
                "batches",
                remainingBatch.id,
                {
                  batchId: remainingBatch.id,
                  vesselId: input.fromVesselId,
                  volumeL: remainingVolumeL,
                  remainingFrom: sourceBatch[0].id,
                },
                ctx.session?.user?.id,
                "Remaining batch created after partial transfer via API",
              );
            } else {
              // Full transfer - source vessel needs cleaning
              await tx
                .update(vessels)
                .set({
                  status: "cleaning",
                  updatedAt: new Date(),
                })
                .where(eq(vessels.id, input.fromVesselId));
            }

            let updatedBatch;
            let blendNote = "";

            if (isBlending) {
              // BLENDING SCENARIO: Combine source batch into destination batch
              const newVolumeL = destCurrentVolumeL + input.volumeL;

              // Update destination batch with combined volume
              updatedBatch = await tx
                .update(batches)
                .set({
                  currentVolume: newVolumeL.toString(),
                  currentVolumeUnit: "L",
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, destBatch[0].id))
                .returning();

              // Mark source batch as blended (soft delete with status update)
              await tx
                .update(batches)
                .set({
                  status: "blended",
                  deletedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, sourceBatch[0].id));

              blendNote = `Blended ${input.volumeL}L from batch ${sourceBatch[0].name || sourceBatch[0].batchNumber} into existing batch ${destBatch[0].name || destBatch[0].batchNumber}. Total volume: ${newVolumeL}L`;

              // Audit logging for blend
              await publishUpdateEvent(
                "batches",
                destBatch[0].id,
                destBatch[0],
                {
                  currentVolume: newVolumeL.toString(),
                  currentVolumeUnit: "L",
                },
                ctx.session?.user?.id,
                blendNote,
              );

              // Audit logging for source batch being blended
              await publishUpdateEvent(
                "batches",
                sourceBatch[0].id,
                sourceBatch[0],
                {
                  status: "blended",
                  deletedAt: new Date(),
                },
                ctx.session?.user?.id,
                `Batch blended into ${destBatch[0].name || destBatch[0].batchNumber} in ${destVessel[0].name || "Unknown Vessel"}`,
              );
            } else {
              // NORMAL TRANSFER: Move the batch to the destination vessel
              updatedBatch = await tx
                .update(batches)
                .set({
                  vesselId: input.toVesselId,
                  currentVolume: input.volumeL.toString(),
                  currentVolumeUnit: "L",
                  updatedAt: new Date(),
                })
                .where(eq(batches.id, sourceBatch[0].id))
                .returning();

              // Update destination vessel status to fermenting
              await tx
                .update(vessels)
                .set({
                  status: "fermenting",
                  updatedAt: new Date(),
                })
                .where(eq(vessels.id, input.toVesselId));

              // Audit logging for batch transfer
              await publishUpdateEvent(
                "batches",
                sourceBatch[0].id,
                sourceBatch[0],
                {
                  vesselId: input.toVesselId,
                  currentVolume: input.volumeL.toString(),
                  currentVolumeUnit: "L",
                },
                ctx.session?.user?.id,
                `Batch transferred to ${destVessel[0].name || "Unknown Vessel"} via API`,
              );
            }

            // Record the transfer in batchTransfers table
            const transferRecord = await tx
              .insert(batchTransfers)
              .values({
                sourceBatchId: sourceBatch[0].id,
                sourceVesselId: input.fromVesselId,
                destinationBatchId: isBlending ? destBatch[0].id : sourceBatch[0].id,
                destinationVesselId: input.toVesselId,
                remainingBatchId: remainingBatch?.id || null,
                volumeTransferred: input.volumeL.toString(),
                volumeTransferredUnit: "L",
                loss: (input.loss || 0).toString(),
                lossUnit: "L",
                totalVolumeProcessed: transferVolumeL.toString(),
                totalVolumeProcessedUnit: "L",
                remainingVolume:
                  remainingVolumeL > 0 ? remainingVolumeL.toString() : null,
                remainingVolumeUnit: "L",
                notes: isBlending
                  ? `BLEND: ${blendNote}${input.notes ? ` | ${input.notes}` : ""}`
                  : input.notes,
                transferredBy: ctx.session?.user?.id,
                transferredAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            const message = isBlending
              ? `Successfully blended ${input.volumeL}L${input.loss ? ` (${input.loss}L loss)` : ""} from ${sourceVessel[0].name || "Unknown"} into ${destVessel[0].name || "Unknown"}. ${blendNote}${remainingVolumeL > 0 ? ` Remaining batch created with ${remainingVolumeL}L` : ""}.`
              : `Successfully transferred ${input.volumeL}L${input.loss ? ` (${input.loss}L loss)` : ""} from ${sourceVessel[0].name || "Unknown"} to ${destVessel[0].name || "Unknown"}. Batch moved to new vessel${remainingVolumeL > 0 ? `, remaining batch created with ${remainingVolumeL}L` : ""}.`;

            return {
              success: true,
              message,
              transferredBatch: updatedBatch[0],
              remainingSourceBatch: remainingBatch,
              transferRecord: transferRecord[0],
              isBlend: isBlending,
            };
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error transferring vessel liquid:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to transfer vessel liquid",
          });
        }
      }),
    getTransferHistory: createRbacProcedure("read", "vessel")
      .input(
        z.object({
          vesselId: z.string().uuid().optional(),
          batchId: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        try {
          let whereClause = and(isNull(batchTransfers.deletedAt));

          if (input.vesselId) {
            whereClause = and(
              whereClause,
              or(
                eq(batchTransfers.sourceVesselId, input.vesselId),
                eq(batchTransfers.destinationVesselId, input.vesselId),
              ),
            );
          }

          if (input.batchId) {
            whereClause = and(
              whereClause,
              or(
                eq(batchTransfers.sourceBatchId, input.batchId),
                eq(batchTransfers.destinationBatchId, input.batchId),
                eq(batchTransfers.remainingBatchId, input.batchId),
              ),
            );
          }

          // Create aliased tables
          const sv = aliasedTable(vessels, "sv");
          const dv = aliasedTable(vessels, "dv");
          const u = aliasedTable(users, "u");
          const sb = aliasedTable(batches, "sb");
          const db_alias = aliasedTable(batches, "db");
          const rb = aliasedTable(batches, "rb");

          const transfers = await db
            .select({
              id: batchTransfers.id,
              sourceBatchId: batchTransfers.sourceBatchId,
              sourceVesselId: batchTransfers.sourceVesselId,
              sourceVesselName: sv.name,
              destinationBatchId: batchTransfers.destinationBatchId,
              destinationVesselId: batchTransfers.destinationVesselId,
              destinationVesselName: dv.name,
              remainingBatchId: batchTransfers.remainingBatchId,
              volumeTransferred: batchTransfers.volumeTransferred,
              volumeTransferredUnit: batchTransfers.volumeTransferredUnit,
              loss: batchTransfers.loss,
              lossUnit: batchTransfers.lossUnit,
              totalVolumeProcessed: batchTransfers.totalVolumeProcessed,
              totalVolumeProcessedUnit: batchTransfers.totalVolumeProcessedUnit,
              remainingVolume: batchTransfers.remainingVolume,
              remainingVolumeUnit: batchTransfers.remainingVolumeUnit,
              notes: batchTransfers.notes,
              transferredAt: batchTransfers.transferredAt,
              transferredBy: batchTransfers.transferredBy,
              transferredByName: u.name,
              sourceBatchName: sb.name,
              destinationBatchName: db_alias.name,
              remainingBatchName: rb.name,
            })
            .from(batchTransfers)
            .leftJoin(sv, eq(batchTransfers.sourceVesselId, sv.id))
            .leftJoin(dv, eq(batchTransfers.destinationVesselId, dv.id))
            .leftJoin(u, eq(batchTransfers.transferredBy, u.id))
            .leftJoin(sb, eq(batchTransfers.sourceBatchId, sb.id))
            .leftJoin(
              db_alias,
              eq(batchTransfers.destinationBatchId, db_alias.id),
            )
            .leftJoin(rb, eq(batchTransfers.remainingBatchId, rb.id))
            .where(whereClause)
            .orderBy(desc(batchTransfers.transferredAt))
            .limit(input.limit)
            .offset(input.offset);

          const totalCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(batchTransfers)
            .where(whereClause);

          return {
            transfers,
            totalCount: totalCount[0]?.count || 0,
            limit: input.limit,
            offset: input.offset,
          };
        } catch (error) {
          console.error("Error getting transfer history:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get transfer history",
          });
        }
      }),

    // Purge vessel - delete batch and/or clear completed press runs
    purge: createRbacProcedure("update", "vessel")
      .input(
        z.object({
          vesselId: z.string().uuid("Invalid vessel ID"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Find active batch in vessel
          const activeBatch = await db
            .select()
            .from(batches)
            .where(
              and(
                eq(batches.vesselId, input.vesselId),
                eq(batches.status, "active"),
                isNull(batches.deletedAt),
              ),
            )
            .limit(1);

          // Find completed press runs in vessel
          const completedPressRuns = await db
            .select()
            .from(applePressRuns)
            .where(
              and(
                eq(applePressRuns.vesselId, input.vesselId),
                eq(applePressRuns.status, "completed"),
                isNull(applePressRuns.deletedAt),
              ),
            );

          if (!activeBatch.length && !completedPressRuns.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No liquid found in this vessel",
            });
          }

          // Soft delete the batch if it exists
          if (activeBatch.length) {
            await db
              .update(batches)
              .set({
                deletedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(batches.id, activeBatch[0].id));

            // Publish audit event for batch deletion
            await publishDeleteEvent(
              "batches",
              activeBatch[0].id,
              {
                batchId: activeBatch[0].id,
                vesselId: input.vesselId,
                reason: "Vessel purged",
              },
              ctx.session?.user?.id,
              "Batch deleted via vessel purge",
            );
          }

          // Clear vessel association from completed press runs
          if (completedPressRuns.length) {
            for (const pressRun of completedPressRuns) {
              await db
                .update(applePressRuns)
                .set({
                  vesselId: null,
                  updatedAt: new Date(),
                })
                .where(eq(applePressRuns.id, pressRun.id));
            }
          }

          // Update vessel to cleaning (needs cleaning after being emptied)
          await db
            .update(vessels)
            .set({
              status: "cleaning",
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, input.vesselId));

          const messages = [];
          if (activeBatch.length) {
            messages.push(`batch ${activeBatch[0].batchNumber} deleted`);
          }
          if (completedPressRuns.length) {
            messages.push(
              `${completedPressRuns.length} completed press run(s) cleared`,
            );
          }

          return {
            success: true,
            message: `Vessel purged: ${messages.join(", ")}`,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error purging vessel:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to purge vessel",
          });
        }
      }),
  }),

  // COGS and Reporting
  reports: router({
    cogsPerBatch: createRbacProcedure("list", "reports").query(async () => {
      try {
        // TODO: Implement when batchCosts and cogsItems tables are created
        return {
          batches: [] as Array<{
            batchId: string;
            batchNumber: string;
            batchStatus: string;
            totalAppleCost: string;
            laborCost: string;
            overheadCost: string;
            packagingCost: string;
            totalCost: string;
            costPerBottle: string | null;
            costPerL: string | null;
            calculatedAt: Date | null;
            initialVolume: string | null;
            initialVolumeUnit: string | null;
            currentVolume: string | null;
            currentVolumeUnit: string | null;
          }>,
          count: 0,
        };
        /* const batchCostData = await db
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
            initialVolume: batches.initialVolume,
            initialVolumeUnit: batches.initialVolumeUnit,
            currentVolume: batches.currentVolume,
            currentVolumeUnit: batches.currentVolumeUnit,
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
        } */
      } catch (error) {
        console.error("Error getting COGS per batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get COGS per batch",
        });
      }
    }),

    cogsBatchDetail: createRbacProcedure("list", "reports")
      .input(z.object({ batchId: z.string().uuid() }))
      .query(async ({ input }) => {
        try {
          const batch = await db
            .select()
            .from(batches)
            .where(
              and(eq(batches.id, input.batchId), isNull(batches.deletedAt)),
            )
            .limit(1);

          if (!batch.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found",
            });
          }

          // TODO: Implement when batchCosts and cogsItems tables are created
          return {
            batch: batch[0],
            costs: null,
            cogsBreakdown: [],
          };

          /* const costs = await db
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
          } */
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error getting batch COGS detail:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get batch COGS detail",
          });
        }
      }),
  }),

  // Legacy test endpoints for backward compatibility
  vendors: router({
    list: createRbacProcedure("list", "vendor").query(({ ctx }) => {
      return {
        message: "Listing vendors (RBAC: list vendor)",
        user: ctx.session?.user?.email,
        role: ctx.session?.user?.role,
      };
    }),

    delete: createRbacProcedure("delete", "vendor")
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => {
        return {
          message: `Deleting vendor ${input.id} (RBAC: delete vendor)`,
          user: ctx.session?.user?.email,
          role: ctx.session?.user?.role,
        };
      }),
  }),

  users: router({
    create: createRbacProcedure("create", "user")
      .input(z.object({ email: z.string().email() }))
      .mutation(({ ctx, input }) => {
        return {
          message: `Creating user ${input.email} (RBAC: create user)`,
          user: ctx.session?.user?.email,
          role: ctx.session?.user?.role,
        };
      }),
  }),

  // Apple Press Run management - mobile workflow
  pressRun: pressRunRouter,

  // Invoice number generation
  invoiceNumber: invoiceNumberRouter,

  // Vendor variety management
  vendorVariety: vendorVarietyRouter,

  // Health check and system monitoring
  health: healthRouter,

  // Inventory management
  inventory: inventoryRouter,

  // PDF report generation
  pdfReports: reportsRouter,

  // Audit logging and reporting
  audit: auditRouter,

  // Purchase management for different material types
  additivePurchases: additivePurchasesRouter,
  baseFruitPurchases: baseFruitPurchasesRouter,
  juicePurchases: juicePurchasesRouter,
  packagingPurchases: packagingPurchasesRouter,

  // Variety management
  additiveVarieties: additiveVarietiesRouter,
  juiceVarieties: juiceVarietiesRouter,
  packagingVarieties: packagingVarietiesRouter,
});

export type AppRouter = typeof appRouter;
