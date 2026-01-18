"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";

export function TTBReconciliationSummary() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const { data, isLoading, error } = trpc.ttb.getReconciliationSummary.useQuery({
    asOfDate: selectedDate,
  });

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

  // Handler to set date to TTB opening date for initial reconciliation
  const handleSetToTTBDate = () => {
    if (data.openingBalanceDate) {
      setSelectedDate(data.openingBalanceDate);
    }
  };

  // Handler to set date to today
  const handleSetToToday = () => {
    setSelectedDate(today);
  };

  return (
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
                <CardTitle className="text-lg">TTB Reconciliation Summary</CardTitle>
                <CardDescription>
                  {data.isInitialReconciliation ? (
                    <span className="text-blue-600">Initial Reconciliation (TTB Opening Date)</span>
                  ) : (
                    <span>Ongoing Reconciliation as of {data.reconciliationDate}</span>
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
                {data.totals.difference > 0 ? "+" : ""}{data.totals.difference} gal unaccounted
              </div>
            )}
          </div>

          {/* Date Selection */}
          <div className="flex items-end gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="reconciliation-date" className="text-xs text-gray-600">
                Reconcile As Of Date
              </Label>
              <Input
                id="reconciliation-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetToTTBDate}
              className="flex items-center gap-1"
            >
              <History className="w-3 h-3" />
              TTB Date ({data.openingBalanceDate})
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
  );
}
