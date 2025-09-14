"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PressRunCompletionForm } from "./press-run-completion-form"
import { PressRunSummary } from "./press-run-summary"
import { PressRunCompletionSuccess } from "./press-run-completion-success"
import { trpc } from "@/utils/trpc"

interface PressRunCompletionProps {
  pressRunId: string
  onComplete?: () => void
  onCancel?: () => void
  onViewJuiceLot?: (vesselId: string) => void
  onStartNewRun?: () => void
  onBackToPressingHome?: () => void
}

type CompletionStep = 'loading' | 'form' | 'success' | 'error'

export function PressRunCompletion({
  pressRunId,
  onComplete,
  onCancel,
  onViewJuiceLot,
  onStartNewRun,
  onBackToPressingHome,
}: PressRunCompletionProps) {
  const [currentStep, setCurrentStep] = useState<CompletionStep>('loading')
  const [completionResult, setCompletionResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Fetch press run details
  const {
    data: pressRunData,
    isLoading: pressRunLoading,
    error: pressRunError,
  } = trpc.pressRun.get.useQuery({ id: pressRunId }, {
    onSuccess: () => setCurrentStep('form'),
    onError: (err) => {
      setError(err.message)
      setCurrentStep('error')
    },
  })

  // Completion mutation
  const completePressRunMutation = trpc.pressRun.finish.useMutation({
    onSuccess: (result) => {
      setCompletionResult({
        id: result.pressRun.id,
        vendorName: pressRunData?.pressRun?.vendorName,
        totalJuiceVolumeL: parseFloat(result.pressRun.totalJuiceVolumeL || '0'),
        extractionRate: result.extractionRate / 100, // Convert percentage to decimal
        vesselName: pressRunData?.pressRun?.vesselName,
        vesselId: result.pressRun.vesselId || '',
        totalAppleWeightKg: parseFloat(pressRunData?.pressRun?.totalAppleWeightKg || '0'),
        endTime: result.pressRun.endTime || new Date().toISOString(),
        laborHours: parseFloat(result.pressRun.laborHours || '0'),
      })
      setCurrentStep('success')
      toast({
        title: "Success",
        description: result.message || 'Press run completed successfully!',
      })

      // Call onComplete callback if provided
      onComplete?.()
    },
    onError: (err) => {
      setError(err.message)
      toast({
        title: "Error",
        description: `Failed to complete press run: ${err.message}`,
        variant: "destructive",
      })
    },
  })

  const handleFormSubmission = async (formData: any) => {
    try {
      setError(null)
      await completePressRunMutation.mutateAsync(formData)
    } catch (err) {
      // Error is handled by mutation onError
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onBackToPressingHome?.()
    }
  }

  const handleViewJuiceLot = () => {
    if (completionResult?.vesselId && onViewJuiceLot) {
      onViewJuiceLot(completionResult.vesselId)
    } else {
      toast({
        title: "Info",
        description: "Juice lot view not available"
      })
    }
  }

  const handleViewPressRun = () => {
    // Navigate to press run details - could be handled by parent
    window.location.href = `/pressing/runs/${pressRunId}`
  }

  // Loading state
  if (currentStep === 'loading' || pressRunLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-sm text-gray-600">Loading press run details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (currentStep === 'error' || pressRunError) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || pressRunError?.message || 'Failed to load press run details'}
          </AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <button
            onClick={handleCancel}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Pressing
          </button>
        </div>
      </div>
    )
  }

  // Success state
  if (currentStep === 'success' && completionResult) {
    return (
      <PressRunCompletionSuccess
        completedPressRun={completionResult}
        onViewJuiceLot={handleViewJuiceLot}
        onStartNewRun={onStartNewRun || (() => window.location.href = '/pressing')}
        onViewPressRun={handleViewPressRun}
        onBackToPressingHome={onBackToPressingHome || (() => window.location.href = '/pressing')}
      />
    )
  }

  // Form state
  if (currentStep === 'form' && pressRunData?.pressRun) {
    return (
      <div className="space-y-8">
        {/* Press Run Summary */}
        <PressRunSummary
          pressRun={{
            id: pressRunData.pressRun.id,
            vendorName: pressRunData.pressRun.vendorName || 'Unknown Vendor',
            status: pressRunData.pressRun.status,
            startTime: pressRunData.pressRun.startTime,
            totalAppleWeightKg: parseFloat(pressRunData.pressRun.totalAppleWeightKg || '0'),
            loads: pressRunData.loads?.map(load => ({
              id: load.id,
              appleVarietyName: load.appleVarietyName || 'Unknown Variety',
              appleWeightKg: parseFloat(load.appleWeightKg || '0'),
              originalWeight: parseFloat(load.originalWeight || '0'),
              originalWeightUnit: load.originalWeightUnit || 'kg',
              loadSequence: load.loadSequence || 0,
              appleCondition: load.appleCondition,
              brixMeasured: load.brixMeasured,
              notes: load.notes,
            })) || [],
          }}
        />

        {/* Completion Form */}
        <PressRunCompletionForm
          pressRunId={pressRunId}
          pressRun={{
            id: pressRunData.pressRun.id,
            vendorName: pressRunData.pressRun.vendorName || 'Unknown Vendor',
            totalAppleWeightKg: parseFloat(pressRunData.pressRun.totalAppleWeightKg || '0'),
            loads: pressRunData.loads?.map(load => ({
              id: load.id,
              appleVarietyName: load.appleVarietyName || 'Unknown Variety',
              appleWeightKg: parseFloat(load.appleWeightKg || '0'),
              originalWeight: parseFloat(load.originalWeight || '0'),
              originalWeightUnit: load.originalWeightUnit || 'kg',
            })) || [],
          }}
          onComplete={handleFormSubmission}
          onCancel={handleCancel}
        />

        {/* Error display during submission */}
        {completePressRunMutation.isError && error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading overlay during submission */}
        {completePressRunMutation.isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <h3 className="font-medium mb-2">Completing Press Run</h3>
                <p className="text-sm text-gray-600">
                  Assigning juice to vessel and updating records...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback
  return (
    <div className="text-center py-8">
      <p className="text-gray-600">Unable to load press run completion interface</p>
    </div>
  )
}