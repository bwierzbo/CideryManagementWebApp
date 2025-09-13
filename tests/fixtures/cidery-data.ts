/**
 * Cidery domain-specific test fixtures
 */

export const testVendors = [
  {
    id: 'vendor-apple-valley',
    name: 'Apple Valley Orchards',
    contactInfo: 'contact@applevalley.com',
    isActive: true
  },
  {
    id: 'vendor-mountain-fruit',
    name: 'Mountain Fruit Co.',
    contactInfo: 'sales@mountainfruit.com',
    isActive: true
  },
  {
    id: 'vendor-heritage-apples',
    name: 'Heritage Apple Farm',
    contactInfo: 'info@heritageapples.com',
    isActive: false
  }
]

export const testPurchases = [
  {
    id: 'purchase-001',
    vendorId: 'vendor-apple-valley',
    purchaseDate: new Date('2024-09-01'),
    totalAmount: 1500.00,
    notes: 'Honeycrisp apples - 500kg'
  },
  {
    id: 'purchase-002',
    vendorId: 'vendor-mountain-fruit',
    purchaseDate: new Date('2024-09-15'),
    totalAmount: 800.50,
    notes: 'Mixed variety apples - 300kg'
  }
]

export const testBatches = [
  {
    id: 'batch-hc-001',
    name: 'Honeycrisp Batch #1',
    batchNumber: 'HC-2024-001',
    startDate: new Date('2024-09-02'),
    targetAbv: 6.5,
    status: 'fermenting'
  },
  {
    id: 'batch-mixed-001',
    name: 'Mixed Variety Batch #1',
    batchNumber: 'MV-2024-001',
    startDate: new Date('2024-09-16'),
    targetAbv: 5.8,
    status: 'pressing'
  }
]

export const testMeasurements = [
  {
    id: 'measurement-001',
    batchId: 'batch-hc-001',
    measurementDate: new Date('2024-09-02'),
    specificGravity: 1.050,
    temperature: 20,
    ph: 3.5,
    notes: 'Initial gravity reading'
  },
  {
    id: 'measurement-002',
    batchId: 'batch-hc-001',
    measurementDate: new Date('2024-09-16'),
    specificGravity: 1.010,
    temperature: 18,
    ph: 3.3,
    notes: 'Final gravity reading'
  }
]

export const testUsers = [
  {
    id: 'user-admin',
    email: 'admin@cidery.com',
    name: 'Admin User',
    role: 'Admin' as const,
    isActive: true
  },
  {
    id: 'user-operator',
    email: 'operator@cidery.com',
    name: 'Operator User',
    role: 'Operator' as const,
    isActive: true
  },
  {
    id: 'user-viewer',
    email: 'viewer@cidery.com',
    name: 'Viewer User',
    role: 'Viewer' as const,
    isActive: true
  }
]

export const testRefValues = [
  {
    category: 'apple_variety',
    code: 'honeycrisp',
    display: 'Honeycrisp',
    sortOrder: 1,
    isActive: true
  },
  {
    category: 'apple_variety',
    code: 'granny_smith',
    display: 'Granny Smith',
    sortOrder: 2,
    isActive: true
  },
  {
    category: 'package_type',
    code: '750ml_bottle',
    display: '750ml Bottle',
    sortOrder: 1,
    isActive: true
  },
  {
    category: 'package_type',
    code: '500ml_bottle',
    display: '500ml Bottle',
    sortOrder: 2,
    isActive: true
  }
]