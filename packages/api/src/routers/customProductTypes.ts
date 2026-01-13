import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db, customProductTypes } from "db";
import { eq, and, asc, sql } from "drizzle-orm";

// Default organization ID for single-org application
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Zod schemas for validation
const measurementTypeSchema = z.enum([
  "sg",
  "abv",
  "ph",
  "temperature",
  "sensory",
  "volume",
]);

const alertTypeSchema = z.enum(["check_in_reminder", "measurement_overdue"]);

const primaryMeasurementSchema = z.enum(["sg", "abv", "sensory", "ph"]);

export const customProductTypesRouter = router({
  // List all custom product types for the organization
  list: protectedProcedure.query(async () => {
    const types = await db
      .select()
      .from(customProductTypes)
      .orderBy(asc(customProductTypes.sortOrder), asc(customProductTypes.name));

    return types;
  }),

  // Get single custom product type by ID
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const { id } = input;

      const result = await db
        .select()
        .from(customProductTypes)
        .where(eq(customProductTypes.id, id))
        .limit(1);

      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Custom product type not found",
        });
      }

      return result[0];
    }),

  // Get custom product type by slug
  getBySlug: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { slug } = input;

      const result = await db
        .select()
        .from(customProductTypes)
        .where(eq(customProductTypes.slug, slug))
        .limit(1);

      if (!result.length) {
        return null;
      }

      return result[0];
    }),

  // Create new custom product type
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        slug: z
          .string()
          .min(1, "Slug is required")
          .regex(
            /^[a-z0-9-]+$/,
            "Slug must be lowercase letters, numbers, and hyphens only"
          ),
        description: z.string().optional(),
        initialMeasurementTypes: z.array(measurementTypeSchema).default([]),
        ongoingMeasurementTypes: z.array(measurementTypeSchema).default([]),
        primaryMeasurement: primaryMeasurementSchema.default("sg"),
        usesFermentationStages: z.boolean().default(false),
        defaultIntervalDays: z.number().int().min(1).nullable().default(null),
        alertType: alertTypeSchema.nullable().default(null),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        name,
        slug,
        description,
        initialMeasurementTypes,
        ongoingMeasurementTypes,
        primaryMeasurement,
        usesFermentationStages,
        defaultIntervalDays,
        alertType,
        sortOrder,
      } = input;

      const organizationId = DEFAULT_ORG_ID;

      // Check if slug already exists for this organization
      const existing = await db
        .select()
        .from(customProductTypes)
        .where(
          and(
            eq(customProductTypes.organizationId, organizationId),
            eq(customProductTypes.slug, slug)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A custom product type with slug "${slug}" already exists`,
        });
      }

      // Check if slug conflicts with built-in product types
      const builtInSlugs = ["cider", "perry", "brandy", "pommeau", "juice"];
      if (builtInSlugs.includes(slug)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${slug}" is a built-in product type and cannot be used as a custom slug`,
        });
      }

      const result = await db
        .insert(customProductTypes)
        .values({
          organizationId,
          name,
          slug,
          description,
          initialMeasurementTypes,
          ongoingMeasurementTypes,
          primaryMeasurement,
          usesFermentationStages,
          defaultIntervalDays,
          alertType,
          sortOrder,
          isActive: true,
        })
        .returning();

      return result[0];
    }),

  // Update custom product type
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "Name is required"),
        slug: z
          .string()
          .min(1, "Slug is required")
          .regex(
            /^[a-z0-9-]+$/,
            "Slug must be lowercase letters, numbers, and hyphens only"
          ),
        description: z.string().optional(),
        initialMeasurementTypes: z.array(measurementTypeSchema).default([]),
        ongoingMeasurementTypes: z.array(measurementTypeSchema).default([]),
        primaryMeasurement: primaryMeasurementSchema.default("sg"),
        usesFermentationStages: z.boolean().default(false),
        defaultIntervalDays: z.number().int().min(1).nullable().default(null),
        alertType: alertTypeSchema.nullable().default(null),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        id,
        name,
        slug,
        description,
        initialMeasurementTypes,
        ongoingMeasurementTypes,
        primaryMeasurement,
        usesFermentationStages,
        defaultIntervalDays,
        alertType,
        sortOrder,
        isActive,
      } = input;

      const organizationId = DEFAULT_ORG_ID;

      // Check if custom product type exists and belongs to this organization
      const existing = await db
        .select()
        .from(customProductTypes)
        .where(
          and(
            eq(customProductTypes.id, id),
            eq(customProductTypes.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Custom product type not found",
        });
      }

      // Check if slug already exists for another type in this organization
      const slugConflict = await db
        .select()
        .from(customProductTypes)
        .where(
          and(
            eq(customProductTypes.organizationId, organizationId),
            eq(customProductTypes.slug, slug),
            sql`${customProductTypes.id} != ${id}`
          )
        )
        .limit(1);

      if (slugConflict.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A custom product type with slug "${slug}" already exists`,
        });
      }

      // Check if slug conflicts with built-in product types
      const builtInSlugs = ["cider", "perry", "brandy", "pommeau", "juice"];
      if (builtInSlugs.includes(slug)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${slug}" is a built-in product type and cannot be used as a custom slug`,
        });
      }

      const result = await db
        .update(customProductTypes)
        .set({
          name,
          slug,
          description,
          initialMeasurementTypes,
          ongoingMeasurementTypes,
          primaryMeasurement,
          usesFermentationStages,
          defaultIntervalDays,
          alertType,
          sortOrder,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(customProductTypes.id, id))
        .returning();

      return result[0];
    }),

  // Delete custom product type
  delete: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const organizationId = DEFAULT_ORG_ID;

      // Check if custom product type exists and belongs to this organization
      const existing = await db
        .select()
        .from(customProductTypes)
        .where(
          and(
            eq(customProductTypes.id, id),
            eq(customProductTypes.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Custom product type not found",
        });
      }

      // Hard delete the custom product type
      // Note: Batches using this type will retain their productType string
      await db.delete(customProductTypes).where(eq(customProductTypes.id, id));

      return { message: "Custom product type deleted successfully" };
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, isActive } = input;
      const organizationId = DEFAULT_ORG_ID;

      // Check if custom product type exists and belongs to this organization
      const existing = await db
        .select()
        .from(customProductTypes)
        .where(
          and(
            eq(customProductTypes.id, id),
            eq(customProductTypes.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Custom product type not found",
        });
      }

      const result = await db
        .update(customProductTypes)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(customProductTypes.id, id))
        .returning();

      return result[0];
    }),

  // Reorder custom product types
  reorder: adminProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items } = input;
      const organizationId = DEFAULT_ORG_ID;

      // Update sort order for each item
      for (const item of items) {
        await db
          .update(customProductTypes)
          .set({
            sortOrder: item.sortOrder,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customProductTypes.id, item.id),
              eq(customProductTypes.organizationId, organizationId)
            )
          );
      }

      return { message: "Sort order updated successfully" };
    }),
});
