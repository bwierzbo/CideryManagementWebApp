"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, DollarSign, Percent, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarginData {
  retailPrice: number;
  costPerBottle: number;
  grossMargin: number;
  grossMarginPercent: number;
  markup: number;
  markupPercent: number;
}

interface InventoryData {
  totalUnitsProduced?: number;
  currentRemaining?: number;
  unitsDepleted?: number;
  inventoryValueRemaining?: number;
  revenueIfSold?: number;
  potentialProfit?: number;
}

interface MarginAnalysisCardProps {
  margins: MarginData | null;
  inventory: InventoryData;
  className?: string;
}

export function MarginAnalysisCard({
  margins,
  inventory,
  className,
}: MarginAnalysisCardProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get margin color based on percentage
  const getMarginColor = (percent: number) => {
    if (percent >= 50) return "text-green-600";
    if (percent >= 30) return "text-yellow-600";
    return "text-red-600";
  };

  // Get margin status
  const getMarginStatus = (percent: number) => {
    if (percent >= 50) return { text: "Excellent", color: "bg-green-100 text-green-800" };
    if (percent >= 30) return { text: "Good", color: "bg-yellow-100 text-yellow-800" };
    return { text: "Low", color: "bg-red-100 text-red-800" };
  };

  // If no pricing is set
  if (!margins) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Margin Analysis
          </CardTitle>
          <CardDescription>
            Profitability metrics and inventory value
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-600 mb-2">
              No retail price set for this product
            </p>
            <p className="text-sm text-gray-500">
              Set a retail price in inventory to see margin analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const marginStatus = getMarginStatus(margins.grossMarginPercent);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Margin Analysis
        </CardTitle>
        <CardDescription>
          Profitability metrics and inventory value
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Pricing Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-900">Retail Price</p>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(margins.retailPrice)}
              </p>
              <p className="text-xs text-blue-700 mt-1">Per bottle</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700">Cost per Bottle</p>
                <Target className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(margins.costPerBottle)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Production cost</p>
            </div>
          </div>

          {/* Margin Metrics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Gross Margin
              </h4>
              <span className={cn("text-xs px-2 py-1 rounded-full", marginStatus.color)}>
                {marginStatus.text}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Margin Amount</p>
                  <DollarSign className="w-4 h-4 text-gray-400" />
                </div>
                <p className={cn("text-2xl font-bold", getMarginColor(margins.grossMarginPercent))}>
                  {formatCurrency(margins.grossMargin)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Per bottle profit
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Margin Percentage</p>
                  <Percent className="w-4 h-4 text-gray-400" />
                </div>
                <p className={cn("text-2xl font-bold", getMarginColor(margins.grossMarginPercent))}>
                  {margins.grossMarginPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Gross profit margin
                </p>
              </div>
            </div>
          </div>

          {/* Markup Information */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Markup
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Amount</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(margins.markup)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Percentage</p>
                <p className="text-lg font-bold text-gray-900">
                  {margins.markupPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Inventory Value & Potential */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Inventory Value & Potential
            </h4>
            <div className="space-y-3">
              {/* Units Summary */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Inventory Status</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(inventory.currentRemaining ?? 0).toLocaleString()} in stock
                    {(inventory.unitsDepleted ?? 0) > 0 && ` (${(inventory.unitsDepleted ?? 0).toLocaleString()} depleted)`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {(inventory.totalUnitsProduced ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total produced</p>
                </div>
              </div>

              {/* Remaining Inventory Value */}
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Inventory Value (at Cost)
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    COGS of units in stock
                  </p>
                </div>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(inventory.inventoryValueRemaining ?? 0)}
                </p>
              </div>

              {/* Potential Revenue */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Potential Revenue
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    If all {(inventory.currentRemaining ?? 0).toLocaleString()} units sell at ${margins?.retailPrice?.toFixed(2) ?? '0.00'}
                  </p>
                </div>
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(inventory.revenueIfSold ?? 0)}
                </p>
              </div>

              {/* Potential Profit */}
              <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-purple-900">
                    Potential Gross Profit
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Revenue − COGS for stock
                  </p>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {formatCurrency(inventory.potentialProfit ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Helpful Metrics Explanation */}
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
            <p>
              <strong>Gross Margin:</strong> (Price - Cost) / Price × 100
            </p>
            <p>
              <strong>Markup:</strong> (Price - Cost) / Cost × 100
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
