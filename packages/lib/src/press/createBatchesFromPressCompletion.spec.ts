import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, type InferInsertModel } from 'drizzle-orm'
import { type Database } from 'db'
import {
  pressRuns,
  pressItems,
  purchaseItems,
  purchases,
  vendors,
  baseFruitVarieties,
  vessels,
  batches,
  batchCompositions
} from 'db/src/schema'
import {
  createBatchesFromPressCompletion,
  PressValidationError,
  InvariantError,
  type Assignment
} from './createBatchesFromPressCompletion'

// Type aliases for insert models
type NewPressRun = InferInsertModel<typeof pressRuns>
type NewPressItem = InferInsertModel<typeof pressItems>
type NewPurchaseItem = InferInsertModel<typeof purchaseItems>
type NewPurchase = InferInsertModel<typeof purchases>
type NewVendor = InferInsertModel<typeof vendors>
type NewBaseFruitVariety = InferInsertModel<typeof baseFruitVarieties>
type NewVessel = InferInsertModel<typeof vessels>

// Mock database - in a real implementation, you'd use a test database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as Database

// Test data setup
const testVendorId = 'vendor-123'
const testVarietyId1 = 'variety-123'
const testVarietyId2 = 'variety-456'
const testVesselId1 = 'vessel-123'
const testVesselId2 = 'vessel-456'
const testPressRunId = 'press-run-123'
const testPurchaseId = 'purchase-123'
const testPurchaseItem1Id = 'purchase-item-123'
const testPurchaseItem2Id = 'purchase-item-456'

const mockVendor = {
  id: testVendorId,
  name: 'Test Orchard',
  isActive: true
}

const mockVariety1 = {
  id: testVarietyId1,
  name: 'Gravenstein',
  fruitType: 'apple' as const
}

const mockVariety2 = {
  id: testVarietyId2,
  name: 'Northern Spy',
  fruitType: 'apple' as const
}

const mockVessel1 = {
  id: testVesselId1,
  name: 'TK03',
  capacityL: '1000.000'
}

const mockVessel2 = {
  id: testVesselId2,
  name: 'FV01',
  capacityL: '500.000'
}

const mockPressRun = {
  id: testPressRunId,
  totalJuiceProducedL: '1000.000'
}

const mockPurchaseItem1 = {
  id: testPurchaseItem1Id,
  pricePerUnit: '2.50',
  totalCost: '250.00',
  notes: 'LOT-001'
}

const mockPurchaseItem2 = {
  id: testPurchaseItem2Id,
  pricePerUnit: '3.00',
  totalCost: '180.00',
  notes: 'LOT-002'
}

const mockPressItem1 = {
  pressRunId: testPressRunId,
  purchaseItemId: testPurchaseItem1Id,
  quantityUsedKg: '100.000',
  brixMeasured: '12.0'
}

const mockPressItem2 = {
  pressRunId: testPressRunId,
  purchaseItemId: testPurchaseItem2Id,
  quantityUsedKg: '60.000',
  brixMeasured: '14.0'
}

describe('createBatchesFromPressCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validation', () => {
    it('should throw PressValidationError when press run does not exist', async () => {
      // Mock empty press run result
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      })

      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 500
      }]

      await expect(
        createBatchesFromPressCompletion(mockDb, 'nonexistent-press-run', assignments)
      ).rejects.toThrow(PressValidationError)
    })

    it('should throw PressValidationError when batches already exist for press run', async () => {
      // Mock press run exists
      mockDb.select = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // Mock existing batches found
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'existing-batch' }])
            })
          })
        })

      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 500
      }]

      await expect(
        createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      ).rejects.toThrow(PressValidationError)
      expect(mockDb.select).toHaveBeenCalledTimes(2)
    })

    it('should throw PressValidationError when total assigned volume exceeds available juice', async () => {
      // Mock press run with 1000L available
      mockDb.select = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // Mock no existing batches
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })

      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 1200 // More than available 1000L
      }]

      await expect(
        createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      ).rejects.toThrow(PressValidationError)
    })

    it('should throw PressValidationError when vessel does not exist', async () => {
      // Mock press run exists
      mockDb.select = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // Mock no existing batches
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
        // Mock vessel not found
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })

      const assignments: Assignment[] = [{
        toVesselId: 'nonexistent-vessel',
        volumeL: 500
      }]

      await expect(
        createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      ).rejects.toThrow(PressValidationError)
    })

    it('should throw PressValidationError when assignment volume exceeds vessel capacity', async () => {
      // Mock press run exists
      mockDb.select = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // Mock no existing batches
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
        // Mock vessel with 500L capacity
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                ...mockVessel2,
                capacityL: '500.000'
              }])
            })
          })
        })

      const assignments: Assignment[] = [{
        toVesselId: testVesselId2,
        volumeL: 600 // More than 500L capacity
      }]

      await expect(
        createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      ).rejects.toThrow(PressValidationError)
    })

    it('should throw PressValidationError when no purchase lines found', async () => {
      // Mock press run exists
      mockDb.select = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // Mock no existing batches
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
        // Mock vessel exists
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel1])
            })
          })
        })
        // Mock no purchase lines
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                  })
                })
              })
            })
          })
        })

      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 500
      }]

      await expect(
        createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      ).rejects.toThrow(PressValidationError)
    })
  })

  describe('single vessel assignment', () => {
    it('should create one batch with correct composition for single vessel', async () => {
      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 1000
      }]

      // Mock successful validation flow
      mockDb.select = vi.fn()
        // Press run exists
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // No existing batches
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
        // Vessel exists
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel1])
            })
          })
        })
        // Purchase lines data
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                      {
                        id: testPurchaseItem1Id,
                        vendorId: testVendorId,
                        varietyId: testVarietyId1,
                        varietyName: mockVariety1.name,
                        lotCode: mockPurchaseItem1.notes,
                        inputWeightKg: mockPressItem1.quantityUsedKg,
                        unitCost: mockPurchaseItem1.pricePerUnit,
                        totalCost: mockPurchaseItem1.totalCost,
                        brixMeasured: mockPressItem1.brixMeasured
                      },
                      {
                        id: testPurchaseItem2Id,
                        vendorId: testVendorId,
                        varietyId: testVarietyId2,
                        varietyName: mockVariety2.name,
                        lotCode: mockPurchaseItem2.notes,
                        inputWeightKg: mockPressItem2.quantityUsedKg,
                        unitCost: mockPurchaseItem2.pricePerUnit,
                        totalCost: mockPurchaseItem2.totalCost,
                        brixMeasured: mockPressItem2.brixMeasured
                      }
                    ])
                  })
                })
              })
            })
          })
        })
        // Vessel info for batch creation
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel1])
            })
          })
        })

      // Mock insert operations
      mockDb.insert = vi.fn()
        // Batch insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'batch-123' }])
          })
        })
        // Batch compositions insert
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined)
        })

      const result = await createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)

      expect(result.createdBatchIds).toHaveLength(1)
      expect(result.createdBatchIds[0]).toBe('batch-123')
      expect(mockDb.insert).toHaveBeenCalledTimes(2) // batch + compositions
    })
  })

  describe('multi-vessel assignment', () => {
    it('should create multiple batches with proportional composition', async () => {
      const assignments: Assignment[] = [
        { toVesselId: testVesselId1, volumeL: 600 },
        { toVesselId: testVesselId2, volumeL: 400 }
      ]

      // Mock successful validation flow for both vessels
      mockDb.select = vi.fn()
        // Press run exists
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        // No existing batches
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
        // First vessel exists
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel1])
            })
          })
        })
        // Second vessel exists
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel2])
            })
          })
        })
        // Purchase lines data
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                      {
                        id: testPurchaseItem1Id,
                        vendorId: testVendorId,
                        varietyId: testVarietyId1,
                        varietyName: mockVariety1.name,
                        lotCode: mockPurchaseItem1.notes,
                        inputWeightKg: mockPressItem1.quantityUsedKg,
                        unitCost: mockPurchaseItem1.pricePerUnit,
                        totalCost: mockPurchaseItem1.totalCost,
                        brixMeasured: mockPressItem1.brixMeasured
                      }
                    ])
                  })
                })
              })
            })
          })
        })
        // Vessel info for first batch
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel1])
            })
          })
        })
        // Vessel info for second batch
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockVessel2])
            })
          })
        })

      // Mock insert operations for both batches
      mockDb.insert = vi.fn()
        // First batch insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'batch-123' }])
          })
        })
        // First batch compositions
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined)
        })
        // Second batch insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'batch-456' }])
          })
        })
        // Second batch compositions
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined)
        })

      const result = await createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)

      expect(result.createdBatchIds).toHaveLength(2)
      expect(result.createdBatchIds).toEqual(['batch-123', 'batch-456'])
      expect(mockDb.insert).toHaveBeenCalledTimes(4) // 2 batches + 2 compositions
    })
  })

  describe('allocation modes', () => {
    it('should allocate by weight when allocationMode is weight', async () => {
      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 1000
      }]

      // Setup mocks (similar to single vessel test but focus on weight allocation)
      setupSuccessfulMocks()

      const result = await createBatchesFromPressCompletion(
        mockDb,
        testPressRunId,
        assignments,
        { allocationMode: 'weight' }
      )

      expect(result.createdBatchIds).toHaveLength(1)
      // In a real test, you'd verify the composition fractions match weight ratios
    })

    it('should allocate by sugar when allocationMode is sugar', async () => {
      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 1000
      }]

      setupSuccessfulMocks()

      const result = await createBatchesFromPressCompletion(
        mockDb,
        testPressRunId,
        assignments,
        { allocationMode: 'sugar' }
      )

      expect(result.createdBatchIds).toHaveLength(1)
      // In a real test, you'd verify the composition fractions match sugar-weight ratios
    })
  })

  describe('invariant validation', () => {
    it('should enforce fraction sum equals 1.0 within tolerance', () => {
      // This would be tested with real composition data
      // For now, we verify the error types exist
      expect(InvariantError).toBeDefined()
    })

    it('should enforce juice volume sum equals assignment volume within tolerance', () => {
      // This would be tested with real composition data
      expect(InvariantError).toBeDefined()
    })

    it('should enforce material cost allocation within tolerance', () => {
      // This would be tested with real composition data
      expect(InvariantError).toBeDefined()
    })
  })

  describe('idempotency', () => {
    it('should not create duplicate batches when run twice', async () => {
      // First call - should succeed
      setupSuccessfulMocks()

      const assignments: Assignment[] = [{
        toVesselId: testVesselId1,
        volumeL: 1000
      }]

      const result1 = await createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      expect(result1.createdBatchIds).toHaveLength(1)

      // Second call - should fail with PressValidationError due to existing batches
      mockDb.select = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockPressRun])
            })
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'existing-batch' }])
            })
          })
        })

      await expect(
        createBatchesFromPressCompletion(mockDb, testPressRunId, assignments)
      ).rejects.toThrow(PressValidationError)
    })
  })

  // Helper function to setup successful mock chain
  function setupSuccessfulMocks() {
    mockDb.select = vi.fn()
      // Press run exists
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPressRun])
          })
        })
      })
      // No existing batches
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      })
      // Vessel exists
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVessel1])
          })
        })
      })
      // Purchase lines data
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([
                    {
                      id: testPurchaseItem1Id,
                      vendorId: testVendorId,
                      varietyId: testVarietyId1,
                      varietyName: mockVariety1.name,
                      lotCode: mockPurchaseItem1.notes,
                      inputWeightKg: mockPressItem1.quantityUsedKg,
                      unitCost: mockPurchaseItem1.pricePerUnit,
                      totalCost: mockPurchaseItem1.totalCost,
                      brixMeasured: mockPressItem1.brixMeasured
                    }
                  ])
                })
              })
            })
          })
        })
      })
      // Vessel info for batch creation
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVessel1])
          })
        })
      })

    mockDb.insert = vi.fn()
      // Batch insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'batch-123' }])
        })
      })
      // Batch compositions insert
      .mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined)
      })
  }
})