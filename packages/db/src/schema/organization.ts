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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../schema";

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
    phone: text("phone"),
    website: text("website"),
    logo: text("logo"),
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
// RELATIONS
// ============================================

export const organizationsRelations = relations(organizations, ({ one }) => ({
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organizationId],
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
