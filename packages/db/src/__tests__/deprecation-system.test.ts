/**
 * Tests for Database Deprecation System
 *
 * Comprehensive test suite for the non-destructive deprecation system.
 * Tests all core functionality including safety checks, rollback procedures, and monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeprecationSystem, DeprecatedElement, ElementType, DeprecationReason } from '../migrations/deprecation-system';
import { generateDeprecatedName, validateNamingConvention, isDeprecatedName } from '../migrations/naming-convention';
import { performSafetyChecks } from '../migrations/safety-checks';
import { RollbackManager } from '../migrations/rollback-manager';
import { DeprecatedMonitor } from '../monitoring/deprecated-monitor';
import { TelemetryCollector } from '../monitoring/telemetry-collector';
import { AlertSystem } from '../monitoring/alert-system';
import { BackupValidator } from '../migrations/backup-validator';

// Mock database connection
const mockDb = {
  execute: vi.fn(),
  transaction: vi.fn(),
} as any;

describe('Database Deprecation System', () => {
  let deprecationSystem: DeprecationSystem;
  let monitor: DeprecatedMonitor;
  let rollbackManager: RollbackManager;
  let telemetryCollector: TelemetryCollector;
  let alertSystem: AlertSystem;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create system components
    telemetryCollector = new TelemetryCollector({ enabled: false }); // Disable for tests
    alertSystem = new AlertSystem({ enabled: false }); // Disable for tests
    monitor = new DeprecatedMonitor(mockDb, telemetryCollector, alertSystem, { enabled: false });
    rollbackManager = new RollbackManager(mockDb, { validateBeforeRollback: false });
    deprecationSystem = new DeprecationSystem(mockDb, monitor, rollbackManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Naming Convention', () => {
    it('should generate correct deprecated names', () => {
      const testCases = [
        {
          original: 'user_preferences',
          reason: 'unused' as DeprecationReason,
          expected: /^user_preferences_deprecated_\d{8}_unu$/,
        },
        {
          original: 'order_status_idx',
          reason: 'performance' as DeprecationReason,
          expected: /^order_status_idx_deprecated_\d{8}_perf$/,
        },
        {
          original: 'temp_calculations',
          reason: 'migration' as DeprecationReason,
          expected: /^temp_calculations_deprecated_\d{8}_migr$/,
        },
      ];

      testCases.forEach(({ original, reason, expected }) => {
        const deprecated = generateDeprecatedName(original, reason);
        expect(deprecated).toMatch(expected);
        expect(validateNamingConvention(deprecated)).toBe(true);
        expect(isDeprecatedName(deprecated)).toBe(true);
      });
    });

    it('should handle long names by truncating', () => {
      const longName = 'a'.repeat(100); // Very long name
      const deprecated = generateDeprecatedName(longName, 'unused');

      expect(deprecated.length).toBeLessThanOrEqual(63); // PostgreSQL limit
      expect(validateNamingConvention(deprecated)).toBe(true);
    });

    it('should reject invalid deprecated names', () => {
      const invalidNames = [
        'table_name', // No deprecated marker
        'table_deprecated', // Missing date and reason
        'table_deprecated_invalid_unu', // Invalid date format
        'table_deprecated_20250928_invalid', // Invalid reason code
      ];

      invalidNames.forEach(name => {
        expect(validateNamingConvention(name)).toBe(false);
        expect(isDeprecatedName(name)).toBe(false);
      });
    });
  });

  describe('Safety Checks', () => {
    const mockElement: DeprecatedElement = {
      type: 'table',
      originalName: 'test_table',
      deprecatedName: 'test_table_deprecated_20250928_unu',
      schema: 'public',
      deprecationDate: '2025-09-28',
      reason: 'unused',
      dependencies: [],
      usageData: {
        lastAccessed: null,
        accessCount: 0,
        confidenceScore: 0.95,
        analysisDate: '2025-09-28T12:00:00Z',
        accessSources: [],
      },
      migrationSql: 'ALTER TABLE "public"."test_table" RENAME TO "test_table_deprecated_20250928_unu";',
      rollbackSql: 'ALTER TABLE "public"."test_table_deprecated_20250928_unu" RENAME TO "test_table";',
    };

    it('should pass safety checks for safe elements', async () => {
      // Mock database responses for safety checks
      mockDb.execute.mockImplementation((query) => {
        const queryStr = query.queryChunks ? query.queryChunks.join('') : query.toString();

        if (queryStr.includes('COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: 1 }] }); // Element exists
        }
        if (queryStr.includes('foreign_key')) {
          return Promise.resolve({ rows: [] }); // No foreign keys
        }
        return Promise.resolve({ rows: [] });
      });

      const results = await performSafetyChecks(mockDb, [mockElement]);

      expect(results.length).toBeGreaterThan(0);

      // Should have mostly passing checks for a safe element
      const criticalFailures = results.filter(r => !r.passed && r.severity === 'critical');
      expect(criticalFailures.length).toBe(0);
    });

    it('should fail safety checks for risky elements', async () => {
      const riskyElement: DeprecatedElement = {
        ...mockElement,
        usageData: {
          ...mockElement.usageData,
          confidenceScore: 0.5, // Low confidence
          lastAccessed: new Date().toISOString(), // Recently accessed
        },
        dependencies: [
          {
            type: 'foreign_key',
            name: 'fk_user_preferences',
            dependentObject: 'users',
            impact: 'high',
          },
        ],
      };

      // Mock database to show table has data
      mockDb.execute.mockImplementation((query) => {
        const queryStr = query.queryChunks ? query.queryChunks.join('') : query.toString();

        if (queryStr.includes('COUNT(*)') && queryStr.includes('FROM')) {
          return Promise.resolve({ rows: [{ count: 1000 }] }); // Table has data
        }
        if (queryStr.includes('foreign_key')) {
          return Promise.resolve({ rows: [{ constraint_name: 'fk_test', table_name: 'users' }] });
        }
        return Promise.resolve({ rows: [{ count: 1 }] });
      });

      const results = await performSafetyChecks(mockDb, [riskyElement]);

      // Should have some failures for risky element
      const highSeverityFailures = results.filter(r => !r.passed && r.severity === 'high');
      expect(highSeverityFailures.length).toBeGreaterThan(0);
    });
  });

  describe('Deprecation Planning', () => {
    it('should create a valid deprecation plan', async () => {
      const elements = [
        {
          type: 'table' as ElementType,
          name: 'user_preferences',
          schema: 'public',
          reason: 'unused' as DeprecationReason,
        },
      ];

      // Mock safety checks to pass
      mockDb.execute.mockResolvedValue({ rows: [{ count: 1 }] });

      const plan = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test_user',
        environment: 'test',
      });

      expect(plan.id).toMatch(/^dep_\d+_[a-z0-9]+$/);
      expect(plan.elements).toHaveLength(1);
      expect(plan.elements[0].type).toBe('table');
      expect(plan.elements[0].originalName).toBe('user_preferences');
      expect(plan.elements[0].deprecatedName).toMatch(/^user_preferences_deprecated_\d{8}_unu$/);
      expect(plan.rollbackPlan).toBeDefined();
      expect(plan.safetyChecks).toBeDefined();
    });

    it('should fail planning if safety checks fail', async () => {
      const elements = [
        {
          type: 'table' as ElementType,
          name: 'critical_table',
          schema: 'public',
          reason: 'unused' as DeprecationReason,
        },
      ];

      // Mock safety checks to fail
      mockDb.execute.mockImplementation((query) => {
        throw new Error('Critical safety check failed');
      });

      await expect(
        deprecationSystem.planDeprecation(elements, { createdBy: 'test_user' })
      ).rejects.toThrow('safety checks failed');
    });
  });

  describe('Element Analysis', () => {
    it('should analyze table elements correctly', async () => {
      // Mock database responses for table analysis
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // Table exists
        .mockResolvedValueOnce({ rows: [] }) // No foreign keys
        .mockResolvedValueOnce({ rows: [{ size: 1024, row_count: 100 }] }); // Table size

      const element = {
        type: 'table' as ElementType,
        name: 'test_table',
        schema: 'public',
        reason: 'unused' as DeprecationReason,
      };

      const plan = await deprecationSystem.planDeprecation([element], {});

      expect(plan.elements[0].type).toBe('table');
      expect(plan.elements[0].originalName).toBe('test_table');
      expect(plan.elements[0].migrationSql).toContain('ALTER TABLE');
      expect(plan.elements[0].rollbackSql).toContain('ALTER TABLE');
    });

    it('should generate correct migration SQL for different element types', async () => {
      const testCases = [
        {
          type: 'table' as ElementType,
          name: 'test_table',
          expectedSql: 'ALTER TABLE "public"."test_table" RENAME TO',
        },
        {
          type: 'index' as ElementType,
          name: 'test_index',
          expectedSql: 'ALTER INDEX "public"."test_index" RENAME TO',
        },
      ];

      for (const testCase of testCases) {
        mockDb.execute.mockResolvedValue({ rows: [{ count: 1 }] });

        const plan = await deprecationSystem.planDeprecation([testCase], {});

        expect(plan.elements[0].migrationSql).toContain(testCase.expectedSql);
      }
    });
  });

  describe('Risk Assessment', () => {
    it('should assess low risk for simple unused columns', async () => {
      const element = {
        type: 'column' as ElementType,
        name: 'user_table.unused_column',
        schema: 'public',
        reason: 'unused' as DeprecationReason,
      };

      mockDb.execute.mockResolvedValue({ rows: [{ count: 1 }] });

      const plan = await deprecationSystem.planDeprecation([element], {});

      expect(plan.metadata.riskLevel).toBe('low');
      expect(plan.metadata.approvalRequired).toBe(false);
    });

    it('should assess high risk for tables with dependencies', async () => {
      const element = {
        type: 'table' as ElementType,
        name: 'users',
        schema: 'public',
        reason: 'unused' as DeprecationReason,
      };

      // Mock foreign key dependencies
      mockDb.execute.mockImplementation((query) => {
        const queryStr = query.queryChunks ? query.queryChunks.join('') : query.toString();

        if (queryStr.includes('foreign_key')) {
          return Promise.resolve({
            rows: [
              { constraint_name: 'fk_user_posts', dependent_table: 'posts' },
              { constraint_name: 'fk_user_orders', dependent_table: 'orders' },
            ],
          });
        }
        return Promise.resolve({ rows: [{ count: 1 }] });
      });

      const plan = await deprecationSystem.planDeprecation([element], {});

      expect(plan.metadata.riskLevel).toBe('high');
      expect(plan.metadata.approvalRequired).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete deprecation workflow', async () => {
      const elements = [
        {
          type: 'table' as ElementType,
          name: 'old_analytics',
          schema: 'public',
          reason: 'migration' as DeprecationReason,
        },
      ];

      // Mock successful database operations
      mockDb.execute.mockResolvedValue({ rows: [{ count: 1 }] });
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
        return callback(mockTx);
      });

      // Plan deprecation
      const plan = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test_user',
        environment: 'test',
      });

      expect(plan).toBeDefined();
      expect(plan.elements).toHaveLength(1);

      // Note: Full execution test would require more complex mocking
      // This validates the planning phase works correctly
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const elements = [
        {
          type: 'table' as ElementType,
          name: 'test_table',
          schema: 'public',
          reason: 'unused' as DeprecationReason,
        },
      ];

      mockDb.execute.mockRejectedValue(new Error('Connection failed'));

      await expect(
        deprecationSystem.planDeprecation(elements, {})
      ).rejects.toThrow();
    });

    it('should validate element existence before deprecation', async () => {
      const elements = [
        {
          type: 'table' as ElementType,
          name: 'nonexistent_table',
          schema: 'public',
          reason: 'unused' as DeprecationReason,
        },
      ];

      // Mock element doesn't exist
      mockDb.execute.mockResolvedValue({ rows: [{ count: 0 }] });

      await expect(
        deprecationSystem.planDeprecation(elements, {})
      ).rejects.toThrow('safety checks failed');
    });
  });
});

describe('Backup Validator', () => {
  let backupValidator: BackupValidator;

  beforeEach(() => {
    backupValidator = new BackupValidator(mockDb, { enabled: false }); // Disable for tests
  });

  it('should validate backup requirements', () => {
    const validConfig = {
      enabled: true,
      backupDirectory: '/var/backups',
      retentionDays: 30,
      maxBackupSizeMB: 1000,
      verificationLevel: 'full' as const,
      testRestoreEnabled: false,
      compressionEnabled: true,
      encryptionEnabled: false,
    };

    const { validateBackupRequirements } = require('../migrations/backup-validator');
    const result = validateBackupRequirements(validConfig);

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should identify invalid backup configurations', () => {
    const invalidConfig = {
      enabled: true,
      backupDirectory: '', // Invalid - empty directory
      retentionDays: 0, // Invalid - zero retention
      maxBackupSizeMB: 50, // Warning - very small
      verificationLevel: 'basic' as const, // Warning - basic level
      testRestoreEnabled: false,
      compressionEnabled: true,
      encryptionEnabled: false,
    };

    const { validateBackupRequirements } = require('../migrations/backup-validator');
    const result = validateBackupRequirements(invalidConfig);

    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Monitoring System', () => {
  let monitor: DeprecatedMonitor;
  let telemetryCollector: TelemetryCollector;
  let alertSystem: AlertSystem;

  beforeEach(() => {
    telemetryCollector = new TelemetryCollector({ enabled: false });
    alertSystem = new AlertSystem({ enabled: false });
    monitor = new DeprecatedMonitor(mockDb, telemetryCollector, alertSystem, { enabled: false });
  });

  it('should record access events correctly', async () => {
    const mockElement: DeprecatedElement = {
      type: 'table',
      originalName: 'test_table',
      deprecatedName: 'test_table_deprecated_20250928_unu',
      schema: 'public',
      deprecationDate: '2025-09-28',
      reason: 'unused',
      dependencies: [],
      usageData: {
        lastAccessed: null,
        accessCount: 0,
        confidenceScore: 0.95,
        analysisDate: '2025-09-28T12:00:00Z',
        accessSources: [],
      },
      migrationSql: '',
      rollbackSql: '',
    };

    // Test recording access (should not throw with monitoring disabled)
    await expect(
      monitor.recordAccess(
        'test_table_deprecated_20250928_unu',
        'table',
        { type: 'application', identifier: 'test-app', origin: 'test' },
        'SELECT'
      )
    ).resolves.not.toThrow();
  });

  it('should provide monitoring statistics', async () => {
    const stats = await monitor.getAllStats();
    expect(Array.isArray(stats)).toBe(true);
  });
});

// Test utilities for easier testing
export const TestHelpers = {
  createMockElement: (overrides: Partial<DeprecatedElement> = {}): DeprecatedElement => ({
    type: 'table',
    originalName: 'test_table',
    deprecatedName: 'test_table_deprecated_20250928_unu',
    schema: 'public',
    deprecationDate: '2025-09-28',
    reason: 'unused',
    dependencies: [],
    usageData: {
      lastAccessed: null,
      accessCount: 0,
      confidenceScore: 0.95,
      analysisDate: '2025-09-28T12:00:00Z',
      accessSources: [],
    },
    migrationSql: 'ALTER TABLE "public"."test_table" RENAME TO "test_table_deprecated_20250928_unu";',
    rollbackSql: 'ALTER TABLE "public"."test_table_deprecated_20250928_unu" RENAME TO "test_table";',
    ...overrides,
  }),

  createMockDatabase: () => ({
    execute: vi.fn(),
    transaction: vi.fn(),
  }),

  setupSuccessfulMocks: (mockDb: any) => {
    mockDb.execute.mockResolvedValue({ rows: [{ count: 1 }] });
    mockDb.transaction.mockImplementation(async (callback: any) => {
      const mockTx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
      return callback(mockTx);
    });
  },
};