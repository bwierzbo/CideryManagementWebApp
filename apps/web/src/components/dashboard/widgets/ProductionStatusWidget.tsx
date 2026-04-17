"use client";

import { Beaker, Package, TrendingUp, Clock, Beer } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

/**
 * Production Status Widget
 * Shows active production by stage with volumes
 */
export function ProductionStatusWidget({ compact, onRefresh }: WidgetProps) {
  const { data, isPending, isFetching, error, refetch } = trpc.dashboard.getStats.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const fermenting = data?.fermenting || { count: 0, volumeL: 0 };
  const aging = data?.aging || { count: 0, volumeL: 0 };
  const bottlesReady = data?.bottlesReady || { count: 0, volumeL: 0 };
  const kegsReady = data?.kegsReady || { count: 0, volumeL: 0 };

  const totalReadyL = bottlesReady.volumeL + kegsReady.volumeL;

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
    >
      <div className="space-y-2">
        {/* Fermenting */}
        <div className={cn("flex items-center justify-between p-2.5 bg-purple-50 rounded-lg", compact && "p-2")}>
          <div className="flex items-center gap-2.5">
            <Beaker className={cn("text-purple-600 shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
            <span className={cn("font-medium text-purple-900", compact ? "text-xs" : "text-sm")}>Fermenting</span>
          </div>
          <div className="text-right">
            <span className={cn("font-bold text-purple-900", compact ? "text-sm" : "text-sm")}>
              {fermenting.count} batches
            </span>
            <span className="text-purple-600 mx-1.5">|</span>
            <span className={cn("font-bold text-purple-900", compact ? "text-sm" : "text-sm")}>
              {fermenting.volumeL.toFixed(0)} L
            </span>
          </div>
        </div>

        {/* Aging */}
        <div className={cn("flex items-center justify-between p-2.5 bg-amber-50 rounded-lg", compact && "p-2")}>
          <div className="flex items-center gap-2.5">
            <Clock className={cn("text-amber-600 shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
            <span className={cn("font-medium text-amber-900", compact ? "text-xs" : "text-sm")}>Aging</span>
          </div>
          <div className="text-right">
            <span className={cn("font-bold text-amber-900", compact ? "text-sm" : "text-sm")}>
              {aging.count} batches
            </span>
            <span className="text-amber-600 mx-1.5">|</span>
            <span className={cn("font-bold text-amber-900", compact ? "text-sm" : "text-sm")}>
              {aging.volumeL.toFixed(0)} L
            </span>
          </div>
        </div>

        {/* Ready for Distribution */}
        <div className={cn("flex items-center justify-between p-2.5 bg-green-50 rounded-lg", compact && "p-2")}>
          <div className="flex items-center gap-2.5">
            <Package className={cn("text-green-600 shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
            <span className={cn("font-medium text-green-900", compact ? "text-xs" : "text-sm")}>Ready</span>
          </div>
          <div className="text-right">
            <span className={cn("font-bold text-green-900", compact ? "text-sm" : "text-sm")}>
              {totalReadyL > 0 ? `${totalReadyL.toFixed(0)} L` : "—"}
            </span>
          </div>
        </div>

        {/* Ready breakdown */}
        {(bottlesReady.count > 0 || kegsReady.count > 0) && (
          <div className="flex justify-end gap-3 px-2">
            {bottlesReady.count > 0 && (
              <span className="text-xs text-green-700">
                {bottlesReady.count.toLocaleString()} bottles ({bottlesReady.volumeL.toFixed(0)}L)
              </span>
            )}
            {kegsReady.count > 0 && (
              <span className="text-xs text-green-700">
                {kegsReady.count} kegs ({kegsReady.volumeL.toFixed(0)}L)
              </span>
            )}
          </div>
        )}

        {/* Total */}
        <div className="text-center pt-1 border-t">
          <p className="text-xs text-muted-foreground">
            Total in cellar: <span className="font-medium">{(fermenting.volumeL + aging.volumeL).toFixed(0)}L</span>
            {" "}· {fermenting.count + aging.count} batches
          </p>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.PRODUCTION_STATUS,
  title: "Production Status",
  description: "Active production by stage with volumes",
  icon: TrendingUp,
  category: "production",
  component: ProductionStatusWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 60000,
};

registerWidget(config);
