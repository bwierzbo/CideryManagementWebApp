import jsPDF from 'jspdf'

// Type definitions for packaging run data
export interface PackagingRunPDFData {
  id: string
  batchId: string
  vesselId: string
  packagedAt: string
  packageType: string
  packageSizeML: number
  unitSizeL: string
  unitsProduced: number
  volumeTakenL: number
  lossL: number
  lossPercentage: number
  abvAtPackaging?: number
  carbonationLevel?: 'still' | 'petillant' | 'sparkling'
  fillCheck?: 'pass' | 'fail' | 'not_tested'
  fillVarianceML?: number
  testMethod?: string
  testDate?: string
  qaTechnicianId?: string
  qaNotes?: string
  productionNotes?: string
  status: 'completed' | 'voided' | null
  voidReason?: string
  voidedAt?: string
  voidedBy?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  // Relations
  batch: {
    id: string
    name: string | null
  }
  vessel: {
    id: string
    name: string | null
  }
  qaTechnicianName?: string
  voidedByName?: string
  createdByName?: string
  inventory: Array<{
    id: string
    lotCode: string
    packageType: string
    packageSizeML: number
    expirationDate: string
    createdAt: string
  }>
  photos: Array<{
    id: string
    photoUrl: string
    photoType: string
    caption?: string
    uploadedBy: string
    uploadedAt: string
    uploaderName?: string
  }>
}

export interface PDFGeneratorOptions {
  companyName?: string
  companyAddress?: string
  logoUrl?: string
  includePhotos?: boolean
  includeQRCode?: boolean
}

/**
 * Professional PDF Generator for Packaging Runs
 * Creates a comprehensive production report with all QA fields and measurements
 */
export class PackagingPDFGenerator {
  private doc: jsPDF
  private options: PDFGeneratorOptions
  private currentY: number = 20
  private pageHeight: number
  private pageWidth: number
  private marginLeft: number = 20
  private marginRight: number = 20

  constructor(options: PDFGeneratorOptions = {}) {
    this.doc = new jsPDF()
    this.pageHeight = this.doc.internal.pageSize.height
    this.pageWidth = this.doc.internal.pageSize.width
    this.options = {
      companyName: 'Cidery Management',
      companyAddress: '',
      includePhotos: false,
      includeQRCode: false,
      ...options
    }
  }

  /**
   * Generate PDF for a packaging run
   */
  async generatePackagingRunPDF(data: PackagingRunPDFData): Promise<Blob> {
    // Reset position
    this.currentY = 20

    // Add header
    this.addHeader(data)

    // Add production summary
    this.addProductionSummary(data)

    // Add batch traceability
    this.addBatchTraceability(data)

    // Add QA measurements
    this.addQAMeasurements(data)

    // Add inventory details
    this.addInventoryDetails(data)

    // Add footer
    this.addFooter()

    // Return PDF as blob
    return new Promise((resolve) => {
      const pdfBlob = this.doc.output('blob')
      resolve(pdfBlob)
    })
  }

  /**
   * Download PDF with appropriate filename
   */
  static downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Add header with company info and title
   */
  private addHeader(data: PackagingRunPDFData): void {
    const centerX = this.pageWidth / 2

    // Company name
    this.doc.setFontSize(20)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(this.options.companyName || 'Cidery Management', centerX, this.currentY, { align: 'center' })
    this.currentY += 8

    // Company address
    if (this.options.companyAddress) {
      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(this.options.companyAddress, centerX, this.currentY, { align: 'center' })
      this.currentY += 8
    }

    // Title
    this.doc.setFontSize(16)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('PACKAGING RUN REPORT', centerX, this.currentY, { align: 'center' })
    this.currentY += 15

    // Run ID and Date
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'normal')
    const runIdText = `Run ID: ${data.id.slice(0, 8)}`
    const dateText = `Generated: ${new Date().toLocaleString()}`

    this.doc.text(runIdText, this.marginLeft, this.currentY)
    this.doc.text(dateText, this.pageWidth - this.marginRight, this.currentY, { align: 'right' })
    this.currentY += 15

    // Divider line
    this.doc.setLineWidth(0.5)
    this.doc.line(this.marginLeft, this.currentY, this.pageWidth - this.marginRight, this.currentY)
    this.currentY += 10
  }

  /**
   * Add production summary section
   */
  private addProductionSummary(data: PackagingRunPDFData): void {
    this.addSectionHeader('PRODUCTION SUMMARY')

    const leftCol = this.marginLeft
    const rightCol = this.pageWidth / 2 + 10
    const lineHeight = 7

    // Left column
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Batch:', leftCol, this.currentY)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.batch.name || `Batch ${data.batchId.slice(0, 8)}`, leftCol + 25, this.currentY)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Vessel:', leftCol, this.currentY + lineHeight)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.vessel.name || `Vessel ${data.vesselId.slice(0, 8)}`, leftCol + 25, this.currentY + lineHeight)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Packaged:', leftCol, this.currentY + lineHeight * 2)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(new Date(data.packagedAt).toLocaleDateString(), leftCol + 25, this.currentY + lineHeight * 2)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Package Type:', leftCol, this.currentY + lineHeight * 3)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(this.formatPackageSize(data.packageSizeML, data.packageType), leftCol + 25, this.currentY + lineHeight * 3)

    // Right column
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Units Produced:', rightCol, this.currentY)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.unitsProduced.toLocaleString(), rightCol + 35, this.currentY)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Volume Taken:', rightCol, this.currentY + lineHeight)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`${data.volumeTakenL.toFixed(1)}L`, rightCol + 35, this.currentY + lineHeight)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Loss:', rightCol, this.currentY + lineHeight * 2)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`${data.lossL.toFixed(1)}L (${data.lossPercentage.toFixed(1)}%)`, rightCol + 35, this.currentY + lineHeight * 2)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Status:', rightCol, this.currentY + lineHeight * 3)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.status || 'pending', rightCol + 35, this.currentY + lineHeight * 3)

    this.currentY += lineHeight * 4 + 10
  }

  /**
   * Add batch traceability section
   */
  private addBatchTraceability(data: PackagingRunPDFData): void {
    this.checkPageBreak(60)
    this.addSectionHeader('BATCH TRACEABILITY')

    const lineHeight = 7

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Batch ID:', this.marginLeft, this.currentY)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.batchId, this.marginLeft + 25, this.currentY)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Vessel ID:', this.marginLeft, this.currentY + lineHeight)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.vesselId, this.marginLeft + 25, this.currentY + lineHeight)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Created By:', this.marginLeft, this.currentY + lineHeight * 2)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.createdByName || data.createdBy, this.marginLeft + 25, this.currentY + lineHeight * 2)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Created At:', this.marginLeft, this.currentY + lineHeight * 3)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(new Date(data.createdAt).toLocaleString(), this.marginLeft + 25, this.currentY + lineHeight * 3)

    // Production notes if available
    if (data.productionNotes) {
      this.currentY += lineHeight * 4 + 5
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('Production Notes:', this.marginLeft, this.currentY)
      this.currentY += lineHeight
      this.doc.setFont('helvetica', 'normal')
      const notesLines = this.doc.splitTextToSize(data.productionNotes, this.pageWidth - this.marginLeft - this.marginRight)
      this.doc.text(notesLines, this.marginLeft, this.currentY)
      this.currentY += notesLines.length * 5
    }

    this.currentY += lineHeight * 4 + 10
  }

  /**
   * Add QA measurements section
   */
  private addQAMeasurements(data: PackagingRunPDFData): void {
    this.checkPageBreak(80)
    this.addSectionHeader('QUALITY ASSURANCE')

    const leftCol = this.marginLeft
    const rightCol = this.pageWidth / 2 + 10
    const lineHeight = 7

    // Left column
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('ABV at Packaging:', leftCol, this.currentY)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.abvAtPackaging ? `${data.abvAtPackaging.toFixed(2)}%` : 'Not tested', leftCol + 35, this.currentY)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Carbonation Level:', leftCol, this.currentY + lineHeight)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.carbonationLevel || 'Not specified', leftCol + 35, this.currentY + lineHeight)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Fill Check:', leftCol, this.currentY + lineHeight * 2)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.fillCheck || 'not_tested', leftCol + 35, this.currentY + lineHeight * 2)

    // Right column
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Fill Variance:', rightCol, this.currentY)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.fillVarianceML ? `${data.fillVarianceML.toFixed(1)}ml` : 'Not measured', rightCol + 30, this.currentY)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Test Method:', rightCol, this.currentY + lineHeight)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.testMethod || 'Not specified', rightCol + 30, this.currentY + lineHeight)

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Test Date:', rightCol, this.currentY + lineHeight * 2)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(data.testDate ? new Date(data.testDate).toLocaleDateString() : 'Not specified', rightCol + 30, this.currentY + lineHeight * 2)

    this.currentY += lineHeight * 3 + 5

    // QA Technician
    if (data.qaTechnicianName) {
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('QA Technician:', this.marginLeft, this.currentY)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(data.qaTechnicianName, this.marginLeft + 35, this.currentY)
      this.currentY += lineHeight + 5
    }

    // QA Notes
    if (data.qaNotes) {
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('QA Notes:', this.marginLeft, this.currentY)
      this.currentY += lineHeight
      this.doc.setFont('helvetica', 'normal')
      const notesLines = this.doc.splitTextToSize(data.qaNotes, this.pageWidth - this.marginLeft - this.marginRight)
      this.doc.text(notesLines, this.marginLeft, this.currentY)
      this.currentY += notesLines.length * 5
    }

    this.currentY += 10
  }

  /**
   * Add inventory details section
   */
  private addInventoryDetails(data: PackagingRunPDFData): void {
    this.checkPageBreak(60)
    this.addSectionHeader('INVENTORY DETAILS')

    if (data.inventory.length === 0) {
      this.doc.setFont('helvetica', 'italic')
      this.doc.text('No inventory items found', this.marginLeft, this.currentY)
      this.currentY += 15
      return
    }

    // Table headers
    const headers = ['Lot Code', 'Package Type', 'Size', 'Expiration Date']
    const colWidths = [50, 40, 30, 40]
    const startX = this.marginLeft
    let currentX = startX

    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)

    // Draw headers
    headers.forEach((header, index) => {
      this.doc.text(header, currentX, this.currentY)
      currentX += colWidths[index]
    })

    this.currentY += 8

    // Draw header line
    this.doc.setLineWidth(0.3)
    this.doc.line(startX, this.currentY, startX + colWidths.reduce((a, b) => a + b, 0), this.currentY)
    this.currentY += 5

    // Draw inventory rows
    this.doc.setFont('helvetica', 'normal')
    data.inventory.forEach((item) => {
      this.checkPageBreak(15)

      currentX = startX
      const rowData = [
        item.lotCode,
        item.packageType,
        this.formatPackageSize(item.packageSizeML, item.packageType),
        new Date(item.expirationDate).toLocaleDateString()
      ]

      rowData.forEach((cellData, index) => {
        this.doc.text(cellData, currentX, this.currentY)
        currentX += colWidths[index]
      })

      this.currentY += 6
    })

    this.currentY += 10
  }

  /**
   * Add section header
   */
  private addSectionHeader(title: string): void {
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(title, this.marginLeft, this.currentY)
    this.currentY += 2

    // Underline
    this.doc.setLineWidth(0.3)
    this.doc.line(this.marginLeft, this.currentY, this.marginLeft + this.doc.getTextWidth(title), this.currentY)
    this.currentY += 10
  }

  /**
   * Add footer with timestamp and page numbers
   */
  private addFooter(): void {
    const footerY = this.pageHeight - 15

    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')

    // Timestamp
    const timestamp = `Generated on ${new Date().toLocaleString()}`
    this.doc.text(timestamp, this.marginLeft, footerY)

    // Page number
    const pageNumber = `Page 1 of 1`
    this.doc.text(pageNumber, this.pageWidth - this.marginRight, footerY, { align: 'right' })
  }

  /**
   * Check if we need a page break
   */
  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - 30) {
      this.doc.addPage()
      this.currentY = 20
    }
  }

  /**
   * Format package size for display
   */
  private formatPackageSize(sizeML: number, packageType: string): string {
    if (sizeML >= 1000) {
      return `${sizeML / 1000}L ${packageType}`
    }
    return `${sizeML}ml ${packageType}`
  }
}

/**
 * Utility function to generate and download packaging run PDF
 */
export async function generatePackagingRunPDF(
  data: PackagingRunPDFData,
  options: PDFGeneratorOptions = {}
): Promise<void> {
  const generator = new PackagingPDFGenerator(options)
  const pdfBlob = await generator.generatePackagingRunPDF(data)

  // Generate filename
  const batchName = data.batch.name || 'Batch'
  const date = new Date(data.packagedAt).toISOString().split('T')[0]
  const filename = `${batchName}-PackagingRun-${date}.pdf`

  PackagingPDFGenerator.downloadPDF(pdfBlob, filename)
}