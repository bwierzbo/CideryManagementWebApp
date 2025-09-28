"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Download,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Calendar,
  FileText,
} from "lucide-react";
import { trpc } from "@/utils/trpc";

// Helper function to download blob as file
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper function to convert base64 to blob
const base64ToBlob = (base64: string, contentType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

export default function ReportsPage() {
  const { data: session } = useSession();
  const [dateRange, setDateRange] = useState("30");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [reportType, setReportType] = useState<
    "summary" | "detailed" | "accounting"
  >("summary");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Get data using existing tRPC endpoints
  const { data: batches, isLoading: batchesLoading } =
    trpc.batch.list.useQuery();
  const { data: vendors, isLoading: vendorsLoading } =
    trpc.vendor.list.useQuery();
  const { data: purchases } = trpc.purchase.list.useQuery({});

  // Get vendors for PDF filtering
  const { data: reportVendors } = trpc.pdfReports.getVendors.useQuery();

  // PDF generation mutations
  const generateDateRangeReport =
    trpc.pdfReports.generateDateRangeReportPdf.useMutation({
      onSuccess: (result) => {
        if (result.success && result.data) {
          const blob = base64ToBlob(result.data, result.contentType);
          downloadBlob(blob, result.filename);
        }
        setIsGeneratingPdf(false);
      },
      onError: (error) => {
        console.error("Failed to generate PDF:", error);
        alert("Failed to generate PDF report. Please try again.");
        setIsGeneratingPdf(false);
      },
    });

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case "7":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90":
        startDate.setDate(endDate.getDate() - 90);
        break;
      case "365":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return { startDate, endDate };
  };

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    const { startDate, endDate } = getDateRange();

    generateDateRangeReport.mutate({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reportType,
      vendorId: selectedVendor !== "all" ? selectedVendor : undefined,
    });
  };

  // Calculate COGS data - simplified for demo
  const batchList = batches?.batches || [];
  const cogsData = batchList.map((batch) => {
    // Simplified cost calculation for demo
    const fruitCost = 150; // Base fruit cost
    const packagingCost = 50; // Base packaging cost
    const laborCost = 25; // Base labor cost
    const totalCost = fruitCost + packagingCost + laborCost;
    const costPerBottle = totalCost / 100; // Simplified bottles estimation

    return {
      batchName: batch.name,
      appleVariety: "Mixed Varieties", // Simplified for demo
      targetVolume: 50, // Demo value
      fruitCost,
      packagingCost,
      laborCost,
      totalCost,
      costPerBottle,
    };
  });

  // Calculate vendor performance - simplified for demo
  const vendorList = vendors?.vendors || [];
  const vendorPerformance = vendorList.map((vendor) => {
    // Simplified vendor metrics for demo
    return {
      name: vendor.name,
      totalOrders: Math.floor(Math.random() * 10) + 1,
      totalValue: Math.floor(Math.random() * 5000) + 1000,
      avgOrderValue: Math.floor(Math.random() * 1000) + 200,
      lastOrder: vendor.updatedAt || null,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="w-8 h-8 text-amber-600 mr-3" />
                Reports & Analytics
              </h1>
              <p className="text-gray-600 mt-2">
                Financial insights and operational reports
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex items-center"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
              >
                <Download className="w-4 h-4 mr-2" />
                {isGeneratingPdf ? "Generating..." : "Export PDF"}
              </Button>
              <Button variant="outline" className="flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="lg:w-48">
                <Label htmlFor="dateRange">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:w-48">
                <Label htmlFor="vendor">Vendor Filter</Label>
                <Select
                  value={selectedVendor}
                  onValueChange={setSelectedVendor}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    {reportVendors?.vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:w-48">
                <Label htmlFor="reportType">Report Type</Label>
                <Select
                  value={reportType}
                  onValueChange={(
                    value: "summary" | "detailed" | "accounting",
                  ) => setReportType(value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="accounting">Accounting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:w-64">
                <Label htmlFor="batch">Batch Filter</Label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {batchList.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs defaultValue="cogs" className="space-y-6">
          <TabsList className="grid w-full lg:w-96 grid-cols-3">
            <TabsTrigger value="cogs">COGS Analysis</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          {/* COGS Analysis Tab */}
          <TabsContent value="cogs">
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Total Production Cost
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          $
                          {cogsData
                            .reduce((sum, batch) => sum + batch.totalCost, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Avg Cost per Bottle
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          $
                          {(
                            cogsData.reduce(
                              (sum, batch) => sum + batch.costPerBottle,
                              0,
                            ) / (cogsData.length || 1)
                          ).toFixed(2)}
                        </p>
                      </div>
                      <Package className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Active Batches
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {batchList.length}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* COGS Breakdown Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost of Goods Sold Breakdown</CardTitle>
                  <CardDescription>
                    Detailed cost analysis by batch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {batchesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-500">Loading COGS data...</div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-900">
                              Batch
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Fruit Cost
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Packaging
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Labor
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Total Cost
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Cost/Bottle
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cogsData.map((batch, index) => (
                            <tr
                              key={index}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="py-3 px-4">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {batch.batchName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {batch.appleVariety}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                ${batch.fruitCost.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                ${batch.packagingCost.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                ${batch.laborCost.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                ${batch.totalCost.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                ${batch.costPerBottle.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Production Reports Tab */}
          <TabsContent value="production">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Production Efficiency</CardTitle>
                  <CardDescription>
                    Yield analysis and production metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {batchList.length}
                      </div>
                      <div className="text-sm text-gray-500">
                        Active Batches
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {batchList.length * 50}
                      </div>
                      <div className="text-sm text-gray-500">Total Gallons</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        85%
                      </div>
                      <div className="text-sm text-gray-500">Avg Yield</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">45</div>
                      <div className="text-sm text-gray-500">Avg Days</div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-center">
                    Detailed production analytics will be displayed here once
                    more data is available.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vendor Performance Tab */}
          <TabsContent value="vendors">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Performance Analysis</CardTitle>
                  <CardDescription>
                    Cost analysis and vendor reliability metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {vendorsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-500">
                        Loading vendor data...
                      </div>
                    </div>
                  ) : vendorPerformance.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        No vendor data available yet
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-900">
                              Vendor
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Orders
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Total Value
                            </th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">
                              Avg Order
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">
                              Last Order
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">
                              Rating
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendorPerformance.map((vendor, index) => (
                            <tr
                              key={index}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="py-3 px-4 font-medium text-gray-900">
                                {vendor.name}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {vendor.totalOrders}
                              </td>
                              <td className="py-3 px-4 text-right">
                                ${vendor.totalValue.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                ${vendor.avgOrderValue.toFixed(2)}
                              </td>
                              <td className="py-3 px-4">
                                {vendor.lastOrder ? (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Calendar className="w-4 h-4 mr-1" />
                                    {new Date(
                                      vendor.lastOrder,
                                    ).toLocaleDateString()}
                                  </div>
                                ) : (
                                  "No orders"
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline">Excellent</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
