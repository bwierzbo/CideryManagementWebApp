"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface AddBatchAdditiveFormProps {
  batchId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const units = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lbs", label: "Pounds (lbs)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "L", label: "Liters (L)" },
  { value: "ppm", label: "Parts per million (ppm)" },
  { value: "mg/L", label: "Milligrams per liter (mg/L)" },
  { value: "g/L", label: "Grams per liter (g/L)" },
  { value: "units", label: "Units" },
];

const additiveTypes = [
  { value: "Sugar & Sweeteners", label: "Sugar & Sweeteners" },
  { value: "Flavorings & Adjuncts", label: "Flavorings & Adjuncts" },
  { value: "Fermentation Organisms", label: "Fermentation Organisms" },
  { value: "Enzymes", label: "Enzymes" },
  {
    value: "Antioxidants & Antimicrobials",
    label: "Antioxidants & Antimicrobials",
  },
  { value: "Tannins & Mouthfeel", label: "Tannins & Mouthfeel" },
  { value: "Acids & Bases", label: "Acids & Bases" },
  { value: "Nutrients", label: "Nutrients" },
  { value: "Stabilizers", label: "Stabilizers" },
  { value: "Refining & Clarifying", label: "Refining & Clarifying" },
];

export function AddBatchAdditiveForm({
  batchId,
  onSuccess,
  onCancel,
}: AddBatchAdditiveFormProps) {
  const [selectedAdditiveType, setSelectedAdditiveType] = useState("");
  const [selectedAdditiveId, setSelectedAdditiveId] = useState("");
  const [selectedAdditive, setSelectedAdditive] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [addedDate, setAddedDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Fetch available additives from inventory, filtered by type if selected
  const { data: additiveData, isLoading: isLoadingAdditives } =
    trpc.additiveVarieties.list.useQuery(
      {
        search: searchQuery,
        limit: 50,
        includeInactive: false,
        sortBy: "name",
        sortOrder: "asc",
      },
      {
        enabled: !!selectedAdditiveType,
      },
    );

  // Filter additives by selected type
  const filteredAdditives = useMemo(() => {
    if (!additiveData?.varieties || !selectedAdditiveType) return [];
    return additiveData.varieties.filter(
      (additive) => additive.itemType === selectedAdditiveType,
    );
  }, [additiveData?.varieties, selectedAdditiveType]);

  const additives = useMemo(() => filteredAdditives, [filteredAdditives]);

  const addAdditive = trpc.batch.addAdditive.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.estimatedMeasurement
          ? "Additive recorded with estimated SG and ABV measurement"
          : "Additive recorded successfully",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdditiveTypeChange = (value: string) => {
    setSelectedAdditiveType(value);
    // Reset additive selection when type changes
    setSelectedAdditiveId("");
    setSelectedAdditive(null);
    setSearchQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdditiveType || !selectedAdditive || !amount || !unit || !addedDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const additiveData = {
      batchId,
      additiveType: selectedAdditive.itemType,
      additiveName: selectedAdditive.name,
      amount: parseFloat(amount),
      unit,
      addedAt: new Date(addedDate + 'T00:00:00'),
      notes: notes || undefined,
    };

    addAdditive.mutate(additiveData);
  };

  const handleSelectAdditive = (additiveId: string) => {
    const additive = additives.find((a) => a.id === additiveId);
    if (additive) {
      setSelectedAdditive(additive);
      setSelectedAdditiveId(additiveId);
      setOpen(false);
    }
  };

  const getAdditiveTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      nutrient: "Nutrient",
      acid: "Acid",
      enzyme: "Enzyme",
      clarifier: "Clarifier",
      preservative: "Preservative",
      other: "Other",
    };
    return typeLabels[type] || type;
  };

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
            <p className="font-medium">📊 Auto-calculation enabled</p>
            <p className="mt-1 text-blue-800">
              Adding sugar will automatically create an estimated SG and ABV measurement based on the current vessel volume and most recent measurement.
            </p>
            <p className="mt-1 text-xs text-blue-700">
              The calculation assumes full fermentation of the added sugar.
            </p>
          </div>
        )}
      </div>

      {selectedAdditiveType && (
        <div className="space-y-2">
          <Label>Select Additive from Inventory *</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={!selectedAdditiveType}
                className="w-full justify-between text-left font-normal"
              >
                {selectedAdditive ? (
                  <div className="flex items-center justify-between w-full">
                    <span>{selectedAdditive.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({getAdditiveTypeLabel(selectedAdditive.itemType)})
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    {selectedAdditiveType
                      ? `Search ${selectedAdditiveType.toLowerCase()} additives...`
                      : "Select additive type first..."}
                  </span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput
                  placeholder={`Search ${selectedAdditiveType.toLowerCase()} additives...`}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  {isLoadingAdditives && (
                    <CommandEmpty>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading additives...
                    </CommandEmpty>
                  )}
                  {!isLoadingAdditives && additives.length === 0 && (
                    <CommandEmpty>
                      {selectedAdditiveType
                        ? `No ${selectedAdditiveType.toLowerCase()} additives found in inventory.`
                        : "Select an additive type first."}
                    </CommandEmpty>
                  )}
                  {!isLoadingAdditives && additives.length > 0 && (
                    <CommandGroup heading="Available Additives">
                      {additives.map((additive) => (
                        <CommandItem
                          key={additive.id}
                          value={additive.id}
                          onSelect={() => handleSelectAdditive(additive.id)}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{additive.name}</span>
                            <span className="text-sm text-muted-foreground">
                              Type: {getAdditiveTypeLabel(additive.itemType)}
                              {additive.labelImpact && " • Label Impact"}
                              {additive.allergensVegan &&
                                " • Allergen/Vegan Concern"}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedAdditive && (
            <div className="mt-2 p-3 bg-muted rounded-md text-sm">
              <div className="font-medium mb-1">
                Selected: {selectedAdditive.name}
              </div>
              <div className="text-muted-foreground">
                Type: {getAdditiveTypeLabel(selectedAdditive.itemType)}
                {selectedAdditive.labelImpact && (
                  <div className="mt-1">
                    ⚠️ Label Impact:{" "}
                    {selectedAdditive.labelImpactNotes ||
                      "May require label disclosure"}
                  </div>
                )}
                {selectedAdditive.allergensVegan && (
                  <div className="mt-1">
                    ⚠️ Allergen/Vegan:{" "}
                    {selectedAdditive.allergensVeganNotes ||
                      "May contain allergens or affect vegan status"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
            onChange={(e) => setAmount(e.target.value)}
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
              {units.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addedDate">Date Added *</Label>
        <Input
          id="addedDate"
          type="date"
          value={addedDate}
          onChange={(e) => setAddedDate(e.target.value)}
          required
        />
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
