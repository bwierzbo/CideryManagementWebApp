"use client";

import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  Step1Data,
  Step2Data,
  Step4Data,
  LegacyBatchInput,
  TAX_CLASS_OPTIONS,
} from "./types";

interface Step3Props {
  step1Data: Step1Data;
  step2Data: Step2Data;
  data: Step4Data;
  onAddBatch: (batch: LegacyBatchInput) => void;
  onRemoveBatch: (index: number) => void;
  onUpdate: (data: Partial<Step4Data>) => void;
  onNext: () => void;
  onBack: () => void;
}

const initialBatchForm: Omit<LegacyBatchInput, "productType"> = {
  name: "",
  volumeGallons: 0,
  taxClass: "hardCider",
  notes: "",
};

export function Step3ResolveGaps({
  step1Data,
  step2Data,
  data,
  onAddBatch,
  onRemoveBatch,
  onUpdate,
  onNext,
  onBack,
}: Step3Props) {
  const [batchForm, setBatchForm] = useState(initialBatchForm);
  const [showForm, setShowForm] = useState(false);

  // Calculate remaining unreconciled amount
  const totalLegacyVolume = data.legacyBatches.reduce(
    (sum, batch) => sum + batch.volumeGallons,
    0
  );
  const remainingGap = step2Data.difference - totalLegacyVolume;
  const isResolved = Math.abs(remainingGap) < 0.5;

  // Get tax classes with gaps
  const taxClassesWithGaps = step2Data.byTaxClass.filter(
    (tc) => tc.difference > 0.5
  );

  const handleAddBatch = () => {
    if (!batchForm.name.trim()) {
      return;
    }
    if (batchForm.volumeGallons <= 0) {
      return;
    }

    const selectedTaxClass = TAX_CLASS_OPTIONS.find(
      (tc) => tc.value === batchForm.taxClass
    );

    onAddBatch({
      name: batchForm.name.trim(),
      volumeGallons: batchForm.volumeGallons,
      taxClass: batchForm.taxClass,
      productType: selectedTaxClass?.productType || "cider",
      notes: batchForm.notes.trim(),
    });

    setBatchForm(initialBatchForm);
    setShowForm(false);
  };

  // Auto-suggest name based on tax class
  const handleTaxClassChange = (value: string) => {
    const taxClass = TAX_CLASS_OPTIONS.find((tc) => tc.value === value);
    const year = step1Data.date ? step1Data.date.split("-")[0] : new Date().getFullYear();
    const suggestedName = `Legacy Inventory - ${taxClass?.label || value} ${year}`;

    setBatchForm((prev) => ({
      ...prev,
      taxClass: value,
      name: prev.name || suggestedName,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Step 3: Resolve Gaps</CardTitle>
            <CardDescription>
              Add legacy batches or explain discrepancies
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status */}
        <div
          className={`p-4 rounded-lg border ${
            isResolved
              ? "bg-green-50 border-green-200"
              : step2Data.difference > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {isResolved ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : step2Data.difference > 0 ? (
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            ) : (
              <Info className="w-6 h-6 text-blue-600" />
            )}
            <div>
              <p
                className={`font-medium ${
                  isResolved
                    ? "text-green-800"
                    : step2Data.difference > 0
                    ? "text-amber-800"
                    : "text-blue-800"
                }`}
              >
                {isResolved
                  ? "Gap Resolved"
                  : step2Data.difference > 0
                  ? `${remainingGap.toFixed(1)} gallons still unaccounted for`
                  : "No gap to resolve"}
              </p>
              <p
                className={`text-sm ${
                  isResolved
                    ? "text-green-600"
                    : step2Data.difference > 0
                    ? "text-amber-600"
                    : "text-blue-600"
                }`}
              >
                {isResolved
                  ? "Legacy batches account for the TTB vs system difference"
                  : step2Data.difference > 0
                  ? `Original gap: ${step2Data.difference.toFixed(1)} gal | Legacy batches: ${totalLegacyVolume.toFixed(1)} gal`
                  : "System inventory matches or exceeds TTB balance"}
              </p>
            </div>
          </div>
        </div>

        {/* Tax classes with gaps */}
        {taxClassesWithGaps.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Tax classes with gaps:</strong>{" "}
              {taxClassesWithGaps.map((tc) => (
                <Badge key={tc.taxClass} variant="outline" className="mx-1">
                  {tc.label}: +{tc.difference.toFixed(1)} gal
                </Badge>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Existing Legacy Batches */}
        {data.legacyBatches.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Legacy Batches to Create</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Tax Class
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Volume
                    </th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.legacyBatches.map((batch, index) => {
                    const taxClass = TAX_CLASS_OPTIONS.find(
                      (tc) => tc.value === batch.taxClass
                    );
                    return (
                      <tr key={index} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <span className="font-medium">{batch.name}</span>
                          {batch.notes && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {batch.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {taxClass?.label || batch.taxClass}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {batch.volumeGallons.toFixed(1)} gal
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveBatch(index)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 font-medium text-gray-700">
                      Total Legacy Volume
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {totalLegacyVolume.toFixed(1)} gal
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Add Legacy Batch Form */}
        {showForm ? (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
            <h4 className="font-medium text-gray-900">Add Legacy Batch</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  placeholder="e.g., Legacy Inventory - Hard Cider 2024"
                  value={batchForm.name}
                  onChange={(e) =>
                    setBatchForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Tax Class</Label>
                <Select
                  value={batchForm.taxClass}
                  onValueChange={handleTaxClassChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tax class" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_CLASS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Volume (Gallons)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  value={batchForm.volumeGallons || ""}
                  onChange={(e) =>
                    setBatchForm((prev) => ({
                      ...prev,
                      volumeGallons: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Additional context..."
                  value={batchForm.notes}
                  onChange={(e) =>
                    setBatchForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setBatchForm(initialBatchForm);
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddBatch}
                disabled={!batchForm.name.trim() || batchForm.volumeGallons <= 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Batch
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowForm(true)}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Legacy Batch
          </Button>
        )}

        {/* Discrepancy Notes */}
        <div className="space-y-2">
          <Label>Discrepancy Notes (Optional)</Label>
          <Textarea
            placeholder="Explain any remaining discrepancies that cannot be resolved with legacy batches..."
            value={data.discrepancyNotes}
            onChange={(e) => onUpdate({ discrepancyNotes: e.target.value })}
            rows={3}
          />
          <p className="text-xs text-gray-500">
            Use this to document any differences you cannot account for. These
            notes will be saved with your reconciliation record for audit purposes.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Continue to Review
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
