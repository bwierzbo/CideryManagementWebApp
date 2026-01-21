"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Scale,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Info,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Wine,
  Beaker,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import {
  Step1Data,
  Step2Data,
  SystemInventory,
  TaxClassReconciliation,
  TAX_CLASS_LABELS,
  TaxClassBalances,
} from "./types";

// Type for batch details from TTB API
interface BatchDetail {
  id: string;
  name: string;
  batchNumber: string;
  vesselId: string | null;
  vesselName: string | null;
  volumeLiters: number;
  volumeGallons: number;
  type: 'bulk' | 'packaged';
  packageInfo?: string;
}

interface Step2Props {
  step1Data: Step1Data;
  data: Step2Data;
  onUpdate: (data: Partial<Step2Data>) => void;
  onCalculate: (byTaxClass: TaxClassReconciliation[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Reconciliation({
  step1Data,
  data,
  onUpdate,
  onCalculate,
  onNext,
  onBack,
}: Step2Props) {
  const { toast } = useToast();
  const [expandedTaxClasses, setExpandedTaxClasses] = useState<Record<string, boolean>>({});
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch available vessels
  const { data: vesselData } = trpc.vessel.list.useQuery({});
  const vessels = vesselData?.vessels || [];

  // Mutation to update batch vessel
  const updateBatch = trpc.batch.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Vessel Updated",
        description: "Batch vessel assignment has been saved.",
      });
      // Refresh the reconciliation data
      utils.ttb.getReconciliationSummary.invalidate();
      setEditingBatchId(null);
      setSelectedVesselId(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditVessel = (batch: BatchDetail) => {
    setEditingBatchId(batch.id);
    setSelectedVesselId(batch.vesselId);
  };

  const handleSaveVessel = (batchId: string) => {
    updateBatch.mutate({
      batchId,
      vesselId: selectedVesselId,
    });
  };

  const handleCancelEdit = () => {
    setEditingBatchId(null);
    setSelectedVesselId(null);
  };

  // Fetch system inventory as of the TTB date
  const { data: reconciliationData, isLoading } = trpc.ttb.getReconciliationSummary.useQuery(
    { asOfDate: step1Data.date },
    { enabled: !!step1Data.date }
  );

  // Calculate TTB totals from Step 1 data
  const ttbTotals = useMemo(() => {
    const bulkTotal = Object.values(step1Data.balances.bulk).reduce((a, b) => a + b, 0);
    const bottledTotal = Object.values(step1Data.balances.bottled).reduce((a, b) => a + b, 0);
    return {
      bulk: bulkTotal,
      bottled: bottledTotal,
      total: bulkTotal + bottledTotal,
    };
  }, [step1Data.balances]);

  // Process reconciliation data into system inventory and calculate comparison
  useEffect(() => {
    if (reconciliationData && !data.calculated) {
      // Extract inventory data from reconciliation summary
      const byTaxClassFromAPI: TaxClassReconciliation[] = (reconciliationData.taxClasses || []).map(
        (tc: { key: string; label: string; ttbTotal: number; currentInventory: number; difference: number; isReconciled: boolean }) => ({
          taxClass: tc.key,
          label: tc.label || TAX_CLASS_LABELS[tc.key as keyof TaxClassBalances] || tc.key,
          ttbBalance: tc.ttbTotal,
          systemInventory: tc.currentInventory,
          difference: tc.difference,
          isReconciled: tc.isReconciled,
        })
      );

      const systemInventory: SystemInventory = {
        bulk: reconciliationData.breakdown?.bulkInventory || 0,
        packaged: reconciliationData.breakdown?.packagedInventory || 0,
        total: reconciliationData.totals.currentInventory,
        byTaxClass: byTaxClassFromAPI,
      };

      // Build complete reconciliation by tax class
      const taxClasses = Object.keys(TAX_CLASS_LABELS) as Array<keyof TaxClassBalances>;

      const byTaxClass: TaxClassReconciliation[] = taxClasses.map((key) => {
        const ttbBulk = step1Data.balances.bulk[key] || 0;
        const ttbBottled = step1Data.balances.bottled[key] || 0;
        const ttbBalance = ttbBulk + ttbBottled;

        // Find system inventory for this tax class
        const systemTc = systemInventory.byTaxClass.find((tc) => tc.taxClass === key);
        const sysInv = systemTc?.systemInventory || 0;

        const difference = ttbBalance - sysInv;
        const isReconciled = Math.abs(difference) < 0.5;

        return {
          taxClass: key,
          label: TAX_CLASS_LABELS[key],
          ttbBalance,
          systemInventory: sysInv,
          difference,
          isReconciled,
        };
      }).filter((tc) => tc.ttbBalance > 0 || tc.systemInventory > 0);

      // Update state
      onUpdate({ systemInventory });
      onCalculate(byTaxClass);
    }
  }, [reconciliationData, data.calculated, step1Data.balances, onUpdate, onCalculate]);

  const systemTotal = data.systemInventory?.total || 0;
  const totalDifference = ttbTotals.total - systemTotal;
  const isFullyReconciled = Math.abs(totalDifference) < 0.5;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Step 2: Reconcile Inventory</CardTitle>
            <CardDescription>
              Compare your TTB opening balance with system inventory as of {step1Data.date}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Guidance */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This comparison shows the difference between what your TTB form reports
            and what the system tracks. Any gaps can be resolved in the next step
            by adding Legacy Batches.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Loading inventory...</span>
          </div>
        ) : data.systemInventory ? (
          <>
            {/* Overall Status */}
            <div
              className={`p-4 rounded-lg border ${
                isFullyReconciled
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {isFullyReconciled ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      isFullyReconciled ? "text-green-800" : "text-amber-800"
                    }`}
                  >
                    {isFullyReconciled
                      ? "Inventory is Reconciled"
                      : `${Math.abs(totalDifference).toFixed(1)} gallons difference`}
                  </p>
                  <p
                    className={`text-sm ${
                      isFullyReconciled ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {isFullyReconciled
                      ? "TTB balance matches system inventory"
                      : totalDifference > 0
                      ? "TTB shows more inventory than the system tracks"
                      : "System shows more inventory than TTB reports"}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* TTB Balance Card */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-sm font-medium text-blue-700 mb-1">TTB Balance</p>
                <p className="text-3xl font-bold text-blue-900">
                  {ttbTotals.total.toFixed(1)}
                </p>
                <p className="text-xs text-blue-600">wine gallons</p>
                <div className="text-xs text-blue-600 mt-2 space-y-0.5">
                  <div>Bulk: {ttbTotals.bulk.toFixed(1)} gal</div>
                  <div>Bottled: {ttbTotals.bottled.toFixed(1)} gal</div>
                </div>
              </div>

              {/* System Inventory Card */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                <p className="text-sm font-medium text-purple-700 mb-1">
                  System Inventory
                </p>
                <p className="text-3xl font-bold text-purple-900">
                  {systemTotal.toFixed(1)}
                </p>
                <p className="text-xs text-purple-600">wine gallons</p>
                <div className="text-xs text-purple-600 mt-2 space-y-0.5">
                  <div>Bulk: {data.systemInventory.bulk.toFixed(1)} gal</div>
                  <div>Packaged: {data.systemInventory.packaged.toFixed(1)} gal</div>
                </div>
              </div>

              {/* Difference Card */}
              <div className={`p-4 border rounded-lg text-center ${
                isFullyReconciled
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
              }`}>
                <p className={`text-sm font-medium mb-1 ${
                  isFullyReconciled ? "text-green-700" : "text-amber-700"
                }`}>Difference</p>
                <p className={`text-3xl font-bold ${
                  isFullyReconciled
                    ? "text-green-600"
                    : totalDifference > 0
                    ? "text-amber-600"
                    : "text-red-600"
                }`}>
                  {totalDifference > 0 ? "+" : ""}
                  {totalDifference.toFixed(1)}
                </p>
                <p className={`text-xs ${
                  isFullyReconciled ? "text-green-600" : "text-amber-600"
                }`}>
                  {isFullyReconciled
                    ? "Within tolerance"
                    : totalDifference > 0
                    ? "Needs Legacy Batches"
                    : "System has more"}
                </p>
              </div>
            </div>

            {/* Breakdown by Tax Class */}
            {data.byTaxClass.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Breakdown by Tax Class</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">
                          Tax Class
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-blue-700">
                          TTB
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-purple-700">
                          System
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700">
                          Diff
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-gray-700">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byTaxClass.map((tc) => (
                        <tr key={tc.taxClass} className="border-b last:border-0">
                          <td className="px-4 py-2 text-gray-700">{tc.label}</td>
                          <td className="px-4 py-2 text-right font-mono text-blue-700">
                            {tc.ttbBalance.toFixed(1)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-purple-700">
                            {tc.systemInventory.toFixed(1)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-mono ${
                              tc.isReconciled
                                ? "text-green-600"
                                : tc.difference > 0
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {tc.difference > 0 ? "+" : ""}
                            {tc.difference.toFixed(1)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {tc.isReconciled ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Gap
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {/* Totals Row */}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-2 text-gray-900">Total</td>
                        <td className="px-4 py-2 text-right font-mono text-blue-700">
                          {ttbTotals.total.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-purple-700">
                          {systemTotal.toFixed(1)}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${
                          isFullyReconciled ? "text-green-600" : "text-amber-600"
                        }`}>
                          {totalDifference > 0 ? "+" : ""}{totalDifference.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {isFullyReconciled ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Batch Details by Tax Class */}
            {reconciliationData?.batchDetailsByTaxClass && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Beaker className="w-4 h-4" />
                  Batch Details by Tax Class
                </h4>
                <p className="text-xs text-gray-500">
                  Click each tax class to see the batches and vessels contributing to the inventory total.
                </p>
                {data.byTaxClass
                  .filter((tc) => {
                    const batchDetailsForClass = reconciliationData.batchDetailsByTaxClass
                      ? (reconciliationData.batchDetailsByTaxClass as Record<string, BatchDetail[]>)[tc.taxClass] || []
                      : [];
                    return tc.systemInventory > 0 || batchDetailsForClass.length > 0;
                  })
                  .map((tc) => {
                    const batchDetails = reconciliationData.batchDetailsByTaxClass
                      ? ((reconciliationData.batchDetailsByTaxClass as Record<string, BatchDetail[]>)[tc.taxClass] || []) as BatchDetail[]
                      : [];
                    const isExpanded = expandedTaxClasses[tc.taxClass] || false;

                    return (
                      <Collapsible
                        key={tc.taxClass}
                        open={isExpanded}
                        onOpenChange={(open) =>
                          setExpandedTaxClasses((prev) => ({ ...prev, [tc.taxClass]: open }))
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
                              {tc.systemInventory.toFixed(1)} gal
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
                                          editingBatchId === batch.id ? (
                                            <div className="flex items-center gap-1">
                                              <Select
                                                value={selectedVesselId || "none"}
                                                onValueChange={(value) =>
                                                  setSelectedVesselId(value === "none" ? null : value)
                                                }
                                              >
                                                <SelectTrigger className="h-7 text-xs w-[140px]">
                                                  <SelectValue placeholder="Select vessel" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">No vessel</SelectItem>
                                                  {vessels.map((vessel) => (
                                                    <SelectItem key={vessel.id} value={vessel.id}>
                                                      {vessel.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                                onClick={() => handleSaveVessel(batch.id)}
                                                disabled={updateBatch.isPending}
                                              >
                                                {updateBatch.isPending ? (
                                                  <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <Check className="w-3 h-3" />
                                                )}
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                                onClick={handleCancelEdit}
                                              >
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1 group">
                                              <span className="text-sm">{batch.vesselName || "—"}</span>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600"
                                                onClick={() => handleEditVessel(batch)}
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          )
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
                {data.byTaxClass.filter((tc) => {
                  const batchDetailsForClass = reconciliationData.batchDetailsByTaxClass
                    ? (reconciliationData.batchDetailsByTaxClass as Record<string, BatchDetail[]>)[tc.taxClass] || []
                    : [];
                  return tc.systemInventory > 0 || batchDetailsForClass.length > 0;
                }).length === 0 && (
                  <p className="text-sm text-gray-500 italic py-4 text-center">
                    No batch details available for the current reconciliation.
                  </p>
                )}
              </div>
            )}

            {/* Next step guidance */}
            {!isFullyReconciled && totalDifference > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  In the next step, you can add <strong>Legacy Batches</strong> to
                  account for pre-system inventory that explains the gap, or add notes
                  explaining any discrepancies.
                </AlertDescription>
              </Alert>
            )}

            {/* Negative difference explanation */}
            {!isFullyReconciled && totalDifference < 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>The system shows more inventory than your TTB balance.</strong>
                  <p className="mt-1 text-sm">This can happen if:</p>
                  <ul className="list-disc list-inside mt-1 text-sm">
                    <li>Production occurred after your TTB date ({step1Data.date})</li>
                    <li>TTB figures were rounded or estimated</li>
                    <li>Some batches in the system shouldn&apos;t be counted</li>
                  </ul>
                  <p className="mt-2 text-sm">You can proceed - just note this discrepancy in the next step.</p>
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No inventory data available. Please set the TTB date in Step 1.</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={isLoading || !data.systemInventory}>
          {isFullyReconciled ? "Continue" : "Resolve Gaps"}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
