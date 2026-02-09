/**
 * Date formatting utilities for the Cidery Management App
 * Supports dynamic timezone configuration and user format preferences
 */

const DEFAULT_TZ = "America/Los_Angeles";

/**
 * Date format types matching organization settings
 */
export type DateFormatType = "mdy" | "dmy" | "ymd";
export type TimeFormatType = "12h" | "24h";

/**
 * Get locale string based on date format preference
 */
function getLocaleForFormat(format: DateFormatType): string {
  switch (format) {
    case "dmy":
      return "en-GB"; // DD/MM/YYYY
    case "ymd":
      return "sv-SE"; // YYYY-MM-DD (Swedish uses ISO format)
    case "mdy":
    default:
      return "en-US"; // MM/DD/YYYY
  }
}

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
    month: "2-digit",
    day: "2-digit",
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
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  };

  return dateObj.toLocaleString("en-US", defaultOptions);
}

/**
 * Format a date for chart labels (e.g., "Dec 15")
 * @param date - ISO date string or Date object
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Formatted date string for charts
 */
export function formatDateForChart(date: string | Date, timezone?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleDateString("en-US", {
    timeZone: timezone || DEFAULT_TZ,
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time only for display (e.g., "2:30 PM")
 * @param date - ISO date string or Date object
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Formatted time string in the specified timezone
 */
export function formatTime(date: string | Date, timezone?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleTimeString("en-US", {
    timeZone: timezone || DEFAULT_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
 * Format a date for datetime-local inputs (YYYY-MM-DDTHH:mm format)
 * Uses the org timezone so the displayed wall-clock time matches the org's location,
 * regardless of the user's browser timezone.
 * @param date - ISO date string or Date object
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Date string in YYYY-MM-DDTHH:mm format
 */
export function formatDateTimeForInput(date: string | Date, timezone?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "";
  const tz = timezone || DEFAULT_TZ;

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dateObj).map(p => [p.type, p.value]),
  );

  // Intl may return "24" for midnight — normalize to "00"
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/**
 * Parse a datetime-local input string into a UTC Date, interpreting the wall-clock
 * time in the specified timezone. This is the inverse of formatDateTimeForInput.
 *
 * Example: parseDateTimeFromInput("2025-10-15T14:30", "America/Los_Angeles")
 * → Date representing 2025-10-15T21:30:00Z (14:30 PDT = 21:30 UTC)
 *
 * @param value - String from a datetime-local input (YYYY-MM-DDTHH:mm)
 * @param timezone - IANA timezone string (defaults to Pacific if not provided)
 * @returns Date object in UTC, or Invalid Date if the input is invalid
 */
export function parseDateTimeFromInput(value: string, timezone?: string): Date {
  if (!value) return new Date(NaN);
  const tz = timezone || DEFAULT_TZ;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(NaN);

  const y = +match[1], m = +match[2], d = +match[3];
  const h = +match[4], min = +match[5];

  // Strategy: create a UTC Date at the target wall-clock values, then compute the
  // timezone offset at that approximate time and correct.
  const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(utcGuess).map(p => [p.type, p.value]),
  );

  const tzH = parts.hour === "24" ? 0 : +parts.hour;
  const tzMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, tzH, +parts.minute, +parts.second);

  // offset = what the clock shows in tz − actual UTC
  const offsetMs = tzMs - utcGuess.getTime();

  // Correct: actual UTC = target wall-clock − offset
  return new Date(utcGuess.getTime() - offsetMs);
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

// ============================================
// PREFERENCE-AWARE FORMATTING FUNCTIONS
// ============================================

/**
 * Format options for preference-aware formatting
 */
export interface FormatPreferences {
  dateFormat?: DateFormatType;
  timeFormat?: TimeFormatType;
  timezone?: string;
}

/**
 * Format a date with user preferences
 * @param date - ISO date string or Date object
 * @param preferences - User format preferences
 * @returns Formatted date string according to user preferences
 */
export function formatDateWithPreferences(
  date: string | Date,
  preferences: FormatPreferences = {},
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const { dateFormat = "mdy", timezone = DEFAULT_TZ } = preferences;
  const locale = getLocaleForFormat(dateFormat);

  return dateObj.toLocaleDateString(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format a date and time with user preferences
 * @param date - ISO date string or Date object
 * @param preferences - User format preferences
 * @returns Formatted date and time string according to user preferences
 */
export function formatDateTimeWithPreferences(
  date: string | Date,
  preferences: FormatPreferences = {},
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const { dateFormat = "mdy", timeFormat = "12h", timezone = DEFAULT_TZ } = preferences;
  const locale = getLocaleForFormat(dateFormat);

  return dateObj.toLocaleString(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}

/**
 * Format time only with user preferences
 * @param date - ISO date string or Date object
 * @param preferences - User format preferences
 * @returns Formatted time string according to user preferences
 */
export function formatTimeWithPreferences(
  date: string | Date,
  preferences: FormatPreferences = {},
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const { timeFormat = "12h", timezone = DEFAULT_TZ } = preferences;

  return dateObj.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}

/**
 * Format a date in long format with user preferences (e.g., "October 10, 2025" or "10 October 2025")
 * @param date - ISO date string or Date object
 * @param preferences - User format preferences
 * @returns Formatted date string according to user preferences
 */
export function formatDateLongWithPreferences(
  date: string | Date,
  preferences: FormatPreferences = {},
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const { dateFormat = "mdy", timezone = DEFAULT_TZ } = preferences;
  const locale = getLocaleForFormat(dateFormat);

  return dateObj.toLocaleDateString(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
