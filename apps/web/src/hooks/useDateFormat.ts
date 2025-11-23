"use client";

import { useTimezone } from "@/contexts/TimezoneContext";
import {
  formatDate as baseFormatDate,
  formatDateTime as baseFormatDateTime,
  formatDateLong as baseFormatDateLong,
  formatDateShort as baseFormatDateShort,
  formatDateForInput as baseFormatDateForInput,
  nowInTimezone,
} from "@/utils/date-format";

/**
 * Hook to get timezone-aware date formatting functions
 * Automatically uses the system timezone setting from context
 *
 * @returns Object with date formatting functions that use the current timezone
 *
 * @example
 * ```tsx
 * const { formatDate, formatDateTime } = useDateFormat();
 *
 * // Date will be formatted in the user's configured timezone
 * const formattedDate = formatDate(batch.createdAt);
 * ```
 */
export function useDateFormat() {
  const timezone = useTimezone();

  return {
    /**
     * Format a date string or Date object for display
     * @param date - ISO date string or Date object
     * @param options - Intl.DateTimeFormatOptions to customize the format
     * @returns Formatted date string in the current timezone
     */
    formatDate: (
      date: string | Date,
      options?: Intl.DateTimeFormatOptions,
    ) => baseFormatDate(date, options, timezone),

    /**
     * Format a date and time for display
     * @param date - ISO date string or Date object
     * @param options - Intl.DateTimeFormatOptions to customize the format
     * @returns Formatted date and time string in the current timezone
     */
    formatDateTime: (
      date: string | Date,
      options?: Intl.DateTimeFormatOptions,
    ) => baseFormatDateTime(date, options, timezone),

    /**
     * Format a date for display in long format (e.g., "October 10, 2025")
     * @param date - ISO date string or Date object
     * @returns Formatted date string in the current timezone
     */
    formatDateLong: (date: string | Date) => baseFormatDateLong(date, timezone),

    /**
     * Format a date for display in short format (e.g., "10/10/2025")
     * @param date - ISO date string or Date object
     * @returns Formatted date string in the current timezone
     */
    formatDateShort: (date: string | Date) => baseFormatDateShort(date, timezone),

    /**
     * Format a date for form inputs (YYYY-MM-DD format)
     * @param date - ISO date string or Date object
     * @returns Date string in YYYY-MM-DD format in the current timezone
     */
    formatDateForInput: (date: string | Date) => baseFormatDateForInput(date, timezone),

    /**
     * Get the current date/time in the configured timezone
     * @returns Current date in the current timezone
     */
    nowInTimezone: () => nowInTimezone(timezone),

    /**
     * Get the current timezone string
     * @returns IANA timezone string (e.g., "America/Los_Angeles")
     */
    timezone,
  };
}
