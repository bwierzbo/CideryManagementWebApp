"use client";

import { useState, useCallback, lazy, Suspense, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Download, X, Loader2, Beaker, Send, RotateCcw } from "lucide-react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { PackagingFiltersSkeleton, PackagingTableRowSkeleton } from "./loading";
import { BulkDistributeKegsModal } from "@/components/packaging/kegs/BulkDistributeKegsModal";
import { BulkReturnKegsModal } from "@/components/packaging/kegs/BulkReturnKegsModal";

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

export default function PackagingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bottles" | "kegs">("bottles");
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

  const handleNewBottleRun = useCallback(() => {
    router.push("/cellar");
  }, [router]);

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as "bottles" | "kegs";
    setActiveTab(newTab);

    // Clear selection when switching tabs
    setSelectedItems([]);
    setShowBulkActions(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="w-full py-6 px-6">
        {/* Page Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Packaging Runs
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            View and manage packaging operations
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="bottles">Bottles & Cans</TabsTrigger>
            <TabsTrigger value="kegs">Kegs</TabsTrigger>
          </TabsList>

          <TabsContent value="bottles" className="space-y-4">
            {/* Filters */}
            <Suspense fallback={<PackagingFiltersSkeleton />}>
              <PackagingFilters
                onFiltersChange={handleFiltersChange}
                onExportClick={handleExport}
                isExporting={isExporting}
                initialFilters={filters}
                itemCount={tableData.count}
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
