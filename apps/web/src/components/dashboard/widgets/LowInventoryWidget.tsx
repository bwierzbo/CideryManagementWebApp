"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Package, Beaker, ShoppingCart } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Low Inventory Alerts Widget
 * Shows packaging materials, additives, and other supplies running low
 */
export function LowInventoryWidget({ compact, onRefresh }: WidgetProps) {
  const [showAll, setShowAll] = useState(false);

  // Get packaging inventory
  const { data: packagingData, isPending: pkgPending } = trpc.packagingPurchases.listInventory.useQuery({
    limit: 200,
  });

  // Get additive inventory
  const { data: additiveData, isPending: addPending } = trpc.additivePurchases.listInventory.useQuery({});

  const isPending = pkgPending || addPending;

  // Find low stock items
  const lowStockItems: Array<{
    name: string;
    type: "packaging" | "additive";
    quantity: number;
    unit: string;
    severity: "critical" | "low";
  }> = [];

  // Check packaging items
  if (packagingData?.items) {
    for (const item of packagingData.items) {
      if (item.quantity <= 0) {
        lowStockItems.push({
          name: item.varietyName || item.size || "Unknown",
          type: "packaging",
          quantity: item.quantity,
          unit: "units",
          severity: "critical",
        });
      } else if (item.quantity < 50) {
        lowStockItems.push({
          name: item.varietyName || item.size || "Unknown",
          type: "packaging",
          quantity: item.quantity,
          unit: "units",
          severity: "low",
        });
      }
    }
  }

  // Check additive items
  if (additiveData?.items) {
    for (const item of additiveData.items) {
      const qty = parseFloat(String(item.quantity || 0));
      if (qty <= 0) {
        lowStockItems.push({
          name: item.varietyName || item.productName || "Unknown",
          type: "additive",
          quantity: qty,
          unit: item.unit || "units",
          severity: "critical",
        });
      } else if (qty < 1) {
        lowStockItems.push({
          name: item.varietyName || item.productName || "Unknown",
          type: "additive",
          quantity: qty,
          unit: item.unit || "units",
          severity: "low",
        });
      }
    }
  }

  // Sort: critical first, then by name
  lowStockItems.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const criticalCount = lowStockItems.filter(i => i.severity === "critical").length;
  const displayItems = showAll ? lowStockItems : lowStockItems.slice(0, compact ? 3 : 5);

  return (
    <WidgetWrapper
      title="Inventory Alerts"
      icon={ShoppingCart}
      compact={compact}
      isLoading={isPending}
      error={null}
      isEmpty={lowStockItems.length === 0}
      emptyState={
        <div className="text-center py-4">
          <ShoppingCart className="w-8 h-8 mx-auto text-green-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium">Stock levels OK</p>
          <p className="text-xs text-gray-500">No items running low</p>
        </div>
      }
      headerActions={
        criticalCount > 0 ? (
          <Badge variant="destructive" className="text-xs">
            {criticalCount} out of stock
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-1">
        {displayItems.map((item, idx) => (
          <div
            key={`${item.type}-${item.name}-${idx}`}
            className={cn(
              "flex items-center justify-between rounded-lg",
              compact ? "p-1.5" : "p-2",
              item.severity === "critical" ? "bg-red-50" : "bg-amber-50"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn(
                "shrink-0 rounded p-1",
                item.severity === "critical" ? "bg-red-100" : "bg-amber-100"
              )}>
                {item.type === "packaging"
                  ? <Package className={cn("w-3 h-3", item.severity === "critical" ? "text-red-600" : "text-amber-600")} />
                  : <Beaker className={cn("w-3 h-3", item.severity === "critical" ? "text-red-600" : "text-amber-600")} />
                }
              </div>
              <div className="min-w-0">
                <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className={cn(
                "font-bold",
                compact ? "text-xs" : "text-sm",
                item.severity === "critical" ? "text-red-700" : "text-amber-700"
              )}>
                {item.quantity <= 0 ? "Out" : item.quantity.toFixed(item.type === "additive" ? 2 : 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">{item.unit}</p>
            </div>
          </div>
        ))}

        {lowStockItems.length > (compact ? 3 : 5) && (
          <div className="text-center pt-1">
            <button
              onClick={() => setShowAll(!showAll)}
              className={cn(
                "text-blue-600 hover:text-blue-800 font-medium",
                compact ? "text-xs" : "text-sm"
              )}
            >
              {showAll ? "Show less ↑" : `View all ${lowStockItems.length} items →`}
            </button>
          </div>
        )}

        <div className="text-center pt-1">
          <Link
            href="/inventory"
            className={cn(
              "text-blue-600 hover:text-blue-800 font-medium",
              compact ? "text-xs" : "text-sm"
            )}
          >
            View Inventory →
          </Link>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: "LOW_INVENTORY" as any,
  title: "Inventory Alerts",
  description: "Materials and supplies running low",
  icon: ShoppingCart,
  category: "inventory",
  component: LowInventoryWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md"],
  supportsRefresh: true,
  defaultRefreshInterval: 600000, // 10 minutes
};

registerWidget(config);
