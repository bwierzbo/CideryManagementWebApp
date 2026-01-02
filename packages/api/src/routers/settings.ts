import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db, systemSettings, organizations, organizationSettings } from "db";
import { eq } from "drizzle-orm";

/**
 * Settings Router
 * Handles system-wide configuration settings
 */
export const settingsRouter = router({
  /**
   * Get current timezone setting
   * Available to all authenticated users
   */
  getTimezone: protectedProcedure.query(async () => {
    try {
      const setting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "timezone"))
        .limit(1);

      // Return the timezone value or default to Pacific
      if (setting[0]?.value) {
        // The value is stored as JSONB, so we need to extract the string
        return setting[0].value as string;
      }

      return "America/Los_Angeles";
    } catch (error) {
      console.error("Error fetching timezone:", error);
      return "America/Los_Angeles";
    }
  }),

  /**
   * Update timezone setting
   * Admin only
   */
  updateTimezone: adminProcedure
    .input(
      z.object({
        timezone: z.string().min(1, "Timezone is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Upsert the timezone setting
        await db
          .insert(systemSettings)
          .values({
            key: "timezone",
            value: input.timezone as any,
            updatedAt: new Date(),
            updatedBy: ctx.session.user.id,
          })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              value: input.timezone as any,
              updatedAt: new Date(),
              updatedBy: ctx.session.user.id,
            },
          });

        return {
          success: true,
          message: `Timezone updated to ${input.timezone}`,
        };
      } catch (error) {
        console.error("Error updating timezone:", error);
        throw new Error("Failed to update timezone");
      }
    }),

  /**
   * Get organization settings
   * Available to all authenticated users
   * Returns the settings for the default organization
   */
  getOrganizationSettings: protectedProcedure.query(async () => {
    const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

    const settings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
      .limit(1);

    if (!settings[0]) {
      // Return default settings if none exist
      return {
        id: "",
        organizationId: DEFAULT_ORG_ID,
        name: "My Cidery",
        address: null,
        email: null,
        phone: null,
        website: null,
        logo: null,
        ubiNumber: null,
        einNumber: null,
        ttbPermitNumber: null,
        stateLicenseNumber: null,
        fruitSource: ["purchase_fruit"],
        productionScale: "small" as const,
        productTypes: ["cider"],
        fruitPurchasesEnabled: true,
        pressRunsEnabled: true,
        juicePurchasesEnabled: true,
        barrelAgingEnabled: true,
        carbonationEnabled: true,
        bottleConditioningEnabled: false,
        keggingEnabled: true,
        bottlingEnabled: true,
        canningEnabled: false,
        ttbReportingEnabled: true,
        spiritsInventoryEnabled: false,
        packageTypes: ["bottle", "keg"],
        carbonationMethods: ["forced"],
        defaultTargetCO2: "2.70",
        stalledBatchDays: 14,
        longAgingDays: 90,
        lowInventoryThreshold: 24,
        ttbReminderDays: 7,
        volumeUnits: "gallons" as const,
        volumeShowSecondary: false,
        weightUnits: "pounds" as const,
        weightShowSecondary: false,
        temperatureUnits: "fahrenheit" as const,
        temperatureShowSecondary: false,
        densityUnits: "sg" as const,
        densityShowSecondary: false,
        pressureUnits: "psi" as const,
        pressureShowSecondary: false,
        dateFormat: "mdy" as const,
        timeFormat: "12h" as const,
        theme: "system" as const,
        defaultCurrency: "USD",
        sgDecimalPlaces: 3,
        phDecimalPlaces: 1,
        sgTemperatureCorrectionEnabled: true,
        hydrometerCalibrationTempC: "15.56",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return settings[0];
  }),

  /**
   * Update organization settings
   * Admin only
   */
  updateOrganizationSettings: adminProcedure
    .input(
      z.object({
        // Organization Profile
        name: z.string().min(1).optional(),
        address: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        website: z.string().nullable().optional(),
        logo: z.string().nullable().optional(),

        // Business Identification Numbers
        ubiNumber: z.string().nullable().optional(),
        einNumber: z.string().nullable().optional(),
        ttbPermitNumber: z.string().nullable().optional(),
        stateLicenseNumber: z.string().nullable().optional(),

        // Operation Type
        fruitSource: z.array(z.string()).optional(),
        productionScale: z.enum(["nano", "small", "medium", "large"]).optional(),
        productTypes: z.array(z.string()).optional(),

        // Workflow Modules
        fruitPurchasesEnabled: z.boolean().optional(),
        pressRunsEnabled: z.boolean().optional(),
        juicePurchasesEnabled: z.boolean().optional(),
        barrelAgingEnabled: z.boolean().optional(),
        carbonationEnabled: z.boolean().optional(),
        bottleConditioningEnabled: z.boolean().optional(),
        keggingEnabled: z.boolean().optional(),
        bottlingEnabled: z.boolean().optional(),
        canningEnabled: z.boolean().optional(),
        ttbReportingEnabled: z.boolean().optional(),
        spiritsInventoryEnabled: z.boolean().optional(),

        // Packaging Config
        packageTypes: z.array(z.string()).optional(),
        carbonationMethods: z.array(z.string()).optional(),
        defaultTargetCO2: z.string().optional(),

        // Alert Thresholds
        stalledBatchDays: z.number().int().positive().optional(),
        longAgingDays: z.number().int().positive().optional(),
        lowInventoryThreshold: z.number().int().positive().optional(),
        ttbReminderDays: z.number().int().positive().optional(),

        // UX Preferences - Units
        volumeUnits: z.enum(["gallons", "liters"]).optional(),
        volumeShowSecondary: z.boolean().optional(),
        weightUnits: z.enum(["pounds", "kilograms"]).optional(),
        weightShowSecondary: z.boolean().optional(),
        temperatureUnits: z.enum(["fahrenheit", "celsius"]).optional(),
        temperatureShowSecondary: z.boolean().optional(),
        densityUnits: z.enum(["sg", "brix", "plato"]).optional(),
        densityShowSecondary: z.boolean().optional(),
        pressureUnits: z.enum(["psi", "bar"]).optional(),
        pressureShowSecondary: z.boolean().optional(),

        // UX Preferences - Display
        dateFormat: z.enum(["mdy", "dmy", "ymd"]).optional(),
        timeFormat: z.enum(["12h", "24h"]).optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
        defaultCurrency: z.string().optional(),

        // UX Preferences - Decimal Places
        sgDecimalPlaces: z.number().int().min(2).max(4).optional(),
        phDecimalPlaces: z.number().int().min(1).max(3).optional(),

        // Measurement Corrections
        sgTemperatureCorrectionEnabled: z.boolean().optional(),
        hydrometerCalibrationTempC: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      // Copy all provided fields
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      await db
        .update(organizationSettings)
        .set(updateData)
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID));

      return { success: true };
    }),
});

export type SettingsRouter = typeof settingsRouter;
