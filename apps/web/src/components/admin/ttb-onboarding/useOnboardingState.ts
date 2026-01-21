"use client";

import { useState, useEffect, useCallback } from "react";
import {
  OnboardingState,
  Step1Data,
  Step2Data,
  Step4Data,
  Step5Data,
  createInitialState,
  LegacyBatchInput,
  TaxClassReconciliation,
} from "./types";

const STORAGE_KEY = "ttb-onboarding-draft";

/**
 * Custom hook for managing TTB onboarding wizard state
 * Persists state to localStorage for resume capability
 */
export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(createInitialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as OnboardingState;
        setState(parsed);
      } catch {
        // If parsing fails, use initial state
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isHydrated]);

  // Navigation (4 steps)
  const goToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep < 4) {
        return { ...prev, currentStep: (prev.currentStep + 1) as 1 | 2 | 3 | 4 };
      }
      return prev;
    });
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep > 1) {
        return { ...prev, currentStep: (prev.currentStep - 1) as 1 | 2 | 3 | 4 };
      }
      return prev;
    });
  }, []);

  // Step 1 updates
  const updateStep1 = useCallback((data: Partial<Step1Data>) => {
    setState((prev) => ({
      ...prev,
      step1: { ...prev.step1, ...data },
    }));
  }, []);

  // Step 2 updates (includes reconciliation data)
  const updateStep2 = useCallback((data: Partial<Step2Data>) => {
    setState((prev) => ({
      ...prev,
      step2: { ...prev.step2, ...data },
    }));
  }, []);

  // Step 3 updates (Resolve Gaps - was step4)
  const updateStep3 = useCallback((data: Partial<Step4Data>) => {
    setState((prev) => ({
      ...prev,
      step3: { ...prev.step3, ...data },
    }));
  }, []);

  const addLegacyBatch = useCallback((batch: LegacyBatchInput) => {
    setState((prev) => ({
      ...prev,
      step3: {
        ...prev.step3,
        legacyBatches: [...prev.step3.legacyBatches, batch],
      },
    }));
  }, []);

  const removeLegacyBatch = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      step3: {
        ...prev.step3,
        legacyBatches: prev.step3.legacyBatches.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Step 4 updates (Confirm - was step5)
  const updateStep4 = useCallback((data: Partial<Step5Data>) => {
    setState((prev) => ({
      ...prev,
      step4: { ...prev.step4, ...data },
    }));
  }, []);

  // Calculate reconciliation (now part of Step 2)
  const calculateReconciliation = useCallback((byTaxClass: TaxClassReconciliation[]) => {
    const ttbTotal = byTaxClass.reduce((sum, tc) => sum + tc.ttbBalance, 0);
    const systemTotal = byTaxClass.reduce((sum, tc) => sum + tc.systemInventory, 0);
    const difference = ttbTotal - systemTotal;

    setState((prev) => ({
      ...prev,
      step2: {
        ...prev.step2,
        calculated: true,
        ttbTotal,
        systemTotal,
        difference,
        byTaxClass,
      },
    }));
  }, []);

  // Clear draft (on successful completion)
  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(createInitialState());
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(createInitialState());
  }, []);

  // Check if there's a saved draft
  const hasDraft = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved) as OnboardingState;
      // Check if any meaningful data has been entered
      return parsed.step1.date !== "" || parsed.currentStep > 1;
    } catch {
      return false;
    }
  }, []);

  return {
    state,
    isHydrated,
    // Navigation
    goToStep,
    goNext,
    goBack,
    // Step updates
    updateStep1,
    updateStep2,
    updateStep3,
    updateStep4,
    // Step 3 helpers (Resolve Gaps)
    addLegacyBatch,
    removeLegacyBatch,
    // Calculations
    calculateReconciliation,
    // Lifecycle
    clearDraft,
    reset,
    hasDraft,
  };
}
