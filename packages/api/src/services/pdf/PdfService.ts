import PDFDocument from 'pdfkit'
import type {
  PdfGenerationOptions,
  PurchaseOrderData,
  DateRangeReportData,
  PdfGenerationResult,
  PdfGenerationError
} from './types'

export class PdfService {
  private createDocument(options: PdfGenerationOptions = {}): PDFDocument {
    return new PDFDocument({
      size: options.format || 'A4',
      margin: options.margin || 50,
      bufferPages: true
    })
  }

  private addHeader(doc: PDFDocument, title: string): void {
    // Add company header
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('Cidery Management System', 50, 50)

    doc.fontSize(14)
       .font('Helvetica')
       .text(title, 50, 80)

    // Add a line under header
    doc.moveTo(50, 110)
       .lineTo(550, 110)
       .stroke()
  }

  private addFooter(doc: PDFDocument): void {
    const pageHeight = doc.page.height
    const footerY = pageHeight - 100

    // Add generation timestamp
    doc.fontSize(8)
       .font('Helvetica')
       .text(`Generated on ${new Date().toLocaleString()}`, 50, footerY, {
         align: 'left'
       })

    // Add page numbers
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - 100, footerY, {
        align: 'right'
      })
    }
  }

  async generatePurchaseOrderPdf(data: PurchaseOrderData, options: PdfGenerationOptions = {}): Promise<PdfGenerationResult> {
    try {
      const doc = this.createDocument(options)
      let yPosition = 130

      // Header
      this.addHeader(doc, 'Purchase Order Confirmation')

      // Purchase Order Details
      yPosition += 20
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Purchase Order Details:', 50, yPosition)

      yPosition += 20
      doc.font('Helvetica')
         .text(`Order ID: ${data.purchaseId}`, 50, yPosition)
         .text(`Date: ${data.purchaseDate.toLocaleDateString()}`, 300, yPosition)

      // Vendor Information
      yPosition += 40
      doc.font('Helvetica-Bold')
         .text('Vendor Information:', 50, yPosition)

      yPosition += 20
      doc.font('Helvetica')
         .text(`Name: ${data.vendor.name}`, 50, yPosition)

      if (data.vendor.contactInfo?.email) {
        yPosition += 15
        doc.text(`Email: ${data.vendor.contactInfo.email}`, 50, yPosition)
      }

      if (data.vendor.contactInfo?.phone) {
        yPosition += 15
        doc.text(`Phone: ${data.vendor.contactInfo.phone}`, 50, yPosition)
      }

      // Items Table
      yPosition += 40
      doc.font('Helvetica-Bold')
         .text('Items Ordered:', 50, yPosition)

      yPosition += 20
      // Table headers
      doc.text('Variety', 50, yPosition)
         .text('Quantity', 200, yPosition)
         .text('Unit', 300, yPosition)
         .text('Price/Unit', 380, yPosition)
         .text('Total', 480, yPosition)

      // Table header line
      yPosition += 15
      doc.moveTo(50, yPosition)
         .lineTo(550, yPosition)
         .stroke()

      // Table rows
      yPosition += 10
      doc.font('Helvetica')

      data.items.forEach(item => {
        yPosition += 15

        // Check if we need a new page
        if (yPosition > doc.page.height - 150) {
          doc.addPage()
          yPosition = 50
        }

        doc.text(item.varietyName, 50, yPosition)
           .text(item.quantity.toString(), 200, yPosition)
           .text(item.unit, 300, yPosition)

        if (item.pricePerUnit) {
          doc.text(`$${item.pricePerUnit.toFixed(2)}`, 380, yPosition)
        }

        if (item.totalPrice) {
          doc.text(`$${item.totalPrice.toFixed(2)}`, 480, yPosition)
        }
      })

      // Totals
      yPosition += 30
      doc.moveTo(350, yPosition)
         .lineTo(550, yPosition)
         .stroke()

      yPosition += 15
      doc.font('Helvetica-Bold')
         .text(`Subtotal: $${data.totals.subtotal.toFixed(2)}`, 380, yPosition)

      if (data.totals.tax) {
        yPosition += 15
        doc.text(`Tax: $${data.totals.tax.toFixed(2)}`, 380, yPosition)
      }

      yPosition += 15
      doc.fontSize(14)
         .text(`Total: $${data.totals.total.toFixed(2)}`, 380, yPosition)

      // Notes
      if (data.notes) {
        yPosition += 40
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Notes:', 50, yPosition)

        yPosition += 15
        doc.font('Helvetica')
           .text(data.notes, 50, yPosition, { width: 500 })
      }

      // Footer
      this.addFooter(doc)

      // Generate buffer
      doc.end()
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
      })

      return {
        success: true,
        buffer,
        filename: `purchase-order-${data.purchaseId}.pdf`,
        contentType: 'application/pdf'
      }

    } catch (error) {
      return {
        success: false,
        filename: `purchase-order-${data.purchaseId}.pdf`,
        contentType: 'application/pdf',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async generateDateRangeReportPdf(data: DateRangeReportData, options: PdfGenerationOptions = {}): Promise<PdfGenerationResult> {
    try {
      const doc = this.createDocument(options)
      let yPosition = 130

      // Header
      const reportTitle = `${data.reportType.charAt(0).toUpperCase() + data.reportType.slice(1)} Report`
      this.addHeader(doc, reportTitle)

      // Report Details
      yPosition += 20
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Report Period:', 50, yPosition)

      yPosition += 20
      doc.font('Helvetica')
         .text(`From: ${data.startDate.toLocaleDateString()}`, 50, yPosition)
         .text(`To: ${data.endDate.toLocaleDateString()}`, 300, yPosition)

      // Summary Section
      yPosition += 40
      doc.font('Helvetica-Bold')
         .text('Summary:', 50, yPosition)

      yPosition += 20
      doc.font('Helvetica')
         .text(`Total Purchases: ${data.summary.totalPurchases}`, 50, yPosition)
         .text(`Total Cost: $${data.summary.totalCost.toFixed(2)}`, 300, yPosition)

      yPosition += 15
      doc.text(`Average Cost: $${data.summary.averageCost.toFixed(2)}`, 50, yPosition)

      // Top Vendors
      if (data.summary.topVendors.length > 0) {
        yPosition += 40
        doc.font('Helvetica-Bold')
           .text('Top Vendors:', 50, yPosition)

        yPosition += 20
        data.summary.topVendors.slice(0, 5).forEach(vendor => {
          yPosition += 15
          doc.font('Helvetica')
             .text(`${vendor.name}: ${vendor.orderCount} orders, $${vendor.totalCost.toFixed(2)}`, 70, yPosition)
        })
      }

      // Detailed Purchases (if detailed or accounting report)
      if (data.reportType !== 'summary' && data.purchases.length > 0) {
        yPosition += 40
        doc.font('Helvetica-Bold')
           .text('Purchase Details:', 50, yPosition)

        yPosition += 20
        // Table headers
        doc.text('Date', 50, yPosition)
           .text('Vendor', 150, yPosition)
           .text('Items', 300, yPosition)
           .text('Total', 480, yPosition)

        // Table header line
        yPosition += 15
        doc.moveTo(50, yPosition)
           .lineTo(550, yPosition)
           .stroke()

        yPosition += 10
        doc.font('Helvetica')

        data.purchases.forEach(purchase => {
          yPosition += 15

          // Check if we need a new page
          if (yPosition > doc.page.height - 150) {
            doc.addPage()
            yPosition = 50
          }

          doc.text(purchase.date.toLocaleDateString(), 50, yPosition)
             .text(purchase.vendorName, 150, yPosition)
             .text(`${purchase.items.length} items`, 300, yPosition)
             .text(`$${purchase.totalCost.toFixed(2)}`, 480, yPosition)
        })
      }

      // Footer
      this.addFooter(doc)

      // Generate buffer
      doc.end()
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
      })

      const filename = `${data.reportType}-report-${data.startDate.toISOString().split('T')[0]}-to-${data.endDate.toISOString().split('T')[0]}.pdf`

      return {
        success: true,
        buffer,
        filename,
        contentType: 'application/pdf'
      }

    } catch (error) {
      const filename = `${data.reportType}-report-${data.startDate.toISOString().split('T')[0]}-to-${data.endDate.toISOString().split('T')[0]}.pdf`

      return {
        success: false,
        filename,
        contentType: 'application/pdf',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}