import { db } from "./client";
import {
  users,
  vendors,
  baseFruitVarieties,
  vendorVarieties,
  purchases,
  purchaseItems,
  pressRuns,
  vessels,
  batches,
  batchCompositions,
  batchMeasurements,
} from "./schema";
import { seedPackageSizes } from "./seed/packageSizes";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding database...");

  try {
    // Seed package sizes (reference data first)
    await seedPackageSizes();

    // Seed users
    console.log("👥 Seeding users...");
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const seedUsers = await db
      .insert(users)
      .values([
        {
          email: "admin@example.com",
          name: "System Administrator",
          passwordHash: hashedPassword,
          role: "admin",
        },
        {
          email: "operator@example.com",
          name: "Production Operator",
          passwordHash: await bcrypt.hash("operator123", 10),
          role: "operator",
        },
      ])
      .returning();
    console.log(`✅ Seeded ${seedUsers.length} users`);

    // Seed vendors
    console.log("📦 Seeding vendors...");
    const seedVendors = await db
      .insert(vendors)
      .values([
        {
          name: "Mountain View Orchards",
          contactInfo: {
            phone: "555-0123",
            email: "orders@mountainview.com",
            address: "123 Orchard Lane, Apple Valley, NY 12345",
          },
          isActive: true,
        },
        {
          name: "Sunrise Apple Farm",
          contactInfo: {
            phone: "555-0456",
            email: "sales@sunriseapple.com",
            address: "456 Farm Road, Cider Springs, VT 05678",
          },
          isActive: true,
        },
        {
          name: "Heritage Fruit Co.",
          contactInfo: {
            phone: "555-0789",
            email: "info@heritagefruit.com",
            address: "789 Heritage Way, Old Town, MA 01234",
          },
          isActive: true,
        },
      ])
      .returning();

    // Seed fruit varieties
    console.log("🍎 Seeding fruit varieties...");
    const seedVarieties = await db
      .insert(baseFruitVarieties)
      .values([
        {
          name: "Honeycrisp",
          ciderCategory: "sweet",
          tannin: "low",
          acid: "medium",
          sugarBrix: "medium-high",
          harvestWindow: "Mid",
          varietyNotes: "High sugar content, mild acidity",
        },
        {
          name: "Granny Smith",
          ciderCategory: "sharp",
          tannin: "low",
          acid: "high",
          sugarBrix: "medium",
          harvestWindow: "Late",
          varietyNotes: "High acid, balances sweeter varieties",
        },
        {
          name: "Gala",
          ciderCategory: "sweet",
          tannin: "low",
          acid: "medium",
          sugarBrix: "medium",
          harvestWindow: "Early-Mid",
          varietyNotes: "Moderate sugar, subtle flavor",
        },
        {
          name: "Fuji",
          ciderCategory: "sweet",
          tannin: "low",
          acid: "low-medium",
          sugarBrix: "high",
          harvestWindow: "Late",
          varietyNotes: "Highest sugar content in our varieties",
        },
        {
          name: "Northern Spy",
          ciderCategory: "bittersweet",
          tannin: "medium",
          acid: "medium",
          sugarBrix: "medium-high",
          harvestWindow: "Mid-Late",
          varietyNotes: "Classic cider variety, well-balanced",
        },
        {
          name: "Rhode Island Greening",
          ciderCategory: "sharp",
          tannin: "low-medium",
          acid: "high",
          sugarBrix: "medium",
          harvestWindow: "Mid",
          varietyNotes: "Traditional New England cider apple",
        },
      ])
      .returning();

    // Seed vendor varieties (link vendors to the varieties they can supply)
    console.log("🔗 Seeding vendor varieties...");
    const seedVendorVarieties = await db
      .insert(vendorVarieties)
      .values([
        // Mountain View Orchards (vendor 0) - offers Honeycrisp, Granny Smith, Gala
        {
          vendorId: seedVendors[0].id,
          varietyId: seedVarieties[0].id, // Honeycrisp
        },
        {
          vendorId: seedVendors[0].id,
          varietyId: seedVarieties[1].id, // Granny Smith
        },
        {
          vendorId: seedVendors[0].id,
          varietyId: seedVarieties[2].id, // Gala
        },
        // Sunrise Apple Farm (vendor 1) - offers Gala, Fuji, Northern Spy
        {
          vendorId: seedVendors[1].id,
          varietyId: seedVarieties[2].id, // Gala
        },
        {
          vendorId: seedVendors[1].id,
          varietyId: seedVarieties[3].id, // Fuji
        },
        {
          vendorId: seedVendors[1].id,
          varietyId: seedVarieties[4].id, // Northern Spy
        },
        // Heritage Fruit Co. (vendor 2) - offers Northern Spy, Rhode Island Greening, Honeycrisp
        {
          vendorId: seedVendors[2].id,
          varietyId: seedVarieties[4].id, // Northern Spy
        },
        {
          vendorId: seedVendors[2].id,
          varietyId: seedVarieties[5].id, // Rhode Island Greening
        },
        {
          vendorId: seedVendors[2].id,
          varietyId: seedVarieties[0].id, // Honeycrisp
        },
      ])
      .returning();

    // Seed purchases (3 purchases over the last 3 months)
    console.log("💰 Seeding purchases...");
    const seedPurchases = await db
      .insert(purchases)
      .values([
        {
          vendorId: seedVendors[0].id,
          purchaseDate: new Date("2024-09-01"),
          totalCost: "2450.00",
          notes: "First fall harvest delivery",
        },
        {
          vendorId: seedVendors[1].id,
          purchaseDate: new Date("2024-08-15"),
          totalCost: "1875.50",
          notes: "Early season varieties",
        },
        {
          vendorId: seedVendors[2].id,
          purchaseDate: new Date("2024-07-20"),
          totalCost: "3200.75",
          notes: "Premium heritage varieties",
        },
      ])
      .returning();

    // Seed purchase items with canonical unit conversions
    console.log("📋 Seeding purchase items...");
    const seedPurchaseItems = await db
      .insert(purchaseItems)
      .values([
        // Purchase 1 items
        {
          purchaseId: seedPurchases[0].id,
          fruitVarietyId: seedVarieties[0].id, // Honeycrisp
          quantity: "500.0",
          unit: "kg",
          pricePerUnit: "2.50",
          totalCost: "1250.00",
          quantityKg: "500.0",
          notes: "Premium grade A apples",
        },
        {
          purchaseId: seedPurchases[0].id,
          fruitVarietyId: seedVarieties[1].id, // Granny Smith
          quantity: "600.0",
          unit: "kg",
          pricePerUnit: "2.00",
          totalCost: "1200.00",
          quantityKg: "600.0",
          notes: "Good for acid balance",
        },
        // Purchase 2 items
        {
          purchaseId: seedPurchases[1].id,
          fruitVarietyId: seedVarieties[2].id, // Gala
          quantity: "750.0",
          unit: "kg",
          pricePerUnit: "1.80",
          totalCost: "1350.00",
          quantityKg: "750.0",
          notes: "Bulk order discount applied",
        },
        {
          purchaseId: seedPurchases[1].id,
          fruitVarietyId: seedVarieties[3].id, // Fuji
          quantity: "300.0",
          unit: "kg",
          pricePerUnit: "1.75",
          totalCost: "525.50",
          quantityKg: "300.0",
          notes: "Small batch for testing",
        },
        // Purchase 3 items
        {
          purchaseId: seedPurchases[2].id,
          fruitVarietyId: seedVarieties[4].id, // Northern Spy
          quantity: "800.0",
          unit: "kg",
          pricePerUnit: "2.25",
          totalCost: "1800.00",
          quantityKg: "800.0",
          notes: "Heritage variety premium",
        },
        {
          purchaseId: seedPurchases[2].id,
          fruitVarietyId: seedVarieties[5].id, // Rhode Island Greening
          quantity: "650.0",
          unit: "kg",
          pricePerUnit: "2.15",
          totalCost: "1397.50",
          quantityKg: "650.0",
          notes: "Traditional cider apple",
        },
      ])
      .returning();

    // COMMENTED OUT: Old pressRuns and pressItems tables dropped in migration 0024
    // The new pressRuns/pressRunLoads schema (renamed from applePressRuns) has a different structure
    // TODO: Add seed data for new pressRuns/pressRunLoads schema if needed

    // Placeholder for press runs seed data (using null IDs since juiceLots/batches need them)
    const seedPressRuns: any[] = [
      { id: null }, // Placeholder
      { id: null }, // Placeholder
      { id: null }, // Placeholder
    ];

    // Seed vessels
    console.log("🏺 Seeding vessels...");
    const seedVessels = await db
      .insert(vessels)
      .values([
        {
          name: "Tank A1",
          capacity: "1000.0",
          capacityUnit: "L",
          status: "available",
          location: "Fermentation Room 1",
          notes: "Primary fermenter for large batches",
          isPressureVessel: "yes",
          maxPressure: "30.0",
        },
        {
          name: "Tank B2",
          capacity: "500.0",
          capacityUnit: "L",
          status: "available",
          location: "Fermentation Room 1",
          notes: "Secondary fermenter for small batches",
          isPressureVessel: "no",
        },
        {
          name: "Conditioning Tank C1",
          capacity: "800.0",
          capacityUnit: "L",
          status: "available",
          location: "Cellar",
          notes: "For secondary fermentation and conditioning",
          isPressureVessel: "yes",
          maxPressure: "30.0",
        },
        {
          name: "Bright Tank D1",
          capacity: "600.0",
          capacityUnit: "L",
          status: "cleaning",
          location: "Packaging Room",
          notes: "Final conditioning before packaging",
          isPressureVessel: "yes",
          maxPressure: "45.0",
        },
      ])
      .returning();

    // Seed batches
    console.log("🍺 Seeding batches...");
    const seedBatches = await db
      .insert(batches)
      .values([
        {
          name: "B-2024-001",
          batchNumber: "B-2024-001",
          initialVolume: "500.0",
          initialVolumeUnit: "L",
          currentVolume: "480.0",
          currentVolumeUnit: "L",
          status: "fermentation",
          vesselId: seedVessels[0].id,
          originPressRunId: seedPressRuns[0].id,
          startDate: new Date("2024-09-10"),
        },
        {
          name: "B-2024-002",
          batchNumber: "B-2024-002",
          initialVolume: "350.0",
          initialVolumeUnit: "L",
          currentVolume: "0",
          currentVolumeUnit: "L",
          status: "completed",
          vesselId: null,
          originPressRunId: seedPressRuns[1].id,
          startDate: new Date("2024-07-30"),
          endDate: new Date("2024-09-25"),
        },
        {
          name: "B-2024-003",
          batchNumber: "B-2024-003",
          initialVolume: "750.0",
          initialVolumeUnit: "L",
          currentVolume: "740.0",
          currentVolumeUnit: "L",
          status: "fermentation",
          vesselId: seedVessels[2].id,
          originPressRunId: seedPressRuns[2].id,
          startDate: new Date("2024-07-26"),
        },
      ])
      .returning();

    // Seed batch compositions
    console.log("🥤 Seeding batch compositions...");
    await db.insert(batchCompositions).values([
      // Batch 1 ingredients
      {
        batchId: seedBatches[0].id,
        purchaseItemId: seedPurchaseItems[0].id,
        vendorId: seedVendors[0].id,
        varietyId: seedVarieties[0].id, // Honeycrisp
        lotCode: "LOT-2024-HC-001",
        inputWeightKg: "500.0",
        juiceVolume: "300.0",
        juiceVolumeUnit: "L",
        fractionOfBatch: "0.5",
        materialCost: "450.00",
        avgBrix: "14.8",
        estSugarKg: "44.4",
      },
      {
        batchId: seedBatches[0].id,
        purchaseItemId: seedPurchaseItems[1].id,
        vendorId: seedVendors[0].id,
        varietyId: seedVarieties[1].id, // Granny Smith
        lotCode: "LOT-2024-GS-001",
        inputWeightKg: "500.0",
        juiceVolume: "300.0",
        juiceVolumeUnit: "L",
        fractionOfBatch: "0.5",
        materialCost: "425.00",
        avgBrix: "12.5",
        estSugarKg: "37.5",
      },
      // Batch 2 ingredients
      {
        batchId: seedBatches[1].id,
        purchaseItemId: seedPurchaseItems[2].id,
        vendorId: seedVendors[1].id,
        varietyId: seedVarieties[2].id, // Gala
        lotCode: "LOT-2024-GL-001",
        inputWeightKg: "416.7",
        juiceVolume: "250.0",
        juiceVolumeUnit: "L",
        fractionOfBatch: "0.58",
        materialCost: "333.36",
        avgBrix: "13.0",
        estSugarKg: "32.5",
      },
      {
        batchId: seedBatches[1].id,
        purchaseItemId: seedPurchaseItems[3].id,
        vendorId: seedVendors[1].id,
        varietyId: seedVarieties[3].id, // Fuji
        lotCode: "LOT-2024-FJ-001",
        inputWeightKg: "300.0",
        juiceVolume: "180.0",
        juiceVolumeUnit: "L",
        fractionOfBatch: "0.42",
        materialCost: "270.00",
        avgBrix: "15.5",
        estSugarKg: "27.9",
      },
      // Batch 3 ingredients
      {
        batchId: seedBatches[2].id,
        purchaseItemId: seedPurchaseItems[4].id,
        vendorId: seedVendors[2].id,
        varietyId: seedVarieties[4].id, // Northern Spy
        lotCode: "LOT-2024-NS-001",
        inputWeightKg: "700.0",
        juiceVolume: "455.0",
        juiceVolumeUnit: "L",
        fractionOfBatch: "0.61",
        materialCost: "840.00",
        avgBrix: "14.2",
        estSugarKg: "64.6",
      },
      {
        batchId: seedBatches[2].id,
        purchaseItemId: seedPurchaseItems[5].id,
        vendorId: seedVendors[2].id,
        varietyId: seedVarieties[5].id, // Rhode Island Greening
        lotCode: "LOT-2024-RIG-001",
        inputWeightKg: "500.0",
        juiceVolume: "295.0",
        juiceVolumeUnit: "L",
        fractionOfBatch: "0.39",
        materialCost: "700.00",
        avgBrix: "12.8",
        estSugarKg: "37.8",
      },
    ]);

    // Seed batch measurements
    console.log("📊 Seeding batch measurements...");
    await db.insert(batchMeasurements).values([
      // Batch 1 measurements
      {
        batchId: seedBatches[0].id,
        measurementDate: new Date("2024-09-10"),
        specificGravity: "1.065",
        abv: "0.0",
        ph: "3.8",
        totalAcidity: "0.65",
        temperature: "20.5",
        volume: "600.0",
        volumeUnit: "L",
        notes: "Initial measurements at pitch",
        takenBy: "John Smith",
      },
      {
        batchId: seedBatches[0].id,
        measurementDate: new Date("2024-09-17"),
        specificGravity: "1.020",
        abv: "4.2",
        ph: "3.7",
        totalAcidity: "0.68",
        temperature: "18.2",
        volume: "590.0",
        volumeUnit: "L",
        notes: "Active fermentation, good progress",
        takenBy: "John Smith",
      },
      // Batch 2 measurements (completed)
      {
        batchId: seedBatches[1].id,
        measurementDate: new Date("2024-07-30"),
        specificGravity: "1.058",
        abv: "0.0",
        ph: "3.9",
        totalAcidity: "0.55",
        temperature: "21.0",
        volume: "450.0",
        volumeUnit: "L",
        notes: "Initial measurements",
        takenBy: "Sarah Johnson",
      },
      {
        batchId: seedBatches[1].id,
        measurementDate: new Date("2024-09-25"),
        specificGravity: "0.995",
        abv: "5.9",
        ph: "3.6",
        totalAcidity: "0.62",
        temperature: "16.8",
        volume: "435.0",
        volumeUnit: "L",
        notes: "Final measurements before packaging",
        takenBy: "Sarah Johnson",
      },
    ]);

// DROPPED TABLE:     // Seed packages (only for completed batch)
// DROPPED TABLE:     console.log("📦 Seeding packages...");
// DROPPED TABLE:     const seedPackages = await db
// DROPPED TABLE:       .insert(packages)
// DROPPED TABLE:       .values([
// DROPPED TABLE:         {
// DROPPED TABLE:           batchId: seedBatches[1].id, // Completed batch
// DROPPED TABLE:           packageDate: new Date("2024-09-26"),
// DROPPED TABLE:           volumePackaged: "420.0",
// DROPPED TABLE:           volumePackagedUnit: "L",
// DROPPED TABLE:           bottleSize: "750ml",
// DROPPED TABLE:           bottleCount: 560,
// DROPPED TABLE:           abvAtPackaging: "5.9",
// DROPPED TABLE:           notes: "First packaging run of completed batch",
// DROPPED TABLE:         },
// DROPPED TABLE:         {
// DROPPED TABLE:           batchId: seedBatches[1].id, // Same batch, different bottle size
// DROPPED TABLE:           packageDate: new Date("2024-09-27"),
// DROPPED TABLE:           volumePackaged: "15.0",
// DROPPED TABLE:           volumePackagedUnit: "L",
// DROPPED TABLE:           bottleSize: "375ml",
// DROPPED TABLE:           bottleCount: 40,
// DROPPED TABLE:           abvAtPackaging: "5.9",
// DROPPED TABLE:           notes: "Small format bottles for tasting room",
// DROPPED TABLE:         },
// DROPPED TABLE:       ])
// DROPPED TABLE:       .returning();

// DROPPED TABLE:     // Seed inventory
// DROPPED TABLE:     console.log("📋 Seeding inventory...");
// DROPPED TABLE:     const seedInventory = await db
// DROPPED TABLE:       .insert(inventory)
// DROPPED TABLE:       .values([
// DROPPED TABLE:         {
// DROPPED TABLE:           packageId: seedPackages[0].id,
// DROPPED TABLE:           currentBottleCount: 485,
// DROPPED TABLE:           reservedBottleCount: 25,
// DROPPED TABLE:           materialType: "apple",
// DROPPED TABLE:           metadata: {
// DROPPED TABLE:             abv: 5.9,
// DROPPED TABLE:             batchNumber: "B-2024-002",
// DROPPED TABLE:             varietyBlend: ["Gala", "Fuji"],
// DROPPED TABLE:             packageDate: "2024-09-26",
// DROPPED TABLE:             expirationDate: "2026-09-26",
// DROPPED TABLE:             bottleSize: "750ml",
// DROPPED TABLE:             qualityGrade: "A",
// DROPPED TABLE:             fermentationNotes:
// DROPPED TABLE:               "Primary fermentation completed, well-balanced sweetness and acidity",
// DROPPED TABLE:             tastingNotes:
// DROPPED TABLE:               "Light golden color with crisp apple flavor and subtle fruitiness",
// DROPPED TABLE:           },
// DROPPED TABLE:           location: "Warehouse A, Shelf 1-3",
// DROPPED TABLE:           notes: "Ready for distribution",
// DROPPED TABLE:         },
// DROPPED TABLE:         {
// DROPPED TABLE:           packageId: seedPackages[1].id,
// DROPPED TABLE:           currentBottleCount: 38,
// DROPPED TABLE:           reservedBottleCount: 2,
// DROPPED TABLE:           materialType: "apple",
// DROPPED TABLE:           metadata: {
// DROPPED TABLE:             abv: 5.9,
// DROPPED TABLE:             batchNumber: "B-2024-002",
// DROPPED TABLE:             varietyBlend: ["Gala", "Fuji"],
// DROPPED TABLE:             packageDate: "2024-09-27",
// DROPPED TABLE:             expirationDate: "2026-09-27",
// DROPPED TABLE:             bottleSize: "375ml",
// DROPPED TABLE:             qualityGrade: "A",
// DROPPED TABLE:             specialUse: "tasting room",
// DROPPED TABLE:             samplingNotes: "Perfect portion size for tastings and events",
// DROPPED TABLE:           },
// DROPPED TABLE:           location: "Tasting Room Storage",
// DROPPED TABLE:           notes: "Small format for tastings and events",
// DROPPED TABLE:         },
// DROPPED TABLE:         // Note: The following entries are conceptual examples to demonstrate different material types
// DROPPED TABLE:         // In a production system, raw materials would typically have a separate inventory table
// DROPPED TABLE:         {
// DROPPED TABLE:           packageId: seedPackages[0].id, // Reusing package ID for demo purposes
// DROPPED TABLE:           currentBottleCount: 50, // Representing 50 units of additive
// DROPPED TABLE:           reservedBottleCount: 0,
// DROPPED TABLE:           materialType: "additive",
// DROPPED TABLE:           metadata: {
// DROPPED TABLE:             additiveType: "potassium_metabisulfite",
// DROPPED TABLE:             concentration: "10%",
// DROPPED TABLE:             supplier: "Vintner Supply Co.",
// DROPPED TABLE:             lotNumber: "KMS-2024-087",
// DROPPED TABLE:             expirationDate: "2025-12-31",
// DROPPED TABLE:             applicationRate: "1.5g per 10L",
// DROPPED TABLE:             safetyNotes: "Handle with gloves, avoid inhalation",
// DROPPED TABLE:             storageTemperature: "room temperature",
// DROPPED TABLE:             moistureContent: "< 0.5%",
// DROPPED TABLE:           },
// DROPPED TABLE:           location: "Chemical Storage Room, Shelf B2",
// DROPPED TABLE:           notes: "Sulfite for preservation and oxidation prevention",
// DROPPED TABLE:         },
// DROPPED TABLE:         {
// DROPPED TABLE:           packageId: seedPackages[1].id, // Reusing package ID for demo purposes
// DROPPED TABLE:           currentBottleCount: 200, // Representing 200L of juice
// DROPPED TABLE:           reservedBottleCount: 50,
// DROPPED TABLE:           materialType: "juice",
// DROPPED TABLE:           metadata: {
// DROPPED TABLE:             juiceType: "apple_blend",
// DROPPED TABLE:             varietyComposition: {
// DROPPED TABLE:               Honeycrisp: "60%",
// DROPPED TABLE:               "Granny Smith": "40%",
// DROPPED TABLE:             },
// DROPPED TABLE:             brix: 14.2,
// DROPPED TABLE:             ph: 3.8,
// DROPPED TABLE:             pressDate: "2024-09-15",
// DROPPED TABLE:             expirationDate: "2024-10-15",
// DROPPED TABLE:             storageCondition: "refrigerated",
// DROPPED TABLE:             clarification: "enzyme treated",
// DROPPED TABLE:             yeastStrain: "ready for EC-1118",
// DROPPED TABLE:             volumeL: 200,
// DROPPED TABLE:           },
// DROPPED TABLE:           location: "Cold Storage Tank T-05",
// DROPPED TABLE:           notes: "Fresh pressed juice ready for fermentation",
// DROPPED TABLE:         },
// DROPPED TABLE:         {
// DROPPED TABLE:           packageId: seedPackages[0].id, // Reusing package ID for demo purposes
// DROPPED TABLE:           currentBottleCount: 1000, // Representing 1000 bottles
// DROPPED TABLE:           reservedBottleCount: 100,
// DROPPED TABLE:           materialType: "packaging",
// DROPPED TABLE:           metadata: {
// DROPPED TABLE:             packageType: "glass_bottle",
// DROPPED TABLE:             size: "750ml",
// DROPPED TABLE:             color: "antique_green",
// DROPPED TABLE:             supplier: "Premium Glass Solutions",
// DROPPED TABLE:             lotNumber: "PGS-750-AG-2024-Q3",
// DROPPED TABLE:             quality: "food_grade",
// DROPPED TABLE:             closureType: "cork_compatible",
// DROPPED TABLE:             orderDate: "2024-08-15",
// DROPPED TABLE:             deliveryDate: "2024-09-01",
// DROPPED TABLE:             shelfLife: "indefinite",
// DROPPED TABLE:             dimensions: {
// DROPPED TABLE:               height: "315mm",
// DROPPED TABLE:               diameter: "77mm",
// DROPPED TABLE:               weight: "550g",
// DROPPED TABLE:             },
// DROPPED TABLE:           },
// DROPPED TABLE:           location: "Packaging Warehouse, Aisle C",
// DROPPED TABLE:           notes: "Premium glass bottles for main product line",
// DROPPED TABLE:         },
// DROPPED TABLE:       ])
// DROPPED TABLE:       .returning();

// DROPPED TABLE:     // Seed inventory transactions
// DROPPED TABLE:     console.log("📝 Seeding inventory transactions...");
// DROPPED TABLE:     await db.insert(inventoryTransactions).values([
// DROPPED TABLE:       {
// DROPPED TABLE:         inventoryId: seedInventory[0].id,
// DROPPED TABLE:         transactionType: "sale",
// DROPPED TABLE:         quantityChange: -50,
// DROPPED TABLE:         transactionDate: new Date("2024-09-28"),
// DROPPED TABLE:         reason: "Farmers market sales",
// DROPPED TABLE:         notes: "Weekend market sales",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         inventoryId: seedInventory[0].id,
// DROPPED TABLE:         transactionType: "sale",
// DROPPED TABLE:         quantityChange: -25,
// DROPPED TABLE:         transactionDate: new Date("2024-10-01"),
// DROPPED TABLE:         reason: "Restaurant order",
// DROPPED TABLE:         notes: "Local restaurant wholesale",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         inventoryId: seedInventory[1].id,
// DROPPED TABLE:         transactionType: "sale",
// DROPPED TABLE:         quantityChange: -2,
// DROPPED TABLE:         transactionDate: new Date("2024-09-29"),
// DROPPED TABLE:         reason: "Tasting room samples",
// DROPPED TABLE:         notes: "Used for customer tastings",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         inventoryId: seedInventory[2].id, // Additive inventory
// DROPPED TABLE:         transactionType: "transfer",
// DROPPED TABLE:         quantityChange: -5,
// DROPPED TABLE:         transactionDate: new Date("2024-09-20"),
// DROPPED TABLE:         reason: "Production use",
// DROPPED TABLE:         notes: "Used in batch B-2024-003 for stabilization",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         inventoryId: seedInventory[3].id, // Juice inventory
// DROPPED TABLE:         transactionType: "transfer",
// DROPPED TABLE:         quantityChange: -50,
// DROPPED TABLE:         transactionDate: new Date("2024-09-16"),
// DROPPED TABLE:         reason: "Fermentation start",
// DROPPED TABLE:         notes: "Transferred to fermenter for new batch",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         inventoryId: seedInventory[4].id, // Packaging inventory
// DROPPED TABLE:         transactionType: "transfer",
// DROPPED TABLE:         quantityChange: -560,
// DROPPED TABLE:         transactionDate: new Date("2024-09-26"),
// DROPPED TABLE:         reason: "Packaging run",
// DROPPED TABLE:         notes: "Used for batch B-2024-002 packaging",
// DROPPED TABLE:       },
// DROPPED TABLE:     ]);

// DROPPED TABLE:     // Seed batch costs
// DROPPED TABLE:     console.log("💲 Seeding batch costs...");
// DROPPED TABLE:     await db.insert(batchCosts).values([
// DROPPED TABLE:       {
// DROPPED TABLE:         batchId: seedBatches[1].id, // Completed batch
// DROPPED TABLE:         totalAppleCost: "875.50",
// DROPPED TABLE:         laborCost: "150.00",
// DROPPED TABLE:         overheadCost: "75.25",
// DROPPED TABLE:         packagingCost: "168.00", // ~$0.30 per bottle
// DROPPED TABLE:         totalCost: "1268.75",
// DROPPED TABLE:         costPerBottle: "2.27",
// DROPPED TABLE:         costPerL: "3.02",
// DROPPED TABLE:         calculatedAt: new Date("2024-09-26"),
// DROPPED TABLE:         notes: "Final cost calculation at packaging",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         batchId: seedBatches[0].id, // Active batch - projected
// DROPPED TABLE:         totalAppleCost: "1250.00",
// DROPPED TABLE:         laborCost: "120.00",
// DROPPED TABLE:         overheadCost: "60.00",
// DROPPED TABLE:         packagingCost: "0.00", // Not yet packaged
// DROPPED TABLE:         totalCost: "1430.00",
// DROPPED TABLE:         costPerBottle: null,
// DROPPED TABLE:         costPerL: "2.38",
// DROPPED TABLE:         calculatedAt: new Date("2024-09-17"),
// DROPPED TABLE:         notes: "Interim cost calculation - packaging costs TBD",
// DROPPED TABLE:       },
// DROPPED TABLE:     ]);

// DROPPED TABLE:     // Seed COGS items for detailed tracking
// DROPPED TABLE:     console.log("🧾 Seeding COGS items...");
// DROPPED TABLE:     await db.insert(cogsItems).values([
// DROPPED TABLE:       // Detailed costs for completed batch
// DROPPED TABLE:       {
// DROPPED TABLE:         batchId: seedBatches[1].id,
// DROPPED TABLE:         itemType: "apple_cost",
// DROPPED TABLE:         description: "Gala apples from Sunrise Farm",
// DROPPED TABLE:         cost: "450.00",
// DROPPED TABLE:         quantity: "250.0",
// DROPPED TABLE:         unit: "L",
// DROPPED TABLE:         appliedAt: new Date("2024-08-20"),
// DROPPED TABLE:         notes: "Juice volume used in batch",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         batchId: seedBatches[1].id,
// DROPPED TABLE:         itemType: "apple_cost",
// DROPPED TABLE:         description: "Fuji apples from Sunrise Farm",
// DROPPED TABLE:         cost: "425.50",
// DROPPED TABLE:         quantity: "180.0",
// DROPPED TABLE:         unit: "L",
// DROPPED TABLE:         appliedAt: new Date("2024-08-20"),
// DROPPED TABLE:         notes: "Juice volume used in batch",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         batchId: seedBatches[1].id,
// DROPPED TABLE:         itemType: "labor",
// DROPPED TABLE:         description: "Fermentation monitoring and management",
// DROPPED TABLE:         cost: "150.00",
// DROPPED TABLE:         quantity: "8.0",
// DROPPED TABLE:         unit: null,
// DROPPED TABLE:         appliedAt: new Date("2024-09-25"),
// DROPPED TABLE:         notes: "Labor hours at $18.75/hour",
// DROPPED TABLE:       },
// DROPPED TABLE:       {
// DROPPED TABLE:         batchId: seedBatches[1].id,
// DROPPED TABLE:         itemType: "packaging",
// DROPPED TABLE:         description: "750ml bottles and caps",
// DROPPED TABLE:         cost: "168.00",
// DROPPED TABLE:         quantity: "560.0",
// DROPPED TABLE:         unit: null,
// DROPPED TABLE:         appliedAt: new Date("2024-09-26"),
// DROPPED TABLE:         notes: "560 bottles at $0.30 each",
// DROPPED TABLE:       },
// DROPPED TABLE:     ]);

    console.log("✅ Database seeding completed successfully!");
    console.log(`   • ${seedVendors.length} vendors`);
    console.log(`   • ${seedVarieties.length} apple varieties`);
    console.log(
      `   • ${seedVendorVarieties.length} vendor-variety relationships`,
    );
    console.log(
      `   • ${seedPurchases.length} purchases with ${seedPurchaseItems.length} items`,
    );
    console.log(`   • ${seedVessels.length} vessels`);
    console.log(
      `   • ${seedBatches.length} batches with ingredients and measurements`,
    );
    console.log("   • Note: Press runs, packages, inventory, and cost tracking seed data");
    console.log("     commented out due to schema cleanup (migration 0024)");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run the seed function
if (require.main === module) {
  main()
    .then(() => {
      console.log("🎉 Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding failed:", error);
      process.exit(1);
    });
}
