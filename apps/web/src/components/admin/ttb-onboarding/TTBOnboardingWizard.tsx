"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, RefreshCw, Info } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { Step1TTBStartingPoint } from "./Step1TTBStartingPoint";
import { Step2Reconciliation } from "./Step2Reconciliation";
import { Step3ResolveGaps } from "./Step3ResolveGaps";
import { Step4SaveConfirm } from "./Step4SaveConfirm";
import { useOnboardingState } from "./useOnboardingState";

export function TTBOnboardingWizard() {
  const {
    state,
    isHydrated,
    goToStep,
    goNext,
    goBack,
    updateStep1,
    updateStep2,
    updateStep3,
    updateStep4,
    addLegacyBatch,
    removeLegacyBatch,
    calculateReconciliation,
    clearDraft,
    reset,
    hasDraft,
  } = useOnboardingState();

  // Show loading state while hydrating from localStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Calculate completed steps for the indicator (4 steps now)
  const completedSteps = new Set<number>();
  if (state.step1.date) completedSteps.add(1);
  if (state.step2.calculated) completedSteps.add(2);
  // Step 3 (Resolve) is optional, so don't require completion
  if (state.step4.confirmed) completedSteps.add(4);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-4xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Admin
                </Link>
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">
                TTB Initial Setup
              </h1>
            </div>
            {hasDraft() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-gray-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl py-8">
        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator
            currentStep={state.currentStep}
            onStepClick={goToStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Welcome message on Step 1 */}
        {state.currentStep === 1 && !state.step1.date && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Welcome to TTB Initial Setup</AlertTitle>
            <AlertDescription>
              This wizard will help you set up your TTB reconciliation. You&apos;ll
              enter your TTB opening balance, review your current inventory, and
              resolve any discrepancies. Your progress is saved automatically.
            </AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        {state.currentStep === 1 && (
          <Step1TTBStartingPoint
            data={state.step1}
            onUpdate={updateStep1}
            onNext={goNext}
          />
        )}

        {state.currentStep === 2 && (
          <Step2Reconciliation
            step1Data={state.step1}
            data={state.step2}
            onUpdate={updateStep2}
            onCalculate={calculateReconciliation}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {state.currentStep === 3 && (
          <Step3ResolveGaps
            step1Data={state.step1}
            step2Data={state.step2}
            data={state.step3}
            onAddBatch={addLegacyBatch}
            onRemoveBatch={removeLegacyBatch}
            onUpdate={updateStep3}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {state.currentStep === 4 && (
          <Step4SaveConfirm
            step1Data={state.step1}
            step2Data={state.step2}
            step3Data={state.step3}
            data={state.step4}
            onUpdate={updateStep4}
            onBack={goBack}
            onComplete={clearDraft}
          />
        )}
      </div>
    </div>
  );
}
