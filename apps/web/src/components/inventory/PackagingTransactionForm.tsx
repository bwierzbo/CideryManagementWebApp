"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/utils/trpc";
import { formatDateForInput } from "@/utils/date-format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Package,
  CheckCircle,
  XCircle,
  X,
  Search,
  CheckCircle2,
  Building2,
  Calendar,
  Scale,
} from "lucide-react";

// Form validation schema with packaging-specific rules
const packagingLineSchema = z.object({
  packagingId: z.string().uuid("Select packaging"),
  quantity: z
    .number()
    .min(1, "Quantity must be at least 1")
    .max(100000, "Quantity cannot exceed 100,000")
    .optional(),
  unitType: z.enum(["cases", "boxes", "individual", "pallets"], {
    message: "Please select a unit type",
  }),
  unitCost: z.number().nonnegative("Unit cost cannot be negative").optional(),
  totalCost: z.number().nonnegative("Total cost cannot be negative").optional(),
  notes: z.string().optional(),
});

const packagingTransactionSchema = z.object({
  vendorId: z.string().uuid("Select a vendor"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  notes: z.string().optional(),
  lines: z
    .array(packagingLineSchema)
    .min(1, "At least one packaging item is required"),
});

type PackagingTransactionFormData = z.infer<typeof packagingTransactionSchema>;

type NotificationType = {
  id: number;
  type: "success" | "error";
  title: string;
  message: string;
};

interface Vendor {
  id: string;
  name: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  isActive: boolean;
}

const unitTypeOptions = [
  { value: "cases", label: "Cases" },
  { value: "boxes", label: "Boxes" },
  { value: "individual", label: "Individual" },
  { value: "pallets", label: "Pallets" },
];

interface PackagingTransactionFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function PackagingTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: PackagingTransactionFormProps) {
  const [purchaseDate, setPurchaseDate] = useState<string>(
    formatDateForInput(new Date()),
  );
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorSearchQuery, setVendorSearchQuery] = useState<string>("");
  const [debouncedVendorSearch, setDebouncedVendorSearch] =
    useState<string>("");
  const [lines, setLines] = useState<
    Array<{
      packagingId: string;
      quantity: number | undefined;
      unitType: "cases" | "boxes" | "individual" | "pallets";
      unitCost: number | undefined;
      totalCost: number | undefined;
      notes: string | undefined;
      isValid?: boolean;
      validationError?: string;
    }>
  >([
    {
      packagingId: "",
      quantity: undefined,
      unitType: "cases",
      unitCost: undefined,
      totalCost: undefined,
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

  // Get vendors that have packaging varieties
  const { data: vendorData } = trpc.vendor.listByVarietyType.useQuery({
    varietyType: "packaging",
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

  // Get vendor packaging when vendor is selected
  const { data: vendorPackagingData } =
    trpc.packagingVarieties.getVendorLinks.useQuery(
      { vendorId: selectedVendorId },
      { enabled: !!selectedVendorId },
    );
  const vendorPackaging = React.useMemo(
    () =>
      vendorPackagingData?.map((link: any) => ({
        id: link.variety.id,
        name: link.variety.name,
        itemType: link.variety.itemType,
        isActive: link.variety.isActive,
      })) || [],
    [vendorPackagingData],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<PackagingTransactionFormData>({
    resolver: zodResolver(packagingTransactionSchema),
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
          packagingId: "",
          quantity: undefined,
          unitType: "cases" as const,
          unitCost: undefined,
          totalCost: undefined,
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
    if (newVendorId && lines.some((line) => line.packagingId)) {
      // Validation will be handled by useEffect
    }
  };

  const validateLines = React.useCallback(() => {
    if (!selectedVendorId || vendorPackaging.length === 0) return;

    const validPackagingIds = new Set(vendorPackaging.map((v) => v.id));
    setLines((prevLines) => {
      const newLines = prevLines.map((line) => {
        if (!line.packagingId) {
          return { ...line, isValid: true, validationError: undefined };
        }

        const isValid = validPackagingIds.has(line.packagingId);
        const newLine = {
          ...line,
          isValid,
          validationError: isValid
            ? undefined
            : "This packaging is not available for the selected vendor",
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
  }, [selectedVendorId, vendorPackaging]);

  // Validate lines when vendor packaging changes
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
      if (!line.quantity || !line.unitCost) return total;
      return total + line.quantity * line.unitCost;
    }, 0);
    return total > 0 ? total.toFixed(2) : "—";
  };

  const onFormSubmit = (data: PackagingTransactionFormData) => {
    // Check for validation errors before submitting
    const hasInvalidLines = lines.some((line) => line.isValid === false);
    if (hasInvalidLines) {
      addNotification(
        "error",
        "Invalid Packaging",
        "Please fix packaging selections that are not available for the selected vendor",
      );
      return;
    }

    try {
      // Get vendor name
      const vendor = vendors.find((v) => v.id === data.vendorId);

      // Convert form data to API format
      const items = data.lines
        .filter((line) => line.packagingId && line.quantity)
        .map((line) => {
          const packaging = vendorPackaging.find(
            (p) => p.id === line.packagingId,
          );
          return {
            packagingId: line.packagingId,
            packagingName: packaging?.name || "Unknown Packaging",
            packagingType: "other",
            quantity: line.quantity!,
            unitType: line.unitType,
            unitCost: line.unitCost,
            totalCost:
              line.totalCost ||
              (line.unitCost ? line.quantity! * line.unitCost : undefined),
            notes: line.notes,
          };
        });

      if (items.length === 0) {
        addNotification(
          "error",
          "Incomplete Form",
          "Please add at least one packaging item with quantity",
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
          packagingId: "",
          quantity: undefined,
          unitType: "cases",
          unitCost: undefined,
          totalCost: undefined,
          notes: undefined,
          isValid: true,
        },
      ]);
      setPurchaseDate(formatDateForInput(new Date()));
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
    newLines[index].unitCost = value;
    // Calculate total from unit cost
    if (value && newLines[index].quantity) {
      newLines[index].totalCost = parseFloat(
        (value * newLines[index].quantity!).toFixed(2),
      );
    }
    setLines(newLines);
    setValue(`lines.${index}.unitCost`, value);
    setValue(`lines.${index}.totalCost`, newLines[index].totalCost);
  };

  const handleTotalCostChange = (index: number, value: number | undefined) => {
    const newLines = [...lines];
    newLines[index].totalCost = value;
    // Calculate unit cost from total
    if (value && newLines[index].quantity) {
      newLines[index].unitCost = parseFloat(
        (value / newLines[index].quantity!).toFixed(2),
      );
    }
    setLines(newLines);
    setValue(`lines.${index}.totalCost`, value);
    setValue(`lines.${index}.unitCost`, newLines[index].unitCost);
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
            <Package className="w-5 h-5 text-amber-600" />
            Record Packaging Purchase
          </CardTitle>
          <CardDescription>
            Record new packaging purchases from vendors
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
                          ? "border-amber-500 bg-amber-50"
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
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">
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
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
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

            {/* Packaging Lines */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium">Packaging</h3>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    {/* Stacked Layout for All Screen Sizes */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          Packaging #{index + 1}
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

                      {/* Packaging Selection */}
                      <div>
                        <Label>Packaging</Label>
                        <Select
                          value={line.packagingId}
                          onValueChange={(value) => {
                            const newLines = [...lines];
                            newLines[index].packagingId = value;
                            setLines(newLines);
                            setValue(`lines.${index}.packagingId`, value);
                          }}
                          disabled={
                            !selectedVendorId || vendorPackaging.length === 0
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue
                              placeholder={
                                !selectedVendorId
                                  ? "Select a vendor first"
                                  : vendorPackaging.length === 0
                                    ? "No packaging for this vendor"
                                    : "Select packaging"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] overflow-y-auto">
                            {vendorPackaging.map((packaging: any) => (
                              <SelectItem
                                key={packaging.id}
                                value={packaging.id}
                              >
                                {packaging.name}
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

                      {/* Quantity and Unit Type */}
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
                            step="1"
                            value={line.quantity || ""}
                            placeholder="0"
                            className="h-12"
                            onChange={(e) => {
                              const newLines = [...lines];
                              newLines[index].quantity = e.target.value
                                ? parseInt(e.target.value)
                                : undefined;
                              if (
                                newLines[index].unitCost &&
                                newLines[index].quantity
                              ) {
                                newLines[index].totalCost = parseFloat(
                                  (
                                    newLines[index].unitCost! *
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
                          <Label>Unit Type</Label>
                          <Select
                            value={line.unitType}
                            onValueChange={(
                              value:
                                | "cases"
                                | "boxes"
                                | "individual"
                                | "pallets",
                            ) => {
                              const newLines = [...lines];
                              newLines[index].unitType = value;
                              setLines(newLines);
                              setValue(`lines.${index}.unitType`, value);
                            }}
                          >
                            <SelectTrigger className="h-12">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {unitTypeOptions.map((option) => (
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
                            value={line.unitCost || ""}
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
                          placeholder="Additional notes for this packaging..."
                          className="h-12"
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[index].notes = e.target.value || undefined;
                            setLines(newLines);
                            setValue(`lines.${index}.notes`, newLines[index].notes);
                          }}
                        />
                      </div>

                      {/* Line Total */}
                      <div>
                        <Label>Line Total</Label>
                        <div className="text-xl font-semibold text-amber-600">
                          {line.quantity != null &&
                          line.quantity > 0 &&
                          (line.unitCost || line.totalCost) ? (
                            `$${calculateLineTotal(line.quantity, line.unitCost, line.totalCost)}`
                          ) : (
                            <span className="text-gray-400">$—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Packaging Button */}
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={addLine}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Packaging
                </Button>
              </div>

              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Grand Total</p>
                  <p className="text-2xl font-bold text-amber-600">
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
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isSubmitting ? "Recording..." : "Record Packaging Purchase"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
