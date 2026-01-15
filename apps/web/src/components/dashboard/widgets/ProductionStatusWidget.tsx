"use client";

import { Beaker, Package, Wine, TrendingUp } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

interface StatItemProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subtext?: string;
  color: string;
  compact?: boolean;
}

function StatItem({ icon: Icon, label, value, subtext, color, compact }: StatItemProps) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "py-1" : "py-2")}>
      <div className={cn(
        "flex items-center justify-center rounded-lg border-2",
        color,
        compact ? "w-8 h-8" : "w-10 h-10"
      )}>
        <Icon className={cn(compact ? "w-4 h-4" : "w-5 h-5")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-gray-600", compact ? "text-xs" : "text-sm")}>
          {label}
        </p>
        <p className={cn("font-bold text-gray-900", compact ? "text-lg" : "text-2xl")}>
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-gray-500">{subtext}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Production Status Widget
 * Shows batch counts by status (fermenting, conditioning, ready)
 */
export function ProductionStatusWidget({ compact, onRefresh }: WidgetProps) {
  const { data, isPending, isFetching, error, refetch } = trpc.dashboard.getStats.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  return (
    <WidgetWrapper
      title="Production Status"
      icon={TrendingUp}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={!data}
      emptyState={
        <div className="text-center py-4">
          <Beaker className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No production data</p>
        </div>
      }
    >
      <div className={cn("space-y-2", compact ? "divide-y" : "divide-y-0")}>
        <StatItem
          icon={Beaker}
          label="Active Batches"
          value={data?.activeBatches.count ?? 0}
          subtext={data?.activeBatches.count === 1 ? "In fermentation" : "In fermentation"}
          color="bg-blue-50 text-blue-600 border-blue-200"
          compact={compact}
        />
        <StatItem
          icon={Wine}
          label="Conditioning"
          value={data?.packagedBatches.count ?? 0}
          subtext="Ready to package"
          color="bg-purple-50 text-purple-600 border-purple-200"
          compact={compact}
        />
        <StatItem
          icon={Package}
          label="Bottles Ready"
          value={data?.bottlesReady.count?.toLocaleString() ?? 0}
          subtext="Available for sale"
          color="bg-green-50 text-green-600 border-green-200"
          compact={compact}
        />
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.PRODUCTION_STATUS,
  title: "Production Status",
  description: "Overview of batch counts by production stage",
  icon: TrendingUp,
  category: "production",
  component: ProductionStatusWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 60000, // 1 minute
};

registerWidget(config);
