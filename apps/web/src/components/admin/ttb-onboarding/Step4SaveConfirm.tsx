"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  ChevronLeft,
  Loader2,
  FileText,
  Archive,
  Scale,
  Warehouse,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import {
  Step1Data,
  Step2Data,
  Step4Data,
  Step5Data,
  TAX_CLASS_OPTIONS,
} from "./types";

interface Step4Props {
  step1Data: Step1Data;
  step2Data: Step2Data;
  step3Data: Step4Data;
  data: Step5Data;
  onUpdate: (data: Partial<Step5Data>) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function Step4SaveConfirm({
  step1Data,
  step2Data,
  step3Data,
  data,
  onUpdate,
  onBack,
  onComplete,
}: Step4Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Mutations
  const updateOpeningBalances = trpc.ttb.updateOpeningBalances.useMutation();
  const createLegacyBatch = trpc.batch.createLegacyBatch.useMutation();
  const saveReconciliation = trpc.ttb.saveReconciliation.useMutation();
  const updateSettings = trpc.settings.updateOrganizationSettings.useMutation();
  const utils = trpc.useUtils();

  // Calculate totals
  const ttbTotal =
    Object.values(step1Data.balances.bulk).reduce((a, b) => a + b, 0) +
    Object.values(step1Data.balances.bottled).reduce((a, b) => a + b, 0);
  const systemTotal = step2Data.systemInventory?.total || 0;
  const legacyTotal = step3Data.legacyBatches.reduce(
    (sum, b) => sum + b.volumeGallons,
    0
  );
  const totalDifference = step2Data.difference;
  const remainingGap = totalDifference - legacyTotal;
  const isFullyReconciled = Math.abs(remainingGap) < 0.5;

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // 1. Save TTB Opening Balances
      await updateOpeningBalances.mutateAsync({
        date: step1Data.date,
        balances: step1Data.balances,
        reconciliationNotes: step1Data.reconciliationNotes || undefined,
      });

      // 2. Create Legacy Batches
      for (const batch of step3Data.legacyBatches) {
        await createLegacyBatch.mutateAsync({
          name: batch.name,
          volumeGallons: batch.volumeGallons,
          productType: batch.productType as "cider" | "perry" | "brandy" | "wine",
          taxClass: batch.taxClass as "hardCider" | "wineUnder16" | "wine16To21" | "wine21To24" | "sparklingWine" | "carbonatedWine" | "appleBrandy" | "grapeSpirits",
          asOfDate: step1Data.date,
          notes: batch.notes || undefined,
          // Extended batch information
          originalGravity: batch.originalGravity,
          finalGravity: batch.finalGravity,
          ph: batch.ph,
          vesselId: batch.vesselId,
          startDate: batch.startDate,
        });
      }

      // 3. Save Initial Reconciliation Snapshot
      await saveReconciliation.mutateAsync({
        name: "Initial Reconciliation",
        reconciliationDate: step1Data.date,
        notes: step3Data.discrepancyNotes || undefined,
        discrepancyExplanation: step3Data.discrepancyNotes || undefined,
        summary: {
          openingBalanceDate: step1Data.date,
          totals: {
            ttbBalance: ttbTotal,
            currentInventory: systemTotal,
            removals: 0,
            legacyBatches: legacyTotal,
            difference: remainingGap,
          },
          breakdown: {
            bulkInventory: step2Data.systemInventory?.bulk || 0,
            packagedInventory: step2Data.systemInventory?.packaged || 0,
            sales: 0,
            losses: 0,
          },
          inventoryByYear: [],
          productionAudit: {
            totals: {
              pressRuns: 0,
              juicePurchases: 0,
              totalProduction: 0,
            },
            byYear: [],
          },
          taxClasses: step2Data.byTaxClass.map((tc) => ({
            key: tc.taxClass,
            label: tc.label,
            type: "wine" as const,
            ttbBulk: tc.ttbBalance,
            ttbBottled: 0,
            ttbTotal: tc.ttbBalance,
            currentInventory: tc.systemInventory,
            removals: 0,
            legacyBatches: step3Data.legacyBatches
              .filter((b) => b.taxClass === tc.taxClass)
              .reduce((sum, b) => sum + b.volumeGallons, 0),
            difference: tc.difference,
            isReconciled: tc.isReconciled,
          })),
        },
      });

      // 4. Mark onboarding as complete
      await updateSettings.mutateAsync({
        ttbOnboardingCompletedAt: new Date(),
      });

      // 5. Invalidate queries to refresh data
      await utils.ttb.getOpeningBalances.invalidate();
      await utils.batch.getLegacyBatches.invalidate();
      await utils.ttb.getReconciliationHistory.invalidate();
      await utils.settings.getOrganizationSettings.invalidate();

      toast({
        title: "Initial Setup Complete",
        description: "Your TTB reconciliation has been saved successfully.",
      });

      // Clear draft and redirect
      onComplete();
      router.push("/admin");
    } catch (error) {
      console.error("Error saving reconciliation:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save reconciliation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100 text-green-700">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Step 4: Review & Complete</CardTitle>
            <CardDescription>
              Review your setup and complete the initial reconciliation
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TTB Opening Balance */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 mb-3">
              <FileText className="w-4 h-4" />
              <span className="font-medium">TTB Opening Balance</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-mono">{step1Data.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-mono font-semibold">
                  {ttbTotal.toFixed(1)} gal
                </span>
              </div>
            </div>
          </div>

          {/* System Inventory */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-purple-700 mb-3">
              <Warehouse className="w-4 h-4" />
              <span className="font-medium">System Inventory</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Bulk:</span>
                <span className="font-mono">
                  {(step2Data.systemInventory?.bulk || 0).toFixed(1)} gal
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Packaged:</span>
                <span className="font-mono">
                  {(step2Data.systemInventory?.packaged || 0).toFixed(1)} gal
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-gray-600">Total:</span>
                <span className="font-mono font-semibold">
                  {systemTotal.toFixed(1)} gal
                </span>
              </div>
            </div>
          </div>

          {/* Legacy Batches */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 mb-3">
              <Archive className="w-4 h-4" />
              <span className="font-medium">Legacy Batches</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Count:</span>
                <span>{step3Data.legacyBatches.length} batches</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-mono font-semibold">
                  {legacyTotal.toFixed(1)} gal
                </span>
              </div>
            </div>
            {step3Data.legacyBatches.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                {step3Data.legacyBatches.map((batch, i) => {
                  const tc = TAX_CLASS_OPTIONS.find((t) => t.value === batch.taxClass);
                  return (
                    <div key={i} className="text-xs text-gray-500 truncate">
                      • {batch.name} ({tc?.label}): {batch.volumeGallons} gal
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reconciliation Status */}
          <div
            className={`p-4 border rounded-lg ${
              isFullyReconciled
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div
              className={`flex items-center gap-2 mb-3 ${
                isFullyReconciled ? "text-green-700" : "text-amber-700"
              }`}
            >
              <Scale className="w-4 h-4" />
              <span className="font-medium">Reconciliation Status</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className={isFullyReconciled ? "text-green-600" : "text-amber-600"}>
                  Difference:
                </span>
                <span className="font-mono font-semibold">
                  {remainingGap > 0 ? "+" : ""}
                  {remainingGap.toFixed(1)} gal
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isFullyReconciled ? "text-green-600" : "text-amber-600"}>
                  Status:
                </span>
                <span className="font-semibold">
                  {isFullyReconciled ? "Reconciled" : "Unreconciled"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Discrepancy Notes */}
        {step3Data.discrepancyNotes && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Discrepancy Notes</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {step3Data.discrepancyNotes}
            </p>
          </div>
        )}

        {/* Warning for unreconciled */}
        {!isFullyReconciled && (
          <Alert>
            <AlertDescription>
              Your reconciliation has a remaining gap of{" "}
              <strong>{Math.abs(remainingGap).toFixed(1)} gallons</strong>. You can
              still complete the setup - the discrepancy will be documented. You can
              add more legacy batches later if needed.
            </AlertDescription>
          </Alert>
        )}

        {/* Confirmation Checkbox */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Checkbox
              id="confirmed"
              checked={data.confirmed}
              onCheckedChange={(checked) =>
                onUpdate({ confirmed: checked === true })
              }
            />
            <div>
              <Label htmlFor="confirmed" className="font-medium cursor-pointer">
                I confirm this initial reconciliation is accurate
              </Label>
              <p className="text-xs text-blue-700 mt-1">
                By checking this box, you confirm that the TTB opening balance,
                system inventory, and any legacy batches are correct. This will be
                saved as your initial reconciliation snapshot.
              </p>
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">What happens next?</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• TTB opening balances will be saved to system settings</li>
            <li>
              • {step3Data.legacyBatches.length} legacy batch
              {step3Data.legacyBatches.length !== 1 ? "es" : ""} will be created
            </li>
            <li>• Initial reconciliation snapshot will be saved for audit trail</li>
            <li>• You can generate TTB reports starting from this date</li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={!data.confirmed || isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Setup
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
