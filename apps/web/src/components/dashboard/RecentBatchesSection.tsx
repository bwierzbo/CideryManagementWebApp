"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Beaker } from "lucide-react";
import { trpc } from "@/utils/trpc";

export function RecentBatchesSection() {
  const { data: batchData, isPending } = trpc.dashboard.getRecentBatches.useQuery();

  if (isPending) {
    return (
      <Card className="bg-white border-2 border-gray-100 h-full">
        <CardHeader className="pb-4">
          <CardTitle>Active Batches</CardTitle>
          <CardDescription>Loading batch data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const batches = batchData?.batches || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800";
      case "packaged":
        return "bg-green-100 text-green-800";
      case "planned":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="bg-white border-2 border-gray-100 h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Batches</CardTitle>
            <CardDescription>
              Monitor your current fermentation batches
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/cellar">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Beaker className="w-8 h-8 mx-auto mb-2" />
            <p>No active batches</p>
            <p className="text-sm">Start a press run to create new batches</p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                    <Beaker className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {batch.batchNumber}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {batch.customName || batch.vesselName || "No vessel"}
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}
                  >
                    {batch.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {batch.daysActive > 0
                      ? `${batch.daysActive} days active`
                      : "Just started"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {batch.abv ? `${batch.abv}%` : "—"}
                  </p>
                  <p className="text-xs text-gray-500">ABV</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
