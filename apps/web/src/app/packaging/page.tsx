"use client";

import { useState, useCallback, lazy, Suspense, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/utils/trpc";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Download,
  X,
  Loader2,
  Beaker,
  Send,
  RotateCcw,
  LayoutDashboard,
  Clock,
  CheckCircle,
  Package2,
  AlertTriangle,
} from "lucide-react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { PackagingFiltersSkeleton, PackagingTableRowSkeleton } from "./loading";
import { BulkDistributeKegsModal } from "@/components/packaging/kegs/BulkDistributeKegsModal";
import { BulkReturnKegsModal } from "@/components/packaging/kegs/BulkReturnKegsModal";
import { VolumeUnitToggle } from "@/components/ui/volume-unit-toggle";
import { useVolumeUnit } from "@/hooks/use-volume-unit";
import { formatDate } from "@/utils/date-format";

// Lazy load heavy components
const BottlesTable = lazy(() =>
  import("@/components/packaging/bottles-table").then((m) => ({
    default: m.BottlesTable,
  })),
);
const KegsTable = lazy(() =>
  import("@/components/packaging/kegs/KegsTable").then((m) => ({
    default: m.KegsTable,
  })),
);
const PackagingFilters = lazy(() =>
  import("@/components/packaging/bottle-filters").then((m) => ({
    default: m.PackagingFilters,
  })),
);

// Types
import type { PackagingFiltersState } from "@/components/packaging/bottle-filters";

// Generate year options (from 2024 to current year)
const currentYear = new Date().getFullYear();
const yearOptions = Array.from(
  { length: currentYear - 2023 },
  (_, i) => currentYear - i,
);

export default function PackagingPage() {
  const router = useRouter();
  const { unit, toggleUnit, formatValue } = useVolumeUnit();
  const [activeTab, setActiveTab] = useState<"overview" | "bottles" | "kegs">("overview");
  const [overviewYear, setOverviewYear] = useState(currentYear);
  const [dateMode, setDateMode] = useState<"packaged" | "distributed">("packaged");
  const [filters, setFilters] = useState<PackagingFiltersState>({
    dateFrom: null,
    dateTo: null,
    packageSizeML: null,
    packageType: null,
    batchSearch: "",
    status: "active",
  });

  const [isExporting, setIsExporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkDistributeOpen, setBulkDistributeOpen] = useState(false);
  const [bulkReturnOpen, setBulkReturnOpen] = useState(false);
  const [tableData, setTableData] = useState<{
    items: any[];
    count: number;
    exportCSV: () => void;
    exportSelectedCSV: (selectedIds: string[]) => void;
    selectedCount: number;
  }>({
    items: [],
    count: 0,
    exportCSV: () => {},
    exportSelectedCSV: () => {},
    selectedCount: 0,
  });

  // Overview data
  const { data: stats } = trpc.packaging.getStats.useQuery({ year: overviewYear, dateMode });

  const overviewDateFrom = `${overviewYear}-01-01T00:00:00Z`;
  const overviewDateTo = `${overviewYear}-12-31T23:59:59Z`;

  const { data: allRuns, isLoading: allRunsLoading } = trpc.packaging.list.useQuery({
    limit: 500,
    dateFrom: overviewDateFrom,
    dateTo: overviewDateTo,
  });

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.recordUserInteraction({
      type: "navigation",
      target: "/packaging",
      timestamp: performance.now(),
    });
  }, []);

  const handleFiltersChange = useCallback(
    (newFilters: PackagingFiltersState) => {
      setFilters(newFilters);
    },
    [],
  );

  const handleTableDataChange = useCallback(
    (data: {
      items: any[];
      count: number;
      exportCSV: () => void;
      exportSelectedCSV: (selectedIds: string[]) => void;
      selectedCount: number;
    }) => {
      setTableData(data);
    },
    [],
  );

  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedItems(selectedIds);
    setShowBulkActions(selectedIds.length > 0);
  }, []);

  const handleExport = useCallback(async () => {
    const startTime = performance.now();
    setIsExporting(true);

    performanceMonitor.recordUserInteraction({
      type: "export",
      target: "packaging-export-all",
      timestamp: startTime,
    });

    try {
      await tableData.exportCSV();
      const duration = performance.now() - startTime;
      performanceMonitor.completeUserInteraction(
        "packaging-export-all",
        duration,
      );
    } finally {
      setIsExporting(false);
    }
  }, [tableData]);

  const handleBulkExport = useCallback(async () => {
    if (selectedItems.length === 0) return;

    const startTime = performance.now();
    setIsExporting(true);

    performanceMonitor.recordUserInteraction({
      type: "export",
      target: "packaging-export-selected",
      timestamp: startTime,
      metadata: { selectedCount: selectedItems.length },
    });

    try {
      await tableData.exportSelectedCSV(selectedItems);
      const duration = performance.now() - startTime;
      performanceMonitor.completeUserInteraction(
        "packaging-export-selected",
        duration,
      );
    } finally {
      setIsExporting(false);
    }
  }, [selectedItems, tableData]);

  const handleClearSelection = useCallback(() => {
    setSelectedItems([]);
    setShowBulkActions(false);
  }, []);

  // Get selected kegs data for bulk modals
  const selectedKegs = useMemo(() => {
    if (activeTab !== "kegs" || selectedItems.length === 0) return [];
    return tableData.items
      .filter((item: any) => selectedItems.includes(item.id))
      .map((item: any) => ({
        id: item.id,
        kegNumber: item.kegNumber,
        status: item.status,
        distributedAt: item.distributedAt,
        distributionLocation: item.distributionLocation,
      }));
  }, [activeTab, selectedItems, tableData.items]);

  // Determine which bulk actions are available based on selected kegs
  const bulkActionAvailability = useMemo(() => {
    if (selectedKegs.length === 0) {
      return { canDistribute: false, canReturn: false };
    }
    const hasFilledKegs = selectedKegs.some((k) => k.status === "filled");
    const hasDistributedKegs = selectedKegs.some((k) => k.status === "distributed");
    return {
      canDistribute: hasFilledKegs,
      canReturn: hasDistributedKegs,
    };
  }, [selectedKegs]);

  const handleBulkDistribute = useCallback(() => {
    setBulkDistributeOpen(true);
  }, []);

  const handleBulkReturn = useCallback(() => {
    setBulkReturnOpen(true);
  }, []);

  const handleBulkActionSuccess = useCallback(() => {
    setSelectedItems([]);
    setShowBulkActions(false);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as "overview" | "bottles" | "kegs";
    setActiveTab(newTab);

    // Clear selection when switching tabs
    setSelectedItems([]);
    setShowBulkActions(false);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "filled":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">In Progress</Badge>;
      case "ready":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Ready</Badge>;
      case "distributed":
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Distributed</Badge>;
      case "returned":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Returned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="w-full py-6 px-6">
        {/* Page Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Packaging
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Track and manage all packaging operations
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid w-full max-w-[600px] grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="bottles">Bottles & Cans</TabsTrigger>
            <TabsTrigger value="kegs">Kegs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Year Picker + Date Mode + Volume Unit Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Select
                  value={overviewYear.toString()}
                  onValueChange={(v) => setOverviewYear(parseInt(v))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={dateMode}
                  onValueChange={(v) => setDateMode(v as "packaged" | "distributed")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="packaged">By Date Packaged</SelectItem>
                    <SelectItem value="distributed">By Date Distributed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <VolumeUnitToggle unit={unit} onToggle={toggleUnit} />
            </div>

            {/* Stats Cards — volumes by status */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Packaged</p>
                      <p className="text-2xl font-bold">
                        {formatValue(stats?.totalVolumeLiters ?? 0)} {unit}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(stats?.bottleRunCount ?? 0) + (stats?.kegFillCount ?? 0)} runs
                      </p>
                    </div>
                    <Package2 className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">In Progress (Bonded)</p>
                      <p className="text-2xl font-bold">
                        {formatValue(stats?.inProgressVolumeLiters ?? 0)} {unit}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.inProgress ?? 0} runs
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ready (Bonded)</p>
                      <p className="text-2xl font-bold">
                        {formatValue(stats?.readyVolumeLiters ?? 0)} {unit}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.ready ?? 0} runs
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Distributed (Out of Bond)</p>
                      <p className="text-2xl font-bold">
                        {formatValue(stats?.canonicalDistributedLiters ?? stats?.distributedVolumeLiters ?? 0)} {unit}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.distributed ?? 0} runs
                      </p>
                      {(stats?.priorYearDistributedLiters ?? 0) > 0 && (
                        <div className="text-xs mt-1 space-y-0.5">
                          <p className="text-muted-foreground">
                            {overviewYear} packaged: {formatValue(
                              (stats?.canonicalDistributedLiters ?? 0) - (stats?.priorYearDistributedLiters ?? 0)
                            )} {unit}
                          </p>
                          <p className="text-muted-foreground">
                            Prior year stock: {formatValue(stats?.priorYearDistributedLiters ?? 0)} {unit}
                          </p>
                        </div>
                      )}
                    </div>
                    <Send className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Packaging Losses</p>
                      <p className="text-2xl font-bold">
                        {formatValue(stats?.totalLossLiters ?? 0)} {unit}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(stats?.totalVolumeLiters ?? 0) > 0
                          ? `${(((stats?.totalLossLiters ?? 0) / (stats?.totalVolumeLiters ?? 1)) * 100).toFixed(1)}% of total`
                          : "—"}
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottles vs Kegs Breakdown */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Bottles & Cans</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{formatValue(stats.bottles.totalVolumeL)} {unit} ({stats.bottles.count} runs, {stats.bottles.units.toLocaleString()} units)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-600">In Progress</span>
                        <span>{formatValue(stats.bottles.inProgressVolumeL)} {unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Ready</span>
                        <span>{formatValue(stats.bottles.readyVolumeL)} {unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">Distributed</span>
                        <span>{formatValue(stats.bottles.distributedVolumeL)} {unit}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-red-600">Losses</span>
                        <span className="text-red-600">{formatValue(stats.bottles.lossL)} {unit}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Kegs</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{formatValue(stats.kegs.totalVolumeL)} {unit} ({stats.kegs.count} fills)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-600">In Progress</span>
                        <span>{formatValue(stats.kegs.inProgressVolumeL)} {unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Ready</span>
                        <span>{formatValue(stats.kegs.readyVolumeL)} {unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600">Distributed</span>
                        <span>{formatValue(stats.kegs.distributedVolumeL)} {unit}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-red-600">Losses</span>
                        <span className="text-red-600">{formatValue(stats.kegs.lossL)} {unit}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* All Packaging Runs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">All Packaging Runs ({overviewYear})</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {allRuns?.total ?? 0} runs
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {allRunsLoading ? (
                  <div className="text-center py-6 text-gray-500">Loading...</div>
                ) : !allRuns?.runs || allRuns.runs.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    No packaging runs found for {overviewYear}.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Batch Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Volume ({unit})</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allRuns.runs.map((run: any) => (
                        <TableRow key={run.id}>
                          <TableCell className="text-sm">
                            {run.packagedAt ? formatDate(run.packagedAt) : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            <a
                              href={`/batch/${run.batchId}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {run.batchId?.slice(0, 8)}
                            </a>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {run.batchCustomName || run.batchName || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {run.source === "keg_fill" ? "Keg" : (run.packageType === "can" ? "Can" : "Bottle")}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {run.unitsProduced?.toLocaleString() ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {formatValue(run.volumeTakenL ?? 0)}
                          </TableCell>
                          <TableCell>{getStatusBadge(run.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bottles" className="space-y-4">
            {/* Filters */}
            <Suspense fallback={<PackagingFiltersSkeleton />}>
              <PackagingFilters
                onFiltersChange={handleFiltersChange}
                onExportClick={handleExport}
                isExporting={isExporting}
                initialFilters={filters}
                itemCount={tableData.count}
                variant="bottles"
              />
            </Suspense>

            {/* Bulk Actions Bar */}
            {showBulkActions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="secondary"
                      className="bg-blue-600 text-white flex-shrink-0 px-2 py-0.5 font-semibold"
                    >
                      {selectedItems.length}
                    </Badge>
                    <span className="text-sm font-medium text-blue-900 truncate">
                      <span className="hidden sm:inline">
                        {selectedItems.length === 1
                          ? "1 run selected"
                          : `${selectedItems.length} runs selected`}
                      </span>
                      <span className="sm:hidden">
                        {selectedItems.length === 1
                          ? "1 selected"
                          : `${selectedItems.length} selected`}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExport}
                      disabled={isExporting}
                      className="border-blue-300 bg-white text-blue-700 hover:bg-blue-50 flex-1 sm:flex-initial h-9"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          <span className="hidden sm:inline">Exporting...</span>
                          <span className="sm:hidden">...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 mr-2" />
                          <span className="hidden sm:inline">
                            Export Selected
                          </span>
                          <span className="sm:hidden">Export</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                      className="text-blue-700 hover:bg-blue-100 min-w-0 h-9"
                    >
                      <X className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content */}
            <Suspense
              fallback={
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <PackagingTableRowSkeleton key={index} />
                  ))}
                </div>
              }
            >
              <BottlesTable
                filters={filters}
                onDataChange={handleTableDataChange}
                enableSelection={true}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="kegs" className="space-y-4">
            {/* Filters */}
            <Suspense fallback={<PackagingFiltersSkeleton />}>
              <PackagingFilters
                onFiltersChange={handleFiltersChange}
                onExportClick={handleExport}
                isExporting={isExporting}
                initialFilters={filters}
                itemCount={tableData.count}
                variant="kegs"
              />
            </Suspense>

            {/* Bulk Actions Bar */}
            {showBulkActions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="secondary"
                      className="bg-blue-600 text-white flex-shrink-0 px-2 py-0.5 font-semibold"
                    >
                      {selectedItems.length}
                    </Badge>
                    <span className="text-sm font-medium text-blue-900 truncate">
                      <span className="hidden sm:inline">
                        {selectedItems.length === 1
                          ? "1 keg selected"
                          : `${selectedItems.length} kegs selected`}
                      </span>
                      <span className="sm:hidden">
                        {selectedItems.length === 1
                          ? "1 selected"
                          : `${selectedItems.length} selected`}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {bulkActionAvailability.canDistribute && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDistribute}
                        className="border-blue-300 bg-white text-blue-700 hover:bg-blue-50 h-9"
                      >
                        <Send className="w-3.5 h-3.5 mr-2" />
                        <span className="hidden sm:inline">Distribute</span>
                        <span className="sm:hidden">Dist</span>
                      </Button>
                    )}
                    {bulkActionAvailability.canReturn && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkReturn}
                        className="border-blue-300 bg-white text-blue-700 hover:bg-blue-50 h-9"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-2" />
                        <span className="hidden sm:inline">Return</span>
                        <span className="sm:hidden">Ret</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExport}
                      disabled={isExporting}
                      className="border-blue-300 bg-white text-blue-700 hover:bg-blue-50 h-9"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          <span className="hidden sm:inline">Exporting...</span>
                          <span className="sm:hidden">...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 mr-2" />
                          <span className="hidden sm:inline">Export</span>
                          <span className="sm:hidden">Exp</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                      className="text-blue-700 hover:bg-blue-100 min-w-0 h-9"
                    >
                      <X className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content */}
            <Suspense
              fallback={
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <PackagingTableRowSkeleton key={index} />
                  ))}
                </div>
              }
            >
              <KegsTable
                filters={filters}
                onDataChange={handleTableDataChange}
                enableSelection={true}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
              />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>

      {/* Bulk Keg Modals */}
      <BulkDistributeKegsModal
        open={bulkDistributeOpen}
        onClose={() => setBulkDistributeOpen(false)}
        selectedKegs={selectedKegs}
        onSuccess={handleBulkActionSuccess}
      />
      <BulkReturnKegsModal
        open={bulkReturnOpen}
        onClose={() => setBulkReturnOpen(false)}
        selectedKegs={selectedKegs}
        onSuccess={handleBulkActionSuccess}
      />
    </div>
  );
}
