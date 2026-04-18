import { z } from "zod";
import { router, protectedProcedure, createRbacProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  db,
  basefruitPurchases,
  basefruitPurchaseItems,
  vendors,
  baseFruitVarieties,
  batches,
  batchCompositions,
  batchAdditives,
  packagingPurchaseItems,
  activityLaborAssignments,
  inventoryItems,
  inventoryDistributions,
} from "db";
import { bottleRuns, bottleRunMaterials } from "db/src/schema/packaging";
import { eq, and, gte, lte, desc, isNull, isNotNull, sql, inArray, ne } from "drizzle-orm";
// TODO: Re-enable PDF service when server-compatible solution is available
// import { PdfService } from "../services/pdf/PdfService";
// import {
//   mapPurchaseToOrderData,
//   mapPurchasesToDateRangeData,
// } from "../services/pdf/reportDataMapper";

// const pdfService = new PdfService();

// Input schemas
const purchaseOrderPdfInput = z.object({
  purchaseId: z.string().uuid(),
});

const dateRangeReportInput = z.object({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  reportType: z.enum(["summary", "detailed", "accounting"]).default("summary"),
  vendorId: z.string().uuid().optional(),
  varietyId: z.string().uuid().optional(),
});

const vendorAppleReportInput = z.object({
  startDate: z.date().or(z.string().transform((str) => new Date(str))),
  endDate: z.date().or(z.string().transform((str) => new Date(str))),
  vendorId: z.string().uuid().optional(),
  varietyId: z.string().uuid().optional(),
});

const vendorPerformanceInput = z.object({
  startDate: z.date().or(z.string().transform((str) => new Date(str))),
  endDate: z.date().or(z.string().transform((str) => new Date(str))),
});

export const reportsRouter = router({
  /* TODO: Re-enable when PDF service is server-compatible
  // Generate PDF for a single purchase order
  generatePurchaseOrderPdf: createRbacProcedure("read", "purchase")
    .input(purchaseOrderPdfInput)
    .mutation(async ({ input }) => {
      try {
        // Fetch purchase with all related data
        const purchase = await db.query.basefruitPurchases.findFirst({
          where: eq(basefruitPurchases.id, input.purchaseId),
          with: {
            vendor: true,
            items: {
              with: {
                fruitVariety: true,
              },
            },
          },
        });

        if (!purchase) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Purchase order not found",
          });
        }

        // Convert to PDF data format
        const pdfData = mapPurchaseToOrderData(purchase);

        // Generate PDF
        const result = await pdfService.generatePurchaseOrderPdf(pdfData);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to generate PDF: ${result.error}`,
          });
        }

        return {
          success: true,
          filename: result.filename,
          contentType: result.contentType,
          data: result.buffer?.toString("base64"), // Send as base64 for transport
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate purchase order PDF",
        });
      }
    }),

  // Generate date range report PDF
  generateDateRangeReportPdf: createRbacProcedure("read", "purchase")
    .input(dateRangeReportInput)
    .mutation(async ({ input }) => {
      try {
        // Build query conditions
        const conditions = [
          gte(basefruitPurchases.purchaseDate, input.startDate),
          lte(basefruitPurchases.purchaseDate, input.endDate),
        ];

        if (input.vendorId) {
          conditions.push(eq(basefruitPurchases.vendorId, input.vendorId));
        }

        // Fetch basefruitPurchases in date range
        const purchaseList = await db.query.basefruitPurchases.findMany({
          where: and(...conditions),
          with: {
            vendor: true,
            items: {
              with: {
                fruitVariety: true,
              },
              where: input.varietyId
                ? eq(basefruitPurchaseItems.fruitVarietyId, input.varietyId)
                : undefined,
            },
          },
          orderBy: [desc(basefruitPurchases.purchaseDate)],
        });

        // Convert to report data format
        const reportData = mapPurchasesToDateRangeData(
          purchaseList,
          input.startDate,
          input.endDate,
          input.reportType,
        );

        // Generate PDF
        const result = await pdfService.generateDateRangeReportPdf(reportData);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to generate PDF: ${result.error}`,
          });
        }

        return {
          success: true,
          filename: result.filename,
          contentType: result.contentType,
          data: result.buffer?.toString("base64"), // Send as base64 for transport
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate date range report PDF",
        });
      }
    }),
  */

  // Get available vendors for filtering
  getVendors: protectedProcedure.query(async () => {
    const vendorList = await db.query.vendors.findMany({
      orderBy: [vendors.name],
    });

    return {
      vendors: vendorList.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
      })),
    };
  }),

  // Get available apple varieties for filtering
  getAppleVarieties: protectedProcedure.query(async () => {
    const varieties = await db.query.baseFruitVarieties.findMany({
      orderBy: [baseFruitVarieties.name],
    });

    return {
      varieties: varieties.map((variety) => ({
        id: variety.id,
        name: variety.name,
      })),
    };
  }),

  // Get vendor apple purchase report data
  getVendorApplePurchaseReport: createRbacProcedure("read", "purchase")
    .input(vendorAppleReportInput)
    .query(async ({ input }) => {
      try {
        // Fetch all purchases in date range with related data
        const purchasesData = await db
          .select({
            purchaseId: basefruitPurchases.id,
            purchaseDate: basefruitPurchases.purchaseDate,
            vendorId: vendors.id,
            vendorName: vendors.name,
            itemId: basefruitPurchaseItems.id,
            fruitVarietyName: baseFruitVarieties.name,
            harvestDate: basefruitPurchaseItems.harvestDate,
            quantity: basefruitPurchaseItems.quantity,
            unit: basefruitPurchaseItems.unit,
            quantityKg: basefruitPurchaseItems.quantityKg,
            pricePerUnit: basefruitPurchaseItems.pricePerUnit,
            totalCost: basefruitPurchaseItems.totalCost,
            notes: basefruitPurchaseItems.notes,
          })
          .from(basefruitPurchases)
          .leftJoin(vendors, eq(basefruitPurchases.vendorId, vendors.id))
          .leftJoin(
            basefruitPurchaseItems,
            eq(basefruitPurchases.id, basefruitPurchaseItems.purchaseId),
          )
          .leftJoin(
            baseFruitVarieties,
            eq(basefruitPurchaseItems.fruitVarietyId, baseFruitVarieties.id),
          )
          .where(
            and(
              gte(basefruitPurchases.purchaseDate, input.startDate),
              lte(basefruitPurchases.purchaseDate, input.endDate),
              isNull(basefruitPurchases.deletedAt),
              isNull(basefruitPurchaseItems.deletedAt),
              // Optional vendor filter
              input.vendorId
                ? eq(basefruitPurchases.vendorId, input.vendorId)
                : undefined,
              // Optional variety filter
              input.varietyId
                ? eq(basefruitPurchaseItems.fruitVarietyId, input.varietyId)
                : undefined,
            ),
          )
          .orderBy(desc(basefruitPurchases.purchaseDate));

        // Group data by vendor
        const vendorMap = new Map<
          string,
          {
            vendorId: string;
            vendorName: string;
            items: Array<{
              varietyName: string;
              purchaseDate: Date;
              harvestDate: Date | null;
              quantity: number;
              unit: string;
              quantityKg: number | null;
              pricePerUnit: number | null;
              totalCost: number | null;
              notes: string | null;
            }>;
            totalCost: number;
            totalWeightKg: number;
          }
        >();

        let grandTotalCost = 0;
        let grandTotalWeightKg = 0;

        // Process each row from the flattened result set
        purchasesData.forEach((row) => {
          // Skip rows without vendor (data integrity issue)
          if (!row.vendorId || !row.vendorName) {
            console.warn(`Skipping row with missing vendor data`);
            return;
          }

          // Skip rows without item data (shouldn't happen with inner joins)
          if (!row.itemId) {
            return;
          }

          const vendorId = row.vendorId;
          const vendorName = row.vendorName;

          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              vendorId,
              vendorName,
              items: [],
              totalCost: 0,
              totalWeightKg: 0,
            });
          }

          const vendorData = vendorMap.get(vendorId)!;

          // Skip items without fruit variety (data integrity issue)
          if (!row.fruitVarietyName) {
            console.warn(`Skipping item with missing variety name`);
            return;
          }

          const quantity = row.quantity ? parseFloat(row.quantity.toString()) : 0;
          const quantityKg = row.quantityKg
            ? parseFloat(row.quantityKg.toString())
            : null;
          const pricePerUnit = row.pricePerUnit
            ? parseFloat(row.pricePerUnit.toString())
            : null;
          const totalCost = row.totalCost
            ? parseFloat(row.totalCost.toString())
            : null;

          vendorData.items.push({
            varietyName: row.fruitVarietyName,
            purchaseDate: row.purchaseDate,
            harvestDate: row.harvestDate ? new Date(row.harvestDate) : null,
            quantity,
            unit: row.unit || "kg", // Default to kg if somehow null
            quantityKg,
            pricePerUnit,
            totalCost,
            notes: row.notes,
          });

          // Accumulate vendor totals
          if (totalCost !== null) {
            vendorData.totalCost += totalCost;
          }
          if (quantityKg !== null) {
            vendorData.totalWeightKg += quantityKg;
          }
        });

        // Convert map to array and calculate grand totals
        const vendorsList = Array.from(vendorMap.values()).map((vendor) => {
          grandTotalCost += vendor.totalCost;
          grandTotalWeightKg += vendor.totalWeightKg;

          return {
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName,
            items: vendor.items,
            totalCost: vendor.totalCost,
            totalWeightKg: vendor.totalWeightKg,
          };
        });

        // Sort vendors by name
        vendorsList.sort((a, b) => a.vendorName.localeCompare(b.vendorName));

        return {
          vendors: vendorsList,
          grandTotalCost,
          grandTotalWeightKg,
        };
      } catch (error) {
        console.error("Error generating vendor apple purchase report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate vendor apple purchase report",
        });
      }
    }),

  // Get vendor performance metrics
  getVendorPerformance: createRbacProcedure("read", "purchase")
    .input(vendorPerformanceInput)
    .query(async ({ input }) => {
      try {
        // Get aggregated vendor performance data
        const performanceData = await db
          .select({
            vendorId: vendors.id,
            vendorName: vendors.name,
            orderCount: sql<number>`COUNT(DISTINCT ${basefruitPurchases.id})::int`,
            totalValue: sql<number>`COALESCE(SUM(${basefruitPurchaseItems.totalCost}), 0)::float`,
            totalWeightKg: sql<number>`COALESCE(SUM(${basefruitPurchaseItems.quantityKg}), 0)::float`,
            lastOrderDate: sql<Date | null>`MAX(${basefruitPurchases.purchaseDate})`,
          })
          .from(vendors)
          .leftJoin(
            basefruitPurchases,
            and(
              eq(basefruitPurchases.vendorId, vendors.id),
              gte(basefruitPurchases.purchaseDate, input.startDate),
              lte(basefruitPurchases.purchaseDate, input.endDate),
              isNull(basefruitPurchases.deletedAt)
            )
          )
          .leftJoin(
            basefruitPurchaseItems,
            and(
              eq(basefruitPurchaseItems.purchaseId, basefruitPurchases.id),
              isNull(basefruitPurchaseItems.deletedAt)
            )
          )
          .groupBy(vendors.id, vendors.name)
          .orderBy(desc(sql`COALESCE(SUM(${basefruitPurchaseItems.totalCost}), 0)`));

        // Calculate summary metrics
        let totalOrders = 0;
        let totalValue = 0;
        let totalWeightKg = 0;
        let vendorsWithOrders = 0;

        const vendorsList = performanceData.map((vendor) => {
          const orderCount = Number(vendor.orderCount) || 0;
          const value = Number(vendor.totalValue) || 0;
          const weightKg = Number(vendor.totalWeightKg) || 0;
          const avgOrderValue = orderCount > 0 ? value / orderCount : 0;
          const avgWeightPerOrder = orderCount > 0 ? weightKg / orderCount : 0;

          totalOrders += orderCount;
          totalValue += value;
          totalWeightKg += weightKg;
          if (orderCount > 0) vendorsWithOrders++;

          return {
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName,
            orderCount,
            totalValue: value,
            totalWeightKg: weightKg,
            avgOrderValue,
            avgWeightPerOrder,
            lastOrderDate: vendor.lastOrderDate,
          };
        });

        // Only return vendors with orders
        const activeVendors = vendorsList.filter((v) => v.orderCount > 0);

        return {
          summary: {
            totalVendors: activeVendors.length,
            totalOrders,
            totalValue,
            totalWeightKg,
            avgOrderValue: totalOrders > 0 ? totalValue / totalOrders : 0,
          },
          vendors: activeVendors,
        };
      } catch (error) {
        console.error("Error getting vendor performance:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get vendor performance data",
        });
      }
    }),

  // COGS breakdown per bottle run with aggregate totals
  cogsBreakdown: createRbacProcedure("read", "report")
    .input(
      z.object({
        dateFrom: z.date().or(z.string().transform((s) => new Date(s))).optional(),
        dateTo: z.date().or(z.string().transform((s) => new Date(s))).optional(),
        productType: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        // 1. Fetch bottle runs in date range, joined with batch info
        const dateConditions = [];
        if (input.dateFrom) {
          dateConditions.push(gte(bottleRuns.packagedAt, input.dateFrom));
        }
        if (input.dateTo) {
          dateConditions.push(lte(bottleRuns.packagedAt, input.dateTo));
        }
        if (input.productType) {
          dateConditions.push(eq(batches.productType, input.productType as any));
        }
        dateConditions.push(ne(bottleRuns.status, "voided"));

        const runsData = await db
          .select({
            id: bottleRuns.id,
            batchId: bottleRuns.batchId,
            batchName: batches.name,
            productType: batches.productType,
            packagedAt: bottleRuns.packagedAt,
            unitsProduced: bottleRuns.unitsProduced,
            volumeTakenLiters: bottleRuns.volumeTakenLiters,
            volumeTaken: bottleRuns.volumeTaken,
            overheadCostAllocated: bottleRuns.overheadCostAllocated,
            retailPrice: bottleRuns.retailPrice,
          })
          .from(bottleRuns)
          .innerJoin(batches, eq(bottleRuns.batchId, batches.id))
          .where(and(...dateConditions))
          .orderBy(desc(bottleRuns.packagedAt));

        if (runsData.length === 0) {
          return {
            runs: [],
            totals: {
              totalFruitCost: 0,
              totalAdditiveCost: 0,
              totalPackagingCost: 0,
              totalLaborCost: 0,
              totalOverheadCost: 0,
              totalCogs: 0,
              totalUnits: 0,
              totalVolume: 0,
              avgCostPerUnit: 0,
              avgCostPerLiter: 0,
              totalRevenue: 0,
              avgMargin: 0,
            },
          };
        }

        // Collect unique batch IDs and run IDs for batch queries
        const batchIds = [...new Set(runsData.map((r) => r.batchId))];
        const runIds = runsData.map((r) => r.id);

        // 2. Batch-query all cost components in parallel

        // 2a. Fruit costs by batch (batchCompositions.materialCost)
        const fruitCostRows = await db
          .select({
            batchId: batchCompositions.batchId,
            totalMaterialCost: sql<number>`COALESCE(SUM(${batchCompositions.materialCost}), 0)::float`,
          })
          .from(batchCompositions)
          .where(
            and(
              inArray(batchCompositions.batchId, batchIds),
              isNull(batchCompositions.deletedAt),
            ),
          )
          .groupBy(batchCompositions.batchId);

        const fruitCostByBatch = new Map<string, number>();
        for (const row of fruitCostRows) {
          fruitCostByBatch.set(row.batchId, row.totalMaterialCost);
        }

        // 2b. Additive costs by batch (batchAdditives.totalCost)
        const additiveCostRows = await db
          .select({
            batchId: batchAdditives.batchId,
            totalAdditiveCost: sql<number>`COALESCE(SUM(${batchAdditives.totalCost}), 0)::float`,
          })
          .from(batchAdditives)
          .where(
            and(
              inArray(batchAdditives.batchId, batchIds),
              isNull(batchAdditives.deletedAt),
            ),
          )
          .groupBy(batchAdditives.batchId);

        const additiveCostByBatch = new Map<string, number>();
        for (const row of additiveCostRows) {
          additiveCostByBatch.set(row.batchId, row.totalAdditiveCost);
        }

        // 2c. Batch total volumes (for proration: volumeTaken / batchTotalVolume)
        // Sum all volumeTakenLiters across all bottle runs per batch (total volume drawn from batch)
        const batchTotalVolumeRows = await db
          .select({
            batchId: batches.id,
            initialVolumeLiters: batches.initialVolumeLiters,
          })
          .from(batches)
          .where(inArray(batches.id, batchIds));

        const batchTotalVolume = new Map<string, number>();
        for (const row of batchTotalVolumeRows) {
          batchTotalVolume.set(
            row.batchId,
            parseFloat(row.initialVolumeLiters?.toString() ?? "0"),
          );
        }

        // 2d. Packaging costs by bottle run (bottleRunMaterials joined with packagingPurchaseItems)
        const packagingCostRows = await db
          .select({
            bottleRunId: bottleRunMaterials.bottleRunId,
            totalPackagingCost: sql<number>`COALESCE(SUM(
              ${bottleRunMaterials.quantityUsed} * COALESCE(${bottleRunMaterials.costPerUnit}, ${packagingPurchaseItems.pricePerUnit}, 0)
            ), 0)::float`,
          })
          .from(bottleRunMaterials)
          .leftJoin(
            packagingPurchaseItems,
            eq(bottleRunMaterials.packagingPurchaseItemId, packagingPurchaseItems.id),
          )
          .where(inArray(bottleRunMaterials.bottleRunId, runIds))
          .groupBy(bottleRunMaterials.bottleRunId);

        const packagingCostByRun = new Map<string, number>();
        for (const row of packagingCostRows) {
          packagingCostByRun.set(row.bottleRunId, row.totalPackagingCost);
        }

        // 2e. Direct labor costs by bottle run (activityLaborAssignments where bottleRunId = runId)
        const laborCostRows = await db
          .select({
            bottleRunId: activityLaborAssignments.bottleRunId,
            totalLaborCost: sql<number>`COALESCE(SUM(${activityLaborAssignments.laborCost}), 0)::float`,
          })
          .from(activityLaborAssignments)
          .where(
            and(
              inArray(activityLaborAssignments.bottleRunId, runIds),
              isNotNull(activityLaborAssignments.bottleRunId),
            ),
          )
          .groupBy(activityLaborAssignments.bottleRunId);

        const laborCostByRun = new Map<string, number>();
        for (const row of laborCostRows) {
          if (row.bottleRunId) {
            laborCostByRun.set(row.bottleRunId, row.totalLaborCost);
          }
        }

        // 2f. Revenue by bottle run (sum of inventoryDistributions.totalRevenue via inventoryItems)
        const revenueRows = await db
          .select({
            bottleRunId: inventoryItems.bottleRunId,
            totalRevenue: sql<number>`COALESCE(SUM(${inventoryDistributions.totalRevenue}), 0)::float`,
          })
          .from(inventoryDistributions)
          .innerJoin(
            inventoryItems,
            eq(inventoryDistributions.inventoryItemId, inventoryItems.id),
          )
          .where(
            and(
              inArray(inventoryItems.bottleRunId, runIds),
              isNotNull(inventoryItems.bottleRunId),
              isNull(inventoryItems.deletedAt),
            ),
          )
          .groupBy(inventoryItems.bottleRunId);

        const revenueByRun = new Map<string, number>();
        for (const row of revenueRows) {
          if (row.bottleRunId) {
            revenueByRun.set(row.bottleRunId, row.totalRevenue);
          }
        }

        // 3. Assemble per-run breakdown
        let totalFruitCost = 0;
        let totalAdditiveCost = 0;
        let totalPackagingCost = 0;
        let totalLaborCost = 0;
        let totalOverheadCost = 0;
        let totalCogs = 0;
        let totalUnits = 0;
        let totalVolume = 0;
        let totalRevenue = 0;
        let marginSum = 0;
        let marginCount = 0;

        const runs = runsData.map((run) => {
          const volumeTakenL = parseFloat(
            run.volumeTakenLiters?.toString() ?? run.volumeTaken?.toString() ?? "0",
          );
          const batchVolume = batchTotalVolume.get(run.batchId) || 1; // avoid division by zero
          const prorationFactor = batchVolume > 0 ? volumeTakenL / batchVolume : 0;

          const fruitCost = (fruitCostByBatch.get(run.batchId) ?? 0) * prorationFactor;
          const additiveCost = (additiveCostByBatch.get(run.batchId) ?? 0) * prorationFactor;
          const packagingCost = packagingCostByRun.get(run.id) ?? 0;
          const laborCost = laborCostByRun.get(run.id) ?? 0;
          const overheadCost = parseFloat(run.overheadCostAllocated?.toString() ?? "0");
          const runTotalCogs = fruitCost + additiveCost + packagingCost + laborCost + overheadCost;
          const unitsProduced = run.unitsProduced ?? 0;
          const costPerUnit = unitsProduced > 0 ? runTotalCogs / unitsProduced : 0;
          const costPerLiter = volumeTakenL > 0 ? runTotalCogs / volumeTakenL : 0;

          const revenue = revenueByRun.has(run.id) ? revenueByRun.get(run.id)! : null;
          const margin = revenue !== null && revenue > 0
            ? ((revenue - runTotalCogs) / revenue) * 100
            : null;

          // Accumulate totals
          totalFruitCost += fruitCost;
          totalAdditiveCost += additiveCost;
          totalPackagingCost += packagingCost;
          totalLaborCost += laborCost;
          totalOverheadCost += overheadCost;
          totalCogs += runTotalCogs;
          totalUnits += unitsProduced;
          totalVolume += volumeTakenL;
          if (revenue !== null) totalRevenue += revenue;
          if (margin !== null) {
            marginSum += margin;
            marginCount++;
          }

          return {
            id: run.id,
            batchName: run.batchName,
            productType: run.productType,
            packagedAt: run.packagedAt,
            unitsProduced,
            volumeTakenL: Math.round(volumeTakenL * 1000) / 1000,
            fruitCost: Math.round(fruitCost * 100) / 100,
            additiveCost: Math.round(additiveCost * 100) / 100,
            packagingCost: Math.round(packagingCost * 100) / 100,
            laborCost: Math.round(laborCost * 100) / 100,
            overheadCost: Math.round(overheadCost * 100) / 100,
            totalCogs: Math.round(runTotalCogs * 100) / 100,
            costPerUnit: Math.round(costPerUnit * 100) / 100,
            costPerLiter: Math.round(costPerLiter * 100) / 100,
            revenue: revenue !== null ? Math.round(revenue * 100) / 100 : null,
            margin: margin !== null ? Math.round(margin * 100) / 100 : null,
          };
        });

        return {
          runs,
          totals: {
            totalFruitCost: Math.round(totalFruitCost * 100) / 100,
            totalAdditiveCost: Math.round(totalAdditiveCost * 100) / 100,
            totalPackagingCost: Math.round(totalPackagingCost * 100) / 100,
            totalLaborCost: Math.round(totalLaborCost * 100) / 100,
            totalOverheadCost: Math.round(totalOverheadCost * 100) / 100,
            totalCogs: Math.round(totalCogs * 100) / 100,
            totalUnits,
            totalVolume: Math.round(totalVolume * 1000) / 1000,
            avgCostPerUnit: totalUnits > 0
              ? Math.round((totalCogs / totalUnits) * 100) / 100
              : 0,
            avgCostPerLiter: totalVolume > 0
              ? Math.round((totalCogs / totalVolume) * 100) / 100
              : 0,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            avgMargin: marginCount > 0
              ? Math.round((marginSum / marginCount) * 100) / 100
              : 0,
          },
        };
      } catch (error) {
        console.error("Error generating COGS breakdown:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate COGS breakdown report",
        });
      }
    }),

  /**
   * Production Summary — total liquid by state for a time period
   */
  productionSummary: createRbacProcedure("read", "report")
    .input(
      z.object({
        dateFrom: z.date().or(z.string().transform((v) => new Date(v))).optional(),
        dateTo: z.date().or(z.string().transform((v) => new Date(v))).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const dateFrom = input?.dateFrom;
        const dateTo = input?.dateTo;

        // 1. Currently in process (fermentation + aging in vessels)
        const [inProcessStats] = await db.execute(sql`
          SELECT
            COUNT(*)::int as batch_count,
            COALESCE(SUM(CAST(current_volume_liters AS NUMERIC)), 0) as volume_l,
            COUNT(CASE WHEN status = 'fermentation' THEN 1 END)::int as fermenting_count,
            COALESCE(SUM(CASE WHEN status = 'fermentation' THEN CAST(current_volume_liters AS NUMERIC) ELSE 0 END), 0) as fermenting_l,
            COUNT(CASE WHEN status = 'aging' THEN 1 END)::int as aging_count,
            COALESCE(SUM(CASE WHEN status = 'aging' THEN CAST(current_volume_liters AS NUMERIC) ELSE 0 END), 0) as aging_l
          FROM batches
          WHERE deleted_at IS NULL
            AND vessel_id IS NOT NULL
            AND status IN ('fermentation', 'aging', 'conditioning')
        `).then(r => r.rows) as any[];

        // 2. Packaged (bottles + kegs) within date range
        const bottleWhere = dateFrom && dateTo
          ? sql`br.status != 'voided' AND br.packaged_at >= ${dateFrom} AND br.packaged_at <= ${dateTo}`
          : sql`br.status != 'voided'`;

        const [bottleStats] = await db.execute(sql`
          SELECT
            COUNT(DISTINCT br.id)::int as runs,
            COALESCE(SUM(br.units_produced), 0)::int as units,
            COALESCE(SUM(CAST(br.volume_taken AS NUMERIC)), 0) as volume_l,
            COALESCE(SUM(CASE WHEN br.status = 'distributed' THEN br.units_produced ELSE 0 END), 0)::int as distributed_units,
            COALESCE(SUM(CASE WHEN br.status IN ('active', 'ready') THEN br.units_produced ELSE 0 END), 0)::int as in_stock_units
          FROM bottle_runs br
          WHERE ${bottleWhere}
        `).then(r => r.rows) as any[];

        const kegWhere = dateFrom && dateTo
          ? sql`kf.deleted_at IS NULL AND kf.status != 'voided' AND kf.filled_at >= ${dateFrom} AND kf.filled_at <= ${dateTo}`
          : sql`kf.deleted_at IS NULL AND kf.status != 'voided'`;

        const [kegStats] = await db.execute(sql`
          SELECT
            COUNT(*)::int as fills,
            COALESCE(SUM(CAST(kf.volume_taken AS NUMERIC)), 0) as volume_l,
            COUNT(CASE WHEN kf.status = 'distributed' THEN 1 END)::int as distributed,
            COUNT(CASE WHEN kf.status = 'filled' THEN 1 END)::int as in_stock
          FROM keg_fills kf
          WHERE ${kegWhere}
        `).then(r => r.rows) as any[];

        // 3. Losses (from volume adjustments)
        const lossWhere = dateFrom && dateTo
          ? sql`bva.deleted_at IS NULL AND CAST(bva.adjustment_amount AS NUMERIC) < 0 AND bva.adjustment_date >= ${dateFrom} AND bva.adjustment_date <= ${dateTo}`
          : sql`bva.deleted_at IS NULL AND CAST(bva.adjustment_amount AS NUMERIC) < 0`;

        const lossRows = await db.execute(sql`
          SELECT
            bva.adjustment_type,
            COUNT(*)::int as count,
            COALESCE(SUM(ABS(CAST(bva.adjustment_amount AS NUMERIC))), 0) as loss_l
          FROM batch_volume_adjustments bva
          WHERE ${lossWhere}
          GROUP BY bva.adjustment_type
          ORDER BY loss_l DESC
        `).then(r => r.rows) as any[];

        const lossByType = lossRows.map((r: any) => ({
          type: r.adjustment_type || "unknown",
          volumeL: parseFloat(r.loss_l || "0"),
          count: parseInt(r.count || "0"),
        }));
        const totalLossL = lossByType.reduce((s: number, r: any) => s + r.volumeL, 0);

        return {
          inProcess: {
            totalBatches: parseInt(inProcessStats?.batch_count || "0"),
            totalVolumeL: parseFloat(inProcessStats?.volume_l || "0"),
            fermenting: {
              count: parseInt(inProcessStats?.fermenting_count || "0"),
              volumeL: parseFloat(inProcessStats?.fermenting_l || "0"),
            },
            aging: {
              count: parseInt(inProcessStats?.aging_count || "0"),
              volumeL: parseFloat(inProcessStats?.aging_l || "0"),
            },
          },
          packaged: {
            bottles: {
              runs: parseInt(bottleStats?.runs || "0"),
              units: parseInt(bottleStats?.units || "0"),
              volumeL: parseFloat(bottleStats?.volume_l || "0"),
              distributed: parseInt(bottleStats?.distributed_units || "0"),
              inStock: parseInt(bottleStats?.in_stock_units || "0"),
            },
            kegs: {
              fills: parseInt(kegStats?.fills || "0"),
              volumeL: parseFloat(kegStats?.volume_l || "0"),
              distributed: parseInt(kegStats?.distributed || "0"),
              inStock: parseInt(kegStats?.in_stock || "0"),
            },
            totalVolumeL: parseFloat(bottleStats?.volume_l || "0") + parseFloat(kegStats?.volume_l || "0"),
          },
          losses: {
            totalVolumeL: totalLossL,
            byType: lossByType,
          },
        };
      } catch (error) {
        console.error("Error generating production summary:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate production summary",
        });
      }
    }),
});
