"use client";

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from "react";
import { trpc } from "@/utils/trpc";
import {
  formatDateWithPreferences,
  formatDateTimeWithPreferences,
  formatTimeWithPreferences,
  formatDateLongWithPreferences,
  type FormatPreferences,
} from "@/utils/date-format";

/**
 * Organization Settings Types
 */
export type VolumeUnits = "gallons" | "liters";
export type WeightUnits = "pounds" | "kilograms";
export type TemperatureUnits = "fahrenheit" | "celsius";
export type DensityUnits = "sg" | "brix" | "plato";
export type PressureUnits = "psi" | "bar";
export type DateFormat = "mdy" | "dmy" | "ymd";
export type TimeFormat = "12h" | "24h";
export type Theme = "light" | "dark" | "system";
export type ProductionScale = "nano" | "small" | "medium" | "large";

export interface OrganizationSettings {
  // Organization Profile
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo: string | null;

  // Business Identification Numbers
  ubiNumber: string | null; // Washington State Unified Business Identifier
  einNumber: string | null; // Federal Employer Identification Number
  ttbPermitNumber: string | null;
  stateLicenseNumber: string | null;

  // Operation Type
  fruitSource: string[];
  productionScale: ProductionScale;
  productTypes: string[];

  // Workflow Modules
  fruitPurchasesEnabled: boolean;
  pressRunsEnabled: boolean;
  juicePurchasesEnabled: boolean;
  barrelAgingEnabled: boolean;
  carbonationEnabled: boolean;
  bottleConditioningEnabled: boolean;
  keggingEnabled: boolean;
  bottlingEnabled: boolean;
  canningEnabled: boolean;
  ttbReportingEnabled: boolean;
  spiritsInventoryEnabled: boolean;

  // Packaging Config
  packageTypes: string[];
  carbonationMethods: string[];
  defaultTargetCO2: string;

  // Alert Thresholds
  stalledBatchDays: number;
  longAgingDays: number;
  lowInventoryThreshold: number;
  ttbReminderDays: number;

  // UX Preferences - Units
  volumeUnits: VolumeUnits;
  volumeShowSecondary: boolean;
  weightUnits: WeightUnits;
  weightShowSecondary: boolean;
  temperatureUnits: TemperatureUnits;
  temperatureShowSecondary: boolean;
  densityUnits: DensityUnits;
  densityShowSecondary: boolean;
  pressureUnits: PressureUnits;
  pressureShowSecondary: boolean;

  // UX Preferences - Display
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  theme: Theme;
  defaultCurrency: string;

  // UX Preferences - Decimal Places
  sgDecimalPlaces: number;
  phDecimalPlaces: number;

  // Measurement Corrections
  sgTemperatureCorrectionEnabled: boolean;
  hydrometerCalibrationTempC: string;
}

interface SettingsContextValue {
  settings: OrganizationSettings;
  isLoading: boolean;
  refetch: () => void;
}

const defaultSettings: OrganizationSettings = {
  name: "My Cidery",
  address: null,
  email: null,
  phone: null,
  website: null,
  logo: null,
  ubiNumber: null,
  einNumber: null,
  ttbPermitNumber: null,
  stateLicenseNumber: null,
  fruitSource: ["purchase_fruit"],
  productionScale: "small",
  productTypes: ["cider"],
  fruitPurchasesEnabled: true,
  pressRunsEnabled: true,
  juicePurchasesEnabled: true,
  barrelAgingEnabled: true,
  carbonationEnabled: true,
  bottleConditioningEnabled: false,
  keggingEnabled: true,
  bottlingEnabled: true,
  canningEnabled: false,
  ttbReportingEnabled: true,
  spiritsInventoryEnabled: false,
  packageTypes: ["bottle", "keg"],
  carbonationMethods: ["forced"],
  defaultTargetCO2: "2.70",
  stalledBatchDays: 14,
  longAgingDays: 90,
  lowInventoryThreshold: 24,
  ttbReminderDays: 7,
  volumeUnits: "gallons",
  volumeShowSecondary: false,
  weightUnits: "pounds",
  weightShowSecondary: false,
  temperatureUnits: "fahrenheit",
  temperatureShowSecondary: false,
  densityUnits: "sg",
  densityShowSecondary: false,
  pressureUnits: "psi",
  pressureShowSecondary: false,
  dateFormat: "mdy",
  timeFormat: "12h",
  theme: "system",
  defaultCurrency: "USD",
  sgDecimalPlaces: 3,
  phDecimalPlaces: 1,
  sgTemperatureCorrectionEnabled: true,
  hydrometerCalibrationTempC: "15.56",
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  isLoading: true,
  refetch: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const {
    data,
    isLoading,
    refetch,
  } = trpc.settings.getOrganizationSettings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const settings = useMemo<OrganizationSettings>(() => {
    if (!data) return defaultSettings;

    return {
      name: data.name,
      address: data.address,
      email: (data as any).email ?? null,
      phone: data.phone,
      website: data.website,
      logo: data.logo,
      ubiNumber: (data as any).ubiNumber ?? null,
      einNumber: (data as any).einNumber ?? null,
      ttbPermitNumber: data.ttbPermitNumber,
      stateLicenseNumber: data.stateLicenseNumber,
      fruitSource: data.fruitSource,
      productionScale: data.productionScale as ProductionScale,
      productTypes: data.productTypes,
      fruitPurchasesEnabled: data.fruitPurchasesEnabled,
      pressRunsEnabled: data.pressRunsEnabled,
      juicePurchasesEnabled: data.juicePurchasesEnabled,
      barrelAgingEnabled: data.barrelAgingEnabled,
      carbonationEnabled: data.carbonationEnabled,
      bottleConditioningEnabled: data.bottleConditioningEnabled,
      keggingEnabled: data.keggingEnabled,
      bottlingEnabled: data.bottlingEnabled,
      canningEnabled: data.canningEnabled,
      ttbReportingEnabled: data.ttbReportingEnabled,
      spiritsInventoryEnabled: data.spiritsInventoryEnabled,
      packageTypes: data.packageTypes,
      carbonationMethods: data.carbonationMethods,
      defaultTargetCO2: data.defaultTargetCO2,
      stalledBatchDays: data.stalledBatchDays,
      longAgingDays: data.longAgingDays,
      lowInventoryThreshold: data.lowInventoryThreshold,
      ttbReminderDays: data.ttbReminderDays,
      volumeUnits: data.volumeUnits as VolumeUnits,
      volumeShowSecondary: data.volumeShowSecondary,
      weightUnits: data.weightUnits as WeightUnits,
      weightShowSecondary: data.weightShowSecondary,
      temperatureUnits: data.temperatureUnits as TemperatureUnits,
      temperatureShowSecondary: data.temperatureShowSecondary,
      densityUnits: data.densityUnits as DensityUnits,
      densityShowSecondary: data.densityShowSecondary,
      pressureUnits: data.pressureUnits as PressureUnits,
      pressureShowSecondary: data.pressureShowSecondary,
      dateFormat: data.dateFormat as DateFormat,
      timeFormat: data.timeFormat as TimeFormat,
      theme: data.theme as Theme,
      defaultCurrency: data.defaultCurrency,
      sgDecimalPlaces: (data as any).sgDecimalPlaces ?? 3,
      phDecimalPlaces: (data as any).phDecimalPlaces ?? 1,
      sgTemperatureCorrectionEnabled: (data as any).sgTemperatureCorrectionEnabled ?? true,
      hydrometerCalibrationTempC: (data as any).hydrometerCalibrationTempC ?? "15.56",
    };
  }, [data]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      refetch,
    }),
    [settings, isLoading, refetch]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Hook to access organization settings
 */
export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

/**
 * Hook to access just the settings values
 */
export function useOrganizationSettings(): OrganizationSettings {
  const { settings } = useContext(SettingsContext);
  return settings;
}

/**
 * Hook to check if a workflow module is enabled
 */
export function useWorkflowEnabled(
  module:
    | "fruitPurchases"
    | "pressRuns"
    | "juicePurchases"
    | "barrelAging"
    | "carbonation"
    | "bottleConditioning"
    | "kegging"
    | "bottling"
    | "canning"
    | "ttbReporting"
    | "spiritsInventory"
): boolean {
  const { settings } = useContext(SettingsContext);
  const key = `${module}Enabled` as keyof OrganizationSettings;
  return settings[key] as boolean;
}

/**
 * Hook to access unit preferences
 */
export function useUnitPreferences() {
  const { settings } = useContext(SettingsContext);
  return {
    volume: {
      primary: settings.volumeUnits,
      showSecondary: settings.volumeShowSecondary,
    },
    weight: {
      primary: settings.weightUnits,
      showSecondary: settings.weightShowSecondary,
    },
    temperature: {
      primary: settings.temperatureUnits,
      showSecondary: settings.temperatureShowSecondary,
    },
    density: {
      primary: settings.densityUnits,
      showSecondary: settings.densityShowSecondary,
    },
    pressure: {
      primary: settings.pressureUnits,
      showSecondary: settings.pressureShowSecondary,
    },
  };
}

/**
 * Hook to access display preferences
 */
export function useDisplayPreferences() {
  const { settings } = useContext(SettingsContext);
  return {
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    theme: settings.theme,
    currency: settings.defaultCurrency,
  };
}

/**
 * Hook to get date formatting functions that use user preferences
 * Returns memoized formatting functions that automatically use the user's
 * date format, time format, and timezone preferences
 */
export function useDateFormatter() {
  const { settings } = useContext(SettingsContext);

  const preferences: FormatPreferences = useMemo(() => ({
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    // timezone will be added when we integrate with TimezoneContext
  }), [settings.dateFormat, settings.timeFormat]);

  const formatDate = useCallback(
    (date: string | Date) => formatDateWithPreferences(date, preferences),
    [preferences]
  );

  const formatDateTime = useCallback(
    (date: string | Date) => formatDateTimeWithPreferences(date, preferences),
    [preferences]
  );

  const formatTime = useCallback(
    (date: string | Date) => formatTimeWithPreferences(date, preferences),
    [preferences]
  );

  const formatDateLong = useCallback(
    (date: string | Date) => formatDateLongWithPreferences(date, preferences),
    [preferences]
  );

  return {
    formatDate,
    formatDateTime,
    formatTime,
    formatDateLong,
    preferences,
  };
}
