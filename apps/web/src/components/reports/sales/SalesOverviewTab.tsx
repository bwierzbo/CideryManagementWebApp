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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format } from "date-fns";

const CHANNEL_COLORS = [
  "#10b981", // green - tasting room
  "#3b82f6", // blue - wholesale
  "#f59e0b", // amber - online
  "#8b5cf6", // purple - events
  "#6b7280", // gray - uncategorized
];

interface TrendData {
  date?: unknown;
  revenue: number;
  units: number;
}

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

interface SalesOverviewTabProps {
  trendsData?: {
    trends: TrendData[];
    groupBy: string;
  };
  channelData?: {
    channels: ChannelData[];
    totals: {
      revenue: number;
      units: number;
      volumeLiters: number;
      kegCount: number;
    };
  };
  isLoadingTrends: boolean;
  isLoadingChannels: boolean;
}

export function SalesOverviewTab({
  trendsData,
  channelData,
  isLoadingTrends,
  isLoadingChannels,
}: SalesOverviewTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format trend data for chart
  const chartData = trendsData?.trends.map((t) => ({
    date: format(new Date(t.date as string), "MMM d"),
    revenue: t.revenue,
    units: t.units,
  })) || [];

  // Filter out channels with no revenue for pie chart
  const pieData = channelData?.channels
    .filter((c) => c.revenue > 0)
    .map((c, i) => ({
      name: c.channelName,
      value: c.revenue,
      color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    })) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Daily revenue over selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrends ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No sales data for selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  labelStyle={{ color: "#374151" }}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Channel Breakdown Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Channel</CardTitle>
          <CardDescription>
            Distribution of sales across channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingChannels ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No sales data for selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={(props) => {
                    const { name, percent } = props as unknown as { name: string; percent: number };
                    return `${name} (${(percent * 100).toFixed(0)}%)`;
                  }}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Units Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Units Sold Trend</CardTitle>
          <CardDescription>Daily units sold over selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrends ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No sales data for selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} width={60} />
                <Tooltip
                  formatter={(value: number) => [value, "Units"]}
                  labelStyle={{ color: "#374151" }}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="units"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Channel Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Summary</CardTitle>
          <CardDescription>Key metrics by sales channel</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingChannels ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : !channelData?.channels.length ? (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No sales data for selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Channel</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                    <th className="text-right py-2 font-medium">Units</th>
                    <th className="text-right py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {channelData.channels.map((channel, i) => (
                    <tr key={channel.channelId || i} className="border-b">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                            }}
                          />
                          {channel.channelName}
                        </div>
                      </td>
                      <td className="text-right py-2 font-medium">
                        {formatCurrency(channel.revenue)}
                      </td>
                      <td className="text-right py-2">
                        {channel.units.toLocaleString()}
                      </td>
                      <td className="text-right py-2 text-gray-500">
                        {channel.percentOfTotal.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="py-2 font-bold">Total</td>
                    <td className="text-right py-2 font-bold">
                      {formatCurrency(channelData.totals.revenue)}
                    </td>
                    <td className="text-right py-2 font-bold">
                      {channelData.totals.units.toLocaleString()}
                    </td>
                    <td className="text-right py-2">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
