"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/utils/trpc";
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
  Droplets,
  CheckCircle,
  XCircle,
  X,
  Search,
  CheckCircle2,
  Building2,
  Calendar,
  Scale,
  Beaker,
  TestTube,
} from "lucide-react";

// Form validation schema with juice-specific rules
const juiceLineSchema = z.object({
  juiceId: z.string().uuid("Select a juice"),
  volume: z
    .number()
    .min(0.1, "Volume must be at least 0.1")
    .max(10000, "Volume cannot exceed 10,000")
    .optional(),
  unit: z.enum(["gallons", "liters"], { message: "Please select a unit" }),
  specificGravity: z
    .number()
    .min(0.9, "Specific gravity must be at least 0.9")
    .max(1.2, "Specific gravity cannot exceed 1.2")
    .optional(),
  ph: z
    .number()
    .min(0, "pH must be at least 0")
    .max(14, "pH cannot exceed 14")
    .optional(),
  unitCost: z.number().min(0, "Unit cost must be positive").optional(),
  totalCost: z.number().min(0, "Total cost must be positive").optional(),
});

const juiceTransactionSchema = z.object({
  vendorId: z.string().uuid("Select a vendor"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  notes: z.string().optional(),
  lines: z.array(juiceLineSchema).min(1, "At least one juice is required"),
});

type JuiceTransactionFormData = z.infer<typeof juiceTransactionSchema>;

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

const unitOptions = [
  { value: "gallons", label: "Gallons (gal)" },
  { value: "liters", label: "Liters (L)" },
];

interface JuiceTransactionFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function JuiceTransactionForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: JuiceTransactionFormProps) {
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
      juiceId: string;
      volume: number | undefined;
      unit: "gallons" | "liters";
      specificGravity: number | undefined;
      ph: number | undefined;
      unitCost: number | undefined;
      totalCost: number | undefined;
      isValid?: boolean;
      validationError?: string;
    }>
  >([
    {
      juiceId: "",
      volume: undefined,
      unit: "gallons",
      specificGravity: undefined,
      ph: undefined,
      unitCost: undefined,
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

  // Get vendors that have juice varieties
  const { data: vendorData } = trpc.vendor.listByVarietyType.useQuery({
    varietyType: "juice",
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

  // Get vendor juices when vendor is selected
  const { data: vendorJuicesData } = trpc.vendorVariety.listForVendor.useQuery(
    { vendorId: selectedVendorId },
    { enabled: !!selectedVendorId },
  );
  const vendorJuices = React.useMemo(
    () =>
      vendorJuicesData?.varieties.filter(
        (v: any) => v.varietyType === "juice",
      ) || [],
    [vendorJuicesData],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<JuiceTransactionFormData>({
    resolver: zodResolver(juiceTransactionSchema),
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
          juiceId: "",
          volume: undefined,
          unit: "gallons" as const,
          specificGravity: undefined,
          ph: undefined,
          unitCost: undefined,
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
    if (newVendorId && lines.some((line) => line.juiceId)) {
      // Validation will be handled by useEffect
    }
  };

  const validateLines = React.useCallback(() => {
    if (!selectedVendorId || vendorJuices.length === 0) return;

    const validJuiceIds = new Set(vendorJuices.map((v) => v.id));
    setLines((prevLines) => {
      const newLines = prevLines.map((line) => {
        if (!line.juiceId) {
          return { ...line, isValid: true, validationError: undefined };
        }

        const isValid = validJuiceIds.has(line.juiceId);
        const newLine = {
          ...line,
          isValid,
          validationError: isValid
            ? undefined
            : "This juice is not available for the selected vendor",
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
  }, [selectedVendorId, vendorJuices]);

  // Validate lines when vendor juices change
  React.useEffect(() => {
    validateLines();
  }, [validateLines]);

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
    setValue("lines", newLines);
  };

  const calculateLineTotal = (
    volume: number | undefined,
    price: number | undefined,
    totalCost: number | undefined,
  ) => {
    if (totalCost) return totalCost.toFixed(2);
    if (!volume || !price) return "—";
    return (volume * price).toFixed(2);
  };

  const calculateGrandTotal = () => {
    const total = lines.reduce((total, line) => {
      if (line.totalCost) return total + line.totalCost;
      if (!line.volume || !line.unitCost) return total;
      return total + line.volume * line.unitCost;
    }, 0);
    return total > 0 ? total.toFixed(2) : "—";
  };

  const onFormSubmit = (data: JuiceTransactionFormData) => {
    // Check for validation errors before submitting
    const hasInvalidLines = lines.some((line) => line.isValid === false);
    if (hasInvalidLines) {
      addNotification(
        "error",
        "Invalid Juices",
        "Please fix juice selections that are not available for the selected vendor",
      );
      return;
    }

    try {
      // Get vendor name
      const vendor = vendors.find((v) => v.id === data.vendorId);

      // Convert form data to API format
      const items = data.lines
        .filter((line) => line.juiceId && line.volume)
        .map((line) => {
          const juice = vendorJuices.find((j) => j.id === line.juiceId);
          return {
            juiceId: line.juiceId,
            juiceName: juice?.name || "Unknown Juice",
            volume: line.volume!,
            unit: line.unit,
            specificGravity: line.specificGravity,
            ph: line.ph,
            unitCost: line.unitCost,
            totalCost:
              line.totalCost ||
              (line.unitCost ? line.volume! * line.unitCost : undefined),
          };
        });

      if (items.length === 0) {
        addNotification(
          "error",
          "Incomplete Form",
          "Please add at least one juice with volume",
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
          juiceId: "",
          volume: undefined,
          unit: "gallons",
          specificGravity: undefined,
          ph: undefined,
          unitCost: undefined,
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
    newLines[index].unitCost = value;
    // Calculate total from unit cost
    if (value && newLines[index].volume) {
      newLines[index].totalCost = parseFloat(
        (value * newLines[index].volume!).toFixed(2),
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
    if (value && newLines[index].volume) {
      newLines[index].unitCost = parseFloat(
        (value / newLines[index].volume!).toFixed(2),
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
            <Droplets className="w-5 h-5 text-blue-600" />
            Record Juice Purchase
          </CardTitle>
          <CardDescription>
            Record new juice purchases from vendors
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
                          ? "border-blue-500 bg-blue-50"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
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

            {/* Juice Lines */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium">Juices</h3>
              </div>

              {/* Desktop Header Row - Only show once */}
              <div className="hidden lg:grid lg:grid-cols-8 gap-4 px-4 pb-2 text-sm font-medium text-gray-700">
                <div className="lg:col-span-2">
                  Juice <span className="text-gray-500 text-xs font-normal">(Vendor first)</span>
                </div>
                <div>Volume <span className="text-red-500">*</span></div>
                <div>Unit</div>
                <div>SG <span className="text-gray-500 text-xs font-normal">(Optional)</span></div>
                <div>pH <span className="text-gray-500 text-xs font-normal">(Optional)</span></div>
                <div>Price/Unit <span className="text-gray-500 text-xs font-normal">(Optional)</span></div>
                <div>Total Cost <span className="text-gray-500 text-xs font-normal">(Optional)</span></div>
                <div className="text-right">Line Total</div>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    {/* Desktop Layout */}
                    <div className="hidden lg:grid lg:grid-cols-8 gap-4 items-start">
                      <div className="lg:col-span-2">
                        <Select
                          value={line.juiceId}
                          onValueChange={(value) => {
                            const newLines = [...lines];
                            newLines[index].juiceId = value;
                            setLines(newLines);
                            setValue(`lines.${index}.juiceId`, value);
                          }}
                          disabled={
                            !selectedVendorId || vendorJuices.length === 0
                          }
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue
                              placeholder={
                                !selectedVendorId
                                  ? "Select a vendor first"
                                  : vendorJuices.length === 0
                                    ? "No juices for this vendor"
                                    : "Select juice"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {vendorJuices.map((juice: any) => (
                              <SelectItem key={juice.id} value={juice.id}>
                                <div>
                                  <div className="font-medium">
                                    {juice.name}
                                  </div>
                                  {juice.description && (
                                    <div className="text-xs text-gray-500">
                                      {juice.description}
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {line.validationError && (
                          <p className="text-sm text-red-600 mt-1">
                            {line.validationError}
                          </p>
                        )}
                        {selectedVendorId && vendorJuices.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            No juices linked to this vendor. Please link juices
                            on the Vendors page first.
                          </p>
                        )}
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.1"
                          value={line.volume || ""}
                          placeholder="Enter volume"
                          className="h-10"
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[index].volume = e.target.value
                              ? parseFloat(e.target.value)
                              : undefined;
                            // Recalculate total if unit cost is set
                            if (
                              newLines[index].unitCost &&
                              newLines[index].volume
                            ) {
                              newLines[index].totalCost = parseFloat(
                                (
                                  newLines[index].unitCost! *
                                  newLines[index].volume!
                                ).toFixed(2),
                              );
                            }
                            setLines(newLines);
                            setValue(
                              `lines.${index}.volume`,
                              newLines[index].volume,
                            );
                            setValue(
                              `lines.${index}.totalCost`,
                              newLines[index].totalCost,
                            );
                          }}
                        />
                      </div>
                      <div>
                        <Select
                          value={line.unit}
                          onValueChange={(value: "gallons" | "liters") => {
                            const newLines = [...lines];
                            newLines[index].unit = value;
                            setLines(newLines);
                            setValue(`lines.${index}.unit`, value);
                          }}
                        >
                          <SelectTrigger className="h-10">
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
                      <div>
                        <Input
                          type="number"
                          step="0.001"
                          value={line.specificGravity || ""}
                          placeholder="1.000"
                          className="h-10"
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[index].specificGravity = e.target.value
                              ? parseFloat(e.target.value)
                              : undefined;
                            setLines(newLines);
                            setValue(
                              `lines.${index}.specificGravity`,
                              newLines[index].specificGravity,
                            );
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.1"
                          value={line.ph || ""}
                          placeholder="3.5"
                          className="h-10"
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[index].ph = e.target.value
                              ? parseFloat(e.target.value)
                              : undefined;
                            setLines(newLines);
                            setValue(`lines.${index}.ph`, newLines[index].ph);
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.unitCost || ""}
                          placeholder="Enter price"
                          className="h-10"
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
                        <Input
                          type="number"
                          step="0.01"
                          value={line.totalCost || ""}
                          placeholder="0.00"
                          className="h-10"
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
                      <div className="flex items-center">
                        <div className="w-full">
                          <div className="text-lg font-semibold text-blue-600">
                            $
                            {calculateLineTotal(
                              line.volume,
                              line.unitCost,
                              line.totalCost,
                            )}
                          </div>
                        </div>
                        {lines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(index)}
                            className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Mobile/Tablet Layout */}
                    <div className="lg:hidden space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          Juice #{index + 1}
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

                      {/* Juice Selection */}
                      <div>
                        <Label>Juice</Label>
                        <Select
                          value={line.juiceId}
                          onValueChange={(value) => {
                            const newLines = [...lines];
                            newLines[index].juiceId = value;
                            setLines(newLines);
                            setValue(`lines.${index}.juiceId`, value);
                          }}
                          disabled={
                            !selectedVendorId || vendorJuices.length === 0
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue
                              placeholder={
                                !selectedVendorId
                                  ? "Select a vendor first"
                                  : vendorJuices.length === 0
                                    ? "No juices for this vendor"
                                    : "Select juice"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {vendorJuices.map((juice: any) => (
                              <SelectItem key={juice.id} value={juice.id}>
                                {juice.name}
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

                      {/* Volume and Unit */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>
                            Volume{" "}
                            <span className="text-gray-500 text-sm">
                              (Required)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={line.volume || ""}
                            placeholder="0.0"
                            className="h-12"
                            onChange={(e) => {
                              const newLines = [...lines];
                              newLines[index].volume = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              if (
                                newLines[index].unitCost &&
                                newLines[index].volume
                              ) {
                                newLines[index].totalCost = parseFloat(
                                  (
                                    newLines[index].unitCost! *
                                    newLines[index].volume!
                                  ).toFixed(2),
                                );
                              }
                              setLines(newLines);
                              setValue(
                                `lines.${index}.volume`,
                                newLines[index].volume,
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
                            onValueChange={(value: "gallons" | "liters") => {
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

                      {/* SG and pH */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>
                            SG{" "}
                            <span className="text-gray-500 text-sm">
                              (Optional)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={line.specificGravity || ""}
                            placeholder="1.000"
                            className="h-12"
                            onChange={(e) => {
                              const newLines = [...lines];
                              newLines[index].specificGravity = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              setLines(newLines);
                              setValue(
                                `lines.${index}.specificGravity`,
                                newLines[index].specificGravity,
                              );
                            }}
                          />
                        </div>
                        <div>
                          <Label>
                            pH{" "}
                            <span className="text-gray-500 text-sm">
                              (Optional)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={line.ph || ""}
                            placeholder="3.5"
                            className="h-12"
                            onChange={(e) => {
                              const newLines = [...lines];
                              newLines[index].ph = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              setLines(newLines);
                              setValue(`lines.${index}.ph`, newLines[index].ph);
                            }}
                          />
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

                      {/* Line Total */}
                      <div>
                        <Label>Line Total</Label>
                        <div className="text-xl font-semibold text-blue-600">
                          {line.volume != null &&
                          line.volume > 0 &&
                          (line.unitCost || line.totalCost) ? (
                            `$${calculateLineTotal(line.volume, line.unitCost, line.totalCost)}`
                          ) : (
                            <span className="text-gray-400">$—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Juice Button */}
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={addLine}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Juice
                </Button>
              </div>

              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Grand Total</p>
                  <p className="text-2xl font-bold text-blue-600">
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Recording..." : "Record Juice Purchase"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
