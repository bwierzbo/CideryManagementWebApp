"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Save,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  FileText,
  Calendar,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import type { TTBForm512017Data } from "lib";

interface TTBPeriodFinalizationProps {
  periodType: "monthly" | "quarterly" | "annual";
  year: number;
  periodNumber?: number;
  periodStart: string;
  periodEnd: string;
  formData: TTBForm512017Data;
}

export function TTBPeriodFinalization({
  periodType,
  year,
  periodNumber,
  periodStart,
  periodEnd,
  formData,
}: TTBPeriodFinalizationProps) {
  const { toast } = useToast();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const utils = trpc.useUtils();

  // Get beginning inventory source
  const { data: beginningInventory, isLoading: isLoadingInventory } =
    trpc.ttb.getBeginningInventory.useQuery({
      periodStart,
    });

  // Get existing snapshot for this period
  const { data: snapshots, isLoading: isLoadingSnapshots, refetch: refetchSnapshots } =
    trpc.ttb.listPeriodSnapshots.useQuery({
      year,
      periodType,
    });

  const currentSnapshot = snapshots?.find((s) =>
    periodNumber ? s.periodNumber === periodNumber : s.periodNumber === null
  );

  // Save period snapshot mutation
  const saveSnapshotMutation = trpc.ttb.savePeriodSnapshot.useMutation({
    onSuccess: (result) => {
      toast({
        title: result.created ? "Snapshot Created" : "Snapshot Updated",
        description: "Period data has been saved as a draft.",
      });
      refetchSnapshots();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Finalize period mutation
  const finalizeMutation = trpc.ttb.finalizePeriodSnapshot.useMutation({
    onSuccess: () => {
      toast({
        title: "Period Finalized",
        description:
          "This period has been finalized. The ending inventory will be used as beginning inventory for the next period.",
      });
      setShowFinalizeDialog(false);
      refetchSnapshots();
      utils.ttb.getBeginningInventory.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveDraft = () => {
    saveSnapshotMutation.mutate({
      periodType,
      year,
      periodNumber,
      periodStart,
      periodEnd,
      data: {
        // Bulk wines by tax class
        bulkHardCider: formData.bulkWinesByTaxClass?.hardCider?.line31_onHandEnd ?? formData.endingInventory.bulk,
        bulkWineUnder16: formData.bulkWinesByTaxClass?.wineUnder16?.line31_onHandEnd ?? 0,
        bulkWine16To21: formData.bulkWinesByTaxClass?.wine16To21?.line31_onHandEnd ?? 0,
        bulkWine21To24: formData.bulkWinesByTaxClass?.wine21To24?.line31_onHandEnd ?? 0,
        bulkSparklingWine: formData.bulkWinesByTaxClass?.sparklingWine?.line31_onHandEnd ?? 0,
        bulkCarbonatedWine: formData.bulkWinesByTaxClass?.carbonatedWine?.line31_onHandEnd ?? 0,
        // Bottled wines by tax class
        bottledHardCider: formData.bottledWinesByTaxClass?.hardCider?.line20_onHandEnd ?? formData.endingInventory.bottled,
        bottledWineUnder16: formData.bottledWinesByTaxClass?.wineUnder16?.line20_onHandEnd ?? 0,
        bottledWine16To21: formData.bottledWinesByTaxClass?.wine16To21?.line20_onHandEnd ?? 0,
        bottledWine21To24: formData.bottledWinesByTaxClass?.wine21To24?.line20_onHandEnd ?? 0,
        bottledSparklingWine: formData.bottledWinesByTaxClass?.sparklingWine?.line20_onHandEnd ?? 0,
        bottledCarbonatedWine: formData.bottledWinesByTaxClass?.carbonatedWine?.line20_onHandEnd ?? 0,
        // Spirits
        spiritsAppleBrandy: formData.ciderBrandyInventory?.brandy?.total ?? 0,
        spiritsGrape: 0,
        spiritsOther: 0,
        // Production by tax class
        producedHardCider: formData.bulkWinesByTaxClass?.hardCider?.line2_produced ?? formData.wineProduced.total,
        producedWineUnder16: formData.bulkWinesByTaxClass?.wineUnder16?.line2_produced ?? 0,
        producedWine16To21: formData.bulkWinesByTaxClass?.wine16To21?.line2_produced ?? 0,
        // Tax-paid removals
        taxpaidTastingRoom: formData.taxPaidRemovals.tastingRoom,
        taxpaidWholesale: formData.taxPaidRemovals.wholesale,
        taxpaidOnlineDtc: formData.taxPaidRemovals.onlineDtc,
        taxpaidEvents: formData.taxPaidRemovals.events,
        taxpaidOther: formData.taxPaidRemovals.uncategorized || 0,
        // Other removals
        removedSamples: formData.otherRemovals.samples,
        removedBreakage: formData.otherRemovals.breakage,
        removedProcessLoss: formData.otherRemovals.processLosses,
        removedDistilling: formData.distilleryOperations?.ciderSentToDsp ?? 0,
        // Materials
        materialsApplesLbs: formData.materials.applesReceivedLbs,
        materialsOtherFruitLbs: formData.materials.otherFruitReceivedLbs,
        materialsJuiceGallons: formData.materials.appleJuiceGallons,
        materialsSugarLbs: formData.materials.sugarReceivedLbs,
        // Tax calculation
        taxHardCider: formData.taxSummary.grossTax,
        taxWineUnder16: 0,
        taxWine16To21: 0,
        taxSmallProducerCredit: formData.taxSummary.smallProducerCredit,
        taxTotal: formData.taxSummary.netTaxOwed,
      },
    });
  };

  const handleFinalize = () => {
    if (currentSnapshot) {
      finalizeMutation.mutate(currentSnapshot.id);
    }
  };

  const formatGallons = (gallons: number) => {
    return gallons.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const isLoading = isLoadingInventory || isLoadingSnapshots;
  const isFinalized = currentSnapshot?.status === "finalized";
  const hasDraft = currentSnapshot?.status === "draft" || currentSnapshot?.status === "review";

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Period Finalization</CardTitle>
                <CardDescription>
                  Save and finalize this reporting period
                </CardDescription>
              </div>
            </div>
            {isFinalized && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Finalized
              </Badge>
            )}
            {hasDraft && !isFinalized && (
              <Badge variant="secondary">
                <FileText className="w-3 h-3 mr-1" />
                Draft Saved
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Beginning Inventory Source */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Beginning Inventory Source
                    </p>
                    {beginningInventory?.source === "snapshot" && (
                      <p className="text-sm text-gray-600 mt-1">
                        Using ending inventory from previous finalized period
                        (ended {beginningInventory.snapshotPeriodEnd})
                      </p>
                    )}
                    {beginningInventory?.source === "opening_balances" && (
                      <p className="text-sm text-gray-600 mt-1">
                        Using TTB opening balances (set for{" "}
                        {beginningInventory.openingBalanceDate})
                      </p>
                    )}
                    {beginningInventory?.source === "none" && (
                      <p className="text-sm text-amber-600 mt-1">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        No prior data found. Beginning inventory is zero. Set
                        opening balances in Admin settings.
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Beginning: Bulk {formatGallons(formData.beginningInventory.bulk)} gal |
                      Bottled {formatGallons(formData.beginningInventory.bottled)} gal |
                      Total {formatGallons(formData.beginningInventory.total)} gal
                    </p>
                  </div>
                </div>
              </div>

              {/* Ending Inventory Summary */}
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Period End Inventory (will become next period&apos;s beginning)
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Bulk:</span>{" "}
                    <span className="font-medium">
                      {formatGallons(formData.endingInventory.bulk)} gal
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bottled:</span>{" "}
                    <span className="font-medium">
                      {formatGallons(formData.endingInventory.bottled)} gal
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total:</span>{" "}
                    <span className="font-semibold text-amber-700">
                      {formatGallons(formData.endingInventory.total)} gal
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {!isFinalized && (
                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={saveSnapshotMutation.isPending}
                  >
                    {saveSnapshotMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {hasDraft ? "Update Draft" : "Save as Draft"}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowFinalizeDialog(true)}
                    disabled={!hasDraft || finalizeMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Finalize Period
                  </Button>
                </div>
              )}

              {isFinalized && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Period Finalized
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      This period was finalized on{" "}
                      {currentSnapshot?.finalizedAt
                        ? new Date(currentSnapshot.finalizedAt).toLocaleDateString()
                        : "N/A"}
                      . The ending inventory is now being used as the beginning
                      inventory for subsequent periods.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Finalize Confirmation Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Reporting Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to finalize this period? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                <strong>Important:</strong> Once finalized:
              </p>
              <ul className="text-sm text-amber-700 mt-2 ml-6 list-disc">
                <li>This period&apos;s data cannot be modified</li>
                <li>
                  The ending inventory ({formatGallons(formData.endingInventory.total)} gal)
                  will become the beginning inventory for the next period
                </li>
                <li>
                  Ensure all data is accurate before finalizing
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFinalizeDialog(false)}
              disabled={finalizeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={finalizeMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {finalizeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Finalize Period
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
