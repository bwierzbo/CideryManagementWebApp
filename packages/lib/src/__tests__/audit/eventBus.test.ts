import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AuditEventBus,
  auditEventBus,
  publishCreateEvent,
  publishUpdateEvent,
  publishDeleteEvent,
  publishSoftDeleteEvent,
  publishRestoreEvent,
  createDatabaseAuditSubscriber
} from '../../audit/eventBus'

describe('Audit Event Bus', () => {
  let eventBus: AuditEventBus
  let mockHandler: ReturnType<typeof vi.fn>
  let mockAsyncHandler: ReturnType<typeof vi.fn>

  beforeEach(() => {
    eventBus = new AuditEventBus()
    mockHandler = vi.fn()
    mockAsyncHandler = vi.fn().mockResolvedValue(undefined)
  })

  describe('AuditEventBus', () => {
    describe('subscribe', () => {
      it('should subscribe to events and return subscription ID', () => {
        const subId = eventBus.subscribe(mockHandler)
        expect(typeof subId).toBe('string')
        expect(subId).toMatch(/^sub_\d+$/)
      })

      it('should generate unique subscription IDs', () => {
        const subId1 = eventBus.subscribe(mockHandler)
        const subId2 = eventBus.subscribe(mockHandler)
        expect(subId1).not.toBe(subId2)
      })

      it('should subscribe with table filter', () => {
        const subId = eventBus.subscribe(mockHandler, 'vendors')
        expect(typeof subId).toBe('string')
      })

      it('should increment subscription count', () => {
        expect(eventBus.getSubscriptionCount()).toBe(0)
        eventBus.subscribe(mockHandler)
        expect(eventBus.getSubscriptionCount()).toBe(1)
        eventBus.subscribe(mockHandler)
        expect(eventBus.getSubscriptionCount()).toBe(2)
      })
    })

    describe('unsubscribe', () => {
      it('should unsubscribe and return true for valid subscription', () => {
        const subId = eventBus.subscribe(mockHandler)
        const result = eventBus.unsubscribe(subId)
        expect(result).toBe(true)
        expect(eventBus.getSubscriptionCount()).toBe(0)
      })

      it('should return false for invalid subscription', () => {
        const result = eventBus.unsubscribe('invalid_id')
        expect(result).toBe(false)
      })
    })

    describe('publish', () => {
      it('should publish events to all subscribers', async () => {
        eventBus.subscribe(mockHandler)
        eventBus.subscribe(mockAsyncHandler)

        const event = {
          tableName: 'vendors',
          recordId: '123',
          operation: 'create' as const,
          newData: { name: 'Test Vendor' },
          timestamp: new Date()
        }

        await eventBus.publish(event)

        expect(mockHandler).toHaveBeenCalledWith(event)
        expect(mockAsyncHandler).toHaveBeenCalledWith(event)
      })

      it('should filter events by table name', async () => {
        const vendorHandler = vi.fn()
        const batchHandler = vi.fn()
        const allHandler = vi.fn()

        eventBus.subscribe(vendorHandler, 'vendors')
        eventBus.subscribe(batchHandler, 'batches') 
        eventBus.subscribe(allHandler) // No filter

        const vendorEvent = {
          tableName: 'vendors',
          recordId: '123',
          operation: 'create' as const,
          newData: { name: 'Test Vendor' },
          timestamp: new Date()
        }

        await eventBus.publish(vendorEvent)

        expect(vendorHandler).toHaveBeenCalledWith(vendorEvent)
        expect(batchHandler).not.toHaveBeenCalled()
        expect(allHandler).toHaveBeenCalledWith(vendorEvent)
      })

      it('should handle handler errors gracefully', async () => {
        const errorHandler = vi.fn().mockImplementation(() => {
          throw new Error('Handler error')
        })
        const goodHandler = vi.fn()

        eventBus.subscribe(errorHandler)
        eventBus.subscribe(goodHandler)

        const event = {
          tableName: 'vendors',
          recordId: '123',
          operation: 'create' as const,
          timestamp: new Date()
        }

        // Should not throw
        await expect(eventBus.publish(event)).resolves.toBeUndefined()
        
        expect(errorHandler).toHaveBeenCalled()
        expect(goodHandler).toHaveBeenCalled()
      })

      it('should wait for async handlers to complete', async () => {
        let handlerResolved = false
        const asyncHandler = vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          handlerResolved = true
        })

        eventBus.subscribe(asyncHandler)

        const event = {
          tableName: 'vendors',
          recordId: '123',
          operation: 'create' as const,
          timestamp: new Date()
        }

        await eventBus.publish(event)
        
        expect(handlerResolved).toBe(true)
      })
    })

    describe('clearAllSubscriptions', () => {
      it('should clear all subscriptions', () => {
        eventBus.subscribe(mockHandler)
        eventBus.subscribe(mockHandler)
        expect(eventBus.getSubscriptionCount()).toBe(2)

        eventBus.clearAllSubscriptions()
        expect(eventBus.getSubscriptionCount()).toBe(0)
      })
    })
  })

  describe('Helper Functions', () => {
    beforeEach(() => {
      auditEventBus.clearAllSubscriptions()
    })

    describe('publishCreateEvent', () => {
      it('should publish create event with correct structure', async () => {
        auditEventBus.subscribe(mockHandler)

        await publishCreateEvent(
          'vendors',
          'vendor-123',
          { name: 'New Vendor', isActive: true },
          'user-456',
          'Adding new supplier'
        )

        expect(mockHandler).toHaveBeenCalledWith({
          tableName: 'vendors',
          recordId: 'vendor-123',
          operation: 'create',
          newData: { name: 'New Vendor', isActive: true },
          changedBy: 'user-456',
          reason: 'Adding new supplier',
          timestamp: expect.any(Date)
        })
      })

      it('should work without optional parameters', async () => {
        auditEventBus.subscribe(mockHandler)

        await publishCreateEvent('vendors', 'vendor-123', { name: 'New Vendor' })

        expect(mockHandler).toHaveBeenCalledWith({
          tableName: 'vendors',
          recordId: 'vendor-123',
          operation: 'create',
          newData: { name: 'New Vendor' },
          changedBy: undefined,
          reason: undefined,
          timestamp: expect.any(Date)
        })
      })
    })

    describe('publishUpdateEvent', () => {
      it('should publish update event with old and new data', async () => {
        auditEventBus.subscribe(mockHandler)

        const oldData = { name: 'Old Vendor', isActive: true }
        const newData = { name: 'Updated Vendor', isActive: true }

        await publishUpdateEvent(
          'vendors',
          'vendor-123',
          oldData,
          newData,
          'user-456',
          'Updating vendor name'
        )

        expect(mockHandler).toHaveBeenCalledWith({
          tableName: 'vendors',
          recordId: 'vendor-123',
          operation: 'update',
          oldData,
          newData,
          changedBy: 'user-456',
          reason: 'Updating vendor name',
          timestamp: expect.any(Date)
        })
      })
    })

    describe('publishDeleteEvent', () => {
      it('should publish delete event', async () => {
        auditEventBus.subscribe(mockHandler)

        const oldData = { name: 'Deleted Vendor', isActive: true }

        await publishDeleteEvent(
          'vendors',
          'vendor-123',
          oldData,
          'user-456',
          'Vendor no longer needed'
        )

        expect(mockHandler).toHaveBeenCalledWith({
          tableName: 'vendors',
          recordId: 'vendor-123',
          operation: 'delete',
          oldData,
          changedBy: 'user-456',
          reason: 'Vendor no longer needed',
          timestamp: expect.any(Date)
        })
      })
    })

    describe('publishSoftDeleteEvent', () => {
      it('should publish soft delete event', async () => {
        auditEventBus.subscribe(mockHandler)

        const oldData = { name: 'Soft Deleted Vendor', isActive: true, deletedAt: null }

        await publishSoftDeleteEvent(
          'vendors',
          'vendor-123',
          oldData,
          'user-456',
          'Deactivating vendor'
        )

        expect(mockHandler).toHaveBeenCalledWith({
          tableName: 'vendors',
          recordId: 'vendor-123',
          operation: 'soft_delete',
          oldData,
          changedBy: 'user-456',
          reason: 'Deactivating vendor',
          timestamp: expect.any(Date)
        })
      })
    })

    describe('publishRestoreEvent', () => {
      it('should publish restore event', async () => {
        auditEventBus.subscribe(mockHandler)

        const newData = { name: 'Restored Vendor', isActive: true, deletedAt: null }

        await publishRestoreEvent(
          'vendors',
          'vendor-123',
          newData,
          'user-456',
          'Reactivating vendor'
        )

        expect(mockHandler).toHaveBeenCalledWith({
          tableName: 'vendors',
          recordId: 'vendor-123',
          operation: 'restore',
          newData,
          changedBy: 'user-456',
          reason: 'Reactivating vendor',
          timestamp: expect.any(Date)
        })
      })
    })
  })

  describe('createDatabaseAuditSubscriber', () => {
    it('should create a database audit subscriber', async () => {
      const mockWriteToDatabase = vi.fn().mockResolvedValue(undefined)
      
      const subId = createDatabaseAuditSubscriber(mockWriteToDatabase)
      expect(typeof subId).toBe('string')

      // Test that it writes to database when event is published
      await publishCreateEvent('vendors', 'vendor-123', { name: 'Test' })

      expect(mockWriteToDatabase).toHaveBeenCalledWith({
        tableName: 'vendors',
        recordId: 'vendor-123',
        operation: 'create',
        oldData: undefined,
        newData: { name: 'Test' },
        changedBy: undefined,
        changedAt: expect.any(Date),
        reason: undefined
      })
    })

    it('should handle database write errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockWriteToDatabase = vi.fn().mockRejectedValue(new Error('Database error'))
      
      createDatabaseAuditSubscriber(mockWriteToDatabase)

      // Should not throw
      await expect(publishCreateEvent('vendors', 'vendor-123', { name: 'Test' }))
        .resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write audit log to database:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Event Flow Integration', () => {
    it('should handle a complete CRUD cycle', async () => {
      const events: any[] = []
      auditEventBus.subscribe((event) => events.push(event))

      const recordId = 'vendor-123'
      const userId = 'user-456'

      // Create
      await publishCreateEvent(recordId, recordId, { name: 'New Vendor' }, userId)
      
      // Update  
      await publishUpdateEvent(
        recordId, 
        recordId, 
        { name: 'New Vendor' }, 
        { name: 'Updated Vendor' }, 
        userId
      )
      
      // Soft Delete
      await publishSoftDeleteEvent(
        recordId, 
        recordId, 
        { name: 'Updated Vendor', deletedAt: null }, 
        userId
      )
      
      // Restore
      await publishRestoreEvent(
        recordId, 
        recordId, 
        { name: 'Updated Vendor', deletedAt: null }, 
        userId
      )
      
      // Hard Delete
      await publishDeleteEvent(
        recordId, 
        recordId, 
        { name: 'Updated Vendor' }, 
        userId
      )

      expect(events).toHaveLength(5)
      expect(events[0].operation).toBe('create')
      expect(events[1].operation).toBe('update')
      expect(events[2].operation).toBe('soft_delete')
      expect(events[3].operation).toBe('restore')
      expect(events[4].operation).toBe('delete')
    })

    it('should handle multiple concurrent events', async () => {
      const events: any[] = []
      auditEventBus.subscribe((event) => events.push(event))

      const promises = []
      
      // Publish multiple events concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          publishCreateEvent('vendors', `vendor-${i}`, { name: `Vendor ${i}` })
        )
      }

      await Promise.all(promises)

      expect(events).toHaveLength(10)
      events.forEach((event, index) => {
        expect(event.recordId).toBe(`vendor-${index}`)
        expect(event.operation).toBe('create')
      })
    })

    it('should maintain event ordering for sequential operations', async () => {
      const events: any[] = []
      auditEventBus.subscribe((event) => events.push(event))

      const recordId = 'vendor-123'

      // Sequential operations
      await publishCreateEvent('vendors', recordId, { name: 'Vendor', version: 1 })
      await publishUpdateEvent('vendors', recordId, { version: 1 }, { version: 2 })
      await publishUpdateEvent('vendors', recordId, { version: 2 }, { version: 3 })

      expect(events).toHaveLength(3)
      expect(events[0].newData.version).toBe(1)
      expect(events[1].newData.version).toBe(2)  
      expect(events[2].newData.version).toBe(3)
    })
  })
})