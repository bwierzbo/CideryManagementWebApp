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
  Calendar,
  AlertTriangle,
  ExternalLink,
  X,
  Beaker,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit as EditIcon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";
import { toast } from "@/hooks/use-toast";
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

// Type for additive inventory item from API
interface AdditiveInventoryItem {
  id: string;
  packageId: string | null;
  currentBottleCount: number;
  reservedBottleCount: number;
  materialType: string;
  metadata: {
    purchaseId: string;
    vendorName: string;
    varietyName: string;
    varietyType: string;
    brandManufacturer: string;
    productName: string;
    unit: string;
    unitCost?: string | null;
    totalCost?: string;
    purchaseDate: string;
  };
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Table column configuration
type SortField =
  | "productName"
  | "vendorName"
  | "varietyType"
  | "quantity"
  | "createdAt";

interface AdditivesInventoryTableProps {
  showFilters?: boolean;
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: AdditiveInventoryItem) => void;
  onAddNew?: () => void;
  onEdit?: (item: AdditiveInventoryItem) => void;
}

export function AdditivesInventoryTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
  onAddNew,
  onEdit,
}: AdditivesInventoryTableProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<AdditiveInventoryItem | null>(
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
    defaultSort: { field: "createdAt", direction: "desc" },
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Router for navigation
  const router = useRouter();

  // API queries - using inventory.list with materialType filter
  const {
    data: inventoryData,
    isLoading,
    error,
    refetch,
  } = trpc.inventory.list.useQuery({
    limit: 100, // Max allowed by API
    offset: 0,
  });

  // Transform and filter inventory data to show only additives
  const additiveItems = useMemo(() => {
    if (!inventoryData?.items) return [];

    // Filter for additive items only
    const items = inventoryData.items
      .filter((item: any) => item.materialType === "additive")
      .map(
        (item: any) =>
          ({
            id: item.id,
            packageId: item.packageId,
            currentBottleCount: item.currentBottleCount,
            reservedBottleCount: item.reservedBottleCount,
            materialType: item.materialType,
            metadata: item.metadata || {},
            location: item.location,
            notes: item.notes,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }) as AdditiveInventoryItem,
      );

    return items;
  }, [inventoryData]);

  // Apply client-side filtering
  const filteredItems = useMemo(() => {
    let filtered = additiveItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          item.metadata?.productName?.toLowerCase().includes(query) ||
          item.metadata?.vendorName?.toLowerCase().includes(query) ||
          item.metadata?.varietyName?.toLowerCase().includes(query) ||
          item.metadata?.varietyType?.toLowerCase().includes(query) ||
          item.metadata?.brandManufacturer?.toLowerCase().includes(query) ||
          (item.notes && item.notes.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [additiveItems, searchQuery]);

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    return sortData(filteredItems, (item: any, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "productName":
          return item.metadata?.productName || "";
        case "vendorName":
          return item.metadata?.vendorName || "";
        case "varietyType":
          return item.metadata?.varietyType || "";
        case "quantity":
          return item.currentBottleCount || 0;
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
    (item: AdditiveInventoryItem) => {
      if (onItemClick) {
        onItemClick(item);
      }
      // No navigation - just call the handler if provided
    },
    [onItemClick],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (deleteItem) {
      // TODO: Implement delete functionality
      console.log("Delete additive item:", deleteItem.id);
      setDeleteItem(null);
    }
  }, [deleteItem]);

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

  const getAdditiveTypeBadge = (type: string) => {
    const colors = {
      enzyme: "bg-green-100 text-green-800",
      nutrient: "bg-blue-100 text-blue-800",
      clarifier: "bg-yellow-100 text-yellow-800",
      preservative: "bg-red-100 text-red-800",
      acid: "bg-orange-100 text-orange-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[type as keyof typeof colors] || colors.other;
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
                          placeholder="Search products, vendors, types, or notes..."
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
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Additives Purchase
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
            <Beaker className="w-4 h-4 text-purple-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {sortedItems.length > 0
                ? `${sortedItems.length} Additive${sortedItems.length !== 1 ? "s" : ""}`
                : "No Additives"}
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
              <span>Error loading additives inventory: {error.message}</span>
            </div>
          )}

          <div className="border-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("productName")}
                    sortIndex={getSortIndex("productName")}
                    onSort={() => handleColumnSort("productName")}
                  >
                    Item
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("vendorName")}
                    sortIndex={getSortIndex("vendorName")}
                    onSort={() => handleColumnSort("vendorName")}
                  >
                    Vendor
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("varietyType")}
                    sortIndex={getSortIndex("varietyType")}
                    onSort={() => handleColumnSort("varietyType")}
                  >
                    Type
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("quantity")}
                    sortIndex={getSortIndex("quantity")}
                    onSort={() => handleColumnSort("quantity")}
                  >
                    Quantity
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
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
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
                    <TableCell colSpan={6} className="text-center py-12">
                      {searchQuery ? (
                        <div className="text-muted-foreground">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No additives match your search criteria</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Beaker className="w-12 h-12 mx-auto text-purple-400" />
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              No additives purchased yet
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Track enzymes, nutrients, clarifiers, and other
                              additives used in production
                            </p>
                            {onAddNew && (
                              <Button
                                onClick={onAddNew}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Additive
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
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
                        <div className="font-medium">
                          {item.metadata?.productName || "Unknown Item"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.metadata?.vendorName || "Unknown Vendor"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getAdditiveTypeBadge(
                            item.metadata?.varietyType || "other",
                          )}
                        >
                          {item.metadata?.varietyType || "other"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatQuantity(
                          item.currentBottleCount,
                          item.metadata?.unit || "units",
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDateDisplay(
                            item.metadata?.purchaseDate || item.createdAt,
                          )}
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
                            {onEdit && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Check if this is a consolidated item
                                  if (item.id.startsWith("consolidated-")) {
                                    toast({
                                      title: "Cannot Edit Consolidated Item",
                                      description: "This view shows consolidated inventory. To edit individual purchases, please use the Transaction History tab in the sidebar.",
                                      variant: "default",
                                    });
                                    return;
                                  }
                                  onEdit(item);
                                }}
                              >
                                <EditIcon className="mr-2 h-4 w-4" />
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination info */}
          {sortedItems.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {sortedItems.length} of {additiveItems.length} additives
                {searchQuery.trim() &&
                  ` (filtered from ${additiveItems.length} total)`}
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
            <AlertDialogTitle>Delete Additive Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deleteItem
                ? `${deleteItem.metadata?.productName || "item"} from ${deleteItem.metadata?.vendorName || "unknown vendor"}`
                : ""}
              &rdquo;? This action cannot be undone and will permanently remove
              this item from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
