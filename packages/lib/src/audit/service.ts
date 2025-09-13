import { createHash } from 'crypto'
import * as diff from 'json-diff'
import type { AuditOperation } from 'db/src/schema/audit'

/**
 * Service for handling audit log operations including diff generation,
 * data validation, and integrity checking
 */

export interface AuditContext {
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  reason?: string
}

export interface AuditSnapshot {
  operation: AuditOperation
  tableName: string
  recordId: string
  oldData?: Record<string, any>
  newData?: Record<string, any>
  context?: AuditContext
  timestamp?: Date
}

export interface AuditLogEntry {
  id?: string
  tableName: string
  recordId: string
  operation: AuditOperation
  oldData?: Record<string, any>
  newData?: Record<string, any>
  diffData?: any
  changedBy?: string
  changedByEmail?: string
  changedAt: Date
  reason?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  auditVersion: string
  checksum?: string
}

/**
 * Generates a cryptographic checksum for audit data integrity
 */
export function generateAuditChecksum(auditEntry: Omit<AuditLogEntry, 'checksum'>): string {
  // Create a deterministic string representation of the audit entry
  const dataToHash = JSON.stringify({
    tableName: auditEntry.tableName,
    recordId: auditEntry.recordId,
    operation: auditEntry.operation,
    oldData: auditEntry.oldData,
    newData: auditEntry.newData,
    diffData: auditEntry.diffData,
    changedBy: auditEntry.changedBy,
    changedAt: auditEntry.changedAt.toISOString(),
    auditVersion: auditEntry.auditVersion
  }, Object.keys(auditEntry).sort()) // Sort keys for consistency

  return createHash('sha256').update(dataToHash).digest('hex')
}

/**
 * Validates the integrity of an audit log entry by verifying its checksum
 */
export function validateAuditIntegrity(auditEntry: AuditLogEntry): boolean {
  if (!auditEntry.checksum) {
    return false
  }

  const entryWithoutChecksum = { ...auditEntry }
  delete entryWithoutChecksum.checksum

  const expectedChecksum = generateAuditChecksum(entryWithoutChecksum)
  return expectedChecksum === auditEntry.checksum
}

/**
 * Generates a diff between old and new data for audit logging
 */
export function generateDataDiff(oldData?: Record<string, any>, newData?: Record<string, any>): any {
  if (!oldData && !newData) {
    return null
  }

  if (!oldData) {
    // Create operation - all fields are new
    return { __type: 'create', added: newData }
  }

  if (!newData) {
    // Delete operation - all fields are removed
    return { __type: 'delete', removed: oldData }
  }

  // Update operation - calculate diff
  const diffResult = diff.diff(oldData, newData)
  return diffResult || null
}

/**
 * Sanitizes sensitive data from audit snapshots
 */
export function sanitizeAuditData(data: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'privateKey',
    'private_key'
  ]

  const sanitized = { ...data }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Creates a complete audit log entry from a snapshot
 */
export function createAuditLogEntry(snapshot: AuditSnapshot): AuditLogEntry {
  const timestamp = snapshot.timestamp || new Date()

  // Sanitize sensitive data
  const sanitizedOldData = snapshot.oldData ? sanitizeAuditData(snapshot.oldData) : undefined
  const sanitizedNewData = snapshot.newData ? sanitizeAuditData(snapshot.newData) : undefined

  // Generate diff
  const diffData = generateDataDiff(sanitizedOldData, sanitizedNewData)

  const auditEntry: Omit<AuditLogEntry, 'checksum'> = {
    tableName: snapshot.tableName,
    recordId: snapshot.recordId,
    operation: snapshot.operation,
    oldData: sanitizedOldData,
    newData: sanitizedNewData,
    diffData,
    changedBy: snapshot.context?.userId,
    changedByEmail: snapshot.context?.userEmail,
    changedAt: timestamp,
    reason: snapshot.context?.reason,
    ipAddress: snapshot.context?.ipAddress,
    userAgent: snapshot.context?.userAgent,
    sessionId: snapshot.context?.sessionId,
    auditVersion: '1.0'
  }

  // Generate checksum for integrity
  const checksum = generateAuditChecksum(auditEntry)

  return {
    ...auditEntry,
    checksum
  }
}

/**
 * Filters audit data for queries with privacy considerations
 */
export function filterAuditDataForQuery(
  auditEntry: AuditLogEntry,
  includeData: boolean = true,
  includeDiff: boolean = true
): Partial<AuditLogEntry> {
  const filtered: Partial<AuditLogEntry> = {
    id: auditEntry.id,
    tableName: auditEntry.tableName,
    recordId: auditEntry.recordId,
    operation: auditEntry.operation,
    changedBy: auditEntry.changedBy,
    changedByEmail: auditEntry.changedByEmail,
    changedAt: auditEntry.changedAt,
    reason: auditEntry.reason,
    auditVersion: auditEntry.auditVersion
  }

  if (includeData) {
    filtered.oldData = auditEntry.oldData
    filtered.newData = auditEntry.newData
  }

  if (includeDiff) {
    filtered.diffData = auditEntry.diffData
  }

  return filtered
}

/**
 * Validates that an audit snapshot contains required information
 */
export function validateAuditSnapshot(snapshot: AuditSnapshot): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!snapshot.tableName) {
    errors.push('tableName is required')
  }

  if (!snapshot.recordId) {
    errors.push('recordId is required')
  }

  if (!snapshot.operation) {
    errors.push('operation is required')
  }

  if (!['create', 'update', 'delete', 'soft_delete', 'restore'].includes(snapshot.operation)) {
    errors.push('operation must be one of: create, update, delete, soft_delete, restore')
  }

  // Validate data consistency based on operation
  switch (snapshot.operation) {
    case 'create':
      if (!snapshot.newData) {
        errors.push('newData is required for create operations')
      }
      if (snapshot.oldData) {
        errors.push('oldData should not be present for create operations')
      }
      break

    case 'update':
      if (!snapshot.oldData) {
        errors.push('oldData is required for update operations')
      }
      if (!snapshot.newData) {
        errors.push('newData is required for update operations')
      }
      break

    case 'delete':
    case 'soft_delete':
      if (!snapshot.oldData) {
        errors.push('oldData is required for delete operations')
      }
      if (snapshot.newData) {
        errors.push('newData should not be present for delete operations')
      }
      break

    case 'restore':
      if (!snapshot.newData) {
        errors.push('newData is required for restore operations')
      }
      break
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Extracts changed fields from a diff for summary purposes
 */
export function extractChangedFields(diffData: any): string[] {
  if (!diffData || typeof diffData !== 'object') {
    return []
  }

  const changedFields: Set<string> = new Set()

  // Handle different diff formats
  if (diffData.__type === 'create' && diffData.added) {
    Object.keys(diffData.added).forEach(key => changedFields.add(key))
  } else if (diffData.__type === 'delete' && diffData.removed) {
    Object.keys(diffData.removed).forEach(key => changedFields.add(key))
  } else {
    // Standard json-diff format
    Object.keys(diffData).forEach(key => {
      if (key !== '__type') {
        changedFields.add(key)
      }
    })
  }

  return Array.from(changedFields).sort()
}

/**
 * Generates a human-readable summary of changes from audit data
 */
export function generateChangeSummary(auditEntry: AuditLogEntry): string {
  const { operation, tableName, diffData } = auditEntry
  const changedFields = extractChangedFields(diffData)

  switch (operation) {
    case 'create':
      return `Created new ${tableName} record`

    case 'delete':
      return `Deleted ${tableName} record`

    case 'soft_delete':
      return `Soft deleted ${tableName} record`

    case 'restore':
      return `Restored ${tableName} record`

    case 'update':
      if (changedFields.length === 0) {
        return `Updated ${tableName} record (no changes detected)`
      } else if (changedFields.length === 1) {
        return `Updated ${tableName} record: ${changedFields[0]}`
      } else if (changedFields.length <= 3) {
        return `Updated ${tableName} record: ${changedFields.join(', ')}`
      } else {
        return `Updated ${tableName} record: ${changedFields.slice(0, 3).join(', ')} and ${changedFields.length - 3} more fields`
      }

    default:
      return `Performed ${operation} on ${tableName} record`
  }
}