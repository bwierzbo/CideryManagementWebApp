/**
 * Comprehensive tests for offline functionality
 * Tests local storage, sync, and conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { offlineStorage, PressRunDraft } from '@/lib/offline-storage'
import { conflictResolver } from '@/lib/conflict-resolution'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Offline Storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Draft Management', () => {
    it('should create and save a draft', () => {
      const draft = offlineStorage.createDraft('vendor-123', 'Test Vendor')

      expect(draft.id).toBeDefined()
      expect(draft.vendorId).toBe('vendor-123')
      expect(draft.vendorName).toBe('Test Vendor')
      expect(draft.status).toBe('draft')
      expect(draft.loads).toEqual([])
      expect(draft.totalAppleWeightKg).toBe(0)
    })

    it('should retrieve saved drafts', () => {
      const draft1 = offlineStorage.createDraft('vendor-123', 'Vendor 1')
      const draft2 = offlineStorage.createDraft('vendor-456', 'Vendor 2')

      const allDrafts = offlineStorage.getAllDrafts()

      expect(allDrafts).toHaveLength(2)
      expect(allDrafts.find(d => d.id === draft1.id)).toBeDefined()
      expect(allDrafts.find(d => d.id === draft2.id)).toBeDefined()
    })

    it('should delete a draft', () => {
      const draft = offlineStorage.createDraft('vendor-123', 'Test Vendor')

      expect(offlineStorage.getAllDrafts()).toHaveLength(1)

      const success = offlineStorage.deleteDraft(draft.id)

      expect(success).toBe(true)
      expect(offlineStorage.getAllDrafts()).toHaveLength(0)
    })

    it('should add loads to draft', () => {
      const draft = offlineStorage.createDraft('vendor-123', 'Test Vendor')

      const success = offlineStorage.addLoadToDraft(draft.id, {
        purchaseLineId: 'purchase-123',
        appleVarietyId: 'variety-456',
        appleVarietyName: 'Honeycrisp',
        weightKg: 50.5,
        weightUnitEntered: 'lbs',
        originalWeight: 111.3,
        originalWeightUnit: 'lb',
        brixMeasured: 12.5,
        phMeasured: 3.8,
        appleCondition: 'excellent',
        defectPercentage: 2.0,
        notes: 'Good quality apples',
      })

      expect(success).toBe(true)

      const updatedDraft = offlineStorage.getDraft(draft.id)
      expect(updatedDraft?.loads).toHaveLength(1)
      expect(updatedDraft?.loads[0].loadSequence).toBe(1)
      expect(updatedDraft?.loads[0].status).toBe('pending')
      expect(updatedDraft?.totalAppleWeightKg).toBe(50.5)
    })

    it('should update loads in draft', () => {
      const draft = offlineStorage.createDraft('vendor-123', 'Test Vendor')

      offlineStorage.addLoadToDraft(draft.id, {
        purchaseLineId: 'purchase-123',
        appleVarietyId: 'variety-456',
        appleVarietyName: 'Honeycrisp',
        weightKg: 50.5,
        weightUnitEntered: 'lbs',
        originalWeight: 111.3,
        originalWeightUnit: 'lb',
      })

      const updatedDraft = offlineStorage.getDraft(draft.id)
      const loadId = updatedDraft!.loads[0].id

      const success = offlineStorage.updateLoadInDraft(draft.id, loadId, {
        brixMeasured: 15.0,
        notes: 'Updated notes',
      })

      expect(success).toBe(true)

      const finalDraft = offlineStorage.getDraft(draft.id)
      expect(finalDraft?.loads[0].brixMeasured).toBe(15.0)
      expect(finalDraft?.loads[0].notes).toBe('Updated notes')
    })

    it('should remove loads from draft', () => {
      const draft = offlineStorage.createDraft('vendor-123', 'Test Vendor')

      offlineStorage.addLoadToDraft(draft.id, {
        purchaseLineId: 'purchase-123',
        appleVarietyId: 'variety-456',
        appleVarietyName: 'Honeycrisp',
        weightKg: 50.5,
        weightUnitEntered: 'lbs',
        originalWeight: 111.3,
        originalWeightUnit: 'lb',
      })

      offlineStorage.addLoadToDraft(draft.id, {
        purchaseLineId: 'purchase-456',
        appleVarietyId: 'variety-789',
        appleVarietyName: 'Gala',
        weightKg: 30.0,
        weightUnitEntered: 'kg',
        originalWeight: 30.0,
        originalWeightUnit: 'kg',
      })

      let updatedDraft = offlineStorage.getDraft(draft.id)
      expect(updatedDraft?.loads).toHaveLength(2)

      const loadIdToRemove = updatedDraft!.loads[0].id
      const success = offlineStorage.removeLoadFromDraft(draft.id, loadIdToRemove)

      expect(success).toBe(true)

      updatedDraft = offlineStorage.getDraft(draft.id)
      expect(updatedDraft?.loads).toHaveLength(1)
      expect(updatedDraft?.loads[0].loadSequence).toBe(1) // Should be resequenced
      expect(updatedDraft?.totalAppleWeightKg).toBe(30.0)
    })
  })

  describe('Storage Management', () => {
    it('should track storage info', () => {
      offlineStorage.createDraft('vendor-123', 'Test Vendor')

      const storageInfo = offlineStorage.getStorageInfo()

      expect(storageInfo).toBeDefined()
      expect(storageInfo!.draftCount).toBe(1)
      expect(storageInfo!.totalSize).toBeGreaterThan(0)
    })

    it('should check storage quota', () => {
      const quota = offlineStorage.checkStorageQuota()

      expect(quota.isNearLimit).toBe(false)
      expect(quota.percentUsed).toBeGreaterThanOrEqual(0)
      expect(quota.estimatedMB).toBeGreaterThanOrEqual(0)
    })

    it('should clear all data', () => {
      offlineStorage.createDraft('vendor-123', 'Test Vendor')
      offlineStorage.createDraft('vendor-456', 'Test Vendor 2')

      expect(offlineStorage.getAllDrafts()).toHaveLength(2)

      offlineStorage.clearAllData()

      expect(offlineStorage.getAllDrafts()).toHaveLength(0)
      const storageInfo = offlineStorage.getStorageInfo()
      expect(storageInfo!.draftCount).toBe(0)
    })
  })

  describe('Sync Queue Management', () => {
    it('should add items to sync queue', () => {
      const queueId = offlineStorage.addToSyncQueue({
        type: 'create_press_run',
        data: { vendorId: 'vendor-123' },
        attempts: 0,
        lastAttempt: null,
      })

      expect(queueId).toBeDefined()

      const queue = offlineStorage.getSyncQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].type).toBe('create_press_run')
    })

    it('should update sync queue items', () => {
      const queueId = offlineStorage.addToSyncQueue({
        type: 'create_press_run',
        data: { vendorId: 'vendor-123' },
        attempts: 0,
        lastAttempt: null,
      })

      const success = offlineStorage.updateSyncQueueItem(queueId, {
        attempts: 1,
        lastAttempt: new Date().toISOString(),
      })

      expect(success).toBe(true)

      const queue = offlineStorage.getSyncQueue()
      expect(queue[0].attempts).toBe(1)
    })

    it('should remove items from sync queue', () => {
      const queueId = offlineStorage.addToSyncQueue({
        type: 'create_press_run',
        data: { vendorId: 'vendor-123' },
        attempts: 0,
        lastAttempt: null,
      })

      expect(offlineStorage.getSyncQueue()).toHaveLength(1)

      const success = offlineStorage.removeFromSyncQueue(queueId)

      expect(success).toBe(true)
      expect(offlineStorage.getSyncQueue()).toHaveLength(0)
    })
  })

  describe('Auto-save Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should schedule auto-save', () => {
      const mockCallback = vi.fn()
      const draftId = 'test-draft'

      offlineStorage.scheduleAutoSave(draftId, mockCallback, 1000)

      expect(mockCallback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)

      expect(mockCallback).toHaveBeenCalledOnce()
    })

    it('should cancel auto-save', () => {
      const mockCallback = vi.fn()
      const draftId = 'test-draft'

      offlineStorage.scheduleAutoSave(draftId, mockCallback, 1000)
      offlineStorage.cancelAutoSave(draftId)

      vi.advanceTimersByTime(1000)

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })
})

describe('Conflict Resolution', () => {
  let localDraft: PressRunDraft
  let serverData: any

  beforeEach(() => {
    localDraft = {
      id: 'draft-123',
      vendorId: 'vendor-456',
      vendorName: 'Test Vendor',
      status: 'draft',
      startTime: '2024-01-15T10:00:00Z',
      loads: [
        {
          id: 'load-1',
          purchaseLineId: 'purchase-123',
          appleVarietyId: 'variety-456',
          appleVarietyName: 'Honeycrisp',
          weightKg: 50.0,
          weightUnitEntered: 'lbs',
          originalWeight: 110.2,
          originalWeightUnit: 'lb',
          brixMeasured: 12.5,
          phMeasured: 3.8,
          status: 'pending',
          loadSequence: 1,
        }
      ],
      lastModified: '2024-01-15T10:30:00Z',
      syncAttempts: 0,
      totalAppleWeightKg: 50.0,
    }

    serverData = {
      id: 'draft-123',
      vendorId: 'vendor-456',
      vendorName: 'Test Vendor',
      status: 'in_progress',
      startTime: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:45:00Z',
      totalAppleWeightKg: '55.0',
      loads: [
        {
          id: 'load-1',
          purchaseItemId: 'purchase-123',
          appleVarietyId: 'variety-456',
          appleVarietyName: 'Honeycrisp',
          appleWeightKg: '55.0',
          originalWeight: '121.3',
          originalWeightUnit: 'lb',
          brixMeasured: '13.0',
          phMeasured: '3.8',
        }
      ]
    }
  })

  it('should detect no conflicts when data is identical', async () => {
    // Make server data identical to local
    serverData.status = 'draft'
    serverData.updatedAt = localDraft.lastModified
    serverData.totalAppleWeightKg = '50.0'
    serverData.loads[0].appleWeightKg = '50.0'
    serverData.loads[0].originalWeight = '110.2'
    serverData.loads[0].brixMeasured = '12.5'

    const result = await conflictResolver.resolveConflicts(localDraft, serverData)

    expect(result.success).toBe(true)
    expect(result.requiresManualReview).toBe(false)
    expect(result.resolvedData).toEqual(localDraft)
  })

  it('should detect data modification conflicts', async () => {
    const result = await conflictResolver.resolveConflicts(localDraft, serverData)

    expect(result.success).toBe(true) // Merge should succeed
    expect(result.requiresManualReview).toBe(false)
    expect(result.resolvedData).toBeDefined()
  })

  it('should handle server data wins strategy', async () => {
    const result = await conflictResolver.resolveConflicts(
      localDraft,
      serverData,
      'server_wins'
    )

    expect(result.success).toBe(true)
    expect(result.requiresManualReview).toBe(false)
    expect(result.resolvedData?.status).toBe('synced') // Converted from server format
  })

  it('should handle local data wins strategy', async () => {
    const result = await conflictResolver.resolveConflicts(
      localDraft,
      serverData,
      'local_wins'
    )

    expect(result.success).toBe(true)
    expect(result.requiresManualReview).toBe(false)
    expect(result.resolvedData).toEqual(localDraft)
  })

  it('should require manual review for data deletion conflicts', async () => {
    const result = await conflictResolver.resolveConflicts(
      localDraft,
      null, // Server data deleted
      'merge'
    )

    expect(result.success).toBe(false)
    expect(result.requiresManualReview).toBe(true)
    expect(result.conflicts).toBeDefined()
    expect(result.conflicts![0].type).toBe('data_deleted')
  })

  it('should merge numeric fields correctly', async () => {
    // Local has lower weight, server has higher
    localDraft.totalAppleWeightKg = 45.0
    localDraft.loads[0].weightKg = 45.0
    serverData.totalAppleWeightKg = '55.0'
    serverData.loads[0].appleWeightKg = '55.0'

    const result = await conflictResolver.resolveConflicts(
      localDraft,
      serverData,
      'merge'
    )

    expect(result.success).toBe(true)
    expect(result.resolvedData?.totalAppleWeightKg).toBe(55.0) // Should use larger value
  })

  it('should merge notes correctly', async () => {
    localDraft.notes = 'Local notes'
    serverData.notes = 'Server notes'

    const result = await conflictResolver.resolveConflicts(
      localDraft,
      serverData,
      'merge'
    )

    expect(result.success).toBe(true)
    expect(result.resolvedData?.notes).toContain('Local notes')
    expect(result.resolvedData?.notes).toContain('[Server]: Server notes')
  })

  it('should handle manual review strategy', async () => {
    const result = await conflictResolver.resolveConflicts(
      localDraft,
      serverData,
      'manual_review'
    )

    expect(result.success).toBe(false)
    expect(result.requiresManualReview).toBe(true)
    expect(result.conflicts).toBeDefined()
  })
})

describe('Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should handle complete offline workflow', () => {
    // 1. Create draft
    const draft = offlineStorage.createDraft('vendor-123', 'Test Vendor')
    expect(draft.status).toBe('draft')

    // 2. Add loads
    offlineStorage.addLoadToDraft(draft.id, {
      purchaseLineId: 'purchase-123',
      appleVarietyId: 'variety-456',
      appleVarietyName: 'Honeycrisp',
      weightKg: 50.5,
      weightUnitEntered: 'lbs',
      originalWeight: 111.3,
      originalWeightUnit: 'lb',
    })

    offlineStorage.addLoadToDraft(draft.id, {
      purchaseLineId: 'purchase-456',
      appleVarietyId: 'variety-789',
      appleVarietyName: 'Gala',
      weightKg: 30.0,
      weightUnitEntered: 'kg',
      originalWeight: 30.0,
      originalWeightUnit: 'kg',
    })

    // 3. Verify draft state
    const updatedDraft = offlineStorage.getDraft(draft.id)
    expect(updatedDraft?.loads).toHaveLength(2)
    expect(updatedDraft?.totalAppleWeightKg).toBe(80.5)

    // 4. Add to sync queue
    const queueId = offlineStorage.addToSyncQueue({
      type: 'create_press_run',
      data: updatedDraft,
      attempts: 0,
      lastAttempt: null,
    })

    expect(offlineStorage.getSyncQueue()).toHaveLength(1)

    // 5. Simulate sync completion
    offlineStorage.updateSyncQueueItem(queueId, {
      attempts: 1,
      lastAttempt: new Date().toISOString(),
    })

    offlineStorage.removeFromSyncQueue(queueId)
    expect(offlineStorage.getSyncQueue()).toHaveLength(0)

    // 6. Update draft status
    const success = offlineStorage.saveDraft({
      ...updatedDraft!,
      status: 'synced',
    })

    expect(success).toBe(true)

    const finalDraft = offlineStorage.getDraft(draft.id)
    expect(finalDraft?.status).toBe('synced')
  })

  it('should handle storage quota limits', () => {
    // Create many drafts to test quota handling
    const drafts = []
    for (let i = 0; i < 10; i++) {
      const draft = offlineStorage.createDraft(`vendor-${i}`, `Vendor ${i}`)
      drafts.push(draft.id)

      // Add multiple loads to each draft
      for (let j = 0; j < 5; j++) {
        offlineStorage.addLoadToDraft(draft.id, {
          purchaseLineId: `purchase-${i}-${j}`,
          appleVarietyId: `variety-${j}`,
          appleVarietyName: `Variety ${j}`,
          weightKg: Math.random() * 100,
          weightUnitEntered: 'kg',
          originalWeight: Math.random() * 100,
          originalWeightUnit: 'kg',
          notes: `Test notes for load ${i}-${j}`.repeat(10), // Make it larger
        })
      }
    }

    const quota = offlineStorage.checkStorageQuota()
    expect(quota.estimatedMB).toBeGreaterThan(0)

    const storageInfo = offlineStorage.getStorageInfo()
    expect(storageInfo?.draftCount).toBe(10)
  })
})