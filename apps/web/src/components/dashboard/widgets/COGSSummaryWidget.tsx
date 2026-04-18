"use client";

import Link from "next/link";
import { DollarSign, Package, Droplets } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * COGS Summary Widget
 * Shows year-to-date cost of goods sold breakdown
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

  const totals = data?.totals;
  const totalCogs = totals?.totalCogs || 0;
  const totalUnits = totals?.totalUnits || 0;
  const avgCostPerUnit = totals?.avgCostPerUnit || 0;
  const runCount = data?.runs?.length || 0;

  const costBreakdown = [
    { label: "Fruit", value: totals?.totalFruitCost || 0, color: "bg-green-500" },
    { label: "Additives", value: totals?.totalAdditiveCost || 0, color: "bg-purple-500" },
    { label: "Packaging", value: totals?.totalPackagingCost || 0, color: "bg-blue-500" },
    { label: "Labor", value: totals?.totalLaborCost || 0, color: "bg-amber-500" },
    { label: "Overhead", value: totals?.totalOverheadCost || 0, color: "bg-gray-400" },
  ];

  return (
    <WidgetWrapper
      title={`COGS ${currentYear}`}
      icon={DollarSign}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={runCount === 0}
      emptyState={
        <div className="text-center py-4">
          <DollarSign className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No packaging runs this year</p>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Summary stats */}
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-3")}>
          <div className="p-2 bg-red-50 rounded-lg text-center">
            <p className={cn("font-bold text-red-900", compact ? "text-sm" : "text-lg")}>{fmt(totalCogs)}</p>
            <p className="text-[10px] text-red-600">Total COGS</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-center">
            <p className={cn("font-bold text-blue-900", compact ? "text-sm" : "text-lg")}>{fmt(avgCostPerUnit)}</p>
            <p className="text-[10px] text-blue-600">Per Bottle</p>
          </div>
          {!compact && (
            <div className="p-2 bg-green-50 rounded-lg text-center">
              <p className={cn("font-bold text-green-900 text-lg")}>{totalUnits.toLocaleString()}</p>
              <p className="text-[10px] text-green-600">Units ({runCount} runs)</p>
            </div>
          )}
        </div>

        {/* Cost breakdown bar */}
        {totalCogs > 0 && (
          <div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
              {costBreakdown.map((item) => {
                const pct = totalCogs > 0 ? (item.value / totalCogs) * 100 : 0;
                if (pct < 0.5) return null;
                return (
                  <div
                    key={item.label}
                    className={cn(item.color, "h-full")}
                    style={{ width: `${pct}%` }}
                    title={`${item.label}: ${fmt(item.value)} (${pct.toFixed(0)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              {costBreakdown.map((item) => (
                <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={cn("w-2 h-2 rounded-full", item.color)} />
                  {item.label}: {fmt(item.value)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Link to full report */}
        <div className="text-center pt-1">
          <Link
            href="/reports/cogs"
            className={cn(
              "text-blue-600 hover:text-blue-800 font-medium",
              compact ? "text-xs" : "text-sm"
            )}
          >
            View Full COGS Report →
          </Link>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.COGS_SUMMARY,
  title: "COGS Summary",
  description: "Year-to-date cost of goods sold breakdown",
  icon: DollarSign,
  category: "inventory",
  component: COGSSummaryWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 600000, // 10 minutes
};

registerWidget(config);
