"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * COGS Summary Widget
 * Shows recent packaging run costs — what it costs to produce per bottle
 */
export function COGSSummaryWidget({ compact, onRefresh }: WidgetProps) {
  const currentYear = new Date().getFullYear();
  const { data, isPending, isFetching, error, refetch } = trpc.pdfReports.cogsBreakdown.useQuery({
    dateFrom: new Date(`${currentYear}-01-01`),
    dateTo: new Date(`${currentYear}-12-31T23:59:59`),
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const runs = data?.runs || [];
  const recentRuns = runs.slice(0, compact ? 3 : 5);

  return (
    <WidgetWrapper
      title={`Cost per Bottle ${currentYear}`}
      icon={DollarSign}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={runs.length === 0}
      emptyState={
        <div className="text-center py-4">
          <DollarSign className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No packaging runs this year</p>
        </div>
      }
    >
      <div className="space-y-2">
        {/* Recent runs with cost per bottle */}
        {recentRuns.map((run: any) => (
          <Link
            key={run.id}
            href={`/packaging/${run.id}`}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
                {run.batchName}
              </p>
              <p className="text-xs text-muted-foreground">
                {run.unitsProduced} units · {run.volumeTakenL.toFixed(0)}L
              </p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className={cn("font-bold", compact ? "text-sm" : "text-base", run.costPerUnit > 5 ? "text-red-700" : run.costPerUnit > 3 ? "text-amber-700" : "text-green-700")}>
                {fmt(run.costPerUnit)}
              </p>
              <p className="text-[10px] text-muted-foreground">per bottle</p>
            </div>
          </Link>
        ))}

        {runs.length > recentRuns.length && (
          <p className="text-xs text-muted-foreground text-center">
            +{runs.length - recentRuns.length} more runs
          </p>
        )}

        {/* Average */}
        {runs.length > 0 && (
          <div className="pt-2 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Avg cost/bottle: <span className="font-bold text-gray-900">{fmt(data?.totals?.avgCostPerUnit || 0)}</span>
              {" "}across {runs.length} runs
            </p>
          </div>
        )}

        <div className="text-center">
          <Link
            href="/reports/cogs"
            className={cn(
              "text-blue-600 hover:text-blue-800 font-medium",
              compact ? "text-xs" : "text-sm"
            )}
          >
            Full COGS Report →
          </Link>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.COGS_SUMMARY,
  title: "Cost per Bottle",
  description: "Recent packaging run costs per bottle",
  icon: DollarSign,
  category: "inventory",
  component: COGSSummaryWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 600000,
};

registerWidget(config);
