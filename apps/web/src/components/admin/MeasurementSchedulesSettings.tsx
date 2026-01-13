"use client";

import React, { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Beaker,
  Wine,
  Grape,
  Save,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Bell,
  Clock,
  Thermometer,
  Droplet,
  ChevronDown,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Types
interface MeasurementScheduleConfig {
  initialMeasurementTypes: string[];
  ongoingMeasurementTypes: string[];
  primaryMeasurement: string;
  usesFermentationStages: boolean;
  defaultIntervalDays: number | null;
  alertType: "check_in_reminder" | "measurement_overdue" | null;
}

interface CustomProductType {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  initialMeasurementTypes: string[];
  ongoingMeasurementTypes: string[];
  primaryMeasurement: string;
  usesFermentationStages: boolean;
  defaultIntervalDays: number | null;
  alertType: string | null;
  isActive: boolean;
}

// Measurement type options
const MEASUREMENT_TYPES = [
  { value: "sg", label: "Specific Gravity", icon: Beaker },
  { value: "abv", label: "ABV", icon: Wine },
  { value: "ph", label: "pH", icon: Droplet },
  { value: "temperature", label: "Temperature", icon: Thermometer },
  { value: "sensory", label: "Sensory Evaluation", icon: Grape },
  { value: "volume", label: "Volume", icon: Droplet },
];

// Built-in product types
const BUILT_IN_PRODUCT_TYPES = [
  { slug: "cider", name: "Cider", description: "Standard cider with SG-based fermentation tracking" },
  { slug: "perry", name: "Perry", description: "Pear cider with SG-based fermentation tracking" },
  { slug: "brandy", name: "Brandy", description: "Distilled spirit aged in barrels" },
  { slug: "pommeau", name: "Pommeau", description: "Fortified apple wine aged in barrels" },
  { slug: "juice", name: "Juice", description: "Non-fermented apple juice" },
];

// Default schedules
const DEFAULT_SCHEDULES: Record<string, MeasurementScheduleConfig> = {
  cider: {
    initialMeasurementTypes: ["sg", "ph", "temperature"],
    ongoingMeasurementTypes: ["sg", "ph", "temperature"],
    primaryMeasurement: "sg",
    usesFermentationStages: true,
    defaultIntervalDays: null,
    alertType: "measurement_overdue",
  },
  perry: {
    initialMeasurementTypes: ["sg", "ph", "temperature"],
    ongoingMeasurementTypes: ["sg", "ph", "temperature"],
    primaryMeasurement: "sg",
    usesFermentationStages: true,
    defaultIntervalDays: null,
    alertType: "measurement_overdue",
  },
  brandy: {
    initialMeasurementTypes: ["abv"],
    ongoingMeasurementTypes: ["sensory", "volume"],
    primaryMeasurement: "sensory",
    usesFermentationStages: false,
    defaultIntervalDays: 30,
    alertType: "check_in_reminder",
  },
  pommeau: {
    initialMeasurementTypes: ["sg", "ph"],
    ongoingMeasurementTypes: ["sensory", "volume"],
    primaryMeasurement: "sensory",
    usesFermentationStages: false,
    defaultIntervalDays: 90,
    alertType: "check_in_reminder",
  },
  juice: {
    initialMeasurementTypes: ["sg", "ph"],
    ongoingMeasurementTypes: [],
    primaryMeasurement: "sg",
    usesFermentationStages: false,
    defaultIntervalDays: null,
    alertType: null,
  },
};

function MeasurementTypeCheckboxes({
  selected,
  onChange,
  label,
}: {
  selected: string[];
  onChange: (types: string[]) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-3">
        {MEASUREMENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isChecked = selected.includes(type.value);
          return (
            <label
              key={type.value}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                isChecked
                  ? "bg-primary/10 border-primary"
                  : "bg-background border-input hover:bg-accent"
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, type.value]);
                  } else {
                    onChange(selected.filter((t) => t !== type.value));
                  }
                }}
              />
              <Icon className="h-4 w-4" />
              <span className="text-sm">{type.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ProductTypeScheduleEditor({
  productType,
  config,
  onSave,
  isBuiltIn = true,
}: {
  productType: { slug: string; name: string; description?: string };
  config: MeasurementScheduleConfig;
  onSave: (config: MeasurementScheduleConfig) => Promise<void>;
  isBuiltIn?: boolean;
}) {
  const [localConfig, setLocalConfig] = useState<MeasurementScheduleConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localConfig);
      toast({
        title: "Schedule updated",
        description: `Measurement schedule for ${productType.name} has been saved.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save measurement schedule.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{productType.name}</h4>
          {productType.description && (
            <p className="text-sm text-muted-foreground">{productType.description}</p>
          )}
        </div>
        {isBuiltIn && (
          <Badge variant="secondary">Built-in</Badge>
        )}
      </div>

      <div className="grid gap-6">
        <MeasurementTypeCheckboxes
          selected={localConfig.initialMeasurementTypes}
          onChange={(types) =>
            setLocalConfig({ ...localConfig, initialMeasurementTypes: types })
          }
          label="Initial Measurements (first check)"
        />

        <MeasurementTypeCheckboxes
          selected={localConfig.ongoingMeasurementTypes}
          onChange={(types) =>
            setLocalConfig({ ...localConfig, ongoingMeasurementTypes: types })
          }
          label="Ongoing Measurements (subsequent checks)"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${productType.slug}-primary`}>Primary Measurement</Label>
            <Select
              value={localConfig.primaryMeasurement}
              onValueChange={(value) =>
                setLocalConfig({ ...localConfig, primaryMeasurement: value })
              }
            >
              <SelectTrigger id={`${productType.slug}-primary`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEASUREMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${productType.slug}-alert`}>Alert Type</Label>
            <Select
              value={localConfig.alertType || "none"}
              onValueChange={(value) =>
                setLocalConfig({
                  ...localConfig,
                  alertType: value === "none" ? null : (value as "check_in_reminder" | "measurement_overdue"),
                })
              }
            >
              <SelectTrigger id={`${productType.slug}-alert`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Alerts</SelectItem>
                <SelectItem value="check_in_reminder">Check-in Reminder</SelectItem>
                <SelectItem value="measurement_overdue">Measurement Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Use Fermentation Stages</p>
              <p className="text-sm text-muted-foreground">
                Measurement frequency based on fermentation progress
              </p>
            </div>
          </div>
          <Switch
            checked={localConfig.usesFermentationStages}
            onCheckedChange={(checked) =>
              setLocalConfig({ ...localConfig, usesFermentationStages: checked })
            }
          />
        </div>

        {!localConfig.usesFermentationStages && (
          <div className="space-y-2">
            <Label htmlFor={`${productType.slug}-interval`}>
              Check-in Interval (days)
            </Label>
            <Input
              id={`${productType.slug}-interval`}
              type="number"
              min={1}
              value={localConfig.defaultIntervalDays || ""}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  defaultIntervalDays: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              placeholder="No scheduled interval"
            />
            <p className="text-sm text-muted-foreground">
              Leave empty for no automatic check-in reminders
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CollapsibleProductType({
  productType,
  schedule,
  onSave,
}: {
  productType: { slug: string; name: string; description?: string };
  schedule: MeasurementScheduleConfig;
  onSave: (config: MeasurementScheduleConfig) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-4 text-left border rounded-lg hover:bg-accent transition-colors">
          <div className="flex items-center gap-3">
            <span className="font-medium">{productType.name}</span>
            <Badge variant="outline" className="text-xs">
              {schedule.usesFermentationStages
                ? "SG-based"
                : schedule.defaultIntervalDays
                ? `Every ${schedule.defaultIntervalDays} days`
                : "No schedule"}
            </Badge>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <ProductTypeScheduleEditor
          productType={productType}
          config={schedule}
          onSave={onSave}
          isBuiltIn
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MeasurementSchedulesSettings() {
  const { toast } = useToast();
  const [customProductDialogOpen, setCustomProductDialogOpen] = useState(false);
  const [editingCustomProduct, setEditingCustomProduct] = useState<CustomProductType | null>(null);

  // Fetch measurement schedules
  const { data: schedules, isLoading, refetch } = trpc.settings.getMeasurementSchedules.useQuery();

  // Fetch custom product types
  const { data: customProductTypes, refetch: refetchCustomTypes } =
    trpc.customProductTypes.list.useQuery();

  // Mutations
  const updateScheduleMutation = trpc.settings.updateMeasurementSchedule.useMutation();
  const createCustomTypeMutation = trpc.customProductTypes.create.useMutation();
  const updateCustomTypeMutation = trpc.customProductTypes.update.useMutation();
  const deleteCustomTypeMutation = trpc.customProductTypes.delete.useMutation();

  // Get schedule for a product type
  const getSchedule = (slug: string): MeasurementScheduleConfig => {
    const schedulesMap = schedules as Record<string, MeasurementScheduleConfig | undefined> | undefined;
    const customSchedule = schedulesMap?.[slug];
    return customSchedule || DEFAULT_SCHEDULES[slug] || DEFAULT_SCHEDULES.cider;
  };

  // Save built-in product type schedule
  const handleSaveBuiltInSchedule = async (
    productType: string,
    config: MeasurementScheduleConfig
  ) => {
    await updateScheduleMutation.mutateAsync({
      productType: productType as "cider" | "perry" | "brandy" | "pommeau" | "juice",
      config: {
        initialMeasurementTypes: config.initialMeasurementTypes as Array<"sg" | "abv" | "ph" | "temperature" | "sensory" | "volume">,
        ongoingMeasurementTypes: config.ongoingMeasurementTypes as Array<"sg" | "abv" | "ph" | "temperature" | "sensory" | "volume">,
        primaryMeasurement: config.primaryMeasurement as "sg" | "abv" | "sensory" | "ph",
        usesFermentationStages: config.usesFermentationStages,
        defaultIntervalDays: config.defaultIntervalDays,
        alertType: config.alertType,
      },
    });
    refetch();
  };

  // Create or update custom product type
  const handleSaveCustomProductType = async (data: {
    name: string;
    slug: string;
    description?: string;
    initialMeasurementTypes: string[];
    ongoingMeasurementTypes: string[];
    primaryMeasurement: string;
    usesFermentationStages: boolean;
    defaultIntervalDays: number | null;
    alertType: string | null;
  }) => {
    try {
      // Type cast measurement types
      type MeasurementType = "sg" | "abv" | "ph" | "temperature" | "sensory" | "volume";
      const typedInitialTypes = data.initialMeasurementTypes as MeasurementType[];
      const typedOngoingTypes = data.ongoingMeasurementTypes as MeasurementType[];

      if (editingCustomProduct) {
        await updateCustomTypeMutation.mutateAsync({
          id: editingCustomProduct.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          initialMeasurementTypes: typedInitialTypes,
          ongoingMeasurementTypes: typedOngoingTypes,
          primaryMeasurement: data.primaryMeasurement as "sg" | "abv" | "sensory" | "ph",
          usesFermentationStages: data.usesFermentationStages,
          defaultIntervalDays: data.defaultIntervalDays,
          alertType: data.alertType as "check_in_reminder" | "measurement_overdue" | null,
        });
        toast({
          title: "Custom product type updated",
          description: `${data.name} has been updated.`,
        });
      } else {
        await createCustomTypeMutation.mutateAsync({
          name: data.name,
          slug: data.slug,
          description: data.description,
          initialMeasurementTypes: typedInitialTypes,
          ongoingMeasurementTypes: typedOngoingTypes,
          primaryMeasurement: data.primaryMeasurement as "sg" | "abv" | "sensory" | "ph",
          usesFermentationStages: data.usesFermentationStages,
          defaultIntervalDays: data.defaultIntervalDays,
          alertType: data.alertType as "check_in_reminder" | "measurement_overdue" | null,
        });
        toast({
          title: "Custom product type created",
          description: `${data.name} has been added.`,
        });
      }
      refetchCustomTypes();
      setCustomProductDialogOpen(false);
      setEditingCustomProduct(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save custom product type.",
        variant: "destructive",
      });
    }
  };

  // Delete custom product type
  const handleDeleteCustomProductType = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom product type?")) {
      return;
    }
    try {
      await deleteCustomTypeMutation.mutateAsync({ id });
      toast({
        title: "Custom product type deleted",
        description: "The product type has been removed.",
      });
      refetchCustomTypes();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete custom product type.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Measurement Schedules
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5" />
          Measurement Schedules
        </CardTitle>
        <CardDescription>
          Configure measurement types and check-in frequencies for each product type.
          Different products have different measurement needs - cider tracks SG during
          fermentation, while aged spirits need periodic sensory checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {BUILT_IN_PRODUCT_TYPES.map((productType) => (
            <CollapsibleProductType
              key={productType.slug}
              productType={productType}
              schedule={getSchedule(productType.slug)}
              onSave={(config) => handleSaveBuiltInSchedule(productType.slug, config)}
            />
          ))}
        </div>

        {/* Custom Product Types Section */}
        <div className="border-t pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Custom Product Types</h3>
              <p className="text-sm text-muted-foreground">
                Define your own product types with custom measurement schedules
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingCustomProduct(null);
                setCustomProductDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Product Type
            </Button>
          </div>

          {customProductTypes && customProductTypes.length > 0 ? (
            <div className="space-y-4">
              {customProductTypes.map((customType) => (
                <div
                  key={customType.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{customType.name}</span>
                      <Badge variant="secondary">{customType.slug}</Badge>
                      {!customType.isActive && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {customType.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {customType.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {customType.usesFermentationStages
                        ? "SG-based fermentation tracking"
                        : customType.defaultIntervalDays
                        ? `Check-in every ${customType.defaultIntervalDays} days`
                        : "No scheduled check-ins"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCustomProduct(customType);
                        setCustomProductDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCustomProductType(customType.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom product types defined. Add one to track measurements for
              specialty products.
            </p>
          )}
        </div>

        {/* Custom Product Type Dialog */}
        <CustomProductTypeDialog
          open={customProductDialogOpen}
          onOpenChange={setCustomProductDialogOpen}
          onSave={handleSaveCustomProductType}
          editingProduct={editingCustomProduct}
        />
      </CardContent>
    </Card>
  );
}

function CustomProductTypeDialog({
  open,
  onOpenChange,
  onSave,
  editingProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    slug: string;
    description?: string;
    initialMeasurementTypes: string[];
    ongoingMeasurementTypes: string[];
    primaryMeasurement: string;
    usesFermentationStages: boolean;
    defaultIntervalDays: number | null;
    alertType: string | null;
  }) => Promise<void>;
  editingProduct: CustomProductType | null;
}) {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    initialMeasurementTypes: [] as string[],
    ongoingMeasurementTypes: [] as string[],
    primaryMeasurement: "sg",
    usesFermentationStages: false,
    defaultIntervalDays: null as number | null,
    alertType: null as string | null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingProduct) {
        setFormData({
          name: editingProduct.name,
          slug: editingProduct.slug,
          description: editingProduct.description || "",
          initialMeasurementTypes: editingProduct.initialMeasurementTypes,
          ongoingMeasurementTypes: editingProduct.ongoingMeasurementTypes,
          primaryMeasurement: editingProduct.primaryMeasurement,
          usesFermentationStages: editingProduct.usesFermentationStages,
          defaultIntervalDays: editingProduct.defaultIntervalDays,
          alertType: editingProduct.alertType,
        });
      } else {
        setFormData({
          name: "",
          slug: "",
          description: "",
          initialMeasurementTypes: [],
          ongoingMeasurementTypes: [],
          primaryMeasurement: "sg",
          usesFermentationStages: false,
          defaultIntervalDays: null,
          alertType: null,
        });
      }
    }
  }, [open, editingProduct]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingProduct ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? "Edit Custom Product Type" : "Add Custom Product Type"}
          </DialogTitle>
          <DialogDescription>
            Define a new product type with its own measurement schedule and check-in
            frequency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Ice Cider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="e.g., ice-cider"
                disabled={!!editingProduct}
              />
              <p className="text-xs text-muted-foreground">
                Used internally to identify this product type
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description of this product type"
            />
          </div>

          <MeasurementTypeCheckboxes
            selected={formData.initialMeasurementTypes}
            onChange={(types) =>
              setFormData((prev) => ({ ...prev, initialMeasurementTypes: types }))
            }
            label="Initial Measurements"
          />

          <MeasurementTypeCheckboxes
            selected={formData.ongoingMeasurementTypes}
            onChange={(types) =>
              setFormData((prev) => ({ ...prev, ongoingMeasurementTypes: types }))
            }
            label="Ongoing Measurements"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Measurement</Label>
              <Select
                value={formData.primaryMeasurement}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, primaryMeasurement: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alert Type</Label>
              <Select
                value={formData.alertType || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    alertType: value === "none" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Alerts</SelectItem>
                  <SelectItem value="check_in_reminder">Check-in Reminder</SelectItem>
                  <SelectItem value="measurement_overdue">Measurement Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Use Fermentation Stages</p>
                <p className="text-sm text-muted-foreground">
                  Track SG-based fermentation progress
                </p>
              </div>
            </div>
            <Switch
              checked={formData.usesFermentationStages}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, usesFermentationStages: checked }))
              }
            />
          </div>

          {!formData.usesFermentationStages && (
            <div className="space-y-2">
              <Label>Check-in Interval (days)</Label>
              <Input
                type="number"
                min={1}
                value={formData.defaultIntervalDays || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultIntervalDays: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  }))
                }
                placeholder="No scheduled interval"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.slug}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {editingProduct ? "Update" : "Create"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
