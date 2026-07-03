"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { formatDate as formatDateUtil } from "@/utils/date-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { LastActivityHint } from "@/components/ui/LastActivityHint";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Package, AlertTriangle, Calculator } from "lucide-react";
import { additiveRateGramsPerL } from "lib/src/units/conversions";
import { SO2Calculator } from "./SO2Calculator";
import { AdditiveCalculatorPanel } from "./AdditiveCalculatorPanel";
import { useDateFormat } from "@/hooks/useDateFormat";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AddBatchAdditiveFormProps {
  batchId: string;
  onSuccess: () => void;
  onCancel: () => void;
  /** Recipe-planned values to prefill (e.g. Cascade Hops @ 1.5 g/L = 180 g). */
  prefillAdditiveType?: string | null;
  prefillVarietyName?: string | null;
  prefillDosageRate?: number | null;
  prefillDosageRateUnit?: string | null;
  prefillAmount?: number | null;
  prefillUnit?: string | null;
  /** Planned batch volume (L) for the g/L translation when the batch has no
   *  measurement yet (e.g. a freshly instantiated recipe batch). */
  prefillBatchVolumeL?: number | null;
}

// Grouped so absolute amounts and concentrations can be visually separated
// in the dropdown. Removed `mg/L` (every historical use was a typo for g/L)
// and `units` (never used, ambiguous). Added `oz` for small flavorings.
const unitGroups: Array<{ groupLabel: string; options: { value: string; label: string }[] }> = [
  {
    groupLabel: "Weight",
    options: [
      { value: "g",   label: "Grams (g)" },
      { value: "kg",  label: "Kilograms (kg)" },
      { value: "oz",  label: "Ounces (oz)" },
      { value: "lbs", label: "Pounds (lbs)" },
    ],
  },
  {
    groupLabel: "Volume",
    options: [
      { value: "ml", label: "Milliliters (mL)" },
      { value: "L",  label: "Liters (L)" },
    ],
  },
  {
    groupLabel: "Concentration",
    options: [
      { value: "g/L", label: "Grams per liter (g/L)" },
      { value: "ppm", label: "Parts per million (ppm)" },
    ],
  },
];

// Flat list for places that just need to iterate all options.
const units = unitGroups.flatMap((g) => g.options);

/**
 * Sanity-check rules. Returns a warning message when the entered amount is
 * implausibly low for the given additive type, otherwise null. Operators can
 * always confirm-and-proceed past the warning.
 *
 * Rule of thumb (g/L of total batch volume):
 *   Fermentation Organisms (yeast):  typical 0.5-2 g/L,  warn below 0.1 g/L
 *   Sugar & Sweeteners / Fruit:      typical 50-200 g/L, warn below 5 g/L
 *   Acids / Preservatives / others:  typical < 1 g/L,    no warning (small
 *                                    doses are normal)
 */
function computeSanityWarning(
  additiveType: string,
  amount: number,
  unit: string,
  batchVolumeL: number | null,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!batchVolumeL || batchVolumeL <= 0) return null;

  // Convert amount to total grams and concentration in g/L.
  let totalGrams: number | null = null;
  const u = unit.toLowerCase();
  if (u === "g")        totalGrams = amount;
  else if (u === "kg")  totalGrams = amount * 1000;
  else if (u === "oz")  totalGrams = amount * 28.3495;
  else if (u === "lbs" || u === "lb") totalGrams = amount * 453.592;
  else if (u === "g/l") totalGrams = amount * batchVolumeL;
  else if (u === "ppm") totalGrams = (amount * batchVolumeL) / 1000; // 1 ppm = 1 mg/L
  // mL / L not convertible to mass without density — skip

  if (totalGrams === null) return null;
  const gPerL = totalGrams / batchVolumeL;

  // Per-type minimum thresholds. Below these warns.
  let minGPerL = 0;
  if (additiveType === "Fermentation Organisms") minGPerL = 0.1;
  else if (additiveType === "Sugar & Sweeteners" || additiveType === "Fruit/Fruit Product") minGPerL = 5;
  // Other types: no minimum (acids/preservatives/enzymes/nutrients are
  // legitimately very small doses)

  if (gPerL < minGPerL) {
    return (
      `That works out to ${totalGrams.toFixed(2)} g across ${batchVolumeL.toFixed(1)}L ` +
      `(= ${gPerL.toFixed(3)} g/L).`
    );
  }
  return null;
}

const additiveTypes = [
  { value: "Fermentation Organisms", label: "Fermentation Organisms" },
  { value: "Sugar & Sweeteners", label: "Sugar & Sweeteners" },
  { value: "Fruit/Fruit Product", label: "Fruit / Fruit Product" },
  { value: "Flavorings & Adjuncts", label: "Flavorings & Adjuncts" },
  { value: "Enzymes", label: "Enzymes" },
  { value: "Nutrients", label: "Nutrients" },
  { value: "Acids", label: "Acids" },
  { value: "Tannins & Mouthfeel", label: "Tannins & Mouthfeel" },
  { value: "Preservatives", label: "Preservatives" },
];

/** Types that commonly use dosage rate calculations */
const DOSAGE_RATE_TYPES = new Set(["Enzymes", "Nutrients", "Acids"]);

/** Available dosage rate units */
const dosageRateUnits = [
  { value: "mL/L", label: "mL/L", outputUnit: "ml" },
  { value: "g/L", label: "g/L", outputUnit: "g" },
  { value: "g/hL", label: "g/hL", outputUnit: "g" },
];

export function AddBatchAdditiveForm({
  batchId,
  onSuccess,
  onCancel,
  prefillAdditiveType,
  prefillVarietyName,
  prefillDosageRate,
  prefillDosageRateUnit,
  prefillAmount,
  prefillUnit,
  prefillBatchVolumeL,
}: AddBatchAdditiveFormProps) {
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  // Seed initial state from recipe prefill (more robust than a post-mount
  // effect, which races with the form's own type/inventory logic on a Select).
  const [selectedAdditiveType, setSelectedAdditiveType] = useState(prefillAdditiveType ?? "");
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  const [amount, setAmount] = useState(prefillAmount != null ? String(prefillAmount) : "");
  const [unit, setUnit] = useState(prefillUnit ?? "");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [addedDate, setAddedDate] = useState(() => {
    return formatDateTimeForInput(new Date());
  });
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [dosageRate, setDosageRate] = useState(prefillDosageRate != null ? String(prefillDosageRate) : "");
  const [dosageRateUnit, setDosageRateUnit] = useState(prefillDosageRateUnit ?? "mL/L");
  const [isApplePearFruit, setIsApplePearFruit] = useState(false);
  /**
   * Liters this addition contributes to the batch volume. Defaults from the
   * additive_volume_defaults table when an ingredient with a known density
   * is picked (honey, brandy, fruit purée, etc.). Operator can override.
   * Empty string = treated as 0 / not contributing.
   */
  const [volumeContributionL, setVolumeContributionL] = useState("");
  const [volumeContributionAutoSet, setVolumeContributionAutoSet] = useState(false);

  // Date validation
  const { validateDate } = useBatchDateValidation(batchId);

  // Fetch batch history to get measurements with volume
  const { data: batchHistory } = trpc.batch.getHistory.useQuery(
    { batchId },
    { enabled: !!batchId }
  );

  // Get batch volume in liters from most recent measurement
  const batchVolumeLiters = useMemo(() => {
    if (!batchHistory?.measurements?.length) return null;
    // Find the most recent measurement with volume
    const measurementWithVolume = batchHistory.measurements.find(m => m.volume);
    if (!measurementWithVolume?.volume) return null;

    const volume = parseFloat(String(measurementWithVolume.volume));
    // Volume unit in measurements is typically L (liters)
    return volume;
  }, [batchHistory]);

  // Volume to use for the g/L translation: the batch's measured volume, or the
  // recipe-planned volume when the batch has no measurement yet.
  const effectiveBatchVolumeL =
    batchVolumeLiters ??
    (prefillBatchVolumeL && prefillBatchVolumeL > 0 ? prefillBatchVolumeL : null);

  // Live concentration translation: turns the entered amount + unit into g/L
  // (or mL/L) of the batch, so "32500 g" reads as "= 100.0 g/L of 325 L". It
  // recomputes as the operator edits the amount.
  const concentration = useMemo(() => {
    const n = parseFloat(amount);
    const vol = effectiveBatchVolumeL;
    if (!Number.isFinite(n) || n <= 0 || !vol || vol <= 0 || !unit) return null;
    const u = unit.toLowerCase();
    // Liquid-volume additions: show mL/L of batch (display only — no mass
    // intensity is persisted for these).
    if (u === "ml" || u === "l") {
      const ml = u === "ml" ? n : n * 1000;
      return { value: ml / vol, label: "mL/L", vol };
    }
    if (u === "ppm") return { value: n, label: "ppm", vol };
    // Mass units + g/L: use the SAME canonical helper the server persists as
    // rate_grams_per_l, so this preview always equals what gets stored (and the
    // "lbs"/"g/L" unit strings are normalized in one place).
    const rate = additiveRateGramsPerL(n, unit, vol);
    if (rate != null) return { value: rate, label: "g/L", vol };
    return null;
  }, [amount, unit, effectiveBatchVolumeL]);

  // Fetch available additive inventory items, filtered by type
  const { data: inventoryData, isLoading: isLoadingInventory } =
    trpc.additivePurchases.listInventory.useQuery(
      {
        itemType: selectedAdditiveType,
        onlyAvailable: true,
      },
      {
        enabled: !!selectedAdditiveType,
      },
    );

  // Once the type's inventory loads, auto-select the lot matching the recipe
  // variety — only when there's exactly one, to avoid guessing.
  React.useEffect(() => {
    if (!prefillVarietyName || selectedInventoryItem) return;
    const items = inventoryData?.items ?? [];
    const matches = items.filter(
      (i: any) => (i.varietyName || i.productName) === prefillVarietyName,
    );
    if (matches.length === 1) setSelectedInventoryItem(matches[0]);
  }, [inventoryData, prefillVarietyName, selectedInventoryItem]);

  // Detect if the selected inventory item is a sulfite product (KMS)
  const isSulfiteProduct = useMemo(() => {
    if (!selectedInventoryItem) return false;
    const name = (
      (selectedInventoryItem.varietyName || "") +
      " " +
      (selectedInventoryItem.productName || "")
    ).toLowerCase();
    return (
      name.includes("metabisulfite") ||
      name.includes("sulfite") ||
      name.includes("kms") ||
      name.includes("campden")
    );
  }, [selectedInventoryItem]);

  // Show dosage calculator for enzyme/nutrient/acid types
  const showDosageCalculator = useMemo(() => {
    return DOSAGE_RATE_TYPES.has(selectedAdditiveType) && batchVolumeLiters;
  }, [selectedAdditiveType, batchVolumeLiters]);

  // Look up the default density for the selected additive type + name combo.
  // Returns null when no rule matches (typical for yeast/nutrients/acids).
  const additiveName =
    selectedInventoryItem?.varietyName || selectedInventoryItem?.productName || "";
  const { data: volumeDefault } = trpc.settings.lookupVolumeDefault.useQuery(
    { additiveType: selectedAdditiveType, additiveName },
    { enabled: !!selectedAdditiveType && !!additiveName },
  );

  // Convert the entered amount to kg so we can apply the density (if any).
  // Dosage-rate units (g/L, mL/L, g/hL) need batchVolumeLiters to convert; we
  // handle those here too so the operator gets correct auto-fill instead of a
  // blank field they might fill in with the wrong number (the bug that caused
  // a +100L overshoot on a Strawberry Rhubarb batch in May 2026).
  const amountAsKg = useMemo(() => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    const u = unit?.toLowerCase();
    if (u === "kg")  return n;
    if (u === "g")   return n / 1000;
    if (u === "lb" || u === "lbs") return n * 0.453592;
    if (u === "oz")  return n * 0.0283495;
    if (batchVolumeLiters) {
      if (u === "g/l")   return (n * batchVolumeLiters) / 1000;
      if (u === "g/hl")  return (n * batchVolumeLiters) / 100_000;
    }
    return null; // mass unknown — can't auto-compute volume
  }, [amount, unit, batchVolumeLiters]);

  // mL/L is a volume rate — convert directly to liters, no density needed.
  const amountAsL = useMemo(() => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    const u = unit?.toLowerCase();
    if (u === "ml")  return n / 1000;
    if (u === "l")   return n;
    if (u === "gal") return n * 3.78541;
    if (u === "ml/l" && batchVolumeLiters) return (n * batchVolumeLiters) / 1000;
    return null;
  }, [amount, unit, batchVolumeLiters]);

  // Whether the current unit is one we can convert without ambiguity. We use
  // this to gate visibility of the Volume Contribution field — if the unit is
  // something we can't auto-derive volume from, hiding the field prevents the
  // operator from typing a wrong number into a box they don't understand.
  const canAutoComputeVolume = amountAsKg !== null || amountAsL !== null;

  // Auto-fill volume contribution from density × mass (or direct volume) when:
  //   1. We have a matching default density rule
  //   2. We have a unit we can convert
  //   3. The operator hasn't manually overridden the value
  React.useEffect(() => {
    if (!volumeDefault) return;
    if (volumeContributionL && !volumeContributionAutoSet) return; // user override
    let computedL: number | null = null;
    if (amountAsL !== null) {
      computedL = amountAsL; // direct volume — density not needed
    } else if (amountAsKg !== null) {
      computedL = amountAsKg / volumeDefault.densityKgPerL;
    }
    if (computedL !== null) {
      setVolumeContributionL(computedL.toFixed(2));
      setVolumeContributionAutoSet(true);
    }
  }, [volumeDefault, amountAsKg, amountAsL, volumeContributionL, volumeContributionAutoSet]);

  // Extract latest pH from batch measurements
  const latestPH = useMemo(() => {
    if (!batchHistory?.measurements?.length) return null;
    const withPH = batchHistory.measurements.find(
      (m: any) => m.ph != null,
    );
    if (!withPH?.ph) return null;
    return parseFloat(String(withPH.ph));
  }, [batchHistory]);

  // Previous sulfite additions for running totals
  const previousSulfiteAdditions = useMemo(() => {
    if (!batchHistory) return [];
    const allAdditives = [
      ...(batchHistory.additives || []),
      ...(batchHistory.blendSourceAdditives || []),
    ];
    return allAdditives.filter((a) => {
      const name = (a.additiveName || "").toLowerCase();
      return (
        name.includes("metabisulfite") ||
        name.includes("sulfite") ||
        name.includes("kms") ||
        name.includes("campden")
      );
    });
  }, [batchHistory]);

  // Handler for SO2 calculator "Use Calculated Amount" button
  const handleUseSO2Calculation = (grams: number, calculatedUnit: string, calculatedNotes: string) => {
    setAmount(String(grams));
    setUnit(calculatedUnit);
    setNotes(calculatedNotes);
    setDosageRate("");
  };

  // Filter inventory items by search query
  const filteredInventory = useMemo(() => {
    if (!inventoryData?.items) return [];
    if (!searchQuery) return inventoryData.items;

    const query = searchQuery.toLowerCase();
    return inventoryData.items.filter(
      (item) =>
        item.varietyName?.toLowerCase().includes(query) ||
        item.productName?.toLowerCase().includes(query) ||
        item.brandManufacturer?.toLowerCase().includes(query) ||
        item.vendorName?.toLowerCase().includes(query)
    );
  }, [inventoryData?.items, searchQuery]);

  const utils = trpc.useUtils();

  const addAdditive = trpc.batch.addAdditive.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.reclassifiedAsWine
          ? "Additive recorded — batch reclassified as wine for TTB purposes"
          : data.estimatedMeasurement
          ? "Additive recorded with estimated SG and ABV measurement"
          : "Additive recorded successfully",
      });
      // Invalidate inventory queries to reflect the usage
      utils.additivePurchases.listInventory.invalidate();
      utils.additivePurchases.list.invalidate();
      // Invalidate batch data if reclassified
      if (data.reclassifiedAsWine) {
        utils.batch.invalidate();
      }
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add additive",
        variant: "destructive",
      });
    },
  });

  const handleAdditiveTypeChange = (value: string) => {
    setSelectedAdditiveType(value);
    // Reset inventory item selection when type changes
    setSelectedInventoryItem(null);
    setUnit("");
    setSearchQuery("");
    setIsApplePearFruit(false);
    setDosageRate("");
    // Clear volume contribution so the next selection re-derives it.
    setVolumeContributionL("");
    setVolumeContributionAutoSet(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdditiveType || !selectedInventoryItem || !amount || !unit || !addedDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const parsedAmount = parseFloat(amount);

    // Only compare if units match - otherwise allow (API will validate)
    if (unit === selectedInventoryItem.unit && parsedAmount > selectedInventoryItem.availableQuantity) {
      toast({
        title: "Error",
        description: `Amount exceeds available quantity (${selectedInventoryItem.availableQuantity.toFixed(2)} ${selectedInventoryItem.unit} available)`,
        variant: "destructive",
      });
      return;
    }

    // Use the user's dropdown selection as the authoritative type for classification purposes
    // (varietyItemType from inventory can differ, e.g., "Flavorings & Adjuncts" for a fruit item)
    const additiveType = selectedAdditiveType;
    const additiveName = selectedInventoryItem.varietyName || selectedInventoryItem.productName || "Unknown";

    if (!additiveType || !additiveName) {
      toast({
        title: "Error",
        description: "Could not determine additive type or name. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Volume contribution: zero/empty/garbage = don't pass.
    const parsedVolumeL = parseFloat(volumeContributionL);
    const includeVolume = Number.isFinite(parsedVolumeL) && parsedVolumeL > 0;

    // ─── Sanity guard ────────────────────────────────────────────────────
    // Convert the amount to grams-per-liter and warn if it's implausibly low
    // for the additive type. Two big historical errors we've cleaned up:
    //   - Yeast at 0.05 g/L (should be ~1 g/L) → 20× under-pitched
    //   - mg/L picked instead of g/L (already removed from picker)
    // We warn — don't block — because edge cases exist (sample additions,
    // calibration runs, etc.) and the operator might really mean it.
    const sanityWarning = computeSanityWarning(
      additiveType,
      parsedAmount,
      unit,
      batchVolumeLiters,
    );
    if (sanityWarning) {
      const ok = window.confirm(
        `${sanityWarning}\n\nThis is unusually low for "${additiveType}". ` +
          `Continue anyway?`,
      );
      if (!ok) return;
    }
    // ─────────────────────────────────────────────────────────────────────

    const additiveData = {
      batchId,
      additiveType,
      additiveName,
      amount: parsedAmount,
      unit,
      addedAt: parseDateTimeFromInput(addedDate),
      notes: notes || undefined,
      // This is the key - pass the purchase item ID to decrement inventory
      additivePurchaseItemId: selectedInventoryItem.id,
      // Also pass cost for COGS calculation
      costPerUnit: selectedInventoryItem.pricePerUnit ? parseFloat(selectedInventoryItem.pricePerUnit) : undefined,
      // Volume contribution (honey, brandy, fruit purée, etc.). When > 0,
      // the API also bumps batch.current_volume and writes an audit row.
      ...(includeVolume ? { volumeAddedL: parsedVolumeL } : {}),
      // Fruit additive classification (TTB IC 17-2)
      ...(additiveType === "Fruit/Fruit Product" ? { isApplePearFruit } : {}),
    };

    addAdditive.mutate(additiveData);
  };

  const handleSelectInventoryItem = (itemId: string) => {
    const item = filteredInventory.find((i) => i.id === itemId);
    if (item) {
      setSelectedInventoryItem(item);
      // Auto-set the unit from the inventory item
      setUnit(item.unit);
      setOpen(false);
    }
  };

  // Handle dosage rate change - calculate amount from rate * volume
  const handleDosageRateChange = (rate: string) => {
    setDosageRate(rate);
    const rateNum = parseFloat(rate);
    if (!isNaN(rateNum) && rateNum > 0 && batchVolumeLiters) {
      const rateConfig = dosageRateUnits.find((u) => u.value === dosageRateUnit);
      if (!rateConfig) return;
      let calculatedAmount: number;
      if (dosageRateUnit === "g/hL") {
        // g per hectoliter: amount = rate * (volume / 100)
        calculatedAmount = rateNum * (batchVolumeLiters / 100);
      } else {
        // mL/L or g/L: amount = rate * volume
        calculatedAmount = rateNum * batchVolumeLiters;
      }
      setAmount(calculatedAmount.toFixed(1));
      setUnit(rateConfig.outputUnit);
    }
  };

  // Recalculate when dosage rate unit changes
  const handleDosageRateUnitChange = (newUnit: string) => {
    setDosageRateUnit(newUnit);
    // Recalculate with existing rate if set
    const rateNum = parseFloat(dosageRate);
    if (!isNaN(rateNum) && rateNum > 0 && batchVolumeLiters) {
      const rateConfig = dosageRateUnits.find((u) => u.value === newUnit);
      if (!rateConfig) return;
      let calculatedAmount: number;
      if (newUnit === "g/hL") {
        calculatedAmount = rateNum * (batchVolumeLiters / 100);
      } else {
        calculatedAmount = rateNum * batchVolumeLiters;
      }
      setAmount(calculatedAmount.toFixed(1));
      setUnit(rateConfig.outputUnit);
    }
  };

  // Calculate display value for the dosage result
  const calculatedDosage = useMemo(() => {
    const rateNum = parseFloat(dosageRate);
    if (!isNaN(rateNum) && rateNum > 0 && batchVolumeLiters) {
      if (dosageRateUnit === "g/hL") {
        return rateNum * (batchVolumeLiters / 100);
      }
      return rateNum * batchVolumeLiters;
    }
    return null;
  }, [dosageRate, dosageRateUnit, batchVolumeLiters]);

  const dosageOutputUnit = useMemo(() => {
    return dosageRateUnits.find((u) => u.value === dosageRateUnit)?.outputUnit ?? "ml";
  }, [dosageRateUnit]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return formatDateUtil(dateStr);
    } catch {
      return dateStr;
    }
  };

  const dosageFormulaDisplay = useMemo(() => {
    if (!batchVolumeLiters || calculatedDosage === null) return null;
    if (dosageRateUnit === "g/hL") {
      return `${dosageRate} g/hL × ${(batchVolumeLiters / 100).toFixed(2)} hL`;
    }
    return `${dosageRate} ${dosageRateUnit} × ${batchVolumeLiters.toLocaleString()} L`;
  }, [dosageRate, dosageRateUnit, batchVolumeLiters, calculatedDosage]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="additiveType">Additive Type *</Label>
        <Select
          value={selectedAdditiveType}
          onValueChange={handleAdditiveTypeChange}
        >
          <SelectTrigger id="additiveType">
            <SelectValue placeholder="Select additive type" />
          </SelectTrigger>
          <SelectContent>
            {additiveTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAdditiveType === "Sugar & Sweeteners" && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
            <p className="font-medium">Auto-calculation enabled</p>
            <p className="mt-1 text-blue-800">
              Adding sugar will automatically create an estimated SG and ABV measurement based on the current vessel volume and most recent measurement.
            </p>
            <p className="mt-1 text-xs text-blue-700">
              The calculation assumes full fermentation of the added sugar.
            </p>
          </div>
        )}
        {selectedAdditiveType === "Fruit/Fruit Product" && (
          <div className="mt-2 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isApplePearFruit"
                checked={isApplePearFruit}
                onCheckedChange={(checked) => setIsApplePearFruit(checked === true)}
              />
              <Label htmlFor="isApplePearFruit" className="text-sm font-normal cursor-pointer">
                Apple or pear fruit only
              </Label>
            </div>
            {!isApplePearFruit && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
                <p className="font-medium">TTB Reclassification</p>
                <p className="mt-1 text-amber-800">
                  Adding non-apple/pear fruit to a cider or perry batch will reclassify it as wine for TTB purposes (per Industry Circular 17-2). The ABV and carbonation will determine the specific tax class.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAdditiveType && (
        <div className="space-y-2">
          <Label>Select from Inventory *</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={!selectedAdditiveType}
                className="w-full justify-between text-left font-normal h-auto min-h-10"
              >
                {selectedInventoryItem ? (
                  <div className="flex items-center justify-between w-full py-1">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{selectedInventoryItem.varietyName || selectedInventoryItem.productName}</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedInventoryItem.brandManufacturer} • {selectedInventoryItem.vendorName}
                      </span>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {selectedInventoryItem.availableQuantity.toFixed(2)} {selectedInventoryItem.unit}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    {selectedAdditiveType
                      ? `Search ${selectedAdditiveType.toLowerCase()} in inventory...`
                      : "Select additive type first..."}
                  </span>
                )}
                <Package className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 z-[200]" align="start" side="bottom" sideOffset={4} avoidCollisions={true} collisionPadding={16}>
              <Command>
                <CommandInput
                  placeholder={`Search ${selectedAdditiveType.toLowerCase()} inventory...`}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain">
                  {isLoadingInventory && (
                    <CommandEmpty>
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading inventory...
                      </div>
                    </CommandEmpty>
                  )}
                  {!isLoadingInventory && filteredInventory.length === 0 && (
                    <CommandEmpty>
                      <div className="py-6 text-center">
                        <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {selectedAdditiveType
                            ? `No ${selectedAdditiveType.toLowerCase()} found in inventory.`
                            : "Select an additive type first."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Purchase additives in Inventory → Additives to add stock.
                        </p>
                      </div>
                    </CommandEmpty>
                  )}
                  {!isLoadingInventory && filteredInventory.length > 0 && (
                    <CommandGroup heading="Available Inventory">
                      {filteredInventory.map((item) => {
                        const isLowStock = item.availableQuantity < item.quantity * 0.2;
                        const expirationDate = formatDate(item.expirationDate);
                        const isExpiringSoon = item.expirationDate &&
                          new Date(item.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                        return (
                          <CommandItem
                            key={item.id}
                            value={`${item.varietyName} ${item.productName} ${item.brandManufacturer}`}
                            onSelect={() => handleSelectInventoryItem(item.id)}
                            className="py-2"
                          >
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {item.varietyName || item.productName}
                                </span>
                                <Badge
                                  variant={isLowStock ? "destructive" : "secondary"}
                                  className="ml-2"
                                >
                                  {item.availableQuantity.toFixed(2)} {item.unit}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {item.brandManufacturer && `${item.brandManufacturer} • `}
                                {item.vendorName}
                                {item.lotBatchNumber && ` • Lot: ${item.lotBatchNumber}`}
                              </div>
                              {(expirationDate || isLowStock) && (
                                <div className="flex items-center gap-2 mt-1">
                                  {expirationDate && (
                                    <span className={cn(
                                      "text-xs",
                                      isExpiringSoon ? "text-orange-600" : "text-muted-foreground"
                                    )}>
                                      Exp: {expirationDate}
                                    </span>
                                  )}
                                  {isLowStock && (
                                    <span className="text-xs text-red-600 flex items-center">
                                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                                      Low stock
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedInventoryItem && (
            <div className="mt-2 p-3 bg-muted rounded-md text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {selectedInventoryItem.varietyName || selectedInventoryItem.productName}
                </span>
                <Badge variant="outline">
                  Available: {selectedInventoryItem.availableQuantity.toFixed(2)} {selectedInventoryItem.unit}
                </Badge>
              </div>
              <div className="text-muted-foreground space-y-1 text-xs">
                {selectedInventoryItem.brandManufacturer && (
                  <div>Brand: {selectedInventoryItem.brandManufacturer}</div>
                )}
                <div>Vendor: {selectedInventoryItem.vendorName}</div>
                {selectedInventoryItem.lotBatchNumber && (
                  <div>Lot #: {selectedInventoryItem.lotBatchNumber}</div>
                )}
                {selectedInventoryItem.expirationDate && (
                  <div>Expires: {formatDate(selectedInventoryItem.expirationDate)}</div>
                )}
                {selectedInventoryItem.pricePerUnit && (
                  <div>Cost: ${parseFloat(selectedInventoryItem.pricePerUnit).toFixed(4)}/{selectedInventoryItem.unit}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SO2 Calculator - shown when a sulfite product is selected */}
      {isSulfiteProduct && (
        <SO2Calculator
          batchVolumeLiters={batchVolumeLiters}
          batchPH={latestPH}
          previousAdditions={previousSulfiteAdditions}
          onUseCalculatedAmount={handleUseSO2Calculation}
        />
      )}

      {/* Dosage Rate Calculator - shown for enzymes, nutrients, acids */}
      {showDosageCalculator && (
        <AdditiveCalculatorPanel
          title="Dosage Calculator"
          icon={<Calculator className="h-4 w-4 text-blue-600" />}
        >
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Batch volume: {batchVolumeLiters!.toLocaleString()} L
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter rate"
                  value={dosageRate}
                  onChange={(e) => handleDosageRateChange(e.target.value)}
                  className="h-9"
                />
              </div>
              <Select value={dosageRateUnit} onValueChange={handleDosageRateUnitChange}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dosageRateUnits.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {calculatedDosage !== null && dosageFormulaDisplay && (
              <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                {dosageFormulaDisplay} = <strong>{calculatedDosage.toFixed(1)} {dosageOutputUnit}</strong>
              </div>
            )}
          </div>
        </AdditiveCalculatorPanel>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.001"
            placeholder="0.000"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              // Clear dosage rate when manually entering amount
              setDosageRate("");
            }}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Unit *</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {unitGroups.map((group, gi) => (
                <React.Fragment key={group.groupLabel}>
                  {gi > 0 && <SelectSeparator />}
                  <SelectGroup>
                    <SelectLabel>{group.groupLabel}</SelectLabel>
                    {group.options.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {concentration && (
        <p className="text-xs text-muted-foreground -mt-2">
          ={" "}
          <span className="font-medium text-foreground">
            {concentration.value.toFixed(1)} {concentration.label}
          </span>{" "}
          across {concentration.vol.toLocaleString()} L batch
        </p>
      )}

      {/* Volume contribution — only shown when the selected ingredient has a
          known density AND we can convert the amount into a volume without
          ambiguity (or operator has already typed a value). For unsupported
          units we hide the field entirely to prevent the operator from
          typing a wrong number into a confusing box. */}
      {((volumeDefault && canAutoComputeVolume) || volumeContributionL) && (
        <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/50 p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="volumeContribution" className="text-sm font-medium">
              Volume contribution to batch (L)
            </Label>
            {volumeDefault && (
              <span className="text-xs text-blue-700">
                Auto-derived from {volumeDefault.displayLabel} density (
                {volumeDefault.densityKgPerL} kg/L)
              </span>
            )}
          </div>
          <Input
            id="volumeContribution"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={volumeContributionL}
            onChange={(e) => {
              setVolumeContributionL(e.target.value);
              setVolumeContributionAutoSet(false);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Liters of liquid this addition adds to the batch (e.g. honey,
            brandy, fruit purée). Leave 0 / blank for additives with negligible
            volume (yeast, nutrients, acids). When &gt; 0, the batch&apos;s
            current volume is bumped automatically.
            {volumeDefault?.notes && (
              <>
                <br />
                <span className="italic">{volumeDefault.notes}</span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="addedDate">Date & Time Added *</Label>
        <Input
          id="addedDate"
          type="datetime-local"
          value={addedDate}
          onChange={(e) => {
            setAddedDate(e.target.value);
            const result = validateDate(e.target.value);
            setDateWarning(result.warning);
          }}
          required
        />
        <DateWarning warning={dateWarning} />
        <LastActivityHint batchId={batchId} date={addedDate} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional information about this addition..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={addAdditive.isPending}>
          {addAdditive.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add Additive
        </Button>
      </div>
    </form>
  );
}
