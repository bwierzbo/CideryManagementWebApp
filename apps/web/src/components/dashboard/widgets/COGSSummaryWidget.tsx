"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * COGS Summary Widget
 * Shows cost summary and margins across products
 */
export function COGSSummaryWidget({ compact, onRefresh }: WidgetProps) {
  // Memoize dates to prevent infinite re-fetching
  const { startDateStr, endDateStr } = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDateStr: startDate.toISOString(),
      endDateStr: endDate.toISOString(),
    };
  }, []);

  const { data, isPending, error, refetch } = trpc.sales.getMargins.useQuery({
    startDate: startDateStr,
    endDate: endDateStr,
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const totals = data?.totals;
  const products = data?.products || [];
  const hasData = totals && (totals.revenue > 0 || totals.cogs > 0);

  // Sort products by revenue
  const topProducts = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, compact ? 3 : 5);

  // Find products with low margins
  const lowMarginProducts = products.filter((p) => p.marginPercent < 30 && p.revenue > 0);

  return (
    <WidgetWrapper
      title="COGS Summary"
      icon={DollarSign}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={!hasData}
      emptyMessage="No sales data for the last 30 days"
    >
      <div className="space-y-3">
        {/* Summary stats */}
        {totals && (
          <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-3")}>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-xs text-blue-600 mb-0.5">Revenue</div>
              <div className={cn("font-bold text-blue-900", compact ? "text-sm" : "text-lg")}>
                {formatCurrency(totals.revenue)}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <div className="text-xs text-orange-600 mb-0.5">COGS</div>
              <div className={cn("font-bold text-orange-900", compact ? "text-sm" : "text-lg")}>
                {formatCurrency(totals.cogs)}
              </div>
            </div>
            {!compact && (
              <div className="bg-green-50 rounded-lg p-2">
                <div className="text-xs text-green-600 mb-0.5">Gross Profit</div>
                <div className={cn("font-bold text-green-900", "text-lg")}>
                  {formatCurrency(totals.grossProfit)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Margin indicator */}
        {totals && totals.revenue > 0 && (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
            <span className="text-sm text-gray-600">Gross Margin</span>
            <div className="flex items-center gap-2">
              {totals.marginPercent >= 40 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : totals.marginPercent < 25 ? (
                <TrendingDown className="w-4 h-4 text-red-600" />
              ) : null}
              <span
                className={cn(
                  "font-bold text-lg",
                  totals.marginPercent >= 40
                    ? "text-green-600"
                    : totals.marginPercent < 25
                    ? "text-red-600"
                    : "text-yellow-600"
                )}
              >
                {formatPercent(totals.marginPercent)}
              </span>
            </div>
          </div>
        )}

        {/* Low margin warning */}
        {lowMarginProducts.length > 0 && (
          <div className="flex items-start gap-2 bg-yellow-50 rounded-lg p-2 text-xs">
            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-yellow-800">
              {lowMarginProducts.length} product{lowMarginProducts.length > 1 ? "s" : ""} with
              margin below 30%
            </div>
          </div>
        )}

        {/* Top products */}
        {topProducts.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500 font-medium">Top Products</div>
            {topProducts.map((product, idx) => (
              <div
                key={product.inventoryItemId || idx}
                className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className={cn("truncate", compact ? "text-xs" : "text-sm")}>
                    {product.productName || "Unknown"}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {product.units} units sold
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                    {formatCurrency(product.revenue)}
                  </div>
                  <div
                    className={cn(
                      "text-[10px]",
                      product.marginPercent >= 40
                        ? "text-green-600"
                        : product.marginPercent < 25
                        ? "text-red-600"
                        : "text-gray-500"
                    )}
                  >
                    {formatPercent(product.marginPercent)} margin
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View reports link */}
        <div className="text-center pt-1">
          <Link
            href="/reports"
            className={cn(
              "text-blue-600 hover:text-blue-800 font-medium",
              compact ? "text-xs" : "text-sm"
            )}
          >
            View Full Reports →
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
  description: "Cost of goods sold and margin analysis",
  icon: DollarSign,
  category: "reports",
  component: COGSSummaryWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md", "lg"],
  supportsRefresh: true,
  defaultRefreshInterval: 600000, // 10 minutes
};

registerWidget(config);
