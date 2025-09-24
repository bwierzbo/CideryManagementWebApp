/**
 * Zod schemas for Data Transfer Objects (DTOs)
 * Provides type-safe validation for API requests and database operations
 */

import { z } from 'zod'

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format')
export const positiveNumberSchema = z.number().positive('Must be a positive number')
export const nonNegativeNumberSchema = z.number().nonnegative('Must be non-negative')
export const dateSchema = z.date()
export const isoDateStringSchema = z.string().datetime('Invalid ISO date string')

// Unit enum schema
export const unitSchema = z.enum(['kg', 'lb', 'L', 'gal'], {
  message: 'Unit must be one of: kg, lb, L, gal'
})

// Status enum schemas
export const batchStatusSchema = z.enum(['planned', 'active', 'completed', 'cancelled'])
export const vesselStatusSchema = z.enum(['available', 'in_use', 'cleaning', 'maintenance'])
export const vesselTypeSchema = z.enum(['fermenter', 'conditioning_tank', 'bright_tank', 'storage'])
export const transactionTypeSchema = z.enum(['purchase', 'transfer', 'adjustment', 'sale', 'waste'])
export const cogsItemTypeSchema = z.enum(['apple_cost', 'labor', 'overhead', 'packaging'])

// Additive type enum schema
export const additiveTypeSchema = z.enum([
  'Sugar & Sweeteners',
  'Flavorings & Adjuncts',
  'Fermentation Organisms',
  'Enzymes',
  'Antioxidants & Antimicrobials',
  'Tannins & Mouthfeel',
  'Acids & Bases',
  'Nutrients',
  'Stabilizers',
  'Refining & Clarifying'
], {
  message: 'Invalid additive type'
})

// Packaging item type enum schema
export const packagingItemTypeSchema = z.enum([
  'Primary Packaging',
  'Closures',
  'Secondary Packaging',
  'Tertiary Packaging'
], {
  message: 'Invalid packaging item type'
})

// Vendor schemas
export const vendorContactInfoSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional()
})

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(255, 'Name too long'),
  contactInfo: vendorContactInfoSchema.optional(),
  isActive: z.boolean().default(true)
})

export const updateVendorSchema = createVendorSchema.partial()

export const vendorSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  contactInfo: vendorContactInfoSchema.nullable(),
  isActive: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Apple Variety schemas
export const createAppleVarietySchema = z.object({
  name: z.string().min(1, 'Variety name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  typicalBrix: z.number().min(0).max(30, 'Brix must be between 0 and 30').optional(),
  notes: z.string().max(1000, 'Notes too long').optional()
})

export const updateAppleVarietySchema = createAppleVarietySchema.partial()

export const appleVarietySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  typicalBrix: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Purchase schemas
export const createPurchaseItemSchema = z.object({
  appleVarietyId: uuidSchema,
  quantity: positiveNumberSchema,
  unit: unitSchema,
  pricePerUnit: positiveNumberSchema,
  totalCost: positiveNumberSchema,
  quantityKg: positiveNumberSchema.optional(),
  quantityL: positiveNumberSchema.optional(),
  notes: z.string().max(500, 'Notes too long').optional()
})

export const createPurchaseSchema = z.object({
  vendorId: uuidSchema,
  purchaseDate: dateSchema,
  totalCost: positiveNumberSchema,
  invoiceNumber: z.string().max(100, 'Invoice number too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  items: z.array(createPurchaseItemSchema).min(1, 'At least one item is required')
})

export const updatePurchaseSchema = createPurchaseSchema.partial().extend({
  items: z.array(createPurchaseItemSchema).optional()
})

export const purchaseItemSchema = z.object({
  id: uuidSchema,
  purchaseId: uuidSchema,
  appleVarietyId: uuidSchema,
  quantity: z.number(),
  unit: unitSchema,
  pricePerUnit: z.number(),
  totalCost: z.number(),
  quantityKg: z.number().nullable(),
  quantityL: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

export const purchaseSchema = z.object({
  id: uuidSchema,
  vendorId: uuidSchema,
  purchaseDate: dateSchema,
  totalCost: z.number(),
  invoiceNumber: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable(),
  items: z.array(purchaseItemSchema).optional()
})

// Press Run schemas
export const createPressItemSchema = z.object({
  purchaseItemId: uuidSchema,
  quantityUsedKg: positiveNumberSchema,
  juiceProducedL: nonNegativeNumberSchema,
  brixMeasured: z.number().min(0).max(30, 'Brix must be between 0 and 30').optional(),
  notes: z.string().max(500, 'Notes too long').optional()
})

export const createPressRunSchema = z.object({
  runDate: dateSchema,
  notes: z.string().max(1000, 'Notes too long').optional(),
  totalAppleProcessedKg: positiveNumberSchema,
  totalJuiceProducedL: nonNegativeNumberSchema,
  extractionRate: z.number().min(0).max(1, 'Extraction rate must be between 0 and 1').optional(),
  items: z.array(createPressItemSchema).min(1, 'At least one press item is required')
})

export const updatePressRunSchema = createPressRunSchema.partial().extend({
  items: z.array(createPressItemSchema).optional()
})

export const pressRunSchema = z.object({
  id: uuidSchema,
  runDate: dateSchema,
  notes: z.string().nullable(),
  totalAppleProcessedKg: z.number(),
  totalJuiceProducedL: z.number(),
  extractionRate: z.number().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Vessel schemas
export const createVesselSchema = z.object({
  name: z.string().min(1, 'Vessel name is required').max(100, 'Name too long'),
  type: vesselTypeSchema,
  capacityL: positiveNumberSchema,
  status: vesselStatusSchema.default('available'),
  location: z.string().max(200, 'Location too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional()
})

export const updateVesselSchema = createVesselSchema.partial()

export const vesselSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: vesselTypeSchema,
  capacityL: z.number(),
  status: vesselStatusSchema,
  location: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Batch schemas
export const createBatchSchema = z.object({
  batchNumber: z.string().min(1, 'Batch number is required').max(50, 'Batch number too long'),
  status: batchStatusSchema.default('planned'),
  vesselId: uuidSchema.optional(),
  startDate: dateSchema,
  targetCompletionDate: dateSchema.optional(),
  initialVolumeL: positiveNumberSchema,
  currentVolumeL: positiveNumberSchema,
  targetAbv: z.number().min(0).max(20, 'ABV must be between 0 and 20').optional(),
  actualAbv: z.number().min(0).max(20, 'ABV must be between 0 and 20').optional(),
  notes: z.string().max(1000, 'Notes too long').optional()
})

export const updateBatchSchema = createBatchSchema.partial().extend({
  actualCompletionDate: dateSchema.optional()
})

export const batchSchema = z.object({
  id: uuidSchema,
  batchNumber: z.string(),
  status: batchStatusSchema,
  vesselId: uuidSchema.nullable(),
  startDate: dateSchema,
  targetCompletionDate: dateSchema.nullable(),
  actualCompletionDate: dateSchema.nullable(),
  initialVolumeL: z.number(),
  currentVolumeL: z.number(),
  targetAbv: z.number().nullable(),
  actualAbv: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Transfer schemas (for moving batches between vessels)
export const createTransferSchema = z.object({
  batchId: uuidSchema,
  fromVesselId: uuidSchema.optional(),
  toVesselId: uuidSchema,
  volumeTransferredL: positiveNumberSchema,
  transferDate: dateSchema,
  reason: z.string().max(500, 'Reason too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional()
})

export const transferSchema = z.object({
  id: uuidSchema,
  batchId: uuidSchema,
  fromVesselId: uuidSchema.nullable(),
  toVesselId: uuidSchema,
  volumeTransferredL: z.number(),
  transferDate: dateSchema,
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema
})

// Packaging Run schemas
export const createPackagingRunSchema = z.object({
  batchId: uuidSchema,
  packageDate: dateSchema,
  volumePackagedL: positiveNumberSchema,
  bottleSize: z.string().min(1, 'Bottle size is required').max(20, 'Bottle size too long'),
  bottleCount: z.number().int().positive('Bottle count must be a positive integer'),
  abvAtPackaging: z.number().min(0).max(20, 'ABV must be between 0 and 20').optional(),
  notes: z.string().max(1000, 'Notes too long').optional()
})

export const updatePackagingRunSchema = createPackagingRunSchema.partial()

export const packagingRunSchema = z.object({
  id: uuidSchema,
  batchId: uuidSchema,
  packageDate: dateSchema,
  volumePackagedL: z.number(),
  bottleSize: z.string(),
  bottleCount: z.number(),
  abvAtPackaging: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Measurement schemas
export const createMeasurementSchema = z.object({
  batchId: uuidSchema,
  measurementDate: dateSchema,
  specificGravity: z.number().min(0.980).max(1.200, 'Specific gravity must be between 0.980 and 1.200').optional(),
  abv: z.number().min(0).max(20, 'ABV must be between 0 and 20').optional(),
  ph: z.number().min(0).max(14, 'pH must be between 0 and 14').optional(),
  totalAcidity: z.number().min(0).max(5, 'Total acidity must be between 0 and 5').optional(),
  temperature: z.number().min(-10).max(50, 'Temperature must be between -10 and 50°C').optional(),
  volumeL: positiveNumberSchema.optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  takenBy: z.string().max(100, 'Name too long').optional()
})

export const updateMeasurementSchema = createMeasurementSchema.partial()

export const measurementSchema = z.object({
  id: uuidSchema,
  batchId: uuidSchema,
  measurementDate: dateSchema,
  specificGravity: z.number().nullable(),
  abv: z.number().nullable(),
  ph: z.number().nullable(),
  totalAcidity: z.number().nullable(),
  temperature: z.number().nullable(),
  volumeL: z.number().nullable(),
  notes: z.string().nullable(),
  takenBy: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.nullable()
})

// Export types inferred from schemas
export type CreateVendor = z.infer<typeof createVendorSchema>
export type UpdateVendor = z.infer<typeof updateVendorSchema>
export type Vendor = z.infer<typeof vendorSchema>

export type CreateAppleVariety = z.infer<typeof createAppleVarietySchema>
export type UpdateAppleVariety = z.infer<typeof updateAppleVarietySchema>
export type AppleVariety = z.infer<typeof appleVarietySchema>

export type CreatePurchase = z.infer<typeof createPurchaseSchema>
export type UpdatePurchase = z.infer<typeof updatePurchaseSchema>
export type Purchase = z.infer<typeof purchaseSchema>
export type PurchaseItem = z.infer<typeof purchaseItemSchema>

export type CreatePressRun = z.infer<typeof createPressRunSchema>
export type UpdatePressRun = z.infer<typeof updatePressRunSchema>
export type PressRun = z.infer<typeof pressRunSchema>

export type CreateVessel = z.infer<typeof createVesselSchema>
export type UpdateVessel = z.infer<typeof updateVesselSchema>
export type Vessel = z.infer<typeof vesselSchema>

export type CreateBatch = z.infer<typeof createBatchSchema>
export type UpdateBatch = z.infer<typeof updateBatchSchema>
export type Batch = z.infer<typeof batchSchema>

export type CreateTransfer = z.infer<typeof createTransferSchema>
export type Transfer = z.infer<typeof transferSchema>

export type CreatePackagingRun = z.infer<typeof createPackagingRunSchema>
export type UpdatePackagingRun = z.infer<typeof updatePackagingRunSchema>
export type PackagingRun = z.infer<typeof packagingRunSchema>

export type CreateMeasurement = z.infer<typeof createMeasurementSchema>
export type UpdateMeasurement = z.infer<typeof updateMeasurementSchema>
export type Measurement = z.infer<typeof measurementSchema>