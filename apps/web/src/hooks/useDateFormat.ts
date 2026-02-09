"use client";

import { useTimezone } from "@/contexts/TimezoneContext";
import {
  formatDate as baseFormatDate,
  formatDateTime as baseFormatDateTime,
  formatDateLong as baseFormatDateLong,
  formatDateShort as baseFormatDateShort,
  formatDateForInput as baseFormatDateForInput,
  formatDateTimeForInput as baseFormatDateTimeForInput,
  parseDateTimeFromInput as baseParseDateTimeFromInput,
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
     * Format a date for datetime-local inputs (YYYY-MM-DDTHH:mm format)
     * Converts a UTC Date to the org timezone wall-clock representation.
     * @param date - ISO date string or Date object
     * @returns Date string in YYYY-MM-DDTHH:mm format in the current timezone
     */
    formatDateTimeForInput: (date: string | Date) => baseFormatDateTimeForInput(date, timezone),

    /**
     * Parse a datetime-local input string into a UTC Date using the org timezone.
     * Inverse of formatDateTimeForInput — interprets the wall-clock time in the
     * org timezone and returns the corresponding UTC Date.
     * @param value - String from a datetime-local input (YYYY-MM-DDTHH:mm)
     * @returns Date object in UTC
     */
    parseDateTimeFromInput: (value: string) => baseParseDateTimeFromInput(value, timezone),

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
