"use client";

import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PressRunCompletionForm } from "./press-run-completion-form";
import { PressRunSummary } from "./press-run-summary";
import { PressRunCompletionSuccess } from "./press-run-completion-success";
import { trpc } from "@/utils/trpc";

interface PressRunCompletionProps {
  pressRunId: string;
  onComplete?: () => void;
  onCancel?: () => void;
  onViewJuiceLot?: (vesselId: string) => void;
  onStartNewRun?: () => void;
  onBackToPressingHome?: () => void;
}

type CompletionStep = "loading" | "form" | "success" | "error";

export function PressRunCompletion({
  pressRunId,
  onComplete,
  onCancel,
  onViewJuiceLot,
  onStartNewRun,
  onBackToPressingHome,
}: PressRunCompletionProps) {
  const [currentStep, setCurrentStep] = useState<CompletionStep>("loading");
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [depletedPurchaseItems, setDepletedPurchaseItems] = useState<
    Set<string>
  >(new Set());
  const formDataRef = React.useRef<any>(null);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Fetch press run details
  const {
    data: pressRunData,
    isLoading: pressRunLoading,
    error: pressRunError,
  } = trpc.pressRun.get.useQuery({ id: pressRunId });

  // Update step based on query state
  React.useEffect(() => {
    if (pressRunLoading) {
      setCurrentStep("loading");
    } else if (pressRunError) {
      setError(pressRunError.message);
      setCurrentStep("error");
    } else if (pressRunData) {
      setCurrentStep("form");
    }
  }, [pressRunData, pressRunLoading, pressRunError]);

  // Completion mutation
  const completePressRunMutation = trpc.pressRun.complete.useMutation({
    onSuccess: (result) => {
      const originalFormData = formDataRef.current;
      setCompletionResult({
        id: result.pressRunId,
        vendorName: pressRunData?.pressRun?.vendorName,
        totalJuiceVolumeL: originalFormData?.totalJuiceVolumeL || 0,
        extractionRate: pressRunData?.pressRun?.totalAppleWeightKg
          ? ((originalFormData?.totalJuiceVolumeL || 0) /
              parseFloat(pressRunData.pressRun.totalAppleWeightKg)) *
            100
          : 0,
        createdBatchIds: result.createdBatchIds,
        totalAppleWeightKg: parseFloat(
          pressRunData?.pressRun?.totalAppleWeightKg || "0",
        ),
        endTime: new Date().toISOString(),
        laborHours: originalFormData?.laborHours || 0,
      });
      setCurrentStep("success");
      toast({
        title: "Success",
        description:
          result.message ||
          `Press run completed successfully! Created ${result.createdBatchIds.length} batch(es).`,
      });

      // Invalidate vessel and batch queries to update UI
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      utils.pressRun.list.invalidate();

      // Call onComplete callback if provided
      onComplete?.();
    },
    onError: (err) => {
      setError(err.message);
      toast({
        title: "Error",
        description: `Failed to complete press run: ${err.message}`,
        variant: "destructive",
      });
    },
  });

  const handlePurchaseDepletionChange = (
    purchaseItemId: string,
    isDepleted: boolean,
  ) => {
    setDepletedPurchaseItems((prev) => {
      const updated = new Set(prev);
      if (isDepleted) {
        updated.add(purchaseItemId);
      } else {
        updated.delete(purchaseItemId);
      }
      return updated;
    });
  };

  const handleFormSubmission = async (formData: any) => {
    try {
      setError(null);

      // Store complete form data for success handler
      formDataRef.current = formData;

      // Extract only the fields needed for the backend API
      const apiPayload = {
        pressRunId: formData.pressRunId,
        completionDate: formData.completionDate, // User-selected completion date
        assignments: formData.assignments,
        totalJuiceVolumeL: formData.totalJuiceVolume, // Form sends totalJuiceVolume (already in liters)
        depletedPurchaseItemIds: Array.from(depletedPurchaseItems),
      };

      await completePressRunMutation.mutateAsync(apiPayload);
    } catch (err) {
      // Error is handled by mutation onError
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onBackToPressingHome?.();
    }
  };

  const handleViewJuiceLot = () => {
    if (completionResult?.vesselId && onViewJuiceLot) {
      onViewJuiceLot(completionResult.vesselId);
    } else {
      toast({
        title: "Info",
        description: "Juice lot view not available",
      });
    }
  };

  const handleViewPressRun = () => {
    // Navigate to press run details - could be handled by parent
    window.location.href = `/pressing/runs/${pressRunId}`;
  };

  // Loading state
  if (currentStep === "loading" || pressRunLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-sm text-gray-600">Loading press run details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (currentStep === "error" || pressRunError) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error ||
              pressRunError?.message ||
              "Failed to load press run details"}
          </AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <button
            onClick={handleCancel}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Pressing
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (currentStep === "success" && completionResult) {
    return (
      <PressRunCompletionSuccess
        completedPressRun={completionResult}
        onViewJuiceLot={handleViewJuiceLot}
        onStartNewRun={
          onStartNewRun || (() => (window.location.href = "/pressing"))
        }
        onViewPressRun={handleViewPressRun}
        onBackToPressingHome={
          onBackToPressingHome || (() => (window.location.href = "/pressing"))
        }
      />
    );
  }

  // Form state
  if (currentStep === "form" && pressRunData?.pressRun) {
    return (
      <div className="space-y-8">
        {/* Press Run Summary */}
        <PressRunSummary
          pressRun={{
            id: pressRunData.pressRun.id,
            vendorName: pressRunData.pressRun.vendorName || "Unknown Vendor",
            status: pressRunData.pressRun.status,
            startTime: pressRunData.pressRun.startTime || undefined,
            totalAppleWeightKg: parseFloat(
              pressRunData.pressRun.totalAppleWeightKg || "0",
            ),
            loads:
              pressRunData.loads?.map((load) => ({
                id: load.id,
                appleVarietyName: load.appleVarietyName || "Unknown Variety",
                appleWeightKg: parseFloat(load.appleWeightKg || "0"),
                originalWeight: parseFloat(load.originalWeight || "0"),
                originalWeightUnit: load.originalWeightUnit || "kg",
                loadSequence: load.loadSequence || 0,
                appleCondition: load.appleCondition || undefined,
                brixMeasured: load.brixMeasured || undefined,
                notes: load.notes || undefined,
                purchaseItemId: load.purchaseItemId || undefined,
                vendorName: load.vendorName || undefined,
                vendorId: load.vendorId || undefined,
                purchaseItemOriginalQuantityKg:
                  parseFloat(load.purchaseItemOriginalQuantityKg || "0") ||
                  undefined,
                purchaseItemOriginalQuantity:
                  parseFloat(load.purchaseItemOriginalQuantity || "0") ||
                  undefined,
                purchaseItemOriginalUnit:
                  load.purchaseItemOriginalUnit || undefined,
              })) || [],
          }}
          showInventoryCheckboxes={true}
          depletedPurchaseItems={depletedPurchaseItems}
          onPurchaseDepletionChange={handlePurchaseDepletionChange}
        />

        {/* Completion Form */}
        <PressRunCompletionForm
          pressRunId={pressRunId}
          pressRun={{
            id: pressRunData.pressRun.id,
            vendorName: pressRunData.pressRun.vendorName || "Unknown Vendor",
            totalAppleWeightKg: parseFloat(
              pressRunData.pressRun.totalAppleWeightKg || "0",
            ),
            loads:
              pressRunData.loads?.map((load) => ({
                id: load.id,
                appleVarietyName: load.appleVarietyName || "Unknown Variety",
                appleWeightKg: parseFloat(load.appleWeightKg || "0"),
                originalWeight: parseFloat(load.originalWeight || "0"),
                originalWeightUnit: load.originalWeightUnit || "kg",
              })) || [],
          }}
          onComplete={handleFormSubmission}
          onCancel={handleCancel}
        />

        {/* Error display during submission */}
        {completePressRunMutation.isError && error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading overlay during submission */}
        {completePressRunMutation.isPending && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <h3 className="font-medium mb-2">Completing Press Run</h3>
                <p className="text-sm text-gray-600">
                  Creating batches and assigning to vessels...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div className="text-center py-8">
      <p className="text-gray-600">
        Unable to load press run completion interface
      </p>
    </div>
  );
}
