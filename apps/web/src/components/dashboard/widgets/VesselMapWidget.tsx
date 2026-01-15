"use client";

import Link from "next/link";
import { Container, Droplets, AlertCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

interface VesselData {
  vesselId: string;
  vesselName: string | null;
  vesselCapacity: string | null;
  vesselStatus: string | null;
  vesselLocation: string | null;
  batchId: string | null;
  batchNumber: string | null;
  batchStatus: string | null;
  currentVolume: string | null;
}

function getStatusColor(status: string | null, hasBatch: boolean): string {
  if (hasBatch) {
    return "bg-blue-500"; // Active with batch
  }
  switch (status) {
    case "available":
      return "bg-green-500";
    case "cleaning":
      return "bg-yellow-500";
    case "maintenance":
      return "bg-orange-500";
    case "out_of_service":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function getStatusLabel(status: string | null, hasBatch: boolean): string {
  if (hasBatch) return "In Use";
  switch (status) {
    case "available":
      return "Available";
    case "cleaning":
      return "Cleaning";
    case "maintenance":
      return "Maintenance";
    case "out_of_service":
      return "Out of Service";
    default:
      return "Unknown";
  }
}

function VesselCard({ vessel, compact }: { vessel: VesselData; compact?: boolean }) {
  const hasBatch = !!vessel.batchId;
  const capacity = Number(vessel.vesselCapacity) || 0;
  const currentVol = Number(vessel.currentVolume) || 0;
  const fillPercent = capacity > 0 ? Math.min(100, (currentVol / capacity) * 100) : 0;

  return (
    <Link
      href={hasBatch ? `/batch/${vessel.batchId}` : "/cellar"}
      className={cn(
        "block rounded-lg border p-2 hover:shadow-md transition-shadow",
        compact ? "p-1.5" : "p-2"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div
          className={cn(
            "w-3 h-3 rounded-full shrink-0",
            getStatusColor(vessel.vesselStatus, hasBatch)
          )}
        />

        {/* Vessel info */}
        <div className="flex-1 min-w-0">
          <div className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
            {vessel.vesselName || "Unknown Vessel"}
          </div>
          {hasBatch ? (
            <div className={cn("text-gray-500 truncate", compact ? "text-[10px]" : "text-xs")}>
              {vessel.batchNumber}
            </div>
          ) : (
            <div className={cn("text-gray-400", compact ? "text-[10px]" : "text-xs")}>
              {getStatusLabel(vessel.vesselStatus, hasBatch)}
            </div>
          )}
        </div>

        {/* Fill level indicator */}
        {hasBatch && capacity > 0 && (
          <div className="w-8 h-8 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeDasharray={`${fillPercent} ${100 - fillPercent}`}
                strokeDashoffset="25"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium">
              {Math.round(fillPercent)}%
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Vessel Map Widget
 * Shows visual representation of all vessels color-coded by status
 */
export function VesselMapWidget({ compact, onRefresh }: WidgetProps) {
  const { data, isPending, isFetching, error, refetch } = trpc.vessel.liquidMap.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  // Group vessels by status
  const vessels = (data?.vessels || []) as VesselData[];
  const inUseVessels = vessels.filter((v) => v.batchId);
  const availableVessels = vessels.filter(
    (v) => !v.batchId && v.vesselStatus === "available"
  );
  const otherVessels = vessels.filter(
    (v) => !v.batchId && v.vesselStatus !== "available"
  );

  return (
    <WidgetWrapper
      title="Vessel Map"
      icon={Container}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={vessels.length === 0}
      emptyMessage="No vessels configured"
    >
      <div className="space-y-3">
        {/* Summary stats */}
        <div className={cn("flex gap-3 text-center", compact && "gap-2")}>
          <div className="flex-1 bg-blue-50 rounded-lg p-2">
            <div className={cn("font-bold text-blue-700", compact ? "text-lg" : "text-xl")}>
              {inUseVessels.length}
            </div>
            <div className="text-xs text-blue-600">In Use</div>
          </div>
          <div className="flex-1 bg-green-50 rounded-lg p-2">
            <div className={cn("font-bold text-green-700", compact ? "text-lg" : "text-xl")}>
              {availableVessels.length}
            </div>
            <div className="text-xs text-green-600">Available</div>
          </div>
          {otherVessels.length > 0 && (
            <div className="flex-1 bg-yellow-50 rounded-lg p-2">
              <div className={cn("font-bold text-yellow-700", compact ? "text-lg" : "text-xl")}>
                {otherVessels.length}
              </div>
              <div className="text-xs text-yellow-600">Other</div>
            </div>
          )}
        </div>

        {/* Vessel grid */}
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3")}>
          {vessels.slice(0, compact ? 6 : 9).map((vessel) => (
            <VesselCard key={vessel.vesselId} vessel={vessel} compact={compact} />
          ))}
        </div>

        {/* View all link */}
        {vessels.length > (compact ? 6 : 9) && (
          <div className="text-center">
            <Link
              href="/cellar"
              className={cn(
                "text-blue-600 hover:text-blue-800 font-medium",
                compact ? "text-xs" : "text-sm"
              )}
            >
              View all {vessels.length} vessels →
            </Link>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.VESSEL_MAP,
  title: "Vessel Map",
  description: "Visual overview of all vessels and their status",
  icon: Container,
  category: "production",
  component: VesselMapWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md", "lg"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000, // 5 minutes
};

registerWidget(config);
