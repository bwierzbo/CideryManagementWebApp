/**
 * Database Migration and Deprecation System Tests
 *
 * Comprehensive testing of database safety system, migration procedures,
 * and rollback capabilities.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import { DeprecationSystem } from '../../../packages/db/src/migrations/deprecation-system';
import { DeprecatedMonitor } from '../../../packages/db/src/monitoring/deprecated-monitor';
import { RollbackManager } from '../../../packages/db/src/migrations/rollback-manager';
import { performSafetyChecks } from '../../../packages/db/src/migrations/safety-checks';
import { BackupValidator } from '../../../packages/db/src/migrations/backup-validator';

describe('Database Migration and Deprecation System', () => {
  let testDb: NodePgDatabase<any>;
  let testClient: Client;
  let deprecationSystem: DeprecationSystem;
  let monitor: DeprecatedMonitor;
  let rollbackManager: RollbackManager;
  let backupValidator: BackupValidator;

  const TEST_SCHEMA = 'cleanup_test';
  const TEST_TABLES = ['test_table_1', 'test_table_2', 'test_table_unused'];

  beforeAll(async () => {
    // Set up test database connection
    testClient = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/test_cleanup',
    });

    await testClient.connect();

    // Create test schema
    await testClient.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);

    // Initialize system components
    // Note: In real implementation, these would use proper dependency injection
    monitor = new DeprecatedMonitor(testDb);
    rollbackManager = new RollbackManager(testDb);
    backupValidator = new BackupValidator(testDb);
    deprecationSystem = new DeprecationSystem(testDb, monitor, rollbackManager);
  });

  afterAll(async () => {
    // Clean up test schema
    await testClient.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await testClient.end();
  });

  beforeEach(async () => {
    // Create fresh test tables for each test
    await createTestTables();
  });

  describe('Deprecation System Core Functionality', () => {
    it('should plan deprecation migration with safety checks', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
        reason: 'Test deprecation',
      });

      expect(migration).toBeDefined();
      expect(migration.id).toMatch(/^dep_\d{14}_\w{6}$/);
      expect(migration.phase).toBe('planning');
      expect(migration.elements).toHaveLength(1);
      expect(migration.elements[0].originalName).toBe('test_table_unused');
      expect(migration.elements[0].deprecatedName).toMatch(/^test_table_unused_deprecated_\d{8}_unused$/);
      expect(migration.safetyChecks.every(check => check.passed)).toBe(true);
    });

    it('should execute deprecation migration successfully', async () => {
      // First plan the migration
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      // Execute the migration
      await deprecationSystem.executeDeprecation(migration.id);

      // Verify the table was renamed
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      `;

      const originalExists = await testClient.query(checkQuery, [TEST_SCHEMA, 'test_table_unused']);
      expect(parseInt(originalExists.rows[0].count)).toBe(0);

      const deprecatedExists = await testClient.query(checkQuery, [TEST_SCHEMA, migration.elements[0].deprecatedName]);
      expect(parseInt(deprecatedExists.rows[0].count)).toBe(1);
    });

    it('should rollback migration successfully', async () => {
      // Plan and execute migration
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Rollback the migration
      await deprecationSystem.rollbackMigration(migration.id);

      // Verify the table was restored
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      `;

      const originalExists = await testClient.query(checkQuery, [TEST_SCHEMA, 'test_table_unused']);
      expect(parseInt(originalExists.rows[0].count)).toBe(1);

      const deprecatedExists = await testClient.query(checkQuery, [TEST_SCHEMA, migration.elements[0].deprecatedName]);
      expect(parseInt(deprecatedExists.rows[0].count)).toBe(0);
    });
  });

  describe('Safety Checks and Validation', () => {
    it('should detect and prevent unsafe deprecations', async () => {
      // Create a table with foreign key dependencies
      await testClient.query(`
        CREATE TABLE ${TEST_SCHEMA}.parent_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        )
      `);

      await testClient.query(`
        CREATE TABLE ${TEST_SCHEMA}.child_table (
          id SERIAL PRIMARY KEY,
          parent_id INTEGER REFERENCES ${TEST_SCHEMA}.parent_table(id),
          data VARCHAR(255)
        )
      `);

      const elements = [
        {
          type: 'table' as const,
          name: 'parent_table',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      // This should fail safety checks due to foreign key dependency
      await expect(async () => {
        await deprecationSystem.planDeprecation(elements, {
          createdBy: 'test-system',
          environment: 'test',
        });
      }).rejects.toThrow(/Safety checks failed/);
    });

    it('should validate element existence before deprecation', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'nonexistent_table',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      await expect(async () => {
        await deprecationSystem.planDeprecation(elements, {
          createdBy: 'test-system',
          environment: 'test',
        });
      }).rejects.toThrow();
    });

    it('should enforce naming convention constraints', async () => {
      // Test with a table name that would violate PostgreSQL identifier length limits
      const longTableName = 'a'.repeat(60); // PostgreSQL limit is 63 characters

      await testClient.query(`
        CREATE TABLE ${TEST_SCHEMA}."${longTableName}" (
          id SERIAL PRIMARY KEY
        )
      `);

      const elements = [
        {
          type: 'table' as const,
          name: longTableName,
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      // This should handle naming convention gracefully
      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      expect(migration.elements[0].deprecatedName.length).toBeLessThanOrEqual(63);
    });
  });

  describe('Monitoring and Telemetry', () => {
    it('should start monitoring deprecated elements', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Verify monitoring was started
      const monitoringStatus = await monitor.getElementStatus(migration.elements[0]);
      expect(monitoringStatus.isActive).toBe(true);
      expect(monitoringStatus.startDate).toBeDefined();
    });

    it('should detect access to deprecated elements', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Simulate access to deprecated table
      const deprecatedName = migration.elements[0].deprecatedName;
      await testClient.query(`SELECT COUNT(*) FROM ${TEST_SCHEMA}."${deprecatedName}"`);

      // Check if access was detected
      const accessEvents = await monitor.getAccessEvents(migration.elements[0]);
      expect(accessEvents.length).toBeGreaterThan(0);
      expect(accessEvents[0].queryType).toBe('SELECT');
    });

    it('should generate alerts for deprecated element access', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Configure alert for any access
      await monitor.configureAlert(migration.elements[0], {
        threshold: 1,
        timeWindow: 60, // 1 minute
        severity: 'warning',
      });

      // Simulate access
      const deprecatedName = migration.elements[0].deprecatedName;
      await testClient.query(`SELECT COUNT(*) FROM ${TEST_SCHEMA}."${deprecatedName}"`);

      // Check for generated alerts
      const alerts = await monitor.getAlerts(migration.elements[0]);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('warning');
    });
  });

  describe('Backup and Recovery', () => {
    it('should create backup before deprecation', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
        backupLocation: '/tmp/test-backup',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Verify backup was created
      const backupExists = await backupValidator.validateBackup(migration.metadata.backupLocation);
      expect(backupExists.isValid).toBe(true);
      expect(backupExists.containsTargetElements).toBe(true);
    });

    it('should validate backup integrity', async () => {
      const backupPath = '/tmp/test-backup-integrity';

      // Create a test backup
      await backupValidator.createBackup(TEST_SCHEMA, backupPath);

      // Validate the backup
      const validation = await backupValidator.validateBackup(backupPath);

      expect(validation.isValid).toBe(true);
      expect(validation.schemaMatches).toBe(true);
      expect(validation.dataIntegrityPassed).toBe(true);
    });

    it('should restore from backup successfully', async () => {
      const backupPath = '/tmp/test-backup-restore';

      // Insert test data
      await testClient.query(`
        INSERT INTO ${TEST_SCHEMA}.test_table_1 (name, data)
        VALUES ('test-record', 'test-data')
      `);

      // Create backup
      await backupValidator.createBackup(TEST_SCHEMA, backupPath);

      // Modify data
      await testClient.query(`DELETE FROM ${TEST_SCHEMA}.test_table_1`);

      // Restore from backup
      await backupValidator.restoreFromBackup(backupPath, TEST_SCHEMA);

      // Verify data was restored
      const result = await testClient.query(`
        SELECT COUNT(*) as count FROM ${TEST_SCHEMA}.test_table_1
        WHERE name = 'test-record'
      `);

      expect(parseInt(result.rows[0].count)).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk deprecation operations efficiently', async () => {
      // Create multiple test tables
      const tableCount = 10;
      const tables = [];

      for (let i = 0; i < tableCount; i++) {
        const tableName = `bulk_test_table_${i}`;
        await testClient.query(`
          CREATE TABLE ${TEST_SCHEMA}.${tableName} (
            id SERIAL PRIMARY KEY,
            data VARCHAR(255)
          )
        `);
        tables.push(tableName);
      }

      const elements = tables.map(name => ({
        type: 'table' as const,
        name,
        schema: TEST_SCHEMA,
        reason: 'unused' as const,
      }));

      const startTime = performance.now();

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete bulk operation within reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds

      // Verify all tables were deprecated
      for (const element of migration.elements) {
        const checkQuery = `
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        `;

        const deprecatedExists = await testClient.query(checkQuery, [TEST_SCHEMA, element.deprecatedName]);
        expect(parseInt(deprecatedExists.rows[0].count)).toBe(1);
      }
    });

    it('should measure migration performance impact', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'performance' as const,
        },
      ];

      // Measure baseline query performance
      const baselineStart = performance.now();
      await testClient.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = $1`, [TEST_SCHEMA]);
      const baselineTime = performance.now() - baselineStart;

      // Execute migration
      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Measure post-migration query performance
      const postMigrationStart = performance.now();
      await testClient.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = $1`, [TEST_SCHEMA]);
      const postMigrationTime = performance.now() - postMigrationStart;

      // Performance impact should be minimal
      const performanceImpact = ((postMigrationTime - baselineTime) / baselineTime) * 100;
      expect(Math.abs(performanceImpact)).toBeLessThan(10); // Less than 10% impact
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle migration failures gracefully', async () => {
      // Create a scenario that will cause migration failure
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_1',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      // Simulate failure by dropping the table before migration
      await testClient.query(`DROP TABLE ${TEST_SCHEMA}.test_table_1`);

      // Migration should fail but handle it gracefully
      await expect(async () => {
        await deprecationSystem.executeDeprecation(migration.id);
      }).rejects.toThrow();

      // Verify system is in a consistent state
      const migrationStatus = await deprecationSystem.getMigrationStatus(migration.id);
      expect(migrationStatus.phase).toBe('rolled_back');
    });

    it('should recover from rollback failures', async () => {
      const elements = [
        {
          type: 'table' as const,
          name: 'test_table_unused',
          schema: TEST_SCHEMA,
          reason: 'unused' as const,
        },
      ];

      const migration = await deprecationSystem.planDeprecation(elements, {
        createdBy: 'test-system',
        environment: 'test',
      });

      await deprecationSystem.executeDeprecation(migration.id);

      // Simulate rollback failure scenario
      const deprecatedName = migration.elements[0].deprecatedName;
      await testClient.query(`DROP TABLE ${TEST_SCHEMA}."${deprecatedName}"`);

      // Rollback should handle missing table gracefully
      await expect(async () => {
        await deprecationSystem.rollbackMigration(migration.id);
      }).rejects.toThrow();

      // System should provide recovery options
      const recoveryOptions = await deprecationSystem.getRecoveryOptions(migration.id);
      expect(recoveryOptions.length).toBeGreaterThan(0);
      expect(recoveryOptions.some(option => option.type === 'restore_from_backup')).toBe(true);
    });
  });

  // Helper function to create test tables
  async function createTestTables() {
    for (const tableName of TEST_TABLES) {
      await testClient.query(`
        DROP TABLE IF EXISTS ${TEST_SCHEMA}.${tableName}
      `);

      await testClient.query(`
        CREATE TABLE ${TEST_SCHEMA}.${tableName} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert some test data
      await testClient.query(`
        INSERT INTO ${TEST_SCHEMA}.${tableName} (name, data)
        VALUES
          ('test-1', 'Sample data 1'),
          ('test-2', 'Sample data 2')
      `);
    }
  }
});