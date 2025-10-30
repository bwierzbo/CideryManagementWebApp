import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  vendorVarieties,
  baseFruitVarieties,
  vendors,
  auditLogs,
} from "db";
import { eq, and, isNull, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { ensureVendorVariety, createVendorVariety } from "../lib/dbChecks";

export const vendorVarietyRouter = router({
  listForVendor: createRbacProcedure("list", "vendor")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Fetch only base fruit varieties
        const baseFruitVarietiesData = await db
          .select({
            id: baseFruitVarieties.id,
            name: baseFruitVarieties.name,
            isActive: baseFruitVarieties.isActive,
            vendorVarietyId: vendorVarieties.id,
            linkedAt: vendorVarieties.createdAt,
          })
          .from(vendorVarieties)
          .innerJoin(
            baseFruitVarieties,
            eq(vendorVarieties.varietyId, baseFruitVarieties.id),
          )
          .where(
            and(
              eq(vendorVarieties.vendorId, input.vendorId),
              isNull(vendorVarieties.deletedAt),
              isNull(baseFruitVarieties.deletedAt),
              eq(baseFruitVarieties.isActive, true),
            ),
          )
          .orderBy(baseFruitVarieties.name);

        return {
          varieties: baseFruitVarietiesData,
          count: baseFruitVarietiesData.length,
        };
      } catch (error) {
        console.error("Error listing vendor varieties:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list vendor varieties",
        });
      }
    }),

  attach: createRbacProcedure("update", "vendor")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
        varietyNameOrId: z.string().min(1, "Variety name or ID is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // First verify vendor exists
          const vendor = await tx
            .select({ id: vendors.id, name: vendors.name })
            .from(vendors)
            .where(
              and(eq(vendors.id, input.vendorId), eq(vendors.isActive, true)),
            )
            .limit(1);

          if (!vendor.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vendor not found",
            });
          }

          let varietyId: string;
          let varietyName: string;

          // Check if input is a UUID (existing variety)
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              input.varietyNameOrId,
            );

          if (isUuid) {
            // It's an ID, verify it exists
            const existingVariety = await tx
              .select({
                id: baseFruitVarieties.id,
                name: baseFruitVarieties.name,
              })
              .from(baseFruitVarieties)
              .where(
                and(
                  eq(baseFruitVarieties.id, input.varietyNameOrId),
                  isNull(baseFruitVarieties.deletedAt),
                ),
              )
              .limit(1);

            if (!existingVariety.length) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Fruit variety not found",
              });
            }

            varietyId = existingVariety[0].id;
            varietyName = existingVariety[0].name;
          } else {
            // It's a name, check if variety exists first
            const existingVariety = await tx
              .select({
                id: baseFruitVarieties.id,
                name: baseFruitVarieties.name,
              })
              .from(baseFruitVarieties)
              .where(
                and(
                  ilike(baseFruitVarieties.name, input.varietyNameOrId.trim()),
                  isNull(baseFruitVarieties.deletedAt),
                ),
              )
              .limit(1);

            if (existingVariety.length) {
              // Variety exists, use it
              varietyId = existingVariety[0].id;
              varietyName = existingVariety[0].name;
            } else {
              // Create new variety
              const newVariety = await tx
                .insert(baseFruitVarieties)
                .values({
                  name: input.varietyNameOrId.trim(),
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning();

              varietyId = newVariety[0].id;
              varietyName = newVariety[0].name;

              // Audit log for variety creation
              await tx.insert(auditLogs).values({
                tableName: "base_fruit_varieties",
                recordId: varietyId,
                operation: "create",
                newData: { varietyId, name: varietyName },
                changedBy: ctx.session?.user?.id,
                reason: "Auto-created when linking to vendor",
              });
            }
          }

          // Check if link already exists
          const existingLink = await tx
            .select({ id: vendorVarieties.id })
            .from(vendorVarieties)
            .where(
              and(
                eq(vendorVarieties.vendorId, input.vendorId),
                eq(vendorVarieties.varietyId, varietyId),
                isNull(vendorVarieties.deletedAt),
              ),
            )
            .limit(1);

          if (existingLink.length) {
            return {
              success: true,
              alreadyExists: true,
              varietyId,
              varietyName,
              message: `${vendor[0].name} is already linked to ${varietyName}`,
            };
          }

          // Create the vendor-variety link
          const newLink = await tx
            .insert(vendorVarieties)
            .values({
              vendorId: input.vendorId,
              varietyId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Audit log for vendor-variety link creation
          await tx.insert(auditLogs).values({
            tableName: "vendor_varieties",
            recordId: newLink[0].id,
            operation: "create",
            newData: {
              vendorId: input.vendorId,
              varietyId,
              vendorName: vendor[0].name,
              varietyName,
            },
            changedBy: ctx.session?.user?.id,
            reason: "Vendor-variety link created via API",
          });

          return {
            success: true,
            alreadyExists: false,
            varietyId,
            varietyName,
            linkId: newLink[0].id,
            message: `${vendor[0].name} linked to ${varietyName}`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error attaching vendor variety:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to attach vendor variety",
        });
      }
    }),

  detach: createRbacProcedure("update", "vendor")
    .input(
      z.object({
        vendorId: z.string().uuid("Invalid vendor ID"),
        varietyId: z.string().uuid("Invalid variety ID"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async (tx) => {
          // Find the vendor-variety link
          const existingLink = await tx
            .select({
              id: vendorVarieties.id,
              vendorName: vendors.name,
              varietyName: baseFruitVarieties.name,
            })
            .from(vendorVarieties)
            .leftJoin(vendors, eq(vendorVarieties.vendorId, vendors.id))
            .leftJoin(
              baseFruitVarieties,
              eq(vendorVarieties.varietyId, baseFruitVarieties.id),
            )
            .where(
              and(
                eq(vendorVarieties.vendorId, input.vendorId),
                eq(vendorVarieties.varietyId, input.varietyId),
                isNull(vendorVarieties.deletedAt),
              ),
            )
            .limit(1);

          if (!existingLink.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Vendor-variety link not found",
            });
          }

          // Soft delete the link
          await tx
            .update(vendorVarieties)
            .set({
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(vendorVarieties.id, existingLink[0].id));

          // Audit log for detachment
          await tx.insert(auditLogs).values({
            tableName: "vendor_varieties",
            recordId: existingLink[0].id,
            operation: "delete",
            oldData: {
              vendorId: input.vendorId,
              varietyId: input.varietyId,
              vendorName: existingLink[0].vendorName,
              varietyName: existingLink[0].varietyName,
            },
            newData: { deletedAt: new Date() },
            changedBy: ctx.session?.user?.id,
            reason: "Vendor-variety link removed via API",
          });

          return {
            success: true,
            message: `${existingLink[0].vendorName} detached from ${existingLink[0].varietyName}`,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error detaching vendor variety:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to detach vendor variety",
        });
      }
    }),

  search: createRbacProcedure("list", "vendor")
    .input(
      z.object({
        q: z.string().min(1, "Search query is required"),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      try {
        const varieties = await db
          .select({
            id: baseFruitVarieties.id,
            name: baseFruitVarieties.name,
            isActive: baseFruitVarieties.isActive,
          })
          .from(baseFruitVarieties)
          .where(
            and(
              ilike(baseFruitVarieties.name, `%${input.q}%`),
              isNull(baseFruitVarieties.deletedAt),
              eq(baseFruitVarieties.isActive, true),
            ),
          )
          .orderBy(baseFruitVarieties.name)
          .limit(input.limit);

        return {
          varieties,
          count: varieties.length,
          searchQuery: input.q,
        };
      } catch (error) {
        console.error("Error searching apple varieties:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search apple varieties",
        });
      }
    }),
});
