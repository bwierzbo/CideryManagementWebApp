"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calculator,
  CheckCircle,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Package,
  TrendingDown,
  Calendar,
  History,
  Factory,
  Droplets,
  Save,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  ChevronDown,
  ChevronRight,
  Wine,
  Beaker,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { downloadReconciliationExcel, type ReconciliationExportData } from "@/utils/excel/ttbReconciliation";
import { downloadReconciliationPDF } from "@/utils/pdf/ttbReconciliation";
import { formatDate } from "@/utils/date-format";

// Type for batch details from TTB API
interface BatchDetail {
  id: string;
  name: string;
  batchNumber: string;
  vesselName: string | null;
  volumeLiters: number;
  volumeGallons: number;
  type: 'bulk' | 'packaged';
  packageInfo?: string;
}

export function TTBReconciliationSummary() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [pendingDate, setPendingDate] = useState<string>(today); // Separate state for input
  const [periodStartDate, setPeriodStartDate] = useState<string>(""); // Period start
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reconciliationName, setReconciliationName] = useState("");
  const [reconciliationNotes, setReconciliationNotes] = useState("");
  const [expandedTaxClasses, setExpandedTaxClasses] = useState<Record<string, boolean>>({});

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.ttb.getReconciliationSummary.useQuery({
    asOfDate: selectedDate,
  });

  const { data: lastReconciliation } = trpc.ttb.getLastReconciliation.useQuery();

  // Auto-populate period start date from last reconciliation (day after last reconciliation end date)
  useEffect(() => {
    if (lastReconciliation?.reconciliationDate && !periodStartDate) {
      // Set start date to the day after the last reconciliation date
      const lastDate = new Date(lastReconciliation.reconciliationDate);
      lastDate.setDate(lastDate.getDate() + 1);
      setPeriodStartDate(lastDate.toISOString().split("T")[0]);
    }
  }, [lastReconciliation?.reconciliationDate, periodStartDate]);

  const saveReconciliation = trpc.ttb.saveReconciliation.useMutation({
    onSuccess: () => {
      toast({
        title: "Reconciliation Saved",
        description: `Saved reconciliation for ${selectedDate}`,
      });
      setSaveDialogOpen(false);
      setReconciliationName("");
      setReconciliationNotes("");
      utils.ttb.getLastReconciliation.invalidate();
      utils.ttb.getReconciliationHistory.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error Saving Reconciliation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveReconciliation = () => {
    if (!data) return;

    saveReconciliation.mutate({
      reconciliationDate: selectedDate,
      name: reconciliationName || undefined,
      notes: reconciliationNotes || undefined,
      // Period tracking (optional)
      periodStartDate: periodStartDate || undefined,
      periodEndDate: selectedDate,
      previousReconciliationId: lastReconciliation?.id,
      summary: {
        openingBalanceDate: data.openingBalanceDate,
        totals: data.totals,
        breakdown: data.breakdown,
        inventoryByYear: data.inventoryByYear,
        productionAudit: data.productionAudit,
        taxClasses: data.taxClasses,
      },
    });
  };

  const getExportData = (): ReconciliationExportData | null => {
    if (!data) return null;

    return {
      reconciliationDate: selectedDate,
      name: reconciliationName || `Reconciliation ${selectedDate}`,
      openingBalanceDate: data.openingBalanceDate,
      ttbBalance: data.totals.ttbBalance,
      inventoryBulk: data.breakdown?.bulkInventory || 0,
      inventoryPackaged: data.breakdown?.packagedInventory || 0,
      inventoryOnHand: data.totals.currentInventory,
      inventoryRemovals: data.totals.removals,
      inventoryLegacy: data.totals.legacyBatches,
      inventoryAccountedFor: data.totals.currentInventory + data.totals.removals + data.totals.legacyBatches,
      inventoryDifference: data.totals.difference,
      productionPressRuns: data.productionAudit?.totals.pressRuns || 0,
      productionJuicePurchases: data.productionAudit?.totals.juicePurchases || 0,
      productionTotal: data.productionAudit?.totals.totalProduction || 0,
      inventoryByYear: data.inventoryByYear || [],
      productionByYear: data.productionAudit?.byYear || [],
      taxClasses: data.taxClasses?.map((tc) => ({
        label: tc.label,
        ttbTotal: tc.ttbTotal,
        currentInventory: tc.currentInventory,
        removals: tc.removals,
        legacyBatches: tc.legacyBatches,
        difference: tc.difference,
      })),
      isReconciled: Math.abs(data.totals.difference) < 0.5,
      notes: reconciliationNotes,
    };
  };

  const handleExportExcel = async () => {
    const exportData = getExportData();
    if (!exportData) return;

    try {
      await downloadReconciliationExcel(exportData);
      toast({
        title: "Excel Downloaded",
        description: `TTB-Reconciliation-${selectedDate}.xlsx`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel file",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    const exportData = getExportData();
    if (!exportData) return;

    try {
      await downloadReconciliationPDF(exportData);
      toast({
        title: "PDF Downloaded",
        description: `TTB-Reconciliation-${selectedDate}.pdf`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF file",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load reconciliation data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasOpeningBalances) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">TTB Reconciliation Summary</CardTitle>
              <CardDescription>
                Compare TTB opening balances with physical inventory
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Set Opening Balances First
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Configure your TTB opening balances above to see the reconciliation summary.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isFullyReconciled = Math.abs(data.totals.difference) < 0.5;

  // Handler to apply pending date (Go button)
  const handleApplyDate = () => {
    if (pendingDate && pendingDate !== selectedDate) {
      setSelectedDate(pendingDate);
    }
  };

  // Handler to set date to TTB opening date for initial reconciliation
  const handleSetToTTBDate = () => {
    if (data.openingBalanceDate) {
      setPendingDate(data.openingBalanceDate);
      setSelectedDate(data.openingBalanceDate);
    }
  };

  // Handler to set date to today
  const handleSetToToday = () => {
    setPendingDate(today);
    setSelectedDate(today);
  };

  // Check if pending date differs from applied date
  const hasPendingChange = pendingDate !== selectedDate;

  return (
    <div className="space-y-6">
      {/* Last Reconciliation Summary - Always Visible */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Last Saved Reconciliation</CardTitle>
              <CardDescription>
                {lastReconciliation ? (
                  <span>Completed on {formatDate(lastReconciliation.reconciliationDate)}{lastReconciliation.name && ` - ${lastReconciliation.name}`}</span>
                ) : (
                  <span className="text-amber-600">No reconciliation has been saved yet</span>
                )}
              </CardDescription>
            </div>
            {lastReconciliation && (
              lastReconciliation.isReconciled ? (
                <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 ml-auto" />
              )
            )}
          </div>
        </CardHeader>
        {lastReconciliation ? (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500 mb-1">TTB Balance</div>
                <div className="text-lg font-semibold font-mono">
                  {lastReconciliation.inventoryOnHand != null && lastReconciliation.inventoryDifference != null
                    ? (Number(lastReconciliation.inventoryOnHand) + Number(lastReconciliation.inventoryDifference)).toFixed(1)
                    : "—"} gal
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500 mb-1">On Hand</div>
                <div className="text-lg font-semibold font-mono">
                  {lastReconciliation.inventoryOnHand != null ? Number(lastReconciliation.inventoryOnHand).toFixed(1) : "—"} gal
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500 mb-1">Removals</div>
                <div className="text-lg font-semibold font-mono">
                  {lastReconciliation.inventoryRemovals != null ? Number(lastReconciliation.inventoryRemovals).toFixed(1) : "—"} gal
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500 mb-1">Legacy</div>
                <div className="text-lg font-semibold font-mono">
                  {lastReconciliation.inventoryLegacy != null ? Number(lastReconciliation.inventoryLegacy).toFixed(1) : "—"} gal
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500 mb-1">Variance</div>
                <div className={cn(
                  "text-lg font-semibold font-mono",
                  Number(lastReconciliation.inventoryDifference ?? 0) > 0.5 && "text-amber-600",
                  Number(lastReconciliation.inventoryDifference ?? 0) < -0.5 && "text-red-600",
                  Math.abs(Number(lastReconciliation.inventoryDifference ?? 0)) <= 0.5 && "text-green-600"
                )}>
                  {Number(lastReconciliation.inventoryDifference ?? 0) > 0 ? "+" : ""}{lastReconciliation.inventoryDifference != null ? Number(lastReconciliation.inventoryDifference).toFixed(1) : "—"} gal
                </div>
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <p className="text-sm text-gray-600">
              Use the form below to create your first reconciliation snapshot.
            </p>
          </CardContent>
        )}
      </Card>

      {/* New Reconciliation Form */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isFullyReconciled
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">New Reconciliation Period</CardTitle>
                  <CardDescription>
                    {periodStartDate && selectedDate ? (
                      <span>Preview for period: {periodStartDate} to {selectedDate}</span>
                    ) : (
                      <span>Select a date range to preview reconciliation</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              {isFullyReconciled ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Fully Reconciled
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {data.totals.difference > 0 ? "+" : ""}{data.totals.difference.toFixed(1)} gal unaccounted
                </div>
              )}
            </div>

            {/* Date Selection */}
            <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="period-start-date" className="text-xs text-gray-600">
                    Period Start Date
                  </Label>
                  <Input
                    id="period-start-date"
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    className="mt-1"
                  />
                  {lastReconciliation && !periodStartDate && (
                    <p className="text-xs text-blue-600 mt-1">
                      Suggested: {(() => {
                        const lastDate = new Date(lastReconciliation.reconciliationDate);
                        lastDate.setDate(lastDate.getDate() + 1);
                        return lastDate.toISOString().split("T")[0];
                      })()}
                    </p>
                  )}
                </div>
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="reconciliation-date" className="text-xs text-gray-600">
                    Period End Date
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="reconciliation-date"
                      type="date"
                      value={pendingDate}
                      onChange={(e) => setPendingDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleApplyDate();
                        }
                      }}
                      className={cn(
                        "flex-1",
                        hasPendingChange && "border-blue-400 ring-1 ring-blue-200"
                      )}
                    />
                    <Button
                      variant={hasPendingChange ? "default" : "outline"}
                      size="sm"
                      onClick={handleApplyDate}
                      disabled={!hasPendingChange || isLoading}
                      className="flex items-center gap-1 px-4"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Calculator className="w-3 h-3" />
                      )}
                      Go
                    </Button>
                  </div>
                  {hasPendingChange && (
                    <p className="text-xs text-blue-600 mt-1">
                      Press Go or Enter to apply the new date
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetToTTBDate}
                  className="flex items-center gap-1"
                >
                  <History className="w-3 h-3" />
                  TTB Date ({data.openingBalanceDate ? formatDate(data.openingBalanceDate) : "N/A"})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetToToday}
                  className="flex items-center gap-1"
                >
                  <Calendar className="w-3 h-3" />
                  Today
                </Button>
              </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="flex items-center gap-1">
                    <Save className="w-3 h-3" />
                    Save Reconciliation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Reconciliation</DialogTitle>
                    <DialogDescription>
                      Save this reconciliation snapshot for audit records. Date: {selectedDate}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="recon-name">Name (optional)</Label>
                      <Input
                        id="recon-name"
                        placeholder="e.g., Q4 2024 Physical Inventory"
                        value={reconciliationName}
                        onChange={(e) => setReconciliationName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recon-notes">Notes (optional)</Label>
                      <Textarea
                        id="recon-notes"
                        placeholder="Any notes about this reconciliation..."
                        value={reconciliationNotes}
                        onChange={(e) => setReconciliationNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveReconciliation}
                      disabled={saveReconciliation.isPending}
                    >
                      {saveReconciliation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                PDF
              </Button>

              {/* Last Reconciliation Info */}
              {lastReconciliation && (
                <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    Last saved: {formatDate(lastReconciliation.reconciliationDate)}
                    {lastReconciliation.isReconciled ? (
                      <CheckCircle className="w-3 h-3 inline ml-1 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 inline ml-1 text-amber-500" />
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inventory Breakdown Cards */}
        {data.breakdown && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-xs font-medium">Bulk (Vessels)</span>
              </div>
              <p className="text-lg font-semibold text-blue-900">
                {data.breakdown.bulkInventory.toFixed(1)} gal
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-xs font-medium">Packaged</span>
              </div>
              <p className="text-lg font-semibold text-purple-900">
                {data.breakdown.packagedInventory.toFixed(1)} gal
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium">Sales</span>
              </div>
              <p className="text-lg font-semibold text-green-900">
                {data.breakdown.sales.toFixed(1)} gal
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium">Losses</span>
              </div>
              <p className="text-lg font-semibold text-red-900">
                {data.breakdown.losses.toFixed(1)} gal
              </p>
            </div>
          </div>
        )}

        {/* Inventory By Year */}
        {data.inventoryByYear && data.inventoryByYear.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <History className="w-4 h-4" />
              Inventory by Batch Year
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.inventoryByYear.map((yearData) => (
                <div
                  key={yearData.year}
                  className="p-2 bg-white rounded border border-slate-200"
                >
                  <div className="text-xs text-slate-500 font-medium">
                    {yearData.year}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {yearData.totalGallons.toFixed(1)} gal
                  </div>
                  <div className="text-xs text-slate-500">
                    {yearData.bulkGallons > 0 && (
                      <span>{yearData.bulkGallons.toFixed(1)} bulk</span>
                    )}
                    {yearData.bulkGallons > 0 && yearData.packagedGallons > 0 && (
                      <span> + </span>
                    )}
                    {yearData.packagedGallons > 0 && (
                      <span>{yearData.packagedGallons.toFixed(1)} pkg</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Production Audit Section */}
        {data.productionAudit && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800 mb-3 flex items-center gap-2">
              <Factory className="w-4 h-4" />
              Production Audit (Source-Based)
            </h4>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="p-3 bg-white rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 text-orange-700 mb-1">
                  <Factory className="w-4 h-4" />
                  <span className="text-xs font-medium">Press Runs</span>
                </div>
                <p className="text-lg font-semibold text-orange-900">
                  {data.productionAudit.totals.pressRuns.toFixed(1)} gal
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 text-orange-700 mb-1">
                  <Droplets className="w-4 h-4" />
                  <span className="text-xs font-medium">Juice Purchases</span>
                </div>
                <p className="text-lg font-semibold text-orange-900">
                  {data.productionAudit.totals.juicePurchases.toFixed(1)} gal
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 text-orange-700 mb-1">
                  <Calculator className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Production</span>
                </div>
                <p className="text-lg font-semibold text-orange-900">
                  {data.productionAudit.totals.totalProduction.toFixed(1)} gal
                </p>
              </div>
            </div>
            {data.productionAudit.byYear.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {data.productionAudit.byYear.map((yearData) => (
                  <div
                    key={yearData.year}
                    className="p-2 bg-white rounded border border-orange-200"
                  >
                    <div className="text-xs text-orange-600 font-medium">
                      {yearData.year}
                    </div>
                    <div className="text-sm font-semibold text-orange-900">
                      {yearData.totalGallons.toFixed(1)} gal
                    </div>
                    <div className="text-xs text-orange-600">
                      {yearData.pressRunsGallons > 0 && (
                        <span>{yearData.pressRunsGallons.toFixed(1)} pressed</span>
                      )}
                      {yearData.pressRunsGallons > 0 && yearData.juicePurchasesGallons > 0 && (
                        <span> + </span>
                      )}
                      {yearData.juicePurchasesGallons > 0 && (
                        <span>{yearData.juicePurchasesGallons.toFixed(1)} purchased</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-orange-600 mt-2">
              This shows all cider tracked from original sources (pressing and purchasing).
            </p>
          </div>
        )}

        {/* Summary Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Tax Class</TableHead>
                <TableHead className="text-right font-semibold">TTB Balance</TableHead>
                <TableHead className="text-right font-semibold">On Hand</TableHead>
                <TableHead className="text-right font-semibold">Removals</TableHead>
                <TableHead className="text-right font-semibold">Legacy</TableHead>
                <TableHead className="text-right font-semibold">Diff</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.taxClasses.map((tc) => (
                <TableRow key={tc.key}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{tc.label}</span>
                      {tc.ttbBulk > 0 && tc.ttbBottled > 0 && (
                        <p className="text-xs text-gray-500">
                          {tc.ttbBulk} bulk + {tc.ttbBottled} bottled
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {tc.ttbTotal.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {tc.currentInventory.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {tc.removals.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {tc.legacyBatches.toFixed(1)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    tc.difference > 0.5 && "text-amber-600",
                    tc.difference < -0.5 && "text-red-600",
                    Math.abs(tc.difference) <= 0.5 && "text-green-600"
                  )}>
                    {tc.difference > 0 ? "+" : ""}{tc.difference.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    {tc.isReconciled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals Row */}
              <TableRow className="bg-gray-50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">
                  {data.totals.ttbBalance.toFixed(1)} gal
                </TableCell>
                <TableCell className="text-right font-mono">
                  {data.totals.currentInventory.toFixed(1)} gal
                </TableCell>
                <TableCell className="text-right font-mono">
                  {data.totals.removals.toFixed(1)} gal
                </TableCell>
                <TableCell className="text-right font-mono">
                  {data.totals.legacyBatches.toFixed(1)} gal
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono",
                  data.totals.difference > 0.5 && "text-amber-600",
                  data.totals.difference < -0.5 && "text-red-600",
                  Math.abs(data.totals.difference) <= 0.5 && "text-green-600"
                )}>
                  {data.totals.difference > 0 ? "+" : ""}{data.totals.difference.toFixed(1)} gal
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Batch Details by Tax Class */}
        {data.hasOpeningBalances && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              Batch Details by Tax Class
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Click each tax class to see the batches and vessels contributing to the inventory total.
            </p>
            {data.taxClasses
              .filter((tc) => {
                const batchDetailsForClass = data.batchDetailsByTaxClass
                  ? (data.batchDetailsByTaxClass as Record<string, BatchDetail[]>)[tc.key] || []
                  : [];
                return tc.currentInventory > 0 || batchDetailsForClass.length > 0;
              })
              .map((tc) => {
                const batchDetails = data.batchDetailsByTaxClass
                  ? ((data.batchDetailsByTaxClass as Record<string, BatchDetail[]>)[tc.key] || []) as BatchDetail[]
                  : [];
                const isExpanded = expandedTaxClasses[tc.key] || false;

                return (
                  <Collapsible
                    key={tc.key}
                    open={isExpanded}
                    onOpenChange={(open) =>
                      setExpandedTaxClasses((prev) => ({ ...prev, [tc.key]: open }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <Wine className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-sm">{tc.label}</span>
                          <span className="text-xs text-gray-500">
                            ({batchDetails.length} {batchDetails.length === 1 ? "item" : "items"})
                          </span>
                        </div>
                        <span className="font-mono text-sm font-medium">
                          {tc.currentInventory.toFixed(1)} gal
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs font-medium">Batch/Item</TableHead>
                              <TableHead className="text-xs font-medium">Vessel/Package</TableHead>
                              <TableHead className="text-xs font-medium text-right">Volume (L)</TableHead>
                              <TableHead className="text-xs font-medium text-right">Volume (gal)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchDetails.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-gray-500 text-sm py-4">
                                  No batches in this category
                                </TableCell>
                              </TableRow>
                            ) : (
                              batchDetails.map((batch: BatchDetail) => (
                                <TableRow key={batch.id}>
                                  <TableCell>
                                    <div>
                                      <span className="font-medium text-sm">{batch.name}</span>
                                      <p className="text-xs text-gray-500">{batch.batchNumber}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {batch.type === "bulk" ? (
                                      <span className="text-sm">{batch.vesselName || "—"}</span>
                                    ) : (
                                      <span className="text-sm text-purple-600">
                                        {batch.packageInfo || "Packaged"}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {batch.volumeLiters.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {batch.volumeGallons.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                            {batchDetails.length > 0 && (
                              <TableRow className="bg-gray-50 font-medium">
                                <TableCell colSpan={2} className="text-sm">Subtotal</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {batchDetails.reduce((sum: number, b: BatchDetail) => sum + b.volumeLiters, 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {batchDetails.reduce((sum: number, b: BatchDetail) => sum + b.volumeGallons, 0).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            {data.taxClasses.filter((tc) => {
              const batchDetailsForClass = data.batchDetailsByTaxClass
                ? (data.batchDetailsByTaxClass as Record<string, BatchDetail[]>)[tc.key] || []
                : [];
              return tc.currentInventory > 0 || batchDetailsForClass.length > 0;
            }).length === 0 && (
              <p className="text-sm text-gray-500 italic py-4 text-center">
                No batch details available for the current reconciliation.
              </p>
            )}
          </div>
        )}

        {/* Legend - Two Views */}
        <div className="space-y-3 pt-2">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-700 mb-2">Inventory Audit (Where is it now?)</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <span className="font-medium">TTB Balance:</span>
                <span>Opening balance from TTB forms</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">On Hand:</span>
                <span>Historical inventory on {data.reconciliationDate}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">Legacy:</span>
                <span>Batches for untracked inventory</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">Diff:</span>
                <span>TTB - (OnHand + Legacy)</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-xs font-medium text-orange-700 mb-2">Production Audit (Did we track all sources?)</p>
            <div className="flex flex-wrap gap-4 text-xs text-orange-600">
              <div className="flex items-center gap-1">
                <span className="font-medium">Press Runs:</span>
                <span>Juice from in-house pressing</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">Juice Purchases:</span>
                <span>Juice acquired from vendors</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">Total Production:</span>
                <span>All cider source inputs tracked</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guidance */}
        {!isFullyReconciled && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <p className="font-medium text-amber-800 mb-1">
              How to reconcile the difference:
            </p>
            <ul className="text-amber-700 space-y-1 list-disc list-inside">
              {data.totals.difference > 0 && (
                <li>
                  <strong>TTB shows more than system.</strong> This could mean inventory existed before it was tracked in the system. Create Legacy Batches to account for this.
                </li>
              )}
              {data.totals.difference < 0 && (
                <li>
                  <strong>System shows more than TTB.</strong> This could mean the TTB opening balance was underreported, or there are batch initial volumes that need correction.
                </li>
              )}
              <li>
                Use the Legacy Inventory section below to create batches for pre-system inventory.
              </li>
              <li>
                Document any remaining discrepancies in the Reconciliation Notes field above.
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
