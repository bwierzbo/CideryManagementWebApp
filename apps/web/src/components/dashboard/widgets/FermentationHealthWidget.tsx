"use client";

import Link from "next/link";
import { Activity, TrendingDown, AlertCircle, CheckCircle, Beaker } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BatchHealth {
  id: string;
  batchNumber: string;
  customName: string | null;
  status: string;
  vesselName: string | null;
  daysActive: number;
  abv: string | null;
  specificGravity: string | null;
  percentFermented: number;
  fermentationStage: string;
  isStalled: boolean;
}

function getStageLabel(stage: string): string {
  switch (stage) {
    case "early": return "Early";
    case "mid": return "Mid";
    case "approaching_dry": return "Near Dry";
    case "terminal": return "Terminal";
    default: return "Unknown";
  }
}

function getStageBadge(stage: string, isStalled: boolean) {
  if (isStalled) {
    return <Badge className="bg-red-100 text-red-800 text-xs">Stalled</Badge>;
  }

  switch (stage) {
    case "early":
      return <Badge className="bg-blue-100 text-blue-800 text-xs">Early</Badge>;
    case "mid":
      return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Mid</Badge>;
    case "approaching_dry":
      return <Badge className="bg-orange-100 text-orange-800 text-xs">Near Dry</Badge>;
    case "terminal":
      return <Badge className="bg-green-100 text-green-800 text-xs">Terminal</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800 text-xs">Unknown</Badge>;
  }
}

function FermentationProgressBar({
  percentFermented,
  stage,
  isStalled,
  sg,
  compact
}: {
  percentFermented: number;
  stage: string;
  isStalled: boolean;
  sg: number | null;
  compact?: boolean;
}) {
  // Determine color based on stage and stall status
  let progressColor = "bg-blue-500";
  if (isStalled) {
    progressColor = "bg-red-500";
  } else if (stage === "terminal") {
    progressColor = "bg-green-500";
  } else if (stage === "approaching_dry") {
    progressColor = "bg-orange-500";
  } else if (stage === "mid") {
    progressColor = "bg-yellow-500";
  }

  return (
    <div className="w-full">
      <div className={cn("flex justify-between mb-1", compact ? "text-[10px]" : "text-xs")}>
        <span className="text-gray-500">
          {sg ? `SG: ${sg.toFixed(3)}` : "No SG data"}
        </span>
        <span className="text-gray-400">{percentFermented.toFixed(0)}% fermented</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={cn(progressColor, "h-1.5 rounded-full transition-all")}
          style={{ width: `${Math.min(100, percentFermented)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Fermentation Health Widget
 * Shows fermentation progress using SG-based stage tracking
 * and identifies stalled fermentations
 */
export function FermentationHealthWidget({ compact, onRefresh }: WidgetProps) {
  // Use both getRecentBatches and getTasks for combined data
  const { data: batchData, isPending: batchPending, error: batchError, refetch: refetchBatches } = trpc.dashboard.getRecentBatches.useQuery();
  const { data: tasksData, refetch: refetchTasks } = trpc.dashboard.getTasks.useQuery({ limit: 50 });

  const handleRefresh = () => {
    refetchBatches();
    refetchTasks();
    onRefresh?.();
  };

  // Create a map of batch IDs to task data for stage info
  const taskMap = new Map(
    (tasksData?.tasks || []).map(t => [t.id, t])
  );

  // Process batches with fermentation stage data
  const batches: BatchHealth[] = (batchData?.batches || [])
    .filter((b: any) => b.status === "fermentation" || b.status === "aging")
    .map((b: any) => {
      const sg = b.specificGravity ? parseFloat(b.specificGravity) : null;
      const taskData = taskMap.get(b.id);

      return {
        id: b.id,
        batchNumber: b.batchNumber,
        customName: b.customName,
        status: b.status,
        vesselName: b.vesselName,
        daysActive: b.daysActive,
        abv: b.abv,
        specificGravity: b.specificGravity,
        percentFermented: taskData?.percentFermented ?? 0,
        fermentationStage: taskData?.fermentationStage ?? "unknown",
        isStalled: taskData?.taskType === "stalled_fermentation",
      };
    });

  // Count by stage
  const stalledCount = batches.filter((b) => b.isStalled).length;
  const earlyCount = batches.filter((b) => b.fermentationStage === "early" && !b.isStalled).length;
  const midCount = batches.filter((b) => b.fermentationStage === "mid" && !b.isStalled).length;
  const nearDryCount = batches.filter((b) => b.fermentationStage === "approaching_dry" && !b.isStalled).length;
  const terminalCount = batches.filter((b) => b.fermentationStage === "terminal" && !b.isStalled).length;

  return (
    <WidgetWrapper
      title="Fermentation Health"
      icon={Activity}
      compact={compact}
      isLoading={batchPending}
      error={batchError as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={batches.length === 0}
      emptyMessage="No active fermentations"
    >
      <div className="space-y-3">
        {/* Stage summary */}
        <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
          {stalledCount > 0 && (
            <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs">
              <AlertCircle className="w-3 h-3" />
              {stalledCount} stalled
            </div>
          )}
          {earlyCount > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
              <Activity className="w-3 h-3" />
              {earlyCount} early
            </div>
          )}
          {midCount > 0 && (
            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full text-xs">
              <TrendingDown className="w-3 h-3" />
              {midCount} mid
            </div>
          )}
          {nearDryCount > 0 && (
            <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full text-xs">
              <Beaker className="w-3 h-3" />
              {nearDryCount} near dry
            </div>
          )}
          {terminalCount > 0 && (
            <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
              <CheckCircle className="w-3 h-3" />
              {terminalCount} terminal
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
                    {batch.customName || batch.batchNumber}
                  </span>
                  {batch.vesselName && (
                    <span className="text-gray-400 text-xs ml-2">
                      {batch.vesselName}
                    </span>
                  )}
                </div>
                {getStageBadge(batch.fermentationStage, batch.isStalled)}
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  Day {batch.daysActive} • {getStageLabel(batch.fermentationStage)}
                </span>
                {batch.abv && (
                  <span className="text-xs text-gray-600">
                    ABV: {batch.abv}%
                  </span>
                )}
              </div>

              <FermentationProgressBar
                percentFermented={batch.percentFermented}
                stage={batch.fermentationStage}
                isStalled={batch.isStalled}
                sg={batch.specificGravity ? parseFloat(batch.specificGravity) : null}
                compact={compact}
              />
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
