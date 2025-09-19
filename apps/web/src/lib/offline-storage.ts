/**
 * Offline Storage Utility for Press Run Drafts
 * Implements local storage persistence for pressing workflow offline capability
 */

import { z } from 'zod'

// Local storage schema matching task requirements
export const pressRunDraftSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendorName: z.string().optional(),
  status: z.enum(['draft', 'syncing', 'synced', 'error']),
  startTime: z.string(), // ISO string
  loads: z.array(z.object({
    id: z.string(),
    purchaseLineId: z.string(),
    fruitVarietyId: z.string(),
    appleVarietyName: z.string(),
    weightKg: z.number(),
    weightUnitEntered: z.enum(['lbs', 'kg']),
    originalWeight: z.number(),
    originalWeightUnit: z.enum(['kg', 'lb', 'bushel']),
    brixMeasured: z.number().optional(),
    phMeasured: z.number().optional(),
    appleCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
    defectPercentage: z.number().optional(),
    notes: z.string().optional(),
    status: z.enum(['pending', 'confirmed', 'error']),
    loadSequence: z.number(),
  })),
  lastModified: z.string(), // ISO string
  syncAttempts: z.number().default(0),
  notes: z.string().optional(),
  totalAppleWeightKg: z.number().default(0),
})

export type PressRunDraft = z.infer<typeof pressRunDraftSchema>
export type PressRunLoadDraft = PressRunDraft['loads'][0]

const STORAGE_KEYS = {
  PRESS_RUN_DRAFTS: 'cidery_press_run_drafts',
  SYNC_QUEUE: 'cidery_sync_queue',
  STORAGE_INFO: 'cidery_storage_info',
} as const

const MAX_STORAGE_SIZE_MB = 50 // 50MB storage limit
const MAX_DRAFTS = 100 // Maximum number of drafts to keep

export interface StorageInfo {
  totalSize: number // in bytes
  draftCount: number
  lastCleanup: string // ISO string
  quotaWarningShown: boolean
}

export interface SyncQueueItem {
  id: string
  type: 'create_press_run' | 'add_load' | 'complete_press_run'
  data: any
  attempts: number
  lastAttempt: string | null
  created: string
}

class OfflineStorageManager {
  private static instance: OfflineStorageManager

  public static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager()
    }
    return OfflineStorageManager.instance
  }

  private constructor() {
    this.initializeStorage()
  }

  private initializeStorage(): void {
    // Initialize storage info if it doesn't exist
    if (!this.getStorageInfo()) {
      this.updateStorageInfo({
        totalSize: 0,
        draftCount: 0,
        lastCleanup: new Date().toISOString(),
        quotaWarningShown: false,
      })
    }
  }

  // Storage Info Management
  getStorageInfo(): StorageInfo | null {
    if (typeof window === 'undefined') return null
    try {
      const info = localStorage.getItem(STORAGE_KEYS.STORAGE_INFO)
      return info ? JSON.parse(info) : null
    } catch (error) {
      console.warn('Failed to get storage info:', error)
      return null
    }
  }

  private updateStorageInfo(updates: Partial<StorageInfo>): void {
    try {
      const current = this.getStorageInfo() || {
        totalSize: 0,
        draftCount: 0,
        lastCleanup: new Date().toISOString(),
        quotaWarningShown: false,
      }

      const updated = { ...current, ...updates }
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.STORAGE_INFO, JSON.stringify(updated))
      }
    } catch (error) {
      console.warn('Failed to update storage info:', error)
    }
  }

  // Press Run Draft Management
  getAllDrafts(): PressRunDraft[] {
    try {
      const drafts = localStorage.getItem(STORAGE_KEYS.PRESS_RUN_DRAFTS)
      if (!drafts) return []

      const parsed = JSON.parse(drafts)
      return Array.isArray(parsed) ? parsed.map(draft => pressRunDraftSchema.parse(draft)) : []
    } catch (error) {
      console.warn('Failed to get drafts:', error)
      return []
    }
  }

  getDraft(id: string): PressRunDraft | null {
    const drafts = this.getAllDrafts()
    return drafts.find(draft => draft.id === id) || null
  }

  saveDraft(draft: PressRunDraft): boolean {
    try {
      // Validate the draft
      const validatedDraft = pressRunDraftSchema.parse({
        ...draft,
        lastModified: new Date().toISOString(),
      })

      const drafts = this.getAllDrafts()
      const existingIndex = drafts.findIndex(d => d.id === draft.id)

      if (existingIndex >= 0) {
        drafts[existingIndex] = validatedDraft
      } else {
        drafts.push(validatedDraft)
      }

      // Check storage quota before saving
      const dataSize = this.calculateDataSize(drafts)
      if (dataSize > MAX_STORAGE_SIZE_MB * 1024 * 1024) {
        this.cleanupOldDrafts(drafts)
      }

      localStorage.setItem(STORAGE_KEYS.PRESS_RUN_DRAFTS, JSON.stringify(drafts))

      this.updateStorageInfo({
        draftCount: drafts.length,
        totalSize: dataSize,
      })

      return true
    } catch (error) {
      console.error('Failed to save draft:', error)
      return false
    }
  }

  deleteDraft(id: string): boolean {
    try {
      const drafts = this.getAllDrafts().filter(draft => draft.id !== id)
      localStorage.setItem(STORAGE_KEYS.PRESS_RUN_DRAFTS, JSON.stringify(drafts))

      this.updateStorageInfo({
        draftCount: drafts.length,
        totalSize: this.calculateDataSize(drafts),
      })

      return true
    } catch (error) {
      console.error('Failed to delete draft:', error)
      return false
    }
  }

  // Auto-save functionality
  createDraft(vendorId: string, vendorName?: string): PressRunDraft {
    const draft: PressRunDraft = {
      id: this.generateId(),
      vendorId,
      vendorName,
      status: 'draft',
      startTime: new Date().toISOString(),
      loads: [],
      lastModified: new Date().toISOString(),
      syncAttempts: 0,
      totalAppleWeightKg: 0,
    }

    this.saveDraft(draft)
    return draft
  }

  addLoadToDraft(draftId: string, load: Omit<PressRunLoadDraft, 'id' | 'loadSequence'>): boolean {
    const draft = this.getDraft(draftId)
    if (!draft) return false

    const newLoad: PressRunLoadDraft = {
      ...load,
      id: this.generateId(),
      loadSequence: draft.loads.length + 1,
      status: 'pending',
    }

    draft.loads.push(newLoad)
    draft.totalAppleWeightKg = draft.loads.reduce((sum, l) => sum + l.weightKg, 0)

    return this.saveDraft(draft)
  }

  updateLoadInDraft(draftId: string, loadId: string, updates: Partial<PressRunLoadDraft>): boolean {
    const draft = this.getDraft(draftId)
    if (!draft) return false

    const loadIndex = draft.loads.findIndex(l => l.id === loadId)
    if (loadIndex === -1) return false

    draft.loads[loadIndex] = { ...draft.loads[loadIndex], ...updates }
    draft.totalAppleWeightKg = draft.loads.reduce((sum, l) => sum + l.weightKg, 0)

    return this.saveDraft(draft)
  }

  removeLoadFromDraft(draftId: string, loadId: string): boolean {
    const draft = this.getDraft(draftId)
    if (!draft) return false

    draft.loads = draft.loads.filter(l => l.id !== loadId)
    // Resequence remaining loads
    draft.loads.forEach((load, index) => {
      load.loadSequence = index + 1
    })
    draft.totalAppleWeightKg = draft.loads.reduce((sum, l) => sum + l.weightKg, 0)

    return this.saveDraft(draft)
  }

  // Sync Queue Management
  getSyncQueue(): SyncQueueItem[] {
    try {
      const queue = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE)
      return queue ? JSON.parse(queue) : []
    } catch (error) {
      console.warn('Failed to get sync queue:', error)
      return []
    }
  }

  addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'created'>): string {
    try {
      const queue = this.getSyncQueue()
      const queueItem: SyncQueueItem = {
        ...item,
        id: this.generateId(),
        created: new Date().toISOString(),
      }

      queue.push(queueItem)
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue))

      return queueItem.id
    } catch (error) {
      console.error('Failed to add to sync queue:', error)
      return ''
    }
  }

  updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): boolean {
    try {
      const queue = this.getSyncQueue()
      const itemIndex = queue.findIndex(item => item.id === id)

      if (itemIndex === -1) return false

      queue[itemIndex] = { ...queue[itemIndex], ...updates }
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue))

      return true
    } catch (error) {
      console.error('Failed to update sync queue item:', error)
      return false
    }
  }

  removeFromSyncQueue(id: string): boolean {
    try {
      const queue = this.getSyncQueue().filter(item => item.id !== id)
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue))
      return true
    } catch (error) {
      console.error('Failed to remove from sync queue:', error)
      return false
    }
  }

  clearSyncQueue(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE)
    } catch (error) {
      console.error('Failed to clear sync queue:', error)
    }
  }

  // Storage Management
  private calculateDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return JSON.stringify(data).length * 2 // Rough estimate
    }
  }

  private cleanupOldDrafts(drafts: PressRunDraft[]): PressRunDraft[] {
    // Remove oldest synced drafts first, keep unsaved drafts
    const sorted = drafts
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())

    // Keep unsaved drafts and most recent MAX_DRAFTS
    const toKeep = []
    let savedCount = 0

    for (const draft of sorted) {
      if (draft.status === 'draft' || draft.status === 'syncing' || draft.status === 'error') {
        toKeep.push(draft) // Always keep unsaved drafts
      } else if (savedCount < MAX_DRAFTS) {
        toKeep.push(draft)
        savedCount++
      }
    }

    return toKeep
  }

  // Storage quota management
  checkStorageQuota(): { isNearLimit: boolean; percentUsed: number; estimatedMB: number } {
    try {
      const info = this.getStorageInfo()
      if (!info) return { isNearLimit: false, percentUsed: 0, estimatedMB: 0 }

      const estimatedMB = info.totalSize / (1024 * 1024)
      const percentUsed = (estimatedMB / MAX_STORAGE_SIZE_MB) * 100

      return {
        isNearLimit: percentUsed > 80,
        percentUsed,
        estimatedMB,
      }
    } catch {
      return { isNearLimit: false, percentUsed: 0, estimatedMB: 0 }
    }
  }

  clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
      this.initializeStorage()
    } catch (error) {
      console.error('Failed to clear all data:', error)
    }
  }

  // Auto-save timer management
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map()

  scheduleAutoSave(draftId: string, callback: () => void, delay: number = 30000): void {
    // Clear existing timer
    const existingTimer = this.autoSaveTimers.get(draftId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Schedule new auto-save
    const timer = setTimeout(() => {
      callback()
      this.autoSaveTimers.delete(draftId)
    }, delay)

    this.autoSaveTimers.set(draftId, timer)
  }

  cancelAutoSave(draftId: string): void {
    const timer = this.autoSaveTimers.get(draftId)
    if (timer) {
      clearTimeout(timer)
      this.autoSaveTimers.delete(draftId)
    }
  }

  private generateId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const offlineStorage = OfflineStorageManager.getInstance()