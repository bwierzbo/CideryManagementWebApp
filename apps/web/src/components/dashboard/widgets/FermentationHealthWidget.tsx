"use client";

import Link from "next/link";
import { Activity, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BatchHealth {
  id: string;
  batchNumber: string;
  customName: string | null;
  status: string;
  vesselName: string | null;
  daysActive: number;
  abv: string | null;
  specificGravity: string | null;
  health: "healthy" | "stalled" | "active" | "unknown";
}

function getHealthStatus(
  sg: number | null,
  daysActive: number,
  status: string
): "healthy" | "stalled" | "active" | "unknown" {
  if (status === "conditioning") return "healthy";
  if (!sg) return "unknown";

  // If SG is still high after many days, might be stalled
  if (sg > 1.02 && daysActive > 21) return "stalled";
  if (sg > 1.01 && daysActive > 30) return "stalled";

  // Active fermentation
  if (sg > 1.01) return "active";

  return "healthy";
}

function getHealthBadge(health: string) {
  switch (health) {
    case "healthy":
      return <Badge className="bg-green-100 text-green-800 text-xs">Healthy</Badge>;
    case "stalled":
      return <Badge className="bg-red-100 text-red-800 text-xs">Stalled</Badge>;
    case "active":
      return <Badge className="bg-blue-100 text-blue-800 text-xs">Active</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800 text-xs">Unknown</Badge>;
  }
}

function SGProgressBar({ sg, compact }: { sg: number | null; compact?: boolean }) {
  if (!sg) return null;

  // SG typically goes from ~1.050-1.100 (OG) to ~0.995-1.010 (FG)
  // Map to 0-100% where 1.100 = 0% and 1.000 = 100%
  const minSG = 1.0;
  const maxSG = 1.1;
  const progress = Math.max(0, Math.min(100, ((maxSG - sg) / (maxSG - minSG)) * 100));

  return (
    <div className="w-full">
      <div className={cn("flex justify-between mb-1", compact ? "text-[10px]" : "text-xs")}>
        <span className="text-gray-500">SG: {sg.toFixed(3)}</span>
        <span className="text-gray-400">{Math.round(progress)}% complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Fermentation Health Widget
 * Shows fermentation progress and identifies stalled fermentations
 */
export function FermentationHealthWidget({ compact, onRefresh }: WidgetProps) {
  const { data, isPending, error, refetch } = trpc.dashboard.getRecentBatches.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  // Process batches to determine health status
  const batches: BatchHealth[] = (data?.batches || [])
    .filter((b: any) => b.status === "fermentation" || b.status === "aging")
    .map((b: any) => {
      const sg = b.specificGravity ? parseFloat(b.specificGravity) : null;
      return {
        id: b.id,
        batchNumber: b.batchNumber,
        customName: b.customName,
        status: b.status,
        vesselName: b.vesselName,
        daysActive: b.daysActive,
        abv: b.abv,
        specificGravity: b.specificGravity,
        health: getHealthStatus(sg, b.daysActive, b.status),
      };
    });

  const stalledCount = batches.filter((b) => b.health === "stalled").length;
  const activeCount = batches.filter((b) => b.health === "active").length;
  const healthyCount = batches.filter((b) => b.health === "healthy").length;

  return (
    <WidgetWrapper
      title="Fermentation Health"
      icon={Activity}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={batches.length === 0}
      emptyMessage="No active fermentations"
    >
      <div className="space-y-3">
        {/* Health summary */}
        <div className={cn("flex gap-2", compact && "gap-1")}>
          {stalledCount > 0 && (
            <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs">
              <AlertCircle className="w-3 h-3" />
              {stalledCount} stalled
            </div>
          )}
          {activeCount > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
              <TrendingDown className="w-3 h-3" />
              {activeCount} active
            </div>
          )}
          {healthyCount > 0 && (
            <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
              <CheckCircle className="w-3 h-3" />
              {healthyCount} complete
            </div>
          )}
        </div>

        {/* Batch list */}
        <div className="space-y-2">
          {batches.slice(0, compact ? 3 : 5).map((batch) => (
            <Link
              key={batch.id}
              href={`/batch/${batch.id}`}
              className="block p-2 rounded-lg hover:bg-gray-50 transition-colors border"
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                    {batch.batchNumber}
                  </span>
                  {batch.vesselName && (
                    <span className="text-gray-400 text-xs ml-2">
                      {batch.vesselName}
                    </span>
                  )}
                </div>
                {getHealthBadge(batch.health)}
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  Day {batch.daysActive}
                </span>
                {batch.abv && (
                  <span className="text-xs text-gray-600">
                    ABV: {batch.abv}%
                  </span>
                )}
              </div>

              {batch.specificGravity && (
                <SGProgressBar
                  sg={parseFloat(batch.specificGravity)}
                  compact={compact}
                />
              )}
            </Link>
          ))}
        </div>

        {/* View all link */}
        {batches.length > (compact ? 3 : 5) && (
          <div className="text-center pt-1">
            <Link
              href="/cellar"
              className={cn(
                "text-blue-600 hover:text-blue-800 font-medium",
                compact ? "text-xs" : "text-sm"
              )}
            >
              View all {batches.length} batches →
            </Link>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.FERMENTATION_HEALTH,
  title: "Fermentation Health",
  description: "Monitor fermentation progress and identify issues",
  icon: Activity,
  category: "production",
  component: FermentationHealthWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md", "lg"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000, // 5 minutes
};

registerWidget(config);
