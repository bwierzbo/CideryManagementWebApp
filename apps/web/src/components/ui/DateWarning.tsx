"use client";

import { AlertTriangle } from "lucide-react";

interface DateWarningProps {
  warning: string | null;
}

/**
 * Displays a warning message when a date validation issue is detected.
 * Shows an amber-colored alert box with a warning icon.
 */
export function DateWarning({ warning }: DateWarningProps) {
  if (!warning) return null;

  return (
    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{warning}</span>
    </div>
  );
}
