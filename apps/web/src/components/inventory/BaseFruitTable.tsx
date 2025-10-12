"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Package,
  AlertTriangle,
  ExternalLink,
  X,
  Apple,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Type for basefruit purchase item from API
interface BaseFruitPurchaseItem {
  id: string;
  purchaseId: string;
  vendorName: string;
  varietyName: string;
  harvestDate: string | null;
  originalQuantity: number;
  originalUnit: string;
  pricePerUnit: number | null;
  totalCost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Table column configuration
type SortField =
  | "varietyName"
  | "vendorName"
  | "harvestDate"
  | "originalQuantity"
  | "createdAt";

interface BaseFruitTableProps {
  showFilters?: boolean;
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: BaseFruitPurchaseItem) => void;
  onAddNew?: () => void;
}

export function BaseFruitTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
  onAddNew,
}: BaseFruitTableProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<BaseFruitPurchaseItem | null>(
    null,
  );

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
    defaultSort: { field: "harvestDate", direction: "desc" },
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Router for navigation
  const router = useRouter();

  // Calculate API parameters
  const apiParams = useMemo(
    () => ({
      searchQuery: searchQuery.trim() || undefined,
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage,
    }),
    [searchQuery, itemsPerPage, currentPage],
  );

  // API queries - using inventory.list for now, will create specialized endpoint later
  const {
    data: listData,
    isLoading,
    error,
    refetch,
  } = trpc.inventory.list.useQuery({
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
  });

  // Delete mutation
  const deleteMutation = trpc.inventory.deleteItem.useMutation({
    onSuccess: () => {
      setDeleteItem(null);
      refetch();
    },
    onError: (error) => {
      console.error("Error deleting item:", error);
      // Handle error (could show toast notification)
    },
  });

  // Filter items to only show apple/basefruit items
  const baseFruitItems = useMemo(() => {
    if (!listData?.items) return [];

    return listData.items
      .filter((item: any) => item.materialType === "apple")
      .map((item: any) => {
        const metadata = (item.metadata as any) || {};
        return {
          id: item.id,
          purchaseId: metadata.purchaseId || "",
          vendorName: metadata.vendorName || "Unknown Vendor",
          varietyName: metadata.varietyName || "Unknown Variety",
          harvestDate: metadata.harvestDate || null,
          originalQuantity: item.currentBottleCount,
          originalUnit: metadata.unit || "lb",
          pricePerUnit: null, // TODO: Add to metadata
          totalCost: null, // TODO: Add to metadata
          notes: item.notes,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        } as BaseFruitPurchaseItem;
      });
  }, [listData]);

  // Apply client-side filtering
  const filteredItems = useMemo(() => {
    let filtered = baseFruitItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          item.varietyName.toLowerCase().includes(query) ||
          item.vendorName.toLowerCase().includes(query) ||
          (item.notes && item.notes.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [baseFruitItems, searchQuery]);

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    return sortData(filteredItems, (item: any, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "varietyName":
          return item.varietyName;
        case "vendorName":
          return item.vendorName;
        case "harvestDate":
          return item.harvestDate ? new Date(item.harvestDate) : new Date(0);
        case "originalQuantity":
          return item.originalQuantity;
        case "createdAt":
          return new Date(item.createdAt);
        default:
          return (item as any)[field];
      }
    });
  }, [filteredItems, sortData]);

  // Event handlers
  const handleColumnSort = useCallback(
    (field: SortField) => {
      handleSort(field);
    },
    [handleSort],
  );

  const handleItemClick = useCallback(
    (item: BaseFruitPurchaseItem) => {
      if (onItemClick) {
        onItemClick(item);
      } else {
        // Default navigation to item detail page
        router.push(`/inventory/${item.id}`);
      }
    },
    [onItemClick, router],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (deleteItem) {
      deleteMutation.mutate({
        id: deleteItem.id,
        itemType: "basefruit",
      });
    }
  }, [deleteItem, deleteMutation]);

  // Get sort direction for display
  const getSortDirectionForDisplay = useCallback(
    (field: SortField) => {
      const direction = getSortDirection(field);
      return direction ? direction : "none";
    },
    [getSortDirection],
  );

  // Get sort index for multi-column sorting display
  const getSortIndex = useCallback(
    (field: SortField) => {
      const columnIndex = sortState.columns.findIndex(
        (col) => col.field === field,
      );
      return columnIndex >= 0 ? columnIndex : undefined;
    },
    [sortState.columns],
  );

  const formatDateDisplay = (dateString: string | null) => {
    if (!dateString) return "—";
    return formatDate(dateString);
  };

  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity.toLocaleString()} ${unit}`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filters and Add Button */}
      {(showFilters || onAddNew) && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
              <div className="flex flex-col lg:flex-row gap-4 flex-1">
                {showFilters && (
                  <>
                    {/* Search */}
                    <div className="flex-1 min-w-0">
                      <Label htmlFor="search">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="search"
                          placeholder="Search varieties, vendors, or notes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Add Button */}
              {onAddNew && (
                <Button
                  onClick={onAddNew}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Base Fruit Purchase
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Apple className="w-5 h-5" />
                Base Fruit Purchases
              </CardTitle>
              <div className="flex items-center gap-4">
                <CardDescription>
                  {sortedItems.length > 0
                    ? `${sortedItems.length} purchases found`
                    : "No purchases found"}
                </CardDescription>
                {sortState.columns.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Sorted by {sortState.columns[0]?.field} (
                      {sortState.columns[0]?.direction})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllSort}
                      className="h-6 px-2 py-0 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span>Error loading base fruit purchases: {error.message}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("varietyName")}
                    sortIndex={getSortIndex("varietyName")}
                    onSort={() => handleColumnSort("varietyName")}
                  >
                    Fruit Variety
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("vendorName")}
                    sortIndex={getSortIndex("vendorName")}
                    onSort={() => handleColumnSort("vendorName")}
                  >
                    Vendor
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("harvestDate")}
                    sortIndex={getSortIndex("harvestDate")}
                    onSort={() => handleColumnSort("harvestDate")}
                  >
                    Harvest Date
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay(
                      "originalQuantity",
                    )}
                    sortIndex={getSortIndex("originalQuantity")}
                    onSort={() => handleColumnSort("originalQuantity")}
                  >
                    Quantity
                  </SortableHeader>
                  <SortableHeader canSort={false}>Notes</SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("createdAt")}
                    sortIndex={getSortIndex("createdAt")}
                    onSort={() => handleColumnSort("createdAt")}
                  >
                    Purchase Date
                  </SortableHeader>
                  <SortableHeader canSort={false} className="w-[50px]">
                    Actions
                  </SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchQuery
                        ? "No purchases match your search criteria"
                        : "No base fruit purchases found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell>
                        <div className="font-medium">{item.varietyName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.vendorName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>{formatDateDisplay(item.harvestDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatQuantity(
                          item.originalQuantity,
                          item.originalUnit,
                        )}
                      </TableCell>
                      <TableCell>
                        {item.notes ? (
                          <div className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                            {item.notes}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDateDisplay(item.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteItem(item);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
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

          {/* Pagination info */}
          {sortedItems.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {sortedItems.length} of {baseFruitItems.length} base
                fruit purchases
                {searchQuery.trim() &&
                  ` (filtered from ${baseFruitItems.length} total)`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Base Fruit Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deleteItem
                ? `${deleteItem.varietyName} from ${deleteItem.vendorName}`
                : ""}
              &rdquo;? This action cannot be undone and will permanently remove
              this purchase from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
