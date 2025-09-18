// Dynamic import for Node.js only modules
let jsPDF: any = null

// Initialize jsPDF only on server side
const initJsPDF = async () => {
  if (typeof window === 'undefined' && !jsPDF) {
    const { jsPDF: JsPDFClass } = await import('jspdf')
    jsPDF = JsPDFClass
  }
  return jsPDF
}

import * as fs from 'fs'
import * as path from 'path'
import type {
  PdfGenerationOptions,
  PurchaseOrderData,
  DateRangeReportData,
  PdfGenerationResult,
  PdfGenerationError
} from './types'

export class PdfService {
  private async createDocument(options: PdfGenerationOptions = {}): Promise<any> {
    const JsPDF = await initJsPDF()
    if (!JsPDF) {
      throw new Error('jsPDF not available - server-side only')
    }

    return new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: options.format === 'Letter' ? 'letter' : 'a4'
    })
  }

  private addHeader(doc: any, title: string): void {
    // Add logo image
    try {
      // Try multiple possible paths for the logo
      const possiblePaths = [
        // Production/built paths
        path.join(__dirname, 'assets', 'logo.png'),
        path.join(__dirname, '..', '..', '..', 'src', 'services', 'pdf', 'assets', 'logo.png'),

        // Development paths from monorepo root
        path.join(process.cwd(), 'packages', 'api', 'src', 'services', 'pdf', 'assets', 'logo.png'),
        path.join(process.cwd(), 'packages', 'api', 'dist', 'services', 'pdf', 'assets', 'logo.png'),

        // Development paths from web app directory
        path.join(process.cwd(), '..', '..', 'packages', 'api', 'src', 'services', 'pdf', 'assets', 'logo.png'),

        // Fallback paths
        path.join(process.cwd(), 'src', 'services', 'pdf', 'assets', 'logo.png'),

        // Absolute path as last resort
        '/Users/benjaminwierzbanowski/Code/CideryManagementApp/packages/api/src/services/pdf/assets/logo.png'
      ]

      let logoBase64: string | null = null
      let logoPath: string | null = null

      for (const testPath of possiblePaths) {
        try {
          if (fs.existsSync(testPath)) {
            logoBase64 = fs.readFileSync(testPath, 'base64')
            logoPath = testPath
            break
          }
        } catch (e) {
          // Continue to next path
        }
      }

      if (logoBase64) {
        console.log(`✅ Logo loaded from: ${logoPath}`)
        // Add logo in top left (x, y, width, height in mm)
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 20, 10, 25, 25)
      } else {
        console.warn(`❌ Logo not found!`)
        console.warn(`📁 Current working directory: ${process.cwd()}`)
        console.warn(`📂 __dirname: ${__dirname}`)
        console.warn(`🔍 Searched paths:`)
        possiblePaths.forEach((p, i) => console.warn(`   ${i + 1}. ${p}`))
      }
    } catch (error) {
      console.warn('❌ Error loading logo:', error)
    }

    // Company information next to logo
    doc.setFontSize(16)
    doc.setFont(undefined, 'bold')
    doc.text('Olympic Bluffs Cidery', 50, 20)

    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text('1025 Finn Hall Road, Port Angeles, WA 98362', 50, 28)
    doc.text('Phone: (360) 670-7206', 50, 34)

    // Document title
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text(title, 20, 50)

    // Add a line under header
    doc.line(20, 55, 190, 55)
  }

  private addFooter(doc: any): void {
    const pageHeight = doc.internal.pageSize.height
    const footerY = pageHeight - 20

    // Add generation timestamp
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    doc.text(`Generated on ${new Date().toLocaleString()}`, 20, footerY)

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.text(`Page ${i} of ${pageCount}`, 170, footerY)
    }
  }

  async generatePurchaseOrderPdf(data: PurchaseOrderData, options: PdfGenerationOptions = {}): Promise<PdfGenerationResult> {
    try {
      const doc = await this.createDocument(options)
      let yPosition = 65

      // Header
      this.addHeader(doc, 'Purchase Order')

      // Purchase Order Details
      yPosition += 15
      doc.setFontSize(12)
      doc.setFont(undefined, 'normal')
      doc.text(`Date: ${data.purchaseDate.toLocaleDateString()}`, 20, yPosition)
      doc.text(`Vendor: ${data.vendor.name}`, 120, yPosition)

      // Items Table
      yPosition += 20
      doc.setFont(undefined, 'bold')
      doc.text('Items Ordered:', 20, yPosition)

      yPosition += 10
      // Table headers
      doc.text('Variety', 20, yPosition)
      doc.text('Quantity', 80, yPosition)
      doc.text('Unit', 120, yPosition)
      doc.text('Price/Unit', 150, yPosition)
      doc.text('Total', 180, yPosition)

      // Table header line
      yPosition += 5
      doc.line(20, yPosition, 190, yPosition)

      // Table rows
      yPosition += 8
      doc.setFont(undefined, 'normal')

      data.items.forEach(item => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage()
          yPosition = 30
        }

        doc.text(item.varietyName, 20, yPosition)
        doc.text(item.quantity.toString(), 80, yPosition)
        doc.text(item.unit, 120, yPosition)

        if (item.pricePerUnit) {
          doc.text(`$${item.pricePerUnit.toFixed(2)}`, 150, yPosition)
        }

        if (item.totalPrice) {
          doc.text(`$${item.totalPrice.toFixed(2)}`, 180, yPosition)
        }

        yPosition += 8
      })

      // Totals
      yPosition += 10
      doc.line(140, yPosition, 190, yPosition)

      // Calculate total pounds (assuming 'lb' unit, convert kg to lbs if needed)
      const totalPounds = data.items.reduce((sum, item) => {
        if (item.unit === 'lb') {
          return sum + item.quantity
        } else if (item.unit === 'kg') {
          return sum + (item.quantity * 2.20462) // Convert kg to lbs
        }
        return sum + item.quantity // Assume lbs for other units
      }, 0)

      yPosition += 8
      doc.setFont(undefined, 'bold')
      doc.text(`Total lbs: ${totalPounds.toFixed(1)} lbs`, 150, yPosition)

      yPosition += 8
      doc.setFontSize(14)
      doc.text(`Total Cost: $${data.totals.total.toFixed(2)}`, 150, yPosition)

      // Notes
      if (data.notes) {
        yPosition += 20
        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        doc.text('Notes:', 20, yPosition)

        yPosition += 8
        doc.setFont(undefined, 'normal')
        // Split long notes into multiple lines
        const noteLines = doc.splitTextToSize(data.notes, 170)
        doc.text(noteLines, 20, yPosition)
      }

      // Footer
      this.addFooter(doc)

      // Generate buffer
      const pdfOutput = doc.output('arraybuffer')
      const buffer = Buffer.from(pdfOutput)

      // Create filename with vendor name, date, and "purchase order"
      const dateStr = data.purchaseDate.toISOString().split('T')[0] // YYYY-MM-DD format
      const vendorName = data.vendor.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-') // Clean vendor name
      const filename = `${vendorName}_${dateStr}_Purchase-Order.pdf`

      return {
        success: true,
        buffer,
        filename,
        contentType: 'application/pdf'
      }

    } catch (error) {
      // Create consistent filename even on error
      const dateStr = data.purchaseDate.toISOString().split('T')[0]
      const vendorName = data.vendor.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
      const filename = `${vendorName}_${dateStr}_Purchase-Order.pdf`

      return {
        success: false,
        filename,
        contentType: 'application/pdf',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async generateDateRangeReportPdf(data: DateRangeReportData, options: PdfGenerationOptions = {}): Promise<PdfGenerationResult> {
    try {
      const doc = await this.createDocument(options)
      let yPosition = 50

      // Header
      const reportTitle = `${data.reportType.charAt(0).toUpperCase() + data.reportType.slice(1)} Report`
      this.addHeader(doc, reportTitle)

      // Report Details
      yPosition += 20
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Report Period:', 20, yPosition)

      yPosition += 10
      doc.setFont(undefined, 'normal')
      doc.text(`From: ${data.startDate.toLocaleDateString()}`, 20, yPosition)
      doc.text(`To: ${data.endDate.toLocaleDateString()}`, 120, yPosition)

      // Summary Section
      yPosition += 20
      doc.setFont(undefined, 'bold')
      doc.text('Summary:', 20, yPosition)

      yPosition += 10
      doc.setFont(undefined, 'normal')
      doc.text(`Total Purchases: ${data.summary.totalPurchases}`, 20, yPosition)
      doc.text(`Total Cost: $${data.summary.totalCost.toFixed(2)}`, 120, yPosition)

      yPosition += 8
      doc.text(`Average Cost: $${data.summary.averageCost.toFixed(2)}`, 20, yPosition)

      // Top Vendors
      if (data.summary.topVendors.length > 0) {
        yPosition += 20
        doc.setFont(undefined, 'bold')
        doc.text('Top Vendors:', 20, yPosition)

        yPosition += 10
        data.summary.topVendors.slice(0, 5).forEach(vendor => {
          doc.setFont(undefined, 'normal')
          doc.text(`${vendor.name}: ${vendor.orderCount} orders, $${vendor.totalCost.toFixed(2)}`, 30, yPosition)
          yPosition += 8
        })
      }

      // Detailed Purchases (if detailed or accounting report)
      if (data.reportType !== 'summary' && data.purchases.length > 0) {
        yPosition += 20
        doc.setFont(undefined, 'bold')
        doc.text('Purchase Details:', 20, yPosition)

        yPosition += 10
        // Table headers
        doc.text('Date', 20, yPosition)
        doc.text('Vendor', 60, yPosition)
        doc.text('Items', 120, yPosition)
        doc.text('Total', 160, yPosition)

        // Table header line
        yPosition += 5
        doc.line(20, yPosition, 190, yPosition)

        yPosition += 8
        doc.setFont(undefined, 'normal')

        data.purchases.forEach(purchase => {
          // Check if we need a new page
          if (yPosition > 250) {
            doc.addPage()
            yPosition = 30
          }

          doc.text(purchase.date.toLocaleDateString(), 20, yPosition)
          doc.text(purchase.vendorName, 60, yPosition)
          doc.text(`${purchase.items.length} items`, 120, yPosition)
          doc.text(`$${purchase.totalCost.toFixed(2)}`, 160, yPosition)
          yPosition += 8
        })
      }

      // Footer
      this.addFooter(doc)

      // Generate buffer
      const pdfOutput = doc.output('arraybuffer')
      const buffer = Buffer.from(pdfOutput)

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