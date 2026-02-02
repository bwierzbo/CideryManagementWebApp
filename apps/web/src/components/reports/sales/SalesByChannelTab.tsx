"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CHANNEL_COLORS = [
  "#10b981", // green - tasting room
  "#3b82f6", // blue - wholesale
  "#f59e0b", // amber - online
  "#8b5cf6", // purple - events
  "#6b7280", // gray - uncategorized
];

interface ChannelData {
  channelId: string;
  channelCode: string;
  channelName: string;
  revenue: number;
  units: number;
  volumeLiters: number;
  kegCount: number;
  percentOfTotal: number;
}

interface SalesByChannelTabProps {
  channelData?: {
    channels: ChannelData[];
    totals: {
      revenue: number;
      units: number;
      volumeLiters: number;
      kegCount: number;
    };
  };
  isLoading: boolean;
  formatVol?: (liters: number) => string;
  volumeUnit?: string;
}

export function SalesByChannelTab({
  channelData,
  isLoading,
  formatVol,
  volumeUnit = "L",
}: SalesByChannelTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Prepare data for bar chart
  const barData = channelData?.channels
    .filter((c) => c.revenue > 0)
    .map((c, i) => ({
      name: c.channelName,
      revenue: c.revenue,
      units: c.units,
      color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!channelData?.channels.length) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            No sales data for selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue by Channel Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Channel</CardTitle>
          <CardDescription>
            Comparison of revenue across all sales channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatCurrency} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Channel Table */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Details</CardTitle>
          <CardDescription>
            Complete breakdown of sales metrics by channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium">Channel</th>
                  <th className="text-right py-3 px-4 font-medium">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium">Units</th>
                  <th className="text-right py-3 px-4 font-medium">
                    Volume ({volumeUnit})
                  </th>
                  <th className="text-right py-3 px-4 font-medium">Kegs</th>
                  <th className="text-right py-3 px-4 font-medium">% Share</th>
                </tr>
              </thead>
              <tbody>
                {channelData.channels.map((channel, i) => (
                  <tr
                    key={channel.channelId || i}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                          }}
                        />
                        <span className="font-medium">{channel.channelName}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-green-600">
                      {formatCurrency(channel.revenue)}
                    </td>
                    <td className="text-right py-3 px-4">
                      {formatNumber(channel.units)}
                    </td>
                    <td className="text-right py-3 px-4">
                      {formatVol ? formatVol(channel.volumeLiters) : formatNumber(Math.round(channel.volumeLiters))}
                    </td>
                    <td className="text-right py-3 px-4">
                      {channel.kegCount > 0 ? formatNumber(channel.kegCount) : "-"}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.min(channel.percentOfTotal, 100)}%`,
                              backgroundColor:
                                CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-gray-500 w-12 text-right">
                          {channel.percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4 text-green-600">
                    {formatCurrency(channelData.totals.revenue)}
                  </td>
                  <td className="text-right py-3 px-4">
                    {formatNumber(channelData.totals.units)}
                  </td>
                  <td className="text-right py-3 px-4">
                    {formatVol ? formatVol(channelData.totals.volumeLiters) : formatNumber(Math.round(channelData.totals.volumeLiters))}
                  </td>
                  <td className="text-right py-3 px-4">
                    {channelData.totals.kegCount > 0
                      ? formatNumber(channelData.totals.kegCount)
                      : "-"}
                  </td>
                  <td className="text-right py-3 px-4">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
