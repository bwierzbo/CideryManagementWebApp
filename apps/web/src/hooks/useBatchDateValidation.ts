"use client";

import { useCallback, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import {
  validateDateConstraints,
  validatePhaseSequence,
  type ValidationPhase,
  type PackagingContext,
} from "lib";

export interface DateValidationResult {
  isValid: boolean;
  warning: string | null;
  error?: string | null; // For blocking errors (date constraints)
}

export interface UseBatchDateValidationOptions {
  bottleRunId?: string;
  phase?: ValidationPhase;
}

// Re-export ValidationPhase for convenience
export type { ValidationPhase };

/**
 * Hook for validating activity dates against a batch's earliest valid date.
 * Returns a validation function and the batch's date context.
 *
 * Features:
 * - Validates date is within acceptable range (2015-2099)
 * - Validates date is not more than 1 year in the future
 * - Validates date is after batch start date
 * - Validates production phase sequence (if phase option provided)
 *
 * @param batchId - The batch ID to validate dates against
 * @param options - Optional settings for phase validation
 * @returns Object with context, validateDate function, and earliest valid date
 */
export function useBatchDateValidation(
  batchId: string | undefined,
  options?: UseBatchDateValidationOptions
) {
  // Build the query input based on whether we need packaging context
  const queryInput = useMemo(() => {
    if (!batchId) return undefined;

    // If bottleRunId provided, use object format for packaging context
    if (options?.bottleRunId) {
      return {
        batchId,
        bottleRunId: options.bottleRunId,
      };
    }

    // Otherwise use simple string format
    return batchId;
  }, [batchId, options?.bottleRunId]);

  const { data: context, isLoading } = trpc.batch.getDateValidationContext.useQuery(
    queryInput!,
    {
      enabled: !!queryInput,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  const validateDate = useCallback(
    (date: Date | string | null | undefined): DateValidationResult => {
      // Skip validation if no date
      if (!date) {
        return { isValid: true, warning: null };
      }

      const activityDate = typeof date === "string" ? new Date(date) : date;

      // Handle invalid dates
      if (isNaN(activityDate.getTime())) {
        return { isValid: true, warning: null };
      }

      // 1. Check date constraints (year range, future limit) - BLOCKING
      const constraintResult = validateDateConstraints(activityDate);
      if (!constraintResult.isValid) {
        return {
          isValid: false,
          warning: null,
          error: constraintResult.error,
        };
      }

      // Skip batch validation if no context
      if (!context) {
        return { isValid: true, warning: null };
      }

      const earliest = new Date(context.earliestValidDate);

      // Compare dates (normalize to start of day for comparison)
      const activityDateOnly = new Date(
        activityDate.getFullYear(),
        activityDate.getMonth(),
        activityDate.getDate()
      );
      const earliestDateOnly = new Date(
        earliest.getFullYear(),
        earliest.getMonth(),
        earliest.getDate()
      );

      // 2. Check against batch start date - WARNING
      if (activityDateOnly < earliestDateOnly) {
        const formattedActivity = activityDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const formattedEarliest = earliest.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        // Determine the reason for the earliest valid date
        let reason = "";
        if (
          context.batchNameDate &&
          activityDateOnly < new Date(context.batchNameDate)
        ) {
          reason = `The batch name indicates it started on ${formattedEarliest}.`;
        } else if (
          context.transferDate &&
          activityDateOnly < new Date(context.transferDate)
        ) {
          reason = `This batch was created by transfer on ${formattedEarliest}.`;
        } else {
          reason = `The batch started on ${formattedEarliest}.`;
        }

        return {
          isValid: false,
          warning: `Date (${formattedActivity}) is before the batch's earliest valid date. ${reason} Activities typically shouldn't predate the batch.`,
        };
      }

      // 3. Check production phase sequence - WARNING
      // Check if context includes packagingContext (using 'in' to narrow union type)
      if (options?.phase && "packagingContext" in context && context.packagingContext) {
        const packagingContext: PackagingContext = {
          packagedAt: context.packagingContext.packagedAt
            ? new Date(context.packagingContext.packagedAt)
            : null,
          pasteurizedAt: context.packagingContext.pasteurizedAt
            ? new Date(context.packagingContext.pasteurizedAt)
            : null,
          labeledAt: context.packagingContext.labeledAt
            ? new Date(context.packagingContext.labeledAt)
            : null,
        };

        const phaseResult = validatePhaseSequence(
          activityDate,
          options.phase,
          packagingContext
        );

        if (!phaseResult.isValid) {
          return {
            isValid: false,
            warning: phaseResult.warning,
          };
        }
      }

      return { isValid: true, warning: null };
    },
    [context, options?.phase]
  );

  const earliestValidDate = useMemo(() => {
    if (!context) return null;
    return new Date(context.earliestValidDate);
  }, [context]);

  return {
    context,
    isLoading,
    validateDate,
    earliestValidDate,
  };
}
