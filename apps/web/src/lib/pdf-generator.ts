import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { formatDate, formatDateTime } from "@/utils/date-format";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

// Set up fonts for pdfmake
// @ts-ignore - vfs_fonts types don't expose pdfMake property correctly
if ((pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
}

// Type definitions for packaging run data
export interface PackagingRunPDFData {
  id: string;
  batchId: string;
  vesselId: string;
  packagedAt: string;
  packageType: string;
  packageSizeML: number;
  unitSize: string;
  unitSizeUnit: string;
  unitsProduced: number;
  volumeTaken: number;
  volumeTakenUnit: string;
  loss: number;
  lossUnit: string;
  lossPercentage: number;
  abvAtPackaging?: number;
  carbonationLevel?: "still" | "petillant" | "sparkling";
  fillCheck?: "pass" | "fail" | "not_tested";
  fillVarianceML?: number;
  testMethod?: string;
  testDate?: string;
  qaTechnicianId?: string;
  qaNotes?: string;
  productionNotes?: string;
  status: "active" | "ready" | "distributed" | "completed" | "voided" | null;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  batch: {
    id: string;
    name: string | null;
    customName?: string | null;
    composition?: Array<{
      varietyName: string | null;
      vendorName: string | null;
      volumeL: number;
      percentageOfBatch: number;
    }>;
    history?: {
      measurements?: Array<{
        measurementDate: Date | string;
        abv: number | string | null;
        ph: number | string | null;
        specificGravity: number | string | null;
        temperature: number | string | null;
        totalAcidity: number | string | null;
        isEstimated?: boolean;
        estimateSource?: string | null;
        measurementMethod?: string | null;
        notes?: string | null;
        sourceBatchName?: string | null;
      }>;
      additives?: Array<{
        additiveName: string;
        amount: number;
        unit: string | null;
        addedAt: Date | string;
        notes?: string | null;
        totalCost?: number | null;
        sourceBatchName?: string | null;
        labelImpact?: boolean;
        labelImpactNotes?: string | null;
        allergensVegan?: boolean;
        allergensVeganNotes?: string | null;
        itemType?: string | null;
      }>;
      transfers?: Array<{
        fromVesselName?: string;
        destinationVesselName?: string;
        volumeTransferred: number;
        transferredAt: Date | string;
      }>;
    };
  };
  vessel: {
    id: string;
    name: string | null;
  };
  qaTechnicianName?: string;
  voidedByName?: string;
  createdByName?: string;
  inventory: Array<{
    id: string;
    lotCode: string;
    packageType: string;
    packageSizeML: number;
    expirationDate: string;
    createdAt: string;
  }>;
  photos: Array<{
    id: string;
    photoUrl: string;
    photoType: string;
    caption?: string;
    uploadedBy: string;
    uploadedAt: string;
    uploaderName?: string;
  }>;
}

export interface PDFGeneratorOptions {
  companyName?: string;
  companyAddress?: string;
  logoUrl?: string;
  includePhotos?: boolean;
  includeQRCode?: boolean;
}

/**
 * Professional PDF Generator for Bottle Runs using pdfMake
 */
export class PackagingPDFGenerator {
  private options: PDFGeneratorOptions;

  constructor(options: PDFGeneratorOptions = {}) {
    this.options = {
      companyName: "Cidery Management",
      companyAddress: "",
      includePhotos: false,
      includeQRCode: false,
      ...options,
    };
  }

  /**
   * Generate PDF for a packaging run
   */
  async generatePackagingRunPDF(data: PackagingRunPDFData): Promise<Blob> {
    const docDefinition: TDocumentDefinitions = {
      pageSize: "LETTER",
      pageMargins: [40, 60, 40, 60],
      header: (currentPage, pageCount) => {
        return {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "right",
          margin: [40, 20, 40, 20],
          fontSize: 8,
          color: "#666666",
        };
      },
      footer: (currentPage, pageCount) => {
        return {
          text: `Generated on ${formatDateTime(new Date())}`,
          alignment: "left",
          margin: [40, 20, 40, 20],
          fontSize: 8,
          color: "#666666",
        };
      },
      content: this.buildContent(data),
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10],
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 15, 0, 10],
          color: "#1f2937",
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: "#374151",
          fillColor: "#f3f4f6",
        },
        tableCell: {
          fontSize: 9,
        },
        label: {
          fontSize: 9,
          color: "#6b7280",
          margin: [0, 0, 0, 2],
        },
        value: {
          fontSize: 10,
          margin: [0, 0, 0, 8],
        },
        alert: {
          fontSize: 10,
          italics: true,
          color: "#dc2626",
        },
        warning: {
          fontSize: 10,
          italics: true,
          color: "#f59e0b",
        },
        info: {
          fontSize: 10,
          italics: true,
          color: "#3b82f6",
        },
      },
    };

    return new Promise((resolve, reject) => {
      try {
        const pdfDocGenerator = pdfMake.createPdf(docDefinition);
        pdfDocGenerator.getBlob((blob) => {
          resolve(blob);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build PDF content sections
   */
  private buildContent(data: PackagingRunPDFData): Content[] {
    const content: Content[] = [];

    // Header
    content.push(...this.addHeader(data));

    // Label Compliance Section (NEW)
    content.push(...this.addLabelComplianceSection(data));

    // Production Summary
    content.push(...this.addProductionSummary(data));

    // Batch Composition
    if (data.batch.composition && data.batch.composition.length > 0) {
      content.push(...this.addBatchComposition(data));
    }

    // Batch History
    if (data.batch.history) {
      content.push(...this.addBatchHistory(data));
    }

    // Quality Assurance
    content.push(...this.addQASection(data));

    // Production Notes
    if (data.productionNotes) {
      content.push(...this.addProductionNotes(data));
    }

    // Inventory
    content.push(...this.addInventorySection(data));

    return content;
  }

  /**
   * Add header with company info and title
   */
  private addHeader(data: PackagingRunPDFData): Content[] {
    const batchName =
      data.batch.customName ||
      data.batch.name ||
      `Batch ${data.batchId.slice(0, 8)}`;

    return [
      {
        text: this.options.companyName || "Cidery Management",
        style: "header",
        alignment: "center" as const,
      },
      ...(this.options.companyAddress
        ? ([
            {
              text: this.options.companyAddress,
              alignment: "center" as const,
              fontSize: 10,
              color: "#6b7280",
              margin: [0, 0, 0, 20] as [number, number, number, number],
            },
          ] as any[])
        : []),
      {
        text: "BOTTLE RUN PRODUCTION REPORT",
        fontSize: 16,
        bold: true,
        alignment: "center" as const,
        margin: [0, 10, 0, 20] as [number, number, number, number],
      },
      {
        columns: [
          {
            text: [
              { text: "Batch: ", bold: true },
              batchName,
            ],
            fontSize: 10,
          },
          {
            text: [
              { text: "Run ID: ", bold: true },
              data.id.slice(0, 8),
            ],
            fontSize: 10,
            alignment: "right" as const,
          },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        columns: [
          {
            text: [
              { text: "Packaged: ", bold: true },
              formatDate(new Date(data.packagedAt)),
            ],
            fontSize: 10,
          },
          {
            text: [
              { text: "Status: ", bold: true },
              { text: data.status || "pending", color: this.getStatusColor(data.status) },
            ],
            fontSize: 10,
            alignment: "right" as const,
          },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },
      {
        canvas: [
          {
            type: "line" as const,
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: "#e5e7eb",
          },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },
    ];
  }

  /**
   * Add Label Compliance Section
   */
  private addLabelComplianceSection(data: PackagingRunPDFData): Content[] {
    const content: Content[] = [];

    // Calculate latest measurements and ABV
    const measurements = data.batch.history?.measurements || [];
    const additives = data.batch.history?.additives || [];

    let latestAbv = data.abvAtPackaging ?? null;

    // Estimate ABV from SG if not measured
    if (latestAbv === null && measurements.length > 0) {
      const sgValues = measurements
        .filter((m) => m.specificGravity !== null)
        .map((m) =>
          typeof m.specificGravity === "number"
            ? m.specificGravity
            : parseFloat(m.specificGravity as string)
        );

      if (sgValues.length >= 2) {
        const og = Math.max(...sgValues);
        const fg = Math.min(...sgValues);
        if (og > fg) {
          latestAbv = (og - fg) * 131.25;
        }
      }
    }

    const requiresCOLA = latestAbv !== null && latestAbv >= 7.0;
    const isFDA = latestAbv !== null && latestAbv < 7.0;

    // Check for sulfites
    const hasSulfites = additives.some(
      (a) =>
        a.itemType === "preservative" &&
        (a.additiveName.toLowerCase().includes("sulfite") ||
          a.additiveName.toLowerCase().includes("so2") ||
          a.additiveName.toLowerCase().includes("so₂"))
    );

    // Get label impact and allergen additives
    const labelImpactAdditives = additives.filter((a) => a.labelImpact);
    const allergenAdditives = additives.filter(
      (a) => a.allergensVeganNotes || a.allergensVegan
    );

    content.push({
      text: "Label Characteristics & TTB Compliance",
      style: "sectionHeader",
    });

    // Regulatory Status Alert
    if (requiresCOLA) {
      content.push({
        text: "⚠ TTB COLA Required - Wine Labeling Rules Apply",
        style: "warning",
        margin: [0, 0, 0, 5],
      });
      content.push({
        text: `ABV ≥7% requires Certificate of Label Approval (COLA) from TTB under 27 CFR Part 4. Product is classified as 'Wine' or 'Apple Wine'.`,
        fontSize: 9,
        margin: [0, 0, 0, 10],
      });
    } else if (isFDA) {
      content.push({
        text: "ℹ FDA Labeling - No COLA Required",
        style: "info",
        margin: [0, 0, 0, 5],
      });
      content.push({
        text: "ABV <7% follows simplified FDA labeling under 21 CFR 101. Must include ingredient list and allergen statements.",
        fontSize: 9,
        margin: [0, 0, 0, 10],
      });
    }

    // Measurements Table
    const latestMeasurement = measurements[0];
    const latestPH = latestMeasurement?.ph
      ? typeof latestMeasurement.ph === "number"
        ? latestMeasurement.ph
        : parseFloat(latestMeasurement.ph)
      : null;
    const latestSG = latestMeasurement?.specificGravity
      ? typeof latestMeasurement.specificGravity === "number"
        ? latestMeasurement.specificGravity
        : parseFloat(latestMeasurement.specificGravity)
      : null;

    content.push({
      table: {
        widths: ["33%", "33%", "34%"],
        body: [
          [
            { text: "ABV", style: "tableHeader" },
            { text: "pH", style: "tableHeader" },
            { text: "Specific Gravity", style: "tableHeader" },
          ],
          [
            {
              text: latestAbv !== null ? `${latestAbv.toFixed(2)}%` : "Not measured",
              style: "tableCell",
            },
            {
              text: latestPH !== null ? latestPH.toFixed(2) : "Not measured",
              style: "tableCell",
            },
            {
              text: latestSG !== null ? latestSG.toFixed(3) : "Not measured",
              style: "tableCell",
            },
          ],
        ],
      },
      margin: [0, 0, 0, 10],
    });

    // Additive-Based Requirements
    if (hasSulfites || labelImpactAdditives.length > 0 || allergenAdditives.length > 0) {
      content.push({
        text: "Additive-Based Requirements",
        fontSize: 11,
        bold: true,
        margin: [0, 5, 0, 5],
      });

      if (hasSulfites) {
        content.push({
          text: '• Sulfite Declaration: "Contains Sulfites" required if ≥10 ppm SO₂',
          fontSize: 9,
          margin: [0, 2, 0, 2],
        });
      }

      if (labelImpactAdditives.length > 0) {
        content.push({
          text: "• Label Impact Additives:",
          fontSize: 9,
          bold: true,
          margin: [0, 2, 0, 2],
        });
        labelImpactAdditives.forEach((additive) => {
          content.push({
            text: `  - ${additive.additiveName}${additive.labelImpactNotes ? `: ${additive.labelImpactNotes}` : ""}`,
            fontSize: 9,
            margin: [0, 1, 0, 1],
          });
        });
      }

      if (allergenAdditives.length > 0) {
        content.push({
          text: `• Allergen Information${isFDA ? " (Required for FDA Labeling)" : ""}:`,
          fontSize: 9,
          bold: true,
          margin: [0, 2, 0, 2],
        });
        allergenAdditives.forEach((additive) => {
          const note =
            additive.allergensVeganNotes ||
            (additive.allergensVegan ? "Not vegan-friendly" : "");
          content.push({
            text: `  - ${additive.additiveName}${note ? `: ${note}` : ""}`,
            fontSize: 9,
            margin: [0, 1, 0, 1],
          });
        });
      }
    }

    return content;
  }

  /**
   * Add production summary section
   */
  private addProductionSummary(data: PackagingRunPDFData): Content[] {
    return [
      {
        text: "Production Summary",
        style: "sectionHeader",
      },
      {
        columns: [
          {
            stack: [
              { text: "Package Type & Size", style: "label" },
              {
                text: this.formatPackageSize(data.packageSizeML, data.packageType),
                style: "value",
              },
              { text: "Units Produced", style: "label" },
              {
                text: data.unitsProduced.toLocaleString(),
                style: "value",
              },
            ],
            width: "50%",
          },
          {
            stack: [
              { text: "Volume Taken", style: "label" },
              {
                text: `${data.volumeTaken.toFixed(1)}L`,
                style: "value",
              },
              { text: "Loss", style: "label" },
              {
                text: `${data.loss.toFixed(2)}L (${data.lossPercentage.toFixed(1)}%)`,
                style: "value",
                color: this.getLossColor(data.lossPercentage),
              },
            ],
            width: "50%",
          },
        ],
      },
    ];
  }

  /**
   * Add batch composition section
   */
  private addBatchComposition(data: PackagingRunPDFData): Content[] {
    if (!data.batch.composition || data.batch.composition.length === 0) {
      return [];
    }

    const tableBody: any[][] = [
      [
        { text: "Variety", style: "tableHeader" },
        { text: "Vendor", style: "tableHeader" },
        { text: "Volume (L)", style: "tableHeader", alignment: "right" },
        { text: "% of Batch", style: "tableHeader", alignment: "right" },
      ],
    ];

    data.batch.composition.forEach((comp) => {
      tableBody.push([
        { text: comp.varietyName || "Unknown", style: "tableCell" },
        { text: comp.vendorName || "Unknown", style: "tableCell" },
        {
          text: comp.volumeL.toFixed(1),
          style: "tableCell",
          alignment: "right",
        },
        {
          text: `${comp.percentageOfBatch.toFixed(1)}%`,
          style: "tableCell",
          alignment: "right",
        },
      ]);
    });

    return [
      {
        text: "Batch Composition",
        style: "sectionHeader",
      },
      {
        table: {
          headerRows: 1,
          widths: ["30%", "30%", "20%", "20%"],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 === 0 ? "#f9fafb" : null),
        },
      },
    ];
  }

  /**
   * Add batch history section (measurements, additives, transfers)
   */
  private addBatchHistory(data: PackagingRunPDFData): Content[] {
    const content: Content[] = [];
    const history = data.batch.history;

    if (!history) return [];

    content.push({
      text: "Batch History",
      style: "sectionHeader",
    });

    // Measurements
    if (history.measurements && history.measurements.length > 0) {
      content.push({
        text: "Measurements",
        fontSize: 11,
        bold: true,
        margin: [0, 5, 0, 5],
      });

      const measurementBody: any[][] = [
        [
          { text: "Date", style: "tableHeader" },
          { text: "ABV (%)", style: "tableHeader", alignment: "right" },
          { text: "pH", style: "tableHeader", alignment: "right" },
          { text: "SG", style: "tableHeader", alignment: "right" },
          { text: "Temp (°C)", style: "tableHeader", alignment: "right" },
        ],
      ];

      history.measurements.slice(0, 10).forEach((m) => {
        measurementBody.push([
          {
            text: formatDate(new Date(m.measurementDate)),
            style: "tableCell",
          },
          {
            text: m.abv ? (typeof m.abv === "number" ? m.abv.toFixed(2) : m.abv) : "-",
            style: "tableCell",
            alignment: "right",
          },
          {
            text: m.ph
              ? typeof m.ph === "number"
                ? m.ph.toFixed(2)
                : parseFloat(m.ph).toFixed(2)
              : "-",
            style: "tableCell",
            alignment: "right",
          },
          {
            text: m.specificGravity
              ? typeof m.specificGravity === "number"
                ? m.specificGravity.toFixed(3)
                : parseFloat(m.specificGravity).toFixed(3)
              : "-",
            style: "tableCell",
            alignment: "right",
          },
          {
            text: m.temperature
              ? typeof m.temperature === "number"
                ? m.temperature.toFixed(1)
                : m.temperature
              : "-",
            style: "tableCell",
            alignment: "right",
          },
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ["25%", "15%", "15%", "15%", "15%"],
          body: measurementBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 === 0 ? "#f9fafb" : null),
        },
        margin: [0, 0, 0, 10],
      });
    }

    // Additives
    if (history.additives && history.additives.length > 0) {
      content.push({
        text: "Additives",
        fontSize: 11,
        bold: true,
        margin: [0, 5, 0, 5],
      });

      const additiveBody: any[][] = [
        [
          { text: "Additive Name", style: "tableHeader" },
          { text: "Amount", style: "tableHeader", alignment: "right" },
          { text: "Unit", style: "tableHeader" },
          { text: "Added Date", style: "tableHeader" },
        ],
      ];

      history.additives.slice(0, 10).forEach((a) => {
        additiveBody.push([
          { text: a.additiveName, style: "tableCell" },
          {
            text: a.amount.toString(),
            style: "tableCell",
            alignment: "right",
          },
          { text: a.unit, style: "tableCell" },
          { text: formatDate(new Date(a.addedAt)), style: "tableCell" },
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ["40%", "20%", "15%", "25%"],
          body: additiveBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 === 0 ? "#f9fafb" : null),
        },
        margin: [0, 0, 0, 10],
      });
    }

    // Transfers
    if (history.transfers && history.transfers.length > 0) {
      content.push({
        text: "Transfers",
        fontSize: 11,
        bold: true,
        margin: [0, 5, 0, 5],
      });

      const transferBody: any[][] = [
        [
          { text: "To Vessel", style: "tableHeader" },
          { text: "Volume (L)", style: "tableHeader", alignment: "right" },
          { text: "Transfer Date", style: "tableHeader" },
        ],
      ];

      history.transfers.forEach((t) => {
        transferBody.push([
          { text: t.destinationVesselName || "Unknown", style: "tableCell" },
          {
            text: t.volumeTransferred.toFixed(1),
            style: "tableCell",
            alignment: "right",
          },
          { text: formatDate(new Date(t.transferredAt)), style: "tableCell" },
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ["40%", "25%", "35%"],
          body: transferBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 === 0 ? "#f9fafb" : null),
        },
        margin: [0, 0, 0, 10],
      });
    }

    return content;
  }

  /**
   * Add QA section
   */
  private addQASection(data: PackagingRunPDFData): Content[] {
    return [
      {
        text: "Quality Assurance",
        style: "sectionHeader",
      },
      {
        columns: [
          {
            stack: [
              { text: "Fill Check", style: "label" },
              {
                text: data.fillCheck
                  ? data.fillCheck.charAt(0).toUpperCase() +
                    data.fillCheck.slice(1).replace("_", " ")
                  : "Not tested",
                style: "value",
                color: this.getFillCheckColor(data.fillCheck),
              },
              { text: "ABV at Packaging", style: "label" },
              {
                text:
                  data.abvAtPackaging !== undefined
                    ? `${data.abvAtPackaging.toFixed(2)}%`
                    : "Not measured",
                style: "value",
              },
            ],
            width: "50%",
          },
          {
            stack: [
              { text: "Fill Variance", style: "label" },
              {
                text:
                  data.fillVarianceML !== undefined
                    ? `${data.fillVarianceML > 0 ? "+" : ""}${data.fillVarianceML.toFixed(1)}ml`
                    : "Not measured",
                style: "value",
              },
              { text: "Carbonation Level", style: "label" },
              {
                text: this.getCarbonationDisplay(data.carbonationLevel),
                style: "value",
              },
            ],
            width: "50%",
          },
        ],
      },
      ...(data.qaNotes
        ? ([
            { text: "QA Notes", style: "label", margin: [0, 10, 0, 5] as [number, number, number, number] },
            { text: data.qaNotes, fontSize: 9, margin: [0, 0, 0, 10] as [number, number, number, number] },
          ] as any[])
        : []),
    ];
  }

  /**
   * Add production notes section
   */
  private addProductionNotes(data: PackagingRunPDFData): Content[] {
    return [
      {
        text: "Production Notes",
        style: "sectionHeader",
      },
      {
        text: data.productionNotes || "",
        fontSize: 9,
        margin: [0, 0, 0, 10],
      },
    ];
  }

  /**
   * Add inventory section
   */
  private addInventorySection(data: PackagingRunPDFData): Content[] {
    if (data.inventory.length === 0) {
      return [
        {
          text: "Inventory Details",
          style: "sectionHeader",
        },
        {
          text: "No inventory items recorded",
          fontSize: 9,
          italics: true,
          color: "#6b7280",
        },
      ];
    }

    const inventoryBody: any[][] = [
      [
        { text: "Lot Code", style: "tableHeader" },
        { text: "Package Type", style: "tableHeader" },
        { text: "Size", style: "tableHeader" },
        { text: "Expiration Date", style: "tableHeader" },
      ],
    ];

    data.inventory.forEach((item) => {
      inventoryBody.push([
        { text: item.lotCode, style: "tableCell" },
        { text: item.packageType, style: "tableCell" },
        {
          text: this.formatPackageSize(item.packageSizeML, item.packageType),
          style: "tableCell",
        },
        {
          text: formatDate(new Date(item.expirationDate)),
          style: "tableCell",
        },
      ]);
    });

    return [
      {
        text: "Inventory Details",
        style: "sectionHeader",
      },
      {
        table: {
          headerRows: 1,
          widths: ["30%", "25%", "20%", "25%"],
          body: inventoryBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 === 0 ? "#f9fafb" : null),
        },
      },
    ];
  }

  /**
   * Helper: Format package size
   */
  private formatPackageSize(sizeML: number, packageType: string): string {
    if (sizeML >= 1000) {
      return `${sizeML / 1000}L ${packageType}`;
    }
    return `${sizeML}ml ${packageType}`;
  }

  /**
   * Helper: Get status color
   */
  private getStatusColor(status: string | null): string {
    switch (status) {
      case "completed":
        return "#10b981";
      case "voided":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }

  /**
   * Helper: Get loss color
   */
  private getLossColor(lossPercentage: number): string {
    if (lossPercentage <= 2) return "#10b981";
    if (lossPercentage <= 5) return "#f59e0b";
    return "#ef4444";
  }

  /**
   * Helper: Get fill check color
   */
  private getFillCheckColor(fillCheck?: string | null): string {
    switch (fillCheck) {
      case "pass":
        return "#10b981";
      case "fail":
        return "#ef4444";
      case "not_tested":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  }

  /**
   * Helper: Get carbonation display
   */
  private getCarbonationDisplay(level?: string | null): string {
    switch (level) {
      case "still":
        return "Still (no carbonation)";
      case "petillant":
        return "Pétillant (light carbonation)";
      case "sparkling":
        return "Sparkling (full carbonation)";
      default:
        return "Not specified";
    }
  }

  /**
   * Download PDF with appropriate filename
   */
  static downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * Utility function to generate and download packaging run PDF
 */
export async function generatePackagingRunPDF(
  data: PackagingRunPDFData,
  options: PDFGeneratorOptions = {}
): Promise<void> {
  const generator = new PackagingPDFGenerator(options);
  const pdfBlob = await generator.generatePackagingRunPDF(data);

  // Generate filename
  const batchName =
    data.batch.customName ||
    data.batch.name ||
    `Batch-${data.batchId.slice(0, 8)}`;
  const date = new Date(data.packagedAt).toISOString().split("T")[0];
  const filename = `${batchName}-BottleRun-${date}.pdf`;

  PackagingPDFGenerator.downloadPDF(pdfBlob, filename);
}
