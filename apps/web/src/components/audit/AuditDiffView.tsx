"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AuditDiffViewProps {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  diffData?: Record<string, unknown> | null;
  operation: string;
}

interface DiffField {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: "added" | "removed" | "modified" | "unchanged";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function computeDiff(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): DiffField[] {
  const diffs: DiffField[] = [];
  const allKeys = new Set<string>();

  if (oldData) {
    Object.keys(oldData).forEach((key) => allKeys.add(key));
  }
  if (newData) {
    Object.keys(newData).forEach((key) => allKeys.add(key));
  }

  // Sort keys for consistent display
  const sortedKeys = Array.from(allKeys).sort();

  for (const key of sortedKeys) {
    // Skip internal fields
    if (key.startsWith("_") || key === "id" || key === "created_at" || key === "updated_at") {
      continue;
    }

    const oldValue = oldData?.[key];
    const newValue = newData?.[key];

    if (oldValue === undefined && newValue !== undefined) {
      diffs.push({ key, oldValue, newValue, changeType: "added" });
    } else if (oldValue !== undefined && newValue === undefined) {
      diffs.push({ key, oldValue, newValue, changeType: "removed" });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({ key, oldValue, newValue, changeType: "modified" });
    }
  }

  return diffs;
}

export function AuditDiffView({ oldData, newData, operation }: AuditDiffViewProps) {
  const diffs = useMemo(() => computeDiff(oldData, newData), [oldData, newData]);

  if (diffs.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-2">
        No changes detected
      </div>
    );
  }

  // For create operations, show new data as a list
  if (operation === "create" && newData) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500 mb-2">New Record Created:</div>
        <div className="grid gap-1">
          {Object.entries(newData)
            .filter(([key]) => !key.startsWith("_") && key !== "id" && key !== "created_at" && key !== "updated_at")
            .map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <span className="font-medium text-gray-600 min-w-[120px]">{formatFieldName(key)}:</span>
                <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded text-xs font-mono break-all">
                  {formatValue(value)}
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // For delete operations, show old data
  if ((operation === "delete" || operation === "soft_delete") && oldData) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500 mb-2">Deleted Record:</div>
        <div className="grid gap-1">
          {Object.entries(oldData)
            .filter(([key]) => !key.startsWith("_") && key !== "id" && key !== "created_at" && key !== "updated_at")
            .map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <span className="font-medium text-gray-600 min-w-[120px]">{formatFieldName(key)}:</span>
                <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded text-xs font-mono line-through break-all">
                  {formatValue(value)}
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // For update operations, show diff
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-500 mb-2">Changes:</div>
      <div className="grid gap-2">
        {diffs.map((diff) => (
          <div key={diff.key} className="flex items-start gap-2 text-sm">
            <Badge
              variant="outline"
              className={cn(
                "text-xs min-w-[80px] justify-center",
                diff.changeType === "added" && "bg-green-50 text-green-700 border-green-200",
                diff.changeType === "removed" && "bg-red-50 text-red-700 border-red-200",
                diff.changeType === "modified" && "bg-yellow-50 text-yellow-700 border-yellow-200"
              )}
            >
              {diff.changeType}
            </Badge>
            <span className="font-medium text-gray-600 min-w-[100px]">{formatFieldName(diff.key)}:</span>
            <div className="flex-1 flex flex-col gap-0.5">
              {diff.changeType !== "added" && (
                <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs font-mono line-through break-all">
                  {formatValue(diff.oldValue)}
                </span>
              )}
              {diff.changeType !== "removed" && (
                <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-xs font-mono break-all">
                  {formatValue(diff.newValue)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatFieldName(key: string): string {
  // Convert snake_case to Title Case
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
