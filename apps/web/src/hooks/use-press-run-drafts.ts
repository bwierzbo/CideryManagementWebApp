/**
 * React hooks for managing press run drafts and offline storage
 */

import { useState, useEffect, useCallback } from 'react'
import { trpc } from '@/utils/trpc'
import { offlineStorage, PressRunDraft, PressRunLoadDraft, SyncQueueItem } from '@/lib/offline-storage'

export interface DraftOperationResult {
  success: boolean
  error?: string
  draftId?: string
}

export function usePressRunDrafts() {
  const [drafts, setDrafts] = useState<PressRunDraft[]>([])
  const [loading, setLoading] = useState(true)

  // Load drafts from local storage
  const loadDrafts = useCallback(() => {
    setLoading(true)
    try {
      const storedDrafts = offlineStorage.getAllDrafts()
      setDrafts(storedDrafts)
    } catch (error) {
      console.error('Failed to load drafts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialize drafts on mount
  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  // Create new draft
  const createDraft = useCallback((vendorId: string, vendorName?: string): DraftOperationResult => {
    try {
      const draft = offlineStorage.createDraft(vendorId, vendorName)
      loadDrafts() // Refresh drafts
      return { success: true, draftId: draft.id }
    } catch (error) {
      console.error('Failed to create draft:', error)
      return { success: false, error: 'Failed to create draft' }
    }
  }, [loadDrafts])

  // Delete draft
  const deleteDraft = useCallback((draftId: string): DraftOperationResult => {
    try {
      const success = offlineStorage.deleteDraft(draftId)
      if (success) {
        loadDrafts() // Refresh drafts
        return { success: true }
      }
      return { success: false, error: 'Failed to delete draft' }
    } catch (error) {
      console.error('Failed to delete draft:', error)
      return { success: false, error: 'Failed to delete draft' }
    }
  }, [loadDrafts])

  // Get specific draft
  const getDraft = useCallback((draftId: string) => {
    return offlineStorage.getDraft(draftId)
  }, [])

  return {
    drafts,
    loading,
    loadDrafts,
    createDraft,
    deleteDraft,
    getDraft,
  }
}

export function usePressRunDraft(draftId: string | null) {
  const [draft, setDraft] = useState<PressRunDraft | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Load specific draft
  const loadDraft = useCallback(() => {
    if (!draftId) {
      setDraft(null)
      return
    }

    const storedDraft = offlineStorage.getDraft(draftId)
    setDraft(storedDraft)
  }, [draftId])

  // Initialize draft on mount
  useEffect(() => {
    loadDraft()
  }, [loadDraft])

  // Auto-save draft
  const saveDraft = useCallback(async (updatedDraft?: Partial<PressRunDraft>) => {
    if (!draft) return { success: false, error: 'No draft to save' }

    setAutoSaving(true)
    try {
      const draftToSave = updatedDraft ? { ...draft, ...updatedDraft } : draft
      const success = offlineStorage.saveDraft(draftToSave)

      if (success) {
        setLastSaved(new Date())
        loadDraft() // Refresh the draft
        return { success: true }
      }
      return { success: false, error: 'Failed to save draft' }
    } catch (error) {
      console.error('Failed to save draft:', error)
      return { success: false, error: 'Failed to save draft' }
    } finally {
      setAutoSaving(false)
    }
  }, [draft, loadDraft])

  // Schedule auto-save (30 seconds after last change)
  const scheduleAutoSave = useCallback(() => {
    if (!draftId || !draft) return

    offlineStorage.scheduleAutoSave(draftId, () => {
      saveDraft()
    }, 30000) // 30 seconds
  }, [draftId, draft, saveDraft])

  // Add load to draft
  const addLoad = useCallback((loadData: Omit<PressRunLoadDraft, 'id' | 'loadSequence' | 'status'>) => {
    if (!draftId) return { success: false, error: 'No draft ID' }

    try {
      const success = offlineStorage.addLoadToDraft(draftId, {
        ...loadData,
        status: 'pending',
      })

      if (success) {
        loadDraft() // Refresh the draft
        scheduleAutoSave() // Schedule auto-save
        return { success: true }
      }
      return { success: false, error: 'Failed to add load' }
    } catch (error) {
      console.error('Failed to add load:', error)
      return { success: false, error: 'Failed to add load' }
    }
  }, [draftId, loadDraft, scheduleAutoSave])

  // Update load in draft
  const updateLoad = useCallback((loadId: string, updates: Partial<PressRunLoadDraft>) => {
    if (!draftId) return { success: false, error: 'No draft ID' }

    try {
      const success = offlineStorage.updateLoadInDraft(draftId, loadId, updates)

      if (success) {
        loadDraft() // Refresh the draft
        scheduleAutoSave() // Schedule auto-save
        return { success: true }
      }
      return { success: false, error: 'Failed to update load' }
    } catch (error) {
      console.error('Failed to update load:', error)
      return { success: false, error: 'Failed to update load' }
    }
  }, [draftId, loadDraft, scheduleAutoSave])

  // Remove load from draft
  const removeLoad = useCallback((loadId: string) => {
    if (!draftId) return { success: false, error: 'No draft ID' }

    try {
      const success = offlineStorage.removeLoadFromDraft(draftId, loadId)

      if (success) {
        loadDraft() // Refresh the draft
        scheduleAutoSave() // Schedule auto-save
        return { success: true }
      }
      return { success: false, error: 'Failed to remove load' }
    } catch (error) {
      console.error('Failed to remove load:', error)
      return { success: false, error: 'Failed to remove load' }
    }
  }, [draftId, loadDraft, scheduleAutoSave])

  // Update draft metadata
  const updateDraft = useCallback((updates: Partial<PressRunDraft>) => {
    if (!draft) return { success: false, error: 'No draft' }

    const updatedDraft = { ...draft, ...updates }
    setDraft(updatedDraft)
    scheduleAutoSave()

    return { success: true }
  }, [draft, scheduleAutoSave])

  // Manual save
  const saveNow = useCallback(async () => {
    if (!draftId) return { success: false, error: 'No draft ID' }

    // Cancel any scheduled auto-save
    offlineStorage.cancelAutoSave(draftId)

    return await saveDraft()
  }, [draftId, saveDraft])

  return {
    draft,
    autoSaving,
    lastSaved,
    addLoad,
    updateLoad,
    removeLoad,
    updateDraft,
    saveDraft: saveNow,
    scheduleAutoSave,
  }
}

export function useNetworkSync() {
  const [syncing, setSyncing] = useState(false)
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([])
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // tRPC mutations for sync
  const createPressRun = trpc.pressRun.create.useMutation()
  const addLoadMutation = trpc.pressRun.addLoad.useMutation()
  const finishPressRun = trpc.pressRun.finish.useMutation()

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load sync queue
  const loadSyncQueue = useCallback(() => {
    const queue = offlineStorage.getSyncQueue()
    setSyncQueue(queue)
  }, [])

  useEffect(() => {
    loadSyncQueue()
  }, [loadSyncQueue])

  // Sync a single draft to server
  const syncDraft = useCallback(async (draft: PressRunDraft): Promise<{ success: boolean; error?: string }> => {
    if (!isOnline) {
      return { success: false, error: 'Offline - will sync when connection restored' }
    }

    setSyncing(true)
    setLastSyncAttempt(new Date())

    try {
      // Update draft status to syncing
      offlineStorage.saveDraft({ ...draft, status: 'syncing' })

      // 1. Create the press run
      const pressRunResult = await createPressRun.mutateAsync({
        startTime: new Date(draft.startTime),
        notes: draft.notes,
      })

      if (!pressRunResult.success) {
        throw new Error('Failed to create press run on server')
      }

      const serverPressRunId = pressRunResult.pressRun.id

      // 2. Add all loads
      for (const load of draft.loads) {
        await addLoadMutation.mutateAsync({
          pressRunId: serverPressRunId,
          vendorId: '', // Will be derived from purchase line
          purchaseItemId: load.purchaseLineId,
          appleVarietyId: load.appleVarietyId,
          appleWeightKg: load.weightKg,
          originalWeight: load.originalWeight,
          originalWeightUnit: load.originalWeightUnit,
          brixMeasured: load.brixMeasured,
          phMeasured: load.phMeasured,
          appleCondition: load.appleCondition,
          defectPercentage: load.defectPercentage,
          notes: load.notes,
        })
      }

      // Update draft status to synced
      offlineStorage.saveDraft({
        ...draft,
        status: 'synced',
        syncAttempts: draft.syncAttempts + 1,
      })

      return { success: true }

    } catch (error) {
      console.error('Failed to sync draft:', error)

      // Update draft with error status and increment sync attempts
      offlineStorage.saveDraft({
        ...draft,
        status: 'error',
        syncAttempts: draft.syncAttempts + 1,
      })

      return { success: false, error: error instanceof Error ? error.message : 'Sync failed' }
    } finally {
      setSyncing(false)
    }
  }, [isOnline, createPressRun, addLoadMutation])

  // Sync all pending drafts
  const syncAllDrafts = useCallback(async (): Promise<{ synced: number; failed: number; errors: string[] }> => {
    if (!isOnline) {
      return { synced: 0, failed: 0, errors: ['Offline - cannot sync'] }
    }

    const drafts = offlineStorage.getAllDrafts()
    const pendingDrafts = drafts.filter(d => d.status === 'draft' || d.status === 'error')

    let synced = 0
    let failed = 0
    const errors: string[] = []

    for (const draft of pendingDrafts) {
      const result = await syncDraft(draft)
      if (result.success) {
        synced++
      } else {
        failed++
        if (result.error) errors.push(`Draft ${draft.id}: ${result.error}`)
      }
    }

    loadSyncQueue() // Refresh queue

    return { synced, failed, errors }
  }, [isOnline, syncDraft, loadSyncQueue])

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && !syncing) {
      // Delay sync to allow network to stabilize
      const timer = setTimeout(() => {
        syncAllDrafts()
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isOnline, syncing, syncAllDrafts])

  return {
    syncing,
    syncQueue,
    lastSyncAttempt,
    isOnline,
    syncDraft,
    syncAllDrafts,
    loadSyncQueue,
  }
}

export function useOfflineCapability() {
  const [storageQuota, setStorageQuota] = useState({ isNearLimit: false, percentUsed: 0, estimatedMB: 0 })

  // Check storage quota
  const checkQuota = useCallback(() => {
    const quota = offlineStorage.checkStorageQuota()
    setStorageQuota(quota)
    return quota
  }, [])

  useEffect(() => {
    checkQuota()

    // Check quota periodically
    const interval = setInterval(checkQuota, 60000) // Every minute

    return () => clearInterval(interval)
  }, [checkQuota])

  // Clear all offline data
  const clearAllData = useCallback(() => {
    try {
      offlineStorage.clearAllData()
      checkQuota() // Update quota after clearing
      return { success: true }
    } catch (error) {
      console.error('Failed to clear offline data:', error)
      return { success: false, error: 'Failed to clear offline data' }
    }
  }, [checkQuota])

  return {
    storageQuota,
    checkQuota,
    clearAllData,
  }
}