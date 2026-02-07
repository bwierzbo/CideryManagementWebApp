"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Search,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  ClipboardCheck,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/utils/trpc";
import {
  handleTransactionError,
  showSuccess,
  showLoading,
} from "@/utils/error-handling";
import { litersToWineGallons, productTypeToTaxClass } from "lib/src/calculations/ttb";

const RECONCILIATION_STATUSES = [
  { value: "verified", label: "Verified", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  { value: "duplicate", label: "Duplicate", icon: XCircle, color: "bg-gray-100 text-gray-600" },
  { value: "excluded", label: "Excluded", icon: XCircle, color: "bg-red-100 text-red-800" },
  { value: "pending", label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-800" },
] as const;

const PRODUCT_TYPES = [
  { value: "cider", label: "Cider" },
  { value: "perry", label: "Perry" },
  { value: "brandy", label: "Brandy" },
  { value: "pommeau", label: "Pommeau" },
  { value: "juice", label: "Juice" },
  { value: "other", label: "Other" },
] as const;

type ReconciliationStatus = "verified" | "duplicate" | "excluded" | "pending";

type SortField = "name" | "productType" | "startDate" | "initialVolumeLiters" | "currentVolumeLiters" | "gallons" | "vesselName" | "reconciliationStatus";
type SortDirection = "asc" | "desc";

function getStatusBadge(status: string) {
  const config = RECONCILIATION_STATUSES.find((s) => s.value === status);
  if (!config) return <Badge variant="outline">{status}</Badge>;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function getProductTypeBadge(productType: string) {
  const colors: Record<string, string> = {
    cider: "bg-amber-100 text-amber-800",
    perry: "bg-lime-100 text-lime-800",
    brandy: "bg-purple-100 text-purple-800",
    pommeau: "bg-rose-100 text-rose-800",
    juice: "bg-blue-100 text-blue-800",
    other: "bg-gray-100 text-gray-800",
  };
  return (
    <Badge variant="outline" className={colors[productType] || colors.other}>
      {productType}
    </Badge>
  );
}

function formatVolume(liters: string | null): string {
  if (!liters) return "0";
  const val = parseFloat(liters);
  return val.toFixed(1);
}

function formatGallons(liters: string | null): string {
  if (!liters) return "0";
  const val = parseFloat(liters);
  return litersToWineGallons(val).toFixed(2);
}

export function BatchReconciliation() {
  const { data: session } = useSession();
  const utils = trpc.useContext();

  // Filters
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<any>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // TTB Preview
  const [ttbPreviewOpen, setTtbPreviewOpen] = useState(false);

  // Query
  const queryInput = useMemo(() => ({
    year: yearFilter,
    productType: productTypeFilter !== "all" ? productTypeFilter as any : undefined,
    reconciliationStatus: statusFilter !== "all" ? statusFilter as ReconciliationStatus : undefined,
    search: searchQuery || undefined,
  }), [yearFilter, productTypeFilter, statusFilter, searchQuery]);

  const { data, isLoading } = trpc.batch.listForReconciliation.useQuery(queryInput);

  // TTB preview query - shows impact of current verified batches
  const { data: reconciliationData } = trpc.ttb.getReconciliationSummary.useQuery(
    { asOfDate: `${yearFilter}-12-31` },
    { enabled: ttbPreviewOpen }
  );

  // Mutations
  const updateMutation = trpc.batch.update.useMutation({
    onSuccess: () => {
      utils.batch.listForReconciliation.invalidate();
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Update");
    },
  });

  const bulkUpdateMutation = trpc.batch.bulkUpdateReconciliationStatus.useMutation({
    onSuccess: (result) => {
      utils.batch.listForReconciliation.invalidate();
      showSuccess(
        "Batches Updated",
        `${result.updatedCount} batch(es) updated successfully`
      );
      setSelectedIds(new Set());
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Bulk Update");
    },
  });

  const deleteMutation = trpc.batch.delete.useMutation({
    onSuccess: () => {
      utils.batch.listForReconciliation.invalidate();
      utils.batch.list.invalidate();
      showSuccess("Batch Deleted", "Batch has been deleted");
      setDeleteDialogOpen(false);
      setBatchToDelete(null);
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Delete");
    },
  });

  const rawBatches = data?.batches || [];
  const statusCounts = data?.statusCounts || { verified: 0, duplicate: 0, excluded: 0, pending: 0, total: 0 };

  // Sort batches
  const batches = useMemo(() => {
    const sorted = [...rawBatches].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = (a.customName || a.name || "").localeCompare(b.customName || b.name || "");
          break;
        case "productType":
          cmp = (a.productType || "").localeCompare(b.productType || "");
          break;
        case "startDate":
          cmp = (a.startDate ?? "").localeCompare(b.startDate ?? "");
          break;
        case "initialVolumeLiters":
          cmp = (parseFloat(a.initialVolumeLiters || "0")) - (parseFloat(b.initialVolumeLiters || "0"));
          break;
        case "currentVolumeLiters":
          cmp = (parseFloat(a.currentVolumeLiters || "0")) - (parseFloat(b.currentVolumeLiters || "0"));
          break;
        case "gallons":
          cmp = (parseFloat(a.currentVolumeLiters || "0")) - (parseFloat(b.currentVolumeLiters || "0"));
          break;
        case "vesselName":
          cmp = (a.vesselName || "").localeCompare(b.vesselName || "");
          break;
        case "reconciliationStatus":
          cmp = (a.reconciliationStatus || "").localeCompare(b.reconciliationStatus || "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rawBatches, sortField, sortDirection]);

  // Sort toggle handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort icon helper
  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  // Verified volume summary by tax class
  const verifiedSummary = useMemo(() => {
    const byTaxClass: Record<string, number> = {};
    let total = 0;
    for (const b of rawBatches) {
      if (b.reconciliationStatus !== "verified") continue;
      const liters = parseFloat(b.initialVolumeLiters || "0");
      if (liters <= 0) continue;
      const gallons = litersToWineGallons(liters);
      const taxClass = productTypeToTaxClass(b.productType) || "other";
      byTaxClass[taxClass] = (byTaxClass[taxClass] || 0) + gallons;
      total += gallons;
    }
    return { byTaxClass, total };
  }, [rawBatches]);

  // Selection handlers
  const allSelected = batches.length > 0 && batches.every((b) => selectedIds.has(b.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(batches.map((b) => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Status change handlers
  const handleStatusChange = (batchId: string, status: ReconciliationStatus) => {
    updateMutation.mutate({ batchId, reconciliationStatus: status });
  };

  const handleBulkAction = (status: ReconciliationStatus) => {
    if (selectedIds.size === 0) return;
    bulkUpdateMutation.mutate({
      batchIds: Array.from(selectedIds),
      reconciliationStatus: status,
    });
  };

  const handleDeleteClick = (batch: any) => {
    setBatchToDelete(batch);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!batchToDelete) return;
    const dismissLoading = showLoading("Deleting batch...");
    try {
      await deleteMutation.mutateAsync({ batchId: batchToDelete.id });
    } finally {
      dismissLoading();
    }
  };

  // Year options (range around current year)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  // Admin guard
  if ((session?.user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">Admin access required</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ClipboardCheck className="w-8 h-8 text-amber-600 mr-3" />
            Batch Reconciliation
          </h1>
          <p className="text-gray-600 mt-2">
            Verify batches for TTB Form 5120.17 reporting. Only verified batches are included in TTB calculations.
          </p>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("verified")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Verified</p>
                  <p className="text-2xl font-bold text-green-700">{statusCounts.verified}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("pending")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-amber-700">{statusCounts.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("duplicate")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Duplicate</p>
                  <p className="text-2xl font-bold text-gray-600">{statusCounts.duplicate}</p>
                </div>
                <XCircle className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("excluded")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Excluded</p>
                  <p className="text-2xl font-bold text-red-700">{statusCounts.excluded}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reconciliation Status Banner */}
        {!isLoading && statusCounts.total > 0 && (
          <div className={`mb-4 p-4 rounded-lg border ${
            statusCounts.pending === 0
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {statusCounts.pending === 0 ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">
                        {yearFilter} — Fully Reconciled
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-amber-800">
                        {yearFilter} — {statusCounts.pending} batch{statusCounts.pending !== 1 ? "es" : ""} pending review
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {statusCounts.verified} verified, {statusCounts.duplicate} duplicate, {statusCounts.excluded} excluded
                </p>
              </div>
              {verifiedSummary.total > 0 && (
                <div className="text-right text-sm">
                  <p className="font-medium text-gray-700">Verified Bulk Volume</p>
                  {Object.entries(verifiedSummary.byTaxClass)
                    .sort(([, a], [, b]) => b - a)
                    .map(([taxClass, gallons]) => (
                      <p key={taxClass} className="text-gray-600">
                        {taxClass === "hardCider" ? "Hard Cider" :
                         taxClass === "wine16To21" ? "Wine 16-21%" :
                         taxClass === "wineUnder16" ? "Wine <16%" :
                         taxClass === "appleBrandy" ? "Apple Brandy" :
                         taxClass}: {gallons.toFixed(1)} gal
                      </p>
                    ))}
                  <p className="font-semibold text-gray-800 border-t border-gray-300 mt-1 pt-1">
                    Total: {verifiedSummary.total.toFixed(1)} gal
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={String(yearFilter)} onValueChange={(v) => { setYearFilter(Number(v)); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={productTypeFilter} onValueChange={(v) => { setProductTypeFilter(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PRODUCT_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {RECONCILIATION_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search batch name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {statusFilter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")}>
                  Clear filter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bulk Action Bar */}
        {someSelected && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} batch(es) selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleBulkAction("verified")}
                disabled={bulkUpdateMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Verify
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBulkAction("duplicate")}
                disabled={bulkUpdateMutation.isPending}
              >
                Mark Duplicate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => handleBulkAction("excluded")}
                disabled={bulkUpdateMutation.isPending}
              >
                Exclude
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleBulkAction("pending")}
                disabled={bulkUpdateMutation.isPending}
              >
                Reset to Pending
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Deselect All
              </Button>
            </div>
          </div>
        )}

        {/* Batch Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {statusCounts.total} Batches ({yearFilter})
            </CardTitle>
            <CardDescription>
              Change status per-batch or select multiple for bulk actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading batches...</div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No batches found for the selected filters</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("name")}>
                        <span className="flex items-center">Batch{sortIcon("name")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("productType")}>
                        <span className="flex items-center">Type{sortIcon("productType")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("startDate")}>
                        <span className="flex items-center">Date{sortIcon("startDate")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("initialVolumeLiters")}>
                        <span className="flex items-center justify-end">Initial (L){sortIcon("initialVolumeLiters")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("currentVolumeLiters")}>
                        <span className="flex items-center justify-end">Current (L){sortIcon("currentVolumeLiters")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("gallons")}>
                        <span className="flex items-center justify-end">Gallons{sortIcon("gallons")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("vesselName")}>
                        <span className="flex items-center">Vessel{sortIcon("vesselName")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("reconciliationStatus")}>
                        <span className="flex items-center">Status{sortIcon("reconciliationStatus")}</span>
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow
                        key={batch.id}
                        className={
                          batch.reconciliationStatus === "duplicate" || batch.reconciliationStatus === "excluded"
                            ? "opacity-50"
                            : undefined
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(batch.id)}
                            onCheckedChange={() => toggleSelect(batch.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={`/batch/${batch.id}`}
                              className="font-medium text-sm text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              {batch.customName || batch.name}
                            </Link>
                            <span className="text-xs text-gray-500">{batch.batchNumber}</span>
                            {batch.suggestDuplicate && batch.reconciliationStatus === "pending" && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 w-fit mt-1 text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Suspected Duplicate
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getProductTypeBadge(batch.productType)}</TableCell>
                        <TableCell className="text-sm">
                          {batch.startDate
                            ? new Date(batch.startDate).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatVolume(batch.initialVolumeLiters)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatVolume(batch.currentVolumeLiters)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatGallons(batch.currentVolumeLiters)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {batch.vesselName || "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={batch.reconciliationStatus || "pending"}
                            onValueChange={(v) => handleStatusChange(batch.id, v as ReconciliationStatus)}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RECONCILIATION_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(batch)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            title="Delete batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TTB Preview */}
        <div className="mt-6">
          <Collapsible open={ttbPreviewOpen} onOpenChange={setTtbPreviewOpen}>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    {ttbPreviewOpen ? (
                      <ChevronDown className="w-5 h-5 mr-2" />
                    ) : (
                      <ChevronRight className="w-5 h-5 mr-2" />
                    )}
                    TTB Summary Preview ({yearFilter})
                  </CardTitle>
                  <CardDescription>
                    Shows TTB Form 5120.17 numbers based on currently verified batches
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="border-t-0 rounded-t-none">
                <CardContent className="pt-4">
                  {reconciliationData && "hasOpeningBalances" in reconciliationData && reconciliationData.hasOpeningBalances ? (
                    (() => {
                      const t = reconciliationData.totals as {
                        ttbOpeningBalance: number; production: number; removals: number;
                        losses: number; distillation: number; ttbCalculatedEnding: number;
                        systemOnHand: number; variance: number;
                      };
                      const variance = t.variance;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Opening Balance</p>
                            <p className="text-lg font-bold">{t.ttbOpeningBalance} gal</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Production</p>
                            <p className="text-lg font-bold">{t.production} gal</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Removals + Losses</p>
                            <p className="text-lg font-bold">{(t.removals + t.losses).toFixed(1)} gal</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Calculated Ending</p>
                            <p className="text-lg font-bold">{t.ttbCalculatedEnding} gal</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">System On Hand</p>
                            <p className="text-lg font-bold">{t.systemOnHand} gal</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Sent to DSP</p>
                            <p className="text-lg font-bold">{t.distillation} gal</p>
                          </div>
                          <div className={`p-3 rounded-lg col-span-2 ${
                            Math.abs(variance) < 10
                              ? "bg-green-50"
                              : Math.abs(variance) < 100
                                ? "bg-amber-50"
                                : "bg-red-50"
                          }`}>
                            <p className="text-xs text-gray-500 uppercase">Variance</p>
                            <p className={`text-lg font-bold ${
                              Math.abs(variance) < 10
                                ? "text-green-700"
                                : Math.abs(variance) < 100
                                  ? "text-amber-700"
                                  : "text-red-700"
                            }`}>
                              {variance} gal
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  ) : reconciliationData ? (
                    <div className="text-center py-4 text-gray-500">
                      No TTB opening balances configured. Set up opening balances in{" "}
                      <Link href="/admin/ttb-onboarding" className="text-blue-600 hover:underline">
                        TTB Onboarding
                      </Link>{" "}
                      first.
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Loading TTB summary...
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete Batch
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{batchToDelete?.customName || batchToDelete?.name}&rdquo;?
                This will permanently remove the batch and all its related data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Batch"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
