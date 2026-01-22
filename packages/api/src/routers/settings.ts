import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  db,
  systemSettings,
  organizations,
  organizationSettings,
  bottleRuns,
  type MeasurementSchedules,
} from "db";
import { eq, and, gte, lt, sql } from "drizzle-orm";

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
        // Overhead settings defaults
        overheadTrackingEnabled: false,
        overheadAnnualRent: null,
        overheadAnnualUtilities: null,
        overheadAnnualInsurance: null,
        overheadAnnualEquipment: null,
        overheadAnnualLicenses: null,
        overheadAnnualOther: null,
        overheadAnnualBudget: null,
        overheadExpectedAnnualGallons: null,
        overheadRatePerGallon: null,
        overheadBudgetYear: null,
        // Tax reporting preferences
        taxState: null,
        ttbReportingFrequency: "quarterly",
        stateTaxReportingFrequency: "quarterly",
        estimatedAnnualTaxLiability: null,
        // TTB Onboarding
        ttbOnboardingCompletedAt: null,
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

        // Overhead Cost Allocation
        overheadTrackingEnabled: z.boolean().optional(),
        overheadAnnualRent: z.string().nullable().optional(),
        overheadAnnualUtilities: z.string().nullable().optional(),
        overheadAnnualInsurance: z.string().nullable().optional(),
        overheadAnnualEquipment: z.string().nullable().optional(),
        overheadAnnualLicenses: z.string().nullable().optional(),
        overheadAnnualOther: z.string().nullable().optional(),
        overheadAnnualBudget: z.string().nullable().optional(),
        overheadExpectedAnnualGallons: z.string().nullable().optional(),
        overheadRatePerGallon: z.string().nullable().optional(),
        overheadBudgetYear: z.number().int().nullable().optional(),

        // Tax Reporting Preferences
        taxState: z.string().nullable().optional(),
        ttbReportingFrequency: z.enum(["monthly", "quarterly", "annual"]).optional(),
        stateTaxReportingFrequency: z.enum(["monthly", "quarterly", "annual"]).optional(),
        estimatedAnnualTaxLiability: z.string().nullable().optional(),

        // TTB Onboarding
        ttbOnboardingCompletedAt: z.coerce.date().nullable().optional(),
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

  /**
   * Get overhead rate for COGS calculations
   * Returns the rate per gallon if overhead tracking is enabled
   */
  getOverheadRate: protectedProcedure.query(async () => {
    const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

    const settings = await db
      .select({
        overheadTrackingEnabled: organizationSettings.overheadTrackingEnabled,
        overheadRatePerGallon: organizationSettings.overheadRatePerGallon,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
      .limit(1);

    if (!settings[0] || !settings[0].overheadTrackingEnabled) {
      return { enabled: false, ratePerGallon: null };
    }

    return {
      enabled: true,
      ratePerGallon: settings[0].overheadRatePerGallon
        ? parseFloat(settings[0].overheadRatePerGallon)
        : null,
    };
  }),

  /**
   * Get year-end overhead summary
   * Compares budgeted overhead to actual allocated based on production volume
   */
  getOverheadYearEndSummary: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
      }),
    )
    .query(async ({ input }) => {
      const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

      // Get overhead settings
      const settings = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
        .limit(1);

      if (!settings[0]) {
        return {
          hasData: false,
          message: "No organization settings found",
        };
      }

      const {
        overheadTrackingEnabled,
        overheadAnnualBudget,
        overheadExpectedAnnualGallons,
        overheadRatePerGallon,
        overheadBudgetYear,
      } = settings[0];

      if (!overheadTrackingEnabled) {
        return {
          hasData: false,
          message: "Overhead tracking is not enabled",
        };
      }

      if (!overheadAnnualBudget || !overheadRatePerGallon) {
        return {
          hasData: false,
          message: "Overhead budget or rate not configured",
        };
      }

      // Calculate date range for the requested year
      const startDate = new Date(`${input.year}-01-01T00:00:00Z`);
      const endDate = new Date(`${input.year + 1}-01-01T00:00:00Z`);

      // Get total production volume for the year from bottle runs
      // Sum up the volumeTakenLiters from all completed bottle runs
      const productionResult = await db
        .select({
          totalVolumeL: sql<number>`COALESCE(SUM(${bottleRuns.volumeTakenLiters}), 0)`,
          runCount: sql<number>`COUNT(*)`,
        })
        .from(bottleRuns)
        .where(
          and(
            gte(bottleRuns.createdAt, startDate),
            lt(bottleRuns.createdAt, endDate),
            eq(bottleRuns.status, "completed"),
          ),
        );

      const totalVolumeL = Number(productionResult[0]?.totalVolumeL || 0);
      const runCount = Number(productionResult[0]?.runCount || 0);

      // Convert liters to gallons (1 gallon = 3.78541 liters)
      const totalVolumeGallons = totalVolumeL / 3.78541;

      const budget = parseFloat(overheadAnnualBudget);
      const rate = parseFloat(overheadRatePerGallon);
      const expectedGallons = overheadExpectedAnnualGallons
        ? parseFloat(overheadExpectedAnnualGallons)
        : 0;

      // Calculate allocated overhead based on actual production
      const allocatedOverhead = totalVolumeGallons * rate;

      // Calculate variance
      const variance = budget - allocatedOverhead;
      const variancePercent = budget > 0 ? (variance / budget) * 100 : 0;

      // Suggest new rate for next year based on actual production
      const suggestedRate =
        totalVolumeGallons > 0 ? budget / totalVolumeGallons : rate;

      return {
        hasData: true,
        year: input.year,
        budgetYear: overheadBudgetYear,
        budget: {
          annualBudget: budget,
          expectedGallons: expectedGallons,
          ratePerGallon: rate,
        },
        actual: {
          totalVolumeGallons: Math.round(totalVolumeGallons * 100) / 100,
          packagingRunCount: runCount,
          allocatedOverhead: Math.round(allocatedOverhead * 100) / 100,
        },
        analysis: {
          variance: Math.round(variance * 100) / 100,
          variancePercent: Math.round(variancePercent * 100) / 100,
          isUnderAllocated: variance > 0,
          suggestedRateForNextYear: Math.round(suggestedRate * 10000) / 10000,
          recommendation:
            variance > 0
              ? `Under-allocated by $${Math.abs(variance).toFixed(2)}. Consider increasing rate to $${suggestedRate.toFixed(4)}/gal for ${input.year + 1}.`
              : variance < 0
                ? `Over-allocated by $${Math.abs(variance).toFixed(2)}. Consider decreasing rate to $${suggestedRate.toFixed(4)}/gal for ${input.year + 1}.`
                : "Overhead allocation matches budget perfectly.",
        },
      };
    }),

  /**
   * Update measurement schedule for a specific product type
   * Admin only
   */
  updateMeasurementSchedule: adminProcedure
    .input(
      z.object({
        productType: z.enum(["cider", "perry", "brandy", "pommeau", "juice"]),
        config: z.object({
          initialMeasurementTypes: z.array(
            z.enum(["sg", "abv", "ph", "temperature", "sensory", "volume"])
          ),
          ongoingMeasurementTypes: z.array(
            z.enum(["sg", "abv", "ph", "temperature", "sensory", "volume"])
          ),
          primaryMeasurement: z.enum(["sg", "abv", "sensory", "ph"]),
          usesFermentationStages: z.boolean(),
          defaultIntervalDays: z.number().int().min(1).nullable(),
          alertType: z
            .enum(["check_in_reminder", "measurement_overdue"])
            .nullable(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

      // Get current measurement schedules
      const settings = await db
        .select({ measurementSchedules: organizationSettings.measurementSchedules })
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
        .limit(1);

      // Merge the new config with existing schedules
      const currentSchedules = settings[0]?.measurementSchedules || {};
      const updatedSchedules: MeasurementSchedules = {
        ...currentSchedules,
        [input.productType]: input.config,
      } as MeasurementSchedules;

      // Update the settings
      await db
        .update(organizationSettings)
        .set({
          measurementSchedules: updatedSchedules,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID));

      return { success: true };
    }),

  /**
   * Get measurement schedules for all product types
   * Available to all authenticated users
   */
  getMeasurementSchedules: protectedProcedure.query(async () => {
    const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

    const settings = await db
      .select({ measurementSchedules: organizationSettings.measurementSchedules })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, DEFAULT_ORG_ID))
      .limit(1);

    // Return the schedules or default values
    return (
      settings[0]?.measurementSchedules || {
        cider: {
          initialMeasurementTypes: ["sg", "ph", "temperature"],
          ongoingMeasurementTypes: ["sg", "ph", "temperature"],
          primaryMeasurement: "sg",
          usesFermentationStages: true,
          defaultIntervalDays: null,
          alertType: "measurement_overdue",
        },
        perry: {
          initialMeasurementTypes: ["sg", "ph", "temperature"],
          ongoingMeasurementTypes: ["sg", "ph", "temperature"],
          primaryMeasurement: "sg",
          usesFermentationStages: true,
          defaultIntervalDays: null,
          alertType: "measurement_overdue",
        },
        brandy: {
          initialMeasurementTypes: ["abv"],
          ongoingMeasurementTypes: ["sensory", "volume"],
          primaryMeasurement: "sensory",
          usesFermentationStages: false,
          defaultIntervalDays: 30,
          alertType: "check_in_reminder",
        },
        pommeau: {
          initialMeasurementTypes: ["sg", "ph"],
          ongoingMeasurementTypes: ["sensory", "volume"],
          primaryMeasurement: "sensory",
          usesFermentationStages: false,
          defaultIntervalDays: 90,
          alertType: "check_in_reminder",
        },
        juice: {
          initialMeasurementTypes: ["sg", "ph"],
          ongoingMeasurementTypes: [],
          primaryMeasurement: "sg",
          usesFermentationStages: false,
          defaultIntervalDays: null,
          alertType: null,
        },
      }
    );
  }),

  /**
   * Get recommended TTB reporting frequency based on estimated annual tax liability
   * TTB Rules:
   * - Annual: ≤$1,000/year tax liability
   * - Quarterly: $1,000-$50,000/year
   * - Monthly: >$50,000/year
   */
  getTtbFrequencyRecommendation: protectedProcedure
    .input(
      z.object({
        estimatedAnnualTax: z.number().min(0),
      })
    )
    .query(({ input }) => {
      const { estimatedAnnualTax } = input;

      if (estimatedAnnualTax <= 1000) {
        return {
          recommended: "annual" as const,
          reason: "Annual filing is allowed for tax liability ≤$1,000/year",
        };
      }

      if (estimatedAnnualTax <= 50000) {
        return {
          recommended: "quarterly" as const,
          reason: "Quarterly filing is required for tax liability $1,000-$50,000/year",
        };
      }

      return {
        recommended: "monthly" as const,
        reason: "Monthly filing is required for tax liability >$50,000/year",
      };
    }),
});

export type SettingsRouter = typeof settingsRouter;
