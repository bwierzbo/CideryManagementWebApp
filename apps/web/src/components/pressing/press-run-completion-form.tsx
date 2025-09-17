"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
} from "lucide-react"
import { gallonsToLiters, litersToGallons, formatUnitConversion } from "lib"
import { trpc } from "@/utils/trpc"

// Completion Form Schema based on task requirements
const pressRunCompletionSchema = z.object({
  juiceVolumeL: z.number().min(1, "Juice volume must be at least 1L").max(50000, "Juice volume cannot exceed 50,000L"),
  juiceVolumeUnit: z.enum(['L', 'gal'], { message: "Unit must be L or gal" }),
  vesselId: z.string().uuid("Please select a vessel"),
  laborHours: z.number().min(0, "Labor hours cannot be negative").max(24, "Labor hours cannot exceed 24").optional(),
  workerCount: z.number().int().min(1, "Worker count must be at least 1").max(20, "Worker count cannot exceed 20").optional(),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
})

type PressRunCompletionForm = z.infer<typeof pressRunCompletionSchema>

interface PressRunCompletionFormProps {
  pressRunId: string
  pressRun?: {
    id: string
    vendorName: string
    totalAppleWeightKg: number
    loads: Array<{
      id: string
      appleVarietyName: string
      appleWeightKg: number
      originalWeight: number
      originalWeightUnit: string
    }>
  }
  onComplete: (data: any) => void
  onCancel: () => void
}

export function PressRunCompletionForm({
  pressRunId,
  pressRun,
  onComplete,
  onCancel,
}: PressRunCompletionFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submissionData, setSubmissionData] = useState<any>(null)

  // Fetch available vessels
  const { data: vesselsData, isLoading: vesselsLoading } = trpc.vessel.list.useQuery()

  // Get available vessels only
  const availableVessels = vesselsData?.vessels?.filter(
    vessel => vessel.status === 'available'
  ) || []

  const form = useForm<PressRunCompletionForm>({
    resolver: zodResolver(pressRunCompletionSchema),
    defaultValues: {
      juiceVolumeUnit: 'L',
      laborHours: 0,
      workerCount: 1,
    },
  })

  const [displayValue, setDisplayValue] = useState<string>('')

  const watchedValues = form.watch()

  const canonicalVolumeL = watchedValues.juiceVolumeL || 0

  // Calculate yield percentage
  const totalAppleKg = pressRun?.totalAppleWeightKg || 0
  const yieldPercentage = totalAppleKg > 0 ? (canonicalVolumeL / totalAppleKg) * 100 : 0

  // Get selected vessel info
  const selectedVessel = availableVessels.find(v => v.id === watchedValues.vesselId)

  const onSubmit = (data: PressRunCompletionForm) => {
    // Prepare submission data with all loads
    const loads = pressRun?.loads?.map(load => ({
      loadId: load.id,
      // For now, distribute juice volume equally across loads
      // In a real implementation, this would be entered per load
      juiceVolumeL: canonicalVolumeL / (pressRun.loads?.length || 1),
      originalVolume: canonicalVolumeL / (pressRun.loads?.length || 1),
      originalVolumeUnit: 'L',
    })) || []

    const submissionPayload = {
      pressRunId,
      vesselId: data.vesselId,
      totalJuiceVolumeL: canonicalVolumeL,
      laborHours: data.laborHours,
      laborCostPerHour: undefined, // Could be added as a field later
      notes: data.notes,
      loads,
    }

    setSubmissionData(submissionPayload)
    setShowConfirmation(true)
  }

  const handleConfirmSubmission = () => {
    if (submissionData) {
      onComplete(submissionData)
    }
    setShowConfirmation(false)
  }

  const handleVolumeChange = (value: string) => {
    setDisplayValue(value)

    if (value === '') {
      // Allow clearing the field
      form.setValue('juiceVolumeL', 0)
      return
    }

    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      // Always store in canonical liters
      const volumeInL = watchedValues.juiceVolumeUnit === 'gal'
        ? gallonsToLiters(numValue)
        : numValue
      form.setValue('juiceVolumeL', volumeInL)
    }
  }

  const handleUnitChange = (newUnit: 'L' | 'gal') => {
    const currentVolumeL = watchedValues.juiceVolumeL || 0
    form.setValue('juiceVolumeUnit', newUnit)

    // Only convert if there's a positive value to convert
    if (currentVolumeL > 0) {
      // Convert current volume to display in new unit
      const newDisplayValue = newUnit === 'gal'
        ? litersToGallons(currentVolumeL).toString()
        : currentVolumeL.toString()

      setDisplayValue(newDisplayValue)
    } else {
      setDisplayValue('')
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="juiceVolumeL"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter volume..."
                            value={displayValue}
                            onChange={(e) => handleVolumeChange(e.target.value)}
                            className="text-lg h-12"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="juiceVolumeUnit"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={handleUnitChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="L">Liters (L)</SelectItem>
                            <SelectItem value="gal">Gallons (gal)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Real-time Unit Conversion Display */}
              {canonicalVolumeL > 0 && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <Calculator className="w-4 h-4 inline mr-1" />
                    {watchedValues.juiceVolumeUnit === 'L'
                      ? formatUnitConversion(canonicalVolumeL, 'L', 'gal')
                      : formatUnitConversion(litersToGallons(canonicalVolumeL), 'gal', 'L')
                    }
                  </p>
                </div>
              )}

              {/* Yield Calculation */}
              {yieldPercentage > 0 && (
                <div className="bg-green-50 p-3 rounded-md">
                  <p className="text-sm text-green-800 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Extraction Rate: <strong className="ml-1">{yieldPercentage.toFixed(1)}%</strong>
                    <span className="text-xs text-green-600 ml-2">
                      ({canonicalVolumeL.toFixed(1)}L juice from {totalAppleKg}kg apples)
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vessel Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Beaker className="w-4 h-4 mr-2 text-purple-600" />
                Vessel Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="vesselId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Vessels</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select a vessel for fermentation..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vesselsLoading ? (
                          <SelectItem value="loading" disabled>Loading vessels...</SelectItem>
                        ) : availableVessels.length === 0 ? (
                          <SelectItem value="none" disabled>No available vessels</SelectItem>
                        ) : (
                          availableVessels.map((vessel) => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{vessel.name}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  {vessel.capacityL}L • {vessel.type}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose an available vessel for fermentation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vessel Capacity Validation */}
              {selectedVessel && canonicalVolumeL > 0 && (
                <div className="mt-3">
                  {parseFloat(selectedVessel.capacityL) < canonicalVolumeL ? (
                    <div className="bg-red-50 p-3 rounded-md">
                      <p className="text-sm text-red-800 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Volume ({canonicalVolumeL.toFixed(1)}L) exceeds vessel capacity ({selectedVessel.capacityL}L)
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-50 p-3 rounded-md">
                      <p className="text-sm text-green-800 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        {selectedVessel.name}: {canonicalVolumeL.toFixed(1)}L / {selectedVessel.capacityL}L capacity
                        ({((canonicalVolumeL / parseFloat(selectedVessel.capacityL)) * 100).toFixed(1)}% filled)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Labor Tracking (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Clock className="w-4 h-4 mr-2 text-orange-600" />
                Labor Tracking <span className="text-sm font-normal text-gray-500">(Optional)</span>
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
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
              disabled={!form.formState.isValid || !watchedValues.vesselId}
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
                  <p><strong>Juice Volume:</strong> {canonicalVolumeL.toFixed(1)}L</p>
                  <p><strong>Vessel:</strong> {selectedVessel?.name}</p>
                  <p><strong>Extraction Rate:</strong> {yieldPercentage.toFixed(1)}%</p>
                  {watchedValues.laborHours && (
                    <p><strong>Labor:</strong> {watchedValues.laborHours}h with {watchedValues.workerCount} worker(s)</p>
                  )}
                </div>
                <p className="text-xs text-amber-600">
                  ⚠️ This action cannot be undone. The press run will be marked as completed.
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
  )
}