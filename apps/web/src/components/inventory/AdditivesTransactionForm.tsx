"use client";

import React, { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Beaker,
  CheckCircle,
  XCircle,
  X,
  Search,
  CheckCircle2,
  Building2,
  Calendar,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schemas
const additiveLineSchema = z.object({
  additiveId: z.string().uuid("Select an additive"),
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.enum(["g", "kg", "lb", "L", "mL"]),
  pricePerUnit: z.number().nonnegative("Price cannot be negative").optional(),
  totalCost: z.number().nonnegative("Total cost cannot be negative").optional(),
});

const additivePurchaseSchema = z.object({
  vendorId: z.string().uuid("Select a vendor"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  notes: z.string().optional(),
  lines: z
    .array(additiveLineSchema)
    .min(1, "At least one additive is required"),
});

type AdditivePurchaseForm = z.infer<typeof additivePurchaseSchema>;

type NotificationType = {
  id: number;
  type: "success" | "error";
  title: string;
  message: string;
};

interface AdditivesTransactionFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const unitOptions = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lb", label: "Pounds (lbs)" },
  { value: "L", label: "Liters (L)" },
  { value: "mL", label: "Milliliters (mL)" },
];

export function AdditivesTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AdditivesTransactionFormProps) {
  const { data: session } = useSession();
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorSearchQuery, setVendorSearchQuery] = useState<string>("");
  const [debouncedVendorSearch, setDebouncedVendorSearch] =
    useState<string>("");
  const [lines, setLines] = useState<
    Array<{
      additiveId: string;
      quantity: number | undefined;
      unit: "g" | "kg" | "lb" | "L" | "mL";
      pricePerUnit: number | undefined;
      totalCost: number | undefined;
      isValid?: boolean;
      validationError?: string;
    }>
  >([
    {
      additiveId: "",
      quantity: undefined,
      unit: "g",
      pricePerUnit: undefined,
      totalCost: undefined,
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
    }, 5000);
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

  // Get vendors that have additive varieties
  const { data: vendorData } = trpc.vendor.listByVarietyType.useQuery({
    varietyType: "additive",
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

  // Get vendor additives when vendor is selected
  const { data: vendorAdditivesData } =
    trpc.additiveVarieties.getVendorLinks.useQuery(
      { vendorId: selectedVendorId },
      { enabled: !!selectedVendorId },
    );
  const vendorAdditives = React.useMemo(
    () =>
      vendorAdditivesData?.map((link: any) => ({
        id: link.variety.id,
        name: link.variety.name,
        itemType: link.variety.itemType,
        isActive: link.variety.isActive,
      })) || [],
    [vendorAdditivesData],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AdditivePurchaseForm>({
    resolver: zodResolver(additivePurchaseSchema),
    defaultValues: {
      purchaseDate: purchaseDate,
      lines: lines,
    },
  });

  const handlePurchaseDateChange = (dateString: string) => {
    setPurchaseDate(dateString);
    setValue("purchaseDate", dateString);
  };

  const addLine = () => {
    setLines((prevLines) => {
      const newLines = [
        ...prevLines,
        {
          additiveId: "",
          quantity: undefined,
          unit: "g" as const,
          pricePerUnit: undefined,
          totalCost: undefined,
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
    if (newVendorId && lines.some((line) => line.additiveId)) {
      // Validation will be handled by useEffect
    }
  };

  const validateLines = React.useCallback(() => {
    if (!selectedVendorId || vendorAdditives.length === 0) return;

    const validAdditiveIds = new Set(vendorAdditives.map((v) => v.id));
    setLines((prevLines) => {
      const newLines = prevLines.map((line) => {
        if (!line.additiveId) {
          return { ...line, isValid: true, validationError: undefined };
        }

        const isValid = validAdditiveIds.has(line.additiveId);
        const newLine = {
          ...line,
          isValid,
          validationError: isValid
            ? undefined
            : "This additive is not available for the selected vendor",
        };

        if (
          line.isValid !== newLine.isValid ||
          line.validationError !== newLine.validationError
        ) {
          return newLine;
        }
        return line;
      });

      const hasChanges = newLines.some(
        (line, index) =>
          line.isValid !== prevLines[index].isValid ||
          line.validationError !== prevLines[index].validationError,
      );

      return hasChanges ? newLines : prevLines;
    });
  }, [selectedVendorId, vendorAdditives]);

  // Validate lines when vendor additives change
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
    totalCost: number | undefined,
  ) => {
    if (totalCost) return totalCost.toFixed(2);
    if (!quantity || !price) return "—";
    return (quantity * price).toFixed(2);
  };

  const calculateGrandTotal = () => {
    const total = lines.reduce((total, line) => {
      if (line.totalCost) return total + line.totalCost;
      if (!line.quantity || !line.pricePerUnit) return total;
      return total + line.quantity * line.pricePerUnit;
    }, 0);
    return total > 0 ? total.toFixed(2) : "—";
  };

  const onFormSubmit = (data: AdditivePurchaseForm) => {
    // Check for validation errors before submitting
    const hasInvalidLines = lines.some((line) => line.isValid === false);
    if (hasInvalidLines) {
      addNotification(
        "error",
        "Invalid Additives",
        "Please fix additive selections that are not available for the selected vendor",
      );
      return;
    }

    try {
      // Get vendor name for brand/manufacturer field
      const vendor = vendors.find((v) => v.id === data.vendorId);

      // Convert form data to API format
      const items = data.lines
        .filter((line) => line.additiveId && line.quantity)
        .map((line) => {
          const additive = vendorAdditives.find(
            (a) => a.id === line.additiveId,
          );
          return {
            additiveId: line.additiveId,
            additiveName: additive?.name || "Unknown Additive",
            additiveType: "other",
            quantity: line.quantity!,
            unit: line.unit,
            unitCost: line.pricePerUnit,
            totalCost:
              line.totalCost ||
              (line.pricePerUnit
                ? line.quantity! * line.pricePerUnit
                : undefined),
          };
        });

      if (items.length === 0) {
        addNotification(
          "error",
          "Incomplete Form",
          "Please add at least one additive with quantity",
        );
        return;
      }

      // Submit to parent handler
      onSubmit?.({
        vendorId: data.vendorId,
        vendorName: vendor?.name,
        purchaseDate: data.purchaseDate,
        notes: data.notes,
        items: items,
      });

      // Reset form
      reset();
      setLines([
        {
          additiveId: "",
          quantity: undefined,
          unit: "g",
          pricePerUnit: undefined,
          totalCost: undefined,
          isValid: true,
        },
      ]);
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setSelectedVendorId("");
      setVendorSearchQuery("");
    } catch (error) {
      console.error("Error preparing purchase data:", error);
      addNotification(
        "error",
        "Form Error",
        "Error preparing purchase data. Please check your inputs.",
      );
    }
  };

  const handleUnitCostChange = (index: number, value: number | undefined) => {
    const newLines = [...lines];
    newLines[index].pricePerUnit = value;
    // Calculate total from unit cost
    if (value && newLines[index].quantity) {
      newLines[index].totalCost = parseFloat(
        (value * newLines[index].quantity!).toFixed(2),
      );
    }
    setLines(newLines);
    setValue(`lines.${index}.pricePerUnit`, value);
    setValue(`lines.${index}.totalCost`, newLines[index].totalCost);
  };

  const handleTotalCostChange = (index: number, value: number | undefined) => {
    const newLines = [...lines];
    newLines[index].totalCost = value;
    // Calculate unit cost from total
    if (value && newLines[index].quantity) {
      newLines[index].pricePerUnit = parseFloat(
        (value / newLines[index].quantity!).toFixed(2),
      );
    }
    setLines(newLines);
    setValue(`lines.${index}.totalCost`, value);
    setValue(`lines.${index}.pricePerUnit`, newLines[index].pricePerUnit);
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
            <Beaker className="w-5 h-5 text-purple-600" />
            Record Additives Purchase
          </CardTitle>
          <CardDescription>
            Record new additive purchases from vendors
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
                          ? "border-purple-500 bg-purple-50"
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
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">
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

              {/* Purchase Date */}
              <div>
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => handlePurchaseDateChange(e.target.value)}
                    className="pl-10 h-12 max-w-xs"
                  />
                </div>
                {errors.purchaseDate && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.purchaseDate.message}
                  </p>
                )}
              </div>
            </div>

            {/* Additive Lines */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium">Additives</h3>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    {/* Stacked Layout for All Screen Sizes */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          Additive #{index + 1}
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

                      {/* Additive Selection */}
                      <div>
                        <Label>Additive</Label>
                        <Select
                          value={line.additiveId}
                          onValueChange={(value) => {
                            const newLines = [...lines];
                            newLines[index].additiveId = value;
                            setLines(newLines);
                            setValue(`lines.${index}.additiveId`, value);
                          }}
                          disabled={
                            !selectedVendorId || vendorAdditives.length === 0
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue
                              placeholder={
                                !selectedVendorId
                                  ? "Select a vendor first"
                                  : vendorAdditives.length === 0
                                    ? "No additives for this vendor"
                                    : "Select additive"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {vendorAdditives.map((additive: any) => (
                              <SelectItem key={additive.id} value={additive.id}>
                                {additive.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {line.validationError && (
                          <p className="text-sm text-red-600 mt-1">
                            {line.validationError}
                          </p>
                        )}
                      </div>

                      {/* Quantity and Unit */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>
                            Quantity{" "}
                            <span className="text-gray-500 text-sm">
                              (Required)
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
                              if (
                                newLines[index].pricePerUnit &&
                                newLines[index].quantity
                              ) {
                                newLines[index].totalCost = parseFloat(
                                  (
                                    newLines[index].pricePerUnit! *
                                    newLines[index].quantity!
                                  ).toFixed(2),
                                );
                              }
                              setLines(newLines);
                              setValue(
                                `lines.${index}.quantity`,
                                newLines[index].quantity,
                              );
                              setValue(
                                `lines.${index}.totalCost`,
                                newLines[index].totalCost,
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Select
                            value={line.unit}
                            onValueChange={(
                              value: "g" | "kg" | "lb" | "L" | "mL",
                            ) => {
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
                              {unitOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
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
                            onChange={(e) =>
                              handleUnitCostChange(
                                index,
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined,
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label>
                            Total Cost{" "}
                            <span className="text-gray-500 text-sm">
                              (Optional)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.totalCost || ""}
                            placeholder="0.00"
                            className="h-12"
                            onChange={(e) =>
                              handleTotalCostChange(
                                index,
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined,
                              )
                            }
                          />
                        </div>
                      </div>

                      {/* Line Total */}
                      <div>
                        <Label>Line Total</Label>
                        <div className="text-xl font-semibold text-purple-600">
                          {line.quantity != null &&
                          line.quantity > 0 &&
                          (line.pricePerUnit || line.totalCost) ? (
                            `$${calculateLineTotal(line.quantity, line.pricePerUnit, line.totalCost)}`
                          ) : (
                            <span className="text-gray-400">$—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Additive Button */}
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={addLine}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Additive
                </Button>
              </div>

              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Grand Total</p>
                  <p className="text-2xl font-bold text-purple-600">
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
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? "Recording..." : "Record Additives Purchase"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
