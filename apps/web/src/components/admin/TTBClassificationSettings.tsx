"use client";

import { useState, useEffect } from "react";
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
import { Edit, Save, X, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import {
  type TTBClassificationConfig,
  DEFAULT_TTB_CLASSIFICATION_CONFIG,
} from "lib/src/calculations/ttb";

function NumberField({
  label,
  value,
  onChange,
  isEditing,
  step = "0.01",
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  isEditing: boolean;
  step?: string;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 items-center py-1.5">
      <Label className="text-sm text-gray-700">{label}</Label>
      {isEditing ? (
        <Input
          type="number"
          step={step}
          value={value === 0 ? "" : value.toString()}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-8 text-sm"
          placeholder="0"
        />
      ) : (
        <span className="text-sm font-medium tabular-nums">
          {value}{suffix}
        </span>
      )}
    </div>
  );
}

export function TTBClassificationSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<TTBClassificationConfig>(
    DEFAULT_TTB_CLASSIFICATION_CONFIG
  );

  const { data: configData, isLoading, refetch } =
    trpc.ttb.getTTBClassificationConfig.useQuery();

  const updateMutation = trpc.ttb.updateTTBClassificationConfig.useMutation({
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "TTB classification config updated." });
      refetch();
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (configData) {
      setFormData(configData as TTBClassificationConfig);
    }
  }, [configData]);

  const handleCancel = () => {
    if (configData) {
      setFormData(configData as TTBClassificationConfig);
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_TTB_CLASSIFICATION_CONFIG);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">TTB Classification Thresholds</CardTitle>
            <CardDescription>
              Configure how batches are classified into TTB tax categories based on ABV, CO2 level, and fruit source.
            </CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hard Cider Thresholds */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 border-b pb-1">
            Hard Cider (27 CFR 24.331)
          </h4>
          <div className="space-y-0.5">
            <NumberField
              label="Min ABV (%)"
              value={formData.thresholds.hardCider.minAbv}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  thresholds: {
                    ...f.thresholds,
                    hardCider: { ...f.thresholds.hardCider, minAbv: v },
                  },
                }))
              }
              isEditing={isEditing}
              suffix="%"
            />
            <NumberField
              label="Max ABV (%)"
              value={formData.thresholds.hardCider.maxAbv}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  thresholds: {
                    ...f.thresholds,
                    hardCider: { ...f.thresholds.hardCider, maxAbv: v },
                  },
                }))
              }
              isEditing={isEditing}
              suffix="%"
            />
            <NumberField
              label="Max CO2 (g/100ml)"
              value={formData.thresholds.hardCider.maxCo2GramsPer100ml}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  thresholds: {
                    ...f.thresholds,
                    hardCider: {
                      ...f.thresholds.hardCider,
                      maxCo2GramsPer100ml: v,
                    },
                  },
                }))
              }
              isEditing={isEditing}
              step="0.001"
              suffix=" g/100ml"
            />
            <div className="grid grid-cols-2 gap-2 items-center py-1.5">
              <Label className="text-sm text-gray-700">Allowed Fruit Sources</Label>
              {isEditing ? (
                <Input
                  value={formData.thresholds.hardCider.allowedFruitSources.join(", ")}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      thresholds: {
                        ...f.thresholds,
                        hardCider: {
                          ...f.thresholds.hardCider,
                          allowedFruitSources: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      },
                    }))
                  }
                  className="h-8 text-sm"
                  placeholder="apple, pear"
                />
              ) : (
                <span className="text-sm font-medium">
                  {formData.thresholds.hardCider.allowedFruitSources.join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Still Wine CO2 Threshold */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 border-b pb-1">
            Still Wine CO2 Limit
          </h4>
          <NumberField
            label="Max CO2 (g/100ml)"
            value={formData.thresholds.stillWineMaxCo2GramsPer100ml}
            onChange={(v) =>
              setFormData((f) => ({
                ...f,
                thresholds: {
                  ...f.thresholds,
                  stillWineMaxCo2GramsPer100ml: v,
                },
              }))
            }
            isEditing={isEditing}
            step="0.001"
            suffix=" g/100ml"
          />
        </div>

        {/* ABV Brackets */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 border-b pb-1">
            ABV Brackets
          </h4>
          <div className="space-y-0.5">
            <NumberField
              label="Still Wine Max (%)"
              value={formData.thresholds.abvBrackets.under16MaxAbv}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  thresholds: {
                    ...f.thresholds,
                    abvBrackets: {
                      ...f.thresholds.abvBrackets,
                      under16MaxAbv: v,
                    },
                  },
                }))
              }
              isEditing={isEditing}
              step="0.1"
              suffix="%"
            />
            <NumberField
              label="Mid-Range Max (%)"
              value={formData.thresholds.abvBrackets.midRangeMaxAbv}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  thresholds: {
                    ...f.thresholds,
                    abvBrackets: {
                      ...f.thresholds.abvBrackets,
                      midRangeMaxAbv: v,
                    },
                  },
                }))
              }
              isEditing={isEditing}
              step="0.1"
              suffix="%"
            />
            <NumberField
              label="Upper Max (%)"
              value={formData.thresholds.abvBrackets.upperMaxAbv}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  thresholds: {
                    ...f.thresholds,
                    abvBrackets: {
                      ...f.thresholds.abvBrackets,
                      upperMaxAbv: v,
                    },
                  },
                }))
              }
              isEditing={isEditing}
              step="0.1"
              suffix="%"
            />
          </div>
        </div>

        {/* Tax Rates */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 border-b pb-1">
            Tax Rates ($/gallon)
          </h4>
          <div className="space-y-0.5">
            <NumberField
              label="Hard Cider"
              value={formData.taxRates.hardCider}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  taxRates: { ...f.taxRates, hardCider: v },
                }))
              }
              isEditing={isEditing}
              step="0.001"
              suffix="/gal"
            />
            <NumberField
              label="Wine ≤16%"
              value={formData.taxRates.wineUnder16}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  taxRates: { ...f.taxRates, wineUnder16: v },
                }))
              }
              isEditing={isEditing}
              suffix="/gal"
            />
            <NumberField
              label="Wine 16-21%"
              value={formData.taxRates.wine16To21}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  taxRates: { ...f.taxRates, wine16To21: v },
                }))
              }
              isEditing={isEditing}
              suffix="/gal"
            />
            <NumberField
              label="Wine 21-24%"
              value={formData.taxRates.wine21To24}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  taxRates: { ...f.taxRates, wine21To24: v },
                }))
              }
              isEditing={isEditing}
              suffix="/gal"
            />
            <NumberField
              label="Artificially Carbonated"
              value={formData.taxRates.carbonatedWine}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  taxRates: { ...f.taxRates, carbonatedWine: v },
                }))
              }
              isEditing={isEditing}
              suffix="/gal"
            />
            <NumberField
              label="Sparkling Wine"
              value={formData.taxRates.sparklingWine}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  taxRates: { ...f.taxRates, sparklingWine: v },
                }))
              }
              isEditing={isEditing}
              suffix="/gal"
            />
          </div>
        </div>

        {/* CBMA Credits */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 border-b pb-1">
            CBMA Small Producer Credits
          </h4>
          <div className="space-y-0.5">
            <NumberField
              label="Credit ($/gallon)"
              value={formData.cbmaCredits.smallProducerCreditPerGallon}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  cbmaCredits: {
                    ...f.cbmaCredits,
                    smallProducerCreditPerGallon: v,
                  },
                }))
              }
              isEditing={isEditing}
              step="0.001"
              suffix="/gal"
            />
            <NumberField
              label="Credit Limit (gallons)"
              value={formData.cbmaCredits.creditLimitGallons}
              onChange={(v) =>
                setFormData((f) => ({
                  ...f,
                  cbmaCredits: {
                    ...f.cbmaCredits,
                    creditLimitGallons: v,
                  },
                }))
              }
              isEditing={isEditing}
              step="1000"
              suffix=" gal"
            />
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              className="text-gray-600"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset to Defaults
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
