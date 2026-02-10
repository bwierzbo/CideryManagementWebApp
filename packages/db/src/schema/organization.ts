/**
 * Organization Settings Schema
 * Store organization profile and configuration settings
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  decimal,
  integer,
  timestamp,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../schema";
import type { TTBOpeningBalances } from "./ttb";

// ============================================
// ENUMS
// ============================================

// Operation Type Enums
export const productionScaleEnum = pgEnum("production_scale", [
  "nano",
  "small",
  "medium",
  "large",
]);

// UX Preferences - Units Enums
export const volumeUnitsEnum = pgEnum("volume_units", ["gallons", "liters"]);

export const weightUnitsEnum = pgEnum("weight_units", ["pounds", "kilograms"]);

export const temperatureUnitsEnum = pgEnum("temperature_units", [
  "fahrenheit",
  "celsius",
]);

export const densityUnitsEnum = pgEnum("density_units", ["sg", "brix", "plato"]);

export const pressureUnitsEnum = pgEnum("pressure_units", ["psi", "bar"]);

// UX Preferences - Display Enums
export const dateFormatEnum = pgEnum("date_format", ["mdy", "dmy", "ymd"]);

export const timeFormatEnum = pgEnum("time_format", ["12h", "24h"]);

export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);

// ============================================
// ORGANIZATIONS TABLE
// ============================================

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// ============================================
// ORGANIZATION SETTINGS TABLE
// ============================================

export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),

    // ==========================================
    // Organization Profile
    // ==========================================
    name: text("name").notNull(),
    address: text("address"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    logo: text("logo"),

    // Business Identification Numbers
    ubiNumber: text("ubi_number"), // Washington State Unified Business Identifier
    einNumber: text("ein_number"), // Federal Employer Identification Number
    ttbPermitNumber: text("ttb_permit_number"),
    stateLicenseNumber: text("state_license_number"),

    // ==========================================
    // Operation Type
    // ==========================================
    // MULTI-SELECT: can choose any combination from (orchard, purchase_fruit, purchase_juice)
    fruitSource: text("fruit_source")
      .array()
      .notNull()
      .default(["purchase_fruit"]),
    productionScale: productionScaleEnum("production_scale")
      .notNull()
      .default("small"),
    // MULTI-SELECT: can choose any combination from (cider, perry, fortified, other)
    productTypes: text("product_types").array().notNull().default(["cider"]),

    // ==========================================
    // Workflow Modules Enabled
    // ==========================================
    fruitPurchasesEnabled: boolean("fruit_purchases_enabled")
      .notNull()
      .default(true),
    pressRunsEnabled: boolean("press_runs_enabled").notNull().default(true),
    juicePurchasesEnabled: boolean("juice_purchases_enabled")
      .notNull()
      .default(true),
    barrelAgingEnabled: boolean("barrel_aging_enabled").notNull().default(true),
    carbonationEnabled: boolean("carbonation_enabled").notNull().default(true),
    bottleConditioningEnabled: boolean("bottle_conditioning_enabled")
      .notNull()
      .default(false),
    keggingEnabled: boolean("kegging_enabled").notNull().default(true),
    bottlingEnabled: boolean("bottling_enabled").notNull().default(true),
    canningEnabled: boolean("canning_enabled").notNull().default(false),
    ttbReportingEnabled: boolean("ttb_reporting_enabled")
      .notNull()
      .default(true),
    spiritsInventoryEnabled: boolean("spirits_inventory_enabled")
      .notNull()
      .default(false),

    // ==========================================
    // Packaging Config
    // ==========================================
    // MULTI-SELECT: can choose any combination from (bottle, can, keg, bib)
    packageTypes: text("package_types")
      .array()
      .notNull()
      .default(["bottle", "keg"]),
    // MULTI-SELECT: can choose any combination from (forced, bottle_conditioning, petnat, still)
    carbonationMethods: text("carbonation_methods")
      .array()
      .notNull()
      .default(["forced"]),
    defaultTargetCO2: decimal("default_target_co2", { precision: 4, scale: 2 })
      .notNull()
      .default("2.70"),

    // ==========================================
    // Alert Thresholds
    // ==========================================
    stalledBatchDays: integer("stalled_batch_days").notNull().default(14),
    longAgingDays: integer("long_aging_days").notNull().default(90),
    lowInventoryThreshold: integer("low_inventory_threshold")
      .notNull()
      .default(24),
    ttbReminderDays: integer("ttb_reminder_days").notNull().default(7),

    // ==========================================
    // Fermentation Stage Tracking
    // ==========================================
    // Stage thresholds (percentage of fermentation complete)
    fermentationStageEarlyMax: integer("fermentation_stage_early_max")
      .notNull()
      .default(70), // Early stage: 0-70%
    fermentationStageMidMax: integer("fermentation_stage_mid_max")
      .notNull()
      .default(90), // Mid stage: 70-90%
    fermentationStageApproachingDryMax: integer("fermentation_stage_approaching_dry_max")
      .notNull()
      .default(98), // Approaching dry: 90-98%, Terminal: 98%+

    // Stall detection settings
    stallDetectionEnabled: boolean("stall_detection_enabled")
      .notNull()
      .default(true),
    stallDetectionDays: integer("stall_detection_days")
      .notNull()
      .default(3), // Days with no SG change to trigger stall
    stallDetectionThreshold: decimal("stall_detection_threshold", {
      precision: 5,
      scale: 4,
    })
      .notNull()
      .default("0.001"), // Min SG change to not be considered stalled

    // Terminal stage confirmation
    terminalConfirmationHours: integer("terminal_confirmation_hours")
      .notNull()
      .default(48), // Hours between identical readings to confirm terminal

    // Default target FG by cider style
    defaultTargetFgDry: decimal("default_target_fg_dry", { precision: 5, scale: 3 })
      .notNull()
      .default("0.998"),
    defaultTargetFgSemiDry: decimal("default_target_fg_semi_dry", { precision: 5, scale: 3 })
      .notNull()
      .default("1.005"),
    defaultTargetFgSemiSweet: decimal("default_target_fg_semi_sweet", { precision: 5, scale: 3 })
      .notNull()
      .default("1.012"),
    defaultTargetFgSweet: decimal("default_target_fg_sweet", { precision: 5, scale: 3 })
      .notNull()
      .default("1.020"),

    // ==========================================
    // UX Preferences - Units
    // ==========================================
    volumeUnits: volumeUnitsEnum("volume_units").notNull().default("gallons"),
    volumeShowSecondary: boolean("volume_show_secondary")
      .notNull()
      .default(false),
    weightUnits: weightUnitsEnum("weight_units").notNull().default("pounds"),
    weightShowSecondary: boolean("weight_show_secondary")
      .notNull()
      .default(false),
    temperatureUnits: temperatureUnitsEnum("temperature_units")
      .notNull()
      .default("fahrenheit"),
    temperatureShowSecondary: boolean("temperature_show_secondary")
      .notNull()
      .default(false),
    densityUnits: densityUnitsEnum("density_units").notNull().default("sg"),
    densityShowSecondary: boolean("density_show_secondary")
      .notNull()
      .default(false),
    pressureUnits: pressureUnitsEnum("pressure_units").notNull().default("psi"),
    pressureShowSecondary: boolean("pressure_show_secondary")
      .notNull()
      .default(false),

    // ==========================================
    // UX Preferences - Display
    // ==========================================
    dateFormat: dateFormatEnum("date_format").notNull().default("mdy"),
    timeFormat: timeFormatEnum("time_format").notNull().default("12h"),
    theme: themeEnum("theme").notNull().default("system"),
    defaultCurrency: text("default_currency").notNull().default("USD"),

    // ==========================================
    // UX Preferences - Decimal Places
    // ==========================================
    sgDecimalPlaces: integer("sg_decimal_places").notNull().default(3),
    phDecimalPlaces: integer("ph_decimal_places").notNull().default(1),

    // ==========================================
    // Measurement Corrections
    // ==========================================
    // Enable automatic temperature correction for SG readings
    sgTemperatureCorrectionEnabled: boolean("sg_temperature_correction_enabled")
      .notNull()
      .default(true),
    // Hydrometer calibration temperature in Celsius (default: 15.56°C = 60°F)
    hydrometerCalibrationTempC: decimal("hydrometer_calibration_temp_c", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("15.56"),

    // ==========================================
    // Overhead Cost Allocation
    // ==========================================
    /**
     * Whether overhead tracking is enabled for COGS calculations
     */
    overheadTrackingEnabled: boolean("overhead_tracking_enabled")
      .notNull()
      .default(false),

    /**
     * Annual overhead budget breakdown (for transparency in calculations)
     * These are optional - user can also just enter the total directly
     */
    overheadAnnualRent: decimal("overhead_annual_rent", {
      precision: 12,
      scale: 2,
    }),
    overheadAnnualUtilities: decimal("overhead_annual_utilities", {
      precision: 12,
      scale: 2,
    }),
    overheadAnnualInsurance: decimal("overhead_annual_insurance", {
      precision: 12,
      scale: 2,
    }),
    overheadAnnualEquipment: decimal("overhead_annual_equipment", {
      precision: 12,
      scale: 2,
    }),
    overheadAnnualLicenses: decimal("overhead_annual_licenses", {
      precision: 12,
      scale: 2,
    }),
    overheadAnnualOther: decimal("overhead_annual_other", {
      precision: 12,
      scale: 2,
    }),

    /**
     * Total annual overhead budget (sum of breakdown or direct entry)
     */
    overheadAnnualBudget: decimal("overhead_annual_budget", {
      precision: 12,
      scale: 2,
    }),

    /**
     * Expected annual production in gallons (for calculating rate)
     */
    overheadExpectedAnnualGallons: decimal("overhead_expected_annual_gallons", {
      precision: 10,
      scale: 2,
    }),

    /**
     * Calculated overhead rate per gallon (budget / expected gallons)
     * Stored for quick access in COGS calculations
     */
    overheadRatePerGallon: decimal("overhead_rate_per_gallon", {
      precision: 10,
      scale: 4,
    }),

    /**
     * Budget year for overhead calculations (e.g., 2025)
     */
    overheadBudgetYear: integer("overhead_budget_year"),

    // ==========================================
    // Measurement Schedules
    // ==========================================
    /**
     * Product-type-specific measurement schedules
     * Configures initial vs ongoing measurement types, intervals, and alert types
     */
    measurementSchedules: jsonb("measurement_schedules").$type<MeasurementSchedules>(),

    // ==========================================
    // TTB Opening Balances
    // ==========================================
    /**
     * Date when TTB opening balances were set
     * Typically the last day of the previous reporting period before system adoption
     */
    ttbOpeningBalanceDate: text("ttb_opening_balance_date"), // Store as text for easier handling
    /**
     * TTB opening balances by tax class (wine gallons)
     * Used for beginning inventory calculation when no prior period snapshot exists
     */
    ttbOpeningBalances: jsonb("ttb_opening_balances").$type<TTBOpeningBalances>(),
    /**
     * Notes explaining any reconciliation between TTB and system inventory
     * Used to document discrepancies during initial setup
     */
    ttbReconciliationNotes: text("ttb_reconciliation_notes"),
    /**
     * Timestamp when TTB onboarding wizard was completed
     * NULL means onboarding not yet completed
     */
    ttbOnboardingCompletedAt: timestamp("ttb_onboarding_completed_at", { withTimezone: true }),
    /**
     * Maximum allowed variance (as a percentage) between TTB calculated ending
     * and system-calculated on-hand before auto-verification is blocked.
     * e.g., 0.5 means 0.5%. Default: 0.5
     */
    ttbVarianceThresholdPct: decimal("ttb_variance_threshold_pct", {
      precision: 5,
      scale: 2,
    }).default("0.50"),
    /**
     * TTB classification thresholds and tax rates
     * Configurable by admin to reflect current TTB regulations (27 CFR 24.10)
     * NULL means use DEFAULT_TTB_CLASSIFICATION_CONFIG defaults
     */
    ttbClassificationConfig: jsonb("ttb_classification_config"),

    // ==========================================
    // Tax Reporting Preferences
    // ==========================================
    /**
     * State where the cidery is licensed and files taxes
     * Used for state-specific tax reporting
     */
    taxState: text("tax_state"),
    /**
     * TTB reporting frequency (monthly, quarterly, annual)
     * Determined by annual tax liability:
     * - Annual: ≤$1,000/year
     * - Quarterly: $1,000-$50,000/year
     * - Monthly: >$50,000/year
     */
    ttbReportingFrequency: text("ttb_reporting_frequency").default("quarterly"),
    /**
     * State tax reporting frequency (may differ from TTB)
     * Check with your state's alcohol control board for requirements
     */
    stateTaxReportingFrequency: text("state_tax_reporting_frequency").default("quarterly"),
    /**
     * Estimated annual tax liability for TTB frequency guidance
     * Used to provide recommendations on appropriate filing frequency
     */
    estimatedAnnualTaxLiability: decimal("estimated_annual_tax_liability", {
      precision: 10,
      scale: 2,
    }),

    // ==========================================
    // Timestamps
    // ==========================================
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index("organization_settings_organization_idx").on(
      table.organizationId
    ),
  })
);

// ============================================
// CUSTOM PRODUCT TYPES TABLE
// ============================================

export const customProductTypes = pgTable(
  "custom_product_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    initialMeasurementTypes: text("initial_measurement_types").array().notNull().default([]),
    ongoingMeasurementTypes: text("ongoing_measurement_types").array().notNull().default([]),
    primaryMeasurement: text("primary_measurement").notNull().default("sg"),
    usesFermentationStages: boolean("uses_fermentation_stages").notNull().default(false),
    defaultIntervalDays: integer("default_interval_days"),
    alertType: text("alert_type").$type<"check_in_reminder" | "measurement_overdue">(),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index("custom_product_types_org_idx").on(table.organizationId),
    uniqueSlug: index("custom_product_types_unique_slug").on(table.organizationId, table.slug),
  })
);

// ============================================
// RELATIONS
// ============================================

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organizationId],
  }),
  customProductTypes: many(customProductTypes),
}));

export const customProductTypesRelations = relations(customProductTypes, ({ one }) => ({
  organization: one(organizations, {
    fields: [customProductTypes.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSettings.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================
// TYPE EXPORTS
// ============================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;

export type CustomProductType = typeof customProductTypes.$inferSelect;
export type NewCustomProductType = typeof customProductTypes.$inferInsert;

// Valid values for multi-select fields (for TypeScript type safety)
export const FRUIT_SOURCE_VALUES = [
  "orchard",
  "purchase_fruit",
  "purchase_juice",
] as const;
export type FruitSource = (typeof FRUIT_SOURCE_VALUES)[number];

export const PRODUCT_TYPE_VALUES = [
  "cider",
  "perry",
  "fortified",
  "other",
] as const;
export type ProductType = (typeof PRODUCT_TYPE_VALUES)[number];

export const PACKAGE_TYPE_VALUES = ["bottle", "can", "keg", "bib"] as const;
export type PackageType = (typeof PACKAGE_TYPE_VALUES)[number];

export const CARBONATION_METHOD_VALUES = [
  "forced",
  "bottle_conditioning",
  "petnat",
  "still",
] as const;
export type CarbonationMethod = (typeof CARBONATION_METHOD_VALUES)[number];

// ============================================
// MEASUREMENT SCHEDULE TYPES
// ============================================

export const MEASUREMENT_TYPE_VALUES = [
  "sg",
  "abv",
  "ph",
  "temperature",
  "sensory",
  "volume",
] as const;
export type MeasurementTypeValue = (typeof MEASUREMENT_TYPE_VALUES)[number];

export const ALERT_TYPE_VALUES = [
  "check_in_reminder",
  "measurement_overdue",
] as const;
export type AlertType = (typeof ALERT_TYPE_VALUES)[number];

export interface MeasurementScheduleConfig {
  initialMeasurementTypes: MeasurementTypeValue[];
  ongoingMeasurementTypes: MeasurementTypeValue[];
  primaryMeasurement: MeasurementTypeValue;
  usesFermentationStages: boolean;
  defaultIntervalDays: number | null;
  alertType: AlertType | null;
}

export interface MeasurementSchedules {
  cider: MeasurementScheduleConfig;
  perry: MeasurementScheduleConfig;
  brandy: MeasurementScheduleConfig;
  pommeau: MeasurementScheduleConfig;
  juice: MeasurementScheduleConfig;
  [key: string]: MeasurementScheduleConfig; // Allow custom product types
}

export interface BatchMeasurementOverride {
  intervalDays?: number;
  measurementTypes?: MeasurementTypeValue[];
  alertType?: AlertType | null;
  notes?: string;
}

// ============================================
// TAX REPORTING TYPES
// ============================================

export const REPORTING_FREQUENCY_VALUES = [
  "monthly",
  "quarterly",
  "annual",
] as const;
export type ReportingFrequency = (typeof REPORTING_FREQUENCY_VALUES)[number];
