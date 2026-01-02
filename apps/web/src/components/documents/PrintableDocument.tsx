"use client";

import { forwardRef, ReactNode } from "react";

interface PrintableDocumentProps {
  children: ReactNode;
  className?: string;
  pageSize?: "letter" | "a4";
}

/**
 * Wrapper component for printable documents
 * Provides consistent styling for print output
 */
export const PrintableDocument = forwardRef<
  HTMLDivElement,
  PrintableDocumentProps
>(function PrintableDocument(
  { children, className = "", pageSize = "letter" },
  ref
) {
  const pageSizeClass = pageSize === "letter" ? "print-letter" : "print-a4";

  return (
    <div
      ref={ref}
      className={`printable-document ${pageSizeClass} ${className}`}
      style={{
        backgroundColor: "white",
        color: "black",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide non-printable elements */
          .no-print,
          nav,
          header:not(.print-header),
          footer:not(.print-footer),
          button,
          .btn,
          [role="dialog"] > div:first-child {
            display: none !important;
          }

          /* Page setup */
          @page {
            size: ${pageSize};
            margin: 0.75in;
          }

          /* Ensure backgrounds print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Document container fills page */
          .printable-document {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Ensure page breaks work properly */
          .page-break-before {
            page-break-before: always;
          }
          .page-break-after {
            page-break-after: always;
          }
          .avoid-page-break {
            page-break-inside: avoid;
          }

          /* Table styling for print */
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }

        /* Screen preview styling */
        @media screen {
          .printable-document {
            max-width: 8.5in;
            min-height: 11in;
            margin: 0 auto;
            padding: 0.75in;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
          }

          .print-a4 {
            max-width: 210mm;
            min-height: 297mm;
          }
        }
      `}</style>

      {children}
    </div>
  );
});
