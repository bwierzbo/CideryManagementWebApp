"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Beaker,
  Scale,
  Droplets,
  Clock,
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { formatDate, formatDateForInput } from "@/utils/date-format";
import { gallonsToLiters, litersToGallons } from "lib";
import {
  WeightDisplay,
  convertWeight,
  normalizeUnit,
  formatUnit,
  toKg,
  type WeightUnit,
} from "@/components/ui/weight-display";

// Type for selected inventory items
interface InventorySelection {
  purchaseItemId: string;
  fruitVarietyId: string;
  vendorId: string;
  vendorName: string;
  varietyName: string;
  availableKg: number;
  useQuantityKg: number;
  useAll: boolean;
}

// Type for vessel assignments
interface VesselAssignment {
  toVesselId: string;
  volumeL: number;
  transferLossL: number;
  transferLossNotes: string;
}

export default function BuildPressRunPage() {
  const router = useRouter();

  // State
  const [vendorFilter, setVendorFilter] = useState("");
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Map<string, InventorySelection>>(new Map());
  const [vendorWeightUnits, setVendorWeightUnits] = useState<Map<string, WeightUnit>>(new Map());
  const [completionDate, setCompletionDate] = useState(formatDateForInput(new Date()));
  const [totalJuiceVolumeL, setTotalJuiceVolumeL] = useState<number>(0);
  const [juiceVolumeUnit, setJuiceVolumeUnit] = useState<"L" | "gal">("L");
  const [assignments, setAssignments] = useState<VesselAssignment[]>([
    { toVesselId: "", volumeL: 0, transferLossL: 0, transferLossNotes: "" },
  ]);
  const [vesselVolumeUnit, setVesselVolumeUnit] = useState<"L" | "gal">("L");
  const [laborHours, setLaborHours] = useState<number | undefined>();
  const [workerCount, setWorkerCount] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [successData, setSuccessData] = useState<{ pressRunName: string; batchIds: string[] } | null>(null);

  // Queries
  const { data: inventoryData, isLoading: inventoryLoading } = trpc.pressRun.getInventoryGroupedByVendor.useQuery({
    vendorFilter: vendorFilter || undefined,
  });

  const { data: vesselsData, isLoading: vesselsLoading } = trpc.vessel.listWithBatches.useQuery();

  // Mutation
  const createMutation = trpc.pressRun.createWithInventory.useMutation({
    onSuccess: (data) => {
      setSuccessData({ pressRunName: data.pressRunName, batchIds: data.batchIds });
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  // Computed values
  const totalSelectedKg = useMemo(() => {
    return Array.from(selections.values()).reduce((sum, s) => sum + s.useQuantityKg, 0);
  }, [selections]);

  const selectedItemCount = selections.size;

  const totalAssignedVolumeL = useMemo(() => {
    return assignments.reduce((sum, a) => sum + (a.volumeL || 0), 0);
  }, [assignments]);

  const totalTransferLossL = useMemo(() => {
    return assignments.reduce((sum, a) => sum + (a.transferLossL || 0), 0);
  }, [assignments]);

  const availableVessels = useMemo(() => {
    if (!vesselsData?.vessels) return [];
    return vesselsData.vessels.map((vessel) => {
      const capacity = parseFloat(vessel.capacity?.toString() || "0");
      const remainingCapacityL = parseFloat(vessel.remainingCapacityL?.toString() || "0");
      const currentVolume = capacity - remainingCapacityL;
      return {
        id: vessel.id,
        name: vessel.name || "Unnamed",
        capacity,
        currentVolume,
        remainingCapacityL,
        currentBatch: vessel.currentBatch,
      };
    });
  }, [vesselsData]);

  const filteredVendors = useMemo(() => {
    if (!inventoryData?.vendors) return [];
    if (!vendorFilter) return inventoryData.vendors;
    return inventoryData.vendors.filter((v) =>
      v.vendorName.toLowerCase().includes(vendorFilter.toLowerCase())
    );
  }, [inventoryData, vendorFilter]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (selections.size === 0) {
      errors.push("Select at least one inventory item");
    }

    for (const [, selection] of selections) {
      if (selection.useQuantityKg > selection.availableKg) {
        errors.push(`${selection.varietyName}: quantity exceeds available`);
      }
      if (selection.useQuantityKg <= 0) {
        errors.push(`${selection.varietyName}: quantity must be positive`);
      }
    }

    if (totalJuiceVolumeL <= 0) {
      errors.push("Total juice volume must be greater than 0");
    }

    if (!assignments.some((a) => a.toVesselId && a.volumeL > 0)) {
      errors.push("At least one vessel assignment is required");
    }

    if (totalAssignedVolumeL > totalJuiceVolumeL + 0.02) {
      errors.push("Assigned volume exceeds total juice volume");
    }

    return errors;
  }, [selections, totalJuiceVolumeL, assignments, totalAssignedVolumeL]);

  // Handlers
  const toggleVendor = (vendorId: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  // Get the display unit for a vendor (defaults to first item's original unit)
  const getVendorDisplayUnit = (vendorId: string, defaultUnit: WeightUnit = "kg"): WeightUnit => {
    return vendorWeightUnits.get(vendorId) || defaultUnit;
  };

  // Toggle weight unit for an entire vendor section
  const toggleVendorWeightUnit = (vendorId: string, currentUnit: WeightUnit) => {
    setVendorWeightUnits((prev) => {
      const next = new Map(prev);
      next.set(vendorId, currentUnit === "kg" ? "lb" : "kg");
      return next;
    });
  };

  const handleItemSelect = (item: {
    purchaseItemId: string;
    fruitVarietyId: string;
    vendorId: string;
    vendorName: string;
    varietyName: string;
    availableQuantityKg: number;
  }, selected: boolean) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (selected) {
        next.set(item.purchaseItemId, {
          purchaseItemId: item.purchaseItemId,
          fruitVarietyId: item.fruitVarietyId,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          varietyName: item.varietyName,
          availableKg: item.availableQuantityKg,
          useQuantityKg: item.availableQuantityKg, // Default to All
          useAll: true,
        });
      } else {
        next.delete(item.purchaseItemId);
      }
      return next;
    });
  };

  const handleQuantityChange = (purchaseItemId: string, quantityKg: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const existing = next.get(purchaseItemId);
      if (existing) {
        next.set(purchaseItemId, {
          ...existing,
          useQuantityKg: quantityKg,
          useAll: quantityKg >= existing.availableKg,
        });
      }
      return next;
    });
  };

  const addAssignment = () => {
    setAssignments((prev) => [
      ...prev,
      { toVesselId: "", volumeL: 0, transferLossL: 0, transferLossNotes: "" },
    ]);
  };

  const removeAssignment = (index: number) => {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAssignment = (index: number, field: keyof VesselAssignment, value: string | number) => {
    setAssignments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = () => {
    if (validationErrors.length > 0) {
      alert(validationErrors.join("\n"));
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmSubmit = () => {
    setShowConfirmDialog(false);

    createMutation.mutate({
      items: Array.from(selections.values()).map((s) => ({
        purchaseItemId: s.purchaseItemId,
        fruitVarietyId: s.fruitVarietyId,
        quantityKg: s.useQuantityKg,
      })),
      completionDate: new Date(completionDate),
      totalJuiceVolumeL,
      assignments: assignments
        .filter((a) => a.toVesselId && a.volumeL > 0)
        .map((a) => ({
          toVesselId: a.toVesselId,
          volumeL: a.volumeL,
          transferLossL: a.transferLossL || 0,
          transferLossNotes: a.transferLossNotes || undefined,
        })),
      laborHours,
      workerCount,
      notes: notes || undefined,
    });
  };

  // Success screen
  if (successData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Press Run Created!</CardTitle>
            <CardDescription>
              Press run {successData.pressRunName} has been successfully created
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              {successData.batchIds.length} batch(es) created
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push("/pressing")} className="w-full">
                Back to Pressing
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccessData(null);
                  setSelections(new Map());
                  setAssignments([{ toVesselId: "", volumeL: 0, transferLossL: 0, transferLossNotes: "" }]);
                  setTotalJuiceVolumeL(0);
                  setNotes("");
                }}
                className="w-full"
              >
                Create Another Press Run
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/pressing")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Build Press Run</h1>
            <p className="text-gray-500">Select inventory and assign to vessels</p>
          </div>
        </div>
      </div>

      {/* Running Total Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                <span className="font-medium">{totalSelectedKg.toFixed(1)} kg</span>
                <span className="text-gray-500">selected</span>
              </div>
              <div className="text-gray-400">|</div>
              <div className="text-gray-600">{selectedItemCount} item(s)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Filter by vendor name..."
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Available Inventory
          </CardTitle>
          <CardDescription>
            Select fruit to include in this press run
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No available inventory found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVendors.map((vendor) => {
                // Get the first item's original unit as the default for this vendor
                const defaultUnit = vendor.items.length > 0
                  ? normalizeUnit(vendor.items[0].originalUnit)
                  : "kg";
                const displayUnit = getVendorDisplayUnit(vendor.vendorId, defaultUnit);

                return (
                <Collapsible
                  key={vendor.vendorId}
                  open={expandedVendors.has(vendor.vendorId)}
                  onOpenChange={() => toggleVendor(vendor.vendorId)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        {expandedVendors.has(vendor.vendorId) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span className="font-medium">{vendor.vendorName}</span>
                        <Badge variant="secondary">
                          {vendor.items.length} item(s)
                        </Badge>
                      </div>
                      <WeightDisplay
                        weightKg={vendor.totalAvailableKg}
                        originalUnit={defaultUnit}
                        displayUnit={displayUnit}
                        onToggle={(newUnit) => toggleVendorWeightUnit(vendor.vendorId, displayUnit)}
                        className="text-sm text-gray-500"
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-6 py-2 space-y-2">
                      {vendor.items.map((item) => {
                        const isSelected = selections.has(item.purchaseItemId);
                        const selection = selections.get(item.purchaseItemId);

                        return (
                          <div
                            key={item.purchaseItemId}
                            className={`flex items-center gap-4 p-3 border rounded-lg ${
                              isSelected ? "border-blue-300 bg-blue-50" : "border-gray-200"
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleItemSelect(
                                  {
                                    purchaseItemId: item.purchaseItemId,
                                    fruitVarietyId: item.fruitVarietyId,
                                    vendorId: vendor.vendorId,
                                    vendorName: vendor.vendorName,
                                    varietyName: item.varietyName,
                                    availableQuantityKg: item.availableQuantityKg,
                                  },
                                  checked as boolean
                                )
                              }
                            />
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                              <div>
                                <div className="font-medium">{item.varietyName}</div>
                                <div className="text-xs text-gray-500">
                                  {item.purchaseDate
                                    ? formatDate(new Date(item.purchaseDate))
                                    : "No date"}
                                </div>
                              </div>
                              <div className="text-sm text-gray-600">
                                <WeightDisplay
                                  weightKg={item.availableQuantityKg}
                                  originalUnit={normalizeUnit(item.originalUnit)}
                                  displayUnit={displayUnit}
                                  onToggle={() => toggleVendorWeightUnit(vendor.vendorId, displayUnit)}
                                />
                                {" available"}
                              </div>
                              {isSelected && (
                                <div className="md:col-span-2 flex items-center gap-2">
                                  <Label className="text-sm whitespace-nowrap">Use:</Label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    max={convertWeight(item.availableQuantityKg, displayUnit)}
                                    value={
                                      selection?.useQuantityKg
                                        ? convertWeight(selection.useQuantityKg, displayUnit).toFixed(1)
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const valueInDisplayUnit = parseFloat(e.target.value) || 0;
                                      // Convert to kg for storage
                                      const valueInKg = toKg(valueInDisplayUnit, displayUnit);
                                      handleQuantityChange(item.purchaseItemId, valueInKg);
                                    }}
                                    className="w-24"
                                  />
                                  <span className="text-sm text-gray-500">{formatUnit(displayUnit)}</span>
                                  {selection?.useAll && (
                                    <Badge variant="secondary" className="text-xs">
                                      All
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Completion Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5" />
            Completion Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Completion Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Completion Date</Label>
              <Input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            </div>

            {/* Total Juice Volume */}
            <div className="space-y-2">
              <Label>Total Juice Volume</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Volume"
                  value={
                    juiceVolumeUnit === "gal" && totalJuiceVolumeL > 0
                      ? litersToGallons(totalJuiceVolumeL).toFixed(2)
                      : totalJuiceVolumeL || ""
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setTotalJuiceVolumeL(
                      juiceVolumeUnit === "gal" ? gallonsToLiters(value) : value
                    );
                  }}
                  className="flex-1"
                />
                <Select
                  value={juiceVolumeUnit}
                  onValueChange={(v) => setJuiceVolumeUnit(v as "L" | "gal")}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="gal">gal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {juiceVolumeUnit === "gal" && totalJuiceVolumeL > 0 && (
                <p className="text-xs text-gray-500">
                  = {totalJuiceVolumeL.toFixed(2)} L
                </p>
              )}
            </div>
          </div>

          {/* Vessel Assignments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Beaker className="w-4 h-4" />
                Vessel Assignments
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={vesselVolumeUnit}
                  onValueChange={(v: "L" | "gal") => setVesselVolumeUnit(v)}
                >
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Liters</SelectItem>
                    <SelectItem value="gal">Gallons</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addAssignment}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Vessel
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {assignments.map((assignment, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg"
                >
                  <div className="space-y-2">
                    <Label className="text-sm">Vessel</Label>
                    <Select
                      value={assignment.toVesselId}
                      onValueChange={(v) => updateAssignment(index, "toVesselId", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vessel..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVessels.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{vessel.name}</span>
                              <span className="text-xs text-gray-500">
                                ({vessel.remainingCapacityL.toFixed(0)} of {vessel.capacity.toFixed(0)} L available)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Volume ({vesselVolumeUnit})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={
                        assignment.volumeL
                          ? vesselVolumeUnit === "gal"
                            ? parseFloat(litersToGallons(assignment.volumeL).toFixed(2))
                            : parseFloat(assignment.volumeL.toFixed(2))
                          : ""
                      }
                      onChange={(e) => {
                        const inputValue = parseFloat(e.target.value) || 0;
                        const valueInLiters = vesselVolumeUnit === "gal"
                          ? gallonsToLiters(inputValue)
                          : inputValue;
                        updateAssignment(index, "volumeL", valueInLiters);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Transfer Loss ({vesselVolumeUnit})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={
                        assignment.transferLossL
                          ? vesselVolumeUnit === "gal"
                            ? parseFloat(litersToGallons(assignment.transferLossL).toFixed(2))
                            : parseFloat(assignment.transferLossL.toFixed(2))
                          : 0
                      }
                      onChange={(e) => {
                        const inputValue = parseFloat(e.target.value) || 0;
                        const valueInLiters = vesselVolumeUnit === "gal"
                          ? gallonsToLiters(inputValue)
                          : inputValue;
                        updateAssignment(index, "transferLossL", valueInLiters);
                      }}
                    />
                  </div>

                  <div className="flex items-end">
                    {assignments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAssignment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Volume Summary */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Fruit Weight:</span>
                <span className="font-medium">{totalSelectedKg.toFixed(1)} kg ({(totalSelectedKg * 2.20462).toFixed(1)} lbs)</span>
              </div>
              <div className="flex justify-between">
                <span>Total Juice Volume:</span>
                <span className="font-medium">{totalJuiceVolumeL.toFixed(2)} L</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-green-700">Extraction Rate:</span>
                <span className="font-medium text-green-700">
                  {totalSelectedKg > 0 && totalJuiceVolumeL > 0
                    ? `${((totalJuiceVolumeL / totalSelectedKg) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Total Assigned:</span>
                <span className="font-medium">{totalAssignedVolumeL.toFixed(2)} L</span>
              </div>
              <div className="flex justify-between">
                <span>Transfer Loss:</span>
                <span className="font-medium">{totalTransferLossL.toFixed(2)} L</span>
              </div>
              <div className="flex justify-between">
                <span>Remaining:</span>
                <span
                  className={`font-medium ${
                    totalJuiceVolumeL - totalAssignedVolumeL < 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {(totalJuiceVolumeL - totalAssignedVolumeL).toFixed(2)} L
                </span>
              </div>
            </div>
          </div>

          {/* Labor & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Labor Hours
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                placeholder="Hours"
                value={laborHours ?? ""}
                onChange={(e) =>
                  setLaborHours(e.target.value ? parseFloat(e.target.value) : undefined)
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Worker Count
              </Label>
              <Input
                type="number"
                step="1"
                min="1"
                max="20"
                placeholder="Workers"
                value={workerCount ?? ""}
                onChange={(e) =>
                  setWorkerCount(e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes about this press run..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Section */}
      <Card>
        <CardContent className="py-4">
          {validationErrors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <ul className="list-disc list-inside text-sm text-red-600">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => router.push("/pressing")}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={validationErrors.length > 0 || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Press Run"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Press Run?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will create a completed press run with:</p>
              <ul className="list-disc list-inside">
                <li>{selectedItemCount} inventory item(s) ({totalSelectedKg.toFixed(1)} kg)</li>
                <li>{totalJuiceVolumeL.toFixed(2)} L total juice</li>
                <li>
                  {assignments.filter((a) => a.toVesselId && a.volumeL > 0).length} vessel
                  assignment(s)
                </li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>Create Press Run</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
