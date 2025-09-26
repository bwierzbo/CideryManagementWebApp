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

// Package size options as per PRD
const PACKAGE_SIZES = [
  { value: 355, label: "355ml (12 oz can/bottle)" },
  { value: 473, label: "473ml (16 oz can)" },
  { value: 500, label: "500ml bottle" },
  { value: 750, label: "750ml bottle" },
  { value: 1000, label: "1L bottle" },
  { value: 19500, label: "19.5L keg (1/6 barrel)" },
  { value: 30000, label: "30L keg (1/4 barrel)" },
  { value: 50000, label: "50L keg (1/2 barrel)" },
] as const

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
  onSubmit: (data: BottleFormData & { lossL: number }) => Promise<void>
}

export function BottleModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
  onSubmit,
}: BottleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      await onSubmit({ ...data, lossL })
      onClose()
    } catch (error) {
      console.error("Failed to create packaging run:", error)
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bottle from {vesselName}</DialogTitle>
          <DialogDescription>
            Package contents from this vessel. Available volume: {currentVolumeL.toFixed(1)}L
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Volume taken */}
          <div>
            <Label htmlFor="volumeTakenL">Volume taken (L) *</Label>
            <Input
              id="volumeTakenL"
              type="number"
              step="0.1"
              max={currentVolumeL}
              placeholder={`Max ${currentVolumeL.toFixed(1)}L available`}
              {...register("volumeTakenL", { valueAsNumber: true })}
            />
            {errors.volumeTakenL && (
              <p className="text-sm text-red-600 mt-1">{errors.volumeTakenL.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Liters removed from vessel for packaging</p>
          </div>

          {/* Package size */}
          <div>
            <Label htmlFor="packageSizeMl">Package size *</Label>
            <Select onValueChange={(value) => setValue("packageSizeMl", parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select package size" />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value.toString()}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.packageSizeMl && (
              <p className="text-sm text-red-600 mt-1">{errors.packageSizeMl.message}</p>
            )}
          </div>

          {/* Units produced */}
          <div>
            <Label htmlFor="unitsProduced">Units produced *</Label>
            <Input
              id="unitsProduced"
              type="number"
              min="0"
              placeholder="Number of packages filled"
              {...register("unitsProduced", { valueAsNumber: true })}
            />
            {errors.unitsProduced && (
              <p className="text-sm text-red-600 mt-1">{errors.unitsProduced.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Number of packages filled</p>
          </div>

          {/* Computed loss display */}
          {volumeTakenL && packageSizeMl && unitsProduced !== undefined && (
            <div className={`p-4 rounded-lg border ${lossStatus.bg}`}>
              <div className="flex items-center space-x-2 mb-2">
                <lossStatus.icon className={`w-5 h-5 ${lossStatus.color}`} />
                <Label className={`font-medium ${lossStatus.color}`}>Computed Loss</Label>
              </div>
              <div className="space-y-1">
                <p className={`text-lg font-semibold ${lossStatus.color}`}>
                  {lossL.toFixed(2)}L ({lossPercentage.toFixed(1)}%)
                </p>
                <p className={`text-sm ${lossStatus.color}`}>{lossStatus.message}</p>
                <p className="text-xs text-gray-600">
                  Formula: {volumeTakenL.toFixed(1)}L taken - ({unitsProduced} × {unitSizeL.toFixed(3)}L)
                </p>
              </div>
            </div>
          )}

          {/* Date/time */}
          <div>
            <Label htmlFor="packagedAt">Date/time *</Label>
            <Input
              id="packagedAt"
              type="datetime-local"
              {...register("packagedAt")}
            />
            {errors.packagedAt && (
              <p className="text-sm text-red-600 mt-1">{errors.packagedAt.message}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any observations about packaging run"
              maxLength={500}
              {...register("notes")}
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || lossL < 0 || !volumeTakenL || !packageSizeMl || unitsProduced === undefined}
            >
              {isSubmitting ? "Creating..." : "Complete & Go to /packaging"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}