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
import { CheckCircle, AlertTriangle, BeakerIcon } from "lucide-react"
import { trpc } from "@/utils/trpc"
import { toast } from "@/hooks/use-toast"

// Form validation schema
const qaUpdateSchema = z.object({
  fillCheck: z.enum(['pass', 'fail', 'not_tested']).optional(),
  fillVarianceMl: z.number().min(-1000, "Fill variance too low").max(1000, "Fill variance too high").optional(),
  abvAtPackaging: z.number().min(0, "ABV cannot be negative").max(100, "ABV cannot exceed 100%").optional(),
  carbonationLevel: z.enum(['still', 'petillant', 'sparkling']).optional(),
  testMethod: z.string().max(100, "Test method too long").optional(),
  testDate: z.string().optional(),
  qaNotes: z.string().max(1000, "Notes too long").optional()
})

type QAUpdateFormData = z.infer<typeof qaUpdateSchema>

interface QAUpdateModalProps {
  open: boolean
  onClose: () => void
  runId: string
  runData?: {
    id: string
    fillCheck?: string | null
    fillVarianceML?: number | null
    abvAtPackaging?: number | null
    carbonationLevel?: string | null
    testMethod?: string | null
    testDate?: Date | null
    qaTechnicianName?: string | null
    qaNotes?: string | null
    batchName?: string | null
    packageType?: string
    packageSizeML?: number
  }
}

export function QAUpdateModal({
  open,
  onClose,
  runId,
  runData,
}: QAUpdateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // tRPC queries and mutations
  const updateQAMutation = trpc.packaging.updateQA.useMutation()
  const utils = trpc.useUtils()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<QAUpdateFormData>({
    resolver: zodResolver(qaUpdateSchema),
    defaultValues: {
      fillCheck: undefined,
      fillVarianceMl: undefined,
      abvAtPackaging: undefined,
      carbonationLevel: undefined,
      testMethod: "",
      testDate: "",
      qaNotes: "",
    },
  })

  // Populate form with current data when modal opens
  useEffect(() => {
    if (open && runData) {
      reset({
        fillCheck: runData.fillCheck as any || undefined,
        fillVarianceMl: runData.fillVarianceML || undefined,
        abvAtPackaging: runData.abvAtPackaging || undefined,
        carbonationLevel: runData.carbonationLevel as any || undefined,
        testMethod: runData.testMethod || "",
        testDate: runData.testDate ? runData.testDate.toISOString().slice(0, 16) : "",
        qaNotes: runData.qaNotes || "",
      })
    }
  }, [open, runData, reset])

  // Watch form values for validation feedback
  const abvValue = watch("abvAtPackaging")
  const fillVarianceValue = watch("fillVarianceMl")

  // Get ABV status and styling
  const getABVStatus = () => {
    if (!abvValue) return null
    if (abvValue < 0 || abvValue > 100) return { color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle, message: "Invalid ABV range" }
    if (abvValue < 3) return { color: "text-yellow-600", bg: "bg-yellow-50", icon: AlertTriangle, message: "Low ABV for cider" }
    if (abvValue > 12) return { color: "text-yellow-600", bg: "bg-yellow-50", icon: AlertTriangle, message: "High ABV for cider" }
    return { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle, message: "Normal ABV range" }
  }

  // Get fill variance status and styling
  const getFillVarianceStatus = () => {
    if (fillVarianceValue === undefined || fillVarianceValue === null) return null
    if (Math.abs(fillVarianceValue) > 50) return { color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle, message: "Excessive fill variance" }
    if (Math.abs(fillVarianceValue) > 20) return { color: "text-yellow-600", bg: "bg-yellow-50", icon: AlertTriangle, message: "High fill variance" }
    return { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle, message: "Acceptable fill variance" }
  }

  const abvStatus = getABVStatus()
  const fillVarianceStatus = getFillVarianceStatus()

  const handleFormSubmit = async (data: QAUpdateFormData) => {
    setIsSubmitting(true)
    try {
      const updateData: any = {
        runId: runId,
      }

      // Only include fields that have been provided
      if (data.fillCheck !== undefined) updateData.fillCheck = data.fillCheck
      if (data.fillVarianceMl !== undefined) updateData.fillVarianceMl = data.fillVarianceMl
      if (data.abvAtPackaging !== undefined) updateData.abvAtPackaging = data.abvAtPackaging
      if (data.carbonationLevel !== undefined) updateData.carbonationLevel = data.carbonationLevel
      if (data.testMethod !== undefined && data.testMethod.trim() !== "") updateData.testMethod = data.testMethod.trim()
      if (data.testDate !== undefined && data.testDate.trim() !== "") updateData.testDate = new Date(data.testDate)
      if (data.qaNotes !== undefined && data.qaNotes.trim() !== "") updateData.qaNotes = data.qaNotes.trim()

      await updateQAMutation.mutateAsync(updateData)

      // Invalidate relevant queries to refresh data
      utils.packaging.get.invalidate(runId)
      utils.packaging.list.invalidate()

      // Show success toast
      toast({
        title: "QA Data Updated",
        description: "Quality assurance measurements have been successfully updated.",
      })

      console.log("QA data updated successfully")
      onClose()
    } catch (error) {
      console.error("Failed to update QA data:", error)

      // Show error toast with specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast({
        title: "Failed to Update QA Data",
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BeakerIcon className="w-5 h-5" />
            Update QA Data
          </DialogTitle>
          <DialogDescription>
            Update quality assurance measurements for {runData?.batchName || 'this packaging run'}
            {runData?.packageType && runData?.packageSizeML && (
              ` (${runData.packageSizeML}ml ${runData.packageType})`
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Fill Check */}
          <div>
            <Label htmlFor="fillCheck">Fill Check</Label>
            <Select onValueChange={(value) => setValue("fillCheck", value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select fill check result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
                <SelectItem value="not_tested">Not Tested</SelectItem>
              </SelectContent>
            </Select>
            {errors.fillCheck && (
              <p className="text-sm text-red-600 mt-1">{errors.fillCheck.message}</p>
            )}
          </div>

          {/* Fill Variance */}
          <div>
            <Label htmlFor="fillVarianceMl">Fill Variance (ml)</Label>
            <Input
              id="fillVarianceMl"
              type="number"
              step="0.1"
              placeholder="e.g., -5.2 (underfill) or +3.1 (overfill)"
              {...register("fillVarianceMl", { valueAsNumber: true })}
            />
            {errors.fillVarianceMl && (
              <p className="text-sm text-red-600 mt-1">{errors.fillVarianceMl.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Difference from target fill volume (negative = underfill, positive = overfill)</p>

            {/* Fill variance status display */}
            {fillVarianceStatus && (
              <div className={`p-3 rounded-lg border mt-2 ${fillVarianceStatus.bg}`}>
                <div className="flex items-center space-x-2">
                  <fillVarianceStatus.icon className={`w-4 h-4 ${fillVarianceStatus.color}`} />
                  <span className={`text-sm font-medium ${fillVarianceStatus.color}`}>{fillVarianceStatus.message}</span>
                </div>
              </div>
            )}
          </div>

          {/* ABV at Packaging */}
          <div>
            <Label htmlFor="abvAtPackaging">ABV at Packaging (%)</Label>
            <Input
              id="abvAtPackaging"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="e.g., 6.5"
              {...register("abvAtPackaging", { valueAsNumber: true })}
            />
            {errors.abvAtPackaging && (
              <p className="text-sm text-red-600 mt-1">{errors.abvAtPackaging.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Final alcohol by volume percentage</p>

            {/* ABV status display */}
            {abvStatus && (
              <div className={`p-3 rounded-lg border mt-2 ${abvStatus.bg}`}>
                <div className="flex items-center space-x-2">
                  <abvStatus.icon className={`w-4 h-4 ${abvStatus.color}`} />
                  <span className={`text-sm font-medium ${abvStatus.color}`}>{abvStatus.message}</span>
                </div>
              </div>
            )}
          </div>

          {/* Carbonation Level */}
          <div>
            <Label htmlFor="carbonationLevel">Carbonation Level</Label>
            <Select onValueChange={(value) => setValue("carbonationLevel", value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select carbonation level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="still">Still (no carbonation)</SelectItem>
                <SelectItem value="petillant">Pétillant (light carbonation)</SelectItem>
                <SelectItem value="sparkling">Sparkling (full carbonation)</SelectItem>
              </SelectContent>
            </Select>
            {errors.carbonationLevel && (
              <p className="text-sm text-red-600 mt-1">{errors.carbonationLevel.message}</p>
            )}
          </div>

          {/* Test Method */}
          <div>
            <Label htmlFor="testMethod">Test Method</Label>
            <Input
              id="testMethod"
              type="text"
              placeholder="e.g., Hydrometer, Refractometer, Digital meter"
              maxLength={100}
              {...register("testMethod")}
            />
            {errors.testMethod && (
              <p className="text-sm text-red-600 mt-1">{errors.testMethod.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Method used for testing measurements</p>
          </div>

          {/* Test Date */}
          <div>
            <Label htmlFor="testDate">Test Date</Label>
            <Input
              id="testDate"
              type="datetime-local"
              {...register("testDate")}
            />
            {errors.testDate && (
              <p className="text-sm text-red-600 mt-1">{errors.testDate.message}</p>
            )}
          </div>


          {/* QA Notes */}
          <div>
            <Label htmlFor="qaNotes">QA Notes</Label>
            <Textarea
              id="qaNotes"
              placeholder="Quality observations, tasting notes, or other relevant information"
              maxLength={1000}
              rows={4}
              {...register("qaNotes")}
            />
            {errors.qaNotes && (
              <p className="text-sm text-red-600 mt-1">{errors.qaNotes.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Max 1000 characters</p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting || updateQAMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || updateQAMutation.isPending}
            >
              {isSubmitting || updateQAMutation.isPending ? "Updating..." : "Update QA Data"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}