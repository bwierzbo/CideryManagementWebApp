"use client";

import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, X, Loader2 } from "lucide-react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { PackagingFiltersSkeleton, PackagingTableRowSkeleton } from "./loading";

// Lazy load heavy components
const PackagingTable = lazy(() =>
  import("@/components/bottles/bottle-table").then((m) => ({
    default: m.PackagingTable,
  })),
);
const PackagingFilters = lazy(() =>
  import("@/components/bottles/bottle-filters").then((m) => ({
    default: m.PackagingFilters,
  })),
);

// Types
import type { PackagingFiltersState } from "@/components/bottles/bottle-filters";

export default function PackagingPage() {
  const [filters, setFilters] = useState<PackagingFiltersState>({
    dateFrom: null,
    dateTo: null,
    packageSizeML: null,
    batchSearch: "",
    status: "all",
  });

  const [isExporting, setIsExporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
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
      target: "/bottles",
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                Packaging Runs
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                View and manage all packaging operations and production runs.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button className="w-full sm:w-auto" size={"sm"}>
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">New Packaging Run</span>
                <span className="sm:hidden">New Run</span>
              </Button>
            </div>
          </div>
        </div>

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
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 flex-shrink-0"
                  >
                    {selectedItems.length}
                  </Badge>
                  <span className="text-sm text-blue-700 truncate">
                    <span className="hidden sm:inline">
                      {selectedItems.length === 1
                        ? "1 packaging run selected"
                        : `${selectedItems.length} packaging runs selected`}
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
                    className="border-blue-200 text-blue-700 hover:bg-blue-100 flex-1 sm:flex-initial"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Exporting...</span>
                        <span className="sm:hidden">Export...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
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
                    className="text-blue-700 hover:bg-blue-100 min-w-0"
                  >
                    <X className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
          <PackagingTable
            filters={filters}
            onDataChange={handleTableDataChange}
            enableSelection={true}
            selectedItems={selectedItems}
            onSelectionChange={handleSelectionChange}
          />
        </Suspense>
      </main>
    </div>
  );
}
