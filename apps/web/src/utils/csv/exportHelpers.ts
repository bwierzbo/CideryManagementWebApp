/**
 * CSV Export Helper Utilities
 */

/**
 * Escape a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Check if needs escaping
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert an array of objects to CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{ key: keyof T; header: string }>
): string {
  if (data.length === 0) {
    return columns.map((col) => escapeCSVValue(col.header)).join(",");
  }

  // Header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(",");

  // Data rows
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCSVValue(row[col.key])).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download a CSV string as a file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Format a date for CSV export (YYYY-MM-DD)
 */
export function formatDateForCSV(date: Date | string | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return d.toISOString().split("T")[0];
}

/**
 * Format a number for CSV export with specified decimal places
 */
export function formatNumberForCSV(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(decimals);
}
