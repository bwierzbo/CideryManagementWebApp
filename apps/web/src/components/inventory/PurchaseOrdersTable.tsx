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
import { HarvestDatePicker } from "@/components/ui/harvest-date-picker";
import {
  Calendar,
  FileText,
  AlertTriangle,
  ExternalLink,
  X,
  Download,
  Search,
  Filter,
  Eye,
  FileDown,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";
import { startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subMonths, subYears } from "date-fns";

// Type for purchase order from unified API
interface PurchaseOrder {
  id: string;
  purchaseDate: string;
  vendorId: string;
  vendorName: string | null;
  totalItems: number;
  totalCost: number | null;
  status: "active" | "partially_depleted" | "depleted" | "archived";
  materialType: "basefruit" | "additives" | "juice" | "packaging";
  notes: string | null;
  createdAt: string;
  deletedAt: string | null;
  depletedItems: number;
  itemNames: string;
}

// Table column configuration
type SortField =
  | "purchaseDate"
  | "vendorName"
  | "totalItems"
  | "totalCost"
  | "status"
  | "materialType"
  | "createdAt";

interface PurchaseOrdersTableProps {
  showFilters?: boolean;
  className?: string;
  itemsPerPage?: number;
  onItemClick?: (item: PurchaseOrder) => void;
}

export function PurchaseOrdersTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick,
}: PurchaseOrdersTableProps) {
  // Filter state
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Date range state
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

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
    defaultSort: { field: "purchaseDate", direction: "desc" },
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Router for navigation
  const router = useRouter();

  // Date range preset functions
  const setDatePreset = useCallback((preset: string) => {
    const now = new Date();
    switch (preset) {
      case "last30":
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
      case "thisQuarter":
        setStartDate(startOfQuarter(now));
        setEndDate(now);
        break;
      case "lastQuarter":
        const lastQuarter = subMonths(now, 3);
        setStartDate(startOfQuarter(lastQuarter));
        setEndDate(endOfQuarter(lastQuarter));
        break;
      case "thisYear":
        setStartDate(startOfYear(now));
        setEndDate(now);
        break;
      case "lastYear":
        const lastYear = subYears(now, 1);
        setStartDate(startOfYear(lastYear));
        setEndDate(endOfYear(lastYear));
        break;
      case "clear":
        setStartDate(null);
        setEndDate(null);
        break;
    }
  }, []);

  // API query using unified purchases endpoint
  const {
    data: purchasesData,
    isLoading,
    error,
    refetch,
  } = trpc.purchase.allPurchases.useQuery({
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
    includeArchived: true,
    materialType:
      materialTypeFilter === "all" ? "all" : (materialTypeFilter as any),
    vendorId: vendorFilter !== "all" ? vendorFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Apply client-side filtering for additional filters not handled by API
  const filteredOrders = useMemo(() => {
    const purchaseOrders = purchasesData?.purchases || [];
    // Transform the data to ensure correct types
    const transformedOrders = purchaseOrders.map((order) => ({
      ...order,
      totalCost: order.totalCost ? parseFloat(order.totalCost) : null,
      status: order.status as
        | "active"
        | "partially_depleted"
        | "depleted"
        | "archived",
    }));
    let filtered = transformedOrders;

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          (order.vendorName &&
            order.vendorName.toLowerCase().includes(query)) ||
          order.id.toLowerCase().includes(query) ||
          (order.notes && order.notes.toLowerCase().includes(query)) ||
          order.materialType.toLowerCase().includes(query) ||
          (order.itemNames && order.itemNames.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [purchasesData?.purchases, statusFilter, searchQuery]);

  // Sort orders using the hook
  const sortedOrders = useMemo(() => {
    return sortData(filteredOrders, (order, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case "purchaseDate":
          return new Date(order.purchaseDate);
        case "vendorName":
          return order.vendorName || "";
        case "totalItems":
          return order.totalItems;
        case "totalCost":
          return order.totalCost || 0;
        case "status":
          return order.status;
        case "materialType":
          return order.materialType;
        case "createdAt":
          return new Date(order.createdAt);
        default:
          return (order as any)[field];
      }
    });
  }, [filteredOrders, sortData]);

  // Get unique vendors for filter dropdown
  const uniqueVendors = useMemo(() => {
    const purchaseOrders = purchasesData?.purchases || [];
    const vendors = [
      ...new Set(
        purchaseOrders
          .map((order) => order.vendorName)
          .filter((v): v is string => v !== null),
      ),
    ];
    return vendors.sort();
  }, [purchasesData?.purchases]);

  // Calculate summary statistics from filtered data
  const summaryStats = useMemo(() => {
    const totalSpent = filteredOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
    const totalTransactions = filteredOrders.length;
    const totalItems = filteredOrders.reduce((sum, order) => sum + order.totalItems, 0);

    // Breakdown by material type
    const byMaterialType = filteredOrders.reduce((acc, order) => {
      const type = order.materialType;
      if (!acc[type]) {
        acc[type] = { count: 0, total: 0 };
      }
      acc[type].count += 1;
      acc[type].total += order.totalCost || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    // Top vendors by spending
    const byVendor = filteredOrders.reduce((acc, order) => {
      const vendor = order.vendorName || "Unknown";
      if (!acc[vendor]) {
        acc[vendor] = { count: 0, total: 0 };
      }
      acc[vendor].count += 1;
      acc[vendor].total += order.totalCost || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    const topVendors = Object.entries(byVendor)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 3);

    return {
      totalSpent,
      totalTransactions,
      totalItems,
      byMaterialType,
      topVendors,
    };
  }, [filteredOrders]);

  // CSV Export function
  const exportToCSV = useCallback(() => {
    if (sortedOrders.length === 0) {
      alert("No data to export");
      return;
    }

    // Prepare CSV headers
    const headers = [
      "Purchase Date",
      "Vendor",
      "Items Count",
      "Total Cost",
      "Material Type",
      "Status",
      "Item Names",
      "Notes",
    ];

    // Prepare CSV rows
    const rows = sortedOrders.map((order) => [
      formatDateDisplay(order.purchaseDate),
      order.vendorName || "Unknown",
      order.totalItems.toString(),
      order.totalCost ? order.totalCost.toFixed(2) : "0.00",
      order.materialType,
      order.status,
      order.itemNames || "",
      order.notes || "",
    ]);

    // Add summary row
    rows.push([]);
    rows.push(["SUMMARY", "", "", "", "", "", "", ""]);
    rows.push([
      "Total Transactions:",
      summaryStats.totalTransactions.toString(),
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Total Spent:",
      `$${summaryStats.totalSpent.toFixed(2)}`,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Total Items:",
      summaryStats.totalItems.toString(),
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    // Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.toString().replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Generate filename with date range if applicable
    let filename = "purchase-transactions";
    if (startDate && endDate) {
      filename += `_${formatDateDisplay(startDate.toISOString())}_to_${formatDateDisplay(endDate.toISOString())}`;
    } else if (startDate) {
      filename += `_from_${formatDateDisplay(startDate.toISOString())}`;
    } else if (endDate) {
      filename += `_until_${formatDateDisplay(endDate.toISOString())}`;
    }
    filename += ".csv";

    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [sortedOrders, summaryStats, startDate, endDate]);

  // Event handlers
  const handleColumnSort = useCallback(
    (field: SortField) => {
      handleSort(field);
    },
    [handleSort],
  );

  const handleItemClick = useCallback(
    (order: PurchaseOrder) => {
      if (onItemClick) {
        onItemClick(order);
      } else {
        // Default navigation to order detail page
        router.push(`/purchase-orders/${order.id}`);
      }
    },
    [onItemClick, router],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // PDF export temporarily disabled - generatePurchaseOrderPdf method not yet implemented
  const handleExportPdf = useCallback(async (orderId: string) => {
    console.log("PDF export not yet implemented for order:", orderId);
    // TODO: Implement generatePurchaseOrderPdf in reports router
  }, []);

  // Get sort direction for display
  const getSortDirectionForDisplay = useCallback(
    (field: SortField) => {
      const direction = getSortDirection(field);
      return direction ? direction : "none";
    },
    [getSortDirection],
  );

  // Get sort index for single-column sorting display
  const getSortIndex = useCallback(
    (field: SortField) => {
      const columnIndex = sortState.columns.findIndex(
        (col) => col.field === field,
      );
      return columnIndex >= 0 ? columnIndex : undefined;
    },
    [sortState.columns],
  );

  const formatDateDisplay = (dateString: string) => {
    return formatDate(new Date(dateString));
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Active
          </Badge>
        );
      case "partially_depleted":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Partially Used
          </Badge>
        );
      case "depleted":
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            Depleted
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-600">
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMaterialTypeBadge = (materialType: string) => {
    switch (materialType) {
      case "basefruit":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Base Fruit
          </Badge>
        );
      case "additives":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            Additives
          </Badge>
        );
      case "juice":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Juice
          </Badge>
        );
      case "packaging":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Packaging
          </Badge>
        );
      default:
        return <Badge variant="outline">{materialType}</Badge>;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Cards */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spent */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{formatCurrency(summaryStats.totalSpent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Transactions */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{summaryStats.totalTransactions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Items */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package className="w-6 h-6 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{summaryStats.totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Vendor */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Top Vendor</p>
                  <p className="text-lg font-bold truncate">
                    {summaryStats.topVendors[0]?.[0] || "No data"}
                  </p>
                  {summaryStats.topVendors[0] && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(summaryStats.topVendors[0][1].total)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Date Range Section */}
              <div className="space-y-3">
                <Label>Date Range</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset("last30")}
                    className={cn(
                      "text-xs",
                      startDate && endDate && "bg-blue-50 border-blue-300"
                    )}
                  >
                    Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset("thisQuarter")}
                    className="text-xs"
                  >
                    This Quarter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset("lastQuarter")}
                    className="text-xs"
                  >
                    Last Quarter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset("thisYear")}
                    className="text-xs"
                  >
                    This Year
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset("lastYear")}
                    className="text-xs"
                  >
                    Last Year
                  </Button>
                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDatePreset("clear")}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear Dates
                    </Button>
                  )}
                </div>

                {/* Custom Date Pickers */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <HarvestDatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={setStartDate}
                      allowFutureDates={true}
                      showClearButton={true}
                    />
                  </div>
                  <div className="flex-1">
                    <HarvestDatePicker
                      label="End Date"
                      value={endDate}
                      onChange={setEndDate}
                      allowFutureDates={true}
                      showClearButton={true}
                    />
                  </div>
                </div>
              </div>

              {/* Search and Filter Row */}
              <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
                <div className="flex flex-col lg:flex-row gap-4 flex-1">
                  {/* Search */}
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="search"
                        placeholder="Search items, vendors, lot numbers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Vendor Filter */}
                  <div className="min-w-[200px]">
                    <Label htmlFor="vendor-filter">Vendor</Label>
                    <Select value={vendorFilter} onValueChange={setVendorFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Vendors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {uniqueVendors.map((vendor) => (
                          <SelectItem key={vendor} value={vendor}>
                            {vendor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Material Type Filter */}
                  <div className="min-w-[150px]">
                    <Label htmlFor="material-type-filter">Material Type</Label>
                    <Select
                      value={materialTypeFilter}
                      onValueChange={setMaterialTypeFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="basefruit">Base Fruit</SelectItem>
                        <SelectItem value="additives">Additives</SelectItem>
                        <SelectItem value="juice">Juice</SelectItem>
                        <SelectItem value="packaging">Packaging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="min-w-[150px]">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="partially_depleted">
                          Partially Used
                        </SelectItem>
                        <SelectItem value="depleted">Depleted</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
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
                <FileText className="w-5 h-5" />
                Transaction History
              </CardTitle>
              <div className="flex items-center gap-4">
                <CardDescription>
                  {sortedOrders.length > 0
                    ? `${sortedOrders.length} orders found`
                    : "No orders found"}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={isLoading || sortedOrders.length === 0}
                className="flex items-center gap-1"
              >
                <FileDown className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span>Error loading purchase orders: {error.message}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("purchaseDate")}
                    sortIndex={getSortIndex("purchaseDate")}
                    onSort={() => handleColumnSort("purchaseDate")}
                  >
                    Purchase Date
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
                    sortDirection={getSortDirectionForDisplay("totalItems")}
                    sortIndex={getSortIndex("totalItems")}
                    onSort={() => handleColumnSort("totalItems")}
                  >
                    Items
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay("totalCost")}
                    sortIndex={getSortIndex("totalCost")}
                    onSort={() => handleColumnSort("totalCost")}
                  >
                    Total Cost
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("materialType")}
                    sortIndex={getSortIndex("materialType")}
                    onSort={() => handleColumnSort("materialType")}
                  >
                    Type
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay("status")}
                    sortIndex={getSortIndex("status")}
                    onSort={() => handleColumnSort("status")}
                  >
                    Status
                  </SortableHeader>
                  <SortableHeader canSort={false} className="w-[120px]">
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
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : sortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchQuery ||
                      vendorFilter !== "all" ||
                      materialTypeFilter !== "all" ||
                      statusFilter !== "all"
                        ? "No transactions match your search criteria"
                        : "No transactions found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(order)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>{formatDateDisplay(order.purchaseDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {order.vendorName || "Unknown Vendor"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {order.totalItems}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(order.totalCost)}
                      </TableCell>
                      <TableCell>
                        {getMaterialTypeBadge(order.materialType)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(order);
                            }}
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPdf(order.id);
                            }}
                            title="Export PDF"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results info */}
          {sortedOrders.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {sortedOrders.length} of{" "}
                {purchasesData?.purchases?.length || 0} transactions
                {(vendorFilter !== "all" ||
                  statusFilter !== "all" ||
                  searchQuery.trim()) &&
                  ` (filtered from ${purchasesData?.purchases?.length || 0} total)`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
