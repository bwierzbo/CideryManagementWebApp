/**
 * Utilities for printing and PDF generation
 */

/**
 * Opens browser print dialog for a specific element
 * The element should be wrapped in a PrintableDocument component
 */
export function printElement(element: HTMLElement): void {
  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    console.error("Failed to open print window. Check popup blocker.");
    return;
  }

  // Clone the element and its styles
  const clonedElement = element.cloneNode(true) as HTMLElement;

  // Get all stylesheets from the current page
  const styleSheets = Array.from(document.styleSheets);
  let styles = "";

  styleSheets.forEach((sheet) => {
    try {
      if (sheet.cssRules) {
        Array.from(sheet.cssRules).forEach((rule) => {
          styles += rule.cssText + "\n";
        });
      }
    } catch (e) {
      // Skip cross-origin stylesheets
      console.warn("Could not access stylesheet:", e);
    }
  });

  // Write the print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Print Document</title>
        <style>
          ${styles}

          /* Print-specific overrides */
          body {
            margin: 0;
            padding: 0;
            background: white;
            color: black;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${clonedElement.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
}

/**
 * Generates a PDF from an HTML element using html2pdf.js
 * @param element The HTML element to convert to PDF
 * @param filename The name for the downloaded PDF file
 */
export async function downloadPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  // Dynamically import html2pdf to avoid SSR issues
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default;

  // Using any here because html2pdf.js type definitions have inconsistencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfOptions: any = {
    margin: 0.5,
    filename: filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  try {
    await html2pdf().set(pdfOptions).from(element).save();
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
}

/**
 * Generates PDF as blob for preview or upload
 */
export async function generatePDFBlob(element: HTMLElement): Promise<Blob> {
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default;

  // Using any here because html2pdf.js type definitions have inconsistencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfOptions: any = {
    margin: 0.5,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
  };

  try {
    const blob = await html2pdf()
      .set(pdfOptions)
      .from(element)
      .outputPdf("blob");
    return blob;
  } catch (error) {
    console.error("Failed to generate PDF blob:", error);
    throw error;
  }
}
