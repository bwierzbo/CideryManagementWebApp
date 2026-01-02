"use client";

import { useCallback, useMemo } from "react";
import { trpc } from "@/utils/trpc";

export interface DateValidationResult {
  isValid: boolean;
  warning: string | null;
}

/**
 * Hook for validating activity dates against a batch's earliest valid date.
 * Returns a validation function and the batch's date context.
 *
 * @param batchId - The batch ID to validate dates against
 * @returns Object with context, validateDate function, and earliest valid date
 */
export function useBatchDateValidation(batchId: string | undefined) {
  const { data: context, isLoading } = trpc.batch.getDateValidationContext.useQuery(
    batchId!,
    {
      enabled: !!batchId,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  const validateDate = useCallback(
    (date: Date | string | null | undefined): DateValidationResult => {
      // Skip validation if no context or no date
      if (!context || !date) {
        return { isValid: true, warning: null };
      }

      const activityDate = typeof date === "string" ? new Date(date) : date;

      // Handle invalid dates
      if (isNaN(activityDate.getTime())) {
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

      return { isValid: true, warning: null };
    },
    [context]
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
