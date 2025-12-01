"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Product {
  inventoryItemId: string;
  productName: string;
  packageType: string | null;
  packageSizeML: number | null;
  batchName: string | null;
  revenue: number;
  units: number;
  avgPrice: number;
}

interface ProductsTabProps {
  productsData?: {
    products: Product[];
  };
  isLoading: boolean;
}

export function ProductsTab({ productsData, isLoading }: ProductsTabProps) {
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

  // Prepare data for bar chart (top 10 by revenue)
  const chartData = productsData?.products.slice(0, 10).map((p) => ({
    name: p.productName.length > 20 ? p.productName.slice(0, 20) + "..." : p.productName,
    fullName: p.productName,
    revenue: p.revenue,
    units: p.units,
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!productsData?.products.length) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            No product sales data for selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Products Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Products by Revenue</CardTitle>
          <CardDescription>
            Best-selling products in the selected period
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
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "revenue" ? formatCurrency(value) : value,
                  name === "revenue" ? "Revenue" : "Units",
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
              <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Performance</CardTitle>
          <CardDescription>
            Complete breakdown of sales by product
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium">#</th>
                  <th className="text-left py-3 px-4 font-medium">Product</th>
                  <th className="text-left py-3 px-4 font-medium">Package</th>
                  <th className="text-right py-3 px-4 font-medium">Units</th>
                  <th className="text-right py-3 px-4 font-medium">Avg Price</th>
                  <th className="text-right py-3 px-4 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {productsData.products.map((product, i) => (
                  <tr
                    key={product.inventoryItemId}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium">{product.productName}</span>
                        {product.batchName && (
                          <div className="text-xs text-gray-500">
                            {product.batchName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {product.packageType && product.packageSizeML && (
                        <Badge variant="secondary" className="capitalize">
                          {product.packageType} {product.packageSizeML}ml
                        </Badge>
                      )}
                    </td>
                    <td className="text-right py-3 px-4">
                      {formatNumber(product.units)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-500">
                      {formatCurrency(product.avgPrice)}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-green-600">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="py-3 px-4" colSpan={3}>
                    Total
                  </td>
                  <td className="text-right py-3 px-4">
                    {formatNumber(
                      productsData.products.reduce((sum, p) => sum + p.units, 0)
                    )}
                  </td>
                  <td className="text-right py-3 px-4">-</td>
                  <td className="text-right py-3 px-4 text-green-600">
                    {formatCurrency(
                      productsData.products.reduce((sum, p) => sum + p.revenue, 0)
                    )}
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
