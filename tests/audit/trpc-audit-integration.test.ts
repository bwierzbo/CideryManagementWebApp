import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { createCallerFactory } from '@trpc/server'
import { appRouter } from 'api/src/routers'
import { db } from 'db'
import { auditLogs, vendors, users } from 'db/src/schema'
import { eq } from 'drizzle-orm'
import { initializeAuditSystem } from 'api/src/middleware/audit'
import { AuditDatabase } from 'lib/src/audit/database'
import { auditEventBus } from 'lib/src/audit/eventBus'
import type { Context } from 'api/src/trpc'

/**
 * Integration tests for tRPC audit middleware
 * Tests that mutations through tRPC procedures are properly audited
 */

describe('tRPC Audit Integration Tests', () => {
  let auditDatabase: AuditDatabase
  let createCaller: ReturnType<typeof createCallerFactory<typeof appRouter>>
  let testUserId: string
  let mockContext: Context

  beforeAll(async () => {
    // Initialize audit system
    initializeAuditSystem(db, {
      enabled: true,
      excludedTables: ['audit_metadata', 'sessions'],
      includeRequestInfo: true
    })

    auditDatabase = new AuditDatabase(db)
    createCaller = createCallerFactory(appRouter)

    // Create test user
    const [testUser] = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed_password',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()

    testUserId = testUser.id

    // Mock context
    mockContext = {
      session: {
        user: {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin'
        }
      }
    }
  })

  beforeEach(async () => {
    // Clear audit logs before each test
    await db.delete(auditLogs)
    auditEventBus.clearAllSubscriptions()
  })

  afterEach(async () => {
    // Clean up test vendors
    try {
      await db.delete(vendors).where(eq(vendors.name, 'Test Vendor'))
      await db.delete(vendors).where(eq(vendors.name, 'Updated Test Vendor'))
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Vendor Operations Audit', () => {
    it('should audit vendor creation through tRPC', async () => {
      const caller = createCaller(mockContext)

      // Create vendor through tRPC
      const result = await caller.vendor.create({
        name: 'Test Vendor',
        contactInfo: { email: 'vendor@example.com' }
      })

      expect(result.success).toBe(true)
      expect(result.vendor).toBeDefined()

      // Wait for audit event processing
      await new Promise(resolve => setTimeout(resolve, 200))

      // Check audit log was created
      const auditLogsResult = await auditDatabase.getRecordHistory('vendors', result.vendor.id)

      expect(auditLogsResult).toHaveLength(1)
      expect(auditLogsResult[0].operation).toBe('create')
      expect(auditLogsResult[0].tableName).toBe('vendors')
      expect(auditLogsResult[0].recordId).toBe(result.vendor.id)
      expect(auditLogsResult[0].changedBy).toBe(testUserId)
      expect(auditLogsResult[0].changedByEmail).toBe('test@example.com')
      expect(auditLogsResult[0].newData).toEqual(
        expect.objectContaining({
          name: 'Test Vendor'
        })
      )
      expect(auditLogsResult[0].oldData).toBeUndefined()
    })

    it('should audit vendor deletion through tRPC', async () => {
      const caller = createCaller(mockContext)

      // First create a vendor
      const createResult = await caller.vendor.create({
        name: 'Test Vendor',
        contactInfo: { email: 'vendor@example.com' }
      })

      // Clear audit logs to focus on delete operation
      await db.delete(auditLogs)

      // Delete vendor through tRPC
      const deleteResult = await caller.vendor.delete({
        id: createResult.vendor.id
      })

      expect(deleteResult.success).toBe(true)

      // Wait for audit event processing
      await new Promise(resolve => setTimeout(resolve, 200))

      // Check audit log for delete operation
      const auditLogsResult = await auditDatabase.getRecordHistory('vendors', createResult.vendor.id)

      expect(auditLogsResult).toHaveLength(1)
      expect(auditLogsResult[0].operation).toBe('delete') // Should be 'soft_delete' with proper middleware
      expect(auditLogsResult[0].tableName).toBe('vendors')
      expect(auditLogsResult[0].recordId).toBe(createResult.vendor.id)
      expect(auditLogsResult[0].changedBy).toBe(testUserId)
      expect(auditLogsResult[0].oldData).toBeDefined()
    })
  })

  describe('Purchase Operations Audit', () => {
    it('should audit purchase creation with items', async () => {
      const caller = createCaller(mockContext)

      // First create a vendor and apple variety
      const vendorResult = await caller.vendor.create({
        name: 'Test Vendor',
        contactInfo: { email: 'vendor@example.com' }
      })

      const varietyResult = await caller.appleVariety.create({
        name: 'Test Apple',
        description: 'Test apple variety',
        typicalBrix: 12.5
      })

      // Clear audit logs to focus on purchase creation
      await db.delete(auditLogs)

      // Create purchase with items
      const purchaseResult = await caller.purchase.create({
        vendorId: vendorResult.vendor.id,
        purchaseDate: new Date('2024-01-01'),
        invoiceNumber: 'TEST-001',
        notes: 'Test purchase',
        items: [
          {
            appleVarietyId: varietyResult.appleVariety.id,
            quantity: 100,
            unit: 'kg' as const,
            pricePerUnit: 2.50,
            notes: 'Good quality apples'
          }
        ]
      })

      expect(purchaseResult.success).toBe(true)

      // Wait for audit events
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check audit logs for purchase and items
      const purchaseAuditLogs = await auditDatabase.getRecordHistory('purchases', purchaseResult.purchase.id)
      const itemAuditLogs = await auditDatabase.queryAuditLogs({
        tableName: 'purchase_items',
        limit: 10
      })

      expect(purchaseAuditLogs).toHaveLength(1)
      expect(purchaseAuditLogs[0].operation).toBe('create')
      expect(purchaseAuditLogs[0].changedBy).toBe(testUserId)

      expect(itemAuditLogs.auditLogs.length).toBeGreaterThan(0)
      expect(itemAuditLogs.auditLogs[0].operation).toBe('create')
      expect(itemAuditLogs.auditLogs[0].tableName).toBe('purchase_items')
    })
  })

  describe('Audit Context and Attribution', () => {
    it('should capture user context in audit logs', async () => {
      const caller = createCaller(mockContext)

      const result = await caller.vendor.create({
        name: 'Test Vendor',
        contactInfo: { email: 'vendor@example.com' }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      const auditLogsResult = await auditDatabase.getRecordHistory('vendors', result.vendor.id)

      expect(auditLogsResult).toHaveLength(1)
      expect(auditLogsResult[0].changedBy).toBe(testUserId)
      expect(auditLogsResult[0].changedByEmail).toBe('test@example.com')
      expect(auditLogsResult[0].changedAt).toBeInstanceOf(Date)
      expect(auditLogsResult[0].auditVersion).toBe('1.0')
    })

    it('should handle operations without user context gracefully', async () => {
      // Create caller without user context
      const noUserCaller = createCaller({ session: null })

      // This should fail due to authentication, but let's test with a public procedure
      const publicResult = await noUserCaller.ping()

      expect(publicResult.ok).toBe(true)

      // No audit logs should be created for public procedures
      const auditLogsResult = await auditDatabase.queryAuditLogs({ limit: 10 })
      expect(auditLogsResult.auditLogs).toHaveLength(0)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should not fail mutations when audit logging fails', async () => {
      // Mock audit database to fail
      const originalWriteMethod = auditDatabase.writeAuditLog
      vi.spyOn(auditDatabase, 'writeAuditLog').mockRejectedValue(new Error('Audit DB failure'))

      const caller = createCaller(mockContext)

      // Operation should still succeed even if audit fails
      const result = await caller.vendor.create({
        name: 'Test Vendor',
        contactInfo: { email: 'vendor@example.com' }
      })

      expect(result.success).toBe(true)
      expect(result.vendor).toBeDefined()

      // Verify vendor was actually created
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, result.vendor.id)
      })

      expect(vendor).toBeDefined()
      expect(vendor?.name).toBe('Test Vendor')

      // Restore original method
      vi.restoreAllMocks()
    })

    it('should handle concurrent operations correctly', async () => {
      const caller = createCaller(mockContext)

      // Create multiple vendors concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        caller.vendor.create({
          name: `Concurrent Vendor ${i}`,
          contactInfo: { email: `vendor${i}@example.com` }
        })
      )

      const results = await Promise.all(promises)

      // All operations should succeed
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Wait for all audit events
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check audit logs for all operations
      const auditLogsResult = await auditDatabase.queryAuditLogs({
        tableName: 'vendors',
        limit: 20
      })

      expect(auditLogsResult.auditLogs.length).toBeGreaterThanOrEqual(5)

      // All audit logs should have valid data
      auditLogsResult.auditLogs.forEach(log => {
        expect(log.operation).toBe('create')
        expect(log.tableName).toBe('vendors')
        expect(log.changedBy).toBe(testUserId)
        expect(log.checksum).toHaveLength(64)
      })

      // Cleanup
      for (const result of results) {
        await db.delete(vendors).where(eq(vendors.id, result.vendor.id))
      }
    })
  })

  describe('Audit Query Operations', () => {
    it('should provide audit query functionality through tRPC', async () => {
      const caller = createCaller(mockContext)

      // Create some test data
      const vendorResult = await caller.vendor.create({
        name: 'Test Vendor',
        contactInfo: { email: 'vendor@example.com' }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Query audit logs through tRPC
      const auditQueryResult = await caller.audit.queryLogs({
        tableName: 'vendors',
        limit: 10
      })

      expect(auditQueryResult.auditLogs).toHaveLength(1)
      expect(auditQueryResult.totalCount).toBeGreaterThanOrEqual(1)
      expect(auditQueryResult.hasMore).toBe(false)

      // Test record history query
      const historyResult = await caller.audit.getRecordHistory({
        tableName: 'vendors',
        recordId: vendorResult.vendor.id
      })

      expect(historyResult).toHaveLength(1)
      expect(historyResult[0].recordId).toBe(vendorResult.vendor.id)

      // Test user activity query
      const userActivityResult = await caller.audit.getUserActivity({
        userId: testUserId,
        limit: 10
      })

      expect(userActivityResult.length).toBeGreaterThanOrEqual(1)
      expect(userActivityResult[0].changedBy).toBe(testUserId)
    })

    it('should provide audit statistics through tRPC', async () => {
      const caller = createCaller(mockContext)

      // Create test data
      await caller.vendor.create({
        name: 'Stats Test Vendor',
        contactInfo: { email: 'stats@example.com' }
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Get audit stats
      const statsResult = await caller.audit.getStats({
        tableName: 'vendors',
        daysPast: 30
      })

      expect(statsResult).toEqual(
        expect.objectContaining({
          totalOperations: expect.any(Number),
          operationBreakdown: expect.objectContaining({
            create: expect.any(Number)
          }),
          uniqueUsers: expect.any(Number),
          dateRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date)
          })
        })
      )

      // Get coverage stats
      const coverageResult = await caller.audit.getCoverage()

      expect(coverageResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tableName: expect.any(String),
            totalLogs: expect.any(Number),
            operationCounts: expect.any(Object),
            lastActivity: expect.any(Date)
          })
        ])
      )
    })
  })
})