import { db } from "./client";
import {
  users,
  vendors,
  baseFruitVarieties,
  vendorVarieties,
  purchases,
  purchaseItems,
  pressRuns,
  pressItems,
  vessels,
  juiceLots,
  batches,
  batchCompositions,
  batchMeasurements,
  packages,
  inventory,
  inventoryTransactions,
  batchCosts,
  cogsItems,
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
          notes: "Premium grade, excellent for single varietal ciders",
        },
        {
          vendorId: seedVendors[0].id,
          varietyId: seedVarieties[1].id, // Granny Smith
          notes: "Consistent quality, great for blending",
        },
        {
          vendorId: seedVendors[0].id,
          varietyId: seedVarieties[2].id, // Gala
          notes: "Mild flavor, good for entry-level ciders",
        },
        // Sunrise Apple Farm (vendor 1) - offers Gala, Fuji, Northern Spy
        {
          vendorId: seedVendors[1].id,
          varietyId: seedVarieties[2].id, // Gala
          notes: "Bulk quantities available",
        },
        {
          vendorId: seedVendors[1].id,
          varietyId: seedVarieties[3].id, // Fuji
          notes: "High sugar content, perfect for sweet ciders",
        },
        {
          vendorId: seedVendors[1].id,
          varietyId: seedVarieties[4].id, // Northern Spy
          notes: "Traditional variety, small batches",
        },
        // Heritage Fruit Co. (vendor 2) - offers Northern Spy, Rhode Island Greening, Honeycrisp
        {
          vendorId: seedVendors[2].id,
          varietyId: seedVarieties[4].id, // Northern Spy
          notes: "Heirloom quality, premium pricing",
        },
        {
          vendorId: seedVendors[2].id,
          varietyId: seedVarieties[5].id, // Rhode Island Greening
          notes: "Heritage variety specialist",
        },
        {
          vendorId: seedVendors[2].id,
          varietyId: seedVarieties[0].id, // Honeycrisp
          notes: "Organic certification available",
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
          invoiceNumber: "MVO-2024-001",
          notes: "First fall harvest delivery",
        },
        {
          vendorId: seedVendors[1].id,
          purchaseDate: new Date("2024-08-15"),
          totalCost: "1875.50",
          invoiceNumber: "SAF-2024-027",
          notes: "Early season varieties",
        },
        {
          vendorId: seedVendors[2].id,
          purchaseDate: new Date("2024-07-20"),
          totalCost: "3200.75",
          invoiceNumber: "HFC-2024-112",
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
          quantityL: null,
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
          quantityL: null,
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
          quantityL: null,
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
          quantityL: null,
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
          quantityL: null,
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
          quantityL: null,
          notes: "Traditional cider apple",
        },
      ])
      .returning();

    // Seed press runs
    console.log("🏭 Seeding press runs...");
    const seedPressRuns = await db
      .insert(pressRuns)
      .values([
        {
          runDate: new Date("2024-09-05"),
          notes: "First major press run of the season",
          totalAppleProcessedKg: "1100.0",
          totalJuiceProduced: "660.0",
          totalJuiceProducedUnit: "L" as const,
          extractionRate: "0.6000",
        },
        {
          runDate: new Date("2024-08-20"),
          notes: "Testing run with new varieties",
          totalAppleProcessedKg: "800.0",
          totalJuiceProduced: "480.0",
          totalJuiceProducedUnit: "L" as const,
          extractionRate: "0.6000",
        },
        {
          runDate: new Date("2024-07-25"),
          notes: "Heritage varieties pressing",
          totalAppleProcessedKg: "1200.0",
          totalJuiceProduced: "780.0",
          totalJuiceProducedUnit: "L" as const,
          extractionRate: "0.6500",
        },
      ])
      .returning();

    // Seed press items
    console.log("🍎➡️🧃 Seeding press items...");
    const seedPressItems = await db
      .insert(pressItems)
      .values([
        // Press Run 1
        {
          pressRunId: seedPressRuns[0].id,
          purchaseItemId: seedPurchaseItems[0].id, // Honeycrisp 500kg
          quantityUsedKg: "500.0",
          juiceProduced: "300.0",
          juiceProducedUnit: "L" as const,
          brixMeasured: "14.8",
          notes: "Excellent juice quality",
        },
        {
          pressRunId: seedPressRuns[0].id,
          purchaseItemId: seedPurchaseItems[1].id, // Granny Smith 600kg
          quantityUsedKg: "600.0",
          juiceProduced: "360.0",
          juiceProducedUnit: "L" as const,
          brixMeasured: "12.5",
          notes: "Good acid content",
        },
        // Press Run 2
        {
          pressRunId: seedPressRuns[1].id,
          purchaseItemId: seedPurchaseItems[2].id, // Gala 750kg
          quantityUsedKg: "500.0",
          juiceProduced: "300.0",
          juiceProducedUnit: "L" as const,
          brixMeasured: "13.0",
          notes: "Mild flavor profile",
        },
        {
          pressRunId: seedPressRuns[1].id,
          purchaseItemId: seedPurchaseItems[3].id, // Fuji 300kg
          quantityUsedKg: "300.0",
          juiceProduced: "180.0",
          juiceProducedUnit: "L" as const,
          brixMeasured: "15.5",
          notes: "Very sweet juice",
        },
        // Press Run 3
        {
          pressRunId: seedPressRuns[2].id,
          purchaseItemId: seedPurchaseItems[4].id, // Northern Spy 800kg
          quantityUsedKg: "700.0",
          juiceProduced: "455.0",
          juiceProducedUnit: "L" as const,
          brixMeasured: "14.2",
          notes: "Traditional cider character",
        },
        {
          pressRunId: seedPressRuns[2].id,
          purchaseItemId: seedPurchaseItems[5].id, // Rhode Island Greening 650kg
          quantityUsedKg: "500.0",
          juiceProduced: "325.0",
          juiceProducedUnit: "L" as const,
          brixMeasured: "12.8",
          notes: "Heritage variety excellence",
        },
      ])
      .returning();

    // Seed vessels
    console.log("🏺 Seeding vessels...");
    const seedVessels = await db
      .insert(vessels)
      .values([
        {
          name: "Tank A1",
          type: "fermenter",
          capacity: "1000.0",
          capacityUnit: "L",
          status: "in_use",
          location: "Fermentation Room 1",
          notes: "Primary fermenter for large batches",
        },
        {
          name: "Tank B2",
          type: "fermenter",
          capacity: "500.0",
          capacityUnit: "L",
          status: "available",
          location: "Fermentation Room 1",
          notes: "Secondary fermenter for small batches",
        },
        {
          name: "Conditioning Tank C1",
          type: "conditioning_tank",
          capacity: "800.0",
          capacityUnit: "L",
          status: "available",
          location: "Cellar",
          notes: "For secondary fermentation and conditioning",
        },
        {
          name: "Bright Tank D1",
          type: "bright_tank",
          capacity: "600.0",
          capacityUnit: "L",
          status: "cleaning",
          location: "Packaging Room",
          notes: "Final conditioning before packaging",
        },
      ])
      .returning();

    // Seed juice lots
    console.log("🧃 Seeding juice lots...");
    const seedJuiceLots = await db
      .insert(juiceLots)
      .values([
        {
          pressRunId: seedPressRuns[0].id,
          volume: "600.0",
          volumeUnit: "L",
          brix: "11.5",
        },
        {
          pressRunId: seedPressRuns[1].id,
          volume: "420.0",
          volumeUnit: "L",
          brix: "12.2",
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
          status: "active",
          vesselId: seedVessels[0].id,
          juiceLotId: seedJuiceLots[0].id,
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
          status: "packaged",
          vesselId: null,
          juiceLotId: seedJuiceLots[1].id,
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
          status: "active",
          vesselId: seedVessels[2].id,
          juiceLotId: seedJuiceLots[2].id,
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
        purchaseItemId: seedPressItems[0].id, // Using pressItems ID as proxy for purchase
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
        purchaseItemId: seedPressItems[1].id, // Using pressItems ID as proxy
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
        purchaseItemId: seedPressItems[2].id,
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
        purchaseItemId: seedPressItems[3].id,
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
        purchaseItemId: seedPressItems[4].id,
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
        purchaseItemId: seedPressItems[5].id,
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

    // Seed packages (only for completed batch)
    console.log("📦 Seeding packages...");
    const seedPackages = await db
      .insert(packages)
      .values([
        {
          batchId: seedBatches[1].id, // Completed batch
          packageDate: new Date("2024-09-26"),
          volumePackaged: "420.0",
          volumePackagedUnit: "L",
          bottleSize: "750ml",
          bottleCount: 560,
          abvAtPackaging: "5.9",
          notes: "First packaging run of completed batch",
        },
        {
          batchId: seedBatches[1].id, // Same batch, different bottle size
          packageDate: new Date("2024-09-27"),
          volumePackaged: "15.0",
          volumePackagedUnit: "L",
          bottleSize: "375ml",
          bottleCount: 40,
          abvAtPackaging: "5.9",
          notes: "Small format bottles for tasting room",
        },
      ])
      .returning();

    // Seed inventory
    console.log("📋 Seeding inventory...");
    const seedInventory = await db
      .insert(inventory)
      .values([
        {
          packageId: seedPackages[0].id,
          currentBottleCount: 485,
          reservedBottleCount: 25,
          materialType: "apple",
          metadata: {
            abv: 5.9,
            batchNumber: "B-2024-002",
            varietyBlend: ["Gala", "Fuji"],
            packageDate: "2024-09-26",
            expirationDate: "2026-09-26",
            bottleSize: "750ml",
            qualityGrade: "A",
            fermentationNotes:
              "Primary fermentation completed, well-balanced sweetness and acidity",
            tastingNotes:
              "Light golden color with crisp apple flavor and subtle fruitiness",
          },
          location: "Warehouse A, Shelf 1-3",
          notes: "Ready for distribution",
        },
        {
          packageId: seedPackages[1].id,
          currentBottleCount: 38,
          reservedBottleCount: 2,
          materialType: "apple",
          metadata: {
            abv: 5.9,
            batchNumber: "B-2024-002",
            varietyBlend: ["Gala", "Fuji"],
            packageDate: "2024-09-27",
            expirationDate: "2026-09-27",
            bottleSize: "375ml",
            qualityGrade: "A",
            specialUse: "tasting room",
            samplingNotes: "Perfect portion size for tastings and events",
          },
          location: "Tasting Room Storage",
          notes: "Small format for tastings and events",
        },
        // Note: The following entries are conceptual examples to demonstrate different material types
        // In a production system, raw materials would typically have a separate inventory table
        {
          packageId: seedPackages[0].id, // Reusing package ID for demo purposes
          currentBottleCount: 50, // Representing 50 units of additive
          reservedBottleCount: 0,
          materialType: "additive",
          metadata: {
            additiveType: "potassium_metabisulfite",
            concentration: "10%",
            supplier: "Vintner Supply Co.",
            lotNumber: "KMS-2024-087",
            expirationDate: "2025-12-31",
            applicationRate: "1.5g per 10L",
            safetyNotes: "Handle with gloves, avoid inhalation",
            storageTemperature: "room temperature",
            moistureContent: "< 0.5%",
          },
          location: "Chemical Storage Room, Shelf B2",
          notes: "Sulfite for preservation and oxidation prevention",
        },
        {
          packageId: seedPackages[1].id, // Reusing package ID for demo purposes
          currentBottleCount: 200, // Representing 200L of juice
          reservedBottleCount: 50,
          materialType: "juice",
          metadata: {
            juiceType: "apple_blend",
            varietyComposition: {
              Honeycrisp: "60%",
              "Granny Smith": "40%",
            },
            brix: 14.2,
            ph: 3.8,
            pressDate: "2024-09-15",
            expirationDate: "2024-10-15",
            storageCondition: "refrigerated",
            clarification: "enzyme treated",
            yeastStrain: "ready for EC-1118",
            volumeL: 200,
          },
          location: "Cold Storage Tank T-05",
          notes: "Fresh pressed juice ready for fermentation",
        },
        {
          packageId: seedPackages[0].id, // Reusing package ID for demo purposes
          currentBottleCount: 1000, // Representing 1000 bottles
          reservedBottleCount: 100,
          materialType: "packaging",
          metadata: {
            packageType: "glass_bottle",
            size: "750ml",
            color: "antique_green",
            supplier: "Premium Glass Solutions",
            lotNumber: "PGS-750-AG-2024-Q3",
            quality: "food_grade",
            closureType: "cork_compatible",
            orderDate: "2024-08-15",
            deliveryDate: "2024-09-01",
            shelfLife: "indefinite",
            dimensions: {
              height: "315mm",
              diameter: "77mm",
              weight: "550g",
            },
          },
          location: "Packaging Warehouse, Aisle C",
          notes: "Premium glass bottles for main product line",
        },
      ])
      .returning();

    // Seed inventory transactions
    console.log("📝 Seeding inventory transactions...");
    await db.insert(inventoryTransactions).values([
      {
        inventoryId: seedInventory[0].id,
        transactionType: "sale",
        quantityChange: -50,
        transactionDate: new Date("2024-09-28"),
        reason: "Farmers market sales",
        notes: "Weekend market sales",
      },
      {
        inventoryId: seedInventory[0].id,
        transactionType: "sale",
        quantityChange: -25,
        transactionDate: new Date("2024-10-01"),
        reason: "Restaurant order",
        notes: "Local restaurant wholesale",
      },
      {
        inventoryId: seedInventory[1].id,
        transactionType: "sale",
        quantityChange: -2,
        transactionDate: new Date("2024-09-29"),
        reason: "Tasting room samples",
        notes: "Used for customer tastings",
      },
      {
        inventoryId: seedInventory[2].id, // Additive inventory
        transactionType: "transfer",
        quantityChange: -5,
        transactionDate: new Date("2024-09-20"),
        reason: "Production use",
        notes: "Used in batch B-2024-003 for stabilization",
      },
      {
        inventoryId: seedInventory[3].id, // Juice inventory
        transactionType: "transfer",
        quantityChange: -50,
        transactionDate: new Date("2024-09-16"),
        reason: "Fermentation start",
        notes: "Transferred to fermenter for new batch",
      },
      {
        inventoryId: seedInventory[4].id, // Packaging inventory
        transactionType: "transfer",
        quantityChange: -560,
        transactionDate: new Date("2024-09-26"),
        reason: "Packaging run",
        notes: "Used for batch B-2024-002 packaging",
      },
    ]);

    // Seed batch costs
    console.log("💲 Seeding batch costs...");
    await db.insert(batchCosts).values([
      {
        batchId: seedBatches[1].id, // Completed batch
        totalAppleCost: "875.50",
        laborCost: "150.00",
        overheadCost: "75.25",
        packagingCost: "168.00", // ~$0.30 per bottle
        totalCost: "1268.75",
        costPerBottle: "2.27",
        costPerL: "3.02",
        calculatedAt: new Date("2024-09-26"),
        notes: "Final cost calculation at packaging",
      },
      {
        batchId: seedBatches[0].id, // Active batch - projected
        totalAppleCost: "1250.00",
        laborCost: "120.00",
        overheadCost: "60.00",
        packagingCost: "0.00", // Not yet packaged
        totalCost: "1430.00",
        costPerBottle: null,
        costPerL: "2.38",
        calculatedAt: new Date("2024-09-17"),
        notes: "Interim cost calculation - packaging costs TBD",
      },
    ]);

    // Seed COGS items for detailed tracking
    console.log("🧾 Seeding COGS items...");
    await db.insert(cogsItems).values([
      // Detailed costs for completed batch
      {
        batchId: seedBatches[1].id,
        itemType: "apple_cost",
        description: "Gala apples from Sunrise Farm",
        cost: "450.00",
        quantity: "250.0",
        unit: "L",
        appliedAt: new Date("2024-08-20"),
        notes: "Juice volume used in batch",
      },
      {
        batchId: seedBatches[1].id,
        itemType: "apple_cost",
        description: "Fuji apples from Sunrise Farm",
        cost: "425.50",
        quantity: "180.0",
        unit: "L",
        appliedAt: new Date("2024-08-20"),
        notes: "Juice volume used in batch",
      },
      {
        batchId: seedBatches[1].id,
        itemType: "labor",
        description: "Fermentation monitoring and management",
        cost: "150.00",
        quantity: "8.0",
        unit: null,
        appliedAt: new Date("2024-09-25"),
        notes: "Labor hours at $18.75/hour",
      },
      {
        batchId: seedBatches[1].id,
        itemType: "packaging",
        description: "750ml bottles and caps",
        cost: "168.00",
        quantity: "560.0",
        unit: null,
        appliedAt: new Date("2024-09-26"),
        notes: "560 bottles at $0.30 each",
      },
    ]);

    console.log("✅ Database seeding completed successfully!");
    console.log(`   • ${seedVendors.length} vendors`);
    console.log(`   • ${seedVarieties.length} apple varieties`);
    console.log(
      `   • ${seedVendorVarieties.length} vendor-variety relationships`,
    );
    console.log(
      `   • ${seedPurchases.length} purchases with ${seedPurchaseItems.length} items`,
    );
    console.log(
      `   • ${seedPressRuns.length} press runs with ${seedPressItems.length} items`,
    );
    console.log(`   • ${seedVessels.length} vessels`);
    console.log(
      `   • ${seedBatches.length} batches with ingredients and measurements`,
    );
    console.log(
      `   • ${seedPackages.length} packages with ${seedInventory.length} inventory items (apple, additive, juice, packaging)`,
    );
    console.log("   • Complete cost tracking and COGS breakdown");
    console.log(
      "   • Material type tracking with detailed metadata for inventory management",
    );
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
