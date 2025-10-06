"use client";

import { useState, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Package,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Grape,
  Beaker,
  FileText,
  Plus,
  ArrowUpRight,
  Calendar,
  Eye,
  CheckCircle,
  Droplets,
  Wine,
  Activity,
  DollarSign,
  Download,
  Badge as BadgeIcon,
  RefreshCw,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { VolumeDisplay } from "@/components/ui/volume-input";

const stats = [
  {
    icon: BarChart3,
    label: "Active Batches",
    value: "12",
    change: "+2 from last month",
    changeType: "positive" as const,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    icon: Package,
    label: "Bottles Ready",
    value: "1,234",
    change: "Ready to ship",
    changeType: "neutral" as const,
    color: "bg-green-50 text-green-700 border-green-200",
  },
  {
    icon: TrendingUp,
    label: "Monthly Revenue",
    value: "$12,450",
    change: "+15% from last month",
    changeType: "positive" as const,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    icon: Users,
    label: "Active Vendors",
    value: "8",
    change: "All suppliers active",
    changeType: "positive" as const,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

const recentBatches = [
  {
    id: "B-2024-001",
    variety: "Honeycrisp",
    status: "Fermenting",
    abv: "4.2%",
    daysLeft: 12,
    statusColor: "bg-blue-100 text-blue-800",
  },
  {
    id: "B-2024-002",
    variety: "Gala Blend",
    status: "Aging",
    abv: "5.8%",
    daysLeft: 28,
    statusColor: "bg-amber-100 text-amber-800",
  },
  {
    id: "B-2024-003",
    variety: "Wild Apple",
    status: "Ready",
    abv: "6.1%",
    daysLeft: 0,
    statusColor: "bg-green-100 text-green-800",
  },
  {
    id: "B-2024-004",
    variety: "Granny Smith",
    status: "Pressing",
    abv: "—",
    daysLeft: 45,
    statusColor: "bg-gray-100 text-gray-800",
  },
];

const quickActions = [
  {
    icon: ShoppingCart,
    title: "Record Purchase",
    description: "Add new apple purchase",
    href: "/purchasing",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    icon: Grape,
    title: "Start Press Run",
    description: "Begin apple processing",
    href: "/pressing",
    color: "bg-purple-600 hover:bg-purple-700",
  },
  {
    icon: Beaker,
    title: "Log Measurement",
    description: "Record batch metrics",
    href: "/cellar",
    color: "bg-green-600 hover:bg-green-700",
  },
  {
    icon: FileText,
    title: "Generate Report",
    description: "Create COGS analysis",
    href: "/reports",
    color: "bg-amber-600 hover:bg-amber-700",
  },
];

const alerts = [
  {
    type: "warning",
    icon: AlertCircle,
    title: "Batch B-2024-001 needs attention",
    description: "Temperature reading is outside normal range",
    time: "2 hours ago",
    color: "border-l-amber-500 bg-amber-50",
  },
  {
    type: "success",
    icon: CheckCircle2,
    title: "Packaging completed for Batch B-2023-089",
    description: "456 bottles successfully packaged and labeled",
    time: "4 hours ago",
    color: "border-l-green-500 bg-green-50",
  },
];

function PingStatus() {
  const pingQuery = trpc.ping.useQuery();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${pingQuery.data?.ok ? "bg-green-500" : "bg-red-500"}`}
      ></div>
      <span className="text-sm text-gray-600">
        API: {pingQuery.data?.ok ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}

function LiquidMap() {
  const { data: session } = useSession();
  const { data: liquidData, isPending } = trpc.vessel.liquidMap.useQuery();

  const canView =
    (session?.user as any)?.role === "admin" ||
    (session?.user as any)?.role === "operator";

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5" />
            Liquid Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2" />
            <p>Access denied</p>
            <p className="text-sm">
              You need admin or operator permissions to view liquid inventory
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5" />
            Liquid Map
          </CardTitle>
          <CardDescription>
            Loading liquid inventory across cellar and packaging...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const vessels = liquidData?.vessels || [];
  const cellarLiquid = Number(liquidData?.cellarLiquidL) || 0;
  const packagedVolume =
    Number(liquidData?.packagedInventory?.totalVolumeL) || 0;
  const totalBottles = Number(liquidData?.packagedInventory?.totalBottles) || 0;
  const totalLiquid = Number(liquidData?.totalLiquidL) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="w-5 h-5" />
          Liquid Map
        </CardTitle>
        <CardDescription>
          Total liquid: {totalLiquid.toFixed(1)}L ({cellarLiquid.toFixed(1)}L in
          cellar, {packagedVolume.toFixed(1)}L packaged)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wine className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Cellar Liquid</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {cellarLiquid.toFixed(1)}L
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Packaged Stock</p>
                  <p className="text-2xl font-bold text-green-600">
                    {totalBottles.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    ({packagedVolume.toFixed(1)}L)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Liquid</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {totalLiquid.toFixed(1)}L
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Vessel Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vessels.map((vessel) => (
              <Card key={vessel.vesselId} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{vessel.vesselName}</h4>
                    <Badge
                      variant={
                        vessel.vesselStatus === "available"
                          ? "secondary"
                          : "default"
                      }
                    >
                      {vessel.vesselStatus}
                    </Badge>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    <p className="flex items-center gap-1">
                      Capacity:{" "}
                      <VolumeDisplay
                        value={Number(vessel.vesselCapacity) || 0}
                        unit={vessel.vesselCapacityUnit || "L"}
                        showUnit={true}
                      />
                    </p>
                    {vessel.vesselLocation && (
                      <p>Location: {vessel.vesselLocation}</p>
                    )}
                  </div>

                  {vessel.batchId && (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <Activity className="w-3 h-3 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          {vessel.batchNumber}
                        </span>
                      </div>
                      <div className="text-xs text-blue-700 flex items-center gap-1">
                        Volume:{" "}
                        <VolumeDisplay
                          value={Number(vessel.currentVolume) || 0}
                          unit={vessel.currentVolumeUnit || "L"}
                          showUnit={true}
                        />
                      </div>
                      <div className="text-xs text-blue-700">
                        Status: {vessel.batchStatus}
                      </div>
                    </div>
                  )}

                  {/* Capacity visualization */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Utilization</span>
                      <span>
                        {vessel.currentVolume
                          ? (
                              (Number(vessel.currentVolume) /
                                Number(vessel.vesselCapacity)) *
                              100
                            ).toFixed(0)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          vessel.vesselStatus === "fermenting" || vessel.vesselStatus === "aging"
                            ? "bg-blue-500"
                            : "bg-gray-300"
                        }`}
                        style={{
                          width: vessel.currentVolume
                            ? `${Math.min((Number(vessel.currentVolume) / Number(vessel.vesselCapacity)) * 100, 100)}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentPressRuns() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: pressRunsData, isPending } = trpc.pressRun.list.useQuery({
    status: "completed",
    limit: 100, // Get more items for client-side pagination and search
    sortBy: "updated",
    sortOrder: "desc",
  });

  const canView =
    (session?.user as any)?.role === "admin" ||
    (session?.user as any)?.role === "operator";

  const filteredPressRuns = useMemo(() => {
    if (!pressRunsData?.pressRuns) return [];

    const filtered = pressRunsData.pressRuns.filter((pressRun) => {
      const searchLower = searchTerm.toLowerCase();
      const varietiesText = pressRun.varieties.join(" ").toLowerCase();
      const vesselText = pressRun.vesselName?.toLowerCase() || "";
      const dateText = pressRun.endTime
        ? new Date(pressRun.endTime).toLocaleDateString().toLowerCase()
        : "";

      return (
        varietiesText.includes(searchLower) ||
        vesselText.includes(searchLower) ||
        dateText.includes(searchLower)
      );
    });

    return filtered;
  }, [pressRunsData?.pressRuns, searchTerm]);

  const paginatedPressRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPressRuns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPressRuns, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPressRuns.length / itemsPerPage);

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grape className="w-5 h-5" />
            Recent Completed Press Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2" />
            <p>Access denied</p>
            <p className="text-sm">
              You need admin or operator permissions to view press runs
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grape className="w-5 h-5" />
            Recent Completed Press Runs
          </CardTitle>
          <CardDescription>
            Loading recent press run completions...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Grape className="w-5 h-5" />
              Recent Completed Press Runs
            </CardTitle>
            <CardDescription>
              {filteredPressRuns.length} completed press run
              {filteredPressRuns.length !== 1 ? "s" : ""}
              {searchTerm && ` matching "${searchTerm}"`}
            </CardDescription>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center space-x-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by variety, vessel, or date..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredPressRuns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Grape className="w-8 h-8 mx-auto mb-2" />
            {searchTerm ? (
              <>
                <p>No press runs found for &quot;{searchTerm}&quot;</p>
                <p className="text-sm">Try adjusting your search terms</p>
              </>
            ) : (
              <>
                <p>No completed press runs found</p>
                <p className="text-sm">Completed press runs will appear here</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedPressRuns.map((pressRun) => (
                <div
                  key={pressRun.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {pressRun.endTime
                          ? new Date(pressRun.endTime).toLocaleDateString()
                          : "Recent"}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {pressRun.varieties.length > 0
                          ? pressRun.varieties.join(", ")
                          : "Mixed varieties"}
                      </p>
                      {pressRun.vesselName && (
                        <p className="text-xs text-gray-500">
                          → {pressRun.vesselName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Completed
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {pressRun.loadCount} load
                      {pressRun.loadCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {pressRun.totalJuiceVolume
                        ? `${parseFloat(pressRun.totalJuiceVolume).toFixed(1)}L`
                        : "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pressRun.extractionRatePercent
                        ? `${pressRun.extractionRatePercent.toFixed(1)}%`
                        : "Juice"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredPressRuns.length,
                  )}{" "}
                  of {filteredPressRuns.length} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        // Show first page, last page, current page, and pages around current
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, array) => (
                        <div key={page} className="flex items-center">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <Button
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        </div>
                      ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function COGSReport() {
  const { data: session } = useSession();
  const {
    data: cogsData,
    isPending,
    refetch,
  } = trpc.reports.cogsPerBatch.useQuery();

  const isAdmin = (session?.user as any)?.role === "admin";
  const canView =
    (session?.user as any)?.role === "admin" ||
    (session?.user as any)?.role === "operator";

  const exportCSV = () => {
    if (!cogsData?.batches) return;

    const headers = [
      "Batch Number",
      "Status",
      "Total Cost",
      "Apple Cost",
      "Labor Cost",
      "Overhead Cost",
      "Packaging Cost",
      "Cost per Bottle",
      "Cost per Liter",
      "Initial Volume (L)",
      "Current Volume (L)",
    ];

    const rows = cogsData.batches.map((batch) => [
      batch.batchNumber,
      batch.batchStatus,
      batch.totalCost,
      batch.totalAppleCost,
      batch.laborCost,
      batch.overheadCost,
      batch.packagingCost,
      batch.costPerBottle || "",
      batch.costPerL || "",
      batch.initialVolume,
      batch.currentVolume,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cogs-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!cogsData?.batches) return;
    if (typeof window === 'undefined') return; // Only run on client

    try {
      // Dynamic import to avoid SSR issues
      const ReactPDF = await import("@react-pdf/renderer");
      const { Document, Page, Text, View, StyleSheet, pdf } = ReactPDF;

      const COGSReportPDF = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>COGS per Batch Report</Text>
              <Text style={styles.subtitle}>
                Generated on {new Date().toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.headerCell]}>Batch</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  Status
                </Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  Total Cost
                </Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  Apple Cost
                </Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Labor</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  Overhead
                </Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  Packaging
                </Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  $/Bottle
                </Text>
                <Text style={[styles.tableCell, styles.headerCell]}>
                  $/Liter
                </Text>
              </View>

              {cogsData.batches.map((batch, index) => (
                <View key={batch.batchId} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{batch.batchNumber}</Text>
                  <Text style={styles.tableCell}>{batch.batchStatus}</Text>
                  <Text style={styles.tableCell}>
                    ${parseFloat(batch.totalCost).toFixed(2)}
                  </Text>
                  <Text style={styles.tableCell}>
                    ${parseFloat(batch.totalAppleCost).toFixed(2)}
                  </Text>
                  <Text style={styles.tableCell}>
                    ${parseFloat(batch.laborCost).toFixed(2)}
                  </Text>
                  <Text style={styles.tableCell}>
                    ${parseFloat(batch.overheadCost).toFixed(2)}
                  </Text>
                  <Text style={styles.tableCell}>
                    ${parseFloat(batch.packagingCost).toFixed(2)}
                  </Text>
                  <Text style={styles.tableCell}>
                    {batch.costPerBottle
                      ? `$${parseFloat(batch.costPerBottle).toFixed(4)}`
                      : "—"}
                  </Text>
                  <Text style={styles.tableCell}>
                    {batch.costPerL
                      ? `$${parseFloat(batch.costPerL).toFixed(2)}`
                      : "—"}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Total Batches: {cogsData.batches.length}
              </Text>
            </View>
          </Page>
        </Document>
      );

      const styles = StyleSheet.create({
        page: {
          flexDirection: "column",
          backgroundColor: "#FFFFFF",
          padding: 30,
        },
        header: {
          marginBottom: 20,
        },
        title: {
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 5,
        },
        subtitle: {
          fontSize: 12,
          color: "#666666",
        },
        table: {
          display: "flex",
          width: "auto",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#bfbfbf",
        },
        tableHeader: {
          flexDirection: "row",
          backgroundColor: "#f0f0f0",
        },
        tableRow: {
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: "#bfbfbf",
        },
        tableCell: {
          flex: 1,
          fontSize: 8,
          padding: 5,
          borderRightWidth: 1,
          borderRightColor: "#bfbfbf",
        },
        headerCell: {
          fontWeight: "bold",
          backgroundColor: "#f0f0f0",
        },
        footer: {
          marginTop: 20,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: "#bfbfbf",
        },
        footerText: {
          fontSize: 10,
          color: "#666666",
        },
      });

      const blob = await pdf(<COGSReportPDF />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cogs-report-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  const refreshSnapshots = async () => {
    try {
      await refetch();
      alert("Cost data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      alert("Error refreshing data. Please try again.");
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            COGS per Batch Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2" />
            <p>Access denied</p>
            <p className="text-sm">
              You need admin or operator permissions to view this report
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            COGS per Batch Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const batches = cogsData?.batches || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              COGS per Batch Report
            </CardTitle>
            <CardDescription>
              Cost breakdown for {batches.length} batches
            </CardDescription>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={refreshSnapshots}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">Apple Cost</TableHead>
              <TableHead className="text-right">Labor</TableHead>
              <TableHead className="text-right">Overhead</TableHead>
              <TableHead className="text-right">Packaging</TableHead>
              <TableHead className="text-right">$/Bottle</TableHead>
              <TableHead className="text-right">$/Liter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.batchId}>
                <TableCell className="font-medium">
                  {batch.batchNumber}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      batch.batchStatus === "completed"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {batch.batchStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${parseFloat(batch.totalCost).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${parseFloat(batch.totalAppleCost).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${parseFloat(batch.laborCost).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${parseFloat(batch.overheadCost).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  ${parseFloat(batch.packagingCost).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {batch.costPerBottle
                    ? `$${parseFloat(batch.costPerBottle).toFixed(4)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {batch.costPerL
                    ? `$${parseFloat(batch.costPerL).toFixed(2)}`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {batches.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>No batch cost data available</p>
            <p className="text-sm">
              Cost calculations will appear here once batches are processed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Overview of liquid inventory, batch costs, and cidery operations
              </p>
            </div>
            <div className="text-right space-y-2">
              <PingStatus />
              {session?.user && (
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <Badge
                    variant={
                      (session.user as any).role === "admin"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {(session.user as any).role || "Unknown"}
                  </Badge>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Last updated</p>
                <p className="text-sm font-medium text-gray-900">
                  Today at 2:30 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="liquid-map" className="flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Liquid Map
            </TabsTrigger>
            <TabsTrigger
              value="cogs-report"
              className="flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              COGS Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Original Dashboard Content */}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => {
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

            {/* Alerts */}
            <Card className="bg-white mb-8 border-2 border-gray-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Recent Alerts & Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alerts.map((alert, index) => {
                    const Icon = alert.icon;
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${alert.color}`}
                      >
                        <div className="flex items-start">
                          <Icon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              {alert.title}
                            </h4>
                            <p className="text-gray-600 text-sm mb-2">
                              {alert.description}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {alert.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Recent Batches */}
              <div className="lg:col-span-2">
                <Card className="bg-white border-2 border-gray-100 h-full">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Active Batches</CardTitle>
                        <CardDescription>
                          Monitor your current fermentation batches
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentBatches.map((batch, index) => (
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
                                {batch.id}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {batch.variety}
                              </p>
                            </div>
                          </div>
                          <div className="text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${batch.statusColor}`}
                            >
                              {batch.status}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {batch.daysLeft > 0
                                ? `${batch.daysLeft} days left`
                                : "Complete"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {batch.abv}
                            </p>
                            <p className="text-xs text-gray-500">ABV</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div>
                <Card className="bg-white border-2 border-gray-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Quick Actions
                    </CardTitle>
                    <CardDescription>
                      Common tasks and operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {quickActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                          <Button
                            key={index}
                            variant="outline"
                            className="w-full justify-start h-auto p-4 hover:shadow-md transition-all duration-200 group"
                            asChild
                          >
                            <a href={action.href}>
                              <div
                                className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mr-3 text-white group-hover:scale-110 transition-transform`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-gray-900 group-hover:text-gray-700">
                                  {action.title}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {action.description}
                                </div>
                              </div>
                            </a>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Upcoming Tasks */}
                <Card className="bg-white border-2 border-gray-100 mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      This Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            Bottle Batch B-2024-001
                          </p>
                          <p className="text-gray-500">Tomorrow</p>
                        </div>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            Vendor delivery expected
                          </p>
                          <p className="text-gray-500">Thursday</p>
                        </div>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            Monthly COGS report due
                          </p>
                          <p className="text-gray-500">Friday</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent Press Runs */}
            <div className="mb-8">
              <RecentPressRuns />
            </div>
          </TabsContent>

          <TabsContent value="liquid-map">
            <LiquidMap />
          </TabsContent>

          <TabsContent value="cogs-report">
            <COGSReport />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
