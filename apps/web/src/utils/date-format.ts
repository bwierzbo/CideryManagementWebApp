/**
 * Date formatting utilities for the Cidery Management App
 * Supports dynamic timezone configuration
 */

const DEFAULT_TZ = "America/Los_Angeles";

/**
 * Format a date string or Date object for display
 * @param date - ISO date string or Date object
 * @param options - Intl.DateTimeFormatOptions to customize the format
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Formatted date string in the specified timezone
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
  timezone?: string,
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone || DEFAULT_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };

  return dateObj.toLocaleDateString("en-US", defaultOptions);
}

/**
 * Format a date and time for display
 * @param date - ISO date string or Date object
 * @param options - Intl.DateTimeFormatOptions to customize the format
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Formatted date and time string in the specified timezone
 */
export function formatDateTime(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
  timezone?: string,
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone || DEFAULT_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  };

  return dateObj.toLocaleDateString("en-US", defaultOptions);
}

/**
 * Format a date for display in long format (e.g., "October 10, 2025")
 * @param date - ISO date string or Date object
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Formatted date string in the specified timezone
 */
export function formatDateLong(date: string | Date, timezone?: string): string {
  return formatDate(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }, timezone);
}

/**
 * Format a date for display in short format (e.g., "10/10/2025")
 * @param date - ISO date string or Date object
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Formatted date string in the specified timezone
 */
export function formatDateShort(date: string | Date, timezone?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleDateString("en-US", {
    timeZone: timezone || DEFAULT_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/**
 * Get the current date/time in the specified timezone
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Current date in the specified timezone
 */
export function nowInTimezone(timezone?: string): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone || DEFAULT_TZ })
  );
}

/**
 * Get the current date/time in Pacific timezone
 * @returns Current date in Pacific timezone
 * @deprecated Use nowInTimezone() instead
 */
export function nowInPacific(): Date {
  return nowInTimezone(DEFAULT_TZ);
}

/**
 * Format a date for form inputs (YYYY-MM-DD format)
 * This extracts the date in the specified timezone without time shift issues
 * @param date - ISO date string or Date object
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(date: string | Date, timezone?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const tz = timezone || DEFAULT_TZ;

  // Format in specified timezone to get the correct date components
  const year = dateObj.toLocaleDateString("en-US", {
    timeZone: tz,
    year: "numeric",
  });
  const month = dateObj.toLocaleDateString("en-US", {
    timeZone: tz,
    month: "2-digit",
  });
  const day = dateObj.toLocaleDateString("en-US", {
    timeZone: tz,
    day: "2-digit",
  });

  return `${year}-${month}-${day}`;
}

/**
 * Parse a date input string (YYYY-MM-DD) from an HTML date input
 * Creates a Date object representing that calendar date without timezone shifts
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing the calendar date, or null if invalid
 */
export function parseDateInput(dateString: string): Date | null {
  if (!dateString || dateString.trim() === "") {
    return null;
  }

  // Parse the date string (YYYY-MM-DD) and create a Date object in local timezone
  // Using the Date constructor with year, month, day avoids timezone conversion issues
  const parts = dateString.split("-").map(Number);

  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }

  const [year, month, day] = parts;

  // Month is 0-indexed in JavaScript Date
  const date = new Date(year, month - 1, day);

  // Validate that the date is valid (e.g., not Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
