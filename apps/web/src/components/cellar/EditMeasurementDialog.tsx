"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Measurement {
  id: string;
  measurementDate: Date | string;
  specificGravity?: string | null;
  abv?: string | null;
  ph?: string | null;
  totalAcidity?: string | null;
  temperature?: string | null;
  volume?: string | null;
  volumeUnit?: string;
  notes?: string | null;
  takenBy?: string | null;
}

interface EditMeasurementDialogProps {
  measurement: Measurement | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMeasurementDialog({
  measurement,
  open,
  onClose,
  onSuccess,
}: EditMeasurementDialogProps) {
  const { toast } = useToast();
  const [measurementDateTime, setMeasurementDateTime] = useState("");
  const [specificGravity, setSpecificGravity] = useState("");
  const [abv, setAbv] = useState("");
  const [ph, setPh] = useState("");
  const [totalAcidity, setTotalAcidity] = useState("");
  const [temperature, setTemperature] = useState("");
  const [volume, setVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState("L");
  const [notes, setNotes] = useState("");
  const [takenBy, setTakenBy] = useState("");

  useEffect(() => {
    if (measurement && open) {
      // Convert date to local datetime-local format
      const date = new Date(measurement.measurementDate);
      const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setMeasurementDateTime(localISOTime);
      setSpecificGravity(measurement.specificGravity || "");
      setAbv(measurement.abv || "");
      setPh(measurement.ph || "");
      setTotalAcidity(measurement.totalAcidity || "");
      setTemperature(measurement.temperature || "");
      setVolume(measurement.volume || "");
      setVolumeUnit(measurement.volumeUnit || "L");
      setNotes(measurement.notes || "");
      setTakenBy(measurement.takenBy || "");
    }
  }, [measurement, open]);

  const updateMeasurement = trpc.batch.updateMeasurement.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Measurement updated successfully",
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update measurement",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!measurement || !measurementDateTime) {
      toast({
        title: "Error",
        description: "Please select a measurement date and time",
        variant: "destructive",
      });
      return;
    }

    const updateData: any = {
      measurementId: measurement.id,
      measurementDate: new Date(measurementDateTime).toISOString(),
    };

    if (specificGravity) updateData.specificGravity = parseFloat(specificGravity);
    if (abv) updateData.abv = parseFloat(abv);
    if (ph) updateData.ph = parseFloat(ph);
    if (totalAcidity) updateData.totalAcidity = parseFloat(totalAcidity);
    if (temperature) updateData.temperature = parseFloat(temperature);
    if (volume) updateData.volume = parseFloat(volume);
    if (volumeUnit) updateData.volumeUnit = volumeUnit;
    if (notes !== undefined) updateData.notes = notes;
    if (takenBy !== undefined) updateData.takenBy = takenBy;

    updateMeasurement.mutate(updateData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Measurement</DialogTitle>
          <DialogDescription>
            Update measurement details for this batch
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="measurementDateTime">Measurement Date & Time</Label>
              <Input
                id="measurementDateTime"
                type="datetime-local"
                value={measurementDateTime}
                onChange={(e) => setMeasurementDateTime(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="specificGravity">Specific Gravity</Label>
              <Input
                id="specificGravity"
                type="number"
                step="0.001"
                min="0.99"
                max="1.2"
                value={specificGravity}
                onChange={(e) => setSpecificGravity(e.target.value)}
                placeholder="e.g., 1.050"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abv">ABV (%)</Label>
              <Input
                id="abv"
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={abv}
                onChange={(e) => setAbv(e.target.value)}
                placeholder="e.g., 6.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph">pH</Label>
              <Input
                id="ph"
                type="number"
                step="0.01"
                min="2"
                max="5"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                placeholder="e.g., 3.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAcidity">Total Acidity (g/L)</Label>
              <Input
                id="totalAcidity"
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={totalAcidity}
                onChange={(e) => setTotalAcidity(e.target.value)}
                placeholder="e.g., 6.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature (°C)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                max="40"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="e.g., 18.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="volume">Volume</Label>
              <div className="flex gap-2">
                <Input
                  id="volume"
                  type="number"
                  step="0.1"
                  min="0"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="e.g., 100"
                  className="flex-1"
                />
                <select
                  value={volumeUnit}
                  onChange={(e) => setVolumeUnit(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="L">L</option>
                  <option value="gal">gal</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="takenBy">Taken By</Label>
            <Input
              id="takenBy"
              value={takenBy}
              onChange={(e) => setTakenBy(e.target.value)}
              placeholder="Name of person who took the measurement"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this measurement"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateMeasurement.isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMeasurement.isLoading}>
              {updateMeasurement.isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
