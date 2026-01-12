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
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Calendar,
  Loader2,
  MoreVertical,
  Send,
  Beer,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";
import { useToast } from "@/hooks/use-toast";
import { DistributeKegModal } from "./DistributeKegModal";
import { ReturnKegModal } from "./ReturnKegModal";

// Type for keg fill from API
interface KegFill {
  source: 'keg_fill';
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
  status: "completed" | "voided" | "filled" | "distributed" | "returned" | null;
  createdAt: string;
  // Keg-specific fields
  kegId?: string;
  kegNumber?: string | null;
  remainingVolumeL?: number | null;
  // Distribution fields
  distributedAt?: Date | string | null;
  distributionLocation?: string | null;
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
  abvAtPackaging?: number | undefined;
  productionNotes?: string | null;
}

// Table column configuration
type SortField =
  | "packagedAt"
  | "batchName"
  | "kegNumber"
  | "volumeTakenL"
  | "remainingVolumeL";

interface KegsTableProps {
  filters: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
    packageSizeML?: number | null;
    packageType?: string | null;
    batchSearch?: string;
    status?: "active" | "completed";
  };
  onDataChange?: (data: {
    items: KegFill[];
    count: number;
    exportCSV: () => void;
    exportSelectedCSV: (selectedIds: string[]) => void;
    selectedCount: number;
  }) => void;
  enableSelection?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function KegsTable({
  filters,
  onDataChange,
  enableSelection = false,
  selectedItems = [],
  onSelectionChange,
}: KegsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Modals
  const [distributeKegModalOpen, setDistributeKegModalOpen] = useState(false);
  const [selectedKegForDistribution, setSelectedKegForDistribution] = useState<{
    kegFillId: string;
    kegNumber: string;
  } | null>(null);
  const [returnKegModalOpen, setReturnKegModalOpen] = useState(false);
  const [selectedKegForReturn, setSelectedKegForReturn] = useState<{
    kegFillId: string;
    kegNumber: string;
  } | null>(null);

  // Sorting
  const {
    sortState,
    handleSort,
    getSortDirection,
  } = useTableSorting<SortField>({
    multiColumn: false,
    defaultSort: { field: "packagedAt", direction: "desc" },
  });

  const handleColumnSort = useCallback(
    (field: SortField) => {
      handleSort(field);
    },
    [handleSort],
  );

  const getSortDirectionForDisplay = useCallback(
    (field: SortField) => {
      const direction = getSortDirection(field);
      return direction ? direction : "none";
    },
    [getSortDirection],
  );

  // Query
  const queryInput = useMemo(() => {
    const input: any = {
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      sortBy: sortState.columns[0]?.field || "packagedAt",
      sortOrder: sortState.columns[0]?.direction || "desc",
      packageType: "keg", // Only kegs
    };

    if (filters.dateFrom) input.dateFrom = filters.dateFrom.toISOString();
    if (filters.dateTo) input.dateTo = filters.dateTo.toISOString();
    if (filters.packageSizeML) input.packageSizeML = filters.packageSizeML;
    if (filters.batchSearch) input.batchSearch = filters.batchSearch;
    if (filters.status) input.status = filters.status;

    return input;
  }, [currentPage, filters, sortState.columns]);

  const { data, isLoading, refetch } = trpc.packaging.list.useQuery(queryInput);

  const kegFills = useMemo(() => (data?.runs || []) as KegFill[], [data?.runs]);
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Export
  const exportCSV = useCallback(() => {
    const headers = [
      "Date",
      "Batch",
      "Keg Number",
      "Size (L)",
      "Filled (L)",
      "Remaining (L)",
      "Status",
    ];
    const rows = kegFills.map((item) => [
      formatDate(item.packagedAt),
      item.batch.customName || item.batch.name || "N/A",
      item.kegNumber || "N/A",
      (item.packageSizeML / 1000).toFixed(1),
      item.volumeTakenL.toFixed(1),
      (item.remainingVolumeL || 0).toFixed(1),
      item.status || "N/A",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kegs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [kegFills]);

  const exportSelectedCSV = useCallback(
    (selectedIds: string[]) => {
      const selectedRuns = kegFills.filter((item) => selectedIds.includes(item.id));
      const headers = [
        "Date",
        "Batch",
        "Keg Number",
        "Size (L)",
        "Filled (L)",
        "Remaining (L)",
        "Status",
      ];
      const rows = selectedRuns.map((item) => [
        formatDate(item.packagedAt),
        item.batch.customName || item.batch.name || "N/A",
        item.kegNumber || "N/A",
        (item.packageSizeML / 1000).toFixed(1),
        item.volumeTakenL.toFixed(1),
        (item.remainingVolumeL || 0).toFixed(1),
        item.status || "N/A",
      ]);

      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kegs-selected-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [kegFills]
  );

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        items: kegFills,
        count: totalCount,
        exportCSV,
        exportSelectedCSV,
        selectedCount: selectedItems.length,
      });
    }
  }, [kegFills, totalCount, exportCSV, exportSelectedCSV, selectedItems.length, onDataChange]);

  // Selection
  const handleRowSelect = useCallback(
    (itemId: string, checked: boolean) => {
      if (!onSelectionChange) return;
      const newSelection = checked
        ? [...selectedItems, itemId]
        : selectedItems.filter((id) => id !== itemId);
      onSelectionChange(newSelection);
    },
    [selectedItems, onSelectionChange]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) return;
      onSelectionChange(checked ? kegFills.map((item) => item.id) : []);
    },
    [kegFills, onSelectionChange]
  );

  const isAllSelected = enableSelection && kegFills.length > 0 && selectedItems.length === kegFills.length;
  const isSomeSelected = enableSelection && selectedItems.length > 0 && !isAllSelected;

  // Actions
  const handleDistribute = useCallback((item: KegFill, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.id && item.kegNumber) {
      setSelectedKegForDistribution({ kegFillId: item.id, kegNumber: item.kegNumber });
      setDistributeKegModalOpen(true);
    }
  }, []);

  const handleReturn = useCallback((item: KegFill, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.id && item.kegNumber) {
      setSelectedKegForReturn({ kegFillId: item.id, kegNumber: item.kegNumber });
      setReturnKegModalOpen(true);
    }
  }, []);

  const handleRowClick = useCallback(
    (item: KegFill) => {
      router.push(`/keg-fills/${item.id}`);
    },
    [router]
  );

  // Status badge
  const getStatusBadge = (status: string | null) => {
    const statusConfig = {
      filled: { color: "bg-blue-500", label: "Filled" },
      distributed: { color: "bg-green-500", label: "Distributed" },
      returned: { color: "bg-purple-500", label: "Returned" },
      voided: { color: "bg-red-500", label: "Voided" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-500",
      label: status || "Unknown",
    };

    return (
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", config.color)} />
        <span className="text-sm text-gray-700">{config.label}</span>
      </div>
    );
  };

  // Volume percentage
  const getVolumePercentage = (remaining: number | null | undefined, total: number) => {
    if (!remaining || remaining === undefined) return 0;
    return Math.round((remaining / total) * 100);
  };

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="border-b-2 border-gray-300">
                {enableSelection && (
                  <SortableHeader canSort={false} className="w-[50px] font-semibold text-gray-700">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className="border-gray-400"
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
                <SortableHeader
                  sortDirection={getSortDirectionForDisplay("kegNumber")}
                  onSort={() => handleColumnSort("kegNumber")}
                  className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                >
                  Keg Number
                </SortableHeader>
                <SortableHeader canSort={false} className="font-semibold text-gray-700 text-xs uppercase tracking-wide">
                  Size
                </SortableHeader>
                <SortableHeader
                  align="right"
                  sortDirection={getSortDirectionForDisplay("volumeTakenL")}
                  onSort={() => handleColumnSort("volumeTakenL")}
                  className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                >
                  Filled (L)
                </SortableHeader>
                <SortableHeader
                  align="right"
                  sortDirection={getSortDirectionForDisplay("remainingVolumeL")}
                  onSort={() => handleColumnSort("remainingVolumeL")}
                  className="font-semibold text-gray-700 text-xs uppercase tracking-wide"
                >
                  Remaining (L)
                </SortableHeader>
                <SortableHeader canSort={false} className="font-semibold text-gray-700 text-xs uppercase tracking-wide">
                  Status
                </SortableHeader>
                <SortableHeader canSort={false} className="w-[100px] font-semibold text-gray-700 text-xs uppercase tracking-wide">
                  Actions
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
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
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : kegFills.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={enableSelection ? 9 : 8}
                    className="text-center py-12 text-gray-500"
                  >
                    No keg fills found
                  </TableCell>
                </TableRow>
              ) : (
                kegFills.map((item) => {
                  const isSelected = selectedItems.includes(item.id);
                  const volumePercent = getVolumePercentage(item.remainingVolumeL, item.volumeTakenL);

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className={cn(
                        "cursor-pointer hover:bg-gray-50 transition-colors",
                        isSelected && "bg-blue-50 hover:bg-blue-100"
                      )}
                    >
                      {enableSelection && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleRowSelect(item.id, checked as boolean)
                            }
                            aria-label={`Select keg ${item.kegNumber}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {formatDate(item.packagedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {item.batch.customName || item.batch.name || "N/A"}
                          </span>
                          <span className="text-xs text-gray-500">{item.vessel.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Beer className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {item.kegNumber || "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700">
                          {(item.packageSizeML / 1000).toFixed(1)}L
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-mono text-gray-900">
                          {item.volumeTakenL.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-mono text-gray-900">
                            {(item.remainingVolumeL || 0).toFixed(1)}
                          </span>
                          <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                volumePercent > 50 ? "bg-green-500" : volumePercent > 20 ? "bg-yellow-500" : "bg-red-500"
                              )}
                              style={{ width: `${volumePercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/keg-fills/${item.id}`);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleDistribute(item, e)}
                              disabled={item.status === "distributed" || item.status === "returned"}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              {item.status === "distributed" || item.status === "returned" ? "Already Distributed" : "Distribute"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleReturn(item, e)}
                              disabled={item.status !== "distributed"}
                              className={item.status !== "distributed" ? "text-gray-400" : ""}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Return Keg
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} kegs
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards - Similar structure to desktop but in card format */}
      <div className="lg:hidden space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))
        ) : kegFills.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            No keg fills found
          </div>
        ) : (
          kegFills.map((item) => {
            const isSelected = selectedItems.includes(item.id);
            const volumePercent = getVolumePercentage(item.remainingVolumeL, item.volumeTakenL);

            return (
              <div
                key={item.id}
                onClick={() => handleRowClick(item)}
                className={cn(
                  "bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition-colors",
                  isSelected && "bg-blue-50 border-blue-300"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {enableSelection && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleRowSelect(item.id, checked as boolean)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Beer className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {item.kegNumber || "N/A"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.batch.customName || item.batch.name || "N/A"}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/keg-fills/${item.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleDistribute(item, e)}
                        disabled={item.status === "distributed" || item.status === "returned"}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {item.status === "distributed" || item.status === "returned" ? "Already Distributed" : "Distribute"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleReturn(item, e)}
                        disabled={item.status !== "distributed"}
                        className={item.status !== "distributed" ? "text-gray-400" : ""}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Return Keg
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <div className="font-medium">{formatDate(item.packagedAt)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <div className="font-medium">{(item.packageSizeML / 1000).toFixed(1)}L</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Filled:</span>
                    <div className="font-mono">{item.volumeTakenL.toFixed(1)}L</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Remaining:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{(item.remainingVolumeL || 0).toFixed(1)}L</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            volumePercent > 50 ? "bg-green-500" : volumePercent > 20 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${volumePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  {getStatusBadge(item.status)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Distribute Modal */}
      {selectedKegForDistribution && (
        <DistributeKegModal
          open={distributeKegModalOpen}
          onClose={() => {
            setDistributeKegModalOpen(false);
            setSelectedKegForDistribution(null);
          }}
          kegFillId={selectedKegForDistribution.kegFillId}
          kegNumber={selectedKegForDistribution.kegNumber}
          onSuccess={() => {
            refetch();
            toast({
              title: "Success",
              description: "Keg distributed successfully",
            });
          }}
        />
      )}

      {/* Return Modal */}
      {selectedKegForReturn && (
        <ReturnKegModal
          open={returnKegModalOpen}
          onClose={() => {
            setReturnKegModalOpen(false);
            setSelectedKegForReturn(null);
          }}
          kegFillId={selectedKegForReturn.kegFillId}
          kegNumber={selectedKegForReturn.kegNumber}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </>
  );
}
