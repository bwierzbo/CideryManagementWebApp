"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";

interface LastActivityHintProps {
  /** Batch to look up the most recent activity for. */
  batchId?: string;
  /** The date/time currently entered in the form (to flag out-of-order entries). */
  date?: Date | string | null;
  className?: string;
}

/**
 * Shows the batch's most recent activity (label + date/time) right next to a
 * date input, so the operator can tell whether the date they're entering comes
 * after the previous step — especially useful when backdating several entries.
 * Renders nothing until the batch has at least one prior activity.
 */
export function LastActivityHint({ batchId, date, className }: LastActivityHintProps) {
  const { lastActivity } = useBatchDateValidation(batchId);
  if (!lastActivity) return null;

  const entered =
    date != null ? (typeof date === "string" ? new Date(date) : date) : null;
  const isBefore =
    entered != null && !isNaN(entered.getTime()) && entered < lastActivity.date;

  const when = lastActivity.date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <p
      className={`text-xs mt-1 flex items-center gap-1 ${
        isBefore ? "text-orange-600" : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      {isBefore ? (
        <AlertTriangle className="h-3 w-3 shrink-0" />
      ) : (
        <Clock className="h-3 w-3 shrink-0" />
      )}
      <span>
        Last activity: {lastActivity.label} — {when}
        {isBefore ? " · your date is earlier than this" : ""}
      </span>
    </p>
  );
}
