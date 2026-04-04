"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { AdditiveCalculatorPanel } from "./AdditiveCalculatorPanel";
import {
  calculateSO2Addition,
  validateSO2Input,
  formatSO2Notes,
  getMolecularSO2Status,
  calculateMolecularSO2,
  KMS_SO2_EFFICIENCY,
  type SO2CalculationInput,
} from "lib/src/calculations/so2";

interface SO2Addition {
  additiveName: string;
  amount: number;
  unit: string;
  addedAt: string;
  notes: string | null;
}

interface SO2CalculatorProps {
  batchVolumeLiters: number | null;
  batchPH: number | null;
  previousAdditions: SO2Addition[];
  onUseCalculatedAmount: (grams: number, unit: string, notes: string) => void;
}

/** Convert a recorded sulfite addition to estimated ppm SO2 added */
function estimateSO2PpmFromAddition(
  addition: SO2Addition,
  volumeLiters: number,
): number {
  if (volumeLiters <= 0) return 0;
  let grams = addition.amount;
  const u = addition.unit.toLowerCase();
  // Convert to grams
  if (u === "kg") grams *= 1000;
  else if (u === "lbs" || u === "lb") grams *= 453.592;
  else if (u === "mg" || u === "mg/l") grams /= 1000;
  else if (u !== "g") return 0; // can't convert non-weight units

  // KMS grams -> SO2 ppm: ppm = (grams * 1000 * efficiency) / volumeL
  return (grams * 1000 * KMS_SO2_EFFICIENCY) / volumeLiters;
}

export function SO2Calculator({
  batchVolumeLiters,
  batchPH,
  previousAdditions,
  onUseCalculatedAmount,
}: SO2CalculatorProps) {
  const [targetFreeSO2, setTargetFreeSO2] = useState("30");
  const [currentFreeSO2, setCurrentFreeSO2] = useState("0");
  const [pH, setPH] = useState(batchPH?.toFixed(2) ?? "3.60");

  // Running totals from previous sulfite additions
  const runningTotals = useMemo(() => {
    if (!previousAdditions.length || !batchVolumeLiters) {
      return null;
    }
    let totalKMSGrams = 0;
    let totalSO2Ppm = 0;
    for (const add of previousAdditions) {
      let grams = add.amount;
      const u = add.unit.toLowerCase();
      if (u === "kg") grams *= 1000;
      else if (u === "lbs" || u === "lb") grams *= 453.592;
      else if (u !== "g") continue;
      totalKMSGrams += grams;
      totalSO2Ppm += estimateSO2PpmFromAddition(add, batchVolumeLiters);
    }
    const parsedPH = parseFloat(pH);
    const molecularSO2 = !isNaN(parsedPH)
      ? calculateMolecularSO2(totalSO2Ppm, parsedPH)
      : null;
    return {
      totalKMSGrams,
      totalSO2Ppm,
      molecularSO2,
      additionCount: previousAdditions.length,
    };
  }, [previousAdditions, batchVolumeLiters, pH]);

  const input: SO2CalculationInput | null = useMemo(() => {
    const target = parseFloat(targetFreeSO2);
    const current = parseFloat(currentFreeSO2);
    const parsedPH = parseFloat(pH);
    if (isNaN(target) || isNaN(current) || isNaN(parsedPH) || !batchVolumeLiters) {
      return null;
    }
    return {
      targetFreeSO2Ppm: target,
      currentFreeSO2Ppm: current,
      pH: parsedPH,
      volumeLiters: batchVolumeLiters,
    };
  }, [targetFreeSO2, currentFreeSO2, pH, batchVolumeLiters]);

  const validation = useMemo(() => {
    if (!input) return null;
    return validateSO2Input(input);
  }, [input]);

  const result = useMemo(() => {
    if (!input || !validation?.valid) return null;
    return calculateSO2Addition(input);
  }, [input, validation]);

  const molecularStatus = useMemo(() => {
    if (!result) return null;
    return getMolecularSO2Status(result.molecularSO2Ppm);
  }, [result]);

  const handleUseCalculation = () => {
    if (!result || !input) return;
    const notes = formatSO2Notes(input, result);
    onUseCalculatedAmount(
      parseFloat(result.kmsGrams.toFixed(2)),
      "g",
      notes,
    );
  };

  const statusColors: Record<string, string> = {
    low: "bg-amber-100 text-amber-800 border-amber-300",
    optimal: "bg-green-100 text-green-800 border-green-300",
    high: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <AdditiveCalculatorPanel
      title="SO2 Calculator"
      icon={<FlaskConical className="h-4 w-4 text-blue-600" />}
    >
      <div className="space-y-3">
        {/* Running totals from previous additions */}
        {runningTotals && (
          <div className="bg-violet-50 border border-violet-200 rounded-md p-3 space-y-1">
            <div className="text-xs font-medium text-violet-700 uppercase tracking-wider">
              SO2 History ({runningTotals.additionCount} addition{runningTotals.additionCount !== 1 ? "s" : ""})
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
              <span className="text-violet-600">Total KMS added:</span>
              <span className="font-medium">{runningTotals.totalKMSGrams.toFixed(1)} g</span>

              <span className="text-violet-600">Total SO2 added:</span>
              <span className="font-medium">{runningTotals.totalSO2Ppm.toFixed(1)} ppm</span>

              {runningTotals.molecularSO2 !== null && (
                <>
                  <span className="text-violet-600">Est. molecular SO2:</span>
                  <span className="font-medium">{runningTotals.molecularSO2.toFixed(2)} ppm</span>
                </>
              )}
            </div>
            <div className="text-xs text-violet-500 mt-1">
              Note: Actual free SO2 decreases over time. Use a test kit for current levels.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="targetFreeSO2" className="text-xs">
              Target Free SO2 (ppm)
            </Label>
            <Input
              id="targetFreeSO2"
              type="number"
              step="1"
              min="0"
              max="200"
              value={targetFreeSO2}
              onChange={(e) => setTargetFreeSO2(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currentFreeSO2" className="text-xs">
              Current Free SO2 (ppm)
            </Label>
            <Input
              id="currentFreeSO2"
              type="number"
              step="1"
              min="0"
              max="200"
              value={currentFreeSO2}
              onChange={(e) => setCurrentFreeSO2(e.target.value)}
              className="h-8"
              placeholder="0 if unknown"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="so2pH" className="text-xs">
              Batch pH
            </Label>
            <Input
              id="so2pH"
              type="number"
              step="0.01"
              min="2.8"
              max="4.5"
              value={pH}
              onChange={(e) => setPH(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Batch Volume</Label>
            <div className="h-8 flex items-center text-sm text-muted-foreground px-3 bg-muted rounded-md">
              {batchVolumeLiters
                ? `${batchVolumeLiters.toLocaleString()} L`
                : "No volume data"}
            </div>
          </div>
        </div>

        {/* Validation errors */}
        {validation && !validation.valid && (
          <div className="text-xs text-red-600 space-y-0.5">
            {validation.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white border rounded-md p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Results
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">KMS to add:</span>
              <span className="font-semibold">{result.kmsGrams.toFixed(2)} g</span>

              <span className="text-muted-foreground">SO2 being added:</span>
              <span>{result.so2PpmAdded} ppm</span>

              <span className="text-muted-foreground">Molecular SO2:</span>
              <span>{result.molecularSO2Ppm.toFixed(2)} ppm</span>

              <span className="text-muted-foreground">Status:</span>
              <span>
                {molecularStatus && (
                  <Badge
                    variant="outline"
                    className={statusColors[molecularStatus.status]}
                  >
                    {molecularStatus.status === "optimal" ? "●" : "○"}{" "}
                    {molecularStatus.status.charAt(0).toUpperCase() +
                      molecularStatus.status.slice(1)}
                  </Badge>
                )}
              </span>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full mt-2"
              onClick={handleUseCalculation}
            >
              Use Calculated Amount
            </Button>
          </div>
        )}

        {!batchVolumeLiters && (
          <div className="text-xs text-muted-foreground italic">
            Add a measurement with volume to enable SO2 calculations.
          </div>
        )}
      </div>
    </AdditiveCalculatorPanel>
  );
}
