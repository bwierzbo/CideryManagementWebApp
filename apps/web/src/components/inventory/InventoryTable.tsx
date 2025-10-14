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
import {
  Calendar,
  Package,
  AlertTriangle,
  ExternalLink,
  Edit,
  MoreVertical,
  X,
  Trash2,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { MaterialTypeIndicator } from "./MaterialTypeIndicator";
import { InventorySearch } from "./InventorySearch";
import { InventoryFilters } from "./InventoryFilters";
import { InventoryEditDialog } from "./InventoryEditDialog";
import { TransferToTankModal } from "@/components/juice/TransferToTankModal";
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
import type {
  MaterialType,
  InventoryFiltersState,
  SearchCallback,
  FilterCallback,
} from "@/types/inventory";

// Type for inventory item from API
interface InventoryItem {
  id: string;
  packageId?: string | null;
  currentBottleCount: number;
  reservedBottleCount: number;
  materialType?: MaterialType; // TODO: Make required after database migration
  metadata?: unknown;
  location?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Table column configuration
type SortField =
  | "materialType"
  | "item"
  | "vendor"
  | "currentBottleCount"
  | "createdAt"
  | "updatedAt";

interface InventoryTableProps {
  showSearch?: boolean;
  showFilters?: boolean;
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: InventoryItem) => void;
}

export function InventoryTable({
  showSearch = true,
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
}: InventoryTableProps) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [transferItem, setTransferItem] = useState<InventoryItem | null>(null);
  const [filters, setFilters] = useState<InventoryFiltersState>({
    materialTypes: [],
    location: "all",
    status: "all",
    isActive: true,
  });

  // Sorting state using the reusable hook
  const {
    sortState,
    handleSort,
    getSortDirection,
    getSortIcon,
    sortData,
    clearAllSort,
  } = useTableSorting<SortField>({
    multiColumn: true,
    defaultSort: undefined,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Router for navigation
  const router = useRouter();

  // Calculate API parameters
  const apiParams = useMemo(
    () => ({
      materialType:
        filters.materialTypes.length === 1
          ? filters.materialTypes[0]
          : undefined,
      location: filters.location !== "all" ? filters.location : undefined,
      isActive: filters.isActive,
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage,
    }),
    [filters, itemsPerPage, currentPage],
  );

  // Search API parameters
  const searchParams = useMemo(
    () => ({
      query: searchQuery,
      materialTypes:
        filters.materialTypes.length > 0 ? filters.materialTypes : undefined,
      limit: itemsPerPage,
    }),
    [searchQuery, filters.materialTypes, itemsPerPage],
  );

  // API query (no separate search endpoint - filter client-side)
  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList,
  } = trpc.inventory.list.useQuery(apiParams);

  // Delete mutation
  const deleteMutation = trpc.inventory.deleteItem.useMutation({
    onSuccess: () => {
      setDeleteItem(null);
      refetchList();
    },
    onError: (error) => {
      console.error("Error deleting item:", error);
      // Handle error (could show toast notification)
    },
  });

  // Derived state with client-side search filtering
  const isLoading = isListLoading;
  const error = listError;
  const allItems = useMemo(() => listData?.items || [], [listData?.items]);

  // Client-side search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;

    const query = searchQuery.toLowerCase();
    return allItems.filter((item: any) => {
      const varietyName = item.metadata?.varietyName?.toLowerCase() || '';
      const vendorName = item.metadata?.vendorName?.toLowerCase() || '';
      const productName = item.metadata?.productName?.toLowerCase() || '';
      const brandManufacturer = item.metadata?.brandManufacturer?.toLowerCase() || '';
      const juiceType = item.metadata?.juiceType?.toLowerCase() || '';
      const notes = item.notes?.toLowerCase() || '';

      return (
        varietyName.includes(query) ||
        vendorName.includes(query) ||
        productName.includes(query) ||
        brandManufacturer.includes(query) ||
        juiceType.includes(query) ||
        notes.includes(query)
      );
    });
  }, [allItems, searchQuery]);

  const items = filteredItems;
  const totalCount = listData?.pagination?.total || 0;
  const hasMore = listData?.pagination?.hasMore || false;

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    return sortData(items, (item: any, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "materialType":
          return item.materialType;
        case "item":
          return getItemDisplayName(item);
        case "vendor":
          return getVendorName(item);
        case "currentBottleCount":
          return item.currentBottleCount;
        case "createdAt":
          return new Date(item.createdAt);
        case "updatedAt":
          return new Date(item.updatedAt);
        default:
          return (item as any)[field];
      }
    });
  }, [items, sortData]);

  // Event handlers
  const handleSearch: SearchCallback = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(0); // Reset pagination when searching
  }, []);

  const handleFiltersChange: FilterCallback = useCallback(
    (newFilters: Partial<InventoryFiltersState>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setCurrentPage(0); // Reset pagination when filtering
    },
    [],
  );

  // Sort handler is provided by the hook
  const handleColumnSort = useCallback(
    (field: SortField) => {
      handleSort(field);
    },
    [handleSort],
  );

  const handleItemClick = useCallback(
    (item: InventoryItem) => {
      if (onItemClick) {
        onItemClick(item);
      }
      // No default navigation - clicking on row does nothing unless onItemClick is provided
    },
    [onItemClick],
  );

  const handleRefresh = useCallback(() => {
    refetchList();
  }, [refetchList]);

  // Get unit from metadata
  const getUnit = (item: InventoryItem) => {
    const metadata = (item.metadata as Record<string, any>) || {};
    return metadata.unit || "units";
  };

  // Get formatted quantity with unit
  const getQuantityWithUnit = (item: InventoryItem) => {
    const unit = getUnit(item);
    const quantity = item.currentBottleCount;
    return `${quantity.toLocaleString()} ${unit}`;
  };

  // Get display name for item
  const getItemDisplayName = (item: InventoryItem) => {
    if (item.packageId) {
      return `Package ${item.packageId}`;
    }

    const metadata = (item.metadata as Record<string, any>) || {};
    switch (item.materialType) {
      case "apple":
        // For basefruit purchase items being shown as inventory
        if (metadata.varietyName) {
          return `${metadata.varietyName} Apples`;
        }
        return (
          metadata.additiveName || metadata.appleVarietyId || "Apple Inventory"
        );
      case "additive":
        // For additive purchase items
        // Check if brandManufacturer is a UUID (36 chars with dashes in specific positions)
        const isUUID = (str: string) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };

        if (metadata.productName) {
          return metadata.productName;
        }
        if (metadata.additiveType) {
          return `${metadata.additiveType} Additive`;
        }
        return metadata.additiveName || "Additive Inventory";
      case "juice":
        // For juice purchase items
        if (metadata.varietyName) {
          // If varietyName already contains "Juice", don't add it again
          return metadata.varietyName.toLowerCase().includes("juice")
            ? metadata.varietyName
            : `${metadata.varietyName} Juice`;
        }
        if (metadata.juiceType) {
          return `${metadata.juiceType} Juice`;
        }
        return metadata.vessellId || metadata.pressRunId || "Juice Inventory";
      case "packaging":
        // For packaging purchase items - just show the size/name
        if (metadata.size) {
          return metadata.size;
        }
        if (metadata.packageType) {
          return metadata.packageType;
        }
        return metadata.packagingName || "Packaging Inventory";
      default:
        return "Inventory Item";
    }
  };

  // Get vendor name from metadata
  const getVendorName = (item: InventoryItem) => {
    const metadata = (item.metadata as Record<string, any>) || {};
    return metadata.vendorName || "-";
  };

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

  // Helper function to determine item type from ID
  const getItemType = (
    id: string,
  ): "basefruit" | "additive" | "juice" | "packaging" => {
    if (id.startsWith("basefruit-")) return "basefruit";
    if (id.startsWith("additive-")) return "additive";
    if (id.startsWith("juice-")) return "juice";
    if (id.startsWith("packaging-")) return "packaging";
    return "basefruit"; // fallback
  };

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (deleteItem) {
      const itemType = getItemType(deleteItem.id);
      deleteMutation.mutate({
        id: deleteItem.id,
        itemType,
      });
    }
  }, [deleteItem, deleteMutation]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {showSearch && (
                <InventorySearch
                  onSearch={handleSearch}
                  placeholder="Search inventory items..."
                  className="max-w-md"
                />
              )}
              {showFilters && (
                <InventoryFilters
                  onFiltersChange={handleFiltersChange}
                  initialFilters={filters}
                />
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
                <Package className="w-5 h-5" />
                Inventory Items
              </CardTitle>
              <div className="flex items-center gap-4">
                <CardDescription>
                  {totalCount > 0
                    ? `${totalCount} items found`
                    : "No items found"}
                </CardDescription>
                {sortState.columns.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Sorted by {sortState.columns.length} column
                      {sortState.columns.length === 1 ? "" : "s"}
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
              <span>Error loading inventory: {error.message}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("materialType")}
                    sortIndex={getSortIndex("materialType")}
                    onSort={() => handleColumnSort("materialType")}
                  >
                    Type
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("item")}
                    sortIndex={getSortIndex("item")}
                    onSort={() => handleColumnSort("item")}
                  >
                    Item
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("vendor")}
                    sortIndex={getSortIndex("vendor")}
                    onSort={() => handleColumnSort("vendor")}
                  >
                    Vendor
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay(
                      "currentBottleCount",
                    )}
                    sortIndex={getSortIndex("currentBottleCount")}
                    onSort={() => handleColumnSort("currentBottleCount")}
                  >
                    Available
                  </SortableHeader>
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
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-24 ml-auto" />
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
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchQuery
                        ? "No items match your search"
                        : "No inventory items found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell>
                        <MaterialTypeIndicator
                          materialType={item.materialType || "apple"}
                          variant="compact"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {getItemDisplayName(item)}
                          </div>
                          {item.notes && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{getVendorName(item)}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {getQuantityWithUnit(item)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDate(item.createdAt)}
                          </span>
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
                            {item.materialType === "juice" && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTransferItem(item);
                                  }}
                                >
                                  <Droplets className="mr-2 h-4 w-4" />
                                  Transfer to Tank
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditItem(item);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
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

          {/* Pagination for list view */}
          {!useSearch && listData?.pagination && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * itemsPerPage + 1} to{" "}
                {Math.min((currentPage + 1) * itemsPerPage, totalCount)} of{" "}
                {totalCount} items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editItem && (
        <InventoryEditDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          item={editItem}
          onSuccess={() => {
            setEditItem(null);
            if (useSearch) {
              refetchSearch();
            } else {
              refetchList();
            }
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deleteItem ? getItemDisplayName(deleteItem) : ""}&rdquo;? This
              action cannot be undone and will permanently remove this item from
              your inventory.
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

      {/* Transfer to Tank Modal */}
      {transferItem && transferItem.materialType === "juice" && (
        <TransferToTankModal
          open={!!transferItem}
          onClose={() => setTransferItem(null)}
          juicePurchaseItemId={(transferItem.metadata as any)?.itemId || ""}
          juiceLabel={getItemDisplayName(transferItem)}
          availableVolumeL={Number(transferItem.currentBottleCount) || 0}
          onSuccess={() => {
            setTransferItem(null);
            if (useSearch) {
              refetchSearch();
            } else {
              refetchList();
            }
          }}
        />
      )}
    </div>
  );
}

// Export a simplified version for basic usage
export function SimpleInventoryTable({
  materialType,
  limit = 20,
  className,
}: {
  materialType?: MaterialType;
  limit?: number;
  className?: string;
}) {
  return (
    <InventoryTable
      showSearch={false}
      showFilters={false}
      className={className}
      itemsPerPage={limit}
    />
  );
}
