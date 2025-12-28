/**
 * Date helper utilities for report date range selection
 */
import { formatDate, formatDateForInput as centralizedFormatDateForInput } from "@/utils/date-format";

export type DateRangePreset =
  | "yesterday"
  | "last-week"
  | "last-30-days"
  | "last-90-days"
  | "this-month"
  | "last-month"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "this-year"
  | "last-year"
  | "lifetime"
  | "custom";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Get the start and end dates for a specific quarter of a given year
 */
export function getQuarterDates(quarter: 1 | 2 | 3 | 4, year: number): DateRange {
  const quarterStarts = {
    1: new Date(year, 0, 1), // Jan 1
    2: new Date(year, 3, 1), // Apr 1
    3: new Date(year, 6, 1), // Jul 1
    4: new Date(year, 9, 1), // Oct 1
  };

  const quarterEnds = {
    1: new Date(year, 2, 31, 23, 59, 59, 999), // Mar 31
    2: new Date(year, 5, 30, 23, 59, 59, 999), // Jun 30
    3: new Date(year, 8, 30, 23, 59, 59, 999), // Sep 30
    4: new Date(year, 11, 31, 23, 59, 59, 999), // Dec 31
  };

  return {
    startDate: quarterStarts[quarter],
    endDate: quarterEnds[quarter],
    label: `Q${quarter} ${year}`,
  };
}

/**
 * Get yesterday's date range
 */
export function getYesterdayDates(): DateRange {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
  const endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "Yesterday",
  };
}

/**
 * Get last week's date range (Monday to Sunday of the previous week)
 */
export function getLastWeekDates(): DateRange {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Calculate the most recent Sunday (end of last week)
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);

  // Calculate the Monday before that (start of last week)
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  const startDate = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate(), 0, 0, 0, 0);
  const endDate = new Date(lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate(), 23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "Last Week",
  };
}

/**
 * Get the last 30 days date range
 */
export function getLast30DaysDates(): DateRange {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "Last 30 Days",
  };
}

/**
 * Get the last 90 days date range
 */
export function getLast90DaysDates(): DateRange {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "Last 90 Days",
  };
}

/**
 * Get the start and end dates for the current month
 */
export function getThisMonthDates(): DateRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "This Month",
  };
}

/**
 * Get the start and end dates for the previous month
 */
export function getLastMonthDates(): DateRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "Last Month",
  };
}

/**
 * Get the start and end dates for the current year
 */
export function getThisYearDates(): DateRange {
  const now = new Date();
  const year = now.getFullYear();

  return {
    startDate: new Date(year, 0, 1),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
    label: `${year}`,
  };
}

/**
 * Get the start and end dates for the previous year
 */
export function getLastYearDates(): DateRange {
  const now = new Date();
  const lastYear = now.getFullYear() - 1;

  return {
    startDate: new Date(lastYear, 0, 1),
    endDate: new Date(lastYear, 11, 31, 23, 59, 59, 999),
    label: `${lastYear}`,
  };
}

/**
 * Get a date range for "all time" (starting from a reasonable earliest date)
 */
export function getLifetimeDates(): DateRange {
  // Use 2020 as a reasonable "earliest date" for a cidery app
  const startDate = new Date(2020, 0, 1);
  const endDate = new Date(); // Now
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: "Lifetime",
  };
}

/**
 * Get date range based on a preset selection
 */
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  switch (preset) {
    case "yesterday":
      return getYesterdayDates();

    case "last-week":
      return getLastWeekDates();

    case "last-30-days":
      return getLast30DaysDates();

    case "last-90-days":
      return getLast90DaysDates();

    case "this-month":
      return getThisMonthDates();

    case "last-month":
      return getLastMonthDates();

    case "q1":
      return getQuarterDates(1, currentYear);

    case "q2":
      return getQuarterDates(2, currentYear);

    case "q3":
      return getQuarterDates(3, currentYear);

    case "q4":
      return getQuarterDates(4, currentYear);

    case "this-year":
      return getThisYearDates();

    case "last-year":
      return getLastYearDates();

    case "lifetime":
      return getLifetimeDates();

    case "custom":
      return null; // Custom ranges are handled by date picker

    default:
      return null;
  }
}

/**
 * Format a date range for display using centralized formatDate
 */
export function formatDateRangeDisplay(startDate: Date, endDate: Date): string {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  return `${start} - ${end}`;
}

/**
 * Format a date range for filenames (safe characters only)
 * Uses YYYY-MM-DD format which is safe for filenames
 */
export function formatDateRangeFilename(startDate: Date, endDate: Date): string {
  return `${centralizedFormatDateForInput(startDate)}_${centralizedFormatDateForInput(endDate)}`;
}

/**
 * Format a date to YYYY-MM-DD for input[type="date"]
 * Re-exported from centralized date-format utility for backwards compatibility
 */
export { centralizedFormatDateForInput as formatDateForInput };
