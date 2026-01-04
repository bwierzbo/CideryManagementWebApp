/**
 * Date validation utilities for batch activities
 *
 * Validates that activity dates don't predate when the batch was created
 * or when it was transferred from a parent batch.
 *
 * Also provides:
 * - Date input constraints (year range, future date limits)
 * - Production phase sequence validation
 */

// =============================================================================
// Constants
// =============================================================================

const MIN_YEAR = 2015;
const MAX_YEAR = 2099;
const MAX_FUTURE_DAYS = 365;

// =============================================================================
// Date Constraint Validation
// =============================================================================

export interface DateConstraintResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validate date against basic constraints:
 * - Year must be between MIN_YEAR and MAX_YEAR
 * - Cannot be more than MAX_FUTURE_DAYS in the future
 */
export function validateDateConstraints(date: Date | string): DateConstraintResult {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return { isValid: false, error: "Invalid date format" };
  }

  const year = d.getFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return {
      isValid: false,
      error: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`,
    };
  }

  const maxFutureDate = new Date();
  maxFutureDate.setDate(maxFutureDate.getDate() + MAX_FUTURE_DAYS);
  if (d > maxFutureDate) {
    return {
      isValid: false,
      error: "Date cannot be more than 1 year in the future",
    };
  }

  return { isValid: true, error: null };
}

// =============================================================================
// Production Phase Sequence Validation
// =============================================================================

export type ValidationPhase =
  | "measurement"
  | "additive"
  | "racking"
  | "filtering"
  | "carbonation"
  | "bottling"
  | "pasteurization"
  | "labeling"
  | "completion";

export interface PackagingContext {
  packagedAt: Date | null;
  pasteurizedAt: Date | null;
  labeledAt: Date | null;
}

export interface PhaseValidationResult {
  isValid: boolean;
  warning: string | null;
}

/**
 * Format a date for display in validation messages
 */
function formatDateForMessage(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Validate that activity date respects production phase sequence
 *
 * Rules:
 * - Pasteurization must be after bottling
 * - Labeling must be after bottling
 * - Completion must be after bottling, pasteurization (if done), and labeling (if done)
 */
export function validatePhaseSequence(
  activityDate: Date | string,
  phase: ValidationPhase,
  packagingContext: PackagingContext
): PhaseValidationResult {
  const date = typeof activityDate === "string" ? new Date(activityDate) : activityDate;

  if (isNaN(date.getTime())) {
    return { isValid: true, warning: null };
  }

  const { packagedAt, pasteurizedAt, labeledAt } = packagingContext;

  // Normalize to start of day for comparison
  const activityDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  switch (phase) {
    case "pasteurization":
      if (packagedAt) {
        const packagedDateOnly = new Date(
          packagedAt.getFullYear(),
          packagedAt.getMonth(),
          packagedAt.getDate()
        );
        if (activityDateOnly < packagedDateOnly) {
          return {
            isValid: false,
            warning: `Pasteurization date is before bottling date (${formatDateForMessage(packagedAt)}). Pasteurization must occur after bottling.`,
          };
        }
      }
      break;

    case "labeling":
      if (packagedAt) {
        const packagedDateOnly = new Date(
          packagedAt.getFullYear(),
          packagedAt.getMonth(),
          packagedAt.getDate()
        );
        if (activityDateOnly < packagedDateOnly) {
          return {
            isValid: false,
            warning: `Labeling date is before bottling date (${formatDateForMessage(packagedAt)}). Labels are typically applied after bottling.`,
          };
        }
      }
      break;

    case "completion":
      // Must be after bottling
      if (packagedAt) {
        const packagedDateOnly = new Date(
          packagedAt.getFullYear(),
          packagedAt.getMonth(),
          packagedAt.getDate()
        );
        if (activityDateOnly < packagedDateOnly) {
          return {
            isValid: false,
            warning: `Completion date is before bottling date (${formatDateForMessage(packagedAt)}).`,
          };
        }
      }
      // Must be after pasteurization if done
      if (pasteurizedAt) {
        const pasteurizedDateOnly = new Date(
          pasteurizedAt.getFullYear(),
          pasteurizedAt.getMonth(),
          pasteurizedAt.getDate()
        );
        if (activityDateOnly < pasteurizedDateOnly) {
          return {
            isValid: false,
            warning: `Completion date is before pasteurization date (${formatDateForMessage(pasteurizedAt)}).`,
          };
        }
      }
      // Must be after labeling if done
      if (labeledAt) {
        const labeledDateOnly = new Date(
          labeledAt.getFullYear(),
          labeledAt.getMonth(),
          labeledAt.getDate()
        );
        if (activityDateOnly < labeledDateOnly) {
          return {
            isValid: false,
            warning: `Completion date is before labeling date (${formatDateForMessage(labeledAt)}).`,
          };
        }
      }
      break;
  }

  return { isValid: true, warning: null };
}

// =============================================================================
// Batch Date Validation Context
// =============================================================================

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
