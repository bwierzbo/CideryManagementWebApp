import { TRPCError, type MiddlewareFunction } from '@trpc/server'
import { getIronSession } from 'iron-session'
import { AuditDatabase, type AuditSnapshot } from 'lib/src/audit/database'
import { auditEventBus, createDatabaseAuditSubscriber } from 'lib/src/audit/eventBus'
import type { Context } from '../trpc'

/**
 * Configuration for audit middleware
 */
export interface AuditConfig {
  enabled: boolean
  excludedTables?: string[]
  excludedOperations?: string[]
  includeRequestInfo?: boolean
  auditDatabase?: AuditDatabase
}

/**
 * Default audit configuration
 */
const defaultAuditConfig: AuditConfig = {
  enabled: true,
  excludedTables: ['audit_logs', 'audit_metadata', 'sessions'],
  excludedOperations: [],
  includeRequestInfo: true
}

/**
 * Global audit configuration
 */
let auditConfig: AuditConfig = defaultAuditConfig

/**
 * Global audit database instance
 */
let auditDatabaseInstance: AuditDatabase | null = null

/**
 * Initialize audit system
 */
export function initializeAuditSystem(database: any, config?: Partial<AuditConfig>): void {
  auditConfig = { ...defaultAuditConfig, ...config }

  if (auditConfig.enabled) {
    auditDatabaseInstance = new AuditDatabase(database)

    // Subscribe to audit events and write to database
    createDatabaseAuditSubscriber(async (auditLogEntry) => {
      if (auditDatabaseInstance) {
        const snapshot: AuditSnapshot = {
          operation: auditLogEntry.operation as any,
          tableName: auditLogEntry.tableName,
          recordId: auditLogEntry.recordId,
          oldData: auditLogEntry.oldData,
          newData: auditLogEntry.newData,
          context: {
            userId: auditLogEntry.changedBy,
            userEmail: auditLogEntry.changedByEmail,
            reason: auditLogEntry.reason
          },
          timestamp: auditLogEntry.changedAt
        }

        await auditDatabaseInstance.writeAuditLog(snapshot)
      }
    })
  }
}

/**
 * Extract request information from tRPC context
 */
function extractRequestInfo(ctx: Context): {
  ipAddress?: string
  userAgent?: string
  sessionId?: string
} {
  // This would need to be implemented based on your actual context structure
  // For now, returning empty object as placeholder
  return {}
}

/**
 * Extracts table name and record ID from tRPC operation
 */
function extractOperationInfo(
  procedurePath: string,
  input: any,
  result: any
): { tableName?: string; recordId?: string } {
  // Try to extract table name from procedure path
  // e.g., "vendors.create" -> "vendors"
  const pathParts = procedurePath.split('.')
  const possibleTableName = pathParts[0]

  // Try to extract record ID from input or result
  let recordId: string | undefined

  if (result?.id) {
    recordId = result.id
  } else if (input?.id) {
    recordId = input.id
  }

  return {
    tableName: possibleTableName,
    recordId
  }
}

/**
 * Middleware function that automatically logs audit events for mutations
 */
export const auditMiddleware: MiddlewareFunction<Context, Context, any> = async ({
  ctx,
  next,
  path,
  type,
  input
}) => {
  // Skip if audit is disabled
  if (!auditConfig.enabled || !auditDatabaseInstance) {
    return next({ ctx })
  }

  // Only audit mutations
  if (type !== 'mutation') {
    return next({ ctx })
  }

  // Extract operation info
  const { tableName, recordId } = extractOperationInfo(path, input, undefined)

  // Skip if table is excluded
  if (tableName && auditConfig.excludedTables?.includes(tableName)) {
    return next({ ctx })
  }

  // Determine operation type based on procedure name
  let operation: 'create' | 'update' | 'delete' | 'soft_delete' | 'restore' | undefined

  const procedureName = path.split('.').pop()?.toLowerCase()

  if (procedureName?.includes('create') || procedureName?.includes('add')) {
    operation = 'create'
  } else if (procedureName?.includes('update') || procedureName?.includes('edit')) {
    operation = 'update'
  } else if (procedureName?.includes('delete') || procedureName?.includes('remove')) {
    operation = 'delete'
  } else if (procedureName?.includes('restore')) {
    operation = 'restore'
  }

  // Skip if operation is excluded or couldn't be determined
  if (!operation || auditConfig.excludedOperations?.includes(operation)) {
    return next({ ctx })
  }

  let oldData: any = undefined

  // For update/delete operations, try to fetch current data before making changes
  if ((operation === 'update' || operation === 'delete') && tableName && recordId) {
    try {
      // This would need to be implemented based on your data access patterns
      // For now, we'll skip fetching old data
      // oldData = await fetchCurrentRecord(tableName, recordId)
    } catch (error) {
      console.warn(`Failed to fetch old data for audit: ${error}`)
    }
  }

  // Execute the actual procedure
  const result = await next({ ctx })

  // Extract record ID from result if not available from input
  const finalRecordId = recordId || result?.id

  if (!finalRecordId) {
    // Can't audit without record ID
    return result
  }

  // Prepare audit context
  const requestInfo = auditConfig.includeRequestInfo ? extractRequestInfo(ctx) : {}

  const auditContext = {
    userId: ctx.session?.user?.id,
    userEmail: ctx.session?.user?.email,
    ...requestInfo
  }

  // Prepare audit snapshot
  const auditSnapshot: AuditSnapshot = {
    operation,
    tableName: tableName!,
    recordId: finalRecordId,
    oldData: operation === 'create' ? undefined : oldData,
    newData: operation === 'delete' ? undefined : result,
    context: auditContext,
    timestamp: new Date()
  }

  // Publish audit event (asynchronous)
  auditEventBus.publish({
    tableName: auditSnapshot.tableName,
    recordId: auditSnapshot.recordId,
    operation: auditSnapshot.operation,
    oldData: auditSnapshot.oldData,
    newData: auditSnapshot.newData,
    changedBy: auditContext.userId,
    reason: auditContext.reason,
    timestamp: auditSnapshot.timestamp || new Date()
  }).catch(error => {
    console.error('Failed to publish audit event:', error)
  })

  return result
}

/**
 * Enhanced audit middleware that includes before/after data capture
 */
export const enhancedAuditMiddleware = (
  dataFetcher?: (tableName: string, recordId: string) => Promise<any>
): MiddlewareFunction<Context, Context, any> => {
  return async ({ ctx, next, path, type, input }) => {
    // Skip if audit is disabled
    if (!auditConfig.enabled || !auditDatabaseInstance) {
      return next({ ctx })
    }

    // Only audit mutations
    if (type !== 'mutation') {
      return next({ ctx })
    }

    // Extract operation info
    const { tableName, recordId: inputRecordId } = extractOperationInfo(path, input, undefined)

    // Skip if table is excluded
    if (tableName && auditConfig.excludedTables?.includes(tableName)) {
      return next({ ctx })
    }

    // Determine operation type
    let operation: 'create' | 'update' | 'delete' | 'soft_delete' | 'restore' | undefined

    const procedureName = path.split('.').pop()?.toLowerCase()

    if (procedureName?.includes('create') || procedureName?.includes('add')) {
      operation = 'create'
    } else if (procedureName?.includes('update') || procedureName?.includes('edit')) {
      operation = 'update'
    } else if (procedureName?.includes('delete') || procedureName?.includes('remove')) {
      operation = 'delete'
    } else if (procedureName?.includes('restore')) {
      operation = 'restore'
    }

    // Skip if operation is excluded or couldn't be determined
    if (!operation || auditConfig.excludedOperations?.includes(operation)) {
      return next({ ctx })
    }

    let oldData: any = undefined

    // Fetch old data for update/delete operations
    if ((operation === 'update' || operation === 'delete') && tableName && inputRecordId && dataFetcher) {
      try {
        oldData = await dataFetcher(tableName, inputRecordId)
      } catch (error) {
        console.warn(`Failed to fetch old data for audit: ${error}`)
      }
    }

    // Execute the actual procedure
    const result = await next({ ctx })

    // Extract final record ID
    const finalRecordId = inputRecordId || result?.id

    if (!finalRecordId || !tableName) {
      return result
    }

    // Prepare audit context
    const requestInfo = auditConfig.includeRequestInfo ? extractRequestInfo(ctx) : {}

    const auditContext = {
      userId: ctx.session?.user?.id,
      userEmail: ctx.session?.user?.email,
      ...requestInfo
    }

    // Write audit log directly to database
    try {
      const auditSnapshot: AuditSnapshot = {
        operation,
        tableName,
        recordId: finalRecordId,
        oldData: operation === 'create' ? undefined : oldData,
        newData: operation === 'delete' ? undefined : result,
        context: auditContext,
        timestamp: new Date()
      }

      await auditDatabaseInstance.writeAuditLog(auditSnapshot)
    } catch (error) {
      console.error('Failed to write audit log:', error)
      // Don't fail the original operation due to audit logging failure
    }

    return result
  }
}

/**
 * Create a procedure-specific audit middleware
 */
export function createAuditMiddleware(
  tableName: string,
  operation: 'create' | 'update' | 'delete' | 'soft_delete' | 'restore',
  dataFetcher?: (recordId: string) => Promise<any>
): MiddlewareFunction<Context, Context, any> {
  return async ({ ctx, next, input }) => {
    // Skip if audit is disabled
    if (!auditConfig.enabled || !auditDatabaseInstance) {
      return next({ ctx })
    }

    // Skip if table or operation is excluded
    if (auditConfig.excludedTables?.includes(tableName) ||
        auditConfig.excludedOperations?.includes(operation)) {
      return next({ ctx })
    }

    let oldData: any = undefined
    const recordId = input?.id

    // Fetch old data for update/delete operations
    if ((operation === 'update' || operation === 'delete') && recordId && dataFetcher) {
      try {
        oldData = await dataFetcher(recordId)
      } catch (error) {
        console.warn(`Failed to fetch old data for audit: ${error}`)
      }
    }

    // Execute the actual procedure
    const result = await next({ ctx })

    // Get final record ID
    const finalRecordId = recordId || result?.id

    if (!finalRecordId) {
      return result
    }

    // Prepare audit context
    const requestInfo = auditConfig.includeRequestInfo ? extractRequestInfo(ctx) : {}

    const auditContext = {
      userId: ctx.session?.user?.id,
      userEmail: ctx.session?.user?.email,
      ...requestInfo
    }

    // Write audit log
    try {
      const auditSnapshot: AuditSnapshot = {
        operation,
        tableName,
        recordId: finalRecordId,
        oldData: operation === 'create' ? undefined : oldData,
        newData: operation === 'delete' ? undefined : result,
        context: auditContext,
        timestamp: new Date()
      }

      await auditDatabaseInstance.writeAuditLog(auditSnapshot)
    } catch (error) {
      console.error('Failed to write audit log:', error)
    }

    return result
  }
}