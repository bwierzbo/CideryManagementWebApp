import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from 'dotenv';
import * as schema from '../../../packages/db/src/schema';
import bcrypt from 'bcryptjs';

// Load environment variables
config({ path: '.env.local' });

/**
 * Test data factory for creating entities in E2E tests
 */
export class TestDataFactory {
  private db: any;
  private pool: Pool;

  constructor() {
    const testDbUrl = process.env.TEST_DATABASE_URL ||
      'postgresql://localhost:5432/cidery_management_test';

    this.pool = new Pool({
      connectionString: testDbUrl,
      max: 5,
      ssl: false
    });

    this.db = drizzle(this.pool, { schema });
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Create a test user
   */
  async createUser(overrides: Partial<{
    email: string;
    name: string;
    password: string;
    role: 'admin' | 'operator' | 'viewer';
  }> = {}): Promise<any> {
    const defaultUser = {
      email: `test-user-${Date.now()}@example.com`,
      name: 'Test User',
      password: 'password',
      role: 'operator' as const
    };

    const userData = { ...defaultUser, ...overrides };
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const [user] = await this.db.insert(schema.users).values({
      email: userData.email,
      name: userData.name,
      passwordHash,
      role: userData.role
    }).returning();

    return { ...user, password: userData.password };
  }

  /**
   * Create a test vendor
   */
  async createVendor(overrides: Partial<{
    name: string;
    contactInfo: any;
    isActive: boolean;
  }> = {}): Promise<any> {
    const defaultVendor = {
      name: `Test Vendor ${Date.now()}`,
      contactInfo: {
        phone: '555-0123',
        email: 'test@vendor.com',
        address: '123 Test Street, Test City, TC 12345'
      },
      isActive: true
    };

    const vendorData = { ...defaultVendor, ...overrides };

    const [vendor] = await this.db.insert(schema.vendors).values(vendorData).returning();
    return vendor;
  }

  /**
   * Create a test apple variety
   */
  async createAppleVariety(overrides: Partial<{
    name: string;
    description: string;
    typicalBrix: string;
    notes: string;
  }> = {}): Promise<any> {
    const defaultVariety = {
      name: `Test Apple ${Date.now()}`,
      description: 'Test apple variety for E2E testing',
      typicalBrix: '14.0',
      notes: 'Created for testing purposes'
    };

    const varietyData = { ...defaultVariety, ...overrides };

    const [variety] = await this.db.insert(schema.appleVarieties).values(varietyData).returning();
    return variety;
  }

  /**
   * Create a test purchase
   */
  async createPurchase(vendorId: string, overrides: Partial<{
    purchaseDate: Date;
    totalCost: string;
    invoiceNumber: string;
    notes: string;
  }> = {}): Promise<any> {
    const defaultPurchase = {
      vendorId,
      purchaseDate: new Date(),
      totalCost: '1000.00',
      invoiceNumber: `TEST-${Date.now()}`,
      notes: 'Test purchase for E2E testing'
    };

    const purchaseData = { ...defaultPurchase, ...overrides };

    const [purchase] = await this.db.insert(schema.purchases).values(purchaseData).returning();
    return purchase;
  }

  /**
   * Create a test purchase item
   */
  async createPurchaseItem(
    purchaseId: string,
    appleVarietyId: string,
    overrides: Partial<{
      quantity: string;
      unit: string;
      pricePerUnit: string;
      totalCost: string;
      quantityKg: string;
      notes: string;
    }> = {}
  ): Promise<any> {
    const defaultItem = {
      purchaseId,
      appleVarietyId,
      quantity: '100.0',
      unit: 'kg',
      pricePerUnit: '2.00',
      totalCost: '200.00',
      quantityKg: '100.0',
      quantityL: null,
      notes: 'Test purchase item'
    };

    const itemData = { ...defaultItem, ...overrides };

    const [item] = await this.db.insert(schema.purchaseItems).values(itemData).returning();
    return item;
  }

  /**
   * Create a test vessel
   */
  async createVessel(overrides: Partial<{
    name: string;
    type: 'fermenter' | 'conditioning_tank' | 'bright_tank' | 'storage_tank';
    capacityL: string;
    status: 'available' | 'in_use' | 'cleaning' | 'maintenance';
    location: string;
    notes: string;
  }> = {}): Promise<any> {
    const defaultVessel = {
      name: `Test Vessel ${Date.now()}`,
      type: 'fermenter' as const,
      capacityL: '500.0',
      status: 'available' as const,
      location: 'Test Room',
      notes: 'Test vessel for E2E testing'
    };

    const vesselData = { ...defaultVessel, ...overrides };

    const [vessel] = await this.db.insert(schema.vessels).values(vesselData).returning();
    return vessel;
  }

  /**
   * Create a test batch
   */
  async createBatch(vesselId: string, overrides: Partial<{
    batchNumber: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
    startDate: Date;
    targetCompletionDate: Date;
    initialVolumeL: string;
    currentVolumeL: string;
    targetAbv: string;
    actualAbv: string;
    notes: string;
  }> = {}): Promise<any> {
    const timestamp = Date.now();
    const defaultBatch = {
      batchNumber: `B-TEST-${timestamp}`,
      status: 'active' as const,
      vesselId,
      startDate: new Date(),
      targetCompletionDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      initialVolumeL: '400.0',
      currentVolumeL: '390.0',
      targetAbv: '6.0',
      actualAbv: '3.5',
      notes: 'Test batch for E2E testing'
    };

    const batchData = { ...defaultBatch, ...overrides };

    const [batch] = await this.db.insert(schema.batches).values(batchData).returning();
    return batch;
  }

  /**
   * Create a complete test scenario with related entities
   */
  async createCompleteTestScenario(): Promise<{
    vendor: any;
    appleVariety: any;
    purchase: any;
    purchaseItem: any;
    vessel: any;
    batch: any;
  }> {
    // Create base entities
    const vendor = await this.createVendor();
    const appleVariety = await this.createAppleVariety();
    const vessel = await this.createVessel();

    // Create purchase and related entities
    const purchase = await this.createPurchase(vendor.id);
    const purchaseItem = await this.createPurchaseItem(purchase.id, appleVariety.id);

    // Create batch
    const batch = await this.createBatch(vessel.id);

    return {
      vendor,
      appleVariety,
      purchase,
      purchaseItem,
      vessel,
      batch
    };
  }

  /**
   * Clean up test data (optional - global setup handles this)
   */
  async cleanupTestData(): Promise<void> {
    // This could delete specific test data if needed
    // For now, global setup handles complete cleanup
  }

  /**
   * Create test data for role-based access testing
   */
  async createRoleTestData(): Promise<{
    admin: any;
    operator: any;
    viewer: any;
    vendor: any;
    batch: any;
  }> {
    const admin = await this.createUser({ role: 'admin', email: 'test-admin-unique@example.com' });
    const operator = await this.createUser({ role: 'operator', email: 'test-operator-unique@example.com' });
    const viewer = await this.createUser({ role: 'viewer', email: 'test-viewer-unique@example.com' });

    const scenario = await this.createCompleteTestScenario();

    return {
      admin,
      operator,
      viewer,
      vendor: scenario.vendor,
      batch: scenario.batch
    };
  }

  /**
   * Create test data for workflow testing
   */
  async createWorkflowTestData(count: number = 1): Promise<Array<{
    vendor: any;
    appleVariety: any;
    purchase: any;
    purchaseItems: any[];
    vessel: any;
    batch: any;
  }>> {
    const scenarios = [];

    for (let i = 0; i < count; i++) {
      const vendor = await this.createVendor({ name: `Workflow Vendor ${i + 1}` });
      const appleVariety = await this.createAppleVariety({ name: `Workflow Apple ${i + 1}` });
      const vessel = await this.createVessel({ name: `Workflow Vessel ${i + 1}` });

      const purchase = await this.createPurchase(vendor.id, {
        invoiceNumber: `WF-${Date.now()}-${i}`
      });

      // Create multiple purchase items for more realistic testing
      const purchaseItems = [];
      for (let j = 0; j < 2; j++) {
        const item = await this.createPurchaseItem(
          purchase.id,
          appleVariety.id,
          {
            quantity: `${(j + 1) * 50}.0`,
            totalCost: `${(j + 1) * 100}.00`
          }
        );
        purchaseItems.push(item);
      }

      const batch = await this.createBatch(vessel.id, {
        batchNumber: `WF-B-${Date.now()}-${i}`
      });

      scenarios.push({
        vendor,
        appleVariety,
        purchase,
        purchaseItems,
        vessel,
        batch
      });
    }

    return scenarios;
  }
}