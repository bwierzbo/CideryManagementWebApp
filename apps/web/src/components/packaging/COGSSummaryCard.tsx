"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, TrendingUp, Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface COGSData {
  appleCosts: {
    totalCost: number;
    costByVariety: Array<{
      variety: string;
      cost: number;
      percentage: number;
    }>;
  };
  additiveCosts: {
    totalCost: number;
    note?: string;
    items?: Array<{
      name: string;
      type: string;
      amount: number;
      unit: string;
      costPerUnit: number;
      totalCost: number;
    }>;
  };
  packagingCosts: {
    totalCost: number;
    costByType: Array<{
      type: string;
      packageType?: string;
      size?: string;
      quantityUsed?: number;
      pricePerUnit?: number;
      cost: number;
    }>;
  };
  laborCost: number;
  overheadCost: number;
  totalCogs: number;
  costPerBottle: number;
  costPerLiter: number;
}

interface COGSSummaryCardProps {
  cogsData: COGSData;
  unitsProduced: number;
  className?: string;
}

export function COGSSummaryCard({
  cogsData,
  unitsProduced,
  className,
}: COGSSummaryCardProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate percentages for breakdown
  const total = cogsData.totalCogs;
  const getPercentage = (amount: number) => {
    if (total === 0) return 0;
    return (amount / total) * 100;
  };

  const breakdownItems = [
    {
      label: "Apple Costs",
      amount: cogsData.appleCosts.totalCost,
      percentage: getPercentage(cogsData.appleCosts.totalCost),
      icon: Package,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Additives",
      amount: cogsData.additiveCosts.totalCost,
      percentage: getPercentage(cogsData.additiveCosts.totalCost),
      icon: Package,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Packaging",
      amount: cogsData.packagingCosts.totalCost,
      percentage: getPercentage(cogsData.packagingCosts.totalCost),
      icon: Package,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Labor",
      amount: cogsData.laborCost,
      percentage: getPercentage(cogsData.laborCost),
      icon: Users,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Overhead",
      amount: cogsData.overheadCost,
      percentage: getPercentage(cogsData.overheadCost),
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Cost of Goods Sold (COGS)
        </CardTitle>
        <CardDescription>
          Complete cost breakdown for this production run
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Total COGS Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total COGS</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(cogsData.totalCogs)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {unitsProduced.toLocaleString()} units
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 mb-1">Cost per Bottle</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(cogsData.costPerBottle)}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Per unit pricing
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900 mb-1">Cost per Liter</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(cogsData.costPerLiter)}
              </p>
              <p className="text-xs text-green-700 mt-1">
                Volume-based cost
              </p>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Cost Breakdown
            </h4>
            <div className="space-y-3">
              {breakdownItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={cn("p-2 rounded-lg", item.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={cn(
                                "h-2 rounded-full",
                                item.color.includes("green")
                                  ? "bg-green-500"
                                  : item.color.includes("amber")
                                    ? "bg-amber-500"
                                    : item.color.includes("blue")
                                      ? "bg-blue-500"
                                      : item.color.includes("purple")
                                        ? "bg-purple-500"
                                        : "bg-orange-500"
                              )}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-12 text-right">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-gray-900">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Breakdown - Apple Costs */}
          {cogsData.appleCosts.costByVariety.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Apple Costs by Variety
              </h4>
              <div className="space-y-2">
                {cogsData.appleCosts.costByVariety.map((variety, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{variety.variety}</span>
                      <span className="text-gray-500 ml-2">
                        ({variety.percentage.toFixed(1)}% of batch)
                      </span>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(variety.cost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Breakdown - Additive Costs */}
          {cogsData.additiveCosts.items && cogsData.additiveCosts.items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Additive Costs
              </h4>
              <div className="space-y-2">
                {cogsData.additiveCosts.items.map((additive, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{additive.name}</span>
                      <span className="text-gray-500 ml-2">
                        ({additive.type})
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {additive.amount} {additive.unit} × {formatCurrency(additive.costPerUnit)}/{additive.unit.includes('/') ? 'unit' : additive.unit}
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(additive.totalCost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Breakdown - Packaging Costs */}
          {cogsData.packagingCosts.costByType.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Packaging Costs by Type
              </h4>
              <div className="space-y-2">
                {cogsData.packagingCosts.costByType.map((pkg, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{pkg.type}</span>
                      {pkg.packageType && (
                        <span className="text-gray-500 ml-2">
                          ({pkg.packageType} - {pkg.size})
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {pkg.quantityUsed && (
                        <div className="text-xs text-gray-500">
                          {pkg.quantityUsed} × {formatCurrency(pkg.pricePerUnit || 0)}
                        </div>
                      )}
                      <span className="font-semibold">
                        {formatCurrency(pkg.cost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note about additive costs if not tracked */}
          {cogsData.additiveCosts.note && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> {cogsData.additiveCosts.note}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
