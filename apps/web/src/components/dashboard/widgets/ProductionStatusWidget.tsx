"use client";

import { Beaker, Package, Wine, TrendingUp, Beer, Clock } from "lucide-react";
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

  const totalActiveL = fermenting.volumeL + aging.volumeL;
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
      <div className="space-y-3">
        {/* Fermenting */}
        <div className={cn("flex items-center gap-3 p-2 bg-purple-50 rounded-lg", compact && "p-1.5")}>
          <div className={cn("flex items-center justify-center rounded-lg bg-purple-100", compact ? "w-8 h-8" : "w-10 h-10")}>
            <Beaker className={cn("text-purple-600", compact ? "w-4 h-4" : "w-5 h-5")} />
          </div>
          <div className="flex-1">
            <p className={cn("font-bold text-purple-900", compact ? "text-lg" : "text-xl")}>
              {fermenting.count}
              <span className={cn("font-normal text-purple-600 ml-2", compact ? "text-xs" : "text-sm")}>
                {fermenting.volumeL.toFixed(0)}L
              </span>
            </p>
            <p className={cn("text-purple-700", compact ? "text-xs" : "text-sm")}>Fermenting</p>
          </div>
        </div>

        {/* Aging */}
        <div className={cn("flex items-center gap-3 p-2 bg-amber-50 rounded-lg", compact && "p-1.5")}>
          <div className={cn("flex items-center justify-center rounded-lg bg-amber-100", compact ? "w-8 h-8" : "w-10 h-10")}>
            <Clock className={cn("text-amber-600", compact ? "w-4 h-4" : "w-5 h-5")} />
          </div>
          <div className="flex-1">
            <p className={cn("font-bold text-amber-900", compact ? "text-lg" : "text-xl")}>
              {aging.count}
              <span className={cn("font-normal text-amber-600 ml-2", compact ? "text-xs" : "text-sm")}>
                {aging.volumeL.toFixed(0)}L
              </span>
            </p>
            <p className={cn("text-amber-700", compact ? "text-xs" : "text-sm")}>Aging</p>
          </div>
        </div>

        {/* Ready for Distribution */}
        <div className={cn("flex items-center gap-3 p-2 bg-green-50 rounded-lg", compact && "p-1.5")}>
          <div className={cn("flex items-center justify-center rounded-lg bg-green-100", compact ? "w-8 h-8" : "w-10 h-10")}>
            <Package className={cn("text-green-600", compact ? "w-4 h-4" : "w-5 h-5")} />
          </div>
          <div className="flex-1">
            <p className={cn("font-bold text-green-900", compact ? "text-lg" : "text-xl")}>
              {totalReadyL > 0 ? `${totalReadyL.toFixed(0)}L` : "—"}
            </p>
            <p className={cn("text-green-700", compact ? "text-xs" : "text-sm")}>
              Ready for distribution
              {(bottlesReady.count > 0 || kegsReady.count > 0) && (
                <span className="text-green-600">
                  {bottlesReady.count > 0 && ` · ${bottlesReady.count} bottles`}
                  {kegsReady.count > 0 && ` · ${kegsReady.count} kegs`}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Total in cellar */}
        {!compact && (
          <div className="text-center pt-1 border-t">
            <p className="text-xs text-muted-foreground">
              Total in cellar: <span className="font-medium">{totalActiveL.toFixed(0)}L</span>
              {" "}({fermenting.count + aging.count} batches)
            </p>
          </div>
        )}
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
