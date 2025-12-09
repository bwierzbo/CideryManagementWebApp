"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollableSelectContent } from "@/components/ui/scrollable-select";
import { HarvestDatePicker } from "@/components/ui/harvest-date-picker";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ShoppingCart,
  CheckCircle,
  XCircle,
  X,
  Apple,
  ExternalLink,
  Search,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schemas - same as original purchasing page
const purchaseLineSchema = z.object({
  appleVarietyId: z.string().uuid("Select a base fruit variety"),
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.enum(["kg", "lb", "bushel"]),
  pricePerUnit: z.number().nonnegative("Price cannot be negative").optional(),
  harvestDate: z.date().nullable().optional(),
  notes: z.string().optional(),
});

const purchaseSchema = z.object({
  vendorId: z.string().uuid("Select a vendor"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  globalHarvestDate: z.date().nullable().optional(),
  notes: z.string().optional(),
  lines: z
    .array(purchaseLineSchema)
    .min(1, "At least one base fruit variety is required"),
});

type PurchaseForm = z.infer<typeof purchaseSchema>;

type NotificationType = {
  id: number;
  type: "success" | "error";
  title: string;
  message: string;
};

interface AppleTransactionFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
}

export function AppleTransactionForm({
  onSubmit,
  onCancel,
}: AppleTransactionFormProps) {
  const { data: session } = useSession();
  const [globalHarvestDate, setGlobalHarvestDate] = useState<Date | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorSearchQuery, setVendorSearchQuery] = useState<string>("");
  const [debouncedVendorSearch, setDebouncedVendorSearch] =
    useState<string>("");
  const [lines, setLines] = useState<
    Array<{
      appleVarietyId: string;
      quantity: number | undefined;
      unit: "kg" | "lb" | "bushel";
      pricePerUnit: number | undefined;
      harvestDate: Date | null | undefined;
      notes: string | undefined;
      isValid?: boolean;
      validationError?: string;
    }>
  >([
    {
      appleVarietyId: "",
      quantity: undefined,
      unit: "lb",
      pricePerUnit: undefined,
      harvestDate: undefined,
      notes: undefined,
      isValid: true,
    },
  ]);

  const addNotification = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000); // Auto-dismiss after 5 seconds
  };

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Debounce vendor search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedVendorSearch(vendorSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [vendorSearchQuery]);

  // Get vendors that have base fruit varieties only
  const { data: vendorData } = trpc.vendor.listByVarietyType.useQuery({
    varietyType: "baseFruit",
    includeInactive: false,
  });
  // Filter vendors based on search query
  const vendors = React.useMemo(() => {
    const allVendors = vendorData?.vendors || [];
    if (!debouncedVendorSearch.trim()) {
      return allVendors;
    }
    const searchLower = debouncedVendorSearch.toLowerCase();
    return allVendors.filter((vendor) =>
      vendor.name.toLowerCase().includes(searchLower),
    );
  }, [vendorData?.vendors, debouncedVendorSearch]);

  // Get vendor varieties when vendor is selected
  const { data: vendorVarietiesData } =
    trpc.vendorVariety.listForVendor.useQuery(
      { vendorId: selectedVendorId },
      { enabled: !!selectedVendorId },
    );
  const vendorVarieties = React.useMemo(
    () => vendorVarietiesData?.varieties || [],
    [vendorVarietiesData],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      globalHarvestDate: null,
      lines: lines,
    },
  });

  const handlePurchaseDateChange = (dateString: string) => {
    setPurchaseDate(dateString);
    setValue("purchaseDate", dateString);
  };

  const addLine = () => {
    // Use global harvest date for new lines if available
    const harvestDateForNewLine = globalHarvestDate;
    setLines((prevLines) => {
      const newLines = [
        ...prevLines,
        {
          appleVarietyId: "",
          quantity: undefined,
          unit: "lb" as "kg" | "lb" | "bushel",
          pricePerUnit: undefined,
          harvestDate: harvestDateForNewLine,
          notes: undefined,
          isValid: true,
        },
      ];
      setValue("lines", newLines);
      return newLines;
    });
  };

  const handleVendorChange = (newVendorId: string) => {
    setSelectedVendorId(newVendorId);
    setValue("vendorId", newVendorId);

    // Validate existing lines against new vendor
    if (newVendorId && lines.some((line) => line.appleVarietyId)) {
      // We'll validate when vendor varieties are loaded
      // This will be handled by useEffect
    }
  };

  const validateLines = React.useCallback(() => {
    if (!selectedVendorId || vendorVarieties.length === 0) return;

    const validVarietyIds = new Set(vendorVarieties.map((v) => v.id));
    setLines((prevLines) => {
      const newLines = prevLines.map((line) => {
        if (!line.appleVarietyId) {
          return { ...line, isValid: true, validationError: undefined };
        }

        const isValid = validVarietyIds.has(line.appleVarietyId);
        const newLine = {
          ...line,
          isValid,
          validationError: isValid
            ? undefined
            : "This variety is not available for the selected vendor",
        };

        // Only return new object if something actually changed
        if (
          line.isValid !== newLine.isValid ||
          line.validationError !== newLine.validationError
        ) {
          return newLine;
        }
        return line;
      });

      // Only update if something actually changed
      const hasChanges = newLines.some(
        (line, index) =>
          line.isValid !== prevLines[index].isValid ||
          line.validationError !== prevLines[index].validationError,
      );

      return hasChanges ? newLines : prevLines;
    });
  }, [selectedVendorId, vendorVarieties]);

  // Validate lines when vendor varieties change
  React.useEffect(() => {
    validateLines();
  }, [validateLines]);

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
    setValue("lines", newLines);
  };

  const calculateLineTotal = (
    quantity: number | undefined,
    price: number | undefined,
  ) => {
    if (!quantity || !price) return "—";
    return (quantity * price).toFixed(2);
  };

  const createPurchase = trpc.purchase.create.useMutation({
    onSuccess: (result) => {
      addNotification(
        "success",
        "Purchase Created Successfully!",
        `Purchase #${result.purchase.id.substring(0, 8)} has been created`,
      );
      // Reset form
      reset();
      setLines([
        {
          appleVarietyId: "",
          quantity: undefined,
          unit: "lb" as "kg" | "lb" | "bushel",
          pricePerUnit: undefined,
          harvestDate: null,
          notes: undefined,
        },
      ]);
      setPurchaseDate("");
      setGlobalHarvestDate(null);
      // Call parent onSubmit if provided
      onSubmit?.(result);
    },
    onError: (error) => {
      addNotification("error", "Failed to Create Purchase", error.message);
    },
  });

  const calculateGrandTotal = () => {
    const total = lines.reduce((total, line) => {
      if (!line.quantity || !line.pricePerUnit) return total;
      return total + line.quantity * line.pricePerUnit;
    }, 0);
    return total > 0 ? total.toFixed(2) : "—";
  };

  const calculateTotalWeight = () => {
    const weights = lines.reduce(
      (acc, line) => {
        if (!line.quantity) return acc;

        // Convert all units to pounds for consistent display
        let weightInPounds = 0;
        switch (line.unit) {
          case "lb":
            weightInPounds = line.quantity;
            break;
          case "kg":
            weightInPounds = line.quantity * 2.20462; // 1 kg = 2.20462 lbs
            break;
          case "bushel":
            weightInPounds = line.quantity * 42; // 1 bushel of apples ≈ 42 lbs
            break;
        }

        return {
          totalPounds: acc.totalPounds + weightInPounds,
          hasQuantity: true,
        };
      },
      { totalPounds: 0, hasQuantity: false },
    );

    if (!weights.hasQuantity) return "—";

    // Format with commas for readability
    return weights.totalPounds.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const onFormSubmit = (data: PurchaseForm) => {
    // Check for validation errors before submitting
    const hasInvalidLines = lines.some((line) => line.isValid === false);
    if (hasInvalidLines) {
      addNotification(
        "error",
        "Invalid Varieties",
        "Please fix variety selections that are not available for the selected vendor",
      );
      return;
    }

    try {
      // Convert form data to API format
      const items = data.lines
        .filter((line) => line.appleVarietyId && line.quantity) // Only include complete lines
        .map((line) => ({
          fruitVarietyId: line.appleVarietyId,
          quantity: line.quantity!,
          unit: line.unit as "kg" | "lb" | "L" | "gal" | "bushel",
          pricePerUnit: line.pricePerUnit,
          harvestDate: line.harvestDate || undefined,
          notes: line.notes,
        }));

      if (items.length === 0) {
        addNotification(
          "error",
          "Incomplete Form",
          "Please add at least one base fruit variety with quantity",
        );
        return;
      }

      // If parent onSubmit is provided, use it instead of direct API call
      if (onSubmit) {
        // Prepare data for parent handler
        const transactionData = {
          vendorId: data.vendorId,
          purchaseDate: data.purchaseDate,
          notes: data.notes,
          items: items,
        };
        onSubmit(transactionData);
      } else {
        // Fallback to direct API call if no parent handler
        createPurchase.mutate({
          vendorId: data.vendorId,
          purchaseDate: new Date(data.purchaseDate),
          notes: data.notes,
          items: items,
        });
      }
    } catch (error) {
      console.error("Error preparing purchase data:", error);
      addNotification(
        "error",
        "Form Error",
        "Error preparing purchase data. Please check your inputs.",
      );
    }
  };

  return (
    <>
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              min-w-80 max-w-md p-4 rounded-lg shadow-lg border
              ${
                notification.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {notification.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="text-sm mt-1 opacity-90">
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            Record Base Fruit Purchase
          </CardTitle>
          <CardDescription>
            Record a new base fruit purchase from vendors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            {/* Purchase Header - Vendor selection stretches across top */}
            <div className="space-y-4">
              {/* Vendor Selection - Full width */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Select Vendor</Label>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search vendors..."
                    value={vendorSearchQuery}
                    onChange={(e) => setVendorSearchQuery(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>

                {/* Vendors List */}
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {vendors.map((vendor: any) => (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => handleVendorChange(vendor.id)}
                      className={`w-full p-3 text-left rounded-lg border transition-all ${
                        selectedVendorId === vendor.id
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {vendor.name}
                          </h4>
                          {vendor.contactInfo && (
                            <p className="text-sm text-gray-600">
                              {vendor.contactInfo.email ||
                                vendor.contactInfo.phone ||
                                vendor.contactInfo.address ||
                                ""}
                            </p>
                          )}
                          {vendor.specializesIn && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {vendor.specializesIn.map((spec: string) => (
                                <Badge
                                  key={spec}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {spec}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Building2 className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>

                {selectedVendorId &&
                  vendors.find((v) => v.id === selectedVendorId) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Selected:{" "}
                          {vendors.find((v) => v.id === selectedVendorId)?.name}
                        </span>
                      </div>
                    </div>
                  )}
                {errors.vendorId && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.vendorId.message}
                  </p>
                )}
              </div>

              {/* Purchase Date and Harvest Date - Below vendor selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
                    value={purchaseDate}
                    onChange={(e) => handlePurchaseDateChange(e.target.value)}
                    className="h-12"
                  />
                  {errors.purchaseDate && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.purchaseDate.message}
                    </p>
                  )}
                </div>
                <div>
                  <HarvestDatePicker
                    id="globalHarvestDate"
                    label="Harvest Date (All Varieties)"
                    placeholder="Select harvest date"
                    value={globalHarvestDate}
                    onChange={(date) => {
                      setGlobalHarvestDate(date);
                      setValue("globalHarvestDate", date);
                      // Auto-populate individual harvest dates
                      setLines((prevLines) => {
                        const newLines = prevLines.map((line) => ({
                          ...line,
                          harvestDate: date,
                        }));
                        // Update form values for each line
                        newLines.forEach((_, index) => {
                          setValue(`lines.${index}.harvestDate`, date);
                        });
                        return newLines;
                      });
                    }}
                    showClearButton={true}
                    allowFutureDates={true}
                  />
                </div>
              </div>
            </div>

            {/* Purchase Lines */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium">Base Fruit Varieties</h3>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    {/* Stacked Layout for All Screen Sizes */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          Base Fruit Variety #{index + 1}
                        </h4>
                        {lines.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeLine(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* Base Fruit Variety Selection */}
                      <div>
                        <Label>Base Fruit Variety</Label>
                        <Select
                          onValueChange={(value) => {
                            const newLines = [...lines];
                            newLines[index].appleVarietyId = value;
                            setLines(newLines);
                            setValue(`lines.${index}.appleVarietyId`, value);
                          }}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select variety" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] overflow-y-auto">
                            {vendorVarieties.map((variety: any) => (
                              <SelectItem key={variety.id} value={variety.id}>
                                {variety.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {line.validationError && (
                          <p className="text-sm text-red-600 mt-1">
                            {line.validationError}
                          </p>
                        )}
                        {selectedVendorId && vendorVarieties.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Need a new variety?{" "}
                            {(session?.user as any)?.role === "admin" ? (
                              <>
                                Visit the{" "}
                                <Link
                                  href="/fruits"
                                  className="text-blue-600 hover:underline"
                                >
                                  Fruits page
                                </Link>{" "}
                                to add it.
                              </>
                            ) : (
                              "Ask an Admin to add it on the Fruits page."
                            )}
                          </p>
                        )}
                      </div>

                      {/* Harvest Date */}
                      <div>
                        <HarvestDatePicker
                          id={`harvestDate-mobile-${index}`}
                          label="Harvest Date"
                          placeholder="Select date"
                          value={line.harvestDate}
                          onChange={(date) => {
                            setLines((prevLines) => {
                              const newLines = [...prevLines];
                              newLines[index].harvestDate = date;
                              setValue(`lines.${index}.harvestDate`, date);
                              return newLines;
                            });
                          }}
                          showClearButton={true}
                          allowFutureDates={true}
                          className="w-full"
                        />
                      </div>

                      {/* Quantity and Unit in a grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>
                            Quantity{" "}
                            <span className="text-gray-500 text-sm">
                              (Optional)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.quantity || ""}
                            placeholder="0.00"
                            className="h-12"
                            onChange={(e) => {
                              const newLines = [...lines];
                              newLines[index].quantity = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              setLines(newLines);
                              setValue(
                                `lines.${index}.quantity`,
                                newLines[index].quantity,
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Select
                            value={line.unit}
                            onValueChange={(value: "kg" | "lb" | "bushel") => {
                              const newLines = [...lines];
                              newLines[index].unit = value;
                              setLines(newLines);
                              setValue(`lines.${index}.unit`, value);
                            }}
                          >
                            <SelectTrigger className="h-12">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lb">lb</SelectItem>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="bushel">bushel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Price and Total */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>
                            Price/Unit{" "}
                            <span className="text-gray-500 text-sm">
                              (Optional)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.pricePerUnit || ""}
                            placeholder="0.00"
                            className="h-12"
                            onChange={(e) => {
                              const newLines = [...lines];
                              newLines[index].pricePerUnit = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              setLines(newLines);
                              setValue(
                                `lines.${index}.pricePerUnit`,
                                newLines[index].pricePerUnit,
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Label>Total</Label>
                          <div className="h-12 flex items-center">
                            <div className="text-xl font-semibold text-green-600">
                              {line.quantity != null &&
                              line.quantity > 0 &&
                              line.pricePerUnit ? (
                                `$${(line.quantity * line.pricePerUnit).toFixed(2)}`
                              ) : (
                                <span className="text-gray-400">$—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <Label>
                          Notes{" "}
                          <span className="text-gray-500 text-sm">
                            (Optional)
                          </span>
                        </Label>
                        <Input
                          type="text"
                          value={line.notes || ""}
                          placeholder="Additional notes for this variety..."
                          className="h-12"
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[index].notes = e.target.value || undefined;
                            setLines(newLines);
                            setValue(`lines.${index}.notes`, newLines[index].notes);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Base Fruit Variety Button - repositioned for mobile UX */}
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={addLine}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Base Fruit Variety
                </Button>
              </div>

              <div className="flex justify-end mt-4 gap-6">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Weight</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {calculateTotalWeight()} lbs
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${calculateGrandTotal()}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                {...register("notes")}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={createPurchase.isPending}>
                {createPurchase.isPending
                  ? "Recording..."
                  : "Record Base Fruit Purchase"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
