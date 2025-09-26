import { pgTable, uuid, text, decimal, integer, timestamp, boolean, jsonb, pgEnum, date, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// PostgreSQL Enums
export const unitEnum = pgEnum('unit', ['kg', 'lb', 'L', 'gal', 'bushel'])
export const batchStatusEnum = pgEnum('batch_status', ['planned', 'active', 'packaged'])
export const vesselStatusEnum = pgEnum('vessel_status', ['available', 'in_use', 'cleaning', 'maintenance', 'empty', 'fermenting', 'storing', 'aging'])
export const vesselTypeEnum = pgEnum('vessel_type', ['fermenter', 'conditioning_tank', 'bright_tank', 'storage'])
export const vesselMaterialEnum = pgEnum('vessel_material', ['stainless_steel', 'plastic'])
export const vesselJacketedEnum = pgEnum('vessel_jacketed', ['yes', 'no'])
export const transactionTypeEnum = pgEnum('transaction_type', ['purchase', 'transfer', 'adjustment', 'sale', 'waste'])
export const cogsItemTypeEnum = pgEnum('cogs_item_type', ['apple_cost', 'labor', 'overhead', 'packaging'])
export const userRoleEnum = pgEnum('user_role', ['admin', 'operator'])
export const pressRunStatusEnum = pgEnum('press_run_status', [
  'draft',        // Initial state, can be edited freely
  'in_progress',  // Active pressing session in mobile app
  'completed',    // Finished pressing, juice transferred to vessel
  'cancelled'     // Cancelled press run, resources released
])
export const fruitTypeEnum = pgEnum('fruit_type', ['apple', 'pear', 'plum'])

// Fruit variety characteristic enums
export const ciderCategoryEnum = pgEnum('cider_category_enum', ['sweet', 'bittersweet', 'sharp', 'bittersharp'])
export const intensityEnum = pgEnum('intensity_enum', ['high', 'medium-high', 'medium', 'low-medium', 'low'])
export const harvestWindowEnum = pgEnum('harvest_window_enum', ['Late', 'Mid-Late', 'Mid', 'Early-Mid', 'Early'])
export const materialTypeEnum = pgEnum('material_type', ['apple', 'additive', 'juice', 'packaging'])
export const packagingItemTypeEnum = pgEnum('packaging_item_type', [
  'Primary Packaging',
  'Closures',
  'Secondary Packaging',
  'Tertiary Packaging'
])

// Core Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('operator'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactInfo: jsonb('contact_info'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const baseFruitVarieties = pgTable('base_fruit_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  fruitType: fruitTypeEnum('fruit_type').notNull().default('apple'),
  // Fruit variety characteristics
  ciderCategory: ciderCategoryEnum('cider_category'),
  tannin: intensityEnum('tannin'),
  acid: intensityEnum('acid'),
  sugarBrix: intensityEnum('sugar_brix'),
  harvestWindow: harvestWindowEnum('harvest_window'),
  varietyNotes: text('variety_notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  // Unique constraint on name - case-insensitive will be handled manually
  nameUniqueIdx: uniqueIndex('base_fruit_varieties_name_unique_idx').on(table.name)
}))

export const vendorVarieties = pgTable('vendor_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  varietyId: uuid('variety_id').notNull().references(() => baseFruitVarieties.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  // Unique constraint to prevent duplicate vendor-variety pairs
  vendorVarietyUniqueIdx: uniqueIndex('vendor_varieties_vendor_variety_unique_idx').on(table.vendorId, table.varietyId),
  // Performance indexes
  vendorIdx: index('vendor_varieties_vendor_idx').on(table.vendorId),
  varietyIdx: index('vendor_varieties_variety_idx').on(table.varietyId)
}))

// Additive Varieties
export const additiveVarieties = pgTable('additive_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  itemType: text('item_type').notNull(), // enzyme, nutrient, clarifier, preservative, acid, other
  isActive: boolean('is_active').notNull().default(true),
  labelImpact: boolean('label_impact').notNull().default(false),
  labelImpactNotes: text('label_impact_notes'),
  allergensVegan: boolean('allergens_vegan').notNull().default(false),
  allergensVeganNotes: text('allergens_vegan_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  nameUniqueIdx: uniqueIndex('additive_varieties_name_unique_idx').on(table.name)
}))

export const vendorAdditiveVarieties = pgTable('vendor_additive_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  varietyId: uuid('variety_id').notNull().references(() => additiveVarieties.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  vendorVarietyUniqueIdx: uniqueIndex('vendor_additive_varieties_vendor_variety_unique_idx').on(table.vendorId, table.varietyId),
  vendorIdx: index('vendor_additive_varieties_vendor_idx').on(table.vendorId),
  varietyIdx: index('vendor_additive_varieties_variety_idx').on(table.varietyId)
}))

// Juice Varieties
export const juiceVarieties = pgTable('juice_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  nameUniqueIdx: uniqueIndex('juice_varieties_name_unique_idx').on(table.name)
}))

export const vendorJuiceVarieties = pgTable('vendor_juice_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  varietyId: uuid('variety_id').notNull().references(() => juiceVarieties.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  vendorVarietyUniqueIdx: uniqueIndex('vendor_juice_varieties_vendor_variety_unique_idx').on(table.vendorId, table.varietyId),
  vendorIdx: index('vendor_juice_varieties_vendor_idx').on(table.vendorId),
  varietyIdx: index('vendor_juice_varieties_variety_idx').on(table.varietyId)
}))

// Packaging Varieties
export const packagingVarieties = pgTable('packaging_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  itemType: packagingItemTypeEnum('item_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  nameUniqueIdx: uniqueIndex('packaging_varieties_name_unique_idx').on(table.name)
}))

export const vendorPackagingVarieties = pgTable('vendor_packaging_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  varietyId: uuid('variety_id').notNull().references(() => packagingVarieties.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  vendorVarietyUniqueIdx: uniqueIndex('vendor_packaging_varieties_vendor_variety_unique_idx').on(table.vendorId, table.varietyId),
  vendorIdx: index('vendor_packaging_varieties_vendor_idx').on(table.vendorId),
  varietyIdx: index('vendor_packaging_varieties_variety_idx').on(table.varietyId)
}))

export const basefruitPurchases = pgTable('basefruit_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  purchaseDate: timestamp('purchase_date').notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  invoiceNumber: text('invoice_number'),
  autoGeneratedInvoice: boolean('auto_generated_invoice').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const basefruitPurchaseItems = pgTable('basefruit_purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull().references(() => basefruitPurchases.id),
  fruitVarietyId: uuid('fruit_variety_id').notNull().references(() => baseFruitVarieties.id),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: unitEnum('unit').notNull(),
  pricePerUnit: decimal('price_per_unit', { precision: 8, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
  // Canonical storage (always kg for weight, L for volume)
  quantityKg: decimal('quantity_kg', { precision: 10, scale: 3 }),
  quantityL: decimal('quantity_l', { precision: 10, scale: 3 }),
  // New fields for flexible purchasing
  harvestDate: date('harvest_date'),
  originalUnit: text('original_unit'),
  originalQuantity: decimal('original_quantity', { precision: 10, scale: 2 }),
  notes: text('notes'),
  // Track if this purchase line has been fully depleted
  isDepleted: boolean('is_depleted').default(false),
  depletedAt: timestamp('depleted_at'),
  depletedBy: uuid('depleted_by'),
  depletedInPressRun: uuid('depleted_in_press_run'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

// Additive Purchases
export const additivePurchases = pgTable('additive_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  purchaseDate: timestamp('purchase_date').notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  invoiceNumber: text('invoice_number'),
  autoGeneratedInvoice: boolean('auto_generated_invoice').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const additivePurchaseItems = pgTable('additive_purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull().references(() => additivePurchases.id),
  additiveVarietyId: uuid('additive_variety_id').references(() => additiveVarieties.id),
  // Legacy fields for backward compatibility - can be removed once migrated
  additiveType: text('additive_type'), // enzyme, nutrient, clarifier, preservative, acid, other
  brandManufacturer: text('brand_manufacturer'),
  productName: text('product_name'),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: text('unit').notNull(), // g, kg, oz, lb
  lotBatchNumber: text('lot_batch_number'),
  expirationDate: date('expiration_date'),
  storageRequirements: text('storage_requirements'),
  pricePerUnit: decimal('price_per_unit', { precision: 8, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

// Juice Purchases
export const juicePurchases = pgTable('juice_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  purchaseDate: timestamp('purchase_date').notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  invoiceNumber: text('invoice_number'),
  autoGeneratedInvoice: boolean('auto_generated_invoice').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const juicePurchaseItems = pgTable('juice_purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull().references(() => juicePurchases.id),
  juiceVarietyId: uuid('juice_variety_id').references(() => juiceVarieties.id),
  // Legacy fields for backward compatibility - can be removed once migrated
  juiceType: text('juice_type'),
  varietyName: text('variety_name'),
  volumeL: decimal('volume_l', { precision: 10, scale: 3 }).notNull(),
  brix: decimal('brix', { precision: 5, scale: 2 }),
  containerType: text('container_type'), // drum, tote, tank
  pricePerLiter: decimal('price_per_liter', { precision: 8, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

// Packaging Purchases
export const packagingPurchases = pgTable('packaging_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  purchaseDate: timestamp('purchase_date').notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  invoiceNumber: text('invoice_number'),
  autoGeneratedInvoice: boolean('auto_generated_invoice').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const packagingPurchaseItems = pgTable('packaging_purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull().references(() => packagingPurchases.id),
  packagingVarietyId: uuid('packaging_variety_id').references(() => packagingVarieties.id),
  // Legacy fields for backward compatibility - can be removed once migrated
  packageType: text('package_type'), // bottles, cans, kegs, labels, caps
  materialType: text('material_type'), // glass, aluminum, stainless, paper
  size: text('size').notNull(), // 12oz, 16oz, 750ml, 5gal, etc
  quantity: integer('quantity').notNull(),
  pricePerUnit: decimal('price_per_unit', { precision: 8, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const pressRuns = pgTable('press_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  runDate: timestamp('run_date').notNull(),
  notes: text('notes'),
  totalAppleProcessedKg: decimal('total_apple_processed_kg', { precision: 10, scale: 3 }).notNull(),
  totalJuiceProducedL: decimal('total_juice_produced_l', { precision: 10, scale: 3 }).notNull(),
  extractionRate: decimal('extraction_rate', { precision: 5, scale: 4 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const pressItems = pgTable('press_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  pressRunId: uuid('press_run_id').notNull().references(() => applePressRuns.id),
  purchaseItemId: uuid('purchase_item_id').notNull().references(() => basefruitPurchaseItems.id),
  quantityUsedKg: decimal('quantity_used_kg', { precision: 10, scale: 3 }).notNull(),
  juiceProducedL: decimal('juice_produced_l', { precision: 10, scale: 3 }).notNull(),
  brixMeasured: decimal('brix_measured', { precision: 4, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const vessels = pgTable('vessels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  type: vesselTypeEnum('type'), // TEMPORARY: Keep for DB compatibility until migration
  capacityL: decimal('capacity_l', { precision: 10, scale: 3 }).notNull(),
  capacityUnit: unitEnum('capacity_unit').notNull().default('L'),
  material: vesselMaterialEnum('material'),
  jacketed: vesselJacketedEnum('jacketed'),
  status: vesselStatusEnum('status').notNull().default('available'),
  location: text('location'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const juiceLots = pgTable('juice_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  pressRunId: uuid('press_run_id').notNull().references(() => applePressRuns.id),
  volumeL: decimal('volume_l', { precision: 10, scale: 3 }).notNull(),
  brix: decimal('brix', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  pressRunIdx: index('juice_lots_press_run_idx').on(table.pressRunId)
}))

export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  juiceLotId: uuid('juice_lot_id').references(() => juiceLots.id),
  vesselId: uuid('vessel_id').references(() => vessels.id),
  name: text('name').notNull().unique(),
  customName: text('custom_name'),
  batchNumber: text('batch_number').notNull(),
  initialVolumeL: decimal('initial_volume_l', { precision: 10, scale: 3 }).notNull(),
  currentVolumeL: decimal('current_volume_l', { precision: 10, scale: 3 }),
  status: batchStatusEnum('status').notNull().default('active'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp('end_date', { withTimezone: true }),
  originPressRunId: uuid('origin_press_run_id').references(() => applePressRuns.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  vesselIdx: index('batches_vessel_idx').on(table.vesselId),
  statusIdx: index('batches_status_idx').on(table.status),
  originPressRunIdx: index('batches_origin_press_run_idx').on(table.originPressRunId)
}))

export const batchCompositions = pgTable('batch_compositions', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  purchaseItemId: uuid('purchase_item_id').notNull().references(() => basefruitPurchaseItems.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  varietyId: uuid('variety_id').notNull().references(() => baseFruitVarieties.id),
  lotCode: text('lot_code'),
  inputWeightKg: decimal('input_weight_kg', { precision: 12, scale: 3 }).notNull(),
  juiceVolumeL: decimal('juice_volume_l', { precision: 12, scale: 3 }).notNull(),
  fractionOfBatch: decimal('fraction_of_batch', { precision: 8, scale: 6 }).notNull(),
  materialCost: decimal('material_cost', { precision: 12, scale: 2 }).notNull(),
  avgBrix: decimal('avg_brix', { precision: 5, scale: 2 }),
  estSugarKg: decimal('est_sugar_kg', { precision: 12, scale: 3 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  batchCompositionUniqueIdx: uniqueIndex('batch_compositions_batch_purchase_item_unique_idx').on(table.batchId, table.purchaseItemId),
  batchIdx: index('batch_compositions_batch_idx').on(table.batchId),
  purchaseItemIdx: index('batch_compositions_purchase_item_idx').on(table.purchaseItemId),
  // CHECK constraints for data integrity
  inputWeightKgPositive: sql`CHECK (input_weight_kg >= 0)`,
  juiceVolumeLPositive: sql`CHECK (juice_volume_l >= 0)`,
  fractionOfBatchValid: sql`CHECK (fraction_of_batch >= 0 AND fraction_of_batch <= 1)`,
  materialCostPositive: sql`CHECK (material_cost >= 0)`
}))

export const batchMeasurements = pgTable('batch_measurements', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  measurementDate: timestamp('measurement_date').notNull(),
  specificGravity: decimal('specific_gravity', { precision: 5, scale: 4 }),
  abv: decimal('abv', { precision: 4, scale: 2 }),
  ph: decimal('ph', { precision: 3, scale: 2 }),
  totalAcidity: decimal('total_acidity', { precision: 4, scale: 2 }),
  temperature: decimal('temperature', { precision: 4, scale: 1 }),
  volumeL: decimal('volume_l', { precision: 10, scale: 3 }),
  notes: text('notes'),
  takenBy: text('taken_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const batchAdditives = pgTable('batch_additives', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  vesselId: uuid('vessel_id').notNull().references(() => vessels.id),
  additiveType: text('additive_type').notNull(),
  additiveName: text('additive_name').notNull(),
  amount: decimal('amount', { precision: 10, scale: 3 }).notNull(),
  unit: text('unit').notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  addedBy: text('added_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  packageDate: timestamp('package_date').notNull(),
  volumePackagedL: decimal('volume_packaged_l', { precision: 10, scale: 3 }).notNull(),
  bottleSize: text('bottle_size').notNull(),
  bottleCount: integer('bottle_count').notNull(),
  abvAtPackaging: decimal('abv_at_packaging', { precision: 4, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  packageId: uuid('package_id').notNull().references(() => packages.id),
  currentBottleCount: integer('current_bottle_count').notNull(),
  reservedBottleCount: integer('reserved_bottle_count').notNull().default(0),
  materialType: materialTypeEnum('material_type').notNull().default('apple'),
  metadata: jsonb('metadata').notNull().default('{}'),
  location: text('location'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  inventoryId: uuid('inventory_id').notNull().references(() => inventory.id),
  transactionType: transactionTypeEnum('transaction_type').notNull(),
  quantityChange: integer('quantity_change').notNull(),
  transactionDate: timestamp('transaction_date').notNull(),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const batchCosts = pgTable('batch_costs', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  totalAppleCost: decimal('total_apple_cost', { precision: 10, scale: 2 }).notNull(),
  laborCost: decimal('labor_cost', { precision: 10, scale: 2 }).notNull().default('0.00'),
  overheadCost: decimal('overhead_cost', { precision: 10, scale: 2 }).notNull().default('0.00'),
  packagingCost: decimal('packaging_cost', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  costPerBottle: decimal('cost_per_bottle', { precision: 8, scale: 4 }),
  costPerL: decimal('cost_per_l', { precision: 8, scale: 4 }),
  calculatedAt: timestamp('calculated_at').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

export const cogsItems = pgTable('cogs_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  itemType: cogsItemTypeEnum('item_type').notNull(),
  description: text('description').notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 3 }),
  unit: unitEnum('unit'),
  appliedAt: timestamp('applied_at').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
})

// ApplePress Mobile Workflow Tables - separate from existing press tables
export const applePressRuns = pgTable('apple_press_runs', {
  // Primary identification
  id: uuid('id').primaryKey().defaultRandom(),
  pressRunName: text('press_run_name'), // Format: yyyy/mm/dd-##

  // Core relationships following existing foreign key patterns
  vendorId: uuid('vendor_id').references(() => vendors.id), // Nullable - vendor determined by loads
  vesselId: uuid('vessel_id').references(() => vessels.id), // Target vessel for juice collection

  // Workflow status with enum constraint
  status: pressRunStatusEnum('status').notNull().default('draft'),

  // Timing fields for session management
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  scheduledDate: date('scheduled_date'), // Planning/scheduling support

  // Aggregate measurements (calculated from loads)
  // Using existing decimal precision patterns: precision 10, scale 3 for weights/volumes
  totalAppleWeightKg: decimal('total_apple_weight_kg', { precision: 10, scale: 3 }),
  totalJuiceVolumeL: decimal('total_juice_volume_l', { precision: 10, scale: 3 }),
  extractionRate: decimal('extraction_rate', { precision: 5, scale: 4 }), // Percentage with 4 decimal precision

  // Labor cost tracking following existing cost field patterns
  laborHours: decimal('labor_hours', { precision: 8, scale: 2 }),
  laborCostPerHour: decimal('labor_cost_per_hour', { precision: 8, scale: 2 }),
  totalLaborCost: decimal('total_labor_cost', { precision: 10, scale: 2 }), // Matches existing cost precision

  // Operational metadata
  notes: text('notes'),
  pressingMethod: text('pressing_method'), // e.g., "hydraulic", "screw_press", "bladder_press"
  weatherConditions: text('weather_conditions'), // External factors affecting pressing

  // Full audit trail following existing pattern from schema.ts
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at') // Soft delete support
}, (table) => ({
  // Performance indexes optimized for mobile app query patterns
  vendorIdx: index('apple_press_runs_vendor_idx').on(table.vendorId),
  statusIdx: index('apple_press_runs_status_idx').on(table.status),
  scheduledDateIdx: index('apple_press_runs_scheduled_date_idx').on(table.scheduledDate),
  startTimeIdx: index('apple_press_runs_start_time_idx').on(table.startTime),

  // Composite indexes for common filtered queries
  vendorStatusIdx: index('apple_press_runs_vendor_status_idx').on(table.vendorId, table.status),
  dateStatusIdx: index('apple_press_runs_date_status_idx').on(table.scheduledDate, table.status),

  // User attribution indexes for audit queries
  createdByIdx: index('apple_press_runs_created_by_idx').on(table.createdBy),
  updatedByIdx: index('apple_press_runs_updated_by_idx').on(table.updatedBy)
}))

export const applePressRunLoads = pgTable('apple_press_run_loads', {
  // Primary identification
  id: uuid('id').primaryKey().defaultRandom(),

  // Core relationships with proper cascade behavior
  applePressRunId: uuid('apple_press_run_id').notNull().references(() => applePressRuns.id, { onDelete: 'cascade' }),
  purchaseItemId: uuid('purchase_item_id').notNull().references(() => basefruitPurchaseItems.id), // Traceability chain
  fruitVarietyId: uuid('fruit_variety_id').notNull().references(() => baseFruitVarieties.id),

  // Load sequencing for ordered processing
  loadSequence: integer('load_sequence').notNull(), // Order within press run (1, 2, 3, ...)

  // Apple weight measurements following canonical storage pattern from basefruitPurchaseItems
  appleWeightKg: decimal('apple_weight_kg', { precision: 10, scale: 3 }).notNull(), // Canonical storage in kg
  originalWeight: decimal('original_weight', { precision: 10, scale: 3 }), // As entered by user
  originalWeightUnit: text('original_weight_unit'), // Original unit for display/editing

  // Juice volume measurements following same pattern
  juiceVolumeL: decimal('juice_volume_l', { precision: 10, scale: 3 }), // Canonical storage in L
  originalVolume: decimal('original_volume', { precision: 10, scale: 3 }), // As entered by user
  originalVolumeUnit: text('original_volume_unit'), // Original unit for display/editing

  // Quality measurements following existing precision patterns
  brixMeasured: decimal('brix_measured', { precision: 4, scale: 2 }), // Sugar content
  phMeasured: decimal('ph_measured', { precision: 3, scale: 2 }), // Acidity measurement

  // Load-specific operational data
  notes: text('notes'),
  pressedAt: timestamp('pressed_at'), // When this specific load was processed

  // Fruit condition tracking for quality control
  appleCondition: text('apple_condition'), // e.g., "excellent", "good", "fair", "poor"
  defectPercentage: decimal('defect_percentage', { precision: 4, scale: 2 }), // % of damaged fruit

  // Full audit trail matching applePressRuns pattern
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at') // Soft delete support
}, (table) => ({
  // Performance indexes for mobile queries
  applePressRunIdx: index('apple_press_run_loads_apple_press_run_idx').on(table.applePressRunId),
  purchaseItemIdx: index('apple_press_run_loads_purchase_item_idx').on(table.purchaseItemId),
  varietyIdx: index('apple_press_run_loads_variety_idx').on(table.fruitVarietyId),

  // Composite index for ordered retrieval within press run
  sequenceIdx: index('apple_press_run_loads_sequence_idx').on(table.applePressRunId, table.loadSequence),

  // User attribution indexes
  createdByIdx: index('apple_press_run_loads_created_by_idx').on(table.createdBy),
  updatedByIdx: index('apple_press_run_loads_updated_by_idx').on(table.updatedBy),

  // Unique constraint to prevent duplicate sequences within a press run
  uniqueSequence: uniqueIndex('apple_press_run_loads_unique_sequence').on(table.applePressRunId, table.loadSequence)
}))

// Audit log for tracking all changes
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id').notNull(),
  operation: text('operation').notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  changedBy: text('changed_by'),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  reason: text('reason')
})

export const batchTransfers = pgTable('batch_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Source batch information (completed batch)
  sourceBatchId: uuid('source_batch_id').notNull().references(() => batches.id),
  sourceVesselId: uuid('source_vessel_id').notNull().references(() => vessels.id),
  // Destination batch information (new batch created)
  destinationBatchId: uuid('destination_batch_id').notNull().references(() => batches.id),
  destinationVesselId: uuid('destination_vessel_id').notNull().references(() => vessels.id),
  // Optional remaining batch (if partial transfer)
  remainingBatchId: uuid('remaining_batch_id').references(() => batches.id),
  // Transfer details
  volumeTransferredL: decimal('volume_transferred_l', { precision: 10, scale: 3 }).notNull(),
  lossL: decimal('loss_l', { precision: 10, scale: 3 }).default('0'),
  totalVolumeProcessedL: decimal('total_volume_processed_l', { precision: 10, scale: 3 }).notNull(), // transferred + loss
  remainingVolumeL: decimal('remaining_volume_l', { precision: 10, scale: 3 }), // left in source vessel
  notes: text('notes'),
  // Metadata
  transferredAt: timestamp('transferred_at').notNull().defaultNow(),
  transferredBy: uuid('transferred_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  sourceBatchIdx: index('batch_transfers_source_batch_idx').on(table.sourceBatchId),
  destinationBatchIdx: index('batch_transfers_destination_batch_idx').on(table.destinationBatchId),
  sourceVesselIdx: index('batch_transfers_source_vessel_idx').on(table.sourceVesselId),
  destinationVesselIdx: index('batch_transfers_destination_vessel_idx').on(table.destinationVesselId),
  transferredAtIdx: index('batch_transfers_transferred_at_idx').on(table.transferredAt)
}))

// Batch merge history for tracking when batches are combined
export const batchMergeHistory = pgTable('batch_merge_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Target batch that received the merge
  targetBatchId: uuid('target_batch_id').notNull().references(() => batches.id),
  // Source information (new juice being added)
  sourcePressRunId: uuid('source_press_run_id').references(() => applePressRuns.id),
  sourceType: text('source_type').notNull(), // 'press_run' or 'batch_transfer'
  // Volume details
  volumeAddedL: decimal('volume_added_l', { precision: 10, scale: 3 }).notNull(),
  targetVolumeBeforeL: decimal('target_volume_before_l', { precision: 10, scale: 3 }).notNull(),
  targetVolumeAfterL: decimal('target_volume_after_l', { precision: 10, scale: 3 }).notNull(),
  // Composition snapshot at time of merge
  compositionSnapshot: jsonb('composition_snapshot'), // Store varieties and percentages
  notes: text('notes'),
  // Metadata
  mergedAt: timestamp('merged_at').notNull().defaultNow(),
  mergedBy: uuid('merged_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  targetBatchIdx: index('batch_merge_history_target_batch_idx').on(table.targetBatchId),
  sourcePressRunIdx: index('batch_merge_history_source_press_run_idx').on(table.sourcePressRunId),
  mergedAtIdx: index('batch_merge_history_merged_at_idx').on(table.mergedAt)
}))

// Relations
export const vendorsRelations = relations(vendors, ({ many }) => ({
  basefruitPurchases: many(basefruitPurchases),
  additivePurchases: many(additivePurchases),
  juicePurchases: many(juicePurchases),
  packagingPurchases: many(packagingPurchases),
  vendorVarieties: many(vendorVarieties),
  vendorAdditiveVarieties: many(vendorAdditiveVarieties),
  vendorJuiceVarieties: many(vendorJuiceVarieties),
  vendorPackagingVarieties: many(vendorPackagingVarieties),
  batchCompositions: many(batchCompositions)
}))

export const baseFruitVarietiesRelations = relations(baseFruitVarieties, ({ many }) => ({
  vendorVarieties: many(vendorVarieties),
  batchCompositions: many(batchCompositions),
  applePressRunLoads: many(applePressRunLoads)
}))

export const vendorVarietiesRelations = relations(vendorVarieties, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorVarieties.vendorId],
    references: [vendors.id]
  }),
  variety: one(baseFruitVarieties, {
    fields: [vendorVarieties.varietyId],
    references: [baseFruitVarieties.id]
  })
}))

// Additive Variety Relations
export const additiveVarietiesRelations = relations(additiveVarieties, ({ many }) => ({
  vendorAdditiveVarieties: many(vendorAdditiveVarieties)
}))

export const vendorAdditiveVarietiesRelations = relations(vendorAdditiveVarieties, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorAdditiveVarieties.vendorId],
    references: [vendors.id]
  }),
  variety: one(additiveVarieties, {
    fields: [vendorAdditiveVarieties.varietyId],
    references: [additiveVarieties.id]
  })
}))

// Juice Variety Relations
export const juiceVarietiesRelations = relations(juiceVarieties, ({ many }) => ({
  vendorJuiceVarieties: many(vendorJuiceVarieties)
}))

export const vendorJuiceVarietiesRelations = relations(vendorJuiceVarieties, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorJuiceVarieties.vendorId],
    references: [vendors.id]
  }),
  variety: one(juiceVarieties, {
    fields: [vendorJuiceVarieties.varietyId],
    references: [juiceVarieties.id]
  })
}))

// Packaging Variety Relations
export const packagingVarietiesRelations = relations(packagingVarieties, ({ many }) => ({
  vendorPackagingVarieties: many(vendorPackagingVarieties)
}))

export const vendorPackagingVarietiesRelations = relations(vendorPackagingVarieties, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorPackagingVarieties.vendorId],
    references: [vendors.id]
  }),
  variety: one(packagingVarieties, {
    fields: [vendorPackagingVarieties.varietyId],
    references: [packagingVarieties.id]
  })
}))

export const basefruitPurchasesRelations = relations(basefruitPurchases, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [basefruitPurchases.vendorId],
    references: [vendors.id]
  }),
  items: many(basefruitPurchaseItems)
}))

export const basefruitPurchaseItemsRelations = relations(basefruitPurchaseItems, ({ one, many }) => ({
  purchase: one(basefruitPurchases, {
    fields: [basefruitPurchaseItems.purchaseId],
    references: [basefruitPurchases.id]
  }),
  fruitVariety: one(baseFruitVarieties, {
    fields: [basefruitPurchaseItems.fruitVarietyId],
    references: [baseFruitVarieties.id]
  }),
  pressItems: many(pressItems),
  batchCompositions: many(batchCompositions)
}))

// Additive Purchase Relations
export const additivePurchasesRelations = relations(additivePurchases, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [additivePurchases.vendorId],
    references: [vendors.id]
  }),
  items: many(additivePurchaseItems)
}))

export const additivePurchaseItemsRelations = relations(additivePurchaseItems, ({ one }) => ({
  purchase: one(additivePurchases, {
    fields: [additivePurchaseItems.purchaseId],
    references: [additivePurchases.id]
  })
}))

// Juice Purchase Relations
export const juicePurchasesRelations = relations(juicePurchases, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [juicePurchases.vendorId],
    references: [vendors.id]
  }),
  items: many(juicePurchaseItems)
}))

export const juicePurchaseItemsRelations = relations(juicePurchaseItems, ({ one }) => ({
  purchase: one(juicePurchases, {
    fields: [juicePurchaseItems.purchaseId],
    references: [juicePurchases.id]
  })
}))

// Packaging Purchase Relations
export const packagingPurchasesRelations = relations(packagingPurchases, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [packagingPurchases.vendorId],
    references: [vendors.id]
  }),
  items: many(packagingPurchaseItems)
}))

export const packagingPurchaseItemsRelations = relations(packagingPurchaseItems, ({ one }) => ({
  purchase: one(packagingPurchases, {
    fields: [packagingPurchaseItems.purchaseId],
    references: [packagingPurchases.id]
  })
}))

export const pressRunsRelations = relations(pressRuns, ({ many }) => ({
  items: many(pressItems),
  juiceLots: many(juiceLots),
  batchesFromOrigin: many(batches, { relationName: 'originBatches' })
}))

export const juiceLotsRelations = relations(juiceLots, ({ one, many }) => ({
  pressRun: one(applePressRuns, {
    fields: [juiceLots.pressRunId],
    references: [applePressRuns.id]
  }),
  batches: many(batches)
}))

export const pressItemsRelations = relations(pressItems, ({ one, many }) => ({
  pressRun: one(applePressRuns, {
    fields: [pressItems.pressRunId],
    references: [applePressRuns.id]
  }),
  purchaseItem: one(basefruitPurchaseItems, {
    fields: [pressItems.purchaseItemId],
    references: [basefruitPurchaseItems.id]
  }),
  batchCompositions: many(batchCompositions)
}))

export const vesselsRelations = relations(vessels, ({ many }) => ({
  batches: many(batches),
  tankMeasurements: many(tankMeasurements),
  tankAdditives: many(tankAdditives)
}))

export const batchesRelations = relations(batches, ({ one, many }) => ({
  vessel: one(vessels, {
    fields: [batches.vesselId],
    references: [vessels.id]
  }),
  juiceLot: one(juiceLots, {
    fields: [batches.juiceLotId],
    references: [juiceLots.id]
  }),
  originPressRun: one(applePressRuns, {
    fields: [batches.originPressRunId],
    references: [applePressRuns.id]
  }),
  compositions: many(batchCompositions),
  measurements: many(batchMeasurements),
  additives: many(batchAdditives),
  packages: many(packages),
  costs: many(batchCosts),
  cogsItems: many(cogsItems),
  // Transfer relations
  transfersAsSource: many(batchTransfers, { relationName: 'sourceTransfers' }),
  transfersAsDestination: many(batchTransfers, { relationName: 'destinationTransfers' }),
  transfersAsRemaining: many(batchTransfers, { relationName: 'remainingTransfers' }),
  // Merge history
  mergeHistory: many(batchMergeHistory)
}))

export const batchMergeHistoryRelations = relations(batchMergeHistory, ({ one }) => ({
  targetBatch: one(batches, {
    fields: [batchMergeHistory.targetBatchId],
    references: [batches.id]
  }),
  sourcePressRun: one(applePressRuns, {
    fields: [batchMergeHistory.sourcePressRunId],
    references: [applePressRuns.id]
  })
}))

export const batchCompositionsRelations = relations(batchCompositions, ({ one }) => ({
  batch: one(batches, {
    fields: [batchCompositions.batchId],
    references: [batches.id]
  }),
  purchaseItem: one(basefruitPurchaseItems, {
    fields: [batchCompositions.purchaseItemId],
    references: [basefruitPurchaseItems.id]
  }),
  vendor: one(vendors, {
    fields: [batchCompositions.vendorId],
    references: [vendors.id]
  }),
  variety: one(baseFruitVarieties, {
    fields: [batchCompositions.varietyId],
    references: [baseFruitVarieties.id]
  })
}))

export const batchMeasurementsRelations = relations(batchMeasurements, ({ one }) => ({
  batch: one(batches, {
    fields: [batchMeasurements.batchId],
    references: [batches.id]
  })
}))

export const batchAdditivesRelations = relations(batchAdditives, ({ one }) => ({
  batch: one(batches, {
    fields: [batchAdditives.batchId],
    references: [batches.id]
  }),
  vessel: one(vessels, {
    fields: [batchAdditives.vesselId],
    references: [vessels.id]
  })
}))

export const packagesRelations = relations(packages, ({ one, many }) => ({
  batch: one(batches, {
    fields: [packages.batchId],
    references: [batches.id]
  }),
  inventory: many(inventory)
}))

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  package: one(packages, {
    fields: [inventory.packageId],
    references: [packages.id]
  }),
  transactions: many(inventoryTransactions)
}))

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  inventory: one(inventory, {
    fields: [inventoryTransactions.inventoryId],
    references: [inventory.id]
  })
}))

export const batchCostsRelations = relations(batchCosts, ({ one }) => ({
  batch: one(batches, {
    fields: [batchCosts.batchId],
    references: [batches.id]
  })
}))

export const cogsItemsRelations = relations(cogsItems, ({ one }) => ({
  batch: one(batches, {
    fields: [cogsItems.batchId],
    references: [batches.id]
  })
}))

// ApplePress Relations
export const applePressRunsRelations = relations(applePressRuns, ({ one, many }) => ({
  // Core entity relationships
  vendor: one(vendors, {
    fields: [applePressRuns.vendorId],
    references: [vendors.id]
  }),
  vessel: one(vessels, {
    fields: [applePressRuns.vesselId],
    references: [vessels.id]
  }),

  // User attribution relationships for RBAC
  createdByUser: one(users, {
    fields: [applePressRuns.createdBy],
    references: [users.id]
  }),
  updatedByUser: one(users, {
    fields: [applePressRuns.updatedBy],
    references: [users.id]
  }),

  // Child relationships
  loads: many(applePressRunLoads)
}))

export const applePressRunLoadsRelations = relations(applePressRunLoads, ({ one }) => ({
  // Parent relationship with cascade delete
  applePressRun: one(applePressRuns, {
    fields: [applePressRunLoads.applePressRunId],
    references: [applePressRuns.id]
  }),

  // Traceability relationships
  purchaseItem: one(basefruitPurchaseItems, {
    fields: [applePressRunLoads.purchaseItemId],
    references: [basefruitPurchaseItems.id]
  }),
  fruitVariety: one(baseFruitVarieties, {
    fields: [applePressRunLoads.fruitVarietyId],
    references: [baseFruitVarieties.id]
  }),

  // User attribution relationships
  createdByUser: one(users, {
    fields: [applePressRunLoads.createdBy],
    references: [users.id]
  }),
  updatedByUser: one(users, {
    fields: [applePressRunLoads.updatedBy],
    references: [users.id]
  })
}))

// Tank Management Tables
export const tankMeasurements = pgTable('tank_measurements', {
  id: uuid('id').primaryKey().defaultRandom(),
  vesselId: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  measurementDate: timestamp('measurement_date').notNull().defaultNow(),
  tempC: decimal('temp_c', { precision: 5, scale: 2 }),
  sh: decimal('sh', { precision: 5, scale: 2 }),
  ph: decimal('ph', { precision: 4, scale: 2 }),
  ta: decimal('ta', { precision: 5, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  vesselIdx: index('tank_measurements_vessel_idx').on(table.vesselId),
  dateIdx: index('tank_measurements_date_idx').on(table.measurementDate)
}))

export const tankAdditives = pgTable('tank_additives', {
  id: uuid('id').primaryKey().defaultRandom(),
  vesselId: uuid('vessel_id').notNull().references(() => vessels.id, { onDelete: 'cascade' }),
  additiveType: text('additive_type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 3 }).notNull(),
  unit: text('unit').notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  vesselIdx: index('tank_additives_vessel_idx').on(table.vesselId),
  addedAtIdx: index('tank_additives_added_at_idx').on(table.addedAt)
}))

// Tank Relations
export const tankMeasurementsRelations = relations(tankMeasurements, ({ one }) => ({
  vessel: one(vessels, {
    fields: [tankMeasurements.vesselId],
    references: [vessels.id]
  }),
  createdByUser: one(users, {
    fields: [tankMeasurements.createdBy],
    references: [users.id]
  })
}))

export const tankAdditivesRelations = relations(tankAdditives, ({ one }) => ({
  vessel: one(vessels, {
    fields: [tankAdditives.vesselId],
    references: [vessels.id]
  }),
  createdByUser: one(users, {
    fields: [tankAdditives.createdBy],
    references: [users.id]
  })
}))

export const batchTransfersRelations = relations(batchTransfers, ({ one }) => ({
  sourceBatch: one(batches, {
    fields: [batchTransfers.sourceBatchId],
    references: [batches.id],
    relationName: 'sourceTransfers'
  }),
  sourceVessel: one(vessels, {
    fields: [batchTransfers.sourceVesselId],
    references: [vessels.id]
  }),
  destinationBatch: one(batches, {
    fields: [batchTransfers.destinationBatchId],
    references: [batches.id],
    relationName: 'destinationTransfers'
  }),
  destinationVessel: one(vessels, {
    fields: [batchTransfers.destinationVesselId],
    references: [vessels.id]
  }),
  remainingBatch: one(batches, {
    fields: [batchTransfers.remainingBatchId],
    references: [batches.id],
    relationName: 'remainingTransfers'
  }),
  transferredByUser: one(users, {
    fields: [batchTransfers.transferredBy],
    references: [users.id]
  })
}))

// Backward compatibility exports
export const appleVarieties = baseFruitVarieties
export const appleVarietiesRelations = baseFruitVarietiesRelations
export const purchases = basefruitPurchases
export const purchaseItems = basefruitPurchaseItems
export const batchIngredients = batchCompositions

// Re-export audit schema
export * from './schema/audit'

// Re-export packaging schema
export * from './schema/packaging'