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
  Package,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Boxes,
  Edit as EditIcon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";
import { useTableSorting } from "@/hooks/useTableSorting";
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

// Type for packaging inventory item from API
interface PackagingInventoryItem {
  id: string;
  packageId: string | null;
  currentBottleCount: number;
  reservedBottleCount: number;
  materialType: string;
  metadata: {
    purchaseId: string;
    vendorName: string;
    packageType?: string | null;
    materialType?: string | null;
    size?: string;
  };
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Table column configuration
type SortField =
  | "size"
  | "vendorName"
  | "packageType"
  | "quantity"
  | "createdAt";

interface PackagingInventoryTableProps {
  showFilters?: boolean;
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: PackagingInventoryItem) => void;
  onAddNew?: () => void;
  onEdit?: (item: PackagingInventoryItem) => void;
}

export function PackagingInventoryTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
  onAddNew,
  onEdit,
}: PackagingInventoryTableProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<PackagingInventoryItem | null>(
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

  // API queries - using packagingPurchases.listInventory
  const {
    data: inventoryData,
    isLoading,
    error,
    refetch,
  } = trpc.packagingPurchases.listInventory.useQuery({
    limit: 100,
    offset: 0,
  });

  // Transform packaging purchase items
  const packagingItems = useMemo(() => {
    if (!inventoryData?.items) return [];

    const items = inventoryData.items.map((item: any) => ({
      id: item.id,
      packageId: item.purchaseId,
      currentBottleCount: item.quantity || 0,
      reservedBottleCount: 0,
      materialType: item.varietyItemType || item.materialType || "packaging",
      metadata: {
        purchaseId: item.purchaseId,
        vendorName: item.vendorName,
        packageType: item.packageType,
        materialType: item.materialType,
        size: item.size || item.varietyName,
        itemType: item.varietyItemType,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
      },
      location: null,
      notes: item.notes,
      createdAt: item.purchaseDate,
      updatedAt: item.purchaseDate,
    })) as PackagingInventoryItem[];

    return items;
  }, [inventoryData]);

  // Apply client-side filtering
  const filteredItems = useMemo(() => {
    let filtered = packagingItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          item.metadata?.size?.toLowerCase().includes(query) ||
          item.metadata?.vendorName?.toLowerCase().includes(query) ||
          (item.metadata?.packageType &&
            item.metadata.packageType.toLowerCase().includes(query)) ||
          (item.metadata?.materialType &&
            item.metadata.materialType.toLowerCase().includes(query)) ||
          (item.notes && item.notes.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [packagingItems, searchQuery]);

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    return sortData(filteredItems, (item: any, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "size":
          return item.metadata?.size || "";
        case "vendorName":
          return item.metadata?.vendorName || "";
        case "packageType":
          return item.metadata?.packageType || "";
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
    (item: PackagingInventoryItem) => {
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
      console.log("Delete packaging item:", deleteItem.id);
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

  const formatQuantity = (quantity: number) => {
    return quantity.toLocaleString();
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "—";
    const value = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getPackageTypeBadge = (type: string | null) => {
    if (!type) return null;
    const colors = {
      bottle: "bg-green-100 text-green-800",
      can: "bg-blue-100 text-blue-800",
      keg: "bg-purple-100 text-purple-800",
      growler: "bg-orange-100 text-orange-800",
      case: "bg-yellow-100 text-yellow-800",
      box: "bg-gray-100 text-gray-800",
      label: "bg-pink-100 text-pink-800",
      cork: "bg-amber-100 text-amber-800",
      cap: "bg-red-100 text-red-800",
    };
    return (
      colors[type.toLowerCase() as keyof typeof colors] ||
      "bg-gray-100 text-gray-800"
    );
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
                          placeholder="Search packaging, vendors, types, or notes..."
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
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Packaging Purchase
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
            <Package className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {sortedItems.length > 0
                ? `${sortedItems.length} Packaging Item${sortedItems.length !== 1 ? "s" : ""}`
                : "No Packaging Items"}
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
              <span>Error loading packaging inventory: {error.message}</span>
            </div>
          )}

          <div className="border-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("size")}
                    sortIndex={getSortIndex("size")}
                    onSort={() => handleColumnSort("size")}
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
                  <SortableHeader canSort={false}>
                    Item Type
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("quantity")}
                    sortIndex={getSortIndex("quantity")}
                    onSort={() => handleColumnSort("quantity")}
                    align="right"
                  >
                    Quantity
                  </SortableHeader>
                  <SortableHeader canSort={false} align="right">
                    Unit Cost
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
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
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
                    <TableCell colSpan={7} className="text-center py-12">
                      {searchQuery ? (
                        <div className="text-muted-foreground">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No packaging items match your search criteria</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Package className="w-12 h-12 mx-auto text-amber-400" />
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              No packaging purchases yet
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Track bottles, cans, kegs, labels, caps, and other
                              packaging materials
                            </p>
                            {onAddNew && (
                              <Button
                                onClick={onAddNew}
                                className="bg-amber-600 hover:bg-amber-700"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Packaging
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
                        <div className="flex items-center gap-2">
                          <Boxes className="w-4 h-4 text-muted-foreground" />
                          <div className="font-medium">
                            {item.metadata?.size || "Unknown Size"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.metadata?.vendorName || "Unknown Vendor"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.metadata?.itemType ? (
                          <Badge variant="secondary">
                            {item.metadata.itemType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatQuantity(item.currentBottleCount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.metadata?.unitCost ? formatCurrency(item.metadata.unitCost) : (
                          <span className="text-muted-foreground text-sm">—</span>
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
                Showing {sortedItems.length} of {packagingItems.length}{" "}
                packaging items
                {searchQuery.trim() &&
                  ` (filtered from ${packagingItems.length} total)`}
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
            <AlertDialogTitle>Delete Packaging Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deleteItem
                ? `${deleteItem.metadata.size || "item"} from ${deleteItem.metadata.vendorName || "unknown vendor"}`
                : ""}
              &rdquo;? This action cannot be undone and will permanently remove
              this packaging item from your inventory.
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
