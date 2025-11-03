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
  Droplets,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Thermometer,
  Edit,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";
import { toast } from "@/hooks/use-toast";
import { VolumeDisplay } from "@/components/ui/volume-input";
import { useTableSorting } from "@/hooks/useTableSorting";
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
import { TransferToTankModal } from "@/components/juice/TransferToTankModal";

// Type for juice inventory item from API
interface JuiceInventoryItem {
  id: string;
  packageId: string | null;
  currentBottleCount: number;
  reservedBottleCount: number;
  materialType: string;
  metadata: {
    itemId: string;
    purchaseId: string;
    vendorName: string;
    varietyName: string | null;
    brix?: string | null;
  };
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Table column configuration
type SortField = "varietyName" | "vendorName" | "volumeL" | "createdAt";

interface JuiceInventoryTableProps {
  showFilters?: boolean;
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: JuiceInventoryItem) => void;
  onAddNew?: () => void;
  onEdit?: (item: any) => void;
}

export function JuiceInventoryTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
  onEdit,
  onAddNew,
}: JuiceInventoryTableProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<JuiceInventoryItem | null>(null);
  const [transferItem, setTransferItem] = useState<JuiceInventoryItem | null>(null);

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

  // Delete mutation
  const deleteMutation = trpc.inventory.deleteItem.useMutation({
    onSuccess: () => {
      setDeleteItem(null);
      refetch();
      toast({
        title: "Success",
        description: "Juice item deleted successfully",
      });
    },
    onError: (error) => {
      console.error("Delete failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete juice item",
        variant: "destructive",
      });
    },
  });

  // Transform and filter inventory data to show only juice
  const juiceItems = useMemo(() => {
    if (!inventoryData?.items) return [];

    // Filter for juice items only
    const items = inventoryData.items
      .filter((item: any) => item.materialType === "juice")
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
          }) as JuiceInventoryItem,
      );

    return items;
  }, [inventoryData]);

  // Apply client-side filtering
  const filteredItems = useMemo(() => {
    let filtered = juiceItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          (item.metadata?.varietyName &&
            item.metadata.varietyName.toLowerCase().includes(query)) ||
          item.metadata?.vendorName?.toLowerCase().includes(query) ||
          (item.notes && item.notes.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [juiceItems, searchQuery]);

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    return sortData(filteredItems, (item: any, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "varietyName":
          return item.metadata?.varietyName || "";
        case "vendorName":
          return item.metadata?.vendorName || "";
        case "volumeL":
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
    (item: JuiceInventoryItem) => {
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
      // Extract the actual juice purchase item ID from the composite ID
      const [materialType, itemId] = deleteItem.id.split("-");
      deleteMutation.mutate({
        id: deleteItem.id,
        itemType: materialType as "juice",
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


  // Convert brix to specific gravity
  const convertBrixToSG = (brix: string | null) => {
    if (!brix) return null;
    const brixValue = parseFloat(brix);
    if (isNaN(brixValue)) return null;
    // Rough conversion: SG ≈ 1 + (Brix / 258.6)
    const sg = 1 + brixValue / 258.6;
    return sg.toFixed(3);
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
                          placeholder="Search varieties, vendors, types, or notes..."
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Juice Purchase
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
            <Droplets className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {sortedItems.length > 0
                ? `${sortedItems.length} Juice Lot${sortedItems.length !== 1 ? "s" : ""}`
                : "No Juice Lots"}
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
              <span>Error loading juice inventory: {error.message}</span>
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
                    Variety
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("vendorName")}
                    sortIndex={getSortIndex("vendorName")}
                    onSort={() => handleColumnSort("vendorName")}
                  >
                    Vendor
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("volumeL")}
                    sortIndex={getSortIndex("volumeL")}
                    onSort={() => handleColumnSort("volumeL")}
                  >
                    Volume
                  </SortableHeader>
                  <SortableHeader canSort={false}>SG</SortableHeader>
                  <SortableHeader canSort={false}>pH</SortableHeader>
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
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
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
                          <p>No juice lots match your search criteria</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Droplets className="w-12 h-12 mx-auto text-blue-400" />
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              No juice purchases yet
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Track pressed juice inventory ready for fermentation
                            </p>
                            {onAddNew && (
                              <Button
                                onClick={onAddNew}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Juice Purchase
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
                          {item.metadata?.varietyName ?? "Unknown Variety"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.metadata?.vendorName || "Unknown Vendor"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <VolumeDisplay
                          value={item.currentBottleCount}
                          unit="L"
                          showUnit={true}
                        />
                      </TableCell>
                      <TableCell>
                        {item.metadata?.specificGravity ? (
                          <span className="font-mono text-sm">
                            {parseFloat(item.metadata.specificGravity).toFixed(
                              3,
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.metadata?.ph ? (
                          <span className="font-mono text-sm">
                            {parseFloat(item.metadata.ph).toFixed(1)}
                          </span>
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
                                setTransferItem(item);
                              }}
                            >
                              <Droplets className="mr-2 h-4 w-4" />
                              Transfer to Tank
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination info */}
          {sortedItems.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {sortedItems.length} of {juiceItems.length} juice lots
                {searchQuery.trim() &&
                  ` (filtered from ${juiceItems.length} total)`}
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
            <AlertDialogTitle>Delete Juice Lot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deleteItem
                ? `${deleteItem.metadata.varietyName ?? "juice"} from ${deleteItem.metadata.vendorName || "unknown vendor"}`
                : ""}
              &rdquo;? This action cannot be undone and will permanently remove
              this juice lot from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
      {transferItem && (
        <TransferToTankModal
          open={!!transferItem}
          onClose={() => setTransferItem(null)}
          juicePurchaseItemId={transferItem.metadata.itemId}
          juiceLabel={`${transferItem.metadata.varietyName || "Unknown Variety"} from ${transferItem.metadata.vendorName || "Unknown Vendor"}`}
          availableVolumeL={Number(transferItem.currentBottleCount) || 0}
          onSuccess={() => {
            refetch();
            setTransferItem(null);
          }}
        />
      )}
    </div>
  );
}
