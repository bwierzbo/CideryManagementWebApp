import { z } from "zod";

// Shared enum constants for apple varieties
export const CIDER_CATEGORY = [
  "sweet",
  "bittersweet",
  "sharp",
  "bittersharp",
] as const;
export const INTENSITY = [
  "high",
  "medium-high",
  "medium",
  "low-medium",
  "low",
] as const;
export const HARVEST_WINDOW = [
  "Late",
  "Mid-Late",
  "Mid",
  "Early-Mid",
  "Early",
] as const;

// Zod schemas for validation
export const zCiderCategory = z.enum(CIDER_CATEGORY);
export const zIntensity = z.enum(INTENSITY);
export const zHarvestWindow = z.enum(HARVEST_WINDOW);

// Type definitions
export type CiderCategory = (typeof CIDER_CATEGORY)[number];
export type Intensity = (typeof INTENSITY)[number];
export type HarvestWindow = (typeof HARVEST_WINDOW)[number];

// Helper functions to create select options with labels
export const getCiderCategoryOptions = () =>
  [
    { value: "sweet", label: "Sweet" },
    { value: "bittersweet", label: "Bittersweet" },
    { value: "sharp", label: "Sharp" },
    { value: "bittersharp", label: "Bittersharp" },
  ] as const;

export const getIntensityOptions = () =>
  [
    { value: "high", label: "High" },
    { value: "medium-high", label: "Medium-High" },
    { value: "medium", label: "Medium" },
    { value: "low-medium", label: "Low-Medium" },
    { value: "low", label: "Low" },
  ] as const;

export const getHarvestWindowOptions = () =>
  [
    { value: "Late", label: "Late" },
    { value: "Mid-Late", label: "Mid-Late" },
    { value: "Mid", label: "Mid" },
    { value: "Early-Mid", label: "Early-Mid" },
    { value: "Early", label: "Early" },
  ] as const;

// Helper functions to get labels by value
export const getCiderCategoryLabel = (value: string | null): string => {
  const options = getCiderCategoryOptions();
  return options.find((option) => option.value === value)?.label || "";
};

export const getIntensityLabel = (value: string | null): string => {
  const options = getIntensityOptions();
  return options.find((option) => option.value === value)?.label || "";
};

export const getHarvestWindowLabel = (value: string | null): string => {
  const options = getHarvestWindowOptions();
  return options.find((option) => option.value === value)?.label || "";
};
