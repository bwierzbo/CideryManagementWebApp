"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const addKegSchema = z.object({
  kegNumber: z.string().min(1, "Keg number is required"),
  kegType: z.enum([
    "cornelius_5L",
    "cornelius_9L",
    "sanke_20L",
    "sanke_30L",
    "sanke_50L",
    "other",
  ]),
  capacityML: z.number().positive("Capacity must be positive"),
  capacityUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().positive().optional(),
  currentLocation: z.string(),
  notes: z.string().optional(),
});

type AddKegForm = z.infer<typeof addKegSchema>;

interface AddKegModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Keg type capacity presets
const KEG_TYPE_CAPACITIES: Record<string, number> = {
  cornelius_5L: 5000,
  cornelius_9L: 9000,
  sanke_20L: 19500, // 1/6 barrel
  sanke_30L: 30000, // 1/4 barrel
  sanke_50L: 50000, // 1/2 barrel
  other: 0,
};

export function AddKegModal({ open, onClose, onSuccess }: AddKegModalProps) {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single keg form
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AddKegForm>({
    resolver: zodResolver(addKegSchema),
    defaultValues: {
      capacityUnit: "L",
      currentLocation: "cellar",
    },
  });

  const kegType = watch("kegType");
  const capacityML = watch("capacityML");

  // Bulk keg state
  const [bulkPrefix, setBulkPrefix] = useState("KEG");
  const [bulkStartNumber, setBulkStartNumber] = useState(1);
  const [bulkQuantity, setBulkQuantity] = useState(10);
  const [bulkKegType, setBulkKegType] = useState("sanke_20L");
  const [bulkPurchaseDate, setBulkPurchaseDate] = useState("");
  const [bulkPurchaseCost, setBulkPurchaseCost] = useState("");
  const [bulkLocation, setBulkLocation] = useState("cellar");
  const [bulkNotes, setBulkNotes] = useState("");

  const bulkCapacityML = KEG_TYPE_CAPACITIES[bulkKegType] || 0;

  // Auto-fill capacity when keg type changes
  useEffect(() => {
    if (kegType && KEG_TYPE_CAPACITIES[kegType]) {
      setValue("capacityML", KEG_TYPE_CAPACITIES[kegType]);
    }
  }, [kegType, setValue]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      reset({
        capacityUnit: "L",
        currentLocation: "cellar",
      });
      setMode("single");
    }
  }, [open, reset]);

  const createKegMutation = trpc.packaging.kegs.createKeg.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Added",
        description: "New keg registered successfully",
      });
      reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkCreateMutation = trpc.packaging.kegs.bulkCreateKegs.useMutation({
    onSuccess: (result) => {
      const msg = result.skipped > 0
        ? `Created ${result.created} kegs (${result.firstKeg} – ${result.lastKeg}). Skipped ${result.skipped} existing.`
        : `Created ${result.created} kegs (${result.firstKeg} – ${result.lastKeg})`;
      toast({
        title: "Bulk Kegs Added",
        description: msg,
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Bulk Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSingleSubmit = (data: AddKegForm) => {
    createKegMutation.mutate(data);
  };

  const onBulkSubmit = () => {
    if (!bulkPrefix || bulkStartNumber < 1 || bulkQuantity < 1 || !bulkKegType) {
      toast({
        title: "Missing Fields",
        description: "Please fill in prefix, start number, quantity, and keg type",
        variant: "destructive",
      });
      return;
    }
    bulkCreateMutation.mutate({
      kegNumberPrefix: bulkPrefix,
      startNumber: bulkStartNumber,
      quantity: bulkQuantity,
      kegType: bulkKegType as any,
      capacityML: bulkCapacityML,
      purchaseDate: bulkPurchaseDate || undefined,
      purchaseCost: bulkPurchaseCost ? parseFloat(bulkPurchaseCost) : undefined,
      currentLocation: bulkLocation,
      notes: bulkNotes || undefined,
    });
  };

  const isPending = createKegMutation.isPending || bulkCreateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Register Kegs
          </DialogTitle>
          <DialogDescription>
            Add kegs to your asset registry for tracking
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            type="button"
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
              mode === "single"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setMode("single")}
          >
            Single Keg
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors border-l ${
              mode === "bulk"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setMode("bulk")}
          >
            Bulk Purchase
          </button>
        </div>

        {mode === "single" ? (
          /* Single Keg Form */
          <form onSubmit={handleSubmit(onSingleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kegNumber">
                  Keg Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="kegNumber"
                  placeholder="KEG-001"
                  {...register("kegNumber")}
                  className="mt-1"
                />
                {errors.kegNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.kegNumber.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="kegType">
                  Keg Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={kegType}
                  onValueChange={(value) => setValue("kegType", value as any)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select keg type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cornelius_5L">Cornelius 5L</SelectItem>
                    <SelectItem value="cornelius_9L">Cornelius 9L</SelectItem>
                    <SelectItem value="sanke_20L">Sanke 20L (1/6 barrel)</SelectItem>
                    <SelectItem value="sanke_30L">Sanke 30L (1/4 barrel)</SelectItem>
                    <SelectItem value="sanke_50L">Sanke 50L (1/2 barrel)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.kegType && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.kegType.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="capacityML">
                Capacity (mL) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="capacityML"
                type="text"
                inputMode="decimal"
                pattern="^\d*\.?\d+$"
                {...register("capacityML", { valueAsNumber: true })}
                className="mt-1"
              />
              {capacityML > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  ≈ {(capacityML / 1000).toFixed(1)}L
                </p>
              )}
              {errors.capacityML && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.capacityML.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  {...register("purchaseDate")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="purchaseCost">Purchase Cost ($)</Label>
                <Input
                  id="purchaseCost"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d*\.?\d{0,2}$"
                  placeholder="0.00"
                  {...register("purchaseCost", { valueAsNumber: true })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="currentLocation">Current Location</Label>
              <Input
                id="currentLocation"
                placeholder="cellar"
                {...register("currentLocation")}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Any additional notes about this keg..."
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding..." : "Add Keg"}
              </Button>
            </div>
          </form>
        ) : (
          /* Bulk Purchase Form */
          <div className="space-y-4">
            {/* Naming pattern */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Prefix <span className="text-red-500">*</span></Label>
                <Input
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  placeholder="KEG"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Start Number <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkStartNumber}
                  onChange={(e) => setBulkStartNumber(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Quantity <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="font-medium text-blue-900">
                Will create {bulkQuantity} kegs:
              </p>
              <p className="text-blue-700 mt-1">
                {bulkPrefix}-{String(bulkStartNumber).padStart(3, "0")} through{" "}
                {bulkPrefix}-{String(bulkStartNumber + bulkQuantity - 1).padStart(3, "0")}
              </p>
            </div>

            {/* Keg Type */}
            <div>
              <Label>Keg Type <span className="text-red-500">*</span></Label>
              <Select value={bulkKegType} onValueChange={setBulkKegType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cornelius_5L">Cornelius 5L</SelectItem>
                  <SelectItem value="cornelius_9L">Cornelius 9L</SelectItem>
                  <SelectItem value="sanke_20L">Sanke 20L (1/6 barrel) — 19.5L</SelectItem>
                  <SelectItem value="sanke_30L">Sanke 30L (1/4 barrel) — 30.0L</SelectItem>
                  <SelectItem value="sanke_50L">Sanke 50L (1/2 barrel) — 50.0L</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {bulkCapacityML > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Capacity: {(bulkCapacityML / 1000).toFixed(1)}L per keg
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={bulkPurchaseDate}
                  onChange={(e) => setBulkPurchaseDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cost Per Keg ($)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={bulkPurchaseCost}
                  onChange={(e) => setBulkPurchaseCost(e.target.value)}
                  className="mt-1"
                />
                {bulkPurchaseCost && bulkQuantity > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Total: ${(parseFloat(bulkPurchaseCost) * bulkQuantity).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={bulkLocation}
                onChange={(e) => setBulkLocation(e.target.value)}
                placeholder="cellar"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Any notes about this batch of kegs..."
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isPending || !bulkPrefix || bulkQuantity < 1}
                onClick={onBulkSubmit}
              >
                {isPending
                  ? "Creating..."
                  : `Create ${bulkQuantity} Kegs`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
