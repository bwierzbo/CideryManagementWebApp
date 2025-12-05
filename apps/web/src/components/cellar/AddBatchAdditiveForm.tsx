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
import { Loader2, Search, Package, AlertTriangle } from "lucide-react";
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
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [addedDate, setAddedDate] = useState(() => {
    // Default to current date and time in YYYY-MM-DDTHH:mm format
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

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
        description: data.estimatedMeasurement
          ? "Additive recorded with estimated SG and ABV measurement"
          : "Additive recorded successfully",
      });
      // Invalidate inventory queries to reflect the usage
      utils.additivePurchases.listInventory.invalidate();
      utils.additivePurchases.list.invalidate();
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
    // Reset inventory item selection when type changes
    setSelectedInventoryItem(null);
    setUnit("");
    setSearchQuery("");
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
    if (parsedAmount > selectedInventoryItem.availableQuantity) {
      toast({
        title: "Error",
        description: `Amount exceeds available quantity (${selectedInventoryItem.availableQuantity.toFixed(2)} ${selectedInventoryItem.unit} available)`,
        variant: "destructive",
      });
      return;
    }

    const additiveData = {
      batchId,
      additiveType: selectedInventoryItem.varietyItemType,
      additiveName: selectedInventoryItem.varietyName || selectedInventoryItem.productName,
      amount: parsedAmount,
      unit,
      addedAt: new Date(addedDate),
      notes: notes || undefined,
      // This is the key - pass the purchase item ID to decrement inventory
      additivePurchaseItemId: selectedInventoryItem.id,
      // Also pass cost for COGS calculation
      costPerUnit: selectedInventoryItem.pricePerUnit ? parseFloat(selectedInventoryItem.pricePerUnit) : undefined,
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
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
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder={`Search ${selectedAdditiveType.toLowerCase()} inventory...`}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-[300px]">
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
        <Label htmlFor="addedDate">Date & Time Added *</Label>
        <Input
          id="addedDate"
          type="datetime-local"
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
