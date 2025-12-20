"use client";

import Link from "next/link";
import { Package, Wine, Droplets, TrendingUp } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

/**
 * Finished Goods Widget
 * Shows packaged inventory by product type
 */
export function FinishedGoodsWidget({ compact, onRefresh }: WidgetProps) {
  // Get liquid map data which includes packaged inventory
  const { data: liquidData, isPending, error, refetch } = trpc.vessel.liquidMap.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const packagedVolume = Number(liquidData?.packagedInventory?.totalVolumeL) || 0;
  const totalBottles = Number(liquidData?.packagedInventory?.totalBottles) || 0;
  const cellarLiquid = Number(liquidData?.cellarLiquidL) || 0;
  const totalLiquid = Number(liquidData?.totalLiquidL) || 0;

  return (
    <WidgetWrapper
      title="Finished Goods"
      icon={Package}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={false}
    >
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2")}>
          <div className={cn("bg-green-50 rounded-lg", compact ? "p-2" : "p-3")}>
            <div className="flex items-center gap-2 mb-1">
              <Package className={cn("text-green-600", compact ? "w-4 h-4" : "w-5 h-5")} />
              <span className={cn("text-green-700 font-medium", compact ? "text-xs" : "text-sm")}>
                Bottled
              </span>
            </div>
            <p className={cn("font-bold text-green-900", compact ? "text-lg" : "text-2xl")}>
              {totalBottles.toLocaleString()}
            </p>
            <p className="text-xs text-green-600">
              {packagedVolume.toFixed(1)}L
            </p>
          </div>

          <div className={cn("bg-blue-50 rounded-lg", compact ? "p-2" : "p-3")}>
            <div className="flex items-center gap-2 mb-1">
              <Wine className={cn("text-blue-600", compact ? "w-4 h-4" : "w-5 h-5")} />
              <span className={cn("text-blue-700 font-medium", compact ? "text-xs" : "text-sm")}>
                In Cellar
              </span>
            </div>
            <p className={cn("font-bold text-blue-900", compact ? "text-lg" : "text-2xl")}>
              {cellarLiquid.toFixed(0)}L
            </p>
            <p className="text-xs text-blue-600">
              Fermenting/aging
            </p>
          </div>
        </div>

        {/* Total Volume Bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={cn("text-gray-600", compact ? "text-xs" : "text-sm")}>
              Total Liquid
            </span>
            <span className={cn("font-medium text-gray-900", compact ? "text-xs" : "text-sm")}>
              {totalLiquid.toFixed(1)}L
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="flex h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500"
                style={{
                  width: totalLiquid > 0 ? `${(cellarLiquid / totalLiquid) * 100}%` : "0%",
                }}
              />
              <div
                className="bg-green-500"
                style={{
                  width: totalLiquid > 0 ? `${(packagedVolume / totalLiquid) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-blue-600">Cellar</span>
            <span className="text-xs text-green-600">Packaged</span>
          </div>
        </div>

        {/* View All Link */}
        <div className="text-center pt-2">
          <Link
            href="/packaging"
            className={cn(
              "text-blue-600 hover:text-blue-800 font-medium",
              compact ? "text-xs" : "text-sm"
            )}
          >
            View Packaging →
          </Link>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.FINISHED_GOODS,
  title: "Finished Goods",
  description: "Packaged inventory and stock levels",
  icon: Package,
  category: "inventory",
  component: FinishedGoodsWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000, // 5 minutes
};

registerWidget(config);
