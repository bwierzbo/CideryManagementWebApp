import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/packages/db/src/connection'
import { auditLogs } from '@/packages/db/src/schema'
import { createTestUser, createTestPurchase, createTestBatch } from '@/tests/test-utils/factories'
import { sql } from 'drizzle-orm'

/**
 * Audit Log Snapshot Testing
 *
 * These tests verify that audit log entries maintain consistent structure
 * and content across all entity operations. Any change to audit log format
 * will cause snapshot mismatches, preventing accidental audit regressions.
 */

describe('Audit Log Snapshots', () => {
  beforeEach(async () => {
    // Clean up any existing audit logs
    await db.delete(auditLogs)
  })

  afterEach(async () => {
    // Clean up test data
    await db.execute(sql`TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE`)
  })

  describe('Entity Creation Audit Snapshots', () => {
    test('User creation audit log snapshot', async () => {
      const user = await createTestUser({
        name: 'Test User',
        email: 'test@example.com',
        role: 'ADMIN'
      })

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      // Normalize timestamps and IDs for consistent snapshots
      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        // Keep the actual data structure but normalize dynamic values
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('user-creation-audit.json')
    })

    test('Purchase creation audit log snapshot', async () => {
      const user = await createTestUser()
      const purchase = await createTestPurchase({
        vendorId: user.id,
        total: 1250.50,
        items: [
          { description: 'Apples - Honeycrisp', quantity: 1000, unitPrice: 0.75 },
          { description: 'Apples - Granny Smith', quantity: 500, unitPrice: 1.00 }
        ]
      })

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('purchase-creation-audit.json')
    })

    test('Batch creation audit log snapshot', async () => {
      const user = await createTestUser()
      const batch = await createTestBatch({
        name: 'Test Batch 001',
        varietyId: user.id, // Using user ID as placeholder
        targetVolume: 500,
        targetAbv: 6.5
      })

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('batch-creation-audit.json')
    })
  })

  describe('Entity Update Audit Snapshots', () => {
    test('User update audit log snapshot', async () => {
      const user = await createTestUser({
        name: 'Original Name',
        email: 'original@example.com',
        role: 'OPERATOR'
      })

      // Clear creation audit logs
      await db.delete(auditLogs)

      // Update the user
      await db.update(users).set({
        name: 'Updated Name',
        email: 'updated@example.com',
        role: 'ADMIN'
      }).where(eq(users.id, user.id))

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('user-update-audit.json')
    })

    test('Batch status change audit log snapshot', async () => {
      const user = await createTestUser()
      const batch = await createTestBatch({
        name: 'Status Change Batch',
        status: 'FERMENTING'
      })

      // Clear creation audit logs
      await db.delete(auditLogs)

      // Change batch status
      await db.update(batches).set({
        status: 'CLARIFYING'
      }).where(eq(batches.id, batch.id))

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('batch-status-change-audit.json')
    })
  })

  describe('Entity Deletion Audit Snapshots', () => {
    test('Soft deletion audit log snapshot', async () => {
      const user = await createTestUser({
        name: 'To Be Deleted',
        email: 'delete@example.com'
      })

      // Clear creation audit logs
      await db.delete(auditLogs)

      // Soft delete the user
      await db.update(users).set({
        deletedAt: new Date()
      }).where(eq(users.id, user.id))

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('soft-deletion-audit.json')
    })
  })

  describe('Complex Operation Audit Snapshots', () => {
    test('Batch transfer operation audit log snapshot', async () => {
      const user = await createTestUser()
      const sourceBatch = await createTestBatch({
        name: 'Source Batch',
        currentVolume: 1000
      })
      const targetBatch = await createTestBatch({
        name: 'Target Batch',
        currentVolume: 500
      })

      // Clear creation audit logs
      await db.delete(auditLogs)

      // Perform complex transfer operation
      const transferVolume = 250

      await db.transaction(async (tx) => {
        // Update source batch
        await tx.update(batches).set({
          currentVolume: 750
        }).where(eq(batches.id, sourceBatch.id))

        // Update target batch
        await tx.update(batches).set({
          currentVolume: 750
        }).where(eq(batches.id, targetBatch.id))

        // Create transfer record (assuming transfers table exists)
        // This would trigger its own audit log
      })

      const auditEntries = await db.select().from(auditLogs).orderBy(auditLogs.timestamp)

      const normalizedEntries = auditEntries.map(entry => ({
        ...entry,
        id: '[ID]',
        timestamp: '[TIMESTAMP]',
        userId: '[USER_ID]',
        entityId: '[ENTITY_ID]',
        oldData: entry.oldData ? normalizeAuditData(entry.oldData) : null,
        newData: entry.newData ? normalizeAuditData(entry.newData) : null
      }))

      expect(normalizedEntries).toMatchSnapshot('batch-transfer-audit.json')
    })
  })

  describe('Audit Log Consistency Validation', () => {
    test('All audit logs maintain required fields', async () => {
      // Create multiple entities to generate various audit logs
      const user = await createTestUser()
      const purchase = await createTestPurchase()
      const batch = await createTestBatch()

      // Update some entities
      await db.update(users).set({ name: 'Updated User' }).where(eq(users.id, user.id))

      const auditEntries = await db.select().from(auditLogs)

      // Verify all audit logs have required structure
      auditEntries.forEach(entry => {
        expect(entry).toHaveProperty('id')
        expect(entry).toHaveProperty('entityType')
        expect(entry).toHaveProperty('entityId')
        expect(entry).toHaveProperty('operation')
        expect(entry).toHaveProperty('userId')
        expect(entry).toHaveProperty('timestamp')
        expect(['CREATE', 'UPDATE', 'DELETE']).toContain(entry.operation)
        expect(typeof entry.entityType).toBe('string')
        expect(entry.entityType.length).toBeGreaterThan(0)
      })

      // Take snapshot of the audit structure validation
      const structureValidation = auditEntries.map(entry => ({
        entityType: entry.entityType,
        operation: entry.operation,
        hasOldData: entry.oldData !== null,
        hasNewData: entry.newData !== null,
        dataKeys: {
          oldData: entry.oldData ? Object.keys(entry.oldData) : null,
          newData: entry.newData ? Object.keys(entry.newData) : null
        }
      }))

      expect(structureValidation).toMatchSnapshot('audit-structure-validation.json')
    })

    test('Audit log data integrity', async () => {
      const user = await createTestUser({
        name: 'Integrity Test',
        email: 'integrity@test.com',
        role: 'VIEWER'
      })

      // Clear creation logs
      await db.delete(auditLogs)

      // Update with various data types
      await db.update(users).set({
        name: 'Updated Name',
        role: 'ADMIN',
        settings: { theme: 'dark', notifications: true }, // JSON field
        lastLoginAt: new Date()
      }).where(eq(users.id, user.id))

      const auditEntries = await db.select().from(auditLogs)

      // Validate data integrity in audit logs
      const integrityCheck = auditEntries.map(entry => ({
        operation: entry.operation,
        dataTypes: {
          oldData: entry.oldData ? getDataTypes(entry.oldData) : null,
          newData: entry.newData ? getDataTypes(entry.newData) : null
        },
        hasValidJson: isValidJsonData(entry.oldData) && isValidJsonData(entry.newData)
      }))

      expect(integrityCheck).toMatchSnapshot('audit-data-integrity.json')
    })
  })
})

/**
 * Utility Functions for Snapshot Testing
 */

function normalizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') return data

  const normalized = { ...data }

  // Normalize common dynamic fields
  if (normalized.id) normalized.id = '[ID]'
  if (normalized.createdAt) normalized.createdAt = '[TIMESTAMP]'
  if (normalized.updatedAt) normalized.updatedAt = '[TIMESTAMP]'
  if (normalized.lastLoginAt) normalized.lastLoginAt = '[TIMESTAMP]'
  if (normalized.deletedAt) normalized.deletedAt = '[TIMESTAMP]'

  // Recursively normalize nested objects
  Object.keys(normalized).forEach(key => {
    if (typeof normalized[key] === 'object' && normalized[key] !== null) {
      normalized[key] = normalizeAuditData(normalized[key])
    }
  })

  return normalized
}

function getDataTypes(data: any): any {
  if (!data || typeof data !== 'object') return typeof data

  const types: Record<string, any> = {}
  Object.keys(data).forEach(key => {
    const value = data[key]
    if (value === null) {
      types[key] = 'null'
    } else if (Array.isArray(value)) {
      types[key] = 'array'
    } else if (typeof value === 'object') {
      types[key] = 'object'
    } else {
      types[key] = typeof value
    }
  })

  return types
}

function isValidJsonData(data: any): boolean {
  if (data === null || data === undefined) return true

  try {
    JSON.parse(JSON.stringify(data))
    return true
  } catch {
    return false
  }
}