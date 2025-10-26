"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Package,
  Eye,
  AlertTriangle,
  Calendar,
  Package2,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";

// Type for bottling run from API
interface PackagingRun {
  id: string;
  batchId: string;
  vesselId: string;
  packagedAt: string;
  packageType: string;
  packageSizeML: number;
  unitsProduced: number;
  volumeTakenL: number;
  lossL: number;
  lossPercentage: number;
  status: "completed" | "voided" | null;
  createdAt: string;
  // QA fields
  abvAtPackaging?: number | undefined;
  carbonationLevel?: "still" | "petillant" | "sparkling" | null;
  fillCheck?: "pass" | "fail" | "not_tested" | null;
  fillVarianceML?: number | undefined;
  testMethod?: string | null;
  testDate?: string | null;
  qaTechnicianId?: string | null;
  qaNotes?: string | null;
  productionNotes?: string | null;
  // Relations
  batch: {
    id: string;
    name: string | null;
  };
  vessel: {
    id: string;
    name: string | null;
  };
  qaTechnicianName?: string;
}

// Table column configuration
type SortField =
  | "packagedAt"
  | "batchName"
  | "unitsProduced"
  | "lossPercentage";

interface PackagingTableProps {
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: PackagingRun) => void;
  filters?: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
    packageSizeML?: number | null;
    batchSearch?: string;
    status?: "active" | "completed";
  };
  onDataChange?: (data: {
    items: PackagingRun[];
    count: number;
    exportCSV: () => void;
    exportSelectedCSV: (selectedIds: string[]) => void;
    selectedCount: number;
  }) => void;
  enableSelection?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function PackagingTable({
  className,
  itemsPerPage = 25,
  onItemClick,
  filters = {},
  onDataChange,
  enableSelection = false,
  selectedItems = [],
  onSelectionChange,
}: PackagingTableProps) {
  // Sorting state using the reusable hook
  const {
    sortState,
    handleSort,
    getSortDirection,
    getSortIcon,
    sortData,
    clearAllSort,
  } = useTableSorting<SortField>({
    multiColumn: false,
    defaultSort: { field: "packagedAt", direction: "desc" },
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  // Router for navigation
  const router = useRouter();

  // Calculate API parameters
  const apiParams = useMemo(() => {
    const params: any = {
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage,
    };

    // Add filters if provided
    if (filters.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo) {
      params.dateTo = filters.dateTo;
    }
    if (filters.packageSizeML) {
      params.packageSizeML = filters.packageSizeML;
    }
    if (filters.batchSearch) {
      params.batchSearch = filters.batchSearch;
    }
    // Status is now always provided (either "active" or "completed")
    if (filters.status) {
      params.status = filters.status;
    }

    return params;
  }, [itemsPerPage, currentPage, filters]);

  // API query
  const { data, isLoading, error, refetch } =
    trpc.bottles.list.useQuery(apiParams);

  // Derived state
  const totalCount = data?.total || 0;
  const hasMore = data?.hasMore || false;

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    const items = data?.runs || [];
    return sortData(items, (item: any, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "packagedAt":
          return new Date(item.packagedAt);
        case "batchName":
          return item.batch.name || "";
        case "unitsProduced":
          return item.unitsProduced;
        case "lossPercentage":
          return item.lossPercentage;
        default:
          return (item as any)[field];
      }
    });
  }, [data?.runs, sortData]);

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean | string) => {
      if (!enableSelection || !onSelectionChange) return;

      if (checked) {
        const allIds = sortedItems.map((item) => item.id);
        onSelectionChange(allIds);
      } else {
        onSelectionChange([]);
      }
    },
    [enableSelection, onSelectionChange, sortedItems],
  );

  const handleSelectItem = useCallback(
    (itemId: string, checked: boolean) => {
      if (!enableSelection || !onSelectionChange) return;

      if (checked) {
        onSelectionChange([...selectedItems, itemId]);
      } else {
        onSelectionChange(selectedItems.filter((id) => id !== itemId));
      }
    },
    [enableSelection, onSelectionChange, selectedItems],
  );

  const isAllSelected = useMemo(() => {
    return (
      enableSelection &&
      sortedItems.length > 0 &&
      sortedItems.every((item) => selectedItems.includes(item.id))
    );
  }, [enableSelection, sortedItems, selectedItems]);

  const isIndeterminate = useMemo(() => {
    return (
      enableSelection &&
      selectedItems.length > 0 &&
      selectedItems.length < sortedItems.length
    );
  }, [enableSelection, selectedItems.length, sortedItems.length]);

  // Event handlers
  const handleColumnSort = useCallback(
    (field: SortField) => {
      handleSort(field);
    },
    [handleSort],
  );

  const handleItemClick = useCallback(
    (item: PackagingRun) => {
      if (onItemClick) {
        onItemClick(item);
      } else {
        // Default navigation to detail page
        router.push(`/bottles/${item.id}`);
      }
    },
    [onItemClick, router],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Format package size display
  const formatPackageSize = useCallback(
    (sizeML: number, packageType: string) => {
      if (sizeML >= 1000) {
        return `${sizeML / 1000}L ${packageType}`;
      }
      return `${sizeML}ml ${packageType}`;
    },
    [],
  );

  // Format date display
  const formatDateDisplay = useCallback((date: string) => {
    return formatDate(new Date(date));
  }, []);

  // Get status badge color
  const getStatusColor = useCallback((status: string | null) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "voided":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }, []);

  // Get loss percentage color
  const getLossColor = useCallback((lossPercentage: number) => {
    if (lossPercentage <= 2) return "text-green-600";
    if (lossPercentage <= 5) return "text-yellow-600";
    return "text-red-600";
  }, []);

  // Get sort direction for display
  const getSortDirectionForDisplay = useCallback(
    (field: SortField) => {
      const direction = getSortDirection(field);
      return direction ? direction : "none";
    },
    [getSortDirection],
  );

  // Helper function to generate CSV filename with filter parameters
  const generateFilename = useCallback(
    (prefix: string = "bottling-runs") => {
      const date = new Date().toISOString().split("T")[0];
      const filterParams = [];

      if (filters?.batchSearch)
        filterParams.push(`batch-${filters.batchSearch.slice(0, 10)}`);
      if (filters?.status && filters.status !== "all")
        filterParams.push(`status-${filters.status}`);
      if (filters?.dateFrom && filters.dateFrom instanceof Date)
        filterParams.push(
          `from-${filters.dateFrom.toISOString().split("T")[0]}`,
        );
      if (filters?.dateTo && filters.dateTo instanceof Date)
        filterParams.push(`to-${filters.dateTo.toISOString().split("T")[0]}`);

      const filterSuffix =
        filterParams.length > 0 ? `-${filterParams.join("-")}` : "";
      return `${prefix}${filterSuffix}-${date}.csv`;
    },
    [filters],
  );

  // Helper function to create CSV content from items
  const createCSVContent = useCallback(
    (items: PackagingRun[]) => {
      const headers = [
        "Date",
        "Batch Name",
        "Vessel",
        "Package Type",
        "Package Size",
        "Units Produced",
        "Volume Taken (L)",
        "Loss (L)",
        "Loss %",
        "Status",
        "ABV at Packaging",
        "Carbonation Level",
        "Fill Check",
        "Fill Variance (mL)",
        "Test Method",
        "Test Date",
        "QA Technician",
        "QA Notes",
        "Production Notes",
        "Created At",
        "Run ID",
      ];

      const rows = items.map((item) => [
        formatDateDisplay(item.packagedAt),
        item.batch.name || `Batch ${item.batchId.slice(0, 8)}`,
        item.vessel.name || `Vessel ${item.vesselId.slice(0, 8)}`,
        item.packageType,
        formatPackageSize(item.packageSizeML, item.packageType),
        item.unitsProduced.toString(),
        item.volumeTakenL.toString(),
        item.lossL.toFixed(1),
        item.lossPercentage.toFixed(1),
        item.status || "pending",
        item.abvAtPackaging?.toFixed(2) || "",
        item.carbonationLevel || "",
        item.fillCheck || "",
        item.fillVarianceML?.toFixed(1) || "",
        item.testMethod || "",
        item.testDate ? formatDateDisplay(item.testDate) : "",
        item.qaTechnicianName || "",
        item.qaNotes || "",
        item.productionNotes || "",
        formatDateDisplay(item.createdAt),
        item.id,
      ]);

      return [headers, ...rows]
        .map((row) => row.map((field) => `"${field}"`).join(","))
        .join("\n");
    },
    [formatDateDisplay, formatPackageSize],
  );

  // Export all visible items
  const handleExportCSV = useCallback(async () => {
    if (!sortedItems.length) return;

    setIsExporting(true);
    try {
      const csvContent = createCSVContent(sortedItems);
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = generateFilename();
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [sortedItems, createCSVContent, generateFilename]);

  // Export selected items
  const handleExportSelectedCSV = useCallback(
    async (selectedIds: string[]) => {
      if (!selectedIds.length) return;

      setIsExporting(true);
      try {
        const selectedItems = sortedItems.filter((item) =>
          selectedIds.includes(item.id),
        );
        const csvContent = createCSVContent(selectedItems);
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = generateFilename(
          `bottling-runs-selected-${selectedIds.length}`,
        );
        a.click();
        URL.revokeObjectURL(url);
      } finally {
        setIsExporting(false);
      }
    },
    [sortedItems, createCSVContent, generateFilename],
  );

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        items: sortedItems,
        count: totalCount,
        exportCSV: handleExportCSV,
        exportSelectedCSV: handleExportSelectedCSV,
        selectedCount: selectedItems.length,
      });
    }
  }, [
    sortedItems,
    totalCount,
    handleExportCSV,
    handleExportSelectedCSV,
    selectedItems.length,
    onDataChange,
  ]);

  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Main Table */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Package className="w-5 h-5" />
                <span className="truncate">Bottle Runs</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {totalCount > 0
                  ? `${totalCount} bottling runs found`
                  : "No bottling runs found"}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex-shrink-0 h-8 md:h-9"
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {error && (
            <div className="flex items-center gap-2 p-3 md:p-4 text-red-600 bg-red-50 rounded-lg mb-4 mx-3 md:mx-0">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm md:text-base">
                Error loading bottling runs: {error.message}
              </span>
            </div>
          )}

          {/* Mobile Card View */}
          <div className="block md:hidden">
            {isLoading ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="text-center py-12 px-3 text-muted-foreground">
                <Package2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <div className="text-lg font-medium">
                  No bottling runs found
                </div>
                <div className="text-sm mt-1">
                  Bottling runs will appear here once created
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3">
                {sortedItems.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 cursor-pointer transition-colors touch-manipulation select-none"
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm">
                            {formatDateDisplay(item.packagedAt)}
                          </span>
                        </div>
                        <div className="font-semibold text-base truncate">
                          {item.batch.name ||
                            `Batch ${item.batchId.slice(0, 8)}`}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {item.vessel.name ||
                            `Vessel ${item.vesselId.slice(0, 8)}`}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Badge
                          className={cn("text-xs", getStatusColor(item.status))}
                        >
                          {item.status || "pending"}
                        </Badge>
                        {enableSelection && (
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) =>
                              handleSelectItem(item.id, !!checked)
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Package</div>
                        <div className="font-medium flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {formatPackageSize(
                            item.packageSizeML,
                            item.packageType,
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Units</div>
                        <div className="font-medium font-mono">
                          {item.unitsProduced.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Loss</div>
                        <div
                          className={cn(
                            "font-medium",
                            getLossColor(item.lossPercentage),
                          )}
                        >
                          {item.lossPercentage.toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                          className="h-7 px-2 text-xs touch-manipulation min-h-[44px] sm:min-h-[28px]"
                          aria-label={`View details for ${item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {enableSelection && (
                    <SortableHeader canSort={false} className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all rows"
                        className={
                          isIndeterminate
                            ? "data-[state=indeterminate]:bg-primary"
                            : ""
                        }
                      />
                    </SortableHeader>
                  )}
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("packagedAt")}
                    onSort={() => handleColumnSort("packagedAt")}
                  >
                    Date
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("batchName")}
                    onSort={() => handleColumnSort("batchName")}
                  >
                    Batch
                  </SortableHeader>
                  <SortableHeader canSort={false}>
                    Package Type & Size
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("unitsProduced")}
                    onSort={() => handleColumnSort("unitsProduced")}
                  >
                    Units Produced
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("lossPercentage")}
                    onSort={() => handleColumnSort("lossPercentage")}
                  >
                    Loss %
                  </SortableHeader>
                  <SortableHeader canSort={false}>Status</SortableHeader>
                  <SortableHeader canSort={false} className="w-[100px]">
                    Actions
                  </SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {enableSelection && (
                        <TableCell>
                          <Skeleton className="h-4 w-4" />
                        </TableCell>
                      )}
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={enableSelection ? 8 : 7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Package2 className="w-8 h-8 text-muted-foreground/50" />
                        <span>No bottling runs found</span>
                        <span className="text-sm">
                          Bottling runs will appear here once created
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-muted/50 cursor-pointer touch-manipulation"
                      onClick={() => handleItemClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                    >
                      {enableSelection && (
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) =>
                              handleSelectItem(item.id, !!checked)
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select row for ${item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">
                            {formatDateDisplay(item.packagedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {item.batch.name ||
                              `Batch ${item.batchId.slice(0, 8)}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.vessel.name ||
                              `Vessel ${item.vesselId.slice(0, 8)}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3 text-muted-foreground" />
                          <span className="capitalize">
                            {formatPackageSize(
                              item.packageSizeML,
                              item.packageType,
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {item.unitsProduced.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-medium",
                            getLossColor(item.lossPercentage),
                          )}
                        >
                          {item.lossPercentage.toFixed(1)}%
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {item.lossL.toFixed(1)}L
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn("text-xs", getStatusColor(item.status))}
                        >
                          {item.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                          className="h-8 px-3 touch-manipulation min-h-[44px] sm:min-h-[32px]"
                          aria-label={`View details for ${item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && data && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 px-3 md:px-0">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {currentPage * itemsPerPage + 1} to{" "}
                {Math.min((currentPage + 1) * itemsPerPage, totalCount)} of{" "}
                {totalCount} items
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="h-8 px-3 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </Button>
                <span className="text-xs sm:text-sm text-muted-foreground px-2 font-medium">
                  {currentPage + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="h-8 px-3 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export a simplified version for basic usage
export function SimplePackagingTable({
  limit = 10,
  className,
}: {
  limit?: number;
  className?: string;
}) {
  return <PackagingTable className={className} itemsPerPage={limit} />;
}
