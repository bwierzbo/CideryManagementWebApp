"use client";

import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import {
  calculateCO2Volumes,
  calculateRequiredPressure,
} from "lib/src/utils/carbonation-calculations";
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
import { LastActivityHint } from "@/components/ui/LastActivityHint";
import { Loader2, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { useDateFormat } from "@/hooks/useDateFormat";

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
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();

  const localISOTime = formatDateTimeForInput(new Date());

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
  const [dissolvedCo2, setDissolvedCo2] = useState("");
  // How the operator enters CO₂: head pressure (psi) or dissolved volumes.
  // Default psi — that's what the gauge reads during force-carbonation. Stored
  // canonically as volumes (converted via Henry's Law at the sample temp).
  const [co2Unit, setCo2Unit] = useState<"psi" | "vol">("psi");
  const [temperature, setTemperature] = useState("10");
  // Temperature entry unit; stored canonically in °C. Cellar temps vary widely,
  // so the operator can enter in either scale.
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [notes, setNotes] = useState("");
  const [sensoryNotes, setSensoryNotes] = useState("");
  const [volume, setVolume] = useState("");

  // Fetch batch details to get product type
  const { data: batchData } = trpc.batch.get.useQuery({ batchId });
  // Most recent prior measurement — used as greyed placeholders so the operator
  // can spot a drastic change from last time.
  const { data: history } = trpc.batch.getHistory.useQuery({ batchId });
  const last = history?.measurements?.[0];
  const productType = batchData?.productType ?? "cider";

  // Determine which fields to show based on product type
  // Cider/Perry/Juice: SG-focused (traditional fermentation tracking)
  // Brandy: ABV-focused (spirits - no SG tracking)
  // Pommeau: Sensory/volume-focused (aging - no active fermentation)
  const showSgFields = ["cider", "perry", "juice", "wine", "cyser"].includes(productType);
  const showAbvField = true; // Always show ABV as it can be useful
  const showSensoryFields = true; // Always show — every batch can have sensory observations
  const showVolumeField = ["brandy", "pommeau"].includes(productType);

  // Fetch active calibration status
  const { data: calibrationData } = trpc.calibration.getActive.useQuery();

  // Sample temperature normalized to °C — the canonical unit for storage, SG
  // correction, and the Henry's-Law CO₂ conversion — regardless of entry unit.
  const tempNum = parseFloat(temperature);
  const tempC =
    temperature !== "" && !isNaN(tempNum)
      ? tempUnit === "F"
        ? (tempNum - 32) * (5 / 9)
        : tempNum
      : null;

  // Preview correction when we have the necessary inputs
  const canPreviewCorrection =
    !!rawReading &&
    tempC !== null &&
    parseFloat(rawReading) > 0 &&
    tempC >= -10;

  // Greyed placeholders = the LAST recorded value for each field, so a drastic
  // change from the previous measurement is visible while entering.
  const lastCo2Vol =
    last?.dissolvedCo2 != null ? parseFloat(String(last.dissolvedCo2)) : null;
  const sgPlaceholder =
    last?.specificGravity != null ? last.specificGravity.toFixed(3) : "1.050";
  const abvPlaceholder = last?.abv != null ? last.abv.toFixed(1) : "6.5";
  const phPlaceholder = last?.ph != null ? last.ph.toFixed(2) : "3.50";
  const taPlaceholder =
    last?.totalAcidity != null ? last.totalAcidity.toFixed(1) : "6.5";
  const volPlaceholder = last?.volume != null ? last.volume.toFixed(1) : "120";
  const tempPlaceholder =
    last?.temperature != null
      ? (tempUnit === "F" ? (last.temperature * 9) / 5 + 32 : last.temperature).toFixed(1)
      : tempUnit === "F"
        ? "50"
        : "10";
  const co2Placeholder =
    lastCo2Vol != null
      ? co2Unit === "psi"
        ? calculateRequiredPressure(lastCo2Vol, tempC ?? 20).toFixed(0)
        : lastCo2Vol.toFixed(2)
      : co2Unit === "psi"
        ? "12"
        : "2.5";

  const { data: correctionPreview, isFetching: isLoadingPreview } =
    trpc.calibration.previewCorrection.useQuery(
      {
        instrumentType: measurementMethod === "calculated" ? "hydrometer" : measurementMethod,
        rawReading: parseFloat(rawReading) || 1,
        temperatureC: tempC ?? 20,
        originalGravity: originalGravity ? parseFloat(originalGravity) : undefined,
        isFreshJuice,
      },
      {
        enabled: canPreviewCorrection && measurementMethod !== "calculated",
      }
    );

  // Map Zod field paths to friendly field names
  const fieldLabels: Record<string, string> = {
    specificGravity: "Specific Gravity",
    abv: "ABV",
    ph: "pH",
    totalAcidity: "Total Acidity",
    temperature: "Temperature",
    volume: "Volume",
    measurementDate: "Measurement Date",
  };

  const parseValidationError = (errorMessage: string): string => {
    try {
      const issues = JSON.parse(errorMessage);
      if (Array.isArray(issues)) {
        return issues
          .map((issue: { path?: string[]; message?: string }) => {
            const field = issue.path?.[0];
            const label = field ? fieldLabels[field] || field : "Input";
            return `${label}: ${issue.message}`;
          })
          .join("\n");
      }
    } catch {
      // Not a JSON Zod error — return as-is
    }
    return errorMessage;
  };

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
        title: "Measurement not saved",
        description: parseValidationError(error.message),
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

    // Send RAW reading to API - API handles temperature correction
    // The preview is for display only, not for submission
    const measurementData: any = {
      batchId,
      measurementDate: parseDateTimeFromInput(measurementDateTime).toISOString(),
      measurementMethod,
    };

    // Send raw reading as specificGravity - API will apply correction
    if (rawReading) {
      measurementData.specificGravity = parseFloat(rawReading);
    }

    if (abv) measurementData.abv = parseFloat(abv);
    if (ph) measurementData.ph = parseFloat(ph);
    if (totalAcidity) measurementData.totalAcidity = parseFloat(totalAcidity);
    if (dissolvedCo2) {
      const co2Raw = parseFloat(dissolvedCo2);
      // Store canonical dissolved CO₂ in volumes. If entered as head pressure
      // (psi), convert via Henry's Law at the sample temperature (°C).
      measurementData.dissolvedCo2 =
        co2Unit === "psi" ? calculateCO2Volumes(co2Raw, tempC ?? 20) : co2Raw;
    }
    if (tempC !== null) measurementData.temperature = tempC;
    if (notes) measurementData.notes = notes;
    if (sensoryNotes) measurementData.sensoryNotes = sensoryNotes;
    if (volume) measurementData.volume = parseFloat(volume);

    addMeasurement.mutate(measurementData);
  };

  // Prevent Enter key from submitting the form in input fields.
  // Enter accepts the value (stays in field), Tab moves to next field,
  // only the "Add Measurement" button submits.
  const preventEnterSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
    }
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
    <form onSubmit={handleSubmit} onKeyDown={preventEnterSubmit} className="space-y-4">
      {/* Date/Time - always visible */}
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
        <LastActivityHint batchId={batchId} date={measurementDateTime} />
      </div>

      {/* Calibration Status Banner - only for SG-focused products */}
      {showSgFields && measurementMethod !== "calculated" && (
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

      {/* SG Fields - only for cider/perry/juice */}
      {showSgFields && (
        <div className="grid grid-cols-2 gap-4">
          {/* Raw Reading / Specific Gravity — instrument inline, only relevant here */}
          <div className="space-y-2">
            <Label htmlFor="rawReading">
              {measurementMethod === "calculated" ? "Specific Gravity" : "Raw Reading (SG)"}
            </Label>
            <div className="flex gap-2">
              <Select
                value={measurementMethod}
                onValueChange={(value) =>
                  setMeasurementMethod(value as MeasurementMethod)
                }
              >
                <SelectTrigger
                  id="measurementMethod"
                  aria-label="Instrument"
                  className="w-36 shrink-0"
                >
                  <SelectValue placeholder="Instrument" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hydrometer">Hydrometer</SelectItem>
                  <SelectItem value="refractometer">Refractometer</SelectItem>
                  <SelectItem value="calculated">Calculated</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="rawReading"
                type="number"
                step="0.001"
                placeholder={sgPlaceholder}
                value={rawReading}
                onChange={(e) => setRawReading(e.target.value)}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {measurementMethod !== "calculated"
                ? `Reading from your ${measurementMethod}. `
                : ""}
              Range: 0.980–1.200
            </p>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">Sample Temperature (°{tempUnit})</Label>
              <div className="inline-flex overflow-hidden rounded-md border text-xs">
                <button
                  type="button"
                  onClick={() => {
                    // Convert the entered value so the physical temp is unchanged.
                    if (tempUnit === "F" && !isNaN(tempNum)) {
                      setTemperature(
                        String(Math.round(((tempNum - 32) * 5) / 9 * 10) / 10),
                      );
                    }
                    setTempUnit("C");
                  }}
                  className={
                    tempUnit === "C"
                      ? "bg-primary px-2 py-0.5 text-primary-foreground"
                      : "bg-background px-2 py-0.5"
                  }
                >
                  °C
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tempUnit === "C" && !isNaN(tempNum)) {
                      setTemperature(
                        String(Math.round(((tempNum * 9) / 5 + 32) * 10) / 10),
                      );
                    }
                    setTempUnit("F");
                  }}
                  className={
                    tempUnit === "F"
                      ? "bg-primary px-2 py-0.5 text-primary-foreground"
                      : "bg-background px-2 py-0.5"
                  }
                >
                  °F
                </button>
              </div>
            </div>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              placeholder={tempPlaceholder}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Temperature at time of measurement.
              {tempC !== null && tempUnit === "F" && ` ≈ ${tempC.toFixed(1)}°C`}
              {" "}Range: {tempUnit === "F" ? "14–104°F" : "-10–40°C"}
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
      )}

      {/* Correction Preview - only for SG-focused products */}
      {showSgFields && canPreviewCorrection && measurementMethod !== "calculated" && (
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

      {/* Volume - for brandy/pommeau (angel's share tracking) */}
      {showVolumeField && (
        <div className="space-y-2">
          <Label htmlFor="volume">Current Volume (L)</Label>
          <Input
            id="volume"
            type="number"
            step="0.1"
            placeholder={volPlaceholder}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Track volume changes (angel&apos;s share) over time
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="abv">ABV (%)</Label>
          <Input
            id="abv"
            type="number"
            step="0.1"
            placeholder={abvPlaceholder}
            value={abv}
            onChange={(e) => setAbv(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Range: 0–25%</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ph">pH</Label>
          <Input
            id="ph"
            type="number"
            step="0.01"
            placeholder={phPlaceholder}
            value={ph}
            onChange={(e) => setPh(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Range: 2.00–5.00</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalAcidity">Total Acidity (g/L)</Label>
          <Input
            id="totalAcidity"
            type="number"
            step="0.1"
            placeholder={taPlaceholder}
            value={totalAcidity}
            onChange={(e) => setTotalAcidity(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Range: 0–20 g/L</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="dissolvedCo2">
              CO₂ ({co2Unit === "psi" ? "psi" : "volumes"})
            </Label>
            <div className="inline-flex overflow-hidden rounded-md border text-xs">
              <button
                type="button"
                onClick={() => setCo2Unit("psi")}
                className={
                  co2Unit === "psi"
                    ? "bg-primary px-2 py-0.5 text-primary-foreground"
                    : "bg-background px-2 py-0.5"
                }
              >
                psi
              </button>
              <button
                type="button"
                onClick={() => setCo2Unit("vol")}
                className={
                  co2Unit === "vol"
                    ? "bg-primary px-2 py-0.5 text-primary-foreground"
                    : "bg-background px-2 py-0.5"
                }
              >
                vol
              </button>
            </div>
          </div>
          <Input
            id="dissolvedCo2"
            type="number"
            step="0.1"
            placeholder={co2Placeholder}
            value={dissolvedCo2}
            onChange={(e) => setDissolvedCo2(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {co2Unit === "psi" ? (
              <>
                Head pressure in psi at {temperature || "?"}°{tempUnit}
                {dissolvedCo2 &&
                  !isNaN(parseFloat(dissolvedCo2)) &&
                  ` · ≈ ${calculateCO2Volumes(
                    parseFloat(dissolvedCo2),
                    tempC ?? 20,
                  ).toFixed(2)} vol dissolved (stored)`}
              </>
            ) : (
              "Dissolved CO₂ in volumes, e.g. 2.5 vol"
            )}
          </p>
        </div>
      </div>

      {/* Sensory Notes - after all measurements, above general Notes */}
      {showSensoryFields && (
        <div className="space-y-2">
          <Label htmlFor="sensoryNotes">Sensory Notes</Label>
          <Textarea
            id="sensoryNotes"
            placeholder="Describe appearance, aroma, taste, finish..."
            value={sensoryNotes}
            onChange={(e) => setSensoryNotes(e.target.value)}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Record tasting observations for aging products
          </p>
        </div>
      )}

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
