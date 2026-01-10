"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Calculator,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";

interface CalibrationSessionDialogProps {
  calibrationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalibrationUpdated: () => void;
}

export function CalibrationSessionDialog({
  calibrationId,
  open,
  onOpenChange,
  onCalibrationUpdated,
}: CalibrationSessionDialogProps) {
  const { toast } = useToast();
  const [isAddingReading, setIsAddingReading] = useState(false);
  const [newReading, setNewReading] = useState({
    originalGravity: "",
    refractometerReading: "",
    hydrometerReading: "",
    temperatureC: "10",
    isFreshJuice: false,
  });

  // Query calibration data
  const { data, refetch, isLoading } = trpc.calibration.getById.useQuery(
    { id: calibrationId },
    { enabled: open }
  );

  // Mutations
  const addReadingMutation = trpc.calibration.addReading.useMutation({
    onSuccess: () => {
      toast({ title: "Reading Added" });
      setNewReading({
        originalGravity: "",
        refractometerReading: "",
        hydrometerReading: "",
        temperatureC: "10",
        isFreshJuice: false,
      });
      setIsAddingReading(false);
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteReadingMutation = trpc.calibration.deleteReading.useMutation({
    onSuccess: () => {
      toast({ title: "Reading Deleted" });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const calculateMutation = trpc.calibration.calculate.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Calibration Calculated",
        description: `R = ${data.result.rSquared.toFixed(4)}, Avg Error: ${data.result.avgError.toFixed(4)}`,
      });
      refetch();
      onCalibrationUpdated();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddReading = () => {
    const og = parseFloat(newReading.originalGravity);
    const refrac = parseFloat(newReading.refractometerReading);
    const hydro = parseFloat(newReading.hydrometerReading);
    const temp = parseFloat(newReading.temperatureC);

    if (isNaN(og) || isNaN(refrac) || isNaN(hydro) || isNaN(temp)) {
      toast({ title: "Error", description: "Please fill in all fields with valid numbers", variant: "destructive" });
      return;
    }

    addReadingMutation.mutate({
      calibrationId,
      originalGravity: og,
      refractometerReading: refrac,
      hydrometerReading: hydro,
      temperatureC: temp,
      isFreshJuice: newReading.isFreshJuice,
    });
  };

  const handleDeleteReading = (id: string) => {
    deleteReadingMutation.mutate({ id });
  };

  const handleCalculate = () => {
    calculateMutation.mutate({ calibrationId });
  };

  const calibration = data?.calibration;
  const readings = data?.readings ?? [];
  const coefficients = calibration?.linearCoefficients as { a: number; b: number; c: number } | null;
  const canCalculate = readings.length >= 3;

  const formatSG = (value: string | null) => {
    if (!value) return "—";
    return parseFloat(value).toFixed(4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {calibration?.name ?? "Calibration Session"}
            {calibration?.isActive && (
              <Badge variant="default" className="bg-green-600">Active</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Add paired refractometer and hydrometer readings to build your calibration formula.
            You need at least 3 readings to calculate.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Calibration Info */}
            {coefficients && (
              <div className="p-4 border rounded-lg bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h4 className="font-medium text-green-900">Calibration Calculated</h4>
                </div>
                <p className="font-mono text-sm bg-white/50 p-2 rounded mb-2">
                  SG = {coefficients.a.toFixed(4)} refrac + {coefficients.b.toFixed(4)} OG + {coefficients.c.toFixed(4)}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">R:</span>{" "}
                    <span className="font-medium">{parseFloat(calibration?.rSquared ?? "0").toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Error:</span>{" "}
                    <span className="font-medium">{parseFloat(calibration?.maxError ?? "0").toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Error:</span>{" "}
                    <span className="font-medium">{parseFloat(calibration?.avgError ?? "0").toFixed(4)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Readings Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Readings ({readings.length})</h4>
                <Button
                  size="sm"
                  onClick={() => setIsAddingReading(true)}
                  disabled={isAddingReading}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Reading
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OG</TableHead>
                    <TableHead>Refrac</TableHead>
                    <TableHead>Hydro (raw)</TableHead>
                    <TableHead>Temp (C)</TableHead>
                    <TableHead>Fresh?</TableHead>
                    {coefficients && (
                      <>
                        <TableHead>Hydro (corrected)</TableHead>
                        <TableHead>Predicted</TableHead>
                        <TableHead>Error</TableHead>
                      </>
                    )}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Add Reading Row */}
                  {isAddingReading && (
                    <TableRow className="bg-blue-50">
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="1.048"
                          value={newReading.originalGravity}
                          onChange={(e) => setNewReading({ ...newReading, originalGravity: e.target.value })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="1.016"
                          value={newReading.refractometerReading}
                          onChange={(e) => setNewReading({ ...newReading, refractometerReading: e.target.value })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="1.004"
                          value={newReading.hydrometerReading}
                          onChange={(e) => setNewReading({ ...newReading, hydrometerReading: e.target.value })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="10"
                          value={newReading.temperatureC}
                          onChange={(e) => setNewReading({ ...newReading, temperatureC: e.target.value })}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={newReading.isFreshJuice}
                          onCheckedChange={(checked) =>
                            setNewReading({ ...newReading, isFreshJuice: checked === true })
                          }
                        />
                      </TableCell>
                      {coefficients && (
                        <>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                        </>
                      )}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleAddReading}
                            disabled={addReadingMutation.isPending}
                          >
                            {addReadingMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsAddingReading(false)}
                          >
                            <span className="text-red-600">X</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Existing Readings */}
                  {readings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell className="font-mono">{formatSG(reading.originalGravity)}</TableCell>
                      <TableCell className="font-mono">{formatSG(reading.refractometerReading)}</TableCell>
                      <TableCell className="font-mono">{formatSG(reading.hydrometerReading)}</TableCell>
                      <TableCell>{reading.temperatureC}C</TableCell>
                      <TableCell>
                        {reading.isFreshJuice ? (
                          <Badge variant="outline" className="text-xs">Fresh</Badge>
                        ) : null}
                      </TableCell>
                      {coefficients && (
                        <>
                          <TableCell className="font-mono">{formatSG(reading.hydrometerCorrected)}</TableCell>
                          <TableCell className="font-mono">{formatSG(reading.predictedSg)}</TableCell>
                          <TableCell className={`font-mono ${
                            reading.error && Math.abs(parseFloat(reading.error)) > 0.002
                              ? "text-red-600"
                              : "text-green-600"
                          }`}>
                            {reading.error
                              ? (parseFloat(reading.error) >= 0 ? "+" : "") + parseFloat(reading.error).toFixed(4)
                              : "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteReading(reading.id)}
                          disabled={deleteReadingMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {readings.length === 0 && !isAddingReading && (
                    <TableRow>
                      <TableCell colSpan={coefficients ? 9 : 6} className="text-center py-8 text-muted-foreground">
                        No readings yet. Add paired measurements to calibrate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Calculate Button */}
            {!canCalculate && readings.length > 0 && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-yellow-50 text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Add {3 - readings.length} more reading(s) to calculate calibration</span>
              </div>
            )}

            {/* Tips */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Tips for good calibration:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Take readings at different gravity levels (start, mid, end of fermentation)</li>
                <li>Use the same sample for both instruments</li>
                <li>Record temperature at time of measurement</li>
                <li>Mark "Fresh" if it's unfermented juice (for baseline offset)</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleCalculate}
            disabled={!canCalculate || calculateMutation.isPending}
          >
            {calculateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            {coefficients ? "Recalculate" : "Calculate"} Calibration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
