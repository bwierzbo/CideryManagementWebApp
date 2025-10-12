import {
  pgTable,
  uuid,
  text,
  decimal,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// PostgreSQL Enums
import { unitEnum } from "./schema/shared";
export { unitEnum };
export const batchStatusEnum = pgEnum("batch_status", [
  "fermentation",
  "aging",
  "conditioning",
  "completed",
  "discarded",
]);
export const vesselStatusEnum = pgEnum("vessel_status", [
  "available",
  "cleaning",
  "maintenance",
]);
export const filterTypeEnum = pgEnum("filter_type", [
  "coarse",
  "fine",
  "sterile",
]);
export const vesselTypeEnum = pgEnum("vessel_type", [
  "fermenter",
  "conditioning_tank",
  "bright_tank",
  "storage",
]);
export const vesselMaterialEnum = pgEnum("vessel_material", [
  "stainless_steel",
  "plastic",
]);
export const vesselJacketedEnum = pgEnum("vessel_jacketed", ["yes", "no"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "purchase",
  "transfer",
  "adjustment",
  "sale",
  "waste",
]);
export const cogsItemTypeEnum = pgEnum("cogs_item_type", [
  "apple_cost",
  "labor",
  "overhead",
  "packaging",
]);
export const userRoleEnum = pgEnum("user_role", ["admin", "operator"]);
export const pressRunStatusEnum = pgEnum("press_run_status", [
  "draft", // Initial state, can be edited freely
  "in_progress", // Active pressing session in mobile app
  "completed", // Finished pressing, juice transferred to vessel
  "cancelled", // Cancelled press run, resources released
]);
export const fruitTypeEnum = pgEnum("fruit_type", ["apple", "pear", "plum"]);

// Fruit variety characteristic enums
export const ciderCategoryEnum = pgEnum("cider_category_enum", [
  "sweet",
  "bittersweet",
  "sharp",
  "bittersharp",
]);
export const intensityEnum = pgEnum("intensity_enum", [
  "high",
  "medium-high",
  "medium",
  "low-medium",
  "low",
]);
export const harvestWindowEnum = pgEnum("harvest_window_enum", [
  "Late",
  "Mid-Late",
  "Mid",
  "Early-Mid",
  "Early",
]);
export const materialTypeEnum = pgEnum("material_type", [
  "apple",
  "additive",
  "juice",
  "packaging",
]);
export const packagingItemTypeEnum = pgEnum("packaging_item_type", [
  "Primary Packaging",
  "Closures",
  "Secondary Packaging",
  "Tertiary Packaging",
]);

// Core Tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("operator"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});
export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactInfo: jsonb("contact_info"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const baseFruitVarieties = pgTable(
  "base_fruit_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    fruitType: fruitTypeEnum("fruit_type").notNull().default("apple"),
    // Fruit variety characteristics
    ciderCategory: ciderCategoryEnum("cider_category"),
    tannin: intensityEnum("tannin"),
    acid: intensityEnum("acid"),
    sugarBrix: intensityEnum("sugar_brix"),
    harvestWindow: harvestWindowEnum("harvest_window"),
    varietyNotes: text("variety_notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    // Unique constraint on name - case-insensitive will be handled manually
    nameUniqueIdx: uniqueIndex("base_fruit_varieties_name_unique_idx").on(
      table.name,
    ),
  }),
);

export const vendorVarieties = pgTable(
  "vendor_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    varietyId: uuid("variety_id")
      .notNull()
      .references(() => baseFruitVarieties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    // Unique constraint to prevent duplicate vendor-variety pairs
    vendorVarietyUniqueIdx: uniqueIndex(
      "vendor_varieties_vendor_variety_unique_idx",
    ).on(table.vendorId, table.varietyId),
    // Performance indexes
    vendorIdx: index("vendor_varieties_vendor_idx").on(table.vendorId),
    varietyIdx: index("vendor_varieties_variety_idx").on(table.varietyId),
  }),
);

// Additive Varieties
export const additiveVarieties = pgTable(
  "additive_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    itemType: text("item_type").notNull(), // enzyme, nutrient, clarifier, preservative, acid, other
    isActive: boolean("is_active").notNull().default(true),
    labelImpact: boolean("label_impact").notNull().default(false),
    labelImpactNotes: text("label_impact_notes"),
    allergensVegan: boolean("allergens_vegan").notNull().default(false),
    allergensVeganNotes: text("allergens_vegan_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    nameUniqueIdx: uniqueIndex("additive_varieties_name_unique_idx").on(
      table.name,
    ),
  }),
);

export const vendorAdditiveVarieties = pgTable(
  "vendor_additive_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    varietyId: uuid("variety_id")
      .notNull()
      .references(() => additiveVarieties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    vendorVarietyUniqueIdx: uniqueIndex(
      "vendor_additive_varieties_vendor_variety_unique_idx",
    ).on(table.vendorId, table.varietyId),
    vendorIdx: index("vendor_additive_varieties_vendor_idx").on(table.vendorId),
    varietyIdx: index("vendor_additive_varieties_variety_idx").on(
      table.varietyId,
    ),
  }),
);

// Juice Varieties
export const juiceVarieties = pgTable(
  "juice_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    nameUniqueIdx: uniqueIndex("juice_varieties_name_unique_idx").on(
      table.name,
    ),
  }),
);

export const vendorJuiceVarieties = pgTable(
  "vendor_juice_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    varietyId: uuid("variety_id")
      .notNull()
      .references(() => juiceVarieties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    vendorVarietyUniqueIdx: uniqueIndex(
      "vendor_juice_varieties_vendor_variety_unique_idx",
    ).on(table.vendorId, table.varietyId),
    vendorIdx: index("vendor_juice_varieties_vendor_idx").on(table.vendorId),
    varietyIdx: index("vendor_juice_varieties_variety_idx").on(table.varietyId),
  }),
);

// Packaging Varieties
export const packagingVarieties = pgTable(
  "packaging_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    itemType: packagingItemTypeEnum("item_type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    nameUniqueIdx: uniqueIndex("packaging_varieties_name_unique_idx").on(
      table.name,
    ),
  }),
);

export const vendorPackagingVarieties = pgTable(
  "vendor_packaging_varieties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    varietyId: uuid("variety_id")
      .notNull()
      .references(() => packagingVarieties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    vendorVarietyUniqueIdx: uniqueIndex(
      "vendor_packaging_varieties_vendor_variety_unique_idx",
    ).on(table.vendorId, table.varietyId),
    vendorIdx: index("vendor_packaging_varieties_vendor_idx").on(
      table.vendorId,
    ),
    varietyIdx: index("vendor_packaging_varieties_variety_idx").on(
      table.varietyId,
    ),
  }),
);

export const basefruitPurchases = pgTable("basefruit_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  purchaseDate: timestamp("purchase_date").notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
});

export const basefruitPurchaseItems = pgTable("basefruit_purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => basefruitPurchases.id),
  fruitVarietyId: uuid("fruit_variety_id")
    .notNull()
    .references(() => baseFruitVarieties.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: unitEnum("unit").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 4 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  // Canonical storage (always kg for fruit)
  quantityKg: decimal("quantity_kg", { precision: 10, scale: 3 }),
  // Purchase metadata
  harvestDate: date("harvest_date"),
  notes: text("notes"),
  // Track if this purchase line has been fully depleted
  isDepleted: boolean("is_depleted").default(false),
  depletedAt: timestamp("depleted_at"),
  depletedBy: uuid("depleted_by"),
  depletedInPressRun: uuid("depleted_in_press_run"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Additive Purchases
export const additivePurchases = pgTable("additive_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  purchaseDate: timestamp("purchase_date").notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
});

export const additivePurchaseItems = pgTable("additive_purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => additivePurchases.id),
  additiveVarietyId: uuid("additive_variety_id").references(
    () => additiveVarieties.id,
  ),
  additiveType: text("additive_type"),
  brandManufacturer: text("brand_manufacturer"),
  productName: text("product_name"),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  lotBatchNumber: text("lot_batch_number"),
  expirationDate: date("expiration_date"),
  storageRequirements: text("storage_requirements"),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 4 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Juice Purchases
export const juicePurchases = pgTable("juice_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  purchaseDate: timestamp("purchase_date").notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
});

export const juicePurchaseItems = pgTable("juice_purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => juicePurchases.id),
  juiceVarietyId: uuid("juice_variety_id").references(() => juiceVarieties.id),
  juiceType: text("juice_type"),
  varietyName: text("variety_name"),
  volume: decimal("volume", { precision: 10, scale: 3 }).notNull(),
  volumeUnit: unitEnum("volume_unit").notNull().default("L"),
  volumeAllocated: decimal("volume_allocated", { precision: 10, scale: 3 })
    .notNull()
    .default("0"),
  brix: decimal("brix", { precision: 5, scale: 2 }),
  ph: decimal("ph", { precision: 3, scale: 2 }),
  specificGravity: decimal("specific_gravity", { precision: 5, scale: 4 }),
  containerType: text("container_type"),
  pricePerLiter: decimal("price_per_liter", { precision: 8, scale: 4 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Packaging Purchases
export const packagingPurchases = pgTable("packaging_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  purchaseDate: timestamp("purchase_date").notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
});

export const packagingPurchaseItems = pgTable("packaging_purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => packagingPurchases.id),
  packagingVarietyId: uuid("packaging_variety_id").references(
    () => packagingVarieties.id,
  ),
  packageType: text("package_type"),
  materialType: text("material_type"),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 8, scale: 4 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Old press_runs and press_items tables dropped - using renamed apple_press_runs instead

export const vessels = pgTable("vessels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  type: vesselTypeEnum("type"), // TEMPORARY: Keep for DB compatibility until migration
  capacity: decimal("capacity", { precision: 10, scale: 3 }).notNull(),
  capacityUnit: unitEnum("capacity_unit").notNull().default("L"),
  material: vesselMaterialEnum("material"),
  jacketed: vesselJacketedEnum("jacketed"),
  status: vesselStatusEnum("status").notNull().default("available"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vesselId: uuid("vessel_id").references(() => vessels.id),
    name: text("name").notNull().unique(),
    customName: text("custom_name"),
    batchNumber: text("batch_number").notNull(),
    initialVolume: decimal("initial_volume", {
      precision: 10,
      scale: 3,
    }).notNull(),
    initialVolumeUnit: unitEnum("initial_volume_unit").notNull().default("L"),
    currentVolume: decimal("current_volume", { precision: 10, scale: 3 }),
    currentVolumeUnit: unitEnum("current_volume_unit").notNull().default("L"),
    status: batchStatusEnum("status").notNull().default("fermentation"),
    startDate: timestamp("start_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endDate: timestamp("end_date", { withTimezone: true }),
    originPressRunId: uuid("origin_press_run_id").references(
      () => applePressRuns.id,
    ),
    originJuicePurchaseItemId: uuid("origin_juice_purchase_item_id").references(
      () => juicePurchaseItems.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    vesselIdx: index("batches_vessel_idx").on(table.vesselId),
    statusIdx: index("batches_status_idx").on(table.status),
    originPressRunIdx: index("batches_origin_press_run_idx").on(
      table.originPressRunId,
    ),
    originJuicePurchaseIdx: index("batches_origin_juice_purchase_idx").on(
      table.originJuicePurchaseItemId,
    ),
  }),
);

export const batchCompositions = pgTable(
  "batch_compositions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    // Source type: 'base_fruit' or 'juice_purchase'
    sourceType: text("source_type").notNull().default("base_fruit"),
    // Base fruit fields (nullable for juice purchases)
    purchaseItemId: uuid("purchase_item_id")
      .references(() => basefruitPurchaseItems.id),
    varietyId: uuid("variety_id")
      .references(() => baseFruitVarieties.id),
    inputWeightKg: decimal("input_weight_kg", {
      precision: 12,
      scale: 3,
    }),
    fractionOfBatch: decimal("fraction_of_batch", {
      precision: 8,
      scale: 6,
    }),
    // Juice purchase fields (nullable for base fruit)
    juicePurchaseItemId: uuid("juice_purchase_item_id")
      .references(() => juicePurchaseItems.id),
    // Common fields for both types
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    lotCode: text("lot_code"),
    juiceVolume: decimal("juice_volume", {
      precision: 12,
      scale: 3,
    }).notNull(),
    juiceVolumeUnit: unitEnum("juice_volume_unit").notNull().default("L"),
    materialCost: decimal("material_cost", {
      precision: 12,
      scale: 2,
    }).notNull(),
    avgBrix: decimal("avg_brix", { precision: 5, scale: 2 }),
    estSugarKg: decimal("est_sugar_kg", { precision: 12, scale: 3 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    batchIdx: index("batch_compositions_batch_idx").on(table.batchId),
    purchaseItemIdx: index("batch_compositions_purchase_item_idx").on(
      table.purchaseItemId,
    ),
    juicePurchaseItemIdx: index("batch_compositions_juice_purchase_item_idx").on(
      table.juicePurchaseItemId,
    ),
    // Unique constraints for both source types
    batchFruitItemUniqueIdx: uniqueIndex(
      "batch_compositions_batch_fruit_item_unique_idx",
    ).on(table.batchId, table.purchaseItemId),
    batchJuiceItemUniqueIdx: uniqueIndex(
      "batch_compositions_batch_juice_item_unique_idx",
    ).on(table.batchId, table.juicePurchaseItemId),
    // CHECK constraints for data integrity
    sourceTypeCheck: sql`CHECK (source_type IN ('base_fruit', 'juice_purchase'))`,
    sourceCheck: sql`CHECK (
      (source_type = 'base_fruit' AND purchase_item_id IS NOT NULL AND juice_purchase_item_id IS NULL) OR
      (source_type = 'juice_purchase' AND juice_purchase_item_id IS NOT NULL AND purchase_item_id IS NULL)
    )`,
    inputWeightKgPositive: sql`CHECK (input_weight_kg IS NULL OR input_weight_kg >= 0)`,
    juiceVolumePositive: sql`CHECK (juice_volume >= 0)`,
    fractionOfBatchValid: sql`CHECK (fraction_of_batch IS NULL OR (fraction_of_batch >= 0 AND fraction_of_batch <= 1))`,
    materialCostPositive: sql`CHECK (material_cost >= 0)`,
  }),
);

export const batchMeasurements = pgTable("batch_measurements", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id),
  measurementDate: timestamp("measurement_date").notNull(),
  specificGravity: decimal("specific_gravity", { precision: 5, scale: 4 }),
  abv: decimal("abv", { precision: 4, scale: 2 }),
  ph: decimal("ph", { precision: 3, scale: 2 }),
  totalAcidity: decimal("total_acidity", { precision: 4, scale: 2 }),
  temperature: decimal("temperature", { precision: 4, scale: 1 }),
  volume: decimal("volume", { precision: 10, scale: 3 }),
  volumeUnit: unitEnum("volume_unit").notNull().default("L"),
  notes: text("notes"),
  takenBy: text("taken_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const batchAdditives = pgTable("batch_additives", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id),
  vesselId: uuid("vessel_id")
    .notNull()
    .references(() => vessels.id),
  additiveType: text("additive_type").notNull(),
  additiveName: text("additive_name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  notes: text("notes"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Dropped tables (not yet implemented):
// - packages
// - inventory
// - inventoryTransactions
// - batchCosts
// - cogsItems

// Press Run Tables (renamed from apple_press_runs in migration 0024)
export const pressRuns = pgTable(
  "press_runs",
  {
    // Primary identification
    id: uuid("id").primaryKey().defaultRandom(),
    pressRunName: text("press_run_name"), // Format: yyyy/mm/dd-##

    // Core relationships following existing foreign key patterns
    vendorId: uuid("vendor_id").references(() => vendors.id), // Nullable - vendor determined by loads
    vesselId: uuid("vessel_id").references(() => vessels.id), // Target vessel for juice collection

    // Workflow status with enum constraint
    status: pressRunStatusEnum("status").notNull().default("draft"),

    // Timing fields for session management
    dateCompleted: date("date_completed"), // Date when press run was completed

    // Aggregate measurements (calculated from loads)
    // Using existing decimal precision patterns: precision 10, scale 3 for weights/volumes
    totalAppleWeightKg: decimal("total_apple_weight_kg", {
      precision: 10,
      scale: 3,
    }),
    totalJuiceVolume: decimal("total_juice_volume", {
      precision: 10,
      scale: 3,
    }),
    totalJuiceVolumeUnit: unitEnum("total_juice_volume_unit").notNull().default("L"),
    extractionRate: decimal("extraction_rate", { precision: 5, scale: 4 }), // Percentage with 4 decimal precision

    // Labor cost tracking following existing cost field patterns
    laborHours: decimal("labor_hours", { precision: 8, scale: 2 }),
    laborCostPerHour: decimal("labor_cost_per_hour", {
      precision: 8,
      scale: 2,
    }),
    totalLaborCost: decimal("total_labor_cost", { precision: 10, scale: 2 }), // Matches existing cost precision

    // Operational metadata
    notes: text("notes"),

    // Full audit trail following existing pattern from schema.ts
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"), // Soft delete support
  },
  (table) => ({
    // Performance indexes optimized for mobile app query patterns
    vendorIdx: index("press_runs_vendor_idx").on(table.vendorId),
    statusIdx: index("press_runs_status_idx").on(table.status),
    dateCompletedIdx: index("press_runs_date_completed_idx").on(
      table.dateCompleted,
    ),

    // Composite indexes for common filtered queries
    vendorStatusIdx: index("press_runs_vendor_status_idx").on(
      table.vendorId,
      table.status,
    ),

    // User attribution indexes for audit queries
    createdByIdx: index("press_runs_created_by_idx").on(table.createdBy),
    updatedByIdx: index("press_runs_updated_by_idx").on(table.updatedBy),
  }),
);

export const pressRunLoads = pgTable(
  "press_run_loads",
  {
    // Primary identification
    id: uuid("id").primaryKey().defaultRandom(),

    // Core relationships with proper cascade behavior
    pressRunId: uuid("press_run_id")
      .notNull()
      .references(() => pressRuns.id, { onDelete: "cascade" }),
    purchaseItemId: uuid("purchase_item_id")
      .notNull()
      .references(() => basefruitPurchaseItems.id), // Traceability chain
    fruitVarietyId: uuid("fruit_variety_id")
      .notNull()
      .references(() => baseFruitVarieties.id),

    // Load sequencing for ordered processing
    loadSequence: integer("load_sequence").notNull(), // Order within press run (1, 2, 3, ...)

    // Apple weight measurements following canonical storage pattern from basefruitPurchaseItems
    appleWeightKg: decimal("apple_weight_kg", {
      precision: 10,
      scale: 3,
    }).notNull(), // Canonical storage in kg
    originalWeight: decimal("original_weight", { precision: 10, scale: 3 }), // As entered by user
    originalWeightUnit: text("original_weight_unit"), // Original unit for display/editing

    // Juice volume measurements following same pattern
    juiceVolume: decimal("juice_volume", { precision: 10, scale: 3 }), // Canonical storage in L
    juiceVolumeUnit: unitEnum("juice_volume_unit").notNull().default("L"),
    originalVolume: decimal("original_volume", { precision: 10, scale: 3 }), // As entered by user
    originalVolumeUnit: text("original_volume_unit"), // Original unit for display/editing

    // Load-specific operational data
    notes: text("notes"),

    // Full audit trail matching pressRuns pattern
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at"), // Soft delete support
  },
  (table) => ({
    // Performance indexes for mobile queries
    pressRunIdx: index("press_run_loads_press_run_idx").on(
      table.pressRunId,
    ),
    purchaseItemIdx: index("press_run_loads_purchase_item_idx").on(
      table.purchaseItemId,
    ),
    varietyIdx: index("press_run_loads_variety_idx").on(
      table.fruitVarietyId,
    ),

    // Composite index for ordered retrieval within press run
    sequenceIdx: index("press_run_loads_sequence_idx").on(
      table.pressRunId,
      table.loadSequence,
    ),

    // User attribution indexes
    createdByIdx: index("press_run_loads_created_by_idx").on(
      table.createdBy,
    ),
    updatedByIdx: index("press_run_loads_updated_by_idx").on(
      table.updatedBy,
    ),

    // Unique constraint to prevent duplicate sequences within a press run
    uniqueSequence: uniqueIndex("press_run_loads_unique_sequence").on(
      table.pressRunId,
      table.loadSequence,
    ),
  }),
);

// Audit log removed - use auditLogs from ./schema/audit.ts instead

export const batchTransfers = pgTable(
  "batch_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Source batch information (completed batch)
    sourceBatchId: uuid("source_batch_id")
      .notNull()
      .references(() => batches.id),
    sourceVesselId: uuid("source_vessel_id")
      .notNull()
      .references(() => vessels.id),
    // Destination batch information (new batch created)
    destinationBatchId: uuid("destination_batch_id")
      .notNull()
      .references(() => batches.id),
    destinationVesselId: uuid("destination_vessel_id")
      .notNull()
      .references(() => vessels.id),
    // Optional remaining batch (if partial transfer)
    remainingBatchId: uuid("remaining_batch_id").references(() => batches.id),
    // Transfer details
    volumeTransferred: decimal("volume_transferred", {
      precision: 10,
      scale: 3,
    }).notNull(),
    volumeTransferredUnit: unitEnum("volume_transferred_unit").notNull().default("L"),
    loss: decimal("loss", { precision: 10, scale: 3 }).default("0"),
    lossUnit: unitEnum("loss_unit").notNull().default("L"),
    totalVolumeProcessed: decimal("total_volume_processed", {
      precision: 10,
      scale: 3,
    }).notNull(), // transferred + loss
    totalVolumeProcessedUnit: unitEnum("total_volume_processed_unit").notNull().default("L"),
    remainingVolume: decimal("remaining_volume", {
      precision: 10,
      scale: 3,
    }), // left in source vessel
    remainingVolumeUnit: unitEnum("remaining_volume_unit").notNull().default("L"),
    notes: text("notes"),
    // Metadata
    transferredAt: timestamp("transferred_at").notNull().defaultNow(),
    transferredBy: uuid("transferred_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    sourceBatchIdx: index("batch_transfers_source_batch_idx").on(
      table.sourceBatchId,
    ),
    destinationBatchIdx: index("batch_transfers_destination_batch_idx").on(
      table.destinationBatchId,
    ),
    sourceVesselIdx: index("batch_transfers_source_vessel_idx").on(
      table.sourceVesselId,
    ),
    destinationVesselIdx: index("batch_transfers_destination_vessel_idx").on(
      table.destinationVesselId,
    ),
    transferredAtIdx: index("batch_transfers_transferred_at_idx").on(
      table.transferredAt,
    ),
  }),
);

// Batch filter operations for tracking filtering with volume loss
export const batchFilterOperations = pgTable(
  "batch_filter_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    filterType: filterTypeEnum("filter_type").notNull(),
    // Volume tracking
    volumeBefore: decimal("volume_before", {
      precision: 10,
      scale: 3,
    }).notNull(),
    volumeBeforeUnit: unitEnum("volume_before_unit").notNull().default("L"),
    volumeAfter: decimal("volume_after", {
      precision: 10,
      scale: 3,
    }).notNull(),
    volumeAfterUnit: unitEnum("volume_after_unit").notNull().default("L"),
    volumeLoss: decimal("volume_loss", {
      precision: 10,
      scale: 3,
    })
      .notNull()
      .default("0"),
    // Metadata
    filteredBy: text("filtered_by"),
    filteredAt: timestamp("filtered_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    batchIdx: index("batch_filter_operations_batch_id_idx").on(table.batchId),
    vesselIdx: index("batch_filter_operations_vessel_id_idx").on(
      table.vesselId,
    ),
    filteredAtIdx: index("batch_filter_operations_filtered_at_idx").on(
      table.filteredAt,
    ),
  }),
);

// Batch racking operations for tracking racking with volume loss
export const batchRackingOperations = pgTable(
  "batch_racking_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    // Source vessel (where batch is being racked from)
    sourceVesselId: uuid("source_vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    // Destination vessel (where batch is being racked to)
    destinationVesselId: uuid("destination_vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "cascade" }),
    // Volume tracking
    volumeBefore: decimal("volume_before", {
      precision: 10,
      scale: 3,
    }).notNull(),
    volumeBeforeUnit: unitEnum("volume_before_unit").notNull().default("L"),
    volumeAfter: decimal("volume_after", {
      precision: 10,
      scale: 3,
    }).notNull(),
    volumeAfterUnit: unitEnum("volume_after_unit").notNull().default("L"),
    volumeLoss: decimal("volume_loss", {
      precision: 10,
      scale: 3,
    })
      .notNull()
      .default("0"),
    volumeLossUnit: unitEnum("volume_loss_unit").notNull().default("L"),
    // Metadata
    rackedBy: uuid("racked_by").references(() => users.id),
    rackedAt: timestamp("racked_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    batchIdx: index("batch_racking_operations_batch_id_idx").on(table.batchId),
    sourceVesselIdx: index("batch_racking_operations_source_vessel_id_idx").on(
      table.sourceVesselId,
    ),
    destinationVesselIdx: index(
      "batch_racking_operations_destination_vessel_id_idx",
    ).on(table.destinationVesselId),
    rackedAtIdx: index("batch_racking_operations_racked_at_idx").on(
      table.rackedAt,
    ),
  }),
);

// Batch merge history for tracking when batches are combined
export const batchMergeHistory = pgTable(
  "batch_merge_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Target batch that received the merge
    targetBatchId: uuid("target_batch_id")
      .notNull()
      .references(() => batches.id),
    // Source information (new juice being added)
    sourcePressRunId: uuid("source_press_run_id").references(
      () => applePressRuns.id,
    ),
    sourceJuicePurchaseItemId: uuid("source_juice_purchase_item_id").references(
      () => juicePurchaseItems.id,
    ),
    sourceType: text("source_type").notNull(), // 'press_run', 'batch_transfer', or 'juice_purchase'
    // Volume details
    volumeAdded: decimal("volume_added", {
      precision: 10,
      scale: 3,
    }).notNull(),
    volumeAddedUnit: unitEnum("volume_added_unit").notNull().default("L"),
    targetVolumeBefore: decimal("target_volume_before", {
      precision: 10,
      scale: 3,
    }).notNull(),
    targetVolumeBeforeUnit: unitEnum("target_volume_before_unit").notNull().default("L"),
    targetVolumeAfter: decimal("target_volume_after", {
      precision: 10,
      scale: 3,
    }).notNull(),
    targetVolumeAfterUnit: unitEnum("target_volume_after_unit").notNull().default("L"),
    // Composition snapshot at time of merge
    compositionSnapshot: jsonb("composition_snapshot"), // Store varieties and percentages
    notes: text("notes"),
    // Metadata
    mergedAt: timestamp("merged_at").notNull().defaultNow(),
    mergedBy: uuid("merged_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    targetBatchIdx: index("batch_merge_history_target_batch_idx").on(
      table.targetBatchId,
    ),
    sourcePressRunIdx: index("batch_merge_history_source_press_run_idx").on(
      table.sourcePressRunId,
    ),
    sourceJuicePurchaseIdx: index(
      "batch_merge_history_source_juice_purchase_idx",
    ).on(table.sourceJuicePurchaseItemId),
    mergedAtIdx: index("batch_merge_history_merged_at_idx").on(table.mergedAt),
  }),
);

// Relations
export const vendorsRelations = relations(vendors, ({ many }) => ({
  basefruitPurchases: many(basefruitPurchases),
  // additivePurchases: many(additivePurchases), // Commented out - not yet implemented
  // juicePurchases: many(juicePurchases), // Commented out - not yet implemented
  // packagingPurchases: many(packagingPurchases), // Commented out - not yet implemented
  vendorVarieties: many(vendorVarieties),
  vendorAdditiveVarieties: many(vendorAdditiveVarieties),
  vendorJuiceVarieties: many(vendorJuiceVarieties),
  vendorPackagingVarieties: many(vendorPackagingVarieties),
  batchCompositions: many(batchCompositions),
}));

export const baseFruitVarietiesRelations = relations(
  baseFruitVarieties,
  ({ many }) => ({
    vendorVarieties: many(vendorVarieties),
    batchCompositions: many(batchCompositions),
    pressRunLoads: many(pressRunLoads),
  }),
);

export const vendorVarietiesRelations = relations(
  vendorVarieties,
  ({ one }) => ({
    vendor: one(vendors, {
      fields: [vendorVarieties.vendorId],
      references: [vendors.id],
    }),
    variety: one(baseFruitVarieties, {
      fields: [vendorVarieties.varietyId],
      references: [baseFruitVarieties.id],
    }),
  }),
);

// Additive Variety Relations
export const additiveVarietiesRelations = relations(
  additiveVarieties,
  ({ many }) => ({
    vendorAdditiveVarieties: many(vendorAdditiveVarieties),
  }),
);

export const vendorAdditiveVarietiesRelations = relations(
  vendorAdditiveVarieties,
  ({ one }) => ({
    vendor: one(vendors, {
      fields: [vendorAdditiveVarieties.vendorId],
      references: [vendors.id],
    }),
    variety: one(additiveVarieties, {
      fields: [vendorAdditiveVarieties.varietyId],
      references: [additiveVarieties.id],
    }),
  }),
);

// Juice Variety Relations
export const juiceVarietiesRelations = relations(
  juiceVarieties,
  ({ many }) => ({
    vendorJuiceVarieties: many(vendorJuiceVarieties),
  }),
);

export const vendorJuiceVarietiesRelations = relations(
  vendorJuiceVarieties,
  ({ one }) => ({
    vendor: one(vendors, {
      fields: [vendorJuiceVarieties.vendorId],
      references: [vendors.id],
    }),
    variety: one(juiceVarieties, {
      fields: [vendorJuiceVarieties.varietyId],
      references: [juiceVarieties.id],
    }),
  }),
);

// Packaging Variety Relations
export const packagingVarietiesRelations = relations(
  packagingVarieties,
  ({ many }) => ({
    vendorPackagingVarieties: many(vendorPackagingVarieties),
  }),
);

export const vendorPackagingVarietiesRelations = relations(
  vendorPackagingVarieties,
  ({ one }) => ({
    vendor: one(vendors, {
      fields: [vendorPackagingVarieties.vendorId],
      references: [vendors.id],
    }),
    variety: one(packagingVarieties, {
      fields: [vendorPackagingVarieties.varietyId],
      references: [packagingVarieties.id],
    }),
  }),
);

export const basefruitPurchasesRelations = relations(
  basefruitPurchases,
  ({ one, many }) => ({
    vendor: one(vendors, {
      fields: [basefruitPurchases.vendorId],
      references: [vendors.id],
    }),
    items: many(basefruitPurchaseItems),
  }),
);

export const basefruitPurchaseItemsRelations = relations(
  basefruitPurchaseItems,
  ({ one, many }) => ({
    purchase: one(basefruitPurchases, {
      fields: [basefruitPurchaseItems.purchaseId],
      references: [basefruitPurchases.id],
    }),
    fruitVariety: one(baseFruitVarieties, {
      fields: [basefruitPurchaseItems.fruitVarietyId],
      references: [baseFruitVarieties.id],
    }),
    batchCompositions: many(batchCompositions),
  }),
);

/*
// Additive Purchase Relations - Commented out - not yet implemented
export const additivePurchasesRelations = relations(
  additivePurchases,
  ({ one, many }) => ({
    vendor: one(vendors, {
      fields: [additivePurchases.vendorId],
      references: [vendors.id],
    }),
    items: many(additivePurchaseItems),
  }),
);

export const additivePurchaseItemsRelations = relations(
  additivePurchaseItems,
  ({ one }) => ({
    purchase: one(additivePurchases, {
      fields: [additivePurchaseItems.purchaseId],
      references: [additivePurchases.id],
    }),
  }),
);

// Juice Purchase Relations - Commented out - not yet implemented
export const juicePurchasesRelations = relations(
  juicePurchases,
  ({ one, many }) => ({
    vendor: one(vendors, {
      fields: [juicePurchases.vendorId],
      references: [vendors.id],
    }),
    items: many(juicePurchaseItems),
  }),
);

export const juicePurchaseItemsRelations = relations(
  juicePurchaseItems,
  ({ one }) => ({
    purchase: one(juicePurchases, {
      fields: [juicePurchaseItems.purchaseId],
      references: [juicePurchases.id],
    }),
  }),
);

// Packaging Purchase Relations - Commented out - not yet implemented
export const packagingPurchasesRelations = relations(
  packagingPurchases,
  ({ one, many }) => ({
    vendor: one(vendors, {
      fields: [packagingPurchases.vendorId],
      references: [vendors.id],
    }),
    items: many(packagingPurchaseItems),
  }),
);

export const packagingPurchaseItemsRelations = relations(
  packagingPurchaseItems,
  ({ one }) => ({
    purchase: one(packagingPurchases, {
      fields: [packagingPurchaseItems.purchaseId],
      references: [packagingPurchases.id],
    }),
  }),
);
*/

// Old pressRuns and pressItems relations removed - see pressRunsRelations below

export const vesselsRelations = relations(vessels, ({ many }) => ({
  batches: many(batches),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  vessel: one(vessels, {
    fields: [batches.vesselId],
    references: [vessels.id],
  }),
  originPressRun: one(pressRuns, {
    fields: [batches.originPressRunId],
    references: [pressRuns.id],
  }),
  compositions: many(batchCompositions),
  measurements: many(batchMeasurements),
  additives: many(batchAdditives),
  // Transfer relations
  transfersAsSource: many(batchTransfers, { relationName: "sourceTransfers" }),
  transfersAsDestination: many(batchTransfers, {
    relationName: "destinationTransfers",
  }),
  transfersAsRemaining: many(batchTransfers, {
    relationName: "remainingTransfers",
  }),
  // Merge history
  mergeHistory: many(batchMergeHistory),
  // Filter operations
  filterOperations: many(batchFilterOperations),
}));

export const batchMergeHistoryRelations = relations(
  batchMergeHistory,
  ({ one }) => ({
    targetBatch: one(batches, {
      fields: [batchMergeHistory.targetBatchId],
      references: [batches.id],
    }),
    sourcePressRun: one(pressRuns, {
      fields: [batchMergeHistory.sourcePressRunId],
      references: [pressRuns.id],
    }),
  }),
);

export const batchFilterOperationsRelations = relations(
  batchFilterOperations,
  ({ one }) => ({
    batch: one(batches, {
      fields: [batchFilterOperations.batchId],
      references: [batches.id],
    }),
    vessel: one(vessels, {
      fields: [batchFilterOperations.vesselId],
      references: [vessels.id],
    }),
  }),
);

export const batchRackingOperationsRelations = relations(
  batchRackingOperations,
  ({ one }) => ({
    batch: one(batches, {
      fields: [batchRackingOperations.batchId],
      references: [batches.id],
    }),
    sourceVessel: one(vessels, {
      fields: [batchRackingOperations.sourceVesselId],
      references: [vessels.id],
    }),
    destinationVessel: one(vessels, {
      fields: [batchRackingOperations.destinationVesselId],
      references: [vessels.id],
    }),
    rackedByUser: one(users, {
      fields: [batchRackingOperations.rackedBy],
      references: [users.id],
    }),
  }),
);

export const batchCompositionsRelations = relations(
  batchCompositions,
  ({ one }) => ({
    batch: one(batches, {
      fields: [batchCompositions.batchId],
      references: [batches.id],
    }),
    purchaseItem: one(basefruitPurchaseItems, {
      fields: [batchCompositions.purchaseItemId],
      references: [basefruitPurchaseItems.id],
    }),
    vendor: one(vendors, {
      fields: [batchCompositions.vendorId],
      references: [vendors.id],
    }),
    variety: one(baseFruitVarieties, {
      fields: [batchCompositions.varietyId],
      references: [baseFruitVarieties.id],
    }),
  }),
);

export const batchMeasurementsRelations = relations(
  batchMeasurements,
  ({ one }) => ({
    batch: one(batches, {
      fields: [batchMeasurements.batchId],
      references: [batches.id],
    }),
  }),
);

export const batchAdditivesRelations = relations(batchAdditives, ({ one }) => ({
  batch: one(batches, {
    fields: [batchAdditives.batchId],
    references: [batches.id],
  }),
  vessel: one(vessels, {
    fields: [batchAdditives.vesselId],
    references: [vessels.id],
  }),
}));

// Dropped table relations removed:
// - packagesRelations
// - inventoryRelations
// - inventoryTransactionsRelations
// - batchCostsRelations
// - cogsItemsRelations

// Press Run Relations
export const pressRunsRelations = relations(
  pressRuns,
  ({ one, many }) => ({
    // Core entity relationships
    vendor: one(vendors, {
      fields: [pressRuns.vendorId],
      references: [vendors.id],
    }),
    vessel: one(vessels, {
      fields: [pressRuns.vesselId],
      references: [vessels.id],
    }),

    // User attribution relationships for RBAC
    createdByUser: one(users, {
      fields: [pressRuns.createdBy],
      references: [users.id],
    }),
    updatedByUser: one(users, {
      fields: [pressRuns.updatedBy],
      references: [users.id],
    }),

    // Child relationships
    loads: many(pressRunLoads),
    batchesFromOrigin: many(batches, { relationName: "originBatches" }),
  }),
);

export const pressRunLoadsRelations = relations(
  pressRunLoads,
  ({ one }) => ({
    // Parent relationship with cascade delete
    pressRun: one(pressRuns, {
      fields: [pressRunLoads.pressRunId],
      references: [pressRuns.id],
    }),

    // Traceability relationships
    purchaseItem: one(basefruitPurchaseItems, {
      fields: [pressRunLoads.purchaseItemId],
      references: [basefruitPurchaseItems.id],
    }),
    fruitVariety: one(baseFruitVarieties, {
      fields: [pressRunLoads.fruitVarietyId],
      references: [baseFruitVarieties.id],
    }),

    // User attribution relationships
    createdByUser: one(users, {
      fields: [pressRunLoads.createdBy],
      references: [users.id],
    }),
    updatedByUser: one(users, {
      fields: [pressRunLoads.updatedBy],
      references: [users.id],
    }),
  }),
);

// Tank tables and relations dropped (functionality moved to batch operations)

export const batchTransfersRelations = relations(batchTransfers, ({ one }) => ({
  sourceBatch: one(batches, {
    fields: [batchTransfers.sourceBatchId],
    references: [batches.id],
    relationName: "sourceTransfers",
  }),
  sourceVessel: one(vessels, {
    fields: [batchTransfers.sourceVesselId],
    references: [vessels.id],
  }),
  destinationBatch: one(batches, {
    fields: [batchTransfers.destinationBatchId],
    references: [batches.id],
    relationName: "destinationTransfers",
  }),
  destinationVessel: one(vessels, {
    fields: [batchTransfers.destinationVesselId],
    references: [vessels.id],
  }),
  remainingBatch: one(batches, {
    fields: [batchTransfers.remainingBatchId],
    references: [batches.id],
    relationName: "remainingTransfers",
  }),
  transferredByUser: one(users, {
    fields: [batchTransfers.transferredBy],
    references: [users.id],
  }),
}));

// Backward compatibility exports
export const appleVarieties = baseFruitVarieties;
export const appleVarietiesRelations = baseFruitVarietiesRelations;
export const purchases = basefruitPurchases;
export const purchaseItems = basefruitPurchaseItems;
export const batchIngredients = batchCompositions;

// Backward compatibility for renamed press tables (migration 0024)
export const applePressRuns = pressRuns;
export const applePressRunLoads = pressRunLoads;
export const applePressRunsRelations = pressRunsRelations;
export const applePressRunLoadsRelations = pressRunLoadsRelations;

// Re-export audit schema
export * from "./schema/audit";

// Re-export packaging schema
export * from "./schema/packaging";
