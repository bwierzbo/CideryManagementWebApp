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
  RefreshCw,
  BarChart3,
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
import { PriceHistoryModal } from "./PriceHistoryModal";

// Type for basefruit purchase item from API
interface BaseFruitPurchaseItem {
  id: string;
  purchaseId: string;
  vendorName: string;
  varietyName: string;
  fruitVarietyId?: string;
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
  onEdit?: (item: BaseFruitPurchaseItem) => void;
}

export function BaseFruitTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
  onAddNew,
  onEdit,
}: BaseFruitTableProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"all" | "needsReorder" | "low" | "out">("all");
  const [deleteItem, setDeleteItem] = useState<BaseFruitPurchaseItem | null>(
    null,
  );
  const [priceHistoryItem, setPriceHistoryItem] = useState<{
    varietyId: string;
    varietyName: string;
  } | null>(null);

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

  // API queries - using baseFruitPurchases.listItems for individual editable items
  const {
    data: listData,
    isLoading,
    error,
    refetch,
  } = trpc.baseFruitPurchases.listItems.useQuery({
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
  });

  // Fetch inventory levels for stock status indicators
  const { data: inventoryLevels } = trpc.purchase.inventoryLevels.useQuery({
    materialType: "basefruit",
  });

  // Create a lookup map for stock status by variety ID
  const stockStatusMap = useMemo(() => {
    const map = new Map<
      string,
      { status: "healthy" | "low" | "out"; remaining: number }
    >();
    inventoryLevels?.forEach((level) => {
      map.set(level.varietyId, {
        status: level.stockStatus,
        remaining: level.remaining,
      });
    });
    return map;
  }, [inventoryLevels]);

  // Delete mutation
  const deleteMutation = trpc.baseFruitPurchases.deleteItem.useMutation({
    onSuccess: () => {
      setDeleteItem(null);
      refetch();
    },
    onError: (error) => {
      console.error("Error deleting item:", error);
      // Handle error (could show toast notification)
    },
  });

  // Map items to table format
  const baseFruitItems = useMemo(() => {
    if (!listData?.items) return [];

    return listData.items.map((item: any) => {
      return {
        id: item.id,
        purchaseId: item.purchaseId || "",
        vendorName: item.vendorName || "Unknown Vendor",
        varietyName: item.varietyName || "Unknown Variety",
        fruitVarietyId: item.fruitVarietyId || item.varietyId,
        harvestDate: item.harvestDate || null,
        originalQuantity: parseFloat(item.quantity) || 0,
        originalUnit: item.unit || "lb",
        pricePerUnit: item.pricePerUnit ? parseFloat(item.pricePerUnit) : null,
        totalCost: item.totalCost ? parseFloat(item.totalCost) : null,
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

    // Apply stock status filter
    if (stockFilter !== "all") {
      filtered = filtered.filter((item) => {
        const stockInfo = item.fruitVarietyId
          ? stockStatusMap.get(item.fruitVarietyId)
          : null;

        if (!stockInfo) return false;

        if (stockFilter === "needsReorder") {
          // Show items that are low or out
          return stockInfo.status === "low" || stockInfo.status === "out";
        } else {
          // Show items matching the specific status
          return stockInfo.status === stockFilter;
        }
      });
    }

    return filtered;
  }, [baseFruitItems, searchQuery, stockFilter, stockStatusMap]);

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
  }, [filteredItems, sortData, sortState.columns]);

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
        itemId: deleteItem.id,
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

                    {/* Stock Status Filter */}
                    <div className="w-full lg:w-[200px]">
                      <Label htmlFor="stockFilter">Stock Status</Label>
                      <Select
                        value={stockFilter}
                        onValueChange={(value) =>
                          setStockFilter(
                            value as "all" | "needsReorder" | "low" | "out",
                          )
                        }
                      >
                        <SelectTrigger id="stockFilter">
                          <SelectValue placeholder="All Items" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Items</SelectItem>
                          <SelectItem value="needsReorder">
                            🔔 Needs Reorder
                          </SelectItem>
                          <SelectItem value="low">⚡ Low Stock</SelectItem>
                          <SelectItem value="out">⚠️ Out of Stock</SelectItem>
                        </SelectContent>
                      </Select>
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
        {/* Compact Header */}
        <div className="flex items-center justify-between py-3 px-6 border-b">
          <div className="flex items-center gap-3">
            <Apple className="w-4 h-4 text-red-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {sortedItems.length > 0
                ? `${sortedItems.length} Purchase${sortedItems.length !== 1 ? "s" : ""}`
                : "No Purchases"}
            </h2>
            {sortState.columns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllSort}
                className="h-7 px-2 text-xs text-gray-600"
              >
                <X className="w-3 h-3 mr-1" />
                Clear Sort
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        <CardContent className="p-0">
          {error && (
            <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 m-4 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span>Error loading base fruit purchases: {error.message}</span>
            </div>
          )}

          <div className="border-0">
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
                  <SortableHeader canSort={false} className="w-[100px]">
                    Stock
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
                        <Skeleton className="h-6 w-16" />
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
                    <TableCell colSpan={8} className="text-center py-12">
                      {searchQuery ? (
                        <div className="text-muted-foreground">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No purchases match your search criteria</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Apple className="w-12 h-12 mx-auto text-red-400" />
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              No base fruit purchases yet
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Track apples and other base fruits for pressing and
                              production
                            </p>
                            {onAddNew && (
                              <Button
                                onClick={onAddNew}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Purchase
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => {
                    const stockInfo = item.fruitVarietyId
                      ? stockStatusMap.get(item.fruitVarietyId)
                      : null;
                    const stockStatus = stockInfo?.status || "healthy";

                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleItemClick(item)}
                      >
                        <TableCell>
                          <div className="font-medium">{item.varietyName}</div>
                        </TableCell>
                        <TableCell>
                          {stockInfo ? (
                            <Badge
                              variant={
                                stockStatus === "out"
                                  ? "destructive"
                                  : stockStatus === "low"
                                    ? "secondary"
                                    : "default"
                              }
                              className={cn(
                                "text-xs font-medium",
                                stockStatus === "healthy" &&
                                  "bg-green-100 text-green-800 hover:bg-green-100",
                                stockStatus === "low" &&
                                  "bg-orange-100 text-orange-800 hover:bg-orange-100",
                              )}
                            >
                              {stockStatus === "out" && "⚠️ Out"}
                              {stockStatus === "low" && "⚡ Low"}
                              {stockStatus === "healthy" && "✓ Good"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setPriceHistoryItem({
                                  varietyId: item.fruitVarietyId || "",
                                  varietyName: item.varietyName,
                                });
                              }}
                            >
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Price History
                            </DropdownMenuItem>
                            {onEdit && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(item);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination info */}
          {sortedItems.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
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

      {/* Price History Modal */}
      <PriceHistoryModal
        open={!!priceHistoryItem}
        onOpenChange={(open) => !open && setPriceHistoryItem(null)}
        materialType="basefruit"
        varietyId={priceHistoryItem?.varietyId || ""}
        varietyName={priceHistoryItem?.varietyName || ""}
      />
    </div>
  );
}
