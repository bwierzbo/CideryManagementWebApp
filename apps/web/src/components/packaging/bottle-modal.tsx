"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { trpc } from "@/utils/trpc"
import { toast } from "@/hooks/use-toast"

// Form validation schema
const bottleFormSchema = z.object({
  volumeTakenL: z.number().positive("Volume must be positive"),
  packageSizeMl: z.number().positive("Please select a package size"),
  unitsProduced: z.number().int().min(0, "Units cannot be negative"),
  packagedAt: z.string().min(1, "Date/time is required"),
  notes: z.string().optional(),
})

type BottleFormData = z.infer<typeof bottleFormSchema>

interface BottleModalProps {
  open: boolean
  onClose: () => void
  vesselId: string
  vesselName: string
  batchId: string
  currentVolumeL: number
}

export function BottleModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
}: BottleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // tRPC queries and mutations
  const packageSizesQuery = trpc.packaging.getPackageSizes.useQuery()
  const createPackagingRunMutation = trpc.packaging.createFromCellar.useMutation()
  const utils = trpc.useUtils()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BottleFormData>({
    resolver: zodResolver(bottleFormSchema),
    defaultValues: {
      packagedAt: new Date().toISOString().slice(0, 16), // Current date/time in local format
      notes: "",
    },
  })

  // Watch form values for real-time calculations
  const volumeTakenL = watch("volumeTakenL")
  const packageSizeMl = watch("packageSizeMl")
  const unitsProduced = watch("unitsProduced")

  // Calculate loss and loss percentage
  const unitSizeL = packageSizeMl / 1000
  const expectedVolumeL = (unitsProduced || 0) * unitSizeL
  const lossL = (volumeTakenL || 0) - expectedVolumeL
  const lossPercentage = volumeTakenL > 0 ? (lossL / volumeTakenL) * 100 : 0

  // Determine loss status and styling
  const getLossStatus = () => {
    if (lossL < 0) return { color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle, message: "Invalid: negative loss" }
    if (lossPercentage > 10) return { color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle, message: "Excessive loss (>10%)" }
    if (lossPercentage > 5) return { color: "text-yellow-600", bg: "bg-yellow-50", icon: AlertTriangle, message: "High loss (>5%)" }
    if (lossPercentage > 2) return { color: "text-yellow-600", bg: "bg-yellow-50", icon: AlertTriangle, message: "Moderate loss (2-5%)" }
    return { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle, message: "Normal loss (<2%)" }
  }

  const lossStatus = getLossStatus()

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        packagedAt: new Date().toISOString().slice(0, 16),
        notes: "",
      })
    }
  }, [open, reset])

  const handleFormSubmit = async (data: BottleFormData) => {
    if (lossL < 0) {
      return // Prevent submission with negative loss
    }

    setIsSubmitting(true)
    try {
      const result = await createPackagingRunMutation.mutateAsync({
        batchId,
        vesselId,
        packagedAt: new Date(data.packagedAt),
        packageSizeMl: data.packageSizeMl,
        unitsProduced: data.unitsProduced,
        volumeTakenL: data.volumeTakenL,
        notes: data.notes,
      })

      // Invalidate relevant queries to refresh data
      utils.vessel.liquidMap.invalidate()
      utils.batch.list.invalidate()

      // Show success toast with option to view packaging run
      toast({
        title: "Packaging Run Created",
        description: `Successfully packaged ${data.unitsProduced} units from ${vesselName}. Loss: ${result.lossL.toFixed(2)}L (${result.lossPercentage.toFixed(1)}%)`,
      })

      console.log("Packaging run created:", result)
      onClose()
    } catch (error) {
      console.error("Failed to create packaging run:", error)

      // Show error toast with specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast({
        title: "Failed to Create Packaging Run",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg md:text-xl truncate pr-8">Bottle from {vesselName}</DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            Package contents from this vessel. Available volume: {currentVolumeL.toFixed(1)}L
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 md:space-y-6">
          {/* Volume taken */}
          <div>
            <Label htmlFor="volumeTakenL" className="text-sm md:text-base font-medium">Volume taken (L) *</Label>
            <Input
              id="volumeTakenL"
              type="number"
              step="0.1"
              max={currentVolumeL}
              placeholder={`Max ${currentVolumeL.toFixed(1)}L available`}
              className="h-10 md:h-11 text-base"
              {...register("volumeTakenL", { valueAsNumber: true })}
            />
            {errors.volumeTakenL && (
              <p className="text-sm text-red-600 mt-1">{errors.volumeTakenL.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Liters removed from vessel for packaging</p>
          </div>

          {/* Package size */}
          <div>
            <Label htmlFor="packageSizeMl" className="text-sm md:text-base font-medium">Package size *</Label>
            <Select onValueChange={(value) => setValue("packageSizeMl", parseInt(value))}>
              <SelectTrigger className="h-10 md:h-11">
                <SelectValue placeholder="Select package size" />
              </SelectTrigger>
              <SelectContent>
                {packageSizesQuery.isLoading ? (
                  <SelectItem value="loading" disabled>Loading package sizes...</SelectItem>
                ) : packageSizesQuery.data?.length ? (
                  packageSizesQuery.data.map((size) => (
                    <SelectItem key={size.id} value={size.sizeML.toString()}>
                      {size.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No package sizes available</SelectItem>
                )}
              </SelectContent>
            </Select>
            {errors.packageSizeMl && (
              <p className="text-sm text-red-600 mt-1">{errors.packageSizeMl.message}</p>
            )}
          </div>

          {/* Units produced */}
          <div>
            <Label htmlFor="unitsProduced" className="text-sm md:text-base font-medium">Units produced *</Label>
            <Input
              id="unitsProduced"
              type="number"
              min="0"
              placeholder="Number of packages filled"
              className="h-10 md:h-11 text-base"
              {...register("unitsProduced", { valueAsNumber: true })}
            />
            {errors.unitsProduced && (
              <p className="text-sm text-red-600 mt-1">{errors.unitsProduced.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Number of packages filled</p>
          </div>

          {/* Computed loss display */}
          {volumeTakenL && packageSizeMl && unitsProduced !== undefined && (
            <div className={`p-3 md:p-4 rounded-lg border ${lossStatus.bg}`}>
              <div className="flex items-center space-x-2 mb-2">
                <lossStatus.icon className={`w-4 h-4 md:w-5 md:h-5 ${lossStatus.color} flex-shrink-0`} />
                <Label className={`font-medium ${lossStatus.color} text-sm md:text-base`}>Computed Loss</Label>
              </div>
              <div className="space-y-1">
                <p className={`text-base md:text-lg font-semibold ${lossStatus.color}`}>
                  {lossL.toFixed(2)}L ({lossPercentage.toFixed(1)}%)
                </p>
                <p className={`text-sm ${lossStatus.color}`}>{lossStatus.message}</p>
                <p className="text-xs text-gray-600 break-words">
                  Formula: {volumeTakenL.toFixed(1)}L taken - ({unitsProduced} × {unitSizeL.toFixed(3)}L)
                </p>
              </div>
            </div>
          )}

          {/* Date/time */}
          <div>
            <Label htmlFor="packagedAt" className="text-sm md:text-base font-medium">Date/time *</Label>
            <Input
              id="packagedAt"
              type="datetime-local"
              className="h-10 md:h-11 text-base"
              {...register("packagedAt")}
            />
            {errors.packagedAt && (
              <p className="text-sm text-red-600 mt-1">{errors.packagedAt.message}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm md:text-base font-medium">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any observations about packaging run"
              maxLength={500}
              className="min-h-[80px] text-base resize-none"
              {...register("notes")}
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || createPackagingRunMutation.isPending}
              className="w-full sm:w-auto h-10 md:h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createPackagingRunMutation.isPending || lossL < 0 || !volumeTakenL || !packageSizeMl || unitsProduced === undefined}
              className="w-full sm:w-auto h-10 md:h-11"
            >
              <span className="hidden sm:inline">
                {isSubmitting || createPackagingRunMutation.isPending ? "Creating..." : "Complete & Go to /packaging"}
              </span>
              <span className="sm:hidden">
                {isSubmitting || createPackagingRunMutation.isPending ? "Creating..." : "Complete"}
              </span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}