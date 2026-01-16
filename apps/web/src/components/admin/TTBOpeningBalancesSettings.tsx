"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Edit,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Wine,
  Package,
  Droplet,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TaxClassBalances {
  hardCider: number;
  wineUnder16: number;
  wine16To21: number;
  wine21To24: number;
  sparklingWine: number;
  carbonatedWine: number;
}

interface SpiritsBalances {
  appleBrandy: number;
  grapeSpirits: number;
}

interface TTBOpeningBalances {
  bulk: TaxClassBalances;
  bottled: TaxClassBalances;
  spirits: SpiritsBalances;
}

const TAX_CLASS_LABELS: Record<keyof TaxClassBalances, string> = {
  hardCider: "Hard Cider (<8.5% ABV)",
  wineUnder16: "Wine (<16% ABV)",
  wine16To21: "Wine (16-21% ABV)",
  wine21To24: "Wine (21-24% ABV)",
  sparklingWine: "Sparkling Wine",
  carbonatedWine: "Carbonated Wine",
};

const SPIRITS_LABELS: Record<keyof SpiritsBalances, string> = {
  appleBrandy: "Apple Brandy",
  grapeSpirits: "Grape Spirits",
};

function TaxClassInput({
  label,
  bulkValue,
  bottledValue,
  onBulkChange,
  onBottledChange,
  isEditing,
}: {
  label: string;
  bulkValue: number;
  bottledValue: number;
  onBulkChange: (value: number) => void;
  onBottledChange: (value: number) => void;
  isEditing: boolean;
}) {
  // Show empty string for 0 values so users can easily type without cursor positioning
  const formatInputValue = (val: number) => (val === 0 ? "" : val.toString());

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-2 border-b last:border-0">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div>
        {isEditing ? (
          <Input
            type="number"
            step="0.001"
            min="0"
            placeholder="0"
            value={formatInputValue(bulkValue)}
            onChange={(e) => onBulkChange(parseFloat(e.target.value) || 0)}
            className="w-full"
          />
        ) : (
          <span className="text-sm">{bulkValue.toFixed(3)} gal</span>
        )}
      </div>
      <div>
        {isEditing ? (
          <Input
            type="number"
            step="0.001"
            min="0"
            placeholder="0"
            value={formatInputValue(bottledValue)}
            onChange={(e) => onBottledChange(parseFloat(e.target.value) || 0)}
            className="w-full"
          />
        ) : (
          <span className="text-sm">{bottledValue.toFixed(3)} gal</span>
        )}
      </div>
    </div>
  );
}

export function TTBOpeningBalancesSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current opening balances
  const {
    data: openingBalancesData,
    isLoading,
    refetch,
  } = trpc.ttb.getOpeningBalances.useQuery();

  const updateMutation = trpc.ttb.updateOpeningBalances.useMutation({
    onSuccess: () => {
      toast({
        title: "Opening Balances Saved",
        description: "TTB opening balances have been updated.",
      });
      refetch();
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState<{
    date: string;
    balances: TTBOpeningBalances;
  }>({
    date: "",
    balances: {
      bulk: {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
      },
      bottled: {
        hardCider: 0,
        wineUnder16: 0,
        wine16To21: 0,
        wine21To24: 0,
        sparklingWine: 0,
        carbonatedWine: 0,
      },
      spirits: {
        appleBrandy: 0,
        grapeSpirits: 0,
      },
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (openingBalancesData) {
      setFormData({
        date: openingBalancesData.date || "",
        balances: openingBalancesData.balances as TTBOpeningBalances,
      });
    }
  }, [openingBalancesData]);

  const handleSave = async () => {
    if (!formData.date) {
      toast({
        title: "Date Required",
        description: "Please enter the opening balance date.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        date: formData.date,
        balances: formData.balances,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (openingBalancesData) {
      setFormData({
        date: openingBalancesData.date || "",
        balances: openingBalancesData.balances as TTBOpeningBalances,
      });
    }
    setIsEditing(false);
  };

  const updateBulkValue = (key: keyof TaxClassBalances, value: number) => {
    setFormData((prev) => ({
      ...prev,
      balances: {
        ...prev.balances,
        bulk: {
          ...prev.balances.bulk,
          [key]: value,
        },
      },
    }));
  };

  const updateBottledValue = (key: keyof TaxClassBalances, value: number) => {
    setFormData((prev) => ({
      ...prev,
      balances: {
        ...prev.balances,
        bottled: {
          ...prev.balances.bottled,
          [key]: value,
        },
      },
    }));
  };

  const updateSpiritsValue = (key: keyof SpiritsBalances, value: number) => {
    setFormData((prev) => ({
      ...prev,
      balances: {
        ...prev.balances,
        spirits: {
          ...prev.balances.spirits,
          [key]: value,
        },
      },
    }));
  };

  // Calculate totals
  const bulkTotal = Object.values(formData.balances.bulk).reduce(
    (a, b) => a + b,
    0
  );
  const bottledTotal = Object.values(formData.balances.bottled).reduce(
    (a, b) => a + b,
    0
  );
  const spiritsTotal = Object.values(formData.balances.spirits).reduce(
    (a, b) => a + b,
    0
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasOpeningBalances = !!formData.date;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">TTB Opening Balances</CardTitle>
              <CardDescription>
                Set inventory balances as of your TTB reporting start date
              </CardDescription>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              {hasOpeningBalances ? "Edit" : "Set Balances"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {!hasOpeningBalances && !isEditing && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Opening Balances Not Set
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Enter your TTB opening balances to enable accurate beginning
                inventory tracking. These should reflect your inventory on hand
                at the start of your TTB reporting in this system.
              </p>
            </div>
          </div>
        )}

        {hasOpeningBalances && !isEditing && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Opening Balances Set
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Opening date: {formData.date} | Total:{" "}
                {(bulkTotal + bottledTotal).toFixed(1)} wine gallons bulk/bottled
                {spiritsTotal > 0 && ` + ${spiritsTotal.toFixed(1)} proof gallons spirits`}
              </p>
            </div>
          </div>
        )}

        {/* Opening Balance Date */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Opening Balance Date
            <span className="text-xs text-gray-500">
              (Last day of your previous reporting period)
            </span>
          </Label>
          {isEditing ? (
            <Input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              className="max-w-xs"
            />
          ) : (
            <p className="text-sm py-2 font-mono">{formData.date || "Not set"}</p>
          )}
          <p className="text-xs text-gray-500">
            Typically December 31 of the previous year (e.g., 2024-12-31 for 2025
            reporting)
          </p>
        </div>

        {/* Wine/Cider Balances by Tax Class */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wine className="w-4 h-4 text-purple-600" />
            <h4 className="font-medium text-gray-900">
              Wine/Cider by Tax Class (Wine Gallons)
            </h4>
          </div>

          <div className="border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 font-medium text-sm text-gray-700 border-b">
              <div>Tax Class</div>
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4" />
                Bulk
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Bottled
              </div>
            </div>

            {/* Tax Class Rows */}
            <div className="p-3">
              {(Object.keys(TAX_CLASS_LABELS) as Array<keyof TaxClassBalances>).map(
                (key) => (
                  <TaxClassInput
                    key={key}
                    label={TAX_CLASS_LABELS[key]}
                    bulkValue={formData.balances.bulk[key]}
                    bottledValue={formData.balances.bottled[key]}
                    onBulkChange={(value) => updateBulkValue(key, value)}
                    onBottledChange={(value) => updateBottledValue(key, value)}
                    isEditing={isEditing}
                  />
                )
              )}

              {/* Totals */}
              <div className="grid grid-cols-3 gap-4 items-center pt-3 mt-2 border-t-2 font-semibold">
                <div className="text-sm text-gray-900">Total</div>
                <div className="text-sm">{bulkTotal.toFixed(1)} gal</div>
                <div className="text-sm">{bottledTotal.toFixed(1)} gal</div>
              </div>
            </div>
          </div>
        </div>

        {/* Spirits Balances */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Droplet className="w-4 h-4 text-amber-600" />
            <h4 className="font-medium text-gray-900">
              Spirits on Hand (Proof Gallons)
            </h4>
          </div>

          <div className="border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(SPIRITS_LABELS) as Array<keyof SpiritsBalances>).map(
                (key) => {
                  const value = formData.balances.spirits[key];
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-sm">{SPIRITS_LABELS[key]}</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          value={value === 0 ? "" : value.toString()}
                          onChange={(e) =>
                            updateSpiritsValue(key, parseFloat(e.target.value) || 0)
                          }
                        />
                      ) : (
                        <p className="text-sm py-2">
                          {value.toFixed(3)} proof gal
                        </p>
                      )}
                    </div>
                  );
                }
              )}
            </div>
            <div className="pt-3 mt-3 border-t font-semibold text-sm">
              Total Spirits: {spiritsTotal.toFixed(1)} proof gallons
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Opening Balances
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
