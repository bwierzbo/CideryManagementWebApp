"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
  ShoppingCart,
  Percent,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { SalesOverviewTab } from "@/components/reports/sales/SalesOverviewTab";
import { downloadSalesReportPDF, type SalesReportPDFData } from "@/utils/pdf/salesReport";
import { downloadSalesReportExcel } from "@/utils/excel/salesReport";
import { SalesByChannelTab } from "@/components/reports/sales/SalesByChannelTab";
import { ProductsTab } from "@/components/reports/sales/ProductsTab";
import { MarginsTab } from "@/components/reports/sales/MarginsTab";
import { TransactionsTab } from "@/components/reports/sales/TransactionsTab";

// Default date range: current month
const defaultStartDate = startOfMonth(new Date());
const defaultEndDate = endOfMonth(new Date());

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState(format(defaultStartDate, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(defaultEndDate, "yyyy-MM-dd"));
  const [dateLabel, setDateLabel] = useState("This Month");
  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);

  // Handle date range changes from picker
  const handleDateRangeChange = (start: Date, end: Date, label: string) => {
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
    setDateLabel(label);
  };

  // Fetch summary data
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = trpc.sales.getSummary.useQuery({ startDate, endDate });

  // Fetch channel data
  const { data: channelData, isLoading: isLoadingChannels } =
    trpc.sales.getByChannel.useQuery({ startDate, endDate });

  // Fetch trends data
  const { data: trendsData, isLoading: isLoadingTrends } =
    trpc.sales.getTrends.useQuery({ startDate, endDate, groupBy: "day" });

  // Fetch top products
  const { data: productsData, isLoading: isLoadingProducts } =
    trpc.sales.getTopProducts.useQuery({ startDate, endDate, limit: 10 });

  // Fetch margins (always fetch for export availability)
  const { data: marginsData, isLoading: isLoadingMargins } =
    trpc.sales.getMargins.useQuery({ startDate, endDate });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatPercent = (num: number) => {
    return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
  };

  // Build export data object
  const buildExportData = (): SalesReportPDFData | null => {
    if (!summaryData || !channelData || !productsData) {
      return null;
    }

    return {
      period: {
        startDate,
        endDate,
        label: dateLabel,
      },
      summary: {
        totalRevenue: summaryData.totalRevenue,
        totalUnits: summaryData.totalUnits,
        avgOrderValue: summaryData.avgOrderValue,
        totalVolumeLiters: summaryData.totalVolumeLiters,
        transactionCount: summaryData.transactionCount,
        changes: summaryData.changes,
      },
      channels: channelData.channels.map((c) => ({
        channelName: c.channelName,
        revenue: c.revenue,
        units: c.units,
        volumeLiters: c.volumeLiters,
        percentOfTotal: c.percentOfTotal,
      })),
      products: productsData.products.map((p) => ({
        productName: p.productName,
        packageType: p.packageType,
        packageSizeML: p.packageSizeML,
        revenue: p.revenue,
        units: p.units,
        avgPrice: p.avgPrice,
      })),
      margins: marginsData
        ? {
            products: marginsData.products.map((p) => ({
              productName: p.productName,
              revenue: p.revenue,
              units: p.units,
              cogs: p.cogs,
              grossProfit: p.grossProfit,
              marginPercent: p.marginPercent,
            })),
            totals: marginsData.totals,
          }
        : undefined,
    };
  };

  const handleExportPDF = async () => {
    const data = buildExportData();
    if (!data) {
      toast({
        title: "Export Error",
        description: "Please wait for data to load before exporting",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const filename = `sales-report-${startDate}-to-${endDate}.pdf`;
      await downloadSalesReportPDF(data, filename);
      toast({
        title: "Export Complete",
        description: "PDF has been downloaded",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    const data = buildExportData();
    if (!data) {
      toast({
        title: "Export Error",
        description: "Please wait for data to load before exporting",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const filename = `sales-report-${startDate}-to-${endDate}.xlsx`;
      await downloadSalesReportExcel(data, filename);
      toast({
        title: "Export Complete",
        description: "Excel file has been downloaded",
      });
    } catch (error) {
      console.error("Excel export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel file",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isLoadingSummary || isLoadingChannels;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="w-8 h-8 text-green-600 mr-3" />
                Sales Report
              </h1>
              <p className="text-gray-600 mt-2">
                Revenue, margins, and sales analytics by channel
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refetchSummary()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={isLoading || isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={isLoading || isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Date Range Selector */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <DateRangePicker
              onDateRangeChange={handleDateRangeChange}
              defaultPreset="this-month"
            />
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Revenue */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Revenue
                  </p>
                  {isLoadingSummary ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mt-2" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(summaryData?.totalRevenue || 0)}
                      </p>
                      <p
                        className={`text-xs flex items-center mt-1 ${
                          (summaryData?.changes?.revenue || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(summaryData?.changes?.revenue || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {formatPercent(summaryData?.changes?.revenue || 0)} vs
                        prior period
                      </p>
                    </>
                  )}
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          {/* Units Sold */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Units Sold</p>
                  {isLoadingSummary ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mt-2" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        {formatNumber(summaryData?.totalUnits || 0)}
                      </p>
                      <p
                        className={`text-xs flex items-center mt-1 ${
                          (summaryData?.changes?.units || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(summaryData?.changes?.units || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {formatPercent(summaryData?.changes?.units || 0)} vs
                        prior period
                      </p>
                    </>
                  )}
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          {/* Average Order Value */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Avg Order Value
                  </p>
                  {isLoadingSummary ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mt-2" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        {formatCurrency(summaryData?.avgOrderValue || 0)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatNumber(summaryData?.transactionCount || 0)}{" "}
                        transactions
                      </p>
                    </>
                  )}
                </div>
                <ShoppingCart className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          {/* Volume */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Volume Sold
                  </p>
                  {isLoadingSummary ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mt-2" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        {formatNumber(
                          Math.round(summaryData?.totalVolumeLiters || 0)
                        )}{" "}
                        L
                      </p>
                      <p
                        className={`text-xs flex items-center mt-1 ${
                          (summaryData?.changes?.volume || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(summaryData?.changes?.volume || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {formatPercent(summaryData?.changes?.volume || 0)} vs
                        prior period
                      </p>
                    </>
                  )}
                </div>
                <BarChart3 className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              By Channel
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="margins" className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Margins
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Transactions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <SalesOverviewTab
              trendsData={trendsData}
              channelData={channelData}
              isLoadingTrends={isLoadingTrends}
              isLoadingChannels={isLoadingChannels}
            />
          </TabsContent>

          {/* By Channel Tab */}
          <TabsContent value="channels">
            <SalesByChannelTab
              channelData={channelData}
              isLoading={isLoadingChannels}
            />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <ProductsTab
              productsData={productsData}
              isLoading={isLoadingProducts}
            />
          </TabsContent>

          {/* Margins Tab */}
          <TabsContent value="margins">
            <MarginsTab
              marginsData={marginsData}
              isLoading={isLoadingMargins}
            />
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <TransactionsTab
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
