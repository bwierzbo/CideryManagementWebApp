import { z } from "zod";
import { router, protectedProcedure, createRbacProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  db,
  basefruitPurchases,
  basefruitPurchaseItems,
  vendors,
  baseFruitVarieties,
} from "db";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
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
});
