"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  Beaker,
  Wine,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { trpc } from "@/utils/trpc";

export function DashboardStats() {
  const { data: stats, isPending } = trpc.dashboard.getStats.useQuery();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white border-2 border-gray-100">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const dashboardStats = [
    {
      icon: Beaker,
      label: "Active Batches",
      value: stats?.activeBatches.count.toString() || "0",
      change: stats?.activeBatches.count === 0
        ? "No batches in progress"
        : stats?.activeBatches.count === 1
        ? "1 batch fermenting"
        : `${stats?.activeBatches.count} batches fermenting`,
      changeType: "neutral" as const,
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      icon: Package,
      label: "Bottles Ready",
      value: stats?.bottlesReady.count.toLocaleString() || "0",
      change: stats?.bottlesReady.count === 0
        ? "No inventory available"
        : "Available for sale",
      changeType: (stats?.bottlesReady.count ?? 0) > 0 ? "positive" as const : "neutral" as const,
      color: "bg-green-50 text-green-700 border-green-200",
    },
    {
      icon: Wine,
      label: "Packaged Batches",
      value: stats?.packagedBatches.count.toString() || "0",
      change: stats?.packagedBatches.count === 0
        ? "No completed batches"
        : `${stats?.packagedBatches.count} batch${stats?.packagedBatches.count === 1 ? '' : 'es'} completed`,
      changeType: (stats?.packagedBatches.count ?? 0) > 0 ? "positive" as const : "neutral" as const,
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      icon: Users,
      label: "Active Vendors",
      value: stats?.activeVendors.count.toString() || "0",
      change: stats?.activeVendors.count === 0
        ? "No active suppliers"
        : `${stats?.activeVendors.count} supplier${stats?.activeVendors.count === 1 ? '' : 's'} available`,
      changeType: (stats?.activeVendors.count ?? 0) > 0 ? "positive" as const : "neutral" as const,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {dashboardStats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card
            key={index}
            className="bg-white border-2 border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-md"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mb-2">
                    {stat.value}
                  </p>
                  <div className="flex items-center">
                    {stat.changeType === "positive" && (
                      <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                    )}
                    <p
                      className={`text-sm ${stat.changeType === "positive" ? "text-green-600" : "text-gray-500"}`}
                    >
                      {stat.change}
                    </p>
                  </div>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${stat.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
