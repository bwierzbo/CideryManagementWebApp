"use client";

import { AlertTriangle, XCircle } from "lucide-react";

interface DateWarningProps {
  warning?: string | null;
  error?: string | null;
}

/**
 * Displays validation messages for date inputs.
 *
 * - warning: Amber-colored alert (non-blocking, user can proceed)
 * - error: Red-colored alert (blocking, prevents form submission)
 */
export function DateWarning({ warning, error }: DateWarningProps) {
  // Show error first (higher priority)
  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (warning) {
    return (
      <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{warning}</span>
      </div>
    );
  }

  return null;
}
