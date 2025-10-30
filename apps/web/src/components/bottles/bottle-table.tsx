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
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  Eye,
  AlertTriangle,
  Calendar,
  Package2,
  Download,
  Loader2,
  MoreVertical,
  Flame,
  Tag,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";
import { useToast } from "@/hooks/use-toast";
import { LabelModal } from "./LabelModal";

// Type for bottling run from API
interface PackagingRun {
  id: string;
  batchId: string;
  vesselId: string;
  packagedAt: string;
  packageType: string;
  packageSizeML: number;
  packagingMaterialName: string | null;
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
    customName: string | null;
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
  // Toast for notifications
  const { toast } = useToast();

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

  // Label modal state
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedBottleRun, setSelectedBottleRun] = useState<PackagingRun | null>(null);

  // Mutations
  const utils = trpc.useUtils();
  const markCompleteMutation = trpc.bottles.markComplete.useMutation({
    onSuccess: () => {
      utils.bottles.list.invalidate();
      toast({
        title: "Success",
        description: "Bottle run marked as complete. Items are now in inventory.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark bottle run as complete",
        variant: "destructive",
      });
    },
  });

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
          return item.batch.customName || item.batch.name || "";
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

  // Action handlers
  const handlePasteurize = useCallback((item: PackagingRun, e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement pasteurize action
    console.log("Pasteurize bottle run:", item.id);
  }, []);

  const handleLabel = useCallback((item: PackagingRun, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBottleRun(item);
    setLabelModalOpen(true);
  }, []);

  const handleMarkComplete = useCallback((item: PackagingRun, e: React.MouseEvent) => {
    e.stopPropagation();

    if (item.status === "completed") {
      toast({
        title: "Already Complete",
        description: "This bottle run is already marked as complete.",
      });
      return;
    }

    markCompleteMutation.mutate({ runId: item.id });
  }, [markCompleteMutation, toast]);

  // Label modal handlers
  const handleLabelModalClose = useCallback(() => {
    setLabelModalOpen(false);
    setSelectedBottleRun(null);
  }, []);

  const handleLabelSuccess = useCallback(() => {
    // The modal will handle invalidation, just close
    setLabelModalOpen(false);
    setSelectedBottleRun(null);
  }, []);

  // Format package size display
  const formatPackageSize = useCallback(
    (sizeML: number, packageType: string, materialName?: string | null) => {
      // Use the packaging material name if available (e.g., "750ml Glass Bottles")
      if (materialName) {
        return materialName;
      }
      // Fall back to constructed name
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
      if (filters?.status)
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
        item.batch.customName || item.batch.name || `Batch ${item.batchId.slice(0, 8)}`,
        item.vessel.name || `Vessel ${item.vesselId.slice(0, 8)}`,
        item.packageType,
        formatPackageSize(item.packageSizeML, item.packageType, item.packagingMaterialName),
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
    <div className={cn("space-y-4", className)}>
      {/* Table Header - Compact */}
      <div className="flex items-center justify-between py-3 px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">
            {totalCount > 0
              ? `${totalCount} Bottling Run${totalCount !== 1 ? "s" : ""}`
              : "No Bottling Runs"}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-8 text-gray-600 hover:text-gray-900"
        >
          Refresh
        </Button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-0">
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
                    aria-label={`View details for ${item.batch.customName || item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
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
                          {item.batch.customName || item.batch.name ||
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
                            aria-label={`Select ${item.batch.customName || item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
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
                            item.packagingMaterialName,
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handlePasteurize(item, e)}
                            >
                              <Flame className="mr-2 h-4 w-4" />
                              Pasteurize
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleLabel(item, e)}
                            >
                              <Tag className="mr-2 h-4 w-4" />
                              Label
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handleMarkComplete(item, e)}
                              disabled={item.status === "completed"}
                              className={cn(
                                item.status === "completed"
                                  ? "opacity-50 cursor-not-allowed"
                                  : "text-green-600 focus:text-green-600"
                              )}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {item.status === "completed" ? "Already Complete" : "Mark as Complete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-b-2 border-gray-300">
                  {enableSelection && (
                    <SortableHeader canSort={false} className="w-[50px] font-semibold text-gray-700">
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
                    className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                  >
                    Date
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("batchName")}
                    onSort={() => handleColumnSort("batchName")}
                    className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                  >
                    Batch
                  </SortableHeader>
                  <SortableHeader canSort={false} className="font-semibold text-gray-700 text-xs uppercase tracking-wide">
                    Container
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("unitsProduced")}
                    onSort={() => handleColumnSort("unitsProduced")}
                    className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                  >
                    Units
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("lossPercentage")}
                    onSort={() => handleColumnSort("lossPercentage")}
                    className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                  >
                    Loss
                  </SortableHeader>
                  <SortableHeader canSort={false} className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Status</SortableHeader>
                  <SortableHeader canSort={false} className="w-[100px] font-semibold text-gray-700 text-xs uppercase tracking-wide">
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
                  sortedItems.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer transition-colors border-b border-gray-100",
                        index % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/30 hover:bg-blue-50/30"
                      )}
                      onClick={() => handleItemClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.batch.customName || item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                    >
                      {enableSelection && (
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) =>
                              handleSelectItem(item.id, !!checked)
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select row for ${item.batch.customName || item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">
                            {formatDateDisplay(item.packagedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-blue-900 text-sm hover:text-blue-700 transition-colors">
                            {item.batch.customName || item.batch.name ||
                              `Batch ${item.batchId.slice(0, 8)}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.vessel.name ||
                              `Vessel ${item.vesselId.slice(0, 8)}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">
                            {formatPackageSize(
                              item.packageSizeML,
                              item.packageType,
                              item.packagingMaterialName,
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="font-mono font-semibold text-sm text-gray-900">
                          {item.unitsProduced.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className={cn(
                              "font-semibold text-sm",
                              getLossColor(item.lossPercentage),
                            )}
                          >
                            {item.lossPercentage.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            {item.lossL.toFixed(1)}L
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              item.status === "completed" ? "bg-green-500" :
                              item.status === "voided" ? "bg-red-500" :
                              "bg-gray-400"
                            )}
                          />
                          <span className={cn(
                            "text-xs font-medium capitalize",
                            item.status === "completed" ? "text-green-700" :
                            item.status === "voided" ? "text-red-700" :
                            "text-gray-600"
                          )}>
                            {item.status || "active"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handlePasteurize(item, e)}
                            >
                              <Flame className="mr-2 h-4 w-4" />
                              Pasteurize
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleLabel(item, e)}
                            >
                              <Tag className="mr-2 h-4 w-4" />
                              Label
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handleMarkComplete(item, e)}
                              disabled={item.status === "completed"}
                              className={cn(
                                item.status === "completed"
                                  ? "opacity-50 cursor-not-allowed"
                                  : "text-green-600 focus:text-green-600"
                              )}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {item.status === "completed" ? "Already Complete" : "Mark as Complete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && data && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Showing {currentPage * itemsPerPage + 1} to{" "}
                {Math.min((currentPage + 1) * itemsPerPage, totalCount)} of{" "}
                {totalCount} runs
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
                <span className="text-xs sm:text-sm text-gray-700 px-2 font-semibold">
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
        </div>
      </div>

      {/* Label Modal */}
      {selectedBottleRun && (
        <LabelModal
          open={labelModalOpen}
          onClose={handleLabelModalClose}
          bottleRunId={selectedBottleRun.id}
          bottleRunName={
            selectedBottleRun.batch.customName ||
            selectedBottleRun.batch.name ||
            `Batch ${selectedBottleRun.batchId.slice(0, 8)}`
          }
          unitsProduced={selectedBottleRun.unitsProduced}
          onSuccess={handleLabelSuccess}
        />
      )}
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
