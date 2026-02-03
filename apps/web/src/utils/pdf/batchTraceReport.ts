/**
 * PDF generation utility for Batch Trace Report
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

// Lazy import pdfMake to avoid SSR issues
const getPdfMake = async () => {
  const pdfMake = await import("pdfmake/build/pdfmake");
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake.default as any).vfs = pdfFonts.default;
  return pdfMake.default;
};

/**
 * Batch Trace Report PDF Data interface
 */
export interface BatchTraceReportPDFData {
  asOfDate: string;
  summary: {
    totalBatches: number;
    totalInitialVolume: number;
    totalCurrentVolume: number;
    totalInflow: number;
    totalTransferred: number;
    totalPackaged: number;
    totalLosses: number;
    totalChildrenRemaining?: number;
    totalRemaining?: number;
    totalDiscrepancy: number;
  };
  batches: Array<{
    id: string;
    name: string;
    customName: string | null;
    vesselName: string | null;
    initialVolume: number;
    currentVolume: number;
    status: string | null;
    entries: Array<{
      date: Date | string;
      type: string;
      description: string;
      volumeOut: number;
      volumeIn: number;
      loss: number;
      childOutcomes?: Array<{
        type: string;
        description: string;
        volume: number;
        grandchildCurrentVolume?: number;
      }>;
    }>;
    summary: {
      totalInflow: number;
      totalOutflow: number;
      totalLoss: number;
      totalPackaged: number;
      childrenRemaining?: number;
      totalRemaining?: number;
      discrepancy: number;
    };
  }>;
}

/**
 * Format a number with one decimal place
 */
function formatVolume(value: number): string {
  return value.toFixed(1) + " L";
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Get type label
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    transfer: "Transfer",
    transfer_in: "Blend In",
    racking: "Racking",
    filtering: "Filtering",
    bottling: "Bottling",
    kegging: "Kegging",
    distillation: "Distillation",
  };
  return labels[type] || type;
}

/**
 * Generate PDF document for Batch Trace Report
 */
export function generateBatchTraceReportPDF(
  data: BatchTraceReportPDFData
): TDocumentDefinitions {
  const content: Content[] = [];

  // Header
  content.push({
    text: "Batch Tracing Report",
    style: "header",
  });

  content.push({
    text: `As of ${data.asOfDate}`,
    style: "subheader",
  });

  content.push({
    text: `Generated: ${new Date().toLocaleString("en-US")}`,
    style: "generatedDate",
    margin: [0, 0, 0, 20],
  });

  // Summary Section
  content.push({
    text: "Summary",
    style: "sectionHeader",
  });

  const summaryTable = {
    table: {
      widths: ["*", "*", "*", "*", "*", "*"],
      body: [
        [
          { text: "Base Batches", style: "tableHeader" },
          { text: "Initial Volume", style: "tableHeader" },
          { text: "Transferred", style: "tableHeader" },
          { text: "Packaged", style: "tableHeader" },
          { text: "Losses", style: "tableHeader" },
          { text: "Current Volume", style: "tableHeader" },
        ],
        [
          { text: data.summary.totalBatches.toString(), style: "tableCell" },
          { text: formatVolume(data.summary.totalInitialVolume), style: "tableCell" },
          { text: formatVolume(data.summary.totalTransferred), style: "tableCellIndigo" },
          { text: formatVolume(data.summary.totalPackaged), style: "tableCellGreen" },
          { text: formatVolume(data.summary.totalLosses), style: "tableCellAmber" },
          { text: formatVolume(data.summary.totalCurrentVolume), style: "tableCell" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 20] as [number, number, number, number],
  };

  content.push(summaryTable);

  // Batch Details Section
  content.push({
    text: `Batch Details (${data.batches.length} batches)`,
    style: "sectionHeader",
    pageBreak: "before",
  });

  for (const batch of data.batches) {
    const hasDiscrepancy = Math.abs(batch.summary.discrepancy) > 0.5;

    // Batch header
    content.push({
      text: batch.customName || batch.name,
      style: "batchName",
      margin: [0, 15, 0, 5],
    });

    if (batch.vesselName) {
      content.push({
        text: `Vessel: ${batch.vesselName}`,
        style: "batchVessel",
      });
    }

    // Batch summary line
    const summaryParts = [
      `Initial: ${formatVolume(batch.initialVolume)}`,
      `Transferred: ${formatVolume(batch.summary.totalOutflow)}`,
      `Packaged: ${formatVolume(batch.summary.totalPackaged)}`,
      `Losses: ${formatVolume(batch.summary.totalLoss)}`,
      `Current: ${formatVolume(batch.currentVolume)}`,
    ];
    if (hasDiscrepancy) {
      summaryParts.push(
        `Discrepancy: ${batch.summary.discrepancy > 0 ? "+" : ""}${formatVolume(batch.summary.discrepancy)}`
      );
    }

    content.push({
      text: summaryParts.join(" | "),
      style: hasDiscrepancy ? "batchSummaryWarning" : "batchSummary",
      margin: [0, 0, 0, 10],
    });

    // Entries table
    if (batch.entries.length > 0) {
      const entriesBody: any[][] = [
        [
          { text: "Date", style: "tableHeader" },
          { text: "Type", style: "tableHeader" },
          { text: "Description", style: "tableHeader" },
          { text: "Volume", style: "tableHeaderRight" },
          { text: "Loss", style: "tableHeaderRight" },
        ],
      ];

      for (const entry of batch.entries) {
        // Main entry row
        let volumeText = "—";
        let volumeStyle = "tableCellRight";
        if ((entry.volumeIn ?? 0) > 0) {
          volumeText = `+${formatVolume(entry.volumeIn)}`;
          volumeStyle = "tableCellGreen";
        } else if (entry.volumeOut > 0) {
          volumeText = `-${formatVolume(entry.volumeOut)}`;
          volumeStyle = "tableCellIndigo";
        }

        let lossText = "—";
        let lossStyle = "tableCellRight";
        if (entry.loss > 0) {
          lossText = `-${formatVolume(entry.loss)}`;
          lossStyle = "tableCellAmber";
        }

        entriesBody.push([
          { text: formatDate(entry.date), style: "tableCell" },
          { text: getTypeLabel(entry.type), style: "tableCell" },
          { text: entry.description, style: "tableCell" },
          { text: volumeText, style: volumeStyle },
          { text: lossText, style: lossStyle },
        ]);

        // Child outcomes (if any)
        if (entry.childOutcomes && entry.childOutcomes.length > 0) {
          for (const child of entry.childOutcomes) {
            const isLoss = child.type === "loss";
            const isPackaging = child.type === "bottling" || child.type === "kegging";

            entriesBody.push([
              { text: "", style: "tableCell" },
              { text: "  ↳", style: "tableCellMuted" },
              { text: child.description, style: "tableCellMuted" },
              {
                text: isPackaging ? formatVolume(child.volume) : "—",
                style: isPackaging ? "tableCellGreen" : "tableCellMuted",
              },
              {
                text: isLoss ? `-${formatVolume(child.volume)}` : "—",
                style: isLoss ? "tableCellAmber" : "tableCellMuted",
              },
            ]);
          }
        }
      }

      content.push({
        table: {
          headerRows: 1,
          widths: [60, 60, "*", 70, 60],
          body: entriesBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10] as [number, number, number, number],
      });
    } else {
      content.push({
        text: "No volume flow events recorded",
        style: "noData",
        margin: [0, 0, 0, 10],
      });
    }
  }

  // Document definition
  const docDefinition: TDocumentDefinitions = {
    content,
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        color: "#1f2937",
        margin: [0, 0, 0, 5],
      },
      subheader: {
        fontSize: 14,
        color: "#6b7280",
        margin: [0, 0, 0, 5],
      },
      generatedDate: {
        fontSize: 10,
        color: "#9ca3af",
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: "#374151",
        margin: [0, 15, 0, 10],
      },
      batchName: {
        fontSize: 12,
        bold: true,
        color: "#1f2937",
      },
      batchVessel: {
        fontSize: 10,
        color: "#6b7280",
      },
      batchSummary: {
        fontSize: 9,
        color: "#4b5563",
      },
      batchSummaryWarning: {
        fontSize: 9,
        color: "#d97706",
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: "#374151",
        fillColor: "#f3f4f6",
        margin: [0, 4, 0, 4],
      },
      tableHeaderRight: {
        fontSize: 9,
        bold: true,
        color: "#374151",
        fillColor: "#f3f4f6",
        alignment: "right",
        margin: [0, 4, 0, 4],
      },
      tableCell: {
        fontSize: 8,
        color: "#4b5563",
        margin: [0, 3, 0, 3],
      },
      tableCellRight: {
        fontSize: 8,
        color: "#4b5563",
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      tableCellMuted: {
        fontSize: 8,
        color: "#9ca3af",
        margin: [0, 2, 0, 2],
      },
      tableCellGreen: {
        fontSize: 8,
        color: "#059669",
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      tableCellIndigo: {
        fontSize: 8,
        color: "#4f46e5",
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      tableCellAmber: {
        fontSize: 8,
        color: "#d97706",
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      noData: {
        fontSize: 9,
        color: "#9ca3af",
        italics: true,
      },
    },
    pageMargins: [40, 40, 40, 40],
    pageSize: "LETTER",
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#9ca3af",
      margin: [0, 20, 0, 0],
    }),
  };

  return docDefinition;
}

/**
 * Download the Batch Trace Report PDF
 */
export async function downloadBatchTraceReportPDF(
  data: BatchTraceReportPDFData,
  filename?: string
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateBatchTraceReportPDF(data);
  const defaultFilename = `batch-trace-report-${data.asOfDate}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename || defaultFilename);
}

/**
 * Open the Batch Trace Report PDF in a new window/tab
 */
export async function openBatchTraceReportPDF(
  data: BatchTraceReportPDFData
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateBatchTraceReportPDF(data);
  pdfMake.createPdf(docDefinition).open();
}
