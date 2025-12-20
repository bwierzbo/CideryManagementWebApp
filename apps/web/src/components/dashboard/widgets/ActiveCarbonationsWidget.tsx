"use client";

import Link from "next/link";
import { Gauge, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function formatTimeRemaining(hoursElapsed: number, estimatedHours: number): string {
  const remaining = estimatedHours - hoursElapsed;
  if (remaining <= 0) return "Ready";
  if (remaining < 1) return "<1 hour";
  if (remaining < 24) return `${Math.round(remaining)} hours`;
  return `${Math.round(remaining / 24)} days`;
}

function ProgressRing({
  percent,
  size = 40,
  strokeWidth = 4,
  isOverdue,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  isOverdue?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isOverdue ? "#ef4444" : percent >= 100 ? "#22c55e" : "#3b82f6"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-medium", size < 40 ? "text-[10px]" : "text-xs")}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Active Carbonations Widget
 * Shows in-progress carbonation operations with progress tracking
 */
export function ActiveCarbonationsWidget({ compact, onRefresh }: WidgetProps) {
  const { data, isPending, error, refetch } = trpc.carbonation.listActive.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const carbonations = data || [];
  const overdueCount = carbonations.filter((c: any) => c.isOverdue).length;
  const readyCount = carbonations.filter((c: any) => c.percentComplete >= 100).length;

  return (
    <WidgetWrapper
      title="Active Carbonations"
      icon={Gauge}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={carbonations.length === 0}
      emptyMessage="No active carbonations"
    >
      <div className="space-y-3">
        {/* Summary badges */}
        {(overdueCount > 0 || readyCount > 0) && (
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} overdue
              </div>
            )}
            {readyCount > 0 && (
              <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
                <CheckCircle2 className="w-3 h-3" />
                {readyCount} ready
              </div>
            )}
          </div>
        )}

        {/* Carbonation list */}
        <div className="space-y-2">
          {carbonations.slice(0, compact ? 3 : 5).map((item: any) => {
            const batch = item.batch;
            const carbonation = item.carbonation;
            const estimatedHours = 48; // Default estimate

            return (
              <Link
                key={carbonation.id}
                href={`/batch/${batch?.id}`}
                className="block p-2 rounded-lg hover:bg-gray-50 transition-colors border"
              >
                <div className="flex items-center gap-3">
                  <ProgressRing
                    percent={item.percentComplete}
                    size={compact ? 36 : 44}
                    isOverdue={item.isOverdue}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
                        {batch?.batchNumber || "Unknown"}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] shrink-0",
                          item.isOverdue && "bg-red-100 text-red-800"
                        )}
                      >
                        {item.carbonationLevel}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">
                        {carbonation.carbonationProcess === "bottle_conditioning"
                          ? "Bottle cond."
                          : carbonation.carbonationProcess}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatTimeRemaining(item.hoursElapsed, estimatedHours)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400">
                        Target: {Number(carbonation.targetCo2Volumes).toFixed(1)} vol
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {Number(carbonation.pressureApplied).toFixed(1)} PSI
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* View all link */}
        {carbonations.length > (compact ? 3 : 5) && (
          <div className="text-center pt-1">
            <Link
              href="/cellar"
              className={cn(
                "text-blue-600 hover:text-blue-800 font-medium",
                compact ? "text-xs" : "text-sm"
              )}
            >
              View all {carbonations.length} carbonations →
            </Link>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.ACTIVE_CARBONATIONS,
  title: "Active Carbonations",
  description: "Track in-progress carbonation operations",
  icon: Gauge,
  category: "production",
  component: ActiveCarbonationsWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000, // 5 minutes
};

registerWidget(config);
