/**
 * Conflict Resolution System for Offline Synchronization
 * Handles conflicts when local and server data diverge during sync
 */

import { z } from 'zod'
import { PressRunDraft, PressRunLoadDraft } from './offline-storage'

// Conflict types and resolution strategies
export type ConflictType = 'data_modified' | 'data_deleted' | 'validation_failed' | 'inventory_conflict'

export type ResolutionStrategy = 'local_wins' | 'server_wins' | 'merge' | 'manual_review'

export interface ConflictItem {
  id: string
  type: ConflictType
  entity: 'press_run' | 'press_load'
  entityId: string
  localData: any
  serverData: any
  conflictFields: string[]
  timestamp: string
  resolved: boolean
  resolutionStrategy?: ResolutionStrategy
  resolvedData?: any
  resolvedBy?: string
  resolvedAt?: string
  notes?: string
}

export interface ConflictResolutionResult {
  success: boolean
  resolvedData?: any
  requiresManualReview: boolean
  error?: string
  conflicts?: ConflictItem[]
}

class ConflictResolutionManager {
  private static instance: ConflictResolutionManager

  public static getInstance(): ConflictResolutionManager {
    if (!ConflictResolutionManager.instance) {
      ConflictResolutionManager.instance = new ConflictResolutionManager()
    }
    return ConflictResolutionManager.instance
  }

  private constructor() {}

  // Main conflict detection and resolution function
  async resolveConflicts(
    localData: PressRunDraft,
    serverData: any,
    strategy: ResolutionStrategy = 'merge'
  ): Promise<ConflictResolutionResult> {
    try {
      // Detect conflicts
      const conflicts = this.detectConflicts(localData, serverData)

      if (conflicts.length === 0) {
        return {
          success: true,
          resolvedData: localData,
          requiresManualReview: false,
        }
      }

      // Apply resolution strategy
      const resolutionResult = await this.applyResolutionStrategy(
        conflicts,
        localData,
        serverData,
        strategy
      )

      return resolutionResult

    } catch (error) {
      console.error('[Conflict Resolution] Error resolving conflicts:', error)
      return {
        success: false,
        requiresManualReview: true,
        error: error instanceof Error ? error.message : 'Resolution failed',
        conflicts: [],
      }
    }
  }

  // Detect conflicts between local and server data
  private detectConflicts(localData: PressRunDraft, serverData: any): ConflictItem[] {
    const conflicts: ConflictItem[] = []

    // Check if server data exists (data deleted on server)
    if (!serverData) {
      conflicts.push({
        id: this.generateConflictId(),
        type: 'data_deleted',
        entity: 'press_run',
        entityId: localData.id,
        localData,
        serverData: null,
        conflictFields: ['*'],
        timestamp: new Date().toISOString(),
        resolved: false,
      })
      return conflicts
    }

    // Compare press run metadata
    const pressRunConflicts = this.comparePressRunData(localData, serverData)
    conflicts.push(...pressRunConflicts)

    // Compare loads
    const loadConflicts = this.compareLoadData(localData.loads, serverData.loads || [])
    conflicts.push(...loadConflicts)

    return conflicts
  }

  private comparePressRunData(localData: PressRunDraft, serverData: any): ConflictItem[] {
    const conflicts: ConflictItem[] = []
    const conflictFields: string[] = []

    // Check timestamps to determine if data was modified after local version
    const localModified = new Date(localData.lastModified)
    const serverModified = new Date(serverData.updatedAt || serverData.lastModified)

    if (serverModified > localModified) {
      // Server data is newer - check specific fields
      const fieldsToCheck = ['vendorId', 'notes', 'status', 'totalAppleWeightKg']

      fieldsToCheck.forEach(field => {
        const localValue = (localData as any)[field]
        const serverValue = serverData[field]

        if (localValue !== serverValue) {
          conflictFields.push(field)
        }
      })

      if (conflictFields.length > 0) {
        conflicts.push({
          id: this.generateConflictId(),
          type: 'data_modified',
          entity: 'press_run',
          entityId: localData.id,
          localData,
          serverData,
          conflictFields,
          timestamp: new Date().toISOString(),
          resolved: false,
        })
      }
    }

    return conflicts
  }

  private compareLoadData(localLoads: PressRunLoadDraft[], serverLoads: any[]): ConflictItem[] {
    const conflicts: ConflictItem[] = []

    // Create maps for easier comparison
    const localLoadMap = new Map(localLoads.map(load => [load.id, load]))
    const serverLoadMap = new Map(serverLoads.map(load => [load.id, load]))

    // Check for loads that exist locally but not on server (deleted on server)
    localLoads.forEach(localLoad => {
      if (!serverLoadMap.has(localLoad.id)) {
        conflicts.push({
          id: this.generateConflictId(),
          type: 'data_deleted',
          entity: 'press_load',
          entityId: localLoad.id,
          localData: localLoad,
          serverData: null,
          conflictFields: ['*'],
          timestamp: new Date().toISOString(),
          resolved: false,
        })
      }
    })

    // Check for loads that exist on both but have conflicts
    serverLoads.forEach(serverLoad => {
      const localLoad = localLoadMap.get(serverLoad.id)
      if (localLoad) {
        const loadConflicts = this.compareLoadFields(localLoad, serverLoad)
        conflicts.push(...loadConflicts)
      }
    })

    return conflicts
  }

  private compareLoadFields(localLoad: PressRunLoadDraft, serverLoad: any): ConflictItem[] {
    const conflicts: ConflictItem[] = []
    const conflictFields: string[] = []

    // Fields to check for conflicts
    const fieldsToCheck = [
      'appleVarietyId',
      'weightKg',
      'brixMeasured',
      'phMeasured',
      'appleCondition',
      'defectPercentage',
      'notes'
    ]

    fieldsToCheck.forEach(field => {
      const localValue = (localLoad as any)[field]
      const serverValue = serverLoad[field]

      // Handle numeric comparisons with tolerance
      if (field === 'weightKg' || field === 'brixMeasured' || field === 'phMeasured' || field === 'defectPercentage') {
        const localNum = parseFloat(localValue?.toString() || '0')
        const serverNum = parseFloat(serverValue?.toString() || '0')

        if (Math.abs(localNum - serverNum) > 0.01) { // 0.01 tolerance
          conflictFields.push(field)
        }
      } else if (localValue !== serverValue) {
        conflictFields.push(field)
      }
    })

    if (conflictFields.length > 0) {
      conflicts.push({
        id: this.generateConflictId(),
        type: 'data_modified',
        entity: 'press_load',
        entityId: localLoad.id,
        localData: localLoad,
        serverData: serverLoad,
        conflictFields,
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    return conflicts
  }

  // Apply resolution strategy to conflicts
  private async applyResolutionStrategy(
    conflicts: ConflictItem[],
    localData: PressRunDraft,
    serverData: any,
    strategy: ResolutionStrategy
  ): Promise<ConflictResolutionResult> {

    switch (strategy) {
      case 'local_wins':
        return this.resolveWithLocalData(conflicts, localData, serverData)

      case 'server_wins':
        return this.resolveWithServerData(conflicts, localData, serverData)

      case 'merge':
        return this.resolveWithMerge(conflicts, localData, serverData)

      case 'manual_review':
        return {
          success: false,
          requiresManualReview: true,
          conflicts,
        }

      default:
        return {
          success: false,
          requiresManualReview: true,
          error: 'Unknown resolution strategy',
          conflicts,
        }
    }
  }

  private resolveWithLocalData(
    conflicts: ConflictItem[],
    localData: PressRunDraft,
    serverData: any
  ): ConflictResolutionResult {
    // Local data wins - use local data as resolved data
    return {
      success: true,
      resolvedData: localData,
      requiresManualReview: false,
      conflicts: conflicts.map(conflict => ({
        ...conflict,
        resolved: true,
        resolutionStrategy: 'local_wins' as ResolutionStrategy,
        resolvedData: conflict.localData,
        resolvedAt: new Date().toISOString(),
      })),
    }
  }

  private resolveWithServerData(
    conflicts: ConflictItem[],
    localData: PressRunDraft,
    serverData: any
  ): ConflictResolutionResult {
    // Server data wins - use server data as resolved data
    const resolvedData = this.convertServerDataToLocalFormat(serverData)

    return {
      success: true,
      resolvedData,
      requiresManualReview: false,
      conflicts: conflicts.map(conflict => ({
        ...conflict,
        resolved: true,
        resolutionStrategy: 'server_wins' as ResolutionStrategy,
        resolvedData: conflict.serverData,
        resolvedAt: new Date().toISOString(),
      })),
    }
  }

  private resolveWithMerge(
    conflicts: ConflictItem[],
    localData: PressRunDraft,
    serverData: any
  ): ConflictResolutionResult {
    try {
      const resolvedData = { ...localData }

      // Apply merge strategy for each conflict
      for (const conflict of conflicts) {
        switch (conflict.type) {
          case 'data_deleted':
            // If data was deleted on server, require manual review
            return {
              success: false,
              requiresManualReview: true,
              conflicts: [conflict],
            }

          case 'data_modified':
            const mergeResult = this.mergeConflictFields(conflict, resolvedData)
            if (!mergeResult.success) {
              return {
                success: false,
                requiresManualReview: true,
                conflicts: [conflict],
              }
            }
            break

          case 'validation_failed':
          case 'inventory_conflict':
            // These require manual review
            return {
              success: false,
              requiresManualReview: true,
              conflicts: [conflict],
            }
        }
      }

      return {
        success: true,
        resolvedData,
        requiresManualReview: false,
        conflicts: conflicts.map(conflict => ({
          ...conflict,
          resolved: true,
          resolutionStrategy: 'merge' as ResolutionStrategy,
          resolvedAt: new Date().toISOString(),
        })),
      }

    } catch (error) {
      return {
        success: false,
        requiresManualReview: true,
        error: 'Merge failed',
        conflicts,
      }
    }
  }

  private mergeConflictFields(
    conflict: ConflictItem,
    resolvedData: PressRunDraft
  ): { success: boolean; error?: string } {
    try {
      // Merge strategy rules:
      // 1. Numeric fields: use the larger value (assume more complete data)
      // 2. String fields: prefer non-empty values
      // 3. Enum fields: use local if valid, otherwise server
      // 4. Timestamp fields: use the more recent one

      const { conflictFields, localData, serverData } = conflict

      conflictFields.forEach(field => {
        const localValue = localData[field]
        const serverValue = serverData[field]

        switch (field) {
          case 'weightKg':
          case 'totalAppleWeightKg':
          case 'brixMeasured':
          case 'phMeasured':
          case 'defectPercentage':
            // Use the larger numeric value
            const localNum = parseFloat(localValue?.toString() || '0')
            const serverNum = parseFloat(serverValue?.toString() || '0')
            resolvedData[field as keyof PressRunDraft] = Math.max(localNum, serverNum) as any
            break

          case 'notes':
            // Merge notes by combining them
            const localNotes = localValue?.trim() || ''
            const serverNotes = serverValue?.trim() || ''
            if (localNotes && serverNotes && localNotes !== serverNotes) {
              resolvedData.notes = `${localNotes}\n\n[Server]: ${serverNotes}`
            } else {
              resolvedData.notes = localNotes || serverNotes
            }
            break

          case 'appleCondition':
            // Use local condition if valid, otherwise server
            const validConditions = ['excellent', 'good', 'fair', 'poor']
            if (validConditions.includes(localValue)) {
              // Keep local value
            } else if (validConditions.includes(serverValue)) {
              (resolvedData as any)[field] = serverValue
            }
            break

          case 'status':
            // Status conflicts require manual review
            return { success: false, error: 'Status conflicts require manual review' }

          default:
            // For other fields, prefer non-null local values
            if (localValue != null && localValue !== '') {
              // Keep local value
            } else {
              (resolvedData as any)[field] = serverValue
            }
        }
      })

      return { success: true }

    } catch (error) {
      return { success: false, error: 'Failed to merge fields' }
    }
  }

  private convertServerDataToLocalFormat(serverData: any): PressRunDraft {
    // Convert server format to local draft format
    return {
      id: serverData.id,
      vendorId: serverData.vendorId,
      vendorName: serverData.vendorName,
      status: 'synced' as const,
      startTime: serverData.startTime || new Date().toISOString(),
      loads: (serverData.loads || []).map((load: any, index: number) => ({
        id: load.id,
        purchaseLineId: load.purchaseItemId,
        appleVarietyId: load.appleVarietyId,
        appleVarietyName: load.appleVarietyName || 'Unknown',
        weightKg: parseFloat(load.appleWeightKg || '0'),
        weightUnitEntered: 'kg' as const,
        originalWeight: parseFloat(load.originalWeight || '0'),
        originalWeightUnit: load.originalWeightUnit || 'kg' as const,
        brixMeasured: load.brixMeasured ? parseFloat(load.brixMeasured) : undefined,
        phMeasured: load.phMeasured ? parseFloat(load.phMeasured) : undefined,
        appleCondition: load.appleCondition,
        defectPercentage: load.defectPercentage ? parseFloat(load.defectPercentage) : undefined,
        notes: load.notes,
        status: 'confirmed' as const,
        loadSequence: index + 1,
      })),
      lastModified: serverData.updatedAt || new Date().toISOString(),
      syncAttempts: 0,
      notes: serverData.notes,
      totalAppleWeightKg: parseFloat(serverData.totalAppleWeightKg || '0'),
    }
  }

  // Manual conflict resolution
  async resolveConflictManually(
    conflictId: string,
    resolution: 'local' | 'server' | 'custom',
    customData?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // In a real implementation, this would update the conflict in storage
      console.log(`[Conflict Resolution] Manual resolution for ${conflictId}: ${resolution}`)

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to apply manual resolution' }
    }
  }

  // Get pending conflicts
  getPendingConflicts(): ConflictItem[] {
    // In a real implementation, this would retrieve from local storage
    // For now, return empty array
    return []
  }

  // Clear resolved conflicts
  clearResolvedConflicts(): void {
    // In a real implementation, this would clean up resolved conflicts from storage
    console.log('[Conflict Resolution] Cleared resolved conflicts')
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const conflictResolver = ConflictResolutionManager.getInstance()

// React component for manual conflict resolution
export interface ConflictResolutionUIProps {
  conflicts: ConflictItem[]
  onResolve: (conflictId: string, resolution: 'local' | 'server' | 'custom', customData?: any) => void
  onCancel: () => void
}

// Utility functions for conflict analysis
export function getConflictSeverity(conflict: ConflictItem): 'low' | 'medium' | 'high' {
  switch (conflict.type) {
    case 'data_deleted':
      return 'high'
    case 'validation_failed':
    case 'inventory_conflict':
      return 'high'
    case 'data_modified':
      // Check field importance
      const criticalFields = ['status', 'vendorId', 'weightKg']
      const hasCriticalConflict = conflict.conflictFields.some(field => criticalFields.includes(field))
      return hasCriticalConflict ? 'medium' : 'low'
    default:
      return 'medium'
  }
}

export function getConflictDescription(conflict: ConflictItem): string {
  switch (conflict.type) {
    case 'data_deleted':
      return `${conflict.entity} was deleted on the server but modified locally`
    case 'data_modified':
      return `${conflict.entity} was modified on both server and locally. Fields: ${conflict.conflictFields.join(', ')}`
    case 'validation_failed':
      return `${conflict.entity} failed server validation`
    case 'inventory_conflict':
      return `${conflict.entity} has inventory conflicts`
    default:
      return 'Unknown conflict type'
  }
}