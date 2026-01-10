"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Ruler,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Target,
  Eye,
  Calculator,
  Power,
  PowerOff,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/utils/date-format";
import { CalibrationSessionDialog } from "./CalibrationSessionDialog";

export function CalibrationSettings() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCalibrationId, setSelectedCalibrationId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newCalibrationName, setNewCalibrationName] = useState("");
  const [newCalibrationTemp, setNewCalibrationTemp] = useState("20");

  // Queries
  const { data: activeData, refetch: refetchActive } = trpc.calibration.getActive.useQuery();
  const { data: listData, refetch: refetchList } = trpc.calibration.list.useQuery();
  const utils = trpc.useUtils();

  const refetchAll = () => {
    refetchActive();
    refetchList();
  };

  // Mutations
  const createMutation = trpc.calibration.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Calibration Created",
        description: `"${data.calibration.name}" created. Add readings to calibrate.`,
      });
      setIsCreateDialogOpen(false);
      setNewCalibrationName("");
      setNewCalibrationTemp("20");
      setSelectedCalibrationId(data.calibration.id);
      refetchAll();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateMutation = trpc.calibration.activate.useMutation({
    onSuccess: () => {
      toast({
        title: "Calibration Activated",
        description: "This calibration will now be used for measurements.",
      });
      refetchAll();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deactivateMutation = trpc.calibration.deactivate.useMutation({
    onSuccess: () => {
      toast({
        title: "Calibration Deactivated",
        description: "No calibration is currently active.",
      });
      refetchAll();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = trpc.calibration.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "Calibration Deleted",
        description: "The calibration has been removed.",
      });
      setDeleteConfirmId(null);
      refetchAll();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newCalibrationName.trim()) return;
    createMutation.mutate({
      name: newCalibrationName,
      hydrometerCalibrationTempC: parseFloat(newCalibrationTemp),
    });
  };

  const handleActivate = (id: string) => {
    activateMutation.mutate({ calibrationId: id });
  };

  const handleDeactivate = (id: string) => {
    deactivateMutation.mutate({ calibrationId: id });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ calibrationId: id });
  };

  const activeCalibration = activeData?.calibration;
  const calibrations = listData?.calibrations ?? [];

  const formatCoefficients = (coefficients: { a: number; b: number; c: number } | null) => {
    if (!coefficients) return "Not calculated";
    return `${coefficients.a.toFixed(4)}r + ${coefficients.b.toFixed(4)}og + ${coefficients.c.toFixed(4)}`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                SG Calibration
              </CardTitle>
              <CardDescription>
                Calibrate your refractometer against your hydrometer for accurate fermentation readings
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refetchAll}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Calibration
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Calibration Session</DialogTitle>
                    <DialogDescription>
                      Start a new calibration session. You'll add paired refractometer and hydrometer readings
                      to build a correction formula.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Calibration Name</Label>
                      <Input
                        id="name"
                        value={newCalibrationName}
                        onChange={(e) => setNewCalibrationName(e.target.value)}
                        placeholder="e.g., January 2025 Calibration"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temp">Hydrometer Calibration Temperature (C)</Label>
                      <Input
                        id="temp"
                        type="number"
                        step="0.1"
                        value={newCalibrationTemp}
                        onChange={(e) => setNewCalibrationTemp(e.target.value)}
                        placeholder="20"
                      />
                      <p className="text-xs text-muted-foreground">
                        Most hydrometers are calibrated at 60F (15.56C) or 68F (20C). Check your hydrometer.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!newCalibrationName.trim() || createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Calibration Status */}
          <div className="p-4 border rounded-lg bg-gradient-to-r from-amber-50 to-orange-50">
            <h4 className="font-medium text-amber-900 flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4" />
              Active Calibration
            </h4>
            {activeCalibration ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{activeCalibration.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {activeCalibration.readingsCount} readings | R = {parseFloat(activeCalibration.rSquared ?? "0").toFixed(4)}
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Active</Badge>
                </div>
                <p className="text-sm font-mono bg-white/50 p-2 rounded">
                  Corrected SG = {formatCoefficients(activeCalibration.linearCoefficients as { a: number; b: number; c: number } | null)}
                </p>
                <div className="text-xs text-muted-foreground">
                  Max error: {parseFloat(activeCalibration.maxError ?? "0").toFixed(4)} |
                  Avg error: {parseFloat(activeCalibration.avgError ?? "0").toFixed(4)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-800">
                No calibration is currently active. Create and activate a calibration to get corrected readings.
              </p>
            )}
          </div>

          {/* Calibrations Table */}
          <div>
            <h4 className="font-medium mb-3">All Calibrations</h4>
            {calibrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Ruler className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No calibrations yet</p>
                <p className="text-sm">Create your first calibration to start getting corrected readings</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Readings</TableHead>
                    <TableHead>R</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calibrations.map((cal) => {
                    const coeffs = cal.linearCoefficients as { a: number; b: number; c: number } | null;
                    return (
                      <TableRow key={cal.id}>
                        <TableCell className="font-medium">{cal.name}</TableCell>
                        <TableCell>
                          {cal.isActive ? (
                            <Badge variant="default" className="bg-green-600">Active</Badge>
                          ) : coeffs ? (
                            <Badge variant="secondary">Ready</Badge>
                          ) : (
                            <Badge variant="outline">Needs Calculation</Badge>
                          )}
                        </TableCell>
                        <TableCell>{cal.readingsCount ?? 0}</TableCell>
                        <TableCell>
                          {cal.rSquared
                            ? parseFloat(cal.rSquared).toFixed(4)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {cal.calibrationDate ? formatDate(cal.calibrationDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCalibrationId(cal.id)}
                            title="View/Edit"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {cal.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(cal.id)}
                              disabled={deactivateMutation.isPending}
                              title="Deactivate"
                            >
                              <PowerOff className="w-4 h-4 text-orange-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivate(cal.id)}
                              disabled={!coeffs || activateMutation.isPending}
                              title={coeffs ? "Activate" : "Calculate calibration first"}
                            >
                              <Power className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(cal.id)}
                            disabled={cal.isActive ?? false}
                            title={cal.isActive ? "Deactivate first" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Info Section */}
          <div className="p-4 border rounded-lg bg-blue-50 text-sm space-y-2">
            <h4 className="font-medium text-blue-900">How Calibration Works</h4>
            <p className="text-blue-800">
              Refractometers give incorrect readings once fermentation starts because alcohol affects the refractive index.
              By taking paired readings with both your hydrometer (reference) and refractometer, we can calculate
              a correction formula specific to your instruments.
            </p>
            <p className="text-blue-800">
              Formula: <code className="bg-blue-100 px-1 py-0.5 rounded">Corrected_SG = a refrac + b OG + c</code>
            </p>
            <p className="text-blue-700 text-xs">
              Take at least 3 readings at different gravity levels for best results. More readings = better accuracy.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Calibration Session Dialog */}
      {selectedCalibrationId && (
        <CalibrationSessionDialog
          calibrationId={selectedCalibrationId}
          open={!!selectedCalibrationId}
          onOpenChange={(open) => {
            if (!open) setSelectedCalibrationId(null);
          }}
          onCalibrationUpdated={refetchAll}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calibration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this calibration and all its readings.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
