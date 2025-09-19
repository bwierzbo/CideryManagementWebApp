import { z } from 'zod'
import { router, protectedProcedure, createRbacProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { db, purchases, purchaseItems, vendors, baseFruitVarieties } from 'db'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { PdfService } from '../services/pdf/PdfService'
import { mapPurchaseToOrderData, mapPurchasesToDateRangeData } from '../services/pdf/reportDataMapper'

const pdfService = new PdfService()

// Input schemas
const purchaseOrderPdfInput = z.object({
  purchaseId: z.string().uuid()
})

const dateRangeReportInput = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  reportType: z.enum(['summary', 'detailed', 'accounting']).default('summary'),
  vendorId: z.string().uuid().optional(),
  varietyId: z.string().uuid().optional()
})

export const reportsRouter = router({
  // Generate PDF for a single purchase order
  generatePurchaseOrderPdf: createRbacProcedure('read', 'purchase')
    .input(purchaseOrderPdfInput)
    .mutation(async ({ input }) => {
      try {
        // Fetch purchase with all related data
        const purchase = await db.query.purchases.findFirst({
          where: eq(purchases.id, input.purchaseId),
          with: {
            vendor: true,
            items: {
              with: {
                fruitVariety: true
              }
            }
          }
        })

        if (!purchase) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Purchase order not found'
          })
        }

        // Convert to PDF data format
        const pdfData = mapPurchaseToOrderData(purchase)

        // Generate PDF
        const result = await pdfService.generatePurchaseOrderPdf(pdfData)

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to generate PDF: ${result.error}`
          })
        }

        return {
          success: true,
          filename: result.filename,
          contentType: result.contentType,
          data: result.buffer?.toString('base64') // Send as base64 for transport
        }

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate purchase order PDF'
        })
      }
    }),

  // Generate date range report PDF
  generateDateRangeReportPdf: createRbacProcedure('read', 'purchase')
    .input(dateRangeReportInput)
    .mutation(async ({ input }) => {
      try {
        // Build query conditions
        const conditions = [
          gte(purchases.purchaseDate, input.startDate),
          lte(purchases.purchaseDate, input.endDate)
        ]

        if (input.vendorId) {
          conditions.push(eq(purchases.vendorId, input.vendorId))
        }

        // Fetch purchases in date range
        const purchaseList = await db.query.purchases.findMany({
          where: and(...conditions),
          with: {
            vendor: true,
            items: {
              with: {
                fruitVariety: true
              },
              where: input.varietyId ? eq(purchaseItems.fruitVarietyId, input.varietyId) : undefined
            }
          },
          orderBy: [desc(purchases.purchaseDate)]
        })

        // Convert to report data format
        const reportData = mapPurchasesToDateRangeData(
          purchaseList,
          input.startDate,
          input.endDate,
          input.reportType
        )

        // Generate PDF
        const result = await pdfService.generateDateRangeReportPdf(reportData)

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to generate PDF: ${result.error}`
          })
        }

        return {
          success: true,
          filename: result.filename,
          contentType: result.contentType,
          data: result.buffer?.toString('base64') // Send as base64 for transport
        }

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate date range report PDF'
        })
      }
    }),

  // Get available vendors for filtering
  getVendors: protectedProcedure
    .query(async () => {
      const vendorList = await db.query.vendors.findMany({
        orderBy: [vendors.name]
      })

      return {
        vendors: vendorList.map(vendor => ({
          id: vendor.id,
          name: vendor.name
        }))
      }
    }),

  // Get available apple varieties for filtering
  getAppleVarieties: protectedProcedure
    .query(async () => {
      const varieties = await db.query.baseFruitVarieties.findMany({
        orderBy: [baseFruitVarieties.name]
      })

      return {
        varieties: varieties.map(variety => ({
          id: variety.id,
          name: variety.name
        }))
      }
    })
})