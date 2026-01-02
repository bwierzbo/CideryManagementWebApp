"use client";

import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
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
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { Loader2 } from "lucide-react";

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
  const [specificGravity, setSpecificGravity] = useState("");
  const [abv, setAbv] = useState("");
  const [ph, setPh] = useState("");
  const [totalAcidity, setTotalAcidity] = useState("");
  const [temperature, setTemperature] = useState("20");
  const [notes, setNotes] = useState("");

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

    const measurementData: any = {
      batchId,
      measurementDate: new Date(measurementDateTime).toISOString(),
      measurementMethod,
    };

    if (specificGravity)
      measurementData.specificGravity = parseFloat(specificGravity);
    if (abv) measurementData.abv = parseFloat(abv);
    if (ph) measurementData.ph = parseFloat(ph);
    if (totalAcidity) measurementData.totalAcidity = parseFloat(totalAcidity);
    if (temperature) measurementData.temperature = parseFloat(temperature);
    if (notes) measurementData.notes = notes;

    addMeasurement.mutate(measurementData);
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
            Hydrometer readings are used for terminal gravity confirmation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="specificGravity">Specific Gravity</Label>
          <Input
            id="specificGravity"
            type="number"
            step="0.001"
            placeholder="1.050"
            value={specificGravity}
            onChange={(e) => setSpecificGravity(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abv">
            ABV (%)
          </Label>
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

        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature (°C)</Label>
          <Input
            id="temperature"
            type="number"
            step="0.1"
            placeholder="20.0"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
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
          className="min-h-[100px]"
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
