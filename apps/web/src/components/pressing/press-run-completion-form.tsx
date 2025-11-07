"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { VolumeInput, VolumeDisplay, type VolumeUnit } from "@/components/ui/volume-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Scale,
  Droplets,
  Clock,
  Users,
  Beaker,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Plus,
  Trash2,
} from "lucide-react";
import { gallonsToLiters, litersToGallons, formatUnitConversion } from "lib";
import { trpc } from "@/utils/trpc";
import { formatDate, formatDateForInput } from "@/utils/date-format";

// Assignment schema for vessel assignments
const assignmentSchema = z.object({
  toVesselId: z.string().uuid("Please select a vessel"),
  volumeL: z
    .number()
    .min(0.1, "Volume must be at least 0.1L")
    .max(50000, "Volume cannot exceed 50,000L"),
});

// Completion Form Schema based on task requirements
const pressRunCompletionSchema = z.object({
  completionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date"),
  totalJuiceVolume: z
    .number()
    .min(1, "Total juice volume must be at least 1L")
    .max(50000, "Total juice volume cannot exceed 50,000L"),
  juiceVolumeUnit: z.enum(["L", "gal"], { message: "Unit must be L or gal" }),
  assignments: z
    .array(assignmentSchema)
    .min(1, "At least one vessel assignment is required"),
  laborHours: z
    .number()
    .min(0, "Labor hours cannot be negative")
    .max(24, "Labor hours cannot exceed 24")
    .optional(),
  workerCount: z
    .number()
    .int()
    .min(1, "Worker count must be at least 1")
    .max(20, "Worker count cannot exceed 20")
    .optional(),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
  depletedInventoryItemIds: z.array(z.string()).optional(),
});

type PressRunCompletionForm = z.infer<typeof pressRunCompletionSchema>;

interface PressRunCompletionFormProps {
  pressRunId: string;
  pressRun?: {
    id: string;
    vendorName: string;
    totalAppleWeightKg: number;
    loads: Array<{
      id: string;
      appleVarietyName: string;
      appleWeightKg: number;
      originalWeight: number;
      originalWeightUnit: string;
    }>;
  };
  onComplete: (data: any) => void;
  onCancel: () => void;
}

export function PressRunCompletionForm({
  pressRunId,
  pressRun,
  onComplete,
  onCancel,
}: PressRunCompletionFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submissionData, setSubmissionData] = useState<any>(null);

  // Fetch vessels with batch information
  const { data: vesselsData, isLoading: vesselsLoading } =
    trpc.vessel.listWithBatches.useQuery();

  // Get all vessels with remaining capacity
  const availableVessels =
    vesselsData?.vessels?.filter((vessel) => vessel.isAvailable) || [];

  const form = useForm<PressRunCompletionForm>({
    resolver: zodResolver(pressRunCompletionSchema),
    defaultValues: {
      completionDate: formatDateForInput(new Date()), // Today's date in YYYY-MM-DD format
      juiceVolumeUnit: "L",
      assignments: [{ toVesselId: "", volumeL: 0 }],
      laborHours: 0,
      workerCount: 1,
    },
  });

  const [displayValue, setDisplayValue] = useState<string>("");

  const watchedValues = form.watch();

  const canonicalVolumeL = watchedValues.totalJuiceVolume || 0;
  const assignedVolumeL =
    watchedValues.assignments?.reduce(
      (sum, assignment) => sum + (assignment.volumeL || 0),
      0,
    ) || 0;

  // Calculate remaining with floating-point tolerance clamping
  const VOLUME_EPSILON = 0.01; // 10mL tolerance
  const rawRemainingVolumeL = canonicalVolumeL - assignedVolumeL;
  const remainingVolumeL = Math.abs(rawRemainingVolumeL) < VOLUME_EPSILON ? 0 : rawRemainingVolumeL;

  // Calculate yield percentage
  const totalAppleKg = pressRun?.totalAppleWeightKg || 0;
  const yieldPercentage =
    totalAppleKg > 0 ? (canonicalVolumeL / totalAppleKg) * 100 : 0;

  // Get assignments with vessel info
  const assignmentsWithVessels =
    watchedValues.assignments?.map((assignment) => ({
      ...assignment,
      vessel: availableVessels.find((v) => v.id === assignment.toVesselId),
    })) || [];

  const onSubmit = (data: PressRunCompletionForm) => {
    // Parse the date string (YYYY-MM-DD) and create a Date object in local timezone
    // to avoid timezone conversion issues
    const [year, month, day] = data.completionDate.split("-").map(Number);
    const completionDate = new Date(year, month - 1, day); // month is 0-indexed

    const submissionPayload = {
      pressRunId,
      completionDate,
      totalJuiceVolume: data.totalJuiceVolume,
      assignments: data.assignments,
      laborHours: data.laborHours,
      notes: data.notes,
    };

    setSubmissionData(submissionPayload);
    setShowConfirmation(true);
  };

  const handleConfirmSubmission = () => {
    if (submissionData) {
      onComplete(submissionData);
    }
    setShowConfirmation(false);
  };

  const handleVolumeChange = (value: string) => {
    setDisplayValue(value);

    if (value === "") {
      // Allow clearing the field
      form.setValue("totalJuiceVolume", 0);
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      // Always store in canonical liters
      const volumeInL =
        watchedValues.juiceVolumeUnit === "gal"
          ? gallonsToLiters(numValue)
          : numValue;
      form.setValue("totalJuiceVolume", volumeInL);
    }
  };

  const handleUnitChange = (newUnit: "L" | "gal") => {
    const currentVolume = watchedValues.totalJuiceVolume || 0;
    form.setValue("juiceVolumeUnit", newUnit);

    // Only convert if there's a positive value to convert
    if (currentVolume > 0) {
      // Convert current volume to display in new unit
      const newDisplayValue =
        newUnit === "gal"
          ? litersToGallons(currentVolume).toString()
          : currentVolume.toString();

      setDisplayValue(newDisplayValue);
    } else {
      setDisplayValue("");
    }
  };

  const addAssignment = () => {
    const currentAssignments = watchedValues.assignments || [];
    form.setValue("assignments", [
      ...currentAssignments,
      { toVesselId: "", volumeL: 0 },
    ]);
  };

  const removeAssignment = (index: number) => {
    const currentAssignments = watchedValues.assignments || [];
    if (currentAssignments.length > 1) {
      form.setValue(
        "assignments",
        currentAssignments.filter((_, i) => i !== index),
      );
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Press Run Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                Press Run Details
              </CardTitle>
              <CardDescription>
                Set the completion date (name will be auto-generated)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="completionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completion Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Press run will be named as:{" "}
                      {field.value ? `${field.value}-01` : "YYYY-MM-DD-01"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Juice Volume Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Droplets className="w-4 h-4 mr-2 text-blue-600" />
                Juice Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Volume Input with Unit Selection */}
              <FormField
                control={form.control}
                name="totalJuiceVolume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Juice Volume</FormLabel>
                    <FormControl>
                      <VolumeInput
                        value={displayValue ? parseFloat(displayValue) : undefined}
                        unit={watchedValues.juiceVolumeUnit as VolumeUnit}
                        onValueChange={(value) => {
                          handleVolumeChange(value?.toString() || "");
                        }}
                        onUnitChange={(unit) => {
                          handleUnitChange(unit as "L" | "gal");
                        }}
                        placeholder="Enter total juice volume..."
                        min={0}
                        step={0.01}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Real-time Unit Conversion Display */}
              {canonicalVolumeL > 0 && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <Calculator className="w-4 h-4 inline mr-1" />
                    {watchedValues.juiceVolumeUnit === "L"
                      ? formatUnitConversion(canonicalVolumeL, "L", "gal")
                      : formatUnitConversion(
                          litersToGallons(canonicalVolumeL),
                          "gal",
                          "L",
                        )}
                  </p>
                </div>
              )}

              {/* Yield Calculation */}
              {yieldPercentage > 0 && (
                <div className="bg-green-50 p-3 rounded-md">
                  <p className="text-sm text-green-800 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Extraction Rate:{" "}
                    <strong className="ml-1">
                      {yieldPercentage.toFixed(1)}%
                    </strong>
                    <span className="text-xs text-green-600 ml-2">
                      ({canonicalVolumeL.toFixed(1)}L juice from {totalAppleKg}
                      kg apples)
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vessel Assignments Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center">
                  <Beaker className="w-4 h-4 mr-2 text-purple-600" />
                  Vessel Assignments
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAssignment}
                  className="h-8 px-3"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Assignment
                </Button>
              </CardTitle>
              <CardDescription>
                Assign juice volumes to available vessels for fermentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assignment Rows */}
              <div className="space-y-3">
                {watchedValues.assignments?.map((assignment, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-lg"
                  >
                    {/* Vessel Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Vessel</Label>
                      <FormField
                        control={form.control}
                        name={`assignments.${index}.toVesselId`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select vessel..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vesselsLoading ? (
                                  <SelectItem value="loading" disabled>
                                    Loading vessels...
                                  </SelectItem>
                                ) : availableVessels.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No available vessels
                                  </SelectItem>
                                ) : (
                                  availableVessels.map((vessel) => (
                                    <SelectItem
                                      key={vessel.id}
                                      value={vessel.id}
                                    >
                                      <div className="flex flex-col items-start w-full">
                                        <div className="flex items-center justify-between w-full">
                                          <span className="font-medium">
                                            {vessel.name}
                                          </span>
                                          <span className="text-xs text-gray-500 ml-2">
                                            {vessel.remainingCapacityL}L /{" "}
                                            {vessel.capacity}L
                                          </span>
                                        </div>
                                        {vessel.currentBatch && (
                                          <div className="text-xs text-blue-600 mt-1">
                                            Current: {vessel.currentBatch.name}{" "}
                                            (
                                            {vessel.currentBatch.currentVolume}
                                            L)
                                          </div>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Volume Input */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Volume ({watchedValues.juiceVolumeUnit || "L"})
                      </Label>
                      <FormField
                        control={form.control}
                        name={`assignments.${index}.volumeL`}
                        render={({ field }) => {
                          // Convert display value based on selected unit
                          const displayValue =
                            watchedValues.juiceVolumeUnit === "gal" &&
                            field.value > 0
                              ? litersToGallons(field.value)
                              : watchedValues.juiceVolumeUnit === "gal"
                                ? ""
                                : field.value || "";

                          const handleChange = (value: string) => {
                            const numValue = parseFloat(value) || 0;
                            // Convert back to liters if in gallons
                            const litersValue =
                              watchedValues.juiceVolumeUnit === "gal" &&
                              numValue > 0
                                ? gallonsToLiters(numValue)
                                : watchedValues.juiceVolumeUnit === "gal"
                                  ? 0
                                  : numValue;
                            field.onChange(litersValue);
                          };

                          return (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Enter volume..."
                                  value={displayValue}
                                  onChange={(e) => handleChange(e.target.value)}
                                  className="h-10"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Actions</Label>
                      <div className="flex items-center gap-2">
                        {assignmentsWithVessels[index]?.vessel && (
                          <div className="text-xs text-gray-600 flex-1">
                            {(() => {
                              const vessel =
                                assignmentsWithVessels[index].vessel;
                              const remainingL = parseFloat(
                                vessel?.remainingCapacityL || "0",
                              );
                              const totalL = parseFloat(
                                vessel?.capacity || "0",
                              );

                              if (watchedValues.juiceVolumeUnit === "gal") {
                                const remainingGal =
                                  remainingL > 0
                                    ? litersToGallons(remainingL)
                                    : 0;
                                const totalGal =
                                  totalL > 0 ? litersToGallons(totalL) : 0;
                                return `${remainingGal.toFixed(1)}/${totalGal.toFixed(1)} gal available`;
                              } else {
                                return `${remainingL.toFixed(1)}/${totalL.toFixed(1)}L available`;
                              }
                            })()}
                          </div>
                        )}
                        {watchedValues.assignments &&
                          watchedValues.assignments.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeAssignment(index)}
                              className="h-10 w-10 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                      </div>
                    </div>

                    {/* Capacity Validation for this assignment */}
                    {assignmentsWithVessels[index]?.vessel &&
                      assignment.volumeL > 0 && (
                        <div className="md:col-span-3 mt-2">
                          {(() => {
                            const vessel =
                              assignmentsWithVessels[index].vessel!;
                            const remainingL = parseFloat(
                              vessel.remainingCapacityL,
                            );
                            const totalL = parseFloat(vessel.capacity);
                            const volumeL = assignment.volumeL;
                            const currentBatchVolumeL =
                              vessel.currentBatch &&
                              vessel.currentBatch.currentVolume
                                ? parseFloat(vessel.currentBatch.currentVolume)
                                : 0;
                            const combinedVolumeL =
                              currentBatchVolumeL + volumeL;
                            const isGallons =
                              watchedValues.juiceVolumeUnit === "gal";

                            const displayVolume =
                              isGallons && volumeL > 0
                                ? litersToGallons(volumeL)
                                : isGallons
                                  ? 0
                                  : volumeL;
                            const displayRemaining =
                              isGallons && remainingL > 0
                                ? litersToGallons(remainingL)
                                : isGallons
                                  ? 0
                                  : remainingL;
                            const displayTotal =
                              isGallons && totalL > 0
                                ? litersToGallons(totalL)
                                : isGallons
                                  ? 0
                                  : totalL;
                            const displayCombined =
                              isGallons && combinedVolumeL > 0
                                ? litersToGallons(combinedVolumeL)
                                : isGallons
                                  ? 0
                                  : combinedVolumeL;
                            const unit = isGallons ? "gal" : "L";

                            if (remainingL < volumeL) {
                              return (
                                <div className="bg-red-50 p-2 rounded-md">
                                  <p className="text-sm text-red-800 flex items-center">
                                    <AlertTriangle className="w-4 h-4 mr-1" />
                                    Volume ({displayVolume.toFixed(1)}
                                    {unit}) exceeds remaining capacity (
                                    {displayRemaining.toFixed(1)}
                                    {unit})
                                    {vessel.currentBatch && (
                                      <span className="ml-1">
                                        - Current batch:{" "}
                                        {vessel.currentBatch.name}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="bg-green-50 p-2 rounded-md">
                                <p className="text-sm text-green-800 flex items-center">
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  {
                                    assignmentsWithVessels[index].vessel!.name
                                  }: {displayCombined.toFixed(1)}
                                  {unit} / {displayTotal.toFixed(1)}
                                  {unit} (
                                  {((combinedVolumeL / totalL) * 100).toFixed(
                                    1,
                                  )}
                                  % filled)
                                  {vessel.currentBatch && (
                                    <span className="ml-2 text-xs">
                                      (Adding {displayVolume.toFixed(1)}
                                      {unit} to existing batch)
                                    </span>
                                  )}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Volume Summary */}
              {canonicalVolumeL > 0 && (
                <div className="bg-blue-50 p-4 rounded-md space-y-2">
                  {(() => {
                    const isGallons = watchedValues.juiceVolumeUnit === "gal";
                    const unit = isGallons ? "gal" : "L";

                    const displayAvailable =
                      isGallons && canonicalVolumeL > 0
                        ? litersToGallons(canonicalVolumeL)
                        : isGallons
                          ? 0
                          : canonicalVolumeL;
                    const displayAssigned =
                      isGallons && assignedVolumeL > 0
                        ? litersToGallons(assignedVolumeL)
                        : isGallons
                          ? 0
                          : assignedVolumeL;
                    const displayRemaining =
                      isGallons && remainingVolumeL > 0
                        ? litersToGallons(remainingVolumeL)
                        : isGallons
                          ? remainingVolumeL / 3.78541 // Convert negative/zero values directly without validation
                          : remainingVolumeL;

                    return (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-800">
                            Total Available:
                          </span>
                          <span className="font-medium text-blue-900">
                            {displayAvailable.toFixed(1)}
                            {unit}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-800">Assigned:</span>
                          <span className="font-medium text-blue-900">
                            {displayAssigned.toFixed(1)}
                            {unit}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-blue-200 pt-2">
                          <span className="text-blue-800">Remaining:</span>
                          <span
                            className={`font-medium ${remainingVolumeL < 0 ? "text-red-600" : remainingVolumeL > 0.1 ? "text-yellow-600" : "text-green-600"}`}
                          >
                            {displayRemaining.toFixed(1)}
                            {unit}
                          </span>
                        </div>
                        {remainingVolumeL < -0.1 && (
                          <div className="bg-red-100 p-2 rounded border border-red-200">
                            <p className="text-sm text-red-800 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Over-assigned by{" "}
                              {Math.abs(displayRemaining).toFixed(1)}
                              {unit}
                            </p>
                          </div>
                        )}
                        {remainingVolumeL > 0.1 && (
                          <div className="bg-yellow-100 p-2 rounded border border-yellow-200">
                            <p className="text-sm text-yellow-800 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              {displayRemaining.toFixed(1)}
                              {unit} not yet assigned
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Labor Tracking (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Clock className="w-4 h-4 mr-2 text-orange-600" />
                Labor Tracking{" "}
                <span className="text-sm font-normal text-gray-500">
                  (Optional)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="laborHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Labor Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          max="24"
                          placeholder="0.00"
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Hours worked on this press run
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workerCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Worker Count</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          placeholder="1"
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Number of workers involved
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about the pressing process, quality observations, or other relevant details..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional notes about the press run completion
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1 h-12 bg-green-600 hover:bg-green-700"
              disabled={
                !form.formState.isValid || Math.abs(remainingVolumeL) > 0.1
              }
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Complete Press Run
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
              Confirm Completion
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Review the press run completion details:</p>
                <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                  <p>
                    <strong>Press Run Name:</strong>{" "}
                    {watchedValues.completionDate}-01
                  </p>
                  <p>
                    <strong>Completion Date:</strong>{" "}
                    {formatDate(new Date(watchedValues.completionDate))}
                  </p>
                  <p>
                    <strong>Total Juice Volume:</strong>{" "}
                    {canonicalVolumeL.toFixed(1)}L
                  </p>
                  <p>
                    <strong>Vessel Assignments:</strong>
                  </p>
                  <div className="ml-4 space-y-1">
                    {assignmentsWithVessels.map(
                      (assignment, index) =>
                        assignment.vessel &&
                        assignment.volumeL > 0 && (
                          <p key={index} className="text-xs">
                            • {assignment.vessel.name}:{" "}
                            {assignment.volumeL.toFixed(1)}L
                          </p>
                        ),
                    )}
                  </div>
                  <p>
                    <strong>Extraction Rate:</strong>{" "}
                    {yieldPercentage.toFixed(1)}%
                  </p>
                  {watchedValues.laborHours && (
                    <p>
                      <strong>Labor:</strong> {watchedValues.laborHours}h with{" "}
                      {watchedValues.workerCount} worker(s)
                    </p>
                  )}
                </div>
                <p className="text-xs text-amber-600">
                  ⚠️ This action cannot be undone. The press run will be marked
                  as completed.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmission}
              className="bg-green-600 hover:bg-green-700"
            >
              Complete Press Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
