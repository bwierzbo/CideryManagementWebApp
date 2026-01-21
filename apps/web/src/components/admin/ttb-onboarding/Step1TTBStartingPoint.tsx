"use client";

import React, { useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  ChevronRight,
  Info,
  Wine,
  Package,
  Droplet,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  Step1Data,
  TaxClassBalances,
  SpiritsBalances,
  TAX_CLASS_LABELS,
  SPIRITS_LABELS,
} from "./types";

interface Step1Props {
  data: Step1Data;
  onUpdate: (data: Partial<Step1Data>) => void;
  onNext: () => void;
}

function TaxClassInput({
  label,
  bulkValue,
  bottledValue,
  onBulkChange,
  onBottledChange,
}: {
  label: string;
  bulkValue: number;
  bottledValue: number;
  onBulkChange: (value: number) => void;
  onBottledChange: (value: number) => void;
}) {
  const formatInputValue = (val: number) => (val === 0 ? "" : val.toString());

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-2 border-b last:border-0">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div>
        <Input
          type="number"
          step="0.001"
          min="0"
          placeholder="0"
          value={formatInputValue(bulkValue)}
          onChange={(e) => onBulkChange(parseFloat(e.target.value) || 0)}
          className="w-full"
        />
      </div>
      <div>
        <Input
          type="number"
          step="0.001"
          min="0"
          placeholder="0"
          value={formatInputValue(bottledValue)}
          onChange={(e) => onBottledChange(parseFloat(e.target.value) || 0)}
          className="w-full"
        />
      </div>
    </div>
  );
}

export function Step1TTBStartingPoint({ data, onUpdate, onNext }: Step1Props) {
  // Fetch existing opening balances to pre-populate
  const { data: existingData } = trpc.ttb.getOpeningBalances.useQuery();

  // Pre-populate from existing data if available and form is empty
  useEffect(() => {
    if (existingData && !data.date && existingData.date) {
      onUpdate({
        date: existingData.date,
        balances: existingData.balances,
        reconciliationNotes: existingData.reconciliationNotes || "",
      });
    }
  }, [existingData, data.date, onUpdate]);

  const updateBulkValue = (key: keyof TaxClassBalances, value: number) => {
    onUpdate({
      balances: {
        ...data.balances,
        bulk: {
          ...data.balances.bulk,
          [key]: value,
        },
      },
    });
  };

  const updateBottledValue = (key: keyof TaxClassBalances, value: number) => {
    onUpdate({
      balances: {
        ...data.balances,
        bottled: {
          ...data.balances.bottled,
          [key]: value,
        },
      },
    });
  };

  const updateSpiritsValue = (key: keyof SpiritsBalances, value: number) => {
    onUpdate({
      balances: {
        ...data.balances,
        spirits: {
          ...data.balances.spirits,
          [key]: value,
        },
      },
    });
  };

  // Calculate totals
  const bulkTotal = Object.values(data.balances.bulk).reduce((a, b) => a + b, 0);
  const bottledTotal = Object.values(data.balances.bottled).reduce((a, b) => a + b, 0);
  const spiritsTotal = Object.values(data.balances.spirits).reduce((a, b) => a + b, 0);
  const wineTotal = bulkTotal + bottledTotal;

  // Validation
  const isValid = data.date !== "" && (wineTotal > 0 || spiritsTotal > 0);

  const handleNext = () => {
    if (isValid) {
      onNext();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Step 1: TTB Starting Point</CardTitle>
            <CardDescription>
              Enter the balances from your last TTB Form 5120.17
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Guidance */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Enter your inventory balances from Part I of your last TTB Form 5120.17.
            This establishes your starting point for tracking in this system.
            Typically this is December 31 of the previous year.
          </AlertDescription>
        </Alert>

        {/* Opening Balance Date */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Opening Balance Date
            <span className="text-xs text-gray-500">
              (Last day of your previous reporting period)
            </span>
          </Label>
          <Input
            type="date"
            value={data.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            className="max-w-xs"
          />
          <p className="text-xs text-gray-500">
            Typically December 31 of the previous year (e.g., 2024-12-31 for 2025 reporting)
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
                    bulkValue={data.balances.bulk[key]}
                    bottledValue={data.balances.bottled[key]}
                    onBulkChange={(value) => updateBulkValue(key, value)}
                    onBottledChange={(value) => updateBottledValue(key, value)}
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
                  const value = data.balances.spirits[key];
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-sm">{SPIRITS_LABELS[key]}</Label>
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

        {/* Reconciliation Notes */}
        <div className="space-y-2">
          <Label>Reconciliation Notes (Optional)</Label>
          <Textarea
            placeholder="Any notes about how these balances were determined..."
            value={data.reconciliationNotes}
            onChange={(e) => onUpdate({ reconciliationNotes: e.target.value })}
            rows={3}
          />
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Opening Date:</span>{" "}
              <span className="font-medium">{data.date || "Not set"}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Wine/Cider:</span>{" "}
              <span className="font-medium">{wineTotal.toFixed(1)} gal</span>
            </div>
            {spiritsTotal > 0 && (
              <div>
                <span className="text-gray-600">Total Spirits:</span>{" "}
                <span className="font-medium">{spiritsTotal.toFixed(1)} proof gal</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-end border-t pt-6">
        <Button onClick={handleNext} disabled={!isValid}>
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
