"use client";

import Link from "next/link";
import { Package, Wine, Droplets, Beer } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

/**
 * Finished Goods Widget
 * Shows packaged inventory (bottles + kegs) and cellar volume
 */
export function FinishedGoodsWidget({ compact, onRefresh }: WidgetProps) {
  const { data: liquidData, isPending, isFetching, error, refetch } = trpc.vessel.liquidMap.useQuery();

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const pkg = liquidData?.packagedInventory;
  const cellarLiquid = Number(liquidData?.cellarLiquidL) || 0;

  const bottlesInStock = pkg?.totalBottles || 0;
  const bottlesProduced = pkg?.totalBottlesProduced || 0;
  const bottlesDistributed = pkg?.bottlesDistributed || 0;
  const kegsFilled = pkg?.kegsFilled || 0;
  const kegsDistributed = pkg?.kegsDistributed || 0;
  const packagedVolumeL = pkg?.totalVolumeL || 0;

  return (
    <WidgetWrapper
      title="Production Summary"
      icon={Package}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={false}
    >
      <div className="space-y-3">
        {/* Three stat boxes */}
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-3")}>
          {/* In Cellar */}
          <div className={cn("bg-blue-50 rounded-lg", compact ? "p-2" : "p-3")}>
            <div className="flex items-center gap-1.5 mb-1">
              <Wine className={cn("text-blue-600", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
              <span className={cn("text-blue-700 font-medium", compact ? "text-xs" : "text-xs")}>
                In Cellar
              </span>
            </div>
            <p className={cn("font-bold text-blue-900", compact ? "text-lg" : "text-xl")}>
              {(cellarLiquid / 1000).toFixed(1)}
              <span className="text-xs font-normal ml-0.5">kL</span>
            </p>
            <p className="text-xs text-blue-600">{cellarLiquid.toFixed(0)}L fermenting/aging</p>
          </div>

          {/* Bottles */}
          <div className={cn("bg-green-50 rounded-lg", compact ? "p-2" : "p-3")}>
            <div className="flex items-center gap-1.5 mb-1">
              <Package className={cn("text-green-600", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
              <span className={cn("text-green-700 font-medium", compact ? "text-xs" : "text-xs")}>
                Bottles
              </span>
            </div>
            <p className={cn("font-bold text-green-900", compact ? "text-lg" : "text-xl")}>
              {bottlesInStock}
              <span className="text-xs font-normal ml-0.5">in stock</span>
            </p>
            <p className="text-xs text-green-600">
              {bottlesProduced.toLocaleString()} produced · {bottlesDistributed.toLocaleString()} distributed
            </p>
          </div>

          {/* Kegs */}
          {!compact && (
            <div className={cn("bg-amber-50 rounded-lg p-3")}>
              <div className="flex items-center gap-1.5 mb-1">
                <Beer className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Kegs</span>
              </div>
              <p className="text-xl font-bold text-amber-900">
                {kegsFilled}
                <span className="text-xs font-normal ml-0.5">filled</span>
              </p>
              <p className="text-xs text-amber-600">
                {kegsDistributed} distributed
              </p>
            </div>
          )}
        </div>

        {/* Volume bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Total liquid tracked</span>
            <span className="text-xs font-medium">{((cellarLiquid + packagedVolumeL) / 1000).toFixed(1)} kL</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="flex h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500"
                style={{
                  width: (cellarLiquid + packagedVolumeL) > 0
                    ? `${(cellarLiquid / (cellarLiquid + packagedVolumeL)) * 100}%`
                    : "0%",
                }}
              />
              <div
                className="bg-green-500"
                style={{
                  width: (cellarLiquid + packagedVolumeL) > 0
                    ? `${(packagedVolumeL / (cellarLiquid + packagedVolumeL)) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-blue-600">Cellar</span>
            <span className="text-[10px] text-green-600">Packaged</span>
          </div>
        </div>

        <div className="text-center">
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
  title: "Production Summary",
  description: "Cellar volume, packaged inventory, and distribution status",
  icon: Package,
  category: "inventory",
  component: FinishedGoodsWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000,
};

registerWidget(config);
