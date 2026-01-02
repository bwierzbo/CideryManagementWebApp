/**
 * Date validation utilities for batch activities
 *
 * Validates that activity dates don't predate when the batch was created
 * or when it was transferred from a parent batch.
 */

export interface DateValidationContext {
  batchId: string;
  batchName: string;
  batchStartDate: Date | null;
  batchCreatedAt: Date;
  transferDate: Date | null; // If batch was created via transfer
  batchNameDate: Date | null; // Date extracted from batch name
  earliestValidDate: Date;
}

export interface DateValidationResult {
  isValid: boolean;
  warning: string | null;
  earliestValidDate: Date;
}

/**
 * Extract date from batch name that follows YYYY-MM-DD pattern
 * Example: "2025-09-27_1000 IBC 1_BLEND_A" -> Date(2025, 8, 27)
 */
export function extractDateFromBatchName(batchName: string): Date | null {
  // Match YYYY-MM-DD at the start of the batch name
  const match = batchName.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
  const day = parseInt(match[3], 10);

  // Validate the date components
  if (year < 2000 || year > 2100) return null;
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month, day, 0, 0, 0, 0);

  // Verify the date is valid (handles cases like Feb 30)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Calculate the earliest valid date for activities on a batch
 * Returns the maximum of: startDate, transferDate, batchNameDate
 */
export function calculateEarliestValidDate(
  batchStartDate: Date | null,
  batchCreatedAt: Date,
  transferDate: Date | null,
  batchNameDate: Date | null
): Date {
  const candidates: Date[] = [];

  // Always consider createdAt as a fallback
  if (batchStartDate) {
    candidates.push(new Date(batchStartDate));
  } else {
    candidates.push(new Date(batchCreatedAt));
  }

  // If this batch was created via transfer, activities can't predate that
  if (transferDate) {
    candidates.push(new Date(transferDate));
  }

  // If batch name contains a date, activities shouldn't predate that
  if (batchNameDate) {
    candidates.push(new Date(batchNameDate));
  }

  // Return the maximum (latest) date
  return candidates.reduce((max, date) => (date > max ? date : max), candidates[0]);
}

/**
 * Validate an activity date against the batch's earliest valid date
 */
export function validateActivityDate(
  activityDate: Date | string,
  context: DateValidationContext
): DateValidationResult {
  const date = typeof activityDate === 'string' ? new Date(activityDate) : activityDate;
  const earliest = context.earliestValidDate;

  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return {
      isValid: true, // Don't warn on invalid dates, let other validation handle that
      warning: null,
      earliestValidDate: earliest,
    };
  }

  // Compare dates (normalize to start of day for comparison)
  const activityDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const earliestDateOnly = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());

  if (activityDateOnly < earliestDateOnly) {
    const formattedActivity = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedEarliest = earliest.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let reason = '';
    if (context.batchNameDate && activityDateOnly < context.batchNameDate) {
      reason = `The batch name indicates it started on ${formattedEarliest}.`;
    } else if (context.transferDate && activityDateOnly < new Date(context.transferDate)) {
      reason = `This batch was created by transfer on ${formattedEarliest}.`;
    } else {
      reason = `The batch started on ${formattedEarliest}.`;
    }

    return {
      isValid: false,
      warning: `Date (${formattedActivity}) is before the batch's earliest valid date. ${reason} Activities typically shouldn't predate the batch.`,
      earliestValidDate: earliest,
    };
  }

  return {
    isValid: true,
    warning: null,
    earliestValidDate: earliest,
  };
}
