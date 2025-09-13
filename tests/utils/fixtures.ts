/**
 * Test data fixtures for the Cidery Management App
 */

export interface TestUser {
  id: string
  email: string
  name: string
  role: 'Admin' | 'Operator' | 'Viewer'
  passwordHash: string
}

export interface TestVendor {
  id: string
  name: string
  contactInfo: string
  isActive: boolean
}

export interface TestPurchase {
  id: string
  vendorId: string
  purchaseDate: Date
  totalAmount: number
  notes?: string
}

/**
 * Generate test user data
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: `test-${Math.random().toString(36).substr(2, 5)}@example.com`,
    name: `Test User ${Math.random().toString(36).substr(2, 5)}`,
    role: 'Operator',
    passwordHash: '$2a$10$test.hash.for.testing.purposes.only',
    ...overrides
  }
}

/**
 * Generate test vendor data
 */
export function createTestVendor(overrides: Partial<TestVendor> = {}): TestVendor {
  return {
    id: `vendor-${Math.random().toString(36).substr(2, 9)}`,
    name: `Test Vendor ${Math.random().toString(36).substr(2, 5)}`,
    contactInfo: `contact-${Math.random().toString(36).substr(2, 5)}@vendor.com`,
    isActive: true,
    ...overrides
  }
}

/**
 * Generate test purchase data
 */
export function createTestPurchase(overrides: Partial<TestPurchase> = {}): TestPurchase {
  return {
    id: `purchase-${Math.random().toString(36).substr(2, 9)}`,
    vendorId: overrides.vendorId || `vendor-${Math.random().toString(36).substr(2, 9)}`,
    purchaseDate: new Date(),
    totalAmount: Math.floor(Math.random() * 1000) + 100,
    notes: 'Test purchase notes',
    ...overrides
  }
}

/**
 * Generate ABV calculation test data
 */
export function createTestAbvData() {
  return {
    originalGravity: 1.050,
    finalGravity: 1.010,
    expectedAbv: 5.25
  }
}

/**
 * Generate yield calculation test data
 */
export function createTestYieldData() {
  return {
    inputWeight: 1000, // kg
    outputVolume: 750, // L
    expectedYield: 0.75
  }
}