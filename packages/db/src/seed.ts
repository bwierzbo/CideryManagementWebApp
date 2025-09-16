import { db } from './client'
import {
  users,
  vendors,
  appleVarieties,
  vendorVarieties,
  purchases,
  purchaseItems,
  pressRuns,
  pressItems,
  vessels,
  batches,
  batchIngredients,
  batchMeasurements,
  packages,
  inventory,
  inventoryTransactions,
  batchCosts,
  cogsItems
} from './schema'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🌱 Seeding database...')
  
  try {
    // Seed users
    console.log('👥 Seeding users...')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const seedUsers = await db.insert(users).values([
      {
        email: 'admin@example.com',
        name: 'System Administrator',
        passwordHash: hashedPassword,
        role: 'admin'
      },
      {
        email: 'operator@example.com', 
        name: 'Production Operator',
        passwordHash: await bcrypt.hash('operator123', 10),
        role: 'operator'
      }
    ]).returning()
    console.log(`✅ Seeded ${seedUsers.length} users`)

    // Seed vendors
    console.log('📦 Seeding vendors...')
    const seedVendors = await db.insert(vendors).values([
      {
        name: 'Mountain View Orchards',
        contactInfo: {
          phone: '555-0123',
          email: 'orders@mountainview.com',
          address: '123 Orchard Lane, Apple Valley, NY 12345'
        },
        isActive: true
      },
      {
        name: 'Sunrise Apple Farm',
        contactInfo: {
          phone: '555-0456',
          email: 'sales@sunriseapple.com',
          address: '456 Farm Road, Cider Springs, VT 05678'
        },
        isActive: true
      },
      {
        name: 'Heritage Fruit Co.',
        contactInfo: {
          phone: '555-0789',
          email: 'info@heritagefruit.com',
          address: '789 Heritage Way, Old Town, MA 01234'
        },
        isActive: true
      }
    ]).returning()

    // Seed apple varieties
    console.log('🍎 Seeding apple varieties...')
    const seedVarieties = await db.insert(appleVarieties).values([
      {
        name: 'Honeycrisp',
        ciderCategory: 'sweet',
        tannin: 'low',
        acid: 'medium',
        sugarBrix: 'medium-high',
        harvestWindow: 'Mid',
        varietyNotes: 'High sugar content, mild acidity'
      },
      {
        name: 'Granny Smith',
        ciderCategory: 'sharp',
        tannin: 'low',
        acid: 'high',
        sugarBrix: 'medium',
        harvestWindow: 'Late',
        varietyNotes: 'High acid, balances sweeter varieties'
      },
      {
        name: 'Gala',
        ciderCategory: 'sweet',
        tannin: 'low',
        acid: 'medium',
        sugarBrix: 'medium',
        harvestWindow: 'Early-Mid',
        varietyNotes: 'Moderate sugar, subtle flavor'
      },
      {
        name: 'Fuji',
        ciderCategory: 'sweet',
        tannin: 'low',
        acid: 'low-medium',
        sugarBrix: 'high',
        harvestWindow: 'Late',
        varietyNotes: 'Highest sugar content in our varieties'
      },
      {
        name: 'Northern Spy',
        ciderCategory: 'bittersweet',
        tannin: 'medium',
        acid: 'medium',
        sugarBrix: 'medium-high',
        harvestWindow: 'Mid-Late',
        varietyNotes: 'Classic cider variety, well-balanced'
      },
      {
        name: 'Rhode Island Greening',
        ciderCategory: 'sharp',
        tannin: 'low-medium',
        acid: 'high',
        sugarBrix: 'medium',
        harvestWindow: 'Mid',
        varietyNotes: 'Traditional New England cider apple'
      }
    ]).returning()

    // Seed vendor varieties (link vendors to the varieties they can supply)
    console.log('🔗 Seeding vendor varieties...')
    const seedVendorVarieties = await db.insert(vendorVarieties).values([
      // Mountain View Orchards (vendor 0) - offers Honeycrisp, Granny Smith, Gala
      {
        vendorId: seedVendors[0].id,
        varietyId: seedVarieties[0].id, // Honeycrisp
        notes: 'Premium grade, excellent for single varietal ciders'
      },
      {
        vendorId: seedVendors[0].id,
        varietyId: seedVarieties[1].id, // Granny Smith
        notes: 'Consistent quality, great for blending'
      },
      {
        vendorId: seedVendors[0].id,
        varietyId: seedVarieties[2].id, // Gala
        notes: 'Mild flavor, good for entry-level ciders'
      },
      // Sunrise Apple Farm (vendor 1) - offers Gala, Fuji, Northern Spy
      {
        vendorId: seedVendors[1].id,
        varietyId: seedVarieties[2].id, // Gala
        notes: 'Bulk quantities available'
      },
      {
        vendorId: seedVendors[1].id,
        varietyId: seedVarieties[3].id, // Fuji
        notes: 'High sugar content, perfect for sweet ciders'
      },
      {
        vendorId: seedVendors[1].id,
        varietyId: seedVarieties[4].id, // Northern Spy
        notes: 'Traditional variety, small batches'
      },
      // Heritage Fruit Co. (vendor 2) - offers Northern Spy, Rhode Island Greening, Honeycrisp
      {
        vendorId: seedVendors[2].id,
        varietyId: seedVarieties[4].id, // Northern Spy
        notes: 'Heirloom quality, premium pricing'
      },
      {
        vendorId: seedVendors[2].id,
        varietyId: seedVarieties[5].id, // Rhode Island Greening
        notes: 'Heritage variety specialist'
      },
      {
        vendorId: seedVendors[2].id,
        varietyId: seedVarieties[0].id, // Honeycrisp
        notes: 'Organic certification available'
      }
    ]).returning()

    // Seed purchases (3 purchases over the last 3 months)
    console.log('💰 Seeding purchases...')
    const seedPurchases = await db.insert(purchases).values([
      {
        vendorId: seedVendors[0].id,
        purchaseDate: new Date('2024-09-01'),
        totalCost: '2450.00',
        invoiceNumber: 'MVO-2024-001',
        notes: 'First fall harvest delivery'
      },
      {
        vendorId: seedVendors[1].id,
        purchaseDate: new Date('2024-08-15'),
        totalCost: '1875.50',
        invoiceNumber: 'SAF-2024-027',
        notes: 'Early season varieties'
      },
      {
        vendorId: seedVendors[2].id,
        purchaseDate: new Date('2024-07-20'),
        totalCost: '3200.75',
        invoiceNumber: 'HFC-2024-112',
        notes: 'Premium heritage varieties'
      }
    ]).returning()

    // Seed purchase items with canonical unit conversions
    console.log('📋 Seeding purchase items...')
    const seedPurchaseItems = await db.insert(purchaseItems).values([
      // Purchase 1 items
      {
        purchaseId: seedPurchases[0].id,
        appleVarietyId: seedVarieties[0].id, // Honeycrisp
        quantity: '500.0',
        unit: 'kg',
        pricePerUnit: '2.50',
        totalCost: '1250.00',
        quantityKg: '500.0',
        quantityL: null,
        notes: 'Premium grade A apples'
      },
      {
        purchaseId: seedPurchases[0].id,
        appleVarietyId: seedVarieties[1].id, // Granny Smith
        quantity: '600.0',
        unit: 'kg',
        pricePerUnit: '2.00',
        totalCost: '1200.00',
        quantityKg: '600.0',
        quantityL: null,
        notes: 'Good for acid balance'
      },
      // Purchase 2 items
      {
        purchaseId: seedPurchases[1].id,
        appleVarietyId: seedVarieties[2].id, // Gala
        quantity: '750.0',
        unit: 'kg',
        pricePerUnit: '1.80',
        totalCost: '1350.00',
        quantityKg: '750.0',
        quantityL: null,
        notes: 'Bulk order discount applied'
      },
      {
        purchaseId: seedPurchases[1].id,
        appleVarietyId: seedVarieties[3].id, // Fuji
        quantity: '300.0',
        unit: 'kg',
        pricePerUnit: '1.75',
        totalCost: '525.50',
        quantityKg: '300.0',
        quantityL: null,
        notes: 'Small batch for testing'
      },
      // Purchase 3 items
      {
        purchaseId: seedPurchases[2].id,
        appleVarietyId: seedVarieties[4].id, // Northern Spy
        quantity: '800.0',
        unit: 'kg',
        pricePerUnit: '2.25',
        totalCost: '1800.00',
        quantityKg: '800.0',
        quantityL: null,
        notes: 'Heritage variety premium'
      },
      {
        purchaseId: seedPurchases[2].id,
        appleVarietyId: seedVarieties[5].id, // Rhode Island Greening
        quantity: '650.0',
        unit: 'kg',
        pricePerUnit: '2.15',
        totalCost: '1397.50',
        quantityKg: '650.0',
        quantityL: null,
        notes: 'Traditional cider apple'
      }
    ]).returning()

    // Seed press runs
    console.log('🏭 Seeding press runs...')
    const seedPressRuns = await db.insert(pressRuns).values([
      {
        runDate: new Date('2024-09-05'),
        notes: 'First major press run of the season',
        totalAppleProcessedKg: '1100.0',
        totalJuiceProducedL: '660.0',
        extractionRate: '0.6000'
      },
      {
        runDate: new Date('2024-08-20'),
        notes: 'Testing run with new varieties',
        totalAppleProcessedKg: '800.0',
        totalJuiceProducedL: '480.0',
        extractionRate: '0.6000'
      },
      {
        runDate: new Date('2024-07-25'),
        notes: 'Heritage varieties pressing',
        totalAppleProcessedKg: '1200.0',
        totalJuiceProducedL: '780.0',
        extractionRate: '0.6500'
      }
    ]).returning()

    // Seed press items
    console.log('🍎➡️🧃 Seeding press items...')
    const seedPressItems = await db.insert(pressItems).values([
      // Press Run 1
      {
        pressRunId: seedPressRuns[0].id,
        purchaseItemId: seedPurchaseItems[0].id, // Honeycrisp 500kg
        quantityUsedKg: '500.0',
        juiceProducedL: '300.0',
        brixMeasured: '14.8',
        notes: 'Excellent juice quality'
      },
      {
        pressRunId: seedPressRuns[0].id,
        purchaseItemId: seedPurchaseItems[1].id, // Granny Smith 600kg
        quantityUsedKg: '600.0',
        juiceProducedL: '360.0',
        brixMeasured: '12.5',
        notes: 'Good acid content'
      },
      // Press Run 2
      {
        pressRunId: seedPressRuns[1].id,
        purchaseItemId: seedPurchaseItems[2].id, // Gala 750kg
        quantityUsedKg: '500.0',
        juiceProducedL: '300.0',
        brixMeasured: '13.0',
        notes: 'Mild flavor profile'
      },
      {
        pressRunId: seedPressRuns[1].id,
        purchaseItemId: seedPurchaseItems[3].id, // Fuji 300kg
        quantityUsedKg: '300.0',
        juiceProducedL: '180.0',
        brixMeasured: '15.5',
        notes: 'Very sweet juice'
      },
      // Press Run 3
      {
        pressRunId: seedPressRuns[2].id,
        purchaseItemId: seedPurchaseItems[4].id, // Northern Spy 800kg
        quantityUsedKg: '700.0',
        juiceProducedL: '455.0',
        brixMeasured: '14.2',
        notes: 'Traditional cider character'
      },
      {
        pressRunId: seedPressRuns[2].id,
        purchaseItemId: seedPurchaseItems[5].id, // Rhode Island Greening 650kg
        quantityUsedKg: '500.0',
        juiceProducedL: '325.0',
        brixMeasured: '12.8',
        notes: 'Heritage variety excellence'
      }
    ]).returning()

    // Seed vessels
    console.log('🏺 Seeding vessels...')
    const seedVessels = await db.insert(vessels).values([
      {
        name: 'Tank A1',
        type: 'fermenter',
        capacityL: '1000.0',
        status: 'in_use',
        location: 'Fermentation Room 1',
        notes: 'Primary fermenter for large batches'
      },
      {
        name: 'Tank B2',
        type: 'fermenter',
        capacityL: '500.0',
        status: 'available',
        location: 'Fermentation Room 1',
        notes: 'Secondary fermenter for small batches'
      },
      {
        name: 'Conditioning Tank C1',
        type: 'conditioning_tank',
        capacityL: '800.0',
        status: 'available',
        location: 'Cellar',
        notes: 'For secondary fermentation and conditioning'
      },
      {
        name: 'Bright Tank D1',
        type: 'bright_tank',
        capacityL: '600.0',
        status: 'cleaning',
        location: 'Packaging Room',
        notes: 'Final conditioning before packaging'
      }
    ]).returning()

    // Seed batches
    console.log('🍺 Seeding batches...')
    const seedBatches = await db.insert(batches).values([
      {
        batchNumber: 'B-2024-001',
        status: 'active',
        vesselId: seedVessels[0].id,
        startDate: new Date('2024-09-10'),
        targetCompletionDate: new Date('2024-11-10'),
        initialVolumeL: '600.0',
        currentVolumeL: '590.0',
        targetAbv: '6.5',
        actualAbv: '4.2',
        notes: 'Honeycrisp/Granny Smith blend - primary fermentation'
      },
      {
        batchNumber: 'B-2024-002',
        status: 'completed',
        vesselId: null,
        startDate: new Date('2024-07-30'),
        targetCompletionDate: new Date('2024-09-30'),
        actualCompletionDate: new Date('2024-09-25'),
        initialVolumeL: '450.0',
        currentVolumeL: '435.0',
        targetAbv: '5.8',
        actualAbv: '5.9',
        notes: 'Gala/Fuji blend - completed and packaged'
      },
      {
        batchNumber: 'B-2024-003',
        status: 'active',
        vesselId: seedVessels[2].id,
        startDate: new Date('2024-08-05'),
        targetCompletionDate: new Date('2024-10-05'),
        initialVolumeL: '750.0',
        currentVolumeL: '720.0',
        targetAbv: '7.2',
        actualAbv: '6.1',
        notes: 'Heritage blend - secondary fermentation'
      }
    ]).returning()

    // Seed batch ingredients
    console.log('🥤 Seeding batch ingredients...')
    await db.insert(batchIngredients).values([
      // Batch 1 ingredients
      {
        batchId: seedBatches[0].id,
        pressItemId: seedPressItems[0].id, // Honeycrisp juice
        volumeUsedL: '300.0',
        brixAtUse: '14.8',
        notes: 'Base juice for sweetness'
      },
      {
        batchId: seedBatches[0].id,
        pressItemId: seedPressItems[1].id, // Granny Smith juice
        volumeUsedL: '300.0',
        brixAtUse: '12.5',
        notes: 'Added for acidity balance'
      },
      // Batch 2 ingredients
      {
        batchId: seedBatches[1].id,
        pressItemId: seedPressItems[2].id, // Gala juice
        volumeUsedL: '250.0',
        brixAtUse: '13.0',
        notes: 'Mild base for blend'
      },
      {
        batchId: seedBatches[1].id,
        pressItemId: seedPressItems[3].id, // Fuji juice
        volumeUsedL: '180.0',
        brixAtUse: '15.5',
        notes: 'Added sweetness and complexity'
      },
      // Batch 3 ingredients
      {
        batchId: seedBatches[2].id,
        pressItemId: seedPressItems[4].id, // Northern Spy juice
        volumeUsedL: '455.0',
        brixAtUse: '14.2',
        notes: 'Traditional cider base'
      },
      {
        batchId: seedBatches[2].id,
        pressItemId: seedPressItems[5].id, // Rhode Island Greening juice
        volumeUsedL: '295.0',
        brixAtUse: '12.8',
        notes: 'Heritage variety character'
      }
    ])

    // Seed batch measurements
    console.log('📊 Seeding batch measurements...')
    await db.insert(batchMeasurements).values([
      // Batch 1 measurements
      {
        batchId: seedBatches[0].id,
        measurementDate: new Date('2024-09-10'),
        specificGravity: '1.065',
        abv: '0.0',
        ph: '3.8',
        totalAcidity: '0.65',
        temperature: '20.5',
        volumeL: '600.0',
        notes: 'Initial measurements at pitch',
        takenBy: 'John Smith'
      },
      {
        batchId: seedBatches[0].id,
        measurementDate: new Date('2024-09-17'),
        specificGravity: '1.020',
        abv: '4.2',
        ph: '3.7',
        totalAcidity: '0.68',
        temperature: '18.2',
        volumeL: '590.0',
        notes: 'Active fermentation, good progress',
        takenBy: 'John Smith'
      },
      // Batch 2 measurements (completed)
      {
        batchId: seedBatches[1].id,
        measurementDate: new Date('2024-07-30'),
        specificGravity: '1.058',
        abv: '0.0',
        ph: '3.9',
        totalAcidity: '0.55',
        temperature: '21.0',
        volumeL: '450.0',
        notes: 'Initial measurements',
        takenBy: 'Sarah Johnson'
      },
      {
        batchId: seedBatches[1].id,
        measurementDate: new Date('2024-09-25'),
        specificGravity: '0.995',
        abv: '5.9',
        ph: '3.6',
        totalAcidity: '0.62',
        temperature: '16.8',
        volumeL: '435.0',
        notes: 'Final measurements before packaging',
        takenBy: 'Sarah Johnson'
      }
    ])

    // Seed packages (only for completed batch)
    console.log('📦 Seeding packages...')
    const seedPackages = await db.insert(packages).values([
      {
        batchId: seedBatches[1].id, // Completed batch
        packageDate: new Date('2024-09-26'),
        volumePackagedL: '420.0',
        bottleSize: '750ml',
        bottleCount: 560,
        abvAtPackaging: '5.9',
        notes: 'First packaging run of completed batch'
      }
    ]).returning()

    // Seed inventory
    console.log('📋 Seeding inventory...')
    const seedInventory = await db.insert(inventory).values([
      {
        packageId: seedPackages[0].id,
        currentBottleCount: 485,
        reservedBottleCount: 25,
        location: 'Warehouse A, Shelf 1-3',
        notes: 'Ready for distribution'
      }
    ]).returning()

    // Seed inventory transactions
    console.log('📝 Seeding inventory transactions...')
    await db.insert(inventoryTransactions).values([
      {
        inventoryId: seedInventory[0].id,
        transactionType: 'sale',
        quantityChange: -50,
        transactionDate: new Date('2024-09-28'),
        reason: 'Farmers market sales',
        notes: 'Weekend market sales'
      },
      {
        inventoryId: seedInventory[0].id,
        transactionType: 'sale',
        quantityChange: -25,
        transactionDate: new Date('2024-10-01'),
        reason: 'Restaurant order',
        notes: 'Local restaurant wholesale'
      }
    ])

    // Seed batch costs
    console.log('💲 Seeding batch costs...')
    await db.insert(batchCosts).values([
      {
        batchId: seedBatches[1].id, // Completed batch
        totalAppleCost: '875.50',
        laborCost: '150.00',
        overheadCost: '75.25',
        packagingCost: '168.00', // ~$0.30 per bottle
        totalCost: '1268.75',
        costPerBottle: '2.27',
        costPerL: '3.02',
        calculatedAt: new Date('2024-09-26'),
        notes: 'Final cost calculation at packaging'
      },
      {
        batchId: seedBatches[0].id, // Active batch - projected
        totalAppleCost: '1250.00',
        laborCost: '120.00',
        overheadCost: '60.00',
        packagingCost: '0.00', // Not yet packaged
        totalCost: '1430.00',
        costPerBottle: null,
        costPerL: '2.38',
        calculatedAt: new Date('2024-09-17'),
        notes: 'Interim cost calculation - packaging costs TBD'
      }
    ])

    // Seed COGS items for detailed tracking
    console.log('🧾 Seeding COGS items...')
    await db.insert(cogsItems).values([
      // Detailed costs for completed batch
      {
        batchId: seedBatches[1].id,
        itemType: 'apple_cost',
        description: 'Gala apples from Sunrise Farm',
        cost: '450.00',
        quantity: '250.0',
        unit: 'L',
        appliedAt: new Date('2024-08-20'),
        notes: 'Juice volume used in batch'
      },
      {
        batchId: seedBatches[1].id,
        itemType: 'apple_cost',
        description: 'Fuji apples from Sunrise Farm',
        cost: '425.50',
        quantity: '180.0',
        unit: 'L',
        appliedAt: new Date('2024-08-20'),
        notes: 'Juice volume used in batch'
      },
      {
        batchId: seedBatches[1].id,
        itemType: 'labor',
        description: 'Fermentation monitoring and management',
        cost: '150.00',
        quantity: '8.0',
        unit: null,
        appliedAt: new Date('2024-09-25'),
        notes: 'Labor hours at $18.75/hour'
      },
      {
        batchId: seedBatches[1].id,
        itemType: 'packaging',
        description: '750ml bottles and caps',
        cost: '168.00',
        quantity: '560.0',
        unit: null,
        appliedAt: new Date('2024-09-26'),
        notes: '560 bottles at $0.30 each'
      }
    ])

    console.log('✅ Database seeding completed successfully!')
    console.log(`   • ${seedVendors.length} vendors`)
    console.log(`   • ${seedVarieties.length} apple varieties`)
    console.log(`   • ${seedVendorVarieties.length} vendor-variety relationships`)
    console.log(`   • ${seedPurchases.length} purchases with ${seedPurchaseItems.length} items`)
    console.log(`   • ${seedPressRuns.length} press runs with ${seedPressItems.length} items`)
    console.log(`   • ${seedVessels.length} vessels`)
    console.log(`   • ${seedBatches.length} batches with ingredients and measurements`)
    console.log(`   • ${seedPackages.length} packages with inventory tracking`)
    console.log('   • Complete cost tracking and COGS breakdown')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  }
}

// Run the seed function
if (require.main === module) {
  main()
    .then(() => {
      console.log('🎉 Seeding completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error)
      process.exit(1)
    })
}