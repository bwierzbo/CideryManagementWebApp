"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MarginProduct {
  inventoryItemId: string;
  productName: string;
  packageType: string | null;
  packageSizeML: number | null;
  batchName: string | null;
  revenue: number;
  units: number;
  cogs: number;
  cogsPerUnit: number;
  grossProfit: number;
  marginPercent: number;
}

interface MarginsTabProps {
  marginsData?: {
    products: MarginProduct[];
    totals: {
      revenue: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
    };
  };
  isLoading: boolean;
}

export function MarginsTab({ marginsData, isLoading }: MarginsTabProps) {
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

  // Prepare data for stacked bar chart (top 10 by revenue)
  const chartData = marginsData?.products.slice(0, 10).map((p) => ({
    name: p.productName.length > 15 ? p.productName.slice(0, 15) + "..." : p.productName,
    fullName: p.productName,
    revenue: p.revenue,
    cogs: p.cogs,
    grossProfit: p.grossProfit,
    marginPercent: p.marginPercent,
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!marginsData?.products.length) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            No margin data for selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(marginsData.totals.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-500">Total COGS</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(marginsData.totals.cogs)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-500">Gross Profit</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(marginsData.totals.grossProfit)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-500">Gross Margin</p>
            <p className="text-2xl font-bold">
              {marginsData.totals.marginPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs COGS Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs COGS by Product</CardTitle>
          <CardDescription>
            Top 10 products showing revenue breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatCurrency} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "cogs" ? "COGS" : name === "grossProfit" ? "Gross Profit" : name,
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullName;
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="cogs" stackId="a" fill="#ef4444" name="COGS" />
              <Bar
                dataKey="grossProfit"
                stackId="a"
                fill="#10b981"
                name="Gross Profit"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Margin Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Margin Analysis by Product</CardTitle>
          <CardDescription>
            Detailed COGS and margin breakdown for all products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium">Product</th>
                  <th className="text-right py-3 px-4 font-medium">Units</th>
                  <th className="text-right py-3 px-4 font-medium">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium">COGS</th>
                  <th className="text-right py-3 px-4 font-medium">COGS/Unit</th>
                  <th className="text-right py-3 px-4 font-medium">Gross Profit</th>
                  <th className="text-right py-3 px-4 font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {marginsData.products.map((product) => (
                  <tr
                    key={product.inventoryItemId}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium">{product.productName}</span>
                        {product.packageType && product.packageSizeML && (
                          <div className="mt-1">
                            <Badge variant="secondary" className="capitalize text-xs">
                              {product.packageType} {product.packageSizeML}ml
                            </Badge>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">
                      {formatNumber(product.units)}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-green-600">
                      {formatCurrency(product.revenue)}
                    </td>
                    <td className="text-right py-3 px-4 text-red-600">
                      {formatCurrency(product.cogs)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-500">
                      {formatCurrency(product.cogsPerUnit)}
                    </td>
                    <td className="text-right py-3 px-4 text-blue-600">
                      {formatCurrency(product.grossProfit)}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {product.marginPercent >= 40 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : product.marginPercent < 20 ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : null}
                        <span
                          className={
                            product.marginPercent >= 40
                              ? "text-green-600 font-medium"
                              : product.marginPercent < 20
                                ? "text-red-600"
                                : ""
                          }
                        >
                          {product.marginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">
                    {formatNumber(
                      marginsData.products.reduce((sum, p) => sum + p.units, 0)
                    )}
                  </td>
                  <td className="text-right py-3 px-4 text-green-600">
                    {formatCurrency(marginsData.totals.revenue)}
                  </td>
                  <td className="text-right py-3 px-4 text-red-600">
                    {formatCurrency(marginsData.totals.cogs)}
                  </td>
                  <td className="text-right py-3 px-4">-</td>
                  <td className="text-right py-3 px-4 text-blue-600">
                    {formatCurrency(marginsData.totals.grossProfit)}
                  </td>
                  <td className="text-right py-3 px-4">
                    {marginsData.totals.marginPercent.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
