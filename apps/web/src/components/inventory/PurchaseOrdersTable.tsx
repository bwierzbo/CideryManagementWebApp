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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { HarvestDatePicker } from "@/components/ui/harvest-date-picker";
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
  ChevronDown,
  ChevronRight,
  BarChart3,
  PieChart,
  ChevronLeft,
  ChevronsLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
  Settings,
  Columns,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useTableSorting } from "@/hooks/useTableSorting";
import { formatDate } from "@/utils/date-format";
import { startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subMonths, subYears } from "date-fns";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { PurchaseDetailsModal } from "./PurchaseDetailsModal";

// Initialize pdfMake fonts
(pdfMake as any).vfs = pdfFonts;

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

// Filter preset types
interface FilterPreset {
  id: string;
  name: string;
  filters: {
    vendorFilter: string;
    materialTypeFilter: string;
    statusFilter: string;
    searchQuery: string;
    startDate: string | null;
    endDate: string | null;
  };
  createdAt: string;
}

const PRESETS_STORAGE_KEY = "purchase-filter-presets";

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

  // UI state
  const [showReports, setShowReports] = useState(false);
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [detailsPurchase, setDetailsPurchase] = useState<{
    id: string;
    materialType: "basefruit" | "additives" | "juice" | "packaging";
  } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    purchaseDate: true,
    vendorName: true,
    totalItems: true,
    totalCost: true,
    materialType: true,
    status: true,
    actions: true,
  });

  // Toggle column visibility
  const toggleColumn = useCallback((column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  }, []);

  // Filter preset state
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Load presets from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (stored) {
        setSavedPresets(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading presets:", error);
    }
  }, []);

  // Save current filters as preset
  const savePreset = useCallback(() => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: {
        vendorFilter,
        materialTypeFilter,
        statusFilter,
        searchQuery,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    setPresetName("");
    setShowSavePreset(false);
  }, [
    presetName,
    vendorFilter,
    materialTypeFilter,
    statusFilter,
    searchQuery,
    startDate,
    endDate,
    savedPresets,
  ]);

  // Load preset
  const loadPreset = useCallback((preset: FilterPreset) => {
    setVendorFilter(preset.filters.vendorFilter);
    setMaterialTypeFilter(preset.filters.materialTypeFilter);
    setStatusFilter(preset.filters.statusFilter);
    setSearchQuery(preset.filters.searchQuery);
    setStartDate(preset.filters.startDate ? new Date(preset.filters.startDate) : null);
    setEndDate(preset.filters.endDate ? new Date(preset.filters.endDate) : null);
  }, []);

  // Delete preset
  const deletePreset = useCallback(
    (id: string) => {
      const updated = savedPresets.filter((p) => p.id !== id);
      setSavedPresets(updated);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    },
    [savedPresets]
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
    limit: pageSize,
    offset: currentPage * pageSize,
    includeArchived: true,
    materialType:
      materialTypeFilter === "all" ? "all" : (materialTypeFilter as any),
    vendorId: vendorFilter !== "all" ? vendorFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Bulk delete mutation
  const bulkDeleteMutation = trpc.purchase.bulkDelete.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      refetch();
    },
    onError: (error) => {
      console.error("Error bulk deleting purchases:", error);
      // TODO: Show toast notification
    },
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

  // PDF Export function
  const exportToPDF = useCallback(() => {
    if (sortedOrders.length === 0) {
      alert("No data to export");
      return;
    }

    // Determine filter description
    const filterParts = [];
    if (startDate && endDate) {
      filterParts.push(`Date Range: ${formatDateDisplay(startDate.toISOString())} to ${formatDateDisplay(endDate.toISOString())}`);
    } else if (startDate) {
      filterParts.push(`From: ${formatDateDisplay(startDate.toISOString())}`);
    } else if (endDate) {
      filterParts.push(`Until: ${formatDateDisplay(endDate.toISOString())}`);
    }
    if (vendorFilter !== "all") {
      filterParts.push(`Vendor: ${vendorFilter}`);
    }
    if (materialTypeFilter !== "all") {
      filterParts.push(`Type: ${materialTypeFilter}`);
    }
    if (statusFilter !== "all") {
      filterParts.push(`Status: ${statusFilter}`);
    }

    const filterText = filterParts.length > 0 ? filterParts.join(" | ") : "All Transactions";

    // Create PDF document definition
    const docDefinition: any = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [40, 60, 40, 60],
      header: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: "Purchase Transaction Report",
            style: "header",
            alignment: "left",
            margin: [40, 20, 0, 0],
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            style: "pageNumber",
            alignment: "right",
            margin: [0, 20, 40, 0],
          },
        ],
      }),
      content: [
        // Report title and filter info
        {
          text: filterText,
          style: "subheader",
          margin: [0, 0, 0, 10],
        },

        // Summary statistics
        {
          style: "summaryTable",
          table: {
            widths: ["*", "*", "*", "*"],
            body: [
              [
                { text: "Total Spent", style: "summaryLabel" },
                { text: "Transactions", style: "summaryLabel" },
                { text: "Total Items", style: "summaryLabel" },
                { text: "Date Generated", style: "summaryLabel" },
              ],
              [
                { text: formatCurrency(summaryStats.totalSpent), style: "summaryValue" },
                { text: summaryStats.totalTransactions.toString(), style: "summaryValue" },
                { text: summaryStats.totalItems.toString(), style: "summaryValue" },
                { text: formatDateDisplay(new Date().toISOString()), style: "summaryValue" },
              ],
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : null),
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => "#e5e7eb",
            vLineColor: () => "#e5e7eb",
          },
          margin: [0, 0, 0, 20],
        },

        // Transactions table
        {
          style: "transactionTable",
          table: {
            headerRows: 1,
            widths: [60, "*", 40, 60, 80, 60],
            body: [
              // Header row
              [
                { text: "Date", style: "tableHeader" },
                { text: "Vendor", style: "tableHeader" },
                { text: "Items", style: "tableHeader", alignment: "right" },
                { text: "Cost", style: "tableHeader", alignment: "right" },
                { text: "Type", style: "tableHeader" },
                { text: "Status", style: "tableHeader" },
              ],
              // Data rows
              ...sortedOrders.map((order) => [
                { text: formatDateDisplay(order.purchaseDate), fontSize: 9 },
                { text: order.vendorName || "Unknown", fontSize: 9 },
                { text: order.totalItems.toString(), fontSize: 9, alignment: "right" },
                { text: formatCurrency(order.totalCost), fontSize: 9, alignment: "right" },
                { text: order.materialType, fontSize: 9 },
                { text: order.status, fontSize: 9 },
              ]),
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : rowIndex % 2 === 0 ? "#fafafa" : null),
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => "#e5e7eb",
            vLineColor: () => "#e5e7eb",
          },
        },
      ],
      footer: (currentPage: number, pageCount: number) => ({
        text: `Generated on ${new Date().toLocaleString()} | Cidery Management System`,
        alignment: "center",
        fontSize: 8,
        color: "#6b7280",
        margin: [0, 10, 0, 0],
      }),
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: "#1f2937",
        },
        pageNumber: {
          fontSize: 10,
          color: "#6b7280",
        },
        subheader: {
          fontSize: 12,
          color: "#6b7280",
          italics: true,
        },
        summaryTable: {
          margin: [0, 5, 0, 15],
        },
        summaryLabel: {
          fontSize: 10,
          bold: true,
          color: "#374151",
        },
        summaryValue: {
          fontSize: 12,
          bold: true,
          color: "#059669",
        },
        transactionTable: {
          fontSize: 9,
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: "#374151",
        },
      },
    };

    // Generate PDF filename
    let filename = "purchase-transactions-report";
    if (startDate && endDate) {
      filename += `_${formatDateDisplay(startDate.toISOString())}_to_${formatDateDisplay(endDate.toISOString())}`;
    } else if (startDate) {
      filename += `_from_${formatDateDisplay(startDate.toISOString())}`;
    } else if (endDate) {
      filename += `_until_${formatDateDisplay(endDate.toISOString())}`;
    }

    // Create and download PDF
    pdfMake.createPdf(docDefinition).download(`${filename}.pdf`);
  }, [sortedOrders, summaryStats, startDate, endDate, vendorFilter, materialTypeFilter, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  // Reset to first page when filters change or page size changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [vendorFilter, materialTypeFilter, statusFilter, searchQuery, startDate, endDate, pageSize]);

  // Pagination handlers
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  const handlePageSizeChange = useCallback((newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(0);
  }, []);

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

  // Bulk selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedOrders.length && paginatedOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedOrders.map((order) => order.id)));
    }
  }, [selectedIds.size, paginatedOrders]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    // Group selected purchases by material type
    const purchasesByType = new Map<string, string[]>();

    paginatedOrders.forEach((order) => {
      if (selectedIds.has(order.id)) {
        const type = order.materialType;
        if (!purchasesByType.has(type)) {
          purchasesByType.set(type, []);
        }
        purchasesByType.get(type)!.push(order.id);
      }
    });

    // Delete each group
    purchasesByType.forEach((purchaseIds, materialType) => {
      bulkDeleteMutation.mutate({
        purchaseIds,
        materialType: materialType as "basefruit" | "additives" | "juice" | "packaging",
      });
    });
  }, [selectedIds, paginatedOrders, bulkDeleteMutation]);

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

      {/* Spending Reports */}
      {showFilters && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowReports(!showReports)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showReports ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Spending Reports
                </CardTitle>
              </div>
              <CardDescription>
                {showReports ? "Hide detailed breakdown" : "Show detailed breakdown"}
              </CardDescription>
            </div>
          </CardHeader>
          {showReports && (
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Spending by Vendor */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Top Vendors by Spending
                  </h3>
                  <div className="space-y-2">
                    {summaryStats.topVendors.length > 0 ? (
                      summaryStats.topVendors.map(([vendor, stats], idx) => (
                        <div
                          key={vendor}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium">{vendor}</p>
                              <p className="text-xs text-muted-foreground">
                                {stats.count} transaction{stats.count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(stats.total)}</p>
                            <p className="text-xs text-muted-foreground">
                              {((stats.total / summaryStats.totalSpent) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No vendor data available
                      </p>
                    )}
                  </div>
                </div>

                {/* Spending by Material Type */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <PieChart className="w-4 h-4" />
                    Spending by Material Type
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(summaryStats.byMaterialType).length > 0 ? (
                      Object.entries(summaryStats.byMaterialType)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([type, stats]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {getMaterialTypeBadge(type)}
                              <p className="text-xs text-muted-foreground">
                                {stats.count} transaction{stats.count !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(stats.total)}</p>
                              <p className="text-xs text-muted-foreground">
                                {((stats.total / summaryStats.totalSpent) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No material type data available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
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

              {/* Filter Presets Section */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Saved Filters</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSavePreset(!showSavePreset)}
                    className="h-8 text-xs"
                  >
                    {showSavePreset ? "Cancel" : "Save Current Filters"}
                  </Button>
                </div>

                {/* Save Preset Form */}
                {showSavePreset && (
                  <div className="flex gap-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <Input
                      placeholder="Enter preset name..."
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          savePreset();
                        }
                      }}
                      className="flex-1 h-8"
                    />
                    <Button
                      size="sm"
                      onClick={savePreset}
                      disabled={!presetName.trim()}
                      className="h-8"
                    >
                      Save
                    </Button>
                  </div>
                )}

                {/* Saved Presets List */}
                {savedPresets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-1.5 group transition-colors"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadPreset(preset)}
                          className="h-auto p-0 hover:bg-transparent text-sm font-medium text-gray-700"
                        >
                          {preset.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePreset(preset.id)}
                          className="h-auto p-0 hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete preset"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No saved filter presets. Click &ldquo;Save Current Filters&rdquo; to create one.
                  </p>
                )}
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
                    ? `Showing ${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, sortedOrders.length)} of ${sortedOrders.length} orders`
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Columns className="w-4 h-4" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Toggle Columns</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-date"
                          checked={visibleColumns.purchaseDate}
                          onCheckedChange={() => toggleColumn("purchaseDate")}
                        />
                        <label
                          htmlFor="col-date"
                          className="text-sm cursor-pointer"
                        >
                          Purchase Date
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-vendor"
                          checked={visibleColumns.vendorName}
                          onCheckedChange={() => toggleColumn("vendorName")}
                        />
                        <label
                          htmlFor="col-vendor"
                          className="text-sm cursor-pointer"
                        >
                          Vendor
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-items"
                          checked={visibleColumns.totalItems}
                          onCheckedChange={() => toggleColumn("totalItems")}
                        />
                        <label
                          htmlFor="col-items"
                          className="text-sm cursor-pointer"
                        >
                          Items
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-cost"
                          checked={visibleColumns.totalCost}
                          onCheckedChange={() => toggleColumn("totalCost")}
                        />
                        <label
                          htmlFor="col-cost"
                          className="text-sm cursor-pointer"
                        >
                          Total Cost
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-type"
                          checked={visibleColumns.materialType}
                          onCheckedChange={() => toggleColumn("materialType")}
                        />
                        <label
                          htmlFor="col-type"
                          className="text-sm cursor-pointer"
                        >
                          Type
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-status"
                          checked={visibleColumns.status}
                          onCheckedChange={() => toggleColumn("status")}
                        />
                        <label
                          htmlFor="col-status"
                          className="text-sm cursor-pointer"
                        >
                          Status
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="col-actions"
                          checked={visibleColumns.actions}
                          onCheckedChange={() => toggleColumn("actions")}
                        />
                        <label
                          htmlFor="col-actions"
                          className="text-sm cursor-pointer"
                        >
                          Actions
                        </label>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={isLoading || sortedOrders.length === 0}
                className="flex items-center gap-1"
              >
                <FileDown className="w-4 h-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
                disabled={isLoading || sortedOrders.length === 0}
                className="flex items-center gap-1"
              >
                <FileText className="w-4 h-4" />
                PDF
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

          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={true}
                  onCheckedChange={clearSelection}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className="text-sm font-medium text-blue-900">
                  {selectedIds.size} {selectedIds.size === 1 ? "item" : "items"}{" "}
                  selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="h-8"
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="h-8"
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Bulk selection checkbox */}
                  <TableCell className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedIds.size === paginatedOrders.length &&
                        paginatedOrders.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableCell>
                  {visibleColumns.purchaseDate && (
                    <SortableHeader
                      sortDirection={getSortDirectionForDisplay("purchaseDate")}
                      sortIndex={getSortIndex("purchaseDate")}
                      onSort={() => handleColumnSort("purchaseDate")}
                    >
                      Purchase Date
                    </SortableHeader>
                  )}
                  {visibleColumns.vendorName && (
                    <SortableHeader
                      sortDirection={getSortDirectionForDisplay("vendorName")}
                      sortIndex={getSortIndex("vendorName")}
                      onSort={() => handleColumnSort("vendorName")}
                    >
                      Vendor
                    </SortableHeader>
                  )}
                  {visibleColumns.totalItems && (
                    <SortableHeader
                      align="right"
                      sortDirection={getSortDirectionForDisplay("totalItems")}
                      sortIndex={getSortIndex("totalItems")}
                      onSort={() => handleColumnSort("totalItems")}
                    >
                      Items
                    </SortableHeader>
                  )}
                  {visibleColumns.totalCost && (
                    <SortableHeader
                      align="right"
                      sortDirection={getSortDirectionForDisplay("totalCost")}
                      sortIndex={getSortIndex("totalCost")}
                      onSort={() => handleColumnSort("totalCost")}
                    >
                      Total Cost
                    </SortableHeader>
                  )}
                  {visibleColumns.materialType && (
                    <SortableHeader
                      sortDirection={getSortDirectionForDisplay("materialType")}
                      sortIndex={getSortIndex("materialType")}
                      onSort={() => handleColumnSort("materialType")}
                    >
                      Type
                    </SortableHeader>
                  )}
                  {visibleColumns.status && (
                    <SortableHeader
                      sortDirection={getSortDirectionForDisplay("status")}
                      sortIndex={getSortIndex("status")}
                      onSort={() => handleColumnSort("status")}
                    >
                      Status
                    </SortableHeader>
                  )}
                  {visibleColumns.actions && (
                    <SortableHeader canSort={false} className="w-[120px]">
                      Actions
                    </SortableHeader>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
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
                ) : paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
                  paginatedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(order)}
                    >
                      {/* Bulk selection checkbox */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={() => toggleSelection(order.id)}
                          aria-label={`Select transaction ${order.id}`}
                        />
                      </TableCell>
                      {visibleColumns.purchaseDate && (
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>{formatDateDisplay(order.purchaseDate)}</span>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.vendorName && (
                        <TableCell>
                          <div className="font-medium">
                            {order.vendorName || "Unknown Vendor"}
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.totalItems && (
                        <TableCell className="text-right font-mono">
                          {order.totalItems}
                        </TableCell>
                      )}
                      {visibleColumns.totalCost && (
                        <TableCell className="text-right font-mono">
                          {formatCurrency(order.totalCost)}
                        </TableCell>
                      )}
                      {visibleColumns.materialType && (
                        <TableCell>
                          {getMaterialTypeBadge(order.materialType)}
                        </TableCell>
                      )}
                      {visibleColumns.status && (
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                      )}
                      {visibleColumns.actions && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsPurchase({
                                  id: order.id,
                                  materialType: order.materialType as
                                    | "basefruit"
                                    | "additives"
                                    | "juice"
                                    | "packaging",
                                });
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
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {sortedOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              {/* Page size selector */}
              <div className="flex items-center gap-2">
                <Label htmlFor="page-size" className="text-sm whitespace-nowrap">
                  Rows per page:
                </Label>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page info and navigation */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground mr-4">
                  Page {currentPage + 1} of {totalPages || 1}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(0)}
                    disabled={currentPage === 0}
                    className="h-8 w-8 p-0"
                    title="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="h-8 w-8 p-0"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page number buttons - show current and nearby pages */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i;
                    } else if (currentPage < 2) {
                      pageNum = i;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 5 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum + 1}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="h-8 w-8 p-0"
                    title="Next page"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="h-8 w-8 p-0"
                    title="Last page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Details Modal */}
      {detailsPurchase && (
        <PurchaseDetailsModal
          open={!!detailsPurchase}
          onClose={() => setDetailsPurchase(null)}
          purchaseId={detailsPurchase.id}
          materialType={detailsPurchase.materialType}
        />
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} purchase{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected purchase transactions
              will be permanently deleted from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
