"use client";

import Link from "next/link";
import { Apple, Package, TrendingDown, AlertTriangle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Raw Materials Widget
 * Shows apple inventory levels and additives stock
 * Note: Currently placeholder until inventory system is fully implemented
 */
export function RawMaterialsWidget({ compact, onRefresh }: WidgetProps) {
  // Get vendors to show available suppliers
  const { data: vendorsData, isPending, error, refetch } = trpc.vendor.list.useQuery({
    limit: 100,
    sortBy: "name",
    sortOrder: "asc",
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const activeVendors = vendorsData?.vendors?.filter((v) => v.isActive) ?? [];

  return (
    <WidgetWrapper
      title="Raw Materials"
      icon={Apple}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={false}
    >
      <div className="space-y-4">
        {/* Apple Vendors Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className={cn("font-medium text-gray-700", compact ? "text-xs" : "text-sm")}>
              Apple Suppliers
            </h4>
            <Badge variant="secondary" className="text-xs">
              {activeVendors.length} active
            </Badge>
          </div>

          {activeVendors.length === 0 ? (
            <div className="text-center py-3 bg-gray-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
              <p className="text-xs text-gray-500">No active vendors</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activeVendors.slice(0, compact ? 3 : 5).map((vendor) => (
                <Link
                  key={vendor.id}
                  href={`/vendors/${vendor.id}`}
                  className={cn(
                    "flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors",
                    compact && "py-1"
                  )}
                >
                  <span className={cn("text-gray-700 truncate", compact ? "text-xs" : "text-sm")}>
                    {vendor.name}
                  </span>
                  <span className={cn("text-gray-400", compact ? "text-xs" : "text-xs")}>
                    {(vendor as any).contactInfo?.name || "—"}
                  </span>
                </Link>
              ))}
              {activeVendors.length > (compact ? 3 : 5) && (
                <Link
                  href="/vendors"
                  className="block text-center text-xs text-blue-600 hover:text-blue-800 py-1"
                >
                  +{activeVendors.length - (compact ? 3 : 5)} more vendors
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Note about inventory */}
        <div className={cn("bg-blue-50 rounded-lg border border-blue-100", compact ? "p-2" : "p-3")}>
          <div className="flex items-start gap-2">
            <Package className={cn("text-blue-500 shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
            <div>
              <p className={cn("text-blue-800 font-medium", compact ? "text-xs" : "text-sm")}>
                Inventory Tracking
              </p>
              <p className="text-xs text-blue-600">
                Apple and additive levels tracked in Purchase Orders
              </p>
            </div>
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.RAW_MATERIALS,
  title: "Raw Materials",
  description: "Apple inventory and supplier status",
  icon: Apple,
  category: "inventory",
  component: RawMaterialsWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000, // 5 minutes
};

registerWidget(config);
