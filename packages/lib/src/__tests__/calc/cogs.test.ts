import { describe, it, expect } from "vitest";
import {
  calculateTotalCogs,
  calculateCogsComponents,
  calculateCostPerLiter,
  calculateCostPerBottle,
  calculateGrossMargin,
  calculateMarkup,
  allocateSharedCosts,
  calculateYieldVarianceCostImpact,
  getCogsPerformanceCategory,
  calculateInventoryValue,
  calculateWeightedAverageCostPerKg,
  calculateAppleCostFromPurchases,
  calculateCogsFromPurchases,
  calculateTotalCogsFromPurchases,
  type BatchCostData,
  type CostAllocationConfig,
  type PurchaseItemData,
  type PressRunData,
} from "../../calc/cogs";

describe("COGS Calculations", () => {
  const defaultBatchData: BatchCostData = {
    batchId: "batch-001",
    juiceVolumeL: 1000,
    appleWeightKg: 1500,
    laborHours: 8,
    packagingUnits: 500,
    bottleCount: 500,
  };

  const defaultConfig: CostAllocationConfig = {
    appleCostPerKg: 2.5,
    laborRatePerHour: 25.0,
    overheadRatePerL: 0.75,
    packagingCostPerUnit: 1.2,
    wastageRate: 5.0,
  };

  describe("calculateTotalCogs", () => {
    it("should calculate total COGS correctly with default values", () => {
      const totalCogs = calculateTotalCogs(defaultBatchData, defaultConfig);

      // Expected:
      // Apple: 1500 * 1.05 * 2.50 = 3937.50
      // Labor: 8 * 25.00 = 200.00
      // Overhead: 1000 * 0.75 = 750.00
      // Packaging: 500 * 1.20 = 600.00
      // Total: 5487.50
      expect(totalCogs).toBe(5487.5);
    });

    it("should handle different wastage rates", () => {
      const zeroWastageConfig = { ...defaultConfig, wastageRate: 0 };
      const zeroWastageTotal = calculateTotalCogs(
        defaultBatchData,
        zeroWastageConfig,
      );

      const highWastageConfig = { ...defaultConfig, wastageRate: 10 };
      const highWastageTotal = calculateTotalCogs(
        defaultBatchData,
        highWastageConfig,
      );

      expect(highWastageTotal).toBeGreaterThan(zeroWastageTotal);

      // With 0% wastage: Apple cost = 1500 * 2.50 = 3750
      // With 10% wastage: Apple cost = 1500 * 1.10 * 2.50 = 4125
      // Difference should be 375
      expect(highWastageTotal - zeroWastageTotal).toBe(375);
    });

    it("should round to 2 decimal places", () => {
      const config = { ...defaultConfig, appleCostPerKg: 2.333 };
      const total = calculateTotalCogs(defaultBatchData, config);

      const decimalPlaces = total.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it("should throw error for invalid juice volume", () => {
      const invalidBatch = { ...defaultBatchData, juiceVolumeL: 0 };
      expect(() => calculateTotalCogs(invalidBatch, defaultConfig)).toThrow(
        "Juice volume must be positive",
      );

      const negativeBatch = { ...defaultBatchData, juiceVolumeL: -100 };
      expect(() => calculateTotalCogs(negativeBatch, defaultConfig)).toThrow(
        "Juice volume must be positive",
      );
    });

    it("should throw error for invalid apple weight", () => {
      const invalidBatch = { ...defaultBatchData, appleWeightKg: 0 };
      expect(() => calculateTotalCogs(invalidBatch, defaultConfig)).toThrow(
        "Apple weight must be positive",
      );
    });

    it("should throw error for invalid wastage rate", () => {
      const invalidConfig = { ...defaultConfig, wastageRate: -5 };
      expect(() => calculateTotalCogs(defaultBatchData, invalidConfig)).toThrow(
        "Wastage rate must be between 0 and 100 percent",
      );

      const highWastageConfig = { ...defaultConfig, wastageRate: 150 };
      expect(() =>
        calculateTotalCogs(defaultBatchData, highWastageConfig),
      ).toThrow("Wastage rate must be between 0 and 100 percent");
    });

    it("should handle edge case of 100% wastage rate", () => {
      const maxWastageConfig = { ...defaultConfig, wastageRate: 100 };
      const total = calculateTotalCogs(defaultBatchData, maxWastageConfig);

      // Apple cost should double: 1500 * 2.0 * 2.50 = 7500
      expect(total).toBe(9050.0); // 7500 + 200 + 750 + 600
    });
  });

  describe("calculateCogsComponents", () => {
    it("should return all four COGS components", () => {
      const components = calculateCogsComponents(
        defaultBatchData,
        defaultConfig,
      );

      expect(components).toHaveLength(4);
      expect(components.map((c) => c.itemType)).toEqual([
        "apple_cost",
        "labor",
        "overhead",
        "packaging",
      ]);
    });

    it("should calculate apple cost with wastage adjustment", () => {
      const components = calculateCogsComponents(
        defaultBatchData,
        defaultConfig,
      );
      const appleCost = components.find((c) => c.itemType === "apple_cost");

      expect(appleCost).toBeDefined();
      expect(appleCost!.amount).toBe(3937.5); // 1500 * 1.05 * 2.50
      expect(appleCost!.quantity).toBe(1575); // 1500 * 1.05
      expect(appleCost!.unitCost).toBe(2.5);
      expect(appleCost!.description).toContain("5% wastage");
    });

    it("should calculate labor cost correctly", () => {
      const components = calculateCogsComponents(
        defaultBatchData,
        defaultConfig,
      );
      const laborCost = components.find((c) => c.itemType === "labor");

      expect(laborCost).toBeDefined();
      expect(laborCost!.amount).toBe(200.0); // 8 * 25.00
      expect(laborCost!.quantity).toBe(8);
      expect(laborCost!.unitCost).toBe(25.0);
    });

    it("should calculate overhead cost correctly", () => {
      const components = calculateCogsComponents(
        defaultBatchData,
        defaultConfig,
      );
      const overheadCost = components.find((c) => c.itemType === "overhead");

      expect(overheadCost).toBeDefined();
      expect(overheadCost!.amount).toBe(750.0); // 1000 * 0.75
      expect(overheadCost!.quantity).toBe(1000);
      expect(overheadCost!.unitCost).toBe(0.75);
    });

    it("should calculate packaging cost correctly", () => {
      const components = calculateCogsComponents(
        defaultBatchData,
        defaultConfig,
      );
      const packagingCost = components.find((c) => c.itemType === "packaging");

      expect(packagingCost).toBeDefined();
      expect(packagingCost!.amount).toBe(600.0); // 500 * 1.20
      expect(packagingCost!.quantity).toBe(500);
      expect(packagingCost!.unitCost).toBe(1.2);
    });

    it("should have component amounts sum to total COGS", () => {
      const components = calculateCogsComponents(
        defaultBatchData,
        defaultConfig,
      );
      const totalCogs = calculateTotalCogs(defaultBatchData, defaultConfig);

      const componentSum = components.reduce((sum, c) => sum + c.amount, 0);
      expect(componentSum).toBe(totalCogs);
    });
  });

  describe("calculateCostPerLiter", () => {
    it("should calculate cost per liter correctly", () => {
      const costPerL = calculateCostPerLiter(5487.5, 1000);
      expect(costPerL).toBe(5.4875);
    });

    it("should round to 4 decimal places", () => {
      const costPerL = calculateCostPerLiter(100, 333);
      expect(costPerL).toBe(0.3003);
    });

    it("should handle zero COGS", () => {
      const costPerL = calculateCostPerLiter(0, 1000);
      expect(costPerL).toBe(0);
    });

    it("should throw error for negative COGS", () => {
      expect(() => calculateCostPerLiter(-100, 1000)).toThrow(
        "Total COGS must be non-negative",
      );
    });

    it("should throw error for invalid volume", () => {
      expect(() => calculateCostPerLiter(1000, 0)).toThrow(
        "Final volume must be positive",
      );

      expect(() => calculateCostPerLiter(1000, -500)).toThrow(
        "Final volume must be positive",
      );
    });
  });

  describe("calculateCostPerBottle", () => {
    it("should calculate cost per bottle correctly", () => {
      const costPerBottle = calculateCostPerBottle(5487.5, 500);
      expect(costPerBottle).toBe(10.98);
    });

    it("should round to 2 decimal places", () => {
      const costPerBottle = calculateCostPerBottle(100, 33);
      expect(costPerBottle).toBe(3.03);
    });

    it("should handle zero COGS", () => {
      const costPerBottle = calculateCostPerBottle(0, 100);
      expect(costPerBottle).toBe(0);
    });

    it("should throw error for negative COGS", () => {
      expect(() => calculateCostPerBottle(-100, 50)).toThrow(
        "Total COGS must be non-negative",
      );
    });

    it("should throw error for invalid bottle count", () => {
      expect(() => calculateCostPerBottle(1000, 0)).toThrow(
        "Bottle count must be positive",
      );

      expect(() => calculateCostPerBottle(1000, -10)).toThrow(
        "Bottle count must be positive",
      );
    });
  });

  describe("calculateGrossMargin", () => {
    it("should calculate positive gross margin correctly", () => {
      // Selling at $15, cost $10 = 33.33% margin
      const margin = calculateGrossMargin(15, 10);
      expect(margin).toBe(33.33);
    });

    it("should calculate zero margin when price equals cost", () => {
      const margin = calculateGrossMargin(10, 10);
      expect(margin).toBe(0);
    });

    it("should calculate negative margin when cost exceeds price", () => {
      // Selling at $8, cost $10 = -25% margin (loss)
      const margin = calculateGrossMargin(8, 10);
      expect(margin).toBe(-25);
    });

    it("should round to 2 decimal places", () => {
      const margin = calculateGrossMargin(10.33, 7.11);
      expect(margin).toBe(31.17);
    });

    it("should throw error for invalid selling price", () => {
      expect(() => calculateGrossMargin(0, 5)).toThrow(
        "Selling price must be positive",
      );

      expect(() => calculateGrossMargin(-10, 5)).toThrow(
        "Selling price must be positive",
      );
    });

    it("should throw error for negative COGS", () => {
      expect(() => calculateGrossMargin(15, -5)).toThrow(
        "COGS cost must be non-negative",
      );
    });
  });

  describe("calculateMarkup", () => {
    it("should calculate markup correctly", () => {
      // Cost $10, selling $15 = 50% markup
      const markup = calculateMarkup(15, 10);
      expect(markup).toBe(50);
    });

    it("should calculate zero markup when price equals cost", () => {
      const markup = calculateMarkup(10, 10);
      expect(markup).toBe(0);
    });

    it("should calculate negative markup when price is below cost", () => {
      // Cost $10, selling $8 = -20% markup
      const markup = calculateMarkup(8, 10);
      expect(markup).toBe(-20);
    });

    it("should throw error for invalid selling price", () => {
      expect(() => calculateMarkup(0, 10)).toThrow(
        "Selling price must be positive",
      );
    });

    it("should throw error for invalid COGS cost", () => {
      expect(() => calculateMarkup(15, 0)).toThrow(
        "COGS cost must be positive for markup calculation",
      );

      expect(() => calculateMarkup(15, -5)).toThrow(
        "COGS cost must be positive for markup calculation",
      );
    });
  });

  describe("allocateSharedCosts", () => {
    it("should allocate costs proportionally by volume", () => {
      const batches = [
        { batchId: "batch-1", volumeL: 1000 },
        { batchId: "batch-2", volumeL: 500 },
        { batchId: "batch-3", volumeL: 1500 },
      ];

      const allocations = allocateSharedCosts(3000, batches);

      expect(allocations).toHaveLength(3);
      expect(allocations[0].allocatedCost).toBe(1000); // 1000/3000 * 3000
      expect(allocations[1].allocatedCost).toBe(500); // 500/3000 * 3000
      expect(allocations[2].allocatedCost).toBe(1500); // 1500/3000 * 3000

      const totalAllocated = allocations.reduce(
        (sum, a) => sum + a.allocatedCost,
        0,
      );
      expect(totalAllocated).toBe(3000);
    });

    it("should handle single batch allocation", () => {
      const batches = [{ batchId: "batch-1", volumeL: 500 }];
      const allocations = allocateSharedCosts(1000, batches);

      expect(allocations).toHaveLength(1);
      expect(allocations[0].allocatedCost).toBe(1000);
    });

    it("should handle zero shared cost", () => {
      const batches = [
        { batchId: "batch-1", volumeL: 100 },
        { batchId: "batch-2", volumeL: 200 },
      ];

      const allocations = allocateSharedCosts(0, batches);

      allocations.forEach((allocation) => {
        expect(allocation.allocatedCost).toBe(0);
      });
    });

    it("should throw error for negative shared cost", () => {
      const batches = [{ batchId: "batch-1", volumeL: 100 }];
      expect(() => allocateSharedCosts(-500, batches)).toThrow(
        "Shared cost must be non-negative",
      );
    });

    it("should throw error for empty batch array", () => {
      expect(() => allocateSharedCosts(1000, [])).toThrow(
        "At least one batch is required for cost allocation",
      );
    });

    it("should throw error for invalid batch volumes", () => {
      const invalidBatches = [{ batchId: "batch-1", volumeL: -100 }];
      expect(() => allocateSharedCosts(1000, invalidBatches)).toThrow(
        "Batch batch-1 volume must be positive",
      );
    });
  });

  describe("calculateYieldVarianceCostImpact", () => {
    it("should increase cost when actual yield is lower than expected", () => {
      const adjustedCost = calculateYieldVarianceCostImpact(0.6, 0.5, 10.0);
      expect(adjustedCost).toBe(12.0); // Cost increases by 20%
    });

    it("should decrease cost when actual yield is higher than expected", () => {
      const adjustedCost = calculateYieldVarianceCostImpact(0.6, 0.75, 10.0);
      expect(adjustedCost).toBe(8.0); // Cost decreases by 20%
    });

    it("should return same cost when yields are equal", () => {
      const adjustedCost = calculateYieldVarianceCostImpact(0.6, 0.6, 10.0);
      expect(adjustedCost).toBe(10.0);
    });

    it("should round to 4 decimal places", () => {
      const adjustedCost = calculateYieldVarianceCostImpact(
        0.6123,
        0.5456,
        10.33,
      );
      const decimalPlaces = adjustedCost.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it("should throw error for invalid yields", () => {
      expect(() => calculateYieldVarianceCostImpact(0, 0.5, 10)).toThrow(
        "Yield values must be positive",
      );

      expect(() => calculateYieldVarianceCostImpact(0.6, -0.1, 10)).toThrow(
        "Yield values must be positive",
      );
    });

    it("should throw error for negative base cost", () => {
      expect(() => calculateYieldVarianceCostImpact(0.6, 0.5, -10)).toThrow(
        "Base cost per liter must be non-negative",
      );
    });
  });

  describe("getCogsPerformanceCategory", () => {
    it("should categorize COGS performance correctly", () => {
      // Test all performance categories
      expect(getCogsPerformanceCategory(90, 100)).toBe("Excellent"); // 10% under budget
      expect(getCogsPerformanceCategory(95, 100)).toBe("Good"); // 5% under budget
      expect(getCogsPerformanceCategory(102, 100)).toBe("On Target"); // 2% over budget
      expect(getCogsPerformanceCategory(110, 100)).toBe("Over Budget"); // 10% over budget
      expect(getCogsPerformanceCategory(120, 100)).toBe(
        "Significantly Over Budget",
      ); // 20% over
    });

    it("should handle boundary conditions", () => {
      expect(getCogsPerformanceCategory(89.99, 100)).toBe("Excellent");
      expect(getCogsPerformanceCategory(90.0, 100)).toBe("Excellent");
      expect(getCogsPerformanceCategory(95.01, 100)).toBe("On Target");
      expect(getCogsPerformanceCategory(105.0, 100)).toBe("On Target");
      expect(getCogsPerformanceCategory(115.0, 100)).toBe("Over Budget");
    });

    it("should throw error for invalid COGS values", () => {
      expect(() => getCogsPerformanceCategory(-100, 100)).toThrow(
        "COGS values must be positive",
      );

      expect(() => getCogsPerformanceCategory(100, 0)).toThrow(
        "COGS values must be positive",
      );
    });
  });

  describe("calculateInventoryValue", () => {
    it("should calculate inventory value correctly", () => {
      const value = calculateInventoryValue(100, 12.5);
      expect(value).toBe(1250.0);
    });

    it("should handle zero inventory", () => {
      const value = calculateInventoryValue(0, 12.5);
      expect(value).toBe(0);
    });

    it("should handle zero COGS per bottle", () => {
      const value = calculateInventoryValue(100, 0);
      expect(value).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      const value = calculateInventoryValue(33, 3.333);
      expect(value).toBe(109.99);
    });

    it("should throw error for negative inventory", () => {
      expect(() => calculateInventoryValue(-10, 12.5)).toThrow(
        "Inventory bottles must be non-negative",
      );
    });

    it("should throw error for negative COGS per bottle", () => {
      expect(() => calculateInventoryValue(100, -5)).toThrow(
        "COGS per bottle must be non-negative",
      );
    });
  });

  describe("COGS Integration Tests", () => {
    it("should calculate end-to-end batch costing correctly", () => {
      // Real-world scenario: 500 bottles from 1000L batch
      const batchData: BatchCostData = {
        batchId: "fall-harvest-001",
        juiceVolumeL: 1000,
        appleWeightKg: 1600, // Good yield day
        laborHours: 12, // Full day production
        packagingUnits: 500,
        bottleCount: 500,
      };

      const config: CostAllocationConfig = {
        appleCostPerKg: 1.75, // Bulk purchase rate
        laborRatePerHour: 22.5, // Including benefits
        overheadRatePerL: 0.85, // Utilities, rent, equipment
        packagingCostPerUnit: 0.95, // Bottles, labels, caps
        wastageRate: 8.0, // Realistic wastage
      };

      const totalCogs = calculateTotalCogs(batchData, config);
      const costPerBottle = calculateCostPerBottle(totalCogs, 500);
      const grossMargin = calculateGrossMargin(18.0, costPerBottle); // $18 selling price

      // Verify reasonable ranges
      expect(totalCogs).toBeGreaterThan(3000);
      expect(totalCogs).toBeLessThan(6000);
      expect(costPerBottle).toBeGreaterThan(6);
      expect(costPerBottle).toBeLessThan(12);
      expect(grossMargin).toBeGreaterThan(30); // Healthy margin
      expect(grossMargin).toBeLessThan(70);
    });

    it("should demonstrate cost impact of poor vs excellent yields", () => {
      const poorYieldBatch = { ...defaultBatchData, appleWeightKg: 2000 }; // Poor yield
      const excellentYieldBatch = { ...defaultBatchData, appleWeightKg: 1200 }; // Excellent yield

      const poorCogs = calculateTotalCogs(poorYieldBatch, defaultConfig);
      const excellentCogs = calculateTotalCogs(
        excellentYieldBatch,
        defaultConfig,
      );

      // Poor yield should cost more due to more apples needed
      expect(poorCogs).toBeGreaterThan(excellentCogs);

      const costDifference = poorCogs - excellentCogs;
      const expectedDifference = (2000 - 1200) * 1.05 * 2.5; // Apple cost difference
      expect(costDifference).toBe(expectedDifference);
    });

    it("should show impact of different cost structures on margins", () => {
      const highLaborConfig = { ...defaultConfig, laborRatePerHour: 35.0 };
      const lowOverheadConfig = { ...defaultConfig, overheadRatePerL: 0.25 };

      const highLaborCogs = calculateTotalCogs(
        defaultBatchData,
        highLaborConfig,
      );
      const lowOverheadCogs = calculateTotalCogs(
        defaultBatchData,
        lowOverheadConfig,
      );
      const baseCogs = calculateTotalCogs(defaultBatchData, defaultConfig);

      expect(highLaborCogs).toBeGreaterThan(baseCogs);
      expect(lowOverheadCogs).toBeLessThan(baseCogs);

      // Labor impact: 8 hours * $10 difference = $80
      expect(highLaborCogs - baseCogs).toBe(80);

      // Overhead impact: 1000L * $0.50 difference = $500
      expect(baseCogs - lowOverheadCogs).toBe(500);
    });
  });

  describe("Purchase Cost Integration", () => {
    const samplePurchaseItems: PurchaseItemData[] = [
      {
        id: "purchase-item-1",
        quantity: 1000,
        quantityKg: 1000,
        pricePerUnit: 2.5,
        totalCost: 2500.0,
        appleVarietyId: "variety-1",
      },
      {
        id: "purchase-item-2",
        quantity: 500,
        quantityKg: 500,
        pricePerUnit: null, // Free apples
        totalCost: null,
        appleVarietyId: "variety-2",
      },
      {
        id: "purchase-item-3",
        quantity: 200,
        quantityKg: 200,
        pricePerUnit: 3.0,
        totalCost: 600.0,
        appleVarietyId: "variety-1",
      },
    ];

    const samplePressRun: PressRunData = {
      id: "press-run-1",
      totalAppleProcessedKg: 1500,
      totalJuiceProducedL: 1000,
      items: [
        {
          purchaseItemId: "purchase-item-1",
          quantityUsedKg: 800, // Use 800kg of paid apples
          juiceProducedL: 600,
        },
        {
          purchaseItemId: "purchase-item-2",
          quantityUsedKg: 500, // Use 500kg of free apples
          juiceProducedL: 300,
        },
        {
          purchaseItemId: "purchase-item-3",
          quantityUsedKg: 200, // Use 200kg of premium paid apples
          juiceProducedL: 100,
        },
      ],
    };

    describe("calculateWeightedAverageCostPerKg", () => {
      it("should calculate weighted average including free apples", () => {
        const avgCost = calculateWeightedAverageCostPerKg(samplePurchaseItems);

        // Expected: (2500 + 0 + 600) / (1000 + 500 + 200) = 3100 / 1700 = 1.8235
        expect(avgCost).toBe(1.8235);
      });

      it("should return 0 for all free apples", () => {
        const freeItems: PurchaseItemData[] = [
          {
            id: "free-1",
            quantity: 1000,
            quantityKg: 1000,
            pricePerUnit: null,
            totalCost: null,
            appleVarietyId: "variety-1",
          },
        ];

        const avgCost = calculateWeightedAverageCostPerKg(freeItems);
        expect(avgCost).toBe(0);
      });

      it("should handle empty purchase items", () => {
        const avgCost = calculateWeightedAverageCostPerKg([]);
        expect(avgCost).toBe(0);
      });

      it("should handle zero weight items", () => {
        const zeroWeightItems: PurchaseItemData[] = [
          {
            id: "zero-weight-1",
            quantity: 0,
            quantityKg: 0,
            pricePerUnit: 5.0,
            totalCost: 0,
            appleVarietyId: "variety-1",
          },
        ];

        const avgCost = calculateWeightedAverageCostPerKg(zeroWeightItems);
        expect(avgCost).toBe(0);
      });
    });

    describe("calculateAppleCostFromPurchases", () => {
      it("should calculate apple cost with mixed free and paid sources", () => {
        const result = calculateAppleCostFromPurchases(
          samplePressRun,
          samplePurchaseItems,
        );

        expect(result.totalCost).toBe(2600.0); // 800*2.50 + 500*0 + 200*3.00 = 2000 + 0 + 600
        expect(result.freeAppleKg).toBe(500);
        expect(result.paidAppleKg).toBe(1000); // 800 + 200
        expect(result.averageCostPerKg).toBe(1.7333); // 2600 / 1500

        expect(result.breakdown).toHaveLength(3);
        expect(result.breakdown[0].isFree).toBe(false);
        expect(result.breakdown[0].totalCost).toBe(2000.0);
        expect(result.breakdown[1].isFree).toBe(true);
        expect(result.breakdown[1].totalCost).toBe(0);
        expect(result.breakdown[2].isFree).toBe(false);
        expect(result.breakdown[2].totalCost).toBe(600.0);
      });

      it("should handle all free apples", () => {
        const freeItems: PurchaseItemData[] = [
          {
            id: "free-1",
            quantity: 1000,
            quantityKg: 1000,
            pricePerUnit: null,
            totalCost: null,
            appleVarietyId: "variety-1",
          },
        ];

        const freePressRun: PressRunData = {
          id: "press-run-free",
          totalAppleProcessedKg: 1000,
          totalJuiceProducedL: 700,
          items: [
            {
              purchaseItemId: "free-1",
              quantityUsedKg: 1000,
              juiceProducedL: 700,
            },
          ],
        };

        const result = calculateAppleCostFromPurchases(freePressRun, freeItems);

        expect(result.totalCost).toBe(0);
        expect(result.freeAppleKg).toBe(1000);
        expect(result.paidAppleKg).toBe(0);
        expect(result.averageCostPerKg).toBe(0);
        expect(result.breakdown[0].isFree).toBe(true);
      });

      it("should handle zero price per unit as free", () => {
        const zeroPrice: PurchaseItemData[] = [
          {
            id: "zero-price-1",
            quantity: 500,
            quantityKg: 500,
            pricePerUnit: 0, // Explicitly zero price
            totalCost: 0,
            appleVarietyId: "variety-1",
          },
        ];

        const zeroPressRun: PressRunData = {
          id: "press-run-zero",
          totalAppleProcessedKg: 500,
          totalJuiceProducedL: 350,
          items: [
            {
              purchaseItemId: "zero-price-1",
              quantityUsedKg: 500,
              juiceProducedL: 350,
            },
          ],
        };

        const result = calculateAppleCostFromPurchases(zeroPressRun, zeroPrice);

        expect(result.totalCost).toBe(0);
        expect(result.freeAppleKg).toBe(500);
        expect(result.paidAppleKg).toBe(0);
        expect(result.breakdown[0].isFree).toBe(true);
      });

      it("should throw error for missing purchase item", () => {
        const incompletePressRun: PressRunData = {
          ...samplePressRun,
          items: [
            {
              purchaseItemId: "missing-item",
              quantityUsedKg: 100,
              juiceProducedL: 70,
            },
          ],
        };

        expect(() => {
          calculateAppleCostFromPurchases(
            incompletePressRun,
            samplePurchaseItems,
          );
        }).toThrow("Purchase item missing-item not found");
      });
    });

    describe("calculateCogsFromPurchases", () => {
      it("should calculate COGS with actual purchase data", () => {
        const purchaseCostData = {
          totalCost: 2600.0,
          averageCostPerKg: 1.7333,
          freeAppleKg: 500,
          paidAppleKg: 1000,
        };

        const config = {
          laborRatePerHour: 25.0,
          overheadRatePerL: 0.75,
          packagingCostPerUnit: 1.2,
          wastageRate: 5.0,
        };

        const components = calculateCogsFromPurchases(
          defaultBatchData,
          purchaseCostData,
          config,
        );

        expect(components).toHaveLength(4);

        // Apple cost with wastage: 2600 * 1.05 = 2730
        const appleCost = components.find((c) => c.itemType === "apple_cost");
        expect(appleCost?.amount).toBe(2730.0);
        expect(appleCost?.description).toContain("500kg free + 1000kg paid");
        expect(appleCost?.description).toContain("5% wastage");

        // Other components should be same as original logic
        const laborCost = components.find((c) => c.itemType === "labor");
        expect(laborCost?.amount).toBe(200.0); // 8 * 25.00

        const overheadCost = components.find((c) => c.itemType === "overhead");
        expect(overheadCost?.amount).toBe(750.0); // 1000 * 0.75

        const packagingCost = components.find(
          (c) => c.itemType === "packaging",
        );
        expect(packagingCost?.amount).toBe(600.0); // 500 * 1.20
      });

      it("should handle all free apples with zero wastage", () => {
        const freePurchaseCostData = {
          totalCost: 0,
          averageCostPerKg: 0,
          freeAppleKg: 1500,
          paidAppleKg: 0,
        };

        const zeroWastageConfig = {
          laborRatePerHour: 25.0,
          overheadRatePerL: 0.75,
          packagingCostPerUnit: 1.2,
          wastageRate: 0,
        };

        const components = calculateCogsFromPurchases(
          defaultBatchData,
          freePurchaseCostData,
          zeroWastageConfig,
        );

        const appleCost = components.find((c) => c.itemType === "apple_cost");
        expect(appleCost?.amount).toBe(0);
        expect(appleCost?.description).toContain("1500kg free + 0kg paid");
      });
    });

    describe("calculateTotalCogsFromPurchases", () => {
      it("should match sum of components", () => {
        const purchaseCostData = {
          totalCost: 2600.0,
          averageCostPerKg: 1.7333,
          freeAppleKg: 500,
          paidAppleKg: 1000,
        };

        const config = {
          laborRatePerHour: 25.0,
          overheadRatePerL: 0.75,
          packagingCostPerUnit: 1.2,
          wastageRate: 5.0,
        };

        const totalCogs = calculateTotalCogsFromPurchases(
          defaultBatchData,
          purchaseCostData,
          config,
        );
        const components = calculateCogsFromPurchases(
          defaultBatchData,
          purchaseCostData,
          config,
        );
        const componentSum = components.reduce((sum, c) => sum + c.amount, 0);

        expect(totalCogs).toBe(componentSum);
        // Expected: 2730 + 200 + 750 + 600 = 4280
        expect(totalCogs).toBe(4280.0);
      });

      it("should handle all free apples scenario", () => {
        const freePurchaseCostData = {
          totalCost: 0,
          averageCostPerKg: 0,
          freeAppleKg: 1500,
          paidAppleKg: 0,
        };

        const config = {
          laborRatePerHour: 25.0,
          overheadRatePerL: 0.75,
          packagingCostPerUnit: 1.2,
          wastageRate: 5.0,
        };

        const totalCogs = calculateTotalCogsFromPurchases(
          defaultBatchData,
          freePurchaseCostData,
          config,
        );

        // Only labor, overhead, and packaging costs: 200 + 750 + 600 = 1550
        expect(totalCogs).toBe(1550.0);
      });
    });

    describe("Purchase Integration Scenarios", () => {
      it("should demonstrate cost impact of free vs paid apples", () => {
        // Scenario 1: All paid apples at $2.50/kg
        const allPaidData = {
          totalCost: 3750.0, // 1500kg * $2.50
          averageCostPerKg: 2.5,
          freeAppleKg: 0,
          paidAppleKg: 1500,
        };

        // Scenario 2: 50% free apples
        const mixedData = {
          totalCost: 1875.0, // 750kg * $2.50
          averageCostPerKg: 1.25, // 1875 / 1500
          freeAppleKg: 750,
          paidAppleKg: 750,
        };

        // Scenario 3: All free apples
        const allFreeData = {
          totalCost: 0,
          averageCostPerKg: 0,
          freeAppleKg: 1500,
          paidAppleKg: 0,
        };

        const config = {
          laborRatePerHour: 25.0,
          overheadRatePerL: 0.75,
          packagingCostPerUnit: 1.2,
          wastageRate: 5.0,
        };

        const allPaidCogs = calculateTotalCogsFromPurchases(
          defaultBatchData,
          allPaidData,
          config,
        );
        const mixedCogs = calculateTotalCogsFromPurchases(
          defaultBatchData,
          mixedData,
          config,
        );
        const allFreeCogs = calculateTotalCogsFromPurchases(
          defaultBatchData,
          allFreeData,
          config,
        );

        // All paid should be most expensive
        expect(allPaidCogs).toBeGreaterThan(mixedCogs);
        expect(mixedCogs).toBeGreaterThan(allFreeCogs);

        // Cost difference should be apple cost difference (with wastage)
        const appleCostDiff =
          (allPaidData.totalCost - mixedData.totalCost) * 1.05;
        expect(allPaidCogs - mixedCogs).toBe(appleCostDiff);

        // Free apples save significant costs
        const freeAppleSavings = allPaidCogs - allFreeCogs;
        expect(freeAppleSavings).toBe(3937.5); // 3750 * 1.05
      });

      it("should show correct cost per bottle with free ingredients", () => {
        const mixedData = {
          totalCost: 1000.0,
          averageCostPerKg: 0.67, // 1000 / 1500
          freeAppleKg: 1000,
          paidAppleKg: 500,
        };

        const config = {
          laborRatePerHour: 20.0,
          overheadRatePerL: 0.5,
          packagingCostPerUnit: 1.0,
          wastageRate: 10.0,
        };

        const totalCogs = calculateTotalCogsFromPurchases(
          defaultBatchData,
          mixedData,
          config,
        );
        const costPerBottle = calculateCostPerBottle(totalCogs, 500);

        // This should be significantly lower than all-paid scenario
        expect(costPerBottle).toBeLessThan(6.0); // Reasonable for 50% free apples
        expect(totalCogs).toBeGreaterThan(1000); // Should include non-apple costs
      });
    });
  });
});
