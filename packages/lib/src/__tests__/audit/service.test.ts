import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateAuditChecksum,
  validateAuditIntegrity,
  generateDataDiff,
  sanitizeAuditData,
  createAuditLogEntry,
  validateAuditSnapshot,
  extractChangedFields,
  generateChangeSummary
} from '../../audit/service'
import type { AuditSnapshot, AuditLogEntry, AuditContext } from '../../audit/service'

describe('Audit Service', () => {
  describe('generateAuditChecksum', () => {
    it('should generate consistent checksums for identical data', () => {
      const auditEntry: Omit<AuditLogEntry, 'checksum'> = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        newData: { name: 'John Doe', email: 'john@example.com' },
        changedBy: 'user1',
        changedAt: new Date('2024-01-01T10:00:00Z'),
        auditVersion: '1.0'
      }

      const checksum1 = generateAuditChecksum(auditEntry)
      const checksum2 = generateAuditChecksum(auditEntry)

      expect(checksum1).toBe(checksum2)
      expect(checksum1).toHaveLength(64) // SHA-256 hex length
    })

    it('should generate different checksums for different data', () => {
      const baseEntry: Omit<AuditLogEntry, 'checksum'> = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        newData: { name: 'John Doe', email: 'john@example.com' },
        changedBy: 'user1',
        changedAt: new Date('2024-01-01T10:00:00Z'),
        auditVersion: '1.0'
      }

      const modifiedEntry = {
        ...baseEntry,
        recordId: '456e7890-e89b-12d3-a456-426614174001' // Changed recordId to ensure different checksum
      }

      const checksum1 = generateAuditChecksum(baseEntry)
      const checksum2 = generateAuditChecksum(modifiedEntry)

      expect(checksum1).not.toBe(checksum2)
    })
  })

  describe('validateAuditIntegrity', () => {
    it('should validate audit entry with correct checksum', () => {
      const auditEntryWithoutChecksum: Omit<AuditLogEntry, 'checksum'> = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        newData: { name: 'John Doe', email: 'john@example.com' },
        changedBy: 'user1',
        changedAt: new Date('2024-01-01T10:00:00Z'),
        auditVersion: '1.0'
      }

      const checksum = generateAuditChecksum(auditEntryWithoutChecksum)
      const auditEntry: AuditLogEntry = {
        ...auditEntryWithoutChecksum,
        checksum
      }

      expect(validateAuditIntegrity(auditEntry)).toBe(true)
    })

    it('should reject audit entry with incorrect checksum', () => {
      const auditEntry: AuditLogEntry = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        newData: { name: 'John Doe', email: 'john@example.com' },
        changedBy: 'user1',
        changedAt: new Date('2024-01-01T10:00:00Z'),
        auditVersion: '1.0',
        checksum: 'invalid_checksum'
      }

      expect(validateAuditIntegrity(auditEntry)).toBe(false)
    })

    it('should reject audit entry without checksum', () => {
      const auditEntry = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        newData: { name: 'John Doe', email: 'john@example.com' },
        changedBy: 'user1',
        changedAt: new Date('2024-01-01T10:00:00Z'),
        auditVersion: '1.0'
      } as AuditLogEntry

      expect(validateAuditIntegrity(auditEntry)).toBe(false)
    })
  })

  describe('generateDataDiff', () => {
    it('should generate create diff for new data', () => {
      const newData = { name: 'John Doe', email: 'john@example.com' }
      const diff = generateDataDiff(undefined, newData)

      expect(diff).toEqual({
        __type: 'create',
        added: newData
      })
    })

    it('should generate delete diff for removed data', () => {
      const oldData = { name: 'John Doe', email: 'john@example.com' }
      const diff = generateDataDiff(oldData, undefined)

      expect(diff).toEqual({
        __type: 'delete',
        removed: oldData
      })
    })

    it('should generate update diff for changed data', () => {
      const oldData = { name: 'John Doe', email: 'john@example.com', age: 30 }
      const newData = { name: 'John Smith', email: 'john@example.com', age: 31 }

      const diff = generateDataDiff(oldData, newData)

      expect(diff).toBeDefined()
      // The exact diff format depends on the json-diff library implementation
    })

    it('should return null for no data', () => {
      const diff = generateDataDiff(undefined, undefined)
      expect(diff).toBeNull()
    })
  })

  describe('sanitizeAuditData', () => {
    it('should redact sensitive fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'secret123',
        token: 'abc123',
        apiKey: 'key123',
        normalField: 'normal'
      }

      const sanitized = sanitizeAuditData(data)

      expect(sanitized).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        normalField: 'normal'
      })
    })

    it('should handle data without sensitive fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      }

      const sanitized = sanitizeAuditData(data)

      expect(sanitized).toEqual(data)
      expect(sanitized).not.toBe(data) // Should be a copy
    })
  })

  describe('createAuditLogEntry', () => {
    it('should create complete audit log entry for create operation', () => {
      const context: AuditContext = {
        userId: 'user123',
        userEmail: 'user@example.com',
        reason: 'User registration'
      }

      const snapshot: AuditSnapshot = {
        operation: 'create',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        newData: { name: 'John Doe', email: 'john@example.com' },
        context,
        timestamp: new Date('2024-01-01T10:00:00Z')
      }

      const auditEntry = createAuditLogEntry(snapshot)

      expect(auditEntry).toEqual({
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        oldData: undefined,
        newData: { name: 'John Doe', email: 'john@example.com' },
        diffData: {
          __type: 'create',
          added: { name: 'John Doe', email: 'john@example.com' }
        },
        changedBy: 'user123',
        changedByEmail: 'user@example.com',
        changedAt: new Date('2024-01-01T10:00:00Z'),
        reason: 'User registration',
        ipAddress: undefined,
        userAgent: undefined,
        sessionId: undefined,
        auditVersion: '1.0',
        checksum: expect.any(String)
      })

      expect(auditEntry.checksum).toHaveLength(64)
    })

    it('should create audit log entry for update operation', () => {
      const context: AuditContext = {
        userId: 'user123',
        userEmail: 'user@example.com',
        ipAddress: '192.168.1.1'
      }

      const snapshot: AuditSnapshot = {
        operation: 'update',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        oldData: { name: 'John Doe', email: 'john@example.com' },
        newData: { name: 'John Smith', email: 'john@example.com' },
        context
      }

      const auditEntry = createAuditLogEntry(snapshot)

      expect(auditEntry.operation).toBe('update')
      expect(auditEntry.oldData).toEqual({ name: 'John Doe', email: 'john@example.com' })
      expect(auditEntry.newData).toEqual({ name: 'John Smith', email: 'john@example.com' })
      expect(auditEntry.ipAddress).toBe('192.168.1.1')
      expect(auditEntry.diffData).toBeDefined()
      expect(auditEntry.checksum).toHaveLength(64)
    })

    it('should sanitize sensitive data in audit log', () => {
      const snapshot: AuditSnapshot = {
        operation: 'create',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        newData: {
          name: 'John Doe',
          email: 'john@example.com',
          passwordHash: 'secret123'
        }
      }

      const auditEntry = createAuditLogEntry(snapshot)

      expect(auditEntry.newData).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: '[REDACTED]'
      })
    })
  })

  describe('validateAuditSnapshot', () => {
    it('should validate correct create snapshot', () => {
      const snapshot: AuditSnapshot = {
        operation: 'create',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        newData: { name: 'John Doe', email: 'john@example.com' }
      }

      const validation = validateAuditSnapshot(snapshot)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should validate correct update snapshot', () => {
      const snapshot: AuditSnapshot = {
        operation: 'update',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        oldData: { name: 'John Doe', email: 'john@example.com' },
        newData: { name: 'John Smith', email: 'john@example.com' }
      }

      const validation = validateAuditSnapshot(snapshot)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject snapshot with missing required fields', () => {
      const snapshot: Partial<AuditSnapshot> = {
        operation: 'create'
      }

      const validation = validateAuditSnapshot(snapshot as AuditSnapshot)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('tableName is required')
      expect(validation.errors).toContain('recordId is required')
    })

    it('should reject create snapshot without newData', () => {
      const snapshot: AuditSnapshot = {
        operation: 'create',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000'
      }

      const validation = validateAuditSnapshot(snapshot)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('newData is required for create operations')
    })

    it('should reject update snapshot without oldData or newData', () => {
      const snapshot: AuditSnapshot = {
        operation: 'update',
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000'
      }

      const validation = validateAuditSnapshot(snapshot)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('oldData is required for update operations')
      expect(validation.errors).toContain('newData is required for update operations')
    })

    it('should reject invalid operation type', () => {
      const snapshot = {
        operation: 'invalid_operation' as any,
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000'
      } as AuditSnapshot

      const validation = validateAuditSnapshot(snapshot)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('operation must be one of: create, update, delete, soft_delete, restore')
    })
  })

  describe('extractChangedFields', () => {
    it('should extract fields from create diff', () => {
      const diffData = {
        __type: 'create',
        added: { name: 'John Doe', email: 'john@example.com', age: 30 }
      }

      const fields = extractChangedFields(diffData)

      expect(fields).toEqual(['age', 'email', 'name'])
    })

    it('should extract fields from delete diff', () => {
      const diffData = {
        __type: 'delete',
        removed: { name: 'John Doe', email: 'john@example.com' }
      }

      const fields = extractChangedFields(diffData)

      expect(fields).toEqual(['email', 'name'])
    })

    it('should extract fields from standard diff', () => {
      const diffData = {
        name: ['John Doe', 'John Smith'],
        age: [30, 31],
        email: 'john@example.com' // unchanged
      }

      const fields = extractChangedFields(diffData)

      expect(fields).toEqual(['age', 'email', 'name'])
    })

    it('should return empty array for invalid diff data', () => {
      expect(extractChangedFields(null)).toEqual([])
      expect(extractChangedFields(undefined)).toEqual([])
      expect(extractChangedFields('invalid')).toEqual([])
    })
  })

  describe('generateChangeSummary', () => {
    it('should generate summary for create operation', () => {
      const auditEntry: AuditLogEntry = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'create',
        newData: { name: 'John Doe' },
        diffData: { __type: 'create', added: { name: 'John Doe' } },
        changedAt: new Date(),
        auditVersion: '1.0'
      }

      const summary = generateChangeSummary(auditEntry)

      expect(summary).toBe('Created new users record')
    })

    it('should generate summary for delete operation', () => {
      const auditEntry: AuditLogEntry = {
        tableName: 'products',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'delete',
        oldData: { name: 'Product 1' },
        diffData: { __type: 'delete', removed: { name: 'Product 1' } },
        changedAt: new Date(),
        auditVersion: '1.0'
      }

      const summary = generateChangeSummary(auditEntry)

      expect(summary).toBe('Deleted products record')
    })

    it('should generate summary for update with single field', () => {
      const auditEntry: AuditLogEntry = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'update',
        diffData: { name: ['John Doe', 'John Smith'] },
        changedAt: new Date(),
        auditVersion: '1.0'
      }

      const summary = generateChangeSummary(auditEntry)

      expect(summary).toBe('Updated users record: name')
    })

    it('should generate summary for update with multiple fields', () => {
      const auditEntry: AuditLogEntry = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'update',
        diffData: {
          name: ['John Doe', 'John Smith'],
          email: ['john@old.com', 'john@new.com']
        },
        changedAt: new Date(),
        auditVersion: '1.0'
      }

      const summary = generateChangeSummary(auditEntry)

      expect(summary).toBe('Updated users record: email, name')
    })

    it('should generate summary for update with many fields', () => {
      const auditEntry: AuditLogEntry = {
        tableName: 'users',
        recordId: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'update',
        diffData: {
          name: 'changed',
          email: 'changed',
          phone: 'changed',
          address: 'changed',
          age: 'changed'
        },
        changedAt: new Date(),
        auditVersion: '1.0'
      }

      const summary = generateChangeSummary(auditEntry)

      expect(summary).toBe('Updated users record: address, age, email and 2 more fields')
    })
  })
})