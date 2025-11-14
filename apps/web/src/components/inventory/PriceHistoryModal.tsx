"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";

interface PriceHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialType: "basefruit" | "additives" | "juice" | "packaging";
  varietyId: string;
  varietyName: string;
}

export function PriceHistoryModal({
  open,
  onOpenChange,
  materialType,
  varietyId,
  varietyName,
}: PriceHistoryModalProps) {
  const { data, isLoading, error } = trpc.purchase.priceHistory.useQuery(
    {
      materialType,
      varietyId,
    },
    {
      enabled: open && !!varietyId,
    }
  );

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getPriceChangeIndicator = (change: number | null) => {
    if (change === null) return null;

    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-semibold">+{change.toFixed(1)}%</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-semibold">{change.toFixed(1)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-gray-600">
          <Minus className="w-4 h-4" />
          <span className="text-sm font-semibold">No change</span>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Price History: {varietyName}
          </DialogTitle>
          <DialogDescription>
            Historical pricing data and statistics
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>Error loading price history: {error.message}</span>
          </div>
        ) : data && data.history.length > 0 ? (
          <div className="space-y-6">
            {/* Price Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">
                    Current Price
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(data.statistics.currentPrice)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    per {data.history[0]?.unit}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">
                    Average Price
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(data.statistics.avgPrice)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    across all purchases
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">
                    Price Range
                  </div>
                  <div className="text-lg font-bold">
                    {formatCurrency(data.statistics.minPrice)} -{" "}
                    {formatCurrency(data.statistics.maxPrice)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    min - max
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">
                    Recent Change
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {getPriceChangeIndicator(data.statistics.priceChange)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    vs. previous purchase
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Purchase History Table */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-semibold text-sm">Date</th>
                        <th className="pb-3 font-semibold text-sm">Vendor</th>
                        <th className="pb-3 font-semibold text-sm text-right">
                          Quantity
                        </th>
                        <th className="pb-3 font-semibold text-sm text-right">
                          Price/Unit
                        </th>
                        <th className="pb-3 font-semibold text-sm text-right">
                          Total Cost
                        </th>
                        <th className="pb-3 font-semibold text-sm text-center">
                          vs. Avg
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((item, idx) => {
                        const priceDiff =
                          data.statistics.avgPrice && item.pricePerUnit
                            ? ((item.pricePerUnit - data.statistics.avgPrice) /
                                data.statistics.avgPrice) *
                              100
                            : null;

                        return (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            <td className="py-3 text-sm">
                              {formatDate(new Date(item.purchaseDate))}
                            </td>
                            <td className="py-3 text-sm">
                              {item.vendorName || "Unknown"}
                            </td>
                            <td className="py-3 text-sm text-right font-mono">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-3 text-sm text-right font-mono">
                              {formatCurrency(item.pricePerUnit)}
                            </td>
                            <td className="py-3 text-sm text-right font-mono">
                              {formatCurrency(item.totalCost)}
                            </td>
                            <td className="py-3 text-sm text-center">
                              {priceDiff !== null ? (
                                <Badge
                                  variant={
                                    priceDiff > 10
                                      ? "destructive"
                                      : priceDiff < -10
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {priceDiff > 0 ? "+" : ""}
                                  {priceDiff.toFixed(1)}%
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {data.history.length > 10 && (
                  <div className="mt-4 text-sm text-muted-foreground text-center">
                    Showing {data.history.length} purchases
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price Insights */}
            {data.statistics.priceChange !== null &&
              Math.abs(data.statistics.priceChange) > 15 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-orange-900">
                          Significant Price Change Detected
                        </div>
                        <div className="text-sm text-orange-800 mt-1">
                          The price has{" "}
                          {data.statistics.priceChange > 0
                            ? "increased"
                            : "decreased"}{" "}
                          by {Math.abs(data.statistics.priceChange).toFixed(1)}%
                          since your last purchase. Consider reviewing your
                          supplier or negotiating better rates.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No purchase history available for this item</p>
            <p className="text-sm mt-1">
              Add purchases to start tracking price history
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
