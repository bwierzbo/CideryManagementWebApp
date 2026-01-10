"use client";

import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { Loader2, Info, CheckCircle2, AlertTriangle } from "lucide-react";

interface AddBatchMeasurementFormProps {
  batchId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type MeasurementMethod = "hydrometer" | "refractometer" | "calculated";

export function AddBatchMeasurementForm({
  batchId,
  onSuccess,
  onCancel,
}: AddBatchMeasurementFormProps) {
  // Initialize with current date and time in local timezone
  const now = new Date();
  const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16); // Format: YYYY-MM-DDTHH:mm

  const [measurementDateTime, setMeasurementDateTime] = useState(localISOTime);
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod>("hydrometer");

  // Date validation
  const { validateDate } = useBatchDateValidation(batchId);

  // Form fields
  const [rawReading, setRawReading] = useState("");
  const [originalGravity, setOriginalGravity] = useState("");
  const [isFreshJuice, setIsFreshJuice] = useState(false);
  const [abv, setAbv] = useState("");
  const [ph, setPh] = useState("");
  const [totalAcidity, setTotalAcidity] = useState("");
  const [temperature, setTemperature] = useState("10");
  const [notes, setNotes] = useState("");

  // Fetch active calibration status
  const { data: calibrationData } = trpc.calibration.getActive.useQuery();

  // Preview correction when we have the necessary inputs
  const canPreviewCorrection =
    !!rawReading &&
    !!temperature &&
    parseFloat(rawReading) > 0 &&
    parseFloat(temperature) >= -10;

  const { data: correctionPreview, isFetching: isLoadingPreview } =
    trpc.calibration.previewCorrection.useQuery(
      {
        instrumentType: measurementMethod === "calculated" ? "hydrometer" : measurementMethod,
        rawReading: parseFloat(rawReading) || 1,
        temperatureC: parseFloat(temperature) || 20,
        originalGravity: originalGravity ? parseFloat(originalGravity) : undefined,
        isFreshJuice,
      },
      {
        enabled: canPreviewCorrection && measurementMethod !== "calculated",
      }
    );

  const addMeasurement = trpc.batch.addMeasurement.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Measurement added successfully",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!measurementDateTime) {
      toast({
        title: "Error",
        description: "Please select a measurement date and time",
        variant: "destructive",
      });
      return;
    }

    // Use corrected SG if available, otherwise use raw reading
    const finalSG = correctionPreview?.correctedSG ?? (rawReading ? parseFloat(rawReading) : undefined);

    const measurementData: any = {
      batchId,
      measurementDate: new Date(measurementDateTime).toISOString(),
      measurementMethod,
    };

    // Set specific gravity - use corrected value
    if (finalSG) {
      measurementData.specificGravity = finalSG;
    }

    // Store raw reading and calibration info if we have corrections
    if (rawReading && correctionPreview) {
      measurementData.rawReading = parseFloat(rawReading);
      measurementData.correctionsApplied = correctionPreview.corrections;
      if (originalGravity) {
        measurementData.originalGravityAtMeasurement = parseFloat(originalGravity);
      }
    }

    if (abv) measurementData.abv = parseFloat(abv);
    if (ph) measurementData.ph = parseFloat(ph);
    if (totalAcidity) measurementData.totalAcidity = parseFloat(totalAcidity);
    if (temperature) measurementData.temperature = parseFloat(temperature);
    if (notes) measurementData.notes = notes;

    addMeasurement.mutate(measurementData);
  };

  const hasActiveCalibration = calibrationData?.calibration !== null;
  const showOGField = measurementMethod === "refractometer" && !isFreshJuice;
  const hasCorrectionApplied = correctionPreview && Object.keys(correctionPreview.corrections).length > 0;

  // Format the correction breakdown
  const formatCorrections = () => {
    if (!correctionPreview?.corrections) return null;
    const parts: string[] = [];
    const c = correctionPreview.corrections;
    if (c.temp !== undefined && c.temp !== 0) {
      parts.push(`temp: ${c.temp >= 0 ? "+" : ""}${c.temp.toFixed(4)}`);
    }
    if (c.baseline !== undefined && c.baseline !== 0) {
      parts.push(`baseline: ${c.baseline >= 0 ? "+" : ""}${c.baseline.toFixed(4)}`);
    }
    if (c.alcohol !== undefined && c.alcohol !== 0) {
      parts.push(`alcohol: ${c.alcohol >= 0 ? "+" : ""}${c.alcohol.toFixed(4)}`);
    }
    return parts.length > 0 ? parts.join(", ") : "none";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="measurementDateTime">Measurement Date & Time</Label>
          <Input
            id="measurementDateTime"
            type="datetime-local"
            value={measurementDateTime}
            onChange={(e) => {
              setMeasurementDateTime(e.target.value);
              const result = validateDate(e.target.value);
              setDateWarning(result.warning);
            }}
            className="w-full"
          />
          <DateWarning warning={dateWarning} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="measurementMethod">Measurement Method</Label>
          <Select
            value={measurementMethod}
            onValueChange={(value) => setMeasurementMethod(value as MeasurementMethod)}
          >
            <SelectTrigger id="measurementMethod">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hydrometer">Hydrometer</SelectItem>
              <SelectItem value="refractometer">Refractometer</SelectItem>
              <SelectItem value="calculated">Calculated</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {measurementMethod === "hydrometer"
              ? "Hydrometer readings are used for terminal gravity confirmation"
              : measurementMethod === "refractometer"
              ? "Refractometer readings will be corrected for alcohol if calibrated"
              : "Use for calculated/estimated values"}
          </p>
        </div>
      </div>

      {/* Calibration Status Banner */}
      {measurementMethod !== "calculated" && (
        <div className={`p-3 rounded-lg border text-sm ${
          hasActiveCalibration
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-yellow-50 border-yellow-200 text-yellow-800"
        }`}>
          <div className="flex items-center gap-2">
            {hasActiveCalibration ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Active calibration: <strong>{calibrationData?.calibration?.name}</strong>
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>
                  No calibration active.{" "}
                  {measurementMethod === "hydrometer"
                    ? "Temperature correction only."
                    : "Readings will not be corrected for alcohol."}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Raw Reading / Specific Gravity */}
        <div className="space-y-2">
          <Label htmlFor="rawReading">
            {measurementMethod === "calculated" ? "Specific Gravity" : "Raw Reading (SG)"}
          </Label>
          <Input
            id="rawReading"
            type="number"
            step="0.001"
            placeholder="1.050"
            value={rawReading}
            onChange={(e) => setRawReading(e.target.value)}
          />
          {measurementMethod !== "calculated" && (
            <p className="text-xs text-muted-foreground">
              Enter the reading directly from your {measurementMethod}
            </p>
          )}
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <Label htmlFor="temperature">Sample Temperature (C)</Label>
          <Input
            id="temperature"
            type="number"
            step="0.1"
            placeholder="10"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Temperature at time of measurement
          </p>
        </div>

        {/* Original Gravity - Only for refractometer when not fresh juice */}
        {showOGField && (
          <div className="space-y-2">
            <Label htmlFor="originalGravity">Original Gravity (for correction)</Label>
            <Input
              id="originalGravity"
              type="number"
              step="0.001"
              placeholder="1.048"
              value={originalGravity}
              onChange={(e) => setOriginalGravity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              OG of this batch, needed for alcohol correction
            </p>
          </div>
        )}

        {/* Fresh Juice checkbox for refractometer */}
        {measurementMethod === "refractometer" && (
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="isFreshJuice"
              checked={isFreshJuice}
              onChange={(e) => setIsFreshJuice(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="isFreshJuice" className="text-sm">
              Fresh juice (no alcohol yet)
            </Label>
          </div>
        )}
      </div>

      {/* Correction Preview */}
      {canPreviewCorrection && measurementMethod !== "calculated" && (
        <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              Correction Preview
            </h4>
            {isLoadingPreview && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
          {correctionPreview && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Raw reading:</span>{" "}
                <span className="font-mono">{parseFloat(rawReading).toFixed(4)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Corrected SG:</span>{" "}
                <span className="font-mono font-medium">
                  {correctionPreview.correctedSG.toFixed(4)}
                </span>
                {hasCorrectionApplied && (
                  <Badge variant="secondary" className="ml-2 text-xs">Corrected</Badge>
                )}
              </div>
              {hasCorrectionApplied && (
                <div className="col-span-2 text-xs text-muted-foreground">
                  Corrections: {formatCorrections()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="abv">ABV (%)</Label>
          <Input
            id="abv"
            type="number"
            step="0.1"
            placeholder="6.5"
            value={abv}
            onChange={(e) => setAbv(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ph">pH</Label>
          <Input
            id="ph"
            type="number"
            step="0.01"
            placeholder="3.50"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalAcidity">Total Acidity (g/L)</Label>
          <Input
            id="totalAcidity"
            type="number"
            step="0.1"
            placeholder="6.5"
            value={totalAcidity}
            onChange={(e) => setTotalAcidity(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any observations or comments..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px]"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={addMeasurement.isPending}>
          {addMeasurement.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add Measurement
        </Button>
      </div>
    </form>
  );
}
