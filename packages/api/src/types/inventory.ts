import { z } from 'zod'

// Material type enum matching database schema
export const materialTypeEnum = z.enum(['apple', 'additive', 'juice', 'packaging'])

// Base transaction schema shared across all transaction types
const baseTransactionSchema = z.object({
  transactionDate: z.date().default(() => new Date()),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

// Apple transaction - for fresh apple inventory tracking
const appleTransactionSchema = baseTransactionSchema.extend({
  materialType: z.literal('apple'),
  appleVarietyId: z.string().uuid('Invalid apple variety ID'),
  vendorId: z.string().uuid('Invalid vendor ID').optional(),
  quantityKg: z.number().positive('Quantity must be positive'),
  qualityGrade: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  harvestDate: z.date().optional(),
  storageLocation: z.string().optional(),
  defectPercentage: z.number().min(0).max(100).optional(),
  brixLevel: z.number().positive().optional(),
})

// Additive transaction - for yeast, nutrients, enzymes, etc.
const additiveTransactionSchema = baseTransactionSchema.extend({
  materialType: z.literal('additive'),
  additiveType: z.string().min(1, 'Additive type is required'),
  additiveName: z.string().min(1, 'Additive name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.enum(['kg', 'g', 'L', 'mL', 'tablets', 'packets']),
  expirationDate: z.date().optional(),
  batchNumber: z.string().optional(),
  concentration: z.string().optional(), // e.g., "5% solution", "pure"
  storageRequirements: z.string().optional(), // e.g., "refrigerated", "dry"
})

// Juice transaction - for pressed juice inventory
const juiceTransactionSchema = baseTransactionSchema.extend({
  materialType: z.literal('juice'),
  pressRunId: z.string().uuid('Invalid press run ID').optional(),
  vesselId: z.string().uuid('Invalid vessel ID').optional(),
  volumeL: z.number().positive('Volume must be positive'),
  brixLevel: z.number().positive().optional(),
  phLevel: z.number().positive().optional(),
  varietyComposition: z.array(z.object({
    appleVarietyId: z.string().uuid(),
    percentage: z.number().min(0).max(100),
  })).optional(),
  processDate: z.date().optional(),
  qualityNotes: z.string().optional(),
})

// Packaging transaction - for bottles, caps, labels, etc.
const packagingTransactionSchema = baseTransactionSchema.extend({
  materialType: z.literal('packaging'),
  packagingType: z.enum(['bottle', 'cap', 'label', 'case', 'shrink_wrap', 'carton']),
  packagingName: z.string().min(1, 'Packaging name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.enum(['pieces', 'cases', 'rolls', 'sheets']),
  size: z.string().optional(), // e.g., "750ml", "12oz", "4x3 inches"
  color: z.string().optional(),
  material: z.string().optional(), // e.g., "glass", "plastic", "paper"
  supplier: z.string().optional(),
})

// Discriminated union for all transaction types
export const inventoryTransactionSchema = z.discriminatedUnion('materialType', [
  appleTransactionSchema,
  additiveTransactionSchema,
  juiceTransactionSchema,
  packagingTransactionSchema,
])

// Simplified transaction schema for recording transactions on existing inventory items
export const recordTransactionSchema = z.object({
  inventoryId: z.string().uuid('Invalid inventory ID'),
  transactionType: z.enum(['purchase', 'transfer', 'adjustment', 'sale', 'waste']),
  quantityChange: z.number().int('Quantity change must be an integer'),
  transactionDate: z.date().default(() => new Date()),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

// Extended transaction schema for creating new inventory items with material-specific data
export const createInventoryTransactionSchema = inventoryTransactionSchema.extend({
  quantityChange: z.number().int('Quantity change must be positive for new items').positive(),
  transactionType: z.literal('purchase'), // Only purchases can create new inventory items
})

// Input schema for creating new inventory items
export const createInventoryItemSchema = z.object({
  materialType: materialTypeEnum,
  metadata: z.record(z.any()).default({}),
  location: z.string().optional(),
  notes: z.string().optional(),
  // Material-specific fields will be validated in metadata based on materialType
}).refine(
  (data) => {
    // Add custom validation logic here for metadata based on materialType
    return true
  },
  {
    message: "Invalid metadata for material type",
  }
)

// Query schemas for filtering inventory
export const inventoryListSchema = z.object({
  materialType: materialTypeEnum.optional(),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export const inventorySearchSchema = z.object({
  query: z.string().min(1),
  materialTypes: z.array(materialTypeEnum).optional(),
  limit: z.number().int().positive().max(50).default(20),
})

// Type exports for use in other files
export type MaterialType = z.infer<typeof materialTypeEnum>
export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>
export type RecordTransactionInput = z.infer<typeof recordTransactionSchema>
export type CreateInventoryTransactionInput = z.infer<typeof createInventoryTransactionSchema>
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type InventoryListInput = z.infer<typeof inventoryListSchema>
export type InventorySearchInput = z.infer<typeof inventorySearchSchema>

// Apple-specific transaction type
export type AppleTransaction = z.infer<typeof appleTransactionSchema>
// Additive-specific transaction type
export type AdditiveTransaction = z.infer<typeof additiveTransactionSchema>
// Juice-specific transaction type
export type JuiceTransaction = z.infer<typeof juiceTransactionSchema>
// Packaging-specific transaction type
export type PackagingTransaction = z.infer<typeof packagingTransactionSchema>