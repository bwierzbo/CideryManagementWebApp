/**
 * TTB Onboarding Wizard Types
 * Types for the step-by-step onboarding wizard
 */

export interface TaxClassBalances {
  hardCider: number;
  wineUnder16: number;
  wine16To21: number;
  wine21To24: number;
  sparklingWine: number;
  carbonatedWine: number;
}

export interface SpiritsBalances {
  appleBrandy: number;
  grapeSpirits: number;
}

export interface TTBOpeningBalances {
  bulk: TaxClassBalances;
  bottled: TaxClassBalances;
  spirits: SpiritsBalances;
}

export interface LegacyBatchInput {
  name: string;
  volumeGallons: number;
  taxClass: string;
  productType: string;
  notes: string;
}

export interface TaxClassReconciliation {
  taxClass: string;
  label: string;
  ttbBalance: number;
  systemInventory: number;
  difference: number;
  isReconciled: boolean;
}

export interface SystemInventory {
  bulk: number;
  packaged: number;
  total: number;
  byTaxClass: TaxClassReconciliation[];
}

// Step 1: TTB Starting Point
export interface Step1Data {
  date: string;
  balances: TTBOpeningBalances;
  reconciliationNotes: string;
}

// Step 2: Physical Inventory Review & Reconciliation (merged)
export interface Step2Data {
  systemInventory: SystemInventory | null;
  // Reconciliation data (previously Step3)
  calculated: boolean;
  ttbTotal: number;
  systemTotal: number;
  difference: number;
  byTaxClass: TaxClassReconciliation[];
}

// Step 4: Resolve Gaps
export interface Step4Data {
  legacyBatches: LegacyBatchInput[];
  discrepancyNotes: string;
}

// Step 5: Save & Confirm
export interface Step5Data {
  confirmed: boolean;
}

// Complete onboarding state (4 steps: TTB Balance, Inventory/Reconcile, Resolve, Confirm)
export interface OnboardingState {
  currentStep: 1 | 2 | 3 | 4;
  step1: Step1Data;
  step2: Step2Data;  // Now includes reconciliation data
  step3: Step4Data;  // Resolve Gaps (was step4)
  step4: Step5Data;  // Confirm (was step5)
}

// Initial state factory
export function createInitialState(): OnboardingState {
  return {
    currentStep: 1,
    step1: {
      date: "",
      balances: {
        bulk: {
          hardCider: 0,
          wineUnder16: 0,
          wine16To21: 0,
          wine21To24: 0,
          sparklingWine: 0,
          carbonatedWine: 0,
        },
        bottled: {
          hardCider: 0,
          wineUnder16: 0,
          wine16To21: 0,
          wine21To24: 0,
          sparklingWine: 0,
          carbonatedWine: 0,
        },
        spirits: {
          appleBrandy: 0,
          grapeSpirits: 0,
        },
      },
      reconciliationNotes: "",
    },
    step2: {
      systemInventory: null,
      calculated: false,
      ttbTotal: 0,
      systemTotal: 0,
      difference: 0,
      byTaxClass: [],
    },
    step3: {
      legacyBatches: [],
      discrepancyNotes: "",
    },
    step4: {
      confirmed: false,
    },
  };
}

// Tax class labels for display
export const TAX_CLASS_LABELS: Record<keyof TaxClassBalances, string> = {
  hardCider: "Hard Cider (<8.5% ABV)",
  wineUnder16: "Wine (<16% ABV)",
  wine16To21: "Wine (16-21% ABV)",
  wine21To24: "Wine (21-24% ABV)",
  sparklingWine: "Sparkling Wine",
  carbonatedWine: "Carbonated Wine",
};

export const SPIRITS_LABELS: Record<keyof SpiritsBalances, string> = {
  appleBrandy: "Apple Brandy",
  grapeSpirits: "Grape Spirits",
};

export const TAX_CLASS_OPTIONS = [
  { value: "hardCider", label: "Hard Cider (<8.5% ABV)", productType: "cider" },
  { value: "wineUnder16", label: "Wine (<16% ABV)", productType: "wine" },
  { value: "wine16To21", label: "Wine (16-21% ABV)", productType: "wine" },
  { value: "wine21To24", label: "Wine (21-24% ABV)", productType: "wine" },
  { value: "sparklingWine", label: "Sparkling Wine", productType: "wine" },
  { value: "carbonatedWine", label: "Carbonated Wine", productType: "wine" },
  { value: "appleBrandy", label: "Apple Brandy", productType: "brandy" },
  { value: "grapeSpirits", label: "Grape Spirits", productType: "brandy" },
] as const;

// Step information for the wizard (4 steps)
export const STEPS = [
  { number: 1, title: "TTB Balance", shortTitle: "TTB" },
  { number: 2, title: "Reconcile", shortTitle: "Reconcile" },
  { number: 3, title: "Resolve", shortTitle: "Resolve" },
  { number: 4, title: "Confirm", shortTitle: "Confirm" },
] as const;
